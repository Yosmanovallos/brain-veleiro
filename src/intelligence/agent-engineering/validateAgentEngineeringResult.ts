import type { StructuredAgentOutput } from "../../core/agent/index.js";
import { validateAgentDefinition } from "../../core/agent/index.js";
import { computeDesignGaps } from "./buildProposedAgentDefinition.js";
import { isReusableAgentCompatible } from "./selectReusableAgent.js";
import type {
  AgentEngineeringInput,
  AgentEngineeringResult,
  AgentEvalCategory,
  ProposedAgentDesign,
} from "./types.js";

/**
 * Deterministic S13E AgentEngineeringResult validation.
 *
 * Implements brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md sections
 * 1, 9-23 and brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections
 * 7-31 (need-decision internal consistency, DESIGN_NEW candidate S10
 * validity, tools==capabilities subset-of-available, least privilege,
 * memory/permission/termination/eval policy, PROPOSED/approval_required
 * semantics, BLOCKED => design == null, no invented refs).
 *
 * This validator checks the OUTPUT's own structural completeness and
 * self-consistency against the bounded INPUT. It never reads a fixture-truth
 * object (AE-R26) — the skill-vs-baseline comparison in
 * ./compareAgentEngineeringRuns.ts is the only module that touches truth, and
 * only after runtime outputs already exist.
 */

