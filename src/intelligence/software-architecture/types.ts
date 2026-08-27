import type { DecisionImpact, KnowledgeGapAnalysisResult } from "../knowledge-gap-analysis/types.js";
import type { DeepResearchBatchResult } from "../deep-research/types.js";

/**
 * Brain — S13D Software Architecture semantic types.
 *
 * Defined in brain-bootstrap/skills/SOFTWARE_ARCHITECTURE_SKILL_S13D.md
 * sections 1, 4-19 and brain-bootstrap/specs/SOFTWARE_ARCHITECTURE_AGENT_v1.md
 * sections 6, 9-22 (ChatGPT-authored, integrated verbatim). This module
 * belongs to Intelligence: it describes S13D's data model, not a Core
 * runtime concept.
 *
 * S13D reuses `KnowledgeGapAnalysisResult` (S13B) and `DeepResearchBatchResult`
 * (S13C) unchanged by import, read-only (spec section 7 — "Upstream
 * immutability"). It never mutates either and never applies S13C's
 * `recommended_closure_state` (spec section 8, Skill file section 3).
 */

// ---------------------------------------------------------------------------
// SoftwareArchitectureInput (Skill file section 1, Agent spec section 6)
// ---------------------------------------------------------------------------

export type ArchitectureAlternativeOrigin = "PROVIDED" | "GENERATED";

export interface ArchitectureAlternativeSeed {
  id: string;
  name: string;
  description: string;
  origin: ArchitectureAlternativeOrigin;
}

export interface SoftwareArchitectureInput {
  architecture_question: string;
  knowledge_gap_analysis: KnowledgeGapAnalysisResult;
  deep_research?: DeepResearchBatchResult;
  candidate_alternatives?: ArchitectureAlternativeSeed[];
}

// ---------------------------------------------------------------------------
// Decision drivers (Skill file section 5)
// ---------------------------------------------------------------------------

export type ArchitectureDriverKind =
  | "HARD_CONSTRAINT"
  | "QUALITY_ATTRIBUTE"
  | "BUSINESS"
  | "OPERATIONS"
  | "SECURITY"
  | "COST"
  | "DELIVERY"
  | "OTHER";

export interface ArchitectureDecisionDriver {
  id: string;
  statement: string;
  kind: ArchitectureDriverKind;
  hard: boolean;
  source_refs: string[];
  rationale: string;
}

// ---------------------------------------------------------------------------
// Architecture evaluation vocabulary (Skill file section 6)
// ---------------------------------------------------------------------------

export type ArchitectureFit = "STRONG" | "ACCEPTABLE" | "WEAK" | "FAIL" | "UNKNOWN";

