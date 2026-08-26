import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { compileAgentDefinition, runAgent, validateAgentDefinition } from "../../src/core/agent/index.js";
import type { SkillCatalogEntry } from "../../src/core/skill/index.js";
import { toSkillDescriptor, validateSkillDefinition } from "../../src/core/skill/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { ReferenceResearchCapabilityProvider } from "../../src/providers/capability/referenceResearchCapabilityProvider.js";
import {
  referenceSkillCatalogEntries,
  deepResearchS13C,
  knowledgeGapAnalysisS13B,
  selectSkillForTask,
} from "../../src/intelligence/skills/index.js";
import { deepResearcherDefinition } from "../../src/intelligence/agent-definitions/deepResearcherDefinition.js";
import { researcherDefinition } from "../../src/intelligence/agent-definitions/researcherDefinition.js";
import {
  DEEP_RESEARCH_QUALITY_CONTRACT_REF,
  DEEP_RESEARCH_SKILL_ARTIFACT_PATH,
  DEEP_RESEARCH_SKILL_ID,
} from "../../src/intelligence/deep-research/deepResearchSkill.js";
import { RESEARCH_SKILL_ID } from "../../src/intelligence/research/researchSkill.js";
import {
  materializeBaselineDeepResearchTask,
  materializeDeepResearchTask,
} from "../../src/intelligence/deep-research/materializeDeepResearchTask.js";
import { selectDeepResearchItems } from "../../src/intelligence/deep-research/selectDeepResearchItems.js";
import { validateDeepResearchResult, mapDeepResearchBatchResultToStructuredOutput } from "../../src/intelligence/deep-research/validateDeepResearchResult.js";
import { compareDeepResearchRuns } from "../../src/intelligence/deep-research/compareDeepResearchRuns.js";
import { countSupportingIndependenceGroups } from "../../src/intelligence/deep-research/validateDeepResearchResult.js";
import type { DeepResearchBatchResult, DeepResearchItemResult } from "../../src/intelligence/deep-research/types.js";
import { validateResearchResult } from "../../src/intelligence/research/validateResearchResult.js";
import {
  DeterministicDeepResearchModelProvider,
  EXPECTED_CONTRADICTION_COUNT_BY_ITEM,
  NEGATIVE_BASELINE_STEPS,
  NEGATIVE_CORPUS,
  NEGATIVE_DEEP_RESEARCH_INPUT,
  NEGATIVE_SKILL_STEPS,
  POSITIVE_BASELINE_STEPS,
  POSITIVE_CORPUS,
  POSITIVE_CORPUS_WITHOUT_INDEPENDENT_GROUP,
  POSITIVE_DEEP_RESEARCH_INPUT,
  POSITIVE_DEEP_RESEARCH_KGA,
  POSITIVE_SKILL_STEPS,
} from "./fixtures.js";
import type { EvidenceItem } from "../../src/intelligence/research/types.js";

const REPO_ROOT = process.cwd();
const SKILL_PATH = join(REPO_ROOT, DEEP_RESEARCH_SKILL_ARTIFACT_PATH);
const QUALITY_CONTRACT_PATH = join(REPO_ROOT, DEEP_RESEARCH_QUALITY_CONTRACT_REF);

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

async function runSkillAssistedScenario(
  input: typeof POSITIVE_DEEP_RESEARCH_INPUT,
  corpus: typeof POSITIVE_CORPUS,
  stepsByItemSkill: Record<string, typeof POSITIVE_SKILL_STEPS>,
  stepsByItemBaseline: Record<string, typeof POSITIVE_BASELINE_STEPS>,
) {
  const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
  const selection = await selectSkillForTask({
    task: "deep research evidence gathering needs research queue cross-check contradiction",
    agent_definition: deepResearcherDefinition,
    provider,
  });
  if (!selection.loaded) throw new Error("S13C Skill was not selected/loaded — cannot run scenario.");

  const definition = materializeDeepResearchTask({
    baseDefinition: deepResearcherDefinition,
    input,
    loadedSkill: selection.loaded,
    qualityContractRef: DEEP_RESEARCH_QUALITY_CONTRACT_REF,
  });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicDeepResearchModelProvider(stepsByItemSkill, stepsByItemBaseline),
    capability_provider: new ReferenceResearchCapabilityProvider(corpus),
  });
  return runAgent(compiled.run_options);
}

async function runBaselineScenario(
  input: typeof POSITIVE_DEEP_RESEARCH_INPUT,
  corpus: typeof POSITIVE_CORPUS,
  stepsByItemSkill: Record<string, typeof POSITIVE_SKILL_STEPS>,
  stepsByItemBaseline: Record<string, typeof POSITIVE_BASELINE_STEPS>,
) {
  const definition = materializeBaselineDeepResearchTask({ baseDefinition: deepResearcherDefinition, input });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicDeepResearchModelProvider(stepsByItemSkill, stepsByItemBaseline),
    capability_provider: new ReferenceResearchCapabilityProvider(corpus),
  });
  return runAgent(compiled.run_options);
}

