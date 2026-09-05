# BRAIN — S14B Write Concurrency Clarification

## 1. Authority

```yaml
parent_step: S14
phase: S14B
status: AUTHORING_READY
source_audit_rejected_candidate: efff516b0bec42cef8acff3780fe9f0d70439ee8
baseline_before_clarification: 28acc89f00d62d5cdb626f3eee2e93ade69b0227
```

This document is a normative addendum to the S14B filesystem Part A and the
registry-result-envelope erratum.

## 2. Why this clarification exists

The source-audited candidate performs a final hash/inode precondition and then
publishes through `fs.link` or `fs.rename`.

That is sufficient to detect changes observed before the final precondition,
but it is not a single kernel compare-and-swap transaction with an arbitrary
external writer.

The contract is therefore split into guarantees the provider can honestly prove
and an explicitly named environmental residual.

## 3. Cooperative S14B concurrency guarantee

S14B MUST serialize writes to the same canonical target across all
`WorkspaceFilesystemCapabilityProvider` instances in the same Node process.

The lock identity is provider-layer only.

A correct key is equivalent to:

```text
workspace canonical identity + logical target path
```

The lock is acquired before the initial target precondition and remains held
through staging, final precondition, publication and cleanup.

No global workspace lock is required for different targets.

## 4. Concurrent overwrite acceptance

Given initial bytes with SHA `A`:

```text
writer 1: OVERWRITE_EXISTING expected A → content B
writer 2: OVERWRITE_EXISTING expected A → content C
```

when both run concurrently through S14B:

```text
one and only one writer = SUCCESS
other writer = BLOCKED
final file = successful writer's complete bytes
no temp file remains
```

Both writers returning SUCCESS is a contract failure.

## 5. External changes observed before publication

If an external actor changes the target before the final precondition can
complete, the provider blocks and leaves that external version intact.

If parent-chain containment/topology drift is observed before publication, the
provider blocks and does not publish staged content.

## 6. Final-syscall residual

S14B v1 does not claim that Node's path-based `fs.rename` / `fs.link` plus
user-space validation forms an atomic CAS with a hostile non-cooperating
external process.

A mutation beginning after the final validated check and racing the kernel
publication syscall is an explicit v1 residual.

Likewise, hostile external directory/mount topology mutation in the same final
window is not claimed to be atomically preventable by S14B v1.

This limitation MUST appear in the builder verification report and independent
verifier result.

It must NOT be hidden behind words such as:

```text
race-free against all processes
atomic compare-and-swap
absolute hostile-topology containment
```

unless a later authoring gate introduces a primitive that genuinely proves
those stronger properties.

## 7. Final publication sequence

The provider must minimize the residual window:

```text
final parent-chain check
→ final target precondition/hash check
→ synchronous timeout/deadline decision
→ invoke fs.link/fs.rename immediately
```

Do not perform unrelated awaits, network calls, model calls, logging I/O or
other asynchronous work in that gap.

## 8. Existing protections remain mandatory

Nothing in this clarification weakens:

- workspace-relative logical paths;
- explicit read/write prefixes;
- symlink rejection;
- hard-link overwrite rejection;
- protected paths;
- secret-content rejection;
- UTF-8 rules;
- file/list/write bounds;
- `expected_sha256` requirement;
- safe temp staging;
- timeout truthfulness;
- safe evidence/errors;
- registry + RestrictedCapabilityProvider composition;
- Core/AgentDefinition boundaries;
- no-new-dependency rule;
- S14C+ prohibition.

## 9. Remediation gate

The next builder candidate must add real deterministic regressions for:

```text
same provider / same target / concurrent overwrite
cross-provider-instance / same target / concurrent overwrite
different targets concurrent progress
lock release after failure
detected external content drift before final precondition
detected parent-chain drift before final containment check
```

All prior S14A, S14B and registry-compatibility tests remain mandatory.

## 10. Phase status

```text
S14B = NOT PASS / REMEDIATION REQUIRED
S14 = IN_PROGRESS / NOT_CLOSED
HI-054 = NOT_AWARDED
S14C = NOT_AUTHORIZED
```
