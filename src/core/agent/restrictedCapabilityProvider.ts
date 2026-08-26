import type {
  CapabilityListRequest,
  CapabilityProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
  ToolSideEffectClass,
} from "./types.js";

/**
 * Generic capability restriction boundary (AGENT_RUNTIME_LOOP_v1 compiler,
 * section 23 of brain-bootstrap/specs/AGENT_DEFINITION_v1.md).
 *
 * Wraps an injected CapabilityProvider so an Agent only ever sees and can
 * invoke the capabilities its AgentDefinition explicitly allows, filtered
 * further by permitted side-effect classes. This class contains no role
 * names and no per-role branching — it is generic infrastructure driven
 * entirely by the allowlist/side-effect set it is constructed with.
 */
export class RestrictedCapabilityProvider implements CapabilityProvider {
  constructor(
    private readonly inner: CapabilityProvider,
    private readonly allowedCapabilityIds: ReadonlySet<string>,
    private readonly allowedSideEffects: ReadonlySet<ToolSideEffectClass>,
  ) {}

  private isPermitted(descriptor: ToolDescriptor): boolean {
    return (
      this.allowedCapabilityIds.has(descriptor.capability_id) &&
      this.allowedSideEffects.has(descriptor.side_effects)
    );
  }

  async list_capabilities(request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    const all = await this.inner.list_capabilities(request);
    return all.filter((descriptor) => this.isPermitted(descriptor));
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const descriptors = await this.inner.list_capabilities({ run_id: request.run_id });
    const descriptor = descriptors.find((d) => d.capability_id === request.capability_id);

    if (!descriptor || !this.isPermitted(descriptor)) {
      return {
        status: "BLOCKED",
        call_id: request.call_id,
        capability_id: request.capability_id,
        reason: `Capability '${request.capability_id}' is not permitted by this Agent's permissions/capability allowlist.`,
        duration_ms: 0,
      };
    }

    return this.inner.invoke(request);
  }
}
