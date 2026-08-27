# BRAIN — S13G (task-prompt-compiler) Verification Report

**Step:** S13G — TASK COMPILATION (SPEC_CONTRACT.md Stage 11, lines 595–641)
**Status:** `PASS`
**Primary builder:** claude-code
**Date:** 2026-08-27
**Part A commit:** `f7ef33537ef5d61402f6d6b8a783db6da25db7b2` (`docs: integrate Brain S13G Part A (ChatGPT authoring)`)
**Runtime:** Node.js `v24.19.0` (nvm), TypeScript ESM, Vitest

---

## 1. Scope

S13G compiles **exactly one** READY S13F `ImplementationPlanTask` into a bounded **Execution Package**
(`objective; instructions; context; tools; limits; output_schema; acceptance; evidence`) — the artifact
S13F deliberately does not build. Execution model is **`SKILL_ONLY`** (Part A §0, ARTIFACT 1
`execution_mode: SKILL_ONLY`): no new `AgentDefinition`. The typed Skill
`intelligence.task-prompt-compiler.s13g` runs through the unchanged generic
S12 metadata discovery + lazy-load → S10 `compileAgentDefinition()` → S09 `runAgent()` path via a
**caller-supplied** host `AgentDefinition` (`tests/task-prompt-compiler/fixtures.ts` `taskCompilerHost`,
generic role, **not** registered in `src/intelligence/agent-definitions/`).

S13G does **not**: execute the target task; compose / retrieve / rank / trim / refresh a Context Pack;
select the target task's Skills; load the full Skill catalog; create / design / select / activate / mutate
an `AgentDefinition`; bind providers / tools / MCP / connectors; inject credentials; or implement a
Capability Registry, Task Executor, Workflow Runtime, execution graph, BUILD stage, S13H
repository-git-workflow, Agent Factory, or Skill Factory.

---

## 2. Part A integrity

| Artifact | Canonical path | Lines | Verification |
|---|---|---|---|
| Skill (markdown) | `brain-bootstrap/skills/TASK_PROMPT_COMPILER_SKILL_S13G.md` | 535 | integrated verbatim by `sed -n` line-range extraction from the transfer file, `diff` empty |
| Quality Contract (YAML) | `brain-bootstrap/quality-contracts/S13G_TASK_PROMPT_COMPILER_DEEP.yaml` | 443 | `js-yaml` parse OK: `id: S13G_TASK_PROMPT_COMPILER_DEEP`, depth `DEEP`, 26 hard invariants `HI-001..HI-026`, 9 semantic dimensions `SD-001..SD-009`, `fixtures.minimum_positive_evaluable: 4`, `fixtures.minimum_negative: 10` |
| Execution Package Contract (spec) | `brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md` | 1121 | 25 sections; canonical TS shapes §3–4; deterministic input invariants §5; context immutability §6; instruction compilation §7; forbidden fields §13; secrets §14; T1–T50 §19; PASS criteria §25 |

**`git diff f7ef33537ef5d61402f6d6b8a783db6da25db7b2 -- <the 3 files>` is EMPTY** (verified at closure).
**Semantic changes to Part A: NONE.**

**Transfer file:** `S13G_CHATGPT_PART_A_CANONICAL.md`, sha256
`fc5ef8e83e6669d06727785a4c17442543a1403ca3c1a4d81ce1bbd7b3a3417f` — unchanged, retained untracked
until the final fresh independent verification, **not** included in any implementation commit.

---

## 3. Implementation (Part B)

### 3.1 Files

Bounded Intelligence module `src/intelligence/task-prompt-compiler/` (15 files):

