import {
  acceptanceEqual,
  evidenceEqual,
  findExecutionPackageForbiddenKeys,
  jsonSchemaEqual,
  stableStringify,
  containsKnownSecretValue,
} from "./sharedNormalization.js";
import { isEligiblePolicyContextItem } from "./compileExecutionInstructions.js";
import type {
  ExecutionPackage,
  TaskCompilationArmScore,
  TaskCompilationComparison,
  TaskCompilationDimensionId,
  TaskCompilationFixtureTruth,
  TaskCompilationInput,
} from "./types.js";

/**
 * Brain — S13G Skill-vs-no-Skill comparison (COUNTED-ASSERTION model).
 *
 * Implements brain-bootstrap/quality-contracts/S13G_TASK_PROMPT_COMPILER_DEEP.yaml
 * `semantic_dimensions` + `skill_vs_no_skill_evaluation` and
 * brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md sections 18-22.
 *
 * A fixed list of discrete boolean assertions, each tagged with one SD-00x
 * dimension, scored per arm against FROZEN, hand-authored
 * `TaskCompilationFixtureTruth` (never derived from the package being scored).
 * Every ground-truth value comes from the caller-supplied `truth`, the bounded
 * `input`, or a deterministic recompute helper shared with the validator.
 */

export interface ScoredTaskCompilationCase {
  /** The raw model candidate package for this arm (null when the arm produced no package). */
  candidatePackage: ExecutionPackage | null;
  input: TaskCompilationInput;
  truth: TaskCompilationFixtureTruth;
}

interface AssertionSpec {
  id: string;
  dimension: TaskCompilationDimensionId;
  hard_invariant: boolean;
  description: string;
  predicate: (c: ScoredTaskCompilationCase) => boolean;
}

const ALL_DIMENSIONS: TaskCompilationDimensionId[] = [
  "SD-001",
  "SD-002",
  "SD-003",
  "SD-004",
  "SD-005",
  "SD-006",
  "SD-007",
  "SD-008",
  "SD-009",
];

function pkg(c: ScoredTaskCompilationCase): ExecutionPackage | null {
  return c.candidatePackage;
}

function instructionSourceRefs(p: ExecutionPackage): string[] {
  return p.instructions.flatMap((i) => i.source_refs);
}

