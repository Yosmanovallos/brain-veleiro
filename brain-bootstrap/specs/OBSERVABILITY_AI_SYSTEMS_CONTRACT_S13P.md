# Observability for AI Systems Contract — S13P

## 1. Status and authority

```yaml
step: S13P
name: observability-ai-systems
version: 1.0.0
depth: DEEP
classification: SKILL_ONLY
status: AUTHORING_READY
honor_invariant_candidate: HI-051
```

This contract is the semantic authority for S13P. It defines a provider-neutral, bounded and privacy-safe per-run observability model. It does not authorize implementation, persistence, an exporter, a provider integration, a dependency, a Core change, an AgentDefinition change, continuity updates or a closure claim.

Normative words `MUST`, `MUST NOT`, `SHOULD`, `MAY`, `UNKNOWN`, `COMPLETE`, `PARTIAL` and `REJECTED` have their ordinary strict contract meaning.

## 2. Problem statement

The runtime already emits traceable run events and optional usage; adjacent steps already define safe request fields, security rules, eval projections and async job/attempt projections. Those inputs are not automatically a safe observability product. In particular, current event details can contain raw goal/context summaries, model decisions, tool inputs/outputs, provider errors and state patches.

S13P converts only explicit safe projections into a deterministic per-run bundle that can answer:

- Which bounded run and trace did this evidence describe?
- Which prompt/template version, model and capabilities participated?
- Which model/tool/job/attempt transitions were observed?
- Which token, cost and latency values were actually observed?
- Which normalized errors occurred?
- Which evidence was absent, late, rejected, sampled or dropped?
- Which privacy, cardinality, retention and resource policy governed the bundle?

It MUST NOT answer those questions by copying unsafe payloads or inventing missing facts.

## 3. Architectural decision

S13P is `DEEP + SKILL_ONLY` with a pure deterministic reference implementation in Intelligence.

Part B, when separately authorized, may add:

```text
src/intelligence/observability-ai-systems/
├── constants.ts
├── types.ts
├── validateObservabilityPolicy.ts
├── validateSafeObservation.ts
├── buildTraceIndex.ts
├── applyDeterministicSampling.ts
├── aggregateObservedUsage.ts
├── buildObservabilityBundle.ts
└── index.ts
```

It may also add focused tests, deterministic fixtures, one append-only S12 Skill catalog entry, a factual verification report and handoffs required by the control plane.

S13P v1 requires:

- no Core modification;
- no AgentDefinition modification;
- no provider interface;
- no new dependency;
- no durable store, exporter, SDK or network call;
- no concrete telemetry vendor;
- no change to S09, S10, S12, S13I, S13L, S13N or S13O canonical Part A.

If a future implementation claims one of those changes is necessary, it MUST stop and request a separately authored contract revision.

## 4. Ownership and future boundary

### S13P owns

- safe per-run observability vocabulary and schema;
- stable correlation among run, trace, span, model call, tool call, operation, job and attempt refs;
- safe prompt/version and model identity;
- deterministic validation and safe projection;
- bounded per-run token, currency-specific cost, latency and normalized-error aggregation;
- deterministic sampling of eligible success detail;
- cardinality, size and retention directives;
- explicit completeness, missingness and diagnostic evidence.

### S13P does not own

- run execution or retry policy (S09/S13O);
- correctness eval semantics (S13N);
- authentication, connectors or MCPs (S14 and integration steps);
- deployment/delivery (S13Q/S13R and later deployment work);
- durable observability infrastructure, cross-run queries, dashboards, alerts, fleet analytics, resource optimization or automated improvement loops (S20);
- secret detection guarantees, security authorization or policy rewriting (S13L).

## 5. Design principles

1. **Observed beats inferred.** Unknown is preserved.
2. **Safety precedes aggregation.** Rejected data never contributes to metrics.
3. **Opaque references beat content.** Prompt/tool/error payloads stay outside the bundle.
4. **Sequence beats wall-clock guesswork.** Timestamps add evidence but do not rewrite order.
5. **Partial is a valid truthful state.** Missing evidence is not silently repaired.
6. **Budgets are part of correctness.** Unbounded telemetry is a failure.
7. **Determinism enables verification.** No hidden clock, randomness or external lookup.
8. **The candidate cannot grade itself.** External gates recompute claims.