const POSITIVE_STEPS_SKILL = { "K-Q1": POSITIVE_SKILL_STEPS };
const POSITIVE_STEPS_BASELINE = { "K-Q1": POSITIVE_BASELINE_STEPS };
const NEGATIVE_STEPS_SKILL = { "K-NEG-1": NEGATIVE_SKILL_STEPS };
const NEGATIVE_STEPS_BASELINE = { "K-NEG-1": NEGATIVE_BASELINE_STEPS };

async function runPositiveSkill() {
  return runSkillAssistedScenario(POSITIVE_DEEP_RESEARCH_INPUT, POSITIVE_CORPUS, POSITIVE_STEPS_SKILL, POSITIVE_STEPS_BASELINE);
}
async function runPositiveBaseline() {
  return runBaselineScenario(POSITIVE_DEEP_RESEARCH_INPUT, POSITIVE_CORPUS, POSITIVE_STEPS_SKILL, POSITIVE_STEPS_BASELINE);
}
async function runNegativeSkill() {
  return runSkillAssistedScenario(NEGATIVE_DEEP_RESEARCH_INPUT, NEGATIVE_CORPUS, NEGATIVE_STEPS_SKILL, NEGATIVE_STEPS_BASELINE);
}
async function runNegativeBaseline() {
  return runBaselineScenario(NEGATIVE_DEEP_RESEARCH_INPUT, NEGATIVE_CORPUS, NEGATIVE_STEPS_SKILL, NEGATIVE_STEPS_BASELINE);
}

