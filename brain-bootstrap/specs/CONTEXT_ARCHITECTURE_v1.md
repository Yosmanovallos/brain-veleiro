# BRAIN — Context Architecture v1

## 1. Purpose

This document defines what context exists in Brain, how context sources are ordered by authority, how relevant context is retrieved, and how every **Context Pack** is kept bounded.

A Context Pack remains the canonical S01 concept:

> a bounded, task-specific set of information assembled for one execution or decision.

Brain does not treat all available information as active context.

The governing rule is:

> **Context is retrieved, ranked, filtered, and compiled — never indiscriminately stuffed.**

This architecture is tool/provider-agnostic. Concrete storage, memory, session, retrieval, and repository implementations remain behind the Provider/Adapter boundaries defined in S02.

---

# 2. Terminology Decision: Context Pack vs. Context Packet

The canonical Brain vocabulary term is:

```text
Context Pack
```

The bootstrap artifact filename is:

```text
CONTEXT_PACKET.schema.yaml
```

These refer to the same concept.

**Decision:** use **Context Pack** in all prose and conceptual contracts. Retain the literal filename `CONTEXT_PACKET.schema.yaml` for compatibility with the bootstrap step contract.

**Flagged non-blocking naming inconsistency:** the skill uses "Packet" in the filename while S01 uses "Pack" as the canonical term. This does not justify inventing a second concept.

---

# 3. Context Architecture Overview

Brain context is organized into nine canonical layers.

The layers describe **where candidate information comes from and what role it serves**.

They are not an instruction to load all nine layers into every Context Pack.

The Core coordinates final Context Pack composition. Providers retrieve candidate information. Intelligence artifacts define relevant instructions, knowledge, rules, and work-specific semantics.

Canonical layer order:

```text
1. identity
2. user context
3. durable memory
4. project instructions
5. compiled knowledge
6. historical sessions
7. current verified state
8. working context
9. child-agent packet
```

---

# 4. The Nine Context Layers

## 4.1 Layer 1 — identity

### Definition

Stable identity and operating constraints that define **who or what is executing** and the high-level role under which the execution occurs.

### Typical Contents

- agent/role identity;
- objective at the role level;
- permitted responsibility;
- high-level behavioral constraints;
- authority boundaries relevant to the role.

### Architectural Placement

**Spans Intelligence and Core.**

Identity/role definitions originate from Intelligence, while the Core applies them during execution.

### Retrieval Rule

Load only the identity information required for the current execution. Do not duplicate unrelated role documentation.

---

## 4.2 Layer 2 — user context

### Definition

Relevant context explicitly supplied by, or attributable to, the current user/requester for the task.

### Typical Contents

- current request;
- user-stated preferences;
- stakeholder-provided constraints;
- desired outcome;
- explicit clarifications;
- approval decisions.

### Architectural Placement

**Core + ContextProvider source.**

The Core treats user context as an execution input. A ContextProvider or session boundary may retrieve it when continuity is required.

### Retrieval Rule

Prefer current, task-relevant user statements. Do not load unrelated historical user information simply because it exists.

---

## 4.3 Layer 3 — durable memory

### Definition

Persisted experience-derived information retained across Threads, Runs, or sessions because it may improve future continuity or decisions.

### Typical Contents

- previously verified project facts;
- stable learned preferences;
- recurring operational facts;
- prior lessons worth preserving;
- durable decisions that have not yet been promoted to a more authoritative artifact.

### Architectural Placement

**Provider/Adapter via MemoryProvider.**

The persistence/retrieval mechanism is replaceable.

### Retrieval Rule

Retrieve memory only when relevant to the current task. Memory never overrides higher-authority current reality.

---

## 4.4 Layer 4 — project instructions

### Definition

Normative project-level instructions that govern how work in the current project should be performed.

### Typical Contents

- project Rules;
- repository operating instructions;
- project conventions;
- required procedures;
- project-specific constraints;
- approved working policies.

### Architectural Placement

**Intelligence, exposed through context retrieval.**

The instructions themselves are Intelligence artifacts. A ContextProvider may retrieve the relevant subset.

### Retrieval Rule

Load only instructions applicable to the current task, stage, repository area, or role.

---

## 4.5 Layer 5 — compiled knowledge

### Definition

Curated or compiled reusable Knowledge relevant to the current problem, project, architecture, or domain.

### Typical Contents

- architecture knowledge;
- research syntheses;
- documented patterns;
- domain concepts;
- failure modes;
- curated technical knowledge;
- decision-support material.

### Architectural Placement

**Intelligence stored/retrieved through KnowledgeProvider.**

