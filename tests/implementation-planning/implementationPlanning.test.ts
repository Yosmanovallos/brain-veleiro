import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as yaml from "js-yaml";
import { validateAgentDefinition } from "../../src/core/agent/index.js";
import type { AgentDefinition } from "../../src/core/agent/index.js";
import type { SkillCatalogEntry } from "../../src/core/skill/index.js";
import { validateSkillDefinition, toSkillDescriptor } from "../../src/core/skill/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { MultiCapabilityProvider } from "../agent/fixtures.js";
import { selectSkillForTask } from "../../src/intelligence/skills/selectSkillForTask.js";
import { referenceSkillCatalogEntries, implementationPlanningS13F } from "../../src/intelligence/skills/index.js";
import {
  IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
  IMPLEMENTATION_PLANNING_SKILL_ARTIFACT_PATH,
  IMPLEMENTATION_PLANNING_SKILL_ID,
  IMPLEMENTATION_PLANNING_SPEC_ARTIFACT_PATH,
} from "../../src/intelligence/implementation-planning/constants.js";
import {
  analyzeDependencies,
  compareImplementationPlanningRuns,
  computePlanCoverage,
  findStage11ForbiddenKeys,
  materializePlanningTask,
  materializeBaselinePlanningTask,
  planImplementation,
  planImplementationBaseline,
  PLANNING_COMPARISON_ASSERTIONS,
  renderImplementationPlanMarkdown,
  validateImplementationPlan,
  validatePlanningInput,
} from "../../src/intelligence/implementation-planning/index.js";
import type {
  ImplementationPlanResult,
  ImplementationPlanningInput,
} from "../../src/intelligence/implementation-planning/types.js";
import {
  AGENT_APPLICABLE_MISSING_INPUT,
  AGENT_PENDING_INPUT,
  ALL_POSITIVE_INPUTS,
  ARCH_REJECTED_INPUT,
  DeterministicImplementationPlanningModelProvider,
  FX_POS_001_INPUT,
  FX_POS_002_INPUT,
  FX_POS_003_INPUT,
  skillExecutionHostDefinition,
  SPEC_NOT_APPROVED_INPUT,
  synthesizeSkillPlan,
} from "./fixtures.js";
import { FX_POS_001_TRUTH, FX_POS_002_TRUTH, FX_POS_003_TRUTH } from "./fixtureTruth.js";

const SKILL_PATH = IMPLEMENTATION_PLANNING_SKILL_ARTIFACT_PATH;
const QC_PATH = IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF;
const SPEC_PATH = IMPLEMENTATION_PLANNING_SPEC_ARTIFACT_PATH;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function harness() {
  return {
    baseDefinition: skillExecutionHostDefinition,
    skillProvider: new LocalReferenceSkillProvider(referenceSkillCatalogEntries),
    modelProvider: new DeterministicImplementationPlanningModelProvider(),
    capabilityProvider: new MultiCapabilityProvider([]),
  };
}

async function runSkillPlan(input: ImplementationPlanningInput): Promise<ImplementationPlanResult> {
  const outcome = await planImplementation(input, harness());
  expect(outcome.run.outcome).toBe("SUCCESS");
  expect(outcome.skillLoaded).toBe(true);
  return outcome.result;
}

async function runBaselinePlan(input: ImplementationPlanningInput): Promise<ImplementationPlanResult> {
  const { skillProvider: _skill, ...rest } = harness();
  const outcome = await planImplementationBaseline(input, rest);
  expect(outcome.run.outcome).toBe("SUCCESS");
  return outcome.result;
}

function instrumentEntries(entries: SkillCatalogEntry[]): {
  entries: SkillCatalogEntry[];
  spies: Map<string, ReturnType<typeof vi.fn>>;
} {
  const spies = new Map<string, ReturnType<typeof vi.fn>>();
  const instrumented = entries.map((entry) => {
    const spy = vi.fn(entry.load_definition);
    spies.set(entry.descriptor.id, spy);
    return { descriptor: entry.descriptor, load_definition: spy };
  });
  return { entries: instrumented, spies };
}

const SUITE = [
  { input: FX_POS_001_INPUT, truth: FX_POS_001_TRUTH },
  { input: FX_POS_002_INPUT, truth: FX_POS_002_TRUTH },
  { input: FX_POS_003_INPUT, truth: FX_POS_003_TRUTH },
];

// Measured comparison figures (T32) — transcribed into the verification report §7.
const REAL_BASELINE_CORRECT = 38;
const REAL_BASELINE_HARD_CORRECT = 17;
const REAL_BASELINE_BOUNDARY = 0;
const REAL_IMPROVED_DIMS: string[] = ["SD-001", "SD-002", "SD-003", "SD-005", "SD-007", "SD-008"];

// ===========================================================================
// SKILL-ARTIFACT — Part A integration integrity (shared SKILL.md S13x
// acceptance: "canonical Skill authored", "Part A integrated without silent
// semantic alteration").
// ===========================================================================

