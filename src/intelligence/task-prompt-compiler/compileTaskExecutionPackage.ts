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
  TASK_COMPILATION_INPUT_MARKER,
  TASK_COMPILATION_SKILL_MATERIALIZATION_MARKER,
  TASK_PROMPT_COMPILER_QUALITY_CONTRACT_REF,
  TASK_PROMPT_COMPILER_SKILL_ID,
} from "./constants.js";
import { validateContextPackSnapshot } from "./validateContextPackSnapshot.js";
import { validateTargetExecutionCompatibility } from "./validateTargetExecutionCompatibility.js";
import { validateTaskCompilationInput } from "./validateTaskCompilationInput.js";
import { validateExecutionPackage, type PackageValidationResult } from "./validateExecutionPackage.js";
import type { ExecutionPackage, TaskCompilationInput, TaskCompilationResult } from "./types.js";

/**
 * Brain — S13G compiler Skill execution bridge.
 *
 * Implements brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md sections
 * 15-17. S13G is `SKILL_ONLY`: this module NEVER defines, selects, catalogues,
 * or activates a new task-prompt-compiler AgentDefinition. The CALLER injects a
 * compatible existing AgentDefinition / runtime harness whose `skills`
 * allowlist admits the S13G compiler Skill; this bridge only:
 *
 *   selectSkillForTask()  (S12 metadata-only discovery + lazy load of the compiler Skill)
 *   -> materialize a task-specific instance of the caller's base definition
 *   -> compileAgentDefinition()  (unchanged S10)
 *   -> runAgent()  (unchanged S09)
 *   -> parse the candidate TaskCompilationResult from the run output
 *   -> AUTHORITATIVE deterministic gate (input compatibility + Context Pack + package validation)
 *
 * The final `result` is recomputed here and never trusts the model's `status`.
 * `../agent-definitions/` is intentionally NOT imported.
 */

export interface TaskCompilationHarness {
  /** A caller-supplied compatible AgentDefinition whose `skills` allowlist admits the S13G compiler Skill. */
  baseDefinition: AgentDefinition;
  /** Present for the with-Skill arm; omit (or supply a base definition with `skills: []`) for the no-Skill arm. */
  skillProvider?: SkillProvider;
  modelProvider: ModelProvider;
  capabilityProvider: CapabilityProvider;
  selectionTask?: string;
  qualityContractRef?: string;
}

export interface CompileTaskExecutionPackageOutcome {
  /** Authoritative, fully re-gated result. */
  result: TaskCompilationResult;
  /** The raw model candidate before the authoritative gate (used by the Skill-vs-no-Skill comparison). */
  candidate: TaskCompilationResult;
  candidatePackage: ExecutionPackage | null;
  run: AgentRunResult;
  skillLoaded: boolean;
  materializedDefinition: AgentDefinition;
  inputBlockers: string[];
  packageValidation: PackageValidationResult | null;
}

const DEFAULT_SELECTION_TASK =
  "task prompt compiler compile one ready implementation plan task into a bounded provider-neutral execution package objective instructions context tools limits output schema acceptance evidence";

function serializeSkillBody(skill: SkillDefinition): string {
  const rulesBlock = skill.rules.map((r) => `- [${r.level}] ${r.id}: ${r.statement}`).join("\n");
  const procedureBlock = skill.procedure.map((p) => `- ${p.id} ${p.title}: ${p.instruction}`).join("\n");
  const verificationBlock = skill.verification.map((v) => `- ${v.id} (${v.kind}): ${v.criterion}`).join("\n");
  return (
    `${TASK_COMPILATION_SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
    `SKILL_DESCRIPTION: ${skill.description}\n` +
    `SKILL_RULES:\n${rulesBlock}\n` +
    `SKILL_PROCEDURE:\n${procedureBlock}\n` +
    `SKILL_VERIFICATION:\n${verificationBlock}\n`
  );
}

/** Skill-assisted materialization (embeds the input + the selected compiler Skill body). */
export function materializeTaskCompilationTask(params: {
  baseDefinition: AgentDefinition;
  input: TaskCompilationInput;
  loadedSkill: SkillDefinition;
  qualityContractRef: string;
  taskId?: string;
}): AgentDefinition {
  const input = validateTaskCompilationInput(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-task-${randomUUID()}`;
  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective:
      `${params.baseDefinition.objective}\n\n` +
      `${TASK_COMPILATION_INPUT_MARKER}\n${JSON.stringify(input)}\n\n` +
      `${serializeSkillBody(params.loadedSkill)}` +
      `QUALITY_CONTRACT_REF: ${params.qualityContractRef}`,
  };
}

