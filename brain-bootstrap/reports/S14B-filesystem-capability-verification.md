# S14B Filesystem Capability — Round 2 Builder Verification

Status: S14B ROUND2 BUILDER PASS AWAITING CONTROL-PLANE SOURCE AUDIT / INDEPENDENT VERIFICATION
S14B: ROUND2_BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT
S14: IN_PROGRESS / NOT_CLOSED
HI-054: NOT_AWARDED
S14C: NOT_AUTHORIZED

This report is factual builder evidence for the exact Round-2 candidate. It does
not claim independent-verifier acceptance, phase closure, S14 completion, the
HI-054 honor, or S14C authorization.

## 1. Lineage and control-plane authority

| Event | Reference |
| --- | --- |
| Original Part B authorization | Issue #1 comment `5554335964` |
| Registry compatibility erratum authoring | Issue #1 comment `5554381954` |
| Resume authorization after the registry erratum | Issue #1 comment `5554420882` |
| Round-1 candidate published | `efff516b0bec42cef8acff3780fe9f0d70439ee8` on branch `s14b-filesystem-capability-part-b` |
| Round-1 builder QA | Prior report on the Round-1 branch: BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT |
| Round-1 source-audit FAIL | Issue #1 comment `5554727698` |
| Write-concurrency clarification authoring | Issue #1 comment `5554738999` |
| Clarification integrated on main | `990483118d623d4af5caf6b2d05cb79a4a3feb02` (parent `28acc89f00d62d5cdb626f3eee2e93ade69b0227`) |
| Round-2 builder authorization | Issue #1 comment `5554801378` |

The Round-1 source-audit FAIL is preserved, not erased. The rejected candidate
`efff516…` remains a historical sibling of current `main`: their merge-base is
`28acc89…`, they are intentionally divergent, and this Round-2 candidate is a
direct linear descendant of `990483…` — the rejected commit is **not** in Round-2
ancestry.

```text
28acc89
   ├── efff516   [REJECTED ROUND 1 — source-audit FAIL 5554727698]
   └── 990483    [write-concurrency clarification integrated on main]
          ↓
       <Round-2 candidate>   (this report)
```

STATE.yaml and CURRENT.md still carry older "S14B not authorized" wording; the
S14B Part A, registry erratum and write-concurrency clarification integrations
each intentionally left continuity untouched. Repository/runtime truth plus the
comments above are the controlling authority for this implementation gate. This
builder does not edit STATE.yaml or CURRENT.md.

## 2. Baseline and runtime truth

- local `main` = `origin/main` = `git ls-remote origin refs/heads/main`
  = `990483118d623d4af5caf6b2d05cb79a4a3feb02`.
- Round-2 branch `s14b-filesystem-capability-part-b-round2` was created from that
  exact baseline in a clean, isolated, WSL-native worktree
  (`/home/yosman/brain-s14b-round2`, POSIX/LF, `core.autocrlf` unset,
  `git diff --check` clean at checkout).
- Rejected Round-1 branch still present and unchanged:
  `s14b-filesystem-capability-part-b` = `efff516b0bec42cef8acff3780fe9f0d70439ee8`
  (local and `origin`).
- `git merge-base 990483… efff516…` = `28acc89f00d62d5cdb626f3eee2e93ade69b0227`.
- Pre-existing unrelated local work in the ordinary Windows/WSL checkout
  (S13N/S13O modifications, CRLF-only modifications, untracked scaffolds) was not
  reset, stashed, cleaned, deleted or staged. No existing branch or worktree was
  force-moved; nothing was merged into `main`; no branch was force-pushed.
- Node `v24.19.0`, npm `11.17.0`. `npm ci` restored 55 packages;
  `better-sqlite3@13.0.3` loads from its bundled `linux-x64` prebuild and a real
  in-memory SQLite round-trip succeeds. `package-lock.json` is byte-identical to
  baseline after `npm ci`. Vitest `4.1.11`.

## 3. Nine canonical authored artifacts — proven immutable

