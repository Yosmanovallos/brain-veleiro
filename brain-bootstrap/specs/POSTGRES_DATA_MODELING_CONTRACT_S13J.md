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
