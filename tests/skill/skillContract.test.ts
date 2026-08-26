import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateSkillDefinition, toSkillDescriptor } from "../../src/core/skill/index.js";
import type { SkillCatalogEntry, SkillDefinition } from "../../src/core/skill/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import {
  referenceSkillCatalogEntries,
  researchEvidenceGroundedS11,
  referenceSummarize,
  referenceFormatCheck,
  selectSkillForTask,
} from "../../src/intelligence/skills/index.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID, RESEARCH_QUALITY_CONTRACT_REF } from "../../src/intelligence/research/researchSkill.js";
import { researcherDefinition } from "../../src/intelligence/agent-definitions/researcherDefinition.js";
import {
  compileAgentDefinition,
  runAgent,
  validateAgentDefinition,
} from "../../src/core/agent/index.js";
import { referenceBuilder } from "../../src/intelligence/agent-definitions/referenceDefinitions.js";
import { DeterministicReferenceModelProvider } from "../../src/providers/model/deterministicReferenceModelProvider.js";
import { ReferenceCapabilityProvider } from "../../src/providers/capability/referenceCapabilityProvider.js";
import { buildValidSkillDefinition, clone } from "./fixtures.js";

const REPO_ROOT = process.cwd();

/** Wraps catalog entries with call-counting loader spies for lazy-loading proofs (T9/T13). */
function instrumentEntries(entries: SkillCatalogEntry[]): { entries: SkillCatalogEntry[]; spies: Map<string, ReturnType<typeof vi.fn>> } {
  const spies = new Map<string, ReturnType<typeof vi.fn>>();
  const instrumented = entries.map((entry) => {
    const spy = vi.fn(entry.load_definition);
    spies.set(entry.descriptor.id, spy);
    return { descriptor: entry.descriptor, load_definition: spy };
  });
  return { entries: instrumented, spies };
}

