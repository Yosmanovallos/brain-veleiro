import { expect } from "vitest";
import { RestrictedCapabilityProvider,compileAgentDefinition,runAgent,type AgentDefinition,type CapabilityProvider,type ModelProvider,type ToolDescriptor,type ToolInvocationRequest,type ToolInvocationResult } from "../../src/core/agent/index.js";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import { semanticSignature } from "../../src/providers/capability/registry/validation.js";
import { PgPostgresInspectProvider, POSTGRES_INSPECT, VERIFY_READ_ONLY, type PostgresClientFactory, type PostgresClientHandle, type PostgresClientOptions, type PostgresConnectionMaterial, type PostgresInspectProviderConfig, type PostgresQueryResult } from "../../src/providers/capability/postgres/index.js";

export const SECRET="S14H_SECRET_9f7cbe0d_42f61a";
export const baseConfig=(over:Partial<PostgresInspectProviderConfig>={}):PostgresInspectProviderConfig=>({connection_id:"qa.pg",connection_ref:"secret://s14h/qa",allowed_schemas:["brain_s14h_smoke","app"],max_timeout_ms:1000,max_rows:20,max_output_bytes:32768,...over});
export const material=(over:Partial<PostgresConnectionMaterial>={}):PostgresConnectionMaterial=>({host:"127.0.0.1",port:5432,database:"brain",user:"brain",password:SECRET,tls:{mode:"disabled-loopback-only"},...over});
export const request=(input:Record<string,unknown>,timeout_ms=1000):ToolInvocationRequest=>({run_id:"pg-exercise",turn:1,call_id:"call-1",capability_id:POSTGRES_INSPECT,input,timeout_ms});
export const success=(r:ToolInvocationResult):Record<string,unknown>=>{expect(r.status).toBe("SUCCESS");if(r.status!=="SUCCESS")throw new Error("expected success");return r.output;};
export const fail=(r:ToolInvocationResult,code:string,retryable?:boolean):void=>{expect(r).toMatchObject({status:"FAIL",error:{code}});if(retryable!==undefined&&r.status==="FAIL")expect(r.error.retryable).toBe(retryable);expect(JSON.stringify(r)).not.toContain(SECRET);};
export type Step="connect"|"begin"|"verify"|"select"|"rollback"|"end";
export type Behavior="ok"|"never"|Error|{delay:number;reject?:boolean}|{idleError:unknown};

const defaultRows:Record<string,unknown[]>={
  server:[{server_version:"16.4",server_version_num:"160004"}],
  schemas:[{schema:"app"},{schema:"brain_s14h_smoke"}],
  tables:[{schema:"app",table:"z",kind:"view"},{schema:"app",table:"a",kind:"table"}],
  columns:[{schema:"app",table:"a",column:"id",ordinal_position:1,data_type:"integer",nullable:false,has_default:true,generated:false}],
  indexes:[{schema:"app",table:"a",index:"a_expr_idx",unique:false,primary:false,columns:[],expression_index:true}],
  constraints:[{schema:"app",table:"a",constraint:"a_pkey",type:"primary_key",columns:["id"],referenced_schema:null,referenced_table:null,referenced_columns:null,deferrable:false,initially_deferred:false}],
};
export class FakeClientFactory implements PostgresClientFactory {
  creates=0; options:PostgresClientOptions[]=[]; clients:FakeClient[]=[];
  constructor(readonly behaviors:Partial<Record<Step,Behavior>>={},readonly rows:Partial<Record<string,unknown[]>>={}){}
  create(options:PostgresClientOptions):PostgresClientHandle{this.creates++;this.options.push(structuredClone(options));const c=new FakeClient(this.behaviors,this.rows);this.clients.push(c);return c;}
}
export class FakeClient implements PostgresClientHandle {
  log:string[]=[]; queries:Array<string|{text:string;values?:unknown[]}>=[];
  private fatalIdleError=false;
  constructor(private behaviors:Partial<Record<Step,Behavior>>,private rows:Partial<Record<string,unknown[]>>){ }
  private run<T>(step:Step,value:T):Promise<T>{this.log.push(step);const b=this.behaviors[step]??"ok";if(b==="ok")return Promise.resolve(value);if(typeof b==="object"&&b!==null&&"idleError" in b){this.fatalIdleError=true;return Promise.resolve(value);}if(b==="never")return new Promise(()=>undefined);if(b instanceof Error)return Promise.reject(b);return new Promise((resolve,reject)=>setTimeout(()=>b.reject?reject(new Error(`late ${step}`)):resolve(value),b.delay));}
  connect():Promise<void>{return this.run("connect",undefined);}
  query(q:string|{text:string;values?:unknown[]}):Promise<PostgresQueryResult>{this.queries.push(q);const text=typeof q==="string"?q:q.text;if(text.startsWith("BEGIN"))return this.run("begin",{rows:[]});if(text===VERIFY_READ_ONLY)return this.run("verify",{rows:[{transaction_read_only:"on"}]});if(text==="ROLLBACK")return this.run("rollback",{rows:[]});const op=text.includes("initially_deferred")?"constraints":text.includes("expression_index")?"indexes":text.includes("ordinal_position")?"columns":text.includes("CASE c.relkind")?"tables":text.includes("server_version_num")?"server":"schemas";return this.run("select",{rows:structuredClone(this.rows[op]??defaultRows[op])});}
  end():Promise<void>{return this.run("end",undefined);}
  hasFatalIdleError():boolean{return this.fatalIdleError;}
}
export const harness=(factory=new FakeClientFactory(),resolver={resolve:async()=>material()},config=baseConfig())=>({factory,provider:new PgPostgresInspectProvider(config,{resolver,clientFactory:factory})});

