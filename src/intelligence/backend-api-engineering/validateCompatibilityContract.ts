import { pushError } from "./sharedValidation.js";
import type { BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export function validateCompatibilityContract(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const compatibility = input.compatibility_contract;
  const collection = input.operation.collection;
  if (compatibility.existing_contract_ref && compatibility.mode === "NEW") pushError(errors, "HI-029", "an existing contract cannot use NEW compatibility mode");
  if (collection.potentially_unbounded && collection.pagination === "NOT_APPLICABLE") pushError(errors, "HI-031", "potentially unbounded collection needs pagination or rationale");
  if (collection.pagination === "BOUNDED_CARDINALITY_RATIONALE" && !collection.bounded_cardinality_rationale?.trim()) pushError(errors, "HI-031", "bounded-cardinality mode needs a rationale");
  const declared = new Set(input.request_contract.fields.map((field) => field.id));
  for (const field of collection.allowed_filter_fields) if (!declared.has(field)) pushError(errors, "HI-032", `filter field '${field}' is undeclared`);
  for (const field of collection.allowed_sort_fields) if (!declared.has(field)) pushError(errors, "HI-032", `sort field '${field}' is undeclared`);
  if ([...collection.allowed_filter_fields, ...collection.allowed_sort_fields].some((field) => /\s|\(|\)|;|--/.test(field))) {
    pushError(errors, "HI-032", "filter/sort contracts cannot be SQL expressions");
  }
  return { valid: errors.length === 0, errors };
}
