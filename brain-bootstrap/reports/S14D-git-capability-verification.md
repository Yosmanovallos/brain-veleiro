# S14D — Git Capability Part B: Builder Verification Report

**Builder status:** S14D BUILDER PASS AWAITING CONTROL-PLANE SOURCE AUDIT
**Control-plane status:** REMEDIATED CANDIDATE AWAITING FRESH INDEPENDENT VERIFICATION

The original body records the fresh primary builder's evidence for S14D Git
Capability Part B at `b7f9dc943d9b30a64cfc4db646f56ccc89e34bf8`.
Section 23 records the later control-plane remediation and superseding test
counts. This report does **not** claim independent-verifier pass, phase pass,
S14 closure, HI-054, or S14E authorization.

---

## 1. Control plane

| Item | Value |
|---|---|
| Parent step / phase | S14 / S14D (Git) |
| Part A authoring gate | GitHub Issue #1 comment `5561606182` |
| Part A authored | comment `5562111605` |
| Part B authorization | comment `5562679259` |
| Exact builder baseline / remote main | `b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7` |
| Part A parent | `4bceeb777127655369ff274b490233764c3e9fd9` |
| Builder branch | `s14d-git-capability-part-b` |

### Remote precheck (at build start)

```
git ls-remote origin refs/heads/main = b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7
local main / origin/main after clean WSL-native clone = b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7
HEAD^ (direct parent) = 4bceeb777127655369ff274b490233764c3e9fd9
compare 4bceeb7..b41f4fe : ahead = 1, behind = 0, merge-base = 4bceeb7
b41f4fe adds exactly 3 Part A files (3282 insertions, 0 deletions):
  brain-bootstrap/quality-contracts/S14D_GIT_DEEP.yaml
  brain-bootstrap/skills/GIT_CAPABILITY_SKILL_S14D.md
  brain-bootstrap/specs/GIT_CAPABILITY_CONTRACT_S14D.md
```

Fresh clean WSL-native workspace: `/home/yosman/brain-s14d-builder` (a fresh
`git clone` of the GitHub remote at `b41f4fe`). The known stale/dirty `/mnt/c`
checkout was not used, reset, stashed, cleaned or committed from. All real Git
QA fixtures are disposable temp repositories under `os.tmpdir()`, outside the
Brain repository/worktree.

---

## 2. Part A byte identity (verified from HEAD)

| File | Git blob | SHA-256 |
|---|---|---|
| `brain-bootstrap/skills/GIT_CAPABILITY_SKILL_S14D.md` | `029661c9e7387c14f98599e3aa98141e72aeaae0` | `5deef86117a8e504f6de4c3c5af1b14a6fb249624a2d77c1d9e5d029757eb70b` |
| `brain-bootstrap/quality-contracts/S14D_GIT_DEEP.yaml` | `f4f5f2353413afd078ee3e53eb4cbd246efea416` | `cf10efa00b0bcb5ab831dfb17799dd5e39af0d1c66d3f76cbc9152a73ea7d8d9` |
| `brain-bootstrap/specs/GIT_CAPABILITY_CONTRACT_S14D.md` | `c30b25be01080a89e4e6463b0fd3280929999c99` | `195af8caed6f593179e662d26c5b5cad19a6e0a5e0987da4c38d1363c691ae56` |

All three match the Part B authorization exactly. The three Part A artifacts
were not edited. Parsed quality contract inventory: 40 hard invariants,
12 unsafe counters, 14 positive fixtures, 42 negative fixtures;
`repository.status` and `repository.read` each `side_effects: NONE`.

---

## 3. Actual runtime

```
node --version   v24.19.0
npm --version    11.17.0
git --version    git version 2.53.0   (>= 2.45.0 and < 3.0.0 — supported S14D range)
platform         Linux / WSL2 (x86_64)
```

All QA (npm ci, typecheck, focused suites, full suite, build, qualification)
ran under this exact runtime. Real canonical repository exercises use the real
supported host Git (`/usr/bin/git`, 2.53.0). Controlled fake-`git` fixture
executables cover only cases a real git cannot produce on demand: a chosen
version string, a hang, and a same-group SIGTERM-resistant descendant.

