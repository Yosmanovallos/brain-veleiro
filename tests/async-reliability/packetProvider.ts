import type {
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
} from "../../src/core/agent/index.js";
import {
  ASYNC_RELIABILITY_INPUT_MARKER,
  type AsyncReliabilityDecision,
  type AsyncReliabilityInput,
  type AsyncReliabilityReasonCode,
  type ReliabilityFailureClass,
} from "../../src/intelligence/async-reliability/index.js";

export interface ReliabilityMethodFeatures {
  classifyObservedFailure: boolean;
  gateNonRetryableFailure: boolean;
  respectDispatchAmbiguity: boolean;
  requireStableIdempotency: boolean;
  requireReplayProof: boolean;
  enforceAttemptBudget: boolean;
  enforceElapsedBudget: boolean;
  enforceDeadline: boolean;
  respectRetryAfter: boolean;
  computeBoundedBackoff: boolean;
  handlePredispatchCancellation: boolean;
  reconcilePostdispatchCancellation: boolean;
  preserveSuccessRace: boolean;
  preserveTerminalJob: boolean;
}

const normalize = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const containsAny = (text: string, concepts: readonly string[]): boolean =>
  concepts.some((concept) => text.includes(normalize(concept)));

const containsConcepts = (
  text: string,
  ...groups: readonly (readonly string[])[]
): boolean => groups.every((group) => containsAny(text, group));

/** Extracts reusable reliability concepts from arbitrary visible prose. */
export function extractReliabilityMethodFeatures(
  prose: string,
): ReliabilityMethodFeatures {
  const text = normalize(prose);
  return {
    classifyObservedFailure: containsConcepts(
      text,
      ["classify", "classification"],
      ["observed", "normalized"],
      ["failure", "result"],
    ),
    gateNonRetryableFailure: containsConcepts(
      text,
      ["retry"],
      ["invalid", "auth", "policy", "permanent"],
      ["never", "not", "conditional", "blind"],
    ),
    respectDispatchAmbiguity: containsConcepts(
      text,
      ["dispatch", "post dispatch"],
      ["ambiguous", "unknown", "phase", "outcome"],
      ["reconcile", "safety", "proof"],
    ),
    requireStableIdempotency: containsConcepts(
      text,
      ["idempotent", "idempotency"],
      ["fingerprint", "same request", "stable"],
    ),
    requireReplayProof: containsConcepts(
      text,
      ["non idempotent", "external", "effectful"],
      ["replay", "repeat"],
      ["proof", "evidence", "reconcile"],
    ),
    enforceAttemptBudget: containsConcepts(
      text,
      ["attempt"],
      ["budget", "maximum", "max attempts"],
      ["hard", "limit", "exceed", "bounded"],
    ),
    enforceElapsedBudget: containsConcepts(
      text,
      ["elapsed", "retry window"],
      ["budget", "limit", "bounded"],
    ),
    enforceDeadline: containsConcepts(
      text,
      ["deadline"],
      ["hard", "fit", "extend", "schedule"],
    ),
    respectRetryAfter: containsConcepts(
      text,
      ["retry after"],
      ["minimum", "server wait", "not authorization"],
    ),
    computeBoundedBackoff: containsConcepts(
      text,
      ["backoff"],
      ["fixed", "exponential"],
      ["bounded", "cap", "deterministic"],
    ),
    handlePredispatchCancellation: containsConcepts(
      text,
      ["pre dispatch", "before dispatch"],
      ["cancel", "cancellation"],
    ),
    reconcilePostdispatchCancellation: containsConcepts(
      text,
      ["post dispatch", "after dispatch"],
      ["cancel", "cancellation"],
      ["reconcile", "acknowledge", "not automatic"],
    ),
    preserveSuccessRace: containsConcepts(
      text,
      ["success"],
      ["cancel", "cancellation"],
      ["race", "truthful", "remain"],
    ),
    preserveTerminalJob: containsConcepts(
      text,
      ["terminal"],
      ["job", "state"],
      ["retry", "reopen", "transition"],
    ),
  };
}

