import { randomUUID } from "node:crypto";
import type {
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
} from "../../core/agent/index.js";

/**
 * Reference implementation of Brain's ModelProvider contract.
 *
 * Makes deterministic, model-shaped decisions using ordinary code logic:
 * no network call, no credential, no external LLM. It proves the Agent
 * Runtime loop and the ModelProvider substitution boundary without
 * depending on a specific model vendor.
 *
 * Decision policy (generic, not tied to a specific capability name):
 *   - if at least one capability is available and none has a SUCCESS
 *     observation yet, call the first available capability;
 *   - once a SUCCESS observation exists for the capability it called,
 *     FINISH with a structured output derived from that observation;
 *   - if no capability is available at all, return BLOCKED.
 *
 * See brain-bootstrap/decisions/ADR-agent-runtime-model-provider.md and
 * brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md sections 9 and 22.
 */
export class DeterministicReferenceModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    if (request.capabilities.length === 0) {
      return { status: "BLOCKED", reason: "No capabilities are available to satisfy the goal." };
    }

    const target = request.capabilities[0];
    const successfulObservation = request.state.prior_observations.find(
      (obs) => obs.capability_id === target.capability_id && obs.outcome === "SUCCESS",
    );

    if (successfulObservation) {
      return {
        status: "SUCCESS",
        decision: {
          type: "FINISH",
          rationale: `Capability '${target.capability_id}' produced a successful observation; goal satisfied.`,
          output: {
            summary: `Completed using capability '${target.capability_id}'.`,
            data: successfulObservation.output ?? {},
            evidence_refs: successfulObservation.evidence_refs,
          },
        },
      };
    }

    return {
      status: "SUCCESS",
      decision: {
        type: "TOOL_CALL",
        rationale: `No successful observation yet for capability '${target.capability_id}'; invoking it.`,
        tool_call: {
          call_id: randomUUID(),
          capability_id: target.capability_id,
          input: request.state.working_state ?? {},
        },
      },
    };
  }
}
