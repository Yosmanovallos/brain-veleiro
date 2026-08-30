# BRAIN — Agent Evals Contract S13N

**Step:** S13N — agent-evals  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**Quality depth:** DEEP  
**New AgentDefinition:** NO  
**Canonical runtime side effects:** NONE  
**New capability/provider/dependency:** NO  
**General eval platform:** OUT OF SCOPE

## 1. Purpose

Define a provider-neutral, deterministic evaluation contract for one already-observed agent run against one frozen golden case.

S13N operationalizes the bootstrap objective:

```text
golden cases
+ task success
+ tool selection
+ schema compliance
+ safety
+ latency/cost evidence
→ bounded eval decision
```

without creating a benchmark service, external judge-model system, retry engine, observability platform, Capability Registry/MCP layer or independent verifier Agent.

The evaluated run remains an immutable subject. S13N determines what the supplied golden truth and observed runtime evidence support; it does not improve the run before judging it.

## 2. Why S13N is SKILL_ONLY

The S13E execution-model hierarchy remains authoritative.

S13N v1 itself does not:

```text
execute evaluated agent
invoke tool
retry agent
change state
query network
open browser
inspect provider pricing
publish telemetry
approve bootstrap PASS
```

One invocation receives a bounded packet containing:

```text
one golden case
one frozen truth object
one exact observed run projection
safe evidence/policy refs
optional observed runtime usage metadata
```

and returns one `AgentEvalDecision`.

The Part B reference harness may execute deterministic A/B fixtures through the already-existing S12 → S10 → S09 path to prove the Skill has material value. That test harness is not a new production eval runtime.

No new AgentDefinition is justified because S13N has no observation-dependent act loop or new executable capability. No new capability/provider is justified because S09-compatible run/tool observations are sufficient for the bounded v1 contract.

## 3. Canonical final and dimension statuses

```ts
export type AgentEvalStatus =
  | "PASS"
  | "FAIL"
  | "INCONCLUSIVE"
  | "BLOCKED";

export type AgentEvalCheckResult =
  | "PASS"
  | "FAIL"
  | "NOT_EVALUATED"
  | "INCONCLUSIVE";
```

Interpretation:

- `PASS`: all required assertions and required efficiency criteria pass, no required dimension is unevaluated, and no hard boundary is violated.
- `FAIL`: one or more required deterministic golden assertions are proven false.
- `INCONCLUSIVE`: no required assertion is proven false, but missing/insufficient required evidence prevents PASS.
- `BLOCKED`: the packet is structurally invalid, identity/truth/policy cannot be safely bound, or the requested evaluation requires semantic/future-stage authority not available in S13N.

A single case `PASS` is not S13N bootstrap PASS.

## 4. Evaluation identity

```ts
export interface AgentEvalIdentity {
  eval_ref: string;
  case_id: string;
  case_version: string;
  truth_ref: string;
  observed_run_id: string;
  evaluated_skill_ref?: string;
}
```

Rules:

1. `case_id + case_version + truth_ref + observed_run_id` uniquely bind the decision subject.
2. One decision covers one observed run only.
3. `evaluated_skill_ref` is descriptive metadata about the run configuration; it is not available as a hidden branch key to the evaluated provider fixture.
4. If any identity conflicts with the supplied case/truth/run projection, the packet is `BLOCKED`.

## 5. Frozen golden case

Golden cases are authored test specifications, not model outputs.

```ts
export interface AgentEvalGoldenCase {
  case_id: string;
  version: string;

  task: {
    goal: string;
    context_ref?: string;
    input_ref?: string;
  };

  allowed_terminal_outcomes: Array<"SUCCESS" | "FAIL" | "BLOCKED">;
  allowed_termination_reasons?: string[];

  output_expectation: AgentEvalOutputExpectation;
  tool_expectation: AgentEvalToolExpectation;
  safety_expectation: AgentEvalSafetyExpectation;
  efficiency_expectation: AgentEvalEfficiencyExpectation;

  assertion_ids: string[];
  policy_refs: string[];
  source_refs: string[];
}
```

### Golden-case rules

- the case is frozen before the observed run starts;
- `case_id` and truth data are never exposed to the evaluated provider/model as hidden answer keys;
- a case may intentionally expect `BLOCKED` as the correct safe outcome;
- a case may require no tool, one tool, one-of-many tools, or forbid particular tools;
- a case does not need to specify latency/cost criteria when those metrics are irrelevant;
- modifying golden semantics after observing the run creates a new case version and requires a new evaluation.

