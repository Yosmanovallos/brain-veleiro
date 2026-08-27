import type { AgentDefinition, JsonSchemaLike, ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import { researcherDefinition } from "../../src/intelligence/agent-definitions/researcherDefinition.js";
import { classifyAgentNeed } from "../../src/intelligence/agent-engineering/classifyAgentNeed.js";
import { selectReusableAgent } from "../../src/intelligence/agent-engineering/selectReusableAgent.js";
import { buildProposedAgentDefinition } from "../../src/intelligence/agent-engineering/buildProposedAgentDefinition.js";
import { mapAgentEngineeringResultToStructuredOutput } from "../../src/intelligence/agent-engineering/validateAgentEngineeringResult.js";
import {
  AGENT_ENGINEERING_INPUT_MARKER,
  AGENT_ENGINEERING_SKILL_MATERIALIZATION_MARKER,
} from "../../src/intelligence/agent-engineering/materializeAgentEngineeringTask.js";
import type {
  AgentEngineeringInput,
  AgentEngineeringResult,
  AgentEngineeringWorkUnit,
  AgentEvalCategory,
  AgentEvalPlanItem,
  AgentNeedDecision,
  AgentStateDesign,
  AvailableAgentDescriptor,
  AvailableCapabilityDescriptor,
  CapabilityDesign,
  ProposedAgentDesign,
} from "../../src/intelligence/agent-engineering/types.js";

/**
 * Canonical S13E fixtures.
 *
 * Implements brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections
 * 28-32, 37 and brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md
 * sections 28-33. The `SKILL` synthesizer is a genuine rule-based function
 * that drives the real production pieces (classifyAgentNeed,
 * selectReusableAgent, buildProposedAgentDefinition) from the actual bounded
 * input — mutating a behavior signal or a capability list measurably changes
 * its output (Agent spec section 42). The `BASELINE` synthesizer reproduces
 * the canonical over-agentifying mistake Skill file section 2.4 / Agent spec
 * section 40 describe: it designs a new Agent for every work unit, grants
 * every available capability, enables cross-run memory, inflates limits, and
 * ships a single happy-path eval.
 *
 * This file MUST NOT import tests/agent-engineering/fixtureTruth.ts — the
 * runtime path never sees a ground-truth value (AE-R26). The test suite
 * asserts this mechanically.
 */

// ---------------------------------------------------------------------------
// Shared schema/vocabulary
// ---------------------------------------------------------------------------

const OUTPUT_SCHEMA: JsonSchemaLike = {
  type: "object",
  required: ["summary", "status"],
  properties: { summary: { type: "string" }, status: { type: "string" } },
  additionalProperties: false,
};

const RENDER_OUTPUT_SCHEMA: JsonSchemaLike = {
  type: "object",
  required: ["markdown"],
  properties: { markdown: { type: "string" } },
  additionalProperties: false,
};

const APPROVAL_NOTE =
  "This Agent-engineering result is a proposal. Human approval is required before a new AgentDefinition is registered, activated, or treated as durable execution authority.";

const INCIDENT_QC = "brain-bootstrap/quality-contracts/S13E_AGENT_ENGINEERING_DEEP.yaml";
const RESEARCH_QC = "brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml";

// Fixture-declared within-run state fields per task kind (legitimate
// test-harness knowledge; a real Agent run would derive these via model
// judgment). Keyed by task_kind.
const STATE_FIELDS_BY_TASK_KIND: Record<string, AgentStateDesign> = {
  "incident-investigation": {
    purpose: "Track the evolving incident hypothesis and the observations gathered so far within a single investigation run.",
    fields: [
      { name: "current_hypothesis", type: "string", required: true, description: "The working explanation for the incident, updated as logs are inspected." },
      { name: "observations", type: "array", required: true, description: "Ordered log/record observations gathered this run." },
      { name: "attempt", type: "number", required: true, description: "Replan counter, bounded by the iteration budget." },
    ],
  },
  "long-horizon-triage": {
    purpose: "Track the current triage case and the prior-run references consulted within one triage pass.",
    fields: [
      { name: "current_case", type: "string", required: true, description: "The case currently being triaged." },
      { name: "prior_run_refs", type: "array", required: false, description: "References to verified prior-run history consulted this pass." },
      { name: "step", type: "number", required: true, description: "Replan/step counter, bounded by the iteration budget." },
    ],
  },
};

// ---------------------------------------------------------------------------
// Canonical work units / inputs
// ---------------------------------------------------------------------------

function incidentCapabilities(includeLogs: boolean): AvailableCapabilityDescriptor[] {
  const caps: AvailableCapabilityDescriptor[] = [
    { id: "incident.read", description: "Read the incident record.", side_effect_class: "NONE" },
  ];
  if (includeLogs) caps.push({ id: "incident.logs", description: "Read selected system logs.", side_effect_class: "NONE" });
  caps.push({ id: "incident.admin", description: "Administrative incident mutations (close, reassign).", side_effect_class: "LOCAL" });
  return caps;
}

const INCIDENT_WORK_UNIT: AgentEngineeringWorkUnit = {
  id: "wu-incident-investigator",
  task_kind: "incident-investigation",
  goal:
    "Investigate an incident by reading the incident record, choosing which logs to inspect based on observations, " +
    "updating a hypothesis, and retrying/replanning until the incident has a bounded evidence-backed explanation or " +
    "the iteration budget is exhausted.",
  description: "Adaptive incident investigation over a local incident record and system logs.",
  expected_output_schema: OUTPUT_SCHEMA,
  quality_contract_ref: INCIDENT_QC,
  success_conditions: ["A bounded evidence-backed explanation is produced, or the iteration budget is exhausted with the best current hypothesis."],
  constraints: ["No administrative incident mutations."],
  allowed_context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF"],
  required_capability_ids: ["incident.read", "incident.logs"],
  optional_capability_ids: ["incident.admin"],
  allowed_side_effect_classes: ["NONE"],
  behavior: {
    fixed_steps_known_in_advance: false,
    semantic_judgment_required: true,
    next_action_depends_on_observation: true,
    requires_conditional_capability_use: true,
    requires_retry_or_replan: true,
    requires_within_run_state: true,
    requires_cross_run_history: false,
  },
  iteration_budget: { max_turns: 8, timeout_ms: 12000 },
  source_refs: ["incident-brief", "kiosk-ops-runbook"],
};

export const POSITIVE_INPUT: AgentEngineeringInput = {
  work_unit: INCIDENT_WORK_UNIT,
  available_agents: [],
  available_skill_ids: [],
  available_capabilities: incidentCapabilities(true),
};

/** Blocked-capability fixture (Agent spec section 32 / T15): incident.logs removed. */
export const BLOCKED_INPUT: AgentEngineeringInput = {
  work_unit: INCIDENT_WORK_UNIT,
  available_agents: [],
  available_skill_ids: [],
  available_capabilities: incidentCapabilities(false),
};

/** Mutation A (Agent spec section 42 / T29): the adaptive signals are relaxed to a fixed one-pass transformation. */
export const POSITIVE_INPUT_MUTATION_A: AgentEngineeringInput = {
  ...POSITIVE_INPUT,
  work_unit: {
    ...INCIDENT_WORK_UNIT,
    behavior: {
      fixed_steps_known_in_advance: true,
      semantic_judgment_required: false,
      next_action_depends_on_observation: false,
      requires_conditional_capability_use: false,
      requires_retry_or_replan: false,
      requires_within_run_state: false,
      requires_cross_run_history: false,
    },
  },
};

const RENDER_WORK_UNIT: AgentEngineeringWorkUnit = {
  id: "wu-adr-markdown-render",
  task_kind: "deterministic-render",
  goal: "Render a validated ArchitectureDecisionRecord into Markdown using a fixed canonical section order.",
  description: "Pure structural transformation of a typed ADR object into Markdown.",
  expected_output_schema: RENDER_OUTPUT_SCHEMA,
  quality_contract_ref: INCIDENT_QC,
  success_conditions: ["The Markdown contains every canonical section in canonical order."],
  constraints: ["No semantic content beyond the structured ADR fields."],
  allowed_context_sources: ["CURRENT_TASK"],
  required_capability_ids: [],
  optional_capability_ids: [],
  allowed_side_effect_classes: ["NONE"],
  behavior: {
    fixed_steps_known_in_advance: true,
    semantic_judgment_required: false,
    next_action_depends_on_observation: false,
    requires_conditional_capability_use: false,
    requires_retry_or_replan: false,
    requires_within_run_state: false,
    requires_cross_run_history: false,
  },
  iteration_budget: { max_turns: 4, timeout_ms: 8000 },
  source_refs: ["adr-renderer-spec"],
};

export const NEGATIVE_INPUT: AgentEngineeringInput = {
  work_unit: RENDER_WORK_UNIT,
  available_agents: [],
  available_skill_ids: [],
  available_capabilities: [],
};

const CHECKLIST_WORK_UNIT: AgentEngineeringWorkUnit = {
  id: "wu-architecture-rubric-review",
  task_kind: "semantic-checklist-review",
  goal: "Review a supplied architecture summary against a bounded static architecture checklist and return structured findings in one pass.",
  description: "One-pass semantic checklist review; no adaptive loop, no capability use.",
  expected_output_schema: OUTPUT_SCHEMA,
  quality_contract_ref: INCIDENT_QC,
  success_conditions: ["Every checklist item has a structured finding."],
  constraints: ["Single bounded decision pass."],
  allowed_context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC"],
  required_capability_ids: [],
  optional_capability_ids: [],
  allowed_side_effect_classes: ["NONE"],
  behavior: {
    fixed_steps_known_in_advance: true,
    semantic_judgment_required: true,
    next_action_depends_on_observation: false,
    requires_conditional_capability_use: false,
    requires_retry_or_replan: false,
    requires_within_run_state: false,
    requires_cross_run_history: false,
  },
  iteration_budget: { max_turns: 4, timeout_ms: 8000 },
  source_refs: ["architecture-checklist"],
};

export const SKILL_ONLY_INPUT: AgentEngineeringInput = {
  work_unit: CHECKLIST_WORK_UNIT,
  available_agents: [],
  available_skill_ids: [],
  available_capabilities: [],
};

const RESEARCH_WORK_UNIT: AgentEngineeringWorkUnit = {
  id: "wu-evidence-research",
  task_kind: "evidence-research",
  goal:
    "Research an open question by adaptively choosing lookups based on prior observations, retrying/replanning, " +
    "maintaining within-run research state, and drawing on verified prior-run research history.",
  description: "Adaptive evidence research with conditional research.lookup use and cross-run history.",
  expected_output_schema: OUTPUT_SCHEMA,
  quality_contract_ref: RESEARCH_QC,
  success_conditions: ["A bounded evidence-backed answer or an explicit unresolved gap."],
  constraints: ["Read-only research only."],
  allowed_context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "DURABLE_MEMORY", "HISTORICAL_SESSION"],
  required_capability_ids: ["research.lookup"],
  optional_capability_ids: [],
  allowed_side_effect_classes: ["NONE"],
  behavior: {
    fixed_steps_known_in_advance: false,
    semantic_judgment_required: true,
    next_action_depends_on_observation: true,
    requires_conditional_capability_use: true,
    requires_retry_or_replan: true,
    requires_within_run_state: true,
    requires_cross_run_history: true,
  },
  iteration_budget: { max_turns: 12, timeout_ms: 15000 },
  source_refs: ["research-question-brief"],
};

