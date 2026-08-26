import type { SkillDefinition } from "../../../core/skill/index.js";
import { requirementsDiscovererDefinition } from "../../agent-definitions/requirementsDiscovererDefinition.js";
import {
  REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
  REQUIREMENTS_DISCOVERY_SKILL_ID,
} from "../../requirements-discovery/requirementsDiscoverySkill.js";

/**
 * Typed Skill Contract v1 representation of the S13A Requirements Discovery
 * Skill.
 *
 * Defined in brain-bootstrap/skills/REQUIREMENTS_DISCOVERY_SKILL_S13A.md
 * (ChatGPT-authored, integrated verbatim). The canonical semantic source of
 * truth remains that Markdown artifact — this file is a *runtime
 * representation* of it, mirroring src/intelligence/skills/definitions/
 * researchEvidenceGroundedS11.ts. It does not weaken or reinterpret any
 * RD-R, RD-P, or RD-V rule.
 *
 * `outputs[0].schema` and `requires.context_sources` are reused directly from
 * src/intelligence/agent-definitions/requirementsDiscovererDefinition.ts (the
 * S13A AgentDefinition) so the two stay in sync, exactly as S12's Research
 * Skill migration did for S11.
 *
 * S13A/S13B boundary (REQUIREMENTS_DISCOVERY_SKILL_S13A.md section 2): this
 * Skill's rules/procedure describe `unknowns.impact` (HIGH/MEDIUM/LOW) and
 * `blocking` (boolean) only — it never defines the S13B classification
 * vocabulary (known/told/proven/assumed/needs-research/unknowable) as an
 * output taxonomy of its own.
 */