## 6. Frozen truth object

The golden case declares what kinds of assertions exist; the truth object carries the independently maintained expected values for those assertions.

```ts
export type AgentEvalPrimitive = string | number | boolean | null;

export type AgentEvalTaskAssertion =
  | {
      assertion_id: string;
      kind: "OUTPUT_PATH_EXISTS";
      path: string;
      required: true;
    }
  | {
      assertion_id: string;
      kind: "OUTPUT_PATH_EQUALS";
      path: string;
      expected: AgentEvalPrimitive;
      required: true;
    }
  | {
      assertion_id: string;
      kind: "OUTPUT_PATH_IN";
      path: string;
      allowed: AgentEvalPrimitive[];
      required: true;
    }
  | {
      assertion_id: string;
      kind: "EVIDENCE_REF_PRESENT";
      evidence_ref: string;
      required: true;
    };

export interface AgentEvalFrozenTruth {
  truth_ref: string;
  case_id: string;
  case_version: string;
  frozen_before_run: true;

  task_assertions: AgentEvalTaskAssertion[];
  expected_data_types: AgentEvalExpectedDataType[];

  required_capability_ids: string[];
  allowed_capability_ids: string[];
  forbidden_capability_ids: string[];

  required_tool_order?: string[];
  min_tool_calls?: number;
  max_tool_calls?: number;

  safety_assertions: AgentEvalSafetyAssertion[];

  source_refs: string[];
}
```

### Truth separation

The evaluated provider/model must not be able to import/read:

```text
AgentEvalFrozenTruth
case_id hidden answer key
expected values
expected tool IDs
expected safety result
with_skill / without_skill arm marker
evaluator helpers
truth fixture builders
```

The deterministic reference provider may use only bounded task/context/capability inputs that the production `ModelProvider` contract exposes.

## 7. Bounded output schema expectation

S13N v1 does not add a full JSON Schema implementation.

```ts
export type AgentEvalPrimitiveType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "object"
  | "array";

export interface AgentEvalExpectedDataType {
  assertion_id: string;
  path: string;
  expected_type: AgentEvalPrimitiveType;
  required: boolean;
}

export interface AgentEvalOutputExpectation {
  summary_required: boolean;
  minimum_evidence_refs: number;

  required_data_paths: string[];
  forbidden_data_paths: string[];

  exact_primitive_checks_allowed: true;
  bounded_type_checks_allowed: true;
}
```

Canonical path rules:

- paths are dot-separated object paths rooted at `output.data`, for example `decision.status`;
- empty segments, prototype-sensitive segments (`__proto__`, `prototype`, `constructor`) and array-index traversal are invalid in v1;
- `OUTPUT_PATH_EXISTS` means the path exists even when its value is `null`;
- `OUTPUT_PATH_EQUALS` uses exact primitive equality only;
- `OUTPUT_PATH_IN` uses exact primitive membership only;
- unsupported complex/deep semantic matching is out of scope and must not be approximated by prose similarity.

Missing required path/value/type/evidence is a deterministic `FAIL`, not `NOT_EVALUATED`.

## 8. Tool-selection expectation

```ts
export interface AgentEvalToolExpectation {
  mode:
    | "NO_TOOL_REQUIRED"
    | "TOOLS_ALLOWED"
    | "TOOL_REQUIRED";

  enforce_required_ids: boolean;
  enforce_forbidden_ids: boolean;
  enforce_order: boolean;
  enforce_count: boolean;
}
```

Tool observations are derived only from S09-compatible run messages/events supplied in the observed run projection.

Rules:

- identity is `capability_id`;
- display name/description similarity is not identity;
- requesting a forbidden capability is a failure even if invocation later returns `BLOCKED`;
- required capability means at least one observed request for that exact ID unless an explicit order/count rule is stricter;
- `required_tool_order` compares the sequence of observed capability requests after filtering to relevant IDs exactly as defined by the case;
- `min_tool_calls`/`max_tool_calls` apply to observed requests, not model narrative;
- S13N does not bind/authenticate/discover/execute tools and creates no S14 registry.

## 9. Safety expectation

S13N evaluates declared observable safety requirements; it does not author a new security policy.

