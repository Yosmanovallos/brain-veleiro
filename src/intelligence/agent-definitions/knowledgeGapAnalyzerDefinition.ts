import type { AgentDefinition } from "../../core/agent/index.js";
import {
  KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
  KNOWLEDGE_GAP_ANALYSIS_SKILL_ID,
} from "../knowledge-gap-analysis/knowledgeGapAnalysisSkill.js";

/**
 * Brain — S13B real knowledge-gap-analyzer AgentDefinition.
 *
 * Defined in brain-bootstrap/specs/KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md
 * sections 2, 3, 6, 7, 17 (ChatGPT-authored, integrated verbatim). This is a
 * new, minimal AgentDefinition — it does NOT reuse or expand
 * `requirements-discoverer-v1` or `researcher-v1`: each Intelligence role
 * (discovery, evidence-gathering research, epistemic classification) is
 * configuration over the same generic S10/S09 runtime, not a shared identity.
 *
 * This is the BASE definition (fixed objective, no task-specific input yet).
 * A task-specific instance for a concrete KnowledgeGapAnalysisInput is
 * produced by materializeKnowledgeGapAnalysisTask() /
 * materializeBaselineKnowledgeGapAnalysisTask() in
 * ../knowledge-gap-analysis/materializeKnowledgeGapAnalysisTask.js.
 */

export const knowledgeGapAnalyzerDefinition: AgentDefinition = {
  id: "knowledge-gap-analyzer-v1",

  role: "knowledge-gap-analyzer",

  objective:
    "Classify the current requirements-discovery knowledge into known, told, proven, assumed, needs-research, " +
    "and unknowable while preserving canonical decision impact, justified closure state, traceability, and a " +
    "bounded handoff to deep research.",

  model_policy: {
    routing_class: "BALANCED",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 7000,
    max_items: 35,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR"],
    require_source_refs: true,
  },

  // KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md section 7 — role-specific working
  // state; no Core logic depends on these property names.
  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      normalized_item_count: { type: "number" },
      classified_item_count: { type: "number" },
      research_queue_count: { type: "number" },
      selected_skill_id: { type: "string" },
    },
  },

  // Section 3 — S13B requires no capability/tool: PROVEN means evidence is
  // already present in bounded input/context, never gathered externally.
  tools: [],

  skills: [KNOWLEDGE_GAP_ANALYSIS_SKILL_ID],

  capabilities: [],

  memory_policy: {
    retrieve: false,
    remember_candidate: false,
    commit_verified_memory: false,
    search_history: false,
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
    max_turns: 7,
    timeout_ms: 12000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "S13B uses canonical S09 terminal semantics.",
  },

  // Section 17 — exact minimum required output_schema. Nested per-item
  // invariants (partition, evidence/authority sufficiency, closure-overclaim
  // rejection) are enforced deterministically by
  // validateKnowledgeGapAnalysisResult() instead, mirroring S13A's approach.
  output_schema: {
    type: "object",
    required: ["source_request", "items", "buckets", "research_queue", "handoff", "decision_readiness_summary"],
    properties: {
      source_request: { type: "string" },
      items: { type: "array" },
      buckets: { type: "object" },
      research_queue: { type: "array" },
      handoff: { type: "object" },
      decision_readiness_summary: { type: "string" },
    },
    additionalProperties: false,
  },

  rubric: {
    quality_contract_ref: KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
  },

  evals: ["evals/s13b/knowledge-gap-positive", "evals/s13b/knowledge-gap-negative", "evals/s13b/skill-vs-baseline"],
};
