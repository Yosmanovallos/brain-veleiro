# S14C Shell Capability — Round 3 Builder Verification

Status: S14C ROUND3 BUILDER PASS AWAITING CONTROL-PLANE SOURCE AUDIT / INDEPENDENT VERIFICATION
S14C: ROUND3_BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT
S14: IN_PROGRESS / NOT_CLOSED
HI-054: NOT_AWARDED
S14D: NOT_AUTHORIZED

This report is factual builder evidence for the exact Round-3 S14C candidate on
branch `s14c-shell-capability-part-b-round3`. It does not claim independent-verifier
acceptance, phase closure, S14 completion, the HI-054 honor, or S14D authorization.

## 1. Lineage and control-plane authority

| Event | Reference |
| --- | --- |
| S14C Part A authoring | Issue #1 comment `5555687848` |
| Original Part B authorization | Issue #1 comment `5555785836` |
| Round-1 candidate published | `25068c4351730b4de02b950065c614f9be68568f` on branch `s14c-shell-capability-part-b` |
| Round-1 source-audit FAIL + Round-2 remediation authorization | Issue #1 comment `5556004891` |
| Round-2 candidate published | `774f2bfb38034c85d20763bb2b5703b45cb4eaf2` on branch `s14c-shell-capability-part-b-round2` |
| Round-2 source-audit FAIL + Round-3 remediation authorization | Issue #1 comment `5556308690` |

Both prior source-audit FAILs are preserved, not erased. Round-1 `25068c…`
(branch `s14c-shell-capability-part-b`) and Round-2 `774f2bf…` (branch
`s14c-shell-capability-part-b-round2`) remain on `origin`, unmoved.
`git merge-base --is-ancestor 25068c… HEAD` = **false** and
`git merge-base --is-ancestor 774f2bf… HEAD` = **false**: neither rejected
candidate is in Round-3 ancestry. The merge-base of each rejected candidate with
the Round-3 candidate is exactly `main` `3cd344d018dbf2d40a39a907a3494bba8f3d940b`.
Round 3 was built in a fresh WSL-native clone (`/home/yosman/brain-s14c-round3`),
branched directly from that exact `main`; neither rejected builder worktree was
used as the authoritative Round-3 surface.

```text
3cd344d  (remote main, unmoved)
   ├── 25068c   [ROUND 1 — control-plane SOURCE-AUDIT FAIL, comment 5556004891]
   ├── 774f2bf  [ROUND 2 — control-plane SOURCE-AUDIT FAIL, comment 5556308690]
   └── <Round-3 candidate>   (this report)
```

## 2. Round-2 remediations preserved verbatim in Round 3

Round 3 imports the Round-2 candidate tree file content and preserves all three
Round-2 fixes unchanged. The teeth checks below were re-run in this Round-3 tree.

### Blocker A (Round 1) — process-group escalation could end too early — PRESERVED

`src/providers/capability/shell/execution.ts`: once provider-induced termination
begins, an escalation lifecycle owns resolution and the group leader's `close`
event can no longer cancel it — mark reason → stop accepting output → `SIGTERM`
the provider-created process group → after `terminationGraceMs` (500 ms), if
`process.kill(-pgid, 0)` shows the group still alive, `SIGKILL` the group → poll
`-pgid` liveness every 25 ms until the group is gone (`ESRCH`) or the bounded
`groupCleanupBudgetMs` (4000 ms) is exhausted → only then resolve `TIMEOUT` /
`OUTPUT_OVERFLOW`. The leader's `close` during termination only fast-paths when
the *entire* group is already gone. `EPERM` from the liveness probe = "still
alive"; `ESRCH` = "gone". No truncated SUCCESS for these outcomes.
Proof: `stubbornGrandchildTimeout` / `stubbornGrandchildOverflow`
(`S14C-HI-028` / `S14C-HI-029`). Teeth (re-run in the Round-3 tree, in a throwaway
copy): reverting the `close` handler to Round-1 behavior makes both fail.

### Blocker B (Round 1) — the effective timeout was restarted at spawn — PRESERVED

