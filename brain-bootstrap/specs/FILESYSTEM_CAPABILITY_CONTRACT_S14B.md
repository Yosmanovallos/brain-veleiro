# BRAIN — Filesystem Capability Contract S14B

## 1. Authority

```yaml
parent_step: S14
phase: S14B
name: filesystem
version: 1.0.0
classification: RUNTIME_INFRASTRUCTURE
depth: DEEP
status: AUTHORING_READY
baseline: 07778e20f12dfc381ccf79f9de5cb7e5317a270f
honor_invariant: HI-054_NOT_AWARDED
```

This contract extends the canonical S14 contract for the bounded filesystem
phase only.

It does not rewrite S14A.

## 2. Preconditions

S14B implementation requires:

```text
S14A = VERIFIED PASS / PHASE CLOSED
S14 = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
main = 07778e20f12dfc381ccf79f9de5cb7e5317a270f
```

Repository reality overrides stale continuity metadata.

## 3. Architecture

Canonical dependency direction:

```text
Agent Runtime
  ↓
RestrictedCapabilityProvider
  ↓
CapabilityRegistryProvider
  ↓
WorkspaceFilesystemCapabilityProvider
  ↓
explicit workspace policy
  ↓
Node filesystem primitives
```

No reverse import into Core is permitted.

## 4. Existing contracts remain sufficient

S14B uses unchanged:

```text
CapabilityProvider
ToolDescriptor
ToolInvocationRequest
ToolInvocationResult
RestrictedCapabilityProvider
AgentDefinition
CapabilityRegistryProvider
```

No new Core interface is authorized.

## 5. Stable public capability IDs

Exactly:

```text
filesystem.read
filesystem.list
filesystem.write
```

S14B does not expose OS/provider-specific IDs.

## 6. Explicit configuration

A filesystem provider instance is bound to one explicit canonical workspace
root and explicit read/write prefix policy.

No hidden root selection.

A factory may be asynchronous so the root can be canonicalized before the
provider becomes invokable.

## 7. Path model

Capability paths are logical workspace-relative `/` paths.

The model never receives or needs the host absolute root.

`"."` is only the root-listing token.

All ambiguous/absolute/traversal forms fail closed before target access.

## 8. Containment and symlinks

Path authorization is not string-prefix authorization alone.

Existing targets and parents are checked through canonical host resolution and
must remain under the explicit canonical workspace root.

Symlink traversal below the root is forbidden.

The provider does not claim that a string normalized path is safe merely
because it starts with the workspace-root characters.

## 9. Read policy

`filesystem.read`:

- explicit read allow prefix required;
- protected paths forbidden;
- regular file only;
- no symlink traversal;
- bounded bytes;
- strict UTF-8;
- recognizable credential content rejected;
- SHA-256 returned;
- no absolute host path returned.

## 10. List policy

`filesystem.list`:

- explicit read allow prefix required;
- protected paths forbidden;
- directory only;
- non-recursive;
- deterministic sort;
- bounded entry count;
- reports symlink kind without traversing;
- no absolute host path returned.

## 11. Write policy

`filesystem.write`:

- explicit write allow prefix required;
- protected paths forbidden;
- existing parent required;
- parent contained and symlink-safe;
- bounded UTF-8 content;
- recognizable credential content rejected;
- no parent creation;
- no append;
- no delete/rename/move API;
- no binary data.

Modes:

```text
CREATE_NEW
OVERWRITE_EXISTING
```

`CREATE_NEW` may not replace an existing path.

`OVERWRITE_EXISTING` requires a matching `expected_sha256`.

## 12. Optimistic concurrency

The hash used for overwrite authorization is the exact SHA-256 of the current
target bytes.

The provider must re-check immediately before commit.

If the target changes after the model read it:

```text
BLOCKED
NO TARGET MUTATION
```

This prevents silent lost updates.

## 13. Safe write commit

The target should not expose partially written content on an ordinary failed
write.

Canonical strategy:

```text
validate
→ safe same-parent temporary file
→ bounded write
→ precondition re-check
→ commit
→ cleanup temp
```

Equivalent implementations are acceptable only if they prove the same
observable safety properties.

No unsafe create-new clobber race is acceptable.

## 14. Protected path floor

The mandatory deny floor from the Skill is normative.

Allow rules cannot override it.

