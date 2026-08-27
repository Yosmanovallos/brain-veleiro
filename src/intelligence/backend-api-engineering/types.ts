import type { JsonSchemaLike } from "../../core/agent/index.js";
import type {
  TaskAcceptanceCriterion,
} from "../implementation-planning/types.js";

export type BackendApiEngineeringStatus = "READY" | "BLOCKED";
export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiRequestLocation = "PATH" | "QUERY" | "HEADER" | "BODY";
export type UnknownFieldPolicy = "REJECT" | "ALLOW_DECLARED_ADDITIONAL_FIELDS";
export type ApiAuthenticationMode = "PUBLIC" | "AUTHENTICATED";
export type ApiAuthorizationMode = "NONE" | "POLICY_REQUIRED" | "RESOURCE_REQUIRED";
export type ApiResourceScope = "NONE" | "OWNER" | "TENANT" | "RESOURCE" | "CUSTOM";
export type TrustedScopeSource = "AUTH_CONTEXT" | "RESOURCE_LOOKUP";
export type ApiSideEffectClass =
  | "READ_ONLY"
  | "IDEMPOTENT_WRITE"
  | "NON_IDEMPOTENT_WRITE"
  | "EXTERNAL_SIDE_EFFECT";
export type ApiIdempotencyRequirement =
  | "NOT_APPLICABLE"
  | "DECLARED_IDEMPOTENT"
  | "IDEMPOTENCY_REQUIRED"
  | "DEFERRED_TO_S13O";
export type ApiCompatibilityMode = "NEW" | "BACKWARD_COMPATIBLE_CHANGE" | "BREAKING_CHANGE_APPROVED";
export type ApiDataOperationKind = "READ" | "CREATE" | "UPDATE" | "DELETE" | "EXISTS" | "LIST" | "ATOMIC_GROUP_REQUIRED";
export type ApiSchemaLike = JsonSchemaLike;

export interface ApiRequestFieldContract {
  id: string;
  location: ApiRequestLocation;
  required: boolean;
  schema: ApiSchemaLike;
  normalization?: { kind: string; failure: "REJECT" };
  authority_role: "DATA" | "NON_AUTHORITATIVE_IDENTITY_HINT" | "NONE";
}

export interface ApiRequestContract {
  fields: ApiRequestFieldContract[];
  unknown_field_policy: UnknownFieldPolicy;
  has_body: boolean;
  accepted_content_types: string[];
  max_body_bytes?: number;
  /** Mechanical evidence hook for R4/R5; omitted means every declared field is consumed. */
  consumed_field_refs?: string[];
  /** Explicitly bounded extras allowed by ALLOW_DECLARED_ADDITIONAL_FIELDS. */
  additional_field_ids?: string[];
}