`src/providers/capability/shell/workspaceShellCapabilityProvider.ts`: one
invocation-wide `Deadline`. `start` is captured at invocation entry, before the
profile is known, and never reset. `tighten()` lowers the budget to
`min(request.timeout_ms, profile.max_timeout_ms)` once the profile is selected
and can only shrink it. Every pre-spawn step draws from that same remaining time;
`remainingMs = deadline.remaining()` is computed synchronously right before spawn;
`deadline.check()` with `remaining() <= 0` → `FAIL / TIMEOUT` with no spawn; a
spawned child receives `Math.max(1, remainingMs)`, not the original maximum.
Proof: `preSpawnTimeoutProfileSmaller`, `preSpawnTimeoutRequestSmaller`,
`remainingBudgetNotReset` (`S14C-HI-021`). Teeth (re-run in the Round-3 tree):
making `tighten()` a no-op / passing a fresh `profile.max_timeout_ms` makes
`S14C-HI-021` fail.

### Blocker C (Round 1) — S14B regression suite not fully green — PRESERVED

The single authorized pre-existing-file modification remains **exactly** the
Round-2 maintenance of `tests/filesystem-capability/audit.ts` (TEST-HARNESS
MAINTENANCE): add
`export const acceptedContinuityFiles = ["brain-bootstrap/STATE.yaml", "brain/context/CURRENT.md"];`
and change the `protectedDifferences()` guard from
`if (registryFiles.includes(p)) return [];` to
`if (registryFiles.includes(p) || acceptedContinuityFiles.includes(p)) return [];`.
`baseline` stays `990483118d…`, `registryFiles` stays, `registryPatchOnly()`
stays byte-identical, every other tracked file at `990483…` stays fully
protected. **No further change to this file in Round 3.** On the pristine baseline
`3cd344d…` the S14B focused suite fails 5 tests (`FX-NEG-034`, `S14B-HI-033`,
`S14B-HI-034`, `S14B-COMP-HI-011`, `UC10`) purely from this stale boundary; with
the maintenance the S14B focused suite is **169 / 169 PASS**. Narrowness proven
from inside the S14C suite by `s14bAuditMaintenanceExact()` /
`s14bAuditMaintenanceMechanical()` (`S14C-HI-037`, `FX-NEG-042`,
`regressions.test.ts`).

## 3. Why Round 2 failed source audit (two blockers) and how Round 3 fixes each

Authority: Issue #1 comment `5556308690`. Production changes are confined to
`src/providers/capability/shell/workspaceShellCapabilityProvider.ts`.

### Blocker #1 — executable-normalization overlap (contract §26)

Contract §26 requires, before model visibility: canonical workspace root →
`workspace://`, canonical executable realpath → `<executable>`. Round-2
`normalize()` substituted the workspace-root prefix **first**:

```text
text.split(this.root).join("workspace://")
    .split(executable).join("<executable>")
    .split(profile.executable.configured).join("<executable>")
```

For a legal profile whose executable lives physically **inside** `workspace_root`
(e.g. root `/tmp/ws`, executable `/tmp/ws/tools/tool`), the raw string
`/tmp/ws/tools/tool` was rewritten to `workspace:///tools/tool` before the
`<executable>` replacement could match, so the canonical executable token was
never produced.

**Round-3 fix** — most-specific-first, plain longest-first exact-substring
replacement (no regex, no universal host-path classification):

```text
text.split(executable).join("<executable>")
    .split(profile.executable.configured).join("<executable>")
    .split(this.root).join("workspace://")
```

The executable realpath and the configured executable string are collapsed to
`<executable>` before the workspace-root prefix is replaced. An
executable-under-root path now normalizes to `<executable>`; a non-executable
path under the root still normalizes to `workspace://…`.

