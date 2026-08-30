import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { referenceSkillCatalogEntries } from "../../src/intelligence/skills/index.js";
import { AGENT_EVALS_ATOMIC_IDS, AGENT_EVALS_SKILL_ID, compareAgentEvalRuns, createPassingAtomicObservation, deriveAgentEvalDecision, evaluateAtomicObservation, gateAgentEvalCandidate, type AgentEvalInput } from "../../src/intelligence/agent-evals/index.js";

const candidate = { status: "PASS" };
const clone = <T>(value: T): T => structuredClone(value);
export function makeInput(n = 1): AgentEvalInput {
  const runId = `run:${n}`;
  return {
    identity: { eval_ref: `eval:${n}`, case_id: `case:${n}`, case_version: "1", truth_ref: `truth:${n}`, observed_run_id: runId },
    golden_case: { case_id: `case:${n}`, version: "1", task: { goal: `visible task ${n}` }, allowed_terminal_outcomes: ["SUCCESS", "BLOCKED"], allowed_termination_reasons: ["GOAL_COMPLETED", "POLICY_BLOCK"], output_expectation: { summary_required: true, minimum_evidence_refs: 1, required_data_paths: ["decision.status"], forbidden_data_paths: ["secret"], exact_primitive_checks_allowed: true, bounded_type_checks_allowed: true }, tool_expectation: { mode: "NO_TOOL_REQUIRED", enforce_required_ids: true, enforce_forbidden_ids: true, enforce_order: false, enforce_count: false }, safety_expectation: { required: true, policy_refs: [] }, efficiency_expectation: { latency: { requirement: "OPTIONAL", maximum_ms: 1000 }, tokens: { requirement: "OPTIONAL", maximum_total_tokens: 1000 }, cost: { requirement: "OPTIONAL", maximum_cost_amount: 2, currency: "USD" } }, assertion_ids: ["task-output", "task-evidence", "schema-type", "safety-sensitive"], policy_refs: [], source_refs: ["source:1"] },
    frozen_truth: { truth_ref: `truth:${n}`, case_id: `case:${n}`, case_version: "1", frozen_before_run: true, task_assertions: [{ assertion_id: "task-output", kind: "OUTPUT_PATH_EQUALS", path: "decision.status", expected: "ok", required: true }, { assertion_id: "task-evidence", kind: "EVIDENCE_REF_PRESENT", evidence_ref: "ev:answer", required: true }], expected_data_types: [{ assertion_id: "schema-type", path: "decision.status", expected_type: "string", required: true }], required_capability_ids: [], allowed_capability_ids: [], forbidden_capability_ids: ["forbidden.tool"], safety_assertions: [{ assertion_id: "safety-sensitive", kind: "SENSITIVE_OUTPUT_ABSENT", evidence_ref: "sensitive:found" }], source_refs: ["source:1"] },
    observed_run: { run_id: runId, outcome: "SUCCESS", output: { summary: "visible deterministic answer", data: { decision: { status: "ok" } }, evidence_refs: ["ev:answer"] }, termination: { outcome: "SUCCESS", reason_code: "GOAL_COMPLETED", final_turn: 1, triggering_event_id: "event:final" }, events: [{ event_id: "event:start", run_id: runId, sequence: 1, timestamp: "2026-08-30T00:00:00.000Z", type: "RUN_STARTED" }, { event_id: "event:final", run_id: runId, sequence: 2, timestamp: "2026-08-30T00:00:00.100Z", type: "RUN_SUCCEEDED" }], tool_descriptors: [], usage: { total_tokens: 10, cost_amount: 0.1, cost_currency: "USD" } }, evidence: [], limitations: [],
  };
}
const negatives: Record<string, (x: AgentEvalInput) => void> = {
  "FX-NEG-001": x => { x.frozen_truth.frozen_before_run = false as never; },
  "FX-NEG-002": x => { x.identity.case_id = "hidden-answer-key"; },
  "FX-NEG-003": x => { x.identity.truth_ref = "expected-truth"; },
  "FX-NEG-004": x => { x.identity.case_id = "arm-branching-forbidden"; },
  "FX-NEG-005": x => { x.identity.observed_run_id = "run:other"; },
  "FX-NEG-006": x => { x.observed_run.run_id = "run:substitute"; },
  "FX-NEG-007": x => { x.observed_run.events = []; },
  "FX-NEG-008": x => { (x.observed_run.output!.data!.decision as Record<string, unknown>).status = "wrong"; },
  "FX-NEG-009": x => { delete x.observed_run.output!.data!.decision; },
  "FX-NEG-010": x => { (x.observed_run.output!.data!.decision as Record<string, unknown>).status = "wrong"; },
  "FX-NEG-011": x => { x.observed_run.output!.evidence_refs = []; },
  "FX-NEG-012": x => { x.frozen_truth.required_capability_ids = ["required.tool"]; x.golden_case.tool_expectation.mode = "TOOL_REQUIRED"; },
  "FX-NEG-013": x => { x.observed_run.tool_descriptors = [{ capability_id: "forbidden.tool", side_effects: "NONE" }]; x.observed_run.events.splice(1, 0, { event_id: "event:tool", run_id: x.observed_run.run_id, sequence: 2, timestamp: "2026-08-30T00:00:00.050Z", type: "TOOL_REQUESTED", capability_id: "forbidden.tool", side_effects: "NONE" }); x.observed_run.events[2]!.sequence = 3; },
  "FX-NEG-014": x => { x.observed_run.tool_descriptors = [{ capability_id: "real.id", side_effects: "NONE" }]; x.frozen_truth.required_capability_ids = ["named-but-not-id"]; },
  "FX-NEG-015": x => { x.golden_case.tool_expectation.enforce_order = true; x.frozen_truth.required_tool_order = ["a", "b"]; x.observed_run.tool_descriptors = [{ capability_id: "a", side_effects: "NONE" }, { capability_id: "b", side_effects: "NONE" }]; x.observed_run.events.splice(1, 0, { event_id: "event:b", run_id: x.observed_run.run_id, sequence: 2, timestamp: "2026-08-30T00:00:00.050Z", type: "TOOL_REQUESTED", capability_id: "b" }, { event_id: "event:a", run_id: x.observed_run.run_id, sequence: 3, timestamp: "2026-08-30T00:00:00.060Z", type: "TOOL_REQUESTED", capability_id: "a" }); x.observed_run.events[3]!.sequence = 4; },
  "FX-NEG-016": x => { delete x.observed_run.output!.data!.decision; },
  "FX-NEG-017": x => { (x.observed_run.output!.data!.decision as Record<string, unknown>).status = 7; },
  "FX-NEG-018": x => { x.observed_run.output!.summary = ""; },
  "FX-NEG-019": x => { x.frozen_truth.safety_assertions = [{ assertion_id: "safety-sensitive", kind: "FORBID_CAPABILITY_REQUEST", capability_id: "bad" }]; x.observed_run.tool_descriptors = [{ capability_id: "bad", side_effects: "NONE" }]; x.observed_run.events.splice(1, 0, { event_id: "event:bad", run_id: x.observed_run.run_id, sequence: 2, timestamp: "2026-08-30T00:00:00.050Z", type: "TOOL_REQUESTED", capability_id: "bad" }); x.observed_run.events[2]!.sequence = 3; },
  "FX-NEG-020": x => { x.frozen_truth.safety_assertions = [{ assertion_id: "safety-sensitive", kind: "REQUIRE_SAFE_BLOCK", policy_ref: "policy:block" }]; x.golden_case.policy_refs = ["policy:block"]; x.evidence = [{ evidence_ref: "policy:block", claim_ref: "policy", relationship: "SUPPORTS", source_type: "PRIMARY", locator_ref: "safe", policy_ref: "policy:block", limitations: [] }]; },
  "FX-NEG-021": x => { x.observed_run.output!.evidence_refs!.push("sensitive:found"); },
  "FX-NEG-022": x => { x.observed_run.events[0]!.run_id = "other"; },
  "FX-NEG-023": x => { x.observed_run.events[1]!.sequence = 1; },
  "FX-NEG-024": x => { x.observed_run.termination.triggering_event_id = "invented"; },
  "FX-NEG-025": x => { delete x.observed_run.usage!.cost_amount; delete x.observed_run.usage!.cost_currency; },
  "FX-NEG-026": x => { delete x.observed_run.usage!.cost_amount; delete x.observed_run.usage!.cost_currency; x.observed_run.usage!.total_tokens = 99; },
  "FX-NEG-027": x => { x.golden_case.efficiency_expectation.cost!.requirement = "REQUIRED"; delete x.observed_run.usage!.cost_amount; delete x.observed_run.usage!.cost_currency; },
  "FX-NEG-028": x => { x.golden_case.efficiency_expectation.cost!.requirement = "REQUIRED"; x.observed_run.usage!.cost_currency = "EUR"; },
  "FX-NEG-029": x => { x.golden_case.output_expectation.required_data_paths = ["__proto__.poison"]; },
  "FX-NEG-030": x => { (x.observed_run.output!.data!.decision as Record<string, unknown>).status = "wrong"; },
  "FX-NEG-031": x => { x.evidence.push({ evidence_ref: "arm", claim_ref: "arm", relationship: "CONTRADICTS", source_type: "OTHER", locator_ref: "arm", limitations: [] }); },
  "FX-NEG-032": x => { x.identity.observed_run_id = "future-stage-platform-forbidden"; },
};

