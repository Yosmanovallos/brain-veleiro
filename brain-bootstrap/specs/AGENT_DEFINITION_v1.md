# Brain AgentDefinition v1

**Status:** Canonical S10 contract  
**Layer:** Intelligence, compiled into the generic Core Agent Runtime  
**Step:** S10 — AgentDefinition v1  
**Depends on:** S01 Vocabulary, S02 Core Boundaries, S04 Quality Architecture, S05 Context Architecture, S07 MemoryProvider, S09 Agent Runtime Loop

---

## 1. Purpose

`AgentDefinition` is the declarative configuration contract that defines what varies between Brain agents while preserving one generic Agent Runtime.

An Agent role such as `researcher`, `builder`, or `verifier` MUST be expressible as configuration and policy over the same runtime.

The definition MUST NOT create a role-specific runtime, provider implementation, executable class hierarchy, or domain-specific branch inside Brain Core.

Canonical relationship:

```text
AgentDefinition
      │
      │ validate + compile
      ▼
Resolved policies / restricted providers
      │
      ▼
S09 runAgent(...)
      │
      ▼
SUCCESS | FAIL | BLOCKED
```

`AgentDefinition` belongs to Intelligence.

The S09 Agent Runtime remains role-agnostic Core infrastructure.

---

## 2. Scope

S10 defines:

- the concrete `AgentDefinition` schema;
- policy/configuration fields for agent identity and behavior;
- capability restriction semantics;
- provider-neutral model/context/memory policies;
- runtime limits;
- output schema references;
- Quality Contract and Eval references;
- the compilation boundary between `AgentDefinition` and S09;
- illustrative `researcher`, `builder`, and `verifier` definitions;
- contract tests proving all three use the same runtime.

S10 does NOT define:

- production researcher behavior;
- production builder behavior;
- production verifier behavior;
- multi-agent orchestration;
- real delegation;
- Workflow Runtime;
- Skill Registry implementation;
- Skill Factory;
- model-provider routing implementation;
- ContextProvider implementation;
- real external LLM integration;
- separate Agent classes;
- role-specific Core code.

The first real agent remains later scope.

---

## 3. Process decision

The S10 split is:

```text
Part A — ChatGPT
AgentDefinition semantic/configuration contract

Part B — Claude Code
integration
TypeScript implementation
validation
generic compilation
reference role definitions
tests
verification
```

This is intentional.

Because `AgentDefinition` determines how Intelligence configures Core execution, Claude Code MUST NOT invent missing semantic decisions during Part B.

If Part B exposes a contract problem, it returns an evidence/feedback pack rather than silently changing this document.

---

# 4. Resolution of the six S10 ambiguities

## 4.1 `tools` versus `capabilities`

### Decision

S09 established that an executable Tool is exposed through `CapabilityProvider` and identified by `capability_id`.

S10 MUST NOT introduce a second independent Tool taxonomy.

For AgentDefinition v1:

```text
capabilities
= canonical capability allowlist

tools
= compatibility mirror of capabilities
```

Both fields remain in the schema because the S10 bootstrap contract explicitly requires both, but they do NOT represent different concepts in v1.

Invariant:

```text
tools MUST equal capabilities
```

after normalization as sets.

That means:

```yaml
tools:
  - word_count

capabilities:
  - word_count
```

is valid.

This is invalid:

```yaml
tools:
  - word_count

capabilities:
  - filesystem.write
```

The compiler MUST reject such a definition.

### Why

Creating capability bundles, groups, aliases, or a second Tool registry during S10 would pull future registry/orchestration scope forward.

A later version MAY deprecate one field or introduce capability bundles through an explicit ADR.

S10 does neither.

---

## 4.2 `delegation`

### Decision

Delegation is intentionally inert in AgentDefinition v1.

Concrete shape:

```ts
interface AgentDelegationPolicy {
  allowed: false;
}
```

Only:

```yaml
delegation:
  allowed: false
```

is valid in v1.

A definition containing:

```yaml
delegation:
  allowed: true
```

MUST fail validation.

### Why

S09 and S10 do not contain a multi-agent coordination model.

Supporting real delegation now would implicitly define:

- agent discovery;
- child runs;
- delegation permissions;
- context transfer;
- lifecycle semantics;
- parent/child evidence;
- failure propagation.

Those belong to later multi-agent/workflow work.

---

## 4.3 `termination`

### Decision

`AgentDefinition.termination` does NOT define a second runtime outcome vocabulary.

S09 remains canonical for:

```ts
type TerminalOutcome =
  | "SUCCESS"
  | "FAIL"
  | "BLOCKED";
```

and for its canonical termination explanation/reason structures.

`limits` configures when the runtime must stop due to resource ceilings.

`termination` declares the policy that the existing S09 terminal result MUST be preserved and explained.

Concrete shape:

```ts
interface AgentTerminationPolicy {
  require_terminal_outcome: true;
  require_explanation: true;
  note?: string;
}
```

Required v1 values:

```yaml
termination:
  require_terminal_outcome: true
  require_explanation: true
```

`note` is optional descriptive Intelligence metadata.

It MUST NOT alter, replace, translate, or reinterpret S09's `TerminalOutcome`.

### Separation

```text
limits
→ execution ceilings

S09 runtime
→ decides canonical terminal outcome/reason

termination policy
→ requires that canonical termination information be retained
```

---

## 4.4 `rubric` and `evals`

### Decision

`rubric` references a Quality Contract.

It MUST NOT inline or recreate the Quality Contract schema.

Concrete shape:

```ts
interface AgentRubricReference {
  quality_contract_ref: string;
}
```

Example:

```yaml
rubric:
  quality_contract_ref: quality-contracts/default-verifier
```

`evals` is a list of Eval identifiers/references:

```ts
type EvalRef = string;
```

Example:

```yaml
evals:
  - evals/agent-definition/basic-runtime
```

AgentDefinition MUST NOT contain inline:

- Eval datasets;
- grading functions;
- scoring algorithms;
- Quality Contract definitions.

Those remain separate Intelligence artifacts.

---

## 4.5 `state_schema`

### Decision

`state_schema` reuses the provider-neutral `JsonSchemaLike` concept already established by S09.

Concrete type:

```ts
state_schema: JsonSchemaLike;
```

It describes the expected structure of the Agent's working state.

S10 MUST NOT introduce another schema language.

An AgentDefinition MAY use an empty-object schema where the illustrative S10 Agent does not need persistent working state.

Example:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {}
}
```

---

## 4.6 `model_policy`, `context_policy`, and `memory_policy`

### Decision

These fields describe requirements and permissions.

They MUST NOT select concrete provider implementations.

Forbidden examples:

```yaml
model_provider: OpenAIModelProvider
memory_provider: LocalReferenceMemoryProvider
context_provider: SomeVendorRetriever
```

AgentDefinition may state what behavior is required.

Provider resolution occurs outside the definition.

---

# 5. Canonical TypeScript-compatible contract

The following is the semantic schema Part B MUST implement.

Existing S09/S07 types MUST be reused where applicable rather than recreated.

```ts
interface AgentDefinition {
  id: string;
  role: string;
  objective: string;

  model_policy: AgentModelPolicy;
  context_policy: AgentContextPolicy;

  state_schema: JsonSchemaLike;

  tools: string[];
  skills: string[];
  capabilities: string[];

  memory_policy: AgentMemoryPolicy;
  permissions: AgentPermissionPolicy;
  delegation: AgentDelegationPolicy;

  limits: AgentRunLimits;
  termination: AgentTerminationPolicy;

  output_schema: JsonSchemaLike;

