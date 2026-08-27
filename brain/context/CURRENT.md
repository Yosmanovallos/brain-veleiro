# BRAIN — Current Session Pointer

> This file is intentionally small. It points to the current verified operational frontier and must not duplicate the full Handoff.

**Template status:** `ACTIVE`

## Current Objective

S13G (task-prompt-compiler) is fully closed with `PASS` (Part A + Part B) by the primary builder. It is **not yet independently verified** — the next objective is a fresh-session read-only verification of S13G analogous to the S13F one. S13H (repository-git-workflow) has not been started and must not start until that verification returns `VERIFICATION RESULT / Step: S13G / Status: PASS`.

## Current Repository State

**Branch:**
`main`

**HEAD:**
`e6c7bbb3cb21dfaa2b5c29e6ce703bffe8b31224` (the S13G close commit `feat: implement Brain Task Prompt Compiler Part B (S13G close)`; this line is set by the follow-up "docs: record real HEAD sha" commit — verify with `git rev-parse HEAD`)

**Worktree status:**
`CLEAN as of this update; verify independently`

**Last independently verified at:**
`2026-08-27T10:45:00Z (primary-builder deterministic QA; independent fresh verification still pending)`

## Current Handoff

**Handoff file:**
`brain/context/handoffs/2026-08-27T104500Z-s13g-to-s13h-handoff.md`

**Handoff status:**
`VERIFIED`

## Current Status

S00–S13G: `PASS`. S13G closed with Part A (ChatGPT semantic authoring — `TASK_PROMPT_COMPILER_SKILL_S13G.md`, `S13G_TASK_PROMPT_COMPILER_DEEP.yaml`, `EXECUTION_PACKAGE_CONTRACT_S13G.md`, integrated verbatim at commit `f7ef335`, `git diff` empty, semantic changes NONE) + Part B (Claude Code implementation: `src/intelligence/task-prompt-compiler/` module — typed `TaskCompilationInput`/`ExecutionPackage`, bounded task-local Spec projection, Context Pack snapshot validator, target-execution compatibility validator, provider-neutral tool/limits materializers, instruction assembler with provenance **and completeness**, the single `assembleExecutionPackage` synthesizer parameterized by a CONTENT-regex read of rule text, `HI-001..HI-026` validator with full anti-self-certification recompute, `gateTaskCompilation()` that never trusts the model's claimed status, `compileTaskExecutionPackage()` S12→S10→S09 bridge; new typed `intelligence.task-prompt-compiler.s13g` Skill registered as the 10th reference Skill; 27-assertion counted comparison model; `SKILL-ARTIFACT-1..4` + T1–T50 + 4 anchors, `81` new tests; verification report; independent review with one blocking validator fix — instruction completeness, D-060). Execution is `SKILL_ONLY` — **no new AgentDefinition**; the Skill runs through the unchanged S12→S10→S09 path via a caller-supplied host. Skill-vs-no-Skill: baseline `56/108` → skill `108/108` (`+52`), all 9 dimensions improved (min `+2`), hard invariants `48/48`, `0` stage-boundary violations, `meets_threshold`. S13H: `NOT_STARTED`. Baseline: typecheck 0 errors, full suite `533/533` PASS (`452` pre-existing + `81` new), clean build + post-build `533/533`.

## Next Exact Action

Do not start S13H. Run one fresh-session **read-only** independent verification of S13G (analogous to `S13F_FRESH_INDEPENDENT_VERIFICATION.md`): confirm HEAD, `git diff f7ef335 -- <the 3 Part A files>` empty, transfer sha256 `fc5ef8e83e6669d06727785a4c17442543a1403ca3c1a4d81ce1bbd7b3a3417f` unchanged, typecheck 0, `533/533` tests, clean build, and independently re-measure the Skill-vs-no-Skill figures from `dist/`. S13H stays `NOT_STARTED` until that returns `VERIFICATION RESULT / Step: S13G / Status: PASS`. When S13H is later authorized, confirm its exact canonical objective and Entrada/Salida directly from `.claude/skills/brain-build-day-bootstrap/SKILL.md` (not from memory); S13H is inside the ChatGPT Authoring Gate (`3.1`, "todos los S13x").

### Operating Rule

A new session must never trust this file or its referenced Handoff blindly.

Before continuing, verify current repository/runtime reality independently. If reality conflicts with this file or the Handoff, repository/runtime reality wins according to the canonical Context Authority order.

Update this file only after the new state has been verified.
