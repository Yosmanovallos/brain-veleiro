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
  REPOSITORY_GIT_WORKFLOW_INPUT_MARKER,
  REPOSITORY_GIT_WORKFLOW_SKILL_ID,
  REPOSITORY_GIT_WORKFLOW_SKILL_MATERIALIZATION_MARKER,
} from "./constants.js";
import {
  FAITHFUL_SYNTHESIS_PROFILE,
  synthesizeRepositoryWorkflowDecision,
} from "./synthesizeRepositoryWorkflowDecision.js";
import {
  validateRepositoryWorkflowDecision,
  type DecisionValidationResult,
} from "./validateRepositoryWorkflowDecision.js";
import type { RepositoryGitWorkflowInput, RepositoryWorkflowDecision } from "./types.js";

/**
 * Brain — S13H Skill execution bridge.
 *
 * S13H is `SKILL_ONLY`: this module NEVER defines, selects, catalogues, or
 * activates a repository-git-workflow AgentDefinition, and it NEVER runs git.
 * The CALLER injects a compatible existing AgentDefinition / runtime harness
 * whose `skills` allowlist admits the S13H Skill; this bridge only:
 *
 *   selectSkillForTask()  (S12 metadata-only discovery + lazy load)
 *   -> materialize a task-specific instance of the caller's base definition
 *   -> compileAgentDefinition()  (unchanged S10)
 *   -> runAgent()  (unchanged S09)
 *   -> parse the candidate RepositoryWorkflowDecision from the run output
 *   -> AUTHORITATIVE deterministic gate (recompute the decision from bounded input)
 *
 * The final `decision` is recomputed here and never trusts the model's
 * `status` / `commit_plan` / `safe_operations`. `../agent-definitions/` is
 * intentionally NOT imported.
 */

export interface RepositoryGitWorkflowHarness {
  baseDefinition: AgentDefinition;
  /** Present for the with-Skill arm; omit for the no-Skill arm. */
  skillProvider?: SkillProvider;
  modelProvider: ModelProvider;
  capabilityProvider: CapabilityProvider;
  selectionTask?: string;
}

export interface PlanRepositoryGitWorkflowOutcome {
  /** Authoritative, fully re-derived decision. */
  decision: RepositoryWorkflowDecision;
  /** The raw model candidate before the authoritative gate (comparison input). */
  candidate: RepositoryWorkflowDecision;
  run: AgentRunResult;
  skillLoaded: boolean;
  materializedDefinition: AgentDefinition;
  decisionValidation: DecisionValidationResult;
}

const DEFAULT_SELECTION_TASK =
  "repository git workflow preflight branch worktree diff commit push handoff no destructive operations safe provider neutral";

function serializeSkillBody(skill: SkillDefinition): string {
  const rulesBlock = skill.rules.map((r) => `- [${r.level}] ${r.id}: ${r.statement}`).join("\n");
  const procedureBlock = skill.procedure.map((p) => `- ${p.id} ${p.title}: ${p.instruction}`).join("\n");
  const verificationBlock = skill.verification.map((v) => `- ${v.id} (${v.kind}): ${v.criterion}`).join("\n");
  return (
    `${REPOSITORY_GIT_WORKFLOW_SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
    `SKILL_DESCRIPTION: ${skill.description}\n` +
    `SKILL_RULES:\n${rulesBlock}\n` +
    `SKILL_PROCEDURE:\n${procedureBlock}\n` +
    `SKILL_VERIFICATION:\n${verificationBlock}\n`
  );
}

export function materializeRepositoryGitWorkflowTask(params: {
  baseDefinition: AgentDefinition;
  input: RepositoryGitWorkflowInput;
  loadedSkill: SkillDefinition;
  taskId?: string;
}): AgentDefinition {
  const taskId = params.taskId ?? `${params.baseDefinition.id}-task-${randomUUID()}`;
  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective:
      `${params.baseDefinition.objective}\n\n` +
      `${REPOSITORY_GIT_WORKFLOW_INPUT_MARKER}\n${JSON.stringify(params.input)}\n\n` +
      `${serializeSkillBody(params.loadedSkill)}`,
  };
}

export function materializeBaselineRepositoryGitWorkflowTask(params: {
  baseDefinition: AgentDefinition;
  input: RepositoryGitWorkflowInput;
  taskId?: string;
}): AgentDefinition {
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;
  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\n${REPOSITORY_GIT_WORKFLOW_INPUT_MARKER}\n${JSON.stringify(params.input)}`,
  };
}

function parseCandidate(run: AgentRunResult): RepositoryWorkflowDecision {
  if (run.outcome !== "SUCCESS" || !run.output?.data) {
    throw new Error(
      `S13H run did not SUCCEED with a structured decision (outcome=${run.outcome}, reason=${run.termination.reason_code}).`,
    );
  }
  return run.output.data as unknown as RepositoryWorkflowDecision;
}

/**
 * Authoritative deterministic gate — never reads `candidate.status` or any
 * candidate plan. Recomputes the whole decision from the bounded input under the
 * FAITHFUL profile and self-checks it with the HI-001..HI-028 validator.
 */
export function gateRepositoryGitWorkflow(input: RepositoryGitWorkflowInput): {
  decision: RepositoryWorkflowDecision;
  decisionValidation: DecisionValidationResult;
} {
  const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
  const decisionValidation = validateRepositoryWorkflowDecision(decision, input);
  return { decision, decisionValidation };
}

export async function planRepositoryGitWorkflow(
  input: RepositoryGitWorkflowInput,
  harness: RepositoryGitWorkflowHarness,
): Promise<PlanRepositoryGitWorkflowOutcome> {
  let loadedSkill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length > 0) {
    const selection = await selectSkillForTask({
      task: harness.selectionTask ?? DEFAULT_SELECTION_TASK,
      agent_definition: harness.baseDefinition,
      provider: harness.skillProvider,
    });
    if (selection.loaded && selection.loaded.id === REPOSITORY_GIT_WORKFLOW_SKILL_ID) {
      loadedSkill = selection.loaded;
    } else {
      throw new Error(
        `S12 discovery did not select/load the S13H Skill '${REPOSITORY_GIT_WORKFLOW_SKILL_ID}' for the supplied base definition.`,
      );
    }
  }

  const materializedDefinition = loadedSkill
    ? materializeRepositoryGitWorkflowTask({ baseDefinition: harness.baseDefinition, input, loadedSkill })
    : materializeBaselineRepositoryGitWorkflowTask({ baseDefinition: harness.baseDefinition, input });

  const compiled = compileAgentDefinition(materializedDefinition, {
    model_provider: harness.modelProvider,
    capability_provider: harness.capabilityProvider,
  });
  const run = await runAgent(compiled.run_options);
  const candidate = parseCandidate(run);

  const gated = gateRepositoryGitWorkflow(input);

  return {
    decision: gated.decision,
    candidate,
    run,
    skillLoaded: Boolean(loadedSkill),
    materializedDefinition,
    decisionValidation: gated.decisionValidation,
  };
}
