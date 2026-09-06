# BRAIN — Shell Capability Contract S14C

## 1. Authority

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

This contract extends S14 for the bounded shell phase only.

It does not rewrite S14A or S14B.

## 2. Preconditions

S14C implementation requires:

```text
S14A = VERIFIED PASS / PHASE CLOSED
S14B = VERIFIED PASS / PHASE CLOSED
S14 = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
main = a89deb76968684bf8d4c94f5e6e17986d2a9d517
```

Repository/runtime reality overrides stale local continuity state.

## 3. Architecture

Canonical dependency direction:

```text
Agent Runtime
      ↓
RestrictedCapabilityProvider
      ↓
CapabilityRegistryProvider
      ↓
WorkspaceShellCapabilityProvider
      ↓
trusted explicit profile policy
      ↓
Node child_process.spawn(shell:false)
```

No reverse import into Core.

## 4. Existing contracts remain sufficient

S14C uses unchanged:

```text
CapabilityProvider
ToolDescriptor
ToolInvocationRequest
ToolInvocationResult
ToolSideEffectClass
RestrictedCapabilityProvider
AgentDefinition
CapabilityRegistryProvider
WorkspaceFilesystemCapabilityProvider
```

No new Core interface is authorized.

The filesystem provider is not used as an implicit sandbox for shell execution.

## 5. Stable public capability

Exactly:

```text
shell.execute
```

Descriptor:

```text
side_effects = LOCAL
```

No provider/vendor/executable identity appears in the capability ID.

## 6. S14C v1 is not an arbitrary terminal

The canonical shell capability is a bounded command-profile executor.

Untrusted/model input may choose only:

```json
{
  "profile_id": "qa.example",
  "cwd": "."
}
```

The model cannot choose:

```text
executable
command string
argv
environment
stdin
shell parser
provider identity
host path
```

This is a normative security boundary.

## 7. Trusted command profiles

Provider configuration is explicit host-side policy equivalent to:

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

The configuration is trusted administrative input, not model input.

Profile configuration must be fully validated before the provider becomes
invokable.

## 8. Trusted-profile limitation

S14C v1 does not inspect arbitrary executable semantics and prove they are
network-free, filesystem-safe or non-malicious.

Therefore the contract is:

```text
untrusted model
→ cannot escape the configured profiles

trusted profile administrator
→ responsible for configuring LOCAL_ONLY commands
```

Canonical S14C candidate/tests must not intentionally configure profiles whose
purpose is:

```text
git
GitHub/API
web/docs search
browser
PostgreSQL
MCP
OAuth
credential handling
S15+
```

No OS-level network sandbox is claimed.

## 9. Public descriptor stability

The `shell.execute` ToolDescriptor must not enumerate:

- configured profile IDs;
- executable paths;
- fixed argv;
- env values.

The public input schema stays generic:

```text
profile_id: bounded string
cwd: bounded logical path
```

This allows profile/executable/provider replacement without changing
AgentDefinition or the public capability schema.

## 10. Profile IDs

Canonical profile ID grammar:

```text
^[a-z0-9][a-z0-9._-]*$
```

Maximum length:

```text
160
```

IDs are unique.

Unknown IDs are not guessed or resolved by executable discovery.

Unknown profile:

```text
BLOCKED
NO PROCESS SPAWN
```

## 11. Explicit workspace root

`workspace_root` is explicit provider configuration.

Forbidden root inference:

```text
process.cwd()
process.env
HOME
USERPROFILE
git root
filesystem scanning
drive probing
WSL path conversion
fixture ID
```

Canonicalize the root before invocations are accepted.

## 12. Cwd logical path model

`cwd` is a logical workspace-relative `/` path.

`.` is the workspace-root token.

Reject before child spawn:

- absolute POSIX;
- drive-prefixed;
- UNC;
- backslash;
- NUL;
- dot-dot;
- internal dot segment;
- empty internal segment;
- overlong path;
- too many segments;
- overlong segment.

The selected profile must explicitly allow the cwd prefix.

No implicit root-wide scope exists.

## 13. Cwd containment

Existing cwd must be:

- directory;
- canonicalized under `workspace_root`;
- symlink-free below root for the selected logical path;
- explicitly profile-allowed;
- not protected credential/control cwd.

String prefix alone is not proof.

Observed cwd topology drift before spawn fails closed.

## 14. Protected cwd floor

At minimum block cwd under:

```text
.git/**
.ssh/**
.gnupg/**
.aws/**
.azure/**
.kube/**
```

and equivalent mandatory credential/control roots already established for the
S14 filesystem phase.

Profile allow rules cannot override the floor.

## 15. Executable validation

Each profile's executable is:

- explicit;
- absolute;
- bounded;
- canonicalized through host resolution;
- a regular file;
- executable by the current process.

Provider creation records a canonical executable identity.

Immediately before spawn, the identity is rechecked.

Observed replacement fails closed.

## 16. Executable final-window residual

Node's authorized S14C path does not provide atomic `fexecve` semantics.

S14C does not claim that a non-cooperating host actor cannot replace an
executable after the final identity check and before/during the kernel exec
window.

The provider minimizes that window and documents it.

It must not hide the residual behind a false "race-free executable" claim.

## 17. Fixed argv

`argv` belongs only to trusted profile configuration.

The model cannot supply dynamic args.

Canonical limits apply to:

- count;
- per-arg UTF-8 bytes;
- aggregate argv UTF-8 bytes.

NUL is forbidden.

No command string is composed.

## 18. No shell parser

Execution must use Node process-spawn semantics equivalent to:

```ts
spawn(canonicalExecutable, fixedArgv, {
  shell: false,
  ...
});
```

No `shell:true`.

No model string is concatenated into a command parser.

Metacharacters remain literal argv from the provider's perspective.

## 19. Environment

The child process environment is explicitly materialized from the selected
trusted profile.

Do not use an implicit:

```ts
env: process.env
```

and do not merge arbitrary host environment values.

A deliberately configured safe `PATH` is allowed because the profile is trusted,
but it is never model input.

Environment names/values are bounded and NUL-free.

## 20. Dangerous environment floor

Reject credential-bearing environment names and runtime injection names.

Mandatory runtime-injection deny floor includes:

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

Recognizable credential-bearing names such as token/password/secret/cookie/auth
references are also forbidden.

## 21. Stdio

S14C is non-interactive:

```text
stdin  = ignore/closed
stdout = pipe
stderr = pipe
TTY    = none
```

No PTY.

No interactive session capability.

## 22. Process completion semantics

If the process is successfully spawned and terminates naturally, S14C reports a
successful execution observation.

Program-level nonzero exit is data, not a provider crash.

Example:

```text
exit 0 → SUCCESS output.exit_code = 0
exit 3 → SUCCESS output.exit_code = 3
SIGTERM from external actor → SUCCESS output.signal = SIGTERM
```

A timeout or provider-induced termination is not reported as normal SUCCESS.

## 23. Output bounds

Raw byte limits:

```text
stdout <= 524288
stderr <= 524288
combined <= 1048576
```

No successful truncation.

Output bound overflow:

```text
terminate process group
bounded cleanup
FAIL / EXECUTION_FAILED
```

These bounds are chosen to remain compatible with the accepted registry
`ToolInvocationResult` maximum of 8388608 canonical JSON characters even under
worst-case JSON escaping.

## 24. UTF-8

stdout/stderr are captured as bytes.

Only after bounded capture may they be decoded.

Strict/fatal UTF-8 is required.

Invalid UTF-8:

```text
FAIL
NO RAW BYTES RETURNED
```

No binary shell-output capability is introduced.

## 25. Secret-output floor

Recognizable secret material in stdout/stderr cannot be returned.

On match:

```text
FAIL CLOSED
NO SECRET ECHO IN ERROR
```

Do not "redact and otherwise return" secret-bearing process output as a passing
canonical fixture.

## 26. Provider-local path normalization

Before model visibility:

```text
canonical workspace root → workspace://
canonical executable realpath → <executable>
```

This prevents the provider's own host paths from leaking.

This is not a universal arbitrary-host-path classifier.

The result/report must describe the bounded guarantee accurately.

## 27. Evidence

Canonical evidence is logical and bounded, e.g.:

```text
shell://qa.typecheck@workspace/.
```

Evidence cannot contain:

- executable realpath;
- workspace root;
- PID;
- argv;
- env;
- stdout/stderr;
- secrets.

Maximum evidence refs is defined in the quality contract.

## 28. Timeout

Effective timeout:

```text
min(request.timeout_ms, profile.max_timeout_ms)
```

A timeout must terminate/clean the provider-created process group before
returning as far as the canonical POSIX fixture semantics permit.

Return:

```text
FAIL / TIMEOUT
```

## 29. Timeout is not rollback

A shell child may have already performed local side effects before timing out.

S14C must not claim:

```text
TIMEOUT means no filesystem/local mutation happened
```

There is no transaction/rollback layer.

This is why the capability remains `LOCAL`.

## 30. POSIX process-group reference semantics

The canonical reference implementation and gate target Linux/WSL Node 24.

The provider creates one process group for the launched profile execution.

Timeout/output-overflow cleanup addresses that group.

Canonical tests must prove a parent+ordinary-grandchild fixture is cleaned.

