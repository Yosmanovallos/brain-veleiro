import { computeResolvableEvidenceRefs, hardDrivers } from "./validateSoftwareArchitectureResult.js";
import type {
  ArchitectureAlternativeAnalysis,
  ArchitectureFit,
  ArchitectureSecurityProfile,
  SoftwareArchitectureComparison,
  SoftwareArchitectureComparisonMetrics,
  SoftwareArchitectureDecisionResult,
  SoftwareArchitectureInput,
} from "./types.js";

/**
 * Deterministic Skill-vs-baseline comparison metrics.
 *
 * Implements brain-bootstrap/skills/SOFTWARE_ARCHITECTURE_SKILL_S13D.md
 * sections 25-27. Both the baseline and Skill-assisted
 * `SoftwareArchitectureDecisionResult` values passed in here MUST already
 * have been produced by real runs through the identical
 * compileAgentDefinition() / runAgent() path — this module only scores
 * results, it never constructs or fabricates one.
 *
 * `hardDrivers` is imported from ./validateSoftwareArchitectureResult.ts so
 * the validator's invariants and these metrics' scoring rules can never
 * drift apart.
 *
 * Three of the nine metrics cannot be grounded from the result alone,
 * exactly like S13C's `contradiction_visibility_ratio`:
 *
 * - `hard_constraint_violation_count`'s true answer (did the recommended
 *   alternative actually violate a hard constraint?) is not verifiable from
 *   a naive result that simply omits the evaluation that would reveal the
 *   violation. `groundTruth.true_hard_constraint_fit_by_alternative` lets the
 *   verification harness (which authored the fixture and knows the correct
 *   evaluation) supply the true fit; when omitted for a pair, this module
 *   falls back to the result's own self-reported fit (a disclosed, weaker
 *   default — see brain-bootstrap/reports/S13D-software-architecture-verification.md).
 * - `failure_mode_coverage_ratio` and `assumption_visibility_ratio`'s
 *   denominators ("fixture-expected material failure modes" / "fixture-known
 *   or generated assumptions") are not derivable from the result alone
 *   either (Skill file section 26 explicitly calls for "fixture truth"). Both
 *   fall back to a vacuous self-referential default (ratio 1) when the
 *   corresponding ground truth is omitted, disclosed here and in the report.
 */

export interface SoftwareArchitectureFixtureGroundTruth {
  true_hard_constraint_fit_by_alternative?: Record<string, Record<string, ArchitectureFit>>;
  expected_material_failure_mode_count_by_alternative?: Record<string, number>;
  expected_assumption_count?: number;
}

const GENERIC_SECURITY_BOILERPLATE = /^(use encryption|use best practices|follow security best practices|apply standard security measures)\.?$/i;

/**
 * Exported so both `canonical_dimension_coverage_ratio` and
 * `security_dimension_coverage_ratio` score "architecture-specific security"
 * identically. A field list containing only generic boilerplate phrases
 * (Skill file section 14's own worked negative example: "use encryption",
 * "use best practices") does not count as architecture-specific.
 */
export function hasArchitectureSpecificSecurity(security: ArchitectureSecurityProfile): boolean {
  const allFields = [
    ...security.trust_boundaries,
    ...security.sensitive_data_exposure,
    ...security.credential_or_secret_implications,
    ...security.attack_surface_notes,
    ...security.security_tradeoffs,
    ...security.unresolved_security_questions,
  ];
  if (allFields.length === 0) return false;
  return allFields.some((f) => !GENERIC_SECURITY_BOILERPLATE.test(f.trim()));
}

function isRequirementsFitCovered(alt: ArchitectureAlternativeAnalysis, hardDriverIds: readonly string[]): boolean {
  if (alt.driver_evaluations.length === 0) return false;
  const evaluatedIds = new Set(alt.driver_evaluations.map((e) => e.driver_id));
  return hardDriverIds.every((id) => evaluatedIds.has(id));
}

function isTradeOffsCovered(alt: ArchitectureAlternativeAnalysis): boolean {
  return alt.benefits.length >= 1 && alt.disadvantages.length >= 1;
}

function isCostCovered(alt: ArchitectureAlternativeAnalysis): boolean {
  const c = alt.cost;
  return c.implementation_cost !== "UNKNOWN" || c.ongoing_operational_cost !== "UNKNOWN" || c.migration_or_exit_cost !== "UNKNOWN" || c.cost_drivers.length >= 1;
}

function isOperationsCovered(alt: ArchitectureAlternativeAnalysis): boolean {
  const o = alt.operations;
  return (
    o.deployment_complexity !== "UNKNOWN" ||
    o.operator_burden !== "UNKNOWN" ||
    o.observability_notes.length >= 1 ||
    o.backup_recovery_notes.length >= 1 ||
    o.failure_handling_notes.length >= 1
  );
}

function isReversibilityCovered(alt: ArchitectureAlternativeAnalysis): boolean {
  return alt.reversibility.migration_path.trim().length > 0 && alt.reversibility.reversibility !== "UNKNOWN";
}

function countCanonicalDimensions(alt: ArchitectureAlternativeAnalysis, hardDriverIds: readonly string[]): number {
  let count = 0;
  if (isRequirementsFitCovered(alt, hardDriverIds)) count += 1;
  if (isTradeOffsCovered(alt)) count += 1;
  if (alt.failure_modes.length >= 1) count += 1;
  if (isCostCovered(alt)) count += 1;
  if (isOperationsCovered(alt)) count += 1;
  if (hasArchitectureSpecificSecurity(alt.security)) count += 1;
  if (isReversibilityCovered(alt)) count += 1;
  return count;
}

const CANONICAL_DIMENSION_COUNT = 7;