## 6. Normative vocabulary

| Term | Meaning |
|---|---|
| Safe ref | Opaque, bounded, non-secret identifier matching the v1 grammar and created outside S13P. |
| Observation | One validated, safe, immutable fact associated with a run/trace. |
| Candidate | Caller-supplied value not yet accepted by S13P validation. |
| Bundle | Ordered safe observations, aggregates, coverage, policy and diagnostics for one run. |
| Required observation | Lifecycle, terminal, error, safety/policy or drop-summary evidence that cannot be sampled out. |
| Optional detail | Successful model/tool/prompt detail that may be deterministically sampled or dropped under budget. |
| Unknown | Not observed or not validly available; distinct from zero, empty, success and failure. |
| Complete | Required identities and lifecycle evidence are present and no required evidence is missing/dropped. |
| Partial | Trustworthy bounded evidence exists, but explicitly identified evidence is missing, late, rejected or omitted. |
| Rejected | A bundle cannot be trusted because a hard identity, safety, structure or bound invariant failed. |

## 7. Constants and limits

The v1 ceilings are normative:

```ts
export const S13P_LIMITS = {
  maxObservationsPerRun: 512,
  maxSpansPerRun: 256,
  maxPromptRefsPerRun: 32,
  maxModelRefsPerRun: 16,
  maxCapabilityRefsPerRun: 64,
  maxErrorCodesPerRun: 32,
  maxCurrenciesPerRun: 4,
  maxEvidenceRefsPerObservation: 8,
  maxEvidenceRefsPerRun: 256,
  maxSafeRefLength: 128,
  maxCodeLength: 64,
  maxBundleBytes: 262_144,
  maxDurationMs: 604_800_000,
  maxOperationalRetentionDays: 7,
  maxAuditRefRetentionDays: 30,
  samplingBasisPointsMax: 10_000,
} as const;
```

A policy override MUST be stricter than or equal to these values. It MUST NOT raise a ceiling.

Safe refs MUST match `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`. Normalized codes MUST match `^[A-Z][A-Z0-9_]{0,63}$`. Those grammars are necessary but not sufficient: values MUST also be opaque and non-secret. Email addresses, URLs, filesystem paths, query strings, bearer values and human-authored payloads are not safe refs.

## 8. Canonical types

The following TypeScript shapes are semantic contracts, not an implementation mandate about file layout.

```ts
export type SafeRef = string;
export type UtcTimestamp = string;

export type BuildStatus = "COMPLETE" | "PARTIAL" | "REJECTED";
export type ObservationSource =
  | "RUNTIME_S09"
  | "API_S13I"
  | "EVAL_S13N"
  | "ASYNC_S13O"
  | "CALLER_SAFE";

export type ObservationKind =
  | "RUN_STARTED"
  | "RUN_TERMINATED"
  | "PROMPT_RESOLVED"
  | "MODEL_CALL_STARTED"
  | "MODEL_CALL_COMPLETED"
  | "TOOL_CALL_STARTED"
  | "TOOL_CALL_COMPLETED"
  | "USAGE_OBSERVED"
  | "COST_OBSERVED"
  | "LATENCY_OBSERVED"
  | "ERROR_OBSERVED"
  | "OPERATION_OBSERVED"
  | "JOB_OBSERVED"
  | "ATTEMPT_OBSERVED"
  | "POLICY_VIOLATION"
  | "OBSERVATION_DROPPED_SUMMARY";

export interface SafeRunIdentity {
  readonly runId: SafeRef;
  readonly traceId: SafeRef;
  readonly taskRef?: SafeRef;
  readonly agentDefinitionRef?: SafeRef;
  readonly agentDefinitionVersion?: SafeRef;
  readonly skillRefs?: readonly SafeVersionedRef[];
  readonly evalRef?: SafeRef;
}

export interface SafeVersionedRef {
  readonly ref: SafeRef;
  readonly version: SafeRef;
  readonly digest?: `sha256:${string}`;
}

export interface SafeObservationBase {
  readonly schemaVersion: "s13p.observation.v1";
  readonly observationId: SafeRef;
  readonly runId: SafeRef;
  readonly traceId: SafeRef;
  readonly spanId?: SafeRef;
  readonly parentSpanId?: SafeRef;
  readonly missingParent?: boolean;
  readonly sequence: number;
  readonly occurredAt: UtcTimestamp;
  readonly observedAt: UtcTimestamp;
  readonly source: ObservationSource;
  readonly kind: ObservationKind;
  readonly evidenceRefs?: readonly SafeRef[];
  readonly priority: "REQUIRED" | "NORMAL" | "DETAIL";
}

export type SafeObservationCandidate =
  | RunLifecycleObservation
  | PromptObservation
  | ModelObservation
  | ToolObservation
  | UsageObservation
  | CostObservation
  | LatencyObservation
  | ErrorObservation
  | AsyncCorrelationObservation
  | PolicyObservation
  | DroppedSummaryObservation;
```