| Artifact | Blob at candidate |
| --- | --- |
| `brain-bootstrap/skills/FILESYSTEM_CAPABILITY_SKILL_S14B.md` | `af54ebf3862685c41cf2bad8e5d8d169b927c518` |
| `brain-bootstrap/quality-contracts/S14B_FILESYSTEM_DEEP.yaml` | `379a75ff43374806893ba053d8c812d7ba79a3d3` |
| `brain-bootstrap/specs/FILESYSTEM_CAPABILITY_CONTRACT_S14B.md` | `8307092cbd9642db889e1fafdaf2d5d7a1357cee` |
| `brain-bootstrap/decisions/ADR-s14b-registry-result-envelope.md` | `652a36d0ab52aa2318b294dea2ebceb29ee9ab88` |
| `brain-bootstrap/quality-contracts/S14B_REGISTRY_COMPATIBILITY_ERRATUM_DEEP.yaml` | `1d610b667700b64f746007c72d7fd22b91c9bf4b` |
| `brain-bootstrap/specs/S14B_REGISTRY_COMPATIBILITY_ERRATUM.md` | `5183714b0541c838da932bae0285e2a409aee6d5` |
| `brain-bootstrap/decisions/ADR-s14b-write-concurrency-threat-model.md` | `ff862882d401eebde8d9aec84f71e748f14faa8e` |
| `brain-bootstrap/quality-contracts/S14B_WRITE_CONCURRENCY_CLARIFICATION_DEEP.yaml` | `419286dc25b165938df675f21ac1c9e1d91f99ab` |
| `brain-bootstrap/specs/S14B_WRITE_CONCURRENCY_CLARIFICATION.md` | `b4a48ec0b97a80dbfce50186d14b80b3db5515ba` |

All nine match the Round-2 authorization exactly and are unchanged by this
candidate. Because `990483…` tracks the three clarification documents, the
in-suite `protectedDifferences()` audit now proves every one of these blobs from
inside the test run (baseline ref updated to `990483118d…`).

## 4. Round-1 reference reuse

Per the Round-2 authorization the previously authorized Round-1 implementation and
test content was re-materialized from `efff516…:<path>` onto the Round-2 branch
(not cherry-picked as a history parent), then the concurrency remediation was
added on top. The Round-1 report was **not** carried over; this Round-2 report
replaces it and preserves the Round-1 FAIL in section 1.

Re-materialized unchanged from Round-1:

- `src/providers/capability/filesystem/workspaceFilesystemCapabilityProvider.ts`
  (then modified only for the lock wiring described in section 6);
- `src/providers/capability/registry/validation.ts` and
  `src/providers/capability/registry/capabilityRegistryProvider.ts`
  (the already-authorized result-envelope patch, byte-identical to Round-1);
- `tests/filesystem-capability/{helpers,cases,failureExercises}.ts`;
- `tests/filesystem-capability/{filesystemCapability,registryCompatibility,regressions,unsafeCounters}.test.ts`.

`tests/filesystem-capability/audit.ts` was re-materialized and its `baseline`
constant updated `28acc89…` → `990483118d…` (mechanical test-fixture change; the
`registryPatchOnly()` string reconstruction is unaffected because both registry
files are byte-identical between those two commits).

## 5. Exact production diff against baseline `990483118d…`

A full tree comparison against `990483…` (506 tracked files) shows exactly two
modified tracked files — both authorized by the registry-result-envelope erratum —
and two new untracked trees:

- `src/providers/capability/registry/validation.ts` — result-envelope split only.
  `canonical(value)` delegates to `canonicalWithin(value, 100000)` (descriptor /
  config / public-contract path, semantics unchanged); a new
  `canonicalToolResult(value)` runs the same bounded-depth (32), bounded-node
  (10000), accessor/prototype-rejecting, secret-rejecting traversal against an
  `8388608`-character envelope; the `ToolInvocationResult.evidence_refs` per-entry
  limit moves from `LIMITS.description` (2000) to `8192`. `LIMITS`, routing,
  provider selection, diagnostics, `validResult` union shape and the descriptor
  validator are untouched.