export interface ArchitectureDriverEvaluation {
  driver_id: string;
  fit: ArchitectureFit;
  rationale: string;
  evidence_refs: string[];
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Failure mode (Skill file section 7)
// ---------------------------------------------------------------------------

export type ArchitectureRiskLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface ArchitectureFailureMode {
  id: string;
  alternative_id: string;
  scenario: string;
  trigger: string;
  impact: string;
  observable_symptom: string;
  mitigation_or_containment: string;
  residual_risk: ArchitectureRiskLevel;
  evidence_refs: string[];
}

// ---------------------------------------------------------------------------
// Cost / Operations / Security / Reversibility profiles (Skill file 8-11)
// ---------------------------------------------------------------------------

export type ArchitectureRelativeLevel = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

export interface ArchitectureCostProfile {
  implementation_cost: ArchitectureRelativeLevel;
  ongoing_operational_cost: ArchitectureRelativeLevel;
  migration_or_exit_cost: ArchitectureRelativeLevel;
  cost_drivers: string[];
  limitations: string[];
}

export interface ArchitectureOperationsProfile {
  deployment_complexity: ArchitectureRelativeLevel;
  operator_burden: ArchitectureRelativeLevel;
  observability_notes: string[];
  backup_recovery_notes: string[];
  failure_handling_notes: string[];
  limitations: string[];
}

export interface ArchitectureSecurityProfile {
  trust_boundaries: string[];
  sensitive_data_exposure: string[];
  credential_or_secret_implications: string[];
  attack_surface_notes: string[];
  security_tradeoffs: string[];
  unresolved_security_questions: string[];
  evidence_refs: string[];
}

export interface ArchitectureReversibilityProfile {
  reversibility: ArchitectureRelativeLevel;
  migration_path: string;
  lock_in_factors: string[];
  irreversible_or_costly_choices: string[];
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Assumptions (Skill file section 13)
// ---------------------------------------------------------------------------

export interface ArchitectureAssumption {
  id: string;
  statement: string;
  rationale: string;
  risk: "HIGH" | "MEDIUM" | "LOW";
  must_validate: boolean;
  source_refs: string[];
}

// ---------------------------------------------------------------------------
// Alternative analysis (Skill file section 12)
// ---------------------------------------------------------------------------

export interface ArchitectureAlternativeAnalysis {
  id: string;
  name: string;
  description: string;
  origin: ArchitectureAlternativeOrigin;
  driver_evaluations: ArchitectureDriverEvaluation[];
  benefits: string[];
  disadvantages: string[];
  failure_modes: ArchitectureFailureMode[];
  cost: ArchitectureCostProfile;
  operations: ArchitectureOperationsProfile;
  security: ArchitectureSecurityProfile;
  reversibility: ArchitectureReversibilityProfile;
  evidence_refs: string[];
  assumptions: ArchitectureAssumption[];
}

// ---------------------------------------------------------------------------
// Decision readiness (Skill file section 14, Agent spec sections 18-19)
// ---------------------------------------------------------------------------

export type ArchitectureDecisionStatus = "READY_FOR_HUMAN_APPROVAL" | "NEEDS_MORE_EVIDENCE" | "BLOCKED";

// ---------------------------------------------------------------------------
// Architecture Decision Record (Skill file section 15)
// ---------------------------------------------------------------------------

export type AdrStatus = "PROPOSED";

export interface ArchitectureDecisionRecord {
  id: string;
  title: string;
  status: AdrStatus;
  decision_question: string;
  context: string;
  decision_drivers: ArchitectureDecisionDriver[];
  alternatives_considered: string[];
  decision: string;
  selected_alternative_id: string | null;
  rationale: string;
  positive_consequences: string[];
  negative_consequences: string[];
  failure_modes: ArchitectureFailureMode[];
  cost_considerations: string[];
  operational_considerations: string[];
  security_considerations: string[];
  evidence_refs: string[];
  assumptions: ArchitectureAssumption[];
  unresolved_questions: string[];
  approval_required: true;
  approval_note: string;
}

// ---------------------------------------------------------------------------
// SoftwareArchitectureDecisionResult (Skill file section 17)
// ---------------------------------------------------------------------------

export interface RejectedAlternativeReasons {
  alternative_id: string;
  reasons: string[];
}

export interface UnresolvedDecisionGap {
  knowledge_item_id: string;
  reason: string;
  decision_impact: DecisionImpact;
}

export interface SoftwareArchitectureDecisionResult {
  architecture_question: string;
  decision_status: ArchitectureDecisionStatus;
  decision_drivers: ArchitectureDecisionDriver[];
  alternatives: ArchitectureAlternativeAnalysis[];
  recommended_alternative_id: string | null;
  recommendation_summary: string;
  rejected_alternative_reasons: RejectedAlternativeReasons[];
  unresolved_decision_gaps: UnresolvedDecisionGap[];
  adr: ArchitectureDecisionRecord;
  adr_markdown: string;
}

// ---------------------------------------------------------------------------
// Skill-vs-baseline comparison metrics (Skill file sections 25-26)
// ---------------------------------------------------------------------------

export interface SoftwareArchitectureComparisonMetrics {
  canonical_dimension_coverage_ratio: number;
  hard_constraint_coverage_ratio: number;
  alternative_balance_ratio: number;
  failure_mode_coverage_ratio: number;
  evidence_traceability_ratio: number;
  assumption_visibility_ratio: number;
  security_dimension_coverage_ratio: number;
  unsupported_recommendation_count: number;
  hard_constraint_violation_count: number;
}

export interface SoftwareArchitectureComparison {
  baseline: SoftwareArchitectureComparisonMetrics;
  skill: SoftwareArchitectureComparisonMetrics;
}