export function computeSoftwareArchitectureComparisonMetrics(
  result: SoftwareArchitectureDecisionResult,
  input: SoftwareArchitectureInput,
  groundTruth: SoftwareArchitectureFixtureGroundTruth = {},
): SoftwareArchitectureComparisonMetrics {
  const decisionDrivers = result.decision_drivers;
  const hardDriverList = hardDrivers(decisionDrivers);
  const hardDriverIds = hardDriverList.map((d) => d.id);
  const alternatives = result.alternatives;
  const resolvable = computeResolvableEvidenceRefs(input, decisionDrivers);

  const canonical_dimension_coverage_ratio =
    alternatives.length === 0 ? 1 : alternatives.reduce((sum, alt) => sum + countCanonicalDimensions(alt, hardDriverIds), 0) / (CANONICAL_DIMENSION_COUNT * alternatives.length);

  const hardPairsTotal = hardDriverList.length * alternatives.length;
  const hardPairsCovered = alternatives.reduce(
    (sum, alt) => sum + hardDriverList.filter((hd) => alt.driver_evaluations.some((e) => e.driver_id === hd.id)).length,
    0,
  );
  const hard_constraint_coverage_ratio = hardPairsTotal === 0 ? 1 : hardPairsCovered / hardPairsTotal;

  const alternative_balance_ratio = alternatives.length === 0 ? 1 : alternatives.filter(isTradeOffsCovered).length / alternatives.length;

  const failureModeGroundTruth = groundTruth.expected_material_failure_mode_count_by_alternative;
  let failure_mode_coverage_ratio: number;
  if (failureModeGroundTruth && Object.keys(failureModeGroundTruth).length > 0) {
    const altById = new Map(alternatives.map((a) => [a.id, a]));
    let numerator = 0;
    let denominator = 0;
    for (const [altId, expected] of Object.entries(failureModeGroundTruth)) {
      const actual = altById.get(altId)?.failure_modes.length ?? 0;
      numerator += Math.min(actual, expected);
      denominator += expected;
    }
    failure_mode_coverage_ratio = denominator === 0 ? 1 : numerator / denominator;
  } else {
    failure_mode_coverage_ratio = 1;
  }

  const hardEvidencePairsCovered = alternatives.reduce(
    (sum, alt) =>
      sum +
      hardDriverList.filter((hd) => {
        const refs = alt.driver_evaluations.find((e) => e.driver_id === hd.id)?.evidence_refs ?? [];
        return refs.length >= 1 && refs.every((ref) => resolvable.has(ref));
      }).length,
    0,
  );
  const evidence_traceability_ratio = hardPairsTotal === 0 ? 1 : hardEvidencePairsCovered / hardPairsTotal;

  const totalAssumptions = alternatives.reduce((sum, alt) => sum + alt.assumptions.length, 0);
  const expectedAssumptions = groundTruth.expected_assumption_count;
  const assumption_visibility_ratio =
    expectedAssumptions === undefined ? 1 : expectedAssumptions === 0 ? 1 : Math.min(1, totalAssumptions / expectedAssumptions);

  const security_dimension_coverage_ratio = alternatives.length === 0 ? 1 : alternatives.filter((a) => hasArchitectureSpecificSecurity(a.security)).length / alternatives.length;

  const recommendedId = result.recommended_alternative_id;
  const recommended = recommendedId === null ? null : alternatives.find((a) => a.id === recommendedId) ?? null;

  let unsupported_recommendation_count = 0;
  if (recommendedId !== null) {
    if (!recommended || recommended.benefits.length === 0) unsupported_recommendation_count += 1;
    if (result.decision_status === "READY_FOR_HUMAN_APPROVAL") {
      if (alternatives.length < 2) {
        unsupported_recommendation_count += 1;
      }
      for (const alt of alternatives) {
        if (alt.id === recommendedId) continue;
        const rejection = result.rejected_alternative_reasons.find((r) => r.alternative_id === alt.id);
        if (!rejection || rejection.reasons.length === 0) unsupported_recommendation_count += 1;
      }
      if (recommended && recommended.evidence_refs.length === 0 && recommended.assumptions.length === 0) {
        unsupported_recommendation_count += 1;
      }
    }
  }
  if (result.decision_status === "READY_FOR_HUMAN_APPROVAL" && !result.recommendation_summary?.trim()) {
    unsupported_recommendation_count += 1;
  }

  let hard_constraint_violation_count = 0;
  if (recommendedId !== null) {
    if (!recommended) {
      hard_constraint_violation_count = 1;
    } else {
      const violated = hardDriverList.some((hd) => {
        const truth = groundTruth.true_hard_constraint_fit_by_alternative?.[recommendedId]?.[hd.id];
        const selfReported = recommended.driver_evaluations.find((e) => e.driver_id === hd.id)?.fit;
        return (truth ?? selfReported ?? "UNKNOWN") === "FAIL";
      });
      hard_constraint_violation_count = violated ? 1 : 0;
    }
  }

  return {
    canonical_dimension_coverage_ratio,
    hard_constraint_coverage_ratio,
    alternative_balance_ratio,
    failure_mode_coverage_ratio,
    evidence_traceability_ratio,
    assumption_visibility_ratio,
    security_dimension_coverage_ratio,
    unsupported_recommendation_count,
    hard_constraint_violation_count,
  };
}

export function compareSoftwareArchitectureRuns(
  baseline: SoftwareArchitectureDecisionResult,
  skill: SoftwareArchitectureDecisionResult,
  input: SoftwareArchitectureInput,
  groundTruth: SoftwareArchitectureFixtureGroundTruth = {},
): SoftwareArchitectureComparison {
  return {
    baseline: computeSoftwareArchitectureComparisonMetrics(baseline, input, groundTruth),
    skill: computeSoftwareArchitectureComparisonMetrics(skill, input, groundTruth),
  };
}
