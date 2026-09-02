# S13Q Delivery Documentation & Demo — Builder Verification

Status: `BUILDER REPAIR (source-fact isolation) / INDEPENDENT VERIFICATION REQUIRED`

> **2026-09-01 repair.** The first Part B candidate `cf49b45` was rejected by
> committed-source review (issue #1 comment `5500185778`,
> `decision: BUILDER_REPAIR_REQUIRED`) for one blocking mechanical defect: the
> `30/30 atomic isolation` proved *comparison-cell* isolation, not
> *owned-source-fact* isolation. The redesigned mechanism, the anti-tautology
> regression and every fresh QA number are in **§ Source-fact isolation repair
> (2026-09-01)** at the end of this report. Everything above that section is the
> prior builder evidence and is unchanged except where that section supersedes a
> count.

Documentation HEAD before Part B: `021885611467d96eb0c450a4b4d64068e4dacca0` (`docs: integrate canonical S13Q Part A`).

Baseline at handoff: `HEAD == main == origin/main == remote main == 0218856`.

## Outcome

S13Q Part B is a pure, deterministic Intelligence reference module that turns
verified repository facts and caller-supplied evidence into one bounded,
truthful, handoff-ready delivery package (executive summary, existing-architecture
summary, evidence-backed setup/run procedure, evidence-bound demo walkthrough,
limitations register, status-labeled next-step register, deduplicated evidence
index, provenance, and a derivative deterministic Markdown projection). It is
reachable through the real S12 → S10 → S09 path and gated by a deterministic
recomputation of the canonical package. No Core, AgentDefinition, dependency,
provider binding, filesystem, network, shell, clock or randomness surface was
introduced. The only registry change is one append-only S12 catalog entry
(`intelligence.delivery-documentation-demo.s13q`, entry 20 of 20). All
builder-side deterministic gates pass. HI-052 is **not** awarded by this builder
and `steps.S13Q` remains `NOT_STARTED`; a fresh non-authoring, non-fork,
read-only verifier is required next.

## Canonical Part A integrity

Working-tree bytes equal the transferred canonical bytes (Git blob identity):

| Artifact | Bytes | Git blob |
|---|---:|---|
| `brain-bootstrap/skills/DELIVERY_DOCUMENTATION_DEMO_SKILL_S13Q.md` | 15100 | `1198834124dc32c34721130566efdc5fda78465f` |
| `brain-bootstrap/quality-contracts/S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml` | 19354 | `5f931e5372ff0319eee6e86fe0a1879c0300153f` |
| `brain-bootstrap/specs/DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md` | 28477 | `6d7078633c1d0a90e8204a277de6100ed517a112` |

No Part A file was edited by Part B. No semantic contradiction was found in Part A —
no return to the ChatGPT Authoring Gate is required.

## Implementation

New module `src/intelligence/delivery-documentation-demo/` (pure Intelligence, no
new dependency):

- `constants.ts` — `DELIVERY_CEILINGS` verbatim from semantic contract §18; safe-ref
  grammar; forbidden secret key/value regexes; raw-log / raw-`.env` /
  fresh-timestamp / self-cert / overclaim / demo-runtime / demo-browser /
  S13R / S14 / S15 / architecture-decision markers; env/port/url/path token
  grammars; `collectStrings` (string-leaf newline join, so line-break-sensitive
  markers work on the value graph).
- `types.ts` — the §6 input model and §7 output model.
- `deliveryModel.ts` — total fail-closed `validateDeliveryInput`; the section
  builders (claims + claim-status derivation per §8, architecture summary per §11,
  setup/run per §12, demo per §13, limitations per §14, next steps per §15,
  deduplicated deterministically-ordered evidence index per §12, provenance,
  evidence-conflict detection per §9); the §19 status decision table;
  `renderDeliveryPackageMarkdown` (deterministic, adds no claim, 262144-byte
  ceiling); `validateDeliveryCandidate` + `evaluateDeliveryCandidateGate`
  (recompute the canonical package and reject any candidate not byte-equal,
  §20). Pure: no wall clock, randomness, environment, IO or input mutation;
  never awards PASS or HI-052.
- `quality.ts` — 30 atomic observers `A01..A30` over the 10 declared dimensions
  `D01..D10`; `deriveDeliverySourceFacts` (frozen raw tuples from the canonical
  build); `evaluateDeliveryAtomicObservations`; `mutateDeliverySourceFact`
  (sentinel on `expected_observation` only); the 12 unsafe counters
  `UC01..UC12`.
- `deliveryDocumentationDemoSkill.ts` — the append-only `SkillDefinition` with 30
  generic MUST rules.
- `planDeliveryDocumentationDemo.ts` — S12 discovery + exact lazy Skill load → S10
  `compileAgentDefinition` → S09 `runAgent` → parse the actual candidate →
  `evaluateDeliveryCandidateGate`. Never scores a raw rejected candidate.
- `index.ts` — barrel.

Registry: one append-only entry in `src/intelligence/skills/index.ts`
(`referenceSkillCatalogEntries` length `19 → 20`). Two adjacent prior-stage
boundary tests updated mechanically — exactly the class of edit S13O/S13P applied
for their directories:

- `tests/guardrails-security/guardrailsSecurity.test.ts` — catalog length
  `19 → 20`; new `[19]` id assertion `intelligence.delivery-documentation-demo.s13q`;
  the now-authorized `delivery` token removed from the forbidden-directory regex
  (`/delivery|deployment|capability-registry/` → `/deployment|capability-registry/`).
- `tests/frontend-product-surface/frontendProductSurface.test.ts` — the
  now-authorized `delivery-documentation` token removed from the same class of
  forbidden-directory regex.

No other test file needed a mechanical bump: no suite-total or file-count
constant is pinned anywhere in `tests/`.

## Builder-side gates (all PASS)

- Runtime: Node `v24.19.0`, npm `11.17.0`.
- `tsc --noEmit`: PASS (0 errors).
- Focused S13Q suite (`tests/delivery-documentation-demo/`): **79/79**.
  - Canonical positive fixtures `P01..P10`: **10/10**, each named in the quality
    contract, each run through the real S12→S10→S09 gate path, each asserted to
    its exact status (`READY` for P01–P04, P06–P10; `PARTIAL` for P05) plus its
    governing evidence behaviour (verified-claim presence, library/UI surface with
    its own steps and fallbacks, `DEMO_CREATES_RUNTIME` absent for the
    documented-inspection surface, explicit partial architecture warning, explicit
    HIGH/KNOWN limitation, retained evidence conflict + precedence note, S13R next
    step labelled `PROPOSED` only, safe env-var name with no value, deterministic
    Markdown).
  - Canonical negative inventory `N01..N40`: **40/40**, every id present verbatim
    in the quality contract, each probe asserting `BLOCKED` **and** the specific
    governing blocker code (or, for the candidate-level cases N37/N38/N39, the
    specific gate rejection reason). Not one passes by default or coercion.
  - Atomic single-assertion isolation: **30/30** — from the canonical frozen
    source facts, mutating one owned `expected_observation` flips exactly its own
    `correct` result and no other; a control shows that mutating the produced
    *decision* instead flips more than one assertion (fake isolation rejected).
  - Per-feature ablation: **7/7** — activating exactly one method concept in the
    truth-blind producer changes exactly one owned package section
    (`executive_summary`, `architecture_summary`, `setup_and_run`, `demo_script`,
    `limitations`, `next_steps`, `evidence_index`) and leaves the other six
    byte-identical; the seven concepts together reproduce the canonical package
    byte for byte.
  - Hard invariants `S13Q-HI-001 .. S13Q-HI-030`: **30/30**, recomputed outside
    the candidate.
  - Unsafe counters `UC01 .. UC12`: zero on every positive fixture **and** every
    Skill-arm A/B candidate; each counter separately shown able to fire on a real
    governing violation.
  - Real S12 → S10 → S09 path with the actual candidate: PASS (`skillLoaded`,
    `run.outcome === "SUCCESS"`, gate valid, input snapshot unchanged, 30 Skill
    rules). Baseline arm (no Skill) routes the same visible packet, produces a
    divergent candidate, and is gated to `BLOCKED` with a `CANDIDATE_REJECTED`
    blocker — the post-gate decision, never the raw candidate, is what is scored.
  - Anti-gaming: `deliveryProvider.ts` imports only `types.js` /
    `constants.js` (marker, ceilings, `collectStrings`,
    `containsForbiddenSensitiveMaterial`); its source contains no fixture /
    scenario / arm / with-Skill / Skill-id / expected-answer / grader token and
    no import of the canonical builder, gate or evaluator; irrelevant prose
    produces a byte-identical result while the real method prose reproduces the
    canonical package; a one-concept paraphrase activates exactly its feature and
    visible packet facts still move outcomes inside the Skill arm.

### Same-path A/B impact (12 frozen scenarios, 30 atomics per arm)

Same materialised path, same provider object, same parser/gate/evaluator;
baseline arm loads no Skill, Skill arm loads the real S13Q Skill; both score the
**post-gate** decision.

| metric | value |
|---|---|
| baseline total correct | 126 |
| Skill total correct | 360 |
| delta | +234 |
| qualified dimensions (threshold ≥ 7) | 8 (`D01..D08`) |
| atomic regressions | 0 |
| global max single-assertion share of positive delta | 9 / 234 ≈ 0.0385 |
| per qualified dimension | contributions `{9, 9, 9}`, distinct improved = 3, share = 0.333 |
| `D09` / `D10` | not qualified (only `A26` / only `A29` improve — audit/structural) |
| per-scenario flips | `[0,0,0, 26,26,26,26,26,26,26,26,26]` |
| baseline gate-valid scenarios | exactly 3 (the minimal scenarios) |
| Skill-arm unsafe counters | all zero |

