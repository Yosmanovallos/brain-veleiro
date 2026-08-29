# S13M material-evidence repair — independent verification required

Handoff ID: `2026-08-29T221651Z-S13M-codex-material-evidence-repair`

Status: `INDEPENDENT_VERIFICATION_REQUIRED`

Implementation target: `de6f2b4aa3631d25261b45b29f839651add101a0` on `main`.

Part A remains unchanged from `3458df7171f8fb1bce5c921986d738faaeab8561`:

- Skill: `c88a056a3f00da2640c93a07058f9f657370dc9373b6d488da7434ade6da52a9`
- Quality Contract: `23ee9cd62a6e65789cd1ada479941240470470f816cf16d79ce1f75b3548b5b9`
- Spec: `c32877152e08e90fd46b0b152133571927a7d2f6b41460382cfe7d856a6f1ce4`

This bounded mechanical repair resolves control-plane FAIL comment `5464875903`. All material input
evidence refs used for incident, environment, reproduction, root cause, experiments, regression, suites
or security must resolve to supplied evidence records. Missing material evidence returns
`REQUIRED_EVIDENCE_UNAVAILABLE` and `BLOCKED`. Resolving hypothesis contradictions remain visible, block
`PROVEN`/`FIX_VERIFIED`, and select `RESOLVE_CONTRADICTION`; unresolved contradiction refs fail closed.
`CONTRADICTS_CAUSE` experiments can disprove only when their evidence resolves.

HI-016, HI-039 and HI-043 now verify actual material contradictions/evidence rather than derived
tautologies. The focused adversarials exercise missing regression evidence, missing supporting evidence,
resolving hypothesis contradiction, unresolved causal contradiction and unresolved relationship
contradiction evidence.

OI-A was recalculated through the current S12→S10→S09 path: baseline `16/248`, Skill `248/248`, delta
`+232`, ten qualified dimensions; baseline/Skill HI `240/400 → 400/400`; eight Skill unsafe counters
zero. Builder evidence on WSL nvm Node `v24.19.0` / npm `11.17.0`: typecheck PASS; focused `11/11`;
full pre-build `995/995`; genuine dist-absent build PASS with prior ignored `dist` preserved/restored;
full post-build `995/995`; 8/8 positives; 36 exact negatives; 30/30 isolation; diff-check PASS.

This is builder evidence, not acceptance. S13M remains `IN_PROGRESS`; S13N remains `NOT_STARTED` and
forbidden. No Part A, Core, provider, dependency, AgentDefinition, capability or S13N+ work is
authorized by this handoff.
