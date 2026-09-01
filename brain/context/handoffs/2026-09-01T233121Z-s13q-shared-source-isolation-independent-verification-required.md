# S13Q — shared-raw-source atomic isolation (repair #3) — INDEPENDENT VERIFICATION REQUIRED

- handoff_id: 2026-09-01T233121Z-S13Q-shared-source-isolation
- step: S13Q
- status: INDEPENDENT_VERIFICATION_REQUIRED
- branch: `s13q-delivery-documentation-demo-part-b` (push branch only; `main` stays `cf49b45519c45b6ce3e930b813df97f6e983c151`)
- parent: `1782a1624cdff9af2605fb43c4b905c6a7db2d5a`
- new candidate SHA: recorded in the issue #1 `CODEX_HANDOFF` comment for this handoff_id
- previous rejected targets: `cf49b45519c45b6ce3e930b813df97f6e983c151` (expected_observation mutation), `1782a1624cdff9af2605fb43c4b905c6a7db2d5a` (per-atomic derived-decision projections)
- control-plane repair comment: `5500744002`
- Part A baseline commit: `0218856` — blobs unchanged: skill `1198834124dc32c34721130566efdc5fda78465f`, quality-contract `5f931e5372ff0319eee6e86fe0a1879c0300153f`, spec `6d7078633c1d0a90e8204a277de6100ed517a112`

## What changed

`src/intelligence/delivery-documentation-demo/quality.ts` and
`tests/delivery-documentation-demo/deliveryDocumentationDemo.test.ts` only.

The rejected per-atomic derived-decision projection layer
(`DeliveryAtomicProjection`, `buildDeliveryAtomicProjection`,
`observeAtomicFromSourceFact`, `deriveDeliveryAtomicSourceFacts`, the
projection-shaped `DELIVERY_ATOMIC_OWNED_SOURCE` / probe /
`isValidSourceFactIsolationEvidence` / `legacyMutationEvidence`) is deleted and
replaced with:

- `observeAtomic(id, input, decision, audit)` — the ONE real predicate (the 30
  `case` bodies unchanged; output byte-identical to `1782a16`, verified by an
  840-line snapshot across `baseInput`, `minimalInput` and the 12 A/B scenarios
  for both the canonical and a `package: null` decision — `diff` empty).
- `DeliveryAtomicRawSource = { input, audit }` + `deliveryAtomicRawSource() =
  structuredClone({ input, audit })` — ONE shared detached raw source model, no
  `DeliveryDocumentationDemoResult` / package / coverage / blockers / warnings.
- `DELIVERY_ATOMIC_OWNED_SOURCE[id] = { owned_fact, source_family, mutate(src) }`
  — 30 entries, each mutating exactly one real
  `DeliveryDocumentationDemoInput` field (`delivery_identity`,
  `repository_facts`, `verification_evidence`, `architecture_facts`,
  `demo_surface`, `limitations`, `next_step_candidates`, `policy`) or explicit
  detached `audit` evidence; 30 pairwise-distinct `owned_fact` names, none with a
  derived segment; each `mutate` throws `ISOLATION_TARGET_ABSENT:<path>` on a
  missing target.
- `probeDeliveryAtomicSourceFactIsolation(id, input, audit?)` — freeze
  `origSrc`, `origDecision = buildDeliveryPackage(origSrc.input)`, all 30
  `origObs` via `observeAtomic`; clone, `mutate`, rerun the real
  `buildDeliveryPackage`, recompute all 30 `mutObs`; diff. Returns
  `governing_changed`, `changed`, `cross`,
  `mutated_field_paths = jsonDiffPaths(origSrc, mut)`, `producer_reran`,
  `original_source_unchanged`, `original_decision_unchanged`, `blocked`.
- `classifyDeliveryAtomicIsolation(probe)` → `STRICT` | `STRUCTURAL_DEPENDENCY` |
  `GATE_CLASS` | `FAIL`.
- `DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES` (9 entries, each `also_changes` +
  verbatim `forcing` line) and `DELIVERY_ATOMIC_GATE_CLASS` (A25, A27).
- Anti-tautology: `legacyExpectedObservationMutationEvidence` and
  `legacyDerivedDecisionMutationEvidence` both classify `FAIL` /
  `isValidSourceFactIsolationEvidence` `false`; real STRICT probe `true`.
  `mutateDeliverySourceFact` kept & exported only for regression (a).

## Isolation result (measured against `baseInput()`)

