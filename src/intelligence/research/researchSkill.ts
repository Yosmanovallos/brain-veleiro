/**
 * Brain — S11 Research Skill canonical identity constants.
 *
 * Defined in brain-bootstrap/skills/RESEARCH_SKILL_S11.md (ChatGPT-authored,
 * integrated verbatim). This module exposes only the Skill's stable
 * identifiers so researcherDefinition.ts and materializeResearchTask.ts do
 * not each hardcode the same strings. It does not implement a Skill
 * Registry, generic Skill loading, or S12's future Skill Contract v1 — S11
 * uses this Skill artifact by direct reference only, per RESEARCH_SKILL_S11.md
 * section 1 and RESEARCHER_AGENT_v1.md section 4.
 */

export const RESEARCH_SKILL_ID = "research.evidence-grounded.s11";

export const RESEARCH_SKILL_ARTIFACT_PATH = "brain-bootstrap/skills/RESEARCH_SKILL_S11.md";

export const RESEARCH_QUALITY_CONTRACT_REF = "brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml";

export const RESEARCH_LOOKUP_CAPABILITY_ID = "research.lookup";

/** RESEARCH_SKILL_S11.md section 4 — canonical reference lookup bound. */
export const RESEARCH_LOOKUP_MAX_LIMIT = 5;
