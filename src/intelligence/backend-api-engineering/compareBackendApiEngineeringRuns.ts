import { findForbiddenBindings, sameSet, stableStringify } from "./sharedValidation.js";
import type {
  BackendApiArmScore,
  BackendApiAssertionResult,
  BackendApiComparison,
  BackendApiDimensionId,
  BackendApiEngineeringDecision,
  BackendApiEngineeringInput,
  BackendApiScoreCategory,
} from "./types.js";

export interface ScoredBackendApiCase { candidateDecision: BackendApiEngineeringDecision | null; input: BackendApiEngineeringInput; }
interface AssertionSpec {
  id: string;
  category: BackendApiScoreCategory;
  hard: boolean;
  test: (c: ScoredBackendApiCase) => boolean;
}
const DIMS: BackendApiDimensionId[] = ["SD-001", "SD-002", "SD-003", "SD-004", "SD-005", "SD-006", "SD-007", "SD-008", "SD-009", "SD-010"];
const d = (c: ScoredBackendApiCase) => c.candidateDecision;

export const BACKEND_API_COMPARISON_ASSERTIONS: AssertionSpec[] = [
  { id: "SD1-A", category: "SD-001", hard: true, test: (c) => !!d(c) && stableStringify(d(c)!.operation_design) === stableStringify(c.input.operation) },
  { id: "SD1-B", category: "SD-001", hard: true, test: (c) => !!d(c) && findForbiddenBindings(d(c)!.operation_design).length === 0 },
  { id: "SD1-C", category: "SD-001", hard: false, test: (c) => !!d(c) && !d(c)!.boundary_map.transport_responsibilities.some((x) => /business|persist|\borm\b|\bsql\b/i.test(x)) },
  { id: "SD2-A", category: "SD-002", hard: true, test: (c) => d(c)?.request_design.unknown_field_policy === c.input.request_contract.unknown_field_policy },
  { id: "SD2-B", category: "SD-002", hard: true, test: (c) => !c.input.request_contract.has_body || (d(c)?.request_design.max_body_bytes === c.input.request_contract.max_body_bytes && sameSet(d(c)?.request_design.accepted_content_types ?? [], c.input.request_contract.accepted_content_types)) },
  { id: "SD2-C", category: "SD-002", hard: false, test: (c) => sameSet(d(c)?.request_design.explicit_normalization_field_refs ?? [], c.input.request_contract.fields.filter((f) => f.normalization).map((f) => f.id)) },
  { id: "SD3-A", category: "SD-003", hard: true, test: (c) => d(c)?.auth_design.authorization === c.input.auth_contract.authorization },
  { id: "SD3-B", category: "SD-003", hard: true, test: (c) => d(c)?.auth_design.authorization_before_service_effect === c.input.auth_contract.authorization_before_service_effect },
  { id: "SD3-C", category: "SD-003", hard: false, test: (c) => sameSet(d(c)?.auth_design.non_authoritative_client_identity_fields ?? [], c.input.auth_contract.client_identity_fields_non_authoritative) },
  { id: "SD4-A", category: "SD-004", hard: true, test: (c) => !!d(c) && !d(c)!.boundary_map.transport_responsibilities.some((x) => /persist|repository call|data-port call|\bsql\b|\borm\b/i.test(x)) },
  { id: "SD4-B", category: "SD-004", hard: true, test: (c) => d(c)?.service_design.service_operation_id === c.input.service_contract.operation_id && d(c)?.service_design.transport_types_allowed === false },
  { id: "SD4-C", category: "SD-004", hard: false, test: (c) => sameSet(d(c)?.data_port_design.requirement_refs ?? [], c.input.data_port_requirements.map((x) => x.id)) },
  { id: "SD5-A", category: "SD-005", hard: true, test: (c) => sameSet(d(c)?.response_design.variant_ids ?? [], c.input.response_contract.variants.map((x) => x.id)) && d(c)?.response_design.output_validation_required === true },
  { id: "SD5-B", category: "SD-005", hard: true, test: (c) => sameSet(d(c)?.error_design.error_codes ?? [], c.input.error_contract.variants.map((x) => x.code)) },
  { id: "SD5-C", category: "SD-005", hard: false, test: (c) => d(c)?.error_design.internal_cause_exposed === false && !(d(c)?.error_design.error_codes ?? []).some((x) => /STACK|SQL|SECRET|TOKEN|CREDENTIAL|PRIVATE_KEY/.test(x)) },
  { id: "SD6-A", category: "SD-006", hard: true, test: (c) => d(c)?.side_effect_design.class === c.input.side_effect_contract.class },
  { id: "SD6-B", category: "SD-006", hard: true, test: (c) => d(c)?.side_effect_design.idempotency === c.input.side_effect_contract.idempotency },
  { id: "SD6-C", category: "SD-006", hard: false, test: (c) => d(c)?.side_effect_design.s13o_handoff_ref === c.input.side_effect_contract.s13o_handoff_ref },
  { id: "SD7-A", category: "SD-007", hard: true, test: (c) => !!d(c) && [d(c)!.observability_design.request_id_required, d(c)!.observability_design.operation_name_required, d(c)!.observability_design.duration_required, d(c)!.observability_design.outcome_class_required, d(c)!.observability_design.error_code_required_on_error].every(Boolean) },
  { id: "SD7-B", category: "SD-007", hard: true, test: (c) => d(c)?.observability_design.raw_headers_logged === false && d(c)?.observability_design.raw_body_logged === false },
  { id: "SD7-C", category: "SD-007", hard: false, test: (c) => !(d(c)?.observability_design.allowlisted_log_fields ?? []).some((x) => /authorization|cookie|token|secret|password|api.?key/i.test(x)) },
  { id: "SD8-A", category: "SD-008", hard: true, test: (c) => d(c)?.compatibility_design.mode === c.input.compatibility_contract.mode },
  { id: "SD8-B", category: "SD-008", hard: true, test: (c) => d(c)?.compatibility_design.pagination_required === (c.input.operation.collection.pagination === "REQUIRED") },
  { id: "SD8-C", category: "SD-008", hard: false, test: (c) => sameSet(d(c)?.compatibility_design.allowed_filter_fields ?? [], c.input.operation.collection.allowed_filter_fields) && sameSet(d(c)?.compatibility_design.allowed_sort_fields ?? [], c.input.operation.collection.allowed_sort_fields) },
  { id: "SD9-A", category: "SD-009", hard: true, test: (c) => stableStringify(d(c)?.acceptance) === stableStringify(c.input.acceptance) },
  { id: "SD9-B", category: "SD-009", hard: true, test: (c) => stableStringify(d(c)?.evidence_required) === stableStringify(c.input.evidence_required) },
  { id: "SD9-C", category: "SD-009", hard: false, test: (c) => stableStringify(d(c)?.spec_refs) === stableStringify(c.input.spec_refs) },
  { id: "SD10-A", category: "SD-010", hard: true, test: (c) => !!d(c) && findForbiddenBindings(d(c)).length === 0 },
  { id: "SD10-B", category: "SD-010", hard: true, test: (c) => !!d(c) && d(c)!.boundary_map.deferred_to_s13j.length > 0 && d(c)!.boundary_map.deferred_to_s13l.length > 0 && d(c)!.boundary_map.deferred_to_s13p.length > 0 && d(c)!.boundary_map.deferred_to_s14.length > 0 },
  { id: "SD10-C", category: "SD-010", hard: false, test: (c) => !!d(c) && !("capability_registry" in (d(c)! as unknown as Record<string, unknown>)) },
  { id: "XC-A", category: "REGRESSION_CROSS_CUTTING", hard: false, test: (c) => d(c)?.status === "READY" },
];

