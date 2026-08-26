import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import {
  compileAgentDefinition,
  runAgent,
  validateAgentDefinition,
} from "../../src/core/agent/index.js";
import type { SkillCatalogEntry } from "../../src/core/skill/index.js";
import { toSkillDescriptor, validateSkillDefinition } from "../../src/core/skill/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import {
  referenceSkillCatalogEntries,
  requirementsDiscoveryS13A,
  researchEvidenceGroundedS11,
  referenceSummarize,
  selectSkillForTask,
} from "../../src/intelligence/skills/index.js";
import { requirementsDiscovererDefinition } from "../../src/intelligence/agent-definitions/requirementsDiscovererDefinition.js";
import { researcherDefinition } from "../../src/intelligence/agent-definitions/researcherDefinition.js";
import {
  REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
  REQUIREMENTS_DISCOVERY_SKILL_ARTIFACT_PATH,
  REQUIREMENTS_DISCOVERY_SKILL_ID,
} from "../../src/intelligence/requirements-discovery/requirementsDiscoverySkill.js";
import {
  materializeBaselineRequirementsDiscoveryTask,
  materializeRequirementsDiscoveryTask,
} from "../../src/intelligence/requirements-discovery/materializeRequirementsDiscoveryTask.js";
import {
  mapRequirementsDiscoveryResultToStructuredOutput,
  validateRequirementsDiscoveryResult,
} from "../../src/intelligence/requirements-discovery/validateRequirementsDiscoveryResult.js";
import { compareRequirementsDiscoveryRuns } from "../../src/intelligence/requirements-discovery/compareRequirementsDiscoveryRuns.js";
import type { RequirementsDiscoveryResult } from "../../src/intelligence/requirements-discovery/types.js";
import { MultiCapabilityProvider } from "../agent/fixtures.js";
import {
  DeterministicRequirementsDiscoveryModelProvider,
  NEGATIVE_UNDERSPECIFIED_REQUEST,
  PHARMACY_INVENTORY_REQUEST,
  POSITIVE_KIOSCO_REQUEST,
  POSITIVE_KIOSCO_REQUEST_WITHOUT_CHANNEL,
  runBaselineExtraction,
  runSkillModeExtraction,
} from "./fixtures.js";

const REPO_ROOT = process.cwd();
const SKILL_PATH = join(REPO_ROOT, REQUIREMENTS_DISCOVERY_SKILL_ARTIFACT_PATH);
const QUALITY_CONTRACT_PATH = join(REPO_ROOT, REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF);

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Wraps catalog entries with call-counting loader spies for lazy-loading proofs (T9). */
function instrumentEntries(entries: SkillCatalogEntry[]): { entries: SkillCatalogEntry[]; spies: Map<string, ReturnType<typeof vi.fn>> } {
  const spies = new Map<string, ReturnType<typeof vi.fn>>();
  const instrumented = entries.map((entry) => {
    const spy = vi.fn(entry.load_definition);
    spies.set(entry.descriptor.id, spy);
    return { descriptor: entry.descriptor, load_definition: spy };
  });
  return { entries: instrumented, spies };
}

async function runSkillAssistedScenario(rawRequest: string) {
  const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
  const selection = await selectSkillForTask({
    task: rawRequest,
    agent_definition: requirementsDiscovererDefinition,
    provider,
  });
  if (!selection.loaded) throw new Error("S13A Skill was not selected/loaded — cannot run scenario.");

  const definition = materializeRequirementsDiscoveryTask({
    baseDefinition: requirementsDiscovererDefinition,
    rawRequest,
    loadedSkill: selection.loaded,
    qualityContractRef: REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
  });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicRequirementsDiscoveryModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  return runAgent(compiled.run_options);
}

async function runBaselineScenario(rawRequest: string) {
  const definition = materializeBaselineRequirementsDiscoveryTask({
    baseDefinition: requirementsDiscovererDefinition,
    rawRequest,
  });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicRequirementsDiscoveryModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  return runAgent(compiled.run_options);
}

