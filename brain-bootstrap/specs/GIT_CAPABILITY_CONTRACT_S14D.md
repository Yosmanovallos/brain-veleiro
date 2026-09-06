# S14D — Git Capability Semantic Contract

**Parent step:** S14  
**Phase:** S14D  
**Name:** Git  
**Version:** 1.0.0  
**Status:** AUTHORING_READY  
**Classification:** RUNTIME_INFRASTRUCTURE  
**Depth:** DEEP  
**Semantic-authoring baseline:** `4bceeb777127655369ff274b490233764c3e9fd9`  
**Authoring authority:** GitHub Issue #1 comment `5561606182`  
**Honor invariant:** `HI-054 NOT_AWARDED`

---

## 1. Contract status

This document is canonical S14D Part A semantics.

It fixes the v1 capability surface, trust boundary, failure semantics, process model,
security floor, limits and verification expectations.

It does **not** authorize runtime implementation.

S14D Part B requires a later explicit control-plane authorization after these three Part
A artifacts are integrated byte-for-byte and independently fact-checked against remote
repository truth.

---

## 2. Repository-grounded inheritance

S14D inherits and must preserve:

1. existing Core `CapabilityProvider`, `ToolDescriptor`, `ToolInvocationRequest`,
   `ToolInvocationResult`, `ToolSideEffectClass`;
2. `RestrictedCapabilityProvider`;
3. `AgentDefinition` provider neutrality;
4. S14A `CapabilityRegistryProvider`;
5. S14B workspace/path/protected-content discipline where applicable;
6. S14C real-process safety discipline, without modifying S14C;
7. S13H repository workflow as a planning/policy layer, not an execution layer.

No new Core enum, result type, side-effect class, AgentDefinition field, dependency or
registry special case is authorized.

---

## 3. Exact S14D v1 capabilities

Exactly:

```text
repository.status
repository.read
```

Both declare:

```text
side_effects = NONE
```

No other `repository.*` verb is in S14D v1.

### 3.1 Deferred read verbs

These are explicitly deferred:

```text
repository.diff
repository.log
repository.show
```

They require additional textconv/identity/output semantics and are unnecessary to close
the minimum useful local Git phase.

### 3.2 Deferred local mutation

These are explicitly not S14D v1:

```text
repository.stage
repository.commit
repository.branch_create
repository.checkout
repository.worktree_add
repository.tag
repository.reset
```

Any future mutation requires a separate authoring gate defining expected-HEAD
preconditions, repository-wide serialization, concurrent external Git semantics and
rollback/non-rollback wording.

---

## 4. Registry compatibility resolution

### 4.1 Stable identity

`repository.*` capability IDs are provider-neutral.

They do not encode:

```text
git
GitHub
GitLab
Bitbucket
MCP
provider id
transport
credential system
executable
host path
```

### 4.2 Existing registry collision behavior is preserved

The current registry semantic signature includes:

```text
capability_id
input_schema
output_schema
side_effects
timeout_ms
```

The registry inspects all providers registered in one configuration and fails closed on
divergent signatures for one capability ID.

S14D does not weaken or change that behavior.

### 4.3 Provider swap means configuration substitution

Canonical S14 provider-swap semantics for v1 are:

```text
same AgentDefinition bytes
same capability_id
same semantic invocation input
same permission policy

registry configuration A:
repository.read → provider A

registry configuration B:
repository.read → provider B
```

A future GitHub/MCP implementation may reuse `repository.read` in another registry
configuration.

S14D does not require divergent local/remote backers to be simultaneously registered in
one registry configuration.

If future work requires co-registration, the providers must advertise an identical
semantic signature or a separate ChatGPT registry-authoring gate is required.

This resolution requires no Core or S14A code change.

---

## 5. Side-effect semantics

### 5.1 `repository.read`

`NONE`.

The operation reads committed local object state only and is prohibited from:

- changing worktree/index/refs/config/object store;
- running filters/textconv;
- contacting a remote;
- invoking a credential helper;
- auto-maintenance;
- mutation subcommands.

### 5.2 `repository.status`

`NONE`.

The `NONE` declaration is a hard contract, not an assumption based on the word
"status".

