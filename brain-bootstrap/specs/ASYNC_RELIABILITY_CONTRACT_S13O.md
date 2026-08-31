# BRAIN — Async Reliability Contract S13O

**Step:** S13O — async-reliability  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**Quality depth:** DEEP  
**New AgentDefinition:** NO  
**Canonical runtime side effects:** NONE  
**Core/S10 schema change:** FORBIDDEN IN V1  
**New dependency/provider binding:** FORBIDDEN IN V1  
**S13P/S14/S15 implementation:** OUT OF SCOPE

---

## 1. Purpose

Define provider-neutral, bounded reliability semantics for deciding what should happen after one already-observed operation/job attempt.

S13O v1 converts normalized observed attempt facts plus bounded policy, timing, side-effect, authority and idempotency/reconciliation evidence into one deterministic next action.

It does not execute that action.

The reference implementation is a pure in-process policy/state-transition library used by the S13O Skill harness. It must not call models/tools/networks, sleep, enqueue, cancel, persist or deduplicate external work.

---

## 2. Ownership and boundaries

### S09 remains authoritative for

- generic agent turns;
- `AgentRunLimits.max_turns`;
- whole-run `timeout_ms` / remaining-time propagation;
- terminal agent outcomes `SUCCESS | FAIL | BLOCKED`;
- S09 run events and termination explanation;
- provider-neutral model/tool contracts.

S13O may consume normalized S09-compatible attempt/result projections. It does not replace S09 terminal semantics.

### S10/S13L remain authoritative for

- AgentDefinition permissions;
- allowed capability IDs;
- side-effect ceilings;
- caller/policy authority;
- approval/security semantics.

Every retry must remain inside the same or narrower authority boundary.

### S13I compatibility

S13O v1 uses the same semantic operation-effect vocabulary:

```text
READ_ONLY
IDEMPOTENT_WRITE
NON_IDEMPOTENT_WRITE
EXTERNAL_SIDE_EFFECT
```

This is semantic compatibility, not transport execution. S13O does not implement an HTTP server/client or S13I application/data ports.

### Later-stage boundaries

- S13P owns observability infrastructure.
- S14 owns Capability Registry, MCP/connectors, auth and concrete transport/provider bindings.
- S15 owns a verifier Agent.
- S13O does not implement queue/worker/storage infrastructure, telemetry platforms or connector-specific execution.

---

## 3. Canonical status and action

```ts
export type AsyncReliabilityStatus =
  | "READY"
  | "INCONCLUSIVE"
  | "BLOCKED";

export type AsyncReliabilityAction =
  | "COMPLETE"
  | "RETRY"
  | "RECONCILE"
  | "CANCEL"
  | "STOP"
  | "BLOCK";
```

Semantics:

- `READY`: one safe deterministic action is established.
- `INCONCLUSIVE`: the actual remote/effect outcome remains materially ambiguous; action must be `RECONCILE`.
- `BLOCKED`: structural/policy/evidence input is invalid or the requested semantics require a forbidden future-stage/Core change.

`READY` is not synonymous with success.

---

## 4. Canonical reliability taxonomy

### Source

```ts
export type ReliabilityAttemptSource =
  | "MODEL"
  | "CAPABILITY"
  | "UPSTREAM";
```

### Observed status

```ts
export type ReliabilityObservedStatus =
  | "SUCCESS"
  | "FAIL"
  | "BLOCKED";
```

### Dispatch state

```ts
export type ReliabilityDispatchState =
  | "NOT_DISPATCHED"
  | "DISPATCHED"
  | "ACKNOWLEDGED";
```

Interpretation:

- `NOT_DISPATCHED`: bounded evidence establishes the remote/effect request was not sent.
- `DISPATCHED`: request/effect may have reached the remote boundary; completion is not established.
- `ACKNOWLEDGED`: bounded evidence establishes the remote system accepted/acknowledged the request; this does not itself prove final success.

### Raw error code

S13O v1 accepts only known normalized S09-compatible codes plus two bounded upstream conditions:

```ts
export type ReliabilityObservedErrorCode =
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "RATE_LIMITED"
  | "AUTH_REQUIRED"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "PERMISSION_DENIED"
  | "EXECUTION_FAILED"
  | "CANCELLED"
  | "UNKNOWN_OUTCOME";
```

Unknown values fail structural validation.

### Derived failure class

```ts
export type ReliabilityFailureClass =
  | "NONE"
  | "TRANSIENT"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PERMANENT"
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "POLICY_BLOCKED"
  | "CANCELLED"
  | "AMBIGUOUS_OUTCOME"
  | "UNKNOWN";
```

The candidate/model does not own this classification. The deterministic gate recomputes it.

---

## 5. Failure-class mapping

The input `retryable_hint` may influence classification only where this table says so. It never independently authorizes retry.

### Observed `SUCCESS`

```text
failure_class = NONE
```

### Observed `BLOCKED`

```text
failure_class = POLICY_BLOCKED
```

unless the bounded observed code is explicitly `AUTH_REQUIRED`, in which case:

```text
failure_class = AUTH_REQUIRED
```

### Known codes

```text
RATE_LIMITED      -> RATE_LIMITED
TIMEOUT           -> TIMEOUT
INVALID_REQUEST   -> INVALID_INPUT
INVALID_INPUT     -> INVALID_INPUT
AUTH_REQUIRED     -> AUTH_REQUIRED
PERMISSION_DENIED -> POLICY_BLOCKED
NOT_FOUND         -> PERMANENT
UNAVAILABLE       -> TRANSIENT
CANCELLED         -> CANCELLED
UNKNOWN_OUTCOME   -> AMBIGUOUS_OUTCOME
```

For:

```text
INVALID_RESPONSE
EXECUTION_FAILED
INTERNAL_ERROR
```

v1 derives:

```text
retryable_hint == true  -> TRANSIENT
retryable_hint == false -> PERMANENT
```

This use of the hint classifies a failure; all retry safety/budget gates still apply afterward.

Any structurally valid case not covered above becomes:

```text
UNKNOWN
```

`UNKNOWN` is never blindly retried.

---

## 6. Operation semantics

```ts
export type ReliabilitySideEffectClass =
  | "READ_ONLY"
  | "IDEMPOTENT_WRITE"
  | "NON_IDEMPOTENT_WRITE"
  | "EXTERNAL_SIDE_EFFECT";

export interface ReliabilityOperationProjection {
  operation_ref: string;
  side_effect_class: ReliabilitySideEffectClass;
  declared_idempotent: boolean;
  request_fingerprint: string;

  authority_ref: string;

  approval_required: boolean;
  approval_ref?: string;

  capability_id?: string;
}
```

Rules:

- every string ref/fingerprint must be non-empty and safe/opaque;
- `READ_ONLY` may set `declared_idempotent` true or false; it does not require the flag for replay safety;
- `IDEMPOTENT_WRITE` requires `declared_idempotent == true` for a post-dispatch retry;
- `NON_IDEMPOTENT_WRITE` and `EXTERNAL_SIDE_EFFECT` may not use `declared_idempotent` as replay proof;
- retry must preserve the same `operation_ref`, `request_fingerprint`, `authority_ref` and capability identity if one exists;
- a broader side-effect class cannot be introduced on retry.

---

## 7. Attempt projection

```ts
export interface ReliabilityAttemptProjection {
  attempt_id: string;
  attempt_number: number;

  operation_ref: string;
  request_fingerprint: string;

  authority_ref: string;
  approval_ref?: string;
  capability_id?: string;

  started_at_ms: number;
  ended_at_ms?: number;

  dispatch_state: ReliabilityDispatchState;
  observed_status: ReliabilityObservedStatus;

  source: ReliabilityAttemptSource;
  error_code?: ReliabilityObservedErrorCode;
  retryable_hint?: boolean;
  retry_after_ms?: number;

  evidence_refs: string[];
}
```

Validation:

- `attempt_number` is a positive integer;
- attempt IDs are unique;
- attempts are sorted/contiguous `1..N`;
- times are finite non-negative integers;
- `ended_at_ms >= started_at_ms` when present;
- `retry_after_ms` is a finite non-negative integer when present;
- `SUCCESS` must not carry a failure error code;
- `FAIL` requires an error code;
- `BLOCKED` may carry `AUTH_REQUIRED`, `PERMISSION_DENIED` or no error code;
- operation/fingerprint/authority/capability bindings may not silently change across attempts;
- input attempt objects are read-only.

---

## 8. Retry policy

```ts
export type ReliabilityBackoffStrategy =
  | "FIXED"
  | "EXPONENTIAL";

export interface ReliabilityRetryPolicy {
  max_attempts: number;
  max_elapsed_ms: number;

  backoff: {
    strategy: ReliabilityBackoffStrategy;
    base_delay_ms: number;
    max_delay_ms: number;
    multiplier: number;
  };

  respect_retry_after: true;
}
```

Validation:

- `max_attempts` is finite integer `>= 1`;
- `max_elapsed_ms` is finite integer `>= 1`;
- delays are finite non-negative integers;
- `max_delay_ms >= base_delay_ms`;
- `multiplier` is finite and `>= 1`;
- `FIXED` ignores multiplier for the formula but the multiplier must still be structurally valid;
- policy cannot express infinite attempts or infinite elapsed time.

`max_attempts` includes the initial attempt.

---

## 9. Clock and effective deadline

```ts
export interface ReliabilityClockProjection {
  operation_started_at_ms: number;
  now_ms: number;
  effective_deadline_at_ms?: number;
}
```

Validation:

- all values are finite non-negative integers;
- `now_ms >= operation_started_at_ms`;
- deadline, when present, must be `>= operation_started_at_ms`.

Derived:

```text
elapsed_ms = now_ms - operation_started_at_ms
remaining_elapsed_ms = max_elapsed_ms - elapsed_ms
remaining_deadline_ms = deadline_at_ms - now_ms   // when deadline exists
```

S13O never extends `effective_deadline_at_ms`.

Where the input is derived from S09, this deadline must not exceed the S09 whole-run deadline.

---

## 10. Backoff formula

Let:

```text
next_attempt_number = attempts.length + 1
retry_ordinal = next_attempt_number - 1
```

The first retry therefore has `retry_ordinal = 1`.

### Fixed

```text
policy_delay_ms = base_delay_ms
```

### Exponential

```text
policy_delay_ms = min(
  max_delay_ms,
  ceil(base_delay_ms * multiplier^(retry_ordinal - 1))
)
```

### Server-directed wait

```text
final_delay_ms = max(policy_delay_ms, latest.retry_after_ms ?? 0)
```

A server/observed retry hint is a minimum delay, not authorization to retry.

If `final_delay_ms` cannot fit inside both:

- remaining elapsed budget; and
- remaining effective deadline (when present),

then the decision must not retry.

S13O v1 does not generate random jitter. A later production scheduler may require a separate integration decision; Part B must not add random/jitter behavior that changes this reference gate.

---

## 11. Idempotency and reconciliation evidence

```ts
export type ReliabilityReplayEvidenceKind =
  | "NONE"
  | "DECLARED_IDEMPOTENT"
  | "DURABLE_KEYED_DEDUPLICATION"
  | "RECONCILED_NOT_APPLIED"
  | "RECONCILED_APPLIED";

export interface ReliabilityReplayEvidence {
  kind: ReliabilityReplayEvidenceKind;

  operation_ref: string;
  request_fingerprint: string;

  evidence_ref?: string;
  key_scope_ref?: string;

  replay_safe?: true;
}
```

### `NONE`

Carries no replay proof.

### `DECLARED_IDEMPOTENT`

Valid only for `IDEMPOTENT_WRITE`, same operation/fingerprint, and `operation.declared_idempotent == true`.

### `DURABLE_KEYED_DEDUPLICATION`

Requires:

- same operation;
- same request fingerprint;
- safe opaque `evidence_ref`;
- safe opaque `key_scope_ref`;
- `replay_safe == true`.

The input asserts an approved external durability contract exists; S13O does not implement the store and does not infer exactly-once.

### `RECONCILED_NOT_APPLIED`

Requires same operation/fingerprint plus evidence ref proving the prior ambiguous attempt did not apply the effect. It may make a new attempt eligible, subject to all other gates.

### `RECONCILED_APPLIED`

Requires same operation/fingerprint plus evidence ref proving the prior operation applied. S13O must not repeat it. The decision may `COMPLETE` only if the reconciliation evidence establishes successful completion; otherwise `STOP`/bounded handoff according to supplied evidence.

No raw idempotency key is a canonical field.

---

## 12. Cancellation projection

```ts
export interface ReliabilityCancellationProjection {
  requested: boolean;
  requested_at_ms?: number;

  acknowledged: boolean;
  acknowledgement_ref?: string;
}
```

Rules:

- a requested timestamp is required when `requested == true`;
- it must be a valid non-negative integer and not exceed `now_ms`;
- `acknowledged == true` requires `acknowledgement_ref`;
- no cancellation acknowledgement may be fabricated.

### Precedence

1. Exact observed `SUCCESS` wins: `COMPLETE`. If cancellation was requested earlier, add a race limitation.
2. If cancellation is acknowledged, `CANCEL` may be returned unless success is already observed.
3. If cancellation was requested while the latest attempt is `NOT_DISPATCHED`, `CANCEL` is allowed.
4. If cancellation was requested after dispatch and no exact terminal outcome/cancel acknowledgement exists, return `INCONCLUSIVE + RECONCILE`.
5. Do not schedule `RETRY` while a cancellation request is unresolved.

---

## 13. Async job projection

```ts
export type AsyncReliabilityJobState =
  | "PENDING"
  | "RUNNING"
  | "WAITING_RETRY"
  | "RECONCILING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "BLOCKED";

export interface AsyncReliabilityJobProjection {
  job_id: string;
  state: AsyncReliabilityJobState;
  created_at_ms: number;
  deadline_at_ms?: number;

  operation_ref: string;
  request_fingerprint: string;
}
```

The job projection is logical/reference state only. It is not durable storage.

### Allowed transitions

```text
PENDING       -> RUNNING | CANCELLED | BLOCKED
RUNNING       -> WAITING_RETRY | RECONCILING | SUCCEEDED | FAILED | CANCELLED | BLOCKED
WAITING_RETRY -> RUNNING | CANCELLED | FAILED | BLOCKED
RECONCILING   -> RUNNING | SUCCEEDED | FAILED | CANCELLED | BLOCKED
```

Terminal states:

```text
SUCCEEDED
FAILED
CANCELLED
BLOCKED
```

have no outgoing transition.

The decision must derive one legal `next_job_state` consistent with its action.

---

## 14. Canonical input

```ts
export interface AsyncReliabilityInput {
  task_ref: string;
  source_refs: string[];

  operation: ReliabilityOperationProjection;

  policy: ReliabilityRetryPolicy;
  clock: ReliabilityClockProjection;

  attempts: ReliabilityAttemptProjection[];
  latest_attempt_id: string;

  replay_evidence: ReliabilityReplayEvidence;
  cancellation: ReliabilityCancellationProjection;
  job: AsyncReliabilityJobProjection;

  security: {
    authority_ref: string;
    approval_required: boolean;
    approval_ref?: string;
    allowed_capability_ids: string[];
    allowed_side_effect_classes: ReliabilitySideEffectClass[];
  };

  evidence_refs: string[];
  limitations: string[];
}
```

Consistency requirements:

- at least one attempt exists;
- `latest_attempt_id` resolves exactly to the final/highest attempt;
- job/operation/attempt operation refs and request fingerprints match;
- security authority ref matches operation and every attempt;
- operation capability, when present, is allowed by `security.allowed_capability_ids`;
- operation side effect class is allowed by `security.allowed_side_effect_classes`;
- if approval is required for another attempt, a matching safe approval ref must be present in both operation/security projection;
- no secret/raw request payload field exists in the canonical input.

