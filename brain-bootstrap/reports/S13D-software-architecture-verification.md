# S13D — Software Architecture — Part B Verification Report

**Step:** S13D (software-architecture, sub-step of the S13x sequence)
**Status:** PASS
**Verified at:** 2026-08-26T20:15:00Z
**Verifier:** claude-code (primary_builder), independent (advisor) review performed before this PASS

## 1. Implementation inventory

New (8 src files):

- `src/intelligence/software-architecture/types.ts` — full `SoftwareArchitectureInput`/`SoftwareArchitectureDecisionResult` type model (drivers, fit vocabulary, per-alternative analysis across 7 canonical dimensions, ADR, comparison metrics).
- `src/intelligence/software-architecture/softwareArchitectureSkill.ts` — Skill ID / artifact path / Quality Contract ref constants.
- `src/intelligence/agent-definitions/softwareArchitectDefinition.ts` — new, independent `software-architect-v1` AgentDefinition.
- `src/intelligence/skills/definitions/softwareArchitectureS13D.ts` — typed Skill Contract v1 representation (24 rules SA-R1..SA-R24 / 11 procedure steps SA-P1..SA-P11 / 12 verification checks SA-V1..SA-V12).
- `src/intelligence/software-architecture/materializeSoftwareArchitectureTask.ts` — input validation (`validateSoftwareArchitectureInput`) plus Skill-assisted and baseline materialization bridges.
- `src/intelligence/software-architecture/validateSoftwareArchitectureResult.ts` — deterministic result validator, `hardDrivers()`/`computeResolvableEvidenceRefs()` shared helpers, `mapSoftwareArchitectureResultToStructuredOutput()`.
- `src/intelligence/software-architecture/compareSoftwareArchitectureRuns.ts` — 9-metric Skill-vs-baseline comparison, `hasArchitectureSpecificSecurity()` shared helper.
- `src/intelligence/software-architecture/renderArchitectureDecisionRecord.ts` — deterministic canonical-section-order Markdown ADR renderer.

Modified (1 file):

- `src/intelligence/skills/index.ts` — registers `softwareArchitectureS13D` in the shared reference Skill catalog (now 7 entries).

New (2 test files):

- `tests/software-architecture/fixtures.ts` — kiosk offline-persistence scenario (`KIOSK_INPUT`), mutated fixture (`KIOSK_INPUT_C1_SOFT`), unresolved-blocker fixture (`KIOSK_INPUT_WITH_UNRESOLVED_BLOCKER`), minimal S13C-compatibility fixtures, genuine rule-based `synthesizeSkillArchitectureResult()`, naive `synthesizeBaselineArchitectureResult()`, `DeterministicSoftwareArchitectureModelProvider`.
- `tests/software-architecture/softwareArchitecture.test.ts` — T1–T28, 28 describe blocks, 57 `it()` cases.

## 2. T1–T28 result table

| ID | Area | Cases | Result |
|---|---|---|---|
| T1 | Canonical Skill source + rule/procedure/verification id cross-check (24/11/12) | 2 | PASS |
| T2 | Typed Skill S12 validation | 1 | PASS |
| T3 | Typed Skill preserves canonical semantics | 1 | PASS |
| T4 | DEEP Quality Contract integrity | 1 | PASS |
| T5 | AgentDefinition validates + new/independent | 2 | PASS |
| T6 | Zero capability/tool dependency | 2 | PASS |
| T7 | Exact Skill allowlist | 1 | PASS |
| T8 | S12 discovery selects S13D | 2 | PASS |
| T9 | Lazy selected-load only | 1 | PASS |
| T10 | Input contract validation | 6 | PASS |
| T11 | Upstream (S13C) compatibility | 2 | PASS |
| T12 | Upstream immutability (S13B + S13C) | 2 | PASS |
| T13 | Alternative count and origin | 1 | PASS |
| T14 | Hard-constraint coverage | 2 | PASS |
| T15 | Hard-constraint violation blocks recommendation | 5 | PASS |
| T16 | Balanced comparison | 1 | PASS |
| T17 | Canonical dimension coverage | 1 | PASS |
| T18 | Failure-mode structure | 1 | PASS |
| T19 | Architecture-specific security | 2 | PASS |
| T20 | Cost/operations/reversibility | 1 | PASS |
| T21 | Evidence traceability | 1 | PASS |
| T22 | Unresolved critical gap prevents readiness | 2 | PASS |
| T23 | ADR semantics | 2 | PASS |
| T24 | Deterministic Markdown ADR | 1 | PASS |
| T25 | Same S10/S09 runtime path | 2 | PASS |
| T26 | No role/Skill branching in Core | 2 | PASS |
| T27 | Input dependence + Skill improvement | 4 | PASS |
| T28 | Full regression | 5 | PASS |

