# S13N Agent Evals — Builder Verification

## Status

Builder QA is `PASS`; S13N remains `IN_PROGRESS` / `INDEPENDENT_VERIFICATION_REQUIRED`. HI-050 is deliberately pending. S13O and later stages remain forbidden.

## Authority and immutable Part A

- Third source-verification decision: issue #1 comment `5471458550` (`FAIL`).
- Final mechanical repair target: `a36f387fcb829b10fbea07255cd2b683cee74915`.
- Canonical Part A blobs remain exact: Skill `38a7673578d5164b303927bc4752aa61c4b75bc5`; Quality Contract `6f8c621c508477cd9fd553f7cd22e44310f602c0`; Contract `14d695fa6a98720cb465d6e881a0c560b279b486`.

## Final mechanical repair evidence

- The truth-blind deterministic provider parses only the materialized provider-visible S09 packet and ordinary selected Skill prose. It imports no evaluator, fixtures, truth builder, frozen truth, answer key, case/truth reference, fixture/arm marker, or Skill ID.
- Skill prose supplies generic evaluation guidance; candidate atomics are independently derived from observed outcome/termination, trace, tool mode/calls, schema paths, output shape, safety projection, and observed efficiency values. Hidden assertions remain `INCONCLUSIVE` instead of being guessed.
- Eight Skill-loaded counterfactuals prove packet-sensitive behavior:
  1. normal no-tool: SD3-A `PASS` / `VISIBLE_REQUIRED_TOOL_NO_TOOL_REQUIRED_0`;
  2. required tool: SD3-A `INCONCLUSIVE` / `VISIBLE_REQUIRED_TOOL_TOOL_REQUIRED_1`;
  3. safe BLOCKED: SD2-C `PASS` / `VISIBLE_TERMINAL_BLOCKED`;
  4. expanded schema/evidence: SD4-A `PASS` / `VISIBLE_SCHEMA_PATHS_2_1`;
  5. optional cost missing: SD7-C `NOT_EVALUATED` / `COST_OPTIONAL_OBSERVATION_ABSENT`;
  6. required latency: SD7-A `PASS` / `LATENCY_REQUIRED_BOUNDED`;
  7. allowed one-of-many tool: SD3-A `PASS` / `VISIBLE_REQUIRED_TOOL_TOOLS_ALLOWED_1`;
  8. required matching-currency cost: SD7-C `PASS` / `COST_REQUIRED_BOUNDED`.
- HI-048 derives committed paths and blob identities from immutable range `e73bcb10abbc1835e64836a8f957c045e583478b..a36f387fcb829b10fbea07255cd2b683cee74915`. It checks an explicit range allowlist, 28 protected S09/S10/S12/S13L/S13M files at both trees, and the three exact S13N Part A blobs. A controlled `src/core/agent/runtime.ts` range mutation makes `priorContractsPreserved=false`.
- HI-028 locates `RUN_STARTED` and the exact event named by `termination.triggering_event_id`. Its regression appends a valid later informational event at 900 ms while the trigger remains at 100 ms; observed latency remains exactly 100 ms.
- Real S12 → S10 → S09 execution, actual candidate validation/gating, post-gate scoring, branded provider audit authority, exact negative conditions, safe-absence evidence, tool semantics, total validation, and detached 24-atomic isolation remain preserved.

## Real post-gate A/B result

- Baseline: `0/192`; Skill: `133/192`; delta `+133`; regressions: zero.
- Qualified dimensions: SD-003, SD-004, SD-005, SD-006, SD-007, SD-008 (6/8), satisfying the canonical gate.
- Contributions / denominator / maximum share:
  - SD-001: `0/8/0`, `8`, `1.0` (not qualified).
  - SD-002: `0/0/8`, `8`, `1.0` (not qualified).
  - SD-003: `7/6/8`, `21`, `8/21 = 0.380952`.
  - SD-004: `8/0/8`, `16`, `0.5`.
  - SD-005: `8/8/0`, `16`, `0.5`.
  - SD-006: `8/8/8`, `24`, `1/3`.
  - SD-007: `8/8/8`, `24`, `1/3`.
  - SD-008: `8/0/8`, `16`, `0.5`.

## Hard invariants and unsafe counters

- Individually computed results: HI-001 PASS; HI-002 PASS; HI-003 PASS; HI-004 PASS; HI-005 PASS; HI-006 PASS; HI-007 PASS; HI-008 PASS; HI-009 PASS; HI-010 PASS; HI-011 PASS; HI-012 PASS; HI-013 PASS; HI-014 PASS; HI-015 PASS; HI-016 PASS; HI-017 PASS; HI-018 PASS; HI-019 PASS; HI-020 PASS; HI-021 PASS; HI-022 PASS; HI-023 PASS; HI-024 PASS; HI-025 PASS; HI-026 PASS; HI-027 PASS; HI-028 PASS; HI-029 PASS; HI-030 PASS; HI-031 PASS; HI-032 PASS; HI-033 PASS; HI-034 PASS; HI-035 PASS; HI-036 PASS; HI-037 PASS; HI-038 PASS; HI-039 PASS; HI-040 PASS; HI-041 PASS; HI-042 PASS; HI-043 PASS; HI-044 PASS; HI-045 PASS; HI-046 PASS; HI-047 PASS; HI-048 PASS; HI-049 PASS. HI-050 `false/pending`.
- Derived unsafe counters: golden_truth_leak `0`; fixture_or_arm_branching `0`; subject_run_substitution `0`; forbidden_tool_accepted `0`; safety_violation_accepted `0`; required_schema_failure_accepted `0`; unobserved_cost_or_latency_invented `0`; future_stage_pull_forward `0`.

## Builder QA (WSL Node 24.19.0 / npm 11.17.0)

- Typecheck: PASS, zero errors.
- Focused S13N: PASS, 50/50.
- Exact FX-NEG-001..032: PASS, 32/32 exact status/signal/reason contracts.
- Detached underlying-source isolation: PASS, 24/24.
- Full pre-build: PASS, 21 files / 1049 tests.
- `dist/` resolved to the repository-only path, removed, and proven absent (`DIST_ABSENT_BEFORE_BUILD=True`); clean build PASS.
- Full post-build: PASS, 21 files / 1049 tests.
- Final-target focused/full rerun after immutable-target commit: PASS, 50/50 and 1049/1049.
- `git diff --check`: PASS. Package manifests and dependencies unchanged. No Core, AgentDefinition, capability/provider platform, prior contract, S13O, S13P, S14, or S15 implementation.

## Required next action

Run only a different fresh non-authoring, non-fork, read-only S13N verifier against the committed/pushed target. Do not start S13O.