No observation type has an index signature. Unknown keys are invalid.

`priority` is declarative input only. The builder MUST recompute the effective
priority from kind, phase and outcome. A candidate priority that attempts to
downgrade never-drop evidence is invalid and MUST NOT influence sampling.

### 8.1 Lifecycle

```ts
export interface RunLifecycleObservation extends SafeObservationBase {
  readonly kind: "RUN_STARTED" | "RUN_TERMINATED";
  readonly phase: "STARTED" | "TERMINAL";
  readonly terminalReason?:
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "BUDGET_EXHAUSTED"
    | "POLICY_BLOCKED"
    | "UNKNOWN";
  readonly outcome?: "SUCCESS" | "FAILURE" | "CANCELLED" | "INCONCLUSIVE";
}
```

`RUN_TERMINATED` requires both `terminalReason` and `outcome`. They MUST NOT be inferred from the absence of an error.

### 8.2 Prompt/version

```ts
export interface PromptObservation extends SafeObservationBase {
  readonly kind: "PROMPT_RESOLVED";
  readonly promptRef: SafeRef;
  readonly promptVersion: SafeRef;
  readonly templateDigest?: `sha256:${string}`;
  readonly componentRefs?: readonly SafeVersionedRef[];
}
```

`templateDigest`, when supplied, MUST be `sha256:` plus exactly 64 lowercase hexadecimal characters. It may cover only an approved canonical template or schema, never secret-bearing content, raw user input or a direct personal identifier. S13P never computes a digest from prohibited content.

### 8.3 Model call

```ts
export interface ModelObservation extends SafeObservationBase {
  readonly kind: "MODEL_CALL_STARTED" | "MODEL_CALL_COMPLETED";
  readonly callId: SafeRef;
  readonly phase: "STARTED" | "COMPLETED";
  readonly providerRef: SafeRef;
  readonly modelRef: SafeRef;
  readonly modelVersionRef?: SafeRef;
  readonly outcome?: "SUCCESS" | "FAILURE" | "CANCELLED" | "INCONCLUSIVE";
  readonly durationMs?: number;
}
```

Provider account, tenant, organization, endpoint, region, API key and raw response metadata are forbidden.

### 8.4 Tool call

```ts
export interface ToolObservation extends SafeObservationBase {
  readonly kind: "TOOL_CALL_STARTED" | "TOOL_CALL_COMPLETED";
  readonly callId: SafeRef;
  readonly capabilityId: SafeRef;
  readonly phase: "STARTED" | "COMPLETED";
  readonly sideEffectClass: "NONE" | "READ" | "REVERSIBLE_WRITE" | "IRREVERSIBLE_WRITE";
  readonly outcome?: "SUCCESS" | "FAILURE" | "CANCELLED" | "INCONCLUSIVE";
  readonly inputSchemaRef?: SafeRef;
  readonly outputSchemaRef?: SafeRef;
  readonly durationMs?: number;
  readonly errorCode?: string;
}
```

Arguments, results, command text, headers, bodies and environment values are forbidden.

### 8.5 Tokens and cost

```ts
export interface UsageObservation extends SafeObservationBase {
  readonly kind: "USAGE_OBSERVED";
  readonly callId: SafeRef;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
  readonly cachedInputTokens?: number;
  readonly sourceAuthority: "RUNTIME" | "PROVIDER_REPORTED";
}

export interface CostObservation extends SafeObservationBase {
  readonly kind: "COST_OBSERVED";
  readonly callId?: SafeRef;
  readonly amount: string;
  readonly currency: string;
  readonly sourceAuthority: "RUNTIME" | "PROVIDER_REPORTED" | "INVOICE_EVIDENCE";
  readonly pricingRef?: SafeRef;
}
```

