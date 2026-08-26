import type { KnowledgeGapAnalysisInput, KnowledgeGapAnalysisResult } from "./types.js";

/**
 * Deterministic Skill-vs-baseline comparison metrics.
 *
 * Implements brain-bootstrap/specs/KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md
 * sections 21-22. Both the baseline and Skill-assisted
 * `KnowledgeGapAnalysisResult` values passed in here MUST already have been
 * produced by real runs through the identical compileAgentDefinition() /
 * runAgent() path — this module only scores results, it never constructs or
 * fabricates one.
 *
 * Metric semantics are operationalized precisely here (the spec describes
 * them qualitatively); see
 * brain-bootstrap/reports/S13B-knowledge-gap-analysis-verification.md for
 * the disclosed exact formulas and which fixture each required inequality
 * from section 22 is demonstrated on.
 */

export interface KnowledgeGapComparisonMetrics {
  classification_coverage_ratio: number;
  decision_impact_coverage_ratio: number;

  unsupported_proven_count: number;
  told_as_proven_count: number;
  hidden_assumption_count: number;

  research_target_capture_ratio: number;

  unknowable_misclassified_as_research_count: number;

  closure_overclaim_count: number;
}

export interface KnowledgeGapAnalysisComparison {
  baseline: KnowledgeGapComparisonMetrics;
  skill: KnowledgeGapComparisonMetrics;
}

/** Total number of classifiable candidate items derivable from one input, independent of what a given run actually produced. */
function countClassifiableItems(input: KnowledgeGapAnalysisInput): number {
  const rd = input.requirements_discovery;
  return (
    rd.goals.length +
    rd.users.length +
    rd.unknowns.length +
    rd.assumptions.length +
    rd.constraints.length +
    rd.acceptance_criteria.length +
    input.context_facts.length
  );
}

/**
 * A "future contingent choice" candidate is any NEEDS_RESEARCH item whose
 * question text was never flagged as researchable-in-principle by the S13A
 * unknown's own related structure — operationalized here as: an item is a
 * genuine research target unless its `research_question` text matches the
 * same future-contingent-choice cue the Skill-mode extractor itself uses to
 * classify UNKNOWABLE (tests/knowledge-gap-analysis/fixtures.ts exports the
 * identical regex so this module and the extractor never drift apart).
 */
export const FUTURE_CONTINGENT_CHOICE_CUES =
  /\b(elegirá|decidirá|decisión final|próximo mes|aún no ha decidido|todavía no (ha )?decidido|no ha decidido|will (choose|decide)|not yet decided|future choice)\b/i;

function countClosureOverclaims(result: KnowledgeGapAnalysisResult): number {
  let count = 0;
  for (const item of result.items) {
    if (item.epistemic_status === "PROVEN" && item.evidence_refs.length === 0) count += 1;
    else if (item.closure_state === "RESOLVED_WITH_EVIDENCE" && item.evidence_refs.length === 0) count += 1;
    else if (item.closure_state === "RESOLVED_BY_AUTHORITY" && !item.authority_sufficient) count += 1;
    else if (item.epistemic_status === "NEEDS_RESEARCH" && item.closure_state !== null) count += 1;
  }
  return count;
}

export function computeKnowledgeGapComparisonMetrics(
  result: KnowledgeGapAnalysisResult,
  input: KnowledgeGapAnalysisInput,
): KnowledgeGapComparisonMetrics {
  const classifiable = countClassifiableItems(input);
  const classified = result.items.length;

  const validImpactCount = result.items.filter((i) =>
    (["DECISION_CRITICAL", "DECISION_RELEVANT", "CONTEXTUAL", "TRIVIA"] as const).includes(i.decision_impact),
  ).length;

  const unsupported_proven_count = result.items.filter(
    (i) => i.epistemic_status === "PROVEN" && i.evidence_refs.length === 0,
  ).length;

  const told_as_proven_count = result.items.filter((item) => {
    if (item.epistemic_status !== "PROVEN") return false;
    const sourceFact = input.context_facts.find((f) => f.id === item.source_item_ref);
    return sourceFact?.basis === "SOURCE_ASSERTION";
  }).length;

  const hidden_assumption_count = result.items.filter(
    (i) =>
      i.source_kind === "ASSUMPTION" &&
      (i.epistemic_status === "KNOWN" || i.epistemic_status === "PROVEN" || i.epistemic_status === "TOLD"),
  ).length;

  const researchQueueItems = result.items.filter((i) => i.epistemic_status === "NEEDS_RESEARCH");
  const genuineResearchTargets = researchQueueItems.filter(
    (i) => !FUTURE_CONTINGENT_CHOICE_CUES.test(i.research_question ?? i.statement),
  );
  const research_target_capture_ratio =
    researchQueueItems.length === 0 ? 1 : genuineResearchTargets.length / researchQueueItems.length;

  const unknowable_misclassified_as_research_count = researchQueueItems.filter((i) =>
    FUTURE_CONTINGENT_CHOICE_CUES.test(i.research_question ?? i.statement),
  ).length;

  return {
    classification_coverage_ratio: classifiable === 0 ? 1 : classified / classifiable,
    decision_impact_coverage_ratio: classified === 0 ? 1 : validImpactCount / classified,
    unsupported_proven_count,
    told_as_proven_count,
    hidden_assumption_count,
    research_target_capture_ratio,
    unknowable_misclassified_as_research_count,
    closure_overclaim_count: countClosureOverclaims(result),
  };
}

export function compareKnowledgeGapAnalysisRuns(
  baseline: KnowledgeGapAnalysisResult,
  skill: KnowledgeGapAnalysisResult,
  input: KnowledgeGapAnalysisInput,
): KnowledgeGapAnalysisComparison {
  return {
    baseline: computeKnowledgeGapComparisonMetrics(baseline, input),
    skill: computeKnowledgeGapComparisonMetrics(skill, input),
  };
}
