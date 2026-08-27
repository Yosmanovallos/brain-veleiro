# BACKEND_API_ENGINEERING_SKILL_S13I

## Identity

```yaml
id: intelligence.backend-api-engineering.s13i
version: 1.0.0
step: S13I
name: backend-api-engineering
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral: true
```

## Purpose

Produce a framework-neutral, provider-neutral backend HTTP API engineering decision for exactly one bounded API operation.

The Skill defines:

```text
transport/request contract
auth boundary
service/domain boundary
data-port requirements
side-effect/idempotency boundary
response/error schemas
endpoint-local observability
compatibility/collection rules
acceptance/evidence requirements
```

It does not create a web server or implement application code.

## Execution mode

```text
one-pass semantic guidance → SKILL_ONLY
```

No Backend API Engineering AgentDefinition is created.

The Skill runs through an existing compatible caller-supplied AgentDefinition and the unchanged S12 → S10 → S09 runtime.

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - CURRENT_API_TASK
    - APPROVED_SPEC
    - API_POLICY
    - AUTH_BOUNDARY_INPUT
    - ACCEPTANCE_EVIDENCE
  quality_contract_refs:
    - S13I_BACKEND_API_ENGINEERING_DEEP
```

## Permissions

```yaml
permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true
```

## Input

Canonical:

```text
BackendApiEngineeringInput
```

Responsibilities:

```text
task_ref
spec_refs
operation
request_contract
response_contract
error_contract
auth_contract
service_contract
data_port_requirements
side_effect_contract
observability_contract
compatibility_contract
acceptance
evidence_required
```

## Output

Canonical:

```text
BackendApiEngineeringDecision
```

Status:

```text
READY
BLOCKED
```

The output is a structured engineering contract, not source code.

## Core rules

### R1 — one bounded API operation

One decision covers one API operation/task.

### R2 — HTTP-semantic, framework-neutral

Method/path/schema/status semantics are allowed.

Framework/router/controller/server bindings are forbidden.

### R3 — thin transport

Transport extracts/validates/authenticates/authorizes/invokes/maps/observes.

Business logic does not live in transport.

### R4 — fail-closed request validation

Every consumed field is declared.

Unknown fields reject by default.

### R5 — no implicit coercion

Coercion/normalization requires an explicit field rule.

### R6 — body contracts are bounded

Body-bearing operations require declared content types and max body bytes.

### R7 — output validation mandatory

Every external response variant has a schema and must be validated/mapped before emission.

### R8 — stable safe errors

External errors have stable code/status/safe message and never expose internal causes.

### R9 — no response leakage

No stack, SQL, secret, credential, internal path or undeclared upstream payload.

### R10 — service boundary

Transport invokes an application-service contract, not persistence or provider implementation.

### R11 — no direct SQL/provider persistence in transport

Data access is expressed through abstract data-port requirements only.

### R12 — S13J owns persistence modeling

S13I declares logical data operations/atomicity need, never tables/indexes/migrations/transaction mechanism.

### R13 — explicit auth mode

Every operation is PUBLIC or AUTHENTICATED.

### R14 — authorization precedes protected effects/disclosure

Protected operations declare authorization mode and scope.

### R15 — client identity is not authority

Client user/tenant/owner fields cannot prove identity/authorization.

### R16 — tenancy is optional and explicit

No silent single-tenant or multi-tenant assumption.

### R17 — side effects classified

Every operation declares READ_ONLY / IDEMPOTENT_WRITE / NON_IDEMPOTENT_WRITE / EXTERNAL_SIDE_EFFECT.

### R18 — idempotency handoff for duplicate-prone retryable effects

S13I declares requirement/handoff; S13O implements reliability mechanics.

### R19 — endpoint-local observability required

Request id/operation/duration/outcome/error class requirements are explicit.

### R20 — safe logging

Raw bodies/headers are not logged by default; secrets/PII require allowlist/redaction policy.

### R21 — breaking change must be explicit

Existing external contract cannot silently break.

### R22 — unbounded list requires pagination

Or an explicit bounded-cardinality rationale.

### R23 — filter/sort allowlist

No undeclared filter/sort field.

### R24 — rate limit is a requirement reference, not an implementation

No rate-limit provider/system in S13I.

### R25 — OpenAPI is optional derivative

Structured S13I contract is authoritative.

### R26 — no framework/provider binding

No framework instance, auth provider, ORM, DB provider, logger vendor or live transport handle.

### R27 — no S14/S13J/S13L/S13O/S13P pull-forward

Only the API-local seams defined by the canonical contract are allowed.

### R28 — acceptance/evidence preserved

Do not weaken or invent acceptance/evidence.

### R29 — inputs immutable

Do not mutate bounded input objects.

### R30 — no implementation execution

The canonical Skill runtime creates no server, sends no request, writes no DB and performs no external side effect.

## Request policy

Request locations:

```text
PATH
QUERY
HEADER
BODY
```

Unknown fields:

```text
REJECT_BY_DEFAULT
```

Implicit coercion:

```text
FORBIDDEN_BY_DEFAULT
```

Body-bearing operation:

```text
accepted_content_types required
max_body_bytes required
```

## Response policy

Every response variant declares:

```text
id
http_status
condition
schema
```

Output validation is mandatory.

## Error policy

Canonical external error fields:

```text
code
http_status
safe_message
details_policy
request_id_in_response
```

Never expose internal cause.

Default semantic status mapping:

```text
validation          400
authentication      401
authorization       403
not found           404
conflict            409
payload too large   413
unsupported media   415
rate limit          429 only when policy exists
internal            500
```

## Auth policy

Authentication:

```text
PUBLIC
AUTHENTICATED
```

Authorization:

```text
NONE
POLICY_REQUIRED
RESOURCE_REQUIRED
```

Resource/tenant/owner authority comes from trusted auth context/resource lookup, not arbitrary client fields.

## Data-port policy

Allowed logical requirement kinds:

```text
READ
CREATE
UPDATE
DELETE
EXISTS
LIST
ATOMIC_GROUP_REQUIRED
```

No persistence implementation details.

## Side-effect policy

```text
READ_ONLY
IDEMPOTENT_WRITE
NON_IDEMPOTENT_WRITE
EXTERNAL_SIDE_EFFECT
```

Duplicate-prone retryable mutation/external effect requires an idempotency requirement/handoff.

## Observability policy

Require endpoint-local declarations for:

```text
request/correlation id
operation name/id
duration
outcome/status class
safe error code
side-effect outcome class when relevant
```

No observability vendor.

## Logging policy

Do not sanction logging of:

```text
authorization header
cookie/session secret
token/API key/credential
password/secret
private key
raw sensitive body
```

Payload logging requires explicit allowlist/redaction.

## Compatibility policy

```text
NEW
BACKWARD_COMPATIBLE_CHANGE
BREAKING_CHANGE_APPROVED
```

Unapproved breaking change blocks.

## Collection policy

Potentially unbounded list requires pagination.

Filter/sort fields require allowlist.

## OpenAPI/docs policy

OpenAPI is optional derivative.

Human-facing docs belong to S13Q.

## Failure policy

Semantic failure includes:

- missing/invalid request contract;
- auth bypass;
- identity/tenant trust from client fields;
- business logic in transport;
- direct persistence/SQL in transport;
- response/error leakage;
- missing response schema/output validation;
- unsafe logging;
- duplicate-prone side effect without idempotency requirement/handoff;
- unapproved breaking change;
- unbounded list without pagination/rationale;
- concrete framework/auth/DB/observability provider binding;
- implementation of S13J/S13L/S13O/S13P/S14 concerns.

Semantic failure returns to ChatGPT Authoring Gate.

Mechanical Part B defects may be repaired locally only if Part A semantics remain unchanged.

## Success criteria

S13I passes only when:

- Part A integrates verbatim;
- Skill remains SKILL_ONLY;
- no new AgentDefinition exists;
- no new runtime dependency exists;
- no Brain HTTP server is created;
- request validation is explicit/fail-closed;
- response schemas/output validation are explicit;
- transport remains thin;
- auth/resource boundary is explicit;
- client identity is not treated as authority;
- data access remains abstract;
- error/logging leakage invariants pass;
- side-effect/idempotency seam is correct;
- endpoint-local observability contract exists;
- compatibility/list semantics pass;
- positive/negative fixtures pass;
- Skill-vs-no-Skill passes with dimension-specific OI-A-safe scoring;
- real S12 → S10 → S09 runtime is proven;
- typecheck/tests/build/post-build pass;
- fresh independent verification passes;
- S13J remains NOT_STARTED.
