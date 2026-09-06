# SHELL_CAPABILITY_SKILL_S14C

## Identity

```yaml
parent_step: S14
phase: S14C
name: shell
version: 1.0.0
classification: RUNTIME_INFRASTRUCTURE
depth: DEEP
status: AUTHORING_READY
baseline: a89deb76968684bf8d4c94f5e6e17986d2a9d517
honor_invariant: HI-054_NOT_AWARDED
```

## Purpose

S14C adds one stable provider-neutral capability:

```text
shell.execute
```

The capability is a **bounded pre-authorized command-profile executor**, not an
arbitrary terminal.

The model requests a semantic profile and a logical workspace cwd. It does not
supply an executable, command string, argv, environment, stdin, shell
interpreter, provider identity, or host path.

Canonical composition:

```text
Agent Runtime
      ↓
RestrictedCapabilityProvider
      ↓
CapabilityRegistryProvider
      ↓
WorkspaceShellCapabilityProvider
      ↓
explicit trusted command profile
      ↓
Node child_process.spawn(..., shell:false)
```

Changing the concrete executable/provider/profile implementation must not require
an `AgentDefinition` edit.

## Threat model

### Untrusted/model-controlled

The model may control only:

```json
{
  "profile_id": "qa.example",
  "cwd": "."
}
```

Both values are validated.

### Trusted administrative/provider configuration

A command profile is explicit host-side configuration equivalent to:

```ts
interface WorkspaceShellCommandProfile {
  profile_id: string;
  executable: string;
  argv: string[];
  env: Record<string, string>;
  cwd_allow_prefixes: string[];
  max_timeout_ms: number;
  declared_effects: "LOCAL_ONLY";
}

interface WorkspaceShellConfig {
  workspace_root: string;
  profiles: WorkspaceShellCommandProfile[];
}
```

The model cannot create, mutate, or override profiles.

Profile IDs are semantic policy identifiers. They must not encode a provider
vendor or host path.

### What S14C v1 does NOT claim

S14C v1 does not claim to prove that an arbitrary trusted executable is pure.

It does not provide an OS-level network sandbox or a universal filesystem
sandbox around the child process.

Therefore canonical S14C profiles must be intentionally local-only and must not
be configured to pull forward:

```text
git operations
GitHub/API access
web/docs search
browser automation
PostgreSQL access
MCP
OAuth
credential acquisition/storage
S15+ work
```

A future stronger sandbox/process provider may replace this implementation
behind the same `shell.execute` capability without changing AgentDefinition.

## Public capability contract

Exactly one capability is exposed:

```text
shell.execute
side_effects = LOCAL
```

It is intentionally classified `LOCAL` even when a particular configured
profile is observational/read-only.

This conservative classification prevents the registry/provider from
downgrading permission requirements based on a selected profile.

## Public input

Exactly:

```json
{
  "profile_id": "qa.typecheck",
  "cwd": "."
}
```

No additional model-visible fields are accepted.

Forbidden model-controlled fields include:

```text
command
executable
argv
args
env
environment
stdin
shell
provider_id
timeout override
```

The invocation timeout comes from the existing `ToolInvocationRequest`.

## Public output

Successful process observation returns data equivalent to:

```json
{
  "profile_id": "qa.typecheck",
  "cwd": ".",
  "exit_code": 0,
  "signal": null,
  "stdout": "...",
  "stderr": "",
  "stdout_bytes": 3,
  "stderr_bytes": 0
}
```

A process that starts successfully and terminates naturally is a successful tool
observation even when its program exit code is non-zero.

Therefore:

```text
process exit 0      → ToolInvocationResult SUCCESS, exit_code = 0
process exit 2      → ToolInvocationResult SUCCESS, exit_code = 2
external signal     → ToolInvocationResult SUCCESS, signal = <safe signal>
```

Provider/security/launch/timeout/output-bound failures remain `FAIL` or
`BLOCKED`.

The tool reports execution truth; it does not reinterpret a program's own exit
status as a provider failure.

## Explicit root and cwd policy

`workspace_root` is explicit.

Forbidden hidden root selection:

```text
process.cwd()
process.env
HOME / USERPROFILE
git-root discovery
repository scanning
drive inference
WSL/Windows translation
fixture IDs
```

Model-visible `cwd` is a logical `/` workspace-relative path.

`.` means the workspace root.

It is allowed only when the selected trusted profile explicitly allows `.`.

Cwd path validation follows the same provider-neutral grammar principles already
proven by S14B:

- no absolute POSIX path;
- no Windows drive path;
- no UNC;
- no backslash;
- no NUL;
- no `.` internal segment;
- no `..`;
- no empty internal segment;
- bounded path/segment sizes.

An existing cwd must be:

- a directory;
- under the canonical explicit workspace root;
- covered by the selected profile's explicit cwd allow prefixes;
- not a protected credential/control path;
- free of symlink traversal below the workspace root.

String-prefix authorization alone is insufficient.

## Protected cwd floor

