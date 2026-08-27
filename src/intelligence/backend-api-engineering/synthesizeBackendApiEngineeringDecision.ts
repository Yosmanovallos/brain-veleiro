import { SAFE_TRANSPORT_RESPONSIBILITIES } from "./constants.js";
import { collectBackendApiInputErrors } from "./validateBackendApiEngineeringDecision.js";
import type { BackendApiEngineeringDecision, BackendApiEngineeringInput } from "./types.js";

export interface BackendApiSynthesisProfile {
  operation_transport: boolean;
  request_safety: boolean;
  auth_scope: boolean;
  service_data_separation: boolean;
  response_error_safety: boolean;
  side_effect_safety: boolean;
  observability_safety: boolean;
  compatibility_safety: boolean;
  traceability: boolean;
  future_stage_boundary: boolean;
}

export const FAITHFUL_BACKEND_API_PROFILE: BackendApiSynthesisProfile = {
  operation_transport: true,
  request_safety: true,
  auth_scope: true,
  service_data_separation: true,
  response_error_safety: true,
  side_effect_safety: true,
  observability_safety: true,
  compatibility_safety: true,
  traceability: true,
  future_stage_boundary: true,
};

export const UNGUIDED_BACKEND_API_PROFILE: BackendApiSynthesisProfile = {
  operation_transport: false,
  request_safety: false,
  auth_scope: false,
  service_data_separation: false,
  response_error_safety: false,
  side_effect_safety: false,
  observability_safety: false,
  compatibility_safety: false,
  traceability: false,
  future_stage_boundary: false,
};

/** Derives behavior only from semantic rule prose, never fixture/Skill ids or an arm flag. */
export function deriveBackendApiProfileFromRules(ruleText: readonly string[]): BackendApiSynthesisProfile {
  const text = ruleText.join("\n").toLowerCase();
  return {
    operation_transport: /framework-neutral/.test(text) && /thin transport/.test(text),
    request_safety: /unknown fields reject/.test(text) && /no implicit coercion/.test(text),
    auth_scope: /client identity is not authority/.test(text) && /authorization precedes/.test(text),
    service_data_separation: /no direct sql/.test(text) && /application-service contract/.test(text),
    response_error_safety: /output validation mandatory/.test(text) && /no response leakage/.test(text),
    side_effect_safety: /side effects classified/.test(text) && /idempotency handoff/.test(text),
    observability_safety: /endpoint-local observability required/.test(text) && /safe logging/.test(text),
    compatibility_safety: /breaking change must be explicit/.test(text) && /unbounded list requires pagination/.test(text),
    traceability: /acceptance\/evidence preserved/.test(text),
    future_stage_boundary: /no s14\/s13j\/s13l\/s13o\/s13p pull-forward/.test(text),
  };
}

