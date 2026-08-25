# BRAIN — Spec-Driven Development Contract

## 1. Purpose

This contract defines how Brain transforms an ambiguous human request into verifiable work without prematurely selecting architecture, technology, implementation, or agent behavior.

The canonical flow is:

```text
RAW REQUEST
    ↓
DISCOVERY
    ↓
KNOWLEDGE GAPS
    ↓
QUALITY CONTRACT
    ↓
RESEARCH
    ↓
SPEC
    ↓
HUMAN APPROVAL
    ↓
ARCHITECTURE
    ↓
AGENT DESIGN IF NEEDED
    ↓
PLAN
    ↓
TASK COMPILATION
    ↓
BUILD
    ↓
QA
    ↓
VERIFY
    ↓
DELIVER
```

This pipeline is **domain-agnostic**.

No stage assumes:

- a programming language;
- a framework;
- a database;
- a deployment platform;
- a user-interface type;
- an AI model;
- that AI Agents are required;
- that the requested outcome is even software.

Technology and implementation choices may only appear after sufficient problem understanding establishes that they are relevant.

## 2. Pipeline Invariants

### 2.1 Preserve the original request

The RAW REQUEST is preserved as received.

Later artifacts may interpret or refine it, but must never silently overwrite what the requester originally asked for.

### 2.2 Separate facts from assumptions

Information must be distinguishable as:

- **VERIFIED** — supported by Evidence;
- **PROVIDED** — explicitly stated by an authoritative stakeholder but not independently verified;
- **ASSUMED** — temporarily accepted because required information is unavailable;
- **PROPOSED** — suggested by Brain and not yet accepted;
- **UNKNOWN** — unresolved and not safe to assume;
- **BLOCKED** — required information or capability prevents responsible continuation.

### 2.3 Research is question-driven

Research exists to close **Knowledge Gaps that can materially change a decision**.

Research must not become open-ended exploration merely because more information can be found.

### 2.4 Evidence precedes confidence

Relevant claims should retain enough information to assess:

- source;
- recency or validity;
- confidence;
- limitations.

An Agent assertion alone is not Evidence.

### 2.5 Spec precedes non-trivial implementation

Non-trivial work must not enter BUILD without an accepted Spec.

Small deterministic changes may use a proportionally lightweight Spec, but the acceptance condition must still be explicit.

### 2.6 Reduce scope before reducing verifiability

When time, token, cost, or execution budgets become constrained:

```text
reduce optional scope
before
removing essential verification
```

A smaller verified result is preferable to a larger unverified result.

### 2.7 Failed gates return to the owning stage

The pipeline is ordered but not strictly one-way.

If a later stage discovers missing information, work returns to the earliest stage responsible for resolving it.

Example:

```text
ARCHITECTURE
    ↓
discovers business ambiguity
    ↓
DISCOVERY
```

or:

```text
VERIFY
    ↓
requirement not satisfied
    ↓
PLAN / BUILD
```

The canonical stages remain unchanged; the execution may revisit them.

## 3. Canonical Stages

### Stage 1 — RAW REQUEST

**Purpose**

Capture the request exactly as provided before interpretation, decomposition, architecture, or implementation begins.

**Inputs**

- original client/user request;
- attached artifacts explicitly supplied with the request;
- known requester identity or authority when available.

**Outputs**

A preserved request record containing:

- original wording;
- source;
- received time if available;
- supplied artifacts;
- explicitly stated constraints.

**Advance Criteria**

Proceed to DISCOVERY when:

- the original request has been preserved;
- no interpretation has silently replaced the original request.

No requirement for completeness exists at this stage.

### Stage 2 — DISCOVERY

**Purpose**

Understand the real problem, desired outcome, stakeholders, constraints, boundaries, and unresolved questions before proposing a solution.

DISCOVERY asks primarily:

> **What problem are we actually trying to solve, for whom, and what would success look like?**

**Inputs**

- RAW REQUEST;
- requester-provided context;
- existing relevant business or project information when available.

**Outputs**

A Discovery artifact containing at minimum:

- problem statement;
- desired outcome;
- stakeholders/users;
- current state when known;
- desired future state;
- known constraints;
- known facts;
- explicit unknowns;
- initial non-goals;
- initial acceptance-criteria sketch;
- questions requiring stakeholder clarification.

**Advance Criteria**

Proceed to KNOWLEDGE GAPS when:

- the business/problem objective is understandable;
- critical ambiguity has been identified rather than silently assumed;
- stakeholders or decision owners are identified where relevant;
- unknowns are explicit.

If the objective itself cannot yet be understood, remain in DISCOVERY.

### Stage 3 — KNOWLEDGE GAPS

**Purpose**

Determine what Brain must learn before responsible specification or design can continue.

A Knowledge Gap is not merely something Brain does not know.

It is missing information whose answer **could materially change requirements, risk, architecture, scope, or feasibility**.

**Inputs**

- Discovery artifact;
- known project/domain context;
- existing Knowledge;
- known constraints.

**Outputs**

A prioritized set of questions classified by relevance, such as:

- stakeholder clarification required;
- repository/system inspection required;
- domain research required;
- technical research required;
- legal/security/compliance clarification required where applicable;
- information currently unknowable.

Each material gap should state:

- question;
- why it matters;
- decision affected;
- preferred evidence source;
- consequence if unresolved.

**Advance Criteria**

Proceed to QUALITY CONTRACT when:

- decision-changing unknowns have been identified;
- trivial curiosity has been separated from decision-relevant gaps;
- unresolved gaps are explicit.

Research does not begin merely because a topic is interesting.

### Stage 4 — QUALITY CONTRACT

**Purpose**

Establish how rigorous and well-supported the work must be before acceptance.

This stage creates or selects the applicable **Quality Contract**.

The detailed Quality Contract model is defined separately in S04 and is intentionally not specified here.

**Inputs**

- Discovery;
- Knowledge Gaps;
- known risk;
- ambiguity;
- consequence of failure;
- available time/resource constraints.

**Outputs**

A reference to the applicable Quality Contract or quality level for the work.

**Advance Criteria**

Proceed to RESEARCH when:

- required rigor has been identified;
- research and later verification can determine what standard must be met.

This stage must not invent the S04 Quality Contract schema.

### Stage 5 — RESEARCH

**Purpose**

Resolve the prioritized Knowledge Gaps using evidence appropriate to the applicable Quality Contract.

Research should seek not just supporting information, but also:

- competing explanations;
- alternatives;
- limitations;
- failure modes;
- contradictory evidence when material.

**Inputs**

- prioritized Knowledge Gaps;
- applicable Quality Contract;
- existing Knowledge;
- available research capabilities.

**Outputs**

Research findings containing, where applicable:

- claim;
- Evidence/source;
- recency or validity;
- confidence;
- limitation;
- contradictions;
- remaining unknowns;
- decision relevance.

**Advance Criteria**

Proceed to SPEC when:

- all high-priority Knowledge Gaps required for specification are resolved, explicitly assumed, or explicitly marked unresolved;
- remaining uncertainty is visible;
- no material conclusion depends solely on unsupported model assertion.

If research reveals new decision-critical gaps, return to KNOWLEDGE GAPS.

### Stage 6 — SPEC

**Purpose**

Translate the approved understanding of the problem into an implementation-independent statement of what must be achieved.

A Spec defines **what success means**.

It does not prematurely define how implementation must work unless a technical constraint is itself a confirmed requirement.

**Inputs**

- RAW REQUEST;
- Discovery;
- validated research findings;
- approved assumptions;
- known constraints;
- applicable Quality Contract reference.

**Outputs**

A formal Spec containing at minimum:

- objective;
- functional or behavioral requirements;
- non-functional requirements when relevant;
- explicit non-goals;
- constraints;
- assumptions still in force;
- open questions;
- acceptance criteria;
- Quality Contract reference.

**Advance Criteria**

Proceed to HUMAN APPROVAL when:

- every material requirement is explicit;
- acceptance criteria are testable or otherwise verifiable;
- unknowns are visible;
- assumptions are visible;
- architecture has not been silently embedded without justification.

### Stage 7 — HUMAN APPROVAL

**Purpose**

Confirm that Brain is solving the correct problem before expensive design or implementation begins.

**Approver**

The approver must be the accountable decision owner identified during Discovery.

Depending on the situation this may be:

- the requester;
- the client;
- a product owner;
- another explicitly delegated stakeholder with authority.

Brain must not silently designate itself as the business approver.

**Inputs**

- Spec;
- unresolved assumptions;
- material unknowns;
- Quality Contract reference.

**Outputs**

One of:

```text
APPROVED
APPROVED_WITH_EXPLICIT_ASSUMPTIONS
CHANGES_REQUIRED
BLOCKED
```

