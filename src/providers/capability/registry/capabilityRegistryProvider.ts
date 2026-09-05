import type {
  CapabilityListRequest,
  CapabilityProvider,
  NormalizedToolError,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "../../../core/agent/index.js";
import type {
  CapabilityRegistryConfig,
  CapabilityRegistryDiagnostic,
  CapabilityRegistryRouteStatus,
} from "./types.js";
import { validateCapabilityRegistryConfig } from "./validateConfig.js";

/**
 * S14A — Capability Registry Foundation.
 *
 * Resolves stable, provider-neutral capability IDs to exactly one explicitly
 * selected CapabilityProvider implementation. Implements the existing Core
 * CapabilityProvider interface unchanged, so it composes underneath
 * RestrictedCapabilityProvider with no special-case integration:
 *
 *   concrete providers -> CapabilityRegistryProvider -> RestrictedCapabilityProvider -> runAgent()
 *
 * See brain-bootstrap/skills/CAPABILITY_REGISTRY_TOOLS_MCP_SKILL_S14.md and
 * brain-bootstrap/specs/CAPABILITY_REGISTRY_TOOLS_MCP_CONTRACT_S14.md.
 *
 * Explicit routing only: resolution depends solely on the supplied config's
 * `bindings` array. Nothing here reads the process environment, the
 * filesystem, network reachability, registration order, or any other
 * hidden signal.
 */
export class CapabilityRegistryProvider implements CapabilityProvider {
  private readonly providersById: ReadonlyMap<string, CapabilityProvider>;
  private readonly routing: ReadonlyMap<string, CapabilityRegistryRouteStatus>;

  constructor(config: CapabilityRegistryConfig) {
    const findings = validateCapabilityRegistryConfig(config);
    const fatal = findings.filter((finding) => finding.fatal);
    if (fatal.length > 0) {
      throw new Error(
        `Invalid CapabilityRegistryConfig: ${fatal.map((finding) => finding.message).join(" | ")}`,
      );
    }

    const perCapabilityFindings = new Map(
      findings.filter((finding) => !finding.fatal).map((finding) => [finding.capability_id!, finding]),
    );

    this.providersById = new Map(config.providers.map((registered) => [registered.provider_id, registered.provider]));

    const selectedProviderIdByCapability = new Map<string, string>();
    for (const binding of config.bindings) {
      // A capability_id with more than one binding is already captured as an
      // AMBIGUOUS_CAPABILITY_BINDING finding above; do not let a later
      // binding silently overwrite an earlier one (no first/last-wins).
      if (!selectedProviderIdByCapability.has(binding.capability_id)) {
        selectedProviderIdByCapability.set(binding.capability_id, binding.selected_provider_id);
      }
    }

    const routing = new Map<string, CapabilityRegistryRouteStatus>();
    for (const capabilityId of new Set([...selectedProviderIdByCapability.keys(), ...perCapabilityFindings.keys()])) {
      const finding = perCapabilityFindings.get(capabilityId);
      if (finding) {
        routing.set(capabilityId, { status: "UNRESOLVED", finding });
        continue;
      }
      routing.set(capabilityId, {
        status: "RESOLVED",
        selected_provider_id: selectedProviderIdByCapability.get(capabilityId)!,
      });
    }

    this.routing = routing;
  }

  /**
   * Safe, bounded diagnostics: capability_id, resolution status and reason
   * code only. Never exposes provider internals or secret material because
   * none exist anywhere in this config shape.
   */
  diagnostics(): CapabilityRegistryDiagnostic[] {
    return [...this.routing.keys()].sort().map((capability_id) => ({
      capability_id,
      route: this.routing.get(capability_id)!,
    }));
  }

  async list_capabilities(request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    const capabilityIds = [...this.routing.keys()].sort();
    const descriptors: ToolDescriptor[] = [];

    for (const capabilityId of capabilityIds) {
      const route = this.routing.get(capabilityId)!;
      if (route.status !== "RESOLVED") {
        continue;
      }
      const provider = this.providersById.get(route.selected_provider_id);
      if (!provider) {
        continue;
      }
      const providerDescriptors = await provider.list_capabilities(request);
      const descriptor = providerDescriptors.find((candidate) => candidate.capability_id === capabilityId);
      if (!descriptor) {
        continue;
      }
      descriptors.push(descriptor);
    }

    return descriptors;
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const start = Date.now();
    const route = this.routing.get(request.capability_id);

    if (!route) {
      return blocked(
        request,
        start,
        `REQUIRED_CAPABILITY_MISSING: no explicit selected provider binding exists for capability '${request.capability_id}'.`,
      );
    }

    if (route.status === "UNRESOLVED") {
      return blocked(request, start, route.finding.message);
    }

    const provider = this.providersById.get(route.selected_provider_id);
    if (!provider) {
      return blocked(
        request,
        start,
        `REQUIRED_CAPABILITY_MISSING: selected provider '${route.selected_provider_id}' for capability '${request.capability_id}' is not registered.`,
      );
    }

    let providerDescriptors: ToolDescriptor[];
    try {
      providerDescriptors = await provider.list_capabilities({ run_id: request.run_id });
    } catch (error) {
      return fail(request, start, normalizeThrown(error));
    }

    const descriptor = providerDescriptors.find((candidate) => candidate.capability_id === request.capability_id);
    if (!descriptor) {
      return blocked(
        request,
        start,
        `PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY: selected provider '${route.selected_provider_id}' does not ` +
          `advertise a descriptor for capability '${request.capability_id}'.`,
      );
    }

    let result: ToolInvocationResult;
    try {
      result = await provider.invoke(request);
    } catch (error) {
      return fail(request, start, normalizeThrown(error));
    }

    // The selected provider's own normalized SUCCESS/FAIL/BLOCKED result is
    // preserved verbatim (contract section 17) UNLESS it breaks the
    // call_id/capability_id identity invariant the registry itself owns
    // (S14A-HI-010) -- that is a provider defect, normalized here rather than
    // silently forwarded or silently patched over.
    if (result.call_id !== request.call_id || result.capability_id !== request.capability_id) {
      return fail(request, start, {
        code: "INTERNAL_ERROR",
        message: "Selected provider returned a result with a call_id/capability_id mismatch.",
        retryable: false,
      });
    }

    return result;
  }
}

const THROWN_MESSAGE_MAX_CHARS = 500;

function normalizeThrown(error: unknown): NormalizedToolError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message =
    rawMessage.length > THROWN_MESSAGE_MAX_CHARS
      ? `${rawMessage.slice(0, THROWN_MESSAGE_MAX_CHARS)}...(truncated)`
      : rawMessage;
  return {
    code: "INTERNAL_ERROR",
    message: `Selected provider threw during invocation: ${message}`,
    retryable: false,
  };
}

function blocked(request: ToolInvocationRequest, start: number, reason: string): ToolInvocationResult {
  return {
    status: "BLOCKED",
    call_id: request.call_id,
    capability_id: request.capability_id,
    reason,
    duration_ms: Date.now() - start,
  };
}

function fail(request: ToolInvocationRequest, start: number, error: NormalizedToolError): ToolInvocationResult {
  return {
    status: "FAIL",
    call_id: request.call_id,
    capability_id: request.capability_id,
    error,
    duration_ms: Date.now() - start,
  };
}
