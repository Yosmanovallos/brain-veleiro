# S14D — Git Capability Skill

**Parent step:** S14 — Capability Registry, Tools y MCP  
**Phase:** S14D  
**Name:** Git  
**Version:** 1.0.0  
**Status:** AUTHORING_READY  
**Classification:** RUNTIME_INFRASTRUCTURE  
**Depth:** DEEP  
**Canonical semantic-authoring baseline:** `4bceeb777127655369ff274b490233764c3e9fd9`  
**ChatGPT authoring gate:** GitHub Issue #1 comment `5561606182`  
**Honor invariant:** `HI-054 NOT_AWARDED`

> This file is canonical Part A semantic authoring for S14D. It authorizes no runtime
> implementation by itself. Part B requires a later, separate control-plane authorization.

---

## 1. Purpose

S14D gives Brain a provider-neutral, bounded local Git observation layer.

Agents request stable repository capabilities:

```text
repository.status
repository.read
```

They do **not** request:

```text
git status
git show
git cat-file
github.repository.read
mcp.git.read
local_git.read
```

The implementation identity remains behind `CapabilityProvider` and
`CapabilityRegistryProvider`.

Canonical runtime direction:

```text
AgentDefinition
      ↓ stable repository.* capability IDs
RestrictedCapabilityProvider
      ↓
CapabilityRegistryProvider
      ↓
WorkspaceGitCapabilityProvider
      ↓
bounded local Git process execution
```

S14D is the execution layer for a small read-only subset of local repository
observation. S13H remains the planning/policy layer.

---

## 2. Canonical decisions resolved by Part A

### 2.1 S14D v1 is strictly read-only

S14D v1 exposes exactly:

```text
repository.status   side_effects = NONE
repository.read     side_effects = NONE
```

No local Git mutation is authorized in v1.

The following remain out of scope:

```text
stage
add
commit
branch creation/deletion
checkout
switch
restore
reset
clean
stash
tag
notes
update-ref
worktree mutation
merge
rebase
cherry-pick
apply
am
gc/repack/prune
push/fetch/pull/clone
```

A future local-mutation phase requires separate ChatGPT authoring because it needs a
repository-wide precondition/serialization model that is materially different from
S14B's per-file write contract.

### 2.2 Exact v1 capability set

Only these two IDs are canonical:

```text
repository.status
repository.read
```

`repository.diff`, `repository.log`, `repository.show` and other read verbs are deferred
until a demonstrated consumer requires them.

This keeps S14D small enough to verify deeply while still supporting the two canonical
repository examples already present in S14.

### 2.3 Provider-swap / registry-collision resolution

The stable semantic identity is the provider-neutral capability ID.

The existing registry also treats the descriptor semantic signature as a compatibility
contract **within one `CapabilityRegistryConfig`**. Therefore:

- one registry configuration must not co-register divergent implementations of the same
  `repository.*` capability;
- provider swap is the S14 §16 model: **configuration A** selects one backing provider,
  **configuration B** selects another;
- a future S14F/S14I provider may reuse `repository.read` in another registry
  configuration;
- if two implementations are intentionally co-registered in one configuration, their
  descriptor semantic signatures must be identical or the existing registry correctly
  fails closed;
- S14D does not modify the registry to permit divergent side-effect classes for one
  co-registered capability.

No Core or registry semantic change is authorized.

### 2.4 `repository.status` remains `NONE`

`repository.status` is `NONE` only because its canonical implementation contract
requires all of the following together:

- `--no-optional-locks`;
- `GIT_OPTIONAL_LOCKS=0`;
- auto-gc and auto-maintenance disabled;
- no hooks/fsmonitor/pager/editor/credential helper;
- no remote/network path;
- standard supported repository shape only;
- builder and independent verifier prove a whole-`.git` subtree manifest remains
  unchanged across canonical status invocations, including a deliberately gc-eligible
  fixture;