This protects repository metadata and common credential stores from
model-visible filesystem operations.

## 15. Secret-content floor

Recognizable secret material cannot be returned or persisted through this
phase's model-visible text contract.

This is defense in depth, not a universal secret classifier.

The implementation must not claim arbitrary unknown opaque values are proven
non-secret.

## 16. Errors

The provider maps errors to existing Brain result semantics and emits safe
messages.

Raw OS exception text, stacks and host absolute paths are not model-visible.

## 17. Timeouts

The provider respects the invocation timeout contract without lying about final
mutation state.

A timeout before write commit must leave the target unchanged.

After a write commit begins, the provider reports the actual commit outcome
instead of a fictitious timeout.

## 18. Permission composition

`filesystem.read` and `filesystem.list` are `NONE`.

`filesystem.write` is `LOCAL`.

`RestrictedCapabilityProvider` remains authoritative.

No filesystem provider-local code may bypass its capability/side-effect
decision.

## 19. Registry composition

The provider registers normally in S14A's registry.

S14B does not modify registry semantics.

Provider-specific root/policy data stay outside `AgentDefinition`.

## 20. Real filesystem test

A passing S14B candidate must exercise real Node filesystem operations against a
new disposable test root outside the repository working tree.

The verifier must independently prove the test root is disposable and cleaned.

A mock-only pass is invalid.

## 21. Repository protection

The builder and tests may read repository source for QA but canonical
filesystem capability mutations must target only the disposable sandbox during
the S14B gate.

No canonical test may mutate the repository working tree.

## 22. Protected byte identities

Builder and verifier must compare candidate against the S14A phase-closure
baseline and prove no semantic changes to:

```text
brain-bootstrap/skills/CAPABILITY_REGISTRY_TOOLS_MCP_SKILL_S14.md
brain-bootstrap/quality-contracts/S14_CAPABILITY_REGISTRY_TOOLS_MCP_DEEP.yaml
brain-bootstrap/specs/CAPABILITY_REGISTRY_TOOLS_MCP_CONTRACT_S14.md

src/providers/capability/registry/**
src/core/agent/types.ts
src/core/agent/restrictedCapabilityProvider.ts
src/core/agent/definition.ts

S13G protected files
S13H protected files
package.json
package-lock.json
```

## 23. Expected implementation scope

Preferred production location:

```text
src/providers/capability/filesystem/**
```

Preferred focused tests:

```text
tests/filesystem-capability/**
```

Verification report:

```text
brain-bootstrap/reports/S14B-filesystem-capability-verification.md
```

Mechanical exports may be added only if existing repository conventions require
them.

## 24. Forbidden implementation

S14B must not implement:

```text
filesystem.mkdir
filesystem.delete
filesystem.rename
filesystem.move
filesystem.chmod
filesystem.watch
binary filesystem
shell
git process
GitHub API
network docs/search
browser
PostgreSQL
MCP
OAuth
credential storage
S15+
```

## 25. Builder gate

The builder must prove the exact canonical fixture sets, hard invariants and
unsafe counters in the quality contract.

Static scanning alone is not proof for runtime filesystem safety.

Traversal, symlink, hard-link, hash-precondition, secret-content and permission
cases must drive the real provider.

## 26. QA gate

Required:

```text
Node 24
Part A byte identity
S14A registry byte identity
Core/AgentDefinition byte identity
dependency byte identity
typecheck
focused tests
14/14 canonical positives
36/36 canonical negatives
36/36 hard invariants
UC01..UC12 legitimate zero + fireability
real disposable filesystem exercise
real registry composition
real RestrictedCapabilityProvider composition
real runAgent read path
full suite before build
repo-local dist absent
genuine build
full suite after build
git diff --check
exact candidate range audit
```

## 27. Independent verification

After the builder publishes a dedicated candidate branch:

```text
fresh root session
non-authoring
non-fork
read-only
exact remote candidate
```

The verifier must independently reproduce filesystem adversarial cases and QA.

It posts a standalone verifier relay.

Only a later separate ChatGPT control-plane response may accept the phase.

## 28. Phase closure

Accepted S14B result:

```text
S14B = VERIFIED PASS / PHASE PASS
S14 = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14C = NOT_AUTHORIZED
```

No S14 final honor award occurs at this phase.
