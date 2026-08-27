import type {
  AgentDefinition,
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
} from "../../src/core/agent/index.js";
import type { AgentEngineeringResult } from "../../src/intelligence/agent-engineering/types.js";
import type { SoftwareArchitectureDecisionResult } from "../../src/intelligence/software-architecture/types.js";
import {
  IMPLEMENTATION_PLANNING_INPUT_MARKER,
  IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
  IMPLEMENTATION_PLANNING_SKILL_ID,
  IMPLEMENTATION_PLANNING_SKILL_MATERIALIZATION_MARKER,
} from "../../src/intelligence/implementation-planning/constants.js";
import {
  analyzeDependencies,
  classifyPlanStatus,
  computePendingBlockedTaskIds,
  computePlanCoverage,
  mapImplementationPlanResultToStructuredOutput,
  renderImplementationPlanMarkdown,
} from "../../src/intelligence/implementation-planning/index.js";
import type {
  ImplementationMilestone,
  ImplementationPlanResult,
  ImplementationPlanTask,
  ImplementationPlanningInput,
  StructuredPlan,
} from "../../src/intelligence/implementation-planning/types.js";

/**
 * Canonical S13F fixtures.
 *
 * Implements brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md and
 * brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md sections
 * 11-12. The `SKILL` synthesizer (`synthesizeSkillPlan`) is a genuine
 * input-derived function driving the real production helpers
 * (classifyPlanStatus, computePendingBlockedTaskIds, computePlanCoverage,
 * analyzeDependencies, renderImplementationPlanMarkdown) from the actual
 * bounded input — mutating a requirement's priority or an approval snapshot
 * measurably changes its output. The `BASELINE` synthesizer
 * (`synthesizeBaselinePlan`) reproduces the canonical Part A mistakes: one
 * giant task, everything P0, no acceptance/evidence, unmapped constraints,
 * self-reported rosy coverage, hand-written Markdown, and approval blindness.
 *
 * This file MUST NOT import tests/implementation-planning/fixtureTruth.ts — the
 * runtime path never sees a ground-truth value. The test suite asserts this
 * mechanically (T31).
 */

// ---------------------------------------------------------------------------
// Minimal valid upstream artifacts (read-only inputs)
// ---------------------------------------------------------------------------

export function minimalArchitectureResult(): SoftwareArchitectureDecisionResult {
  return {
    architecture_question: "How should the audited request pipeline be structured?",
    decision_status: "READY_FOR_HUMAN_APPROVAL",
    decision_drivers: [
      { id: "DRV-1", statement: "Server-side auth is mandatory.", kind: "HARD_CONSTRAINT", hard: true, source_refs: ["R-001"], rationale: "Security requirement." },
    ],
    alternatives: [
      {
        id: "ALT-1",
        name: "Middleware-enforced auth + append-only audit log",
        description: "Authenticate in shared middleware; write security events to an append-only store.",
        origin: "GENERATED",
        driver_evaluations: [],
        benefits: [],
        disadvantages: [],
        failure_modes: [],
        cost: { implementation_cost: "LOW", ongoing_operational_cost: "LOW", migration_or_exit_cost: "LOW", cost_drivers: [], limitations: [] },
        operations: { deployment_complexity: "LOW", operator_burden: "LOW", observability_notes: [], backup_recovery_notes: [], failure_handling_notes: [], limitations: [] },
        security: { trust_boundaries: [], sensitive_data_exposure: [], credential_or_secret_implications: [], attack_surface_notes: [], security_tradeoffs: [], unresolved_security_questions: [], evidence_refs: [] },
        reversibility: { reversibility: "HIGH", migration_path: "n/a", lock_in_factors: [], irreversible_or_costly_choices: [], limitations: [] },
        evidence_refs: [],
        assumptions: [],
      },
    ],
    recommended_alternative_id: "ALT-1",
    recommendation_summary: "Enforce authentication in shared middleware and record security events append-only.",
    rejected_alternative_reasons: [],
    unresolved_decision_gaps: [],
    adr: {
      id: "ADR-S13F-PIPELINE-001",
      title: "Audited request pipeline structure",
      status: "PROPOSED",
      decision_question: "How should the audited request pipeline be structured?",
      context: "An approved Spec requires server-side auth and auditable security events.",
      decision_drivers: [
        { id: "DRV-1", statement: "Server-side auth is mandatory.", kind: "HARD_CONSTRAINT", hard: true, source_refs: ["R-001"], rationale: "Security requirement." },
      ],
      alternatives_considered: ["ALT-1"],
      decision: "Adopt middleware-enforced auth with an append-only audit log.",
      selected_alternative_id: "ALT-1",
      rationale: "Lowest cost and operational burden while satisfying the hard constraint.",
      positive_consequences: [],
      negative_consequences: [],
      failure_modes: [],
      cost_considerations: [],
      operational_considerations: [],
      security_considerations: [],
      evidence_refs: [],
      assumptions: [],
      unresolved_questions: [],
      approval_required: true,
      approval_note: "PROPOSED — requires human approval before it is treated as accepted architecture.",
    },
    adr_markdown: "# ADR-S13F-PIPELINE-001\n\nPROPOSED.",
  };
}

