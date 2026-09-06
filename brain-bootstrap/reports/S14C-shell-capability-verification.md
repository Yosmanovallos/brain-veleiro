# S14C Shell Capability — Builder Verification

Status: S14C BUILDER PASS AWAITING CONTROL-PLANE SOURCE AUDIT / INDEPENDENT VERIFICATION
S14C: BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT
S14: IN_PROGRESS / NOT_CLOSED
HI-054: NOT_AWARDED
S14D: NOT_AUTHORIZED

This report is factual builder evidence for the exact S14C candidate on branch
`s14c-shell-capability-part-b`. It does not claim independent-verifier
acceptance, phase closure, S14 completion, the HI-054 honor, or S14D
authorization.

## 1. Control-plane authority and baseline

| Item | Value |
| --- | --- |
| S14C Part A authoring | Issue #1 comment `5555687848` |
| S14C Part B authorization | Issue #1 comment `5555785836` |
| Exact builder baseline / remote `main` | `3cd344d018dbf2d40a39a907a3494bba8f3d940b` |
| Part A parent / S14B phase closure | `a89deb76968684bf8d4c94f5e6e17986d2a9d517` |
| S14B fresh-verified target | `e49ba5c71767b2b45b0aec04e64027afe4aa5b7d` |

- Local `main` = `origin/main` = `git ls-remote origin refs/heads/main`
  = `3cd344d018dbf2d40a39a907a3494bba8f3d940b`.
- `a89deb..3cd344d` = 1 commit ahead / 0 behind, adding exactly the three S14C
  Part A docs.
- The candidate branch `s14c-shell-capability-part-b` was cut from that exact
  baseline in a fresh isolated WSL-native clone (`/home/yosman/brain-s14c-builder`,
  POSIX/LF, `core.autocrlf` unset, `git diff --check` clean at checkout).
- The primary `/mnt/c` checkout was not reset, stashed, cleaned, normalized or
  staged; no existing branch/worktree was force-moved; nothing was merged to
  `main`; no force push.
- Runtime: Node `v24.19.0`, npm `11.17.0` (activated explicitly; the shell
  default Node 22 was not used for QA). `npm ci` restored packages;
  `package-lock.json` byte-identical to baseline afterwards. Vitest `4.1.11`.

## 2. Part A canonical artifacts — proven immutable at the candidate

| Artifact | Blob |
| --- | --- |
| `brain-bootstrap/skills/SHELL_CAPABILITY_SKILL_S14C.md` | `defbd27f7787a42b2a797c178f75668db65502db` |
| `brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml` | `a0b84708dc7619648321004fe18d8d429becf84b` |
| `brain-bootstrap/specs/SHELL_CAPABILITY_CONTRACT_S14C.md` | `8626698c94aae66e74cd96d654625dcb638d7a47` |

All three are unchanged by this candidate and are re-checked from inside the test
run (`tests/shell-capability/audit.ts`).

## 3. Exact candidate scope against baseline `3cd344d…`

`git diff --name-status 3cd344d.. HEAD` — **zero modified tracked files**; two new
untracked trees only:

New production tree `src/providers/capability/shell/`:

- `types.ts` — trusted `WorkspaceShellCommandProfile` / `WorkspaceShellConfig`
  shapes (no runtime logic).
- `execution.ts` — raw process-group launch (`startProcessGroup`, synchronous,
  the only statement between the final pre-spawn checks and `spawn`) and bounded
  capture / timeout / output-overflow cleanup (`runProcessGroup`). Node built-ins
  only (`node:child_process`); no new dependency.
- `workspaceShellCapabilityProvider.ts` — the `shell.execute` provider: config
  validation and canonical executable-identity recording at `create()`; per-call
  `{ profile_id, cwd }` validation, logical-path grammar, protected-cwd floor,
  per-profile allow-prefix policy, `O_NOFOLLOW` / `/proc/self/fd` cwd containment,
  pre-spawn identity recheck, bounded UTF-8 decode, secret-output fail-closed,
  workspace-root / executable-realpath normalization, evidence, error
  normalization.

