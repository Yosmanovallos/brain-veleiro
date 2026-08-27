import type {
  ImplementationPlanStatus,
  ImplementationPlanTask,
  ImplementationPlanningInput,
} from "./types.js";

/**
 * Brain — S13F shared input-derived helpers.
 *
 * Implements brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md
 * sections 3.2, 4.2, 4.8. These functions take ONLY the bounded input (and, for
 * blocked-set propagation, the task list's own `depends_on` graph) — never a
 * value the model/synthesizer claimed. They are shared verbatim between the
 * reference plan synthesizer and `validateImplementationPlan()` so the two
 * cannot drift (the S13D `hardDrivers` / S13E `computeDesignGaps` pattern).
 *
 * Two Part B determinizations, recorded in the S13F verification report:
 *  - "materially references a PENDING architecture decision" is read as
 *    `task.architecture_refs.length > 0` (spec section 4.8 leaves "materially"
 *    unspecified; any architecture_ref is the only input-derivable reading).
 *  - "materially references a PENDING agent-design decision" is read as
 *    `task.agent_decision_refs.length > 0`.
 */

// ---------------------------------------------------------------------------
// Material Spec-ref families (spec section 3.1 / 4.2)
// ---------------------------------------------------------------------------

/** Longest-prefix first so "NFR-1" is NFR and not R, "AC-1" is AC and not A. */
export type MaterialRefFamily = "NFR" | "AC" | "R" | "C" | "A";

const REF_FAMILY_PATTERNS: { family: MaterialRefFamily; pattern: RegExp }[] = [
  { family: "NFR", pattern: /^NFR-\d+$/ },
  { family: "AC", pattern: /^AC-\d+$/ },
  { family: "R", pattern: /^R-\d+$/ },
  { family: "C", pattern: /^C-\d+$/ },
  { family: "A", pattern: /^A-\d+$/ },
];

export function classifyMaterialRef(ref: string): MaterialRefFamily | null {
  for (const { family, pattern } of REF_FAMILY_PATTERNS) {
    if (pattern.test(ref)) return family;
  }
  return null;
}

/**
 * Every Spec-ref that legitimately exists in the bounded input, by exact id.
 * A task ref outside this set is an invented / unresolved material ref
 * (spec section 4.2 — "Incidental text mentions do not count").
 */
export function boundedSpecRefs(input: ImplementationPlanningInput): Set<string> {
  const s = new Set<string>();
  const spec = input.spec;
  for (const r of spec.requirements) {
    s.add(r.ref);
    for (const ac of r.acceptance_refs) s.add(ac);
  }
  for (const nfr of spec.non_functional_requirements) s.add(nfr.ref);
  for (const c of spec.constraints) s.add(c.ref);
  for (const a of spec.assumptions) s.add(a.ref);
  for (const ac of spec.acceptance_criteria) s.add(ac.ref);
  return s;
}

/**
 * Architecture identifiers a task may legitimately cite (spec section 4.2).
 * Bounded to the ADR id, its decision-driver ids, the recommended alternative
 * id, and each analysed alternative id.
 */
export function boundedArchitectureRefs(input: ImplementationPlanningInput): Set<string> {
  const s = new Set<string>();
  const a = input.architecture.result;
  s.add(a.adr.id);
  if (a.recommended_alternative_id) s.add(a.recommended_alternative_id);
  for (const alt of a.alternatives) s.add(alt.id);
  for (const d of a.decision_drivers) s.add(d.id);
  for (const d of a.adr.decision_drivers) s.add(d.id);
  return s;
}

/** Agent-decision identifiers a task may legitimately cite (spec section 4.2). */
export function boundedAgentDecisionRefs(input: ImplementationPlanningInput): Set<string> {
  const s = new Set<string>();
  const ae = input.agent_engineering?.result;
  if (!ae) return s;
  s.add(ae.work_unit_id);
  if (ae.reuse_agent_id) s.add(ae.reuse_agent_id);
  const candidateId = ae.design?.candidate_definition?.id;
  if (candidateId) s.add(candidateId);
  return s;
}

