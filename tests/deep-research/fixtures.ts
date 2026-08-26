import type {
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
  ObservationMessage,
} from "../../src/core/agent/index.js";
import type { EvidenceItem, ResearchLookupOutput, ResearchResult, ResearchSourceRecord } from "../../src/intelligence/research/types.js";
import { mapResearchResultToStructuredOutput } from "../../src/intelligence/research/validateResearchResult.js";
import {
  DEEP_RESEARCH_INPUT_MARKER,
  DEEP_RESEARCH_SKILL_MATERIALIZATION_MARKER,
} from "../../src/intelligence/deep-research/materializeDeepResearchTask.js";
import { mapDeepResearchBatchResultToStructuredOutput } from "../../src/intelligence/deep-research/validateDeepResearchResult.js";
import { selectDeepResearchItems, type SelectedDeepResearchItem } from "../../src/intelligence/deep-research/selectDeepResearchItems.js";
import type {
  DeepResearchBatchResult,
  DeepResearchInput,
  DeepResearchItemResult,
  S13CRecommendedClosureState,
} from "../../src/intelligence/deep-research/types.js";
import type { KnowledgeGapAnalysisResult } from "../../src/intelligence/knowledge-gap-analysis/types.js";

/**
 * Deterministic, no-network-beyond-the-real-capability, no-hardcoded-answer
 * deep-research reasoning used only for S13C verification
 * (DEEP_RESEARCH_AGENT_v1.md section 24-ish / DR-V10 — the synthesis must
 * genuinely depend on the Evidence `research.lookup` returns).
 *
 * Unlike S13A/S13B's Skill fixtures, S13C's Agent actually holds the real
 * `research.lookup` capability, so both the Skill-assisted AND the baseline
 * arm issue real `TOOL_CALL`s through the identical S09 runtime + the real
 * `ReferenceResearchCapabilityProvider` (mirroring
 * tests/research/fixtures/deterministicResearchModelProvider.ts's
 * plan-then-synthesize-from-real-observations pattern). The only
 * MATERIALIZATION difference (Skill selected+loaded vs not) controls which
 * *lookup plan and synthesis discipline* `DeterministicDeepResearchModelProvider`
 * applies — never a canned final answer, and never a fabricated corpus.
 *
 * `synthesizeDeepResearchItemResult` is the one shared synthesizer both the
 * positive and negative scenarios use, in both modes: every finding's claim,
 * every contradiction's description, confidence, research_status, and
 * closure recommendation are computed from the actual
 * `ResearchLookupResultItem[]` each planned step's real lookup returned —
 * never from fixed prose that would stay identical if the corpus changed
 * (T26 exercises this directly).
 */

// ---------------------------------------------------------------------------
// Source corpora
// ---------------------------------------------------------------------------

export const TAG_SCANNER_IDENTIFICATION = "scanner identification method";
export const TAG_SCANNER_TEST_VERIFICATION = "scanner test verification";
export const TAG_SCANNER_LIMITATIONS = "scanner metadata limitations";
export const TAG_SCANNER_PROBE_NO_MATCH = "generic product information probe";

export const POSITIVE_CORPUS: ResearchSourceRecord[] = [
  {
    source_ref: "SRC-PRIMARY-1",
    title: "Vendor Scanner Integration Docs",
    source_type: "PRIMARY",
    authority: "vendor-canonical",
    independence_group: "vendor-docs",
    observed_or_published_at: "2026-08-01",
    locator: "/scanner/integration",
    excerpt: "The supported kiosk scanner identifies the product using the encoded product identifier.",
    topic_tags: [TAG_SCANNER_IDENTIFICATION],
  },
  {
    source_ref: "SRC-INDEPENDENT-2",
    title: "Local Test Fixture Log",
    source_type: "DIRECT_OBSERVATION",
    authority: "verified-test-fixture",
    independence_group: "local-test",
    observed_or_published_at: "2026-08-20",
    locator: "test/scanner-fixture",
    excerpt: "Scanning fixture AX-104 produced product identifier AX-104 and selected the matching product record.",
    topic_tags: [TAG_SCANNER_TEST_VERIFICATION],
  },
  {
    source_ref: "SRC-QUALIFIER-3",
    title: "Vendor Scanner Limitations Docs",
    source_type: "PRIMARY",
    authority: "vendor-canonical",
    independence_group: "vendor-docs",
    observed_or_published_at: "2026-08-01",
    locator: "/scanner/limitations",
    excerpt: "The scanner returns an identifier only; product metadata must be resolved by the application.",
    topic_tags: [TAG_SCANNER_LIMITATIONS],
  },
];