function visibleRequest(statement: string): {
  packet: AsyncReliabilityInput;
  prose: string;
} {
  const visible = statement.split(ASYNC_RELIABILITY_INPUT_MARKER)[1]?.trimStart();
  if (!visible) throw new Error("missing visible reliability packet");
  const newline = visible.indexOf("\n");
  const json = newline < 0 ? visible : visible.slice(0, newline);
  const prose = newline < 0 ? "" : visible.slice(newline + 1);
  return { packet: JSON.parse(json) as AsyncReliabilityInput, prose };
}

function classify(
  input: AsyncReliabilityInput,
  enabled: boolean,
): ReliabilityFailureClass {
  const latest = input.attempts.at(-1)!;
  if (latest.observed_status === "SUCCESS") return "NONE";
  if (!enabled) {
    if (latest.error_code === "RATE_LIMITED") return "RATE_LIMITED";
    if (latest.error_code === "TIMEOUT") return "TIMEOUT";
    return "TRANSIENT";
  }
  if (latest.observed_status === "BLOCKED") {
    return latest.error_code === "AUTH_REQUIRED"
      ? "AUTH_REQUIRED"
      : "POLICY_BLOCKED";
  }
  const direct: Partial<Record<string, ReliabilityFailureClass>> = {
    RATE_LIMITED: "RATE_LIMITED",
    TIMEOUT: "TIMEOUT",
    INVALID_REQUEST: "INVALID_INPUT",
    INVALID_INPUT: "INVALID_INPUT",
    AUTH_REQUIRED: "AUTH_REQUIRED",
    PERMISSION_DENIED: "POLICY_BLOCKED",
    NOT_FOUND: "PERMANENT",
    UNAVAILABLE: "TRANSIENT",
    CANCELLED: "CANCELLED",
    UNKNOWN_OUTCOME: "AMBIGUOUS_OUTCOME",
  };
  if (latest.error_code && direct[latest.error_code]) {
    return direct[latest.error_code]!;
  }
  if (
    ["INVALID_RESPONSE", "EXECUTION_FAILED", "INTERNAL_ERROR"].includes(
      latest.error_code ?? "",
    )
  ) {
    return latest.retryable_hint === true ? "TRANSIENT" : "PERMANENT";
  }
  return "UNKNOWN";
}

function policyDelay(
  input: AsyncReliabilityInput,
  features: ReliabilityMethodFeatures,
): number {
  const latest = input.attempts.at(-1)!;
  let delay = input.policy.backoff.base_delay_ms;
  if (
    features.computeBoundedBackoff &&
    input.policy.backoff.strategy === "EXPONENTIAL"
  ) {
    delay = Math.min(
      input.policy.backoff.max_delay_ms,
      Math.ceil(
        input.policy.backoff.base_delay_ms *
          input.policy.backoff.multiplier ** (input.attempts.length - 1),
      ),
    );
  }
  if (features.respectRetryAfter) {
    delay = Math.max(delay, latest.retry_after_ms ?? 0);
  }
  return delay;
}

function nonRetryReason(
  failure: ReliabilityFailureClass,
): AsyncReliabilityReasonCode {
  if (failure === "AUTH_REQUIRED") return "AUTH_REQUIRED";
  if (failure === "POLICY_BLOCKED") return "POLICY_BLOCKED";
  if (failure === "INVALID_INPUT") return "INVALID_INPUT";
  return "NON_RETRYABLE_FAILURE";
}