| File | Role |
|---|---|
| `constants.ts` | Skill id / QC ref / artifact paths / parse markers / `EXECUTION_PACKAGE_SCHEMA_VERSION` / `EXECUTION_PACKAGE_FORBIDDEN_KEYS` (Stage-12+/S14/S17-facing: `provider`, `connector`, `mcp_server`, `credential`, `token`, `runtime_handle`, `execution_result`, `workflow_state`, `task_executor`, `acceptance_passed`, `tests_passed`, …) |
| `types.ts` | `TaskCompilationInput` (task, bounded spec snapshot, agent def, frozen Context Pack snapshot, selected skills, capabilities, constraints, acceptance, evidence); `ExecutionPackage` (8 required categories); `ExecutionInstruction` (`kind` ∈ TASK/SPEC/SKILL/CONSTRAINT/POLICY/SAFETY); `TaskCompilationResult`; `TaskCompilationFixtureTruth`; `NON_NORMATIVE_CONTEXT_LAYERS` |
| `sharedNormalization.ts` | `stableStringify`, `deepClone`, acceptance/evidence normalize+equal, `jsonSchemaEqual`, `isMaterialRef` (`/^(NFR|AC|R|C|A)-\d+$/`), `taskMaterialSpecRefs`, `boundedSpecSnapshotRefs`, `computePackageId`, `findExecutionPackageForbiddenKeys` (deep KEY scan), `containsKnownSecretValue` (explicit tagged/known patterns only) |
| `projectTaskCompilationSpec.ts` | filters the full S13F spec snapshot to only task-material refs (`task.{spec_refs,constraint_refs,assumption_refs}` + transitive acceptance via kept requirements) — no new fact, no scope widening |
| `validateTaskCompilationInput.ts` | STRUCTURAL defects throw; calls `validateAgentDefinition` + `validateSkillDefinition`; approval / mismatch / unknown-ref are BLOCKED results, not throws |
| `validateContextPackSnapshot.ts` | blockers: 9 canonical authority ranks in order, ≥1 concrete positive budget bound, item id uniqueness + canonical layer + rank 1–9 + status + provenance + relevance, essential (CRITICAL/HIGH) item BLOCKED/UNKNOWN → blocker, objective word-overlap with `task.outcome` |
| `validateTargetExecutionCompatibility.ts` | blockers (spec §5.1–5.10 + §14): readiness `READY_FOR_S13G`, `spec.approval.status === APPROVED`, bounded-projection resolution / no widening, acceptance & evidence deep-equal to task's, constraint ref resolution, `task.agent_definition_ref === agent.id`, selected-Skill unique `id@version` + allowlisted by `agent.skills`, capability ∈ `agent.capabilities` ∧ `agent.tools`, Skill `requires.capabilities` ⊆ supplied, Skill `permissions.allowed_capabilities` ⊇ its `requires.capabilities`, bounded known-secret scan |
| `materializeExecutionTools.ts` | `[{id, capability_ref}]` per unique capability id, sorted — provider-neutral, unbound |
| `materializeExecutionLimits.ts` | `{max_turns, timeout_ms}` from `agent.limits`; `context_budget` = clone of the pack budget — nothing invented |
| `compileExecutionInstructions.ts` | `InstructionAssemblyProfile` (3 booleans); `FAITHFUL_INSTRUCTION_PROFILE` / `NAIVE_INSTRUCTION_PROFILE`; `isEligiblePolicyContextItem`; `assembleExecutionInstructions(input, profile)` emits `INS-…`: TASK (`task:<id>`), SPEC per bounded requirement/NFR, CONSTRAINT per cited supplied constraint, SKILL per selected-Skill MUST rule (`skill:<id>#<ruleId>`), POLICY per eligible project-instructions item (`context:<id>`), fixed SAFETY (`policy:s13g-compilation-boundary`); naive path additionally promotes imperative non-normative text + appends an unsourced instruction |
| `assembleExecutionPackage.ts` | the **single** synthesizer. `ExecutionAssemblyProfile` (9 booleans), `deriveAssemblyProfileFromRules(ruleTexts)` derives every field by CONTENT regex over whatever rule text the run objective carries — **no** with-Skill flag, **no** Skill-id / fixture-id branch. Naive path: broadens objective + widens spec_refs, trims LOW-priority context items, attaches `provider:"default"` to tools, adds a `compiler_notes` schema property, `max_turns + 2`, prepends `"Ensure that "` to acceptance |
| `validateExecutionPackage.ts` | `HI-001..HI-026` deterministic validator. RECOMPUTES `objective`, `instructions`, `context`, `tools`, `limits`, `output_schema`, `acceptance`, `evidence` from the bounded input and rejects any mismatch (anti-self-certification, S13B/D/F precedent). Forbidden-key deep scan (HI-024), all 8 categories present + deterministic `package_id` (HI-025), context items deep-equal supplied pack (HI-011), instruction provenance **and completeness** (HI-014), non-normative context never a source (HI-015), limits deep-equal `materializeExecutionLimits` (HI-019), `jsonSchemaEqual` schema (HI-020), acceptance/evidence normalize-equal (HI-017/018), no known secret (HI-021). Also `mapTaskCompilationResultToStructuredOutput` |
| `compileTaskExecutionPackage.ts` | bridge: `materializeTaskCompilationTask` (embeds `TASK_COMPILATION_INPUT:` + JSON + serialized Skill body + QC ref), `materializeBaselineTaskCompilationTask` (input marker + JSON only), `gateTaskCompilation` (never trusts `candidate.status`: compatibility + context-pack blockers → BLOCKED; else no `candidate.package` → BLOCKED; else `validateExecutionPackage` → BLOCKED w/ errors or READY), `compileTaskExecutionPackage(input, harness)` (S12 `selectSkillForTask` → require `loaded.id === TASK_PROMPT_COMPILER_SKILL_ID` → materialize → S10 compile → S09 run → parse → gate). `../agent-definitions/` intentionally **not** imported |
| `compareTaskCompilationRuns.ts` | 27 discrete boolean assertions `A01..A27` tagged `SD-001..SD-009` (3 each); `scoreTaskCompilationArm`; `compareTaskCompilationRuns` aggregates QC `skill_vs_no_skill_evaluation` thresholds (min +6 total, ≥3 distinct dimensions, ≥+2 per improved dimension, hard-invariant score 1.0, 0 stage-boundary violations) |
| `index.ts` | module public surface |