---

## 4. Implementation / test file scope

### Production (additive only, under `src/providers/capability/git/**`)

| File | Lines | Purpose |
|---|---|---|
| `types.ts` | 81 | `WorkspaceGitConfig`, observation types, `GitOperationFamily` |
| `environment.ts` | 202 | fixed provider-built child env, fixed Git safety option/config floor, closed operation-table argv builder, structural deny set |
| `process.ts` | 178 | S14D-private bounded process runner (`startGitProcess`, `runGitProcess`) |
| `parsing.ts` | 275 | pure revision/path grammar, protected-content floor, version parse, porcelain-v2 and `ls-tree` parsers |
| `workspaceGitCapabilityProvider.ts` | 577 | the provider: filesystem-only `create()`, `list_capabilities`, `invoke` (version gate → status / read), identity gates, host-path normalisation, failure mapping |

### Tests (additive only, under `tests/git-capability/**`)

`repoFixtures.ts`, `gitDirManifest.ts`, `fixtures.ts`, `helpers.ts`, `audit.ts`,
`cases.ts`, `processExercises.ts`, `gitCapability.test.ts`,
`registryCompatibility.test.ts`, `unsafeCounters.test.ts`, `regressions.test.ts`.

### Report

`brain-bootstrap/reports/S14D-git-capability-verification.md` (this file).

No existing production or test file was modified. No dependency was added
(`package.json` / `package-lock.json` / `tsconfig.json` / `vitest.config.ts`
byte-identical to `b41f4fe`).

---

## 5. Exact public capability surface

`WorkspaceGitCapabilityProvider` exposes exactly `repository.status` and
`repository.read`; both `side_effects = NONE`; no third capability. No
`repository.diff` / `log` / `show` / `commit` / `stage` / `branch*` /
`checkout` / `push` / `fetch` / `pull`; no GitHub / MCP capability. Descriptors
are static consts with no `repository_id`, root, git executable, git version,
argv template, env, ref, branch or provider id — identical across host
configuration.

Trusted config `{ repository_id, repository_root, git_executable,
max_timeout_ms }` is validated in `create()`; no model input can select or
override any field. `create()` is filesystem-only: it canonicalises root and
executable via `realpath`, validates the standard v1 repository shape, records
root / `.git` / executable `dev:ino`, and performs **zero** process spawn
(proved by a `startGitProcess` spy over valid and every rejected shape).

---

## 6. Canonical inventory results

Run: `vitest run tests/git-capability` — **125 passed / 0 failed** (4 files),
across 3 consecutive runs (qualification C).

| Inventory | Result |
|---|---|
| FX-POS-001 .. 014 | 14 / 14 pass |
| FX-NEG-001 .. 042 | 42 / 42 pass |
| S14D-HI-001 .. 040 | 40 / 40 pass |
| UC01 .. UC12 | 12 / 12 — zero on every legitimate path; every detector independently fired by its paired negative control |

`gitCapability.test.ts` asserts the parsed quality-contract IDs equal the
implemented IDs exactly (14 / 42 / 40 / 12) and that no canonical ID was
renumbered or reinterpreted.

---

## 7. `repository.status` NONE proof

- Canonical status uses **both** `--no-optional-locks` and
  `GIT_OPTIONAL_LOCKS=0` plus the full safety floor.
- Whole-`.git` observation manifest (name + type + size + SHA-256 for every
  file under `.git`; symlink target for symlinks; atime excluded) is **unchanged**
  before/after canonical `status` and `read` on a dirty + stat-dirty +
  gc-eligible fixture.
- Qualification A: **12 / 12** consecutive `status`+`read` executions across a
  dirty / gc-eligible fixture with zero manifest change, no `gc.log`, no
  `commit-graph`, no `multi-pack-index`, no detached maintenance survivor
  (need ≥ 10).
- Non-vacuous unsafe control: a **plain** `git status` (no safety floor, optional
  locks enabled) on a fresh stat-dirty index **rewrites `.git/index`** — the
  index-write detector demonstrably fires (`unsafePlainStatusMutatesIndex`,
  FX-POS-008).