- no detached Git maintenance process survives.

If the canonical implementation cannot satisfy that evidence, it is a **contract
failure**. The builder may not silently relabel `repository.status` as `LOCAL`.

### 2.5 `repository.read` is committed-object-only

`repository.read` reads exactly one regular tracked blob from committed repository
state.

It does not read:

- live worktree bytes;
- index stages;
- symlink targets as content;
- gitlinks/submodule content;
- remote content;
- binary output.

Live worktree file bytes remain S14B `filesystem.read`.

### 2.6 Revision grammar is deliberately small

Model-visible `revision` is optional and defaults to `HEAD`.

Accepted values are only:

```text
HEAD
<full 40-hex object id>
<full 64-hex object id>
```

No short SHA.
No raw symbolic branch/tag name in v1.
No `HEAD~N`, `HEAD^`, reflog syntax, `:/regex`, `^{}`, `A..B`, `A...B`,
index-stage syntax or other Git revision mini-language.

The provider must resolve the revision to a commit before resolving the path.

### 2.7 Standard-worktree support only

S14D v1 supports one explicitly configured, ordinary non-bare Git worktree whose
`.git` is a real directory immediately below the configured root.

v1 rejects:

- bare repositories;
- linked-worktree `.git` files;
- symlinked `.git`;
- sparse-checkout repositories;
- object alternates (`objects/info/alternates` or `http-alternates`);
- repository shapes requiring sibling-worktree traversal.

Shallow repositories are allowed, with point-in-time semantics limited to objects
actually present locally.

Submodules are not recursed. Status ignores submodule internals; `repository.read` does
not dereference gitlinks.

### 2.8 `create()` remains filesystem-only

`WorkspaceGitCapabilityProvider.create()` may validate provider configuration,
filesystem identities, repository shape and executable filesystem properties.

It must not spawn Git.

Every invocation performs a bounded `git --version` gate **before any
repository-facing Git operation**.

Supported Git runtime:

```text
>= 2.45.0
< 3.0.0
```

A version below the floor, major version 3+, unparseable version, or unavailable Git
binary returns/fails safely as `UNAVAILABLE` before repository observation.

The version probe consumes the same invocation-wide deadline; it does not reset the
timeout.

### 2.9 Process execution is Git-private in S14D

S14D does **not** route through `shell.execute`.

S14D also does not make `src/providers/capability/shell/execution.ts` a new shared
cross-provider dependency.

Part B may implement a small S14D-private process runner under:

```text
src/providers/capability/git/**
```

It must reproduce the accepted S14C process guarantees needed by S14D:

```text
spawn(..., shell:false)
stdin ignored/closed
stdout/stderr bounded pipes
no TTY/PTY
provider-created POSIX process group
one invocation-wide deadline
SIGTERM → grace → SIGKILL escalation
bounded group-liveness cleanup
leader close cannot cancel required cleanup
no truncated SUCCESS
```

S14C production remains byte-identical.

---

## 3. Provider configuration

Canonical trusted provider configuration:

```ts
interface WorkspaceGitConfig {
  repository_id: string;
  repository_root: string;
  git_executable: string;
  max_timeout_ms: number;
}
```

The model cannot supply or override any field above.

### `repository_id`

- provider-configured opaque logical identifier;
- pattern: `^[a-z0-9][a-z0-9._-]*$`;
- maximum 160 characters;
- must not contain recognizable sensitive material;
- appears in logical evidence/output, never as provider identity.

### `repository_root`

- explicit absolute host path;
- max 4096 characters;
- `realpath`-canonicalized;
- must be a directory;
- root and `.git` identities recorded using `dev:ino`;
- `.git` must be a direct real directory, not symlink or gitfile;
- no cwd/home/environment/git-discovery inference selects it.

### `git_executable`

