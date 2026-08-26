import type { SkillDefinition } from "../../../core/skill/index.js";
import { deepResearcherDefinition } from "../../agent-definitions/deepResearcherDefinition.js";
import { RESEARCH_SKILL_ID } from "../../research/researchSkill.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID } from "../../research/researchSkill.js";
import { DEEP_RESEARCH_QUALITY_CONTRACT_REF, DEEP_RESEARCH_SKILL_ID } from "../../deep-research/deepResearchSkill.js";

/**
 * Typed Skill Contract v1 representation of the S13C Deep Research Skill.
 *
 * Defined in brain-bootstrap/skills/DEEP_RESEARCH_SKILL_S13C.md
 * (ChatGPT-authored, integrated verbatim). The canonical semantic source of
 * truth remains that Markdown artifact — this file is a *runtime
 * representation* of it, mirroring
 * src/intelligence/skills/definitions/knowledgeGapAnalysisS13B.ts. It does
 * not weaken or reinterpret any DR-R/DR-P/DR-V rule.
 *
 * `outputs[0].schema` is reused directly from
 * src/intelligence/agent-definitions/deepResearcherDefinition.ts (the S13C
 * AgentDefinition) so the two stay in sync.
 *
 * `requires.skills: [research.evidence-grounded.s11]` is a *semantic*
 * dependency (DEEP_RESEARCH_AGENT_v1.md section 2 — "S12 does not implement
 * generic transitive Skill execution"). Part B does not build a new Core
 * dependency resolver for this: S13C's typed Skill/AgentDefinition reuses the
 * real S11 `ResearchResult`/`validateResearchResult()`/`research.lookup` by
 * direct import instead, so the selected S13C Skill is runtime-complete on
 * its own without S12 ever loading two Skills for one Agent.
 */