- gc-eligible control: an explicit `git gc` on the same fixture **does** change
  the `.git` manifest, so the non-mutation detector is not vacuous (FX-POS-009).
- `repository.status` is not relabeled `LOCAL`.

---

## 8. `repository.read` proof

- Committed-object only: `HEAD` → `rev-parse --verify` **or** full 40/64-hex
  object id verified as a commit via `cat-file -t`; then one tree entry via
  `ls-tree -l -z <commit> -- <path>`; then `cat-file blob <resolved-oid>`. No
  unresolved `revision:path` composite is handed to Git; no live worktree byte,
  index stage, symlink target or gitlink content is returned.
- Revision grammar is exactly `HEAD` or full 40/64-hex; short SHA, branch/tag,
  leading `-`, whitespace/control/NUL, `@{`, `}`, `:`, `^`, `~`, `..`, `...`,
  ranges, reflog and index-stage syntax are all rejected before Git resolution
  (FX-NEG-003 / FX-NEG-004, zero spawn).
- Path grammar reuses the bounded S14B-derived logical discipline; absolute,
  Windows-drive, UNC/backslash, `.`, `..`, empty-segment, over-limit, leading
  `-`, leading `:` and pathspec-magic paths are rejected before Git
  (FX-NEG-005 .. FX-NEG-009).
- Structural protected-content floor blocks `.git/**`, `.ssh/**`, `.gnupg/**`,
  `.aws/**`, `.azure/**`, `.kube/**`, `.npmrc`, `.pypirc`, `.netrc`, `.env`,
  `.env.*` (except `.env.example`), `*.pem` / `*.key` / `*.p12` / `*.pfx`,
  `credentials.*`, `id_rsa`, `id_ed25519` — segment-aware, before any content
  read (FX-NEG-010 / FX-NEG-011, zero spawn). `.env.example` stays readable.
- Tree, committed symlink (`120000`) and gitlink/submodule (`160000`) entries
  are not returned (FX-NEG-012).
- Strict fatal UTF-8: a binary or invalid-UTF-8 committed blob fails closed with
  no replacement decoding, no base64, no raw bytes (FX-NEG-015).
- `max_blob_bytes = 1048576` enforced: the exact legal maximum succeeds
  (FX-POS-010); `max + 1` bytes terminate the process group and return
  `EXECUTION_FAILED`, never a truncated SUCCESS (FX-NEG-017).
- Recognizable secret-bearing committed content is `BLOCKED` and never echoed
  (FX-NEG-016). `sensitive()` is documented as a finite backstop and is never
  described as exhaustive.
- No `core.attributesFile` / textconv / filter / smudge path
  (`filter.lfs.smudge=cat`, `filter.lfs.process=`, `GIT_LFS_SKIP_SMUDGE=1`;
  `cat-file` returns committed bytes only).

---

## 9. Process / deadline / cleanup

- `child_process.spawn` is imported by `process.ts` only (source audit); the
  provider imports the named `startGitProcess` / `runGitProcess` bindings.
  `shell: false`, `stdin: "ignore"`, bounded stdout/stderr pipes, no TTY/PTY,
  `detached: true` POSIX process group, exact provider-built env, no hidden
  retry. No command string is ever composed.
- One invocation-wide monotonic deadline: `min(request.timeout_ms,
  config.max_timeout_ms)`, captured at invoke entry, never reset. It covers the
  version gate, every repository subprocess, output handling and cleanup. A
  pre-spawn step made to consume the budget yields `FAIL / TIMEOUT` with no new
  process; a child that would fit a fresh budget but not the remaining budget
  still `TIMEOUT`s (`invocationDeadlineNotReset`).
- Final pre-spawn window: repository-identity recheck → executable-identity
  recheck → synchronous remaining-deadline check → immediate spawn. Zero
  unrelated `await` between the executable recheck and `startGitProcess`
  (`finalSpawnGap` audit); `startGitProcess` body has zero `await`.