const RESEARCHER_DESCRIPTOR: AvailableAgentDescriptor = {
  definition: researcherDefinition,
  supported_task_kinds: ["evidence-research", "research"],
  compatible_quality_contract_refs: [RESEARCH_QC],
  notes: "Production S11 Researcher — adaptive research.lookup loop with verified cross-run history.",
};

export const REUSE_INPUT: AgentEngineeringInput = {
  work_unit: RESEARCH_WORK_UNIT,
  available_agents: [RESEARCHER_DESCRIPTOR],
  available_skill_ids: [],
  available_capabilities: [{ id: "research.lookup", description: "Bounded read-only reference lookup.", side_effect_class: "NONE" }],
};

const TRIAGE_WORK_UNIT: AgentEngineeringWorkUnit = {
  id: "wu-long-horizon-triage",
  task_kind: "long-horizon-triage",
  goal:
    "Triage an incoming case by adaptively reading prior verified triage history and the current case record, " +
    "replanning as new signals appear, and producing a bounded triage decision.",
  description: "Adaptive triage that genuinely depends on verified cross-run history.",
  expected_output_schema: OUTPUT_SCHEMA,
  quality_contract_ref: INCIDENT_QC,
  success_conditions: ["A bounded triage decision with cited prior-run references."],
  constraints: ["Read-only triage; no case mutations."],
  allowed_context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "DURABLE_MEMORY", "HISTORICAL_SESSION"],
  required_capability_ids: ["triage.read"],
  optional_capability_ids: ["triage.write"],
  allowed_side_effect_classes: ["NONE"],
  behavior: {
    fixed_steps_known_in_advance: false,
    semantic_judgment_required: true,
    next_action_depends_on_observation: true,
    requires_conditional_capability_use: true,
    requires_retry_or_replan: true,
    requires_within_run_state: true,
    requires_cross_run_history: true,
  },
  iteration_budget: { max_turns: 14, timeout_ms: 20000 },
  source_refs: ["triage-policy"],
};

