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
  knowledgeGapAnalysisS13B,
  requirementsDiscoveryS13A,
  referenceSummarize,
  selectSkillForTask,
} from "../../src/intelligence/skills/index.js";
import { knowledgeGapAnalyzerDefinition } from "../../src/intelligence/agent-definitions/knowledgeGapAnalyzerDefinition.js";
import { requirementsDiscovererDefinition } from "../../src/intelligence/agent-definitions/requirementsDiscovererDefinition.js";
import {
  KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
  KNOWLEDGE_GAP_ANALYSIS_SKILL_ARTIFACT_PATH,
  KNOWLEDGE_GAP_ANALYSIS_SKILL_ID,
} from "../../src/intelligence/knowledge-gap-analysis/knowledgeGapAnalysisSkill.js";
import {
  materializeBaselineKnowledgeGapAnalysisTask,
  materializeKnowledgeGapAnalysisTask,
} from "../../src/intelligence/knowledge-gap-analysis/materializeKnowledgeGapAnalysisTask.js";
import {
  mapKnowledgeGapAnalysisResultToStructuredOutput,
  validateKnowledgeGapAnalysisResult,
} from "../../src/intelligence/knowledge-gap-analysis/validateKnowledgeGapAnalysisResult.js";
import { compareKnowledgeGapAnalysisRuns } from "../../src/intelligence/knowledge-gap-analysis/compareKnowledgeGapAnalysisRuns.js";
import type { KnowledgeGapAnalysisResult } from "../../src/intelligence/knowledge-gap-analysis/types.js";
import { MultiCapabilityProvider } from "../agent/fixtures.js";
import {
  DeterministicKnowledgeGapAnalysisModelProvider,
  NEGATIVE_KGA_INPUT,
  POSITIVE_KGA_INPUT,
  POSITIVE_KGA_INPUT_WITHOUT_UNDECIDED_OPERATOR_FACT,
  runBaselineClassification,
  runSkillModeClassification,
} from "./fixtures.js";

const REPO_ROOT = process.cwd();
const SKILL_PATH = join(REPO_ROOT, KNOWLEDGE_GAP_ANALYSIS_SKILL_ARTIFACT_PATH);
const QUALITY_CONTRACT_PATH = join(REPO_ROOT, KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF);

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

async function runSkillAssistedScenario(input: typeof POSITIVE_KGA_INPUT) {
  const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
  const selection = await selectSkillForTask({
    task: "knowledge gap analysis known told proven assumed needs research unknowable",
    agent_definition: knowledgeGapAnalyzerDefinition,
    provider,
  });
  if (!selection.loaded) throw new Error("S13B Skill was not selected/loaded — cannot run scenario.");

  const definition = materializeKnowledgeGapAnalysisTask({
    baseDefinition: knowledgeGapAnalyzerDefinition,
    input,
    loadedSkill: selection.loaded,
    qualityContractRef: KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
  });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicKnowledgeGapAnalysisModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  return runAgent(compiled.run_options);
}

async function runBaselineScenario(input: typeof POSITIVE_KGA_INPUT) {
  const definition = materializeBaselineKnowledgeGapAnalysisTask({ baseDefinition: knowledgeGapAnalyzerDefinition, input });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicKnowledgeGapAnalysisModelProvider(),
    capability_provider: new MultiCapabilityProvider([]),
  });
  return runAgent(compiled.run_options);
}

