# S14C Shell Capability — Round 2 Builder Verification

Status: S14C ROUND2 BUILDER PASS AWAITING CONTROL-PLANE SOURCE AUDIT / INDEPENDENT VERIFICATION
S14C: ROUND2_BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT
S14: IN_PROGRESS / NOT_CLOSED
HI-054: NOT_AWARDED
S14D: NOT_AUTHORIZED

This report is factual builder evidence for the exact Round-2 S14C candidate on
branch `s14c-shell-capability-part-b-round2`. It does not claim independent-verifier
acceptance, phase closure, S14 completion, the HI-054 honor, or S14D authorization.

## 1. Lineage and control-plane authority

| Event | Reference |
| --- | --- |
| S14C Part A authoring | Issue #1 comment `5555687848` |
| Original Part B authorization | Issue #1 comment `5555785836` |
| Round-1 candidate published | `25068c4351730b4de02b950065c614f9be68568f` on branch `s14c-shell-capability-part-b` |
| Round-1 builder QA | Prior report on the Round-1 branch: BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT |
| Round-1 source-audit FAIL + Round-2 remediation authorization | Issue #1 comment `5556004891` |

The Round-1 source-audit FAIL is preserved, not erased. Round-1 candidate
`25068c…` remains on branch `s14c-shell-capability-part-b` (local and `origin`),
unmoved. `git merge-base --is-ancestor 25068c… HEAD` = **false**: the rejected
candidate is **not** in Round-2 ancestry. Round 2 is a strictly linear descendant
of exact `main` `3cd344d018dbf2d40a39a907a3494bba8f3d940b`.

```text
3cd344d
   ├── 25068c   [ROUND 1 — control-plane SOURCE-AUDIT FAIL, comment 5556004891]
   └── <Round-2 candidate>   (this report)
```

## 2. Why Round 1 failed source audit (three blockers) and how Round 2 fixes each

### Blocker A — process-group escalation could end too early

Round-1 `runProcessGroup()` armed a SIGKILL after SIGTERM but its group-leader
`close` handler immediately resolved the TIMEOUT / OUTPUT_OVERFLOW outcome and
cleared all timers. A same-process-group descendant that installed a SIGTERM
handler and refused to exit could therefore survive if the leader exited first.

**Round-2 fix** (`src/providers/capability/shell/execution.ts`): once
provider-induced termination begins, an escalation lifecycle owns resolution and
the leader's `close` event can no longer cancel it. The lifecycle is:
mark reason → stop accepting output → `SIGTERM` the provider-created process
group → after `terminationGraceMs` (500 ms), if `process.kill(-pgid, 0)` shows
the group still alive, `SIGKILL` the group → then poll `-pgid` liveness every
25 ms until the group is gone (`ESRCH`) or the bounded `groupCleanupBudgetMs`
(4000 ms) is exhausted → only then resolve `TIMEOUT` / `OUTPUT_OVERFLOW`. The
leader's `close` during termination only takes a fast path when the *entire*
group is already gone. `EPERM` from the liveness probe is treated as "still
alive"; `ESRCH` as "gone". No raw OS error is surfaced. Truncated SUCCESS is
never returned for these outcomes.

Proof: `stubbornGrandchildTimeout` / `stubbornGrandchildOverflow`
(`processExercises.ts`, wired into `S14C-HI-028` / `S14C-HI-029`). A real fixture
outside the repo spawns an ordinary same-group grandchild that installs
`process.on("SIGTERM", () => {})`, records its PID, and never calls `setsid()` /
detaches; the leader has no SIGTERM handler and dies first. After the provider
returns `FAIL / TIMEOUT` (resp. `FAIL / EXECUTION_FAILED`), `process.kill(gcPid, 0)`
throws `ESRCH` (polled up to 5 s) and a later legitimate invocation still
succeeds. Teeth: reverting the `close` handler to the Round-1 behavior makes both
regressions fail.

### Blocker B — the effective timeout was restarted at spawn

Round-1 pre-spawn async validation consumed time that was not charged: the child
runtime received a fresh `min(request.timeout_ms, profile.max_timeout_ms)` timer.

