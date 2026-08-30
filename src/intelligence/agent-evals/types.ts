export type AgentEvalStatus = "PASS" | "FAIL" | "INCONCLUSIVE" | "BLOCKED";
export type AgentEvalCheckResult = "PASS" | "FAIL" | "NOT_EVALUATED" | "INCONCLUSIVE";
export type AgentEvalPrimitive = string | number | boolean | null;
export type AgentEvalPrimitiveType = "string" | "number" | "boolean" | "null" | "object" | "array";
export type AgentEvalMetricRequirement = "OPTIONAL" | "REQUIRED";
export type AgentEvalSideEffect = "NONE" | "LOCAL" | "EXTERNAL";

export interface AgentEvalIdentity { eval_ref: string; case_id: string; case_version: string; truth_ref: string; observed_run_id: string; evaluated_skill_ref?: string; }
export interface AgentEvalGoldenCase {
  case_id: string; version: string; task: { goal: string; context_ref?: string; input_ref?: string };
  allowed_terminal_outcomes: Array<"SUCCESS" | "FAIL" | "BLOCKED">; allowed_termination_reasons?: string[];
  output_expectation: { summary_required: boolean; minimum_evidence_refs: number; required_data_paths: string[]; forbidden_data_paths: string[]; exact_primitive_checks_allowed: true; bounded_type_checks_allowed: true };
  tool_expectation: { mode: "NO_TOOL_REQUIRED" | "TOOLS_ALLOWED" | "TOOL_REQUIRED"; enforce_required_ids: boolean; enforce_forbidden_ids: boolean; enforce_order: boolean; enforce_count: boolean };
  safety_expectation: { required: true; policy_refs: string[] };
  efficiency_expectation: { latency?: { requirement: AgentEvalMetricRequirement; maximum_ms?: number }; tokens?: { requirement: AgentEvalMetricRequirement; maximum_total_tokens?: number }; cost?: { requirement: AgentEvalMetricRequirement; maximum_cost_amount?: number; currency?: string } };
  assertion_ids: string[]; policy_refs: string[]; source_refs: string[];
}
export type AgentEvalTaskAssertion = { assertion_id: string; kind: "OUTPUT_PATH_EXISTS"; path: string; required: true } | { assertion_id: string; kind: "OUTPUT_PATH_EQUALS"; path: string; expected: AgentEvalPrimitive; required: true } | { assertion_id: string; kind: "OUTPUT_PATH_IN"; path: string; allowed: AgentEvalPrimitive[]; required: true } | { assertion_id: string; kind: "EVIDENCE_REF_PRESENT"; evidence_ref: string; required: true };
export type AgentEvalSafetyAssertion = { assertion_id: string; kind: "FORBID_CAPABILITY_REQUEST"; capability_id: string; policy_ref?: string } | { assertion_id: string; kind: "MAX_SIDE_EFFECT_CLASS"; maximum: AgentEvalSideEffect; policy_ref?: string } | { assertion_id: string; kind: "REQUIRE_SAFE_BLOCK"; policy_ref: string } | { assertion_id: string; kind: "SENSITIVE_OUTPUT_ABSENT"; evidence_ref: string; policy_ref?: string };
export interface AgentEvalFrozenTruth { truth_ref: string; case_id: string; case_version: string; frozen_before_run: true; task_assertions: AgentEvalTaskAssertion[]; expected_data_types: Array<{ assertion_id: string; path: string; expected_type: AgentEvalPrimitiveType; required: boolean }>; required_capability_ids: string[]; allowed_capability_ids: string[]; forbidden_capability_ids: string[]; required_tool_order?: string[]; min_tool_calls?: number; max_tool_calls?: number; safety_assertions: AgentEvalSafetyAssertion[]; source_refs: string[]; }
export interface AgentEvalObservedRun { run_id: string; outcome: "SUCCESS" | "FAIL" | "BLOCKED"; output?: { summary: string; data?: Record<string, unknown>; evidence_refs?: string[] }; termination: { outcome: "SUCCESS" | "FAIL" | "BLOCKED"; reason_code: string; final_turn: number; triggering_event_id: string }; events: Array<{ event_id: string; run_id: string; sequence: number; timestamp: string; type: string; turn?: number; capability_id?: string; call_id?: string; side_effects?: AgentEvalSideEffect; outcome?: "SUCCESS" | "FAIL" | "BLOCKED"; evidence_refs?: string[] }>; tool_descriptors: Array<{ capability_id: string; side_effects: AgentEvalSideEffect }>; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number; cost_amount?: number; cost_currency?: string }; }
export interface AgentEvalEvidenceRecord { evidence_ref: string; claim_ref: string; relationship: "SUPPORTS" | "CONTRADICTS" | "QUALIFIES"; source_type: "DIRECT_OBSERVATION" | "PRIMARY" | "SECONDARY" | "OTHER"; locator_ref: string; observed_run_id?: string; policy_ref?: string; limitations: string[]; }
export interface AgentEvalInput { identity: AgentEvalIdentity; golden_case: AgentEvalGoldenCase; frozen_truth: AgentEvalFrozenTruth; observed_run: AgentEvalObservedRun; evidence: AgentEvalEvidenceRecord[]; limitations: string[]; }
export interface AgentEvalAtomicResult { assertion_id: string; result: AgentEvalCheckResult; observed_ref?: string; evidence_refs: string[]; reason_code: string; }
export interface AgentEvalDimensionResult { dimension_id: string; result: AgentEvalCheckResult; atomic_results: AgentEvalAtomicResult[]; }
export interface AgentEvalDecision { eval_ref: string; case_id: string; case_version: string; observed_run_id: string; status: AgentEvalStatus; dimensions: AgentEvalDimensionResult[]; failed_assertion_ids: string[]; inconclusive_assertion_ids: string[]; not_evaluated_assertion_ids: string[]; observed_metrics: { latency_ms?: number; total_tokens?: number; cost_amount?: number; cost_currency?: string }; evidence_refs: string[]; blockers: string[]; limitations: string[]; residual_unknowns: string[]; next_action: string; }
export interface AgentEvalValidationResult { valid: boolean; errors: string[]; }
export interface AgentEvalProviderAudit {
  readonly audit_kind: "COMPUTED_PROVIDER_ENVELOPE_AUDIT";
  readonly violations: readonly string[];
  readonly visible_packet_sha256: string;
}
export interface AgentEvalAtomicSourceFact { result: AgentEvalCheckResult; reason_code: string; evidence_refs: string[]; }
export type AgentEvalAtomicSourceFacts = Record<string, AgentEvalAtomicSourceFact>;
export interface AgentEvalPostGateObservation { evaluator_result: AgentEvalCheckResult; candidate_result: AgentEvalCheckResult; correct: boolean; evaluator_reason_code: string; }
export interface AgentEvalGateResult {
  decision: AgentEvalDecision;
  candidate_validation: AgentEvalValidationResult;
  provider_audit: AgentEvalProviderAudit | null;
  actual_candidate_preserved: boolean;
  exact_subject_preserved: boolean;
  observations: Record<string, AgentEvalPostGateObservation>;
}
export interface AgentEvalSourceSnapshot {
  provider_source: string;
  evaluator_source: string;
  planner_source: string;
  skill_source: string;
  core_sources: string;
  package_json_before: string;
  package_json_after: string;
  committed_range: { readonly base: string; readonly head: string; readonly changed_paths: readonly string[] };
  expected_protected_blobs: Readonly<Record<string, string>>;
  actual_protected_blobs: Readonly<Record<string, string>>;
  expected_part_a_blobs: Readonly<Record<string, string>>;
  actual_part_a_blobs: Readonly<Record<string, string>>;
}
export interface AgentEvalUnsafeCounters { golden_truth_leak: number; fixture_or_arm_branching: number; subject_run_substitution: number; forbidden_tool_accepted: number; safety_violation_accepted: number; required_schema_failure_accepted: number; unobserved_cost_or_latency_invented: number; future_stage_pull_forward: number; }
