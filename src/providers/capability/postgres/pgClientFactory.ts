import { Client } from "pg";
import type { PostgresClientFactory, PostgresClientHandle, PostgresClientOptions, PostgresQueryResult } from "./types.js";

export interface PgIdleErrorState { readonly fatal: boolean }

export function attachPgIdleErrorGuard(client: Client): PgIdleErrorState {
  const state={fatal:false};
  client.on("error",()=>{state.fatal=true;});
  return state;
}

const unavailable=()=>Object.assign(new Error("PostgreSQL client unavailable."),{code:"ECONNRESET"});

export class PgClientFactory implements PostgresClientFactory {
  create(options: PostgresClientOptions): PostgresClientHandle {
    const client = new Client(options);
    const idleError=attachPgIdleErrorGuard(client);
    const guard=()=>{if(idleError.fatal)throw unavailable();};
    return {
      connect: async () => { guard(); await client.connect(); guard(); },
      query: async query => {
        guard();
        const result = await client.query(query);
        guard();
        return { rows: result.rows as unknown[], fields: result.fields?.map(field => ({ name: field.name })) } satisfies PostgresQueryResult;
      },
      end: async () => { await client.end(); },
      hasFatalIdleError: () => idleError.fatal,
    };
  }
}