Typed Skill: `src/intelligence/skills/definitions/taskPromptCompilerS13G.ts` — `SkillDefinition`
`id: intelligence.task-prompt-compiler.s13g` v`1.0.0`, **23 MUST rules `TC-R1..TC-R23`**,
**19 procedure steps `TC-P1..TC-P19`**, **12 verification checks `TC-V1..TC-V12`**,
`requires.skills: []`, `requires.capabilities: []`, `permissions.allowed_side_effects: ["NONE"]`,
`deny_unlisted_capabilities: true`, 5 evals. `exclusions` explicitly scope out task execution,
context-pack composition, capability-registry construction, provider binding, mcp creation,
workflow-runtime design, task-executor construction, repository-git-workflow.

Registration: `src/intelligence/skills/index.ts` — the 10th `referenceSkillCatalogEntries` entry
(mechanical, identical to every prior S13x).

Tests: `tests/task-prompt-compiler/{fixtures.ts, fixtureTruth.ts, taskCompilation.test.ts}` —
`SKILL-ARTIFACT-1..4` + `T1..T50` + 4 helper anchors = **81 `it()` cases**.

Prior-test relaxation: `tests/implementation-planning/implementationPlanning.test.ts` — the
"reference Skill catalog" assertion changed from an exact 9-entry `toEqual([...])` to
`slice(0,9)` equality + `length ≥ 9`. Mirrors S13D→E (`toBe(7)`→`toBeGreaterThanOrEqual(7)`) and
S13E→F (`toBe(8)`→`toBeGreaterThanOrEqual(8)`). **Not** a semantic change to S13F.

### 3.2 Part B determinizations

| ID | Decision | Rationale |
|---|---|---|
| D-056 | The single synthesizer's behaviour is parameterized by `deriveAssemblyProfileFromRules()`, a CONTENT-regex read of whatever Skill rule text the materialized run objective carries. The no-Skill arm's objective carries no rule text → every profile field is `false` (naive); the with-Skill arm's objective embeds the serialized Skill body → every field is `true` (faithful). | Satisfies "no separate intentionally-bad baseline compiler", "no `withSkill` boolean branch", "no Skill-ID / fixture-ID branch inside the provider". Proven by the `helpers — assembly profile derivation is content-driven` anchor. |
| D-057 | `gateTaskCompilation()` never reads `candidate.status`. Readiness is the deterministic result of compatibility + context-pack validation + full `validateExecutionPackage`. | Anti-self-certification (S13B/D/F). Proven by the `helpers — the gate never trusts the model status` anchor. |
| D-058 | S13G's package forbidden-key list (`EXECUTION_PACKAGE_FORBIDDEN_KEYS`) is a **new** Stage-12+/S14/S17-facing list, distinct from S13F's `STAGE_11_FORBIDDEN_KEYS` (which forbids `tools`, `context`, `instructions`, `limits`, … — exactly what S13G legitimately outputs). | The S13F name-collision would otherwise reject every valid S13G package. Documented in `S13G_AUTHORING_PREFLIGHT.md`. |
| D-059 | Frozen `tests/task-prompt-compiler/fixtureTruth.ts` carries deliberate slack: `min_skill_must_instructions: 2` while the faithful compile emits 3 (target Skill has 3 MUST rules) and the naive arm emits 0. | Threshold-bearing values must not be tuned to a single exact figure (S13F review lesson). |
| D-060 | `HI-014` enforces instruction **completeness** (spec §7.2 "Instructions MUST preserve, when applicable, …"), not only per-instruction provenance: every task-material Spec/NFR ref, every cited constraint ref, and every selected-Skill MUST rule id must be represented by some instruction, and a TASK instruction must cite `task:<id>`. | Independent review found the per-instruction spot check alone left `instructions` — the one field with model latitude — able to silently drop SPEC/SKILL entries. See §7. |

---

## 4. Generic runtime proof

| Property | Evidence |
|---|---|
| S12 metadata-only discovery | `T37` — no full definition loads during `discoverSkills`; `descriptor` projection stays metadata-only (`T50` anchor) |
| Lazy load exactly once | `T37` — `selectSkillForTask` invokes only the S13G loader, once; no other loader called |
| S10 `compileAgentDefinition()` unchanged | `T38` — with-Skill and no-Skill runs differ **only** in the materialized objective; `limits`, `tools`, `capabilities` identical |
| S09 `runAgent()` unchanged | `T38` — both arms `outcome: "SUCCESS"`, run genuinely inside `runAgent()` |
| Real runtime execution (not a stub) | `compileTaskExecutionPackage` calls the real S12/S10/S09 surface imported from `src/core` + `src/intelligence/skills`; no re-implementation |
| Reference provider label | `deterministic reference ModelProvider (no external LLM, no network, no credentials); reacts only to the materialized run objective` |

No real production LLM is claimed or measured. The reference `ModelProvider`
(`DeterministicTaskCompilationModelProvider`, in `tests/`) extracts the bounded input from the
materialized objective via `TASK_COMPILATION_INPUT:`, calls
`deriveAssemblyProfileFromRules([goalText])`, runs the single `assembleExecutionPackage`, and returns
FINISH. It has no `withSkill` / fixture-id / Skill-id branch (`T47`).