At minimum, cwd cannot target:

```text
.git/**
.ssh/**
.gnupg/**
.aws/**
.azure/**
.kube/**
```

or another path explicitly treated as credential/control-only by the canonical
S14B protected-path floor.

The shell provider does not reinterpret S14B's filesystem provider as a sandbox.
A child program can perform whatever its trusted fixed program does. The trusted
profile is therefore an important S14C v1 administrative boundary.

## Profile identity

`profile_id` must be a bounded safe identifier:

```text
^[a-z0-9][a-z0-9._-]*$
```

Maximum:

```text
160 characters
```

Profiles are unique by `profile_id`.

Unknown profile IDs fail closed.

The ToolDescriptor does not enumerate configured profile IDs, executable paths,
argv or environment values. This keeps the public descriptor stable across
provider/profile swaps.

Available profile IDs may be supplied to an agent through separately governed
task/application context; they are not encoded into `AgentDefinition`.

## Executable policy

Every profile has one explicit absolute executable path.

Before the provider becomes invokable:

```text
absolute configured executable
→ realpath/canonical target
→ regular file
→ executable permission/access
→ record canonical identity
```

Immediately before each spawn, the provider re-checks the executable's
canonical identity.

Observed replacement/drift fails closed.

Node does not expose a portable atomic `fexecve`-style primitive for this
provider path. S14C v1 therefore does not claim atomic protection against a
non-cooperating external actor replacing the executable after the final identity
check but before/during the kernel exec window. This residual must be documented
honestly.

The executable absolute path is provider-private and never model-visible.

## Fixed argv policy

Each profile contains a fixed bounded argv sequence.

The model cannot append, replace, interpolate or inject argv values.

Arguments:

- are UTF-8 strings;
- contain no NUL;
- are bounded individually and in aggregate.

The provider invokes Node `child_process.spawn()` using:

```text
shell: false
```

No command string is passed to a command parser.

Shell metacharacters inside a trusted fixed argument are literal argv bytes from
the provider's point of view; S14C does not concatenate user/model strings into
a shell command.

## Environment policy

Child environment is explicit profile configuration.

The provider must not inherit `process.env` implicitly.

An explicit `PATH` may exist if the trusted profile needs it, but it is provider
configuration, never model input.

Environment keys/values are bounded and NUL-free.

Recognizable credential-bearing environment names are forbidden.

Dangerous dynamic-loader/runtime-injection keys are forbidden, including at
minimum:

```text
LD_PRELOAD
LD_LIBRARY_PATH
DYLD_INSERT_LIBRARIES
DYLD_LIBRARY_PATH
NODE_OPTIONS
PYTHONPATH
PYTHONHOME
RUBYOPT
PERL5OPT
BASH_ENV
ENV
IFS
SHELLOPTS
```

The provider must not echo its environment configuration in result metadata.

## No interactive input

Canonical S14C is non-interactive.

```text
stdin = ignored/closed
stdout = pipe
stderr = pipe
TTY = none
```

The model cannot supply stdin.

Interactive terminal emulation is out of scope.

## Output limits

Canonical bounds:

```text
stdout max:   524288 bytes
stderr max:   524288 bytes
combined max: 1048576 bytes
```

These limits are intentionally compatible with the already-authorized S14
registry result envelope:

```text
ToolInvocationResult canonical JSON max = 8388608 characters
```

A legal maximum 1 MiB combined byte output remains transportable even under a
worst-case JSON escape expansion of approximately six characters per byte.

Output is accumulated as raw bounded bytes and decoded only as strict UTF-8.

Invalid UTF-8 fails closed.

No successful result silently truncates stdout or stderr.

If any output bound is exceeded:

```text
terminate provider-created process group
wait bounded cleanup
FAIL / EXECUTION_FAILED
```

Prior local side effects are not rolled back.

## Safe model-visible output

Recognizable secret material in stdout/stderr fails closed and is not returned.

Known provider-local path material is normalized before model visibility:

```text
exact canonical workspace root → workspace://
exact canonical executable path → <executable>
```

This is deterministic normalization, not a universal host-path classifier.

No evidence ref contains:

```text
file://
C:\
/home/<user>/...
/mnt/<drive>/...
workspace_root
executable realpath
environment values
stdout/stderr
secret material
```

## Evidence

Evidence is bounded and logical, for example:

```text
shell://qa.typecheck@workspace/.
```

It may contain:

- safe `profile_id`;
- logical cwd.

It must not contain the fixed executable, argv, env, child PID, output body,
secret material or host absolute path.

## Timeout semantics

Effective timeout is:

```text
min(ToolInvocationRequest.timeout_ms, profile.max_timeout_ms)
```

Both must be positive and the profile timeout is bounded by the S14C maximum.

On timeout:

1. stop accepting additional output;
2. signal the provider-created POSIX process group;
3. allow a short bounded termination grace;
4. escalate to a hard kill when required;
5. await bounded child close/cleanup;
6. return `FAIL / TIMEOUT`.

