# S14D Git Capability Control Plane Source Audit

Status: REMEDIATED CANDIDATE READY FOR FRESH INDEPENDENT VERIFICATION  
Date: 2026-09-08  
Builder candidate audited: `b7f9dc943d9b30a64cfc4db646f56ccc89e34bf8`  
Remediation code commit: `5af960c6fd4ae1c977deca3e2fa01d85f28f3d87`

This report records the control-plane source audit requested after the S14D builder handoff. It is not the fresh independent-verifier relay, does not close S14D or S14, does not award HI-054 and does not authorize S14E.

## 1. Baseline and candidate integrity

- Remote `main` at audit start: `b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7`.
- Builder candidate parent: exact remote `main` SHA above.
- Builder candidate distance: one commit ahead, zero behind.
- Builder candidate surface: 17 additions, 4,276 insertions, zero modifications and zero deletions relative to the baseline.
- Canonical Part A artifacts are present on the baseline and were not modified by the builder candidate.
- The audit used a detached WSL worktree at the exact candidate SHA and Node.js 24.19.0.

## 2. Source audit findings

### Finding CP-S14D-001 Root symlink accepted contrary to repository shape contract

Severity: BLOCKER before remediation.

`WorkspaceGitCapabilityProvider.create()` called `realpath(repository_root)` before checking the configured path itself. A configured symlink to a valid repository was therefore accepted even though contract section 7.1 requires the root and `.git` to be non-symlinks.

Independent reproduction against the builder candidate printed `ROOT_SYMLINK_ACCEPTED` after constructing the provider with a symlinked `repository_root`.

Remediation:

- `lstat(repository_root)` now runs before `realpath()`.
- A symlink or non-directory configured root fails closed.
- A regression test constructs a real disposable repository plus a configured root symlink and requires provider construction to reject it.

### Finding CP-S14D-002 Cleanup exceeded the invocation-wide effective deadline

Severity: BLOCKER before remediation.

Contract section 6.4 states that version probes, repository subprocesses and cleanup consume one effective deadline. The builder implementation armed the subprocess timeout for the entire remaining deadline and only then added up to 500 ms termination grace plus 4,000 ms liveness polling. The committed test comment explicitly described waiting for grace beyond the deadline.

Remediation:

- The process runner establishes one hard deadline from the remaining invocation budget.
- It reserves a bounded portion of that budget for TERM, grace, KILL and liveness polling.
- Small budgets divide available time between execution and cleanup; larger budgets reserve at most the canonical 4,500 ms cleanup ceiling.
- The cleanup deadline is capped by the invocation hard deadline.
- The regression test now detects the former additive-deadline behavior while preserving the same-group descendant cleanup proof.

## 3. Remediation scope

Modified production files:

- `src/providers/capability/git/workspaceGitCapabilityProvider.ts`
- `src/providers/capability/git/process.ts`

Modified tests:

- `tests/git-capability/regressions.test.ts`
- `tests/git-capability/processExercises.ts`

No Core, AgentDefinition, registry, filesystem, shell, package manifest, canonical Part A, continuity-state or S14E+ production surface was changed.

## 4. Verification results

Environment:

- Linux WSL2
- Node.js 24.19.0
- npm 11.17.0
- Git 2.53.0

Results at remediation code commit `5af960c6fd4ae1c977deca3e2fa01d85f28f3d87`:

- `npm ci`: PASS, zero vulnerabilities.
- `npm run typecheck`: PASS.
- Focused `tests/git-capability/**`: PASS, 4 files and 126 tests.
- `npm run build`: PASS; expected ignored `dist/` output produced.
- Full `npm test`: 1,904 PASS and 8 FAIL across 1,912 tests.

The eight full-suite failures are the exact previously documented S14C regression-harness failures. They remain confined to:

- `tests/shell-capability/regressions.test.ts`
- `tests/shell-capability/unsafeCounters.test.ts`
- `tests/shell-capability/shellCapability.test.ts`

Their shared cause remains drift of `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` from the S14C harness's pinned continuity baseline. S14D production or test changes do not appear in any failure. The S14D regression audit continues to reproduce and classify this cause mechanically.

## 5. Control plane decision

The original builder candidate `b7f9dc943d9b30a64cfc4db646f56ccc89e34bf8` is rejected as an integration target because CP-S14D-001 and CP-S14D-002 violated canonical contract requirements.

The remediated candidate is suitable for the next gate because both blockers have code fixes and regression coverage, the focused suite passes, typecheck/build pass, and the full-suite delta is exactly one additional passing S14D regression test with the inherited eight S14C failures unchanged.

## 6. Required next gate

A fresh, non-authoring, non-builder, non-fork, read-only independent verifier must inspect the exact committed remediation candidate and issue a standalone relay. Only a separate control-plane acceptance may then integrate S14D and update continuity state.

Until that happens:

- S14D remains in progress and not closed.
- S14 remains in progress.
- HI-054 remains not awarded.
- S14E remains not authorized.
