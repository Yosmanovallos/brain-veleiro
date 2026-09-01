import {
  BASE_OBSERVATION_KEYS,
  COST_AMOUNT_PATTERN,
  CURRENCY_PATTERN,
  KIND_SPECIFIC_KEYS,
  NORMALIZED_CODE_PATTERN,
  PROHIBITED_KEY_PATTERN,
  PROHIBITED_VALUE_PATTERN,
  S13P_LIMITS,
  SAFE_REF_PATTERN,
  SHA256_DIGEST_PATTERN,
  UTC_TIMESTAMP_PATTERN,
  VERSIONED_REF_KEYS,
} from "./constants.js";
import type {
  ObservabilityDiagnostic,
  ObservationKind,
  SafeObservationCandidate,
  SafeRunIdentity,
} from "./types.js";

// ---------------------------------------------------------------------------
// Shared structural primitives (reused by the policy validator and builder).
// ---------------------------------------------------------------------------

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isSafeRef = (value: unknown): value is string =>
  typeof value === "string" &&
  SAFE_REF_PATTERN.test(value) &&
  !PROHIBITED_KEY_PATTERN.test(value) &&
  !PROHIBITED_VALUE_PATTERN.test(value);

export const isNormalizedCode = (value: unknown): value is string =>
  typeof value === "string" &&
  NORMALIZED_CODE_PATTERN.test(value) &&
  !PROHIBITED_VALUE_PATTERN.test(value);

export const isUtcTimestamp = (value: unknown): value is string =>
  typeof value === "string" && UTC_TIMESTAMP_PATTERN.test(value) && !Number.isNaN(Date.parse(value));

export const isSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const isTemplateDigest = (value: unknown): value is string =>
  typeof value === "string" && SHA256_DIGEST_PATTERN.test(value);

export const isCostAmount = (value: unknown): value is string =>
  typeof value === "string" && COST_AMOUNT_PATTERN.test(value);

export const isCurrency = (value: unknown): value is string =>
  typeof value === "string" && CURRENCY_PATTERN.test(value);

/** Recursively scans any accepted structure for prohibited key names or secret/PII/destination values. */
export function containsProhibitedContent(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "string") return PROHIBITED_VALUE_PATTERN.test(value);
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsProhibitedContent(item, seen));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) => PROHIBITED_KEY_PATTERN.test(key) || containsProhibitedContent(item, seen),
  );
}

const diag = (
  code: ObservabilityDiagnostic["code"],
  severity: ObservabilityDiagnostic["severity"],
  fieldPath?: string,
): ObservabilityDiagnostic => ({ code, severity, ...(fieldPath ? { fieldPath } : {}), count: 1 });

function validateVersionedRef(value: unknown, allowDigest: boolean): boolean {
  if (!isPlainObject(value)) return false;
  if (Object.keys(value).some((key) => !VERSIONED_REF_KEYS.includes(key))) return false;
  if (!isSafeRef(value.ref) || !isSafeRef(value.version)) return false;
  if (value.digest !== undefined && (!allowDigest || !isTemplateDigest(value.digest))) return false;
  return true;
}

const OUTCOMES = ["SUCCESS", "FAILURE", "CANCELLED", "INCONCLUSIVE"];
const SOURCES = ["RUNTIME_S09", "API_S13I", "EVAL_S13N", "ASYNC_S13O", "CALLER_SAFE"];
const PRIORITIES = ["REQUIRED", "NORMAL", "DETAIL"];

export interface ObservationCheck {
  readonly valid: boolean;
  readonly diagnostics: readonly ObservabilityDiagnostic[];
}

export interface RunIdentityCheck {
  readonly valid: boolean;
  readonly diagnostics: readonly ObservabilityDiagnostic[];
}

