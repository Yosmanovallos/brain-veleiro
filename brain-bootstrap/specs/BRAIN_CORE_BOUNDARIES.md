# BRAIN — Core Boundaries

This document defines the architectural boundary between **Brain Core**, **Intelligence**, and **Providers/Adapters**.

The goal is to keep Brain's runtime small and stable while allowing models, memory systems, knowledge stores, execution environments, integrations, workflows, and domain intelligence to evolve independently.

## 1. Architectural Principle

Brain follows this dependency direction:

```text
                    Intelligence
                         │
                         │ configuration / definitions
                         ▼
                    Brain Core
                         │
                         │ generic interfaces
                         ▼
                Providers / Adapters
```

The Core coordinates work.

Intelligence defines how Brain should reason and what standards or procedures apply.

Providers/Adapters supply replaceable implementations of external or infrastructure capabilities.

The governing rule is:

> **The Core may depend on contracts. It must not depend on concrete implementations.**

A concrete provider must therefore be replaceable without changing the Core's conceptual contract.

---

# 2. Brain Core

## 2.1 Purpose

The **Brain Core** is the minimal execution kernel responsible for running Brain's generic lifecycle.

It does not contain domain expertise, vendor-specific integrations, application-specific procedures, or knowledge bases.

Its responsibility is to coordinate generic execution through contracts.

## 2.2 Core Responsibilities

The Core owns the generic mechanisms for:

### Runtime

Executing configured Agents, Workflows, Runs, Tools through capability interfaces, and other runtime behaviors without embedding domain-specific reasoning into the runtime itself.

### Lifecycle

Managing transitions such as:

```text
created
→ ready
→ running
→ waiting
→ completed
→ failed
→ blocked
→ cancelled
```

The exact lifecycle may evolve in later contracts, but lifecycle ownership remains in Core.

### Policies and Enforcement Hooks

The Core provides generic policy and guardrail enforcement points.

The Core may ask:

```text
Is this operation allowed?
Does this require approval?
Can execution continue?
Has a budget been exceeded?
```

It must not hardcode the domain-specific Rule that determines the answer.

### Registries and Interfaces

The Core maintains generic mechanisms for resolving configured capabilities and providers through interfaces.

For example:

```text
requested capability
        ↓
registry / resolver
        ↓
provider implementation
```

The Core understands the contract, not the concrete implementation.

### Context Lifecycle

The Core coordinates the creation of bounded **Context Packs**.

It may request relevant information from context, memory, knowledge, repository, or session providers, but the Core decides what enters the task-specific Context Pack according to applicable policies and budgets.

The Core must not treat all available information as active context.

### Thread and Run Lifecycle

The Core owns generic Thread and Run identity, state, transitions, budgets, and traceability.

### Execution Graph Materialization

The Core or its configured Workflow Runtime may materialize a Workflow definition into an executable graph containing concrete runtime nodes, branches, gates, retries, approvals, and transitions.

### Evidence Handling

The Core captures, associates, and preserves Evidence produced during Runs.

A claim made by an Agent is not automatically Evidence.

### Handoff Lifecycle

The Core supports structured transfer of verified operational state between sessions, Agents, models, platforms, or execution contexts without requiring complete conversation replay.

---

# 3. What the Core Must Not Contain

The Core must not contain:

* domain-specific expertise;
* architecture pattern libraries;
* research knowledge;
* application-specific prompts;
* Skill content;
* Agent role instructions;
* concrete Workflow definitions;
* Quality Contract content;
* Eval datasets;
* business-specific Rules;
* concrete external integrations;
* credentials or secrets;
* provider-specific SDK assumptions;
* assumptions about a particular storage technology;
* assumptions about a particular orchestration implementation;
* assumptions about a particular model provider.

The Core may define or consume interfaces required to use these capabilities.

It must not own their concrete implementation or semantic content.

---

# 4. Intelligence

## 4.1 Purpose

**Intelligence** contains the configurable knowledge and procedural artifacts that determine **how Brain should approach work**.

It lives outside the Core.

Intelligence can evolve rapidly without requiring the generic runtime to be redesigned.

## 4.2 Intelligence Contents

Intelligence includes:

### Rules

Declarative constraints defining what must, must not, or may occur.

### Skills

Reusable procedural knowledge describing how to perform bounded capabilities.

### Agent Definitions

Configuration describing the objective, behavior, context policy, capabilities, permissions, limits, and other characteristics of an Agent.

The concrete AgentDefinition schema is deferred to a later step.

