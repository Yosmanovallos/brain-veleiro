import { randomUUID } from "node:crypto";
import type { AgentDefinition } from "../../core/agent/index.js";
import type { SkillDefinition } from "../../core/skill/index.js";
import type { DeepResearchInput } from "./types.js";
import { selectDeepResearchItems } from "./selectDeepResearchItems.js";

/**
 * S13C Intelligence-layer Skill materialization bridge.
 *
 * Implements brain-bootstrap/specs/DEEP_RESEARCH_AGENT_v1.md section 14,
 * mirroring src/intelligence/knowledge-gap-analysis/materializeKnowledgeGapAnalysisTask.ts.
 * This bridge is deliberately narrow: it only ever materializes the one
 * selected S13C Skill against a base deep-researcher AgentDefinition and a
 * current DeepResearchInput. It never branches on `role` or `skill.id`,
 * performs no registry discovery itself (S12's job, exercised by the caller
 * via selectSkillForTask()/SkillProvider before this function runs), and is
 * not a generic Workflow Runtime.
 *
 * Both variants call selectDeepResearchItems() first (DR-P1/DR-P2 — fail
 * fast on an invalid selection before a task is ever created), then embed
 * the bounded selection plus the full DeepResearchInput. The materialized
 * objective may include only: the selection + DeepResearchInput; for the
 * Skill-assisted variant, the selected Skill's description, rules,
 * procedure, and verification expectations; and the Quality Contract
 * reference. It must never include unrelated Skills, the full Skill
 * catalog, or historical session corpus.
 *
 * These marker strings are a stable, parseable contract with the
 * ModelProvider that consumes the materialized objective (see
 * tests/deep-research/fixtures.ts) — they are not prose for a human reader.
 */

export const DEEP_RESEARCH_INPUT_MARKER = "DEEP_RESEARCH_INPUT:";
export const DEEP_RESEARCH_SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";

export interface MaterializeDeepResearchTaskParams {
  baseDefinition: AgentDefinition;
  input: DeepResearchInput;
  loadedSkill: SkillDefinition;
  qualityContractRef: string;
  taskId?: string;
}

/**
 * Skill-assisted materialization: embeds the DeepResearchInput (validated,
 * bounded selection already proven possible) plus the selected Skill's
 * description/rules/procedure/verification and the Quality Contract
 * reference into a task-specific AgentDefinition objective.
 */
export function materializeDeepResearchTask(params: MaterializeDeepResearchTaskParams): AgentDefinition {
  const selection = selectDeepResearchItems(params.input);
  const skill = params.loadedSkill;

  const rulesBlock = skill.rules.map((r) => `- [${r.level}] ${r.id}: ${r.statement}`).join("\n");
  const procedureBlock = skill.procedure.map((p) => `- ${p.id} ${p.title}: ${p.instruction}`).join("\n");
  const verificationBlock = skill.verification.map((v) => `- ${v.id} (${v.kind}): ${v.criterion}`).join("\n");

  const taskId = params.taskId ?? `${params.baseDefinition.id}-task-${randomUUID()}`;
  const selectedQuestions = selection.selected
    .map((s) => `  - ${s.knowledge_item_id}: ${s.research_question}`)
    .join("\n");

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective:
      `${params.baseDefinition.objective}\n\n` +
      `Selected research items (bounded batch, S13B queue order preserved):\n${selectedQuestions}\n\n` +
      `${DEEP_RESEARCH_INPUT_MARKER}\n${JSON.stringify(params.input)}\n\n` +
      `${DEEP_RESEARCH_SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
      `SKILL_DESCRIPTION: ${skill.description}\n` +
      `SKILL_RULES:\n${rulesBlock}\n` +
      `SKILL_PROCEDURE:\n${procedureBlock}\n` +
      `SKILL_VERIFICATION:\n${verificationBlock}\n` +
      `QUALITY_CONTRACT_REF: ${params.qualityContractRef}`,
  };
}

export interface MaterializeBaselineDeepResearchTaskParams {
  baseDefinition: AgentDefinition;
  input: DeepResearchInput;
  taskId?: string;
}

/**
 * Baseline materialization: embeds only the bounded selection + DeepResearchInput
 * — no S13C Skill is selected or materialized. Everything else (base
 * AgentDefinition, ModelProvider class/config, run limits, research.lookup
 * capability/provider, S09/S10 runtime path) stays identical to the
 * Skill-assisted run; only this function's absence of SKILL_* content
 * differs from materializeDeepResearchTask().
 */
export function materializeBaselineDeepResearchTask(params: MaterializeBaselineDeepResearchTaskParams): AgentDefinition {
  const selection = selectDeepResearchItems(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;
  const selectedQuestions = selection.selected
    .map((s) => `  - ${s.knowledge_item_id}: ${s.research_question}`)
    .join("\n");

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective:
      `${params.baseDefinition.objective}\n\n` +
      `Selected research items (bounded batch, S13B queue order preserved):\n${selectedQuestions}\n\n` +
      `${DEEP_RESEARCH_INPUT_MARKER}\n${JSON.stringify(params.input)}`,
  };
}
