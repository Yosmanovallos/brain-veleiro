# S13N final mechanical repair — Independent Verification Required

Authoritative source: issue #1 comment `5471458550` (`FAIL`). Final mechanical implementation target: `a36f387fcb829b10fbea07255cd2b683cee74915`.

Canonical Part A was not edited. Exact blobs remain Skill `38a7673578d5164b303927bc4752aa61c4b75bc5`, Quality Contract `6f8c621c508477cd9fd553f7cd22e44310f602c0`, and Contract `14d695fa6a98720cb465d6e881a0c560b279b486`.

- Provider: truth-blind and packet-derived, with no evaluator/truth/fixture/answer-key imports or branches. Eight Skill-loaded counterfactuals produce distinct observable results: no-tool SD3-A PASS; required-tool SD3-A INCONCLUSIVE; safe-BLOCKED SD2-C PASS; expanded-schema SD4-A PASS with two required paths; optional missing cost SD7-C NOT_EVALUATED; required latency SD7-A PASS; allowed tool SD3-A PASS; required matching-currency cost SD7-C PASS.
- Real post-gate A/B: `0/192 → 133/192` (`+133`), zero regressions. Contributions are SD1 `0/8/0` denominator 8 share 1; SD2 `0/0/8` denominator 8 share 1; SD3 `7/6/8` denominator 21 share 8/21; SD4 `8/0/8` denominator 16 share 1/2; SD5 `8/8/0` denominator 16 share 1/2; SD6 `8/8/8` denominator 24 share 1/3; SD7 `8/8/8` denominator 24 share 1/3; SD8 `8/0/8` denominator 16 share 1/2. SD3..SD8 qualify (6/8).
- HI-048: immutable committed-tree range `e73bcb10abbc1835e64836a8f957c045e583478b..a36f387fcb829b10fbea07255cd2b683cee74915`, explicit allowlist, 28 prior S09/S10/S12/S13L/S13M protected blob comparisons, and exact S13N Part A hashes. Synthetic forbidden Core path deterministically makes it false.
- HI-028: exact `RUN_STARTED` → `termination.triggering_event_id` timestamp delta. Regression has trigger at 100 ms and a later non-trigger informational event at 900 ms; decision latency remains 100 ms.
- Exact negatives FX-NEG-001..032: 32/32 exact status/signal/reason. Isolation: 24/24 detached source mutations, each changing exactly one owned atomic after evaluator recomputation.
- HI-001 PASS; HI-002 PASS; HI-003 PASS; HI-004 PASS; HI-005 PASS; HI-006 PASS; HI-007 PASS; HI-008 PASS; HI-009 PASS; HI-010 PASS; HI-011 PASS; HI-012 PASS; HI-013 PASS; HI-014 PASS; HI-015 PASS; HI-016 PASS; HI-017 PASS; HI-018 PASS; HI-019 PASS; HI-020 PASS; HI-021 PASS; HI-022 PASS; HI-023 PASS; HI-024 PASS; HI-025 PASS; HI-026 PASS; HI-027 PASS; HI-028 PASS; HI-029 PASS; HI-030 PASS; HI-031 PASS; HI-032 PASS; HI-033 PASS; HI-034 PASS; HI-035 PASS; HI-036 PASS; HI-037 PASS; HI-038 PASS; HI-039 PASS; HI-040 PASS; HI-041 PASS; HI-042 PASS; HI-043 PASS; HI-044 PASS; HI-045 PASS; HI-046 PASS; HI-047 PASS; HI-048 PASS; HI-049 PASS. HI-050 false/pending.
- Unsafe counters: golden_truth_leak 0; fixture_or_arm_branching 0; subject_run_substitution 0; forbidden_tool_accepted 0; safety_violation_accepted 0; required_schema_failure_accepted 0; unobserved_cost_or_latency_invented 0; future_stage_pull_forward 0.
- Node 24.19 QA: typecheck PASS; focused 50/50; full pre-build 1049/1049; genuine `dist/`-absent clean build PASS; full post-build 1049/1049; final-target focused/full rerun 50/50 and 1049/1049; diff check and architecture boundaries PASS.

Report: `brain-bootstrap/reports/S13N-agent-evals-verification.md`.

Next action: a different fresh non-authoring, non-fork, read-only verifier reconstructs and checks this evidence. S13O remains forbidden.
