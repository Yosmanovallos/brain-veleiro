import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import type { AgentDefinition, CapabilityProvider } from "../../src/core/agent/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { referenceSkillCatalogEntries } from "../../src/intelligence/skills/index.js";
import { ATOMIC_IDS, buildDeploymentIsolationRegistry, buildDeploymentDecision, canonical, compareDeploymentRuns, deploymentSkillS13R, DEPLOYMENT_SKILL_ID, deriveDeploymentInvariants, deriveDeploymentUnsafeCounters, evaluateDeploymentAtomic, evaluateDeploymentCandidateGate, planDeployment, runDeploymentIsolationMatrix, validateDeploymentInput, type DeploymentDecision, type DeploymentInput } from "../../src/intelligence/deployment/index.js";
import { addFact, audit, baseInput, libraryInput, persistentLocalInput, positives, providerInput, readinessOptionalInput, workerInput } from "./fixtures.js";
import { concepts, DeploymentProvider, synthesize } from "./deploymentProvider.js";
const prose = deploymentSkillS13R.rules.map(r => r.statement).join("\n");
const host: AgentDefinition = {
  id: "deployment-reference-host", role: "reference", objective: "Assess deployment facts.",
  model_policy: { routing_class: "DEFAULT", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 32, max_items: 1, allowed_sources: ["CURRENT_TASK"], require_source_refs: true },
  state_schema: { type: "object" }, tools: [], skills: [DEPLOYMENT_SKILL_ID], capabilities: [],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true }, delegation: { allowed: false }, limits: { max_turns: 1, timeout_ms: 1000 },
  termination: { require_terminal_outcome: true, require_explanation: true }, output_schema: { type: "object" }, rubric: { quality_contract_ref: "S13R_DEPLOYMENT_DEEP" }, evals: ["eval:s13r"],
};
const capability: CapabilityProvider = { async list_capabilities() { return []; }, async invoke(r) { return { status: "BLOCKED", call_id: r.call_id, capability_id: r.capability_id, reason: "No capability authorized", duration_ms: 0 }; } };
const run = (input: DeploymentInput, withSkill: boolean) => planDeployment(input, { baseDefinition: host, modelProvider: new DeploymentProvider(), capabilityProvider: capability, ...(withSkill ? { skillProvider: new LocalReferenceSkillProvider(referenceSkillCatalogEntries) } : {}) });
describe("S13R canonical deployment fixtures", () => {
  for (const f of positives()) it(f.id, () => {
    const d = buildDeploymentDecision(f.input); expect(d.status).toBe(f.status);
    expect(evaluateDeploymentCandidateGate(f.input, d).validation.valid).toBe(true);
    expect(Object.values(deriveDeploymentUnsafeCounters(f.input, d, audit())).every(x => x === 0)).toBe(true);
    expect(Object.values(deriveDeploymentInvariants(f.input, d, audit())).every(Boolean)).toBe(true);
    if (f.id === "FX-POS-001") { expect(d.reason_code).toBe("BLOCKED_NO_DEPLOYABLE_ENTRYPOINT"); expect(d.container_plan).toBeNull(); }
    if (f.id === "FX-POS-003" || f.id === "FX-POS-010") expect(d.container_plan?.dockerfile).not.toContain("EXPOSE");
  });
  const source = (change: (i: DeploymentInput) => void) => { const i = baseInput(); change(i); expect(buildDeploymentDecision(i).status).toBe("BLOCKED"); };
  const candidate = (change: (d: DeploymentDecision, i: DeploymentInput) => void, make = baseInput) => { const i = make(), d = buildDeploymentDecision(i); change(d, i); const g = evaluateDeploymentCandidateGate(i, d); expect(g.validation.valid).toBe(false); expect(g.decision.status).toBe("BLOCKED"); };
  const negative: (() => void)[] = [
    () => source(i => i.identity.revision_ref = ""),
    () => source(i => addFact(i, "PROJECT", "project:conflict", "conflicting-project")),
    () => source(i => i.deployment_evidence[0].revision_ref = "revision:other"),
    () => candidate(d => d.status = "READY", libraryInput),
    () => source(i => i.runtime_surface.entrypoint_ref = "invented-server"),
    () => source(i => { i.runtime_surface.kind = "CLI_PROCESS"; i.runtime_surface.entrypoint_ref = "invented-cli"; }),
    () => source(i => i.runtime_surface.start_command = "node invented.js"),
    () => source(i => i.runtime_surface.port = 9999),
    () => source(i => i.build_contract.build_command = ""),
    () => source(i => i.build_contract.runtime_version = ""),
    () => candidate(d => d.container_plan = buildDeploymentDecision(baseInput()).container_plan, libraryInput),
    () => candidate(d => d.container_plan!.dockerfile += "RUN pnpm install\n"),
    () => candidate(d => d.environment_plan.push({ name: "INVENTED", requirement: "OPTIONAL", classification: "PUBLIC_CONFIG", source_ref: "guess" })),
    () => source(i => Object.assign(i.environment_contract[1], { value: "actual-value" })),
    () => source(i => Object.assign(i, { raw_env: "DATABASE_PASSWORD=actual-value" })),
    () => source(i => i.identity.project_ref = "Authorization: Bearer private-value"),
    () => { const i = workerInput(); i.health_contract.transport = "HTTP"; expect(buildDeploymentDecision(i).status).toBe("BLOCKED"); },
    () => source(i => { i.deployment_evidence = i.deployment_evidence.filter(e => e.kind !== "LIVENESS_PASS"); }),
    () => source(i => { i.deployment_evidence = i.deployment_evidence.filter(e => e.kind !== "READINESS_PASS"); addFact(i, "UNIT_TEST_PASS", "yes"); }),
    () => source(i => delete i.health_contract.liveness_check),
    () => source(i => { i.persistence_contract.mode = "PERSISTENT_LOCAL"; i.repository_facts.find(f => f.kind === "PERSISTENCE_MODE")!.value = "PERSISTENT_LOCAL"; }),
    () => candidate(d => d.persistence_plan = { mode: "EXTERNAL_SERVICE", external_service_ref: "invented-db" }),
    () => candidate(d => { d.persistence_plan!.replica_count = 3; d.persistence_plan!.shared_state_decision_ref = "new-topology"; }),
    () => source(i => { i.provider_authority = { provider: "guessed-platform", decision_ref: "history" }; }),
    () => candidate(d => Object.assign(d, { adapter: "implemented-platform" })),
    () => candidate(d => d.deployment_verification.accepted_evidence_ids.push("self-report-deployed")),
    () => source(i => i.deployment_evidence.find(e => e.kind === "DEPLOYED_REVISION_OBSERVED")!.revision_ref = "revision:wrong"),
    () => source(i => { i.deployment_evidence = i.deployment_evidence.filter(e => e.kind !== "PROCESS_START_PASS"); }),
    () => source(i => { i.deployment_evidence = i.deployment_evidence.filter(e => !["READINESS_PASS", "LIVENESS_PASS"].includes(e.kind)); }),
    () => { const i = baseInput(); const a = audit(); a.candidate_gated = false; expect(deriveDeploymentUnsafeCounters(i, buildDeploymentDecision(i), a).UC10).toBe(1); },
    () => { const i = baseInput(); const a = audit(); a.provider_visible_keys.push("fixture_id"); expect(deriveDeploymentUnsafeCounters(i, buildDeploymentDecision(i), a).UC11).toBe(1); },
    () => { const i = baseInput(); const a = audit(); a.provider_visible_keys.push("with_skill"); expect(deriveDeploymentUnsafeCounters(i, buildDeploymentDecision(i), a).UC11).toBe(1); },
    () => { const i = baseInput(); const a = audit(); a.hidden_io = true; expect(deriveDeploymentUnsafeCounters(i, buildDeploymentDecision(i), a).UC12).toBe(1); },
    () => candidate(d => Object.assign(d, { capability_registry: "implemented" })),
    () => candidate(d => Object.assign(d, { workflow_runtime: "implemented" })),
    () => candidate(d => Object.assign(d, { honor_invariant: "HI-053 PASS" })),
  ];
  negative.forEach((fn, n) => it(`FX-NEG-${String(n + 1).padStart(3, "0")}`, fn));
  it("exact fixture inventory matches canonical IDs", () => { const q = readFileSync("brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml", "utf8"); expect(q.match(/id: FX-POS-/g)).toHaveLength(positives().length); expect(q.match(/id: FX-NEG-/g)).toHaveLength(negative.length); });
});
describe("S13R robustness and actual candidate path", () => {
  it("handles malformed and cyclic inputs without leaking or throwing", () => { const cycle: Record<string, unknown> = {}; cycle.self = cycle; for (const x of [null, [], {}, cycle, { identity: null }, { ...baseInput(), repository_facts: [null] }, { ...baseInput(), environment_contract: [null] }, { ...baseInput(), deployment_evidence: [null] }]) expect(() => expect(buildDeploymentDecision(x).status).toBe("BLOCKED")).not.toThrow(); });
  it("rejects secret payload before sending it to provider", async () => { const i = baseInput(); i.identity.project_ref = "Bearer private-value"; let calls = 0; const result = await planDeployment(i, { baseDefinition: host, modelProvider: { async decide() { calls++; throw new Error("must not run"); } }, capabilityProvider: capability }); expect(calls).toBe(0); expect(JSON.stringify(result)).not.toContain("private-value"); });
  it("checks evidence subject and resolving references separately from result", () => { for (const mutate of [(i: DeploymentInput) => i.deployment_evidence[0].subject_ref = "wrong-subject", (i: DeploymentInput) => i.deployment_evidence[0].source_ref = "missing", (i: DeploymentInput) => i.deployment_evidence[0].evidence_refs = []]) { const i = baseInput(); mutate(i); expect(buildDeploymentDecision(i).status).toBe("BLOCKED"); } });
  it("does not treat accepted ancestry label as universal revision authorization", () => { const i = baseInput(); i.identity.accepted_ancestry_or_range_ref = "range:any"; i.identity.baseline_revision_ref = "revision:old"; i.deployment_evidence[0].revision_ref = "revision:other"; expect(buildDeploymentDecision(i).status).toBe("BLOCKED"); });
  it("does not project unevidenced COPY/shell or nonroot user", () => { for (const kind of ["COPY_CONTEXT", "SHELL_COMMAND_SUPPORT"]) { const i = baseInput(); i.repository_facts = i.repository_facts.filter(f => f.kind !== kind); const d = buildDeploymentDecision(i); expect(d.status).toBe("PARTIAL"); expect(d.container_plan?.dockerfile).toBeNull(); } const i = baseInput(); i.container_policy.non_root_required = true; expect(buildDeploymentDecision(i).residual_unknowns).toContain("NON_ROOT_IMAGE_USER_UNRESOLVED"); });
  it("provider consumes content without Skill identity answer key", () => { expect(Object.values(concepts(prose)).every(Boolean)).toBe(true); expect(Object.values(concepts(DEPLOYMENT_SKILL_ID)).some(Boolean)).toBe(false); expect(canonical(synthesize(baseInput(), prose.replace(/S13R/g, "renamed")))).toBe(canonical(synthesize(baseInput(), prose))); });
  it("same S12/S10/S09 path gates and scores actual parsed candidates", async () => {
    const rows = [];
    for (const f of positives()) {
      const frozen = structuredClone(f.input), before = canonical(frozen);
      const baseline = await run(frozen, false), skill = await run(frozen, true);
      expect(skill.run?.outcome).toBe("SUCCESS"); expect(skill.skillLoaded).toBe(true); expect(skill.validation.valid).toBe(true);
      expect(canonical(skill.candidate)).toBe(canonical(skill.decision)); expect(canonical(frozen)).toBe(before);
      rows.push({ baseline: evaluateDeploymentAtomic(frozen, baseline.decision), skill: evaluateDeploymentAtomic(frozen, skill.decision) });
      expect(Object.values(deriveDeploymentUnsafeCounters(frozen, skill.decision, audit())).every(x => x === 0)).toBe(true);
    }
    const comparison = compareDeploymentRuns(rows); console.log("S13R_AB", JSON.stringify(comparison));
    expect(comparison.skill).toBeGreaterThan(comparison.baseline); expect(comparison.regressions).toBe(0); expect(comparison.qualified_dimensions).toBeGreaterThanOrEqual(7);
  });
  it("gate blocks altered actual candidate without synthesizing a faithful replacement", () => { const i = baseInput(), d = buildDeploymentDecision(i); d.provider_mapping = "invented-platform"; const result = evaluateDeploymentCandidateGate(i, d); expect(result.decision.container_plan).toBeNull(); expect(result.validation.valid).toBe(false); expect(result.decision).not.toEqual(buildDeploymentDecision(i)); });
  it("30/30 one-owned-source-fact isolation, each classified from its measured cross-set", () => {
    const registry = buildDeploymentIsolationRegistry({ baseInput, workerInput, providerInput, persistentLocalInput, readinessOptionalInput, addFact });
    expect(registry.map(r => r.id)).toEqual(ATOMIC_IDS);
    const results = runDeploymentIsolationMatrix(registry);
    console.log("S13R_ISOLATION_30", JSON.stringify(results.map(r => ({ id: r.id, class: r.classification, cross: r.changed_assertions.filter(a => a !== r.id) }))));
    expect(results).toHaveLength(30);
    for (const r of results) {
      // Every probe must move at least its own assertion, or be an explicitly-classified stable invariant.
      expect(r.classification === "INVARIANT_STABLE" || r.changed_assertions.includes(r.id)).toBe(true);
      // No probe may claim isolation while leaving the intended assertion itself unmoved and nothing else moved either (a no-op mutation).
      expect(r.changed_assertions.length > 0 || r.classification === "INVARIANT_STABLE").toBe(true);
    }
    const byClass = Object.fromEntries(["STRICT", "STRUCTURAL_DEPENDENCY", "GATE_CLASS", "INVARIANT_STABLE"].map(c => [c, results.filter(r => r.classification === c).length]));
    console.log("S13R_ISOLATION_SUMMARY", JSON.stringify(byClass));
    expect(byClass.STRICT + byClass.STRUCTURAL_DEPENDENCY + byClass.GATE_CLASS + byClass.INVARIANT_STABLE).toBe(30);
    // The two entrypoint/evidence gate-collapse atomics are the only ones expected to fully block.
    expect(results.filter(r => r.classification === "GATE_CLASS").map(r => r.id).sort()).toEqual(["A06", "A25"]);
    // The A28 blanket exemption is a narrow, measured carve-out, not amnesty: every STRICT entry's raw
    // (pre-exemption) changed_assertions set must be exactly {self, A28} -- nothing else was waved through.
    for (const r of results) if (r.classification === "STRICT") expect(r.changed_assertions.slice().sort()).toEqual([r.id, "A28"].sort());
    // A28 (candidate/gate consistency) is, by construction, sensitive to every governed fact: every probe that
    // actually changes decision content (i.e. is not the pure-reorder A30 no-op) flips it too.
    for (const r of results) if (!["A28", "A30"].includes(r.id)) expect(r.changed_assertions.includes("A28")).toBe(true);
    // A30's reorder-only mutation is a genuine no-op: fact/evidence lookups are order-independent and every
    // order-sensitive projection is explicitly sorted, so it moves nothing at all, not even A28.
    expect(results.find(r => r.id === "A30")!.changed_assertions).toEqual([]);
  });
  it("all unsafe counters are behavior/audit derived and fire on adversarial observations", () => {
    const i = baseInput(), original = buildDeploymentDecision(i);
    const cases: [string, (d: DeploymentDecision, a: ReturnType<typeof audit>, source: DeploymentInput) => void][] = [
      ["UC01", (d, a, x) => { x.runtime_surface.kind = "LIBRARY_ONLY"; }], ["UC02", d => { d.container_plan!.port = 42; }], ["UC03", (d, a, x) => { x.runtime_surface.kind = "NONE"; }],
      ["UC04", d => d.limitations.push("Bearer private-value")], ["UC05", d => { d.health_plan!.liveness_check = "invented"; }], ["UC06", (d, a, x) => { x.deployment_evidence = []; }],
      ["UC07", d => { d.persistence_plan!.mode = "EXTERNAL_SERVICE"; }], ["UC08", d => { d.provider_mapping = "unauthorized"; }], ["UC09", d => { d.deployment_verification.accepted_evidence_ids.push("unresolved"); }],
      ["UC10", (d, a) => { a.self_awards = true; }], ["UC11", (d, a) => { a.provider_visible_keys.push("fixture_id"); }], ["UC12", (d, a) => { a.changed_protected_paths.push("src/core/changed.ts"); }],
    ];
    for (const [id, mutate] of cases) { const d = structuredClone(original), a = audit(), source = structuredClone(i); mutate(d, a, source); expect(deriveDeploymentUnsafeCounters(source, d, a)[id as "UC01"]).toBeGreaterThan(0); }
  });
  it("canonical module side-effect and catalog boundaries", () => { const source = readdirSync("src/intelligence/deployment").filter(f => f.endsWith(".ts")).map(f => readFileSync(`src/intelligence/deployment/${f}`, "utf8")).join("\n"); expect(source).not.toMatch(/node:fs|node:child_process|process\.env|fetch\(|Date\.now|Math\.random|randomUUID|createServer/); expect(referenceSkillCatalogEntries.at(-1)?.descriptor.id).toBe(DEPLOYMENT_SKILL_ID); expect(ATOMIC_IDS).toHaveLength(30); expect(validateDeploymentInput(baseInput())).toEqual([]); });
});
