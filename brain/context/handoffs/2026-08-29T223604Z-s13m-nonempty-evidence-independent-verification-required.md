# S13M non-empty closure-evidence repair — independent verification required

Handoff ID: `2026-08-29T223604Z-S13M-codex-nonempty-evidence-repair`

Status: `INDEPENDENT_VERIFICATION_REQUIRED`

Implementation target: `891fd1994f3ff416f476f2761d4c7657c08fc68e` on `main`.

Part A remains unchanged from `3458df7171f8fb1bce5c921986d738faaeab8561`:

- Skill: `c88a056a3f00da2640c93a07058f9f657370dc9373b6d488da7434ade6da52a9`
- Quality Contract: `23ee9cd62a6e65789cd1ada479941240470470f816cf16d79ce1f75b3548b5b9`
- Spec: `c32877152e08e90fd46b0b152133571927a7d2f6b41460382cfe7d856a6f1ce4`

This bounded mechanical repair resolves control-plane FAIL comment `5465213263`. A closure-supporting
reference collection is now valid only when it is non-empty and every reference resolves to an input
evidence record. This applies to reproduction attempts, causal `SUPPORTS_CAUSE` and
`CONTRADICTS_CAUSE` experiments, regression evidence, and suite results. Empty arrays cannot establish
`REPRODUCED`, `PROVEN`, `DISPROVEN`, regression PASS, suite PASS, or `FIX_VERIFIED`; each case downgrades
through its existing owning gate.

HI-005, HI-013, HI-016, HI-022, HI-023, HI-027, HI-039 and HI-043 now cover evidence presence as well as
resolution. Focused adversarials prove the safe downgrade for empty reproduction, SUPPORTS_CAUSE,
CONTRADICTS_CAUSE, regression, and suite evidence arrays. The existing 36 canonical negatives and 30/30
observation isolation remain unchanged and passing.

OI-A was recalculated through the current S12→S10→S09 path: baseline `16/248`, Skill `248/248`, delta
`+232`, ten qualified dimensions; baseline/Skill HI `240/400 → 400/400`; eight Skill unsafe counters
zero. Builder evidence on WSL nvm Node `v24.19.0` / npm `11.17.0`: typecheck PASS; focused `12/12`;
full pre-build `996/996`; genuine dist-absent build PASS with prior ignored `dist` preserved/restored;
full post-build `996/996`; 8/8 positives; 36 exact negatives; 30/30 isolation; diff-check PASS.

This is builder evidence, not acceptance. S13M remains `IN_PROGRESS`; S13N remains `NOT_STARTED` and
forbidden. No Part A, Core, provider, dependency, AgentDefinition, capability or S13N+ work is
authorized by this handoff.
