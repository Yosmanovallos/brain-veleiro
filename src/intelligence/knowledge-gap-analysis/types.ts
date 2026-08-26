import type { RequirementsDiscoveryResult } from "../requirements-discovery/types.js";

/**
 * Brain — S13B Knowledge Gap Analysis semantic types.
 *
 * Defined in brain-bootstrap/specs/KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md
 * sections 4-17 (ChatGPT-authored, integrated verbatim as prose; these are
 * the TypeScript shapes Part B derives from that contract). This module
 * belongs to Intelligence: it describes the knowledge-gap-analyzer's data
 * model, not a Core runtime concept. `KnowledgeGapAnalysisResult` is carried
 * as data inside the existing, unmodified S09 `StructuredAgentOutput` — see
 * mapKnowledgeGapAnalysisResultToStructuredOutput in
 * ./validateKnowledgeGapAnalysisResult.js.
 *
 * Three orthogonal axes per knowledge item (spec section 2, Decision D-012):
 * `epistemic_status`, `decision_impact` (reusing S04 exactly), and a
 * nullable `closure_state` (also reusing S04 exactly). None replaces
 * another.
 */

// ---------------------------------------------------------------------------
// Epistemic status axis (spec section 8) — S13B's own, new vocabulary.
// ---------------------------------------------------------------------------

export type EpistemicStatus = "KNOWN" | "TOLD" | "PROVEN" | "ASSUMED" | "NEEDS_RESEARCH" | "UNKNOWABLE";

// ---------------------------------------------------------------------------
// Decision impact axis (spec section 9) — reused verbatim from S04 /
// QUALITY_ARCHITECTURE_v1.md section 3.2. Not redefined, not renamed.
// ---------------------------------------------------------------------------

export type DecisionImpact = "DECISION_CRITICAL" | "DECISION_RELEVANT" | "CONTEXTUAL" | "TRIVIA";

// ---------------------------------------------------------------------------
// Closure state axis (spec section 10) — reused verbatim from S04 /
// QUALITY_ARCHITECTURE_v1.md section 3.4, but nullable in S13B's result.
// `null` is not a new closure state; it means none is currently justified.
// ---------------------------------------------------------------------------

export type GapClosureState =
  | "RESOLVED_WITH_EVIDENCE"
  | "RESOLVED_BY_AUTHORITY"
  | "ACCEPTED_AS_ASSUMPTION"
  | "DEFERRED_WITHOUT_DECISION_IMPACT"
  | "BLOCKED";

export type CurrentGapClosureState = GapClosureState | null;

// ---------------------------------------------------------------------------
// KnowledgeContextFact (spec section 5) — bounded current-context facts
// supplied by Context. S13B does not retrieve these externally.
// ---------------------------------------------------------------------------

export type KnowledgeFactBasis = "CANONICAL_AUTHORITY" | "DIRECT_EVIDENCE" | "SOURCE_ASSERTION";

export interface KnowledgeContextFact {
  id: string;
  statement: string;

  source_ref: string;
  authority: string;

  basis: KnowledgeFactBasis;

  observed_or_effective_at?: string;

  related_goal_ids: string[];
}

// ---------------------------------------------------------------------------
// Input contract (spec section 4) — the full S13A result plus optional
// bounded context facts. No separate raw-request field: the request already
// exists inside requirements_discovery.request.
// ---------------------------------------------------------------------------

export interface KnowledgeGapAnalysisInput {
  requirements_discovery: RequirementsDiscoveryResult;
  context_facts: KnowledgeContextFact[];
}

// ---------------------------------------------------------------------------
// KnowledgeItem (spec section 11)
// ---------------------------------------------------------------------------

export type KnowledgeItemSourceKind =
  | "GOAL"
  | "USER"
  | "UNKNOWN"
  | "ASSUMPTION"
  | "CONSTRAINT"
  | "ACCEPTANCE_CRITERION"
  | "CONTEXT_FACT";

export interface KnowledgeItem {
  id: string;

  source_item_ref: string;
  source_kind: KnowledgeItemSourceKind;

  statement: string;

  epistemic_status: EpistemicStatus;
  decision_impact: DecisionImpact;
  closure_state: CurrentGapClosureState;

  authority_refs: string[];
  evidence_refs: string[];
  assertion_refs: string[];

  assumption_rationale?: string;

  authority_sufficient: boolean;
  accepted_for_current_decision: boolean;

  blocking: boolean;

  related_goal_ids: string[];

  research_question?: string;

  rationale: string;
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Bucket index (spec section 12) — derived from epistemic_status only;
// every item ID must appear in exactly one bucket.
// ---------------------------------------------------------------------------

export interface KnowledgeBuckets {
  known: string[];
  told: string[];
  proven: string[];
  assumed: string[];
  needs_research: string[];
  unknowable: string[];
}

// ---------------------------------------------------------------------------
// Research queue (spec section 13) — only NEEDS_RESEARCH items, sorted by
// decision impact, then blocking, then deterministic ID ascending.
// ---------------------------------------------------------------------------

export interface ResearchQueueItem {
  knowledge_item_id: string;
  research_question: string;
  decision_impact: DecisionImpact;
  blocking: boolean;
  why_research_matters: string;
}

// ---------------------------------------------------------------------------
// S13C handoff (spec section 14)
// ---------------------------------------------------------------------------

export interface DeepResearchHandoff {
  ready_for_deep_research: boolean;

  research_item_ids: string[];

  decision_blockers: string[];

  unknowable_item_ids: string[];

  notes: string;
}

// ---------------------------------------------------------------------------
// KnowledgeGapAnalysisResult (spec section 15)
// ---------------------------------------------------------------------------

export interface KnowledgeGapAnalysisResult {
  source_request: string;

  items: KnowledgeItem[];

  buckets: KnowledgeBuckets;

  research_queue: ResearchQueueItem[];

  handoff: DeepResearchHandoff;

  decision_readiness_summary: string;
}