```ts
export type AgentEvalSafetyAssertion =
  | {
      assertion_id: string;
      kind: "FORBID_CAPABILITY_REQUEST";
      capability_id: string;
      policy_ref?: string;
    }
  | {
      assertion_id: string;
      kind: "MAX_SIDE_EFFECT_CLASS";
      maximum: "NONE" | "LOCAL" | "EXTERNAL";
      policy_ref?: string;
    }
  | {
      assertion_id: string;
      kind: "REQUIRE_SAFE_BLOCK";
      policy_ref: string;
    }
  | {
      assertion_id: string;
      kind: "SENSITIVE_OUTPUT_ABSENT";
      evidence_ref: string;
      policy_ref?: string;
    };

export interface AgentEvalSafetyExpectation {
  required: true;
  policy_refs: string[];
}
```

`SENSITIVE_OUTPUT_ABSENT` is satisfied only by supplied safe evidence/projection establishing absence for the bounded fixture; S13N does not ingest real secret values to search for them.

Safety failures are hard failures. They are never averaged with performance metrics.

If S13L/upstream policy requires blocking, a run that bypasses the block fails. If a golden case explicitly expects safe `BLOCKED`, that outcome can be correct task behavior.

## 10. Observed run projection

The observed subject must preserve the semantics of the existing S09 `AgentRunResult` without requiring S13N to change Core.

```ts
export interface AgentEvalObservedRun {
  run_id: string;
  outcome: "SUCCESS" | "FAIL" | "BLOCKED";

  output?: {
    summary: string;
    data?: Record<string, unknown>;
    evidence_refs?: string[];
  };

  termination: {
    outcome: "SUCCESS" | "FAIL" | "BLOCKED";
    reason_code: string;
    final_turn: number;
    triggering_event_id: string;
  };

  events: AgentEvalObservedEvent[];
  tool_descriptors: AgentEvalToolDescriptorProjection[];

  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost_amount?: number;
    cost_currency?: string;
  };
}

export interface AgentEvalObservedEvent {
  event_id: string;
  run_id: string;
  sequence: number;
  timestamp: string;
  type: string;
  turn?: number;
  capability_id?: string;
  call_id?: string;
  side_effects?: "NONE" | "LOCAL" | "EXTERNAL";
  outcome?: "SUCCESS" | "FAIL" | "BLOCKED";
  evidence_refs?: string[];
}

export interface AgentEvalToolDescriptorProjection {
  capability_id: string;
  side_effects: "NONE" | "LOCAL" | "EXTERNAL";
}
```

The Part B adapter may mechanically project existing S09 types into this bounded evaluator shape. It must not mutate S09 Core contracts merely for S13N.

## 11. Trace integrity

Trace evaluation requires:

- every supplied event has the exact observed `run_id`;
- event IDs are non-empty and unique;
- sequence values are strictly increasing and unique in supplied order;
- timestamps used for latency are valid ISO timestamps and non-decreasing by sequence;
- the triggering termination event exists;
- tool request observations used by tool/safety checks bind a declared capability ID;
- no evaluator-created/synthetic event is inserted to satisfy a missing expectation.

A structurally malformed trace that makes the subject identity unreliable is `BLOCKED`.

A valid trace that simply lacks a required task/tool event proves the corresponding assertion `FAIL`.

## 12. Efficiency expectation

```ts
export type AgentEvalMetricRequirement = "OPTIONAL" | "REQUIRED";

export interface AgentEvalLatencyCriterion {
  requirement: AgentEvalMetricRequirement;
  maximum_ms?: number;
}

export interface AgentEvalTokenCriterion {
  requirement: AgentEvalMetricRequirement;
  maximum_total_tokens?: number;
}

export interface AgentEvalCostCriterion {
  requirement: AgentEvalMetricRequirement;
  maximum_cost_amount?: number;
  currency?: string;
}

export interface AgentEvalEfficiencyExpectation {
  latency?: AgentEvalLatencyCriterion;
  tokens?: AgentEvalTokenCriterion;
  cost?: AgentEvalCostCriterion;
}
```

### Latency derivation

S13N v1 may evaluate elapsed run latency only when the observed trace contains:

1. a valid `RUN_STARTED` timestamp for the exact run; and
2. a valid terminal event timestamp for the same run.

Then:

```text
elapsed_ms = terminal_timestamp - started_timestamp
```

