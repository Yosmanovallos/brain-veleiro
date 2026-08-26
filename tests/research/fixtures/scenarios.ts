import type { ObservationMessage } from "../../../src/core/agent/index.js";
import type { EvidenceItem, ResearchLookupResultItem, ResearchResult } from "../../../src/intelligence/research/types.js";
import { TAG_CONCURRENCY_SAFETY, TAG_RACE_CONDITION } from "./corpus.js";
import { lookupOutputOf, type ResearchLookupStep } from "./deterministicResearchModelProvider.js";

/**
 * Deterministic S11 verification scenarios.
 *
 * RESEARCHER_AGENT_v1.md "Decision 3" is explicit: "The deterministic model
 * MUST NOT contain the final research answer as a canned constant. The test
 * question's answer MUST be derived from Evidence returned by
 * research.lookup." `synthesizeResearchResult` below is the one shared
 * synthesizer both scenarios use: every finding's claim, every
 * contradiction's description, every unknown's reason, the overall
 * decision_relevant_summary, AND research_status (state/reason/unresolved
 * gaps) are all computed from the actual ResearchLookupResultItem[] each
 * lookup returned — never from fixed prose that would stay identical if the
 * corpus changed. This is what T23 exercises: change the corpus, the
 * synthesized answer changes.
 */

