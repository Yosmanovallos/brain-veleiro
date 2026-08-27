import { findForbiddenBindings, nonEmpty, pushError } from "./sharedValidation.js";
import type { BackendApiEngineeringDecision, BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export function validateServiceBoundary(
  input: BackendApiEngineeringInput,
  candidate?: BackendApiEngineeringDecision,
): BackendApiValidationResult {
  const errors: string[] = [];
  const service = input.service_contract;
  if (!nonEmpty(service.operation_id) || !nonEmpty(service.input_ref) || !nonEmpty(service.output_ref)) {
    pushError(errors, "HI-012", "application service operation/input/output refs must be explicit");
  }
  if ((service as unknown as { transport_types_allowed?: unknown }).transport_types_allowed !== false) {
    pushError(errors, "HI-012", "framework request/response transport types are forbidden in services");
  }
  for (const finding of findForbiddenBindings(service)) pushError(errors, "HI-012", `service/provider binding at ${finding}`);
  if (candidate) {
    const transport = candidate.boundary_map?.transport_responsibilities ?? [];
    for (const responsibility of transport) {
      if (/business rule|domain decision|persist|repository call|data[- ]port call|\bsql\b|\borm\b/i.test(responsibility)) {
        pushError(errors, "HI-010", `transport contains business/persistence responsibility '${responsibility}'`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
