import type { AgentContextSource, AgentDefinition, AgentMemoryPolicy, JsonSchemaLike, ToolSideEffectClass } from "../../core/agent/index.js";
import type { SoftwareArchitectureDecisionResult } from "../software-architecture/types.js";

/**
 * Brain — S13E Agent Engineering semantic types.
 *
 * Defined in brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md sections
 * 1-22, 34 and brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections
 * 5-31 (ChatGPT-authored, integrated verbatim). This module belongs to
 * Intelligence: it describes S13E's data model, not a Core runtime concept.
 *
 * S13E consumes an optional S13D `SoftwareArchitectureDecisionResult`
 * read-only (Agent spec section 27 — "Input remains immutable"). It never
 * mutates it and never re-interprets its PROPOSED ADR as accepted
 * architecture.
 */

// ---------------------------------------------------------------------------
// Agent-necessity model (Skill file section 1)
// ---------------------------------------------------------------------------

export type AgentNeedStatus = "READY" | "BLOCKED";

export type AgentRequirement = "NO_AGENT" | "AGENT_REQUIRED";

export type NonAgentStrategy = "DETERMINISTIC_FUNCTION" | "SKILL_ONLY" | null;

export type AgentAction = "REUSE_EXISTING" | "DESIGN_NEW" | null;

export interface AgentNeedDecision {
  status: AgentNeedStatus;
  agent_requirement: AgentRequirement;
  non_agent_strategy: NonAgentStrategy;
  agent_action: AgentAction;
  reuse_agent_id: string | null;
  rationale: string;
  evidence_refs: string[];
  blocking_reasons: string[];
}

// ---------------------------------------------------------------------------
// AgentBehaviorSignals (Skill file section 6)
// ---------------------------------------------------------------------------

export interface AgentBehaviorSignals {
  fixed_steps_known_in_advance: boolean;
  semantic_judgment_required: boolean;
  next_action_depends_on_observation: boolean;
  requires_conditional_capability_use: boolean;
  requires_retry_or_replan: boolean;
  requires_within_run_state: boolean;
  requires_cross_run_history: boolean;
}

// ---------------------------------------------------------------------------
// AgentEngineeringWorkUnit (Skill file section 5)
// ---------------------------------------------------------------------------

export interface AgentEngineeringIterationBudget {
  max_turns: number;
  timeout_ms: number;
}

export interface AgentEngineeringWorkUnit {
  id: string;
  task_kind: string;
  goal: string;
  description: string;
  expected_output_schema: JsonSchemaLike;
  quality_contract_ref: string;
  success_conditions: string[];
  constraints: string[];
  allowed_context_sources: AgentContextSource[];
  required_capability_ids: string[];
  optional_capability_ids: string[];
  allowed_side_effect_classes: ToolSideEffectClass[];
  behavior: AgentBehaviorSignals;
  iteration_budget?: AgentEngineeringIterationBudget;
  source_refs: string[];
}

// ---------------------------------------------------------------------------
// Available capability / Agent descriptors (Skill file sections 7-8)
// ---------------------------------------------------------------------------

export interface AvailableCapabilityDescriptor {
  id: string;
  description: string;
  side_effect_class: ToolSideEffectClass;
}

export interface AvailableAgentDescriptor {
  definition: AgentDefinition;
  supported_task_kinds: string[];
  compatible_quality_contract_refs: string[];
  notes: string;
}

// ---------------------------------------------------------------------------
// AgentEngineeringInput (Skill file section 4)
// ---------------------------------------------------------------------------

export interface AgentEngineeringInput {
  work_unit: AgentEngineeringWorkUnit;
  architecture_decision?: SoftwareArchitectureDecisionResult;
  available_agents: AvailableAgentDescriptor[];
  available_skill_ids: string[];
  available_capabilities: AvailableCapabilityDescriptor[];
}

// ---------------------------------------------------------------------------
// ProposedAgentDesign (Skill file sections 9-13)
// ---------------------------------------------------------------------------