// ---------------------------------------------------------------------------
// T1 — valid SkillDefinition accepted
// ---------------------------------------------------------------------------
describe("T1 — valid SkillDefinition accepted", () => {
  it("passes deterministic validation", () => {
    const result = validateSkillDefinition(buildValidSkillDefinition());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T2 — malformed required field rejected
// ---------------------------------------------------------------------------
describe("T2 — malformed required field rejected", () => {
  it("rejects empty id", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.id = "";
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects empty version", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.version = "";
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects empty description", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.description = "";
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects a missing procedure", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.procedure = [];
    const result = validateSkillDefinition(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("procedure"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T3 — applies_when validation
// ---------------------------------------------------------------------------
describe("T3 — applies_when validation", () => {
  it("rejects task_kinds=[] and signals=[] together", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.applies_when.task_kinds = [];
    broken.applies_when.signals = [];
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects duplicate applicability values", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.applies_when.signals = ["example", "example"];
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T4 — unique structured IDs
// ---------------------------------------------------------------------------
describe("T4 — unique structured IDs", () => {
  it("rejects duplicate input names", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.inputs.push({ ...broken.inputs[0] });
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects duplicate output names", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.outputs.push({ ...broken.outputs[0] });
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects duplicate rule ids", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.rules.push({ ...broken.rules[0] });
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects duplicate procedure step ids", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.procedure.push({ ...broken.procedure[0] });
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects duplicate verification ids", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.verification.push({ ...broken.verification[0] });
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("rejects duplicate eval refs", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.evals = ["evals/example", "evals/example"];
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T5 — capability permission invariant
// ---------------------------------------------------------------------------
describe("T5 — capability permission invariant", () => {
  it("rejects a required capability absent from permissions.allowed_capabilities", () => {
    const broken = clone(buildValidSkillDefinition());
    broken.requires.capabilities = ["some_capability"];
    broken.permissions.allowed_capabilities = ["a_different_capability"];
    const result = validateSkillDefinition(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("allowed_capabilities"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T6 — S09 side-effect vocabulary reused
// ---------------------------------------------------------------------------
describe("T6 — S09 side-effect vocabulary reused", () => {
  it("accepts only NONE | LOCAL | EXTERNAL", () => {
    const broken = clone(buildValidSkillDefinition());
    (broken.permissions.allowed_side_effects as unknown as string[]) = ["REMOTE"];
    expect(validateSkillDefinition(broken).valid).toBe(false);
  });

  it("accepts the canonical values", () => {
    const value = clone(buildValidSkillDefinition());
    value.permissions.allowed_side_effects = ["NONE", "LOCAL", "EXTERNAL"];
    value.permissions.allowed_capabilities = ["example_capability"];
    expect(validateSkillDefinition(value).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T7 — descriptor projection is metadata-only
// ---------------------------------------------------------------------------
describe("T7 — descriptor projection is metadata-only", () => {
  it("does not expose rules/procedure/verification/full inputs/outputs", () => {
    const descriptor = toSkillDescriptor(researchEvidenceGroundedS11) as unknown as Record<string, unknown>;
    for (const forbiddenKey of ["rules", "procedure", "verification", "inputs", "outputs"]) {
      expect(descriptor).not.toHaveProperty(forbiddenKey);
    }
    expect(Object.keys(descriptor).sort()).toEqual(
      ["applies_when", "description", "id", "quality_contract_refs", "required_capability_ids", "version"].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// T8 — discover is bounded
// ---------------------------------------------------------------------------
describe("T8 — discover is bounded", () => {
  function buildWideCatalog(count: number): SkillCatalogEntry[] {
    return Array.from({ length: count }, (_, i) => {
      const definition: SkillDefinition = {
        ...clone(buildValidSkillDefinition()),
        id: `test.wide.v${i}`,
        applies_when: { task_kinds: ["testing"], signals: ["widecatalog"], exclusions: [] },
      };
      return { descriptor: toSkillDescriptor(definition), load_definition: async () => definition };
    });
  }

  it("returns at most the requested limit", async () => {
    const provider = new LocalReferenceSkillProvider(buildWideCatalog(10));
    const result = await provider.discover({ query: "widecatalog", limit: 2 });
    expect(result.length).toBe(2);
  });

  it("defaults to 5 when no limit is given", async () => {
    const provider = new LocalReferenceSkillProvider(buildWideCatalog(10));
    const result = await provider.discover({ query: "widecatalog" });
    expect(result.length).toBe(5);
  });

  it("bounds a request above the maximum (20) rather than returning the full catalog", async () => {
    const provider = new LocalReferenceSkillProvider(buildWideCatalog(30));
    const result = await provider.discover({ query: "widecatalog", limit: 100 });
    expect(result.length).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// T9 — discovery uses metadata only
// ---------------------------------------------------------------------------
describe("T9 — discovery uses metadata only", () => {
  it("never invokes a full-definition loader during discover()", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);

    await provider.discover({ query: "research evidence" });

    for (const spy of spies.values()) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// T10 — relevant Skill ranks/selects correctly
// ---------------------------------------------------------------------------
describe("T10 — relevant Skill ranks/selects correctly", () => {
  it("ranks the Research Skill above unrelated reference Skills for a research-like query", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await provider.discover({ query: "research question evidence cross-check" });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe(researchEvidenceGroundedS11.id);
  });

  it("ranks a summarization query toward the summarize Skill instead", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await provider.discover({ query: "summarize condense" });
    expect(result[0].id).toBe(referenceSummarize.id);
  });
});

// ---------------------------------------------------------------------------
// T11 — AgentDefinition Skill allowlist enforced
// ---------------------------------------------------------------------------
describe("T11 — AgentDefinition Skill allowlist enforced", () => {
  it("does not select/load the Research Skill when it is outside the Agent's allowlist", async () => {
    const restrictedAgent = clone(researcherDefinition);
    restrictedAgent.skills = [referenceFormatCheck.id];

    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await selectSkillForTask({
      task: "research question evidence cross-check",
      agent_definition: restrictedAgent,
      provider,
    });

    expect(result.discovered.some((d) => d.id === researchEvidenceGroundedS11.id)).toBe(false);
    expect(result.selected?.id).toBe(referenceFormatCheck.id);
    expect(result.loaded?.id).toBe(referenceFormatCheck.id);
  });
});

// ---------------------------------------------------------------------------
// T12 — empty Agent Skill allowlist selects nothing
// ---------------------------------------------------------------------------
describe("T12 — empty Agent Skill allowlist selects nothing", () => {
  it("returns no discovered/selected/loaded Skill and never falls back to the global catalog", async () => {
    const emptyAgent = clone(researcherDefinition);
    emptyAgent.skills = [];

    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const result = await selectSkillForTask({
      task: "research question evidence",
      agent_definition: emptyAgent,
      provider,
    });

    expect(result.discovered).toEqual([]);
    expect(result.selected).toBeUndefined();
    expect(result.loaded).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T13 — load is lazy and exact
// ---------------------------------------------------------------------------
describe("T13 — load is lazy and exact", () => {
  it("calls only the selected loader exactly once; unrelated loaders remain uncalled", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);

    const loaded = await provider.load({ id: researchEvidenceGroundedS11.id });

    expect(loaded.id).toBe(researchEvidenceGroundedS11.id);
    expect(spies.get(researchEvidenceGroundedS11.id)).toHaveBeenCalledTimes(1);
    expect(spies.get(referenceSummarize.id)).not.toHaveBeenCalled();
    expect(spies.get(referenceFormatCheck.id)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T13B — selectSkillForTask never loads every discovered Skill merely to
// rank them (SKILL_CONTRACT_v1.md section 26 / section 37 PASS criterion 9),
// exercised end-to-end through the real, unmodified researcherDefinition.
// ---------------------------------------------------------------------------
describe("T13B — selection loads only the selected Skill, never the whole discovered set", () => {
  it("selects and loads only the Research Skill for the real, unmodified researcherDefinition", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);

    const result = await selectSkillForTask({
      task: "research question evidence cross-check knowledge gap",
      agent_definition: researcherDefinition,
      provider,
    });

    expect(result.selected?.id).toBe(researchEvidenceGroundedS11.id);
    expect(result.loaded?.id).toBe(researchEvidenceGroundedS11.id);
    expect(spies.get(researchEvidenceGroundedS11.id)).toHaveBeenCalledTimes(1);
    expect(spies.get(referenceSummarize.id)).not.toHaveBeenCalled();
    expect(spies.get(referenceFormatCheck.id)).not.toHaveBeenCalled();
  });

  it("with an allowlist covering all three Skills, ranking still loads only the one selected Skill", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);

    const permissiveAgent = clone(researcherDefinition);
    permissiveAgent.skills = [researchEvidenceGroundedS11.id, referenceSummarize.id, referenceFormatCheck.id];

    const result = await selectSkillForTask({
      task: "research question evidence cross-check knowledge gap",
      agent_definition: permissiveAgent,
      provider,
    });

    expect(result.discovered.length).toBe(3);
    expect(result.selected?.id).toBe(researchEvidenceGroundedS11.id);
    expect(result.loaded?.id).toBe(researchEvidenceGroundedS11.id);
    expect(spies.get(researchEvidenceGroundedS11.id)).toHaveBeenCalledTimes(1);
    expect(spies.get(referenceSummarize.id)).not.toHaveBeenCalled();
    expect(spies.get(referenceFormatCheck.id)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T14 — unknown Skill load fails explicitly
// ---------------------------------------------------------------------------
describe("T14 — unknown Skill load fails explicitly", () => {
  it("rejects with a deterministic not-found error, no fuzzy fallback", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    await expect(provider.load({ id: "does.not.exist.v1" })).rejects.toThrow(/Unknown Skill id/);
  });
});

// ---------------------------------------------------------------------------
// T15 — exact-version semantics
// ---------------------------------------------------------------------------
describe("T15 — exact-version semantics", () => {
  it("fails explicitly when the requested version does not match", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    await expect(
      provider.load({ id: researchEvidenceGroundedS11.id, version: "999.0.0" }),
    ).rejects.toThrow(/version mismatch/);
  });

  it("succeeds when the requested version matches exactly", async () => {
    const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
    const loaded = await provider.load({ id: researchEvidenceGroundedS11.id, version: researchEvidenceGroundedS11.version });
    expect(loaded.id).toBe(researchEvidenceGroundedS11.id);
  });
});

// ---------------------------------------------------------------------------
// T16 — loaded Skill is revalidated
// ---------------------------------------------------------------------------
describe("T16 — loaded Skill is revalidated", () => {
  it("rejects a catalog entry whose loader returns a malformed SkillDefinition", async () => {
    const malformed = clone(buildValidSkillDefinition());
    (malformed as unknown as { procedure: unknown[] }).procedure = [];

    const provider = new LocalReferenceSkillProvider([
      { descriptor: toSkillDescriptor(malformed), load_definition: async () => malformed },
    ]);

    await expect(provider.load({ id: malformed.id })).rejects.toThrow(/failed validation/);
  });
});

// ---------------------------------------------------------------------------
// T17 — S11 Research Skill migration preserves protected semantics
// ---------------------------------------------------------------------------
describe("T17 — S11 Research Skill migration preserves protected semantics", () => {
  it("mechanically demonstrates every S11-protected semantic", () => {
    const ruleText = researchEvidenceGroundedS11.rules.map((r) => r.statement.toLowerCase()).join(" ");

    expect(ruleText).toContain("knowledge gap analysis");
    expect(ruleText).toMatch(/evidence/);
    expect(ruleText).toContain("cross-validation");
    expect(ruleText).toContain("contradictory evidence");
    expect(ruleText).toContain("unknown");
    expect(ruleText).toContain("value-of-information");
    expect(ruleText).toMatch(/source identifier|locator|traceability/);

    expect(researchEvidenceGroundedS11.requires.capabilities).toContain(RESEARCH_LOOKUP_CAPABILITY_ID);
    expect(researchEvidenceGroundedS11.permissions.allowed_capabilities).toContain(RESEARCH_LOOKUP_CAPABILITY_ID);
    expect(researchEvidenceGroundedS11.permissions.allowed_side_effects).toEqual(["NONE"]);
    expect(researchEvidenceGroundedS11.requires.quality_contract_refs).toContain(RESEARCH_QUALITY_CONTRACT_REF);

    expect(validateSkillDefinition(researchEvidenceGroundedS11).valid).toBe(true);
  });

  it("preserves brain-bootstrap/skills/RESEARCH_SKILL_S11.md as the canonical semantic source (not moved or replaced)", () => {
    const path = join(REPO_ROOT, "brain-bootstrap", "skills", "RESEARCH_SKILL_S11.md");
    const text = readFileSync(path, "utf8");
    expect(text).toContain("research.evidence-grounded.s11");
    expect(text).toContain("Knowledge Gap Analysis");
  });
});

// ---------------------------------------------------------------------------
// T18 — S10 compile path remains unchanged
// ---------------------------------------------------------------------------
describe("T18 — S10 compile path remains unchanged", () => {
  it("compileAgentDefinition() -> runAgent() still succeeds unmodified for an existing S10 reference definition", async () => {
    const compiled = compileAgentDefinition(referenceBuilder, {
      model_provider: new DeterministicReferenceModelProvider(),
      capability_provider: new ReferenceCapabilityProvider(),
    });
    const result = await runAgent({ ...compiled.run_options, initialWorkingState: { text: "the quick brown fox jumps" } });
    expect(result.outcome).toBe("SUCCESS");
  });
});

// ---------------------------------------------------------------------------
// T19 — Core contains no Skill-name conditionals
// ---------------------------------------------------------------------------
describe("T19 — Core contains no Skill-name conditionals", () => {
  it("finds no Skill-id branching anywhere under src/core/", () => {
    const forbidden = [
      'skill.id === "research.evidence-grounded.s11"',
      "skill.id === 'research.evidence-grounded.s11'",
      'skill.id === "reference.summarize.v1"',
      'skill.id === "reference.format-check.v1"',
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
});

// ---------------------------------------------------------------------------
// T20 — full regression touch-point
// ---------------------------------------------------------------------------
describe("T20 — full regression touch-point", () => {
  it("existing S10 AgentDefinitions remain valid alongside the new Skill Contract", () => {
    expect(validateAgentDefinition(referenceBuilder).valid).toBe(true);
    expect(validateAgentDefinition(researcherDefinition).valid).toBe(true);
  });
});
