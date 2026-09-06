# S14C Shell Capability — Round 5 Builder Verification

Status: S14C ROUND5 BUILDER PASS AWAITING CONTROL-PLANE SOURCE AUDIT
S14C: ROUND5_BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT
S14: IN_PROGRESS / NOT_CLOSED
HI-054: NOT_AWARDED
S14D: NOT_AUTHORIZED

This report is factual builder evidence for the Round-5 S14C candidate on branch
`s14c-shell-capability-part-b-round5`. It preserves the complete rejected Round-1
through Round-4 history and does not claim independent-verifier acceptance, phase
closure, S14 completion, the HI-054 honor, or S14D authorization.

## 1. Lineage and control-plane authority

| Event | Reference |
| --- | --- |
| S14C Part A authoring | Issue #1 comment `5555687848` |
| Original Part B authorization | Issue #1 comment `5555785836` |
| Round-1 candidate published | `25068c4351730b4de02b950065c614f9be68568f` on branch `s14c-shell-capability-part-b` |
| Round-1 source-audit FAIL + Round-2 remediation authorization | Issue #1 comment `5556004891` |
| Round-2 candidate published | `774f2bfb38034c85d20763bb2b5703b45cb4eaf2` on branch `s14c-shell-capability-part-b-round2` |
| Round-2 source-audit FAIL + Round-3 remediation authorization | Issue #1 comment `5556308690` |
| Round-3 candidate published | `acc7785933743048ebb75e4284b127e97ee3b237` on branch `s14c-shell-capability-part-b-round3` |
| Round-3 source-audit FAIL + Round-4 test-determinism remediation authorization | Issue #1 comment `5556617161` |
| Round-4 candidate published | `03d84792368ae9a985ce55f6fcf34c7f15a1edd1` on branch `s14c-shell-capability-part-b-round4` |
| Round-4 source-audit PASS / verifier authorization | Issue #1 comment `5556973359` |
| Round-4 fresh independent verifier FAIL | Issue #1 comment `5559233444` |
| Round-4 verifier FAIL accepted / Round-5 remediation authorization | Issue #1 comment `5559342564` |

All four rejected histories are preserved, not erased. Round-1 `25068c…`,
Round-2 `774f2bf…`, Round-3 `acc7785…` and Round-4 `03d8479…` remain on
`origin`, unmoved.
`git merge-base --is-ancestor <rejected> HEAD` = **false** for all four, and the
Round-5 parent and merge-base are exactly `main`
`3cd344d018dbf2d40a39a907a3494bba8f3d940b`. Round 5 was built in a fresh
WSL-native clone (`/home/yosman/brain-s14c-round5-builder-20260906`), branched
directly from exact `main`; no rejected builder or verifier worktree was used as
the authoritative Round-5 surface.

Round-3 failed the source audit for one reason: the report disclosed a
pre-existing, scheduling-sensitive flake in the S14B
`tests/filesystem-capability/concurrency.test.ts` suite under the default Vitest
parallel pool (observed ~20–25 % of full-suite runs), which the control plane
required to be made deterministic rather than merely disclosed. Round 4 carries
no S14C production change; it adds one narrow, explicitly authorized
test-harness repair (§3) that converts that suite's publication-observation
timing from `until(...)` event-loop polling to explicit deferred event barriers.

```text
3cd344d  (remote main, unmoved)
   ├── 25068c   [ROUND 1 — control-plane SOURCE-AUDIT FAIL, comment 5556004891]
   ├── 774f2bf  [ROUND 2 — control-plane SOURCE-AUDIT FAIL, comment 5556308690]
   ├── acc7785  [ROUND 3 — control-plane SOURCE-AUDIT FAIL, comment 5556617161]
   ├── 03d8479  [ROUND 4 — fresh verifier FAIL, comment 5559233444]
   └── <Round-5 candidate>   (this report)
```

## 2. Round-2 and Round-3 remediations preserved verbatim in Round 4