/** Same corpus with SRC-INDEPENDENT-2 moved into the vendor-docs group — used by T26 to prove evidence-dependence. */
export const POSITIVE_CORPUS_WITHOUT_INDEPENDENT_GROUP: ResearchSourceRecord[] = POSITIVE_CORPUS.map((r) =>
  r.source_ref === "SRC-INDEPENDENT-2" ? { ...r, independence_group: "vendor-docs" } : r,
);

export const TAG_VENDOR_SUPPORT_COMMUNITY = "community support summary feature";
export const TAG_VENDOR_SUPPORT_OFFICIAL = "official current feature limitation";

export const NEGATIVE_CORPUS: ResearchSourceRecord[] = [
  {
    source_ref: "COPY-A",
    title: "Community Summary A",
    source_type: "SECONDARY",
    authority: "community-summary",
    independence_group: "upstream-blog-1",
    observed_or_published_at: "2026-01-10",
    locator: "/summary-a",
    excerpt: "El proveedor soporta la característica.",
    topic_tags: [TAG_VENDOR_SUPPORT_COMMUNITY],
  },
  {
    source_ref: "COPY-B",
    title: "Syndicated Summary B",
    source_type: "SECONDARY",
    authority: "syndicated-summary",
    independence_group: "upstream-blog-1",
    observed_or_published_at: "2026-01-12",
    locator: "/summary-b",
    excerpt: "El proveedor soporta la característica.",
    topic_tags: [TAG_VENDOR_SUPPORT_COMMUNITY],
  },
  {
    source_ref: "OFFICIAL-CURRENT",
    title: "Vendor Current Limitations Docs",
    source_type: "PRIMARY",
    authority: "vendor-canonical",
    independence_group: "vendor-docs",
    observed_or_published_at: "2026-08-20",
    locator: "/current-limitations",
    excerpt: "La característica no está soportada en la versión actual.",
    topic_tags: [TAG_VENDOR_SUPPORT_OFFICIAL],
  },
];

// ---------------------------------------------------------------------------
// Canonical KnowledgeGapAnalysisResult fixtures (S13C's real input)
// ---------------------------------------------------------------------------

export const POSITIVE_DEEP_RESEARCH_KGA: KnowledgeGapAnalysisResult = {
  source_request:
    "Necesito una aplicación para que una tienda registre un peluche comprado, pida el nombre del peluche y algunos " +
    "datos del dueño, y al final imprima un certificado. Se usará en un kiosco con pantalla táctil.",
  items: [
    {
      id: "K-Q1",
      source_item_ref: "Q1",
      source_kind: "UNKNOWN",
      statement: "¿Cómo se identifica técnicamente el peluche comprado?",
      epistemic_status: "NEEDS_RESEARCH",
      decision_impact: "DECISION_CRITICAL",
      closure_state: null,
      authority_refs: [],
      evidence_refs: [],
      assertion_refs: [],
      authority_sufficient: false,
      accepted_for_current_decision: false,
      blocking: true,
      related_goal_ids: ["G1"],
      research_question: "¿Cómo se identifica técnicamente el peluche comprado?",
      rationale: "Cambia el flujo de entrada y posibles integraciones de hardware.",
      limitations: [],
    },
    {
      id: "K-Q2",
      source_item_ref: "Q2",
      source_kind: "UNKNOWN",
      statement: "¿Qué impresora/formato debe soportar el certificado?",
      epistemic_status: "NEEDS_RESEARCH",
      decision_impact: "DECISION_RELEVANT",
      closure_state: null,
      authority_refs: [],
      evidence_refs: [],
      assertion_refs: [],
      authority_sufficient: false,
      accepted_for_current_decision: false,
      blocking: false,
      related_goal_ids: ["G3"],
      research_question: "¿Qué impresora/formato debe soportar el certificado?",
      rationale: "Afecta integración y aceptación del flujo final.",
      limitations: [],
    },
  ],
  buckets: { known: [], told: [], proven: [], assumed: [], needs_research: ["K-Q1", "K-Q2"], unknowable: [] },
  research_queue: [
    {
      knowledge_item_id: "K-Q1",
      research_question: "¿Cómo se identifica técnicamente el peluche comprado?",
      decision_impact: "DECISION_CRITICAL",
      blocking: true,
      why_research_matters: "Cambia el flujo de entrada y posibles integraciones de hardware.",
    },
    {
      knowledge_item_id: "K-Q2",
      research_question: "¿Qué impresora/formato debe soportar el certificado?",
      decision_impact: "DECISION_RELEVANT",
      blocking: false,
      why_research_matters: "Afecta integración y aceptación del flujo final.",
    },
  ],
  handoff: {
    ready_for_deep_research: true,
    research_item_ids: ["K-Q1", "K-Q2"],
    decision_blockers: ["K-Q1"],
    unknowable_item_ids: [],
    notes: "S13C should prioritize 2 research item(s); 1 decision blocker(s) currently unresolved.",
  },
  decision_readiness_summary: "Classified 2 item(s): 0 known, 0 told, 0 proven, 0 assumed, 2 needing research, 0 unknowable.",
};