Canonical implementation must use `--no-optional-locks` / `GIT_OPTIONAL_LOCKS=0` and
the full Git safety floor.

Part B must prove a complete `.git`-subtree observation manifest remains unchanged on
canonical fixtures.

A plain `git status` unsafe control must demonstrate the detector can observe an index
rewrite on a fixture/runtime where Git would normally refresh it.

If canonical status mutates `.git`, Part B fails.

The builder may not relabel the capability as `LOCAL` without new ChatGPT authoring.

---

## 6. Trusted provider configuration

```ts
export interface WorkspaceGitConfig {
  repository_id: string;
  repository_root: string;
  git_executable: string;
  max_timeout_ms: number;
}
```

No model input may select or modify these fields.

### 6.1 `repository_id`

Requirements:

```text
pattern: ^[a-z0-9][a-z0-9._-]*$
max chars: 160
recognizable sensitive material: forbidden
```

It is a logical repository identifier, not a provider identity or credential reference.

### 6.2 `repository_root`

Requirements:

- string;
- absolute;
- max 4096 chars;
- canonical `realpath`;
- directory;
- explicit provider configuration;
- no inference from cwd, `HOME`, process environment, `.git` discovery or remote
  metadata.

### 6.3 `git_executable`

Requirements:

- string;
- absolute;
- max 4096 chars;
- canonical realpath;
- regular file;
- executable access;
- explicit provider config;
- no PATH search or fallback binary.

### 6.4 Timeout

```text
1 <= max_timeout_ms <= 300000
```

Invocation effective deadline:

```text
invocation_start = monotonic_now
effective_timeout = min(request.timeout_ms, config.max_timeout_ms)
effective_deadline = invocation_start + effective_timeout
```

All version/repository subprocesses and cleanup consume the same deadline.

---

## 7. Construction-time repository shape

`WorkspaceGitCapabilityProvider.create()` is filesystem-only.

It must not spawn Git.

Construction validates the standard v1 repository shape.

### 7.1 Accepted shape

- Linux/WSL canonical platform;
- canonical explicit root directory;
- `<root>/.git` exists as a direct real directory;
- root and `.git` are not symlinks;
- root and `.git` identities are recordable;
- Git executable validates as regular executable.

### 7.2 Rejected shape

Fail safely if any is true:

- root missing/non-directory;
- `.git` missing;
- `.git` symlink;
- `.git` regular gitfile (linked worktree);
- bare-repository layout rather than ordinary worktree;
- sparse-checkout administrative state;
- active object-alternate files;
- linked-worktree administrative shape requiring sibling worktrees;
- configured Git executable missing/non-regular/non-executable.

Canonical alternate files:

```text
.git/objects/info/alternates
.git/objects/info/http-alternates
```

Canonical sparse signal includes:

```text
.git/info/sparse-checkout
```

Canonical linked-worktree administrative state includes a `.git` gitfile and may include
`.git/worktrees/**`; S14D v1 does not traverse sibling worktrees.

Shallow repositories may be accepted.

---

## 8. Per-invocation identity gates

Before any repository-facing Git spawn:

1. recheck root identity;
2. recheck `.git` identity;
3. recheck Git executable identity;
4. ensure remaining deadline is positive;
5. launch immediately without unrelated asynchronous work.

Observed root, `.git` or executable identity drift fails closed.

The contract does not claim an atomic kernel `fexecve`/race-free final window.

---

## 9. Git runtime version gate

No Git process runs at `create()`.

Every invocation begins with a fixed bounded version probe:

```text
<configured-absolute-git> --version
```

The probe:

- uses the S14D-private process runner;
- uses the provider-built child environment;
- consumes the same invocation deadline;
- has no repository model input.

Supported version:

```text
2.45.0 <= version < 3.0.0
```

Only numeric major/minor/patch from the standard Git version prefix is authoritative.
Vendor suffixes may be ignored after a successfully parsed version triple.

If version is unsupported or unparseable:

```text
FAIL / UNAVAILABLE
```

No repository-facing subcommand runs after a failed version gate.

---

## 10. S14D-private process runner

