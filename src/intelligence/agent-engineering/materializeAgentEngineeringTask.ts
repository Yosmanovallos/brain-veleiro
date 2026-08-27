import { randomUUID } from "node:crypto";
import type { AgentDefinition } from "../../core/agent/index.js";
import type { SkillDefinition } from "../../core/skill/index.js";
import type { AgentEngineeringInput } from "./types.js";

/**
 * S13E Intelligence-layer Skill materialization bridge.
 *
 * Implements brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections 5-6,
 * 29, mirroring src/intelligence/software-architecture/materializeSoftwareArchitectureTask.ts.
 * This bridge is deliberately narrow: it only ever materializes the one
 * selected S13E Skill against a base agent-engineer AgentDefinition and a
 * current AgentEngineeringInput. It never branches on `role` or `skill.id`,
 * performs no registry discovery itself (S12's job, exercised by the caller
 * via selectSkillForTask()/SkillProvider before this function runs), and is
 * not a generic agent-design workflow engine.
 *
 * The materialized objective may include only: the input; for the
 * Skill-assisted variant, the selected Skill's description/rules/procedure/
 * verification; and the Quality Contract reference. It must never include the
 * full Agent catalog, the full Skill catalog, a Capability Registry, a
 * historical session corpus, provider/model configuration, or a fixture-truth
 * object (Agent spec section 29, AE-R26).
 *
 * These marker strings are a stable, parseable contract with the
 * ModelProvider that consumes the materialized objective (see
 * tests/agent-engineering/fixtures.ts) — not prose for a human reader.
 */

export const AGENT_ENGINEERING_INPUT_MARKER = "AGENT_ENGINEERING_INPUT:";
export const AGENT_ENGINEERING_SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";

const MAX_AVAILABLE_AGENTS = 10;
const MAX_AVAILABLE_SKILL_IDS = 20;
const MAX_AVAILABLE_CAPABILITIES = 20;

function isNonEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value as object).length > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Agent spec sections 5-6, Skill file section 4 — bounded input-contract
 * validation. Exported so it can be exercised directly by tests (T10)
 * independent of the full Agent runtime, mirroring S13D's
 * validateSoftwareArchitectureInput().
 *
 * This throws only for structural defects. A required capability that is
 * simply absent from `available_capabilities` is NOT a throw — Agent spec
 * sections 15/36 make that the canonical BLOCKED pipeline result (design ==
 * null), not an input rejection; see the S13E verification report's T10/T15
 * reconciliation note.
 */
