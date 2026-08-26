import type { SkillDefinition } from "../../../core/skill/index.js";
import { researcherDefinition } from "../../agent-definitions/researcherDefinition.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID, RESEARCH_QUALITY_CONTRACT_REF, RESEARCH_SKILL_ID } from "../../research/researchSkill.js";

/**
 * Typed Skill Contract v1 representation of the S11 Research Skill.
 *
 * Defined in brain-bootstrap/specs/SKILL_CONTRACT_v1.md section 30
 * ("S11 Research Skill migration"). The canonical semantic source of truth
 * remains brain-bootstrap/skills/RESEARCH_SKILL_S11.md — this file is a
 * *runtime representation* of that Markdown artifact, not a replacement for
 * it. It is non-destructive: no S11-protected semantic rule is deleted or
 * weakened here.
 *
 * `outputs[0].schema` and `requires.context_sources` are reused directly
 * from src/intelligence/agent-definitions/researcherDefinition.ts (the S11
 * Researcher AgentDefinition) rather than re-typed by hand, so the two stay
 * in sync and this migration cannot silently drift from the S11 contract.
 *
 * Protected semantics preserved (RESEARCH_SKILL_S11.md section 19 /
 * SKILL_CONTRACT_v1.md section 30), each traceable to a `rules[]` entry
 * below:
 *   - Knowledge Gap Analysis           -> rules R-KGA
 *   - evidence-grounding rules          -> rules R-EVIDENCE
 *   - cross-check rule                  -> rules R-CROSSCHECK
 *   - contradiction handling            -> rules R-CONTRADICTIONS
 *   - unknown handling                  -> rules R-UNKNOWNS
 *   - value-of-information stop rule    -> rules R-VOI
 *   - source traceability               -> rules R-TRACEABILITY
 *   - required research.lookup capability -> requires.capabilities / permissions.allowed_capabilities
 *   - STANDARD Researcher Quality Contract reference -> requires.quality_contract_refs
 *   - read-only capability permissions  -> permissions.allowed_side_effects = ["NONE"]
 */
