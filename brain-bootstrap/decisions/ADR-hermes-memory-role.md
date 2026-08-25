# ADR — Hermes Agent Role vs Brain MemoryProvider

**Status:** Proposed — pending integration and verification

## Context

S07 was originally named "Hermes Adapter" and expected Hermes to become Brain's first concrete memory/session provider.

Research against Hermes Agent by Nous Research established that Hermes is a capable persistent agent/session system, but its supported external surfaces do not cleanly expose deterministic equivalents for all four Brain `MemoryProvider` methods:

```text
retrieve()
remember_candidate()
commit_verified_memory()
search_history()
```

Hermes' own internal `agent.memory_provider.MemoryProvider` is an extension point for memory backends used **inside Hermes**, not a stable external client contract for Brain.

Forcing Brain to adapt its own memory semantics to Hermes' internal behavior would violate the Core/Provider separation established in S02.

## Decision

Brain will preserve its independent `MemoryProvider` contract.

Hermes Agent will be classified as:

```text
OPTIONAL DEVELOPMENT / SESSION SYSTEM
```

rather than the canonical concrete Brain `MemoryProvider`.

The first concrete Brain MemoryProvider will be:

```text
LocalReferenceMemoryProvider
```

implemented using:

```text
SQLite + FTS5
```

for deterministic local persistence and bounded historical search.

The implementation remains behind `MemoryProvider` and is not visible to Brain Core.

A future external/shared memory provider may later replace or supplement the local reference provider without changing the Core contract.

## Architecture

```text
                 ┌─────────────────────┐
                 │     Brain Core      │
                 └──────────┬──────────┘
                            │
                    MemoryProvider
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
 LocalReferenceMemoryProvider     Future MemoryProvider
      SQLite + FTS5               external/shared backend


Hermes Agent
    │
    └── optional development/session environment
        independent from Brain Core
```

## Alternatives Considered

### Alternative A — Force Hermes Agent behind MemoryProvider

**Rejected.**

Reasons:

- no clean deterministic public mapping for all four Brain methods;
- candidate-before-commit lifecycle does not map cleanly;
- direct memory reads/writes through a public external API are not sufficiently established;
- would risk coupling Brain to Hermes internals or LLM-mediated behavior.

### Alternative B — Use Hermes internal Python memory classes directly

**Rejected.**

Reasons:

- internal plugin ABI;
- opposite dependency direction;
- high upgrade/version-coupling risk;
- Brain would become dependent on Hermes implementation details.

### Alternative C — Immediately adopt an external hosted memory provider

**Deferred.**

Benefits may include richer semantic retrieval or shared memory between systems.

Costs:

- credentials;
- networking;
- external availability;
- potentially larger operational surface;
- vendor/service dependency before Brain's contract has been proven locally.

A future Eval may justify this.

### Alternative D — Local deterministic reference adapter

**Accepted.**

Reasons:

- proves the Brain contract independently;
- works offline;
- supports real persistence;
- supports bounded historical search;
- easy to test and disable;
- keeps later provider substitution honest.

## Consequences

### Positive

- S07 can be completed without inventing Hermes APIs.
- Brain Core remains provider-neutral.
- contract tests become deterministic.
- Build Day operation does not depend on external memory infrastructure.
- Hermes can still be used where it is strongest: agent/session continuity.
- future memory providers can be evaluated against a working baseline.

### Costs

- Brain owns a small reference persistence adapter.
- semantic/vector retrieval is not included initially.
- shared memory between Hermes and Brain is deferred.
- a later external provider integration may require another adapter.

## Constraint

The LocalReferenceMemoryProvider must never become a hidden Core dependency.

Brain must continue to operate when it is disabled.

## Future Decision Trigger

Evaluate a shared/external provider only when one or more of these become real requirements:

- semantic retrieval materially outperforms lexical/local retrieval in Evals;
- memory must be shared across machines/services;
- multi-user hosted persistence is required;
- memory scale exceeds the local reference implementation;
- Hermes and Brain need intentionally shared persistent memory.