/** The canonical S13G comparison assertion set (27 assertions, 9 dimensions). */
export const TASK_COMPILATION_COMPARISON_ASSERTIONS: AssertionSpec[] = [
  // ---- SD-001 objective_and_scope_fidelity
  {
    id: "A01",
    dimension: "SD-001",
    hard_invariant: true,
    description: "objective.statement preserves the exact task outcome (no broadening).",
    predicate: ({ candidatePackage, truth }) =>
      !!candidatePackage && candidatePackage.objective.statement.trim() === truth.expected_objective_statement.trim(),
  },
  {
    id: "A02",
    dimension: "SD-001",
    hard_invariant: false,
    description: "objective.spec_refs are a subset of the refs the task cites.",
    predicate: ({ candidatePackage, input }) => {
      const p = candidatePackage;
      if (!p) return false;
      const cited = new Set(input.task.spec_refs);
      return p.objective.spec_refs.every((r) => cited.has(r));
    },
  },
  {
    id: "A03",
    dimension: "SD-001",
    hard_invariant: false,
    description: "objective.task_ref equals the compiled task id.",
    predicate: ({ candidatePackage, input }) => !!candidatePackage && candidatePackage.objective.task_ref === input.task.id,
  },
  // ---- SD-002 instruction_quality_and_provenance
  {
    id: "A04",
    dimension: "SD-002",
    hard_invariant: true,
    description: "Every instruction carries at least one source ref.",
    predicate: ({ candidatePackage }) =>
      !!candidatePackage && candidatePackage.instructions.every((i) => Array.isArray(i.source_refs) && i.source_refs.length > 0),
  },
  {
    id: "A05",
    dimension: "SD-002",
    hard_invariant: false,
    description: "Every required instruction source ref is cited by some instruction.",
    predicate: ({ candidatePackage, truth }) => {
      const p = candidatePackage;
      if (!p) return false;
      const refs = new Set(instructionSourceRefs(p));
      return truth.required_instruction_source_refs.every((r) => refs.has(r));
    },
  },
  {
    id: "A06",
    dimension: "SD-002",
    hard_invariant: false,
    description: "No instruction is sourced from a frozen-truth non-normative context item.",
    predicate: ({ candidatePackage, truth }) => {
      const p = candidatePackage;
      if (!p) return false;
      // Authoritative set comes from the frozen truth, not from re-deriving it
      // off the candidate's own input — this makes A06 an independence check.
      const nonNormative = new Set(truth.non_normative_context_item_ids.map((id) => `context:${id}`));
      return p.instructions.every((i) => i.source_refs.every((r) => !nonNormative.has(r)));
    },
  },
  // ---- SD-003 context_fidelity_and_boundedness
  {
    id: "A07",
    dimension: "SD-003",
    hard_invariant: true,
    description: "Every required context item id survives into the package unchanged.",
    predicate: ({ candidatePackage, input, truth }) => {
      const p = candidatePackage;
      if (!p) return false;
      const byId = new Map(p.context.items.map((it) => [it.id, it]));
      const inById = new Map(input.context_pack.items.map((it) => [it.id, it]));
      return truth.required_context_item_ids.every((id) => {
        const out = byId.get(id);
        const src = inById.get(id);
        return !!out && !!src && stableStringify(out) === stableStringify(src);
      });
    },
  },
  {
    id: "A08",
    dimension: "SD-003",
    hard_invariant: false,
    description: "The package context carries exactly the supplied item set (none added or dropped).",
    predicate: ({ candidatePackage, input }) => {
      const p = candidatePackage;
      if (!p) return false;
      const a = new Set(p.context.items.map((it) => it.id));
      const b = new Set(input.context_pack.items.map((it) => it.id));
      if (a.size !== b.size) return false;
      for (const id of b) if (!a.has(id)) return false;
      return true;
    },
  },
  {
    id: "A09",
    dimension: "SD-003",
    hard_invariant: false,
    description: "The package context budget equals the supplied Context Pack budget.",
    predicate: ({ candidatePackage, input }) =>
      !!candidatePackage && stableStringify(candidatePackage.context.budget) === stableStringify(input.context_pack.budget),
  },
  // ---- SD-004 skill_compilation_correctness
  {
    id: "A10",
    dimension: "SD-004",
    hard_invariant: false,
    description: "At least the expected number of selected-Skill MUST-rule instructions are present.",
    predicate: ({ candidatePackage, truth }) =>
      !!candidatePackage &&
      candidatePackage.instructions.filter((i) => i.kind === "SKILL").length >= truth.min_skill_must_instructions,
  },
  {
    id: "A11",
    dimension: "SD-004",
    hard_invariant: false,
    description: "Every selected_skill_ref was among the supplied selected_skills (no rediscovery).",
    predicate: ({ candidatePackage, input }) => {
      const p = candidatePackage;
      if (!p) return false;
      const supplied = new Set(input.selected_skills.map((s) => `${s.id}@${s.version}`));
      return p.selected_skill_refs.every((r) => supplied.has(`${r.id}@${r.version}`));
    },
  },
  {
    id: "A12",
    dimension: "SD-004",
    hard_invariant: true,
    description: "No full SkillDefinition body is embedded (no procedure/applies_when keys in the package).",
    predicate: ({ candidatePackage }) => {
      if (!candidatePackage) return false;
      const blob = stableStringify(candidatePackage);
      return !/"procedure":\s*\[/.test(blob) && !/"applies_when":/.test(blob);
    },
  },
  // ---- SD-005 capability_tool_safety
  {
    id: "A13",
    dimension: "SD-005",
    hard_invariant: true,
    description: "capability_refs equal the sorted unique expected target capability ids.",
    predicate: ({ candidatePackage, truth }) =>
      !!candidatePackage && stableStringify(candidatePackage.capability_refs) === stableStringify([...truth.expected_tool_ids].sort()),
  },
  {
    id: "A14",
    dimension: "SD-005",
    hard_invariant: true,
    description: "Every tool declaration is exactly {id, capability_ref} (unbound, no provider fields).",
    predicate: ({ candidatePackage }) =>
      !!candidatePackage &&
      candidatePackage.tools.every((t) => stableStringify(Object.keys(t).sort()) === stableStringify(["capability_ref", "id"])),
  },
  {
    id: "A15",
    dimension: "SD-005",
    hard_invariant: false,
    description: "The package contains no provider/connector/credential key.",
    predicate: ({ candidatePackage }) => !!candidatePackage && findExecutionPackageForbiddenKeys(candidatePackage).length === 0,
  },
  // ---- SD-006 limits_and_schema_fidelity
  {
    id: "A16",
    dimension: "SD-006",
    hard_invariant: true,
    description: "limits.max_turns is inherited from the AgentDefinition (not enlarged).",
    predicate: ({ candidatePackage, truth }) => !!candidatePackage && candidatePackage.limits.max_turns === truth.expected_max_turns,
  },
  {
    id: "A17",
    dimension: "SD-006",
    hard_invariant: true,
    description: "limits.timeout_ms is inherited from the AgentDefinition.",
    predicate: ({ candidatePackage, truth }) => !!candidatePackage && candidatePackage.limits.timeout_ms === truth.expected_timeout_ms,
  },
  {
    id: "A18",
    dimension: "SD-006",
    hard_invariant: false,
    description: "output_schema is semantically identical to AgentDefinition.output_schema.",
    predicate: ({ candidatePackage, input }) =>
      !!candidatePackage && jsonSchemaEqual(candidatePackage.output_schema, input.agent_definition.output_schema),
  },
  // ---- SD-007 acceptance_evidence_fidelity
  {
    id: "A19",
    dimension: "SD-007",
    hard_invariant: true,
    description: "package.acceptance is preserved exactly from task.acceptance.",
    predicate: ({ candidatePackage, input }) => !!candidatePackage && acceptanceEqual(candidatePackage.acceptance, input.task.acceptance),
  },
  {
    id: "A20",
    dimension: "SD-007",
    hard_invariant: true,
    description: "package.evidence is preserved exactly from task.evidence_required.",
    predicate: ({ candidatePackage, input }) => !!candidatePackage && evidenceEqual(candidatePackage.evidence, input.task.evidence_required),
  },
  {
    id: "A21",
    dimension: "SD-007",
    hard_invariant: false,
    description: "The package carries no 'passed / complete / collected' result field.",
    predicate: ({ candidatePackage }) => {
      if (!candidatePackage) return false;
      const hits = findExecutionPackageForbiddenKeys(candidatePackage);
      return !hits.some((h) => /(passed|complete|collected|succeeded)/i.test(h));
    },
  },
  // ---- SD-008 security_and_instruction_separation
  {
    id: "A22",
    dimension: "SD-008",
    hard_invariant: true,
    description: "Secret-bearing input yields no package; otherwise no known secret value appears anywhere in the package.",
    predicate: ({ candidatePackage, truth }) =>
      truth.has_secret_bearing_input
        ? candidatePackage === null
        : !!candidatePackage && !containsKnownSecretValue(candidatePackage),
  },
  {
    id: "A23",
    dimension: "SD-008",
    hard_invariant: false,
    description: "No instruction text is a verbatim copy of a non-normative context item's imperative text.",
    predicate: ({ candidatePackage, input, truth }) => {
      const p = candidatePackage;
      if (!p) return false;
      const nonNormativeIds = new Set(truth.non_normative_context_item_ids);
      const imperativeTexts = input.context_pack.items
        .filter((it) => nonNormativeIds.has(it.id))
        .map((it) => (it.content?.text ?? "").trim())
        .filter((t) => t.length > 0);
      return p.instructions.every((i) => !imperativeTexts.includes(i.text.trim()));
    },
  },
  {
    id: "A24",
    dimension: "SD-008",
    hard_invariant: false,
    description: "A SAFETY instruction is present and only eligible project-instruction context items become POLICY.",
    predicate: ({ candidatePackage, input }) => {
      const p = candidatePackage;
      if (!p) return false;
      const hasSafety = p.instructions.some((i) => i.kind === "SAFETY");
      const eligible = new Set(input.context_pack.items.filter(isEligiblePolicyContextItem).map((it) => `context:${it.id}`));
      const policyContextRefsOk = p.instructions
        .filter((i) => i.kind === "POLICY")
        .flatMap((i) => i.source_refs)
        .filter((r) => r.startsWith("context:"))
        .every((r) => eligible.has(r));
      return hasSafety && policyContextRefsOk;
    },
  },
  // ---- SD-009 stage_boundary_and_provider_neutrality
  {
    id: "A25",
    dimension: "SD-009",
    hard_invariant: true,
    description: "The package leaks no Stage-12+/S14/S17 provider/runtime/executor field.",
    predicate: ({ candidatePackage }) => !!candidatePackage && findExecutionPackageForbiddenKeys(candidatePackage).length === 0,
  },
  {
    id: "A26",
    dimension: "SD-009",
    hard_invariant: false,
    description: "No Workflow/Task-Executor/execution-result key appears in the package.",
    predicate: ({ candidatePackage }) => {
      if (!candidatePackage) return false;
      const hits = findExecutionPackageForbiddenKeys(candidatePackage);
      return !hits.some((h) => /(workflow|task_executor|execution_result|run_now|deployment_result)/i.test(h));
    },
  },
  {
    id: "A27",
    dimension: "SD-009",
    hard_invariant: false,
    description: "No tool declaration carries a provider handle.",
    predicate: ({ candidatePackage }) =>
      !!candidatePackage && candidatePackage.tools.every((t) => !("provider" in (t as unknown as Record<string, unknown>))),
  },
];

function emptyDimensionMap(): Record<TaskCompilationDimensionId, { total: number; correct: number }> {
  const m = {} as Record<TaskCompilationDimensionId, { total: number; correct: number }>;
  for (const d of ALL_DIMENSIONS) m[d] = { total: 0, correct: 0 };
  return m;
}

export function scoreTaskCompilationArm(cases: ScoredTaskCompilationCase[]): TaskCompilationArmScore {
  const by_dimension = emptyDimensionMap();
  let correct = 0;
  let total = 0;
  let hard_invariant_total = 0;
  let hard_invariant_correct = 0;
  let stage_boundary_violations = 0;
  let invented_authority_tool_limit_schema_refs = 0;

  for (const c of cases) {
    for (const a of TASK_COMPILATION_COMPARISON_ASSERTIONS) {
      let ok: boolean;
      try {
        ok = a.predicate(c);
      } catch {
        ok = false;
      }
      total += 1;
      by_dimension[a.dimension].total += 1;
      if (ok) {
        correct += 1;
        by_dimension[a.dimension].correct += 1;
      }
      if (a.hard_invariant) {
        hard_invariant_total += 1;
        if (ok) hard_invariant_correct += 1;
      }
      if ((a.id === "A25" || a.id === "A15") && !ok) stage_boundary_violations += 1;
      if ((a.id === "A14" || a.id === "A16" || a.id === "A17" || a.id === "A18") && !ok) {
        invented_authority_tool_limit_schema_refs += 1;
      }
    }
  }

  return {
    total_assertions: total,
    correct,
    by_dimension,
    hard_invariant_total,
    hard_invariant_correct,
    stage_boundary_violations,
    invented_authority_tool_limit_schema_refs,
  };
}

const MIN_ADDITIONAL_CORRECT_TOTAL = 6;
const MIN_IMPROVED_DIMENSIONS = 3;
const MIN_ADDITIONAL_CORRECT_PER_DIMENSION = 2;

export function compareTaskCompilationRuns(
  baselineCases: ScoredTaskCompilationCase[],
  skillCases: ScoredTaskCompilationCase[],
): TaskCompilationComparison {
  const baseline = scoreTaskCompilationArm(baselineCases);
  const skill = scoreTaskCompilationArm(skillCases);

  const improved_dimensions = ALL_DIMENSIONS.filter(
    (d) => skill.by_dimension[d].correct - baseline.by_dimension[d].correct >= MIN_ADDITIONAL_CORRECT_PER_DIMENSION,
  );

  const additional_correct_total = skill.correct - baseline.correct;
  const hard_invariant_regressed = skill.hard_invariant_correct < baseline.hard_invariant_correct;

  const meets_threshold =
    skill.hard_invariant_total > 0 &&
    skill.hard_invariant_correct === skill.hard_invariant_total &&
    skill.stage_boundary_violations === 0 &&
    skill.invented_authority_tool_limit_schema_refs === 0 &&
    additional_correct_total >= MIN_ADDITIONAL_CORRECT_TOTAL &&
    improved_dimensions.length >= MIN_IMPROVED_DIMENSIONS &&
    !hard_invariant_regressed;

  return { baseline, skill, additional_correct_total, improved_dimensions, hard_invariant_regressed, meets_threshold };
}