Round 4 imports the Round-3 candidate tree file content unchanged and adds **no
S14C production change**. Every `src/providers/capability/shell/**` file is
byte-identical to Round-3 `acc7785…` (`git diff acc7785 HEAD -- src/` is empty).
The Round-1 and Round-2 remediation teeth checks (Blocker A / B / #1 / #2) were
re-run in the Round-4 tree against a throwaway copy and still bite; the shipped
tree was then confirmed byte-identical.

- **Blocker A** (process-group SIGTERM→SIGKILL escalation that the leader's
  `close` cannot cancel; bounded liveness poll) — `execution.ts` unchanged;
  `S14C-HI-028` / `S14C-HI-029` green; teeth: reverting the `close` handler fails
  both.
- **Blocker B** (one invocation-wide `Deadline`; `tighten()` shrink-only;
  remaining budget to the child, never a fresh timeout) —
  `workspaceShellCapabilityProvider.ts` `Deadline` unchanged; `S14C-HI-021`
  green; teeth: no-op `tighten()` fails `S14C-HI-021`.
- **Blocker #1** (executable-realpath / configured-executable normalization
  **before** the workspace-root prefix, so an executable located inside
  `workspace_root` still renders `<executable>`) — `normalize()` unchanged;
  `S14C-HI-026` green; teeth: the Round-2 root-first order fails `S14C-HI-026`.
- **Blocker #2** (bounded, truthful `TIMEOUT` message that claims an *attempt*,
  not guaranteed group extinction; `FAIL` / `TIMEOUT` / `retryable: true`
  unchanged) — message unchanged; `S14C-HI-028` green; teeth: the Round-2
  wording fails `S14C-HI-028`.

The remaining subsections of §2 (below) and §3 record those fixes as originally
made. §3.5 records the new Round-4 test-harness determinism repair.

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

## 3.5. Why Round 3 failed source audit and how Round 4 fixes it

Authority: Issue #1 comment `5556617161`. **No S14C production change.** The
Round-3 report disclosed — rather than repaired — a pre-existing timing fragility
in the S14B write-concurrency suite: under the default Vitest parallel pool,
`tests/filesystem-capability/concurrencyExercises.ts` observed two publication
events with a scheduling-sensitive `until(predicate, label, tries = 5000)` loop
that spins on `setImmediate`. Under heavy parallel CPU load the awaited real
filesystem I/O (dir-handle opens, hash, temp write, `fsync`, `rename`) does not
complete within 5000 event-loop turns, so the poll throws
`concurrency condition never reached: …`. Observed on both the Round-2 and
Round-3 candidate trees in ~20–25 % of full-suite runs (never on the pristine
baseline, whose smaller suite applies far less parallel pressure). The two
affected exercises are `differentTargetsProgressConcurrently`
(`CONC-POS-003` / `S14B-CONC-HI-004`) and `heldLockBlocksSecondSameTargetWriter`
(`S14B-CONC-HI-002` / `S14B-CONC-HI-006`).

**Round-4 fix — the one newly authorized narrow test-harness modification**
(`tests/filesystem-capability/concurrencyExercises.ts` only; TEST-HARNESS
DETERMINISM MAINTENANCE):

- The `until(...)` poll and its `setImmediate` `tick()` helper are **removed**
  entirely, along with the `for (let i = 0; i < 200; i++) await tick();`
  scheduling spin. A tiny `deferred()` factory (a `Promise` + its `resolve`) is
  added.
- `differentTargetsProgressConcurrently`: the intercepting `fs.rename` spy now
  `resolve()`s an `aAtPublication` barrier the instant writer A enters its
  publication syscall, and a `bAtPublication` barrier the instant writer B
  enters its own. The test `await`s `aAtPublication`, starts writer B, `await`s
  `bAtPublication`, then asserts `bReachedPublication === true` **and**
  `aPublicationCompleted === false` (A has not returned from `fs.rename`, so A
  still holds its lock) before releasing A. Both writers must still resolve
  `SUCCESS`, `a` must read `"A2"`, `b` must read `"B2"`, and
  `activeTargetWriteLockCount()` must be `0` — all preserved.