export const researchEvidenceGroundedS11: SkillDefinition = {
  id: RESEARCH_SKILL_ID,
  version: "0.1.0",

  description:
    "Produce decision-relevant, observable, evidence-grounded research that is bounded and explicit about " +
    "uncertainty: question -> Knowledge Gap Analysis -> bounded evidence gathering -> claim/evidence ledger -> " +
    "cross-check -> contradiction/unknown analysis -> value-of-information stop decision -> decision-relevant synthesis.",

  applies_when: {
    task_kinds: ["research"],
    signals: ["evidence", "cross-check", "research question", "unknowns", "knowledge gap"],
    exclusions: [],
  },

  inputs: [
    {
      name: "question",
      description: "The bounded research question to answer.",
      required: true,
      schema: { type: "string" },
    },
  ],

  outputs: [
    {
      name: "research_result",
      description:
        "The evidence-grounded ResearchResult: question, subquestions, findings, contradictions, unknowns, " +
        "research_status, and decision_relevant_summary.",
      required: true,
      schema: researcherDefinition.output_schema,
    },
  ],

  requires: {
    skills: [],
    capabilities: [RESEARCH_LOOKUP_CAPABILITY_ID],
    context_sources: researcherDefinition.context_policy.allowed_sources,
    quality_contract_refs: [RESEARCH_QUALITY_CONTRACT_REF],
  },

  rules: [
    {
      id: "R-KGA",
      level: "MUST",
      statement:
        "Perform Knowledge Gap Analysis before evidence gathering: decompose the question into subquestions and " +
        "classify each as DECISION_CRITICAL, DECISION_RELEVANT, CONTEXTUAL, or TRIVIA.",
    },
    {
      id: "R-EVIDENCE",
      level: "MUST",
      statement:
        "Every material finding must expose criticality, epistemic_status (EVIDENCED | INFERENCE | UNCERTAIN), " +
        "evidence, confidence, and limitations; a DECISION_CRITICAL finding presented as EVIDENCED must include " +
        "at least one inspectable evidence item.",
    },
    {
      id: "R-CROSSCHECK",
      level: "MUST",
      statement:
        "For DECISION_CRITICAL or DECISION_RELEVANT claims under a STANDARD or DEEP Quality Contract, seek " +
        "independent corroborating or contradicting evidence; duplicate/upstream-equivalent sources must not be " +
        "counted as independent cross-validation.",
    },
    {
      id: "R-CONTRADICTIONS",
      level: "MUST",
      statement:
        "Material contradictory evidence must remain visible; never silently discard a conflict in favor of a " +
        "cleaner-sounding answer.",
    },
    {
      id: "R-UNKNOWNS",
      level: "MUST",
      statement:
        "A decision-critical unknown must not disappear merely because research stopped; unresolved material " +
        "gaps must be surfaced as unknowns rather than filled with a fabricated finding.",
    },
    {
      id: "R-VOI",
      level: "MUST",
      statement:
        "Research must not run indefinitely; after each evidence round, apply the value-of-information stop rule " +
        "and report an explicit research_status (SATISFIED | EXHAUSTED_WITH_UNCERTAINTY | MORE_RESEARCH_NEEDED) " +
        "with a reason.",
    },
    {
      id: "R-TRACEABILITY",
      level: "MUST",
      statement:
        "Every evidence item must carry a resolvable source identifier/locator; an evidence reference without " +
        "one is not sufficient for traceability.",
    },
  ],

  procedure: [
    {
      id: "P1",
      title: "Normalize the question",
      instruction: "State the research question narrowly enough to support a decision, without broadening its scope.",
      requires: ["question"],
      produces: ["normalized_question"],
    },
    {
      id: "P2",
      title: "Perform Knowledge Gap Analysis",
      instruction: "Create decision-relevant subquestions, classify each gap, and identify what evidence could close it.",
      requires: ["normalized_question"],
      produces: ["subquestions"],
    },
    {
      id: "P3",
      title: "Prioritize",
      instruction: "Research DECISION_CRITICAL gaps first, then DECISION_RELEVANT, then CONTEXTUAL only when useful.",
      requires: ["subquestions"],
      produces: ["prioritized_gaps"],
    },
    {
      id: "P4",
      title: "Build bounded queries",
      instruction: "Target each research.lookup call at one specific unresolved gap; never request the entire source corpus.",
      requires: ["prioritized_gaps"],
      produces: ["lookup_queries"],
    },
    {
      id: "P5",
      title: "Prefer authoritative evidence",
      instruction: "When suitable primary/authoritative evidence is available, prefer it for material factual claims and record source metadata and date.",
      requires: ["lookup_queries"],
      produces: ["evidence_candidates"],
    },
    {
      id: "P6",
      title: "Build claim/evidence ledger",
      instruction: "For each candidate material conclusion, record claim, criticality, epistemic status, evidence, confidence, and limitations before final synthesis.",
      requires: ["evidence_candidates"],
      produces: ["claim_ledger"],
    },
    {
      id: "P7",
      title: "Cross-check",
      instruction: "For STANDARD/DEEP work, seek independent support and contradiction, and check date/scope differences; do not equate repetition with independence.",
      requires: ["claim_ledger"],
      produces: ["cross_validated_claims"],
    },
    {
      id: "P8",
      title: "Surface contradictions and unknowns",
      instruction: "Keep material conflicts and unresolved gaps explicit; never smooth them away to make the final answer sound cleaner.",
      requires: ["cross_validated_claims"],
      produces: ["contradictions", "unknowns"],
    },
    {
      id: "P9",
      title: "Evaluate value of information",
      instruction: "Apply the stop rule: stop if another lookup is unlikely to change the decision and the Quality Contract is satisfied; otherwise continue or surface a blocking limitation.",
      requires: ["contradictions", "unknowns"],
      produces: ["research_status"],
    },
    {
      id: "P10",
      title: "Produce decision-relevant synthesis",
      instruction: "Answer the actual question, distinguish evidence from inference, expose the strongest limitations, and include decision-relevant contradictions/unknowns.",
      requires: ["research_status"],
      produces: ["decision_relevant_summary"],
    },
  ],

  verification: [
    {
      id: "V1",
      kind: "DETERMINISTIC",
      criterion: "No DECISION_CRITICAL finding is presented as EVIDENCED with zero evidence items.",
      evidence_required: true,
    },
    {
      id: "V2",
      kind: "DETERMINISTIC",
      criterion:
        "Every material evidence item includes evidence_ref, source_ref, source_title, source_type, authority, " +
        "independence_group, observed_or_published_at, locator, and relationship.",
      evidence_required: true,
    },
    {
      id: "V3",
      kind: "DETERMINISTIC",
      criterion: "Material contradictions and unresolved decision-relevant/critical unknowns present in the gathered evidence are reflected in the output.",
      evidence_required: true,
    },
    {
      id: "V4",
      kind: "DETERMINISTIC",
      criterion: "research_status.state and reason are explicit and consistent with whether the decision-critical gap was resolved.",
      evidence_required: true,
    },
    {
      id: "V5",
      kind: "SEMANTIC",
      criterion: "An independent verifier can trace every DECISION_CRITICAL finding's evidence back to an inspectable source.",
      evidence_required: true,
    },
  ],

  permissions: {
    allowed_capabilities: [RESEARCH_LOOKUP_CAPABILITY_ID],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: [],
};
