import type { StructuredAgentOutput } from "../../core/agent/index.js";
import { isEligiblePolicyContextItem } from "./compileExecutionInstructions.js";
import { materializeExecutionLimits } from "./materializeExecutionLimits.js";
import { materializeExecutionTools } from "./materializeExecutionTools.js";
import {
  acceptanceEqual,
  computePackageId,
  containsKnownSecretValue,
  evidenceEqual,
  evidenceKindsValid,
  findExecutionPackageForbiddenKeys,
  jsonSchemaEqual,
  normalizeAcceptance,
  stableStringify,
} from "./sharedNormalization.js";
import {
  EXECUTION_INSTRUCTION_KINDS,
  NON_NORMATIVE_CONTEXT_LAYERS,
  type ExecutionPackage,
  type TaskCompilationInput,
} from "./types.js";
import { EXECUTION_PACKAGE_SCHEMA_VERSION } from "./constants.js";

/**
 * Brain — S13G deterministic Execution Package validator.
 *
 * Implements every hard invariant HI-001..HI-026 of
 * brain-bootstrap/quality-contracts/S13G_TASK_PROMPT_COMPILER_DEEP.yaml and the
 * failure conditions of brain-bootstrap/skills/TASK_PROMPT_COMPILER_SKILL_S13G.md.
 *
 * Anti-self-certification (the S13B/S13D/S13F review precedent): the model
 * supplies `package_id`, `objective`, `instructions`, `context`, `tools`,
 * `limits`, `output_schema`, `acceptance`, `evidence`. This validator RECOMPUTES
 * each from the bounded input (via the shared helpers) and REJECTS any mismatch.
 * A rosy hand-authored package cannot pass.
 */

