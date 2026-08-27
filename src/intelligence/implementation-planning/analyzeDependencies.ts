import type { ImplementationPlanTask, ImplementationMilestone, PlanPriority } from "./types.js";

/**
 * Brain — S13F static dependency-graph analysis.
 *
 * Implements brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md
 * "Static dependency model" and
 * brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md section 4.4.
 *
 * This is a pure analyzer over `depends_on`, the single canonical source of
 * dependency edges. It NEVER executes the graph, schedules work, or becomes a
 * second source of truth: `topological_order` is a DERIVED convenience, checked
 * against — not trusted from — a plan result.
 */

const PRIORITY_RANK: Record<PlanPriority, number> = { P0: 0, P1: 1, P2: 2 };

export interface DependencyIssue {
  code:
    | "MISSING_DEPENDENCY"
    | "SELF_DEPENDENCY"
    | "DUPLICATE_DEPENDENCY"
    | "CYCLE"
    | "PRIORITY_DIRECTION"
    | "MILESTONE_ORDER";
  message: string;
}

export interface DependencyAnalysis {
  issues: DependencyIssue[];
  /** Deterministic Kahn topological order (ties broken by ascending task id). Empty if a cycle exists. */
  topological_order: string[];
  cycle: string[] | null;
}

export function analyzeDependencies(
  tasks: ImplementationPlanTask[],
  milestones: ImplementationMilestone[] = [],
): DependencyAnalysis {
  const issues: DependencyIssue[] = [];
  const ids = new Set(tasks.map((t) => t.id));

  // Structural edge checks.
  for (const t of tasks) {
    const seen = new Set<string>();
    for (const dep of t.depends_on) {
      if (dep === t.id) {
        issues.push({ code: "SELF_DEPENDENCY", message: `Task ${t.id} depends on itself.` });
      }
      if (seen.has(dep)) {
        issues.push({ code: "DUPLICATE_DEPENDENCY", message: `Task ${t.id} lists dependency ${dep} more than once.` });
      }
      seen.add(dep);
      if (!ids.has(dep)) {
        issues.push({ code: "MISSING_DEPENDENCY", message: `Task ${t.id} depends on unknown task ${dep}.` });
      }
    }
  }

  // Priority-direction invariants: a task MUST NOT depend on a lower-priority
  // task (rank(dependent) < rank(dependency) means "P0 -> P1/P2" or "P1 -> P2").
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) {
    for (const dep of t.depends_on) {
      const target = byId.get(dep);
      if (!target) continue;
      if (PRIORITY_RANK[t.priority] < PRIORITY_RANK[target.priority]) {
        issues.push({
          code: "PRIORITY_DIRECTION",
          message: `Task ${t.id} (${t.priority}) must not depend on lower-priority task ${dep} (${target.priority}).`,
        });
      }
    }
  }

  // Cycle detection + deterministic topological order (Kahn).
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    indegree.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const t of tasks) {
    for (const dep of t.depends_on) {
      if (!ids.has(dep) || dep === t.id) continue;
      // edge dep -> t (dep must complete before t)
      adj.get(dep)!.push(t.id);
      indegree.set(t.id, (indegree.get(t.id) ?? 0) + 1);
    }
  }

  const ready = [...tasks.map((t) => t.id)].filter((id) => (indegree.get(id) ?? 0) === 0).sort();
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const next of (adj.get(id) ?? []).slice().sort()) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) {
        // keep `ready` sorted for determinism
        const insertAt = ready.findIndex((r) => r > next);
        if (insertAt === -1) ready.push(next);
        else ready.splice(insertAt, 0, next);
      }
    }
  }

  let cycle: string[] | null = null;
  if (order.length !== tasks.length) {
    cycle = findCycle(tasks, ids);
    issues.push({
      code: "CYCLE",
      message: cycle ? `Dependency cycle: ${cycle.join(" -> ")}.` : "Dependency graph contains a cycle.",
    });
  }

  // Milestone ordering: a task in milestone i MUST NOT depend on a task in a
  // later milestone j > i.
  if (milestones.length > 0) {
    const milestoneIndexOfTask = new Map<string, number>();
    milestones.forEach((m, i) => {
      for (const tid of m.task_ids) milestoneIndexOfTask.set(tid, i);
    });
    for (const t of tasks) {
      const ti = milestoneIndexOfTask.get(t.id);
      if (ti === undefined) continue;
      for (const dep of t.depends_on) {
        const di = milestoneIndexOfTask.get(dep);
        if (di === undefined) continue;
        if (di > ti) {
          issues.push({
            code: "MILESTONE_ORDER",
            message: `Task ${t.id} (milestone ${ti + 1}) depends on ${dep} in a later milestone ${di + 1}.`,
          });
        }
      }
    }
  }

  return { issues, topological_order: cycle ? [] : order, cycle };
}

function findCycle(tasks: ImplementationPlanTask[], ids: Set<string>): string[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const color = new Map<string, 0 | 1 | 2>(); // 0=white 1=grey 2=black
  const stack: string[] = [];
  let found: string[] | null = null;

  function dfs(id: string): void {
    if (found) return;
    color.set(id, 1);
    stack.push(id);
    for (const dep of (byId.get(id)?.depends_on ?? []).slice().sort()) {
      if (!ids.has(dep)) continue;
      const c = color.get(dep) ?? 0;
      if (c === 1) {
        const from = stack.indexOf(dep);
        found = [...stack.slice(from), dep];
        return;
      }
      if (c === 0) dfs(dep);
      if (found) return;
    }
    stack.pop();
    color.set(id, 2);
  }

  for (const id of [...ids].sort()) {
    if ((color.get(id) ?? 0) === 0) dfs(id);
    if (found) break;
  }
  return found;
}