- `src/providers/capability/registry/capabilityRegistryProvider.ts` — `invoke()`
  validates the raw provider result through `canonicalToolResult(raw)` instead of
  `canonical(raw)` before `structuredClone` and `validResult`; `call_id` /
  `capability_id` identity checks and safe `fail()` normalization are unchanged.

New production tree `src/providers/capability/filesystem/`:

- `workspaceFilesystemCapabilityProvider.ts` (320 lines) — the Round-1 provider,
  with the same-target write lock wired in (section 6);
- `writeSerialization.ts` (93 lines, new) — the provider-layer, process-local
  same-target write lock. No new dependency; pure `node` built-ins only (in fact
  no imports at all).

New focused test tree `tests/filesystem-capability/`:
`helpers.ts`, `audit.ts`, `cases.ts`, `failureExercises.ts`,
`concurrencyExercises.ts` (new), and the test files
`filesystemCapability.test.ts`, `registryCompatibility.test.ts`,
`regressions.test.ts`, `unsafeCounters.test.ts`, `concurrency.test.ts` (new).

`src/providers/capability/registry/types.ts` and
`src/providers/capability/registry/validateConfig.ts` are byte-identical to
baseline.

## 6. Round-2 remediation — same-target write serialization

### 6.1 Lock module

`src/providers/capability/filesystem/writeSerialization.ts` exposes:

- `writeLockKey(rootDev, rootIno, logicalTarget)` — the lock identity is
  `` `${rootDev}:${rootIno}` `` (the device + inode of the **canonical resolved
  workspace root**, i.e. `WorkspaceFilesystemCapabilityProvider.rootStat`) joined
  with a NUL to the **already-validated logical target path**. A validated logical
  path can never contain NUL, so no target string can forge another workspace's
  `<dev>:<ino>` prefix.
- `withTargetWriteLock(key, operation)` — a per-key FIFO async mutex. It creates
  the lock domain lazily on first waiter, chains each waiter on the previous
  holder's release promise, and deletes the domain as soon as `pending` returns to
  zero, so completed one-shot targets do not accumulate. A previous holder's
  rejection (including a cleanup throw) is caught and never propagated to the next
  waiter; a `released` guard makes double-release a no-op. Release runs in a
  `finally`, so it is reached on SUCCESS, BLOCKED, FAIL and TIMEOUT alike.
- `activeTargetWriteLockCount()` — diagnostic-only domain count, used by the tests
  to prove non-leak. It returns a single integer, is never called by production
  code paths and never appears in any descriptor, result, error or evidence.

The lock identity uses **no** `AgentDefinition` field, `ToolDescriptor` field,
model-visible configuration, `provider_id`, test id or `call_id`.

### 6.2 Wiring

`WorkspaceFilesystemCapabilityProvider.perform()` routes `filesystem.read` and
`filesystem.list` straight to the unchanged operation body. For
`filesystem.write` it first acquires
`withTargetWriteLock(writeLockKey(this.rootStat.dev, this.rootStat.ino, path), …)`,
re-checks the deadline (a write that waited past its own timeout returns `FAIL
TIMEOUT` before any mutation), and only then runs parent/chain validation, the
initial target precondition, temp staging, the final chain + precondition checks,
the publication syscall and temp cleanup — the entire critical section is inside
the lock. The lock is released when that operation settles, i.e. after
`writeFile`'s `finally` temp cleanup and after `closeChain`.

Reads and lists never touch the lock, so the existing regression that performs a
`filesystem.list` / `filesystem.read` from inside a concurrent writer's `sync`
hook still runs without deadlock.

### 6.3 Properties proven