describe("SKILL-ARTIFACT-1 — canonical S13F Skill exists and carries the approved vocabulary", () => {
  it("the Skill markdown contains the canonical planning vocabulary", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const token of [
      "Stage 10",
      "TASK-COMPILATION",
      "P0",
      "P1",
      "P2",
      "small verifiable task",
      "depends_on",
      "topological order",
      "milestone",
      "BLOCKED_PENDING_APPROVAL",
      "new implementation-planning AgentDefinition: FORBIDDEN",
      "Coverage denominators MUST be derived from bounded source refs",
    ]) {
      expect(text).toContain(token);
    }
  });

  it("the three integrated Part A artifacts exist at their canonical paths and are non-trivial", () => {
    // Byte-identity against the ChatGPT transfer copy was verified at
    // integration time (see brain-bootstrap/reports/S13F-implementation-planning-verification.md
    // section 2 and the S13F_PART_A_INTEGRATION status); the transfer file is
    // not retained, mirroring every prior S13x closure.
    for (const p of [SKILL_PATH, QC_PATH, SPEC_PATH]) {
      expect(readFileSync(p, "utf8").length).toBeGreaterThan(2000);
    }
    expect(readFileSync(SKILL_PATH, "utf8")).toMatch(/^# IMPLEMENTATION_PLANNING_SKILL_S13F/);
    expect(readFileSync(QC_PATH, "utf8")).toMatch(/^id: S13F_IMPLEMENTATION_PLANNING_DEEP/);
    expect(readFileSync(SPEC_PATH, "utf8")).toMatch(/^# IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F/);
  });
});

