# S13O CHATGPT AUTHORING PREFLIGHT

## Step and purpose

S13O — async-reliability. This is a factual authoring preflight, not canonical
semantics and not an implementation authorization. Its purpose is to give ChatGPT
the repository evidence needed to define the next reliability/execution-mechanics
layer without duplicating S09 or pulling S13P/S14/S15 forward.

## A. Verified repository state

- At preflight start, `HEAD == origin/main == 73739aa59c3d2a2c44b4b980305746863a9808ec`
  on branch `main` after `git fetch --prune`.
- The tracked worktree is clean. Thirteen pre-existing root-level untracked Markdown
  scaffolds remain; this preflight neither changes nor removes them.
- Current shell toolchain: Node `v24.18.0`, npm `11.16.0`.
- `package.json` is TypeScript/ESM/Vitest based. Installed top-level dependencies are
  `better-sqlite3`, `js-yaml`, TypeScript, Vitest, and their type packages; there is
  no retry, queue, HTTP-client, workflow, telemetry, connector, or provider-SDK package.
- `brain-bootstrap/STATE.yaml` records S00–S13N `PASS` / `VERIFIED_PASS` and S13O
  `NOT_STARTED`. `brain/context/CURRENT.md` independently says only this preflight/
  authoring-gate preparation is eligible.
- S13N closure is verified in
  `brain/context/handoffs/2026-08-31T015223Z-s13n-verified-pass-closure.md` and
  `brain-bootstrap/reports/S13N-agent-evals-verification.md`. It was accepted in
  Issue #1 comment `5472786135`; closure relay `5472862485` records the current SHA.
- Controlling Issue #1 comment `5472865743` authorizes S13O preflight only. It
  explicitly forbids implementation, Core/runtime/provider/dependency changes, and
  later-stage work until a canonical ChatGPT Part A is authored and integrated.

## B. Existing reusable surfaces

| Surface | Existing fact relevant to S13O |
| --- | --- |
| `brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md` | S09 owns generic turns, deadline `start + timeout_ms`, terminal explanation, event log and provider-neutral contracts. |
| `src/core/agent/types.ts` | `AgentRunLimits` has `max_turns`/whole-run `timeout_ms`; model/tool normalized errors have existing code unions and a `retryable` Boolean; tool descriptors have `side_effects` and optional `timeout_ms`. |
| `src/core/agent/runtime.ts` | `runAgent()` passes remaining time to model calls, caps a tool invocation at descriptor/run remaining time, records timeout after awaited calls, and immediately terminalizes model/tool `FAIL` or `BLOCKED`. It contains no retry loop, cancellation, idempotency key, job state, backoff, or persistence. |
| `brain-bootstrap/specs/AGENT_DEFINITION_v1.md`, `src/core/agent/definition.ts`, `validateDefinition.ts` | S10 validates only `max_turns >= 1`, `timeout_ms >= 1`, terminal-explanation policy, declared capability IDs and the existing side-effect vocabulary. It has no retry/deadline/idempotency/job configuration. |
| `src/core/agent/restrictedCapabilityProvider.ts`, `compileDefinition.ts` | Generic compilation applies the capability and side-effect allowlists on every invocation. It is the existing safety boundary; it neither widens permissions nor retries. |
| `brain-bootstrap/specs/SKILL_CONTRACT_v1.md`, `src/providers/skill/localReferenceSkillProvider.ts`, `src/intelligence/skills/selectSkillForTask.ts` | S12 separates metadata discovery from lazy selected-Skill load. A future S13O Skill can reuse that registry pattern, but a Skill is knowledge/policy data rather than an execution engine. |
| `brain-bootstrap/specs/BACKEND_API_ENGINEERING_CONTRACT_S13I.md` | Existing API-planning vocabulary distinguishes `READ_ONLY`, `IDEMPOTENT_WRITE`, `NON_IDEMPOTENT_WRITE`, and `EXTERNAL_SIDE_EFFECT`; retryable non-idempotent/external work requires idempotency or an `S13O` handoff. S13I deliberately implements neither a retry mechanism nor store. |
| `brain-bootstrap/specs/POSTGRES_DATA_MODELING_CONTRACT_S13J.md` | `SERIALIZABLE` planning requires an explicit anomaly/invariant plus an S13O retry handoff, not a database runtime. |
| `brain-bootstrap/specs/FRONTEND_PRODUCT_SURFACE_CONTRACT_S13K.md` | UI-level retry affordances require authorization; safe read/idempotent retry may pass, unsafe non-idempotent retry blocks, and duplicate submit is normally disabled while pending. It creates no retry runtime. |
| `brain-bootstrap/specs/GUARDRAILS_SECURITY_CONTRACT_S13L.md` | Permission is an allowlist/side-effect intersection; high/destructive action has approval and recovery evidence requirements; it has no execution reliability system. |
| `brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md` | Treats S09 `retryable` only as metadata and rejects interpreting it as a retry engine. |
| `brain-bootstrap/specs/AGENT_EVALS_CONTRACT_S13N.md` | Labels S13O `async-reliability`; S13N may evaluate observed timeout/max-turn outcomes but must not implement orchestration, retries, backoff, idempotency, jobs, or failure-state machinery. |