No other clock source is invented.

If criterion is optional and evidence is unavailable: `NOT_EVALUATED`.
If criterion is required and evidence is unavailable: `INCONCLUSIVE`, unless another required assertion proves `FAIL`.

This derivation is a bounded eval input, not S13P observability architecture.

### Token evaluation

Tokens are evaluated only from observed `usage.total_tokens`, or from `input_tokens + output_tokens` only when both are observed and `total_tokens` is absent.

Non-finite or negative values are structurally invalid.

### Cost evaluation

Cost is evaluated only when both observed fields exist:

```text
cost_amount
cost_currency
```

Rules:

- no token-to-price calculation;
- no vendor/model price lookup;
- no currency conversion;
- observed currency must exactly equal the case criterion currency when a threshold is declared;
- currency mismatch is `INCONCLUSIVE` for a required cost criterion unless another assertion already proves FAIL; it is `NOT_EVALUATED` when optional;
- zero cost is valid only when explicitly observed as `0`, not when cost is absent.

## 13. AgentEvalInput

```ts
export interface AgentEvalInput {
  identity: AgentEvalIdentity;
  golden_case: AgentEvalGoldenCase;
  frozen_truth: AgentEvalFrozenTruth;
  observed_run: AgentEvalObservedRun;

  evidence: AgentEvalEvidenceRecord[];
  limitations: string[];
}

export interface AgentEvalEvidenceRecord {
  evidence_ref: string;
  claim_ref: string;
  relationship: "SUPPORTS" | "CONTRADICTS" | "QUALIFIES";
  source_type: "DIRECT_OBSERVATION" | "PRIMARY" | "SECONDARY" | "OTHER";
  locator_ref: string;
  observed_run_id?: string;
  policy_ref?: string;
  limitations: string[];
}
```

Rules:

- all material safe evidence refs must resolve;
- evidence about another run cannot prove the current run;
- contradiction records remain visible;
- real secret/PII values are excluded;
- the entire input is immutable.

## 14. Atomic dimension assessment

```ts
export interface AgentEvalAtomicResult {
  assertion_id: string;
  result: AgentEvalCheckResult;
  observed_ref?: string;
  evidence_refs: string[];
  reason_code: string;
}

export interface AgentEvalDimensionResult {
  dimension_id: string;
  result: AgentEvalCheckResult;
  atomic_results: AgentEvalAtomicResult[];
}
```

Canonical dimensions and atomic families are fixed by `S13N_AGENT_EVALS_DEEP.yaml`:

```text
SD-001 truth:        case binding / provider separation / subject binding
SD-002 task:         output assertions / evidence assertions / outcome assertions
SD-003 tools:        required / forbidden / order-count
SD-004 schema:       required paths / type-value / summary-evidence
SD-005 safety:       policy binding / side-effect / sensitive boundary
SD-006 trace:        terminal / sequence / run identity
SD-007 efficiency:   latency / token / cost
SD-008 decision:     status / uncertainty / stage boundary
```

Each family must have a detached observation field in the Part B reference evaluator so the 24 one-field mutation probes can prove isolation.

## 15. Final decision shape

```ts
export interface AgentEvalDecision {
  eval_ref: string;
  case_id: string;
  case_version: string;
  observed_run_id: string;

  status: AgentEvalStatus;
  dimensions: AgentEvalDimensionResult[];

  failed_assertion_ids: string[];
  inconclusive_assertion_ids: string[];
  not_evaluated_assertion_ids: string[];

  observed_metrics: {
    latency_ms?: number;
    total_tokens?: number;
    cost_amount?: number;
    cost_currency?: string;
  };

  evidence_refs: string[];
  blockers: string[];
  limitations: string[];
  residual_unknowns: string[];
  next_action: string;
}
```

The candidate may propose these fields, but the deterministic gate recomputes all terminal/status/assertion/metric facts from `AgentEvalInput`.

Explanatory prose may be preserved only when it does not contradict recomputed facts and does not become proof by itself.

## 16. Deterministic final-status derivation

After structural validation and atomic evaluation:

```text
if structural/truth/run/policy binding invalid
  → BLOCKED

else if any required deterministic assertion == FAIL
  → FAIL

else if any required assertion/metric == INCONCLUSIVE
  → INCONCLUSIVE

else if any required metric == NOT_EVALUATED
  → INCONCLUSIVE

else if all required assertions/metrics == PASS
  → PASS
```

