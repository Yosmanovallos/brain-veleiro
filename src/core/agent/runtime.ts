import { randomUUID } from "node:crypto";
import type {
  AgentRunEvent,
  AgentRunEventType,
  AgentRunLimits,
  AgentRunResult,
  AgentRunState,
  CapabilityProvider,
  ModelDecision,
  ModelDecisionRequest,
  ModelProvider,
  ModelUsage,
  ObservationMessage,
  StructuredAgentOutput,
  TerminationExplanation,
  TerminationReasonCode,
  ToolDescriptor,
} from "./types.js";

/**
 * Brain Core — Agent Runtime loop.
 *
 * Implements the canonical algorithm from
 * brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md section 14.
 *
 * This module must depend ONLY on ./types.js (the provider-neutral
 * contract). It must never import a concrete ModelProvider or
 * CapabilityProvider implementation, a vendor SDK, or a specific Tool.
 */

export interface RunAgentOptions {
  modelProvider: ModelProvider;
  capabilityProvider: CapabilityProvider;

  goal: string;
  contextPackRef?: string;
  contextSummary?: string;

  limits: AgentRunLimits;

  initialWorkingState?: Record<string, unknown>;

  /** Injectable for deterministic tests. Defaults to a real UUID. */
  runId?: string;
  /** Injectable clock for deterministic timeout tests. Defaults to Date.now. */
  now?: () => number;
}

