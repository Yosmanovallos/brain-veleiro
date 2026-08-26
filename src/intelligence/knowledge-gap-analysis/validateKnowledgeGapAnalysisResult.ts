import type { StructuredAgentOutput } from "../../core/agent/index.js";
import type {
  CurrentGapClosureState,
  DecisionImpact,
  EpistemicStatus,
  GapClosureState,
  KnowledgeContextFact,
  KnowledgeGapAnalysisResult,
  KnowledgeItem,
} from "./types.js";

/**
 * The canonical authority reference for facts that are sufficiently
 * established by the S13A requirements_discovery request itself (i.e. not
 * backed by a separate context_fact). Any other authority_ref must resolve
 * to the source_ref of a CANONICAL_AUTHORITY context_fact (KGA-R4
 * resolution, see brain-bootstrap/reports/S13B-knowledge-gap-analysis-verification.md).
 */
export const CANONICAL_REQUEST_AUTHORITY_REF = "requirements_discovery.request";

/**
 * Deterministic S13B KnowledgeGapAnalysisResult validation.
 *
 * Implements brain-bootstrap/specs/KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md
 * section 20 (closure-state validation) plus the structural completeness
 * rules implied by sections 1, 11-14. This validator does not consume or
 * produce a runtime TerminalOutcome; it validates the
 * `KnowledgeGapAnalysisResult` value carried inside
 * StructuredAgentOutput.data. S09's TerminalOutcome and StructuredAgentOutput
 * remain untouched.
 */

const VALID_EPISTEMIC_STATUSES = new Set<EpistemicStatus>([
  "KNOWN",
  "TOLD",
  "PROVEN",
  "ASSUMED",
  "NEEDS_RESEARCH",
  "UNKNOWABLE",
]);

const VALID_DECISION_IMPACTS = new Set<DecisionImpact>([
  "DECISION_CRITICAL",
  "DECISION_RELEVANT",
  "CONTEXTUAL",
  "TRIVIA",
]);

const VALID_CLOSURE_STATES = new Set<GapClosureState>([
  "RESOLVED_WITH_EVIDENCE",
  "RESOLVED_BY_AUTHORITY",
  "ACCEPTED_AS_ASSUMPTION",
  "DEFERRED_WITHOUT_DECISION_IMPACT",
  "BLOCKED",
]);

const IMPACT_RANK: Record<DecisionImpact, number> = {
  DECISION_CRITICAL: 0,
  DECISION_RELEVANT: 1,
  CONTEXTUAL: 2,
  TRIVIA: 3,
};