/** No-Skill materialization (embeds ONLY the input — no S13G Skill body). */
export function materializeBaselineTaskCompilationTask(params: {
  baseDefinition: AgentDefinition;
  input: TaskCompilationInput;
  taskId?: string;
}): AgentDefinition {
  const input = validateTaskCompilationInput(params.input);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;
  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\n${TASK_COMPILATION_INPUT_MARKER}\n${JSON.stringify(input)}`,
  };
}

function parseCandidate(run: AgentRunResult): TaskCompilationResult {
  if (run.outcome !== "SUCCESS" || !run.output?.data) {
    throw new Error(
      `S13G run did not SUCCEED with a structured result (outcome=${run.outcome}, reason=${run.termination.reason_code}).`,
    );
  }
  return run.output.data as unknown as TaskCompilationResult;
}

/**
 * Authoritative deterministic gate — never trusts the model's `status`. Runs
 * the input-compatibility checks, the Context Pack validation, and (if those
 * pass and a candidate package exists) the full HI-001..HI-026 package
 * validator. Returns the final result plus the raw evidence.
 */
export function gateTaskCompilation(
  input: TaskCompilationInput,
  candidate: TaskCompilationResult,
): {
  result: TaskCompilationResult;
  inputBlockers: string[];
  packageValidation: PackageValidationResult | null;
} {
  const inputBlockers = [
    ...validateTargetExecutionCompatibility(input),
    ...validateContextPackSnapshot(input.context_pack, input),
  ];
  if (inputBlockers.length > 0) {
    return { result: { status: "BLOCKED", blockers: inputBlockers, package: null }, inputBlockers, packageValidation: null };
  }
  if (!candidate.package) {
    return {
      result: { status: "BLOCKED", blockers: candidate.blockers.length > 0 ? candidate.blockers : ["compiler produced no Execution Package"], package: null },
      inputBlockers,
      packageValidation: null,
    };
  }
  const packageValidation = validateExecutionPackage(candidate.package, input);
  if (!packageValidation.valid) {
    return { result: { status: "BLOCKED", blockers: packageValidation.errors, package: null }, inputBlockers, packageValidation };
  }
  return { result: { status: "READY", blockers: [], package: candidate.package }, inputBlockers, packageValidation };
}

/**
 * Run the S13G compiler Skill through the caller's harness and the unchanged
 * generic S12 -> S10 -> S09 path, then apply the authoritative gate.
 *
 * With-Skill arm: pass `harness.skillProvider` and a base definition whose
 * `skills` allowlist contains the S13G Skill id.
 * No-Skill arm: omit `skillProvider` (or pass a base definition with `skills: []`).
 */
export async function compileTaskExecutionPackage(
  input: TaskCompilationInput,
  harness: TaskCompilationHarness,
): Promise<CompileTaskExecutionPackageOutcome> {
  validateTaskCompilationInput(input);

  let loadedSkill: SkillDefinition | undefined;
  if (harness.skillProvider && harness.baseDefinition.skills.length > 0) {
    const selection = await selectSkillForTask({
      task: harness.selectionTask ?? DEFAULT_SELECTION_TASK,
      agent_definition: harness.baseDefinition,
      provider: harness.skillProvider,
    });
    if (selection.loaded && selection.loaded.id === TASK_PROMPT_COMPILER_SKILL_ID) {
      loadedSkill = selection.loaded;
    } else if (harness.skillProvider) {
      throw new Error(
        `S12 discovery did not select/load the S13G compiler Skill '${TASK_PROMPT_COMPILER_SKILL_ID}' for the supplied base definition.`,
      );
    }
  }

  const materializedDefinition = loadedSkill
    ? materializeTaskCompilationTask({
        baseDefinition: harness.baseDefinition,
        input,
        loadedSkill,
        qualityContractRef: harness.qualityContractRef ?? TASK_PROMPT_COMPILER_QUALITY_CONTRACT_REF,
      })
    : materializeBaselineTaskCompilationTask({ baseDefinition: harness.baseDefinition, input });

  const compiled = compileAgentDefinition(materializedDefinition, {
    model_provider: harness.modelProvider,
    capability_provider: harness.capabilityProvider,
  });
  const run = await runAgent(compiled.run_options);
  const candidate = parseCandidate(run);
  const candidatePackage = candidate.package ?? null;

  const gated = gateTaskCompilation(input, candidate);

  return {
    result: gated.result,
    candidate,
    candidatePackage,
    run,
    skillLoaded: Boolean(loadedSkill),
    materializedDefinition,
    inputBlockers: gated.inputBlockers,
    packageValidation: gated.packageValidation,
  };
}
