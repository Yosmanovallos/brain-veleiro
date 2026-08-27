import type { StructuredAgentOutput } from "../../core/agent/index.js";
import type {
  ArchitectureAlternativeAnalysis,
  ArchitectureDecisionDriver,
  ArchitectureFailureMode,
  SoftwareArchitectureDecisionResult,
  SoftwareArchitectureInput,
} from "./types.js";

/**
 * Deterministic S13D SoftwareArchitectureDecisionResult validation.
 *
 * Implements brain-bootstrap/specs/SOFTWARE_ARCHITECTURE_AGENT_v1.md sections
 * 9-21 and brain-bootstrap/skills/SOFTWARE_ARCHITECTURE_SKILL_S13D.md
 * sections 11-19 (hard-constraint coverage/violation, alternative count and
 * balance, failure-mode structure, ADR PROPOSED/approval_required semantics,
 * unresolved-critical-gap-prevents-readiness). This validator checks the
 * OUTPUT's own internal structural completeness and self-consistency — it
 * has no access to, and does not need, any external ground truth about which
 * alternative "truly" violates a constraint: a result that never evaluates
 * its hard constraints for the recommended alternative fails T14 (missing
 * coverage) even before T15 (no self-reported FAIL) is checked, so a result
 * cannot escape strictness merely by omitting the evaluations it is
 * required to report.
 */

const VALID_DECISION_STATUS = new Set(["READY_FOR_HUMAN_APPROVAL", "NEEDS_MORE_EVIDENCE", "BLOCKED"]);
const VALID_FIT = new Set(["STRONG", "ACCEPTABLE", "WEAK", "FAIL", "UNKNOWN"]);
const VALID_RELATIVE_LEVEL = new Set(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);
const VALID_RISK = new Set(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);
const VALID_ASSUMPTION_RISK = new Set(["HIGH", "MEDIUM", "LOW"]);
const MIN_ALTERNATIVES = 2;
const MAX_ALTERNATIVES = 4;