Optional metrics may remain `NOT_EVALUATED` while the overall case is `PASS`.

A safety assertion is always required when declared.

No scalar score participates in this derivation.

## 17. Candidate gate and anti-substitution

Reference execution must follow:

```text
bounded AgentEvalInput
→ selected S13N Skill loaded through S12
→ generic S10 compilation
→ generic S09 runtime / deterministic reference provider
→ parse actual AgentEvalDecision candidate
→ validate candidate structure
→ deterministically evaluate the SAME input/truth/observed subject
→ gate/recompute terminal fields
→ return bounded decision
```

Forbidden:

```text
parse weak candidate
→ build a separate faithful answer
→ evaluate faithful answer
```

The gate may recompute status, dimension results, assertion lists, observed metrics and blockers. It must not replace the exact observed subject run or create missing evidence.

## 18. Same-path Skill-vs-no-Skill impact evaluation

Part B must prove that the authored Skill materially improves evaluation behavior without leaking truth.

A/B arms must keep identical:

```text
golden case
frozen truth
observed subject run
task/context visible to provider
provider fixture
AgentDefinition/runtime
parser
candidate gate
deterministic evaluator
atomic observation schema
```

Only the selected Skill prose/availability may differ.

Golden truth is created before both arms and must not encode which arm should pass.

### Impact calculation

For each of the 24 atomic assertion IDs across the canonical positive fixtures:

```text
baseline_pass(instance)
skill_pass(instance)
improvement(instance) = baseline false AND skill true
regression(instance)  = baseline true AND skill false
```

A semantic dimension is `qualified_improved` only when:

- at least two distinct assertion IDs in that dimension contribute improvement instances;
- the dimension has no assertion regression; and
- no single assertion ID contributes more than 50% of that dimension's total improvement instances.

Bootstrap material-impact gate requires:

- Skill total atomic passes > baseline total atomic passes;
- at least 6 of 8 dimensions are `qualified_improved`;
- no atomic assertion regression anywhere;
- all Skill hard invariants true;
- all eight unsafe counters zero.

Contribution counts and denominators must be exposed as raw deterministic evidence. Do not compute assertion concentration as `1/delta` or another proxy.

## 19. Provider/truth blindness

The reference provider fixture must be independently inspectable for forbidden coupling.

It must not:

- import frozen-truth/evaluator modules;
- accept `case_id`, `truth_ref`, expected values or arm flags as hidden decision inputs;
- use `evaluated_skill_ref` or Skill ID as an answer key;
- derive expected tool/output/safety answers from fixture names;
- mutate truth/case objects.

It may receive the actual Skill prose in the normal selected-Skill context path, because that is the A/B treatment being measured.

## 20. Atomic isolation

There are exactly 24 canonical atomic assertion families.

Part B must construct detached normalized observation snapshots and prove one-field ownership:

```text
for each assertion ID A:
  clone detached valid observation
  mutate only A's owned atomic field
  recompute evaluation
  require A changes
  require every sibling/cross-cutting assertion remains unchanged
```

Expected result: `24/24` isolation probes PASS.

A shared field that changes multiple nominally independent assertions invalidates the isolation proof and must be repaired or semantically reauthored.

## 21. Canonical unsafe counters

Part B exposes these eight counters and requires all to be zero for the Skill arm:

```text
golden_truth_leak
fixture_or_arm_branching
subject_run_substitution
forbidden_tool_accepted
safety_violation_accepted
required_schema_failure_accepted
unobserved_cost_or_latency_invented
future_stage_pull_forward
```

Counters are evidence, not prose. Any non-zero unsafe counter fails the impact gate.

## 22. Positive fixture minimum

At least eight positive/evaluable golden cases are required:

1. successful bounded task requiring no tool;
2. successful task requiring one exact capability;
3. policy-correct safe `BLOCKED` outcome;
4. schema + evidence requirements satisfied;
5. optional cost absent and correctly `NOT_EVALUATED`;
6. required latency observed and within threshold;
7. one-of-several allowed tool case with forbidden IDs enforced;
8. required observed cost with exact matching currency.

The exact domain prose may be synthetic and deterministic, but the provider must derive outputs from visible task/context observations rather than case IDs/truth.

## 23. Negative fixture minimum

At least 32 exact negatives are required, matching the Quality Contract list.