**On the rectangular contribution table.** Every qualified dimension shows
contributions `{9, 9, 9}`. This shape is *forced by the contract*, not chosen:
§20 mandates a byte-equality candidate gate, §22 mandates scoring the post-gate
decision, and §7 makes `package: DeliveryPackage | null`. Given those three, any
package-reading atomic flips **iff** the gate rejects the divergent baseline
candidate — and when it does, `package` becomes `null` and all of `A01..A24`
plus `A26` collapse to `NO_PACKAGE` at once, on each of the 9 distinct rich
scenarios (26 flips each) and on none of the 3 minimal scenarios (0 flips each,
so no duplicate-fixture inflation). The claim that these are genuinely
independent improvements — not one cross-cutting effect — is carried by the
**per-feature ablation** block: seven method concepts, each shown to change
exactly one owned package section in the producer with the other six sections
byte-identical. Weakening the gate below byte-equality to produce a ragged table
would itself violate §20.

### Build / suite / hygiene

- Full suite before clean build: **1319/1319** across **24** files.
- Genuine `rm -rf dist` then `tsc -p tsconfig.json`: clean — **786** files under
  `dist/` (262 `.js`; the project tsconfig compiles `tests/**` and `src/**`).
- Full suite after build: **1319/1319** across **24** files — counts equal
  pre/post.
- Architecture / dependency / protected-surface audit: `package.json` and
  `package-lock.json` unchanged; no `node:fs` / `node:net` / `node:http` /
  `child_process` / `fetch(` / `process.env` / `Date.now()` / `new Date()` /
  `Math.random` / provider SDK / store in the module; Core, AgentDefinition,
  `selectSkillForTask`, and S09/S10/S12/S13I–S13P canonical Part A untouched.
- `git diff --check` on the builder's tracked paths: clean. The only tracked
  modifications are `src/intelligence/skills/index.ts` and the two adjacent
  boundary tests. The six pre-existing `brain-bootstrap/` S13N/S13O files show
  WSL LF/CRLF noise only (`git diff --ignore-space-at-eol` is empty) and were
  last committed in `e73bcb1` — they predate this step and are not staged.
- `brain-bootstrap/STATE.yaml` unchanged. `steps.S13Q` remains `NOT_STARTED`,
  `current_step` remains `S13P`. The §38 stale `repository.head_sha` metadata is
  a continuity-maintenance item for the integrator, out of this builder's
  allowed-path scope; it is left untouched and noted here only.

## Advisor-driven fixes recorded

An independent review pass (advisor + fresh critical read) drove the following
Part B fixes before this report:

1. **A/B contribution evidence.** Added a per-feature ablation block (7 concepts →
   7 owned sections, others byte-identical) plus per-scenario flip counts, and
   documented the forcing argument above, so the rectangular `{9,9,9}` table is
   explained rather than presented bare (semantic contract §22 anti-gaming).
2. **Negative/positive inventory checks.** Replaced a self-referential
   ordering assertion with checks that every `P01..P10` and `N01..N40` id appears
   verbatim in `S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml`.
3. **HI-002 / HI-004.** HI-002 now uses the `CLAIM_BOUND_TO_WRONG_REVISION` case
   (claims bind to the delivered revision) and confirms an accepted ancestry
   relation lifts the block; HI-004 now requires `IMPLEMENTED` claims to be
   backed by a committed repository fact at the delivered revision, only the
   unknown/deferred/available/not-implemented set being exempt.
4. **P02 / P03.** Given real distinct demo surfaces (library-import surface,
   local-UI surface) each with their own steps, evidence and fallbacks, so each
   exercises its named condition (semantic contract §29).
5. **A26 observation** widened to also check approved-set membership of every
   emitted env-var name and the absence of any inline `NAME=value` secret.
6. Feature `requireDemoFallback` merged into `buildDemoScript` (sub-step
   fallbacks are only meaningful when sub-steps are built), giving seven cleanly
   independent producer concepts.

## Independent verification required

A DIFFERENT fresh non-authoring, non-fork, read-only verifier must independently
reproduce, for the candidate SHA recorded in the issue #1 `CODEX_HANDOFF`
comment: the three Part A blob hashes; focused 79/79 (positives 10/10, negatives
40/40, isolation 30/30, ablation 7/7, hard invariants 30/30, unsafe counters
12/12 zero and each fireable, real S12→S10→S09 path, anti-gaming hygiene); A/B
baseline 126 → Skill 360 (+234), 8 qualified dimensions, 0 regressions,
concentration ≈ 0.0385, per-scenario flips `[0,0,0,26×9]`, exactly 3 baseline
gate-valid scenarios; full 1319/1319 before and after a genuine clean build (786
files); architecture / dependency / diff hygiene; verifier worktree
immutability.

`HI-052` may be awarded only after that fresh verification is accepted by the
ChatGPT control plane. The builder did not award it. `steps.S13Q` remains
`NOT_STARTED` and S13R remains `NOT_STARTED`.

---

## Source-fact isolation repair (2026-09-01)

Bounded repair of the single blocking defect in the rejected candidate
`cf49b45519c45b6ce3e930b813df97f6e983c151`. Scope: `quality.ts` and the S13Q
test file only. Canonical Part A untouched; no dependency/waiver map invented;
positives, negatives, ablation, hard invariants, unsafe counters, the candidate
gate, the post-gate A/B scorer, and the truth/fixture/arm-blind provider are all
preserved byte-for-byte in behaviour.

### The rejected mechanism (`cf49b45`)

In `src/intelligence/delivery-documentation-demo/quality.ts` as committed at
`cf49b45`:

1. `deriveDeliverySourceFacts()` computed each atomic's `expected_observation`
   from the canonical `buildDeliveryPackage` result and froze it in a
   `DeliverySourceFact { field_family, expected_observation, evidence }`.
2. `mutateDeliverySourceFact(facts, id)` overwrote **only that already-derived
   `expected_observation`** with the sentinel `{ isolation_probe_for: id }`.
3. `evaluateDeliveryAtomicObservations()` recomputed the *unchanged* actual
   observation and compared it to the now-corrupted expected cell, so exactly one
   `correct` flag flipped.

