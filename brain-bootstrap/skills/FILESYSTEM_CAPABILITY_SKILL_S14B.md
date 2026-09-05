# FILESYSTEM_CAPABILITY_SKILL_S14B

## Identity

```yaml
parent_step: S14
phase: S14B
name: filesystem
version: 1.0.0
classification: RUNTIME_INFRASTRUCTURE
depth: DEEP
status: AUTHORING_READY
honor_invariant: HI-054_NOT_AWARDED
```

## Purpose

S14B gives Brain a real, bounded filesystem capability without exposing a host
filesystem, shell, git implementation, credential store, or provider-specific
identity to `AgentDefinition`.

Canonical composition:

```text
AgentDefinition
   │ stable capability IDs
   ▼
RestrictedCapabilityProvider
   ▼
CapabilityRegistryProvider
   ▼
WorkspaceFilesystemCapabilityProvider
   ▼
explicit workspace root + explicit access policy
```

The provider implements the existing `CapabilityProvider` contract.

## Stable capabilities

S14B v1 exposes exactly:

```text
filesystem.read
filesystem.list
filesystem.write
```

No vendor, OS, transport, drive letter, WSL path, MCP server, or concrete
implementation name appears in those capability IDs.

### filesystem.read

Purpose: read one bounded UTF-8 regular file.

Side-effect class:

```text
NONE
```

Input:

```json
{"path":"src/example.ts"}
```

Output shape:

```json
{
  "path":"src/example.ts",
  "content":"...",
  "bytes":123,
  "sha256":"..."
}
```

Evidence refs use safe logical workspace identity only:

```text
workspace://src/example.ts
```

Never return the absolute host path.

### filesystem.list

Purpose: list one directory non-recursively, sorted deterministically.

Side-effect class:

```text
NONE
```

Input:

```json
{"path":"src"}
```

`"."` is the only representation of the workspace root.

Output shape:

```json
{
  "path":"src",
  "entries":[
    {"name":"a.ts","kind":"FILE"},
    {"name":"subdir","kind":"DIRECTORY"}
  ]
}
```

Allowed `kind` values:

```text
FILE
DIRECTORY
SYMLINK
OTHER
```

A listed symlink may be reported as metadata but MUST NOT be followed by
`filesystem.read` or `filesystem.write`.

### filesystem.write

Purpose: create or replace one bounded UTF-8 regular file under an explicitly
authorized writable prefix.

Side-effect class:

```text
LOCAL
```

Input for new file:

```json
{
  "path":"src/new.ts",
  "content":"...",
  "mode":"CREATE_NEW"
}
```

Input for replacement:

```json
{
  "path":"src/existing.ts",
  "content":"...",
  "mode":"OVERWRITE_EXISTING",
  "expected_sha256":"<sha256 previously returned by filesystem.read>"
}
```

Output:

```json
{
  "path":"src/example.ts",
  "bytes_written":123,
  "sha256":"...",
  "created":true
}
```

`OVERWRITE_EXISTING` requires optimistic concurrency using
`expected_sha256`. A mismatch fails closed and MUST NOT modify the target.

S14B v1 does not append, delete, rename, move, chmod, create directories,
create symlinks, create hardlinks, or write binary content.

## Provider configuration

The provider is created from explicit configuration similar to:

```ts
interface WorkspaceFilesystemConfig {
  workspace_root: string;
  read_allow_prefixes: string[];
  write_allow_prefixes: string[];
}
```

Exact TypeScript syntax may follow repository conventions.

Normative rules:

- `workspace_root` is explicit and absolute;
- provider creation canonicalizes it to one real workspace root;
- no `process.cwd()` fallback;
- no `process.env` root;
- no HOME/user-profile inference;
- no repository discovery;
- no git-root discovery;
- no drive guessing;
- no WSL/Windows translation magic;
- read prefixes are explicit;
- write prefixes are explicit;
- configuration is provider-layer only and not model-visible.

`write_allow_prefixes` may be empty.

## Logical path grammar

All capability inputs use a provider-neutral logical workspace path.

Rules:

- `/` is the only separator;
- `"."` is permitted only as the workspace root for `filesystem.list`;
- file paths must not be empty or `"."`;
- absolute paths are forbidden;
- Windows drive prefixes are forbidden;
- UNC paths are forbidden;
- backslashes are forbidden;
- NUL is forbidden;
- `.` and `..` path segments are forbidden;
- empty internal segments are forbidden;
- path length is bounded;
- segment length is bounded;
- normalization must not silently reinterpret a rejected path.

A rejected logical path never reaches a filesystem syscall targeting that path.

## Workspace containment

Provider creation resolves the configured workspace root explicitly.

For an existing target:

```text
logical path
→ policy validation
→ component/symlink checks
→ canonical host resolution
→ containment check against canonical workspace root
→ operation
```

For a write target:

```text
logical path
→ policy validation
→ existing-parent validation
→ parent canonicalization
→ containment check
→ target safety/precondition check
→ bounded temporary write
→ final precondition re-check
→ commit
```

No target may escape the configured root.

## Symlink policy

S14B v1 does not follow symlinks for read or write.

If any existing path component below the explicit workspace root is a symlink:

```text
BLOCKED
```

If the target itself is a symlink:

```text
BLOCKED
```

The provider may list a symlink as a directory entry but cannot traverse it.

## Hard-link mutation policy

An existing file with multiple hard links is not a safe overwrite target in
S14B v1.

`filesystem.write` must fail closed when the existing regular file has a link
count greater than one.

This avoids silently mutating an inode reachable outside the apparent workspace
path.

## Allow policy

Access requires both containment and explicit policy.

A path must fall under one configured `read_allow_prefix` for read/list and one
configured `write_allow_prefix` for write.

No implicit root-wide write permission exists.

A prefix of `"."` explicitly means the whole workspace.

## Mandatory protected-path floor

Even when an allow prefix would otherwise include them, S14B v1 must fail
closed for known credential/control-plane-sensitive locations.

At minimum protect:

```text
.git/**
.ssh/**
.gnupg/**
.aws/**
.azure/**
.kube/**
.env
.env.*
.npmrc
.pypirc
.netrc
*.pem
*.key
```

`.env.example` may be treated as ordinary text only if its actual content passes
the recognized-secret-content gate.

The provider may implement the floor with deterministic prefix/basename/suffix
checks; no new glob dependency is authorized.

## Recognized-secret-content gate

S14B must not return or persist recognizable credential material through the
model-visible filesystem contract.

Before returning file content or accepting write content, reject recognizable
patterns such as:

- Authorization/Proxy-Authorization bearer assignments;
- Cookie/Set-Cookie values;
- password/passphrase assignments;
- API-key assignments;
- private-key material;
- client-secret assignments;
- access/refresh/id/session token assignments;
- common token prefixes such as `sk-...` and `ghp_...`;
- credential/auth/connection reference assignments when they carry a value.

This is a bounded safety detector, not a claim that arbitrary opaque strings can
always be classified as secrets.

A match fails closed; do not redact and return a partial file.

## Bounded I/O

Canonical S14B v1 limits:

```yaml
max_path_chars: 4096
max_path_segments: 256
max_segment_utf8_bytes: 255
max_read_bytes: 1048576
max_write_bytes: 1048576
max_list_entries: 1000
max_allow_prefixes_per_mode: 64
max_evidence_refs: 8
max_safe_error_chars: 500
```

These are normative.

Do not silently truncate a read or directory listing.

Oversize operations fail closed.

## UTF-8 only

S14B v1 is a text capability.

`filesystem.read`:

- accepts only a regular file;
- reads bounded bytes;
- decodes UTF-8 strictly;
- invalid UTF-8 fails closed.

`filesystem.write` accepts a JavaScript string, encodes UTF-8, and enforces the
byte limit before mutation.

Binary file APIs are later work and are not authorized here.

## Write semantics

`CREATE_NEW`:

- parent must already exist and be safe;
- target must not already exist;
- no clobber;
- no implicit parent creation.

`OVERWRITE_EXISTING`:

- target must be an existing regular non-symlink file;
- target must not have multiple hard links;
- `expected_sha256` is mandatory;
- current content hash must match immediately before commit;
- mismatch fails closed with no target mutation.