export const requirementsDiscoveryS13A: SkillDefinition = {
  id: REQUIREMENTS_DISCOVERY_SKILL_ID,
  version: "1.0.0",

  description:
    "Convert an ambiguous client request into explicit goals, users, unknowns, assumptions, constraints, and " +
    "testable acceptance criteria without silently inventing missing facts.",

  applies_when: {
    task_kinds: ["requirements", "product-discovery", "project-intake"],
    signals: [
      "ambiguous request",
      "unclear requirements",
      "goals",
      "users",
      "constraints",
      "acceptance criteria",
      "assumptions",
    ],
    exclusions: [
      "verbatim transcription",
      "pure translation",
      "requests that already provide a complete validated specification and ask only for implementation",
    ],
  },

  inputs: [
    {
      name: "raw_request",
      description: "The raw client or stakeholder request to analyze.",
      required: true,
      schema: { type: "string" },
    },
  ],

  outputs: [
    {
      name: "requirements_discovery",
      description:
        "Structured RequirementsDiscoveryResult for downstream planning and S13B gap analysis: " +
        "request/goals/users/unknowns/assumptions/constraints/acceptance_criteria/handoff.",
      required: true,
      schema: requirementsDiscovererDefinition.output_schema,
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: requirementsDiscovererDefinition.context_policy.allowed_sources,
    quality_contract_refs: [REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF],
  },

  rules: [
    {
      id: "RD-R1",
      level: "MUST",
      statement: "Distinguish what the client explicitly said from what the agent derived or assumed.",
    },
    {
      id: "RD-R2",
      level: "MUST",
      statement:
        "Never invent a user, constraint, deadline, budget, integration, acceptance threshold, or business rule " +
        "merely to make the specification look complete.",
    },
    {
      id: "RD-R3",
      level: "MUST",
      statement:
        "Represent missing decision-relevant information as explicit unknowns instead of silently filling the gap.",
    },
    {
      id: "RD-R4",
      level: "MUST",
      statement:
        "Assumptions must be explicit, justified, risk-rated, and marked for validation when they could change " +
        "design or acceptance.",
    },
    {
      id: "RD-R5",
      level: "MUST",
      statement: "Every acceptance criterion must be observable or testable and must link to at least one goal.",
    },
    {
      id: "RD-R6",
      level: "MUST",
      statement:
        "Goals describe desired outcomes, not implementation details unless the client explicitly constrained " +
        "the implementation.",
    },
    {
      id: "RD-R7",
      level: "MUST",
      statement: "Constraints must preserve their origin and must not be promoted from a guess into an explicit client constraint.",
    },
    {
      id: "RD-R8",
      level: "MUST",
      statement:
        "Users must be represented only when explicitly stated or defensibly derived; derived users must be " +
        "marked DERIVED.",
    },
    {
      id: "RD-R9",
      level: "MUST",
      statement:
        "The output must remain bounded to the current request and relevant current-project context; do not load " +
        "unrelated historical or catalog content.",
    },
    {
      id: "RD-R10",
      level: "SHOULD",
      statement: "Prefer a smaller set of precise goals and acceptance criteria over a larger set of speculative requirements.",
    },
    {
      id: "RD-R11",
      level: "SHOULD",
      statement: "Preserve ambiguity when clarification would materially change scope, architecture, cost, risk, or acceptance.",
    },
    {
      id: "RD-R12",
      level: "MUST",
      statement:
        "Produce a downstream handoff that tells S13B whether deeper gap analysis is ready and which blockers " +
        "remain unresolved.",
    },
  ],

  procedure: [
    {
      id: "RD-P1",
      title: "Normalize the raw request",
      instruction:
        "Restate the request as a bounded problem statement without adding facts. Preserve the original intent " +
        "and identify any obvious ambiguity.",
      requires: ["raw_request"],
      produces: ["normalized_request"],
    },
    {
      id: "RD-P2",
      title: "Extract explicit statements",
      instruction:
        "Identify explicit goals, users, constraints, requested behaviors, and acceptance expectations directly " +
        "supported by the raw request.",
      requires: ["normalized_request"],
      produces: ["explicit_items"],
    },
    {
      id: "RD-P3",
      title: "Derive bounded goals",
      instruction:
        "Convert explicit intent into outcome-oriented goals. Derived goals must remain traceable to the request " +
        "and must not smuggle in implementation choices.",
      requires: ["explicit_items"],
      produces: ["goals"],
    },
    {
      id: "RD-P4",
      title: "Identify users",
      instruction:
        "Record explicit users first. Add only defensible derived user categories, clearly marked DERIVED and " +
        "accompanied by rationale.",
      requires: ["explicit_items"],
      produces: ["users"],
    },
    {
      id: "RD-P5",
      title: "Surface unknowns",
      instruction:
        "Identify missing information that could change scope, behavior, acceptance, architecture, cost, risk, " +
        "or sequencing. Mark whether each unknown is blocking.",
      requires: ["explicit_items", "goals"],
      produces: ["unknowns"],
    },
    {
      id: "RD-P6",
      title: "Make assumptions explicit",
      instruction:
        "Where progress requires a provisional interpretation, state it as an assumption, explain why it is " +
        "needed, rate its risk, and mark whether it must be validated before implementation.",
      requires: ["unknowns"],
      produces: ["assumptions"],
    },
    {
      id: "RD-P7",
      title: "Extract constraints",
      instruction: "Separate explicit constraints from defensible derived constraints. Preserve the constraint kind and origin.",
      requires: ["explicit_items"],
      produces: ["constraints"],
    },
    {
      id: "RD-P8",
      title: "Draft acceptance criteria",
      instruction:
        "Convert goals into observable or testable acceptance criteria. Each criterion must link to one or more " +
        "goal IDs and must not depend on an unmarked assumption.",
      requires: ["goals", "assumptions", "constraints"],
      produces: ["acceptance_criteria"],
    },
    {
      id: "RD-P9",
      title: "Validate internal consistency",
      instruction:
        "Check for contradictions among goals, users, assumptions, constraints, and acceptance criteria. If a " +
        "contradiction cannot be resolved from the request, convert it into an explicit unknown instead of " +
        "silently choosing a side.",
      requires: ["goals", "users", "unknowns", "assumptions", "constraints", "acceptance_criteria"],
      produces: ["validated_discovery"],
    },
    {
      id: "RD-P10",
      title: "Prepare S13B handoff",
      instruction:
        "Set ready_for_gap_analysis and unresolved_blockers. The handoff must preserve all explicit unknowns and " +
        "assumptions so S13B can perform deeper classification without rediscovering the original request from " +
        "scratch.",
      requires: ["validated_discovery"],
      produces: ["requirements_discovery"],
    },
  ],

  verification: [
    {
      id: "RD-V1",
      kind: "DETERMINISTIC",
      criterion: "The output contains all required RequirementsDiscoveryResult sections.",
      evidence_required: true,
    },
    {
      id: "RD-V2",
      kind: "DETERMINISTIC",
      criterion: "Every acceptance criterion links to at least one existing goal ID.",
      evidence_required: true,
    },
    {
      id: "RD-V3",
      kind: "DETERMINISTIC",
      criterion: "Every assumption contains rationale, risk, and must_validate.",
      evidence_required: true,
    },
    {
      id: "RD-V4",
      kind: "DETERMINISTIC",
      criterion: "No item marked EXPLICIT lacks a trace/reference to the raw request.",
      evidence_required: true,
    },
    {
      id: "RD-V5",
      kind: "DETERMINISTIC",
      criterion: "No unknown marked blocking is omitted from handoff.unresolved_blockers.",
      evidence_required: true,
    },
    {
      id: "RD-V6",
      kind: "DETERMINISTIC",
      criterion: "The Skill-assisted run scores better than the no-Skill baseline on the canonical S13A fixture metrics.",
      evidence_required: true,
    },
    {
      id: "RD-V7",
      kind: "SEMANTIC",
      criterion: "The discovery result preserves client intent without silently expanding scope.",
      evidence_required: true,
    },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: [
    "evals/s13a/requirements-discovery-positive",
    "evals/s13a/requirements-discovery-negative",
    "evals/s13a/skill-vs-baseline",
  ],
};
