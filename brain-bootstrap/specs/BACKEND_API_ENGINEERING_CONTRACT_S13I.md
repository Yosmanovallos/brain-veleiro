# BRAIN — Backend API Engineering Contract S13I

**Step:** S13I — backend-api-engineering  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**Quality depth:** DEEP  
**New AgentDefinition:** NO  
**Canonical Skill runtime side effects:** NONE  
**Transport semantics:** HTTP  
**Framework/provider/database binding:** FORBIDDEN  
**S13J/S13L/S13O/S13P/S14 implementation:** OUT OF SCOPE

---

## 1. Purpose

Define a framework-neutral HTTP API engineering contract for one bounded API operation.

S13I produces design/contract data that later builders can map into a concrete application stack.

It does not implement or execute that stack.

---

## 2. Canonical types

### Status

```ts
export type BackendApiEngineeringStatus =
  | "READY"
  | "BLOCKED";
```

### HTTP method

```ts
export type ApiHttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";
```

### Request location

```ts
export type ApiRequestLocation =
  | "PATH"
  | "QUERY"
  | "HEADER"
  | "BODY";
```

### Unknown fields

```ts
export type UnknownFieldPolicy =
  | "REJECT"
  | "ALLOW_DECLARED_ADDITIONAL_FIELDS";
```

### Auth

```ts
export type ApiAuthenticationMode =
  | "PUBLIC"
  | "AUTHENTICATED";

export type ApiAuthorizationMode =
  | "NONE"
  | "POLICY_REQUIRED"
  | "RESOURCE_REQUIRED";

export type ApiResourceScope =
  | "NONE"
  | "OWNER"
  | "TENANT"
  | "RESOURCE"
  | "CUSTOM";

export type TrustedScopeSource =
  | "AUTH_CONTEXT"
  | "RESOURCE_LOOKUP";
```

### Side effects

```ts
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
```

### Compatibility

```ts
export type ApiCompatibilityMode =
  | "NEW"
  | "BACKWARD_COMPATIBLE_CHANGE"
  | "BREAKING_CHANGE_APPROVED";
```

### Data ports

```ts
export type ApiDataOperationKind =
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXISTS"
  | "LIST"
  | "ATOMIC_GROUP_REQUIRED";
```

### Schema

S13I SHOULD reuse an existing repo `JsonSchemaLike` when mechanically compatible.

If direct reuse creates a cross-layer semantic problem, Part B may define a minimal local `ApiSchemaLike` contract equivalent to a JSON-schema-like structural declaration.

It MUST NOT add a schema library dependency.

---

## 3. Input types

### Request field

```ts
export interface ApiRequestFieldContract {
  id: string;
  location: ApiRequestLocation;
  required: boolean;

  schema: JsonSchemaLike;

  normalization?: {
    kind: string;
    failure: "REJECT";
  };

  authority_role:
    | "DATA"
    | "NON_AUTHORITATIVE_IDENTITY_HINT"
    | "NONE";
}
```

### Request contract

```ts
export interface ApiRequestContract {
  fields: ApiRequestFieldContract[];

  unknown_field_policy: UnknownFieldPolicy;

  has_body: boolean;
  accepted_content_types: string[];
  max_body_bytes?: number;
}
```

Rules:

- if `has_body == true`, content types MUST be non-empty and max_body_bytes MUST be a positive finite integer;
- if `has_body == false`, no body field may be required;
- unknown field behavior is explicit;
- no undeclared implicit coercion.

### Response variant

```ts
export interface ApiResponseVariant {
  id: string;
  http_status: number;
  condition: string;
  schema: JsonSchemaLike;
}
```

### Response contract

```ts
export interface ApiResponseContract {
  success_variant_ids: string[];
  variants: ApiResponseVariant[];

  output_validation_required: true;
}
```

Every variant id is unique.

Every declared success/error result must map to exactly one variant.

### Error contract

```ts
export type ApiErrorDetailsPolicy =
  | "NONE"
  | "SAFE_SCHEMA_BOUNDED";

export interface ApiErrorVariant {
  code: string;
  http_status: number;
  safe_message: string;
  details_policy: ApiErrorDetailsPolicy;
  details_schema?: JsonSchemaLike;
  request_id_in_response: boolean;
}

export interface ApiErrorContract {
  variants: ApiErrorVariant[];
}
```

