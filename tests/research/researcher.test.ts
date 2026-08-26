import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import {
  runAgent,
  validateAgentDefinition,
  compileAgentDefinition,
  RestrictedCapabilityProvider,
} from "../../src/core/agent/index.js";
import { researcherDefinition } from "../../src/intelligence/agent-definitions/researcherDefinition.js";
import { referenceResearcher } from "../../src/intelligence/agent-definitions/referenceDefinitions.js";
import { materializeResearchTask } from "../../src/intelligence/research/materializeResearchTask.js";
import { validateResearchResult, mapResearchResultToStructuredOutput } from "../../src/intelligence/research/validateResearchResult.js";
import type { ResearchResult } from "../../src/intelligence/research/types.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID, RESEARCH_SKILL_ID } from "../../src/intelligence/research/researchSkill.js";
import { ReferenceResearchCapabilityProvider } from "../../src/providers/capability/referenceResearchCapabilityProvider.js";
import { DeterministicResearchModelProvider } from "./fixtures/deterministicResearchModelProvider.js";
import { MultiCapabilityProvider } from "../agent/fixtures.js";
import {
  meridianCorpus,
  meridianCorpusWithoutIndependentCorroboration,
  meridianCorpusWithoutConcurrencyEvidence,
  meridianCorpusWithDuplicateIndependenceGroup,
  TAG_CONCURRENCY_SAFETY,
  TAG_STORAGE_BACKEND,
} from "./fixtures/corpus.js";
import {
  SATISFIED_QUESTION,
  SATISFIED_STEPS,
  UNRESOLVED_QUESTION,
  UNRESOLVED_STEPS,
  buildSatisfiedResult,
  buildUnresolvedCriticalGapResult,
} from "./fixtures/scenarios.js";

const REPO_ROOT = process.cwd();
const SKILL_PATH = join(REPO_ROOT, "brain-bootstrap", "skills", "RESEARCH_SKILL_S11.md");
const QUALITY_CONTRACT_PATH = join(REPO_ROOT, "brain-bootstrap", "quality-contracts", "S11_RESEARCHER_STANDARD.yaml");

async function runSatisfiedScenario() {
  const definition = materializeResearchTask({ baseDefinition: researcherDefinition, question: SATISFIED_QUESTION });
  const compiled = compileAgentDefinition(definition, {
    model_provider: new DeterministicResearchModelProvider({ steps: SATISFIED_STEPS, buildResult: buildSatisfiedResult }),
    capability_provider: new ReferenceResearchCapabilityProvider(meridianCorpus),
  });
  return runAgent(compiled.run_options);
}