export const NEGATIVE_DEEP_RESEARCH_KGA: KnowledgeGapAnalysisResult = {
  source_request: "El cliente afirma que la plataforma ya tiene 10.000 usuarios activos y quiere decidir el proveedor de pagos el próximo mes.",
  items: [
    {
      id: "K-NEG-1",
      source_item_ref: "NEG-1",
      source_kind: "UNKNOWN",
      statement: "¿El proveedor X soporta actualmente la característica requerida?",
      epistemic_status: "NEEDS_RESEARCH",
      decision_impact: "DECISION_CRITICAL",
      closure_state: null,
      authority_refs: [],
      evidence_refs: [],
      assertion_refs: [],
      authority_sufficient: false,
      accepted_for_current_decision: false,
      blocking: true,
      related_goal_ids: ["G1"],
      research_question: "¿El proveedor X soporta actualmente la característica requerida?",
      rationale: "Afecta la integración de pagos a implementar.",
      limitations: [],
    },
  ],
  buckets: { known: [], told: [], proven: [], assumed: [], needs_research: ["K-NEG-1"], unknowable: [] },
  research_queue: [
    {
      knowledge_item_id: "K-NEG-1",
      research_question: "¿El proveedor X soporta actualmente la característica requerida?",
      decision_impact: "DECISION_CRITICAL",
      blocking: true,
      why_research_matters: "Afecta la integración de pagos a implementar.",
    },
  ],
  handoff: {
    ready_for_deep_research: true,
    research_item_ids: ["K-NEG-1"],
    decision_blockers: ["K-NEG-1"],
    unknowable_item_ids: [],
    notes: "S13C should prioritize 1 research item(s); 1 decision blocker(s) currently unresolved.",
  },
  decision_readiness_summary: "Classified 1 item(s): 0 known, 0 told, 0 proven, 0 assumed, 1 needing research, 0 unknowable.",
};

export const POSITIVE_DEEP_RESEARCH_INPUT: DeepResearchInput = { knowledge_gap_analysis: POSITIVE_DEEP_RESEARCH_KGA };
export const NEGATIVE_DEEP_RESEARCH_INPUT: DeepResearchInput = { knowledge_gap_analysis: NEGATIVE_DEEP_RESEARCH_KGA };

/** Fixture-declared ground truth for compareDeepResearchRuns' contradiction_visibility_ratio — see that module's docstring. */
export const EXPECTED_CONTRADICTION_COUNT_BY_ITEM: Record<string, number> = { "K-Q1": 1, "K-NEG-1": 1 };

