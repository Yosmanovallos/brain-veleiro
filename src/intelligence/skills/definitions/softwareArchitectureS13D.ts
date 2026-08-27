import type { SkillDefinition } from "../../../core/skill/index.js";
import { softwareArchitectDefinition } from "../../agent-definitions/softwareArchitectDefinition.js";
import { SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF, SOFTWARE_ARCHITECTURE_SKILL_ID } from "../../software-architecture/softwareArchitectureSkill.js";

/**
 * Typed Skill Contract v1 representation of the S13D Software Architecture Skill.
 *
 * Defined in brain-bootstrap/skills/SOFTWARE_ARCHITECTURE_SKILL_S13D.md
 * (ChatGPT-authored, integrated verbatim). The canonical semantic source of
 * truth remains that Markdown artifact — this file is a *runtime
 * representation* of it, mirroring
 * src/intelligence/skills/definitions/deepResearchS13C.ts. It does not weaken
 * or reinterpret any SA-R/SA-P/SA-V rule.
 *
 * `outputs[0].schema` is reused directly from
 * src/intelligence/agent-definitions/softwareArchitectDefinition.ts (the S13D
 * AgentDefinition) so the two stay in sync.
 *
 * `requires.skills: []` (Agent spec section 5 — "S13D consumes S11/S13C
 * outputs, not their Skills"): unlike S13C, which declared a semantic
 * dependency on research.evidence-grounded.s11, S13D declares no transitive
 * Skill dependency at all. It consumes the already-produced
 * `KnowledgeGapAnalysisResult`/`DeepResearchBatchResult` values directly by
 * type, never executes another Skill's procedure.
 */
