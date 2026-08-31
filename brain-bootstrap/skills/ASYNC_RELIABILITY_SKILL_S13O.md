# ASYNC_RELIABILITY_SKILL_S13O

## Identity

```yaml
id: intelligence.async-reliability.s13o
version: 1.0.0
step: S13O
name: async-reliability
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral: true
```

## Purpose

Produce one bounded, evidence-grounded reliability decision for one already-observed operation/job attempt projection.

The canonical reasoning sequence is:

```text
validate reliability input + exact latest attempt binding
→ classify the observed result from normalized facts
→ preserve S09 whole-run deadline/termination ownership
→ apply retry eligibility without trusting retryable=true as authorization
→ enforce attempt + elapsed + deadline budgets
→ compute bounded deterministic backoff and Retry-After handling
→ enforce side-effect/idempotency/reconciliation safety
→ resolve cancellation races truthfully
→ derive one legal async-job state transition
→ preserve authority/approval/secrets boundaries
→ recompute status + action + limitations
```

S13O is a reliability reasoning Skill with a pure deterministic reference decision layer. It does not itself execute a retry, sleep, cancel a remote call, persist a job, deduplicate a request, run a worker, bind an HTTP client, or create a queue.

## Execution-mode decision

S13O v1 is `SKILL_ONLY`.

Reason:

- the Skill consumes a bounded `AsyncReliabilityInput` and returns an `AsyncReliabilityDecision`;
- Part B may implement pure deterministic policy/state-transition functions under `src/intelligence/async-reliability/`, but those functions must have no external side effects;
- S09 already owns the generic agent loop, whole-run deadline, terminal outcome and model/tool provider contracts;
- S10 already owns AgentDefinition compilation and permissions; S13O v1 does not silently extend that schema;
- S14 owns concrete Capability Registry/MCP/connector/auth/HTTP bindings;
- S13P owns observability infrastructure; S15 owns a verifier Agent;
- no repository evidence currently justifies a Core special branch or a new AgentDefinition.

Canonical S13O therefore defines reliable decision semantics and a deterministic reference state machine, not a production scheduler/runtime platform.

## Quality-depth decision

S13O is `DEEP`.

Retry/cancellation/idempotency mistakes can duplicate writes, repeat external side effects, bypass approvals, create retry storms, misreport ambiguous remote outcomes as success/cancelled, or silently claim exactly-once guarantees that do not exist. Those failures can become irreversible. S13O therefore requires explicit hard gates, bounded budgets, phase-aware ambiguity handling, atomic evidence and fresh independent verification.

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - CURRENT_TASK
    - APPROVED_SPEC
    - QUALITY_CONTRACT
    - AGENT_RUN_RESULT
    - SECURITY_DECISION
    - RUNTIME_METADATA
    - ACCEPTANCE_CRITERIA
    - EVIDENCE_REQUIREMENTS
  quality_contract_refs:
    - S13O_ASYNC_RELIABILITY_DEEP
