/**
 * Brain — S13H Repository Git Workflow (Intelligence layer).
 *
 * Public surface of the S13H module. Semantic source of truth:
 * brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md,
 * brain-bootstrap/quality-contracts/S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml,
 * brain-bootstrap/specs/REPOSITORY_GIT_WORKFLOW_CONTRACT_S13H.md.
 *
 * S13H is SKILL_ONLY: no AgentDefinition, no git execution in the canonical
 * Skill runtime, no Capability Registry / provider binding.
 */

export * from "./types.js";
export {
  REPOSITORY_GIT_WORKFLOW_SKILL_ID,
  REPOSITORY_GIT_WORKFLOW_QUALITY_CONTRACT_REF,
  REPOSITORY_GIT_WORKFLOW_SKILL_ARTIFACT_PATH,
  REPOSITORY_GIT_WORKFLOW_QUALITY_CONTRACT_ARTIFACT_PATH,
  REPOSITORY_GIT_WORKFLOW_CONTRACT_ARTIFACT_PATH,
  REPOSITORY_GIT_WORKFLOW_INPUT_MARKER,
  REPOSITORY_GIT_WORKFLOW_SKILL_MATERIALIZATION_MARKER,
  REPOSITORY_WORKFLOW_FORBIDDEN_KEYS,
  DESTRUCTIVE_OPERATION_IDS,
  SENSITIVE_PATH_BASELINE_PATTERNS,
  S13H_DIFF_INSPECTION_CHECK_IDS,
} from "./constants.js";

export {
  stableStringify,
  deepClone,
  findRepositoryWorkflowForbiddenKeys,
  isSensitivePath,
  pathMatchesAny,
  defaultCommitTypeForChangeKind,
  commitMessageMakesUnsupportedClaim,
} from "./sharedNormalization.js";

export { classifyRepositoryState } from "./classifyRepositoryState.js";
export type { RepositoryStateClassification } from "./classifyRepositoryState.js";
export { classifyGitOperation, isDestructiveOperation } from "./classifyGitOperation.js";
export { classifyChangedPaths, classifyPath, COMMITTABLE_DISPOSITIONS } from "./classifyChangedPaths.js";
export { validateSensitivePaths } from "./validateSensitivePaths.js";
export { validateChangeIsolation } from "./validateChangeIsolation.js";
export type { ChangeIsolationResult } from "./validateChangeIsolation.js";
export {
  decideWorkspaceStrategy,
  derivedFeatureBranchName,
  derivedWorktreePath,
} from "./decideWorkspaceStrategy.js";
export type { WorkspaceStrategyOutcome } from "./decideWorkspaceStrategy.js";
export {
  evaluateValidationGate,
  phasesForAction,
  validationGateBlockers,
} from "./validateValidationEvidence.js";

export {
  buildCommitPlan,
  FAITHFUL_COMMIT_PLAN_PROFILE,
  NAIVE_COMMIT_PLAN_PROFILE,
} from "./buildCommitPlan.js";
export type { CommitPlanProfile } from "./buildCommitPlan.js";
export { buildPushPlan } from "./buildPushPlan.js";
export { buildRemoteReviewHandoff } from "./buildRemoteReviewHandoff.js";

export {
  synthesizeRepositoryWorkflowDecision,
  deriveWorkflowProfileFromRules,
  FAITHFUL_SYNTHESIS_PROFILE,
  NAIVE_SYNTHESIS_PROFILE,
} from "./synthesizeRepositoryWorkflowDecision.js";
export type { WorkflowSynthesisProfile } from "./synthesizeRepositoryWorkflowDecision.js";

export {
  validateRepositoryWorkflowDecision,
} from "./validateRepositoryWorkflowDecision.js";
export type { DecisionValidationResult } from "./validateRepositoryWorkflowDecision.js";

export {
  planRepositoryGitWorkflow,
  gateRepositoryGitWorkflow,
  materializeRepositoryGitWorkflowTask,
  materializeBaselineRepositoryGitWorkflowTask,
} from "./planRepositoryGitWorkflow.js";
export type {
  RepositoryGitWorkflowHarness,
  PlanRepositoryGitWorkflowOutcome,
} from "./planRepositoryGitWorkflow.js";

export {
  compareRepositoryGitWorkflowRuns,
  scoreRepositoryGitWorkflowArm,
  REPOSITORY_GIT_WORKFLOW_COMPARISON_ASSERTIONS,
} from "./compareRepositoryGitWorkflowRuns.js";
export type { ScoredRepositoryGitWorkflowCase } from "./compareRepositoryGitWorkflowRuns.js";