Internal causes are not represented.

### Auth contract

```ts
export interface ApiAuthContract {
  authentication: ApiAuthenticationMode;
  authorization: ApiAuthorizationMode;

  scope: ApiResourceScope;
  trusted_scope_source?: TrustedScopeSource;

  authorization_before_service_effect: boolean;

  client_identity_fields_non_authoritative: string[];
}
```

Consistency:

- PUBLIC + NONE may be valid.
- AUTHENTICATED may use NONE only when no resource/action policy is required.
- RESOURCE_REQUIRED requires scope != NONE and trusted_scope_source.
- protected mutation/disclosure requires authorization_before_service_effect = true.

### Service contract

```ts
export interface ApiApplicationServiceContract {
  operation_id: string;

  input_ref: string;
  output_ref: string;

  transport_types_allowed: false;

  responsibility: string;
}
```

No framework request/response object.

### Data port requirement

```ts
export interface ApiDataPortRequirement {
  id: string;
  kind: ApiDataOperationKind;
  resource: string;
  field_intent_refs: string[];
  source_refs: string[];
}
```

No table/column/SQL/ORM/provider fields.

### Atomicity

```ts
export interface ApiAtomicityContract {
  requirement:
    | "NONE"
    | "ATOMIC_GROUP_REQUIRED";

  logical_operation_refs: string[];
}
```

No transaction mechanism.

### Side effect

```ts
export interface ApiSideEffectContract {
  class: ApiSideEffectClass;

  caller_retryable: boolean;

  idempotency: ApiIdempotencyRequirement;

  s13o_handoff_ref?: string;
}
```

### Observability

```ts
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
```

No vendor/exporter.

### Collection

```ts
export interface ApiCollectionContract {
  potentially_unbounded: boolean;

  pagination:
    | "NOT_APPLICABLE"
    | "REQUIRED"
    | "BOUNDED_CARDINALITY_RATIONALE";

  bounded_cardinality_rationale?: string;

  allowed_filter_fields: string[];
  allowed_sort_fields: string[];
}
```

### Compatibility

```ts
export interface ApiCompatibilityContract {
  mode: ApiCompatibilityMode;

  existing_contract_ref?: string;

  rate_limit_requirement_ref?: string;
}
```

### Operation

```ts
export interface ApiOperationContract {
  operation_id: string;
  method: ApiHttpMethod;
  path_template: string;

  summary: string;

  success_status: number;

  collection: ApiCollectionContract;
}
```

`path_template` is semantic HTTP contract data, not a framework route handle.

### Evidence

Reuse existing acceptance/evidence types where possible.

Otherwise preserve the supplied bounded structures without semantic duplication.

### Canonical input

```ts
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
```

If existing S13F acceptance/evidence types are imported, they are read-only.

---

## 4. Decision shapes

### Boundary map

```ts
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
```

### Request design

```ts
export interface ApiRequestDesign {
  field_refs: string[];
  unknown_field_policy: UnknownFieldPolicy;

  accepted_content_types: string[];
  max_body_bytes?: number;

  explicit_normalization_field_refs: string[];
}
```

### Auth design

```ts
export interface ApiAuthDesign {
  authentication: ApiAuthenticationMode;
  authorization: ApiAuthorizationMode;
  scope: ApiResourceScope;

  trusted_scope_source?: TrustedScopeSource;

  authorization_before_service_effect: boolean;

  non_authoritative_client_identity_fields: string[];
}
```

### Service/data design

```ts
export interface ApiServiceDesign {
  service_operation_id: string;
  transport_types_allowed: false;
}

export interface ApiDataPortDesign {
  requirement_refs: string[];
  atomicity_requirement: ApiAtomicityContract["requirement"];
}
```

### Side-effect design

```ts
export interface ApiSideEffectDesign {
  class: ApiSideEffectClass;
  idempotency: ApiIdempotencyRequirement;
  s13o_handoff_ref?: string;
}
```