- Timeout / output-overflow: mark provider-induced termination → `SIGTERM` to
  the process group → `termination_grace_ms = 500` → `SIGKILL` if the group
  survives → bounded liveness polling up to `group_cleanup_budget_ms = 4000` →
  normalized `FAIL`. The leader's `close` does not cancel the escalation
  lifecycle.
- Qualification B: **12 / 12** consecutive timeout exercises with a real
  provider-owned process tree (fake-git leader + same-group grandchild). Each:
  `FAIL / TIMEOUT`, grandchild pid reaped, a later legitimate real-Git call
  succeeds, no temp/process residue (need ≥ 10).
- Stderr / combined-output overflow: bounded group cleanup, `EXECUTION_FAILED`,
  no truncation, grandchild reaped (FX-NEG-035).
- A same-group SIGTERM-resistant descendant is still SIGKILLed and reaped
  (`stubbornSameGroupDescendantReaped`). The TIMEOUT message is bounded
  (≤ 500 chars, no host path, no `pid`, no newline) and makes no claim of
  guaranteed extinction or rollback (`timeoutMessageBounded`).
- The provider does not claim containment of a deliberately self-sessioning
  process; auto-maintenance is configured off so canonical operations do not
  create such a daemon.

---

## 10. Version gate

Every invoke begins with `<configured-absolute-git> --version` via the
S14D-private runner, provider-built env, same invocation deadline, before any
repository-facing operation (`versionGateIsFirst`). Accepts only parsed
`2.45.0 <= version < 3.0.0`. Non-vacuous: `2.44.9`, `2.30.2`, `1.9.0`,
`3.0.0`, `3.1.2`, `not-a-version`, `2.x` each fail `UNAVAILABLE` with no
repository-facing subcommand spawned; `2.45.0` proceeds to the real operation
(FX-NEG-025). No PATH fallback — a "good" git earlier on `PATH` is ignored; the
child env `PATH` is `/usr/bin:/bin` and carries no host `GIT_*` sentinel
(`versionProbeUsesProviderEnvNoPathFallback`). Executable identity drift before
spawn fails closed with zero spawn (FX-NEG-026); root / `.git` identity drift
fails `UNAVAILABLE` before any repository-facing operation (FX-NEG-027).

---

## 11. Closed operation table / structural network & mutation absence

Internal families: `VERSION`, `STATUS`, `RESOLVE_HEAD`, `VERIFY_COMMIT_OBJECT`,
`RESOLVE_TREE_ENTRY`, `READ_BLOB`. `buildArgv` emits only `--version`, `status`,
`rev-parse`, `cat-file`, `ls-tree` from fixed templates — no `default:`
pass-through, no command-line concatenation. The only model-influenced values
that reach argv are a grammar-validated `HEAD`/full-hex token and a
grammar-validated logical path placed strictly after a provider-owned `--`;
neither ever appears as an option (FX-NEG-032).

`STRUCTURAL_DENY_SET` (fetch, pull, push, clone, ls-remote, remote, submodule,
send-pack, receive-pack, upload-pack, daemon, credential, add, commit, rm, mv,
branch, checkout, switch, restore, reset, clean, stash, worktree, tag, notes,
update-ref, config, gc, maintenance, repack, prune, replace, rebase, merge,
cherry-pick, am, apply) appears in **no** produced argv for any family. No model
input carries a remote name, URL, credential or transport identity;
`protocol.file.allow=never` and `protocol.ext.allow=never` are pinned. A remote
configured with a credential-bearing URL is never contacted (no network stall)
and never returned (FX-NEG-033).

---

## 12. Exact provider-built environment / Git safety floor

