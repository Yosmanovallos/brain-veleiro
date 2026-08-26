import type { ResearchSourceRecord } from "../../../src/intelligence/research/types.js";

/**
 * Deterministic S11 verification corpus.
 *
 * A fictional internal system ("Meridian") is used deliberately: these are
 * bounded, synthetic, internally-consistent fixture "sources" the reference
 * research.lookup capability searches over, not claims about any real-world
 * product. This satisfies RESEARCHER_AGENT_v1.md section 16's minimum
 * corpus characteristics:
 *   - >= 3 source records (4 here)
 *   - >= 1 PRIMARY source (MERIDIAN_SPEC)
 *   - >= 2 independent source groups supporting one material claim
 *     (MERIDIAN_SPEC's "meridian-official-docs" and MERIDIAN_RUNBOOK's
 *     "meridian-sre" both support concurrency safety)
 *   - >= 1 contradictory/qualifying evidence item (MERIDIAN_INCIDENT)
 *   - >= 1 deliberately unresolved material gap (no record answers the
 *     multi-region/cross-region replication question at all)
 *   - source dates present on every record
 */

export const TAG_CONCURRENCY_SAFETY = "concurrent writes safety";
export const TAG_LOCKING_GUARANTEE = "per key locking guarantee";
export const TAG_RACE_CONDITION = "race condition high concurrency";
export const TAG_STORAGE_BACKEND = "storage backend durability";

export const MERIDIAN_SPEC: ResearchSourceRecord = {
  source_ref: "meridian-spec-v3",
  title: "Meridian Architecture Specification v3",
  source_type: "PRIMARY",
  authority: "Meridian Core Team",
  independence_group: "meridian-official-docs",
  observed_or_published_at: "2024-01-10",
  locator: "spec://meridian/v3#concurrency",
  excerpt:
    "The Meridian caching layer uses per-key locking to guarantee that concurrent writes " +
    "from multiple workers are serialized safely.",
  topic_tags: [TAG_CONCURRENCY_SAFETY, TAG_LOCKING_GUARANTEE],
};

export const MERIDIAN_RUNBOOK: ResearchSourceRecord = {
  source_ref: "meridian-ops-runbook",
  title: "Meridian Ops Runbook",
  source_type: "SECONDARY",
  authority: "Meridian SRE Team",
  independence_group: "meridian-sre",
  observed_or_published_at: "2024-03-02",
  locator: "runbook://meridian/ops#locking",
  excerpt:
    "Per-key locking in the cache layer has been verified in production; no write-conflict " +
    "incidents have been recorded since v3.",
  topic_tags: [TAG_CONCURRENCY_SAFETY],
};

export const MERIDIAN_INCIDENT: ResearchSourceRecord = {
  source_ref: "meridian-incident-482",
  title: "Meridian Incident Report INC-482",
  source_type: "DIRECT_OBSERVATION",
  authority: "Meridian Incident Response",
  independence_group: "meridian-incidents",
  observed_or_published_at: "2023-11-20",
  locator: "incident://meridian/482",
  excerpt:
    "A race condition was observed in the cache layer's per-key locking under extremely high " +
    "write concurrency (>500 concurrent workers), causing a transient stale read.",
  topic_tags: [TAG_RACE_CONDITION],
};

export const MERIDIAN_STORAGE_OVERVIEW: ResearchSourceRecord = {
  source_ref: "meridian-storage-overview",
  title: "Meridian Storage Backend Overview",
  source_type: "SECONDARY",
  authority: "Meridian Core Team",
  independence_group: "meridian-official-docs",
  observed_or_published_at: "2023-06-01",
  locator: "spec://meridian/storage#overview",
  excerpt: "Describes the on-disk storage backend and durability guarantees, unrelated to cache concurrency.",
  topic_tags: [TAG_STORAGE_BACKEND],
};

/** Full deterministic corpus used by the SATISFIED verification scenario. */
export const meridianCorpus: ResearchSourceRecord[] = [
  MERIDIAN_SPEC,
  MERIDIAN_RUNBOOK,
  MERIDIAN_INCIDENT,
  MERIDIAN_STORAGE_OVERVIEW,
];

/**
 * Corpus with the independent SRE corroboration removed (T23 "evidence-dependent
 * result"): the concurrency-safety claim now has only ONE independent source
 * group instead of two, so cross-validation can no longer be completed.
 */
export const meridianCorpusWithoutIndependentCorroboration: ResearchSourceRecord[] = meridianCorpus.filter(
  (record) => record.source_ref !== MERIDIAN_RUNBOOK.source_ref,
);

/**
 * Corpus with every concurrency-related source removed, used by the
 * MORE_RESEARCH_NEEDED verification scenario: the decision-critical question
 * has zero matching evidence anywhere in the bounded corpus.
 */
export const meridianCorpusWithoutConcurrencyEvidence: ResearchSourceRecord[] = [MERIDIAN_STORAGE_OVERVIEW];

/**
 * T13 negative case (RESEARCHER_AGENT_v1.md section 11 / RESEARCH_SKILL_S11.md
 * section 12: "Cross-validation is not satisfied by duplicate upstream
 * claims"): MERIDIAN_RUNBOOK re-tagged into the SAME independence_group as
 * MERIDIAN_SPEC, simulating a duplicate/upstream-equivalent source rather
 * than a genuinely independent one.
 */
export const MERIDIAN_RUNBOOK_SAME_GROUP: ResearchSourceRecord = {
  ...MERIDIAN_RUNBOOK,
  independence_group: MERIDIAN_SPEC.independence_group,
};

export const meridianCorpusWithDuplicateIndependenceGroup: ResearchSourceRecord[] = [
  MERIDIAN_SPEC,
  MERIDIAN_RUNBOOK_SAME_GROUP,
  MERIDIAN_INCIDENT,
  MERIDIAN_STORAGE_OVERVIEW,
];
