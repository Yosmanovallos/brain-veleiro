import { describe,expect,it } from "vitest";
import { PgPostgresInspectProvider,type PostgresConnectionMaterial } from "../../src/providers/capability/postgres/index.js";
import { request } from "./helpers.js";

const enabled=process.env.S14H_PG_REAL_SMOKE==="1";
const live=()=>{
  const required=["S14H_PG_HOST","S14H_PG_PORT","S14H_PG_DATABASE","S14H_PG_USER","S14H_PG_PASSWORD"] as const;
  for(const key of required)expect(process.env[key],`${key} is required`).toBeTruthy();
  const material:PostgresConnectionMaterial={host:process.env.S14H_PG_HOST!,port:Number(process.env.S14H_PG_PORT),database:process.env.S14H_PG_DATABASE!,user:process.env.S14H_PG_USER!,password:process.env.S14H_PG_PASSWORD!,tls:{mode:"disabled-loopback-only"}};
  return {material,provider:new PgPostgresInspectProvider({connection_id:"s14h.real-smoke",connection_ref:"control-plane:ephemeral",allowed_schemas:["brain_s14h_smoke"],max_timeout_ms:10000,max_rows:100,max_output_bytes:65536},{resolver:{resolve:async()=>material}})};
};
describe.skipIf(!enabled)("S14H real disposable PostgreSQL smoke",()=>{
  it("FX-POS-012 real disposable local PostgreSQL smoke performs all six operations successfully without row-data access",async()=>{
    const {material,provider}=live();
    const inputs=[{operation:"server"},{operation:"schemas"},{operation:"tables"}];
    const outputs=[];
    for(const input of inputs){const result=await provider.invoke(request(input,10000));expect(result.status).toBe("SUCCESS");if(result.status==="SUCCESS")outputs.push(result.output);}
    const serverItems=outputs[0].items as Array<Record<string,unknown>>;
    expect(serverItems).toEqual([expect.objectContaining({server_version:expect.any(String),server_version_num:expect.any(String)})]);
    expect(serverItems[0]).toEqual({server_version:serverItems[0].server_version,server_version_num:serverItems[0].server_version_num});
    expect(outputs[1].items).toEqual([{schema:"brain_s14h_smoke"}]);
    expect((outputs[2].items as any[]).every(x=>x.schema==="brain_s14h_smoke")).toBe(true);
    const tables=(outputs[2].items as Array<{table:string}>).map(x=>x.table);
    expect(tables.length).toBeGreaterThanOrEqual(2);
    const columns:any[]=[];const indexes:any[]=[];const constraints:any[]=[];
    for(const table of tables){for(const [operation,target] of [["columns",columns],["indexes",indexes],["constraints",constraints]] as const){const result=await provider.invoke(request({operation,schema:"brain_s14h_smoke",table},10000));expect(result.status).toBe("SUCCESS");if(result.status==="SUCCESS")target.push(...result.output.items as any[]);}}
    expect(columns.length).toBeGreaterThan(0);
    expect(indexes.some(x=>x.expression_index===true)).toBe(true);
    for(const type of ["primary_key","unique","foreign_key","check"])expect(constraints.some(x=>x.type===type),`missing ${type}`).toBe(true);
    expect(constraints.filter(x=>x.type==="foreign_key").some(x=>x.referenced_schema==="brain_s14h_smoke"&&Array.isArray(x.referenced_columns))).toBe(true);
    const serialized=JSON.stringify([...outputs,...columns,...indexes,...constraints]);
    for(const secret of [material.password,"control-plane:ephemeral",material.host])expect(serialized).not.toContain(secret);
    const forbiddenKeys=new Set(["database","user","host","port","connection_ref","password"]);
    const assertNoForbiddenKeys=(value:unknown):void=>{
      if(Array.isArray(value)){for(const item of value)assertNoForbiddenKeys(item);return;}
      if(value!==null&&typeof value==="object"){
        for(const [key,item] of Object.entries(value)){expect(forbiddenKeys.has(key),`forbidden output key: ${key}`).toBe(false);assertNoForbiddenKeys(item);}
      }
    };
    assertNoForbiddenKeys([...outputs,...columns,...indexes,...constraints]);
    expect(serialized).not.toMatch(/CREATE INDEX|CHECK\s*\(|password|row_value|raw_error/i);
    const descriptor=(await provider.list_capabilities())[0];expect(Object.keys((descriptor.input_schema as any).properties)).toEqual(["operation","schema","table"]);
  },30000);
  it("S14H-HI-031 real disposable local PostgreSQL smoke succeeds before candidate readiness",async()=>{const {provider}=live();const result=await provider.invoke(request({operation:"server"},10000));expect(result.status).toBe("SUCCESS");if(result.status==="SUCCESS")expect(result.output).toMatchObject({operation:"server",items:[{server_version:expect.any(String),server_version_num:expect.any(String)}]});},15000);
});