---

## 15. Replay-safety decision

Replay safety is derived after failure classification and before `RETRY`.

### `NOT_DISPATCHED`

A retry-eligible failure may retry any side-effect class because bounded evidence establishes that the previous effect was not sent, subject to budgets/authority/cancellation.

### `READ_ONLY`

A retry-eligible failure may retry after dispatch subject to budgets/authority/cancellation.

### `IDEMPOTENT_WRITE`

Post-dispatch retry requires all:

```text
declared_idempotent == true
replay_evidence.kind == DECLARED_IDEMPOTENT or DURABLE_KEYED_DEDUPLICATION
same operation_ref
same request_fingerprint
```

### `NON_IDEMPOTENT_WRITE` / `EXTERNAL_SIDE_EFFECT`

Post-dispatch retry requires one of:

```text
DURABLE_KEYED_DEDUPLICATION with replay_safe == true
RECONCILED_NOT_APPLIED
```

Otherwise:

```text
status = INCONCLUSIVE
action = RECONCILE
```

For `RECONCILED_APPLIED`, no repeat is authorized.

---

## 16. Retry eligibility

Only these derived failure classes are candidates for retry:

```text
TRANSIENT
RATE_LIMITED
TIMEOUT
```

Even those require all of:

1. cancellation does not prohibit retry;
2. next attempt fits `max_attempts`;
3. delay fits `max_elapsed_ms`;
4. delay fits effective deadline;
5. replay safety passes;
6. authority/capability/side-effect boundary is unchanged;
7. required approval evidence is present;
8. job state allows progression to `WAITING_RETRY`/`RUNNING` under the pure reference transition model.

Never-blind-retry classes:

```text
PERMANENT
INVALID_INPUT
AUTH_REQUIRED
POLICY_BLOCKED
CANCELLED
AMBIGUOUS_OUTCOME
UNKNOWN
```

---

## 17. Canonical reason codes

```ts
export type AsyncReliabilityReasonCode =
  | "OBSERVED_SUCCESS"
  | "TRANSIENT_RETRY_ALLOWED"
  | "RATE_LIMITED_RETRY_ALLOWED"
  | "TIMEOUT_RETRY_ALLOWED"
  | "RETRY_BUDGET_EXHAUSTED"
  | "DEADLINE_EXHAUSTED"
  | "ELAPSED_BUDGET_EXHAUSTED"
  | "NON_RETRYABLE_FAILURE"
  | "POLICY_BLOCKED"
  | "AUTH_REQUIRED"
  | "INVALID_INPUT"
  | "AMBIGUOUS_REMOTE_OUTCOME"
  | "IDEMPOTENCY_EVIDENCE_INSUFFICIENT"
  | "IDEMPOTENCY_EVIDENCE_MISMATCH"
  | "CANCELLATION_CONFIRMED"
  | "CANCELLATION_REQUIRES_RECONCILIATION"
  | "RECONCILED_APPLIED"
  | "INVALID_RELIABILITY_INPUT"
  | "ILLEGAL_JOB_TRANSITION"
  | "FUTURE_STAGE_REQUIRED";
```

The deterministic gate owns the final reason code.

---

## 18. Canonical decision

```ts
export interface AsyncReliabilityDecision {
  status: AsyncReliabilityStatus;
  action: AsyncReliabilityAction;

  task_ref: string;
  operation_ref: string;
  job_id: string;
  latest_attempt_id: string;

  failure_class: ReliabilityFailureClass;
  reason_code: AsyncReliabilityReasonCode;

  next_job_state: AsyncReliabilityJobState;

  next_attempt_number?: number;
  delay_ms?: number;

  remaining_attempts: number;
  remaining_elapsed_ms: number;
  remaining_deadline_ms?: number;

  replay_disposition:
    | "NOT_REQUIRED"
    | "SUFFICIENT"
    | "INSUFFICIENT"
    | "MISMATCH";

  requires_reconciliation: boolean;

  authority_ref: string;
  approval_ref?: string;

  evidence_refs: string[];
  blockers: string[];
  limitations: string[];
  residual_unknowns: string[];
}
```