Part B may add process execution code only beneath:

```text
src/providers/capability/git/**
```

It must not modify or import S14C into a mutable cross-provider shared surface.

Required runtime behavior:

- Node 24 built-ins only;
- Linux/WSL;
- `child_process.spawn`;
- `shell:false`;
- `stdin:"ignore"`;
- stdout/stderr pipes;
- no TTY/PTY;
- `detached:true` POSIX process group;
- explicit exact environment;
- one absolute invocation deadline;
- no hidden retry;
- bounded stdout/stderr;
- overflow-induced group termination;
- timeout-induced group termination;
- `SIGTERM` → grace → `SIGKILL` when group remains;
- bounded group-liveness polling;
- leader close does not prematurely cancel cleanup.

The provider does not claim to contain a child that deliberately escapes into another
session/process group.

Git auto-maintenance is disabled specifically so canonical Git operations do not create
such a daemon outside the accepted group.

---

## 11. Closed Git operation table

No model-provided command, subcommand, option list or raw argv exists.

Canonical internal operation families are limited to:

```text
VERSION
STATUS
RESOLVE_HEAD
VERIFY_COMMIT_OBJECT
RESOLVE_TREE_ENTRY
READ_BLOB
```

These map only to fixed Git builtins necessary for:

```text
--version
status
rev-parse
cat-file
ls-tree
```

Any Part B operation table containing mutation/network/general-purpose subcommands is a
contract failure.

### 11.1 Structural deny set

No code path may execute:

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
add
commit
rm
mv
branch
checkout
switch
restore
reset
clean
stash
worktree
tag
notes
update-ref
symbolic-ref write
config write
gc
maintenance
repack
prune
replace
rebase
merge
cherry-pick
am
apply
```

No template accepts a remote name/URL, arbitrary `-c`, `--exec-path`,
`--upload-pack`, `--git-dir`, `--work-tree`, `-C`, output target or raw option field from
model input.

---

## 12. Exact child environment

Child environment is provider-constructed and exact.

No `process.env` spread/merge/inheritance.

Canonical required entries:

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

Host environment variables do not reach Git unless they are exactly recreated by this
canonical provider map.

In particular host values of these classes are excluded:

```text
GIT_DIR
GIT_WORK_TREE
GIT_COMMON_DIR
GIT_OBJECT_DIRECTORY
GIT_ALTERNATE_OBJECT_DIRECTORIES
GIT_INDEX_FILE
GIT_NAMESPACE
GIT_EXEC_PATH
GIT_CONFIG
GIT_CONFIG_COUNT
GIT_CONFIG_PARAMETERS
GIT_PROXY_COMMAND
GIT_EXTERNAL_DIFF
GIT_SSH
GIT_SSH_COMMAND
credential-like variables
LD_*
NODE_OPTIONS
language runtime injection variables
```

No provider-configurable free-form env exists in S14D v1.

---

## 13. Fixed Git global options/config safety floor

Repository-facing Git operations must be equivalent in effect to applying all canonical
safety controls.

Global options:

```text
--no-pager
--no-optional-locks
--no-replace-objects
--git-dir=<canonical-root>/.git
--work-tree=<canonical-root>
```

Provider-owned `-c` overrides:

```text
safe.directory=<canonical-root>
core.worktree=<canonical-root>

core.hooksPath=/nonexistent/brain-git-hooks
core.fsmonitor=false
core.untrackedCache=false
core.pager=cat
core.editor=/bin/false
core.excludesFile=/dev/null
core.attributesFile=/dev/null

credential.helper=
gpg.program=/bin/false
commit.gpgsign=false
log.showSignature=false
tag.gpgSign=false

gc.auto=0
gc.autoDetach=false
gc.writeCommitGraph=false
maintenance.auto=false
fetch.writeCommitGraph=false
core.commitGraph=false

protocol.file.allow=never
protocol.ext.allow=never

filter.lfs.smudge=cat
filter.lfs.process=
filter.lfs.required=false

