# S13M independent verification required

Handoff ID: `2026-08-29T153200Z-S13M-codex-builder`

Status: `INDEPENDENT_VERIFICATION_REQUIRED`

Repository truth: branch `main`; Part A integration commit
`3458df7171f8fb1bce5c921986d738faaeab8561`; implementation target
`b445863cb2c0eb28ca417788c05bf32378455a0e`.

Read and hash the three canonical Part A files before assessment. Required hashes are recorded in
`brain-bootstrap/reports/S13M-qa-debugging-verification.md`.

Builder execution used WSL nvm Node `v24.19.0` / npm `11.17.0`: typecheck PASS; focused S13M PASS;
full pre-build 991/991; dist-absent build PASS; full post-build 991/991. Treat these as builder claims,
not independent evidence.

Verifier scope is read-only and limited to reconstruction, boundary inspection, Node 24 checks, positive
and named-negative adversarial gates, real S12→S10→S09 actual-candidate anti-substitution, exactly
30 detached isolation probes, OI-A/counter recomputation, and status `PASS|FAIL|BLOCKED`.

Do not edit implementation, do not start S13N, and do not turn `FIX_VERIFIED` into bootstrap PASS.
