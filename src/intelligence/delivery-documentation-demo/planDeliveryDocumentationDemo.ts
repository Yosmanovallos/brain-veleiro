import { randomUUID } from "node:crypto";
import { compileAgentDefinition, runAgent } from "../../core/agent/index.js";
import type { AgentDefinition, AgentRunResult, CapabilityProvider, ModelProvider } from "../../core/agent/index.js";
import type { SkillDefinition, SkillProvider } from "../../core/skill/index.js";
import { selectSkillForTask } from "../skills/selectSkillForTask.js";
import { DELIVERY_DOCUMENTATION_DEMO_INPUT_MARKER, DELIVERY_DOCUMENTATION_DEMO_SKILL_ID } from "./constants.js";
import { evaluateDeliveryCandidateGate, validateDeliveryCandidate } from "./deliveryModel.js";
import type { DeliveryDocumentationDemoInput, DeliveryDocumentationDemoResult } from "./types.js";

export interface DeliveryDocumentationDemoHarness {
  baseDefinition: AgentDefinition;
  skillProvider?: SkillProvider;
  modelProvider: ModelProvider;
  capabilityProvider: CapabilityProvider;
}

export interface PlanDeliveryDocumentationDemoOutcome {
  candidate: unknown;
  decision: DeliveryDocumentationDemoResult;
  run: AgentRunResult;
  decisionValidation: ReturnType<typeof validateDeliveryCandidate>;
  skillLoaded: boolean;
  materializedDefinition: AgentDefinition;
  visiblePacket: DeliveryDocumentationDemoInput;
  inputSnapshotBefore: string;
  inputSnapshotAfter: string;
}

const task = "compile one bounded evidence-grounded delivery documentation and demo package for a completed build";

function materialize(base: AgentDefinition, input: DeliveryDocumentationDemoInput, skill?: SkillDefinition): AgentDefinition {
  const prose = skill?.rules.map((r) => r.statement).join("\n") ?? "";
  return {
    ...structuredClone(base),
    id: `${base.id}-s13q-${randomUUID()}`,
    objective: `${base.objective}\n${DELIVERY_DOCUMENTATION_DEMO_INPUT_MARKER}\n${JSON.stringify(input)}${prose ? `\n${prose}` : ""}`,
  };
}

export async function planDeliveryDocumentationDemo(
  input: DeliveryDocumentationDemoInput,
  harness: DeliveryDocumentationDemoHarness,
): Promise<PlanDeliveryDocumentationDemoOutcome> {
  const before = JSON.stringify(input);
  let skill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length) {
    const selected = await selectSkillForTask({ task, agent_definition: harness.baseDefinition, provider: harness.skillProvider });
    if (selected.loaded?.id !== DELIVERY_DOCUMENTATION_DEMO_SKILL_ID) throw new Error("S12 did not load the S13Q Skill");
    skill = selected.loaded;
  }
  const materializedDefinition = materialize(harness.baseDefinition, input, skill);
  const compiled = compileAgentDefinition(materializedDefinition, {
    model_provider: harness.modelProvider,
    capability_provider: harness.capabilityProvider,
  });
  const run = await runAgent(compiled.run_options);
  const candidate = run.outcome === "SUCCESS" ? run.output?.data : undefined;
  const decisionValidation = validateDeliveryCandidate(candidate, input);
  const gate = evaluateDeliveryCandidateGate(input, candidate);
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