Rules:

- candidate values are not trusted;
- gate recomputes all status/action/class/reason/budget/delay/job/replay fields;
- `RETRY` requires `next_attempt_number` and `delay_ms`;
- non-`RETRY` decisions omit those fields;
- `INCONCLUSIVE` requires `RECONCILE` and `requires_reconciliation == true`;
- `BLOCKED` may use `BLOCK` only and must contain blocker(s);
- `COMPLETE` requires exact observed/reconciled success;
- `CANCEL` requires safe/acknowledged cancellation evidence;
- authority/approval refs may never be widened/substituted.

---

## 19. Deterministic decision precedence

After total validation:

### Step 1 — terminal job safety

If the supplied job is already terminal, do not reopen it. A candidate asking for retry/transition is `BLOCKED` by the gate. A read-only projection may return a stable terminal decision only when consistent with observed facts.

### Step 2 — observed success

Exact observed success produces:

```text
status = READY
action = COMPLETE
failure_class = NONE
next_job_state = SUCCEEDED
reason_code = OBSERVED_SUCCESS
```

A prior cancellation request becomes a limitation, not a new outcome.

### Step 3 — cancellation

Apply Section 12.

### Step 4 — classify failure

Recompute Section 5.

### Step 5 — hard non-retry classes

For invalid/auth/policy/permanent/cancelled classes, do not retry. Use `STOP` or `BLOCK` with the matching reason and legal job transition.

### Step 6 — post-dispatch ambiguity

If effectful work may have happened and replay safety is not established:

```text
status = INCONCLUSIVE
action = RECONCILE
next_job_state = RECONCILING
reason_code = AMBIGUOUS_REMOTE_OUTCOME or IDEMPOTENCY_EVIDENCE_INSUFFICIENT
```

### Step 7 — budgets

Compute attempt, elapsed and deadline budget. Exhaustion stops retry.

### Step 8 — delay

Compute canonical backoff and Retry-After. If it cannot fit, stop.

### Step 9 — authority/approval/replay safety

All must pass.

### Step 10 — retry

Then and only then:

```text
status = READY
action = RETRY
next_job_state = WAITING_RETRY
next_attempt_number = attempts.length + 1
delay_ms = final_delay_ms
```

---

## 20. Cancellation/action consistency

A cancellation request never authorizes a new attempt.

A post-dispatch cancellation request without acknowledgement never allows:

```text
status = READY
action = CANCEL
```

unless exact bounded evidence proves cancellation/terminal non-application.

If success arrives after a cancellation request:

```text
action = COMPLETE
next_job_state = SUCCEEDED
```

and the decision records a limitation such as a safe canonical race marker; it does not fabricate cancellation.

---

## 21. Security/secret requirements

Every attempted replay must preserve:

- operation ref;
- request fingerprint;
- authority ref;
- capability ID when present;
- permitted side-effect class;
- required current approval evidence.

The reference implementation must reject or sanitize any attempted storage of:

- bearer/API tokens;
- cookies;
- auth headers;
- private keys;
- raw credentials;
- raw idempotency secrets;
- raw sensitive request/response bodies.

Safe opaque refs/hashes are allowed when they reveal no secret value.

---

## 22. No exactly-once semantics

S13O v1 distinguishes:

```text
safe replay decision
```

from:

```text
distributed exactly-once execution
```

The latter is never claimed.

A durable-keyed dedupe contract can justify replay eligibility only for the supplied operation/fingerprint/evidence scope. It does not prove global uniqueness, atomic cross-system commit or exactly-once delivery.

---

## 23. Pure reference job mechanics

Part B may implement deterministic functions such as:

```text
validateAsyncReliabilityInput
classifyReliabilityFailure
computeReliabilityBackoff
assessReplaySafety
deriveAsyncReliabilityDecision
validateAsyncJobTransition
evaluateAsyncReliabilityCandidateGate
compareAsyncReliabilityRuns
```