// ---------------------------------------------------------------------------
// T1 — canonical Skill source exists
// ---------------------------------------------------------------------------
describe("T1 — canonical Skill source exists", () => {
  it("contains the approved six-way taxonomy and orthogonal S04 semantics", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const token of [
      "knowledge-gap.analysis.s13b",
      "KGA-R1",
      "KGA-P1",
      "KGA-V1",
      "KNOWN",
      "TOLD",
      "PROVEN",
      "ASSUMED",
      "NEEDS_RESEARCH",
      "UNKNOWABLE",
      "decision impact",
      "closure",
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
    const result = validateSkillDefinition(knowledgeGapAnalysisS13B);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T3 — typed Skill preserves canonical semantics
// ---------------------------------------------------------------------------
describe("T3 — typed Skill preserves canonical semantics", () => {
  it("mechanically covers the six-way taxonomy, impact/closure axes, no-capability, and the S13C handoff", () => {
    const ruleText = knowledgeGapAnalysisS13B.rules.map((r) => r.statement).join(" ");
    const procedureText = knowledgeGapAnalysisS13B.procedure.map((p) => `${p.title} ${p.instruction}`).join(" ");
    const combined = `${ruleText} ${procedureText}`;

    for (const token of ["KNOWN", "TOLD", "PROVEN", "ASSUMED", "NEEDS_RESEARCH", "UNKNOWABLE", "decision impact", "closure_state", "S13C"]) {
      expect(combined).toContain(token);
    }
    expect(knowledgeGapAnalysisS13B.requires.capabilities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T4 — Quality Contract integrity
// ---------------------------------------------------------------------------
describe("T4 — Quality Contract integrity", () => {
  it("parses and satisfies the canonical S13B requirements", () => {
    const text = readFileSync(QUALITY_CONTRACT_PATH, "utf8");
    const doc = loadYaml(text) as Record<string, any>;

    expect(doc.depth).toBe("STANDARD");
    expect(doc.research.knowledge_gaps_required).toBe(true);
    expect(doc.uncertainty.explicit).toBe(true);
    expect(doc.implementation.deterministic_checks_required).toBe(true);
    expect(doc.verification.independent_review_required).toBe(true);

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
// T5 — knowledge-gap-analyzer AgentDefinition validates
// ---------------------------------------------------------------------------
describe("T5 — knowledge-gap-analyzer AgentDefinition validates", () => {
  it("passes the existing S10 validation path", () => {
    const result = validateAgentDefinition(knowledgeGapAnalyzerDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T6 — no capability/tool dependency
// ---------------------------------------------------------------------------
describe("T6 — no capability/tool dependency", () => {
  it("Agent declares zero tools/capabilities", () => {
    expect(knowledgeGapAnalyzerDefinition.tools).toEqual([]);
    expect(knowledgeGapAnalyzerDefinition.capabilities).toEqual([]);
  });

  it("Skill requires zero capabilities and allows zero capabilities", () => {
    expect(knowledgeGapAnalysisS13B.requires.capabilities).toEqual([]);
    expect(knowledgeGapAnalysisS13B.permissions.allowed_capabilities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T7 — exact Skill allowlist
// ---------------------------------------------------------------------------
describe("T7 — exact Skill allowlist", () => {
  it("agent.skills is exactly [knowledge-gap.analysis.s13b]", () => {
    expect(knowledgeGapAnalyzerDefinition.skills).toEqual([KNOWLEDGE_GAP_ANALYSIS_SKILL_ID]);
  });
});

// ---------------------------------------------------------------------------
// T8 — S12 discovery selects S13B
// ---------------------------------------------------------------------------
describe("T8 — S12 discovery selects S13B", () => {
  it("selects and loads the S13B Skill for the real, unmodified knowledgeGapAnalyzerDefinition", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await selectSkillForTask({
      task: "classify known told proven assumed needs research unknowable knowledge gaps",
      agent_definition: knowledgeGapAnalyzerDefinition,
      provider,
    });
    expect(result.discovered.every((d) => d.id === KNOWLEDGE_GAP_ANALYSIS_SKILL_ID)).toBe(true);
    expect(result.selected?.id).toBe(KNOWLEDGE_GAP_ANALYSIS_SKILL_ID);
    expect(result.loaded?.id).toBe(KNOWLEDGE_GAP_ANALYSIS_SKILL_ID);
  });

  it("ranks S13B above unrelated catalog Skills under a permissive allowlist, without loading them", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    const permissiveAgent = clone(knowledgeGapAnalyzerDefinition);
    permissiveAgent.skills = [KNOWLEDGE_GAP_ANALYSIS_SKILL_ID, requirementsDiscoveryS13A.id, referenceSummarize.id];

    const result = await selectSkillForTask({
      task: "classify known told proven assumed needs research unknowable knowledge gaps",
      agent_definition: permissiveAgent,
      provider,
    });

    expect(result.discovered.length).toBe(3);
    expect(result.selected?.id).toBe(KNOWLEDGE_GAP_ANALYSIS_SKILL_ID);
    expect(result.loaded?.id).toBe(KNOWLEDGE_GAP_ANALYSIS_SKILL_ID);
    expect(spies.get(KNOWLEDGE_GAP_ANALYSIS_SKILL_ID)).toHaveBeenCalledTimes(1);
    expect(spies.get(requirementsDiscoveryS13A.id)).not.toHaveBeenCalled();
    expect(spies.get(referenceSummarize.id)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T9 — lazy selected load only
// ---------------------------------------------------------------------------
describe("T9 — lazy selected load only", () => {
  it("calls only the S13B loader exactly once; unrelated loaders remain uncalled", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);

    const loaded = await provider.load({ id: KNOWLEDGE_GAP_ANALYSIS_SKILL_ID });

    expect(loaded.id).toBe(KNOWLEDGE_GAP_ANALYSIS_SKILL_ID);
    expect(spies.get(KNOWLEDGE_GAP_ANALYSIS_SKILL_ID)).toHaveBeenCalledTimes(1);
    for (const [id, spy] of spies.entries()) {
      if (id !== KNOWLEDGE_GAP_ANALYSIS_SKILL_ID) expect(spy).not.toHaveBeenCalled();
    }
  });

  it("discovery never invokes any full-definition loader (metadata-only)", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await provider.discover({ query: "knowledge gap analysis known told proven" });
    for (const spy of spies.values()) expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T10 — same S10/S09 runtime path
// ---------------------------------------------------------------------------
describe("T10 — same S10/S09 runtime path", () => {
  it("executes through compileAgentDefinition() -> runAgent() and reaches SUCCESS", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    expect(result.outcome).toBe("SUCCESS");
  });

  it("has no separate knowledge-gap-analysis runtime function anywhere in src/", () => {
    const srcDir = join(REPO_ROOT, "src");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8").toLowerCase();
          if (text.includes("runknowledgegapanalysisruntime(") || text.includes("knowledgegapanalyzerruntime")) {
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
// T11 — no role/Skill conditional in Core
// ---------------------------------------------------------------------------
describe("T11 — no role/Skill conditional in Core", () => {
  it("finds no knowledge-gap-analyzer role/Skill-id branching anywhere under src/core/", () => {
    const forbidden = [
      'role === "knowledge-gap-analyzer"',
      "role === 'knowledge-gap-analyzer'",
      'skill.id === "knowledge-gap.analysis.s13b"',
      "skill.id === 'knowledge-gap.analysis.s13b'",
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
// T12 — full S13A input consumed
// ---------------------------------------------------------------------------
describe("T12 — full S13A input consumed", () => {
  it("positive fixture normalization covers goals/users/unknowns/assumptions/constraints/acceptance_criteria/context_facts", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    const kinds = new Set(data.items.map((i) => i.source_kind));
    for (const kind of ["GOAL", "USER", "UNKNOWN", "ASSUMPTION", "CONSTRAINT", "ACCEPTANCE_CRITERION", "CONTEXT_FACT"]) {
      expect(kinds.has(kind as any)).toBe(true);
    }
    // No duplicated raw-request input was required — the request is carried via source_request only.
    expect(data.source_request).toBe(POSITIVE_KGA_INPUT.requirements_discovery.request);
  });
});

// ---------------------------------------------------------------------------
// T13 — epistemic status partition
// ---------------------------------------------------------------------------
describe("T13 — epistemic status partition", () => {
  it("every item has exactly one valid status and buckets partition all item IDs exactly once", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    const validation = validateKnowledgeGapAnalysisResult(data, POSITIVE_KGA_INPUT.context_facts);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);

    const bucketed = [
      ...data.buckets.known,
      ...data.buckets.told,
      ...data.buckets.proven,
      ...data.buckets.assumed,
      ...data.buckets.needs_research,
      ...data.buckets.unknowable,
    ];
    expect(new Set(bucketed).size).toBe(bucketed.length);
    expect(new Set(bucketed)).toEqual(new Set(data.items.map((i) => i.id)));
  });

  it("the positive fixture satisfies spec section 28's minimum characteristics (guards fixture regressions)", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    expect(data.buckets.known.length).toBeGreaterThanOrEqual(1);
    expect(data.buckets.told.length).toBeGreaterThanOrEqual(1);
    expect(data.buckets.proven.length).toBeGreaterThanOrEqual(1);
    expect(data.buckets.assumed.length).toBeGreaterThanOrEqual(1);
    expect(data.buckets.needs_research.length).toBeGreaterThanOrEqual(2);
    expect(data.buckets.unknowable.length).toBeGreaterThanOrEqual(1);
    expect(
      data.research_queue.some((r) => r.decision_impact === "DECISION_CRITICAL" && r.blocking),
    ).toBe(true);
    expect(data.items.some((i) => i.closure_state !== null)).toBe(true);
    expect(data.items.some((i) => i.closure_state === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T14 — impact axis independent
// ---------------------------------------------------------------------------
describe("T14 — impact axis independent", () => {
  it("every item has valid S04 impact, and two NEEDS_RESEARCH items have different decision impact", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    for (const item of data.items) {
      expect(["DECISION_CRITICAL", "DECISION_RELEVANT", "CONTEXTUAL", "TRIVIA"]).toContain(item.decision_impact);
    }
    const needsResearch = data.items.filter((i) => i.epistemic_status === "NEEDS_RESEARCH");
    const impacts = new Set(needsResearch.map((i) => i.decision_impact));
    expect(impacts.size).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// T15 — PROVEN requires evidence
// ---------------------------------------------------------------------------
describe("T15 — PROVEN requires evidence", () => {
  it("rejects a PROVEN item with zero evidence_refs", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const proven = invalid.items.find((i) => i.epistemic_status === "PROVEN")!;
    proven.evidence_refs = [];
    const result = validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("PROVEN requires evidence_refs"))).toBe(true);
  });

  it("rejects a PROVEN item whose evidence_ref does not resolve to a DIRECT_EVIDENCE context_fact (KGA-R3 resolution)", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const proven = invalid.items.find((i) => i.epistemic_status === "PROVEN")!;
    proven.evidence_refs = ["fabricated-ref-not-in-context-facts"];
    const result = validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("does not resolve to a DIRECT_EVIDENCE"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T16 — KNOWN requires sufficient authority
// ---------------------------------------------------------------------------
describe("T16 — KNOWN requires sufficient authority", () => {
  it("rejects a KNOWN item with authority_sufficient = false", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const known = invalid.items.find((i) => i.epistemic_status === "KNOWN")!;
    known.authority_sufficient = false;
    const result = validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("KNOWN requires authority_sufficient"))).toBe(true);
  });

  it("rejects a KNOWN item whose authority_ref does not resolve to a CANONICAL_AUTHORITY context_fact or the canonical request reference (KGA-R4 resolution)", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const known = invalid.items.find((i) => i.epistemic_status === "KNOWN")!;
    known.authority_refs = ["fabricated-ref-not-in-context-facts"];
    const result = validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("does not resolve to a CANONICAL_AUTHORITY"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T17 — negative fixture keeps TOLD distinct
// ---------------------------------------------------------------------------
describe("T17 — negative fixture keeps TOLD distinct", () => {
  it("the unverified '10,000 active users' assertion is classified TOLD, not PROVEN", async () => {
    const result = await runSkillAssistedScenario(NEGATIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    const assertionItem = data.items.find((i) => i.source_item_ref === "CF1")!;
    expect(assertionItem.epistemic_status).toBe("TOLD");
    expect(assertionItem.epistemic_status).not.toBe("PROVEN");
  });
});

// ---------------------------------------------------------------------------
// T18 — researchable gap becomes NEEDS_RESEARCH
// ---------------------------------------------------------------------------
describe("T18 — researchable gap becomes NEEDS_RESEARCH", () => {
  it("the active-user verification question becomes NEEDS_RESEARCH and appears in research_queue", async () => {
    const result = await runSkillAssistedScenario(NEGATIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    const item = data.items.find((i) => i.source_item_ref === "Q1")!;
    expect(item.epistemic_status).toBe("NEEDS_RESEARCH");
    expect(data.research_queue.map((r) => r.knowledge_item_id)).toContain(item.id);
  });
});

// ---------------------------------------------------------------------------
// T19 — future contingent choice becomes UNKNOWABLE
// ---------------------------------------------------------------------------
describe("T19 — future contingent choice becomes UNKNOWABLE", () => {
  it("the undecided payment-provider choice is UNKNOWABLE and absent from research_queue", async () => {
    const result = await runSkillAssistedScenario(NEGATIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    const item = data.items.find((i) => i.source_item_ref === "Q2")!;
    expect(item.epistemic_status).toBe("UNKNOWABLE");
    expect(data.research_queue.map((r) => r.knowledge_item_id)).not.toContain(item.id);
  });
});

// ---------------------------------------------------------------------------
// T20 — closure-state overclaim rejected
// ---------------------------------------------------------------------------
describe("T20 — closure-state overclaim rejected", () => {
  it("rejects RESOLVED_WITH_EVIDENCE without evidence", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const item = invalid.items.find((i) => i.closure_state === "RESOLVED_WITH_EVIDENCE")!;
    item.evidence_refs = [];
    expect(validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts).valid).toBe(false);
  });

  it("rejects RESOLVED_BY_AUTHORITY without sufficient authority", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const item = invalid.items.find((i) => i.closure_state === "RESOLVED_BY_AUTHORITY")!;
    item.authority_sufficient = false;
    expect(validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts).valid).toBe(false);
  });

  it("rejects NEEDS_RESEARCH marked with a closure state (false resolved state)", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const item = invalid.items.find((i) => i.epistemic_status === "NEEDS_RESEARCH")!;
    item.closure_state = "RESOLVED_WITH_EVIDENCE";
    item.evidence_refs = ["fabricated"];
    const result = validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("false resolved state"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T21 — research queue ordering
// ---------------------------------------------------------------------------
describe("T21 — research queue ordering", () => {
  it("orders DECISION_CRITICAL before DECISION_RELEVANT, then blocking before non-blocking, then id ascending", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    expect(data.research_queue.map((r) => r.knowledge_item_id)).toEqual(["K-Q1", "K-Q2", "K-Q3"]);
    expect(data.research_queue[0].decision_impact).toBe("DECISION_CRITICAL");
    expect(data.research_queue[2].decision_impact).toBe("DECISION_RELEVANT");
  });

  it("rejects a research_queue containing a non-NEEDS_RESEARCH item", () => {
    const positive = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const invalid = clone(positive);
    const knownItem = invalid.items.find((i) => i.epistemic_status === "KNOWN")!;
    invalid.research_queue.push({
      knowledge_item_id: knownItem.id,
      research_question: knownItem.statement,
      decision_impact: knownItem.decision_impact,
      blocking: false,
      why_research_matters: "invalid",
    });
    const result = validateKnowledgeGapAnalysisResult(invalid, POSITIVE_KGA_INPUT.context_facts);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not NEEDS_RESEARCH"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T22 — raw/input dependence
// ---------------------------------------------------------------------------
describe("T22 — raw/input dependence", () => {
  it("changes classifications/research queue when the S13A result changes materially (positive vs negative)", async () => {
    const positive = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const negative = await runSkillAssistedScenario(NEGATIVE_KGA_INPUT);
    const positiveData = positive.output?.data as unknown as KnowledgeGapAnalysisResult;
    const negativeData = negative.output?.data as unknown as KnowledgeGapAnalysisResult;
    expect(positiveData.items).not.toEqual(negativeData.items);
    expect(positiveData.research_queue).not.toEqual(negativeData.research_queue);
  });

  it("removing one context fact changes the corresponding item's classification for an otherwise identical input", async () => {
    const withFact = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const withoutFact = await runSkillAssistedScenario(POSITIVE_KGA_INPUT_WITHOUT_UNDECIDED_OPERATOR_FACT);
    const withData = withFact.output?.data as unknown as KnowledgeGapAnalysisResult;
    const withoutData = withoutFact.output?.data as unknown as KnowledgeGapAnalysisResult;

    const withA1 = withData.items.find((i) => i.source_item_ref === "A1")!;
    const withoutA1 = withoutData.items.find((i) => i.source_item_ref === "A1")!;
    expect(withA1.epistemic_status).toBe("UNKNOWABLE");
    expect(withoutA1.epistemic_status).toBe("ASSUMED");
  });

  it("a single canned final response fails this test by construction (unit check on the classifier)", () => {
    const a = runSkillModeClassification(POSITIVE_KGA_INPUT);
    const b = runSkillModeClassification(NEGATIVE_KGA_INPUT);
    expect(a).not.toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// T23 — Skill improves over baseline
// ---------------------------------------------------------------------------
describe("T23 — Skill improves over baseline", () => {
  it("on the positive fixture: classification_coverage_ratio, unsupported_proven_count, and closure_overclaim_count strictly improve", async () => {
    const skillRun = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const baselineRun = await runBaselineScenario(POSITIVE_KGA_INPUT);
    const skillData = skillRun.output?.data as unknown as KnowledgeGapAnalysisResult;
    const baselineData = baselineRun.output?.data as unknown as KnowledgeGapAnalysisResult;

    const comparison = compareKnowledgeGapAnalysisRuns(baselineData, skillData, POSITIVE_KGA_INPUT);

    expect(comparison.skill.classification_coverage_ratio).toBeGreaterThan(comparison.baseline.classification_coverage_ratio);
    expect(comparison.skill.unsupported_proven_count).toBeLessThan(comparison.baseline.unsupported_proven_count);
    expect(comparison.skill.closure_overclaim_count).toBeLessThan(comparison.baseline.closure_overclaim_count);

    expect(validateKnowledgeGapAnalysisResult(skillData, POSITIVE_KGA_INPUT.context_facts).valid).toBe(true);
    expect(validateKnowledgeGapAnalysisResult(baselineData, POSITIVE_KGA_INPUT.context_facts).valid).toBe(false);
  });

  it("on the negative fixture: research_target_capture_ratio strictly improves and the Skill run has zero told-as-proven / unknowable-misclassified counts", async () => {
    const skillRun = await runSkillAssistedScenario(NEGATIVE_KGA_INPUT);
    const baselineRun = await runBaselineScenario(NEGATIVE_KGA_INPUT);
    const skillData = skillRun.output?.data as unknown as KnowledgeGapAnalysisResult;
    const baselineData = baselineRun.output?.data as unknown as KnowledgeGapAnalysisResult;

    const comparison = compareKnowledgeGapAnalysisRuns(baselineData, skillData, NEGATIVE_KGA_INPUT);

    expect(comparison.skill.research_target_capture_ratio).toBeGreaterThan(comparison.baseline.research_target_capture_ratio);
    expect(comparison.skill.told_as_proven_count).toBe(0);
    expect(comparison.skill.unknowable_misclassified_as_research_count).toBe(0);
  });

  it("baseline and Skill run both execute through compileAgentDefinition() -> runAgent() with the same base config, only the materialization differs", async () => {
    const skillRun = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const baselineRun = await runBaselineScenario(POSITIVE_KGA_INPUT);
    expect(skillRun.outcome).toBe("SUCCESS");
    expect(baselineRun.outcome).toBe("SUCCESS");

    const skillDefinition = materializeKnowledgeGapAnalysisTask({
      baseDefinition: knowledgeGapAnalyzerDefinition,
      input: POSITIVE_KGA_INPUT,
      loadedSkill: knowledgeGapAnalysisS13B,
      qualityContractRef: KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
    });
    const baselineDefinition = materializeBaselineKnowledgeGapAnalysisTask({
      baseDefinition: knowledgeGapAnalyzerDefinition,
      input: POSITIVE_KGA_INPUT,
    });

    expect(baselineDefinition.limits).toEqual(skillDefinition.limits);
    expect(baselineDefinition.model_policy).toEqual(skillDefinition.model_policy);
    expect(baselineDefinition.tools).toEqual(skillDefinition.tools);
    expect(baselineDefinition.capabilities).toEqual(skillDefinition.capabilities);
    expect(baselineDefinition.objective).not.toContain("SKILL_ID:");
    expect(skillDefinition.objective).toContain("SKILL_ID:");
  });
});

// ---------------------------------------------------------------------------
// T24 — full regression
// ---------------------------------------------------------------------------
describe("T24 — full regression", () => {
  it("S07-S13A AgentDefinitions remain valid alongside the new S13B artifacts", () => {
    expect(validateAgentDefinition(requirementsDiscovererDefinition).valid).toBe(true);
    expect(validateAgentDefinition(knowledgeGapAnalyzerDefinition).valid).toBe(true);
  });

  it("StructuredAgentOutput mapping matches the real run's mapping", async () => {
    const result = await runSkillAssistedScenario(POSITIVE_KGA_INPUT);
    const data = result.output?.data as unknown as KnowledgeGapAnalysisResult;
    const mapped = mapKnowledgeGapAnalysisResultToStructuredOutput(data);
    expect(mapped.summary).toBe(result.output?.summary);
    expect(mapped.evidence_refs).toEqual(result.output?.evidence_refs);
  });

  it("descriptor projection remains metadata-only for the S13B Skill", () => {
    const descriptor = toSkillDescriptor(knowledgeGapAnalysisS13B) as unknown as Record<string, unknown>;
    for (const forbiddenKey of ["rules", "procedure", "verification", "inputs", "outputs"]) {
      expect(descriptor).not.toHaveProperty(forbiddenKey);
    }
  });

  it("no forbidden vendor/provider token appears in the knowledge-gap-analyzer AgentDefinition or Skill/Quality Contract artifacts", () => {
    const FORBIDDEN = ["openai", "anthropic", "gemini", "hermes", "notion", "langchain", "langgraph"];
    const strings: string[] = [];
    (function collect(value: unknown) {
      if (typeof value === "string") strings.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    })(knowledgeGapAnalyzerDefinition);
    const offenders = strings.filter((s) => FORBIDDEN.some((token) => s.toLowerCase().includes(token)));
    expect(offenders).toEqual([]);

    const skillText = readFileSync(SKILL_PATH, "utf8").toLowerCase();
    const qcText = readFileSync(QUALITY_CONTRACT_PATH, "utf8").toLowerCase();
    for (const token of FORBIDDEN) {
      expect(skillText.includes(token)).toBe(false);
      expect(qcText.includes(token)).toBe(false);
    }
  });

  it("materializeKnowledgeGapAnalysisTask does not mutate the base definition and rejects an empty input", () => {
    const before = JSON.stringify(knowledgeGapAnalyzerDefinition);
    materializeKnowledgeGapAnalysisTask({
      baseDefinition: knowledgeGapAnalyzerDefinition,
      input: POSITIVE_KGA_INPUT,
      loadedSkill: knowledgeGapAnalysisS13B,
      qualityContractRef: KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
    });
    expect(JSON.stringify(knowledgeGapAnalyzerDefinition)).toBe(before);
    expect(() =>
      materializeKnowledgeGapAnalysisTask({
        baseDefinition: knowledgeGapAnalyzerDefinition,
        input: { requirements_discovery: { ...POSITIVE_KGA_INPUT.requirements_discovery, request: "   " }, context_facts: [] },
        loadedSkill: knowledgeGapAnalysisS13B,
        qualityContractRef: KNOWLEDGE_GAP_ANALYSIS_QUALITY_CONTRACT_REF,
      }),
    ).toThrow();
  });

  it("runBaselineClassification is coherent with the fixture's own request text", () => {
    const result = runBaselineClassification(NEGATIVE_KGA_INPUT);
    expect(result.source_request).toBe(NEGATIVE_KGA_INPUT.requirements_discovery.request);
  });
});