export function minimalAgentEngineeringResult(): AgentEngineeringResult {
  return {
    work_unit_id: "WU-AUDIT-VIEW",
    proposal_status: "PROPOSED",
    approval_required: true,
    need_decision: {
      status: "READY",
      agent_requirement: "AGENT_REQUIRED",
      non_agent_strategy: null,
      agent_action: "REUSE_EXISTING",
      reuse_agent_id: "researcher-v1",
      rationale: "The operator audit view benefits from an adaptive research loop already covered by researcher-v1.",
      evidence_refs: ["R-003"],
      blocking_reasons: [],
    },
    design: null,
    reuse_agent_id: "researcher-v1",
    non_agent_recommendation: null,
    warnings: [],
    approval_note: "PROPOSED — reuse recommendation requires human approval before activation.",
  };
}

// ---------------------------------------------------------------------------
// Harness base AgentDefinition (spec section 7 — "a harness injected by the
// caller"). NOT a registered planning agent: it lives only in tests/, carries
// a generic role, and exists solely to run the S13F Skill through the
// unchanged generic S12 -> S10 -> S09 runtime.
// ---------------------------------------------------------------------------

export const skillExecutionHostDefinition: AgentDefinition = {
  id: "s13f-skill-execution-host",
  role: "skill-execution-host",
  objective:
    "Execute a single selected Intelligence Skill through the generic Agent Runtime and return its structured output. " +
    "This host adds no role-specific behaviour and is not an implementation-planning agent.",
  model_policy: { routing_class: "QUALITY", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 12000,
    max_items: 40,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    require_source_refs: true,
  },
  state_schema: { type: "object", additionalProperties: false, properties: { selected_skill_id: { type: "string" } } },
  tools: [],
  skills: [IMPLEMENTATION_PLANNING_SKILL_ID],
  capabilities: [],
  memory_policy: {
    retrieve: false,
    remember_candidate: false,
    commit_verified_memory: false,
    search_history: false,
    promotion_policy: "DISABLED",
  },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 6, timeout_ms: 15000 },
  termination: { require_terminal_outcome: true, require_explanation: true, note: "Generic S09 terminal semantics." },
  output_schema: {
    type: "object",
    required: ["summary"],
    properties: { summary: { type: "string" }, data: {}, evidence_refs: { type: "array" } },
    additionalProperties: false,
  },
  rubric: { quality_contract_ref: IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF },
  evals: ["evals/s13f/host-run"],
};

// ---------------------------------------------------------------------------
// Canonical fixture inputs
// ---------------------------------------------------------------------------

const QC = IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF;