const REQUIRED_EVAL_CATEGORIES: AgentEvalCategory[] = [
  "GOAL_SUCCESS",
  "OUTPUT_CONTRACT",
  "LEAST_PRIVILEGE",
  "TERMINATION",
  "NEGATIVE_SAFETY",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (new Set(a).size !== a.length || new Set(b).size !== b.length) return false;
  const setB = new Set(b);
  if (new Set(a).size !== setB.size) return false;
  for (const x of a) if (!setB.has(x)) return false;
  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The universe of evidence refs a need_decision is allowed to cite (AE-R7):
 * the work-unit source_refs, its capability/skill/context identifiers, and —
 * when an S13D architecture_decision is supplied — its architecture_question.
 * A ref outside this universe cannot be traced to anything the run had, so it
 * is treated as invented.
 */
export function computeResolvableAgentEngineeringRefs(input: AgentEngineeringInput): Set<string> {
  const refs = new Set<string>();
  for (const ref of input.work_unit.source_refs) refs.add(ref);
  refs.add(input.work_unit.id);
  refs.add(input.work_unit.task_kind);
  refs.add(input.work_unit.quality_contract_ref);
  for (const c of input.available_capabilities) refs.add(c.id);
  for (const s of input.available_skill_ids) refs.add(s);
  for (const a of input.available_agents) refs.add(a.definition.id);
  if (input.architecture_decision) refs.add(input.architecture_decision.architecture_question);
  return refs;
}

function validateProposedDesign(
  design: ProposedAgentDesign,
  input: AgentEngineeringInput,
  errors: string[],
): void {
  const wu = input.work_unit;

  if (design.proposal_status !== "PROPOSED") {
    errors.push(`design.proposal_status must be 'PROPOSED', got '${String(design.proposal_status)}' (AE-R25)`);
  }

  const candidate = design.candidate_definition;
  if (!candidate) {
    errors.push("design.candidate_definition is required for DESIGN_NEW (Skill file section 10)");
    return;
  }

  const s10 = validateAgentDefinition(candidate);
  if (!s10.valid) {
    errors.push(`design.candidate_definition failed S10 validation: ${s10.errors.join("; ")} (AE-R9, AE-V5)`);
  }

  // Tools == capabilities == selected_capability_ids (AE-R10, AE-V6).
  if (!sameSet(candidate.tools, candidate.capabilities)) {
    errors.push("candidate tools and capabilities must be the identical normalized set (AE-R10)");
  }
  if (!sameSet(candidate.capabilities, design.capability_design.selected_capability_ids)) {
    errors.push("candidate capabilities must equal capability_design.selected_capability_ids (AE-R10)");
  }

  const availableIds = new Set(input.available_capabilities.map((c) => c.id));
  for (const id of candidate.capabilities) {
    if (!availableIds.has(id)) {
      errors.push(`candidate capability '${id}' is absent from the bounded available_capabilities list (AE-R10, AE-V6)`);
    }
  }
  for (const requiredId of wu.required_capability_ids) {
    if (!candidate.capabilities.includes(requiredId)) {
      errors.push(`required capability '${requiredId}' is missing from the candidate capability set (AE-R11)`);
    }
  }
  // Optional capabilities excluded unless explicitly justified (AE-R11).
  const justifiedOptional = new Set(design.capability_design.optional_capabilities_selected.map((o) => o.id));
  for (const id of candidate.capabilities) {
    if (wu.required_capability_ids.includes(id)) continue;
    if (!justifiedOptional.has(id)) {
      errors.push(`candidate selected non-required capability '${id}' without an explicit optional_capabilities_selected rationale (AE-R11)`);
    }
  }
  for (const opt of design.capability_design.optional_capabilities_selected) {
    if (!isNonEmptyString(opt.rationale)) {
      errors.push(`optional_capabilities_selected entry '${opt.id}' must carry a non-empty rationale (AE-R11)`);
    }
  }

  // Permissions (AE-R12).
  if (candidate.permissions.deny_unlisted_capabilities !== true) {
    errors.push("candidate.permissions.deny_unlisted_capabilities must be true (AE-R12)");
  }
  const allowedSet = new Set(wu.allowed_side_effect_classes);
  const sideEffectById = new Map(input.available_capabilities.map((c) => [c.id, c.side_effect_class]));
  const neededSideEffects = new Set(candidate.capabilities.map((id) => sideEffectById.get(id)).filter(Boolean));
  for (const effect of candidate.permissions.allowed_side_effects) {
    if (effect === "NONE") continue;
    if (!allowedSet.has(effect)) {
      errors.push(`candidate.permissions.allowed_side_effects contains '${effect}', broader than work_unit.allowed_side_effect_classes (AE-R12)`);
    }
  }
  for (const needed of neededSideEffects) {
    if (needed && needed !== "NONE" && !candidate.permissions.allowed_side_effects.includes(needed)) {
      errors.push(`candidate.permissions.allowed_side_effects is missing side-effect class '${needed}' required by a selected capability (AE-R12)`);
    }
  }
  if (candidate.capabilities.length === 0 && !deepEqual(candidate.permissions.allowed_side_effects, ["NONE"])) {
    errors.push("a candidate with zero capabilities must set allowed_side_effects == [\"NONE\"] (Skill file section 13)");
  }

  // Memory (AE-R13, AE-R14, AE-R15).
  const mem = candidate.memory_policy;
  if (mem.commit_verified_memory !== false) {
    errors.push("candidate.memory_policy.commit_verified_memory must be false in S13E v1 (AE-R15)");
  }
  if (!wu.behavior.requires_cross_run_history) {
    if (mem.retrieve !== false || mem.remember_candidate !== false || mem.search_history !== false || mem.promotion_policy !== "DISABLED") {
      errors.push("cross-run memory must be fully disabled unless work_unit.behavior.requires_cross_run_history is true (AE-R14)");
    }
  } else if (mem.promotion_policy !== "EXPLICIT_VERIFIED_ONLY" && mem.promotion_policy !== "DISABLED") {
    errors.push("candidate.memory_policy.promotion_policy must be DISABLED or EXPLICIT_VERIFIED_ONLY (AE-R15)");
  }

  // Delegation (AE-R22).
  if (candidate.delegation.allowed !== false) {
    errors.push("candidate.delegation.allowed must be false (AE-R22)");
  }

  // Termination + limits (AE-R16, AE-R17).
  if (candidate.termination.require_terminal_outcome !== true || candidate.termination.require_explanation !== true) {
    errors.push("candidate.termination must preserve canonical S09/S10 terminal semantics (AE-R16)");
  }
  if (wu.iteration_budget) {
    if (candidate.limits.max_turns > wu.iteration_budget.max_turns) {
      errors.push(`candidate.limits.max_turns (${candidate.limits.max_turns}) exceeds the work-unit iteration budget (${wu.iteration_budget.max_turns}) (AE-R17)`);
    }
    if (candidate.limits.timeout_ms > wu.iteration_budget.timeout_ms) {
      errors.push(`candidate.limits.timeout_ms (${candidate.limits.timeout_ms}) exceeds the work-unit iteration budget (${wu.iteration_budget.timeout_ms}) (AE-R17)`);
    }
  } else {
    errors.push("work_unit.iteration_budget is required to bound an adaptive-loop candidate (AE-R17, AE-R23)");
  }

  // Output schema + rubric (AE-R18, AE-R20).
  if (!deepEqual(candidate.output_schema, wu.expected_output_schema)) {
    errors.push("candidate.output_schema must equal work_unit.expected_output_schema (AE-R18, AE-R20)");
  }
  if (candidate.rubric.quality_contract_ref !== wu.quality_contract_ref) {
    errors.push("candidate.rubric.quality_contract_ref must equal work_unit.quality_contract_ref (AE-R20)");
  }

  // Context policy (AE-R21).
  if (candidate.context_policy.retrieval_mode !== "BOUNDED" || candidate.context_policy.require_source_refs !== true) {
    errors.push("candidate.context_policy must be BOUNDED and require_source_refs true (AE-R21)");
  }
  const allowedContextSources = new Set(wu.allowed_context_sources);
  if (candidate.context_policy.allowed_sources.length === 0) {
    errors.push("candidate.context_policy.allowed_sources must be a non-empty subset of work_unit.allowed_context_sources (AE-R21)");
  }
  for (const src of candidate.context_policy.allowed_sources) {
    if (!allowedContextSources.has(src)) {
      errors.push(`candidate.context_policy.allowed_sources contains '${src}', not permitted by work_unit.allowed_context_sources (AE-R21)`);
    }
  }

  // State schema (AE-R18).
  if (design.state_design.fields.length === 0) {
    errors.push("design.state_design.fields must describe at least one within-run state field (AE-R18)");
  }

  // Eval plan (AE-R19).
  const categories = new Set(design.eval_plan.map((e) => e.category));
  for (const required of REQUIRED_EVAL_CATEGORIES) {
    if (!categories.has(required)) {
      errors.push(`design.eval_plan is missing the required '${required}' eval category (AE-R19)`);
    }
  }
  if (wu.behavior.requires_cross_run_history && !categories.has("MEMORY_POLICY")) {
    errors.push("design.eval_plan must include a MEMORY_POLICY eval when cross-run memory is enabled (Skill file section 21)");
  }
  for (const item of design.eval_plan) {
    if (!isNonEmptyString(item.ref)) errors.push("every design.eval_plan item must carry a non-empty ref (AE-R19)");
    if (!isNonEmptyString(item.rationale)) errors.push("every design.eval_plan item must carry a non-empty rationale (AE-R19)");
  }
  if (candidate.evals.length === 0) {
    errors.push("candidate.evals must be a non-empty ordered list of eval_plan refs (AE-R19)");
  }
  if (!deepEqual(candidate.evals, dedupePreserveOrder(design.eval_plan.map((e) => e.ref)))) {
    errors.push("candidate.evals must be the ordered, de-duplicated list of design.eval_plan refs (AE-R19)");
  }

  // Rationale completeness (AE-V12, Skill file section 10).
  for (const [field, value] of [
    ["goal_rationale", design.goal_rationale],
    ["permission_rationale", design.permission_rationale],
    ["memory_rationale", design.memory_rationale],
    ["model_policy_rationale", design.model_policy_rationale],
    ["context_policy_rationale", design.context_policy_rationale],
    ["skill_selection_rationale", design.skill_selection_rationale],
  ] as const) {
    if (!isNonEmptyString(value)) errors.push(`design.${field} must be a non-empty rationale string (AE-V12)`);
  }
  if (!isNonEmptyString(design.termination_design.stop_rationale)) {
    errors.push("design.termination_design.stop_rationale must be a non-empty string (AE-R17)");
  }

  // Candidate skills must be a subset of available_skill_ids (Skill file section 16).
  const availableSkills = new Set(input.available_skill_ids);
  for (const skillId of candidate.skills) {
    if (!availableSkills.has(skillId)) {
      errors.push(`candidate.skills contains '${skillId}', which is not in the bounded available_skill_ids (Skill file section 16)`);
    }
  }
}

function dedupePreserveOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

export interface AgentEngineeringResultValidation {
  valid: boolean;
  errors: string[];
}

export function validateAgentEngineeringResult(
  result: AgentEngineeringResult,
  input: AgentEngineeringInput,
): AgentEngineeringResultValidation {
  const errors: string[] = [];

  if (result?.proposal_status !== "PROPOSED") errors.push("proposal_status must be 'PROPOSED' (AE-R25)");
  if (result?.approval_required !== true) errors.push("approval_required must be true (AE-R25)");
  if (result?.work_unit_id !== input.work_unit.id) errors.push("work_unit_id must match input.work_unit.id");
  if (!isNonEmptyString(result?.approval_note)) errors.push("approval_note must be a non-empty string (AE-R25)");

  const nd = result?.need_decision;
  if (!nd) {
    errors.push("need_decision is required");
    return { valid: false, errors };
  }

  const resolvable = computeResolvableAgentEngineeringRefs(input);
  for (const ref of nd.evidence_refs) {
    if (!resolvable.has(ref)) {
      errors.push(`need_decision cites unresolvable/invented evidence ref '${ref}' (AE-R7)`);
    }
  }

  // Internal consistency of the necessity decision (Skill file section 1).
  if (nd.agent_requirement === "NO_AGENT") {
    if (nd.status !== "READY") errors.push("NO_AGENT must have need_decision.status READY");
    if (nd.non_agent_strategy === null) errors.push("NO_AGENT must set a non_agent_strategy (DETERMINISTIC_FUNCTION | SKILL_ONLY)");
    if (nd.agent_action !== null) errors.push("NO_AGENT must set agent_action null");
    if (nd.reuse_agent_id !== null) errors.push("NO_AGENT must set reuse_agent_id null");
    if (result.design !== null) errors.push("NO_AGENT must carry design == null");
    if (result.reuse_agent_id !== null) errors.push("NO_AGENT must carry reuse_agent_id null");
    if (result.non_agent_recommendation === null) errors.push("NO_AGENT must carry a non_agent_recommendation");
    else if (result.non_agent_recommendation.strategy !== nd.non_agent_strategy) {
      errors.push("non_agent_recommendation.strategy must match need_decision.non_agent_strategy");
    }
  } else if (nd.agent_requirement === "AGENT_REQUIRED") {
    if (nd.non_agent_strategy !== null) errors.push("AGENT_REQUIRED must set non_agent_strategy null");
    if (result.non_agent_recommendation !== null) errors.push("AGENT_REQUIRED must carry non_agent_recommendation null");

    if (nd.status === "BLOCKED") {
      if (result.design !== null) errors.push("a BLOCKED result must carry design == null (Agent spec sections 15/22, reference MUST)");
      if (result.reuse_agent_id !== null) errors.push("a BLOCKED result must carry reuse_agent_id null");
      if (nd.blocking_reasons.length === 0) errors.push("a BLOCKED result must state at least one blocking reason (AE-R23)");
      if (computeDesignGaps(input.work_unit, input.available_capabilities).length === 0) {
        errors.push(
          "a BLOCKED result must correspond to at least one real input-level design gap (missing required capability, " +
            "missing iteration budget, empty output schema / quality-contract ref / allowed context sources, or an " +
            "unpermitted required side-effect class) — BLOCKED must not be a self-certified escape hatch (AE-R23)",
        );
      }
    } else if (nd.status === "READY") {
      if (nd.agent_action === "REUSE_EXISTING") {
        if (nd.reuse_agent_id === null) errors.push("REUSE_EXISTING must set need_decision.reuse_agent_id");
        if (result.reuse_agent_id === null) errors.push("REUSE_EXISTING must carry result.reuse_agent_id");
        if (result.reuse_agent_id !== nd.reuse_agent_id) errors.push("result.reuse_agent_id must match need_decision.reuse_agent_id");
        if (result.design !== null) errors.push("REUSE_EXISTING must carry design == null");
        const descriptor = input.available_agents.find((a) => a.definition.id === result.reuse_agent_id);
        if (result.reuse_agent_id !== null && !descriptor) {
          errors.push(`REUSE_EXISTING references '${result.reuse_agent_id}', which is not a supplied available_agents descriptor (AE-R7)`);
        } else if (descriptor && !isReusableAgentCompatible(descriptor, input)) {
          errors.push(
            `REUSE_EXISTING recommends '${result.reuse_agent_id}', but that descriptor does not satisfy every mandatory ` +
              "compatibility condition (task-kind support, required capabilities, no unavailable capability, side-effect " +
              "fit, memory bound, quality-contract compatibility) (AE-R6, Skill file section 3)",
          );
        }
      } else if (nd.agent_action === "DESIGN_NEW") {
        if (nd.reuse_agent_id !== null) errors.push("DESIGN_NEW must set need_decision.reuse_agent_id null");
        if (result.reuse_agent_id !== null) errors.push("DESIGN_NEW must carry result.reuse_agent_id null");
        if (result.design === null) errors.push("DESIGN_NEW must carry a ProposedAgentDesign");
        else validateProposedDesign(result.design, input, errors);
      } else {
        errors.push("AGENT_REQUIRED + READY must set agent_action to REUSE_EXISTING or DESIGN_NEW");
      }
    } else {
      errors.push("need_decision.status must be READY or BLOCKED");
    }
  } else {
    errors.push("need_decision.agent_requirement must be NO_AGENT or AGENT_REQUIRED");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * StructuredAgentOutput mapping (Skill file section 27 / Agent spec section
 * 28): summary is a short recommendation summary; data is the full
 * AgentEngineeringResult; evidence_refs is the deterministic,
 * first-occurrence-de-duplicated union of need_decision.evidence_refs plus the
 * work-unit source refs materially referenced by the design rationale plus
 * (when supplied) S13D refs materially referenced by the result. Available
 * capability IDs and Agent IDs are not evidence refs.
 */
export function mapAgentEngineeringResultToStructuredOutput(result: AgentEngineeringResult): StructuredAgentOutput {
  const seen = new Set<string>();
  const evidence_refs: string[] = [];
  const record = (ref: string) => {
    if (ref && !seen.has(ref)) {
      seen.add(ref);
      evidence_refs.push(ref);
    }
  };
  for (const ref of result.need_decision.evidence_refs) record(ref);

  const nd = result.need_decision;
  let summary: string;
  if (nd.agent_requirement === "NO_AGENT") {
    summary = `No Agent required (${nd.non_agent_strategy}). ${nd.rationale}`;
  } else if (nd.status === "BLOCKED") {
    summary = `Agent required but design is BLOCKED: ${nd.blocking_reasons[0] ?? nd.rationale}`;
  } else if (nd.agent_action === "REUSE_EXISTING") {
    summary = `Reuse existing Agent '${nd.reuse_agent_id}'. ${nd.rationale}`;
  } else {
    summary = `Design a new proposed Agent. ${nd.rationale}`;
  }

  return {
    summary,
    data: result as unknown as Record<string, unknown>,
    evidence_refs,
  };
}
