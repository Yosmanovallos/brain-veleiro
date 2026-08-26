import type { SkillDefinition } from "../../../core/skill/index.js";
import { knowledgeGapAnalyzerDefinition } from "../../agent-definitions/knowledgeGapAnalyzerDefinition.js";
import {
  KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
  KNOWLEDGE_GAP_ANALYSIS_SKILL_ID,
} from "../../knowledge-gap-analysis/knowledgeGapAnalysisSkill.js";

/**
 * Typed Skill Contract v1 representation of the S13B Knowledge Gap Analysis
 * Skill.
 *
 * Defined in brain-bootstrap/skills/KNOWLEDGE_GAP_ANALYSIS_SKILL_S13B.md
 * (ChatGPT-authored, integrated verbatim). The canonical semantic source of
 * truth remains that Markdown artifact — this file is a *runtime
 * representation* of it, mirroring
 * src/intelligence/skills/definitions/requirementsDiscoveryS13A.ts. It does
 * not weaken or reinterpret any KGA-R/KGA-P/KGA-V rule.
 *
 * `outputs[0].schema` and `requires.context_sources` are reused directly
 * from src/intelligence/agent-definitions/knowledgeGapAnalyzerDefinition.ts
 * (the S13B AgentDefinition) so the two stay in sync.
 *
 * S13B/S13C boundary: this Skill's rules/procedure classify and prioritize
 * only — KGA-R18/KGA-R20 explicitly forbid invoking `research.lookup` or any
 * other capability, and require an explicit S13C handoff without performing
 * S13C deep research itself.
 */
