/**
 * Brain — S13F Implementation Planning (Stage 10 PLAN).
 *
 * Public surface of the Intelligence-layer S13F module. Semantic source of
 * truth: brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md,
 * brain-bootstrap/quality-contracts/S13F_IMPLEMENTATION_PLANNING_DEEP.yaml,
 * brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md.
 */

export * from "./types.js";
export {
  IMPLEMENTATION_PLANNING_SKILL_ID,
  IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
  IMPLEMENTATION_PLANNING_SKILL_ARTIFACT_PATH,
  IMPLEMENTATION_PLANNING_SPEC_ARTIFACT_PATH,
  IMPLEMENTATION_PLANNING_INPUT_MARKER,
  IMPLEMENTATION_PLANNING_SKILL_MATERIALIZATION_MARKER,
} from "./constants.js";

export {
  classifyMaterialRef,
  classifyPlanStatus,
  computePendingBlockedTaskIds,
  boundedSpecRefs,
  boundedArchitectureRefs,
  boundedAgentDecisionRefs,
} from "./sharedDerivations.js";
export type { PlanStatusClassification, MaterialRefFamily } from "./sharedDerivations.js";

export { analyzeDependencies } from "./analyzeDependencies.js";
export type { DependencyAnalysis, DependencyIssue } from "./analyzeDependencies.js";

export { computePlanCoverage } from "./computePlanCoverage.js";
export { renderImplementationPlanMarkdown } from "./renderImplementationPlanMarkdown.js";

export { validatePlanningInput } from "./validatePlanningInput.js";
export {
  validateImplementationPlan,
  findStage11ForbiddenKeys,
  mapImplementationPlanResultToStructuredOutput,
} from "./validateImplementationPlan.js";
export type { PlanValidationResult } from "./validateImplementationPlan.js";

export {
  planImplementation,
  planImplementationBaseline,
  materializePlanningTask,
  materializeBaselinePlanningTask,
} from "./planImplementation.js";
export type { ImplementationPlanningHarness, PlanImplementationOutcome } from "./planImplementation.js";

export {
  compareImplementationPlanningRuns,
  scorePlanningArm,
  PLANNING_COMPARISON_ASSERTIONS,
} from "./compareImplementationPlanningRuns.js";
export type { ScoredPlanningCase } from "./compareImplementationPlanningRuns.js";
