import type { StructuredAgentOutput } from "../../core/agent/index.js";
import type {
  Confidence,
  ContradictionResolution,
  EpistemicStatus,
  EvidenceItem,
  EvidenceRelationship,
  FindingCriticality,
  GapClass,
  ResearchResult,
  ResearchStatusState,
  SourceType,
} from "./types.js";

/**
 * Deterministic S11 ResearchResult validation.
 *
 * Implements brain-bootstrap/specs/RESEARCHER_AGENT_v1.md section 10 (the
 * "material claim acceptance invariant" — S11's primary mechanical
 * invariant) plus the structural completeness rules implied by sections 7-9.
 *
 * This validator does not consume or produce a runtime TerminalOutcome; it
 * validates the `ResearchResult` value carried inside StructuredAgentOutput.data.
 * S09's TerminalOutcome and StructuredAgentOutput remain untouched.
 */

const VALID_GAP_CLASSES = new Set<GapClass>(["DECISION_CRITICAL", "DECISION_RELEVANT", "CONTEXTUAL", "TRIVIA"]);
const VALID_FINDING_CRITICALITY = new Set<FindingCriticality>(["DECISION_CRITICAL", "DECISION_RELEVANT", "CONTEXTUAL"]);
const VALID_EPISTEMIC_STATUS = new Set<EpistemicStatus>(["EVIDENCED", "INFERENCE", "UNCERTAIN"]);
const VALID_CONFIDENCE = new Set<Confidence>(["HIGH", "MEDIUM", "LOW"]);
const VALID_SOURCE_TYPE = new Set<SourceType>(["PRIMARY", "SECONDARY", "DIRECT_OBSERVATION", "OTHER"]);
const VALID_RELATIONSHIP = new Set<EvidenceRelationship>(["SUPPORTS", "CONTRADICTS", "QUALIFIES"]);
const VALID_RESOLUTION = new Set<ContradictionResolution>(["RESOLVED", "UNRESOLVED", "NOT_DECISION_RELEVANT"]);
const VALID_RESEARCH_STATUS_STATE = new Set<ResearchStatusState>([
  "SATISFIED",
  "EXHAUSTED_WITH_UNCERTAINTY",
  "MORE_RESEARCH_NEEDED",
]);

