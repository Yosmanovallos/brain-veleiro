import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as yaml from "js-yaml";
import { compileAgentDefinition, runAgent, validateAgentDefinition } from "../../src/core/agent/index.js";
import type { SkillCatalogEntry } from "../../src/core/skill/index.js";
import { validateSkillDefinition, toSkillDescriptor } from "../../src/core/skill/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { MultiCapabilityProvider } from "../agent/fixtures.js";
import { selectSkillForTask } from "../../src/intelligence/skills/selectSkillForTask.js";
import { referenceSkillCatalogEntries, softwareArchitectureS13D } from "../../src/intelligence/skills/index.js";
import { softwareArchitectDefinition } from "../../src/intelligence/agent-definitions/softwareArchitectDefinition.js";
import {
  SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF,
  SOFTWARE_ARCHITECTURE_SKILL_ARTIFACT_PATH,
  SOFTWARE_ARCHITECTURE_SKILL_ID,
} from "../../src/intelligence/software-architecture/softwareArchitectureSkill.js";
import {
  materializeBaselineSoftwareArchitectureTask,
  materializeSoftwareArchitectureTask,
  validateSoftwareArchitectureInput,
} from "../../src/intelligence/software-architecture/materializeSoftwareArchitectureTask.js";
import {
  hardDrivers,
  mapSoftwareArchitectureResultToStructuredOutput,
  validateSoftwareArchitectureResult,
} from "../../src/intelligence/software-architecture/validateSoftwareArchitectureResult.js";
import { compareSoftwareArchitectureRuns, hasArchitectureSpecificSecurity } from "../../src/intelligence/software-architecture/compareSoftwareArchitectureRuns.js";
import { renderArchitectureDecisionRecord } from "../../src/intelligence/software-architecture/renderArchitectureDecisionRecord.js";
import type { SoftwareArchitectureDecisionResult } from "../../src/intelligence/software-architecture/types.js";
import {
  DeterministicSoftwareArchitectureModelProvider,
  KIOSK_INPUT,
  KIOSK_INPUT_C1_SOFT,
  KIOSK_INPUT_WITH_UNRESOLVED_BLOCKER,
  MINI_DEEP_RESEARCH_INVALID,
  MINI_DEEP_RESEARCH_VALID,
  MINI_KGA,
  miniDeepResearchBatch,
  synthesizeBaselineArchitectureResult,
  synthesizeSkillArchitectureResult,
} from "./fixtures.js";

const SKILL_PATH = SOFTWARE_ARCHITECTURE_SKILL_ARTIFACT_PATH;
const QC_PATH = "brain-bootstrap/quality-contracts/S13D_SOFTWARE_ARCHITECTURE_DEEP.yaml";

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

async function runSkillAssistedScenario(input: typeof KIOSK_INPUT) {
  const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
  const selection = await selectSkillForTask({
    task: "software architecture alternatives comparison trade-offs failure modes cost operations security ADR",
    agent_definition: softwareArchitectDefinition,
    provider,
  });
  if (!selection.loaded) throw new Error("S13D Skill was not selected/loaded — cannot run scenario.");

  const definition = materializeSoftwareArchitectureTask({
    baseDefinition: softwareArchitectDefinition,
    input,
    loadedSkill: selection.loaded,
    qualityContractRef: SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF,
  });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicSoftwareArchitectureModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  return runAgent(compiled.run_options);
}

async function runBaselineScenario(input: typeof KIOSK_INPUT) {
  const definition = materializeBaselineSoftwareArchitectureTask({ baseDefinition: softwareArchitectDefinition, input });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicSoftwareArchitectureModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  return runAgent(compiled.run_options);
}

const GROUND_TRUTH = {
  true_hard_constraint_fit_by_alternative: {
    "ALT-A": { C1: "STRONG" as const, C2: "STRONG" as const, C8: "STRONG" as const },
    "ALT-B": { C1: "FAIL" as const, C2: "ACCEPTABLE" as const, C8: "FAIL" as const },
    "ALT-C": { C1: "STRONG" as const, C2: "WEAK" as const, C8: "STRONG" as const },
  },
  expected_material_failure_mode_count_by_alternative: { "ALT-A": 3, "ALT-B": 1, "ALT-C": 3 },
  expected_assumption_count: 2,
};

