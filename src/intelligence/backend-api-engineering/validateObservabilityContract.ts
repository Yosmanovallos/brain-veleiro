import { findForbiddenBindings, pushError } from "./sharedValidation.js";
import type { BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export function validateObservabilityContract(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const o = input.observability_contract as unknown as Record<string, unknown>;
  for (const key of ["request_id_required", "operation_name_required", "duration_required", "outcome_class_required", "error_code_required_on_error"]) {
    if (o[key] !== true) pushError(errors, "HI-026", `observability field '${key}' must be required`);
  }
  if (o.log_raw_headers !== false || o.log_raw_body !== false) pushError(errors, "HI-027", "raw headers/body logging is forbidden");
  const allow = input.observability_contract.log_field_allowlist.map((field) => field.toLowerCase());
  if (allow.some((field) => /authorization|cookie|token|api.?key|secret|password|private.?key|raw.?body/.test(field))) {
    pushError(errors, "HI-027", "log allowlist contains a secret/PII-bearing field");
  }
  for (const finding of findForbiddenBindings(input.observability_contract)) pushError(errors, "HI-028", `observability vendor/provider binding at ${finding}`);
  return { valid: errors.length === 0, errors };
}
