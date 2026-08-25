import type {
  CapabilityListRequest,
  CapabilityProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "../../core/agent/index.js";

/**
 * Reference implementation of Brain's CapabilityProvider contract.
 *
 * Exposes exactly one real, deterministic Tool: word_count. It performs an
 * actual computation over the supplied text (not a canned answer), which is
 * what the S09 "real Tool" acceptance test requires.
 *
 * See brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md sections 5-8 and 21.
 */

const WORD_COUNT_DESCRIPTOR: ToolDescriptor = {
  capability_id: "word_count",
  name: "Word Count",
  description: "Counts the whitespace-delimited words in a supplied text string.",
  input_schema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
  },
  output_schema: {
    type: "object",
    properties: { word_count: { type: "number" } },
    required: ["word_count"],
  },
  side_effects: "NONE",
};

export class ReferenceCapabilityProvider implements CapabilityProvider {
  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return [WORD_COUNT_DESCRIPTOR];
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const start = Date.now();

    if (request.capability_id !== WORD_COUNT_DESCRIPTOR.capability_id) {
      return {
        status: "FAIL",
        call_id: request.call_id,
        capability_id: request.capability_id,
        error: {
          code: "NOT_FOUND",
          message: `Unknown capability '${request.capability_id}'.`,
          retryable: false,
        },
        duration_ms: Date.now() - start,
      };
    }

    const text = request.input.text;
    if (typeof text !== "string") {
      return {
        status: "FAIL",
        call_id: request.call_id,
        capability_id: request.capability_id,
        error: {
          code: "INVALID_INPUT",
          message: "input.text must be a string.",
          retryable: false,
        },
        duration_ms: Date.now() - start,
      };
    }

    const trimmed = text.trim();
    const word_count = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;

    return {
      status: "SUCCESS",
      call_id: request.call_id,
      capability_id: request.capability_id,
      output: { word_count },
      duration_ms: Date.now() - start,
    };
  }
}