/** FX-POS-001 / F1 — approved Spec + approved architecture + NOT_APPLICABLE agent design => READY. */
export const FX_POS_001_INPUT: ImplementationPlanningInput = {
  spec: {
    spec_id: "SPEC-AUDIT-PIPELINE",
    version: "1.0.0",
    approval: { status: "APPROVED", evidence_ref: "approval/audit-pipeline-v1" },
    requirements: [
      { ref: "R-001", priority: "REQUIRED", statement: "Validate authenticated requests server-side.", acceptance_refs: ["AC-001"] },
      { ref: "R-002", priority: "REQUIRED", statement: "Record auditable security-relevant events.", acceptance_refs: ["AC-002"] },
      { ref: "R-003", priority: "SHOULD", statement: "Provide an operator-facing audit view.", acceptance_refs: [] },
      { ref: "R-004", priority: "OPTIONAL", statement: "Export audit events for offline analysis.", acceptance_refs: [] },
    ],
    non_functional_requirements: [{ ref: "NFR-001", statement: "Secrets must not appear in logs." }],
    constraints: [{ ref: "C-001", statement: "Preserve the existing public API contract." }],
    assumptions: [{ ref: "A-001", statement: "Request identity can be resolved before protected handlers." }],
    acceptance_criteria: [
      { ref: "AC-001", success_condition: "Unauthenticated protected requests are rejected." },
      { ref: "AC-002", success_condition: "Security events are recorded without secret values." },
    ],
  },
  architecture: { result: minimalArchitectureResult(), approval: { status: "APPROVED", evidence_ref: "approval/adr-pipeline-001" } },
  agent_design_applicability: "NOT_APPLICABLE",
  quality_contract_ref: QC,
};

/** FX-POS-002 / F2 — approved Spec + PENDING architecture => PROVISIONAL. */
export const FX_POS_002_INPUT: ImplementationPlanningInput = {
  spec: {
    spec_id: "SPEC-AUDIT-PIPELINE",
    version: "1.1.0",
    approval: { status: "APPROVED", evidence_ref: "approval/audit-pipeline-v1_1" },
    requirements: [
      { ref: "R-001", priority: "REQUIRED", statement: "Validate authenticated requests server-side.", acceptance_refs: ["AC-001"] },
      { ref: "R-002", priority: "REQUIRED", statement: "Record auditable security-relevant events.", acceptance_refs: ["AC-002"] },
      { ref: "R-003", priority: "SHOULD", statement: "Provide an operator-facing audit view.", acceptance_refs: [] },
    ],
    non_functional_requirements: [{ ref: "NFR-001", statement: "Secrets must not appear in logs." }],
    constraints: [{ ref: "C-001", statement: "Preserve the existing public API contract." }],
    assumptions: [{ ref: "A-001", statement: "Request identity can be resolved before protected handlers." }],
    acceptance_criteria: [
      { ref: "AC-001", success_condition: "Unauthenticated protected requests are rejected." },
      { ref: "AC-002", success_condition: "Security events are recorded without secret values." },
    ],
  },
  architecture: { result: minimalArchitectureResult(), approval: { status: "PENDING" } },
  agent_design_applicability: "NOT_APPLICABLE",
  quality_contract_ref: QC,
};

/** FX-POS-003 / F3 — approved Spec + approved architecture + APPLICABLE + APPROVED agent decision. */
export const FX_POS_003_INPUT: ImplementationPlanningInput = {
  spec: {
    spec_id: "SPEC-AUDIT-VIEW",
    version: "1.0.0",
    approval: { status: "APPROVED", evidence_ref: "approval/audit-view-v1" },
    requirements: [
      { ref: "R-001", priority: "REQUIRED", statement: "Serve the operator audit view behind authentication.", acceptance_refs: ["AC-001"] },
      { ref: "R-002", priority: "SHOULD", statement: "Support filtering the audit view by actor.", acceptance_refs: [] },
    ],
    non_functional_requirements: [],
    constraints: [],
    assumptions: [{ ref: "A-001", statement: "The audit store schema is already stable." }],
    acceptance_criteria: [{ ref: "AC-001", success_condition: "The audit view requires authentication and paginates." }],
  },
  architecture: { result: minimalArchitectureResult(), approval: { status: "APPROVED", evidence_ref: "approval/adr-pipeline-001" } },
  agent_design_applicability: "APPLICABLE",
  agent_engineering: { result: minimalAgentEngineeringResult(), approval: { status: "APPROVED", evidence_ref: "approval/ae-audit-view" } },
  quality_contract_ref: QC,
};