export interface KnowledgeGapAnalysisResultValidation {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function isValidClosureState(value: CurrentGapClosureState): boolean {
  return value === null || VALID_CLOSURE_STATES.has(value);
}

/** KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md section 20 — deterministic invalid combinations. */
function validateItemClosureConsistency(
  item: KnowledgeItem,
  ctx: string,
  errors: string[],
  resolvableEvidenceRefs: ReadonlySet<string>,
  resolvableAuthorityRefs: ReadonlySet<string>,
): void {
  if (item.epistemic_status === "PROVEN" && item.evidence_refs.length === 0) {
    errors.push(`${ctx}: PROVEN requires evidence_refs.length >= 1 (KGA-R3/KGA-V3)`);
  }
  if (item.epistemic_status === "PROVEN") {
    for (const ref of item.evidence_refs) {
      if (!resolvableEvidenceRefs.has(ref)) {
        errors.push(
          `${ctx}: evidence_ref '${ref}' does not resolve to a DIRECT_EVIDENCE context_fact.source_ref (KGA-R3 resolution)`,
        );
      }
    }
  }
  if (item.epistemic_status === "KNOWN" && !item.authority_sufficient) {
    errors.push(`${ctx}: KNOWN requires authority_sufficient == true (KGA-R4)`);
  }
  if (item.epistemic_status === "KNOWN" && item.authority_refs.length === 0) {
    errors.push(`${ctx}: KNOWN requires authority_refs.length >= 1`);
  }
  if (item.epistemic_status === "KNOWN") {
    for (const ref of item.authority_refs) {
      if (!resolvableAuthorityRefs.has(ref)) {
        errors.push(
          `${ctx}: authority_ref '${ref}' does not resolve to a CANONICAL_AUTHORITY context_fact.source_ref or '${CANONICAL_REQUEST_AUTHORITY_REF}' (KGA-R4 resolution)`,
        );
      }
    }
  }
  if (item.epistemic_status === "TOLD" && item.assertion_refs.length === 0) {
    errors.push(`${ctx}: TOLD requires assertion_refs.length >= 1`);
  }
  if (item.epistemic_status === "ASSUMED" && !isNonEmptyString(item.assumption_rationale)) {
    errors.push(`${ctx}: ASSUMED requires a non-empty assumption_rationale`);
  }

  if (item.closure_state === "RESOLVED_WITH_EVIDENCE" && item.evidence_refs.length === 0) {
    errors.push(`${ctx}: RESOLVED_WITH_EVIDENCE without evidence (KGA-R12)`);
  }
  if (item.closure_state === "RESOLVED_BY_AUTHORITY" && !item.authority_sufficient) {
    errors.push(`${ctx}: RESOLVED_BY_AUTHORITY without sufficient authority (KGA-R13)`);
  }
  if (item.closure_state === "ACCEPTED_AS_ASSUMPTION" && item.epistemic_status !== "ASSUMED") {
    errors.push(`${ctx}: ACCEPTED_AS_ASSUMPTION requires epistemic_status == ASSUMED`);
  }
  if (item.closure_state === "ACCEPTED_AS_ASSUMPTION" && !item.accepted_for_current_decision) {
    errors.push(`${ctx}: ACCEPTED_AS_ASSUMPTION requires accepted_for_current_decision == true`);
  }
  if (item.epistemic_status === "NEEDS_RESEARCH" && item.closure_state !== null) {
    errors.push(`${ctx}: NEEDS_RESEARCH must not carry a closure_state (false resolved state, KGA-R14)`);
  }
}

/**
 * @param contextFacts The exact `KnowledgeGapAnalysisInput.context_facts` the
 *   result was produced from. Required (not defaulted) so that a caller can
 *   never silently validate ref resolution against an empty set — see
 *   KGA-R3/KGA-R4 resolution checks below and
 *   brain-bootstrap/reports/S13B-knowledge-gap-analysis-verification.md.
 */
export function validateKnowledgeGapAnalysisResult(
  result: KnowledgeGapAnalysisResult,
  contextFacts: readonly KnowledgeContextFact[],
): KnowledgeGapAnalysisResultValidation {
  const errors: string[] = [];

  if (!isNonEmptyString(result?.source_request)) {
    errors.push("source_request must be a non-empty string");
  }

  const resolvableEvidenceRefs = new Set(
    contextFacts.filter((f) => f.basis === "DIRECT_EVIDENCE").map((f) => f.source_ref),
  );
  const resolvableAuthorityRefs = new Set([
    CANONICAL_REQUEST_AUTHORITY_REF,
    ...contextFacts.filter((f) => f.basis === "CANONICAL_AUTHORITY").map((f) => f.source_ref),
  ]);

  const items = result?.items ?? [];
  if (hasDuplicates(items.map((i) => i.id))) errors.push("items must have unique ids");

  const itemIds = new Set(items.map((i) => i.id));

  items.forEach((item, i) => {
    const ctx = `items[${i}] (${item.id})`;
    if (!isNonEmptyString(item.statement)) errors.push(`${ctx}.statement must be a non-empty string`);
    if (!VALID_EPISTEMIC_STATUSES.has(item.epistemic_status)) errors.push(`${ctx}.epistemic_status is invalid`);
    if (!VALID_DECISION_IMPACTS.has(item.decision_impact)) errors.push(`${ctx}.decision_impact is invalid`);
    if (!isValidClosureState(item.closure_state)) errors.push(`${ctx}.closure_state is invalid`);
    validateItemClosureConsistency(item, ctx, errors, resolvableEvidenceRefs, resolvableAuthorityRefs);
  });

  // Section 12 — bucket indexes must partition all item IDs exactly once,
  // consistent with each item's own epistemic_status.
  const buckets = result?.buckets;
  if (!buckets) {
    errors.push("buckets is required");
  } else {
    const bucketEntries: Array<[EpistemicStatus, string[]]> = [
      ["KNOWN", buckets.known ?? []],
      ["TOLD", buckets.told ?? []],
      ["PROVEN", buckets.proven ?? []],
      ["ASSUMED", buckets.assumed ?? []],
      ["NEEDS_RESEARCH", buckets.needs_research ?? []],
      ["UNKNOWABLE", buckets.unknowable ?? []],
    ];
    const allBucketed: string[] = bucketEntries.flatMap(([, ids]) => ids);
    if (hasDuplicates(allBucketed)) {
      errors.push("bucket indexes must partition item IDs exactly once (an ID appears more than once)");
    }
    if (allBucketed.length !== itemIds.size || !items.every((item) => allBucketed.includes(item.id))) {
      errors.push("bucket indexes must partition exactly the set of item IDs (KGA-V9)");
    }
    for (const [status, ids] of bucketEntries) {
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (item && item.epistemic_status !== status) {
          errors.push(`bucket '${status.toLowerCase()}' contains '${id}' but its epistemic_status is '${item.epistemic_status}'`);
        }
      }
    }
  }

