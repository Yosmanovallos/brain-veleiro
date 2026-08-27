export const BACKEND_API_ENGINEERING_SKILL_ID = "intelligence.backend-api-engineering.s13i";
export const BACKEND_API_ENGINEERING_QUALITY_CONTRACT_REF = "S13I_BACKEND_API_ENGINEERING_DEEP";
export const BACKEND_API_ENGINEERING_SKILL_ARTIFACT_PATH =
  "brain-bootstrap/skills/BACKEND_API_ENGINEERING_SKILL_S13I.md";
export const BACKEND_API_ENGINEERING_QUALITY_CONTRACT_ARTIFACT_PATH =
  "brain-bootstrap/quality-contracts/S13I_BACKEND_API_ENGINEERING_DEEP.yaml";
export const BACKEND_API_ENGINEERING_CONTRACT_ARTIFACT_PATH =
  "brain-bootstrap/specs/BACKEND_API_ENGINEERING_CONTRACT_S13I.md";
export const BACKEND_API_ENGINEERING_INPUT_MARKER = "BRAIN_S13I_BACKEND_API_ENGINEERING_INPUT:";
export const BACKEND_API_ENGINEERING_SKILL_MATERIALIZATION_MARKER =
  "BRAIN_S13I_BACKEND_API_ENGINEERING_SKILL_RULES:";

export const DEFAULT_ERROR_STATUS = {
  validation: 400,
  authentication: 401,
  authorization: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media: 415,
  rate_limit: 429,
  internal: 500,
} as const;

export const NEVER_LEAK_CLASSES = [
  "STACK_TRACE",
  "RAW_SQL",
  "SECRET",
  "API_KEY",
  "TOKEN",
  "COOKIE_SECRET",
  "PROVIDER_CREDENTIAL",
  "PRIVATE_KEY",
  "INTERNAL_FILE_PATH",
  "UNDECLARED_UPSTREAM_PAYLOAD",
] as const;

export const BACKEND_API_FORBIDDEN_KEY_PATTERN =
  /^(framework|router|controller|server|listen|express|fastify|nestjs|koa|hapi|auth_provider|orm|database_provider|sql|query_text|table|column|index|migration|postgres|transaction_isolation|lock_mode|connection|logger_client|tracer|metrics_client|exporter|dsn|api_key|vendor|retry|backoff|job_queue|idempotency_store|rate_limit_enforcer|openapi_source_of_truth|capability_registry)$/i;

export const BACKEND_API_FORBIDDEN_VALUE_PATTERN =
  /\b(express|fastify|nestjs|koa|hapi|prisma|typeorm|sequelize|postgres(?:ql)?|raw\s+sql|select\s+.+\s+from|insert\s+into|update\s+.+\s+set|create\s+table|migration|transaction\s+isolation|logger\s+vendor|datadog|new\s+relic|openapi\s+(?:is|as)\s+(?:the\s+)?source\s+of\s+truth|rate[- ]limit\s+(?:middleware|enforcer)|retry\s+loop|exponential\s+backoff|idempotency\s+store|capability\s+registry)\b/i;

export const SAFE_TRANSPORT_RESPONSIBILITIES = [
  "extract request fields",
  "validate and explicitly normalize request fields",
  "establish provider-neutral auth context",
  "invoke authorization gate before protected service effects",
  "invoke application service",
  "map validated response and safe errors",
  "record endpoint-local observability fields",
] as const;

export const EVIDENCE_KINDS = [
  "TYPECHECK",
  "BUILD",
  "REQUEST_SCHEMA_TEST",
  "RESPONSE_SCHEMA_TEST",
  "AUTHENTICATION_BOUNDARY_TEST",
  "AUTHORIZATION_BOUNDARY_TEST",
  "RESOURCE_SCOPE_TEST",
  "SERVICE_UNIT_TEST",
  "API_INTEGRATION_TEST",
  "NEGATIVE_VALIDATION_TEST",
  "ERROR_MAPPING_TEST",
  "SIDE_EFFECT_IDEMPOTENCY_TEST",
  "DATA_PORT_CONTRACT_TEST",
  "OBSERVABILITY_CONTRACT_TEST",
  "NO_SECRET_RESPONSE_TEST",
  "NO_SECRET_LOG_TEST",
  "BACKWARD_COMPATIBILITY_TEST",
  "PAGINATION_FILTER_SORT_TEST",
  "CONTRACT_INSPECTION",
  "OTHER_DETERMINISTIC",
] as const;
