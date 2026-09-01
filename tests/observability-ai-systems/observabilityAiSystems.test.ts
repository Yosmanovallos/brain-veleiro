import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { AgentDefinition, CapabilityProvider, ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { referenceSkillCatalogEntries } from "../../src/intelligence/skills/index.js";
import {
  OBSERVABILITY_ATOMIC_IDS,
  OBSERVABILITY_DIMENSIONS,
  OBSERVABILITY_SKILL_ID,
  buildObservabilityBundle,
  deriveObservabilitySourceFacts,
  deriveObservabilityUnsafeCounters,
  evaluateObservabilityAtomicObservations,
  evaluateObservabilityCandidateGate,
  mutateObservabilitySourceFact,
  observabilityAiSystemsSkillS13P,
  planObservability,
  validateObservabilityBundleCandidate,
  validateObservabilityPolicy,
  validateRunIdentity,
  validateSafeObservation,
  type ObservabilityAtomicId,
  type ObservabilityBuildInput,
  type ObservabilityBuildResult,
  type ObservabilityEvaluationAudit,
  type ObservabilitySourceFacts,
} from "../../src/intelligence/observability-ai-systems/index.js";
import { BundleProvider, extractObservabilityMethodFeatures, synthesizeObservabilityBundle } from "./bundleProvider.js";
import * as F from "./fixtures.js";

const clone = <T>(v: T): T => structuredClone(v);
const zeroAudit = { providerOrDependencyViolation: false, coreOrContractChanged: false, selfCertifiedPass: false };

class EmptyCapabilityProvider implements CapabilityProvider {
  async list_capabilities() {
    return [];
  }
  async invoke(request: Parameters<CapabilityProvider["invoke"]>[0]) {
    return { status: "BLOCKED" as const, call_id: request.call_id, capability_id: request.capability_id, reason: "no capability authorized", duration_ms: 0 };
  }
}

const host: AgentDefinition = {
  id: "observability-ai-systems-harness",
  role: "reference",
  objective: "reference",
  model_policy: { routing_class: "DEFAULT", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 32, max_items: 1, allowed_sources: ["CURRENT_TASK"], require_source_refs: true },
  state_schema: { type: "object" },
  tools: [],
  skills: [OBSERVABILITY_SKILL_ID],
  capabilities: [],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 1, timeout_ms: 1000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" },
  rubric: { quality_contract_ref: "S13P_OBSERVABILITY_AI_SYSTEMS_DEEP" },
  evals: ["eval:s13p"],
};

const runPlan = (input: ObservabilityBuildInput, withSkill: boolean) =>
  planObservability(input, {
    baseDefinition: host,
    ...(withSkill ? { skillProvider: new LocalReferenceSkillProvider(referenceSkillCatalogEntries) } : {}),
    modelProvider: new BundleProvider(),
    capabilityProvider: new EmptyCapabilityProvider(),
  });

// ---------------------------------------------------------------------------
// Deterministic mechanics
// ---------------------------------------------------------------------------
describe("S13P deterministic observability mechanics", () => {
  it("builds a COMPLETE minimal run and never mutates the input", () => {
    const inp = F.minimalCompleteRun();
    const before = JSON.stringify(inp);
    const r = buildObservabilityBundle(inp);
    expect(r.status).toBe("COMPLETE");
    expect(JSON.stringify(inp)).toBe(before);
    expect(Object.isFrozen(r)).toBe(true);
    expect(() => buildObservabilityBundle(null)).not.toThrow();
    expect(buildObservabilityBundle(null).status).toBe("REJECTED");
  });

  it("is deterministic: byte-equal inputs give byte-equal bundles", () => {
    const a = buildObservabilityBundle(F.minimalCompleteRun());
    const b = buildObservabilityBundle(F.minimalCompleteRun());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("preserves unknown metrics and never coerces missing tokens to zero", () => {
    const r = buildObservabilityBundle(F.input([F.runStarted(1), F.usage(2, { inputTokens: 10 }), F.runTerminated(3)]));
    expect(r.status).toBe("PARTIAL");
    expect(r.aggregates.tokens.output.callsMissing).toBe(1);
    expect(r.aggregates.tokens.total.callsMissing).toBe(1);
    expect(r.aggregates.tokens.output.observedSum).toBe(0);
    expect(r.aggregates.tokens.output.callsObserved).toBe(0);
  });

  it("groups cost by currency with exact decimal arithmetic and never a cross-currency total", () => {
    const r = buildObservabilityBundle(
      F.input([
        F.runStarted(1),
        F.cost(2, "0.100001", "USD"),
        F.cost(3, "0.200002", "USD", { callId: "call_2" }),
        F.cost(4, "5.00", "EUR", { callId: "call_3" }),
        F.runTerminated(5),
      ]),
    );
    expect(r.aggregates.crossCurrencyTotal).toBeNull();
    expect(r.aggregates.costByCurrency.find((c) => c.currency === "USD")?.observedAmount).toBe("0.300003");
    expect(r.aggregates.costByCurrency.map((c) => c.currency).sort()).toEqual(["EUR", "USD"]);
  });

  it("applies deterministic SHA-256 sampling only to eligible detail", () => {
    const detail = Array.from({ length: 12 }, (_, i) => F.promptResolved(i + 2, {}));
    const inp = F.input([F.runStarted(1), ...detail, F.runTerminated(14)], { policy: F.policy({ successDetailSamplingBasisPoints: 5000 }) });
    const r1 = buildObservabilityBundle(inp);
    const r2 = buildObservabilityBundle(clone(inp));
    expect(r1.sampling.sampledOutDetail).toBeGreaterThan(0);
    expect(r1.sampling.sampledOutDetail).toBe(r2.sampling.sampledOutDetail);
    expect(r1.observations.some((o) => o.kind === "OBSERVATION_DROPPED_SUMMARY")).toBe(true);
    expect(r1.status).toBe("PARTIAL");
  });

  it("recomputes effective priority so caller priority cannot make required evidence sampleable", () => {
    const sneaky = { ...(F.runTerminated(3) as unknown as Record<string, unknown>), priority: "DETAIL" } as never;
    const r = buildObservabilityBundle(F.input([F.runStarted(1), F.promptResolved(2), sneaky], { policy: F.policy({ successDetailSamplingBasisPoints: 0 }) }));
    expect(r.observations.some((o) => o.kind === "RUN_TERMINATED")).toBe(true);
    expect(r.status).not.toBe("REJECTED");
  });

  it("candidate gate recomputes the canonical bundle rather than trusting a candidate", () => {
    const inp = F.minimalCompleteRun();
    const candidate = { ...buildObservabilityBundle(inp), status: "COMPLETE" as const, serializedBytes: 5 };
    const gated = evaluateObservabilityCandidateGate(inp, candidate);
    expect(gated.decision.status).toBe("REJECTED");
    expect(gated.candidate).toBe(candidate);
    expect(evaluateObservabilityCandidateGate(inp, buildObservabilityBundle(inp)).decisionValidation.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Canonical positive fixtures — exactly 14 (P01..P14)
// ---------------------------------------------------------------------------
const digest64 = `sha256:${"a".repeat(64)}` as const;

const positives: Array<[string, () => ObservabilityBuildInput, ObservabilityBuildResult["status"]]> = [
  ["P01_MINIMAL_COMPLETE_RUN", () => F.minimalCompleteRun(), "COMPLETE"],
  [
    "P02_SAFE_PROMPT_VERSION",
    () => F.input([F.runStarted(1), F.promptResolved(2, { priority: "NORMAL", templateDigest: digest64 }), F.runTerminated(3)], { policy: F.policy({ allowTemplateDigest: true }) }),
    "COMPLETE",
  ],
  ["P03_MODEL_CALL_LATENCY", () => F.input([F.runStarted(1), F.modelStarted(2), F.modelCompleted(3), F.latency(4, "MODEL_CALL", 1200), F.runTerminated(5)]), "COMPLETE"],
  ["P04_SAFE_TOOL_CALL", () => F.input([F.runStarted(1), F.toolStarted(2), F.toolCompleted(3), F.runTerminated(4)]), "COMPLETE"],
  ["P05_PARTIAL_USAGE_UNKNOWN", () => F.input([F.runStarted(1), F.usage(2, { inputTokens: 40 }), F.runTerminated(3)]), "PARTIAL"],
  [
    "P06_CONSISTENT_TOKEN_COMPONENTS",
    () => F.input([F.runStarted(1), F.usage(2, { inputTokens: 30, outputTokens: 12, totalTokens: 42, cachedInputTokens: 8 }), F.runTerminated(3)]),
    "COMPLETE",
  ],
  ["P07_SINGLE_CURRENCY_COST", () => F.input([F.runStarted(1), F.cost(2, "1.25", "USD"), F.cost(3, "0.75", "USD", { callId: "call_2" }), F.runTerminated(4)]), "COMPLETE"],
  [
    "P08_MULTI_CURRENCY_NO_TOTAL",
    () => F.input([F.runStarted(1), F.cost(2, "1.25", "USD"), F.cost(3, "3.00", "EUR", { callId: "call_2" }), F.runTerminated(4)]),
    "COMPLETE",
  ],
  ["P09_NORMALIZED_ERROR", () => F.input([F.runStarted(1), F.errorObserved(2), F.runTerminated(3, "FAILURE", "FAILED")]), "COMPLETE"],
  [
    "P10_ASYNC_JOB_ATTEMPT_CORRELATION",
    () =>
      F.input([
        F.runStarted(1),
        F.asyncObserved(2, "OPERATION_OBSERVED", "STARTED"),
        F.asyncObserved(3, "JOB_OBSERVED", "STARTED", { jobId: "job_1" }),
        F.asyncObserved(4, "ATTEMPT_OBSERVED", "COMPLETED", { jobId: "job_1", attemptId: "att_1", attemptNumber: 1, outcome: "SUCCESS" }),
        F.runTerminated(5),
      ]),
    "COMPLETE",
  ],
  [
    "P11_EXPLICIT_MISSING_PARENT_PARTIAL",
    () =>
      F.input([
        F.runStarted(1),
        { ...(F.modelStarted(2) as unknown as Record<string, unknown>), spanId: "span_child", parentSpanId: "span_absent", missingParent: true } as never,
        F.modelCompleted(3),
        F.runTerminated(4),
      ]),
    "PARTIAL",
  ],
  [
    "P12_DETERMINISTIC_SAMPLING",
    () => F.input([F.runStarted(1), ...Array.from({ length: 10 }, (_, i) => F.promptResolved(i + 2, {})), F.runTerminated(12)], { policy: F.policy({ successDetailSamplingBasisPoints: 4000 }) }),
    "PARTIAL",
  ],
  [
    "P13_BOUNDED_DETAIL_OVERFLOW",
    () =>
      F.input(
        [
          F.runStarted(1),
          F.modelStarted(2, "call_a"),
          { ...(F.modelStarted(3, "call_b") as unknown as Record<string, unknown>), modelRef: "model_z" } as never,
          F.runTerminated(4),
        ],
        { policy: F.policy({ limits: { maxModelRefsPerRun: 1 } }) },
      ),
    "PARTIAL",
  ],
  [
    "P14_AUDIT_REF_ONLY_NO_PERSISTENCE",
    () => F.input([F.runStarted(1), F.runTerminated(2)], { policy: F.policy({ requestedRetention: { class: "AUDIT_REF_ONLY", days: 20 } }) }),
    "COMPLETE",
  ],
];

describe("S13P canonical positive fixtures — 14/14", () => {
  it("declares exactly fourteen unique positive ids", () => {
    expect(positives).toHaveLength(14);
    expect(new Set(positives.map(([id]) => id)).size).toBe(14);
  });
  it.each(positives)("%s builds the expected status with no prohibited content", (_id, make, status) => {
    const r = buildObservabilityBundle(make());
    expect(r.status).toBe(status);
    expect(JSON.stringify(r)).not.toMatch(/private[_-]?key|bearer |authorization|api[_-]?key/i);
    expect(r.retention.persistencePerformed).toBe(false);
    if (_id === "P14_AUDIT_REF_ONLY_NO_PERSISTENCE") {
      expect(r.retention.class).toBe("AUDIT_REF_ONLY");
      expect(r.retention.days).toBe(20);
    }
    if (_id === "P08_MULTI_CURRENCY_NO_TOTAL") expect(r.aggregates.crossCurrencyTotal).toBeNull();
    if (_id === "P13_BOUNDED_DETAIL_OVERFLOW") expect(r.diagnostics.some((d) => d.code === "CARDINALITY_LIMIT")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Exact negative inventory — exactly 52 (N01..N52)
// ---------------------------------------------------------------------------
type Neg = [id: string, probe: () => void];

const bundle = (obs: ReturnType<typeof F.runStarted>[], overrides?: Parameters<typeof F.input>[1]) => buildObservabilityBundle(F.input(obs, overrides));
const mut = (o: ReturnType<typeof F.runStarted>, extra: Record<string, unknown>) => ({ ...(o as unknown as Record<string, unknown>), ...extra }) as never;
const expectRejected = (r: ObservabilityBuildResult, code?: string) => {
  expect(r.status).toBe("REJECTED");
  if (code) expect(r.diagnostics.some((d) => d.code === code)).toBe(true);
};
const expectPartialWithReject = (r: ObservabilityBuildResult, code: string) => {
  expect(r.status).toBe("PARTIAL");
  expect(r.diagnostics.some((d) => d.code === code)).toBe(true);
};

const negatives: Neg[] = [
  // N01–N06 run/trace identity
  ["N01", () => expectRejected(buildObservabilityBundle(F.input([F.runStarted(1), F.runTerminated(2)], { run: { runId: "", traceId: "trace_alpha" } as never })), "INVALID_RUN_IDENTITY")],
  ["N02", () => expectRejected(buildObservabilityBundle(F.input([F.runStarted(1), F.runTerminated(2)], { run: { runId: "bad run!", traceId: "trace_alpha" } as never })), "INVALID_RUN_IDENTITY")],
  ["N03", () => expectRejected(buildObservabilityBundle(F.input([F.runStarted(1), F.runTerminated(2)], { run: { runId: "run_alpha", traceId: "https://evil.example/x" } as never })), "INVALID_RUN_IDENTITY")],
  ["N04", () => expectRejected(bundle([mut(F.runStarted(1), { runId: "other_run" }), F.runTerminated(2)]), "CROSS_RUN_IDENTITY")],
  ["N05", () => expectRejected(bundle([F.runStarted(1), mut(F.runTerminated(2), { traceId: "other_trace" })]), "CROSS_RUN_IDENTITY")],
  ["N06", () => expectRejected(buildObservabilityBundle(F.input([F.runStarted(1), F.runTerminated(2)], { run: { traceId: "trace_alpha" } as never })), "INVALID_RUN_IDENTITY")],

  // N07–N12 sequence / span / terminal
  ["N07", () => expectRejected(bundle([F.runStarted(1), mut(F.promptResolved(2), { observationId: "obs_1" }), F.runTerminated(3)]), "DUPLICATE_OBSERVATION_ID")],
  ["N08", () => expectRejected(bundle([F.runStarted(1), mut(F.promptResolved(2), { sequence: 1 }), F.runTerminated(3)]), "DUPLICATE_SEQUENCE")],
  ["N09", () => expectRejected(bundle([F.runStarted(1), mut(F.modelStarted(2), { spanId: "s1", parentSpanId: "s2" }), mut(F.modelCompleted(3), { spanId: "s2", parentSpanId: "s1" }), F.runTerminated(4)]), "CYCLIC_SPAN_GRAPH")],
  ["N10", () => expectRejected(bundle([F.runStarted(1), mut(F.modelStarted(2), { spanId: "s_child", parentSpanId: "s_absent" }), F.runTerminated(3)]), "MISSING_PARENT_SPAN")],
  ["N11", () => { const r = bundle([F.runStarted(1), mut(F.modelStarted(2), { parentSpanId: "sx", missingParent: true }), F.runTerminated(3)]); expect(r.status).not.toBe("COMPLETE"); }],
  ["N12", () => expectRejected(bundle([F.runStarted(1), F.runTerminated(2), F.runTerminated(3)]), "INVALID_PHASE_TRANSITION")],

  // N13–N20 prohibited raw / sensitive fields
  ["N13", () => expectRejected(bundle([F.runStarted(1), mut(F.promptResolved(2), { promptText: "the raw user prompt" }), F.runTerminated(3)]), "PROHIBITED_FIELD")],
  ["N14", () => expectRejected(bundle([F.runStarted(1), mut(F.promptResolved(2), { messages: ["hi"] }), F.runTerminated(3)]), "PROHIBITED_FIELD")],
  ["N15", () => expectRejected(bundle([F.runStarted(1), mut(F.promptResolved(2), { context: "retrieved doc body" }), F.runTerminated(3)]), "PROHIBITED_FIELD")],
  ["N16", () => expectRejected(bundle([F.runStarted(1), mut(F.toolStarted(2), { toolInput: { q: 1 } }), F.toolCompleted(3), F.runTerminated(4)]), "PROHIBITED_FIELD")],
  ["N17", () => expectRejected(bundle([F.runStarted(1), F.toolStarted(2), mut(F.toolCompleted(3), { toolOutput: "rows" }), F.runTerminated(4)]), "PROHIBITED_FIELD")],
  ["N18", () => expectRejected(bundle([F.runStarted(1), mut(F.modelStarted(2), { headers: { a: "b" } }), F.runTerminated(3)]), "PROHIBITED_FIELD")],
  ["N19", () => expectRejected(buildObservabilityBundle(F.input([F.runStarted(1), F.runTerminated(2)], { evidenceRefs: ["authorization=Bearer sk-secret-value-1234"] })), "UNSAFE_REF")],
  ["N20", () => expectRejected(bundle([F.runStarted(1), mut(F.modelCompleted(3), { provider_metadata: { region: "us" } }), F.modelStarted(2), F.runTerminated(4)]), "PROHIBITED_FIELD")],

  // N21–N25 prompt / model identity and digest
  ["N21", () => expectPartialWithReject(bundle([F.runStarted(1), F.promptResolved(2, { priority: "NORMAL", templateDigest: "sha256:tooshort" }), F.runTerminated(3)], { policy: F.policy({ allowTemplateDigest: true }) }), "INVALID_DIGEST")],
  ["N22", () => expectPartialWithReject(bundle([F.runStarted(1), F.promptResolved(2, { priority: "NORMAL", promptRef: "bad ref!" }), F.runTerminated(3)]), "UNSAFE_REF")],
  ["N23", () => expectPartialWithReject(bundle([F.runStarted(1), mut(F.modelStarted(2), { priority: "NORMAL", modelRef: "model with spaces" }), F.runTerminated(3)]), "UNSAFE_REF")],
  ["N24", () => expectPartialWithReject(bundle([F.runStarted(1), mut(F.modelCompleted(3), { priority: "NORMAL", phase: "STARTED" }), F.runTerminated(4)]), "INVALID_PHASE_TRANSITION")],
  ["N25", () => expectRejected(bundle([F.runStarted(1), mut(F.modelStarted(2), { account: "acct_123" }), F.runTerminated(3)]), "PROHIBITED_FIELD")],

  // N26–N31 token truth
  ["N26", () => expectPartialWithReject(bundle([F.runStarted(1), F.usage(2, { inputTokens: -5 }), F.runTerminated(3)]), "TOKEN_TOTAL_MISMATCH")],
  ["N27", () => expectPartialWithReject(bundle([F.runStarted(1), F.usage(2, { inputTokens: 1.5 }), F.runTerminated(3)]), "TOKEN_TOTAL_MISMATCH")],
  ["N28", () => expectPartialWithReject(bundle([F.runStarted(1), F.usage(2, { inputTokens: 10, outputTokens: 5, totalTokens: 20 }), F.runTerminated(3)]), "TOKEN_TOTAL_MISMATCH")],
  ["N29", () => expectPartialWithReject(bundle([F.runStarted(1), F.usage(2, { inputTokens: 10, cachedInputTokens: 40 }), F.runTerminated(3)]), "CACHED_TOKEN_MISMATCH")],
  ["N30", () => {
    const inp = F.input([F.runStarted(1), F.usage(2, { inputTokens: 10 }), F.runTerminated(3)]);
    const truth = buildObservabilityBundle(inp);
    const coerced = clone(truth) as ObservabilityBuildResult;
    for (const key of ["input", "output", "total", "cachedInput"] as const)
      (coerced.aggregates.tokens[key] as { callsMissing: number; observedSum: number }).callsMissing = 0;
    (coerced.aggregates.tokens.total as { callsMissing: number; observedSum: number }).observedSum = 10;
    expect(deriveObservabilityUnsafeCounters(inp, coerced, zeroAudit).UC07_MISSING_METRIC_COERCED_TO_ZERO).toBe(1);
    expect(evaluateObservabilityCandidateGate(inp, coerced).decision.status).toBe("REJECTED");
  }],
  ["N31", () => {
    const inp = F.input([F.runStarted(1), F.cost(2, "1.00", "USD"), F.runTerminated(3)]);
    const truth = buildObservabilityBundle(inp);
    const invented = clone(truth) as ObservabilityBuildResult;
    (invented.observations as unknown as Array<Record<string, unknown>>).push({ ...(F.cost(4, "9.99", "USD", { pricingRef: "inferred", callId: "call_2" }) as unknown as Record<string, unknown>) });
    expect(deriveObservabilityUnsafeCounters(inp, invented, zeroAudit).UC08_TOKEN_OR_COST_INFERRED).toBe(1);
    expect(evaluateObservabilityCandidateGate(inp, invented).decision.status).toBe("REJECTED");
  }],

  // N32–N37 cost / currency truth
  ["N32", () => expectPartialWithReject(bundle([F.runStarted(1), F.cost(2, "1,000", "USD"), F.runTerminated(3)]), "INVALID_COST")],
  ["N33", () => expectPartialWithReject(bundle([F.runStarted(1), F.cost(2, "-5.00", "USD"), F.runTerminated(3)]), "INVALID_COST")],
  ["N34", () => expectPartialWithReject(bundle([F.runStarted(1), F.cost(2, "1e3", "USD"), F.runTerminated(3)]), "INVALID_COST")],
  ["N35", () => {
    const inp = F.input([F.runStarted(1), F.cost(2, "1.00", "USD"), F.cost(3, "2.00", "EUR", { callId: "call_2" }), F.runTerminated(4)]);
    const truth = buildObservabilityBundle(inp);
    const fx = clone(truth) as ObservabilityBuildResult;
    (fx.aggregates as { crossCurrencyTotal: string | null }).crossCurrencyTotal = "3.00";
    expect(deriveObservabilityUnsafeCounters(inp, fx, zeroAudit).UC09_MIXED_CURRENCY_TOTAL_CREATED).toBe(1);
    expect(evaluateObservabilityCandidateGate(inp, fx).decision.status).toBe("REJECTED");
  }],
  ["N36", () => expectPartialWithReject(bundle([F.runStarted(1), F.cost(2, "1.00", "usd"), F.runTerminated(3)]), "INVALID_COST")],
  ["N37", () => expectRejected(bundle([F.runStarted(1), F.cost(2, "1", "USD"), F.cost(3, "1", "EUR", { callId: "c2" }), F.cost(4, "1", "GBP", { callId: "c3" }), F.cost(5, "1", "JPY", { callId: "c4" }), F.cost(6, "1", "CHF", { callId: "c5" }), F.runTerminated(7)]), "CARDINALITY_LIMIT")],

  // N38–N42 time / latency / ordering
  ["N38", () => expectRejected(bundle([mut(F.runStarted(1), { occurredAt: "not-a-timestamp" }), F.runTerminated(2)]), "INVALID_TIMESTAMP")],
  ["N39", () => expectPartialWithReject(bundle([F.runStarted(1), F.latency(2, "RUN", -1), F.runTerminated(3)]), "INVALID_DURATION")],
  ["N40", () => expectPartialWithReject(bundle([F.runStarted(1), F.latency(2, "RUN", 604_800_001), F.runTerminated(3)]), "INVALID_DURATION")],
  ["N41", () => expectPartialWithReject(bundle([F.runStarted(1), F.latency(2, "RUN", 999, { clockSource: "WALL_CLOCK_DERIVED", startedAt: F.TS_A, endedAt: F.TS_B }), F.runTerminated(3)]), "INVALID_DURATION")],
  ["N42", () => {
    const inp = F.input([F.runStarted(1), mut(F.promptResolved(2), { occurredAt: F.TS_D }), mut(F.promptResolved(3), { occurredAt: F.TS_A }), F.runTerminated(4)]);
    const truth = buildObservabilityBundle(inp);
    const reordered = clone(truth) as ObservabilityBuildResult;
    (reordered.observations as unknown as Array<Record<string, unknown>>).sort((a, b) => Date.parse(a.occurredAt as string) - Date.parse(b.occurredAt as string));
    expect(evaluateObservabilityCandidateGate(inp, reordered).decision.status === "REJECTED" || JSON.stringify(reordered) !== JSON.stringify(truth)).toBe(true);
    expect(validateObservabilityBundleCandidate(reordered, inp).valid).toBe(false);
  }],

  // N43–N46 normalized error safety
  ["N43", () => expectRejected(bundle([F.runStarted(1), F.errorObserved(2, { code: "lower_case" }), F.runTerminated(3, "FAILURE", "FAILED")]), "UNSAFE_REF")],
  ["N44", () => expectRejected(bundle([F.runStarted(1), F.errorObserved(2, { message: "stack trace here" }), F.runTerminated(3, "FAILURE", "FAILED")]), "PROHIBITED_FIELD")],
  ["N45", () => expectRejected(bundle([F.runStarted(1), F.errorObserved(2, { fingerprint: `sha256:${"b".repeat(64)}` }), F.runTerminated(3, "FAILURE", "FAILED")]), "INVALID_DIGEST")],
  ["N46", () => expectPartialWithReject(bundle([F.runStarted(1), F.errorObserved(2), F.errorObserved(3, { retryable: false }), F.runTerminated(4, "FAILURE", "FAILED")]), "METRIC_CONFLICT")],

  // N47–N49 sampling / cardinality / size
  ["N47", () => {
    const inp = F.minimalCompleteRun();
    const truth = buildObservabilityBundle(inp);
    const sampledRequired = clone(truth) as ObservabilityBuildResult;
    (sampledRequired.observations as unknown as Array<Record<string, unknown>>).push({
      schemaVersion: "s13p.observation.v1", observationId: "obs_ds", runId: "run_alpha", traceId: "trace_alpha", sequence: 99,
      occurredAt: F.TS_A, observedAt: F.TS_A, source: "CALLER_SAFE", kind: "OBSERVATION_DROPPED_SUMMARY", priority: "REQUIRED",
      reason: "SAMPLING", droppedCount: 1, droppedKinds: ["RUN_TERMINATED"],
    });
    expect(deriveObservabilityUnsafeCounters(inp, sampledRequired, zeroAudit).UC12_REQUIRED_EVIDENCE_SAMPLED_OUT).toBe(1);
    expect(evaluateObservabilityCandidateGate(inp, sampledRequired).decision.status).toBe("REJECTED");
  }],
  ["N48", () => {
    const spans = Array.from({ length: 260 }, (_, i) => mut(F.promptResolved(i + 2, {}), { spanId: `sp_${i}` }));
    const r = bundle([F.runStarted(1), ...spans, F.runTerminated(262)]);
    expect(r.status).toBe("PARTIAL");
    expect(r.diagnostics.some((d) => d.code === "CARDINALITY_LIMIT")).toBe(true);
  }],
  ["N49", () => {
    const big = Array.from({ length: 40 }, (_, i) => F.promptResolved(i + 2, { promptRef: `p_${"x".repeat(100)}_${i}`, promptVersion: `v_${"y".repeat(100)}` }));
    const r = bundle([F.runStarted(1), ...big, F.runTerminated(42)], { policy: F.policy({ limits: { maxBundleBytes: 4096 } }) });
    expect(r.status === "PARTIAL" || r.status === "REJECTED").toBe(true);
    expect(r.diagnostics.some((d) => d.code === "SERIALIZED_SIZE_LIMIT")).toBe(true);
  }],

  // N50–N52 retention / boundary / self-certification
  ["N50", () => {
    const r = bundle([F.runStarted(1), F.runTerminated(2)], { policy: F.policy({ requestedRetention: { class: "OPERATIONAL", days: 999 } }) });
    expect(r.status).toBe("PARTIAL");
    expect(r.retention.days).toBe(7);
    expect(r.retention.downgradedFromRequest).toBe(true);
    expect(r.diagnostics.some((d) => d.code === "RETENTION_DOWNGRADED")).toBe(true);
  }],
  ["N51", () => {
    const source = implementationSource();
    expect(source).not.toMatch(/from ["'][^"']*(?:opentelemetry|prometheus|datadog|@aws|@azure|@google|bullmq|redis|kafka|node:net|node:http|undici|axios)|createServer\(|\.listen\(|new Pool\(|\bfetch\s*\(/i);
    expect(source).not.toMatch(/import[^;]*\b(?:Exporter|Collector|Dashboard|TelemetrySdk)\b/);
    expect(source).not.toMatch(/writeFileSync|appendFileSync|createWriteStream/);
  }],
  ["N52", () => {
    const inp = F.minimalCompleteRun();
    const truth = buildObservabilityBundle(inp);
    const selfCert = { ...clone(truth), pass: true } as unknown as ObservabilityBuildResult;
    expect(deriveObservabilityUnsafeCounters(inp, selfCert, { ...zeroAudit, selfCertifiedPass: true }).UC16_CANDIDATE_SELF_CERTIFIED_PASS).toBe(1);
    expect(validateObservabilityBundleCandidate(selfCert, inp).valid).toBe(false);
  }],
];

const implementationSource = () =>
  ["constants.ts", "types.ts", "validateObservabilityPolicy.ts", "validateSafeObservation.ts", "buildTraceIndex.ts", "applyDeterministicSampling.ts", "aggregateObservedUsage.ts", "buildObservabilityBundle.ts", "quality.ts", "planObservability.ts", "observabilityAiSystemsSkill.ts", "index.ts"]
    .map((n) => readFileSync(new URL(`../../src/intelligence/observability-ai-systems/${n}`, import.meta.url), "utf8"))
    .join("\n");

describe("S13P exact negative inventory — 52/52", () => {
  it("names exactly N01..N52", () => {
    expect(negatives.map(([id]) => id)).toEqual(Array.from({ length: 52 }, (_, i) => `N${String(i + 1).padStart(2, "0")}`));
    expect(new Set(negatives.map(([id]) => id)).size).toBe(52);
  });
  it.each(negatives)("%s detects its violation without a default/coercion pass", (_id, probe) => probe());
});

// ---------------------------------------------------------------------------
// Atomic isolation — exactly 32
// ---------------------------------------------------------------------------
describe("S13P atomic isolation — 32/32", () => {
  it("maps 32 assertion ids across the 10 declared semantic dimensions", () => {
    expect(OBSERVABILITY_ATOMIC_IDS).toHaveLength(32);
    expect(Object.values(OBSERVABILITY_DIMENSIONS).flat().sort()).toEqual([...OBSERVABILITY_ATOMIC_IDS].sort());
    const qc = readFileSync(new URL("../../brain-bootstrap/quality-contracts/S13P_OBSERVABILITY_AI_SYSTEMS_DEEP.yaml", import.meta.url), "utf8");
    for (const id of OBSERVABILITY_ATOMIC_IDS) expect(qc).toContain(`- id: ${id}`);
  });

  it("proves 32/32 single-assertion isolation through real evaluator recomputation", () => {
    const inp = richScenario();
    const before = JSON.stringify(inp);
    const facts = deriveObservabilitySourceFacts(inp);
    const factsBefore = JSON.stringify(facts);
    const baseObs = evaluateObservabilityAtomicObservations(inp, facts);
    expect(OBSERVABILITY_ATOMIC_IDS.every((id) => baseObs[id].correct)).toBe(true);

    let passes = 0;
    for (const id of OBSERVABILITY_ATOMIC_IDS) {
      const detached = structuredClone(facts) as ObservabilitySourceFacts;
      mutateObservabilitySourceFact(detached, id);
      const after = evaluateObservabilityAtomicObservations(inp, detached);
      const changed = OBSERVABILITY_ATOMIC_IDS.filter((k) => baseObs[k].correct !== after[k].correct);
      expect(changed, id).toEqual([id]);
      expect(after[id].actual_observation).toEqual(baseObs[id].actual_observation);
      expect(detached).not.toBe(facts);
      passes++;
    }
    expect(passes).toBe(32);
    expect(JSON.stringify(facts)).toBe(factsBefore);
    expect(JSON.stringify(inp)).toBe(before);
  });
});

function richScenario(): ObservabilityBuildInput {
  return F.input([
    F.runStarted(1),
    F.promptResolved(2, {}),
    F.modelStarted(3),
    F.modelCompleted(4),
    F.toolStarted(5),
    F.toolCompleted(6),
    F.usage(7, { inputTokens: 20, outputTokens: 8, totalTokens: 28 }),
    F.cost(8, "1.50", "USD"),
    F.latency(9, "MODEL_CALL", 1200),
    F.asyncObserved(10, "JOB_OBSERVED", "COMPLETED", { jobId: "job_1", outcome: "SUCCESS" }),
    F.runTerminated(11),
  ]);
}

// ---------------------------------------------------------------------------
// A/B impact gate — 12 frozen scenarios, 32 atomic assertions per arm
// ---------------------------------------------------------------------------
const abScenarios: Array<[string, () => ObservabilityBuildInput]> = [
  ["AB01_COMPLETE_RUN", () => richScenario()],
  ["AB02_PARTIAL_USAGE", () => F.input([F.runStarted(1), F.usage(2, { inputTokens: 15 }), F.modelStarted(3), F.modelCompleted(4), F.runTerminated(5)])],
  ["AB03_MULTI_MODEL_TOOL", () => F.input([F.runStarted(1), F.modelStarted(2, "c1"), F.modelCompleted(3, "c1"), F.toolStarted(4, "t1"), F.toolCompleted(5, "t1"), F.toolStarted(6, "t2"), F.toolCompleted(7, "t2"), F.runTerminated(8)])],
  ["AB04_PROMPT_MODEL_VERSIONING", () => F.input([F.runStarted(1), F.promptResolved(2, { priority: "NORMAL", templateDigest: digest64 }), F.modelStarted(3), F.modelCompleted(4), F.runTerminated(5)], { policy: F.policy({ allowTemplateDigest: true }) })],
  ["AB05_ASYNC_ATTEMPTS", () => F.input([F.runStarted(1), F.asyncObserved(2, "OPERATION_OBSERVED", "STARTED"), F.asyncObserved(3, "ATTEMPT_OBSERVED", "FAILED", { attemptId: "a1", attemptNumber: 1, errorCode: "TIMEOUT" }), F.asyncObserved(4, "ATTEMPT_OBSERVED", "COMPLETED", { attemptId: "a2", attemptNumber: 2, outcome: "SUCCESS" }), F.runTerminated(5)])],
  ["AB06_MULTI_CURRENCY", () => F.input([F.runStarted(1), F.cost(2, "1.25", "USD"), F.cost(3, "2.50", "EUR", { callId: "c2" }), F.cost(4, "0.10", "USD", { callId: "c3" }), F.runTerminated(5)])],
  ["AB07_LATE_PARTIAL_TRACE", () => F.input([F.runStarted(1), F.modelCompleted(2, "orphan"), F.runTerminated(3)])],
  ["AB08_PRIVACY_ATTACK", () => F.input([F.runStarted(1), F.promptResolved(2, {}), F.modelStarted(3), F.modelCompleted(4), F.runTerminated(5)])],
  ["AB09_CARDINALITY_PRESSURE", () => F.input([F.runStarted(1), ...Array.from({ length: 6 }, (_, i) => mut(F.modelStarted(i + 2, `c_${i}`), { modelRef: `m_${i}` })), F.runTerminated(8)], { policy: F.policy({ limits: { maxModelRefsPerRun: 2 } }) })],
  ["AB10_RETENTION_SAMPLING", () => F.input([F.runStarted(1), ...Array.from({ length: 8 }, (_, i) => F.promptResolved(i + 2, {})), F.runTerminated(10)], { policy: F.policy({ successDetailSamplingBasisPoints: 3000, requestedRetention: { class: "OPERATIONAL", days: 60 } }) })],
  ["AB11_BOUNDARY_PRESSURE", () => F.input([F.runStarted(1), F.usage(2, { inputTokens: 10, outputTokens: 4, totalTokens: 14 }), F.cost(3, "0.01", "USD"), F.latency(4, "RUN", 500), F.runTerminated(5)])],
  ["AB12_CONFLICTING_EVIDENCE", () => F.input([F.runStarted(1), F.errorObserved(2), F.errorObserved(3, { retryable: false }), F.runTerminated(4, "FAILURE", "FAILED")])],
];

function scoreAtomics(
  inp: ObservabilityBuildInput,
  decision: ObservabilityBuildResult,
  facts: ObservabilitySourceFacts,
  audit: ObservabilityEvaluationAudit,
): Record<ObservabilityAtomicId, boolean> {
  const obs = evaluateObservabilityAtomicObservations(inp, facts, decision, audit);
  return Object.fromEntries(OBSERVABILITY_ATOMIC_IDS.map((id) => [id, obs[id].correct])) as Record<ObservabilityAtomicId, boolean>;
}

describe("S13P real same-path A/B impact gate", () => {
  it("declares exactly twelve unique scenario ids", () => {
    expect(abScenarios).toHaveLength(12);
    expect(new Set(abScenarios.map(([id]) => id)).size).toBe(12);
  });

  it("Skill arm strictly improves distributed post-gate atomic correctness with no regressions", async () => {
    const inputs = abScenarios.map(([, make]) => make());
    const audits: ObservabilityEvaluationAudit[] = inputs.map((v) => {
      const s = JSON.stringify(v);
      return { input_snapshot_before: s, input_snapshot_after: s, candidate_gate_valid: true, provider_fixture_or_arm_branching: false, future_stage_or_dependency_pull_forward: false };
    });
    const facts = inputs.map((v, i) => deriveObservabilitySourceFacts(v, audits[i]));

    const baseline = await Promise.all(inputs.map((v) => runPlan(v, false)));
    const skill = await Promise.all(inputs.map((v) => runPlan(v, true)));

    expect(inputs.every((v, i) => baseline[i].visiblePacket === v && skill[i].visiblePacket === v)).toBe(true);
    expect(baseline.every((r, i) => r.materializedDefinition.objective !== skill[i].materializedDefinition.objective)).toBe(true);
    expect(baseline.some((r) => !r.decisionValidation.valid && r.decision.status === "REJECTED")).toBe(true);
    expect(skill.every((r) => r.decisionValidation.valid)).toBe(true);

    const mkAudit = (r: (typeof baseline)[number], i: number): ObservabilityEvaluationAudit => ({
      ...audits[i],
      input_snapshot_before: r.inputSnapshotBefore,
      input_snapshot_after: r.inputSnapshotAfter,
      candidate_gate_valid: r.decisionValidation.valid,
    });
    const baseAtoms = baseline.map((r, i) => scoreAtomics(inputs[i], r.decision, facts[i], mkAudit(r, i)));
    const skillAtoms = skill.map((r, i) => scoreAtomics(inputs[i], r.decision, facts[i], mkAudit(r, i)));

    const total = (rows: readonly Record<ObservabilityAtomicId, boolean>[]) =>
      rows.reduce((s, row) => s + OBSERVABILITY_ATOMIC_IDS.filter((id) => row[id]).length, 0);

    const regressions: string[] = [];
    let maxSingleAssertionDelta = 0;
    let positiveDelta = 0;
    const dimensionReport = Object.entries(OBSERVABILITY_DIMENSIONS).map(([dimension, ids]) => {
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

    const baselineTotal = total(baseAtoms);
    const skillTotal = total(skillAtoms);
    const qualifiedDimensions = dimensionReport.filter((d) => d.qualified).length;
    const globalMaxShare = positiveDelta === 0 ? 0 : maxSingleAssertionDelta / positiveDelta;
    const report = { baselineTotal, skillTotal, delta: skillTotal - baselineTotal, qualifiedDimensions, regressions, globalMaxShare, dimensionReport };

    expect(report.regressions, JSON.stringify(report)).toEqual([]);
    expect(report.skillTotal, JSON.stringify(report)).toBeGreaterThan(report.baselineTotal);
    expect(report.qualifiedDimensions, JSON.stringify(report)).toBeGreaterThanOrEqual(7);
    expect(report.globalMaxShare, JSON.stringify(report)).toBeLessThanOrEqual(0.5);

    // Unsafe counters zero for every Skill-arm candidate.
    const aggregate = Object.fromEntries(
      Object.keys(deriveObservabilityUnsafeCounters(inputs[0], skill[0].decision, zeroAudit)).map((k) => [k, 0]),
    ) as Record<string, number>;
    for (let i = 0; i < inputs.length; i++) {
      const counters = deriveObservabilityUnsafeCounters(inputs[i], skill[i].decision, zeroAudit);
      for (const [k, v] of Object.entries(counters)) aggregate[k] += v;
    }
    expect(Object.values(aggregate)).toEqual(Array(16).fill(0));

    // 32/32 atomic isolation still holds on a representative scenario.
    const isoFacts = deriveObservabilitySourceFacts(inputs[0]);
    const isoBase = evaluateObservabilityAtomicObservations(inputs[0], isoFacts);
    let isoPass = 0;
    for (const id of OBSERVABILITY_ATOMIC_IDS) {
      const detached = structuredClone(isoFacts) as ObservabilitySourceFacts;
      mutateObservabilitySourceFact(detached, id);
      const after = evaluateObservabilityAtomicObservations(inputs[0], detached);
      if (OBSERVABILITY_ATOMIC_IDS.filter((k) => isoBase[k].correct !== after[k].correct).join() === id) isoPass++;
    }
    expect(isoPass).toBe(32);
  }, 20000);
});

// ---------------------------------------------------------------------------
// Hard invariants — HI-001 .. HI-024 (recomputed outside the candidate)
// ---------------------------------------------------------------------------
describe("S13P hard invariants — 24/24", () => {
  it("recomputes HI-001 through HI-024 individually", () => {
    const rich = richScenario();
    const richBefore = JSON.stringify(rich);
    const truth = buildObservabilityBundle(rich);
    const protectedSource = ["src/core/agent/index.ts", "src/core/agent/types.ts", "src/core/skill/types.ts", "src/intelligence/skills/selectSkillForTask.ts"]
      .map((n) => readFileSync(new URL(`../../${n}`, import.meta.url), "utf8"))
      .join("\n");
    const impl = implementationSource();
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

    const crossRun = buildObservabilityBundle(F.input([F.runStarted(1), mut(F.runTerminated(2), { runId: "other" })]));
    const prohibited = buildObservabilityBundle(F.input([F.runStarted(1), mut(F.promptResolved(2), { secret: "x" }), F.runTerminated(3)]));
    const dupSeq = buildObservabilityBundle(F.input([F.runStarted(1), mut(F.promptResolved(2), { sequence: 1 }), F.runTerminated(3)]));
    const cyclic = buildObservabilityBundle(F.input([F.runStarted(1), mut(F.modelStarted(2), { spanId: "a", parentSpanId: "b" }), mut(F.modelCompleted(3), { spanId: "b", parentSpanId: "a" }), F.runTerminated(4)]));
    const noTerminalOutcome = buildObservabilityBundle(F.input([F.runStarted(1), mut(F.runTerminated(2), { outcome: undefined }) as never]));
    const partialUsage = buildObservabilityBundle(F.input([F.runStarted(1), F.usage(2, { inputTokens: 5 }), F.runTerminated(3)]));
    const badTokenTotal = buildObservabilityBundle(F.input([F.runStarted(1), F.usage(2, { inputTokens: 10, outputTokens: 5, totalTokens: 99 }), F.runTerminated(3)]));
    const badCost = buildObservabilityBundle(F.input([F.runStarted(1), F.cost(2, "-1", "USD"), F.runTerminated(3)]));
    const multiCurrency = buildObservabilityBundle(F.input([F.runStarted(1), F.cost(2, "1", "USD"), F.cost(3, "1", "EUR", { callId: "c2" }), F.runTerminated(4)]));
    const badLatency = buildObservabilityBundle(F.input([F.runStarted(1), F.latency(2, "RUN", 999, { clockSource: "WALL_CLOCK_DERIVED", startedAt: F.TS_A, endedAt: F.TS_C }), F.runTerminated(3)]));
    const rawError = buildObservabilityBundle(F.input([F.runStarted(1), F.errorObserved(2, { stack: "trace" }), F.runTerminated(3, "FAILURE", "FAILED")]));
    const sampled = buildObservabilityBundle(F.input([F.runStarted(1), ...Array.from({ length: 10 }, (_, i) => F.promptResolved(i + 2, {})), F.runTerminated(12)], { policy: F.policy({ successDetailSamplingBasisPoints: 2000 }) }));
    const overRetention = buildObservabilityBundle(F.input([F.runStarted(1), F.runTerminated(2)], { policy: F.policy({ requestedRetention: { class: "AUDIT_REF_ONLY", days: 90 } }) }));
    const currencyOverflow = buildObservabilityBundle(F.input([F.runStarted(1), F.cost(2, "1", "USD"), F.cost(3, "1", "EUR", { callId: "c2" }), F.cost(4, "1", "GBP", { callId: "c3" }), F.cost(5, "1", "JPY", { callId: "c4" }), F.cost(6, "1", "CHF", { callId: "c5" }), F.runTerminated(7)]));
    const selfCert = validateObservabilityBundleCandidate({ ...clone(truth), pass: true }, rich);

    const hi: Record<string, boolean> = {
      "HI-001": truth.observations.every((o) => o.runId === truth.run.runId && o.traceId === truth.run.traceId),
      "HI-002": crossRun.status === "REJECTED" && crossRun.diagnostics.some((d) => d.code === "CROSS_RUN_IDENTITY") && buildObservabilityBundle(F.input([F.runStarted(1), F.runTerminated(2)], { run: { runId: "", traceId: "t" } as never })).status === "REJECTED",
      "HI-003": buildObservabilityBundle(F.input([F.runStarted(1), mut(F.promptResolved(2), { madeUpKey: 1 }), F.runTerminated(3)])).diagnostics.some((d) => d.code === "UNKNOWN_FIELD") && !JSON.stringify(buildObservabilityBundle(F.input([F.runStarted(1), mut(F.promptResolved(2), { madeUpKey: 1 }), F.runTerminated(3)]))).includes("madeUpKey"),
      "HI-004": prohibited.status === "REJECTED" && !JSON.stringify(prohibited).includes('"secret"'),
      "HI-005": buildObservabilityBundle(F.input([F.runStarted(1), F.promptResolved(2, { priority: "NORMAL", templateDigest: "sha256:short" }), F.runTerminated(3)], { policy: F.policy({ allowTemplateDigest: true }) })).diagnostics.some((d) => d.code === "INVALID_DIGEST"),
      "HI-006": buildObservabilityBundle(F.input([F.runStarted(1), mut(F.modelStarted(2), { authorization: "Bearer abcdef123456" }), F.runTerminated(3)])).status === "REJECTED",
      "HI-007": dupSeq.status === "REJECTED" && dupSeq.diagnostics.some((d) => d.code === "DUPLICATE_SEQUENCE"),
      "HI-008": cyclic.status === "REJECTED" && cyclic.diagnostics.some((d) => d.code === "CYCLIC_SPAN_GRAPH"),
      "HI-009": truth.status === "COMPLETE" && noTerminalOutcome.status === "REJECTED",
      "HI-010": partialUsage.status === "PARTIAL" && partialUsage.aggregates.tokens.output.callsMissing === 1 && partialUsage.aggregates.tokens.output.observedSum === 0,
      "HI-011": badTokenTotal.status === "PARTIAL" && badTokenTotal.diagnostics.some((d) => d.code === "TOKEN_TOTAL_MISMATCH"),
      "HI-012": badCost.status === "PARTIAL" && badCost.diagnostics.some((d) => d.code === "INVALID_COST"),
      "HI-013": multiCurrency.aggregates.crossCurrencyTotal === null && multiCurrency.aggregates.costByCurrency.length === 2,
      "HI-014": badLatency.diagnostics.some((d) => d.code === "INVALID_DURATION") && !buildObservabilityBundle(F.input([F.runStarted(1), F.latency(2, "RUN", 10), F.runTerminated(3)])).diagnostics.some((d) => d.code === "INVALID_DURATION"),
      "HI-015": rawError.status === "REJECTED" && !JSON.stringify(rawError).includes('"stack"'),
      "HI-016": sampled.observations.some((o) => o.kind === "RUN_STARTED") && sampled.observations.some((o) => o.kind === "RUN_TERMINATED") && sampled.sampling.sampledOutDetail > 0,
      "HI-017": currencyOverflow.status === "REJECTED" && currencyOverflow.diagnostics.some((d) => d.code === "CARDINALITY_LIMIT"),
      "HI-018": overRetention.retention.days === 30 && overRetention.retention.downgradedFromRequest && overRetention.retention.persistencePerformed === false,
      "HI-019": JSON.stringify(rich) === richBefore && JSON.stringify(buildObservabilityBundle(rich)) === JSON.stringify(truth),
      "HI-020": !/from ["'][^"']*(?:node:fs|node:net|node:http|undici|axios)|Math\.random|Date\.now\(\)|new Date\(\)/.test(impl.replace(/node:crypto/g, "")),
      "HI-021": !/from ["']\.\.\/(?:async-reliability|agent-evals|guardrails-security|backend-api-engineering|postgres-data-modeling|frontend-product-surface|qa-debugging)/.test(impl) && !/observability-ai-systems|S13P/i.test(protectedSource),
      "HI-022": selfCert.valid === false && /self-certifies/i.test(selfCert.errors.join(" ")),
      "HI-023": evaluateObservabilityCandidateGate(rich, { ...clone(truth), status: "COMPLETE", serializedBytes: 1 }).decision.status === "REJECTED",
      "HI-024": readFileSync(new URL("../../brain-bootstrap/skills/OBSERVABILITY_AI_SYSTEMS_SKILL_S13P.md", import.meta.url)).length === 16121 && readFileSync(new URL("../../brain-bootstrap/quality-contracts/S13P_OBSERVABILITY_AI_SYSTEMS_DEEP.yaml", import.meta.url)).length === 20411 && readFileSync(new URL("../../brain-bootstrap/specs/OBSERVABILITY_AI_SYSTEMS_CONTRACT_S13P.md", import.meta.url)).length === 32348 && pkg.dependencies["better-sqlite3"] === "^13.0.3" && !("opentelemetry" in pkg.dependencies) && !("opentelemetry" in pkg.devDependencies),
    };

    expect(Object.keys(hi)).toEqual(Array.from({ length: 24 }, (_, i) => `HI-${String(i + 1).padStart(3, "0")}`));
    for (const [id, passed] of Object.entries(hi)) expect(passed, id).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 16 unsafe counters are zero for every safe candidate
// ---------------------------------------------------------------------------
describe("S13P unsafe counters", () => {
  it("derives all sixteen counters as zero across every positive fixture", () => {
    const aggregate = Object.fromEntries(
      Object.keys(deriveObservabilityUnsafeCounters(F.minimalCompleteRun(), buildObservabilityBundle(F.minimalCompleteRun()), zeroAudit)).map((k) => [k, 0]),
    ) as Record<string, number>;
    for (const [, make] of positives) {
      const inp = make();
      const counters = deriveObservabilityUnsafeCounters(inp, buildObservabilityBundle(inp), zeroAudit);
      for (const [k, v] of Object.entries(counters)) aggregate[k] += v;
    }
    expect(Object.keys(aggregate)).toHaveLength(16);
    expect(Object.values(aggregate)).toEqual(Array(16).fill(0));
  });

  it("each counter can be driven nonzero by a real violation", () => {
    const inp = F.minimalCompleteRun();
    const truth = buildObservabilityBundle(inp);
    const withKey = (o: Record<string, unknown>, key: string, value: unknown) => {
      const c = clone(truth) as ObservabilityBuildResult;
      (c.observations as unknown as Array<Record<string, unknown>>).push({ ...o, [key]: value });
      return c;
    };
    const promptObs = F.promptResolved(9, {}) as unknown as Record<string, unknown>;
    const toolObs = F.toolCompleted(9) as unknown as Record<string, unknown>;
    const errObs = F.errorObserved(9) as unknown as Record<string, unknown>;
    expect(deriveObservabilityUnsafeCounters(inp, withKey(promptObs, "promptRef", "prompt bearer sk-abcdef123456"), zeroAudit).UC01_RAW_PROMPT_OR_CONTEXT_ACCEPTED).toBe(1);
    expect(deriveObservabilityUnsafeCounters(inp, withKey(toolObs, "toolInput", { q: 1 }), zeroAudit).UC02_RAW_TOOL_INPUT_ACCEPTED).toBe(1);
    expect(deriveObservabilityUnsafeCounters(inp, withKey(toolObs, "toolOutput", "rows"), zeroAudit).UC03_RAW_TOOL_OUTPUT_ACCEPTED).toBe(1);
    expect(deriveObservabilityUnsafeCounters(inp, withKey(promptObs, "promptVersion", "authorization=Bearer sk-xyz9876"), zeroAudit).UC04_SECRET_OR_CREDENTIAL_ACCEPTED).toBe(1);
    expect(deriveObservabilityUnsafeCounters(inp, withKey(errObs, "message", "raw provider text"), zeroAudit).UC05_RAW_PROVIDER_ERROR_ACCEPTED).toBe(1);
    expect(deriveObservabilityUnsafeCounters(inp, withKey(errObs, "metadata", { a: 1 }), zeroAudit).UC06_ARBITRARY_PROVIDER_METADATA_ACCEPTED).toBe(1);

    const coerced = clone(buildObservabilityBundle(F.input([F.runStarted(1), F.usage(2, { inputTokens: 1 }), F.runTerminated(3)]))) as ObservabilityBuildResult;
    (coerced.aggregates.tokens.output as { callsMissing: number }).callsMissing = 0;
    (coerced.aggregates.tokens.total as { callsMissing: number }).callsMissing = 0;
    (coerced.aggregates.tokens.input as { callsMissing: number }).callsMissing = 0;
    expect(deriveObservabilityUnsafeCounters(F.input([F.runStarted(1), F.usage(2, { inputTokens: 1 }), F.runTerminated(3)]), coerced, zeroAudit).UC07_MISSING_METRIC_COERCED_TO_ZERO).toBe(1);

    const inferred = clone(truth) as ObservabilityBuildResult;
    (inferred.observations as unknown as Array<Record<string, unknown>>).push({ ...(F.cost(9, "1.00", "USD", { pricingRef: "inferred" }) as unknown as Record<string, unknown>) });
    expect(deriveObservabilityUnsafeCounters(inp, inferred, zeroAudit).UC08_TOKEN_OR_COST_INFERRED).toBe(1);

    const fx = clone(truth) as ObservabilityBuildResult;
    (fx.aggregates as { crossCurrencyTotal: string | null }).crossCurrencyTotal = "9.99";
    expect(deriveObservabilityUnsafeCounters(inp, fx, zeroAudit).UC09_MIXED_CURRENCY_TOTAL_CREATED).toBe(1);

    const crossRun = clone(truth) as ObservabilityBuildResult;
    (crossRun.observations as unknown as Array<Record<string, unknown>>).push({ ...(F.promptResolved(9, {}) as unknown as Record<string, unknown>), runId: "elsewhere" });
    expect(deriveObservabilityUnsafeCounters(inp, crossRun, zeroAudit).UC10_INVALID_OR_CROSS_RUN_IDENTITY_ACCEPTED).toBe(1);

    const huge = clone(truth) as ObservabilityBuildResult;
    (huge as { serializedBytes: number }).serializedBytes = 999_999;
    expect(deriveObservabilityUnsafeCounters(inp, huge, zeroAudit).UC11_UNBOUNDED_CARDINALITY_OR_SIZE_ACCEPTED).toBe(1);

    const sampledReq = clone(truth) as ObservabilityBuildResult;
    (sampledReq.observations as unknown as Array<Record<string, unknown>>).push({ schemaVersion: "s13p.observation.v1", observationId: "ds", runId: "run_alpha", traceId: "trace_alpha", sequence: 50, occurredAt: F.TS_A, observedAt: F.TS_A, source: "CALLER_SAFE", kind: "OBSERVATION_DROPPED_SUMMARY", priority: "REQUIRED", reason: "SAMPLING", droppedCount: 1, droppedKinds: ["ERROR_OBSERVED"] });
    expect(deriveObservabilityUnsafeCounters(inp, sampledReq, zeroAudit).UC12_REQUIRED_EVIDENCE_SAMPLED_OUT).toBe(1);

    const badRet = clone(truth) as ObservabilityBuildResult;
    (badRet.retention as { class: string; days: number }).class = "OPERATIONAL";
    (badRet.retention as { class: string; days: number }).days = 99;
    expect(deriveObservabilityUnsafeCounters(inp, badRet, zeroAudit).UC13_RETENTION_CEILING_EXCEEDED).toBe(1);

    expect(deriveObservabilityUnsafeCounters(inp, truth, { ...zeroAudit, providerOrDependencyViolation: true }).UC14_PROVIDER_STORE_OR_DEPENDENCY_INTRODUCED).toBe(1);
    expect(deriveObservabilityUnsafeCounters(inp, truth, { ...zeroAudit, coreOrContractChanged: true }).UC15_CORE_AGENT_OR_PRIOR_CONTRACT_CHANGED).toBe(1);
    expect(deriveObservabilityUnsafeCounters(inp, { ...clone(truth), pass: true } as unknown as ObservabilityBuildResult, zeroAudit).UC16_CANDIDATE_SELF_CERTIFIED_PASS).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Actual S12 -> S10 -> S09 path with the real candidate
// ---------------------------------------------------------------------------
describe("S13P S12->S10->S09 actual candidate path", () => {
  it("loads only the S13P Skill then gates the parsed candidate", async () => {
    const out = await runPlan(richScenario(), true);
    expect(out.skillLoaded).toBe(true);
    expect(out.run.outcome).toBe("SUCCESS");
    expect(out.decisionValidation.valid).toBe(true);
    expect(out.decision.status).toBe("COMPLETE");
    expect(out.inputSnapshotBefore).toBe(out.inputSnapshotAfter);
    expect(observabilityAiSystemsSkillS13P.rules).toHaveLength(18);
    expect(observabilityAiSystemsSkillS13P.id).toBe(OBSERVABILITY_SKILL_ID);
  });

  it("baseline arm without the Skill still routes the same visible packet and gates it", async () => {
    const inp = abScenarios[6][1]();
    const out = await runPlan(inp, false);
    expect(out.skillLoaded).toBe(false);
    expect(out.visiblePacket).toBe(inp);
    expect(["COMPLETE", "PARTIAL", "REJECTED"]).toContain(out.decision.status);
  });
});

// ---------------------------------------------------------------------------
// Anti-gaming: provider carries no fixture / arm / answer / evaluator coupling
// ---------------------------------------------------------------------------
describe("S13P anti-gaming provider hygiene", () => {
  it("bundleProvider has no fixture id, arm id, expected answer or evaluator import", () => {
    const source = readFileSync(new URL("./bundleProvider.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/fixture|case[_ -]?id|with[_ -]?skill|without[_ -]?skill|expected|hidden[_ -]?truth|ab0[0-9]|P0[0-9]_|N[0-9][0-9]/i);
    expect(source).not.toMatch(/OBSERVABILITY_SKILL_ID|buildObservabilityBundle|quality\.js|evaluateObservability|deriveObservabilitySourceFacts/);
    expect(source.match(/class BundleProvider/g)).toHaveLength(1);
  });

  it("irrelevant prose creates no correctness jump; relevant prose does", () => {
    const inp = abScenarios[1][1]();
    const naive = synthesizeObservabilityBundle(inp, "");
    const irrelevant = synthesizeObservabilityBundle(inp, "Please be concise and format nicely and mention the weather.");
    expect(JSON.stringify(irrelevant)).toBe(JSON.stringify(naive));
    expect(Object.values(extractObservabilityMethodFeatures("Please be concise and mention the weather.")).some(Boolean)).toBe(false);
    const informed = synthesizeObservabilityBundle(inp, observabilityAiSystemsSkillS13P.rules.map((r) => r.statement).join("\n"));
    expect(JSON.stringify(informed)).not.toBe(JSON.stringify(naive));
  });
});

// ---------------------------------------------------------------------------
// Validator unit surface
// ---------------------------------------------------------------------------
describe("S13P validator surface", () => {
  it("policy validator enforces ceilings and retention classes", () => {
    expect(validateObservabilityPolicy(F.policy()).valid).toBe(true);
    expect(validateObservabilityPolicy(F.policy({ successDetailSamplingBasisPoints: 20_000 })).valid).toBe(false);
    expect(validateObservabilityPolicy(F.policy({ limits: { maxObservationsPerRun: 99_999 } })).valid).toBe(false);
    expect(validateObservabilityPolicy(F.policy({ requestedRetention: { class: "OPERATIONAL", days: 30 } })).retentionDowngraded).toBe(true);
  });
  it("run identity and observation validators reject unsafe or unknown shapes", () => {
    expect(validateRunIdentity({ runId: "r", traceId: "t" }).valid).toBe(true);
    expect(validateRunIdentity({ runId: "r", traceId: "t", extra: 1 }).valid).toBe(false);
    const run = { runId: "run_alpha", traceId: "trace_alpha" };
    expect(validateSafeObservation(F.runStarted(1), run, { allowTemplateDigest: false, allowErrorFingerprint: false }).valid).toBe(true);
    expect(validateSafeObservation({ ...(F.runStarted(1) as unknown as Record<string, unknown>), nope: 1 }, run, { allowTemplateDigest: false, allowErrorFingerprint: false }).valid).toBe(false);
  });
});