| Property | Evidence |
| --- | --- |
| Same-provider same-target concurrent overwrite → exactly one SUCCESS, one BLOCKED, final bytes = winner, no temp | `CONC-POS-001` / `S14B-CONC-HI-001` |
| Cross-provider-instance same-target concurrent overwrite → exactly one SUCCESS, one BLOCKED | `CONC-POS-002` / `S14B-CONC-HI-003` |
| Deterministic interception: while writer 1 is parked inside its publication syscall, writer 2 (separate instance) opens **zero** handles and reaches **no** precondition; after release it evaluates the now-stale hash and becomes BLOCKED before its own publication | `S14B-CONC-HI-002` / `S14B-CONC-HI-006` |
| Different targets are not globally serialized: writer B reaches and completes its own publication while writer A is parked at A's publication | `CONC-POS-003` / `S14B-CONC-HI-004` |
| Lock acquired before the CREATE_NEW / OVERWRITE_EXISTING precondition | interception test + wiring in `perform()` |
| Lock released on FAIL (injected temp-write `EIO`) — next legitimate writer to the same target succeeds; `activeTargetWriteLockCount()` returns to 0 | `CONC-NEG-003` / `S14B-CONC-HI-007` |
| Lock released on TIMEOUT (pre-commit deadline expiry) — next legitimate writer succeeds; count returns to 0 | `S14B-CONC-HI-007` |
| Idle lock domains do not accumulate across sequential and concurrent distinct-target writes | `S14B-CONC-HI-007` |
| Observed external content drift before the final precondition → BLOCKED, external bytes preserved, staged content not published, temp cleaned | `CONC-NEG-001` / `S14B-CONC-HI-008` |
| Observed parent-chain/topology drift (parent dir renamed + replaced during staging) before the final containment check → BLOCKED, no staged-content publication, original bytes preserved in the moved directory, no `.brain-fs-` residue in either the moved or the new directory | `CONC-NEG-002` / `S14B-CONC-HI-009` |
| No unrelated `await` between the final precondition and the publication syscall (static extraction of the window in the production source; detector proven fireable on an injected `await`) | `S14B-CONC-HI-010` |
| The lock key / raw `dev:ino` identity / host path never appear in a composed result, in evidence or in descriptors | `S14B-CONC-HI-005` |

All `S14B-CONC-HI-001..012` map one-to-one to
`S14B_WRITE_CONCURRENCY_CLARIFICATION_DEEP.yaml.concurrency_invariants`, and all
`CONC-POS-001..003` / `CONC-NEG-001..003` map one-to-one to
`…required_regressions`, checked by an in-suite inventory assertion.

Teeth: with the lock wiring neutralised, `CONC-POS-001`, `CONC-POS-002`,
`S14B-CONC-HI-001/002/003/006` fail; `CONC-POS-003` and the drift/cleanup
regressions still pass (they do not depend on the lock). With the lock in place
all pass.

## 7. Final-publication-window residual — GUARANTEED vs NOT CLAIMED IN V1

### GUARANTEED by this candidate

- S14B-cooperative same-target write serialization across every
  `WorkspaceFilesystemCapabilityProvider` instance in one Node process.
- Detected external content drift before the final precondition fails closed with
  no target mutation and no staged-content publication.
- Detected parent-chain / directory-topology drift before the final containment
  check fails closed with no staged-content publication and temp cleanup.
- The final publication window is minimal: final parent-chain check → final target
  precondition/hash check → synchronous deadline decision → immediate
  `fs.link` / `fs.rename`, with no model call, network, logging I/O, sleep,
  unrelated fs probe or async instrumentation in between.

### NOT CLAIMED IN V1

The following stronger properties are **not** asserted by this candidate, and the
narrow residual below is disclosed rather than presented as PASS evidence:

- Atomic compare-and-swap against a non-cooperating external process is not a v1
  property. Node's path-based `fs.rename` / `fs.link` plus user-space validation
  do not form one kernel CAS transaction with an arbitrary external writer.
- Race-free overwrite against every host process is not a v1 property.
- Absolute containment against hostile external directory / mount topology
  mutation inside the irreducible final publication window is not a v1 property.

Accepted residual, stated narrowly: a non-cooperating external process that
mutates the target pathname or the directory/mount topology **after** the final
validated check and **before or during** the final `fs.link` / `fs.rename`
publication syscall can still win that irreducible kernel window. This residual is
environmental; it is not evidence of a passing property and it is not hidden
behind stronger wording.

