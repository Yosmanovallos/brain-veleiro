# BRAIN — Agent Runtime Loop v1

## 1. Purpose

This document defines the smallest executable Agent Runtime loop Brain needs before introducing advanced orchestration, multi-agent systems, graph runtimes, Skill factories, or self-improvement.

The canonical loop is:

```text
Goal
  ↓
Context
  ↓
Model decision
  ↓
Tool call OR finish
  ↓
Observation
  ↓
State update
  ↓
Repeat / Stop
```

The Agent Runtime belongs to **Brain Core**.

The Core may depend only on generic provider contracts.

It must not depend on:

- a concrete LLM vendor;
- a concrete model SDK;
- a concrete Tool implementation;
- a specific Connector;
- a specific MCP server;
- Hermes;
- Notion;
- LangGraph;
- a graph database;
- a multi-agent framework.

---

# 2. Scope

S09 defines:

- `ModelProvider`;
- `CapabilityProvider`;
- Tool descriptor/invocation contract;
- structured loop messages;
- loop state;
- Run event log;
- usage/cost hooks when available;
- timeout and turn limits;
- terminal outcomes;
- explainable termination.

S09 does **not** define:

- `AgentDefinition` configuration schema;
- multi-agent delegation;
- Workflow Runtime;
- Skill Registry;
- dynamic Skill generation;
- self-improvement;
- graph orchestration;
- real LLM provider integration.

Those belong to later steps.

---

# 3. Core Dependency Rule

Canonical dependency direction:

```text
Agent Runtime (Core)
    │
    ├── ModelProvider
    │       ↓
    │   concrete model adapter
    │
    └── CapabilityProvider
            ↓
        concrete Tool/Connector/MCP implementation
```

Never:

```text
Agent Runtime
    ↓
specific vendor SDK / specific tool class
```

The Core requests behavior through contracts only.

---

# 4. ModelProvider Contract

## 4.1 Purpose

`ModelProvider` accepts a normalized Brain model-decision request and returns a normalized decision.

The concrete provider may be:

- deterministic reference logic;
- a hosted LLM;
- a local model;
- another inference implementation.

The Core must not know which one is active.

---

## 4.2 Canonical Method

Required method:

```text
decide()
```

Conceptual TypeScript-compatible contract:

```ts
interface ModelProvider {
  decide(request: ModelDecisionRequest): Promise<ModelDecisionResult>;
}
```

---

## 4.3 ModelDecisionRequest

```ts
interface ModelDecisionRequest {
  run_id: string;
  turn: number;

  goal: {
    statement: string;
  };

  context: {
    context_pack_ref?: string;
    summary?: string;
  };

  messages: AgentMessage[];

  capabilities: ToolDescriptor[];

  state: {
    prior_observations: ObservationMessage[];
    working_state?: Record<string, unknown>;
  };

  limits: {
    remaining_turns: number;
    remaining_time_ms: number;
  };
}
```

### Rules

The request must be provider-neutral.

It must not contain:

- vendor-specific request objects;
- vendor-specific tool schema types;
- secret values;
- SDK-specific message classes.

A provider adapter translates this normalized request into its own implementation format.

---

## 4.4 ModelDecisionResult

```ts
type ModelDecisionResult =
  | {
      status: "SUCCESS";
      decision: ModelDecision;
      usage?: ModelUsage;
    }
  | {
      status: "FAIL";
      error: NormalizedModelError;
      usage?: ModelUsage;
    }
  | {
      status: "BLOCKED";
      reason: string;
      usage?: ModelUsage;
    };
```

---

## 4.5 ModelDecision

A decision is exactly one of:

```ts
type ModelDecision =
  | {
      type: "TOOL_CALL";
      rationale: string;
      tool_call: {
        call_id: string;
        capability_id: string;
        input: Record<string, unknown>;
      };
    }
  | {
      type: "FINISH";
      rationale: string;
      output: StructuredAgentOutput;
    };
```

The loop may not execute both a Tool and finish in the same decision.

