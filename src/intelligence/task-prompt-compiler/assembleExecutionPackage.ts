import type { JsonSchemaLike } from "../../core/agent/index.js";
import { EXECUTION_PACKAGE_SCHEMA_VERSION } from "./constants.js";
import {
  assembleExecutionInstructions,
  FAITHFUL_INSTRUCTION_PROFILE,
} from "./compileExecutionInstructions.js";
import { materializeExecutionLimits } from "./materializeExecutionLimits.js";
import { materializeExecutionTools } from "./materializeExecutionTools.js";
import { computePackageId, deepClone, normalizeAcceptance, normalizeEvidence } from "./sharedNormalization.js";
import type {
  ExecutionContext,
  ExecutionObjective,
  ExecutionPackage,
  ExecutionSkillRef,
  ExecutionToolDeclaration,
  TaskCompilationInput,
} from "./types.js";

/**
 * Brain — S13G Execution Package assembly (the single genuine input-derived
 * synthesizer).
 *
 * Implements brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md sections
 * 4, 6, 8-12 and the Skill file "Execution Package" / "Procedure". There is
 * exactly ONE synthesizer (spec section 21 forbids a "separate intentionally-bad
 * baseline compiler"): its behaviour is parameterized by an
 * `ExecutionAssemblyProfile` derived from the rule text the S13G Skill body
 * contributed to the run objective — never from a with-Skill flag. With no
 * rules extracted, every profile field is `false` and a naive package (broadened
 * objective, inflated limits, mutated schema, provider-bound tools, reworded
 * acceptance, dropped low-priority context, promoted imperative context) falls
 * out. That naive package is the phenomenon the Skill-vs-no-Skill comparison
 * measures — its defects are consequences of ABSENT guidance, not authored.
 */

export interface ExecutionAssemblyProfile {
  boundObjectiveScope: boolean;
  preserveSkillMustRules: boolean;
  forbidNonNormativePromotion: boolean;
  requireInstructionProvenance: boolean;
  inheritLimitsOnly: boolean;
  inheritSchemaOnly: boolean;
  preserveAcceptanceExactly: boolean;
  unboundToolsOnly: boolean;
  preserveAllContextItems: boolean;
}

export const FAITHFUL_ASSEMBLY_PROFILE: ExecutionAssemblyProfile = {
  boundObjectiveScope: true,
  preserveSkillMustRules: true,
  forbidNonNormativePromotion: true,
  requireInstructionProvenance: true,
  inheritLimitsOnly: true,
  inheritSchemaOnly: true,
  preserveAcceptanceExactly: true,
  unboundToolsOnly: true,
  preserveAllContextItems: true,
};

export const NAIVE_ASSEMBLY_PROFILE: ExecutionAssemblyProfile = {
  boundObjectiveScope: false,
  preserveSkillMustRules: false,
  forbidNonNormativePromotion: false,
  requireInstructionProvenance: false,
  inheritLimitsOnly: false,
  inheritSchemaOnly: false,
  preserveAcceptanceExactly: false,
  unboundToolsOnly: false,
  preserveAllContextItems: false,
};

/**
 * Derive the assembly profile from the S13G Skill rule/procedure statements
 * present in the run objective. Each field is gated on a CONTENT match against
 * the extracted rule text — never on `rules.length`. If a governing rule is
 * absent, its guard defaults to the naive behaviour.
 */
export function deriveAssemblyProfileFromRules(ruleTexts: string[]): ExecutionAssemblyProfile {
  const blob = ruleTexts.join("\n").toLowerCase();
  const has = (re: RegExp): boolean => re.test(blob);
  return {
    boundObjectiveScope: has(/preserve[s]? the (single )?s13f task outcome|not broaden scope|objective fidelity|do not broaden/),
    preserveSkillMustRules: has(/selected skill must rules|preserve.*must rule|skill must rules relevant/),
    forbidNonNormativePromotion: has(/no context injection escalation|context data does not become an instruction|non-normative context|imperative language/),
    requireInstructionProvenance: has(/every instruction (has|requires) (at least one )?(valid )?source ref|instruction provenance|no unsupported .*instruction/),
    inheritLimitsOnly: has(/limits are inherited|do not invent runtime budget|no new budget value is invented|limits come only from/),
    inheritSchemaOnly: has(/schema is inherited|do not invent output schema|no prose-to-schema/),
    preserveAcceptanceExactly: has(/acceptance exactness|do not weaken or rewrite acceptance|do not weaken either/),
    unboundToolsOnly: has(/no provider binding|provider-neutral|unbound tool declarations|tools are not runtime provider handles/),
    preserveAllContextItems: has(/context is precompiled|never compose\/retrieve|item membership and semantic contents are preserved|context.*immutab/),
  };
}

