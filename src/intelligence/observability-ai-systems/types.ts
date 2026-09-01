/**
 * S13P — Observability for AI Systems: canonical semantic shapes.
 *
 * These mirror `brain-bootstrap/specs/OBSERVABILITY_AI_SYSTEMS_CONTRACT_S13P.md`
 * section 8 exactly. They are semantic contracts, not a file-layout mandate.
 */

export type SafeRef = string;
export type UtcTimestamp = string;
export type Sha256 = `sha256:${string}`;

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

export type ObservationPriority = "REQUIRED" | "NORMAL" | "DETAIL";
export type Outcome = "SUCCESS" | "FAILURE" | "CANCELLED" | "INCONCLUSIVE";

export interface SafeVersionedRef {
  readonly ref: SafeRef;
  readonly version: SafeRef;
  readonly digest?: Sha256;
}

export interface SafeRunIdentity {
  readonly runId: SafeRef;
  readonly traceId: SafeRef;
  readonly taskRef?: SafeRef;
  readonly agentDefinitionRef?: SafeRef;
  readonly agentDefinitionVersion?: SafeRef;
  readonly skillRefs?: readonly SafeVersionedRef[];
  readonly evalRef?: SafeRef;
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
  readonly priority: ObservationPriority;
}

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
  readonly outcome?: Outcome;
}

export interface PromptObservation extends SafeObservationBase {
  readonly kind: "PROMPT_RESOLVED";
  readonly promptRef: SafeRef;
  readonly promptVersion: SafeRef;
  readonly templateDigest?: Sha256;
  readonly componentRefs?: readonly SafeVersionedRef[];
}

export interface ModelObservation extends SafeObservationBase {
  readonly kind: "MODEL_CALL_STARTED" | "MODEL_CALL_COMPLETED";
  readonly callId: SafeRef;
  readonly phase: "STARTED" | "COMPLETED";
  readonly providerRef: SafeRef;
  readonly modelRef: SafeRef;
  readonly modelVersionRef?: SafeRef;
  readonly outcome?: Outcome;
  readonly durationMs?: number;
}

export interface ToolObservation extends SafeObservationBase {
  readonly kind: "TOOL_CALL_STARTED" | "TOOL_CALL_COMPLETED";
  readonly callId: SafeRef;
  readonly capabilityId: SafeRef;
  readonly phase: "STARTED" | "COMPLETED";
  readonly sideEffectClass: "NONE" | "READ" | "REVERSIBLE_WRITE" | "IRREVERSIBLE_WRITE";
  readonly outcome?: Outcome;
  readonly inputSchemaRef?: SafeRef;
  readonly outputSchemaRef?: SafeRef;
  readonly durationMs?: number;
  readonly errorCode?: string;
}

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

export interface LatencyObservation extends SafeObservationBase {
  readonly kind: "LATENCY_OBSERVED";
  readonly operationKind: "RUN" | "MODEL_CALL" | "TOOL_CALL" | "API" | "JOB" | "ATTEMPT";
  readonly operationRef: SafeRef;
  readonly durationMs: number;
  readonly clockSource: "MONOTONIC" | "PROVIDER_REPORTED" | "WALL_CLOCK_DERIVED";
  readonly startedAt?: UtcTimestamp;
  readonly endedAt?: UtcTimestamp;
}

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
  readonly fingerprint?: Sha256;
  readonly relatedRef?: SafeRef;
}

export interface AsyncCorrelationObservation extends SafeObservationBase {
  readonly kind: "OPERATION_OBSERVED" | "JOB_OBSERVED" | "ATTEMPT_OBSERVED";
  readonly operationRef: SafeRef;
  readonly jobId?: SafeRef;
  readonly attemptId?: SafeRef;
  readonly attemptNumber?: number;
  readonly phase: "QUEUED" | "STARTED" | "COMPLETED" | "FAILED" | "CANCELLED" | "RETRY_SCHEDULED";
  readonly outcome?: Outcome;
  readonly durationMs?: number;
  readonly errorCode?: string;
}

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