`process.env` is never spread, merged or read by the git provider (source audit:
`processEnvReads(productionSources()) == 0`). The child env is built entirely
from module constants and matches canonical Part A exactly (PATH, HOME,
XDG_CONFIG_HOME, GNUPGHOME, GIT_CONFIG_NOSYSTEM, GIT_CONFIG_GLOBAL/SYSTEM,
GIT_TERMINAL_PROMPT, GIT_ASKPASS, SSH_ASKPASS, GIT_SSH_COMMAND, GIT_PAGER,
GIT_OPTIONAL_LOCKS, GIT_LITERAL_PATHSPECS, GIT_NO_REPLACE_OBJECTS,
GIT_LFS_SKIP_SMUDGE, GIT_DISCOVERY_ACROSS_FILESYSTEM, LC_ALL, LANG, TZ). Host
`GIT_DIR` / `GIT_WORK_TREE` / `GIT_COMMON_DIR` / `GIT_OBJECT_DIRECTORY` /
`GIT_ALTERNATE_OBJECT_DIRECTORIES` / `GIT_INDEX_FILE` / `GIT_NAMESPACE` /
`GIT_EXEC_PATH` / `GIT_CONFIG*` / `GIT_PROXY_COMMAND` / `GIT_EXTERNAL_DIFF` /
`GIT_SSH` / credential-like / `LD_*` / `NODE_OPTIONS` are simply absent from the
map — a live sentinel test proves the child resolves against the real bound
repo, not a decoy (FX-NEG-028).

All canonical `-c` safety overrides (`safe.directory`, `core.worktree`,
`core.hooksPath=/nonexistent/brain-git-hooks`, `core.fsmonitor=false`,
`core.untrackedCache=false`, `core.pager=cat`, `core.editor=/bin/false`,
`core.excludesFile=/dev/null`, `core.attributesFile=/dev/null`,
`credential.helper=`, `gpg.program=/bin/false`, `commit.gpgsign=false`,
`log.showSignature=false`, `tag.gpgSign=false`, `gc.auto=0`,
`gc.autoDetach=false`, `gc.writeCommitGraph=false`, `maintenance.auto=false`,
`fetch.writeCommitGraph=false`, `core.commitGraph=false`,
`protocol.file.allow=never`, `protocol.ext.allow=never`, `filter.lfs.smudge=cat`,
`filter.lfs.process=`, `filter.lfs.required=false`,
`status.submoduleSummary=false`, `submodule.recurse=false`) plus `--no-pager`,
`--no-optional-locks`, `--no-replace-objects`,
`--git-dir=<root>/.git`, `--work-tree=<root>` are produced on every
repository-facing invocation (`safetyFloorComplete`). A hostile
hooks / `core.hooksPath` / fsmonitor fixture cannot create its sentinel during
canonical status/read (FX-NEG-029); a hostile
alias / pager / editor / credential-helper / GPG / textconv configuration cannot
execute (FX-NEG-030); a control shows plain git **does** exec a hostile
`core.fsmonitor` program, so that detector is non-vacuous.

---

## 13. Repository shape support

Accepts exactly one ordinary non-bare worktree where `<root>/.git` is a real
direct directory. Rejects (provider construction fails safely): missing /
non-directory root, missing `.git`, `.git` symlink, `.git` gitfile / linked
worktree, bare repository, sparse-checkout administrative state
(`.git/info/sparse-checkout`), active object alternates
(`objects/info/alternates`, `objects/info/http-alternates`), populated
`.git/worktrees/` sibling-worktree administrative shape, and a relative /
missing / non-regular / non-executable `git_executable` (FX-NEG-019 .. 024).
Shallow repositories are allowed. Submodule internals are never recursively
entered.

---

## 14. Output bounds / host-path normalisation / failure mapping

Canonical limits enforced: `max_status_paths = 1000`, `max_blob_bytes =
1048576`, `max_stdout_bytes = 1048576`, `max_stderr_bytes = 65536`,
`max_combined_output_bytes = 1114112`, `max_repository_timeout_ms = 300000`,
`termination_grace_ms = 500`, `group_cleanup_budget_ms = 4000`,
`max_evidence_refs = 4`, `max_safe_error_chars = 500`. Raw process-output
accounting happens before decode. A status of more than 1000 paths fails
`EXECUTION_FAILED`, never a truncated success (FX-NEG-018).