New focused test tree `tests/shell-capability/`:
`fixtures.ts`, `helpers.ts`, `audit.ts`, `cases.ts`, `processExercises.ts`, and
the test files `shellCapability.test.ts`, `unsafeCounters.test.ts`,
`registryCompatibility.test.ts`, `regressions.test.ts`.

No `src/core/**`, `src/providers/capability/registry/**`,
`src/providers/capability/filesystem/**`, `tests/capability-registry/**`,
`tests/filesystem-capability/**`, `package.json`, `package-lock.json`,
`tsconfig.json`, `vitest.config.ts`, `brain-bootstrap/STATE.yaml` or
`brain/context/CURRENT.md` change. S13G / S13H tracked surfaces are untouched.
A from-inside-the-suite `assertBoundaries()` audit (`tests/shell-capability/audit.ts`)
walks every tracked file at `3cd344d…` and asserts each is byte-identical (no file
is excluded — S14C is authorized to modify none), asserts every
`git diff --name-status 3cd344d.. HEAD` entry is an addition under an authorized
S14C path, and re-checks the three Part A blobs from `HEAD:`.

## 4. Public capability

Exactly one capability: `shell.execute`, `side_effects = LOCAL` (conservative;
never downgraded per profile). Model-visible input schema is generic:
`{ profile_id: bounded string, cwd: bounded logical path }`, `additionalProperties:
false`. The descriptor enumerates no profile id, executable path, argv or env, so
the concrete implementation behind one `profile_id` can be swapped without an
`AgentDefinition` edit (`FX-POS-012` / `S14C-HI-035`).

## 5. Threat-model boundary as implemented

- Model input is only `{ profile_id, cwd }`. Any extra key — `command`,
  `executable`, `argv`, `args`, `env`, `environment`, `stdin`, `shell`,
  `provider_id`, `timeout_ms`, `host_path` — is rejected `FAIL / INVALID_INPUT`
  with no process spawned (`FX-NEG-003..006`, checked two ways: the
  `startProcessGroup` spy is never called and a marker-writing fixture never
  runs).
- `profile_id` grammar `^[a-z0-9][a-z0-9._-]*$`, ≤ 160 chars. Malformed/overlong
  → `FAIL / INVALID_INPUT`; well-formed but unregistered → `BLOCKED`, no spawn
  (`FX-NEG-001/002`).
- Executable, argv and env are fixed trusted provider configuration. Shell
  metacharacters in a trusted fixed argv (`;`, `|`, `&&`, `$(id)`, backticks,
  `*`, `> file`) are passed literally; `spawn` is called with `shell: false` and
  no command string is composed; a fixture proves no redirection file is created
  and the child observes the exact argv array (`FX-POS-005` / `S14C-HI-016`).
- The child environment is exactly the validated profile env; the host
  environment is never inherited. A live host sentinel is proven absent from the
  child (`FX-POS-006` / `FX-NEG-032`). Dangerous loader / runtime-injection keys
  (`LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES`, `NODE_OPTIONS`,
  `PYTHONPATH`, `PYTHONHOME`, `RUBYOPT`, `PERL5OPT`, `BASH_ENV`, `ENV`, `IFS`,
  `SHELLOPTS`) and recognizable credential-bearing key names fail `create()`
  validation (`FX-NEG-030/031`).
- `stdin` is `["ignore", …]` — `child.stdin` is `null`; stdout/stderr are pipes;
  no TTY/PTY; no interactive/background/daemon API (`S14C-HI-017`, asserted on
  the real `ChildProcess`).

## 6. Workspace root and cwd

- `workspace_root` is explicit absolute configuration, canonicalized with
  `fs.realpath` and opened `O_DIRECTORY | O_NOFOLLOW` before the provider is
  invokable. No `process.cwd()` / host-env / `HOME` / git-root / scan inference —
  the `inferredScope` scanner returns 0 over the real production source and is
  proven fireable. An unconfigured or relative or missing root is rejected
  (`S14C-HI-004`).
