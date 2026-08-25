# BRAIN — MemoryProvider Contract

## 1. Purpose

`MemoryProvider` defines the replaceable boundary through which Brain persists and retrieves experience-derived Memory across Threads, Runs, and sessions.

The contract exists so that Brain Core can use Memory without depending on:

- a concrete memory product;
- a particular storage engine;
- a particular session database;
- a vendor-specific API;
- an SDK;
- a hosted service;
- a local implementation.

The governing dependency remains:

```text
Brain Core
    ↓
MemoryProvider contract
    ↓
replaceable adapter
    ↓
concrete memory/session implementation
```

Hermes Agent by Nous Research is the currently identified target candidate for the first real adapter, but this contract does not depend on Hermes-specific APIs or data structures.

---

# 2. Canonical Responsibilities

A conforming `MemoryProvider` is responsible for:

1. retrieving relevant durable Memory;
2. accepting potential Memory as candidates without automatically making it permanent;
3. committing Memory only after the required promotion criteria are satisfied;
4. searching historical session information on demand;
5. degrading safely when the provider is disabled or unavailable;
6. keeping provider-specific behavior outside Brain Core.

It is not responsible for:

- deciding final Context Pack composition;
- replacing Handoff;
- replacing Thread or Run lifecycle;
- storing all temporary working context;
- curating reusable domain Knowledge;
- deciding business truth;
- overriding higher-authority repository/runtime state.

---

# 3. Canonical Methods

The following method names are mandatory and must remain unchanged:

```text
retrieve()
remember_candidate()
commit_verified_memory()
search_history()
```

Concrete signatures may be expressed differently by different languages/runtimes, but their semantics must remain compatible with this contract.

---

## 3.1 `retrieve()`

### Purpose

Retrieve durable Memory relevant to the current bounded objective.

This operation supports selective continuity without injecting the entire Memory store into active context.

### Conceptual Inputs

A request may include:

- current objective/query;
- relevant project/user scope;
- Thread/Run reference where useful;
- maximum result count or context budget;
- optional category/tags;
- minimum relevance threshold;
- authority/freshness constraints when applicable.

The exact serialization belongs to later implementation work.

### Conceptual Output

A normalized result containing:

- zero or more relevant Memory records;
- provenance/reference for each result;
- Memory status;
- relevance information;
- freshness/revalidation metadata where available;
- provider availability state.

The method returns candidates to the Context lifecycle.

It does **not** decide which retrieved Memory items enter the final Context Pack.

### Required Behavior

`retrieve()` must:

- return only relevant durable Memory;
- respect a bounded retrieval request;
- avoid returning full historical sessions by default;
- expose enough provenance for revalidation;
- preserve the rule that durable Memory has lower authority than runtime reality, current Spec, verified Handoff, ADRs, project instructions, and compiled Knowledge.

### Disabled / Unavailable Behavior

If the provider is optional and disabled or unavailable:

```text
retrieve()
→ empty result
+ provider status = DISABLED or UNAVAILABLE
```

It must not crash Brain Core merely because no Memory adapter is available.

If the active Workflow explicitly requires persistent Memory to satisfy its acceptance criteria, the Workflow/policy layer may decide that the overall task is `BLOCKED`.

That decision is outside the provider itself.

---

## 3.2 `remember_candidate()`

### Purpose

Record that a piece of information **may deserve promotion** to durable Memory.

This operation creates or records a candidate.

It does not automatically make the information permanent.

### Conceptual Inputs

A candidate should carry, at minimum:

- candidate statement/content;
- origin/provenance;
- source Thread/Run/session reference when relevant;
- current status;
- reason it may be worth remembering;
- category/scope;
- Evidence reference when available;
- expected future usefulness;
- known limitations;
- sensitivity classification when relevant.

### Conceptual Output

A normalized result containing:

- candidate identifier/reference;
- candidate state;
- whether it was accepted for evaluation;
- whether it was rejected as obviously ineligible;
- provider availability status.

### Candidate Eligibility

A candidate may be recorded for evaluation when it appears to have future continuity value, such as:

- a stable verified project fact;
- a recurring operational fact;
- a durable user preference;
- a reusable learned constraint;
- a repeated lesson from execution;
- a persistent environment fact worth reusing.