Token values MUST be non-negative safe integers. If `cachedInputTokens` and `inputTokens` are both present, cached input MUST NOT exceed input. If input, output and total are present, total MUST equal input plus output. Missing fields remain absent.

Cost `amount` MUST match `^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$`; exponent notation, signs, commas and negative values are invalid. `currency` MUST match `^[A-Z]{3}$`. S13P validates shape, not legal-tender status.

### 8.6 Latency

```ts
export interface LatencyObservation extends SafeObservationBase {
  readonly kind: "LATENCY_OBSERVED";
  readonly operationKind: "RUN" | "MODEL_CALL" | "TOOL_CALL" | "API" | "JOB" | "ATTEMPT";
  readonly operationRef: SafeRef;
  readonly durationMs: number;
  readonly clockSource: "MONOTONIC" | "PROVIDER_REPORTED" | "WALL_CLOCK_DERIVED";
  readonly startedAt?: UtcTimestamp;
  readonly endedAt?: UtcTimestamp;
}
```

Duration MUST be a non-negative safe integer at or below the v1 ceiling. `WALL_CLOCK_DERIVED` requires valid start/end instants and exact millisecond agreement. Other clock sources MUST NOT be recalculated from wall-clock timestamps.

### 8.7 Error

```ts
export interface ErrorObservation extends SafeObservationBase {
  readonly kind: "ERROR_OBSERVED";
  readonly errorSource: "RUNTIME" | "MODEL" | "TOOL" | "API" | "JOB" | "ATTEMPT" | "POLICY";
  readonly category:
    | "VALIDATION"
    | "AUTHORIZATION"
    | "TIMEOUT"
    | "TRANSIENT"
    | "RATE_LIMIT"
    | "CANCELLED"
    | "POLICY"
    | "PROVIDER"
    | "TOOL"
    | "INTERNAL"
    | "UNKNOWN";
  readonly code: string;
  readonly retryable: true | false | "UNKNOWN";
  readonly fingerprint?: `sha256:${string}`;
  readonly relatedRef?: SafeRef;
}
```

No message or stack field exists. The optional fingerprint may cover only an approved tuple of normalized source/category/code/version refs.

### 8.8 Async correlation

```ts
export interface AsyncCorrelationObservation extends SafeObservationBase {
  readonly kind: "OPERATION_OBSERVED" | "JOB_OBSERVED" | "ATTEMPT_OBSERVED";
  readonly operationRef: SafeRef;
  readonly jobId?: SafeRef;
  readonly attemptId?: SafeRef;
  readonly attemptNumber?: number;
  readonly phase: "QUEUED" | "STARTED" | "COMPLETED" | "FAILED" | "CANCELLED" | "RETRY_SCHEDULED";
  readonly outcome?: "SUCCESS" | "FAILURE" | "CANCELLED" | "INCONCLUSIVE";
  readonly durationMs?: number;
  readonly errorCode?: string;
}
```

This projection correlates S13O facts; it MUST NOT schedule, execute or judge retries.

### 8.9 Policy and dropped summary

```ts
export interface PolicyObservation extends SafeObservationBase {
  readonly kind: "POLICY_VIOLATION";
  readonly policyCode: string;
  readonly disposition: "DROPPED" | "REJECTED" | "DOWNGRADED_TO_PARTIAL";
  readonly affectedObservationRef?: SafeRef;
}

export interface DroppedSummaryObservation extends SafeObservationBase {
  readonly kind: "OBSERVATION_DROPPED_SUMMARY";
  readonly reason: "SAMPLING" | "CARDINALITY" | "SIZE" | "UNSAFE" | "INVALID";
  readonly droppedCount: number;
  readonly droppedKinds: readonly ObservationKind[];
}
```

Dropped summaries contain counts and kinds only, never dropped values.

## 9. Policy