**Required regression** — `executableInsideWorkspace()` (`processExercises.ts`,
wired into `S14C-HI-026`; canonical inventory unchanged at 14 / 42 / 40). A real
fixture executable is written at `<workspace_root>/tools/inside-exe`, is the
configured profile executable, and prints its own launch path
(`process.argv[1]` — the realpath the provider passed to `spawn`). The test
asserts the overlap precondition (`exeReal.startsWith(rootReal + "/")`), then, via
the direct provider **and** via the real `CapabilityRegistryProvider`:
`output.stdout === "<executable>"` exactly; `stdout` contains no `workspace://`;
the serialized result contains neither the raw executable realpath nor the raw
workspace root nor the string `workspace:///tools/inside-exe` (the degraded token
is never accepted as a stand-in); on the direct-provider leg the evidence ref is
exactly `shell://qa.inside@workspace/.`. Teeth: reverting to the Round-2 order
makes `S14C-HI-026` fail with `expected 'workspace:///tools/inside-exe' to be
'<executable>'`.

### Blocker #2 — TIMEOUT message overclaimed group extinction

Round-2 cleanup is intentionally bounded: it resolves when the group is gone **or**
when `groupCleanupBudgetMs` is exhausted while the group may still be alive. The
Round-2 message —
`"The command exceeded the effective execution timeout and its process group was terminated."`
— asserts unconditional termination, which can be false in the budget-exhausted
case.

**Round-3 fix** — the canonical `TIMEOUT` message is now
`"The command exceeded the effective execution timeout; bounded process-group
termination and cleanup were attempted before returning."` It does not claim
guaranteed group extinction, contains no raw path / executable / stack / PID /
secret / OS text, stays within the ≤ 500-char safe-error bound, is single-line,
and makes no claim that already-completed LOCAL side effects were rolled back.
`status` stays `FAIL`, `error.code` stays `TIMEOUT`, `error.retryable` stays
`true`. No new outcome was invented.

**Required regression** — `timeoutMessageBounded()` (`processExercises.ts`, wired
into `S14C-HI-028`). A real `spin` fixture times out; the returned message is
asserted to be FAIL / `TIMEOUT` / `retryable: true` and to **not** contain
"process group was terminated", "all children were terminated", "cleanup
succeeded", "was/were fully terminated", "was/were killed", "guaranteed", "rolled
back", "no side effects", "no local"; to carry no `/tmp|/home|/proc|/Users|…/`
path fragment or `pid` token; and to still describe a bounded *attempt*
("timeout" + `attempt|bounded`). The pre-existing real cleanup tests
(`stubbornGrandchildTimeout`, `FX-NEG-039`, `FX-POS-013`) are unchanged and pass.

## 4. Baseline and runtime truth

- Local `main` = `origin/main` = `git ls-remote origin refs/heads/main`
  = `3cd344d018dbf2d40a39a907a3494bba8f3d940b`.
- Rejected branches present and unmoved on `origin`:
  `s14c-shell-capability-part-b` = `25068c4351730b4de02b950065c614f9be68568f`
  (`25068c^` = `3cd344d…`); `s14c-shell-capability-part-b-round2`
  = `774f2bfb38034c85d20763bb2b5703b45cb4eaf2` (`774f2bf^` = `3cd344d…`).
- Round-3 branch `s14c-shell-capability-part-b-round3` cut from exact `main` in a
  fresh isolated WSL-native clone (`/home/yosman/brain-s14c-round3`, POSIX/LF).
  Neither rejected builder worktree was reused as the authoritative build surface.
- The primary `/mnt/c` checkout was not reset, stashed, cleaned, normalized or
  committed; it remains at its pre-existing local state.
- Node `v24.19.0`, npm `11.17.0` (activated explicitly). `npm ci` restored
  packages; `package-lock.json` byte-identical to baseline afterwards. Vitest
  `4.1.11`.

## 5. Part A canonical artifacts — proven immutable at the candidate

| Artifact | Blob |
| --- | --- |
| `brain-bootstrap/skills/SHELL_CAPABILITY_SKILL_S14C.md` | `defbd27f7787a42b2a797c178f75668db65502db` |
| `brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml` | `a0b84708dc7619648321004fe18d8d429becf84b` |
| `brain-bootstrap/specs/SHELL_CAPABILITY_CONTRACT_S14C.md` | `8626698c94aae66e74cd96d654625dcb638d7a47` |

Re-checked from `HEAD:` inside the test run (`partAIntact()`). No semantic
erratum was authored; Round 3 satisfies the existing contract as written,
including §26.