- `heldLockBlocksSecondSameTargetWriter`: the spy `resolve()`s a
  `firstAtPublication` barrier when writer 1 enters its first `fs.rename`. The
  test `await`s it, snapshots `opensObserved` / `renameCalls`, then starts writer
  2. The provider path from `invoke()` through `perform()` into
  `withTargetWriteLock()` reaches `await prior` with **no intervening `await`
  and no filesystem I/O** (`domain.pending` is incremented synchronously), so
  writer 2's continuation cannot run until writer 1 releases. The test therefore
  asserts `opensObserved === opensAtPark` and `renameCalls === 1` immediately,
  with **no scheduling wait at all**. After release: writer 1 `SUCCESS`, writer 2
  `BLOCKED` on the now-stale hash, `opensObserved > opensAtPark`, `renameCalls`
  still `1`, `t` reads `"B"`, no temp residue, zero lock-domain residue — all
  preserved.
- The Vitest per-test timeout in the byte-identical `concurrency.test.ts`
  (30 s regressions / 45 s invariants) remains the only deadlock safety net.

**Exactness proof** — `concurrencyExercisesMaintenanceExact()`
(`tests/shell-capability/audit.ts`, run by `assertBoundaries()`,
`S14C-HI-037`, `FX-NEG-042`, `UC10` and a dedicated `regressions.test.ts` case):
`concurrency.test.ts` is byte-identical to `baseline`; the import block, the
stable const helpers, **every** exercise function other than the two authorized
ones, and the entire canonical `regressions` / `invariants` / re-export block are
byte-identical to `baseline:concurrencyExercises.ts`; the tokens `until(`,
`tries=`, `setImmediate`, `setTimeout`, `setInterval`, `.retry(`, `retry:`,
`tick(` and `for (let i = 0; i < 200` are all absent from the maintained file;
the two authorized functions did change; and their asserted
`SUCCESS` / `BLOCKED` / byte / `activeTargetWriteLockCount() === 0` outcomes are
all still present.

## 3.6. Why Round 4 failed independent verification and how Round 5 fixes it

Authority: fresh verifier relay `5559233444`, accepted with Round-5 remediation
authorization in control-plane comment `5559342564`. Round 4 passed source audit
but did **not** pass independent verification. The fresh verifier observed one
real failure in `S14C-HI-029` through `FX-NEG-039`: the `treeflood` process group
could reach output overflow before its ordinary grandchild had written
`neg39-f.pid`, leaving the probe unable to identify and prove cleanup of the
required grandchild. `stubbornflood` carried the same readiness race.

Round 5 changes no production code. Both overflow fixtures now use a real Node
IPC readiness channel with no `detached`, `setsid` or daemonization:

1. the grandchild remains in the provider-created process group;
2. `stubbornflood` installs its SIGTERM-resisting handler first;
3. the grandchild synchronously writes its own PID marker;
4. the grandchild sends a structured `ready` message containing its PID and the
   observed child/parent process-group IDs;
5. the parent receives readiness, synchronously reads and validates the
   grandchild-written marker, records a separate `.ready` proof, and only then
   begins stdout flooding.

The marker remains grandchild-written. `FX-NEG-039` and
`stubbornGrandchildOverflow` read that marker after provider completion, require
the readiness proof to identify the same positive PID, require child and parent
process-group IDs to match, require the expected ordinary/stubborn readiness
flag, and prove the marked PID is gone. A supplemental S14C regression pins the
source ordering and rejects immediate flooding, missing IPC, `detached` or
`setsid`. Timeout fixtures and production timeout behavior are unchanged.

Round-4 shell production and both S14B maintenance files are byte-identical in
Round 5. Only S14C-owned `fixtures.ts`, `cases.ts`, `processExercises.ts`,
`regressions.test.ts` and this report differ from Round 4.

## 4. Baseline and runtime truth

- Local `main` = `origin/main` = `git ls-remote origin refs/heads/main`
  = `3cd344d018dbf2d40a39a907a3494bba8f3d940b`.
- Rejected branches present and unmoved on `origin`:
  `s14c-shell-capability-part-b` = `25068c4351730b4de02b950065c614f9be68568f`;
  `s14c-shell-capability-part-b-round2` = `774f2bfb38034c85d20763bb2b5703b45cb4eaf2`;
  `s14c-shell-capability-part-b-round3` = `acc7785933743048ebb75e4284b127e97ee3b237`;
  `s14c-shell-capability-part-b-round4` = `03d84792368ae9a985ce55f6fcf34c7f15a1edd1`.
