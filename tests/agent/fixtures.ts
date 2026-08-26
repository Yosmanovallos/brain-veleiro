import { randomUUID } from "node:crypto";
import type {
  CapabilityListRequest,
  CapabilityProvider,
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "../../src/core/agent/index.js";

/** Alternate ModelProvider (T7 substitution): finishes on the very first turn. */
export class ImmediateFinishModelProvider implements ModelProvider {
  async decide(_request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: "Immediate-finish fake provider always finishes on the first turn.",
        output: { summary: "Finished immediately without calling any tool." },
      },
    };
  }
}

/**
 * Fake ModelProvider that never finishes (T3 max-turns test).
 *
 * Passes the current working_state as input so the underlying Tool keeps
 * succeeding on every turn — this fixture must isolate the max-turns
 * behavior from any tool-failure behavior, so a successful call every turn
 * that is simply never recognized as "done" is the correct shape.
 */
export class NeverFinishModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const capability = request.capabilities[0];
    return {
      status: "SUCCESS",
      decision: {
        type: "TOOL_CALL",
        rationale: "Never-finish fake provider always calls a tool again, regardless of prior observations.",
        tool_call: {
          call_id: randomUUID(),
          capability_id: capability.capability_id,
          input: request.state.working_state ?? {},
        },
      },
    };
  }
}

/** Wraps a ModelProvider and adds an artificial delay (T4 timeout test). */
export class DelayedModelProvider implements ModelProvider {
  constructor(
    private readonly inner: ModelProvider,
    private readonly delayMs: number,
  ) {}

  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return this.inner.decide(request);
  }
}

/** Fake ModelProvider that always returns a normalized FAIL (T12). */
export class FailingModelProvider implements ModelProvider {
  async decide(_request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    return {
      status: "FAIL",
      error: { code: "INTERNAL_ERROR", message: "Simulated model provider failure.", retryable: false },
    };
  }
}

/** Fake ModelProvider that requests a capability that does not exist (T6). */
export class UnknownCapabilityModelProvider implements ModelProvider {
  async decide(_request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    return {
      status: "SUCCESS",
      decision: {
        type: "TOOL_CALL",
        rationale: "Deliberately requests a capability the CapabilityProvider does not expose.",
        tool_call: { call_id: randomUUID(), capability_id: "nonexistent_capability", input: {} },
      },
    };
  }
}

const WORD_COUNT_DESCRIPTOR: ToolDescriptor = {
  capability_id: "word_count",
  name: "Word Count",
  description: "Counts the whitespace-delimited words in a supplied text string.",
  input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  output_schema: { type: "object", properties: { word_count: { type: "number" } } },
  side_effects: "NONE",
};

/** Fault-injecting CapabilityProvider: the tool always fails (T5). */
export class FaultInjectingCapabilityProvider implements CapabilityProvider {
  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return [WORD_COUNT_DESCRIPTOR];
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    return {
      status: "FAIL",
      call_id: request.call_id,
      capability_id: request.capability_id,
      error: { code: "EXECUTION_FAILED", message: "Simulated tool execution failure.", retryable: false },
      duration_ms: 1,
    };
  }
}

/**
 * Alternate real CapabilityProvider (T8 substitution): exposes a different
 * real, deterministic Tool (char_count instead of word_count) so the
 * substitution test proves the loop against genuinely different providers.
 */
export class AlternateCapabilityProvider implements CapabilityProvider {
  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return [
      {
        capability_id: "char_count",
        name: "Character Count",
        description: "Counts the characters in a supplied text string.",
        input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        output_schema: { type: "object", properties: { char_count: { type: "number" } } },
        side_effects: "NONE",
      },
    ];
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const start = Date.now();
    const text = request.input.text;
    if (typeof text !== "string") {
      return {
        status: "FAIL",
        call_id: request.call_id,
        capability_id: request.capability_id,
        error: { code: "INVALID_INPUT", message: "input.text must be a string.", retryable: false },
        duration_ms: Date.now() - start,
      };
    }
    return {
      status: "SUCCESS",
      call_id: request.call_id,
      capability_id: request.capability_id,
      output: { char_count: text.length },
      duration_ms: Date.now() - start,
    };
  }
}

/** CapabilityProvider that always delays past a short deadline (T4 alternate path). */
export class DelayedCapabilityProvider implements CapabilityProvider {
  constructor(
    private readonly inner: CapabilityProvider,
    private readonly delayMs: number,
  ) {}

  async list_capabilities(request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return this.inner.list_capabilities(request);
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return this.inner.invoke(request);
  }
}

/**
 * Configurable CapabilityProvider exposing an arbitrary fixed set of
 * descriptors, all trivially "successful" on invoke. Used by the S10
 * AgentDefinition capability-restriction tests (T7-T9), which need a
 * provider that legitimately exposes more than one capability.
 */
export class MultiCapabilityProvider implements CapabilityProvider {
  constructor(private readonly descriptors: ToolDescriptor[]) {}

  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return this.descriptors;
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const start = Date.now();
    const descriptor = this.descriptors.find((d) => d.capability_id === request.capability_id);
    if (!descriptor) {
      return {
        status: "FAIL",
        call_id: request.call_id,
        capability_id: request.capability_id,
        error: { code: "NOT_FOUND", message: `Unknown capability '${request.capability_id}'.`, retryable: false },
        duration_ms: Date.now() - start,
      };
    }
    return {
      status: "SUCCESS",
      call_id: request.call_id,
      capability_id: request.capability_id,
      output: { invoked: descriptor.capability_id },
      duration_ms: Date.now() - start,
    };
  }
}