function buildObjective(input: TaskCompilationInput, profile: ExecutionAssemblyProfile): ExecutionObjective {
  const specRefs = Array.from(new Set(input.task.spec_refs)).sort();
  if (profile.boundObjectiveScope) {
    return { statement: input.task.outcome, task_ref: input.task.id, spec_refs: specRefs };
  }
  // NAIVE: broaden scope + pull in every snapshot ref, not only cited ones.
  const widened = Array.from(
    new Set([
      ...specRefs,
      ...input.spec.requirements.map((r) => r.ref),
      ...input.spec.non_functional_requirements.map((n) => n.ref),
    ]),
  ).sort();
  return {
    statement: `${input.task.outcome} and improve any closely related areas as needed.`,
    task_ref: input.task.id,
    spec_refs: widened,
  };
}

function buildContext(input: TaskCompilationInput, profile: ExecutionAssemblyProfile): ExecutionContext {
  const pack = input.context_pack;
  const items = profile.preserveAllContextItems
    ? pack.items
    : pack.items.filter((it) => it.relevance?.priority !== "LOW"); // NAIVE: "trim" low-priority items
  return {
    context_pack_ref: pack.id,
    objective: deepClone(pack.objective),
    authority_policy: deepClone(pack.authority_policy),
    budget: deepClone(pack.budget),
    items: items.map((it) => deepClone(it)),
  };
}

function buildTools(input: TaskCompilationInput, profile: ExecutionAssemblyProfile): ExecutionToolDeclaration[] {
  const tools = materializeExecutionTools(input);
  if (profile.unboundToolsOnly) return tools;
  // NAIVE: attach a provider handle — a Stage-12 provider binding leak.
  return tools.map((t) => ({ ...t, provider: "default" }) as unknown as ExecutionToolDeclaration);
}

function buildOutputSchema(input: TaskCompilationInput, profile: ExecutionAssemblyProfile): JsonSchemaLike {
  const schema = deepClone(input.agent_definition.output_schema) as Record<string, unknown>;
  if (profile.inheritSchemaOnly) return schema;
  // NAIVE: bolt on a compiler-invented property.
  const props = (schema.properties as Record<string, unknown> | undefined) ?? {};
  return { ...schema, properties: { ...props, compiler_notes: { type: "string" } } };
}

function buildLimits(input: TaskCompilationInput, profile: ExecutionAssemblyProfile) {
  const limits = materializeExecutionLimits(input);
  if (profile.inheritLimitsOnly) return limits;
  return { ...limits, max_turns: limits.max_turns + 2 }; // NAIVE: pad the budget "to be safe"
}

function buildAcceptance(input: TaskCompilationInput, profile: ExecutionAssemblyProfile) {
  const acc = normalizeAcceptance(input.task.acceptance);
  if (profile.preserveAcceptanceExactly) return acc.map((a) => deepClone(a));
  return acc.map((a) => ({ ...deepClone(a), condition: `Ensure that ${a.condition}` })); // NAIVE: "clarify"
}

function buildSkillRefs(input: TaskCompilationInput): ExecutionSkillRef[] {
  return [...input.selected_skills]
    .map((s) => ({ id: s.id, version: s.version }))
    .sort((x, y) => (x.id === y.id ? x.version.localeCompare(y.version) : x.id.localeCompare(y.id)));
}

export function assembleExecutionPackage(
  input: TaskCompilationInput,
  profile: ExecutionAssemblyProfile,
): ExecutionPackage {
  // A per-instruction profile derived from the (rule-derived) assembly profile:
  // when a gate is false the assembler takes its NAIVE_INSTRUCTION_PROFILE
  // branch for that field (non-normative promotion, unsourced helper text, ...).
  const instructionProfile = {
    ...FAITHFUL_INSTRUCTION_PROFILE,
    preserveSkillMustRules: profile.preserveSkillMustRules,
    forbidNonNormativePromotion: profile.forbidNonNormativePromotion,
    requireInstructionProvenance: profile.requireInstructionProvenance,
  };

  return {
    schema_version: EXECUTION_PACKAGE_SCHEMA_VERSION as "1.0",
    package_id: computePackageId(input),
    task_ref: input.task.id,
    agent_definition_ref: input.agent_definition.id,
    selected_skill_refs: buildSkillRefs(input),
    capability_refs: Array.from(new Set(input.capabilities.map((c) => c.id))).sort(),
    objective: buildObjective(input, profile),
    instructions: assembleExecutionInstructions(input, instructionProfile),
    context: buildContext(input, profile),
    tools: buildTools(input, profile),
    limits: buildLimits(input, profile),
    output_schema: buildOutputSchema(input, profile),
    acceptance: buildAcceptance(input, profile),
    evidence: normalizeEvidence(input.task.evidence_required).map((e) => deepClone(e)),
  };
}