- explicit absolute host path;
- max 4096 characters;
- canonical realpath;
- regular executable file;
- executable access required;
- identity recorded and rechecked before spawn;
- raw path never enters model-visible output/evidence.

### `max_timeout_ms`

```text
1..300000
```

Each invocation uses:

```text
effective_deadline =
invocation_start + min(request.timeout_ms, config.max_timeout_ms)
```

The deadline is never reset between the version gate and repository subcommands.

---

## 4. Canonical model-visible contracts

## 4.1 `repository.status`

Descriptor:

```text
capability_id: repository.status
side_effects: NONE
```

Input schema:

```json
{
  "type": "object",
  "properties": {},
  "required": [],
  "additionalProperties": false
}
```

Canonical output shape:

```ts
interface RepositoryStatusObservation {
  repository_id: string;
  branch: string | null;
  detached_head: boolean;
  head: string;               // "" for an unborn branch
  upstream_ref?: string;
  upstream_head?: string;
  ahead: number;
  behind: number;
  paths: Array<{
    path: string;
    tracked: boolean;
    staged: boolean;
    modified: boolean;
    deleted: boolean;
    untracked: boolean;
  }>;
  observed_at: string;        // UTC ISO-8601
}
```

This is intentionally a safe provider-level subset of S13H
`RepositoryStateSnapshot`.

S14D v1 does **not** expose:

- remote URLs;
- fetch URLs;
- push URLs;
- sibling worktree paths;
- host paths.

A later caller may adapt/augment this observation for S13H.

Maximum status entries:

```text
1000
```

If a repository observation would exceed the bound, fail closed rather than return a
truncated successful status.

Protected/sensitive filenames may appear as **metadata names** in status because S13H
must be able to classify them. Their file content is never returned by
`repository.status`.

## 4.2 `repository.read`

Descriptor:

```text
capability_id: repository.read
side_effects: NONE
```

Input:

```json
{
  "type": "object",
  "properties": {
    "revision": {
      "type": "string",
      "description": "HEAD or one full 40/64-hex commit object id."
    },
    "path": {
      "type": "string",
      "description": "Logical repository-relative tracked blob path."
    }
  },
  "required": ["path"],
  "additionalProperties": false
}
```

Default:

```text
revision = HEAD
```

Canonical output:

```ts
interface RepositoryReadObservation {
  repository_id: string;
  requested_revision: string;
  resolved_commit: string;
  path: string;
  object_id: string;
  size_bytes: number;
  content: string;
}
```

`resolved_commit` and `object_id` are full local Git object IDs.

Read must use committed object plumbing and must not invoke text conversion, filters,
worktree smudge or index-stage semantics.

Canonical conceptual flow:

```text
validate request
↓
validate revision grammar
↓
validate logical/protected path
↓
version gate
↓
resolve HEAD or verify full object ID is a commit
↓
resolve exactly one tree entry for path
↓
require regular blob mode
↓
cat-file blob by object ID
↓
bounded strict UTF-8 decode
↓
secret/path normalization checks
↓
SUCCESS
```

No model-controlled `rev:path` expression is handed to Git as an unresolved mini-language.

---

## 5. Logical path grammar and protected-content floor

`repository.read.path` reuses the S14B logical-path discipline.

Reject:

- empty path;
- >4096 characters;
- >256 segments;
- segment >255 UTF-8 bytes;
- NUL;
- lone surrogate;
- leading `/`;
- Windows drive prefix;
- UNC/backslash forms;
- empty internal segment;
- `.` segment;
- `..` segment;
- leading `-`;
- leading `:`;
- Git pathspec magic.

Protected path floor for content reads is at least:

```text
.git
.ssh
.gnupg
.aws
.azure
.kube
.npmrc
.pypirc
.netrc
.env
.env.*
*.pem
*.key
*.p12
*.pfx
credentials.*
id_rsa
id_ed25519
```

`.env.example` remains the explicit `.env.*` exception.