export const CROSS_RUN_MEMORY_INPUT: AgentEngineeringInput = {
  work_unit: TRIAGE_WORK_UNIT,
  available_agents: [],
  available_skill_ids: [],
  available_capabilities: [
    { id: "triage.read", description: "Read case records and prior triage history.", side_effect_class: "NONE" },
    { id: "triage.write", description: "Mutate case triage state.", side_effect_class: "LOCAL" },
  ],
};

// ---------------------------------------------------------------------------
// Design-input helpers (fixture-declared design content for DESIGN_NEW)
// ---------------------------------------------------------------------------

function stateDesignFor(taskKind: string): AgentStateDesign {
  return (
    STATE_FIELDS_BY_TASK_KIND[taskKind] ?? {
      purpose: `Minimal within-run state for '${taskKind}'.`,
      fields: [{ name: "step", type: "number", required: true, description: "Replan/step counter bounded by the iteration budget." }],
    }
  );
}

function capabilityDesignFor(input: AgentEngineeringInput): CapabilityDesign {
  const wu = input.work_unit;
  const selected = [...wu.required_capability_ids];
  const rejected = input.available_capabilities
    .filter((c) => !selected.includes(c.id))
    .map((c) => ({ id: c.id, reason: "Not required for the work unit's adaptive loop; excluded by least privilege (AE-R11)." }));
  return {
    selected_capability_ids: selected,
    required_capability_ids: [...wu.required_capability_ids],
    optional_capabilities_selected: [],
    rejected_available_capabilities: rejected,
  };
}