export interface ResearchResultValidation {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateEvidenceItem(evidence: EvidenceItem, context: string, errors: string[]): void {
  if (!isNonEmptyString(evidence.evidence_ref)) errors.push(`${context}.evidence_ref must be a non-empty string`);
  if (!isNonEmptyString(evidence.source_ref)) errors.push(`${context}.source_ref must be a non-empty string`);
  if (!isNonEmptyString(evidence.source_title)) errors.push(`${context}.source_title must be a non-empty string`);
  if (!VALID_SOURCE_TYPE.has(evidence.source_type)) errors.push(`${context}.source_type is invalid`);
  if (!isNonEmptyString(evidence.authority)) errors.push(`${context}.authority must be a non-empty string`);
  if (!isNonEmptyString(evidence.independence_group)) errors.push(`${context}.independence_group must be a non-empty string`);
  if (!isNonEmptyString(evidence.observed_or_published_at)) {
    errors.push(`${context}.observed_or_published_at must be a non-empty string`);
  }
  if (!isNonEmptyString(evidence.locator)) errors.push(`${context}.locator must be a non-empty string`);
  if (!VALID_RELATIONSHIP.has(evidence.relationship)) errors.push(`${context}.relationship is invalid`);
}

export function validateResearchResult(result: ResearchResult): ResearchResultValidation {
  const errors: string[] = [];

  if (!isNonEmptyString(result?.question)) {
    errors.push("question must be a non-empty string");
  }

  const subquestions = result?.subquestions ?? [];
  for (const [i, sub] of subquestions.entries()) {
    const ctx = `subquestions[${i}]`;
    if (!isNonEmptyString(sub.id)) errors.push(`${ctx}.id must be a non-empty string`);
    if (!isNonEmptyString(sub.question)) errors.push(`${ctx}.question must be a non-empty string`);
    if (!VALID_GAP_CLASSES.has(sub.gap_class)) errors.push(`${ctx}.gap_class is invalid`);
    if (!isNonEmptyString(sub.why_it_matters)) errors.push(`${ctx}.why_it_matters must be a non-empty string`);
    if (!isNonEmptyString(sub.decision_affected)) errors.push(`${ctx}.decision_affected must be a non-empty string`);
  }

  const findings = result?.findings ?? [];
  for (const [i, finding] of findings.entries()) {
    const ctx = `findings[${i}]`;
    if (!isNonEmptyString(finding.id)) errors.push(`${ctx}.id must be a non-empty string`);
    if (!isNonEmptyString(finding.claim)) errors.push(`${ctx}.claim must be a non-empty string`);
    if (!VALID_FINDING_CRITICALITY.has(finding.criticality)) errors.push(`${ctx}.criticality is invalid`);
    if (!VALID_EPISTEMIC_STATUS.has(finding.epistemic_status)) errors.push(`${ctx}.epistemic_status is invalid`);
    if (!VALID_CONFIDENCE.has(finding.confidence)) errors.push(`${ctx}.confidence is invalid`);
    if (!Array.isArray(finding.limitations)) errors.push(`${ctx}.limitations must be an array`);
    if (!Array.isArray(finding.evidence)) {
      errors.push(`${ctx}.evidence must be an array`);
    } else {
      finding.evidence.forEach((ev, j) => validateEvidenceItem(ev, `${ctx}.evidence[${j}]`, errors));
    }

    // Section 10 — material claim acceptance invariant. This is S11's
    // primary mechanical invariant: it applies specifically to
    // DECISION_CRITICAL findings, per the contract.
    if (finding.criticality === "DECISION_CRITICAL") {
      const evidenceCount = Array.isArray(finding.evidence) ? finding.evidence.length : 0;
      const limitationsCount = Array.isArray(finding.limitations) ? finding.limitations.length : 0;

      const pathA = finding.epistemic_status === "EVIDENCED" && evidenceCount >= 1;
      const pathB = finding.epistemic_status === "INFERENCE" && limitationsCount >= 1;
      const pathC = finding.epistemic_status === "UNCERTAIN" && limitationsCount >= 1;

      if (!(pathA || pathB || pathC)) {
        errors.push(
          `${ctx} is DECISION_CRITICAL but satisfies none of the required paths (EVIDENCED+evidence, ` +
            "INFERENCE+limitations, or UNCERTAIN+limitations) — an unsupported critical claim is forbidden",
        );
      }
    }
  }

  const contradictions = result?.contradictions ?? [];
  for (const [i, c] of contradictions.entries()) {
    const ctx = `contradictions[${i}]`;
    if (!isNonEmptyString(c.topic)) errors.push(`${ctx}.topic must be a non-empty string`);
    if (!isNonEmptyString(c.description)) errors.push(`${ctx}.description must be a non-empty string`);
    if (!Array.isArray(c.claim_refs)) errors.push(`${ctx}.claim_refs must be an array`);
    if (!Array.isArray(c.evidence_refs) || c.evidence_refs.length === 0) {
      errors.push(`${ctx}.evidence_refs must be a non-empty array`);
    }
    if (!VALID_RESOLUTION.has(c.resolution)) errors.push(`${ctx}.resolution is invalid`);
    if (!Array.isArray(c.limitations)) errors.push(`${ctx}.limitations must be an array`);
  }

  const unknowns = result?.unknowns ?? [];
  for (const [i, u] of unknowns.entries()) {
    const ctx = `unknowns[${i}]`;
    if (!isNonEmptyString(u.question)) errors.push(`${ctx}.question must be a non-empty string`);
    if (!VALID_FINDING_CRITICALITY.has(u.gap_class)) errors.push(`${ctx}.gap_class is invalid`);
    if (!isNonEmptyString(u.reason_unresolved)) errors.push(`${ctx}.reason_unresolved must be a non-empty string`);
    if (!isNonEmptyString(u.decision_impact)) errors.push(`${ctx}.decision_impact must be a non-empty string`);
  }

  const status = result?.research_status;
  if (!status || !VALID_RESEARCH_STATUS_STATE.has(status.state)) {
    errors.push("research_status.state is invalid");
  }
  if (!status || !isNonEmptyString(status.reason)) {
    errors.push("research_status.reason must be a non-empty string");
  }
  if (!status || !Array.isArray(status.unresolved_decision_critical_gaps)) {
    errors.push("research_status.unresolved_decision_critical_gaps must be an array");
  }
  if (!status || typeof status.additional_research_expected_to_change_decision !== "boolean") {
    errors.push("research_status.additional_research_expected_to_change_decision must be a boolean");
  }

  if (!isNonEmptyString(result?.decision_relevant_summary)) {
    errors.push("decision_relevant_summary must be a non-empty string");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * RESEARCHER_AGENT_v1.md section 9 — exact StructuredAgentOutput mapping.
 *
 * summary = result.decision_relevant_summary
 * data = result
 * evidence_refs = deterministic de-duplicated first-occurrence union of
 *   findings[*].evidence[*].evidence_ref + contradictions[*].evidence_refs[*]
 *
 * This does not redefine StructuredAgentOutput — it only constructs a value
 * that conforms to the existing S09 shape.
 */
export function mapResearchResultToStructuredOutput(result: ResearchResult): StructuredAgentOutput {
  const seen = new Set<string>();
  const evidence_refs: string[] = [];

  const record = (ref: string) => {
    if (!seen.has(ref)) {
      seen.add(ref);
      evidence_refs.push(ref);
    }
  };

  for (const finding of result.findings) {
    for (const evidence of finding.evidence) {
      record(evidence.evidence_ref);
    }
  }
  for (const contradiction of result.contradictions) {
    for (const ref of contradiction.evidence_refs) {
      record(ref);
    }
  }

  return {
    summary: result.decision_relevant_summary,
    data: result as unknown as Record<string, unknown>,
    evidence_refs,
  };
}