export type AgentDesignProposalStatus = "PROPOSED";

export type AgentStateFieldType = "string" | "number" | "boolean" | "array" | "object";

export interface AgentStateDesignField {
  name: string;
  type: AgentStateFieldType;
  required: boolean;
  description: string;
}

export interface AgentStateDesign {
  purpose: string;
  fields: AgentStateDesignField[];
}

export interface CapabilityDesign {
  selected_capability_ids: string[];
  required_capability_ids: string[];
  optional_capabilities_selected: { id: string; rationale: string }[];
  rejected_available_capabilities: { id: string; reason: string }[];
}

export interface TerminationDesign {
  require_terminal_outcome: true;
  require_explanation: true;
  max_turns: number;
  timeout_ms: number;
  stop_rationale: string;
}

export type AgentEvalCategory =
  | "GOAL_SUCCESS"
  | "OUTPUT_CONTRACT"
  | "LEAST_PRIVILEGE"
  | "TERMINATION"
  | "NEGATIVE_SAFETY"
  | "MEMORY_POLICY";

export interface AgentEvalPlanItem {
  category: AgentEvalCategory;
  ref: string;
  rationale: string;
}

export interface ProposedAgentDesign {
  proposal_status: "PROPOSED";
  candidate_definition: AgentDefinition;
  goal_rationale: string;
  state_design: AgentStateDesign;
  capability_design: CapabilityDesign;
  permission_rationale: string;
  memory_rationale: string;
  termination_design: TerminationDesign;
  eval_plan: AgentEvalPlanItem[];
  model_policy_rationale: string;
  context_policy_rationale: string;
  skill_selection_rationale: string;
  limitations: string[];
}

// ---------------------------------------------------------------------------
// AgentEngineeringResult (Skill file section 22)
// ---------------------------------------------------------------------------

export interface NonAgentRecommendation {
  strategy: "DETERMINISTIC_FUNCTION" | "SKILL_ONLY";
  rationale: string;
}

export interface AgentEngineeringResult {
  work_unit_id: string;
  proposal_status: "PROPOSED";
  approval_required: true;
  need_decision: AgentNeedDecision;
  design: ProposedAgentDesign | null;
  reuse_agent_id: string | null;
  non_agent_recommendation: NonAgentRecommendation | null;
  warnings: string[];
  approval_note: string;
}

// ---------------------------------------------------------------------------
// Skill-vs-baseline comparison metrics (Skill file section 34, Agent spec 39)
// ---------------------------------------------------------------------------

export interface AgentEngineeringComparisonMetrics {
  necessity_accuracy_ratio: number;
  strategy_accuracy_ratio: number;
  design_completeness_ratio: number;
  least_privilege_accuracy_ratio: number;
  memory_policy_accuracy_ratio: number;
  termination_policy_accuracy_ratio: number;
  eval_coverage_ratio: number;
  unnecessary_new_agent_count: number;
  unsupported_capability_count: number;
}

export interface AgentEngineeringComparison {
  baseline: AgentEngineeringComparisonMetrics;
  skill: AgentEngineeringComparisonMetrics;
}

/**
 * Test-only independent ground truth (Skill file section 33, Agent spec
 * section 32). This shape MUST NOT be constructed from, or passed into, the
 * materializer / ModelProvider / Skill selection / candidate builder /
 * validator. It is consumed only by the comparison evaluator, and only after
 * both runtime outputs already exist.
 */
export interface AgentEngineeringFixtureTruth {
  expected_agent_requirement: AgentRequirement;
  expected_non_agent_strategy: NonAgentStrategy;
  expected_agent_action: AgentAction;
  expected_reuse_agent_id: string | null;
  expected_capability_ids: string[];
  forbidden_capability_ids: string[];
  expected_memory_policy?: AgentMemoryPolicy;
  expected_limit_bounds?: { max_turns: number; timeout_ms: number };
  required_eval_categories: AgentEvalCategory[];
  required_design_sections: string[];
}