---

## 4.6 StructuredAgentOutput

```ts
interface StructuredAgentOutput {
  summary: string;
  data?: Record<string, unknown>;
  evidence_refs?: string[];
}
```

S09 requires a structured final output.

A plain free-form string alone is insufficient as the canonical result.

---

## 4.7 Model Usage

Usage is optional because not all providers expose the same metrics.

```ts
interface ModelUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cost_amount?: number;
  cost_currency?: string;
  provider_metadata?: Record<string, unknown>;
}
```

Core must treat absent usage as:

```text
unknown / unavailable
```

not as zero.

---

## 4.8 Normalized Model Errors

```ts
interface NormalizedModelError {
  code:
    | "UNAVAILABLE"
    | "TIMEOUT"
    | "INVALID_REQUEST"
    | "INVALID_RESPONSE"
    | "RATE_LIMITED"
    | "AUTH_REQUIRED"
    | "INTERNAL_ERROR";

  message: string;
  retryable: boolean;
}
```

Provider-specific exception types must not leak into Core.

---

# 5. CapabilityProvider Contract

## 5.1 Purpose

`CapabilityProvider` exposes executable capabilities to Brain through generic descriptors and executes them through a normalized invocation contract.

A capability may ultimately come from:

- an in-process Tool;
- a Connector;
- MCP;
- an execution environment;
- another adapter.

The Agent Runtime does not need to know the origin.

---

## 5.2 Canonical Methods

Required methods:

```text
list_capabilities()
invoke()
```

Conceptual TypeScript-compatible contract:

```ts
interface CapabilityProvider {
  list_capabilities(
    request?: CapabilityListRequest
  ): Promise<ToolDescriptor[]>;

  invoke(
    request: ToolInvocationRequest
  ): Promise<ToolInvocationResult>;
}
```

---

# 6. Tool Descriptor

```ts
interface ToolDescriptor {
  capability_id: string;
  name: string;
  description: string;

  input_schema: JsonSchemaLike;
  output_schema?: JsonSchemaLike;

  side_effects:
    | "NONE"
    | "LOCAL"
    | "EXTERNAL";

  timeout_ms?: number;
}
```

`JsonSchemaLike` means a provider-neutral JSON-schema-compatible structure.

S09 does not require a complete JSON Schema implementation.

The descriptor must be sufficient for the active ModelProvider to choose and call the Tool correctly.

---

# 7. Tool Invocation

## 7.1 Request

```ts
interface ToolInvocationRequest {
  run_id: string;
  turn: number;
  call_id: string;
  capability_id: string;
  input: Record<string, unknown>;

  timeout_ms: number;
}
```

---

## 7.2 Result

```ts
type ToolInvocationResult =
  | {
      status: "SUCCESS";
      call_id: string;
      capability_id: string;
      output: Record<string, unknown>;
      evidence_refs?: string[];
      duration_ms: number;
    }
  | {
      status: "FAIL";
      call_id: string;
      capability_id: string;
      error: NormalizedToolError;
      evidence_refs?: string[];
      duration_ms: number;
    }
  | {
      status: "BLOCKED";
      call_id: string;
      capability_id: string;
      reason: string;
      evidence_refs?: string[];
      duration_ms: number;
    };
```

---

## 7.3 Normalized Tool Error

```ts
interface NormalizedToolError {
  code:
    | "NOT_FOUND"
    | "INVALID_INPUT"
    | "TIMEOUT"
    | "PERMISSION_DENIED"
    | "UNAVAILABLE"
    | "EXECUTION_FAILED"
    | "INTERNAL_ERROR";

  message: string;
  retryable: boolean;
}
```

Provider-specific Tool exceptions must not escape into the Agent Runtime.

---

# 8. "Real Tool" Requirement

S09 must execute at least one **real Tool**.

For S09, "real Tool" means:

```text
an actual CapabilityProvider-exposed implementation
that accepts structured input,
performs a real deterministic operation,
and returns a structured result.
```

