# ADR — S14B Write Concurrency and Final-Syscall Threat Model

## Status

```yaml
decision: ACCEPTED_FOR_S14B
parent_step: S14
phase: S14B
source_audit_rejected_candidate: efff516b0bec42cef8acff3780fe9f0d70439ee8
baseline_before_clarification: 28acc89f00d62d5cdb626f3eee2e93ade69b0227
classification: RUNTIME_INFRASTRUCTURE
depth: DEEP
```

## Context

The original S14B contract states:

```text
If the target changes after the model read it:
BLOCKED
NO TARGET MUTATION
```

and:

```text
No target may escape the configured root.
```

The rejected builder candidate correctly performs repeated hash, inode,
symlink and containment checks before publication, but its final write path is:

```text
final precondition
→ final synchronous deadline check
→ fs.link(...) or fs.rename(...)
```

There is no compare-and-swap filesystem primitive in the authorized S14B Node
path API that atomically combines the final user-space hash/containment check
with replacement of an existing pathname.

Therefore two races must be distinguished instead of pretending they are the
same property.

## Decision 1 — S14B-cooperative writes are linearized

All `filesystem.write` calls performed by `WorkspaceFilesystemCapabilityProvider`
instances in the same Node process are inside the S14B v1 concurrency contract.

Writes to the same canonical target MUST be serialized across provider
instances.

The serialization identity must be provider-layer only and equivalent to:

```text
canonical workspace identity + logical target path
```

It must not enter AgentDefinition, ToolDescriptor or Core.

The lock MUST be acquired before the first overwrite/create precondition and
held through publication and temporary-artifact cleanup.

Required result for two concurrent `OVERWRITE_EXISTING` calls carrying the same
old `expected_sha256`:

```text
exactly one SUCCESS
exactly one BLOCKED
final bytes equal the successful writer
no temporary artifact remains
```

The losing call must observe the winner before it is allowed to pass its
precondition.

This guarantee applies across multiple filesystem-provider instances in the
same process when they point to the same canonical workspace/target.

## Decision 2 — observed external changes still fail closed

If a non-S14B actor changes/replaces the target or changes the validated parent
chain and that change is observable before the final pre-commit decision, the
provider MUST fail closed and MUST NOT publish its staged content.

The existing required protections remain:

- repeated target SHA-256 check;
- inode/link-count checks;
- symlink rejection;
- parent-chain containment re-check;
- staging cleanup;
- safe normalized result.

## Decision 3 — final kernel-syscall race is an explicit v1 residual

S14B v1 does NOT claim a linearizable compare-and-swap against a
non-cooperating external process that mutates the target pathname or directory
topology after the final validated check and before/during the publication
syscall.

Examples include an external process that, in that irreducible window:

- replaces the target after the final hash check;
- renames an already-open parent directory out of the workspace;
- changes mount/topology state outside S14B control.

This is an explicit environmental concurrency limitation, not a hidden PASS.

S14B itself exposes no directory rename/move/delete capability, so such topology
mutation cannot originate from an authorized S14B capability.

A stronger hostile-external-topology guarantee requires a later OS/sandbox
primitive with appropriate atomic semantics and is not invented inside S14B.

## Decision 4 — minimize the residual window

The builder MUST keep the final publication sequence bounded:

```text
final parent-chain check
→ final target precondition/hash check
→ synchronous deadline check
→ immediately invoke the publication syscall
```

No unrelated asynchronous work may be inserted between the final precondition
and invocation of `fs.link` / `fs.rename`.

The provider/report MUST NOT describe this as an atomic external CAS.

## Decision 5 — original wording is narrowed, not discarded

For S14B v1, the original statement:

```text
If the target changes after the model read it:
BLOCKED / NO TARGET MUTATION
```

is interpreted as:

```text
- guaranteed for serialized S14B-cooperative writers;
- guaranteed for external changes observed by the final pre-commit validation;
- not a claim of atomic CAS against a non-cooperating external mutation in the
  final kernel-publication window.
```

The original containment statement is interpreted similarly:

```text
- all validated resolution and every S14B-controlled topology stays contained;
- detected topology drift fails closed;
- hostile external topology mutation in the irreducible publication window is
  outside the S14B v1 atomicity guarantee and must be recorded as residual risk.
```

## Unchanged security boundaries

This ADR does NOT authorize weakening:

- logical-path validation;
- read/write allow prefixes;
- canonical root checks;
- symlink rejection;
- hard-link overwrite rejection;
- protected-path floor;
- recognized-secret-content rejection;
- UTF-8 and size limits;
- optimistic `expected_sha256` checks;
- safe errors/evidence;
- registry compatibility patch boundaries;
- Core / RestrictedCapabilityProvider / AgentDefinition;
- dependencies;
- S14C+ scope.