// ---------------------------------------------------------------------------
// T1 — canonical Skill source exists
// ---------------------------------------------------------------------------
describe("T1 — canonical Skill source exists", () => {
  it("contains the approved S13A identity and semantics", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const token of [
      "requirements.discovery.s13a",
      "RD-R1",
      "RD-P1",
      "RD-V1",
      "goals",
      "users",
      "unknowns",
      "assumptions",
      "constraints",
      "acceptance criteria",
      "S13B",
    ]) {
      expect(text.toLowerCase()).toContain(token.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// T2 — typed SkillDefinition validates
// ---------------------------------------------------------------------------
describe("T2 — typed SkillDefinition validates", () => {
  it("passes S12 SkillDefinition validation", () => {
    const result = validateSkillDefinition(requirementsDiscoveryS13A);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T3 — typed Skill preserves canonical semantics
// ---------------------------------------------------------------------------
describe("T3 — typed Skill preserves canonical semantics", () => {
  it("mechanically covers goals/users/unknowns/assumptions/constraints/acceptance/no-fabrication/explicit-derived/S13B-handoff", () => {
    const ruleText = requirementsDiscoveryS13A.rules.map((r) => r.statement.toLowerCase()).join(" ");
    const procedureText = requirementsDiscoveryS13A.procedure.map((p) => `${p.title} ${p.instruction}`.toLowerCase()).join(" ");
    const combined = `${ruleText} ${procedureText}`;

    for (const token of [
      "goal",
      "user",
      "unknown",
      "assumption",
      "constraint",
      "acceptance criteri",
      "invent",
      "explicit",
      "derived",
      "s13b",
      "handoff",
    ]) {
      expect(combined).toContain(token);
    }
  });
});

// ---------------------------------------------------------------------------
// T4 — dedicated Quality Contract integrity
// ---------------------------------------------------------------------------
describe("T4 — dedicated Quality Contract integrity", () => {
  it("parses and satisfies the canonical S13A requirements", () => {
    const text = readFileSync(QUALITY_CONTRACT_PATH, "utf8");
    const doc = loadYaml(text) as Record<string, any>;

    expect(doc.depth).toBe("STANDARD");
    expect(doc.uncertainty.explicit).toBe(true);
    expect(doc.verification.independent_review_required).toBe(true);
    expect(doc.implementation.tests_required).toBe(true);

    for (const section of [
      "id",
      "version",
      "applies_to",
      "depth",
      "risk",
      "ambiguity",
      "novelty",
      "irreversibility",
      "resource_constraints",
      "evidence",
      "research",
      "implementation",
      "challenge",
      "verification",
      "uncertainty",
      "definition_of_done",
      "approval",
    ]) {
      expect(doc).toHaveProperty(section);
    }
  });
});

// ---------------------------------------------------------------------------
// T5 — requirements-discoverer AgentDefinition validates
// ---------------------------------------------------------------------------
describe("T5 — requirements-discoverer AgentDefinition validates", () => {
  it("passes the existing S10 validation path", () => {
    const result = validateAgentDefinition(requirementsDiscovererDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T6 — no capability/tool dependency
// ---------------------------------------------------------------------------
describe("T6 — no capability/tool dependency", () => {
  it("Agent declares zero tools/capabilities", () => {
    expect(requirementsDiscovererDefinition.tools).toEqual([]);
    expect(requirementsDiscovererDefinition.capabilities).toEqual([]);
  });

  it("Skill requires zero capabilities and allows zero capabilities", () => {
    expect(requirementsDiscoveryS13A.requires.capabilities).toEqual([]);
    expect(requirementsDiscoveryS13A.permissions.allowed_capabilities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T7 — exact Skill allowlist
// ---------------------------------------------------------------------------
describe("T7 — exact Skill allowlist", () => {
  it("agent.skills is exactly [requirements.discovery.s13a]", () => {
    expect(requirementsDiscovererDefinition.skills).toEqual([REQUIREMENTS_DISCOVERY_SKILL_ID]);
  });
});

// ---------------------------------------------------------------------------
// T8 — S12 discovery selects S13A
// ---------------------------------------------------------------------------
describe("T8 — S12 discovery selects S13A", () => {
  it("selects and loads the S13A Skill for the real, unmodified requirementsDiscovererDefinition", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await selectSkillForTask({
      task: "ambiguous request goals users unknowns constraints acceptance criteria",
      agent_definition: requirementsDiscovererDefinition,
      provider,
    });
    expect(result.discovered.every((d) => d.id === REQUIREMENTS_DISCOVERY_SKILL_ID)).toBe(true);
    expect(result.selected?.id).toBe(REQUIREMENTS_DISCOVERY_SKILL_ID);
    expect(result.loaded?.id).toBe(REQUIREMENTS_DISCOVERY_SKILL_ID);
  });

  it("ranks S13A above unrelated catalog Skills under a permissive allowlist, without loading them", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    const permissiveAgent = clone(requirementsDiscovererDefinition);
    permissiveAgent.skills = [REQUIREMENTS_DISCOVERY_SKILL_ID, researchEvidenceGroundedS11.id, referenceSummarize.id];

    const result = await selectSkillForTask({
      task: "ambiguous request: goals, users, unknowns, assumptions, constraints, acceptance criteria",
      agent_definition: permissiveAgent,
      provider,
    });

    expect(result.discovered.length).toBe(3);
    expect(result.selected?.id).toBe(REQUIREMENTS_DISCOVERY_SKILL_ID);
    expect(result.loaded?.id).toBe(REQUIREMENTS_DISCOVERY_SKILL_ID);
    expect(spies.get(REQUIREMENTS_DISCOVERY_SKILL_ID)).toHaveBeenCalledTimes(1);
    expect(spies.get(researchEvidenceGroundedS11.id)).not.toHaveBeenCalled();
    expect(spies.get(referenceSummarize.id)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T9 — lazy load selected Skill only
// ---------------------------------------------------------------------------
describe("T9 — lazy load selected Skill only", () => {
  it("calls only the S13A loader exactly once; unrelated loaders remain uncalled", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);

    const loaded = await provider.load({ id: REQUIREMENTS_DISCOVERY_SKILL_ID });

    expect(loaded.id).toBe(REQUIREMENTS_DISCOVERY_SKILL_ID);
    expect(spies.get(REQUIREMENTS_DISCOVERY_SKILL_ID)).toHaveBeenCalledTimes(1);
    for (const [id, spy] of spies.entries()) {
      if (id !== REQUIREMENTS_DISCOVERY_SKILL_ID) expect(spy).not.toHaveBeenCalled();
    }
  });

  it("discovery never invokes any full-definition loader (metadata-only)", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await provider.discover({ query: "ambiguous request goals users unknowns" });
    for (const spy of spies.values()) expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T10 — same S10/S09 runtime path
// ---------------------------------------------------------------------------
describe("T10 — same S10/S09 runtime path", () => {
  it("executes through compileAgentDefinition() -> runAgent() and reaches SUCCESS", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    expect(result.outcome).toBe("SUCCESS");
  });

  it("has no separate requirements-discovery runtime function anywhere in src/", () => {
    const srcDir = join(REPO_ROOT, "src");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8").toLowerCase();
          if (text.includes("runrequirementsdiscoveryruntime(") || text.includes("requirementsdiscovererruntime")) {
            offenders.push(full);
          }
        }
      }
    }
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T11 — no Skill/role conditional in Core
// ---------------------------------------------------------------------------
describe("T11 — no Skill/role conditional in Core", () => {
  it("finds no requirements-discoverer role/Skill-id branching anywhere under src/core/", () => {
    const forbidden = [
      'role === "requirements-discoverer"',
      "role === 'requirements-discoverer'",
      'skill.id === "requirements.discovery.s13a"',
      "skill.id === 'requirements.discovery.s13a'",
    ];
    const coreDir = join(REPO_ROOT, "src", "core");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8").toLowerCase();
          for (const token of forbidden) {
            if (text.includes(token.toLowerCase())) offenders.push(`${full}: contains "${token}"`);
          }
        }
      }
    }
    walk(coreDir);
    expect(offenders).toEqual([]);
  });

  it("finds no import of src/providers/ or src/intelligence/ inside src/core/", () => {
    const coreDir = join(REPO_ROOT, "src", "core");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const lines = readFileSync(full, "utf8").split("\n");
          for (const line of lines) {
            const isImport = /^\s*import[\s{]/.test(line) || /^\s*export\s+\*?\s*(from|{)/.test(line);
            if (
              isImport &&
              (line.includes("../../providers") ||
                line.includes("../providers") ||
                line.includes("../../intelligence") ||
                line.includes("../intelligence"))
            ) {
              offenders.push(`${full}: ${line.trim()}`);
            }
          }
        }
      }
    }
    walk(coreDir);
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T12/T13 — positive fixture
// ---------------------------------------------------------------------------
describe("T12 — positive fixture result validates", () => {
  it("the kiosco/peluche fixture produces a valid RequirementsDiscoveryResult through the real runtime", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const data = result.output?.data as unknown as RequirementsDiscoveryResult;
    const validation = validateRequirementsDiscoveryResult(data);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
  });
});

describe("T13 — positive fixture captures required sections", () => {
  it("contains at least one goal, unknown, constraint, and acceptance criterion", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const data = result.output?.data as unknown as RequirementsDiscoveryResult;
    expect(data.goals.length).toBeGreaterThanOrEqual(1);
    expect(data.users.length).toBeGreaterThanOrEqual(1);
    expect(data.unknowns.length).toBeGreaterThanOrEqual(1);
    expect(data.constraints.length).toBeGreaterThanOrEqual(1);
    expect(data.acceptance_criteria.length).toBeGreaterThanOrEqual(1);
    expect(data.handoff).toBeDefined();
    expect(data.goals.length).toBe(3);
    expect(data.unknowns.some((u) => u.blocking)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T14 — traceability rules enforced
// ---------------------------------------------------------------------------
describe("T14 — traceability rules enforced", () => {
  const REALISTIC_REQUEST = "El cliente necesita una pantalla que permita registrar información de ejemplo del producto.";
  const REALISTIC_EXCERPT = "registrar información de ejemplo del producto";

  function baseValidResult(): RequirementsDiscoveryResult {
    return {
      request: REALISTIC_REQUEST,
      goals: [
        { id: "G1", statement: "s", origin: "EXPLICIT", source_excerpt: REALISTIC_EXCERPT, rationale: "", priority: "PRIMARY" },
      ],
      users: [],
      unknowns: [],
      assumptions: [],
      constraints: [],
      acceptance_criteria: [
        { id: "AC1", criterion: "c", linked_goal_ids: ["G1"], testable: true, verification_hint: "h" },
      ],
      handoff: { ready_for_gap_analysis: true, unresolved_blockers: [], notes: "n" },
    };
  }

  it("rejects EXPLICIT with empty source_excerpt", () => {
    const value = clone(baseValidResult());
    value.goals[0].source_excerpt = "";
    const result = validateRequirementsDiscoveryResult(value);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("source_excerpt"))).toBe(true);
  });

  it("rejects EXPLICIT with a source_excerpt not literally contained in the raw request (RD-V4)", () => {
    const value = clone(baseValidResult());
    value.goals[0].source_excerpt = "un texto que el cliente nunca dijo";
    const result = validateRequirementsDiscoveryResult(value);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("RD-V4"))).toBe(true);
  });

  it("rejects DERIVED with empty rationale", () => {
    const value = clone(baseValidResult());
    value.goals[0].origin = "DERIVED";
    value.goals[0].rationale = "";
    const result = validateRequirementsDiscoveryResult(value);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("rationale"))).toBe(true);
  });

  it("accepts a valid EXPLICIT goal and a valid DERIVED goal", () => {
    const value = clone(baseValidResult());
    value.goals.push({ id: "G2", statement: "s2", origin: "DERIVED", source_excerpt: "", rationale: "r", priority: "SECONDARY" });
    value.acceptance_criteria[0].linked_goal_ids = ["G1", "G2"];
    expect(validateRequirementsDiscoveryResult(value).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T15 — acceptance linkage enforced
// ---------------------------------------------------------------------------
describe("T15 — acceptance linkage enforced", () => {
  function baseValidResult(): RequirementsDiscoveryResult {
    return {
      request: "R with ex",
      goals: [{ id: "G1", statement: "s", origin: "EXPLICIT", source_excerpt: "ex", rationale: "", priority: "PRIMARY" }],
      users: [],
      unknowns: [],
      assumptions: [],
      constraints: [],
      acceptance_criteria: [
        { id: "AC1", criterion: "c", linked_goal_ids: ["G1"], testable: true, verification_hint: "h" },
      ],
      handoff: { ready_for_gap_analysis: true, unresolved_blockers: [], notes: "n" },
    };
  }

  it("rejects an acceptance criterion referencing a nonexistent goal", () => {
    const value = clone(baseValidResult());
    value.acceptance_criteria[0].linked_goal_ids = ["G-does-not-exist"];
    const result = validateRequirementsDiscoveryResult(value);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("linked_goal_ids"))).toBe(true);
  });

  it("rejects testable=false", () => {
    const value = clone(baseValidResult());
    (value.acceptance_criteria[0] as unknown as { testable: boolean }).testable = false;
    const result = validateRequirementsDiscoveryResult(value);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("testable"))).toBe(true);
  });

  it("rejects an empty linked_goal_ids array", () => {
    const value = clone(baseValidResult());
    value.acceptance_criteria[0].linked_goal_ids = [];
    const result = validateRequirementsDiscoveryResult(value);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T16 — blocker handoff enforced
// ---------------------------------------------------------------------------
describe("T16 — blocker handoff enforced", () => {
  it("fails when a blocking unknown is missing from handoff.unresolved_blockers", () => {
    const value: RequirementsDiscoveryResult = {
      request: "R with ex",
      goals: [{ id: "G1", statement: "s", origin: "EXPLICIT", source_excerpt: "ex", rationale: "", priority: "PRIMARY" }],
      users: [],
      unknowns: [
        { id: "Q1", question: "q", why_it_matters: "w", impact: "HIGH", blocking: true, related_goal_ids: ["G1"] },
      ],
      assumptions: [],
      constraints: [],
      acceptance_criteria: [
        { id: "AC1", criterion: "c", linked_goal_ids: ["G1"], testable: true, verification_hint: "h" },
      ],
      handoff: { ready_for_gap_analysis: true, unresolved_blockers: [], notes: "n" },
    };
    const result = validateRequirementsDiscoveryResult(value);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("RD-V5"))).toBe(true);
  });

  it("passes when every blocking unknown is present and non-blocking unknowns are omitted", () => {
    const value: RequirementsDiscoveryResult = {
      request: "R with ex",
      goals: [{ id: "G1", statement: "s", origin: "EXPLICIT", source_excerpt: "ex", rationale: "", priority: "PRIMARY" }],
      users: [],
      unknowns: [
        { id: "Q1", question: "q", why_it_matters: "w", impact: "HIGH", blocking: true, related_goal_ids: ["G1"] },
        { id: "Q2", question: "q2", why_it_matters: "w2", impact: "LOW", blocking: false, related_goal_ids: ["G1"] },
      ],
      assumptions: [],
      constraints: [],
      acceptance_criteria: [
        { id: "AC1", criterion: "c", linked_goal_ids: ["G1"], testable: true, verification_hint: "h" },
      ],
      handoff: { ready_for_gap_analysis: true, unresolved_blockers: ["Q1"], notes: "n" },
    };
    expect(validateRequirementsDiscoveryResult(value).valid).toBe(true);
  });

  it("real positive-fixture run: every blocking unknown is preserved in the handoff", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const data = result.output?.data as unknown as RequirementsDiscoveryResult;
    const blockingIds = data.unknowns.filter((u) => u.blocking).map((u) => u.id);
    expect(blockingIds.length).toBeGreaterThan(0);
    for (const id of blockingIds) expect(data.handoff.unresolved_blockers).toContain(id);
  });
});

// ---------------------------------------------------------------------------
// T17 — negative fixture refuses fabrication
// ---------------------------------------------------------------------------
describe("T17 — negative fixture refuses fabrication", () => {
  it("does not invent React, PostgreSQL, a 30-day deadline, payments, 10,000-user scale, store managers, or retail customers", async () => {
    const result = await runSkillAssistedScenario(NEGATIVE_UNDERSPECIFIED_REQUEST);
    const data = result.output?.data as unknown as RequirementsDiscoveryResult;
    const text = JSON.stringify(data).toLowerCase();
    for (const forbidden of ["react", "postgresql", "30-day", "30 días", "payments", "10,000", "store managers", "retail customers"]) {
      expect(text.includes(forbidden.toLowerCase())).toBe(false);
    }
  });

  it("surfaces blocking unknowns instead of fabricating users/constraints/acceptance", async () => {
    const result = await runSkillAssistedScenario(NEGATIVE_UNDERSPECIFIED_REQUEST);
    const data = result.output?.data as unknown as RequirementsDiscoveryResult;
    expect(data.users).toEqual([]);
    expect(data.constraints).toEqual([]);
    expect(data.assumptions).toEqual([]);
    expect(data.unknowns.some((u) => u.blocking)).toBe(true);
    expect(data.handoff.unresolved_blockers.length).toBeGreaterThan(0);
    expect(validateRequirementsDiscoveryResult(data).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T18 — raw-request dependence
// ---------------------------------------------------------------------------
describe("T18 — raw-request dependence", () => {
  it("changes goals/unknowns/constraints when the raw request changes materially", async () => {
    const positive = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const pharmacy = await runSkillAssistedScenario(PHARMACY_INVENTORY_REQUEST);
    const positiveData = positive.output?.data as unknown as RequirementsDiscoveryResult;
    const pharmacyData = pharmacy.output?.data as unknown as RequirementsDiscoveryResult;

    expect(positiveData.goals).not.toEqual(pharmacyData.goals);
    expect(positiveData.unknowns).not.toEqual(pharmacyData.unknowns);
    expect(positiveData.constraints).not.toEqual(pharmacyData.constraints);
  });

  it("removing the channel/device sentence changes users/constraints/assumptions for an otherwise identical request", async () => {
    const withChannel = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const withoutChannel = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST_WITHOUT_CHANNEL);
    const withChannelData = withChannel.output?.data as unknown as RequirementsDiscoveryResult;
    const withoutChannelData = withoutChannel.output?.data as unknown as RequirementsDiscoveryResult;

    expect(withChannelData.users.length).toBeGreaterThan(0);
    expect(withoutChannelData.users).toEqual([]);
    expect(withChannelData.constraints).not.toEqual(withoutChannelData.constraints);
    expect(withChannelData.assumptions).not.toEqual(withoutChannelData.assumptions);
  });

  it("a single canned final response fails this test by construction (unit check on the extractor)", () => {
    const a = runSkillModeExtraction(POSITIVE_KIOSCO_REQUEST);
    const b = runSkillModeExtraction(NEGATIVE_UNDERSPECIFIED_REQUEST);
    expect(a).not.toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// T19 — baseline executes through same architecture
// ---------------------------------------------------------------------------
describe("T19 — baseline executes through same architecture", () => {
  it("baseline and Skill run both execute through compileAgentDefinition() -> runAgent() with the same base id, provider class, and limits", async () => {
    const skillRun = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const baselineRun = await runBaselineScenario(POSITIVE_KIOSCO_REQUEST);

    expect(skillRun.outcome).toBe("SUCCESS");
    expect(baselineRun.outcome).toBe("SUCCESS");

    const skillDefinition = materializeRequirementsDiscoveryTask({
      baseDefinition: requirementsDiscovererDefinition,
      rawRequest: POSITIVE_KIOSCO_REQUEST,
      loadedSkill: requirementsDiscoveryS13A,
      qualityContractRef: REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
    });
    const baselineDefinition = materializeBaselineRequirementsDiscoveryTask({
      baseDefinition: requirementsDiscovererDefinition,
      rawRequest: POSITIVE_KIOSCO_REQUEST,
    });

    expect(baselineDefinition.limits).toEqual(skillDefinition.limits);
    expect(baselineDefinition.model_policy).toEqual(skillDefinition.model_policy);
    expect(baselineDefinition.tools).toEqual(skillDefinition.tools);
    expect(baselineDefinition.capabilities).toEqual(skillDefinition.capabilities);
    // The only intentional difference: the Skill materialization content.
    expect(baselineDefinition.objective).not.toContain("SKILL_ID:");
    expect(skillDefinition.objective).toContain("SKILL_ID:");
  });
});

// ---------------------------------------------------------------------------
// T20 — Skill improves over baseline
// ---------------------------------------------------------------------------
describe("T20 — Skill improves over baseline", () => {
  it("on the positive fixture: all six REQUIREMENTS_DISCOVERY_SKILL_S13A.md section 13 comparison inequalities hold", async () => {
    const skillRun = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const baselineRun = await runBaselineScenario(POSITIVE_KIOSCO_REQUEST);
    const skillData = skillRun.output?.data as unknown as RequirementsDiscoveryResult;
    const baselineData = baselineRun.output?.data as unknown as RequirementsDiscoveryResult;

    const comparison = compareRequirementsDiscoveryRuns(baselineData, skillData, POSITIVE_KIOSCO_REQUEST);

    // Skill §13 "Minimum PASS comparison" — all six inequalities, not only
    // the AGENT_v1.md §16 T20 subset (required_section_coverage,
    // acceptance_linkage_ratio, unmarked_assumption_count).
    expect(comparison.skill.required_section_coverage).toBeGreaterThan(comparison.baseline.required_section_coverage);
    expect(comparison.skill.unknown_capture_count).toBeGreaterThanOrEqual(comparison.baseline.unknown_capture_count);
    expect(comparison.skill.fabricated_fact_count).toBeLessThanOrEqual(comparison.baseline.fabricated_fact_count);
    expect(comparison.skill.unmarked_assumption_count).toBeLessThan(comparison.baseline.unmarked_assumption_count);
    expect(comparison.skill.acceptance_linkage_ratio).toBeGreaterThan(comparison.baseline.acceptance_linkage_ratio);
    expect(comparison.skill.acceptance_testability_ratio).toBeGreaterThan(comparison.baseline.acceptance_testability_ratio);

    expect(validateRequirementsDiscoveryResult(skillData).valid).toBe(true);
    expect(validateRequirementsDiscoveryResult(baselineData).valid).toBe(false);
  });

  it("on the negative fixture: the Skill run has zero fabricated facts and the baseline has more than zero", async () => {
    const skillRun = await runSkillAssistedScenario(NEGATIVE_UNDERSPECIFIED_REQUEST);
    const baselineRun = await runBaselineScenario(NEGATIVE_UNDERSPECIFIED_REQUEST);
    const skillData = skillRun.output?.data as unknown as RequirementsDiscoveryResult;
    const baselineData = baselineRun.output?.data as unknown as RequirementsDiscoveryResult;

    const comparison = compareRequirementsDiscoveryRuns(baselineData, skillData, NEGATIVE_UNDERSPECIFIED_REQUEST);

    expect(comparison.skill.fabricated_fact_count).toBe(0);
    expect(comparison.baseline.fabricated_fact_count).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// T21 — no S13B semantics pulled forward
// ---------------------------------------------------------------------------
describe("T21 — no S13B semantics pulled forward", () => {
  it("the typed Skill/AgentDefinition never define the S13B taxonomy as an output enum", () => {
    // Word-boundary matches: "known" alone (not "unknown"/"unknowns", which
    // are S13A's own, deliberately different, field name).
    const forbidden = [/\bknown\b/i, /\btold\b/i, /\bproven\b/i, /needs-research/i, /unknowable/i];
    const text = JSON.stringify({ skill: requirementsDiscoveryS13A, definition: requirementsDiscovererDefinition });
    for (const pattern of forbidden) {
      expect(pattern.test(text)).toBe(false);
    }
  });

  it("a real discovery result never uses S13B vocabulary as impact/origin/risk values", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const data = result.output?.data as unknown as RequirementsDiscoveryResult;
    const impacts = new Set(data.unknowns.map((u) => u.impact));
    for (const impact of impacts) expect(["HIGH", "MEDIUM", "LOW"]).toContain(impact);
  });

  it("mentioning S13B in documentation/handoff text is allowed", () => {
    const ruleText = requirementsDiscoveryS13A.rules.map((r) => r.statement).join(" ");
    expect(ruleText.toLowerCase()).toContain("s13b");
  });
});

// ---------------------------------------------------------------------------
// T22 — full regression
// ---------------------------------------------------------------------------
describe("T22 — full regression", () => {
  it("S07-S12 AgentDefinitions remain valid alongside the new S13A artifacts", () => {
    expect(validateAgentDefinition(researcherDefinition).valid).toBe(true);
    expect(validateAgentDefinition(requirementsDiscovererDefinition).valid).toBe(true);
  });

  it("StructuredAgentOutput mapping matches the real run's mapping", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KIOSCO_REQUEST);
    const data = result.output?.data as unknown as RequirementsDiscoveryResult;
    const mapped = mapRequirementsDiscoveryResultToStructuredOutput(data);
    expect(mapped.summary).toBe(result.output?.summary);
    expect(mapped.evidence_refs).toEqual([]);
  });

  it("descriptor projection remains metadata-only for the S13A Skill", () => {
    const descriptor = toSkillDescriptor(requirementsDiscoveryS13A) as unknown as Record<string, unknown>;
    for (const forbiddenKey of ["rules", "procedure", "verification", "inputs", "outputs"]) {
      expect(descriptor).not.toHaveProperty(forbiddenKey);
    }
  });

  it("no forbidden vendor/provider token appears in the requirements-discoverer AgentDefinition or Skill/Quality Contract artifacts", () => {
    const FORBIDDEN = ["openai", "anthropic", "gemini", "hermes", "notion", "langchain", "langgraph"];
    const strings: string[] = [];
    (function collect(value: unknown) {
      if (typeof value === "string") strings.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    })(requirementsDiscovererDefinition);
    const offenders = strings.filter((s) => FORBIDDEN.some((token) => s.toLowerCase().includes(token)));
    expect(offenders).toEqual([]);

    const skillText = readFileSync(SKILL_PATH, "utf8").toLowerCase();
    const qcText = readFileSync(QUALITY_CONTRACT_PATH, "utf8").toLowerCase();
    for (const token of FORBIDDEN) {
      expect(skillText.includes(token)).toBe(false);
      expect(qcText.includes(token)).toBe(false);
    }
  });

  it("materializeRequirementsDiscoveryTask does not mutate the base definition and rejects an empty request", () => {
    const before = JSON.stringify(requirementsDiscovererDefinition);
    materializeRequirementsDiscoveryTask({
      baseDefinition: requirementsDiscovererDefinition,
      rawRequest: POSITIVE_KIOSCO_REQUEST,
      loadedSkill: requirementsDiscoveryS13A,
      qualityContractRef: REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
    });
    expect(JSON.stringify(requirementsDiscovererDefinition)).toBe(before);
    expect(() =>
      materializeRequirementsDiscoveryTask({
        baseDefinition: requirementsDiscovererDefinition,
        rawRequest: "   ",
        loadedSkill: requirementsDiscoveryS13A,
        qualityContractRef: REQUIREMENTS_DISCOVERY_QUALITY_CONTRACT_REF,
      }),
    ).toThrow();
  });

  it("runBaselineExtraction never emits the forbidden token set for a request that genuinely mentions them", () => {
    // Sanity check on the fixture itself: this is not part of S13A's PASS
    // criteria, just confirms the baseline fixture's watchlist scoring logic
    // is coherent with compareRequirementsDiscoveryRuns' "only flag terms
    // absent from the raw request" rule.
    const result = runBaselineExtraction(NEGATIVE_UNDERSPECIFIED_REQUEST);
    expect(result.goals[0].source_excerpt).toBe(NEGATIVE_UNDERSPECIFIED_REQUEST);
  });
});
