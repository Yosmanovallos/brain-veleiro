import type { SkillCatalogEntry } from "../../core/skill/index.js";
import { toSkillDescriptor } from "../../core/skill/index.js";
import { researchEvidenceGroundedS11 } from "./definitions/researchEvidenceGroundedS11.js";
import { referenceSummarize } from "./definitions/referenceSummarize.js";
import { referenceFormatCheck } from "./definitions/referenceFormatCheck.js";
import { requirementsDiscoveryS13A } from "./definitions/requirementsDiscoveryS13A.js";
import { knowledgeGapAnalysisS13B } from "./definitions/knowledgeGapAnalysisS13B.js";
import { deepResearchS13C } from "./definitions/deepResearchS13C.js";
import { softwareArchitectureS13D } from "./definitions/softwareArchitectureS13D.js";
import { agentEngineeringS13E } from "./definitions/agentEngineeringS13E.js";

export { researchEvidenceGroundedS11 } from "./definitions/researchEvidenceGroundedS11.js";
export { referenceSummarize } from "./definitions/referenceSummarize.js";
export { referenceFormatCheck } from "./definitions/referenceFormatCheck.js";
export { requirementsDiscoveryS13A } from "./definitions/requirementsDiscoveryS13A.js";
export { knowledgeGapAnalysisS13B } from "./definitions/knowledgeGapAnalysisS13B.js";
export { deepResearchS13C } from "./definitions/deepResearchS13C.js";
export { softwareArchitectureS13D } from "./definitions/softwareArchitectureS13D.js";
export { agentEngineeringS13E } from "./definitions/agentEngineeringS13E.js";
export { selectSkillForTask } from "./selectSkillForTask.js";
export type { SkillSelectionRequest, SkillSelectionResult } from "./selectSkillForTask.js";

/**
 * The reference Skill catalog (SKILL_CONTRACT_v1.md section 31): the S11
 * Research Skill, the S13A Requirements Discovery Skill, plus two small
 * reference/test Skills, expressed as lazy SkillCatalogEntry values. This is
 * pure Intelligence data — it imports no concrete SkillProvider
 * implementation, so any SkillProvider (not just LocalReferenceSkillProvider)
 * can be constructed from it. Each Agent's `skills` allowlist (e.g.
 * requirementsDiscovererDefinition.skills == ["requirements.discovery.s13a"])
 * bounds which of these entries are ever discoverable/loadable for that Agent
 * (SKILL_CONTRACT_v1.md section 26) — adding an entry here does not by itself
 * expose it to an unrelated Agent.
 */
export const referenceSkillCatalogEntries: SkillCatalogEntry[] = [
  {
    descriptor: toSkillDescriptor(researchEvidenceGroundedS11),
    load_definition: async () => researchEvidenceGroundedS11,
  },
  {
    descriptor: toSkillDescriptor(referenceSummarize),
    load_definition: async () => referenceSummarize,
  },
  {
    descriptor: toSkillDescriptor(referenceFormatCheck),
    load_definition: async () => referenceFormatCheck,
  },
  {
    descriptor: toSkillDescriptor(requirementsDiscoveryS13A),
    load_definition: async () => requirementsDiscoveryS13A,
  },
  {
    descriptor: toSkillDescriptor(knowledgeGapAnalysisS13B),
    load_definition: async () => knowledgeGapAnalysisS13B,
  },
  {
    descriptor: toSkillDescriptor(deepResearchS13C),
    load_definition: async () => deepResearchS13C,
  },
  {
    descriptor: toSkillDescriptor(softwareArchitectureS13D),
    load_definition: async () => softwareArchitectureS13D,
  },
  {
    descriptor: toSkillDescriptor(agentEngineeringS13E),
    load_definition: async () => agentEngineeringS13E,
  },
];
