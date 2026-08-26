import type { ResearchResult } from "../research/types.js";
import type { CurrentGapClosureState, DecisionImpact, KnowledgeGapAnalysisResult } from "../knowledge-gap-analysis/types.js";

/**
 * Brain — S13C Deep Research semantic types.
 *
 * Defined in brain-bootstrap/specs/DEEP_RESEARCH_AGENT_v1.md sections 5, 8-11,
 * 17 (ChatGPT-authored, integrated verbatim). This module belongs to
 * Intelligence: it describes S13C's data model, not a Core runtime concept.
 *
 * S13C reuses `ResearchResult` (S11) and `DecisionImpact`/`CurrentGapClosureState`
 * (S04/S13B) unchanged by import — see DEEP_RESEARCH_AGENT_v1.md section 7
 * ("S11 reuse contract") and section 8 ("Epistemic vocabulary boundary").
 * S11's claim-level `EvidenceItem.relationship`/`Finding.epistemic_status`
 * (EVIDENCED|INFERENCE|UNCERTAIN) and S13B's item-level `epistemic_status`
 * (KNOWN|TOLD|PROVEN|ASSUMED|NEEDS_RESEARCH|UNKNOWABLE) are never merged into
 * one enum — a `DeepResearchItemResult` carries both, kept fully distinct.
 */

// ---------------------------------------------------------------------------
// DeepResearchInput (DEEP_RESEARCH_AGENT_v1.md section 5)
// ---------------------------------------------------------------------------

export interface DeepResearchInput {
  knowledge_gap_analysis: KnowledgeGapAnalysisResult;
  /** Default 1, minimum 1, maximum 3, integer only (section 5). */
  max_research_items?: number;
}

// ---------------------------------------------------------------------------
// DeepResearchItemResult (DEEP_RESEARCH_AGENT_v1.md section 9)
// ---------------------------------------------------------------------------

/**
 * S13C recommends closure; it never mutates upstream S13B state (section 9-10).
 * ACCEPTED_AS_ASSUMPTION and DEFERRED_WITHOUT_DECISION_IMPACT are deliberately
 * excluded — S13C MUST NOT recommend them for a NEEDS_RESEARCH item (DR-R23).
 */
export type S13CRecommendedClosureState = "RESOLVED_WITH_EVIDENCE" | "RESOLVED_BY_AUTHORITY" | "BLOCKED" | null;

export interface DeepResearchItemResult {
  knowledge_item_id: string;

  research_question: string;
  decision_impact: DecisionImpact;

  blocking: boolean;

  /** Every S13C-eligible item is NEEDS_RESEARCH upstream — DR-R1/DR-R2. */
  upstream_epistemic_status: "NEEDS_RESEARCH";
  /** Preserved for defensive traceability (section 9) — normally null. */
  upstream_closure_state: CurrentGapClosureState;

  /** The unmodified canonical S11 ResearchResult for this item (section 7). */
  research: ResearchResult;

  recommended_closure_state: S13CRecommendedClosureState;
  closure_rationale: string;

  limitations: string[];
}

// ---------------------------------------------------------------------------
// DeepResearchBatchResult (DEEP_RESEARCH_AGENT_v1.md section 10-11)
// ---------------------------------------------------------------------------

export type DeepResearchBatchStatus = "COMPLETE" | "PARTIAL" | "BLOCKED";

export interface DeepResearchBatchResult {
  source_request: string;

  /** S13B research_queue knowledge_item_ids in canonical order (section 10). */
  queue_snapshot: string[];

  /** First N queue_snapshot ids (section 10). */
  selected_item_ids: string[];

  /** Order must equal selected_item_ids order (section 10). */
  items: DeepResearchItemResult[];

  /** queue_snapshot minus selected_item_ids (section 10). */
  deferred_item_ids: string[];

  batch_status: DeepResearchBatchStatus;

  decision_relevant_summary: string;
}

// ---------------------------------------------------------------------------
// DeepResearchComparisonMetrics (DEEP_RESEARCH_AGENT_v1.md sections 17-18)
// ---------------------------------------------------------------------------

export interface DeepResearchComparisonMetrics {
  material_claim_evidence_coverage_ratio: number;
  independent_cross_validation_ratio: number;
  authoritative_or_primary_coverage_ratio: number;
  contradiction_visibility_ratio: number;
  traceability_coverage_ratio: number;

  unsupported_material_claim_count: number;
  duplicate_independence_overcount: number;
  stale_current_claim_without_limitation_count: number;
  closure_overclaim_count: number;
}

export interface DeepResearchComparison {
  baseline: DeepResearchComparisonMetrics;
  skill: DeepResearchComparisonMetrics;
}
