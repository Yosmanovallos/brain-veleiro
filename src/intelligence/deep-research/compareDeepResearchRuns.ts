import type { Finding } from "../research/types.js";
import {
  countSupportingIndependenceGroups,
  DUPLICATE_AWARENESS_CUE,
  hasValidSingularAuthorityException,
  isFindingStaleCurrentClaimWithoutLimitation,
} from "./validateDeepResearchResult.js";
import type { DeepResearchBatchResult, DeepResearchComparison, DeepResearchComparisonMetrics, DeepResearchInput } from "./types.js";

/**
 * Deterministic Skill-vs-baseline comparison metrics.
 *
 * Implements brain-bootstrap/specs/DEEP_RESEARCH_AGENT_v1.md sections 17-19.
 * Both the baseline and Skill-assisted `DeepResearchBatchResult` values
 * passed in here MUST already have been produced by real runs through the
 * identical compileAgentDefinition() / runAgent() path — this module only
 * scores results, it never constructs or fabricates one.
 *
 * `countSupportingIndependenceGroups`, `hasValidSingularAuthorityException`,
 * and `isFindingStaleCurrentClaimWithoutLimitation` are imported from
 * ./validateDeepResearchResult.ts so the validator's invariants and these
 * metrics' scoring rules can never drift apart.
 *
 * `contradiction_visibility_ratio`'s denominator (how many contradictions the
 * underlying source corpus genuinely contains) is not derivable from
 * `DeepResearchBatchResult`/`DeepResearchInput` alone — S13C's comparator, like
 * S11's and S13B's, cannot see the raw evidence corpus. The optional
 * `groundTruth.expected_contradiction_count_by_item` parameter lets the
 * verification harness (which authored the fixture corpus and therefore
 * knows the true count) supply it; when omitted for an item, this module
 * falls back to that item's own surfaced count (a disclosed, non-circular-in-
 * intent but vacuous-without-ground-truth default — see
 * brain-bootstrap/reports/S13C-deep-research-verification.md for the exact
 * values used and why this is not a hidden tautology).
 */

export interface DeepResearchFixtureGroundTruth {
  expected_contradiction_count_by_item?: Record<string, number>;
}

function isMaterial(finding: Finding): boolean {
  return finding.criticality === "DECISION_CRITICAL" || finding.criticality === "DECISION_RELEVANT";
}

function isCovered(finding: Finding): boolean {
  if (finding.epistemic_status === "EVIDENCED") return finding.evidence.length >= 1;
  if (finding.epistemic_status === "INFERENCE" || finding.epistemic_status === "UNCERTAIN") {
    return finding.limitations.length >= 1;
  }
  return false;
}