It does not mean:

```text
a network API is mandatory
```

A safe reference Tool may perform a deterministic local operation such as:

```text
text statistics
JSON transformation
arithmetic
filesystem-free data normalization
```

The exact Tool is an implementation choice for Claude Code.

The Core must not hardcode its name.

A test-only fake that simply returns a canned answer does **not** satisfy the "real Tool" acceptance test.

---

# 9. Reference ModelProvider for S09

S09 uses:

```text
DeterministicReferenceModelProvider
```

This provider makes model-shaped decisions using ordinary deterministic logic.

Example behavior:

```text
if goal requires a known available Tool
and no successful observation exists:
    return TOOL_CALL

if required observation exists:
    return FINISH
```

This proves:

- the Agent Runtime loop;
- Tool selection/invocation boundary;
- observation handling;
- repeat/stop behavior;
- structured final output;
- provider substitution.

It intentionally does **not** prove model intelligence.

A later real LLM-backed provider must implement the same `ModelProvider` contract.

---

# 10. Agent Message Schema

The Runtime maintains normalized structured messages.

```ts
type AgentMessage =
  | GoalMessage
  | ContextMessage
  | DecisionMessage
  | ToolCallMessage
  | ObservationMessage
  | StateUpdateMessage
  | FinalMessage;
```

---

## 10.1 GoalMessage

```ts
interface GoalMessage {
  type: "GOAL";
  goal: string;
}
```

---

## 10.2 ContextMessage

```ts
interface ContextMessage {
  type: "CONTEXT";
  context_pack_ref?: string;
  summary?: string;
}
```

---

## 10.3 DecisionMessage

```ts
interface DecisionMessage {
  type: "MODEL_DECISION";
  turn: number;
  decision: ModelDecision;
}
```

---

## 10.4 ToolCallMessage

```ts
interface ToolCallMessage {
  type: "TOOL_CALL";
  turn: number;
  call_id: string;
  capability_id: string;
  input: Record<string, unknown>;
}
```

---

## 10.5 ObservationMessage

```ts
interface ObservationMessage {
  type: "OBSERVATION";
  turn: number;
  call_id: string;
  capability_id: string;

  outcome: "SUCCESS" | "FAIL" | "BLOCKED";

  output?: Record<string, unknown>;
  error?: NormalizedToolError;
  reason?: string;

  evidence_refs?: string[];
}
```

---

## 10.6 StateUpdateMessage

```ts
interface StateUpdateMessage {
  type: "STATE_UPDATE";
  turn: number;
  patch: Record<string, unknown>;
  reason: string;
}
```

---

## 10.7 FinalMessage

```ts
interface FinalMessage {
  type: "FINAL";
  outcome: TerminalOutcome;
  output?: StructuredAgentOutput;
  termination: TerminationExplanation;
}
```

---

# 11. Run State

The Agent Runtime executes one canonical S01 `Run`.

Minimal state:

```ts
interface AgentRunState {
  run_id: string;

  status:
    | "RUNNING"
    | "SUCCESS"
    | "FAIL"
    | "BLOCKED";

  turn: number;

  started_at: string;
  deadline_at?: string;

  messages: AgentMessage[];

  working_state: Record<string, unknown>;

  usage: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost_amount?: number;
    cost_currency?: string;
  };
}
```

This does not redefine `Run`.

It is the S09 runtime state needed to implement one bounded Run.

---

# 12. Event Log

Every meaningful loop transition must emit a structured event.

```ts
interface AgentRunEvent {
  event_id: string;
  run_id: string;
  sequence: number;
  timestamp: string;

  type:
    | "RUN_STARTED"
    | "CONTEXT_ACCEPTED"
    | "MODEL_REQUESTED"
    | "MODEL_DECIDED"
    | "TOOL_REQUESTED"
    | "TOOL_COMPLETED"
    | "TOOL_FAILED"
    | "STATE_UPDATED"
    | "RUN_SUCCEEDED"
    | "RUN_FAILED"
    | "RUN_BLOCKED"
    | "RUN_TIMED_OUT"
    | "RUN_MAX_TURNS";

  turn?: number;

  details: Record<string, unknown>;

  evidence_refs?: string[];
}
```

