import type { AgentDefinition } from "../../core/agent/index.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID } from "../research/researchSkill.js";
import { DEEP_RESEARCH_QUALITY_CONTRACT_REF, DEEP_RESEARCH_SKILL_ID } from "../deep-research/deepResearchSkill.js";

/**
 * Brain — S13C real deep-researcher-v1 AgentDefinition.
 *
 * Defined in brain-bootstrap/specs/DEEP_RESEARCH_AGENT_v1.md sections 2-3, 6
 * (ChatGPT-authored, integrated verbatim). This is a new, independent
 * AgentDefinition — it does NOT reuse or modify `researcher-v1`,
 * `knowledge-gap-analyzer-v1`, or `requirements-discoverer-v1`: S11 Researcher
 * is the foundational evidence-gathering role and stays unchanged; S13C adds
 * its own policy layer (S13B queue semantics, DEEP Quality Contract, bounded
 * batch, closure recommendation) as a distinct Intelligence role over the
 * identical generic S10/S09 runtime.
 *
 * This is the BASE definition (fixed objective, no task-specific input yet).
 * A task-specific instance for a concrete DeepResearchInput is produced by
 * materializeDeepResearchTask() / materializeBaselineDeepResearchTask() in
 * ../deep-research/materializeDeepResearchTask.js.
 *
 * Reuses `research.lookup` exactly (section 4) — no new capability, MCP, web
 * provider, registry, or vendor integration is introduced.
 */

export const deepResearcherDefinition: AgentDefinition = {
  id: "deep-researcher-v1",

  role: "deep-researcher",

  objective:
    "Research the highest-priority S13B NEEDS_RESEARCH items using bounded, authoritative evidence gathering, " +
    "independent cross-validation, contradiction analysis, S11 ResearchResult semantics, and traceable closure " +
    "recommendations without mutating upstream gap state.",

  model_policy: {
    routing_class: "QUALITY",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 10000,
    max_items: 50,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    require_source_refs: true,
  },

  // DEEP_RESEARCH_AGENT_v1.md does not spell out state_schema explicitly;
  // this is role-specific working state per AGENT_DEFINITION_v1.md — no Core
  // logic depends on these property names.
  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      queue_snapshot_count: { type: "number" },
      selected_item_count: { type: "number" },
      processed_item_count: { type: "number" },
      batch_status: { type: "string" },
      selected_skill_id: { type: "string" },
    },
  },

  // Section 4 — reuse the existing S11 capability exactly.
  tools: [RESEARCH_LOOKUP_CAPABILITY_ID],

  skills: [DEEP_RESEARCH_SKILL_ID],

  capabilities: [RESEARCH_LOOKUP_CAPABILITY_ID],

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
    max_turns: 18,
    timeout_ms: 20000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "S13C preserves canonical S09 terminal semantics.",
  },

  // Section 10 — minimum required output_schema, mirroring DeepResearchBatchResult.
  // Nested per-item invariants (S11 ResearchResult validity, traceability,
  // independence-group discipline, closure mapping) are enforced
  // deterministically by validateDeepResearchResult() instead, mirroring
  // S13A/S13B's approach.
  output_schema: {
    type: "object",
    required: [
      "source_request",
      "queue_snapshot",
      "selected_item_ids",
      "items",
      "deferred_item_ids",
      "batch_status",
      "decision_relevant_summary",
    ],
    properties: {
      source_request: { type: "string" },
      queue_snapshot: { type: "array" },
      selected_item_ids: { type: "array" },
      items: { type: "array" },
      deferred_item_ids: { type: "array" },
      batch_status: { type: "string" },
      decision_relevant_summary: { type: "string" },
    },
    additionalProperties: false,
  },

  rubric: {
    quality_contract_ref: DEEP_RESEARCH_QUALITY_CONTRACT_REF,
  },

  evals: ["evals/s13c/deep-research-positive", "evals/s13c/deep-research-negative", "evals/s13c/skill-vs-baseline"],
};
