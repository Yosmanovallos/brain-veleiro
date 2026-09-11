import { Client } from "pg";
import type { PostgresClientFactory, PostgresClientHandle, PostgresClientOptions, PostgresQueryResult } from "./types.js";

export class PgClientFactory implements PostgresClientFactory {
  create(options: PostgresClientOptions): PostgresClientHandle {
    const client = new Client(options);
    return {
      connect: async () => { await client.connect(); },
      query: async query => {
        const result = await client.query(query);
        return { rows: result.rows as unknown[], fields: result.fields?.map(field => ({ name: field.name })) } satisfies PostgresQueryResult;
      },
      end: () => client.end(),
    };
  }
}