Protection is segment-aware and case-insensitive where the S14B precedent is
case-insensitive.

A committed symlink object (`120000`) is not returned as file content.
A gitlink/submodule object (`160000`) is not dereferenced.
Only regular file blob modes are readable.

Recognizable sensitive material in decoded blob content is blocked as a second
fail-closed layer. The provider must never claim complete secret detection.

---

## 6. Fixed Git invocation boundary

The model never supplies:

```text
subcommand
argv
args
env
git_dir
work_tree
-C
-c
config
format
pretty
output
exec_path
upload_pack
remote
url
stdin
shell
```

Each Git invocation comes from a closed provider-owned operation table.

Allowed v1 Git operation families are only those necessary for:

```text
git --version
status
rev-parse
cat-file
ls-tree
```

No arbitrary pass-through option field exists.

The canonical operation table must structurally contain no network or mutation
subcommand.

Every process launch:

```text
shell:false
stdin:"ignore"
stdout:"pipe"
stderr:"pipe"
detached:true on Linux/WSL
no TTY/PTY
```

No command string is constructed.

---

## 7. Fixed child environment

The Git child receives a provider-built environment only.

`process.env` is never spread or inherited.

Canonical fixed environment includes:

```text
PATH=/usr/bin:/bin
HOME=/nonexistent
XDG_CONFIG_HOME=/nonexistent
GNUPGHOME=/nonexistent

GIT_CONFIG_NOSYSTEM=1
GIT_CONFIG_GLOBAL=/dev/null
GIT_CONFIG_SYSTEM=/dev/null

GIT_TERMINAL_PROMPT=0
GIT_ASKPASS=/bin/false
SSH_ASKPASS=/bin/false
GIT_SSH_COMMAND=/bin/false

GIT_PAGER=cat
GIT_OPTIONAL_LOCKS=0
GIT_LITERAL_PATHSPECS=1
GIT_NO_REPLACE_OBJECTS=1
GIT_LFS_SKIP_SMUDGE=1
GIT_DISCOVERY_ACROSS_FILESYSTEM=0

LC_ALL=C
LANG=C
TZ=UTC
```

No model or caller field may add to or override this environment.

Host sentinels such as `GIT_DIR`, `GIT_WORK_TREE`, `GIT_EXEC_PATH`,
`GIT_CONFIG_COUNT`, `GIT_OBJECT_DIRECTORY`, `GIT_ALTERNATE_OBJECT_DIRECTORIES`,
`GIT_EXTERNAL_DIFF` or credential/loader variables must not reach the child.

---

## 8. Canonical fixed Git safety overrides

Every repository-facing Git invocation uses trusted global options/config overrides
equivalent in effect to:

```text
--no-pager
--no-optional-locks
--no-replace-objects
--git-dir=<canonical-root>/.git
--work-tree=<canonical-root>

-c safe.directory=<canonical-root>
-c core.worktree=<canonical-root>

-c core.hooksPath=/nonexistent/brain-git-hooks
-c core.fsmonitor=false
-c core.untrackedCache=false
-c core.pager=cat
-c core.editor=/bin/false
-c core.excludesFile=/dev/null
-c core.attributesFile=/dev/null

-c credential.helper=
-c gpg.program=/bin/false
-c commit.gpgsign=false
-c log.showSignature=false
-c tag.gpgSign=false

-c gc.auto=0
-c gc.autoDetach=false
-c gc.writeCommitGraph=false
-c maintenance.auto=false
-c fetch.writeCommitGraph=false
-c core.commitGraph=false

-c protocol.file.allow=never
-c protocol.ext.allow=never

-c filter.lfs.smudge=cat
-c filter.lfs.process=
-c filter.lfs.required=false

-c status.submoduleSummary=false
-c submodule.recurse=false
```

`repository.status` additionally uses a fixed status template equivalent to:

```text
status
--porcelain=v2
--branch
-z
--untracked-files=all
--ignore-submodules=all
```