- Round-5 branch `s14c-shell-capability-part-b-round5` was cut from exact `main`
  in a fresh isolated WSL-native clone
  (`/home/yosman/brain-s14c-round5-builder-20260906`, POSIX/LF). No rejected
  builder or verifier worktree was reused as the authoritative build surface.
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

Re-checked from the Round-5 tree inside the test run (`partAIntact()`). No
semantic erratum was authored; Round 5 preserves the existing contract as
written, including §26.

## 6. Exact candidate scope against baseline `3cd344d…`

`git diff --name-status 3cd344d..HEAD`: **13 additions + exactly two authorized
modifications**. The added file set is unchanged from Round 4. All three
`src/providers/capability/shell/**` production files and both modified S14B
harness files are byte-identical to Round 4. Round-5 remedial differences versus
Round 4 are limited to `tests/shell-capability/fixtures.ts`, `cases.ts`,
`processExercises.ts`, `regressions.test.ts` and this report.

Modified (2, TEST-HARNESS MAINTENANCE only):
- `tests/filesystem-capability/audit.ts` — the Blocker-C narrow continuity
  exemption, **byte-identical to the Round-2 / Round-3 maintenance**. 5
  insertions, 1 deletion vs baseline.
- `tests/filesystem-capability/concurrencyExercises.ts` — the Round-4 event-barrier
  determinism maintenance (§3.5). Every exercise function except
  `differentTargetsProgressConcurrently` and `heldLockBlocksSecondSameTargetWriter`
  is byte-identical to baseline; `concurrency.test.ts` is byte-identical; the
  canonical `regressions` / `invariants` inventories and re-exports are
  byte-identical; no retry / sleep / timer was added.

Added production tree `src/providers/capability/shell/` (3): `types.ts`,
`execution.ts`, `workspaceShellCapabilityProvider.ts` — **byte-identical to
Round-4 `03d8479…`**. `node:child_process` only; no new dependency.

Added focused test tree `tests/shell-capability/` (9): `fixtures.ts`,
`helpers.ts`, `audit.ts`, `cases.ts`, `processExercises.ts`,
`shellCapability.test.ts`, `unsafeCounters.test.ts`,
`registryCompatibility.test.ts`, `regressions.test.ts`.

Added report (1): this file.

No `src/core/**`, `src/providers/capability/registry/**`,
`src/providers/capability/filesystem/**` (production), `tests/capability-registry/**`,
any **other** `tests/filesystem-capability/**` file (`concurrency.test.ts`
included), `package.json`, `package-lock.json`, `tsconfig.json`,
`vitest.config.ts`, `brain-bootstrap/STATE.yaml` or `brain/context/CURRENT.md`
change. `assertBoundaries()` walks every tracked file at `3cd344d…` (excluding
only the two authorized `M`), asserts each byte-identical, asserts every addition
is under an authorized S14C path, and asserts the sorted modification list is
exactly `["M\ttests/filesystem-capability/audit.ts",
"M\ttests/filesystem-capability/concurrencyExercises.ts"]`; re-run in the
committed state it still reports 13 `A` + 2 `M`.

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

## 10. Round-4 QA sequence and results — historical builder evidence

Round 4 later failed fresh independent verification at `S14C-HI-029` as recorded
in comment `5559233444`; the table below is preserved as historical builder
evidence and is not presented as an independent PASS.