// ---------------------------------------------------------------------------
// T1 — canonical S13C Skill exists
// ---------------------------------------------------------------------------
describe("T1 — canonical S13C Skill exists", () => {
  it("contains the approved identity and protected S11 reuse semantics", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const token of [
      "deep-research.evidence-grounded.s13c",
      "research.evidence-grounded.s11",
      "DR-R1",
      "DR-P1",
      "DR-V1",
      "EVIDENCED",
      "INFERENCE",
      "UNCERTAIN",
      "independence_group",
      "value-of-information",
    ]) {
      expect(text.toLowerCase()).toContain(token.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// T2 — typed S13C Skill validates
// ---------------------------------------------------------------------------
describe("T2 — typed S13C Skill validates", () => {
  it("passes S12 SkillDefinition validation", () => {
    const result = validateSkillDefinition(deepResearchS13C);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T3 — S11 semantic dependency preserved
// ---------------------------------------------------------------------------
describe("T3 — S11 semantic dependency preserved", () => {
  it("declares research.evidence-grounded.s11 as a semantic dependency and never redefines S11 vocabulary", () => {
    expect(deepResearchS13C.requires.skills).toEqual([RESEARCH_SKILL_ID]);
    const combined = `${deepResearchS13C.description} ${deepResearchS13C.rules.map((r) => r.statement).join(" ")}`;
    for (const token of ["EVIDENCED", "INFERENCE", "UNCERTAIN", "independence_group", "value-of-information"]) {
      expect(combined.toLowerCase()).toContain(token.toLowerCase());
    }
  });

  it("a real S13C item's research object passes the unmodified S11 validator directly", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = data.items[0];
    expect(validateResearchResult(item.research).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T4 — dedicated DEEP Quality Contract integrity
// ---------------------------------------------------------------------------
describe("T4 — dedicated DEEP Quality Contract integrity", () => {
  it("parses and satisfies the canonical S13C requirements", () => {
    const text = readFileSync(QUALITY_CONTRACT_PATH, "utf8");
    const doc = loadYaml(text) as Record<string, any>;

    expect(doc.depth).toBe("DEEP");
    expect(doc.evidence.cross_validation).toBe(true);
    expect(doc.research.contradictory_evidence_required).toBe(true);
    expect(doc.research.value_of_information_stop_rule).toBe(true);
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
// T5 — deep-researcher AgentDefinition validates
// ---------------------------------------------------------------------------
describe("T5 — deep-researcher AgentDefinition validates", () => {
  it("passes the existing S10 validation path", () => {
    const result = validateAgentDefinition(deepResearcherDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("is a new, independent AgentDefinition — not researcher-v1/knowledge-gap-analyzer-v1/requirements-discoverer-v1", () => {
    expect(deepResearcherDefinition.id).toBe("deep-researcher-v1");
    expect(deepResearcherDefinition.role).toBe("deep-researcher");
    expect(deepResearcherDefinition.id).not.toBe(researcherDefinition.id);
  });
});

// ---------------------------------------------------------------------------
// T6 — capability set exact
// ---------------------------------------------------------------------------
describe("T6 — capability set exact", () => {
  it("exposes exactly research.lookup and no other capability", () => {
    expect(deepResearcherDefinition.tools).toEqual(["research.lookup"]);
    expect(deepResearcherDefinition.capabilities).toEqual(["research.lookup"]);
  });

  it("Skill allows exactly research.lookup", () => {
    expect(deepResearchS13C.requires.capabilities).toEqual(["research.lookup"]);
    expect(deepResearchS13C.permissions.allowed_capabilities).toEqual(["research.lookup"]);
  });
});

// ---------------------------------------------------------------------------
// T7 — exact S13C Skill allowlist
// ---------------------------------------------------------------------------
describe("T7 — exact S13C Skill allowlist", () => {
  it("agent.skills is exactly [deep-research.evidence-grounded.s13c]", () => {
    expect(deepResearcherDefinition.skills).toEqual([DEEP_RESEARCH_SKILL_ID]);
  });
});

// ---------------------------------------------------------------------------
// T8 — S12 discovery selects S13C
// ---------------------------------------------------------------------------
describe("T8 — S12 discovery selects S13C", () => {
  it("selects and loads the S13C Skill for the real, unmodified deepResearcherDefinition", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await selectSkillForTask({
      task: "deep research evidence gathering needs research queue cross-check contradiction",
      agent_definition: deepResearcherDefinition,
      provider,
    });
    expect(result.discovered.every((d) => d.id === DEEP_RESEARCH_SKILL_ID)).toBe(true);
    expect(result.selected?.id).toBe(DEEP_RESEARCH_SKILL_ID);
    expect(result.loaded?.id).toBe(DEEP_RESEARCH_SKILL_ID);
  });

  it("no full definition loads during discovery", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await provider.discover({ query: "deep research evidence gathering" });
    for (const spy of spies.values()) expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T9 — lazy selected load only
// ---------------------------------------------------------------------------
describe("T9 — lazy selected load only", () => {
  it("calls only the S13C loader exactly once; unrelated loaders remain uncalled", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);

    const loaded = await provider.load({ id: DEEP_RESEARCH_SKILL_ID });

    expect(loaded.id).toBe(DEEP_RESEARCH_SKILL_ID);
    expect(spies.get(DEEP_RESEARCH_SKILL_ID)).toHaveBeenCalledTimes(1);
    for (const [id, spy] of spies.entries()) {
      if (id !== DEEP_RESEARCH_SKILL_ID) expect(spy).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// T10 — queue selection bounded
// ---------------------------------------------------------------------------
describe("T10 — queue selection bounded", () => {
  it("defaults to selecting 1 item, preserving S13B queue order", () => {
    const selection = selectDeepResearchItems(POSITIVE_DEEP_RESEARCH_INPUT);
    expect(selection.selected_item_ids).toEqual(["K-Q1"]);
    expect(selection.deferred_item_ids).toEqual(["K-Q2"]);
    expect(selection.queue_snapshot).toEqual(["K-Q1", "K-Q2"]);
  });

  it("selects up to 3 when max_research_items is set, still in queue order", () => {
    const selection = selectDeepResearchItems({ ...POSITIVE_DEEP_RESEARCH_INPUT, max_research_items: 2 });
    expect(selection.selected_item_ids).toEqual(["K-Q1", "K-Q2"]);
    expect(selection.deferred_item_ids).toEqual([]);
  });

  it("a live 2-item Skill run through compileAgentDefinition()/runAgent() partitions prior_observations correctly per item (multi-item obsCursor path)", async () => {
    const twoItemInput = { ...POSITIVE_DEEP_RESEARCH_INPUT, max_research_items: 2 };
    const result = await runSkillAssistedScenario(
      twoItemInput,
      POSITIVE_CORPUS,
      { "K-Q1": POSITIVE_SKILL_STEPS, "K-Q2": [] },
      { "K-Q1": POSITIVE_BASELINE_STEPS, "K-Q2": [] },
    );
    expect(result.outcome).toBe("SUCCESS");
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    expect(data.selected_item_ids).toEqual(["K-Q1", "K-Q2"]);
    expect(data.items).toHaveLength(2);
    // K-Q1 issued 3 real lookups and has real evidence; K-Q2 issued none and
    // must reflect that it received zero prior_observations (obsCursor sliced
    // the shared sequential tool-call stream correctly per item, not just
    // globally).
    expect(data.items[0].knowledge_item_id).toBe("K-Q1");
    expect(data.items[0].research.findings.some((f) => f.evidence.length > 0)).toBe(true);
    expect(data.items[1].knowledge_item_id).toBe("K-Q2");
    expect(data.items[1].research.findings.every((f) => f.evidence.length === 0)).toBe(true);
  });

  it("rejects max_research_items > 3", () => {
    expect(() => selectDeepResearchItems({ ...POSITIVE_DEEP_RESEARCH_INPUT, max_research_items: 4 })).toThrow();
  });

  it("rejects max_research_items < 1", () => {
    expect(() => selectDeepResearchItems({ ...POSITIVE_DEEP_RESEARCH_INPUT, max_research_items: 0 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// T11 — only NEEDS_RESEARCH selectable
// ---------------------------------------------------------------------------
describe("T11 — only NEEDS_RESEARCH selectable", () => {
  it("rejects a research_queue entry whose upstream item is not NEEDS_RESEARCH", () => {
    const invalid = clone(POSITIVE_DEEP_RESEARCH_INPUT);
    invalid.knowledge_gap_analysis.items[0].epistemic_status = "ASSUMED";
    expect(() => selectDeepResearchItems(invalid)).toThrow(/NEEDS_RESEARCH/);
  });
});

// ---------------------------------------------------------------------------
// T12 — UNKNOWABLE exclusion
// ---------------------------------------------------------------------------
describe("T12 — UNKNOWABLE exclusion", () => {
  it("rejects a selected item that appears in handoff.unknowable_item_ids", () => {
    const invalid = clone(POSITIVE_DEEP_RESEARCH_INPUT);
    invalid.knowledge_gap_analysis.handoff.unknowable_item_ids = ["K-Q1"];
    expect(() => selectDeepResearchItems(invalid)).toThrow(/UNKNOWABLE/);
  });
});

// ---------------------------------------------------------------------------
// T13 — S13B traceability preserved
// ---------------------------------------------------------------------------
describe("T13 — S13B traceability preserved", () => {
  it("preserves knowledge_item_id, research_question, decision_impact, and blocking exactly", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = data.items[0];
    expect(item.knowledge_item_id).toBe("K-Q1");
    expect(item.research_question).toBe(POSITIVE_DEEP_RESEARCH_KGA.research_queue[0].research_question);
    expect(item.decision_impact).toBe("DECISION_CRITICAL");
    expect(item.blocking).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T14 — S11 ResearchResult validator reused
// ---------------------------------------------------------------------------
describe("T14 — S11 ResearchResult validator reused", () => {
  it("validateDeepResearchResult delegates to the real, unchanged validateResearchResult per item", () => {
    const invalid = clone(POSITIVE_DEEP_RESEARCH_KGA);
    const batch: DeepResearchBatchResult = {
      source_request: "x",
      queue_snapshot: ["K-Q1"],
      selected_item_ids: ["K-Q1"],
      deferred_item_ids: [],
      batch_status: "COMPLETE",
      decision_relevant_summary: "s",
      items: [
        {
          knowledge_item_id: "K-Q1",
          research_question: "q",
          decision_impact: "DECISION_CRITICAL",
          blocking: true,
          upstream_epistemic_status: "NEEDS_RESEARCH",
          upstream_closure_state: null,
          research: {
            question: "q",
            subquestions: [],
            findings: [
              {
                id: "f1",
                claim: "c",
                criticality: "DECISION_CRITICAL",
                epistemic_status: "EVIDENCED",
                evidence: [],
                confidence: "HIGH",
                limitations: [],
              },
            ],
            contradictions: [],
            unknowns: [],
            research_status: { state: "SATISFIED", reason: "r", unresolved_decision_critical_gaps: [], additional_research_expected_to_change_decision: false },
            decision_relevant_summary: "s",
          },
          recommended_closure_state: "RESOLVED_WITH_EVIDENCE",
          closure_rationale: "r",
          limitations: [],
        },
      ],
    };
    const validation = validateDeepResearchResult(batch);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("S11 validateResearchResult, T14 reuse"))).toBe(true);
    expect(validation.errors.some((e) => e.includes("unsupported critical claim is forbidden"))).toBe(true);
    void invalid;
  });
});

// ---------------------------------------------------------------------------
// T15 — S11 and S13B epistemic vocabularies remain separate
// ---------------------------------------------------------------------------
describe("T15 — S11 and S13B epistemic vocabularies remain separate", () => {
  it("finding-level epistemic_status is EVIDENCED|INFERENCE|UNCERTAIN while the upstream item stays NEEDS_RESEARCH", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = data.items[0];
    expect(item.upstream_epistemic_status).toBe("NEEDS_RESEARCH");
    for (const finding of item.research.findings) {
      expect(["EVIDENCED", "INFERENCE", "UNCERTAIN"]).toContain(finding.epistemic_status);
    }
  });
});

// ---------------------------------------------------------------------------
// T16 — independent cross-validation
// ---------------------------------------------------------------------------
describe("T16 — independent cross-validation", () => {
  it("the positive fixture's material claim uses >=2 distinct independence_group values, counted as groups not evidence-ref count", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const finding = data.items[0].research.findings[0];
    const supports = finding.evidence.filter((e) => e.relationship === "SUPPORTS");
    expect(supports.length).toBeGreaterThanOrEqual(2);
    expect(countSupportingIndependenceGroups(finding.evidence)).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// T17 — duplicate group does not cross-validate
// ---------------------------------------------------------------------------
describe("T17 — duplicate group does not cross-validate", () => {
  it("two evidence items sharing one independence_group count as one independent source family", () => {
    const duplicateGroupEvidence: EvidenceItem[] = [
      {
        evidence_ref: "ev-COPY-A",
        source_ref: "COPY-A",
        source_title: "Community Summary A",
        source_type: "SECONDARY",
        authority: "community-summary",
        independence_group: "upstream-blog-1",
        observed_or_published_at: "2026-01-10",
        locator: "/summary-a",
        relationship: "SUPPORTS",
      },
      {
        evidence_ref: "ev-COPY-B",
        source_ref: "COPY-B",
        source_title: "Syndicated Summary B",
        source_type: "SECONDARY",
        authority: "syndicated-summary",
        independence_group: "upstream-blog-1",
        observed_or_published_at: "2026-01-12",
        locator: "/summary-b",
        relationship: "SUPPORTS",
      },
    ];
    expect(countSupportingIndependenceGroups(duplicateGroupEvidence)).toBe(1);
  });

  it("the negative fixture's Skill run does not treat COPY-A/COPY-B as independent support for the final claim", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const finding = data.items[0].research.findings[0];
    const supports = finding.evidence.filter((e) => e.relationship === "SUPPORTS");
    // COPY-A/COPY-B are the contradicted (superseded) claim in the correct Skill-mode
    // synthesis — the final supported claim rests on the authoritative current source.
    expect(new Set(supports.map((e) => e.independence_group)).size).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// T18 — authoritative/primary preference
// ---------------------------------------------------------------------------
describe("T18 — authoritative/primary preference", () => {
  it("the positive fixture's material claim includes a PRIMARY source", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const finding = data.items[0].research.findings[0];
    expect(finding.evidence.some((e) => e.source_type === "PRIMARY")).toBe(true);
  });

  it("the negative fixture's Skill run prefers the current PRIMARY authoritative source over duplicated secondary sources", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = data.items[0];
    expect(item.recommended_closure_state).toBe("RESOLVED_BY_AUTHORITY");
    expect(item.research.findings[0].evidence.some((e) => e.source_ref === "OFFICIAL-CURRENT" && e.source_type === "PRIMARY")).toBe(true);
  });

  it("rejects a singular-authority exception claimed by limitation text alone with no PRIMARY SUPPORTS evidence (self-certification fix)", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = clone(data.items[0]);
    // Only SECONDARY duplicate-group evidence, HIGH confidence, and a limitation
    // reciting the exception cue phrase — but no PRIMARY SUPPORTS evidence backs it.
    item.research.findings[0].evidence = item.research.findings[0].evidence
      .filter((e) => e.source_ref !== "OFFICIAL-CURRENT")
      .map((e) => ({ ...e, relationship: "SUPPORTS" as const, source_type: "SECONDARY" as const }));
    item.research.findings[0].confidence = "HIGH";
    item.research.findings[0].limitations = ["Sufficient canonical authority establishes the answer; no further cross-validation needed."];
    item.research.contradictions = [];
    const validation = validateDeepResearchResult({
      source_request: "x",
      queue_snapshot: [item.knowledge_item_id],
      selected_item_ids: [item.knowledge_item_id],
      deferred_item_ids: [],
      batch_status: "COMPLETE",
      decision_relevant_summary: "s",
      items: [item],
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("DR-R5/DR-R6/DR-R7"))).toBe(true);
  });

  it("accepts the singular-authority exception when a real PRIMARY SUPPORTS evidence item backs the cue", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = clone(data.items[0]);
    item.research.findings[0].evidence = item.research.findings[0].evidence
      .filter((e) => e.source_ref === "OFFICIAL-CURRENT")
      .map((e) => ({ ...e, relationship: "SUPPORTS" as const }));
    item.research.findings[0].confidence = "HIGH";
    item.research.findings[0].limitations = ["Sufficient canonical authority establishes the answer; no further cross-validation needed."];
    item.research.contradictions = [];
    const validation = validateDeepResearchResult({
      source_request: "x",
      queue_snapshot: [item.knowledge_item_id],
      selected_item_ids: [item.knowledge_item_id],
      deferred_item_ids: [],
      batch_status: "COMPLETE",
      decision_relevant_summary: "s",
      items: [item],
    });
    expect(validation.errors.some((e) => e.includes("DR-R5/DR-R6/DR-R7"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T19 — contradiction visible
// ---------------------------------------------------------------------------
describe("T19 — contradiction visible", () => {
  it("the negative fixture's contradiction between COPY-A/COPY-B and OFFICIAL-CURRENT is surfaced, not erased", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const contradictions = data.items[0].research.contradictions;
    expect(contradictions.length).toBeGreaterThanOrEqual(1);
    const refs = contradictions.flatMap((c) => c.evidence_refs);
    expect(refs).toContain("ev-OFFICIAL-CURRENT");
    expect(refs).toContain("ev-COPY-A");
  });
});

// ---------------------------------------------------------------------------
// T20 — recency qualification
// ---------------------------------------------------------------------------
describe("T20 — recency qualification", () => {
  function baseValidBatch(item: DeepResearchItemResult): DeepResearchBatchResult {
    return {
      source_request: "x",
      queue_snapshot: [item.knowledge_item_id],
      selected_item_ids: [item.knowledge_item_id],
      deferred_item_ids: [],
      batch_status: "COMPLETE",
      decision_relevant_summary: "s",
      items: [item],
    };
  }

  it("rejects a current-state claim supported only by stale evidence with no recency limitation", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = clone(data.items[0]);
    // Force the finding to rely only on the stale COPY-A/COPY-B evidence for a
    // current-state claim, dropping the fresh authoritative source and any
    // recency-aware limitation.
    item.research.findings[0].claim = "El proveedor soporta actualmente la característica.";
    item.research.findings[0].evidence = item.research.findings[0].evidence
      .filter((e) => e.source_ref !== "OFFICIAL-CURRENT")
      .map((e) => ({ ...e, relationship: "SUPPORTS" as const }));
    item.research.findings[0].limitations = [];
    item.research.contradictions = [];
    const validation = validateDeepResearchResult(baseValidBatch(item));
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("DR-R10"))).toBe(true);
  });

  it("accepts the same stale-evidence claim when an explicit recency limitation is present", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = clone(data.items[0]);
    item.research.findings[0].claim = "El proveedor soporta actualmente la característica.";
    item.research.findings[0].evidence = item.research.findings[0].evidence
      .filter((e) => e.source_ref !== "OFFICIAL-CURRENT")
      .map((e) => ({ ...e, relationship: "SUPPORTS" as const }));
    item.research.findings[0].limitations = ["This evidence's recency could not be confirmed as current; vigencia debe revalidarse."];
    item.research.contradictions = [];
    const validation = validateDeepResearchResult(baseValidBatch(item));
    expect(validation.errors.some((e) => e.includes("DR-R10"))).toBe(false);
  });

  it("rejects stale-without-limitation evidence for a current-state item even when only the research_question (not the claim text) carries the current-state cue", async () => {
    const result = await runNegativeBaseline();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = clone(data.items[0]);
    // K-NEG-1's research_question contains "actualmente"; the baseline's naive
    // claim text does not — the rule must still fire question-relative (DR spec
    // section 6: "Recency is question-relative").
    expect(item.research_question).toMatch(/actualmente/i);
    expect(item.research.findings[0].claim).not.toMatch(/actualmente|currently/i);
    item.research.findings[0].limitations = [];
    item.research.contradictions = [];
    const validation = validateDeepResearchResult(baseValidBatch(item));
    expect(validation.errors.some((e) => e.includes("DR-R10"))).toBe(true);
  });

  it("does not reject a stable historical fact backed only by an older source", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const item = clone(data.items[0]);
    item.research.findings[0].claim = "El identificador fue registrado originalmente en la documentación del fabricante.";
    const validation = validateDeepResearchResult(baseValidBatch(item));
    expect(validation.errors.some((e) => e.includes("DR-R10"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T21 — VOI/research-status mapping
// ---------------------------------------------------------------------------
describe("T21 — VOI/research-status mapping", () => {
  it("the positive Skill run reaches SATISFIED", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    expect(data.items[0].research.research_status.state).toBe("SATISFIED");
  });

  it("the negative Skill run reaches SATISFIED via the authoritative current source", async () => {
    const result = await runNegativeSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    expect(data.items[0].research.research_status.state).toBe("SATISFIED");
  });

  it("MORE_RESEARCH_NEEDED is accepted only with null closure (unit-level)", () => {
    const item: DeepResearchItemResult = {
      knowledge_item_id: "K-X",
      research_question: "q",
      decision_impact: "DECISION_RELEVANT",
      blocking: false,
      upstream_epistemic_status: "NEEDS_RESEARCH",
      upstream_closure_state: null,
      research: {
        question: "q",
        subquestions: [],
        findings: [],
        contradictions: [],
        unknowns: [{ question: "q", gap_class: "DECISION_RELEVANT", reason_unresolved: "no evidence", decision_impact: "n/a", revalidation_trigger: "t" }],
        research_status: { state: "MORE_RESEARCH_NEEDED", reason: "r", unresolved_decision_critical_gaps: [], additional_research_expected_to_change_decision: true },
        decision_relevant_summary: "s",
      },
      recommended_closure_state: null,
      closure_rationale: "no closure recommended",
      limitations: [],
    };
    const batch: DeepResearchBatchResult = {
      source_request: "x",
      queue_snapshot: ["K-X"],
      selected_item_ids: ["K-X"],
      deferred_item_ids: [],
      batch_status: "COMPLETE",
      decision_relevant_summary: "s",
      items: [item],
    };
    expect(validateDeepResearchResult(batch).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T22 — closure recommendation mapping
// ---------------------------------------------------------------------------
describe("T22 — closure recommendation mapping", () => {
  async function positiveItem(): Promise<DeepResearchItemResult> {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    return clone(data.items[0]);
  }

  function batchOf(item: DeepResearchItemResult): DeepResearchBatchResult {
    return {
      source_request: "x",
      queue_snapshot: [item.knowledge_item_id],
      selected_item_ids: [item.knowledge_item_id],
      deferred_item_ids: [],
      batch_status: "COMPLETE",
      decision_relevant_summary: "s",
      items: [item],
    };
  }

  it("rejects MORE_RESEARCH_NEEDED + RESOLVED_WITH_EVIDENCE", async () => {
    const item = await positiveItem();
    item.research.research_status.state = "MORE_RESEARCH_NEEDED";
    item.recommended_closure_state = "RESOLVED_WITH_EVIDENCE";
    expect(validateDeepResearchResult(batchOf(item)).valid).toBe(false);
  });

  it("rejects EXHAUSTED_WITH_UNCERTAINTY + unjustified RESOLVED_WITH_EVIDENCE", async () => {
    const item = await positiveItem();
    item.research.research_status.state = "EXHAUSTED_WITH_UNCERTAINTY";
    item.recommended_closure_state = "RESOLVED_WITH_EVIDENCE";
    expect(validateDeepResearchResult(batchOf(item)).valid).toBe(false);
  });

  it("rejects RESOLVED_BY_AUTHORITY without a PRIMARY evidence item", async () => {
    const item = await positiveItem();
    item.recommended_closure_state = "RESOLVED_BY_AUTHORITY";
    item.research.findings[0].evidence = item.research.findings[0].evidence.map((e) => ({ ...e, source_type: "SECONDARY" as const }));
    expect(validateDeepResearchResult(batchOf(item)).valid).toBe(false);
  });

  it("accepts the justified positive-fixture closure", async () => {
    const item = await positiveItem();
    expect(validateDeepResearchResult(batchOf(item)).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T23 — upstream S13B immutability
// ---------------------------------------------------------------------------
describe("T23 — upstream S13B immutability", () => {
  it("running S13C does not mutate the input KnowledgeGapAnalysisResult", async () => {
    const before = clone(POSITIVE_DEEP_RESEARCH_INPUT);
    await runPositiveSkill();
    expect(POSITIVE_DEEP_RESEARCH_INPUT).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// T24 — same S10/S09 runtime path
// ---------------------------------------------------------------------------
describe("T24 — same S10/S09 runtime path", () => {
  it("executes through compileAgentDefinition() -> runAgent() and reaches SUCCESS", async () => {
    const result = await runPositiveSkill();
    expect(result.outcome).toBe("SUCCESS");
  });

  it("has no separate DeepResearch runtime function anywhere in src/", () => {
    const srcDir = join(REPO_ROOT, "src");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8").toLowerCase();
          if (text.includes("rundeepresearchruntime(") || text.includes("deepresearcherruntime")) {
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
// T25 — no role/Skill branching in Core
// ---------------------------------------------------------------------------
describe("T25 — no role/Skill branching in Core", () => {
  it("finds no deep-researcher role/Skill-id branching anywhere under src/core/", () => {
    const forbidden = [
      'role === "deep-researcher"',
      "role === 'deep-researcher'",
      'skill.id === "deep-research.evidence-grounded.s13c"',
      "skill.id === 'deep-research.evidence-grounded.s13c'",
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
              (line.includes("../../providers") || line.includes("../providers") || line.includes("../../intelligence") || line.includes("../intelligence"))
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
// T26 — evidence-dependent output
// ---------------------------------------------------------------------------
describe("T26 — evidence-dependent output", () => {
  it("mutating a material source's independence_group changes the corresponding limitations/closure recommendation", async () => {
    const withGroup = await runPositiveSkill();
    const withoutGroup = await runSkillAssistedScenario(
      POSITIVE_DEEP_RESEARCH_INPUT,
      POSITIVE_CORPUS_WITHOUT_INDEPENDENT_GROUP,
      POSITIVE_STEPS_SKILL,
      POSITIVE_STEPS_BASELINE,
    );
    const itemWith = (withGroup.output?.data as unknown as DeepResearchBatchResult).items[0];
    const itemWithout = (withoutGroup.output?.data as unknown as DeepResearchBatchResult).items[0];
    expect(itemWith.recommended_closure_state).not.toBe(itemWithout.recommended_closure_state);
    expect(itemWith.research.findings[0].limitations).not.toEqual(itemWithout.research.findings[0].limitations);
  });

  it("a single canned final response fails this test by construction (unit check on the synthesizer)", async () => {
    const a = await runPositiveSkill();
    const b = await runNegativeSkill();
    expect(a.output?.data).not.toEqual(b.output?.data);
  });
});

// ---------------------------------------------------------------------------
// T27 — Skill improves over baseline
// ---------------------------------------------------------------------------
describe("T27 — Skill improves over baseline", () => {
  it("on the positive fixture: coverage, cross-validation, contradiction-visibility, and closure-overclaim all strictly improve", async () => {
    const skillRun = await runPositiveSkill();
    const baselineRun = await runPositiveBaseline();
    const skillData = skillRun.output?.data as unknown as DeepResearchBatchResult;
    const baselineData = baselineRun.output?.data as unknown as DeepResearchBatchResult;

    const comparison = compareDeepResearchRuns(baselineData, skillData, POSITIVE_DEEP_RESEARCH_INPUT, {
      expected_contradiction_count_by_item: EXPECTED_CONTRADICTION_COUNT_BY_ITEM,
    });

    expect(comparison.skill.material_claim_evidence_coverage_ratio).toBeGreaterThan(comparison.baseline.material_claim_evidence_coverage_ratio);
    expect(comparison.skill.independent_cross_validation_ratio).toBeGreaterThan(comparison.baseline.independent_cross_validation_ratio);
    expect(comparison.skill.contradiction_visibility_ratio).toBeGreaterThan(comparison.baseline.contradiction_visibility_ratio);
    expect(comparison.skill.closure_overclaim_count).toBeLessThan(comparison.baseline.closure_overclaim_count);

    expect(validateDeepResearchResult(skillData).valid).toBe(true);
    expect(validateDeepResearchResult(baselineData).valid).toBe(false);
  });

  it("on the negative fixture: the Skill run has zero duplicate-independence overcount, zero unsupported claims, and full contradiction visibility", async () => {
    const skillRun = await runNegativeSkill();
    const baselineRun = await runNegativeBaseline();
    const skillData = skillRun.output?.data as unknown as DeepResearchBatchResult;
    const baselineData = baselineRun.output?.data as unknown as DeepResearchBatchResult;

    const comparison = compareDeepResearchRuns(baselineData, skillData, NEGATIVE_DEEP_RESEARCH_INPUT, {
      expected_contradiction_count_by_item: EXPECTED_CONTRADICTION_COUNT_BY_ITEM,
    });

    expect(comparison.skill.duplicate_independence_overcount).toBe(0);
    expect(comparison.skill.unsupported_material_claim_count).toBe(0);
    expect(comparison.skill.contradiction_visibility_ratio).toBe(1);
    // The baseline's current-state claim ("actualmente" is in K-NEG-1's
    // research_question) rests only on the stale Jan-2026 COPY-A/COPY-B
    // evidence with no recency limitation; the Skill's does not (DR-R10,
    // question-relative recency).
    expect(comparison.baseline.stale_current_claim_without_limitation_count).toBe(1);
    expect(comparison.skill.stale_current_claim_without_limitation_count).toBe(0);
  });

  it("baseline and Skill run both execute through compileAgentDefinition() -> runAgent() with the same base config, only the materialization differs", async () => {
    const skillRun = await runPositiveSkill();
    const baselineRun = await runPositiveBaseline();
    expect(skillRun.outcome).toBe("SUCCESS");
    expect(baselineRun.outcome).toBe("SUCCESS");

    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const selection = await selectSkillForTask({ task: "deep research", agent_definition: deepResearcherDefinition, provider });
    const skillDefinition = materializeDeepResearchTask({
      baseDefinition: deepResearcherDefinition,
      input: POSITIVE_DEEP_RESEARCH_INPUT,
      loadedSkill: selection.loaded!,
      qualityContractRef: DEEP_RESEARCH_QUALITY_CONTRACT_REF,
    });
    const baselineDefinition = materializeBaselineDeepResearchTask({ baseDefinition: deepResearcherDefinition, input: POSITIVE_DEEP_RESEARCH_INPUT });

    expect(baselineDefinition.limits).toEqual(skillDefinition.limits);
    expect(baselineDefinition.model_policy).toEqual(skillDefinition.model_policy);
    expect(baselineDefinition.tools).toEqual(skillDefinition.tools);
    expect(baselineDefinition.capabilities).toEqual(skillDefinition.capabilities);
    expect(baselineDefinition.objective).not.toContain("SKILL_ID:");
    expect(skillDefinition.objective).toContain("SKILL_ID:");
  });
});

// ---------------------------------------------------------------------------
// T28 — full regression
// ---------------------------------------------------------------------------
describe("T28 — full regression", () => {
  it("S07-S13B AgentDefinitions remain valid alongside the new S13C artifacts", () => {
    expect(validateAgentDefinition(researcherDefinition).valid).toBe(true);
    expect(validateAgentDefinition(deepResearcherDefinition).valid).toBe(true);
  });

  it("StructuredAgentOutput mapping matches the real run's mapping", async () => {
    const result = await runPositiveSkill();
    const data = result.output?.data as unknown as DeepResearchBatchResult;
    const mapped = mapDeepResearchBatchResultToStructuredOutput(data);
    expect(mapped.summary).toBe(result.output?.summary);
    expect(mapped.evidence_refs).toEqual(result.output?.evidence_refs);
  });

  it("descriptor projection remains metadata-only for the S13C Skill", () => {
    const descriptor = toSkillDescriptor(deepResearchS13C) as unknown as Record<string, unknown>;
    for (const forbiddenKey of ["rules", "procedure", "verification", "inputs", "outputs"]) {
      expect(descriptor).not.toHaveProperty(forbiddenKey);
    }
  });

  it("no forbidden vendor/provider token appears in the deep-researcher AgentDefinition or Skill/Quality Contract artifacts", () => {
    const FORBIDDEN = ["openai", "anthropic", "gemini", "hermes", "notion", "langchain", "langgraph"];
    const strings: string[] = [];
    (function collect(value: unknown) {
      if (typeof value === "string") strings.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    })(deepResearcherDefinition);
    const offenders = strings.filter((s) => FORBIDDEN.some((token) => s.toLowerCase().includes(token)));
    expect(offenders).toEqual([]);

    const skillText = readFileSync(SKILL_PATH, "utf8").toLowerCase();
    const qcText = readFileSync(QUALITY_CONTRACT_PATH, "utf8").toLowerCase();
    for (const token of FORBIDDEN) {
      expect(skillText.includes(token)).toBe(false);
      expect(qcText.includes(token)).toBe(false);
    }
  });

  it("materializeDeepResearchTask does not mutate the base definition and rejects an invalid selection", () => {
    const before = JSON.stringify(deepResearcherDefinition);
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    void provider;
    expect(() =>
      materializeDeepResearchTask({
        baseDefinition: deepResearcherDefinition,
        input: { ...POSITIVE_DEEP_RESEARCH_INPUT, max_research_items: 99 },
        loadedSkill: deepResearchS13C,
        qualityContractRef: DEEP_RESEARCH_QUALITY_CONTRACT_REF,
      }),
    ).toThrow();
    expect(JSON.stringify(deepResearcherDefinition)).toBe(before);
  });

  it("S13B's own artifacts and tests remain unaffected by the S13C catalog registration", () => {
    expect(knowledgeGapAnalysisS13B.id).toBe("knowledge-gap.analysis.s13b");
  });
});