### Event Log Rules

- sequence numbers must be monotonic within one Run;
- terminal event must occur exactly once;
- events must make each iteration observable;
- Tool execution events should reference Evidence when available;
- an Agent assertion alone does not become Evidence.

---

# 13. Evidence Integration

S09 does not redefine Evidence.

The runtime may attach:

```text
evidence_refs
```

to:

- Tool observations;
- model-independent runtime observations;
- final outputs;
- relevant events.

Examples of Evidence:

- actual Tool output;
- command result;
- artifact hash;
- test result;
- externally verifiable response.

A `rationale` generated by ModelProvider is not Evidence merely because it exists.

---

# 14. Canonical Loop Algorithm

Conceptual algorithm:

```text
initialize Run
emit RUN_STARTED

accept Goal + bounded Context
resolve available capabilities

while RUNNING:

    check timeout
    check max_turns

    request decision from ModelProvider

    if provider FAIL:
        terminate FAIL

    if provider BLOCKED:
        terminate BLOCKED

    if decision = FINISH:
        validate structured output
        terminate SUCCESS

    if decision = TOOL_CALL:
        validate capability exists
        invoke CapabilityProvider
        record observation
        update state
        continue

emit exactly one terminal event
return final Run result
```

---

# 15. Turn Semantics

A **turn** is one ModelProvider decision cycle.

A turn begins when the Runtime requests a model decision.

A turn may result in:

```text
TOOL_CALL
```

or:

```text
FINISH
```

The turn count increments exactly once per model decision.

Tool retries must not silently create hidden turns.

If retries exist later, they must remain observable.

---

# 16. Termination Semantics

Canonical terminal outcome:

```ts
type TerminalOutcome =
  | "SUCCESS"
  | "FAIL"
  | "BLOCKED";
```

Every terminal result must include a machine-readable reason.

---

## 16.1 SUCCESS

Use when:

- ModelProvider returns `FINISH`;
- structured output validates;
- no mandatory acceptance condition remains unresolved.

Example reason codes:

```text
GOAL_COMPLETED
```

---

## 16.2 FAIL

Use when execution attempted but could not complete because of a failure.

Examples:

```text
MODEL_ERROR
TOOL_ERROR
INVALID_MODEL_DECISION
INVALID_STRUCTURED_OUTPUT
MAX_TURNS_EXCEEDED
TIMEOUT_EXCEEDED
```

A Tool failure does not silently crash the process.

The runtime records it and terminates or continues only according to explicit policy.

For S09's minimal loop, unrecovered Tool failure terminates `FAIL`.

---

## 16.3 BLOCKED

Use when continuation is not possible because a required capability/state/permission is unavailable rather than because execution itself failed.

Examples:

```text
REQUIRED_CAPABILITY_MISSING
MODEL_PROVIDER_UNAVAILABLE
PERMISSION_REQUIRED
REQUIRED_CONTEXT_MISSING
```

---

# 17. Limits

S09 requires:

```ts
interface AgentRunLimits {
  max_turns: number;
  timeout_ms: number;
}
```

Both values must be positive.

The Runtime must enforce both independently.

---

## 17.1 max_turns

Before requesting a new ModelProvider decision:

```text
if completed_model_decisions >= max_turns
→ terminate FAIL
→ reason_code = MAX_TURNS_EXCEEDED
```

No additional decision may be requested after the limit is reached.

---

## 17.2 timeout

The runtime establishes:

```text
deadline = start + timeout_ms
```

If the deadline is exceeded:

```text
terminate FAIL
reason_code = TIMEOUT_EXCEEDED
```

The final result must state whether timeout occurred:

- before model decision;
- during model call;
- during Tool invocation;
- before next iteration.

Provider-level timeout should also be normalized into the Runtime event log.