Known host identities are normalised before model visibility: executable
realpath / configured path → `<git>` (applied before the broader root
replacement), canonical root → `repository://<repository_id>`,
`/nonexistent/brain-git-hooks` → `<hooks>`. FAIL results carry only fixed
normalized messages — no raw Git stderr / fatal / stack / host path / secret.
Evidence is logical only: `repository://<id>/status` or
`repository://<id>@<resolved_commit>/<logical-path>`. Verified across SUCCESS /
FAIL / BLOCKED / evidence for status, read, missing path, protected path and
unknown-oid cases (FX-NEG-036).

Failure mapping (existing `NormalizedToolError` union only): malformed
input/revision/path/UTF-8 → `INVALID_INPUT`; protected content / recognized
secret → `BLOCKED`; unborn / missing commit / missing path → `NOT_FOUND`;
unsupported Git version or repo shape / identity drift → `UNAVAILABLE`; OS
permission denial → `PERMISSION_DENIED`; deadline → `TIMEOUT` (retryable);
overflow / malformed Git output / status bound / bounded process failure →
`EXECUTION_FAILED`; unexpected internal failure → `INTERNAL_ERROR`.

---

## 15. Registry / Restricted / runAgent composition

- The real `CapabilityRegistryProvider` routes both `repository.*` ids with no
  Git-specific registry logic; `diagnostics()` reports 2 routes (FX-POS-012,
  regressions).
- `RestrictedCapabilityProvider` capability denial → `BLOCKED` before the Git
  provider's `invoke`, with **no** version probe and **no** process spawn
  (`startGitProcess` spy + `p.invoke` spy both uncalled) (FX-NEG-037).
- `RestrictedCapabilityProvider` denial of `NONE` side effect → same: `BLOCKED`
  before invoke, zero spawn (FX-NEG-038).
- Real path
  `WorkspaceGitCapabilityProvider → CapabilityRegistryProvider →
  RestrictedCapabilityProvider → runAgent()` succeeds for an allowed invocation
  (FX-POS-011 / FX-POS-012).
- Provider / repository swap: identical `AgentDefinition` bytes
  (`JSON.stringify` equal before/after) and identical permission policy across
  two **separate** registry configurations (repo A / repo B) while observed
  `repository.read` content differs appropriately (FX-POS-013). Divergent
  `repository.read` descriptors co-registered in **one** configuration collide
  and fail closed — the capability is omitted from `list_capabilities` and
  `invoke` returns `BLOCKED`; an unaffected capability still routes (FX-NEG-039).
- Legal-max registry envelope: a real 1 MiB committed blob and a real 1000-path
  status result both round-trip untruncated through the accepted
  `canonicalToolResult()` 8,388,608-character / 10,000-node envelope; a
  synthetic oversized result is rejected by the registry, not truncated
  (FX-POS-010, `registryCompatibility.test.ts`).

---

## 16. Protected boundary audit

`assertBoundaries()` (S14D-owned, mechanical; baseline `b41f4fe`,
`ALLOWED_MODIFIED = []`) verifies against `b41f4fe`:

```
git status --porcelain        →  only  src/providers/capability/git/  and  tests/git-capability/  (untracked)
git diff --name-status b41f4fe →  A src/providers/capability/git/**
                                  A tests/git-capability/**
                                  A brain-bootstrap/reports/S14D-git-capability-verification.md
                                  (no M / D / R / C)
git diff --check b41f4fe       →  clean
```

- Part A blobs / SHA-256 byte-identical (section 2).
- `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`
  byte-identical to `b41f4fe` (blob compare).
- `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` byte-identical to
  `b41f4fe` — this builder made no continuity edit.
- No `src/core/agent/**`, `src/providers/capability/registry/**`,
  `src/providers/capability/filesystem/**`, `src/providers/capability/shell/**`,
  `src/intelligence/repository-git-workflow/**` change; no
  `tests/capability-registry/**`, `tests/filesystem-capability/**`,
  `tests/shell-capability/**`, `tests/repository-git-workflow/**` change.
- No S14E+ artifact (`git ls-files` scan for `S14[E-Z]` / `S1[5-9]` / `S[2-9]\d`
  paths is empty).
- No dependency added.

---

