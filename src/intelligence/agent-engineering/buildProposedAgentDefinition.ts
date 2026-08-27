import type { AgentContextSource, AgentDefinition, AgentMemoryPolicy, JsonSchemaLike, ToolSideEffectClass } from "../../core/agent/index.js";
import { validateAgentDefinition } from "../../core/agent/index.js";
import { AGENT_ENGINEERING_QUALITY_CONTRACT_REF } from "./agentEngineeringSkill.js";
import type {
  AgentEngineeringWorkUnit,
  AgentEvalPlanItem,
  AgentStateDesign,
  AvailableCapabilityDescriptor,
  CapabilityDesign,
} from "./types.js";

/**
 * Narrow proposed-AgentDefinition builder.
 *
 * Implements brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md sections
 * 12-25 and brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md sections
 * 10-21. It builds exactly ONE proposed S10-shaped AgentDefinition from an
 * already-approved S13E design. It is NOT an Agent Factory, a registry, a
 * runtime-compiler replacement, a code generator, or a deployment system
 * (Agent spec section 30, AE-R27). The real structural validator remains the
 * unchanged S10 `validateAgentDefinition()`, called here.
 *
 * When a safe definition cannot be authored (missing required capability,
 * missing iteration budget for an adaptive loop, missing output schema or
 * quality-contract ref, empty allowed context sources, or a selected
 * capability whose side-effect class the work unit does not permit), the
 * builder returns `{ ok: false, blocking_reasons }` instead of emitting an
 * incomplete runnable candidate (AE-R23, section 15). The reference
 * implementation resolves the Part A section 22 SHOULD as a MUST: a BLOCKED
 * pipeline result carries `design == null`.
 */

const REFERENCE_MAX_CONTEXT_TOKENS = 8000;
const REFERENCE_MAX_ITEMS = 32;

export interface BuildProposedAgentDefinitionParams {
  workUnit: AgentEngineeringWorkUnit;
  stateDesign: AgentStateDesign;
  capabilityDesign: CapabilityDesign;
  evalPlan: AgentEvalPlanItem[];
  availableCapabilities: AvailableCapabilityDescriptor[];
  requiresCrossRunHistory: boolean;
  candidateSkills: string[];
}

export type BuildProposedAgentDefinitionResult =
  | { ok: true; candidate: AgentDefinition; allowed_side_effects: ToolSideEffectClass[] }
  | { ok: false; blocking_reasons: string[] };

function isNonEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value as object).length > 0;
}

function deriveStateSchema(stateDesign: AgentStateDesign): JsonSchemaLike {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of stateDesign.fields) {
    properties[field.name] = { type: field.type };
    if (field.required) required.push(field.name);
  }
  return { type: "object", additionalProperties: false, properties, ...(required.length > 0 ? { required } : {}) };
}

/**
 * Enumerates the INPUT-level design gaps that make a safe candidate
 * AgentDefinition impossible to author for an AGENT_REQUIRED work unit
 * (AE-R23, Agent spec sections 4/15). Exported and shared verbatim by both
 * `buildProposedAgentDefinition()` and `validateAgentEngineeringResult()` so
 * the builder and the validator can never drift on what "BLOCKED" means
 * (mirrors S13D's shared `hardDrivers` / `computeResolvableEvidenceRefs`
 * pattern). It checks gap EXISTENCE from the bounded input alone — it never
 * re-derives the necessity classification, so it introduces no tautology.
 */
export function computeDesignGaps(
  workUnit: AgentEngineeringWorkUnit,
  availableCapabilities: AvailableCapabilityDescriptor[],
): string[] {
  const gaps: string[] = [];
  const availableIds = new Set(availableCapabilities.map((c) => c.id));
  const sideEffectById = new Map(availableCapabilities.map((c) => [c.id, c.side_effect_class]));
  const allowedSet = new Set(workUnit.allowed_side_effect_classes);

  for (const requiredId of workUnit.required_capability_ids) {
    if (!availableIds.has(requiredId)) {
      gaps.push(
        `Required capability '${requiredId}' is not present in the bounded available_capabilities list — a safe ` +
          "candidate AgentDefinition cannot be authored without it (AE-R23).",
      );
      continue;
    }
    const cls = sideEffectById.get(requiredId);
    if (cls && cls !== "NONE" && !allowedSet.has(cls)) {
      gaps.push(
        `Required capability '${requiredId}' has side-effect class '${cls}', which work_unit.allowed_side_effect_classes ` +
          "does not permit — permissions cannot be escalated to satisfy it (AE-R12, AE-R23).",
      );
    }
  }

  if (!isNonEmptyObject(workUnit.expected_output_schema)) {
    gaps.push("work_unit.expected_output_schema is missing or empty — S13E does not fabricate an output schema (AE-R20, AE-R23).");
  }
  if (!workUnit.quality_contract_ref?.trim()) {
    gaps.push("work_unit.quality_contract_ref is missing — S13E does not fabricate a Quality Contract reference (AE-R20, AE-R23).");
  }
  if (workUnit.allowed_context_sources.length === 0) {
    gaps.push("work_unit.allowed_context_sources is empty — a bounded, source-ref-aware context policy cannot be authored (AE-R21).");
  }
  if (!workUnit.iteration_budget) {
    gaps.push(
      "work_unit.iteration_budget is missing — an adaptive-loop Agent requires an explicit iteration budget to bind " +
        "max_turns/timeout_ms (AE-R17, AE-R23).",
    );
  }

  return gaps;
}

