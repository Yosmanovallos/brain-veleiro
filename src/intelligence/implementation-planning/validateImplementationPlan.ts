import type { StructuredAgentOutput } from "../../core/agent/index.js";
import type {
  ImplementationPlanResult,
  ImplementationPlanTask,
  ImplementationPlanningInput,
} from "./types.js";
import { EVIDENCE_KINDS } from "./types.js";
import {
  boundedAgentDecisionRefs,
  boundedArchitectureRefs,
  boundedSpecRefs,
  classifyPlanStatus,
  computePendingBlockedTaskIds,
} from "./sharedDerivations.js";
import { analyzeDependencies } from "./analyzeDependencies.js";
import { computePlanCoverage } from "./computePlanCoverage.js";
import { renderImplementationPlanMarkdown } from "./renderImplementationPlanMarkdown.js";

/**
 * Brain — S13F deterministic plan validator.
 *
 * Implements every hard invariant HI-001..HI-018 of
 * brain-bootstrap/quality-contracts/S13F_IMPLEMENTATION_PLANNING_DEEP.yaml and
 * the failure conditions of
 * brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md.
 *
 * Anti-self-certification (the S13B/S13D/S13E review precedent): the model
 * supplies `status`, `coverage`, `compilation_readiness`, `topological_order`,
 * and `plan_markdown`; this validator RECOMPUTES each from the bounded input
 * (via the shared derivations in ./sharedDerivations, ./computePlanCoverage,
 * ./analyzeDependencies, ./renderImplementationPlanMarkdown) and REJECTS any
 * mismatch. A rosy hand-authored block cannot pass.
 */

const STAGE_11_FORBIDDEN_KEYS = new Set([
  "tools",
  "capabilities",
  "context_pack",
  "context_packet",
  "selected_skills",
  "selected_skill_ids",
  "tool_bindings",
  "capability_bindings",
  "execution_instructions",
  "execution_package",
  "executor_output_contract",
  "runtime_limits",
  "prompt",
]);

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Deep scan for any Stage-11 execution-package key (HI-015 / spec section 4). */
export function findStage11ForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...findStage11ForbiddenKeys(item, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (STAGE_11_FORBIDDEN_KEYS.has(key)) hits.push(`${path}.${key}`);
      hits.push(...findStage11ForbiddenKeys(child, `${path}.${key}`));
    }
  }
  return hits;
}