## 6. Exact candidate scope against baseline `3cd344d…`

`git diff --name-status 3cd344d.. HEAD`: **13 additions + exactly one authorized
modification** — identical file set to Round 2 (Round 3 adds no new files; the two
Blocker fixes are edits inside already-added `workspaceShellCapabilityProvider.ts`
and already-added `tests/shell-capability/**`).

Modified (1, TEST-HARNESS MAINTENANCE only):
- `tests/filesystem-capability/audit.ts` — the Blocker-C narrow continuity
  exemption, **byte-identical to the Round-2 maintenance**. 5 insertions, 1
  deletion vs baseline.

Added production tree `src/providers/capability/shell/` (3): `types.ts`,
`execution.ts`, `workspaceShellCapabilityProvider.ts`. `node:child_process` only;
no new dependency.

Added focused test tree `tests/shell-capability/` (9): `fixtures.ts`,
`helpers.ts`, `audit.ts`, `cases.ts`, `processExercises.ts`,
`shellCapability.test.ts`, `unsafeCounters.test.ts`,
`registryCompatibility.test.ts`, `regressions.test.ts`.

Added report (1): this file.

No `src/core/**`, `src/providers/capability/registry/**`,
`src/providers/capability/filesystem/**`, `tests/capability-registry/**`, any
**other** `tests/filesystem-capability/**` file, `package.json`,
`package-lock.json`, `tsconfig.json`, `vitest.config.ts`,
`brain-bootstrap/STATE.yaml` or `brain/context/CURRENT.md` change.
`assertBoundaries()` walks every tracked file at `3cd344d…` (excluding only the
one authorized `M`), asserts each byte-identical, asserts every addition is under
an authorized S14C path, and asserts the modification list is exactly
`["M\ttests/filesystem-capability/audit.ts"]`; re-run in the committed state it
still reports 13 `A` + 1 `M`.

## 7. Public capability and threat-model boundary (re-verified)

Exactly one capability `shell.execute`, `side_effects = LOCAL` (never downgraded
per profile). Model-visible input is only `{ profile_id, cwd }`; any extra key →
`FAIL / INVALID_INPUT`, no spawn (spy + marker fixture). `profile_id` grammar
`^[a-z0-9][a-z0-9._-]*$`, ≤ 160; malformed → `INVALID_INPUT`,
well-formed-but-unregistered → `BLOCKED`. Executable / fixed argv / explicit env
are trusted provider configuration: `spawn` is `shell: false`, no command string
composed (fixture proves shell metacharacters in a fixed argv arrive literally
and no redirection file is created); the child env is exactly the validated
profile env with no host inheritance (a live host sentinel is proven absent);
dangerous loader/runtime keys and recognizable credential key names fail
`create()`. `stdin` is `["ignore", …]` (`child.stdin === null`); pipes; no
TTY/PTY. Explicit absolute `workspace_root` (`realpath` + `O_DIRECTORY |
O_NOFOLLOW`; no `process.cwd()` / host-env / git-root / scan inference —
`inferredScope` scanner 0 over production source, fireable). Provider-neutral
logical `cwd` grammar rejected before spawn for absolute / drive / UNC /
backslash / NUL / `..` / internal `.` / empty / over-length / too-many-segments /
over-byte segment. Per-profile `cwd_allow_prefixes` (`.` = whole tree, else
prefix subtree). `O_NOFOLLOW` + `/proc/self/fd` directory-handle chain,
`lstat`-checked per hop and re-checked immediately before spawn; symlink
component / target / traversal / regular-file cwd fail closed; missing cwd →
`NOT_FOUND`; protected credential/control cwd floor fails closed even under an
allowing prefix. Executable identity is an explicit absolute path resolved at
`create()` (realpath + regular file + `X_OK`, recorded `dev:ino`) and re-resolved
immediately before spawn — observed drift → `FAIL / UNAVAILABLE`, no spawn. Raw
output bounds 524288 / 524288 / 1048576; exact maxima succeed and round-trip
through the real registry unchanged; `max+1` on stdout, stderr or combined →
group termination → `FAIL / EXECUTION_FAILED`, never a truncated SUCCESS. Output
is raw bytes decoded strict/fatal UTF-8 after bounded capture; invalid →
`FAIL / INVALID_INPUT`. Recognizable secret material in output → `BLOCKED`.

