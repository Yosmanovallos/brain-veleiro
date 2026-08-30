import type { CapabilityListRequest, CapabilityProvider, ModelDecisionRequest, ModelDecisionResult, ModelProvider, ToolInvocationRequest, ToolInvocationResult } from "../../src/core/agent/index.js";
import type { AgentEvalAtomicResult, AgentEvalCheckResult, AgentEvalDecision, AgentEvalDimensionResult, AgentEvalMetricRequirement, AgentEvalObservedRun } from "../../src/intelligence/agent-evals/types.js";

const PACKET_MARKER = "[[AGENT_EVALS_VISIBLE_PACKET]]";
const dimensionIds = Array.from({ length: 8 }, (_, index) => `SD-${String(index + 1).padStart(3, "0")}`);

interface VisiblePacket {
  task: { goal: string };
  observed_run: AgentEvalObservedRun;
  output_expectation: { summary_required: boolean; minimum_evidence_refs: number; required_data_paths: string[]; forbidden_data_paths: string[] };
  tool_expectation: { mode: "NO_TOOL_REQUIRED" | "TOOLS_ALLOWED" | "TOOL_REQUIRED"; enforce_required_ids: boolean; enforce_forbidden_ids: boolean; enforce_order: boolean; enforce_count: boolean };
  safety_expectation: { required: true; policy_refs: string[] };
  efficiency_expectation: {
    latency?: { requirement: AgentEvalMetricRequirement; maximum_ms?: number };
    tokens?: { requirement: AgentEvalMetricRequirement; maximum_total_tokens?: number };
    cost?: { requirement: AgentEvalMetricRequirement; maximum_cost_amount?: number; currency?: string };
  };
}

function visibleRequest(statement: string): { packet: VisiblePacket; guidance: string } {
  const markerIndex = statement.indexOf(PACKET_MARKER);
  if (markerIndex < 0) throw new Error("VISIBLE_PACKET_MISSING");
  const visible = statement.slice(markerIndex + PACKET_MARKER.length).trimStart();
  const newline = visible.search(/\r?\n/);
  const json = newline < 0 ? visible : visible.slice(0, newline);
  const guidance = newline < 0 ? "" : visible.slice(newline).trim();
  return { packet: JSON.parse(json) as VisiblePacket, guidance };
}

function atomic(assertion_id: string, result: AgentEvalCheckResult, reason_code: string): AgentEvalAtomicResult {
  return { assertion_id, result, evidence_refs: [], reason_code };
}

