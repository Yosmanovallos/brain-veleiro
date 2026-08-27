import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as yaml from "js-yaml";
import { compileAgentDefinition, runAgent, validateAgentDefinition } from "../../src/core/agent/index.js";
import type { AgentDefinition } from "../../src/core/agent/index.js";
import type { SkillCatalogEntry } from "../../src/core/skill/index.js";
import { validateSkillDefinition, toSkillDescriptor } from "../../src/core/skill/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { MultiCapabilityProvider } from "../agent/fixtures.js";
import { selectSkillForTask } from "../../src/intelligence/skills/selectSkillForTask.js";
import { referenceSkillCatalogEntries, agentEngineeringS13E } from "../../src/intelligence/skills/index.js";
import { agentEngineerDefinition } from "../../src/intelligence/agent-definitions/agentEngineerDefinition.js";
import {
  AGENT_ENGINEERING_QUALITY_CONTRACT_REF,
  AGENT_ENGINEERING_SKILL_ARTIFACT_PATH,
  AGENT_ENGINEERING_SKILL_ID,
} from "../../src/intelligence/agent-engineering/agentEngineeringSkill.js";
import {
  materializeAgentEngineeringTask,
  materializeBaselineAgentEngineeringTask,
  validateAgentEngineeringInput,
} from "../../src/intelligence/agent-engineering/materializeAgentEngineeringTask.js";
import {
  mapAgentEngineeringResultToStructuredOutput,
  validateAgentEngineeringResult,
} from "../../src/intelligence/agent-engineering/validateAgentEngineeringResult.js";
import {
  compareAgentEngineeringRuns,
  computeAgentEngineeringComparisonMetrics,
  type ScoredAgentEngineeringCase,
} from "../../src/intelligence/agent-engineering/compareAgentEngineeringRuns.js";
import { classifyAgentNeed } from "../../src/intelligence/agent-engineering/classifyAgentNeed.js";
import type { AgentEngineeringInput, AgentEngineeringResult } from "../../src/intelligence/agent-engineering/types.js";
import {
  DeterministicAgentEngineeringModelProvider,
  POSITIVE_INPUT,
  POSITIVE_INPUT_MUTATION_A,
  NEGATIVE_INPUT,
  SKILL_ONLY_INPUT,
  REUSE_INPUT,
  BLOCKED_INPUT,
  CROSS_RUN_MEMORY_INPUT,
  synthesizeSkillAgentEngineeringResult,
  synthesizeBaselineAgentEngineeringResult,
} from "./fixtures.js";
import {
  POSITIVE_TRUTH,
  NEGATIVE_TRUTH,
  SKILL_ONLY_TRUTH,
  REUSE_TRUTH,
  BLOCKED_TRUTH,
  CROSS_RUN_MEMORY_TRUTH,
} from "./fixtureTruth.js";

const SKILL_PATH = AGENT_ENGINEERING_SKILL_ARTIFACT_PATH;
const QC_PATH = "brain-bootstrap/quality-contracts/S13E_AGENT_ENGINEERING_DEEP.yaml";
const SPEC_PATH = "brain-bootstrap/specs/AGENT_ENGINEERING_AGENT_v1.md";
const SELECTION_TASK = "agent engineering agent necessity design goal state tools permissions memory termination evals adaptive loop";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function instrumentEntries(entries: SkillCatalogEntry[]): { entries: SkillCatalogEntry[]; spies: Map<string, ReturnType<typeof vi.fn>> } {
  const spies = new Map<string, ReturnType<typeof vi.fn>>();
  const instrumented = entries.map((entry) => {
    const spy = vi.fn(entry.load_definition);
    spies.set(entry.descriptor.id, spy);
    return { descriptor: entry.descriptor, load_definition: spy };
  });
  return { entries: instrumented, spies };
}

async function runSkillAssisted(input: AgentEngineeringInput): Promise<AgentEngineeringResult> {
  const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
  const selection = await selectSkillForTask({ task: SELECTION_TASK, agent_definition: agentEngineerDefinition, provider });
  if (!selection.loaded) throw new Error("S13E Skill was not selected/loaded — cannot run scenario.");
  const definition = materializeAgentEngineeringTask({
    baseDefinition: agentEngineerDefinition,
    input,
    loadedSkill: selection.loaded,
    qualityContractRef: AGENT_ENGINEERING_QUALITY_CONTRACT_REF,
  });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicAgentEngineeringModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  const run = await runAgent(compiled.run_options);
  expect(run.outcome).toBe("SUCCESS");
  return run.output?.data as unknown as AgentEngineeringResult;
}

async function runBaseline(input: AgentEngineeringInput): Promise<AgentEngineeringResult> {
  const definition = materializeBaselineAgentEngineeringTask({ baseDefinition: agentEngineerDefinition, input });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicAgentEngineeringModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  const run = await runAgent(compiled.run_options);
  expect(run.outcome).toBe("SUCCESS");
  return run.output?.data as unknown as AgentEngineeringResult;
}

const SUITE = [
  { input: POSITIVE_INPUT, truth: POSITIVE_TRUTH },
  { input: NEGATIVE_INPUT, truth: NEGATIVE_TRUTH },
  { input: SKILL_ONLY_INPUT, truth: SKILL_ONLY_TRUTH },
  { input: REUSE_INPUT, truth: REUSE_TRUTH },
];