A deliberately daemonizing program that starts a new session/process group is
outside the accepted profile threat model.

No container/sandbox guarantee is implied.

## 31. Unsupported platforms

The stable capability is provider-neutral.

The canonical S14C provider may fail safely/UNAVAILABLE when the host cannot
satisfy required Linux/WSL process semantics.

A later Windows-specific provider may implement the same `shell.execute`
contract without changing AgentDefinition.

## 32. Final pre-spawn sequence

Minimize the irreducible host-race window:

```text
final cwd containment check
→ final executable identity check
→ synchronous deadline check
→ immediate spawn()
```

No unrelated await/network/logging/model call is permitted in that final gap.

Observed drift before spawn fails closed.

Host mutation inside the final kernel window is an explicit residual.

## 33. Failure normalization

Use existing Brain result types.

Canonical mapping:

```text
invalid schema/path/profile configuration shape
→ FAIL INVALID_INPUT

missing cwd
→ FAIL NOT_FOUND

profile not registered
→ BLOCKED

cwd outside policy / protected / symlink
→ BLOCKED

OS permission
→ FAIL PERMISSION_DENIED

timeout
→ FAIL TIMEOUT

validated executable disappears/unavailable
→ FAIL UNAVAILABLE

bounded spawn/output/cleanup error
→ FAIL EXECUTION_FAILED
```

Errors are safe, bounded and secret/path sanitized.

## 34. Permission composition

`shell.execute` is `LOCAL`.

The shell provider does not self-authorize.

Required:

```text
CapabilityRegistryProvider
        ↓
RestrictedCapabilityProvider
        ↓
runAgent
```

Capability denial and LOCAL side-effect denial both prevent spawn.

## 35. Registry composition

The accepted registry requires no S14C special case.

The provider registers through the existing S14A/S14B accepted registry.

All legal S14C maximum results must fit the current registry result envelope.

If a real incompatibility is found:

```text
CHATGPT_AUTHORING_REQUIRED
```

not silent truncation or registry bypass.

## 36. Provider swap

Required counterfactual:

```text
same AgentDefinition
same shell.execute
same profile_id
same logical cwd

provider/config A → executable A
provider/config B → executable B

AgentDefinition bytes unchanged
```

This is part of the S14 global objective.

## 37. Real process test

Mock-only verification is invalid.

Use real child processes against disposable fixtures outside the repository
worktree.

The repository checkout must never be the shell fixture cwd.

## 38. Canonical QA adversarial floor

Real tests must cover at least:

- zero exit;
- nonzero exit;
- literal metacharacter argv;
- allowed nested cwd;
- no inherited process.env sentinel;
- exact output bounds and overflow;
- invalid UTF-8;
- secret output;
- timeout process-group cleanup;
- output-overflow process-group cleanup;
- executable replacement observed before spawn;
- cwd symlink/traversal/protected path;
- permission denial preventing spawn;
- real registry;
- real RestrictedCapabilityProvider;
- real runAgent;
- provider swap.

## 39. Protected boundaries

S14C does not authorize semantic changes to:

```text
src/core/agent/**
src/providers/capability/registry/**
src/providers/capability/filesystem/**
tests/capability-registry/**
tests/filesystem-capability/**
package.json
package-lock.json
```

Nor to S13G/S13H protected surfaces or prior S14 canonical artifacts.

Preferred S14C implementation:

```text
src/providers/capability/shell/**
```

Preferred focused tests:

```text
tests/shell-capability/**
```

Verification report:

```text
brain-bootstrap/reports/S14C-shell-capability-verification.md
```

## 40. Forbidden scope

S14C must not implement:

```text
git provider/capability
GitHub connector/API
documentation/web search
browser
PostgreSQL
MCP
OAuth
credential storage
workflow runtime
S15+
```

Canonical command profiles used to prove S14C must be local deterministic
fixtures, not backdoors into later phases.

## 41. Builder gate

Builder must prove the exact quality-contract inventories.

Static scanning is not enough for:

- actual process spawn;
- no-shell parsing;
- env isolation;
- timeout/process-group cleanup;
- output overflow;
- permission denial;
- real registry/restricted/runAgent composition.

## 42. Independent verification

After a builder publishes an exact dedicated candidate:

```text
fresh root session
non-authoring
non-fork
read-only
exact remote candidate
```

The verifier must reproduce critical process, timeout, output, permission,
registry and provider-swap behavior independently.

It posts a standalone relay.

A separate later ChatGPT response accepts or rejects.

## 43. Phase closure

Accepted S14C result:

```text
S14C = VERIFIED PASS / PHASE PASS
S14 = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14D = NOT_AUTHORIZED
```

S14C cannot close S14 or award HI-054.
