# S11 — Researcher Agent v1 Verification

## Canonical Part A artifacts (unmodified, ChatGPT-authored, integrated verbatim)

- `brain-bootstrap/skills/RESEARCH_SKILL_S11.md`
- `brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml`
- `brain-bootstrap/specs/RESEARCHER_AGENT_v1.md`

None of the six S11 semantic decisions in `RESEARCHER_AGENT_v1.md` section 3 were reopened or reinterpreted during Part B. Part B implements exactly what those decisions and the T1–T26 contract require.

## Implementation inventory (Part B)

| Path | Role |
|---|---|
| `src/intelligence/research/types.ts` | `ResearchResult` data model (RESEARCHER_AGENT_v1.md sections 6-8), `research.lookup` input/output shapes |
| `src/intelligence/research/researchSkill.ts` | Canonical Skill/capability identifier constants (`research.evidence-grounded.s11`, `research.lookup`, quality-contract ref, max lookup limit) shared by the definition, the bridge, and the provider |
| `src/intelligence/research/materializeResearchTask.ts` | The S11 Intelligence-layer Skill materialization bridge (section 4) — question + base `AgentDefinition` → task-specific `AgentDefinition`; no registry, no dynamic loading, no role branching |
| `src/intelligence/research/validateResearchResult.ts` | `validateResearchResult()` (section 10 material claim acceptance invariant + structural completeness) and `mapResearchResultToStructuredOutput()` (section 9 exact `StructuredAgentOutput` mapping) |
| `src/intelligence/agent-definitions/researcherDefinition.ts` | The real `researcher-v1` `AgentDefinition` (section 5), including the full `state_schema` (section 6) and `output_schema` (section 8) |
| `src/providers/capability/referenceResearchCapabilityProvider.ts` | `ReferenceResearchCapabilityProvider` — the real `research.lookup` `CapabilityProvider` implementation: read-only, `side_effects: NONE`, bounded (`limit` 1–5, rejects >5), searches an injected deterministic corpus, never returns the same result set for unrelated queries |
| `tests/research/fixtures/corpus.ts` | Deterministic "Meridian" fixture source corpus (fictional, self-consistent — see "Source fixture characteristics" below) |
| `tests/research/fixtures/deterministicResearchModelProvider.ts` | `DeterministicResearchModelProvider` — a configurable, no-network `ModelProvider` fixture that issues planned `research.lookup` calls and then builds the final `ResearchResult` **from the actual returned observations**, never from a hardcoded answer |
| `tests/research/fixtures/scenarios.ts` | `synthesizeResearchResult()` — one shared, evidence-derived synthesizer, plus the two scenario configs (SATISFIED and MORE_RESEARCH_NEEDED) that drive it |
| `tests/research/researcher.test.ts` | T1–T26 contract tests |
| `brain-bootstrap/reports/S11-researcher-verification.md` | This report |

**Material decision not dictated by Part A:** T2 requires parsing `S11_RESEARCHER_STANDARD.yaml` and asserting specific field values. No YAML parser existed in the repository. Added `js-yaml` + `@types/js-yaml` as **devDependencies only** (verified: zero references from any `src/` file — `grep -rn "js-yaml" src/` returns no matches; `git diff package.json` shows only the two devDependency lines). This is a mechanical test-tooling choice, analogous to S07's `better-sqlite3`, not an architectural or semantic decision, and does not affect the runtime build.

No other new dependency was introduced.

## Environment

`node --version` under the shell's default `PATH` still resolves to a separately-installed Node 22 (`/home/yosman/.local/bin/node`), which shadows the project-required Node 24 installed via `nvm`. Fixed for this session by prepending `/home/yosman/.nvm/versions/node/v24.19.0/bin` to `PATH` (not a repository change). All commands below were run under:

```
node --version → v24.19.0
which node → /home/yosman/.nvm/versions/node/v24.19.0/bin/node
```

## T1–T26 results

