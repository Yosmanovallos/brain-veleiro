# BRAIN / brain-veleiro — S13J ChatGPT Part A canonical transfer

**Step:** S13J — `postgres-data-modeling`  
**Bootstrap objective:** `Schema, PK/FK, indexes, constraints, migrations, transactions, query checks.`  
**Upstream:** `S13I VERIFIED PASS`  
**Authoring mode:** ChatGPT Authoring Gate  
**Quality depth:** `DEEP`  
**Execution mode:** `SKILL_ONLY`  
**New AgentDefinition:** `NO`  
**Canonical Skill runtime side effects:** `NONE`  
**PostgreSQL driver/server/ORM required by Part B:** `NO`  
**S14 Capability Registry:** OUT OF SCOPE  
**S13K frontend-product-surface:** NOT_STARTED / OUT OF SCOPE  
**S13L guardrails-security:** OUT OF SCOPE except database-local constraints explicitly derived from approved input  
**S13O async-reliability:** OUT OF SCOPE except retry/idempotency handoff requirements  
**S13R deployment:** OUT OF SCOPE

> Integrate the three path-delimited artifacts below **verbatim**.  
> If Part B discovers a semantic contradiction, return to the ChatGPT Authoring Gate.  
> Mechanical implementation defects may be repaired locally only when these semantics remain unchanged.

---

# 0. Canonical resolutions

## Evidence tags

- **[VERIFIED]** repository/preflight fact.
- **[DECISION]** canonical S13J semantic decision.
- **[PROPOSAL]** mechanical implementation suggestion; may be renamed without semantic drift.
- **[DEFERRED]** intentionally owned by another step rather than unresolved.

## A. What S13J is

**[VERIFIED]** Brain currently has no PostgreSQL driver/server/ORM/migration framework/application persistence runtime. `better-sqlite3` exists only behind the replaceable S07 MemoryProvider and is not an application-data precedent.

**[DECISION]** S13J is a reusable **PostgreSQL application data-modeling Skill**. It converts approved logical data intent, entity/domain facts, access/query patterns, compatibility constraints and atomicity requirements into a structured PostgreSQL model plus migration/query-check plans.

It does **not** connect to PostgreSQL, run migrations, execute SQL, create credentials, configure a pool, or alter S07 memory.

Canonical result:

```text
PostgresDataModelingDecision
status: READY | BLOCKED
```

## B. Execution mode

**[DECISION]**

```text
one-pass semantic guidance → SKILL_ONLY
```

No S13J AgentDefinition. The canonical semantic run uses the existing generic:

```text
S12 metadata-only discovery
→ lazy load S13J Skill
→ caller-supplied compatible AgentDefinition
→ S10 compileAgentDefinition()
→ S09 runAgent()
→ parse candidate
→ deterministic S13J validator/gate
```

No Core role/Skill-id branch.

## C. Quality depth

**[DECISION]** `DEEP`.

Reason: schema/key/constraint mistakes can corrupt integrity; index/query mistakes can make a system unusable at scale; migration mistakes can lock tables or destroy data; transaction mistakes create races; these failures can be expensive or irreversible.

## D. Upstream S13I handoff

**[VERIFIED]** S13I exposes provider-neutral `ApiDataPortRequirement` and `ApiAtomicityContract` and explicitly defers concrete persistence modeling to S13J.

**[DECISION]** S13J does not mutate S13I objects and is not API-only. A caller may deterministically project S13I data-port/atomicity intent into S13J-local `PostgresDataAccessRequirement` / `PostgresAtomicityIntent` snapshots.

No direct reverse dependency from S13I to S13J is introduced.

## E. PostgreSQL version and feature assumptions

**[DECISION]** S13J MUST NOT silently assume a PostgreSQL major version, extension, schema/search_path, or RLS policy.

Input carries:

```text
target_postgres.major_version?: number
schema_name
extensions[]
```

Base modeling may use stable core concepts (tables, PK/FK, NOT NULL, UNIQUE, CHECK, B-tree indexes, `date`, `timestamp`, `timestamptz`, `numeric`, `jsonb`) without claiming a tested runtime version.

Any decision that depends on a version-specific feature MUST include an explicit `minimum_major_version`; if target version is absent/incompatible, result is BLOCKED.

No extension is assumed merely to generate IDs.

## F. Identifier/naming policy

**[DECISION]** Default model identifiers are:

```text
lower_snake_case
unquoted
schema-qualified in derived DDL
UTF-8 byte length <= PostgreSQL identifier limit (63 bytes)
```

Quoted/mixed-case identifiers are rejected unless explicit legacy compatibility input requires them.

Names should be semantic, singular/plural convention consistent within one model, and deterministic from intent. Part B must not silently rename an externally frozen legacy identifier.

## G. Primary-key strategy

**[DECISION]** Every persisted table requires a PK.

Allowed strategies:

```text
SURROGATE_BIGINT
SURROGATE_UUID
NATURAL
COMPOSITE
```

Selection rules:

1. `NATURAL` only when the candidate key is explicitly domain-unique, stable and immutable.
2. `SURROGATE_UUID` when IDs must be generated safely across independent writers/offline boundaries or before DB insertion.
3. `SURROGATE_BIGINT` is preferred for centralized local OLTP when no distributed-ID requirement exists and no stable natural key is appropriate.
4. `COMPOSITE` is appropriate for true association/identity tuples when width/lifecycle/access patterns justify it; do not create wide composite PKs by default.
5. Externally visible identifiers and internal PKs may differ when approved input requires a stable public ID.

If the facts required to distinguish materially different PK strategies are absent, the decision must expose a blocker rather than invent a distributed/local architecture.

## H. Nullability, uniqueness and checks

**[DECISION]**

- Domain-required-at-insert field → `NOT NULL`.
- Truly optional/lifecycle-deferred field → nullable.
- Unknown is not modeled as empty-string/zero/sentinel solely to avoid NULL.
- Domain uniqueness that must survive concurrency → DB UNIQUE/unique index, not application-only pre-check.
- Row-local deterministic invariants → CHECK where safely expressible.
- Cross-row/relational invariants use PK/FK/UNIQUE/exclusion/transaction/locking as appropriate; application-only validation is insufficient when a race can violate the invariant.

## I. Foreign keys and referential actions

**[DECISION]** Every declared relationship requiring referential integrity receives an FK unless approved input explicitly models an external/non-relational reference.

Default lifecycle-safe action:

```text
ON DELETE NO ACTION / RESTRICT semantics
ON UPDATE NO ACTION
```

`CASCADE` is allowed only when the child cannot meaningfully outlive the parent and deletion semantics are explicitly approved.

`SET NULL` requires nullable FK and an explicit orphan-valid lifecycle.

Mutable natural PK + `ON UPDATE CASCADE` is not invented as a convenience; it requires explicit legacy/domain justification.

## J. Tenant / owner / resource scope

**[DECISION]** Multi-tenancy is optional, never assumed.

If approved upstream input requires tenant/owner scope, S13J may model database-local integrity such as:

- required scope column;
- scope-aware UNIQUE keys;
- scope-aware FK shape to prevent cross-tenant references;
- supporting indexes for scoped access paths.

S13J does not invent tenant semantics or auth policy.

RLS modes:

```text
NOT_REQUESTED
REQUIRED_BY_UPSTREAM
DEFERRED_TO_S13L
```

S13J may model `rls_required: true` only when upstream requires it; policy expressions/identity mapping remain S13L-owned unless supplied as approved immutable input.

## K. Temporal/audit/soft-delete policy

**[DECISION]** Audit columns are requirement-driven, not universal magic fields.

- `timestamptz` for real instants.
- `date` for calendar dates.
- `timestamp without time zone` only for deliberate wall-clock/local scheduling semantics with timezone context modeled separately when required.
- `created_at` / `updated_at` only when audit/lifecycle requirements justify them.
- S13J MUST identify who maintains `updated_at`; it must not silently invent a trigger.
- Soft delete is not default. If required, query/access patterns and uniqueness semantics must explicitly account for deleted rows.

## L. Money, numeric, status, JSONB, arrays, enums

**[DECISION]**

### Money / decimal

Never use floating-point for exact money.

Use either:

```text
integer minor units + explicit currency
```

or:

```text
numeric(precision, scale) + explicit currency/measurement semantics
```

based on approved domain requirements.

### Status

Prefer text + CHECK or lookup table for sets expected to evolve. PostgreSQL native enum is allowed only for an explicitly closed/stable set whose migration trade-off is accepted.

### JSONB

Use for genuinely flexible/opaque/extensible documents. Do not hide core relational fields in JSONB when they require FK, uniqueness, sorting/filtering, joining, or frequent independent updates.

### Arrays

Use only for bounded atomic collections without independent identity/FK/query semantics. Otherwise model a child/association table.

## M. Index selection

**[DECISION]** Indexes are derived from explicit access/query patterns, not created “just in case”.

Rules:

