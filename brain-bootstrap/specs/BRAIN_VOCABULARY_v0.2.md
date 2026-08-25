# BRAIN — Canonical Vocabulary v0.2

This document defines the canonical vocabulary used by Brain so that runtime, intelligence, providers, skills, agents, workflows, memory, evidence, and evaluation remain conceptually separated.

The definitions intentionally align with common AI/software-engineering usage when that usage is sufficiently precise, while adding Brain-specific boundaries where necessary to prevent overlapping responsibilities.

## Terms

### 1. Rule

**Definition**

A **Rule** is a declarative, mandatory constraint that states what must, must not, or may occur under defined conditions.

A Rule expresses an invariant or obligation. It does not itself perform an action.

Examples include requirements such as:

* destructive production actions require approval;
* credentials must never be written into prompts;
* a step cannot pass without evidence.

**Not to be confused with**

* **Guardrail:** a Guardrail is an enforcement mechanism that detects, permits, transforms, pauses, or blocks behavior at runtime. The Rule states the constraint; the Guardrail may enforce it.
* **Quality Contract:** a Quality Contract defines the required quality level for a specific task or class of tasks rather than a general behavioral invariant.
* **Skill:** a Skill explains how to perform work; a Rule constrains how work may be performed.

**Layer**

**Intelligence.**

Rules are authored as declarative Intelligence artifacts. The Core may enforce applicable Rules through its policy/lifecycle mechanisms without owning their domain-specific content.

---

### 2. Skill

**Definition**

A **Skill** is reusable procedural knowledge describing how to perform a bounded capability correctly.

A Skill can contain methods, decision criteria, ordered procedures, failure handling, required inputs, expected outputs, and verification guidance.

A Skill teaches an Agent **how** to perform a kind of work; it does not perform the external operation itself.

**Not to be confused with**

* **Tool:** a Tool executes an atomic operation; a Skill describes how and when operations should be combined.
* **Workflow:** a Workflow coordinates multiple stages or responsibilities; a Skill describes one reusable capability within or outside a Workflow.
* **Knowledge:** Knowledge explains facts, concepts, systems, or decisions; a Skill explains a procedure.

**Layer**

**Intelligence.**

Skills are reusable Intelligence artifacts loaded when relevant rather than permanently embedded into the Core.

---

### 3. Tool

**Definition**

A **Tool** is an atomic executable capability that accepts a defined input, performs an operation, and returns a defined result or error.

A Tool is the smallest Brain concept whose primary responsibility is to **do something** rather than describe how something should be done.

Examples may include reading a file, executing a test command, querying a datastore, or retrieving a document.

**Not to be confused with**

* **Skill:** a Skill contains procedure; a Tool performs an operation.
* **Connector:** a Connector adapts access to an external system and may expose multiple Tools.
* **MCP:** MCP is a standardized interoperability boundary through which Tools or other capabilities may be exposed; it is not itself the atomic operation.

**Layer**

**Provider/Adapter.**

Tools are exposed to the Core through replaceable capability/execution interfaces. The Core invokes them without depending on their concrete implementation.

---

### 4. Connector

**Definition**

A **Connector** is an adapter responsible for integrating Brain with an external system, service, or API.

Its responsibilities may include authentication integration, protocol translation, request/response normalization, capability discovery, error normalization, and lifecycle management for that external dependency.

A Connector may expose one or more Tools.

**Not to be confused with**

* **Tool:** a Tool is one executable operation; a Connector represents an integration boundary that may provide many operations.
* **MCP:** MCP defines a standardized communication protocol/interface. A Connector describes the adapter to a particular external capability regardless of whether MCP, a native API, a local protocol, or another mechanism is used.

**Layer**

**Provider/Adapter.**

Connectors are replaceable integration implementations outside the minimal Core.

---

### 5. MCP

**Definition**

**MCP** is a standardized interoperability protocol boundary used to expose or consume capabilities and contextual resources between compatible systems.