All 26 required contract-test semantics are implemented; several are covered by more than one `it()` for clarity. All PASS.

| Test | Result | Notes |
|---|---|---|
| T1 — Research Skill artifact integrity | **PASS** | File exists at the canonical path and contains all required canonical terms |
| T2 — Quality Contract instance integrity | **PASS** | Parses via `js-yaml`; `depth=STANDARD` and all required boolean flags confirmed; all canonical S04 template sections present |
| T3 — Researcher AgentDefinition validates | **PASS** | `validateAgentDefinition(researcherDefinition)` → `{valid: true, errors: []}` |
| T4 — Researcher remains on generic runtime | **PASS** | Real run reaches `SUCCESS` via `compileAgentDefinition()`→`runAgent()`; mechanical scan of `src/` finds no `runResearcherRuntime(` |
| T5 — no role conditional in Core | **PASS** | Mechanical scan of `src/core/agent/` finds no `role === "researcher"` and no forbidden `../../providers` / `../../intelligence` imports |
| T6 — capability policy is exact | **PASS** | `tools === capabilities === ["research.lookup"]`; `RestrictedCapabilityProvider` blocks an unlisted capability before it reaches the injected provider |
| T7 — research.lookup performs a real bounded lookup | **PASS** | Two distinct queries return two distinct, non-empty, non-identical result sets; `limit: 6` is rejected |
| T8 — bounded retrieval | **PASS** | All planned lookups request ≤5; against a synthetic 7-record corpus sharing one tag, an unspecified `limit` truncates to exactly 5 and `limit: 3` truncates to exactly 3 (the real 4-record Meridian corpus alone could never exceed the cap, so a wider synthetic corpus was used to genuinely exercise truncation) |
| T9 — Knowledge Gap Analysis visible | **PASS** | 3 subquestions, gap-classified, each with non-empty `why_it_matters`/`decision_affected` |
| T10 — authoritative source preference | **PASS** | The concurrency-safety finding includes the `PRIMARY` Meridian spec alongside the `SECONDARY` runbook |
| T11 — evidence metadata completeness | **PASS** | Every evidence field is non-empty on every finding's evidence items |
| T12 — claim confidence and limitations | **PASS** | Valid enum values and array-typed `limitations` on every finding |
| T13 — STANDARD cross-validation | **PASS** | Positive: the concurrency-safety finding's evidence spans 2 distinct `independence_group` values (`meridian-official-docs`, `meridian-sre`). Negative: a corpus variant with the second source re-tagged into the *same* group as the first still returns both evidence items but correctly does **not** count them as independent — confidence drops to `LOW` and the cross-validation-unavailable limitation is present |
| T14 — unsupported critical claim rejected | **PASS** | `validateResearchResult()` rejects `DECISION_CRITICAL` + `EVIDENCED` + `evidence: []` |
| T15 — explicit inference accepted but visible | **PASS** | `INFERENCE` + limitations is accepted; `epistemic_status` is not mutated to `EVIDENCED` |
| T16 — explicit uncertainty accepted but visible | **PASS** | `UNCERTAIN` + limitations accepted; `UNCERTAIN` with **no** limitations correctly rejected (extra negative case) |
| T17 — contradictions surfaced | **PASS** | The race-condition incident is surfaced as an `UNRESOLVED` contradiction referencing both sides' evidence |
| T18 — unknowns surfaced | **PASS** | The multi-region gap appears in `unknowns`; no finding fabricates a multi-region claim |
| T19 — VOI SATISFIED | **PASS** | `research_status.state === "SATISFIED"`, `additional_research_expected_to_change_decision === false`, non-empty reason |
| T20 — VOI unresolved path | **PASS** | With a corpus containing zero concurrency evidence, run reaches `SUCCESS` with `research_status.state === "MORE_RESEARCH_NEEDED"`, the gap listed in `unresolved_decision_critical_gaps`, **and `findings === []`** (no fabricated resolution) |
| T21 — StructuredAgentOutput exact mapping | **PASS** | `output.summary === output.data.decision_relevant_summary` |
| T22 — evidence_refs exact mapping | **PASS** | Matches the manually-computed deterministic de-duplicated first-occurrence union exactly; no duplicates |
| T23 — evidence-dependent result | **PASS** | Removing the independent SRE runbook source (`meridianCorpusWithoutIndependentCorroboration`) changes the concurrency finding's `confidence` (`MEDIUM`→`LOW`), `limitations`, **`claim` text, and the overall `decision_relevant_summary`** — all four are asserted to differ. A separate assertion also confirms the finding's `claim` literally contains the corpus excerpt text, proving it is built from returned evidence rather than fixed narrative (see "Bugs discovered and fixed" below) |
| T24 — provider neutrality | **PASS** | No forbidden vendor/provider token found in `researcherDefinition`, the Skill markdown, or the Quality Contract YAML |
| T25 — memory safety | **PASS** | `commit_verified_memory === false`, `promotion_policy === "EXPLICIT_VERIFIED_ONLY"` |
| T26 — full regression | **PASS** | See "Regression" below |