/** Semantic contract sections 6-8: validate the bundle run/trace identity. */
export function validateRunIdentity(value: unknown): RunIdentityCheck {
  const diagnostics: ObservabilityDiagnostic[] = [];
  if (!isPlainObject(value)) return { valid: false, diagnostics: [diag("INVALID_RUN_IDENTITY", "REJECT", "run")] };
  const allowed = [
    "runId",
    "traceId",
    "taskRef",
    "agentDefinitionRef",
    "agentDefinitionVersion",
    "skillRefs",
    "evalRef",
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) diagnostics.push(diag("UNKNOWN_FIELD", "REJECT", "run"));
  if (!isSafeRef(value.runId) || !isSafeRef(value.traceId)) diagnostics.push(diag("INVALID_RUN_IDENTITY", "REJECT", "run"));
  for (const key of ["taskRef", "agentDefinitionRef", "agentDefinitionVersion", "evalRef"] as const) {
    if (value[key] !== undefined && !isSafeRef(value[key])) diagnostics.push(diag("UNSAFE_REF", "REJECT", `run.${key}`));
  }
  if (value.skillRefs !== undefined) {
    if (!Array.isArray(value.skillRefs) || !value.skillRefs.every((ref) => validateVersionedRef(ref, true))) {
      diagnostics.push(diag("UNSAFE_REF", "REJECT", "run.skillRefs"));
    }
  }
  if (containsProhibitedContent(value)) diagnostics.push(diag("PROHIBITED_FIELD", "REJECT", "run"));
  return { valid: diagnostics.length === 0, diagnostics };
}

function validateBase(o: Record<string, unknown>, run: SafeRunIdentity): ObservabilityDiagnostic[] {
  const d: ObservabilityDiagnostic[] = [];
  if (o.schemaVersion !== "s13p.observation.v1") d.push(diag("UNKNOWN_FIELD", "REJECT", "schemaVersion"));
  if (!isSafeRef(o.observationId)) d.push(diag("UNSAFE_REF", "REJECT", "observationId"));
  if (!isSafeRef(o.runId) || o.runId !== run.runId) d.push(diag("CROSS_RUN_IDENTITY", "REJECT", "runId"));
  if (!isSafeRef(o.traceId) || o.traceId !== run.traceId) d.push(diag("CROSS_RUN_IDENTITY", "REJECT", "traceId"));
  if (o.spanId !== undefined && !isSafeRef(o.spanId)) d.push(diag("UNSAFE_REF", "REJECT", "spanId"));
  if (o.parentSpanId !== undefined && !isSafeRef(o.parentSpanId)) d.push(diag("UNSAFE_REF", "REJECT", "parentSpanId"));
  if (o.missingParent !== undefined && typeof o.missingParent !== "boolean") d.push(diag("MISSING_PARENT_SPAN", "REJECT", "missingParent"));
  if (!isSafeInteger(o.sequence)) d.push(diag("DUPLICATE_SEQUENCE", "REJECT", "sequence"));
  if (!isUtcTimestamp(o.occurredAt)) d.push(diag("INVALID_TIMESTAMP", "REJECT", "occurredAt"));
  if (!isUtcTimestamp(o.observedAt)) d.push(diag("INVALID_TIMESTAMP", "REJECT", "observedAt"));
  if (!SOURCES.includes(o.source as string)) d.push(diag("UNKNOWN_FIELD", "REJECT", "source"));
  if (!PRIORITIES.includes(o.priority as string)) d.push(diag("UNKNOWN_FIELD", "REJECT", "priority"));
  if (o.evidenceRefs !== undefined) {
    if (
      !Array.isArray(o.evidenceRefs) ||
      o.evidenceRefs.length > S13P_LIMITS.maxEvidenceRefsPerObservation ||
      !o.evidenceRefs.every(isSafeRef)
    ) {
      d.push(diag("UNSAFE_REF", "REJECT", "evidenceRefs"));
    }
  }
  return d;
}

const isOutcome = (v: unknown) => typeof v === "string" && OUTCOMES.includes(v);
const optInt = (v: unknown) => v === undefined || isSafeInteger(v);
const optRef = (v: unknown) => v === undefined || isSafeRef(v);