1. Do not duplicate implicit PK/UNIQUE indexes.
2. Evaluate FK child-side indexing from actual join/delete/update/access patterns; PostgreSQL does not automatically create the child FK index.
3. For composite B-tree indexes, common equality prefix comes before range/order needs when it matches the access pattern; column order must be justified by concrete queries.
4. Partial index requires a stable predicate matched by relevant queries.
5. Expression index requires the query expression to match the modeled expression.
6. `INCLUDE`/covering design requires a read-path justification, not cargo-culting.
7. A unique index is not “redundant” merely because a non-unique prefix index exists; semantics/predicate/order/uniqueness must match before redundancy is claimed.
8. Exact duplicates or safely subsumed indexes with identical relevant semantics are rejected.
9. A critical/high-cardinality access path with no viable supporting index becomes BLOCKED or explicitly `RUNTIME_EVIDENCE_REQUIRED` only when a sequential scan is intentionally acceptable and justified.

## N. Query/access-pattern checks

**[DECISION]** S13J models query checks structurally; Part B does not fake a live PostgreSQL plan.

Each important access pattern declares:

```text
operation_ref
tables/relations
join keys
predicates
order_by
pagination/result bound
cardinality class
criticality
```

Checks include:

- no unbounded collection query;
- no accidental N+1 query shape where batching/joining is possible;
- stable order for pagination;
- keyset/cursor preference for large/hot collections when offset cost/instability is material;
- index coverage/justification for critical paths;
- query/filter/order columns exist and are type-compatible;
- no query depends on an invented tenant/security predicate.

Query-check status:

```text
STATIC_PASS
RUNTIME_EVIDENCE_REQUIRED
BLOCKED
```

`EXPLAIN` / `EXPLAIN ANALYZE` are future evidence categories. Part B MUST NOT claim an actual PostgreSQL plan was observed without a real capability/runtime.

## O. Transactions, isolation and locking

**[DECISION]** S13J owns the **transaction design** for DB integrity, but not retry/backoff mechanics.

- S13I `ATOMIC_GROUP_REQUIRED` must map to one S13J transaction boundary over the referenced logical operations.
- Prefer DB constraints over higher isolation when the constraint directly enforces the invariant.
- `READ_COMMITTED` is the ordinary baseline when no stronger anomaly protection is required.
- `REPEATABLE_READ` requires a consistent-snapshot need.
- `SERIALIZABLE` requires an explicit anomaly/invariant justification and an S13O retry handoff because serialization failures are expected behavior.
- Row locking is used only for a justified check-then-write/resource-serialization need not better solved by a constraint.
- Multi-row/resource locking requires deterministic lock-order guidance to reduce deadlock risk.
- Advisory locks are forbidden by default unless approved input demonstrates a coordination need not expressible with normal relational constraints/locks.

S13J does not implement transaction execution, pool handling, retries or backoff.

## P. Migration contract

**[DECISION]** S13J models migrations as structured non-executable plans.

Canonical phases:

```text
EXPAND
BACKFILL
VALIDATE
CUTOVER
CONTRACT
```

Rules:

1. Existing externally used schemas default to backward-compatible expand/contract evolution.
2. Destructive `DROP`, data-loss transformation, incompatible type narrowing, irreversible merge/split, or destructive rewrite requires explicit `destructive_change_approved` and recovery/backup evidence requirements.
3. Large-table lock/rewrite risk must be classified; high-risk direct rewrites without a safe rollout plan BLOCK.
4. Adding required data to populated tables must include expansion/backfill/validation/cutover rather than pretending historical rows already satisfy the invariant.
5. Large-table FK/CHECK validation may use staged validation semantics when appropriate; Part B models the pattern, not live execution.
6. Concurrent index creation is modeled as `transaction_mode: FORBIDDEN` because it cannot run inside a regular transaction block.
7. Migration “rollback” is not required to be blind reverse-DDL. A safe roll-forward/recovery plan is acceptable and often preferred.
8. Data backfills are bounded/chunkable when scale makes a single transaction unsafe; S13O/S13R later own retry/execution/deployment mechanics.
9. Rename/drop of externally consumed fields requires compatibility/cutover planning or explicit breaking/destructive approval.

## Q. Constraint ownership and race prevention

**[DECISION]** Integrity belongs at the lowest reliable layer that can enforce it atomically.

Examples:

- uniqueness → UNIQUE;
- referential integrity → FK;
- required data → NOT NULL;
- row-local range/state invariant → CHECK;
- overlapping-range invariant → exclusion constraint only when explicitly justified and version/extension requirements are satisfied;
- check-then-insert/update race → DB constraint or transaction/locking, never service pre-check alone.

Triggers are not default. A trigger requires explicit justification that declarative constraints/generated columns/service ownership cannot satisfy safely.

## R. Schema, search_path and extensions

**[DECISION]** `schema_name` is explicit input. Derived DDL schema-qualifies objects and MUST NOT depend on ambient `search_path` for correctness/security.

Extensions are explicit approved input. S13J must not add `pgcrypto`, `uuid-ossp`, `citext`, PostGIS or another extension merely because it is convenient.

## S. PII / secrets and S13L seam

**[DECISION]** S13J may carry per-field sensitivity classification and approved storage-security references, but does not design secret management/auth policy.

Sensitive classes:

```text
NONE
PII
SECRET
CREDENTIAL_MATERIAL
```

Rules:

- raw credentials/tokens/password-equivalent material cannot be modeled for ordinary storage without an explicit S13L-approved storage-security reference;
- do not index raw secret material as a convenience;
- do not emit secret values in fixtures, DDL comments, docs or logs;
- PII retention/encryption/access policy comes from approved input/S13L, not S13J invention.

## T. Structured model is authoritative; DDL is derived

**[DECISION]** The authoritative S13J output is structured typed data:

```text
schema_model
constraint_plan
index_plan
transaction_plan
migration_plan
query_check_plan
boundary_handoffs
```

PostgreSQL DDL text is **derived, non-authoritative output** materialized deterministically from a validated decision.

If a DDL preview conflicts with the structured model, the structured model wins and the renderer/test fails.

The model/provider must not self-certify by emitting a “correct” DDL string.

## U. Anti-self-certification

**[DECISION]** The deterministic gate recomputes hard invariants from bounded input + candidate. It does not trust candidate `status`, `blockers`, `query_safe`, `migration_safe`, `indexes_complete`, or similar claims.

A malformed candidate is preserved for diagnostic visibility but final terminal status/blockers are recomputed.

Anchor:

```text
candidate.status = READY
+ missing required FK or unsafe destructive migration
→ final gate = BLOCKED
```

## V. Part B realism without PostgreSQL runtime

**[DECISION]** Part B must be honest about what it can prove without a PostgreSQL server/driver.

It MAY:

- validate structured models deterministically;
- generate deterministic DDL previews;
- validate access-pattern/index relationships;
- model migration/transaction/query-check plans;
- run real S12→S10→S09 agent runtime;
- use frozen positive/negative modeling fixtures.

It MUST NOT claim:

- actual PostgreSQL DDL execution;
- actual migration lock behavior;
- actual EXPLAIN plan;
- actual index usage;
- actual transaction anomaly result.

Those become explicit future evidence requirements for S14 PostgreSQL inspect / later execution.

## W. Skill-vs-no-Skill and OI-A guard

Both arms use the same input, caller AgentDefinition, ModelProvider, CapabilityProvider, S09/S10 runtime, parser, validator/evaluator and frozen truth.

Only semantic difference:

```text
WITH_SKILL → S13J Skill content present
NO_SKILL   → same generic data-modeling task without S13J Skill content
```

Forbidden:

```text
withSkill branch
fixture-id branch
S13J Skill-id branch
separate deliberately-bad baseline planner
frozen truth visible to provider/model
post-hoc denominator
```

Cross-cutting assertions such as overall status/object existence/validator-pass MUST NOT qualify a semantic dimension as improved.

For a semantic dimension to qualify:

```text
>= 3 dimension-specific scored assertion IDs
>= 2 dimension-specific improved instances
max(per_assertion_improved_instance_count) / total_dimension_improvement <= 0.5
```

Raw per-assertion contribution counts MUST be exposed.

## X. Semantic dimensions and threshold

Canonical dimensions:

```text
SD-001 schema_identity_and_naming
SD-002 keys_relationships_and_constraints
SD-003 type_domain_and_sensitive_data
SD-004 index_and_access_path_design
SD-005 query_bounds_and_plan_evidence
SD-006 transaction_concurrency_and_race_safety
SD-007 migration_compatibility_and_data_safety
SD-008 tenant_security_and_schema_boundary
SD-009 acceptance_evidence_and_traceability
SD-010 provider_runtime_and_future_stage_boundary
```

Minimum evaluable positives: `6`.

PASS requires:

```text
with-Skill hard invariants = 100%
missing PK/FK/required-constraint recommendations = 0
unsafe destructive migration recommendations = 0
unbounded/N+1 critical query recommendations = 0
provider/credential/live-runtime bindings = 0
future-stage pull-forward violations = 0

dimension-specific correct assertion delta >= +16
improved semantic dimensions >= 6
no hard-invariant regression
```

and each improved dimension satisfies the OI-A concentration rule above.

## Y. Canonical positives

### FX-POS-001 — parent/child OLTP model

- centralized OLTP;
- surrogate bigint PKs;
- parent/child FK with restrictive lifecycle;
- explicit uniqueness/checks;
- critical parent→child access path with justified child FK index;
- bounded list query.

