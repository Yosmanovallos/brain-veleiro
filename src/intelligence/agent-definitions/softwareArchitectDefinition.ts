import type { AgentDefinition } from "../../core/agent/index.js";
import { SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF, SOFTWARE_ARCHITECTURE_SKILL_ID } from "../software-architecture/softwareArchitectureSkill.js";

/**
 * Brain — S13D real software-architect-v1 AgentDefinition.
 *
 * Defined in brain-bootstrap/specs/SOFTWARE_ARCHITECTURE_AGENT_v1.md sections
 * 2-3, 6 (ChatGPT-authored, integrated verbatim). This is a new, independent
 * AgentDefinition — it does NOT reuse or modify `requirements-discoverer-v1`,
 * `knowledge-gap-analyzer-v1`, `researcher-v1`, or `deep-researcher-v1`: S13D
 * is a distinct Intelligence responsibility (architecture synthesis and
 * decision comparison), not requirements discovery, gap classification, or
 * research. All roles continue to use the same generic S10/S09 runtime.
 *
 * This is the BASE definition (fixed objective, no task-specific input yet).
 * A task-specific instance for a concrete SoftwareArchitectureInput is
 * produced by materializeSoftwareArchitectureTask() /
 * materializeBaselineSoftwareArchitectureTask() in
 * ../software-architecture/materializeSoftwareArchitectureTask.js.
 *
 * Zero capabilities/tools (section 4) — S13D never calls research.lookup or
 * any capability; missing evidence is surfaced explicitly (NEEDS_MORE_EVIDENCE
 * or BLOCKED) rather than silently researched.
 */

export const softwareArchitectDefinition: AgentDefinition = {
  id: "software-architect-v1",

  role: "software-architect",

  objective:
    "Compare viable software-architecture alternatives across decision drivers, hard constraints, trade-offs, " +
    "failure modes, cost, operations, security, and reversibility, then produce an evidence-traceable proposed " +
    "ADR for human approval without mutating upstream knowledge or research state.",

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

  // Agent spec section 22 — canonical semantic state fields.
  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      selected_skill_id: { type: "string" },
      alternative_count: { type: "number" },
      hard_constraint_count: { type: "number" },
      decision_status: { type: "string" },
      adr_rendered: { type: "boolean" },
    },
  },

  // Section 4 — zero capabilities/tools.
  tools: [],

  skills: [SOFTWARE_ARCHITECTURE_SKILL_ID],

  capabilities: [],

  memory_policy: {
    retrieve: true,
    remember_candidate: true,
    commit_verified_memory: false,
    search_history: false,
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
    max_turns: 12,
    timeout_ms: 15000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "S13D uses canonical S09 terminal semantics.",
  },

  // Minimum required output_schema, mirroring SoftwareArchitectureDecisionResult
  // (Skill file section 17). Nested per-alternative/per-driver invariants (hard
  // constraint coverage, no hard-FAIL recommendation, canonical dimension
  // coverage, ADR PROPOSED/approval_required semantics) are enforced
  // deterministically by validateSoftwareArchitectureResult() instead,
  // mirroring S13A/S13B/S13C's approach.
  output_schema: {
    type: "object",
    required: [
      "architecture_question",
      "decision_status",
      "decision_drivers",
      "alternatives",
      "recommended_alternative_id",
      "recommendation_summary",
      "rejected_alternative_reasons",
      "unresolved_decision_gaps",
      "adr",
      "adr_markdown",
    ],
    properties: {
      architecture_question: { type: "string" },
      decision_status: { type: "string" },
      decision_drivers: { type: "array" },
      alternatives: { type: "array" },
      recommended_alternative_id: {},
      recommendation_summary: { type: "string" },
      rejected_alternative_reasons: { type: "array" },
      unresolved_decision_gaps: { type: "array" },
      adr: { type: "object" },
      adr_markdown: { type: "string" },
    },
    additionalProperties: false,
  },

  rubric: {
    quality_contract_ref: SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF,
  },

  evals: ["evals/s13d/software-architecture-positive", "evals/s13d/software-architecture-negative", "evals/s13d/skill-vs-baseline"],
};