### Information That Must Not Be Automatically Promoted

Examples include:

- temporary scratch reasoning;
- one-off task notes;
- transient command output with no durable value;
- ephemeral timestamps with no future relevance;
- temporary failures that have already been resolved;
- speculative inference;
- unverified architectural guesses;
- conversation filler;
- duplicated facts already represented canonically elsewhere;
- secret values or credentials;
- large transcript fragments merely because they are available.

### Status Rule

`remember_candidate()` may accept information that is not yet `VERIFIED`.

That is the point of the candidate stage.

However:

```text
candidate
≠
durable committed Memory
```

A candidate's unverified status must remain explicit.

### Disabled / Unavailable Behavior

If Memory is disabled/unavailable:

```text
remember_candidate()
→ NOT_PERSISTED
+ provider status
```

The call must not falsely report persistence.

Brain Core continues unless the current task explicitly requires durable persistence.

---

## 3.3 `commit_verified_memory()`

### Purpose

Promote an eligible Memory candidate into durable Memory after explicit promotion criteria are satisfied.

This method is the only canonical operation in this contract that represents durable promotion.

### Conceptual Inputs

Promotion should include:

- candidate reference or normalized Memory content;
- promotion reason;
- verification/authority status;
- Evidence or authoritative source reference;
- scope;
- revalidation policy when appropriate;
- supersession relationship when replacing older Memory.

### Promotion Criteria

A Memory item may be durably committed only when all applicable conditions are satisfied:

1. **Future value**  
   The information is likely to improve continuity or future decisions.

2. **Stability**  
   The information is not merely temporary working state.

3. **Non-duplication**  
   Equivalent canonical information is not already represented unnecessarily.

4. **Appropriate authority**  
   The information does not attempt to override a more authoritative source class.

5. **Verification / authority requirement**  
   Permanent promotion has an explicit basis.

6. **Sensitivity check**  
   Secrets/credentials and inappropriate sensitive material are excluded.

7. **Boundedness**  
   Promoting the item does not turn durable Memory into an indiscriminate history dump.

### Verification Semantics

The canonical Brain statuses remain:

```text
VERIFIED
PROVIDED
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

Normal durable promotion requires `VERIFIED`.

A `PROVIDED` item may qualify when the provider of the information is itself the appropriate authority for that fact, for example an explicitly stated stable user preference, and the promotion record preserves that provenance rather than falsely relabeling it as independently `VERIFIED`.

The following must not be durably promoted as established Memory:

```text
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

unless a later lifecycle action supplies sufficient Evidence/authority and changes its status appropriately.

### Revalidation

Durable Memory may carry a revalidation trigger.

Examples:

- repository state changes;
- newer authoritative information appears;
- an expiration date is reached;
- a referenced artifact changes.

Durable Memory is not immutable truth.

### Disabled / Unavailable Behavior

If no provider is active:

```text
commit_verified_memory()
→ NOT_PERSISTED
+ provider status
```

The system must never silently claim success.

Whether the current operation can continue is determined by the governing Workflow/Quality Contract, not by the adapter.

---

## 3.4 `search_history()`

### Purpose

Search historical session/conversation information that is not expected to live in hot durable Memory.

This operation implements:

> history retrievable on demand.

It must not preload history into every Context Pack.

### Conceptual Inputs

A history request may include:

- search query;
- project/user/session scope;
- time window;
- result limit;
- Thread/session filters;
- paging/continuation information.

### Conceptual Output

A normalized bounded result containing:

- matching historical excerpts or references;
- originating session/Thread identifiers;
- timestamps/freshness metadata;
- provenance;
- provider availability state.

### Required Behavior

`search_history()` must:

- operate on demand;
- return bounded results;
- preserve enough provenance to inspect original history;
- keep historical context distinguishable from durable Memory;
- avoid promoting search results into Memory automatically.

Finding a historical fact does not automatically make it current truth.

It must be evaluated through Brain's authority and Evidence rules.

### Disabled / Unavailable Behavior

If the provider/history capability is disabled or unavailable:

```text
search_history()
→ empty result
+ provider status = DISABLED or UNAVAILABLE
```

Brain Core must remain operable.