export const definition:AgentDefinition=Object.freeze({
  id:"postgres-metadata-observer",role:"observer",objective:"Observe permitted PostgreSQL metadata and return the observation.",
  model_policy:{routing_class:"BALANCED",require_structured_decisions:true,allow_provider_substitution:true},
  context_policy:{retrieval_mode:"BOUNDED",max_context_tokens:1000,max_items:5,allowed_sources:["CURRENT_TASK"],require_source_refs:false},
  state_schema:{type:"object"},tools:[POSTGRES_INSPECT],skills:[],capabilities:[POSTGRES_INSPECT],
  memory_policy:{retrieve:false,remember_candidate:false,commit_verified_memory:false,search_history:false,promotion_policy:"DISABLED"},
  permissions:{allowed_side_effects:["EXTERNAL"],deny_unlisted_capabilities:true},delegation:{allowed:false},limits:{max_turns:3,timeout_ms:20000},
  termination:{require_terminal_outcome:true,require_explanation:true},output_schema:{type:"object"},rubric:{quality_contract_ref:"brain-bootstrap/quality-contracts/S14H_POSTGRES_INSPECT_CAPABILITY_DEEP.yaml"},evals:[],
}) as AgentDefinition;
export const DEFINITION_BYTES=JSON.stringify(definition);

export async function agentExec(capabilityProvider:CapabilityProvider,input:Record<string,unknown>,agentDefinition:AgentDefinition=definition,provider_id="postgres-pg"){
  const model:ModelProvider={async decide(r){const observation=r.state.prior_observations.at(-1);return observation?{status:"SUCCESS",decision:{type:"FINISH",rationale:"Return the observation.",output:{summary:"Observed.",data:observation.output,evidence_refs:observation.evidence_refs}}}:{status:"SUCCESS",decision:{type:"TOOL_CALL",rationale:"Observe PostgreSQL metadata.",tool_call:{call_id:"obs",capability_id:POSTGRES_INSPECT,input}}};}};
  const registry=new CapabilityRegistryProvider({providers:[{provider_id,provider:capabilityProvider}],bindings:[{capability_id:POSTGRES_INSPECT,selected_provider_id:provider_id}]});
  const compiled=compileAgentDefinition(agentDefinition,{model_provider:model,capability_provider:registry});
  expect(compiled.run_options.capabilityProvider).toBeInstanceOf(RestrictedCapabilityProvider);
  return runAgent(compiled.run_options);
}

export class CompatiblePostgresInspectTestProvider implements CapabilityProvider {
  invokeCallCount=0;
  async list_capabilities():Promise<ToolDescriptor[]>{return [{capability_id:"postgres.inspect",name:"Inspect PostgreSQL metadata",description:"Return bounded structural metadata from an explicitly configured PostgreSQL connection. Arbitrary SQL and application row data are not available.",side_effects:"EXTERNAL",input_schema:{type:"object",additionalProperties:false,required:["operation"],properties:{operation:{type:"string",enum:["server","schemas","tables","columns","indexes","constraints"]},schema:{type:"string",minLength:1,maxLength:63},table:{type:"string",minLength:1,maxLength:63}}},output_schema:{type:"object",additionalProperties:false,required:["connection_id","operation","items","truncated","observed_at"],properties:{connection_id:{type:"string"},operation:{type:"string"},items:{type:"array",maxItems:500},truncated:{type:"boolean"},observed_at:{type:"string"}}}}];}
  async invoke(r:ToolInvocationRequest):Promise<ToolInvocationResult>{this.invokeCallCount++;return {status:"SUCCESS",call_id:r.call_id,capability_id:r.capability_id,output:{connection_id:"qa.pg",operation:"server",items:[{server_version:"16.4",server_version_num:"160004"}],truncated:false,observed_at:new Date(0).toISOString()},evidence_refs:["postgres://qa.pg"],duration_ms:0};}
}
export async function assertCompatibleContracts(a:CapabilityProvider,b:CapabilityProvider):Promise<void>{const descriptor=async(p:CapabilityProvider)=>(await p.list_capabilities())[0];expect(semanticSignature(await descriptor(a))).toBe(semanticSignature(await descriptor(b)));}