Expected READY.

### FX-POS-002 — explicit tenant-scoped model

- upstream requires tenant scope;
- tenant column participates in scope-aware uniqueness/FK integrity;
- no invented RLS policy;
- tenant access path indexed;
- client identity semantics remain outside S13J.

Expected READY.

### FX-POS-003 — money/time/status domain model

- exact amount representation + currency;
- `timestamptz` for instant;
- evolving status represented by text+CHECK/lookup rather than rigid enum;
- row-local constraints explicit.

Expected READY.

### FX-POS-004 — high-cardinality ordered collection

- explicit query predicates/order;
- keyset/cursor bound;
- composite index order derived from query;
- no redundant indexes;
- query check marked runtime-evidence-required only for actual plan proof.

Expected READY.

### FX-POS-005 — atomic inventory/transfer-style mutation

- S13I atomic group projected read-only;
- transaction boundary explicit;
- DB uniqueness/check/FK preferred where possible;
- justified row lock/lock order only where needed;
- SERIALIZABLE only if anomaly requirement demands it and S13O retry handoff exists.

Expected READY.

### FX-POS-006 — expand/contract evolution

- populated table;
- new required field introduced via expand/backfill/validate/cutover;
- lock/rewrite risk classified;
- destructive contract step delayed/approved as required;
- no live migration runner.

Expected READY.

## Z. Canonical negatives

At minimum:

1. persisted table without PK → BLOCKED.
2. required relationship missing FK → BLOCKED.
3. unjustified `ON DELETE CASCADE` → BLOCKED.
4. `SET NULL` on non-nullable FK → BLOCKED.
5. domain-required field modeled nullable without lifecycle rationale → BLOCKED.
6. uniqueness enforced only by application pre-check → BLOCKED.
7. exact money modeled as float/double → BLOCKED.
8. real instant modeled as timezone-naive timestamp without explicit local-time semantics → BLOCKED.
9. evolving status forced into native enum without closed/stable-set approval → BLOCKED.
10. core relational/queryable fields hidden in JSONB → BLOCKED.
11. array used for independently queryable/FK child entities → BLOCKED.
12. index with no source access/query justification → BLOCKED/validator reject.
13. critical high-cardinality access path lacks supporting index/rationale → BLOCKED.
14. redundant duplicate/subsumed index → BLOCKED.
15. composite index order incompatible with declared critical query → BLOCKED.
16. unbounded collection query → BLOCKED.
17. N+1 query shape declared as normal plan → BLOCKED.
18. unstable/huge OFFSET pagination without bounded rationale → BLOCKED.
19. query references absent field/relation → BLOCKED.
20. `ATOMIC_GROUP_REQUIRED` not mapped to one transaction → BLOCKED.
21. check-then-write race protected only in application code → BLOCKED.
22. SERIALIZABLE design lacks explicit anomaly reason or S13O retry handoff → BLOCKED.
23. multi-resource row locks lack deterministic ordering → BLOCKED.
24. advisory lock invented without explicit requirement → BLOCKED.
25. destructive migration without approval/recovery evidence → BLOCKED.
26. adding required field to populated large table with no backfill/lock plan → BLOCKED.
27. breaking rename/drop with no expand/contract or explicit breaking approval → BLOCKED.
28. concurrent-index step modeled inside transaction → BLOCKED.
29. large-table rewrite/lock risk ignored → BLOCKED.
30. tenant/RLS assumption invented from nothing → BLOCKED.
31. raw credential/token storage with no S13L-approved storage-security ref → BLOCKED.
32. ambient `search_path` relied upon for correctness → BLOCKED.
33. undeclared PostgreSQL extension assumed → BLOCKED.
34. live connection/credential/pool/migration runner embedded → validator reject.
35. ORM/provider binding embedded → validator reject.
36. DDL string contradicts authoritative structured model → renderer/gate reject.
37. candidate self-reports READY despite missing invariant → gate BLOCKED.
38. acceptance/evidence requirements dropped or invented → validator reject.
39. actual EXPLAIN/index-use/migration-runtime evidence claimed without live capability → validator reject.
40. S13K/S13L/S13O/S13R/S14 implementation pulled forward → validator reject.

## AA. Evidence categories

Canonical future evidence categories:

```text
TYPECHECK
BUILD
SCHEMA_CONTRACT_INSPECTION
DDL_RENDER_SNAPSHOT
PRIMARY_KEY_CHECK
FOREIGN_KEY_CHECK
CONSTRAINT_CHECK
INDEX_JUSTIFICATION_CHECK
INDEX_REDUNDANCY_CHECK
QUERY_BOUND_CHECK
QUERY_ACCESS_PATH_CHECK
N_PLUS_ONE_CHECK
POSTGRES_EXPLAIN
POSTGRES_EXPLAIN_ANALYZE_NON_PROD
TRANSACTION_BOUNDARY_CHECK
CONCURRENCY_RACE_TEST
DEADLOCK_ORDER_CHECK
MIGRATION_COMPATIBILITY_CHECK
MIGRATION_LOCK_RISK_REHEARSAL
BACKFILL_REHEARSAL
DESTRUCTIVE_CHANGE_APPROVAL_CHECK
TENANT_SCOPE_INTEGRITY_CHECK
SENSITIVE_DATA_STORAGE_CHECK
CONTRACT_INSPECTION
OTHER_DETERMINISTIC
```

S13J Part B may satisfy structural categories; live PostgreSQL categories remain future requirements and cannot be fabricated.

## AB. Allowed Part B scope

Equivalent bounded module:

```text
src/intelligence/postgres-data-modeling/
  constants.ts
  types.ts
  projectApiDataIntent.ts
  validateModelingInput.ts
  decidePrimaryKeys.ts
  validateRelationshipsAndConstraints.ts
  validateDomainTypes.ts
  deriveIndexPlan.ts
  validateIndexPlan.ts
  buildQueryCheckPlan.ts
  buildTransactionPlan.ts
  buildMigrationPlan.ts
  validatePostgresDataModelingDecision.ts
  renderPostgresDdlPreview.ts
  synthesizePostgresDataModelingDecision.ts
  planPostgresDataModeling.ts
  comparePostgresDataModelingRuns.ts
  index.ts

src/intelligence/skills/definitions/postgresDataModelingS13J.ts
src/intelligence/skills/index.ts
tests/postgres-data-modeling/...
brain-bootstrap/reports/S13J-postgres-data-modeling-verification.md
```

Exact filenames may follow repository conventions.

## AC. Forbidden Part B scope

Do NOT add/implement:

```text
pg/postgres driver
ORM
migration framework/runner
PostgreSQL server/container requirement
connection string/pool
credentials/secrets
live SQL execution
Brain application database
S07 MemoryProvider rewrite
Capability Registry S14
PostgreSQL capability provider
S13K frontend
S13L auth/security system
S13O retry/job system
S13P observability provider
S13R deployment
```

## AD. Unresolved gaps

**[DECISION]** No semantic blocker remains for Part A.

Deliberately deferred runtime facts:

- actual target PostgreSQL major version when a concrete app does not provide one;
- actual extension availability;
- actual table cardinalities/selectivity;
- actual `EXPLAIN`/`EXPLAIN ANALYZE` plans;
- actual migration lock timings;
- actual deployment/backfill throughput;
- concrete tenant/RLS/security policy;
- concrete retry/backoff execution.

These must surface as bounded input or runtime evidence rather than being invented.

---

# ARTIFACT 1

**Target path**

```text
brain-bootstrap/skills/POSTGRES_DATA_MODELING_SKILL_S13J.md
```

## Verbatim content

```markdown
# POSTGRES_DATA_MODELING_SKILL_S13J

## Identity

```yaml
id: intelligence.postgres-data-modeling.s13j
version: 1.0.0
step: S13J
name: postgres-data-modeling
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral_runtime: true
postgres_semantic_target: true
```

## Purpose

Turn approved logical data intent into a safe PostgreSQL schema/modeling decision covering:

```text
schema/tables/columns
PK/FK
nullability/uniqueness/checks
PostgreSQL domain types
indexes
query/access checks
transactions/locking
migrations/backfills
runtime-evidence requirements
```

without executing PostgreSQL.

## Execution mode

```text
one-pass semantic guidance → SKILL_ONLY
```

No S13J AgentDefinition is created.

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - APPROVED_DATA_INTENT
    - APPROVED_SPEC
    - ACCESS_PATTERNS
    - COMPATIBILITY_CONSTRAINTS
    - ATOMICITY_INTENT
    - ACCEPTANCE_EVIDENCE
  quality_contract_refs:
    - S13J_POSTGRES_DATA_MODELING_DEEP
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
PostgresDataModelingInput
```

The input contains immutable entity/field/relationship intent, data-access/query patterns, atomicity intent, compatibility/migration constraints, PostgreSQL target facts when known, scope/security references, acceptance and evidence requirements.

## Output

Canonical:

```text
PostgresDataModelingDecision
status: READY | BLOCKED
```

The structured decision is authoritative. DDL text is deterministic derived preview only.

## Core rules