If the requested task fundamentally requires inaccessible history, the higher-level Workflow may return `BLOCKED`.

---

# 4. Provider Availability Model

Brain must distinguish:

```text
AVAILABLE
DISABLED
UNAVAILABLE
DEGRADED
```

A provider failure must be observable without automatically becoming a Core failure.

General rule:

```text
optional memory unavailable
→ degrade safely

required memory unavailable
→ higher-level policy/workflow may BLOCK
```

The provider does not decide whether the business task is allowed to continue.

---

# 5. Governing Rule 1 — Durable Memory Stays Small

"Small" is a policy property, not a universal fixed number.

A conforming implementation must support Brain in keeping durable Memory selective.

Durable Memory should contain information that is:

- stable enough to reuse;
- useful across sessions;
- materially valuable to future execution;
- difficult or wasteful to rediscover repeatedly.

It should not become a transcript mirror.

### Checkable Criteria

A Memory implementation satisfies this rule when Brain can:

- bound retrieved Memory;
- reject ineligible candidates;
- consolidate or supersede redundant items;
- avoid automatic persistence of every interaction;
- distinguish Memory from History;
- keep full historical sessions outside the hot durable Memory set.

---

# 6. Governing Rule 2 — History Is Retrieved On Demand

Historical sessions are not active context by default.

A conforming implementation must permit Brain to:

```text
retrieve small durable Memory
```

without simultaneously loading:

```text
all historical sessions
```

and separately invoke:

```text
search_history()
```

when a specific historical Knowledge Gap exists.

### Checkable Criteria

- normal Memory retrieval does not require loading full history;
- history queries are explicit;
- results are bounded;
- historical provenance is retained.

---

# 7. Governing Rule 3 — Irrelevant Temporariness Is Not Durable Memory

Temporary information should expire with Working Context unless it acquires durable value.

Do not persist merely because something happened.

Examples normally excluded:

- transient intermediate reasoning;
- one-time debug output;
- temporary file names;
- short-lived task state;
- stale local observations;
- resolved temporary errors;
- low-value conversational details.

### Exception

A seemingly temporary event may become durable if it reveals a reusable lesson.

Example conceptually:

```text
temporary failure
→ reveals stable environment constraint
→ stable constraint becomes candidate Memory
```

The durable Memory is the reusable lesson, not necessarily the raw temporary event.

---

# 8. Governing Rule 4 — Permanent Memory Requires Explicit Promotion Criteria

Durable Memory is never an automatic side effect of conversation.

Canonical lifecycle:

```text
observation / interaction
        ↓
remember_candidate()
        ↓
evaluate future value + stability + authority + Evidence
        ↓
commit_verified_memory()
        ↓
durable Memory
```

Promotion must be auditable.

A real adapter must make it possible to determine:

- what was committed;
- why it was committed;
- which source/Evidence justified it;
- when it was committed;
- whether it superseded older Memory.

---

# 9. Governing Rule 5 — Provider Must Be Substitutable

Brain Core knows only `MemoryProvider`.

It must not require provider-specific:

- classes;
- SDK types;
- API methods;
- authentication concepts;
- storage paths;
- query syntax;
- database schemas.

The substitution invariant is:

```text
MemoryProvider implementation A
            ↓ swap
MemoryProvider implementation B

Brain Core contract = unchanged
```

Provider-specific features may exist behind an adapter, but they may not redefine the canonical Brain Memory semantics.

---

# 10. Relationship to Other Brain Concepts

## 10.1 Memory vs. Knowledge

**Memory**

- originates primarily from experience/history;
- supports continuity;
- may derive from prior Runs, interactions, observations, or learned operational facts.

**Knowledge**

- is curated/compiled reusable understanding;
- belongs to Intelligence;
- is not merely historical experience.

A durable architectural pattern may eventually be promoted into curated Knowledge rather than remaining only Memory.

---

## 10.2 Memory vs. Handoff

**Handoff**

- transfers the verified current operational frontier across an execution/session boundary;
- is concise and task-continuity oriented;
- has higher context authority than durable Memory.

**Memory**

- is broader and longer-lived;
- may cross Threads;
- does not replace the current Handoff.

A new session should read/verify its Handoff independently even when Memory exists.