### Response/error design

```ts
export interface ApiResponseDesign {
  variant_ids: string[];
  output_validation_required: true;
}

export interface ApiErrorDesign {
  error_codes: string[];
  internal_cause_exposed: false;
}
```

### Observability design

```ts
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
```

### Compatibility design

```ts
export interface ApiCompatibilityDesign {
  mode: ApiCompatibilityMode;

  pagination_required: boolean;

  allowed_filter_fields: string[];
  allowed_sort_fields: string[];

  rate_limit_requirement_ref?: string;
}
```

### Canonical decision

```ts
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
```

---

## 5. Status derivation

Hard safety/contract violations produce:

```text
BLOCKED
```

Otherwise:

```text
READY
```

Candidate `status` is never trusted.

The validator/gate recomputes status and blocker causes.

---

## 6. Request validation rules

### Declared fields

Every field consumed by the operation must exist in `request_contract.fields`.

Duplicate field ids within a location block.

### Unknown fields

Default policy:

```text
REJECT
```

Additional fields are accepted only under explicit `ALLOW_DECLARED_ADDITIONAL_FIELDS` semantics.

### Normalization/coercion

No implicit conversion.

A normalization entry must be explicit and must fail closed.

### Identity-bearing inputs

Fields such as:

```text
user_id
owner_id
tenant_id
account_id
role
permission
```

may be request data, but MUST be classified non-authoritative unless trusted auth/resource lookup supplies authority.

Part B must not rely solely on field-name regex for correctness; fixtures carry explicit authority metadata.

---

## 7. Body boundary

If has_body:

```text
accepted_content_types.length >= 1
max_body_bytes > 0
```

No default max-body size is invented by S13I.

---

## 8. Transport/service boundary

Transport responsibilities are limited to:

```text
extract
validate/normalize
auth context boundary
authorization gate invocation
service invocation
response/error mapping
endpoint-local observability
```

Business logic belongs outside transport.

No direct data-port/provider call from transport.

---

## 9. Data-port / S13J rules

Only logical operations appear.

Forbidden decision/input fields or semantic equivalents:

```text
sql
query_text
table
column
index
migration
postgres
orm
transaction_isolation
lock_mode
connection
```

`ATOMIC_GROUP_REQUIRED` is a logical requirement, not transaction implementation.

---

## 10. Auth rules

### Public

PUBLIC does not require a principal.

It still requires request/response/error/data-exposure correctness.

### Authenticated

AUTHENTICATED requires provider-neutral trusted auth context at implementation time.

S13I does not bind the provider.

### Authorization

Protected resource/action operations require POLICY_REQUIRED or RESOURCE_REQUIRED.

Authorization must precede protected side effect/disclosure.

### Scope

RESOURCE_REQUIRED requires explicit scope and trusted scope source.

Client fields do not establish authority.

---

## 11. Response rules

Every external variant has:

```text
id
http_status
condition
schema
```

`output_validation_required` must be true.

No response variant may self-certify schema compatibility without deterministic equality/contract checks.

---

## 12. Error rules

Error codes are stable machine identifiers.

External error output cannot include an internal cause.

Canonical never-leak classes:

```text
STACK_TRACE
RAW_SQL
SECRET
API_KEY
TOKEN
COOKIE_SECRET
PROVIDER_CREDENTIAL
PRIVATE_KEY
INTERNAL_FILE_PATH
UNDECLARED_UPSTREAM_PAYLOAD
```

Tests should model these explicitly rather than claim perfect arbitrary text scanning.

---

## 13. HTTP status mapping

Default category mapping:

```text
validation          400
authentication      401
authorization       403
not_found           404
conflict            409
payload_too_large   413
unsupported_media   415
rate_limit          429 only with policy ref
internal            500
```

Input may define compatible explicit variants.

A candidate cannot remap authorization denied to a success status.

---

## 14. Side-effect / idempotency rules

### Read-only

```text
idempotency = NOT_APPLICABLE
```

### Idempotent write

```text
idempotency = DECLARED_IDEMPOTENT
```

when caller/upstream contract proves repeat safety.

### Non-idempotent / external effect

If caller_retryable:

```text
IDEMPOTENCY_REQUIRED
or
DEFERRED_TO_S13O
```

Otherwise BLOCKED.

No retry/backoff/store implementation.

---

## 15. Observability rules

Endpoint-local declarations only.

No provider/vendor fields such as:

```text
logger_client
tracer
metrics_client
exporter
dsn
api_key
vendor
```

Raw headers/body flags remain false.

---

## 16. Compatibility rules

For an existing contract:

```text
NEW
```

is invalid.

A breaking change requires:

```text
BREAKING_CHANGE_APPROVED
```

No automatic versioning scheme is invented.

---

## 17. Collection rules

If potentially_unbounded:

- pagination REQUIRED; OR
- explicit bounded-cardinality rationale.

Filter/sort fields are allowlists.

No SQL expression may be used as a filter/sort field contract.

---

## 18. Rate-limit boundary

S13I may reference an upstream rate-limit requirement.

It does not implement the limiter.

`429` is valid only if rate-limit policy exists.

---

## 19. OpenAPI/docs boundary

The decision may be projected later to OpenAPI.

No OpenAPI object is the source of truth in S13I.

No docs generator in Part B.

---

## 20. Evidence categories

Allowed evidence categories:

```text
TYPECHECK
BUILD
REQUEST_SCHEMA_TEST
RESPONSE_SCHEMA_TEST
AUTHENTICATION_BOUNDARY_TEST
AUTHORIZATION_BOUNDARY_TEST
RESOURCE_SCOPE_TEST
SERVICE_UNIT_TEST
API_INTEGRATION_TEST
NEGATIVE_VALIDATION_TEST
ERROR_MAPPING_TEST
SIDE_EFFECT_IDEMPOTENCY_TEST
DATA_PORT_CONTRACT_TEST
OBSERVABILITY_CONTRACT_TEST
NO_SECRET_RESPONSE_TEST
NO_SECRET_LOG_TEST
BACKWARD_COMPATIBILITY_TEST
PAGINATION_FILTER_SORT_TEST
CONTRACT_INSPECTION
OTHER_DETERMINISTIC
```

S13I does not invent shell commands.

---

## 21. Built-in HTTP realism fixture

Part B tests MUST include one disposable built-in Node HTTP fixture.

Requirements:

```text
node:http or equivalent Node built-in only
127.0.0.1 / localhost loopback only
ephemeral port
no external network
no new dependency
start only inside test lifecycle
close before test completes
no persistent Brain server
```

The fixture proves:

- a valid request maps to a declared success variant;
- an invalid request maps to a declared error variant;
- declared body/content semantics are testable at a real HTTP boundary.

It does not prove framework integration.

---

## 22. Anti-self-certification

Validator/gate recomputes:

- request contract completeness;
- auth safety;
- transport/service separation;
- data-port/provider neutrality;
- response/error safety;
- side-effect/idempotency boundary;
- observability/log safety;
- compatibility/list safety;
- future-stage boundary;
- final status/blockers.

Candidate booleans/status do not count as proof.

Anchor example:

```text
candidate.status = READY
+
AUTHENTICATED mutation
+
authorization_before_service_effect = false
→ gate returns BLOCKED
```

---

## 23. Skill runtime

No dedicated S13I AgentDefinition.

Semantic run:

```text
S12 metadata-only discovery
→ lazy load S13I Skill
→ caller-supplied AgentDefinition
→ S10 compileAgentDefinition()
→ S09 runAgent()
→ parse candidate
→ deterministic validation/gate
```

No Core role/Skill-id branch.

---

## 24. Skill-vs-no-Skill guard against S13H OI-A

Comparison categories:

```text
SD-001..SD-010
REGRESSION_CROSS_CUTTING
```

Cross-cutting assertions MUST NOT qualify a dimension as improved.

For an SD dimension to qualify:

```text
dimension_specific_scored_assertions >= 3
additional_correct_dimension_specific_assertions >= 2
max_single_assertion_share_of_improvement <= 0.5
```

Overall PASS:

```text
hard invariants with Skill = 100%
unsafe auth recommendations = 0
secret/PII leak recommendations = 0
direct-persistence-in-transport recommendations = 0
framework/provider bindings = 0
future-stage pull-forward violations = 0

dimension-specific total delta >= +12
improved dimensions >= 5
no hard-invariant regression
```

The evaluator must expose raw per-dimension assertion IDs/counts.

---

## 25. Minimum T1–Tn semantic coverage

Part B MUST implement equivalent coverage for at least:

```text
T1   valid public read input validates
T2   input objects are not mutated
T3   one bounded operation/task enforced
T4   framework/live-server binding rejects
T5   every consumed request field must be declared
T6   unknown field under REJECT rejects
T7   declared additional fields policy can allow extras
T8   implicit coercion without explicit rule rejects
T9   explicit normalization rule can pass
T10  body-bearing operation missing content type blocks
T11  body-bearing operation missing max_body_bytes blocks
T12  no-body operation does not require body limit
T13  thin transport positive contract passes
T14  transport business logic blocks
T15  direct SQL/ORM/provider persistence in transport blocks
T16  service framework request/response type blocks
T17  abstract data-port READ/CREATE/etc. passes
T18  table/index/migration/SQL detail rejects
T19  ATOMIC_GROUP_REQUIRED may be declared without transaction implementation
T20  transaction mechanism/isolation detail rejects
T21  PUBLIC auth contract passes when appropriate
T22  AUTHENTICATED protected contract requires explicit auth boundary
T23  protected effect with authZ after side effect blocks
T24  client user/tenant/owner authority blocks
T25  RESOURCE_REQUIRED needs trusted scope source
T26  optional scope NONE works for non-scoped operation
T27  every response variant requires schema
T28  output_validation_required must be true
T29  stable safe error code/status/message positive
T30  raw stack exposure blocks
T31  SQL/internal path/credential/token response leak blocks
T32  undeclared upstream payload exposure blocks
T33  validation status default mapping includes 400
T34  authn/authz default mappings include 401/403
T35  not-found/conflict default mappings include 404/409
T36  payload/content errors map 413/415
T37  429 requires rate-limit requirement ref
T38  READ_ONLY idempotency NOT_APPLICABLE passes
T39  IDEMPOTENT_WRITE declaration passes
T40  retryable NON_IDEMPOTENT_WRITE without handoff blocks
T41  retryable EXTERNAL_SIDE_EFFECT without handoff blocks
T42  DEFERRED_TO_S13O passes without implementing retry mechanics
T43  retry/backoff/job/idempotency-store implementation rejects
T44  endpoint observability minimum fields required
T45  raw authorization header/cookie/token logging blocks
T46  raw body logging without allowlist/redaction blocks
T47  allowlisted/redacted logging contract passes
T48  observability vendor binding rejects
T49  NEW operation compatibility passes
T50  BACKWARD_COMPATIBLE_CHANGE passes when compatible
T51  breaking existing operation without approval blocks
T52  BREAKING_CHANGE_APPROVED can pass
T53  potentially unbounded list without pagination/rationale blocks
T54  pagination required list passes
T55  bounded-cardinality rationale can pass
T56  undeclared filter field blocks
T57  undeclared sort field blocks
T58  rate-limit enforcement implementation rejects
T59  OpenAPI authoritative-source inversion rejects
T60  acceptance/evidence preservation enforced
T61  S13I Skill requires no capabilities and side effects NONE
T62  no S13I AgentDefinition exists
T63  no Core role/Skill-id branch exists
T64  S12 metadata-only discovery + lazy load proven
T65  S10 compileAgentDefinition + S09 runAgent proven
T66  deterministic/reference provider labels itself honestly
T67  provider/model cannot import frozen truth
T68  no fixture-id/Skill-id/withSkill branch
T69  anti-self-certification READY-with-auth-bypass anchor blocks
T70  FX-POS-001 passes
T71  FX-POS-002 passes
T72  FX-POS-003 passes
T73  FX-POS-004 passes
T74  FX-POS-005 passes
T75  FX-POS-006 built-in HTTP realism fixture passes
T76  canonical negative fixture suite fails in required ways
T77  real HTTP fixture uses loopback/ephemeral/no external network
T78  real HTTP fixture leaves no persistent server/open handle
T79  cross-cutting assertions excluded from improved-dimension qualification
T80  each improved dimension has >=3 dimension-specific scored assertions
T81  each improved dimension improves by >=2 dimension-specific assertions
T82  no single assertion exceeds 50% of a dimension's improvement
T83  dimension-specific total delta >= +12
T84  at least 5 semantic dimensions improve
T85  all Skill-side hard invariants = 100%
T86  zero unsafe auth/leak/direct-persistence/framework/future-stage recommendations
T87  no hard-invariant regression
T88  no separate deliberately-bad baseline synthesizer
T89  no S13J artifact/source created
T90  no S13L/S13O/S13P/S14 implementation created
T91  no new runtime dependency/package manifest change
T92  full prior regression suite remains green
```

