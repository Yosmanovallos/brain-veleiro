# S13A — Requirements Discovery — Part B Verification Report

**Step:** S13A (requirements-discovery), Part B (Claude Code implementation)
**Depends on:** S04, S05, S09, S10, S12
**Part A (ChatGPT semantic authoring):** integrated verbatim in commit `8d7512e` — unchanged by this closure.
**Canonical contract:** `brain-bootstrap/specs/REQUIREMENTS_DISCOVERY_AGENT_v1.md`

---

## 1. Implementation inventory

New files (7 production + 2 test):

```text
src/intelligence/requirements-discovery/requirementsDiscoverySkill.ts
src/intelligence/requirements-discovery/types.ts
src/intelligence/requirements-discovery/materializeRequirementsDiscoveryTask.ts
src/intelligence/requirements-discovery/validateRequirementsDiscoveryResult.ts
src/intelligence/requirements-discovery/compareRequirementsDiscoveryRuns.ts
src/intelligence/agent-definitions/requirementsDiscovererDefinition.ts
src/intelligence/skills/definitions/requirementsDiscoveryS13A.ts

tests/requirements-discovery/fixtures.ts
tests/requirements-discovery/requirementsDiscovery.test.ts
```

Modified file (1):

```text
src/intelligence/skills/index.ts
  — adds requirementsDiscoveryS13A to the shared reference Skill catalog
    (referenceSkillCatalogEntries) and re-exports it, alongside the existing
    S11 Research Skill and the two S12 reference/test Skills. Each Agent's
    `skills` allowlist bounds discoverability per-Agent (unaffected here —
    verified below, section 6).
```

No `package.json`/`package-lock.json` change — zero new dependencies, matching REQUIREMENTS_DISCOVERY_AGENT_v1.md section 21 ("no new dependency unless genuinely required").

---

## 2. T1–T22 result table

The 22 canonical test IDs map to 45 concrete `it()` cases across 22 `describe()` blocks in `tests/requirements-discovery/requirementsDiscovery.test.ts` (several IDs have more than one case: a positive check, a negative/rejection check, and/or a real-runtime check).

| ID | Description | Result |
|---|---|---|
| T1 | canonical Skill source exists | PASS |
| T2 | typed SkillDefinition validates | PASS |
| T3 | typed Skill preserves canonical semantics | PASS |
| T4 | dedicated Quality Contract integrity | PASS |
| T5 | requirements-discoverer AgentDefinition validates | PASS |
| T6 | no capability/tool dependency | PASS (2 cases) |
| T7 | exact Skill allowlist | PASS |
| T8 | S12 discovery selects S13A | PASS (2 cases: sole-entry allowlist + permissive 3-Skill allowlist) |
| T9 | lazy load selected Skill only | PASS (2 cases: `load()` + `discover()` metadata-only) |
| T10 | same S10/S09 runtime path | PASS (2 cases) |
| T11 | no Skill/role conditional in Core | PASS (2 cases: role/skill-id branch scan + forbidden-import scan) |
| T12 | positive fixture result validates | PASS |
| T13 | positive fixture captures required sections | PASS |
| T14 | traceability rules enforced | PASS (5 cases, including the new RD-V4 containment check) |
| T15 | acceptance linkage enforced | PASS (3 cases) |
| T16 | blocker handoff enforced | PASS (3 cases, including a real-run check) |
| T17 | negative fixture refuses fabrication | PASS (2 cases) |
| T18 | raw-request dependence | PASS (3 cases) |
| T19 | baseline executes through same architecture | PASS |
| T20 | Skill improves over baseline | PASS (2 cases: positive-fixture 6-inequality check + negative-fixture fabrication check) |
| T21 | no S13B semantics pulled forward | PASS (3 cases) |
| T22 | full regression | PASS (6 cases) |

**Total: 45/45 new assertions PASS, 22/22 canonical test IDs covered.**

---

