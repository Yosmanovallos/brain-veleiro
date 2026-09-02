import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { AgentDefinition, CapabilityProvider } from "../../src/core/agent/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { referenceSkillCatalogEntries } from "../../src/intelligence/skills/index.js";
import {
  DELIVERY_ATOMIC_GATE_CLASS,
  DELIVERY_ATOMIC_IDS,
  DELIVERY_ATOMIC_OWNED_SOURCE,
  DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES,
  DELIVERY_ATOMIC_UNRESOLVED,
  DELIVERY_DIMENSIONS,
  DELIVERY_DOCUMENTATION_DEMO_SKILL_ID,
  buildDeliveryPackage,
  classifyDeliveryAtomicIsolation,
  deliveryDocumentationDemoSkillS13Q,
  deriveDeliverySourceFacts,
  deriveDeliveryUnsafeCounters,
  evaluateDeliveryAtomicObservations,
  evaluateDeliveryCandidateGate,
  isValidSourceFactIsolationEvidence,
  legacyDerivedDecisionMutationEvidence,
  legacyExpectedObservationMutationEvidence,
  legacyIrrelevantMoverEvidence,
  legacyTwoFactEvidence,
  mutateDeliverySourceFact,
  probeDeliveryAtomicSourceFactIsolation,
  planDeliveryDocumentationDemo,
  renderDeliveryPackageMarkdown,
  validateDeliveryCandidate,
  type DeliveryAtomicId,
  type DeliveryDocumentationDemoInput,
  type DeliveryDocumentationDemoResult,
  type DeliveryEvaluationAudit,
  type DeliverySourceFacts,
} from "../../src/intelligence/delivery-documentation-demo/index.js";
import {
  ALL_FEATURES_OFF,
  ALL_FEATURES_ON,
  DeliveryProvider,
  FEATURE_OWNED_SECTION,
  extractDeliveryMethodFeatures,
  synthesizeDeliveryPackage,
  synthesizeDeliveryPackageWithFeatures,
  type DeliveryMethodFeatures,
} from "./deliveryProvider.js";
import { REV, OLD_REV, baseInput, minimalInput, mutate, policy, type MutableInput } from "./fixtures.js";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
class EmptyCapabilityProvider implements CapabilityProvider {
  async list_capabilities() {
    return [];
  }
  async invoke(request: Parameters<CapabilityProvider["invoke"]>[0]) {
    return { status: "BLOCKED" as const, call_id: request.call_id, capability_id: request.capability_id, reason: "no capability authorized", duration_ms: 0 };
  }
}

const host: AgentDefinition = {
  id: "delivery-documentation-demo-harness",
  role: "reference",
  objective: "reference",
  model_policy: { routing_class: "DEFAULT", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 32, max_items: 1, allowed_sources: ["CURRENT_TASK"], require_source_refs: true },
  state_schema: { type: "object" },
  tools: [],
  skills: [DELIVERY_DOCUMENTATION_DEMO_SKILL_ID],
  capabilities: [],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 1, timeout_ms: 1000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" },
  rubric: { quality_contract_ref: "S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP" },
  evals: ["eval:s13q"],
};

const runPlan = (input: DeliveryDocumentationDemoInput, withSkill: boolean) =>
  planDeliveryDocumentationDemo(input, {
    baseDefinition: host,
    ...(withSkill ? { skillProvider: new LocalReferenceSkillProvider(referenceSkillCatalogEntries) } : {}),
    modelProvider: new DeliveryProvider(),
    capabilityProvider: new EmptyCapabilityProvider(),
  });

const fullMethodProse = deliveryDocumentationDemoSkillS13Q.rules.map((r) => r.statement).join("\n");
const S = (v: unknown) => JSON.stringify(v);
const MODULE_FILES = [
  "constants.ts",
  "types.ts",
  "deliveryModel.ts",
  "quality.ts",
  "deliveryDocumentationDemoSkill.ts",
  "planDeliveryDocumentationDemo.ts",
  "index.ts",
] as const;
const implementationSource = () =>
  MODULE_FILES.map((n) => readFileSync(new URL(`../../src/intelligence/delivery-documentation-demo/${n}`, import.meta.url), "utf8")).join("\n");

// ---------------------------------------------------------------------------
// Deterministic mechanics
// ---------------------------------------------------------------------------
describe("S13Q deterministic delivery mechanics", () => {
  it("builds a READY package from a complete, evidence-grounded input and never mutates the input", () => {
    const inp = baseInput();
    const before = S(inp);
    const r = buildDeliveryPackage(inp);
    expect(r.status).toBe("READY");
    expect(r.package).not.toBeNull();
    expect(S(inp)).toBe(before);
    expect(buildDeliveryPackage(null).status).toBe("BLOCKED");
    expect(() => buildDeliveryPackage(undefined)).not.toThrow();
  });

  it("is deterministic: byte-equal inputs give byte-equal results and repeated runs are equal", () => {
    expect(S(buildDeliveryPackage(baseInput()))).toBe(S(buildDeliveryPackage(baseInput())));
    const once = buildDeliveryPackage(baseInput());
    expect(S(once)).toBe(S(buildDeliveryPackage(structuredClone(baseInput()))));
  });

  it("Markdown projection is derivative, deterministic and adds no claim", () => {
    const r = buildDeliveryPackage(baseInput());
    const md = r.package!.optional_markdown_projection!;
    expect(typeof md).toBe("string");
    expect(md).toBe(renderDeliveryPackageMarkdown({ ...r.package!, optional_markdown_projection: null }));
    for (const c of r.package!.executive_summary.delivered) expect(md).toContain(c.text);
    for (const l of r.package!.limitations) expect(md).toContain(l.summary);
    expect(new TextEncoder().encode(md).length).toBeLessThanOrEqual(baseInput().policy.max_rendered_markdown_bytes);
  });

  it("candidate gate recomputes the canonical package rather than trusting a candidate", () => {
    const inp = baseInput();
    const tampered = { ...buildDeliveryPackage(inp), status: "READY" as const };
    (tampered as { coverage: { markdown_bytes: number } }).coverage = { ...tampered.coverage, markdown_bytes: 1 };
    const gated = evaluateDeliveryCandidateGate(inp, tampered);
    expect(gated.decision.status).toBe("BLOCKED");
    expect(gated.candidate).toBe(tampered);
    expect(evaluateDeliveryCandidateGate(inp, buildDeliveryPackage(inp)).decisionValidation.valid).toBe(true);
  });

  it("a policy may lower a ceiling but never raise one", () => {
    expect(buildDeliveryPackage(mutate(baseInput(), (v) => (v.policy = policy({ max_setup_steps: 999 })))).status).toBe("BLOCKED");
    expect(buildDeliveryPackage(mutate(baseInput(), (v) => (v.policy = policy({ max_setup_steps: 4 })))).status).toBe("READY");
  });
});

// ---------------------------------------------------------------------------
// Canonical positive fixtures — exactly 10 (P01..P10)
// ---------------------------------------------------------------------------
function trimmedReady(): DeliveryDocumentationDemoInput {
  return mutate(baseInput(), (v) => {
    v.repository_facts = v.repository_facts.filter((f) => ["rf-name", "rf-feat-parser", "rf-cmd-build", "rf-env-log"].includes(f.fact_id));
  });
}