export function synthesizeBackendApiEngineeringDecision(
  input: BackendApiEngineeringInput,
  profile: BackendApiSynthesisProfile = FAITHFUL_BACKEND_API_PROFILE,
): BackendApiEngineeringDecision {
  const safe = profile;
  const baseErrors = collectBackendApiInputErrors(input);
  const decision: BackendApiEngineeringDecision = {
    status: baseErrors.length === 0 ? "READY" : "BLOCKED",
    blockers: baseErrors,
    task_ref: input.task_ref,
    spec_refs: [...input.spec_refs],
    operation_design: structuredClone(input.operation),
    boundary_map: {
      transport_responsibilities: safe.service_data_separation
        ? [...SAFE_TRANSPORT_RESPONSIBILITIES]
        : ["validate request", "apply business rules", "persist with ORM from controller"],
      service_responsibilities: [input.service_contract.responsibility],
      data_port_responsibilities: input.data_port_requirements.map((item) => `${item.kind}:${item.resource}`),
      deferred_to_s13j: safe.future_stage_boundary ? ["persistence schema and transaction mechanism"] : [],
      deferred_to_s13l: safe.future_stage_boundary ? ["auth provider and tenancy platform"] : [],
      deferred_to_s13o: safe.future_stage_boundary && input.side_effect_contract.idempotency === "DEFERRED_TO_S13O"
        ? [input.side_effect_contract.s13o_handoff_ref ?? "reliability handoff"] : [],
      deferred_to_s13p: safe.future_stage_boundary ? ["observability provider binding"] : [],
      deferred_to_s14: safe.future_stage_boundary ? ["S14 capability implementation"] : [],
    },
    request_design: {
      field_refs: input.request_contract.fields.map((field) => field.id),
      unknown_field_policy: safe.request_safety ? input.request_contract.unknown_field_policy : "ALLOW_DECLARED_ADDITIONAL_FIELDS",
      accepted_content_types: safe.request_safety ? [...input.request_contract.accepted_content_types] : [],
      ...(safe.request_safety && input.request_contract.max_body_bytes !== undefined
        ? { max_body_bytes: input.request_contract.max_body_bytes }
        : {}),
      explicit_normalization_field_refs: safe.request_safety
        ? input.request_contract.fields.filter((field) => field.normalization).map((field) => field.id)
        : [],
    },
    auth_design: {
      authentication: input.auth_contract.authentication,
      authorization: safe.auth_scope ? input.auth_contract.authorization : "NONE",
      scope: safe.auth_scope ? input.auth_contract.scope : "NONE",
      ...(safe.auth_scope && input.auth_contract.trusted_scope_source
        ? { trusted_scope_source: input.auth_contract.trusted_scope_source }
        : {}),
      authorization_before_service_effect: safe.auth_scope && input.auth_contract.authorization_before_service_effect,
      non_authoritative_client_identity_fields: safe.auth_scope
        ? [...input.auth_contract.client_identity_fields_non_authoritative]
        : [],
    },
    service_design: {
      service_operation_id: input.service_contract.operation_id,
      transport_types_allowed: false,
    },
    data_port_design: {
      requirement_refs: input.data_port_requirements.map((item) => item.id),
      atomicity_requirement: input.atomicity_contract.requirement,
    },
    side_effect_design: {
      class: input.side_effect_contract.class,
      idempotency: safe.side_effect_safety ? input.side_effect_contract.idempotency : "NOT_APPLICABLE",
      ...(safe.side_effect_safety && input.side_effect_contract.s13o_handoff_ref
        ? { s13o_handoff_ref: input.side_effect_contract.s13o_handoff_ref }
        : {}),
    },
    response_design: {
      variant_ids: input.response_contract.variants.map((variant) => variant.id),
      output_validation_required: true,
    },
    error_design: {
      error_codes: safe.response_error_safety
        ? input.error_contract.variants.map((variant) => variant.code)
        : [...input.error_contract.variants.map((variant) => variant.code), "STACK_TRACE"],
      internal_cause_exposed: false,
    },
    observability_design: {
      request_id_required: safe.observability_safety && input.observability_contract.request_id_required,
      operation_name_required: safe.observability_safety && input.observability_contract.operation_name_required,
      duration_required: safe.observability_safety && input.observability_contract.duration_required,
      outcome_class_required: safe.observability_safety && input.observability_contract.outcome_class_required,
      error_code_required_on_error: safe.observability_safety && input.observability_contract.error_code_required_on_error,
      raw_headers_logged: false,
      raw_body_logged: false,
      allowlisted_log_fields: safe.observability_safety ? [...input.observability_contract.log_field_allowlist] : ["authorization"],
      redacted_field_refs: safe.observability_safety ? [...input.observability_contract.redacted_field_refs] : [],
    },
    compatibility_design: {
      mode: safe.compatibility_safety ? input.compatibility_contract.mode : "NEW",
      pagination_required: safe.compatibility_safety && input.operation.collection.pagination === "REQUIRED",
      allowed_filter_fields: safe.compatibility_safety ? [...input.operation.collection.allowed_filter_fields] : [],
      allowed_sort_fields: safe.compatibility_safety ? [...input.operation.collection.allowed_sort_fields] : [],
      ...(safe.compatibility_safety && input.compatibility_contract.rate_limit_requirement_ref
        ? { rate_limit_requirement_ref: input.compatibility_contract.rate_limit_requirement_ref }
        : {}),
    },
    acceptance: safe.traceability ? structuredClone(input.acceptance) : [],
    evidence_required: safe.traceability ? structuredClone(input.evidence_required) : [],
  };

  if (!safe.operation_transport) {
    (decision.operation_design as unknown as Record<string, unknown>).framework = "Express router";
  }
  if (!safe.future_stage_boundary) {
    (decision as unknown as Record<string, unknown>).capability_registry = { enabled: true };
  }
  return decision;
}