export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const now = options.now ?? Date.now;
  const runId = options.runId ?? randomUUID();
  const startedAtMs = now();
  const deadlineMs = startedAtMs + options.limits.timeout_ms;

  const events: AgentRunEvent[] = [];
  let sequence = 0;

  const emit = (
    type: AgentRunEventType,
    details: Record<string, unknown>,
    extra?: { turn?: number; evidence_refs?: string[] },
  ): AgentRunEvent => {
    sequence += 1;
    const event: AgentRunEvent = {
      event_id: randomUUID(),
      run_id: runId,
      sequence,
      timestamp: new Date(now()).toISOString(),
      type,
      details,
      ...(extra?.turn !== undefined ? { turn: extra.turn } : {}),
      ...(extra?.evidence_refs ? { evidence_refs: extra.evidence_refs } : {}),
    };
    events.push(event);
    return event;
  };

  const state: AgentRunState = {
    run_id: runId,
    status: "RUNNING",
    turn: 0,
    started_at: new Date(startedAtMs).toISOString(),
    deadline_at: new Date(deadlineMs).toISOString(),
    messages: [
      { type: "GOAL", goal: options.goal },
      {
        type: "CONTEXT",
        context_pack_ref: options.contextPackRef,
        summary: options.contextSummary,
      },
    ],
    working_state: { ...(options.initialWorkingState ?? {}) },
    usage: {},
  };

  let usage: ModelUsage | undefined;
  const priorObservations: ObservationMessage[] = [];

  emit("RUN_STARTED", { goal: options.goal });
  emit("CONTEXT_ACCEPTED", {
    context_pack_ref: options.contextPackRef,
    summary: options.contextSummary,
  });

  const finish = (
    outcome: "SUCCESS" | "FAIL" | "BLOCKED",
    reasonCode: TerminationReasonCode,
    message: string,
    triggeringEvent: AgentRunEvent,
    output?: StructuredAgentOutput,
  ): AgentRunResult => {
    const terminalEventType: AgentRunEventType =
      outcome === "SUCCESS"
        ? "RUN_SUCCEEDED"
        : outcome === "BLOCKED"
          ? "RUN_BLOCKED"
          : reasonCode === "TIMEOUT_EXCEEDED"
            ? "RUN_TIMED_OUT"
            : reasonCode === "MAX_TURNS_EXCEEDED"
              ? "RUN_MAX_TURNS"
              : "RUN_FAILED";

    emit(terminalEventType, { reason_code: reasonCode, message });

    const termination: TerminationExplanation = {
      outcome,
      reason_code: reasonCode,
      message,
      final_turn: state.turn,
      triggering_event_id: triggeringEvent.event_id,
    };

    state.status = outcome;

    return {
      run_id: runId,
      outcome,
      output,
      termination,
      events,
      usage,
    } satisfies AgentRunResult;
  };

  const capabilities: ToolDescriptor[] = await options.capabilityProvider.list_capabilities({
    run_id: runId,
  });

  const isPastDeadline = () => now() >= deadlineMs;

  let completedDecisions = 0;

  while (true) {
    if (isPastDeadline()) {
      const ev = emit("RUN_TIMED_OUT", { at: "before_model_decision" }, { turn: state.turn });
      return finish("FAIL", "TIMEOUT_EXCEEDED", "Runtime deadline exceeded before requesting a model decision.", ev);
    }

    if (completedDecisions >= options.limits.max_turns) {
      const ev = emit("RUN_MAX_TURNS", { max_turns: options.limits.max_turns }, { turn: state.turn });
      return finish("FAIL", "MAX_TURNS_EXCEEDED", `Reached max_turns limit of ${options.limits.max_turns}.`, ev);
    }

    const turnNumber = completedDecisions + 1;
    const remainingTimeMs = Math.max(0, deadlineMs - now());

    const request: ModelDecisionRequest = {
      run_id: runId,
      turn: turnNumber,
      goal: { statement: options.goal },
      context: { context_pack_ref: options.contextPackRef, summary: options.contextSummary },
      messages: state.messages,
      capabilities,
      state: {
        prior_observations: priorObservations,
        working_state: state.working_state,
      },
      limits: {
        remaining_turns: options.limits.max_turns - completedDecisions,
        remaining_time_ms: remainingTimeMs,
      },
    };

    emit("MODEL_REQUESTED", { turn: turnNumber }, { turn: turnNumber });
    const result = await options.modelProvider.decide(request);
    completedDecisions += 1;
    state.turn = turnNumber;

    if (result.usage) {
      usage = mergeUsage(usage, result.usage);
    }

    if (isPastDeadline()) {
      const ev = emit("RUN_TIMED_OUT", { at: "after_model_decision" }, { turn: turnNumber });
      return finish("FAIL", "TIMEOUT_EXCEEDED", "Runtime deadline exceeded while awaiting a model decision.", ev);
    }

    if (result.status === "FAIL") {
      const ev = emit(
        "RUN_FAILED",
        { at: "model_decision", error: result.error },
        { turn: turnNumber },
      );
      return finish("FAIL", "MODEL_ERROR", result.error.message, ev);
    }

    if (result.status === "BLOCKED") {
      const ev = emit("RUN_BLOCKED", { at: "model_decision", reason: result.reason }, { turn: turnNumber });
      return finish("BLOCKED", "MODEL_PROVIDER_UNAVAILABLE", result.reason, ev);
    }

    const decision: ModelDecision = result.decision;
    const decidedEvent = emit("MODEL_DECIDED", { decision }, { turn: turnNumber });
    state.messages.push({ type: "MODEL_DECISION", turn: turnNumber, decision });

    if (decision.type === "FINISH") {
      const output = decision.output;
      if (!output || typeof output.summary !== "string" || output.summary.trim() === "") {
        const ev = emit(
          "RUN_FAILED",
          { at: "finish_validation", reason: "structured output missing a non-empty summary" },
          { turn: turnNumber },
        );
        return finish(
          "FAIL",
          "INVALID_STRUCTURED_OUTPUT",
          "FINISH decision did not include a valid StructuredAgentOutput.",
          ev,
        );
      }

      const finalResult = finish(
        "SUCCESS",
        "GOAL_COMPLETED",
        "ModelProvider returned FINISH with valid structured output.",
        decidedEvent,
        output,
      );
      state.messages.push({
        type: "FINAL",
        outcome: "SUCCESS",
        output,
        termination: finalResult.termination,
      });
      return finalResult;
    }

    // decision.type === "TOOL_CALL"
    const { call_id, capability_id, input } = decision.tool_call;

    if (!capability_id || typeof capability_id !== "string") {
      const ev = emit(
        "RUN_FAILED",
        { at: "tool_call_validation", reason: "missing capability_id" },
        { turn: turnNumber },
      );
      return finish("FAIL", "INVALID_MODEL_DECISION", "TOOL_CALL decision did not include a capability_id.", ev);
    }

    const descriptor = capabilities.find((c) => c.capability_id === capability_id);
    if (!descriptor) {
      const ev = emit(
        "RUN_BLOCKED",
        { at: "tool_call_validation", capability_id },
        { turn: turnNumber },
      );
      return finish(
        "BLOCKED",
        "REQUIRED_CAPABILITY_MISSING",
        `Capability '${capability_id}' is not available from the current CapabilityProvider.`,
        ev,
      );
    }

    state.messages.push({ type: "TOOL_CALL", turn: turnNumber, call_id, capability_id, input });
    emit("TOOL_REQUESTED", { call_id, capability_id, input }, { turn: turnNumber });

    const invocationTimeoutMs = Math.max(1, Math.min(descriptor.timeout_ms ?? deadlineMs - now(), deadlineMs - now()));

    const toolResult = await options.capabilityProvider.invoke({
      run_id: runId,
      turn: turnNumber,
      call_id,
      capability_id,
      input,
      timeout_ms: invocationTimeoutMs,
    });

    if (isPastDeadline()) {
      const ev = emit("RUN_TIMED_OUT", { at: "after_tool_invocation" }, { turn: turnNumber });
      return finish("FAIL", "TIMEOUT_EXCEEDED", "Runtime deadline exceeded while awaiting a Tool invocation.", ev);
    }

    if (toolResult.status === "SUCCESS") {
      const observation: ObservationMessage = {
        type: "OBSERVATION",
        turn: turnNumber,
        call_id,
        capability_id,
        outcome: "SUCCESS",
        output: toolResult.output,
        evidence_refs: toolResult.evidence_refs,
      };
      priorObservations.push(observation);
      state.messages.push(observation);
      emit(
        "TOOL_COMPLETED",
        { call_id, capability_id, output: toolResult.output, duration_ms: toolResult.duration_ms },
        { turn: turnNumber, evidence_refs: toolResult.evidence_refs },
      );

      const patch = { [`observation:${call_id}`]: toolResult.output };
      state.working_state = { ...state.working_state, ...patch };
      state.messages.push({
        type: "STATE_UPDATE",
        turn: turnNumber,
        patch,
        reason: `Recorded successful observation for capability '${capability_id}'.`,
      });
      emit("STATE_UPDATED", { patch }, { turn: turnNumber });
      continue;
    }

    if (toolResult.status === "FAIL") {
      const observation: ObservationMessage = {
        type: "OBSERVATION",
        turn: turnNumber,
        call_id,
        capability_id,
        outcome: "FAIL",
        error: toolResult.error,
        evidence_refs: toolResult.evidence_refs,
      };
      priorObservations.push(observation);
      state.messages.push(observation);
      emit(
        "TOOL_FAILED",
        { call_id, capability_id, error: toolResult.error, duration_ms: toolResult.duration_ms },
        { turn: turnNumber, evidence_refs: toolResult.evidence_refs },
      );
      const ev = emit("RUN_FAILED", { at: "tool_invocation", error: toolResult.error }, { turn: turnNumber });
      return finish("FAIL", "TOOL_ERROR", toolResult.error.message, ev);
    }

    // toolResult.status === "BLOCKED"
    const observation: ObservationMessage = {
      type: "OBSERVATION",
      turn: turnNumber,
      call_id,
      capability_id,
      outcome: "BLOCKED",
      reason: toolResult.reason,
      evidence_refs: toolResult.evidence_refs,
    };
    priorObservations.push(observation);
    state.messages.push(observation);
    emit(
      "TOOL_FAILED",
      { call_id, capability_id, reason: toolResult.reason, duration_ms: toolResult.duration_ms },
      { turn: turnNumber, evidence_refs: toolResult.evidence_refs },
    );
    const ev = emit("RUN_BLOCKED", { at: "tool_invocation", reason: toolResult.reason }, { turn: turnNumber });
    return finish("BLOCKED", "PERMISSION_REQUIRED", toolResult.reason, ev);
  }
}

function mergeUsage(acc: ModelUsage | undefined, next: ModelUsage): ModelUsage {
  const merged: ModelUsage = { ...acc };
  if (next.input_tokens !== undefined) {
    merged.input_tokens = (merged.input_tokens ?? 0) + next.input_tokens;
  }
  if (next.output_tokens !== undefined) {
    merged.output_tokens = (merged.output_tokens ?? 0) + next.output_tokens;
  }
  if (next.total_tokens !== undefined) {
    merged.total_tokens = (merged.total_tokens ?? 0) + next.total_tokens;
  }
  if (next.cost_amount !== undefined) {
    merged.cost_amount = (merged.cost_amount ?? 0) + next.cost_amount;
  }
  if (next.cost_currency !== undefined) {
    merged.cost_currency = next.cost_currency;
  }
  if (next.provider_metadata !== undefined) {
    merged.provider_metadata = next.provider_metadata;
  }
  return merged;
}
