# S13C — Deep Research — Part B Verification Report

**Step:** S13C (deep-research), Part B (Claude Code implementation)
**Depends on:** S09, S10, S11 (Research Skill/`ResearchResult`/`research.lookup`), S12, S13B (Knowledge Gap Analysis)
**Part A (ChatGPT semantic authoring):** integrated verbatim in commit `677b5cc` (HEAD placeholder fixed in `e77e273`) — unchanged by this closure.
**Canonical contract:** `brain-bootstrap/specs/DEEP_RESEARCH_AGENT_v1.md`

---

## 1. Implementation inventory

New files (6 production + 2 test):

```text
src/intelligence/deep-research/deepResearchSkill.ts
src/intelligence/deep-research/types.ts
src/intelligence/deep-research/selectDeepResearchItems.ts
src/intelligence/deep-research/materializeDeepResearchTask.ts
src/intelligence/deep-research/validateDeepResearchResult.ts
src/intelligence/deep-research/compareDeepResearchRuns.ts
src/intelligence/agent-definitions/deepResearcherDefinition.ts
src/intelligence/skills/definitions/deepResearchS13C.ts

tests/deep-research/fixtures.ts
tests/deep-research/deepResearch.test.ts
```

Modified file (1):

```text
src/intelligence/skills/index.ts
  — adds deepResearchS13C to the shared reference Skill catalog
    (referenceSkillCatalogEntries) and re-exports it, alongside the S11
    Research Skill, the S12 reference/test Skills, the S13A Requirements
    Discovery Skill, and the S13B Knowledge Gap Analysis Skill. Each Agent's
    `skills` allowlist bounds discoverability per-Agent (unaffected here —
    T7/T28 verify this).
```

No `package.json`/`package-lock.json` change — zero new dependencies (`git diff --stat package.json package-lock.json` empty).

A new, independent `deep-researcher-v1` `AgentDefinition` was created per spec sections 2–3 — it does **not** reuse or modify `researcher-v1`, `knowledge-gap-analyzer-v1`, or `requirements-discoverer-v1`. It declares `tools: ["research.lookup"]` and `capabilities: ["research.lookup"]` (the identical normalized set, DR spec section 4) and reuses, unmodified, S11's `ResearchResult`, `validateResearchResult()`, `research.lookup` capability, and evidence/epistemic vocabulary (DR spec section 7).

---

## 2. T1–T28 result table

The 28 canonical test IDs map to **58 concrete `it()` cases** across 28 `describe()` blocks in `tests/deep-research/deepResearch.test.ts` (several IDs have more than one case — 4 cases were added during the independent review below, plus 2 assertions added to an existing T27 case).

| ID | Description | Result |
|---|---|---|
| T1 | canonical S13C Skill exists | PASS |
| T2 | typed S13C Skill validates (S12 contract) | PASS |
| T3 | S11 semantic dependency preserved, no S11 vocabulary redefinition | PASS (2 cases) |
| T4 | dedicated DEEP Quality Contract integrity | PASS |
| T5 | `deep-researcher-v1` validates; independent of other AgentDefinitions | PASS (2 cases) |
| T6 | capability set exact (`research.lookup` only) | PASS (2 cases) |
| T7 | exact S13C Skill allowlist | PASS |
| T8 | S12 discovery selects S13C | PASS (2 cases) |
| T9 | lazy selected load only | PASS |
| T10 | queue selection bounded (default 1, max 3) | PASS (5 cases — includes a new live 2-item run added during review) |
| T11 | only NEEDS_RESEARCH selectable | PASS |
| T12 | UNKNOWABLE exclusion | PASS |
| T13 | S13B traceability preserved | PASS |
| T14 | S11 `validateResearchResult` reused, not reimplemented | PASS |
| T15 | S11/S13B epistemic vocabularies remain separate | PASS |
| T16 | independent cross-validation counts distinct groups | PASS |
| T17 | duplicate independence_group does not cross-validate | PASS (2 cases) |
| T18 | authoritative/primary preference | PASS (4 cases — 2 new cases added during review for the singular-authority-exception fix) |
| T19 | contradiction visible | PASS |
| T20 | recency qualification (DR-R10) | PASS (4 cases — 1 new case added during review proving the rule is question-relative, not claim-text-relative) |
| T21 | VOI/research-status mapping | PASS (3 cases) |
| T22 | closure recommendation mapping | PASS (4 cases) |
| T23 | upstream S13B immutability | PASS |
| T24 | same S10/S09 runtime path | PASS (2 cases) |
| T25 | no role/Skill branching in Core | PASS (2 cases) |
| T26 | evidence-dependent output | PASS (2 cases) |
| T27 | Skill improves over baseline | PASS (3 cases — negative-fixture case extended with 2 new assertions during review) |
| T28 | full regression | PASS (6 cases) |

