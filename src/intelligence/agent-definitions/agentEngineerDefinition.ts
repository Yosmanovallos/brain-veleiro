import type { AgentDefinition } from "../../core/agent/index.js";
import { AGENT_ENGINEERING_QUALITY_CONTRACT_REF, AGENT_ENGINEERING_SKILL_ID } from "../agent-engineering/agentEngineeringSkill.js";

/**
 * Brain — S13E real agent-engineer-v1 AgentDefinition.
 *
 * Assembled from brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md section
 * 25 (base semantic definition), section 26 (state_schema), and section 22 /
 * AGENT_ENGINEERING_SKILL_S13E.md section 22 (AgentEngineeringResult, the
 * output_schema semantics) — ChatGPT-authored, integrated verbatim. This is a
 * new, independent AgentDefinition: it does NOT reuse or modify
 * `requirements-discoverer-v1`, `knowledge-gap-analyzer-v1`, `researcher-v1`,
 * `deep-researcher-v1`, or `software-architect-v1` (Agent spec section 2).
 * All roles continue to use the same generic S12 -> S10 -> S09 runtime.
 *
 * This is the BASE definition (fixed objective, no task-specific input yet).
 * A task-specific instance for a concrete AgentEngineeringInput is produced by
 * materializeAgentEngineeringTask() / materializeBaselineAgentEngineeringTask()
 * in ../agent-engineering/materializeAgentEngineeringTask.js.
 *
 * Zero capabilities/tools (Agent spec section 3) — agent-engineer-v1 analyses
 * bounded design metadata and NEVER invokes the capabilities it is designing.
 * `candidate Agent declared capability != agent-engineer-v1 runtime capability`.
 */
export const agentEngineerDefinition: AgentDefinition = {
  id: "agent-engineer-v1",

  role: "agent-engineer",

  objective:
    "Decide whether a bounded work unit genuinely requires an Agent and, only when justified, recommend reuse of " +
    "an explicitly supplied compatible Agent or design a least-privilege proposed S10 AgentDefinition for human approval.",

  model_policy: {
    routing_class: "QUALITY",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 9000,
    max_items: 40,
    allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    require_source_refs: true,
  },

  // Agent spec section 26 — canonical semantic state fields. Core must not
  // inspect these role-specific property names.
  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      selected_skill_id: { type: "string" },
      necessity_decided: { type: "boolean" },
      agent_required: { type: "boolean" },
      design_complete: { type: "boolean" },
    },
  },

  // Agent spec section 3 — zero capabilities/tools.
  tools: [],

  skills: [AGENT_ENGINEERING_SKILL_ID],

  capabilities: [],

  // Agent spec section 4 — design must be traceable to the explicit current
  // work-unit input; historical memory must not silently cause capability or
  // autonomy grants.
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
    max_turns: 10,
    timeout_ms: 15000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "S13E uses canonical S09 terminal semantics.",
  },

  // Minimum required output_schema, mirroring AgentEngineeringResult (Skill
  // file section 22). Nested per-field invariants (need_decision internal
  // consistency, DESIGN_NEW candidate S10 validity, tools==capabilities
  // subset-of-available, least privilege, memory/termination/eval policy,
  // PROPOSED/approval_required semantics) are enforced deterministically by
  // validateAgentEngineeringResult() instead, mirroring S13A/S13B/S13C/S13D.
  output_schema: {
    type: "object",
    required: [
      "work_unit_id",
      "proposal_status",
      "approval_required",
      "need_decision",
      "design",
      "reuse_agent_id",
      "non_agent_recommendation",
      "warnings",
      "approval_note",
    ],
    properties: {
      work_unit_id: { type: "string" },
      proposal_status: { type: "string" },
      approval_required: { type: "boolean" },
      need_decision: { type: "object" },
      design: {},
      reuse_agent_id: {},
      non_agent_recommendation: {},
      warnings: { type: "array" },
      approval_note: { type: "string" },
    },
    additionalProperties: false,
  },

  rubric: {
    quality_contract_ref: AGENT_ENGINEERING_QUALITY_CONTRACT_REF,
  },

  evals: [
    "evals/s13e/agent-required-positive",
    "evals/s13e/no-agent-negative",
    "evals/s13e/reuse-existing",
    "evals/s13e/skill-only",
    "evals/s13e/skill-vs-baseline",
  ],
};