/** Produces one packet-derived candidate, refined only by concepts found in prose. */
export function synthesizePacketDerivedCandidate(
  packet: AsyncReliabilityInput,
  prose: string,
): AsyncReliabilityDecision {
  const features = extractReliabilityMethodFeatures(prose);
  const latest = packet.attempts.at(-1)!;
  const failure = classify(packet, features.classifyObservedFailure);
  const remainingAttempts = packet.policy.max_attempts - packet.attempts.length;
  const remainingElapsed =
    packet.policy.max_elapsed_ms -
    (packet.clock.now_ms - packet.clock.operation_started_at_ms);
  const remainingDeadline =
    packet.clock.effective_deadline_at_ms === undefined
      ? undefined
      : packet.clock.effective_deadline_at_ms - packet.clock.now_ms;
  const delay = policyDelay(packet, features);
  const common = {
    task_ref: packet.task_ref,
    operation_ref: packet.operation.operation_ref,
    job_id: packet.job.job_id,
    latest_attempt_id: latest.attempt_id,
    failure_class: failure,
    remaining_attempts: remainingAttempts,
    remaining_elapsed_ms: remainingElapsed,
    ...(remainingDeadline === undefined
      ? {}
      : { remaining_deadline_ms: remainingDeadline }),
    authority_ref: packet.operation.authority_ref,
    ...(packet.operation.approval_ref
      ? { approval_ref: packet.operation.approval_ref }
      : {}),
    evidence_refs: [...packet.evidence_refs],
    blockers: [] as string[],
    limitations: [...packet.limitations],
    residual_unknowns: [] as string[],
  };
  const retry = (): AsyncReliabilityDecision => ({
    ...common,
    status: "READY",
    action: "RETRY",
    reason_code:
      failure === "RATE_LIMITED"
        ? "RATE_LIMITED_RETRY_ALLOWED"
        : failure === "TIMEOUT"
          ? "TIMEOUT_RETRY_ALLOWED"
          : "TRANSIENT_RETRY_ALLOWED",
    next_job_state: "WAITING_RETRY",
    next_attempt_number: packet.attempts.length + 1,
    delay_ms: delay,
    replay_disposition:
      latest.dispatch_state === "NOT_DISPATCHED" ||
      packet.operation.side_effect_class === "READ_ONLY"
        ? "NOT_REQUIRED"
        : "SUFFICIENT",
    requires_reconciliation: false,
  });
  const stop = (
    reason_code: AsyncReliabilityReasonCode,
    replay_disposition: AsyncReliabilityDecision["replay_disposition"],
  ): AsyncReliabilityDecision => ({
    ...common,
    status: "READY",
    action: failure === "POLICY_BLOCKED" ? "BLOCK" : "STOP",
    reason_code,
    next_job_state: failure === "POLICY_BLOCKED" ? "BLOCKED" : "FAILED",
    replay_disposition,
    requires_reconciliation: false,
  });

  if (features.preserveTerminalJob) {
    if (packet.job.state === "SUCCEEDED") {
      return {
        ...common,
        status: "READY",
        action: "COMPLETE",
        failure_class: "NONE",
        reason_code: "OBSERVED_SUCCESS",
        next_job_state: "SUCCEEDED",
        replay_disposition: "NOT_REQUIRED",
        requires_reconciliation: false,
        limitations: [...common.limitations, "TERMINAL_JOB_PRESERVED"],
      };
    }
    if (packet.job.state === "FAILED") {
      return {
        ...stop("NON_RETRYABLE_FAILURE", "NOT_REQUIRED"),
        next_job_state: "FAILED",
        limitations: [...common.limitations, "TERMINAL_JOB_PRESERVED"],
      };
    }
    if (packet.job.state === "CANCELLED") {
      return {
        ...common,
        status: "READY",
        action: "CANCEL",
        reason_code: "CANCELLATION_CONFIRMED",
        next_job_state: "CANCELLED",
        replay_disposition: "NOT_REQUIRED",
        requires_reconciliation: false,
        limitations: [...common.limitations, "TERMINAL_JOB_PRESERVED"],
      };
    }
    if (packet.job.state === "BLOCKED") {
      return {
        ...common,
        status: "READY",
        action: "BLOCK",
        reason_code: "POLICY_BLOCKED",
        next_job_state: "BLOCKED",
        replay_disposition: "NOT_REQUIRED",
        requires_reconciliation: false,
        limitations: [...common.limitations, "TERMINAL_JOB_PRESERVED"],
      };
    }
  }

  if (latest.observed_status === "SUCCESS") {
    return {
      ...common,
      status: "READY",
      action: "COMPLETE",
      failure_class: "NONE",
      reason_code: "OBSERVED_SUCCESS",
      next_job_state: "SUCCEEDED",
      replay_disposition: "NOT_REQUIRED",
      requires_reconciliation: false,
      limitations:
        features.preserveSuccessRace && packet.cancellation.requested
          ? [...common.limitations, "CANCELLATION_RACE_OBSERVED_SUCCESS"]
          : common.limitations,
    };
  }

  if (
    features.handlePredispatchCancellation &&
    (packet.cancellation.acknowledged ||
      (packet.cancellation.requested &&
        latest.dispatch_state === "NOT_DISPATCHED"))
  ) {
    return {
      ...common,
      status: "READY",
      action: "CANCEL",
      reason_code: "CANCELLATION_CONFIRMED",
      next_job_state: "CANCELLED",
      replay_disposition: "NOT_REQUIRED",
      requires_reconciliation: false,
    };
  }

  if (
    features.reconcilePostdispatchCancellation &&
    packet.cancellation.requested &&
    latest.dispatch_state !== "NOT_DISPATCHED"
  ) {
    return {
      ...common,
      status: "INCONCLUSIVE",
      action: "RECONCILE",
      reason_code: "CANCELLATION_REQUIRES_RECONCILIATION",
      next_job_state: "RECONCILING",
      replay_disposition: "INSUFFICIENT",
      requires_reconciliation: true,
      residual_unknowns: ["remote cancellation outcome"],
    };
  }

  const postdispatch = latest.dispatch_state !== "NOT_DISPATCHED";
  const declaredReplay =
    packet.operation.declared_idempotent &&
    ["DECLARED_IDEMPOTENT", "DURABLE_KEYED_DEDUPLICATION"].includes(
      packet.replay_evidence.kind,
    );
  const provenReplay = [
    "DURABLE_KEYED_DEDUPLICATION",
    "RECONCILED_NOT_APPLIED",
  ].includes(packet.replay_evidence.kind);
  const needsIdempotentProof =
    features.requireStableIdempotency &&
    packet.operation.side_effect_class === "IDEMPOTENT_WRITE" &&
    postdispatch &&
    !declaredReplay;
  const needsEffectProof =
    features.requireReplayProof &&
    ["NON_IDEMPOTENT_WRITE", "EXTERNAL_SIDE_EFFECT"].includes(
      packet.operation.side_effect_class,
    ) &&
    postdispatch &&
    !provenReplay;
  if (
    features.respectDispatchAmbiguity &&
    ["AMBIGUOUS_OUTCOME", "UNKNOWN"].includes(failure) &&
    postdispatch &&
    packet.operation.side_effect_class !== "READ_ONLY"
  ) {
    return {
      ...common,
      status: "INCONCLUSIVE",
      action: "RECONCILE",
      reason_code: "AMBIGUOUS_REMOTE_OUTCOME",
      next_job_state: "RECONCILING",
      replay_disposition: "INSUFFICIENT",
      requires_reconciliation: true,
      residual_unknowns: ["post-dispatch effect outcome"],
    };
  }
  if (
    features.gateNonRetryableFailure &&
    !["TRANSIENT", "RATE_LIMITED", "TIMEOUT"].includes(failure)
  ) {
    return stop(nonRetryReason(failure), "NOT_REQUIRED");
  }
  if (
    features.respectDispatchAmbiguity &&
    (needsIdempotentProof || needsEffectProof)
  ) {
    return {
      ...common,
      status: "INCONCLUSIVE",
      action: "RECONCILE",
      reason_code: "IDEMPOTENCY_EVIDENCE_INSUFFICIENT",
      next_job_state: "RECONCILING",
      replay_disposition: "INSUFFICIENT",
      requires_reconciliation: true,
      residual_unknowns: ["post-dispatch effect outcome"],
    };
  }

  const replayDisposition: AsyncReliabilityDecision["replay_disposition"] =
    !postdispatch || packet.operation.side_effect_class === "READ_ONLY"
      ? "NOT_REQUIRED"
      : "SUFFICIENT";
  if (features.enforceAttemptBudget && remainingAttempts <= 0) {
    return stop("RETRY_BUDGET_EXHAUSTED", replayDisposition);
  }
  if (features.enforceElapsedBudget && remainingElapsed <= 0) {
    return stop("ELAPSED_BUDGET_EXHAUSTED", replayDisposition);
  }
  if (features.enforceElapsedBudget && delay > remainingElapsed) {
    return stop("ELAPSED_BUDGET_EXHAUSTED", replayDisposition);
  }
  if (
    features.enforceDeadline &&
    remainingDeadline !== undefined &&
    delay >= remainingDeadline
  ) {
    return stop("DEADLINE_EXHAUSTED", replayDisposition);
  }
  return retry();
}

export class PacketProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const { packet, prose } = visibleRequest(request.goal.statement);
    const candidate = synthesizePacketDerivedCandidate(packet, prose);
    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: "derived from visible reliability facts and method prose",
        output: {
          summary: "decision",
          data: candidate as unknown as Record<string, unknown>,
        },
      },
    };
  }
}
