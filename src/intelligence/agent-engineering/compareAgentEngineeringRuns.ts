import type {
  AgentEngineeringComparison,
  AgentEngineeringComparisonMetrics,
  AgentEngineeringFixtureTruth,
  AgentEngineeringInput,
  AgentEngineeringResult,
  ProposedAgentDesign,
} from "./types.js";

/**
 * Deterministic Skill-vs-baseline comparison metrics for S13E.
 *
 * Implements brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md sections
 * 33-36 and brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections
 * 32-42. Both the baseline and Skill-assisted `AgentEngineeringResult` values
 * passed in here MUST already have been produced by real runs through the
 * identical compileAgentDefinition() / runAgent() path — this module only
 * scores results.
 *
 * CRITICAL (AE-R26 / T29 / Agent spec section 32): every expected answer used
 * here comes from a caller-supplied, hand-authored `AgentEngineeringFixtureTruth`
 * or from the bounded `AgentEngineeringInput` itself — NEVER from the result
 * being scored, from a classifier, from the candidate builder, or from a
 * regex shared with a synthesizer. This module is the only place a
 * FixtureTruth value is ever read, and it is read only after both runtime
 * outputs already exist.
 *
 * Every ratio is defined over "all scored fixture cases" (Skill file section
 * 35), so metrics take an array of scored cases per arm, not a single result.
 */

export interface ScoredAgentEngineeringCase {
  result: AgentEngineeringResult;
  input: AgentEngineeringInput;
  truth: AgentEngineeringFixtureTruth;
}

/** The 14 canonical AgentDefinition design sections (Skill file section 35.3). */
export const CANONICAL_DESIGN_SECTIONS = [
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
] as const;

const REQUIRED_MEMORY_FIELDS = ["retrieve", "remember_candidate", "commit_verified_memory", "search_history", "promotion_policy"] as const;

function isDesignNew(result: AgentEngineeringResult): boolean {
  return result.need_decision.agent_requirement === "AGENT_REQUIRED" && result.need_decision.agent_action === "DESIGN_NEW" && result.design !== null;
}

/**
 * Substantive per-section completeness (not presence-only). The 14-section
 * list is external truth; each section is scored on whether it is actually
 * populated with design content, so a bare assembler cannot score 1.0 by
 * merely instantiating empty fields. The residual structural guarantee (the
 * production builder always populates every section) is disclosed in the
 * S13E verification report's limitations.
 */
function countCompleteDesignSections(design: ProposedAgentDesign, truth: AgentEngineeringFixtureTruth): number {
  const c = design.candidate_definition;
  let count = 0;

  if (c.objective.trim().length > 0 && design.goal_rationale.trim().length > 0) count += 1; // goal
  if (design.state_design.fields.length >= 1) count += 1; // state
  if (c.model_policy.routing_class && design.model_policy_rationale.trim().length > 0) count += 1; // model_policy
  if (c.context_policy.allowed_sources.length >= 1 && design.context_policy_rationale.trim().length > 0) count += 1; // context_policy
  if (Array.isArray(c.skills) && design.skill_selection_rationale.trim().length > 0) count += 1; // skills
  if (JSON.stringify(c.tools) === JSON.stringify(c.capabilities)) count += 1; // tools_capabilities
  if (c.permissions.deny_unlisted_capabilities === true && c.permissions.allowed_side_effects.length >= 1 && design.permission_rationale.trim().length > 0) count += 1; // permissions
  if (design.memory_rationale.trim().length > 0 && c.memory_policy.commit_verified_memory === false) count += 1; // memory
  if (c.delegation.allowed === false) count += 1; // delegation
  if (c.limits.max_turns >= 1 && c.limits.timeout_ms >= 1) count += 1; // limits
  if (c.termination.require_terminal_outcome === true && c.termination.require_explanation === true && design.termination_design.stop_rationale.trim().length > 0) count += 1; // termination
  if (c.output_schema && Object.keys(c.output_schema).length > 0) count += 1; // output_schema
  if (c.rubric.quality_contract_ref.trim().length > 0) count += 1; // rubric

  const categories = new Set(design.eval_plan.map((e) => e.category));
  const evalCovered = truth.required_eval_categories.every((cat) => categories.has(cat)) && c.evals.length >= 1;
  if (evalCovered) count += 1; // evals

  return count;
}

function strategyMatches(result: AgentEngineeringResult, truth: AgentEngineeringFixtureTruth): boolean {
  const nd = result.need_decision;
  if (truth.expected_agent_requirement === "NO_AGENT") {
    return nd.agent_requirement === "NO_AGENT" && nd.non_agent_strategy === truth.expected_non_agent_strategy;
  }
  // AGENT_REQUIRED
  if (nd.agent_requirement !== "AGENT_REQUIRED") return false;
  if (truth.expected_agent_action === null) return nd.status === "BLOCKED";
  if (nd.agent_action !== truth.expected_agent_action) return false;
  if (truth.expected_agent_action === "REUSE_EXISTING") return result.reuse_agent_id === truth.expected_reuse_agent_id;
  return true;
}

