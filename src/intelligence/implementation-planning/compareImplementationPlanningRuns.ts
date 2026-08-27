import type {
  ImplementationPlanResult,
  ImplementationPlanningFixtureTruth,
  ImplementationPlanningInput,
  PlanningArmScore,
  PlanningComparison,
  PlanningDimensionId,
} from "./types.js";
import { analyzeDependencies } from "./analyzeDependencies.js";
import { computePlanCoverage } from "./computePlanCoverage.js";
import { renderImplementationPlanMarkdown } from "./renderImplementationPlanMarkdown.js";
import {
  boundedAgentDecisionRefs,
  boundedArchitectureRefs,
  boundedSpecRefs,
  classifyPlanStatus,
  computePendingBlockedTaskIds,
} from "./sharedDerivations.js";
import { findStage11ForbiddenKeys } from "./validateImplementationPlan.js";

/**
 * Brain — S13F Skill-vs-no-Skill comparison (COUNTED-ASSERTION model).
 *
 * Implements brain-bootstrap/quality-contracts/S13F_IMPLEMENTATION_PLANNING_DEEP.yaml
 * `semantic_dimensions` + `skill_vs_no_skill_evaluation` and
 * brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md section 12.
 *
 * The QC thresholds ("with-Skill total correct assertions >= no-Skill + 4",
 * ">= 2 improved dimensions", ">= 2 additional correct per improved dimension",
 * "with-Skill hard invariants = 100%", "with-Skill S13G boundary violations =
 * 0") cannot be expressed with ratio metrics, so the comparison is a fixed
 * list of >= 18 discrete boolean assertions, each tagged with one SD-00x
 * dimension, scored per arm against FROZEN, hand-authored
 * `ImplementationPlanningFixtureTruth` (never derived from the result being
 * scored — the S13E AE-R26 pattern). Every ground-truth value comes from the
 * caller-supplied `truth`, from the bounded `input`, or from a deterministic
 * recompute helper shared with the validator.
 */

export interface ScoredPlanningCase {
  result: ImplementationPlanResult;
  input: ImplementationPlanningInput;
  truth: ImplementationPlanningFixtureTruth;
}

interface AssertionSpec {
  id: string;
  dimension: PlanningDimensionId;
  hard_invariant: boolean;
  description: string;
  predicate: (c: ScoredPlanningCase) => boolean;
}

const ALL_DIMENSIONS: PlanningDimensionId[] = [
  "SD-001",
  "SD-002",
  "SD-003",
  "SD-004",
  "SD-005",
  "SD-006",
  "SD-007",
  "SD-008",
];

function tasksByPriority(result: ImplementationPlanResult, priority: "P0" | "P1" | "P2") {
  return result.tasks.filter((t) => t.priority === priority);
}

function requirementRefsOf(specRefs: string[]): string[] {
  return specRefs.filter((r) => /^(R|NFR)-\d+$/.test(r));
}