Within Brain, MCP is one possible transport/interface mechanism for capabilities. It is not the canonical representation of a Skill, Agent, Workflow, Memory system, or external service.

**Not to be confused with**

* **Connector:** a Connector integrates a particular external system; it may internally use MCP or another protocol.
* **Tool:** a Tool is an individual executable operation that may be exposed through MCP.
* **Skill:** a Skill is procedural Intelligence and is not defined by the protocol used to access Tools.

**Layer**

**Provider/Adapter.**

MCP implementations belong at integration boundaries and must remain replaceable rather than becoming dependencies of the Core.

---

### 6. Guardrail

**Definition**

A **Guardrail** is a runtime control that evaluates behavior or data and then allows, rejects, transforms, pauses, escalates, or otherwise constrains an action.

Guardrails operationalize safety, permission, validation, or policy boundaries.

**Not to be confused with**

* **Rule:** a Rule states what must be true; a Guardrail performs runtime enforcement.
* **Eval:** an Eval measures behavior or quality; a Guardrail actively controls execution.
* **Quality Contract:** a Quality Contract specifies required quality; a Guardrail prevents or redirects unacceptable runtime behavior.

**Layer**

**Spans Intelligence and Core.**

The constraint or enforcement policy is configured through Intelligence, while the Core or Provider boundary performs runtime enforcement.

The Core must support guardrail enforcement without hardcoding domain-specific guardrail content.

---

### 7. Memory

**Definition**

**Memory** is persisted information derived from prior interactions, runs, decisions, observations, or learned experience that may be retrieved later to improve continuity or future decisions.

Memory is selective and contextual. It should preserve useful state or learning rather than indiscriminately replaying complete historical context.

**Not to be confused with**

* **Knowledge:** Knowledge is curated or compiled understanding intended to remain useful independent of one specific interaction history. Memory originates primarily from experience and history.
* **Thread:** a Thread contains active conversational or task continuity; Memory can outlive a Thread.
* **Handoff:** a Handoff transfers verified current operational state between execution contexts; Memory is broader and longer-lived.

**Layer**

**Provider/Adapter.**

Memory persistence and retrieval are accessed through a replaceable memory interface. Policies determining what deserves to become Memory may be supplied by Intelligence.

---

### 8. Knowledge

**Definition**

**Knowledge** is curated, compiled, or externally sourced understanding about a project, domain, system, decision, architecture, concept, or environment that can be retrieved to support reasoning.

Knowledge should retain enough provenance, validity, and structure to distinguish established information from assumption or obsolete information.

**Not to be confused with**

* **Memory:** Memory captures useful information learned from previous experience or execution history; Knowledge represents reusable understanding independent of a particular previous run.
* **Evidence:** Evidence supports a concrete claim or verification result; Knowledge is reusable understanding that may be derived from multiple Evidence sources.
* **Context Pack:** Knowledge may contribute to a Context Pack, but the Context Pack contains only the subset relevant to a specific task.

**Layer**

**Intelligence.**

Knowledge artifacts belong to Intelligence. Their storage and retrieval may be implemented through a replaceable Knowledge Provider.

---

### 9. Context Pack

**Definition**

A **Context Pack** is the bounded, task-specific set of information assembled for one execution or decision.

It contains only the highest-value context needed for the current objective, such as relevant requirements, constraints, verified state, selected Knowledge, applicable Skills, relevant artifacts, and acceptance criteria.

A Context Pack is compiled, not accumulated indiscriminately.

**Not to be confused with**

* **Memory:** Memory is a source from which relevant information may be retrieved.
* **Knowledge:** Knowledge is another source from which relevant information may be retrieved.
* **Thread:** a Thread may contain ongoing conversational history; a Context Pack is a deliberately selected input for a particular execution.
* **Handoff:** a Handoff preserves operational continuity across contexts; a Context Pack prepares a specific Agent or Run to perform work.

**Layer**

**Core.**

The Core context lifecycle assembles and supplies Context Packs using replaceable context, memory, knowledge, and repository providers.

