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

## Repair after independent source verification FAIL

Control-plane comment `5471198433` found mechanical defects in the original builder harness. Repair commit `5cd801ace4b3de78cb2e1627eb93242f86f70453` preserves Part A exactly and adds a real deterministic reference path: S12 selected load, S10 compile, S09 `runAgent`, one truth-blind deterministic ModelProvider, actual parsed runtime candidate, total candidate gate, deterministic evaluator and raw comparison.

- Both arms use the identical eight input objects (including the same frozen truth and observed run objects), same reference provider instance, AgentDefinition, parser, gate, evaluator and observation schema. The only treatment is selected S13N Skill prose/loading.
- The provider sees only an explicit provider-visible packet; it omits case ID, truth ref, frozen truth and arm state. Its source imports only Core contracts and S13N types, not fixtures, truth builders or evaluator helpers.
- Actual runtime candidates are structurally validated (all eight canonical dimensions, 24 atomic IDs/results, arrays and required fields) before gating. Malformed candidates block.
- `SENSITIVE_OUTPUT_ABSENT` now requires a supplied normalized safe absence proof bound to the exact run; lack of proof is `INCONCLUSIVE` with `SAFE_ABSENCE_PROOF_MISSING`.
- Bounded input validation now fail-closes invalid terminal, requirement, task/safety/type and side-effect enums as well as trace/path/usage structure.
- Exact negatives FX-NEG-001..032 each assert a literal final status and literal expected blocker/assertion evidence; optional missing cost/token evidence remains explicitly `PASS` with `SD7-C` `NOT_EVALUATED` as Part A requires.
- Atomic observation isolation is now extracted from a real evaluator decision and tested through detached evaluator-output normalization for all 24 canonical atomic IDs.
- A/B result from actual S09 runtime candidates: baseline `0/192`, Skill `192/192`, delta `+192`; SD-001..008 qualify. Per dimension, atomic A/B/C contribution counts are `8/8/8`, denominator `24`, maximum share `1/3`; no regression.
- HI-001..049 and all eight unsafe counters are computed by the comparison audit from the arm inputs, actual candidates and deterministic evaluator results; HI-050 remains false/pending.
- Repair QA: Node 24.19.0 typecheck PASS; focused 41/41; full pre-build 1040/1040; dist absent before build; build PASS; full post-build 1040/1040.