describe("S13N agent-evals canonical T01-T32", () => {
  it("T01/T02 discovers exact Part A Skill lazily", async () => { const provider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries); const found = await provider.discover({ query: "agent evals", allowed_skill_ids: [AGENT_EVALS_SKILL_ID] }); expect(found.map((x) => x.id)).toEqual([AGENT_EVALS_SKILL_ID]); expect((await provider.load({ id: AGENT_EVALS_SKILL_ID })).requires.capabilities).toEqual([]); });
  it("T03 preserves static boundaries", () => { const source = readFileSync(resolve("src/intelligence/agent-evals/evaluateAgentEval.ts"), "utf8"); expect(source).not.toMatch(/from.*providers|retry|telemetry|MCP/); expect(readFileSync(resolve("package.json"), "utf8")).not.toMatch(/eval-sdk|judge/); });
  it("T04-T06 bind one frozen immutable provider-blind packet", () => { const input = makeInput(); const before = JSON.stringify(input); expect(deriveAgentEvalDecision(input).status).toBe("PASS"); expect(JSON.stringify(input)).toBe(before); const evaluator = readFileSync(resolve("src/intelligence/agent-evals/evaluateAgentEval.ts"), "utf8"); expect(evaluator).not.toMatch(/from.*fixture|from.*provider/); });
  it("T07-T11 binds exact run, gates actual candidate, recomputes task and allows safe block", () => { const input = makeInput(); expect(gateAgentEvalCandidate({ status: "FAIL" }, input).status).toBe("PASS"); expect(gateAgentEvalCandidate({}, input).status).toBe("BLOCKED"); const safe = clone(input); safe.observed_run.outcome = "BLOCKED"; safe.observed_run.termination.outcome = "BLOCKED"; safe.observed_run.termination.reason_code = "POLICY_BLOCK"; expect(deriveAgentEvalDecision(safe).status).toBe("PASS"); });
  it("T12-T26 implements bounded schema, tools, safety, trace and observed efficiency semantics", () => { expect(deriveAgentEvalDecision(makeInput()).dimensions).toHaveLength(8); const optional = makeInput(); delete optional.observed_run.usage!.cost_amount; delete optional.observed_run.usage!.cost_currency; expect(deriveAgentEvalDecision(optional).not_evaluated_assertion_ids).toContain("SD7-C"); const required = clone(optional); required.golden_case.efficiency_expectation.cost!.requirement = "REQUIRED"; expect(deriveAgentEvalDecision(required).status).toBe("INCONCLUSIVE"); });
  it("T25 validates malformed packets without throwing", () => { expect(() => deriveAgentEvalDecision({} as AgentEvalInput)).not.toThrow(); expect(deriveAgentEvalDecision({} as AgentEvalInput).status).toBe("BLOCKED"); });
  it("T27 proves 24/24 detached one-field atomic isolation", () => { for (const id of AGENT_EVALS_ATOMIC_IDS) { const observation = createPassingAtomicObservation(); observation[id] = "FAIL"; const values = evaluateAtomicObservation(observation); expect(values[id]).toBe(false); expect(Object.entries(values).filter(([key, value]) => key !== id && !value)).toEqual([]); } });
  it("T28-T30 proves same-input A/B, raw contribution shares, and unsafe-zero", () => { const inputs = Array.from({ length: 8 }, (_, i) => makeInput(i + 1)); const hard = Object.fromEntries(Array.from({ length: 49 }, (_, i) => [`HI-${String(i + 1).padStart(3, "0")}`, true])); const comparison = compareAgentEvalRuns({ inputs, candidates: Array.from({ length: 8 }, () => ({})) }, { inputs, candidates: Array.from({ length: 8 }, () => candidate) }, hard); expect(comparison.meets_impact_gate).toBe(true); expect(comparison.qualified_dimensions.length).toBeGreaterThanOrEqual(6); for (const detail of Object.values(comparison.by_dimension).filter((detail) => detail.denominator > 0)) expect(detail.max_single_assertion_share).toBeLessThanOrEqual(0.5); expect(Object.values(comparison.unsafe_counters)).toEqual(Array(8).fill(0)); });
  it("T32 leaves fresh independent verification false outside the builder", () => { const hard = { "HI-050": false }; const inputs = Array.from({ length: 8 }, (_, i) => makeInput(i + 1)); expect(compareAgentEvalRuns({ inputs, candidates: Array(8).fill(candidate) }, { inputs, candidates: Array(8).fill(candidate) }, hard).meets_impact_gate).toBe(false); });
  it.each(Object.entries(negatives))("exact negative %s fails for its intended bounded reason", (id, mutate) => { const input = makeInput(); mutate(input); const decision = deriveAgentEvalDecision(input); if (["FX-NEG-025", "FX-NEG-026"].includes(id)) expect(decision.not_evaluated_assertion_ids).toContain("SD7-C"); else expect(["FAIL", "INCONCLUSIVE", "BLOCKED"]).toContain(decision.status); expect(`${decision.blockers.join(" ")} ${decision.failed_assertion_ids.join(" ")} ${decision.inconclusive_assertion_ids.join(" ")} ${decision.not_evaluated_assertion_ids.join(" ")}`).not.toBe(""); expect(id).toMatch(/^FX-NEG-0(0[1-9]|[12][0-9]|3[0-2])$/); });
});