function evalPlanFor(taskKind: string, crossRunMemory: boolean): AgentEvalPlanItem[] {
  const base: AgentEvalCategory[] = ["GOAL_SUCCESS", "OUTPUT_CONTRACT", "LEAST_PRIVILEGE", "TERMINATION", "NEGATIVE_SAFETY"];
  const categories = crossRunMemory ? [...base, "MEMORY_POLICY" as AgentEvalCategory] : base;
  return categories.map((category) => ({
    category,
    ref: `evals/${taskKind}/${category.toLowerCase().replace(/_/g, "-")}`,
    rationale: `Covers the ${category} dimension for the '${taskKind}' Agent (AE-R19).`,
  }));
}

// ---------------------------------------------------------------------------
// Genuine, input-derived SKILL synthesis
// ---------------------------------------------------------------------------

function noAgentResult(input: AgentEngineeringInput): AgentEngineeringResult {
  const classification = classifyAgentNeed(input.work_unit.behavior);
  const strategy = classification.non_agent_strategy;
  const need_decision: AgentNeedDecision = {
    status: "READY",
    agent_requirement: "NO_AGENT",
    non_agent_strategy: strategy,
    agent_action: null,
    reuse_agent_id: null,
    rationale: classification.rationale,
    evidence_refs: [...input.work_unit.source_refs],
    blocking_reasons: [],
  };
  return {
    work_unit_id: input.work_unit.id,
    proposal_status: "PROPOSED",
    approval_required: true,
    need_decision,
    design: null,
    reuse_agent_id: null,
    non_agent_recommendation: strategy === null ? null : { strategy, rationale: classification.rationale },
    warnings: [],
    approval_note: APPROVAL_NOTE,
  };
}