## C. Existing semantics that constrain S13O

- S09's whole-run timeout, max-turn outcome and `SUCCESS | FAIL | BLOCKED` terminal
  vocabulary remain canonical. Its current `retryable` flags are hints/metadata, not
  authorization to repeat work. A timeout is presently terminal and can occur before
  or after an awaited model/tool call; the latter does not establish whether a remote
  side effect completed.
- S10's limits are execution ceilings, not a parallel terminal-outcome vocabulary.
  Its declared capability/side-effect restrictions and S13L's least-privilege
  intersection must apply unchanged on every attempt; a retry cannot gain capability,
  side-effect, caller, or approval authority.
- S13I owns API contract planning and its side-effect/idempotency seam, including
  `DEFERRED_TO_S13O`; S13O must not turn S13I plans into an HTTP server, data port,
  rate limiter, OpenAPI generator, or connector.
- S13K owns user-interface intent, including retry/cancel presentation and duplicate
  submit affordances, not server/runtime mechanics.
- S13L is the established security constraint for side effects, approvals, secrets
  and recovery evidence. S13O must consume or preserve those constraints rather than
  weaken or recreate an auth/security platform.
- S13M owns bounded debugging/reproduction and S13N owns evaluation of completed
  runs. Neither becomes a retry executor or a general telemetry system.

## D. Candidate ownership matrix — questions for ChatGPT, not decisions

| Concern | Evidence-based candidate S13O responsibility | Existing/later boundary or unresolved choice |
| --- | --- | --- |
| Whole-agent deadline | Reconcile any reliability orchestration with S09's existing whole-run deadline and terminal explanation. | S09 already owns the base deadline/outcome; decide whether S13O extends enforcement or only supplies a layer around it. |
| Per-model-call timeout | Define whether a provider call gets an independently enforceable budget and how it relates to remaining run time. | S09 supplies only remaining time to `ModelProvider`; actual cancellation/transport enforcement is absent. |
| Capability/external HTTP timeout | Define policy envelope or propagation rules, if any. | S09 caps `ToolInvocationRequest.timeout_ms`; S14 later binds concrete capabilities/connectors and an HTTP client does not exist. |
| Async-job timeout/deadline | Decide whether S13O defines a bounded job state model, deadline propagation and terminal ambiguity. | Durable queues, workers and connector-specific polling are not present; ownership split with later orchestration/infrastructure is unresolved. |
| Model/tool/infrastructure retries | Potentially classify eligible normalized failures and bind attempts to safety/idempotency evidence. | S09 has codes and `retryable`, but no retry action; semantic replanning is not the same as transport retry and needs explicit treatment. |
| Backoff | Potentially specify a bounded, deterministic policy interface. | Fixed/exponential/jitter, `Retry-After`, elapsed budget and fairness are not decided by repository truth. |
| Idempotency | Bridge S13I's four API side-effect/idempotency classes to attempt safety, duplicate suppression and ambiguity handling. | Existing Core has only `NONE | LOCAL | EXTERNAL`; whether keys/store scopes belong in S13O, connector/infrastructure, or both is unresolved. Never infer exactly-once from a local attempt record. |
| Cancellation | Define caller/job cancellation meaning, propagation and race outcomes if S13O owns jobs. | S09 has no cancellation signal or terminal reason. S13K has presentation-level cancel intent only. |
| Retry budgets | Bound attempt count and elapsed time to prevent storms/amplification. | Exact fields, defaults and configuration surface require Part A. |
| Side-effect safety | Require attempt-level authority preservation and safe classification before repeat. | S10/S13L own existing permission/approval semantics; S13O must not invent an authorization bypass. |

