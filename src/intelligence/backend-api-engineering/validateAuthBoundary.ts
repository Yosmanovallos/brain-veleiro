import { pushError } from "./sharedValidation.js";
import type { BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export function validateAuthBoundary(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const auth = input.auth_contract;
  const protectedEffect = input.side_effect_contract.class !== "READ_ONLY";
  if (auth.authentication === "AUTHENTICATED" && protectedEffect && auth.authorization === "NONE") {
    pushError(errors, "HI-016", "authenticated protected effects require an authorization boundary");
  }
  if ((auth.authorization !== "NONE" || protectedEffect) && !auth.authorization_before_service_effect) {
    pushError(errors, "HI-016", "authorization must precede protected service effects/disclosure");
  }
  if (auth.authorization === "RESOURCE_REQUIRED" && (auth.scope === "NONE" || !auth.trusted_scope_source)) {
    pushError(errors, "HI-018", "RESOURCE_REQUIRED needs a non-NONE scope and trusted scope source");
  }
  const fields = new Map(input.request_contract.fields.map((field) => [field.id, field]));
  for (const id of auth.client_identity_fields_non_authoritative) {
    if (fields.get(id)?.authority_role !== "NON_AUTHORITATIVE_IDENTITY_HINT") {
      pushError(errors, "HI-017", `client identity field '${id}' is not explicitly non-authoritative`);
    }
  }
  for (const field of input.request_contract.fields) {
    if (field.authority_role === "NON_AUTHORITATIVE_IDENTITY_HINT" && !auth.client_identity_fields_non_authoritative.includes(field.id)) {
      pushError(errors, "HI-017", `identity-bearing field '${field.id}' is omitted from the non-authoritative list`);
    }
  }
  return { valid: errors.length === 0, errors };
}