---

### 10. Agent

**Definition**

An **Agent** is an autonomous or partially autonomous execution entity in which a model operates under a defined objective, context policy, capabilities, permissions, limits, and termination conditions.

An Agent can observe results, make decisions, invoke Tools, and continue or stop according to its configuration.

Agent identity and behavior must be configurable rather than represented by a hardcoded class for every role.

**Not to be confused with**

* **Skill:** a Skill teaches an Agent how to perform a capability; the Agent is the entity performing the work.
* **Workflow:** a Workflow coordinates stages of work; one or more Agents may participate in a Workflow.
* **Tool:** an Agent can invoke Tools but is not itself an atomic Tool.
* **Thread:** an Agent may operate inside many Threads; the Thread is execution context, not identity.

**Layer**

**Spans Intelligence and Core.**

Agent configuration and role belong to Intelligence; the Core provides the generic Agent runtime and lifecycle.

---

### 11. Thread

**Definition**

A **Thread** is a durable logical continuity boundary for related interaction or work context across one or more executions.

It groups related history so work can continue coherently without treating every execution as an unrelated event.

A Thread may contain multiple Runs over time.

**Not to be confused with**

* **Run:** a Run is one bounded execution instance; a Thread can contain many Runs.
* **Memory:** Memory may persist facts or learning beyond a Thread and may be retrieved across Threads.
* **Handoff:** a Handoff transfers selected verified state when changing execution context; a Thread represents the continuity container itself.

**Layer**

**Core.**

Thread lifecycle and identity are runtime/session concerns.

---

### 12. Run

**Definition**

A **Run** is one bounded execution instance with a defined start, inputs, actor or Workflow, observations, actions, resource usage, outcome, and terminal state.

A retry may create another Run or another explicitly tracked attempt according to the runtime design, but the important boundary is that a Run represents one traceable execution occurrence.

**Not to be confused with**

* **Thread:** a Thread provides continuity across Runs.
* **Workflow:** a Workflow is a reusable process definition; a Run is an execution of work.
* **Execution Graph:** an Execution Graph describes the runtime topology of coordinated work during execution; the Run is the traceable execution instance that owns or references that graph.

**Layer**

**Core.**

Runs are first-class lifecycle, observability, budget, and evidence units.

---

### 13. Workflow

**Definition**

A **Workflow** is a reusable declarative definition of how work should progress through stages, decisions, dependencies, gates, and possible outcomes.

A Workflow defines the intended coordination pattern independently of a single execution.

Examples include specification → implementation → verification or reproduce → diagnose → fix → regression-test.

**Not to be confused with**

* **Skill:** a Skill explains a reusable capability; a Workflow coordinates stages or responsibilities.
* **Execution Graph:** a Workflow is the reusable definition; an Execution Graph is the concrete runtime structure produced for an execution.
* **Agent:** an Agent performs reasoning or actions within a Workflow but is not the Workflow itself.

**Layer**

**Intelligence.**

Workflow definitions are Intelligence artifacts interpreted by a replaceable Workflow Runtime.

---

### 14. Execution Graph

**Definition**

An **Execution Graph** is the concrete runtime graph of nodes, dependencies, branches, joins, retries, approvals, and transitions used to coordinate a specific execution of work.

It represents what is actually executable or currently executing, including dynamic branches that may not have been known until runtime.

**Not to be confused with**

* **Workflow:** the Workflow is the reusable process definition; the Execution Graph is its instantiated or dynamically constructed runtime topology.
* **Run:** a Run is the traceable execution occurrence; an Execution Graph describes coordinated structure within or across that execution.
* **Knowledge Graph:** an Execution Graph describes control flow, not semantic relationships among knowledge entities.

**Layer**

**Core.**

The Core or replaceable Workflow Runtime materializes and executes the graph from Intelligence-defined Workflows and runtime decisions.

---

### 15. Eval

**Definition**

