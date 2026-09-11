import { performance } from "node:perf_hooks";
import type { CapabilityListRequest, CapabilityProvider, ToolInvocationRequest, ToolInvocationResult } from "../../../core/agent/types.js";
import { descriptorsFor } from "./descriptors.js";
import { PgClientFactory } from "./pgClientFactory.js";
import { BEGIN_READ_ONLY, POSTGRES_INSPECTION_QUERIES, ROLLBACK, VERIFY_READ_ONLY } from "./queries.js";
import { LIMITS, POSTGRES_INSPECT, type PostgresClientHandle, type PostgresClientOptions, type PostgresInspectOperation, type PostgresProviderDependencies, type PostgresQueryResult } from "./types.js";
import { Rejection, SAFE_MESSAGES, reject, utf8Bytes, validateConfig, validateEnvelope, validateInput, validateMaterial } from "./validation.js";

class Deadline {
  readonly start = performance.now(); private end = Infinity; private timer?: NodeJS.Timeout; private readonly controller = new AbortController();
  arm(ms: number): void { this.end = this.start + ms; this.timer = setTimeout(() => this.controller.abort(), Math.max(0,this.remaining())); }
  remaining(): number { return Math.max(0,this.end-performance.now()); }
  expired(): boolean { return this.remaining() <= 0 || this.controller.signal.aborted; }
  duration(): number { return Math.max(0,Math.round(performance.now()-this.start)); }
  bound<T>(pending: Promise<T>): Promise<T> {
    const signal=this.controller.signal;
    return new Promise<T>((resolve,rejectPromise)=>{
      let settled=false;
      const abort=()=>{ if(!settled){settled=true; pending.then(()=>undefined,()=>undefined); rejectPromise(new Rejection("TIMEOUT",SAFE_MESSAGES.timeout,true));} };
      if(signal.aborted){abort();return;} signal.addEventListener("abort",abort,{once:true});
      pending.then(v=>{if(!settled){settled=true;signal.removeEventListener("abort",abort);resolve(v);}},e=>{if(!settled){settled=true;signal.removeEventListener("abort",abort);rejectPromise(e);}});
    });
  }
  dispose(): void { if(this.timer) clearTimeout(this.timer); this.controller.abort(); }
}

