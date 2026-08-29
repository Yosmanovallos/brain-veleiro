import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { QA_DEBUGGING_INPUT_MARKER, QA_DEBUGGING_SKILL_ID, QA_DEBUGGING_SKILL_MARKER } from "./constants.js";
import { gateQaDebuggingCandidate } from "./modeling.js";
import type { QaDebuggingDecision, QaDebuggingInput, QaDebuggingValidationResult } from "./types.js";

export interface QaDebuggingHarness { baseDefinition: AgentDefinition; skillProvider?: SkillProvider; modelProvider: ModelProvider; capabilityProvider: CapabilityProvider; selectionTask?: string; }
export interface PlanQaDebuggingOutcome { decision: QaDebuggingDecision; candidate: unknown; run: AgentRunResult; skillLoaded: boolean; materializedDefinition: AgentDefinition; decisionValidation: QaDebuggingValidationResult; }
const DEFAULT_TASK = "qa debugging reproduce evidence root cause minimal fix regression relevant suite";
const body = (skill: SkillDefinition): string => `${QA_DEBUGGING_SKILL_MARKER}\n${skill.rules.map((r) => r.statement).join("\n")}\n${skill.procedure.map((p) => p.instruction).join("\n")}`;
export function materializeQaDebuggingTask(params: { baseDefinition: AgentDefinition; input: QaDebuggingInput; loadedSkill: SkillDefinition; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-s13m-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${QA_DEBUGGING_INPUT_MARKER}\n${JSON.stringify(params.input)}\n\n${body(params.loadedSkill)}` }; }
export function materializeBaselineQaDebuggingTask(params: { baseDefinition: AgentDefinition; input: QaDebuggingInput; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${QA_DEBUGGING_INPUT_MARKER}\n${JSON.stringify(params.input)}` }; }
function parseActualCandidate(run: AgentRunResult): unknown { return run.outcome === "SUCCESS" ? run.output?.data : undefined; }
export async function planQaDebugging(input: QaDebuggingInput, harness: QaDebuggingHarness): Promise<PlanQaDebuggingOutcome> {
  let loaded: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length) { const selected = await selectSkillForTask({ task: harness.selectionTask ?? DEFAULT_TASK, agent_definition: harness.baseDefinition, provider: harness.skillProvider }); if (selected.loaded?.id !== QA_DEBUGGING_SKILL_ID) throw new Error(`S12 did not select/load '${QA_DEBUGGING_SKILL_ID}'.`); loaded = selected.loaded; }
  const materializedDefinition = loaded ? materializeQaDebuggingTask({ baseDefinition: harness.baseDefinition, input, loadedSkill: loaded }) : materializeBaselineQaDebuggingTask({ baseDefinition: harness.baseDefinition, input });
  const compiled = compileAgentDefinition(materializedDefinition, { model_provider: harness.modelProvider, capability_provider: harness.capabilityProvider }); const run = await runAgent(compiled.run_options); const candidate = parseActualCandidate(run); const gated = gateQaDebuggingCandidate(input, candidate);
  return { ...gated, run, skillLoaded: Boolean(loaded), materializedDefinition };
}