export const softwareArchitectureS13D: SkillDefinition = {
  id: SOFTWARE_ARCHITECTURE_SKILL_ID,
  version: "1.0.0",

  description:
    "Compare viable software-architecture alternatives across requirements fit, trade-offs, failure modes, cost, " +
    "operations, and security, then produce an evidence-traceable proposed Architecture Decision Record for human " +
    "approval.",

  applies_when: {
    task_kinds: ["software-architecture", "architecture-decision", "adr-authoring", "technical-tradeoff-analysis"],
    signals: ["architecture", "alternatives", "trade-offs", "failure modes", "cost", "operations", "security", "ADR"],
    exclusions: [
      "requirements discovery",
      "deep research",
      "implementation planning",
      "agent design",
      "tasks with fewer than two genuinely distinct architecture alternatives unless the run is explicitly BLOCKED",
    ],
  },

  inputs: [
    {
      name: "architecture_input",
      description:
        "SoftwareArchitectureInput containing the architecture question, full S13B knowledge-gap context, optional " +
        "S13C deep-research evidence, and optional candidate alternatives.",
      required: true,
      schema: { type: "object" },
    },
  ],

  outputs: [
    {
      name: "architecture_decision",
      description: "SoftwareArchitectureDecisionResult containing structured alternative analysis, a proposed ADR, and deterministic Markdown rendering.",
      required: true,
      schema: softwareArchitectDefinition.output_schema,
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    quality_contract_refs: [SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF],
  },

  rules: [
    { id: "SA-R1", level: "MUST", statement: "Compare at least two and at most four genuinely distinct architecture alternatives before recommending one, unless the decision is BLOCKED." },
    { id: "SA-R2", level: "MUST", statement: "Mark every alternative origin as PROVIDED or GENERATED; generated alternatives must never be represented as stakeholder-approved choices." },
    { id: "SA-R3", level: "MUST", statement: "Evaluate every viable alternative against the same canonical decision dimensions rather than using different criteria for different alternatives." },
    { id: "SA-R4", level: "MUST", statement: "The canonical decision dimensions are requirements_fit, trade_offs, failure_modes, cost, operations, security, and reversibility." },
    { id: "SA-R5", level: "MUST", statement: "Hard constraints must be represented explicitly and evaluated for every alternative." },
    { id: "SA-R6", level: "MUST", statement: "Never recommend an alternative that has an unresolved hard-constraint FAIL." },
    { id: "SA-R7", level: "MUST", statement: "Preserve benefits and disadvantages for every viable alternative; do not create a one-sided comparison to justify a preferred answer." },
    { id: "SA-R8", level: "MUST", statement: "Failure-mode analysis must include trigger, impact, detectability or observable symptom, and mitigation or containment when known." },
    { id: "SA-R9", level: "MUST", statement: "Security analysis must address the security properties materially affected by the architecture decision and must not use generic security boilerplate as a substitute for decision-specific analysis." },
    { id: "SA-R10", level: "MUST", statement: "Cost analysis must distinguish implementation cost, ongoing operational cost, and cost uncertainty rather than inventing precise monetary values when none are evidenced." },
    { id: "SA-R11", level: "MUST", statement: "Operations analysis must consider deployment, observability, backup/recovery, failure handling, and operator burden when materially relevant." },
    { id: "SA-R12", level: "MUST", statement: "Reversibility must state migration or exit cost and identify lock-in where present." },
    { id: "SA-R13", level: "MUST", statement: "Architecture claims derived from S13B/S13C evidence must preserve traceability to their source references." },
    { id: "SA-R14", level: "MUST", statement: "S13C recommended_closure_state may inform decision readiness but S13D must not mutate or apply S13B/S13C closure state." },
    { id: "SA-R15", level: "MUST", statement: "Decision-critical unresolved gaps relevant to the architecture question must remain explicit and may force NEEDS_MORE_EVIDENCE or BLOCKED." },
    { id: "SA-R16", level: "MUST", statement: "Assumptions introduced during architecture analysis must be explicit, justified, risk-rated, and never presented as verified facts." },
    { id: "SA-R17", level: "MUST", statement: "If candidate alternatives are not supplied, S13D may generate plausible alternatives from the bounded decision context but must mark their origin GENERATED." },
    { id: "SA-R18", level: "MUST", statement: "Do not invoke research.lookup or any capability; missing evidence is surfaced rather than silently researched." },
    { id: "SA-R19", level: "MUST", statement: "The selected recommendation must explain why it wins against each rejected alternative, not merely why it is attractive in isolation." },
    { id: "SA-R20", level: "MUST", statement: "A recommendation may be READY_FOR_HUMAN_APPROVAL only when all architecture-critical hard constraints are evaluated and no decision-critical blocker remains relevant to the decision." },
    { id: "SA-R21", level: "MUST", statement: "Every ADR produced by S13D has status PROPOSED and approval_required true." },
    { id: "SA-R22", level: "MUST", statement: "S13D must not silently mark an ADR ACCEPTED; acceptance is an external human-approved state transition." },
    { id: "SA-R23", level: "MUST", statement: "The deterministic Markdown ADR must be rendered from the structured ADR object and must not contain additional semantic claims absent from the structured result." },
    { id: "SA-R24", level: "MUST", statement: "Keep context bounded to the architecture question, relevant S13B knowledge items, relevant S13C research items, candidate alternatives, selected Skill content, and the Quality Contract." },
  ],

  procedure: [
    {
      id: "SA-P1",
      title: "Validate architecture decision context",
      instruction: "Validate the architecture question, S13B knowledge-gap input, optional S13C deep-research result, and candidate alternatives. Preserve upstream inputs unchanged.",
      requires: ["architecture_input"],
      produces: ["validated_architecture_context"],
    },
    {
      id: "SA-P2",
      title: "Extract decision drivers and hard constraints",
      instruction: "Derive bounded decision drivers from relevant S13B items and explicit architecture input. Mark hard constraints separately from preferences and preserve source refs.",
      requires: ["validated_architecture_context"],
      produces: ["decision_drivers"],
    },
    {
      id: "SA-P3",
      title: "Establish candidate alternatives",
      instruction: "Use supplied alternatives when available and generate additional alternatives only when needed to reach a meaningful comparison. Keep total alternatives between two and four and mark each origin PROVIDED or GENERATED.",
      requires: ["decision_drivers"],
      produces: ["alternatives"],
    },
    {
      id: "SA-P4",
      title: "Evaluate requirements fit",
      instruction: "Evaluate every alternative against every hard constraint and material decision driver using the same evaluation vocabulary.",
      requires: ["alternatives", "decision_drivers"],
      produces: ["requirements_fit_analysis"],
    },
    {
      id: "SA-P5",
      title: "Analyze trade-offs and reversibility",
      instruction: "Record benefits, disadvantages, migration cost, lock-in, reversibility, and material uncertainties for every viable alternative.",
      requires: ["requirements_fit_analysis"],
      produces: ["tradeoff_analysis"],
    },
    {
      id: "SA-P6",
      title: "Analyze failure modes",
      instruction: "Identify architecture-specific failure modes for every viable alternative, including trigger, impact, observable symptom, and mitigation or containment when known.",
      requires: ["tradeoff_analysis"],
      produces: ["failure_mode_analysis"],
    },
    {
      id: "SA-P7",
      title: "Analyze cost, operations, and security",
      instruction: "Compare implementation/operational cost, deployment and operator burden, backup/recovery and observability implications, and architecture-specific security properties without inventing precise unsupported values.",
      requires: ["failure_mode_analysis"],
      produces: ["operational_analysis"],
    },
    {
      id: "SA-P8",
      title: "Evaluate evidence and unresolved blockers",
      instruction: "Trace material claims to bounded evidence, surface unsupported assumptions, and determine whether any decision-critical unresolved gap prevents a responsible recommendation.",
      requires: ["operational_analysis"],
      produces: ["decision_readiness"],
    },
    {
      id: "SA-P9",
      title: "Select or defer recommendation",
      instruction: "Recommend one alternative only when the comparison supports it and no unresolved hard-constraint violation exists. Otherwise emit NEEDS_MORE_EVIDENCE or BLOCKED.",
      requires: ["decision_readiness"],
      produces: ["recommendation"],
    },
    {
      id: "SA-P10",
      title: "Produce proposed ADR",
      instruction: "Build the structured proposed ADR with context, decision drivers, alternatives, decision, consequences, failure modes, cost, operations, security, evidence, assumptions, open questions, and approval requirement.",
      requires: ["recommendation"],
      produces: ["structured_adr"],
    },
    {
      id: "SA-P11",
      title: "Render deterministic Markdown ADR",
      instruction: "Render Markdown only from the structured ADR fields using the canonical section order and without adding semantic content.",
      requires: ["structured_adr"],
      produces: ["adr_markdown"],
    },
  ],

  verification: [
    { id: "SA-V1", kind: "DETERMINISTIC", criterion: "A non-blocked comparison contains between two and four distinct alternatives.", evidence_required: true },
    { id: "SA-V2", kind: "DETERMINISTIC", criterion: "Every alternative is evaluated against all hard constraints and canonical architecture dimensions.", evidence_required: true },
    { id: "SA-V3", kind: "DETERMINISTIC", criterion: "No recommended alternative has an unresolved hard-constraint FAIL.", evidence_required: true },
    { id: "SA-V4", kind: "DETERMINISTIC", criterion: "Every viable alternative includes benefits, disadvantages, and at least one architecture-specific failure-mode analysis when a material failure mode exists in the fixture.", evidence_required: true },
    { id: "SA-V5", kind: "DETERMINISTIC", criterion: "Cost, operations, security, and reversibility are present as separate decision dimensions.", evidence_required: true },
    { id: "SA-V6", kind: "DETERMINISTIC", criterion: "Material recommendation claims preserve valid upstream or explicit-context evidence references.", evidence_required: true },
    { id: "SA-V7", kind: "DETERMINISTIC", criterion: "Generated alternatives and assumptions are explicitly marked and never presented as verified upstream facts.", evidence_required: true },
    { id: "SA-V8", kind: "DETERMINISTIC", criterion: "S13B and S13C inputs are unchanged after architecture analysis.", evidence_required: true },
    { id: "SA-V9", kind: "DETERMINISTIC", criterion: "ADR status is PROPOSED and approval_required is true.", evidence_required: true },
    { id: "SA-V10", kind: "DETERMINISTIC", criterion: "Markdown ADR is deterministically derived from the structured ADR and contains all canonical sections.", evidence_required: true },
    { id: "SA-V11", kind: "DETERMINISTIC", criterion: "The Skill-assisted run improves the canonical architecture metrics versus a no-Skill baseline through the same generic Agent runtime.", evidence_required: true },
    { id: "SA-V12", kind: "SEMANTIC", criterion: "The recommendation is balanced, evidence-aware, explicit about uncertainty, and does not manufacture architecture certainty.", evidence_required: true },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: ["evals/s13d/software-architecture-positive", "evals/s13d/software-architecture-negative", "evals/s13d/skill-vs-baseline"],
};