The provider must not rely on aliases, pager, hooks, credential helpers, fsmonitor,
LFS, submodule recursion, external diff/textconv or auto-maintenance.

Unknown future Git behavior is bounded by the supported Git version range and by
independent real-process verification.

---

## 9. Repository shape and identity

At filesystem-only construction time:

1. `repository_root` is canonicalized and opened without following a root symlink;
2. `<root>/.git` must be an actual directory;
3. symlink `.git` is rejected;
4. gitfile/linked-worktree `.git` is rejected;
5. root and `.git` `dev:ino` are recorded;
6. `objects/info/alternates` and `objects/info/http-alternates` must not exist as active
   alternate-object sources;
7. sparse-checkout state is rejected in v1;
8. linked-worktree administrative state requiring sibling traversal is rejected;
9. `git_executable` is canonicalized, regular and executable.

Before repository-facing spawn:

```text
root identity recheck
→ .git identity recheck
→ git executable identity recheck
→ synchronous remaining-deadline check
→ immediate process launch
```

Observed identity drift fails closed.

The contract does not claim atomic `fexecve` protection in the final kernel launch
window.

---

## 10. Git version gate

`create()` performs no process spawn.

Each invocation begins under the invocation-wide deadline with a bounded, fixed:

```text
<git_executable> --version
```

using the Git-private process runner and explicit environment.

Accept only parsed versions:

```text
>= 2.45.0
< 3.0.0
```

No repository-facing Git command may run before that gate passes.

No retry.
No fallback binary.
No PATH search for Git.

---

## 11. Network absence is structural

S14D v1 has no external network side effect.

This is proved structurally and with real fixtures.

The operation table contains no path to:

```text
fetch
pull
push
clone
ls-remote
remote
submodule
archive --remote
send-pack
receive-pack
upload-pack
daemon
credential
http-*
```

No model field can carry:

```text
remote name
remote URL
host
provider endpoint
credential
auth ref
```

`protocol.file.allow=never` and `protocol.ext.allow=never` are pinned.

No GitHub, GitLab, Bitbucket or MCP API appears in S14D.

---

## 12. `NONE` side-effect proof

The canonical `NONE` claim covers observable local Git state.

Canonical QA snapshots the complete `.git` subtree before and after representative
`repository.status` and `repository.read` calls.

The manifest must account for repository-relative entry name, type, size and content
identity sufficiently to detect writes/replacements to at least:

```text
index
HEAD
refs/**
packed-refs
logs/**
FETCH_HEAD
ORIG_HEAD
shallow
gc.log
objects/info/**
objects/pack/**
commit-graph
multi-pack-index
worktrees/**
```

A deliberately gc-eligible fixture must still show:

```text
manifest before == manifest after
no detached maintenance process
```

Plain unsafe `git status` must be shown capable of violating the index non-mutation
probe, while the canonical `--no-optional-locks` path remains unchanged, so the detector
is non-vacuous.

If the safe canonical path writes `.git`, Part B fails. The builder may not convert the
descriptor to `LOCAL`.

---

## 13. Output, UTF-8 and result bounds

Canonical limits:

```text
max_status_paths:              1000
max_blob_bytes:                1048576
max_stdout_bytes:              1048576
max_stderr_bytes:              65536
max_combined_output_bytes:     1114112
max_repository_timeout_ms:     300000
termination_grace_ms:          500
group_cleanup_budget_ms:       4000
max_evidence_refs:             4
max_safe_error_chars:          500
```

No successful output is silently truncated.

Process output is captured as bytes and decoded with strict/fatal UTF-8.

Invalid UTF-8 fails closed.

`repository.read` of binary/non-UTF-8 content fails closed and returns no raw bytes.

Recognizable secret-bearing output is not returned.

Known canonical host paths are normalized before model visibility:

```text
repository_root          → repository://<repository_id>
git executable realpath  → <git>
configured executable    → <git>
```