describe("SKILL-ARTIFACT-2 — typed Skill validates and preserves canonical semantics", () => {
  it("passes S12 SkillDefinition validation", () => {
    const result = validateSkillDefinition(implementationPlanningS13F);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("has 19 procedure steps matching the markdown Procedure and 24 rules / 12 verification checks", () => {
    expect(implementationPlanningS13F.procedure.length).toBe(19);
    expect(implementationPlanningS13F.rules.length).toBe(24);
    expect(implementationPlanningS13F.verification.length).toBe(12);
    expect(implementationPlanningS13F.rules.every((r) => r.level === "MUST")).toBe(true);
  });

  it("every canonical semantic phrase appears in BOTH the typed rules and the markdown (no silent weakening)", () => {
    const combined = implementationPlanningS13F.rules.map((r) => r.statement).join(" ");
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const phrase of [
      "Stage 10",
      "P0 MUST NOT depend on P1 or P2",
      "P0 MUST NOT be silently de-scoped",
      "one primary observable outcome",
      "hours, line counts, token counts, or file counts",
      "single canonical source of dependency edges",
      "MUST NOT become a second source of truth",
      "exactly one milestone",
      "de-scope P2",
      "MUST explain blockers",
      "rendered deterministically",
      "Coverage denominators MUST be derived from bounded source refs",
    ]) {
      expect(combined).toContain(phrase);
      expect(text).toContain(phrase);
    }
  });

  it("declares no transitive Skill/capability dependency and is synthesis-only", () => {
    expect(implementationPlanningS13F.requires.skills).toEqual([]);
    expect(implementationPlanningS13F.requires.capabilities).toEqual([]);
    expect(implementationPlanningS13F.permissions.allowed_capabilities).toEqual([]);
    expect(implementationPlanningS13F.permissions.allowed_side_effects).toEqual(["NONE"]);
  });
});

describe("SKILL-ARTIFACT-3 — DEEP Quality Contract integrity", () => {
  it("parses and satisfies the canonical S13F structure", () => {
    const doc = yaml.load(readFileSync(QC_PATH, "utf8")) as Record<string, any>;
    expect(doc.depth).toBe("DEEP");
    expect(doc.rationale.risk).toBe("HIGH");
    expect(doc.hard_invariants.length).toBe(18);
    expect(doc.semantic_dimensions.length).toBe(8);
    expect(doc.fixtures.minimum_positive).toBe(3);
    expect(doc.fixtures.minimum_negative).toBe(5);
    const ev = doc.skill_vs_no_skill_evaluation;
    expect(ev.minimum_assertions_per_suite).toBe(18);
    expect(ev.minimum_additional_correct_assertions_total).toBe(4);
    expect(ev.improvement_distribution.minimum_distinct_dimensions).toBe(2);
    expect(ev.improvement_distribution.minimum_additional_correct_assertions_per_improved_dimension).toBe(2);
    expect(ev.hard_invariant_score_with_skill).toBe(1.0);
    expect(ev.s13g_boundary_violations_with_skill).toBe(0);
  });
});

describe("SKILL-ARTIFACT-4 — execution spec integrity", () => {
  it("declares SKILL_ONLY with no new AgentDefinition and reuses S13D/S13E types read-only", () => {
    const text = readFileSync(SPEC_PATH, "utf8");
    expect(text).toContain("new_agent_definition: false");
    expect(text).toContain("agent_need: SKILL_ONLY");
    expect(text).toContain("MUST be imported from their existing S13D/S13E modules and consumed read-only");
    expect(text).toContain("S10 compileAgentDefinition()");
    expect(text).toContain("S09 runAgent()");
  });
});

// ===========================================================================
// T1-T34 (spec section 13) — canonical numbering preserved.
// ===========================================================================

describe("T1 — bounded input validates the approved READY case", () => {
  it("validatePlanningInput accepts FX-POS-001 and planImplementation yields READY", async () => {
    expect(() => validatePlanningInput(FX_POS_001_INPUT)).not.toThrow();
    const result = await runSkillPlan(FX_POS_001_INPUT);
    expect(result.status).toBe("READY");
    expect(validateImplementationPlan(result, FX_POS_001_INPUT).valid).toBe(true);
  });
});

describe("T2 — a not-APPROVED Spec blocks", () => {
  it("yields BLOCKED with zero tasks and an explained blocker", async () => {
    const result = await runSkillPlan(SPEC_NOT_APPROVED_INPUT);
    expect(result.status).toBe("BLOCKED");
    expect(result.tasks).toEqual([]);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(validateImplementationPlan(result, SPEC_NOT_APPROVED_INPUT).valid).toBe(true);
  });
});

describe("T3 — a REJECTED architecture blocks", () => {
  it("yields BLOCKED", async () => {
    const result = await runSkillPlan(ARCH_REJECTED_INPUT);
    expect(result.status).toBe("BLOCKED");
    expect(result.tasks).toEqual([]);
    expect(validateImplementationPlan(result, ARCH_REJECTED_INPUT).valid).toBe(true);
  });
});

describe("T4 — an APPLICABLE agent-design without a result blocks", () => {
  it("yields BLOCKED", async () => {
    const result = await runSkillPlan(AGENT_APPLICABLE_MISSING_INPUT);
    expect(result.status).toBe("BLOCKED");
    expect(result.blockers.join(" ")).toMatch(/APPLICABLE/);
    expect(validateImplementationPlan(result, AGENT_APPLICABLE_MISSING_INPUT).valid).toBe(true);
  });
});

describe("T5 — a PENDING architecture creates PROVISIONAL", () => {
  it("yields PROVISIONAL with the architecture-dependent tasks blocked pending approval", async () => {
    const result = await runSkillPlan(FX_POS_002_INPUT);
    expect(result.status).toBe("PROVISIONAL");
    const p0 = result.tasks.filter((t) => t.priority === "P0");
    expect(p0.length).toBeGreaterThan(0);
    for (const t of p0) expect(t.compilation_readiness).toBe("BLOCKED_PENDING_APPROVAL");
    // No proposal is activated: the ADR is still only referenced, never applied.
    expect(result.architecture_decision_refs).toEqual([FX_POS_002_INPUT.architecture.result.adr.id]);
    expect(validateImplementationPlan(result, FX_POS_002_INPUT).valid).toBe(true);
  });

  it("an unaffected P1 task with no material dependency on the pending decision stays READY_FOR_S13G", async () => {
    const result = await runSkillPlan(FX_POS_002_INPUT);
    const p1 = result.tasks.filter((t) => t.priority === "P1");
    expect(p1.length).toBeGreaterThan(0);
    for (const t of p1) {
      expect(t.architecture_refs).toEqual([]);
      expect(t.compilation_readiness).toBe("READY_FOR_S13G");
    }
  });
});

describe("T6 — a PENDING agent decision creates PROVISIONAL", () => {
  it("yields PROVISIONAL with the agent-dependent tasks blocked pending approval", async () => {
    const result = await runSkillPlan(AGENT_PENDING_INPUT);
    expect(result.status).toBe("PROVISIONAL");
    const withAgentRefs = result.tasks.filter((t) => t.agent_decision_refs.length > 0);
    expect(withAgentRefs.length).toBeGreaterThan(0);
    for (const t of withAgentRefs) expect(t.compilation_readiness).toBe("BLOCKED_PENDING_APPROVAL");
    expect(validateImplementationPlan(result, AGENT_PENDING_INPUT).valid).toBe(true);
  });
});

describe("T7 — a pending blocker propagates transitively", () => {
  it("a task depending on a blocked-pending task is itself blocked pending approval", async () => {
    const result = await runSkillPlan(FX_POS_002_INPUT);
    const p0 = result.tasks.filter((t) => t.priority === "P0");
    // TASK-002 depends on TASK-001 (both P0). TASK-001 is blocked by the
    // pending architecture; TASK-002 must be blocked transitively too.
    const dependent = p0.find((t) => t.depends_on.length > 0);
    expect(dependent).toBeDefined();
    expect(dependent!.compilation_readiness).toBe("BLOCKED_PENDING_APPROVAL");
  });
});

describe("T8 — REQUIRED coverage requires a P0 task or an explicit blocker", () => {
  it("rejects a plan that leaves a REQUIRED requirement unmapped with no blocker", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    // Drop R-002's P0 mapping entirely.
    invalid.tasks = invalid.tasks.filter((t) => !t.spec_refs.includes("R-002"));
    invalid.milestones = invalid.milestones.map((m) => ({ ...m, task_ids: m.task_ids.filter((id) => invalid.tasks.some((t) => t.id === id)) }));
    invalid.coverage = computePlanCoverage(FX_POS_001_INPUT, invalid.tasks, invalid.blockers);
    invalid.topological_order = analyzeDependencies(invalid.tasks, invalid.milestones).topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-004"))).toBe(true);
  });

  it("a READY plan cannot excuse a dropped REQUIRED P0 task with an invented blocker string (blockers are input-derived)", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    // Drop R-002's P0 task and "excuse" it with a blocker naming the ref.
    invalid.tasks = invalid.tasks.filter((t) => !t.spec_refs.includes("R-002"));
    invalid.milestones = invalid.milestones.map((m) => ({ ...m, task_ids: m.task_ids.filter((id) => invalid.tasks.some((t) => t.id === id)) }));
    invalid.blockers = ["R-002 deferred to a later release."];
    invalid.coverage = computePlanCoverage(FX_POS_001_INPUT, invalid.tasks, invalid.blockers);
    invalid.topological_order = analyzeDependencies(invalid.tasks, invalid.milestones).topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    // The input-derived blockers for an APPROVED spec are [] — the invented
    // blocker is rejected, and R-002 is then an uncovered REQUIRED ref.
    expect(validation.errors.some((e) => e.includes("HI-004/013"))).toBe(true);
  });
});

