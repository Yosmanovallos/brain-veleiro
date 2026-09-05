# BRAIN — S14B Registry / Filesystem Compatibility Erratum

## 1. Authority

```yaml
parent_step: S14
phase: S14B
status: AUTHORING_READY
baseline_before_erratum: 7239a98377111c8b67d7ab04acc0ba322bdce02b
classification: RUNTIME_INFRASTRUCTURE
depth: DEEP
```

This erratum is a normative addendum to:

```text
brain-bootstrap/quality-contracts/S14B_FILESYSTEM_DEEP.yaml
brain-bootstrap/specs/FILESYSTEM_CAPABILITY_CONTRACT_S14B.md
```

It exists because a pre-implementation compatibility probe proved that the
verified S14A registry's implementation-specific generic result bounds are
smaller than S14B's canonical provider bounds.

## 2. Verified contradiction

The unchanged registry rejects:

```text
1 MiB filesystem.read SUCCESS
1000-entry filesystem.list SUCCESS
workspace evidence ref > 2000 chars
```

even when the direct provider returns a valid SUCCESS.

The rejection occurs before any filesystem implementation concern.

## 3. Canonical relationship

Concrete providers own capability-specific semantic bounds.

The registry owns provider-neutral routing, validation, secret safety,
normalization and generic transport bounds.

A legal provider result MUST fit through the canonical composed runtime path:

```text
provider
→ CapabilityRegistryProvider
→ RestrictedCapabilityProvider
→ Agent Runtime
```

Therefore registry generic result bounds cannot silently redefine a provider's
published legal maximum.

## 4. Authorized compatibility patch

S14B may modify exactly:

```text
src/providers/capability/registry/validation.ts
src/providers/capability/registry/capabilityRegistryProvider.ts
```

only to separate ToolInvocationResult canonical-size validation from the
smaller descriptor/public-contract canonical-size validation.

Required target behavior:

```text
descriptor/public-contract canonical max:
100000 characters (unchanged)

ToolInvocationResult canonical max:
8388608 characters

ToolInvocationResult evidence_ref max:
8192 characters
```

Preferred implementation shape:

```text
canonicalPublicContract(value)  // existing 100000 behavior
canonicalToolResult(value)      // same safety traversal, 8388608 char ceiling
```

or an equivalent internal parameterized implementation.

The builder must preserve all other validation semantics.

## 5. Explicitly forbidden registry changes

No authorization is granted to change:

- `types.ts`;
- `validateConfig.ts`;
- routing;
- provider selection;
- ambiguity handling;
- collision handling;
- provider swap;
- diagnostics semantics/limits;
- secret-pattern recognition;
- result shape validation;
- call_id/capability_id identity checks;
- Core;
- AgentDefinition;
- `RestrictedCapabilityProvider`;
- package dependencies.

## 6. No workaround by shrinking S14B

The canonical S14B limits remain:

```text
max_read_bytes = 1048576
max_list_entries = 1000
max_path_chars = 4096
```

Do not reduce them merely to fit the old registry implementation.

Do not truncate, chunk, compress or bypass canonical outputs.

## 7. Composed-path acceptance

A builder candidate is invalid unless the actual registry path proves:

### Read maximum

A synthetic provider returns canonical filesystem.read output containing exactly
1,048,576 ASCII content bytes.

Expected through actual registry:

```text
SUCCESS
same call_id
same capability_id
same content bytes
no truncation
```

### List maximum

A synthetic provider returns canonical filesystem.list output with exactly 1000
entries, each with a 255-byte ASCII name.

Expected through actual registry:

```text
SUCCESS
all 1000 entries preserved
deterministic order unchanged
```

### Evidence maximum

A canonical `workspace://` evidence ref derived from a logical path of exactly
4096 characters must pass.

### Generic upper bound

A ToolInvocationResult with canonical serialized representation greater than
8,388,608 characters must fail closed.

### Evidence upper bound

An individual evidence ref of 8,193 characters must fail closed.

### Secret regression

Recognizable secret material must still fail closed even when the total result
is otherwise within the enlarged envelope.

### Descriptor regression

Descriptor/public-contract validation must still reject a payload that exceeds
the original 100,000-character canonical envelope.

## 8. S14A regression obligation

Because two verified S14A implementation files change, S14B builder/verifier
must rerun all S14A focused regression tests and preserve the S14A canonical
fixture/invariant semantics.

This is a compatibility patch, not a historical rewrite of S14A.

## 9. Updated protected-boundary rule

For S14B, the original blanket:

```text
src/providers/capability/registry/** byte-identical
```

is superseded by:

```text
types.ts            byte-identical
validateConfig.ts   byte-identical

validation.ts
  may change only for ToolInvocationResult envelope compatibility

capabilityRegistryProvider.ts
  may change only to invoke the result-specific canonical validator
```

All other S14B protected boundaries remain in force.

## 10. Phase status

After this erratum is integrated:

```text
S14B Part B may resume.

S14B is NOT PASS.
S14 remains IN_PROGRESS / NOT_CLOSED.
HI-054 remains NOT_AWARDED.
S14C remains NOT_AUTHORIZED.
```

Independent verification remains mandatory for the final exact S14B candidate.