export function computeDeepResearchComparisonMetrics(
  result: DeepResearchBatchResult,
  input: DeepResearchInput,
  groundTruth: DeepResearchFixtureGroundTruth = {},
): DeepResearchComparisonMetrics {
  const allMaterialFindings: Finding[] = result.items.flatMap((item) => item.research.findings.filter(isMaterial));
  const eligibleEvidenced = allMaterialFindings.filter((f) => f.epistemic_status === "EVIDENCED");

  const covered = allMaterialFindings.filter(isCovered);
  const material_claim_evidence_coverage_ratio = allMaterialFindings.length === 0 ? 1 : covered.length / allMaterialFindings.length;

  const crossValidated = eligibleEvidenced.filter(
    (f) => countSupportingIndependenceGroups(f.evidence) >= 2 || hasValidSingularAuthorityException(f),
  );
  const independent_cross_validation_ratio = eligibleEvidenced.length === 0 ? 1 : crossValidated.length / eligibleEvidenced.length;

  const withAuthoritative = eligibleEvidenced.filter((f) => f.evidence.some((e) => e.source_type === "PRIMARY"));
  const authoritative_or_primary_coverage_ratio = eligibleEvidenced.length === 0 ? 1 : withAuthoritative.length / eligibleEvidenced.length;

  const surfacedContradictions = result.items.reduce((sum, item) => sum + item.research.contradictions.length, 0);
  const expectedContradictions = result.items.reduce((sum, item) => {
    const expected = groundTruth.expected_contradiction_count_by_item?.[item.knowledge_item_id];
    return sum + (expected ?? item.research.contradictions.length);
  }, 0);
  const contradiction_visibility_ratio = expectedContradictions === 0 ? 1 : surfacedContradictions / expectedContradictions;

  const queueById = new Map(input.knowledge_gap_analysis.research_queue.map((r) => [r.knowledge_item_id, r]));
  const preservedTraceability = result.items.filter((item) => {
    const queueEntry = queueById.get(item.knowledge_item_id);
    return (
      !!queueEntry &&
      queueEntry.research_question === item.research_question &&
      queueEntry.decision_impact === item.decision_impact &&
      queueEntry.blocking === item.blocking
    );
  });
  const traceability_coverage_ratio = result.items.length === 0 ? 1 : preservedTraceability.length / result.items.length;

  const unsupported_material_claim_count = allMaterialFindings.length - covered.length;

  const duplicate_independence_overcount = allMaterialFindings.reduce((sum, f) => {
    if (f.epistemic_status !== "EVIDENCED") return sum;
    const supportsCount = f.evidence.filter((e) => e.relationship === "SUPPORTS").length;
    const distinctGroups = countSupportingIndependenceGroups(f.evidence);
    const claimsUnawareOfDuplication = !f.limitations.some((l) => DUPLICATE_AWARENESS_CUE.test(l));
    if (f.confidence === "HIGH" && distinctGroups < supportsCount && claimsUnawareOfDuplication) {
      return sum + (supportsCount - distinctGroups);
    }
    return sum;
  }, 0);

  const stale_current_claim_without_limitation_count = result.items.reduce(
    (sum, item) =>
      sum +
      item.research.findings.filter(isMaterial).filter((f) => isFindingStaleCurrentClaimWithoutLimitation(f, item.research_question)).length,
    0,
  );

  const closure_overclaim_count = result.items.reduce((sum, item) => {
    const closure = item.recommended_closure_state;
    if (closure === null) return sum;
    if (closure === "RESOLVED_WITH_EVIDENCE") {
      const hasSufficientEvidence = item.research.findings
        .filter(isMaterial)
        .filter((f) => f.epistemic_status === "EVIDENCED")
        .some((f) => countSupportingIndependenceGroups(f.evidence) >= 2 || hasValidSingularAuthorityException(f));
      return hasSufficientEvidence ? sum : sum + 1;
    }
    if (closure === "RESOLVED_BY_AUTHORITY") {
      const hasPrimary = item.research.findings.some((f) => f.evidence.some((e) => e.source_type === "PRIMARY"));
      return hasPrimary ? sum : sum + 1;
    }
    if (closure === "BLOCKED") {
      const justified = item.decision_impact === "DECISION_CRITICAL" && item.blocking && item.research.research_status.state === "EXHAUSTED_WITH_UNCERTAINTY";
      return justified ? sum : sum + 1;
    }
    return sum;
  }, 0);

  return {
    material_claim_evidence_coverage_ratio,
    independent_cross_validation_ratio,
    authoritative_or_primary_coverage_ratio,
    contradiction_visibility_ratio,
    traceability_coverage_ratio,
    unsupported_material_claim_count,
    duplicate_independence_overcount,
    stale_current_claim_without_limitation_count,
    closure_overclaim_count,
  };
}

export function compareDeepResearchRuns(
  baseline: DeepResearchBatchResult,
  skill: DeepResearchBatchResult,
  input: DeepResearchInput,
  groundTruth: DeepResearchFixtureGroundTruth = {},
): DeepResearchComparison {
  return {
    baseline: computeDeepResearchComparisonMetrics(baseline, input, groundTruth),
    skill: computeDeepResearchComparisonMetrics(skill, input, groundTruth),
  };
}
