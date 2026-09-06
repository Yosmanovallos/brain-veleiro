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

export const CAP = "shell.execute";

/** Poll until `pid` no longer exists (reaped), or fail after `deadlineMs`. */
export async function pidGone(pid: number, deadlineMs = 5000): Promise<boolean> {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try { process.kill(pid, 0); } catch { return true; }
    await new Promise(r => setTimeout(r, 25));
  }
  return false;
}

/** Poll until a PID marker file exists with a positive integer, then return it. */
export async function readPidFile(path: string, deadlineMs = 5000): Promise<number> {
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

export const request = (input: Record<string, unknown>, timeout_ms = 10000) => ({
  run_id: "shell-exercise",
  call_id: "operation",
  turn: 1,
  capability_id: CAP,
  input,
  timeout_ms,
});

export function output(result: ToolInvocationResult): Record<string, unknown> {
  expect(result.status).toBe("SUCCESS");
  if (result.status !== "SUCCESS") throw new Error("Expected a successful shell execution");
  return result.output;
}

export function registry(provider: CapabilityProvider, provider_id = "workspace"): CapabilityRegistryProvider {
  return new CapabilityRegistryProvider({
    providers: [{ provider_id, provider }],
    bindings: [{ capability_id: CAP, selected_provider_id: provider_id }],
  });
}

export function restricted(
  provider: CapabilityProvider,
  ids: string[] = [CAP],
  sideEffects: ToolSideEffectClass[] = ["NONE", "LOCAL"],
): RestrictedCapabilityProvider {
  return new RestrictedCapabilityProvider(registry(provider), new Set(ids), new Set(sideEffects));
}

export const definition: AgentDefinition = {
  id: "shell-runner",
  role: "runner",
  objective: "Run the permitted command profile and return its observation.",
  model_policy: { routing_class: "BALANCED", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 1000, max_items: 5, allowed_sources: ["CURRENT_TASK"], require_source_refs: false },
  state_schema: { type: "object" },
  tools: [CAP],
  skills: [],
  capabilities: [CAP],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE", "LOCAL"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 15000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" },
  rubric: { quality_contract_ref: "brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml" },
  evals: [],
};

export async function agentExec(
  provider: CapabilityProvider,
  input: { profile_id: string; cwd: string },
  providerId = "workspace",
) {
  const model: ModelProvider = {
    async decide(r) {
      const observation = r.state.prior_observations.at(-1);
      if (!observation) {
        return {
          status: "SUCCESS",
          decision: { type: "TOOL_CALL", rationale: "Run the permitted profile.", tool_call: { call_id: "exec", capability_id: CAP, input } },
        };
      }
      return {
        status: "SUCCESS",
        decision: { type: "FINISH", rationale: "Return the observation.", output: { summary: "Executed.", data: observation.output, evidence_refs: observation.evidence_refs } },
      };
    },
  };
  const compiled = compileAgentDefinition(definition, { model_provider: model, capability_provider: registry(provider, providerId) });
  expect(compiled.run_options.capabilityProvider).toBeInstanceOf(RestrictedCapabilityProvider);
  return runAgent(compiled.run_options);
}
