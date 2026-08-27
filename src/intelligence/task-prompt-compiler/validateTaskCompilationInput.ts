import { validateAgentDefinition } from "../../core/agent/index.js";
import { validateSkillDefinition } from "../../core/skill/index.js";
import { EVIDENCE_KINDS } from "../implementation-planning/types.js";
import type { TaskCompilationInput } from "./types.js";

/**
 * Brain — S13G bounded input-contract validation.
 *
 * Implements brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md section 3.
 * This throws only for STRUCTURAL defects (missing required input object, wrong
 * shape, malformed AgentDefinition/SkillDefinition). SEMANTIC outcomes — a
 * non-ready task, an acceptance/evidence mismatch, an unknown ref, an
 * incompatible AgentDefinition, an invalid Context Pack — are NOT throws: spec
 * sections 5 / "Compilation status" make those a `BLOCKED` RESULT produced by
 * `compileTaskExecutionPackage()`.
 *
 * Exported so tests can exercise it directly, mirroring S13F's
 * `validatePlanningInput()`.
 */

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function validateTaskCompilationInput(input: TaskCompilationInput | undefined): TaskCompilationInput {
  if (!input || typeof input !== "object") {
    throw new Error("TaskCompilationInput is required (spec section 3).");
  }

  // ---- task
  const task = input.task;
  if (!task || typeof task !== "object") throw new Error("TaskCompilationInput.task (ImplementationPlanTask) is required.");
  if (!nonEmpty(task.id)) throw new Error("task.id must be a non-empty string.");
  if (!nonEmpty(task.outcome)) throw new Error("task.outcome must be a non-empty string.");
  if (task.compilation_readiness !== "READY_FOR_S13G" && task.compilation_readiness !== "BLOCKED_PENDING_APPROVAL") {
    throw new Error("task.compilation_readiness must be READY_FOR_S13G | BLOCKED_PENDING_APPROVAL.");
  }
  for (const arr of ["spec_refs", "constraint_refs", "assumption_refs", "acceptance", "evidence_required"] as const) {
    if (!Array.isArray((task as unknown as Record<string, unknown>)[arr])) {
      throw new Error(`task.${arr} must be an array.`);
    }
  }

  // ---- spec (bounded snapshot shape)
  const spec = input.spec;
  if (!spec || typeof spec !== "object") throw new Error("TaskCompilationInput.spec (TaskCompilationSpecSnapshot) is required.");
  if (!nonEmpty(spec.spec_id)) throw new Error("spec.spec_id must be a non-empty string.");
  if (!nonEmpty(spec.version)) throw new Error("spec.version must be a non-empty string.");
  if (!spec.approval || !["APPROVED", "PENDING", "REJECTED"].includes(spec.approval.status)) {
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

  // ---- agent_definition (must be a structurally valid S10 AgentDefinition)
  if (!input.agent_definition || typeof input.agent_definition !== "object") {
    throw new Error("TaskCompilationInput.agent_definition (AgentDefinition) is required (spec decision G).");
  }
  const agentValidation = validateAgentDefinition(input.agent_definition);
  if (!agentValidation.valid) {
    throw new Error(`TaskCompilationInput.agent_definition is not a valid S10 AgentDefinition: ${agentValidation.errors.join("; ")}`);
  }
  if (!Array.isArray(input.agent_definition.skills)) throw new Error("agent_definition.skills must be an array.");

  // ---- context_pack (projection shape; deep S05 validation is a BLOCKED path)
  const pack = input.context_pack;
  if (!pack || typeof pack !== "object") {
    throw new Error("TaskCompilationInput.context_pack (TaskCompilationContextPackSnapshot) is required (spec decision D).");
  }
  if (!nonEmpty(pack.id)) throw new Error("context_pack.id must be a non-empty string.");
  if (!pack.objective || !nonEmpty(pack.objective.statement)) {
    throw new Error("context_pack.objective.statement must be a non-empty string.");
  }
  if (!pack.authority_policy || !Array.isArray(pack.authority_policy.ordering)) {
    throw new Error("context_pack.authority_policy.ordering must be an array.");
  }
  if (!pack.budget || typeof pack.budget !== "object") throw new Error("context_pack.budget must be an object.");
  if (!Array.isArray(pack.items)) throw new Error("context_pack.items must be an array.");

  // ---- selected_skills (already-loaded S12 SkillDefinition[])
  if (!Array.isArray(input.selected_skills)) throw new Error("TaskCompilationInput.selected_skills must be an array.");
  for (const [i, skill] of input.selected_skills.entries()) {
    const sv = validateSkillDefinition(skill);
    if (!sv.valid) {
      throw new Error(`selected_skills[${i}] is not a valid S12 SkillDefinition: ${sv.errors.join("; ")}`);
    }
  }

  // ---- capabilities
  if (!Array.isArray(input.capabilities)) throw new Error("TaskCompilationInput.capabilities must be an array.");
  for (const [i, c] of input.capabilities.entries()) {
    if (!nonEmpty(c.id)) throw new Error(`capabilities[${i}].id must be a non-empty string.`);
    if (!Array.isArray(c.source_refs)) throw new Error(`capabilities[${i}].source_refs must be an array.`);
  }

  // ---- constraints
  if (!Array.isArray(input.constraints)) throw new Error("TaskCompilationInput.constraints must be an array.");
  for (const [i, c] of input.constraints.entries()) {
    if (!nonEmpty(c.ref)) throw new Error(`constraints[${i}].ref must be a non-empty string.`);
    if (!nonEmpty(c.statement)) throw new Error(`constraints[${i}].statement must be a non-empty string.`);
    if (!Array.isArray(c.source_refs)) throw new Error(`constraints[${i}].source_refs must be an array.`);
  }

  // ---- acceptance / evidence_required
  if (!Array.isArray(input.acceptance)) throw new Error("TaskCompilationInput.acceptance must be an array.");
  for (const [i, a] of input.acceptance.entries()) {
    if (!nonEmpty(a.id) || !nonEmpty(a.condition) || !nonEmpty(a.verification_method) || !nonEmpty(a.evidence_expected)) {
      throw new Error(`acceptance[${i}] is missing a required field.`);
    }
  }
  if (!Array.isArray(input.evidence_required)) throw new Error("TaskCompilationInput.evidence_required must be an array.");
  for (const [i, e] of input.evidence_required.entries()) {
    if (!EVIDENCE_KINDS.includes(e.kind)) throw new Error(`evidence_required[${i}].kind '${e.kind}' is not an allowed EvidenceKind.`);
    if (!nonEmpty(e.description)) throw new Error(`evidence_required[${i}].description must be a non-empty string.`);
  }

  return input;
}