### R1 — one bounded modeling task
One decision represents one bounded persistence modeling task/spec slice.

### R2 — SKILL_ONLY
No dedicated S13J AgentDefinition or Core branch.

### R3 — no live PostgreSQL side effect
No connection, migration execution, SQL execution, credential, pool or server lifecycle in canonical runtime.

### R4 — explicit schema/version facts
Do not silently assume schema/search_path/extension/version-specific features.

### R5 — safe identifiers
Default lower_snake_case, unquoted, schema-qualified derived DDL, <=63 UTF-8 bytes unless approved legacy compatibility requires otherwise.

### R6 — every persisted table has PK
No heap-like application table without identity.

### R7 — natural keys require stable immutable domain proof
Do not promote mutable business labels to PK.

### R8 — UUID vs bigint follows generation topology
Distributed/preallocated identity may justify UUID; centralized OLTP may justify bigint. Do not invent topology.

### R9 — relationship integrity is explicit
Required relational references use FK unless approved input explicitly models an external reference.

### R10 — destructive referential actions require lifecycle proof
CASCADE/SET NULL are not defaults.

### R11 — nullability follows domain lifecycle
Do not replace unknown/optional semantics with sentinel values.

### R12 — concurrency-critical uniqueness belongs in DB
Application pre-check alone is insufficient.

### R13 — row-local invariant uses CHECK when safe
Do not duplicate the same invariant only in service code.

### R14 — multi-tenancy is optional
Tenant/owner scope is modeled only from approved input.

### R15 — RLS is never invented
Only carry an upstream RLS requirement/handoff.

### R16 — real instants use timestamptz
Timezone-naive timestamps require deliberate wall-clock semantics.

### R17 — exact money is not floating point
Use minor units or numeric with explicit domain semantics.

### R18 — evolving status avoids rigid enum by default
Native enum requires an explicitly closed/stable set.

### R19 — JSONB is not a substitute for relational integrity
Core queryable/joinable/unique fields stay relational.

### R20 — arrays are only for bounded atomic lists
Independent/queryable/FK elements become child/association rows.

### R21 — indexes come from access patterns
No “index every column” or “index just in case”.

### R22 — do not duplicate PK/UNIQUE indexes
Redundancy requires semantic equivalence, not name similarity.

### R23 — critical high-cardinality access path needs support
Provide justified index or explicit sequential-scan/runtime-evidence rationale.

### R24 — composite index order follows query shape
Common equality prefix/range/order semantics must match declared queries.

### R25 — partial/expression/include indexes need exact justification
No cargo-cult advanced indexes.

### R26 — queries are bounded
No unbounded collection query; pagination/order/result bound is explicit.

### R27 — avoid N+1 plans
Batch/join access is required when per-row repeated lookups are avoidable.

### R28 — actual query plans are evidence, not fiction
Without PostgreSQL capability, mark EXPLAIN evidence required rather than claiming it ran.

### R29 — atomic groups become transaction boundaries
Preserve upstream atomicity intent without mutation.

### R30 — prefer constraints over stronger isolation
Use isolation/locking only for anomalies constraints cannot directly prevent.

### R31 — SERIALIZABLE requires retry handoff
S13O owns retry/backoff execution.

### R32 — lock ordering is explicit
Multiple pessimistic locks require deterministic acquisition order.

### R33 — advisory locks are exceptional
Require explicit approved coordination need.

### R34 — existing schema evolution defaults to expand/contract
Do not silently break consumers.

### R35 — destructive migration requires approval and recovery evidence
No destructive READY plan without it.

### R36 — populated-table required-field changes need backfill plan
Do not assume old rows magically satisfy new constraints.

### R37 — migration lock/rewrite risk is explicit
Large/hot table risk cannot be omitted.

### R38 — concurrent index creation is outside regular transaction
Model transaction-mode constraint accurately.

### R39 — rollback may be safe roll-forward
Do not require unsafe reverse-DDL as ritual.

### R40 — race prevention is database/transaction-backed
Service-only check-then-write is insufficient when concurrent violation is possible.

### R41 — triggers are not default
Require explicit justification.

### R42 — no ambient search_path dependency
Derived objects are schema-qualified.

### R43 — extensions are explicit
Never silently require pgcrypto/uuid-ossp/citext/PostGIS/etc.

### R44 — sensitive data needs approved storage policy
Do not model raw credentials/tokens without S13L-approved storage-security reference.

### R45 — structured model is authoritative
DDL preview is derived and must match the validated structure.

### R46 — acceptance/evidence preserved
Do not weaken, drop or invent them.

### R47 — inputs immutable
Do not mutate S13I snapshots or caller input.

### R48 — anti-self-certification
Recompute invariants/status/blockers; never trust candidate READY claims.

### R49 — no future-stage pull-forward
No S14 provider, S13K/S13L/S13O/S13R implementation.

### R50 — no S07 persistence conflation
Do not turn MemoryProvider SQLite into application PostgreSQL modeling/runtime.

## Evidence honesty

Structural validation and DDL rendering may pass without a live DB.

Actual PostgreSQL `EXPLAIN`, lock timing, migration execution and transaction anomaly tests remain explicit runtime evidence requirements until a real authorized capability exists.

## Success criteria

S13J passes only when:

- Part A is integrated verbatim and separately auditable;
- Skill remains SKILL_ONLY;
- no new AgentDefinition/Core branch exists;
- no PostgreSQL runtime dependency/server/ORM/migration runner is introduced;
- keys/FKs/constraints/domain types are safe;
- indexes are access-pattern justified and non-redundant;
- queries are bounded and N+1-safe;
- transaction/locking design protects declared invariants;
- migrations handle compatibility/data/lock risk safely;
- tenant/security assumptions are not invented;
- live PostgreSQL evidence is never fabricated;
- positive/negative fixtures pass;
- OI-A-safe Skill-vs-no-Skill threshold passes;
- real S12→S10→S09 runtime is proven;
- typecheck/tests/build/post-build pass;
- fresh independent verification passes;
- S13K remains NOT_STARTED until that PASS.
```

---

# ARTIFACT 2

**Target path**

```text
brain-bootstrap/quality-contracts/S13J_POSTGRES_DATA_MODELING_DEEP.yaml
```

## Verbatim content

```yaml
id: S13J_POSTGRES_DATA_MODELING_DEEP
version: 1.0.0
step: S13J
name: postgres-data-modeling
depth: DEEP
status: CANONICAL

purpose: >-
  Verify that S13J converts approved logical data intent into a safe PostgreSQL
  schema/modeling decision covering keys, relationships, constraints, domain
  types, access-pattern-derived indexes, bounded query checks, transaction and
  locking design, and migration safety without executing PostgreSQL or pulling
  provider/security/reliability/deployment stages forward.

rationale:
  risk: HIGH
  ambiguity: HIGH
  novelty: MEDIUM
  downstream_impact: HIGH
  irreversibility: HIGH