Mechanical grouping is allowed.

Numeric test count alone is not evidence.

---

## 26. Part B candidate module

Equivalent responsibilities:

```text
src/intelligence/backend-api-engineering/
  constants.ts
  types.ts
  classifyApiOperation.ts
  validateRequestContract.ts
  validateAuthBoundary.ts
  validateServiceBoundary.ts
  validateDataPortBoundary.ts
  validateResponseContract.ts
  validateErrorContract.ts
  validateSideEffectContract.ts
  validateObservabilityContract.ts
  validateCompatibilityContract.ts
  validateBackendApiEngineeringDecision.ts
  synthesizeBackendApiEngineeringDecision.ts
  planBackendApiEngineering.ts
  compareBackendApiEngineeringRuns.ts
  index.ts
```

Plus:

```text
src/intelligence/skills/definitions/backendApiEngineeringS13I.ts
src/intelligence/skills/index.ts
tests/backend-api-engineering/...
brain-bootstrap/reports/S13I-backend-api-engineering-verification.md
```

Exact filenames may follow repository conventions.

---

## 27. Forbidden Part B scope

Do not implement:

```text
Brain application HTTP server
web framework
new runtime schema-validation dependency
actual app endpoint
auth provider
tenant platform
authorization engine
secret manager
DB schema
SQL/migrations/indexes
ORM
retry/backoff/idempotency store
async job runtime
observability vendor
OpenAPI generator dependency
Capability Registry S14
S13J
S13L
S13O
S13P
S13Q
deployment
```

---

## 28. Independent verification

Before S13J:

1. builder closes S13I with deterministic QA;
2. builder-side read-only review checks Part A/source/eval;
3. fresh session not authored by builder performs read-only verification;
4. re-run typecheck/focused tests/full tests/build/post-build;
5. independently re-measure Skill-vs-no-Skill;
6. inspect OI-A-safe scoring;
7. verify built-in HTTP realism fixture;
8. verify no server/dependency/provider/stage pull-forward;
9. verify S13J NOT_STARTED.

---

## 29. PASS criteria

S13I closes PASS only when:

1. Part A integrated verbatim.
2. Part A separately auditable.
3. Skill remains SKILL_ONLY.
4. No new AgentDefinition.
5. No new runtime dependency.
6. No Brain HTTP server.
7. Framework/provider neutrality holds.
8. Request validation/body boundary passes.
9. Thin transport/service boundary passes.
10. Data-port/S13J boundary passes.
11. Auth/resource-scope boundary passes.
12. Response/output validation passes.
13. Error/no-leak contract passes.
14. Side-effect/idempotency seam passes.
15. Observability/safe logging passes.
16. Compatibility/pagination/filter/sort passes.
17. OpenAPI/docs remain derivative.
18. Acceptance/evidence preserved.
19. Anti-self-certification passes.
20. S12 → S10 → S09 real runtime passes.
21. Built-in Node HTTP realism fixture passes.
22. Canonical positives pass.
23. Canonical negatives fail correctly.
24. OI-A-safe Skill-vs-no-Skill threshold passes.
25. typecheck passes.
26. full tests pass.
27. clean build passes.
28. post-build tests pass.
29. builder-side review passes.
30. fresh independent verification passes.
31. S13J remains NOT_STARTED.
32. STOP before S13J.