function validateKindFields(
  kind: ObservationKind,
  o: Record<string, unknown>,
  allowDigest: boolean,
  allowFingerprint: boolean,
): ObservabilityDiagnostic[] {
  const d: ObservabilityDiagnostic[] = [];
  const bad = (path: string, code: ObservabilityDiagnostic["code"] = "UNKNOWN_FIELD") => d.push(diag(code, "REJECT", path));
  switch (kind) {
    case "RUN_STARTED":
    case "RUN_TERMINATED": {
      const wantTerminal = kind === "RUN_TERMINATED";
      if (o.phase !== (wantTerminal ? "TERMINAL" : "STARTED")) bad("phase", "INVALID_PHASE_TRANSITION");
      if (wantTerminal) {
        if (
          !["COMPLETED", "FAILED", "CANCELLED", "BUDGET_EXHAUSTED", "POLICY_BLOCKED", "UNKNOWN"].includes(
            o.terminalReason as string,
          )
        )
          bad("terminalReason", "MISSING_TERMINAL_OBSERVATION");
        if (!isOutcome(o.outcome)) bad("outcome", "MISSING_TERMINAL_OBSERVATION");
      } else {
        if (o.terminalReason !== undefined) bad("terminalReason");
        if (o.outcome !== undefined) bad("outcome");
      }
      break;
    }
    case "PROMPT_RESOLVED": {
      if (!isSafeRef(o.promptRef)) bad("promptRef", "UNSAFE_REF");
      if (!isSafeRef(o.promptVersion)) bad("promptVersion", "UNSAFE_REF");
      if (o.templateDigest !== undefined && (!allowDigest || !isTemplateDigest(o.templateDigest))) bad("templateDigest", "INVALID_DIGEST");
      if (o.componentRefs !== undefined) {
        if (!Array.isArray(o.componentRefs) || !o.componentRefs.every((r) => validateVersionedRef(r, allowDigest)))
          bad("componentRefs", "UNSAFE_REF");
      }
      break;
    }
    case "MODEL_CALL_STARTED":
    case "MODEL_CALL_COMPLETED": {
      if (!isSafeRef(o.callId)) bad("callId", "UNSAFE_REF");
      if (o.phase !== (kind === "MODEL_CALL_COMPLETED" ? "COMPLETED" : "STARTED")) bad("phase", "INVALID_PHASE_TRANSITION");
      if (!isSafeRef(o.providerRef)) bad("providerRef", "UNSAFE_REF");
      if (!isSafeRef(o.modelRef)) bad("modelRef", "UNSAFE_REF");
      if (!optRef(o.modelVersionRef)) bad("modelVersionRef", "UNSAFE_REF");
      if (o.outcome !== undefined && !isOutcome(o.outcome)) bad("outcome");
      if (!optInt(o.durationMs) || (typeof o.durationMs === "number" && o.durationMs > S13P_LIMITS.maxDurationMs))
        bad("durationMs", "INVALID_DURATION");
      break;
    }
    case "TOOL_CALL_STARTED":
    case "TOOL_CALL_COMPLETED": {
      if (!isSafeRef(o.callId)) bad("callId", "UNSAFE_REF");
      if (!isSafeRef(o.capabilityId)) bad("capabilityId", "UNSAFE_REF");
      if (o.phase !== (kind === "TOOL_CALL_COMPLETED" ? "COMPLETED" : "STARTED")) bad("phase", "INVALID_PHASE_TRANSITION");
      if (!["NONE", "READ", "REVERSIBLE_WRITE", "IRREVERSIBLE_WRITE"].includes(o.sideEffectClass as string))
        bad("sideEffectClass");
      if (o.outcome !== undefined && !isOutcome(o.outcome)) bad("outcome");
      if (!optRef(o.inputSchemaRef)) bad("inputSchemaRef", "UNSAFE_REF");
      if (!optRef(o.outputSchemaRef)) bad("outputSchemaRef", "UNSAFE_REF");
      if (!optInt(o.durationMs) || (typeof o.durationMs === "number" && o.durationMs > S13P_LIMITS.maxDurationMs))
        bad("durationMs", "INVALID_DURATION");
      if (o.errorCode !== undefined && !isNormalizedCode(o.errorCode)) bad("errorCode", "UNSAFE_REF");
      break;
    }
    case "USAGE_OBSERVED": {
      if (!isSafeRef(o.callId)) bad("callId", "UNSAFE_REF");
      for (const key of ["inputTokens", "outputTokens", "totalTokens", "cachedInputTokens"] as const) {
        if (!optInt(o[key])) bad(key, "TOKEN_TOTAL_MISMATCH");
      }
      const inT = o.inputTokens as number | undefined;
      const outT = o.outputTokens as number | undefined;
      const totT = o.totalTokens as number | undefined;
      const cch = o.cachedInputTokens as number | undefined;
      if (inT !== undefined && outT !== undefined && totT !== undefined && totT !== inT + outT)
        bad("totalTokens", "TOKEN_TOTAL_MISMATCH");
      if (cch !== undefined && inT !== undefined && cch > inT) bad("cachedInputTokens", "CACHED_TOKEN_MISMATCH");
      if (cch !== undefined && inT === undefined) bad("cachedInputTokens", "CACHED_TOKEN_MISMATCH");
      if (!["RUNTIME", "PROVIDER_REPORTED"].includes(o.sourceAuthority as string)) bad("sourceAuthority");
      break;
    }
    case "COST_OBSERVED": {
      if (!optRef(o.callId)) bad("callId", "UNSAFE_REF");
      if (!isCostAmount(o.amount)) bad("amount", "INVALID_COST");
      if (!isCurrency(o.currency)) bad("currency", "INVALID_COST");
      if (!["RUNTIME", "PROVIDER_REPORTED", "INVOICE_EVIDENCE"].includes(o.sourceAuthority as string))
        bad("sourceAuthority");
      if (!optRef(o.pricingRef)) bad("pricingRef", "UNSAFE_REF");
      break;
    }
    case "LATENCY_OBSERVED": {
      if (!["RUN", "MODEL_CALL", "TOOL_CALL", "API", "JOB", "ATTEMPT"].includes(o.operationKind as string))
        bad("operationKind");
      if (!isSafeRef(o.operationRef)) bad("operationRef", "UNSAFE_REF");
      if (!isSafeInteger(o.durationMs) || (o.durationMs as number) > S13P_LIMITS.maxDurationMs)
        bad("durationMs", "INVALID_DURATION");
      if (!["MONOTONIC", "PROVIDER_REPORTED", "WALL_CLOCK_DERIVED"].includes(o.clockSource as string)) bad("clockSource");
      if (o.startedAt !== undefined && !isUtcTimestamp(o.startedAt)) bad("startedAt", "INVALID_TIMESTAMP");
      if (o.endedAt !== undefined && !isUtcTimestamp(o.endedAt)) bad("endedAt", "INVALID_TIMESTAMP");
      if (o.clockSource === "WALL_CLOCK_DERIVED") {
        if (!isUtcTimestamp(o.startedAt) || !isUtcTimestamp(o.endedAt)) bad("clockSource", "INVALID_DURATION");
        else if (Date.parse(o.endedAt as string) - Date.parse(o.startedAt as string) !== o.durationMs)
          bad("durationMs", "INVALID_DURATION");
      }
      break;
    }
    case "ERROR_OBSERVED": {
      if (
        !["RUNTIME", "MODEL", "TOOL", "API", "JOB", "ATTEMPT", "POLICY"].includes(o.errorSource as string)
      )
        bad("errorSource");
      if (
        ![
          "VALIDATION",
          "AUTHORIZATION",
          "TIMEOUT",
          "TRANSIENT",
          "RATE_LIMIT",
          "CANCELLED",
          "POLICY",
          "PROVIDER",
          "TOOL",
          "INTERNAL",
          "UNKNOWN",
        ].includes(o.category as string)
      )
        bad("category");
      if (!isNormalizedCode(o.code)) bad("code", "UNSAFE_REF");
      if (!(o.retryable === true || o.retryable === false || o.retryable === "UNKNOWN")) bad("retryable");
      if (o.fingerprint !== undefined && (!allowFingerprint || !isTemplateDigest(o.fingerprint))) bad("fingerprint", "INVALID_DIGEST");
      if (!optRef(o.relatedRef)) bad("relatedRef", "UNSAFE_REF");
      break;
    }
    case "OPERATION_OBSERVED":
    case "JOB_OBSERVED":
    case "ATTEMPT_OBSERVED": {
      if (!isSafeRef(o.operationRef)) bad("operationRef", "UNSAFE_REF");
      if (!optRef(o.jobId)) bad("jobId", "UNSAFE_REF");
      if (!optRef(o.attemptId)) bad("attemptId", "UNSAFE_REF");
      if (!optInt(o.attemptNumber)) bad("attemptNumber");
      if (
        !["QUEUED", "STARTED", "COMPLETED", "FAILED", "CANCELLED", "RETRY_SCHEDULED"].includes(o.phase as string)
      )
        bad("phase", "INVALID_PHASE_TRANSITION");
      if (o.outcome !== undefined && !isOutcome(o.outcome)) bad("outcome");
      if (!optInt(o.durationMs) || (typeof o.durationMs === "number" && o.durationMs > S13P_LIMITS.maxDurationMs))
        bad("durationMs", "INVALID_DURATION");
      if (o.errorCode !== undefined && !isNormalizedCode(o.errorCode)) bad("errorCode", "UNSAFE_REF");
      break;
    }
    case "POLICY_VIOLATION": {
      if (!isNormalizedCode(o.policyCode)) bad("policyCode", "UNSAFE_REF");
      if (!["DROPPED", "REJECTED", "DOWNGRADED_TO_PARTIAL"].includes(o.disposition as string)) bad("disposition");
      if (!optRef(o.affectedObservationRef)) bad("affectedObservationRef", "UNSAFE_REF");
      break;
    }
    case "OBSERVATION_DROPPED_SUMMARY": {
      if (!["SAMPLING", "CARDINALITY", "SIZE", "UNSAFE", "INVALID"].includes(o.reason as string)) bad("reason");
      if (!isSafeInteger(o.droppedCount)) bad("droppedCount");
      if (
        !Array.isArray(o.droppedKinds) ||
        !o.droppedKinds.every((k) => (KIND_SPECIFIC_KEYS as Record<string, unknown>)[k as string] !== undefined)
      )
        bad("droppedKinds");
      break;
    }
  }
  return d;
}

