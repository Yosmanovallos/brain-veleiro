/**
 * Brain — S11 Researcher semantic types.
 *
 * Defined in brain-bootstrap/specs/RESEARCHER_AGENT_v1.md sections 4, 6, 7, 8
 * (ChatGPT-authored, integrated verbatim as prose; these are the TypeScript
 * shapes Part B derives from that contract). This module belongs to
 * Intelligence: it describes the Researcher's data model, not a Core
 * runtime concept. `ResearchResult` is carried as data inside the existing,
 * unmodified S09 `StructuredAgentOutput` — see mapResearchResultToStructuredOutput
 * in ./validateResearchResult.js.
 */

// ---------------------------------------------------------------------------
// Canonical enums (RESEARCHER_AGENT_v1.md section 7 / RESEARCH_SKILL_S11.md)
// ---------------------------------------------------------------------------

export type GapClass = "DECISION_CRITICAL" | "DECISION_RELEVANT" | "CONTEXTUAL" | "TRIVIA";

export type SubquestionStatus =
  | "OPEN"
  | "RESOLVED_WITH_EVIDENCE"
  | "RESOLVED_BY_AUTHORITY"
  | "ACCEPTED_AS_ASSUMPTION"
  | "DEFERRED_WITHOUT_DECISION_IMPACT"
  | "BLOCKED";

export type FindingCriticality = "DECISION_CRITICAL" | "DECISION_RELEVANT" | "CONTEXTUAL";

export type EpistemicStatus = "EVIDENCED" | "INFERENCE" | "UNCERTAIN";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type SourceType = "PRIMARY" | "SECONDARY" | "DIRECT_OBSERVATION" | "OTHER";

export type EvidenceRelationship = "SUPPORTS" | "CONTRADICTS" | "QUALIFIES";

export type ContradictionResolution = "RESOLVED" | "UNRESOLVED" | "NOT_DECISION_RELEVANT";

export type ResearchStatusState = "SATISFIED" | "EXHAUSTED_WITH_UNCERTAINTY" | "MORE_RESEARCH_NEEDED";

// ---------------------------------------------------------------------------
// research.lookup capability shapes (RESEARCH_SKILL_S11.md section 4)
// ---------------------------------------------------------------------------

/** Internal corpus record. `topic_tags` drives matching only; it is never returned to the model. */
export interface ResearchSourceRecord {
  source_ref: string;
  title: string;
  source_type: SourceType;
  authority: string;
  independence_group: string;
  observed_or_published_at: string;
  locator: string;
  excerpt: string;
  topic_tags: string[];
}

export interface ResearchLookupInput {
  query: string;
  limit?: number;
}

export interface ResearchLookupResultItem {
  source_ref: string;
  title: string;
  source_type: SourceType;
  authority: string;
  independence_group: string;
  observed_or_published_at: string;
  locator: string;
  excerpt: string;
}

export interface ResearchLookupOutput {
  results: ResearchLookupResultItem[];
}

// ---------------------------------------------------------------------------
// ResearchResult model (RESEARCHER_AGENT_v1.md section 7)
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  evidence_ref: string;
  source_ref: string;
  source_title: string;
  source_type: SourceType;
  authority: string;
  independence_group: string;
  observed_or_published_at: string;
  locator: string;
  relationship: EvidenceRelationship;
}

export interface Subquestion {
  id: string;
  question: string;
  gap_class: GapClass;
  why_it_matters: string;
  decision_affected: string;
  status: SubquestionStatus;
}

export interface Finding {
  id: string;
  claim: string;
  criticality: FindingCriticality;
  epistemic_status: EpistemicStatus;
  evidence: EvidenceItem[];
  confidence: Confidence;
  limitations: string[];
}

export interface Contradiction {
  topic: string;
  claim_refs: string[];
  evidence_refs: string[];
  description: string;
  resolution: ContradictionResolution;
  limitations: string[];
}

export interface UnknownItem {
  question: string;
  gap_class: FindingCriticality;
  reason_unresolved: string;
  decision_impact: string;
  revalidation_trigger: string;
}

export interface ResearchStatus {
  state: ResearchStatusState;
  reason: string;
  unresolved_decision_critical_gaps: string[];
  additional_research_expected_to_change_decision: boolean;
}

export interface ResearchResult {
  question: string;
  subquestions: Subquestion[];
  findings: Finding[];
  contradictions: Contradiction[];
  unknowns: UnknownItem[];
  research_status: ResearchStatus;
  decision_relevant_summary: string;
}
