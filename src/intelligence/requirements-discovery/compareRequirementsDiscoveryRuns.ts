import type { RequirementsDiscoveryResult } from "./types.js";

/**
 * Deterministic Skill-vs-baseline comparison metrics.
 *
 * Implements brain-bootstrap/specs/REQUIREMENTS_DISCOVERY_AGENT_v1.md
 * sections 15-16. Both the baseline and Skill-assisted `RequirementsDiscoveryResult`
 * values passed in here MUST already have been produced by real runs through
 * the identical compileAgentDefinition()/runAgent() path (see
 * tests/requirements-discovery/requirementsDiscovery.test.ts) — this module
 * only scores results, it never constructs or fabricates one.
 */

export interface RequirementsDiscoveryMetrics {
  required_section_coverage: number;
  explicit_traceability_count: number;
  unknown_capture_count: number;
  assumption_visibility_count: number;
  acceptance_linkage_ratio: number;
  acceptance_testability_ratio: number;
  fabricated_fact_count: number;
  unmarked_assumption_count: number;
}

export interface RequirementsDiscoveryComparison {
  baseline: RequirementsDiscoveryMetrics;
  skill: RequirementsDiscoveryMetrics;
}

/**
 * T17's canonical forbidden-fact watchlist (REQUIREMENTS_DISCOVERY_AGENT_v1.md
 * section 18 / REQUIREMENTS_DISCOVERY_SKILL_S13A.md section 12). A term counts
 * as fabricated only if it appears in the result's text but not in the raw
 * request itself — a client who genuinely asked for React would not be
 * penalized for the result mentioning React.
 */
const FABRICATION_WATCHLIST = [
  "react",
  "postgresql",
  "postgres",
  "30-day",
  "30 días",
  "30 dias",
  "10,000",
  "10000 usuarios",
  "10,000 usuarios",
  "payments",
  "pagos en línea",
  "procesar pagos",
  "store managers",
  "gerentes de tienda",
  "retail customers",
  "clientes minoristas",
];

function collectStrings(value: unknown, acc: string[]): void {
  if (typeof value === "string") acc.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, acc);
  else if (value && typeof value === "object") for (const v of Object.values(value)) collectStrings(v, acc);
}

function countFabricatedFacts(result: RequirementsDiscoveryResult, rawRequest: string): number {
  const strings: string[] = [];
  collectStrings(result, strings);
  const resultText = strings.join(" \n ").toLowerCase();
  const requestText = rawRequest.toLowerCase();

  let count = 0;
  for (const term of FABRICATION_WATCHLIST) {
    if (resultText.includes(term) && !requestText.includes(term)) {
      count += 1;
    }
  }
  return count;
}

function countRequiredSectionCoverage(result: RequirementsDiscoveryResult): number {
  let covered = 0;
  if (result.goals.length >= 1) covered += 1;
  if (result.users.length >= 1) covered += 1;
  if (result.unknowns.length >= 1) covered += 1;
  if (result.assumptions.length >= 1) covered += 1;
  if (result.constraints.length >= 1) covered += 1;
  if (result.acceptance_criteria.length >= 1) covered += 1;
  if (result.handoff && typeof result.handoff.ready_for_gap_analysis === "boolean") covered += 1;
  return covered;
}

function countExplicitTraceability(result: RequirementsDiscoveryResult): number {
  let count = 0;
  for (const goal of result.goals) {
    if (goal.origin === "EXPLICIT" && goal.source_excerpt.trim().length > 0) count += 1;
  }
  for (const user of result.users) {
    if (user.origin === "EXPLICIT" && user.source_excerpt.trim().length > 0) count += 1;
  }
  for (const constraint of result.constraints) {
    if (constraint.origin === "EXPLICIT" && constraint.source_excerpt.trim().length > 0) count += 1;
  }
  return count;
}

function countUnmarkedAssumptions(result: RequirementsDiscoveryResult): number {
  let count = 0;
  for (const assumption of result.assumptions) {
    const hasRationale = assumption.rationale.trim().length > 0;
    const hasValidRisk = assumption.risk === "HIGH" || assumption.risk === "MEDIUM" || assumption.risk === "LOW";
    const hasValidMustValidate = typeof assumption.must_validate === "boolean";
    if (!hasRationale || !hasValidRisk || !hasValidMustValidate) count += 1;
  }
  return count;
}

function computeAcceptanceLinkageRatio(result: RequirementsDiscoveryResult): number {
  const total = result.acceptance_criteria.length;
  if (total === 0) return 0;
  const goalIds = new Set(result.goals.map((g) => g.id));
  const linked = result.acceptance_criteria.filter(
    (c) => c.linked_goal_ids.length >= 1 && c.linked_goal_ids.every((id) => goalIds.has(id)),
  ).length;
  return linked / total;
}

/**
 * REQUIREMENTS_DISCOVERY_SKILL_S13A.md section 9 states testable ==
 * true / verification_hint non-empty as one paired rule for what counts as a
 * genuinely testable criterion — `testable: true` alone (with an empty
 * verification_hint) is not sufficient to actually verify the criterion.
 */
function computeAcceptanceTestabilityRatio(result: RequirementsDiscoveryResult): number {
  const total = result.acceptance_criteria.length;
  if (total === 0) return 0;
  const testable = result.acceptance_criteria.filter(
    (c) => c.testable === true && c.verification_hint.trim().length > 0,
  ).length;
  return testable / total;
}

export function computeRequirementsDiscoveryMetrics(
  result: RequirementsDiscoveryResult,
  rawRequest: string,
): RequirementsDiscoveryMetrics {
  return {
    required_section_coverage: countRequiredSectionCoverage(result),
    explicit_traceability_count: countExplicitTraceability(result),
    unknown_capture_count: result.unknowns.length,
    assumption_visibility_count: result.assumptions.length,
    acceptance_linkage_ratio: computeAcceptanceLinkageRatio(result),
    acceptance_testability_ratio: computeAcceptanceTestabilityRatio(result),
    fabricated_fact_count: countFabricatedFacts(result, rawRequest),
    unmarked_assumption_count: countUnmarkedAssumptions(result),
  };
}

export function compareRequirementsDiscoveryRuns(
  baseline: RequirementsDiscoveryResult,
  skill: RequirementsDiscoveryResult,
  rawRequest: string,
): RequirementsDiscoveryComparison {
  return {
    baseline: computeRequirementsDiscoveryMetrics(baseline, rawRequest),
    skill: computeRequirementsDiscoveryMetrics(skill, rawRequest),
  };
}
