import type { SkillDefinition, SkillDescriptor } from "./types.js";

/**
 * Projects a full SkillDefinition down to its lightweight SkillDescriptor.
 *
 * Implements brain-bootstrap/specs/SKILL_CONTRACT_v1.md section 19: the
 * descriptor MUST NOT expose rules, procedure, verification, or full
 * inputs/outputs — only the approved discovery-safe fields.
 */
export function toSkillDescriptor(definition: SkillDefinition): SkillDescriptor {
  return {
    id: definition.id,
    version: definition.version,
    description: definition.description,
    applies_when: definition.applies_when,
    required_capability_ids: [...definition.requires.capabilities],
    quality_contract_refs: [...definition.requires.quality_contract_refs],
  };
}