**Path normalization (§26, Round-3 corrected):** exact-string replacement, most
specific first — canonical executable realpath then configured executable string
→ `<executable>`, then canonical workspace root → `workspace://`. A legal
executable located inside `workspace_root` normalizes to `<executable>`, not to a
`workspace://` path. This is a bounded replacement of the provider's own known
host strings, not a universal arbitrary-host-path classifier.

Evidence is one bounded logical ref `shell://<profile_id>@workspace/<cwd>` with no
executable path / argv / env / PID / output body. Natural completion — any
non-zero exit, or an external signal — is a SUCCESS observation with truthful
`exit_code` / `signal`. A `TIMEOUT` result performs bounded process-group
termination/cleanup, does **not** assert guaranteed group extinction, and does
not assert that the child performed no local mutation; the capability stays
`LOCAL` because there is no rollback layer, and the result never states that
earlier child side effects were undone.

## 8. Composition (re-verified)

`WorkspaceShellCapabilityProvider → CapabilityRegistryProvider →
RestrictedCapabilityProvider → compileAgentDefinition → runAgent`. The registry
routes `shell.execute` with no shell-specific branch, one diagnostic, and a
composed result byte-equal to the direct call. Capability denial and `LOCAL`
side-effect denial each yield `BLOCKED` with `invoke` never called and no process
spawned. A real `runAgent` run issues a `shell.execute` TOOL_CALL through the
full composition and finishes SUCCESS. Provider/profile swap: two configs with
different executables and different fixed argv behind the same `profile_id` and
cwd both run through the canonical composition while `JSON.stringify(definition)`
is byte-identical before and after. A real 1 MiB combined result — including a
worst-case control-character payload that expands ≈ 6× under JSON escaping —
passes the accepted `8388608`-character `ToolInvocationResult` envelope
untruncated; `max+1` fails in the provider before any oversized result is
composed. The `executableInsideWorkspace` normalization regression is also driven
through the real registry (asserting the `<executable>` token and the absence of
raw host strings on that path).

## 9. Trusted-profile / no-OS-sandbox limitation (documented without overclaiming)

S14C v1 constrains the untrusted model to pre-authorized LOCAL_ONLY profiles. It
does not inspect an arbitrary configured executable and prove it is network-free,
filesystem-safe or non-malicious. There is no OS-level network isolation and no
universal filesystem sandbox around the child. A deliberately daemonizing program
that starts its own session (`setsid()`) leaves the provider-created process
group and is outside the accepted profile threat model — the stubborn descendant
is the *in-group* case, which IS cleaned; the *out-of-group* daemon-escape case
is the accepted residual. No OS container, anti-daemon sandbox or network
isolation is claimed. `TIMEOUT` cleanup is bounded by `groupCleanupBudgetMs` and
may return with the group not yet fully reaped; the canonical message states an
*attempt*, not a guarantee. Node's authorized path exposes no atomic
`fexecve`-style primitive; a non-cooperating host actor that replaces the
executable or mutates cwd / directory / mount topology strictly inside the
irreducible final kernel spawn window can still win it — disclosed, not presented
as a passing property. The `shellFutureSurface` scanner (deliberately **permits**
`node:child_process`; forbids `shell: true`, `/bin/sh -c`, `execSync` /
`execFileSync` / `.exec(`, `node-pty`, raw `node:http(s)` / `net` / `tls` /
`dgram`, `fetch(`, `Octokit` / `McpClient` / `OAuthClient` / `WorkflowRuntime` /
`Orchestrator`, `git rev-parse` / `clone` / `commit` / `push` / `fetch`) returns 0
over the real production source and is proven fireable per class. Canonical test
profiles are deterministic local Node fixtures written outside the repository
worktree.

## 10. Round-3 QA sequence and results (Node v24.19.0 / npm 11.17.0)

