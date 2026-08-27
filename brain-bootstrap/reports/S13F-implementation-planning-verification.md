# S13F — Implementation Planning — Verification Report

**Step:** S13F — `implementation-planning` (SPEC_CONTRACT.md Stage 10 `PLAN`)
**Quality depth:** `DEEP` (`brain-bootstrap/quality-contracts/S13F_IMPLEMENTATION_PLANNING_DEEP.yaml`)
**Part A author:** ChatGPT (integrated verbatim)
**Part B builder / verifier:** Claude Code
**Baseline before this step:** typecheck 0 errors, `385/385` tests
**Baseline after this step:** typecheck 0 errors, `452/452` tests (`385` unchanged + `67` new), clean build PASS, post-build `452/452` unchanged

---

## 1. Repository reality (verified this session)

| Item | Value |
|---|---|
| branch | `main` |
| HEAD at session start | `31bc4f9f39784028e35ab43759ca112a35bf4a9b` (== `origin/main`) |
| working tree at start | clean except the two untracked transfer files |
| Node actually used | `v24.19.0` at `/home/yosman/.nvm/versions/node/v24.19.0/bin/node`, after prepending that path for the shell. Default `which node` still resolves to a shadowing Node 22 at `/home/yosman/.local/bin/node` — a local dev-env issue, not a repo concern (handoff assumption A-016, still live). |

## 2. Part A integrity

The three Part A artifacts were integrated verbatim at their canonical paths and re-verified **byte-identical** to the approved transfer copy (`S13F_CHATGPT_PART_A_CANONICAL.md`) this session:

| Artifact | Path | Transfer lines |
|---|---|---|
| Skill | `brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md` | 284–789 |
| Quality Contract | `brain-bootstrap/quality-contracts/S13F_IMPLEMENTATION_PLANNING_DEEP.yaml` | 805–1118 |
| Execution spec | `brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md` | 1134–1816 |

`SEMANTIC_CHANGES_TO_PART_A: NONE`. At integration time `diff` of each file against the extracted transfer-copy line range (`S13F_CHATGPT_PART_A_CANONICAL.md` lines 284–789 / 805–1118 / 1134–1816) was empty; this was re-verified twice this session (once before Part B, once before close). The transfer copy is **not retained** in the repo, mirroring every prior S13x closure (its content lives in these three canonical files, this report, `STATE.yaml`, and the handoff). Test `SKILL-ARTIFACT-1` now asserts the three canonical files exist, are non-trivial, and carry their canonical headers/vocabulary. The standalone Quality Contract YAML and the Skill's embedded YAML blocks parse (`js-yaml`): QC `depth=DEEP`, `rationale.risk=HIGH`, `hard_invariants=18`, `semantic_dimensions=8`, `fixtures.minimum_positive=3`, `fixtures.minimum_negative=5`.

## 3. Implementation inventory (Part B)

New Intelligence-layer module `src/intelligence/implementation-planning/`:

| File | Responsibility |
|---|---|
| `constants.ts` | Skill id / QC ref / artifact paths / parseable markers |
| `types.ts` | `ImplementationPlanningInput` + full plan model (spec section 2) + counted-assertion comparison types + test-only `ImplementationPlanningFixtureTruth` |
| `sharedDerivations.ts` | `classifyMaterialRef`, `bounded{Spec,Architecture,AgentDecision}Refs`, `classifyPlanStatus` (ordered approval predicates, spec 3.2), `computePendingBlockedTaskIds` (transitive pending-approval propagation, spec 4.8) — shared verbatim between the synthesizer and the validator (the D-050 pattern) |
| `analyzeDependencies.ts` | static DAG analysis: missing/self/duplicate edges, direct + indirect cycle (with cycle path), priority-direction (`P0!->P1/P2`, `P1!->P2`), milestone ordering, deterministic Kahn topological order |
| `computePlanCoverage.ts` | input-derived coverage counts (denominators from `input.spec` only; spec section 5 / HI-018) |
| `renderImplementationPlanMarkdown.ts` | byte-stable Markdown projection of the structured plan (spec section 6) |
| `validatePlanningInput.ts` | structural bounded-input validation (spec 3.1); approval state is NOT a throw (it is a BLOCKED/PROVISIONAL result) |
| `validateImplementationPlan.ts` | deterministic HI-001..HI-018 validator; recomputes `status`, `coverage`, `compilation_readiness`, `topological_order`, `plan_markdown` from the bounded input and rejects any mismatch; `findStage11ForbiddenKeys` deep key scan (HI-015); `mapImplementationPlanResultToStructuredOutput` |
| `planImplementation.ts` | `planImplementation(input, harness)` / `planImplementationBaseline(...)` — S12 discovery + lazy load → materialize a task instance of the **caller-supplied** base definition → `compileAgentDefinition()` → `runAgent()` → parse. `../agent-definitions/` is not imported. |
| `compareImplementationPlanningRuns.ts` | 25 discrete boolean assertions across the 8 `SD-00x` dimensions, scored per arm against frozen `ImplementationPlanningFixtureTruth`; aggregates the QC thresholds (`+4` correct total, `>=2` improved dimensions, `>=2` per improved dimension, `100%` hard invariants, `0` boundary violations) |
| `index.ts` | module public surface |

