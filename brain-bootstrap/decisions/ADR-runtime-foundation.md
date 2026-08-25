# ADR — Brain Runtime Foundation

**Status:** Proposed — pending integration and verification

## Context

S07 reached the first point where a concrete executable Brain provider must be implemented.

The repository currently contains architecture/governance artifacts but no approved application runtime, language, package manifest, test runner, or source tree.

Creating an implementation without first choosing a runtime would force the coding agent to invent a foundational architecture decision.

Brain's expected future responsibilities include provider adapters, MCP integration, structured contracts, orchestration, HTTP/API interaction, tool execution, agent runtime behavior, and Build Day automation.

Hermes Agent has been classified separately as an optional development/session environment and no longer determines Brain's runtime.

## Decision

Brain's primary runtime foundation will be:

```text
Node.js 24 LTS
TypeScript
ESM
npm
Vitest
```

The runtime source tree will begin under:

```text
src/
```

The test tree will begin under:

```text
tests/
```

The runtime foundation must remain small and must not pre-build later Brain subsystems before their bootstrap steps authorize them.

For S07 only, the first concrete MemoryProvider reference implementation may use:

```text
better-sqlite3
SQLite
FTS5
```

strictly behind the provider boundary.

## Dependency Direction

```text
Brain Core contracts
        ↓
provider interface
        ↓
provider implementation
        ↓
third-party/runtime dependency
```

Never:

```text
Brain Core
        ↓
SQLite / better-sqlite3 / vendor-specific API
```

## Initial Runtime Scope

The first runtime scaffold may contain only what S07 needs:

```text
package.json
package-lock.json
tsconfig.json
src/core/memory/
src/providers/memory/
tests/
```

Optional minimal lint/format configuration may be added only if already justified by repository conventions or deterministic verification.

Do not scaffold web frontend, HTTP server, ORM, MCP runtime, workflow engine, agent runtime, authentication, deployment stack, vector DB, or graph system.

## Alternatives Considered

### Python

Deferred as primary runtime. It would align with Hermes internals and is strong for AI/ML ecosystems, but Hermes is not a Brain runtime dependency. Python remains available later behind provider/execution boundaries if justified.

### Multi-runtime Node + Python from day one

Rejected. It increases Build Day setup, testing, process management, packaging, and debugging complexity without a current requirement.

### Node.js + JavaScript

Rejected as primary authoring language. TypeScript gives stronger compile-time contracts for provider interfaces, schemas, agent definitions, and substitution boundaries.

### Bun or Deno

Deferred. Node LTS currently offers the safest interoperability baseline and broadest deployment/tool compatibility for the Brain bootstrap.

## Consequences

### Positive

- one primary language across Brain runtime;
- strong compile-time provider contracts;
- direct path to MCP TypeScript SDK later;
- fast local execution;
- simple hackathon setup;
- no dependency on Hermes installation.

### Costs

- some Python-native AI libraries would require separate processes/adapters later;
- SQLite binding is a native dependency in the reference provider;
- runtime choice should be revisited only if a real requirement justifies it.

## Build Day Constraint

An application generated **by Brain** is not required to use Node/TypeScript. This ADR defines the runtime of Brain itself, not the technology choice for every generated application.
