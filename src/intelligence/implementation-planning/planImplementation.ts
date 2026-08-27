import { randomUUID } from "node:crypto";
import type {
  AgentDefinition,
  AgentRunResult,
  CapabilityProvider,
  ModelProvider,
} from "../../core/agent/index.js";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import {
  IMPLEMENTATION_PLANNING_INPUT_MARKER,
  IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
  IMPLEMENTATION_PLANNING_SKILL_ID,
  IMPLEMENTATION_PLANNING_SKILL_MATERIALIZATION_MARKER,
} from "./constants.js";
import type { ImplementationPlanResult, ImplementationPlanningInput } from "./types.js";
import { validatePlanningInput } from "./validatePlanningInput.js";

/**
 * Brain — S13F Skill execution bridge.
 *
 * Implements brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md
 * sections 7-8. S13F is `SKILL_ONLY`: this module NEVER defines, selects,
 * catalogues, or activates a new implementation-planning AgentDefinition. The
 * CALLER injects a compatible existing AgentDefinition / runtime harness whose
 * `skills` allowlist admits the S13F Skill; this bridge only:
 *
 *   selectSkillForTask()  (S12 metadata-only discovery + lazy load)
 *   -> materialize a task-specific instance of the caller's base definition
 *   -> compileAgentDefinition()  (unchanged S10)
 *   -> runAgent()  (unchanged S09)
 *   -> parse the structured ImplementationPlanResult from the run output
 *
 * It deliberately does NOT validate the plan — `validateImplementationPlan()`
 * is called separately by callers/tests, mirroring S13A-S13E.
 *
 * `../agent-definitions/` is intentionally NOT imported here.
 */

export interface ImplementationPlanningHarness {
  /** A caller-supplied compatible AgentDefinition whose `skills` allowlist admits the S13F Skill. */
  baseDefinition: AgentDefinition;
  skillProvider: SkillProvider;
  modelProvider: ModelProvider;
  capabilityProvider: CapabilityProvider;
  /** Free-text selection task passed to S12 discovery. */
  selectionTask?: string;
  qualityContractRef?: string;
}

export interface PlanImplementationOutcome {
  result: ImplementationPlanResult;
  run: AgentRunResult;
  skillLoaded: boolean;
  /** The materialized task-specific AgentDefinition actually compiled and run. */
  materializedDefinition: AgentDefinition;
}

const DEFAULT_SELECTION_TASK =
  "implementation planning convert an approved spec and architecture into P0 P1 P2 scope milestones small verifiable tasks static dependencies acceptance evidence";

function rulesBlocks(skill: SkillDefinition): string {
  const rulesBlock = skill.rules.map((r) => `- [${r.level}] ${r.id}: ${r.statement}`).join("\n");
  const procedureBlock = skill.procedure.map((p) => `- ${p.id} ${p.title}: ${p.instruction}`).join("\n");
  const verificationBlock = skill.verification.map((v) => `- ${v.id} (${v.kind}): ${v.criterion}`).join("\n");
  return (
    `${IMPLEMENTATION_PLANNING_SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
    `SKILL_DESCRIPTION: ${skill.description}\n` +
    `SKILL_RULES:\n${rulesBlock}\n` +
    `SKILL_PROCEDURE:\n${procedureBlock}\n` +
    `SKILL_VERIFICATION:\n${verificationBlock}\n`
  );
}

/** Skill-assisted materialization (embeds the input + the selected Skill body). */
export function materializePlanningTask(params: {
  baseDefinition: AgentDefinition;
  input: ImplementationPlanningInput;
  loadedSkill: SkillDefinition;
  qualityContractRef: string;
  taskId?: string;
}): AgentDefinition {
  const input = validatePlanningInput(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-task-${randomUUID()}`;
  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective:
      `${params.baseDefinition.objective}\n\n` +
      `${IMPLEMENTATION_PLANNING_INPUT_MARKER}\n${JSON.stringify(input)}\n\n` +
      `${rulesBlocks(params.loadedSkill)}` +
      `QUALITY_CONTRACT_REF: ${params.qualityContractRef}`,
  };
}

/** Baseline materialization (embeds ONLY the input — no S13F Skill body). */
export function materializeBaselinePlanningTask(params: {
  baseDefinition: AgentDefinition;
  input: ImplementationPlanningInput;
  taskId?: string;
}): AgentDefinition {
  const input = validatePlanningInput(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;
  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\n${IMPLEMENTATION_PLANNING_INPUT_MARKER}\n${JSON.stringify(input)}`,
  };
}

function parsePlanFromRun(run: AgentRunResult): ImplementationPlanResult {
  if (run.outcome !== "SUCCESS" || !run.output?.data) {
    throw new Error(
      `S13F run did not SUCCEED with a structured plan (outcome=${run.outcome}, reason=${run.termination.reason_code}).`,
    );
  }
  return run.output.data as unknown as ImplementationPlanResult;
}

/**
 * Run the S13F Skill through the caller's harness and the unchanged generic
 * S12 -> S10 -> S09 path.
 */
export async function planImplementation(
  input: ImplementationPlanningInput,
  harness: ImplementationPlanningHarness,
): Promise<PlanImplementationOutcome> {
  validatePlanningInput(input);

  const selection = await selectSkillForTask({
    task: harness.selectionTask ?? DEFAULT_SELECTION_TASK,
    agent_definition: harness.baseDefinition,
    provider: harness.skillProvider,
  });
  if (!selection.loaded || selection.loaded.id !== IMPLEMENTATION_PLANNING_SKILL_ID) {
    throw new Error(
      `S12 discovery did not select/load the S13F Skill '${IMPLEMENTATION_PLANNING_SKILL_ID}' for the supplied base definition.`,
    );
  }

  const materializedDefinition = materializePlanningTask({
    baseDefinition: harness.baseDefinition,
    input,
    loadedSkill: selection.loaded,
    qualityContractRef: harness.qualityContractRef ?? IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
  });

  const compiled = compileAgentDefinition(materializedDefinition, {
    model_provider: harness.modelProvider,
    capability_provider: harness.capabilityProvider,
  });
  const run = await runAgent(compiled.run_options);

  return { result: parsePlanFromRun(run), run, skillLoaded: true, materializedDefinition };
}

/** Run the no-Skill baseline arm through the identical generic runtime path. */
export async function planImplementationBaseline(
  input: ImplementationPlanningInput,
  harness: Omit<ImplementationPlanningHarness, "skillProvider" | "selectionTask">,
): Promise<PlanImplementationOutcome> {
  validatePlanningInput(input);
  const materializedDefinition = materializeBaselinePlanningTask({ baseDefinition: harness.baseDefinition, input });
  const compiled = compileAgentDefinition(materializedDefinition, {
    model_provider: harness.modelProvider,
    capability_provider: harness.capabilityProvider,
  });
  const run = await runAgent(compiled.run_options);
  return { result: parsePlanFromRun(run), run, skillLoaded: false, materializedDefinition };
}