## 8. All Round-1 safety properties retained

The Round-1 canonical suites are unchanged and still pass in full: explicit
absolute workspace root; explicit read/write prefixes; no cwd/env/home/git-root
inference; provider-neutral logical paths; absolute / traversal / backslash / NUL
/ dot-segment rejection before target access; canonical containment; symlink
traversal rejection; hard-link (`nlink > 1`) overwrite rejection; protected
credential/control path floor; recognizable secret read/write rejection; 1 MiB
read/write bound; 1000-entry list bound; 4096-char path bound; strict fatal
UTF-8; CREATE_NEW no-clobber; `expected_sha256` overwrite precondition;
partial-write protection via same-parent temp + fsync + re-check + commit; temp
cleanup on every failure path; timeout truthfulness (no fictitious TIMEOUT after
commit begins); safe normalized errors; `workspace://` evidence only; no absolute
root leakage; real `CapabilityRegistryProvider` composition; real
`RestrictedCapabilityProvider` capability + side-effect gating; real
`compileAgentDefinition` → `runAgent` `filesystem.read`; byte-identical
`AgentDefinition` across provider/root swaps; no new dependency; no S14C+ surface.

## 9. Registry compatibility patch — required-target confirmation

| Property | State |
| --- | --- |
| `validation.ts` changed | yes — result-envelope split only (byte-identical to Round-1) |
| `capabilityRegistryProvider.ts` changed | yes — result-specific validation call only (byte-identical to Round-1) |
| `types.ts` unchanged | yes (byte-identical) |
| `validateConfig.ts` unchanged | yes (byte-identical) |
| descriptor / public-contract canonical max | `100000` — unchanged |
| descriptor description max | `2000` — unchanged |
| `ToolInvocationResult` canonical serialized max | `8388608` |
| `ToolInvocationResult` per `evidence_ref` max | `8192` |
| routing / provider-selection / ambiguity / collision / swap / identity | unchanged |
| diagnostics semantics and count limits | unchanged |
| secret-pattern rejection across the enlarged envelope | active |
| result union / shape / `call_id` / `capability_id` validation | unchanged |
| truncation / chunking / compression / registry bypass | none |

## 10. QA sequence and results

All commands run under Node `v24.19.0` / npm `11.17.0` in the isolated Round-2
worktree `/home/yosman/brain-s14b-round2`.

