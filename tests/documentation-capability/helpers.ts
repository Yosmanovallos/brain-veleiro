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

export const DOC_CAP = "documentation.search";

export interface DocFixture {
  document_id: string;
  revision: string;
  title: string;
  text: string;
}

export const sampleCorpus = {
  corpus_id: "brain-docs",
  snapshot_id: "s14e-v1",
  documents: [
    {
      document_id: "alpha",
      revision: "v1",
      title: "Registry guide",
      text: "Explicit routing\nPermission denial",
    },
    {
      document_id: "beta",
      revision: "v2",
      title: "Registry",
      text: "Permission check\nExplicit steps",
    },
    {
      document_id: "gamma",
      revision: "v1",
      title: "Routing details",
      text: "Explicit details\nDenial of permission",
    },
  ],
};

export function request(input: Record<string, unknown>, timeout_ms = 10000, call_id = "call-1"): any {
  return {
    run_id: "doc-exercise",
    call_id,
    turn: 1,
    capability_id: DOC_CAP,
    input,
    timeout_ms,
  };
}

export function output(result: ToolInvocationResult): any {
  expect(result.status).toBe("SUCCESS");
  if (result.status !== "SUCCESS") throw new Error("Expected a successful documentation search");
  return result.output;
}

export function registry(provider: CapabilityProvider, provider_id = "in-memory-docs"): CapabilityRegistryProvider {
  return new CapabilityRegistryProvider({
    providers: [{ provider_id, provider }],
    bindings: [{ capability_id: DOC_CAP, selected_provider_id: provider_id }],
  });
}

export function restricted(
  provider: CapabilityProvider,
  ids: string[] = [DOC_CAP],
  sideEffects: ToolSideEffectClass[] = ["NONE"],
): RestrictedCapabilityProvider {
  return new RestrictedCapabilityProvider(registry(provider), new Set(ids), new Set(sideEffects));
}

export const definition: AgentDefinition = {
  id: "doc-searcher",
  role: "searcher",
  objective: "Search offline documentation and return the result.",
  model_policy: { routing_class: "BALANCED", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 1000, max_items: 5, allowed_sources: ["CURRENT_TASK"], require_source_refs: false },
  state_schema: { type: "object" },
  tools: [DOC_CAP],
  skills: [],
  capabilities: [DOC_CAP],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 15000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" },
  rubric: { quality_contract_ref: "brain-bootstrap/quality-contracts/S14E_DOCUMENTATION_SEARCH_DEEP.yaml" },
  evals: [],
};

export async function agentExec(provider: CapabilityProvider, input: Record<string, unknown>, providerId = "in-memory-docs") {
  const model: ModelProvider = {
    async decide(r) {
      const observation = r.state.prior_observations.at(-1);
      if (!observation) {
        return {
          status: "SUCCESS",
          decision: {
            type: "TOOL_CALL",
            rationale: "Run the permitted documentation search.",
            tool_call: { call_id: "search", capability_id: DOC_CAP, input },
          },
        };
      }
      return {
        status: "SUCCESS",
        decision: {
          type: "FINISH",
          rationale: "Return the observation.",
          output: { summary: "Searched.", data: observation.output, evidence_refs: observation.evidence_refs },
        },
      };
    },
  };
  const compiled = compileAgentDefinition(definition, { model_provider: model, capability_provider: registry(provider, providerId) });
  expect(compiled.run_options.capabilityProvider).toBeInstanceOf(RestrictedCapabilityProvider);
  return runAgent(compiled.run_options);
}