That proves the comparison cell for each atomic is independent. It does **not**
prove that each atomic is recomputed from an owned underlying input/evidence
fact, nor that mutating that underlying fact changes only the governing
assertion. It is the same tautological class the QC `source_fact_isolation`
rule and semantic contract §21 forbid ("Flipping an already-derived boolean does
not count as isolation").

### The redesigned mechanism (owned raw source-fact projection)

Mirrors the accepted S13N pattern (`deriveAgentEvalSourceFacts` +
`deriveAgentEvalDecisionFromSourceFacts` + `mutateAgentEvalSourceFact`) and goes
one level more raw:

- **`buildDeliveryAtomicProjection(id, input, decision, audit)`** — builds, for
  one atomic, a detached deep clone (`structuredClone`) of exactly the raw
  input / decision-section / audit fields that atomic's predicate reads. Not a
  derived tuple, not a pre-baked boolean — the actual `delivery_identity`,
  `repository_facts`, `demo_surface`, package sections (`executive_summary`,
  `architecture_summary`, `setup_and_run`, `demo_script`, `limitations`,
  `next_steps`, `evidence_index`, `provenance`), `coverage`, `blockers`,
  `warnings`, and audit flags.
- **`observeAtomicFromSourceFact(id, fact)`** — the one real predicate body.
  The 30 `case` bodies from the pre-refactor `observeAtomic` switch were **moved
  here verbatim**; it reads only `fact.projection`.
- **`observeAtomic(id, input, decision, audit)`** is now a thin wrapper:
  `observeAtomicFromSourceFact(id, { …, projection: buildDeliveryAtomicProjection(…) })`.
  Its output is **byte-identical** to the pre-refactor single switch — verified
  by a direct snapshot of all 30 observations across `baseInput`, `minimalInput`
  and the 12 A/B scenarios, for both the canonical decision and a
  `package: null` decision, before and after the refactor (deep-equal). So
  `buildDeliveryPackage`, `evaluateDeliveryCandidateGate`,
  `deriveDeliverySourceFacts`, `evaluateDeliveryAtomicObservations` (the A/B
  scorer), `deriveDeliveryUnsafeCounters` and `planDeliveryDocumentationDemo` are
  unaffected.
- **`DELIVERY_ATOMIC_OWNED_SOURCE[id] = { owned_fact, mutate }`** — 30 entries.
  Each `owned_fact` names one raw field; the 30 names are **pairwise distinct**
  (asserted in the test). Each `mutate` changes exactly that one field of a
  cloned projection and throws (`ISOLATION_TARGET_ABSENT:*`) if the target is
  absent, so no `mutate` can silently no-op.
- **`probeDeliveryAtomicSourceFactIsolation(id, input, audit?)`** — freezes the
  30 canonical owned projections and their real observations; deep-clones
  `facts[id]`; calls `DELIVERY_ATOMIC_OWNED_SOURCE[id].mutate` on the clone;
  recomputes the REAL observer for **all 30** atomics from
  `{ …canonical, [id]: mutatedClone }`; diffs against the frozen canonical
  observations. Returns a structured result including
  `changed_source_paths` (a real deep-JSON diff of the fact before/after),
  `governing_changed`, `cross_assertion_changes`, `observation_recomputed`,
  `original_input_unchanged`, `original_facts_unchanged`, and the derived
  `mutated_raw_projection_field` / `mutated_expected_observation` /
  `mutated_correct_flag` / `mutated_decision` flags.

**Why this clears the S13N bar in S13N's own terms.** S13N's
`mutateAgentEvalSourceFact` flips an already-derived `result` string and bypasses
all predicate logic; the aggregator then re-runs. S13Q now mutates a raw field
*upstream* of the predicate and re-runs the real predicate on it. That is
strictly stronger than the accepted sibling.

### Ownership is field-level, not whole-slice-disjoint (stated honestly)

- Ownership is **field-level**: 30 pairwise-distinct mutated fields, each atomic
  recomputed from its own detached deep clone.
- Projections **overlap in content** where predicates read the same derived
  section: `executive_summary` is carried by A02/A03/A04/A05/A06/A17;
  `architecture_summary` by A07/A08/A09; `setup_and_run` by A10/A11/A12/A26;
  `demo_script` by A13/A14/A15; `limitations` by A16/A17/A18; `next_steps` by
  A19/A20/A21; `provenance` by A01/A24. This overlap is expected and harmless.
- **A25, A27, A29 carry a whole-decision projection slice** — their predicates
  are whole-graph scans (`containsForbiddenSensitiveMaterial(decision)`,
  `collectStrings(decision)`, `JSON.stringify(decision)`); **A28 carries the
  whole input** — its predicate rebuilds via `buildDeliveryPackage(input)`.
  These are inherent to those predicates, not oversights.
- **Cross-assertion non-change is guaranteed by construction**: the probe
  recomputes all 30 from `{ …canonical, [id]: mutated }` and every `j ≠ id`
  reads its own untouched clone, so `cross_assertion_changes` is empty for all
  30 (measured, not assumed).
- **Residual**: `mutated_decision` is *derived* as `!insideProjection` rather
  than measured against a real decision object. The load-bearing guarantees that
  nothing real was mutated are `original_input_unchanged` and
  `original_facts_unchanged`, both computed by `JSON.stringify` byte comparison
  before/after every probe.

### Anti-tautology regression (mechanical, not narrative)

- **`isValidSourceFactIsolationEvidence(r)`** returns `true` **only** when every
  entry of `r.changed_source_paths` is strictly inside `projection.*` (never
  `expected_observation`, `correct`, `actual_observation`, `field_family`,
  `evidence`), the observation was recomputed from it, the governing assertion
  moved, and `cross_assertion_changes` is empty.
- **`legacyMutationEvidence(input, id)`** runs the rejected
  `mutateDeliverySourceFact` path and computes its `changed_source_paths` with
  the *same* deep-diff the real probe uses. The diff lands on
  `expected_observation` — outside `projection` — so
  `isValidSourceFactIsolationEvidence` returns **`false`** for A01, A14 and A29.
  The new probe returns **`true`** for the same atomics.
- `mutateDeliverySourceFact` is retained and exported **only** so this
  regression can prove it invalid; its doc comment says so.
- **Wrong-field negative control**: mutating a projection field the predicate
  does *not* read (`A01.projection.input.delivery_identity.project_ref`,
  `A13.projection.decision.package.demo_script[0].title`) leaves the governing
  observation byte-identical — the 30/30 result is a measurement, not an
  assertion that cannot fail.

### Fresh QA numbers (Node `v24.19.0`, npm `11.17.0`)

| gate | result |
|---|---|
| `tsc --noEmit` | PASS (0 errors) |
| focused `tests/delivery-documentation-demo/` | **82/82** (was 79 at `cf49b45`; +3 isolation tests) |
| canonical positives `P01..P10` | 10/10 |
| canonical negatives `N01..N40` | 40/40 (each triggers its named blocker) |
| owned-source-fact isolation `A01..A30` | **30/30** — one raw field mutated, real observer recomputed, exactly the governing assertion moves, 0 cross-assertion changes, input + canonical facts byte-stable |
| 30 owned fields pairwise-distinct | PASS |
| anti-tautology regression (`isValidSourceFactIsolationEvidence`) | PASS — legacy `expected_observation` path REJECTED, new probe ACCEPTED |
| wrong-field negative control | PASS |
| per-feature ablation | 7/7 |
| hard invariants `S13Q-HI-001..030` | 30/30 |
| unsafe counters `UC01..UC12` | 12/12 zero on positives and Skill-arm; each independently fireable |
| actual-candidate gate / real S12→S10→S09 path | PASS |
| A/B baseline total correct | **126** (held, not recomputed) |
| A/B Skill total correct | **360** (held) |
| A/B delta | **+234** (held) |
| A/B qualified dimensions | **8** (`D01..D08`, threshold ≥ 7) (held) |
| A/B atomic regressions | 0 |
| A/B contributions table | unchanged: `D01..D08 = {9,9,9}`, `D09 = {A25:0,A26:9,A27:0}`, `D10 = {A28:0,A29:9,A30:0}` |
| A/B per-scenario flips | unchanged: `[0,0,0,26,26,26,26,26,26,26,26,26]` |
| A/B baseline gate-valid scenarios | 3 (the minimal scenarios) |
| A/B max single-assertion share per qualified dim | 9/27 = 0.333 (≤ 0.50) |
| full suite before clean build | **1322/1322** across 24 files |
| genuine `rm -rf dist` (absent) → `tsc -p tsconfig.json` | clean — **786** files (`262 .js` + `262 .d.ts` + 262 maps) |
| full suite after build | **1322/1322** across 24 files — equal pre/post |
| `git diff --check` on `quality.ts` + S13Q test | clean |
| boundary / dependency / protected-surface audit | `package.json` / `package-lock.json` unchanged; no `node:fs`/`node:net`/`node:http`/`child_process`/`fetch(`/`process.env`/`Date.now()`/`new Date()`/`Math.random` in the module; Core, AgentDefinition, `selectSkillForTask`, S09/S10/S12 and every stage's Part A untouched |
| allowed-path audit (`git diff --stat` vs `cf49b45`) | only `src/intelligence/delivery-documentation-demo/quality.ts`, `tests/delivery-documentation-demo/deliveryDocumentationDemo.test.ts`, this report, and the new handoff file |
| canonical Part A blobs at HEAD | skill `1198834124dc32c34721130566efdc5fda78465f`, quality `5f931e5372ff0319eee6e86fe0a1879c0300153f`, spec `6d7078633c1d0a90e8204a277de6100ed517a112` — all three match |
| Part A semantic gap found | none |

Pre-existing working-tree noise on arrival (NOT this repair's scope): six
`M brain-bootstrap/**` S13N/S13O `.yaml`/`.md` files and eight `??` root
`*.md`/`.yaml` files were already dirty/untracked before this session and are
left untouched and unstaged.

### Still required

A DIFFERENT fresh non-authoring, non-fork, read-only verifier must reproduce the
above against the exact new candidate SHA recorded in the issue #1 `CODEX_HANDOFF`
comment and the complete integrated S13Q DEEP Quality Contract. `HI-052` is not
awarded by this builder; `steps.S13Q` remains `NOT_STARTED`; S13R remains
`NOT_STARTED`.

---

## Source-fact isolation repair #3 (shared raw source, 2026-09-01)

Third bounded repair of the atomic-isolation mechanism. Control-plane
rejection #2 (`5500744002`) required replacing the per-atomic derived-decision
projection isolation with **one shared detached RAW source model upstream of
`buildDeliveryPackage`**, mutating one real input/evidence/audit field, rerunning
the real producer + gate, and recomputing all 30 observations from that one
rebuilt decision. Scope: `quality.ts` and the S13Q test file only. Canonical
Part A untouched; no waiver/dependency map invented.

### Rejected mechanisms (both retained only as anti-tautology regressions)

| candidate | mechanism | why rejected |
|---|---|---|
| `cf49b45` | `mutateDeliverySourceFact` overwrites the already-derived `expected_observation` cell | proves comparison-cell independence, not source-fact ownership |
| `1782a16` | per-atomic detached **derived-decision** projections (`buildDeliveryAtomicProjection`); `DELIVERY_ATOMIC_OWNED_SOURCE.mutate` edits `package.*` / `coverage.*` / `blockers` / `warnings` of that clone | mutates a **producer output**, not an underlying `DeliveryDocumentationDemoInput` / evidence fact; cross-assertion non-change is guaranteed by per-atomic clone separation, not demonstrated by rerunning the real producer |

Both are reconstructed as probe-shaped records by
`legacyExpectedObservationMutationEvidence` and
`legacyDerivedDecisionMutationEvidence`; `isValidSourceFactIsolationEvidence`
returns **`false`** for both and `classifyDeliveryAtomicIsolation` returns
**`FAIL`** for both (diff paths carry `expected_observation` /
`decision.*` segments — outside `input.` / `audit.`). A real STRICT probe
returns `true`. `mutateDeliverySourceFact` is retained and exported **only** for
regression (a).

### The accepted mechanism (shared raw `{ input, audit }` source model)

- **`observeAtomic(id, input, decision, audit)`** — the ONE real predicate. The
  30 `case` bodies are unchanged; the projection indirection layer
  (`buildDeliveryAtomicProjection`, `observeAtomicFromSourceFact`) is **deleted**.
  Output byte-identical to `1782a16` — verified by a 840-line snapshot of all 30
  observations across `baseInput`, `minimalInput` and the 12 A/B scenarios, for
  both the canonical decision and a `package: null` decision (`diff` empty). So
  `buildDeliveryPackage`, `evaluateDeliveryCandidateGate`,
  `deriveDeliverySourceFacts`, `evaluateDeliveryAtomicObservations` (the A/B
  scorer), `deriveDeliveryUnsafeCounters` and `planDeliveryDocumentationDemo` are
  unaffected — confirmed by the frozen A/B table passing **unchanged**.
- **`DeliveryAtomicRawSource = { input: DeliveryDocumentationDemoInput; audit: DeliveryEvaluationAudit }`**
  and **`deliveryAtomicRawSource(input, audit?) = structuredClone({ input, audit })`** —
  the single shared detached raw model. It carries **no**
  `DeliveryDocumentationDemoResult` / `package` / `coverage` / `blockers` /
  `warnings`.
- **`DELIVERY_ATOMIC_OWNED_SOURCE[id] = { owned_fact, source_family, mutate }`** —
  30 entries. Each `owned_fact` names one real `DeliveryDocumentationDemoInput`
  field (`delivery_identity`, `repository_facts`, `verification_evidence`,
  `architecture_facts`, `demo_surface`, `limitations`, `next_step_candidates`,
  `policy`) or explicit detached `audit` evidence; the 30 names are **pairwise
  distinct** and none contains a `decision` / `package` / `coverage` / `blockers`
  / `warnings` / `expected_observation` / `correct` segment (asserted). Each
  `mutate(src)` changes exactly one real field of the cloned raw source and
  throws `ISOLATION_TARGET_ABSENT:<path>` if the target is absent.
- **`probeDeliveryAtomicSourceFactIsolation(id, input, audit?)`** — freezes
  `origSrc = deliveryAtomicRawSource(...)`, `origDecision = buildDeliveryPackage(origSrc.input)`,
  and `origObs[k] = observeAtomic(k, origSrc.input, origDecision, origSrc.audit)`
  for all 30. Then `mut = structuredClone(origSrc)`,
  `DELIVERY_ATOMIC_OWNED_SOURCE[id].mutate(mut)`,
  `mutDecision = buildDeliveryPackage(mut.input)`,
  `mutObs[k] = observeAtomic(k, mut.input, mutDecision, mut.audit)` for all 30.
  Returns `governing_changed`, `changed`, `cross`,
  `mutated_field_paths = jsonDiffPaths(origSrc, mut)`, `producer_reran`
  (JSON inequality of the two canonical decisions), `original_source_unchanged`,
  `original_decision_unchanged`, `blocked`.
- **`classifyDeliveryAtomicIsolation(probe)`** → `STRICT` | `STRUCTURAL_DEPENDENCY`
  | `GATE_CLASS` | `FAIL`. `FAIL` if the shared raw source or frozen canonical
  decision was disturbed, or any diff path is outside `input.` / `audit.` or
  touches a derived segment, or (`producer_reran` is false and `source_family`
  is not `audit`). Then `GATE_CLASS` for A25 (forced `BLOCKED`) / A27 (governing
  never moves + forced `BLOCKED`); `STRICT` if the governing observation moved
  with zero cross; `STRUCTURAL_DEPENDENCY` if the governing observation moved and
  `cross ⊆ DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES[id].also_changes`.

### The 19 / 9 / 2 split (empirically measured, not assumed)

Running the real mechanism against `baseInput()`:

- **19 / 30 STRICT** — governing observation moves, **zero** cross-assertion
  change: `A02 A03 A07 A08 A10 A11 A12 A14 A15 A17 A18 A19 A20 A21 A22 A24 A28 A29 A30`.
- **9 / 30 STRUCTURAL_DEPENDENCY** — governing observation moves; the canonical
  `buildDeliveryPackage` necessarily co-moves a small declared sibling set
  (`DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES`, each with a verbatim `forcing`
  string traceable to a `deliveryModel.ts` line). Measured `cross` ⊆ declared
  `also_changes` for every one:

  | id | owned source mutation | measured cross | forcing (deliveryModel.ts) |
  |---|---|---|---|
  | A01 | `delivery_identity.revision_ref` | `[A24]` | `buildProvenance` :505 threads `revision_ref` into `pkg.provenance.revision_ref` which A24 reads |
  | A04 | `verification_evidence[ev-test-parser].subject_ref` | `[A03]` | `buildClaims`/`deriveClaimStatus` :360-383 — A03 observes the whole `delivered` [subject,status] table; `claims_total`/`claims_with_evidence` are claim-status functions |
  | A05 | `repository_facts[rf-feat-reporter].subject_ref` | `[A03]` | same shared claim table; A05's UNKNOWN-count / AVAILABLE_NOT_VERIFIED-subjects are claim-status functions |
  | A06 | `repository_facts[rf-feat-builder].source_ref` | `[A03]` | same shared claim table; A06's DEFERRED-subjects is a claim-status function |
  | A09 | remove all `architecture_facts[kind=BOUNDARY]` | `[A08]` | `architecture_summary.partial = components.length===0 || boundaries.length===0` :396; A08 observes boundaries. Declared `also_changes` is the **superset** `[A07,A08]` — under this BOUNDARY-only mutation A07 (components) provably does not move, but the forcing expression reads `components` too, so a components mutation of the same fact family would move A07; the declaration is deliberately conservative and `cross ⊆ also_changes` still holds |
  | A13 | `demo_surface.steps` last removed | `[A14,A15]` | `buildDemo` :422-450 — A13's `demo_script.length` element needs a step add/remove, which moves the per-step tuples A14/A15 observe |
  | A16 | `policy.suppress_limitation_ids = ["lim-crlf"]` | `[A18]` | `buildLimitations` :452-466 — A16 and A18 both `.map` the same `pkg.limitations` array and read `limitation_id` |
  | A23 | append `ev-probe-fail` FAIL (subject `repo`) | `[A22]` | `detectEvidenceConflicts` :513-527 — inducing a same-subject PASS+FAIL conflict requires growing the evidence set A22's evidence-index observation reads |
  | A26 | add `SAFE_ENV` fact + `rf-cmd-build.value` uses `${PROBE_VAR}` | `[A12]` | A26 reads env-var tokens inside `pkg.setup_and_run` command text that A12 also observes; :285 `INVENTED_ENV_VARIABLE` |

- **2 / 30 GATE_CLASS** — package-level safety-gate invariants no source
  mutation can move in isolation:
  - **A25** — `repository_facts[rf-cmd-build].value = "TOKEN=sk-deadbeefdeadbeef01 npm run build"`.
    `validateDeliveryInput` short-circuits on `SECRET_MATERIAL` (:147, :194) →
    `package: null`. A25's blocker-count element exists only on a blocked
    package. Verified by `N33` / `N34` / `N35` + `UC06`.
  - **A27** — `repository_facts[rf-feat-builder].value = "this module is production-ready"`
    (byte-identical to the `overclaim` fixture in `S13Q-HI-022`, test line ~690).
    `validateDeliveryInput` catches raw-log/raw-env (:148-149) and overclaim
    (:254) before the material reaches `collectStrings(decision)`. Measured
    `governing_changed === false` and `blocked === true`. Verified by `N07` /
    `N35` / `N36` + `UC05` / `UC06`.

`FAIL = 0` across all 30.

### Anti-tautology regressions (both mechanical)

- `isValidSourceFactIsolationEvidence(legacyExpectedObservationMutationEvidence(baseInput(), id))` → **`false`** for A01/A14/A29; `classify` → `FAIL`.
- `isValidSourceFactIsolationEvidence(legacyDerivedDecisionMutationEvidence(baseInput(), id))` → **`false`** for A01/A14/A29; `classify` → `FAIL`.
- `isValidSourceFactIsolationEvidence(probeDeliveryAtomicSourceFactIsolation(id, baseInput()))` → **`true`** for real STRICT probes A02/A14/A29.

### Fresh QA numbers (Node `v24.19.0`, npm `11.17.0`) — all recomputed

| gate | result |
|---|---|
| `tsc --noEmit` | PASS (0 errors) |
| focused `tests/delivery-documentation-demo/` | **81/81** (was 82/82 at `1782a16`: the rewrite deleted two sub-tests that read the now-removed projection layer — `pins the fixture cells that index-addressed owned fields depend on` and `wrong-field negative control` — and added one — `partitions the 30 atomics into 19/9/2`; net −1) |
| canonical positives `P01..P10` | 10/10 |
| canonical negatives `N01..N40` | 40/40 |
| owned-source-fact isolation `A01..A30` | **30/30** — `classify` never `FAIL`; 19 STRICT / 9 STRUCTURAL_DEPENDENCY / 2 GATE_CLASS; every diff path under `input.` / `audit.`; shared raw source + canonical decision byte-stable |
| 30 owned fields pairwise-distinct, no derived segment | PASS |
| anti-tautology — `expected_observation` mutation | REJECTED (`isValid` false, `classify` FAIL) |
| anti-tautology — derived `decision.*` mutation | REJECTED (`isValid` false, `classify` FAIL) |
| `observeAtomic` byte-identity vs `1782a16` | PASS — 840-line snapshot `diff` empty |
| per-feature ablation | 7/7 |
| hard invariants `S13Q-HI-001..030` | 30/30 |
| unsafe counters `UC01..UC12` | 12/12 zero on positives and Skill-arm; each independently fireable |
| actual-candidate gate / real S12→S10→S09 path | PASS |
| **A/B baseline total correct** | **126** (fresh recomputation) |
| **A/B Skill total correct** | **360** (fresh) |
| **A/B delta** | **+234** (fresh) |
| **A/B qualified dimensions** | **8** (`D01..D08`; threshold ≥ 7) |
| A/B per-dimension contributions | `D01..D08 = {9,9,9}` each; `D09 = {A25:0, A26:9, A27:0}`; `D10 = {A28:0, A29:9, A30:0}` |
| A/B atomic regressions | **0** |
| A/B per-scenario flips | `[0,0,0,26,26,26,26,26,26,26,26,26]` |
| A/B baseline gate-valid scenarios | **3** (the minimal scenarios) |
| A/B max single-assertion share per qualified dim | 9/27 = 0.333 (≤ 0.50); global 9/234 ≈ 0.038 |
| A/B Skill-arm unsafe counters | 12/12 zero |
| full suite before clean build | **1321/1321** across 24 files (was 1322/1322 at `1782a16` — same net −1 from the two removed / one added isolation sub-tests) |
| genuine `rm -rf dist` (absent) → `tsc -p tsconfig.json` | clean — **786** files (`262 .js` + 262 `.d.ts` + 262 maps) |
| full suite after build | **1321/1321** across 24 files — equal pre/post |
| `git diff --check` on `quality.ts` + S13Q test | clean |
| allowed-path audit (`git diff --stat` vs `cf49b45`) | only `quality.ts`, the S13Q test, this report, and the handoff file(s) |
| canonical Part A blobs at HEAD | skill `1198834124dc32c34721130566efdc5fda78465f`, quality `5f931e5372ff0319eee6e86fe0a1879c0300153f`, spec `6d7078633c1d0a90e8204a277de6100ed517a112` — all three match |

The frozen A/B table in the test was recomputed and matches the prior values
(`126 / 360 / +234 / 8 dims / flips [0,0,0,26×9]`); no frozen expectation
required updating.

### Part A §21 ruling requested

Strict single-source isolation holds for **19 / 30** atomics. **9 / 30** carry a
producer-forced structural dependency: Part A §21 defines multiple atomics over
one `pkg` array (claims / limitations / demo steps / evidence) or the revision
spine, so one honest source mutation necessarily co-moves the declared sibling
set. **2 / 30** (A25, A27) are package-level safety-gate invariants that no
source mutation can move in isolation because `validateDeliveryInput`
fail-closes before the material reaches the producer. The QC
`source_fact_isolation.rule` says "governing assertion **FAMILY**" (undefined —
the QC has only dimensions + atomics) while the Skill says "single-observation
isolation". Control-plane ruling requested: (a) declare these 9 + 2 dependencies
in semantic contract §21 (the QC rule already anticipates "unless the semantic
contract explicitly declares a dependency"), OR (b) re-decompose the coupled
observations to be source-disjoint, OR (c) define "family" as the 3-assertion
`semantic_dimension`. One sub-question for the ruling: A09's declared
`also_changes` `[A07,A08]` is a deliberate **superset** of its measured cross
`[A08]` (the forcing expression at `deliveryModel.ts:396` reads both `components`
and `boundaries`); the control plane should also state whether declared
dependencies must be tight to the measured cross or may be conservative over the
forcing expression's inputs.

### Still required

A DIFFERENT fresh non-authoring, non-fork, read-only verifier must reproduce the
above against the exact new candidate SHA recorded in the issue #1
`CODEX_HANDOFF` comment (`INDEPENDENT_VERIFICATION_REQUIRED`) and the complete
integrated S13Q DEEP Quality Contract. `HI-052` is not awarded by this builder;
`steps.S13Q` remains `NOT_STARTED`; S13R remains `NOT_STARTED`.

---

## Isolation erratum reconciliation (2026-09-01)

> **Supersedes** the "Part A §21 ruling requested" and every isolation count in
> the "Source-fact isolation repair (2026-09-01)" section above. Everything else
> in this report (positives, negatives, ablation, hard invariants, unsafe
> counters, A/B) is unchanged and re-verified below.

Canonical Part A is now four artifacts. `brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_1.md`
(blob `fc63516c898aca6a888781bceeca4a3e377932aa`) is normative and defines the
exact acceptance model: every `A01..A30` is classified `STRICT` |
`STRUCTURAL_DEPENDENCY` | `GATE_CLASS` | `FAIL`, from ONE shared raw
`{ input, audit }` model, ONE semantically governing fact mutated per probe
(erratum §4/§6), the real `validateDeliveryInput`/`buildDeliveryPackage` rerun,
and all 30 observations recomputed via the untouched `observeAtomic`.

The prior candidate `5b084ae` (transferred to the branch at `36c2a5e`) is **not**
verifier-authorized. This section reconciles Part B to the erratum and produces a
new candidate SHA for **committed-source control-plane review** (not independent
verification yet).

### What changed in `quality.ts`

- `DELIVERY_ATOMIC_OWNED_SOURCE` rebuilt: each entry now carries a
  `governing_reason` (§4) and a declared `governing_paths` list; every mutation
  targets the semantic property the atomic names. The pre-erratum invalid choices
  were replaced: **A03** (was an unrelated `rf-nonfeat-deploy.subject_ref` rename)
  → `rf-feat-builder.confidence` exercising `deriveClaimStatus`; **A09** (was
  BOUNDARY-fact removal) → `af-model.is_proposed_decision`; **A13** (was
  `demo_surface.steps.pop()`) → `demo_surface.exists=false`; **A26** (was a
  two-fact add+edit, erratum §6 FAIL) → one `rf-cmd-build.value` undeclared
  `$ENV`; **A27** (was an overclaim, A24/HI-022 territory) → one `lim-crlf.impact`
  raw stack trace; **A25** re-verified to a single bearer-token field; **A19/A20**
  re-chosen from `priority`/keyword-injection to the actual `status` label.
- `classifyDeliveryAtomicIsolation` enforces §5 exactly: `STRUCTURAL_DEPENDENCY`
  requires `cross` **set-equal** to the declared `also_changes` (not subset);
  `GATE_CLASS` requires `blocked && package===null && blockers.includes(blocker)`;
  a non-gate-class atomic that fail-closes is `FAIL`; `>1` mutated fact record is
  `FAIL` (§8.4); measured paths not conforming to the declared `governing_paths`
  is `FAIL` (§8.3).
- `DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES` rewritten with the EXACT measured
  cross set per atomic (the old `A09 [A07,A08]` conservative superset is gone —
  A09 is no longer structural). `DELIVERY_ATOMIC_GATE_CLASS` now records
  `{ blocker, unsafe_counter, negative_fixture, forcing }` per member.
- New `DELIVERY_ATOMIC_UNRESOLVED` map holds **A09** with its full reason string —
  the gap is reported, not hidden.
- New `legacyIrrelevantMoverEvidence` (§8.3 regression — the old A03 tuple-mover,
  rejected via `paths_conform=false`) and `legacyTwoFactEvidence` (§8.4 regression
  — the old A26 two-fact probe, rejected via `mutated_fact_records.length===2`).
- `observeAtomic` (quality.ts lines 135-258) was **not touched** — byte-identical
  to `1782a16` / `5b084ae`, so `deriveDeliverySourceFacts` and the 12-scenario
  A/B gate are unaffected.

### Final classification

> **Amended by Erratum 2 (see "Erratum 2 reconciliation — UC13 / A09 gate-class"
> at the end of this report).** The counts below are the Erratum-1 snapshot;
> Erratum 2 moves A09 `FAIL → GATE_CLASS` and the final gate is
> **15 STRICT / 7 STRUCTURAL_DEPENDENCY / 8 GATE_CLASS / 0 FAIL**.

`strict_count = 15`, `structural_dependency_count = 7`, `gate_class_count = 7`,
`fail_count = 1` *(Erratum-1 snapshot; Erratum 2 → `gate_class_count = 8`,
`fail_count = 0`)*.

- **STRICT (15):** A02, A07, A08, A10, A11, A14, A15, A17, A18, A19, A22, A24, A28, A29, A30
- **STRUCTURAL_DEPENDENCY (7):** A01→[A24], A03→[A05], A05→[A03,A24], A06→[A03], A16→[A18], A20→[A19], A23→[A22]
- **GATE_CLASS (8, Erratum 2):** A04, **A09**, A12, A13, A21, A25, A26, A27
- **FAIL (0, Erratum 2):** — *(A09 was the only Erratum-1 FAIL; resolved by Erratum 2 §3/§4)*

### Erratum §7 dependency/gate-class map (30 rows)

| Axx | class | owned governing source fact | semantic reason it governs the atomic | fresh producer/gate rerun evidence | measured changed set | STRUCT declared dep set + forcing / GATE blocker+counter+fixture+no-leak |
|-----|-------|-----------------------------|----------------------------------------|------------------------------------|----------------------|-------------------------------------------------------------------------|
| A01 | STRUCTURAL_DEPENDENCY | `delivery_identity.revision_ref` | A01 observes `[pkg.identity.revision_ref, pkg.provenance.revision_ref, input…revision_ref]` — the delivered revision spine | rerun, not blocked | `{A01, A24}` | dep `[A24]`; `buildProvenance` (deliveryModel.ts:505) threads `delivery_identity.revision_ref` into `pkg.provenance.revision_ref` which A24 reads; nothing else reads the spine |
| A02 | STRICT | `delivery_identity.audience` | A02 = scope_and_audience_preservation; audience is the named property | rerun, not blocked | `{A02}` | — |
| A03 | STRUCTURAL_DEPENDENCY | `repository_facts[rf-feat-builder].confidence` | `deriveClaimStatus` maps confidence ACCEPTED→IMPLEMENTED vs REPORTED→AVAILABLE_NOT_VERIFIED (deliveryModel.ts:371-372) — the claim-state derivation A03 names | rerun, not blocked | `{A03, A05}` | dep `[A05]`; A03 and A05 both read `executive_summary.delivered.claim_status`; `claims_with_evidence` unchanged (both statuses ⇒ `evidence_refs:[]`) so A04 stays; `repository_fact:REPORTED` already in `source_kinds` (rf-feat-reporter) so A24 stays |
| A04 | GATE_CLASS | `verification_evidence[ev-test-parser].status` | A04 = material_evidence_binding; ev-test-parser is the PASS binding for the one VERIFIED claim | rerun → **BLOCKED** `UNSUPPORTED_VERIFIED_CLAIM`; `package === null` | fail-closed (25-obs collapse) | blocker `UNSUPPORTED_VERIFIED_CLAIM` (deliveryModel.ts:233); counter `UC01` independently fireable; fixture `N06`; no leak (`package === null`) |
| A05 | STRUCTURAL_DEPENDENCY | `repository_facts[rf-feat-reporter].confidence` | rf-feat-reporter is the only REPORTED fact — its confidence drives the AVAILABLE_NOT_VERIFIED derivation (deliveryModel.ts:372) A05 names | rerun, not blocked | `{A03, A05, A24}` | dep `[A03, A24]`; REPORTED→ACCEPTED (a) moves its `claim_status` in the shared table → A03, (b) deletes `repository_fact:REPORTED` from the deduped `provenance.source_kinds` set (buildProvenance:499-503) → A24. Minimality proof: A03's own probe *adds* a REPORTED that already exists, so its `source_kinds` set is unchanged and A24 stays put — same field, opposite direction, different measured set |
| A06 | STRUCTURAL_DEPENDENCY | `repository_facts[rf-feat-builder].source_ref` | a roadmap/backlog/plan `source_ref` routes `deriveClaimStatus` to DEFERRED (deliveryModel.ts:368-369) — the roadmap-vs-implementation distinction A06 names | rerun, not blocked | `{A03, A06}` | dep `[A03]`; A06 and A03 both read the shared claim table; `confidence` untouched so `source_kinds`/A24 do not move |
| A07 | STRICT | `architecture_facts[af-model].source_ref` | A07 observes `components.map([subject_ref, source_ref])` — the fact each component derives from | rerun, not blocked | `{A07}` | — |
| A08 | STRICT | `architecture_facts[af-bound-core].value` | af-bound-core is a BOUNDARY fact whose value IS a preserved boundary line (buildArchitecture:393) | rerun, not blocked | `{A08}` | — |
| A09 | **GATE_CLASS** *(Erratum 2 §3/§7)* | `architecture_facts[af-model].is_proposed_decision` (one existing fact record, one field) | tests `no_new_architecture_decision_in_summary`: `is_proposed_decision === true` is the exact governing raw-source condition (deliveryModel.ts:258-259) | real path rerun: **YES** (`validateDeliveryInput` → `buildDeliveryPackage`) → **BLOCKED** `NEW_ARCHITECTURE_DECISION`; `package === null`; source facts mutated in probe: **1** | fail-closed | blocker `NEW_ARCHITECTURE_DECISION` (deliveryModel.ts:258-267); unsafe counter `UC13_new_architecture_decision_introduced` — counter fireable: **YES**; canonical negative fixture `N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER`; package: **null**; no-leak: **PASS** (no `architecture_summary`, `comp:model` absent from the decision) |
| A10 | STRICT | `verification_evidence[ev-build].subject_ref` | A10 = steps_evidence_backed; ev-build is the PASS evidence bound to the required build step (buildSetup:405-407) | rerun, not blocked | `{A10}` | — |
| A11 | STRICT | `repository_facts[rf-cmd-build].precondition_refs` | A11 observes non-optional steps `[step_id, expected_signal>0, precondition_refs]` (buildSetup:413) | rerun, not blocked | `{A11}` | — |
| A12 | GATE_CLASS | `repository_facts[rf-cmd-test].value` | an undeclared `:port` token in a command value is the governing prohibited condition for no_invented_token | rerun → **BLOCKED** `INVENTED_PORT`; `package === null` | fail-closed | blocker `INVENTED_PORT` (deliveryModel.ts:287-290); counter `UC02` fireable; fixture `N13`; no leak |
| A13 | GATE_CLASS | `demo_surface.exists` | `exists=false` is the exact governing condition for demo_surface_exists | rerun → **BLOCKED** `DEMO_SURFACE_DOES_NOT_EXIST`; `package === null` | fail-closed | blocker `DEMO_SURFACE_DOES_NOT_EXIST` (deliveryModel.ts:308); counter `UC03` fireable; fixture `N17`; no leak |
| A14 | STRICT | `demo_surface.steps[ds-happy].action_ref` | A14 observes per-step `[step_id, action>0, result>0, evidence_refs]` (buildDemo:443) | rerun, not blocked | `{A14}` | — |
| A15 | STRICT | `demo_surface.steps[ds-happy].fallback_ref` | A15 observes per-step `[step_id, fallback>0]` + coverage (buildDemo:446) | rerun, not blocked | `{A15}` | — |
| A16 | STRUCTURAL_DEPENDENCY | `policy.suppress_limitation_ids` | the mechanism that removes a limitation from the register (buildLimitations:453-455) | rerun, not blocked | `{A16, A18}` | dep `[A18]`; A16 and A18 both `.map` `pkg.limitations`; lim-crlf is LOW/KNOWN so `MATERIAL_LIMITATION_HIDDEN` does not fire and A17 (UNVERIFIED\|DEFERRED only) is unaffected |
| A17 | STRICT | `limitations[lim-stdin].status` | A17 = unverified_unknown_explicit; status is the named property | rerun, not blocked | `{A17}` | — |
| A18 | STRICT | `limitations[lim-crlf].severity` | A18 observes per-limitation `[id, severity, impact>0, source_refs]` | rerun, not blocked | `{A18}` | — |
| A19 | STRICT | `next_step_candidates[ns-fixtures].status` | A19 = status_labeled; status is the label (buildNextSteps:474). ns-fixtures is not S13R/deploy-matching so A20 is unaffected | rerun, not blocked | `{A19}` | — |
| A20 | STRUCTURAL_DEPENDENCY | `next_step_candidates[ns-deploy].status` | ns-deploy IS the S13R deployment next step; its status label is exactly the boundary property A20 names | rerun, not blocked | `{A19, A20}` | dep `[A19]`; A19 observes every next-step status, A20 the S13R-filtered subset; a non-S13R relabel (A19's own probe) moves only A19 ⇒ `[A19]` is exact-and-minimal for the ns-deploy mutation |
| A21 | GATE_CLASS | `architecture_facts[af-quality].value` (S14 marker) | an architecture fact carrying S14 capability/MCP work is the governing prohibited condition for s14_s15_boundary | rerun → **BLOCKED** `S14_CAPABILITY_PULLED_FORWARD`; `package === null` | fail-closed | blocker `S14_CAPABILITY_PULLED_FORWARD` (deliveryModel.ts:349); counter `UC09` fireable (independently, via demo-runtime marker); fixture `N28`; no leak |
| A22 | STRICT | `verification_evidence[ev-typecheck].evidence_id` | the evidence_id is what `buildEvidenceIndex` resolves, deduplicates and orders (deliveryModel.ts:492-494) | rerun, not blocked | `{A22}` | — |
| A23 | STRUCTURAL_DEPENDENCY | append `verification_evidence` `ev-probe-fail` FAIL for subject `repo` | a same-subject PASS+FAIL pair is exactly the conflict `detectEvidenceConflicts` records (deliveryModel.ts:521-524) | rerun, not blocked | `{A22, A23}` | dep `[A22]`; the conflict requires appending one evidence record, which `buildEvidenceIndex` then lists ⇒ A22's evidence-id list moves; `evidence_refs_total` is A23's own tuple element |
| A24 | STRICT | `delivery_identity.baseline_revision_ref` | a named `provenance` completeness field (buildProvenance:506) | rerun, not blocked | `{A24}` | — |
| A25 | GATE_CLASS | `demo_surface.steps[ds-failure].action_ref` (bearer token) | a secret value in a raw-source field is the governing prohibited condition for no_secret_or_raw_sensitive_material | rerun → **BLOCKED** `SECRET_MATERIAL`; `package === null` | fail-closed | blocker `SECRET_MATERIAL` (deliveryModel.ts:147,194); counter `UC06` fireable; fixture `N34`; no leak — `SECRET_MATERIAL`'s detail is generic, the secret value appears nowhere in the decision |
| A26 | GATE_CLASS | `repository_facts[rf-cmd-build].value` (undeclared `$ENV`) | an undeclared `$ENV` name in a command value is the governing prohibited condition for secret_variable_names_only_when_approved | rerun → **BLOCKED** `INVENTED_ENV_VARIABLE`; `package === null` | fail-closed | blocker `INVENTED_ENV_VARIABLE` (deliveryModel.ts:284); counter `UC02` fireable; fixture `N12`; no leak into an accepted artifact (`package === null`) — the variable NAME appears only in the fail-closed rejection reason `blockers[].detail`, contrast A25 where the VALUE is never echoed |
| A27 | GATE_CLASS | `limitations[lim-crlf].impact` (raw stack trace) | a raw stack trace in a raw-source field is the governing prohibited condition for no_raw_log_prompt_tool_or_private_payload | rerun → **BLOCKED** `RAW_LOG_MATERIAL`; `package === null`; **observation unchanged** (`governing_changed=false`, permitted by erratum §5.3 final paragraph) | fail-closed | blocker `RAW_LOG_MATERIAL` (deliveryModel.ts:148,194); counter `UC06` fireable; fixture `N36`; no leak — never reaches `collectStrings(decision)` |
| A28 | STRICT | `audit.input_snapshot_after` | A28 = output_and_ordering; the input-stability audit fact is the named property | audit-family (no producer rerun required; determinism observation) | `{A28}` | — |
| A29 | STRICT | `audit.candidate_gate_valid` | A29 = actual_candidate_and_no_self_certification; candidate_gate_valid is the named property | audit-family | `{A29}` | — |
| A30 | STRICT | `audit.core_or_contract_changed` | A30 = core_agentdef_dependencies_prior_contracts; core_or_contract_changed is the named property | audit-family | `{A30}` | — |

### Erratum §8 anti-tautology — all four mechanically rejected

| # | fake-isolation mechanism | probe | rejected via | `classify` |
|---|--------------------------|-------|--------------|-----------|
| §8.1 | direct `expected_observation` overwrite (cf49b45) | `legacyExpectedObservationMutationEvidence` | diff path carries `expected_observation` ⇒ `pathsAreRawSourceOnly` false | `FAIL` |
| §8.2 | direct derived `decision.*` overwrite (1782a16) | `legacyDerivedDecisionMutationEvidence` | diff paths carry `decision.` segments | `FAIL` |
| §8.3 | semantically irrelevant tuple-mover (pre-erratum A03) | `legacyIrrelevantMoverEvidence` | ONE raw-source fact, but measured path `input.repository_facts.4.subject_ref` does not conform to A03's declared `governing_paths` ⇒ `paths_conform=false` | `FAIL` |
| §8.4 | two independent source facts in one probe (pre-erratum A26) | `legacyTwoFactEvidence` | both raw-source `input.` fields, but land on two distinct fact records ⇒ `mutated_fact_records.length===2` | `FAIL` |

Positive paths (erratum §8 final paragraph): `A02` STRICT accepted, `A01`/`A16`
STRUCTURAL_DEPENDENCY accepted, `A25`/`A27` GATE_CLASS accepted.

### Fresh A/B (erratum §12 — recomputed from scratch)

`S12 → S10 → S09 → actual parsed candidate → deterministic actual-candidate gate
→ post-gate decision → deterministic evaluator`, 12 scenarios × 30 atomics × 2 arms.

| metric | fresh value |
|--------|-------------|
| baseline total correct | **126** |
| Skill total correct | **360** |
| delta | **+234** |
| per-assertion contributions | `D01..D08` = `{9,9,9}` each; `D09` = `{A25:0, A26:9, A27:0}`; `D10` = `{A28:0, A29:9, A30:0}` |
| qualified dimensions | **8** (`D01..D08`; threshold ≥ 7) |
| distinct improved assertion ids per qualified dim | 3 (≥ 2) |
| regressions | **0** |
| max single-assertion share — per qualified dim | 9/27 = **0.333** (≤ 0.50) |
| max single-assertion share — global | 9/234 ≈ **0.038** |
| per-scenario flips | `[0, 0, 0, 26, 26, 26, 26, 26, 26, 26, 26, 26]` |
| gate-valid baseline scenarios | **3** (the minimal scenarios) |
| Skill-arm unsafe counters (aggregate `UC01..UC12`) | **0 / 0** |

The frozen A/B table in the test was recomputed and **reproduced the prior
values exactly** — `observeAtomic` was not touched, so no frozen expectation
required updating (erratum §12: reported as freshly reproduced, not carried
forward).

### DEEP QA (Node 24.19.0 / npm 11.17.0)

| gate | result |
|------|--------|
| `npm run typecheck` | clean |
| focused `npx vitest run tests/delivery-documentation-demo` | **82/82** |
| full `npm test` (pre-build) | **1322/1322** across 24 files |
| `rm -rf dist` (confirmed absent) → `npm run build` | clean — **786** emitted files (262 `.js` + 262 `.d.ts` + 262 `.js.map`) |
| full `npm test` (post-build) | **1322/1322** — equal pre/post |
| `git diff --check` on `quality.ts` + S13Q test | clean |
| allowed-path audit (`git diff --stat cf49b45..HEAD`) | only `S13Q_ISOLATION_ERRATUM_1.md`, `quality.ts`, the S13Q test, this report, and handoff files |
| canonical Part A blobs at HEAD | skill `1198834124dc32c34721130566efdc5fda78465f`, quality-contract `5f931e5372ff0319eee6e86fe0a1879c0300153f`, semantic-contract `6d7078633c1d0a90e8204a277de6100ed517a112`, erratum `fc63516c898aca6a888781bceeca4a3e377932aa` — all four match |
| independent review (advisor) before declaring done | performed; A05 `[A03,A24]` confirmed exact-and-minimal, A26 no-leak predicate tightened to `package===null`, classifier ordering + pairwise-distinct `governing_paths` added |

### Remaining semantic gap — A09 (reported, not resolved)

> **SUPERSEDED BY ERRATUM 2.** `S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md`
> (blob `9f7ff097d8d5e7d216fec63f949fa80af1a01de8`) adds unsafe counter
> `UC13_new_architecture_decision_introduced` and rules `A09 = GATE_CLASS`. The
> paragraph below is kept as the Erratum-1-era analysis; the gap is now closed —
> see "Erratum 2 reconciliation — UC13 / A09 gate-class" at the end of this report.

`A09 no_new_architecture_decision_in_summary` has **no valid class** under the
erratum. Its only governing raw-source condition (`is_proposed_decision` /
`ARCHITECTURE_DECISION_MARKER`) is fail-closed to `NEW_ARCHITECTURE_DECISION` →
`BLOCKED`, which rules out STRICT and STRUCTURAL_DEPENDENCY (package-null collapse
moves ~25 observations). GATE_CLASS requires (erratum §5.3 req 4) a
corresponding independently-fireable unsafe counter, and **none of `UC01..UC12`
covers the architecture-decision condition** — the closest, `UC09`, is
future-stage pull-forward (S14/S15/demo-runtime/next-step-completed). Erratum §4
forbids the only non-blocking move (mutating an unrelated boundary to shift
`architecture_summary.partial`). This is a missing unsafe counter in canonical
Part A, reported per erratum §6 / §14 for control-plane ruling. It is recorded in
`DELIVERY_ATOMIC_UNRESOLVED.A09`; `classifyDeliveryAtomicIsolation` returns
`FAIL` for it and the S13Q test asserts that FAIL and that A09 is **not** present
in `DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES` or `DELIVERY_ATOMIC_GATE_CLASS`.

### Control-plane action required

Review the committed 30-row dependency/gate-class map above and:

1. **Accept or reject** the 7 `STRUCTURAL_DEPENDENCY` closures (erratum §5.2 —
   each measured cross set is exact; `A05 [A03,A24]` is the widest).
2. **Accept or reject** the 7 `GATE_CLASS` classifications (erratum §5.3 — each
   backed by blocker + independently-fireable counter + named negative fixture +
   `package === null` no-leak proof).
3. ~~**Rule on A09**~~ — **DONE via Erratum 2**: a `NEW_ARCHITECTURE_DECISION`
   unsafe counter (`UC13`) was added to canonical Part A and A09 is ruled
   `GATE_CLASS`. Reconciled below.
4. **Authorize or withhold** a fresh independent verifier for the new candidate
   SHA recorded in the issue #1 `CODEX_HANDOFF` comment.

`HI-052` is **not** awarded by this builder. `steps.S13Q` remains `NOT_STARTED`.
S13R remains `NOT_STARTED`.

---

## Erratum 2 reconciliation — UC13 / A09 gate-class (2026-09-02)

> Reconciles Part B to `brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md`
> (`S13Q-ERRATUM-002`, blob `9f7ff097d8d5e7d216fec63f949fa80af1a01de8`), now
> canonical Part A artifact #5. Everything in the "Isolation erratum
> reconciliation" section above is unchanged **except** A09's classification and
> the unsafe-counter inventory (12 → 13). All prior evidence is retained.

### Control-plane ruling applied

Issue #1 comment `5502649124` — `PART_A_AMENDMENT_2_AUTHORING_READY` /
`BUILDER_RECONCILIATION_REQUIRED`. The 30-row map reviewed at `8dc62bf` is
accepted (STRICT 15 / STRUCTURAL_DEPENDENCY 7 / GATE_CLASS 7); Erratum 2 resolves
the only gap (A09) by adding `UC13` and ruling `A09 = GATE_CLASS`. Final target
**STRICT 15 / STRUCTURAL_DEPENDENCY 7 / GATE_CLASS 8 / FAIL 0 / TOTAL 30** —
reproduced fresh below.

### What changed

- **`quality.ts`**
  - `DeliveryUnsafeCounters` + `deriveDeliveryUnsafeCounters` gain exactly
    `UC13_new_architecture_decision_introduced` =
    `Number((decision.blockers ?? []).some(b => b.code === "NEW_ARCHITECTURE_DECISION"))`
    — the governing violation as surfaced by the real
    `validateDeliveryInput`/`buildDeliveryPackage` path onto `decision.blockers`
    (`blockedResult`, deliveryModel.ts:106-107 / 258-267). Not a constant, not a
    fixture/scenario branch, not an expected-map lookup, not a manual mutation.
    UC01..UC12 meanings unchanged.
  - `DELIVERY_ATOMIC_GATE_CLASS.A09 = { blocker: "NEW_ARCHITECTURE_DECISION",
    unsafe_counter: "UC13_new_architecture_decision_introduced", negative_fixture:
    "N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER", forcing: … }`.
    (`is_proposed_decision` alone, with no db/agent keyword in `af-model.value`,
    classifies as a new **provider** decision — the N08 governing class.)
  - `DELIVERY_ATOMIC_OWNED_SOURCE.A09.governing_reason` rewritten to state the
    Erratum-2 GATE_CLASS ruling (was the Erratum-1 "no counter ⇒ not gate-class"
    analysis).
  - `DELIVERY_ATOMIC_UNRESOLVED` is now `{}` (A09 removed; the map/export is
    retained for any future gap).
  - `classifyDeliveryAtomicIsolation` **unchanged** — the `gc` branch already
    catches A09 before `if (p.blocked) return "FAIL"` once A09 is in the gate map;
    it still enforces Erratum 1 §5 (STRUCTURAL_DEPENDENCY: measured cross
    set-EQUAL to declared; GATE_CLASS: blocker + `package===null` + declared
    blocker present) and the §8 anti-tautology rejections (4/4 still FAIL).
- **`tests/delivery-documentation-demo/deliveryDocumentationDemo.test.ts`**
  - `ISO_GATE` → 8 (adds `A09`), `ISO_FAIL` → `[]`; partition + count assertions
    → `{ STRICT: 15, STRUCTURAL_DEPENDENCY: 7, GATE_CLASS: 8, FAIL: 0 }`.
  - `ISO_GATE_COUNTER_DRIVER.A09` drives `UC13` from a real
    `buildDeliveryPackage` of `af-model.is_proposed_decision = true`.
  - Every `12 / UC01..UC12 / 12/12 / Array(12).fill(0)` for the **complete**
    unsafe inventory → `13 / UC01..UC13 / 13/13 / Array(13).fill(0)` (Skill-arm
    A/B aggregate and the two unsafe-counter suites).
  - New test **"A09 GATE_CLASS: one architecture governing fact fail-closes to
    NEW_ARCHITECTURE_DECISION with UC13 fireable and no leak"**: mutates exactly
    one architecture fact (`af-model.is_proposed_decision = true`), reruns the
    real path, asserts source facts mutated = 1, `NEW_ARCHITECTURE_DECISION`
    fires (validation and canonical decision), `UC13 > 0`, `package === null`,
    no-leak (`architecture_summary` and `comp:model` absent from the decision),
    probe classifies `GATE_CLASS`, and `UC13 === 0` on all 10 positive fixtures
    and all 12 Skill-arm A/B candidates.
  - `erratum2` file existence + `UC13…` + `A09 = GATE_CLASS` string checks added.
- **Part A**: the 5 canonical blobs are unchanged at HEAD (skill
  `1198834124dc32c34721130566efdc5fda78465f`, quality-contract
  `5f931e5372ff0319eee6e86fe0a1879c0300153f`, semantic-contract
  `6d7078633c1d0a90e8204a277de6100ed517a112`, erratum1
  `fc63516c898aca6a888781bceeca4a3e377932aa`, erratum2
  `9f7ff097d8d5e7d216fec63f949fa80af1a01de8`).

### A09 evidence row (Erratum 2 §8)

`A09 | GATE_CLASS | architecture_facts[af-model].is_proposed_decision (one fact
record, one field) | tests no_new_architecture_decision_in_summary | real path
rerun: YES | blocker: NEW_ARCHITECTURE_DECISION | unsafe counter:
UC13_new_architecture_decision_introduced | counter fireable: YES | canonical
negative fixture: N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER | package: null
| no-leak: PASS | source facts mutated: 1`.

### Final isolation gate (Erratum 2 §8/§9) — re-run fresh

All `A01..A30` through the committed test path: **30/30 classified valid —
15 STRICT / 7 STRUCTURAL_DEPENDENCY / 8 GATE_CLASS / 0 FAIL**. No
previously-accepted row changed after adding `UC13` (the 15 STRICT, 7
STRUCTURAL_DEPENDENCY with their exact measured cross sets, and the 7 prior
GATE_CLASS rows are all still reproduced). Anti-tautology 4/4 still reject;
STRICT / STRUCTURAL_DEPENDENCY / GATE_CLASS positive acceptance checks still pass.

### Complete unsafe inventory `UC01..UC13`

- zero on all 10 positive fixtures (aggregate `Array(13).fill(0)`);
- zero on all 12 Skill-arm A/B candidates (aggregate `Array(13).fill(0)`);
- each independently fireable — **13/13** (UC01..UC12 unchanged drivers;
  UC13 driven by a real `NEW_ARCHITECTURE_DECISION` violation).

### Fresh A/B (Erratum 2 §11 / Erratum 1 §12 — recomputed from scratch)

`S12 → S10 → S09 → actual parsed candidate → deterministic actual-candidate gate
→ post-gate decision → deterministic evaluator`, 12 scenarios × 30 atomics × 2 arms.

| metric | fresh value |
|--------|-------------|
| baseline total correct | **126** |
| Skill total correct | **360** |
| delta | **+234** |
| per-assertion contributions | `D01..D08` = `{9,9,9}` each; `D09` = `{A25:0, A26:9, A27:0}`; `D10` = `{A28:0, A29:9, A30:0}` |
| qualified dimensions | **8** (`D01..D08`; threshold ≥ 7) |
| distinct improved assertion ids per qualified dim | 3 (≥ 2) |
| regressions | **0** |
| max single-assertion share — per qualified dim | 9/27 = **0.333** (≤ 0.50) |
| max single-assertion share — global | 9/234 ≈ **0.038** |
| per-scenario flips | `[0, 0, 0, 26, 26, 26, 26, 26, 26, 26, 26, 26]` |
| gate-valid baseline scenarios | **3** (the minimal scenarios) |
| Skill-arm unsafe counters (aggregate `UC01..UC13`) | **0 / 0** (13 counters) |

`observeAtomic` output is byte-identical (snapshot test still green), so the A/B
table is unaffected by the UC13 addition: the numbers above **reproduce the prior
table exactly** and are reported as freshly reproduced, not carried forward
(Erratum 1 §12). The only A/B assertion that changed is the Skill-arm unsafe
aggregate, updated `12 → 13` counters (still all zero).

### DEEP QA (Node 24.19.0 / npm 11.17.0) — fresh totals

| gate | result |
|------|--------|
| `npm run typecheck` | clean |
| focused `npx vitest run tests/delivery-documentation-demo` | **83/83** (was 82; +1 the new A09/UC13 test) |
| P01..P10 positives | **10/10** |
| N01..N40 negatives | **40/40** |
| isolation `A01..A30` | **30/30** — 15 STRICT / 7 STRUCTURAL_DEPENDENCY / 8 GATE_CLASS / 0 FAIL |
| `S13Q-HI-001..030` hard invariants | **30/30** |
| unsafe counters `UC01..UC13` | zero where required; **13/13** independently fireable |
| anti-tautology | **4/4** rejected |
| per-feature ablation | **7/7** |
| full `npm test` (pre-build) | **1323/1323** across 24 files |
| `rm -rf dist` (confirmed absent) → `npm run build` | clean — **786** emitted files (262 `.js` + 262 `.d.ts` + 262 `.js.map`) |
| full `npm test` (post-build) | **1323/1323** — equal pre/post |
| `git diff --check` on `quality.ts` + S13Q test | clean |
| dependency audit (`package.json` / `package-lock.json` vs `cf49b45`) | unchanged |
| Core audit (`src/core/**`) | untouched |
| AgentDefinition audit | untouched |
| 5-blob Part A integrity at HEAD | all 5 match (see above) |
| allowed-path audit (`git diff --stat cf49b45..HEAD`) | only the 2 erratum files, `quality.ts`, the S13Q test, this report, and handoff files |
| independent review (advisor) before declaring done | performed — UC13 derivation (read the blocker off the decision) confirmed as the only derivation that satisfies "`UC13 > 0` and `package === null` from the same real-path rerun"; no containment loop enumerates `UC01..UC12` against the frozen QC blob, so adding UC13 needs no QC edit |

`HI-052` is **NOT** awarded. `steps.S13Q` remains `NOT_STARTED`. S13R remains
`NOT_STARTED`. Fresh independent verification remains forbidden until ChatGPT
committed-source review accepts the exact new SHA.

---

## Addendum — accepted fresh independent verification + factual closure (2026-09-02)

*Appended at factual closure. The builder narrative above is unchanged; earlier
rejected isolation approaches (`1782a16`, `41f723f`, `5b084ae`, the two erratum
reconciliation steps) remain part of the audit trail and were superseded, not
verified.*

### Committed-source review + verification authorization

- ChatGPT committed-source review accepted the exact candidate SHA in GitHub
  Issue #1 comment `5503071799` (`SOURCE_REVIEW_ACCEPTED /
  FRESH_INDEPENDENT_VERIFICATION_AUTHORIZED`).

### Fresh independent verifier — PASS

- GitHub Issue #1 comment `5503283730`, `step: S13Q`, `status: PASS`.
- Verifier identity: fresh session, non-authoring, non-fork, read-only, not the
  builder's advisor, did not repair the candidate; performed **no** repository
  writes (verification ran in a detached `git worktree` at the exact SHA).
- Exact target immutable end-to-end: candidate stayed
  `a70933a41826c25c1ebda87f897750a6f0d7818e`, `main` stayed
  `cf49b45519c45b6ce3e930b813df97f6e983c151`.
- Independently reproduced, from scratch: all five Part A blobs exact;
  `P01..P10` 10/10; `N01..N40` 40/40; isolation 30/30 =
  15 STRICT / 7 STRUCTURAL_DEPENDENCY / 8 GATE_CLASS / 0 FAIL with exact measured
  cross-sets; A09 manual one-fact proof
  (`architecture_facts[af-model].is_proposed_decision` → real
  `validateDeliveryInput`/`buildDeliveryPackage` → `NEW_ARCHITECTURE_DECISION` →
  `UC13 = 1` → `package === null` → `N08` → no leak); `UC01..UC13` zero where
  required and 13/13 independently fireable; anti-tautology 4/4 rejected;
  `S13Q-HI-001..030` 30/30; ablation 7/7; actual
  `S12 → S10 → S09 → parsed actual candidate → actual-candidate gate → post-gate
  evaluator` path with no faithful substitute; fresh A/B with a from-scratch
  scoring loop converging on baseline **126** / Skill **360** / **+234** /
  8 qualified dimensions / 0 regressions / concentration ≈ **0.0385** / Skill-arm
  unsafe aggregate all zero; Node 24.19.0 typecheck PASS, focused **83/83**, full
  **1323/1323** across 24 files pre-build, genuine dist-absent clean build **786**
  emitted files, full **1323/1323** post-build; `git diff --check` clean; Core /
  AgentDefinition / dependencies / prior contracts / `STATE.yaml` / `CURRENT.md` /
  S13R untouched.
- Environment note (accepted, non-blocking): default shell exposed Node 22.23.1
  and plain `npm ci` could not run better-sqlite3's native install script; the
  verifier explicitly activated Node 24 and used lock-faithful
  `npm ci --ignore-scripts`; the real memory-provider DB suite and every
  canonical executable QA/build gate passed. The S13Q quality contract does not
  require a successful dependency-install script as a pass criterion.

### ChatGPT control-plane acceptance + HI-052

- GitHub Issue #1 comment `5503286781`:
  `decision: VERIFIED_PASS_ACCEPTED / HI-052_AWARDED / FACTUAL_CLOSURE_AUTHORIZED`.
- **`HI-052` is `AWARDED`** by the control plane — canonical DEC-08 satisfied
  (fresh non-authoring, non-fork, read-only verifier independently reproduced the
  required evidence; the control plane factually accepts the result).

### Factual closure

- `main` fast-forwarded `cf49b45..a70933a` via `git merge --ff-only` — no squash,
  rebase, amend, cherry-pick, conflict resolution, force or candidate
  modification. `main` HEAD equalled `a70933a…` before the closure commit.
- Post-fast-forward re-check: five Part A blobs exact at HEAD; typecheck PASS;
  focused **83/83** — no implementation change made to pass checks.
- One bounded docs-only closure commit created on top of `a70933a…`, touching
  only `brain-bootstrap/STATE.yaml`, `brain/context/CURRENT.md`, this addendum,
  and the new closure handoff
  `brain/context/handoffs/20260902T021901Z-s13q-verified-pass-closure.md`.
- `STATE.yaml`: `current_step: S13Q`, `status: PASS`, `steps.S13Q: PASS`,
  `steps.S13R: NOT_STARTED`; `repository.head_sha` reconciled from the stale
  `76e8ce9…` to the verified implementation target `a70933a…` (the direct parent
  of the closure commit, per the established continuity convention).
- **`steps.S13Q` is now `PASS`. `steps.S13R` remains `NOT_STARTED`** and was not
  started, inspected or authored by this closure. Only a fresh S13R factual
  preflight + ChatGPT Authoring Gate is now eligible.