export type RetentionClass = "EPHEMERAL" | "OPERATIONAL" | "AUDIT_REF_ONLY";

export interface ObservabilityPolicy {
  readonly policyVersion: "s13p.policy.v1";
  readonly limits: Readonly<Record<string, number>>;
  readonly successDetailSamplingBasisPoints: number;
  readonly samplingSeed: SafeRef;
  readonly requestedRetention:
    | { readonly class: "EPHEMERAL"; readonly days: 0 }
    | { readonly class: "OPERATIONAL"; readonly days: number }
    | { readonly class: "AUDIT_REF_ONLY"; readonly days: number };
  readonly allowTemplateDigest: boolean;
  readonly allowErrorFingerprint: boolean;
}

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

export type DiagnosticSeverity = "REJECT" | "PARTIAL" | "INFO";

export interface ObservabilityDiagnostic {
  readonly code: ObservabilityDiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly observationRef?: SafeRef;
  readonly fieldPath?: string;
  readonly count: number;
}

export interface TokenComponentCoverage {
  readonly observedSum: number;
  readonly callsObserved: number;
  readonly callsMissing: number;
}

export interface TokenAggregate {
  readonly input: TokenComponentCoverage;
  readonly output: TokenComponentCoverage;
  readonly total: TokenComponentCoverage;
  readonly cachedInput: TokenComponentCoverage;
  readonly consistencyDiagnostics: number;
}

export interface CurrencyCostAggregate {
  readonly currency: string;
  readonly observedAmount: string;
  readonly observationCount: number;
  readonly callsWithCost: number;
  readonly callsMissingCost: number;
  readonly sourceAuthorities: readonly string[];
}

export interface LatencyKindAggregate {
  readonly operationKind: LatencyObservation["operationKind"];
  readonly observedCount: number;
  readonly missingCount: number;
  readonly minMs: number | null;
  readonly maxMs: number | null;
  readonly sumMs: number;
  readonly average: { readonly sumMs: number; readonly count: number };
}

export interface ErrorCountAggregate {
  readonly errorSource: ErrorObservation["errorSource"];
  readonly category: ErrorObservation["category"];
  readonly code: string;
  readonly retryable: ErrorObservation["retryable"];
  readonly count: number;
}

export interface ObservabilityAggregates {
  readonly tokens: TokenAggregate;
  readonly costByCurrency: readonly CurrencyCostAggregate[];
  readonly crossCurrencyTotal: null;
  readonly latencyByKind: readonly LatencyKindAggregate[];
  readonly errorCounts: readonly ErrorCountAggregate[];
  readonly invoiceReconciliationGroups: readonly CurrencyCostAggregate[];
}

export interface ObservabilityCoverage {
  readonly acceptedObservations: number;
  readonly rejectedObservations: number;
  readonly requiredObservationsPresent: boolean;
  readonly hasRunStarted: boolean;
  readonly hasRunTerminated: boolean;
  readonly terminalOutcomeKnown: boolean;
  readonly lateOrPartialEvidence: boolean;
  readonly missingParentSpans: number;
  readonly sampledDetailCount: number;
  readonly droppedForCardinality: number;
  readonly droppedForSize: number;
  readonly unknownMetricCoverage: boolean;
}

export interface SamplingSummary {
  readonly basisPoints: number;
  readonly seed: SafeRef;
  readonly eligibleDetail: number;
  readonly retainedDetail: number;
  readonly sampledOutDetail: number;
}

export interface RetentionDirective {
  readonly class: RetentionClass;
  readonly days: number;
  readonly downgradedFromRequest: boolean;
  readonly persistencePerformed: false;
  readonly note: string;
}

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

export interface ObservabilityBuildInput {
  readonly run: SafeRunIdentity;
  readonly observations: readonly SafeObservationCandidate[];
  readonly policy: ObservabilityPolicy;
  readonly evidenceRefs?: readonly SafeRef[];
}

export interface ObservabilityValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly diagnostics: readonly ObservabilityDiagnostic[];
}
