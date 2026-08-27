import type { ExecutionLimits, TaskCompilationInput } from "./types.js";

/**
 * Brain — S13G limits materialization.
 *
 * Implements brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md section 9
 * and the Skill file "Limits". `ExecutionPackage.limits` is derived ONLY from
 * `AgentDefinition.limits` plus the supplied Context Pack `budget` — no
 * defaulted, invented, or enlarged value (no deadline, retry count, cost
 * ceiling, or token/quota not already present in the input).
 */
export function materializeExecutionLimits(input: TaskCompilationInput): ExecutionLimits {
  return {
    max_turns: input.agent_definition.limits.max_turns,
    timeout_ms: input.agent_definition.limits.timeout_ms,
    context_budget: structuredClone(input.context_pack.budget),
  };
}
