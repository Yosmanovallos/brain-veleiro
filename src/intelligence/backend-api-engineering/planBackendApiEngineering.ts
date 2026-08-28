import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import {
  BACKEND_API_ENGINEERING_INPUT_MARKER,
  BACKEND_API_ENGINEERING_SKILL_ID,
  BACKEND_API_ENGINEERING_SKILL_MATERIALIZATION_MARKER,
} from "./constants.js";
import { validateBackendApiEngineeringDecision } from "./validateBackendApiEngineeringDecision.js";
import type { BackendApiEngineeringDecision, BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export interface BackendApiEngineeringHarness {
  baseDefinition: AgentDefinition;
  skillProvider?: SkillProvider;
  modelProvider: ModelProvider;
  capabilityProvider: CapabilityProvider;
  selectionTask?: string;
}
export interface PlanBackendApiEngineeringOutcome {
  decision: BackendApiEngineeringDecision;
  candidate: BackendApiEngineeringDecision;
  run: AgentRunResult;
  skillLoaded: boolean;
  materializedDefinition: AgentDefinition;
  decisionValidation: BackendApiValidationResult;
}

const DEFAULT_TASK = "backend api engineering request auth service data port response error observability compatibility";
function skillBody(skill: SkillDefinition): string {
  return `${BACKEND_API_ENGINEERING_SKILL_MATERIALIZATION_MARKER}\n${skill.rules.map((r) => r.statement).join("\n")}\n${skill.procedure.map((p) => p.instruction).join("\n")}`;
}
export function materializeBackendApiEngineeringTask(params: { baseDefinition: AgentDefinition; input: BackendApiEngineeringInput; loadedSkill: SkillDefinition; taskId?: string }): AgentDefinition {
  return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-s13i-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${BACKEND_API_ENGINEERING_INPUT_MARKER}\n${JSON.stringify(params.input)}\n\n${skillBody(params.loadedSkill)}` };
}
export function materializeBaselineBackendApiEngineeringTask(params: { baseDefinition: AgentDefinition; input: BackendApiEngineeringInput; taskId?: string }): AgentDefinition {
  return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${BACKEND_API_ENGINEERING_INPUT_MARKER}\n${JSON.stringify(params.input)}` };
}
function parseCandidate(run: AgentRunResult): BackendApiEngineeringDecision {
  if (run.outcome !== "SUCCESS" || !run.output?.data) throw new Error(`S13I run did not produce a structured decision (${run.outcome}).`);
  return run.output.data as unknown as BackendApiEngineeringDecision;
}
export function gateBackendApiEngineering(
  input: BackendApiEngineeringInput,
  candidate: BackendApiEngineeringDecision,
) {
  const decisionValidation = validateBackendApiEngineeringDecision(candidate, input);
  const decision = structuredClone(candidate);

  // The gate preserves the actual parsed candidate and only recomputes the
  // terminal gate fields. It must never substitute a separately synthesized
  // faithful answer for a model candidate that failed deterministic checks.
  if (!decisionValidation.valid) {
    decision.status = "BLOCKED";
    decision.blockers = [...decisionValidation.errors];
  }

  return { decision, decisionValidation };
}
export async function planBackendApiEngineering(input: BackendApiEngineeringInput, harness: BackendApiEngineeringHarness): Promise<PlanBackendApiEngineeringOutcome> {
  let loadedSkill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length > 0) {
    const selection = await selectSkillForTask({ task: harness.selectionTask ?? DEFAULT_TASK, agent_definition: harness.baseDefinition, provider: harness.skillProvider });
    if (selection.loaded?.id !== BACKEND_API_ENGINEERING_SKILL_ID) throw new Error(`S12 did not select/load '${BACKEND_API_ENGINEERING_SKILL_ID}'.`);
    loadedSkill = selection.loaded;
  }
  const materializedDefinition = loadedSkill
    ? materializeBackendApiEngineeringTask({ baseDefinition: harness.baseDefinition, input, loadedSkill })
    : materializeBaselineBackendApiEngineeringTask({ baseDefinition: harness.baseDefinition, input });
  const compiled = compileAgentDefinition(materializedDefinition, { model_provider: harness.modelProvider, capability_provider: harness.capabilityProvider });
  const run = await runAgent(compiled.run_options);
  const candidate = parseCandidate(run);
  const gated = gateBackendApiEngineering(input, candidate);
  return { ...gated, candidate, run, skillLoaded: Boolean(loadedSkill), materializedDefinition };
}