export const deepResearchS13C: SkillDefinition = {
  id: DEEP_RESEARCH_SKILL_ID,
  version: "1.0.0",

  description:
    "Research the highest-priority NEEDS_RESEARCH items produced by S13B using bounded, evidence-grounded " +
    "investigation with source-quality preference, independent cross-validation, contradiction handling, " +
    "explicit uncertainty, value-of-information stopping, and traceable closure recommendations.",

  applies_when: {
    task_kinds: ["deep-research", "evidence-gathering", "decision-research"],
    signals: [
      "needs research",
      "research queue",
      "evidence",
      "authoritative source",
      "cross-check",
      "contradiction",
      "deep research",
    ],
    exclusions: [
      "items classified UNKNOWABLE",
      "requirements discovery",
      "knowledge-gap classification without evidence gathering",
      "open-ended research without a bounded decision question",
    ],
  },

  inputs: [
    {
      name: "knowledge_gap_analysis",
      description: "Full S13B KnowledgeGapAnalysisResult containing the prioritized research queue.",
      required: true,
      schema: { type: "object" },
    },
    {
      name: "max_research_items",
      description: "Maximum number of queue items to research in this run. Defaults to 1 and may not exceed 3.",
      required: false,
      schema: { type: "number" },
    },
  ],

  outputs: [
    {
      name: "deep_research",
      description: "Structured DeepResearchBatchResult preserving S13B traceability and S11 ResearchResult semantics.",
      required: true,
      schema: deepResearcherDefinition.output_schema,
    },
  ],

  requires: {
    skills: [RESEARCH_SKILL_ID],
    capabilities: [RESEARCH_LOOKUP_CAPABILITY_ID],
    context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    quality_contract_refs: [DEEP_RESEARCH_QUALITY_CONTRACT_REF],
  },

  rules: [
    { id: "DR-R1", level: "MUST", statement: "Research only items present in S13B research_queue and therefore already classified NEEDS_RESEARCH." },
    { id: "DR-R2", level: "MUST", statement: "Never research S13B UNKNOWABLE items unless a later canonical step explicitly reclassifies them first." },
    { id: "DR-R3", level: "MUST", statement: "Preserve S13B knowledge_item_id, decision_impact, blocking, and research_question through every research result." },
    { id: "DR-R4", level: "MUST", statement: "Preserve the S11 ResearchResult claim-level epistemic semantics EVIDENCED, INFERENCE, and UNCERTAIN without merging them with S13B item-level epistemic status." },
    { id: "DR-R5", level: "MUST", statement: "Prefer authoritative and primary sources for decision-critical and decision-relevant claims." },
    { id: "DR-R6", level: "MUST", statement: "For material evidenced claims, seek independent cross-validation when independent evidence is reasonably available." },
    { id: "DR-R7", level: "MUST", statement: "Sources sharing the same independence_group count as one independent source family for cross-validation." },
    { id: "DR-R8", level: "MUST", statement: "Search for contradictory or qualifying evidence before recommending a gap closure." },
    { id: "DR-R9", level: "MUST", statement: "Contradictory evidence remains visible in the final research result even when one side is judged stronger." },
    { id: "DR-R10", level: "MUST", statement: "Recency must be evaluated relative to the research question; stale evidence must be explicitly qualified and may not silently support a current-state claim." },
    { id: "DR-R11", level: "MUST", statement: "Every material claim must have evidence or be explicitly marked INFERENCE or UNCERTAIN with limitations, preserving S11 semantics." },
    { id: "DR-R12", level: "MUST", statement: "Do not promote an evidence-poor result to HIGH confidence merely because multiple sources repeat the same upstream claim." },
    { id: "DR-R13", level: "MUST", statement: "Use bounded research. Default to one research item per run and never process more than three S13B queue items in one run." },
    { id: "DR-R14", level: "MUST", statement: "Preserve S13B research_queue order when selecting items for a bounded batch." },
    { id: "DR-R15", level: "MUST", statement: "Use the S11 value-of-information stop semantics rather than searching indefinitely." },
    { id: "DR-R16", level: "MUST", statement: "SATISFIED requires enough evidence for the decision and no unresolved decision-critical contradiction that could change the answer." },
    { id: "DR-R17", level: "MUST", statement: "EXHAUSTED_WITH_UNCERTAINTY keeps residual uncertainty visible and must not be converted into a false resolved-with-evidence closure." },
    { id: "DR-R18", level: "MUST", statement: "MORE_RESEARCH_NEEDED keeps the gap open and normally recommends no closure state." },
    { id: "DR-R19", level: "MUST", statement: "S13C may recommend a canonical S04 closure state but must not mutate the upstream S13B KnowledgeGapAnalysisResult." },
    { id: "DR-R20", level: "MUST", statement: "A RESOLVED_WITH_EVIDENCE recommendation requires traceable evidence sufficient for the researched question." },
    { id: "DR-R21", level: "MUST", statement: "A RESOLVED_BY_AUTHORITY recommendation requires a source whose authority is sufficient for the specific question." },
    { id: "DR-R22", level: "MUST", statement: "A BLOCKED recommendation is allowed only when a decision-critical item cannot currently be resolved and that unresolved state blocks the relevant decision." },
    { id: "DR-R23", level: "MUST", statement: "S13C must not recommend ACCEPTED_AS_ASSUMPTION or DEFERRED_WITHOUT_DECISION_IMPACT for a NEEDS_RESEARCH item; those decisions belong outside deep research." },
    { id: "DR-R24", level: "MUST", statement: "Item-level uncertainty or evidence exhaustion does not automatically halt research on other selected queue items." },
    { id: "DR-R25", level: "MUST", statement: "A true runtime or capability failure that produces canonical S09 BLOCKED stops the current Agent run." },
    { id: "DR-R26", level: "MUST", statement: "Do not automatically promote unverified research output into durable memory." },
    { id: "DR-R27", level: "MUST", statement: "Do not introduce new web, MCP, vendor, or capability infrastructure in S13C; use research.lookup behind the existing CapabilityProvider boundary." },
    { id: "DR-R28", level: "MUST", statement: "Keep the context bounded to the selected queue items, relevant upstream traceability, selected Skill, Quality Contract, and retrieved evidence." },
  ],

  procedure: [
    {
      id: "DR-P1",
      title: "Validate the S13B research handoff",
      instruction:
        "Validate KnowledgeGapAnalysisResult, confirm the selected item IDs exist in research_queue, and reject any UNKNOWABLE or non-NEEDS_RESEARCH item.",
      requires: ["knowledge_gap_analysis"],
      produces: ["validated_research_queue"],
    },
    {
      id: "DR-P2",
      title: "Select bounded research batch",
      instruction: "Select the first max_research_items entries from S13B research_queue, preserving canonical queue order. Default to 1; maximum 3.",
      requires: ["validated_research_queue"],
      produces: ["selected_research_items"],
    },
    {
      id: "DR-P3",
      title: "Decompose each research question",
      instruction:
        "For each selected item, decompose the bounded research question into the minimum subquestions required to resolve the decision-relevant uncertainty. Preserve S11 Knowledge Gap Analysis semantics.",
      requires: ["selected_research_items"],
      produces: ["research_plans"],
    },
    {
      id: "DR-P4",
      title: "Retrieve authoritative evidence",
      instruction:
        "Use research.lookup to retrieve bounded evidence, preferring primary and authoritative sources and recording source metadata, dates, locators, and independence groups.",
      requires: ["research_plans"],
      produces: ["candidate_evidence"],
    },
    {
      id: "DR-P5",
      title: "Cross-check material claims",
      instruction:
        "For each decision-critical or decision-relevant evidenced claim, seek independent support where available and never count duplicate upstream source families as independent confirmation.",
      requires: ["candidate_evidence"],
      produces: ["cross_checked_evidence"],
    },
    {
      id: "DR-P6",
      title: "Search for contradiction and qualification",
      instruction: "Look for evidence that contradicts, narrows, dates, or otherwise qualifies the leading answer before recommending closure.",
      requires: ["cross_checked_evidence"],
      produces: ["contradiction_analysis"],
    },
    {
      id: "DR-P7",
      title: "Synthesize S11 ResearchResult",
      instruction:
        "Produce the canonical S11 ResearchResult for each selected queue item, preserving findings, evidence, confidence, limitations, contradictions, unknowns, research_status, and decision_relevant_summary.",
      requires: ["contradiction_analysis"],
      produces: ["research_results"],
    },
    {
      id: "DR-P8",
      title: "Apply value-of-information stop rule",
      instruction:
        "Stop each item's research when S11 SATISFIED or EXHAUSTED_WITH_UNCERTAINTY is justified, or report MORE_RESEARCH_NEEDED when additional evidence could still materially change the decision.",
      requires: ["research_results"],
      produces: ["stopped_research_results"],
    },
    {
      id: "DR-P9",
      title: "Recommend closure without mutating upstream state",
      instruction:
        "For each researched item, recommend RESOLVED_WITH_EVIDENCE, RESOLVED_BY_AUTHORITY, BLOCKED, or null according to the approved mapping. Do not mutate S13B closure_state.",
      requires: ["stopped_research_results"],
      produces: ["closure_recommendations"],
    },
    {
      id: "DR-P10",
      title: "Build bounded batch result",
      instruction:
        "Return processed item results, deferred queue IDs, batch status, preserved traceability, evidence refs, limitations, and a decision-relevant summary.",
      requires: ["closure_recommendations"],
      produces: ["deep_research"],
    },
  ],

  verification: [
    { id: "DR-V1", kind: "DETERMINISTIC", criterion: "Every processed item exists in S13B research_queue and is NEEDS_RESEARCH.", evidence_required: true },
    { id: "DR-V2", kind: "DETERMINISTIC", criterion: "No UNKNOWABLE S13B item is researched.", evidence_required: true },
    { id: "DR-V3", kind: "DETERMINISTIC", criterion: "Batch selection preserves S13B queue order and never exceeds three items.", evidence_required: true },
    { id: "DR-V4", kind: "DETERMINISTIC", criterion: "Every item-level research object passes the canonical S11 ResearchResult validator.", evidence_required: true },
    { id: "DR-V5", kind: "DETERMINISTIC", criterion: "Material evidenced claims use valid evidence metadata and do not count duplicate independence groups as independent support.", evidence_required: true },
    { id: "DR-V6", kind: "DETERMINISTIC", criterion: "Contradictory evidence discovered by the fixture remains visible in the result.", evidence_required: true },
    { id: "DR-V7", kind: "DETERMINISTIC", criterion: "Research status and recommended closure state satisfy the canonical S13C mapping.", evidence_required: true },
    { id: "DR-V8", kind: "DETERMINISTIC", criterion: "The upstream S13B result remains unchanged after S13C research.", evidence_required: true },
    { id: "DR-V9", kind: "DETERMINISTIC", criterion: "StructuredAgentOutput evidence_refs exactly deduplicate the selected item research evidence and authority references in first-occurrence order.", evidence_required: true },
    { id: "DR-V10", kind: "DETERMINISTIC", criterion: "Changing material source evidence changes the corresponding finding, contradiction, confidence, research status, or closure recommendation.", evidence_required: true },
    { id: "DR-V11", kind: "DETERMINISTIC", criterion: "The Skill-assisted run improves the canonical S13C metrics versus the no-Skill baseline through the same generic Agent runtime.", evidence_required: true },
    { id: "DR-V12", kind: "SEMANTIC", criterion: "The synthesis states evidence, contradictions, uncertainty, and limits without manufacturing closure.", evidence_required: true },
  ],

  permissions: {
    allowed_capabilities: [RESEARCH_LOOKUP_CAPABILITY_ID],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: ["evals/s13c/deep-research-positive", "evals/s13c/deep-research-negative", "evals/s13c/skill-vs-baseline"],
};
