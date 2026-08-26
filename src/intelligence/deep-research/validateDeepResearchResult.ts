import type { StructuredAgentOutput } from "../../core/agent/index.js";
import type { EvidenceItem, Finding } from "../research/types.js";
import { validateResearchResult } from "../research/validateResearchResult.js";
import type { DeepResearchBatchResult, DeepResearchBatchStatus, DeepResearchItemResult, S13CRecommendedClosureState } from "./types.js";

/**
 * Deterministic S13C DeepResearchBatchResult validation.
 *
 * Implements brain-bootstrap/specs/DEEP_RESEARCH_AGENT_v1.md sections 6,
 * 9-12, 16 (batch/selection consistency, DEEP source-floor validator,
 * closure recommendation mapping) plus the recency rule from
 * DEEP_RESEARCH_SKILL_S13C.md section 6 (DR-R10).
 *
 * This validator REUSES the unchanged S11 `validateResearchResult()` for
 * every item's `research: ResearchResult` (DR spec section 7, T14) — it does
 * not create a weakened parallel S11 validator. It only adds the S13C-level
 * checks S11 has no concept of: batch bounds/order, upstream traceability,
 * the DEEP independence-group floor, recency qualification, and the closure
 * recommendation mapping.
 */

const VALID_BATCH_STATUS = new Set<DeepResearchBatchStatus>(["COMPLETE", "PARTIAL", "BLOCKED"]);
const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 3;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * DR spec section 4-5 — distinct independence_group values among SUPPORTS
 * evidence only. Exported so ./compareDeepResearchRuns.ts scores the exact
 * same notion of "independent" the validator enforces — they must never
 * drift apart (mirrors KGA's FUTURE_CONTINGENT_CHOICE_CUES sharing pattern).
 */
export function countSupportingIndependenceGroups(evidence: readonly EvidenceItem[]): number {
  return new Set(evidence.filter((e) => e.relationship === "SUPPORTS").map((e) => e.independence_group)).size;
}

export const SINGULAR_AUTHORITY_EXCEPTION_CUE = /singular.authorit|sufficient (canonical )?authorit|canonical authority is sufficient/i;

/**
 * The singular-authority exception (DR-R7) may only be invoked when the
 * finding actually carries PRIMARY-sourced SUPPORTS evidence — otherwise a
 * finding could self-certify the exception by reciting the cue phrase in its
 * own `limitations` text with no authoritative evidence behind it. Exported
 * so ./compareDeepResearchRuns.ts can never score the exception more loosely
 * than the validator enforces it.
 */
export function hasValidSingularAuthorityException(finding: Finding): boolean {
  const hasCue = finding.limitations.some((l) => SINGULAR_AUTHORITY_EXCEPTION_CUE.test(l));
  if (!hasCue) return false;
  return finding.evidence.some((e) => e.relationship === "SUPPORTS" && e.source_type === "PRIMARY");
}

/**
 * DR-R10 recency rule. A fixed, deterministic reference date is used (never
 * `Date.now()`) so this check never depends on wall-clock time. Only
 * findings whose claim matches a "current-state" cue are subject to this
 * check — a stable historical fact may use an older source freely (section 6:
 * "A source must not be rejected merely for age if the researched fact is
 * stable"). Exported for reuse by ./compareDeepResearchRuns.ts.
 */
export const CURRENT_STATE_CUE = /\b(actualmente|vigente|hoy en d[ií]a|currently|current(ly)?|now|latest|today)\b/i;
export const RECENCY_LIMITATION_CUE = /recen(c|t)|stale|outdated|vigencia|desactualizad|antig[üu]edad/i;
export const DEEP_RESEARCH_RECENCY_REFERENCE_DATE = new Date("2026-08-26T00:00:00Z");
export const STALE_EVIDENCE_THRESHOLD_DAYS = 90;
export const DUPLICATE_AWARENESS_CUE = /same (source|independence)|duplicate|single (source )?family|not independent/i;

export function daysBefore(dateStr: string, reference: Date): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return (reference.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
}

export function isFindingStaleCurrentClaimWithoutLimitation(finding: Finding, researchQuestion = ""): boolean {
  if (finding.epistemic_status !== "EVIDENCED") return false;
  if (!CURRENT_STATE_CUE.test(finding.claim) && !CURRENT_STATE_CUE.test(researchQuestion)) return false;
  const supportingEvidence = finding.evidence.filter((e) => e.relationship === "SUPPORTS");
  if (supportingEvidence.length === 0) return false;
  const allStale = supportingEvidence.every(
    (e) => daysBefore(e.observed_or_published_at, DEEP_RESEARCH_RECENCY_REFERENCE_DATE) > STALE_EVIDENCE_THRESHOLD_DAYS,
  );
  const hasRecencyLimitation = finding.limitations.some((l) => RECENCY_LIMITATION_CUE.test(l));
  return allStale && !hasRecencyLimitation;
}

function validateFindingIndependenceAndRecency(finding: Finding, researchQuestion: string, ctx: string, errors: string[]): void {
  if (finding.epistemic_status !== "EVIDENCED") return;
  if (finding.criticality !== "DECISION_CRITICAL" && finding.criticality !== "DECISION_RELEVANT") return;

  const groups = countSupportingIndependenceGroups(finding.evidence);
  const hasSingularAuthorityException = hasValidSingularAuthorityException(finding);

  if (groups < 2 && !hasSingularAuthorityException) {
    if (finding.confidence === "HIGH") {
      errors.push(
        `${ctx}: material EVIDENCED finding has fewer than 2 independent source groups and confidence HIGH ` +
          "without a documented singular-authority exception (DEEP source floor, DR-R5/DR-R6/DR-R7)",
      );
    } else if (finding.limitations.length === 0) {
      errors.push(
        `${ctx}: material EVIDENCED finding has fewer than 2 independent source groups and no explicit ` +
          "limitation documenting the cross-validation gap (DR-R6)",
      );
    }
  }

  if (isFindingStaleCurrentClaimWithoutLimitation(finding, researchQuestion)) {
    errors.push(
      `${ctx}: current-state claim is supported only by evidence older than ${STALE_EVIDENCE_THRESHOLD_DAYS} days ` +
        "with no explicit recency limitation (DR-R10)",
    );
  }
}

function validateClosureRecommendationMapping(item: DeepResearchItemResult, ctx: string, errors: string[]): void {
  const state = item.research.research_status.state;
  const closure = item.recommended_closure_state;

  if (state === "MORE_RESEARCH_NEEDED" && closure !== null) {
    errors.push(`${ctx}: MORE_RESEARCH_NEEDED must recommend null closure, got '${closure}' (DR-R18/section 12)`);
  }

  if (state === "EXHAUSTED_WITH_UNCERTAINTY") {
    const blockedAllowed = item.decision_impact === "DECISION_CRITICAL" && item.blocking === true;
    if (closure !== null && !(closure === "BLOCKED" && blockedAllowed)) {
      errors.push(
        `${ctx}: EXHAUSTED_WITH_UNCERTAINTY must recommend null closure, or BLOCKED only when ` +
          "decision_impact is DECISION_CRITICAL and blocking is true (DR-R17/section 12)",
      );
    }
  }

  if (state === "SATISFIED" && closure !== "RESOLVED_WITH_EVIDENCE" && closure !== "RESOLVED_BY_AUTHORITY") {
    errors.push(
      `${ctx}: SATISFIED research_status must recommend RESOLVED_WITH_EVIDENCE or RESOLVED_BY_AUTHORITY, got '${closure}' (DR-R16/section 12)`,
    );
  }

  if (closure === "RESOLVED_BY_AUTHORITY") {
    const hasPrimaryEvidence = item.research.findings.some((f) => f.evidence.some((e) => e.source_type === "PRIMARY"));
    if (!hasPrimaryEvidence) {
      errors.push(`${ctx}: RESOLVED_BY_AUTHORITY requires at least one PRIMARY-source evidence item (DR-R21)`);
    }
  }

  const forbidden: string[] = ["ACCEPTED_AS_ASSUMPTION", "DEFERRED_WITHOUT_DECISION_IMPACT"];
  if (forbidden.includes(closure as unknown as string)) {
    errors.push(`${ctx}: S13C must never recommend '${closure}' for a NEEDS_RESEARCH item (DR-R23)`);
  }
}

function validateItem(item: DeepResearchItemResult, ctx: string, errors: string[]): void {
  if (!isNonEmptyString(item.knowledge_item_id)) errors.push(`${ctx}.knowledge_item_id must be a non-empty string`);
  if (!isNonEmptyString(item.research_question)) errors.push(`${ctx}.research_question must be a non-empty string`);
  if (item.upstream_epistemic_status !== "NEEDS_RESEARCH") {
    errors.push(`${ctx}.upstream_epistemic_status must be 'NEEDS_RESEARCH' (DR-R1)`);
  }
  if (!Array.isArray(item.limitations)) errors.push(`${ctx}.limitations must be an array`);
  if (!isNonEmptyString(item.closure_rationale)) errors.push(`${ctx}.closure_rationale must be a non-empty string`);

  const researchValidation = validateResearchResult(item.research);
  if (!researchValidation.valid) {
    for (const err of researchValidation.errors) {
      errors.push(`${ctx}.research: ${err} (S11 validateResearchResult, T14 reuse)`);
    }
  }

  for (const [i, finding] of (item.research?.findings ?? []).entries()) {
    validateFindingIndependenceAndRecency(finding, item.research_question, `${ctx}.research.findings[${i}]`, errors);
  }

  validateClosureRecommendationMapping(item, ctx, errors);
}

export interface DeepResearchBatchResultValidation {
  valid: boolean;
  errors: string[];
}

export function validateDeepResearchResult(result: DeepResearchBatchResult): DeepResearchBatchResultValidation {
  const errors: string[] = [];

  if (!isNonEmptyString(result?.source_request)) errors.push("source_request must be a non-empty string");
  if (!isNonEmptyString(result?.decision_relevant_summary)) errors.push("decision_relevant_summary must be a non-empty string");

  const queueSnapshot = result?.queue_snapshot ?? [];
  const selectedIds = result?.selected_item_ids ?? [];
  const items = result?.items ?? [];
  const deferredIds = result?.deferred_item_ids ?? [];

  if (selectedIds.length < MIN_BATCH_SIZE || selectedIds.length > MAX_BATCH_SIZE) {
    errors.push(`selected_item_ids.length must be between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}, got ${selectedIds.length} (DR-R13)`);
  }
  if (hasDuplicates(selectedIds)) errors.push("selected_item_ids must not contain duplicates");
  if (!selectedIds.every((id) => queueSnapshot.includes(id))) {
    errors.push("selected_item_ids must all be present in queue_snapshot (DR-P1)");
  }

  // DR-R14 — selection preserves S13B queue order.
  const selectedIndicesInSnapshot = selectedIds.map((id) => queueSnapshot.indexOf(id));
  for (let i = 1; i < selectedIndicesInSnapshot.length; i += 1) {
    if (selectedIndicesInSnapshot[i] <= selectedIndicesInSnapshot[i - 1]) {
      errors.push("selected_item_ids must preserve queue_snapshot's canonical order (DR-R14/DR-V3)");
      break;
    }
  }

  if (items.length !== selectedIds.length || items.some((it, i) => it.knowledge_item_id !== selectedIds[i])) {
    errors.push("items must correspond 1:1 to selected_item_ids, in the same order (section 10)");
  }

  const expectedDeferred = queueSnapshot.filter((id) => !selectedIds.includes(id));
  if (
    deferredIds.length !== expectedDeferred.length ||
    !expectedDeferred.every((id, i) => deferredIds[i] === id)
  ) {
    errors.push("deferred_item_ids must equal queue_snapshot minus selected_item_ids, in queue order (section 10)");
  }

  if (!VALID_BATCH_STATUS.has(result?.batch_status)) {
    errors.push("batch_status must be one of COMPLETE | PARTIAL | BLOCKED");
  }

  items.forEach((item, i) => validateItem(item, `items[${i}] (${item?.knowledge_item_id ?? "?"})`, errors));

  return { valid: errors.length === 0, errors };
}

/**
 * DEEP_RESEARCH_AGENT_v1.md section 13 — exact StructuredAgentOutput mapping.
 *
 * summary = result.decision_relevant_summary
 * data = result
 * evidence_refs = deterministic de-duplicated first-occurrence union of
 *   items[*].research.findings[*].evidence[*].evidence_ref +
 *   items[*].research.contradictions[*].evidence_refs
 */
export function mapDeepResearchBatchResultToStructuredOutput(result: DeepResearchBatchResult): StructuredAgentOutput {
  const seen = new Set<string>();
  const evidence_refs: string[] = [];
  const record = (ref: string) => {
    if (!seen.has(ref)) {
      seen.add(ref);
      evidence_refs.push(ref);
    }
  };

  for (const item of result.items) {
    for (const finding of item.research.findings) {
      for (const evidence of finding.evidence) record(evidence.evidence_ref);
    }
  }
  for (const item of result.items) {
    for (const contradiction of item.research.contradictions) {
      for (const ref of contradiction.evidence_refs) record(ref);
    }
  }

  return {
    summary: result.decision_relevant_summary,
    data: result as unknown as Record<string, unknown>,
    evidence_refs,
  };
}

export type { S13CRecommendedClosureState };
