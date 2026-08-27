import type { ImplementationPlanningFixtureTruth } from "../../src/intelligence/implementation-planning/types.js";

/**
 * Independent, hand-authored ground truth for the S13F canonical fixtures.
 *
 * QC `ground_truth_policy` (construction: HAND_AUTHORED_BEFORE_RUN, denominator:
 * FROZEN_ASSERTION_SET) / spec section 4.5 / Skill file "Success criteria":
 * this module is the SINGLE place expected answers live. Every value is written
 * by hand from the canonical fixture scenarios — none is produced by running
 * `classifyPlanStatus`, `computePlanCoverage`, `analyzeDependencies`, the plan
 * synthesizer, or the validator.
 *
 * INVARIANT (asserted mechanically by T31): this file is NEVER imported by
 * tests/implementation-planning/fixtures.ts. The runtime path
 * (materializer -> ModelProvider -> Skill selection -> plan synthesizer ->
 * validator) never sees a value from here. The comparison evaluator in
 * src/intelligence/implementation-planning/compareImplementationPlanningRuns.ts
 * is the only consumer, and only after both runtime outputs already exist.
 */

/** FX-POS-001 / F1 — approved Spec + approved architecture => READY. */
export const FX_POS_001_TRUTH: ImplementationPlanningFixtureTruth = {
  expected_status: "READY",
  required_refs: ["R-001", "R-002"],
  should_refs: ["R-003"],
  optional_refs: ["R-004"],
  expected_p0_task_count: 2,
  expected_min_task_count: 4,
  max_requirement_refs_per_task: 2,
  expected_has_risk_assumptions: true,
  arch_pending: false,
  agent_pending: false,
  has_rejected_decision: false,
};

/** FX-POS-002 / F2 — approved Spec + PENDING architecture => PROVISIONAL. */
export const FX_POS_002_TRUTH: ImplementationPlanningFixtureTruth = {
  expected_status: "PROVISIONAL",
  required_refs: ["R-001", "R-002"],
  should_refs: ["R-003"],
  optional_refs: [],
  expected_p0_task_count: 2,
  expected_min_task_count: 3,
  max_requirement_refs_per_task: 2,
  expected_has_risk_assumptions: true,
  arch_pending: true,
  agent_pending: false,
  has_rejected_decision: false,
};

/** FX-POS-003 / F3 — approved Spec + approved architecture + APPLICABLE + APPROVED agent decision => READY. */
export const FX_POS_003_TRUTH: ImplementationPlanningFixtureTruth = {
  expected_status: "READY",
  required_refs: ["R-001"],
  should_refs: ["R-002"],
  optional_refs: [],
  expected_p0_task_count: 1,
  expected_min_task_count: 2,
  max_requirement_refs_per_task: 1,
  expected_has_risk_assumptions: true,
  arch_pending: false,
  agent_pending: false,
  has_rejected_decision: false,
};