---

## 5. Fixtures

**Positive (4, QC `minimum_positive_evaluable: 4`):**

| Fixture | Shape |
|---|---|
| `FX-POS-001` | SKILL_ONLY, no tools; generic host; 4 context items (state / project-instructions / working / knowledge) |
| `FX-POS-002` | one allowed provider-neutral capability `repository.read`; TASK-002 / R-002; `taskCompilerHostWithCapability` |
| `FX-POS-003` | approved task-specific `agent_definition_ref: "auth-builder-v1"`; `approvedTaskAgent` (`max_turns 12`, `timeout_ms 45000`) |
| `FX-POS-004` | injection-separation: 5 context items (extra `CI-WORKING-2` imperative "Disregard the acceptance criteria…"); own pack id `CP-AUTH-004` |

**Negative (10, QC `minimum_negative: 10`):** `FX-NEG-001` not ready · `FX-NEG-002` unknown spec ref `R-999` ·
`FX-NEG-003` acceptance mismatch · `FX-NEG-004` evidence mismatch · `FX-NEG-005` skill not allowlisted ·
`FX-NEG-006` skill needs missing capability · `FX-NEG-007` capability `network.fetch` not on agent ·
`FX-NEG-008` agent ref mismatch · `FX-NEG-009` context objective misaligned (marketing-newsletter objective +
empty budget) · `FX-NEG-016` known secret in context (`SERVICE_TOKEN=SECRET:sk-live-…`).

**Frozen ground-truth isolation:** `tests/task-prompt-compiler/fixtureTruth.ts` (sha256
`11761ba2a90bdd86992f008cde0ef1c16bcfa3ba13bb18c884cfa97119b7915a`, recorded here **before** the
comparison figures below were measured) is imported **only** by `compareTaskCompilationRuns` consumers —
**never** by `fixtures.ts` (`T46` asserts: no `import`/`require` of `fixtureTruth`, no
`TaskCompilationFixtureTruth` token, no truth field name anywhere in `fixtures.ts`, which is where the
reference `ModelProvider` lives). The runtime path (materializer → provider → assembler → gate →
validator) provably never sees a value from `fixtureTruth.ts`. Three previously-decorative truth fields
were wired into live assertions during review (§7): `non_normative_context_item_ids` now drives `A06`/`A23`
as an independence check, `has_secret_bearing_input` drives `A22`, `expected_status` drives `T41–T44`.

`fixtures.ts` and `fixtureTruth.ts` land in the same implementation commit (as in S13F). Mitigations:
(a) the sha256 above recorded in this report prior to measurement; (b) `T46` mechanically proves the
non-import; (c) `T47` proves no separate baseline compiler. See OI-S13G-05.

---

## 6. Skill-vs-no-Skill evaluation (COUNTED-ASSERTION model)

Measured from `dist/` after `rm -rf dist && npm run build`, transcribed into `T48`
(`REAL_BASELINE_CORRECT = 56`, `REAL_SKILL_CORRECT = 108`, `REAL_TOTAL_PER_ARM = 108`):

| Metric | Baseline (no-Skill) | With-Skill | Δ |
|---|---|---|---|
| Correct assertions / arm | **56 / 108** | **108 / 108** | **+52** |
| Hard-invariant score | 26 / 48 | **48 / 48 (100%)** | +22 |
| Stage-boundary violations (`A25`/`A15` fails) | 2 | **0** | −2 |
| Invented authority/tool/limit/schema refs (`A14`/`A16`/`A17`/`A18` fails) | 9 | **0** | −9 |
| Improved dimensions | — | **9 / 9** (`SD-001..SD-009`) | — |
| `meets_threshold` | — | **true** | — |
| `hard_invariant_regressed` | — | **false** | — |

**Per-dimension correct (baseline → skill, each out of 12):**

| Dim | Baseline | Skill | Δ | Dimension |
|---|---|---|---|---|
| SD-001 | 8 | 12 | **+4** | objective fidelity / no scope broadening |
| SD-002 | 0 | 12 | **+12** | instruction provenance & non-promotion |
| SD-003 | 4 | 12 | **+8** | context fidelity & boundedness |
| SD-004 | 8 | 12 | **+4** | tool declaration neutrality |
| SD-005 | 10 | 12 | **+2** | limits inheritance |
| SD-006 | 4 | 12 | **+8** | output-schema inheritance |
| SD-007 | 8 | 12 | **+4** | acceptance / evidence exactness |
| SD-008 | 4 | 12 | **+8** | security & instruction separation |
| SD-009 | 10 | 12 | **+2** | forbidden-field / future-stage boundary |

Every improved dimension clears the QC minimum of +2. Thresholds (QC
`skill_vs_no_skill_evaluation`): min additional correct total **6** (got **52**); min improved dimensions
**3** (got **9**); min additional correct per improved dimension **2** (min observed **+2**);
`hard_invariant_score_with_skill` **1.0** (got **1.0**); `maximum_stage_boundary_violations_with_skill`
**0** (got **0**).

