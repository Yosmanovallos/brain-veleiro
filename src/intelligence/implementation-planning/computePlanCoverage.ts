import type {
  ImplementationPlanTask,
  ImplementationPlanningInput,
  PlanCoverage,
} from "./types.js";
import { boundedSpecRefs } from "./sharedDerivations.js";

/**
 * Brain — S13F deterministic coverage computation.
 *
 * Implements brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md
 * "Coverage" and brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md
 * section 5.
 *
 * CRITICAL (spec section 5, HI-018): every denominator is derived HERE from
 * `input.spec` and every mapping from validated task refs — a candidate plan's
 * self-reported coverage is never trusted. `validateImplementationPlan()`
 * recomputes this and rejects any mismatch, so a rosy hand-authored
 * `coverage` block cannot pass.
 *
 * @param blockers - the plan's top-level blocker strings; a REQUIRED ref is
 *   counted as `required_blocked` only when it is NOT mapped to a P0 task AND a
 *   blocker string mentions it (or, for a fully BLOCKED plan with no tasks,
 *   when at least one blocker exists).
 */
export function computePlanCoverage(
  input: ImplementationPlanningInput,
  tasks: ImplementationPlanTask[],
  blockers: string[] = [],
): PlanCoverage {
  const spec = input.spec;
  const bounded = boundedSpecRefs(input);

  const requirementRefsByTask = tasks.map((t) => ({
    priority: t.priority,
    refs: new Set(t.spec_refs),
  }));

  const isMappedToP0 = (ref: string): boolean =>
    requirementRefsByTask.some((t) => t.priority === "P0" && t.refs.has(ref));
  const isMappedAnywhere = (ref: string): boolean =>
    requirementRefsByTask.some((t) => t.refs.has(ref));

  const required = spec.requirements.filter((r) => r.priority === "REQUIRED");
  const should = spec.requirements.filter((r) => r.priority === "SHOULD");
  const optional = spec.requirements.filter((r) => r.priority === "OPTIONAL");

  const planHasNoTasks = tasks.length === 0;

  let required_mapped_to_p0 = 0;
  let required_blocked = 0;
  for (const r of required) {
    if (isMappedToP0(r.ref)) {
      required_mapped_to_p0 += 1;
    } else if ((planHasNoTasks && blockers.length > 0) || blockers.some((b) => b.includes(r.ref))) {
      required_blocked += 1;
    }
  }

  const should_mapped = should.filter((r) => isMappedAnywhere(r.ref)).length;
  const optional_mapped = optional.filter((r) => isMappedAnywhere(r.ref)).length;

  // An acceptance criterion is "mapped" when a task references a requirement
  // that lists it, or references the AC ref directly.
  const acRefToRequirements = new Map<string, string[]>();
  for (const req of spec.requirements) {
    for (const ac of req.acceptance_refs) {
      acRefToRequirements.set(ac, [...(acRefToRequirements.get(ac) ?? []), req.ref]);
    }
  }
  const acceptance_mapped = spec.acceptance_criteria.filter((ac) => {
    if (requirementRefsByTask.some((t) => t.refs.has(ac.ref))) return true;
    const owners = acRefToRequirements.get(ac.ref) ?? [];
    return owners.some((reqRef) => isMappedAnywhere(reqRef));
  }).length;

  // Any bounded material ref never cited by any task's *_refs.
  const citedRefs = new Set<string>();
  for (const t of tasks) {
    for (const ref of [
      ...t.spec_refs,
      ...t.constraint_refs,
      ...t.assumption_refs,
      ...t.architecture_refs,
      ...t.agent_decision_refs,
    ]) {
      citedRefs.add(ref);
    }
  }
  const unmapped_material_refs = [...bounded].filter((ref) => !citedRefs.has(ref)).sort();

  return {
    required_total: required.length,
    required_mapped_to_p0,
    required_blocked,
    should_total: should.length,
    should_mapped,
    optional_total: optional.length,
    optional_mapped,
    acceptance_total: spec.acceptance_criteria.length,
    acceptance_mapped,
    unmapped_material_refs,
  };
}
