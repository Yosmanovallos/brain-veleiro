import type { AgentBehaviorSignals, AgentRequirement, NonAgentStrategy } from "./types.js";

/**
 * Deterministic Agent-necessity classifier.
 *
 * Implements brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md sections
 * 2, 11-13 and brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections
 * 7-10. Reads ONLY the bounded, explicit `AgentBehaviorSignals` supplied on
 * the work unit — it never uses task complexity, LLM usage, artifact size, or
 * a long prompt as evidence (AE-R2, Skill file section 2.4). It also never
 * reads any fixture-truth object (AE-R26).
 *
 * Canonical criteria:
 *   AGENT_REQUIRED  <=  next_action_depends_on_observation === true
 *                       AND at least one of {conditional capability use,
 *                       retry/replan, within-run state}          (section 2.3)
 *   NO_AGENT + DETERMINISTIC_FUNCTION  <=  fixed steps, no observation-
 *                       dependent action, no retry/replan, no adaptive state,
 *                       semantic judgment not the core operation  (section 2.1)
 *   NO_AGENT + SKILL_ONLY  <=  semantic judgment useful but one bounded pass
 *                       suffices; no observe-act loop; no conditional
 *                       capability sequence; no retry/replan; no adaptive
 *                       state                                     (section 2.2)
 *
 * Determinization note (disclosed in the S13E verification report): Part A
 * section 2.3 leaves the case `next_action_depends_on_observation === true`
 * with NO secondary agentic signal unspecified beyond "not AGENT_REQUIRED".
 * This module resolves it to NO_AGENT, choosing SKILL_ONLY when semantic
 * judgment is required and DETERMINISTIC_FUNCTION otherwise. No canonical
 * fixture lands on this branch.
 */

export interface AgentNeedClassification {
  agent_requirement: AgentRequirement;
  non_agent_strategy: NonAgentStrategy;
  rationale: string;
}

function isDeterministicFunction(b: AgentBehaviorSignals): boolean {
  return (
    b.fixed_steps_known_in_advance &&
    !b.next_action_depends_on_observation &&
    !b.requires_retry_or_replan &&
    !b.requires_within_run_state &&
    !b.requires_conditional_capability_use &&
    !b.semantic_judgment_required
  );
}

function isSkillOnly(b: AgentBehaviorSignals): boolean {
  return (
    b.semantic_judgment_required &&
    !b.next_action_depends_on_observation &&
    !b.requires_conditional_capability_use &&
    !b.requires_retry_or_replan &&
    !b.requires_within_run_state
  );
}

function isAgentRequired(b: AgentBehaviorSignals): boolean {
  return (
    b.next_action_depends_on_observation &&
    (b.requires_conditional_capability_use || b.requires_retry_or_replan || b.requires_within_run_state)
  );
}

export function classifyAgentNeed(behavior: AgentBehaviorSignals): AgentNeedClassification {
  if (isAgentRequired(behavior)) {
    return {
      agent_requirement: "AGENT_REQUIRED",
      non_agent_strategy: null,
      rationale:
        "The next action depends on an observation produced by a previous action, and at least one of conditional " +
        "capability use, retry/replan, or persistent within-run state is required — an adaptive observe-decide-act-" +
        "observe loop is genuinely needed (AE-R5).",
    };
  }

  if (isDeterministicFunction(behavior)) {
    return {
      agent_requirement: "NO_AGENT",
      non_agent_strategy: "DETERMINISTIC_FUNCTION",
      rationale:
        "The transformation has a fixed, known sequence of steps, no observation-dependent next action, no retry/" +
        "replan loop, no within-run adaptive state, and semantic judgment is not the core operation — a deterministic " +
        "function is sufficient (AE-R3).",
    };
  }

  if (isSkillOnly(behavior)) {
    return {
      agent_requirement: "NO_AGENT",
      non_agent_strategy: "SKILL_ONLY",
      rationale:
        "Semantic judgment or reusable procedural guidance is useful, but the work completes in one bounded decision " +
        "pass with no observation-dependent action loop, no conditional capability sequence, and no retry/replan — a " +
        "Skill-only execution model is sufficient (AE-R4). The absence of an Agent does not imply the absence of a model.",
    };
  }

  // Determinization of section 2.3's residual case (no canonical fixture lands here).
  const strategy: NonAgentStrategy = behavior.semantic_judgment_required ? "SKILL_ONLY" : "DETERMINISTIC_FUNCTION";
  return {
    agent_requirement: "NO_AGENT",
    non_agent_strategy: strategy,
    rationale:
      "No adaptive observe-decide-act-observe loop with a secondary agentic signal is required, so an Agent is not " +
      `justified; ${strategy === "SKILL_ONLY" ? "semantic judgment is useful, so Skill-only" : "a deterministic function"} ` +
      "is the appropriate execution model (AE-R2, AE-R5).",
  };
}