/** The canonical S13F comparison assertion set (25 assertions, 8 dimensions). */
export const PLANNING_COMPARISON_ASSERTIONS: AssertionSpec[] = [
  // ---- SD-001 scope_priority_correctness
  {
    id: "A01",
    dimension: "SD-001",
    hard_invariant: true,
    description: "Every REQUIRED-tier ref is covered by a P0 task.",
    predicate: ({ result, truth }) => {
      const p0Refs = new Set(tasksByPriority(result, "P0").flatMap((t) => t.spec_refs));
      return truth.required_refs.every((ref) => p0Refs.has(ref));
    },
  },
  {
    id: "A02",
    dimension: "SD-001",
    hard_invariant: false,
    description: "Every SHOULD-tier ref maps to a P1 task.",
    predicate: ({ result, truth }) => {
      const p1Refs = new Set(tasksByPriority(result, "P1").flatMap((t) => t.spec_refs));
      return truth.should_refs.every((ref) => p1Refs.has(ref));
    },
  },
  {
    id: "A03",
    dimension: "SD-001",
    hard_invariant: false,
    description: "Every OPTIONAL-tier ref maps to a P2 task.",
    predicate: ({ result, truth }) => {
      const p2Refs = new Set(tasksByPriority(result, "P2").flatMap((t) => t.spec_refs));
      return truth.optional_refs.every((ref) => p2Refs.has(ref));
    },
  },
  {
    id: "A04",
    dimension: "SD-001",
    hard_invariant: false,
    description: "The minimum successful outcome is represented by the expected number of P0 tasks.",
    predicate: ({ result, truth }) => tasksByPriority(result, "P0").length === truth.expected_p0_task_count,
  },
  // ---- SD-002 task_atomicity
  {
    id: "A05",
    dimension: "SD-002",
    hard_invariant: false,
    description: "Work is split into at least the expected number of tasks (no giant task).",
    predicate: ({ result, truth }) => result.tasks.length >= truth.expected_min_task_count,
  },
  {
    id: "A06",
    dimension: "SD-002",
    hard_invariant: false,
    description: "No task maps more requirement refs than the small-task bound allows.",
    predicate: ({ result, truth }) =>
      result.tasks.every((t) => requirementRefsOf(t.spec_refs).length <= truth.max_requirement_refs_per_task),
  },
  {
    id: "A07",
    dimension: "SD-002",
    hard_invariant: false,
    description: "Every task states exactly one non-empty primary outcome.",
    predicate: ({ result }) => result.tasks.every((t) => typeof t.outcome === "string" && t.outcome.trim().length > 0),
  },
  // ---- SD-003 verifiability
  {
    id: "A08",
    dimension: "SD-003",
    hard_invariant: true,
    description: "Every task has at least one acceptance criterion.",
    predicate: ({ result }) => result.tasks.every((t) => t.acceptance.length >= 1),
  },
  {
    id: "A09",
    dimension: "SD-003",
    hard_invariant: false,
    description: "Every acceptance criterion has a condition, verification method, and expected evidence.",
    predicate: ({ result }) =>
      result.tasks.every((t) =>
        t.acceptance.every(
          (a) =>
            a.condition.trim().length > 0 &&
            a.verification_method.trim().length > 0 &&
            a.evidence_expected.trim().length > 0,
        ),
      ),
  },
  {
    id: "A10",
    dimension: "SD-003",
    hard_invariant: true,
    description: "Every task has at least one evidence requirement.",
    predicate: ({ result }) => result.tasks.every((t) => t.evidence_required.length >= 1),
  },
  {
    id: "A11",
    dimension: "SD-003",
    hard_invariant: false,
    description: "Every MANUAL_REVIEW evidence requirement carries a deterministic-insufficiency reason.",
    predicate: ({ result }) =>
      result.tasks.every((t) =>
        t.evidence_required.every(
          (e) => e.kind !== "MANUAL_REVIEW" || (e.manual_review_reason ?? "").trim().length > 0,
        ),
      ),
  },
  // ---- SD-004 dependency_quality
  {
    id: "A12",
    dimension: "SD-004",
    hard_invariant: true,
    description: "The dependency graph is acyclic.",
    predicate: ({ result }) => analyzeDependencies(result.tasks, result.milestones).cycle === null,
  },
  {
    id: "A13",
    dimension: "SD-004",
    hard_invariant: true,
    description: "No P0 task depends on a P1/P2 task and no P1 task depends on a P2 task.",
    predicate: ({ result }) =>
      !analyzeDependencies(result.tasks, result.milestones).issues.some((i) => i.code === "PRIORITY_DIRECTION"),
  },
  {
    id: "A14",
    dimension: "SD-004",
    hard_invariant: false,
    description: "The reported topological order equals the deterministically derived order.",
    predicate: ({ result }) =>
      JSON.stringify(result.topological_order) ===
      JSON.stringify(analyzeDependencies(result.tasks, result.milestones).topological_order),
  },
  // ---- SD-005 traceability_and_coverage
  {
    id: "A15",
    dimension: "SD-005",
    hard_invariant: true,
    description: "No material Spec ref is left unmapped by the plan.",
    predicate: ({ result, input }) =>
      computePlanCoverage(input, result.tasks, classifyPlanStatus(input).blockers).unmapped_material_refs.length === 0,
  },
  {
    id: "A16",
    dimension: "SD-005",
    hard_invariant: true,
    description: "Every task ref resolves inside the bounded input (no invented refs).",
    predicate: ({ result, input }) => {
      const spec = boundedSpecRefs(input);
      const arch = boundedArchitectureRefs(input);
      const agent = boundedAgentDecisionRefs(input);
      return result.tasks.every(
        (t) =>
          [...t.spec_refs, ...t.constraint_refs, ...t.assumption_refs].every((r) => spec.has(r)) &&
          t.architecture_refs.every((r) => arch.has(r)) &&
          t.agent_decision_refs.every((r) => agent.has(r)),
      );
    },
  },
  {
    id: "A17",
    dimension: "SD-005",
    hard_invariant: true,
    description: "Reported coverage equals the input-derived recompute (blockers taken from the input, not the result).",
    predicate: ({ result, input }) =>
      JSON.stringify(result.coverage) ===
      JSON.stringify(computePlanCoverage(input, result.tasks, classifyPlanStatus(input).blockers)),
  },
  // ---- SD-006 approval_safety
  {
    id: "A18",
    dimension: "SD-006",
    hard_invariant: true,
    description: "Plan status matches the bounded approval snapshots.",
    predicate: ({ result, input }) => result.status === classifyPlanStatus(input).status,
  },
  {
    id: "A19",
    dimension: "SD-006",
    hard_invariant: false,
    description: "Tasks materially depending on a PENDING decision (and their transitive dependents) are BLOCKED_PENDING_APPROVAL.",
    predicate: ({ result, input }) => {
      const blocked = computePendingBlockedTaskIds(input, result.tasks);
      return result.tasks.every(
        (t) => (blocked.has(t.id) ? t.compilation_readiness === "BLOCKED_PENDING_APPROVAL" : t.compilation_readiness === "READY_FOR_S13G"),
      );
    },
  },
  {
    id: "A20",
    dimension: "SD-006",
    hard_invariant: false,
    description: "When a material decision is REJECTED the plan is BLOCKED with zero tasks (no activation).",
    predicate: ({ result, truth }) => !truth.has_rejected_decision || (result.status === "BLOCKED" && result.tasks.length === 0),
  },
  // ---- SD-007 stage_boundary
  {
    id: "A21",
    dimension: "SD-007",
    hard_invariant: true,
    description: "The plan contains no Stage-11 execution-package field.",
    predicate: ({ result }) => findStage11ForbiddenKeys(result).length === 0,
  },
  {
    id: "A22",
    dimension: "SD-007",
    hard_invariant: true,
    description: "plan_markdown is the deterministic rendering of the structured plan.",
    predicate: ({ result }) => renderImplementationPlanMarkdown(result) === result.plan_markdown,
  },
  // ---- SD-008 risk_and_descope_quality
  {
    id: "A23",
    dimension: "SD-008",
    hard_invariant: false,
    description: "Highest-risk assumptions are surfaced when the Spec declares assumptions.",
    predicate: ({ result, truth }) => !truth.expected_has_risk_assumptions || result.highest_risk_assumptions.length >= 1,
  },
  {
    id: "A24",
    dimension: "SD-008",
    hard_invariant: false,
    description: "A stop/de-scope rule protects P0.",
    predicate: ({ result }) => result.stop_or_de_scope_rules.some((r) => r.protected_scope.includes("P0")),
  },
  {
    id: "A25",
    dimension: "SD-008",
    hard_invariant: false,
    description: "A stop/de-scope rule de-scopes P2 before P1.",
    predicate: ({ result }) =>
      result.stop_or_de_scope_rules.some(
        (r) => r.affected_priorities.includes("P2") && /P2 .*(before|then).* P1|de-?scope P2/i.test(r.action),
      ),
  },
];