## E. Open semantic questions requiring ChatGPT authoring

1. Is S13O `SKILL_ONLY` plus a runtime-neutral reliability library, a Core extension,
   a new AgentDefinition configuration surface, or a combination? Repository facts
   prove none of these choices.
2. What is the authoritative taxonomy and precedence for transient, permanent,
   rate-limited, timeout, cancelled, policy-blocked, invalid input, auth failure,
   unknown outcome and side-effect ambiguity? No production enum may be inferred
   from this preflight.
3. Which S09 model/tool errors are retry candidates, which retry requires an
   idempotency proof/key, and which must terminalize or require human/policy action?
4. Are model retries, capability retries, HTTP/network retries, job recovery and
   semantic replanning separate objects with separate budgets and traces?
5. What timeout/cancellation semantics are truthful after a request may have reached
   a remote system, and how should success-after-cancel or timeout-after-dispatch be
   represented without false exactly-once claims?
6. Are idempotency keys caller-, operation-, job- or connector-scoped; when may a
   key be reused; and where is duplicate suppression durably owned?
7. Does S13O own only an in-process deterministic reference mechanism, a generic
   durable job envelope/state machine, or merely contracts for later infrastructure?
8. What bounded configuration belongs in S10 `AgentDefinition` versus an operation
   policy/capability descriptor/Skill-derived plan? No silent S10 schema change is
   authorized.

## F. Core-change analysis

No Core change is established as necessary by present repository truth.

| Potential change | Necessity evidence | Risk/alternative |
| --- | --- | --- |
| Preserve S09 Core unchanged; implement a narrow library/policy outside Core | Current S09 already accepts provider-neutral errors, deadlines and tool timeout budgets. This is the lowest-regression option for deterministic S13O reference behavior. | Cannot itself preempt an awaited model promise or provide durable job semantics; may be insufficient if Part A requires those guarantees. |
| Add generic retry/deadline/cancellation hooks to `src/core/agent` | Only potentially justified if canonical S13O requires runtime-wide enforcement across model/tool attempts. | Directly risks S09 timeout/termination contracts and S10 generic compilation. Must remain provider-neutral and identity-neutral; ChatGPT must specify all semantics before implementation. |
| Extend `AgentDefinition` | Only potentially justified if reliability is declared agent policy rather than per operation/job policy. | Risks changing S10's validated schema and placing connector/job details in Intelligence config. A separate policy object or capability contract may be safer. |
| Durable job abstraction outside Core | Could allow a future generic job state machine without altering S09's synchronous run. | No persistence/queue provider exists; may prematurely create workflow/orchestration or connector infrastructure. Scope split needs authoring. |

## G. Dependency analysis

No dependency was added. Repository-native TypeScript plus standard Node facilities and
small deterministic primitives are sufficient for a bounded reference policy, attempt
counter, elapsed-budget calculation and deterministic test clock. They are not evidence
that production cancellation, HTTP timeout, durable deduplication or a job queue can be
safely implemented without further contracts.

If ChatGPT later finds a package necessary, it should name the exact gap, candidate,
benefit, operational/security risk and why a local primitive is insufficient. Candidate
classes—not recommendations—include an HTTP client with `AbortSignal` support, a queue
adapter, or a storage-backed idempotency provider. A dependency must not be selected in
Part B without a new authoring decision.

## H. Security and safety constraints evidenced by prior contracts

- A destructive/non-repeatable or external side effect must never be blindly retried.
  S13I already blocks retryable `NON_IDEMPOTENT_WRITE` and `EXTERNAL_SIDE_EFFECT`
  without idempotency/handoff; S13K blocks unsafe retry affordances.
- Recheck the same capability, side-effect, caller/policy and approval constraints on
  every attempt. S10/S13L allowlists are intersections, not a one-time widening grant.
- Do not put credentials, authorization headers, cookies, tokens or secret material in
  retry keys, attempt/job state, events or handoffs. S13I/S13L explicitly protect
  secret/log boundaries.
- Treat timeout after dispatch as an unknown/ambiguous remote outcome until an
  operation-specific reconciliation contract proves otherwise; do not claim exactly-once.