- `cwd` is a provider-neutral workspace-relative logical `/` path; `.` = root.
  Rejected before spawn (`FAIL / INVALID_INPUT`, no spawn): absolute POSIX, drive
  path, UNC, backslash, NUL, `..`, internal `.` segment, empty internal segment,
  `> 4096` chars, `> 256` segments, `> 255` UTF-8-byte segment
  (`FX-NEG-007..012`).
- The selected profile must explicitly cover the cwd via `cwd_allow_prefixes`; a
  `.` prefix authorizes the whole tree, any other prefix only itself and its
  subtree, so cwd `.` stays denied unless `.` is listed. No implicit root-wide
  scope (`FX-NEG-013` / `S14C-HI-009`).
- Containment is proven, not string-prefixed: an `O_NOFOLLOW` / `/proc/self/fd`
  directory-handle chain from the canonical root, each hop `lstat`-checked for
  symlink / non-directory / dev:ino drift, re-checked immediately before spawn,
  and the spawn `cwd` is the held-open `/proc/self/fd/<fd>` anchor.
  Symlink component / symlink target / traversal / regular-file cwd all fail
  closed; a missing cwd is `FAIL / NOT_FOUND` with no spawn
  (`FX-NEG-015..018`, `S14C-HI-010/011`).
- Protected credential/control cwd (`.git`, `.ssh`, `.gnupg`, `.aws`, `.azure`,
  `.kube`, and the S14B `.npmrc` / `.pypirc` / `.netrc` / `.env*` / `*.pem` /
  `*.key` floor) fails closed even when a prefix would otherwise allow it
  (`FX-NEG-014` / `S14C-HI-012`).

## 7. Executable identity

Each profile has one explicit absolute executable. At `create()`: `fs.realpath`
→ regular file → `X_OK` access → record `{ configured, realpath, dev, ino }`.
Relative path, missing file, directory target and non-executable file each fail
`create()` (`FX-NEG-019..022`, `S14C-HI-013`). Immediately before spawn the
provider re-resolves `realpath(configured)` and re-`stat`s, comparing realpath
string + dev:ino; observed replacement/drift → `FAIL / UNAVAILABLE`, no spawn
(`processExercises.executableDrift` / `S14C-HI-014`).

The final pre-spawn window is `final containment recheck → final executable
identity recheck → synchronous deadline check → immediate spawn`. A static
extractor (`finalSpawnGap()` / `startGroupBodyAwaits()`) asserts **zero** `await`
or `.then` between the identity recheck and the spawn call and inside
`startProcessGroup`; the detector is proven fireable.

### Disclosed residual (v1)

Node's authorized S14C path exposes no portable atomic `fexecve`-style primitive.
S14C v1 does not assert race-free execution against a non-cooperating host actor
that replaces the executable, or mutates the cwd / directory / mount topology,
**after** the final validated check and **before or during** the irreducible
kernel spawn window. This residual is disclosed, not presented as a passing
property; there is no "race-free executable" claim anywhere in the candidate.

## 8. Output, UTF-8, secrets, path normalization

- Raw byte bounds: stdout ≤ 524288, stderr ≤ 524288, combined ≤ 1048576. The
  exact maxima succeed with no truncation and the result round-trips through the
  real `CapabilityRegistryProvider` unchanged (`FX-POS-007`). Exceeding any bound
  terminates the provider-created process group and returns
  `FAIL / EXECUTION_FAILED` — never a truncated SUCCESS (`FX-NEG-033/034/035`,
  `S14C-HI-022/024`). `max_combined_output_bytes` is structurally `2 ×` each
  individual bound, so a combined overflow always coincides with an individual
  overflow; the combined clause is enforced regardless.
- Output is accumulated as raw bytes and decoded strict/fatal UTF-8 only after
  bounded capture; invalid UTF-8 → `FAIL / INVALID_INPUT`, no raw bytes returned
  (`FX-NEG-036` / `S14C-HI-023`).
- Recognizable secret material in stdout/stderr → `BLOCKED`, not returned and not
  echoed in the error (`FX-NEG-037` / `S14C-HI-025`).