// ---------------------------------------------------------------------------
// T1 — canonical S13E Skill exists
// ---------------------------------------------------------------------------
describe("T1 — canonical S13E Skill exists", () => {
  it("contains the approved identity and canonical vocabulary", () => {
    const text = readFileSync(SKILL_PATH, "utf8").toLowerCase();
    for (const token of ["agent", "necessity", "goal", "state", "tools", "capabilities", "permissions", "memory", "termination", "evals", "human approval", "least privilege"]) {
      expect(text).toContain(token);
    }
  });

  it("every typed rule/procedure/verification id is present in the canonical markdown, with the exact 27/11/12 counts", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    expect(agentEngineeringS13E.rules.length).toBe(27);
    expect(agentEngineeringS13E.procedure.length).toBe(11);
    expect(agentEngineeringS13E.verification.length).toBe(12);
    for (const rule of agentEngineeringS13E.rules) expect(text).toContain(rule.id);
    for (const step of agentEngineeringS13E.procedure) expect(text).toContain(step.id);
    for (const check of agentEngineeringS13E.verification) expect(text).toContain(check.id);
  });
});

// ---------------------------------------------------------------------------
// T2 — typed Skill validates
// ---------------------------------------------------------------------------
describe("T2 — typed Skill validates", () => {
  it("passes S12 SkillDefinition validation", () => {
    const result = validateSkillDefinition(agentEngineeringS13E);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T3 — typed Skill preserves canonical semantics
// ---------------------------------------------------------------------------
describe("T3 — typed Skill preserves canonical semantics", () => {
  it("mechanically proves the necessity vocabulary, least privilege, and no-auto-registration", () => {
    const combined = `${agentEngineeringS13E.description} ${agentEngineeringS13E.rules.map((r) => r.statement).join(" ")}`;
    for (const token of ["Agent is necessary before designing", "least privilege", "identical", "commit_verified_memory false", "Delegation remains false", "PROPOSED"]) {
      expect(combined).toContain(token);
    }
    expect(agentEngineeringS13E.requires.capabilities).toEqual([]);
    expect(agentEngineeringS13E.requires.skills).toEqual([]);
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const token of ["DETERMINISTIC_FUNCTION", "SKILL_ONLY", "AGENT_REQUIRED", "REUSE_EXISTING", "DESIGN_NEW"]) {
      expect(text).toContain(token);
    }
  });
});

// ---------------------------------------------------------------------------
// T4 — DEEP Quality Contract integrity
// ---------------------------------------------------------------------------
describe("T4 — DEEP Quality Contract integrity", () => {
  it("parses and satisfies the canonical S13E requirements", () => {
    const doc = yaml.load(readFileSync(QC_PATH, "utf8")) as Record<string, any>;
    expect(doc.depth).toBe("DEEP");
    expect(doc.risk).toBe("HIGH");
    expect(doc.irreversibility).toBe("HIGH");
    expect(doc.implementation.deterministic_checks_required).toBe(true);
    expect(doc.challenge.required).toBe(true);
    expect(doc.verification.independent_review_required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T5 — agent-engineer AgentDefinition validates
// ---------------------------------------------------------------------------
describe("T5 — agent-engineer AgentDefinition validates", () => {
  it("passes the existing S10 validation path and is new & independent", () => {
    const result = validateAgentDefinition(agentEngineerDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(agentEngineerDefinition.id).toBe("agent-engineer-v1");
    expect(agentEngineerDefinition.role).toBe("agent-engineer");
  });
});

// ---------------------------------------------------------------------------
// T6 — executing Agent has zero capabilities
// ---------------------------------------------------------------------------
describe("T6 — executing Agent has zero capabilities", () => {
  it("agent-engineer-v1 tools/capabilities and the Skill's capability fields are all empty", () => {
    expect(agentEngineerDefinition.tools).toEqual([]);
    expect(agentEngineerDefinition.capabilities).toEqual([]);
    expect(agentEngineeringS13E.requires.capabilities).toEqual([]);
    expect(agentEngineeringS13E.permissions.allowed_capabilities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T7 — exact S13E Skill allowlist
// ---------------------------------------------------------------------------
describe("T7 — exact S13E Skill allowlist", () => {
  it("agent-engineer-v1.skills is exactly [agent-engineering.design.s13e]", () => {
    expect(agentEngineerDefinition.skills).toEqual([AGENT_ENGINEERING_SKILL_ID]);
  });
});

// ---------------------------------------------------------------------------
// T8 — S12 discovery selects S13E
// ---------------------------------------------------------------------------
describe("T8 — S12 discovery selects S13E", () => {
  it("selects and loads the S13E Skill for the real, unmodified agentEngineerDefinition", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await selectSkillForTask({ task: SELECTION_TASK, agent_definition: agentEngineerDefinition, provider });
    expect(result.discovered.every((d) => d.id === AGENT_ENGINEERING_SKILL_ID)).toBe(true);
    expect(result.selected?.id).toBe(AGENT_ENGINEERING_SKILL_ID);
    expect(result.loaded?.id).toBe(AGENT_ENGINEERING_SKILL_ID);
  });

  it("no full definition loads during discovery", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await provider.discover({ query: "agent engineering", allowed_skill_ids: agentEngineerDefinition.skills });
    for (const spy of spies.values()) expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T9 — lazy selected load only
// ---------------------------------------------------------------------------
describe("T9 — lazy selected load only", () => {
  it("calls only the S13E loader exactly once; unrelated loaders remain uncalled", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await selectSkillForTask({ task: SELECTION_TASK, agent_definition: agentEngineerDefinition, provider });
    expect(spies.get(AGENT_ENGINEERING_SKILL_ID)).toHaveBeenCalledTimes(1);
    for (const [id, spy] of spies.entries()) {
      if (id !== AGENT_ENGINEERING_SKILL_ID) expect(spy).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// T10 — input validation
// ---------------------------------------------------------------------------
describe("T10 — input validation", () => {
  it("rejects an empty goal", () => {
    const invalid = clone(POSITIVE_INPUT);
    invalid.work_unit.goal = "   ";
    expect(() => validateAgentEngineeringInput(invalid)).toThrow(/goal/);
  });

  it("rejects a missing output schema", () => {
    const invalid = clone(POSITIVE_INPUT);
    (invalid.work_unit as any).expected_output_schema = {};
    expect(() => validateAgentEngineeringInput(invalid)).toThrow(/expected_output_schema/);
  });

  it("rejects a missing quality-contract ref", () => {
    const invalid = clone(POSITIVE_INPUT);
    invalid.work_unit.quality_contract_ref = "";
    expect(() => validateAgentEngineeringInput(invalid)).toThrow(/quality_contract_ref/);
  });

  it("rejects duplicate / overlapping capability IDs", () => {
    const invalid = clone(POSITIVE_INPUT);
    invalid.work_unit.optional_capability_ids = ["incident.read"];
    expect(() => validateAgentEngineeringInput(invalid)).toThrow(/duplicate/);
  });

  it("rejects catalogs above the bounded maxima", () => {
    const tooManyCaps = clone(POSITIVE_INPUT);
    tooManyCaps.available_capabilities = Array.from({ length: 21 }, (_, i) => ({ id: `c${i}`, description: "x", side_effect_class: "NONE" as const }));
    expect(() => validateAgentEngineeringInput(tooManyCaps)).toThrow(/at most 20/);

    const tooManyAgents = clone(POSITIVE_INPUT);
    tooManyAgents.available_agents = Array.from({ length: 11 }, () => structuredClone(REUSE_INPUT.available_agents[0]));
    expect(() => validateAgentEngineeringInput(tooManyAgents)).toThrow(/at most 10/);

    const tooManySkills = clone(POSITIVE_INPUT);
    tooManySkills.available_skill_ids = Array.from({ length: 21 }, (_, i) => `s${i}`);
    expect(() => validateAgentEngineeringInput(tooManySkills)).toThrow(/at most 20/);
  });

  it("accepts the canonical positive input unchanged", () => {
    expect(() => validateAgentEngineeringInput(POSITIVE_INPUT)).not.toThrow();
  });

  it("a design-required input whose required capability is absent from the available list does NOT throw — it flows to a BLOCKED result (T10/T15 reconciliation)", async () => {
    expect(() => validateAgentEngineeringInput(BLOCKED_INPUT)).not.toThrow();
    const result = await runSkillAssisted(BLOCKED_INPUT);
    expect(result.need_decision.status).toBe("BLOCKED");
    expect(result.design).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T11 — deterministic negative fixture chooses no Agent
// ---------------------------------------------------------------------------
describe("T11 — deterministic negative fixture chooses no Agent", () => {
  it("classifies the ADR renderer as NO_AGENT + DETERMINISTIC_FUNCTION with design == null", async () => {
    const result = await runSkillAssisted(NEGATIVE_INPUT);
    expect(result.need_decision.agent_requirement).toBe("NO_AGENT");
    expect(result.need_decision.non_agent_strategy).toBe("DETERMINISTIC_FUNCTION");
    expect(result.design).toBeNull();
    expect(result.non_agent_recommendation?.strategy).toBe("DETERMINISTIC_FUNCTION");
    expect(validateAgentEngineeringResult(result, NEGATIVE_INPUT).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T12 — Skill-only fixture chooses no Agent
// ---------------------------------------------------------------------------
describe("T12 — Skill-only fixture chooses no Agent", () => {
  it("classifies the checklist review as NO_AGENT + SKILL_ONLY with design == null", async () => {
    const result = await runSkillAssisted(SKILL_ONLY_INPUT);
    expect(result.need_decision.agent_requirement).toBe("NO_AGENT");
    expect(result.need_decision.non_agent_strategy).toBe("SKILL_ONLY");
    expect(result.design).toBeNull();
    expect(validateAgentEngineeringResult(result, SKILL_ONLY_INPUT).valid).toBe(true);
  });

  it("classifyAgentNeed alone (no fixture truth) yields the same call", () => {
    expect(classifyAgentNeed(SKILL_ONLY_INPUT.work_unit.behavior).agent_requirement).toBe("NO_AGENT");
    expect(classifyAgentNeed(SKILL_ONLY_INPUT.work_unit.behavior).non_agent_strategy).toBe("SKILL_ONLY");
  });
});

// ---------------------------------------------------------------------------
// T13 — adaptive positive fixture requires Agent
// ---------------------------------------------------------------------------
describe("T13 — adaptive positive fixture requires Agent", () => {
  it("classifies the incident investigation as AGENT_REQUIRED", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    expect(result.need_decision.agent_requirement).toBe("AGENT_REQUIRED");
    expect(result.need_decision.agent_action).toBe("DESIGN_NEW");
  });
});

// ---------------------------------------------------------------------------
// T14 — reuse-existing fixture avoids a new Agent
// ---------------------------------------------------------------------------
describe("T14 — reuse-existing fixture avoids a new Agent", () => {
  it("prefers reuse of researcher-v1 over DESIGN_NEW", async () => {
    const result = await runSkillAssisted(REUSE_INPUT);
    expect(result.need_decision.agent_requirement).toBe("AGENT_REQUIRED");
    expect(result.need_decision.agent_action).toBe("REUSE_EXISTING");
    expect(result.reuse_agent_id).toBe("researcher-v1");
    expect(result.design).toBeNull();
    expect(validateAgentEngineeringResult(result, REUSE_INPUT).valid).toBe(true);
  });

  it("a hand-crafted result reusing an incompatible supplied Agent (zero capabilities for a research task) is rejected", async () => {
    const { requirementsDiscovererDefinition } = await import("../../src/intelligence/agent-definitions/requirementsDiscovererDefinition.js");
    const input = clone(REUSE_INPUT);
    input.available_agents = [
      ...input.available_agents,
      {
        definition: requirementsDiscovererDefinition,
        supported_task_kinds: ["evidence-research"],
        compatible_quality_contract_refs: [input.work_unit.quality_contract_ref],
        notes: "Intentionally incompatible: zero capabilities, cannot satisfy research.lookup.",
      },
    ];
    const good = await runSkillAssisted(REUSE_INPUT);
    const invalid = clone(good);
    invalid.need_decision.reuse_agent_id = "requirements-discoverer-v1";
    invalid.reuse_agent_id = "requirements-discoverer-v1";
    const validation = validateAgentEngineeringResult(invalid, input);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("AE-R6"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T15 — missing required capability blocks
// ---------------------------------------------------------------------------
describe("T15 — missing required capability blocks", () => {
  it("removing incident.logs yields status BLOCKED, no candidate, no invented capability", async () => {
    const result = await runSkillAssisted(BLOCKED_INPUT);
    expect(result.need_decision.status).toBe("BLOCKED");
    expect(result.need_decision.agent_requirement).toBe("AGENT_REQUIRED");
    expect(result.design).toBeNull();
    expect(result.reuse_agent_id).toBeNull();
    expect(result.need_decision.blocking_reasons.join(" ")).toMatch(/incident\.logs/);
    expect(validateAgentEngineeringResult(result, BLOCKED_INPUT).valid).toBe(true);
  });

  it("a hand-crafted BLOCKED result against the fully-resourced positive fixture (no real gap) is rejected — BLOCKED is not a self-certified escape hatch", async () => {
    const good = await runSkillAssisted(POSITIVE_INPUT);
    const invalid = clone(good);
    invalid.design = null;
    invalid.reuse_agent_id = null;
    invalid.need_decision.status = "BLOCKED";
    invalid.need_decision.agent_action = null;
    invalid.need_decision.blocking_reasons = ["Something felt missing."];
    const validation = validateAgentEngineeringResult(invalid, POSITIVE_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("self-certified escape hatch"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T16 — new candidate passes S10 validator
// ---------------------------------------------------------------------------
describe("T16 — new candidate passes S10 validator", () => {
  it("the positive-fixture DESIGN_NEW candidate passes the real, unchanged validateAgentDefinition()", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    expect(result.design).not.toBeNull();
    const validation = validateAgentDefinition(result.design!.candidate_definition);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T17 — tools/capabilities identity + availability
// ---------------------------------------------------------------------------
describe("T17 — tools/capabilities identity + availability", () => {
  it("candidate.tools == candidate.capabilities and every selected ID exists in the bounded input", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const candidate = result.design!.candidate_definition;
    expect(new Set(candidate.tools)).toEqual(new Set(candidate.capabilities));
    const availableIds = new Set(POSITIVE_INPUT.available_capabilities.map((c) => c.id));
    for (const id of candidate.capabilities) expect(availableIds.has(id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T18 — least privilege
// ---------------------------------------------------------------------------
describe("T18 — least privilege", () => {
  it("the positive fixture selects incident.read + incident.logs and excludes incident.admin", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const selected = new Set(result.design!.capability_design.selected_capability_ids);
    expect(selected.has("incident.read")).toBe(true);
    expect(selected.has("incident.logs")).toBe(true);
    expect(selected.has("incident.admin")).toBe(false);
    expect(result.design!.capability_design.rejected_available_capabilities.some((r) => r.id === "incident.admin")).toBe(true);
  });

  it("a hand-crafted design that adds incident.admin without an optional rationale is rejected by the validator", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const invalid = clone(result);
    invalid.design!.candidate_definition.tools.push("incident.admin");
    invalid.design!.candidate_definition.capabilities.push("incident.admin");
    invalid.design!.capability_design.selected_capability_ids.push("incident.admin");
    const validation = validateAgentEngineeringResult(invalid, POSITIVE_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("AE-R11"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T19 — permission bound
// ---------------------------------------------------------------------------
describe("T19 — permission bound", () => {
  it("candidate side-effect classes are sufficient and no broader than the work unit allows; deny_unlisted_capabilities is true", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const candidate = result.design!.candidate_definition;
    expect(candidate.permissions.deny_unlisted_capabilities).toBe(true);
    const allowed = new Set(POSITIVE_INPUT.work_unit.allowed_side_effect_classes);
    for (const effect of candidate.permissions.allowed_side_effects) {
      if (effect === "NONE") continue;
      expect(allowed.has(effect)).toBe(true);
    }
    expect(candidate.permissions.allowed_side_effects).toEqual(["NONE"]);
  });
});

// ---------------------------------------------------------------------------
// T20 — state vs memory separation
// ---------------------------------------------------------------------------
describe("T20 — state vs memory separation", () => {
  it("positive fixture: within-run state schema is populated while cross-run memory stays disabled", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    expect(result.design!.state_design.fields.length).toBeGreaterThanOrEqual(1);
    const mem = result.design!.candidate_definition.memory_policy;
    expect(mem.retrieve).toBe(false);
    expect(mem.remember_candidate).toBe(false);
    expect(mem.search_history).toBe(false);
    expect(mem.commit_verified_memory).toBe(false);
    expect(mem.promotion_policy).toBe("DISABLED");
  });
});

// ---------------------------------------------------------------------------
// T21 — cross-run memory policy
// ---------------------------------------------------------------------------
describe("T21 — cross-run memory policy", () => {
  it("a work unit that requires cross-run history enables retrieval/history but never commit_verified_memory", async () => {
    const result = await runSkillAssisted(CROSS_RUN_MEMORY_INPUT);
    expect(result.need_decision.agent_action).toBe("DESIGN_NEW");
    const mem = result.design!.candidate_definition.memory_policy;
    expect(mem.retrieve).toBe(true);
    expect(mem.remember_candidate).toBe(true);
    expect(mem.search_history).toBe(true);
    expect(mem.promotion_policy).toBe("EXPLICIT_VERIFIED_ONLY");
    expect(mem.commit_verified_memory).toBe(false);
    expect(result.design!.eval_plan.some((e) => e.category === "MEMORY_POLICY")).toBe(true);
    expect(validateAgentEngineeringResult(result, CROSS_RUN_MEMORY_INPUT).valid).toBe(true);
  });

  it("a hand-crafted candidate setting commit_verified_memory true is rejected", async () => {
    const result = await runSkillAssisted(CROSS_RUN_MEMORY_INPUT);
    const invalid = clone(result);
    invalid.design!.candidate_definition.memory_policy.commit_verified_memory = true;
    const validation = validateAgentEngineeringResult(invalid, CROSS_RUN_MEMORY_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("AE-R15"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T22 — termination and limits
// ---------------------------------------------------------------------------
describe("T22 — termination and limits", () => {
  it("candidate preserves terminal semantics and never exceeds the supplied iteration budget", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const candidate = result.design!.candidate_definition;
    expect(candidate.termination.require_terminal_outcome).toBe(true);
    expect(candidate.termination.require_explanation).toBe(true);
    expect(candidate.limits.max_turns).toBeLessThanOrEqual(POSITIVE_INPUT.work_unit.iteration_budget!.max_turns);
    expect(candidate.limits.timeout_ms).toBeLessThanOrEqual(POSITIVE_INPUT.work_unit.iteration_budget!.timeout_ms);
  });

  it("a hand-crafted candidate raising max_turns above the budget is rejected", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const invalid = clone(result);
    invalid.design!.candidate_definition.limits.max_turns = 99;
    const validation = validateAgentEngineeringResult(invalid, POSITIVE_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("AE-R17"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T23 — output/rubric/evals completeness
// ---------------------------------------------------------------------------
describe("T23 — output/rubric/evals completeness", () => {
  it("candidate output schema and rubric come from the work unit; every required eval category is represented", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const candidate = result.design!.candidate_definition;
    expect(candidate.output_schema).toEqual(POSITIVE_INPUT.work_unit.expected_output_schema);
    expect(candidate.rubric.quality_contract_ref).toBe(POSITIVE_INPUT.work_unit.quality_contract_ref);
    const categories = new Set(result.design!.eval_plan.map((e) => e.category));
    for (const required of ["GOAL_SUCCESS", "OUTPUT_CONTRACT", "LEAST_PRIVILEGE", "TERMINATION", "NEGATIVE_SAFETY"]) {
      expect(categories.has(required as any)).toBe(true);
    }
    expect(candidate.evals.length).toBeGreaterThanOrEqual(5);
  });

  it("a hand-crafted candidate that fabricates a different quality_contract_ref is rejected", async () => {
    const result = await runSkillAssisted(POSITIVE_INPUT);
    const invalid = clone(result);
    invalid.design!.candidate_definition.rubric.quality_contract_ref = "brain-bootstrap/quality-contracts/INVENTED.yaml";
    const validation = validateAgentEngineeringResult(invalid, POSITIVE_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("AE-R20"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T24 — proposal/human approval semantics
// ---------------------------------------------------------------------------
describe("T24 — proposal/human approval semantics", () => {
  it("every canonical result is PROPOSED, approval_required true, and never carries a non-PROPOSED design", async () => {
    for (const { input } of [...SUITE, { input: BLOCKED_INPUT }, { input: CROSS_RUN_MEMORY_INPUT }]) {
      const result = await runSkillAssisted(input);
      expect(result.proposal_status).toBe("PROPOSED");
      expect(result.approval_required).toBe(true);
      expect(result.approval_note.length).toBeGreaterThan(0);
      if (result.design) expect(result.design.proposal_status).toBe("PROPOSED");
    }
  });

  it("no ACCEPTED/ACTIVE/REGISTERED/DEPLOYED state string appears in the design proposal type surface", () => {
    const result = synthesizeSkillAgentEngineeringResult(POSITIVE_INPUT);
    const serialized = JSON.stringify(result);
    for (const forbidden of ["ACCEPTED", "ACTIVE", "REGISTERED", "DEPLOYED"]) {
      expect(serialized).not.toContain(`"${forbidden}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// T25 — optional S13D input immutability
// ---------------------------------------------------------------------------
describe("T25 — optional S13D input immutability", () => {
  it("supplying an S13D SoftwareArchitectureDecisionResult leaves it deep-equal before/after, still PROPOSED", async () => {
    const architecture_decision = {
      architecture_question: "How should the kiosk persist transactions offline?",
      decision_status: "READY_FOR_HUMAN_APPROVAL" as const,
      decision_drivers: [],
      alternatives: [],
      recommended_alternative_id: null,
      recommendation_summary: "n/a",
      rejected_alternative_reasons: [],
      unresolved_decision_gaps: [],
      adr: {
        id: "ADR-X", title: "t", status: "PROPOSED" as const, decision_question: "q", context: "c",
        decision_drivers: [], alternatives_considered: [], decision: "d", selected_alternative_id: null, rationale: "r",
        positive_consequences: [], negative_consequences: [], failure_modes: [], cost_considerations: [],
        operational_considerations: [], security_considerations: [], evidence_refs: [], assumptions: [],
        unresolved_questions: [], approval_required: true as const, approval_note: "n",
      },
      adr_markdown: "# ADR",
    };
    const input: AgentEngineeringInput = { ...clone(POSITIVE_INPUT), architecture_decision };
    const before = clone(architecture_decision);
    const result = await runSkillAssisted(input);
    expect(result.need_decision.agent_requirement).toBe("AGENT_REQUIRED");
    expect(input.architecture_decision).toEqual(before);
    expect(input.architecture_decision!.adr.status).toBe("PROPOSED");
  });
});

// ---------------------------------------------------------------------------
// T26 — no Agent Factory / no candidate auto-registration
// ---------------------------------------------------------------------------
describe("T26 — no Agent Factory / no candidate auto-registration", () => {
  it("no AgentFactory / AgentRegistry / MetaAgentRuntime / registerGeneratedAgent construct exists in src/", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8");
          if (/class\s+AgentFactory|class\s+AgentRegistry|class\s+MetaAgentRuntime|class\s+MultiAgentCoordinator|function\s+registerGeneratedAgent/.test(text)) {
            offenders.push(full);
          }
        }
      }
    }
    walk("src");
    expect(offenders).toEqual([]);
  });

  it("the S13E modules never write to src/intelligence/agent-definitions/ or invoke a registrar", () => {
    const dir = "src/intelligence/agent-engineering";
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, entry), "utf8");
      expect(text).not.toMatch(/writeFileSync|writeFile\(|fs\.promises\.writeFile|child_process/);
    }
  });
});

// ---------------------------------------------------------------------------
// T27 — same S10/S09 runtime path
// ---------------------------------------------------------------------------
describe("T27 — same S10/S09 runtime path", () => {
  it("both arms execute through compileAgentDefinition() -> runAgent() with identical base config; only materialization differs", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const selection = await selectSkillForTask({ task: SELECTION_TASK, agent_definition: agentEngineerDefinition, provider });
    const skillDefinition = materializeAgentEngineeringTask({
      baseDefinition: agentEngineerDefinition,
      input: POSITIVE_INPUT,
      loadedSkill: selection.loaded!,
      qualityContractRef: AGENT_ENGINEERING_QUALITY_CONTRACT_REF,
    });
    const baselineDefinition = materializeBaselineAgentEngineeringTask({ baseDefinition: agentEngineerDefinition, input: POSITIVE_INPUT });

    expect(baselineDefinition.limits).toEqual(skillDefinition.limits);
    expect(baselineDefinition.model_policy).toEqual(skillDefinition.model_policy);
    expect(baselineDefinition.tools).toEqual(skillDefinition.tools);
    expect(baselineDefinition.capabilities).toEqual(skillDefinition.capabilities);
    expect(baselineDefinition.objective).not.toContain("SKILL_ID:");
    expect(skillDefinition.objective).toContain("SKILL_ID:");

    await runSkillAssisted(POSITIVE_INPUT);
    await runBaseline(POSITIVE_INPUT);
  });

  it("has no separate AgentEngineering runtime function/class anywhere in src/", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8");
          if (/function\s+runAgentEngineering|class\s+AgentEngineeringRuntime/.test(text)) offenders.push(full);
        }
      }
    }
    walk("src");
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T28 — no role/Skill branching in Core
// ---------------------------------------------------------------------------
describe("T28 — no role/Skill branching in Core", () => {
  it("finds no agent-engineer role / S13E Skill-id branching anywhere under src/core/", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8");
          if (/agent-engineer|agent-engineering\.design\.s13e/i.test(text)) offenders.push(full);
        }
      }
    }
    walk("src/core");
    expect(offenders).toEqual([]);
  });

  it("finds no import of src/providers/ or src/intelligence/ inside src/core/", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          for (const line of readFileSync(full, "utf8").split("\n")) {
            const isImport = /^\s*import[\s{]/.test(line) || /^\s*export\s+\*?\s*(from|{)/.test(line);
            if (isImport && (line.includes("../../providers") || line.includes("../providers") || line.includes("../../intelligence") || line.includes("../intelligence"))) {
              offenders.push(`${full}: ${line.trim()}`);
            }
          }
        }
      }
    }
    walk("src/core");
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T29 — independent-truth Skill improvement + input dependence
// ---------------------------------------------------------------------------
describe("T29 — independent-truth Skill improvement + input dependence", () => {
  it("fixture truth is test-only: fixtures.ts does not import fixtureTruth.ts, and no truth value reaches the materialized objective", () => {
    const fixturesText = readFileSync("tests/agent-engineering/fixtures.ts", "utf8");
    // No import/export statement in fixtures.ts may reference the truth module.
    for (const line of fixturesText.split("\n")) {
      const isModuleRef = /^\s*(import|export)\b/.test(line) || /\brequire\s*\(/.test(line);
      if (isModuleRef) expect(line).not.toMatch(/fixtureTruth/i);
    }
    expect(fixturesText).not.toMatch(/AgentEngineeringFixtureTruth/);

    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    return selectSkillForTask({ task: SELECTION_TASK, agent_definition: agentEngineerDefinition, provider }).then((selection) => {
      const def = materializeAgentEngineeringTask({
        baseDefinition: agentEngineerDefinition,
        input: POSITIVE_INPUT,
        loadedSkill: selection.loaded!,
        qualityContractRef: AGENT_ENGINEERING_QUALITY_CONTRACT_REF,
      });
      for (const token of ["expected_agent_requirement", "forbidden_capability_ids", "required_eval_categories", "expected_capability_ids"]) {
        expect(def.objective).not.toContain(token);
      }
    });
  });

  it("Skill-assisted run strictly improves the canonical S13E metrics vs the no-Skill baseline (independent fixture truth)", async () => {
    const skillCases: ScoredAgentEngineeringCase[] = [];
    const baselineCases: ScoredAgentEngineeringCase[] = [];
    for (const { input, truth } of SUITE) {
      skillCases.push({ result: await runSkillAssisted(input), input, truth });
      baselineCases.push({ result: await runBaseline(input), input, truth });
    }
    const comparison = compareAgentEngineeringRuns(baselineCases, skillCases);

    expect(comparison.skill.necessity_accuracy_ratio).toBeGreaterThan(comparison.baseline.necessity_accuracy_ratio);
    expect(comparison.skill.strategy_accuracy_ratio).toBeGreaterThan(comparison.baseline.strategy_accuracy_ratio);
    expect(comparison.skill.design_completeness_ratio).toBeGreaterThan(comparison.baseline.design_completeness_ratio);
    expect(comparison.skill.least_privilege_accuracy_ratio).toBeGreaterThan(comparison.baseline.least_privilege_accuracy_ratio);
    expect(comparison.skill.eval_coverage_ratio).toBeGreaterThan(comparison.baseline.eval_coverage_ratio);
    expect(comparison.skill.unnecessary_new_agent_count).toBeLessThan(comparison.baseline.unnecessary_new_agent_count);
    expect(comparison.skill.unsupported_capability_count).toBeLessThan(comparison.baseline.unsupported_capability_count);

    expect(comparison.skill.necessity_accuracy_ratio).toBe(1);
    expect(comparison.skill.strategy_accuracy_ratio).toBe(1);
  });

  it("canonical exact assertions on the Skill arm (Agent spec section 41)", async () => {
    const negative = await runSkillAssisted(NEGATIVE_INPUT);
    expect(negative.need_decision.agent_requirement).toBe("NO_AGENT");
    expect(negative.need_decision.non_agent_strategy).toBe("DETERMINISTIC_FUNCTION");
    expect(negative.design).toBeNull();

    const skillOnly = await runSkillAssisted(SKILL_ONLY_INPUT);
    expect(skillOnly.need_decision.agent_requirement).toBe("NO_AGENT");
    expect(skillOnly.need_decision.non_agent_strategy).toBe("SKILL_ONLY");
    expect(skillOnly.design).toBeNull();

    const reuse = await runSkillAssisted(REUSE_INPUT);
    expect(reuse.need_decision.agent_requirement).toBe("AGENT_REQUIRED");
    expect(reuse.need_decision.agent_action).toBe("REUSE_EXISTING");
    expect(reuse.reuse_agent_id).toBe("researcher-v1");
    expect(reuse.design).toBeNull();

    const positive = await runSkillAssisted(POSITIVE_INPUT);
    expect(positive.need_decision.agent_requirement).toBe("AGENT_REQUIRED");
    expect(positive.need_decision.agent_action).toBe("DESIGN_NEW");
    expect(validateAgentDefinition(positive.design!.candidate_definition).valid).toBe(true);
    expect(new Set(positive.design!.capability_design.selected_capability_ids)).toEqual(new Set(["incident.read", "incident.logs"]));
    expect(positive.design!.capability_design.selected_capability_ids).not.toContain("incident.admin");
  });

  it("Mutation A: relaxing the adaptive signals flips the incident work unit to NO_AGENT with no design", async () => {
    const original = await runSkillAssisted(POSITIVE_INPUT);
    const mutated = await runSkillAssisted(POSITIVE_INPUT_MUTATION_A);
    expect(original.need_decision.agent_requirement).toBe("AGENT_REQUIRED");
    expect(mutated.need_decision.agent_requirement).toBe("NO_AGENT");
    expect(mutated.design).toBeNull();
  });

  it("Mutation B: removing incident.logs flips DESIGN_NEW READY to BLOCKED", async () => {
    const original = await runSkillAssisted(POSITIVE_INPUT);
    const mutated = await runSkillAssisted(BLOCKED_INPUT);
    expect(original.need_decision.status).toBe("READY");
    expect(original.need_decision.agent_action).toBe("DESIGN_NEW");
    expect(mutated.need_decision.status).toBe("BLOCKED");
    expect(mutated.design).toBeNull();
  });

  it("computeAgentEngineeringComparisonMetrics never reads the result to derive truth (empty suite => vacuous 1/0)", () => {
    const metrics = computeAgentEngineeringComparisonMetrics([]);
    expect(metrics.necessity_accuracy_ratio).toBe(1);
    expect(metrics.unnecessary_new_agent_count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T30 — full regression
// ---------------------------------------------------------------------------
describe("T30 — full regression", () => {
  it("S07-S13D AgentDefinitions remain valid alongside the new S13E artifact", async () => {
    const { requirementsDiscovererDefinition } = await import("../../src/intelligence/agent-definitions/requirementsDiscovererDefinition.js");
    const { knowledgeGapAnalyzerDefinition } = await import("../../src/intelligence/agent-definitions/knowledgeGapAnalyzerDefinition.js");
    const { researcherDefinition } = await import("../../src/intelligence/agent-definitions/researcherDefinition.js");
    const { deepResearcherDefinition } = await import("../../src/intelligence/agent-definitions/deepResearcherDefinition.js");
    const { softwareArchitectDefinition } = await import("../../src/intelligence/agent-definitions/softwareArchitectDefinition.js");
    for (const def of [
      requirementsDiscovererDefinition,
      knowledgeGapAnalyzerDefinition,
      researcherDefinition,
      deepResearcherDefinition,
      softwareArchitectDefinition,
      agentEngineerDefinition,
    ] as AgentDefinition[]) {
      expect(validateAgentDefinition(def).valid).toBe(true);
    }
  });

  it("StructuredAgentOutput mapping matches the real run's mapping", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const selection = await selectSkillForTask({ task: SELECTION_TASK, agent_definition: agentEngineerDefinition, provider });
    const definition = materializeAgentEngineeringTask({
      baseDefinition: agentEngineerDefinition,
      input: POSITIVE_INPUT,
      loadedSkill: selection.loaded!,
      qualityContractRef: AGENT_ENGINEERING_QUALITY_CONTRACT_REF,
    });
    const compiled = compileAgentDefinition(definition, {
      model_provider: new DeterministicAgentEngineeringModelProvider(),
      capability_provider: new MultiCapabilityProvider([]),
    });
    const run = await runAgent(compiled.run_options);
    const data = run.output?.data as unknown as AgentEngineeringResult;
    const mapped = mapAgentEngineeringResultToStructuredOutput(data);
    expect(mapped.summary).toBe(run.output?.summary);
    expect(mapped.evidence_refs).toEqual(run.output?.evidence_refs);
    expect(mapped.evidence_refs).toEqual(["incident-brief", "kiosk-ops-runbook"]);
  });

  it("descriptor projection remains metadata-only for the S13E Skill", () => {
    const descriptor = toSkillDescriptor(agentEngineeringS13E);
    expect(descriptor.id).toBe(AGENT_ENGINEERING_SKILL_ID);
    expect((descriptor as any).rules).toBeUndefined();
    expect((descriptor as any).procedure).toBeUndefined();
  });

  it("no forbidden vendor/provider token appears in the agent-engineer AgentDefinition or Skill/Quality Contract artifacts", () => {
    const forbidden = /openai|anthropic api key|gpt-4|claude-[0-9]/i;
    expect(JSON.stringify(agentEngineerDefinition)).not.toMatch(forbidden);
    expect(JSON.stringify(agentEngineeringS13E)).not.toMatch(forbidden);
    expect(readFileSync(QC_PATH, "utf8")).not.toMatch(forbidden);
    expect(readFileSync(SPEC_PATH, "utf8")).not.toMatch(forbidden);
  });

  it("materializeAgentEngineeringTask does not mutate the base definition and rejects an invalid input", () => {
    const before = clone(agentEngineerDefinition);
    expect(() =>
      materializeAgentEngineeringTask({
        baseDefinition: agentEngineerDefinition,
        input: { ...clone(POSITIVE_INPUT), work_unit: { ...clone(POSITIVE_INPUT.work_unit), goal: "" } },
        loadedSkill: agentEngineeringS13E,
        qualityContractRef: AGENT_ENGINEERING_QUALITY_CONTRACT_REF,
      }),
    ).toThrow();
    expect(agentEngineerDefinition).toEqual(before);
  });

  it("the reference Skill catalog now has 8 entries including agent-engineering.design.s13e, S13A-S13D untouched", () => {
    expect(referenceSkillCatalogEntries.length).toBe(8);
    const ids = referenceSkillCatalogEntries.map((e) => e.descriptor.id);
    expect(ids).toContain(AGENT_ENGINEERING_SKILL_ID);
    expect(ids).toContain("software-architecture.adr.s13d");
    expect(ids).toContain("deep-research.evidence-grounded.s13c");
  });

  it("baseline synthesis is a real over-agentifying result that the validator rejects on the negative fixture", () => {
    const baseline = synthesizeBaselineAgentEngineeringResult(NEGATIVE_INPUT);
    expect(baseline.need_decision.agent_action).toBe("DESIGN_NEW");
    expect(validateAgentEngineeringResult(baseline, NEGATIVE_INPUT).valid).toBe(false);
  });
});