| # | Check | Result |
| --- | --- | --- |
| 1 | `node --version` / `npm --version` | `v24.19.0` / `11.17.0` |
| 2 | Nine canonical authored blob checks at baseline | PASS |
| 3 | Fresh isolated WSL worktree from exact baseline; `git status` clean; `git diff --check` clean; `core.autocrlf` unset; 506 tracked files | PASS |
| 4 | `npm ci`; `better-sqlite3` loads + SQLite round-trip; `package-lock.json` byte-identical | PASS |
| 5 | Full repository suite on pristine baseline | 27 files / 1491 passed |
| 6 | `npm run typecheck` with candidate applied (`tsc --noEmit`) | PASS |
| 7 | S14A focused suite `tests/capability-registry` | 2 files / **110 passed** |
| 8 | S14B registry-compatibility focused suite | `S14B-COMP-HI-001..012` 12/12, `COMP-POS` 4/4, `COMP-NEG` 4/4 |
| 9 | S14B filesystem focused suite `tests/filesystem-capability` (excl. concurrency) | 4 files / **150 passed** |
| 10 | Round-2 concurrency focused suite `tests/filesystem-capability/concurrency.test.ts` | 1 file / **19 passed** (`CONC-POS` 3/3, `CONC-NEG` 3/3, `S14B-CONC-HI-001..012` 12/12, + inventory map) |
| 11 | Canonical S14B positives `FX-POS-001..014` | **14 / 14** |
| 12 | Canonical S14B negatives `FX-NEG-001..036` | **36 / 36** |
| 13 | Canonical S14B hard invariants `S14B-HI-001..036` | **36 / 36** |
| 14 | Unsafe counters `UC01..UC12` — legitimate paths zero + each detector fireable | **12 / 12** |
| 15 | Same-provider concurrent same-target overwrite proof | 1 SUCCESS / 1 BLOCKED, final bytes = winner, no temp |
| 16 | Cross-provider-instance concurrent same-target overwrite proof (`S14B-CONC-HI-003`) | 1 SUCCESS / 1 BLOCKED |
| 17 | Deterministic publication-interception proof | writer 2 opens 0 handles while writer 1 holds the lock; BLOCKED after release |
| 18 | Different-target concurrent progress proof | writer B publishes while writer A is parked |
| 19 | Lock-release-on-failure proof | next same-target writer SUCCESS; domain count 0 |
| 20 | Lock-release-on-timeout proof | next same-target writer SUCCESS; domain count 0 |
| 21 | Observed external content drift proof | BLOCKED, external bytes intact, temp cleaned |
| 22 | Observed parent-chain/topology drift proof | BLOCKED, no publication, temp cleaned in both directories |
| 23 | No-unrelated-await final-publication audit (+ fireability) | 0 unrelated awaits; detector fires on injected await |
| 24 | Real disposable-filesystem adversarial exercise under `os.tmpdir()` (outside the repo tree) | PASS |
| 25 | Real `CapabilityRegistryProvider` composition (no filesystem special-case) | PASS |
| 26 | Real `RestrictedCapabilityProvider` composition — capability + `NONE` / `LOCAL` gating | PASS |
| 27 | Real `compileAgentDefinition` → `runAgent` `filesystem.read` against a disposable workspace | PASS |
| 28 | Provider / root swap under a byte-identical `AgentDefinition` | PASS |
| 29 | Full repository suite BEFORE the clean build | 32 files / **1660 passed** |
| 30 | Prove repo-local `dist/` genuinely absent | absent |
| 31 | Genuine clean build `npm run build` (`tsc -p tsconfig.json`) | PASS |
| 32 | Emitted artifact count | recorded below |
| 33 | Full repository suite AFTER the clean build | 32 files / **1660 passed** |
| 34 | `git diff --check` | clean |
| 35 | Exact baseline-to-candidate scope audit | 2 authorized modified files, 2 new production/test trees, nothing else |
| 36 | Dependency manifests (`package.json`, `package-lock.json`) vs baseline | byte-identical |
| 37 | S14C+ forbidden-surface scan over real production source (both filesystem `.ts` files) | zero, detectors fireable |
| 38 | Protected-boundary comparison (Core / Restricted / AgentDefinition / registry `types.ts` + `validateConfig.ts` / S13G / S13H / manifests / STATE / CURRENT / nine canonical docs) | byte-identical |

### Real disposable-filesystem evidence (`os.tmpdir()`, outside the repository worktree)

Root and nested listing; UTF-8 read with SHA-256; `CREATE_NEW`;
`OVERWRITE_EXISTING`; stale-hash no-mutation; final pre-commit hash check against
a real intervening write (no mutation, staging cleaned); `CREATE_NEW` `EEXIST`
publication race (winning file intact); simultaneous real `CREATE_NEW`
invocations (exactly one SUCCESS, one BLOCKED); same-target concurrent
`OVERWRITE_EXISTING` across one and across two provider instances (exactly one
SUCCESS, one BLOCKED); different-target concurrent progress; parent-chain
replacement during staging; symlink target block; intermediate symlink-component
block; hard-link (`nlink > 1`) overwrite block; protected-path block; secret-read
block; secret-write block; oversize read / write / list; invalid UTF-8 (`0xFF`,
overlong `0xC0 0x80`, surrogate `0xED 0xA0 0x80`, truncated `0xE2 0x82`);
allow-prefix denial; safe evidence with no root leakage; ordinary partial-write
OS failure (target unchanged, temp cleaned, lock released); pre-commit timeout
(no mutation, temp cleaned, lock released); post-commit deadline (true SUCCESS,
never TIMEOUT); temporary-name collision cannot remove or overwrite a
pre-existing file; per-test disposable workspace removal verified (`ENOENT` after
each). No canonical filesystem-capability test mutates the repository worktree.

