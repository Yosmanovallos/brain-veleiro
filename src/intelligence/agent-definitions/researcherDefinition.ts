import type { AgentDefinition } from "../../core/agent/index.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID, RESEARCH_QUALITY_CONTRACT_REF, RESEARCH_SKILL_ID } from "../research/researchSkill.js";

/**
 * Brain — S11 real Researcher AgentDefinition.
 *
 * Defined in brain-bootstrap/specs/RESEARCHER_AGENT_v1.md sections 5, 6, 8
 * (ChatGPT-authored, integrated verbatim). Unlike S10's `referenceResearcher`
 * (a deliberately minimal proof configuration sharing the trivial word_count
 * capability), this is the real S11 role: it requires the `research.lookup`
 * capability and the S11 Research Skill, and executes through the identical
 * S10 compileAgentDefinition() / S09 runAgent() path.
 *
 * This is the BASE definition (fixed objective, no question yet). A
 * task-specific instance for a concrete research question is produced by
 * materializeResearchTask() in ../research/materializeResearchTask.js.
 */

export const researcherDefinition: AgentDefinition = {
  id: "researcher-v1",

  role: "researcher",

  objective:
    "Answer the current research question using bounded evidence gathering, " +
    "Knowledge Gap Analysis, explicit claim-to-evidence traceability, " +
    "contradiction and unknown handling, and the applicable value-of-information stop rule.",

  model_policy: {
    routing_class: "QUALITY",
    require_structured_decisions: true,
    allow_provider_substitution: true,
  },

  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 8000,
    max_items: 40,
    allowed_sources: [
      "CURRENT_TASK",
      "CURRENT_RUN",
      "EXPLICIT_SPEC",
      "VERIFIED_HANDOFF",
      "ADR",
      "COMPILED_KNOWLEDGE",
      "DURABLE_MEMORY",
    ],
    require_source_refs: true,
  },

  // RESEARCHER_AGENT_v1.md section 6 — role-specific working state; no Core
  // logic depends on these property names.
  state_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      open_gap_ids: {
        type: "array",
        items: { type: "string" },
      },
      lookup_count: {
        type: "number",
      },
      evidence_refs_seen: {
        type: "array",
        items: { type: "string" },
      },
    },
  },

  tools: [RESEARCH_LOOKUP_CAPABILITY_ID],

  skills: [RESEARCH_SKILL_ID],

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
    max_turns: 12,
    timeout_ms: 15000,
  },

  termination: {
    require_terminal_outcome: true,
    require_explanation: true,
    note: "S11 Researcher uses canonical S09 terminal semantics.",
  },

  // RESEARCHER_AGENT_v1.md section 8 — exact output_schema. JsonSchemaLike is
  // an untyped Record<string, unknown> bag (S09 does not require a full JSON
  // Schema implementation), so the full nested requirements/enums from
  // section 7 are encoded here as data even though no Core validator
  // currently consumes them (output_schema validation against
  // StructuredAgentOutput.data was explicitly deferred by S10 and remains
  // deferred here; deterministic enforcement instead happens in
  // validateResearchResult()).
  output_schema: {
    type: "object",
    required: [
      "question",
      "subquestions",
      "findings",
      "contradictions",
      "unknowns",
      "research_status",
      "decision_relevant_summary",
    ],
    properties: {
      question: { type: "string" },
      subquestions: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "question", "gap_class", "why_it_matters", "decision_affected", "status"],
          properties: {
            id: { type: "string" },
            question: { type: "string" },
            gap_class: {
              type: "string",
              enum: ["DECISION_CRITICAL", "DECISION_RELEVANT", "CONTEXTUAL", "TRIVIA"],
            },
            why_it_matters: { type: "string" },
            decision_affected: { type: "string" },
            status: {
              type: "string",
              enum: [
                "OPEN",
                "RESOLVED_WITH_EVIDENCE",
                "RESOLVED_BY_AUTHORITY",
                "ACCEPTED_AS_ASSUMPTION",
                "DEFERRED_WITHOUT_DECISION_IMPACT",
                "BLOCKED",
              ],
            },
          },
        },
      },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "claim", "criticality", "epistemic_status", "evidence", "confidence", "limitations"],
          properties: {
            id: { type: "string" },
            claim: { type: "string" },
            criticality: { type: "string", enum: ["DECISION_CRITICAL", "DECISION_RELEVANT", "CONTEXTUAL"] },
            epistemic_status: { type: "string", enum: ["EVIDENCED", "INFERENCE", "UNCERTAIN"] },
            evidence: {
              type: "array",
              items: {
                type: "object",
                required: [
                  "evidence_ref",
                  "source_ref",
                  "source_title",
                  "source_type",
                  "authority",
                  "independence_group",
                  "observed_or_published_at",
                  "locator",
                  "relationship",
                ],
                properties: {
                  evidence_ref: { type: "string" },
                  source_ref: { type: "string" },
                  source_title: { type: "string" },
                  source_type: { type: "string", enum: ["PRIMARY", "SECONDARY", "DIRECT_OBSERVATION", "OTHER"] },
                  authority: { type: "string" },
                  independence_group: { type: "string" },
                  observed_or_published_at: { type: "string" },
                  locator: { type: "string" },
                  relationship: { type: "string", enum: ["SUPPORTS", "CONTRADICTS", "QUALIFIES"] },
                },
              },
            },
            confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
            limitations: { type: "array", items: { type: "string" } },
          },
        },
      },
      contradictions: {
        type: "array",
        items: {
          type: "object",
          required: ["topic", "claim_refs", "evidence_refs", "description", "resolution", "limitations"],
          properties: {
            topic: { type: "string" },
            claim_refs: { type: "array", items: { type: "string" } },
            evidence_refs: { type: "array", items: { type: "string" } },
            description: { type: "string" },
            resolution: { type: "string", enum: ["RESOLVED", "UNRESOLVED", "NOT_DECISION_RELEVANT"] },
            limitations: { type: "array", items: { type: "string" } },
          },
        },
      },
      unknowns: {
        type: "array",
        items: {
          type: "object",
          required: ["question", "gap_class", "reason_unresolved", "decision_impact", "revalidation_trigger"],
          properties: {
            question: { type: "string" },
            gap_class: { type: "string", enum: ["DECISION_CRITICAL", "DECISION_RELEVANT", "CONTEXTUAL"] },
            reason_unresolved: { type: "string" },
            decision_impact: { type: "string" },
            revalidation_trigger: { type: "string" },
          },
        },
      },
      research_status: {
        type: "object",
        required: [
          "state",
          "reason",
          "unresolved_decision_critical_gaps",
          "additional_research_expected_to_change_decision",
        ],
        properties: {
          state: { type: "string", enum: ["SATISFIED", "EXHAUSTED_WITH_UNCERTAINTY", "MORE_RESEARCH_NEEDED"] },
          reason: { type: "string" },
          unresolved_decision_critical_gaps: { type: "array", items: { type: "string" } },
          additional_research_expected_to_change_decision: { type: "boolean" },
        },
      },
      decision_relevant_summary: { type: "string" },
    },
    additionalProperties: false,
  },

  rubric: {
    quality_contract_ref: RESEARCH_QUALITY_CONTRACT_REF,
  },

  evals: [],
};
