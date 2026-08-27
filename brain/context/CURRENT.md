# BRAIN — Current Session Pointer

> This file is intentionally small. It points to the current verified operational frontier and must not duplicate the full Handoff.

**Template status:** `ACTIVE`

## Current Objective

S13H (repository-git-workflow) is fully closed with `PASS` (Part A + Part B) by the primary builder. It is **not yet independently verified** — the next objective is a fresh-session read-only verification of S13H analogous to the S13F/S13G ones. S13I (backend-api-engineering) has not been started and must not start until that verification returns `VERIFICATION RESULT / Step: S13H / Status: PASS`.

## Current Repository State

**Branch:**
`main`

**HEAD:**
`c4df69f25851b661a2b3456379dbc08d60fd58ca` (the S13H close commit `feat: implement Brain Repository Git Workflow Skill Part B (S13H close)`; this line is set by the follow-up "docs: record real HEAD sha" commit — verify with `git rev-parse HEAD`)

**Worktree status:**
`CLEAN as of this update (apart from the retained untracked scaffolding .md files); verify independently`

**Last independently verified at:**
`2026-08-27T18:45:00Z (primary-builder deterministic QA; independent fresh verification still pending)`

## Current Handoff

**Handoff file:**
`brain/context/handoffs/2026-08-27T184500Z-s13h-to-s13i-handoff.md`

**Handoff status:**
`VERIFIED`

## Current Status

S00–S13H: `PASS`. S13H closed with Part A (ChatGPT semantic authoring — `REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md`, `S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml`, `REPOSITORY_GIT_WORKFLOW_CONTRACT_S13H.md`, integrated verbatim at commit `0a4f6cf`, `git diff` empty at closure, semantic changes NONE) + Part B (Claude Code implementation: `src/intelligence/repository-git-workflow/` module — 18 files: typed `RepositoryStateSnapshot`/`RepositoryGitWorkflowInput`/`RepositoryWorkflowDecision`, repository-state / git-operation / changed-path classifiers, sensitive-path + change-isolation + validation-evidence gates, workspace-strategy decider (`FEATURE_BRANCH` canonical default), commit/push/remote-review plan builders (`force` a literal `false`, provider-neutral handoff), the single `synthesizeRepositoryWorkflowDecision` synthesizer parameterized by a CONTENT-regex read of rule text, `HI-001..HI-028` validator with full anti-self-certification recompute, `gateRepositoryGitWorkflow()` that never trusts the model's claimed status, `planRepositoryGitWorkflow()` S12→S10→S09 bridge; new typed `intelligence.repository-git-workflow.s13h` Skill registered as the **11th** reference Skill; 31-assertion counted comparison model; `SKILL-ARTIFACT-1..4` + T1–T66 + 4 anchors, `105` new tests; verification report; independent review — 4 builder-side findings addressed, one blocking mechanical fix to `T53`). Execution is `SKILL_ONLY` — **no new AgentDefinition**, **no git execution in the Skill runtime** (`allowed_side_effects: [NONE]`, no `child_process` anywhere in the module); the Skill runs through the unchanged S12→S10→S09 path via a caller-supplied host. Skill-vs-no-Skill: baseline `136/155` → skill `155/155` (`+17` excl. `regression_only`), 4 improved dimensions (SD-002/006/009/010, min `+2`), hard invariants `75/75`, `0` destructive/unintended/secret recommendations, `meets_threshold`. S13I: `NOT_STARTED`. Baseline: typecheck 0 errors, full suite `638/638` PASS (`533` pre-existing + `105` new), clean build + post-build `638/638`.

## Next Exact Action

Do not start S13I. Run one fresh-session **read-only** independent verification of S13H (analogous to `S13F_FRESH_INDEPENDENT_VERIFICATION.md`): confirm HEAD `== origin/main`, `git diff 0a4f6cf -- <the 3 Part A files>` empty, transfer sha256 `3e3df7ad92c6df83565bfb16a8264cb96de69ed2bb8859f494387aca9320e2f5` unchanged, typecheck 0, `638/638` tests, clean build, and independently re-measure the Skill-vs-no-Skill figures (baseline `136`, skill `155`, `+17`, hard `75/75`, `0` destructive/unintended/secret, 4 improved dimensions). S13I stays `NOT_STARTED` until that returns `VERIFICATION RESULT / Step: S13H / Status: PASS`. When S13I is later authorized, confirm its exact canonical objective and Entrada/Salida directly from `.claude/skills/brain-build-day-bootstrap/SKILL.md` (not from memory); S13I is inside the ChatGPT Authoring Gate (`3.1`, "todos los S13x").

### Operating Rule

A new session must never trust this file or its referenced Handoff blindly.

Before continuing, verify current repository/runtime reality independently. If reality conflicts with this file or the Handoff, repository/runtime reality wins according to the canonical Context Authority order.

Update this file only after the new state has been verified.