export interface ApiResponseVariant {
  id: string;
  http_status: number;
  condition: string;
  schema: ApiSchemaLike;
}
export interface ApiResponseContract {
  success_variant_ids: string[];
  variants: ApiResponseVariant[];
  output_validation_required: true;
}
export type ApiErrorDetailsPolicy = "NONE" | "SAFE_SCHEMA_BOUNDED";
export interface ApiErrorVariant {
  code: string;
  http_status: number;
  safe_message: string;
  details_policy: ApiErrorDetailsPolicy;
  details_schema?: ApiSchemaLike;
  request_id_in_response: boolean;
}
export interface ApiErrorContract { variants: ApiErrorVariant[]; }
export interface ApiAuthContract {
  authentication: ApiAuthenticationMode;
  authorization: ApiAuthorizationMode;
  scope: ApiResourceScope;
  trusted_scope_source?: TrustedScopeSource;
  authorization_before_service_effect: boolean;
  client_identity_fields_non_authoritative: string[];
}
export interface ApiApplicationServiceContract {
  operation_id: string;
  input_ref: string;
  output_ref: string;
  transport_types_allowed: false;
  responsibility: string;
}
export interface ApiDataPortRequirement {
  id: string;
  kind: ApiDataOperationKind;
  resource: string;
  field_intent_refs: string[];
  source_refs: string[];
}
export interface ApiAtomicityContract {
  requirement: "NONE" | "ATOMIC_GROUP_REQUIRED";
  logical_operation_refs: string[];
}
export interface ApiSideEffectContract {
  class: ApiSideEffectClass;
  caller_retryable: boolean;
  idempotency: ApiIdempotencyRequirement;
  s13o_handoff_ref?: string;
}
export interface ApiObservabilityContract {
  request_id_required: boolean;
  operation_name_required: boolean;
  duration_required: boolean;
  outcome_class_required: boolean;
  error_code_required_on_error: boolean;
  log_raw_headers: false;
  log_raw_body: false;
  log_field_allowlist: string[];
  redacted_field_refs: string[];
}
export interface ApiCollectionContract {
  potentially_unbounded: boolean;
  pagination: "NOT_APPLICABLE" | "REQUIRED" | "BOUNDED_CARDINALITY_RATIONALE";
  bounded_cardinality_rationale?: string;
  allowed_filter_fields: string[];
  allowed_sort_fields: string[];
}
export interface ApiCompatibilityContract {
  mode: ApiCompatibilityMode;
  existing_contract_ref?: string;
  rate_limit_requirement_ref?: string;
}
export interface ApiOperationContract {
  operation_id: string;
  method: ApiHttpMethod;
  path_template: string;
  summary: string;
  success_status: number;
  collection: ApiCollectionContract;
}

export type BackendApiEvidenceKind =
  | "TYPECHECK" | "BUILD" | "REQUEST_SCHEMA_TEST" | "RESPONSE_SCHEMA_TEST"
  | "AUTHENTICATION_BOUNDARY_TEST" | "AUTHORIZATION_BOUNDARY_TEST" | "RESOURCE_SCOPE_TEST"
  | "SERVICE_UNIT_TEST" | "API_INTEGRATION_TEST" | "NEGATIVE_VALIDATION_TEST"
  | "ERROR_MAPPING_TEST" | "SIDE_EFFECT_IDEMPOTENCY_TEST" | "DATA_PORT_CONTRACT_TEST"
  | "OBSERVABILITY_CONTRACT_TEST" | "NO_SECRET_RESPONSE_TEST" | "NO_SECRET_LOG_TEST"
  | "BACKWARD_COMPATIBILITY_TEST" | "PAGINATION_FILTER_SORT_TEST" | "CONTRACT_INSPECTION"
  | "OTHER_DETERMINISTIC";
export interface TaskEvidenceRequirement {
  kind: BackendApiEvidenceKind;
  description: string;
  source_ref?: string;
  manual_review_reason?: string;
}
export type { TaskAcceptanceCriterion };

export interface BackendApiEngineeringInput {
  task_ref: string;
  spec_refs: string[];
  operation: ApiOperationContract;
  request_contract: ApiRequestContract;
  response_contract: ApiResponseContract;
  error_contract: ApiErrorContract;
  auth_contract: ApiAuthContract;
  service_contract: ApiApplicationServiceContract;
  data_port_requirements: ApiDataPortRequirement[];
  atomicity_contract: ApiAtomicityContract;
  side_effect_contract: ApiSideEffectContract;
  observability_contract: ApiObservabilityContract;
  compatibility_contract: ApiCompatibilityContract;
  acceptance: TaskAcceptanceCriterion[];
  evidence_required: TaskEvidenceRequirement[];
}