```ts
export interface ObservabilityPolicy {
  readonly policyVersion: "s13p.policy.v1";
  readonly limits: Readonly<typeof S13P_LIMITS>;
  readonly successDetailSamplingBasisPoints: number;
  readonly samplingSeed: SafeRef;
  readonly requestedRetention:
    | { readonly class: "EPHEMERAL"; readonly days: 0 }
    | { readonly class: "OPERATIONAL"; readonly days: number }
    | { readonly class: "AUDIT_REF_ONLY"; readonly days: number };
  readonly allowTemplateDigest: boolean;
  readonly allowErrorFingerprint: boolean;
}
```

Defaults are full capture of eligible bounded success detail (`10_000` basis points) and `EPHEMERAL`. A caller can reduce capture or retention. A future durable layer MUST enforce the returned directive; S13P does not persist.

Sampling uses SHA-256 from Node built-ins over this UTF-8 string:

```text
s13p.policy.v1\n<samplingSeed>\n<runId>\n<observationId>
```

Interpret the first eight digest bytes as an unsigned big-endian integer and retain when `value mod 10_000 < basisPoints`. This rule is deterministic and provider-neutral. It MUST NOT be applied to `priority: REQUIRED` or any never-drop kind.

## 10. Never-drop observations

The following are always required:

- `RUN_STARTED` and `RUN_TERMINATED`;
- `ERROR_OBSERVED`;
- `POLICY_VIOLATION`;
- `OBSERVATION_DROPPED_SUMMARY`;
- failed/cancelled model or tool completion;
- failed/cancelled/retry-exhausted job or attempt evidence;
- any observation referenced as the sole evidence for terminal status.

If required evidence cannot fit the hard ceilings, the bundle is `REJECTED`. It is invalid to sample it away and claim `PARTIAL` or `COMPLETE`.

## 11. Validation order and precedence

The builder MUST use this order:

1. validate top-level shape and policy;
2. validate run/trace identity;
3. validate each candidate against its exact kind schema;
4. reject prohibited/unknown fields before any aggregation;
5. validate refs, codes, numbers, decimals, timestamps and digests;
6. validate unique observation IDs and sequences;
7. validate call phase pairs and span graph;
8. classify never-drop versus eligible detail;
9. apply deterministic sampling;
10. enforce cardinality and byte bounds;
11. aggregate accepted observed facts;
12. calculate coverage and status;
13. freeze output.

Source authority applies only among claims of the same metric and identity:

```text
accepted runtime observation
  > explicitly labeled provider-reported observation
  > derived aggregate of accepted observations
  > unknown
```

`INVOICE_EVIDENCE` may coexist with per-call runtime/provider cost but MUST NOT silently overwrite it. Conflicts are retained as diagnostics and separate provenance groups.

For the same call and currency, the authoritative observed cost follows the
declared source precedence and contributes at most once to the per-call/run
aggregate. Lower-precedence duplicates remain provenance diagnostics and do not
increase the total. Invoice evidence is a separate reconciliation group and is
never added to per-call cost totals unless the canonical input explicitly
represents a non-overlapping charge.

## 12. Trace and phase invariants

- Observation IDs and sequences are unique within a run.
- After numeric sorting, sequences strictly increase.
- `run_id` and `trace_id` match the bundle identity.
- Span IDs are unique and their parent graph is acyclic.
- An unresolved parent is allowed only when `missingParent: true`; this forces `PARTIAL`.
- Completed model/tool calls require a prior matching started observation unless explicitly projected as late/partial evidence; late evidence forces `PARTIAL`.
- Start/completion identities, provider/model refs and capability refs cannot conflict.
- One run may have only one accepted start and one accepted terminal observation.
- Terminal observation must be last among accepted lifecycle state changes.
- `observedAt` earlier than `occurredAt` is a clock-skew diagnostic; sequence remains authoritative.
- No duration is synthesized when its clock evidence is unavailable.

## 13. Privacy and safety contract

### 13.1 Allowed directly

- safe refs and schema/version refs;
- approved enum values;
- timestamps, durations and non-negative counts;
- normalized error/policy codes;
- cost decimal and currency code;
- count-only coverage/drop summaries;
- evidence refs that satisfy safe-ref rules.

### 13.2 Conditionally allowed

- template digest: only approved canonical non-secret template material;
- error fingerprint: only approved normalized tuples;
- operational retention: safe projections only, at most seven days;
- audit retention: refs/outcomes/evidence only, at most thirty days.

