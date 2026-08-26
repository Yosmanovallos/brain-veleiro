/**
 * Brain — S13A Requirements Discovery Skill canonical identity constants.
 *
 * Defined in brain-bootstrap/skills/REQUIREMENTS_DISCOVERY_SKILL_S13A.md and
 * brain-bootstrap/specs/REQUIREMENTS_DISCOVERY_AGENT_v1.md (ChatGPT-authored,
 * integrated verbatim). This module exposes only the Skill's stable
 * identifiers so requirementsDiscovererDefinition.ts and
 * requirementsDiscoveryS13A.ts do not each hardcode the same strings, mirroring
 * src/intelligence/research/researchSkill.ts. Unlike S11, S13A requires no
 * capability constant: it operates only on current-task input (tools: [],
 * capabilities: []).
 */

export const REQUIREMENTS_DISCOVERY_SKILL_ID = "requirements.discovery.s13a";

export const REQUIREMENTS_DISCOVERY_SKILL_ARTIFACT_PATH =
  "brain-bootstrap/skills/REQUIREMENTS_DISCOVERY_SKILL_S13A.md";

export const REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF =
  "brain-bootstrap/quality-contracts/S13A_REQUIREMENTS_DISCOVERY_STANDARD.yaml";