- Before model visibility the exact canonical workspace root → `workspace://` and
  the exact canonical executable path → `<executable>` (deterministic
  normalization, not a universal host-path classifier). A fixture that prints
  both raw strings yields `workspace://|<executable>` and no raw path appears in
  the result, error or evidence (`FX-NEG-038` / `S14C-HI-026`).
- Evidence is one bounded logical ref, `shell://<profile_id>@workspace/<cwd>`; it
  carries no executable path, argv, env, PID or output body
  (`regressions.test.ts`, `S14C-HI-020`).

## 9. Process completion, timeout, process-group cleanup

- A process that starts and terminates naturally is a SUCCESS observation with
  truthful `exit_code` / `signal`, including a non-zero exit (`FX-POS-003`) and
  an external signal (`processExercises.externalSignal` → `exit_code: null`,
  `signal: "SIGTERM"`), `S14C-HI-027`.
- Effective timeout = `min(request.timeout_ms, profile.max_timeout_ms)`; both must
  be positive and the profile bound ≤ 300000 ms (`create()` rejects `0`, `-1`,
  `300001`, `NaN`, `Infinity`, non-number). A command that finishes before the
  smaller bound succeeds; whichever bound is smaller drives the TIMEOUT
  (`FX-POS-008` / `S14C-HI-021`).
- On timeout / output overflow: stop accepting output, signal the provider-created
  POSIX process group (`process.kill(-pgid, SIGTERM)`), 500 ms grace, `SIGKILL`,
  await bounded close, then `FAIL / TIMEOUT` or `FAIL / EXECUTION_FAILED`. A
  real parent + ordinary grandchild fixture (grandchild records its PID to a
  marker file) is fully reaped — `process.kill(gcPid, 0)` throws `ESRCH` after
  both the timeout and the overflow paths, with a later legitimate invocation
  still succeeding (`FX-POS-013`, `FX-NEG-039`, `S14C-HI-028/029`).
- The result never states that earlier child side effects were undone; the
  capability stays `LOCAL` precisely because there is no rollback layer.

## 10. Composition

- `WorkspaceShellCapabilityProvider → CapabilityRegistryProvider →
  RestrictedCapabilityProvider → compileAgentDefinition → runAgent`. The
  registry routes `shell.execute` with no shell-specific branch, one diagnostic,
  and the composed result is byte-equal to the direct call (`FX-POS-010`,
  `regressions.test.ts`, `S14C-HI-033`).
- `RestrictedCapabilityProvider` remains authoritative: capability denial and
  `LOCAL` side-effect denial each yield `BLOCKED` with the shell provider's
  `invoke` never called and no process spawned (`FX-NEG-040/041`,
  `S14C-HI-031/032`).
- A real `runAgent` run issues a `shell.execute` TOOL_CALL through the full
  composition and finishes SUCCESS with the observation and
  `shell://qa.ok@workspace/.` evidence (`FX-POS-011` / `S14C-HI-034`).
- Provider/profile swap: two configs with different executables and different
  fixed argv behind the same `profile_id` and cwd both run through the canonical
  composition while `JSON.stringify(definition)` is byte-identical before and
  after (`FX-POS-012` / `S14C-HI-035`).
- Registry result envelope: a real 1 MiB combined result — including a worst-case
  control-character payload that expands ≈ 6× under JSON escaping — passes the
  accepted `8388608`-character `ToolInvocationResult` envelope untruncated; a
  `max+1` raw output fails in the provider before any oversized result is
  composed (`FX-POS-007`, `registryCompatibility.test.ts`, `S14C-HI-036`). The
  descriptor / public-contract `canonical()` path (`100000`) is unchanged.

## 11. Error normalization

`INVALID_INPUT` (bad input/schema/path/config shape), `NOT_FOUND` (missing cwd),
`BLOCKED` (unknown profile / cwd outside policy / protected / symlink),
`PERMISSION_DENIED` (OS denies exec — `processExercises.permissionDeniedAtSpawn`,
a `chmod 000` that keeps the inode so identity recheck passes and the kernel
returns `EACCES`), `TIMEOUT`, `UNAVAILABLE` (validated executable gone / drifted),
`EXECUTION_FAILED` (bounded spawn/output/cleanup failure). Messages are ≤ 500
chars with no raw stack, OS text, secret, workspace root, executable realpath or
env value (`S14C-HI-030`).