describe("T9 — a P0 task cannot depend on a P1/P2 task", () => {
  it("rejects a P0 -> P1 dependency", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    const p0 = invalid.tasks.find((t) => t.priority === "P0")!;
    const p1 = invalid.tasks.find((t) => t.priority === "P1")!;
    p0.depends_on = [p1.id];
    invalid.topological_order = analyzeDependencies(invalid.tasks, invalid.milestones).topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-005/006"))).toBe(true);
  });
});

describe("T10 — a P1 task cannot depend on a P2 task", () => {
  it("rejects a P1 -> P2 dependency", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    const p1 = invalid.tasks.find((t) => t.priority === "P1")!;
    const p2 = invalid.tasks.find((t) => t.priority === "P2")!;
    p1.depends_on = [p2.id];
    invalid.topological_order = analyzeDependencies(invalid.tasks, invalid.milestones).topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-005/006"))).toBe(true);
  });
});

describe("T11 — a missing dependency ref rejects", () => {
  it("analyzeDependencies flags a dependency on an unknown task", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].depends_on = ["TASK-999"];
    const analysis = analyzeDependencies(invalid.tasks, invalid.milestones);
    expect(analysis.issues.some((i) => i.code === "MISSING_DEPENDENCY")).toBe(true);
    invalid.topological_order = analysis.topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    expect(validateImplementationPlan(invalid, FX_POS_001_INPUT).valid).toBe(false);
  });
});

describe("T12 — a self dependency rejects", () => {
  it("analyzeDependencies flags a task depending on itself", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].depends_on = [invalid.tasks[0].id];
    const analysis = analyzeDependencies(invalid.tasks, invalid.milestones);
    expect(analysis.issues.some((i) => i.code === "SELF_DEPENDENCY")).toBe(true);
    invalid.topological_order = analysis.topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    expect(validateImplementationPlan(invalid, FX_POS_001_INPUT).valid).toBe(false);
  });
});

describe("T13 — a direct cycle rejects", () => {
  it("analyzeDependencies detects A <-> B", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    const [a, b] = invalid.tasks;
    a.depends_on = [b.id];
    b.depends_on = [a.id];
    const analysis = analyzeDependencies(invalid.tasks, invalid.milestones);
    expect(analysis.cycle).not.toBeNull();
    invalid.topological_order = analysis.topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-007"))).toBe(true);
  });
});

describe("T14 — an indirect cycle rejects", () => {
  it("analyzeDependencies detects A -> B -> C -> A", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    const [a, b, c] = invalid.tasks;
    a.depends_on = [c.id];
    b.depends_on = [a.id];
    c.depends_on = [b.id];
    const analysis = analyzeDependencies(invalid.tasks, invalid.milestones);
    expect(analysis.cycle).not.toBeNull();
    expect(analysis.cycle!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("T15 — a task without acceptance rejects", () => {
  it("HI-009", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].acceptance = [];
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-009"))).toBe(true);
  });
});

describe("T16 — a task without evidence rejects", () => {
  it("HI-010", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].evidence_required = [];
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-010"))).toBe(true);
  });
});

describe("T17 — MANUAL_REVIEW evidence without a reason rejects", () => {
  it("SD-003", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].evidence_required = [{ kind: "MANUAL_REVIEW", description: "Someone eyeballs it." }];
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("MANUAL_REVIEW"))).toBe(true);
  });
});

describe("T18 — an unknown material ref rejects", () => {
  it("HI-011", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].spec_refs = [...invalid.tasks[0].spec_refs, "R-999"];
    invalid.coverage = computePlanCoverage(FX_POS_001_INPUT, invalid.tasks, invalid.blockers);
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-011") && e.includes("R-999"))).toBe(true);
  });
});

describe("T19 — every task belongs to exactly one milestone", () => {
  it("rejects a task in two milestones and a task in zero milestones", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);

    const twice = clone(good);
    twice.milestones[1].task_ids = [...twice.milestones[1].task_ids, twice.milestones[0].task_ids[0]];
    twice.plan_markdown = renderImplementationPlanMarkdown(twice);
    expect(validateImplementationPlan(twice, FX_POS_001_INPUT).errors.some((e) => e.includes("HI-008"))).toBe(true);

    const none = clone(good);
    none.milestones[0].task_ids = none.milestones[0].task_ids.slice(1);
    none.plan_markdown = renderImplementationPlanMarkdown(none);
    expect(validateImplementationPlan(none, FX_POS_001_INPUT).errors.some((e) => e.includes("HI-008"))).toBe(true);
  });
});