S14C is `LOCAL`.

Timeout does **not** claim transactional rollback of local side effects already
performed by the child before timeout.

The result must never claim that earlier child side effects were undone.

## Process-group cleanup

The canonical S14C reference implementation and verification target is Linux/WSL
under Node 24.

The provider creates an isolated POSIX process group for the launched command so
timeout/output-overflow termination can address the group, including ordinary
children that remain in that group.

Canonical tests must prove termination of a parent + grandchild fixture.

A deliberately daemonizing/malicious profile that creates a new session/process
group can escape a simple process-group kill. Such profiles are forbidden by the
trusted LOCAL_ONLY profile policy; S14C v1 does not claim an OS container or
anti-daemon sandbox.

Unsupported operating systems fail safely and may later be handled by another
provider behind the same `shell.execute` capability.

## Spawn-window residuals

The provider minimizes the final pre-spawn window:

```text
final cwd containment check
→ final executable identity check
→ synchronous deadline check
→ immediate spawn()
```

No unrelated asynchronous work is inserted in that final gap.

S14C v1 does not claim atomic defense against a non-cooperating host process
that changes executable/cwd topology in the irreducible final kernel spawn
window.

Observed drift before spawn must fail closed.

## Error normalization

Use the existing Brain `ToolInvocationResult`.

Canonical examples:

```text
invalid input/schema/path/config shape
→ FAIL / INVALID_INPUT

missing cwd at invocation
→ FAIL / NOT_FOUND

OS permission failure
→ FAIL / PERMISSION_DENIED

profile not authorized / cwd outside policy / symlink/protected cwd
→ BLOCKED

timeout
→ FAIL / TIMEOUT

executable unavailable after valid initialization
→ FAIL / UNAVAILABLE

bounded spawn/read/cleanup failure
→ FAIL / EXECUTION_FAILED
```

Raw OS exception text, stack traces, secret values, workspace root, executable
realpath and environment must not appear in model-visible errors.

## Registry and permission composition

Required runtime path:

```text
WorkspaceShellCapabilityProvider
        ↓
CapabilityRegistryProvider
        ↓
RestrictedCapabilityProvider
        ↓
runAgent()
```

There is no shell special case in the registry.

`RestrictedCapabilityProvider` remains authoritative:

```text
shell.execute not permitted
→ provider is not invoked

LOCAL not permitted
→ provider is not invoked
```

The shell provider may not bypass this composition.

## Provider swap criterion

The defining S14C counterfactual:

```text
same AgentDefinition bytes
same capability_id = shell.execute
same profile_id
same logical cwd

configuration A:
profile → executable/argv implementation A

configuration B:
profile → executable/argv implementation B

AgentDefinition unchanged
→ PASS
```

Provider-private executable/profile data does not enter `AgentDefinition`.

## Limits

Canonical limits are defined in the quality contract and are normative.

At exact valid boundaries, behavior succeeds where otherwise valid.

Maximum + 1 fails closed.

No silent truncation or fallback.

## Forbidden S14C implementation

S14C does not authorize:

```text
arbitrary model-provided command strings
model-provided executable
model-provided argv
model-provided environment
model-provided stdin
shell:true
TTY/PTY
interactive shell sessions
background-job API
daemon manager
git capability implementation
GitHub API
documentation/web search
browser automation
PostgreSQL
MCP
OAuth
credential store
new Core interface
AgentDefinition change
new package dependency
workflow runtime
S15+
```

## Real QA requirement

A passing S14C candidate must use real Node child processes and disposable test
workspaces outside the repository working tree.

Canonical tests must include:

- successful zero-exit command;
- natural nonzero exit;
- fixed-argv literal metacharacter case proving no shell parsing;
- nested allowed cwd;
- no inherited environment sentinel;
- output exact maximum and max+1;
- invalid UTF-8;
- secret-bearing output;
- timeout parent+grandchild cleanup;
- output-overflow process-group cleanup;
- executable identity drift detected before spawn;
- cwd symlink/traversal/protected-path cases;
- permission denial before spawn;
- registry path;
- RestrictedCapabilityProvider path;
- real `runAgent()` shell invocation;
- provider/profile swap with AgentDefinition byte identity;
- disposable fixture cleanup.

Mock-only passing evidence is invalid.

## Protected boundaries

S14C must preserve the accepted S14A/S14B implementation and contracts.

No semantic edits to:

```text
src/core/agent/**
src/providers/capability/registry/**
src/providers/capability/filesystem/**
tests/capability-registry/**
tests/filesystem-capability/**
package.json
package-lock.json
```

unless a later explicit ChatGPT Authoring Gate proves a real incompatibility.

The nine S14B canonical/erratum/clarification artifacts remain immutable.

## Phase acceptance

If S14C passes independently:

```text
S14C = VERIFIED PASS / PHASE PASS
S14 = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14D = NOT_AUTHORIZED
```

A separate control-plane response must accept the verifier relay before factual
phase integration/closure.

S14C cannot self-authorize S14D.