/** FX-NEG-001 / N1 — Spec not approved => BLOCKED. */
export const SPEC_NOT_APPROVED_INPUT: ImplementationPlanningInput = {
  ...structuredClone(FX_POS_001_INPUT),
  spec: { ...structuredClone(FX_POS_001_INPUT.spec), approval: { status: "PENDING" } },
};

/** FX-NEG-005 / N5 — agent-design APPLICABLE but no AgentEngineeringResult => BLOCKED. */
export const AGENT_APPLICABLE_MISSING_INPUT: ImplementationPlanningInput = {
  ...structuredClone(FX_POS_001_INPUT),
  agent_design_applicability: "APPLICABLE",
};

/** FX-NEG-003 (architecture) / N — REJECTED architecture => BLOCKED. */
export const ARCH_REJECTED_INPUT: ImplementationPlanningInput = {
  ...structuredClone(FX_POS_001_INPUT),
  architecture: { result: minimalArchitectureResult(), approval: { status: "REJECTED" } },
};

/** Agent decision PENDING => PROVISIONAL (T6). */
export const AGENT_PENDING_INPUT: ImplementationPlanningInput = {
  ...structuredClone(FX_POS_003_INPUT),
  agent_engineering: { result: minimalAgentEngineeringResult(), approval: { status: "PENDING" } },
};

export const ALL_POSITIVE_INPUTS: ImplementationPlanningInput[] = [FX_POS_001_INPUT, FX_POS_002_INPUT, FX_POS_003_INPUT];

// ---------------------------------------------------------------------------
// Genuine input-derived SKILL synthesis
// ---------------------------------------------------------------------------

const PRIORITY_OF = { REQUIRED: "P0", SHOULD: "P1", OPTIONAL: "P2" } as const;
const PRIORITY_RATIONALE = {
  REQUIRED: "REQUIRED requirement mapped to P0: required for the minimum successful outcome (SPEC_CONTRACT Stage 10).",
  SHOULD: "SHOULD requirement mapped to P1 by default: valuable after P0.",
  OPTIONAL: "OPTIONAL requirement mapped to P2 by default: optional if budget/risk permit.",
} as const;

function acceptanceFor(reqRef: string, acRef: string | undefined, successCondition: string): ImplementationPlanTask["acceptance"] {
  return [
    {
      id: `${reqRef}-A1`,
      condition: acRef ? `${acRef}: ${successCondition}` : `${reqRef} is implemented and its observable behaviour matches the requirement statement.`,
      verification_method: "AUTOMATED_TEST",
      evidence_expected: "A passing test run demonstrating the acceptance condition.",
    },
  ];
}

function evidenceFor(reqRef: string): ImplementationPlanTask["evidence_required"] {
  return [
    { kind: "UNIT_TEST", description: `Unit tests covering ${reqRef}.`, source_ref: reqRef },
    { kind: "TYPECHECK", description: "Typecheck passes for the changed surface." },
  ];
}