---

## 10.3 Memory vs. Thread

A Thread is a logical continuity boundary for related work.

Memory can outlive a Thread.

Memory retrieval may use Thread references for relevance, but durable Memory is not owned exclusively by one Thread unless scope policy explicitly says so.

---

## 10.4 Memory vs. Run

A Run is one bounded execution occurrence.

A Run may:

- produce candidate Memory;
- provide Evidence for promotion;
- retrieve previously committed Memory.

Memory persists independently from a single Run.

---

## 10.5 Memory vs. Historical Sessions

Historical sessions preserve prior conversational/execution history.

Durable Memory contains only selected experience-derived information worth carrying forward.

Canonical distinction:

```text
important recurring fact
→ durable Memory

specific thing discussed weeks ago
→ search_history()
```

---

# 11. Relationship to Context Authority

Durable Memory remains authority rank 7 in Brain's canonical Context Authority order:

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

Therefore:

```text
Memory says X
repository reality says Y
→ Y wins for current repository truth
```

A MemoryProvider must expose provenance/revalidation metadata sufficient for Brain to detect and correct stale Memory.

---

# 12. Relationship to Context Pack

`MemoryProvider.retrieve()` returns candidate context.

It does not compose the Context Pack.

The established split remains:

```text
MemoryProvider
   ↓
candidate Memory
   ↓
Core Context Lifecycle
   ↓
authority + relevance + budget
   ↓
Context Pack
```

No adapter may bypass this boundary by treating all Memory as mandatory prompt context.

---

# 13. Relationship to Session Continuity

S06 already defines:

- `CURRENT.md`;
- Handoff artifacts;
- Session Boot;
- Session Close.

`MemoryProvider` supplements that continuity model.

It does not replace it.

A conforming Brain session can continue from:

```text
project context
+
CURRENT
+
verified Handoff
```

even if MemoryProvider is disabled.

Memory improves long-term continuity and recall; it is not the sole mechanism keeping Brain operational.

---

# 14. Candidate Memory Lifecycle

Conceptually:

```text
OBSERVED
   ↓
candidate worth preserving?
   ├─ no → discard with working context
   └─ yes
        ↓
remember_candidate()
        ↓
verification / authority / future-value check
        ├─ reject → do not promote
        └─ pass
             ↓
commit_verified_memory()
             ↓
durable Memory
             ↓
later revalidation / supersession if needed
```

This lifecycle is semantic.

The concrete storage mechanics belong to the adapter.

---

# 15. Error and Fallback Contract

Provider-specific errors must be normalized into Brain-meaningful availability/result states.

A disabled or unavailable provider must not throw unrecoverable provider-specific assumptions into Brain Core.

Minimum conceptual outcomes:

```text
SUCCESS
EMPTY
NOT_PERSISTED
DISABLED
UNAVAILABLE
DEGRADED
INVALID_REQUEST
```

Exact language/runtime result types are deferred to implementation.

### Core Safety Rule

No fallback may falsely claim:

```text
Memory persisted
```

when no persistence occurred.

No fallback may silently substitute:

```text
historical inference
```

for verified Memory.

---

# 16. Security and Sensitive Information

Memory persistence increases exposure duration.

Therefore candidate/promotion policy must prevent accidental durable storage of:

- passwords;
- access tokens;
- private keys;
- raw secret values;
- credentials;
- other material prohibited by project security Rules.

A provider implementation may add further security controls, but Brain's semantic contract already requires that inappropriate secret material not be promoted to durable Memory.

---

# 17. Substitution Test

Named products in this section are illustrative implementation candidates only.

The first intended concrete candidate is currently:

```text
Hermes Agent by Nous Research
```

The Brain Core still depends only on:

```text
MemoryProvider
```

Test:

```text
Brain Core
    ↓
MemoryProvider
    ↓
Adapter A
```

Replace with:

```text
Brain Core
    ↓
MemoryProvider
    ↓
Adapter B
```

The following must remain unchanged:

- Memory definition;
- Context Authority order;
- Context Pack semantics;
- Handoff semantics;
- Thread semantics;
- Run semantics;
- Knowledge definition;
- the four canonical MemoryProvider methods.