## Regression

`npm test` (vitest): **84/84 passed**, 4 test files — the pre-existing 46 (S07 MemoryProvider + S09 Agent Runtime + S10 AgentDefinition, unchanged) plus 38 new S11 tests. No existing test file was modified.

```
npm run typecheck   → 0 errors
npm test            → 84/84 PASS
rm -rf dist && npm run build → succeeds
npm test (post-build) → 84/84 PASS (unchanged)
```

## Real verification question and source fixture characteristics

**SATISFIED-scenario question:** "Does the Meridian caching layer safely support concurrent writes from multiple workers, and is it ready for multi-region synchronous replication?"

"Meridian" is a deliberately fictional internal system — the fixture corpus is bounded, synthetic, and internally consistent (RESEARCHER_AGENT_v1.md section 16 requires a bounded deterministic corpus, not real internet sources), so no real-world claim is being made or fabricated.

Corpus (`tests/research/fixtures/corpus.ts`), meeting every section-16 minimum:

| Record | Type | Independence group | Date | Role |
|---|---|---|---|---|
| Meridian Architecture Specification v3 | PRIMARY | `meridian-official-docs` | 2024-01-10 | Supports concurrency-safety claim |
| Meridian Ops Runbook | SECONDARY | `meridian-sre` | 2024-03-02 | Independently corroborates the same claim |
| Meridian Incident Report INC-482 | DIRECT_OBSERVATION | `meridian-incidents` | 2023-11-20 | Qualifies/contradicts the claim under extreme load |
| Meridian Storage Backend Overview | SECONDARY | `meridian-official-docs` | 2023-06-01 | Irrelevant filler, proves queries don't return everything |

≥3 records ✓, ≥1 PRIMARY ✓, ≥2 independent groups on one claim ✓, ≥1 contradictory/qualifying item ✓, ≥1 deliberately unresolved material gap (multi-region — no record addresses it at all) ✓, dates present on every record ✓.

## Evidence trace (independent-verifier criterion, RESEARCHER_AGENT_v1.md section 17)

For the DECISION_CRITICAL finding (`finding-sq-1`):

```
finding "finding-sq-1"
  → evidence_ref "ev-meridian-spec-v3"
      → source_ref "meridian-spec-v3"
      → locator "spec://meridian/v3#concurrency"
      → traces to tests/research/fixtures/corpus.ts MERIDIAN_SPEC
  → evidence_ref "ev-meridian-ops-runbook"
      → source_ref "meridian-ops-runbook"
      → locator "runbook://meridian/ops#locking"
      → traces to tests/research/fixtures/corpus.ts MERIDIAN_RUNBOOK
```

Both evidence items were returned by an actual `research.lookup` invocation (not asserted independently of the tool call) — confirmed by `T21`/`T22`/`mapResearchResultToStructuredOutput` tests reading `result.output` from the real `runAgent()` result, not from the fixture module directly.

