# S14B Filesystem Capability — Resumed Builder Verification

Status: BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT / INDEPENDENT_VERIFICATION
S14: IN_PROGRESS / NOT_CLOSED
S14B: BUILDER_PASS_AWAITING_CONTROL_PLANE_SOURCE_AUDIT
HI-054: NOT_AWARDED
S14C: NOT_AUTHORIZED

## Lineage and control-plane authority

- Original Part B authorization: Issue #1 comment `5554335964`.
- Builder compatibility preflight outcome: `STOP / CHATGPT_AUTHORING_REQUIRED` — the
  original S14B blanket `src/providers/capability/registry/**` byte-identity
  requirement could not hold a legal 1 MiB filesystem result inside the pre-erratum
  100000-character registry result envelope without truncating a legal S14B output.
- Compatibility erratum authoring authority: Issue #1 comment `5554381954`.
- Erratum integrated at canonical baseline `28acc89f00d62d5cdb626f3eee2e93ade69b0227`
  (parent `7239a98377111c8b67d7ab04acc0ba322bdce02b`): three added documents
  (`brain-bootstrap/decisions/ADR-s14b-registry-result-envelope.md`,
  `brain-bootstrap/quality-contracts/S14B_REGISTRY_COMPATIBILITY_ERRATUM_DEEP.yaml`,
  `brain-bootstrap/specs/S14B_REGISTRY_COMPATIBILITY_ERRATUM.md`), no existing
  tracked implementation file modified by the erratum integration.
- Resume authorization: Issue #1 comment `5554420882`.

STATE.yaml and CURRENT.md still carry older "S14B not authorized" wording; the
S14B Part A and erratum integrations intentionally left continuity untouched.
Repository/runtime truth plus comments `5554335964`, `5554381954`, `5554420882`
are the controlling authority for this implementation gate. This builder does not
edit STATE.yaml or CURRENT.md.

## Baseline and runtime truth

- local `main` = `origin/main` = `git ls-remote origin refs/heads/main`
  = `28acc89f00d62d5cdb626f3eee2e93ade69b0227`.
- Required parent present: `7239a98377111c8b67d7ab04acc0ba322bdce02b`.
- Fresh dedicated builder branch `s14b-filesystem-capability-part-b` created from the
  exact baseline in a clean isolated worktree (POSIX/LF checkout; no `core.autocrlf`).
- Pre-existing unrelated local work in the ordinary Windows/WSL checkout
  (S13N/S13O modifications, CRLF-only modifications, untracked scaffolds) was not
  reset, stashed, cleaned, deleted or staged.
- Node `v24.19.0`, npm `11.17.0`. `better-sqlite3@13.0.3` native binding builds and
  loads. Vitest `4.1.11`.

## Canonical artifact identities proven at baseline

| Artifact | Blob |
| --- | --- |
| `brain-bootstrap/skills/FILESYSTEM_CAPABILITY_SKILL_S14B.md` | `af54ebf3862685c41cf2bad8e5d8d169b927c518` |
| `brain-bootstrap/quality-contracts/S14B_FILESYSTEM_DEEP.yaml` | `379a75ff43374806893ba053d8c812d7ba79a3d3` |
| `brain-bootstrap/specs/FILESYSTEM_CAPABILITY_CONTRACT_S14B.md` | `8307092cbd9642db889e1fafdaf2d5d7a1357cee` |
| `brain-bootstrap/decisions/ADR-s14b-registry-result-envelope.md` | `652a36d0ab52aa2318b294dea2ebceb29ee9ab88` |
| `brain-bootstrap/quality-contracts/S14B_REGISTRY_COMPATIBILITY_ERRATUM_DEEP.yaml` | `1d610b667700b64f746007c72d7fd22b91c9bf4b` |
| `brain-bootstrap/specs/S14B_REGISTRY_COMPATIBILITY_ERRATUM.md` | `5183714b0541c838da932bae0285e2a409aee6d5` |

All six are unchanged by this candidate.

## Exact production diff against baseline

A full 503-file tree comparison against `28acc89` shows exactly two modified
tracked files, both authorized by the erratum, and nothing else:

- `src/providers/capability/registry/validation.ts` — result-envelope split only.
  `canonical(value)` now delegates to `canonicalWithin(value, 100000)` (descriptor /
  config / public-contract path, semantics unchanged); a new
  `canonicalToolResult(value)` runs the same bounded-depth (32), bounded-node
  (10000), accessor/prototype-rejecting, secret-rejecting traversal against an
  `8388608`-character envelope; the `ToolInvocationResult.evidence_refs`
  per-entry limit moves from `LIMITS.description` (2000) to `8192`. `LIMITS`,
  routing, provider selection, diagnostics, `validResult` union shape and the
  descriptor validator are untouched.
