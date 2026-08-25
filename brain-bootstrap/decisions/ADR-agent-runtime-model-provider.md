# ADR — S09 Reference ModelProvider Strategy

**Status:** Proposed — pending S09 integration and verification

## Context

S09 introduces Brain's first executable Agent Runtime loop.

The Runtime requires a `ModelProvider`, but the S09 acceptance criterion only requires:

- a minimal Agent;
- at least one real Tool;
- structured output;
- observable loop iterations;
- explainable termination.

It does not require a specific external LLM.

Selecting a real LLM now would introduce additional unresolved concerns:

- vendor selection;
- SDK/API surface;
- credentials;
- network dependency;
- rate limits;
- cost;
- nondeterministic test behavior;
- external availability.

S07 established a useful precedent: prove the provider contract with a deterministic reference implementation before coupling Brain to an external product.

## Decision

For S09, Brain will use:

```text
DeterministicReferenceModelProvider
```

as the first concrete `ModelProvider`.

It will implement the same provider-neutral `ModelProvider` contract that future real model adapters must implement.

The reference provider will:

- make deterministic model-shaped decisions;
- choose Tools through generic capability descriptors;
- produce `TOOL_CALL` or `FINISH`;
- make no external network call;
- require no credential;
- support repeatable tests.

The Agent Runtime Core must remain unaware that the provider is deterministic rather than LLM-backed.

## Architecture

```text
Agent Runtime Core
        ↓
   ModelProvider
        ↓
DeterministicReferenceModelProvider
```

Later:

```text
Agent Runtime Core
        ↓
   ModelProvider
        ↓
Real LLM Adapter
```

Core remains unchanged.

## Alternatives Considered

### Alternative 1 — Integrate a real hosted LLM in S09

**Deferred.**

Advantages:

- demonstrates real model reasoning;
- closer to final production behavior.

Disadvantages:

- introduces vendor/API decision before required;
- requires credential/config design;
- nondeterministic contract tests;
- network availability risk;
- cost/rate-limit considerations;
- expands S09 beyond its fundamental-loop purpose.

A later step may introduce a real model adapter behind the same contract.

### Alternative 2 — Put deterministic decision logic directly inside Agent Runtime Core

**Rejected.**

That would falsely make model behavior a Core responsibility and break provider substitution.

The deterministic logic must live behind `ModelProvider`.

### Alternative 3 — Use only a fake mock ModelProvider

**Rejected as the reference implementation.**

A pure test mock proves unit plumbing but does not prove a reusable provider implementation.

The deterministic reference provider should be a real provider implementation with deterministic behavior, while tests may also use fakes for substitution/error paths.

### Alternative 4 — Deterministic reference ModelProvider behind the generic contract

**Accepted.**

Reasons:

- deterministic;
- no secrets;
- no network;
- no vendor lock-in;
- repeatable contract tests;
- validates Core/provider boundary;
- minimizes S09 scope;
- preserves clean path to future real models.

## Consequences

### Positive

- S09 can be implemented and tested offline.
- no credentials enter prompts/git.
- event/termination tests become deterministic.
- Build Day setup stays reliable.
- real LLM integration remains replaceable.

### Costs

- S09 does not prove real LLM quality.
- reference decision logic is intentionally limited.
- a later model-provider integration step remains necessary.

## Real Tool Decision

The S09 requirement for a **real Tool** remains unchanged.

A deterministic reference ModelProvider does not permit a fake Tool to satisfy the acceptance test.

At least one actual CapabilityProvider-exposed Tool must execute a real operation and return a computed structured result.

## Security

Because the S09 reference ModelProvider makes no external calls:

```text
no API key
no model credential
no secret configuration
```

is required.

If a later real model adapter requires credentials, they must be supplied through secure runtime references and must never be embedded in prompts, Memory, Skills, Markdown, or Git.

## Substitution Test

Replace:

```text
DeterministicReferenceModelProvider
```

with any conforming:

```text
ModelProvider
```

Expected:

```text
Agent Runtime Core unchanged
```

If Core changes are required to accommodate provider-specific request/response objects, this ADR's substitution criterion fails.
