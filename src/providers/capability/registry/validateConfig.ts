import type { CapabilityRegistryConfig, CapabilityRegistryFinding } from "./types.js";
import { capabilityId, LIMITS, record, safeId } from "./validation.js";

/**
 * Pure, side-effect-free structural validation of a CapabilityRegistryConfig.
 *
 * Deterministic for equivalent configuration regardless of array order
 * (S14A-HI-020/HI-021): grouping is by id, never by array position.
 *
 * This function only inspects the config's own shape. It cannot detect
 * whether a selected provider actually advertises its routed capability —
 * that requires calling the provider and is checked separately by
 * CapabilityRegistryProvider at list/invoke time
 * (PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY).
 */
export function validateCapabilityRegistryConfig(
  config: CapabilityRegistryConfig,
): CapabilityRegistryFinding[] {
  const findings: CapabilityRegistryFinding[] = [];
  // Reject malformed configuration without interpolating untrusted values.
  if (!record(config) || Object.keys(config).some(k => !["providers", "bindings"].includes(k)) ||
      !Array.isArray(config.providers) || !Array.isArray(config.bindings) ||
      config.providers.length > LIMITS.providers || config.bindings.length > LIMITS.capabilities ||
      config.providers.some(p => !record(p) || Object.keys(p).some(k => !["provider_id", "provider"].includes(k)) ||
        !safeId(p.provider_id) || !p.provider || typeof p.provider.list_capabilities !== "function" || typeof p.provider.invoke !== "function") ||
      config.bindings.some(b => !record(b) || Object.keys(b).some(k => !["capability_id", "selected_provider_id"].includes(k)) ||
        !capabilityId(b.capability_id) || !safeId(b.selected_provider_id))) {
    return [{ code: "INVALID_CONFIG", fatal: true, message: "INVALID_CONFIG: invalid registry shape, identifier or size limit." }];
  }

  const providerIdCounts = new Map<string, number>();
  for (const registered of config.providers) {
    providerIdCounts.set(registered.provider_id, (providerIdCounts.get(registered.provider_id) ?? 0) + 1);
  }

  const duplicateProviderIds = [...providerIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([providerId]) => providerId)
    .sort();

  for (const providerId of duplicateProviderIds) {
    findings.push({
      code: "DUPLICATE_PROVIDER_ID",
      fatal: true,
      provider_id: providerId,
      message: `DUPLICATE_PROVIDER_ID: provider_id '${providerId}' is registered ${providerIdCounts.get(providerId)} times; provider ids must be unique.`,
    });
  }

  const knownProviderIds = new Set(providerIdCounts.keys());

  const selectedProviderIdsByCapability = new Map<string, string[]>();
  for (const binding of config.bindings) {
    const list = selectedProviderIdsByCapability.get(binding.capability_id) ?? [];
    list.push(binding.selected_provider_id);
    selectedProviderIdsByCapability.set(binding.capability_id, list);
  }

  const capabilityIds = [...selectedProviderIdsByCapability.keys()].sort();

  for (const capabilityId of capabilityIds) {
    const selectedProviderIds = selectedProviderIdsByCapability.get(capabilityId)!;

    if (selectedProviderIds.length > 1) {
      findings.push({
        code: "AMBIGUOUS_CAPABILITY_BINDING",
        fatal: false,
        capability_id: capabilityId,
        message:
          `AMBIGUOUS_CAPABILITY_BINDING: capability '${capabilityId}' has ${selectedProviderIds.length} ` +
          `selected provider bindings (${[...selectedProviderIds].sort().join(", ")}); exactly one is required.`,
      });
      continue;
    }

    const selectedProviderId = selectedProviderIds[0];
    if (!knownProviderIds.has(selectedProviderId)) {
      findings.push({
        code: "UNKNOWN_PROVIDER_REFERENCE",
        fatal: false,
        capability_id: capabilityId,
        provider_id: selectedProviderId,
        message:
          `REQUIRED_CAPABILITY_MISSING: capability '${capabilityId}' is bound to selected_provider_id ` +
          `'${selectedProviderId}', which is not a registered provider.`,
      });
    }
  }

  return findings;
}