// ---------------------------------------------------------------------------
// T1 — canonical S13D Skill source exists
// ---------------------------------------------------------------------------
describe("T1 — canonical S13D Skill source exists", () => {
  it("contains the approved identity and canonical vocabulary", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const token of ["alternatives", "trade-offs", "failure modes", "cost", "operations", "security", "ADR", "human approval"]) {
      expect(text.toLowerCase()).toContain(token.toLowerCase());
    }
  });

  it("every typed rule/procedure/verification id is present in the canonical markdown, with the exact 24/11/12 counts", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    expect(softwareArchitectureS13D.rules.length).toBe(24);
    expect(softwareArchitectureS13D.procedure.length).toBe(11);
    expect(softwareArchitectureS13D.verification.length).toBe(12);
    for (const rule of softwareArchitectureS13D.rules) expect(text).toContain(rule.id);
    for (const step of softwareArchitectureS13D.procedure) expect(text).toContain(step.id);
    for (const check of softwareArchitectureS13D.verification) expect(text).toContain(check.id);
  });
});

// ---------------------------------------------------------------------------
// T2 — typed Skill validates
// ---------------------------------------------------------------------------
describe("T2 — typed Skill validates", () => {
  it("passes S12 SkillDefinition validation", () => {
    const result = validateSkillDefinition(softwareArchitectureS13D);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T3 — typed Skill preserves canonical semantics
// ---------------------------------------------------------------------------
describe("T3 — typed Skill preserves canonical semantics", () => {
  it("mechanically proves 2-4 alternatives, canonical dimensions, hard-constraint rule, PROPOSED ADR, approval_required, zero capabilities", () => {
    const combined = `${softwareArchitectureS13D.description} ${softwareArchitectureS13D.rules.map((r) => r.statement).join(" ")}`;
    expect(combined).toMatch(/two and (at most )?four/i);
    for (const dim of ["requirements_fit", "trade_offs", "failure_modes", "cost", "operations", "security", "reversibility"]) {
      expect(combined).toContain(dim);
    }
    expect(combined).toMatch(/hard-constraint FAIL/);
    expect(combined).toMatch(/PROPOSED/);
    expect(combined).toMatch(/approval_required/);
    expect(softwareArchitectureS13D.requires.capabilities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T4 — DEEP Quality Contract integrity
// ---------------------------------------------------------------------------
describe("T4 — DEEP Quality Contract integrity", () => {
  it("parses and satisfies the canonical S13D requirements", () => {
    const doc = yaml.load(readFileSync(QC_PATH, "utf8")) as Record<string, any>;
    expect(doc.depth).toBe("DEEP");
    expect(doc.risk).toBe("HIGH");
    expect(doc.irreversibility).toBe("HIGH");
    expect(doc.research.alternatives_required).toBe(true);
    expect(doc.implementation.tradeoffs_required).toBe(true);
    expect(doc.verification.independent_review_required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T5 — software-architect AgentDefinition validates
// ---------------------------------------------------------------------------
describe("T5 — software-architect AgentDefinition validates", () => {
  it("passes the existing S10 validation path", () => {
    const result = validateAgentDefinition(softwareArchitectDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("is a new, independent AgentDefinition", () => {
    expect(softwareArchitectDefinition.id).toBe("software-architect-v1");
    expect(softwareArchitectDefinition.role).toBe("software-architect");
  });
});

// ---------------------------------------------------------------------------
// T6 — zero capability/tool dependency
// ---------------------------------------------------------------------------
describe("T6 — zero capability/tool dependency", () => {
  it("AgentDefinition.tools and .capabilities are both empty", () => {
    expect(softwareArchitectDefinition.tools).toEqual([]);
    expect(softwareArchitectDefinition.capabilities).toEqual([]);
  });

  it("Skill.requires.capabilities and .permissions.allowed_capabilities are both empty", () => {
    expect(softwareArchitectureS13D.requires.capabilities).toEqual([]);
    expect(softwareArchitectureS13D.permissions.allowed_capabilities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T7 — exact Skill allowlist
// ---------------------------------------------------------------------------
describe("T7 — exact Skill allowlist", () => {
  it("agent.skills is exactly [software-architecture.adr.s13d]", () => {
    expect(softwareArchitectDefinition.skills).toEqual([SOFTWARE_ARCHITECTURE_SKILL_ID]);
  });
});

// ---------------------------------------------------------------------------
// T8 — S12 discovery selects S13D
// ---------------------------------------------------------------------------
describe("T8 — S12 discovery selects S13D", () => {
  it("selects and loads the S13D Skill for the real, unmodified softwareArchitectDefinition", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await selectSkillForTask({
      task: "software architecture alternatives comparison trade-offs failure modes ADR",
      agent_definition: softwareArchitectDefinition,
      provider,
    });
    expect(result.discovered.every((d) => d.id === SOFTWARE_ARCHITECTURE_SKILL_ID)).toBe(true);
    expect(result.selected?.id).toBe(SOFTWARE_ARCHITECTURE_SKILL_ID);
    expect(result.loaded?.id).toBe(SOFTWARE_ARCHITECTURE_SKILL_ID);
  });

  it("no full definition loads during discovery", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await provider.discover({ query: "software architecture", allowed_skill_ids: softwareArchitectDefinition.skills });
    for (const spy of spies.values()) expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T9 — lazy selected load only
// ---------------------------------------------------------------------------
describe("T9 — lazy selected load only", () => {
  it("calls only the S13D loader exactly once; unrelated loaders remain uncalled", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await selectSkillForTask({ task: "software architecture alternatives ADR", agent_definition: softwareArchitectDefinition, provider });

    expect(spies.get(SOFTWARE_ARCHITECTURE_SKILL_ID)).toHaveBeenCalledTimes(1);
    for (const [id, spy] of spies.entries()) {
      if (id !== SOFTWARE_ARCHITECTURE_SKILL_ID) expect(spy).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// T10 — input contract validation
// ---------------------------------------------------------------------------
describe("T10 — input contract validation", () => {
  it("rejects an empty architecture_question", () => {
    expect(() => validateSoftwareArchitectureInput({ ...clone(KIOSK_INPUT), architecture_question: "  " })).toThrow(/architecture_question/);
  });

  it("rejects an invalid S13B input", () => {
    expect(() => validateSoftwareArchitectureInput({ ...clone(KIOSK_INPUT), knowledge_gap_analysis: {} as any })).toThrow(/KnowledgeGapAnalysisResult/);
  });

  it("rejects more than 4 candidate_alternatives", () => {
    const invalid = clone(KIOSK_INPUT);
    invalid.candidate_alternatives = [
      ...invalid.candidate_alternatives!,
      { id: "ALT-D", name: "D", description: "d", origin: "PROVIDED" },
      { id: "ALT-E", name: "E", description: "e", origin: "PROVIDED" },
    ];
    expect(() => validateSoftwareArchitectureInput(invalid)).toThrow(/0-4/);
  });

  it("rejects duplicate alternative IDs", () => {
    const invalid = clone(KIOSK_INPUT);
    invalid.candidate_alternatives = [invalid.candidate_alternatives![0], { ...invalid.candidate_alternatives![0] }];
    expect(() => validateSoftwareArchitectureInput(invalid)).toThrow(/unique/);
  });

  it("accepts S13B-only input", () => {
    expect(() => validateSoftwareArchitectureInput(KIOSK_INPUT)).not.toThrow();
  });

  it("accepts S13B + S13C input", () => {
    const withResearch = { architecture_question: "Minimal question relevant to X1.", knowledge_gap_analysis: MINI_KGA, deep_research: MINI_DEEP_RESEARCH_VALID };
    expect(() => validateSoftwareArchitectureInput(withResearch)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T11 — upstream compatibility
// ---------------------------------------------------------------------------
describe("T11 — upstream compatibility", () => {
  it("accepts a deep_research whose knowledge_item_id resolves to S13B context", () => {
    const input = { architecture_question: "Minimal question relevant to X1.", knowledge_gap_analysis: MINI_KGA, deep_research: MINI_DEEP_RESEARCH_VALID };
    expect(() => validateSoftwareArchitectureInput(input)).not.toThrow();
  });

  it("rejects a deep_research whose knowledge_item_id does not resolve to S13B context", () => {
    const input = { architecture_question: "Minimal question relevant to X1.", knowledge_gap_analysis: MINI_KGA, deep_research: MINI_DEEP_RESEARCH_INVALID };
    expect(() => validateSoftwareArchitectureInput(input)).toThrow(/does not resolve/);
  });
});

// ---------------------------------------------------------------------------
// T12 — upstream immutability
// ---------------------------------------------------------------------------
describe("T12 — upstream immutability", () => {
  it("running S13D does not mutate the input KnowledgeGapAnalysisResult", async () => {
    const before = clone(KIOSK_INPUT.knowledge_gap_analysis);
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    expect(result.outcome).toBe("SUCCESS");
    expect(KIOSK_INPUT.knowledge_gap_analysis).toEqual(before);
  });

  it("running S13D does not mutate a supplied S13C DeepResearchBatchResult", async () => {
    const deepResearch = miniDeepResearchBatch("C6");
    const before = clone(deepResearch);
    const input = { ...clone(KIOSK_INPUT), deep_research: deepResearch };
    const result = await runSkillAssistedScenario(input);
    expect(result.outcome).toBe("SUCCESS");
    expect(deepResearch).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// T13 — alternative count and origin
// ---------------------------------------------------------------------------
describe("T13 — alternative count and origin", () => {
  it("the non-blocked positive fixture has 2-4 alternatives, unique IDs, valid origins", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    expect(data.alternatives.length).toBeGreaterThanOrEqual(2);
    expect(data.alternatives.length).toBeLessThanOrEqual(4);
    expect(new Set(data.alternatives.map((a) => a.id)).size).toBe(data.alternatives.length);
    for (const alt of data.alternatives) expect(["PROVIDED", "GENERATED"]).toContain(alt.origin);
  });
});

// ---------------------------------------------------------------------------
// T14 — hard-constraint coverage
// ---------------------------------------------------------------------------
describe("T14 — hard-constraint coverage", () => {
  it("every hard constraint has one evaluation per alternative", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const hd = hardDrivers(data.decision_drivers);
    expect(hd.length).toBeGreaterThan(0);
    for (const alt of data.alternatives) {
      for (const driver of hd) {
        expect(alt.driver_evaluations.some((e) => e.driver_id === driver.id)).toBe(true);
      }
    }
  });

  it("a hand-crafted result missing a hard-constraint evaluation is rejected", () => {
    const result = synthesizeSkillArchitectureResult(KIOSK_INPUT);
    const invalid = clone(result);
    invalid.alternatives[0].driver_evaluations = invalid.alternatives[0].driver_evaluations.filter((e) => e.driver_id !== "C1");
    const validation = validateSoftwareArchitectureResult(invalid, KIOSK_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("T14"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T15 — hard-constraint violation blocks recommendation
// ---------------------------------------------------------------------------
describe("T15 — hard-constraint violation blocks recommendation", () => {
  it("the baseline's naive result (recommends ALT-B despite the offline hard constraint) is rejected by the validator", () => {
    const baseline = synthesizeBaselineArchitectureResult(KIOSK_INPUT);
    const validation = validateSoftwareArchitectureResult(baseline, KIOSK_INPUT);
    expect(validation.valid).toBe(false);
  });

  it("a hand-crafted result that recommends an alternative with a self-reported hard FAIL is rejected", () => {
    const result = synthesizeSkillArchitectureResult(KIOSK_INPUT);
    const invalid = clone(result);
    invalid.recommended_alternative_id = "ALT-B";
    const validation = validateSoftwareArchitectureResult(invalid, KIOSK_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("T15"))).toBe(true);
  });

  it("the Skill run never recommends ALT-B while C1 is a hard constraint", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    expect(data.recommended_alternative_id).not.toBe("ALT-B");
  });

  it("a result that declares zero decision_drivers while claiming READY_FOR_HUMAN_APPROVAL is rejected, even with structurally valid alternatives", () => {
    const result = synthesizeSkillArchitectureResult(KIOSK_INPUT);
    const invalid = clone(result);
    invalid.decision_drivers = [];
    for (const alt of invalid.alternatives) alt.driver_evaluations = [];
    const validation = validateSoftwareArchitectureResult(invalid, KIOSK_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => /decision_drivers must declare at least one driver|zero hard constraints/.test(e))).toBe(true);
  });

  it("a result citing an evidence ref outside the resolvable universe (S13B items, declared drivers, S13C evidence) is rejected", () => {
    const result = synthesizeSkillArchitectureResult(KIOSK_INPUT);
    const invalid = clone(result);
    invalid.alternatives[0].evidence_refs = [...invalid.alternatives[0].evidence_refs, "FABRICATED-XYZ"];
    const validation = validateSoftwareArchitectureResult(invalid, KIOSK_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("T21") && e.includes("FABRICATED-XYZ"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T16 — balanced comparison
// ---------------------------------------------------------------------------
describe("T16 — balanced comparison", () => {
  it("each fixture alternative includes a benefit and a disadvantage, and rejection reasons exist for every non-selected alternative", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    for (const alt of data.alternatives) {
      expect(alt.benefits.length).toBeGreaterThanOrEqual(1);
      expect(alt.disadvantages.length).toBeGreaterThanOrEqual(1);
    }
    for (const alt of data.alternatives) {
      if (alt.id === data.recommended_alternative_id) continue;
      const rejection = data.rejected_alternative_reasons.find((r) => r.alternative_id === alt.id);
      expect(rejection).toBeDefined();
      expect(rejection!.reasons.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// T17 — canonical dimension coverage
// ---------------------------------------------------------------------------
describe("T17 — canonical dimension coverage", () => {
  it("every viable positive-fixture alternative has all 7 canonical dimensions", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    for (const alt of data.alternatives) {
      expect(alt.driver_evaluations.length).toBeGreaterThan(0);
      expect(alt.benefits.length + alt.disadvantages.length).toBeGreaterThan(0);
      expect(alt.failure_modes.length).toBeGreaterThan(0);
      expect(alt.cost).toBeTruthy();
      expect(alt.operations).toBeTruthy();
      expect(alt.security).toBeTruthy();
      expect(alt.reversibility).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// T18 — failure-mode structure
// ---------------------------------------------------------------------------
describe("T18 — failure-mode structure", () => {
  it("fixture failure modes include trigger, impact, observable symptom, mitigation, residual risk", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const allFailureModes = data.alternatives.flatMap((a) => a.failure_modes);
    expect(allFailureModes.length).toBeGreaterThan(0);
    for (const fm of allFailureModes) {
      expect(fm.trigger.trim()).not.toBe("");
      expect(fm.impact.trim()).not.toBe("");
      expect(fm.observable_symptom.trim()).not.toBe("");
      expect(fm.mitigation_or_containment.trim()).not.toBe("");
      expect(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).toContain(fm.residual_risk);
    }
  });
});

// ---------------------------------------------------------------------------
// T19 — architecture-specific security
// ---------------------------------------------------------------------------
describe("T19 — architecture-specific security", () => {
  it("positive fixture security analysis differs between local and remote persistence and is not generic boilerplate", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const altA = data.alternatives.find((a) => a.id === "ALT-A")!;
    const altB = data.alternatives.find((a) => a.id === "ALT-B")!;
    expect(altA.security.sensitive_data_exposure[0]).not.toBe(altB.security.sensitive_data_exposure[0]);
    expect(altA.security.attack_surface_notes.join(" ")).not.toMatch(/^use encryption$/i);
  });

  it("the baseline's generic-boilerplate-only security output is not architecture-specific (production genericness check)", () => {
    const baseline = synthesizeBaselineArchitectureResult(KIOSK_INPUT);
    const alt = baseline.alternatives[0];
    expect(hasArchitectureSpecificSecurity(alt.security)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T20 — cost/operations/reversibility
// ---------------------------------------------------------------------------
describe("T20 — cost/operations/reversibility", () => {
  it("positive fixture separates implementation/operational/exit cost and deployment/backup/migration notes", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const altA = data.alternatives.find((a) => a.id === "ALT-A")!;
    const costLevels = new Set([altA.cost.implementation_cost, altA.cost.ongoing_operational_cost, altA.cost.migration_or_exit_cost]);
    expect(costLevels.size).toBeGreaterThan(1);
    expect(altA.operations.backup_recovery_notes.length).toBeGreaterThan(0);
    expect(altA.reversibility.migration_path.trim()).not.toBe("");
    expect(altA.reversibility.lock_in_factors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// T21 — evidence traceability
// ---------------------------------------------------------------------------
describe("T21 — evidence traceability", () => {
  it("hard-constraint driver evaluations carry evidence_refs, and the metric denominator is fixture-defined (decision_drivers x alternatives), not output-derived", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const hd = hardDrivers(data.decision_drivers);
    for (const alt of data.alternatives) {
      for (const driver of hd) {
        const evaluation = alt.driver_evaluations.find((e) => e.driver_id === driver.id);
        expect(evaluation?.evidence_refs.length).toBeGreaterThanOrEqual(1);
      }
    }
    const metrics = compareSoftwareArchitectureRuns(synthesizeBaselineArchitectureResult(KIOSK_INPUT), data, KIOSK_INPUT, GROUND_TRUTH as any);
    expect(metrics.skill.evidence_traceability_ratio).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T22 — unresolved critical gap prevents readiness
// ---------------------------------------------------------------------------
describe("T22 — unresolved critical gap prevents readiness", () => {
  it("an unresolved DECISION_CRITICAL blocking item relevant to the decision prevents READY_FOR_HUMAN_APPROVAL", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT_WITH_UNRESOLVED_BLOCKER);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    expect(data.decision_status).not.toBe("READY_FOR_HUMAN_APPROVAL");
    expect(["NEEDS_MORE_EVIDENCE", "BLOCKED"]).toContain(data.decision_status);
    expect(data.unresolved_decision_gaps.length).toBeGreaterThan(0);
  });

  it("a hand-crafted READY_FOR_HUMAN_APPROVAL result with an unresolved DECISION_CRITICAL gap is rejected", () => {
    const result = synthesizeSkillArchitectureResult(KIOSK_INPUT);
    const invalid = clone(result);
    invalid.unresolved_decision_gaps = [{ knowledge_item_id: "C9", reason: "test", decision_impact: "DECISION_CRITICAL" }];
    const validation = validateSoftwareArchitectureResult(invalid, KIOSK_INPUT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("T22"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T23 — ADR semantics
// ---------------------------------------------------------------------------
describe("T23 — ADR semantics", () => {
  it("adr.status is PROPOSED and adr.approval_required is true", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    expect(data.adr.status).toBe("PROPOSED");
    expect(data.adr.approval_required).toBe(true);
  });

  it("the canonical ArchitectureDecisionRecord type has no ACCEPTED status member", () => {
    const result = synthesizeSkillArchitectureResult(KIOSK_INPUT);
    expect(result.adr.status).toBe("PROPOSED");
    const invalid = clone(result);
    (invalid.adr as any).status = "ACCEPTED";
    expect(validateSoftwareArchitectureResult(invalid, KIOSK_INPUT).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T24 — deterministic Markdown ADR
// ---------------------------------------------------------------------------
describe("T24 — deterministic Markdown ADR", () => {
  it("renders the canonical section order and re-renders identically from the same structured ADR", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const sections = ["## Status", "## Context", "## Decision Drivers", "## Alternatives Considered", "## Decision", "## Rationale", "## Consequences", "### Positive", "### Negative", "## Failure Modes", "## Cost", "## Operations", "## Security", "## Evidence", "## Assumptions", "## Open Questions", "## Approval"];
    let lastIndex = -1;
    for (const section of sections) {
      const index = data.adr_markdown.indexOf(`${section}\n`);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
    expect(renderArchitectureDecisionRecord(data.adr)).toBe(data.adr_markdown);
    expect(data.adr_markdown).toContain(data.adr.decision);
    for (const ref of data.adr.evidence_refs) expect(data.adr_markdown).toContain(ref);
  });
});

// ---------------------------------------------------------------------------
// T25 — same S10/S09 runtime path
// ---------------------------------------------------------------------------
describe("T25 — same S10/S09 runtime path", () => {
  it("executes through compileAgentDefinition() -> runAgent() and reaches SUCCESS", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    expect(result.outcome).toBe("SUCCESS");
  });

  it("has no separate SoftwareArchitecture runtime function anywhere in src/", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts") && /runAgent|runSoftwareArchitecture|SoftwareArchitectureRuntime/.test(readFileSync(full, "utf8"))) {
          if (/function\s+runSoftwareArchitecture|class\s+SoftwareArchitectureRuntime/.test(readFileSync(full, "utf8"))) offenders.push(full);
        }
      }
    }
    walk("src");
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T26 — no role/Skill branching in Core
// ---------------------------------------------------------------------------
describe("T26 — no role/Skill branching in Core", () => {
  it("finds no software-architect role/Skill-id branching anywhere under src/core/", () => {
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8");
          if (/software-architect|software-architecture\.adr\.s13d/i.test(text)) offenders.push(full);
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
          const lines = readFileSync(full, "utf8").split("\n");
          for (const line of lines) {
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
// T27 — input dependence + Skill improvement
// ---------------------------------------------------------------------------
describe("T27 — input dependence + Skill improvement", () => {
  it("output changes materially when the offline hard constraint is relaxed (mutated fixture)", async () => {
    const original = await runSkillAssistedScenario(KIOSK_INPUT);
    const mutated = await runSkillAssistedScenario(KIOSK_INPUT_C1_SOFT);
    const originalData = original.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const mutatedData = mutated.output?.data as unknown as SoftwareArchitectureDecisionResult;

    const originalAltBFit = originalData.alternatives.find((a) => a.id === "ALT-B")!.driver_evaluations.find((e) => e.driver_id === "C1")!.fit;
    const mutatedAltBFit = mutatedData.alternatives.find((a) => a.id === "ALT-B")!.driver_evaluations.find((e) => e.driver_id === "C1")!.fit;
    expect(mutatedAltBFit).not.toBe(originalAltBFit);

    const originalRejection = originalData.rejected_alternative_reasons.find((r) => r.alternative_id === "ALT-B")!.reasons;
    const mutatedRejection = mutatedData.rejected_alternative_reasons.find((r) => r.alternative_id === "ALT-B")!.reasons;
    expect(mutatedRejection).not.toEqual(originalRejection);
  });

  it("baseline and Skill run both execute through compileAgentDefinition() -> runAgent() with the same base config, only the materialization differs", async () => {
    const skillRun = await runSkillAssistedScenario(KIOSK_INPUT);
    const baselineRun = await runBaselineScenario(KIOSK_INPUT);
    expect(skillRun.outcome).toBe("SUCCESS");
    expect(baselineRun.outcome).toBe("SUCCESS");

    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const selection = await selectSkillForTask({ task: "software architecture", agent_definition: softwareArchitectDefinition, provider });
    const skillDefinition = materializeSoftwareArchitectureTask({
      baseDefinition: softwareArchitectDefinition,
      input: KIOSK_INPUT,
      loadedSkill: selection.loaded!,
      qualityContractRef: SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF,
    });
    const baselineDefinition = materializeBaselineSoftwareArchitectureTask({ baseDefinition: softwareArchitectDefinition, input: KIOSK_INPUT });

    expect(baselineDefinition.limits).toEqual(skillDefinition.limits);
    expect(baselineDefinition.model_policy).toEqual(skillDefinition.model_policy);
    expect(baselineDefinition.tools).toEqual(skillDefinition.tools);
    expect(baselineDefinition.capabilities).toEqual(skillDefinition.capabilities);
    expect(baselineDefinition.objective).not.toContain("SKILL_ID:");
    expect(skillDefinition.objective).toContain("SKILL_ID:");
  });

  it("on the positive fixture: canonical dimension coverage, failure-mode coverage, evidence traceability strictly improve, and hard-constraint violations strictly decrease", async () => {
    const skillRun = await runSkillAssistedScenario(KIOSK_INPUT);
    const baselineRun = await runBaselineScenario(KIOSK_INPUT);
    const skillData = skillRun.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const baselineData = baselineRun.output?.data as unknown as SoftwareArchitectureDecisionResult;

    const comparison = compareSoftwareArchitectureRuns(baselineData, skillData, KIOSK_INPUT, GROUND_TRUTH as any);

    expect(comparison.skill.canonical_dimension_coverage_ratio).toBeGreaterThan(comparison.baseline.canonical_dimension_coverage_ratio);
    expect(comparison.skill.failure_mode_coverage_ratio).toBeGreaterThan(comparison.baseline.failure_mode_coverage_ratio);
    expect(comparison.skill.evidence_traceability_ratio).toBeGreaterThan(comparison.baseline.evidence_traceability_ratio);
    expect(comparison.skill.hard_constraint_violation_count).toBeLessThan(comparison.baseline.hard_constraint_violation_count);

    expect(validateSoftwareArchitectureResult(skillData, KIOSK_INPUT).valid).toBe(true);
    expect(validateSoftwareArchitectureResult(baselineData, KIOSK_INPUT).valid).toBe(false);
  });

  it("on the negative fixture: the Skill run has zero hard-constraint violations, zero unsupported recommendations, and full security coverage", async () => {
    const skillRun = await runSkillAssistedScenario(KIOSK_INPUT);
    const baselineRun = await runBaselineScenario(KIOSK_INPUT);
    const skillData = skillRun.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const baselineData = baselineRun.output?.data as unknown as SoftwareArchitectureDecisionResult;

    const comparison = compareSoftwareArchitectureRuns(baselineData, skillData, KIOSK_INPUT, GROUND_TRUTH as any);

    expect(comparison.skill.hard_constraint_violation_count).toBe(0);
    expect(comparison.skill.unsupported_recommendation_count).toBe(0);
    expect(comparison.skill.security_dimension_coverage_ratio).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T28 — full regression
// ---------------------------------------------------------------------------
describe("T28 — full regression", () => {
  it("S07-S13C AgentDefinitions remain valid alongside the new S13D artifact", async () => {
    const { requirementsDiscovererDefinition } = await import("../../src/intelligence/agent-definitions/requirementsDiscovererDefinition.js");
    const { knowledgeGapAnalyzerDefinition } = await import("../../src/intelligence/agent-definitions/knowledgeGapAnalyzerDefinition.js");
    const { researcherDefinition } = await import("../../src/intelligence/agent-definitions/researcherDefinition.js");
    const { deepResearcherDefinition } = await import("../../src/intelligence/agent-definitions/deepResearcherDefinition.js");
    for (const def of [requirementsDiscovererDefinition, knowledgeGapAnalyzerDefinition, researcherDefinition, deepResearcherDefinition, softwareArchitectDefinition]) {
      expect(validateAgentDefinition(def).valid).toBe(true);
    }
  });

  it("StructuredAgentOutput mapping matches the real run's mapping", async () => {
    const result = await runSkillAssistedScenario(KIOSK_INPUT);
    const data = result.output?.data as unknown as SoftwareArchitectureDecisionResult;
    const mapped = mapSoftwareArchitectureResultToStructuredOutput(data);
    expect(mapped.summary).toBe(result.output?.summary);
    expect(mapped.evidence_refs).toEqual(result.output?.evidence_refs);
    expect(mapped.evidence_refs).toEqual(["stakeholder-brief", "C1", "C2", "C8", "C6"]);
  });

  it("descriptor projection remains metadata-only for the S13D Skill", () => {
    const descriptor = toSkillDescriptor(softwareArchitectureS13D);
    expect(descriptor.id).toBe(SOFTWARE_ARCHITECTURE_SKILL_ID);
    expect((descriptor as any).rules).toBeUndefined();
    expect((descriptor as any).procedure).toBeUndefined();
  });

  it("no forbidden vendor/provider token appears in the software-architect AgentDefinition or Skill/Quality Contract artifacts", () => {
    const forbidden = /openai|anthropic api key|gpt-4|claude-[0-9]/i;
    expect(JSON.stringify(softwareArchitectDefinition)).not.toMatch(forbidden);
    expect(JSON.stringify(softwareArchitectureS13D)).not.toMatch(forbidden);
  });

  it("materializeSoftwareArchitectureTask does not mutate the base definition and rejects an invalid input", () => {
    const before = clone(softwareArchitectDefinition);
    expect(() =>
      materializeSoftwareArchitectureTask({
        baseDefinition: softwareArchitectDefinition,
        input: { ...clone(KIOSK_INPUT), architecture_question: "" },
        loadedSkill: softwareArchitectureS13D,
        qualityContractRef: SOFTWARE_ARCHITECTURE_QUALITY_CONTRACT_REF,
      }),
    ).toThrow();
    expect(softwareArchitectDefinition).toEqual(before);
  });

  it("S13A/S13B/S13C's own artifacts and tests remain unaffected by the S13D catalog registration", () => {
    // Count is >= 7: S13E later registered an 8th reference Skill; the S13D
    // guarantee is that its own entry is present and S13C's is untouched.
    expect(referenceSkillCatalogEntries.length).toBeGreaterThanOrEqual(7);
    expect(referenceSkillCatalogEntries.map((e) => e.descriptor.id)).toContain("deep-research.evidence-grounded.s13c");
    expect(referenceSkillCatalogEntries.map((e) => e.descriptor.id)).toContain(SOFTWARE_ARCHITECTURE_SKILL_ID);
  });
});
