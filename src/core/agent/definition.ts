import type { AgentRunLimits, JsonSchemaLike, ToolSideEffectClass } from "./types.js";

/**
 * Brain — AgentDefinition v1 contract.
 *
 * Defined in brain-bootstrap/specs/AGENT_DEFINITION_v1.md (ChatGPT-authored,
 * integrated verbatim). AgentDefinition is Intelligence-layer configuration:
 * it declares WHAT an Agent role is and is allowed to do, never a concrete
 * ModelProvider/CapabilityProvider/MemoryProvider implementation.
 *
 * These type declarations live alongside the Core Agent Runtime (./runtime.js)
 * because the generic validator/compiler in this module must consume them,
 * the same way ToolDescriptor/JsonSchemaLike are Core-adjacent shapes even
 * though concrete Tools live in src/providers/. Concrete AgentDefinition
 * VALUES (the actual researcher/builder/verifier configurations) are
 * Intelligence content and live under src/intelligence/, not here.
 */

export interface AgentModelPolicy {
  routing_class: "DEFAULT" | "ECONOMY" | "BALANCED" | "QUALITY";
  require_structured_decisions: true;
  allow_provider_substitution: boolean;
}

export type AgentContextSource =
  | "CURRENT_TASK"
  | "CURRENT_RUN"
  | "EXPLICIT_SPEC"
  | "VERIFIED_HANDOFF"
  | "ADR"
  | "COMPILED_KNOWLEDGE"
  | "DURABLE_MEMORY"
  | "HISTORICAL_SESSION";

export interface AgentContextPolicy {
  retrieval_mode: "BOUNDED";
  max_context_tokens: number;
  max_items: number;
  allowed_sources: AgentContextSource[];
  require_source_refs: boolean;
}

export interface AgentMemoryPolicy {
  retrieve: boolean;
  remember_candidate: boolean;
  commit_verified_memory: boolean;
  search_history: boolean;
  promotion_policy: "DISABLED" | "EXPLICIT_VERIFIED_ONLY";
}

export interface AgentPermissionPolicy {
  allowed_side_effects: ToolSideEffectClass[];
  deny_unlisted_capabilities: true;
}

export interface AgentDelegationPolicy {
  allowed: false;
}

export interface AgentTerminationPolicy {
  require_terminal_outcome: true;
  require_explanation: true;
  note?: string;
}

export interface AgentRubricReference {
  quality_contract_ref: string;
}

export interface AgentDefinition {
  id: string;
  role: string;
  objective: string;

  model_policy: AgentModelPolicy;
  context_policy: AgentContextPolicy;

  state_schema: JsonSchemaLike;

  tools: string[];
  skills: string[];
  capabilities: string[];

  memory_policy: AgentMemoryPolicy;
  permissions: AgentPermissionPolicy;
  delegation: AgentDelegationPolicy;

  limits: AgentRunLimits;
  termination: AgentTerminationPolicy;

  output_schema: JsonSchemaLike;

  rubric: AgentRubricReference;
  evals: string[];
}