export interface ApiBoundaryMap {
  transport_responsibilities: string[];
  service_responsibilities: string[];
  data_port_responsibilities: string[];
  deferred_to_s13j: string[];
  deferred_to_s13l: string[];
  deferred_to_s13o: string[];
  deferred_to_s13p: string[];
  deferred_to_s14: string[];
}
export interface ApiRequestDesign {
  field_refs: string[];
  unknown_field_policy: UnknownFieldPolicy;
  accepted_content_types: string[];
  max_body_bytes?: number;
  explicit_normalization_field_refs: string[];
}
export interface ApiAuthDesign {
  authentication: ApiAuthenticationMode;
  authorization: ApiAuthorizationMode;
  scope: ApiResourceScope;
  trusted_scope_source?: TrustedScopeSource;
  authorization_before_service_effect: boolean;
  non_authoritative_client_identity_fields: string[];
}
export interface ApiServiceDesign { service_operation_id: string; transport_types_allowed: false; }
export interface ApiDataPortDesign { requirement_refs: string[]; atomicity_requirement: ApiAtomicityContract["requirement"]; }
export interface ApiSideEffectDesign { class: ApiSideEffectClass; idempotency: ApiIdempotencyRequirement; s13o_handoff_ref?: string; }
export interface ApiResponseDesign { variant_ids: string[]; output_validation_required: true; }
export interface ApiErrorDesign { error_codes: string[]; internal_cause_exposed: false; }
export interface ApiObservabilityDesign {
  request_id_required: boolean;
  operation_name_required: boolean;
  duration_required: boolean;
  outcome_class_required: boolean;
  error_code_required_on_error: boolean;
  raw_headers_logged: false;
  raw_body_logged: false;
  allowlisted_log_fields: string[];
  redacted_field_refs: string[];
}
export interface ApiCompatibilityDesign {
  mode: ApiCompatibilityMode;
  pagination_required: boolean;
  allowed_filter_fields: string[];
  allowed_sort_fields: string[];
  rate_limit_requirement_ref?: string;
}
export interface BackendApiEngineeringDecision {
  status: BackendApiEngineeringStatus;
  blockers: string[];
  task_ref: string;
  spec_refs: string[];
  operation_design: ApiOperationContract;
  boundary_map: ApiBoundaryMap;
  request_design: ApiRequestDesign;
  auth_design: ApiAuthDesign;
  service_design: ApiServiceDesign;
  data_port_design: ApiDataPortDesign;
  side_effect_design: ApiSideEffectDesign;
  response_design: ApiResponseDesign;
  error_design: ApiErrorDesign;
  observability_design: ApiObservabilityDesign;
  compatibility_design: ApiCompatibilityDesign;
  acceptance: TaskAcceptanceCriterion[];
  evidence_required: TaskEvidenceRequirement[];
}

export interface BackendApiValidationResult { valid: boolean; errors: string[]; }
export interface RequestPayloadValidationResult { valid: boolean; errors: string[]; normalized: Record<string, unknown>; }
export type ApiOperationClass = "PUBLIC_READ" | "AUTHENTICATED_READ" | "PROTECTED_WRITE" | "EXTERNAL_EFFECT";

export type BackendApiDimensionId =
  | "SD-001" | "SD-002" | "SD-003" | "SD-004" | "SD-005"
  | "SD-006" | "SD-007" | "SD-008" | "SD-009" | "SD-010";
export type BackendApiScoreCategory = BackendApiDimensionId | "REGRESSION_CROSS_CUTTING";
export interface BackendApiAssertionResult { id: string; category: BackendApiScoreCategory; correct: boolean; hard_invariant: boolean; }
export interface BackendApiArmScore {
  total_assertions: number;
  correct: number;
  by_dimension: Record<BackendApiDimensionId, { assertion_ids: string[]; total: number; correct: number }>;
  cross_cutting: { assertion_ids: string[]; total: number; correct: number };
  hard_invariant_total: number;
  hard_invariant_correct: number;
  unsafe_auth_recommendations: number;
  secret_pii_leak_recommendations: number;
  direct_persistence_in_transport_recommendations: number;
  framework_provider_bindings: number;
  future_stage_pull_forward_violations: number;
  assertions: BackendApiAssertionResult[];
}
export interface BackendApiComparison {
  baseline: BackendApiArmScore;
  skill: BackendApiArmScore;
  dimension_specific_total_delta: number;
  improved_dimensions: BackendApiDimensionId[];
  dimension_improvements: Record<BackendApiDimensionId, { delta: number; scored_assertions: number; max_single_assertion_share: number }>;
  hard_invariant_regressed: boolean;
  meets_threshold: boolean;
}