hard_invariants:
  - { id: HI-001, rule: one_bounded_task, pass: "Exactly one bounded persistence-modeling task is represented." }
  - { id: HI-002, rule: skill_only, pass: "No S13J AgentDefinition or Core special branch exists." }
  - { id: HI-003, rule: no_live_db_side_effect, pass: "Canonical Skill runtime opens no DB connection and executes no SQL/migration." }
  - { id: HI-004, rule: no_runtime_dependency, pass: "No PostgreSQL driver/ORM/migration framework/server dependency is added by S13J Part B." }
  - { id: HI-005, rule: input_immutability, pass: "Caller/S13I intent snapshots are not mutated." }
  - { id: HI-006, rule: explicit_schema_assumptions, pass: "Schema/search_path/extensions/version-sensitive assumptions are explicit." }
  - { id: HI-007, rule: identifier_policy, pass: "New identifiers follow safe unquoted lower_snake_case/length policy unless approved legacy exception exists." }
  - { id: HI-008, rule: primary_key_required, pass: "Every persisted table has an explicit valid PK strategy." }
  - { id: HI-009, rule: natural_key_proof, pass: "Natural PK requires stable immutable unique domain evidence." }
  - { id: HI-010, rule: fk_integrity, pass: "Required relational references have FK integrity unless explicitly external." }
  - { id: HI-011, rule: fk_action_safe, pass: "CASCADE/SET NULL/update actions match explicit lifecycle/nullability semantics." }
  - { id: HI-012, rule: nullability_matches_domain, pass: "Required/optional lifecycle semantics match NOT NULL/nullability." }
  - { id: HI-013, rule: uniqueness_race_safe, pass: "Concurrency-critical uniqueness is DB-enforced." }
  - { id: HI-014, rule: row_check_integrity, pass: "Row-local deterministic invariants use DB checks when safely expressible." }
  - { id: HI-015, rule: no_invented_tenancy, pass: "Tenant/owner scope and RLS are never invented." }
  - { id: HI-016, rule: time_semantics, pass: "Real instants are not silently modeled as timezone-naive timestamps." }
  - { id: HI-017, rule: exact_numeric_semantics, pass: "Exact money/decimal requirements avoid floating-point representation." }
  - { id: HI-018, rule: jsonb_relational_boundary, pass: "JSONB does not hide required FK/unique/join/filter core fields." }
  - { id: HI-019, rule: array_relational_boundary, pass: "Independently queryable/referenceable elements are not hidden in arrays." }
  - { id: HI-020, rule: index_source_backed, pass: "Every non-constraint index has source access/query justification." }
  - { id: HI-021, rule: no_redundant_index, pass: "No semantically redundant duplicate/subsumed index is emitted." }
  - { id: HI-022, rule: critical_access_supported, pass: "Critical high-cardinality access paths have justified support or explicit runtime-evidence rationale." }
  - { id: HI-023, rule: composite_index_order, pass: "Composite index order is consistent with declared query shape." }
  - { id: HI-024, rule: query_bounded, pass: "Potentially unbounded collection queries have stable ordering and a result/pagination bound." }
  - { id: HI-025, rule: n_plus_one_safe, pass: "Known avoidable N+1 query plans are not accepted." }
  - { id: HI-026, rule: no_fake_plan_evidence, pass: "No actual EXPLAIN/index-use claim exists without live PostgreSQL evidence." }
  - { id: HI-027, rule: atomicity_preserved, pass: "ATOMIC_GROUP_REQUIRED intent maps to one transaction boundary." }
  - { id: HI-028, rule: isolation_justified, pass: "Stronger isolation/locking has explicit anomaly/invariant justification." }
  - { id: HI-029, rule: serializable_retry_handoff, pass: "SERIALIZABLE plans carry S13O retry handoff requirement." }
  - { id: HI-030, rule: lock_order_safe, pass: "Multi-resource pessimistic locking has deterministic order." }
  - { id: HI-031, rule: advisory_lock_exception, pass: "Advisory locks require explicit approved need." }
  - { id: HI-032, rule: migration_compatibility, pass: "Existing external schemas evolve compatibly or carry explicit breaking approval." }
  - { id: HI-033, rule: destructive_change_approval, pass: "Destructive/data-loss migration requires approval and recovery evidence." }
  - { id: HI-034, rule: populated_backfill_safety, pass: "Required-field changes on populated data include expansion/backfill/validation." }
  - { id: HI-035, rule: migration_lock_risk, pass: "Large/hot-table lock/rewrite risk is explicitly classified and handled." }
  - { id: HI-036, rule: concurrent_index_transaction_mode, pass: "Concurrent index creation is not planned inside a normal transaction block." }
  - { id: HI-037, rule: race_prevention, pass: "Race-prone invariants use constraint/transaction/locking rather than service pre-check alone." }
  - { id: HI-038, rule: trigger_not_default, pass: "Trigger use is explicit and justified." }
  - { id: HI-039, rule: no_search_path_dependency, pass: "Derived model/DDL does not rely on ambient search_path." }
  - { id: HI-040, rule: extensions_explicit, pass: "No undeclared PostgreSQL extension is required." }
  - { id: HI-041, rule: sensitive_storage_boundary, pass: "Raw credential/secret storage requires approved S13L storage-security reference." }
  - { id: HI-042, rule: structured_model_authoritative, pass: "DDL preview cannot override or contradict validated structured model." }
  - { id: HI-043, rule: acceptance_evidence_preserved, pass: "Acceptance/evidence requirements are preserved without invention or weakening." }
  - { id: HI-044, rule: anti_self_certification, pass: "Status/blockers/hard invariants are recomputed from bounded input and candidate." }
  - { id: HI-045, rule: no_s07_conflation, pass: "S07 SQLite MemoryProvider is not repurposed as application persistence." }
  - { id: HI-046, rule: no_future_stage_pull_forward, pass: "No S14/S13K/S13L/S13O/S13R implementation is introduced." }

semantic_dimensions:
  - id: SD-001
    name: schema_identity_and_naming
    checks: ["table identity is explicit", "PK strategy is justified", "identifier/schema assumptions are safe"]
  - id: SD-002
    name: keys_relationships_and_constraints
    checks: ["FK lifecycle is correct", "nullability/uniqueness/checks enforce domain invariants", "race-prone integrity is DB-backed"]
  - id: SD-003
    name: type_domain_and_sensitive_data
    checks: ["time/money/status semantics are safe", "JSONB/array boundaries preserve relational needs", "sensitive storage has approved policy"]
  - id: SD-004
    name: index_and_access_path_design
    checks: ["indexes are query-derived", "critical paths are supported", "redundancy/composite order are safe"]
  - id: SD-005
    name: query_bounds_and_plan_evidence
    checks: ["collection queries are bounded", "N+1 is avoided", "live plan evidence is required rather than fabricated"]
  - id: SD-006
    name: transaction_concurrency_and_race_safety
    checks: ["atomicity maps to transaction", "isolation/locking are justified", "deadlock/retry handoffs are explicit"]
  - id: SD-007
    name: migration_compatibility_and_data_safety
    checks: ["expand/contract compatibility", "backfill/lock/rewrite risk", "destructive approval/recovery"]
  - id: SD-008
    name: tenant_security_and_schema_boundary
    checks: ["tenant/RLS not invented", "scope-aware integrity only when required", "schema/extensions/search_path explicit"]
  - id: SD-009
    name: acceptance_evidence_and_traceability
    checks: ["source refs trace decisions", "acceptance/evidence preserved", "runtime evidence gaps explicit"]
  - id: SD-010
    name: provider_runtime_and_future_stage_boundary
    checks: ["no DB/provider/live runtime binding", "S07 remains separate", "no future-step implementation"]

fixtures:
  minimum_positive_evaluable: 6
  minimum_negative: 20
  canonical_positive:
    - { id: FX-POS-001, title: parent_child_oltp }
    - { id: FX-POS-002, title: explicit_tenant_scoped_model }
    - { id: FX-POS-003, title: money_time_status_domain }
    - { id: FX-POS-004, title: high_cardinality_keyset_query }
    - { id: FX-POS-005, title: atomic_concurrent_mutation }
    - { id: FX-POS-006, title: expand_contract_migration }
  canonical_negative_ids:
    - FX-NEG-001
    - FX-NEG-002
    - FX-NEG-003
    - FX-NEG-004
    - FX-NEG-005
    - FX-NEG-006
    - FX-NEG-007
    - FX-NEG-008
    - FX-NEG-009
    - FX-NEG-010
    - FX-NEG-011
    - FX-NEG-012
    - FX-NEG-013
    - FX-NEG-014
    - FX-NEG-015
    - FX-NEG-016
    - FX-NEG-017
    - FX-NEG-018
    - FX-NEG-019
    - FX-NEG-020
    - FX-NEG-021
    - FX-NEG-022
    - FX-NEG-023
    - FX-NEG-024
    - FX-NEG-025
    - FX-NEG-026
    - FX-NEG-027
    - FX-NEG-028
    - FX-NEG-029
    - FX-NEG-030
    - FX-NEG-031
    - FX-NEG-032
    - FX-NEG-033
    - FX-NEG-034
    - FX-NEG-035
    - FX-NEG-036
    - FX-NEG-037
    - FX-NEG-038
    - FX-NEG-039
    - FX-NEG-040

ground_truth_policy:
  construction: FROZEN_BEFORE_EXECUTION
  provider_visibility: FORBIDDEN
  model_visibility: FORBIDDEN
  fixture_id_branching: FORBIDDEN
  skill_id_branching: FORBIDDEN
  with_skill_flag_branching: FORBIDDEN
  post_hoc_denominator_changes: FORBIDDEN

skill_vs_no_skill_evaluation:
  same_input: true
  same_agent_definition: true
  same_model_provider: true
  same_capability_provider: true
  same_s09_s10_runtime: true
  same_parser_validator_evaluator: true
  only_semantic_difference: "S13J Skill content present versus absent"
  minimum_evaluable_positive_fixtures: 6
  hard_invariant_score_with_skill: 1.0
  maximum_missing_key_fk_constraint_recommendations_with_skill: 0
  maximum_unsafe_destructive_migration_recommendations_with_skill: 0
  maximum_unbounded_or_n_plus_one_critical_query_recommendations_with_skill: 0
  maximum_provider_credential_live_runtime_bindings_with_skill: 0
  maximum_future_stage_pull_forward_violations_with_skill: 0
  minimum_additional_correct_dimension_specific_assertions_total: 16
  improvement_distribution:
    minimum_distinct_dimensions: 6
    minimum_dimension_specific_scored_assertion_ids_per_improved_dimension: 3
    minimum_additional_correct_instances_per_improved_dimension: 2
    maximum_single_assertion_share_of_dimension_improvement: 0.5
  cross_cutting_assertions:
    may_count_toward_regression_score: true
    may_count_toward_improved_dimension_threshold: false
  hard_invariant_regression_allowed: false

reference_model_policy:
  allowed: true
  requirements:
    - "Must execute through real S09 runAgent."
    - "Must not import frozen truth."
    - "Must not branch on fixture id, S13J Skill id, or with-Skill flag."
    - "Must be labeled deterministic/reference, not production external LLM."

runtime_evidence_honesty:
  live_postgres_required_for_part_b: false
  forbidden_claims_without_live_capability:
    - actual_explain_plan
    - actual_index_usage
    - actual_migration_lock_duration
    - actual_transaction_anomaly_result
    - actual_postgres_ddl_execution

