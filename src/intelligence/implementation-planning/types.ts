import type { AgentEngineeringResult } from "../agent-engineering/types.js";
import type { SoftwareArchitectureDecisionResult } from "../software-architecture/types.js";

/**
 * Brain — S13F Implementation Planning semantic types.
 *
 * Defined in brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md and
 * brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md section 2
 * (ChatGPT-authored, integrated verbatim). This module belongs to
 * Intelligence: it describes S13F's data model (Stage 10 PLAN), not a Core
 * runtime concept and not Stage 11 TASK-COMPILATION (S13G).
 *
 * S13F consumes the S13D `SoftwareArchitectureDecisionResult` and the S13E
 * `AgentEngineeringResult` read-only (spec section 2 — "MUST be imported from
 * their existing S13D/S13E modules and consumed read-only. Do not duplicate
 * them."). It never mutates either and never re-interprets a PROPOSED ADR or a
 * PROPOSED Agent design as approved.
 */

// ---------------------------------------------------------------------------
// Approval (spec section 2)
// ---------------------------------------------------------------------------

export type ApprovalStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface ApprovalSnapshot {
  status: ApprovalStatus;
  evidence_ref?: string;
}

// ---------------------------------------------------------------------------
// Bounded Spec snapshot (Skill file "Inputs" section 1, spec section 2)
// ---------------------------------------------------------------------------

export type SpecPriority = "REQUIRED" | "SHOULD" | "OPTIONAL";
export type PlanPriority = "P0" | "P1" | "P2";

export interface PlanningRequirement {
  ref: string;
  priority: SpecPriority;
  statement: string;
  acceptance_refs: string[];
}

export interface PlanningNonFunctionalRequirement {
  ref: string;
  statement: string;
  success_condition?: string;
  verification_approach?: string;
  evidence_expected?: string;
}

export interface PlanningConstraint {
  ref: string;
  statement: string;
}

export interface PlanningAssumption {
  ref: string;
  statement: string;
}

export interface PlanningAcceptanceCriterion {
  ref: string;
  success_condition: string;
  verification_approach?: string;
  evidence_expected?: string;
}

export interface ImplementationPlanningSpecSnapshot {
  spec_id: string;
  version: string;
  approval: ApprovalSnapshot;
  requirements: PlanningRequirement[];
  non_functional_requirements: PlanningNonFunctionalRequirement[];
  constraints: PlanningConstraint[];
  assumptions: PlanningAssumption[];
  acceptance_criteria: PlanningAcceptanceCriterion[];
}

// ---------------------------------------------------------------------------
// Input contract (spec section 2)
// ---------------------------------------------------------------------------

export interface ApprovedDecisionInput<T> {
  result: T;
  approval: ApprovalSnapshot;
}

export type AgentDesignApplicability = "APPLICABLE" | "NOT_APPLICABLE";

export interface ImplementationPlanningInput {
  spec: ImplementationPlanningSpecSnapshot;
  architecture: ApprovedDecisionInput<SoftwareArchitectureDecisionResult>;
  agent_design_applicability: AgentDesignApplicability;
  agent_engineering?: ApprovedDecisionInput<AgentEngineeringResult>;
  quality_contract_ref: string;
}

// ---------------------------------------------------------------------------
// Task shape (Skill file "Task contract", spec section 2)
// ---------------------------------------------------------------------------

export type EvidenceKind =
  | "TYPECHECK"
  | "BUILD"
  | "STATIC_ANALYSIS"
  | "UNIT_TEST"
  | "INTEGRATION_TEST"
  | "E2E_TEST"
  | "SECURITY_CHECK"
  | "PERFORMANCE_CHECK"
  | "ARTIFACT_INSPECTION"
  | "MANUAL_REVIEW"
  | "OTHER_DETERMINISTIC";

export const EVIDENCE_KINDS: readonly EvidenceKind[] = [
  "TYPECHECK",
  "BUILD",
  "STATIC_ANALYSIS",
  "UNIT_TEST",
  "INTEGRATION_TEST",
  "E2E_TEST",
  "SECURITY_CHECK",
  "PERFORMANCE_CHECK",
  "ARTIFACT_INSPECTION",
  "MANUAL_REVIEW",
  "OTHER_DETERMINISTIC",
];

export interface TaskAcceptanceCriterion {
  id: string;
  condition: string;
  verification_method: string;
  evidence_expected: string;
}

export interface TaskEvidenceRequirement {
  kind: EvidenceKind;
  description: string;
  source_ref?: string;
  manual_review_reason?: string;
}

export type TaskCompilationReadiness = "READY_FOR_S13G" | "BLOCKED_PENDING_APPROVAL";