## Contradiction demonstrated

`data.contradictions[0]`: topic "Concurrency safety under extreme load", referencing both the supporting evidence (`ev-meridian-spec-v3`, `ev-meridian-ops-runbook`) and the qualifying incident evidence (`ev-meridian-incident-482`), `resolution: "UNRESOLVED"`. Not discarded in favor of the cleaner-sounding "safe" claim.

## Unresolved unknown demonstrated

`data.unknowns[0]`: the multi-region synchronous-replication question — zero corpus records match, and no finding fabricates an answer for it (verified by T18).

## VOI behavior demonstrated

- **SATISFIED** path (T19): decision-critical gap resolved, non-blocking residual gap explicit, `additional_research_expected_to_change_decision: false`.
- **MORE_RESEARCH_NEEDED** path (T20): decision-critical gap has zero evidence in the bounded corpus; `findings: []` (no fabrication); gap listed in `unresolved_decision_critical_gaps`; `additional_research_expected_to_change_decision: true`. The run still reaches S09 `SUCCESS` (a well-formed, honest structured output was produced) — S09's existing `BLOCKED` outcome was deliberately not used here since the run did not fail to execute; it completed and correctly reported that more research is needed. No fourth `TerminalOutcome` was introduced.

## Proof that output depends on evidence (not a canned answer)