New Skill definition + registration:

| File | Change |
|---|---|
| `src/intelligence/skills/definitions/implementationPlanningS13F.ts` | ADDED — typed `SkillDefinition` (`24` rules `IP-R#`, `19` procedure steps `IP-P1..IP-P19`, `12` verification checks `IP-V#`), `requires.skills=[]`, `requires.capabilities=[]`, synthesis-only permissions |
| `src/intelligence/skills/index.ts` | MODIFIED — registers `implementationPlanningS13F` as the 9th reference Skill entry (identical mechanical wiring to every prior S13x) |

New tests:

| File | Change |
|---|---|
| `tests/implementation-planning/fixtures.ts` | ADDED — minimal valid `SoftwareArchitectureDecisionResult` / `AgentEngineeringResult`, the caller harness `skillExecutionHostDefinition` (in `tests/`, generic role, not a registered planning agent), 3 positive + 3 negative canonical inputs, genuine input-derived `synthesizeSkillPlan`, naive `synthesizeBaselinePlan`, deterministic reference `ModelProvider`. Does NOT import `fixtureTruth.ts`. |
| `tests/implementation-planning/fixtureTruth.ts` | ADDED — hand-authored frozen ground truth for the 3 positive fixtures; the single place expected answers live; only consumer is the comparator |
| `tests/implementation-planning/implementationPlanning.test.ts` | ADDED — `SKILL-ARTIFACT-1..4` + `T1..T34` + helper regression anchors (`67` `it()` cases, incl. the review-driven invented-blocker regression) |
| `tests/agent-engineering/agentEngineering.test.ts` | MODIFIED — one mechanical prior-test count relaxation: `toBe(8)` → `toBeGreaterThanOrEqual(8)` because S13F registered the 9th reference Skill. Mirrors the S13D→S13E `toBe(7)` → `toBeGreaterThanOrEqual(7)` relaxation. **Not** an S13E semantic change. |

No file added under `src/intelligence/agent-definitions/`. `src/core/` untouched. No `package.json` / `package-lock.json` change.

## 4. Shared SKILL.md S13x acceptance mapping (`.claude/skills/brain-build-day-bootstrap/SKILL.md` lines 1098–1114)