| # | Check | Result |
| --- | --- | --- |
| 1 | Remote truth (`main` `3cd344d…`; Round-1 `25068c…`; Round-2 `774f2bf…`; Round-3 `acc7785…`; Round-4 branch absent pre-push) | PASS |
| 2 | Rounds 1–3 preserved; `merge-base --is-ancestor` **false** for all three vs Round-4 HEAD; merge-base of each with HEAD = `3cd344d…` | PASS |
| 3 | Round-4 does not descend from `25068c…`, `774f2bf…` or `acc7785…` | confirmed |
| 4 | Part A blob checks (`partAIntact()`) | 3 / 3 |
| 5 | `npm ci`; `package-lock.json` byte-identical to baseline | PASS |
| 6 | `tsc --noEmit -p tsconfig.json` | PASS |
| 7 | S14A focused `tests/capability-registry` | **110 / 110 PASS** |
| 8 | S14B focused `tests/filesystem-capability` (incl. the maintained `concurrency.test.ts`) | **169 / 169 PASS — ZERO failures** |
| 9 | S14C focused `tests/shell-capability` (4 files; +1 `it()` for the new exactness proof) | **125 / 125 PASS** |
| 10 | Canonical S14C positives `FX-POS-001..014` | **14 / 14** |
| 11 | Canonical S14C negatives `FX-NEG-001..042` | **42 / 42** |
| 12 | Canonical S14C hard invariants `S14C-HI-001..040` | **40 / 40** |
| 13 | Unsafe counters `UC01..UC12` — legitimate zero + each detector fireable | **12 / 12** |
| 14 | No S14C production change: `git diff acc7785 HEAD -- src/` | empty |
| 15 | Round-3 Blocker #1 (executable-inside-workspace normalization) still green + teeth still bites | PASS / confirmed |
| 16 | Round-3 Blocker #2 (bounded truthful `TIMEOUT` message) still green + teeth still bites | PASS / confirmed |
| 17 | Round-1 Blocker A / B teeth re-run in a throwaway copy of the Round-4 tree; reverts discarded, shipped tree confirmed byte-identical | confirmed |
| 18 | Stubborn same-group grandchild TIMEOUT / OUTPUT_OVERFLOW escalation (unchanged) | grandchild SIGKILLed & `ESRCH`; `FAIL / TIMEOUT` resp. `FAIL / EXECUTION_FAILED` |
| 19 | Pre-spawn timeout (profile / request smaller) + remaining-budget-not-reset (unchanged) | `FAIL / TIMEOUT`, no spawn |
| 20 | output exact max / max+1; invalid UTF-8; secret output; cwd adversarial; executable drift; permission denial | PASS |
| 21 | real registry / real RestrictedCapabilityProvider / real runAgent / provider–profile swap byte identity / legal-max envelope | PASS |
| 22 | S14B `audit.ts` maintenance exactness (`s14bAuditMaintenanceExact` / `Mechanical`) — byte-identical to Round-2/3 | PASS |
| 23 | **Round-4 determinism maintenance exactness** (`concurrencyExercisesMaintenanceExact`): `concurrency.test.ts` byte-identical to baseline; every unaffected exercise fn + inventories + re-exports byte-identical; polling/retry/sleep/timer tokens absent; two authorized fns changed; outcome assertions preserved | PASS |
| 24 | `tests/filesystem-capability/concurrency.test.ts` in isolation | **22 / 22 consecutive runs, each 19 / 19** |
| 25 | **DEFAULT `npm test` (`vitest run`, default parallel pool) — consecutive ZERO-failure qualification, reset-to-zero on any failure** | **13 / 13 consecutive runs on the final candidate tree, each 36 files / 1785 passed — 0 failures, 0 resets** (an earlier 14 / 14 consecutive run on the pre-`audit.ts`-hardening tree — identical `concurrencyExercises.ts` and provider — is corroborating, not counted) |
| 26 | Repo-local `dist/` genuinely absent before build | absent |
| 27 | Genuine clean build `npm run build` (`tsc -p tsconfig.json`) | PASS |
| 28 | Emitted artifacts | 918 files (306 `.js` + 306 `.js.map` + 306 `.d.ts`); shell provider at `dist/src/providers/capability/shell/` |
| 29 | **DEFAULT `npm test` AFTER build** (14th consecutive default-parallel green on the final tree) | **36 files / 1785 passed — ZERO failures** |
| 30 | `git show --check HEAD` / `git diff --check 3cd344d..HEAD` | clean |
| 31 | Exact baseline-to-candidate scope audit (committed state) | 13 `A` under S14C paths + exactly `M tests/filesystem-capability/audit.ts` and `M tests/filesystem-capability/concurrencyExercises.ts` |
| 32 | Protected-boundary blob comparison (Core / Restricted / compile / registry `*.ts` / filesystem **production** + lock / `concurrency.test.ts` / other `tests/filesystem-capability/**` / `tests/capability-registry/**` / `package.json` / `package-lock.json` / `tsconfig.json` / `vitest.config.ts` / `STATE.yaml` / `CURRENT.md`) + 3 Part A blobs | byte-identical |
| 33 | Dependencies added | none |
| 34 | S14D+ / git / GitHub / network / browser / PostgreSQL / MCP / OAuth surface | none (`shellFutureSurface` 0, fireable) |
| 35 | `--no-file-parallelism` used only as supplemental diagnostic, **never as the canonical gate** | the gate above (row 25 / 29) is the default `npm test` |

