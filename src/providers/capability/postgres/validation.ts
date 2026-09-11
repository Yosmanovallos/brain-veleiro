import type { NormalizedToolError, ToolInvocationRequest } from "../../../core/agent/types.js";
import { LIMITS, type PostgresConnectionMaterial, type PostgresInspectOperation, type PostgresInspectProviderConfig } from "./types.js";

export const SAFE_MESSAGES = {
  invalidConfig: "Invalid explicit PostgreSQL inspect provider configuration.",
  invalidInput: "The PostgreSQL inspect input or invocation envelope was invalid.",
  notFoundCapability: "Unknown PostgreSQL inspect capability.",
  permissionDenied: "The PostgreSQL inspection scope or connection was not permitted.",
  unavailable: "The PostgreSQL service could not be reached securely.",
  timeout: "The PostgreSQL inspection exceeded the effective timeout.",
  executionFailed: "The fixed PostgreSQL inspection query could not complete.",
  outputOverflow: "The PostgreSQL observation exceeded the permitted bounds.",
  internalError: "The PostgreSQL inspection returned an unsupported response.",
} as const;

export class Rejection extends Error {
  constructor(readonly code: NormalizedToolError["code"], readonly safeMessage: string, readonly retryable = false) {
    super("PostgreSQL inspection rejected."); this.name = "Rejection";
  }
}
export function reject(code: NormalizedToolError["code"], message: string, retryable = false): never { throw new Rejection(code, message, retryable); }
export const utf8Bytes = (value: string): number => Buffer.byteLength(value, "utf8");
const plain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const noControl = (v: string): boolean => !/[\u0000-\u001f\u007f]/u.test(v);
const boundedText = (v: unknown, min: number, max: number): v is string => typeof v === "string" && utf8Bytes(v) >= min && utf8Bytes(v) <= max && noControl(v);
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(value).every(k => allowed.includes(k));
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

const CONFIG_KEYS = ["connection_id", "connection_ref", "allowed_schemas", "max_timeout_ms", "max_rows", "max_output_bytes"] as const;
export const FORBIDDEN_CONFIG_KEYS = ["host","port","database","user","username","password","connection_string","connectionString","ssl","ca","cert","key","servername","socket","pool","max_pool","application_name","statement_timeout","query_timeout","search_path","options","native","pg_native","retry"] as const;
const systemSchema = (s: string): boolean => s === "pg_catalog" || s === "information_schema" || s === "pg_toast" || s.startsWith("pg_temp") || s.startsWith("pg_toast_temp");

export function validateConfig(value: unknown): PostgresInspectProviderConfig {
  if (!plain(value) || !exactKeys(value, CONFIG_KEYS) || Object.keys(value).length !== CONFIG_KEYS.length) throw new Error(SAFE_MESSAGES.invalidConfig);
  const schemas = value.allowed_schemas;
  if (typeof value.connection_id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,159}$/.test(value.connection_id) ||
      !boundedText(value.connection_ref, 1, LIMITS.connectionRefChars) || !/^[\x20-\x7e]+$/.test(value.connection_ref) || !Array.isArray(schemas) || schemas.length < 1 || schemas.length > LIMITS.schemasMax ||
      schemas.some(s => !boundedText(s, 1, LIMITS.identifierBytes) || systemSchema(s)) || new Set(schemas).size !== schemas.length ||
      !integer(value.max_timeout_ms, 1, LIMITS.timeoutMs) || !integer(value.max_rows, 1, LIMITS.rows) ||
      !integer(value.max_output_bytes, LIMITS.outputBytesMin, LIMITS.outputBytesMax)) throw new Error(SAFE_MESSAGES.invalidConfig);
  const copy = { connection_id: value.connection_id, connection_ref: value.connection_ref, allowed_schemas: Object.freeze([...schemas]) as unknown as string[], max_timeout_ms: value.max_timeout_ms, max_rows: value.max_rows, max_output_bytes: value.max_output_bytes };
  return Object.freeze(copy);
}

export function validateEnvelope(request: ToolInvocationRequest): void {
  if (!plain(request) || !exactKeys(request, ["run_id","turn","call_id","capability_id","input","timeout_ms"]) ||
      !boundedText(request.run_id,1,128) || !boundedText(request.call_id,1,128) || !Number.isInteger(request.turn) || request.turn < 1 ||
      !integer(request.timeout_ms,1,LIMITS.timeoutMs) || !plain(request.input)) reject("INVALID_INPUT", SAFE_MESSAGES.invalidInput);
}

export function validateInput(value: unknown, allowedSchemas: readonly string[]): { operation: PostgresInspectOperation; schema?: string; table?: string } {
  if (!plain(value) || !exactKeys(value,["operation","schema","table"]) || typeof value.operation !== "string" || !["server","schemas","tables","columns","indexes","constraints"].includes(value.operation)) reject("INVALID_INPUT",SAFE_MESSAGES.invalidInput);
  const operation = value.operation as PostgresInspectOperation;
  const schema = value.schema; const table = value.table;
  if (schema !== undefined && !boundedText(schema,1,LIMITS.identifierBytes)) reject("INVALID_INPUT",SAFE_MESSAGES.invalidInput);
  if (table !== undefined && !boundedText(table,1,LIMITS.identifierBytes)) reject("INVALID_INPUT",SAFE_MESSAGES.invalidInput);
  if ((operation === "server" || operation === "schemas") && (schema !== undefined || table !== undefined)) reject("INVALID_INPUT",SAFE_MESSAGES.invalidInput);
  if (operation === "tables" && table !== undefined) reject("INVALID_INPUT",SAFE_MESSAGES.invalidInput);
  if (["columns","indexes","constraints"].includes(operation) && (schema === undefined || table === undefined)) reject("INVALID_INPUT",SAFE_MESSAGES.invalidInput);
  if (schema !== undefined && !allowedSchemas.includes(schema)) reject("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied);
  return Object.freeze({ operation, ...(schema === undefined ? {} : {schema}), ...(table === undefined ? {} : {table}) });
}

export function validateMaterial(value: unknown): PostgresConnectionMaterial {
  if (!plain(value) || !exactKeys(value,["host","port","database","user","password","tls"]) || Object.keys(value).length !== 6 ||
      !boundedText(value.host,1,LIMITS.hostBytes) || value.host.includes("://") || !integer(value.port,1,65535) || !boundedText(value.database,1,LIMITS.identifierBytes) ||
      !boundedText(value.user,1,LIMITS.identifierBytes) || typeof value.password !== "string" || utf8Bytes(value.password) > LIMITS.passwordBytes || !noControl(value.password) || !plain(value.tls)) reject("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied);
  const tls = value.tls; const loopback = value.host === "127.0.0.1" || value.host === "::1";
  if (tls.mode === "disabled-loopback-only") {
    if (!loopback || !exactKeys(tls,["mode"]) || Object.keys(tls).length !== 1) reject("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied);
  } else if (tls.mode === "verify-full") {
    if (!exactKeys(tls,["mode","ca","servername"]) || !boundedText(tls.ca,1,262144) || (tls.servername !== undefined && !boundedText(tls.servername,1,LIMITS.hostBytes))) reject("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied);
  } else reject("PERMISSION_DENIED",SAFE_MESSAGES.permissionDenied);
  return structuredClone(value) as PostgresConnectionMaterial;
}