function toEvidence(item: ResearchLookupResultItem, relationship: EvidenceItem["relationship"]): EvidenceItem {
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

/** Builds an evidence-derived sentence — never fixed text — from what a lookup actually returned. */
function citeExcerpts(items: ResearchLookupResultItem[]): string {
  return items.map((item) => `${item.excerpt} (source: ${item.title}, ${item.observed_or_published_at})`).join(" ");
}

export interface PrimaryGapSpec {
  id: string;
  question: string;
  why_it_matters: string;
  decision_affected: string;
}

export interface SecondaryGapSpec {
  id: string;
  question: string;
  why_it_matters: string;
  decision_affected: string;
  /** DECISION_RELEVANT gap_class used for both the subquestion and any resulting unknown. */
  gap_class: "DECISION_RELEVANT" | "CONTEXTUAL";
}

export interface SynthesizeScenarioConfig {
  question: string;
  /** Observation index 0 — the one DECISION_CRITICAL gap this scenario stands or falls on. */
  primaryGap: PrimaryGapSpec;
  /** Observation index 1 (optional) — evidence that, if present, qualifies/contradicts the primary finding. */
  qualifyingGap?: SecondaryGapSpec;
  /** Observation index 2 (optional) — an independent, non-blocking gap. */
  explorationGap?: SecondaryGapSpec;
}

/**
 * The one shared synthesizer. Nothing about the final ResearchResult is
 * fixed independently of `observations` — remove or change a source in the
 * corpus and every derived field (claim, description, summary, status)
 * changes accordingly.
 */
export function synthesizeResearchResult(config: SynthesizeScenarioConfig, observations: ObservationMessage[]): ResearchResult {
  const primaryResults = lookupOutputOf(observations[0]).results;
  const primaryEvidence = primaryResults.map((item) => toEvidence(item, "SUPPORTS"));
  const primaryResolved = primaryEvidence.length > 0;

  const subquestions: ResearchResult["subquestions"] = [
    {
      id: config.primaryGap.id,
      question: config.primaryGap.question,
      gap_class: "DECISION_CRITICAL",
      why_it_matters: config.primaryGap.why_it_matters,
      decision_affected: config.primaryGap.decision_affected,
      status: primaryResolved ? "RESOLVED_WITH_EVIDENCE" : "BLOCKED",
    },
  ];

  const findings: ResearchResult["findings"] = [];
  const contradictions: ResearchResult["contradictions"] = [];
  const unknowns: ResearchResult["unknowns"] = [];
  const summaryParts: string[] = [];

  if (primaryResolved) {
    const independenceGroups = new Set(primaryEvidence.map((e) => e.independence_group));
    const crossValidated = independenceGroups.size >= 2;
    const limitations: string[] = [];
    if (!crossValidated) {
      limitations.push(
        "Independent cross-validation could not be completed: only one independent source group " +
          "was available in the bounded corpus for this claim.",
      );
    }

    let qualificationText = "";
    if (config.qualifyingGap && observations[1]) {
      const qualifyingResults = lookupOutputOf(observations[1]).results;
      if (qualifyingResults.length > 0) {
        qualificationText = citeExcerpts(qualifyingResults);
        limitations.push(
          `A qualifying/contradicting observation exists (see contradictions): ${qualificationText}`,
        );
      }
    }

    findings.push({
      id: `finding-${config.primaryGap.id}`,
      claim: citeExcerpts(primaryResults),
      criticality: "DECISION_CRITICAL",
      epistemic_status: "EVIDENCED",
      evidence: primaryEvidence,
      confidence: crossValidated ? "MEDIUM" : "LOW",
      limitations,
    });
    summaryParts.push(
      `Regarding "${config.primaryGap.question}": ${citeExcerpts(primaryResults)} ` +
        `(cross-validated: ${crossValidated ? "yes" : "no"}).`,
    );

    if (config.qualifyingGap && observations[1]) {
      const qualifyingResults = lookupOutputOf(observations[1]).results;
      subquestions.push({
        id: config.qualifyingGap.id,
        question: config.qualifyingGap.question,
        gap_class: config.qualifyingGap.gap_class,
        why_it_matters: config.qualifyingGap.why_it_matters,
        decision_affected: config.qualifyingGap.decision_affected,
        status: qualifyingResults.length > 0 ? "RESOLVED_WITH_EVIDENCE" : "OPEN",
      });
      if (qualifyingResults.length > 0) {
        const qualifyingEvidence = qualifyingResults.map((item) => toEvidence(item, "QUALIFIES"));
        contradictions.push({
          topic: config.qualifyingGap.question,
          claim_refs: [`finding-${config.primaryGap.id}`],
          evidence_refs: [...primaryEvidence.map((e) => e.evidence_ref), ...qualifyingEvidence.map((e) => e.evidence_ref)],
          description: `The primary evidence supports the claim, but the following qualifies it: ${qualificationText}`,
          resolution: "UNRESOLVED",
          limitations: ["No source in the bounded corpus resolves this qualification."],
        });
        summaryParts.push(`However, this is qualified: ${qualificationText}`);
      }
    }
  } else {
    unknowns.push({
      question: config.primaryGap.question,
      gap_class: "DECISION_CRITICAL",
      reason_unresolved: `No source in the bounded corpus matched the query used for "${config.primaryGap.question}".`,
      decision_impact: "The primary research question cannot be answered without further evidence.",
      revalidation_trigger: "A wider or deeper bounded source corpus becomes available.",
    });
    summaryParts.push(`Regarding "${config.primaryGap.question}": no evidence was found in the bounded corpus.`);
  }

  if (config.explorationGap && observations[2]) {
    const explorationResults = lookupOutputOf(observations[2]).results;
    subquestions.push({
      id: config.explorationGap.id,
      question: config.explorationGap.question,
      gap_class: config.explorationGap.gap_class,
      why_it_matters: config.explorationGap.why_it_matters,
      decision_affected: config.explorationGap.decision_affected,
      status: explorationResults.length > 0 ? "RESOLVED_WITH_EVIDENCE" : "DEFERRED_WITHOUT_DECISION_IMPACT",
    });
    if (explorationResults.length === 0) {
      unknowns.push({
        question: config.explorationGap.question,
        gap_class: config.explorationGap.gap_class,
        reason_unresolved: `No source in the bounded corpus matched the query used for "${config.explorationGap.question}".`,
        decision_impact: "This gap is decision-relevant but does not block the primary decision.",
        revalidation_trigger: "New documentation addressing this question becomes available.",
      });
      summaryParts.push(`Regarding "${config.explorationGap.question}": no evidence was found in the bounded corpus.`);
    } else {
      summaryParts.push(`Regarding "${config.explorationGap.question}": ${citeExcerpts(explorationResults)}`);
    }
  }

  const unresolvedCriticalGaps = primaryResolved ? [] : [config.primaryGap.id];
  const state: ResearchResult["research_status"]["state"] = primaryResolved ? "SATISFIED" : "MORE_RESEARCH_NEEDED";
  const reason = primaryResolved
    ? `The decision-critical gap "${config.primaryGap.question}" was resolved with ${primaryEvidence.length} evidence item(s) ` +
      `from the bounded corpus; any remaining gaps are decision-relevant, not decision-critical, and another bounded ` +
      `lookup over this corpus is unlikely to add new evidence.`
    : `No evidence for the decision-critical gap "${config.primaryGap.question}" was found in the bounded corpus; ` +
      `additional research over a different or wider source set could resolve this.`;

  return {
    question: config.question,
    subquestions,
    findings,
    contradictions,
    unknowns,
    research_status: {
      state,
      reason,
      unresolved_decision_critical_gaps: unresolvedCriticalGaps,
      additional_research_expected_to_change_decision: !primaryResolved,
    },
    decision_relevant_summary: summaryParts.join(" "),
  };
}

// ---------------------------------------------------------------------------
// SATISFIED scenario
// ---------------------------------------------------------------------------

export const SATISFIED_QUESTION =
  "Does the Meridian caching layer safely support concurrent writes from multiple workers, " +
  "and is it ready for multi-region synchronous replication?";

export const MULTI_REGION_QUERY = "multi-region synchronous replication";

export const SATISFIED_STEPS: ResearchLookupStep[] = [
  { query: TAG_CONCURRENCY_SAFETY, limit: 5 },
  { query: TAG_RACE_CONDITION, limit: 5 },
  { query: MULTI_REGION_QUERY, limit: 5 },
];

const SATISFIED_CONFIG: SynthesizeScenarioConfig = {
  question: SATISFIED_QUESTION,
  primaryGap: {
    id: "sq-1",
    question: "Does per-key locking safely serialize concurrent writes from multiple workers?",
    why_it_matters: "This is the core safety property the research question depends on.",
    decision_affected: "Whether Meridian's cache layer can be relied on for concurrent-write workloads.",
  },
  qualifyingGap: {
    id: "sq-2",
    question: "Are there known failure modes of that locking mechanism under high concurrency?",
    why_it_matters: "A known failure mode would qualify how much the safety guarantee can be trusted.",
    decision_affected: "Confidence level assigned to the concurrency-safety finding.",
    gap_class: "DECISION_RELEVANT",
  },
  explorationGap: {
    id: "sq-3",
    question: "Does Meridian support multi-region synchronous replication for the cache layer?",
    why_it_matters: "Relevant to whether Meridian can be deployed across regions, but not to the primary question.",
    decision_affected: "Multi-region deployment planning (out of scope for the primary decision).",
    gap_class: "DECISION_RELEVANT",
  },
};

export function buildSatisfiedResult(observations: ObservationMessage[]): ResearchResult {
  return synthesizeResearchResult(SATISFIED_CONFIG, observations);
}

// ---------------------------------------------------------------------------
// MORE_RESEARCH_NEEDED scenario
// ---------------------------------------------------------------------------

export const UNRESOLVED_QUESTION = "Does the Meridian caching layer safely support concurrent writes from multiple workers?";

export const UNRESOLVED_STEPS: ResearchLookupStep[] = [{ query: TAG_CONCURRENCY_SAFETY, limit: 5 }];

const UNRESOLVED_CONFIG: SynthesizeScenarioConfig = {
  question: UNRESOLVED_QUESTION,
  primaryGap: {
    id: "sq-1",
    question: "Does per-key locking safely serialize concurrent writes from multiple workers?",
    why_it_matters: "This is the core safety property the research question depends on.",
    decision_affected: "Whether Meridian's cache layer can be relied on for concurrent-write workloads.",
  },
};

export function buildUnresolvedCriticalGapResult(observations: ObservationMessage[]): ResearchResult {
  return synthesizeResearchResult(UNRESOLVED_CONFIG, observations);
}