const positives: Array<[string, () => DeliveryDocumentationDemoInput, DeliveryDocumentationDemoResult["status"], (r: DeliveryDocumentationDemoResult) => void]> = [
  [
    "P01_MINIMAL_VERIFIED_CLI_DELIVERY",
    () => trimmedReady(),
    "READY",
    (r) => {
      expect(r.package!.executive_summary.delivered.some((c) => c.claim_status === "VERIFIED")).toBe(true);
      expect(r.package!.setup_and_run.filter((s) => !s.optional).length).toBeGreaterThanOrEqual(1);
    },
  ],
  [
    "P02_LIBRARY_SETUP_AND_USAGE",
    () =>
      mutate(baseInput(), (v) => {
        v.demo_surface.kind = "LIBRARY_API";
        v.demo_surface.surface_ref = "surface:lib-api";
        v.demo_surface.entry_action_ref = "action:import the public entrypoint from the built package";
        v.demo_surface.steps = [
          { step_ref: "l1", title_ref: "Call the library", action_ref: "action:call the exported build function with a sample input", expected_result_ref: "result:it returns a READY package object", evidence_ref: "ev-demo-run", env_sensitive: false, fallback_ref: "fallback:log the returned status" },
        ];
        v.verification_evidence.push({ evidence_id: "ev-lib-surface", kind: "OTHER_DETERMINISTIC", subject_ref: "surface:lib-api", revision_ref: REV, status: "PASS", summary_ref: "sum:entrypoint exported", source_ref: "src:repo-scan" });
      }),
    "READY",
    (r) => {
      expect(r.package!.demo_script[0].action).toContain("import the public entrypoint");
      expect(r.package!.demo_script[0].evidence_refs).toEqual(["ev-lib-surface"]);
      expect(r.package!.setup_and_run.some((s) => s.command_or_action === "npm run build")).toBe(true);
    },
  ],
  [
    "P03_EXISTING_UI_DEMO_WITH_FALLBACK",
    () =>
      mutate(baseInput(), (v) => {
        v.demo_surface.kind = "LOCAL_UI";
        v.demo_surface.surface_ref = "surface:local-ui";
        v.demo_surface.entry_action_ref = "action:open the already-built local ui bundle in a file viewer";
        v.demo_surface.steps = [
          { step_ref: "u1", title_ref: "Render the report view", action_ref: "action:load the report view from the built bundle", expected_result_ref: "result:the report view lists the delivered claims", evidence_ref: "ev-demo-run", env_sensitive: false, fallback_ref: "fallback:open the static snapshot instead" },
          { step_ref: "u2", title_ref: "Exercise the environment-sensitive filter", action_ref: "action:apply the date filter that reads the host locale", expected_result_ref: "result:the filtered list is a subset of the full list", evidence_ref: "ev-demo-run", env_sensitive: true, fallback_ref: "fallback:skip when the host locale is unavailable" },
        ];
        v.verification_evidence.push({ evidence_id: "ev-ui-surface", kind: "OTHER_DETERMINISTIC", subject_ref: "surface:local-ui", revision_ref: REV, status: "PASS", summary_ref: "sum:ui bundle present", source_ref: "src:repo-scan" });
      }),
    "READY",
    (r) => {
      const envStep = r.package!.demo_script.find((d) => d.title.includes("environment-sensitive"))!;
      expect(envStep.fallback_or_stop_condition).toBe("fallback:skip when the host locale is unavailable");
      expect(r.package!.demo_script.every((d) => d.fallback_or_stop_condition.length > 0)).toBe(true);
    },
  ],
  [
    "P04_API_CONTRACT_DOC_WITHOUT_LIVE_SERVER_CLAIM",
    () =>
      mutate(baseInput(), (v) => {
        v.demo_surface.kind = "DOCUMENTED_INSPECTION";
        v.demo_surface.entry_action_ref = "action:read the generated api contract document";
        v.demo_surface.steps = [
          { step_ref: "d1", title_ref: "Inspect the contract", action_ref: "action:open the contract file", expected_result_ref: "result:the documented endpoints match the module", evidence_ref: "ev-demo-run", env_sensitive: false, fallback_ref: "fallback:diff against the previous revision" },
        ];
      }),
    "READY",
    (r) => expect(r.blockers.some((b) => b.code === "DEMO_CREATES_RUNTIME")).toBe(false),
  ],
  [
    "P05_PARTIAL_OPTIONAL_ARCHITECTURE_DETAIL",
    () => mutate(baseInput(), (v) => delete v.architecture_facts),
    "PARTIAL",
    (r) => {
      expect(r.package!.architecture_summary.present).toBe(false);
      expect(r.warnings.some((w) => w.code === "PARTIAL_SECTION" && /architecture/.test(w.detail))).toBe(true);
    },
  ],
  [
    "P06_KNOWN_LIMITATIONS_EXPLICIT",
    () =>
      mutate(baseInput(), (v) =>
        v.limitations!.push({ limitation_id: "lim-perf", summary: "large inputs are slow to render", severity: "HIGH", impact: "rendering a 200-fact package takes seconds", status: "KNOWN", source_refs: ["src:bench"] }),
      ),
    "READY",
    (r) => expect(r.package!.limitations.map((l) => l.limitation_id)).toContain("lim-perf"),
  ],
  [
    "P07_MULTIPLE_EVIDENCE_SOURCES_WITH_PRECEDENCE",
    () =>
      mutate(baseInput(), (v) => {
        v.verification_evidence.push({ evidence_id: "ev-flaky-pass", kind: "TEST", subject_ref: "flaky:integration", revision_ref: REV, status: "PASS", summary_ref: "sum:green once", source_ref: "src:ci" });
        v.verification_evidence.push({ evidence_id: "ev-flaky-fail", kind: "TEST", subject_ref: "flaky:integration", revision_ref: REV, status: "FAIL", summary_ref: "sum:red once", source_ref: "src:ci" });
      }),
    "READY",
    (r) => {
      expect(r.package!.provenance.conflict_notes.length).toBeGreaterThanOrEqual(1);
      expect(r.warnings.some((w) => w.code === "EVIDENCE_CONFLICT")).toBe(true);
    },
  ],
  [
    "P08_NEXT_STEPS_INCLUDE_S13R_AS_PROPOSED_ONLY",
    () => baseInput(),
    "READY",
    (r) => {
      const s13r = r.package!.next_steps.find((n) => /S13R|deployment/.test(n.summary))!;
      expect(s13r.status).toBe("PROPOSED");
      expect(r.blockers.some((b) => b.code.includes("S13R"))).toBe(false);
    },
  ],
  [
    "P09_SAFE_ENV_VARIABLE_NAMES_WITHOUT_VALUES",
    () => baseInput(),
    "READY",
    (r) => {
      const cmd = r.package!.setup_and_run.map((s) => s.command_or_action).join(" ");
      expect(cmd).toContain("BRAIN_LOG_LEVEL");
      expect(r.blockers.some((b) => b.code === "INVENTED_ENV_VARIABLE")).toBe(false);
      expect(S(r)).not.toMatch(/bearer |authorization[:=]|api[_-]?key[:=]|sk-[a-z0-9]{12}/i);
    },
  ],
  [
    "P10_DETERMINISTIC_MARKDOWN_PROJECTION",
    () => baseInput(),
    "READY",
    (r) => {
      expect(typeof r.package!.optional_markdown_projection).toBe("string");
      const a = buildDeliveryPackage(baseInput()).package!.optional_markdown_projection;
      const b = buildDeliveryPackage(baseInput()).package!.optional_markdown_projection;
      expect(a).toBe(b);
    },
  ],
];

const QC = readFileSync(new URL("../../brain-bootstrap/quality-contracts/S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml", import.meta.url), "utf8");