**Total: 58/58 new assertions PASS, 28/28 canonical test IDs covered.**

---

## 3. Test counts / typecheck / build

- `npm run typecheck`: **0 errors** (re-run after the independent-review fixes below).
- `npx vitest run tests/deep-research/deepResearch.test.ts`: **58/58 passed**.
- `npm test` (full suite, pre-build): **268/268 passed** (210 pre-existing at S13B close + 58 new S13C tests).
- `rm -rf dist && npm run build`: succeeded, 0 errors.
- `npm test` (full suite, post-build): **268/268 passed**, unchanged from pre-build.

---

## 4. Positive research fixture

`POSITIVE_DEEP_RESEARCH_KGA` / `POSITIVE_DEEP_RESEARCH_INPUT` (`tests/deep-research/fixtures.ts`): a S13B `KnowledgeGapAnalysisResult` with `K-Q1` (DECISION_CRITICAL, blocking, "how is the purchased plush technically identified?") and `K-Q2` (DECISION_RELEVANT, non-blocking). Corpus `POSITIVE_CORPUS` has three real `ResearchSourceRecord`s: `SRC-PRIMARY-1` (PRIMARY, `independence_group: "vendor-docs"`), `SRC-INDEPENDENT-2` (DIRECT_OBSERVATION, `independence_group: "local-test"`), `SRC-QUALIFIER-3` (PRIMARY, same `"vendor-docs"` group, used as a QUALIFIES-relationship scope limitation, not a second independent SUPPORTS group). The Skill-mode plan (`POSITIVE_SKILL_STEPS`) issues 3 targeted, relationship-tagged lookups; the baseline plan (`POSITIVE_BASELINE_STEPS`) issues 1 untagged, non-matching probe query with no `relationship`, which the synthesizer discards without reading (`if (!step.relationship) continue`). Meets DR spec section 21's minimum positive-fixture characteristics: ≥2 distinct independence groups available, a PRIMARY source, a QUALIFIES-relationship limitation source.

## 5. Negative duplicate-source/contradiction fixture

`NEGATIVE_DEEP_RESEARCH_KGA` / `NEGATIVE_DEEP_RESEARCH_INPUT`: `K-NEG-1` (DECISION_CRITICAL, blocking, research_question `"¿El proveedor X soporta actualmente la característica requerida?"`). Corpus `NEGATIVE_CORPUS`: `COPY-A`/`COPY-B` (both SECONDARY, both `independence_group: "upstream-blog-1"`, dated 2026-01-10/01-12 — ~228/226 days before the fixed reference date), and `OFFICIAL-CURRENT` (PRIMARY, `independence_group: "vendor-docs"`, dated 2026-08-20, contradicting COPY-A/COPY-B). Skill-mode plan issues both the community-tag query (labelled `CONTRADICTS`) and the official-tag query (labelled `SUPPORTS`); baseline plan issues only the community-tag query (labelled `SUPPORTS`), so both arms retrieve the *same* first result set — only plan depth and relationship labeling differ (see section 13 below for the disclosure this implies about the metrics). Meets DR spec section 22's negative-fixture characteristics: a false duplicate-independence pair and a hidden authoritative contradiction.

