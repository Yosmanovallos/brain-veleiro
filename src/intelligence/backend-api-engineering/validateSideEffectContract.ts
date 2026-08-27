import { findForbiddenBindings, pushError } from "./sharedValidation.js";
import type { BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export function validateSideEffectContract(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const side = input.side_effect_contract;
  if (side.class === "READ_ONLY" && side.idempotency !== "NOT_APPLICABLE") pushError(errors, "HI-023", "READ_ONLY requires NOT_APPLICABLE idempotency");
  if (side.class === "IDEMPOTENT_WRITE" && side.idempotency !== "DECLARED_IDEMPOTENT") pushError(errors, "HI-024", "IDEMPOTENT_WRITE must be explicitly declared idempotent");
  if ((side.class === "NON_IDEMPOTENT_WRITE" || side.class === "EXTERNAL_SIDE_EFFECT") && side.caller_retryable) {
    if (side.idempotency !== "IDEMPOTENCY_REQUIRED" && side.idempotency !== "DEFERRED_TO_S13O") {
      pushError(errors, "HI-024", "retryable duplicate-prone effects require idempotency or S13O handoff");
    }
  }
  if (side.idempotency === "DEFERRED_TO_S13O" && !side.s13o_handoff_ref?.trim()) pushError(errors, "HI-024", "DEFERRED_TO_S13O needs a handoff ref");
  for (const finding of findForbiddenBindings(input)) {
    if (/retry|backoff|job_queue|idempotency_store/i.test(finding)) pushError(errors, "HI-025", `S13O runtime mechanism at ${finding}`);
  }
  return { valid: errors.length === 0, errors };
}