**Round-2 fix** (`src/providers/capability/shell/workspaceShellCapabilityProvider.ts`):
one invocation-wide effective deadline. `Deadline.start` is captured at invocation
entry, before the profile is known, and is never reset. `Deadline.tighten()`
lowers the budget to `min(request.timeout_ms, profile.max_timeout_ms)` once the
profile is selected and can only shrink it. Every step — logical cwd validation,
the cwd directory-handle chain, the containment recheck, the executable identity
recheck, the final pre-spawn check — draws from that same remaining time. Right
before spawn, synchronously, `remainingMs = deadline.remaining()`; if
`deadline.check()` finds `remaining() <= 0` the invocation is `FAIL / TIMEOUT`
with **no spawn**. When a child is spawned, `runProcessGroup` receives
`Math.max(1, remainingMs)` — the *remaining* budget, not the original maximum.
The final pre-spawn window is unchanged: `containment recheck → executable
identity recheck → synchronous deadline check → synchronous `deadline.remaining()`
→ immediate `startProcessGroup``, with zero `await` / `.then` between the identity
recheck and the spawn (statically asserted by `finalSpawnGap()` /
`startGroupBodyAwaits()`).

Proof: `preSpawnTimeoutProfileSmaller` (request 5000 / profile 100),
`preSpawnTimeoutRequestSmaller` (request 100 / profile 5000) — a pre-spawn
`fs.realpath` step is made to consume the whole effective budget on a
virtualised clock; both return `FAIL / TIMEOUT` with `startProcessGroup` never
called. `remainingBudgetNotReset` — effective total 400 ms, a pre-spawn step
consumes 320 ms on the virtual clock, and a real child that needs 260 ms real
(would fit a fresh 400 ms budget, does not fit the ~80 ms remaining) still times
out. All wired into `S14C-HI-021`. Teeth: making `tighten()` a no-op and passing
a fresh `profile.max_timeout_ms` to the child makes `S14C-HI-021` fail.

### Blocker C — the repository regression suite was not fully green

Five S14B tests failed on the pristine baseline `3cd344d…` because
`tests/filesystem-capability/audit.ts` freezes `baseline = 990483118d…` and its
`protectedDifferences()` scans every tracked file from that commit, so the two
continuity files the ACCEPTED S14B phase-closure `a89deb7` intentionally rewrote
(`brain-bootstrap/STATE.yaml`, `brain/context/CURRENT.md`) were reported as
illegal drift. This is a stale regression-harness boundary, not an S14C
production defect.

**Round-2 fix** — the single authorized pre-existing-file modification
(`tests/filesystem-capability/audit.ts` only; TEST-HARNESS MAINTENANCE):
add `export const acceptedContinuityFiles = ["brain-bootstrap/STATE.yaml",
"brain/context/CURRENT.md"];` and change the `protectedDifferences()` guard from
`if (registryFiles.includes(p)) return [];` to
`if (registryFiles.includes(p) || acceptedContinuityFiles.includes(p)) return [];`.
Nothing else changes: `baseline` stays `990483118d…`, `registryFiles` stays,
`registryPatchOnly()` stays byte-identical, and every other tracked file at
`990483…` stays fully protected. After the fix the S14B focused suite is
**169 / 169 PASS**.

