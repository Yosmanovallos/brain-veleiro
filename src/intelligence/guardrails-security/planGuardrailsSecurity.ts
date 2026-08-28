import { randomUUID } from "node:crypto";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { GUARDRAILS_SECURITY_INPUT_MARKER, GUARDRAILS_SECURITY_SKILL_ID, GUARDRAILS_SECURITY_SKILL_MARKER } from "./constants.js";
import { gateGuardrailsSecurity } from "./modeling.js";
import type { GuardrailsSecurityDecision, GuardrailsSecurityInput, GuardrailsSecurityValidationResult } from "./types.js";

export interface GuardrailsSecurityHarness { baseDefinition: AgentDefinition; skillProvider?: SkillProvider; modelProvider: ModelProvider; capabilityProvider: CapabilityProvider; selectionTask?: string; }
export interface PlanGuardrailsSecurityOutcome { decision: GuardrailsSecurityDecision; candidate: GuardrailsSecurityDecision; run: AgentRunResult; skillLoaded: boolean; materializedDefinition: AgentDefinition; decisionValidation: GuardrailsSecurityValidationResult; }
const DEFAULT_TASK = "guardrails security authentication authorization tenant scope capability permission approval destructive action secrets injection sensitive data enforcement";
function skillBody(skill: SkillDefinition): string { return `${GUARDRAILS_SECURITY_SKILL_MARKER}\n${skill.rules.map((rule) => rule.statement).join("\n")}\n${skill.procedure.map((step) => step.instruction).join("\n")}`; }
export function materializeGuardrailsSecurityTask(params: { baseDefinition: AgentDefinition; input: GuardrailsSecurityInput; loadedSkill: SkillDefinition; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-s13l-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${GUARDRAILS_SECURITY_INPUT_MARKER}\n${JSON.stringify(params.input)}\n\n${skillBody(params.loadedSkill)}` }; }
export function materializeBaselineGuardrailsSecurityTask(params: { baseDefinition: AgentDefinition; input: GuardrailsSecurityInput; taskId?: string }): AgentDefinition { return { ...structuredClone(params.baseDefinition), id: params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`, objective: `${params.baseDefinition.objective}\n\n${GUARDRAILS_SECURITY_INPUT_MARKER}\n${JSON.stringify(params.input)}` }; }
function parseCandidate(run: AgentRunResult): GuardrailsSecurityDecision { if (run.outcome !== "SUCCESS" || !run.output?.data) throw new Error(`S13L run produced no structured decision (${run.outcome}).`); return run.output.data as unknown as GuardrailsSecurityDecision; }
export async function planGuardrailsSecurity(input: GuardrailsSecurityInput, harness: GuardrailsSecurityHarness): Promise<PlanGuardrailsSecurityOutcome> {
  let loadedSkill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length) { const selection = await selectSkillForTask({ task: harness.selectionTask ?? DEFAULT_TASK, agent_definition: harness.baseDefinition, provider: harness.skillProvider }); if (selection.loaded?.id !== GUARDRAILS_SECURITY_SKILL_ID) throw new Error(`S12 did not select/load '${GUARDRAILS_SECURITY_SKILL_ID}'.`); loadedSkill = selection.loaded; }
  const materializedDefinition = loadedSkill ? materializeGuardrailsSecurityTask({ baseDefinition: harness.baseDefinition, input, loadedSkill }) : materializeBaselineGuardrailsSecurityTask({ baseDefinition: harness.baseDefinition, input });
  const compiled = compileAgentDefinition(materializedDefinition, { model_provider: harness.modelProvider, capability_provider: harness.capabilityProvider });
  const run = await runAgent(compiled.run_options); const candidate = parseCandidate(run); const gated = gateGuardrailsSecurity(input, candidate);
  return { ...gated, candidate, run, skillLoaded: Boolean(loadedSkill), materializedDefinition };
}