export function synthesizeSkillPlan(input: ImplementationPlanningInput): ImplementationPlanResult {
  const spec = input.spec;
  const classification = classifyPlanStatus(input);
  const adrId = input.architecture.result.adr.id;
  const applicable = input.agent_design_applicability === "APPLICABLE";
  const ae = input.agent_engineering?.result;
  const agentWorkUnitId = ae?.work_unit_id;
  const agentDefRef = ae?.design?.candidate_definition?.id ?? ae?.reuse_agent_id ?? undefined;

  if (classification.status === "BLOCKED") {
    const structured: StructuredPlan = {
      status: "BLOCKED",
      spec_ref: spec.spec_id,
      architecture_decision_refs: [adrId],
      agent_decision_refs: agentWorkUnitId ? [agentWorkUnitId] : [],
      milestones: [],
      tasks: [],
      highest_risk_assumptions: [],
      stop_or_de_scope_rules: [],
      coverage: computePlanCoverage(input, [], classification.blockers),
      blockers: classification.blockers,
      topological_order: [],
    };
    return { ...structured, plan_markdown: renderImplementationPlanMarkdown(structured) };
  }

  const ordered = [
    ...spec.requirements.filter((r) => r.priority === "REQUIRED"),
    ...spec.requirements.filter((r) => r.priority === "SHOULD"),
    ...spec.requirements.filter((r) => r.priority === "OPTIONAL"),
  ];
  const acByRef = new Map(spec.acceptance_criteria.map((ac) => [ac.ref, ac]));

  const tasks: ImplementationPlanTask[] = ordered.map((req, i) => {
    const id = `TASK-${String(i + 1).padStart(3, "0")}`;
    const priority = PRIORITY_OF[req.priority];
    const isP0 = priority === "P0";
    const acRef = req.acceptance_refs[0];
    return {
      id,
      title: `Implement ${req.ref}`,
      outcome: req.statement,
      priority,
      priority_rationale: PRIORITY_RATIONALE[req.priority],
      spec_refs: [req.ref, ...req.acceptance_refs],
      constraint_refs: [],
      assumption_refs: [],
      architecture_refs: isP0 ? [adrId] : [],
      agent_decision_refs: isP0 && applicable && agentWorkUnitId ? [agentWorkUnitId] : [],
      agent_definition_ref: isP0 && applicable && agentDefRef ? agentDefRef : undefined,
      depends_on: [],
      acceptance: acceptanceFor(req.ref, acRef, acRef ? acByRef.get(acRef)?.success_condition ?? "" : ""),
      evidence_required: evidenceFor(req.ref),
      compilation_readiness: "READY_FOR_S13G",
      blocked_by: [],
    };
  });

  // Home the NFR / constraint / assumption refs on the first P0 task (or the
  // first task) so every material ref is traceable.
  const anchor = tasks.find((t) => t.priority === "P0") ?? tasks[0];
  if (anchor) {
    anchor.spec_refs.push(...spec.non_functional_requirements.map((n) => n.ref));
    anchor.constraint_refs.push(...spec.constraints.map((c) => c.ref));
    anchor.assumption_refs.push(...spec.assumptions.map((a) => a.ref));
  }

  // Static depends_on: sequential chain WITHIN each priority tier only.
  // Cross-tier sequencing is conveyed by P0/P1/P2 scope, not edges — except
  // the always-allowed P2-head -> P0-head edge, exercised to prove the
  // "P2 MAY depend on P0" direction.
  const p0 = tasks.filter((t) => t.priority === "P0");
  const p1 = tasks.filter((t) => t.priority === "P1");
  const p2 = tasks.filter((t) => t.priority === "P2");
  for (const tier of [p0, p1, p2]) {
    for (let i = 1; i < tier.length; i++) tier[i].depends_on = [tier[i - 1].id];
  }
  if (p2.length > 0 && p0.length > 0) {
    p2[0].depends_on = Array.from(new Set([...p2[0].depends_on, p0[0].id]));
  }

  // Pending-approval propagation (recomputed from input + the depends_on graph).
  const blockedIds = computePendingBlockedTaskIds(input, tasks);
  for (const t of tasks) {
    if (blockedIds.has(t.id)) {
      t.compilation_readiness = "BLOCKED_PENDING_APPROVAL";
      const reasons: string[] = [];
      if (classification.arch_pending && t.architecture_refs.length > 0) {
        reasons.push(`architecture decision ${adrId} is PENDING human approval`);
      }
      if (classification.agent_pending && t.agent_decision_refs.length > 0) {
        reasons.push(`agent-design decision ${agentWorkUnitId} is PENDING human approval`);
      }
      if (reasons.length === 0) reasons.push("transitively depends on a task blocked pending approval");
      t.blocked_by = reasons;
    } else {
      t.compilation_readiness = "READY_FOR_S13G";
      t.blocked_by = [];
    }
  }

  const milestones: ImplementationMilestone[] = [];
  const milestoneFor = (
    id: string,
    priority: "P0" | "P1" | "P2",
    title: string,
    objective: string,
  ): void => {
    const ids = tasks.filter((t) => t.priority === priority).map((t) => t.id);
    if (ids.length === 0) return;
    milestones.push({
      id,
      title,
      objective,
      task_ids: ids,
      exit_criteria: [`Every ${priority} task's acceptance criteria pass with the required evidence.`],
    });
  };
  milestoneFor("MS-001", "P0", "P0 — minimum successful outcome", "Deliver every P0 task so the minimum successful outcome is achievable.");
  milestoneFor("MS-002", "P1", "P1 — valuable after P0", "Deliver P1 scope once P0 is complete.");
  milestoneFor("MS-003", "P2", "P2 — optional", "Deliver P2 scope only if budget and risk permit.");

  const highest_risk_assumptions = spec.assumptions.map((a) => ({
    ref: a.ref,
    statement: a.statement,
    impact: "If this assumption is false, task sequencing or feasibility for the mapped P0 scope changes.",
    validation_strategy: "Confirm with the decision owner before the dependent P0 tasks begin.",
    affected_task_ids: anchor ? [anchor.id] : [],
  }));

  const stop_or_de_scope_rules = [
    {
      trigger: "The execution budget drops below the estimated P0 cost.",
      action: "De-scope P2 tasks first, then P1 tasks; never remove P0.",
      affected_priorities: ["P2", "P1"] as ("P0" | "P1" | "P2")[],
      protected_scope: ["P0"],
      rationale: "P0 is the minimum successful outcome; a smaller verified result is preferable to a larger unverified one.",
    },
    {
      trigger: "The minimum successful outcome (all P0 tasks) is no longer achievable within budget.",
      action: "STOP and ESCALATE to the decision owner; do not return READY.",
      affected_priorities: ["P0", "P1", "P2"] as ("P0" | "P1" | "P2")[],
      protected_scope: ["P0"],
      rationale: "P0 must never be silently dropped (SPEC_CONTRACT Stage 10 / Skill file: Stop / de-scope rules).",
    },
  ];

  const structured: StructuredPlan = {
    status: classification.status,
    spec_ref: spec.spec_id,
    architecture_decision_refs: [adrId],
    agent_decision_refs: agentWorkUnitId ? [agentWorkUnitId] : [],
    milestones,
    tasks,
    highest_risk_assumptions,
    stop_or_de_scope_rules,
    coverage: computePlanCoverage(input, tasks, []),
    blockers: [],
    topological_order: analyzeDependencies(tasks, milestones).topological_order,
  };
  return { ...structured, plan_markdown: renderImplementationPlanMarkdown(structured) };
}