An **Eval** is a repeatable measurement procedure used to determine how well an Agent, Skill, Workflow, model configuration, retrieval strategy, or other Brain capability performs against defined cases and metrics.

An Eval must produce measurable outcomes that support comparison, regression detection, or release decisions.

**Not to be confused with**

* **Evidence:** Evidence is the observed data produced by execution; an Eval interprets observations according to defined measurements.
* **Quality Contract:** a Quality Contract declares the required quality threshold or conditions; an Eval measures whether those expectations are achieved.
* **Guardrail:** a Guardrail controls runtime behavior; an Eval assesses behavior.

**Layer**

**Intelligence.**

Eval definitions, datasets, metrics, and grading logic are Intelligence artifacts. Their execution results become Run Evidence.

---

### 16. Evidence

**Definition**

**Evidence** is a verifiable observation or artifact that supports or contradicts a claim about what occurred or whether a condition was satisfied.

Examples include command output, exit codes, test results, diffs, traces, timestamps, artifact hashes, API responses, or externally verifiable state.

A statement made by an Agent is not Evidence merely because the Agent asserted it.

**Not to be confused with**

* **Eval:** an Eval defines how performance is measured; Evidence is the observed material used by verification or evaluation.
* **Knowledge:** Knowledge is reusable understanding; Evidence is concrete support for a specific claim.
* **Quality Contract:** a Quality Contract states what must be achieved; Evidence helps prove whether it was achieved.

**Layer**

**Core.**

Evidence is captured and associated with Runs, verification, lifecycle gates, and auditability.

---

### 17. Quality Contract

**Definition**

A **Quality Contract** is an explicit declaration of the rigor required for a task or class of tasks before its result can be accepted.

It may define required depth, evidence standards, source quality, validation requirements, testing expectations, uncertainty handling, comparison requirements, risk treatment, or minimum acceptance thresholds.

A Quality Contract answers:

**"How good and how well-supported must this result be?"**

**Not to be confused with**

* **Rule:** a Rule defines a mandatory behavioral or architectural constraint; a Quality Contract defines the required quality level for a particular kind of work.
* **Eval:** an Eval measures performance; a Quality Contract specifies the expected standard.
* **Guardrail:** a Guardrail controls runtime behavior; a Quality Contract governs acceptance quality.

**Layer**

**Intelligence.**

Quality Contracts are authored Intelligence artifacts applied by Workflows, Agents, verification, and evaluation.

---

### 18. Handoff

**Definition**

A **Handoff** is a structured transfer artifact that allows work to continue safely in another session, Agent, model, platform, or execution context without requiring the entire previous conversation.

A Handoff carries the minimum verified operational state needed for continuity, including current objective, completed work, Evidence references, unresolved issues, constraints, relevant artifacts, and the next permitted action.

A Handoff must distinguish verified state from assumptions or unresolved claims.

**Not to be confused with**

* **Context Pack:** a Context Pack is optimized for executing one specific task; a Handoff is optimized for transferring continuity between contexts.
* **Memory:** Memory preserves useful information over time; a Handoff describes the current operational frontier.
* **Thread:** a Thread is the continuity container; a Handoff is an artifact used when continuity must cross execution boundaries.

**Layer**

**Core.**

Handoffs belong to session/run continuity and are persisted as operational state artifacts. They may reference Intelligence artifacts without becoming Intelligence themselves.

## Ambiguous Examples

### 1. "Production deployments must always require explicit human approval."

**Classification:** Rule

**Reasoning:** This is a declarative constraint specifying what must be true. It does not describe the runtime mechanism that blocks an unapproved deployment. If a runtime control intercepted the deployment and paused it until approval existed, that runtime control would instead be a Guardrail.

---

### 2. "Before executing a destructive action, the runtime checks authorization and blocks the action when approval is missing."

**Classification:** Guardrail

**Reasoning:** The scenario describes active runtime enforcement. The underlying requirement may originate from a Rule, but the object being described here is the mechanism that permits or blocks execution.

---