- 19/30 STRICT (zero cross): A02 A03 A07 A08 A10 A11 A12 A14 A15 A17 A18 A19 A20 A21 A22 A24 A28 A29 A30
- 9/30 STRUCTURAL_DEPENDENCY (measured `cross` ⊆ declared `also_changes`):
  A01→[A24], A04→[A03], A05→[A03], A06→[A03],
  A09→[A08] (declared also_changes `[A07,A08]` — deliberate superset: the
  forcing expression deliveryModel.ts:396 also reads `components`, which A07
  observes; A07 unmoved under this BOUNDARY-only mutation; `cross ⊆ also_changes`
  holds),
  A13→[A14,A15], A16→[A18], A23→[A22], A26→[A12]
- 2/30 GATE_CLASS: A25 (forced BLOCKED via SECRET_MATERIAL), A27
  (`governing_changed === false`, forced BLOCKED via overclaim — same fact as
  `S13Q-HI-022`)
- FAIL = 0

## Fresh DEEP QA (Node v24.19.0 / npm 11.17.0 — everything recomputed)

- `tsc --noEmit`: PASS
- focused `tests/delivery-documentation-demo/`: 81/81 (was 82/82 at `1782a16`;
  the rewrite removed two sub-tests that read the deleted projection layer —
  `pins the fixture cells…` and `wrong-field negative control` — and added one,
  `partitions the 30 atomics into 19/9/2`; net −1, same for the full suite
  1322 → 1321)
- positives 10/10; negatives 40/40; ablation 7/7; hard invariants 30/30
- isolation 30/30 (19 STRICT / 9 STRUCTURAL_DEPENDENCY / 2 GATE_CLASS; FAIL 0)
- anti-tautology: expected_observation mutation REJECTED, derived-decision
  mutation REJECTED, real STRICT probe ACCEPTED
- `observeAtomic` byte-identity vs `1782a16`: PASS (snapshot diff empty)
- unsafe counters UC01..UC12: zero on positives and Skill arm; each fireable
- actual-candidate gate / real S12→S10→S09 path: PASS
- A/B (fresh, same-path 12 scenarios): baseline **126**, Skill **360**, delta
  **+234**, qualified dimensions **8** (D01..D08), regressions **0**,
  per-dimension contributions `D01..D08 = {9,9,9}` each, `D09 = {A25:0,A26:9,A27:0}`,
  `D10 = {A28:0,A29:9,A30:0}`, per-scenario flips `[0,0,0,26,26,26,26,26,26,26,26,26]`,
  baseline gate-valid scenarios **3**, max single-assertion share 0.333 (global
  ≈ 0.038), Skill-arm unsafe counters 12/12 zero. Matches the prior frozen
  table; no frozen expectation updated.
- full `npm test` pre-build: **1321/1321** across 24 files
- `rm -rf dist` (absent) → `tsc -p tsconfig.json`: clean, **786** files
- full `npm test` post-build: **1321/1321** across 24 files (equal pre/post)
- `git diff --check` on the two module files: clean
- allowed-path audit `git diff --stat cf49b45..HEAD`: only `quality.ts`, the
  S13Q test, `brain-bootstrap/reports/S13Q-delivery-documentation-demo-verification.md`,
  and handoff file(s) under `brain/context/handoffs/`
- Part A blobs at HEAD unchanged (3/3)

## Part A §21 ruling requested

Strict single-source isolation holds for 19/30. 9/30 carry a producer-forced
structural dependency (§21 defines multiple atomics over one `pkg` array or the
revision spine). 2/30 (A25, A27) are package-level safety-gate invariants
un-isolatable by any source mutation (`validateDeliveryInput` fail-closes before
the material reaches the producer). The QC `source_fact_isolation.rule` says
"governing assertion FAMILY" (undefined; the QC has only dimensions + atomics)
while the Skill says "single-observation isolation". Control plane to rule:
(a) declare these dependencies in semantic contract §21, OR (b) re-decompose the
coupled observations to be source-disjoint, OR (c) define "family" as the
3-assertion `semantic_dimension`. Sub-question: A09's declared `also_changes`
`[A07,A08]` is a deliberate superset of its measured cross `[A08]` — rule whether
declared dependencies must be tight to the measured cross or may be conservative
over the forcing expression's inputs.

## Do NOT

- launch the fresh verifier from this builder
- award `HI-052`
- begin S13R
- modify Part A, `src/core/**`, `AgentDefinition`, `package.json` /
  `package-lock.json`, `STATE.yaml`, `CURRENT.md`, other stages
- push to `main` / force / reset / rebase / amend

## Required next

A DIFFERENT fresh non-authoring, non-fork, read-only verifier reproduces every
number above against the exact new candidate SHA and the complete integrated
S13Q DEEP Quality Contract, then the ChatGPT control plane rules on the §21
question before `HI-052` and `steps.S13Q` closure.
