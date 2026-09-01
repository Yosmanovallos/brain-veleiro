import type {
  ObservabilityBuildInput,
  ObservabilityPolicy,
  SafeObservationCandidate,
} from "../../src/intelligence/observability-ai-systems/index.js";

export const TS_A = "2026-01-01T00:00:00.000Z";
export const TS_B = "2026-01-01T00:00:01.000Z";
export const TS_C = "2026-01-01T00:00:02.000Z";
export const TS_D = "2026-01-01T00:00:03.000Z";

export function policy(overrides: Partial<ObservabilityPolicy> = {}): ObservabilityPolicy {
  return {
    policyVersion: "s13p.policy.v1",
    limits: {},
    successDetailSamplingBasisPoints: 10_000,
    samplingSeed: "seed_alpha",
    requestedRetention: { class: "EPHEMERAL", days: 0 },
    allowTemplateDigest: false,
    allowErrorFingerprint: false,
    ...overrides,
  } as ObservabilityPolicy;
}

const base = (
  seq: number,
  kind: SafeObservationCandidate["kind"],
  priority: SafeObservationCandidate["priority"],
  extra: Record<string, unknown>,
): SafeObservationCandidate =>
  ({
    schemaVersion: "s13p.observation.v1",
    observationId: `obs_${seq}`,
    runId: "run_alpha",
    traceId: "trace_alpha",
    sequence: seq,
    occurredAt: TS_A,
    observedAt: TS_A,
    source: "RUNTIME_S09",
    kind,
    priority,
    ...extra,
  }) as SafeObservationCandidate;

export const runStarted = (seq = 1): SafeObservationCandidate =>
  base(seq, "RUN_STARTED", "REQUIRED", { phase: "STARTED" });

export const runTerminated = (
  seq: number,
  outcome: "SUCCESS" | "FAILURE" | "CANCELLED" | "INCONCLUSIVE" = "SUCCESS",
  terminalReason = "COMPLETED",
): SafeObservationCandidate => base(seq, "RUN_TERMINATED", "REQUIRED", { phase: "TERMINAL", terminalReason, outcome });

export const promptResolved = (seq: number, extra: Record<string, unknown> = {}): SafeObservationCandidate =>
  base(seq, "PROMPT_RESOLVED", "DETAIL", { promptRef: "prompt_main", promptVersion: "v3", ...extra });

export const modelStarted = (seq: number, callId = "call_1"): SafeObservationCandidate =>
  base(seq, "MODEL_CALL_STARTED", "DETAIL", { callId, phase: "STARTED", providerRef: "prov_x", modelRef: "model_y" });

export const modelCompleted = (
  seq: number,
  callId = "call_1",
  outcome: "SUCCESS" | "FAILURE" | "CANCELLED" | "INCONCLUSIVE" = "SUCCESS",
): SafeObservationCandidate =>
  base(seq, "MODEL_CALL_COMPLETED", outcome === "SUCCESS" ? "DETAIL" : "REQUIRED", {
    callId,
    phase: "COMPLETED",
    providerRef: "prov_x",
    modelRef: "model_y",
    outcome,
    durationMs: 1200,
  });

export const toolStarted = (seq: number, callId = "tcall_1"): SafeObservationCandidate =>
  base(seq, "TOOL_CALL_STARTED", "DETAIL", { callId, capabilityId: "cap_read", phase: "STARTED", sideEffectClass: "READ" });

export const toolCompleted = (seq: number, callId = "tcall_1"): SafeObservationCandidate =>
  base(seq, "TOOL_CALL_COMPLETED", "DETAIL", {
    callId,
    capabilityId: "cap_read",
    phase: "COMPLETED",
    sideEffectClass: "READ",
    outcome: "SUCCESS",
    durationMs: 45,
  });

export const usage = (seq: number, extra: Record<string, unknown>): SafeObservationCandidate =>
  base(seq, "USAGE_OBSERVED", "NORMAL", { callId: "call_1", sourceAuthority: "RUNTIME", ...extra });

export const cost = (seq: number, amount: string, currency: string, extra: Record<string, unknown> = {}): SafeObservationCandidate =>
  base(seq, "COST_OBSERVED", "NORMAL", { callId: "call_1", amount, currency, sourceAuthority: "RUNTIME", ...extra });

export const latency = (
  seq: number,
  operationKind: "RUN" | "MODEL_CALL" | "TOOL_CALL" | "API" | "JOB" | "ATTEMPT",
  durationMs: number,
  extra: Record<string, unknown> = {},
): SafeObservationCandidate =>
  base(seq, "LATENCY_OBSERVED", "NORMAL", { operationKind, operationRef: "op_1", durationMs, clockSource: "MONOTONIC", ...extra });

export const errorObserved = (seq: number, extra: Record<string, unknown> = {}): SafeObservationCandidate =>
  base(seq, "ERROR_OBSERVED", "REQUIRED", {
    errorSource: "MODEL",
    category: "TIMEOUT",
    code: "MODEL_TIMEOUT",
    retryable: true,
    ...extra,
  });

export const asyncObserved = (
  seq: number,
  kind: "OPERATION_OBSERVED" | "JOB_OBSERVED" | "ATTEMPT_OBSERVED",
  phase: "QUEUED" | "STARTED" | "COMPLETED" | "FAILED" | "CANCELLED" | "RETRY_SCHEDULED",
  extra: Record<string, unknown> = {},
): SafeObservationCandidate =>
  base(seq, kind, phase === "FAILED" || phase === "CANCELLED" ? "REQUIRED" : "NORMAL", {
    operationRef: "op_async",
    phase,
    ...extra,
  });

export function input(observations: SafeObservationCandidate[], overrides: Partial<ObservabilityBuildInput> = {}): ObservabilityBuildInput {
  return {
    run: { runId: "run_alpha", traceId: "trace_alpha" },
    observations,
    policy: policy(),
    evidenceRefs: [],
    ...overrides,
  };
}

/** P01 — minimal complete run. */
export const minimalCompleteRun = (): ObservabilityBuildInput => input([runStarted(1), runTerminated(2)]);