T23 removes the independent SRE-runbook source from the corpus and re-runs the identical question/model/definition. The `finding-sq-1` confidence changes `MEDIUM`→`LOW`, gains an explicit "cross-validation could not be completed" limitation, **and its `claim` text changes** (the claim is built by concatenating the actual returned excerpts — see `citeExcerpts()` in `scenarios.ts` — so losing a source's excerpt necessarily changes it), and **the overall `decision_relevant_summary` changes** too, since it is assembled from the same per-gap evidence-derived text. `synthesizeResearchResult()` never contains the final answer as a fixed string; `research_status.state`/`reason`/`unresolved_decision_critical_gaps` are likewise computed from whether the primary gap's lookup actually returned evidence, not asserted independently of it.

## Core / provider-neutrality checks

```
grep -rniE 'role[[:space:]]*===[[:space:]]*.(researcher|builder|verifier).' src/core/agent/
→ NONE FOUND

grep -rn "from \"../../providers\|from \"../providers\|from \"../../intelligence\|from \"../intelligence" src/core/agent/
→ NONE FOUND

git diff --stat -- package.json package-lock.json
→ only js-yaml/@types/js-yaml devDependency additions
```

## Limitations and deferred scope (honest, per RESEARCHER_AGENT_v1.md section 22)

S11 PASS does **not** prove: general web research quality, real hosted-LLM research quality, open-internet source discovery, production source ranking, generic Skill loading (S12), generic capability discovery (S14), or multi-agent verification (S15+). The corpus is small, fictional, and hand-authored; the "model" is a deterministic fixture whose control flow (which query to issue next) is fixed in advance — only the *content* of its findings/confidence/contradictions/summary/status is evidence-dependent, per RESEARCHER_AGENT_v1.md Decision 3 ("the deterministic model may control predictable decision sequencing, but it MUST consume returned tool observations to construct its result"). `output_schema` is not enforced by a runtime validator against `StructuredAgentOutput.data` (this was already explicitly deferred by S10 and remains deferred here — `validateResearchResult()` performs the equivalent enforcement outside Core, as the contract permits). `materializeResearchTask()`'s objective-interpolation strategy is a straightforward, literal implementation choice (append the question to the base objective) — Part A left the exact interpolation mechanics unspecified beyond "may derive its objective from" the base objective/question/skill rules/quality contract, so this is a reasonable mechanical choice, not a semantic decision affecting any of the six resolved ambiguities.

Two further gaps, deliberately left unfixed as out of S11's required scope (both pre-date S11 — S10 established the same deferral pattern for `output_schema`):

- **`assertCapabilitiesExist()` is never called on the S11 path.** S10 §22 step 3 (via `AGENT_RUNTIME_LOOP_v1.md`) defines this as a separate, optional pre-flight check (`compileAgentDefinition()` itself doesn't call it, and no existing S07/S09/S10 test calls it either). If a `CapabilityProvider` were ever wired up missing `research.lookup`, the Researcher would `BLOCK` mid-run (S09's existing `REQUIRED_CAPABILITY_MISSING` path) rather than fail fast at compile time. This is pre-existing S09/S10 behavior, not an S11 regression.
- **`researcherDefinition.state_schema` (`open_gap_ids`, `lookup_count`, `evidence_refs_seen`) is declared but never populated or enforced.** No code in `src/core/agent/runtime.ts` reads `state_schema` at all (confirmed by inspection — it validates only that `state_schema` is *a* valid `JsonSchemaLike` object, per S10 §20). Separately, S09's runtime unconditionally writes `observation:<call_id>` keys into `working_state` on every tool observation, which would violate the declared schema's `additionalProperties: false` if it were ever enforced. This inconsistency is inherited unchanged from S09/S10 (no `AgentDefinition`, including the S10 reference ones, has ever had its `state_schema` enforced) and is out of S11's contract scope to fix.

## Bugs discovered and fixed during verification

**One material bug, caught by independent (advisor) review before this report was finalized — not by a failing test.** The first implementation of `scenarios.ts` built `decision_relevant_summary` and `research_status` from **fixed prose strings** (e.g. a literal sentence asserting "Meridian's cache layer safely serializes concurrent writes..." and a hardcoded `state: "SATISFIED"` / `unresolved_decision_critical_gaps: []`), while only the `finding`'s `confidence`/`limitations` were genuinely computed from the returned evidence. This directly violated `RESEARCHER_AGENT_v1.md` Decision 3 ("The deterministic model MUST NOT contain the final research answer as a canned constant... A change in the source fixture must be capable of changing the resulting finding") and §21's failure condition ("final research output does not depend on retrieved Evidence") — it is exactly the "plausible prose over absent evidence" failure mode S11 exists to prevent. Proof it was a real bug: run against `meridianCorpusWithoutConcurrencyEvidence` (zero matching evidence) still emitted `state: "SATISFIED"` with a summary asserting the claim was resolved.

**Fix:** replaced the two separate hand-written `buildResult` functions with one shared `synthesizeResearchResult()` (`tests/research/fixtures/scenarios.ts`) that derives every output field — finding `claim`, `confidence`, `limitations`, contradiction `description`, unknown `reason_unresolved`, `decision_relevant_summary`, and `research_status.state`/`reason`/`unresolved_decision_critical_gaps`/`additional_research_expected_to_change_decision` — from the actual `ResearchLookupResultItem[]` each `research.lookup` call returned. `research_status.state` is now computed strictly as `SATISFIED` only if the DECISION_CRITICAL gap's lookup returned ≥1 result, else `MORE_RESEARCH_NEEDED`. T23 was strengthened to assert `claim` and `decision_relevant_summary` differ (not just `confidence`/`limitations`) between the full and reduced corpora, plus a new assertion that the claim literally contains the corpus excerpt text — both now pass, which is the actual proof the fix works, not just that the bug is gone. A second, independent gap the same review raised — T13 only tested the positive cross-validation case, not the "duplicate/upstream-equivalent source" negative case explicitly required by `RESEARCH_SKILL_S11.md` §12 — was also fixed by adding `meridianCorpusWithDuplicateIndependenceGroup` and a dedicated negative test.

One non-bug design consideration was resolved proactively during fixture authoring, before any code was written against it: an early corpus-tag draft used single-word tags (e.g., a bare `"concurrency"` tag) that would have caused the race-condition query (which itself contains the substring `"concurrency"`) to spuriously match the concurrency-safety sources too. Tags were redesigned as specific multi-word phrases with no accidental substring overlap, and the lookup matcher was kept one-directional (`query.includes(tag)`).
