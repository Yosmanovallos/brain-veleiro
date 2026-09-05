import type { CapabilityProvider } from "../../../core/agent/index.js";

/**
 * S14A — Capability Registry Foundation: provider-neutral registry
 * configuration types.
 *
 * Defined by brain-bootstrap/skills/CAPABILITY_REGISTRY_TOOLS_MCP_SKILL_S14.md
 * and brain-bootstrap/specs/CAPABILITY_REGISTRY_TOOLS_MCP_CONTRACT_S14.md.
 * Lives outside Core; the registry (./capabilityRegistryProvider.js) itself
 * implements the existing Core CapabilityProvider interface, so Core and
 * RestrictedCapabilityProvider remain unaware of registry/provider identity.
 *
 * S14A intentionally carries no credential/auth/connection reference field:
 * nothing in this foundation phase needs one, and the semantic contract
 * (section 11) treats those as provider-layer concerns for later phases.
 */

export interface RegisteredCapabilityProvider {
  provider_id: string;
  provider: CapabilityProvider;
}

export interface CapabilityRegistryBinding {
  capability_id: string;
  selected_provider_id: string;
}

export interface CapabilityRegistryConfig {
  providers: RegisteredCapabilityProvider[];
  bindings: CapabilityRegistryBinding[];
}

/**
 * DUPLICATE_PROVIDER_ID is fatal: two providers cannot share one identity,
 * so the whole config is unconstructible (rejected at construction).
 *
 * NO_BINDING, UNKNOWN_PROVIDER_REFERENCE and AMBIGUOUS_CAPABILITY_BINDING are
 * per-capability findings: they leave every other capability_id fully
 * routable and are resolved to a fail-closed BLOCKED result only for the
 * affected capability_id, at list/invoke time.
 *
 * PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY can only be discovered by actually
 * calling the selected provider's list_capabilities(), so it is never part
 * of the synchronous constructor-time findings list.
 */
export type CapabilityRegistryFindingCode =
  | "DUPLICATE_PROVIDER_ID"
  | "NO_BINDING"
  | "UNKNOWN_PROVIDER_REFERENCE"
  | "AMBIGUOUS_CAPABILITY_BINDING"
  | "PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY";

export interface CapabilityRegistryFinding {
  code: CapabilityRegistryFindingCode;
  fatal: boolean;
  message: string;
  capability_id?: string;
  provider_id?: string;
}

export type CapabilityRegistryRouteStatus =
  | { status: "RESOLVED"; selected_provider_id: string }
  | { status: "UNRESOLVED"; finding: CapabilityRegistryFinding };

export interface CapabilityRegistryDiagnostic {
  capability_id: string;
  route: CapabilityRegistryRouteStatus;
}
