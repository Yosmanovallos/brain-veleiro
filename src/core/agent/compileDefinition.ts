import type { AgentDefinition } from "./definition.js";
import { validateAgentDefinition } from "./validateDefinition.js";
import { RestrictedCapabilityProvider } from "./restrictedCapabilityProvider.js";
import type { CapabilityProvider, ModelProvider } from "./types.js";
import type { RunAgentOptions } from "./runtime.js";

/**
 * Generic AgentDefinition -> S09 RunAgentOptions compilation boundary.
 *
 * Implements brain-bootstrap/specs/AGENT_DEFINITION_v1.md sections 21-26.
 *
 * This function MUST NOT branch on `definition.role`. Every AgentDefinition,
 * regardless of role, is compiled through this exact same code path.
 */

export interface AgentRuntimeDependencies {
  model_provider: ModelProvider;
  capability_provider: CapabilityProvider;
}

export interface CompiledAgentExecution {
  definition: AgentDefinition;
  run_options: RunAgentOptions;
}

export function compileAgentDefinition(
  definition: AgentDefinition,
  dependencies: AgentRuntimeDependencies,
): CompiledAgentExecution {
  const validation = validateAgentDefinition(definition);
  if (!validation.valid) {
    throw new Error(`Invalid AgentDefinition '${definition?.id ?? "<unknown>"}': ${validation.errors.join("; ")}`);
  }

  const allowedCapabilityIds = new Set(definition.capabilities);
  const allowedSideEffects = new Set(definition.permissions.allowed_side_effects);

  const restrictedCapabilityProvider = new RestrictedCapabilityProvider(
    dependencies.capability_provider,
    allowedCapabilityIds,
    allowedSideEffects,
  );

  const run_options: RunAgentOptions = {
    modelProvider: dependencies.model_provider,
    capabilityProvider: restrictedCapabilityProvider,
    goal: definition.objective,
    limits: definition.limits,
  };

  return { definition, run_options };
}

/**
 * Verifies that every capability an AgentDefinition allows actually exists
 * on the injected CapabilityProvider, before compilation is trusted.
 *
 * Kept separate from compileAgentDefinition (which stays synchronous, per
 * the contract's conceptual signature) since capability discovery is async.
 */
export async function assertCapabilitiesExist(
  definition: AgentDefinition,
  capabilityProvider: CapabilityProvider,
): Promise<void> {
  const descriptors = await capabilityProvider.list_capabilities();
  const availableIds = new Set(descriptors.map((d) => d.capability_id));
  const missing = definition.capabilities.filter((id) => !availableIds.has(id));
  if (missing.length > 0) {
    throw new Error(
      `AgentDefinition '${definition.id}' allows capabilities not exposed by the injected CapabilityProvider: ${missing.join(", ")}`,
    );
  }
}