### 13.3 Prohibited

- raw or redacted-looking prompt/message/context/retrieved content;
- tool inputs/outputs, commands, paths or environment values;
- HTTP headers/bodies, cookies, credentials or authentication values;
- private keys, tokens, secrets or secret-derived digests;
- provider messages, stack traces or arbitrary metadata;
- emails, personal names or direct identifiers embedded in refs;
- filesystem or network destinations;
- any unknown field.

S13P does not claim universal secret or personal-data detection. The structural allowlist is the primary defense. Any bounded defensive pattern scan is secondary and MUST be described as incomplete. A value that merely passes the grammar is not automatically safe.

## 14. Cardinality, overflow and serialized size

Apply limits after safety validation and before aggregation. Maintain distinct sets for spans, prompt refs, model refs, capability refs, error codes, currencies and evidence refs.

Overflow rules:

1. Never-drop evidence has priority.
2. Eligible `DETAIL` success observations may be deterministically omitted.
3. `NORMAL` success observations may be omitted only after `DETAIL` and only if the policy permits sampling.
4. Every omission increments a count-only dropped summary.
5. If the summary itself or required evidence cannot fit, reject the bundle.
6. The final canonical JSON serialization MUST be at or below 262,144 UTF-8 bytes.

No arbitrary attribute map is supported in v1. This intentionally prevents silent high-cardinality expansion.

## 15. Aggregation

### 15.1 Tokens

Return, per call and for the run:

- observed sum for each present component;
- number of calls with each component observed;
- number of calls missing each component;
- consistency diagnostics.

Do not turn incomplete coverage into a full-run total claim. A numeric sum may be returned as `observedSum` with coverage metadata.

### 15.2 Cost

Use exact decimal arithmetic, not binary floating point. Group by currency and source authority. Return:

```ts
interface CurrencyCostAggregate {
  currency: string;
  observedAmount: string;
  observationCount: number;
  callsWithCost: number;
  callsMissingCost: number;
}
```

No cross-currency total exists. No price lookup or FX conversion exists.

### 15.3 Latency

Group by `operationKind` and return observed count, missing count, minimum, maximum and exact integer sum. Average MAY be a rational `{sumMs, count}`; do not require floating-point rounding. Percentiles are outside v1 because this is a bounded per-run bundle, not a cross-run analytics service.

### 15.4 Errors

Count by safe source/category/code/retryability. Do not aggregate raw messages. Conflicting retryability for the same normalized identity is a diagnostic, not a silently selected answer.

## 16. Diagnostics

Diagnostics use fixed codes and never echo rejected values:

```ts
export type ObservabilityDiagnosticCode =
  | "INVALID_POLICY"
  | "INVALID_RUN_IDENTITY"
  | "CROSS_RUN_IDENTITY"
  | "UNKNOWN_FIELD"
  | "PROHIBITED_FIELD"
  | "UNSAFE_REF"
  | "INVALID_DIGEST"
  | "INVALID_TIMESTAMP"
  | "INVALID_DURATION"
  | "DUPLICATE_OBSERVATION_ID"
  | "DUPLICATE_SEQUENCE"
  | "MISSING_PARENT_SPAN"
  | "CYCLIC_SPAN_GRAPH"
  | "INVALID_PHASE_TRANSITION"
  | "MISSING_TERMINAL_OBSERVATION"
  | "LATE_OR_PARTIAL_EVIDENCE"
  | "TOKEN_TOTAL_MISMATCH"
  | "CACHED_TOKEN_MISMATCH"
  | "INVALID_COST"
  | "MIXED_CURRENCY_NO_TOTAL"
  | "CLOCK_SKEW"
  | "METRIC_CONFLICT"
  | "SAMPLED_DETAIL"
  | "CARDINALITY_LIMIT"
  | "SERIALIZED_SIZE_LIMIT"
  | "REQUIRED_EVIDENCE_OVERFLOW"
  | "RETENTION_DOWNGRADED"
  | "OUT_OF_SCOPE_PROVIDER_OR_STORAGE";
```

Each diagnostic contains only code, severity, observation ref when safe, field path from a fixed allowlist and count. It MUST NOT contain the rejected value.

## 17. Build result

