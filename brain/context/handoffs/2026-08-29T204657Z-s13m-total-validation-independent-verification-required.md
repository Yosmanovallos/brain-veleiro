# S13M total-validation repair — independent verification required

Handoff ID: `2026-08-29T204657Z-S13M-codex-total-validation-repair`

Status: `INDEPENDENT_VERIFICATION_REQUIRED`

Implementation target: `67ac92ec24f9959ec83d76d920c5ba21dbef8129` on `main`.

Part A remains unchanged from `3458df7171f8fb1bce5c921986d738faaeab8561`:

- Skill: `c88a056a3f00da2640c93a07058f9f657370dc9373b6d488da7434ade6da52a9`
- Quality Contract: `23ee9cd62a6e65789cd1ada479941240470470f816cf16d79ce1f75b3548b5b9`
- Spec: `c32877152e08e90fd46b0b152133571927a7d2f6b41460382cfe7d856a6f1ce4`

This is a bounded mechanical repair for the control-plane FAIL comments `5464727481` and `5464730049`.
`inputErrors()` now validates every nested `QaDebuggingInput` family before production dereferences it;
`validateQaDebuggingDecision()` now implements the §27 minimum structural checks for parsed candidates.
Adversarial regressions prove malformed nested input and parsed candidates never throw through derivation,
validation or gating and instead yield invalid/`BLOCKED` results.

Builder evidence on WSL nvm Node `v24.19.0` / npm `11.17.0`: typecheck PASS; focused S13M `10/10`;
full pre-build `994/994`; genuine dist-absent build PASS with any prior ignored `dist` preserved and
restored; full post-build `994/994`; `git diff --check` PASS. Existing real-path S12→S10→S09 OI-A
remains `232/248 → 248/248`, with 8/8 positives, 36 exact named negatives, 30/30 isolation,
HI-001..HI-050 `400/400`, and all eight unsafe counters zero.

This is builder evidence, not acceptance. S13M remains `IN_PROGRESS`; S13N remains `NOT_STARTED` and
forbidden. No Part A, Core, provider, dependency, AgentDefinition, capability, or S13N+ change is
authorized by this handoff.