// ---------------------------------------------------------------------------
// Approval classification (spec section 3.2 — ORDERED predicates; row order
// matters because the matrix rows overlap)
// ---------------------------------------------------------------------------

export interface PlanStatusClassification {
  status: ImplementationPlanStatus;
  blockers: string[];
  arch_pending: boolean;
  agent_pending: boolean;
}

export function classifyPlanStatus(input: ImplementationPlanningInput): PlanStatusClassification {
  const specApproved = input.spec.approval.status === "APPROVED";
  const archStatus = input.architecture.approval.status;
  const applicable = input.agent_design_applicability === "APPLICABLE";
  const agentStatus = input.agent_engineering?.approval.status;

  // 1. Spec must be APPROVED for any executable/provisional plan.
  if (!specApproved) {
    return {
      status: "BLOCKED",
      blockers: [`Spec ${input.spec.spec_id} approval status is ${input.spec.approval.status}; Stage 10 requires an approved Spec.`],
      arch_pending: false,
      agent_pending: false,
    };
  }

  // 2. A REJECTED architecture decision blocks.
  if (archStatus === "REJECTED") {
    return {
      status: "BLOCKED",
      blockers: [`Architecture decision for "${input.architecture.result.architecture_question}" is REJECTED.`],
      arch_pending: false,
      agent_pending: false,
    };
  }

  // 3. Agent-design applicability must be satisfied.
  if (applicable && !input.agent_engineering) {
    return {
      status: "BLOCKED",
      blockers: ["agent_design_applicability is APPLICABLE but no AgentEngineeringResult + ApprovalSnapshot was supplied."],
      arch_pending: false,
      agent_pending: false,
    };
  }
  if (applicable && agentStatus === "REJECTED") {
    return {
      status: "BLOCKED",
      blockers: ["The applicable agent-design decision is REJECTED."],
      arch_pending: false,
      agent_pending: false,
    };
  }

  // 4. Any PENDING material decision => PROVISIONAL.
  const arch_pending = archStatus === "PENDING";
  const agent_pending = applicable && agentStatus === "PENDING";
  if (arch_pending || agent_pending) {
    return { status: "PROVISIONAL", blockers: [], arch_pending, agent_pending };
  }

  // 5. Spec APPROVED, architecture not rejected, agent-design satisfied.
  return { status: "READY", blockers: [], arch_pending: false, agent_pending: false };
}

// ---------------------------------------------------------------------------
// Pending-approval blocking propagation (spec section 4.8)
// ---------------------------------------------------------------------------

/**
 * The set of task ids that MUST be `BLOCKED_PENDING_APPROVAL`: any task that
 * materially references a PENDING architecture or agent-design decision, plus
 * every transitive dependent (a task whose `depends_on` chain reaches a
 * blocked task). Computed only from the input's approval snapshots and the
 * tasks' own `depends_on` edges.
 */
export function computePendingBlockedTaskIds(
  input: ImplementationPlanningInput,
  tasks: ImplementationPlanTask[],
): Set<string> {
  const { arch_pending, agent_pending } = classifyPlanStatus(input);
  const blocked = new Set<string>();
  if (!arch_pending && !agent_pending) return blocked;

  for (const t of tasks) {
    if (arch_pending && t.architecture_refs.length > 0) blocked.add(t.id);
    if (agent_pending && t.agent_decision_refs.length > 0) blocked.add(t.id);
  }

  // Transitive dependents: a task depending (directly or transitively) on a
  // blocked task is itself blocked. Iterate to a fixed point.
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (blocked.has(t.id)) continue;
      for (const dep of t.depends_on) {
        if (byId.has(dep) && blocked.has(dep)) {
          blocked.add(t.id);
          changed = true;
          break;
        }
      }
    }
  }
  return blocked;
}