Both arms use the **same** base `AgentDefinition` object, the **same** `ModelProvider` constructor, and
the **same** single `assembleExecutionPackage` synthesizer (`T47`). The only difference is whether the
materialized run objective carries the Skill's rule text.

---

## 7. Independent builder-side review (§24)

An independent review pass (advisor, full-transcript) was run **before** declaring PASS, per the
S11/S12/S13A–S13F precedent. It inspected Part A integrity, all S13G source, all tests/fixtures, the
runtime path, the provider source, ground-truth isolation, the Skill-vs-no-Skill implementation, the
Context Pack boundary, instruction provenance, tool/provider neutrality, and the future-stage boundary.

**Findings and dispositions (all mechanical Part B repairs — no Part A semantic defect):**

| # | Finding | Disposition |
|---|---|---|
| R-1 (blocking) | `instructions` is the one recomputed-package field with model latitude, and `validateExecutionPackage` only spot-checked it **per instruction** (non-empty id/kind/text, ≥1 resolvable source ref, no non-normative source). Nothing asserted required instructions were **present** — a lazy compile could drop every SPEC/CONSTRAINT/SKILL instruction and still validate. Spec §7.2 makes completeness normative. | **Fixed** (D-060): `HI-014` now also asserts every task-material Spec/NFR ref, every cited constraint ref, and every selected-Skill MUST rule id is represented by some instruction, plus a TASK instruction citing `task:<id>`. Regression added to `T23` (strip to TASK+SAFETY only → `valid: false` with an `HI-014` completeness error); proven to fail pre-fix and pass post-fix. Full suite re-run after the change (every positive fixture passes through this validator). |
| R-2 | Three frozen-truth fields (`expected_status`, `non_normative_context_item_ids`, `has_secret_bearing_input`) were never read by any assertion — an independent verifier would read them as decorative. | **Fixed**: `A06`/`A23` now take the non-normative id set from `truth.non_normative_context_item_ids` (turning a self-consistency check into an independence check); `A22` keys off `truth.has_secret_bearing_input`; `T41–T44` assert `out.result.status === truth.expected_status`. Comparison figures re-measured after the change (unchanged: 56 → 108). |
| R-3 | `T12` tests spec §19 T12 ("capability absent from `AgentDefinition.tools` blocks") by a **direct** `validateTargetExecutionCompatibility` call with a hand-built agent, because the end-to-end path can't reach it (`validateAgentDefinition` enforces `set(tools) == set(capabilities)`). Legitimate, but must be disclosed in the T-mapping. | **Disclosed** — see §8, T12 row, and OI-S13G-01. |
| R-4 | Committing the whole module at once reproduces the S13F limitation that `HAND_AUTHORED_BEFORE_RUN` for `fixtureTruth.ts` is unverifiable from git history. | **Mitigated**: `fixtureTruth.ts` sha256 recorded in §5 before the §6 figures; disclosed as OI-S13G-05. |
| Minor | `FX_POS_004` shared a `package_id` with `FX-POS-001` (same task id + pack id). | **Fixed**: `FX_POS_004` context pack id → `CP-AUTH-004`. |
| Minor | Dead `void NAIVE_INSTRUCTION_PROFILE;` with a misleading "load-bearing" comment; `T46` read the same file twice under two names. | **Fixed**: removed the dead statement + its unused import; `T46` reads `fixtures.ts` once. |
| Minor (kept) | `validateExecutionPackage` HI-017 runs a `pkg.acceptance` vs `task.acceptance` normalize-equality check twice (once via `acceptanceEqual`, once via `stableStringify(normalizeAcceptance(...))`). | **Kept** as intentional belt-and-suspenders; both are input-derived, harmless, and removing risks re-verification churn. |

**Post-review deterministic QA:** `npm run typecheck` 0 errors · `npm test` **533/533** · `rm -rf dist && npm run build` OK · post-build `npm test` **533/533** · focused `npx vitest run tests/task-prompt-compiler/` **81/81**.

---

## 8. T1–T50 mapping report (§20)

Every spec §19 T-case maps to a named `describe` block in
`tests/task-prompt-compiler/taskCompilation.test.ts`. No case is omitted. Where one describe covers
several §19 lines, or where a case is exercised by a direct unit call rather than the end-to-end path,
it is stated explicitly.