```

## Permissions

```yaml
permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true
```

## Canonical input

```text
AsyncReliabilityInput
```

One input binds one operation reference, one async-job projection and one exact latest attempt projection. The input may contain safe opaque refs, normalized failure metadata, bounded timing/budget data, side-effect classification, idempotency/reconciliation evidence refs and authority/approval refs.

It must not contain live credentials, bearer tokens, cookies, authorization headers, private keys, raw idempotency secrets, raw sensitive payloads, vendor-specific transport clients, queue handles or unrelated repository dumps.

## Canonical output

```text
AsyncReliabilityDecision
```

Canonical decision status:

```text
READY
INCONCLUSIVE
BLOCKED
```

Canonical next action:

```text
COMPLETE
RETRY
RECONCILE
CANCEL
STOP
BLOCK
```

Interpretation:

- `READY`: enough bounded evidence exists to choose a safe deterministic next action.
- `INCONCLUSIVE`: the remote/side-effect outcome remains materially ambiguous; the action must be `RECONCILE`, never a blind retry or terminal success/cancel claim.
- `BLOCKED`: input/policy/evidence is structurally invalid, unsafe semantics were requested, or the requested behavior requires a forbidden future-stage platform/change.

`READY` does not mean the operation is successful. A correct `READY` decision may be `STOP`, `BLOCK`, `CANCEL` or `RETRY`.

## Core rules

### AR-R1 — One bounded operation/job subject
One decision binds one operation reference, one job projection and one exact latest attempt. Do not merge unrelated attempts/jobs or silently pick a more favorable subject.

### AR-R2 — Decide; do not execute
S13O v1 computes a reliability decision only. It does not call model/tool/network providers, sleep, enqueue, cancel, persist or deduplicate external work.

### AR-R3 — No Core/S10 schema change by default
No S13O-specific Core branch, `AgentDefinition` extension, provider adapter or dependency is authorized by Part A. If Part B proves one is necessary, stop for a new semantic gate.

### AR-R4 — Preserve S09 ownership
S09 remains authoritative for whole-run `timeout_ms`, remaining-time propagation, terminal `SUCCESS | FAIL | BLOCKED`, max turns and event semantics. S13O must not invent a competing agent-run outcome model.

### AR-R5 — `retryable` is evidence, not permission
Existing model/tool `retryable: true` is a hint used during classification. It never independently authorizes a retry.

### AR-R6 — Failure classification is deterministic
Observed normalized status/code/source/dispatch facts are mapped into the canonical S13O failure class. Candidate/provider labels are not proof.

### AR-R7 — Observed success is never retried
An exact observed `SUCCESS` produces `COMPLETE` unless the input is structurally invalid. A later cancellation request cannot rewrite an already observed success into cancelled.

### AR-R8 — Invalid/auth/policy/permanent failures are not blindly retried
`INVALID_INPUT`, `AUTH_REQUIRED`, `POLICY_BLOCKED` and `PERMANENT` do not produce `RETRY` in v1.

### AR-R9 — Transient/rate-limited/timeout are conditional
A retry-eligible class still requires remaining attempt/time/deadline budget plus side-effect/idempotency/authority safety.

### AR-R10 — Dispatch phase matters
`NOT_DISPATCHED`, `DISPATCHED` and `ACKNOWLEDGED` are materially different. Post-dispatch timeout/unknown outcome for effectful work cannot be treated as if nothing happened.

### AR-R11 — Ambiguous post-dispatch effects require reconciliation
When the remote effect may have occurred and safe replay is not proven, return `INCONCLUSIVE + RECONCILE`. Never guess success, failure, cancellation or safe retry.

### AR-R12 — Attempt budget is hard
`max_attempts` includes the initial attempt and must be a positive finite integer. No next attempt is authorized when the next attempt number would exceed it.

### AR-R13 — Elapsed retry budget is hard
`max_elapsed_ms` is finite and positive. Reliability decisions never extend the retry window beyond it.

### AR-R14 — Deadline is hard
A retry delay may not schedule work at/after the effective deadline. If the required wait cannot fit, stop rather than shorten the server/policy wait or extend the deadline.

### AR-R15 — Retry-After is a minimum wait, not retry authorization
A valid observed `retry_after_ms` may increase the delay only after retry eligibility is independently established. If the hint cannot fit within the remaining budget/deadline, do not retry.

### AR-R16 — Backoff is deterministic and bounded
Reference v1 supports bounded `FIXED` or `EXPONENTIAL` backoff. The first retry uses the configured base delay; exponential retries use a finite multiplier and are capped by `max_delay_ms`. Reference v1 does not generate random jitter.

### AR-R17 — One decision schedules at most one next attempt
No recursive retry loop, fan-out, busy-spin, hidden worker or multiple concurrent next attempts may be created by one S13O decision.

### AR-R18 — Read-only replay is the lowest-risk case
A `READ_ONLY` operation may retry a retry-eligible failure under valid budget/deadline/authority constraints because no declared side effect is repeated.

### AR-R19 — Idempotent write replay requires stable semantics
An `IDEMPOTENT_WRITE` may retry after dispatch only when idempotence is explicitly declared and the operation/request fingerprint for the next attempt is unchanged.

### AR-R20 — Non-idempotent/external replay needs proof
A `NON_IDEMPOTENT_WRITE` or `EXTERNAL_SIDE_EFFECT` may not retry after dispatch unless trusted bounded evidence proves either durable same-operation replay safety or reconciliation that the prior effect was not applied.

### AR-R21 — Exactly-once claims are forbidden
Idempotency/deduplication evidence may reduce duplicate effects; it does not establish distributed exactly-once execution. S13O must never emit such a claim.

### AR-R22 — Idempotency evidence is scoped and opaque
Key/scope evidence must bind the same operation and request fingerprint using safe opaque refs/hashes. Raw keys, secrets, headers and credential material are forbidden in S13O state/evidence.

### AR-R23 — Reconciliation evidence controls ambiguity resolution
Only trusted evidence bound to the same operation/attempt may prove `APPLIED`, `NOT_APPLIED` or safe replay. Missing/mismatched reconciliation remains inconclusive.

### AR-R24 — Pre-dispatch cancellation can cancel safely
A cancellation request before dispatch may produce `CANCEL` because no remote effect has been sent.

### AR-R25 — Post-dispatch cancellation is not automatic cancellation
A cancellation request after dispatch without explicit acknowledgement/terminal evidence produces `RECONCILE`, not `CANCELLED` fiction and not a retry.

### AR-R26 — Success-after-cancel race is reported truthfully
If success is later observed, the result remains success/`COMPLETE` with a cancellation-race limitation; do not retroactively mark it cancelled.

### AR-R27 — Async-job transitions are explicit
The decision may derive only a legal transition among the canonical in-memory job projection states. Transition validation is deterministic and fail-closed.

### AR-R28 — Terminal job states do not retry
`SUCCEEDED`, `FAILED`, `CANCELLED` and `BLOCKED` are terminal for the supplied job projection. S13O does not silently reopen them.

### AR-R29 — No durable queue/store claim
S13O v1 defines an in-memory/reference job envelope and transition contract only. It does not implement durable queues, workers, leases, distributed locks, durable dedupe or resume storage.

### AR-R30 — Job/retry state is minimal
Store only bounded safe identifiers, timing, classifications, counters, fingerprints and evidence refs. Do not persist raw request/response secrets merely for retryability.

### AR-R31 — Authority is attempt-invariant
A retry cannot gain a broader caller, tenant, capability, side-effect or policy authority than the original authorized operation.

### AR-R32 — Approval must still be valid for retry
If the upstream security contract requires approval, the next attempt needs a current approved evidence ref. Approval is not consumed once and then assumed forever.

### AR-R33 — Retry cannot widen capabilities
S10/S13L capability and side-effect intersections remain unchanged for every attempt. S13O cannot add a capability or side-effect class to make a retry possible.

### AR-R34 — Secret material never enters reliability state
Credentials, auth headers, cookies, tokens, private keys, raw idempotency secrets and sensitive payloads are forbidden in keys, job state, attempt records, reasons and handoffs.

### AR-R35 — Retry is not semantic replanning
Transport/infrastructure repetition under the same operation/input is distinct from changing the plan/task/tool choice. Semantic replanning remains S09/agent reasoning and debugging remains S13M.

### AR-R36 — S13L remains the security owner
S13O consumes existing authority/approval/effect constraints. It must not weaken or re-author security policy.

### AR-R37 — S13P boundary remains intact
No tracing SDK, exporter, dashboard, durable metrics, sampling or observability platform is introduced. Existing safe events may be consumed as bounded evidence only.

### AR-R38 — S14 boundary remains intact
No MCP, connector, OAuth/auth binding, HTTP-client binding, dynamic tool discovery or provider-specific executor is introduced.

### AR-R39 — S15 boundary remains intact
No verifier Agent is introduced. Fresh bootstrap verification remains an external process.

### AR-R40 — Provider neutrality
Canonical semantics require no model, queue, workflow, database, HTTP-client, tracing, CI or repository vendor.

### AR-R41 — Structural validation is total and fail-closed
Unknown enums, duplicate/non-contiguous attempts, invalid timing, non-finite/negative budgets, impossible job transitions, malformed evidence/fingerprints or inconsistent bindings return deterministic `BLOCKED` and must not throw.

### AR-R42 — Inputs are immutable
The operation, attempts, job, policy, authority and evidence projections are not mutated by classification/gating/comparison.

### AR-R43 — Actual candidate is gated and recomputed
The candidate parsed from the actual S12 → S10 → S09 selected-Skill path must be validated. Candidate status/action/class/delay/job-state claims are recomputed from the bounded input; no separately synthesized faithful substitute is inserted.

### AR-R44 — Status/action consistency is deterministic
`INCONCLUSIVE` requires `RECONCILE`; `BLOCKED` cannot authorize `RETRY`; `RETRY` requires one valid next attempt number and delay; `COMPLETE` requires observed success.

### AR-R45 — Uncertainty is preserved
Unknown remote outcome, missing trusted reconciliation evidence, cancellation ambiguity or unresolved idempotency mismatch cannot be narrated away into `READY` retry/success/cancel.

### AR-R46 — Skill-vs-no-Skill uses the same path
Reference A/B keeps task/input/provider/runtime/parser/candidate gate/deterministic evaluator/hidden truth identical. Only selected Skill prose/availability differs.

### AR-R47 — Provider fixtures are packet-derived, not Skill-presence oracles
The reference provider may use visible input plus generic selected Skill guidance. It must not branch on hidden fixture ID, expected decision, truth, `with_skill`, Skill ID/name or mere Skill presence as an answer key.

### AR-R48 — Improvement must be distributed
Bootstrap impact requires improvement across multiple semantic dimensions and multiple assertion IDs, with no atomic regressions or unsafe counter.

### AR-R49 — Atomic ownership is isolated
Every canonical atomic comparison field owns a detached source fact; mutating one underlying fact and recomputing the evaluator changes exactly that assertion and no sibling/cross-cutting assertion.

### AR-R50 — Fresh independent verification closes S13O
Builder QA, fixture PASS and impact PASS are not bootstrap closure. A different fresh non-authoring, non-fork, read-only verifier must independently reproduce the evidence.

## Canonical procedure

```text
AR-P1  Validate one AsyncReliabilityInput and exact latest-attempt/job/operation bindings.
AR-P2  Freeze/read only the bounded policy, timing, side-effect, authority and evidence projections.
AR-P3  Recompute the normalized reliability failure class from observed facts.
AR-P4  Apply cancellation/success precedence without rewriting observed outcomes.
AR-P5  Determine retry eligibility independently of retryable_hint.
AR-P6  Enforce max_attempts, max_elapsed_ms and effective deadline.
AR-P7  Compute bounded deterministic backoff and apply Retry-After as a minimum wait.
AR-P8  Evaluate side-effect/idempotency/reconciliation replay safety.
AR-P9  Preserve authority/approval/capability restrictions for the next attempt.
AR-P10 Derive exactly one next action and one legal next job state.
AR-P11 Preserve ambiguous outcomes/limitations as INCONCLUSIVE + RECONCILE.
AR-P12 Validate the actual candidate; recompute status/action/class/delay/job transition.
AR-P13 Return safe evidence refs, blockers, limitations and residual unknowns only.
AR-P14 Perform no external side effect.
```

## Status policy

### `READY`

Use when the input is structurally valid and there is enough evidence to choose one safe deterministic next action. `READY` may accompany `COMPLETE`, `RETRY`, `CANCEL`, `STOP` or `BLOCK`.

### `INCONCLUSIVE`

Use only when the exact remote/side-effect outcome cannot be established safely and reconciliation is required. The action must be `RECONCILE`.

### `BLOCKED`

Use when structural validation fails, a requested policy is unsafe/impossible, required authority/evidence is malformed, or the request requires a forbidden S13P/S14/S15/platform/Core semantic change.

## Reference backoff rule

For retry ordinal `r` where the first retry has `r = 1`:

```text
FIXED:
  policy_delay = base_delay_ms