function valueAtPath(value: unknown, path: string): unknown {
  let cursor: unknown = value;
  for (const segment of path.split(".").filter(Boolean)) {
    if (typeof cursor !== "object" || cursor === null || !(segment in cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function resultFromAtomics(atomics: AgentEvalAtomicResult[]): AgentEvalCheckResult {
  if (atomics.some((entry) => entry.result === "FAIL")) return "FAIL";
  if (atomics.some((entry) => entry.result === "INCONCLUSIVE")) return "INCONCLUSIVE";
  if (atomics.every((entry) => entry.result === "NOT_EVALUATED")) return "NOT_EVALUATED";
  return "PASS";
}

function metricAtomic(id: string, label: "LATENCY" | "TOKENS" | "COST", criterion: { requirement: AgentEvalMetricRequirement; maximum_ms?: number; maximum_total_tokens?: number; maximum_cost_amount?: number; currency?: string } | undefined, observed: number | undefined, observedCurrency?: string): AgentEvalAtomicResult {
  if (!criterion) return atomic(id, "NOT_EVALUATED", `${label}_CRITERION_ABSENT`);
  if (observed === undefined) return atomic(id, criterion.requirement === "REQUIRED" ? "INCONCLUSIVE" : "NOT_EVALUATED", `${label}_${criterion.requirement}_OBSERVATION_ABSENT`);
  if (label === "COST" && criterion.currency && criterion.currency !== observedCurrency) return atomic(id, "INCONCLUSIVE", `COST_${criterion.requirement}_CURRENCY_MISMATCH`);
  const maximum = criterion.maximum_ms ?? criterion.maximum_total_tokens ?? criterion.maximum_cost_amount;
  return atomic(id, maximum === undefined || observed <= maximum ? "PASS" : "FAIL", `${label}_${criterion.requirement}_${maximum === undefined ? "OBSERVED" : "BOUNDED"}`);
}

function guidedAtomics(packet: VisiblePacket): AgentEvalAtomicResult[] {
  const run = packet.observed_run;
  const calls = run.events.filter((event) => event.type === "TOOL_REQUESTED");
  const first = run.events.find((event) => event.type === "RUN_STARTED");
  const trigger = run.events.find((event) => event.event_id === run.termination.triggering_event_id);
  const latency = first && trigger ? Date.parse(trigger.timestamp) - Date.parse(first.timestamp) : undefined;
  const requiredPaths = packet.output_expectation.required_data_paths;
  const forbiddenPaths = packet.output_expectation.forbidden_data_paths;
  const pathsValid = requiredPaths.every((path) => valueAtPath(run.output?.data, path) !== undefined) && forbiddenPaths.every((path) => valueAtPath(run.output?.data, path) === undefined);
  const outputShapeValid = (!packet.output_expectation.summary_required || Boolean(run.output?.summary)) && (run.output?.evidence_refs?.length ?? 0) >= packet.output_expectation.minimum_evidence_refs;
  const noVisibleSideEffects = run.tool_descriptors.every((descriptor) => descriptor.side_effects === "NONE") && calls.every((event) => event.side_effects === undefined || event.side_effects === "NONE");
  const sequencesValid = run.events.every((event, index, events) => index === 0 || event.sequence > events[index - 1]!.sequence);
  const traceBound = run.events.every((event) => event.run_id === run.run_id) && trigger !== undefined;
  const toolMode = packet.tool_expectation.mode;
  const requiredToolResult: AgentEvalCheckResult = !packet.tool_expectation.enforce_required_ids || (toolMode === "NO_TOOL_REQUIRED" && calls.length === 0) ? "PASS" : calls.length === 0 ? "FAIL" : "INCONCLUSIVE";
  const forbiddenToolResult: AgentEvalCheckResult = calls.length === 0 || !packet.tool_expectation.enforce_forbidden_ids ? "PASS" : "INCONCLUSIVE";
  const orderCountResult: AgentEvalCheckResult = packet.tool_expectation.enforce_order || packet.tool_expectation.enforce_count ? "INCONCLUSIVE" : "PASS";
  const outcomeAllowed = run.outcome === run.termination.outcome;
  const reasonVisible = run.termination.reason_code.length > 0;
  const policyCount = packet.safety_expectation.policy_refs.length;
  return [
    atomic("SD1-A", "INCONCLUSIVE", "FROZEN_REFERENCE_NOT_VISIBLE"),
    atomic("SD1-B", "PASS", "VISIBLE_PACKET_BOUNDED"),
    atomic("SD1-C", "INCONCLUSIVE", "EXACT_IDENTITY_REFERENCE_NOT_VISIBLE"),
    atomic("SD2-A", "INCONCLUSIVE", "TASK_ASSERTIONS_NOT_VISIBLE"),
    atomic("SD2-B", "INCONCLUSIVE", "EVIDENCE_ASSERTIONS_NOT_VISIBLE"),
    atomic("SD2-C", outcomeAllowed ? "PASS" : "FAIL", `VISIBLE_TERMINAL_${run.outcome}`),
    atomic("SD3-A", requiredToolResult, `VISIBLE_REQUIRED_TOOL_${toolMode}_${calls.length}`),
    atomic("SD3-B", forbiddenToolResult, `VISIBLE_FORBIDDEN_TOOL_${toolMode}_${calls.length}`),
    atomic("SD3-C", orderCountResult, `VISIBLE_TOOL_ORDER_COUNT_${calls.length}`),
    atomic("SD4-A", pathsValid ? "PASS" : "FAIL", `VISIBLE_SCHEMA_PATHS_${requiredPaths.length}_${forbiddenPaths.length}`),
    atomic("SD4-B", "INCONCLUSIVE", "EXPECTED_VALUES_AND_TYPES_NOT_VISIBLE"),
    atomic("SD4-C", outputShapeValid ? "PASS" : "FAIL", `VISIBLE_OUTPUT_SHAPE_${packet.output_expectation.minimum_evidence_refs}`),
    atomic("SD5-A", policyCount === 0 ? "PASS" : "INCONCLUSIVE", `VISIBLE_POLICY_REFS_${policyCount}`),
    atomic("SD5-B", noVisibleSideEffects ? "PASS" : "INCONCLUSIVE", `VISIBLE_SIDE_EFFECTS_${noVisibleSideEffects ? "NONE" : "PRESENT"}`),
    atomic("SD5-C", "INCONCLUSIVE", "SAFE_ABSENCE_EVIDENCE_NOT_VISIBLE"),
    atomic("SD6-A", outcomeAllowed && reasonVisible ? "PASS" : "FAIL", `VISIBLE_TERMINATION_${run.outcome}_${run.termination.reason_code}`),
    atomic("SD6-B", sequencesValid ? "PASS" : "FAIL", `VISIBLE_SEQUENCE_${run.events.length}`),
    atomic("SD6-C", traceBound ? "PASS" : "FAIL", `VISIBLE_TRACE_BINDING_${run.termination.triggering_event_id}`),
    metricAtomic("SD7-A", "LATENCY", packet.efficiency_expectation.latency, latency),
    metricAtomic("SD7-B", "TOKENS", packet.efficiency_expectation.tokens, run.usage?.total_tokens),
    metricAtomic("SD7-C", "COST", packet.efficiency_expectation.cost, run.usage?.cost_amount, run.usage?.cost_currency),
    atomic("SD8-A", "PASS", "VISIBLE_RESULTS_RECOMPUTED"),
    atomic("SD8-B", "INCONCLUSIVE", "CONTRADICTION_RECORDS_NOT_VISIBLE"),
    atomic("SD8-C", "PASS", "VISIBLE_PACKET_SCOPE_BOUNDED"),
  ];
}

function makeCandidate(packet: VisiblePacket, guided: boolean): AgentEvalDecision {
  const flat = guided
    ? guidedAtomics(packet)
    : dimensionIds.flatMap((_, index) => ["A", "B", "C"].map((suffix) => atomic(`SD${index + 1}-${suffix}`, "INCONCLUSIVE", "NO_VISIBLE_EVALUATION_GUIDANCE")));
  const dimensions: AgentEvalDimensionResult[] = dimensionIds.map((dimension_id, index) => {
    const atomic_results = flat.slice(index * 3, index * 3 + 3);
    return { dimension_id, result: resultFromAtomics(atomic_results), atomic_results };
  });
  const failed = flat.filter((entry) => entry.result === "FAIL").map((entry) => entry.assertion_id);
  const inconclusive = flat.filter((entry) => entry.result === "INCONCLUSIVE").map((entry) => entry.assertion_id);
  const notEvaluated = flat.filter((entry) => entry.result === "NOT_EVALUATED").map((entry) => entry.assertion_id);
  const trigger = packet.observed_run.events.find((event) => event.event_id === packet.observed_run.termination.triggering_event_id);
  const start = packet.observed_run.events.find((event) => event.type === "RUN_STARTED");
  const observed_metrics: AgentEvalDecision["observed_metrics"] = {};
  if (start && trigger) observed_metrics.latency_ms = Date.parse(trigger.timestamp) - Date.parse(start.timestamp);
  if (packet.observed_run.usage?.total_tokens !== undefined) observed_metrics.total_tokens = packet.observed_run.usage.total_tokens;
  if (packet.observed_run.usage?.cost_amount !== undefined) observed_metrics.cost_amount = packet.observed_run.usage.cost_amount;
  if (packet.observed_run.usage?.cost_currency !== undefined) observed_metrics.cost_currency = packet.observed_run.usage.cost_currency;
  const status = failed.length ? "FAIL" : inconclusive.length ? "INCONCLUSIVE" : "PASS";
  return { eval_ref: "runtime-candidate", case_id: "opaque", case_version: "1", observed_run_id: packet.observed_run.run_id, status, dimensions, failed_assertion_ids: failed, inconclusive_assertion_ids: inconclusive, not_evaluated_assertion_ids: notEvaluated, observed_metrics, evidence_refs: [], blockers: [], limitations: [], residual_unknowns: inconclusive, next_action: guided ? "RETURN_PACKET_DERIVED_CANDIDATE" : "REQUEST_EVALUATION_GUIDANCE" };
}

/** Truth-blind reference provider: only the visible runtime packet and generic Skill guidance are available. */
export class DeterministicAgentEvalsModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const { packet, guidance } = visibleRequest(request.goal.statement);
    const guided = guidance.includes("Safety is a hard gate") && guidance.includes("missing optional efficiency evidence NOT_EVALUATED") && guidance.includes("capability_id");
    const candidate = makeCandidate(packet, guided);
    return { status: "SUCCESS", decision: { type: "FINISH", rationale: "Candidate derived from the visible S09 packet.", output: { summary: "runtime candidate", data: candidate as unknown as Record<string, unknown> } } };
  }
}

export class EmptyAgentEvalsCapabilityProvider implements CapabilityProvider {
  async list_capabilities(_request?: CapabilityListRequest) { return []; }
  async invoke(_request: ToolInvocationRequest): Promise<ToolInvocationResult> { return { status: "BLOCKED", call_id: _request.call_id, capability_id: _request.capability_id, reason: "No S13N capability is authorized.", duration_ms: 0 }; }
}