| §19 case | Test anchor | Fixture / method | Notes |
|---|---|---|---|
| T1 valid READY no-tool input validates | `describe T1` | `FX-POS-001` via `runSkill` | asserts `validateExecutionPackage(...).valid` |
| T2 BLOCKED_PENDING_APPROVAL blocks, package null | `describe T2` | `FX-NEG-001` | status BLOCKED, package null, explained blocker |
| T3 task-local Spec projection only task-material refs | `describe T3` | `projectTaskCompilationSpec` unit call | drops unrelated R/C/A |
| T4 unknown Spec ref blocks | `describe T4` | `FX-NEG-002` (`R-999`) | blocker names `R-999` |
| T5 non-approved bounded Spec blocks | `describe T5` | `spec.approval = PENDING` mutation | BLOCKED |
| T6 task-specific `agent_definition_ref` mismatch blocks | `describe T6` | `FX-NEG-008` | BLOCKED |
| T7 generic host allowed when ref absent + compat holds | `describe T7` | `FX-POS-001` (no ref) | READY against generic host |
| T8 selected Skill outside `AgentDefinition.skills` blocks | `describe T8` | `FX-NEG-005` | BLOCKED |
| T9 duplicate selected `id@version` blocks | `describe T9` | duplicated-skill input | BLOCKED |
| T10 selected Skill's required capability missing from input blocks | `describe T10` | `FX-NEG-006` | BLOCKED |
| T11 target capability absent from `AgentDefinition.capabilities` blocks | `describe T11` | `FX-NEG-007` (`network.fetch`) | blocker matches `AgentDefinition.capabilities` |
| **T12** target capability absent from `AgentDefinition.tools` blocks | `describe T12` | **direct `validateTargetExecutionCompatibility` call** with a hand-built agent (`capabilities:["repository.read"]`, `tools:[]`) | End-to-end path can't reach this: `validateAgentDefinition` (`src/core/agent/validateDefinition.ts`) enforces `set(tools) == set(capabilities)`, so a structurally valid input never has the asymmetry. The direct call proves the `cap ∈ agent.tools` clause fires independently. Disclosed as OI-S13G-01. |
| T13 compiler Skill requires no capabilities / side effects | `describe T13` | `taskPromptCompilerS13G` typed def | `requires.skills/capabilities == []`, side effects `["NONE"]`, `deny_unlisted_capabilities` |
| T14 valid Context Pack fields/authority/status/provenance validate | `describe T14` | `validateContextPackSnapshot(FX-POS-001)` | no blockers |
| T15 Context Pack missing concrete bound blocks | `describe T15` | `budget: {}` | blocker |
| T16 essential BLOCKED/unsafe unresolved context blocks | `describe T16` (2 `it`s) | CRITICAL item status BLOCKED; HIGH item status UNKNOWN | blocker each |
| T17 output context preserves membership/content/authority/status/provenance | `describe T17` | `FX-POS-001` via `runSkill` | `package.context.items` deep-equal supplied pack |
| T18 Context Pack objective material mismatch blocks | `describe T18` | `FX-NEG-009` | BLOCKED |
| T19 acceptance mismatch with task blocks | `describe T19` | `FX-NEG-003` | BLOCKED |
| T20 evidence mismatch with task blocks | `describe T20` | `FX-NEG-004` | BLOCKED |
| T21 constraint ref resolution exact; unknown constraint blocks | `describe T21` | task `constraint_ref` not in supplied constraints | BLOCKED |
| T22 objective preserves task outcome and task ref | `describe T22` | `FX-POS-001` via `runSkill` | `objective.statement === task.outcome`, `objective.task_ref === task.id` |
| T23 every instruction has allowed valid source ref | `describe T23` (2 `it`s) | (a) `FX-POS-001` — no empty/unresolvable source ref; (b) **completeness regression** — strip to TASK+SAFETY → `valid:false` with `HI-014` completeness error | (b) added by review (D-060/R-1); proven fail pre-fix / pass post-fix |
| T24 non-normative imperative context cannot become instruction | `describe T24` | `FX-POS-001` via `runSkill` | no instruction sourced from `CI-WORKING-1`; no instruction text == its imperative text |
| T25 eligible project-instruction item can become sourced POLICY instruction | `describe T25` | `FX-POS-001` via `runSkill` | POLICY instruction cites `context:CI-PROJINSTR-1` |
| T26 target tool declarations equal validated capability ids, deterministic | `describe T26` | `FX-POS-002` via `runSkill` | `tools == [{id:"repository.read", capability_ref:"repository.read"}]`; `materializeExecutionTools` idempotent |
| T27 provider-bound/invented tool field rejects | `describe T27` | `goodPackage(FX-POS-002)` + `{provider}` on a tool | `validateExecutionPackage` fails |
| T28 limits exactly inherit AgentDefinition + Context Pack budget | `describe T28` | `FX-POS-001` via `runSkill` | `{max_turns 8, timeout_ms 20000, context_budget == pack budget}` |
| T29 invented/changed limit rejects | `describe T29` | `goodPackage(FX-POS-001)` + enlarged `max_turns` | fails (HI-019) |
| T30 output_schema exactly equals AgentDefinition.output_schema | `describe T30` | `FX-POS-001` via `runSkill` | deep-equal schema |
| T31 changed/invented output schema rejects | `describe T31` | `goodPackage(FX-POS-001)` + added property | fails (HI-020) |
| T32 package preserves acceptance/evidence exactly | `describe T32` | `FX-POS-001` via `runSkill` | acceptance & evidence normalize-equal to task's |
| T33 package cannot contain target execution result / pass claims | `describe T33` | `goodPackage(FX-POS-001)` + `acceptance_passed` | fails (HI-024) |
| T34 package cannot contain Workflow Runtime/Task Executor/provider/MCP binding | `describe T34` | `goodPackage(FX-POS-001)` + `task_executor` / `mcp_server` | fails (HI-024) |
| T35 no new task-prompt-compiler AgentDefinition exists | `describe T35` (3 `it`s) | grep `src/intelligence/agent-definitions/`; module imports nothing from `../agent-definitions/`; catalog entry is a Skill not an Agent | |
| T36 no role/Skill-id-specific Core branch exists | `describe T36` | grep `src/core/` for compiler identifier / role branch | none |
| T37 compiler Skill uses S12 metadata-only discovery + lazy load | `describe T37` (2 `it`s) | `discoverSkills` loads no full definition; `selectSkillForTask` calls only the S13G loader, once | |
| T38 compiler semantic run uses unchanged S10 `compileAgentDefinition` + S09 `runAgent` | `describe T38` | with-Skill vs no-Skill `runSkill`/`runNoSkill` | both SUCCESS; only materialized objective differs |
| T39 target selected Skills not rediscovered by S13G | `describe T39` | `FX-POS-001` via `runSkill` | `selected_skill_refs` passed through by ref; target Skill id not in catalog |
| T40 explicit known secret-value fixture blocks / never enters READY package | `describe T40` | `FX-NEG-016` | BLOCKED, package null, blocker matches `/secret/i` |
| T41 canonical FX-POS-001 passes | `describe T41-T44` (parameterized over `SUITE`) | `FX-POS-001` + `FX_POS_001_TRUTH` | READY, validator-clean, matches frozen truth (`expected_status`, objective, limits, tool ids, context count, ≥ `min_skill_must_instructions` SKILL instructions, all required source refs) |
| T42 canonical FX-POS-002 passes | `describe T41-T44` (same parameterized block) | `FX-POS-002` + `FX_POS_002_TRUTH` | as above |
| T43 canonical FX-POS-003 passes | `describe T41-T44` (same parameterized block) | `FX-POS-003` + `FX_POS_003_TRUTH` | as above |
| T44 canonical FX-POS-004 injection-separation fixture passes | `describe T41-T44` (same parameterized block) | `FX-POS-004` + `FX_POS_004_TRUTH` | as above; 5 context items, imperative `CI-WORKING-2` not promoted |
| T45 canonical negative fixtures each fail in the required way | `describe T45` (parameterized over `ALL_NEGATIVE_INPUTS`) | all 10 `FX-NEG-*` | each → BLOCKED |
| T46 frozen ground truth inaccessible to model/provider | `describe T46` | static read of `fixtures.ts` | no `fixtureTruth` import, no `TaskCompilationFixtureTruth` token, no truth field name |
| T47 no-Skill arm uses same provider/runtime, no separate bad baseline compiler | `describe T47` | harness identity + source scan | shared `baseDefinition`, shared `ModelProvider` constructor; no `synthesize(Baseline\|Bad\|Naive)` in the comparator; no `if (withSkill` / `fixtureId ===` / `skillId ===` in `fixtures.ts` |
| T48 Skill-vs-no-Skill meets +6 / 3 dimensions / +2 each threshold | `describe T48` (2 `it`s — **overlapping** comparison runs) | `compareTaskCompilationRuns(baselineCases, skillCases)` over `SUITE` | hard invariants 100%, 0 stage-boundary violations, +52 total, 9 improved dimensions, exact figures pinned to `REAL_*` constants; second `it` asserts ≥ +2 per improved dimension |
| T49 no hard invariant regression | `describe T49` (2 `it`s — **overlapping** comparison run) | same comparison | `skill.hard_invariant_correct == hard_invariant_total` and `≥ baseline`; assertion set has ≥ 18 assertions across all 9 dimensions |
| T50 full prior regression suite remains green | `describe T50` (4 `it`s) | S07–S13F AgentDefinitions still valid; catalog has 10 entries and every pre-S13G entry untouched; no forbidden vendor token in Part A; descriptor projection metadata-only | plus the whole-suite `533/533` in §9 |