## 3. Test counts / typecheck / build

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm test` (pre-build) | **166/166** PASS (5 pre-existing files, 121 tests + 1 new file, 45 tests) |
| `rm -rf dist && npm run build` | succeeded, no errors |
| `npm test` (post-build) | **166/166** PASS, unchanged |

Baseline before this Part B session (S12 closure / S13A Part A integration): 121/121. Delta: **+45 tests**, all new, none removed or weakened.

---

## 4. Positive fixture evidence (kiosco/peluche)

Raw request (`brain-bootstrap/skills/REQUIREMENTS_DISCOVERY_SKILL_S13A.md` section 11):

> "Necesito una aplicación para que una tienda registre un peluche comprado, pida el nombre del peluche y algunos datos del dueño, y al final imprima un certificado. Se usará en un kiosco con pantalla táctil."

Run through the real `requirementsDiscovererDefinition` → S12 `selectSkillForTask()` (discover+load `requirements.discovery.s13a`) → `materializeRequirementsDiscoveryTask()` → `compileAgentDefinition()` → `runAgent()`, with `DeterministicRequirementsDiscoveryModelProvider` and zero capabilities:

- **3 goals** (registrar el peluche comprado; pedir el nombre del peluche; imprimir el certificado), each `EXPLICIT` with a `source_excerpt` that is a literal substring of the raw request.
- **1 user** (`DERIVED`, from the "kiosco con pantalla táctil" channel cue), with `rationale`.
- **3 unknowns**: identification of the purchased item (HIGH, blocking), required owner data fields (HIGH, blocking), printer/output format (MEDIUM, non-blocking).
- **1 assumption** (the derived user operates the kiosk directly), MEDIUM risk, `must_validate: true`.
- **1 constraint** (touch-screen kiosk interface), `TECHNICAL`, `EXPLICIT`.
- **3 acceptance criteria**, one per goal, each linked, `testable: true`, non-empty `verification_hint`.
- **Handoff**: `ready_for_gap_analysis: true`, `unresolved_blockers: ["Q1", "Q2"]` (both HIGH/blocking unknowns; the MEDIUM/non-blocking one is correctly omitted).

`validateRequirementsDiscoveryResult(result).valid === true`, zero errors (T12).

---

## 5. Negative fixture evidence (underspecified request)

Raw request (canonical, verbatim):

> "Quiero una app para mi negocio. Que sea moderna y fácil de usar."

Skill-assisted run result:

- **1 goal** (`DERIVED`, paraphrasing an unspecified business need), `rationale` non-empty, `source_excerpt: ""`.
- **users: []**, **assumptions: []**, **constraints: []** — no fabricated persona, stack, deadline, budget, or scale.
- **3 unknowns**: what business problem/process (HIGH, blocking), who will use it (HIGH, blocking), what "moderna, fácil de usar" means observably (MEDIUM, non-blocking).
- **1 acceptance criterion** (meta-level: the discovery result itself must surface missing data rather than invent it), linked, testable.
- **Handoff**: `unresolved_blockers: ["Q1", "Q2"]`.

Mechanical scan of the JSON-serialized result confirms **zero** occurrences of: `react`, `postgresql`, `30-day`, `30 días`, `payments`, `10,000`, `store managers`, `retail customers` (T17). `validateRequirementsDiscoveryResult(result).valid === true`.

---

## 6. S12 discovery / lazy-load evidence

- `requirementsDiscovererDefinition.skills === ["requirements.discovery.s13a"]` (T7).
- Discovery through the real, unmodified `LocalReferenceSkillProvider(referenceSkillCatalogEntries)` (the same production catalog S11/S12 use, now holding 4 entries) with the Agent's actual allowlist returns **only** `requirements.discovery.s13a` (T8, case 1).
- Under a permissive 3-Skill allowlist (`requirements.discovery.s13a`, `research.evidence-grounded.s11`, `reference.summarize.v1`), `discover()` returns all 3 candidates but `selectSkillForTask()` still selects and loads **only** S13A; loader spies confirm the other two loaders were called **zero** times (T8, case 2).
- `provider.load({ id: "requirements.discovery.s13a" })` in isolation calls the S13A loader exactly once, all 3 other catalog loaders zero times (T9, case 1).
- `discover()` never invokes any full-definition loader — metadata-only ranking confirmed via spies on all 4 catalog entries (T9, case 2).
- Adding S13A to the shared catalog did not change any pre-existing S11/S12 ranking or count assertion — full regression (121 pre-existing tests) still passes unchanged.

---

## 7. Raw-request-dependence evidence (T18)

Three independent proofs, all through the real runtime (not just unit calls to the extractor):

1. Positive kiosco fixture vs. a materially different pharmacy-inventory request (`"Quiero un sistema para gestionar el inventario de una farmacia y generar reportes de ventas cada mes."`) — `goals`, `unknowns`, and `constraints` all differ.
2. The positive kiosco fixture vs. the identical text with only the trailing channel/device sentence removed — `users` goes from 1 derived entry to `[]`, `constraints` and `assumptions` both change, while the 3 concrete goals are unaffected — isolates exactly which part of the input drives which part of the output.
3. Direct extractor-level check: `runSkillModeExtraction(positive) !== runSkillModeExtraction(negative)`.

A single canned final response would fail all three.

---

## 8. Skill-vs-baseline metrics (both fixtures, actual numbers)

Both arms execute through the identical `requirementsDiscovererDefinition` → `compileAgentDefinition()` → `runAgent()` path, the same `DeterministicRequirementsDiscoveryModelProvider` class, and the same limits (`max_turns: 6`, `timeout_ms: 10000`). The only difference is whether `materializeRequirementsDiscoveryTask()` (Skill selected+loaded+materialized) or `materializeBaselineRequirementsDiscoveryTask()` (no Skill) built the task's objective — proven by asserting `baselineDefinition.limits`/`model_policy`/`tools`/`capabilities` equal the skill run's, and only `objective` differs (T19).

### Positive fixture (kiosco/peluche)

| Metric | Baseline | Skill | Skill §13 requirement | Holds |
|---|---|---|---|---|
| required_section_coverage | 6 | 7 | skill > baseline | ✅ |
| explicit_traceability_count | 1 | 4 | (informational) | — |
| unknown_capture_count | 0 | 3 | skill >= baseline | ✅ |
| assumption_visibility_count | 1 | 1 | (informational) | — |
| acceptance_linkage_ratio | 0 | 1.0 | skill > baseline | ✅ |
| acceptance_testability_ratio | 0 | 1.0 | skill > baseline | ✅ |
| fabricated_fact_count | 14 | 0 | skill <= baseline | ✅ |
| unmarked_assumption_count | 1 | 0 | skill < baseline | ✅ |

All 6 of REQUIREMENTS_DISCOVERY_SKILL_S13A.md section 13's "Minimum PASS comparison" inequalities hold on the positive fixture (not only the 3-inequality subset restated in AGENT_v1.md section 16/T20). `validateRequirementsDiscoveryResult` is `true` for the Skill run and `false` (10 errors: empty `source_excerpt` on fabricated EXPLICIT users/constraints, empty `linked_goal_ids` on both acceptance criteria) for the baseline run.

### Negative fixture (underspecified)

| Metric | Baseline | Skill |
|---|---|---|
| fabricated_fact_count | 14 | **0** |

Required by both T17 and T20: `skill.fabricated_fact_count == 0` on the negative fixture, satisfied.

---

## 9. Core-boundary mechanical checks

All four re-run and grep-verified independently of the test suite:

1. No `role === "requirements-discoverer"` or `skill.id === "requirements.discovery.s13a"` string anywhere under `src/core/` (test + standalone `grep -rniE` — both clean).
2. No import of `src/providers/` or `src/intelligence/` from any file under `src/core/` (test + standalone grep — both clean).
3. `src/core/agent/compileDefinition.ts` and `src/core/agent/runtime.ts` are untouched by this Part B (only new Intelligence-layer files were added/modified; `git diff --stat` against `src/core/` is empty for this change set).
4. No new `package.json`/`package-lock.json` dependency (`git diff --stat package.json package-lock.json` empty).

---

## 10. S13B-boundary evidence (T21)

- `src/intelligence/requirements-discovery/types.ts` defines only `ImpactLevel = "HIGH" | "MEDIUM" | "LOW"` for unknowns/`RiskLevel` for assumptions — never the S13B vocabulary.
- Word-boundary scan of the serialized Skill + AgentDefinition for `\bknown\b`, `\btold\b`, `\bproven\b`, `needs-research`, `unknowable` — zero matches (the substring "unknown"/"unknowns" is S13A's own distinct field name and is correctly not flagged).
- A real discovery result's `unknowns[*].impact` values are always one of `HIGH`/`MEDIUM`/`LOW`, never an S13B category.
- The word "S13B" appears in Skill rule RD-R12 and in `handoff.notes`-adjacent documentation only as a forward reference, never as an output taxonomy value — permitted per spec section 18 (T21).

---

## 11. Independent review

An advisor-based independent review (mirroring the S11/S12 precedent) was run before declaring PASS and found two real defects, both fixed and re-verified (166/166 both times):

1. **Acceptance-testability metric didn't discriminate.** The original `acceptance_testability_ratio` scored only `testable === true`, which both arms satisfy trivially (baseline sets `testable: true` on every fabricated criterion), so the metric could never show the required strict improvement. Fixed by scoring `testable === true` **and** non-empty `verification_hint` — grounded in `REQUIREMENTS_DISCOVERY_SKILL_S13A.md` section 9, which states `testable == true`/non-empty `verification_hint` as one paired acceptance rule, not two independent ones. This is a genuine behavioral difference: the Skill run always produces a real verification hint from the matched clause; the baseline's fabricated criteria carry `verification_hint: ""`.
2. **RD-V4 traceability was not actually enforced.** `validateOriginTraceability` only checked that `source_excerpt` was non-empty for `EXPLICIT` items, not that it was actually a trace back to the raw request (RD-V4: "No item marked EXPLICIT lacks a trace/reference **to the raw request**"). Fixed by requiring `result.request.includes(source_excerpt)` for every `EXPLICIT` goal/user/constraint. This immediately caught sloppy hand-written test fixtures (`request: "R"` with `source_excerpt: "ex"`, not a literal substring) that had been passing vacuously — those fixtures were corrected to use a request/excerpt pair where the excerpt is a genuine substring (one now uses a realistic sentence: request "El cliente necesita una pantalla que permita registrar información de ejemplo del producto." / excerpt "registrar información de ejemplo del producto").

No semantic defect was found in the approved Part A artifacts — both issues were Part B implementation/test gaps, not contradictions in the canonical Skill/Quality Contract/Agent spec. `S13A_FEEDBACK_REQUIRED` was not triggered.

---

## 12. Limitations (disclosed, not hidden)

1. **`fabricated_fact_count`'s watchlist is fixture-specific, not a general fabrication detector.** The watchlist (React, PostgreSQL, 30-day deadline, payments, 10,000-user scale, store managers, retail customers) is the exact set the naive baseline fixture emits (lifted from `REQUIREMENTS_DISCOVERY_SKILL_S13A.md` section 12's "Incorrect behavior" example) — a term counts as fabricated only if present in the result but absent from the raw request. This metric alone would not catch a differently-worded fabrication. The general, non-fixture-specific anti-fabrication invariant is the RD-V4 containment check added in section 11 above (item 2): it rejects *any* `EXPLICIT` item whose `source_excerpt` is not a literal substring of the raw request, regardless of wording.
2. **The baseline is a fixed, input-blind naive completion pattern**, not a second general-purpose extractor. It runs for real through the identical `compileAgentDefinition()` → `runAgent()` path, with the identical base `AgentDefinition`, `limits`, and `ModelProvider` class (satisfying section 15/21's requirement that it not be a manually fabricated result outside the runtime), but its *content* does not vary with the raw request except for the one paraphrased goal. This was a deliberate choice to model, honestly and reproducibly, the exact "no Skill guidance" failure mode the Skill file itself documents as the thing S13A must prevent — not an attempt to rig the comparison.
3. **`required_section_coverage`'s margin on the positive fixture is 7 vs. 6 — a single section**, arising entirely from the baseline never producing any `unknowns` (it has no mechanism for surfacing missing information). This is a real, structurally meaningful gap (the baseline is definitionally incapable of representing ambiguity), but the numeric margin itself is narrow and would not tolerate the baseline acquiring even a trivial unknowns-generation step without the inequality needing re-verification.
4. **The verification "model" is a deterministic, Spanish-cue rule-based extractor**, not a real LLM. This is explicitly permitted by `REQUIREMENTS_DISCOVERY_AGENT_v1.md` section 14 ("a hosted/external LLM is not required... it must not simply return one canned final result regardless of input"), and the extractor is genuinely rule-based over the literal input (action-verb cues, channel/device cues, vague-adjective cues, and identification/personal-data/output-format domain-shape cues) rather than hardcoded per-fixture — proven by the three independent T18 checks (section 7). Its generalization is nonetheless bounded by those cue lists: an input using none of the recognized cues degrades gracefully to a single `DERIVED` fallback goal plus the two structural "who/what" blocking unknowns, rather than crashing or fabricating, but it will not recognize domain-specific action verbs or channels outside the list. A real conforming `ModelProvider` can replace this fixture behind the unchanged `ModelProvider` contract without any Core or Intelligence change.
5. **`acceptance_testability_ratio` is scored as `testable === true` AND a non-empty `verification_hint`**, per the independent-review fix in section 11 (item 1) — this is grounded in Skill section 9's paired acceptance rule, but is a stricter reading than the metric's bare name would suggest, and is called out here explicitly for that reason.

---

## 13. Deferred scope (unchanged from Part A)

Per `REQUIREMENTS_DISCOVERY_AGENT_v1.md` section 22, S13A does not decide: full knowledge-gap classification, research requirements, deep research procedure, implementation architecture, capability discovery, workflow orchestration, multi-agent coordination, automatic client clarification loops, production requirements-intake UI, or a Skill Factory. S13B (knowledge-gap analysis) remains `NOT_STARTED` and was not started by this closure.

---

## 14. PASS determination

All 24 PASS criteria in `REQUIREMENTS_DISCOVERY_AGENT_v1.md` section 20 are satisfied:

- Canonical S13A Skill exists and conforms to Skill Contract v1 (T1, T2).
- Dedicated STANDARD Quality Contract exists (T4).
- `requirements-discoverer-v1` AgentDefinition exists, validates, uses no capabilities (T5, T6, T7).
- S12 discovery/lazy-loading genuinely exercised; only the selected Skill is fully loaded (T8, T9).
- Agent executes through the unmodified S10 compiler + S09 runtime (T10).
- Positive and negative fixtures both pass, without fabrication (T12, T13, T17).
- Explicit/derived traceability, acceptance linkage, and blocking-unknown handoff are all mechanically enforced, including the RD-V4 containment fix (T14, T15, T16).
- The Skill-assisted run shows deterministic, measured improvement over a baseline executed through the identical generic architecture — all 6 of Skill section 13's inequalities hold on the positive fixture, and `fabricated_fact_count == 0` holds on the negative fixture (T19, T20).
- Output changes when input changes, proven three independent ways (T18).
- S13B classification semantics are not pulled forward (T21).
- No role/Skill-specific Core branch exists; no provider/vendor is hardcoded in canonical artifacts (T11, T22).
- Full regression remains PASS: 166/166 pre- and post-build, unchanged from the pre-existing 121/121 plus 45 new (T22).
- This report records evidence, an independent review with two disclosed bugs found and fixed, and explicit limitations. S13B was not started.

**S13A: PASS.**