function selectedCapabilityIds(result: AgentEngineeringResult): string[] {
  if (result.design) return result.design.capability_design.selected_capability_ids;
  return [];
}

export function computeAgentEngineeringComparisonMetrics(cases: ScoredAgentEngineeringCase[]): AgentEngineeringComparisonMetrics {
  const total = cases.length;

  let necessityMatches = 0;
  let strategyMatchCount = 0;
  let unnecessary_new_agent_count = 0;
  let unsupported_capability_count = 0;

  let sectionNumerator = 0;
  let sectionDenominator = 0;

  let capNumerator = 0;
  let capDenominator = 0;

  let memFieldMatches = 0;
  let memFieldTotal = 0;

  let termChecksPassed = 0;
  let termChecksTotal = 0;

  let evalCategoriesCovered = 0;
  let evalCategoriesRequired = 0;

  for (const { result, input, truth } of cases) {
    if (result.need_decision.agent_requirement === truth.expected_agent_requirement) necessityMatches += 1;
    if (strategyMatches(result, truth)) strategyMatchCount += 1;

    if (
      result.need_decision.agent_action === "DESIGN_NEW" &&
      (truth.expected_agent_requirement === "NO_AGENT" || truth.expected_agent_action === "REUSE_EXISTING")
    ) {
      unnecessary_new_agent_count += 1;
    }

    const selected = selectedCapabilityIds(result);
    const availableIds = new Set(input.available_capabilities.map((c) => c.id));
    const forbidden = new Set(truth.forbidden_capability_ids);
    for (const id of selected) {
      if (!availableIds.has(id)) unsupported_capability_count += 1;
      else if (forbidden.has(id)) unsupported_capability_count += 1;
    }

    // least_privilege_accuracy: matched expected / (expected + incorrectly selected)
    if (truth.expected_capability_ids.length > 0 || selected.length > 0) {
      const expected = new Set(truth.expected_capability_ids);
      const matched = [...expected].filter((id) => selected.includes(id)).length;
      const incorrect = selected.filter((id) => !expected.has(id)).length;
      capNumerator += matched;
      capDenominator += expected.size + incorrect;
    }

    if (isDesignNew(result) && result.design) {
      sectionNumerator += countCompleteDesignSections(result.design, truth);
      sectionDenominator += CANONICAL_DESIGN_SECTIONS.length;

      if (truth.expected_memory_policy) {
        const mem = result.design.candidate_definition.memory_policy;
        for (const field of REQUIRED_MEMORY_FIELDS) {
          memFieldTotal += 1;
          if (mem[field] === truth.expected_memory_policy[field]) memFieldMatches += 1;
        }
      }

      const term = result.design.candidate_definition;
      const bounds = truth.expected_limit_bounds;
      termChecksTotal += 4;
      if (term.termination.require_terminal_outcome === true) termChecksPassed += 1;
      if (term.termination.require_explanation === true) termChecksPassed += 1;
      if (bounds) {
        if (term.limits.max_turns <= bounds.max_turns) termChecksPassed += 1;
        if (term.limits.timeout_ms <= bounds.timeout_ms) termChecksPassed += 1;
      } else {
        termChecksPassed += 2;
      }

      const categories = new Set(result.design.eval_plan.map((e) => e.category));
      evalCategoriesRequired += truth.required_eval_categories.length;
      evalCategoriesCovered += truth.required_eval_categories.filter((cat) => categories.has(cat)).length;
    }
  }

  return {
    necessity_accuracy_ratio: total === 0 ? 1 : necessityMatches / total,
    strategy_accuracy_ratio: total === 0 ? 1 : strategyMatchCount / total,
    design_completeness_ratio: sectionDenominator === 0 ? 1 : sectionNumerator / sectionDenominator,
    least_privilege_accuracy_ratio: capDenominator === 0 ? 1 : capNumerator / capDenominator,
    memory_policy_accuracy_ratio: memFieldTotal === 0 ? 1 : memFieldMatches / memFieldTotal,
    termination_policy_accuracy_ratio: termChecksTotal === 0 ? 1 : termChecksPassed / termChecksTotal,
    eval_coverage_ratio: evalCategoriesRequired === 0 ? 1 : evalCategoriesCovered / evalCategoriesRequired,
    unnecessary_new_agent_count,
    unsupported_capability_count,
  };
}

export function compareAgentEngineeringRuns(
  baselineCases: ScoredAgentEngineeringCase[],
  skillCases: ScoredAgentEngineeringCase[],
): AgentEngineeringComparison {
  return {
    baseline: computeAgentEngineeringComparisonMetrics(baselineCases),
    skill: computeAgentEngineeringComparisonMetrics(skillCases),
  };
}
