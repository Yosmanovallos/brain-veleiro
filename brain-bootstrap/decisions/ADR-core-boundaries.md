# ADR — Separate Brain Core, Intelligence, and Providers

**Status:** Proposed — pending S02 integration and verification

## Context

Brain is intended to support many different requirements, models, tools, memory systems, knowledge sources, execution environments, integrations, and orchestration strategies.

If these capabilities are implemented directly inside one runtime, Brain becomes coupled to early technology decisions and domain assumptions.

That creates several risks:

* replacing a model or integration requires Core changes;
* Agent behavior becomes mixed with infrastructure behavior;
* Skills and domain Knowledge become embedded in runtime code;
* context handling becomes tied to particular storage systems;
* workflow definitions become inseparable from one orchestration implementation;
* testing individual components becomes harder;
* future requirements inherit assumptions from unrelated earlier projects.

Brain therefore needs a stable architectural boundary before concrete implementations are selected.

## Decision

Brain will use three primary architectural layers:

```text
Intelligence
     ↓
Brain Core
     ↓
Providers / Adapters
```

### Brain Core

The Core owns generic runtime concerns:

* runtime;
* lifecycle;
* generic policy/guardrail enforcement mechanisms;
* registries and interfaces;
* Context Pack lifecycle;
* Thread and Run lifecycle;
* Execution Graph handling;
* Evidence handling;
* Handoff continuity.

The Core depends on contracts rather than concrete providers.

### Intelligence

Intelligence remains outside the Core and includes:

* Rules;
* Skills;
* Agent definitions;
* Workflow definitions;
* Quality Contracts;
* task/prompt compilation;
* Evals;
* Knowledge assets and research protocols.

Intelligence defines how Brain approaches work without becoming part of the generic runtime implementation.

### Providers / Adapters

Replaceable Provider/Adapter implementations supply:

* model inference;
* context retrieval;
* memory persistence/retrieval;
* knowledge persistence/retrieval;
* executable capabilities;
* execution environments;
* external Connectors and interoperability mechanisms;
* session persistence;
* workflow execution.

Concrete implementations must remain behind generic interfaces.

`BRAIN_CORE_BOUNDARIES.md` is the normative S02 specification for the detailed responsibilities and vocabulary mapping of these boundaries.

## Alternatives Considered

### Alternative 1 — Monolithic Agent Framework

Put Agent prompts, model calls, memory, integrations, workflows, execution logic, and domain procedures in one application/runtime.

**Advantages**

* fastest initial prototype;
* fewer interfaces;
* lower short-term implementation overhead.

**Disadvantages**

* strong coupling;
* difficult provider replacement;
* poor isolation between reasoning and infrastructure;
* domain logic leaks into runtime;
* harder testing and evolution;
* architectural complexity increases rapidly as capabilities grow.

**Decision:** Rejected.

---

### Alternative 2 — Fully Plugin-Based Everything From Day One

Represent almost every capability, including basic runtime behavior, through dynamically loaded plugins immediately.

**Advantages**

* maximum theoretical extensibility;
* strong implementation isolation;
* potentially broad ecosystem support.

**Disadvantages**

* high bootstrap complexity;
* interface design required before real usage validates the boundaries;
* harder debugging;
* unnecessary indirection for the first working system;
* conflicts with the principle that complexity must earn its place.

**Decision:** Rejected for the initial architecture.

Brain will preserve replaceable boundaries without requiring every component to become a dynamic plugin immediately.

---

### Alternative 3 — Couple Brain Directly to One Orchestration Framework

Make one workflow/orchestration implementation the architectural foundation of Brain.

**Advantages**

* fast access to advanced workflow features;
* reduced initial runtime implementation work;
* mature orchestration behavior may be available immediately.

**Disadvantages**

* Brain concepts become shaped by one implementation;
* migration cost increases;
* simple workflows inherit unnecessary framework complexity;
* Core portability decreases;
* future architecture decisions become constrained by an early implementation choice.

**Decision:** Rejected.

Brain will instead define a generic WorkflowRuntime boundary. A concrete orchestration implementation may later be selected when requirements justify it.

---

### Alternative 4 — Core / Intelligence / Providers Separation

Keep generic lifecycle and runtime in Core, semantic/procedural behavior in Intelligence, and concrete capabilities behind Providers/Adapters.

**Advantages**

* minimal stable Core;
* replaceable implementations;
* domain knowledge remains independent;
* clearer testing boundaries;
* model/provider neutrality;
* easier experimentation;
* easier migration;
* supports progressive complexity;
* aligns with configuration over hardcoding.

**Disadvantages**

* requires clearer contracts;
* introduces some adapter/interface work;
* incorrect early abstractions could require later refinement;
* developers must respect dependency boundaries consistently.

**Decision:** Accepted.

## Consequences

### Positive Consequences

Brain can evolve its:

* models;
* memory systems;
* knowledge systems;
* execution environments;
* integrations;
* workflow runtimes;

without redefining its central runtime concepts.

Agent roles, Skills, Workflows, Quality Contracts, and Knowledge can evolve independently from infrastructure.

Testing can isolate:

```text
Core behavior
Provider behavior
Intelligence behavior
```

instead of testing one inseparable system.

The architecture also supports gradual adoption of more advanced infrastructure only when actual requirements or Evals justify it.

### Costs and Trade-offs

Brain must define stable interfaces between layers.

Provider adapters introduce implementation work.

Some concepts span layers—for example Agent and Guardrail—and therefore require explicit ownership rules to avoid semantic leakage.

Poorly designed generic interfaces could become abstractions that merely hide provider-specific assumptions rather than remove them.

These risks must be managed through later contract steps and real implementation Evals.

## Architectural Constraint

Future work must preserve the following invariant:

> **No concrete provider, vendor, external system, domain Skill, or domain Knowledge asset may become necessary to define the Brain Core contract.**

If a future capability requires violating this rule, the architecture decision must be revisited explicitly through a new ADR rather than bypassed silently.

## Verification

S02 is considered verified only when:

1. every canonical S01 term remains assigned consistently;
2. Core can be reasoned about without selecting concrete technologies;
3. model, memory, knowledge, repository, and workflow implementations can be substituted conceptually without changing Core contracts;
4. no concrete implementation is required to define the Core.

Until those checks pass during integration, this ADR remains **Proposed**.
