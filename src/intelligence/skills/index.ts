import type { SkillCatalogEntry } from "../../core/skill/index.js";
import { toSkillDescriptor } from "../../core/skill/index.js";
import { researchEvidenceGroundedS11 } from "./definitions/researchEvidenceGroundedS11.js";
import { referenceSummarize } from "./definitions/referenceSummarize.js";
import { referenceFormatCheck } from "./definitions/referenceFormatCheck.js";

export { researchEvidenceGroundedS11 } from "./definitions/researchEvidenceGroundedS11.js";
export { referenceSummarize } from "./definitions/referenceSummarize.js";
export { referenceFormatCheck } from "./definitions/referenceFormatCheck.js";
export { selectSkillForTask } from "./selectSkillForTask.js";
export type { SkillSelectionRequest, SkillSelectionResult } from "./selectSkillForTask.js";

/**
 * The reference Skill catalog (SKILL_CONTRACT_v1.md section 31): the S11
 * Research Skill plus two small reference/test Skills, expressed as lazy
 * SkillCatalogEntry values. This is pure Intelligence data — it imports no
 * concrete SkillProvider implementation, so any SkillProvider (not just
 * LocalReferenceSkillProvider) can be constructed from it.
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
];