Knowledge remains an Intelligence concept; storage and retrieval are Provider responsibilities.

### Retrieval Rule

Retrieve by task relevance and expected decision value. Do not load a complete wiki or knowledge base into the Context Pack.

---

## 4.6 Layer 6 — historical sessions

### Definition

Prior session or Thread history that may contain useful execution context not already promoted into durable Memory, Knowledge, or a verified Handoff.

### Typical Contents

- prior discussions;
- previous reasoning summaries;
- earlier attempts;
- older operational context;
- unresolved historical notes.

### Architectural Placement

**Provider/Adapter via SessionStore or context/session retrieval boundary.**

### Retrieval Rule

Historical sessions are fallback context, not canonical truth.

Retrieve only the smallest relevant fragments when a current task genuinely depends on past session details.

---

## 4.7 Layer 7 — current verified state

### Definition

The most recent verified operational state of the project or system relevant to the current task.

### Typical Contents

- current repository/runtime observations;
- verified branch/HEAD/status;
- current artifact state;
- verified current configuration;
- current approved Handoff references;
- recent Evidence supporting operational claims.

### Architectural Placement

**Core-owned current state assembled from repository/runtime/provider observations.**

The underlying retrieval may come through repository, execution, session, or context providers.

### Retrieval Rule

Prefer direct current observations over remembered or historical statements.

This layer is expected to be refreshed before relying on it for material decisions.

---

## 4.8 Layer 8 — working context

### Definition

Temporary context created and used during the current Run or bounded task execution.

### Typical Contents

- current hypotheses;
- intermediate reasoning artifacts;
- selected task notes;
- active files or artifact references;
- current subtask state;
- temporary observations not yet promoted to durable state.

### Architectural Placement

**Core / Run lifecycle.**

### Retrieval Rule

Keep it local to the current execution unless an explicit promotion decision moves information into Evidence, Memory, Knowledge, or a Handoff.

Working context should expire when it is no longer required.

---

## 4.9 Layer 9 — child-agent packet

### Definition

A bounded derivative Context Pack prepared for a child/sub-agent or delegated execution.

It contains only the context needed for that delegated objective.

### Typical Contents

- delegated objective;
- relevant constraints;
- selected Evidence references;
- required acceptance criteria;
- relevant Knowledge/Skills references;
- permitted capability references;
- parent Run/context references where needed.

### Architectural Placement

**Core-created derivative context using Intelligence definitions and Provider-retrieved material.**

### Retrieval Rule

Never forward the entire parent conversation or parent Context Pack by default.

The child receives a minimal, purpose-built subset.

This section does not define delegation mechanics; those belong to later steps.

---

# 5. Canonical Authority Order

When context sources disagree, Brain uses this minimum canonical authority order:

```text
1. runtime/repository reality
2. explicit current spec
3. verified current/handoff
4. ADRs
5. project instructions
6. compiled knowledge
7. durable memory
8. historical sessions
9. inference
```

The order must remain stable unless a later explicit architecture decision revises it.

Authority is not the same as recency, confidence, or verbosity.

A lower-authority source does not become authoritative merely because it is newer, longer, or stated confidently.

---

# 6. Authority Levels Explained

## 6.1 1 — runtime/repository reality

Directly observed current system or repository state.

Examples:

- actual file contents;
- current branch/commit;
- current runtime output;
- actual configuration;
- observed behavior;
- direct system state.

This is the highest authority for claims about what the system **currently is or does**.

If runtime/repository reality conflicts with documentation, the conflict must be surfaced rather than silently forcing reality to match documentation.

---

## 6.2 2 — explicit current spec

The currently approved Spec governing what the system **should satisfy**.

The Spec does not override observed reality about what currently exists, but it outranks lower sources when deciding intended behavior or acceptance requirements.

---

## 6.3 3 — verified current/handoff

A verified current-state artifact or Handoff representing the latest confirmed operational frontier.

It is authoritative for continuity unless contradicted by newer direct runtime/repository Evidence or the explicit current Spec.

---

## 6.4 4 — ADRs

Approved Architecture Decision Records describing intentional architectural decisions and their rationale.

ADRs govern architectural intent unless superseded by a newer explicit decision or contradicted by current verified reality requiring review.

---

## 6.5 5 — project instructions

Normative project instructions defining expected working behavior, conventions, or project-local Rules.

They must not override the current Spec or verified reality.

---

## 6.6 6 — compiled knowledge

Curated reusable Knowledge.

It informs reasoning but may be stale, general, or not specific enough to override project-specific current sources.

---

## 6.7 7 — durable memory