status.submoduleSummary=false
submodule.recurse=false
```

Part B may choose an argv ordering compatible with Git, but the semantic effects above
are mandatory and model-immutable.

No safety override may be silently omitted because it appears redundant on a particular
developer machine.

---

## 14. `repository.status` input contract

Exact model-visible schema:

```json
{
  "type": "object",
  "properties": {},
  "required": [],
  "additionalProperties": false
}
```

Any extra key is `INVALID_INPUT`.

No repository selector is accepted from model input.

---

## 15. `repository.status` output contract

```ts
interface RepositoryStatusObservation {
  repository_id: string;
  branch: string | null;
  detached_head: boolean;
  head: string;
  upstream_ref?: string;
  upstream_head?: string;
  ahead: number;
  behind: number;
  paths: RepositoryStatusPath[];
  observed_at: string;
}

interface RepositoryStatusPath {
  path: string;
  tracked: boolean;
  staged: boolean;
  modified: boolean;
  deleted: boolean;
  untracked: boolean;
}
```

Constraints:

```text
paths.length <= 1000
path grammar bounded
all numbers finite non-negative integers
object IDs full 40/64 hex or "" for unborn head
observed_at UTC ISO-8601
```

Status implementation must parse fixed porcelain output and create structured output.
Raw porcelain text is not the public contract.

No remote URL.
No remote credential.
No sibling worktree absolute path.

### 15.1 Branch states

Unborn:

```text
head = ""
branch = branch name
detached_head = false
```

Detached:

```text
head = full object id
branch = null
detached_head = true
```

No upstream:

```text
upstream_ref omitted
upstream_head omitted
ahead = 0
behind = 0
```

### 15.2 Canonical status Git template

Equivalent in semantics to:

```text
git
  <fixed global safety prefix>
  status
  --porcelain=v2
  --branch
  -z
  --untracked-files=all
  --ignore-submodules=all