### Workflow Definitions

Reusable definitions describing how work should progress through stages, gates, dependencies, and outcomes.

### Quality Contracts

Definitions of the depth, evidence, rigor, validation, uncertainty treatment, and acceptance standard required for work.

### Task / Prompt Compilation

Intelligence describing how a verified task, relevant context, applicable Skills, constraints, expected output, and quality requirements are compiled into an execution-ready package.

The concrete compiler contract is deferred to a later step.

### Evals

Datasets, metrics, graders, and repeatable evaluation definitions used to measure behavior or quality.

### Knowledge Assets

Curated or compiled reusable understanding such as:

* architecture knowledge;
* research findings;
* system knowledge;
* domain concepts;
* decisions;
* patterns;
* documented failure modes.

Knowledge storage is not part of Intelligence itself; replaceable providers may persist and retrieve it.

---

# 5. Providers / Adapters

## 5.1 Purpose

**Providers/Adapters** implement capabilities required by the Core while remaining replaceable.

They translate generic Brain contracts into concrete runtime behavior or external-system interaction.

Replacing an implementation must not require redesigning the Core contract.

---

## 5.2 ModelProvider

Provides access to model inference through a generic model boundary.

Its responsibility is to translate a Brain model request into the configured model implementation and normalize the resulting response, usage information, or error.

The Core must not depend on a provider-specific model API.

---

## 5.3 ContextProvider

Supplies candidate context relevant to a task from a particular context source.

Its responsibility is retrieval or access, not final Context Pack composition.

The Core remains responsible for deciding what selected information enters the bounded Context Pack.

---

## 5.4 MemoryProvider

Persists and retrieves experience-derived Memory through a generic interface.

It may support durable facts, historical learnings, or retrieval across execution contexts.

Policies determining what deserves to become Memory are separate from the persistence implementation.

---

## 5.5 KnowledgeProvider

Stores, searches, and retrieves Knowledge assets through a generic interface.

It may support different indexing or retrieval strategies, but those implementation choices must not alter Brain's definition of Knowledge.

---

## 5.6 CapabilityProvider

Resolves executable capabilities available to Brain.

It may expose Tools directly or obtain them through Connectors or standardized interoperability mechanisms.

The Core requests capabilities through generic identifiers/contracts rather than depending on a particular external integration.

---

## 5.7 ExecutionProvider

Provides an environment in which executable work can occur.

It may support operations such as filesystem access, command execution, isolated execution environments, browser execution, or other runtime actions depending on the implementation.

Execution infrastructure remains separate from the Agent's reasoning state.

---

## 5.8 SessionStore

Persists durable Thread, Run, Handoff, lifecycle, and related session-state information.

Its implementation may vary without changing the Core concepts of Thread, Run, Evidence, or Handoff.

---

## 5.9 WorkflowRuntime

Executes or materializes Workflow definitions through the generic Workflow boundary.

It may support branching, retries, checkpoints, interrupts, approvals, persistence, or parallel execution according to the selected implementation.

The reusable Workflow definition remains Intelligence; its runtime implementation remains replaceable.

---

# 6. Canonical Vocabulary Mapping

The following mappings preserve the approved S01 vocabulary.

| Term             | Canonical layer             | Boundary interpretation                                                                              |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Rule             | Intelligence                | Declarative constraint authored outside Core; Core may enforce it through generic policy mechanisms. |
| Skill            | Intelligence                | Procedural knowledge loaded when applicable.                                                         |
| Tool             | Provider/Adapter            | Atomic executable capability exposed through generic capability contracts.                           |
| Connector        | Provider/Adapter            | Adapter integrating an external system.                                                              |
| MCP              | Provider/Adapter            | Standardized interoperability boundary usable by provider implementations.                           |
| Guardrail        | Spans Intelligence and Core | Intelligence defines the policy; Core/runtime performs enforcement.                                  |
| Memory           | Provider/Adapter            | Persisted experience-derived information accessed through a replaceable MemoryProvider.              |
| Knowledge        | Intelligence                | Reusable curated/compiled understanding; persistence/retrieval is delegated to KnowledgeProvider.    |
| Context Pack     | Core                        | Bounded task-specific context assembled for execution.                                               |
| Agent            | Spans Intelligence and Core | Intelligence configures Agent behavior; Core provides the generic runtime.                           |
| Thread           | Core                        | Durable continuity boundary across related Runs.                                                     |
| Run              | Core                        | One bounded traceable execution occurrence.                                                          |
| Workflow         | Intelligence                | Reusable process definition interpreted by a Workflow Runtime.                                       |
| Execution Graph  | Core                        | Concrete runtime topology for coordinated execution.                                                 |
| Eval             | Intelligence                | Repeatable measurement definition; results become runtime Evidence.                                  |
| Evidence         | Core                        | Verifiable observations associated with execution and claims.                                        |
| Quality Contract | Intelligence                | Required rigor and acceptance standard for work.                                                     |
| Handoff          | Core                        | Structured transfer of verified operational state across execution contexts.                         |