## 11. Determinism of the write-concurrency suite under the default gate

The Round-3 failure was the *disclosure* (not repair) of a scheduling-sensitive
flake in `tests/filesystem-capability/concurrencyExercises.ts`. Round 4 repairs
it in place with the one newly authorized narrow test-harness modification (§3.5)
and re-qualifies the suite against the repository's **canonical** command,
`npm test` (`vitest run`, default parallel pool). `--no-file-parallelism` was
used only as supplemental diagnostic evidence; it is **not** the gate.

### Repair

The `until(predicate, label, tries = 5000)` polling helper and its `setImmediate`
`tick()`, plus the `for (let i = 0; i < 200; i++) await tick();` scheduling spin,
are removed. Both affected exercises now learn that a publication event happened
from a `deferred()` barrier the intercepting `fs.rename` spy `resolve()`s at the
instant the event occurs. `heldLockBlocksSecondSameTargetWriter` additionally
relies on a **structural** fact (verified in-repo): the provider path
`invoke() → perform() → withTargetWriteLock()` reaches `await prior` with no
intervening `await` and no filesystem I/O — `domain.pending` is incremented
synchronously — so a second same-target writer's continuation cannot run until
the first releases, and the "no filesystem precondition, no publication while the
lock is held" assertion is made with **zero scheduling wait**. Every asserted
`SUCCESS` / `BLOCKED` / byte / `activeTargetWriteLockCount() === 0` outcome is
preserved (and, for `differentTargetsProgressConcurrently`, strengthened:
`aPublicationCompleted === false` is now asserted directly).

### Stress results (this Round-4 candidate tree)

| Configuration | Runs | Result |
| --- | --- | --- |
| **`npm test` (default `vitest run`, default parallel pool)** — consecutive ZERO-failure qualification on the final candidate tree, reset-to-zero on any failure | **13 / 13 consecutive** | each **36 files / 1785 passed — 0 failures**; **0 resets** |
| `npm test` (default) immediately AFTER a genuine clean `npm run build` | 1 (14th consecutive on the final tree) | **36 files / 1785 passed — 0 failures** |
| `npm test` (default) on the pre-`audit.ts`-hardening tree (identical `concurrencyExercises.ts` + provider) — corroborating only | 14 / 14 consecutive | each **1785 passed — 0 failures**; **0 resets** |
| `tests/filesystem-capability/concurrency.test.ts` in isolation | **22 / 22 consecutive** | each **19 / 19** |
| `--no-file-parallelism` full suite (supplemental diagnostic only, **not the gate**) | 3 | **1785 / 1785** each |

No `concurrency.test.ts` failure — nor any other failure — occurred in any of
these runs. The earlier Round-2/Round-3 rate for this suite under the same
default pool was ~20–25 %.

### Scope discipline

The repair touches `tests/filesystem-capability/concurrencyExercises.ts` **only**
(the second and last authorized pre-existing `M`). `concurrency.test.ts`,
`tests/filesystem-capability/audit.ts` (beyond its unchanged Round-2 form),
`vitest.config.ts`, `package.json` and every other tracked file at `3cd344d…`
are byte-identical. No `tries` value was raised, no `setTimeout` / `setInterval`
introduced, no test retry added, and `--no-file-parallelism` is not wired into
any tracked file. `concurrencyExercisesMaintenanceExact()` enforces all of this
mechanically on every S14C suite run.

## 11.5. Round-5 QA and determinism qualification