```ts
export interface ObservabilityBuildResult {
  readonly schemaVersion: "s13p.bundle.v1";
  readonly policyVersion: "s13p.policy.v1";
  readonly status: BuildStatus;
  readonly run: SafeRunIdentity;
  readonly observations: readonly SafeObservationCandidate[];
  readonly diagnostics: readonly ObservabilityDiagnostic[];
  readonly coverage: ObservabilityCoverage;
  readonly aggregates: ObservabilityAggregates;
  readonly retention: RetentionDirective;
  readonly sampling: SamplingSummary;
  readonly evidenceRefs: readonly SafeRef[];
  readonly serializedBytes: number;
}
```

The implementation MUST return a deeply immutable result or a structurally readonly equivalent. It MUST NOT expose the original candidate objects.

## 18. Status decision table

Evaluate in order:

1. `REJECTED` if policy, run/trace identity, required safety, uniqueness, acyclicity, required phase/terminal semantics or hard bounds fail.
2. `REJECTED` if prohibited content is present in a required observation or if required evidence cannot fit.
3. `PARTIAL` if optional candidates are invalid/rejected, evidence is late, a parent/metric/terminal detail is missing, eligible evidence is sampled/dropped, retention is downgraded or conflicts remain.
4. `COMPLETE` only when all required observations exist, all candidates that claim required coverage are accepted, no required or normal evidence is omitted, trace structure is closed and diagnostics contain no partial/reject condition.

`COMPLETE` is not correctness PASS. It means only that the safe bundle is complete under its declared policy.

## 19. Reference API

The future Part B public seam is:

```ts
export function buildObservabilityBundle(
  input: Readonly<{
    run: SafeRunIdentity;
    observations: readonly SafeObservationCandidate[];
    policy: ObservabilityPolicy;
    evidenceRefs?: readonly SafeRef[];
  }>,
): ObservabilityBuildResult;
```

Pure helpers MAY be exported for deterministic testing, but the catalog-facing Skill must route through the real `buildObservabilityBundle` candidate. Tests and evaluators MUST NOT gate a separately synthesized faithful substitute.

The function MUST NOT:

- call `Date.now`, `new Date()` without caller data or unseeded randomness;
- read environment variables, files, network or secrets;
- mutate inputs;
- persist/export data;
- branch on fixture, arm, expected answer or test name;
- award PASS or HI-051.

## 20. Integration seams

| Seam | S13P rule |
|---|---|
| S09 `AgentRunEvent` / usage | Consume explicit safe projections; never copy `details` wholesale. |
| S10 AgentDefinition | Preserve unchanged; use safe refs outside its schema. |
| S12 Skill registry | One append-only metadata entry; exact lazy load. |
| S13I request/operation fields | Correlate allowlisted refs and observed timing/outcome. |
| S13L security | Apply unchanged; structural allowlist cannot weaken it. |
| S13N observed-run eval | Provide safe evidence; never reimplement eval verdicts. |
| S13O job/attempt | Correlate projections; never perform retry/persistence decisions. |
| S20 | Defer durable/cross-run observability, alerting, dashboards and optimization. |

## 21. Part B deterministic fixtures

### 21.1 Positive fixtures — exactly 14

| ID | Purpose |
|---|---|
| P01 | Minimal complete run start/terminal bundle. |
| P02 | Prompt ref/version/template digest without content. |
| P03 | Model start/completion with observed latency. |
| P04 | Tool start/completion with safe schemas and no payloads. |
| P05 | Partial usage where missing values remain unknown. |
| P06 | Consistent full token components and cache subset. |
| P07 | Single-currency observed cost exact aggregation. |
| P08 | Multi-currency cost grouped with no cross-currency total. |
| P09 | Normalized errors without messages/stacks. |
| P10 | S13O operation/job/attempt correlation. |
| P11 | Explicit missing parent produces truthful partial bundle. |
| P12 | Deterministic sampling produces stable count-only summary. |
| P13 | Cardinality cap drops eligible detail but preserves required evidence. |
| P14 | Audit-ref-only directive permits only refs/outcomes/evidence for future retention and performs no persistence. |

### 21.2 Negative fixtures — exactly 52

