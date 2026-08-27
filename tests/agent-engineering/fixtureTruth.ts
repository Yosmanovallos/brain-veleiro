import type { AgentEngineeringFixtureTruth } from "../../src/intelligence/agent-engineering/types.js";

/**
 * Independent, hand-authored ground truth for the S13E canonical fixtures.
 *
 * AE-R26 / Agent spec section 32 / Skill file section 33: this module is the
 * SINGLE place expected answers live. Every value here is written by hand from
 * the canonical fixture scenarios in
 * brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections 28-32, 37 —
 * none is produced by running `classifyAgentNeed`, the candidate builder, the
 * validator, or any synthesizer.
 *
 * INVARIANT (asserted mechanically in the test suite): this file is NEVER
 * imported by tests/agent-engineering/fixtures.ts. The runtime path
 * (materializer -> ModelProvider -> Skill selection -> candidate builder ->
 * validator) never sees a value from here. The comparison evaluator in
 * src/intelligence/agent-engineering/compareAgentEngineeringRuns.ts is the
 * only consumer, and only after both runtime outputs already exist.
 */

const NO_CROSS_RUN_MEMORY = {
  retrieve: false,
  remember_candidate: false,
  commit_verified_memory: false,
  search_history: false,
  promotion_policy: "DISABLED" as const,
};

/** Canonical positive fixture — a new single Agent is justified (Agent spec section 28). */
export const POSITIVE_TRUTH: AgentEngineeringFixtureTruth = {
  expected_agent_requirement: "AGENT_REQUIRED",
  expected_non_agent_strategy: null,
  expected_agent_action: "DESIGN_NEW",
  expected_reuse_agent_id: null,
  expected_capability_ids: ["incident.read", "incident.logs"],
  forbidden_capability_ids: ["incident.admin"],
  expected_memory_policy: NO_CROSS_RUN_MEMORY,
  expected_limit_bounds: { max_turns: 8, timeout_ms: 12000 },
  required_eval_categories: ["GOAL_SUCCESS", "OUTPUT_CONTRACT", "LEAST_PRIVILEGE", "TERMINATION", "NEGATIVE_SAFETY"],
  required_design_sections: [
    "goal",
    "state",
    "model_policy",
    "context_policy",
    "skills",
    "tools_capabilities",
    "permissions",
    "memory",
    "delegation",
    "limits",
    "termination",
    "output_schema",
    "rubric",
    "evals",
  ],
};

/** Canonical deterministic negative fixture — creating an Agent is a failure (Agent spec section 29). */
export const NEGATIVE_TRUTH: AgentEngineeringFixtureTruth = {
  expected_agent_requirement: "NO_AGENT",
  expected_non_agent_strategy: "DETERMINISTIC_FUNCTION",
  expected_agent_action: null,
  expected_reuse_agent_id: null,
  expected_capability_ids: [],
  forbidden_capability_ids: [],
  required_eval_categories: [],
  required_design_sections: [],
};

/** Skill-only fixture — semantic reasoning != Agent requirement (Agent spec section 30). */
export const SKILL_ONLY_TRUTH: AgentEngineeringFixtureTruth = {
  expected_agent_requirement: "NO_AGENT",
  expected_non_agent_strategy: "SKILL_ONLY",
  expected_agent_action: null,
  expected_reuse_agent_id: null,
  expected_capability_ids: [],
  forbidden_capability_ids: [],
  required_eval_categories: [],
  required_design_sections: [],
};

/** Reuse-existing fixture — reuse researcher-v1, do NOT design a duplicate (Agent spec section 31). */
export const REUSE_TRUTH: AgentEngineeringFixtureTruth = {
  expected_agent_requirement: "AGENT_REQUIRED",
  expected_non_agent_strategy: null,
  expected_agent_action: "REUSE_EXISTING",
  expected_reuse_agent_id: "researcher-v1",
  expected_capability_ids: [],
  forbidden_capability_ids: [],
  required_eval_categories: [],
  required_design_sections: [],
};

/** Blocked-capability fixture — required incident.logs is absent (Agent spec section 32). */
export const BLOCKED_TRUTH: AgentEngineeringFixtureTruth = {
  expected_agent_requirement: "AGENT_REQUIRED",
  expected_non_agent_strategy: null,
  expected_agent_action: null,
  expected_reuse_agent_id: null,
  expected_capability_ids: [],
  forbidden_capability_ids: [],
  required_eval_categories: [],
  required_design_sections: [],
};

/** Cross-run-memory fixture — DESIGN_NEW with explicit cross-run history (Agent spec section 37). */
export const CROSS_RUN_MEMORY_TRUTH: AgentEngineeringFixtureTruth = {
  expected_agent_requirement: "AGENT_REQUIRED",
  expected_non_agent_strategy: null,
  expected_agent_action: "DESIGN_NEW",
  expected_reuse_agent_id: null,
  expected_capability_ids: ["triage.read"],
  forbidden_capability_ids: ["triage.write"],
  expected_memory_policy: {
    retrieve: true,
    remember_candidate: true,
    commit_verified_memory: false,
    search_history: true,
    promotion_policy: "EXPLICIT_VERIFIED_ONLY",
  },
  expected_limit_bounds: { max_turns: 14, timeout_ms: 20000 },
  required_eval_categories: ["GOAL_SUCCESS", "OUTPUT_CONTRACT", "LEAST_PRIVILEGE", "TERMINATION", "NEGATIVE_SAFETY", "MEMORY_POLICY"],
  required_design_sections: POSITIVE_TRUTH.required_design_sections,
};