function emptyDims(): BackendApiArmScore["by_dimension"] {
  return Object.fromEntries(
    DIMS.map((id) => [id, { assertion_ids: [] as string[], total: 0, correct: 0 }]),
  ) as unknown as BackendApiArmScore["by_dimension"];
}
export function scoreBackendApiEngineeringArm(cases: ScoredBackendApiCase[]): BackendApiArmScore {
  const by_dimension = emptyDims();
  const cross_cutting = { assertion_ids: [] as string[], total: 0, correct: 0 };
  const assertions: BackendApiAssertionResult[] = [];
  let correct = 0, total = 0, hard_invariant_total = 0, hard_invariant_correct = 0;
  let unsafe_auth_recommendations = 0, secret_pii_leak_recommendations = 0, direct_persistence_in_transport_recommendations = 0, framework_provider_bindings = 0, future_stage_pull_forward_violations = 0;
  for (const c of cases) {
    for (const spec of BACKEND_API_COMPARISON_ASSERTIONS) {
      let ok = false; try { ok = spec.test(c); } catch { ok = false; }
      assertions.push({ id: spec.id, category: spec.category, correct: ok, hard_invariant: spec.hard });
      total++; if (ok) correct++;
      if (spec.category === "REGRESSION_CROSS_CUTTING") { cross_cutting.total++; cross_cutting.assertion_ids.push(spec.id); if (ok) cross_cutting.correct++; }
      else { const dim = by_dimension[spec.category]; dim.total++; dim.assertion_ids.push(spec.id); if (ok) dim.correct++; }
      if (spec.hard) { hard_invariant_total++; if (ok) hard_invariant_correct++; }
    }
    const candidate = d(c);
    if (candidate) {
      if (candidate.auth_design.authorization !== c.input.auth_contract.authorization || !candidate.auth_design.authorization_before_service_effect) unsafe_auth_recommendations++;
      if (candidate.error_design.internal_cause_exposed || candidate.error_design.error_codes.some((x) => /STACK|SQL|SECRET|TOKEN|CREDENTIAL|PRIVATE_KEY/.test(x)) || candidate.observability_design.allowlisted_log_fields.some((x) => /authorization|cookie|token|secret|password|api.?key/i.test(x))) secret_pii_leak_recommendations++;
      if (candidate.boundary_map.transport_responsibilities.some((x) => /persist|repository call|data-port call|\bsql\b|\borm\b/i.test(x))) direct_persistence_in_transport_recommendations++;
      const bindings = findForbiddenBindings(candidate);
      framework_provider_bindings += bindings.filter((x) => /framework|router|controller|server|express|auth_provider|orm|vendor|logger|tracer|metrics/i.test(x)).length;
      future_stage_pull_forward_violations += bindings.filter((x) => /capability_registry|retry|backoff|job_queue|idempotency_store|rate_limit|openapi/i.test(x)).length;
    }
  }
  return { total_assertions: total, correct, by_dimension, cross_cutting, hard_invariant_total, hard_invariant_correct, unsafe_auth_recommendations, secret_pii_leak_recommendations, direct_persistence_in_transport_recommendations, framework_provider_bindings, future_stage_pull_forward_violations, assertions };
}