export function validateAgentEngineeringInput(input: AgentEngineeringInput | undefined): AgentEngineeringInput {
  if (!input?.work_unit) {
    throw new Error("AgentEngineeringInput.work_unit is required (Agent spec section 5).");
  }
  const wu = input.work_unit;

  if (!wu.id?.trim()) throw new Error("AgentEngineeringInput.work_unit.id must be a non-empty string.");
  if (!wu.task_kind?.trim()) throw new Error("AgentEngineeringInput.work_unit.task_kind must be a non-empty string.");
  if (!wu.goal?.trim()) throw new Error("AgentEngineeringInput.work_unit.goal must be a non-empty string (Skill file section 5).");
  if (!isNonEmptyObject(wu.expected_output_schema)) {
    throw new Error("AgentEngineeringInput.work_unit.expected_output_schema must be a non-empty JsonSchemaLike object (AE-R20).");
  }
  if (!wu.quality_contract_ref?.trim()) {
    throw new Error("AgentEngineeringInput.work_unit.quality_contract_ref must be a non-empty string (AE-R20).");
  }
  if (!wu.behavior || typeof wu.behavior !== "object") {
    throw new Error("AgentEngineeringInput.work_unit.behavior (AgentBehaviorSignals) is required (Skill file section 6).");
  }
  for (const flag of [
    "fixed_steps_known_in_advance",
    "semantic_judgment_required",
    "next_action_depends_on_observation",
    "requires_conditional_capability_use",
    "requires_retry_or_replan",
    "requires_within_run_state",
    "requires_cross_run_history",
  ] as const) {
    if (typeof wu.behavior[flag] !== "boolean") {
      throw new Error(`AgentEngineeringInput.work_unit.behavior.${flag} must be a boolean.`);
    }
  }

  if (hasDuplicates(wu.required_capability_ids)) {
    throw new Error("AgentEngineeringInput.work_unit.required_capability_ids must not contain duplicate IDs.");
  }
  if (hasDuplicates([...wu.required_capability_ids, ...wu.optional_capability_ids])) {
    throw new Error("AgentEngineeringInput.work_unit required/optional capability IDs must not overlap or duplicate.");
  }

  if (input.available_agents.length > MAX_AVAILABLE_AGENTS) {
    throw new Error(`AgentEngineeringInput.available_agents must contain at most ${MAX_AVAILABLE_AGENTS} entries (Skill file section 4).`);
  }
  if (input.available_skill_ids.length > MAX_AVAILABLE_SKILL_IDS) {
    throw new Error(`AgentEngineeringInput.available_skill_ids must contain at most ${MAX_AVAILABLE_SKILL_IDS} entries.`);
  }
  if (input.available_capabilities.length > MAX_AVAILABLE_CAPABILITIES) {
    throw new Error(`AgentEngineeringInput.available_capabilities must contain at most ${MAX_AVAILABLE_CAPABILITIES} entries.`);
  }
  if (hasDuplicates(input.available_capabilities.map((c) => c.id))) {
    throw new Error("AgentEngineeringInput.available_capabilities IDs must be unique.");
  }
  if (hasDuplicates(input.available_skill_ids)) {
    throw new Error("AgentEngineeringInput.available_skill_ids must be unique.");
  }

  return input;
}

export interface MaterializeAgentEngineeringTaskParams {
  baseDefinition: AgentDefinition;
  input: AgentEngineeringInput;
  loadedSkill: SkillDefinition;
  qualityContractRef: string;
  taskId?: string;
}

/**
 * Skill-assisted materialization: embeds the validated AgentEngineeringInput
 * plus the selected Skill's description/rules/procedure/verification and the
 * Quality Contract reference into a task-specific AgentDefinition objective.
 */
export function materializeAgentEngineeringTask(params: MaterializeAgentEngineeringTaskParams): AgentDefinition {
  const input = validateAgentEngineeringInput(params.input);
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
      `${AGENT_ENGINEERING_INPUT_MARKER}\n${JSON.stringify(input)}\n\n` +
      `${AGENT_ENGINEERING_SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
      `SKILL_DESCRIPTION: ${skill.description}\n` +
      `SKILL_RULES:\n${rulesBlock}\n` +
      `SKILL_PROCEDURE:\n${procedureBlock}\n` +
      `SKILL_VERIFICATION:\n${verificationBlock}\n` +
      `QUALITY_CONTRACT_REF: ${params.qualityContractRef}`,
  };
}

export interface MaterializeBaselineAgentEngineeringTaskParams {
  baseDefinition: AgentDefinition;
  input: AgentEngineeringInput;
  taskId?: string;
}

/**
 * Baseline materialization: embeds only the validated AgentEngineeringInput —
 * no S13E Skill is selected or materialized. Everything else (base
 * AgentDefinition, ModelProvider class/config, run limits, S09/S10 runtime
 * path) stays identical to the Skill-assisted run; only this function's
 * absence of SKILL_* content differs from materializeAgentEngineeringTask().
 */
export function materializeBaselineAgentEngineeringTask(params: MaterializeBaselineAgentEngineeringTaskParams): AgentDefinition {
  const input = validateAgentEngineeringInput(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\n${AGENT_ENGINEERING_INPUT_MARKER}\n${JSON.stringify(input)}`,
  };
}