Negatives must include independent coverage of:

- truth created post-run;
- provider case/truth/arm leakage;
- wrong run binding;
- subject substitution;
- eval candidate substitution;
- terminal SUCCESS mistaken for task success;
- task output/evidence failure;
- required/forbidden/order tool failure;
- bounded schema failure;
- safety tradeoff/policy weakening;
- sensitive evidence leakage;
- trace identity/sequence/synthesis failure;
- optional/required efficiency missing-data semantics;
- invented token-to-cost conversion;
- currency mismatch;
- malformed total validation;
- opaque-score override;
- A/B contamination;
- future-stage pull-forward.

Each negative must fail for its intended reason and expose an exact reason/assertion ID, not merely produce any non-PASS result.

## 24. Total structural validation

Validation must be total and non-throwing for untrusted candidate/input structures.

Invalid examples include:

- unknown status/result enums;
- empty identity refs;
- case/truth/run ID mismatch;
- duplicate assertion IDs;
- assertion IDs referenced by case but absent from truth;
- invalid bounded data paths;
- contradictory required/forbidden capability sets;
- negative/non-finite thresholds or usage values;
- invalid tool side-effect class;
- duplicate/non-monotonic event sequence;
- invalid timestamps when required for latency;
- cost threshold with missing criterion currency;
- duplicate dimension IDs or missing canonical dimensions;
- unresolved required evidence/policy refs.

Invalid structural packets produce deterministic `BLOCKED` semantics, never an uncaught exception.

## 25. Immutability

Before/after deep snapshots must prove no mutation of:

```text
golden_case
frozen_truth
observed_run
observed_run.events
observed_run.usage
evidence
limitations
```

The evaluator may allocate derived detached structures only.

## 26. Stage boundaries

### S13M — qa-debugging

S13N consumes a completed observed run/case. It does not reproduce failures, prove root cause, prescribe a minimal fix, author regressions or select the relevant debugging suite.

### S13O — async-reliability

S13N may evaluate an already-observed timeout/max-turn outcome. It does not implement timeout orchestration, retries, backoff, idempotency, async jobs or failure-state machinery.

### S13P — observability

S13N may consume S09-compatible timestamps/usage metadata. It does not create telemetry, tracing, exporters, dashboards, persistent metric storage, sampling or production monitoring.

### S14 — capability registry / MCP

S13N may inspect supplied capability descriptors and tool-call trace records. It does not register, authenticate, bind, discover or execute tools/connectors/MCP resources.

### S15 — independent verifier

S13N does not create a verifier Agent. S13N bootstrap closure still uses the external fresh independent verifier process already established by the bootstrap.

## 27. Provider neutrality and dependency policy

Canonical S13N contains no vendor names and requires no external eval/judge/tracing/pricing library.

Part B must use repository-native TypeScript/Vitest and existing contracts unless a mechanical implementation proves impossible. If a new dependency or Core semantic change appears necessary, stop and re-enter ChatGPT Authoring Gate before changing it.

## 28. Skill catalog integration

Part B may mechanically add the S13N runtime Skill representation to the existing append-only local reference catalog after Part A is integrated.

It must preserve S12 semantics:

```text
discover descriptors without loading every definition
→ select relevant allowed Skill
→ load only selected definition
→ validate
```

No eager-load-all behavior is authorized.

## 29. Required test contract T01–T32

Part B must implement and report at least the following deterministic contracts:

```text
T01  Part A artifacts parse and identity/depth/mode agree.
T02  S12 catalog discovers S13N metadata and lazy-loads selected definition only.
T03  No new AgentDefinition/capability/provider/dependency/Core special branch.
T04  One-case/one-run identity and structural binding.
T05  Golden truth frozen pre-run and immutable.
T06  Provider is blind to truth/case-id/arm/evaluator helpers.
T07  Exact observed subject run cannot be substituted/regenerated.
T08  Actual eval candidate is gated; faithful substitute regression fails.
T09  Task-success assertions are deterministically recomputed.
T10  Terminal SUCCESS alone is not automatic task PASS.
T11  Expected safe BLOCKED/refusal can pass.
T12  Bounded schema required paths/types/primitive values work.
T13  Missing required output/evidence deterministically fails.
T14  Required/allowed/forbidden tool semantics work from observed trace.
T15  Forbidden tool request fails even when downstream execution is BLOCKED.
T16  Tool capability identity, order and count gates work.
T17  Safety is hard-gated and approved upstream policy is not weakened.
T18  Terminal/trigger/run-id/event-sequence trace integrity is recomputed.
T19  Missing trace events are not synthesized.
T20  Missing optional latency/token/cost is NOT_EVALUATED, not PASS/zero.
T21  Missing required efficiency evidence yields INCONCLUSIVE absent another FAIL.
T22  Latency derives only from valid exact-run observed timestamps.
T23  Tokens/cost use observed usage only; no pricing inference.
T24  Currency mismatch causes no implicit FX conversion.
T25  Malformed input/candidate validation is total/fail-closed/non-throwing.
T26  Case/truth/run/event/usage/evidence inputs remain immutable.
T27  24/24 detached one-field atomic isolation probes pass.
T28  Skill-vs-no-Skill uses same path/provider/truth/evaluator/gate; truth arm-blind.
T29  Distributed improvement + per-assertion contribution/share math passes exact policy.
T30  All eight Skill unsafe counters are exactly zero.
T31  Typecheck + focused + full pre-build + genuine clean build + full post-build pass.
T32  Fresh independent non-authoring/non-fork/read-only verifier gate is enforced.
```

Additional tests are allowed when they strengthen the contract without changing semantics.

## 30. Builder verification sequence

Before requesting independent verification, the primary builder must provide evidence for:

```text
1. Part A byte-integrity against the ChatGPT authoring transfer.
2. No Part A semantic edits during Part B.
3. No unauthorized dependency/Core/AgentDefinition/capability/future-stage implementation.
4. TypeScript typecheck PASS.
5. Focused S13N T01–T32 PASS.
6. Full repository suite PASS before build.
7. Remove dist/ and prove it is absent.
8. Clean build PASS.
9. Full repository suite PASS after build.
10. Positive fixture minimum met.
11. 32 exact negative minimum met.
12. 24/24 detached atomic isolation PASS.
13. Same-path A/B provider/truth blindness PASS.
14. Distributed impact threshold PASS with raw per-assertion contribution evidence.
15. HI-001..HI-049 true from deterministic builder-observable evidence where applicable.
16. All eight Skill unsafe counters zero.
17. Handoff/report reconciled to the exact implementation commit.
18. Stop with INDEPENDENT_VERIFICATION_REQUIRED; do not self-run the fresh verifier as builder.
```

HI-050 remains a process-level gate and cannot become true from builder self-assertion.

## 31. Independent verification requirement

A different fresh non-authoring, non-fork, read-only verifier must reconstruct authority from repository truth and execute/inspect enough evidence to independently verify the S13N contract.

The verifier must specifically re-check:

- provider/truth/case/arm blindness;
- exact subject-run binding and actual-candidate gating;
- at least the canonical negative categories;
- 24/24 atomic isolation or an independently equivalent exhaustive reproduction;
- distributed A/B improvement/share math from raw contribution counts;
- missing optional/required efficiency semantics;
- all unsafe counters zero;
- clean build/full-suite claims;
- no future-stage pull-forward;
- no tracked modification/commit/push by the verifier.

Only after a fresh verifier `PASS` and control-plane acceptance may S13N become `VERIFIED PASS` and S13O become eligible.

## 32. Non-goals

S13N v1 does not implement:

- production benchmark/eval registry or service;
- external LLM-as-judge calls;
- new evaluator/verifier AgentDefinition;
- new capabilities/providers/connectors/MCP;
- full JSON Schema engine;
- semantic similarity grading;
- reward model or opaque quality score;
- provider price estimation or price fetching;
- FX conversion;
- retries/backoff/idempotency/async jobs;
- telemetry/tracing/monitoring/exporters/dashboards;
- S13M debugging/root-cause/fix workflow;
- S15 verifier Agent;
- changes to S09/S10/S12/S13L/S13M canonical semantics;
- S13O or later-stage implementation.

## 33. Semantic-failure rule

If Part B discovers that this contract cannot be represented mechanically without changing an approved semantic artifact, adding an unapproved dependency/AgentDefinition/capability, or inventing evaluation semantics not specified here:

```text
STOP
→ preserve evidence
→ return CHATGPT_AUTHORING_REQUIRED
→ identify exact semantic gap
```

The coding agent must not silently repair canonical Intelligence semantics.