| # | Requirement | Evidence |
|---|---|---|
| 1 | coding agent inspects repo / authoring request | Done in the S13F authoring preflight (prior session); `CHATGPT_AUTHORING_REQUIRED` was returned |
| 2 | stop at `CHATGPT_AUTHORING_REQUIRED` | Prior session stopped; ChatGPT authored Part A |
| 3 | ChatGPT creates the complete `SKILL.md` + auxiliary content | `S13F_CHATGPT_PART_A_CANONICAL.md` (3 artifacts) |
| 4 | integrate the approved artifact without silent semantic alteration | Byte-identical integration; `SKILL-ARTIFACT-1` |
| 5 | create real examples | `FX_POS_001/002/003` — approved-READY, PENDING-architecture-PROVISIONAL, approved-agent-decision; `T28`, `T29` |
| 6 | at least one negative case | 7 negatives `FX-NEG-001..007` (`T30`); QC minimum is 5 |
| 7 | eval / verification fixture | `tests/implementation-planning/fixtureTruth.ts` + the 25-assertion comparison suite |
| 8 | execute with a real agent | `planImplementation()` runs the Skill through the unchanged S12 discovery/lazy-load → `compileAgentDefinition()` → `runAgent()` path with a caller-supplied `AgentDefinition`; `T26`, `T27`, and every `runSkillPlan()` call assert `run.outcome === "SUCCESS"` and `skillLoaded === true`. The deterministic reference `ModelProvider` genuinely executes inside the generic runtime (it is not a direct unit call to a synthesizer) and is labelled accurately (`T33`). |
| 9 | verify improvement vs no-Skill | `T32`: with-Skill hard invariants `100%` (`33/33`), `0` S13G boundary violations, `+37` correct assertions over the no-Skill baseline (baseline `38/75`, skill `75/75`), `6` improved dimensions (`SD-001/002/003/005/007/008`), each contributing `>= +2`; `meets_threshold === true` |
| 10 | semantic failure → ChatGPT; mechanical failure → local | No semantic defect in Part A was found. Two Part B **mechanical** test defects (wrong catalog-id list; wrong spec-artifact substring) were fixed locally without touching Part A. |
| 11 | record result + evidence | this report |

## 5. Open ambiguity resolutions carried from Part A (recorded, not reopened)

Part A §0 resolved every S13F authoring-preflight ambiguity. Part B added three **determinizations** (recorded here, mirroring S13E D-049/D-051):