  rubric: AgentRubricReference;
  evals: string[];
}
```

---

# 6. Field semantics

## 6.1 `id`

```ts
id: string;
```

Stable identifier for the AgentDefinition.

Requirements:

- non-empty;
- deterministic;
- unique within the active definition registry/configuration set;
- SHOULD use lowercase kebab-case or namespaced identifiers.

Examples:

```text
reference-researcher
reference-builder
reference-verifier
```

The Core MUST NOT branch on this value.

---

## 6.2 `role`

```ts
role: string;
```

Human- and Intelligence-readable role name.

Examples:

```text
researcher
builder
verifier
```

`role` MUST NOT be a closed Core enum.

Brain must be able to define future roles through configuration without modifying the Core runtime.

Forbidden:

```ts
if (agent.role === "researcher") {
  runResearchRuntime();
}
```

Allowed:

```ts
compileAgentDefinition(definition, providers);
runAgent(compiled);
```

---

## 6.3 `objective`

```ts
objective: string;
```

The base objective supplied to the generic runtime as the Agent's goal.

Requirements:

- non-empty;
- declarative;
- describes intended responsibility;
- MUST NOT contain executable code.

For S10 reference definitions, objectives may be intentionally trivial because production Agent behavior is not part of S10.

---

# 7. Model policy

Concrete shape:

```ts
interface AgentModelPolicy {
  routing_class:
    | "DEFAULT"
    | "ECONOMY"
    | "BALANCED"
    | "QUALITY";

  require_structured_decisions: true;

  allow_provider_substitution: boolean;
}
```

## Semantics

### `routing_class`

Provider-neutral preference available to a future model resolver.

It is NOT the name of a model or provider.

S10 does not implement routing.

### `require_structured_decisions`

Must be `true` in v1 because the S09 Runtime communicates with `ModelProvider` through the canonical structured decision contract.

### `allow_provider_substitution`

Whether an outer resolver may choose any compliant ModelProvider satisfying the policy.

This does NOT allow the AgentDefinition itself to select the implementation.

### S10 rule

The compiler validates this policy but receives an already-resolved S09 `ModelProvider`.

No concrete model-provider resolver is introduced in S10.

---

# 8. Context policy

Concrete shape:

```ts
interface AgentContextPolicy {
  retrieval_mode: "BOUNDED";

  max_context_tokens: number;
  max_items: number;

  allowed_sources: AgentContextSource[];

  require_source_refs: boolean;
}

type AgentContextSource =
  | "CURRENT_TASK"
  | "CURRENT_RUN"
  | "EXPLICIT_SPEC"
  | "VERIFIED_HANDOFF"
  | "ADR"
  | "COMPILED_KNOWLEDGE"
  | "DURABLE_MEMORY"
  | "HISTORICAL_SESSION";