| # | Check | Result |
| --- | --- | --- |
| 1 | Remote truth (`main` `3cd344d…`; Round-1 `25068c…`; Round-2 `774f2bf…`; Round-3 branch absent pre-push) | PASS |
| 2 | Round-1 and Round-2 preserved; `merge-base --is-ancestor` **false** for both vs Round-3 HEAD; merge-base of each with HEAD = `3cd344d…` | PASS |
| 3 | Round-3 does not descend from `25068c…` or `774f2bf…` | confirmed |
| 4 | Part A blob checks (`partAIntact()`) | 3 / 3 |
| 5 | `npm ci`; `package-lock.json` byte-identical to baseline | PASS |
| 6 | `tsc --noEmit -p tsconfig.json` | PASS |
| 7 | S14A focused `tests/capability-registry` | **110 / 110 PASS** |
| 8 | S14B focused `tests/filesystem-capability` | **169 / 169 PASS — ZERO failures** |
| 9 | S14C focused `tests/shell-capability` (4 files) | **124 / 124 PASS** |
| 10 | Canonical S14C positives `FX-POS-001..014` | **14 / 14** |
| 11 | Canonical S14C negatives `FX-NEG-001..042` | **42 / 42** |
| 12 | Canonical S14C hard invariants `S14C-HI-001..040` | **40 / 40** |
| 13 | Unsafe counters `UC01..UC12` — legitimate zero + each detector fireable | **12 / 12** |
| 14 | BLOCKER #1: executable **inside** `workspace_root` → `stdout === "<executable>"` via provider **and** real registry; raw exec realpath / raw root / `workspace:///tools/inside-exe` all absent; logical evidence ref | PASS |
| 15 | BLOCKER #1 teeth: reverting to the Round-2 root-first order makes `S14C-HI-026` fail (`'workspace:///tools/inside-exe'` ≠ `'<executable>'`) | confirmed |
| 16 | BLOCKER #2: canonical `TIMEOUT` message = FAIL / `TIMEOUT` / `retryable: true`; no unconditional-extinction / rollback / host-path / PID text; ≤ 500 chars, single line; still describes a bounded attempt | PASS |
| 17 | BLOCKER #2 teeth: restoring the Round-2 message makes `S14C-HI-028` fail (`"process group was terminated"` present) | confirmed |
| 18 | Stubborn same-group grandchild TIMEOUT / OUTPUT_OVERFLOW escalation (unchanged) | grandchild SIGKILLed & `ESRCH`; `FAIL / TIMEOUT` resp. `FAIL / EXECUTION_FAILED` |
| 19 | Pre-spawn timeout (profile smaller / request smaller) + remaining-budget-not-reset (unchanged) | `FAIL / TIMEOUT`, no spawn / `FAIL / TIMEOUT` |
| 20 | Existing timeout / overflow parent + ordinary grandchild cleanup (`FX-NEG-039`) | grandchild `ESRCH` after both |
| 21 | Blocker A/B teeth re-run in a throwaway copy of the Round-3 tree; reverts then discarded and the shipped tree confirmed byte-identical-restored (`git diff --no-index` empty) before the rows above | confirmed |
| 22 | zero / non-zero exit; `shell:false` metacharacter literal; env isolation | PASS |
| 23 | output exact max / max+1 (stdout, stderr, combined); invalid UTF-8; secret output | PASS |
| 24 | executable drift before spawn; cwd symlink / traversal / protected / missing / regular-file; permission denial at spawn | PASS |
| 25 | real registry; real RestrictedCapabilityProvider; real runAgent; provider/profile swap byte identity; legal-max through registry | PASS |
| 26 | S14B audit-maintenance exactness proof (`s14bAuditMaintenanceExact` / `Mechanical`) — byte-identical to the Round-2 maintenance | PASS |
| 27 | Full repository suite BEFORE build, **default parallelism**, ~40 runs | see §11 — most runs 1784/1784; in ~20–25 % of runs a single test in the pre-existing timing-fragile S14B `tests/filesystem-capability/concurrency.test.ts` fails (seen: `CONC-POS-003`, `S14B-CONC-HI-006`); always retries green |
| 28 | Full repository suite BEFORE build, **`--no-file-parallelism` (serialized)**, repeated | **36 files / 1784 passed — ZERO failures**, deterministic across all repeats |
| 29 | `tests/filesystem-capability/concurrency.test.ts` in isolation | **19 / 19**, ≥ 12 repeats; every full-suite flake also retries **19 / 19** in isolation immediately |
| 30 | Repo-local `dist/` genuinely absent before build | absent |
| 31 | Genuine clean build `npm run build` (`tsc -p tsconfig.json`) | PASS |
| 32 | Emitted artifacts | 918 files (306 `.js` + 306 `.js.map` + 306 `.d.ts`); shell provider at `dist/src/providers/capability/shell/` |
| 33 | Full repository suite AFTER build, serialized | identical: **36 files / 1784 passed — ZERO failures** |
| 34 | `git show --check HEAD` / `git diff --check 3cd344d..HEAD` | clean |
| 35 | Exact baseline-to-candidate scope audit (committed state) | 13 `A` under S14C paths + exactly `M tests/filesystem-capability/audit.ts` |
| 36 | Protected-boundary blob comparison (Core / Restricted / compile / registry `*.ts` / filesystem provider + lock / other `tests/filesystem-capability/**` incl. `concurrency*` / `tests/capability-registry/**` / `package.json` / `package-lock.json` / `tsconfig.json` / `vitest.config.ts` / `STATE.yaml` / `CURRENT.md`) + 3 Part A blobs | byte-identical |
| 37 | Dependencies added | none |
| 38 | S14D+ / git / GitHub / network / browser / PostgreSQL / MCP / OAuth surface | none (`shellFutureSurface` 0, fireable) |

