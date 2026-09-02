# S13Q — Erratum 2 (UC13 / A09 gate-class) reconciled — committed-source control-plane review required

- handoff_id: 20260902T010659Z-S13Q-erratum2-uc13-reconciled
- step: S13Q (Delivery Documentation & Demo — Part B reconciliation)
- status: CONTROL_PLANE_SOURCE_REVIEW_REQUIRED (NOT independent verification yet)
- date: 2026-09-02
- builder: fresh non-fork Claude Sonnet 5 builder
- session: https://claude.ai/code/session_014NjCLYwK279BNYzBU33Tf8

## Why this handoff

Issue #1 comment `5502649124` ruled `PART_A_AMENDMENT_2_AUTHORING_READY /
BUILDER_RECONCILIATION_REQUIRED`. Canonical Part A gained a fifth artifact,
`brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md`
(`S13Q-ERRATUM-002`, blob `9f7ff097d8d5e7d216fec63f949fa80af1a01de8`), already on
the branch at transfer commit `f3e9970`. It resolves the only remaining gap:
atomic `A09 = no_new_architecture_decision_in_summary` is a valid fail-closed
`GATE_CLASS` assertion but `UC01..UC12` had no unsafe counter for its governing
violation `NEW_ARCHITECTURE_DECISION`. This candidate adds `UC13` and rules
`A09 = GATE_CLASS`, and reruns the full isolation gate + DEEP QA + fresh A/B.

The map reviewed at `8dc62bf` (STRICT 15 / STRUCTURAL_DEPENDENCY 7 / GATE_CLASS 7)
is accepted; final target after this reconciliation is **STRICT 15 /
STRUCTURAL_DEPENDENCY 7 / GATE_CLASS 8 / FAIL 0 / TOTAL 30**.

## Part A integrity (all 5 verified unchanged at the new candidate HEAD)

- `DELIVERY_DOCUMENTATION_DEMO_SKILL_S13Q.md` — `1198834124dc32c34721130566efdc5fda78465f`
- `S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml` — `5f931e5372ff0319eee6e86fe0a1879c0300153f`
- `DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md` — `6d7078633c1d0a90e8204a277de6100ed517a112`
- `S13Q_ISOLATION_ERRATUM_1.md` — `fc63516c898aca6a888781bceeca4a3e377932aa`
- `S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md` — `9f7ff097d8d5e7d216fec63f949fa80af1a01de8`

## Candidate

- branch: `s13q-delivery-documentation-demo-part-b`
- previous reviewed candidate: `8dc62bf2f932fc3e7681f0972be7389b24877481`
- control-plane response: issue #1 comment `5502649124`
- Erratum 2 transfer commit: `f3e997006c2e77c0f6879e38bc7d68f734e2681d`
- new candidate SHA: this branch HEAD after this handoff is committed (recorded in the issue #1 `CODEX_HANDOFF` comment)
- parent chain: `<candidate>` → `f3e9970` → `8dc62bf` → `1c21e41` → `36c2a5e` → `5b084ae` → `41f723f` → `1782a16` → `cf49b45`
- `main` unchanged: **YES** — `main` = `origin/main` = `cf49b45519c45b6ce3e930b813df97f6e983c151`
- files touched vs `cf49b45` (added by this commit): `src/intelligence/delivery-documentation-demo/quality.ts`, `tests/delivery-documentation-demo/deliveryDocumentationDemo.test.ts`, `brain-bootstrap/reports/S13Q-delivery-documentation-demo-verification.md`, and this handoff (the 2 erratum files were transferred in earlier commits)

## What changed

### `src/intelligence/delivery-documentation-demo/quality.ts`

- `DeliveryUnsafeCounters` + `deriveDeliveryUnsafeCounters` gain exactly
  `UC13_new_architecture_decision_introduced` =
  `Number((decision.blockers ?? []).some(b => b.code === "NEW_ARCHITECTURE_DECISION"))`.
  This is the governing violation as surfaced by the real
  `validateDeliveryInput` / `buildDeliveryPackage` path onto `decision.blockers`
  (`blockedResult`, deliveryModel.ts:106-107 / 258-267). NOT a permanent zero,
  NOT a fixture/scenario-id branch, NOT an expected-map lookup, NOT a manual
  mutation. UC01..UC12 meanings unchanged.
- `DELIVERY_ATOMIC_GATE_CLASS.A09 = { blocker: "NEW_ARCHITECTURE_DECISION",
  unsafe_counter: "UC13_new_architecture_decision_introduced", negative_fixture:
  "N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER", forcing: … }`.
  `is_proposed_decision` alone (no db/agent keyword in `af-model.value`)
  classifies as a new **provider** decision — the N08 governing class.
- `DELIVERY_ATOMIC_OWNED_SOURCE.A09.governing_reason` rewritten to the Erratum-2
  GATE_CLASS ruling (was the Erratum-1 "no counter ⇒ not gate-class" analysis).
  The owned fact and the `governing_paths` (`input.architecture_facts.0.is_proposed_decision`)
  are unchanged — one existing fact record, one field.
- `DELIVERY_ATOMIC_UNRESOLVED` is now `{}` (A09 removed; map/export retained).
- `classifyDeliveryAtomicIsolation` **unchanged** — the `gc` branch already
  catches A09 before `if (p.blocked) return "FAIL"` once A09 is in the gate map.
  Still enforces Erratum 1 §5 exactly and the §8 anti-tautology rejections.
- Header comment `UC01..UC12` → `UC01..UC13` with the Erratum-2 interpretation note.

### `tests/delivery-documentation-demo/deliveryDocumentationDemo.test.ts`

- `ISO_GATE` → 8 (adds `A09`); `ISO_FAIL` → `[]`; partition + loop count
  assertions → `{ STRICT: 15, STRUCTURAL_DEPENDENCY: 7, GATE_CLASS: 8, FAIL: 0 }`;
  `DELIVERY_ATOMIC_UNRESOLVED` asserted `{}`.
- `ISO_GATE_COUNTER_DRIVER.A09` drives `UC13` from a real `buildDeliveryPackage`
  of `af-model.is_proposed_decision = true`.
- Every `12 / UC01..UC12 / 12/12 / Array(12).fill(0)` for the **complete** unsafe
  inventory → `13 / UC01..UC13 / 13/13 / Array(13).fill(0)` (Skill-arm A/B
  aggregate + both unsafe-counter suites).
- New test **"A09 GATE_CLASS: one architecture governing fact fail-closes to
  NEW_ARCHITECTURE_DECISION with UC13 fireable and no leak"**: mutates exactly
  one architecture fact (`af-model.is_proposed_decision = true`), reruns the real
  path, asserts source facts mutated = 1, `NEW_ARCHITECTURE_DECISION` fires
  (validation + canonical decision), `UC13 > 0`, `package === null`, no-leak
  (`architecture_summary` and `comp:model` absent from the decision), probe
  classifies `GATE_CLASS`, and `UC13 === 0` on all 10 positives and all 12
  Skill-arm A/B candidates.
- New `erratum2` file checks (`S13Q-ERRATUM-002`, `UC13…`, `A09 = GATE_CLASS`).

## A09 evidence row (Erratum 2 §8)

`A09 | GATE_CLASS | architecture_facts[af-model].is_proposed_decision (one fact
record, one field) | tests no_new_architecture_decision_in_summary | real path
rerun: YES | blocker: NEW_ARCHITECTURE_DECISION | unsafe counter:
UC13_new_architecture_decision_introduced | counter fireable: YES | canonical
negative fixture: N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER | package: null
| no-leak: PASS | source facts mutated: 1`.

## Final isolation gate (fresh)

**30/30 classified valid — 15 STRICT / 7 STRUCTURAL_DEPENDENCY / 8 GATE_CLASS /
0 FAIL.** No previously-accepted row changed after adding `UC13`. Anti-tautology
4/4 still reject; STRICT / STRUCTURAL_DEPENDENCY / GATE_CLASS positive acceptance
checks still pass.

- **STRICT (15):** A02, A07, A08, A10, A11, A14, A15, A17, A18, A19, A22, A24, A28, A29, A30
- **STRUCTURAL_DEPENDENCY (7):** A01→[A24], A03→[A05], A05→[A03,A24], A06→[A03], A16→[A18], A20→[A19], A23→[A22]
- **GATE_CLASS (8):** A04, **A09**, A12, A13, A21, A25, A26, A27
- **FAIL (0):** —

## Complete unsafe inventory `UC01..UC13`

- zero on all 10 positive fixtures (`Array(13).fill(0)`);
- zero on all 12 Skill-arm A/B candidates (`Array(13).fill(0)`);
- each independently fireable — **13/13**.

## Fresh A/B (Erratum 2 §11 / Erratum 1 §12 — recomputed from scratch)

| metric | fresh value |
|--------|-------------|
| baseline total correct | 126 |
| Skill total correct | 360 |
| delta | +234 |
| per-assertion contributions | `D01..D08` = `{9,9,9}` each; `D09` = `{A25:0, A26:9, A27:0}`; `D10` = `{A28:0, A29:9, A30:0}` |
| qualified dimensions | 8 (`D01..D08`) |
| distinct improved assertion ids per qualified dim | 3 |
| regressions | 0 |
| max single-assertion share — per qualified dim | 9/27 = 0.333 |
| max single-assertion share — global | 9/234 ≈ 0.038 |
| per-scenario flips | `[0, 0, 0, 26, 26, 26, 26, 26, 26, 26, 26, 26]` |
| gate-valid baseline scenarios | 3 |
| Skill-arm unsafe counters (aggregate `UC01..UC13`) | 0 / 0 (13 counters) |

`observeAtomic` output byte-identical (snapshot test green) — the A/B table
**reproduces the prior values exactly**, reported as freshly reproduced (not
carried forward). Only the Skill-arm unsafe aggregate assertion changed
(`12 → 13` counters, still all zero).

## DEEP QA (Node v24.19.0 / npm 11.17.0) — fresh totals

| gate | result |
|------|--------|
| `npm run typecheck` | clean |
| focused `npx vitest run tests/delivery-documentation-demo` | 83/83 (was 82; +1 new A09/UC13 test) |
| P01..P10 | 10/10 |
| N01..N40 | 40/40 |
| isolation `A01..A30` | 30/30 — 15 / 7 / 8 / 0 |
| `S13Q-HI-001..030` | 30/30 |
| unsafe counters `UC01..UC13` | zero where required; 13/13 fireable |
| anti-tautology | 4/4 rejected |
| per-feature ablation | 7/7 |
| full `npm test` (pre-build) | 1323/1323 across 24 files |
| `rm -rf dist` (confirmed absent) → `npm run build` | clean — 786 emitted files (262 `.js` + 262 `.d.ts` + 262 `.js.map`) |
| full `npm test` (post-build) | 1323/1323 — equal pre/post |
| `git diff --check` (`quality.ts` + S13Q test) | clean |
| dependency audit | `package.json` / `package-lock.json` unchanged vs `cf49b45` |
| Core audit | `src/core/**` untouched |
| AgentDefinition audit | untouched |
| 5-blob Part A integrity at HEAD | all 5 match |
| allowed-path audit (`git diff --stat cf49b45..HEAD`) | only the 2 erratum files, `quality.ts`, the S13Q test, this report, and handoff files |
| independent review (advisor) | performed before declaring done |

## Boundaries

- `main` / `origin/main` still `cf49b45519c45b6ce3e930b813df97f6e983c151` — never pushed, no amend/rebase/force/reset.
- New commit → new SHA on `s13q-delivery-documentation-demo-part-b` only.
- No Core, AgentDefinition, dependency, `package.json`, `STATE.yaml`, `CURRENT.md`, or other-stage changes.
- `HI-052`: **NOT_AWARDED**. `steps.S13Q`: `NOT_STARTED`. S13R: `NOT_STARTED`.

## Required ChatGPT action

Perform committed-source review of the exact new SHA and, only if clean,
authorize a DIFFERENT fresh non-authoring / non-fork / read-only independent
verifier. Fresh independent verification remains forbidden until that review
accepts this exact SHA. The verifier must apply both isolation errata together
with the original three Part A artifacts and reproduce 30/30 — 15 STRICT /
7 STRUCTURAL_DEPENDENCY / 8 GATE_CLASS / 0 FAIL, `UC01..UC13` zero where required
and each independently fireable, `A09 → NEW_ARCHITECTURE_DECISION → UC13 →
fail-closed / no-leak`.