## 11. Protected-boundary audit (byte-identical to `990483118d…`)

`src/core/agent/types.ts`, `src/core/agent/restrictedCapabilityProvider.ts`,
`src/core/agent/definition.ts`, `src/core/agent/runtime.ts`,
`src/core/agent/index.ts`, `src/providers/capability/registry/types.ts`,
`src/providers/capability/registry/validateConfig.ts`, all S13G / S13H tracked
surfaces, all top-level S14 Part A artifacts, all three S14B Part A artifacts, all
three registry-erratum artifacts, all three write-concurrency clarification
artifacts, `package.json`, `package-lock.json`, `tsconfig.json`,
`vitest.config.ts`, `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` —
all unchanged. No dependency added or removed. No S14C+ production surface
(shell / git process / GitHub API / network docs/search / browser / PostgreSQL /
MCP / OAuth / credential storage) introduced; the `futureSurface` /
`inferredScope` scanners over the real production source return zero and each is
proven fireable on an injected forbidden import / `process.cwd()` sample.

## 12. Commit and publication

- Candidate on branch `s14b-filesystem-capability-part-b-round2`,
  HEAD `d34b2a23648d118b064cabc5fa528ba97a33d8c9`, 2 commits ahead of and 0 behind
  `main`:
  - `ea5a050` — filesystem capability round 2 (same-target write serialization);
  - `d34b2a2` — tighten `S14B-CONC-HI-005` lock-visibility assertions (test only).
  Linear ancestry: `d34b2a2 → ea5a050 → 990483118d… (main)`.
- `git merge-base --is-ancestor efff516… HEAD` = false: `efff516…` is **not** in
  the Round-2 ancestry. The rejected Round-1 branch was not moved, rebased,
  force-updated or merged.
- Pushed to `origin/s14b-filesystem-capability-part-b-round2`; the remote branch
  SHA equals the exact local candidate SHA. Both pushes were fast-forward; no
  branch was force-pushed.
- No merge to `main`; no `main` movement; no rewrite of `efff516…` history.
  `main` remains `990483118d623d4af5caf6b2d05cb79a4a3feb02`; the rejected Round-1
  branch remains `efff516b0bec42cef8acff3780fe9f0d70439ee8`.

## 13. Limitations

- Credential/vendor recognition is a finite recognizer of common assignment and
  token shapes, not universal arbitrary-secret classification.
- Registry compatibility is conservative structural public-contract equality plus
  bounded traversal and secret rejection, not a JSON Schema theorem prover.
- The same-target write lock is process-local. It coordinates every
  `WorkspaceFilesystemCapabilityProvider` in one Node process; it does not span
  separate OS processes and does not attempt to.
- The final `fs.link` / `fs.rename` kernel window residual in section 7 stands.
- Real symlink / hard-link / `O_NOFOLLOW` / `/proc/self/fd` adversarial primitives
  were exercised on Linux (`Node v24.19.0`); the provider fails closed with
  `UNAVAILABLE` on platforms lacking `O_NOFOLLOW` / `O_DIRECTORY`.
- This gate covers the authorized in-memory S14B filesystem provider plus the
  exact two-file registry result-envelope patch. Live external adapters,
  connectors, Tools/MCP, OAuth, credentials, PostgreSQL, network and browser
  behavior, and any S14C+ surface are out of scope and not present.

## 14. Next action

CONTROL_PLANE_SOURCE_AUDIT_OF_THE_EXACT_ROUND2_REMOTE_CANDIDATE, then a fresh
non-authoring independent verification of that exact remote candidate. This
builder did not launch the independent verifier, does not claim a verifier
outcome, does not close S14B or S14, does not award HI-054 and does not authorize
S14C.
