import { readFileSync } from "node:fs";
import { join } from "node:path";
const root=join(process.cwd(),"src/providers/capability/postgres");
export const productionSources=():string=>["types.ts","validation.ts","descriptors.ts","queries.ts","pgClientFactory.ts","postgresCapabilityProvider.ts","index.ts"].map(f=>readFileSync(join(root,f),"utf8")).join("\n");
const count=(s:string,re:RegExp)=>(s.match(re)||[]).length;
export const counters=[
 {id:"UC01",name:"model_selected_connection_driver_or_sql_surface",detect:(s:string)=>count(s,/input\.(?:host|port|database|user|password|sql)|input\[["']sql/g),unsafe:"input.sql; input.host"},
 {id:"UC02",name:"environment_or_connection_string_scope_inference",detect:(s:string)=>count(s,/process\.env\.PG|connectionString\s*:/g),unsafe:"process.env.PGHOST; connectionString: x"},
 {id:"UC03",name:"non_loopback_tls_bypass_or_insecure_remote_connection",detect:(s:string)=>count(s,/rejectUnauthorized\s*:\s*false|ssl\s*:\s*false\s*\/\/remote/g),unsafe:"rejectUnauthorized:false"},
 {id:"UC04",name:"arbitrary_sql_write_or_multi_statement_surface",detect:(s:string)=>count(s,/query\(input|;\s*(?:INSERT|UPDATE|DELETE|DROP)|\b(?:INSERT|UPDATE|DELETE|MERGE|COPY|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/g),unsafe:"query(input.sql); SELECT 1; DROP TABLE x"},
 {id:"UC05",name:"row_data_or_sensitive_catalog_definition_exposure",detect:(s:string)=>count(s,/FROM\s+(?:app|brain_s14h_smoke)\.|pg_get_(?:viewdef|functiondef|triggerdef|constraintdef|expr)|pg_(?:roles|shadow|settings|stat_)/gi),unsafe:"SELECT * FROM app.users; pg_get_expr(x); pg_roles"},
 {id:"UC06",name:"credential_connection_or_raw_postgres_error_leak",detect:(s:string)=>count(s,/message:\s*(?:error|String\(error\))|error\.(?:detail|hint|stack|where|routine)/g),unsafe:"message:error; error.detail; error.stack"},
 {id:"UC07",name:"deadline_retry_cleanup_or_orphan_client_escape",detect:(s:string)=>count(s,/\bretry\s*\(|deadline\.arm\([^)]*\).*deadline\.arm|orphanClient|unboundedCleanup/g),unsafe:"retry(); orphanClient; unboundedCleanup"},
 {id:"UC08",name:"result_order_row_limit_or_output_bound_bypass",detect:(s:string)=>count(s,/skipOutputBound|slice\(0\s*,\s*this\.config\.max_rows\s*\+\s*1\)|unorderedResult/g),unsafe:"skipOutputBound; unorderedResult"},
 {id:"UC09",name:"restricted_registry_or_provider_swap_boundary_bypass",detect:(s:string)=>count(s,/bypassRestricted|skipRegistry|mutateAgentDefinition/g),unsafe:"bypassRestricted; skipRegistry; mutateAgentDefinition"},
 {id:"UC10",name:"protected_dependency_future_phase_or_self_closure_drift",detect:(s:string)=>count(s,/from\s+["'](?:pg-native|postgres|knex|sequelize|typeorm|prisma|drizzle)["']|S14I\s*=|HI-054\s*:\s*AWARDED/g),unsafe:"import x from 'pg-native'; S14I = PASS; HI-054: AWARDED"},
];
