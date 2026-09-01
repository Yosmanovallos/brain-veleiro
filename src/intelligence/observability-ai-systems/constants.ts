import type { ObservationKind } from "./types.js";

export const OBSERVABILITY_SKILL_ID = "intelligence.observability-ai-systems.s13p";
export const OBSERVABILITY_QUALITY_CONTRACT_REF = "S13P_OBSERVABILITY_AI_SYSTEMS_DEEP";
export const OBSERVABILITY_INPUT_MARKER = "[[OBSERVABILITY_AI_SYSTEMS_INPUT]]";
export const OBSERVABILITY_SKILL_MARKER = "[[OBSERVABILITY_AI_SYSTEMS_SKILL]]";

/** Semantic contract section 7 — the v1 ceilings are normative. A policy may lower, never raise. */
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

export type S13pLimits = typeof S13P_LIMITS;

export const SAFE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const NORMALIZED_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
export const COST_AMOUNT_PATTERN = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/;
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;
export const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
export const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/**
 * Secondary, explicitly incomplete defensive scan (semantic contract section 13).
 * The structural key allowlist per kind is the primary defense; this only rejects
 * obvious secret/PII/destination shapes that slipped through as ref or code values.
 */
export const PROHIBITED_KEY_PATTERN =
  /(?:prompt_?text|\bmessages?\b|\bcontent\b|\bcontext\b|context_?text|retrieved|tool_?input|tool_?output|arguments|results?|command|payload|headers?|\bbody\b|cookie|credential|authorization|\bbearer\b|api[_-]?key|secret|private[_-]?key|\btoken\b|stack|stacktrace|provider_?metadata|\bmetadata\b|account|tenant|organization|\bendpoint\b|\bregion\b|\bemail\b)/i;

export const PROHIBITED_VALUE_PATTERN =
  /(?:-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\bbearer\s+[A-Za-z0-9._~+/=-]{6,}|\b(?:authorization|api[_-]?key|access[_-]?token|secret|password|cookie)\s*[:=]\s*\S{4,}|\bhttps?:\/\/|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|(?:^|[\s"'(])(?:\/[A-Za-z0-9._-]+){2,}|[A-Za-z]:\\[\\A-Za-z0-9._-]+)/;

export const OBSERVATION_KINDS: readonly ObservationKind[] = [
  "RUN_STARTED",
  "RUN_TERMINATED",
  "PROMPT_RESOLVED",
  "MODEL_CALL_STARTED",
  "MODEL_CALL_COMPLETED",
  "TOOL_CALL_STARTED",
  "TOOL_CALL_COMPLETED",
  "USAGE_OBSERVED",
  "COST_OBSERVED",
  "LATENCY_OBSERVED",
  "ERROR_OBSERVED",
  "OPERATION_OBSERVED",
  "JOB_OBSERVED",
  "ATTEMPT_OBSERVED",
  "POLICY_VIOLATION",
  "OBSERVATION_DROPPED_SUMMARY",
];

/** Never-drop kinds (semantic contract section 10). Sampling MUST NOT remove these. */
export const NEVER_DROP_KINDS: ReadonlySet<ObservationKind> = new Set<ObservationKind>([
  "RUN_STARTED",
  "RUN_TERMINATED",
  "ERROR_OBSERVED",
  "POLICY_VIOLATION",
  "OBSERVATION_DROPPED_SUMMARY",
]);

export const BASE_OBSERVATION_KEYS: readonly string[] = [
  "schemaVersion",
  "observationId",
  "runId",
  "traceId",
  "spanId",
  "parentSpanId",
  "missingParent",
  "sequence",
  "occurredAt",
  "observedAt",
  "source",
  "kind",
  "evidenceRefs",
  "priority",
];

/** Exact allowed key set per observation kind (base keys plus kind-specific). Unknown keys reject (HI-003). */
export const KIND_SPECIFIC_KEYS: Record<ObservationKind, readonly string[]> = {
  RUN_STARTED: ["phase", "terminalReason", "outcome"],
  RUN_TERMINATED: ["phase", "terminalReason", "outcome"],
  PROMPT_RESOLVED: ["promptRef", "promptVersion", "templateDigest", "componentRefs"],
  MODEL_CALL_STARTED: ["callId", "phase", "providerRef", "modelRef", "modelVersionRef", "outcome", "durationMs"],
  MODEL_CALL_COMPLETED: ["callId", "phase", "providerRef", "modelRef", "modelVersionRef", "outcome", "durationMs"],
  TOOL_CALL_STARTED: ["callId", "capabilityId", "phase", "sideEffectClass", "outcome", "inputSchemaRef", "outputSchemaRef", "durationMs", "errorCode"],
  TOOL_CALL_COMPLETED: ["callId", "capabilityId", "phase", "sideEffectClass", "outcome", "inputSchemaRef", "outputSchemaRef", "durationMs", "errorCode"],
  USAGE_OBSERVED: ["callId", "inputTokens", "outputTokens", "totalTokens", "cachedInputTokens", "sourceAuthority"],
  COST_OBSERVED: ["callId", "amount", "currency", "sourceAuthority", "pricingRef"],
  LATENCY_OBSERVED: ["operationKind", "operationRef", "durationMs", "clockSource", "startedAt", "endedAt"],
  ERROR_OBSERVED: ["errorSource", "category", "code", "retryable", "fingerprint", "relatedRef"],
  OPERATION_OBSERVED: ["operationRef", "jobId", "attemptId", "attemptNumber", "phase", "outcome", "durationMs", "errorCode"],
  JOB_OBSERVED: ["operationRef", "jobId", "attemptId", "attemptNumber", "phase", "outcome", "durationMs", "errorCode"],
  ATTEMPT_OBSERVED: ["operationRef", "jobId", "attemptId", "attemptNumber", "phase", "outcome", "durationMs", "errorCode"],
  POLICY_VIOLATION: ["policyCode", "disposition", "affectedObservationRef"],
  OBSERVATION_DROPPED_SUMMARY: ["reason", "droppedCount", "droppedKinds"],
};

export const VERSIONED_REF_KEYS: readonly string[] = ["ref", "version", "digest"];

export const RUN_IDENTITY_KEYS: readonly string[] = [
  "runId",
  "traceId",
  "taskRef",
  "agentDefinitionRef",
  "agentDefinitionVersion",
  "skillRefs",
  "evalRef",
];

export const POLICY_KEYS: readonly string[] = [
  "policyVersion",
  "limits",
  "successDetailSamplingBasisPoints",
  "samplingSeed",
  "requestedRetention",
  "allowTemplateDigest",
  "allowErrorFingerprint",
];
