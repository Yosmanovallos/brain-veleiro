# ADR — S14B Registry Result Envelope Compatibility

## Status

```yaml
decision: ACCEPTED_FOR_S14B
parent_step: S14
phase: S14B
baseline_before_erratum: 7239a98377111c8b67d7ab04acc0ba322bdce02b
classification: RUNTIME_INFRASTRUCTURE
depth: DEEP
```

## Context

S14A introduced a provider-neutral `CapabilityRegistryProvider`.

Its implementation uses a bounded canonical JSON validator before forwarding
`ToolInvocationResult` values.

The verified S14A implementation currently has:

```text
generic canonical serialized-result ceiling: 100000 characters
evidence_ref string ceiling: 2000 characters
```

S14B later authored a bounded filesystem provider with these direct-provider
maxima:

```text
max_read_bytes: 1048576
max_list_entries: 1000
max_path_chars: 4096
evidence: workspace://<logical-path>
```

A pre-implementation compatibility probe using the unchanged registry proved:

```text
small read → SUCCESS through registry
1 MiB ASCII read → provider SUCCESS, registry FAIL / INTERNAL_ERROR
1000-entry list with 120-char names → provider SUCCESS, registry FAIL / INTERNAL_ERROR
2037-char workspace evidence ref → provider SUCCESS, registry FAIL / INTERNAL_ERROR
```

No filesystem implementation or mutation was involved.

## Decision

The registry is a provider-neutral transport/validation boundary.

A concrete provider owns capability-specific semantics and bounds.

The registry may impose generic safety bounds, but those bounds MUST NOT make a
canonical provider result impossible to transport.

For S14B, the registry result envelope is revised as follows:

```yaml
tool_result_max_serialized_chars: 8388608
tool_result_max_evidence_ref_chars: 8192
```

These values apply only to `ToolInvocationResult` validation.

The original S14A `canonical()` envelope remains unchanged for:

- ToolDescriptor validation;
- registry descriptor compatibility;
- schemas and other public contract material;
- configuration-related validation.

No change is authorized to:

- provider routing;
- provider selection;
- capability identity;
- `RestrictedCapabilityProvider`;
- Core;
- AgentDefinition;
- S14A descriptor compatibility semantics;
- S14A diagnostics limits;
- dependency manifests.

## Why 8,388,608 serialized characters

S14B's largest file content is 1,048,576 UTF-8 bytes.

For deterministic worst-case JSON transport budgeting, a one-byte control
character can serialize as six JSON characters (`\u00XX`).

Therefore:

```text
1,048,576 × 6 = 6,291,456 serialized characters
```

The S14B result wrapper, logical path, SHA-256, evidence refs and JSON structure
must also fit.

An 8,388,608-character ToolInvocationResult envelope provides bounded headroom
without changing the 1 MiB provider limit.

For directory listing:

```text
1000 entries × max 255 UTF-8 bytes/name × worst-case factor 6
≈ 1,530,000 serialized characters
```

plus structure, also below the envelope.

## Why 8,192 evidence-ref characters

S14B permits a logical path up to 4096 characters.

Canonical evidence is:

```text
workspace://<logical-path>
```

A generic 8192-character evidence-ref ceiling safely accommodates the S14B
logical maximum while remaining bounded.

The S14B provider itself still enforces its stricter semantic evidence rules and
`max_evidence_refs: 8`.

## Security properties retained

The larger result envelope does NOT permit raw unvalidated objects.

Tool results still require:

- canonical bounded traversal;
- finite depth/node checks;
- no accessors/prototype tricks;
- secret-pattern rejection;
- valid `ToolInvocationResult` shape;
- bounded evidence-ref count;
- bounded evidence-ref length;
- call_id/capability_id identity;
- safe normalized failures.

The patch expands only the maximum legal result size.

## Consequence

S14B no longer requires byte identity for exactly two S14A registry files.

Those two files may change only for this compatibility patch:

```text
src/providers/capability/registry/validation.ts
src/providers/capability/registry/capabilityRegistryProvider.ts
```

The following remain byte-identical to baseline:

```text
src/providers/capability/registry/types.ts
src/providers/capability/registry/validateConfig.ts
src/core/agent/types.ts
src/core/agent/restrictedCapabilityProvider.ts
src/core/agent/definition.ts
package.json
package-lock.json
```

The exact compatibility patch plus S14B filesystem implementation must receive a
fresh independent verifier before S14B phase acceptance.
