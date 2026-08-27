import type { ApiOperationClass, BackendApiEngineeringInput } from "./types.js";

export function classifyApiOperation(input: BackendApiEngineeringInput): ApiOperationClass {
  if (input.side_effect_contract.class === "EXTERNAL_SIDE_EFFECT") return "EXTERNAL_EFFECT";
  if (input.side_effect_contract.class !== "READ_ONLY") return "PROTECTED_WRITE";
  return input.auth_contract.authentication === "PUBLIC" ? "PUBLIC_READ" : "AUTHENTICATED_READ";
}
