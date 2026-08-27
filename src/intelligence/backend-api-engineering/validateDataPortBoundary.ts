import { findForbiddenBindings, nonEmpty, pushError } from "./sharedValidation.js";
import type { BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

const KINDS = new Set(["READ", "CREATE", "UPDATE", "DELETE", "EXISTS", "LIST", "ATOMIC_GROUP_REQUIRED"]);

export function validateDataPortBoundary(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const requirement of input.data_port_requirements ?? []) {
    if (!nonEmpty(requirement.id) || ids.has(requirement.id)) pushError(errors, "HI-013", "data-port ids must be unique/non-empty");
    ids.add(requirement.id);
    if (!KINDS.has(requirement.kind) || !nonEmpty(requirement.resource)) pushError(errors, "HI-013", `invalid logical data-port ${requirement.id}`);
  }
  for (const finding of findForbiddenBindings({ ports: input.data_port_requirements, atomicity: input.atomicity_contract })) {
    pushError(errors, "HI-014", `persistence/transaction mechanism leaks at ${finding}`);
  }
  if (input.atomicity_contract.requirement === "ATOMIC_GROUP_REQUIRED") {
    if (input.atomicity_contract.logical_operation_refs.length < 2) pushError(errors, "HI-013", "atomic group needs at least two logical operation refs");
    for (const ref of input.atomicity_contract.logical_operation_refs) {
      if (!ids.has(ref)) pushError(errors, "HI-013", `atomicity ref '${ref}' is not a declared logical operation`);
    }
  }
  return { valid: errors.length === 0, errors };
}