export function validateImplementationPlan(
  result: ImplementationPlanResult,
  input: ImplementationPlanningInput,
): PlanValidationResult {
  const errors: string[] = [];
  const push = (id: string, msg: string): void => {
    errors.push(`${id}: ${msg}`);
  };

  // ---- HI-015: no Stage-11 execution-package fields anywhere in the output.
  const forbidden = findStage11ForbiddenKeys(result);
  if (forbidden.length > 0) {
    push("HI-015", `output contains Stage-11 execution-package field(s): ${forbidden.join(", ")}`);
  }

  // ---- Status: recompute from input approval snapshots (HI-001/002/003).
  const classification = classifyPlanStatus(input);
  if (result.status !== classification.status) {
    push(
      "HI-001/002/003",
      `result.status is ${result.status} but the bounded approval snapshots require ${classification.status}` +
        (classification.blockers.length > 0 ? ` (${classification.blockers.join("; ")})` : ""),
    );
  }

  if (result.status === "BLOCKED") {
    if (result.tasks.length !== 0) push("HI-013", "a BLOCKED plan must carry zero tasks (Skill file: BLOCKED).");
    if (result.blockers.length === 0) push("HI-013", "a BLOCKED plan must explain its blockers.");
    if (result.milestones.length !== 0) push("HI-008", "a BLOCKED plan must carry zero milestones.");
  }

  // ---- HI-004/013: `blockers` is recomputed from the bounded input's approval
  // snapshots, never trusted from the model. Requiring exact equality closes
  // two holes: (a) a READY/PROVISIONAL plan cannot excuse a dropped REQUIRED
  // P0 task by inventing a blocker string that mentions its ref (which would
  // otherwise be credited by computePlanCoverage's `required_blocked`), and
  // (b) a BLOCKED plan cannot carry arbitrary blocker prose.
  if (JSON.stringify(result.blockers) !== JSON.stringify(classification.blockers)) {
    push(
      "HI-004/013",
      `result.blockers must equal the input-derived blockers. expected ${JSON.stringify(classification.blockers)}, got ${JSON.stringify(result.blockers)}`,
    );
  }

  // ---- Per-task structural checks.
  const taskIds = new Set<string>();
  const boundedSpec = boundedSpecRefs(input);
  const boundedArch = boundedArchitectureRefs(input);
  const boundedAgent = boundedAgentDecisionRefs(input);

  for (const t of result.tasks) {
    if (!nonEmpty(t.id)) push("HI-011", "a task has an empty id.");
    if (taskIds.has(t.id)) push("HI-011", `duplicate task id ${t.id}.`);
    taskIds.add(t.id);
    if (!nonEmpty(t.title)) push("SD-002", `task ${t.id} has an empty title.`);
    if (!nonEmpty(t.outcome)) push("SD-002", `task ${t.id} has an empty outcome.`);
    if (t.priority !== "P0" && t.priority !== "P1" && t.priority !== "P2") {
      push("SD-001", `task ${t.id} has an invalid priority ${t.priority}.`);
    }
    if (!nonEmpty(t.priority_rationale)) push("SD-001", `task ${t.id} has an empty priority_rationale.`);

    // HI-011 traceability: >= 1 material source ref, and every ref resolves.
    const specRefs = t.spec_refs ?? [];
    const constraintRefs = t.constraint_refs ?? [];
    const assumptionRefs = t.assumption_refs ?? [];
    const archRefs = t.architecture_refs ?? [];
    const agentRefs = t.agent_decision_refs ?? [];
    const materialCount =
      specRefs.length + constraintRefs.length + assumptionRefs.length + archRefs.length + agentRefs.length;
    if (materialCount === 0) push("HI-011", `task ${t.id} cites no material source ref.`);

    for (const ref of [...specRefs, ...constraintRefs, ...assumptionRefs]) {
      if (!boundedSpec.has(ref)) push("HI-011", `task ${t.id} cites Spec ref ${ref}, which is not in the bounded input.`);
    }
    for (const ref of archRefs) {
      if (!boundedArch.has(ref)) push("HI-011", `task ${t.id} cites architecture ref ${ref}, which is not in the bounded input.`);
    }
    for (const ref of agentRefs) {
      if (!boundedAgent.has(ref)) push("HI-011", `task ${t.id} cites agent-decision ref ${ref}, which is not in the bounded input.`);
    }
    if (nonEmpty(t.agent_definition_ref) && !boundedAgent.has(t.agent_definition_ref!)) {
      push("HI-011", `task ${t.id} cites agent_definition_ref ${t.agent_definition_ref}, which is not in the bounded input.`);
    }

    // HI-009 / HI-010: acceptance + evidence present and well-formed on every
    // non-blocker task.
    if (t.acceptance.length === 0) push("HI-009", `task ${t.id} has no acceptance criterion.`);
    for (const a of t.acceptance) {
      if (!nonEmpty(a.id) || !nonEmpty(a.condition) || !nonEmpty(a.verification_method) || !nonEmpty(a.evidence_expected)) {
        push("SD-003", `task ${t.id} acceptance criterion ${a.id || "<no id>"} is missing a required field.`);
      }
    }
    if (t.evidence_required.length === 0) push("HI-010", `task ${t.id} has no evidence requirement.`);
    for (const e of t.evidence_required) {
      if (!EVIDENCE_KINDS.includes(e.kind)) push("SD-003", `task ${t.id} evidence kind ${e.kind} is not allowed.`);
      if (!nonEmpty(e.description)) push("SD-003", `task ${t.id} has an evidence requirement with no description.`);
      if (e.kind === "MANUAL_REVIEW" && !nonEmpty(e.manual_review_reason)) {
        push("SD-003", `task ${t.id} uses MANUAL_REVIEW evidence without a manual_review_reason.`);
      }
    }
  }

  // ---- HI-007 dependency DAG + HI-005/006 priority direction + HI-008
  // milestone ordering.
  const depAnalysis = analyzeDependencies(result.tasks, result.milestones);
  for (const issue of depAnalysis.issues) {
    const id =
      issue.code === "PRIORITY_DIRECTION"
        ? "HI-005/006"
        : issue.code === "MILESTONE_ORDER"
          ? "HI-008"
          : "HI-007";
    push(id, issue.message);
  }

  // ---- HI-008: every task in exactly one milestone (for non-BLOCKED plans).
  if (result.status !== "BLOCKED") {
    const milestoneMembership = new Map<string, number>();
    for (const m of result.milestones) {
      for (const tid of m.task_ids) {
        milestoneMembership.set(tid, (milestoneMembership.get(tid) ?? 0) + 1);
      }
    }
    for (const t of result.tasks) {
      const count = milestoneMembership.get(t.id) ?? 0;
      if (count === 0) push("HI-008", `task ${t.id} is not in any milestone.`);
      if (count > 1) push("HI-008", `task ${t.id} appears in ${count} milestones.`);
    }
    for (const [tid] of milestoneMembership) {
      if (!taskIds.has(tid)) push("HI-008", `milestone references unknown task ${tid}.`);
    }
  }

  // ---- HI-012 / HI-013: pending-approval blocking recomputed from input.
  const expectedBlocked = computePendingBlockedTaskIds(input, result.tasks);
  for (const t of result.tasks) {
    const shouldBlock = expectedBlocked.has(t.id);
    if (shouldBlock && t.compilation_readiness !== "BLOCKED_PENDING_APPROVAL") {
      push("HI-012", `task ${t.id} materially depends on a PENDING decision but is marked ${t.compilation_readiness}.`);
    }
    if (!shouldBlock && t.compilation_readiness !== "READY_FOR_S13G") {
      push("HI-012", `task ${t.id} has no PENDING dependency but is marked ${t.compilation_readiness}.`);
    }
    if (t.compilation_readiness !== "READY_FOR_S13G" && t.compilation_readiness !== "BLOCKED_PENDING_APPROVAL") {
      push("HI-012", `task ${t.id} has an invalid compilation_readiness ${t.compilation_readiness}.`);
    }
    if (shouldBlock && t.blocked_by.length === 0) {
      push("HI-012", `task ${t.id} is BLOCKED_PENDING_APPROVAL but blocked_by is empty.`);
    }
  }

  // ---- HI-004: every REQUIRED requirement mapped to P0 or an explicit blocker.
  // Coverage is recomputed with the INPUT-DERIVED blockers, not the claimed
  // ones, so `required_blocked` cannot be inflated by model-supplied blocker
  // prose (see the HI-004/013 blocker-equality check above).
  const recomputedCoverage = computePlanCoverage(input, result.tasks, classification.blockers);
  if (
    recomputedCoverage.required_mapped_to_p0 + recomputedCoverage.required_blocked <
    recomputedCoverage.required_total
  ) {
    push(
      "HI-004",
      `${recomputedCoverage.required_total - recomputedCoverage.required_mapped_to_p0 - recomputedCoverage.required_blocked} REQUIRED requirement(s) are neither mapped to a P0 task nor covered by an explicit blocker.`,
    );
  }

  // ---- HI-018: reported coverage must equal the input-derived recompute.
  if (JSON.stringify(result.coverage) !== JSON.stringify(recomputedCoverage)) {
    push(
      "HI-018",
      `result.coverage does not match the input-derived recompute. expected ${JSON.stringify(recomputedCoverage)}, got ${JSON.stringify(result.coverage)}`,
    );
  }

  // ---- topological_order must equal the derived Kahn order (HI-007 corollary /
  // spec section 4.4 — "derived only after validation ... MUST NOT become a
  // second source of truth").
  if (JSON.stringify(result.topological_order) !== JSON.stringify(depAnalysis.topological_order)) {
    push(
      "HI-007",
      `result.topological_order does not match the derived order. expected ${JSON.stringify(depAnalysis.topological_order)}, got ${JSON.stringify(result.topological_order)}`,
    );
  }

  // ---- HI-014: stop/de-scope rules protect P0 or explicitly stop/escalate.
  // Word-boundary cue match (a substring "stopgap" must not satisfy it).
  const STOP_ESCALATE = /\b(STOP|ESCALATE)\b/i;
  const DESCOPE = /\bde-?scope\b/i;
  if (result.status !== "BLOCKED") {
    const protectsP0 = result.stop_or_de_scope_rules.some((r) => r.protected_scope.includes("P0"));
    const hasStopEscalate = result.stop_or_de_scope_rules.some((r) => STOP_ESCALATE.test(r.action));
    if (!protectsP0 && !hasStopEscalate) {
      push("HI-014", "no stop/de-scope rule protects P0 or defines an explicit STOP/ESCALATE path.");
    }
    for (const r of result.stop_or_de_scope_rules) {
      // A rule that de-scopes P0 without an explicit STOP/ESCALATE path is a
      // silent P0 drop.
      if (r.affected_priorities.includes("P0") && DESCOPE.test(r.action) && !STOP_ESCALATE.test(r.action)) {
        push("HI-014", `a stop/de-scope rule de-scopes P0 ("${r.action}") without a STOP/ESCALATE path.`);
      }
    }
  }

  // ---- HI-017: plan_markdown must be the deterministic rendering of the
  // structured result.
  const rendered = renderImplementationPlanMarkdown(result);
  if (rendered !== result.plan_markdown) {
    push("HI-017", "plan_markdown is not the deterministic rendering of the structured result.");
  }

  // ---- HI-016: no candidate AgentDefinition object is embedded (only a string
  // ref is permitted).
  for (const t of result.tasks) {
    if (t.agent_definition_ref !== undefined && typeof t.agent_definition_ref !== "string") {
      push("HI-016", `task ${t.id}.agent_definition_ref must be a string reference, not an embedded object.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Map an ImplementationPlanResult to the generic StructuredAgentOutput the S09
 * runtime carries. `data` is the full structured plan; `evidence_refs` are the
 * Spec + architecture decision refs the plan traces back to.
 */
export function mapImplementationPlanResultToStructuredOutput(
  result: ImplementationPlanResult,
): StructuredAgentOutput {
  return {
    summary: `Implementation plan for ${result.spec_ref}: status ${result.status}, ${result.tasks.length} task(s) across ${result.milestones.length} milestone(s).`,
    data: result as unknown as Record<string, unknown>,
    evidence_refs: [result.spec_ref, ...result.architecture_decision_refs],
  };
}
