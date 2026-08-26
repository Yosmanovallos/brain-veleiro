import { randomUUID } from "node:crypto";
import type { AgentDefinition } from "../../core/agent/index.js";
import type { SkillDefinition } from "../../core/skill/index.js";
import type { KnowledgeGapAnalysisInput } from "./types.js";

/**
 * S13B Intelligence-layer Skill materialization bridge.
 *
 * Implements brain-bootstrap/specs/KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md
 * section 23, mirroring
 * src/intelligence/requirements-discovery/materializeRequirementsDiscoveryTask.ts.
 * This bridge is deliberately narrow: it only ever materializes the one
 * selected S13B Skill against a base knowledge-gap-analyzer AgentDefinition
 * and a current KnowledgeGapAnalysisInput. It never branches on `role` or
 * `skill.id`, performs no registry discovery itself (that is S12's job,
 * exercised by the caller via selectSkillForTask()/SkillProvider before this
 * function runs), and is not a generic Skill execution engine.
 *
 * The materialized objective may include only: the KnowledgeGapAnalysisInput
 * (S13A result + bounded context facts); the selected Skill's description,
 * rules, procedure, and verification expectations; and the Quality Contract
 * reference. It must never include the full Skill catalog, unrelated
 * Skills, historical session corpus, or vendor/provider details.
 *
 * These marker strings are a stable, parseable contract with the
 * ModelProvider that consumes the materialized objective (see
 * tests/knowledge-gap-analysis/fixtures.ts) — they are not prose for a
 * human reader.
 */

export const KGA_INPUT_MARKER = "KGA_INPUT:";
export const KGA_SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";

function assertValidInput(input: KnowledgeGapAnalysisInput | undefined): KnowledgeGapAnalysisInput {
  if (!input?.requirements_discovery?.request?.trim()) {
    throw new Error(
      "materializeKnowledgeGapAnalysisTask requires a non-empty KnowledgeGapAnalysisInput.requirements_discovery.request.",
    );
  }
  return input;
}

export interface MaterializeKnowledgeGapAnalysisTaskParams {
  baseDefinition: AgentDefinition;
  input: KnowledgeGapAnalysisInput;
  loadedSkill: SkillDefinition;
  qualityContractRef: string;
  taskId?: string;
}

/**
 * Skill-assisted materialization: embeds the KnowledgeGapAnalysisInput plus
 * the selected Skill's description/rules/procedure/verification and the
 * Quality Contract reference into a task-specific AgentDefinition objective.
 */
export function materializeKnowledgeGapAnalysisTask(params: MaterializeKnowledgeGapAnalysisTaskParams): AgentDefinition {
  const input = assertValidInput(params.input);
  const skill = params.loadedSkill;

  const rulesBlock = skill.rules.map((r) => `- [${r.level}] ${r.id}: ${r.statement}`).join("\n");
  const procedureBlock = skill.procedure.map((p) => `- ${p.id} ${p.title}: ${p.instruction}`).join("\n");
  const verificationBlock = skill.verification.map((v) => `- ${v.id} (${v.kind}): ${v.criterion}`).join("\n");

  const taskId = params.taskId ?? `${params.baseDefinition.id}-task-${randomUUID()}`;

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective:
      `${params.baseDefinition.objective}\n\n` +
      `${KGA_INPUT_MARKER}\n${JSON.stringify(input)}\n\n` +
      `${KGA_SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
      `SKILL_DESCRIPTION: ${skill.description}\n` +
      `SKILL_RULES:\n${rulesBlock}\n` +
      `SKILL_PROCEDURE:\n${procedureBlock}\n` +
      `SKILL_VERIFICATION:\n${verificationBlock}\n` +
      `QUALITY_CONTRACT_REF: ${params.qualityContractRef}`,
  };
}

export interface MaterializeBaselineKnowledgeGapAnalysisTaskParams {
  baseDefinition: AgentDefinition;
  input: KnowledgeGapAnalysisInput;
  taskId?: string;
}

/**
 * Baseline materialization: embeds only the KnowledgeGapAnalysisInput — no
 * S13B Skill is selected or materialized. Everything else (base
 * AgentDefinition, ModelProvider class/config, run limits, S09/S10 runtime
 * path) stays identical to the Skill-assisted run; only this function's
 * absence of SKILL_* content differs from materializeKnowledgeGapAnalysisTask().
 */
export function materializeBaselineKnowledgeGapAnalysisTask(
  params: MaterializeBaselineKnowledgeGapAnalysisTaskParams,
): AgentDefinition {
  const input = assertValidInput(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\n${KGA_INPUT_MARKER}\n${JSON.stringify(input)}`,
  };
}