// ---------------------------------------------------------------------------
// Naive BASELINE synthesis (no Skill) — the canonical Part A mistakes
// ---------------------------------------------------------------------------

export function synthesizeBaselinePlan(input: ImplementationPlanningInput): ImplementationPlanResult {
  const spec = input.spec;
  const adrId = input.architecture.result.adr.id;
  const naiveStatus: "READY" | "BLOCKED" = spec.approval.status === "APPROVED" ? "READY" : "BLOCKED";

  if (naiveStatus === "BLOCKED") {
    const structured: StructuredPlan = {
      status: "BLOCKED",
      spec_ref: spec.spec_id,
      architecture_decision_refs: [adrId],
      agent_decision_refs: [],
      milestones: [],
      tasks: [],
      highest_risk_assumptions: [],
      stop_or_de_scope_rules: [],
      coverage: computePlanCoverage(input, [], ["Spec not approved."]),
      blockers: ["Spec not approved."],
      topological_order: [],
    };
    return { ...structured, plan_markdown: renderImplementationPlanMarkdown(structured) };
  }

  const allReqRefs = spec.requirements.map((r) => r.ref);
  const allNfrRefs = spec.non_functional_requirements.map((n) => n.ref);

  const giant: ImplementationPlanTask = {
    id: "TASK-001",
    title: "Build the whole feature",
    outcome: "Deliver all of the requirements in one pass.",
    priority: "P0",
    priority_rationale: "",
    spec_refs: [...allReqRefs, ...allNfrRefs],
    constraint_refs: [],
    assumption_refs: [],
    architecture_refs: [],
    agent_decision_refs: [],
    depends_on: [],
    acceptance: [],
    evidence_required: [],
    compilation_readiness: "READY_FOR_S13G",
    blocked_by: [],
  };

  const milestones: ImplementationMilestone[] = [
    { id: "MS-001", title: "Deliver everything", objective: "Ship the feature.", task_ids: ["TASK-001"], exit_criteria: ["It works."] },
  ];

  const structured: StructuredPlan = {
    status: naiveStatus,
    spec_ref: spec.spec_id,
    architecture_decision_refs: [adrId],
    agent_decision_refs: [],
    milestones,
    tasks: [giant],
    highest_risk_assumptions: [],
    stop_or_de_scope_rules: [],
    // Self-reported rosy coverage that does NOT match the input-derived recompute.
    coverage: {
      required_total: allReqRefs.length,
      required_mapped_to_p0: allReqRefs.length,
      required_blocked: 0,
      should_total: 0,
      should_mapped: 0,
      optional_total: 0,
      optional_mapped: 0,
      acceptance_total: spec.acceptance_criteria.length,
      acceptance_mapped: spec.acceptance_criteria.length,
      unmapped_material_refs: [],
    },
    blockers: [],
    topological_order: ["TASK-001"],
  };

  // Hand-written Markdown that is NOT the deterministic rendering.
  const plan_markdown = `# Plan\n\nStatus: ${naiveStatus}\n\n- TASK-001: Build the whole feature`;
  return { ...structured, plan_markdown };
}