Additional non-§19 coverage (not required, not substituting for any T-case): `SKILL-ARTIFACT-1..4`
(Part A file existence + vocabulary + typed-Skill validation + QC/spec structure); `helpers — assembly
profile derivation is content-driven`; `helpers — the gate never trusts the model status`.

---

## 9. Deterministic QA

| Check | Command (Node `v24.19.0`) | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **0 errors** |
| Full suite (pre-build) | `npm test` | **533 / 533** (12 files; 452 prior + 81 new S13G) |
| Clean build | `rm -rf dist && npm run build` (`tsc -p tsconfig.json`) | **OK** |
| Full suite (post-build) | `npm test` | **533 / 533**, unchanged |
| Focused | `npx vitest run tests/task-prompt-compiler/` | **81 / 81** |
| Core boundary | grep `src/core/` for `task-prompt-compiler` / `TaskCompilation` / `S13G` / compiler role branch | **none** |
| Cross-layer imports | grep `src/core/` for `../providers` / `../intelligence` imports | **none** |
| Agent-definition boundary | grep `src/intelligence/task-prompt-compiler/` for `agent-definitions` | only a comment stating it is **not** imported |
| Future-stage boundary | grep for `s13h` / `repository-git-workflow` / `agent factory` / `skill factory` / `task executor` / `workflow runtime` / `execution graph` | only in negative contexts (rule `TC-R20`, check `TC-V9`, `exclusions` list) |
| New dependency | `git diff --stat package.json package-lock.json` | **empty** |