function emptyDimensionMap(): Record<PlanningDimensionId, { total: number; correct: number }> {
  const m = {} as Record<PlanningDimensionId, { total: number; correct: number }>;
  for (const d of ALL_DIMENSIONS) m[d] = { total: 0, correct: 0 };
  return m;
}

export function scorePlanningArm(cases: ScoredPlanningCase[]): PlanningArmScore {
  const by_dimension = emptyDimensionMap();
  let correct = 0;
  let total = 0;
  let hard_invariant_total = 0;
  let hard_invariant_correct = 0;
  let s13g_boundary_violations = 0;

  for (const c of cases) {
    for (const a of PLANNING_COMPARISON_ASSERTIONS) {
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
      if (a.id === "A21" && !ok) s13g_boundary_violations += 1;
    }
  }

  return {
    total_assertions: total,
    correct,
    by_dimension,
    hard_invariant_total,
    hard_invariant_correct,
    s13g_boundary_violations,
  };
}

const MIN_ADDITIONAL_CORRECT_TOTAL = 4;
const MIN_IMPROVED_DIMENSIONS = 2;
const MIN_ADDITIONAL_CORRECT_PER_DIMENSION = 2;

export function compareImplementationPlanningRuns(
  baselineCases: ScoredPlanningCase[],
  skillCases: ScoredPlanningCase[],
): PlanningComparison {
  const baseline = scorePlanningArm(baselineCases);
  const skill = scorePlanningArm(skillCases);

  const improved_dimensions = ALL_DIMENSIONS.filter(
    (d) => skill.by_dimension[d].correct - baseline.by_dimension[d].correct >= MIN_ADDITIONAL_CORRECT_PER_DIMENSION,
  );

  const additional_correct_total = skill.correct - baseline.correct;
  const hard_invariant_regressed = skill.hard_invariant_correct < baseline.hard_invariant_correct;

  const meets_threshold =
    skill.hard_invariant_total > 0 &&
    skill.hard_invariant_correct === skill.hard_invariant_total &&
    skill.s13g_boundary_violations === 0 &&
    additional_correct_total >= MIN_ADDITIONAL_CORRECT_TOTAL &&
    improved_dimensions.length >= MIN_IMPROVED_DIMENSIONS &&
    !hard_invariant_regressed;

  return { baseline, skill, additional_correct_total, improved_dimensions, hard_invariant_regressed, meets_threshold };
}
