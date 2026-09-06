import { expect } from "vitest";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import {
  RestrictedCapabilityProvider,
  compileAgentDefinition,
  runAgent,
  type AgentDefinition,
  type CapabilityProvider,
  type ModelProvider,
  type ToolInvocationResult,
  type ToolSideEffectClass,
} from "../../src/core/agent/index.js";

export const STATUS = "repository.status";
export const READ = "repository.read";

export const request = (capability_id: string, input: Record<string, unknown>, timeout_ms = 20000) => ({
  run_id: "git-exercise",
  call_id: "operation",
  turn: 1,
  capability_id,
  input,
  timeout_ms,
});

export function output(result: ToolInvocationResult): Record<string, unknown> {
  expect(result.status).toBe("SUCCESS");
  if (result.status !== "SUCCESS") throw new Error("Expected a successful repository observation");
  return result.output;
}

export function registry(
  provider: CapabilityProvider,
  provider_id = "workspace",
  ids: string[] = [STATUS, READ],
): CapabilityRegistryProvider {
  return new CapabilityRegistryProvider({
    providers: [{ provider_id, provider }],
    bindings: ids.map(capability_id => ({ capability_id, selected_provider_id: provider_id })),
  });
}

export function restricted(
  provider: CapabilityProvider,
  ids: string[] = [STATUS, READ],
  sideEffects: ToolSideEffectClass[] = ["NONE"],
  providerId = "workspace",
): RestrictedCapabilityProvider {
  return new RestrictedCapabilityProvider(registry(provider, providerId), new Set(ids), new Set(sideEffects));
}

/** Poll until `predicate()` is truthy, or fail after `deadlineMs`. */
export async function until<T>(predicate: () => T | undefined, deadlineMs = 5000): Promise<T> {
  const stop = Date.now() + deadlineMs;
  while (Date.now() < stop) {
    const value = predicate();
    if (value) return value;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error("condition not reached within deadline");
}

/** Poll until `pid` no longer exists (reaped), or fail after `deadlineMs`. */
export async function pidGone(pid: number, deadlineMs = 6000): Promise<boolean> {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try { process.kill(pid, 0); } catch { return true; }
    await new Promise(r => setTimeout(r, 25));
  }
  return false;
}

/** Read a PID marker file with a positive integer, polling until present. */
export async function readPidFile(path: string, deadlineMs = 6000): Promise<number> {
  const { readFileSync } = await import("node:fs");
  const stop = Date.now() + deadlineMs;
  while (Date.now() < stop) {
    try {
      const pid = Number(readFileSync(path, "utf8").trim());
      if (Number.isInteger(pid) && pid > 0) return pid;
    } catch { /* not written yet */ }
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error(`PID marker ${path} not written within deadline`);
}

/**
 * A byte-stable AgentDefinition used for the real runAgent path and the
 * provider/repository swap counterfactual. No repository / provider / root /
 * git / transport field appears (contract §36).
 */
export const definition: AgentDefinition = {
  id: "repository-observer",
  role: "observer",
  objective: "Observe the permitted repository and return the observation.",
  model_policy: { routing_class: "BALANCED", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 1000, max_items: 5, allowed_sources: ["CURRENT_TASK"], require_source_refs: false },
  state_schema: { type: "object" },
  tools: [STATUS, READ],
  skills: [],
  capabilities: [STATUS, READ],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 30000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" },
  rubric: { quality_contract_ref: "brain-bootstrap/quality-contracts/S14D_GIT_DEEP.yaml" },
  evals: [],
};

/**
 * Drive one capability through the real
 * RestrictedCapabilityProvider -> registry -> Git provider -> runAgent path.
 */
export async function agentExec(
  capabilityProvider: CapabilityProvider,
  capability_id: string,
  input: Record<string, unknown>,
) {
  const model: ModelProvider = {
    async decide(r) {
      const observation = r.state.prior_observations.at(-1);
      if (!observation) {
        return {
          status: "SUCCESS",
          decision: { type: "TOOL_CALL", rationale: "Observe the repository.", tool_call: { call_id: "obs", capability_id, input } },
        };
      }
      return {
        status: "SUCCESS",
        decision: {
          type: "FINISH",
          rationale: "Return the observation.",
          output: { summary: "Observed.", data: observation.output, evidence_refs: observation.evidence_refs },
        },
      };
    },
  };
  const compiled = compileAgentDefinition(definition, { model_provider: model, capability_provider: capabilityProvider });
  expect(compiled.run_options.capabilityProvider).toBeInstanceOf(RestrictedCapabilityProvider);
  return runAgent(compiled.run_options);
}