function reuseResult(input: AgentEngineeringInput, reuseAgentId: string, rationale: string): AgentEngineeringResult {
  const need_decision: AgentNeedDecision = {
    status: "READY",
    agent_requirement: "AGENT_REQUIRED",
    non_agent_strategy: null,
    agent_action: "REUSE_EXISTING",
    reuse_agent_id: reuseAgentId,
    rationale,
    evidence_refs: [...input.work_unit.source_refs],
    blocking_reasons: [],
  };
  return {
    work_unit_id: input.work_unit.id,
    proposal_status: "PROPOSED",
    approval_required: true,
    need_decision,
    design: null,
    reuse_agent_id: reuseAgentId,
    non_agent_recommendation: null,
    warnings: [],
    approval_note: APPROVAL_NOTE,
  };
}

function blockedResult(input: AgentEngineeringInput, blockingReasons: string[]): AgentEngineeringResult {
  const need_decision: AgentNeedDecision = {
    status: "BLOCKED",
    agent_requirement: "AGENT_REQUIRED",
    non_agent_strategy: null,
    agent_action: null,
    reuse_agent_id: null,
    rationale: "An Agent is required, but a safe candidate AgentDefinition cannot be authored from the bounded input.",
    evidence_refs: [...input.work_unit.source_refs],
    blocking_reasons: blockingReasons,
  };
  return {
    work_unit_id: input.work_unit.id,
    proposal_status: "PROPOSED",
    approval_required: true,
    need_decision,
    design: null,
    reuse_agent_id: null,
    non_agent_recommendation: null,
    warnings: [],
    approval_note: APPROVAL_NOTE,
  };
}