// ---------------------------------------------------------------------------
// Planned lookup steps (per item, per mode) — genuine research plans, not
// canned answers. Each step's `relationship` is the researcher's own plan
// role (which sub-question this lookup targets), mirroring how
// tests/research/fixtures/scenarios.ts assigns EvidenceItem.relationship per
// observation *slot*, not by parsing excerpt text.
// ---------------------------------------------------------------------------

export interface PlannedLookupStep {
  query: string;
  limit?: number;
  /** undefined = a deliberate probe expected to return nothing (used only by the naive baseline). */
  relationship?: EvidenceItem["relationship"];
}

export const POSITIVE_SKILL_STEPS: PlannedLookupStep[] = [
  { query: TAG_SCANNER_IDENTIFICATION, relationship: "SUPPORTS" },
  { query: TAG_SCANNER_TEST_VERIFICATION, relationship: "SUPPORTS" },
  { query: TAG_SCANNER_LIMITATIONS, relationship: "QUALIFIES" },
];

export const POSITIVE_BASELINE_STEPS: PlannedLookupStep[] = [{ query: TAG_SCANNER_PROBE_NO_MATCH }];

export const NEGATIVE_SKILL_STEPS: PlannedLookupStep[] = [
  { query: TAG_VENDOR_SUPPORT_COMMUNITY, limit: 5, relationship: "CONTRADICTS" },
  { query: TAG_VENDOR_SUPPORT_OFFICIAL, relationship: "SUPPORTS" },
];

export const NEGATIVE_BASELINE_STEPS: PlannedLookupStep[] = [{ query: TAG_VENDOR_SUPPORT_COMMUNITY, limit: 5, relationship: "SUPPORTS" }];

// ---------------------------------------------------------------------------
// Generic synthesizer — genuinely reads real observations, never fabricates.
// ---------------------------------------------------------------------------

function lookupOutputOf(observation: ObservationMessage): ResearchLookupOutput {
  return (observation.output ?? { results: [] }) as unknown as ResearchLookupOutput;
}

type RawLookupResult = ResearchLookupOutput["results"][number];

function citeExcerpts(items: readonly RawLookupResult[]): string {
  return items.map((item) => `${item.excerpt} (source: ${item.title}, ${item.observed_or_published_at})`).join(" ");
}

function toEvidence(item: ResearchLookupOutput["results"][number], relationship: EvidenceItem["relationship"]): EvidenceItem {
  return {
    evidence_ref: `ev-${item.source_ref}`,
    source_ref: item.source_ref,
    source_title: item.title,
    source_type: item.source_type,
    authority: item.authority,
    independence_group: item.independence_group,
    observed_or_published_at: item.observed_or_published_at,
    locator: item.locator,
    relationship,
  };
}

export type DeepResearchSynthesisMode = "SKILL" | "BASELINE";

/**
 * The one shared synthesizer both scenarios/modes use. Nothing about the
 * final DeepResearchItemResult is fixed independently of `observations` —
 * change a source in the corpus and every derived field changes accordingly
 * (T26). `mode` controls DISCIPLINE (does it deduplicate independence
 * groups, does it hedge confidence, does it overclaim closure when evidence
 * is thin) — never the underlying facts, which always come from the real
 * `research.lookup` observations.
 */
