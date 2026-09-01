import { randomUUID } from "node:crypto";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { OBSERVABILITY_INPUT_MARKER, OBSERVABILITY_SKILL_ID } from "./constants.js";
import {
  evaluateObservabilityCandidateGate,
  validateObservabilityBundleCandidate,
} from "./quality.js";
import type { ObservabilityBuildInput, ObservabilityBuildResult } from "./types.js";

export interface ObservabilityHarness {
  baseDefinition: AgentDefinition;
  skillProvider?: SkillProvider;
  modelProvider: ModelProvider;
  capabilityProvider: CapabilityProvider;
}

export interface PlanObservabilityOutcome {
  candidate: unknown;
  decision: ObservabilityBuildResult;
  run: AgentRunResult;
  decisionValidation: ReturnType<typeof validateObservabilityBundleCandidate>;
  skillLoaded: boolean;
  materializedDefinition: AgentDefinition;
  visiblePacket: ObservabilityBuildInput;
  inputSnapshotBefore: string;
  inputSnapshotAfter: string;
}

const task = "project one already-observed AI-system run into a bounded, privacy-safe observability bundle";

function materialize(base: AgentDefinition, input: ObservabilityBuildInput, skill?: SkillDefinition): AgentDefinition {
  const prose = skill?.rules.map((r) => r.statement).join("\n") ?? "";
  return {
    ...structuredClone(base),
    id: `${base.id}-s13p-${randomUUID()}`,
    objective: `${base.objective}\n${OBSERVABILITY_INPUT_MARKER}\n${JSON.stringify(input)}${prose ? `\n${prose}` : ""}`,
  };
}

export async function planObservability(
  input: ObservabilityBuildInput,
  harness: ObservabilityHarness,
): Promise<PlanObservabilityOutcome> {
  const before = JSON.stringify(input);
  let skill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length) {
    const selected = await selectSkillForTask({ task, agent_definition: harness.baseDefinition, provider: harness.skillProvider });
    if (selected.loaded?.id !== OBSERVABILITY_SKILL_ID) throw new Error("S12 did not load the S13P Skill");
    skill = selected.loaded;
  }
  const materializedDefinition = materialize(harness.baseDefinition, input, skill);
  const compiled = compileAgentDefinition(materializedDefinition, {
    model_provider: harness.modelProvider,
    capability_provider: harness.capabilityProvider,
  });
  const run = await runAgent(compiled.run_options);
  const candidate = run.outcome === "SUCCESS" ? run.output?.data : undefined;
  const decisionValidation = validateObservabilityBundleCandidate(candidate, input);
  const gate = evaluateObservabilityCandidateGate(input, candidate);
  return {
    candidate,
    decision: gate.decision,
    run,
    decisionValidation,
    skillLoaded: Boolean(skill),
    materializedDefinition,
    visiblePacket: input,
    inputSnapshotBefore: before,
    inputSnapshotAfter: JSON.stringify(input),
  };
}