pass_criteria:
  - "All hard invariants pass."
  - "All canonical positives pass."
  - "Canonical negatives fail as specified."
  - "Skill-vs-no-Skill OI-A-safe threshold passes."
  - "No live PostgreSQL/provider/runtime dependency is introduced."
  - "No unsafe destructive migration or missing integrity recommendation occurs."
  - "No critical unbounded/N+1 query recommendation occurs."
  - "S12 → S10 → S09 runtime path passes."
  - "typecheck/full tests/clean build/post-build pass."
  - "fresh independent verification passes."
  - "S13K remains NOT_STARTED until independent PASS."

failure_policy:
  semantic:
    action: RETURN_TO_CHATGPT_AUTHORING_GATE
  mechanical:
    action: CODING_AGENT_MAY_REPAIR_LOCALLY
    constraint: "Part A semantics remain unchanged."

evidence_required:
  - "Part A integrity."
  - "Input immutability."
  - "PK/FK/constraint evidence."
  - "Domain-type/sensitive-data evidence."
  - "Index justification/redundancy evidence."
  - "Query bound/N+1/runtime-plan-evidence honesty."
  - "Transaction/isolation/locking evidence."
  - "Migration compatibility/backfill/lock/destructive-change evidence."
  - "Tenant/schema/extension boundary evidence."
  - "Structured-model/DDL consistency evidence."
  - "Anti-self-certification anchor."
  - "S12→S10→S09 runtime evidence."
  - "Provider/frozen-truth source audit."
  - "Skill-vs-no-Skill raw per-dimension and per-assertion contribution counts."
  - "typecheck/tests/build/post-build results."
  - "fresh independent verification."
```

---

# ARTIFACT 3

**Target path**

```text
brain-bootstrap/specs/POSTGRES_DATA_MODELING_CONTRACT_S13J.md
```

## Verbatim content

```markdown
# BRAIN — PostgreSQL Data Modeling Contract S13J

**Step:** S13J — postgres-data-modeling  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**Quality depth:** DEEP  
**New AgentDefinition:** NO  
**Canonical Skill runtime side effects:** NONE  
**Live PostgreSQL execution:** OUT OF SCOPE

---

## 1. Purpose

Define a PostgreSQL-specific but runtime/provider-neutral modeling contract for one bounded application persistence task.

The structured decision is authoritative. DDL preview is derived.

---

## 2. Canonical types

```ts
export type PostgresDataModelingStatus = "READY" | "BLOCKED";
export type PostgresModelingMode = "GREENFIELD" | "EVOLUTION";

export type PostgresPkStrategy =
  | "SURROGATE_BIGINT"
  | "SURROGATE_UUID"
  | "NATURAL"
  | "COMPOSITE";

export type PostgresFkDeleteAction =
  | "NO_ACTION"
  | "RESTRICT"
  | "CASCADE"
  | "SET_NULL";

export type PostgresIsolationLevel =
  | "READ_COMMITTED"
  | "REPEATABLE_READ"
  | "SERIALIZABLE";

export type PostgresLockMode =
  | "NONE"
  | "ROW_LOCK";

export type PostgresSensitivity =
  | "NONE"
  | "PII"
  | "SECRET"
  | "CREDENTIAL_MATERIAL";

export type PostgresQueryCriticality = "LOW" | "MEDIUM" | "HIGH";
export type PostgresCardinalityClass = "SMALL_BOUNDED" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type PostgresQueryCheckStatus = "STATIC_PASS" | "RUNTIME_EVIDENCE_REQUIRED" | "BLOCKED";
export type PostgresMigrationPhase = "EXPAND" | "BACKFILL" | "VALIDATE" | "CUTOVER" | "CONTRACT";
export type PostgresMigrationTransactionMode = "REQUIRED" | "OPTIONAL" | "FORBIDDEN";
export type PostgresRiskLevel = "LOW" | "MEDIUM" | "HIGH";
```

---

## 3. Target facts

```ts
export interface PostgresTargetFacts {
  schema_name: string;
  major_version?: number;
  extensions: string[];
  rls_mode: "NOT_REQUESTED" | "REQUIRED_BY_UPSTREAM" | "DEFERRED_TO_S13L";
}
```

No ambient search_path dependency.

---

## 4. Entity and field intent

```ts
export interface NaturalKeyCandidateIntent {
  field_refs: string[];
  domain_unique: boolean;
  stable: boolean;
  immutable: boolean;
  source_refs: string[];
}

export interface PostgresEntityIdentityIntent {
  distributed_generation_required: boolean;
  external_preallocation_required: boolean;
  association_identity: boolean;
  natural_key_candidates: NaturalKeyCandidateIntent[];
  preferred_strategy?: PostgresPkStrategy;
  source_refs: string[];
}

export interface PostgresFieldIntent {
  id: string;
  logical_name: string;
  semantic_type:
    | "IDENTIFIER"
    | "TEXT"
    | "BOOLEAN"
    | "INTEGER"
    | "DECIMAL"
    | "MONEY"
    | "DATE"
    | "INSTANT"
    | "LOCAL_DATETIME"
    | "STATUS"
    | "JSON_DOCUMENT"
    | "ATOMIC_LIST"
    | "BINARY";
  required_at_insert: boolean;
  mutable: boolean;
  sensitivity: PostgresSensitivity;
  storage_security_ref?: string;
  closed_stable_values?: string[];
  queryable_independently: boolean;
  relationship_target_ref?: string;
  source_refs: string[];
}

export interface PostgresEntityIntent {
  id: string;
  logical_name: string;
  persisted: boolean;
  fields: PostgresFieldIntent[];
  identity: PostgresEntityIdentityIntent;
  tenant_scope_required: boolean;
  tenant_field_ref?: string;
  audit_requirements: {
    created_at_required: boolean;
    updated_at_required: boolean;
    updated_at_maintenance_owner?: "APPLICATION" | "DATABASE_APPROVED_TRIGGER";
    soft_delete_required: boolean;
  };
  source_refs: string[];
}
```

---

## 5. Relationship intent

```ts
export interface PostgresRelationshipIntent {
  id: string;
  from_entity_ref: string;
  from_field_refs: string[];
  to_entity_ref: string;
  to_field_refs: string[];
  integrity_required: boolean;
  external_reference: boolean;
  child_may_outlive_parent: boolean;
  orphan_valid: boolean;
  preferred_delete_action?: PostgresFkDeleteAction;
  source_refs: string[];
}
```

---

## 6. Data access and atomicity snapshots

S13J-local types are provider-neutral and may be deterministically projected from S13I.

```ts
export type PostgresDataAccessKind =
  | "READ"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXISTS"
  | "LIST";

export interface PostgresDataAccessRequirement {
  id: string;
  kind: PostgresDataAccessKind;
  entity_ref: string;
  field_intent_refs: string[];
  source_refs: string[];
}

export interface PostgresAtomicityIntent {
  requirement: "NONE" | "ATOMIC_GROUP_REQUIRED";
  logical_operation_refs: string[];
  source_refs: string[];
}
```

Projection MUST preserve source refs and not mutate S13I input.

---

## 7. Query/access patterns

```ts
export interface PostgresPredicateIntent {
  field_ref: string;
  operator: "EQ" | "IN" | "RANGE" | "PREFIX" | "IS_NULL" | "IS_NOT_NULL";
}

export interface PostgresOrderIntent {
  field_ref: string;
  direction: "ASC" | "DESC";
}

export interface PostgresJoinIntent {
  from_field_ref: string;
  to_entity_ref: string;
  to_field_ref: string;
}

export interface PostgresQueryPattern {
  id: string;
  operation_ref: string;
  entity_ref: string;
  joins: PostgresJoinIntent[];
  predicates: PostgresPredicateIntent[];
  order_by: PostgresOrderIntent[];
  pagination: "NONE" | "LIMIT" | "OFFSET_LIMIT" | "KEYSET";
  max_rows?: number;
  potentially_unbounded: boolean;
  n_plus_one_shape: boolean;
  cardinality: PostgresCardinalityClass;
  criticality: PostgresQueryCriticality;
  runtime_plan_evidence_required: boolean;
  source_refs: string[];
}
```

---

## 8. Migration compatibility input

```ts
export interface PostgresMigrationCompatibilityInput {
  external_consumers_exist: boolean;
  backward_compatible_required: boolean;
  destructive_change_approved: boolean;
  destructive_approval_ref?: string;
  recovery_evidence_refs: string[];
  populated_entities: string[];
  large_or_hot_entities: string[];
}
```

---

## 9. Canonical input

```ts
export interface PostgresDataModelingInput {
  task_ref: string;
  spec_refs: string[];
  mode: PostgresModelingMode;

  target: PostgresTargetFacts;

  entities: PostgresEntityIntent[];
  relationships: PostgresRelationshipIntent[];

  data_access_requirements: PostgresDataAccessRequirement[];
  atomicity_intent: PostgresAtomicityIntent;
  query_patterns: PostgresQueryPattern[];

  migration_compatibility: PostgresMigrationCompatibilityInput;

  acceptance: TaskAcceptanceCriterion[];
  evidence_required: PostgresEvidenceRequirement[];
}
```

