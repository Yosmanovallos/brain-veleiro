import type { AgentDefinition } from "../../core/agent/index.js";
import type { SkillDefinition, SkillDescriptor, SkillProvider } from "../../core/skill/index.js";

/**
 * Generic Skill selection/loading helper.
 *
 * Defined in brain-bootstrap/specs/SKILL_CONTRACT_v1.md section 26. This is
 * Intelligence-layer infrastructure, not Core: it never branches on a
 * specific Skill or Agent role, and it composes only the generic
 * SkillProvider contract plus AgentDefinition.skills.
 *
 * `AgentDefinition.skills` is the maximum discover/load allowlist. An empty
 * allowlist means no Skill is selectable — the selector never falls back to
 * the global catalog. Ranking is delegated entirely to `provider.discover()`
 * (SKILL_CONTRACT_v1.md sections 21/32): this function never loads more than
 * the one selected Skill merely to rank candidates.
 */

export interface SkillSelectionRequest {
  task: string;
  agent_definition: AgentDefinition;
  provider: SkillProvider;
  limit?: number;
}

export interface SkillSelectionResult {
  discovered: SkillDescriptor[];
  selected?: SkillDescriptor;
  loaded?: SkillDefinition;
}

export async function selectSkillForTask(request: SkillSelectionRequest): Promise<SkillSelectionResult> {
  const allowedSkillIds = request.agent_definition.skills;

  if (allowedSkillIds.length === 0) {
    return { discovered: [] };
  }

  const discovered = await request.provider.discover({
    query: request.task,
    allowed_skill_ids: allowedSkillIds,
    limit: request.limit,
  });

  if (discovered.length === 0) {
    return { discovered: [] };
  }

  const selected = discovered[0];
  const loaded = await request.provider.load({ id: selected.id, version: selected.version });

  return { discovered, selected, loaded };
}
