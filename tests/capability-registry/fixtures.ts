import type {
  CapabilityListRequest,
  CapabilityProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
  ToolSideEffectClass,
} from "../../src/core/agent/index.js";

/**
 * Deterministic in-memory fake CapabilityProvider for S14A registry tests.
 *
 * Tracks call counts so tests can prove a provider was (or was NOT) actually
 * reached through the registry — needed to make first-provider-wins,
 * unknown-capability-forwarding and RestrictedCapabilityProvider-bypass
 * negatives non-vacuous (see brain-bootstrap/quality-contracts/
 * S14_CAPABILITY_REGISTRY_TOOLS_MCP_DEEP.yaml UC04, UC06).
 */
export class FakeCapabilityProvider implements CapabilityProvider {
  listCallCount = 0;
  invokeCallCount = 0;

  constructor(
    private readonly descriptors: ToolDescriptor[],
    private readonly behavior?: (request: ToolInvocationRequest) => ToolInvocationResult | Promise<ToolInvocationResult>,
  ) {}

  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    this.listCallCount += 1;
    return this.descriptors;
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    this.invokeCallCount += 1;
    if (this.behavior) {
      return this.behavior(request);
    }
    return {
      status: "SUCCESS",
      call_id: request.call_id,
      capability_id: request.capability_id,
      output: { input: request.input },
      duration_ms: 0,
    };
  }
}

function descriptor(capabilityId: string, sideEffects: ToolSideEffectClass): ToolDescriptor {
  return {
    capability_id: capabilityId,
    name: capabilityId,
    description: `Fake fixture descriptor for '${capabilityId}'.`,
    input_schema: { type: "object", properties: {}, additionalProperties: true },
    output_schema: { type: "object", properties: {}, additionalProperties: true },
    side_effects: sideEffects,
  };
}

/** A real, deterministic (input-dependent) echo provider, tagged so tests can tell providers apart. */
export function makeEchoProvider(
  capabilityId: string,
  tag: string,
  sideEffects: ToolSideEffectClass = "NONE",
): FakeCapabilityProvider {
  return new FakeCapabilityProvider([descriptor(capabilityId, sideEffects)], (request) => ({
    status: "SUCCESS",
    call_id: request.call_id,
    capability_id: request.capability_id,
    output: { via: tag, echoed: request.input },
    duration_ms: 0,
  }));
}

/** Provider whose invoke() always throws (never returns a normalized result). */
export function makeThrowingProvider(capabilityId: string, message: string): FakeCapabilityProvider {
  return new FakeCapabilityProvider([descriptor(capabilityId, "NONE")], () => {
    throw new Error(message);
  });
}

/** Provider that legitimately returns a normalized FAIL — must be preserved verbatim. */
export function makeFailingProvider(capabilityId: string): FakeCapabilityProvider {
  return new FakeCapabilityProvider([descriptor(capabilityId, "NONE")], (request) => ({
    status: "FAIL",
    call_id: request.call_id,
    capability_id: request.capability_id,
    error: { code: "EXECUTION_FAILED", message: "Fixture-injected deterministic provider failure.", retryable: false },
    duration_ms: 0,
  }));
}

/** Provider that legitimately returns a normalized BLOCKED — must be preserved verbatim. */
export function makeSelfBlockingProvider(capabilityId: string): FakeCapabilityProvider {
  return new FakeCapabilityProvider([descriptor(capabilityId, "NONE")], (request) => ({
    status: "BLOCKED",
    call_id: request.call_id,
    capability_id: request.capability_id,
    reason: "Fixture-injected provider-local policy denial.",
    duration_ms: 0,
  }));
}

/** Misbehaving provider: returns a result under a different call_id/capability_id than requested. */
export function makeIdentityMismatchProvider(capabilityId: string): FakeCapabilityProvider {
  return new FakeCapabilityProvider([descriptor(capabilityId, "NONE")], () => ({
    status: "SUCCESS",
    call_id: "wrong-call-id",
    capability_id: "wrong-capability-id",
    output: {},
    duration_ms: 0,
  }));
}

/**
 * Provider that is bound in the registry config under `boundCapabilityId`
 * but whose own list_capabilities() never advertises that id — it only
 * advertises `advertisedCapabilityId` (a different string). Used for both
 * "does not advertise routed capability" and "descriptor advertises
 * mismatched capability id" negatives, which share one guard.
 */
export function makeNonAdvertisingProvider(advertisedCapabilityId: string): FakeCapabilityProvider {
  return new FakeCapabilityProvider([descriptor(advertisedCapabilityId, "NONE")]);
}

/** Provider whose list_capabilities() itself throws. */
export function makeListThrowingProvider(): CapabilityProvider {
  return {
    async list_capabilities(): Promise<ToolDescriptor[]> {
      throw new Error("Fixture-injected list_capabilities failure.");
    },
    async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
      return { status: "SUCCESS", call_id: request.call_id, capability_id: request.capability_id, output: {}, duration_ms: 0 };
    },
  };
}