describe("T20 — a later-milestone dependency rejects", () => {
  it("HI-008", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    // Make a P0 task (milestone 1) depend on a P1 task (milestone 2). This is
    // both a priority-direction and a milestone-order violation.
    const p0 = invalid.tasks.find((t) => t.priority === "P0")!;
    const p1 = invalid.tasks.find((t) => t.priority === "P1")!;
    p0.depends_on = [p1.id];
    const analysis = analyzeDependencies(invalid.tasks, invalid.milestones);
    expect(analysis.issues.some((i) => i.code === "MILESTONE_ORDER")).toBe(true);
  });
});

describe("T21 — coverage denominators derive from input", () => {
  it("HI-018 rejects a self-reported coverage that does not match the recompute", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.coverage = { ...invalid.coverage, required_total: 99 };
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-018"))).toBe(true);
  });

  it("the honest plan's coverage equals computePlanCoverage(input, tasks)", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    expect(good.coverage).toEqual(computePlanCoverage(FX_POS_001_INPUT, good.tasks, good.blockers));
    expect(good.coverage.required_total).toBe(2);
    expect(good.coverage.unmapped_material_refs).toEqual([]);
  });
});

describe("T22 — deterministic topological order", () => {
  it("analyzeDependencies is stable across calls and matches the plan", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const a = analyzeDependencies(good.tasks, good.milestones).topological_order;
    const b = analyzeDependencies(good.tasks, good.milestones).topological_order;
    expect(a).toEqual(b);
    expect(good.topological_order).toEqual(a);
    expect(new Set(a)).toEqual(new Set(good.tasks.map((t) => t.id)));
  });
});

describe("T23 — deterministic Markdown derives from the structured result", () => {
  it("renderImplementationPlanMarkdown is stable and equals plan_markdown", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    expect(renderImplementationPlanMarkdown(good)).toBe(good.plan_markdown);
    expect(renderImplementationPlanMarkdown(good)).toBe(renderImplementationPlanMarkdown(good));
  });

  it("HI-017 rejects a plan whose plan_markdown diverges from the render", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.plan_markdown = `${invalid.plan_markdown}\n<!-- hand-edited -->`;
    const validation = validateImplementationPlan(invalid, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-017"))).toBe(true);
  });
});

describe("T24 — a Stage-11 forbidden field rejects", () => {
  it("HI-015 deep key scan catches an injected execution-package field", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good) as unknown as Record<string, unknown>;
    (invalid.tasks as unknown[])[0] = { ...(good.tasks[0] as object), tools: ["fs.write"], context_packet: { items: [] } };
    expect(findStage11ForbiddenKeys(invalid).length).toBeGreaterThan(0);
    const validation = validateImplementationPlan(invalid as unknown as ImplementationPlanResult, FX_POS_001_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("HI-015"))).toBe(true);
  });

  it("an honest plan contains no Stage-11 field", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    expect(findStage11ForbiddenKeys(good)).toEqual([]);
  });
});

describe("T25 — no new planning AgentDefinition is introduced", () => {
  it("src/intelligence/agent-definitions/ gains no planning agent and does not reference the S13F Skill id", () => {
    const dir = "src/intelligence/agent-definitions";
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, entry), "utf8");
      expect(text).not.toContain(IMPLEMENTATION_PLANNING_SKILL_ID);
      expect(text).not.toMatch(/id:\s*["'][a-z-]*plann?er[a-z-]*["']/i);
      expect(text).not.toMatch(/role:\s*["'][a-z-]*plann?er[a-z-]*["']/i);
    }
  });

  it("the S13F module imports nothing from ../agent-definitions/", () => {
    const dir = "src/intelligence/implementation-planning";
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, entry), "utf8");
      expect(text).not.toMatch(/from\s+["'][^"']*agent-definitions/);
    }
  });

  it("the S13F catalog entry is a Skill, not an Agent", () => {
    const entry = referenceSkillCatalogEntries.find((e) => e.descriptor.id === IMPLEMENTATION_PLANNING_SKILL_ID);
    expect(entry).toBeDefined();
    expect((entry!.descriptor as any).role).toBeUndefined();
  });
});

describe("T26 — S12 metadata-only discovery + lazy load path remains", () => {
  it("no full definition loads during discovery", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await provider.discover({ query: "implementation planning", allowed_skill_ids: skillExecutionHostDefinition.skills });
    for (const spy of spies.values()) expect(spy).not.toHaveBeenCalled();
  });

  it("selectSkillForTask loads only the S13F loader, exactly once", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    const selection = await selectSkillForTask({
      task: "implementation planning P0 P1 P2 milestones small verifiable tasks dependencies",
      agent_definition: skillExecutionHostDefinition,
      provider,
    });
    expect(selection.loaded?.id).toBe(IMPLEMENTATION_PLANNING_SKILL_ID);
    expect(spies.get(IMPLEMENTATION_PLANNING_SKILL_ID)).toHaveBeenCalledTimes(1);
    for (const [id, spy] of spies.entries()) {
      if (id !== IMPLEMENTATION_PLANNING_SKILL_ID) expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("T27 — the generic S10/S09 runtime path remains", () => {
  it("both arms run through compileAgentDefinition() -> runAgent(); only materialization differs", async () => {
    const skillDef = materializePlanningTask({
      baseDefinition: skillExecutionHostDefinition,
      input: FX_POS_001_INPUT,
      loadedSkill: implementationPlanningS13F,
      qualityContractRef: IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
    });
    const baselineDef = materializeBaselinePlanningTask({ baseDefinition: skillExecutionHostDefinition, input: FX_POS_001_INPUT });
    expect(baselineDef.limits).toEqual(skillDef.limits);
    expect(baselineDef.model_policy).toEqual(skillDef.model_policy);
    expect(baselineDef.tools).toEqual(skillDef.tools);
    expect(baselineDef.capabilities).toEqual(skillDef.capabilities);
    expect(skillDef.objective).toContain("SKILL_ID:");
    expect(baselineDef.objective).not.toContain("SKILL_ID:");
    await runSkillPlan(FX_POS_001_INPUT);
    await runBaselinePlan(FX_POS_001_INPUT);
  });

  it("has no separate ImplementationPlanning runtime function/class anywhere in src/", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8");
          if (/function\s+runImplementationPlanning|class\s+ImplementationPlanningRuntime|class\s+PlanExecutor|class\s+TaskExecutor|class\s+WorkflowRuntime/.test(text)) {
            offenders.push(full);
          }
        }
      }
    }
    walk("src");
    expect(offenders).toEqual([]);
  });
});