## 11. Pre-existing S14B full-suite timing flake in `concurrency.test.ts` (disclosed, not S14C, not fixed here)

**What.** Under the **default** vitest parallel pool, the pre-existing S14B file
`tests/filesystem-capability/concurrency.test.ts` intermittently fails one of its
cases with `concurrency condition never reached: …`. Observed so far:
`CONC-POS-003` ("writer B reached its own publication while A is parked") and
`S14B-CONC-HI-006` ("writer 1 parked inside its publication syscall"). Both
assertions are wall-clock `until(...)` polls that coordinate two concurrent
provider writes (one parked at a spied `fs.rename`, the other expected to reach
its own publication within the poll deadline). Under heavy parallel CPU load the
second writer is not scheduled quickly enough and the poll deadline expires. The
failure is always inside this one file, and it always passes on an immediate
retry.

**Not S14C, not introduced by Round 3.**
`tests/filesystem-capability/concurrency.test.ts` and
`tests/filesystem-capability/concurrencyExercises.ts` are **byte-identical to
baseline `3cd344d…`** (blobs `0284f1000ec97360e8657d16aa32a642c723e3c1` and
`6805f66ece64505fb0a17ee199764d9b550ae125`, verified with `git hash-object`);
Round 3 does not touch them, and `assertBoundaries()` proves it. The fragility is
in the tests' wall-clock `until()`-poll timing design. Observed rates by
configuration (no mechanism claimed beyond "larger suite + real process spawns +
default parallel pool"):

- pristine baseline `3cd344d…` full suite (1660 tests, no shell suite): **0 / 12**
  runs — the concurrency flake never occurred (the only failures there are the 5
  deterministic Blocker-C boundary tests the authorized `audit.ts` maintenance
  fixes);
- Round-2 candidate `774f2bf…` full suite (1784 tests, with the shell suite):
  **2 / 8** runs — same `concurrency.test.ts` flake. This shows it is **not
  introduced by Round 3**; it is not implied that the Round-2 source audit
  observed or blessed it.
- Round-3 candidate full suite: **≈ 20–25 %** of default-parallel runs; not
  measurably different from Round 2. Round 3 adds only two lightweight exercises
  (`executableInsideWorkspace`: two trivial spawns; `timeoutMessageBounded`: one
  150 ms `spin` that dies on SIGTERM with no escalation).

**Evidence.**

| Configuration | Runs | Result |
| --- | --- | --- |
| Full suite, default parallelism, Round-3 tree | ~40 | most runs 1784 / 1784; ~20–25 % of runs fail exactly one `concurrency.test.ts` case (`CONC-POS-003` or `S14B-CONC-HI-006`); no other test ever observed failing |
| After each such flake: `concurrency.test.ts` re-run in isolation | every occurrence | **19 / 19** |
| Full suite, `--no-file-parallelism` (serialized), Round-3 tree | 3 pre-build + 1 post-build | **1784 / 1784 every run — deterministic, ZERO failures** |
| `concurrency.test.ts` in isolation, Round-3 tree | ≥ 12 | **19 / 19 every run** |
| Full suite, default parallelism, Round-2 tree `774f2bf…` | 8 | 2 runs show the same `concurrency.test.ts` flake; 6 green |
| Full suite, default parallelism, pristine baseline `3cd344d…` | 12 | always exactly the 5 deterministic Blocker-C failures; the `concurrency.test.ts` flake **never** occurred |

**Disposition.** Making the `until()` polls robust would require a second
pre-existing S14B test-file change, outside this authorization (§9 / §15 →
STOP CHATGPT_AUTHORING_REQUIRED). Changing the vitest pool configuration would be
an unauthorized modification of the protected `vitest.config.ts`. This builder
therefore discloses the flake with full evidence, demonstrates zero **genuine**
failures via the deterministic serialized full-suite run (pre- and post-build)
and the isolation run, and leaves the pre-existing S14B tests untouched.
`--no-file-parallelism` was passed only as a CLI flag; no tracked file was
modified for it.

## 12. Limitations

- Credential / dangerous-env recognition and secret-output recognition reuse the
  registry `sensitive()` recognizer — a finite recognizer of common shapes, not a
  universal classifier.
- Path normalization is exact-string replacement of the canonical workspace root
  and the canonical / configured executable path only (most specific first).
- POSIX process-group cleanup is proven for ordinary and stubborn (SIGTERM-
  handling) same-group descendants on Linux/WSL Node 24; a program that leaves the
  group via `setsid()` is outside the accepted profile threat model. `TIMEOUT`
  cleanup is bounded and its message claims an attempt, not guaranteed
  extinction. No OS container, anti-daemon sandbox or network isolation is
  claimed.
- The final kernel spawn-window residual in §9 stands.
- The one authorized pre-existing modification is TEST-HARNESS MAINTENANCE to
  `tests/filesystem-capability/audit.ts` only, byte-identical to the Round-2
  maintenance; it does not reopen or alter the accepted S14B production
  implementation.
- The pre-existing S14B `CONC-POS-003` full-suite timing flake (§11) is disclosed,
  is not in S14C scope, and is not modified here.
- This gate covers the authorized S14C `shell.execute` provider only. Git
  processes, GitHub API, docs/web search, browser, PostgreSQL, MCP, OAuth,
  credential storage and any S14D+ surface are out of scope and not present.

## 13. Commit and publication

- Candidate on branch `s14c-shell-capability-part-b-round3`, a strictly linear
  descendant of `main` (`3cd344d018dbf2d40a39a907a3494bba8f3d940b`). Push is a
  fast-forward; the remote branch SHA equals the exact local candidate SHA; no
  force push. Rejected branches `s14c-shell-capability-part-b` (`25068c…`) and
  `s14c-shell-capability-part-b-round2` (`774f2bf…`) are not moved. No merge to
  `main`; no `main` movement; no `STATE.yaml` / `CURRENT.md` phase-closure edit.
  The exact remote Round-3 candidate SHA to source-audit is stated in the
  `S14C_ROUND3_BUILDER_HANDOFF` relay for this gate.

## 14. Next action

CONTROL_PLANE_SOURCE_AUDIT_OF_THE_EXACT_ROUND3_REMOTE_CANDIDATE, then a fresh
non-authoring, non-fork, read-only independent verification of that exact remote
candidate. This builder did not launch the independent verifier, does not claim a
verifier outcome, does not close S14C or S14, does not award HI-054 and does not
authorize S14D.
