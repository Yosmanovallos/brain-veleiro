import type { AgentDefinition } from "../../core/agent/index.js";

/**
 * Illustrative S10 reference AgentDefinitions.
 *
 * Defined in brain-bootstrap/specs/AGENT_DEFINITION_v1.md section 28,
 * integrated verbatim (capability_id 'word_count' matches the actual
 * ReferenceCapabilityProvider from S09 — no substitution was required).
 *
 * These are deliberately minimal proof configurations, NOT the production
 * researcher/builder/verifier agents of later steps (S11+). They exist only
 * to prove that three distinct Agent roles can be expressed purely as
 * AgentDefinition configuration over one generic Core Agent Runtime.
 */

export const referenceResearcher: AgentDefinition = {
  id: "reference-researcher",

  role: "researcher",

  objective:
    "Inspect the provided input and produce a structured reference result using only permitted capabilities.",

  model_policy: {
    routing_class: "BALANCED",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 4000,
    max_items: 20,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "COMPILED_KNOWLEDGE"],
    require_source_refs: true,
  },

  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  tools: ["word_count"],

  skills: [],

  capabilities: ["word_count"],

  memory_policy: {
    retrieve: true,
    remember_candidate: true,
    commit_verified_memory: false,
    search_history: true,
    promotion_policy: "EXPLICIT_VERIFIED_ONLY",
  },

  permissions: {
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  delegation: {
    allowed: false,
  },

  limits: {
    max_turns: 6,
    timeout_ms: 5000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "Reference S10 configuration only.",
  },

  output_schema: {
    type: "object",
    additionalProperties: true,
  },

  rubric: {
    quality_contract_ref: "quality-contracts/reference-researcher",
  },

  evals: [],
};

export const referenceBuilder: AgentDefinition = {
  id: "reference-builder",

  role: "builder",

  objective:
    "Produce a structured reference result using only the capabilities permitted by this AgentDefinition.",

  model_policy: {
    routing_class: "BALANCED",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 6000,
    max_items: 30,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    require_source_refs: true,
  },

  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  tools: ["word_count"],

  skills: [],

  capabilities: ["word_count"],

  memory_policy: {
    retrieve: true,
    remember_candidate: true,
    commit_verified_memory: false,
    search_history: true,
    promotion_policy: "EXPLICIT_VERIFIED_ONLY",
  },

  permissions: {
    allowed_side_effects: ["NONE", "LOCAL"],
    deny_unlisted_capabilities: true,
  },

  delegation: {
    allowed: false,
  },

  limits: {
    max_turns: 8,
    timeout_ms: 7000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "Reference S10 configuration only.",
  },

  output_schema: {
    type: "object",
    additionalProperties: true,
  },

  rubric: {
    quality_contract_ref: "quality-contracts/reference-builder",
  },

  evals: [],
};

export const referenceVerifier: AgentDefinition = {
  id: "reference-verifier",

  role: "verifier",

  objective:
    "Evaluate the provided reference input and return a structured result without invoking unpermitted capabilities.",

  model_policy: {
    routing_class: "QUALITY",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 5000,
    max_items: 25,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR"],
    require_source_refs: true,
  },

  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },

  tools: ["word_count"],

  skills: [],

  capabilities: ["word_count"],

  memory_policy: {
    retrieve: true,
    remember_candidate: false,
    commit_verified_memory: false,
    search_history: true,
    promotion_policy: "DISABLED",
  },

  permissions: {
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  delegation: {
    allowed: false,
  },

  limits: {
    max_turns: 5,
    timeout_ms: 5000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "Reference S10 configuration only.",
  },

  output_schema: {
    type: "object",
    additionalProperties: true,
  },

  rubric: {
    quality_contract_ref: "quality-contracts/reference-verifier",
  },

  evals: [],
};