The implementation must prevent partial target content on ordinary write
failure. A bounded temporary file in the same safe parent plus an explicit
commit step is the canonical strategy.

Temporary artifacts must be cleaned on failure.

The implementation must never report TIMEOUT after a successful mutation if the
target is already committed. Timeout handling around write must have an explicit
pre-commit boundary.

## Timeout semantics

The request `timeout_ms` is authoritative.

Read/list:

- use a bounded deadline;
- timeout returns normalized `TIMEOUT`;
- do not leak raw OS/path error details.

Write:

- if deadline expires before commit, abort and leave the target unchanged;
- once the irreversible commit step begins, await the actual commit outcome and
  report the true final state rather than returning a misleading timeout.

No strong general-purpose OS cancellation guarantee is claimed.

## Failure normalization

Use existing `ToolInvocationResult`.

Recommended mapping:

```text
invalid input/path/size/encoding → FAIL INVALID_INPUT
not found                       → FAIL NOT_FOUND
OS permission failure           → FAIL PERMISSION_DENIED
timeout                          → FAIL TIMEOUT
other bounded fs failure         → FAIL EXECUTION_FAILED
policy/traversal/symlink/
protected path/hash precondition → BLOCKED
```

Messages are safe and bounded.

Never echo:

- absolute workspace root;
- rejected untrusted raw path when it may contain secret material;
- raw OS stack;
- raw exception object;
- credential content.

## Evidence

Safe evidence refs:

```text
workspace://<logical-path>
```

No:

```text
file:///absolute/path
C:\...
/home/...
/mnt/...
```

Evidence count remains bounded by the canonical limit.

## Real execution requirement

Unlike S14A, S14B MUST prove real filesystem behavior.

Canonical tests use a disposable temporary workspace created specifically for
the test run.

Tests must prove actual:

- directory listing;
- file read;
- file creation;
- file replacement;
- hash precondition;
- symlink escape rejection;
- size bounds;
- cleanup.

Do not satisfy the phase with an in-memory filesystem fake only.

The test sandbox must be outside the repository working tree and cleaned after
the run.

## Registry and permission integration

S14B must prove the real filesystem provider works through:

```text
WorkspaceFilesystemCapabilityProvider
→ CapabilityRegistryProvider
→ RestrictedCapabilityProvider
→ runAgent()
```

At minimum:

- read/list remain `NONE`;
- write remains `LOCAL`;
- capability allowlist denial blocks before mutation;
- side-effect denial blocks write before mutation;
- no registry special case is added;
- no Core change is needed;
- no AgentDefinition provider/vendor field is added.

## Protected boundaries

S14B must preserve byte identity of:

- all three top-level S14 Part A artifacts;
- S14A production registry files;
- Core agent contracts;
- `RestrictedCapabilityProvider`;
- AgentDefinition;
- S13G protected declarations;
- S13H protected repository/git decision surface;
- package.json;
- package-lock.json.

If S14B appears to require changing those semantics:

```text
CHATGPT_AUTHORING_REQUIRED
```

Do not make the change locally.

## Forbidden scope

S14B does not authorize:

```text
filesystem.delete
filesystem.rename
filesystem.move
filesystem.mkdir
filesystem.chmod
filesystem.watch
binary filesystem APIs
shell execution
git execution
GitHub API
documentation/search network provider
browser
PostgreSQL
MCP
OAuth
credential storage
S15+
```

Node built-in filesystem APIs used only by the S14B provider and its isolated
tests are authorized.

## S14B phase PASS

S14B PASS means:

- explicit workspace-scoped real filesystem provider exists;
- three stable capabilities work through existing registry/permissions;
- no host absolute path leaks;
- no traversal/symlink escape;
- no implicit provider/root selection;
- write is explicit, bounded and optimistic-concurrency protected;
- protected credential paths and recognizable secret content fail closed;
- real disposable filesystem exercise passes;
- Core/AgentDefinition/registry/dependencies remain unchanged;
- no S14C+ pull-forward.

After accepted S14B verification:

```text
S14B = PHASE PASS
S14 = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14C = NOT_AUTHORIZED
```
