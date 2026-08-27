import type { TaskCompilationFixtureTruth } from "../../src/intelligence/task-prompt-compiler/types.js";

/**
 * Independent, hand-authored ground truth for the S13G canonical fixtures.
 *
 * QC `ground_truth_policy` (construction: FROZEN_BEFORE_EXECUTION,
 * model_visibility: FORBIDDEN) / spec section 18 / Skill file "Success
 * criteria": this module is the SINGLE place expected answers live. Every value
 * is written by hand from the canonical fixture scenarios — none is produced by
 * running `assembleExecutionPackage`, `deriveAssemblyProfileFromRules`, the
 * validators, or the comparison evaluator.
 *
 * INVARIANT (asserted mechanically by the suite): this file is NEVER imported
 * by tests/task-prompt-compiler/fixtures.ts. The runtime path
 * (materializer -> ModelProvider -> assembler -> gate -> validator) never sees
 * a value from here. `compareTaskCompilationRuns` is the only consumer, and
 * only after both runtime candidate packages already exist.
 *
 * Threshold-bearing values carry deliberate slack against the faithful arm:
 * `min_skill_must_instructions` is 2 while the faithful compile emits 3
 * (the target Skill has 3 MUST rules); the naive arm emits 0.
 */

/** FX-POS-001 — SKILL_ONLY task, no tools. */
export const FX_POS_001_TRUTH: TaskCompilationFixtureTruth = {
  expected_status: "READY",
  expected_objective_statement: "Add server-side authentication validation to the protected request handlers.",
  required_instruction_source_refs: [
    "task:TASK-001",
    "R-001",
    "C-001",
    "context:CI-PROJINSTR-1",
    "skill:reference.task-skill.v1#TS-R1",
  ],
  required_context_item_ids: ["CI-STATE-1", "CI-PROJINSTR-1", "CI-WORKING-1", "CI-KNOWLEDGE-1"],
  non_normative_context_item_ids: ["CI-WORKING-1", "CI-KNOWLEDGE-1"],
  expected_tool_ids: [],
  expected_max_turns: 8,
  expected_timeout_ms: 20000,
  min_skill_must_instructions: 2,
  has_secret_bearing_input: false,
};

/** FX-POS-002 — one allowed provider-neutral capability. */
export const FX_POS_002_TRUTH: TaskCompilationFixtureTruth = {
  expected_status: "READY",
  expected_objective_statement: "Record an auditable event for each rejected request in the protected handler path.",
  required_instruction_source_refs: [
    "task:TASK-002",
    "R-002",
    "C-001",
    "context:CI-PROJINSTR-1",
    "skill:reference.task-skill.v1#TS-R1",
  ],
  required_context_item_ids: ["CI-STATE-1", "CI-PROJINSTR-1", "CI-WORKING-1", "CI-KNOWLEDGE-1"],
  non_normative_context_item_ids: ["CI-WORKING-1", "CI-KNOWLEDGE-1"],
  expected_tool_ids: ["repository.read"],
  expected_max_turns: 8,
  expected_timeout_ms: 20000,
  min_skill_must_instructions: 2,
  has_secret_bearing_input: false,
};

/** FX-POS-003 — approved task-specific AgentDefinition ref. */
export const FX_POS_003_TRUTH: TaskCompilationFixtureTruth = {
  expected_status: "READY",
  expected_objective_statement: "Add server-side authentication validation to the protected request handlers.",
  required_instruction_source_refs: [
    "task:TASK-003",
    "R-001",
    "C-001",
    "context:CI-PROJINSTR-1",
    "skill:reference.task-skill.v1#TS-R1",
  ],
  required_context_item_ids: ["CI-STATE-1", "CI-PROJINSTR-1", "CI-WORKING-1", "CI-KNOWLEDGE-1"],
  non_normative_context_item_ids: ["CI-WORKING-1", "CI-KNOWLEDGE-1"],
  expected_tool_ids: [],
  expected_max_turns: 12,
  expected_timeout_ms: 45000,
  min_skill_must_instructions: 2,
  has_secret_bearing_input: false,
};

/** FX-POS-004 — context / instruction injection separation (5 context items). */
export const FX_POS_004_TRUTH: TaskCompilationFixtureTruth = {
  expected_status: "READY",
  expected_objective_statement: "Add server-side authentication validation to the protected request handlers.",
  required_instruction_source_refs: [
    "task:TASK-001",
    "R-001",
    "C-001",
    "context:CI-PROJINSTR-1",
    "skill:reference.task-skill.v1#TS-R1",
  ],
  required_context_item_ids: ["CI-STATE-1", "CI-PROJINSTR-1", "CI-WORKING-1", "CI-KNOWLEDGE-1", "CI-WORKING-2"],
  non_normative_context_item_ids: ["CI-WORKING-1", "CI-KNOWLEDGE-1", "CI-WORKING-2"],
  expected_tool_ids: [],
  expected_max_turns: 8,
  expected_timeout_ms: 20000,
  min_skill_must_instructions: 2,
  has_secret_bearing_input: false,
};

export const ALL_FIXTURE_TRUTH = {
  "FX-POS-001": FX_POS_001_TRUTH,
  "FX-POS-002": FX_POS_002_TRUTH,
  "FX-POS-003": FX_POS_003_TRUTH,
  "FX-POS-004": FX_POS_004_TRUTH,
} as const;
