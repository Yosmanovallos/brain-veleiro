# S13P Observability for AI Systems — Builder Verification

Status: `PART B IMPLEMENTED / INDEPENDENT VERIFICATION REQUIRED`

Documentation HEAD before Part B: `9ca9affad062e04f989eed02067b0f68da81ef31`

Canonical Part A integration: byte-identical, integrated before Part B, hashes recorded below.

## Outcome

S13P Part B implements a pure, deterministic, provider-neutral and privacy-safe
per-run observability bundle builder in Intelligence, reachable through the real
S12 → S10 → S09 path. No Core, AgentDefinition, dependency, provider binding,
durable store, exporter, network handle or prior canonical Part A was changed.
All builder-side deterministic gates pass. HI-051 remains a candidate and is not
awarded; S13P is not marked PASS. A fresh non-authoring, non-fork, read-only
verifier must independently reproduce the evidence before closure.

## Canonical Part A integrity

Working-tree bytes equal the transferred canonical bytes (SHA-256 and Git blob):

| Artifact | Bytes | SHA-256 | Git blob |
|---|---:|---|---|
| `brain-bootstrap/skills/OBSERVABILITY_AI_SYSTEMS_SKILL_S13P.md` | 16121 | `846cd7b75d08bf868604ce93c50649a26aeebb0f21b6a9528b23cd38e8851881` | `50684adb18f96a2251c1e9c21f348f7dffc0480a` |
| `brain-bootstrap/quality-contracts/S13P_OBSERVABILITY_AI_SYSTEMS_DEEP.yaml` | 20411 | `3d09627a7f4f3ae0f3ef879e96485ac6d03e0ee994d18cb06a367ab143696789` | `6a363fe90b6a0fbc58560976321706e6531271e1` |
| `brain-bootstrap/specs/OBSERVABILITY_AI_SYSTEMS_CONTRACT_S13P.md` | 32348 | `fc6f598f9a91e10c773d17cf4fd62540eaebff9ad252480c9b588e7a30e1419e` | `6e1bc829a46bdf6f1b39fb8ce8a42b010e781091` |

No Part A file was edited by Part B. The three untracked transfer sources at the
repository root are unchanged.

## Implementation

New module `src/intelligence/observability-ai-systems/` (pure Intelligence, no
new dependency):

- `constants.ts` — `S13P_LIMITS` verbatim from the semantic contract §7, safe-ref
  / normalized-code / cost / currency / digest / timestamp grammars, per-kind
  key allowlists, never-drop kind set.
- `types.ts` — the §8 canonical shapes.
- `validateObservabilityPolicy.ts` — §7/§9: overrides must be stricter than or
  equal to the ceilings; retention above a class ceiling is downgraded, not
  accepted.
- `validateSafeObservation.ts` — exact per-kind schema, unknown-key rejection
  (never echoing the key), recursive prohibited-content scan, run/trace binding,
  digest/fingerprint gating.
- `buildTraceIndex.ts` — §12: unique ids/sequences, acyclic span graph, explicit
  missing parents, phase pairs, single start/terminal, terminal-last.
- `applyDeterministicSampling.ts` — §9 SHA-256 over
  `s13p.policy.v1\n<seed>\n<runId>\n<observationId>`, first eight digest bytes as
  an unsigned big-endian integer, retain when `value mod 10_000 < basisPoints`;
  effective-priority recompute so caller priority cannot make required evidence
  sampleable.
- `aggregateObservedUsage.ts` — §15: token coverage (never coerced), exact
  decimal cost in integer micro-units (BigInt, no binary float), per-currency
  grouping with source precedence and a separate invoice reconciliation group,
  latency by kind with a rational average, normalized error counts with
  retryability-conflict diagnostics.
- `buildObservabilityBundle.ts` — the §19 public seam: §11 validation order, §18
  status decision table, cardinality / currency / serialized-byte bounds with
  count-only dropped summaries, a deeply frozen result. Pure: no wall clock,
  randomness, environment, IO, input mutation; never awards PASS or HI-051.
