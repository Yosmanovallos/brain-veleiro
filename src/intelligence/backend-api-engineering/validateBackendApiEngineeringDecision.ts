import { EVIDENCE_KINDS, SAFE_TRANSPORT_RESPONSIBILITIES } from "./constants.js";
import { findForbiddenBindings, sameSet, stableStringify, pushError } from "./sharedValidation.js";
import { validateAuthBoundary } from "./validateAuthBoundary.js";
import { validateCompatibilityContract } from "./validateCompatibilityContract.js";
import { validateDataPortBoundary } from "./validateDataPortBoundary.js";
import { validateErrorContract } from "./validateErrorContract.js";
import { validateObservabilityContract } from "./validateObservabilityContract.js";
import { validateRequestContract } from "./validateRequestContract.js";
import { validateResponseContract } from "./validateResponseContract.js";
import { validateServiceBoundary } from "./validateServiceBoundary.js";
import { validateSideEffectContract } from "./validateSideEffectContract.js";
import type { BackendApiEngineeringDecision, BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

export function collectBackendApiInputErrors(input: BackendApiEngineeringInput): string[] {
  const errors = [
    ...validateRequestContract(input).errors,
    ...validateAuthBoundary(input).errors,
    ...validateServiceBoundary(input).errors,
    ...validateDataPortBoundary(input).errors,
    ...validateResponseContract(input).errors,
    ...validateErrorContract(input).errors,
    ...validateSideEffectContract(input).errors,
    ...validateObservabilityContract(input).errors,
    ...validateCompatibilityContract(input).errors,
  ];
  for (const finding of findForbiddenBindings(input)) pushError(errors, "HI-004", `framework/provider/future-stage binding at ${finding}`);
  if (!Array.isArray(input.spec_refs) || input.spec_refs.length === 0 || new Set(input.spec_refs).size !== input.spec_refs.length) {
    pushError(errors, "HI-035", "spec_refs must be non-empty and unique");
  }
  if (!Array.isArray(input.acceptance) || input.acceptance.length === 0) pushError(errors, "HI-035", "acceptance criteria are required");
  const evidenceKinds = new Set<string>(EVIDENCE_KINDS);
  if (!Array.isArray(input.evidence_required) || input.evidence_required.length === 0 || input.evidence_required.some((e) => !evidenceKinds.has(e.kind))) {
    pushError(errors, "HI-035", "evidence requirements must use S13I deterministic categories");
  }
  return [...new Set(errors)];
}

export function validateBackendApiEngineeringDecision(
  decision: BackendApiEngineeringDecision,
  input: BackendApiEngineeringInput,
): BackendApiValidationResult {
  const errors = collectBackendApiInputErrors(input);
  const recomputedInputErrors = [...errors];
  errors.push(...validateServiceBoundary(input, decision).errors);
  for (const finding of findForbiddenBindings(decision)) pushError(errors, "HI-004", `decision binding/pull-forward at ${finding}`);

  if (decision.task_ref !== input.task_ref || stableStringify(decision.spec_refs) !== stableStringify(input.spec_refs)) {
    pushError(errors, "HI-001", "decision task/spec refs do not preserve the bounded operation");
  }
  if (stableStringify(decision.operation_design) !== stableStringify(input.operation)) pushError(errors, "HI-001", "operation design drifted from input");
  if (!sameSet(decision.request_design.field_refs, input.request_contract.fields.map((field) => field.id))) pushError(errors, "HI-005", "request field refs drifted");
  if (decision.request_design.unknown_field_policy !== input.request_contract.unknown_field_policy) pushError(errors, "HI-006", "unknown-field policy drifted");
  if (!sameSet(decision.request_design.explicit_normalization_field_refs, input.request_contract.fields.filter((f) => f.normalization).map((f) => f.id))) pushError(errors, "HI-007", "normalization refs drifted");
  if (input.request_contract.has_body && (decision.request_design.max_body_bytes !== input.request_contract.max_body_bytes || !sameSet(decision.request_design.accepted_content_types, input.request_contract.accepted_content_types))) pushError(errors, "HI-009", "body boundary drifted");

  if (decision.auth_design.authentication !== input.auth_contract.authentication || decision.auth_design.authorization !== input.auth_contract.authorization || decision.auth_design.scope !== input.auth_contract.scope || decision.auth_design.trusted_scope_source !== input.auth_contract.trusted_scope_source || decision.auth_design.authorization_before_service_effect !== input.auth_contract.authorization_before_service_effect || !sameSet(decision.auth_design.non_authoritative_client_identity_fields, input.auth_contract.client_identity_fields_non_authoritative)) pushError(errors, "HI-016", "auth design drifted from the validated boundary");
  if (decision.service_design.service_operation_id !== input.service_contract.operation_id || decision.service_design.transport_types_allowed !== false) pushError(errors, "HI-012", "service design drifted");
  if (!sameSet(decision.data_port_design.requirement_refs, input.data_port_requirements.map((item) => item.id)) || decision.data_port_design.atomicity_requirement !== input.atomicity_contract.requirement) pushError(errors, "HI-013", "data-port design drifted");
  if (decision.side_effect_design.class !== input.side_effect_contract.class || decision.side_effect_design.idempotency !== input.side_effect_contract.idempotency || decision.side_effect_design.s13o_handoff_ref !== input.side_effect_contract.s13o_handoff_ref) pushError(errors, "HI-024", "side-effect/idempotency design drifted");
  if (!sameSet(decision.response_design.variant_ids, input.response_contract.variants.map((item) => item.id)) || decision.response_design.output_validation_required !== true) pushError(errors, "HI-020", "response design drifted");
  if (!sameSet(decision.error_design.error_codes, input.error_contract.variants.map((item) => item.code)) || decision.error_design.internal_cause_exposed !== false) pushError(errors, "HI-022", "error design exposes or drifts internal details");

  const obs = decision.observability_design as unknown as Record<string, unknown>;
  if (obs.raw_headers_logged !== false || obs.raw_body_logged !== false || ["request_id_required", "operation_name_required", "duration_required", "outcome_class_required", "error_code_required_on_error"].some((key) => obs[key] !== true)) pushError(errors, "HI-027", "observability design is incomplete/unsafe");
  if (!sameSet(decision.observability_design.allowlisted_log_fields, input.observability_contract.log_field_allowlist) || !sameSet(decision.observability_design.redacted_field_refs, input.observability_contract.redacted_field_refs)) pushError(errors, "HI-027", "observability allowlist/redaction drifted");
  if (decision.compatibility_design.mode !== input.compatibility_contract.mode || decision.compatibility_design.pagination_required !== (input.operation.collection.pagination === "REQUIRED") || decision.compatibility_design.rate_limit_requirement_ref !== input.compatibility_contract.rate_limit_requirement_ref || !sameSet(decision.compatibility_design.allowed_filter_fields, input.operation.collection.allowed_filter_fields) || !sameSet(decision.compatibility_design.allowed_sort_fields, input.operation.collection.allowed_sort_fields)) pushError(errors, "HI-029", "compatibility design drifted");
  if (stableStringify(decision.acceptance) !== stableStringify(input.acceptance) || stableStringify(decision.evidence_required) !== stableStringify(input.evidence_required)) pushError(errors, "HI-035", "acceptance/evidence was dropped, changed, or invented");

  const expectedBoundary = {
    transport_responsibilities: [...SAFE_TRANSPORT_RESPONSIBILITIES],
    service_responsibilities: [input.service_contract.responsibility],
    data_port_responsibilities: input.data_port_requirements.map((item) => `${item.kind}:${item.resource}`),
    deferred_to_s13j: ["persistence schema and transaction mechanism"],
    deferred_to_s13l: ["auth provider and tenancy platform"],
    deferred_to_s13o: input.side_effect_contract.idempotency === "DEFERRED_TO_S13O" ? [input.side_effect_contract.s13o_handoff_ref ?? "reliability handoff"] : [],
    deferred_to_s13p: ["observability provider binding"],
    deferred_to_s14: ["S14 capability implementation"],
  };
  if (stableStringify(decision.boundary_map) !== stableStringify(expectedBoundary)) pushError(errors, "HI-038", "boundary map drifted or pulled future-stage work forward");

  const recomputedStatus = recomputedInputErrors.length === 0 ? "READY" : "BLOCKED";
  if (decision.status !== recomputedStatus) pushError(errors, "HI-040", `candidate status '${decision.status}' disagrees with recomputed '${recomputedStatus}'`);
  if (stableStringify(decision.blockers) !== stableStringify(recomputedInputErrors)) pushError(errors, "HI-040", "candidate blockers do not equal recomputed blockers");
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