```

`--no-optional-locks` is load-bearing.

---

## 16. Status side-effect invariant

A successful status must not create, replace, mutate or delete local repository
administrative state.

Verification compares a full `.git` manifest before/after canonical status.

It must cover more than `index/HEAD/refs`.

At minimum, detect differences across:

```text
.git/index
.git/HEAD
.git/refs/**
.git/packed-refs
.git/logs/**
.git/FETCH_HEAD
.git/ORIG_HEAD
.git/shallow
.git/gc.log
.git/objects/info/**
.git/objects/pack/**
.git/commit-graph
.git/objects/info/commit-graph
.git/objects/info/multi-pack-index
.git/worktrees/**
```

A deliberately gc-eligible fixture is mandatory.

No detached Git maintenance process may remain after success.

A successful `repository.status` result that changes the manifest is invalid.

---

## 17. `repository.read` input contract

Exact model-visible schema:

```json
{
  "type": "object",
  "properties": {
    "revision": { "type": "string" },
    "path": { "type": "string" }
  },
  "required": ["path"],
  "additionalProperties": false
}
```

Default:

```text
revision = HEAD
```

Accepted revision:

```text
HEAD
^[0-9a-fA-F]{40}$
^[0-9a-fA-F]{64}$
```

No other syntax.

Reject:

```text
short SHA
branch/tag name
leading -
whitespace/control
NUL
@{
}
:
^
~
..
...
reflog syntax
index-stage syntax
revision range
```

The full object ID is supplied to Git as one validated argv value only after grammar
validation.

---

## 18. Repository path contract

`repository.read.path`:

```text
1..4096 chars
<=256 segments
<=255 UTF-8 bytes per segment
strict valid Unicode string
no NUL
no leading /
no Windows drive
no UNC/backslash
no empty segment
no .
no ..
no leading -
no leading :
```

`GIT_LITERAL_PATHSPECS=1` is fixed.

A provider-owned `--` end-of-options separator precedes model path values where the
selected Git subcommand supports it.

No model path is treated as a Git option or pathspec program.

---

## 19. Protected read floor

Before any blob content resolution, reject protected content paths.

Canonical protected classes:

```text
.git/**
.ssh/**
.gnupg/**
.aws/**
.azure/**
.kube/**
.npmrc
.pypirc
.netrc

.env
.env.*
  except .env.example

*.pem
*.key
*.p12
*.pfx
credentials.*
id_rsa
id_ed25519
```

The match is segment-aware.

This structural path floor is primary. `sensitive()` content recognition is only a
backstop and must not be described as complete secret detection.

Status metadata may report the relative name of a protected path; status never returns
its bytes.

---

## 20. `repository.read` output contract

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

Constraints:

```text
size_bytes <= 1048576
content strict UTF-8
resolved_commit full 40/64 hex
object_id full 40/64 hex
path equals canonical logical request path
```

No binary/base64 fallback.

No truncated SUCCESS.

No author identity, remote identity, provider identity or host path.

---

## 21. Committed-object resolution

Canonical semantic stages:

### 21.1 `HEAD`

Resolve using a fixed provider operation equivalent to:

```text
rev-parse --verify HEAD
```

The model does not control any revision expression.

Unborn HEAD maps to `NOT_FOUND`.

### 21.2 Full commit object ID

A supplied full 40/64-hex value is verified by fixed `cat-file` object-type inspection.

It must be a commit object.

A missing/non-commit object does not become an implicit Git revision expression.

### 21.3 Tree entry

Resolve the validated path against the validated commit using fixed tree plumbing
equivalent to:

```text
ls-tree -z <resolved-commit> -- <validated-path>
```

The result must identify exactly one supported regular blob entry.

Unsupported:

```text
tree
symlink mode 120000
gitlink mode 160000
unexpected/malformed entry
```

No recursive submodule access.

### 21.4 Blob

Read only the already-resolved blob object ID using fixed `cat-file` plumbing.

`cat-file` is chosen because committed object bytes are returned without worktree
filters, smudge, textconv or external diff.

No unresolved model-controlled `revision:path` composite is handed to Git.

---

## 22. Output and transport bounds

Canonical limits:

```yaml
max_repository_id_chars: 160
max_repository_root_chars: 4096
max_git_executable_path_chars: 4096
max_revision_chars: 64
max_path_chars: 4096
max_path_segments: 256
max_path_segment_utf8_bytes: 255
max_status_paths: 1000
max_blob_bytes: 1048576

max_stdout_bytes: 1048576
max_stderr_bytes: 65536
max_combined_output_bytes: 1114112

max_repository_timeout_ms: 300000
termination_grace_ms: 500
group_cleanup_budget_ms: 4000

max_evidence_refs: 4
max_safe_error_chars: 500
```

Every legal maximum result must remain transportable through the accepted
`canonicalToolResult()` 8,388,608-character registry envelope and 10,000-node traversal
budget.

Status path count 1000 is a public result-shape bound chosen in part to stay safely
below that node budget.

---

## 23. Strict UTF-8 and secret handling

Git stdout/stderr are raw bounded bytes until execution finishes.

Model-visible text uses fatal UTF-8 decode.

Invalid UTF-8:

```text
FAIL / INVALID_INPUT
```

No replacement decoding.
No base64 escape hatch.

Recognizable secret material in candidate model-visible blob/status/error text is not
returned.

`repository.read` on a protected path is blocked before content read where possible.

The provider does not claim that finite pattern recognition finds every secret.

---

## 24. Host-path normalization

Known provider-local absolute paths must not be returned raw.

Canonical replacements occur before model visibility and before safe error/evidence
construction.

At minimum:

```text
canonical repository root → repository://<repository_id>
git executable realpath   → <git>
configured executable     → <git>
```

Specific executable identity replacement occurs before broader repository-root
replacement if strings could overlap.

Logical evidence:

```text
repository://<repository_id>/status
repository://<repository_id>@<resolved_commit>/<path>
```

Evidence contains no credential, remote URL or host path.

---

## 25. No repository discovery escape

The provider never asks Git to discover an arbitrary repository from model cwd.

Every repository-facing command is pinned to trusted config using fixed
`--git-dir=<root>/.git` and `--work-tree=<root>` semantics.

`GIT_DISCOVERY_ACROSS_FILESYSTEM=0` is set as defence in depth.

The provider does not accept model `-C`, `GIT_DIR`, `GIT_WORK_TREE` or repository-root
input.

`.git` symlink/gitfile/linked-worktree shapes are rejected in v1.

---

## 26. Object alternate prohibition

S14D v1 must not read Git objects from an arbitrary external alternate object store.

Construction fails closed if active alternate sources are configured through:

```text
.git/objects/info/alternates
.git/objects/info/http-alternates
```

Host environment alternate-object variables are never inherited.

This preserves the claim that `repository.read` observes the explicitly bound local
repository object store.

---

## 27. Submodules, LFS, filters and attributes

### Submodules

Status:

```text
--ignore-submodules=all
```

No recursive submodule process.

Read:

- a gitlink entry is not dereferenced;
- no `.gitmodules` URL is contacted;
- no submodule command exists in the operation table.

### LFS

Fixed environment/config prevents smudge/process execution.

`cat-file` reads the committed pointer blob, not remote LFS content.

### Attributes / textconv

S14D v1 has no public diff/log/show capability.

`repository.read` uses `cat-file`, so committed `.gitattributes` does not authorize a
textconv/filter command.

`core.attributesFile=/dev/null` remains defence in depth, not the primary read
primitive.

---

## 28. Auto-maintenance / detached process boundary

Canonical operations pin:

```text
gc.auto=0
gc.autoDetach=false
maintenance.auto=false
gc.writeCommitGraph=false
fetch.writeCommitGraph=false
core.commitGraph=false
```

The goal is to prevent canonical read operations from spawning detached maintenance
that leaves the provider-created process group.

QA must use a gc-eligible fixture and prove:

```text
no .git mutation
no detached maintenance survivor
```

The runtime does not claim an OS sandbox capable of reaping a program that deliberately
starts a separate session.

---

## 29. Invocation-wide deadline

All child operations in one `invoke` share one absolute deadline.

Example `repository.read`:

```text
invocation start
↓
git --version
↓
resolve commit
↓
ls-tree path
↓
cat-file blob
↓
decode/validate/normalize
↓
return
```

No step resets timeout.

Before each spawn:

```text
final relevant identity recheck
→ synchronous remaining-deadline calculation
→ immediate spawn
```

If remaining time is exhausted:

```text
FAIL / TIMEOUT
no new process
```

---

## 30. Process-group cleanup

On provider-induced timeout/output overflow:

1. mark termination reason;
2. stop accepting output;
3. send `SIGTERM` to the provider-created process group;
4. keep cleanup lifecycle alive even if the leader closes;
5. wait `termination_grace_ms`;
6. if group remains, send `SIGKILL`;
7. bounded poll until gone or cleanup budget exhausted;
8. only then return normalized failure.

No successful result is truncated.

A later legitimate invocation must still work after a timeout/overflow fixture.

---

## 31. Repository concurrency semantics

S14D v1 performs no write and acquires no repository write lock.

A concurrent external Git process may change:

```text
HEAD
refs
index
working tree
```

between observations.

The contract is point-in-time observation, not transaction isolation.

S14D does not:

- wait for `index.lock`;
- delete `index.lock`;
- repair repository locks;
- retry until a stable snapshot appears.

S13H remains responsible for interpreting `observed_at` and repository fingerprints in
its planning logic.

---

## 32. Failure mapping

### Input/schema failure

```text
FAIL
code: INVALID_INPUT
retryable: false
```

### Protected content path / recognized secret output

```text
BLOCKED
```

### Missing commit/path/unborn HEAD

```text
FAIL
code: NOT_FOUND
```

### Unsupported provider/repository runtime

Examples:

```text
Git below 2.45
Git 3.x
bare/linked/sparse/alternate repository
executable identity drift
root/.git identity drift
```

Result:

```text
FAIL
code: UNAVAILABLE
```

### Permission

```text
FAIL
code: PERMISSION_DENIED
```

### Timeout

```text
FAIL
code: TIMEOUT
retryable: true
```

Message may say bounded process-group cleanup was attempted.

It must not guarantee rollback/extinction.

### Overflow / malformed Git output / bounded process failure / status bound

```text
FAIL
code: EXECUTION_FAILED
```

### Unexpected internal provider failure

```text
FAIL
code: INTERNAL_ERROR
```

Safe text only.

---

## 33. Descriptor privacy

`list_capabilities()` descriptors do not reveal:

- repository root;
- repository IDs configured on host, except the capability output may later identify
  the bound logical repository when invoked;
- Git executable;
- Git version;
- argv templates;
- env;
- refs;
- branches;
- remotes;
- provider ID;
- credential mechanism.

Descriptor schemas remain static across host configuration.

---

## 34. Restricted provider

S14D must prove both gates.

### Capability denied

If `repository.status` or `repository.read` is not in the allowed capability set:

```text
BLOCKED before WorkspaceGitCapabilityProvider.invoke()
```

No Git version probe.
No process spawn.

### `NONE` denied

If `NONE` is not in allowed side effects:

```text
BLOCKED before WorkspaceGitCapabilityProvider.invoke()
```

No process spawn.

---

## 35. Registry composition

The actual S14A registry is used.

No S14D condition, import or special case is added under:

```text
src/providers/capability/registry/**
```

Real acceptance path:

```text
WorkspaceGitCapabilityProvider
→ CapabilityRegistryProvider
→ RestrictedCapabilityProvider
→ runAgent
```

Registry result validation applies to actual legal-max S14D results.

---

## 36. AgentDefinition provider swap

Counterfactual test:

```text
AgentDefinition bytes D
permission policy P
semantic input I
capability repository.read

configuration A:
bound local repo/provider A

configuration B:
bound local repo/provider B
```

Requirements:

```text
JSON.stringify(D_A) === JSON.stringify(D_B)
P_A bytes === P_B bytes
I_A semantic bytes === I_B semantic bytes
observed content differs because repository implementation/root differs
```

No Git/provider/root/transport field appears in `AgentDefinition`.

Future remote backers may use a separate registry configuration. Current divergent
descriptors are not co-registered.

---

## 37. Real fixture policy

All Git QA uses disposable temp repositories outside the Brain worktree.

Allowed fixture setup may use host Git directly from test harness to create ground
truth:

```text
git init
git add
git commit
git branch
git checkout/switch
git init --bare for non-network local fixture setup when needed
```

Fixture setup is not the production provider.

Forbidden:

- mutating Brain repo;
- writing real `origin`;
- credential/network dependency;
- destructive commands against Brain;
- leaving temp fixtures/processes behind.

Mock-only verification is insufficient.

---

## 38. Required adversarial fixture families

Part B must include real or strongly grounded fixtures for:

1. plain unsafe status index-refresh detector;
2. canonical no-optional-lock status non-mutation;
3. gc-eligible repo with no auto-maintenance write/survivor;
4. host `GIT_DIR`/`GIT_EXEC_PATH` environment sentinel isolation;
5. hostile `.git/config` aliases/pager/fsmonitor/credential helper;
6. hostile hooks sentinel;
7. protected committed `.env`/key path;
8. symlink blob;
9. gitlink/submodule entry;
10. binary/invalid UTF-8 blob;
11. recognizable secret committed content;
12. huge blob/output overflow;
13. status >1000 paths;
14. missing/unborn commit/path;
15. detached HEAD;
16. bare repo;
17. linked worktree/gitfile;
18. sparse checkout;
19. object alternates;
20. executable/root/.git identity drift;
21. timeout/process-group cleanup;
22. registry/restricted/runAgent;
23. provider/root swap AgentDefinition byte identity;
24. second divergent co-registered provider collision as an existing-registry
    behavior check;
25. protected-boundary/no-dependency/future-phase audit.

---

## 39. Version-floor test teeth

The version gate must be non-vacuous.

Tests must prove:

- a supported Git version proceeds;
- an unparseable version fails;
- version below 2.45.0 fails before repository-facing operation;
- version 3.x fails before repository-facing operation;
- version failure does not fall back to another `git` on PATH.

The production implementation may use a fixture executable that emits controlled
`git --version` text for these specific version-gate tests, while real canonical
repository exercises use the actual supported Git binary.

---

## 40. Protected-path test teeth

A naive implementation that directly performs:

```text
git show HEAD:.env
```

must be rejected by canonical tests.

Equivalent tests cover:

```text
.env
.env.production
id_rsa
id_ed25519
credentials.json
deploy.pem
private.key
certificate.p12
```

`.env.example` remains readable if its content itself does not trigger the finite secret
recognizer.

---

## 41. Network-absence test teeth

Network absence is not proved solely by pointing `origin` at an unreachable URL.

The primary proof is structural:

- operation table allowlist audited;
- deny-set absent;
- no input carries remote/URL;
- no submodule recursion;
- protocol ext/file disabled;
- no credential path.

A supporting real fixture may configure a hostile/unreachable remote and prove a
canonical status/read invocation never touches it.

No real internet call is needed.

---

## 42. Part B expected file scope

Preferred additive implementation:

```text
src/providers/capability/git/
  types.ts
  process.ts
  workspaceGitCapabilityProvider.ts
  [small provider-private helpers if necessary]

tests/git-capability/
  gitCapability.test.ts
  registryCompatibility.test.ts
  regressions.test.ts
  unsafeCounters.test.ts
  cases.ts
  fixtures.ts
  helpers.ts
  audit.ts
  repoFixtures.ts
  processExercises.ts
  gitDirManifest.ts

brain-bootstrap/reports/S14D-git-capability-verification.md
```

No dependency.

No existing protected production/test file change.

If repository convention demands a mechanical export, stop and surface the exact need
before editing any protected semantic surface.

---

## 43. Hard phase boundary

Part B must not:

- change Core;
- change AgentDefinition;
- change RestrictedCapabilityProvider;
- change S14A registry;
- change S14B filesystem;
- change S14C shell;
- change S13H planning semantics;
- modify prior tests to make S14D pass;
- change package manifests;
- update continuity state before phase closure;
- implement S14E/F/G/H/I;
- add GitHub/MCP/OAuth/network behavior.

---

## 44. Part A inventory lock

Canonical S14D inventory counts:

```text
S14D-HI-001..040 = 40
UC01..UC12 = 12
FX-POS-001..014 = 14
FX-NEG-001..042 = 42
```

The quality contract defines the exact intent of each ID.

Part B may add extra regression tests but may not silently change the canonical
inventory.

---

## 45. Verification sequence

At minimum Part B verification must include:

```text
remote/baseline truth
Part A byte identity
Node 24 / Linux-WSL
supported real Git runtime
npm ci
typecheck
S14A regression
S14B regression
S14C regression
S13H regression
S14D focused tests
14/14 positives
42/42 negatives
40/40 hard invariants
UC01..UC12 legitimate-zero + fireable
real disposable repo exercises
whole-.git non-mutation
gc-eligible no-maintenance-survivor
timeout/overflow cleanup
Registry
Restricted
runAgent
provider swap
legal-max registry envelope
protected boundaries
no dependencies
no S14E+
full pre-build suite
dist absent
real build
full post-build suite
git diff --check
```

A builder PASS is not independent verification.

---

## 46. Independent verification

S14D requires a fresh verifier that is:

```text
non-authoring
non-builder
non-fork
read-only
```

It verifies the exact committed remote candidate.

It must independently reproduce critical real Git/process/security behavior, not only
re-run builder-owned assertions.

It posts one standalone relay and stops.

Separate ChatGPT control-plane acceptance is required before integration/phase closure.

---

## 47. Phase acceptance

On successful independent verification + separate control-plane acceptance:

```text
S14D = PHASE PASS / eligible for factual closure
S14  = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14E = NOT_AUTHORIZED
```

After bounded phase closure:

```text
S14D = VERIFIED PASS / PHASE CLOSED
S14  = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
```

S14E requires its own later authoring gate.

---

## 48. Final non-goals / residuals

S14D v1 does not claim:

- complete secret detection;
- OS sandboxing;
- universal hostile-Git containment;
- atomic executable invocation;
- transaction isolation from concurrent external Git;
- support for every Git repository shape;
- remote Git;
- Git mutation;
- binary Git object API;
- rollback.

The v1 contract is intentionally narrow:

```text
one explicit local standard worktree
two provider-neutral read-only capabilities
fixed Git operations
fixed safety environment/config
bounded real process execution
fail closed on unsupported state
```
