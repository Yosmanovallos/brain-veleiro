import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { POSTGRES_DATA_MODELING_INPUT_MARKER, POSTGRES_DATA_MODELING_SKILL_ID, POSTGRES_DATA_MODELING_SKILL_MARKER } from "./constants.js";
import { validatePostgresDataModelingDecision } from "./modeling.js";
import type { PostgresDataModelingDecision, PostgresDataModelingInput, PostgresValidationResult } from "./types.js";

export interface PostgresDataModelingHarness { baseDefinition: AgentDefinition; skillProvider?: SkillProvider; modelProvider: ModelProvider; capabilityProvider: CapabilityProvider; selectionTask?: string; }
export interface PlanPostgresDataModelingOutcome { decision: PostgresDataModelingDecision; candidate: PostgresDataModelingDecision; run: AgentRunResult; skillLoaded: boolean; materializedDefinition: AgentDefinition; decisionValidation: PostgresValidationResult; }
const DEFAULT_TASK = "postgres data modeling schema keys relationships constraints indexes queries transactions migrations";
function skillBody(skill: SkillDefinition): string { return `${POSTGRES_DATA_MODELING_SKILL_MARKER}\n${skill.rules.map((r) => r.statement).join("\n")}\n${skill.procedure.map((p) => p.instruction).join("\n")}`; }
export function materializePostgresDataModelingTask(params: { baseDefinition: AgentDefinition; input: PostgresDataModelingInput; loadedSkill: SkillDefinition; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-s13j-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${POSTGRES_DATA_MODELING_INPUT_MARKER}\n${JSON.stringify(params.input)}\n\n${skillBody(params.loadedSkill)}` }; }
export function materializeBaselinePostgresDataModelingTask(params: { baseDefinition: AgentDefinition; input: PostgresDataModelingInput; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${POSTGRES_DATA_MODELING_INPUT_MARKER}\n${JSON.stringify(params.input)}` }; }
function parseCandidate(run: AgentRunResult): PostgresDataModelingDecision { if (run.outcome !== "SUCCESS" || !run.output?.data) throw new Error(`S13J run produced no structured decision (${run.outcome}).`); return run.output.data as unknown as PostgresDataModelingDecision; }
export function gatePostgresDataModeling(input: PostgresDataModelingInput, candidate: PostgresDataModelingDecision) { const decisionValidation = validatePostgresDataModelingDecision(candidate, input); const decision = structuredClone(candidate); if (!decisionValidation.valid) { decision.status = "BLOCKED"; decision.blockers = [...decisionValidation.errors]; } return { decision, decisionValidation }; }
export async function planPostgresDataModeling(input: PostgresDataModelingInput, harness: PostgresDataModelingHarness): Promise<PlanPostgresDataModelingOutcome> {
  let loadedSkill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length) { const selection = await selectSkillForTask({ task: harness.selectionTask ?? DEFAULT_TASK, agent_definition: harness.baseDefinition, provider: harness.skillProvider }); if (selection.loaded?.id !== POSTGRES_DATA_MODELING_SKILL_ID) throw new Error(`S12 did not select/load '${POSTGRES_DATA_MODELING_SKILL_ID}'.`); loadedSkill = selection.loaded; }
  const materializedDefinition = loadedSkill ? materializePostgresDataModelingTask({ baseDefinition: harness.baseDefinition, input, loadedSkill }) : materializeBaselinePostgresDataModelingTask({ baseDefinition: harness.baseDefinition, input });
  const compiled = compileAgentDefinition(materializedDefinition, { model_provider: harness.modelProvider, capability_provider: harness.capabilityProvider });
  const run = await runAgent(compiled.run_options); const candidate = parseCandidate(run); const gated = gatePostgresDataModeling(input, candidate);
  return { ...gated, candidate, run, skillLoaded: Boolean(loadedSkill), materializedDefinition };
}