Persisted experience-derived facts or learnings.

Memory is useful for continuity, but must be revalidated when it conflicts with more authoritative current sources.

---

## 6.8 8 — historical sessions

Prior discussions or historical execution context.

Historical session text is not canonical current truth.

It may be retrieved to explain why something happened, but it cannot override higher-authority artifacts.

---

## 6.9 9 — inference

A conclusion produced by reasoning when explicit authoritative information is unavailable.

Inference is always the lowest authority.

It must remain distinguishable from VERIFIED or PROVIDED information.

---

# 7. Authority Conflict Resolution

When sources conflict:

1. identify each conflicting claim;
2. assign each source its authority rank;
3. prefer the higher-authority source for the current decision;
4. preserve the conflict if it indicates stale or incorrect lower-authority artifacts;
5. do not silently rewrite history;
6. record revalidation or repair work when needed.

Authority resolution applies to the **claim being decided**, not to an entire source globally.

A single artifact can contain both authoritative and stale claims.

---

# 8. Worked Contradiction Example

Hypothetical scenario:

```text
durable memory:
"The project uses branch develop."

verified Handoff:
"The current branch is release."

runtime/repository reality:
git branch --show-current → main
```

Authority ranking:

```text
runtime/repository reality = rank 1
verified current/handoff   = rank 3
durable memory             = rank 7
```

Result:

```text
current branch = main
status = VERIFIED
```

The Handoff and Memory records remain historically useful but are stale for this claim.

Brain should not delete them silently. It should record that the current repository observation supersedes them for current execution.

---

# 9. Status Vocabulary During Context Resolution

Use the existing status vocabulary:

```text
VERIFIED
PROVIDED
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

Examples:

- direct current repository observation with Evidence → `VERIFIED`;
- current stakeholder instruction not independently checked → `PROVIDED`;
- temporary gap-filling statement → `ASSUMED`;
- suggested architecture interpretation → `PROPOSED`;
- unresolved contradiction without sufficient authority → `UNKNOWN`;
- required context unavailable and progress cannot responsibly continue → `BLOCKED`.

Authority rank and status are related but different.

For example, a highly authoritative source category may still contain a claim that has not been verified in the current Run.

---

# 10. Retrieval Principles

## 10.1 Retrieve by objective

Every retrieval request should begin with:

```text
What decision or execution objective needs context?
```

Candidate context without relevance to that objective should not be retrieved.

---

## 10.2 Retrieve candidates, then compose

Providers retrieve candidate context.

The Core composes the Context Pack.

Conceptually:

```text
ContextProvider / MemoryProvider / KnowledgeProvider / SessionStore
                         ↓
                 candidate context
                         ↓
               relevance filtering
                         ↓
                authority resolution
                         ↓
                 budget filtering
                         ↓
                   Context Pack
```

No Provider owns final composition.

---

## 10.3 Prefer references over duplication

When possible, the Context Pack should carry stable references to:

- Evidence;
- repository artifacts;
- Knowledge artifacts;
- Specs;
- ADRs;
- Handoffs;

rather than copying complete documents.

Inline content should be limited to what is necessary for the current execution.

---

## 10.4 Progressive retrieval

Start with the minimum context likely to solve the task.

Retrieve more only when the current context reveals a specific gap.

Pattern:

```text
minimal context
    ↓
attempt / inspect
    ↓
specific missing information identified
    ↓
targeted retrieval
```

This is preferred over loading a maximum context window in advance.

---

## 10.5 Retrieve high-authority sources first when conflicts matter

When a task depends on current project truth, check higher-authority sources before spending budget on lower-authority history.

Example:

```text
repository reality
before
historical session search
```

when determining current file or branch state.

---

## 10.6 Do not use context size as a proxy for quality

A larger Context Pack is not inherently better.

Extra context can:

- consume token budget;
- hide relevant facts;
- introduce stale contradictions;
- increase model distraction;
- leak unrelated information;
- make delegated execution harder to audit.

The target is **sufficient context**, not maximum context.

---

# 11. Context Budget

## 11.1 Decision

Budget is both:

1. an architectural policy described here; and
2. explicit metadata in `CONTEXT_PACKET.schema.yaml`.

This makes bounded context enforceable and observable rather than aspirational.

---

## 11.2 Budget Dimensions

A Context Pack may be bounded by:

- maximum tokens;
- maximum characters/bytes;
- maximum number of included items;
- optional per-layer caps;
- reserved output/reasoning budget where the execution environment exposes such constraints.

No specific tokenization implementation is required by this architecture.

---

## 11.3 Budget Allocation Principles

Budget should favor:

1. task objective and acceptance criteria;
2. highest-authority current state;
3. applicable project instructions/Rules;
4. directly relevant Evidence;
5. only the Knowledge/Memory/history needed to close current gaps.

Lower-authority and low-relevance context should be removed first when budget pressure occurs.

---

## 11.4 Per-Layer Budgeting

Per-layer caps are optional but supported.

They are useful when one source class could dominate the pack, especially:

- compiled knowledge;
- durable memory;
- historical sessions.

Example policy:

```text
historical sessions:
  retrieve only targeted excerpts

