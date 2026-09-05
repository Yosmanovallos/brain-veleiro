import type { CapabilityListRequest, CapabilityProvider, ToolDescriptor, ToolInvocationRequest, ToolInvocationResult } from "../../../core/agent/index.js";
import type { CapabilityRegistryConfig, CapabilityRegistryDiagnostic, CapabilityRegistryRouteStatus } from "./types.js";
import { validateCapabilityRegistryConfig } from "./validateConfig.js";
import { canonical, LIMITS, semanticSignature, validatedDescriptor, validResult } from "./validation.js";

/** Explicit provider-layer routing, composed underneath RestrictedCapabilityProvider. */
export class CapabilityRegistryProvider implements CapabilityProvider {
  private readonly providersById: ReadonlyMap<string, CapabilityProvider>;
  private readonly routing = new Map<string, CapabilityRegistryRouteStatus>();
  // Published permission contracts stay fixed for this registry's lifetime.
  private readonly published = new Map<string, string>();

  constructor(config: CapabilityRegistryConfig) {
    const findings = validateCapabilityRegistryConfig(config);
    const fatal = findings.filter(f => f.fatal);
    if (fatal.length) throw new Error(`Invalid CapabilityRegistryConfig: ${fatal.map(f => f.code).join(", ")}`);
    this.providersById = new Map(config.providers.map(p => [p.provider_id, p.provider]));
    for (const binding of config.bindings) {
      const finding = findings.find(f => f.capability_id === binding.capability_id);
      this.routing.set(binding.capability_id, finding
        ? { status: "UNRESOLVED", finding }
        : { status: "RESOLVED", selected_provider_id: binding.selected_provider_id });
    }
  }

  diagnostics(): CapabilityRegistryDiagnostic[] {
    return [...this.routing.keys()].sort().slice(0, LIMITS.diagnostics).map(capability_id => ({
      capability_id, route: structuredClone(this.routing.get(capability_id)!),
    }));
  }

  private async catalog(request?: CapabilityListRequest): Promise<Map<string, Map<string, ToolDescriptor>>> {
    const catalog = new Map<string, Map<string, ToolDescriptor>>();
    const signatures = new Map<string, string>();
    const collisions = new Set<string>();
    // Inspect every implementation: explicit selection does not authorize
    // incompatible implementations of one public capability contract.
    for (const id of [...this.providersById.keys()].sort()) {
      const raw: unknown = await this.providersById.get(id)!.list_capabilities(request === undefined ? undefined : structuredClone(request));
      if (!Array.isArray(raw) || raw.length > LIMITS.perProvider) throw new Error("INVALID_DESCRIPTOR_LIST");
      const descriptors = new Map<string, ToolDescriptor>();
      for (const item of raw) {
        const d = validatedDescriptor(item);
        const signature = semanticSignature(d);
        const previous = signatures.get(d.capability_id);
        if (previous !== undefined && previous !== signature) collisions.add(d.capability_id);
        signatures.set(d.capability_id, signature);
        if (signatures.size > LIMITS.capabilities) throw new Error("CAPABILITY_LIMIT");
        if (descriptors.has(d.capability_id)) collisions.add(d.capability_id);
        descriptors.set(d.capability_id, d);
      }
      catalog.set(id, descriptors);
    }
    for (const descriptors of catalog.values()) {
      for (const [id, d] of descriptors) {
        const previous = this.published.get(id);
        if (collisions.has(id) || (previous !== undefined && previous !== semanticSignature(d))) descriptors.delete(id);
      }
    }
    return catalog;
  }

  async list_capabilities(request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    try {
      const catalog = await this.catalog(request);
      const result: ToolDescriptor[] = [];
      for (const id of [...this.routing.keys()].sort()) {
        const route = this.routing.get(id)!;
        if (route.status !== "RESOLVED") continue;
        const d = catalog.get(route.selected_provider_id)?.get(id);
        if (!d) continue;
        this.published.set(id, semanticSignature(d));
        result.push(d);
      }
      return result;
    } catch {
      // CapabilityProvider has no list error union: expose no capabilities.
      return [];
    }
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const start = Date.now();
    const identity = { call_id: request.call_id, capability_id: request.capability_id };
    const blocked = (reason: string): ToolInvocationResult => ({ status: "BLOCKED", ...identity, reason, duration_ms: Date.now() - start });
    const fail = (): ToolInvocationResult => ({ status: "FAIL", ...identity,
      error: { code: "INTERNAL_ERROR", message: "Selected provider violated the registry contract or could not complete the operation.", retryable: false },
      duration_ms: Date.now() - start });
    const route = this.routing.get(identity.capability_id);
    if (!route) return blocked("REQUIRED_CAPABILITY_MISSING: no explicit selected provider binding.");
    if (route.status !== "RESOLVED") return blocked(route.finding.message);
    try {
      const invocation = structuredClone(request);
      const catalog = await this.catalog({ run_id: invocation.run_id });
      const descriptor = catalog.get(route.selected_provider_id)?.get(identity.capability_id);
      if (!descriptor) return blocked("PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY: missing, incompatible or changed public descriptor.");
      this.published.set(identity.capability_id, semanticSignature(descriptor));
      const raw: unknown = await this.providersById.get(route.selected_provider_id)!.invoke(invocation);
      // Preserve legal optional undefined fields in the detached result.
      const result: unknown = structuredClone(raw);
      canonical(result);
      if (!validResult(result) || result.call_id !== identity.call_id || result.capability_id !== identity.capability_id) return fail();
      return result;
    } catch {
      return fail();
    }
  }
}
