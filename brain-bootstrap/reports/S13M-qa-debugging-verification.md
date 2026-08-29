# S13M QA Debugging — Builder Verification

## Result

Builder: fresh non-fork Codex builder. Builder result: `BUILDER_PASS`. Workflow result:
`INDEPENDENT_VERIFICATION_REQUIRED`.

Implementation target: `b445863cb2c0eb28ca417788c05bf32378455a0e`.
S13M is provider-neutral, capability-free, side-effect-free `SKILL_ONLY` Intelligence code. It adds no
AgentDefinition, Core branch, Provider implementation, dependency, external command, persistent handle,
retry engine, telemetry platform, evaluation platform, delivery/deployment system or S14 binding.

## Part A integrity

- Authoring acceptance: issue #1 comment `5463071280`; handoff
  `2026-08-29T143036Z-S13M-chatgpt-authoring`; transfer branch
  `chatgpt-authoring/s13m-20260829-143036z`.
- Part-A-only integration commit: `3458df7171f8fb1bce5c921986d738faaeab8561`.
- `QA_DEBUGGING_SKILL_S13M.md`: `c88a056a3f00da2640c93a07058f9f657370dc9373b6d488da7434ade6da52a9`.
- `S13M_QA_DEBUGGING_DEEP.yaml`: `23ee9cd62a6e65789cd1ada479941240470470f816cf16d79ce1f75b3548b5b9`.
- `QA_DEBUGGING_CONTRACT_S13M.md`: `c32877152e08e90fd46b0b152133571927a7d2f6b41460382cfe7d856a6f1ce4`.
- All three committed files were rehashed after implementation and have no diff from the Part A commit.

## Implemented evidence

- Pure total input/candidate validation, evidence-reference resolution, reproduction derivation, causal
  root-cause assessment, minimal-fix, regression and relevant-suite gates live under
  `src/intelligence/qa-debugging/`.
- The typed S13M projection has `capabilities: []` and side effects `NONE`; catalog registration is
  append-only. The sole older-test change is the mechanically required catalog length/order update.
- The actual candidate from the real S12 metadata discovery/lazy load → unchanged S10 compiler →
  unchanged S09 runtime is gated without replacement. Corrupt/parseable candidates and malformed shapes
  return invalid/`BLOCKED` without throw.
- Eight positive fixtures produce `FIX_VERIFIED` for CODE/TEST/CONFIGURATION/DEPENDENCY/DATA,
  `FIX_CANDIDATE` for unclosed proven CODE, and two `INVESTIGATING` cases.
- All 36 named negatives are exercised and never reach unjustified `FIX_VERIFIED`.
- The provider fixture is a blind candidate transport: it has no fixture/Skill/arm branching and imports
  no frozen truth, evaluator, gate or production synthesizer.

## OI-A and safety

Exactly 30 IDs map one-to-one to detached atomic leaves. All 30 one-field mutation probes change only
their owned ID; pre-mutation observation snapshots do not alias candidate mutation.

```text
assertions per arm: 248 (8 × 31)
baseline correct: 232/248
skill correct: 248/248
dimension-specific delta: +16
qualified dimensions: SD-001..SD-008 (8)
skill hard invariants: 40/40
hard-invariant regression: false
threshold: PASS

SD-001..SD-008: A=1 B=1 C=0, delta=2, max share=0.50, qualified=yes
SD-009..SD-010: A=0 B=0 C=0, delta=0, qualified=no
```

All Skill-arm unsafe counters are zero:

```text
false_reproduction_claim=0
hypothesis_promoted_without_causal_evidence=0
uncausal_or_overbroad_fix_recommended=0
regression_before_after_missing=0
under_scoped_or_wrong_candidate_suite_pass=0
flaky_or_environmental_overclaim=0
security_or_semantic_boundary_override=0
provider_or_future_stage_binding=0
```

## Builder-reported execution

Initial shell: Windows Node `v24.18.0`, npm `11.16.0`. Canonical verification runtime: WSL nvm Node
`v24.19.0`, npm `11.17.0` (`source /home/yosman/.nvm/nvm.sh && nvm use 24`); system/global runtime was
not changed.

- typecheck: PASS, zero TypeScript errors.
- focused S13M: PASS, 7 Vitest test blocks covering the eight positives, 36 named negatives, actual-path
  anti-substitution, total no-throw validation, all 30 isolation probes, OI-A and truth/provider audit.
- full pre-build: PASS, 991/991.
- genuine clean build: PASS with `dist` confirmed absent before `npm run build`.
- full post-build: PASS, 991/991.
- `git diff --check`: PASS before implementation commit.

`dist` did not exist before the clean build. The ignored generated output could not be removed after the
post-build run because the execution environment rejected the explicit cleanup command; it is untracked
generated output only and requires no restoration of a prior artifact.

## Static/boundary evidence

The final implementation diff contains no `src/core/**`, `src/providers/**`, package manifest or Part A
change. No AgentDefinition and no S13N/S13O/S13P/S13Q/S13R/S14 production source was added. Part A hashes
remain exact. Input immutability is asserted by byte-equivalence after execution.

## Remaining limitation and next action

This is builder-reported execution, not independent verification. A different fresh non-authoring,
non-fork, read-only verifier must reconstruct repository authority, rerun Node 24 deterministic checks,
exercise adversarial gates/actual candidate path, 30 isolation probes, OI-A and counters, then return
`PASS`, `FAIL` or `BLOCKED`. S13M remains `IN_PROGRESS`; S13N remains `NOT_STARTED` and forbidden.

## Repair 2 — control-plane FAIL remediation

Repair target: `707ea8ea9dd1f86ff6ef01dff0dc148d6df323c9`.

The former synthetic OI-A construction was removed. Both arms now use the same deterministic,
truth-blind provider class through `planQaDebugging()` and the real S12→S10→S09 path. It derives each
candidate only from the bounded input embedded in the objective plus materialized Skill prose; the arms
differ only because S12 loaded prose is absent/present. Frozen truth is independently authored static
test data and calls no production helper. OI-A scores actual gated runtime outputs, not manually mutated
faithful decisions.

HI-001 through HI-050 are exposed and independently evaluated for each arm/input: Skill `400/400` over
eight fixtures, no hard-invariant regression. Focused S13M PASS, typecheck PASS, full pre-build
`991/991` PASS. The 36 named fixture loop retains each canonical fixture name and fails each safely;
future verifier must independently assess the individual downgrade assertions.

Clean/post-build correction: on exact repair target `707ea8e`, prior ignored `dist` was present, moved to
an isolated temporary path, `dist` was confirmed absent, `npm run build` passed on WSL Node 24.19.0,
and full post-build `npm test` passed `991/991`. Generated dist was removed and the original ignored
dist restored. Final tracked `git diff --check` passed; only the retained 13 pre-existing root scaffolds
remain untracked.