## 12. Trusted-profile / no-OS-sandbox limitation

S14C v1 constrains the untrusted model to pre-authorized LOCAL_ONLY profiles. It
does not inspect an arbitrary configured executable and prove it is network-free,
filesystem-safe or non-malicious. No OS-level network isolation and no universal
filesystem sandbox is claimed around the child; a deliberately daemonizing
program that starts its own session/process group is outside the accepted profile
threat model. The `shellFutureSurface` scanner (which — unlike the S14B
`futureSurface` scanner — deliberately **permits** `node:child_process` as the
authorized mechanism, and forbids `shell: true`, `/bin/sh -c`, `execSync` /
`execFileSync` / `.exec(`, `node-pty`, raw `node:http(s)` / `net` / `tls` /
`dgram`, `fetch(`, `Octokit` / `McpClient` / `OAuthClient` / `WorkflowRuntime` /
`Orchestrator`, and `git rev-parse` / `clone` / `commit` / `push` / `fetch`)
returns 0 over the real production source and is proven fireable per class.
Canonical test profiles are deterministic local Node fixtures written outside the
repository worktree; none invokes git, GitHub, web/docs search, a browser,
PostgreSQL, MCP, OAuth, credential storage or any S15+ behavior
(`FX-NEG-042` / `S14C-HI-039`).

## 13. Real-process QA evidence

All fixture executables and workspaces live under `os.tmpdir()`, outside the
repository worktree, and are removed after each exercise (`ENOENT` asserted). The
repository checkout is never a command cwd. Real child processes cover: zero
exit; natural non-zero exit; literal-metacharacter argv with `shell: false`;
nested allowed cwd; explicit-env-only with host sentinel absent; exact
stdout/stderr/combined maxima; `max+1` stdout, stderr and combined overflow with
process-group termination; invalid UTF-8; secret-bearing stdout; workspace-root
and executable-realpath normalization; effective-timeout `min(request, profile)`
with both directions and a fast success; timeout and output-overflow reaping of a
parent + ordinary grandchild group with no orphan; executable identity drift
detected before spawn; `chmod 000` execute-permission denial at spawn; cwd
symlink component / symlink target / traversal / regular-file / missing /
protected; `RestrictedCapabilityProvider` capability and `LOCAL` denial each
preventing spawn; real `CapabilityRegistryProvider` routing; real `runAgent`
`shell.execute`; provider/profile swap under a byte-identical `AgentDefinition`;
disposable-fixture cleanup.

## 14. QA sequence and results (Node v24.19.0 / npm 11.17.0)

| # | Check | Result |
| --- | --- | --- |
| 1 | `node --version` / `npm --version` | `v24.19.0` / `11.17.0` |
| 2 | Part A blob checks at baseline | 3/3 PASS |
| 3 | Fresh isolated WSL worktree from exact baseline; `git diff --check` clean | PASS |
| 4 | `npm ci`; `package-lock.json` byte-identical to baseline | PASS |
| 5 | `npm run typecheck` (`tsc --noEmit`) with candidate | PASS |
| 6 | S14A focused suite `tests/capability-registry` | **110 / 110 PASS** |
| 7 | S14B focused suite `tests/filesystem-capability` | 164 passed / **5 pre-existing failures** (see §15) |
| 8 | S14C focused suite `tests/shell-capability` | **123 / 123 PASS** (4 files) |
| 9 | Canonical S14C positives `FX-POS-001..014` | **14 / 14** |
| 10 | Canonical S14C negatives `FX-NEG-001..042` | **42 / 42** |
| 11 | Canonical S14C hard invariants `S14C-HI-001..040` | **40 / 40** |
| 12 | Unsafe counters `UC01..UC12` — legitimate paths zero + each detector fireable | **12 / 12** |
| 13 | Full repository suite BEFORE build | 33 files pass / 1778 passed, **5 pre-existing S14B failures** |
| 14 | Repo-local `dist/` genuinely absent before build | absent |
| 15 | Genuine clean build `npm run build` (`tsc -p tsconfig.json`) | PASS |
| 16 | Emitted artifacts | 918 files (306 `.js` + 306 `.js.map` + 306 `.d.ts`); shell provider emitted at `dist/src/providers/capability/shell/` |
| 17 | Full repository suite AFTER build | identical: 1778 passed, **5 pre-existing S14B failures** |
| 18 | `git show --check HEAD` and `git diff --check 3cd344d..HEAD` | clean |
| 19 | Exact baseline-to-candidate scope audit (`git diff --name-status 3cd344d.. HEAD`) — from inside the suite | **all 13 entries `A`**, every path under `src/providers/capability/shell/`, `tests/shell-capability/` or `brain-bootstrap/reports/S14C-` |
| 20 | Protected-boundary blob comparison (Core / Restricted / compile / registry `*.ts` / filesystem provider + lock / `package.json` / `package-lock.json` / `tsconfig.json` / `vitest.config.ts` / `STATE.yaml` / `CURRENT.md`) + 3 Part A blobs re-checked from `HEAD:` | **21 / 21 byte-identical** |
| 21 | `dist/` tracked? | no (git-ignored) |