All counted commands used Node `v24.19.0`, npm `11.17.0` and Vitest `4.1.11`.
`npm ci` completed with zero vulnerabilities and left `package-lock.json`
byte-identical (`6d9cb3ceb9cdbf9b88f889f28cb165eaecc2810e`).

| Check | Round-5 result |
| --- | --- |
| `npm run typecheck` | PASS / zero errors |
| S14A focused `tests/capability-registry/**` | **110 / 110 PASS** |
| S14B focused `tests/filesystem-capability/**` | **169 / 169 PASS** |
| S14C focused `tests/shell-capability/**` | **126 / 126 PASS** |
| Canonical positives `FX-POS-001..014` | **14 / 14 PASS** |
| Canonical negatives `FX-NEG-001..042` | **42 / 42 PASS** |
| Canonical HIs `S14C-HI-001..040` | **40 / 40 PASS** |
| Unsafe counters `UC01..UC12` | **12 / 12 legitimate zero + detector fireability PASS** |
| `FX-NEG-039` targeted final qualification | **30 / 30 consecutive PASS**, one real target test executed per run, marker-race failures 0 |
| `S14C-HI-029` targeted final qualification | **10 / 10 consecutive PASS**, one real target test executed per run, marker-race failures 0 |
| S14B `concurrency.test.ts` | **20 / 20 consecutive**, every run **19 / 19 PASS** |
| Canonical default `npm test` | **12 / 12 consecutive**, every run **36 files / 1786 tests PASS**, zero failures |
| Dist before build | absent |
| `npm run build` | PASS |
| Emitted artifacts | **918** total: 306 `.js`, 306 `.js.map`, 306 `.d.ts` |
| Post-build default `npm test` | **36 files / 1786 tests PASS**, zero failures |

An initial targeted command used anchored Vitest name filters; because Vitest
matches suite-qualified names, those invocations selected zero tests. They were
explicitly discarded and never counted. The final 30-run and 10-run series were
restarted from zero with filters whose every summary showed exactly `1 passed /
96 skipped`; no failed final qualification was retried or hidden.

The extra S14C test is the supplemental readiness-order regression in
`regressions.test.ts`; canonical inventory IDs and counts remain unchanged. The
canonical full-suite gate remained ordinary `npm test` with default parallelism;
`--no-file-parallelism` was not used as a Round-5 gate.

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
- The two authorized pre-existing modifications are TEST-HARNESS MAINTENANCE only:
  `tests/filesystem-capability/audit.ts` (byte-identical to the Round-2/3
  continuity exemption) and `tests/filesystem-capability/concurrencyExercises.ts`
  (the Round-4 event-barrier determinism repair, §3.5). Neither reopens or alters
  the accepted S14B production implementation; `concurrency.test.ts` and the S14B
  production tree are byte-identical to baseline.
- The Round-4 determinism repair changes *how a test observes* a publication
  event, not *what* it asserts. The two exercises' `SUCCESS` / `BLOCKED` /
  byte-content / lock-residue assertions are unchanged.
- This gate covers the authorized S14C `shell.execute` provider only. Git
  processes, GitHub API, docs/web search, browser, PostgreSQL, MCP, OAuth,
  credential storage and any S14D+ surface are out of scope and not present.

## 13. Commit and publication

- Candidate branch: `s14c-shell-capability-part-b-round5`, cut directly from
  `main` `3cd344d018dbf2d40a39a907a3494bba8f3d940b` and not descended from any
  rejected candidate. Publication is a normal new-branch push with no force.
- Rejected branches Round 1 `25068c…`, Round 2 `774f2bf…`, Round 3 `acc7785…`
  and Round 4 `03d8479…` remain unmoved.
- No merge to `main`, no `main` movement, and no `STATE.yaml` / `CURRENT.md`
  phase-closure edit. The exact remote Round-5 candidate SHA is returned in the
  `S14C_ROUND5_BUILDER_HANDOFF`.

## 14. Next action

CONTROL_PLANE_SOURCE_AUDIT_OF_THE_EXACT_ROUND5_REMOTE_CANDIDATE. This builder
did not launch the independent verifier, does not claim a verifier outcome, does
not close S14C or S14, does not award HI-054 and does not authorize S14D.