The narrowness is proven from inside the S14C suite
(`tests/shell-capability/audit.ts` → `s14bAuditMaintenanceExact()` /
`s14bAuditMaintenanceMechanical()`, exercised by `S14C-HI-037`, `FX-NEG-042` and
a dedicated `regressions.test.ts` case): the candidate file text is asserted
byte-equal to `3cd344d…:tests/filesystem-capability/audit.ts` transformed by
exactly those two edits; the exported `acceptedContinuityFiles` is exactly those
two paths; `registryFiles` is unchanged; the `registryPatchOnly()` source and the
frozen `990483…` SHA line are still present verbatim; `protectedDifferences()`
(S14C's own, baseline `3cd344d…`) reports no other drift.

## 3. Baseline and runtime truth

- Local `main` = `origin/main` = `git ls-remote origin refs/heads/main`
  = `3cd344d018dbf2d40a39a907a3494bba8f3d940b`.
- Rejected Round-1 branch present and unmoved:
  `s14c-shell-capability-part-b` = `25068c4351730b4de02b950065c614f9be68568f`;
  `25068c^` = `3cd344d018dbf2d40a39a907a3494bba8f3d940b`; not contained in `main`.
- Round-2 branch `s14c-shell-capability-part-b-round2` cut from that exact
  baseline in a fresh isolated WSL-native clone (`/home/yosman/brain-s14c-round2`,
  POSIX/LF, `core.autocrlf` unset, `git diff --check` clean at checkout). The
  rejected builder workspace was not reused as the authoritative build surface.
- The primary `/mnt/c` checkout was not reset, stashed, cleaned, normalized or
  committed.
- Node `v24.19.0`, npm `11.17.0` (activated explicitly; the shell-default Node 22
  was not used). `npm ci` restored packages; `package-lock.json` byte-identical
  to baseline afterwards. Vitest `4.1.11`.

## 4. Part A canonical artifacts — proven immutable at the candidate

| Artifact | Blob |
| --- | --- |
| `brain-bootstrap/skills/SHELL_CAPABILITY_SKILL_S14C.md` | `defbd27f7787a42b2a797c178f75668db65502db` |
| `brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml` | `a0b84708dc7619648321004fe18d8d429becf84b` |
| `brain-bootstrap/specs/SHELL_CAPABILITY_CONTRACT_S14C.md` | `8626698c94aae66e74cd96d654625dcb638d7a47` |

Re-checked from `HEAD:` inside the test run (`partAIntact()`). No semantic
erratum was authored; Round 2 satisfies the existing contract as written.

## 5. Exact candidate scope against baseline `3cd344d…`

`git diff --name-status 3cd344d.. HEAD`: **13 additions + exactly one authorized
modification**.

Modified (1, TEST-HARNESS MAINTENANCE only):
- `tests/filesystem-capability/audit.ts` — the Blocker-C narrow continuity
  exemption described in §2. 5 insertions, 1 deletion.

Added production tree `src/providers/capability/shell/` (3):
- `types.ts` — trusted `WorkspaceShellCommandProfile` / `WorkspaceShellConfig`.
- `execution.ts` — `startProcessGroup` (synchronous; the only statement between
  the final pre-spawn checks and `spawn`) and `runProcessGroup` (bounded capture,
  the Blocker-A escalation lifecycle). `node:child_process` only; no new
  dependency.
- `workspaceShellCapabilityProvider.ts` — the `shell.execute` provider with the
  Blocker-B one-invocation-wide `Deadline`.

Added focused test tree `tests/shell-capability/` (9):
`fixtures.ts`, `helpers.ts`, `audit.ts`, `cases.ts`, `processExercises.ts`, and
`shellCapability.test.ts`, `unsafeCounters.test.ts`,
`registryCompatibility.test.ts`, `regressions.test.ts`.

Added report (1): this file.

No `src/core/**`, `src/providers/capability/registry/**`,
`src/providers/capability/filesystem/**`, `tests/capability-registry/**`, any
**other** `tests/filesystem-capability/**` file, `package.json`,
`package-lock.json`, `tsconfig.json`, `vitest.config.ts`,
`brain-bootstrap/STATE.yaml` or `brain/context/CURRENT.md` change. S13G / S13H
tracked surfaces are untouched. `assertBoundaries()` walks every tracked file at
`3cd344d…` (excluding only the one authorized `M`), asserts each is
byte-identical, asserts every addition is under an authorized S14C path, and
asserts the modification list is exactly `["M\ttests/filesystem-capability/audit.ts"]`.

## 6. Public capability and threat-model boundary (unchanged from Round 1, re-verified)

Exactly one capability `shell.execute`, `side_effects = LOCAL` (never downgraded
per profile). Model-visible input is only `{ profile_id, cwd }`; any extra key
(`command`, `executable`, `argv`, `args`, `env`, `environment`, `stdin`, `shell`,
`provider_id`, `timeout_ms`, `host_path`) → `FAIL / INVALID_INPUT`, no spawn
(checked two ways: the `startProcessGroup` spy is never called and a
marker-writing fixture never runs). `profile_id` grammar `^[a-z0-9][a-z0-9._-]*$`,
≤ 160; malformed → `INVALID_INPUT`, well-formed-but-unregistered → `BLOCKED`.
Executable / fixed argv / explicit env are trusted provider configuration:
`spawn` is `shell: false` with no command string composed (a fixture proves shell
metacharacters in a fixed argv arrive literally and no redirection file is
created); the child env is exactly the validated profile env with no host
inheritance (a live host sentinel is proven absent from the child); dangerous
loader/runtime-injection keys and recognizable credential key names fail
`create()`. `stdin` is `["ignore", …]` (`child.stdin === null` asserted); pipes;
no TTY/PTY; no interactive/background/daemon API. Explicit absolute
`workspace_root` (`realpath` + `O_DIRECTORY | O_NOFOLLOW`; no `process.cwd()` /
host-env / git-root / scan inference — `inferredScope` scanner 0 over production
source, fireable). Provider-neutral logical `cwd` grammar rejected before spawn
for absolute / drive / UNC / backslash / NUL / `..` / internal `.` / empty
segment / over-length / too-many-segments / over-byte segment. Per-profile
`cwd_allow_prefixes` (`.` = whole tree, else prefix subtree; no implicit
root-wide). `O_NOFOLLOW` + `/proc/self/fd` directory-handle chain, `lstat`-checked
per hop and re-checked immediately before spawn; symlink component / symlink
target / traversal / regular-file cwd fail closed; missing cwd → `NOT_FOUND`;
protected credential/control cwd (`.git`, `.ssh`, `.gnupg`, `.aws`, `.azure`,
`.kube` + the S14B `.npmrc` / `.pypirc` / `.netrc` / `.env*` / `*.pem` / `*.key`
floor) fails closed even when a prefix would allow it. Executable identity is an
explicit absolute path resolved at `create()` (realpath + regular file + `X_OK`,
recorded `dev:ino`) and re-resolved (realpath + `dev:ino`) immediately before
spawn — observed drift → `FAIL / UNAVAILABLE`, no spawn. Raw output bounds 524288
/ 524288 / 1048576; exact maxima succeed and round-trip through the real registry
unchanged; `max+1` on stdout, stderr or combined → group termination →
`FAIL / EXECUTION_FAILED`, never a truncated SUCCESS. Output is raw bytes decoded
strict/fatal UTF-8 after bounded capture; invalid → `FAIL / INVALID_INPUT`.
Recognizable secret material in output → `BLOCKED`, not returned or echoed. Exact
canonical workspace root → `workspace://` and exact canonical executable path →
`<executable>` before model visibility (deterministic replacement, not a
universal classifier). Evidence is one bounded logical ref
`shell://<profile_id>@workspace/<cwd>` with no executable path / argv / env / PID
/ output body. Natural completion — any non-zero exit, or an external signal —
is a SUCCESS observation with truthful `exit_code` / `signal`. A `TIMEOUT`
result does not assert that the child performed no local mutation; the capability
stays `LOCAL` because there is no rollback layer, and the result never states
that earlier child side effects were undone.

## 7. Composition (unchanged from Round 1, re-verified)

`WorkspaceShellCapabilityProvider → CapabilityRegistryProvider →
RestrictedCapabilityProvider → compileAgentDefinition → runAgent`. The registry
routes `shell.execute` with no shell-specific branch, one diagnostic, and a
composed result byte-equal to the direct call. Capability denial and `LOCAL`
side-effect denial each yield `BLOCKED` with the provider's `invoke` never called
and no process spawned. A real `runAgent` run issues a `shell.execute` TOOL_CALL
through the full composition and finishes SUCCESS with the observation and
`shell://qa.ok@workspace/.` evidence. Provider/profile swap: two configs with
different executables and different fixed argv behind the same `profile_id` and
cwd both run through the canonical composition while `JSON.stringify(definition)`
is byte-identical before and after. A real 1 MiB combined result — including a
worst-case control-character payload that expands ≈ 6× under JSON escaping —
passes the accepted `8388608`-character `ToolInvocationResult` envelope
untruncated; a `max+1` raw output fails in the provider before any oversized
result is composed. The descriptor / public-contract `canonical()` path (100000)
is unchanged.

## 8. Trusted-profile / no-OS-sandbox limitation (documented without overclaiming)

S14C v1 constrains the untrusted model to pre-authorized LOCAL_ONLY profiles. It
does not inspect an arbitrary configured executable and prove it is network-free,
filesystem-safe or non-malicious. There is no OS-level network isolation and no
universal filesystem sandbox around the child. A deliberately daemonizing program
that starts its own session (`setsid()`) leaves the provider-created process
group and is outside the accepted profile threat model — Round-2's stubborn
descendant is the *in-group* case, which IS cleaned; the *out-of-group*
daemon-escape case is the accepted residual. No OS container, anti-daemon sandbox
or network isolation is claimed. Node's authorized path exposes no atomic
`fexecve`-style primitive; a non-cooperating host actor that replaces the
executable or mutates cwd / directory / mount topology strictly inside the
irreducible final kernel spawn window can still win it — disclosed, not presented
as a passing property, and asserted absent as an affirmative "race-free"
claim. The `shellFutureSurface` scanner (which, unlike the S14B `futureSurface`
scanner, deliberately **permits** `node:child_process` as the authorized
mechanism and forbids `shell: true`, `/bin/sh -c`, `execSync` / `execFileSync` /
`.exec(`, `node-pty`, raw `node:http(s)` / `net` / `tls` / `dgram`, `fetch(`,
`Octokit` / `McpClient` / `OAuthClient` / `WorkflowRuntime` / `Orchestrator`, and
`git rev-parse` / `clone` / `commit` / `push` / `fetch`) returns 0 over the real
production source and is proven fireable per class. Canonical test profiles are
deterministic local Node fixtures written outside the repository worktree; none
invokes git, GitHub, web/docs search, a browser, PostgreSQL, MCP, OAuth,
credential storage or any S15+ behavior.

## 9. Round-2 QA sequence and results (Node v24.19.0 / npm 11.17.0)

| # | Check | Result |
| --- | --- | --- |
| 1 | Remote truth (`main` `3cd344d…`; Round-1 branch `25068c…`, parent `3cd344d…`, not in `main`) | PASS |
| 2 | Rejected Round-1 preserved / not a Round-2 ancestor | PASS |
| 3 | Part A blob checks | 3/3 |
| 4 | `npm ci`; `package-lock.json` byte-identical | PASS |
| 5 | `npm run typecheck` (`tsc --noEmit`) | PASS |
| 6 | S14A focused `tests/capability-registry` | **110 / 110 PASS** |
| 7 | S14B focused `tests/filesystem-capability` | **169 / 169 PASS — ZERO failures** |
| 8 | S14C focused `tests/shell-capability` (4 files) | **124 / 124 PASS** |
| 9 | Canonical S14C positives `FX-POS-001..014` | **14 / 14** |
| 10 | Canonical S14C negatives `FX-NEG-001..042` | **42 / 42** |
| 11 | Canonical S14C hard invariants `S14C-HI-001..040` | **40 / 40** |
| 12 | Unsafe counters `UC01..UC12` — legitimate zero + each detector fireable | **12 / 12** |
| 13 | Stubborn same-group grandchild TIMEOUT escalation | grandchild SIGKILLed & `ESRCH`; `FAIL / TIMEOUT` |
| 14 | Stubborn same-group grandchild OUTPUT_OVERFLOW escalation | grandchild SIGKILLed & `ESRCH`; `FAIL / EXECUTION_FAILED` |
| 15 | Pre-spawn timeout, profile smaller (5000 / 100) | `FAIL / TIMEOUT`, no spawn |
| 16 | Pre-spawn timeout, request smaller (100 / 5000) | `FAIL / TIMEOUT`, no spawn |
| 17 | Remaining-budget-not-reset (400 total, 320 pre-spawn, 260 child) | `FAIL / TIMEOUT` |
| 18 | Existing timeout / overflow parent + ordinary grandchild cleanup | grandchild `ESRCH` after both |
| 19 | Teeth: in a throwaway copy of the builder worktree, reverting the Blocker A `close`-handler / escalation-lifecycle change makes HI-028 + HI-029 fail; reverting the Blocker B `tighten()` / remaining-budget change makes HI-021 fail. Both reverts were then discarded and the shipped tree confirmed byte-identical-restored (`git diff` + per-file `diff -q` clean) before the QA rows above | confirmed |
| 20 | zero / non-zero exit; `shell:false` metacharacter literal; env isolation | PASS |
| 21 | output exact max / max+1 (stdout, stderr, combined); invalid UTF-8; secret output | PASS |
| 22 | executable drift before spawn; cwd symlink / traversal / protected / missing / regular-file; permission denial at spawn | PASS |
| 23 | real registry; real RestrictedCapabilityProvider; real runAgent; provider/profile swap byte identity; legal-max through registry | PASS |
| 24 | S14B audit-maintenance exactness proof (`s14bAuditMaintenanceExact` / `Mechanical`) | PASS |
| 25 | Full repository suite BEFORE build | **36 files / 1784 passed — ZERO failures** |
| 26 | Repo-local `dist/` genuinely absent before build | absent |
| 27 | Genuine clean build `npm run build` (`tsc -p tsconfig.json`) | PASS |
| 28 | Emitted artifacts | 918 files (306 `.js` + 306 `.js.map` + 306 `.d.ts`); shell provider at `dist/src/providers/capability/shell/` |
| 29 | Full repository suite AFTER build | identical: **36 files / 1784 passed — ZERO failures** |
| 30 | `git show --check HEAD` / `git diff --check 3cd344d..HEAD` | clean |
| 31 | Exact baseline-to-candidate scope audit | 13 `A` under S14C paths + exactly `M tests/filesystem-capability/audit.ts` |
| 32 | Protected-boundary blob comparison (Core / Restricted / compile / registry `*.ts` / filesystem provider + lock / other `tests/filesystem-capability/**` / `tests/capability-registry/**` / `package.json` / `package-lock.json` / `tsconfig.json` / `vitest.config.ts` / `STATE.yaml` / `CURRENT.md`) + 3 Part A blobs | byte-identical |
| 33 | Dependencies added | none |
| 34 | S14D+ / git / GitHub / network / browser / PostgreSQL / MCP / OAuth surface | none (`shellFutureSurface` 0, fireable) |

## 10. Limitations

- Credential / dangerous-env recognition and secret-output recognition reuse the
  registry `sensitive()` recognizer — a finite recognizer of common shapes, not a
  universal classifier.
- Path normalization is exact-string replacement of the canonical workspace root
  and executable realpath only.
- POSIX process-group cleanup is proven for ordinary and stubborn (SIGTERM-
  handling) same-group descendants on Linux/WSL Node 24; a program that leaves the
  group via `setsid()` is outside the accepted profile threat model. No OS
  container, anti-daemon sandbox or network isolation is claimed.
- The final kernel spawn-window residual in §8 stands.
- The one authorized pre-existing modification is TEST-HARNESS MAINTENANCE to
  `tests/filesystem-capability/audit.ts` only; it does not reopen or alter the
  accepted S14B production implementation.
- This gate covers the authorized S14C `shell.execute` provider only. Git
  processes, GitHub API, docs/web search, browser, PostgreSQL, MCP, OAuth,
  credential storage and any S14D+ surface are out of scope and not present.

## 11. Commit and publication

- Candidate on branch `s14c-shell-capability-part-b-round2`, a strictly linear
  descendant of `main` (`3cd344d018dbf2d40a39a907a3494bba8f3d940b`). Every push is
  a fast-forward; the remote branch SHA equals the exact local candidate SHA; no
  force push. Round-1 branch `s14c-shell-capability-part-b` (`25068c…`) is not
  moved. No merge to `main`; no `main` movement; no `STATE.yaml` / `CURRENT.md`
  phase-closure edit. The exact remote Round-2 candidate SHA to source-audit is
  stated in the `S14C_ROUND2_BUILDER_HANDOFF` relay for this gate.

## 12. Next action

CONTROL_PLANE_SOURCE_AUDIT_OF_THE_EXACT_ROUND2_REMOTE_CANDIDATE, then a fresh
non-authoring, non-fork, read-only independent verification of that exact remote
candidate. This builder did not launch the independent verifier, does not claim a
verifier outcome, does not close S14C or S14, does not award HI-054 and does not
authorize S14D.
