import type { AgentEngineeringInput, AvailableAgentDescriptor } from "./types.js";

/**
 * Deterministic existing-Agent reuse selector.
 *
 * Implements brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md section 3
 * and brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md section 11. Called
 * only after the necessity classifier has returned AGENT_REQUIRED. It reads
 * ONLY `input.available_agents` (bounded, explicit descriptors) and
 * `input.available_capabilities` — it never infers task-kind support or
 * capability compatibility from an Agent id or role name (AE-R6, AE-R7), and
 * never reads a fixture-truth object (AE-R26).
 *
 * A supplied existing Agent is reusable only if ALL of:
 *   - the descriptor explicitly lists the work-unit task_kind;
 *   - its tools/capabilities include every required capability ID;
 *   - it does not require a capability ID unavailable to the current work unit;
 *   - its allowed side-effect classes fit within the work-unit allowed set;
 *   - its memory behavior is not broader than the work unit allows
 *     (commit_verified_memory must be false; cross-run retrieval/history is
 *     only acceptable when the work unit declares requires_cross_run_history,
 *     and durable-memory promotion must not exceed EXPLICIT_VERIFIED_ONLY);
 *   - its output/rubric contract is explicitly compatible per the descriptor
 *     (compatible_quality_contract_refs includes the work-unit ref).
 *
 * Tie-break when several qualify: fewer capabilities, then fewer allowed
 * side-effect classes, then deterministic Agent-id order.
 */

function isMemoryNotBroaderThanAllowed(descriptor: AvailableAgentDescriptor, requiresCrossRunHistory: boolean): boolean {
  const mem = descriptor.definition.memory_policy;
  if (mem.commit_verified_memory !== false) return false;
  if (mem.promotion_policy !== "DISABLED" && mem.promotion_policy !== "EXPLICIT_VERIFIED_ONLY") return false;
  if (requiresCrossRunHistory) return true;
  // Work unit does not need cross-run history: the reused Agent must not
  // retrieve durable memory or search history either.
  return mem.retrieve === false && mem.search_history === false;
}

export function isReusableAgentCompatible(descriptor: AvailableAgentDescriptor, input: AgentEngineeringInput): boolean {
  const wu = input.work_unit;
  const def = descriptor.definition;

  if (!descriptor.supported_task_kinds.includes(wu.task_kind)) return false;

  const agentCapabilities = new Set(def.capabilities);
  for (const requiredId of wu.required_capability_ids) {
    if (!agentCapabilities.has(requiredId)) return false;
  }

  const availableIds = new Set(input.available_capabilities.map((c) => c.id));
  for (const capId of def.capabilities) {
    if (!availableIds.has(capId)) return false;
  }

  const allowedSideEffects = new Set(wu.allowed_side_effect_classes);
  for (const effect of def.permissions.allowed_side_effects) {
    if (!allowedSideEffects.has(effect)) return false;
  }

  if (!isMemoryNotBroaderThanAllowed(descriptor, wu.behavior.requires_cross_run_history)) return false;

  if (!descriptor.compatible_quality_contract_refs.includes(wu.quality_contract_ref)) return false;

  return true;
}

export interface ReusableAgentSelection {
  reuse_agent_id: string | null;
  candidates: string[];
  rationale: string;
}

export function selectReusableAgent(input: AgentEngineeringInput): ReusableAgentSelection {
  const compatible = input.available_agents
    .filter((descriptor) => isReusableAgentCompatible(descriptor, input))
    .sort((a, b) => {
      const capDelta = a.definition.capabilities.length - b.definition.capabilities.length;
      if (capDelta !== 0) return capDelta;
      const seDelta = a.definition.permissions.allowed_side_effects.length - b.definition.permissions.allowed_side_effects.length;
      if (seDelta !== 0) return seDelta;
      return a.definition.id.localeCompare(b.definition.id);
    });

  const candidates = compatible.map((d) => d.definition.id);

  if (compatible.length === 0) {
    return {
      reuse_agent_id: null,
      candidates,
      rationale:
        "No supplied existing Agent descriptor explicitly covers the work-unit task kind while also satisfying every " +
        "required capability, the allowed side-effect classes, the memory bound, and quality-contract compatibility.",
    };
  }

  const chosen = compatible[0];
  return {
    reuse_agent_id: chosen.definition.id,
    candidates,
    rationale:
      `Existing Agent '${chosen.definition.id}' explicitly supports task kind '${input.work_unit.task_kind}', already ` +
      "holds every required capability, stays within the allowed side-effect classes and memory bound, and is declared " +
      "quality-contract compatible — reuse is preferred over designing a duplicate Agent (AE-R6).",
  };
}