## 17. Regression suites (this runtime, this candidate)

| Suite | Result |
|---|---|
| `tests/capability-registry/**` | PASS |
| `tests/filesystem-capability/**` | PASS |
| `tests/repository-git-workflow/**` | PASS |
| `tests/shell-capability/**` | **8 PRE-EXISTING FAILURES (inherited, unchanged, itemized in section 18)** |
| `tests/git-capability/**` | PASS — 125 / 125 |

Focused run
(`vitest run tests/capability-registry tests/filesystem-capability
tests/shell-capability tests/repository-git-workflow tests/git-capability`):
**8 failed / 627 passed (635)** — the 8 are exactly the pre-existing
shell-capability set.

No pre-existing test was modified to make S14D pass.

---

## 18. Pre-existing inherited `tests/shell-capability/**` failures

These 8 tests fail on a **pristine clone of `b41f4fe`, before any S14D file
exists** (captured pre-build; see builder evidence). They are outside the
authorized S14D scope and were not touched.

**Independently reproducible without any builder-local file:** clone the GitHub
remote at `b41f4fe` into an empty directory, `npm ci`, `npm test` — expect
`8 failed | 1778 passed (1786)`, and the 8 failing test names are exactly the
set below. No S14D file is present in that tree.

```
tests/shell-capability/regressions.test.ts  > the S14B regression-harness maintenance is exactly the authorized narrow change
tests/shell-capability/unsafeCounters.test.ts > UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires
tests/shell-capability/shellCapability.test.ts > canonical negatives > FX-NEG-042
tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-002
tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-033
tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-037
tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-038
tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-039
```

**Root cause (mechanically asserted by `assertPreExistingS14CFailureCause` in
`tests/git-capability/audit.ts`):** the CLOSED S14C test harness
(`tests/shell-capability/audit.ts`) pins its continuity baseline at
`3cd344d018dbf2d40a39a907a3494bba8f3d940b` and its `protectedDifferences()`
exempts only two filesystem test files. The S14C phase-closure commit
(`4bceeb7`) and the S14D Part A integration commit (`b41f4fe`) legitimately
rewrote `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` after that
pin, which the S14C harness now flags as protected-surface drift. Every other
tracked `tests/shell-capability/**` file is byte-identical to `b41f4fe`
(verified). This is an inherited defect in the closed S14C harness; fixing it is
a separate authoring gate for that harness and is not attempted here.

Pre-build vs post-build: **same 8 test names, same count (8 failed / 1903
passed)** — S14D is not implicated.

---

## 19. Full repository QA

```
npm ci                 →  ok (54 packages; node 24 / npm 11.17.0)
npm run typecheck      →  PASS (tsc --noEmit, clean)
npm test  (pre-build)  →  8 failed | 1903 passed (1911)   [the 8 = section 18]
repo-local dist        →  absent before build
npm run build          →  exit 0 (tsc -p tsconfig.json); 966 emitted artifacts under dist/
                          dist/ is .gitignore'd — not tracked, no boundary drift
npm test  (post-build) →  8 failed | 1903 passed (1911)   [identical; the 8 = section 18]
git diff --check       →  clean
```

Baseline pristine (pre-S14D): `8 failed | 1778 passed (1786)`.
Candidate: `8 failed | 1903 passed (1911)` → **+125 passing, +0 failing**.

---

## 20. Targeted stability qualification (original builder tree `b7f9dc9`)

| Gate | Requirement | Result |
|---|---|---|
| A — `repository.status` whole-`.git` NONE proof | ≥ 10 consecutive canonical executions on a dirty / gc-eligible fixture, zero manifest change, zero maintenance survivor | **12 / 12** — no `gc.log`, no `commit-graph` |
| B — timeout / overflow process-group cleanup | ≥ 10 consecutive critical cleanup exercises, zero same-group survivor / residue, later call succeeds | **12 / 12** |
| C — focused S14D suite | ≥ 3 consecutive zero-failure runs | **3 / 3** — 125 / 125 each |

No qualification failure was hidden with a retry.

---

## 21. Non-goals / residuals (unchanged from Part A)

