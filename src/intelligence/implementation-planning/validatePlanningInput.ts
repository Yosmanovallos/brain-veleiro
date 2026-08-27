import type { ImplementationPlanningInput } from "./types.js";
import { classifyMaterialRef } from "./sharedDerivations.js";

/**
 * Brain — S13F bounded input-contract validation.
 *
 * Implements brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md
 * section 3.1. Exported so tests can exercise it directly, mirroring S13E's
 * validateAgentEngineeringInput().
 *
 * This throws only for STRUCTURAL defects (malformed refs, missing required
 * inputs, wrong applicability enum). Approval-state handling (a not-APPROVED
 * Spec, a REJECTED or PENDING decision, an APPLICABLE agent-design with no
 * result) is NOT a throw — spec sections 3.2 / "Approval and plan status" make
 * those a BLOCKED / PROVISIONAL plan RESULT, produced by the planning pass.
 */

const APPROVAL_STATUSES = new Set(["APPROVED", "PENDING", "REJECTED"]);
const SPEC_PRIORITIES = new Set(["REQUIRED", "SHOULD", "OPTIONAL"]);

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function assertUniqueRefs(refs: string[], label: string): void {
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref)) throw new Error(`ImplementationPlanningInput.spec ${label} contains a duplicate ref '${ref}'.`);
    seen.add(ref);
  }
}

export function validatePlanningInput(input: ImplementationPlanningInput | undefined): ImplementationPlanningInput {
  if (!input || typeof input !== "object") {
    throw new Error("ImplementationPlanningInput is required (spec section 2).");
  }

  const spec = input.spec;
  if (!spec || typeof spec !== "object") {
    throw new Error("ImplementationPlanningInput.spec (ImplementationPlanningSpecSnapshot) is required.");
  }
  if (!nonEmpty(spec.spec_id)) throw new Error("spec.spec_id must be a non-empty string.");
  if (!nonEmpty(spec.version)) throw new Error("spec.version must be a non-empty string.");
  if (!spec.approval || !APPROVAL_STATUSES.has(spec.approval.status)) {
    throw new Error("spec.approval.status must be APPROVED | PENDING | REJECTED.");
  }

  for (const arr of [
    "requirements",
    "non_functional_requirements",
    "constraints",
    "assumptions",
    "acceptance_criteria",
  ] as const) {
    if (!Array.isArray(spec[arr])) throw new Error(`spec.${arr} must be an array.`);
  }

  if (spec.requirements.length === 0) {
    throw new Error("spec.requirements must contain at least one requirement (spec section 3.1).");
  }

  for (const [i, r] of spec.requirements.entries()) {
    if (classifyMaterialRef(r.ref) !== "R") {
      throw new Error(`spec.requirements[${i}].ref '${r.ref}' must match R-### (spec section 3.1).`);
    }
    if (!SPEC_PRIORITIES.has(r.priority)) {
      throw new Error(`spec.requirements[${i}].priority must be REQUIRED | SHOULD | OPTIONAL.`);
    }
    if (!nonEmpty(r.statement)) throw new Error(`spec.requirements[${i}].statement must be a non-empty string.`);
    if (!Array.isArray(r.acceptance_refs)) throw new Error(`spec.requirements[${i}].acceptance_refs must be an array.`);
    for (const ac of r.acceptance_refs) {
      if (classifyMaterialRef(ac) !== "AC") {
        throw new Error(`spec.requirements[${i}].acceptance_refs contains '${ac}', which must match AC-###.`);
      }
    }
  }
  for (const [i, nfr] of spec.non_functional_requirements.entries()) {
    if (classifyMaterialRef(nfr.ref) !== "NFR") {
      throw new Error(`spec.non_functional_requirements[${i}].ref '${nfr.ref}' must match NFR-###.`);
    }
    if (!nonEmpty(nfr.statement)) throw new Error(`spec.non_functional_requirements[${i}].statement must be non-empty.`);
  }
  for (const [i, c] of spec.constraints.entries()) {
    if (classifyMaterialRef(c.ref) !== "C") throw new Error(`spec.constraints[${i}].ref '${c.ref}' must match C-###.`);
    if (!nonEmpty(c.statement)) throw new Error(`spec.constraints[${i}].statement must be non-empty.`);
  }
  for (const [i, a] of spec.assumptions.entries()) {
    if (classifyMaterialRef(a.ref) !== "A") throw new Error(`spec.assumptions[${i}].ref '${a.ref}' must match A-###.`);
    if (!nonEmpty(a.statement)) throw new Error(`spec.assumptions[${i}].statement must be non-empty.`);
  }
  for (const [i, ac] of spec.acceptance_criteria.entries()) {
    if (classifyMaterialRef(ac.ref) !== "AC") {
      throw new Error(`spec.acceptance_criteria[${i}].ref '${ac.ref}' must match AC-###.`);
    }
    if (!nonEmpty(ac.success_condition)) {
      throw new Error(`spec.acceptance_criteria[${i}].success_condition must be non-empty.`);
    }
  }

  assertUniqueRefs(spec.requirements.map((r) => r.ref), "requirements");
  assertUniqueRefs(spec.non_functional_requirements.map((r) => r.ref), "non_functional_requirements");
  assertUniqueRefs(spec.constraints.map((r) => r.ref), "constraints");
  assertUniqueRefs(spec.assumptions.map((r) => r.ref), "assumptions");
  assertUniqueRefs(spec.acceptance_criteria.map((r) => r.ref), "acceptance_criteria");

  if (!input.architecture || typeof input.architecture !== "object") {
    throw new Error("ImplementationPlanningInput.architecture (ApprovedDecisionInput<SoftwareArchitectureDecisionResult>) is required (spec section 2).");
  }
  if (!input.architecture.result || typeof input.architecture.result !== "object") {
    throw new Error("architecture.result (SoftwareArchitectureDecisionResult) is required.");
  }
  if (!input.architecture.approval || !APPROVAL_STATUSES.has(input.architecture.approval.status)) {
    throw new Error("architecture.approval.status must be APPROVED | PENDING | REJECTED.");
  }
  if (!nonEmpty(input.architecture.result.adr?.id)) {
    throw new Error("architecture.result.adr.id must be a non-empty string.");
  }

  if (input.agent_design_applicability !== "APPLICABLE" && input.agent_design_applicability !== "NOT_APPLICABLE") {
    throw new Error("agent_design_applicability must be APPLICABLE | NOT_APPLICABLE (spec section 2).");
  }
  if (input.agent_engineering !== undefined) {
    if (!input.agent_engineering.result || typeof input.agent_engineering.result !== "object") {
      throw new Error("agent_engineering.result (AgentEngineeringResult) must be an object when supplied.");
    }
    if (!input.agent_engineering.approval || !APPROVAL_STATUSES.has(input.agent_engineering.approval.status)) {
      throw new Error("agent_engineering.approval.status must be APPROVED | PENDING | REJECTED.");
    }
  }

  if (!nonEmpty(input.quality_contract_ref)) {
    throw new Error("ImplementationPlanningInput.quality_contract_ref must be a non-empty string (spec section 2).");
  }

  return input;
}