### 3. "A reusable document explains how to investigate an intermittent test failure: reproduce it, isolate concurrency, inspect logs, form hypotheses, test one hypothesis at a time, and add a regression test."

**Classification:** Skill

**Reasoning:** This artifact describes reusable procedural knowledge. It does not itself execute tests or shell commands, so it is not a Tool.

---

### 4. "An executable capability accepts a test path, runs the test process, and returns stdout, stderr, exit code, and duration."

**Classification:** Tool

**Reasoning:** The primary responsibility is one atomic executable operation with defined input and output. It is not a Skill because it does not describe a diagnostic procedure, and it is not a Connector because it does not represent an external integration boundary.

---

### 5. "A module handles authentication, API normalization, retries, and error translation for an external project-management service and exposes several operations to Brain."

**Classification:** Connector

**Reasoning:** Its primary responsibility is adapting an external system into Brain's capability boundary. Individual operations exposed by the module may be Tools, and the transport could optionally use MCP, but the object described is the external-system adapter.

---

### 6. "A previous development session established and verified that this repository uses a specific package manager; that fact is persisted so later sessions do not repeatedly rediscover it."

**Classification:** Memory

**Reasoning:** The information originates from prior experience and is persisted for continuity. A curated architectural explanation of package-management strategy would be Knowledge; this scenario concerns a remembered verified project fact.

---

### 7. "Before a Builder begins one implementation task, Brain assembles the exact requirement, acceptance criteria, applicable constraints, three relevant files, one architecture decision, and the required test command into a bounded input."

**Classification:** Context Pack

**Reasoning:** The artifact is selected specifically for one execution and intentionally excludes irrelevant history. It may draw from Memory, Knowledge, repository state, and Skills, but it is the compiled task-specific context, not any one source.

---

### 8. "The same Builder identity continues implementing the same feature across several tool calls and retries, but one traceable execution begins at 10:14, ends at 10:19, records its token usage, tool calls, test failure, and final status."

**Classification:** Run

**Reasoning:** The object being identified is one bounded traceable execution occurrence. The broader conversational continuity could be a Thread, while the Builder itself is an Agent.

---

### 9. "The reusable process says: analyze requirement → design → implement → verify; failed verification returns work to implementation."

**Classification:** Workflow

**Reasoning:** This describes the reusable coordination definition independent of a particular execution. It becomes an Execution Graph only when the runtime materializes actual nodes, branches, retries, and state for a concrete execution.

---

### 10. "During the current execution, verification fails twice, the runtime creates two concrete retry edges back to implementation, then pauses at an approval node before delivery."

**Classification:** Execution Graph

**Reasoning:** The scenario describes the concrete runtime topology and transitions that actually occurred for one execution. The reusable intended process behind it is the Workflow.

## Naming Decision

Brain will use **industry-aligned terminology whenever the industry meaning is sufficiently precise**, while adding explicit Brain boundaries where common usage is ambiguous.

The objective is not to invent proprietary names for established concepts. Terms such as Agent, Tool, Workflow, Eval, MCP, and Guardrail should remain recognizable to engineers working with modern AI systems.

Brain-specific semantics are introduced only where necessary to guarantee architectural separation. In particular:

* **Skill** always means procedural Intelligence, not executable capability.
* **Tool** always means an atomic executable capability.
* **Connector** always means an external-system integration adapter.
* **MCP** always means a standardized interoperability protocol boundary rather than the integration itself.
* **Memory** represents persisted experience-derived continuity or learning.
* **Knowledge** represents curated or compiled reusable understanding.
* **Context Pack** is the bounded context compiled for a particular execution.
* **Workflow** is reusable process definition.
* **Execution Graph** is concrete runtime topology.
* **Quality Contract** declares required rigor.
* **Eval** measures performance.
* **Evidence** is the verifiable observation supporting a claim.

No defect requiring expansion of the 18-term vocabulary was found during S01 authoring. The listed terms can remain non-overlapping when the boundaries above are enforced.
