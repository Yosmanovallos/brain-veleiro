# S13N Agent Evals — Builder Verification

## Status

Builder QA is `PASS`; S13N remains `IN_PROGRESS` and requires a different fresh, non-authoring, non-fork, read-only verifier. This report is not independent verification.

## Authority and Part A integrity

- ChatGPT control-plane response: issue #1 comment `5471091138`, `AUTHORING_READY`.
- Authoring transfer: `ffccfd72f950261cb41a0e40ee97f5750ff201f3`.
- Part A integration: `e73bcb10abbc1835e64836a8f957c045e583478b`.
- Part B: `039782b18f15b62f87f04f1604ae1fd7c7da9755`.
- The three canonical artifacts remain byte-identical to the transfer blobs:
  - Skill `38a7673578d5164b303927bc4752aa61c4b75bc5`
  - Quality Contract `6f8c621c508477cd9fd553f7cd22e44310f602c0`
  - Contract `14d695fa6a98720cb465d6e881a0c560b279b486`

## Implemented scope

S13N adds the bounded Intelligence-only evaluator, total input validation, actual-candidate gate, deterministic bounded task/tool/schema/safety/trace/efficiency evaluation, detached 24-field atomic observations, raw A/B comparison, a lazy S12 catalog entry, and deterministic fixtures/tests. No Core file, AgentDefinition, capability, provider implementation, package dependency, retry/async engine, observability system, registry/MCP/connector, or verifier Agent was added.

## Builder QA (WSL Node 24.19.0 / npm 11.17.0)

- `npm run typecheck` — PASS, zero errors.
- `npm test -- --run tests/agent-evals/agentEvals.test.ts` — PASS, 41 tests.
- `npm test` pre-build — PASS, 21 files / 1040 tests.
- `dist/` was removed and verified absent before `npm run build`.
- `npm run build` — PASS.
- `npm test` post-build — PASS, 21 files / 1040 tests.
- `git diff --check` is clean for Part B; the preserved Part A Markdown has canonical trailing two-space hard breaks and remains byte-identical.

## Contract evidence

- Positives: 8/8 reference inputs used for the A/B evaluation.
- Negatives: FX-NEG-001 through FX-NEG-032, 32/32 focused exact-negative cases.
- Atomic isolation: 24/24 detached one-field mutation probes; each changes only its owned atomic result.
- A/B: same eight frozen inputs and candidates through the same evaluator/gate. Baseline malformed actual candidates: `0/192` atomic passes. Skill actual candidates: `192/192`; delta `+192`; no regression.
- Qualified dimensions: SD-001 through SD-008 (8/8). Each dimension has raw A/B/C contribution counts `8/8/8`, denominator `24`, maximum one-assertion share `8/24 = 0.333333`.
- Hard invariants: HI-001..HI-049 builder-observable checks PASS in the focused harness. HI-050 is deliberately `false`/pending, because builder QA cannot satisfy fresh independent verification.
- Unsafe counters for the Skill arm are all exactly zero: `golden_truth_leak`, `fixture_or_arm_branching`, `subject_run_substitution`, `forbidden_tool_accepted`, `safety_violation_accepted`, `required_schema_failure_accepted`, `unobserved_cost_or_latency_invented`, `future_stage_pull_forward`.

## Required next action

Run fresh independent, read-only verification only. Do not start S13O or any later stage.
