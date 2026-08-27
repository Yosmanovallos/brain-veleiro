import { randomUUID } from "node:crypto";
import type { AgentDefinition } from "../../core/agent/index.js";
import type { SkillDefinition } from "../../core/skill/index.js";
import type { SoftwareArchitectureInput } from "./types.js";

/**
 * S13D Intelligence-layer Skill materialization bridge.
 *
 * Implements brain-bootstrap/specs/SOFTWARE_ARCHITECTURE_AGENT_v1.md sections
 * 6, 23, mirroring
 * src/intelligence/deep-research/materializeDeepResearchTask.ts. This bridge
 * is deliberately narrow: it only ever materializes the one selected S13D
 * Skill against a base software-architect AgentDefinition and a current
 * SoftwareArchitectureInput. It never branches on `role` or `skill.id`,
 * performs no registry discovery itself (S12's job, exercised by the caller
 * via selectSkillForTask()/SkillProvider before this function runs), and is
 * not a generic architecture workflow engine.
 *
 * Both variants call validateSoftwareArchitectureInput() first (fail fast on
 * an invalid input before a task is ever materialized), then embed the
 * SoftwareArchitectureInput. The materialized objective may include only: the
 * input; for the Skill-assisted variant, the selected Skill's description,
 * rules, procedure, and verification expectations; and the Quality Contract
 * reference. It must never include unrelated Skills, the full Skill catalog,
 * or historical session corpus.
 *
 * These marker strings are a stable, parseable contract with the
 * ModelProvider that consumes the materialized objective (see
 * tests/software-architecture/fixtures.ts) — they are not prose for a human
 * reader.
 */

export const SOFTWARE_ARCHITECTURE_INPUT_MARKER = "SOFTWARE_ARCHITECTURE_INPUT:";
export const SOFTWARE_ARCHITECTURE_SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";

const MIN_ALTERNATIVES = 0;
const MAX_ALTERNATIVES = 4;

/**
 * Agent spec section 6 — input contract validation. Exported so it can be
 * exercised directly by tests (T10) independent of the full Agent runtime,
 * mirroring selectDeepResearchItems()'s dual role in S13C.
 */
export function validateSoftwareArchitectureInput(input: SoftwareArchitectureInput | undefined): SoftwareArchitectureInput {
  if (!input?.architecture_question?.trim()) {
    throw new Error("SoftwareArchitectureInput.architecture_question must be a non-empty string (Agent spec section 6).");
  }

  const kga = input.knowledge_gap_analysis;
  if (!kga || !Array.isArray(kga.items) || !Array.isArray(kga.research_queue) || !kga.buckets) {
    throw new Error(
      "SoftwareArchitectureInput requires a valid KnowledgeGapAnalysisResult (items, research_queue, buckets) (Agent spec section 6).",
    );
  }

  const alternatives = input.candidate_alternatives ?? [];
  if (alternatives.length < MIN_ALTERNATIVES || alternatives.length > MAX_ALTERNATIVES) {
    throw new Error(`SoftwareArchitectureInput.candidate_alternatives must contain 0-${MAX_ALTERNATIVES} entries, got ${alternatives.length}.`);
  }
  const ids = alternatives.map((a) => a.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("SoftwareArchitectureInput.candidate_alternatives ids must be unique (Agent spec section 6).");
  }
  for (const alt of alternatives) {
    if (!alt.name?.trim() || !alt.description?.trim()) {
      throw new Error(`SoftwareArchitectureInput.candidate_alternatives entry '${alt.id}' must have a non-empty name and description.`);
    }
    if (alt.origin !== "PROVIDED" && alt.origin !== "GENERATED") {
      throw new Error(`SoftwareArchitectureInput.candidate_alternatives entry '${alt.id}' has an invalid origin '${String(alt.origin)}'.`);
    }
  }

  const deepResearch = input.deep_research;
  if (deepResearch) {
    const knownItemIds = new Set(kga.items.map((i) => i.id));
    for (const item of deepResearch.items) {
      if (!knownItemIds.has(item.knowledge_item_id)) {
        throw new Error(
          `SoftwareArchitectureInput.deep_research item '${item.knowledge_item_id}' does not resolve to any S13B ` +
            "KnowledgeGapAnalysisResult item — deep_research must be traceably compatible with knowledge_gap_analysis (Agent spec section 8).",
        );
      }
    }
  }

  return input;
}

export interface MaterializeSoftwareArchitectureTaskParams {
  baseDefinition: AgentDefinition;
  input: SoftwareArchitectureInput;
  loadedSkill: SkillDefinition;
  qualityContractRef: string;
  taskId?: string;
}

/**
 * Skill-assisted materialization: embeds the validated SoftwareArchitectureInput
 * plus the selected Skill's description/rules/procedure/verification and the
 * Quality Contract reference into a task-specific AgentDefinition objective.
 */
export function materializeSoftwareArchitectureTask(params: MaterializeSoftwareArchitectureTaskParams): AgentDefinition {
  const input = validateSoftwareArchitectureInput(params.input);
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
      `${SOFTWARE_ARCHITECTURE_INPUT_MARKER}\n${JSON.stringify(input)}\n\n` +
      `${SOFTWARE_ARCHITECTURE_SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
      `SKILL_DESCRIPTION: ${skill.description}\n` +
      `SKILL_RULES:\n${rulesBlock}\n` +
      `SKILL_PROCEDURE:\n${procedureBlock}\n` +
      `SKILL_VERIFICATION:\n${verificationBlock}\n` +
      `QUALITY_CONTRACT_REF: ${params.qualityContractRef}`,
  };
}

export interface MaterializeBaselineSoftwareArchitectureTaskParams {
  baseDefinition: AgentDefinition;
  input: SoftwareArchitectureInput;
  taskId?: string;
}

/**
 * Baseline materialization: embeds only the validated SoftwareArchitectureInput
 * — no S13D Skill is selected or materialized. Everything else (base
 * AgentDefinition, ModelProvider class/config, run limits, S09/S10 runtime
 * path) stays identical to the Skill-assisted run; only this function's
 * absence of SKILL_* content differs from materializeSoftwareArchitectureTask().
 */
export function materializeBaselineSoftwareArchitectureTask(
  params: MaterializeBaselineSoftwareArchitectureTaskParams,
): AgentDefinition {
  const input = validateSoftwareArchitectureInput(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\n${SOFTWARE_ARCHITECTURE_INPUT_MARKER}\n${JSON.stringify(input)}`,
  };
}