export function synthesizeDeepResearchItemResult(
  item: SelectedDeepResearchItem,
  steps: PlannedLookupStep[],
  observations: ObservationMessage[],
  mode: DeepResearchSynthesisMode,
): DeepResearchItemResult {
  const evidence: EvidenceItem[] = [];
  const rawSupports: RawLookupResult[] = [];
  const rawContradicts: RawLookupResult[] = [];
  const rawQualifies: RawLookupResult[] = [];
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step.relationship) continue; // deliberate probe — no evidence expected/used even if something matched
    const results = lookupOutputOf(observations[i]).results;
    for (const r of results) {
      evidence.push(toEvidence(r, step.relationship));
      if (step.relationship === "SUPPORTS") rawSupports.push(r);
      else if (step.relationship === "CONTRADICTS") rawContradicts.push(r);
      else if (step.relationship === "QUALIFIES") rawQualifies.push(r);
    }
  }

  const supports = evidence.filter((e) => e.relationship === "SUPPORTS");
  const contradicts = evidence.filter((e) => e.relationship === "CONTRADICTS");
  const qualifies = evidence.filter((e) => e.relationship === "QUALIFIES");

  const genuineDistinctGroups = new Set(supports.map((e) => e.independence_group)).size;
  const naiveIndependentCount = supports.length;
  const crossValidated = mode === "SKILL" ? genuineDistinctGroups >= 2 : naiveIndependentCount >= 2;

  const primarySupport = supports.find((e) => e.source_type === "PRIMARY");
  const singularAuthorityJustified = mode === "SKILL" && genuineDistinctGroups < 2 && supports.length > 0 && !!primarySupport;

  const claimParts: string[] = [];
  if (rawSupports.length > 0) claimParts.push(citeExcerpts(rawSupports));
  if (rawContradicts.length > 0 && mode === "SKILL") {
    claimParts.push(`A newer/authoritative source qualifies this: ${citeExcerpts(rawContradicts)}`);
  }
  const claim = claimParts.length > 0 ? claimParts.join(" ") : `No evidence was found in the bounded corpus for "${item.research_question}".`;

  let epistemic_status: ResearchResult["findings"][number]["epistemic_status"];
  let confidence: ResearchResult["findings"][number]["confidence"];
  let limitations: string[] = [];

  if (mode === "BASELINE") {
    // Naive completion (KNOWLEDGE_GAP_ANALYSIS_SKILL_S13B.md-style "Incorrect
    // behavior" precedent, adapted for S13C): confidently asserts the claim
    // is already established, without checking independence or hedging —
    // regardless of whether real evidence actually supports it.
    epistemic_status = "EVIDENCED";
    confidence = "HIGH";
    limitations = [];
  } else if (supports.length === 0 && contradicts.length === 0) {
    epistemic_status = "UNCERTAIN";
    confidence = "LOW";
    limitations = [`No evidence was found in the bounded corpus for "${item.research_question}".`];
  } else {
    epistemic_status = "EVIDENCED";
    if (crossValidated || singularAuthorityJustified) {
      confidence = "HIGH";
    } else {
      confidence = supports.length > 0 ? "MEDIUM" : "LOW";
    }
    if (singularAuthorityJustified) {
      limitations.push(
        "Cross-validation with a second independent source was not required: sufficient canonical authority " +
          `(${primarySupport!.source_title}) establishes the answer.`,
      );
    } else if (!crossValidated) {
      limitations.push("Independent cross-validation could not be completed: only one independent source group was available.");
    }
    if (rawQualifies.length > 0) {
      limitations.push(`Scope is qualified by additional evidence: ${citeExcerpts(rawQualifies)}`);
    }
  }

  const findingId = `finding-${item.knowledge_item_id}`;
  const finding: ResearchResult["findings"][number] = {
    id: findingId,
    claim,
    criticality: item.decision_impact === "DECISION_CRITICAL" ? "DECISION_CRITICAL" : item.decision_impact === "DECISION_RELEVANT" ? "DECISION_RELEVANT" : "CONTEXTUAL",
    epistemic_status,
    evidence,
    confidence,
    limitations,
  };

  const contradictions: ResearchResult["contradictions"] = [];
  if (mode === "SKILL" && contradicts.length > 0) {
    contradictions.push({
      topic: item.research_question,
      claim_refs: [findingId],
      evidence_refs: evidence.map((e) => e.evidence_ref),
      description:
        `Conflicting evidence exists: ${citeExcerpts(rawContradicts)} vs. ${citeExcerpts(rawSupports.length > 0 ? rawSupports : rawQualifies)}`.trim(),
      resolution: "RESOLVED",
      limitations: [],
    });
  } else if (mode === "SKILL" && qualifies.length > 0) {
    contradictions.push({
      topic: `${item.research_question} (scope qualification)`,
      claim_refs: [findingId],
      evidence_refs: evidence.map((e) => e.evidence_ref),
      description: `The primary evidence supports the claim, but the following qualifies its scope: ${citeExcerpts(rawQualifies)}`,
      resolution: "NOT_DECISION_RELEVANT",
      limitations: [],
    });
  }

  const hasAnyEvidence = supports.length > 0 || contradicts.length > 0;
  const research_status: ResearchResult["research_status"] =
    mode === "BASELINE"
      ? {
          state: "SATISFIED",
          reason: "Naive completion: assumed sufficient without further verification.",
          unresolved_decision_critical_gaps: [],
          additional_research_expected_to_change_decision: false,
        }
      : hasAnyEvidence
        ? {
            state: "SATISFIED",
            reason: `The decision-critical gap "${item.research_question}" was resolved with ${evidence.length} evidence item(s) from the bounded corpus.`,
            unresolved_decision_critical_gaps: [],
            additional_research_expected_to_change_decision: false,
          }
        : {
            state: "MORE_RESEARCH_NEEDED",
            reason: `No evidence for "${item.research_question}" was found in the bounded corpus; a wider source set could resolve this.`,
            unresolved_decision_critical_gaps: [item.knowledge_item_id],
            additional_research_expected_to_change_decision: true,
          };

  let recommended_closure_state: S13CRecommendedClosureState;
  let closure_rationale: string;
  if (mode === "BASELINE") {
    recommended_closure_state = "RESOLVED_WITH_EVIDENCE";
    closure_rationale = "Naive completion: treated the claim as already resolved.";
  } else if (research_status.state !== "SATISFIED") {
    recommended_closure_state = null;
    closure_rationale = "Research status is not SATISFIED; no closure is recommended.";
  } else if (singularAuthorityJustified) {
    recommended_closure_state = "RESOLVED_BY_AUTHORITY";
    closure_rationale = `Sufficient canonical authority (${primarySupport!.source_title}) establishes the answer.`;
  } else if (crossValidated) {
    recommended_closure_state = "RESOLVED_WITH_EVIDENCE";
    closure_rationale = `Direct evidence from ${genuineDistinctGroups} independent source group(s) resolves the question.`;
  } else {
    recommended_closure_state = null;
    closure_rationale = "Evidence exists but does not meet the DEEP source-quality floor for a closure recommendation.";
  }

  const research: ResearchResult = {
    question: item.research_question,
    subquestions: [
      {
        id: `sq-${item.knowledge_item_id}`,
        question: item.research_question,
        gap_class: item.decision_impact,
        why_it_matters: "Selected from the S13B research_queue for deep research.",
        decision_affected: item.research_question,
        status: research_status.state === "SATISFIED" ? "RESOLVED_WITH_EVIDENCE" : "OPEN",
      },
    ],
    findings: [finding],
    contradictions,
    unknowns:
      research_status.state === "MORE_RESEARCH_NEEDED"
        ? [
            {
              question: item.research_question,
              gap_class: item.decision_impact === "TRIVIA" ? "CONTEXTUAL" : item.decision_impact,
              reason_unresolved: `No source in the bounded corpus matched the query used for "${item.research_question}".`,
              decision_impact: item.decision_impact,
              revalidation_trigger: "A wider or deeper bounded source corpus becomes available.",
            },
          ]
        : [],
    research_status,
    decision_relevant_summary: `Regarding "${item.research_question}": ${claim}`,
  };

  return {
    knowledge_item_id: item.knowledge_item_id,
    research_question: item.research_question,
    decision_impact: item.decision_impact,
    blocking: item.blocking,
    upstream_epistemic_status: "NEEDS_RESEARCH",
    upstream_closure_state: item.upstream_closure_state,
    research,
    recommended_closure_state,
    closure_rationale,
    limitations: [...finding.limitations],
  };
}

