import { nonEmpty, pushError } from "./sharedValidation.js";
import type {
  ApiRequestContract,
  BackendApiEngineeringInput,
  BackendApiValidationResult,
  RequestPayloadValidationResult,
} from "./types.js";

function schemaTypeAccepts(schema: unknown, value: unknown): boolean {
  const type = (schema as { type?: unknown } | null)?.type;
  if (!type) return true;
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "array") return Array.isArray(value);
  if (type === "object") return !!value && typeof value === "object" && !Array.isArray(value);
  if (type === "null") return value === null;
  return typeof value === type;
}

export function validateRequestPayload(
  contract: ApiRequestContract,
  payload: Record<string, unknown>,
): RequestPayloadValidationResult {
  const errors: string[] = [];
  const normalized: Record<string, unknown> = {};
  const fields = new Map(contract.fields.map((field) => [field.id, field]));
  const extras = new Set(contract.additional_field_ids ?? []);
  for (const field of contract.fields) {
    if (field.required && !(field.id in payload)) errors.push(`missing required field '${field.id}'`);
  }
  for (const [key, raw] of Object.entries(payload)) {
    const field = fields.get(key);
    if (!field) {
      const explicitlyAllowed =
        contract.unknown_field_policy === "ALLOW_DECLARED_ADDITIONAL_FIELDS" && extras.has(key);
      if (!explicitlyAllowed) errors.push(`unknown field '${key}'`);
      else normalized[key] = raw;
      continue;
    }
    let value = raw;
    if (field.normalization) {
      if (field.normalization.kind === "TRIM_STRING" && typeof value === "string") value = value.trim();
      else if (field.normalization.kind === "STRING_TO_INTEGER" && typeof value === "string" && /^-?\d+$/.test(value)) {
        value = Number(value);
      }
    }
    if (!schemaTypeAccepts(field.schema, value)) errors.push(`field '${key}' does not match its declared schema`);
    else normalized[key] = value;
  }
  return { valid: errors.length === 0, errors, normalized };
}

export function validateRequestContract(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const contract = input.request_contract;
  const injectedOperations = (input as unknown as { operations?: unknown }).operations;
  if (!nonEmpty(input.task_ref) || !nonEmpty(input.operation?.operation_id) || injectedOperations !== undefined) {
    pushError(errors, "HI-001", "exactly one non-empty task_ref and operation_id are required");
  }
  const seen = new Set<string>();
  for (const field of contract.fields ?? []) {
    const key = `${field.location}:${field.id}`;
    if (!nonEmpty(field.id) || seen.has(key)) pushError(errors, "HI-005", `duplicate/empty request field ${key}`);
    seen.add(key);
    if (!field.schema || typeof field.schema !== "object") pushError(errors, "HI-005", `field ${field.id} has no schema`);
    if (field.normalization && field.normalization.failure !== "REJECT") {
      pushError(errors, "HI-007", `normalization for ${field.id} must fail closed`);
    }
  }
  const declared = new Set(contract.fields.map((field) => field.id));
  for (const ref of contract.consumed_field_refs ?? [...declared]) {
    if (!declared.has(ref)) pushError(errors, "HI-005", `consumed request field '${ref}' is undeclared`);
  }
  if (contract.unknown_field_policy === "ALLOW_DECLARED_ADDITIONAL_FIELDS" && !(contract.additional_field_ids?.length)) {
    pushError(errors, "HI-006", "additional fields policy requires an explicit bounded additional_field_ids list");
  }
  if (contract.has_body) {
    if (!(contract.accepted_content_types?.length > 0)) pushError(errors, "HI-008", "body content types are missing");
    if (!Number.isInteger(contract.max_body_bytes) || (contract.max_body_bytes ?? 0) <= 0) {
      pushError(errors, "HI-009", "max_body_bytes must be a positive integer");
    }
  } else if (contract.fields.some((field) => field.location === "BODY" && field.required)) {
    pushError(errors, "HI-009", "a no-body operation cannot require a BODY field");
  }
  return { valid: errors.length === 0, errors };
}