// ---------------------------------------------------------------------------
// Deterministic ModelProvider — always FINISHes on the first turn (S13F issues
// no tool calls; zero capabilities). Branches purely on whether the
// materialized objective contains the SKILL_ID marker. It is a deterministic
// reference provider, NOT a production LLM.
// ---------------------------------------------------------------------------

function extractPlanningInput(goalText: string): ImplementationPlanningInput {
  const markerIndex = goalText.indexOf(IMPLEMENTATION_PLANNING_INPUT_MARKER);
  if (markerIndex === -1) throw new Error("DeterministicImplementationPlanningModelProvider: input marker not found.");
  const afterMarker = goalText.slice(markerIndex + IMPLEMENTATION_PLANNING_INPUT_MARKER.length).trim();
  const jsonEnd = afterMarker.indexOf("\n\n");
  const jsonText = jsonEnd === -1 ? afterMarker : afterMarker.slice(0, jsonEnd);
  return JSON.parse(jsonText) as ImplementationPlanningInput;
}

export class DeterministicImplementationPlanningModelProvider implements ModelProvider {
  /** Human-readable label — asserted by T33 to describe this accurately, not as an LLM. */
  static readonly PROVIDER_LABEL = "deterministic reference ModelProvider (no external LLM, no network, no credentials)";

  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const goalText = request.goal.statement;
    const input = extractPlanningInput(goalText);
    const skillMode = goalText.includes(IMPLEMENTATION_PLANNING_SKILL_MATERIALIZATION_MARKER);
    const plan = skillMode ? synthesizeSkillPlan(input) : synthesizeBaselinePlan(input);
    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: skillMode
          ? "Applied the materialized Implementation Planning Skill rules/procedure to the bounded input."
          : "No Skill was materialized for this task; produced a naive best-effort plan.",
        output: mapImplementationPlanResultToStructuredOutput(plan),
      },
    };
  }
}