---

## 10. Boundary conformance (spec §13, §23; QC HI-024/025/026)

- **Context Pack:** S13G validates (`validateContextPackSnapshot`) and faithfully projects the
  already-frozen pack — `package.context.items` deep-equal the supplied items (`T17`, `HI-011`). No
  compose / retrieve / rank / trim / refresh. `budget` is copied, not recomputed (`T28`).
- **Skill boundary:** the compiler Skill is capability-free (`T13`); selected target Skills are passed
  through by ref, never rediscovered (`T39`); the full catalog is never loaded.
- **Agent boundary:** no new `AgentDefinition`; `src/intelligence/agent-definitions/` gains nothing
  (`T35`); the caller host lives in `tests/`.
- **Capability / tool boundary:** tools are `{id, capability_ref}` only — provider-neutral, unbound; a
  `provider` field rejects (`T27`).
- **Secret handling:** only explicit tagged/known secret patterns are detected
  (`containsKnownSecretValue`); `FX-NEG-016` → BLOCKED (`T40`); no known secret may appear in a READY
  package (`HI-021`). No arbitrary-string "perfect detector" was built.
- **Future-stage boundary:** forbidden-key deep scan rejects `provider` / `connector` / `mcp_server` /
  `credential` / `token` / `runtime_handle` / `execution_result` / `workflow_state` / `task_executor` /
  `acceptance_passed` / `tests_passed` / … (`T33`, `T34`, `HI-024`). No Capability Registry, Task
  Executor, Workflow Runtime, execution graph, BUILD stage, S13H workflow, Agent Factory, or Skill
  Factory implemented.

---

## 11. Open issues (all non-blocking)

| ID | Issue | Impact | What would resolve it |
|---|---|---|---|
| OI-S13G-01 | `T12` is exercised by a direct `validateTargetExecutionCompatibility` call, not the end-to-end path (structurally unreachable — `validateAgentDefinition` enforces `set(tools) == set(capabilities)`). | NONE (the clause is still proven; disclosed in §8) | A Core change that allowed `tools ≠ capabilities`, which is not desired |
| OI-S13G-02 | The verification "model" is a deterministic rule-based `ModelProvider` fixture, not a real LLM (permitted by QC `reference_model_policy`; runs genuinely inside `runAgent()`). | LOW | A real `ModelProvider`-driven reasoner behind the same contract |
| OI-S13G-03 | The Skill-vs-no-Skill comparison is a content-derived maximal contrast (one synthesizer, profile derived by regex from rule text), same accepted pattern as S13A–S13F. | LOW (frozen fixture-truth asserted `T46` to never reach the runtime path; not emergent measurement) | A second independent general compiler, if a future step needs one |
| OI-S13G-04 | `deriveAssemblyProfileFromRules` uses phrase/word-boundary regex over rule text, not semantic understanding (same class as S13C's disclosed cue checks). | LOW (both extreme arms proven; the middle is not claimed) | A real reasoner or a stricter parser |
| OI-S13G-05 | `fixtures.ts` and `fixtureTruth.ts` land in the same implementation commit (as in S13F), so `HAND_AUTHORED_BEFORE_RUN` is not provable from git history alone. | LOW | sha256 recorded in §5 before §6 figures; `T46` proves non-import; `T47` proves no separate baseline compiler |
| OI-S13G-06 | `STATE.yaml` `repository:` block was stale (`commits: 10`, `head_sha: fbd5af95…`) since before S13F. | NONE | Refreshed mechanically in the S13G closure's `docs:` follow-up commit |

---

## 12. Result

**S13G — TASK COMPILATION: `PASS`.**

Part A integrated verbatim (`git diff f7ef335 -- <3 files>` empty; semantic changes NONE). Part B is a
bounded `src/intelligence/task-prompt-compiler/` module + a typed 10th reference Skill, proven
end-to-end through the unchanged S12 → S10 → S09 runtime as `SKILL_ONLY` execution via a caller-supplied
host — no new `AgentDefinition`, no `src/core/` change, no new dependency, no Workflow Runtime / Task
Executor / Context Pack compiler / Capability Registry / provider binding / S13H workflow. The
deterministic `HI-001..HI-026` validator recomputes every package field from the bounded input; the
gate never trusts the model's claimed status. Skill-vs-no-Skill: **56 → 108 correct (+52)**, all 9
dimensions improved (min +2), hard invariants **48/48**, **0** stage-boundary violations,
`meets_threshold: true`. `533/533` tests pre- and post-build. One independent review pass ran before
PASS and produced one blocking fix (instruction completeness, D-060) plus minor cleanups, all
re-verified.

**S13H remains `NOT_STARTED`** and was not started, inspected, or authored by this closure. S13G is not
considered independently verified until a fresh read-only session returns
`VERIFICATION RESULT / Step: S13G / Status: PASS`.