Input is immutable.

---

## 10. Schema model

```ts
export interface PostgresColumnDesign {
  id: string;
  name: string;
  logical_field_ref: string;
  postgres_type: string;
  nullable: boolean;
  default_expression?: string;
  sensitivity: PostgresSensitivity;
}

export interface PostgresPrimaryKeyDesign {
  strategy: PostgresPkStrategy;
  column_refs: string[];
  justification_refs: string[];
}

export interface PostgresForeignKeyDesign {
  id: string;
  from_column_refs: string[];
  to_table_ref: string;
  to_column_refs: string[];
  on_delete: PostgresFkDeleteAction;
  on_update: "NO_ACTION" | "CASCADE";
  justification_refs: string[];
}

export interface PostgresUniqueConstraintDesign {
  id: string;
  column_refs: string[];
  predicate?: string;
  source_refs: string[];
}

export interface PostgresCheckConstraintDesign {
  id: string;
  expression: string;
  source_refs: string[];
}

export interface PostgresTableDesign {
  id: string;
  schema_name: string;
  name: string;
  columns: PostgresColumnDesign[];
  primary_key: PostgresPrimaryKeyDesign;
  foreign_keys: PostgresForeignKeyDesign[];
  unique_constraints: PostgresUniqueConstraintDesign[];
  check_constraints: PostgresCheckConstraintDesign[];
  rls_required: boolean;
  source_refs: string[];
}

export interface PostgresSchemaModel {
  tables: PostgresTableDesign[];
  required_extensions: string[];
  version_requirements: Array<{
    feature: string;
    minimum_major_version: number;
    source_refs: string[];
  }>;
}
```

No connection/provider credentials appear anywhere.

---

## 11. Domain-type rules

### Exact money

Allowed canonical representations:

```text
BIGINT/INTEGER minor units + currency
NUMERIC(p,s) + currency/measurement semantics
```

`real` / `double precision` are invalid for exact money.

### Instants

Use `timestamptz` for real instants.

### Status

Evolving set → text + CHECK/lookup.

Native enum requires explicit closed/stable values.

### JSONB / arrays

Reject if the field requires independent FK/unique/join/filter/update semantics better represented relationally.

---

## 12. Index plan

```ts
export interface PostgresIndexDesign {
  id: string;
  table_ref: string;
  unique: boolean;
  method: "BTREE";
  key_column_refs: string[];
  order?: Array<"ASC" | "DESC">;
  include_column_refs: string[];
  predicate?: string;
  expression?: string;
  concurrently_planned: boolean;
  covers_query_refs: string[];
  justification_refs: string[];
}

export interface PostgresIndexPlan {
  indexes: PostgresIndexDesign[];
  rejected_redundant_index_refs: string[];
  missing_critical_access_refs: string[];
}
```

A PK/UNIQUE-backed implicit index is represented as an existing constraint index and is not duplicated as a new index.

---

## 13. Query-check plan

```ts
export interface PostgresQueryCheck {
  query_ref: string;
  status: PostgresQueryCheckStatus;
  supporting_index_refs: string[];
  blockers: string[];
  runtime_evidence_required: string[];
}

export interface PostgresQueryCheckPlan {
  checks: PostgresQueryCheck[];
}
```

No actual EXPLAIN claim without live evidence.

---

## 14. Transaction plan

```ts
export interface PostgresTransactionDesign {
  id: string;
  operation_refs: string[];
  isolation: PostgresIsolationLevel;
  lock_mode: PostgresLockMode;
  lock_order_refs: string[];
  invariant_refs: string[];
  serializable_retry_handoff_ref?: string;
  source_refs: string[];
}

export interface PostgresTransactionPlan {
  transactions: PostgresTransactionDesign[];
}
```

`ATOMIC_GROUP_REQUIRED` must map to exactly one transaction covering its operation refs.

---

## 15. Migration plan

```ts
export interface PostgresMigrationStep {
  id: string;
  phase: PostgresMigrationPhase;
  description: string;
  entity_refs: string[];
  transaction_mode: PostgresMigrationTransactionMode;
  destructive: boolean;
  lock_risk: PostgresRiskLevel;
  rewrite_risk: PostgresRiskLevel;
  backfill_bounded: boolean;
  approval_ref?: string;
  recovery_evidence_refs: string[];
  source_refs: string[];
}

export interface PostgresMigrationPlan {
  steps: PostgresMigrationStep[];
  compatibility_mode: "GREENFIELD" | "EXPAND_CONTRACT" | "BREAKING_APPROVED";
}
```

No migration execution occurs.

---

## 16. Boundary handoffs

```ts
export interface PostgresBoundaryHandoffs {
  deferred_to_s13l: string[];
  deferred_to_s13o: string[];
  deferred_to_s13r: string[];
  deferred_to_s14: string[];
  runtime_postgres_evidence_required: string[];
}
```

---

## 17. Canonical decision

```ts
export interface PostgresDataModelingDecision {
  status: PostgresDataModelingStatus;
  blockers: string[];

  task_ref: string;
  spec_refs: string[];

  schema_model: PostgresSchemaModel;
  index_plan: PostgresIndexPlan;
  query_check_plan: PostgresQueryCheckPlan;
  transaction_plan: PostgresTransactionPlan;
  migration_plan: PostgresMigrationPlan;
  boundary_handoffs: PostgresBoundaryHandoffs;

  acceptance: TaskAcceptanceCriterion[];
  evidence_required: PostgresEvidenceRequirement[];
}
```

---

## 18. Derived DDL artifact

```ts
export interface PostgresDataModelingArtifact {
  decision: PostgresDataModelingDecision;
  ddl_preview: string[];
}
```

`ddl_preview` is generated deterministically **after** decision validation.

It is not model authority.

Renderer requirements:

- schema-qualified names;
- stable deterministic ordering;
- no credentials/connection commands;
- no migration execution wrapper;
- no search_path reliance;
- output must correspond exactly to validated structured model.

---

## 19. Status derivation

Any hard contract violation → `BLOCKED`.

Examples:

- missing PK/FK/required constraint;
- invalid referential action;
- domain type unsafe;
- invented tenant/extension/security assumption;
- unjustified/missing critical index;
- unbounded/N+1 critical query;
- atomicity/locking race unsafe;
- destructive migration unapproved;
- fake live PostgreSQL evidence;
- provider/runtime/future-stage binding.

Otherwise → `READY`.

Candidate status is never trusted.

---

## 20. Index derivation rules

For a B-tree access path:

- equality-constrained common prefix generally precedes range/order needs;
- range boundary normally terminates useful ordered prefix for subsequent key matching;
- ordering columns belong when they satisfy declared stable order and query shape;
- INCLUDE is non-key payload only and requires an explicit read-path rationale;
- partial predicate must match the declared query predicate;
- expression index must match the declared expression;
- exact/semantically subsumed duplicates are rejected only when uniqueness/predicate/order semantics are truly redundant.

No selectivity estimate is invented.

---

## 21. Query rules

BLOCK when:

- potentially unbounded and no limit/keyset/bounded rationale;
- declared N+1 shape is avoidable and accepted as normal;
- query references unknown field/table;
- critical HIGH-cardinality query has no support/rationale;
- ordering is unstable for pagination.

Use `RUNTIME_EVIDENCE_REQUIRED` when static design is valid but actual PostgreSQL cost/plan/index-use must be measured.

---

## 22. Transaction/concurrency rules

- Constraint beats check-then-write where possible.
- `READ_COMMITTED` baseline absent stronger need.
- `REPEATABLE_READ` only for consistent-snapshot anomaly need.
- `SERIALIZABLE` only with explicit invariant/anomaly + S13O retry handoff.
- Row locks only for justified resource serialization.
- Multi-lock plan needs deterministic lock order.
- Advisory lock needs explicit approved exception.

---

## 23. Migration rules

Evolution of used schema defaults to `EXPAND_CONTRACT`.

A destructive step requires:

```text
destructive_change_approved = true
approval_ref present
recovery_evidence_refs non-empty
```

Large/hot entity step cannot omit lock/rewrite risk.

Required data on populated entity cannot jump directly to a state that assumes old rows are valid; include backfill/validation semantics.

`concurrently_planned == true` index creation maps to migration `transaction_mode = FORBIDDEN`.

---

## 24. Sensitive-data rules

`SECRET` / `CREDENTIAL_MATERIAL` field intent requires `storage_security_ref`.

S13J does not author encryption/key-management/auth policy.

Never include secret values in fixtures or DDL.

---

## 25. Anti-self-certification

Gate recomputes:

```text
PK completeness
FK/referential safety
constraint/race safety
domain types
index justification/redundancy/query support
query bounds/N+1/evidence honesty
transaction/locking safety
migration compatibility/destructive approval
schema/extension/tenant/security boundaries
acceptance/evidence preservation
future-stage/provider boundary
final status/blockers
```

Anchor:

```text
candidate says READY
but relationship requires FK and candidate omits it
→ deterministic gate BLOCKED
```

---

## 26. Skill-vs-no-Skill

Scoring categories:

```text
SD-001..SD-010
REGRESSION_CROSS_CUTTING
```