export function compareBackendApiEngineeringRuns(baselineCases: ScoredBackendApiCase[], skillCases: ScoredBackendApiCase[]): BackendApiComparison {
  const baseline = scoreBackendApiEngineeringArm(baselineCases);
  const skill = scoreBackendApiEngineeringArm(skillCases);
  const dimension_improvements = {} as BackendApiComparison["dimension_improvements"];
  const improved_dimensions: BackendApiDimensionId[] = [];
  let dimension_specific_total_delta = 0;
  for (const dim of DIMS) {
    const delta = skill.by_dimension[dim].correct - baseline.by_dimension[dim].correct;
    dimension_specific_total_delta += delta;
    const scored_assertions = skill.by_dimension[dim].total;
    const max_single_assertion_share = delta > 0 ? 1 / delta : 0;
    dimension_improvements[dim] = { delta, scored_assertions, max_single_assertion_share };
    if (scored_assertions >= 3 && delta >= 2 && max_single_assertion_share <= 0.5) improved_dimensions.push(dim);
  }
  const hard_invariant_regressed = skill.hard_invariant_correct < baseline.hard_invariant_correct;
  const meets_threshold = skill.hard_invariant_total > 0 && skill.hard_invariant_correct === skill.hard_invariant_total && skill.unsafe_auth_recommendations === 0 && skill.secret_pii_leak_recommendations === 0 && skill.direct_persistence_in_transport_recommendations === 0 && skill.framework_provider_bindings === 0 && skill.future_stage_pull_forward_violations === 0 && dimension_specific_total_delta >= 12 && improved_dimensions.length >= 5 && !hard_invariant_regressed;
  return { baseline, skill, dimension_specific_total_delta, improved_dimensions, dimension_improvements, hard_invariant_regressed, meets_threshold };
}