---

# 18. Termination Explanation

The S09 PASS criterion requires that Brain explain **why the loop stopped**.

Every final result must include:

```ts
interface TerminationExplanation {
  outcome: TerminalOutcome;

  reason_code:
    | "GOAL_COMPLETED"
    | "MODEL_ERROR"
    | "TOOL_ERROR"
    | "INVALID_MODEL_DECISION"
    | "INVALID_STRUCTURED_OUTPUT"
    | "MAX_TURNS_EXCEEDED"
    | "TIMEOUT_EXCEEDED"
    | "REQUIRED_CAPABILITY_MISSING"
    | "MODEL_PROVIDER_UNAVAILABLE"
    | "PERMISSION_REQUIRED"
    | "REQUIRED_CONTEXT_MISSING";

  message: string;

  final_turn: number;

  triggering_event_id: string;
}
```

This structure is mandatory.

The Runtime must not return only:

```text
done
```

or:

```text
failed
```

---

# 19. Final Run Result

```ts
interface AgentRunResult {
  run_id: string;

  outcome:
    | "SUCCESS"
    | "FAIL"
    | "BLOCKED";

  output?: StructuredAgentOutput;

  termination: TerminationExplanation;

  events: AgentRunEvent[];

  usage?: ModelUsage;
}
```

The event log enables post-run reconstruction of:

```text
what happened
in what order
which Tool ran
what it returned
what state changed
why the Run terminated
```

---

# 20. Usage / Cost Hooks

The Runtime may aggregate usage information returned by ModelProvider.

Required behavior:

```text
usage available
→ aggregate and expose

usage unavailable
→ omit / unknown

never fabricate zero usage
```

Cost must never be inferred from a vendor pricing table inside Core.

A concrete provider may supply normalized cost if it can determine it reliably.

---

# 21. Real Tool Reference Requirement

Claude Code must implement at least one real deterministic reference Tool behind `CapabilityProvider`.

Recommended class of Tool:

```text
pure local structured operation
```

Examples:

- text statistics;
- deterministic arithmetic;
- JSON normalization.

The acceptance test should use a task that cannot complete correctly without invoking the Tool.

Example conceptual task:

```text
Goal:
"Count the words in this supplied text and return the result structurally."

ModelProvider:
chooses the word-count Tool

Tool:
actually calculates result

Observation:
contains real computed value

next decision:
FINISH

output:
{
  summary: "...",
  data: {
    word_count: ...
  }
}
```

The exact tool identity remains outside Agent Runtime Core.

---

# 22. Reference ModelProvider Requirements

`DeterministicReferenceModelProvider` is a provider implementation, not Core logic.

It must:

- implement the same `ModelProvider` interface;
- inspect the normalized request;
- choose a capability through descriptors rather than importing the Tool;
- return `TOOL_CALL` when the observation is absent;
- return `FINISH` when the required observation exists;
- emit structured rationale;
- expose no secrets;
- make no network calls.

A future real LLM provider should be substitutable without changing Agent Runtime.

---

# 23. Substitution Invariants

## ModelProvider substitution

Replace:

```text
DeterministicReferenceModelProvider
```

with:

```text
another ModelProvider
```

Expected:

```text
Agent Runtime Core unchanged
```

## CapabilityProvider substitution

Replace:

```text
ReferenceCapabilityProvider
```

with:

```text
another CapabilityProvider
```

Expected:

```text
Agent Runtime Core unchanged
```

If the loop requires provider-specific types or imports, substitution fails.

---

# 24. Error Propagation Rules

Errors must be normalized at provider boundaries.

Core must not catch:

```text
vendor-specific exceptions
SDK-specific errors
tool-class-specific exceptions
```

directly.

Provider adapters translate them into:

```text
NormalizedModelError
NormalizedToolError
FAIL
BLOCKED
```

The Agent Runtime records the resulting event and terminates according to the canonical semantics.

---

# 25. S09 Required Contract Tests

Claude Code must implement and execute all tests below before S09 can PASS.

