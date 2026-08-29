# S13M suite/environment/meta-invariant repair

Handoff ID: `2026-08-29T230336Z-S13M-codex-suite-environment-meta-repair`

Status: `INDEPENDENT_VERIFICATION_REQUIRED`

Implementation target: `88d5ac53977db2af8382e70c1da7106848cf2ffa` on `main`.

Part A remains byte-identical to `3458df7171f8fb1bce5c921986d738faaeab8561`.

This mechanical repair accepts required suite `NOT_APPLICABLE` only with explicit reason plus non-empty resolving evidence; otherwise it fails closed. Configuration/environment candidates require an explicit before/after delta before closure. FX-POS-003 supplies that delta; FX-NEG-028 hides it and downgrades safely.

HI-046..050 no longer self-certify. Provider-blindness, 30/30 detached isolation and same-path are explicit harness evidence; unsafe-zero is recomputed; fresh-independent-verifier remains false until a different verifier passes. Recomputed builder OI-A: `16/248 → 248/248` (+232); HI: `232/400 → 368/400`; eight Skill unsafe counters zero. WSL Node `v24.19.0` / npm `11.17.0`: typecheck PASS, focused `14/14`, full `998/998`, build PASS.

Builder evidence only. S13M remains `IN_PROGRESS`; do not launch S13N or S13N+ work.