export const knowledgeGapAnalysisS13B: SkillDefinition = {
  id: KNOWLEDGE_GAP_ANALYSIS_SKILL_ID,
  version: "1.0.0",

  description:
    "Classify the current requirements-discovery knowledge into known, told, proven, assumed, needs-research, " +
    "and unknowable while preserving decision impact, justified closure state, provenance, and a bounded " +
    "handoff to deep research.",

  applies_when: {
    task_kinds: ["knowledge-gap-analysis", "requirements-analysis", "decision-preparation"],
    signals: [
      "known",
      "told",
      "proven",
      "assumed",
      "needs research",
      "unknowable",
      "unresolved requirements",
      "knowledge gaps",
    ],
    exclusions: [
      "open-ended deep research",
      "evidence gathering from external sources",
      "implementation planning before requirements discovery is structurally complete",
    ],
  },

  inputs: [
    {
      name: "requirements_discovery",
      description: "Full S13A RequirementsDiscoveryResult.",
      required: true,
      schema: { type: "object" },
    },
    {
      name: "context_facts",
      description:
        "Optional bounded current-context facts already supplied by Context. These facts may establish " +
        "canonical authority or direct proof without invoking a research capability.",
      required: false,
      schema: { type: "array" },
    },
  ],

  outputs: [
    {
      name: "knowledge_gap_analysis",
      description: "Structured KnowledgeGapAnalysisResult for S13C and downstream decisions.",
      required: true,
      schema: knowledgeGapAnalyzerDefinition.output_schema,
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: knowledgeGapAnalyzerDefinition.context_policy.allowed_sources,
    quality_contract_refs: [KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF],
  },

  rules: [
    { id: "KGA-R1", level: "MUST", statement: "Treat epistemic status, decision impact, and closure state as three separate axes." },
    { id: "KGA-R2", level: "MUST", statement: "Never classify a stakeholder assertion as PROVEN merely because it is explicit." },
    { id: "KGA-R3", level: "MUST", statement: "PROVEN requires direct inspectable evidence already present in bounded context." },
    { id: "KGA-R4", level: "MUST", statement: "KNOWN requires a current canonical authority sufficient for the statement, not merely model confidence." },
    { id: "KGA-R5", level: "MUST", statement: "TOLD means explicitly asserted by a stakeholder or source but not independently established as KNOWN or PROVEN." },
    { id: "KGA-R6", level: "MUST", statement: "ASSUMED means provisionally accepted or derived without sufficient authority/evidence; it must never be presented as KNOWN or PROVEN." },
    { id: "KGA-R7", level: "MUST", statement: "NEEDS_RESEARCH is reserved for an unresolved, researchable question whose answer could materially affect a decision." },
    { id: "KGA-R8", level: "MUST", statement: "UNKNOWABLE is reserved for information that cannot reasonably be established now through bounded evidence or research, including future contingent choices or intrinsically unavailable facts." },
    { id: "KGA-R9", level: "MUST", statement: "Do not use UNKNOWABLE merely as a synonym for not-yet-researched." },
    { id: "KGA-R10", level: "MUST", statement: "Use the canonical S04 decision-impact vocabulary without renaming it." },
    { id: "KGA-R11", level: "MUST", statement: "Assign an S04 closure state only when current evidence, authority, accepted-assumption policy, or explicit blocking conditions justify it." },
    { id: "KGA-R12", level: "MUST", statement: "Do not assign RESOLVED_WITH_EVIDENCE to an item without inspectable evidence references." },
    { id: "KGA-R13", level: "MUST", statement: "Do not assign RESOLVED_BY_AUTHORITY unless the cited authority is sufficient for that statement." },
    { id: "KGA-R14", level: "MUST", statement: "Open NEEDS_RESEARCH items normally have no closure_state; S13B does not pretend that classification resolved them." },
    { id: "KGA-R15", level: "MUST", statement: "Preserve S13A origin, source excerpts, related goals, blockers, and assumptions rather than rediscovering the client request from scratch." },
    { id: "KGA-R16", level: "MUST", statement: "The S13C research queue contains only items classified NEEDS_RESEARCH." },
    { id: "KGA-R17", level: "MUST", statement: "Decision-critical NEEDS_RESEARCH items rank ahead of decision-relevant, contextual, and trivia items." },
    { id: "KGA-R18", level: "MUST", statement: "Do not invoke research.lookup or any other capability in S13B." },
    { id: "KGA-R19", level: "MUST", statement: "Keep context bounded to S13A output plus relevant current-authority facts; do not load unrelated corpus or full Skill catalog." },
    { id: "KGA-R20", level: "MUST", statement: "Produce an explicit S13C handoff without performing S13C deep research." },
  ],

  procedure: [
    {
      id: "KGA-P1",
      title: "Validate S13A input",
      instruction:
        "Confirm the full RequirementsDiscoveryResult is structurally valid and ready_for_gap_analysis is true " +
        "or explicitly record why analysis is still useful.",
      requires: ["requirements_discovery"],
      produces: ["validated_discovery"],
    },
    {
      id: "KGA-P2",
      title: "Normalize candidate knowledge items",
      instruction:
        "Convert S13A goals, users, unknowns, assumptions, constraints, acceptance criteria, and supplied " +
        "context_facts into a uniform candidate-item set while preserving source references and related goal IDs.",
      requires: ["validated_discovery"],
      produces: ["candidate_items"],
    },
    {
      id: "KGA-P3",
      title: "Classify epistemic status",
      instruction:
        "Assign exactly one of KNOWN, TOLD, PROVEN, ASSUMED, NEEDS_RESEARCH, or UNKNOWABLE to every candidate " +
        "item using the canonical semantics in this Skill.",
      requires: ["candidate_items"],
      produces: ["epistemically_classified_items"],
    },
    {
      id: "KGA-P4",
      title: "Assign decision impact",
      instruction:
        "Assign DECISION_CRITICAL, DECISION_RELEVANT, CONTEXTUAL, or TRIVIA independently from epistemic status. " +
        "Preserve the S13A unknown-impact mapping where applicable.",
      requires: ["epistemically_classified_items"],
      produces: ["impact_classified_items"],
    },
    {
      id: "KGA-P5",
      title: "Determine justified closure state",
      instruction:
        "Apply an S04 closure state only when current evidence/authority/assumption policy justifies it. " +
        "Leave closure_state null for genuinely open items.",
      requires: ["impact_classified_items"],
      produces: ["closure_annotated_items"],
    },
    {
      id: "KGA-P6",
      title: "Detect overclaims and conflicts",
      instruction:
        "Check for PROVEN without evidence, KNOWN without sufficient authority, ASSUMED hidden as fact, " +
        "researchable items labeled UNKNOWABLE, and unknowable future choices labeled NEEDS_RESEARCH.",
      requires: ["closure_annotated_items"],
      produces: ["validated_classification"],
    },
    {
      id: "KGA-P7",
      title: "Build bucket indexes",
      instruction:
        "Build deterministic ID buckets for known, told, proven, assumed, needs_research, and unknowable " +
        "without duplicating or reclassifying items.",
      requires: ["validated_classification"],
      produces: ["buckets"],
    },
    {
      id: "KGA-P8",
      title: "Prioritize research queue",
      instruction:
        "Select only NEEDS_RESEARCH items and sort by decision impact first, then blocking status, then " +
        "deterministic ID ordering.",
      requires: ["validated_classification"],
      produces: ["research_queue"],
    },
    {
      id: "KGA-P9",
      title: "Build S13C handoff",
      instruction:
        "Produce ready_for_deep_research, research_item_ids, decision_blockers, unknowable_item_ids, and notes. " +
        "Do not resolve research items here.",
      requires: ["research_queue", "buckets"],
      produces: ["s13c_handoff"],
    },
    {
      id: "KGA-P10",
      title: "Summarize decision readiness",
      instruction:
        "Summarize what is established, what is merely asserted, what is assumed, what must be researched, " +
        "and what cannot currently be known.",
      requires: ["validated_classification", "s13c_handoff"],
      produces: ["knowledge_gap_analysis"],
    },
  ],

  verification: [
    { id: "KGA-V1", kind: "DETERMINISTIC", criterion: "Every normalized item has exactly one valid epistemic_status.", evidence_required: true },
    { id: "KGA-V2", kind: "DETERMINISTIC", criterion: "Every item has exactly one valid S04 decision_impact.", evidence_required: true },
    { id: "KGA-V3", kind: "DETERMINISTIC", criterion: "Every PROVEN item has at least one direct evidence_ref.", evidence_required: true },
    { id: "KGA-V4", kind: "DETERMINISTIC", criterion: "Every KNOWN item cites a sufficient canonical authority reference.", evidence_required: true },
    { id: "KGA-V5", kind: "DETERMINISTIC", criterion: "No TOLD item is silently upgraded to PROVEN without evidence.", evidence_required: true },
    { id: "KGA-V6", kind: "DETERMINISTIC", criterion: "research_queue contains only NEEDS_RESEARCH items in canonical priority order.", evidence_required: true },
    { id: "KGA-V7", kind: "DETERMINISTIC", criterion: "UNKNOWABLE items are absent from research_queue.", evidence_required: true },
    { id: "KGA-V8", kind: "DETERMINISTIC", criterion: "No open NEEDS_RESEARCH item is falsely marked resolved.", evidence_required: true },
    { id: "KGA-V9", kind: "DETERMINISTIC", criterion: "Bucket indexes partition all item IDs exactly once.", evidence_required: true },
    { id: "KGA-V10", kind: "DETERMINISTIC", criterion: "The Skill-assisted run improves canonical KGA metrics versus a no-Skill baseline through the same generic Agent runtime.", evidence_required: true },
    { id: "KGA-V11", kind: "SEMANTIC", criterion: "The analysis preserves uncertainty and does not manufacture knowledge.", evidence_required: true },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: ["evals/s13b/knowledge-gap-positive", "evals/s13b/knowledge-gap-negative", "evals/s13b/skill-vs-baseline"],
};
