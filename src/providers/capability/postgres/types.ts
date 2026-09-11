import type { CapabilityProvider, ToolInvocationRequest, ToolInvocationResult } from "../../../core/agent/types.js";

export const POSTGRES_INSPECT = "postgres.inspect" as const;
export type PostgresCapabilityId = typeof POSTGRES_INSPECT;
export type PostgresInspectOperation = "server" | "schemas" | "tables" | "columns" | "indexes" | "constraints";
export interface PostgresInspectInput { operation: PostgresInspectOperation; schema?: string; table?: string }

export interface PostgresInspectProviderConfig {
  connection_id: string;
  connection_ref: string;
  allowed_schemas: string[];
  max_timeout_ms: number;
  max_rows: number;
  max_output_bytes: number;
}

export type PostgresConnectionMaterial = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  tls: { mode: "verify-full"; ca: string; servername?: string } | { mode: "disabled-loopback-only" };
};

export interface PostgresConnectionResolver {
  resolve(connection_ref: string): Promise<PostgresConnectionMaterial>;
}

export interface PostgresQueryResult { rows: unknown[]; fields?: Array<{ name: string }> }
export interface PostgresClientHandle {
  connect(): Promise<void>;
  query(query: string | { text: string; values?: unknown[] }): Promise<PostgresQueryResult>;
  end(): Promise<void>;
  hasFatalIdleError(): boolean;
}

export interface PostgresClientOptions {
  host: string; port: number; database: string; user: string; password: string | (() => string | Promise<string>);
  ssl: false | { rejectUnauthorized: true; ca: string; servername?: string };
  application_name: "brain-postgres-inspect";
  client_encoding: "UTF8";
  options: "-c default_transaction_read_only=on";
  replication: "false";
  sslnegotiation: "postgres";
  pipeline: false;
  keepAlive: false;
  connectionTimeoutMillis: number;
  statement_timeout: number;
  query_timeout: number;
}

export interface PostgresClientFactory { create(options: PostgresClientOptions): PostgresClientHandle }
export interface PostgresProviderDependencies { resolver?: PostgresConnectionResolver; clientFactory?: PostgresClientFactory }

export interface PostgresInspectionObservation {
  connection_id: string;
  operation: PostgresInspectOperation;
  items: unknown[];
  truncated: boolean;
  observed_at: string;
}

export const LIMITS = {
  connectionIdChars: 160, connectionRefChars: 256, schemasMax: 32, identifierBytes: 63,
  hostBytes: 253, passwordBytes: 4096, dataTypeBytes: 256, timeoutMs: 60000,
  rows: 500, outputBytesMin: 4096, outputBytesMax: 262144,
} as const;

export interface PostgresInspectCapabilityProvider extends CapabilityProvider {
  invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult>;
}