| Range | Cases |
|---|---|
| N01–N06 | empty, unsafe, mismatched or cross-run run/trace identity |
| N07–N12 | duplicate observation/sequence/span, cyclic parent, invalid/missing parent declaration, multiple terminal states |
| N13–N20 | raw prompt/message/context, tool input/output, HTTP material, secret value, raw provider error, arbitrary metadata |
| N21–N25 | invalid digest, unsafe prompt/model/provider ref, conflicting model phase, provider account metadata |
| N26–N31 | negative/fractional tokens, inconsistent total, cache greater than input, missing coerced to zero, invented token estimate |
| N32–N37 | invalid decimal, negative cost, inferred pricing, FX conversion, mixed-currency total, excess currencies |
| N38–N42 | invalid timestamp, negative/excess duration, invalid wall-clock derivation, timestamp-based sequence rewrite |
| N43–N46 | invalid error code, raw stack/message, secret-derived fingerprint, conflicting retryability overwrite |
| N47–N49 | required event sampled out, unbounded cardinality, oversized bundle |
| N50–N52 | excessive retention, provider/storage implementation request, self-certified PASS/HI-051 |

The test file MUST name and assert each ID separately. Parameterization is allowed only if individual IDs remain independently reported.

### 21.3 Atomic isolation — exactly 32 assertions

Each semantic assertion listed in the DEEP Quality Contract requires one probe where only that assertion's governing signal changes. The evaluator MUST report `32/32` and prove that unrelated assertion scores do not change.

## 22. A/B impact gate

Use 12 frozen representative scenarios. Score 32 atomic assertions per arm, for a maximum `384` points per arm.

The no-Skill baseline and actual S13P Skill arm MUST use identical inputs, model/runtime policy and hidden-truth isolation. PASS requires:

- actual candidate bundle, not a synthesized substitute;
- Skill total strictly greater than baseline;
- improvement in at least 7 of 10 semantic dimensions;
- at least two distinct improved assertion IDs in every qualified dimension;
- zero assertion/scenario regressions;
- largest single-assertion contribution no more than 0.50 of total positive delta;
- all unsafe counters zero;
- all 32 atomic-isolation probes PASS.

The candidate cannot compute or supply its own gate truth.

## 23. Verification and closure

Future implementation PASS requires all of:

1. canonical Part A files integrated byte-identically and hashed before Part B;
2. YAML parse and cross-reference checks;
3. Skill semantic-shape validation;
4. focused positives `14/14`;
5. focused negatives `52/52`;
6. atomic isolation `32/32`;
7. A/B impact gate PASS;
8. all hard invariants PASS;
9. all unsafe counters zero;
10. actual S12 → S10 → S09 execution using the candidate;
11. typecheck PASS;
12. full suite PASS before clean build;
13. clean build PASS;
14. full suite PASS after build;
15. architecture/dependency/boundary audit PASS;
16. `git diff --check` and Part A hash integrity PASS;
17. fresh independent non-authoring verification;
18. HI-051 awarded only by the independent control-plane closure.

## 24. Non-goals

- Vendor-specific OpenTelemetry or proprietary SDK integration.
- Telemetry collector/exporter, dashboard, alerts or durable data store.
- Raw event-log export.
- Pricing database, FX service or provider billing reconciliation.
- Universal privacy/compliance certification or perfect secret detection.
- S09 runtime, S13N eval or S13O retry reimplementation.
- Capability registry, connector, MCP, auth or deploy work.
- S20 cross-run resource management and improvement orchestration.

## 25. Part A integrity and authoring stop

The canonical Part A is exactly:

- `brain-bootstrap/skills/OBSERVABILITY_AI_SYSTEMS_SKILL_S13P.md`
- `brain-bootstrap/quality-contracts/S13P_OBSERVABILITY_AI_SYSTEMS_DEEP.yaml`
- `brain-bootstrap/specs/OBSERVABILITY_AI_SYSTEMS_CONTRACT_S13P.md`

A future integrator MUST preserve these bytes exactly. Mechanical integration may verify paths, parse syntax and calculate hashes. It MUST NOT normalize, silently revise or reinterpret semantic content. A semantic conflict returns to ChatGPT and stops.

After Part A integration, the agent MUST stop at the repository's next explicit authorization gate. `AUTHORING_READY` does not authorize Part B, state changes, commits, pushes, issue comments or later steps.