const CANONICAL_MARKDOWN_SECTIONS = [
  "## Status",
  "## Context",
  "## Decision Drivers",
  "## Alternatives Considered",
  "## Decision",
  "## Rationale",
  "## Consequences",
  "### Positive",
  "### Negative",
  "## Failure Modes",
  "## Cost",
  "## Operations",
  "## Security",
  "## Evidence",
  "## Assumptions",
  "## Open Questions",
  "## Approval",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Exported so ./compareSoftwareArchitectureRuns.ts can score the exact same
 * notion of "hard constraint" the validator enforces — they must never drift
 * apart (mirrors S13C's countSupportingIndependenceGroups sharing pattern).
 */
export function hardDrivers(decisionDrivers: readonly ArchitectureDecisionDriver[]): ArchitectureDecisionDriver[] {
  return decisionDrivers.filter((d) => d.hard);
}

function evaluationFor(alt: ArchitectureAlternativeAnalysis, driverId: string) {
  return alt.driver_evaluations.find((e) => e.driver_id === driverId);
}

/**
 * The universe of evidence refs a result is allowed to cite (T21): S13B
 * KnowledgeGapAnalysisResult item ids, declared decision_driver ids and their
 * source_refs, and — when S13C deep_research is supplied — every S11
 * evidence_ref surfaced by its findings/contradictions. A ref outside this
 * universe cannot be traced back to anything the run actually had access to,
 * so it does not count as evidence (mirrors S13B's mandatory contextFacts
 * validation parameter).
 */
export function computeResolvableEvidenceRefs(
  input: SoftwareArchitectureInput,
  decisionDrivers: readonly ArchitectureDecisionDriver[],
): Set<string> {
  const refs = new Set<string>();
  for (const item of input.knowledge_gap_analysis.items) refs.add(item.id);
  for (const driver of decisionDrivers) {
    refs.add(driver.id);
    for (const ref of driver.source_refs) refs.add(ref);
  }
  for (const item of input.deep_research?.items ?? []) {
    for (const finding of item.research.findings) {
      for (const evidence of finding.evidence) refs.add(evidence.evidence_ref);
    }
    for (const contradiction of item.research.contradictions) {
      for (const ref of contradiction.evidence_refs) refs.add(ref);
    }
  }
  return refs;
}

function checkRefsResolvable(refs: readonly string[], resolvable: Set<string>, ctx: string, errors: string[]): void {
  for (const ref of refs) {
    if (!resolvable.has(ref)) {
      errors.push(`${ctx} cites unresolvable evidence ref '${ref}' — not an S13B item id, declared driver id/source_ref, or S13C evidence_ref (T21)`);
    }
  }
}

function validateFailureMode(fm: ArchitectureFailureMode, ctx: string, errors: string[]): void {
  if (!isNonEmptyString(fm.scenario)) errors.push(`${ctx}.scenario must be a non-empty string (SA-R8)`);
  if (!isNonEmptyString(fm.trigger)) errors.push(`${ctx}.trigger must be a non-empty string (SA-R8)`);
  if (!isNonEmptyString(fm.impact)) errors.push(`${ctx}.impact must be a non-empty string (SA-R8)`);
  if (!isNonEmptyString(fm.observable_symptom)) errors.push(`${ctx}.observable_symptom must be a non-empty string (SA-R8)`);
  if (!isNonEmptyString(fm.mitigation_or_containment)) errors.push(`${ctx}.mitigation_or_containment must be a non-empty string ('UNKNOWN' is valid) (SA-R8)`);
  if (!VALID_RISK.has(fm.residual_risk)) errors.push(`${ctx}.residual_risk must be HIGH | MEDIUM | LOW | UNKNOWN`);
}

function validateAlternative(
  alt: ArchitectureAlternativeAnalysis,
  decisionDrivers: readonly ArchitectureDecisionDriver[],
  resolvable: Set<string>,
  ctx: string,
  errors: string[],
): void {
  if (!isNonEmptyString(alt.id)) errors.push(`${ctx}.id must be a non-empty string`);
  if (alt.origin !== "PROVIDED" && alt.origin !== "GENERATED") errors.push(`${ctx}.origin must be PROVIDED or GENERATED (SA-R2)`);

  for (const hd of hardDrivers(decisionDrivers)) {
    const evaluation = evaluationFor(alt, hd.id);
    if (!evaluation) {
      errors.push(`${ctx}: missing driver_evaluations entry for hard constraint '${hd.id}' (SA-R5, T14)`);
      continue;
    }
    if (!VALID_FIT.has(evaluation.fit)) errors.push(`${ctx}.driver_evaluations[${hd.id}].fit must be a valid ArchitectureFit`);
    checkRefsResolvable(evaluation.evidence_refs, resolvable, `${ctx}.driver_evaluations[${hd.id}].evidence_refs`, errors);
  }

  checkRefsResolvable(alt.evidence_refs, resolvable, `${ctx}.evidence_refs`, errors);
  checkRefsResolvable(alt.security.evidence_refs, resolvable, `${ctx}.security.evidence_refs`, errors);

  if (!(alt.benefits.length >= 1 && alt.disadvantages.length >= 1)) {
    const explainedOneSided = [...alt.cost.limitations, ...alt.operations.limitations, ...alt.reversibility.limitations].some((l) =>
      /no (material )?(benefit|disadvantage)/i.test(l),
    );
    if (!explainedOneSided) {
      errors.push(`${ctx}: must include at least one benefit and one disadvantage, or explicitly explain why one side is empty (SA-R7, T16)`);
    }
  }

  for (const [i, fm] of alt.failure_modes.entries()) {
    validateFailureMode(fm, `${ctx}.failure_modes[${i}]`, errors);
  }

  if (!alt.cost || !alt.operations || !alt.security || !alt.reversibility) {
    errors.push(`${ctx}: cost, operations, security, and reversibility must all be present as separate decision dimensions (SA-V5)`);
  } else {
    for (const level of [alt.cost.implementation_cost, alt.cost.ongoing_operational_cost, alt.cost.migration_or_exit_cost]) {
      if (!VALID_RELATIVE_LEVEL.has(level)) errors.push(`${ctx}.cost contains an invalid relative level '${String(level)}' (SA-R10)`);
    }
    for (const level of [alt.operations.deployment_complexity, alt.operations.operator_burden]) {
      if (!VALID_RELATIVE_LEVEL.has(level)) errors.push(`${ctx}.operations contains an invalid relative level '${String(level)}'`);
    }
    if (!VALID_RELATIVE_LEVEL.has(alt.reversibility.reversibility)) {
      errors.push(`${ctx}.reversibility.reversibility must be a valid relative level`);
    }
  }

  for (const [i, assumption] of alt.assumptions.entries()) {
    if (!isNonEmptyString(assumption.statement)) errors.push(`${ctx}.assumptions[${i}].statement must be a non-empty string (SA-R16)`);
    if (!VALID_ASSUMPTION_RISK.has(assumption.risk)) errors.push(`${ctx}.assumptions[${i}].risk must be HIGH | MEDIUM | LOW`);
  }
}

export interface SoftwareArchitectureResultValidation {
  valid: boolean;
  errors: string[];
}

export function validateSoftwareArchitectureResult(
  result: SoftwareArchitectureDecisionResult,
  input: SoftwareArchitectureInput,
): SoftwareArchitectureResultValidation {
  const errors: string[] = [];

  if (!isNonEmptyString(result?.architecture_question)) errors.push("architecture_question must be a non-empty string");
  if (!VALID_DECISION_STATUS.has(result?.decision_status)) {
    errors.push("decision_status must be READY_FOR_HUMAN_APPROVAL | NEEDS_MORE_EVIDENCE | BLOCKED");
  }

  const decisionDrivers = result?.decision_drivers ?? [];
  const alternatives = result?.alternatives ?? [];
  const status = result?.decision_status;
  const resolvable = computeResolvableEvidenceRefs(input, decisionDrivers);

  if (status !== "BLOCKED" && decisionDrivers.length === 0) {
    errors.push("decision_drivers must declare at least one driver unless decision_status is BLOCKED — a result cannot claim readiness while evaluating no constraints (SA-R3)");
  }
  if (status === "READY_FOR_HUMAN_APPROVAL" && hardDrivers(decisionDrivers).length === 0) {
    errors.push("decision_status cannot be READY_FOR_HUMAN_APPROVAL while decision_drivers declares zero hard constraints (SA-R3, SA-R5)");
  }

  if (status !== "BLOCKED") {
    if (alternatives.length < MIN_ALTERNATIVES || alternatives.length > MAX_ALTERNATIVES) {
      errors.push(`alternatives.length must be between ${MIN_ALTERNATIVES} and ${MAX_ALTERNATIVES} unless decision_status is BLOCKED, got ${alternatives.length} (SA-R1, T13)`);
    }
  }
  if (hasDuplicates(alternatives.map((a) => a.id))) errors.push("alternatives ids must be unique (T13)");

  for (const [i, alt] of alternatives.entries()) {
    validateAlternative(alt, decisionDrivers, resolvable, `alternatives[${i}] (${alt?.id ?? "?"})`, errors);
  }

  const recommendedId = result?.recommended_alternative_id ?? null;

  if (status === "NEEDS_MORE_EVIDENCE" && recommendedId !== null) {
    errors.push("NEEDS_MORE_EVIDENCE must report recommended_alternative_id: null for deterministic verification (Skill file section 14)");
  }
  if (status === "BLOCKED" && recommendedId !== null) {
    errors.push("BLOCKED must report recommended_alternative_id: null");
  }

  if (recommendedId !== null) {
    const recommended = alternatives.find((a) => a.id === recommendedId);
    if (!recommended) {
      errors.push(`recommended_alternative_id '${recommendedId}' does not match any entry in alternatives`);
    } else {
      for (const hd of hardDrivers(decisionDrivers)) {
        const evaluation = evaluationFor(recommended, hd.id);
        if (evaluation?.fit === "FAIL") {
          errors.push(`recommended alternative '${recommendedId}' has an unresolved hard-constraint FAIL on '${hd.id}' (SA-R6, T15)`);
        }
      }
      if (recommended.benefits.length === 0) {
        errors.push(`recommended alternative '${recommendedId}' has zero benefits — recommendation is unsupported`);
      }
      if (status === "READY_FOR_HUMAN_APPROVAL") {
        for (const alt of alternatives) {
          if (alt.id === recommendedId) continue;
          const rejection = result.rejected_alternative_reasons.find((r) => r.alternative_id === alt.id);
          if (!rejection || rejection.reasons.length === 0) {
            errors.push(`rejected_alternative_reasons is missing a non-empty entry for non-selected alternative '${alt.id}' (SA-R19, T16)`);
          }
        }
      }
    }
  }

  if (status === "READY_FOR_HUMAN_APPROVAL") {
    if (!isNonEmptyString(result?.recommendation_summary)) {
      errors.push("recommendation_summary must be a non-empty string when decision_status is READY_FOR_HUMAN_APPROVAL");
    }
    const unresolvedCritical = (result?.unresolved_decision_gaps ?? []).some((g) => g.decision_impact === "DECISION_CRITICAL");
    if (unresolvedCritical) {
      errors.push("decision_status cannot be READY_FOR_HUMAN_APPROVAL while an unresolved DECISION_CRITICAL gap remains (SA-R15, T22)");
    }
  }

  const adr = result?.adr;
  if (!adr) {
    errors.push("adr is required");
  } else {
    if (adr.status !== "PROPOSED") errors.push(`adr.status must be 'PROPOSED', got '${String(adr.status)}' (SA-R21, T23)`);
    if (adr.approval_required !== true) errors.push("adr.approval_required must be true (SA-R21, T23)");
    checkRefsResolvable(adr.evidence_refs, resolvable, "adr.evidence_refs", errors);
  }

  if (!isNonEmptyString(result?.adr_markdown)) {
    errors.push("adr_markdown must be a non-empty string (SA-R23)");
  } else {
    for (const section of CANONICAL_MARKDOWN_SECTIONS) {
      if (!result.adr_markdown.includes(section)) {
        errors.push(`adr_markdown is missing canonical section '${section}' (Skill file section 19, T24)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * StructuredAgentOutput mapping (Agent spec / Skill file section 18):
 * evidence_refs is the deterministic, de-duplicated, first-occurrence-order
 * union of decision_drivers[*].source_refs, alternatives[*].evidence_refs,
 * alternatives[*].driver_evaluations[*].evidence_refs,
 * alternatives[*].security.evidence_refs, and adr.evidence_refs. Generated
 * alternative IDs are never treated as evidence refs.
 */
export function mapSoftwareArchitectureResultToStructuredOutput(result: SoftwareArchitectureDecisionResult): StructuredAgentOutput {
  const seen = new Set<string>();
  const evidence_refs: string[] = [];
  const record = (ref: string) => {
    if (!seen.has(ref)) {
      seen.add(ref);
      evidence_refs.push(ref);
    }
  };

  for (const driver of result.decision_drivers) {
    for (const ref of driver.source_refs) record(ref);
  }
  for (const alt of result.alternatives) {
    for (const ref of alt.evidence_refs) record(ref);
    for (const evaluation of alt.driver_evaluations) {
      for (const ref of evaluation.evidence_refs) record(ref);
    }
    for (const ref of alt.security.evidence_refs) record(ref);
  }
  for (const ref of result.adr.evidence_refs) record(ref);

  return {
    summary: result.recommendation_summary,
    data: result as unknown as Record<string, unknown>,
    evidence_refs,
  };
}
