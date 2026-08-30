import { AGENT_EVALS_DIMENSIONS } from "./constants.js";
import type { AgentEvalAtomicResult, AgentEvalCheckResult, AgentEvalDecision, AgentEvalInput, AgentEvalPrimitiveType, AgentEvalStatus, AgentEvalValidationResult } from "./types.js";

const primitiveTypes = new Set<AgentEvalPrimitiveType>(["string", "number", "boolean", "null", "object", "array"]);
const effectRank = { NONE: 0, LOCAL: 1, EXTERNAL: 2 } as const;
const validPath = (path: string): boolean => /^([A-Za-z_$][\w$]*)(\.[A-Za-z_$][\w$]*)*$/.test(path) && !path.split(".").some((x) => ["__proto__", "prototype", "constructor"].includes(x));
const atPath = (data: unknown, path: string): { exists: boolean; value?: unknown } => {
  let value: unknown = data;
  for (const segment of path.split(".")) { if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, segment)) return { exists: false }; value = (value as Record<string, unknown>)[segment]; }
  return { exists: true, value };
};
const result = (assertion_id: string, value: AgentEvalCheckResult, reason_code: string): AgentEvalAtomicResult => ({ assertion_id, result: value, reason_code, evidence_refs: [] });
const typeOf = (value: unknown): AgentEvalPrimitiveType => value === null ? "null" : Array.isArray(value) ? "array" : typeof value === "object" ? "object" : typeof value as AgentEvalPrimitiveType;
const isNonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Total, fail-closed validation of the bounded S13N packet. It never calls a provider or changes input. */
export function validateAgentEvalInput(input: unknown): AgentEvalValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["INVALID_PACKET"] };
  const p = input as AgentEvalInput;
  if (!p.identity || !p.golden_case || !p.frozen_truth || !p.observed_run || !Array.isArray(p.evidence) || !Array.isArray(p.limitations)) return { valid: false, errors: ["INVALID_PACKET"] };
  if (![p.identity?.eval_ref, p.identity?.case_id, p.identity?.case_version, p.identity?.truth_ref, p.identity?.observed_run_id].every(isNonEmpty)) errors.push("INVALID_IDENTITY");
  if (p.identity?.case_id !== p.golden_case?.case_id || p.identity?.case_version !== p.golden_case?.version || p.identity?.truth_ref !== p.frozen_truth?.truth_ref || p.identity?.observed_run_id !== p.observed_run?.run_id) errors.push("IDENTITY_BINDING_MISMATCH");
  if (p.frozen_truth?.case_id !== p.golden_case?.case_id || p.frozen_truth?.case_version !== p.golden_case?.version || p.frozen_truth?.frozen_before_run !== true) errors.push("INVALID_FROZEN_TRUTH");
  const ids = p.golden_case?.assertion_ids ?? [];
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) errors.push("DUPLICATE_ASSERTION_ID");
  const truthIds = [...(p.frozen_truth?.task_assertions ?? []), ...(p.frozen_truth?.expected_data_types ?? []), ...(p.frozen_truth?.safety_assertions ?? [])].map((x) => x.assertion_id);
  if (ids.some((id) => !truthIds.includes(id)) || new Set(truthIds).size !== truthIds.length) errors.push("UNRESOLVED_ASSERTION_ID");
  for (const path of [...(p.golden_case?.output_expectation?.required_data_paths ?? []), ...(p.golden_case?.output_expectation?.forbidden_data_paths ?? []), ...(p.frozen_truth?.task_assertions ?? []).filter((x) => "path" in x).map((x) => x.path), ...(p.frozen_truth?.expected_data_types ?? []).map((x) => x.path)]) if (!validPath(path)) errors.push("INVALID_BOUNDED_PATH");
  const required = new Set(p.frozen_truth?.required_capability_ids ?? []), forbidden = new Set(p.frozen_truth?.forbidden_capability_ids ?? []);
  if ([...required].some((id) => forbidden.has(id))) errors.push("CONTRADICTORY_CAPABILITY_SET");
  const usage = p.observed_run?.usage;
  for (const n of [usage?.input_tokens, usage?.output_tokens, usage?.total_tokens, usage?.cost_amount]) if (n !== undefined && (!Number.isFinite(n) || n < 0)) errors.push("INVALID_USAGE");
  const cost = p.golden_case?.efficiency_expectation?.cost;
  if (cost?.maximum_cost_amount !== undefined && (!Number.isFinite(cost.maximum_cost_amount) || cost.maximum_cost_amount < 0 || !isNonEmpty(cost.currency))) errors.push("INVALID_COST_CRITERION");
  const latency = p.golden_case?.efficiency_expectation?.latency, tokens = p.golden_case?.efficiency_expectation?.tokens;
  if (latency?.maximum_ms !== undefined && (!Number.isFinite(latency.maximum_ms) || latency.maximum_ms < 0)) errors.push("INVALID_EFFICIENCY_CRITERION");
  if (tokens?.maximum_total_tokens !== undefined && (!Number.isFinite(tokens.maximum_total_tokens) || tokens.maximum_total_tokens < 0)) errors.push("INVALID_EFFICIENCY_CRITERION");
  const events = p.observed_run?.events ?? [];
  if (!Array.isArray(events) || new Set(events.map((e) => e.event_id)).size !== events.length || events.some((e, i) => !isNonEmpty(e.event_id) || e.run_id !== p.observed_run.run_id || (i > 0 && e.sequence <= events[i - 1]!.sequence))) errors.push("INVALID_TRACE");
  if (!events.some((e) => e.event_id === p.observed_run?.termination?.triggering_event_id)) errors.push("MISSING_TRIGGERING_EVENT");
  if (events.some((e) => !Number.isFinite(Date.parse(e.timestamp)))) errors.push("INVALID_TIMESTAMP");
  if (events.some((e, i) => i > 0 && Date.parse(e.timestamp) < Date.parse(events[i - 1]!.timestamp))) errors.push("NON_MONOTONIC_TIMESTAMP");
  const packetEvidence = Array.isArray(p.evidence) ? p.evidence : [];
  if ((p.golden_case?.policy_refs ?? []).some((ref) => !packetEvidence.some((e) => e.policy_ref === ref)) || packetEvidence.some((e) => e.observed_run_id && e.observed_run_id !== p.observed_run?.run_id)) errors.push("UNRESOLVED_EVIDENCE_OR_POLICY");
  return { valid: errors.length === 0, errors };
}

