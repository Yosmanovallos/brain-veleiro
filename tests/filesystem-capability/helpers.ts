import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { expect } from "vitest";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import { RestrictedCapabilityProvider, compileAgentDefinition, runAgent, type AgentDefinition, type CapabilityProvider, type ModelProvider, type ToolInvocationResult } from "../../src/core/agent/index.js";

export const sha = (content: string | Buffer) => createHash("sha256").update(content).digest("hex");
export const request = (capability_id: string, input: Record<string, unknown>, timeout_ms = 10000) => ({ run_id: "filesystem-exercise", call_id: "operation", turn: 1, capability_id, input, timeout_ms });
export function output(result: ToolInvocationResult) {
  expect(result.status).toBe("SUCCESS");
  if (result.status !== "SUCCESS") throw new Error("Expected successful filesystem operation");
  return result.output;
}
export function registry(provider: CapabilityProvider, provider_id = "workspace") {
  return new CapabilityRegistryProvider({ providers: [{ provider_id, provider }], bindings: ["filesystem.read", "filesystem.list", "filesystem.write"].map(capability_id => ({ capability_id, selected_provider_id: provider_id })) });
}
export function restricted(provider: CapabilityProvider, ids = ["filesystem.read", "filesystem.list", "filesystem.write"], local = false) {
  return new RestrictedCapabilityProvider(registry(provider), new Set(ids), new Set(local ? ["NONE", "LOCAL"] : ["NONE"]));
}
export async function sandbox<T>(exercise: (root: string) => Promise<T>): Promise<T> {
  const root = await fs.mkdtemp(join(tmpdir(), "brain-s14b-"));
  const rel = relative(process.cwd(), root);
  expect(isAbsolute(rel) || rel === ".." || rel.startsWith("../")).toBe(true);
  try { return await exercise(root); }
  finally {
    await fs.rm(root, { recursive: true, force: true });
    await expect(fs.lstat(root)).rejects.toMatchObject({ code: "ENOENT" });
  }
}
export const definition: AgentDefinition = {
  id: "filesystem-reader", role: "reader", objective: "Read the permitted text and return its observation.",
  model_policy: { routing_class: "BALANCED", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 1000, max_items: 5, allowed_sources: ["CURRENT_TASK"], require_source_refs: false },
  state_schema: { type: "object" }, tools: ["filesystem.read"], skills: [], capabilities: ["filesystem.read"],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true }, delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 10000 }, termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" }, rubric: { quality_contract_ref: "brain-bootstrap/quality-contracts/S14B_FILESYSTEM_DEEP.yaml" }, evals: [],
};
export async function agentRead(provider: CapabilityProvider, providerId = "workspace") {
  const model: ModelProvider = { async decide(r) {
    const observation = r.state.prior_observations.at(-1);
    if (!observation) return { status: "SUCCESS", decision: { type: "TOOL_CALL", rationale: "Read permitted text.", tool_call: { call_id: "read", capability_id: "filesystem.read", input: { path: "text.txt" } } } };
    return { status: "SUCCESS", decision: { type: "FINISH", rationale: "Return actual observation.", output: { summary: "Read completed.", data: observation.output, evidence_refs: observation.evidence_refs } } };
  } };
  const compiled = compileAgentDefinition(definition, { model_provider: model, capability_provider: registry(provider, providerId) });
  expect(compiled.run_options.capabilityProvider).toBeInstanceOf(RestrictedCapabilityProvider);
  const result = await runAgent(compiled.run_options);
  expect(result.outcome).toBe("SUCCESS");
  expect(result.events.some(e => e.type === "TOOL_COMPLETED")).toBe(true);
  return result;
}