export function synthesizeSkillAgentEngineeringResult(input: AgentEngineeringInput): AgentEngineeringResult {
  const classification = classifyAgentNeed(input.work_unit.behavior);

  if (classification.agent_requirement === "NO_AGENT") {
    return noAgentResult(input);
  }

  const reuse = selectReusableAgent(input);
  if (reuse.reuse_agent_id !== null) {
    return reuseResult(input, reuse.reuse_agent_id, reuse.rationale);
  }

  const wu = input.work_unit;
  const crossRunMemory = wu.behavior.requires_cross_run_history;
  const capabilityDesign = capabilityDesignFor(input);
  const stateDesign = stateDesignFor(wu.task_kind);
  const evalPlan = evalPlanFor(wu.task_kind, crossRunMemory);

  const build = buildProposedAgentDefinition({
    workUnit: wu,
    stateDesign,
    capabilityDesign,
    evalPlan,
    availableCapabilities: input.available_capabilities,
    requiresCrossRunHistory: crossRunMemory,
    candidateSkills: [],
  });

  if (!build.ok) {
    return blockedResult(input, build.blocking_reasons);
  }

  const design: ProposedAgentDesign = {
    proposal_status: "PROPOSED",
    candidate_definition: build.candidate,
    goal_rationale: `The candidate objective mirrors the work-unit goal for '${wu.task_kind}' without adding unrequested responsibilities (AE-R14 objective).`,
    state_design: stateDesign,
    capability_design: capabilityDesign,
    permission_rationale: `Only the side-effect classes required by the selected capabilities are granted; deny_unlisted_capabilities stays true (AE-R12).`,
    memory_rationale: crossRunMemory
      ? "The work unit explicitly requires verified cross-run history, so bounded retrieval/history is enabled; commit_verified_memory stays false (AE-R14, AE-R15)."
      : "The work unit does not require cross-run history, so all durable memory is disabled (AE-R14, AE-R15).",
    termination_design: {
      require_terminal_outcome: true,
      require_explanation: true,
      max_turns: build.candidate.limits.max_turns,
      timeout_ms: build.candidate.limits.timeout_ms,
      stop_rationale: `Bounded by the work-unit iteration budget (${wu.iteration_budget!.max_turns} turns / ${wu.iteration_budget!.timeout_ms} ms); canonical S09 terminal semantics preserved (AE-R16, AE-R17).`,
    },
    eval_plan: evalPlan,
    model_policy_rationale: "Provider-neutral QUALITY routing for a high-ambiguity adaptive task; structured decisions required (Skill file section 17).",
    context_policy_rationale: "Bounded, source-ref-aware context restricted to the work unit's allowed context sources; no full catalogs (AE-R21).",
    skill_selection_rationale: "No supplied available Skill is required for this Agent loop; candidate skills left empty (Skill file section 16).",
    limitations: [],
  };

  const need_decision: AgentNeedDecision = {
    status: "READY",
    agent_requirement: "AGENT_REQUIRED",
    non_agent_strategy: null,
    agent_action: "DESIGN_NEW",
    reuse_agent_id: null,
    rationale: classification.rationale,
    evidence_refs: [...wu.source_refs],
    blocking_reasons: [],
  };

  return {
    work_unit_id: wu.id,
    proposal_status: "PROPOSED",
    approval_required: true,
    need_decision,
    design,
    reuse_agent_id: null,
    non_agent_recommendation: null,
    warnings: [],
    approval_note: APPROVAL_NOTE,
  };
}

// ---------------------------------------------------------------------------
// Naive BASELINE synthesis (no Skill) — the canonical over-agentifying mistake
// ---------------------------------------------------------------------------

function naiveCandidateDefinition(input: AgentEngineeringInput): AgentDefinition {
  const wu = input.work_unit;
  const allIds = input.available_capabilities.map((c) => c.id);
  const budgetTurns = (wu.iteration_budget?.max_turns ?? 6) + 20;
  const budgetTimeout = (wu.iteration_budget?.timeout_ms ?? 10000) + 30000;

  // Naive: grant every side-effect class that appears in the catalog.
  const sideEffects = Array.from(new Set(input.available_capabilities.map((c) => c.side_effect_class)));
  const allowed_side_effects = sideEffects.length > 0 ? sideEffects : (["NONE"] as const);

  return {
    id: `${wu.task_kind}-agent`,
    role: wu.task_kind,
    objective: wu.goal,
    model_policy: { routing_class: "QUALITY", require_structured_decisions: true, allow_provider_substitution: true },
    context_policy: {
      retrieval_mode: "BOUNDED",
      max_context_tokens: 32000,
      max_items: 200,
      allowed_sources: wu.allowed_context_sources.length > 0 ? [...wu.allowed_context_sources] : ["CURRENT_TASK"],
      require_source_refs: true,
    },
    state_schema: { type: "object", properties: {} },
    tools: [...allIds],
    skills: [],
    capabilities: [...allIds],
    memory_policy: {
      retrieve: true,
      remember_candidate: true,
      commit_verified_memory: true,
      search_history: true,
      promotion_policy: "EXPLICIT_VERIFIED_ONLY",
    },
    permissions: { allowed_side_effects: [...allowed_side_effects], deny_unlisted_capabilities: true },
    delegation: { allowed: false },
    limits: { max_turns: budgetTurns, timeout_ms: budgetTimeout },
    termination: { require_terminal_outcome: true, require_explanation: true },
    output_schema: structuredClone(wu.expected_output_schema),
    rubric: { quality_contract_ref: wu.quality_contract_ref },
    evals: [`evals/${wu.task_kind}/goal-success`],
  };
}