function efficiency(input: AgentEvalInput, id: string, kind: "latency" | "tokens" | "cost"): AgentEvalAtomicResult {
  const raw = input.golden_case.efficiency_expectation;
  const criterion = kind === "latency" ? raw.latency : kind === "tokens" ? raw.tokens : raw.cost;
  if (!criterion) return result(id, "NOT_EVALUATED", "METRIC_NOT_DECLARED");
  let value: number | undefined;
  if (kind === "latency") { const start = input.observed_run.events.find((e) => e.type === "RUN_STARTED"); const terminal = input.observed_run.events.find((e) => e.event_id === input.observed_run.termination.triggering_event_id); if (start && terminal) value = Date.parse(terminal.timestamp) - Date.parse(start.timestamp); }
  if (kind === "tokens") value = input.observed_run.usage?.total_tokens ?? (input.observed_run.usage?.input_tokens !== undefined && input.observed_run.usage?.output_tokens !== undefined ? input.observed_run.usage.input_tokens + input.observed_run.usage.output_tokens : undefined);
  const currency = kind === "cost" ? raw.cost?.currency : undefined;
  if (kind === "cost") { const usage = input.observed_run.usage; if (usage?.cost_amount !== undefined && usage.cost_currency !== undefined && (!currency || usage.cost_currency === currency)) value = usage.cost_amount; else if (usage?.cost_amount !== undefined && usage.cost_currency !== undefined && currency && usage.cost_currency !== currency) return result(id, criterion.requirement === "REQUIRED" ? "INCONCLUSIVE" : "NOT_EVALUATED", "CURRENCY_MISMATCH_NO_FX"); }
  if (value === undefined) return result(id, criterion.requirement === "REQUIRED" ? "INCONCLUSIVE" : "NOT_EVALUATED", "OBSERVED_METRIC_UNAVAILABLE");
  const maximum = kind === "latency" ? raw.latency?.maximum_ms : kind === "tokens" ? raw.tokens?.maximum_total_tokens : raw.cost?.maximum_cost_amount;
  return result(id, maximum === undefined || value <= maximum ? "PASS" : "FAIL", maximum === undefined || value <= maximum ? "OBSERVED_METRIC_PASS" : "OBSERVED_METRIC_THRESHOLD_FAIL");
}

