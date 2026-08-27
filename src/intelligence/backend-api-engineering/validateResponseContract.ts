import { pushError } from "./sharedValidation.js";
import type { BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export function validateResponseContract(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const variants = input.response_contract.variants ?? [];
  const ids = new Set<string>();
  for (const variant of variants) {
    if (!variant.id || ids.has(variant.id)) pushError(errors, "HI-019", `response variant id '${variant.id}' is empty/duplicate`);
    ids.add(variant.id);
    if (!variant.schema || typeof variant.schema !== "object" || !variant.condition || !Number.isInteger(variant.http_status)) {
      pushError(errors, "HI-019", `response variant '${variant.id}' lacks schema/status/condition`);
    }
  }
  for (const id of input.response_contract.success_variant_ids ?? []) {
    if (!ids.has(id)) pushError(errors, "HI-019", `success variant '${id}' is undeclared`);
  }
  if (!variants.some((variant) => input.response_contract.success_variant_ids.includes(variant.id) && variant.http_status === input.operation.success_status)) {
    pushError(errors, "HI-019", "operation success_status is not mapped to a declared success variant");
  }
  if ((input.response_contract as unknown as { output_validation_required?: unknown }).output_validation_required !== true) {
    pushError(errors, "HI-020", "output_validation_required must be true");
  }
  return { valid: errors.length === 0, errors };
}
