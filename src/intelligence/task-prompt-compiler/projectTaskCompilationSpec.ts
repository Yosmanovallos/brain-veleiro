import type {
  ImplementationPlanTask,
  ImplementationPlanningSpecSnapshot,
} from "../implementation-planning/types.js";
import { isMaterialRef } from "./sharedNormalization.js";
import type { TaskCompilationSpecSnapshot } from "./types.js";

/**
 * Brain — S13G bounded task-local Spec projection.
 *
 * Implements brain-bootstrap/skills/TASK_PROMPT_COMPILER_SKILL_S13G.md "Spec"
 * and brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md sections 3 (C) /
 * 5.2. Deterministically projects the already-existing S13F
 * `ImplementationPlanningSpecSnapshot` down to ONLY the material refs the one
 * task cites, plus Spec identity/version/approval.
 *
 * This projection:
 *   - preserves original refs and text verbatim;
 *   - never creates a new R-/NFR-/C-/A-/AC- fact;
 *   - never replaces the canonical Markdown Spec;
 *   - never widens the task to unrelated Spec content.
 *
 * An acceptance criterion is kept when the task cites it directly OR when a
 * kept requirement lists it in `acceptance_refs` (so a task that names R-001
 * carries R-001's acceptance criteria without having to re-list them).
 */
export function projectTaskCompilationSpec(
  fullSpec: ImplementationPlanningSpecSnapshot,
  task: ImplementationPlanTask,
): TaskCompilationSpecSnapshot {
  const cited = new Set<string>(
    [...task.spec_refs, ...task.constraint_refs, ...task.assumption_refs].filter(isMaterialRef),
  );

  const requirements = fullSpec.requirements.filter((r) => cited.has(r.ref));
  const acFromRequirements = new Set<string>();
  for (const r of requirements) for (const ac of r.acceptance_refs) acFromRequirements.add(ac);

  const non_functional_requirements = fullSpec.non_functional_requirements.filter((n) => cited.has(n.ref));
  const constraints = fullSpec.constraints.filter((c) => cited.has(c.ref));
  const assumptions = fullSpec.assumptions.filter((a) => cited.has(a.ref));
  const acceptance_criteria = fullSpec.acceptance_criteria.filter(
    (ac) => cited.has(ac.ref) || acFromRequirements.has(ac.ref),
  );

  return {
    spec_id: fullSpec.spec_id,
    version: fullSpec.version,
    approval: { ...fullSpec.approval },
    requirements: requirements.map((r) => structuredClone(r)),
    non_functional_requirements: non_functional_requirements.map((n) => structuredClone(n)),
    constraints: constraints.map((c) => structuredClone(c)),
    assumptions: assumptions.map((a) => structuredClone(a)),
    acceptance_criteria: acceptance_criteria.map((ac) => structuredClone(ac)),
  };
}
