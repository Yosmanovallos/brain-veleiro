import type { AgentDefinition } from "../../core/agent/index.js";
import {
  REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
  REQUIREMENTS_DISCOVERY_SKILL_ID,
} from "../requirements-discovery/requirementsDiscoverySkill.js";

/**
 * Brain — S13A real requirements-discoverer AgentDefinition.
 *
 * Defined in brain-bootstrap/specs/REQUIREMENTS_DISCOVERY_AGENT_v1.md
 * sections 3, 4, 6, 9 (ChatGPT-authored, integrated verbatim). This is a new,
 * minimal AgentDefinition — it does NOT reuse or expand `researcher-v1`
 * (REQUIREMENTS_DISCOVERY_AGENT_v1.md section 2): requirements discovery is
 * semantically distinct from evidence-gathering research, and S13A requires
 * zero capabilities, unlike the Researcher's `research.lookup`.
 *
 * This is the BASE definition (fixed objective, no task-specific raw request
 * yet). A task-specific instance for a concrete client request is produced by
 * materializeRequirementsDiscoveryTask() / materializeBaselineRequirementsDiscoveryTask()
 * in ../requirements-discovery/materializeRequirementsDiscoveryTask.js.
 */

export const requirementsDiscovererDefinition: AgentDefinition = {
  id: "requirements-discoverer-v1",

  role: "requirements-discoverer",

  objective:
    "Convert the current ambiguous client request into a structured requirements discovery result using the " +
    "selected Requirements Discovery Skill, while preserving unknowns and assumptions instead of inventing " +
    "missing requirements.",

  model_policy: {
    routing_class: "BALANCED",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 6000,
    max_items: 25,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF"],
    require_source_refs: true,
  },

  // REQUIREMENTS_DISCOVERY_AGENT_v1.md section 6 — role-specific working
  // state; no Core logic depends on these property names.
  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      raw_request_present: { type: "boolean" },
      selected_skill_id: { type: "string" },
      discovery_complete: { type: "boolean" },
    },
  },

  // Section 4 — S13A requires no capability/tool: the raw client request is
  // already current-task input, not an external atomic operation.
  tools: [],

  skills: [REQUIREMENTS_DISCOVERY_SKILL_ID],

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
    max_turns: 6,
    timeout_ms: 10000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "S13A uses canonical S09 terminal semantics.",
  },

  // Section 9 — exact minimum required output_schema. Nested per-item
  // invariants (unique IDs, origin/rationale/source_excerpt conditionals,
  // acceptance linkage, handoff/blocker consistency) are not expressible in
  // this untyped JsonSchemaLike bag and are enforced deterministically by
  // validateRequirementsDiscoveryResult() instead, mirroring S11's approach.
  output_schema: {
    type: "object",
    required: [
      "request",
      "goals",
      "users",
      "unknowns",
      "assumptions",
      "constraints",
      "acceptance_criteria",
      "handoff",
    ],
    properties: {
      request: { type: "string" },
      goals: { type: "array" },
      users: { type: "array" },
      unknowns: { type: "array" },
      assumptions: { type: "array" },
      constraints: { type: "array" },
      acceptance_criteria: { type: "array" },
      handoff: { type: "object" },
    },
    additionalProperties: false,
  },

  rubric: {
    quality_contract_ref: REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
  },

  evals: [
    "evals/s13a/requirements-discovery-positive",
    "evals/s13a/requirements-discovery-negative",
    "evals/s13a/skill-vs-baseline",
  ],
};