---

## 6. Selected queue items / batch bound / order / S13B eligibility / UNKNOWABLE exclusion

- T10: default selection is `["K-Q1"]` with `K-Q2` deferred; `max_research_items: 2` selects `["K-Q1", "K-Q2"]` in queue order; `max_research_items` outside `[1,3]` throws. A new live case runs a full 2-item batch through `compileAgentDefinition()`/`runAgent()` (not just the unit-level `selectDeepResearchItems`) and asserts `data.items[0].knowledge_item_id === "K-Q1"` with real evidence, `data.items[1].knowledge_item_id === "K-Q2"` with zero evidence — proving the shared sequential tool-call stream is partitioned back to the correct item by the `obsCursor` slicing in `DeterministicDeepResearchModelProvider`, not just at the unit-selection level.
- T11/T12: a research_queue entry whose upstream item is not `NEEDS_RESEARCH`, or that appears in `handoff.unknowable_item_ids`, is rejected with a descriptive error referencing DR-P1/DR-R1/DR-R2.
- T13: `knowledge_item_id`, `research_question`, `decision_impact`, and `blocking` are preserved exactly from the S13B queue entry into the S13C item.

---

## 7. S11 ResearchResult validator reuse / claim-level epistemic evidence

`validateDeepResearchResult` calls the real, unchanged `validateResearchResult()` (imported from `../research/validateResearchResult.js`) once per item — it never reimplements or weakens S11's material-claim-acceptance invariant. T14 hand-crafts an invalid `ResearchResult` and asserts the error carries **both** the S13C-added `"S11 validateResearchResult, T14 reuse"` tag and S11's own original error text verbatim, proving true delegation rather than a parallel check. T15 confirms a finding's `epistemic_status` (EVIDENCED/INFERENCE/UNCERTAIN) stays fully distinct from the upstream item's `upstream_epistemic_status`, which is always the literal string `"NEEDS_RESEARCH"` (S13B's own vocabulary never leaks into S11's).

---

## 8. Source quality / independence groups / primary-authority / recency / contradiction evidence

- **Independence groups (T16/T17):** `countSupportingIndependenceGroups()` counts distinct `independence_group` values among `SUPPORTS`-relationship evidence only. Two evidence items sharing one group (`COPY-A`/`COPY-B`, both `"upstream-blog-1"`) count as **one** family, not two (T17 unit test). The positive fixture's material finding uses ≥2 distinct groups (T16).
- **Primary/authority preference (T18):** the positive fixture's material claim includes a PRIMARY source; the negative fixture's Skill run recommends `RESOLVED_BY_AUTHORITY` backed by the PRIMARY `OFFICIAL-CURRENT` source over the duplicated SECONDARY sources.
- **Recency (T20, DR-R10):** a current-state claim (`CURRENT_STATE_CUE` matched against the finding's claim text **or** the item's `research_question`) supported only by evidence older than `STALE_EVIDENCE_THRESHOLD_DAYS = 90` days (relative to the fixed `DEEP_RESEARCH_RECENCY_REFERENCE_DATE = 2026-08-26`, never `Date.now()`) with no recency limitation is rejected; the same claim with an explicit recency limitation, or a stable historical claim on an old source, is accepted.
- **Contradiction (T19):** the negative fixture's contradiction between `COPY-A`/`OFFICIAL-CURRENT` is surfaced in `research.contradictions`, referencing both `ev-OFFICIAL-CURRENT` and `ev-COPY-A` — never silently erased.

---

## 9. VOI / research status / closure recommendation rationale

