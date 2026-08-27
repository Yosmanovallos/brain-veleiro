/**
 * Brain — S13G Task Prompt Compiler (Stage 11 TASK-COMPILATION).
 *
 * Public surface of the Intelligence-layer S13G module. Semantic source of
 * truth: brain-bootstrap/skills/TASK_PROMPT_COMPILER_SKILL_S13G.md,
 * brain-bootstrap/quality-contracts/S13G_TASK_PROMPT_COMPILER_DEEP.yaml,
 * brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md.
 */

export * from "./types.js";
export {
  TASK_PROMPT_COMPILER_SKILL_ID,
  TASK_PROMPT_COMPILER_QUALITY_CONTRACT_REF,
  TASK_PROMPT_COMPILER_SKILL_ARTIFACT_PATH,
  TASK_PROMPT_COMPILER_SPEC_ARTIFACT_PATH,
  TASK_COMPILATION_INPUT_MARKER,
  TASK_COMPILATION_SKILL_MATERIALIZATION_MARKER,
  EXECUTION_PACKAGE_SCHEMA_VERSION,
  EXECUTION_PACKAGE_FORBIDDEN_KEYS,
} from "./constants.js";

export {
  stableStringify,
  deepClone,
  normalizeAcceptance,
  normalizeEvidence,
  acceptanceEqual,
  evidenceEqual,
  evidenceKindsValid,
  jsonSchemaEqual,
  isMaterialRef,
  taskMaterialSpecRefs,
  boundedSpecSnapshotRefs,
  computePackageId,
  findExecutionPackageForbiddenKeys,
  containsKnownSecretValue,
} from "./sharedNormalization.js";

export { projectTaskCompilationSpec } from "./projectTaskCompilationSpec.js";
export { validateTaskCompilationInput } from "./validateTaskCompilationInput.js";
export { validateContextPackSnapshot } from "./validateContextPackSnapshot.js";
export { validateTargetExecutionCompatibility } from "./validateTargetExecutionCompatibility.js";

export { materializeExecutionTools } from "./materializeExecutionTools.js";
export { materializeExecutionLimits } from "./materializeExecutionLimits.js";
export {
  assembleExecutionInstructions,
  isEligiblePolicyContextItem,
  FAITHFUL_INSTRUCTION_PROFILE,
  NAIVE_INSTRUCTION_PROFILE,
} from "./compileExecutionInstructions.js";
export type { InstructionAssemblyProfile } from "./compileExecutionInstructions.js";

export {
  assembleExecutionPackage,
  deriveAssemblyProfileFromRules,
  FAITHFUL_ASSEMBLY_PROFILE,
  NAIVE_ASSEMBLY_PROFILE,
} from "./assembleExecutionPackage.js";
export type { ExecutionAssemblyProfile } from "./assembleExecutionPackage.js";

export {
  validateExecutionPackage,
  mapTaskCompilationResultToStructuredOutput,
} from "./validateExecutionPackage.js";
export type { PackageValidationResult } from "./validateExecutionPackage.js";

export {
  compileTaskExecutionPackage,
  gateTaskCompilation,
  materializeTaskCompilationTask,
  materializeBaselineTaskCompilationTask,
} from "./compileTaskExecutionPackage.js";
export type {
  TaskCompilationHarness,
  CompileTaskExecutionPackageOutcome,
} from "./compileTaskExecutionPackage.js";

export {
  compareTaskCompilationRuns,
  scoreTaskCompilationArm,
  TASK_COMPILATION_COMPARISON_ASSERTIONS,
} from "./compareTaskCompilationRuns.js";
export type { ScoredTaskCompilationCase } from "./compareTaskCompilationRuns.js";