**57 `it()` cases total, all PASS.**

## 3. Test counts / typecheck / build

- `npm run typecheck`: 0 errors (re-run after every implementation phase and after the independent-review fixes).
- `npx vitest run tests/software-architecture/softwareArchitecture.test.ts`: 57/57.
- `npm test` (full suite, pre-build): 325/325 (268 pre-existing from S07–S13C + 57 new).
- `rm -rf dist && npm run build`: succeeded, 0 errors.
- `npm test` (full suite, post-build): 325/325, unchanged.

## 4. Positive fixture (kiosk offline-capable persistence architecture)

`KIOSK_INPUT`: architecture question about how a retail kiosk must persist/synchronize transactions while surviving up to 8-hour WAN outages. `KIOSK_KGA` (S13B `KnowledgeGapAnalysisResult`) carries 8 `KnowledgeItem`s (C1–C8): C1 (offline capability), C2 (power-loss durability), C8 (printer local independence) are `DECISION_CRITICAL` + `blocking:true` — the three hard constraints; C3–C7 are softer operations/business/cost/security/delivery context. Three `PROVIDED` candidate alternatives: ALT-A (local SQLite + transactional outbox sync), ALT-B (remote Postgres-only synchronous writes), ALT-C (local JSON files + periodic batch upload).

The Skill-assisted run (`synthesizeSkillArchitectureResult`, exercised live through `compileAgentDefinition()`/`runAgent()`) derives 8 decision drivers (3 hard: C1/C2/C8), evaluates all three alternatives against every hard constraint, recommends **ALT-A** (`READY_FOR_HUMAN_APPROVAL`), and rejects ALT-B (violates C1 and C8) and ALT-C (weaker C2 fit) with cited reasons.

## 5. Negative fixture (naive baseline on the same context)

Per Skill file section 24 ("use the same architecture context"), the negative fixture is **not a second scenario** — it is what the naive BASELINE arm produces on the identical `KIOSK_INPUT` when no Skill is materialized (`synthesizeBaselineArchitectureResult`). It reproduces, structurally, the canonical bad answer the Skill file describes: analyzes only ALT-B, zero `driver_evaluations`, benefits-only content (no disadvantages, no failure modes), generic security boilerplate (`"use encryption"`, `"use best practices"`), `UNKNOWN` cost/operations/reversibility, zero evidence refs, zero assumptions, yet still recommends `READY_FOR_HUMAN_APPROVAL`. `validateSoftwareArchitectureResult()` rejects it (T15).

## 6. Mutated-input fixture (T27 / Skill file section 28)

`KIOSK_INPUT_C1_SOFT` flips C1's `blocking` flag to `false` (C1 becomes a soft constraint). This measurably and genuinely changes the SKILL run's output: ALT-B's C1 fit moves from `FAIL` (hard) to `WEAK` (soft), and ALT-B's rejection rationale changes from citing both C1 and C8 to citing only C8 — a real, rule-computed effect of the mutation, not a canned difference (verified both via a throwaway probe before formalizing, and via the T27 assertions `mutatedAltBFit !== originalAltBFit` and `mutatedRejection !== originalRejection`).

## 7. Decision drivers / hard constraints / alternative origins

`deriveDecisionDrivers()` mechanically maps each S13B `KnowledgeItem` with a declared `ArchitectureDriverKind` to an `ArchitectureDecisionDriver`, marking `hard: true` iff `decision_impact === "DECISION_CRITICAL" && blocking === true`. This derivation is **identical** for the SKILL and BASELINE arms — it is a cheap parse step, not the Skill's analytical value-add — which is deliberate: it is what lets the validator catch the baseline's missing hard-constraint evaluations as a self-contained structural defect (T14) without needing external ground truth about which alternative "truly" violates a constraint.

## 8. Trade-offs / failure modes / cost / operations / security / reversibility

