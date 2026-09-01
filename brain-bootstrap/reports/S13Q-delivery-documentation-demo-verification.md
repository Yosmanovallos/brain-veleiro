# S13Q Delivery Documentation & Demo — Builder Verification

Status: `BUILDER PASS / INDEPENDENT VERIFICATION REQUIRED`

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
