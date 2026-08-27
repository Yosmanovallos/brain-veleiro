import type {
  ImplementationPlanResult,
  ImplementationPlanTask,
  PlanPriority,
  StructuredPlan,
} from "./types.js";

/**
 * Brain — S13F deterministic Markdown renderer.
 *
 * Implements brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md
 * "Deterministic rendering" and
 * brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md section 6.
 *
 * The structured `ImplementationPlanResult` is authoritative. This function
 * receives ONLY the already-validated structure (never model output) and emits
 * a byte-stable Markdown projection. `validateImplementationPlan()` re-runs
 * this renderer and rejects any result whose `plan_markdown` differs (HI-017),
 * so no semantic information can live only in Markdown.
 *
 * Required sections (spec section 6): Status, P0, P1, P2, Milestones,
 * Dependencies, Highest-risk assumptions, Stop/de-scope rules, Coverage,
 * Blockers, S13G readiness.
 */
export function renderImplementationPlanMarkdown(plan: StructuredPlan | ImplementationPlanResult): string {
  const lines: string[] = [];

  lines.push(`# Implementation Plan — ${plan.spec_ref}`);
  lines.push("");
  lines.push("## Status");
  lines.push("");
  lines.push(plan.status);
  lines.push("");

  for (const priority of ["P0", "P1", "P2"] as PlanPriority[]) {
    lines.push(`## ${priority}`);
    lines.push("");
    const tasks = plan.tasks.filter((t) => t.priority === priority);
    if (tasks.length === 0) {
      lines.push("_none_");
      lines.push("");
      continue;
    }
    for (const t of tasks) {
      lines.push(...renderTask(t));
    }
  }

  lines.push("## Milestones");
  lines.push("");
  if (plan.milestones.length === 0) {
    lines.push("_none_");
    lines.push("");
  } else {
    plan.milestones.forEach((m, i) => {
      lines.push(`### ${i + 1}. ${m.id} — ${m.title}`);
      lines.push("");
      lines.push(`Objective: ${m.objective}`);
      lines.push(`Tasks: ${m.task_ids.length > 0 ? m.task_ids.join(", ") : "_none_"}`);
      for (const ec of m.exit_criteria) lines.push(`- exit: ${ec}`);
      lines.push("");
    });
  }

  lines.push("## Dependencies");
  lines.push("");
  const withDeps = plan.tasks.filter((t) => t.depends_on.length > 0);
  if (withDeps.length === 0) {
    lines.push("_none_");
  } else {
    for (const t of withDeps) {
      lines.push(`- ${t.id} depends_on ${[...t.depends_on].join(", ")}`);
    }
  }
  lines.push("");

  lines.push("## Highest-risk assumptions");
  lines.push("");
  if (plan.highest_risk_assumptions.length === 0) {
    lines.push("_none_");
  } else {
    for (const a of plan.highest_risk_assumptions) {
      lines.push(`- ${a.ref}: ${a.statement}`);
      lines.push(`  - impact: ${a.impact}`);
      lines.push(`  - validation: ${a.validation_strategy}`);
      lines.push(`  - affected: ${a.affected_task_ids.length > 0 ? a.affected_task_ids.join(", ") : "_none_"}`);
    }
  }
  lines.push("");

  lines.push("## Stop/de-scope rules");
  lines.push("");
  if (plan.stop_or_de_scope_rules.length === 0) {
    lines.push("_none_");
  } else {
    plan.stop_or_de_scope_rules.forEach((r, i) => {
      lines.push(`${i + 1}. trigger: ${r.trigger}`);
      lines.push(`   action: ${r.action}`);
      lines.push(`   affected_priorities: ${r.affected_priorities.join(", ") || "_none_"}`);
      lines.push(`   protected_scope: ${r.protected_scope.join(", ") || "_none_"}`);
      lines.push(`   rationale: ${r.rationale}`);
    });
  }
  lines.push("");

  lines.push("## Coverage");
  lines.push("");
  const c = plan.coverage;
  lines.push(`- required_total: ${c.required_total}`);
  lines.push(`- required_mapped_to_p0: ${c.required_mapped_to_p0}`);
  lines.push(`- required_blocked: ${c.required_blocked}`);
  lines.push(`- should_total: ${c.should_total}`);
  lines.push(`- should_mapped: ${c.should_mapped}`);
  lines.push(`- optional_total: ${c.optional_total}`);
  lines.push(`- optional_mapped: ${c.optional_mapped}`);
  lines.push(`- acceptance_total: ${c.acceptance_total}`);
  lines.push(`- acceptance_mapped: ${c.acceptance_mapped}`);
  lines.push(`- unmapped_material_refs: ${c.unmapped_material_refs.join(", ") || "_none_"}`);
  lines.push("");

  lines.push("## Blockers");
  lines.push("");
  if (plan.blockers.length === 0) {
    lines.push("_none_");
  } else {
    for (const b of plan.blockers) lines.push(`- ${b}`);
  }
  lines.push("");

  lines.push("## S13G readiness");
  lines.push("");
  if (plan.tasks.length === 0) {
    lines.push("_no tasks_");
  } else {
    for (const t of plan.tasks) {
      lines.push(
        `- ${t.id}: ${t.compilation_readiness}${
          t.blocked_by.length > 0 ? ` (blocked_by: ${t.blocked_by.join(", ")})` : ""
        }`,
      );
    }
  }
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push(
    "S13F produces Stage 10 planning semantics only. Context Pack, selected Skills, capability/tool bindings, execution instructions, executor limits, executor output contract, and the Execution Package remain unresolved until S13G.",
  );

  return lines.join("\n");
}

function renderTask(t: ImplementationPlanTask): string[] {
  const out: string[] = [];
  out.push(`### ${t.id} — ${t.title}`);
  out.push("");
  out.push(`Outcome: ${t.outcome}`);
  out.push(`Priority: ${t.priority} — ${t.priority_rationale}`);
  out.push(`Spec refs: ${t.spec_refs.join(", ") || "_none_"}`);
  out.push(`Constraint refs: ${t.constraint_refs.join(", ") || "_none_"}`);
  out.push(`Assumption refs: ${t.assumption_refs.join(", ") || "_none_"}`);
  out.push(`Architecture refs: ${t.architecture_refs.join(", ") || "_none_"}`);
  out.push(`Agent decision refs: ${t.agent_decision_refs.join(", ") || "_none_"}`);
  if (t.agent_definition_ref) out.push(`Agent definition ref: ${t.agent_definition_ref}`);
  out.push(`Depends on: ${t.depends_on.join(", ") || "_none_"}`);
  out.push(`Compilation readiness: ${t.compilation_readiness}`);
  for (const a of t.acceptance) {
    out.push(`- acceptance ${a.id}: ${a.condition}`);
    out.push(`  - verification: ${a.verification_method}`);
    out.push(`  - evidence: ${a.evidence_expected}`);
  }
  for (const e of t.evidence_required) {
    out.push(
      `- evidence [${e.kind}]: ${e.description}${e.source_ref ? ` (source: ${e.source_ref})` : ""}${
        e.manual_review_reason ? ` (manual review: ${e.manual_review_reason})` : ""
      }`,
    );
  }
  out.push("");
  return out;
}