Every SKILL-arm alternative carries ≥1 benefit and ≥1 disadvantage (T16), ≥1 structurally complete failure mode with trigger/impact/observable-symptom/mitigation/residual-risk (T18), separate implementation/ongoing/migration cost levels that are not all identical (T20), deployment/operator/backup/failure-handling operations notes, an architecture-specific (non-boilerplate) security profile that differs materially between local-persistence alternatives (ALT-A/ALT-C) and the remote alternative (ALT-B) (T19), and a reversibility profile with a non-empty migration path and ≥1 lock-in factor.

## 9. Evidence traceability / assumptions / unresolved gaps

Every hard-constraint driver evaluation carries `evidence_refs` (T21). `evidence_traceability_ratio` is computed against a **resolvable-refs universe** — S13B `KnowledgeGapAnalysisResult` item ids ∪ declared driver ids ∪ driver `source_refs` ∪ (when supplied) S13C `DeepResearchBatchResult` finding/contradiction evidence refs — shared identically between the validator and the metric (`computeResolvableEvidenceRefs()`, found necessary during independent review, see section 12). `KIOSK_INPUT_WITH_UNRESOLVED_BLOCKER` adds an unresolved `DECISION_CRITICAL`+`blocking` `NEEDS_RESEARCH` item (C9, data-residency regulation); the SKILL run correctly reports `unresolved_decision_gaps` and downgrades `decision_status` away from `READY_FOR_HUMAN_APPROVAL` (T22).

## 10. Structured ADR + Markdown ADR

`ArchitectureDecisionRecord.status` is always `"PROPOSED"` with `approval_required: true` and a non-empty `approval_note` stating human approval is required before the decision is treated as accepted (T23). The type has no `"ACCEPTED"` member; a hand-crafted result setting `adr.status = "ACCEPTED"` is rejected by the validator. `renderArchitectureDecisionRecord()` renders all 17 canonical sections (`## Status` … `## Approval`) in the exact canonical order, and re-rendering the same structured ADR produces markdown identical to what the live run returned (T24).

## 11. Skill-vs-baseline comparison metrics

Computed live (post independent-review fixes, see section 12) via `compareSoftwareArchitectureRuns(baselineData, skillData, KIOSK_INPUT, GROUND_TRUTH)`:

| Metric | Baseline | Skill |
|---|---|---|
| canonical_dimension_coverage_ratio | 0 | 1 |
| hard_constraint_coverage_ratio | 0 | 1 |
| alternative_balance_ratio | 0 | 1 |
| failure_mode_coverage_ratio | 0 | 1 |
| evidence_traceability_ratio | 0 | 1 |
| assumption_visibility_ratio | 0 | 1 |
| security_dimension_coverage_ratio | 0 | 1 |
| unsupported_recommendation_count | 2 | 0 |
| hard_constraint_violation_count | 1 | 0 |

T27 asserts the 4 required strict improvements (canonical_dimension_coverage_ratio, failure_mode_coverage_ratio, evidence_traceability_ratio strictly greater; hard_constraint_violation_count strictly less) plus the 3 required exact values on the shared fixture (skill `hard_constraint_violation_count === 0`, `unsupported_recommendation_count === 0`, `security_dimension_coverage_ratio === 1`).

**Disclosure — this table is a hand-authored maximal contrast, not emergent measurement.** `synthesizeBaselineArchitectureResult()` is a hand-written naive result (one alternative, zero `driver_evaluations`, benefits-only, generic security boilerplate) and `ALT_CONTENT` supplies deliberately rich SKILL-arm content; the baseline scoring exactly 0 on all 7 ratios and the skill exactly 1 is authored contrast satisfying spec section 26's letter (branch selected purely by SKILL_ID-marker absence, produced through the identical `runAgent()` path, same base definition/limits/provider class), not evidence that the Skill *causes* better reasoning from an undifferentiated model.

Three of the 9 metrics require disclosed, non-hidden fixture ground truth (`GROUND_TRUTH` in the test file) because they cannot be derived from a result alone:

- `hard_constraint_violation_count`: `groundTruth.true_hard_constraint_fit_by_alternative` supplies the true fit; when omitted, falls back to the result's own self-reported fit — a disclosed, weaker default, since a naive result that never evaluates a constraint would otherwise self-certify as non-violating (verified empirically: baseline scores 0 without ground truth despite genuinely violating C1/C8 via ALT-B).
- `failure_mode_coverage_ratio` / `assumption_visibility_ratio`: fall back to a vacuous ratio of `1` when their ground truth is omitted.