compiled knowledge:
  include selected sections/references only

working context:
  expire stale intermediate material
```

The architecture does not prescribe fixed numeric percentages.

---

## 11.5 Budget Exhaustion

When relevant context exceeds the available budget:

1. remove duplicate information;
2. replace full content with references/summaries when safe;
3. remove lower-authority low-relevance items;
4. split the task if the objective is too broad;
5. perform progressive retrieval;
6. mark `BLOCKED` if essential context cannot fit or cannot be safely summarized.

Do not silently discard essential acceptance criteria or high-authority current state.

---

# 12. Context Pack Composition Procedure

For one execution:

## Step 1 — Define objective

Identify:

- task/decision objective;
- acceptance criteria;
- current Run/Thread;
- applicable Quality Contract.

## Step 2 — Determine needed layers

Select only context layers relevant to the objective.

## Step 3 — Retrieve candidates

Request targeted context from applicable Providers and current project/runtime sources.

## Step 4 — Assign provenance and authority

For each candidate item record:

- source layer;
- authority rank;
- provenance reference;
- status;
- optional Evidence reference.

## Step 5 — Resolve contradictions

Use the canonical authority order.

Preserve unresolved conflicts where higher authority cannot determine the answer.

## Step 6 — Rank relevance

Prefer context that directly affects:

- required action;
- acceptance criteria;
- constraints;
- current state;
- current decision.

## Step 7 — Apply budget

Trim or replace lower-value content until the pack satisfies its budget.

## Step 8 — Freeze for execution

The resulting Context Pack becomes the bounded input for that execution/decision.

If the world changes materially during execution, refresh the affected current-state items rather than assuming the frozen pack remains current.

---

# 13. Context Pack Item Requirements

Each included context item should carry enough metadata to answer:

```text
What is this?
Why is it here?
Which context layer produced it?
What authority rank applies?
Where did it come from?
What status does it have?
What Evidence supports it, if relevant?
How much budget does it consume?
```

This metadata enables later verification of why one conflicting source won over another.

---

# 14. Child-Agent Context Rule

A child-agent packet is a derivative Context Pack.

It should contain only the subset needed for the delegated objective.

Do not forward:

- the entire parent conversation;
- unrelated Memory;
- complete Knowledge bases;
- all repository contents;
- irrelevant project instructions;
- unrelated working context.

A child execution should be able to explain what it received and why.

Delegation mechanics, permissions, and multi-agent orchestration remain out of scope for S05.

---

# 15. Context Promotion

Information can move between layers only through explicit lifecycle actions.

Examples:

```text
working observation
→ Evidence

verified repeated fact
→ durable memory

architectural decision
→ ADR

reusable researched understanding
→ compiled knowledge

verified current frontier
→ Handoff
```

This document does not define the Handoff template or MemoryProvider adapter.

It only establishes that context should not become durable merely because it appeared in a conversation.

---

# 16. Failure Modes

The Context Architecture explicitly guards against:

### Context stuffing

Loading entire conversations, repositories, wikis, or Skills without task relevance.

### Stale-memory override

Allowing durable Memory to override current repository/runtime truth.

### Recency-only authority

Assuming the newest source is automatically correct.

### Confidence-only authority

Allowing confident inference to override explicit verified state.

### Provider-owned composition

Letting a MemoryProvider, KnowledgeProvider, or other retrieval implementation decide the final task context.

### Child-context leakage

Forwarding full parent context to delegated execution.

### Untraceable context

Including a claim without provenance, source layer, or status.

---

# 17. Context Architecture Definition of Done

S05 context architecture is structurally satisfied when:

- all nine canonical context layers are preserved in order;
- all nine canonical authority levels are preserved in order;
- Context Pack remains a Core concept;
- candidate retrieval remains a Provider responsibility;
- final composition remains Core-owned;
- contradiction resolution can be explained by authority rank;
- every pack can be bounded by explicit budget metadata/policy;
- low-value history is not loaded by default;
- child context can be derived without copying full parent history;
- no concrete vendor or storage implementation is required.
