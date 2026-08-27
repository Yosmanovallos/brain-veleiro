import {
  acceptanceEqual,
  boundedSpecSnapshotRefs,
  containsKnownSecretValue,
  evidenceEqual,
  isMaterialRef,
  taskMaterialSpecRefs,
} from "./sharedNormalization.js";
import type { TaskCompilationInput } from "./types.js";

/**
 * Brain — S13G target-execution compatibility validation (a BLOCKED path).
 *
 * Implements brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md sections
 * 5.1-5.10, 11, 14 and the Skill file "Skill compilation rules". Every check
 * derives from the already-supplied bounded input; a failure yields a blocker
 * string, and `compileTaskExecutionPackage()` returns a BLOCKED result with
 * `package = null`.
 */
export function validateTargetExecutionCompatibility(input: TaskCompilationInput): string[] {
  const blockers: string[] = [];
  const push = (msg: string): void => {
    blockers.push(msg);
  };

  const { task, spec, agent_definition: agent } = input;

  // ---- 5.1 task readiness.
  if (task.compilation_readiness !== "READY_FOR_S13G") {
    push(
      `Task ${task.id} compilation_readiness is ${task.compilation_readiness}; only READY_FOR_S13G may compile (spec 5.1).`,
    );
  }

  // ---- 5.3 Spec approval preserved (never upgraded).
  if (spec.approval.status !== "APPROVED") {
    push(`Bounded Spec ${spec.spec_id} approval status is ${spec.approval.status}; Stage 11 requires an approved Spec (spec 5.3).`);
  }

  // ---- 5.2 bounded Spec projection: every task material ref resolves, and the
  //         snapshot carries no unrelated material refs.
  const material = taskMaterialSpecRefs(input);
  const bounded = boundedSpecSnapshotRefs(input);
  for (const ref of material) {
    if (!bounded.has(ref)) push(`Task ${task.id} cites Spec ref ${ref}, which is not present in the bounded Spec snapshot (spec 5.2).`);
  }
  // Requirement / NFR / constraint / assumption refs in the snapshot that the
  // task does not cite widen scope. Acceptance criteria pulled in transitively
  // by a cited requirement are allowed.
  const acFromCitedRequirements = new Set<string>();
  for (const r of spec.requirements) if (material.has(r.ref)) for (const ac of r.acceptance_refs) acFromCitedRequirements.add(ac);
  const snapshotOwnRefs = [
    ...spec.requirements.map((r) => r.ref),
    ...spec.non_functional_requirements.map((n) => n.ref),
    ...spec.constraints.map((c) => c.ref),
    ...spec.assumptions.map((a) => a.ref),
  ];
  for (const ref of snapshotOwnRefs) {
    if (!material.has(ref)) push(`Bounded Spec snapshot contains ${ref}, which the task does not materially cite (spec 5.2 — no scope widening).`);
  }
  for (const ac of spec.acceptance_criteria) {
    if (!material.has(ac.ref) && !acFromCitedRequirements.has(ac.ref)) {
      push(`Bounded Spec snapshot contains acceptance criterion ${ac.ref}, which is not task-material (spec 5.2).`);
    }
  }

  // ---- 5.4 / 5.5 acceptance & evidence equality with the task.
  if (!acceptanceEqual(input.acceptance, task.acceptance)) {
    push(`Supplied acceptance does not normalize equal to task.acceptance (spec 5.4) — BLOCKED.`);
  }
  if (!evidenceEqual(input.evidence_required, task.evidence_required)) {
    push(`Supplied evidence_required does not normalize equal to task.evidence_required (spec 5.5) — BLOCKED.`);
  }

  // ---- 5.6 constraint resolution.
  const suppliedConstraintRefs = new Set(input.constraints.map((c) => c.ref));
  if (input.constraints.length !== suppliedConstraintRefs.size) push(`Supplied constraints contain a duplicate ref (spec 5.6).`);
  for (const ref of task.constraint_refs) {
    if (isMaterialRef(ref) && !bounded.has(ref)) {
      push(`Task constraint ref ${ref} does not resolve to bounded Spec material (spec 5.6).`);
    }
    if (!suppliedConstraintRefs.has(ref)) {
      push(`Task constraint ref ${ref} is not present in the supplied constraints (spec 5.6).`);
    }
  }

  // ---- 5.7 Agent identity.
  if (task.agent_definition_ref !== undefined && task.agent_definition_ref !== agent.id) {
    push(
      `task.agent_definition_ref '${task.agent_definition_ref}' does not equal the supplied AgentDefinition id '${agent.id}' (spec 5.7).`,
    );
  }

  // ---- 5.8 selected Skills: valid, unique by id@version, allowlisted.
  const allowedSkillIds = new Set(agent.skills);
  const seenSkillKeys = new Set<string>();
  for (const skill of input.selected_skills) {
    const key = `${skill.id}@${skill.version}`;
    if (seenSkillKeys.has(key)) push(`Selected Skill ${key} is duplicated (spec 5.8).`);
    seenSkillKeys.add(key);
    if (!allowedSkillIds.has(skill.id)) {
      push(`Selected Skill ${skill.id} is not in AgentDefinition.skills allowlist (spec 5.8).`);
    }
  }

  // ---- 5.9 capability compatibility.
  const suppliedCapabilityIds = new Set(input.capabilities.map((c) => c.id));
  if (input.capabilities.length !== suppliedCapabilityIds.size) push(`Supplied capabilities contain a duplicate id (spec 5.9).`);
  const agentCapabilities = new Set(agent.capabilities);
  const agentTools = new Set(agent.tools);
  for (const cap of suppliedCapabilityIds) {
    if (!agentCapabilities.has(cap)) push(`Target capability '${cap}' is not in AgentDefinition.capabilities (spec 5.9).`);
    if (!agentTools.has(cap)) push(`Target capability '${cap}' is not in AgentDefinition.tools (spec 5.9).`);
  }
  for (const skill of input.selected_skills) {
    for (const requiredCap of skill.requires.capabilities) {
      if (!suppliedCapabilityIds.has(requiredCap)) {
        push(`Selected Skill ${skill.id} requires capability '${requiredCap}', absent from the bounded capability input (spec 5.9 / 5.10).`);
      }
    }
  }

  // ---- 5.10 permission compatibility: a selected Skill's permission policy
  //         must not forbid a capability the compilation input requires for it.
  for (const skill of input.selected_skills) {
    const allowed = new Set(skill.permissions.allowed_capabilities);
    for (const requiredCap of skill.requires.capabilities) {
      if (!allowed.has(requiredCap)) {
        push(`Selected Skill ${skill.id} requires capability '${requiredCap}' that its own permissions.allowed_capabilities forbids (spec 5.10).`);
      }
    }
  }

  // ---- 14 / 17 bounded secret scan on the material that would be copied.
  const secretScanTargets: unknown[] = [
    task.outcome,
    task.title,
    input.acceptance,
    input.evidence_required,
    input.constraints,
    spec,
    input.context_pack.items.map((it) => it.content),
  ];
  if (secretScanTargets.some(containsKnownSecretValue)) {
    push(`A known/explicit secret value appears in material that would enter the Execution Package (spec 14) — BLOCKED.`);
  }

  return blockers;
}