export interface PackageValidationResult {
  valid: boolean;
  errors: string[];
}

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function validateExecutionPackage(
  pkg: ExecutionPackage,
  input: TaskCompilationInput,
): PackageValidationResult {
  const errors: string[] = [];
  const push = (id: string, msg: string): void => {
    errors.push(`${id}: ${msg}`);
  };

  // ---- HI-024: no Stage-12+/S14/S17 provider/runtime key anywhere.
  const forbidden = findExecutionPackageForbiddenKeys(pkg);
  if (forbidden.length > 0) push("HI-024", `package contains forbidden provider/runtime field(s): ${forbidden.join(", ")}`);

  // ---- HI-025: all required semantic categories present + well-formed.
  if (pkg.schema_version !== EXECUTION_PACKAGE_SCHEMA_VERSION) push("HI-025", `schema_version must be "${EXECUTION_PACKAGE_SCHEMA_VERSION}".`);
  for (const field of ["objective", "instructions", "context", "tools", "limits", "output_schema", "acceptance", "evidence"] as const) {
    if (pkg[field] === undefined || pkg[field] === null) push("HI-025", `package is missing required field '${field}'.`);
  }

  // ---- metadata: deterministic package_id + refs.
  const expectedId = computePackageId(input);
  if (pkg.package_id !== expectedId) push("HI-025", `package_id '${pkg.package_id}' is not the deterministic id '${expectedId}' (spec 12).`);
  if (pkg.task_ref !== input.task.id) push("HI-001", `task_ref '${pkg.task_ref}' does not equal the compiled task id '${input.task.id}'.`);
  if (pkg.agent_definition_ref !== input.agent_definition.id) {
    push("HI-005", `agent_definition_ref '${pkg.agent_definition_ref}' does not equal the supplied AgentDefinition id.`);
  }

  // ---- HI-001: exactly one READY task, READY_FOR_S13G.
  if (input.task.compilation_readiness !== "READY_FOR_S13G") {
    push("HI-001", `the compiled task is ${input.task.compilation_readiness}, not READY_FOR_S13G.`);
  }

  // ---- HI-006: task-specific agent ref match.
  if (input.task.agent_definition_ref !== undefined && input.task.agent_definition_ref !== input.agent_definition.id) {
    push("HI-006", `task.agent_definition_ref does not match the supplied AgentDefinition id.`);
  }

  // ---- HI-016: objective fidelity — statement preserves task.outcome exactly.
  if (pkg.objective.statement.trim() !== input.task.outcome.trim()) {
    push("HI-016", `objective.statement does not preserve task.outcome verbatim (spec 4 "statement MUST preserve task.outcome").`);
  }
  if (pkg.objective.task_ref !== input.task.id) push("HI-016", `objective.task_ref is not the task id.`);
  const citedSpecRefs = new Set(input.task.spec_refs);
  for (const ref of pkg.objective.spec_refs) {
    if (!citedSpecRefs.has(ref)) push("HI-016", `objective.spec_refs contains ${ref}, which the task does not cite (scope broadening).`);
  }

  // ---- HI-007 / HI-008: selected skill refs are allowlisted, unique, not rediscovered.
  const allowedSkillIds = new Set(input.agent_definition.skills);
  const seenSkillKeys = new Set<string>();
  const inputSkillKeys = new Set(input.selected_skills.map((s) => `${s.id}@${s.version}`));
  for (const ref of pkg.selected_skill_refs) {
    const key = `${ref.id}@${ref.version}`;
    if (seenSkillKeys.has(key)) push("HI-007", `duplicate selected_skill_ref ${key}.`);
    seenSkillKeys.add(key);
    if (!allowedSkillIds.has(ref.id)) push("HI-007", `selected_skill_ref ${ref.id} is not in AgentDefinition.skills.`);
    if (!inputSkillKeys.has(key)) push("HI-008", `selected_skill_ref ${key} was not among the supplied selected_skills (no rediscovery).`);
  }

  // ---- HI-009 / HI-010: capability refs + unbound tools.
  const inputCapabilityIds = Array.from(new Set(input.capabilities.map((c) => c.id))).sort();
  if (stableStringify(pkg.capability_refs) !== stableStringify(inputCapabilityIds)) {
    push("HI-009", `capability_refs ${JSON.stringify(pkg.capability_refs)} do not equal the sorted unique input capability ids ${JSON.stringify(inputCapabilityIds)}.`);
  }
  const agentCaps = new Set(input.agent_definition.capabilities);
  const agentTools = new Set(input.agent_definition.tools);
  for (const cap of pkg.capability_refs) {
    if (!agentCaps.has(cap) || !agentTools.has(cap)) push("HI-009", `capability_ref '${cap}' is not allowed by the target AgentDefinition.`);
  }
  const expectedTools = materializeExecutionTools(input);
  if (stableStringify(pkg.tools) !== stableStringify(expectedTools)) {
    push("HI-010", `tools do not equal the deterministic unbound declarations derived from the validated capabilities (spec 8).`);
  }
  for (const t of pkg.tools) {
    const keys = Object.keys(t).sort();
    if (stableStringify(keys) !== stableStringify(["capability_ref", "id"])) {
      push("HI-010", `tool declaration '${t.id ?? "<no id>"}' carries fields beyond {id, capability_ref}: ${keys.join(", ")} (provider binding).`);
    }
  }

  // ---- HI-011 / HI-012 / HI-013: Context Pack membership + provenance + budget preserved.
  const inputItemById = new Map(input.context_pack.items.map((it) => [it.id, it]));
  const pkgItemIds = new Set(pkg.context.items.map((it) => it.id));
  if (pkg.context.context_pack_ref !== input.context_pack.id) push("HI-011", `context.context_pack_ref does not equal the supplied Context Pack id.`);
  if (pkg.context.items.length !== input.context_pack.items.length) {
    push("HI-011", `context carries ${pkg.context.items.length} items but the supplied pack has ${input.context_pack.items.length} (added or dropped).`);
  }
  for (const inItem of input.context_pack.items) {
    if (!pkgItemIds.has(inItem.id)) push("HI-011", `context item '${inItem.id}' was dropped.`);
  }
  for (const outItem of pkg.context.items) {
    const inItem = inputItemById.get(outItem.id);
    if (!inItem) {
      push("HI-011", `context item '${outItem.id}' was added by the compiler.`);
      continue;
    }
    if (stableStringify(outItem) !== stableStringify(inItem)) {
      push("HI-011", `context item '${outItem.id}' was modified (content / authority / status / provenance / evidence_ref).`);
    }
    if (!inItem.provenance?.source_ref || !inItem.relevance?.priority) {
      push("HI-012", `context item '${outItem.id}' lacks required provenance/relevance metadata.`);
    }
  }
  if (stableStringify(pkg.context.authority_policy) !== stableStringify(input.context_pack.authority_policy)) {
    push("HI-011", `context.authority_policy was altered.`);
  }
  if (stableStringify(pkg.context.budget) !== stableStringify(input.context_pack.budget)) {
    push("HI-013", `context.budget does not equal the supplied Context Pack budget.`);
  }

  // ---- HI-014 / HI-015: instruction provenance + no data->instruction escalation.
  const allowedSourceRefPrefixes = ["task:", "policy:", "skill:", "context:"];
  const materialRefSet = new Set<string>([
    ...input.spec.requirements.map((r) => r.ref),
    ...input.spec.non_functional_requirements.map((n) => n.ref),
    ...input.spec.constraints.map((c) => c.ref),
    ...input.spec.assumptions.map((a) => a.ref),
    ...input.spec.acceptance_criteria.map((a) => a.ref),
    ...input.constraints.flatMap((c) => [c.ref, ...c.source_refs]),
  ]);
  const eligiblePolicyItemIds = new Set(
    input.context_pack.items.filter(isEligiblePolicyContextItem).map((it) => `context:${it.id}`),
  );
  const nonNormativeItemIds = new Set(
    input.context_pack.items
      .filter((it) => NON_NORMATIVE_CONTEXT_LAYERS.includes(it.source_layer))
      .map((it) => `context:${it.id}`),
  );
  const allInstructionSourceRefs = new Set<string>();
  for (const ins of pkg.instructions) {
    if (!nonEmpty(ins.id)) push("HI-014", `an instruction has an empty id.`);
    if (!EXECUTION_INSTRUCTION_KINDS.includes(ins.kind)) push("HI-014", `instruction ${ins.id} has invalid kind ${ins.kind}.`);
    if (!nonEmpty(ins.text)) push("HI-014", `instruction ${ins.id} has empty text.`);
    if (!Array.isArray(ins.source_refs) || ins.source_refs.length === 0) {
      push("HI-014", `instruction ${ins.id} has no source ref (spec 7.3).`);
      continue;
    }
    for (const ref of ins.source_refs) {
      allInstructionSourceRefs.add(ref);
      const isPrefixed = allowedSourceRefPrefixes.some((p) => ref.startsWith(p));
      const isMaterial = materialRefSet.has(ref);
      if (!isPrefixed && !isMaterial) {
        push("HI-014", `instruction ${ins.id} cites unresolvable source ref '${ref}'.`);
      }
      if (ref.startsWith("context:")) {
        if (nonNormativeItemIds.has(ref)) {
          push("HI-015", `instruction ${ins.id} is sourced from non-normative context item '${ref}' (data->instruction escalation).`);
        } else if (!eligiblePolicyItemIds.has(ref)) {
          push("HI-015", `instruction ${ins.id} is sourced from context item '${ref}', which is not an eligible project-instructions item.`);
        }
      }
    }
  }

  // ---- HI-014 (completeness — spec 7.2 "Instructions MUST preserve, when
  // applicable, ..."): every task-material Spec/NFR ref, every cited constraint
  // ref, and every selected-Skill MUST rule is represented by some instruction,
  // and a TASK instruction cites the task. A per-instruction spot check alone
  // would let a lazy compile drop SPEC/SKILL instructions silently.
  if (!pkg.instructions.some((i) => i.kind === "TASK" && i.source_refs.includes(`task:${input.task.id}`))) {
    push("HI-014", `no TASK instruction cites task:${input.task.id} (spec 7.2).`);
  }
  for (const r of input.spec.requirements) {
    if (!allInstructionSourceRefs.has(r.ref)) push("HI-014", `no instruction represents task-material requirement ${r.ref} (spec 7.2).`);
  }
  for (const nfr of input.spec.non_functional_requirements) {
    if (!allInstructionSourceRefs.has(nfr.ref)) push("HI-014", `no instruction represents task-material NFR ${nfr.ref} (spec 7.2).`);
  }
  for (const cref of input.task.constraint_refs) {
    if (input.constraints.some((c) => c.ref === cref) && !allInstructionSourceRefs.has(cref)) {
      push("HI-014", `no instruction represents cited constraint ${cref} (spec 7.2).`);
    }
  }
  for (const skill of input.selected_skills) {
    for (const rule of skill.rules) {
      if (rule.level !== "MUST") continue;
      if (!allInstructionSourceRefs.has(`skill:${skill.id}#${rule.id}`)) {
        push("HI-014", `no SKILL instruction represents selected-Skill MUST rule ${skill.id}#${rule.id} (spec 7.2).`);
      }
    }
  }

  // ---- HI-019: limits inherited only.
  const expectedLimits = materializeExecutionLimits(input);
  if (stableStringify(pkg.limits) !== stableStringify(expectedLimits)) {
    push("HI-019", `limits do not equal { AgentDefinition.limits, Context Pack budget }; a value was invented or enlarged (spec 9).`);
  }

  // ---- HI-020: output schema inherited.
  if (!jsonSchemaEqual(pkg.output_schema, input.agent_definition.output_schema)) {
    push("HI-020", `output_schema is not semantically identical to AgentDefinition.output_schema (spec 10).`);
  }

  // ---- HI-017 / HI-018: acceptance + evidence preserved exactly.
  if (!acceptanceEqual(pkg.acceptance, input.task.acceptance)) {
    push("HI-017", `package.acceptance does not normalize equal to task.acceptance (weakened / reworded).`);
  }
  if (!acceptanceEqual(input.acceptance, input.task.acceptance)) {
    push("HI-017", `input.acceptance does not normalize equal to task.acceptance (spec 5.4).`);
  }
  if (stableStringify(normalizeAcceptance(pkg.acceptance)) !== stableStringify(normalizeAcceptance(input.task.acceptance))) {
    push("HI-017", `package.acceptance differs from task.acceptance after normalization.`);
  }
  if (!evidenceEqual(pkg.evidence, input.task.evidence_required)) {
    push("HI-018", `package.evidence does not normalize equal to task.evidence_required.`);
  }
  if (!evidenceEqual(input.evidence_required, input.task.evidence_required)) {
    push("HI-018", `input.evidence_required does not normalize equal to task.evidence_required (spec 5.5).`);
  }
  if (!evidenceKindsValid(pkg.evidence)) push("HI-018", `package.evidence contains a non-canonical EvidenceKind.`);

  // ---- HI-021: no known secret value in the package.
  if (containsKnownSecretValue(pkg)) push("HI-021", `a known/explicit secret value appears inside the Execution Package.`);

  // ---- HI-003: bounded Spec projection — the objective's cited refs all resolve
  //         inside the bounded snapshot (a coarse structural check; the fuller
  //         boundedness check is in validateTargetExecutionCompatibility).
  const boundedRefs = new Set<string>([
    ...input.spec.requirements.flatMap((r) => [r.ref, ...r.acceptance_refs]),
    ...input.spec.non_functional_requirements.map((n) => n.ref),
    ...input.spec.constraints.map((c) => c.ref),
    ...input.spec.assumptions.map((a) => a.ref),
    ...input.spec.acceptance_criteria.map((a) => a.ref),
  ]);
  for (const ref of pkg.objective.spec_refs) {
    if (/^(R|NFR|C|A|AC)-\d+$/.test(ref) && !boundedRefs.has(ref)) {
      push("HI-003", `objective cites Spec ref ${ref} absent from the bounded Spec snapshot.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Map a TaskCompilationResult to the generic StructuredAgentOutput the S09
 * runtime carries. `data` is the full result; `evidence_refs` trace the package
 * back to its task and Spec.
 */
export function mapTaskCompilationResultToStructuredOutput(result: {
  status: string;
  package: ExecutionPackage | null;
  blockers: string[];
}): StructuredAgentOutput {
  return {
    summary:
      result.status === "READY" && result.package
        ? `Execution Package ${result.package.package_id} for task ${result.package.task_ref}: READY, ${result.package.instructions.length} instruction(s).`
        : `Task compilation BLOCKED: ${result.blockers.length} blocker(s).`,
    data: result as unknown as Record<string, unknown>,
    evidence_refs: result.package ? [result.package.task_ref, ...result.package.objective.spec_refs] : [],
  };
}