export interface ImplementationPlanTask {
  id: string;
  title: string;
  outcome: string;

  priority: PlanPriority;
  priority_rationale: string;

  spec_refs: string[];
  constraint_refs: string[];
  assumption_refs: string[];
  architecture_refs: string[];
  agent_decision_refs: string[];
  agent_definition_ref?: string;

  depends_on: string[];

  acceptance: TaskAcceptanceCriterion[];
  evidence_required: TaskEvidenceRequirement[];

  compilation_readiness: TaskCompilationReadiness;
  blocked_by: string[];
}

export interface ImplementationMilestone {
  id: string;
  title: string;
  objective: string;
  task_ids: string[];
  exit_criteria: string[];
}

export interface HighestRiskAssumption {
  ref: string;
  statement: string;
  impact: string;
  validation_strategy: string;
  affected_task_ids: string[];
}

export interface StopOrDeScopeRule {
  trigger: string;
  action: string;
  affected_priorities: PlanPriority[];
  protected_scope: string[];
  rationale: string;
}

export interface PlanCoverage {
  required_total: number;
  required_mapped_to_p0: number;
  required_blocked: number;

  should_total: number;
  should_mapped: number;

  optional_total: number;
  optional_mapped: number;

  acceptance_total: number;
  acceptance_mapped: number;

  unmapped_material_refs: string[];
}

export type ImplementationPlanStatus = "READY" | "PROVISIONAL" | "BLOCKED";

export interface ImplementationPlanResult {
  status: ImplementationPlanStatus;

  spec_ref: string;
  architecture_decision_refs: string[];
  agent_decision_refs: string[];

  milestones: ImplementationMilestone[];
  tasks: ImplementationPlanTask[];

  highest_risk_assumptions: HighestRiskAssumption[];
  stop_or_de_scope_rules: StopOrDeScopeRule[];

  coverage: PlanCoverage;

  blockers: string[];
  topological_order: string[];

  plan_markdown: string;
}

/** Everything in ImplementationPlanResult except the derived Markdown. */
export type StructuredPlan = Omit<ImplementationPlanResult, "plan_markdown">;

// ---------------------------------------------------------------------------
// Skill-vs-no-Skill comparison (Skill file "Success criteria", QC
// skill_vs_no_skill_evaluation, spec section 12) — a COUNTED-ASSERTION model,
// not ratios: the QC thresholds ("+4 correct assertions total", ">= 2
// improved dimensions", ">= 2 additional correct per improved dimension")
// cannot be expressed with ratio metrics.
// ---------------------------------------------------------------------------

export type PlanningDimensionId =
  | "SD-001" // scope_priority_correctness
  | "SD-002" // task_atomicity
  | "SD-003" // verifiability
  | "SD-004" // dependency_quality
  | "SD-005" // traceability_and_coverage
  | "SD-006" // approval_safety
  | "SD-007" // stage_boundary
  | "SD-008"; // risk_and_descope_quality

export interface PlanningDimensionScore {
  total: number;
  correct: number;
}

export interface PlanningArmScore {
  total_assertions: number;
  correct: number;
  by_dimension: Record<PlanningDimensionId, PlanningDimensionScore>;
  hard_invariant_total: number;
  hard_invariant_correct: number;
  s13g_boundary_violations: number;
}

export interface PlanningComparison {
  baseline: PlanningArmScore;
  skill: PlanningArmScore;
  additional_correct_total: number;
  improved_dimensions: PlanningDimensionId[];
  hard_invariant_regressed: boolean;
  meets_threshold: boolean;
}

/**
 * Test-only independent ground truth (Skill file "Success criteria", QC
 * `ground_truth_policy`, spec section 4.5). This shape MUST NOT be
 * constructed from, or passed into, the materializer / ModelProvider / Skill
 * selection / plan synthesizer / validator. It is consumed only by the
 * comparison evaluator, and only after both runtime outputs already exist.
 */
export interface ImplementationPlanningFixtureTruth {
  expected_status: ImplementationPlanStatus;
  /** REQUIREMENT refs (R-/NFR-) that MUST be covered by a P0 task. */
  required_refs: string[];
  /** REQUIREMENT refs that MUST map to a P1 task. */
  should_refs: string[];
  /** REQUIREMENT refs that MUST map to a P2 task. */
  optional_refs: string[];
  expected_p0_task_count: number;
  /** Giant-task detector: a correct plan splits work into at least this many tasks. */
  expected_min_task_count: number;
  /** A small verifiable task maps at most this many requirement refs. */
  max_requirement_refs_per_task: number;
  expected_has_risk_assumptions: boolean;
  arch_pending: boolean;
  agent_pending: boolean;
  has_rejected_decision: boolean;
}
