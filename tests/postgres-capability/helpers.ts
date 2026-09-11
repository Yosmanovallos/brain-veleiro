import { expect } from "vitest";
import type { ToolInvocationRequest, ToolInvocationResult } from "../../src/core/agent/types.js";
import { PgPostgresInspectProvider, POSTGRES_INSPECT, VERIFY_READ_ONLY, type PostgresClientFactory, type PostgresClientHandle, type PostgresClientOptions, type PostgresConnectionMaterial, type PostgresInspectProviderConfig, type PostgresQueryResult } from "../../src/providers/capability/postgres/index.js";

export const SECRET="S14H_SECRET_9f7cbe0d_42f61a";
export const baseConfig=(over:Partial<PostgresInspectProviderConfig>={}):PostgresInspectProviderConfig=>({connection_id:"qa.pg",connection_ref:"secret://s14h/qa",allowed_schemas:["brain_s14h_smoke","app"],max_timeout_ms:1000,max_rows:20,max_output_bytes:32768,...over});
export const material=(over:Partial<PostgresConnectionMaterial>={}):PostgresConnectionMaterial=>({host:"127.0.0.1",port:5432,database:"brain",user:"brain",password:SECRET,tls:{mode:"disabled-loopback-only"},...over});
export const request=(input:Record<string,unknown>,timeout_ms=1000):ToolInvocationRequest=>({run_id:"pg-exercise",turn:1,call_id:"call-1",capability_id:POSTGRES_INSPECT,input,timeout_ms});
export const success=(r:ToolInvocationResult):Record<string,unknown>=>{expect(r.status).toBe("SUCCESS");if(r.status!=="SUCCESS")throw new Error("expected success");return r.output;};
export const fail=(r:ToolInvocationResult,code:string,retryable?:boolean):void=>{expect(r).toMatchObject({status:"FAIL",error:{code}});if(retryable!==undefined&&r.status==="FAIL")expect(r.error.retryable).toBe(retryable);expect(JSON.stringify(r)).not.toContain(SECRET);};
export type Step="connect"|"begin"|"verify"|"select"|"rollback"|"end";
export type Behavior="ok"|"never"|Error|{delay:number;reject?:boolean};

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
  constructor(private behaviors:Partial<Record<Step,Behavior>>,private rows:Partial<Record<string,unknown[]>>){ }
  private run<T>(step:Step,value:T):Promise<T>{this.log.push(step);const b=this.behaviors[step]??"ok";if(b==="ok")return Promise.resolve(value);if(b==="never")return new Promise(()=>undefined);if(b instanceof Error)return Promise.reject(b);return new Promise((resolve,reject)=>setTimeout(()=>b.reject?reject(new Error(`late ${step}`)):resolve(value),b.delay));}
  connect():Promise<void>{return this.run("connect",undefined);}
  query(q:string|{text:string;values?:unknown[]}):Promise<PostgresQueryResult>{this.queries.push(q);const text=typeof q==="string"?q:q.text;if(text.startsWith("BEGIN"))return this.run("begin",{rows:[]});if(text===VERIFY_READ_ONLY)return this.run("verify",{rows:[{transaction_read_only:"on"}]});if(text==="ROLLBACK")return this.run("rollback",{rows:[]});const op=text.includes("initially_deferred")?"constraints":text.includes("expression_index")?"indexes":text.includes("ordinal_position")?"columns":text.includes("CASE c.relkind")?"tables":text.includes("server_version_num")?"server":"schemas";return this.run("select",{rows:structuredClone(this.rows[op]??defaultRows[op])});}
  end():Promise<void>{return this.run("end",undefined);}
}
export const harness=(factory=new FakeClientFactory(),resolver={resolve:async()=>material()},config=baseConfig())=>({factory,provider:new PgPostgresInspectProvider(config,{resolver,clientFactory:factory})});