Additional disclosed conventions:

- `GROUND_TRUTH.true_hard_constraint_fit_by_alternative` hardcodes ALT-B's C1 fit as `"FAIL"`, which is only true while C1 is hard. This table is never applied to the mutated (`KIOSK_INPUT_C1_SOFT`) fixture in any test — T27's mutation assertions compare driver evaluations and rejection reasons directly, never a scored metric — but a future test scoring the mutated fixture with this table would need a separate ground-truth map.
- `security_dimension_coverage_ratio` on the SKILL arm is structurally guaranteed to be 1 by fixture content (all three `ALT_CONTENT` entries carry rich, non-boilerplate security fields); the real discriminating logic lives in `hasArchitectureSpecificSecurity()`'s anchored-regex genericness check, which is why the baseline (whose only security content is literally `"use encryption"`/`"use best practices"`) scores 0.
- Both `hard_constraint_coverage_ratio` and `evidence_traceability_ratio` use a `hardPairsTotal === 0 ? 1` convention (vacuously satisfied when a result declares zero hard drivers). This is now guarded: `validateSoftwareArchitectureResult()` independently rejects any non-`BLOCKED` result declaring zero `decision_drivers`, and any `READY_FOR_HUMAN_APPROVAL` result declaring zero hard drivers (see section 12), so this vacuous-1 convention can no longer be exploited to inflate the metrics of a result that would otherwise be marked invalid.
- `unsupported_recommendation_count` has no strict-inequality assertion in T27 (only the skill arm's exact-0 value is asserted); the baseline's raised value (2, after the section-12 fix) is measured and shown in the table above but not asserted against in a test.

## 12. Same-runtime proof / input-dependence proof / S12 discovery / zero capabilities

Both SKILL and BASELINE runs execute through the identical `compileAgentDefinition()` → `runAgent()` path, same `AgentDefinition.limits`/`model_policy`/`tools`/`capabilities`, same `DeterministicSoftwareArchitectureModelProvider` class, same zero-capability `MultiCapabilityProvider([])` — only the materialized objective differs (SKILL_ID marker present vs. absent) (T27). S12 discovery/lazy-load is exercised live: `selectSkillForTask()` selects and loads only `software-architecture.adr.s13d`, no other catalog entry's loader is called (T8/T9). `softwareArchitectDefinition.tools` and `.capabilities` are both `[]`; the Skill's `requires.capabilities`/`permissions.allowed_capabilities` are both `[]` (T6) — S13D never calls `research.lookup` or any other capability; it synthesizes already-bounded S13B/S13C evidence.

## 13. Independent review findings, bugs found and fixed

Independent (advisor) review was run before declaring PASS, per the S11/S12/S13A/S13B/S13C precedent. It found **two real Part B implementation gaps** (not Part A semantic defects — the approved Skill/Quality-Contract/Agent-spec artifacts were not touched, so no `S13D_FEEDBACK_REQUIRED` was warranted):

1. **Zero-driver validator bypass.** `validateSoftwareArchitectureResult()` derived its hard-constraint set entirely from `result.decision_drivers` — the result's own self-reported output. A result declaring `decision_drivers: []` while claiming `READY_FOR_HUMAN_APPROVAL` skipped both the hard-constraint coverage loop (T14) and the recommended-alternative FAIL-rejection loop (T15) entirely, since `hardDrivers([])` is always `[]`. This meant PASS criteria "hard constraints are evaluated for every alternative" and "no recommended alternative violates a hard constraint" were not actually enforced against a result that simply declared no constraints. **Fixed** by requiring any non-`BLOCKED` result to declare ≥1 `decision_driver`, and any `READY_FOR_HUMAN_APPROVAL` result to declare ≥1 `hard: true` driver. New regression test added (T15, "declares zero decision_drivers" case).

2. **Unresolvable evidence refs accepted.** Neither the validator nor the `evidence_traceability_ratio` metric ever checked that a cited `evidence_ref` resolved to anything real — `evidence_refs: ["FABRICATED-XYZ"]` scored identically to a genuine S13B item id. **Fixed** by adding `computeResolvableEvidenceRefs()` (S13B item ids ∪ declared driver ids ∪ driver `source_refs` ∪ S13C finding/contradiction evidence refs when `deep_research` is supplied), shared by both the validator (rejects any alternative/driver-evaluation/security/ADR evidence ref outside this universe) and the metric (only counts a hard-driver evaluation as traceable if its refs are non-empty **and** all resolve). New regression test added (T15, `FABRICATED-XYZ` rejection case). Re-verified T21's `evidence_traceability_ratio === 1` on the live SKILL run is unaffected (all its refs are genuine S13B item/driver ids).

Both fixes were verified with a second independent-review pass confirming the specific bypass constructions no longer validate and that no existing test regressed. One additional discrepancy the fix exposed (not a defect, a disclosure item): `unsupported_recommendation_count`'s "recommends without comparing" branch was vacuous exactly when it mattered (a single-alternative `READY_FOR_HUMAN_APPROVAL` result had no other alternatives to check rejection reasons against) — closed by adding an explicit `alternatives.length < 2` case to the metric, which raised the baseline's `unsupported_recommendation_count` from 1 to 2 (reflected in section 11's table).

Additional cheap, non-blocking improvements made during the same review pass: T1 now cross-checks every typed `SA-R*`/`SA-P*`/`SA-V*` id against the canonical markdown with exact 24/11/12 counts (previously only self-referential checks existed); T19's second case now calls the exported `hasArchitectureSpecificSecurity()` production check instead of asserting the fixture against itself; T28's `evidence_refs` mapping check now also asserts the literal expected array (`["stakeholder-brief","C1","C2","C8","C6"]`), not only self-consistency with the same mapper; T12 adds a second case proving a supplied S13C `DeepResearchBatchResult` is not mutated (previously only S13B immutability was tested, leaving half of PASS criterion 10 untested).

## 14. Limitations (disclosed, non-blocking)

- `hard_constraint_violation_count`'s ground-truth fallback (self-reported fit) cannot detect a violation a naive result never reports; all formal assertions supply `GROUND_TRUTH` to avoid relying on the weaker fallback.
- `failure_mode_coverage_ratio` and `assumption_visibility_ratio` fall back to a vacuous ratio of `1` when their ground truth is omitted.
- `GROUND_TRUTH.true_hard_constraint_fit_by_alternative` is hardcoded for the C1-hard case; it is never applied to the mutated (C1-soft) fixture by any current test.
- `security_dimension_coverage_ratio`'s SKILL-arm value of 1 is structurally guaranteed by fixture content, not emergent; the discriminating logic is `hasArchitectureSpecificSecurity()`'s anchored-regex genericness check.
- `hard_constraint_coverage_ratio` and `evidence_traceability_ratio` both use a `hardPairsTotal === 0 ? 1` vacuous convention, now bounded by the validator's zero-driver/zero-hard-driver rejection (section 12, finding 1) so it cannot inflate an otherwise-invalid result's metrics.
- `unsupported_recommendation_count` is measured and reported in the comparison table but has no strict-inequality assertion in the test suite (only the skill arm's exact-0 value is asserted).
- The Skill-vs-baseline comparison is a hand-authored maximal contrast (naive baseline vs. deliberately rich fixture content), not an emergent measurement of "the Skill causes better reasoning" from an undifferentiated model — this is the same accepted pattern as S13A/S13B/S13C's own baseline fixtures.
- T25's "no separate runtime function" scan greps for names like `runSoftwareArchitecture`/`SoftwareArchitectureRuntime` that no one would plausibly write; it cannot meaningfully fail and should not be cited as strong evidence.
- The verification "model" is a deterministic rule-based `ModelProvider` fixture (`DeterministicSoftwareArchitectureModelProvider`), not a real LLM — explicitly permitted by the Agent spec; a real `ModelProvider` can be substituted with no Core/Intelligence change (`allow_provider_substitution: true`).

## 15. Deferred scope

- S13E (agent-engineering, or whatever the next real S13x sub-step is per `.claude/skills/brain-build-day-bootstrap/SKILL.md`) is explicitly out of scope and was not started.
- S13D does not apply or mutate S13B `closure_state` or S13C `recommended_closure_state` — it only reads them as read-only context; applying either back onto upstream state remains a future step's responsibility.
- No new package.json/package-lock.json dependency was introduced (`git diff --stat package.json package-lock.json` empty).
- No S11/S13B/S13C canonical artifact (markdown/YAML specs or TypeScript implementation) was modified by this closure (`git status --short` clean on all of them).
