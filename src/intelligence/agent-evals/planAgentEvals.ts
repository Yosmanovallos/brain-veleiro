import { randomUUID } from "node:crypto";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { AGENT_EVALS_SKILL_ID } from "./constants.js";
import { gateAgentEvalCandidate, validateAgentEvalCandidate } from "./evaluateAgentEval.js";
import type { AgentEvalDecision, AgentEvalInput, AgentEvalValidationResult } from "./types.js";

export interface AgentEvalsHarness { baseDefinition: AgentDefinition; skillProvider?: SkillProvider; modelProvider: ModelProvider; capabilityProvider: CapabilityProvider; }
export interface PlanAgentEvalsOutcome { candidate: unknown; decision: AgentEvalDecision; candidateValidation: AgentEvalValidationResult; run: AgentRunResult; skillLoaded: boolean; materializedDefinition: AgentDefinition; }
const marker = "[[AGENT_EVALS_VISIBLE_PACKET]]";
const task = "evaluate one already observed agent run with deterministic bounded evidence";
/** The provider-visible packet deliberately omits frozen truth, case id, truth ref, and arm state. */
function visiblePacket(input: AgentEvalInput): Record<string, unknown> { return { task: input.golden_case.task, observed_run: input.observed_run, output_expectation: input.golden_case.output_expectation, tool_expectation: input.golden_case.tool_expectation, safety_expectation: input.golden_case.safety_expectation, efficiency_expectation: input.golden_case.efficiency_expectation }; }
function prose(skill: SkillDefinition): string { return skill.rules.map((rule) => rule.statement).join("\n"); }
function materialize(base: AgentDefinition, input: AgentEvalInput, skill?: SkillDefinition): AgentDefinition { return { ...structuredClone(base), id: `${base.id}-s13n-${randomUUID()}`, objective: `${base.objective}\n${marker}\n${JSON.stringify(visiblePacket(input))}${skill ? `\n\n${prose(skill)}` : ""}` }; }
function parse(run: AgentRunResult): unknown { return run.outcome === "SUCCESS" ? run.output?.data : undefined; }
export async function planAgentEvals(input: AgentEvalInput, harness: AgentEvalsHarness): Promise<PlanAgentEvalsOutcome> {
  let skill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length) { const selected = await selectSkillForTask({ task, agent_definition: harness.baseDefinition, provider: harness.skillProvider }); if (selected.loaded?.id !== AGENT_EVALS_SKILL_ID) throw new Error("S12 did not load S13N agent-evals Skill"); skill = selected.loaded; }
  const materializedDefinition = materialize(harness.baseDefinition, input, skill);
  const compiled = compileAgentDefinition(materializedDefinition, { model_provider: harness.modelProvider, capability_provider: harness.capabilityProvider });
  const run = await runAgent(compiled.run_options); const candidate = parse(run); const candidateValidation = validateAgentEvalCandidate(candidate); const gated = gateAgentEvalCandidate(candidate, input, { provider_truth_blind: true, provider_source_audited: true, subject_exact: true, no_future_stage_pull_forward: true });
  return { decision: gated, candidateValidation, candidate, run, skillLoaded: Boolean(skill), materializedDefinition };
}
