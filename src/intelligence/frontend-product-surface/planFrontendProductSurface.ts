import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { FRONTEND_PRODUCT_SURFACE_INPUT_MARKER, FRONTEND_PRODUCT_SURFACE_SKILL_ID, FRONTEND_PRODUCT_SURFACE_SKILL_MARKER } from "./constants.js";
import { gateFrontendProductSurface } from "./modeling.js";
import type { FrontendProductSurfaceDecision, FrontendProductSurfaceInput, FrontendSurfaceValidationResult } from "./types.js";

export interface FrontendProductSurfaceHarness { baseDefinition: AgentDefinition; skillProvider?: SkillProvider; modelProvider: ModelProvider; capabilityProvider: CapabilityProvider; selectionTask?: string; }
export interface PlanFrontendProductSurfaceOutcome { decision: FrontendProductSurfaceDecision; candidate: FrontendProductSurfaceDecision; run: AgentRunResult; skillLoaded: boolean; materializedDefinition: AgentDefinition; decisionValidation: FrontendSurfaceValidationResult; }
const DEFAULT_TASK = "frontend product surface user flow loading empty error form retry approval rejection accessibility responsive";
function skillBody(skill: SkillDefinition): string { return `${FRONTEND_PRODUCT_SURFACE_SKILL_MARKER}\n${skill.rules.map((rule) => rule.statement).join("\n")}\n${skill.procedure.map((step) => step.instruction).join("\n")}`; }
export function materializeFrontendProductSurfaceTask(params: { baseDefinition: AgentDefinition; input: FrontendProductSurfaceInput; loadedSkill: SkillDefinition; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-s13k-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${FRONTEND_PRODUCT_SURFACE_INPUT_MARKER}\n${JSON.stringify(params.input)}\n\n${skillBody(params.loadedSkill)}` }; }
export function materializeBaselineFrontendProductSurfaceTask(params: { baseDefinition: AgentDefinition; input: FrontendProductSurfaceInput; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${FRONTEND_PRODUCT_SURFACE_INPUT_MARKER}\n${JSON.stringify(params.input)}` }; }
function parseCandidate(run: AgentRunResult): FrontendProductSurfaceDecision { if (run.outcome !== "SUCCESS" || !run.output?.data) throw new Error(`S13K run produced no structured decision (${run.outcome}).`); return run.output.data as unknown as FrontendProductSurfaceDecision; }
export async function planFrontendProductSurface(input: FrontendProductSurfaceInput, harness: FrontendProductSurfaceHarness): Promise<PlanFrontendProductSurfaceOutcome> {
  let loadedSkill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length) { const selection = await selectSkillForTask({ task: harness.selectionTask ?? DEFAULT_TASK, agent_definition: harness.baseDefinition, provider: harness.skillProvider }); if (selection.loaded?.id !== FRONTEND_PRODUCT_SURFACE_SKILL_ID) throw new Error(`S12 did not select/load '${FRONTEND_PRODUCT_SURFACE_SKILL_ID}'.`); loadedSkill = selection.loaded; }
  const materializedDefinition = loadedSkill ? materializeFrontendProductSurfaceTask({ baseDefinition: harness.baseDefinition, input, loadedSkill }) : materializeBaselineFrontendProductSurfaceTask({ baseDefinition: harness.baseDefinition, input });
  const compiled = compileAgentDefinition(materializedDefinition, { model_provider: harness.modelProvider, capability_provider: harness.capabilityProvider }); const run = await runAgent(compiled.run_options); const candidate = parseCandidate(run); const gated = gateFrontendProductSurface(input, candidate); return { ...gated, candidate, run, skillLoaded: Boolean(loadedSkill), materializedDefinition };
}