export function synthesizeBaselineAgentEngineeringResult(input: AgentEngineeringInput): AgentEngineeringResult {
  const wu = input.work_unit;
  const candidate = naiveCandidateDefinition(input);
  const selected = [...candidate.capabilities];

  const capability_design: CapabilityDesign = {
    selected_capability_ids: selected,
    required_capability_ids: [...wu.required_capability_ids],
    optional_capabilities_selected: [],
    rejected_available_capabilities: [],
  };

  const design: ProposedAgentDesign = {
    proposal_status: "PROPOSED",
    candidate_definition: candidate,
    goal_rationale: "",
    state_design: { purpose: "", fields: [] },
    capability_design,
    permission_rationale: "",
    memory_rationale: "",
    termination_design: {
      require_terminal_outcome: true,
      require_explanation: true,
      max_turns: candidate.limits.max_turns,
      timeout_ms: candidate.limits.timeout_ms,
      stop_rationale: "",
    },
    eval_plan: [{ category: "GOAL_SUCCESS", ref: `evals/${wu.task_kind}/goal-success`, rationale: "" }],
    model_policy_rationale: "",
    context_policy_rationale: "",
    skill_selection_rationale: "",
    limitations: [],
  };

  const need_decision: AgentNeedDecision = {
    status: "READY",
    agent_requirement: "AGENT_REQUIRED",
    non_agent_strategy: null,
    agent_action: "DESIGN_NEW",
    reuse_agent_id: null,
    rationale: "This looks like a substantial task, so build an agent for it.",
    evidence_refs: [...wu.source_refs],
    blocking_reasons: [],
  };

  return {
    work_unit_id: wu.id,
    proposal_status: "PROPOSED",
    approval_required: true,
    need_decision,
    design,
    reuse_agent_id: null,
    non_agent_recommendation: null,
    warnings: [],
    approval_note: APPROVAL_NOTE,
  };
}

// ---------------------------------------------------------------------------
// Deterministic ModelProvider — always FINISHes on the first turn (S13E issues
// no tool calls; zero capabilities). Branches purely on whether the
// materialized objective contains the SKILL_ID marker.
// ---------------------------------------------------------------------------

function extractAgentEngineeringInput(goalText: string): AgentEngineeringInput {
  const markerIndex = goalText.indexOf(AGENT_ENGINEERING_INPUT_MARKER);
  if (markerIndex === -1) throw new Error("DeterministicAgentEngineeringModelProvider: input marker not found in goal text.");
  const afterMarker = goalText.slice(markerIndex + AGENT_ENGINEERING_INPUT_MARKER.length).trim();
  const jsonEnd = afterMarker.indexOf("\n\n");
  const jsonText = jsonEnd === -1 ? afterMarker : afterMarker.slice(0, jsonEnd);
  return JSON.parse(jsonText) as AgentEngineeringInput;
}

export class DeterministicAgentEngineeringModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const goalText = request.goal.statement;
    const input = extractAgentEngineeringInput(goalText);
    const skillMode = goalText.includes(AGENT_ENGINEERING_SKILL_MATERIALIZATION_MARKER);

    const result = skillMode
      ? synthesizeSkillAgentEngineeringResult(input)
      : synthesizeBaselineAgentEngineeringResult(input);

    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: skillMode
          ? "Applied the materialized Agent Engineering Skill rules/procedure to the input."
          : "No Skill was materialized for this task; produced a naive best-effort agent design.",
        output: mapAgentEngineeringResultToStructuredOutput(result),
      },
    };
  }
}