const missingResolver = { resolve: async (): Promise<never> => { throw new Rejection("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied); } };

export class PgPostgresInspectProvider implements CapabilityProvider {
  private readonly config; private readonly resolver; private readonly clientFactory;
  constructor(config: unknown, dependencies: PostgresProviderDependencies = {}) {
    if (dependencies === null || typeof dependencies !== "object" || Array.isArray(dependencies) || Object.keys(dependencies).some(k=>k!=="resolver"&&k!=="clientFactory")) throw new Error(SAFE_MESSAGES.invalidConfig);
    this.config=validateConfig(config); this.resolver=dependencies.resolver??missingResolver; this.clientFactory=dependencies.clientFactory??new PgClientFactory();
  }
  async list_capabilities(_request?: CapabilityListRequest) { return descriptorsFor(); }
  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const deadline=new Deadline(); const identity={call_id:request.call_id,capability_id:request.capability_id};
    let client: PostgresClientHandle|undefined; let transactionStarted=false; let result: ToolInvocationResult|undefined; let output: Record<string,unknown>|undefined;
    try {
      if(request.capability_id!==POSTGRES_INSPECT) reject("NOT_FOUND",SAFE_MESSAGES.notFoundCapability);
      validateEnvelope(request); deadline.arm(Math.min(request.timeout_ms,this.config.max_timeout_ms));
      const input=validateInput(request.input,this.config.allowed_schemas);
      let material;
      try { material=validateMaterial(await deadline.bound(Promise.resolve().then(()=>this.resolver.resolve(this.config.connection_ref)))); }
      catch(error){ if(error instanceof Rejection) throw error; reject("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied); }
      const remaining=()=>Math.max(1,Math.floor(deadline.remaining()));
      const ssl: PostgresClientOptions["ssl"] = material.tls.mode==="verify-full" ? {rejectUnauthorized:true,ca:material.tls.ca,...(material.tls.servername?{servername:material.tls.servername}:{})} : false;
      try { client=this.clientFactory.create({host:material.host,port:material.port,database:material.database,user:material.user,password:material.password,ssl,application_name:"brain-postgres-inspect",options:"",pipeline:false,keepAlive:false,connectionTimeoutMillis:remaining(),statement_timeout:remaining(),query_timeout:remaining()}); }
      catch { reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError); }
      try { await deadline.bound(client.connect()); } catch(error) { throw this.classify(error,"connect",deadline); }
      try { await deadline.bound(client.query(BEGIN_READ_ONLY)); transactionStarted=true; } catch(error) { throw this.classify(error,"query",deadline); }
      let verify: PostgresQueryResult;
      try { verify=await deadline.bound(client.query(VERIFY_READ_ONLY)); } catch(error) { throw this.classify(error,"verify",deadline); }
      if(verify.rows.length!==1 || !isRecord(verify.rows[0]) || verify.rows[0].transaction_read_only!=="on") reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);
      const values=queryValues(input.operation,input.schema,input.table,this.config.allowed_schemas,this.config.max_rows+1);
      let raw: PostgresQueryResult;
      try { raw=await deadline.bound(client.query({text:POSTGRES_INSPECTION_QUERIES[input.operation],values})); } catch(error) { throw this.classify(error,"query",deadline); }
      if(!Array.isArray(raw.rows)||raw.rows.length>this.config.max_rows+1) reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);
      const normalized=raw.rows.map(row=>normalizeRow(input.operation,row));
      normalized.sort(comparator(input.operation));
      const truncated=normalized.length>this.config.max_rows; const items=normalized.slice(0,this.config.max_rows);
      output={connection_id:this.config.connection_id,operation:input.operation,items,truncated,observed_at:new Date().toISOString()};
      if(utf8Bytes(JSON.stringify(output))>this.config.max_output_bytes) reject("EXECUTION_FAILED",SAFE_MESSAGES.outputOverflow);
    } catch(error) { result=this.failure(error,identity,deadline); }

    if(transactionStarted&&client){ try{await deadline.bound(client.query(ROLLBACK));}catch{/* primary result is retained; deadline gate below handles timeout */} }
    if(client){ try{await deadline.bound(client.end());}catch{/* bounded best effort */} }
    if(!result) {
      result = deadline.expired() ? this.failure(new Rejection("TIMEOUT",SAFE_MESSAGES.timeout,true),identity,deadline) : {status:"SUCCESS",...identity,output:output!,evidence_refs:[`postgres://${this.config.connection_id}`],duration_ms:deadline.duration()};
    }
    deadline.dispose(); return result;
  }
  private classify(error: unknown, phase: "connect"|"query"|"verify", deadline: Deadline): Rejection {
    if(error instanceof Rejection)return error; if(deadline.expired())return new Rejection("TIMEOUT",SAFE_MESSAGES.timeout,true);
    const code=isRecord(error)&&typeof error.code==="string"?error.code:"";
    if(/^28/.test(code)||code==="42501")return new Rejection("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied);
    if(phase==="connect"||["ECONNREFUSED","ECONNRESET","ENOTFOUND","EHOSTUNREACH","ETIMEDOUT","CERT_HAS_EXPIRED","DEPTH_ZERO_SELF_SIGNED_CERT","UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code)) return new Rejection("UNAVAILABLE",SAFE_MESSAGES.unavailable,true);
    return new Rejection(phase==="verify"?"INTERNAL_ERROR":"EXECUTION_FAILED",phase==="verify"?SAFE_MESSAGES.internalError:SAFE_MESSAGES.executionFailed);
  }
  private failure(error: unknown, identity:{call_id:string;capability_id:string}, deadline:Deadline): ToolInvocationResult {
    const rejection=error instanceof Rejection?error:deadline.expired()?new Rejection("TIMEOUT",SAFE_MESSAGES.timeout,true):new Rejection("INTERNAL_ERROR",SAFE_MESSAGES.internalError);
    return {status:"FAIL",...identity,error:{code:rejection.code,message:rejection.safeMessage,retryable:rejection.retryable},duration_ms:deadline.duration()};
  }
}

function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v);}
function queryValues(op:PostgresInspectOperation,schema:string|undefined,table:string|undefined,allowed:readonly string[],limit:number):unknown[]{
  if(op==="server")return[limit]; if(op==="schemas")return[[...allowed],limit]; if(op==="tables")return[[...allowed],schema??null,limit]; return[schema,table,limit];
}
const text=(r:Record<string,unknown>,k:string,max:number=LIMITS.identifierBytes):string=>{const v=r[k];if(typeof v!=="string"||utf8Bytes(v)<1||utf8Bytes(v)>max||/[\u0000-\u001f\u007f]/u.test(v))reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);return v;};
const bool=(r:Record<string,unknown>,k:string):boolean=>{if(typeof r[k]!=="boolean")reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);return r[k];};
const strings=(r:Record<string,unknown>,k:string):string[]=>{if(!Array.isArray(r[k]))reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);return (r[k] as unknown[]).map(v=>{if(typeof v!=="string"||utf8Bytes(v)<1||utf8Bytes(v)>LIMITS.identifierBytes||/[\u0000-\u001f\u007f]/u.test(v))reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);return v;});};
function comparator(op:PostgresInspectOperation):(a:Record<string,unknown>,b:Record<string,unknown>)=>number{
  const keys=op==="schemas"?["schema"]:op==="tables"?["schema","table","kind"]:op==="columns"?["schema","table","ordinal_position","column"]:op==="indexes"?["schema","table","index"]:op==="constraints"?["schema","table","constraint"]:["server_version","server_version_num"];
  return(a,b)=>{for(const key of keys){const av=a[key],bv=b[key];const compared=typeof av==="number"&&typeof bv==="number"?av-bv:String(av)<String(bv)?-1:String(av)>String(bv)?1:0;if(compared!==0)return compared;}return 0;};
}
function normalizeRow(op:PostgresInspectOperation,row:unknown):Record<string,unknown>{
  if(!isRecord(row))reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);
  if(op==="server")return{server_version:text(row,"server_version",256),server_version_num:text(row,"server_version_num",32)};
  if(op==="schemas")return{schema:text(row,"schema")};
  if(op==="tables"){const kind=text(row,"kind",32);if(!["table","partitioned_table","view","materialized_view","foreign_table"].includes(kind))reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);return{schema:text(row,"schema"),table:text(row,"table"),kind};}
  if(op==="columns"){const ordinal=typeof row.ordinal_position==="string"?Number(row.ordinal_position):row.ordinal_position;if(!Number.isInteger(ordinal)||(ordinal as number)<1)reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);return{schema:text(row,"schema"),table:text(row,"table"),column:text(row,"column"),ordinal_position:ordinal,data_type:text(row,"data_type",LIMITS.dataTypeBytes),nullable:bool(row,"nullable"),has_default:bool(row,"has_default"),generated:bool(row,"generated")};}
  if(op==="indexes")return{schema:text(row,"schema"),table:text(row,"table"),index:text(row,"index"),unique:bool(row,"unique"),primary:bool(row,"primary"),columns:strings(row,"columns"),expression_index:bool(row,"expression_index")};
  const type=text(row,"type",32);if(!["primary_key","unique","foreign_key","check","exclusion"].includes(type))reject("INTERNAL_ERROR",SAFE_MESSAGES.internalError);
  const value:Record<string,unknown>={schema:text(row,"schema"),table:text(row,"table"),constraint:text(row,"constraint"),type,columns:strings(row,"columns"),deferrable:bool(row,"deferrable"),initially_deferred:bool(row,"initially_deferred")};
  if(row.referenced_schema!==null&&row.referenced_schema!==undefined)value.referenced_schema=text(row,"referenced_schema");
  if(row.referenced_table!==null&&row.referenced_table!==undefined)value.referenced_table=text(row,"referenced_table");
  if(row.referenced_columns!==null&&row.referenced_columns!==undefined)value.referenced_columns=strings(row,"referenced_columns"); return value;
}