- `src/providers/capability/registry/capabilityRegistryProvider.ts` — `invoke()`
  now validates the raw provider result through `canonicalToolResult(raw)` instead
  of `canonical(raw)` before `structuredClone` and `validResult`; `call_id` /
  `capability_id` identity checks and safe `fail()` normalization are unchanged.

New files (untracked → added by this candidate):

- `src/providers/capability/filesystem/workspaceFilesystemCapabilityProvider.ts`
- `tests/filesystem-capability/{helpers,audit,cases,failureExercises}.ts`
- `tests/filesystem-capability/{filesystemCapability,registryCompatibility,unsafeCounters,regressions}.test.ts`

`src/providers/capability/registry/types.ts` and
`src/providers/capability/registry/validateConfig.ts` are byte-identical to baseline.

## Protected-boundary audit (byte-identical to `28acc89`)

`src/core/agent/types.ts`, `src/core/agent/restrictedCapabilityProvider.ts`,
`src/core/agent/definition.ts`, `src/core/agent/runtime.ts`, `src/core/agent/index.ts`,
`src/providers/capability/registry/types.ts`,
`src/providers/capability/registry/validateConfig.ts`,
all S13G / S13H tracked surfaces, all top-level S14 Part A artifacts, all three
S14B Part A artifacts, all three integrated erratum artifacts, `package.json`,
`package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `brain-bootstrap/STATE.yaml`
and `brain/context/CURRENT.md` — all unchanged. No dependency added or removed.
No S14C+ production surface (shell / git / network / browser / PostgreSQL / MCP /
OAuth) introduced; `tests/filesystem-capability/audit.ts` `futureSurface` /
`inferredScope` scanners over the real production source return zero, and each is
proven fireable on an injected forbidden import / `process.cwd()` sample.

## Filesystem provider

`WorkspaceFilesystemCapabilityProvider implements CapabilityProvider`, async
`create(WorkspaceFilesystemConfig)` factory, exactly three descriptors:

| capability | side_effects |
| --- | --- |
| `filesystem.read` | `NONE` |
| `filesystem.list` | `NONE` |
| `filesystem.write` | `LOCAL` |

- Explicit provider-layer config only: absolute canonicalized `workspace_root`
  (no `process.cwd` / env / HOME / git-root / drive inference), explicit
  `read_allow_prefixes` / `write_allow_prefixes` (empty write scope allowed,
  `.` only when explicitly configured), ≤ 64 prefixes per mode. Provider root and
  policy never enter `AgentDefinition` or `ToolDescriptor`.
- Provider-neutral `/` logical paths; `max_path_chars` 4096, `max_path_segments`
  256, `max_segment_utf8_bytes` 255. Absolute POSIX, Windows-drive, UNC,
  backslash, NUL, empty, `.` (except `filesystem.list` root), `.` / `..` / empty
  segments, and every overlong form are rejected before any filesystem target
  access and are never normalized into an accepted path.
- Access requires both explicit allow-prefix coverage (segment-boundary aware,
  snapshotted at construction) and canonical containment under the resolved root.
- No symlink traversal: `O_NOFOLLOW` + component-wise `lstat` + `/proc/self/fd`
  anchoring + dev/ino re-verification; symlink target or intermediate symlink
  component is `BLOCKED`. `filesystem.list` reports `SYMLINK` metadata without
  traversal. `OVERWRITE_EXISTING` requires a regular file with `nlink === 1`;
  `nlink > 1` is `BLOCKED` with no mutation.
- Protected-path floor (`.git/**`, `.ssh/**`, `.gnupg/**`, `.aws/**`, `.azure/**`,
  `.kube/**`, `.env`, `.env.*`, `.npmrc`, `.pypirc`, `.netrc`, `*.pem`, `*.key`)
  is denied even under an allowing prefix; `.env.example` is readable only when
  its content passes secret detection. No new glob dependency.
- Recognized credential material (Authorization / Proxy-Authorization bearer,
  Cookie / Set-Cookie, password / passwd / passphrase, api_key / api-key,
  client_secret, access_token, refresh_token, id_token, session_token, `sk-…`,
  `ghp_…`, private-key blocks, `credential_ref` / `auth_ref` / `connection_ref`
  assignments) fails closed on read content and write content; rejected material
  is never echoed in result, error, evidence, report or committed fixture. Tests
  use synthetic fake credential-shaped strings.
- `filesystem.read`: regular file only, ≤ 1 MiB, strict fatal UTF-8, returns
  `path` / `content` / `bytes` / `sha256`, evidence `workspace://<logical-path>`,
  no absolute-path leakage.
- `filesystem.list`: directory only, non-recursive, deterministic sort, ≤ 1000
  entries (`FILE` / `DIRECTORY` / `SYMLINK` / `OTHER`), `> 1000` fails closed
  (`INVALID_INPUT`), never truncates.
- `filesystem.write`: `CREATE_NEW` (existing safe parent, target absent,
  exclusive `O_CREAT|O_EXCL` temp then `link()` publication — no clobber, no
  parent creation) and `OVERWRITE_EXISTING` (mandatory `expected_sha256`,
  pre- and final pre-commit hash re-check, `rename()` commit, mismatch `BLOCKED`
  with no mutation). Safe same-parent bounded temp write → `fsync` → final
  precondition re-check → irreversible commit → temp cleanup; temp names are
  deterministic-random, never model-visible, hidden from concurrent list/read,
  and cleaned on every failed pre-commit path. No append / delete / rename /
  move / mkdir / chmod / watch / binary API.
- Timeout: `ToolInvocationRequest.timeout_ms` authoritative; read/list get a
  bounded deadline and normalized `FAIL TIMEOUT` with no raw OS path/stack; a
  write whose deadline expires before irreversible commit aborts with the target
  unchanged; once commit begins the true final state is awaited and reported —
  `TIMEOUT` is never returned for a write that committed.
- Failure normalization to the existing `ToolInvocationResult`: invalid
  input/path/size/encoding → `FAIL INVALID_INPUT`; missing → `FAIL NOT_FOUND`;
  OS permission → `FAIL PERMISSION_DENIED`; timeout → `FAIL TIMEOUT`; other
  bounded fs failure → `FAIL EXECUTION_FAILED`; policy / traversal / symlink /
  protected-path / hash-precondition → `BLOCKED`. Safe messages ≤ 500 chars, no
  host root, no raw path when unsafe, no stack, no raw exception, no secret.

## QA sequence and results

All commands run under Node `v24.19.0` / npm `11.17.0` in the isolated builder
worktree.

| # | Check | Result |
| --- | --- | --- |
| 1 | `node --version` / `npm --version` | `v24.19.0` / `11.17.0` |
| 2 | Six canonical artifact blobs at baseline | PASS |
| 3 | Fresh worktree pristine before any edit — `git status` clean, `git diff --quiet HEAD`, 503 tracked files, all six canonical blobs at their required values | PASS |
| 4 | `npm run typecheck` (`tsc --noEmit`) | PASS |
| 5 | Full repository suite on pristine baseline | 27 files / 1491 passed |
| 6 | `npm run typecheck` with candidate applied | PASS |
| 7 | S14A focused suite `tests/capability-registry` | 2 files / **110 passed** |
| 8 | S14B focused suite `tests/filesystem-capability` | 4 files / **150 passed** |
| 9 | Canonical S14B positives `FX-POS-001..014` | **14 / 14** |
| 10 | Canonical S14B negatives `FX-NEG-001..036` | **36 / 36** |
| 11 | Canonical S14B hard invariants `S14B-HI-001..036` | **36 / 36** |
| 12 | Unsafe counters `UC01..UC12` — legitimate paths zero + each detector fireable | **12 / 12** |
| 13 | Compatibility invariants `S14B-COMP-HI-001..012` | **12 / 12** |
| 14 | `COMP-POS-001..004` through the real registry path | **4 / 4** |
| 15 | `COMP-NEG-001..004` fail closed through the real registry path | **4 / 4** |
| 16 | 1 MiB ASCII `filesystem.read` SUCCESS composed through the registry | PASS, exact content, same `call_id` / `capability_id`, no truncation |
| 17 | `filesystem.list` 1000 × 255-byte-name SUCCESS composed through the registry | PASS, all entries preserved, deterministic order |
| 18 | `workspace://` evidence ref from a 4096-char logical path composed through the registry | PASS |
| 19 | Canonical `ToolInvocationResult` serialization `> 8388608` | fail closed |
| 20 | Individual `evidence_ref` length `8193` | fail closed |
| 21 | Secret material near the enlarged result envelope | fail closed, material not echoed |
| 22 | Descriptor / public-contract canonical payload `> 100000` | fail closed (`canonical` still on the 100000 envelope, `LIMITS.description === 2000`) |
| 23 | Real disposable-filesystem adversarial exercise under `os.tmpdir()` | PASS (see below) |
| 24 | Real `CapabilityRegistryProvider` composition (no filesystem special-case) | PASS |
| 25 | Real `RestrictedCapabilityProvider` composition — capability + `NONE` / `LOCAL` gating | PASS |
| 26 | Real `compileAgentDefinition` → `runAgent` `filesystem.read` against a disposable workspace | PASS |
| 27 | Provider / root swap under a byte-identical `AgentDefinition` | PASS |
| 28 | Full repository suite BEFORE the clean build | 31 files / **1641 passed** |
| 29 | Prove repo-local `dist/` genuinely absent | absent |
| 30 | Genuine clean build `npm run build` (`tsc -p tsconfig.json`) | PASS |
| 31 | Emitted artifact count | 873 files (846 baseline + 27 for the 1 provider and 8 test modules) |
| 32 | Full repository suite AFTER the clean build | 31 files / **1641 passed** |
| 33 | `git diff --check` | clean |
| 34 | Exact baseline-to-candidate scope audit | exactly 2 authorized modified files, 2 new production/test trees |
| 35 | Dependency manifests (`package.json`, `package-lock.json`) vs baseline | byte-identical |
| 36 | S14C+ forbidden-surface scan over real production source | zero, detectors fireable |
| 37 | Protected-boundary comparison (Core / Restricted / AgentDefinition / registry `types.ts` + `validateConfig.ts` / S13G / S13H / manifests / STATE / CURRENT) | byte-identical |

### Real disposable-filesystem evidence (`os.tmpdir()`, outside the repository worktree)

Root listing, nested listing, UTF-8 read with SHA-256, `CREATE_NEW`,
`OVERWRITE_EXISTING`, stale-hash no-mutation, final pre-commit hash check against a
real intervening write (no mutation, staging cleaned), `CREATE_NEW` `EEXIST`
publication race (winning file intact), two simultaneous real `CREATE_NEW`
invocations (exactly one SUCCESS, one `BLOCKED`), symlink target block, intermediate
symlink-component block, hard-link (`nlink > 1`) overwrite block, protected-path
block, secret-read block, secret-write block, oversize read / write / list, invalid
UTF-8 (`0xFF`, overlong `0xC0 0x80`, surrogate `0xED 0xA0 0x80`, truncated
`0xE2 0x82`), allow-prefix denial, safe evidence with no root leakage, ordinary
partial-write OS failure (target unchanged, temp cleaned), pre-commit timeout
(no mutation, temp cleaned), post-commit deadline (true SUCCESS, never `TIMEOUT`),
temporary-name collision cannot remove or overwrite a pre-existing file,
per-test disposable workspace removal verified (`ENOENT` after each). No canonical
filesystem-capability test mutates the repository worktree.

### Compatibility regression provenance

Against the unpatched baseline registry the four `COMP-POS` / escaped-control
transport cases reproduced the expected failure — a legal 1 MiB
`filesystem.read` result, the 1000×255 `filesystem.list` result and the
4096-char-path evidence ref exceeded the pre-erratum 100000-character result
envelope and normalized to `FAIL INTERNAL_ERROR`. With the authorized two-file
envelope split applied, all `COMP-POS` pass unchanged, the four `COMP-NEG`
still fail closed, and the full unchanged S14A focused suite (110/110) passes.
No existing S14A test was weakened or rewritten. No genuine S14A conflict with
the erratum was encountered.

## Registry compatibility patch — required-target confirmation

| Property | State |
| --- | --- |
| `validation.ts` changed | yes — result-envelope split only |
| `capabilityRegistryProvider.ts` changed | yes — result-specific validation call only |
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

## Commit and publication

- Candidate committed on `s14b-filesystem-capability-part-b` with parent
  `28acc89f00d62d5cdb626f3eee2e93ade69b0227` (1 commit ahead / 0 behind).
- Pushed to `origin/s14b-filesystem-capability-part-b`; remote branch SHA equals
  the exact local candidate SHA.
- No merge to `main`; no force push; no rebase/squash of the published baseline;
  no `STATE.yaml` / `CURRENT.md` phase-PASS update. `main` remains
  `28acc89f00d62d5cdb626f3eee2e93ade69b0227`.

## Limitations

- Credential/vendor recognition is a finite recognizer of common assignment and
  token shapes, not universal arbitrary-secret classification.
- Registry compatibility is conservative structural public-contract equality plus
  bounded traversal and secret rejection, not a JSON Schema theorem prover.
- This gate covers the authorized in-memory S14B filesystem provider and the exact
  two-file registry result-envelope patch. Live external adapters, connectors,
  Tools/MCP, OAuth, credentials, PostgreSQL, network and browser behavior, and any
  S14C+ surface are out of scope and not present.
- Real symlink / hard-link / `O_NOFOLLOW` / `/proc/self/fd` adversarial primitives
  were exercised on Linux (`Node v24.19.0`); the provider fails closed with
  `UNAVAILABLE` on platforms lacking `O_NOFOLLOW` / `O_DIRECTORY`.

## Next action

CONTROL_PLANE_SOURCE_AUDIT_OF_THE_EXACT_REMOTE_CANDIDATE, then fresh
non-authoring independent verification. This builder did not launch the
independent verifier, does not claim a verifier PASS, does not close S14, does
not award HI-054 and does not authorize S14C.