Those functions must be pure with respect to external systems.

They may calculate numbers/state, but they may not:

- invoke a provider;
- schedule a timer as the canonical mechanism;
- create a worker;
- open a network socket;
- persist a queue/job/idempotency record;
- mutate S09 runtime state;
- change S10 definitions.

---

## 24. Actual candidate and anti-self-certification

The reference Part B path is:

```text
AsyncReliabilityInput
→ S12 selected Skill
→ S10 compile generic harness AgentDefinition
→ S09 run with deterministic provider
→ parse actual AsyncReliabilityDecision candidate
→ validate actual candidate
→ deterministic recomputation from the exact input
→ candidate-vs-recomputed gate
→ bounded comparison evidence
```

Forbidden:

- replacing the actual parsed candidate with a separately synthesized faithful answer;
- accepting candidate `status`, `failure_class`, `delay_ms`, replay disposition or next job state as proof;
- using a scalar score to override a safety/budget failure;
- letting the provider import evaluator or hidden golden-truth helpers.

---

## 25. Provider fixture separation

For bootstrap A/B, hidden golden expectations are frozen before both arms and are not provider-visible.

The deterministic provider may depend on:

- the visible `AsyncReliabilityInput` projection;
- ordinary generic selected Skill guidance.

It must not branch on:

- hidden fixture/case ID;
- expected action/status/delay;
- `with_skill`/`without_skill` marker;
- Skill ID/name;
- mere presence of any Skill as an answer key;
- evaluator/truth helper imports.

Counterfactual inputs must demonstrate packet-derived behavior changes.

---

## 26. Semantic dimensions and atomic ownership

The Quality Contract defines 10 semantic dimensions and 30 atomic assertion families:

```text
D1 input/policy/subject integrity
D2 failure classification
D3 retry eligibility
D4 budgets/deadline
D5 backoff/rate limit
D6 idempotency/reconciliation
D7 cancellation/races
D8 async job state
D9 security/authority/secrets
D10 decision/uncertainty/stage boundary
```

Every atomic used for impact scoring must own a detached underlying source fact. Mutation isolation must recompute the real evaluator and prove exactly one canonical atomic changes.

Mutating a final produced decision field is not valid isolation evidence.

---

## 27. Same-path Skill-vs-no-Skill impact gate

Both arms share exactly:

- same `AsyncReliabilityInput` object references;
- same hidden frozen truth;
- same provider implementation and instance;
- same capability provider;
- same generic AgentDefinition;
- same S09 runtime;
- same parser;
- same candidate validator/gate;
- same deterministic evaluator;
- same comparison logic.

Only selected S13O Skill prose/availability may differ.

The Skill arm passes impact only when all are true:

```text
Skill total atomic correctness > baseline
qualified dimensions >= 7 of 10
for every qualified dimension:
  >= 2 distinct improved assertion IDs
  max one-assertion share <= 0.50
atomic regressions == 0
HI-001..HI-049 == true
all canonical unsafe counters == 0
```

HI-050 remains false/pending until fresh independent verification.

---

## 28. Required fixture coverage

Part B minimum:

```text
12 positive/evaluable fixtures
46 exact negative fixtures
30 underlying-source isolation probes
```

The exact fixture IDs/conditions in `S13O_ASYNC_RELIABILITY_DEEP.yaml` are canonical.

A negative passes only when the exact expected status/action/assertion/reason/blocker is observed. “Any non-PASS” is insufficient.

---

## 29. Canonical unsafe counters

Part B must derive, not default, these counters:

```text
retryable_hint_authorized_retry
unsafe_side_effect_retried
postdispatch_ambiguity_retried_without_proof
attempt_budget_exceeded
deadline_or_elapsed_budget_extended_or_ignored
retry_after_ignored_or_shortened
authority_approval_or_capability_widened
secret_or_raw_idempotency_material_persisted
false_cancellation_or_exactly_once_claim
unbounded_retry_or_job_loop
provider_fixture_or_arm_branching
future_stage_core_or_dependency_pull_forward
```