/**
 * Validates one candidate against its exact kind schema (semantic contract section 8, 13).
 * Unknown top-level or nested keys reject (HI-003). Prohibited content rejects (HI-004/006).
 */
export function validateSafeObservation(
  candidate: unknown,
  run: SafeRunIdentity,
  options: { allowTemplateDigest: boolean; allowErrorFingerprint: boolean },
): ObservationCheck {
  if (!isPlainObject(candidate)) return { valid: false, diagnostics: [diag("UNKNOWN_FIELD", "REJECT")] };
  const kind = candidate.kind as ObservationKind;
  const allowedKeys = KIND_SPECIFIC_KEYS[kind];
  if (!allowedKeys) return { valid: false, diagnostics: [diag("UNKNOWN_FIELD", "REJECT", "kind")] };

  const diagnostics: ObservabilityDiagnostic[] = [];
  const permitted = new Set<string>([...BASE_OBSERVATION_KEYS, ...allowedKeys]);
  // Never echo the raw unknown key name into a diagnostic (semantic contract section 16).
  if (Object.keys(candidate).some((key) => !permitted.has(key))) diagnostics.push(diag("UNKNOWN_FIELD", "REJECT", "unknownKey"));
  if (containsProhibitedContent(candidate)) diagnostics.push(diag("PROHIBITED_FIELD", "REJECT"));
  diagnostics.push(...validateBase(candidate, run));
  diagnostics.push(...validateKindFields(kind, candidate, options.allowTemplateDigest, options.allowErrorFingerprint));

  return { valid: diagnostics.length === 0, diagnostics };
}