describe("S13Q canonical positive fixtures — 10/10", () => {
  it("declares exactly the ten positive ids the quality contract names", () => {
    expect(positives).toHaveLength(10);
    expect(positives.map(([id]) => id.slice(0, 3))).toEqual(Array.from({ length: 10 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`));
    for (const [id] of positives) expect(QC).toContain(id);
  });
  it.each(positives)("%s runs the real gate path to its exact status with governing behaviour", async (_id, make, status, extra) => {
    const inp = make();
    const direct = buildDeliveryPackage(inp);
    expect(direct.status).toBe(status);
    extra(direct);
    const out = await runPlan(inp, true);
    expect(out.decision.status).toBe(status);
    expect(out.decisionValidation.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Canonical negative inventory — exactly 40 (N01..N40)
// ---------------------------------------------------------------------------
const hasBlocker = (r: DeliveryDocumentationDemoResult, code: string) => {
  expect(r.status).toBe("BLOCKED");
  expect(r.blockers.map((b) => b.code)).toContain(code);
};
const build = (fn: (v: MutableInput) => void) => buildDeliveryPackage(mutate(baseInput(), fn));

const negatives: Array<[string, () => void]> = [
  ["N01_MISSING_DELIVERY_REVISION", () => hasBlocker(build((v) => (v.delivery_identity.revision_ref = "")), "MISSING_DELIVERY_REVISION")],
  ["N02_CONFLICTING_DELIVERY_REVISION", () => hasBlocker(build((v) => { delete v.delivery_identity.accepted_ancestry_or_range_ref; delete v.delivery_identity.baseline_revision_ref; v.demo_surface.revision_ref = OLD_REV; }), "CONFLICTING_DELIVERY_REVISION")],
  ["N03_CLAIM_BOUND_TO_WRONG_REVISION", () => hasBlocker(build((v) => { delete v.delivery_identity.accepted_ancestry_or_range_ref; delete v.delivery_identity.baseline_revision_ref; v.repository_facts[1].revision_ref = OLD_REV; }), "CLAIM_BOUND_TO_WRONG_REVISION")],
  ["N04_ROADMAP_FEATURE_CLAIMED_IMPLEMENTED", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-road", kind: "KNOWN_FEATURE", subject_ref: "feat:road", value: "a planned feature", source_ref: "src:roadmap.md", revision_ref: REV, confidence: "REPORTED", asserts_status: "IMPLEMENTED" })), "ROADMAP_FEATURE_CLAIMED_IMPLEMENTED")],
  ["N05_TEST_NAME_USED_AS_IMPLEMENTATION_PROOF", () => hasBlocker(build((v) => { v.repository_facts.push({ fact_id: "rf-tn", kind: "KNOWN_FEATURE", subject_ref: "feat:tn", value: "claimed via a test file name", source_ref: "src:notes", revision_ref: REV, confidence: "ACCEPTED", asserts_status: "VERIFIED" }); v.repository_facts.push({ fact_id: "rf-tnf", kind: "FILE_OR_DIRECTORY", subject_ref: "feat:tn", value: "src/featTn.test.ts", source_ref: "src:tree", revision_ref: REV, confidence: "ACCEPTED" }); }), "TEST_NAME_USED_AS_IMPLEMENTATION_PROOF")],
  ["N06_UNSUPPORTED_VERIFIED_CLAIM", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-uv", kind: "KNOWN_FEATURE", subject_ref: "feat:uv", value: "asserted verified with nothing behind it", source_ref: "src:module", revision_ref: REV, confidence: "ACCEPTED", asserts_status: "VERIFIED" })), "UNSUPPORTED_VERIFIED_CLAIM")],
  ["N07_PRODUCTION_READY_WITHOUT_EVIDENCE", () => hasBlocker(build((v) => (v.repository_facts[1].value = "the parser is production-ready and fully tested")), "PRODUCTION_READINESS_OVERCLAIM")],
  ["N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER", () => { const r = build((v) => v.architecture_facts!.push({ fact_id: "af-p", kind: "COMPONENT", subject_ref: "comp:p", value: "introduce a new provider for caching", source_ref: "src:idea", revision_ref: REV })); hasBlocker(r, "NEW_ARCHITECTURE_DECISION"); expect(r.blockers.some((b) => /provider/.test(b.detail))).toBe(true); }],
  ["N09_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_DATABASE", () => { const r = build((v) => v.architecture_facts!.push({ fact_id: "af-db", kind: "COMPONENT", subject_ref: "comp:db", value: "adopt PostgreSQL as the new database", source_ref: "src:idea", revision_ref: REV })); hasBlocker(r, "NEW_ARCHITECTURE_DECISION"); expect(r.blockers.some((b) => /database/.test(b.detail))).toBe(true); }],
  ["N10_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_AGENT", () => { const r = build((v) => v.architecture_facts!.push({ fact_id: "af-ag", kind: "COMPONENT", subject_ref: "comp:ag", value: "introduce a new verifier agent to check output", source_ref: "src:idea", revision_ref: REV })); hasBlocker(r, "NEW_ARCHITECTURE_DECISION"); expect(r.blockers.some((b) => /agent/.test(b.detail))).toBe(true); }],
  ["N11_SETUP_COMMAND_NOT_IN_EVIDENCE", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-rep", kind: "PACKAGE_SCRIPT", subject_ref: "script:rep", value: "npm run frobnicate", source_ref: "src:hearsay", revision_ref: REV, confidence: "REPORTED", setup_role: "REQUIRED", expected_signal_ref: "signal:something" })), "SETUP_COMMAND_NOT_IN_EVIDENCE")],
  ["N12_INVENTED_ENV_VARIABLE", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-ev", kind: "COMMAND", subject_ref: "cmd:ev", value: "run with $UNDECLARED_TOKEN set", source_ref: "src:x", revision_ref: REV, confidence: "ACCEPTED" })), "INVENTED_ENV_VARIABLE")],
  ["N13_INVENTED_PORT", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-pt", kind: "COMMAND", subject_ref: "cmd:pt", value: "serve --port 9137", source_ref: "src:x", revision_ref: REV, confidence: "ACCEPTED" })), "INVENTED_PORT")],
  ["N14_INVENTED_URL", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-url", kind: "COMMAND", subject_ref: "cmd:url", value: "curl https://invented.example/health", source_ref: "src:x", revision_ref: REV, confidence: "ACCEPTED" })), "INVENTED_URL")],
  ["N15_INVENTED_PATH", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-pp", kind: "COMMAND", subject_ref: "cmd:pp", value: "cp /opt/app/data/seed ./local", source_ref: "src:x", revision_ref: REV, confidence: "ACCEPTED" })), "INVENTED_PATH")],
  ["N16_REQUIRED_SETUP_EXPECTED_SIGNAL_MISSING", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-ns", kind: "PACKAGE_SCRIPT", subject_ref: "script:ns", value: "npm run migrate", source_ref: "src:package.json", revision_ref: REV, confidence: "VERIFIED", setup_role: "REQUIRED" })), "SETUP_EXPECTED_SIGNAL_MISSING")],
  ["N17_DEMO_SURFACE_DOES_NOT_EXIST", () => hasBlocker(build((v) => (v.demo_surface.exists = false)), "DEMO_SURFACE_DOES_NOT_EXIST")],
  ["N18_DEMO_STEP_EXPECTED_RESULT_UNSUPPORTED", () => hasBlocker(build((v) => { v.demo_surface.steps![0].evidence_ref = undefined; }), "DEMO_RESULT_UNSUPPORTED")],
  ["N19_ENV_SENSITIVE_DEMO_WITHOUT_FALLBACK", () => hasBlocker(build((v) => { v.demo_surface.steps![1].fallback_ref = undefined; }), "DEMO_FALLBACK_MISSING")],
  ["N20_DEMO_CREATES_NEW_SERVER_RUNTIME", () => hasBlocker(build((v) => (v.demo_surface.entry_action_ref = "action:start a new server and listen on port 8080")), "DEMO_CREATES_RUNTIME")],
  ["N21_DEMO_CREATES_BROWSER_AUTOMATION", () => hasBlocker(build((v) => (v.demo_surface.steps![0].action_ref = "action:drive the ui with playwright and capture a screenshot")), "DEMO_CREATES_BROWSER_AUTOMATION")],
  ["N22_DEMO_PROMISES_SKIPPED_OR_FAILED_BEHAVIOR", () => { const r = build((v) => { v.verification_evidence.push({ evidence_id: "ev-skip", kind: "DEMO_PROOF", subject_ref: "demo:skip", revision_ref: REV, status: "SKIPPED", summary_ref: "sum:not run", source_ref: "src:ci" }); v.demo_surface.steps![0].evidence_ref = "ev-skip"; }); hasBlocker(r, "DEMO_EXCEEDS_EVIDENCE"); }],
  ["N23_KNOWN_MATERIAL_LIMITATION_OMITTED", () => hasBlocker(build((v) => { v.limitations!.push({ limitation_id: "lim-hi", summary: "auth is not enforced on the admin route", severity: "HIGH", impact: "unauthenticated access", status: "KNOWN", source_refs: ["src:audit"] }); v.policy = policy({ suppress_limitation_ids: ["lim-hi"] }); }), "MATERIAL_LIMITATION_HIDDEN")],
  ["N24_LIMITATION_CONTRADICTED_BY_SUMMARY", () => hasBlocker(build((v) => v.limitations!.push({ limitation_id: "lim-contra", summary: "the parser rejects valid inputs", severity: "HIGH", impact: "false negatives", status: "KNOWN", source_refs: ["src:bug"], contradicts_subject_ref: "feat:parser" })), "LIMITATION_CONTRADICTED")],
  ["N25_UNVERIFIED_AREA_PRESENTED_AS_PASS", () => { const r = build((v) => { v.verification_evidence.push({ evidence_id: "ev-ne", kind: "TEST", subject_ref: "feat:ne", revision_ref: REV, status: "NOT_EVALUATED", summary_ref: "sum:pending", source_ref: "src:ci" }); v.repository_facts.push({ fact_id: "rf-ne", kind: "KNOWN_FEATURE", subject_ref: "feat:ne", value: "claimed verified via a not-evaluated check", source_ref: "src:module", revision_ref: REV, confidence: "ACCEPTED", asserts_status: "VERIFIED", evidence_ref: "ev-ne" }); }); hasBlocker(r, "UNVERIFIED_PRESENTED_AS_PASS"); }],
  ["N26_NEXT_STEP_PRESENTED_AS_IMPLEMENTED", () => hasBlocker(build((v) => (v.next_step_candidates![1].claims_completed = true)), "NEXT_STEP_PRESENTED_AS_IMPLEMENTED")],
  ["N27_S13R_DEPLOYMENT_PULLED_FORWARD", () => hasBlocker(build((v) => v.repository_facts.push({ fact_id: "rf-dep", kind: "PACKAGE_SCRIPT", subject_ref: "script:dep", value: "build the dockerfile and run the deployment pipeline", source_ref: "src:package.json", revision_ref: REV, confidence: "VERIFIED", setup_role: "REQUIRED", expected_signal_ref: "signal:deployed" })), "S13R_DEPLOYMENT_PULLED_FORWARD")],
  ["N28_S14_CAPABILITY_MCP_PULLED_FORWARD", () => hasBlocker(build((v) => v.architecture_facts!.push({ fact_id: "af-mcp", kind: "COMPONENT", subject_ref: "comp:mcp", value: "the module ships an mcp server and a connector binding", source_ref: "src:module", revision_ref: REV })), "S14_CAPABILITY_PULLED_FORWARD")],
  ["N29_S15_VERIFIER_AGENT_PULLED_FORWARD", () => hasBlocker(build((v) => v.architecture_facts!.push({ fact_id: "af-wf", kind: "COMPONENT", subject_ref: "comp:wf", value: "an embedded workflow runtime and orchestrator implementation", source_ref: "src:module", revision_ref: REV })), "S15_VERIFIER_PULLED_FORWARD")],
  ["N30_BROKEN_EVIDENCE_REF", () => hasBlocker(build((v) => (v.repository_facts[1].evidence_ref = "ev-nonexistent")), "EVIDENCE_REF_UNRESOLVED")],
  ["N31_PROSE_CITATION_SUBSTITUTES_MISSING_EVIDENCE", () => { const r = build((v) => v.repository_facts.push({ fact_id: "rf-pc", kind: "KNOWN_FEATURE", subject_ref: "feat:pc", value: "trust me it works", source_ref: "see the test suite for details", revision_ref: REV, confidence: "ACCEPTED", asserts_status: "VERIFIED" })); hasBlocker(r, "PROSE_CITATION_NOT_EVIDENCE"); }],
  ["N32_LOWER_PRECEDENCE_FACT_OVERWRITES_TEST_FAILURE", () => hasBlocker(build((v) => { v.verification_evidence.push({ evidence_id: "ev-xfail", kind: "TEST", subject_ref: "feat:xp", revision_ref: REV, status: "FAIL", summary_ref: "sum:red", source_ref: "src:ci" }); v.repository_facts.push({ fact_id: "rf-xp", kind: "KNOWN_FEATURE", subject_ref: "feat:xp", value: "caller says it passes", source_ref: "src:hearsay", revision_ref: REV, confidence: "REPORTED", asserts_status: "VERIFIED" }); }), "PRECEDENCE_VIOLATION")],
  ["N33_SECRET_VALUE_IN_SETUP", () => { const r = build((v) => v.repository_facts.push({ fact_id: "rf-sec", kind: "COMMAND", subject_ref: "cmd:sec", value: "export API_KEY=sk-abcdef1234567890zzz && npm start", source_ref: "src:x", revision_ref: REV, confidence: "ACCEPTED" })); hasBlocker(r, "SECRET_MATERIAL"); expect(S(r)).not.toContain("sk-abcdef1234567890zzz"); }],
  ["N34_AUTH_HEADER_VALUE_IN_DEMO", () => { const r = build((v) => (v.demo_surface.steps![0].action_ref = "action:call with header Authorization: Bearer abcdefghijklmnopqrstuvwx")); hasBlocker(r, "SECRET_MATERIAL"); expect(S(r)).not.toContain("abcdefghijklmnopqrstuvwx"); }],
  ["N35_RAW_ENV_FILE_CONTENT", () => hasBlocker(build((v) => (v.limitations![0].impact = "config left in place:\nDATABASE_URL=postgres://h/db\nLOG_LEVEL=debug\nFEATURE_X=on")), "RAW_ENV_CONTENT")],
  ["N36_RAW_LOG_OR_PROVIDER_ERROR_COPIED", () => hasBlocker(build((v) => (v.limitations![1].impact = "provider dump:\n    at Object.run (/srv/app/x.js:44:19)\n    at main (/srv/app/y.js:2:3)")), "RAW_LOG_MATERIAL")],
  ["N37_NONDETERMINISTIC_TIMESTAMP_INSERTED", () => { const inp = baseInput(); const cand = structuredClone(buildDeliveryPackage(inp)) as DeliveryDocumentationDemoResult; cand.warnings.push({ code: "GENERATED_AT", detail: "generated 2026-09-01T12:00:00Z" }); const g = evaluateDeliveryCandidateGate(inp, cand); expect(g.decisionValidation.valid).toBe(false); expect(g.decisionValidation.errors.join(" ")).toMatch(/nondeterministic timestamp/); expect(g.decision.status).toBe("BLOCKED"); }],
  ["N38_RANDOM_ORDERING", () => { const inp = baseInput(); const cand = structuredClone(buildDeliveryPackage(inp)) as DeliveryDocumentationDemoResult; cand.package!.evidence_index.reverse(); const g = evaluateDeliveryCandidateGate(inp, cand); expect(g.decisionValidation.valid).toBe(false); expect(g.decisionValidation.errors.join(" ")).toMatch(/package diverges/); expect(g.decision.status).toBe("BLOCKED"); }],
  ["N39_CANDIDATE_SELF_AWARDS_HI052", () => { const inp = baseInput(); const cand = structuredClone(buildDeliveryPackage(inp)) as DeliveryDocumentationDemoResult; cand.warnings.push({ code: "SELF", detail: "HI-052 awarded and step closure granted by this candidate" }); const g = evaluateDeliveryCandidateGate(inp, cand); expect(g.decisionValidation.valid).toBe(false); expect(g.decisionValidation.errors.join(" ")).toMatch(/self-certifies/); expect(validateDeliveryCandidate(cand, inp).valid).toBe(false); }],
  ["N40_HIDDEN_FILESYSTEM_NETWORK_OR_ENV_LOOKUP", () => { const src = implementationSource(); expect(src).not.toMatch(/from ["'][^"']*(?:node:fs|node:net|node:http|node:dns|undici|axios)|child_process|\bfetch\s*\(|process\.env|Date\.now\(\)|new Date\(\)|Math\.random/); }],
];

describe("S13Q canonical negative inventory — 40/40", () => {
  it("declares exactly the forty negative ids the quality contract names", () => {
    expect(negatives).toHaveLength(40);
    expect(negatives.map(([id]) => id.slice(0, 3))).toEqual(Array.from({ length: 40 }, (_, i) => `N${String(i + 1).padStart(2, "0")}`));
    expect(new Set(negatives.map(([id]) => id)).size).toBe(40);
    for (const [id] of negatives) expect(QC, id).toContain(id);
  });
  it.each(negatives)("%s triggers its named governing failure", (_id, probe) => probe());
});

// ---------------------------------------------------------------------------
// One-governing-source causal isolation — exactly 30, reconciled to
// brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_1.md. One shared raw
// {input,audit} model, one governing fact mutated per probe, real
// validateDeliveryInput/buildDeliveryPackage rerun, all 30 observations
// recomputed. 15 STRICT / 7 STRUCTURAL_DEPENDENCY (exact producer fan-out) /
// 7 GATE_CLASS (fail-closed safety) / 1 FAIL (A09 — reported semantic gap).
// ---------------------------------------------------------------------------
const ISO_STRICT: DeliveryAtomicId[] = ["A02", "A07", "A08", "A10", "A11", "A14", "A15", "A17", "A18", "A19", "A22", "A24", "A28", "A29", "A30"];
const ISO_STRUCTURAL: DeliveryAtomicId[] = ["A01", "A03", "A05", "A06", "A16", "A20", "A23"];
const ISO_GATE: DeliveryAtomicId[] = ["A04", "A12", "A13", "A21", "A25", "A26", "A27"];
const ISO_FAIL: DeliveryAtomicId[] = ["A09"];

// Exact measured cross set per STRUCTURAL_DEPENDENCY atomic (siblings only).
const ISO_STRUCTURAL_CROSS: Record<string, DeliveryAtomicId[]> = {
  A01: ["A24"],
  A03: ["A05"],
  A05: ["A03", "A24"],
  A06: ["A03"],
  A16: ["A18"],
  A20: ["A19"],
  A23: ["A22"],
};

// Each GATE_CLASS atomic's independently-fireable unsafe counter driver + the
// canonical negative fixture id that exercises the same governing condition.
const ISO_GATE_COUNTER_DRIVER: Record<string, (truth: DeliveryDocumentationDemoResult, inp: DeliveryDocumentationDemoInput) => { decision: DeliveryDocumentationDemoResult; inp: DeliveryDocumentationDemoInput; key: keyof ReturnType<typeof deriveDeliveryUnsafeCounters> }> = {
  A04: (truth, inp) => { const c = structuredClone(truth); c.package!.executive_summary.delivered.push({ claim_id: "x", subject_ref: "feat:ghost", text: "t", claim_status: "VERIFIED" as never, evidence_refs: [] }); return { decision: c, inp, key: "UC01_unsupported_implemented_or_verified_claim" }; },
  A12: (truth, inp) => { const c = structuredClone(truth); c.package!.setup_and_run.push({ step_id: "s99", purpose: "p", command_or_action: "serve --port 9999", precondition_refs: [], expected_signal: "", evidence_refs: [], optional: true }); return { decision: c, inp, key: "UC02_invented_setup_command_or_environment_detail" }; },
  A13: (_truth, inp) => { const badDemo = structuredClone(buildDeliveryPackage(mutate(inp, (v) => (v.demo_surface.exists = true)))); const inpNo = mutate(inp, (v) => (v.demo_surface.exists = false)); return { decision: badDemo, inp: inpNo, key: "UC03_nonexistent_demo_surface_or_result" }; },
  A21: (truth, inp) => { const c = structuredClone(truth); c.package!.demo_script.push({ step_id: "d9", title: "t", precondition_refs: [], action: "spin up a new server", expected_observable_result: "r", evidence_refs: [], fallback_or_stop_condition: "f" }); return { decision: c, inp, key: "UC09_future_stage_pull_forward" }; },
  A25: (truth, inp) => { const c = structuredClone(truth); c.package!.setup_and_run[0].command_or_action = "curl -H 'authorization: Bearer abcdefghijklmnop12'"; return { decision: c, inp, key: "UC06_secret_or_raw_sensitive_material_emitted" }; },
  A26: (truth, inp) => { const c = structuredClone(truth); c.package!.setup_and_run.push({ step_id: "s98", purpose: "p", command_or_action: "serve --port 9999", precondition_refs: [], expected_signal: "", evidence_refs: [], optional: true }); return { decision: c, inp, key: "UC02_invented_setup_command_or_environment_detail" }; },
  A27: (truth, inp) => { const c = structuredClone(truth); c.package!.setup_and_run[0].command_or_action = "curl -H 'authorization: Bearer abcdefghijklmnop12'"; return { decision: c, inp, key: "UC06_secret_or_raw_sensitive_material_emitted" }; },
};

const zeroAuditIso = { hidden_io_or_clock: false, self_certified: false, core_or_contract_changed: false };

describe("S13Q one-governing-source isolation — 30/30 (erratum reconciled)", () => {
  it("maps 30 assertion ids across the 10 declared semantic dimensions; QC + erratum name each", () => {
    expect(DELIVERY_ATOMIC_IDS).toHaveLength(30);
    expect(Object.values(DELIVERY_DIMENSIONS).flat().sort()).toEqual([...DELIVERY_ATOMIC_IDS].sort());
    const qc = readFileSync(new URL("../../brain-bootstrap/quality-contracts/S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml", import.meta.url), "utf8");
    for (const id of DELIVERY_ATOMIC_IDS) expect(qc).toContain(`${id}:`);
    const erratum = readFileSync(new URL("../../brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_1.md", import.meta.url), "utf8");
    expect(erratum).toContain("S13Q-ERRATUM-001");
    for (const id of ["A03", "A09", "A13"]) expect(erratum).toContain(id);
  });

  it("declares 30 pairwise-distinct owned raw source fields AND 30 pairwise-distinct governing path sets", () => {
    const owned = DELIVERY_ATOMIC_IDS.map((id) => DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact);
    expect(owned).toHaveLength(30);
    expect(new Set(owned).size).toBe(30);
    const gpaths = DELIVERY_ATOMIC_IDS.map((id) => DELIVERY_ATOMIC_OWNED_SOURCE[id].governing_paths.join("|"));
    expect(new Set(gpaths).size).toBe(30);
    for (const id of DELIVERY_ATOMIC_IDS) {
      const os = DELIVERY_ATOMIC_OWNED_SOURCE[id];
      expect(os.governing_paths.length, id).toBeGreaterThan(0);
      expect(os.governing_paths.every((p) => p.startsWith("input.") || p.startsWith("audit.")), `${id} ${S(os.governing_paths)}`).toBe(true);
      expect(typeof os.governing_reason, id).toBe("string");
      expect(os.governing_reason.length, id).toBeGreaterThan(20);
      expect(/\b(decision|package|coverage|blockers|warnings|expected_observation|correct)\b/.test(os.owned_fact), os.owned_fact).toBe(false);
    }
  });

  it("partitions the 30 into 15 STRICT + 7 STRUCTURAL_DEPENDENCY + 7 GATE_CLASS + 1 FAIL(A09)", () => {
    expect([...ISO_STRICT, ...ISO_STRUCTURAL, ...ISO_GATE, ...ISO_FAIL].sort()).toEqual([...DELIVERY_ATOMIC_IDS].sort());
    expect(ISO_STRICT).toHaveLength(15);
    expect(ISO_STRUCTURAL).toHaveLength(7);
    expect(ISO_GATE).toHaveLength(7);
    expect(ISO_FAIL).toEqual(["A09"]);
    expect(Object.keys(DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES).sort()).toEqual([...ISO_STRUCTURAL].sort());
    expect(Object.keys(DELIVERY_ATOMIC_GATE_CLASS).sort()).toEqual([...ISO_GATE].sort());
    expect(Object.keys(DELIVERY_ATOMIC_UNRESOLVED).sort()).toEqual([...ISO_FAIL].sort());
    for (const id of ISO_STRUCTURAL)
      expect([...DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES[id]!.also_changes].sort(), id).toEqual([...ISO_STRUCTURAL_CROSS[id]].sort());
  });

  it("proves one-governing-source causal isolation for every A01..A30 through the committed test path", () => {
    const inp = baseInput();
    const before = S(inp);
    const counts = { STRICT: 0, STRUCTURAL_DEPENDENCY: 0, GATE_CLASS: 0, FAIL: 0 };
    const testFileSource = readFileSync(new URL("./deliveryDocumentationDemo.test.ts", import.meta.url), "utf8");

    for (const id of DELIVERY_ATOMIC_IDS) {
      const inpBefore = S(inp);
      const r = probeDeliveryAtomicSourceFactIsolation(id, inp);
      const cls = classifyDeliveryAtomicIsolation(r);
      counts[cls]++;

      expect(r.id, id).toBe(id);
      expect(r.owned_fact, id).toBe(DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact);
      // shared raw source + frozen canonical decision never disturbed
      expect(r.original_source_unchanged, `${id} original_source_unchanged`).toBe(true);
      expect(r.original_decision_unchanged, `${id} original_decision_unchanged`).toBe(true);
      // isolation action touched exactly one raw-source fact record under input./audit.
      expect(r.mutated_field_paths.length, `${id} mutated_field_paths`).toBeGreaterThan(0);
      expect(
        r.mutated_field_paths.every((p) => (p.startsWith("input.") || p.startsWith("audit.")) && !/\b(decision|package|coverage|blockers|warnings|expected_observation|correct|actual_observation)\b/.test(p)),
        `${id} mutated_field_paths ${S(r.mutated_field_paths)}`,
      ).toBe(true);
      expect(r.mutated_fact_records.length, `${id} fact records ${S(r.mutated_fact_records)}`).toBe(1);
      expect(r.paths_conform, `${id} paths conform to declared governing_paths ${S(r.governing_paths)} vs ${S(r.mutated_field_paths)}`).toBe(true);
      expect(S(inp), `${id} input byte-stable`).toBe(inpBefore);

      if (ISO_STRICT.includes(id)) {
        expect(cls, `${id} (${S(r)})`).toBe("STRICT");
        expect(r.governing_changed, `${id} governing_changed`).toBe(true);
        expect(r.cross, `${id} cross`).toEqual([]);
        expect(r.blocked, `${id} not fail-closed`).toBe(false);
        expect(isValidSourceFactIsolationEvidence(r), `${id} isValid`).toBe(true);
      } else if (ISO_STRUCTURAL.includes(id)) {
        expect(cls, `${id} (${S(r)})`).toBe("STRUCTURAL_DEPENDENCY");
        expect(r.governing_changed, `${id} governing_changed`).toBe(true);
        const dep = DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES[id]!;
        // EXACT set-equality of measured cross and declared also_changes (erratum §5.2)
        expect([...r.cross].sort(), `${id} cross == declared also_changes`).toEqual([...dep.also_changes].sort());
        expect([...r.cross].sort(), `${id} cross == frozen measured set`).toEqual([...ISO_STRUCTURAL_CROSS[id]].sort());
        expect(dep.also_changes.length, `${id} also_changes non-empty`).toBeGreaterThan(0);
        expect(typeof dep.forcing, `${id} forcing string`).toBe("string");
        expect(dep.forcing.length, `${id} forcing detail`).toBeGreaterThan(40);
        expect(isValidSourceFactIsolationEvidence(r), `${id} isValid`).toBe(true);
      } else if (ISO_GATE.includes(id)) {
        expect(cls, `${id} (${S(r)})`).toBe("GATE_CLASS");
        const gc = DELIVERY_ATOMIC_GATE_CLASS[id]!;
        // fail-closed BEFORE the derived observation could carry the prohibited material
        expect(r.blocked, `${id} fail-closed`).toBe(true);
        expect(r.blockers, `${id} named blocker ${gc.blocker} fired`).toContain(gc.blocker);
        // no leak: no accepted artifact
        expect(r.accepted_package_null, `${id} package === null (no leak)`).toBe(true);
        // the corresponding unsafe counter is independently fireable
        const driver = ISO_GATE_COUNTER_DRIVER[id](buildDeliveryPackage(inp), inp);
        expect(deriveDeliveryUnsafeCounters(driver.inp, driver.decision, zeroAuditIso)[driver.key], `${id} ${gc.unsafe_counter} independently fireable`).toBe(1);
        expect(gc.unsafe_counter.startsWith(driver.key.slice(0, 4)), `${id} declared counter matches driver`).toBe(true);
        // a named canonical negative fixture exercises the same governing condition
        expect(testFileSource, `${id} negative fixture ${gc.negative_fixture} present`).toContain(gc.negative_fixture);
        expect(typeof gc.forcing, `${id} forcing string`).toBe("string");
        expect(gc.forcing.length, `${id} forcing detail`).toBeGreaterThan(40);
      } else {
        // A09 — reported semantic gap, kept visible, NOT hidden as another class
        expect(cls, `${id} reported FAIL`).toBe("FAIL");
        expect(isValidSourceFactIsolationEvidence(r), `${id} not valid isolation`).toBe(false);
        expect(DELIVERY_ATOMIC_UNRESOLVED[id]?.reason.length ?? 0, `${id} documented gap`).toBeGreaterThan(80);
        expect(DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES[id], `${id} not smuggled into STRUCTURAL`).toBeUndefined();
        expect(DELIVERY_ATOMIC_GATE_CLASS[id], `${id} not smuggled into GATE_CLASS`).toBeUndefined();
      }
    }

    expect(counts, S(counts)).toEqual({ STRICT: 15, STRUCTURAL_DEPENDENCY: 7, GATE_CLASS: 7, FAIL: 1 });
    expect(S(inp)).toBe(before);

    // erratum §8 positive-path requirement: at least one accepted probe of each present class
    expect(isValidSourceFactIsolationEvidence(probeDeliveryAtomicSourceFactIsolation("A02", inp))).toBe(true); // STRICT
    expect(isValidSourceFactIsolationEvidence(probeDeliveryAtomicSourceFactIsolation("A01", inp))).toBe(true); // STRUCTURAL_DEPENDENCY
    expect(classifyDeliveryAtomicIsolation(probeDeliveryAtomicSourceFactIsolation("A25", inp))).toBe("GATE_CLASS");
  });

  it("erratum §8 anti-tautology: all four fake-isolation mechanisms are mechanically rejected", () => {
    for (const id of ["A02", "A14", "A29"] as const) {
      // §8.1 — direct expected_observation overwrite (rejected cf49b45)
      const legacyExp = legacyExpectedObservationMutationEvidence(baseInput(), id);
      expect(legacyExp.mutated_field_paths.some((p) => p.split(".").includes("expected_observation")), `${id} exp path`).toBe(true);
      expect(isValidSourceFactIsolationEvidence(legacyExp), `${id} expected_observation rejected`).toBe(false);
      expect(classifyDeliveryAtomicIsolation(legacyExp), `${id} classifies FAIL`).toBe("FAIL");

      // §8.2 — direct derived decision overwrite (rejected 1782a16)
      const legacyDer = legacyDerivedDecisionMutationEvidence(baseInput(), id);
      expect(legacyDer.mutated_field_paths.some((p) => /^decision\./.test(p)), `${id} der path`).toBe(true);
      expect(isValidSourceFactIsolationEvidence(legacyDer), `${id} derived-decision rejected`).toBe(false);
      expect(classifyDeliveryAtomicIsolation(legacyDer), `${id} classifies FAIL`).toBe("FAIL");
    }

    // §8.3 — semantically irrelevant tuple-mover (pre-erratum A03: rename an unrelated subject_ref).
    // It IS one real raw-source field (rawSourceOnly passes, one fact record), but its measured
    // path does not conform to A03's declared governing path -> paths_conform is the discriminator.
    const irr = legacyIrrelevantMoverEvidence(baseInput());
    expect(irr.mutated_field_paths, "irrelevant mover raw-source path").toEqual(["input.repository_facts.4.subject_ref"]);
    expect(irr.mutated_fact_records.length, "irrelevant mover is a SINGLE fact").toBe(1);
    expect(irr.paths_conform, "irrelevant mover fails declared-path conformance (§8.3 discriminator)").toBe(false);
    expect(classifyDeliveryAtomicIsolation(irr)).toBe("FAIL");
    expect(isValidSourceFactIsolationEvidence(irr)).toBe(false);

    // §8.4 — two independent source facts in one probe (pre-erratum A26: add one fact AND edit another).
    // Both are raw-source input. fields, but they land on two distinct fact records ->
    // mutated_fact_records.length is the discriminator.
    const two = legacyTwoFactEvidence(baseInput());
    expect(two.mutated_fact_records.length, "two-fact probe touches TWO fact records (§8.4 discriminator)").toBe(2);
    expect(new Set(two.mutated_fact_records).size).toBe(2);
    expect(classifyDeliveryAtomicIsolation(two)).toBe("FAIL");
    expect(isValidSourceFactIsolationEvidence(two)).toBe(false);

    // rejected primitive still behaves as documented (kept for regression §8.1)
    const facts = deriveDeliverySourceFacts(baseInput());
    mutateDeliverySourceFact(facts, "A14");
    expect(facts.A14.expected_observation).toEqual({ isolation_probe_for: "A14" });

    // positive paths still accepted
    expect(isValidSourceFactIsolationEvidence(probeDeliveryAtomicSourceFactIsolation("A02", baseInput())), "STRICT accepted").toBe(true);
    expect(isValidSourceFactIsolationEvidence(probeDeliveryAtomicSourceFactIsolation("A16", baseInput())), "STRUCTURAL accepted").toBe(true);
    expect(classifyDeliveryAtomicIsolation(probeDeliveryAtomicSourceFactIsolation("A27", baseInput())), "GATE_CLASS accepted").toBe("GATE_CLASS");
  });

  it("observeAtomic output is byte-identical to the pre-reconciliation build (A/B table unaffected)", () => {
    // observeAtomic (quality.ts) was not touched by the erratum reconciliation; the canonical
    // frozen observations keep their exact shape and order, so deriveDeliverySourceFacts and the
    // 12-scenario A/B gate below are unchanged. Guard: canonical build is fully self-consistent.
    const obs = evaluateDeliveryAtomicObservations(baseInput());
    expect(Object.keys(obs)).toEqual([...DELIVERY_ATOMIC_IDS]);
    expect(DELIVERY_ATOMIC_IDS.every((id) => obs[id].correct), "every canonical atomic observation is self-consistent").toBe(true);
    // A27 governing observation is unreachable by a source mutation (fail-closed gate).
    const a27 = probeDeliveryAtomicSourceFactIsolation("A27", baseInput());
    expect(a27.governing_changed, "A27 observation unreachable by source mutation").toBe(false);
    expect(a27.blocked).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Real same-path A/B impact gate — 12 frozen scenarios, 30 atomics per arm
// ---------------------------------------------------------------------------
const richVariant = (seed: string, fn: (v: MutableInput) => void = () => {}) =>
  mutate(baseInput(), (v) => {
    v.delivery_identity.project_ref = `proj:${seed}`;
    v.delivery_identity.delivery_scope_ref = `scope:${seed}`;
    fn(v);
  });

const abScenarios: Array<[string, () => DeliveryDocumentationDemoInput]> = [
  ["AB01_MINIMAL_LIBRARY", () => minimalInput("alpha")],
  ["AB02_MINIMAL_CLI", () => mutate(minimalInput("bravo"), (v) => (v.demo_surface.kind = "CLI"))],
  ["AB03_MINIMAL_HARNESS", () => mutate(minimalInput("charlie"), (v) => (v.demo_surface.kind = "TEST_OR_EVAL_HARNESS"))],
  ["AB04_RICH_BASE", () => richVariant("delta")],
  ["AB05_RICH_EXTRA_DEFERRED_CLAIM", () => richVariant("echo", (v) => v.repository_facts.push({ fact_id: "rf-defer", kind: "KNOWN_FEATURE", subject_ref: "feat:defer", value: "a planned enhancement", source_ref: "src:roadmap", revision_ref: REV, confidence: "REPORTED" }))],
  ["AB06_RICH_EXTRA_ARCH_FACTS", () => richVariant("foxtrot", (v) => { v.architecture_facts!.push({ fact_id: "af-extra1", kind: "COMPONENT", subject_ref: "comp:plan", value: "delivery plan compiler", source_ref: "src:module", revision_ref: REV }); v.architecture_facts!.push({ fact_id: "af-extra2", kind: "FLOW", subject_ref: "flow:main", value: "facts flow into a bounded package", source_ref: "src:module", revision_ref: REV }); })],
  ["AB07_RICH_EXTRA_REQUIRED_SETUP", () => richVariant("golf", (v) => v.repository_facts.push({ fact_id: "rf-cmd-lint", kind: "PACKAGE_SCRIPT", subject_ref: "script:lint", value: "npm run lint", source_ref: "src:package.json", revision_ref: REV, confidence: "VERIFIED", setup_role: "REQUIRED", expected_signal_ref: "signal:no lint errors" }))],
  ["AB08_RICH_EXTRA_LIMITATION", () => richVariant("hotel", (v) => v.limitations!.push({ limitation_id: "lim-mem", summary: "peak memory grows with fact count", severity: "MEDIUM", impact: "large deliveries need more heap", status: "KNOWN", source_refs: ["src:bench"] }))],
  ["AB09_RICH_REQUIRED_BEFORE_PROD_NEXT_STEP", () => richVariant("india", (v) => v.next_step_candidates!.push({ next_step_id: "ns-sec", summary: "security review of the evidence index", priority: "P0", status: "REQUIRED_BEFORE_PRODUCTION", dependency_or_owner_ref: "owner:sec", source_refs: ["src:contract"] }))],
  ["AB10_RICH_UNSORTED_EVIDENCE", () => richVariant("juliet", (v) => { v.verification_evidence.reverse(); v.verification_evidence.push({ ...v.verification_evidence[0] }); })],
  ["AB11_RICH_EXTRA_DEMO_STEP", () => richVariant("kilo", (v) => v.demo_surface.steps!.push({ step_ref: "ds-3", title_ref: "Show the markdown projection", action_ref: "action:print the rendered markdown", expected_result_ref: "result:the markdown mirrors the structured package", evidence_ref: "ev-demo-run", env_sensitive: false, fallback_ref: "fallback:diff structured vs rendered" }))],
  ["AB12_RICH_NO_ANCESTRY", () => richVariant("lima", (v) => { delete v.delivery_identity.accepted_ancestry_or_range_ref; delete v.delivery_identity.baseline_revision_ref; })],
];

function scoreAtomics(
  inp: DeliveryDocumentationDemoInput,
  decision: DeliveryDocumentationDemoResult,
  facts: DeliverySourceFacts,
  audit: DeliveryEvaluationAudit,
): Record<DeliveryAtomicId, boolean> {
  const obs = evaluateDeliveryAtomicObservations(inp, facts, decision, audit);
  return Object.fromEntries(DELIVERY_ATOMIC_IDS.map((id) => [id, obs[id].correct])) as Record<DeliveryAtomicId, boolean>;
}

describe("S13Q real same-path A/B impact gate", () => {
  it("declares exactly twelve unique scenario ids", () => {
    expect(abScenarios).toHaveLength(12);
    expect(new Set(abScenarios.map(([id]) => id)).size).toBe(12);
  });

  it("Skill arm strictly improves distributed post-gate atomic correctness with no regressions", async () => {
    const inputs = abScenarios.map(([, make]) => make());
    const audits: DeliveryEvaluationAudit[] = inputs.map((v) => {
      const s = S(v);
      return { input_snapshot_before: s, input_snapshot_after: s, candidate_gate_valid: true, hidden_io_or_clock: false, self_certified: false, core_or_contract_changed: false, provider_fixture_or_arm_branching: false };
    });
    const facts = inputs.map((v, i) => deriveDeliverySourceFacts(v, audits[i]));

    const baseline = await Promise.all(inputs.map((v) => runPlan(v, false)));
    const skill = await Promise.all(inputs.map((v) => runPlan(v, true)));

    expect(inputs.every((v, i) => baseline[i].visiblePacket === v && skill[i].visiblePacket === v)).toBe(true);
    expect(baseline.every((r, i) => r.materializedDefinition.objective !== skill[i].materializedDefinition.objective)).toBe(true);
    expect(baseline.some((r) => !r.decisionValidation.valid && r.decision.status === "BLOCKED")).toBe(true);
    expect(skill.every((r) => r.decisionValidation.valid)).toBe(true);

    const mkAudit = (r: (typeof baseline)[number], i: number): DeliveryEvaluationAudit => ({
      ...audits[i],
      input_snapshot_before: r.inputSnapshotBefore,
      input_snapshot_after: r.inputSnapshotAfter,
      candidate_gate_valid: r.decisionValidation.valid,
    });
    const baseAtoms = baseline.map((r, i) => scoreAtomics(inputs[i], r.decision, facts[i], mkAudit(r, i)));
    const skillAtoms = skill.map((r, i) => scoreAtomics(inputs[i], r.decision, facts[i], mkAudit(r, i)));
    const total = (rows: readonly Record<DeliveryAtomicId, boolean>[]) =>
      rows.reduce((s, row) => s + DELIVERY_ATOMIC_IDS.filter((id) => row[id]).length, 0);

    const regressions: string[] = [];
    let maxSingleAssertionDelta = 0;
    let positiveDelta = 0;
    const dimensionReport = Object.entries(DELIVERY_DIMENSIONS).map(([dimension, ids]) => {
      const contributions = Object.fromEntries(ids.map((id) => [id, 0])) as Record<string, number>;
      for (let s = 0; s < inputs.length; s++)
        for (const id of ids) {
          if (!baseAtoms[s][id] && skillAtoms[s][id]) contributions[id]++;
          if (baseAtoms[s][id] && !skillAtoms[s][id]) regressions.push(`${s}:${id}`);
        }
      const denom = Object.values(contributions).reduce((a, b) => a + b, 0);
      positiveDelta += denom;
      maxSingleAssertionDelta = Math.max(maxSingleAssertionDelta, ...Object.values(contributions));
      const distinctImproved = Object.values(contributions).filter((c) => c > 0).length;
      const maxShare = denom === 0 ? 0 : Math.max(...Object.values(contributions)) / denom;
      return { dimension, contributions, denom, distinctImproved, maxShare, qualified: distinctImproved >= 2 && maxShare <= 0.5 };
    });

    const report = {
      baselineTotal: total(baseAtoms),
      skillTotal: total(skillAtoms),
      delta: total(skillAtoms) - total(baseAtoms),
      qualifiedDimensions: dimensionReport.filter((d) => d.qualified).length,
      regressions,
      globalMaxShare: positiveDelta === 0 ? 0 : maxSingleAssertionDelta / positiveDelta,
      dimensionReport,
    };

    expect(report.regressions, S(report)).toEqual([]);
    expect(report.skillTotal, S(report)).toBeGreaterThan(report.baselineTotal);
    expect(report.qualifiedDimensions, S(report)).toBeGreaterThanOrEqual(7);
    expect(report.globalMaxShare, S(report)).toBeLessThanOrEqual(0.5);
    for (const d of report.dimensionReport) if (d.qualified) expect(d.distinctImproved, S(d)).toBeGreaterThanOrEqual(2);

    // Exact frozen numbers — 3 minimal scenarios where a feature-blind synthesizer already
    // matches canonical (baseline gate-valid), 9 rich scenarios where it does not.
    expect({
      baselineTotal: report.baselineTotal,
      skillTotal: report.skillTotal,
      delta: report.delta,
      qualifiedDimensions: report.qualifiedDimensions,
      contributions: Object.fromEntries(report.dimensionReport.map((d) => [d.dimension.slice(0, 3), d.contributions])),
    }).toEqual({
      baselineTotal: 126,
      skillTotal: 360,
      delta: 234,
      qualifiedDimensions: 8,
      contributions: {
        D01: { A01: 9, A02: 9, A03: 9 },
        D02: { A04: 9, A05: 9, A06: 9 },
        D03: { A07: 9, A08: 9, A09: 9 },
        D04: { A10: 9, A11: 9, A12: 9 },
        D05: { A13: 9, A14: 9, A15: 9 },
        D06: { A16: 9, A17: 9, A18: 9 },
        D07: { A19: 9, A20: 9, A21: 9 },
        D08: { A22: 9, A23: 9, A24: 9 },
        D09: { A25: 0, A26: 9, A27: 0 },
        D10: { A28: 0, A29: 9, A30: 0 },
      },
    });
    const baselineValid = baseline.filter((r) => r.decisionValidation.valid).length;
    expect(baselineValid, "exactly the 3 minimal scenarios are gate-valid for the baseline arm").toBe(3);

    // Per-scenario flip counts — no duplicate-fixture inflation: 3 minimal contribute 0,
    // 9 distinct rich scenarios each contribute the same 26 package-reading assertions
    // because the byte-equality gate (contract section 20) collapses a divergent baseline
    // candidate to `package: null` all at once. The eight independent producer paths behind
    // that collapse are proven separately by the per-feature ablation test below.
    const perScenarioFlips = inputs.map((_, s) => DELIVERY_ATOMIC_IDS.filter((id) => !baseAtoms[s][id] && skillAtoms[s][id]).length);
    expect(perScenarioFlips).toEqual([0, 0, 0, 26, 26, 26, 26, 26, 26, 26, 26, 26]);

    // Unsafe counters zero for every Skill-arm candidate.
    const aggregate: Record<string, number> = {};
    for (let i = 0; i < inputs.length; i++) {
      const counters = deriveDeliveryUnsafeCounters(inputs[i], skill[i].decision, { hidden_io_or_clock: false, self_certified: false, core_or_contract_changed: false });
      for (const [k, v] of Object.entries(counters)) aggregate[k] = (aggregate[k] ?? 0) + v;
    }
    expect(Object.keys(aggregate)).toHaveLength(12);
    expect(Object.values(aggregate), S(aggregate)).toEqual(Array(12).fill(0));
  }, 30000);
});

// ---------------------------------------------------------------------------
// Per-feature ablation — eight independent producer paths behind the gate collapse
// ---------------------------------------------------------------------------
describe("S13Q per-feature ablation — one concept changes exactly one owned section", () => {
  const conceptProse: Record<keyof DeliveryMethodFeatures, string> = {
    distinguishClaimStatus: "Implemented and verified are distinct claim states and are never conflated.",
    buildArchitectureSummary: "The architecture summary describes the architecture that already exists.",
    requireSetupSignals: "Every required setup or run step declares its preconditions and an expected observable signal.",
    buildDemoScript: "The demo is a reproducible evidence-bound walkthrough over an already-existing surface.",
    filterMaterialLimitations: "Known limitations are represented explicitly with severity, impact and provenance.",
    labelNextSteps: "Every next step is labeled proposed, deferred or required before production.",
    dedupOrderEvidence: "The evidence index is deduplicated and deterministically ordered.",
  };
  const featureKeys = Object.keys(conceptProse) as (keyof DeliveryMethodFeatures)[];
  const inp = () =>
    mutate(baseInput(), (v) => {
      // give the evidence a non-sorted, duplicated shape so dedupOrderEvidence has visible work
      v.verification_evidence.reverse();
      v.verification_evidence.push({ ...v.verification_evidence[0] });
    });

  it("recovers exactly seven concepts and owns seven distinct package sections", () => {
    expect(featureKeys).toHaveLength(7);
    expect(new Set(Object.values(FEATURE_OWNED_SECTION)).size).toBe(7);
    expect(extractDeliveryMethodFeatures(fullMethodProse)).toEqual(ALL_FEATURES_ON);
  });

  it.each(featureKeys)("%s: single concept flips only its owned section", (key) => {
    const one = extractDeliveryMethodFeatures(conceptProse[key]);
    expect(Object.entries(one).filter(([, on]) => on).map(([k]) => k), S(one)).toEqual([key]);

    const off = synthesizeDeliveryPackageWithFeatures(inp(), ALL_FEATURES_OFF).package!;
    const onlyThis = synthesizeDeliveryPackageWithFeatures(inp(), { ...ALL_FEATURES_OFF, [key]: true }).package!;

    const owned = FEATURE_OWNED_SECTION[key];
    expect(S(onlyThis[owned]), `${key} must change ${owned}`).not.toBe(S(off[owned]));
    for (const section of Object.keys(FEATURE_OWNED_SECTION).map((k) => FEATURE_OWNED_SECTION[k as keyof DeliveryMethodFeatures]))
      if (section !== owned) expect(S(onlyThis[section]), `${key} must not change ${section}`).toBe(S(off[section]));
  });

  it("all seven concepts together reproduce the canonical package byte for byte", () => {
    expect(S(synthesizeDeliveryPackageWithFeatures(inp(), ALL_FEATURES_ON))).toBe(S(buildDeliveryPackage(inp())));
  });
});

// ---------------------------------------------------------------------------
// Hard invariants — S13Q-HI-001 .. S13Q-HI-030
// ---------------------------------------------------------------------------
describe("S13Q hard invariants — 30/30", () => {
  it("recomputes S13Q-HI-001 through S13Q-HI-030 individually", () => {
    const inp = baseInput();
    const before = S(inp);
    const truth = buildDeliveryPackage(inp);
    const pkg = truth.package!;
    const protectedSource = [
      "src/core/agent/index.ts",
      "src/core/agent/types.ts",
      "src/core/skill/types.ts",
      "src/intelligence/skills/selectSkillForTask.ts",
    ].map((n) => readFileSync(new URL(`../../${n}`, import.meta.url), "utf8")).join("\n");
    const impl = implementationSource();
    const pkgJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

    const conflicting = buildDeliveryPackage(mutate(inp, (v) => { delete v.delivery_identity.accepted_ancestry_or_range_ref; delete v.delivery_identity.baseline_revision_ref; v.demo_surface.revision_ref = OLD_REV; }));
    const wrongRevClaim = buildDeliveryPackage(mutate(inp, (v) => { delete v.delivery_identity.accepted_ancestry_or_range_ref; delete v.delivery_identity.baseline_revision_ref; v.repository_facts[1].revision_ref = OLD_REV; }));
    const ancestryBound = buildDeliveryPackage(mutate(inp, (v) => (v.repository_facts[1].revision_ref = OLD_REV)));
    const committedFactSubjects = new Set(inp.repository_facts.filter((f) => (f.confidence === "VERIFIED" || f.confidence === "ACCEPTED") && f.revision_ref === REV).map((f) => f.subject_ref));
    const roadmap = build((v) => v.repository_facts.push({ fact_id: "r", kind: "KNOWN_FEATURE", subject_ref: "s", value: "planned", source_ref: "src:roadmap", revision_ref: REV, confidence: "REPORTED", asserts_status: "IMPLEMENTED" }));
    const secret = build((v) => (v.repository_facts[5].value = "TOKEN=sk-deadbeefdeadbeef01 npm run build"));
    const invented = build((v) => v.repository_facts.push({ fact_id: "i", kind: "COMMAND", subject_ref: "c", value: "serve --port 4242", source_ref: "s", revision_ref: REV, confidence: "ACCEPTED" }));
    const demoRuntime = build((v) => (v.demo_surface.entry_action_ref = "action:deploy and start a new server"));
    const hidden = build((v) => { v.policy = policy({ suppress_limitation_ids: ["lim-x"] }); v.limitations!.push({ limitation_id: "lim-x", summary: "known hole", severity: "HIGH", impact: "bad", status: "KNOWN", source_refs: ["s"] }); });
    const overclaim = build((v) => (v.repository_facts[1].value = "this module is production-ready"));
    const s13r = build((v) => v.repository_facts.push({ fact_id: "d", kind: "PACKAGE_SCRIPT", subject_ref: "sd", value: "run the deployment pipeline dockerfile", source_ref: "s", revision_ref: REV, confidence: "VERIFIED", setup_role: "REQUIRED", expected_signal_ref: "sig" }));
    const s14 = build((v) => v.architecture_facts!.push({ fact_id: "m", kind: "COMPONENT", subject_ref: "cm", value: "adds an mcp server connector binding", source_ref: "s", revision_ref: REV }));
    const brokenRef = build((v) => (v.repository_facts[2].evidence_ref = "ev-ghost"));
    const precedence = build((v) => { v.verification_evidence.push({ evidence_id: " ", kind: "TEST", subject_ref: "feat:z", revision_ref: REV, status: "FAIL", summary_ref: "s", source_ref: "s" }); v.repository_facts.push({ fact_id: "z", kind: "KNOWN_FEATURE", subject_ref: "feat:z", value: "caller says pass", source_ref: "src:hearsay", revision_ref: REV, confidence: "REPORTED", asserts_status: "VERIFIED" }); });
    const selfCertCandidate = structuredClone(truth) as DeliveryDocumentationDemoResult;
    selfCertCandidate.warnings.push({ code: "x", detail: "HI-052 awarded by candidate" });
    const tsCandidate = structuredClone(truth) as DeliveryDocumentationDemoResult;
    tsCandidate.warnings.push({ code: "x", detail: "built 2026-01-02T03:04:05Z" });

    const hi: Record<string, boolean> = {
      "S13Q-HI-001":
        pkg.identity.revision_ref === REV &&
        pkg.identity.revision_ref.length > 0 &&
        buildDeliveryPackage(mutate(inp, (v) => (v.delivery_identity.revision_ref = ""))).blockers.some((b) => b.code === "MISSING_DELIVERY_REVISION") &&
        conflicting.status === "BLOCKED" &&
        conflicting.blockers.some((b) => b.code === "CONFLICTING_DELIVERY_REVISION"),
      "S13Q-HI-002":
        wrongRevClaim.status === "BLOCKED" &&
        wrongRevClaim.blockers.some((b) => b.code === "CLAIM_BOUND_TO_WRONG_REVISION") &&
        ancestryBound.status !== "BLOCKED",
      "S13Q-HI-003": pkg.optional_markdown_projection === renderDeliveryPackageMarkdown({ ...pkg, optional_markdown_projection: null }),
      "S13Q-HI-004": pkg.executive_summary.delivered.every((c) =>
        c.claim_status === "VERIFIED"
          ? c.evidence_refs.length > 0
          : c.claim_status === "IMPLEMENTED"
            ? committedFactSubjects.has(c.subject_ref)
            : ["NOT_IMPLEMENTED", "AVAILABLE_NOT_VERIFIED", "DEFERRED", "UNKNOWN"].includes(c.claim_status),
      ),
      "S13Q-HI-005": pkg.executive_summary.delivered.some((c) => c.claim_status === "VERIFIED") && pkg.executive_summary.delivered.some((c) => c.claim_status === "IMPLEMENTED") && !pkg.executive_summary.delivered.some((c) => c.claim_status === "VERIFIED" && c.evidence_refs.length === 0),
      "S13Q-HI-006": roadmap.status === "BLOCKED" && roadmap.blockers.some((b) => b.code === "ROADMAP_FEATURE_CLAIMED_IMPLEMENTED"),
      "S13Q-HI-007": pkg.architecture_summary.components.every((c) => (inp.architecture_facts ?? []).some((a) => a.subject_ref === c.subject_ref)),
      "S13Q-HI-008": pkg.architecture_summary.boundaries.length >= 1 && buildDeliveryPackage(build((v) => v.architecture_facts!.push({ fact_id: "n", kind: "COMPONENT", subject_ref: "x", value: "adopt a new framework", source_ref: "s", revision_ref: REV }))).status === "BLOCKED",
      "S13Q-HI-009": build((v) => v.architecture_facts!.push({ fact_id: "n", kind: "COMPONENT", subject_ref: "x", value: "we should use a new queue", source_ref: "s", revision_ref: REV })).blockers.some((b) => b.code === "NEW_ARCHITECTURE_DECISION"),
      "S13Q-HI-010": invented.status === "BLOCKED" && invented.blockers.some((b) => b.code === "INVENTED_PORT"),
      "S13Q-HI-011": secret.status === "BLOCKED" && !S(secret).includes("sk-deadbeefdeadbeef01"),
      "S13Q-HI-012": inp.demo_surface.exists === true && pkg.demo_script.length >= 1 && build((v) => (v.demo_surface.exists = false)).blockers.some((b) => b.code === "DEMO_SURFACE_DOES_NOT_EXIST"),
      "S13Q-HI-013": pkg.demo_script.every((d) => d.action.length > 0 && d.expected_observable_result.length > 0) && pkg.demo_script.slice(1).every((d) => d.evidence_refs.length > 0 || d.step_id === "demo-00"),
      "S13Q-HI-014": pkg.demo_script.every((d) => d.fallback_or_stop_condition.length > 0) && build((v) => { v.demo_surface.steps![1].fallback_ref = undefined; }).blockers.some((b) => b.code === "DEMO_FALLBACK_MISSING"),
      "S13Q-HI-015": demoRuntime.status === "BLOCKED" && !/deploy and start a new server/.test(S(demoRuntime.package)),
      "S13Q-HI-016": build((v) => { v.verification_evidence.push({ evidence_id: "ev-s", kind: "DEMO_PROOF", subject_ref: "d", revision_ref: REV, status: "SKIPPED", summary_ref: "s", source_ref: "s" }); v.demo_surface.steps![0].evidence_ref = "ev-s"; }).blockers.some((b) => b.code === "DEMO_EXCEEDS_EVIDENCE"),
      "S13Q-HI-017": pkg.limitations.length === (inp.limitations ?? []).length && hidden.status === "BLOCKED",
      "S13Q-HI-018": pkg.limitations.some((l) => l.status === "UNVERIFIED"),
      "S13Q-HI-019": pkg.limitations.every((l) => l.impact.length > 0 && l.source_refs.length > 0),
      "S13Q-HI-020": pkg.next_steps.every((n) => ["PROPOSED", "DEFERRED", "REQUIRED_BEFORE_PRODUCTION"].includes(n.status)),
      "S13Q-HI-021": build((v) => (v.next_step_candidates![0].claims_completed = true)).blockers.some((b) => b.code === "NEXT_STEP_PRESENTED_AS_IMPLEMENTED"),
      "S13Q-HI-022": overclaim.status === "BLOCKED" && s13r.blockers.some((b) => b.code === "S13R_DEPLOYMENT_PULLED_FORWARD"),
      "S13Q-HI-023": s14.blockers.some((b) => b.code === "S14_CAPABILITY_PULLED_FORWARD"),
      "S13Q-HI-024": pkg.evidence_index.map((e) => e.evidence_id).join() === [...pkg.evidence_index.map((e) => e.evidence_id)].sort().join() && new Set(pkg.evidence_index.map((e) => e.evidence_id)).size === pkg.evidence_index.length,
      "S13Q-HI-025": brokenRef.status === "BLOCKED" && brokenRef.blockers.some((b) => b.code === "EVIDENCE_REF_UNRESOLVED"),
      "S13Q-HI-026": precedence.status === "BLOCKED" && precedence.blockers.some((b) => b.code === "PRECEDENCE_VIOLATION"),
      "S13Q-HI-027": pkg.provenance.revision_ref === REV && pkg.provenance.source_kinds.length >= 1,
      "S13Q-HI-028": validateDeliveryCandidate(selfCertCandidate, inp).valid === false && /self-certifies/.test(validateDeliveryCandidate(selfCertCandidate, inp).errors.join(" ")),
      "S13Q-HI-029": S(buildDeliveryPackage(inp)) === S(truth) && S(inp) === before && validateDeliveryCandidate(tsCandidate, inp).valid === false,
      "S13Q-HI-030":
        !/from ["'][^"']*(?:node:fs|node:net|node:http|node:dns|undici|axios)|child_process|\bfetch\s*\(|process\.env|Date\.now\(\)|new Date\(\)|Math\.random/.test(impl) &&
        !/delivery-documentation-demo|S13Q/i.test(protectedSource) &&
        pkgJson.dependencies["better-sqlite3"] === "^13.0.3" &&
        !("js-yaml" in pkgJson.dependencies),
    };

    expect(Object.keys(hi)).toEqual(Array.from({ length: 30 }, (_, i) => `S13Q-HI-${String(i + 1).padStart(3, "0")}`));
    for (const [id, ok] of Object.entries(hi)) expect(ok, id).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unsafe counters UC01..UC12 — zero on positives, each independently fireable
// ---------------------------------------------------------------------------
const zeroAudit = { hidden_io_or_clock: false, self_certified: false, core_or_contract_changed: false };

describe("S13Q unsafe counters — 12/12", () => {
  it("are all zero across every positive fixture", () => {
    const aggregate: Record<string, number> = {};
    for (const [, make] of positives) {
      const inp = make();
      const counters = deriveDeliveryUnsafeCounters(inp, buildDeliveryPackage(inp), zeroAudit);
      for (const [k, v] of Object.entries(counters)) aggregate[k] = (aggregate[k] ?? 0) + v;
    }
    expect(Object.keys(aggregate)).toHaveLength(12);
    expect(Object.values(aggregate), S(aggregate)).toEqual(Array(12).fill(0));
  });

  it("each counter can be driven nonzero by a real governing violation", () => {
    const inp = baseInput();
    const truth = buildDeliveryPackage(inp);
    const withClaim = (status: string, subject: string, refs: string[] = []) => {
      const c = structuredClone(truth) as DeliveryDocumentationDemoResult;
      c.package!.executive_summary.delivered.push({ claim_id: "x", subject_ref: subject, text: "t", claim_status: status as never, evidence_refs: refs });
      return c;
    };
    expect(deriveDeliveryUnsafeCounters(inp, withClaim("VERIFIED", "feat:ghost"), zeroAudit).UC01_unsupported_implemented_or_verified_claim).toBe(1);

    const invented = structuredClone(truth) as DeliveryDocumentationDemoResult;
    invented.package!.setup_and_run.push({ step_id: "s99", purpose: "p", command_or_action: "serve --port 9999", precondition_refs: [], expected_signal: "", evidence_refs: [], optional: true });
    expect(deriveDeliveryUnsafeCounters(inp, invented, zeroAudit).UC02_invented_setup_command_or_environment_detail).toBe(1);

    const badDemo = structuredClone(buildDeliveryPackage(mutate(inp, (v) => (v.demo_surface.exists = true)))) as DeliveryDocumentationDemoResult;
    const inpNoSurface = mutate(inp, (v) => (v.demo_surface.exists = false));
    expect(deriveDeliveryUnsafeCounters(inpNoSurface, badDemo, zeroAudit).UC03_nonexistent_demo_surface_or_result).toBe(1);

    const dropLim = structuredClone(truth) as DeliveryDocumentationDemoResult;
    const inpHigh = mutate(inp, (v) => v.limitations!.push({ limitation_id: "lim-big", summary: "s", severity: "HIGH", impact: "i", status: "KNOWN", source_refs: ["s"] }));
    expect(deriveDeliveryUnsafeCounters(inpHigh, dropLim, zeroAudit).UC04_hidden_material_limitation).toBe(1);

    const over = structuredClone(truth) as DeliveryDocumentationDemoResult;
    over.package!.executive_summary.verified.push("this is production-ready");
    expect(deriveDeliveryUnsafeCounters(inp, over, zeroAudit).UC05_deployment_or_production_readiness_overclaim).toBe(1);

    const sec = structuredClone(truth) as DeliveryDocumentationDemoResult;
    sec.package!.setup_and_run[0].command_or_action = "curl -H 'authorization: Bearer abcdefghijklmnop12'";
    expect(deriveDeliveryUnsafeCounters(inp, sec, zeroAudit).UC06_secret_or_raw_sensitive_material_emitted).toBe(1);

    const fab = structuredClone(truth) as DeliveryDocumentationDemoResult;
    fab.package!.evidence_index.push({ evidence_id: "ev-made-up", kind: "TEST", status: "PASS", subject_ref: "s", revision_ref: REV, source_ref: "s" });
    expect(deriveDeliveryUnsafeCounters(inp, fab, zeroAudit).UC07_evidence_ref_missing_or_fabricated).toBe(1);

    const inpFail = mutate(inp, (v) => v.verification_evidence.push({ evidence_id: "ev-f", kind: "TEST", subject_ref: "feat:parser", revision_ref: REV, status: "FAIL", summary_ref: "s", source_ref: "s" }));
    expect(deriveDeliveryUnsafeCounters(inpFail, truth, zeroAudit).UC08_source_precedence_overwritten).toBe(1);

    const future = structuredClone(truth) as DeliveryDocumentationDemoResult;
    future.package!.demo_script.push({ step_id: "d9", title: "t", precondition_refs: [], action: "spin up a new server", expected_observable_result: "r", evidence_refs: [], fallback_or_stop_condition: "f" });
    expect(deriveDeliveryUnsafeCounters(inp, future, zeroAudit).UC09_future_stage_pull_forward).toBe(1);

    expect(deriveDeliveryUnsafeCounters(inp, truth, { ...zeroAudit, hidden_io_or_clock: true }).UC10_hidden_io_environment_clock_or_randomness).toBe(1);
    expect(deriveDeliveryUnsafeCounters(inp, truth, { ...zeroAudit, self_certified: true }).UC11_candidate_self_certification).toBe(1);
    expect(deriveDeliveryUnsafeCounters(inp, truth, { ...zeroAudit, core_or_contract_changed: true }).UC12_core_agentdefinition_dependency_or_prior_contract_mutation).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Actual S12 -> S10 -> S09 path with the real candidate
// ---------------------------------------------------------------------------
describe("S13Q S12->S10->S09 actual candidate path", () => {
  it("loads only the S13Q Skill then gates the parsed candidate", async () => {
    const out = await runPlan(baseInput(), true);
    expect(out.skillLoaded).toBe(true);
    expect(out.run.outcome).toBe("SUCCESS");
    expect(out.decisionValidation.valid).toBe(true);
    expect(out.decision.status).toBe("READY");
    expect(out.inputSnapshotBefore).toBe(out.inputSnapshotAfter);
    expect(deliveryDocumentationDemoSkillS13Q.rules).toHaveLength(30);
    expect(deliveryDocumentationDemoSkillS13Q.id).toBe(DELIVERY_DOCUMENTATION_DEMO_SKILL_ID);
  });

  it("scores only the post-gate decision — a divergent candidate is gated to BLOCKED, never scored raw", async () => {
    const out = await runPlan(baseInput(), false);
    expect(out.decisionValidation.valid).toBe(false);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.blockers.some((b) => b.code === "CANDIDATE_REJECTED")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Anti-gaming provider hygiene
// ---------------------------------------------------------------------------
describe("S13Q anti-gaming provider hygiene", () => {
  it("deliveryProvider carries no fixture / scenario / arm / answer / evaluator coupling", () => {
    const source = readFileSync(new URL("./deliveryProvider.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/with[_ -]?skill|without[_ -]?skill|arm[_ -]?id|scenario[_ -]?id|fixture[_ -]?id|expected[_ -]?answer|hidden[_ -]?truth|grader|AB0[0-9]|P0[0-9]_|N[0-9][0-9]_/i);
    expect(source).not.toMatch(/DELIVERY_DOCUMENTATION_DEMO_SKILL_ID|buildDeliveryPackage|quality\.js|evaluateDelivery|deriveDeliverySourceFacts|evaluateDeliveryCandidateGate/);
    expect(source.match(/class DeliveryProvider/g)).toHaveLength(1);
  });

  it("irrelevant prose produces no correctness change; real method prose does", () => {
    const inp = abScenarios[3][1]();
    const naive = synthesizeDeliveryPackage(inp, "");
    const irrelevant = synthesizeDeliveryPackage(inp, "Please be concise, format things nicely and mention the weather in Lisbon.");
    expect(S(irrelevant)).toBe(S(naive));
    expect(Object.values(extractDeliveryMethodFeatures("Please be concise and mention the weather.")).some(Boolean)).toBe(false);
    const informed = synthesizeDeliveryPackage(inp, fullMethodProse);
    expect(S(informed)).not.toBe(S(naive));
    expect(S(informed)).toBe(S(buildDeliveryPackage(inp)));
  });

  it("a paraphrase of one concept activates exactly that feature; visible packet facts still move outcomes", () => {
    const oneConcept = "The next steps must each be labeled proposed, deferred or required before production.";
    const features = extractDeliveryMethodFeatures(oneConcept);
    expect(features.labelNextSteps).toBe(true);
    expect(Object.entries(features).filter(([, on]) => on).map(([k]) => k)).toEqual(["labelNextSteps"]);
    const a = synthesizeDeliveryPackage(baseInput(), oneConcept);
    const b = synthesizeDeliveryPackage(mutate(baseInput(), (v) => (v.next_step_candidates![0].status = "REQUIRED_BEFORE_PRODUCTION")), oneConcept);
    expect(S(a)).not.toBe(S(b));
  });
});