If replacing a concrete adapter requires changing these Brain concepts, the adapter boundary has leaked and the contract test fails.

---

# 18. Disabled-Adapter Test

S07 requires Brain to operate when the concrete Memory adapter is disabled.

Conceptual scenario:

```text
MemoryProvider adapter = DISABLED
```

Expected behavior:

```text
retrieve()
→ empty + DISABLED

remember_candidate()
→ NOT_PERSISTED + DISABLED

commit_verified_memory()
→ NOT_PERSISTED + DISABLED

search_history()
→ empty + DISABLED
```

Brain Core remains operational.

A higher-level Workflow may become `BLOCKED` only if its explicit requirements depend on durable Memory/history.

This distinction is mandatory.

---

# 19. Contract Acceptance Criteria

A concrete implementation conforms only when contract tests can demonstrate:

1. a verified durable fact can be committed;
2. a new session can retrieve that fact;
3. historical information not stored in hot durable Memory can be found through `search_history()`;
4. temporary/irrelevant information is not automatically promoted;
5. Memory never overrides higher-authority current reality;
6. the provider can be disabled without crashing Brain Core;
7. disabled persistence never falsely reports success;
8. replacing the adapter does not require Core contract changes.

The implementation of these tests belongs to S07 Part B.

---

# 20. Open Decisions for S07 Part B

The product identity is now known:

```text
Hermes Agent by Nous Research
```

The following technical decisions are still open and must be resolved from real current Hermes Agent capabilities before implementation:

1. Which supported programmatic interface will Brain use to communicate with Hermes Agent?
2. Which Hermes Agent version/release is the integration target?
3. Which documented Hermes capability maps to durable-memory read/write?
4. Which documented capability maps to historical session search?
5. Which supported interface exposes enough provenance/identifier data for Brain's contract?
6. How does the chosen Hermes surface report disabled/unavailable/degraded behavior?
7. What process owns Hermes lifecycle during Brain execution?
8. Which configuration values are required?
9. Which credentials, if any, are required for the chosen integration boundary?
10. How should a clean test environment isolate Hermes state?
11. What current Hermes limitations could prevent one of the four Brain MemoryProvider methods from being implemented faithfully?
12. Which Hermes behaviors are stable/public contract versus internal implementation detail?

Until these questions are answered with primary-source/runtime Evidence:

```text
S07 Part B = BLOCKED
```

---

# 21. Information Required Before Part B

Before Claude Code writes adapter/config/tests, gather and record:

## A. Product and Version

- confirm `NousResearch/hermes-agent` as the implementation target in the repository;
- choose/document the target version or revision.

## B. Supported Integration Surface

- identify the official supported programmatic surface Brain is allowed to call;
- collect primary documentation for that surface;
- confirm it supports the required Memory/session operations or identify gaps.

## C. Memory Capability Evidence

Verify from official docs/runtime:

- durable-memory read;
- durable-memory write/promotion behavior;
- scope and limits;
- identifiers/provenance;
- deletion/update/supersession behavior if relevant.

## D. History Capability Evidence

Verify:

- historical search exists through a supported integration boundary;
- queries can be bounded;
- session/source metadata can be returned;
- historical retrieval does not require preloading all history.

## E. Availability / Failure Semantics

Determine real behavior for:

- Hermes disabled;
- Hermes process/service unavailable;
- malformed request;
- persistence failure;
- history-search failure.

## F. Configuration and Authentication

Determine from official documentation:

- installation/runtime prerequisites;
- configuration fields;
- environment-variable or credential requirements;
- secret-handling rules.

Never paste credentials into chat or source-controlled config.

## G. Test Environment

Determine how contract tests can:

- use isolated state;
- store one durable fact;
- start/represent a new session;
- retrieve that fact;
- search cold history;
- prove temporary data was not promoted;
- disable Hermes and verify Brain still operates.

---

# 22. S07 Part A Decision

**MemoryProvider contract status:** PROPOSED pending integration/verification by Claude Code.

**Hermes product identity:** VERIFIED for this Brain bootstrap as Hermes Agent by Nous Research.

**Concrete adapter design:** BLOCKED pending primary-source/runtime verification of the supported integration boundary.

**S08:** NOT AUTHORIZED.