| ID | Determinization | Rationale |
|---|---|---|
| D-052 | "materially references a PENDING architecture decision" ⇔ `task.architecture_refs.length > 0`; "materially references a PENDING agent-design decision" ⇔ `task.agent_decision_refs.length > 0` | Spec section 4.8 leaves "materially" unspecified; a non-empty ref list is the only input-derivable reading. Used by the shared `computePendingBlockedTaskIds` so synthesizer and validator cannot drift. |
| D-053 | The reference synthesizer derives `depends_on` as sequential chains **within** each priority tier only; cross-tier sequencing is conveyed by P0/P1/P2 scope, not edges — with one exception, the always-allowed `P2-head → P0-head` edge, added to exercise the "P2 MAY depend on P0" direction | Part A: "Priority is scope semantics, not execution order by itself." Keeps the PROVISIONAL fixture's independent P1 task genuinely independent of the arch-blocked P0 chain (FX-POS-002). |
| D-054 | The S13F Skill markdown ships PROSE-structured rules with no `XX-R#`/`XX-P#`/`XX-V#` ids (unlike S13A–S13E). The typed representation assigns MECHANICAL ids (`IP-R1..24`, `IP-P1..19` matching the markdown's 19 numbered Procedure steps, `IP-V1..12`) while preserving each statement's meaning verbatim-in-substance | Mechanical, not semantic. `SKILL-ARTIFACT-2` asserts every canonical semantic phrase appears in BOTH the typed rules and the markdown. |

## 6. T1–T34 result table (spec section 13) — all PASS

| T | Coverage | Result |
|---|---|---|
| T1 | bounded input validates the approved READY case | PASS |
| T2 | a not-APPROVED Spec blocks (BLOCKED, tasks `[]`) | PASS |
| T3 | a REJECTED architecture blocks | PASS |
| T4 | an APPLICABLE agent-design without a result blocks | PASS |
| T5 | a PENDING architecture ⇒ PROVISIONAL; arch-dependent tasks blocked; independent P1 stays `READY_FOR_S13G`; no activation | PASS |
| T6 | a PENDING agent decision ⇒ PROVISIONAL; agent-dependent tasks blocked | PASS |
| T7 | pending blocker propagates transitively over `depends_on` | PASS |
| T8 | REQUIRED coverage requires a P0 task or an explicit blocker (HI-004); **and** a READY plan cannot excuse a dropped REQUIRED P0 task with an invented blocker string — `result.blockers` is recomputed from the input's approval snapshots (HI-004/013). Proven: the regression fails with the recompute neutralized, passes with it in place. | PASS |
| T9 | P0 must not depend on P1/P2 (HI-005/006) | PASS |
| T10 | P1 must not depend on P2 (HI-005/006) | PASS |
| T11 | missing dependency ref rejects (HI-007) | PASS |
| T12 | self dependency rejects (HI-007) | PASS |
| T13 | direct cycle rejects (HI-007) | PASS |
| T14 | indirect cycle rejects (cycle path length `>= 3`) | PASS |
| T15 | task without acceptance rejects (HI-009) | PASS |
| T16 | task without evidence rejects (HI-010) | PASS |
| T17 | MANUAL_REVIEW without a reason rejects | PASS |
| T18 | unknown material ref rejects (HI-011) | PASS |
| T19 | every task in exactly one milestone; two/zero rejected (HI-008) | PASS |
| T20 | later-milestone dependency rejects (HI-008 `MILESTONE_ORDER`) | PASS |
| T21 | coverage denominators derive from input; wrong self-report rejected (HI-018); honest plan equals recompute | PASS |
| T22 | deterministic topological order, stable across calls, equals the plan's | PASS |
| T23 | deterministic Markdown; equals `plan_markdown`; divergent Markdown rejected (HI-017) | PASS |
| T24 | Stage-11 forbidden field rejects via deep key scan (HI-015); honest plan is clean | PASS |
| T25 | no new planning AgentDefinition: `src/intelligence/agent-definitions/` gains none and does not name the S13F Skill id; the S13F module imports nothing from `../agent-definitions/`; the S13F catalog entry is a Skill | PASS |
| T26 | S12 metadata-only discovery loads no definition; `selectSkillForTask` loads only the S13F loader, once | PASS |
| T27 | both arms run through `compileAgentDefinition()` → `runAgent()`; only materialization differs; no `run*Runtime` / `*Executor` / `WorkflowRuntime` class in `src/` | PASS |
| T28 | canonical READY fixture: correct P0/P1/P2 tiers, acceptance + evidence per task, acyclic, no Stage-11 field, validator-clean | PASS |
| T29 | canonical PROVISIONAL fixture: `>= 2` blocked, `>= 1` ready, every P0 blocked, validator-clean | PASS |
| T30 | canonical negatives FX-NEG-001..007 each fail in the required way | PASS |
| T31 | `fixtures.ts` never imports `fixtureTruth.ts`; no truth token in the materialized objective; `>= 18` assertions across all 8 dimensions; comparator imports no synthesizer | PASS |
| T32 | Skill improvement threshold: `100%` hard invariants, `0` boundary violations, `+37 >= +4` (baseline `38/75`), `6 >= 2` improved dimensions, `>= +2` per improved dimension, `meets_threshold` | PASS |
| T33 | reference provider labelled accurately (deterministic, "no external LLM", no vendor model string); QC `reference_model_policy` documents the accuracy requirement | PASS |
| T34 | S07–S13E AgentDefinitions still valid; catalog exactly the expected 9 ids in order; descriptor projection metadata-only; no vendor token; `materializePlanningTask` does not mutate the base definition and rejects invalid input | PASS |

Plus `SKILL-ARTIFACT-1..4` (Part A byte-identity, typed-Skill validation, DEEP QC structure, execution-spec structure), the review-driven invented-blocker regression (T8), and 2 helper regression anchors. **`67/67` in `tests/implementation-planning/`; `452/452` total.**

## 7. Skill-vs-no-Skill comparison (frozen ground truth, spec section 12)

Suite: the 3 evaluable positive fixtures (`FX_POS_001` READY, `FX_POS_002` PROVISIONAL, `FX_POS_003` approved-agent). `25` assertions × `3` cases = `75` per arm. **Every figure below is measured — asserted exactly by `T32` (`expect(comparison.baseline.correct).toBe(38)` etc.), not hand-tallied.**

| Metric | Baseline (no Skill) | Skill | QC threshold |
|---|---|---|---|
| correct assertions | `38 / 75` | `75 / 75` | — |
| additional correct (skill − baseline) | — | **`+37`** | `>= +4` |
| hard-invariant assertions correct | `17 / 33` | **`33 / 33` (`100%`)** | `100%` |
| S13G boundary violations | `0` | **`0`** | `0` |
| improved dimensions (`>= +2` each) | — | **`SD-001 +6`, `SD-002 +6`, `SD-003 +6`, `SD-005 +6`, `SD-007 +3`, `SD-008 +9`** (`6` dims) | `>= 2` |
| non-improved dimensions | — | `SD-004 +0` (baseline single-task plan is trivially acyclic/priority-clean), `SD-006 +1` (only `A18` on the PROVISIONAL fixture) | — |
| hard-invariant regression | — | `false` | not allowed |
| `meets_threshold` | — | **`true`** | — |

Per-dimension raw scores (baseline → skill): `SD-001 6→12`, `SD-002 3→9`, `SD-003 6→12`, `SD-004 9→9`, `SD-005 3→9`, `SD-006 8→9`, `SD-007 3→6`, `SD-008 0→9`.

The baseline is a genuine under-performer, not a "perfect baseline": it builds one giant P0 task with no acceptance/evidence, leaves constraint/assumption refs unmapped, self-reports rosy coverage that fails the input-derived recompute, hand-writes non-deterministic Markdown, ignores the PENDING architecture, and emits no risk assumptions or stop/de-scope rules. It still runs for real through the identical generic Agent Runtime. It does **not** leak a Stage-11 key, so its boundary-violation count is `0` (the baseline's failure mode is elsewhere); the divergent-Markdown direction of `SD-007` is what it fails (`A22`).

## 8. Anti-self-certification (the S13B/S13D/S13E review precedent)

The model supplies `status`, `blockers`, `coverage`, `compilation_readiness`, `topological_order`, and `plan_markdown`. `validateImplementationPlan()` **recomputes each from the bounded input** and rejects any mismatch:

- `status` ← `classifyPlanStatus(input)` (ordered approval predicates) — `T21`/`T8` families, `A18`
- `blockers` ← `classifyPlanStatus(input).blockers` — must equal exactly (`[]` for READY/PROVISIONAL, the classifier's string for BLOCKED). Closes the review-found hole where a READY plan credited `required_blocked` from an invented blocker string mentioning a dropped REQUIRED ref. `T8` regression, `HI-004/013`.
- `coverage` ← `computePlanCoverage(input, tasks, classifyPlanStatus(input).blockers)` — denominators from `input.spec` only, blockers from the input not the result; `T21` rejects `required_total: 99`; `A17`, `HI-018`
- `compilation_readiness` ← `computePendingBlockedTaskIds(input, tasks)` (transitive) — `T5`/`T7`/`T29`, `A19`, `HI-012`
- `topological_order` ← `analyzeDependencies(tasks).topological_order` — `T22`, `A14`
- `plan_markdown` ← `renderImplementationPlanMarkdown(result)` — `T23` rejects a hand-edited Markdown; `A22`, `HI-017`

The comparator's `A15`/`A17` were also switched to `classifyPlanStatus(input).blockers` so they are true independence checks, not self-consistency checks.

The shared input-derived helpers in `sharedDerivations.ts` / `computePlanCoverage.ts` / `analyzeDependencies.ts` / `renderImplementationPlanMarkdown.ts` take only `(input, tasks)` — never a claimed value — and are imported by BOTH the synthesizer and the validator, so the two cannot drift.

## 9. Limitations / disclosed non-blocking items

1. **`plan_markdown` HI-017 is a same-renderer round-trip for the Skill arm.** The synthesizer produces `plan_markdown` via the same `renderImplementationPlanMarkdown()` the validator re-runs, so the Skill arm passes `A22`/`HI-017` structurally. The real signal is the negative direction: `T23` and the baseline arm both prove a divergent `plan_markdown` is rejected. Same shape as S13E OI-024.
2. **The comparison is a hand-authored maximal contrast**, not emergent measurement (naive baseline vs. a genuine input-derived synthesizer), matching S13A–S13E's own baseline pattern. The frozen `ImplementationPlanningFixtureTruth` is hand-written from the fixture scenarios; the test suite asserts mechanically (`T31`) that it never reaches the runtime path.
3. **`A20` (REJECTED ⇒ BLOCKED, no activation) is vacuously true in the comparison suite** — none of the 3 evaluable fixtures has `has_rejected_decision: true`. The REJECTED path is exercised directly instead by `T3` (`ARCH_REJECTED_INPUT`) and the `HI-002`/`HI-013` validator checks.
4. **`SD-004` is not an "improved dimension."** The baseline's single-task plan is trivially acyclic and priority-clean, so `A12`/`A13`/`A14` pass for both arms. `SD-004` correctness is proven directly by `T9`–`T14`, `T20`, `T22`.
5. **The verification "model" is a deterministic rule-based `ModelProvider` fixture, not a real LLM** — explicitly permitted by the QC `reference_model_policy` (`allowed: true`). It genuinely executes inside the generic `runAgent()` loop (issuing a single `FINISH`), and `T33` asserts it is described accurately, never as a production LLM. A real `ModelProvider` can replace it with no Core/Intelligence change.
6. **The caller harness `AgentDefinition` (`skillExecutionHostDefinition`) lives in `tests/`.** It is the "harness injected by the caller" that Part A §7 sanctions for `SKILL_ONLY` execution — a generic `skill-execution-host` role, zero tools/capabilities, not registered in any catalogue, out of scope of the `src/intelligence/agent-definitions/` scan `T25` performs (disclosed so a reviewer expects it). `planImplementation()` never defines, selects, catalogues, or activates a new planning agent.
7. **Milestone-order (`HI-008` `MILESTONE_ORDER`) and priority-direction (`HI-005/006`) overlap** for a cross-tier "P0 depends on P1" edge — `T20` asserts the `MILESTONE_ORDER` code fires; `T9`/`T10` assert the `PRIORITY_DIRECTION` code fires. Both are independent checks in `analyzeDependencies`.
8. **`HI-014` and `A25` are word-boundary cue matches, not semantic understanding.** `HI-014` requires `\b(STOP|ESCALATE)\b` in a P0-affecting rule's `action` (a substring "stopgap" no longer satisfies it) and that a P0-affecting `de-scope` rule also carries a STOP/ESCALATE path; `A25` matches `\bde-?scope\b` + `P2` in `affected_priorities` but does not parse the "before P1" ordering its name implies. Same class of limitation as S13C's disclosed cue-regex checks; a real `ModelProvider` reasoner or a stricter parser could tighten it without any contract change. The canonical synthesizer's two stop/de-scope rules are hand-authored to satisfy the intent, and `HI-014`'s rejection direction is exercised by construction (a P0-affecting `de-scope` rule with no STOP path is rejected).

## 10. Deferred scope (not implemented by S13F)

`S13G` task-prompt-compiler · Execution Package · Context Pack compiler · Workflow Runtime (`S17`) · Task Executor · task-graph runtime · Capability Registry / MCP (`S14`) · Verifier Agent (`S15`) · Architecture Challenger (`S16`) · Agent Factory · Agent Registry · a new implementation-planning `AgentDefinition` · automatic durable-memory promotion.

`S13G` remains `NOT_STARTED` and was not started, inspected, designed, or authored by this closure.

## 11. Conclusion

S13F fully closed: Part A (ChatGPT semantic authoring) + Part B (Claude Code implementation, `67` new tests, this report, independent review) both `PASS`. Implementation Planning (Stage 10 `PLAN`) is proven end-to-end through the real S12 discovery/lazy-load + S10 `compileAgentDefinition()` + S09 `runAgent()` path, executed via a caller-supplied harness `AgentDefinition` and NOT a new registered planning agent (`agent_need: SKILL_ONLY`). S13D `SoftwareArchitectureDecisionResult` and S13E `AgentEngineeringResult` are consumed read-only and never mutated; every referenced ADR/agent proposal stays `PROPOSED` and is referenced, never activated. Skill-vs-no-Skill improvement is proven against frozen independent ground truth (`+37` correct assertions: baseline `38/75` vs skill `75/75`, `6` improved dimensions, `100%` hard invariants, `0` boundary violations). No `src/core/` change, no new dependency, no S13G scope pulled forward.