  // Section 13 — research_queue: only NEEDS_RESEARCH items, canonically ordered.
  const researchQueue = result?.research_queue ?? [];
  for (const [i, entry] of researchQueue.entries()) {
    const ctx = `research_queue[${i}]`;
    const item = items.find((it) => it.id === entry.knowledge_item_id);
    if (!item) {
      errors.push(`${ctx} references unknown knowledge_item_id '${entry.knowledge_item_id}'`);
    } else if (item.epistemic_status !== "NEEDS_RESEARCH") {
      errors.push(`${ctx} references '${entry.knowledge_item_id}' whose epistemic_status is '${item.epistemic_status}', not NEEDS_RESEARCH (KGA-V6/KGA-V7)`);
    }
  }
  for (let i = 1; i < researchQueue.length; i += 1) {
    const prev = researchQueue[i - 1];
    const curr = researchQueue[i];
    const prevRank = IMPACT_RANK[prev.decision_impact];
    const currRank = IMPACT_RANK[curr.decision_impact];
    const outOfOrder =
      prevRank > currRank ||
      (prevRank === currRank && !prev.blocking && curr.blocking) ||
      (prevRank === currRank && prev.blocking === curr.blocking && prev.knowledge_item_id > curr.knowledge_item_id);
    if (outOfOrder) {
      errors.push(
        `research_queue is not canonically ordered at index ${i}: '${prev.knowledge_item_id}' should not precede '${curr.knowledge_item_id}' (KGA-R17)`,
      );
    }
  }

  // Section 14 — S13C handoff consistency.
  const handoff = result?.handoff;
  if (!handoff) {
    errors.push("handoff is required");
  } else {
    const expectedResearchIds = researchQueue.map((r) => r.knowledge_item_id);
    if (JSON.stringify(handoff.research_item_ids) !== JSON.stringify(expectedResearchIds)) {
      errors.push("handoff.research_item_ids must equal research_queue's knowledge_item_ids in order");
    }
    const expectedUnknowableIds = items.filter((it) => it.epistemic_status === "UNKNOWABLE").map((it) => it.id);
    if (new Set(handoff.unknowable_item_ids).size !== new Set(expectedUnknowableIds).size ||
      !expectedUnknowableIds.every((id) => handoff.unknowable_item_ids.includes(id))) {
      errors.push("handoff.unknowable_item_ids must equal all UNKNOWABLE item IDs");
    }
    const expectedBlockers = items
      .filter(
        (it) =>
          it.blocking &&
          (it.closure_state === null || it.closure_state === "BLOCKED") &&
          (it.epistemic_status === "NEEDS_RESEARCH" || it.epistemic_status === "UNKNOWABLE"),
      )
      .map((it) => it.id);
    if (new Set(handoff.decision_blockers).size !== new Set(expectedBlockers).size ||
      !expectedBlockers.every((id) => handoff.decision_blockers.includes(id))) {
      errors.push("handoff.decision_blockers does not match the canonical blocker derivation rule (section 14)");
    }
    const expectedReady = expectedResearchIds.length > 0;
    if (handoff.ready_for_deep_research !== expectedReady) {
      errors.push("handoff.ready_for_deep_research must equal (research_item_ids.length > 0)");
    }
    if (typeof handoff.notes !== "string") {
      errors.push("handoff.notes must be a string");
    }
  }

  if (!isNonEmptyString(result?.decision_readiness_summary)) {
    errors.push("decision_readiness_summary must be a non-empty string");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md section 16 — exact StructuredAgentOutput
 * mapping.
 *
 * summary = result.decision_readiness_summary
 * data = result
 * evidence_refs = deterministic de-duplicated first-occurrence union of
 *   items[*].evidence_refs + items[*].authority_refs
 *
 * assertion_refs are NOT automatically evidence (section 16).
 */
export function mapKnowledgeGapAnalysisResultToStructuredOutput(result: KnowledgeGapAnalysisResult): StructuredAgentOutput {
  const seen = new Set<string>();
  const evidence_refs: string[] = [];

  const record = (ref: string) => {
    if (!seen.has(ref)) {
      seen.add(ref);
      evidence_refs.push(ref);
    }
  };

  for (const item of result.items) {
    for (const ref of item.evidence_refs) record(ref);
  }
  for (const item of result.items) {
    for (const ref of item.authority_refs) record(ref);
  }

  return {
    summary: result.decision_readiness_summary,
    data: result as unknown as Record<string, unknown>,
    evidence_refs,
  };
}