## 15. Pre-existing S14B focused-suite failures (NOT introduced by S14C)

On the **pristine** baseline `3cd344d…`, before any S14C file exists, five tests
in `tests/filesystem-capability` already fail:

```
FX-NEG-034   S14B-HI-033   S14B-HI-034   S14B-COMP-HI-011   UC10
```

Root cause: `tests/filesystem-capability/audit.ts` pins its fixture `baseline` to
`990483118d…`, and the authorized S14B **phase-closure** commit `a89deb7`
(docs-only) modified `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md`.
`protectedDifferences()` in that frozen S14B fixture now reports those two
authorized edits as drift. `tests/filesystem-capability/**` is a protected
surface this phase must not edit, so the condition is left as-is and disclosed
here. It is entirely independent of S14C: the count and identity of the failing
tests are byte-for-byte the same before and after this candidate (`5 failed`),
and the S14A suite (`110/110`) and the new S14C suite (`123/123`) are clean.

## 16. Limitations

- Credential / dangerous-env recognition is a finite recognizer of common key
  shapes and assignment patterns, not universal arbitrary-secret classification.
- Secret-output recognition reuses the registry `sensitive()` recognizer — the
  same finite recognizer, not a universal classifier.
- Path normalization is exact-string replacement of the canonical workspace root
  and executable realpath only, not a universal host-path classifier.
- The POSIX process-group cleanup is proven for an ordinary parent + grandchild
  on Linux/WSL Node 24; a program that starts its own session/process group can
  still escape a group kill and is outside the accepted profile threat model. No
  OS container, anti-daemon sandbox or network isolation is claimed.
- The final kernel spawn-window residual in §7 stands.
- This gate covers the authorized S14C `shell.execute` provider only. Git
  processes, GitHub API, docs/web search, browser, PostgreSQL, MCP, OAuth,
  credential storage and any S14D+ surface are out of scope and not present.

## 17. Commit and publication

- Candidate on branch `s14c-shell-capability-part-b`, a strictly linear
  descendant of `main` (`3cd344d018dbf2d40a39a907a3494bba8f3d940b`). Every push is
  a fast-forward; the remote branch SHA equals the exact local candidate SHA; no
  force push. No merge to `main`; no `main` movement; no `STATE.yaml` /
  `CURRENT.md` phase-closure edit. The exact remote candidate SHA to source-audit
  is stated in the `S14C_BUILDER_HANDOFF` relay for this gate.

## 18. Next action

CONTROL_PLANE_SOURCE_AUDIT_OF_THE_EXACT_REMOTE_CANDIDATE, then a fresh
non-authoring, non-fork, read-only independent verification of that exact remote
candidate. This builder did not launch the independent verifier, does not claim a
verifier outcome, does not close S14C or S14, does not award HI-054 and does not
authorize S14D.