Approval should be attributable to the approving authority.

**Advance Criteria**

Proceed to ARCHITECTURE only when:

```text
APPROVED
or
APPROVED_WITH_EXPLICIT_ASSUMPTIONS
```

If:

```text
CHANGES_REQUIRED
```

return to the earliest affected stage.

If approval cannot be obtained and approval is required, status is BLOCKED.

For constrained environments such as a timed exercise where no stakeholder is available, an explicitly documented authorized assumption mode may be used only if the governing Rules permit it.

### Stage 8 — ARCHITECTURE

**Purpose**

Determine the simplest appropriate system structure capable of satisfying the approved Spec and Quality Contract.

Architecture should compare viable alternatives rather than automatically selecting familiar technology.

**Inputs**

- approved Spec;
- constraints;
- relevant Knowledge;
- relevant research;
- existing system/project reality if applicable.

**Outputs**

Architecture decision(s) containing:

- system responsibilities;
- boundaries;
- major data/control flows where relevant;
- alternatives considered;
- trade-offs;
- risks;
- rejected alternatives and why;
- unresolved architecture questions;
- resulting decisions.

Implementation technology may be proposed here only when justified by requirements and evidence.

**Advance Criteria**

Proceed to AGENT DESIGN IF NEEDED when:

- architecture satisfies the Spec conceptually;
- major trade-offs are explicit;
- no critical architectural decision depends on an unresolved hidden assumption.

### Stage 9 — AGENT DESIGN IF NEEDED

**Purpose**

Determine whether any responsibility actually requires an Agent and, only when justified, design that Agent in a later appropriate contract.

This stage is **conditional**.

**Agent Needed When**

An Agent may be justified when the responsibility materially benefits from one or more of:

- dynamic decision-making based on changing observations;
- non-deterministic reasoning;
- flexible Tool selection;
- iterative observe → decide → act behavior;
- adaptation when the next action cannot be completely predetermined;
- open-ended analysis within bounded goals;
- autonomous or semi-autonomous operation that still requires policies, permissions, budgets, or termination criteria.

**Agent Not Needed When**

Do not introduce an Agent when the requirement is better represented as:

- deterministic application logic;
- a fixed transformation;
- a predictable script;
- a standard API operation;
- a deterministic workflow;
- a scheduled job with predetermined behavior;
- a normal user-interface interaction.

The governing principle is:

> **Use an Agent because adaptive reasoning is required, not because the system contains AI.**

**Inputs**

- approved architecture;
- Spec;
- Quality Contract reference;
- identified responsibilities.

**Outputs**

Either:

```text
AGENT_NOT_REQUIRED
```

with reasoning,

or:

```text
AGENT_DESIGN_REQUIRED
```

with identified Agent responsibility and a handoff to the later AgentDefinition/design process.

The concrete AgentDefinition schema is intentionally out of scope for S03.

**Advance Criteria**

Proceed to PLAN when:

- every proposed Agent has explicit justification;
- responsibilities that do not require agents remain deterministic;
- agent design needs are identified without prematurely designing the S10 schema.

### Stage 10 — PLAN

**Purpose**

Convert the approved Spec and Architecture into an ordered implementation strategy.

The Plan describes how work will be incrementally delivered and verified.

**Inputs**

- approved Spec;
- architecture decisions;
- agent-design decision where applicable;
- known constraints;
- Quality Contract reference.

**Outputs**

A prioritized Plan containing:

- milestones or increments;
- dependencies;
- task boundaries;
- verification points;
- highest-risk assumptions;
- optional vs required scope;
- stop/de-scope rules when constrained by time/resources.

Where appropriate:

```text
P0 = required for minimum successful outcome
P1 = valuable after P0
P2 = optional if budget remains
```

**Advance Criteria**

Proceed to TASK COMPILATION when:

- the first executable increment is clear;
- dependencies are understood;
- every implementation task can eventually map back to requirements or acceptance criteria.

### Stage 11 — TASK COMPILATION

**Purpose**

Transform one Plan item into a bounded execution package suitable for the responsible builder or Agent.

Task Compilation is more than prompt generation.

It assembles the minimum information required to execute one task correctly.

**Inputs**

- one Plan item;
- relevant Spec requirements;
- acceptance criteria;
- constraints;
- applicable Rules;
- relevant Knowledge;
- relevant Skills;
- applicable quality requirements;
- allowed capabilities;
- relevant project state.

