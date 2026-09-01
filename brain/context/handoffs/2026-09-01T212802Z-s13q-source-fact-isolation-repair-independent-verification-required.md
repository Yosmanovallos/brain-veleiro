# S13Q — source-fact isolation repair — INDEPENDENT VERIFICATION REQUIRED

- handoff_id: `2026-09-01T212802Z-S13Q-source-fact-isolation-repair`
- step: S13Q
- status: `INDEPENDENT_VERIFICATION_REQUIRED`
- previous_rejected_target: `cf49b45519c45b6ce3e930b813df97f6e983c151`
- rejection_comment: `5500185778` (issue #1, `decision: BUILDER_REPAIR_REQUIRED`)
- part_a_baseline: `021885611467d96eb0c450a4b4d64068e4dacca0`

## Branch / commit state

- Branch: `s13q-delivery-documentation-demo-part-b`
- New candidate SHA: recorded in the issue #1 `CODEX_HANDOFF` comment posted with
  this handoff (`git rev-parse origin/s13q-delivery-documentation-demo-part-b`).
- Push: normal non-force `git push origin s13q-delivery-documentation-demo-part-b`
- `main` advanced during repair: **NO** — `main` and `origin/main` remain
  `cf49b45519c45b6ce3e930b813df97f6e983c151` throughout. The prior builder's
  accidental push of `cf49b45` to `main` is pre-existing, accepted control-plane
  debt and was left untouched. No `reset` / `--force` / rebase / amend.
- The new candidate is a NEW commit (child of `cf49b45`), not an amend.

## The one blocking defect and its repair

**Rejected (`cf49b45`).** `quality.ts` `deriveDeliverySourceFacts()` froze each
atomic's already-derived `expected_observation`; `mutateDeliverySourceFact()`
overwrote only that cell with `{ isolation_probe_for: id }`;
`evaluateDeliveryAtomicObservations()` recomputed the unchanged actual
observation and compared it to the corrupted expected cell. That is
comparison-cell isolation, not owned-source-fact ownership + recompute — the
tautology class forbidden by QC `source_fact_isolation` and semantic contract
§21.

**Repaired.** A real owned raw source-fact projection layer now sits between
input and observation (mirrors accepted S13N):

- `buildDeliveryAtomicProjection(id, input, decision, audit)` — deep-cloned raw
  slice of exactly the input / decision-section / audit fields atomic `id`'s
  predicate reads (raw fields, not a derived tuple / boolean).
- `observeAtomicFromSourceFact(id, fact)` — the ONE real predicate; the 30
  `observeAtomic` `case` bodies were moved here verbatim; reads only
  `fact.projection`.
- `observeAtomic(...)` is now a thin wrapper delegating to
  `observeAtomicFromSourceFact` with a built projection. Output is
  **byte-identical** to the pre-refactor switch (verified by direct snapshot of
  all 30 observations over `baseInput` + `minimalInput` + 12 A/B scenarios, both
  canonical and `package:null` decisions).
- `DELIVERY_ATOMIC_OWNED_SOURCE` — 30 entries, each naming ONE raw field
  (pairwise distinct) and a `mutate` that changes exactly that field and throws
  if it is absent.
- `probeDeliveryAtomicSourceFactIsolation(id, input, audit?)` — freezes 30
  canonical projections + observations, deep-clones `facts[id]`, mutates one
  owned raw field, recomputes the REAL observer for all 30 from
  `{…canonical, [id]:mutated}`, diffs. `governing_changed` is a measurement;
  `cross_assertion_changes` is empty by construction (every `j≠id` reads its own
  untouched clone); `original_input_unchanged` / `original_facts_unchanged` are
  byte comparisons.
- `isValidSourceFactIsolationEvidence(r)` — mechanical: `true` only when every
  `changed_source_paths` entry is strictly inside `projection.*` (never
  `expected_observation` / `correct` / `actual_observation`), observation
  recomputed, governing moved, no sibling moved.
- `legacyMutationEvidence(input, id)` — runs the rejected
  `mutateDeliverySourceFact` path, diffs with the same helper → path
  `expected_observation` (outside `projection`) → `isValidSourceFactIsolationEvidence`
  returns **false**. `mutateDeliverySourceFact` retained/exported ONLY for this
  regression; doc comment says so.
- Wrong-field negative control: mutating a projection field the predicate does
  not read leaves the governing observation byte-identical, so 30/30 is a
  measurement, not a check that cannot fail.

Ownership is **field-level** (30 distinct mutated fields), not
whole-slice-disjoint: projections overlap in content where predicates read the
same derived section, and A25/A27/A29 carry a whole-decision slice, A28 the whole
input (scan / rebuild predicates). Stated in the report. No dependency/waiver map
invented. No Part A semantic gap found.

## Evidence inventory (Node v24.19.0, npm 11.17.0)

- typecheck: `tsc --noEmit` PASS, 0 errors
- focused `tests/delivery-documentation-demo/`: **82/82** (was 79 at `cf49b45`; +3 isolation tests)
- positives `P01..P10`: 10/10
- negatives `N01..N40`: 40/40, each triggers its named blocker
- owned-source-fact isolation `A01..A30`: **30/30** — one raw field mutated, real
  observer recomputed, exactly the governing assertion moves, 0 cross-assertion
  changes, input + canonical facts byte-stable, `isValidSourceFactIsolationEvidence` accepts
- 30 owned fields pairwise distinct: PASS
- anti-tautology regression: PASS — legacy `expected_observation` path REJECTED
  (A01/A14/A29), new probe ACCEPTED
- wrong-field negative control: PASS
- per-feature ablation: 7/7
- hard invariants `S13Q-HI-001..030`: 30/30
- unsafe counters `UC01..UC12`: 12/12 zero on positives + Skill arm; each independently fireable
- actual-candidate gate / real S12→S10→S09 path: PASS
- A/B baseline total correct: **126** (held, not recomputed)
- A/B Skill total correct: **360** (held)
- A/B delta: **+234** (held)
- A/B qualified dimensions: **8** (`D01..D08`, threshold ≥ 7) (held)
- A/B atomic regressions: **0**
- A/B contributions table: unchanged — `D01..D08 = {9,9,9}`,
  `D09 = {A25:0,A26:9,A27:0}`, `D10 = {A28:0,A29:9,A30:0}`
- A/B per-scenario flips: unchanged — `[0,0,0,26,26,26,26,26,26,26,26,26]`
- A/B baseline gate-valid scenarios: 3
- A/B concentration (max single-assertion share per qualified dim): 9/27 = 0.333 (≤ 0.50)
- full suite pre-build: **1322/1322** across 24 files
- clean build: `rm -rf dist` (confirmed absent) → `tsc -p tsconfig.json` clean —
  **786** files (`262 .js` + `262 .d.ts` + 262 maps)
- full suite post-build: **1322/1322** across 24 files — equal pre/post
- `git diff --check` on `quality.ts` + S13Q test: clean
- boundary/dependency/protected-surface audit: `package.json` /
  `package-lock.json` unchanged; no `node:fs`/`node:net`/`node:http`/`child_process`/
  `fetch(`/`process.env`/`Date.now()`/`new Date()`/`Math.random` in the module;
  Core, AgentDefinition, `selectSkillForTask`, S09/S10/S12, every stage's Part A untouched
- allowed-path audit (`git diff --stat` vs `cf49b45`): only
  `src/intelligence/delivery-documentation-demo/quality.ts`,
  `tests/delivery-documentation-demo/deliveryDocumentationDemo.test.ts`,
  `brain-bootstrap/reports/S13Q-delivery-documentation-demo-verification.md`,
  and this handoff file
- canonical Part A blobs at HEAD: skill `1198834124dc32c34721130566efdc5fda78465f`,
  quality `5f931e5372ff0319eee6e86fe0a1879c0300153f`,
  spec `6d7078633c1d0a90e8204a277de6100ed517a112` — all three match
- Part A semantic gap: none

## Pre-existing working-tree noise (NOT this repair's scope)

On arrival the working tree already had six `M brain-bootstrap/**` S13N/S13O
`.yaml`/`.md`/spec files and eight `??` root `*.md`/`.yaml` files
(`AUTHORIZE_S13H_PART_B.md`, `CODEX_*`, `OBSERVABILITY_AI_SYSTEMS_*`,
`S13P_OBSERVABILITY_AI_SYSTEMS_DEEP.yaml`). They pre-date this session, are
unrelated to S13Q, and were left untouched and unstaged. Do not read them as
this candidate's scope.

## Canonical state (unchanged by this repair)

- `HI-052`: NOT_AWARDED
- STATE S13Q: NOT_STARTED
- S13R: NOT_STARTED

## Required ChatGPT action

Authorize a DIFFERENT fresh non-authoring, non-fork, read-only verifier against
the exact NEW candidate SHA and the complete integrated S13Q DEEP Quality
Contract. Do not launch the verifier against `cf49b45`. Do not begin S13R. Do not
award `HI-052`.