Cross-cutting assertions do not qualify dimensions.

Each improved dimension requires:

```text
>=3 distinct dimension-specific assertion IDs
>=2 improved scored instances
max(per_assertion_improved_instance_count)/dimension_delta <= 0.5
```

Overall:

```text
hard invariants = 100%
missing-key/FK/required-constraint unsafe recommendations = 0
unsafe destructive migration recommendations = 0
unbounded/N+1 critical query recommendations = 0
provider/credential/live-runtime bindings = 0
future-stage pull-forward violations = 0
dimension-specific delta >= +16
improved dimensions >= 6
no hard-invariant regression
```

Raw contribution counts are mandatory evidence.

---

## 27. Minimum semantic test coverage

Part B MUST provide equivalent concrete evidence for at least:

```text
T1   valid greenfield input validates
T2   input/S13I projection is immutable
T3   one bounded task enforced
T4   no dedicated S13J AgentDefinition
T5   no Core Skill-id/role branch
T6   Skill requires no capabilities and side effects NONE
T7   explicit schema target required
T8   safe identifier positive
T9   quoted/mixed/overlength new identifier rejects absent legacy approval
T10  persisted table requires PK
T11  stable immutable natural key may be PK
T12  mutable natural key cannot silently be PK
T13  distributed/preallocated identity can justify UUID
T14  centralized OLTP can justify bigint
T15  unjustified wide composite PK rejects
T16  required relationship gets FK
T17  explicitly external reference may omit FK
T18  unjustified CASCADE blocks
T19  SET NULL requires nullable/orphan-valid lifecycle
T20  required-at-insert nullability maps NOT NULL
T21  optional lifecycle may remain nullable
T22  concurrent uniqueness uses DB unique constraint/index
T23  row-local invariant maps CHECK
T24  service-only race-prone invariant blocks
T25  tenant scope is not invented
T26  explicit tenant scope supports scope-aware uniqueness/FK
T27  RLS is not invented
T28  real instant uses timestamptz
T29  deliberate local datetime may use timestamp without tz semantics
T30  exact money cannot use float/double
T31  status closed/stable requirement governs enum allowance
T32  JSONB cannot hide FK/unique/queryable core field
T33  array cannot hide independently queryable child relation
T34  sensitive credential storage requires S13L storage ref
T35  non-constraint index requires query/access justification
T36  PK/UNIQUE implicit index is not duplicated
T37  semantically redundant index rejects
T38  critical high-cardinality access path needs support/rationale
T39  composite index order matches equality/range/order query shape
T40  partial index predicate must match query predicate
T41  expression index requires matching query expression
T42  INCLUDE requires explicit covering-read rationale
T43  potentially unbounded collection query blocks
T44  bounded LIMIT/keyset query passes structural check
T45  unstable pagination order blocks
T46  avoidable N+1 plan blocks
T47  unknown field/table in query blocks
T48  valid static query may require future EXPLAIN evidence
T49  actual EXPLAIN claim without capability rejects
T50  S13I ATOMIC_GROUP_REQUIRED maps to one transaction
T51  READ_COMMITTED baseline works absent stronger anomaly need
T52  REPEATABLE_READ requires snapshot justification
T53  SERIALIZABLE requires anomaly/invariant + S13O retry handoff
T54  justified row lock may pass
T55  multi-resource locks require deterministic order
T56  advisory lock without approved need blocks
T57  evolution defaults expand/contract when consumers exist
T58  destructive migration without approval blocks
T59  destructive approved migration still requires recovery evidence
T60  populated-table required field needs backfill/validation plan
T61  large/hot table migration records lock/rewrite risk
T62  concurrent index migration step is transaction-forbidden
T63  incompatible rename/drop needs compatibility or breaking approval
T64  safe roll-forward recovery may satisfy rollback semantics
T65  trigger is not introduced without explicit justification
T66  no ambient search_path reliance
T67  undeclared extension requirement blocks
T68  version-specific feature incompatible/unknown target blocks
T69  structured model is authoritative over DDL preview
T70  DDL preview deterministic and schema-qualified
T71  DDL preview contains no credentials/connection/runtime commands
T72  acceptance/evidence preserved
T73  candidate READY with missing FK is gated BLOCKED
T74  candidate READY with destructive unapproved migration is gated BLOCKED
T75  S12 metadata-only discovery + lazy load proven
T76  S10 compileAgentDefinition + S09 runAgent proven
T77  deterministic/reference provider honestly labeled
T78  provider cannot import frozen truth
T79  no fixture-id/S13J-id/withSkill branch
T80  six canonical positives pass
T81  canonical negatives fail as intended
T82  cross-cutting assertions excluded from dimension qualification
T83  each qualified dimension has >=3 distinct dimension assertion IDs
T84  each qualified dimension improves >=2 scored instances
T85  per-assertion contribution grouping is exposed
T86  max single-assertion share <=0.5 for qualified dimensions
T87  dimension-specific total delta >=16
T88  at least 6 semantic dimensions improve
T89  with-Skill hard invariants =100%
T90  unsafe recommendation counters =0
T91  no hard-invariant regression
T92  no separate deliberately-bad baseline planner
T93  no pg/ORM/migration-framework dependency added
T94  no live DB/server/connection/credential implementation
T95  S07 MemoryProvider remains unchanged semantically
T96  no S14/S13K/S13L/S13O/S13R implementation
T97  full prior regression suite remains green
T98  clean build + post-build suite pass
```

Numeric test count alone is insufficient.

---

## 28. Part B candidate scope

Equivalent responsibilities:

```text
src/intelligence/postgres-data-modeling/
  constants.ts
  types.ts
  projectApiDataIntent.ts
  validateModelingInput.ts
  decidePrimaryKeys.ts
  validateRelationshipsAndConstraints.ts
  validateDomainTypes.ts
  deriveIndexPlan.ts
  validateIndexPlan.ts
  buildQueryCheckPlan.ts
  buildTransactionPlan.ts
  buildMigrationPlan.ts
  validatePostgresDataModelingDecision.ts
  renderPostgresDdlPreview.ts
  synthesizePostgresDataModelingDecision.ts
  planPostgresDataModeling.ts
  comparePostgresDataModelingRuns.ts
  index.ts

src/intelligence/skills/definitions/postgresDataModelingS13J.ts
src/intelligence/skills/index.ts
tests/postgres-data-modeling/...
brain-bootstrap/reports/S13J-postgres-data-modeling-verification.md
```

Exact filenames may follow repository conventions.

---

## 29. Forbidden scope

Do not implement:

```text
PostgreSQL driver/server/container
ORM
migration runner/framework
connection pool/credentials
live SQL execution
application production database
S07 MemoryProvider replacement
Capability Registry/PostgreSQL capability S14
S13K frontend
S13L auth/security platform
S13O retry/job runtime
S13R deployment
```

---

## 30. Independent verification

Before S13K:

- builder closes S13J with deterministic QA/eval;
- builder-side read-only review checks Part A/source/provider/evaluator;
- fresh non-authoring verifier runs read-only;
- independently re-measures Skill-vs-no-Skill including OI-A contribution grouping;
- checks Part A integrity and stage boundaries;
- verifies no fake live PostgreSQL evidence;
- re-runs typecheck/focused/full/build/post-build;
- returns PASS|FAIL|BLOCKED.

S13K remains NOT_STARTED until fresh independent PASS.
```

---

# Integration instructions for Codex

1. Fetch the temporary ChatGPT authoring branch.
2. **Do not merge the branch.**
3. Read/copy this transfer file with `git show`.
4. Verify the transfer file hash and preserve it as audit evidence.
5. Extract and integrate the three artifacts above **verbatim** at:

```text
brain-bootstrap/skills/POSTGRES_DATA_MODELING_SKILL_S13J.md
brain-bootstrap/quality-contracts/S13J_POSTGRES_DATA_MODELING_DEEP.yaml
brain-bootstrap/specs/POSTGRES_DATA_MODELING_CONTRACT_S13J.md
```

6. Parse the YAML Quality Contract.
7. Verify byte identity against the transfer blocks.
8. Run docs-only baseline typecheck/tests under Node 24.
9. Create a **Part-A-only commit** on `main` and push.
10. Do not commit the transfer/preflight scaffolding unless the established audit convention explicitly requires it.
11. Re-check `HEAD == origin/main` and that Part B is still absent.
12. Continue into S13J Part B under the master authorization, strictly against committed Part A.
13. Do not start S13K until S13J receives fresh independent VERIFIED PASS.

## Required integration result

```text
S13J_PART_A_INTEGRATION
STATUS: PASS | FAIL

PART_A:
- skill:
- quality_contract:
- contract_spec:
- byte_identity:
- yaml_parse:
- semantic_changes:

AUDIT:
- transfer_branch:
- transfer_path:
- transfer_sha256:
- part_a_only_commit:
- pushed:
- HEAD_equals_origin_main:

BOUNDARY:
- Part_B_started:
- S13K_started:
- S14_started:

NEXT_EXACT_ACTION:
Implement S13J Part B only after successful Part A integration; preserve all Part A semantics.
```

STOP semantic authoring here. Part B is coding-agent work after integration.