```

## Invariants

```ts
retrieval_mode === "BOUNDED"
max_context_tokens > 0
max_items > 0
```

The policy MUST honor S05's rule:

> Retrieve by task relevance and expected decision value. Do not load a complete wiki or knowledge base into the Context Pack.

`allowed_sources` states which context classes the role may consume.

It does NOT identify a concrete ContextProvider.

`require_source_refs` states whether context items used in grounded work are expected to retain their source references.

S10 does not implement retrieval.

---

# 9. State schema

```ts
state_schema: JsonSchemaLike;
```

The schema describes role-specific working state.

The Agent Runtime remains generic.

Example:

```json
{
  "type": "object",
  "properties": {
    "notes": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "additionalProperties": false
}
```

No Core branch may inspect role identity to decide the state shape.

---

# 10. Tools and capabilities

Canonical types:

```ts
tools: string[];
capabilities: string[];
```

Every entry is an S09 `ToolDescriptor.capability_id`.

Example:

```yaml
tools:
  - word_count

capabilities:
  - word_count
```

## Required invariant

After duplicate removal and deterministic normalization:

```ts
set(tools) === set(capabilities)
```

Duplicate IDs MUST be rejected or normalized deterministically before equality validation.

The implementation SHOULD reject duplicates to keep definitions explicit.

---

# 11. Skills

```ts
skills: string[];
```

Values are Skill identifiers/references.

Example:

```yaml
skills:
  - skills/reference-analysis
```

S10 does NOT implement a Skill Registry.

Therefore reference S10 definitions SHOULD use:

```yaml
skills: []
```

unless an already-versioned Skill identifier is deliberately used.

The Agent Runtime MUST NOT special-case Skill names.

---

# 12. Memory policy

Concrete shape:

```ts
interface AgentMemoryPolicy {
  retrieve: boolean;
  remember_candidate: boolean;
  commit_verified_memory: boolean;
  search_history: boolean;

  promotion_policy:
    | "DISABLED"
    | "EXPLICIT_VERIFIED_ONLY";
}
```

These names correspond semantically to the existing S07 MemoryProvider operations:

```text
retrieve()
remember_candidate()
commit_verified_memory()
search_history()
```

## Rules

### `retrieve`

Agent may request relevant durable memory.

### `remember_candidate`

Agent may produce candidate memories.

### `commit_verified_memory`

Agent may participate in a flow that requests durable promotion.

This does NOT mean the model can self-approve memory.

### `search_history`

Agent may inspect historical memory/run information through the appropriate provider boundary.

### `promotion_policy`

For v1:

```text
DISABLED
```

or:

```text
EXPLICIT_VERIFIED_ONLY
```

No AgentDefinition may authorize unverified automatic durable-memory promotion.

The provider implementation remains injected and unnamed.

---

# 13. Permissions

Concrete shape:

```ts
interface AgentPermissionPolicy {
  allowed_side_effects: ToolSideEffectClass[];
  deny_unlisted_capabilities: true;
}

type ToolSideEffectClass =
  | "NONE"
  | "LOCAL"
  | "EXTERNAL";
```

The side-effect strings reference the existing S09 ToolDescriptor vocabulary.

They MUST NOT redefine it.

Example verifier:

```yaml
permissions:
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true
```

Example builder:

```yaml
permissions:
  allowed_side_effects:
    - NONE
    - LOCAL
  deny_unlisted_capabilities: true
```

For S10's existing `word_count` reference capability, `NONE` is sufficient.

---

# 14. Delegation

Canonical v1:

```ts
interface AgentDelegationPolicy {
  allowed: false;
}
```

No additional fields.

No child agents.

No delegation target list.

No recursive execution.

No multi-agent semantics.

---

# 15. Limits

Use the existing S09 type directly:

```ts
limits: AgentRunLimits;
```

Canonical S09 shape:

```ts
interface AgentRunLimits {
  max_turns: number;
  timeout_ms: number;
}
```

Validation:

```text
max_turns >= 1
timeout_ms >= 1
```

These map directly into the S09 Agent Runtime.

No duplicate limit values belong inside `termination`.

---

# 16. Termination policy

Concrete shape:

```ts
interface AgentTerminationPolicy {
  require_terminal_outcome: true;
  require_explanation: true;
  note?: string;
}
```

The runtime's existing S09 terminal result is authoritative.

The policy MUST NOT create outcomes such as:

```text
PARTIAL_SUCCESS
APPROVED
RETRY_LATER
DONE_ENOUGH
```

unless a future canonical runtime contract explicitly adds them.

---

# 17. Output schema

```ts
output_schema: JsonSchemaLike;
```

Describes the expected role-level data shape.

It does NOT replace S09's canonical:

```ts
StructuredAgentOutput
```

Instead:

```text
StructuredAgentOutput.data
```

may be validated against `AgentDefinition.output_schema`.

`summary` and `evidence_refs` remain part of the existing S09 output contract.

Reference S10 definitions may use a minimal output schema.

---

# 18. Rubric

Concrete shape:

```ts
interface AgentRubricReference {
  quality_contract_ref: string;
}
```

The value points to a Quality Contract artifact or canonical identifier.

Example:

```yaml
rubric:
  quality_contract_ref: quality-contracts/reference-agent
```

AgentDefinition MUST NOT inline the Quality Contract.

---

# 19. Evals

```ts
evals: string[];
```

Each entry is an Eval identifier/reference.

Example:

```yaml
evals:
  - evals/agent-definition/reference-role
```

S10 may use an empty list for illustrative instances when no canonical Eval artifact exists yet:

```yaml
evals: []
```

The absence of an Eval reference in an illustrative S10 definition does not redefine Eval semantics.

---

# 20. AgentDefinition validation

Before runtime compilation, a definition MUST pass deterministic validation.

Minimum validation rules:

```text
id
- non-empty

role
- non-empty

objective
- non-empty

model_policy
- valid routing_class
- require_structured_decisions === true

context_policy
- retrieval_mode === BOUNDED
- max_context_tokens > 0
- max_items > 0

state_schema
- valid JsonSchemaLike value

tools
- unique capability IDs

capabilities
- unique capability IDs

tools/capabilities
- same normalized set

memory_policy
- valid booleans
- valid promotion policy
- automatic unverified promotion impossible

permissions
- deny_unlisted_capabilities === true
- allowed_side_effects valid

delegation
- allowed === false

limits
- max_turns >= 1
- timeout_ms >= 1

termination
- require_terminal_outcome === true
- require_explanation === true

output_schema
- valid JsonSchemaLike value

rubric
- quality_contract_ref non-empty

evals
- unique non-empty refs
```

A malformed definition MUST fail before invoking `runAgent()`.

There MUST be no silent defaults for semantically required fields.

---

# 21. Compilation boundary

S10 MUST introduce one generic compilation path.

Conceptual signature:

```ts
interface AgentRuntimeDependencies {
  model_provider: ModelProvider;
  capability_provider: CapabilityProvider;
}

interface CompiledAgentExecution {
  definition: AgentDefinition;
  run_options: RunAgentOptions;
}

function compileAgentDefinition(
  definition: AgentDefinition,
  dependencies: AgentRuntimeDependencies
): CompiledAgentExecution;
```

Exact filenames are Part B implementation details.

The semantic behavior is fixed by this contract.

---

# 22. Compilation algorithm

The compiler MUST perform these steps generically:

```text
1. validate AgentDefinition
2. inspect injected CapabilityProvider descriptors
3. verify every allowed capability exists
4. restrict capability exposure to AgentDefinition.capabilities
5. enforce allowed side-effect classes
6. construct S09 RunAgentOptions
7. call the same runAgent() runtime
8. preserve the canonical S09 terminal result/event log
9. optionally validate StructuredAgentOutput.data against output_schema
```

No step depends on checking `role`.

---

# 23. Capability restriction wrapper

The injected `CapabilityProvider` MUST NOT automatically expose every capability it contains to every Agent.

Compilation/execution MUST apply a generic restriction boundary equivalent to:

```ts
class RestrictedCapabilityProvider implements CapabilityProvider {
  // wraps injected provider using AgentDefinition policy
}
```

The wrapper is generic infrastructure.

It MUST NOT contain role names.

### `list_capabilities()`

Returns only descriptors whose:

```text
capability_id
```

is present in the AgentDefinition capability allowlist and whose side-effect class is permitted.

### `invoke()`

Before delegating to the injected provider:

1. verify `capability_id` is explicitly allowed;
2. verify its descriptor satisfies `allowed_side_effects`;
3. reject otherwise;
4. only then invoke the injected provider.

The denial MUST be explicit and observable.

It MUST NOT silently fall back to another capability.

---

# 24. Mapping to S09 RunAgentOptions

The exact existing S09 property names MUST be reused by Part B.

Semantically:

```text
AgentDefinition.objective
        ↓
S09 goal

injected ModelProvider
        ↓
S09 model provider dependency

restricted injected CapabilityProvider
        ↓
S09 capability provider dependency

AgentDefinition.limits
        ↓
S09 AgentRunLimits
```

Conceptually:

```ts
const runOptions = {
  goal: definition.objective,
  modelProvider: injectedModelProvider,
  capabilityProvider: restrictedCapabilityProvider,
  limits: definition.limits,
};
```

Part B MUST adapt the names above to the actual existing `RunAgentOptions` names rather than changing S09 to match this illustrative snippet.

No semantic decision is required to perform that mechanical adaptation.

---

# 25. Policies not consumed directly by S09

S09 intentionally predates AgentDefinition.

Therefore some Intelligence policies do not become direct fields on `RunAgentOptions`.

These include:

```text
model_policy
context_policy
state_schema
skills
memory_policy
permissions beyond CapabilityProvider restriction
delegation
termination
output_schema
rubric
evals
```

This is expected.

They are:

- validated;
- retained as Agent configuration;
- enforced where a corresponding boundary already exists;
- available for later compatible infrastructure.

S10 MUST NOT expand `RunAgentOptions` merely to force every AgentDefinition field into the S09 Core loop.

Core remains minimal.

---

# 26. Provider-resolution rule

`compileAgentDefinition()` receives already-resolved generic providers.

AgentDefinition does NOT contain:

```text
provider implementation class
API key
vendor name
model name tied to a vendor
database path
credential
secret
```

A future resolver may consume:

```text
model_policy
context_policy
memory_policy
```

to select compatible providers.

That resolver is outside S10.

---

# 27. Role independence invariant

This is the central S10 invariant:

```text
role changes configuration
role does not change runtime code path
```

The following patterns are forbidden in Core and generic compiler code:

```ts
if (definition.role === "researcher") { ... }

if (definition.role === "builder") { ... }

switch (definition.role) { ... }

const runtime =
  definition.role === "verifier"
    ? verifierRuntime
    : builderRuntime;
```

Role names MAY appear:

- in Intelligence configuration fixtures;
- in test names;
- in test data;
- in documentation.

They MUST NOT control generic runtime behavior.

---

# 28. Illustrative S10 definitions

These are deliberately minimal proof configurations.

They are NOT the production agents of later steps.

If the existing reference capability uses an identifier other than exactly `word_count`, Part B SHALL mechanically substitute the existing descriptor's actual canonical `capability_id`.

That substitution is not a semantic change.

---

## 28.1 Reference researcher

```ts
const referenceResearcher: AgentDefinition = {
  id: "reference-researcher",

  role: "researcher",

  objective:
    "Inspect the provided input and produce a structured reference result using only permitted capabilities.",

  model_policy: {
    routing_class: "BALANCED",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 4000,
    max_items: 20,
    allowed_sources: [
      "CURRENT_TASK",
      "EXPLICIT_SPEC",
      "COMPILED_KNOWLEDGE",
    ],
    require_source_refs: true,
  },

  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  tools: ["word_count"],

  skills: [],

  capabilities: ["word_count"],

  memory_policy: {
    retrieve: true,
    remember_candidate: true,
    commit_verified_memory: false,
    search_history: true,
    promotion_policy: "EXPLICIT_VERIFIED_ONLY",
  },

  permissions: {
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  delegation: {
    allowed: false,
  },

  limits: {
    max_turns: 6,
    timeout_ms: 5000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "Reference S10 configuration only.",
  },

  output_schema: {
    type: "object",
    additionalProperties: true,
  },

  rubric: {
    quality_contract_ref: "quality-contracts/reference-researcher",
  },

  evals: [],
};
```

---

## 28.2 Reference builder

```ts
const referenceBuilder: AgentDefinition = {
  id: "reference-builder",

  role: "builder",

  objective:
    "Produce a structured reference result using only the capabilities permitted by this AgentDefinition.",

  model_policy: {
    routing_class: "BALANCED",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 6000,
    max_items: 30,
    allowed_sources: [
      "CURRENT_TASK",
      "EXPLICIT_SPEC",
      "VERIFIED_HANDOFF",
      "ADR",
      "COMPILED_KNOWLEDGE",
    ],
    require_source_refs: true,
  },

  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  tools: ["word_count"],

  skills: [],

  capabilities: ["word_count"],

  memory_policy: {
    retrieve: true,
    remember_candidate: true,
    commit_verified_memory: false,
    search_history: true,
    promotion_policy: "EXPLICIT_VERIFIED_ONLY",
  },

  permissions: {
    allowed_side_effects: ["NONE", "LOCAL"],
    deny_unlisted_capabilities: true,
  },

  delegation: {
    allowed: false,
  },

  limits: {
    max_turns: 8,
    timeout_ms: 7000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "Reference S10 configuration only.",
  },

  output_schema: {
    type: "object",
    additionalProperties: true,
  },

  rubric: {
    quality_contract_ref: "quality-contracts/reference-builder",
  },

  evals: [],
};
```

---

## 28.3 Reference verifier

```ts
const referenceVerifier: AgentDefinition = {
  id: "reference-verifier",

  role: "verifier",

  objective:
    "Evaluate the provided reference input and return a structured result without invoking unpermitted capabilities.",

  model_policy: {
    routing_class: "QUALITY",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 5000,
    max_items: 25,
    allowed_sources: [
      "CURRENT_TASK",
      "EXPLICIT_SPEC",
      "VERIFIED_HANDOFF",
      "ADR",
    ],
    require_source_refs: true,
  },

  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  tools: ["word_count"],

  skills: [],

  capabilities: ["word_count"],

  memory_policy: {
    retrieve: true,
    remember_candidate: false,
    commit_verified_memory: false,
    search_history: true,
    promotion_policy: "DISABLED",
  },

  permissions: {
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  delegation: {
    allowed: false,
  },

  limits: {
    max_turns: 5,
    timeout_ms: 5000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "Reference S10 configuration only.",
  },

  output_schema: {
    type: "object",
    additionalProperties: true,
  },

  rubric: {
    quality_contract_ref: "quality-contracts/reference-verifier",
  },

  evals: [],
};
```

---

# 29. What the three role definitions MUST differ in

To prove configuration-driven behavior, the reference definitions MUST contain real configuration differences.

At minimum they differ in some combination of:

```text
id
role
objective
model_policy
context_policy
memory_policy
permissions
limits
rubric reference
```

They MAY temporarily share:

```text
word_count capability
state schema
output schema
skills []
evals []
delegation.allowed = false
```

because S10 is proving the configuration model rather than implementing three production agents.

---

# 30. What the three roles MUST NOT differ in

They MUST NOT use different:

- Core Agent Runtime functions;
- Agent Runtime classes;
- provider interfaces;
- event-log implementations;
- termination outcome types;
- execution loops;
- role-specific compiler functions.

Forbidden:

```text
runResearcher()
runBuilder()
runVerifier()
```

as separate runtime implementations.

Required:

```text
AgentDefinition
      ↓
same compiler
      ↓
same runAgent()
```

---

# 31. Required S10 contract tests

Part B MUST implement deterministic tests equivalent to the following.

Names may differ, semantics may not.

---

## T1 — valid AgentDefinition accepted

Given a complete valid AgentDefinition:

```text
validateAgentDefinition()
```

passes.

---

## T2 — researcher definition validates

The reference researcher passes the canonical schema validation.

---

## T3 — builder definition validates

The reference builder passes the canonical schema validation.

---

## T4 — verifier definition validates

The reference verifier passes the canonical schema validation.

---

## T5 — incomplete/malformed definition rejected

Remove at least one required field, for example:

```text
objective
```

or provide an invalid value such as:

```yaml
limits:
  max_turns: 0
```

The definition MUST be rejected with an explicit validation error before `runAgent()` executes.

No silent default.

---

## T6 — tools/capabilities invariant enforced

Given:

```yaml
tools:
  - word_count

capabilities:
  - different_capability
```

validation MUST fail.

---

## T7 — capability list is restricted

Given a CapabilityProvider exposing:

```text
allowed_capability
forbidden_capability
```

and an AgentDefinition allowing only:

```text
allowed_capability
```

the provider presented to S09 `runAgent()` MUST list only:

```text
allowed_capability
```

---

## T8 — forbidden capability invocation rejected

Attempt to invoke a capability not present in the AgentDefinition allowlist.

The generic restriction layer MUST reject it before delegating to the underlying CapabilityProvider.

The denial MUST be observable in deterministic evidence/error output.

---

## T9 — side-effect permission enforced

Given a descriptor whose:

```text
side_effects = EXTERNAL
```

and an AgentDefinition permitting only:

```text
NONE
```

that capability MUST NOT be exposed or invokable.

---

## T10 — AgentDefinition limits map to S09

Use an AgentDefinition with distinctive:

```text
max_turns
timeout_ms
```

values.

Prove the compiled S09 options receive those same values without a parallel limits implementation.

---

## T11 — all roles execute through identical compiler/runtime path

Execute:

```text
referenceResearcher
referenceBuilder
referenceVerifier
```

through:

```text
same compileAgentDefinition()
same runAgent()
```

The test MUST prove no role-specific runtime function is required.

All three MAY use the existing deterministic reference ModelProvider and trivial reference capability.

Production role quality is explicitly not being tested.

---

## T12 — Core contains no role-conditional branching

Perform a deterministic source/code scan over Core Agent runtime/compiler files.

It MUST find no control-flow checks equivalent to:

```text
role === "researcher"
role === "builder"
role === "verifier"
```

and no separate runtime implementation named for those roles.

Role names in fixtures/configuration/tests are allowed.

---

## T13 — delegation remains disabled

A definition with:

```yaml
delegation:
  allowed: true
```

MUST fail validation.

---

## T14 — provider neutrality

AgentDefinition source/configuration MUST contain no concrete provider implementation requirement.

Perform an appropriate deterministic inspection proving the canonical schema/reference definitions do not depend on specific model/memory/context vendor classes.

Existing reference implementation names outside AgentDefinition configuration are not violations.

---

# 32. PASS criterion

S10 passes only if:

```text
researcher
builder
verifier
```

are represented as three AgentDefinition configurations and execute through:

```text
one generic compiler
+
one S09 Agent Runtime
```

with no role-specific runtime branching.

Additionally:

- all definitions validate;
- malformed definitions fail deterministically;
- capability restrictions are enforced;
- permissions are enforced;
- S09 limits are reused;
- S09 terminal semantics are preserved;
- no concrete provider implementation enters AgentDefinition;
- delegation remains disabled;
- no S11 production behavior is pulled into S10.

---

# 33. Failure conditions

S10 MUST fail or remain blocked if implementation requires any of the following:

```text
ResearcherAgent class with unique runtime behavior
BuilderAgent class with unique runtime behavior
VerifierAgent class with unique runtime behavior

role-based branches in Core

new TerminalOutcome vocabulary

new Tool concept separate from S09 capabilities

real multi-agent delegation

concrete LLM provider selection inside AgentDefinition

automatic unverified durable-memory promotion

inline Quality Contract duplication

inline Eval implementation

production researcher/builder/verifier behavior
```

---

# 34. Architectural summary

```text
                 Intelligence
                     │
              AgentDefinition
                     │
          validate + compile policy
                     │
       ┌─────────────┴─────────────┐
       │                           │
ModelProvider               CapabilityProvider
 injected                    injected
       │                           │
       │                    generic restriction
       │                    by capabilities +
       │                    side-effect policy
       └─────────────┬─────────────┘
                     │
                  Core S09
                  runAgent()
                     │
              events + evidence
                     │
           SUCCESS / FAIL / BLOCKED
```

Agent identity is configuration.

Runtime behavior remains generic.

Providers remain substitutable.

Permissions are enforced at the capability boundary.

Context and memory remain bounded/provider-neutral.

Quality and Evals remain referenced Intelligence artifacts.

---

# 35. Canonical S10 decisions

| Question | S10 decision |
|---|---|
| `tools` vs `capabilities` | Same S09 capability IDs in v1; both fields MUST represent the same normalized set. |
| Capability bundles | Deferred. |
| Delegation | `allowed: false` only. |
| Multi-agent semantics | Deferred. |
| `limits` | Reuse S09 `AgentRunLimits`. |
| `termination` | Policy requiring preservation/explanation of S09 terminal result; no new outcomes. |
| `rubric` | Reference to Quality Contract. |
| `evals` | List of Eval references. |
| `state_schema` | Reuse S09 `JsonSchemaLike`. |
| `model_policy` | Provider-neutral requirements/routing class only. |
| `context_policy` | Bounded retrieval policy, no provider selection. |
| `memory_policy` | Permissions over S07 semantics; explicit verified promotion only. |
| Agent roles | Strings/configuration, not Core enum/classes. |
| Runtime | One S09 `runAgent()` path. |
| S11 behavior | Not part of S10. |

---

## Self-check

This contract resolves all six reported S10 ambiguities explicitly and gives every required `AgentDefinition` field a concrete TypeScript-compatible shape. It defines a deterministic validation and compilation boundary into the existing S09 runtime while preserving provider neutrality and forbidding role-specific Core branching. The researcher, builder, and verifier examples differ only through configuration and policy and are intentionally not production Agent implementations, so S11 scope is not pulled forward. Claude Code can now implement Part B and the T1–T14 contract tests without making additional semantic architecture decisions.