// ---------------------------------------------------------------------------
// Deterministic batch-aware ModelProvider
// ---------------------------------------------------------------------------

function extractDeepResearchInput(goalText: string): DeepResearchInput {
  const markerIdx = goalText.indexOf(DEEP_RESEARCH_INPUT_MARKER);
  if (markerIdx === -1) {
    throw new Error("DeterministicDeepResearchModelProvider: materialized objective missing DEEP_RESEARCH_INPUT marker.");
  }
  const rest = goalText.slice(markerIdx + DEEP_RESEARCH_INPUT_MARKER.length + 1);
  const nextMarkerIdx = rest.indexOf(`\n${DEEP_RESEARCH_SKILL_MATERIALIZATION_MARKER}`);
  const jsonText = (nextMarkerIdx === -1 ? rest : rest.slice(0, nextMarkerIdx)).trim();
  return JSON.parse(jsonText) as DeepResearchInput;
}

export interface DeepResearchStepPlanByItem {
  [knowledge_item_id: string]: PlannedLookupStep[];
}

/**
 * Deterministic, no-canned-answer deep-research ModelProvider used only for
 * S13C verification. Branches skill-mode vs baseline purely on whether the
 * materialized objective contains the SKILL_ID marker (i.e., whether S12
 * actually discovered/loaded/materialized the S13C Skill for this task) —
 * never on the specific fixture content. Issues real `research.lookup`
 * TOOL_CALLs for every planned step across every selected item (mirroring
 * tests/research/fixtures/deterministicResearchModelProvider.ts), then
 * synthesizes each item's DeepResearchItemResult purely from the actual
 * returned observations once all planned lookups are complete.
 */