Provider-internal `/nonexistent` safety paths are never surfaced.

Model-visible evidence is logical only:

```text
repository://<repository_id>/status
repository://<repository_id>@<resolved-commit>/<logical-path>
```

---

## 14. Status semantics

`repository.status` observes only the bound worktree.

It must parse Git output, not pass porcelain text directly to the model.

It returns structured path metadata and branch/upstream counters.

For an unborn branch:

```text
head = ""
detached_head = false
branch = current branch name
```

For detached HEAD:

```text
branch = null
detached_head = true
head = full object id
```

If no upstream exists:

```text
upstream_ref omitted
upstream_head omitted
ahead = 0
behind = 0
```

No remote URL appears.

A concurrent external Git process may change repository state between observations.
S14D status is a point-in-time observation and does not claim transaction isolation.

S14D never creates, waits on, removes or repairs `index.lock`.

---

## 15. Read semantics

`repository.read` returns one regular committed blob.

For `HEAD`, the provider resolves HEAD using a provider-fixed operation.

For a supplied full object ID, the provider verifies that it names a commit before path
resolution.

Path resolution is a provider-controlled tree lookup followed by `cat-file` of the
resolved blob object ID.

No unresolved model-controlled `revision:path` expression is sent to Git.

No worktree filter, textconv, LFS smudge, external diff or index stage is consulted.

If the path does not exist, is a tree, symlink, gitlink or other unsupported mode, the
provider fails safely and does not return content.

---

## 16. Timeout and process lifecycle

The invocation captures one monotonic start time.

All child processes in one invocation share the same effective absolute deadline:

```text
version gate
status/read resolution steps
blob output
cleanup
```

No subcommand gets a fresh timeout.

On timeout or output overflow:

```text
mark provider-induced termination
→ SIGTERM provider-created process group
→ wait termination_grace_ms
→ if still alive, SIGKILL process group
→ bounded liveness polling up to group_cleanup_budget_ms
→ return normalized failure
```

The leader closing does not cancel descendant cleanup.

The result wording says bounded termination/cleanup was attempted; it does not claim
guaranteed OS-level extinction or rollback.

Auto-maintenance is configured off specifically because a self-sessioning Git daemon is
outside the process-group threat model.

---

## 17. Failure semantics

Use the existing Brain result/error union only.

Canonical mapping:

| Condition | Result |
|---|---|
| unknown capability / permission denial | `BLOCKED` |
| malformed input / revision/path grammar / invalid UTF-8 | `FAIL / INVALID_INPUT` |
| protected content path | `BLOCKED` |
| unborn/missing revision or missing tracked blob | `FAIL / NOT_FOUND` |
| root is not supported repo shape / Git version unsupported / executable or repo identity drift | `FAIL / UNAVAILABLE` |
| OS permission denial | `FAIL / PERMISSION_DENIED` |
| deadline exceeded | `FAIL / TIMEOUT` |
| output overflow / bounded spawn/parse/cleanup failure / status bound exceeded | `FAIL / EXECUTION_FAILED` |
| recognizable sensitive blob/output | `BLOCKED` |
| unexpected provider-internal failure | `FAIL / INTERNAL_ERROR` with safe normalized text |

No raw Git fatal, stack, host path, credential or provider configuration is returned.

---

## 18. S13H boundary

S13H remains the policy/planning layer.

S14D:

- observes repository state;
- reads bounded committed content;
- does not decide whether mutation is authorized;
- does not invent commit plans;
- does not select branches/worktrees;
- does not execute a `RepositoryWorkflowDecision` mutation plan in v1.

`repository.status` is intentionally a safe subset, not a replacement for every field
of S13H `RepositoryStateSnapshot`.

---

## 19. Registry / Restricted / AgentDefinition acceptance

Part B must prove the actual path:

```text
WorkspaceGitCapabilityProvider
      ↓
CapabilityRegistryProvider
      ↓
RestrictedCapabilityProvider
      ↓
runAgent()
```

No Git special case is added to the registry.

Capability denial prevents Git spawn.

`NONE` side-effect denial prevents Git spawn.

Provider swap acceptance:

```text
same AgentDefinition bytes
same repository.read capability_id
same semantic input
config A → repo/provider A
config B → repo/provider B
different observed content
```

For the counterfactual, permission policy stays byte-identical and permits the declared
capability/side-effect class.

A separate registry config may later select a different implementation. Divergent
descriptors are not co-registered in one current-v1 registry instance.

---

## 20. Protected surfaces

S14D Part B should be additive under:

```text
src/providers/capability/git/**
tests/git-capability/**
brain-bootstrap/reports/S14D-git-capability-verification.md
```

Protected existing surfaces include:

```text
src/core/agent/**
src/providers/capability/registry/**
src/providers/capability/filesystem/**
src/providers/capability/shell/**
src/intelligence/repository-git-workflow/**

tests/capability-registry/**
tests/filesystem-capability/**
tests/shell-capability/**
tests/repository-git-workflow/**

package.json
package-lock.json
tsconfig.json
vitest.config.ts

brain-bootstrap/STATE.yaml
brain/context/CURRENT.md

all prior canonical S13H/S14A/S14B/S14C authored artifacts
```

Part B may not add a dependency.

If implementation requires modifying any protected semantic surface, stop with:

```text
CHATGPT_AUTHORING_REQUIRED
```

---

## 21. Forbidden scope

S14D v1 must not implement:

- Git mutation;
- network Git;
- GitHub/GitLab/Bitbucket APIs;
- OAuth or credential storage;
- MCP;
- docs/search;
- browser;
- PostgreSQL;
- arbitrary shell execution;
- binary content API;
- submodule recursion;
- sibling worktree traversal;
- S15+ behavior.

S14D cannot:

```text
close S14
award HI-054
authorize S14E
```

---

## 22. Required QA character

Verification must use real disposable repositories under the test runtime temp
directory and never mutate the Brain repository.

Mock-only Git verification is invalid.

Canonical fixtures include:

- clean repository;
- dirty/staged/untracked repository;
- detached HEAD;
- unborn branch;
- shallow repository;
- protected path committed blob;
- symlink blob;
- gitlink/submodule entry;
- binary/invalid UTF-8 blob;
- recognized secret in committed blob;
- hostile hooks/config/fsmonitor/pager/credential-helper;
- gc-eligible object store;
- sparse/linked/bare/alternate-object unsupported repository shapes;
- huge blob/status output;
- timeout and process-group fixtures;
- repo A/repo B provider-swap fixture.

Every unsafe detector must be independently fireable.

---

## 23. Canonical inventories

S14D Part A fixes:

```text
positive fixtures:     14
negative fixtures:     42
hard invariants:       40
unsafe counters:       12
```

Part B must implement exactly those canonical IDs from the DEEP quality contract.

Additional non-canonical regression tests are allowed without changing inventory counts.

---

## 24. Acceptance lifecycle

S14D follows the established S14 gate:

```text
ChatGPT authors Part A
↓
byte-for-byte mechanical Part A integration
↓
ChatGPT verifies exact remote Part A
↓
separate Part B authorization
↓
fresh builder
↓
control-plane source audit of exact candidate
↓
fresh non-authoring/non-fork/read-only verifier
↓
standalone verifier relay
↓
separate control-plane acceptance
↓
bounded phase closure
```

A phase PASS does not close S14.

`HI-054` remains unawarded until final S14 closure.

---

## 25. Exit state of Part A

```text
S14C = VERIFIED PASS / PHASE CLOSED
S14D = PART_A_AUTHORED / PART_B_NOT_AUTHORIZED
S14  = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14E = NOT_AUTHORIZED
```
