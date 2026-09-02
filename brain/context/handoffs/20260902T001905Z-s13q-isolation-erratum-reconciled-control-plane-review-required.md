# S13Q — isolation erratum reconciled — committed-source control-plane review required

- handoff_id: 20260902T001905Z-S13Q-isolation-erratum-reconciled
- step: S13Q (Delivery Documentation & Demo — Part B reconciliation)
- status: CONTROL_PLANE_SOURCE_REVIEW_REQUIRED (NOT independent verification yet)
- date: 2026-09-01
- builder: fresh non-fork Claude Sonnet 5 builder
- session: https://claude.ai/code/session_014NjCLYwK279BNYzBU33Tf8

## Why this handoff

Issue #1 comment `5502164619` ruled `PART_A_AMENDMENT_AUTHORING_READY /
BUILDER_RECONCILIATION_REQUIRED`. Canonical Part A gained a fourth artifact,
`brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_1.md` (blob
`fc63516c898aca6a888781bceeca4a3e377932aa`), which defines the exact isolation
acceptance model (`STRICT | STRUCTURAL_DEPENDENCY | GATE_CLASS | FAIL`). The
prior Part B candidate `5b084ae` (transferred to the branch at `36c2a5e`) is not
verifier-authorized. This candidate reconciles Part B to the erratum literally
and produces a new SHA for committed-source control-plane review.

## Part A integrity

- `DELIVERY_DOCUMENTATION_DEMO_SKILL_S13Q.md` — `1198834124dc32c34721130566efdc5fda78465f` (unchanged)
- `S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml` — `5f931e5372ff0319eee6e86fe0a1879c0300153f` (unchanged)
- `DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md` — `6d7078633c1d0a90e8204a277de6100ed517a112` (unchanged)
- `S13Q_ISOLATION_ERRATUM_1.md` — `fc63516c898aca6a888781bceeca4a3e377932aa` (canonical amendment, already on branch)

All four verified at the new candidate HEAD.

## Candidate

- branch: `s13q-delivery-documentation-demo-part-b`
- new SHA: `__NEW_SHA__`
- parent chain: `__NEW_SHA__` → `36c2a5e` → `5b084ae` → `41f723f` → `1782a16` → `cf49b45`
- `main` unchanged: **YES** — `main` = `origin/main` = `cf49b45519c45b6ce3e930b813df97f6e983c151`
- files touched vs `cf49b45`: `S13Q_ISOLATION_ERRATUM_1.md` (from the erratum transfer commit), `src/intelligence/delivery-documentation-demo/quality.ts`, `tests/delivery-documentation-demo/deliveryDocumentationDemo.test.ts`, `brain-bootstrap/reports/S13Q-delivery-documentation-demo-verification.md`, this handoff

## Final classification

`strict_count = 15`, `structural_dependency_count = 7`, `gate_class_count = 7`,
`fail_count = 1`.

- **STRICT (15):** A02, A07, A08, A10, A11, A14, A15, A17, A18, A19, A22, A24, A28, A29, A30
- **STRUCTURAL_DEPENDENCY (7):** A01→[A24], A03→[A05], A05→[A03,A24], A06→[A03], A16→[A18], A20→[A19], A23→[A22]
- **GATE_CLASS (7):** A04, A12, A13, A21, A25, A26, A27
- **FAIL (1):** A09 — reported semantic gap, kept visible

### Erratum §7 30-row dependency/gate-class map

| Axx | class | owned governing source fact | semantic reason | fresh rerun evidence | measured changed set | STRUCT dep set + forcing / GATE blocker+counter+fixture+no-leak |
|-----|-------|-----------------------------|-----------------|----------------------|----------------------|---------------------------------------------------------------|
| A01 | STRUCTURAL_DEPENDENCY | `delivery_identity.revision_ref` | delivered revision spine (A01 observes it directly) | buildDeliveryPackage rerun, not blocked | `{A01,A24}` | `[A24]`; buildProvenance:505 threads revision_ref into provenance.revision_ref |
| A02 | STRICT | `delivery_identity.audience` | audience preservation (named property) | rerun, not blocked | `{A02}` | — |
| A03 | STRUCTURAL_DEPENDENCY | `repository_facts[rf-feat-builder].confidence` | deriveClaimStatus ACCEPTED→IMPLEMENTED vs REPORTED→AVAILABLE_NOT_VERIFIED (371-372) | rerun, not blocked | `{A03,A05}` | `[A05]`; shared claim table; claims_with_evidence unchanged (A04 stays), source_kinds already has REPORTED (A24 stays) |
| A04 | GATE_CLASS | `verification_evidence[ev-test-parser].status` | PASS binding for the only VERIFIED claim | rerun → BLOCKED `UNSUPPORTED_VERIFIED_CLAIM`, package null | fail-closed | blocker `UNSUPPORTED_VERIFIED_CLAIM`; counter `UC01` fireable; fixture `N06`; no leak |
| A05 | STRUCTURAL_DEPENDENCY | `repository_facts[rf-feat-reporter].confidence` | only REPORTED fact → drives AVAILABLE_NOT_VERIFIED derivation (372) | rerun, not blocked | `{A03,A05,A24}` | `[A03,A24]`; (a) shared claim table → A03, (b) deletes `repository_fact:REPORTED` from deduped provenance.source_kinds (499-503) → A24; minimality proof: A03's probe adds a REPORTED that already exists so A24 stays put |
| A06 | STRUCTURAL_DEPENDENCY | `repository_facts[rf-feat-builder].source_ref` | roadmap source → deriveClaimStatus DEFERRED (368-369) | rerun, not blocked | `{A03,A06}` | `[A03]`; shared claim table; confidence untouched so A24 unaffected |
| A07 | STRICT | `architecture_facts[af-model].source_ref` | components.map source_ref | rerun, not blocked | `{A07}` | — |
| A08 | STRICT | `architecture_facts[af-bound-core].value` | BOUNDARY fact value = preserved boundary line (393) | rerun, not blocked | `{A08}` | — |
| A09 | **FAIL** | `architecture_facts[af-model].is_proposed_decision` | exact governing condition for no_new_architecture_decision (259) | rerun → BLOCKED `NEW_ARCHITECTURE_DECISION`, package null | fail-closed | **no unsafe counter covers the architecture-decision condition** ⇒ §5.3 req 4 unmet ⇒ not GATE_CLASS; blocking closes STRICT/STRUCTURAL; §4 forbids the `partial` tuple-mover. Reported per §6/§14 (`DELIVERY_ATOMIC_UNRESOLVED.A09`) |
| A10 | STRICT | `verification_evidence[ev-build].subject_ref` | PASS evidence bound to the required build step (405-407) | rerun, not blocked | `{A10}` | — |
| A11 | STRICT | `repository_facts[rf-cmd-build].precondition_refs` | preconditions named property (413) | rerun, not blocked | `{A11}` | — |
| A12 | GATE_CLASS | `repository_facts[rf-cmd-test].value` | undeclared `:port` token = governing prohibited condition | rerun → BLOCKED `INVENTED_PORT`, package null | fail-closed | blocker `INVENTED_PORT` (287-290); counter `UC02` fireable; fixture `N13`; no leak |
| A13 | GATE_CLASS | `demo_surface.exists` | `exists=false` = exact governing condition | rerun → BLOCKED `DEMO_SURFACE_DOES_NOT_EXIST`, package null | fail-closed | blocker `DEMO_SURFACE_DOES_NOT_EXIST` (308); counter `UC03` fireable; fixture `N17`; no leak |
| A14 | STRICT | `demo_surface.steps[ds-happy].action_ref` | per-step action completeness (443) | rerun, not blocked | `{A14}` | — |
| A15 | STRICT | `demo_surface.steps[ds-happy].fallback_ref` | per-step fallback truthfulness (446) | rerun, not blocked | `{A15}` | — |
| A16 | STRUCTURAL_DEPENDENCY | `policy.suppress_limitation_ids` | removes a limitation from the register (453-455) | rerun, not blocked | `{A16,A18}` | `[A18]`; A16 & A18 both `.map` pkg.limitations; LOW/KNOWN so no MATERIAL_LIMITATION_HIDDEN, A17 unaffected |
| A17 | STRICT | `limitations[lim-stdin].status` | UNVERIFIED/DEFERRED explicit (named property) | rerun, not blocked | `{A17}` | — |
| A18 | STRICT | `limitations[lim-crlf].severity` | per-limitation severity (named property) | rerun, not blocked | `{A18}` | — |
| A19 | STRICT | `next_step_candidates[ns-fixtures].status` | next-step status label (474); ns-fixtures not S13R-matching so A20 unaffected | rerun, not blocked | `{A19}` | — |
| A20 | STRUCTURAL_DEPENDENCY | `next_step_candidates[ns-deploy].status` | ns-deploy IS the S13R deployment next step; its status label is the boundary property | rerun, not blocked | `{A19,A20}` | `[A19]`; A19 reads all statuses, A20 the S13R-filtered subset; non-S13R relabel (A19 probe) moves only A19 |
| A21 | GATE_CLASS | `architecture_facts[af-quality].value` (S14 marker) | arch fact carrying S14/MCP work = governing prohibited condition | rerun → BLOCKED `S14_CAPABILITY_PULLED_FORWARD`, package null | fail-closed | blocker `S14_CAPABILITY_PULLED_FORWARD` (349); counter `UC09` fireable (independently); fixture `N28`; no leak |
| A22 | STRICT | `verification_evidence[ev-typecheck].evidence_id` | evidence id is what buildEvidenceIndex resolves/dedupes/orders (492-494) | rerun, not blocked | `{A22}` | — |
| A23 | STRUCTURAL_DEPENDENCY | append `verification_evidence` `ev-probe-fail` FAIL(`repo`) | same-subject PASS+FAIL = the conflict detectEvidenceConflicts records (521-524) | rerun, not blocked | `{A22,A23}` | `[A22]`; conflict needs a new evidence record which buildEvidenceIndex then lists |
| A24 | STRICT | `delivery_identity.baseline_revision_ref` | named provenance completeness field (506) | rerun, not blocked | `{A24}` | — |
| A25 | GATE_CLASS | `demo_surface.steps[ds-failure].action_ref` (bearer token) | secret value in raw source = governing prohibited condition | rerun → BLOCKED `SECRET_MATERIAL`, package null | fail-closed | blocker `SECRET_MATERIAL` (147,194); counter `UC06` fireable; fixture `N34`; no leak (generic detail, value never echoed) |
| A26 | GATE_CLASS | `repository_facts[rf-cmd-build].value` (undeclared `$ENV`) | undeclared `$ENV` name in a command = governing prohibited condition | rerun → BLOCKED `INVENTED_ENV_VARIABLE`, package null | fail-closed | blocker `INVENTED_ENV_VARIABLE` (284); counter `UC02` fireable; fixture `N12`; no leak into accepted package (package null; name only in rejection reason) |
| A27 | GATE_CLASS | `limitations[lim-crlf].impact` (raw stack trace) | raw log in raw source = governing prohibited condition | rerun → BLOCKED `RAW_LOG_MATERIAL`, package null; observation unchanged (`governing_changed=false`, permitted §5.3) | fail-closed | blocker `RAW_LOG_MATERIAL` (148,194); counter `UC06` fireable; fixture `N36`; no leak (never reaches collectStrings(decision)) |
| A28 | STRICT | `audit.input_snapshot_after` | input-stability audit fact (named property) | audit-family (no producer rerun required) | `{A28}` | — |
| A29 | STRICT | `audit.candidate_gate_valid` | candidate gate audit fact (named property) | audit-family | `{A29}` | — |
| A30 | STRICT | `audit.core_or_contract_changed` | protected-surface audit fact (named property) | audit-family | `{A30}` | — |

### Anti-tautology (erratum §8) — all four mechanically rejected

- §8.1 `expected_observation` overwrite → `legacyExpectedObservationMutationEvidence` → `classify FAIL` (path carries `expected_observation`)
- §8.2 derived `decision.*` overwrite → `legacyDerivedDecisionMutationEvidence` → `classify FAIL` (paths carry `decision.`)
- §8.3 irrelevant tuple-mover → `legacyIrrelevantMoverEvidence` → `classify FAIL` (single raw fact, but `paths_conform=false` vs A03's declared governing path)
- §8.4 two independent source facts → `legacyTwoFactEvidence` → `classify FAIL` (`mutated_fact_records.length===2`)

Positive paths present: STRICT (`A02`), STRUCTURAL_DEPENDENCY (`A01`,`A16`), GATE_CLASS (`A25`,`A27`).

## Fresh A/B (erratum §12 — recomputed from scratch, S12→S10→S09→candidate→gate→post-gate→evaluator)

- baseline total: **126**
- Skill total: **360**
- delta: **+234**
- per-assertion contributions: `D01..D08 = {9,9,9}` each; `D09 = {A25:0, A26:9, A27:0}`; `D10 = {A28:0, A29:9, A30:0}`
- qualified dimensions: **8** (`D01..D08`; threshold ≥ 7); distinct improved ids per qualified dim: 3
- regressions: **0**
- concentration: per qualified dim 9/27 = **0.333** (≤ 0.50); global 9/234 ≈ **0.038**
- per-scenario flips: `[0,0,0,26,26,26,26,26,26,26,26,26]`
- gate-valid baseline scenarios: **3**
- Skill-arm unsafe counters (aggregate): **0**

`observeAtomic` was not touched, so the frozen A/B table reproduced the prior
values exactly — reported as freshly reproduced (not carried forward).

## QA (Node v24.19.0 / npm 11.17.0)

- typecheck: clean
- focused `npx vitest run tests/delivery-documentation-demo`: **82/82**
- positives P01..P10: 10/10 · negatives N01..N40: 40/40 · isolation: 30/30 classified (15/7/7/1) · ablation: 7/7 · hard invariants S13Q-HI-001..030: 30/30 · unsafe counters UC01..UC12: 12/12 (zero on positives + Skill arm, each independently fireable)
- full `npm test` (pre-build): **1322/1322** across 24 files
- clean build: `rm -rf dist` (confirmed absent) → `npm run build` → **786** emitted files
- full `npm test` (post-build): **1322/1322** — equal pre/post
- `git diff --check` on `quality.ts` + S13Q test: clean
- allowed-path audit `git diff --stat cf49b45..HEAD`: only the erratum file, `quality.ts`, the S13Q test, the verification report, and handoff files
- independent review (advisor) before declaring done: performed; A05 `[A03,A24]` confirmed exact-and-minimal, A26 no-leak predicate tightened to `package===null`, classifier ordering and pairwise-distinct `governing_paths` assertion added

## Required control-plane action

1. Accept/reject the 7 `STRUCTURAL_DEPENDENCY` closures (each measured cross set is exact; `A05 [A03,A24]` is the widest).
2. Accept/reject the 7 `GATE_CLASS` classifications (each backed by blocker + independently-fireable counter + named negative fixture + `package === null` no-leak proof).
3. Rule on **A09**: add a `NEW_ARCHITECTURE_DECISION` unsafe counter to canonical Part A (→ A09 becomes GATE_CLASS), accept A09 as a permanent non-isolable atomic, or re-decompose A09 in the semantic contract.
4. Authorize or withhold a fresh independent (non-authoring, non-fork, read-only) verifier for the new candidate SHA.

## Boundaries

- `HI-052`: NOT awarded.
- `steps.S13Q`: NOT_STARTED.
- S13R: NOT_STARTED.
- No Core / AgentDefinition / `package.json` / `STATE.yaml` / `CURRENT.md` / other-stage changes.