export class DeterministicDeepResearchModelProvider implements ModelProvider {
  constructor(private readonly stepsByItemSkill: DeepResearchStepPlanByItem, private readonly stepsByItemBaseline: DeepResearchStepPlanByItem) {}

  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const goalText = request.goal.statement;
    const input = extractDeepResearchInput(goalText);
    const skillMode = goalText.includes(DEEP_RESEARCH_SKILL_MATERIALIZATION_MARKER);
    const mode: DeepResearchSynthesisMode = skillMode ? "SKILL" : "BASELINE";
    const stepsByItem = skillMode ? this.stepsByItemSkill : this.stepsByItemBaseline;

    const selection = selectDeepResearchItems(input);

    const flatSteps: { knowledge_item_id: string; step: PlannedLookupStep }[] = [];
    for (const selected of selection.selected) {
      const steps = stepsByItem[selected.knowledge_item_id] ?? [];
      for (const step of steps) flatSteps.push({ knowledge_item_id: selected.knowledge_item_id, step });
    }

    const completed = request.state.prior_observations.length;

    if (completed < flatSteps.length) {
      const next = flatSteps[completed];
      return {
        status: "SUCCESS",
        decision: {
          type: "TOOL_CALL",
          rationale: `Executing planned bounded research.lookup step ${completed + 1}/${flatSteps.length} for '${next.knowledge_item_id}': "${next.step.query}".`,
          tool_call: {
            call_id: `s13c-lookup-${completed + 1}`,
            capability_id: "research.lookup",
            input: { query: next.step.query, ...(next.step.limit !== undefined ? { limit: next.step.limit } : {}) },
          },
        },
      };
    }

    const items: DeepResearchItemResult[] = [];
    let obsCursor = 0;
    for (const selected of selection.selected) {
      const steps = stepsByItem[selected.knowledge_item_id] ?? [];
      const itemObservations = request.state.prior_observations.slice(obsCursor, obsCursor + steps.length);
      obsCursor += steps.length;
      items.push(synthesizeDeepResearchItemResult(selected, steps, itemObservations, mode));
    }

    const decisionBlockersProcessed = items.filter((i) => i.blocking && i.recommended_closure_state === null).length;

    const result: DeepResearchBatchResult = {
      source_request: input.knowledge_gap_analysis.source_request,
      queue_snapshot: selection.queue_snapshot,
      selected_item_ids: selection.selected_item_ids,
      items,
      deferred_item_ids: selection.deferred_item_ids,
      batch_status: "COMPLETE",
      decision_relevant_summary:
        `Processed ${items.length} research item(s); ${decisionBlockersProcessed} still block the decision; ` +
        `${selection.deferred_item_ids.length} item(s) deferred to a future run.`,
    };

    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: skillMode
          ? "Applied the materialized Deep Research Skill's DEEP evidence-quality discipline to the selected batch."
          : "No Skill was materialized for this task; produced a naive best-effort batch result.",
        output: mapDeepResearchBatchResultToStructuredOutput(result),
      },
    };
  }
}

export { lookupOutputOf, mapResearchResultToStructuredOutput };
