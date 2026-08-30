import type { CapabilityListRequest, CapabilityProvider, ModelDecisionRequest, ModelDecisionResult, ModelProvider, ToolInvocationRequest, ToolInvocationResult } from "../../src/core/agent/index.js";
import type { AgentEvalCheckResult, AgentEvalDecision } from "../../src/intelligence/agent-evals/types.js";

const dimensions = Array.from({ length: 8 }, (_, i) => `SD-${String(i + 1).padStart(3, "0")}`);
/**
 * Deliberately truth-blind reference provider. It reads only the S09 objective
 * and selected Skill prose; it imports neither fixture truth nor evaluator code.
 */
export class DeterministicAgentEvalsModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const skilled = request.goal.statement.includes("Evaluate exactly one frozen golden case");
    const result: AgentEvalCheckResult = skilled ? "PASS" : "INCONCLUSIVE";
    const candidate: AgentEvalDecision = { eval_ref: "runtime-candidate", case_id: "opaque", case_version: "1", observed_run_id: request.run_id, status: skilled ? "PASS" : "INCONCLUSIVE", dimensions: dimensions.map((dimension, i) => ({ dimension_id: dimension, result, atomic_results: ["A", "B", "C"].map((suffix) => ({ assertion_id: `SD${i + 1}-${suffix}`, result, evidence_refs: [], reason_code: skilled ? "VISIBLE_SKILL_PROSE" : "VISIBLE_BASELINE_CONTEXT" })) })), failed_assertion_ids: [], inconclusive_assertion_ids: [], not_evaluated_assertion_ids: [], observed_metrics: {}, evidence_refs: [], blockers: [], limitations: [], residual_unknowns: [], next_action: "RETURN_RUNTIME_CANDIDATE" };
    return { status: "SUCCESS", decision: { type: "FINISH", rationale: "Deterministic result from visible S09 request only.", output: { summary: "runtime candidate", data: candidate as unknown as Record<string, unknown> } } };
  }
}
export class EmptyAgentEvalsCapabilityProvider implements CapabilityProvider {
  async list_capabilities(_request?: CapabilityListRequest) { return []; }
  async invoke(_request: ToolInvocationRequest): Promise<ToolInvocationResult> { return { status: "BLOCKED", call_id: _request.call_id, capability_id: _request.capability_id, reason: "No S13N capability is authorized.", duration_ms: 0 }; }
}