EXPONENTIAL:
  policy_delay = min(max_delay_ms,
                     ceil(base_delay_ms * multiplier^(r - 1)))

final_delay = max(policy_delay, retry_after_ms ?? 0)
```

`final_delay` must fit inside both remaining elapsed-budget time and the effective deadline. `retry_after_ms` is not capped downward to force a retry.

## Canonical job states

```text
PENDING
RUNNING
WAITING_RETRY
RECONCILING
SUCCEEDED
FAILED
CANCELLED
BLOCKED
```

Allowed transitions in v1:

```text
PENDING       → RUNNING | CANCELLED | BLOCKED
RUNNING       → WAITING_RETRY | RECONCILING | SUCCEEDED | FAILED | CANCELLED | BLOCKED
WAITING_RETRY → RUNNING | CANCELLED | FAILED | BLOCKED
RECONCILING   → RUNNING | SUCCEEDED | FAILED | CANCELLED | BLOCKED
```

Terminal states have no outgoing transition.

## Required reference fixture coverage

Part B must implement at minimum:

- 12 positive/evaluable reliability cases spanning completion, transient retry, rate limit, timeout, read/idempotent/non-idempotent/external effects, reconciliation, cancellation races and job transitions;
- 46 exact negative fixtures/probes covering malformed/unknown input, unauthorized retry, budget/deadline/backoff failures, side-effect/idempotency ambiguity, authority/secrets, cancellation/job errors, provider/arm contamination and future-stage pull-forward;
- 30 detached atomic mutation/isolation probes, one for every canonical atomic assertion in the Quality Contract;
- a genuine same-path Skill-vs-no-Skill evaluation through S12 → S10 → S09 → actual candidate → validation/gate → deterministic evaluator;
- packet-derived truth-blind provider fixtures; Skill presence alone cannot determine answers;
- no production/dev dependency addition and no S13O/Core special branch unless a new ChatGPT semantic gate explicitly authorizes it;
- full-suite pre/post clean-build verification plus fresh independent non-authoring verification.

## Non-goals

S13O v1 does not:

- execute production retries;
- add model/tool/network cancellation transport;
- add `AbortSignal` plumbing to Core;
- create or modify AgentDefinition reliability fields;
- implement HTTP clients;
- implement queue/worker/durable scheduler infrastructure;
- implement a database-backed idempotency store;
- guarantee distributed exactly-once execution;
- create telemetry/monitoring;
- create MCP/connectors/auth;
- create a verifier Agent;
- debug root cause or replan tasks.

## Handoff

If the requested reliability behavior requires real transport cancellation, durable queues/workers, durable deduplication/idempotency storage, connector-specific Retry-After parsing/auth, telemetry infrastructure, a new AgentDefinition schema or Core runtime hooks, return a bounded `BLOCKED`/handoff reason and require a new semantic owner/gate rather than silently implementing it.