function memoryPolicyFor(requiresCrossRunHistory: boolean): AgentMemoryPolicy {
  if (requiresCrossRunHistory) {
    return {
      retrieve: true,
      remember_candidate: true,
      commit_verified_memory: false,
      search_history: true,
      promotion_policy: "EXPLICIT_VERIFIED_ONLY",
    };
  }
  return {
    retrieve: false,
    remember_candidate: false,
    commit_verified_memory: false,
    search_history: false,
    promotion_policy: "DISABLED",
  };
}

export function buildProposedAgentDefinition(params: BuildProposedAgentDefinitionParams): BuildProposedAgentDefinitionResult {
  const { workUnit, stateDesign, capabilityDesign, evalPlan, availableCapabilities, requiresCrossRunHistory, candidateSkills } = params;
  const blocking_reasons: string[] = [];

  const availableIds = new Set(availableCapabilities.map((c) => c.id));
  const sideEffectById = new Map(availableCapabilities.map((c) => [c.id, c.side_effect_class]));

  const selected = capabilityDesign.selected_capability_ids;

  // Input-level design gaps (shared with the result validator).
  blocking_reasons.push(...computeDesignGaps(workUnit, availableCapabilities));

  // Passed-capability-design internal consistency.
  for (const requiredId of workUnit.required_capability_ids) {
    if (availableIds.has(requiredId) && !selected.includes(requiredId)) {
      blocking_reasons.push(`Required capability '${requiredId}' was not selected into the candidate capability set (AE-R11).`);
    }
  }
  for (const id of selected) {
    if (!availableIds.has(id)) {
      blocking_reasons.push(`Selected capability '${id}' is not present in the bounded available_capabilities list (AE-R10).`);
    }
  }

  const neededSideEffects = new Set<ToolSideEffectClass>();
  for (const id of selected) {
    const cls = sideEffectById.get(id);
    if (cls) neededSideEffects.add(cls);
  }
  const allowedSet = new Set(workUnit.allowed_side_effect_classes);
  for (const cls of neededSideEffects) {
    if (cls !== "NONE" && !allowedSet.has(cls)) {
      blocking_reasons.push(
        `Selected capability requires side-effect class '${cls}', which the work unit's allowed_side_effect_classes ` +
          "does not permit — permissions cannot be escalated (AE-R12).",
      );
    }
  }

  if (blocking_reasons.length > 0) {
    return { ok: false, blocking_reasons: dedupePreserveOrder(blocking_reasons) };
  }

  const allowed_side_effects: ToolSideEffectClass[] =
    neededSideEffects.size === 0 ? ["NONE"] : [...neededSideEffects].sort();

  const candidate: AgentDefinition = {
    id: `${workUnit.task_kind}-v1`,
    role: workUnit.task_kind,
    objective: workUnit.goal,

    model_policy: {
      routing_class: "QUALITY",
      require_structured_decisions: true,
      allow_provider_substitution: true,
    },

    context_policy: {
      retrieval_mode: "BOUNDED",
      max_context_tokens: REFERENCE_MAX_CONTEXT_TOKENS,
      max_items: REFERENCE_MAX_ITEMS,
      allowed_sources: [...workUnit.allowed_context_sources] as AgentContextSource[],
      require_source_refs: true,
    },

    state_schema: deriveStateSchema(stateDesign),

    tools: [...selected],
    skills: [...candidateSkills],
    capabilities: [...selected],

    memory_policy: memoryPolicyFor(requiresCrossRunHistory),

    permissions: {
      allowed_side_effects,
      deny_unlisted_capabilities: true,
    },

    delegation: { allowed: false },

    limits: {
      max_turns: workUnit.iteration_budget!.max_turns,
      timeout_ms: workUnit.iteration_budget!.timeout_ms,
    },

    termination: {
      require_terminal_outcome: true,
      require_explanation: true,
      note: "Designed by S13E agent-engineer-v1; canonical S09 terminal semantics, bounded by the work-unit iteration budget.",
    },

    output_schema: structuredClone(workUnit.expected_output_schema),

    rubric: { quality_contract_ref: workUnit.quality_contract_ref },

    evals: dedupePreserveOrder(evalPlan.map((e) => e.ref)),
  };

  const validation = validateAgentDefinition(candidate);
  if (!validation.valid) {
    return {
      ok: false,
      blocking_reasons: [`Assembled candidate AgentDefinition failed S10 validation: ${validation.errors.join("; ")} (AE-R9).`],
    };
  }

  return { ok: true, candidate, allowed_side_effects };
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

export { AGENT_ENGINEERING_QUALITY_CONTRACT_REF };