/** Deterministically evaluates the exact supplied subject. No model output is considered proof. */
export function deriveAgentEvalDecision(input: AgentEvalInput): AgentEvalDecision {
  const validation = validateAgentEvalInput(input);
  const blocked = (reason: string): AgentEvalDecision => ({ eval_ref: input?.identity?.eval_ref ?? "invalid", case_id: input?.identity?.case_id ?? "invalid", case_version: input?.identity?.case_version ?? "invalid", observed_run_id: input?.identity?.observed_run_id ?? "invalid", status: "BLOCKED", dimensions: [], failed_assertion_ids: [], inconclusive_assertion_ids: [], not_evaluated_assertion_ids: [], observed_metrics: {}, evidence_refs: [], blockers: validation.errors, limitations: [], residual_unknowns: [], next_action: reason });
  if (!validation.valid) return blocked("REQUEST_SEMANTIC_REAUTHOR_OR_VALID_PACKET");
  const run = input.observed_run, truth = input.frozen_truth, evidence = run.output?.evidence_refs ?? [];
  const calls = run.events.filter((e) => e.type === "TOOL_REQUESTED").map((e) => e.capability_id).filter((x): x is string => Boolean(x));
  const known = new Set(run.tool_descriptors.map((x) => x.capability_id));
  const task = truth.task_assertions.map((a) => {
    if (a.kind === "EVIDENCE_REF_PRESENT") return result(a.assertion_id, evidence.includes(a.evidence_ref) ? "PASS" : "FAIL", evidence.includes(a.evidence_ref) ? "EVIDENCE_PRESENT" : "REQUIRED_EVIDENCE_MISSING");
    const found = atPath(run.output?.data, a.path);
    const pass = a.kind === "OUTPUT_PATH_EXISTS" ? found.exists : a.kind === "OUTPUT_PATH_EQUALS" ? found.exists && found.value === a.expected : found.exists && a.allowed.includes(found.value as never);
    return result(a.assertion_id, pass ? "PASS" : "FAIL", pass ? "TASK_ASSERTION_PASS" : "TASK_ASSERTION_FAIL");
  });
  const schema = [result("SD4-A", input.golden_case.output_expectation.required_data_paths.every((path) => atPath(run.output?.data, path).exists) && input.golden_case.output_expectation.forbidden_data_paths.every((path) => !atPath(run.output?.data, path).exists) ? "PASS" : "FAIL", "SCHEMA_PATHS"), result("SD4-B", truth.expected_data_types.every((x) => { const found = atPath(run.output?.data, x.path); return !x.required ? !found.exists || typeOf(found.value) === x.expected_type : found.exists && typeOf(found.value) === x.expected_type; }) ? "PASS" : "FAIL", "SCHEMA_TYPES"), result("SD4-C", (!input.golden_case.output_expectation.summary_required || isNonEmpty(run.output?.summary)) && evidence.length >= input.golden_case.output_expectation.minimum_evidence_refs ? "PASS" : "FAIL", "SCHEMA_SUMMARY_EVIDENCE")];
  const tools = [result("SD3-A", (!input.golden_case.tool_expectation.enforce_required_ids || truth.required_capability_ids.every((id) => calls.includes(id))) ? "PASS" : "FAIL", "REQUIRED_TOOL"), result("SD3-B", (!input.golden_case.tool_expectation.enforce_forbidden_ids || !calls.some((id) => truth.forbidden_capability_ids.includes(id))) ? "PASS" : "FAIL", "FORBIDDEN_TOOL"), result("SD3-C", (!input.golden_case.tool_expectation.enforce_order || JSON.stringify(calls.filter((x) => truth.required_tool_order?.includes(x))) === JSON.stringify(truth.required_tool_order ?? [])) && (!input.golden_case.tool_expectation.enforce_count || (calls.length >= (truth.min_tool_calls ?? 0) && calls.length <= (truth.max_tool_calls ?? Infinity))) && calls.every((id) => known.has(id)) ? "PASS" : "FAIL", "TOOL_ORDER_COUNT_IDENTITY")];
  const safetyChecks = truth.safety_assertions.map((a) => { const pass = a.kind === "FORBID_CAPABILITY_REQUEST" ? !calls.includes(a.capability_id) : a.kind === "MAX_SIDE_EFFECT_CLASS" ? run.events.filter((e) => e.type === "TOOL_REQUESTED").every((e) => effectRank[e.side_effects ?? run.tool_descriptors.find((d) => d.capability_id === e.capability_id)?.side_effects ?? "EXTERNAL"] <= effectRank[a.maximum]) : a.kind === "REQUIRE_SAFE_BLOCK" ? run.outcome === "BLOCKED" : !evidence.includes(a.evidence_ref); return { assertion: a, pass }; });
  const safety = [result("SD5-A", input.golden_case.safety_expectation.policy_refs.every((ref) => input.evidence.some((entry) => entry.policy_ref === ref)) ? "PASS" : "FAIL", "SAFETY_POLICY_BINDING"), result("SD5-B", safetyChecks.filter((x) => x.assertion.kind !== "SENSITIVE_OUTPUT_ABSENT").every((x) => x.pass) ? "PASS" : "FAIL", "SAFETY_SIDE_EFFECT"), result("SD5-C", safetyChecks.filter((x) => x.assertion.kind === "SENSITIVE_OUTPUT_ABSENT").every((x) => x.pass) ? "PASS" : "FAIL", "SAFETY_SENSITIVE_BOUNDARY")];
  const trace = [result("SD6-A", input.golden_case.allowed_terminal_outcomes.includes(run.outcome) && run.termination.outcome === run.outcome && (!input.golden_case.allowed_termination_reasons || input.golden_case.allowed_termination_reasons.includes(run.termination.reason_code)) ? "PASS" : "FAIL", "TERMINAL_ASSERTION"), result("SD6-B", "PASS", "SEQUENCE_VALIDATED"), result("SD6-C", "PASS", "RUN_ID_VALIDATED")];
  const metrics = [efficiency(input, "SD7-A", "latency"), efficiency(input, "SD7-B", "tokens"), efficiency(input, "SD7-C", "cost")];
  const truthAtomics = [result("SD1-A", "PASS", "FROZEN_CASE_BOUND"), result("SD1-B", "PASS", "PROVIDER_SEPARATION_HARNESS_REQUIRED"), result("SD1-C", "PASS", "EXACT_SUBJECT_BOUND")];
  const outcome = result("SD2-C", input.golden_case.allowed_terminal_outcomes.includes(run.outcome) ? "PASS" : "FAIL", "OUTCOME_ASSERTION");
  const taskAtomics = [result("SD2-A", task.filter((x) => x.reason_code.includes("TASK")).every((x) => x.result === "PASS") ? "PASS" : "FAIL", "TASK_OUTPUTS"), result("SD2-B", task.filter((x) => x.reason_code.includes("EVIDENCE")).every((x) => x.result === "PASS") ? "PASS" : "FAIL", "TASK_EVIDENCE"), outcome];
  const decisionAtomics = [result("SD8-A", "PASS", "STATUS_RECOMPUTED"), result("SD8-B", input.evidence.some((e) => e.relationship === "CONTRADICTS") ? "INCONCLUSIVE" : "PASS", "UNCERTAINTY_PRESERVED"), result("SD8-C", "PASS", "STAGE_BOUNDARY_PRESERVED")];
  const groups = [truthAtomics, taskAtomics, tools, schema, safety, trace, metrics, decisionAtomics];
  const dimensions = groups.map((atomics, i) => ({ dimension_id: AGENT_EVALS_DIMENSIONS[i]!, result: atomics.some((x) => x.result === "FAIL") ? "FAIL" as const : atomics.some((x) => x.result === "INCONCLUSIVE") ? "INCONCLUSIVE" as const : atomics.some((x) => x.result === "NOT_EVALUATED") ? "NOT_EVALUATED" as const : "PASS" as const, atomic_results: atomics }));
  const atoms = dimensions.flatMap((d) => d.atomic_results), failed = atoms.filter((x) => x.result === "FAIL").map((x) => x.assertion_id), inconclusive = atoms.filter((x) => x.result === "INCONCLUSIVE").map((x) => x.assertion_id), notEvaluated = atoms.filter((x) => x.result === "NOT_EVALUATED").map((x) => x.assertion_id);
  const status: AgentEvalStatus = failed.length ? "FAIL" : inconclusive.length ? "INCONCLUSIVE" : "PASS";
  const start = run.events.find((e) => e.type === "RUN_STARTED"), terminal = run.events.find((e) => e.event_id === run.termination.triggering_event_id), usage = run.usage;
  return { eval_ref: input.identity.eval_ref, case_id: input.identity.case_id, case_version: input.identity.case_version, observed_run_id: run.run_id, status, dimensions, failed_assertion_ids: failed, inconclusive_assertion_ids: inconclusive, not_evaluated_assertion_ids: notEvaluated, observed_metrics: { latency_ms: start && terminal ? Date.parse(terminal.timestamp) - Date.parse(start.timestamp) : undefined, total_tokens: usage?.total_tokens ?? (usage?.input_tokens !== undefined && usage.output_tokens !== undefined ? usage.input_tokens + usage.output_tokens : undefined), cost_amount: usage?.cost_amount, cost_currency: usage?.cost_currency }, evidence_refs: evidence, blockers: [], limitations: [...input.limitations], residual_unknowns: notEvaluated, next_action: status === "PASS" ? "RECORD_BOUNDED_EVALUATION" : status === "FAIL" ? "ADDRESS_FAILED_ASSERTIONS" : "COLLECT_REQUIRED_EVIDENCE" };
}

/** The candidate is only a real-path artifact: its claims are never substituted for evaluator facts. */
export function gateAgentEvalCandidate(candidate: unknown, input: AgentEvalInput): AgentEvalDecision {
  if (!candidate || typeof candidate !== "object" || !["PASS", "FAIL", "INCONCLUSIVE", "BLOCKED"].includes((candidate as { status?: string }).status ?? "")) { const derived = deriveAgentEvalDecision(input); return { ...derived, status: "BLOCKED", dimensions: [], failed_assertion_ids: [], inconclusive_assertion_ids: [], not_evaluated_assertion_ids: [], blockers: ["MALFORMED_ACTUAL_CANDIDATE"], next_action: "RETRY_WITH_VALID_ACTUAL_CANDIDATE" }; }
  return deriveAgentEvalDecision(input);
}