S14D v1 makes no claim that its finite `sensitive()` backstop catches every
secret; makes no claim of an OS-level process sandbox; makes no claim of
universal hostile-Git containment; makes no claim of an atomic / race-free
executable invocation window; makes no claim of transaction isolation from a
concurrent external Git process; supports neither every Git repository shape nor
remote Git nor Git mutation nor a binary Git object API nor rollback. These
non-claims are stated in the production source comments and are asserted by the
tests (FX-NEG-042).

---

## 22. Builder-controlled state (NOT a control-plane declaration)

```
S14D  = BUILDER PASS AWAITING CONTROL-PLANE SOURCE AUDIT
S14   = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14E  = NOT_AUTHORIZED
```

This builder did **not**: merge to main; launch an independent verifier; update
continuity state; claim independent-verifier pass, phase pass, S14 closure,
HI-054, or S14E authorization.

**Next: control-plane source audit of the exact remote candidate on branch
`s14d-git-capability-part-b`.**

---

## 23. Control-plane source-audit remediation addendum

The control-plane source audit rejected the original builder SHA as an
integration target and corrected three contract gaps:

1. A configured `repository_root` symlink was accepted because `realpath()` ran
   before the configured path was checked. Construction now uses `lstat()` first
   and rejects a symlink or non-directory root.
2. Timeout cleanup began only after the full remaining operation deadline
   expired. The process runner now reserves cleanup time inside one hard
   invocation deadline and caps liveness polling by that deadline.
3. The revision grammar rejected uppercase full hexadecimal object IDs even
   though contract section 17 accepts `[0-9a-fA-F]`. Accepted IDs are now
   canonicalized to lowercase before reaching Git while `requested_revision`
   preserves the caller's spelling.
4. Linux `lstat()` follows a final symlink when the configured spelling ends
   in `/` or `/.`. The provider now strips only trailing directory syntax
   before inspecting the configured root entry, and regressions cover the bare,
   slash, `/.`, and `/./` spellings.
5. Parsed status paths were count/output bounded but not individually checked
   against the contract's logical path limits. Every current and rename-source
   status path now passes the bounded path grammar or the observation fails
   closed as malformed.

For small remaining invocation budgets, the cleanup reservation intentionally
uses at most half the budget for TERM/KILL/liveness cleanup. This can shorten
the execution portion of a small caller timeout, but preserves the stronger
single-hard-deadline and no-unbounded-cleanup requirements.

Remediation production surface:

- `src/providers/capability/git/workspaceGitCapabilityProvider.ts`
- `src/providers/capability/git/process.ts`
- `src/providers/capability/git/parsing.ts`

Remediation test surface:

- `tests/git-capability/regressions.test.ts`
- `tests/git-capability/processExercises.ts`
- `tests/git-capability/cases.ts`

The original builder counts elsewhere in this report remain historical evidence
for `b7f9dc943d9b30a64cfc4db646f56ccc89e34bf8`; they are not claims about the
final remediated HEAD. Final remediated counts are recorded here after running
the remediated code/test candidate
`7aa0699b9e5c5971b707b3a27c367b52ec4b9ba1`:

- `npm ci`: **PASS** (clean dependency install).
- `npm run typecheck`: **PASS** (`tsc --noEmit`, zero diagnostics).
- Focused S14D suite: **PASS** — 4 files, 127 / 127 tests.
- `npm run build`: **PASS** (`tsc -p tsconfig.json`, exit 0).
- Full suite: **1905 passed / 8 inherited S14C failures (1913 total)**.
  The eight names and cause are exactly those classified in section 18: the
  closed S14C boundary harness sees the already-authorized continuity changes
  in `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md`; no S14D test
  failed and remediation added two passing regressions with zero new failures.

The report-only commit that records these results is intentionally layered on
top of that code/test candidate. All gates below must be repeated on that exact
report commit before the remote candidate and verifier relay are accepted.

State remains unchanged: S14D and S14 are not closed, HI-054 is not awarded,
and S14E is not authorized pending a fresh independent-verifier relay and
separate control-plane acceptance.
