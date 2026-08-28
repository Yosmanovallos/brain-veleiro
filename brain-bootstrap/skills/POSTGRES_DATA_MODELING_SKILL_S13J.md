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