- `quality.ts` — 32 atomic observers over the 10 declared dimensions, frozen
  source facts, single-assertion isolation, 16 unsafe counters, and a candidate
  gate that recomputes the canonical bundle and rejects any divergent candidate.
- `planObservability.ts` — S12 discovery + exact lazy Skill load → S10 compile →
  S09 run → candidate gate.
- `observabilityAiSystemsSkill.ts` — the append-only `SkillDefinition` (18 MUST
  rules) registered as the 19th `referenceSkillCatalogEntries` entry.

Registry: one append-only entry in `src/intelligence/skills/index.ts`. Two
adjacent prior-stage boundary tests updated mechanically (catalog length
`18 → 19`; the now-present `observability-ai-systems` directory token removed
from their forbidden-directory regexes), exactly as the S13O implementation
updated the equivalent `async-reliability` markers.

## Builder-side gates (all PASS)

- Node 22.23.1 / npm 10.9.8 `tsc --noEmit`: PASS.
- Focused S13P: 88/88.
  - Canonical positive fixtures: 14/14 (`P01_MINIMAL_COMPLETE_RUN` … `P14_AUDIT_REF_ONLY_NO_PERSISTENCE`), each asserted individually.
  - Exact negative inventory: 52/52 (`N01` … `N52`), each named and asserted individually; every case shows a governing diagnostic or gate/counter fire, not a default/coercion pass.
  - Atomic single-assertion isolation: 32/32 — mutating one owned frozen expected observation flips exactly its own `correct` result and no other.
  - A/B impact gate — 12 frozen scenarios (`AB01` … `AB12`), 32 atomic assertions per arm (max 384/arm), same materialized path, same visible packet object identity; baseline arm has no Skill, candidate arm loads the real S13P Skill; both score the post-gate decision. Result: baseline 214, candidate 384, delta +170; 9 of 10 dimensions qualified (threshold ≥7); 0 assertion/scenario regressions; largest single-assertion share of positive delta ≈ 0.053; the baseline candidate is gated to REJECTED on 9 of 12 scenarios while the Skill candidate is byte-identical to the recomputed canonical bundle on all 12; all 16 unsafe counters zero; 32/32 isolation re-checked.
  - Hard invariants `S13P-HI-001` … `S13P-HI-024`: 24/24 recomputed outside the candidate.
  - 16 unsafe counters: zero across every positive fixture, and each counter separately shown able to fire on a real violation.
  - Actual S12 → S10 → S09 path with the real candidate: PASS.
  - Anti-gaming: the A/B provider carries no scenario label, run-mode label, precomputed answer, grader truth, or import of the builder / gate / quality module; irrelevant prose produces no correctness change while the real method prose does.
- Full suite before clean build: 1240/1240.
- Genuine `rm -rf dist` clean `tsc -p tsconfig.json` build: PASS — 756 files under `dist/` (252 `.js`; the project `tsconfig.json` compiles `tests/**` as well as `src/**`).
- Full suite after build: 1240/1240.
- Architecture / dependency / boundary audit: `package.json` and `package-lock.json` unchanged; no provider SDK, store, exporter, network, queue, `Date.now`, `new Date()` or unseeded randomness in the module; Core and prior canonical Part A untouched.
- `git diff --check` on the builder's tracked edits: clean. The only tracked modifications are `src/intelligence/skills/index.ts` and the two adjacent boundary tests; the six S13N/S13O files show WSL LF/CRLF noise only (`git diff --ignore-space-at-eol` is empty) and predate this step.

## Not done (requires a separate authorized step)

- No fresh independent non-authoring verification.
- HI-051 not awarded.
- `STATE.yaml` / `CURRENT.md` not moved to PASS/closed.
- No S13Q or later step started.