- T21: the positive and negative Skill runs both reach `SATISFIED`; `MORE_RESEARCH_NEEDED` is accepted only paired with `recommended_closure_state: null` (unit-level, `validateClosureRecommendationMapping`).
- T22: the full closure mapping from DR spec section 12 is enforced — `MORE_RESEARCH_NEEDED` → null only; `EXHAUSTED_WITH_UNCERTAINTY` → null, or `BLOCKED` only when `decision_impact === "DECISION_CRITICAL" && blocking === true`; `SATISFIED` → `RESOLVED_WITH_EVIDENCE` or `RESOLVED_BY_AUTHORITY` only; `RESOLVED_BY_AUTHORITY` requires ≥1 PRIMARY evidence item; `ACCEPTED_AS_ASSUMPTION`/`DEFERRED_WITHOUT_DECISION_IMPACT` are always forbidden (DR-R23).

---

## 10. Skill-vs-baseline metrics / same-runtime proof

All 9 metrics (`material_claim_evidence_coverage_ratio`, `independent_cross_validation_ratio`, `authoritative_or_primary_coverage_ratio`, `contradiction_visibility_ratio`, `traceability_coverage_ratio`, `unsupported_material_claim_count`, `duplicate_independence_overcount`, `stale_current_claim_without_limitation_count`, `closure_overclaim_count`) are implemented in `compareDeepResearchRuns.ts`, sharing `countSupportingIndependenceGroups`, `hasValidSingularAuthorityException`, and `isFindingStaleCurrentClaimWithoutLimitation` with the validator so scoring and enforcement can never drift apart.

**Measured values (captured via a live 4-run probe after the independent-review fixes in section 12):**

Positive fixture:

| metric | baseline | skill |
|---|---|---|
| material_claim_evidence_coverage_ratio | 0 | 1 |
| independent_cross_validation_ratio | 0 | 1 |
| authoritative_or_primary_coverage_ratio | 0 | 1 |
| contradiction_visibility_ratio | 0 | 1 |
| traceability_coverage_ratio | 1 | 1 |
| unsupported_material_claim_count | 1 | 0 |
| duplicate_independence_overcount | 0 | 0 |
| stale_current_claim_without_limitation_count | 0 | 0 |
| closure_overclaim_count | 1 | 0 |

Negative fixture:

| metric | baseline | skill |
|---|---|---|
| material_claim_evidence_coverage_ratio | 1 | 1 |
| independent_cross_validation_ratio | 0 | 1 |
| authoritative_or_primary_coverage_ratio | 0 | 1 |
| contradiction_visibility_ratio | 0 | 1 |
| traceability_coverage_ratio | 1 | 1 |
| unsupported_material_claim_count | 0 | 0 |
| duplicate_independence_overcount | 1 | 0 |
| stale_current_claim_without_limitation_count | 1 | 0 |
| closure_overclaim_count | 1 | 0 |

T27 asserts the 4 required strict inequalities on the positive fixture (`material_claim_evidence_coverage_ratio`, `independent_cross_validation_ratio`, `contradiction_visibility_ratio` skill > baseline; `closure_overclaim_count` skill < baseline) and the 3 required exact values on the negative fixture (`duplicate_independence_overcount === 0`, `unsupported_material_claim_count === 0`, `contradiction_visibility_ratio === 1` for the Skill run), plus (added during review) `stale_current_claim_without_limitation_count`: baseline `1`, skill `0` on the negative fixture.

**Same-runtime proof:** T27's third case and T24 confirm both arms execute through the identical `compileAgentDefinition()` → `runAgent()` path with identical `limits`/`model_policy`/`tools`/`capabilities` — only the materialization (`materializeDeepResearchTask` vs. `materializeBaselineDeepResearchTask`) differs, mirroring the S11/S13B precedent.

