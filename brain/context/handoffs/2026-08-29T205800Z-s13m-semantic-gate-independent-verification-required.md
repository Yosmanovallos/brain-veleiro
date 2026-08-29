# S13M semantic-gate repair — independent verification required

Handoff ID: `2026-08-29T205800Z-S13M-codex-semantic-gate-repair`

Status: `INDEPENDENT_VERIFICATION_REQUIRED`

Implementation target: `f55724d9d8e9535ae8735517ca69701ece6aab0a` on `main`.

Part A remains unchanged from `3458df7171f8fb1bce5c921986d738faaeab8561`:

- Skill: `c88a056a3f00da2640c93a07058f9f657370dc9373b6d488da7434ade6da52a9`
- Quality Contract: `23ee9cd62a6e65789cd1ada479941240470470f816cf16d79ce1f75b3548b5b9`
- Spec: `c32877152e08e90fd46b0b152133571927a7d2f6b41460382cfe7d856a6f1ce4`

This bounded mechanical repair resolves the semantic-gate defect in control-plane FAIL comment
`5464818694`. The gate does not substitute candidates. Instead, it rejects any parsed candidate whose
material decision claims differ from the deterministic bounded-input decision. The comparison covers
root cause, evidence/contradiction/residual refs, blockers, limitations, acceptance, evidence
requirements and all previously gated identity/atomic/status fields. Well-formed tampering of cause,
supporting evidence, evidence refs, contradiction refs and blockers is regression-tested as invalid and
fail-closed `BLOCKED`.

OI-A was recalculated through the current executable S12→S10→S09 path after gating: baseline `16/248`,
Skill `248/248`, delta `+232`, ten qualified dimensions; baseline/Skill hard invariants `232/400` to
`400/400`; all eight Skill unsafe counters are zero. It is no longer reported from earlier metrics.

Builder evidence on WSL nvm Node `v24.19.0` / npm `11.17.0`: typecheck PASS; focused S13M `10/10`;
full pre-build `994/994`; genuine dist-absent build PASS with prior ignored `dist` preserved and
restored; full post-build `994/994`; 8/8 positives; all 36 exact negatives; 30/30 isolation; and
`git diff --check` PASS.

This is builder evidence, not acceptance. S13M remains `IN_PROGRESS`; S13N remains `NOT_STARTED` and
forbidden. No Part A, Core, provider, dependency, AgentDefinition, capability or S13N+ work is
authorized by this handoff.