---

## T1 — Full real-tool loop

Run a minimal Agent task that requires one real Tool.

Prove:

```text
Goal
→ Model decision TOOL_CALL
→ real Tool execution
→ Observation
→ State update
→ Model decision FINISH
→ structured output
→ SUCCESS
```

Verify event order.

---

## T2 — Structured final output

Prove a successful Run returns:

- `summary`;
- structured `data` where applicable;
- `termination`;
- event log.

Plain unstructured text-only completion must fail validation.

---

## T3 — Max-turns termination

Use a ModelProvider that never finishes.

Set a small `max_turns`.

Prove:

```text
outcome = FAIL
reason_code = MAX_TURNS_EXCEEDED
```

and no extra model decision occurs after the limit.

---

## T4 — Timeout termination

Use a delayed ModelProvider or CapabilityProvider.

Set a shorter Runtime timeout.

Prove:

```text
outcome = FAIL
reason_code = TIMEOUT_EXCEEDED
```

and a terminal timeout event exists.

---

## T5 — Tool failure path

Use a real/fault-injecting Tool that returns normalized failure.

Prove:

- Runtime does not crash;
- Tool failure is observable;
- event log includes `TOOL_FAILED`;
- final result is `FAIL`;
- reason explains the Tool failure.

---

## T6 — Blocked capability path

Return a Tool call for a capability that is unavailable or disallowed.

Prove:

```text
outcome = BLOCKED
reason_code = REQUIRED_CAPABILITY_MISSING
```

or the applicable canonical blocked reason.

---

## T7 — ModelProvider substitution

Run the same Core-facing loop behavior against two different `ModelProvider` implementations.

At minimum:

- deterministic reference provider;
- test/fake alternate provider.

Core code must not change.

---

## T8 — CapabilityProvider substitution

Run the same Core-facing loop behavior against two different CapabilityProvider implementations.

Core code must not change.

---

## T9 — No provider leakage into Core

Mechanically scan Agent Runtime Core code.

Fail if it contains provider/vendor-specific tokens such as:

```text
OpenAI
Anthropic
Gemini
Claude
Hermes
Notion
MCP SDK implementation type
specific Tool implementation class
```

The exact scan list may be expanded by Claude Code.

---

## T10 — Event-log explainability

For a successful real-tool Run, verify the event log can reconstruct:

- Run start;
- model request;
- model decision;
- Tool request;
- Tool completion;
- state update;
- final model decision;
- Run success.

Sequence numbers must be monotonic.

Exactly one terminal event must exist.

---

## T11 — Usage unavailable

Use a ModelProvider that returns no usage metrics.

Prove the Runtime:

- still succeeds;
- does not fabricate zero token/cost numbers;
- represents usage as absent/unknown.

---

## T12 — Provider error normalization

Make ModelProvider return a normalized failure.

Prove:

- no provider-specific error escapes;
- final Run is `FAIL` or `BLOCKED` according to error semantics;
- event log explains the termination.

---

# 26. S09 Acceptance Criteria

S09 passes only when:

- `ModelProvider` contract is implemented;
- `CapabilityProvider` contract is implemented;
- Agent Runtime Core depends only on those contracts;
- deterministic reference ModelProvider exists outside Core;
- at least one real Tool exists outside Core;
- T1–T12 pass;
- structured final output works;
- max-turn limit works;
- timeout works;
- failure/blocked states work;
- event log is complete and ordered;
- termination explanation is explicit;
- provider substitution tests pass;
- no vendor/tool implementation leaks into Core;
- no S10 `AgentDefinition` work has started.

---

# 27. Definition of Done

A reviewer must be able to answer, from one completed Run:

```text
What was the goal?
What context was supplied?
What did the model decide?
Which Tool was called?
What input did it receive?
What observation came back?
What state changed?
How many turns occurred?
What resource usage was reported?
What was the final output?
Why did the loop stop?
```

without reading hidden reasoning or relying on an Agent assertion.