**Disclosed metric caveats (not hidden):**
- The positive-fixture inequalities are driven by a fixture-authored plan-depth difference (3 tagged Skill queries vs. 1 untagged, non-matching baseline probe), not an emergent effect discovered at runtime. The **negative fixture is the stronger comparison**: both arms issue the same first query and receive the same first result set; only plan depth (the Skill's second, official-source query) and the fixture-declared `relationship` labels differ.
- `skill.duplicate_independence_overcount === 0` on the negative fixture is structurally guaranteed (the Skill arm's SUPPORTS set has exactly one item), not evidence of dedup logic by itself — the real dedup evidence is T17's unit test on `countSupportingIndependenceGroups`.
- `traceability_coverage_ratio` is vacuous (always `1.0` in these fixtures) — the synthesizer copies `research_question`/`decision_impact`/`blocking` straight from the selected queue item; same class of caveat as S13B's `decision_impact_coverage_ratio`.
- `batch_status` is hardcoded to `"COMPLETE"` in all four live runs (every scenario selects exactly 1 item at the live-run level); `PARTIAL`/`BLOCKED` are exercised only at the type level (T22's unit tests), not through a live multi-item run that actually produces them.
- `contradiction_visibility_ratio`'s true denominator is not derivable from `DeepResearchBatchResult`/`DeepResearchInput` alone; `DeepResearchFixtureGroundTruth.expected_contradiction_count_by_item = {"K-Q1": 1, "K-NEG-1": 1}` is an explicitly disclosed, non-hidden ground-truth parameter supplied by the test harness that authored the fixture corpus (same pattern as S13A's `fabricated_fact_count` and S13B's `told_as_proven_count`).
- The fixed reference date (`2026-08-26`) and the 90-day staleness threshold are Part B operationalizations of the DR spec's qualitative "recency" language, chosen for determinism (never `Date.now()`).
- T28's `evidence_refs` regression check compares a run's output against the same mapper (`mapDeepResearchBatchResultToStructuredOutput`) that produced it — it is a self-consistency check, not independent evidence. Independent evidence for ref correctness/ordering/dedup is a literal-array assertion on the positive Skill run's `evidence_refs` added to T16.

---

## 11. Evidence-dependence mutation proof / upstream S13B immutability proof

- T26: removing `SRC-INDEPENDENT-2`'s distinct `independence_group` from the corpus (folding it into `"vendor-docs"`) flips the positive fixture's `recommended_closure_state` from `RESOLVED_WITH_EVIDENCE` to `RESOLVED_BY_AUTHORITY` and changes the finding's `limitations` — output is a genuine function of the evidence corpus, not a canned response. A second T26 unit case proves the synthesizer itself cannot produce a single canned final response regardless of observations.
- T23: `structuredClone()`-based before/after equality check proves `deep-researcher-v1` never mutates the input `KnowledgeGapAnalysisResult` (S13B's own closure state is read-only from S13C's perspective — S13C only emits a `recommended_closure_state` for a later step to apply, per DR-R23/PASS-criterion 22).

---

## 12. Independent review findings / bugs found and fixed

An independent review pass was run (mirroring the S11/S12/S13A/S13B precedent) before declaring PASS. It found two genuine **Part B implementation defects** (not defects in the approved Part A Skill/spec contract — no `S13C_FEEDBACK_REQUIRED` was warranted):

1. **Singular-authority exception was self-certifying.** `validateFindingIndependenceAndRecency` originally accepted the DEEP source-floor exception whenever a finding's own `limitations` text matched `SINGULAR_AUTHORITY_EXCEPTION_CUE`, with no check that any authoritative evidence actually existed — a finding could recite the magic phrase with only SECONDARY evidence and pass. **Fixed** by adding `hasValidSingularAuthorityException(finding)` (exported from `validateDeepResearchResult.ts`), which additionally requires at least one `SUPPORTS`-relationship, `source_type === "PRIMARY"` evidence item; the validator, and `compareDeepResearchRuns.ts`'s `crossValidated`/`closure_overclaim_count` computations (previously testing the raw regex directly), were all switched to the new shared helper so the exception can never be scored more loosely than it is enforced. Two new regression tests were added to T18 (reject when the cue is present but no PRIMARY SUPPORTS evidence backs it; accept when it does). Verified the negative fixture's Skill arm (backed by `OFFICIAL-CURRENT`, PRIMARY) and T26's mutated-corpus run (backed by `SRC-PRIMARY-1`, PRIMARY) both continue to validate correctly after the fix.

2. **DR-R10 recency rule never fired on the case it was written for.** `isFindingStaleCurrentClaimWithoutLimitation` tested `CURRENT_STATE_CUE` only against `finding.claim` — but the fixture's corpus excerpts never contain a current-state cue; only the *research question* does (`"...soporta actualmente..."`). The DR spec states recency is "question-relative." As a result, the live negative-fixture baseline (a current-state question answered only from ~228-day-old evidence, with zero limitations) never tripped the rule, and `stale_current_claim_without_limitation_count` was `0` in every live run. **Fixed** by testing the cue against `finding.claim` **or** the item's `research_question` (threaded as a new parameter into `isFindingStaleCurrentClaimWithoutLimitation` and into the validator's per-finding call, and computed per-item in `compareDeepResearchRuns.ts`'s metric loop instead of over a flattened, question-less findings array). One new regression test was added to T20 (rejects staleness using only the question cue, with the claim text left unmodified); T27's negative-fixture case was extended with 2 new assertions (`stale_current_claim_without_limitation_count`: baseline `1`, skill `0` — real, previously-undetected signal). Verified the positive/negative Skill arms (evidence dated within the 90-day window) and the stable-historical-fact case (no cue in either claim or question) are unaffected.

A third, cheap coverage gap was also closed without being a defect: the multi-item `obsCursor` observation-partitioning path was previously exercised only at the unit-selection level (T10), never through a live `compileAgentDefinition()`/`runAgent()` run with 2 selected items. A new live 2-item test was added to T10 (`K-Q1` with 3 real lookups, `K-Q2` with 0), proving the shared sequential tool-call stream is sliced back to the correct item.

All fixes were re-verified: `npm run typecheck` (0 errors), `npx vitest run tests/deep-research/deepResearch.test.ts` (58/58), `npm test` full suite pre-build (268/268) and post-build after `rm -rf dist && npm run build` (268/268, unchanged).

---

## 13. Limitations (disclosed, non-blocking)

- The positive fixture's 4 required strict inequalities are driven by an intentional per-arm plan-depth/tag difference authored into the fixture, not something discovered live; treat the negative fixture (where both arms share the same first query/result set) as the stronger comparison — see section 10.
- `traceability_coverage_ratio` is vacuous (always 1.0) in all four fixtures.
- `batch_status` is hardcoded `"COMPLETE"` at the live-run level in every scenario; `PARTIAL`/`BLOCKED` production paths are exercised only via direct unit construction (T22), not through a live run that naturally produces them.
- `contradiction_visibility_ratio`'s denominator relies on a disclosed, test-harness-supplied ground-truth map (`expected_contradiction_count_by_item`), not something derivable from the batch result alone.
- T28's `evidence_refs` check is self-referential against the same mapper it verifies; the literal-array check added to T16 is the independent evidence for ref ordering/dedup.
- The verification "model" is a deterministic, rule-based `ModelProvider` fixture (`DeterministicDeepResearchModelProvider`), not a real LLM — explicitly permitted by DR spec's Part B responsibilities section, mirroring S11/S13A/S13B precedent. A real `ModelProvider` can be substituted with no Core/Intelligence change (`model_policy.allow_provider_substitution: true`).
- The DEEP source-floor exception and DR-R10 recency checks are both cue-regex-based (Spanish/English keyword matching against `limitations`/`claim`/`research_question` text), not semantic understanding — a finding phrased without any matching cue could evade or trigger these checks incorrectly in a real (non-fixture) corpus. This is the same class of limitation the S11 and S13B rule-based checks already carry.

## 14. Deferred scope

Per DR spec section 29 and the standing S13C Part B authorization: S14 and later orchestration steps are not implemented or started; S13C never applies a `recommended_closure_state` back onto S13B's `KnowledgeGapAnalysisResult` (that remains a future step's responsibility, by design — DR-R23/PASS-criterion 22); no new capability, MCP, web, or vendor infrastructure was introduced; no automatic durable-memory promotion occurs (`promotion_policy: "EXPLICIT_VERIFIED_ONLY"`, `commit_verified_memory: false`).