// ---------------------------------------------------------------------------
// T1 — Research Skill artifact integrity
// ---------------------------------------------------------------------------
describe("T1 — Research Skill artifact integrity", () => {
  it("exists and contains the canonical S11 Research Skill semantics", () => {
    const text = readFileSync(SKILL_PATH, "utf8");
    for (const token of [
      "research.evidence-grounded.s11",
      "research.lookup",
      "Knowledge Gap Analysis",
      "cross-check",
      "contradictions",
      "unknowns",
      "value-of-information",
    ]) {
      expect(text.toLowerCase()).toContain(token.toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// T2 — Quality Contract instance integrity
// ---------------------------------------------------------------------------
describe("T2 — Quality Contract instance integrity", () => {
  it("parses and satisfies the canonical S11 requirements", () => {
    const text = readFileSync(QUALITY_CONTRACT_PATH, "utf8");
    const doc = loadYaml(text) as Record<string, any>;

    expect(doc.depth).toBe("STANDARD");
    expect(doc.evidence.required).toBe(true);
    expect(doc.evidence.primary_sources_preferred).toBe(true);
    expect(doc.evidence.cross_validation).toBe(true);
    expect(doc.research.knowledge_gaps_required).toBe(true);
    expect(doc.research.contradictory_evidence_required).toBe(true);
    expect(doc.research.value_of_information_stop_rule).toBe(true);
    expect(doc.challenge.required).toBe(true);
    expect(doc.verification.independent_review_required).toBe(true);
    expect(doc.uncertainty.explicit).toBe(true);

    // Canonical S04 template sections remain present.
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
// T3 — Researcher AgentDefinition validates
// ---------------------------------------------------------------------------
describe("T3 — Researcher AgentDefinition validates", () => {
  it("passes the existing S10 validation path", () => {
    const result = validateAgentDefinition(researcherDefinition);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T4 — Researcher remains on generic runtime
// ---------------------------------------------------------------------------
describe("T4 — Researcher remains on generic runtime", () => {
  it("executes through compileAgentDefinition() -> runAgent() and reaches SUCCESS", async () => {
    const result = await runSatisfiedScenario();
    expect(result.outcome).toBe("SUCCESS");
  });

  it("has no separate Researcher runtime function anywhere in src/", () => {
    const srcDir = join(REPO_ROOT, "src");
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8").toLowerCase();
          if (text.includes("runresearcherruntime(")) offenders.push(full);
        }
      }
    }
    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T5 — no role conditional in Core, no forbidden Core->providers/intelligence imports
// ---------------------------------------------------------------------------
describe("T5 — no role-conditional branching or forbidden imports in Core", () => {
  it("finds no researcher-specific branching in src/core/agent/", () => {
    const forbidden = ['role === "researcher"', "role === 'researcher'", "runresearcher("];
    const coreDir = join(REPO_ROOT, "src", "core", "agent");
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

  it("finds no import of src/providers/ or src/intelligence/ inside src/core/agent/", () => {
    const coreDir = join(REPO_ROOT, "src", "core", "agent");
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
    walk(coreDir);
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T6 — capability policy is exact
// ---------------------------------------------------------------------------
describe("T6 — capability policy is exact", () => {
  it("exposes exactly research.lookup in tools and capabilities", () => {
    expect(researcherDefinition.tools).toEqual([RESEARCH_LOOKUP_CAPABILITY_ID]);
    expect(researcherDefinition.capabilities).toEqual([RESEARCH_LOOKUP_CAPABILITY_ID]);
  });

  it("blocks invocation of a capability outside the AgentDefinition allowlist", async () => {
    const researchDescriptor = (await new ReferenceResearchCapabilityProvider([]).list_capabilities())[0];
    const provider = new MultiCapabilityProvider([
      researchDescriptor,
      { capability_id: "forbidden_capability", name: "Forbidden", description: "", input_schema: {}, side_effects: "NONE" },
    ]);
    const compiled = compileAgentDefinition(researcherDefinition, {
      model_provider: new DeterministicResearchModelProvider({ steps: [], buildResult: buildSatisfiedResult }),
      capability_provider: provider,
    });
    const visible = await compiled.run_options.capabilityProvider.list_capabilities();
    expect(visible.map((d) => d.capability_id)).toEqual([RESEARCH_LOOKUP_CAPABILITY_ID]);

    const result = await compiled.run_options.capabilityProvider.invoke({
      run_id: "t6-run",
      turn: 1,
      call_id: "t6-call",
      capability_id: "forbidden_capability",
      input: {},
      timeout_ms: 1000,
    });
    expect(result.status).toBe("BLOCKED");
  });
});

// ---------------------------------------------------------------------------
// T7 — research.lookup performs a real bounded lookup
// ---------------------------------------------------------------------------
describe("T7 — research.lookup performs a real bounded lookup", () => {
  it("returns different result sets for different relevant queries", async () => {
    const provider = new ReferenceResearchCapabilityProvider(meridianCorpus);
    const a = await provider.invoke({
      run_id: "t7",
      turn: 1,
      call_id: "a",
      capability_id: RESEARCH_LOOKUP_CAPABILITY_ID,
      input: { query: TAG_CONCURRENCY_SAFETY },
      timeout_ms: 1000,
    });
    const b = await provider.invoke({
      run_id: "t7",
      turn: 1,
      call_id: "b",
      capability_id: RESEARCH_LOOKUP_CAPABILITY_ID,
      input: { query: TAG_STORAGE_BACKEND },
      timeout_ms: 1000,
    });
    expect(a.status).toBe("SUCCESS");
    expect(b.status).toBe("SUCCESS");
    if (a.status !== "SUCCESS" || b.status !== "SUCCESS") throw new Error("unreachable");
    const aRefs = (a.output.results as { source_ref: string }[]).map((r) => r.source_ref);
    const bRefs = (b.output.results as { source_ref: string }[]).map((r) => r.source_ref);
    expect(aRefs).not.toEqual(bRefs);
    expect(aRefs.length).toBeGreaterThan(0);
    expect(bRefs.length).toBeGreaterThan(0);
  });

  it("rejects limit greater than 5", async () => {
    const provider = new ReferenceResearchCapabilityProvider(meridianCorpus);
    const result = await provider.invoke({
      run_id: "t7",
      turn: 1,
      call_id: "c",
      capability_id: RESEARCH_LOOKUP_CAPABILITY_ID,
      input: { query: TAG_CONCURRENCY_SAFETY, limit: 6 },
      timeout_ms: 1000,
    });
    expect(result.status).toBe("FAIL");
  });
});

// ---------------------------------------------------------------------------
// T8 — bounded retrieval
// ---------------------------------------------------------------------------
describe("T8 — bounded retrieval", () => {
  it("every planned SATISFIED-scenario lookup requests at most 5 results", () => {
    for (const step of SATISFIED_STEPS) {
      expect(step.limit ?? 5).toBeLessThanOrEqual(5);
    }
  });

  it("truncates to the requested/default limit even when more matches exist", async () => {
    // Meridian's real fixture corpus only has 4 records, which can never
    // exceed the cap on its own — construct a synthetic 7-record corpus
    // sharing one tag so the cap is genuinely exercised.
    const wideCorpus = Array.from({ length: 7 }, (_, i) => ({
      source_ref: `wide-${i}`,
      title: `Wide Source ${i}`,
      source_type: "SECONDARY" as const,
      authority: "Test Authority",
      independence_group: `group-${i}`,
      observed_or_published_at: "2024-01-01",
      locator: `wide://${i}`,
      excerpt: "excerpt",
      topic_tags: ["shared wide topic"],
    }));
    const provider = new ReferenceResearchCapabilityProvider(wideCorpus);

    const withDefault = await provider.invoke({
      run_id: "t8",
      turn: 1,
      call_id: "a",
      capability_id: RESEARCH_LOOKUP_CAPABILITY_ID,
      input: { query: "shared wide topic" },
      timeout_ms: 1000,
    });
    const withExplicitLimit = await provider.invoke({
      run_id: "t8",
      turn: 1,
      call_id: "b",
      capability_id: RESEARCH_LOOKUP_CAPABILITY_ID,
      input: { query: "shared wide topic", limit: 3 },
      timeout_ms: 1000,
    });

    expect(withDefault.status).toBe("SUCCESS");
    expect(withExplicitLimit.status).toBe("SUCCESS");
    if (withDefault.status !== "SUCCESS" || withExplicitLimit.status !== "SUCCESS") throw new Error("unreachable");
    expect((withDefault.output.results as unknown[]).length).toBe(5);
    expect((withExplicitLimit.output.results as unknown[]).length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// T9-T13, T17-T19, T21-T22 — real verification run assertions
// ---------------------------------------------------------------------------
describe("Real verification run (SATISFIED scenario)", () => {
  it("T9 — Knowledge Gap Analysis is visible", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    expect(data.subquestions.length).toBeGreaterThanOrEqual(1);
    expect(data.subquestions.some((s) => s.gap_class === "DECISION_CRITICAL" || s.gap_class === "DECISION_RELEVANT")).toBe(true);
    for (const sub of data.subquestions) {
      expect(sub.why_it_matters.length).toBeGreaterThan(0);
      expect(sub.decision_affected.length).toBeGreaterThan(0);
    }
  });

  it("T10 — authoritative (PRIMARY) source is preferred when available", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    const finding = data.findings.find((f) => f.id === "finding-sq-1")!;
    expect(finding.evidence.some((e) => e.source_type === "PRIMARY")).toBe(true);
  });

  it("T11 — evidence metadata is complete", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    for (const finding of data.findings) {
      for (const ev of finding.evidence) {
        for (const field of [
          "evidence_ref",
          "source_ref",
          "source_title",
          "source_type",
          "authority",
          "independence_group",
          "observed_or_published_at",
          "locator",
          "relationship",
        ] as const) {
          expect(String(ev[field] ?? "").length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("T12 — every material finding has confidence, epistemic_status, limitations", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    for (const finding of data.findings) {
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(finding.confidence);
      expect(["EVIDENCED", "INFERENCE", "UNCERTAIN"]).toContain(finding.epistemic_status);
      expect(Array.isArray(finding.limitations)).toBe(true);
    }
  });

  it("T13 — STANDARD cross-validation uses independent source groups, not duplicates", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    const finding = data.findings.find((f) => f.id === "finding-sq-1")!;
    const groups = new Set(finding.evidence.map((e) => e.independence_group));
    expect(groups.size).toBeGreaterThanOrEqual(2);
  });

  it("T13 negative — a duplicate/upstream-equivalent pair is NOT counted as independent cross-validation", async () => {
    const definition = materializeResearchTask({ baseDefinition: researcherDefinition, question: SATISFIED_QUESTION });
    const compiled = compileAgentDefinition(definition, {
      model_provider: new DeterministicResearchModelProvider({ steps: SATISFIED_STEPS, buildResult: buildSatisfiedResult }),
      capability_provider: new ReferenceResearchCapabilityProvider(meridianCorpusWithDuplicateIndependenceGroup),
    });
    const result = await runAgent(compiled.run_options);
    const data = result.output?.data as unknown as ResearchResult;
    const finding = data.findings.find((f) => f.id === "finding-sq-1")!;
    const groups = new Set(finding.evidence.map((e) => e.independence_group));

    // Both sources are still returned (2 evidence items)...
    expect(finding.evidence.length).toBe(2);
    // ...but since they share one independence_group, cross-validation is NOT achieved.
    expect(groups.size).toBe(1);
    expect(finding.confidence).toBe("LOW");
    expect(
      finding.limitations.some((l) => l.includes("Independent cross-validation could not be completed")),
    ).toBe(true);
  });

  it("T17 — material contradictions are surfaced, not discarded", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    expect(data.contradictions.length).toBeGreaterThanOrEqual(1);
    const contradiction = data.contradictions[0];
    expect(contradiction.evidence_refs.length).toBeGreaterThanOrEqual(2);
  });

  it("T18 — unresolved unknowns are surfaced without fabricating a finding", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    expect(data.unknowns.length).toBeGreaterThanOrEqual(1);
    expect(data.findings.every((f) => !f.claim.toLowerCase().includes("multi-region"))).toBe(true);
  });

  it("T19 — value-of-information SATISFIED with a non-empty reason", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    expect(data.research_status.state).toBe("SATISFIED");
    expect(data.research_status.additional_research_expected_to_change_decision).toBe(false);
    expect(data.research_status.reason.length).toBeGreaterThan(0);
  });

  it("T21 — StructuredAgentOutput.summary exactly equals data.decision_relevant_summary", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    expect(result.output?.summary).toBe(data.decision_relevant_summary);
  });

  it("T22 — evidence_refs is the deterministic de-duplicated first-occurrence union, no orphans/duplicates", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    const expected: string[] = [];
    const seen = new Set<string>();
    for (const f of data.findings) for (const e of f.evidence) if (!seen.has(e.evidence_ref)) { seen.add(e.evidence_ref); expected.push(e.evidence_ref); }
    for (const c of data.contradictions) for (const r of c.evidence_refs) if (!seen.has(r)) { seen.add(r); expected.push(r); }

    expect(result.output?.evidence_refs).toEqual(expected);
    expect(new Set(result.output?.evidence_refs).size).toBe(result.output?.evidence_refs?.length);
  });

  it("mapResearchResultToStructuredOutput matches the real run's mapping", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    const mapped = mapResearchResultToStructuredOutput(data);
    expect(mapped.summary).toBe(result.output?.summary);
    expect(mapped.evidence_refs).toEqual(result.output?.evidence_refs);
  });
});

// ---------------------------------------------------------------------------
// T14 — unsupported critical claim rejected
// ---------------------------------------------------------------------------
describe("T14 — unsupported critical claim rejected", () => {
  it("rejects a DECISION_CRITICAL + EVIDENCED finding with zero evidence", () => {
    const invalid: ResearchResult = {
      question: "Q",
      subquestions: [],
      findings: [
        {
          id: "f1",
          claim: "Unsupported claim.",
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
    };
    const result = validateResearchResult(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unsupported critical claim"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T15 — explicit inference accepted but visible
// ---------------------------------------------------------------------------
describe("T15 — explicit inference accepted but visible", () => {
  it("accepts a DECISION_CRITICAL + INFERENCE finding with limitations, without converting it to EVIDENCED", () => {
    const value: ResearchResult = {
      question: "Q",
      subquestions: [],
      findings: [
        {
          id: "f1",
          claim: "Inferred claim.",
          criticality: "DECISION_CRITICAL",
          epistemic_status: "INFERENCE",
          evidence: [],
          confidence: "LOW",
          limitations: ["Reasoned from indirect evidence, not directly observed."],
        },
      ],
      contradictions: [],
      unknowns: [],
      research_status: { state: "SATISFIED", reason: "r", unresolved_decision_critical_gaps: [], additional_research_expected_to_change_decision: false },
      decision_relevant_summary: "s",
    };
    const result = validateResearchResult(value);
    expect(result.valid).toBe(true);
    expect(value.findings[0].epistemic_status).toBe("INFERENCE");
  });
});

// ---------------------------------------------------------------------------
// T16 — explicit uncertainty accepted but visible
// ---------------------------------------------------------------------------
describe("T16 — explicit uncertainty accepted but visible", () => {
  it("accepts a DECISION_CRITICAL + UNCERTAIN finding with limitations", () => {
    const value: ResearchResult = {
      question: "Q",
      subquestions: [],
      findings: [
        {
          id: "f1",
          claim: "Uncertain claim.",
          criticality: "DECISION_CRITICAL",
          epistemic_status: "UNCERTAIN",
          evidence: [],
          confidence: "LOW",
          limitations: ["Available evidence is insufficient to support a stronger claim."],
        },
      ],
      contradictions: [],
      unknowns: [],
      research_status: { state: "SATISFIED", reason: "r", unresolved_decision_critical_gaps: [], additional_research_expected_to_change_decision: false },
      decision_relevant_summary: "s",
    };
    const result = validateResearchResult(value);
    expect(result.valid).toBe(true);
  });

  it("still rejects UNCERTAIN with no limitations", () => {
    const value: ResearchResult = {
      question: "Q",
      subquestions: [],
      findings: [
        {
          id: "f1",
          claim: "Uncertain claim without limitations.",
          criticality: "DECISION_CRITICAL",
          epistemic_status: "UNCERTAIN",
          evidence: [],
          confidence: "LOW",
          limitations: [],
        },
      ],
      contradictions: [],
      unknowns: [],
      research_status: { state: "SATISFIED", reason: "r", unresolved_decision_critical_gaps: [], additional_research_expected_to_change_decision: false },
      decision_relevant_summary: "s",
    };
    expect(validateResearchResult(value).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T20 — value-of-information unresolved path
// ---------------------------------------------------------------------------
describe("T20 — value-of-information unresolved path", () => {
  it("returns MORE_RESEARCH_NEEDED with no fabricated finding when the corpus has zero relevant evidence", async () => {
    const definition = materializeResearchTask({ baseDefinition: researcherDefinition, question: UNRESOLVED_QUESTION });
    const compiled = compileAgentDefinition(definition, {
      model_provider: new DeterministicResearchModelProvider({ steps: UNRESOLVED_STEPS, buildResult: buildUnresolvedCriticalGapResult }),
      capability_provider: new ReferenceResearchCapabilityProvider(meridianCorpusWithoutConcurrencyEvidence),
    });
    const result = await runAgent(compiled.run_options);
    expect(result.outcome).toBe("SUCCESS");
    const data = result.output?.data as unknown as ResearchResult;
    expect(data.research_status.state).toBe("MORE_RESEARCH_NEEDED");
    expect(data.research_status.unresolved_decision_critical_gaps.length).toBeGreaterThan(0);
    expect(data.findings).toEqual([]);
    expect(data.unknowns.length).toBeGreaterThanOrEqual(1);
    expect(validateResearchResult(data).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T23 — evidence-dependent result
// ---------------------------------------------------------------------------
describe("T23 — evidence-dependent result", () => {
  it("changes the concurrency-safety finding when the corpus loses independent corroboration", async () => {
    const baseline = await runSatisfiedScenario();
    const baselineData = baseline.output?.data as unknown as ResearchResult;
    const baselineFinding = baselineData.findings.find((f) => f.id === "finding-sq-1")!;

    const modifiedDefinition = materializeResearchTask({ baseDefinition: researcherDefinition, question: SATISFIED_QUESTION });
    const modifiedCompiled = compileAgentDefinition(modifiedDefinition, {
      model_provider: new DeterministicResearchModelProvider({ steps: SATISFIED_STEPS, buildResult: buildSatisfiedResult }),
      capability_provider: new ReferenceResearchCapabilityProvider(meridianCorpusWithoutIndependentCorroboration),
    });
    const modified = await runAgent(modifiedCompiled.run_options);
    const modifiedData = modified.output?.data as unknown as ResearchResult;
    const modifiedFinding = modifiedData.findings.find((f) => f.id === "finding-sq-1")!;

    expect(modifiedFinding.confidence).not.toBe(baselineFinding.confidence);
    expect(modifiedFinding.limitations).not.toEqual(baselineFinding.limitations);
    expect(new Set(modifiedFinding.evidence.map((e) => e.independence_group)).size).toBe(1);
    expect(new Set(baselineFinding.evidence.map((e) => e.independence_group)).size).toBeGreaterThanOrEqual(2);

    // The final answer itself must not be a canned constant (RESEARCHER_AGENT_v1.md
    // "Decision 3"): the finding's claim text and the overall decision_relevant_summary
    // are built from the actual returned excerpts, so removing a source's excerpt from
    // the corpus must change both — not just confidence/limitations metadata.
    expect(modifiedFinding.claim).not.toBe(baselineFinding.claim);
    expect(modifiedData.decision_relevant_summary).not.toBe(baselineData.decision_relevant_summary);
  });

  it("produces a finding claim that literally traces back to the corpus excerpt, not a fixed narrative", async () => {
    const result = await runSatisfiedScenario();
    const data = result.output?.data as unknown as ResearchResult;
    const finding = data.findings.find((f) => f.id === "finding-sq-1")!;
    expect(finding.claim).toContain("per-key locking to guarantee that concurrent writes");
  });
});

// ---------------------------------------------------------------------------
// T24 — provider neutrality
// ---------------------------------------------------------------------------
describe("T24 — provider neutrality", () => {
  const FORBIDDEN = [
    "openai",
    "anthropic",
    "gemini",
    "hermes",
    "notion",
    "better-sqlite3",
    "localreferencememoryprovider",
    "deterministicreferencemodelprovider",
    "referencecapabilityprovider",
    "langgraph",
    "langchain",
  ];

  function collectStrings(value: unknown, acc: string[]): void {
    if (typeof value === "string") acc.push(value);
    else if (Array.isArray(value)) for (const item of value) collectStrings(item, acc);
    else if (value && typeof value === "object") for (const v of Object.values(value)) collectStrings(v, acc);
  }

  it("no forbidden vendor/provider token appears in the Researcher AgentDefinition", () => {
    const strings: string[] = [];
    collectStrings(researcherDefinition, strings);
    const offenders = strings.filter((s) => FORBIDDEN.some((token) => s.toLowerCase().includes(token)));
    expect(offenders).toEqual([]);
  });

  it("no forbidden vendor/provider token appears in the Skill or Quality Contract artifacts", () => {
    const skillText = readFileSync(SKILL_PATH, "utf8").toLowerCase();
    const qcText = readFileSync(QUALITY_CONTRACT_PATH, "utf8").toLowerCase();
    for (const token of FORBIDDEN) {
      expect(skillText.includes(token)).toBe(false);
      expect(qcText.includes(token)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// T25 — memory safety
// ---------------------------------------------------------------------------
describe("T25 — memory safety", () => {
  it("does not permit automatic unverified durable-memory promotion", () => {
    expect(researcherDefinition.memory_policy.commit_verified_memory).toBe(false);
    expect(researcherDefinition.memory_policy.promotion_policy).toBe("EXPLICIT_VERIFIED_ONLY");
  });
});

// ---------------------------------------------------------------------------
// T26 — full regression touch-point
// ---------------------------------------------------------------------------
describe("T26 — full regression touch-point", () => {
  it("S10 reference definitions remain valid and importable alongside the S11 Researcher", () => {
    expect(validateAgentDefinition(referenceResearcher).valid).toBe(true);
    expect(RESEARCH_SKILL_ID).toBe("research.evidence-grounded.s11");
  });
});

// ---------------------------------------------------------------------------
// materializeResearchTask — Intelligence-layer bridge behavior
// ---------------------------------------------------------------------------
describe("materializeResearchTask", () => {
  it("does not mutate the base definition and embeds the question in the objective", () => {
    const before = JSON.stringify(researcherDefinition);
    const materialized = materializeResearchTask({ baseDefinition: researcherDefinition, question: "Does X hold?" });
    expect(JSON.stringify(researcherDefinition)).toBe(before);
    expect(materialized.objective).toContain("Does X hold?");
    expect(materialized.id).not.toBe(researcherDefinition.id);
  });

  it("rejects an empty question", () => {
    expect(() => materializeResearchTask({ baseDefinition: researcherDefinition, question: "   " })).toThrow();
  });
});