describe("T28 — the canonical READY fixture passes", () => {
  it("FX-POS-001 produces a fully valid READY plan with correct priority tiers", async () => {
    const result = await runSkillPlan(FX_POS_001_INPUT);
    expect(result.status).toBe("READY");
    const p0Refs = new Set(result.tasks.filter((t) => t.priority === "P0").flatMap((t) => t.spec_refs));
    expect(p0Refs.has("R-001")).toBe(true);
    expect(p0Refs.has("R-002")).toBe(true);
    expect(result.tasks.find((t) => t.spec_refs.includes("R-003"))!.priority).toBe("P1");
    expect(result.tasks.find((t) => t.spec_refs.includes("R-004"))!.priority).toBe("P2");
    for (const t of result.tasks) {
      expect(t.acceptance.length).toBeGreaterThanOrEqual(1);
      expect(t.evidence_required.length).toBeGreaterThanOrEqual(1);
      expect(t.compilation_readiness).toBe("READY_FOR_S13G");
    }
    expect(analyzeDependencies(result.tasks, result.milestones).cycle).toBeNull();
    expect(findStage11ForbiddenKeys(result)).toEqual([]);
    expect(validateImplementationPlan(result, FX_POS_001_INPUT).valid).toBe(true);
  });
});

describe("T29 — the canonical PROVISIONAL fixture passes", () => {
  it("FX-POS-002 is PROVISIONAL, blocks arch-dependent tasks transitively, keeps the independent task ready, activates nothing", async () => {
    const result = await runSkillPlan(FX_POS_002_INPUT);
    expect(result.status).toBe("PROVISIONAL");
    const blocked = result.tasks.filter((t) => t.compilation_readiness === "BLOCKED_PENDING_APPROVAL");
    const ready = result.tasks.filter((t) => t.compilation_readiness === "READY_FOR_S13G");
    expect(blocked.length).toBeGreaterThanOrEqual(2);
    expect(ready.length).toBeGreaterThanOrEqual(1);
    expect(result.tasks.every((t) => t.priority !== "P0" || t.compilation_readiness === "BLOCKED_PENDING_APPROVAL")).toBe(true);
    expect(validateImplementationPlan(result, FX_POS_002_INPUT).valid).toBe(true);
  });
});

describe("T30 — the canonical negative fixtures fail correctly (FX-NEG-001..007)", () => {
  it("N1 Spec not approved => BLOCKED", async () => {
    const r = await runSkillPlan(SPEC_NOT_APPROVED_INPUT);
    expect(r.status).toBe("BLOCKED");
    expect(r.tasks).toEqual([]);
  });

  it("N2 candidate cycle => validator rejects", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].depends_on = [invalid.tasks[1].id];
    invalid.tasks[1].depends_on = [invalid.tasks[0].id];
    invalid.topological_order = analyzeDependencies(invalid.tasks, invalid.milestones).topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    expect(validateImplementationPlan(invalid, FX_POS_001_INPUT).valid).toBe(false);
  });

  it("N3 P0 depends on P1/P2 => validator rejects", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks.find((t) => t.priority === "P0")!.depends_on = [invalid.tasks.find((t) => t.priority === "P2")!.id];
    invalid.topological_order = analyzeDependencies(invalid.tasks, invalid.milestones).topological_order;
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    expect(validateImplementationPlan(invalid, FX_POS_001_INPUT).valid).toBe(false);
  });

  it("N4 task with no acceptance / no evidence => validator rejects", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const noAcc = clone(good);
    noAcc.tasks[0].acceptance = [];
    noAcc.plan_markdown = renderImplementationPlanMarkdown(noAcc);
    expect(validateImplementationPlan(noAcc, FX_POS_001_INPUT).valid).toBe(false);
    const noEv = clone(good);
    noEv.tasks[0].evidence_required = [];
    noEv.plan_markdown = renderImplementationPlanMarkdown(noEv);
    expect(validateImplementationPlan(noEv, FX_POS_001_INPUT).valid).toBe(false);
  });

  it("N5 agent-design APPLICABLE but no result => BLOCKED", async () => {
    const r = await runSkillPlan(AGENT_APPLICABLE_MISSING_INPUT);
    expect(r.status).toBe("BLOCKED");
  });

  it("N6 Stage-11 fields emitted => validator rejects", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good) as unknown as Record<string, unknown>;
    (invalid as any).execution_package = { objective: "..." };
    expect(validateImplementationPlan(invalid as unknown as ImplementationPlanResult, FX_POS_001_INPUT).valid).toBe(false);
  });

  it("N7 unknown material R-/NFR-/C-/A-/AC- ref => validator rejects", async () => {
    const good = await runSkillPlan(FX_POS_001_INPUT);
    const invalid = clone(good);
    invalid.tasks[0].constraint_refs = ["C-404"];
    invalid.coverage = computePlanCoverage(FX_POS_001_INPUT, invalid.tasks, invalid.blockers);
    invalid.plan_markdown = renderImplementationPlanMarkdown(invalid);
    expect(validateImplementationPlan(invalid, FX_POS_001_INPUT).valid).toBe(false);
  });
});

