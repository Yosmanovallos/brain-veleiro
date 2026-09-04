import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { AgentDefinition, ModelProvider, CapabilityProvider } from "../../core/agent/index.js";
import type { SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { DEPLOYMENT_INPUT_MARKER, DEPLOYMENT_SKILL_ID } from "./constants.js";
import { blockedDecision, evaluateDeploymentCandidateGate, validateDeploymentInput } from "./deploymentModel.js";
import type { DeploymentInput } from "./types.js";
export interface DeploymentHarness { baseDefinition: AgentDefinition; skillProvider?: SkillProvider; modelProvider: ModelProvider; capabilityProvider: CapabilityProvider }
export async function planDeployment(input: DeploymentInput, harness: DeploymentHarness) {
  const invalid = validateDeploymentInput(input);
  // Invalid/secret input must never enter a model prompt or run trace.
  if (invalid.length) return { candidate: undefined, decision: blockedDecision(invalid), validation: { valid: false, errors: invalid }, skillLoaded: false, run: null };
  const frozen = structuredClone(input);
  let prose = "", skillLoaded = false;
  if (harness.skillProvider && harness.baseDefinition.skills.length) {
    const selected = await selectSkillForTask({ task: "deployment readiness Docker environment health evidence", agent_definition: harness.baseDefinition, provider: harness.skillProvider });
    if (selected.loaded?.id !== DEPLOYMENT_SKILL_ID) throw new Error("S12 did not load the deployment Skill");
    prose = selected.loaded.rules.map(r => r.statement).join("\n"); skillLoaded = true;
  }
  const definition: AgentDefinition = { ...structuredClone(harness.baseDefinition), objective: `${harness.baseDefinition.objective}\n${DEPLOYMENT_INPUT_MARKER}\n${JSON.stringify(frozen)}\n${prose}` };
  const compiled = compileAgentDefinition(definition, { model_provider: harness.modelProvider, capability_provider: harness.capabilityProvider });
  const run = await runAgent(compiled.run_options);
  const candidate = run.outcome === "SUCCESS" ? run.output?.data : undefined;
  const gate = evaluateDeploymentCandidateGate(frozen, candidate);
  return { candidate, ...gate, skillLoaded, run };
}