**Outputs**

A task execution package containing, conceptually:

- objective;
- scope;
- relevant context;
- constraints;
- required capabilities;
- expected output;
- acceptance criteria;
- Evidence requirements;
- stop condition.

The concrete Task Compiler design is deferred to its later bootstrap step.

**Advance Criteria**

Proceed to BUILD when:

- the execution package is bounded;
- the builder knows what must change or be produced;
- acceptance and Evidence expectations are explicit;
- irrelevant context has not been indiscriminately included.

### Stage 12 — BUILD

**Purpose**

Produce the smallest implementation or artifact that satisfies the current task execution package.

**Inputs**

- task execution package;
- approved capabilities;
- relevant execution environment.

**Outputs**

One or more implementation artifacts plus execution observations.

Examples of artifact types may include:

- code;
- configuration;
- documents;
- data transformations;
- tests;
- generated structured assets.

The contract does not assume a particular artifact type.

**Advance Criteria**

Proceed to QA when:

- the task's intended implementation is complete enough to test;
- the builder has not substituted self-assertion for verification;
- relevant artifacts can be independently inspected.

If BUILD discovers specification ambiguity, return to the appropriate earlier stage.

### Stage 13 — QA

**Purpose**

Execute applicable deterministic and procedural checks against the implementation before semantic verification.

QA asks:

> **Does the artifact behave correctly according to directly testable checks?**

**Inputs**

- implementation artifacts;
- acceptance criteria;
- relevant Rules;
- test/check capabilities.

**Outputs**

QA Evidence such as:

- test results;
- validation output;
- static checks;
- build results;
- reproducible failures;
- relevant runtime observations.

**Advance Criteria**

Proceed to VERIFY when:

- required QA checks have executed;
- failures are resolved or explicitly documented as blocking;
- QA Evidence is available.

A builder's statement that checks passed is not sufficient.

### Stage 14 — VERIFY

**Purpose**

Independently determine whether the delivered candidate actually satisfies the approved Spec and applicable Quality Contract.

VERIFY is broader than QA.

QA may show that tests pass.

VERIFY asks:

> **Did we build the right thing, to the required standard, with sufficient Evidence?**

**Inputs**

- approved Spec;
- acceptance criteria;
- Quality Contract reference;
- implementation;
- QA Evidence;
- relevant architecture decisions.

**Outputs**

A verification result:

```text
PASS
FAIL
BLOCKED
```

with Evidence and findings mapped to requirements or acceptance criteria.

**Advance Criteria**

Proceed to DELIVER only on:

```text
PASS
```

On FAIL, return work to the earliest responsible stage.

On BLOCKED, do not silently downgrade verification requirements.

### Stage 15 — DELIVER

**Purpose**

Transfer the verified result to its intended recipient in a form that can be used, reviewed, demonstrated, operated, or continued.

**Inputs**

- verified artifact;
- PASS verification result;
- relevant documentation;
- known limitations;
- remaining risks.

**Outputs**

Delivery package appropriate to the work, containing when relevant:

- resulting artifact;
- usage or execution instructions;
- verification summary;
- architecture or decision references;
- known limitations;
- remaining risks;
- deferred scope;
- next actions.

**Completion Criteria**

DELIVER is complete when:

- the intended recipient can access or use the result;
- verification status is visible;
- material limitations are disclosed;
- unfinished work is not represented as completed.

## 4. Domain-Agnostic Design Rule

The pipeline defines **decision responsibilities**, not technology.

For example:

```text
ARCHITECTURE
```

means:

> determine the appropriate structural solution.

It does not mean:

> choose a particular frontend/backend/database architecture.

Similarly:

```text
BUILD
```

means:

> produce the artifact required by the Spec.

It does not mean:

> write application code.

This allows the same pipeline to govern:

- software;
- research;
- automation;
- data work;
- AI systems;
- documentation;
- operational processes;
- other structured problem-solving work.

## 5. Pipeline Completion Invariant

A completed Brain execution should provide a traceable relationship:

```text
RAW REQUEST
     ↓
understood through DISCOVERY
     ↓
formalized in SPEC
     ↓
approved by HUMAN APPROVAL
     ↓
implemented according to PLAN
     ↓
supported by QA EVIDENCE
     ↓
independently VERIFIED
     ↓
DELIVERED
```

The objective is not merely to produce an artifact.

The objective is to produce an artifact whose relationship to the original problem can be explained and verified.