---

# 7. Dependency Rules

## 7.1 Allowed Direction

Conceptually:

```text
Intelligence
    │
    ▼
Core contracts
    │
    ▼
Provider interfaces
    │
    ▼
Concrete implementations
```

The Core may execute Intelligence definitions and call Provider interfaces.

Concrete Providers may implement Core-defined contracts.

Intelligence may declare required generic capabilities.

## 7.2 Forbidden Coupling

The following dependency is forbidden:

```text
Core
 ↓
Concrete vendor / product / service
```

Likewise, an Agent Definition should request a capability rather than require the Core to understand a particular implementation.

Example:

```text
GOOD

Agent requires:
repository.read

             ↓

Capability resolver chooses implementation
```

not:

```text
BAD

Core contains special logic for
one repository service
```

---

# 8. Substitution Test

This section intentionally uses named technologies solely as **illustrative substitution tests**. None of them is selected or required by this architecture.

## 8.1 Hermes substitution test

Suppose one MemoryProvider implementation uses **Hermes**.

Brain Core communicates only through the generic MemoryProvider contract.

If that implementation is replaced by another memory system:

```text
Core
 ↓
MemoryProvider
 ↓
Implementation A → Implementation B
```

the concepts of Agent, Thread, Run, Context Pack, Handoff, Workflow, and Evidence remain unchanged.

Therefore replacing Hermes requires an adapter/configuration change, not a Core contract redesign.

**Result: PASS.**

---

## 8.2 Notion substitution test

Suppose one KnowledgeProvider obtains curated Knowledge from **Notion**.

The Core does not know that the underlying source is Notion.

It requests Knowledge candidates through the generic KnowledgeProvider/ContextProvider boundaries.

Replacing Notion with another knowledge repository changes the Provider implementation or configuration while leaving the Core contract unchanged.

**Result: PASS.**

---

## 8.3 GitHub substitution test

Suppose repository capabilities are exposed through a Connector for **GitHub**.

Agents request generic capabilities such as repository inspection or version-control operations.

The Core does not contain GitHub-specific domain logic.

Replacing GitHub with another repository implementation requires changing the Connector/CapabilityProvider mapping, not changing the Agent runtime, Run lifecycle, Evidence model, or Context Pack concept.

**Result: PASS.**

---

## 8.4 LangGraph substitution test

Suppose the WorkflowRuntime implementation uses **LangGraph**.

Workflow definitions remain Intelligence artifacts and Core execution concepts remain generic.

Replacing LangGraph with another workflow runtime—or a simpler internal runtime—changes the WorkflowRuntime implementation while preserving Workflow, Run, Execution Graph, Evidence, Thread, and lifecycle contracts.

**Result: PASS.**

---

## 8.5 LLM provider substitution test

Suppose ModelProvider delegates inference to a particular **LLM provider**.

The Agent runtime requests model inference through ModelProvider without embedding provider-specific assumptions.

Changing to another provider requires updating ModelProvider configuration or implementation while preserving:

* Agent identity;
* Context Pack semantics;
* Skills;
* Workflow definitions;
* Rules;
* Quality Contracts;
* Run semantics;
* Evidence handling.

**Result: PASS.**

---

# 9. Boundary Verification

The architecture satisfies the S02 boundary requirement when all of the following remain true:

1. Brain Core can be described without selecting a concrete integration.
2. Intelligence can evolve without changing the generic runtime contract.
3. Providers can be replaced without redefining Brain's canonical concepts.
4. Agents request generic capabilities rather than vendor-specific implementations.
5. Workflow definitions remain independent from their runtime implementation.
6. Memory and Knowledge remain distinct concepts even if one implementation stores both.
7. Runtime Evidence remains independent from the model or execution provider that produced it.
8. No concrete vendor is required to structurally define Brain Core.

Under these conditions, the Core remains minimal while Brain's Intelligence and implementation ecosystem can evolve independently.