All must be zero for Skill-arm bootstrap impact PASS.

---

## 30. Structural validation

Validation is total and fail-closed.

At minimum reject without throwing:

- unknown enums;
- empty required refs;
- non-finite/negative timestamps/delays;
- invalid retry policy limits;
- duplicate or non-contiguous attempts;
- latest-attempt mismatch;
- operation/job/attempt/fingerprint mismatch;
- authority mismatch;
- unsupported capability/side-effect projection;
- approval-required retry without approval ref;
- malformed replay evidence;
- evidence bound to another operation/fingerprint;
- impossible cancellation acknowledgement;
- invalid/terminal job transition request;
- candidate missing canonical fields/dimensions.

Structural invalidity returns deterministic:

```text
status = BLOCKED
action = BLOCK
reason_code = INVALID_RELIABILITY_INPUT
```

or the more specific canonical blocking reason when defined.

---

## 31. Prior-contract preservation

S13O Part B must not silently rewrite approved behavior in:

- S09 runtime loop/types/events/termination;
- S10 AgentDefinition/validation/compilation;
- S12 Skill discovery/load contract;
- S13I backend API side-effect/idempotency planning;
- S13K UI retry/cancel affordance boundaries;
- S13L security/approval semantics;
- S13M debugging boundaries;
- S13N evaluation boundaries.

Part B must prove relevant protected surfaces using committed-tree/blob evidence, not merely a clean working tree.

---

## 32. Dependency/Core gate

Part A authorizes:

```text
new production dependencies: 0
new dev dependencies: 0
Core S13O special branches: 0
AgentDefinition schema changes: 0
concrete provider/queue/HTTP bindings: 0
```

If Part B demonstrates an unavoidable need for any of these, it must stop and request a new ChatGPT authoring decision before changing them.

---

## 33. Future-stage handoffs

Return `BLOCKED`/`FUTURE_STAGE_REQUIRED` rather than implementing:

### S13P

- tracing SDKs;
- exporters;
- monitoring dashboards;
- durable metrics/log pipeline.

### S14

- MCP/connectors;
- OAuth/auth binding;
- HTTP provider adapters;
- dynamic capability discovery;
- connector-specific retry/cancellation behavior.

### S15

- verifier Agent.

### New semantic gate required

- durable queue/worker/lease scheduler;
- durable idempotency/deduplication store;
- new AgentDefinition reliability schema;
- S09 Core cancellation/retry hooks;
- production transport abort/cancellation guarantees.

---

## 34. Quality verification

Part B cannot close S13O from builder QA alone.

Required before bootstrap closure:

1. exact Part A blob integrity;
2. Node 24 typecheck;
3. focused S13O tests;
4. all 12 positives;
5. all 46 exact negatives;
6. packet-derived provider counterfactuals;
7. real same-path A/B;
8. raw per-assertion contribution evidence;
9. 30/30 detached underlying-source isolation;
10. HI-001..HI-049 individually derived PASS;
11. all 12 unsafe counters derived zero;
12. full suite before clean build;
13. prove `dist/` absent;
14. clean build;
15. full suite after build;
16. `git diff --check`;
17. committed-tree boundary audit;
18. different fresh non-authoring/non-fork/read-only verifier.

Only the fresh verifier can establish HI-050 and S13O bootstrap `VERIFIED PASS`.

---

## 35. Non-goals summary

S13O v1 is not:

- a production retry loop;
- a scheduler;
- a worker system;
- a durable queue;
- a workflow engine;
- an HTTP client;
- transport-level `AbortSignal` plumbing;
- a distributed lock/idempotency database;
- exactly-once delivery;
- observability infrastructure;
- connector/MCP/auth infrastructure;
- a new AgentDefinition;
- a verifier Agent;
- semantic task replanning/debugging.

It is the canonical provider-neutral decision contract that determines when retry/cancel/stop/reconcile is safe, bounded and truthful.