- Bound attempt count, elapsed retry time, concurrent duplicate work and retry fan-out
  to prevent loops, storms and amplification.
- Keep async payload/state minimal and redacted; do not add a telemetry/event-export
  system while implementing reliability semantics.

## I. Later-stage boundaries

- **S13P:** no telemetry SDK, tracing, exporters, monitoring dashboard, durable metrics,
  sampling or observability platform. Existing S09 events/optional usage remain inputs.
- **S13Q/S13R:** STATE marks both `NOT_STARTED`; do not create delivery/demo/deployment
  systems or deployment runtime.
- **S14:** no Capability Registry, MCP/connector integration, OAuth/auth binding,
  dynamic tool discovery, HTTP provider binding or connector-specific execution.
- **S15:** no verifier Agent. The established fresh independent verifier is a process,
  not an implementation target.
- **Other existing stages:** do not reimplement S13I API planning, S13J database/transaction
  planning, S13K frontend policy, S13L security policy, S13M debugging or S13N evaluation.

## J. Provisional Part A artifact names

Following the S13K–S13N naming convention and S13N's explicit label
`async-reliability`, ChatGPT may confirm or replace these path candidates in a byte-ready
transfer. This preflight authors none of them:

1. `brain-bootstrap/skills/ASYNC_RELIABILITY_SKILL_S13O.md`
2. `brain-bootstrap/quality-contracts/S13O_ASYNC_RELIABILITY_<DEPTH>.yaml`
3. `brain-bootstrap/specs/ASYNC_RELIABILITY_CONTRACT_S13O.md`

## K. Non-binding Part B inventory

After Part A only, likely files to assess (not create now) are a typed S13O Intelligence
Skill projection/catalog append, an `src/intelligence/async-reliability/` policy/model/
validator/comparison area, deterministic fixtures and focused tests, and a factual
verification report. Only canonical semantics can determine whether generic Core types,
runtime hooks, AgentDefinition validation, provider adapters or any durable storage are
actually needed.

## L. Future Part B verification strategy

- Preserve exact Part A transfer integrity, S12 metadata-only discovery/lazy selected
  load, and S09/S10 provider neutrality with no Skill/role-specific Core branch.
- Test positive and negative classifications separately: retryable/non-retryable,
  rate-limited, deadline exhausted, cancellation, policy-blocked, invalid input,
  unavailable/auth failure, and timeout-after-dispatch ambiguity as canonical Part A
  specifies.
- Prove budgets terminate attempts; no unbounded loop, retry storm, credential retention
  or authorization widening occurs; unsafe/non-idempotent work cannot repeat without
  required idempotency/recovery evidence.
- If jobs are in scope, test state transitions, deduplication, cancellation/deadline
  races, recovery/resume scope and absent/inconclusive reconciliation evidence without
  claiming distributed exactly-once.
- Run relevant focused tests, full pre/post-build suite, clean build and `git diff --check`.
  Use deterministic clocks/fixtures and a fresh independent, non-authoring verifier.
- If the canonical S13 pattern uses Skill-vs-no-Skill evaluation, preserve a genuine
  same-path comparison, frozen truth separation and non-vacuous isolation; do not invent
  fixture counts or thresholds before Part A.

## M. Risks and contradictions

- S09 has a whole-run deadline but awaits model/tool promises; it records expiry after
  return rather than proving transport cancellation. Part A must not overclaim current
  timeout enforcement.
- `retryable` is present in S09 normalized errors but its meaning/action is deliberately
  unspecified; treating it as permission to retry would contradict S13M.
- S09's `NONE | LOCAL | EXTERNAL` is coarser than S13I's API effect vocabulary. A mapping,
  if needed, must be canonical and must not collapse non-idempotent/external risk.
- There is no HTTP transport, job queue, worker, idempotency store or persistence contract
  beyond isolated S07 reference memory. A durable implementation may exceed S13O or pull
  S14/later orchestration forward.
- Existing event logs are not an observability platform; a reliability attempt record
  must avoid leaking secrets or silently becoming S13P telemetry.

## Required ChatGPT action

Inspect this factual handoff against repository truth, resolve the listed semantic-owner
questions, and author complete canonical S13O Part A on an isolated authoring branch.
Return the authoring result only; do not implement Part B or modify `main`.