describe("T31 — Skill-vs-no-Skill uses frozen ground truth", () => {
  it("fixtures.ts does not import fixtureTruth.ts and no truth token reaches the materialized objective", () => {
    const fixturesText = readFileSync("tests/implementation-planning/fixtures.ts", "utf8");
    for (const line of fixturesText.split("\n")) {
      const isModuleRef = /^\s*(import|export)\b/.test(line) || /\brequire\s*\(/.test(line);
      if (isModuleRef) expect(line).not.toMatch(/fixtureTruth/i);
    }
    expect(fixturesText).not.toMatch(/ImplementationPlanningFixtureTruth/);

    const def = materializePlanningTask({
      baseDefinition: skillExecutionHostDefinition,
      input: FX_POS_001_INPUT,
      loadedSkill: implementationPlanningS13F,
      qualityContractRef: IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
    });
    for (const token of ["expected_status", "expected_min_task_count", "required_refs", "max_requirement_refs_per_task"]) {
      expect(def.objective).not.toContain(token);
    }
  });

  it("the comparison assertion set has at least 18 assertions across all 8 dimensions", () => {
    expect(PLANNING_COMPARISON_ASSERTIONS.length).toBeGreaterThanOrEqual(18);
    const dims = new Set(PLANNING_COMPARISON_ASSERTIONS.map((a) => a.dimension));
    expect(dims.size).toBe(8);
  });

  it("compareImplementationPlanningRuns is the only consumer of fixture truth (comparator module never imports a synthesizer)", () => {
    const comparatorText = readFileSync(
      "src/intelligence/implementation-planning/compareImplementationPlanningRuns.ts",
      "utf8",
    );
    expect(comparatorText).not.toMatch(/fixtures|synthesize(Skill|Baseline)Plan/);
  });
});

describe("T32 — the Skill improvement threshold passes across >= 2 dimensions", () => {
  it("with-Skill hard invariants = 100%, 0 boundary violations, >= +4 correct assertions, >= 2 improved dimensions", async () => {
    const skillCases = [];
    const baselineCases = [];
    for (const { input, truth } of SUITE) {
      skillCases.push({ result: await runSkillPlan(input), input, truth });
      baselineCases.push({ result: await runBaselinePlan(input), input, truth });
    }
    const comparison = compareImplementationPlanningRuns(baselineCases, skillCases);

    expect(comparison.skill.hard_invariant_correct).toBe(comparison.skill.hard_invariant_total);
    expect(comparison.skill.s13g_boundary_violations).toBe(0);
    expect(comparison.additional_correct_total).toBeGreaterThanOrEqual(4);
    expect(comparison.improved_dimensions.length).toBeGreaterThanOrEqual(2);
    expect(comparison.hard_invariant_regressed).toBe(false);
    expect(comparison.meets_threshold).toBe(true);
    // Baseline genuinely under-performs (not a perfect baseline).
    expect(comparison.baseline.correct).toBeLessThan(comparison.skill.correct);

    // Exact, test-backed figures transcribed into the verification report §7.
    expect(comparison.skill.total_assertions).toBe(75);
    expect(comparison.skill.correct).toBe(75);
    expect(comparison.skill.hard_invariant_total).toBe(33);
    expect(comparison.baseline.correct).toBe(REAL_BASELINE_CORRECT);
    expect(comparison.baseline.hard_invariant_correct).toBe(REAL_BASELINE_HARD_CORRECT);
    expect(comparison.baseline.s13g_boundary_violations).toBe(REAL_BASELINE_BOUNDARY);
    expect(comparison.additional_correct_total).toBe(75 - REAL_BASELINE_CORRECT);
    expect(comparison.improved_dimensions).toEqual(REAL_IMPROVED_DIMS);
  });

  it("each improved dimension contributes at least +2 correct assertions", async () => {
    const skillCases = [];
    const baselineCases = [];
    for (const { input, truth } of SUITE) {
      skillCases.push({ result: await runSkillPlan(input), input, truth });
      baselineCases.push({ result: await runBaselinePlan(input), input, truth });
    }
    const comparison = compareImplementationPlanningRuns(baselineCases, skillCases);
    for (const d of comparison.improved_dimensions) {
      expect(comparison.skill.by_dimension[d].correct - comparison.baseline.by_dimension[d].correct).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("T33 — the reference provider is labelled accurately", () => {
  it("the ModelProvider label describes a deterministic reference provider, not a production LLM", () => {
    const label = DeterministicImplementationPlanningModelProvider.PROVIDER_LABEL;
    expect(label).toMatch(/deterministic/i);
    expect(label).toMatch(/no external LLM/i);
    expect(label).not.toMatch(/gpt-|claude-\d|openai|anthropic api/i);
  });

  it("the QC documents that a reference model is permitted only if described accurately", () => {
    const doc = yaml.load(readFileSync(QC_PATH, "utf8")) as Record<string, any>;
    expect(doc.reference_model_policy.allowed).toBe(true);
    expect(String(doc.reference_model_policy.interpretation)).toMatch(/MUST NOT claim they are a real\s+production LLM/i);
  });
});

describe("T34 — the full regression surface remains green", () => {
  it("S07-S13E AgentDefinitions remain valid alongside the new S13F artifacts", async () => {
    const { requirementsDiscovererDefinition } = await import("../../src/intelligence/agent-definitions/requirementsDiscovererDefinition.js");
    const { knowledgeGapAnalyzerDefinition } = await import("../../src/intelligence/agent-definitions/knowledgeGapAnalyzerDefinition.js");
    const { researcherDefinition } = await import("../../src/intelligence/agent-definitions/researcherDefinition.js");
    const { deepResearcherDefinition } = await import("../../src/intelligence/agent-definitions/deepResearcherDefinition.js");
    const { softwareArchitectDefinition } = await import("../../src/intelligence/agent-definitions/softwareArchitectDefinition.js");
    const { agentEngineerDefinition } = await import("../../src/intelligence/agent-definitions/agentEngineerDefinition.js");
    for (const def of [
      requirementsDiscovererDefinition,
      knowledgeGapAnalyzerDefinition,
      researcherDefinition,
      deepResearcherDefinition,
      softwareArchitectDefinition,
      agentEngineerDefinition,
      skillExecutionHostDefinition,
    ] as AgentDefinition[]) {
      expect(validateAgentDefinition(def).valid).toBe(true);
    }
  });

  it("the reference Skill catalog has 9 entries and every pre-S13F entry is untouched", () => {
    const ids = referenceSkillCatalogEntries.map((e) => e.descriptor.id);
    expect(ids).toEqual([
      "research.evidence-grounded.s11",
      "reference.summarize.v1",
      "reference.format-check.v1",
      "requirements.discovery.s13a",
      "knowledge-gap.analysis.s13b",
      "deep-research.evidence-grounded.s13c",
      "software-architecture.adr.s13d",
      "agent-engineering.design.s13e",
      IMPLEMENTATION_PLANNING_SKILL_ID,
    ]);
  });

  it("descriptor projection remains metadata-only for the S13F Skill", () => {
    const descriptor = toSkillDescriptor(implementationPlanningS13F);
    expect(descriptor.id).toBe(IMPLEMENTATION_PLANNING_SKILL_ID);
    expect((descriptor as any).rules).toBeUndefined();
    expect((descriptor as any).procedure).toBeUndefined();
  });

  it("no forbidden vendor/provider token appears in the S13F Skill or Quality Contract / spec artifacts", () => {
    const forbidden = /openai|anthropic api key|gpt-4|claude-[0-9]/i;
    expect(JSON.stringify(implementationPlanningS13F)).not.toMatch(forbidden);
    expect(readFileSync(QC_PATH, "utf8")).not.toMatch(forbidden);
    expect(readFileSync(SPEC_PATH, "utf8")).not.toMatch(forbidden);
  });

  it("materializePlanningTask does not mutate the base definition and rejects an invalid input", () => {
    const before = clone(skillExecutionHostDefinition);
    expect(() =>
      materializePlanningTask({
        baseDefinition: skillExecutionHostDefinition,
        input: { ...clone(FX_POS_001_INPUT), quality_contract_ref: "" },
        loadedSkill: implementationPlanningS13F,
        qualityContractRef: IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
      }),
    ).toThrow();
    expect(skillExecutionHostDefinition).toEqual(before);
  });
});

// ===========================================================================
// Extra unit coverage for the deterministic helpers (mechanical, not part of
// the T1-T34 contract but useful regression anchors).
// ===========================================================================

describe("helpers — input-derived determinations", () => {
  it("synthesizeSkillPlan output is validation-clean for every positive fixture", () => {
    for (const input of ALL_POSITIVE_INPUTS) {
      const plan = synthesizeSkillPlan(input);
      const validation = validateImplementationPlan(plan, input);
      expect(validation.errors).toEqual([]);
      expect(validation.valid).toBe(true);
    }
  });

  it("the FX-POS-003 approved agent decision is referenced, never activated, and carries only a string ref", async () => {
    const result = await runSkillPlan(FX_POS_003_INPUT);
    const withAgent = result.tasks.filter((t) => t.agent_decision_refs.length > 0);
    expect(withAgent.length).toBeGreaterThan(0);
    for (const t of withAgent) {
      expect(typeof t.agent_definition_ref).toBe("string");
      expect(t.agent_decision_refs).toContain(FX_POS_003_INPUT.agent_engineering!.result.work_unit_id);
    }
  });
});
