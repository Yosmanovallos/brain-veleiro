import type {
  AgentDefinition,
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
} from "../../src/core/agent/index.js";
import {
  BACKEND_API_ENGINEERING_INPUT_MARKER,
  deriveBackendApiProfileFromRules,
  synthesizeBackendApiEngineeringDecision,
  type BackendApiEngineeringDecision,
  type BackendApiEngineeringInput,
} from "../../src/intelligence/backend-api-engineering/index.js";
import { backendApiEngineeringS13I } from "../../src/intelligence/skills/index.js";

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["summary"],
  properties: { summary: { type: "string" }, data: {}, evidence_refs: { type: "array" } },
  additionalProperties: false,
};

export const backendApiHost: AgentDefinition = {
  id: "s13i-generic-skill-host",
  role: "generic-skill-host",
  objective: "Execute one caller-selected Intelligence capability through the generic runtime and return structured decision data.",
  model_policy: { routing_class: "QUALITY", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 12000, max_items: 40, allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF"], require_source_refs: true },
  state_schema: { type: "object", additionalProperties: false, properties: { selected: { type: "string" } } },
  tools: [],
  skills: [backendApiEngineeringS13I.id],
  capabilities: [],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 15000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: structuredClone(OUTPUT_SCHEMA),
  rubric: { quality_contract_ref: "S13I_BACKEND_API_ENGINEERING_DEEP" },
  evals: ["evals/s13i/host-run"],
};

export function baseInput(): BackendApiEngineeringInput {
  return {
    task_ref: "TASK-API-001",
    spec_refs: ["specs/widgets-list"],
    operation: {
      operation_id: "listWidgets",
      method: "GET",
      path_template: "/widgets",
      summary: "List visible widgets",
      success_status: 200,
      collection: {
        potentially_unbounded: true,
        pagination: "REQUIRED",
        allowed_filter_fields: ["status"],
        allowed_sort_fields: ["sort"],
      },
    },
    request_contract: {
      fields: [
        { id: "status", location: "QUERY", required: false, schema: { type: "string" }, authority_role: "DATA" },
        { id: "sort", location: "QUERY", required: false, schema: { type: "string" }, authority_role: "DATA" },
        { id: "page", location: "QUERY", required: false, schema: { type: "integer" }, normalization: { kind: "STRING_TO_INTEGER", failure: "REJECT" }, authority_role: "DATA" },
      ],
      unknown_field_policy: "REJECT",
      has_body: false,
      accepted_content_types: [],
    },
    response_contract: {
      success_variant_ids: ["widgets"],
      variants: [{ id: "widgets", http_status: 200, condition: "request valid", schema: { type: "object", required: ["items"] } }],
      output_validation_required: true,
    },
    error_contract: {
      variants: [
        { code: "INVALID_REQUEST", http_status: 400, safe_message: "Request is invalid.", details_policy: "SAFE_SCHEMA_BOUNDED", details_schema: { type: "object" }, request_id_in_response: true },
        { code: "AUTHENTICATION_REQUIRED", http_status: 401, safe_message: "Authentication is required.", details_policy: "NONE", request_id_in_response: true },
        { code: "AUTHORIZATION_DENIED", http_status: 403, safe_message: "Access is denied.", details_policy: "NONE", request_id_in_response: true },
        { code: "NOT_FOUND", http_status: 404, safe_message: "Resource was not found.", details_policy: "NONE", request_id_in_response: true },
        { code: "CONFLICT", http_status: 409, safe_message: "Request conflicts with current state.", details_policy: "NONE", request_id_in_response: true },
        { code: "PAYLOAD_TOO_LARGE", http_status: 413, safe_message: "Payload is too large.", details_policy: "NONE", request_id_in_response: true },
        { code: "UNSUPPORTED_MEDIA", http_status: 415, safe_message: "Content type is unsupported.", details_policy: "NONE", request_id_in_response: true },
        { code: "INTERNAL_ERROR", http_status: 500, safe_message: "The request could not be completed.", details_policy: "NONE", request_id_in_response: true },
      ],
    },
    auth_contract: { authentication: "PUBLIC", authorization: "NONE", scope: "NONE", authorization_before_service_effect: true, client_identity_fields_non_authoritative: [] },
    service_contract: { operation_id: "widgets.list", input_ref: "ListWidgetsInput", output_ref: "ListWidgetsOutput", transport_types_allowed: false, responsibility: "Apply widget visibility policy and return a bounded collection result" },
    data_port_requirements: [{ id: "widgets.list", kind: "LIST", resource: "Widget", field_intent_refs: ["status", "sort", "page"], source_refs: ["specs/widgets-list"] }],
    atomicity_contract: { requirement: "NONE", logical_operation_refs: [] },
    side_effect_contract: { class: "READ_ONLY", caller_retryable: true, idempotency: "NOT_APPLICABLE" },
    observability_contract: { request_id_required: true, operation_name_required: true, duration_required: true, outcome_class_required: true, error_code_required_on_error: true, log_raw_headers: false, log_raw_body: false, log_field_allowlist: ["request_id", "operation_id", "outcome_class", "error_code"], redacted_field_refs: [] },
    compatibility_contract: { mode: "NEW" },
    acceptance: [{ id: "AC-1", condition: "A valid request returns a schema-valid widget page.", verification_method: "API integration test", evidence_expected: "declared success and error variants" }],
    evidence_required: [
      { kind: "REQUEST_SCHEMA_TEST", description: "Request schema boundary" },
      { kind: "RESPONSE_SCHEMA_TEST", description: "Response schema boundary" },
      { kind: "CONTRACT_INSPECTION", description: "Provider-neutral boundary inspection" },
    ],
  };
}

function bodyInput(): BackendApiEngineeringInput {
  const input = baseInput();
  input.task_ref = "TASK-API-002";
  input.spec_refs = ["specs/widgets-create"];
  input.operation = { operation_id: "createWidget", method: "POST", path_template: "/widgets", summary: "Create a widget", success_status: 201, collection: { potentially_unbounded: false, pagination: "NOT_APPLICABLE", allowed_filter_fields: [], allowed_sort_fields: [] } };
  input.request_contract = { fields: [{ id: "name", location: "BODY", required: true, schema: { type: "string" }, normalization: { kind: "TRIM_STRING", failure: "REJECT" }, authority_role: "DATA" }], unknown_field_policy: "REJECT", has_body: true, accepted_content_types: ["application/json"], max_body_bytes: 16384 };
  input.response_contract = { success_variant_ids: ["created"], variants: [{ id: "created", http_status: 201, condition: "widget created", schema: { type: "object", required: ["id", "name"] } }], output_validation_required: true };
  input.auth_contract = { authentication: "AUTHENTICATED", authorization: "POLICY_REQUIRED", scope: "NONE", authorization_before_service_effect: true, client_identity_fields_non_authoritative: [] };
  input.service_contract = { operation_id: "widgets.create", input_ref: "CreateWidgetInput", output_ref: "CreateWidgetOutput", transport_types_allowed: false, responsibility: "Create a widget under the approved application policy" };
  input.data_port_requirements = [{ id: "widgets.create", kind: "CREATE", resource: "Widget", field_intent_refs: ["name"], source_refs: ["specs/widgets-create"] }];
  input.side_effect_contract = { class: "NON_IDEMPOTENT_WRITE", caller_retryable: true, idempotency: "IDEMPOTENCY_REQUIRED" };
  return input;
}

export const FX_POS_001 = baseInput();
export const FX_POS_002 = bodyInput();
export const FX_POS_003 = (() => { const i = bodyInput(); i.task_ref = "TASK-API-003"; i.operation = { ...i.operation, operation_id: "updateOwnedWidget", method: "PATCH", path_template: "/widgets/{widget_id}", success_status: 200 }; i.request_contract.fields.push({ id: "widget_id", location: "PATH", required: true, schema: { type: "string" }, authority_role: "DATA" }, { id: "owner_id", location: "BODY", required: false, schema: { type: "string" }, authority_role: "NON_AUTHORITATIVE_IDENTITY_HINT" }); i.auth_contract = { authentication: "AUTHENTICATED", authorization: "RESOURCE_REQUIRED", scope: "OWNER", trusted_scope_source: "RESOURCE_LOOKUP", authorization_before_service_effect: true, client_identity_fields_non_authoritative: ["owner_id"] }; i.side_effect_contract = { class: "IDEMPOTENT_WRITE", caller_retryable: true, idempotency: "DECLARED_IDEMPOTENT" }; i.response_contract.variants[0].http_status = 200; return i; })();
export const FX_POS_004 = (() => { const i = bodyInput(); i.task_ref = "TASK-API-004"; i.operation.operation_id = "sendWidgetNotification"; i.service_contract.operation_id = "widgets.notify"; i.side_effect_contract = { class: "EXTERNAL_SIDE_EFFECT", caller_retryable: true, idempotency: "DEFERRED_TO_S13O", s13o_handoff_ref: "S13O:widget-notification" }; return i; })();
export const FX_POS_005 = (() => { const i = baseInput(); i.task_ref = "TASK-API-005"; i.compatibility_contract = { mode: "BACKWARD_COMPATIBLE_CHANGE", existing_contract_ref: "api/widgets/v1" }; return i; })();
export const FX_POS_006 = (() => { const i = bodyInput(); i.task_ref = "TASK-API-006-HTTP"; return i; })();
export const ALL_POSITIVE_INPUTS = [FX_POS_001, FX_POS_002, FX_POS_003, FX_POS_004, FX_POS_005, FX_POS_006];

function negative(id: string, mutate: (input: BackendApiEngineeringInput, decision: BackendApiEngineeringDecision) => void) {
  const input = baseInput();
  const decision = synthesizeBackendApiEngineeringDecision(input);
  mutate(input, decision);
  return { id, input, decision };
}

export const ALL_NEGATIVE_FIXTURES = [
  negative("FX-NEG-001", (i) => { i.request_contract.consumed_field_refs = ["missing"]; }),
  negative("FX-NEG-002", (i) => { i.request_contract.unknown_field_policy = "ALLOW_DECLARED_ADDITIONAL_FIELDS"; }),
  negative("FX-NEG-003", (_i, d) => { d.request_design.explicit_normalization_field_refs = []; }),
  negative("FX-NEG-004", (i) => { i.request_contract.has_body = true; i.request_contract.accepted_content_types = []; i.request_contract.max_body_bytes = 100; }),
  negative("FX-NEG-005", (i) => { i.request_contract.has_body = true; i.request_contract.accepted_content_types = ["application/json"]; delete i.request_contract.max_body_bytes; }),
  negative("FX-NEG-006", (i) => { i.side_effect_contract = { class: "NON_IDEMPOTENT_WRITE", caller_retryable: false, idempotency: "IDEMPOTENCY_REQUIRED" }; i.auth_contract.authentication = "AUTHENTICATED"; i.auth_contract.authorization = "NONE"; }),
  negative("FX-NEG-007", (i) => { i.auth_contract.authorization = "POLICY_REQUIRED"; i.auth_contract.authorization_before_service_effect = false; }),
  negative("FX-NEG-008", (i) => { i.request_contract.fields.push({ id: "tenant_id", location: "BODY", required: false, schema: { type: "string" }, authority_role: "DATA" }); i.auth_contract.client_identity_fields_non_authoritative = ["tenant_id"]; }),
  negative("FX-NEG-009", (i) => { i.auth_contract.authorization = "RESOURCE_REQUIRED"; i.auth_contract.scope = "RESOURCE"; delete i.auth_contract.trusted_scope_source; }),
  negative("FX-NEG-010", (i) => { (i.service_contract as unknown as Record<string, unknown>).transport_types_allowed = true; }),
  negative("FX-NEG-011", (i) => { (i.data_port_requirements[0] as unknown as Record<string, unknown>).table = "widgets"; }),
  negative("FX-NEG-012", (i) => { (i.atomicity_contract as unknown as Record<string, unknown>).transaction_isolation = "serializable"; }),
  negative("FX-NEG-013", (i) => { delete (i.response_contract.variants[0] as unknown as Record<string, unknown>).schema; }),
  negative("FX-NEG-014", (i) => { (i.response_contract as unknown as Record<string, unknown>).output_validation_required = false; }),
  negative("FX-NEG-015", (i) => { i.error_contract.variants[0].safe_message = "STACK_TRACE"; }),
  negative("FX-NEG-016", (i) => { i.error_contract.variants[0].safe_message = "TOKEN API_KEY PRIVATE_KEY"; }),
  negative("FX-NEG-017", (i) => { i.error_contract.variants[0].safe_message = "UNDECLARED_UPSTREAM_PAYLOAD"; }),
  negative("FX-NEG-018", (i) => { i.error_contract.variants[0].http_status = 200; }),
  negative("FX-NEG-019", (i) => { i.error_contract.variants.push({ code: "RATE_LIMITED", http_status: 429, safe_message: "Try later.", details_policy: "NONE", request_id_in_response: true }); }),
  negative("FX-NEG-020", (i) => { i.side_effect_contract = { class: "NON_IDEMPOTENT_WRITE", caller_retryable: true, idempotency: "NOT_APPLICABLE" }; }),
  negative("FX-NEG-021", (i) => { i.side_effect_contract = { class: "EXTERNAL_SIDE_EFFECT", caller_retryable: true, idempotency: "NOT_APPLICABLE" }; }),
  negative("FX-NEG-022", (i) => { (i.side_effect_contract as unknown as Record<string, unknown>).retry = { backoff: true }; }),
  negative("FX-NEG-023", (i) => { i.observability_contract.duration_required = false; }),
  negative("FX-NEG-024", (i) => { (i.observability_contract as unknown as Record<string, unknown>).log_raw_headers = true; }),
  negative("FX-NEG-025", (i) => { (i.observability_contract as unknown as Record<string, unknown>).vendor = "Datadog"; }),
  negative("FX-NEG-026", (i) => { i.compatibility_contract = { mode: "NEW", existing_contract_ref: "api/widgets/v1" }; }),
  negative("FX-NEG-027", (i) => { i.operation.collection.pagination = "NOT_APPLICABLE"; }),
  negative("FX-NEG-028", (_i, d) => { d.acceptance = []; d.evidence_required = []; }),
];

function extractInput(goal: string): BackendApiEngineeringInput {
  const index = goal.indexOf(BACKEND_API_ENGINEERING_INPUT_MARKER);
  if (index < 0) throw new Error("S13I input marker missing");
  const after = goal.slice(index + BACKEND_API_ENGINEERING_INPUT_MARKER.length).trim();
  const end = after.indexOf("\n\n");
  return JSON.parse(end < 0 ? after : after.slice(0, end)) as BackendApiEngineeringInput;
}

export class DeterministicBackendApiModelProvider implements ModelProvider {
  static readonly PROVIDER_LABEL = "deterministic/reference provider; input and materialized rule prose only; no network, credentials, fixture truth, ids, or arm flags";
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const input = extractInput(request.goal.statement);
    const profile = deriveBackendApiProfileFromRules([request.goal.statement]);
    const decision = synthesizeBackendApiEngineeringDecision(input, profile);
    return { status: "SUCCESS", decision: { type: "FINISH", rationale: "Synthesized from bounded input and semantic rule prose.", output: { summary: `Backend API decision ${decision.status}`, data: decision as unknown as Record<string, unknown>, evidence_refs: [...input.spec_refs] } } };
  }
}
