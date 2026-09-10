# S14H — PostgreSQL Inspect Capability Semantic Contract

**Parent:** S14 — Capability Registry, Tools and MCP  
**Phase:** S14H  
**Version:** 1.0.0  
**Status:** AUTHORING_READY  
**Classification:** RUNTIME_INFRASTRUCTURE  
**Depth:** DEEP  
**Semantic-authoring baseline:** `8edd55a6b95e1b3c71ce07b342ea6348a70cac6b`  
**Honor invariant:** `HI-054 NOT_AWARDED`

## 1. Authority

This document is canonical S14H Part A semantics.

The parent S14 contract requires the incremental order:

```text
S14G Browser
S14H PostgreSQL Inspect
S14I Generic MCP Adapter
```

S14G is verified and integrated on the semantic-authoring baseline above.

S14H Part A does not authorize Part B implementation.

## 2. Design decision: metadata-only inspect

The exact S14H v1 capability set is:

```text
postgres.inspect
```

`postgres.inspect` is structural inspection only.

It does not accept arbitrary SQL and does not return application row data.

Why:

- the parent S14 contract names `postgres.inspect`;
- arbitrary SQL would collapse metadata inspection, data exfiltration and mutation into one capability;
- the current permission model does not encode SQL-level authorization;
- a future `postgres.query` or write capability therefore requires a separate explicit authoring gate.

## 3. Existing interfaces preserved

S14H reuses without semantic change:

```text
CapabilityProvider
ToolDescriptor
ToolInvocationRequest
ToolInvocationResult
NormalizedToolError
ToolSideEffectClass
RestrictedCapabilityProvider
CapabilityRegistryProvider
AgentDefinition.tools
AgentDefinition.capabilities
```

No PostgreSQL field enters AgentDefinition.

Any need to modify Core, AgentDefinition, Registry, Restricted or side-effect semantics returns:

```text
CHATGPT_AUTHORING_REQUIRED
```

## 4. Capability descriptor

Exactly:

```text
capability_id: postgres.inspect
side_effects: EXTERNAL
```

Input schema is closed:

```json
{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["server", "schemas", "tables", "columns", "indexes", "constraints"]
    },
    "schema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 63
    },
    "table": {
      "type": "string",
      "minLength": 1,
      "maxLength": 63
    }
  },
  "required": ["operation"],
  "additionalProperties": false
}
```

Runtime validation remains authoritative.

String byte bounds are UTF-8 byte bounds, not JavaScript character counts.

## 5. Operation matrix

```text
server:
  schema = forbidden
  table = forbidden

schemas:
  schema = forbidden
  table = forbidden

tables:
  schema = optional
  table = forbidden

columns:
  schema = required
  table = required

indexes:
  schema = required
  table = required

constraints:
  schema = required
  table = required
```

A provided schema must be in the configured schema allowlist.

For `tables` with no schema, inspect all configured schemas.

## 6. Provider configuration

Reference:

```ts
interface PostgresInspectProviderConfig {
  connection_id: string;
  connection_ref: string;
  allowed_schemas: string[];
  max_timeout_ms: number;
  max_rows: number;
  max_output_bytes: number;
}
```

Bounds:

```text
connection_id:
  1..160 ASCII
  ^[a-z0-9][a-z0-9._-]{0,159}$

connection_ref:
  1..256 ASCII
  opaque reference only

allowed_schemas:
  1..32 unique names

schema name:
  1..63 UTF-8 bytes
  no NUL/control characters

max_timeout_ms:
  integer 1..60000

max_rows:
  integer 1..500

max_output_bytes:
  integer 4096..262144
```

Forbidden configured schemas:

```text
pg_catalog
information_schema
pg_toast
any pg_temp*
any pg_toast_temp*
```

No wildcard.

Configuration is copied/frozen at construction.

Unknown config fields fail closed.

Forbidden public config keys include:

```text
host
port
database
user
username
password
connection_string
connectionString
ssl
ca
cert
key
servername
socket
pool
max_pool
application_name
statement_timeout
query_timeout
search_path
options
native
pg_native
retry
```

Connection material belongs only to the resolver.

## 7. Connection resolver

Provider-private:

```ts
interface PostgresConnectionResolver {
  resolve(connection_ref: string): Promise<PostgresConnectionMaterial>;
}
```

Reference resolved shape:

```ts
interface PostgresConnectionMaterial {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  tls:
    | {
        mode: "verify-full";
        ca: string;
        servername?: string;
      }
    | {
        mode: "disabled-loopback-only";
      };
}
```

This shape is not model-visible.

Validation rules:

```text
host 1..253 bytes
port integer 1..65535
database/user 1..63 UTF-8 bytes
password bounded <=4096 UTF-8 bytes
no NUL/control in textual connection fields
remote/non-loopback host => verify-full TLS required
TLS-disabled => host must be literal 127.0.0.1 or ::1
CA required for verify-full
rejectUnauthorized is always true for verify-full
```

Do not accept a connection URI because URI query parameters can smuggle provider options.

Do not accept environment fallback.

## 8. node-postgres dependency

Part B may add exactly:

```text
dependencies:
  pg: 8.23.0

devDependencies:
  @types/pg: 8.23.1
```

Exact pins only.

No:

```text
pg-native
postgres
postgres.js
knex
sequelize
typeorm
prisma
drizzle
```

No other dependency/version change.

Part A modifies no package manifest.

## 9. Explicit pg.Client configuration

Production uses one fresh `pg.Client` per invocation.

All relevant connection fields must be explicitly supplied.

Never instantiate an under-specified Client that could read:

```text
PGHOST
PGPORT
PGDATABASE
PGUSER
PGPASSWORD
PGSSLMODE
PGOPTIONS
```

Provider-owned client settings include:

```text
application_name = fixed Brain identifier
pipeline = false
keepAlive = false
connectionTimeoutMillis = remaining invocation budget
statement_timeout <= remaining invocation budget
query_timeout <= remaining invocation budget
```

No Pool.

No global pg defaults.

No native libpq.

## 10. Fixed SQL registry

The provider contains a closed registry of fixed query texts.

Allowed SQL command classes:

```text
BEGIN TRANSACTION READ ONLY
SELECT
ROLLBACK
```

No production query string may begin with or contain a second statement for:

```text
INSERT
UPDATE
DELETE
MERGE
COPY
CREATE
ALTER
DROP
TRUNCATE
COMMENT
GRANT
REVOKE
CALL
DO
EXECUTE
PREPARE
DEALLOCATE
LISTEN
NOTIFY
VACUUM
ANALYZE
REFRESH
REINDEX
CLUSTER
SECURITY LABEL
```

Do not use semicolon-separated query batches.

The builder must maintain a deterministic query-registry oracle proving all production query texts are in the canonical registry.

## 11. Parameterization

Model-derived schema/table values appear only in `values`, never interpolated into SQL text.

No dynamic identifier quoting is needed because catalog filtering compares names as data values.

No:

```text
`${schema}`
`${table}`
string concatenation
format()
quote_ident()
search_path mutation
```

for model-derived scope.

Provider-owned row limit uses `max_rows + 1` so truncation is detectable.

## 12. Read-only transaction enforcement

After connect:

```sql
BEGIN TRANSACTION READ ONLY
```

must succeed before the metadata SELECT.

Before success, the provider must prove transaction read-only state through a provider-owned fixed check or equivalent driver invariant.

The inspection SELECT executes inside that read-only transaction.

The provider ends with:

```sql
ROLLBACK
```

not COMMIT.

The provider never creates temporary objects.

PostgreSQL's transaction-level read-only mode is a defense-in-depth boundary; the primary boundary remains that production exposes only the fixed SELECT registry.

## 13. Catalog scope

Canonical metadata sources may include only provider-owned schema-qualified reads from:

```text
pg_catalog.pg_namespace
pg_catalog.pg_class
pg_catalog.pg_attribute
pg_catalog.pg_type
pg_catalog.pg_index
pg_catalog.pg_constraint
pg_catalog.pg_database only if required for safe server metadata without name output
information_schema only where the canonical fixed query requires it
```

No generic catalog explorer.

No user-selected catalog relation.

No `pg_stat_*`, `pg_auth*`, `pg_roles`, `pg_shadow`, `pg_user`, `pg_settings`, `pg_hba_*`, `pg_file_*`.

No comments.

No source-code or definition-returning functions such as:

```text
pg_get_viewdef
pg_get_functiondef
pg_get_triggerdef
pg_get_constraintdef
pg_get_expr
```

`pg_catalog.format_type` may be used to normalize a column data type.

## 14. Operation output semantics

### server

Return exactly safe version metadata:

```text
server_version
server_version_num
```

No:

```text
host
port
database
current_database
user
current_user
session_user
backend_pid
server_addr
server_port
```

### schemas

Return only existing names from configured `allowed_schemas`.

### tables

Return:

```text
schema
table
kind
```

Kind normalized to:

```text
table
partitioned_table
view
materialized_view
foreign_table
```

### columns

Return:

```text
schema
table
column
ordinal_position
data_type
nullable
has_default
generated
```

Do not return the default expression.

### indexes

Return:

```text
schema
table
index
unique
primary
columns
expression_index
```

Do not return index definition SQL or predicate expression.

### constraints

Return:

```text
schema
table
constraint
type
columns
referenced_schema?
referenced_table?
referenced_columns?
deferrable
initially_deferred
```

Constraint type normalizes to:

```text
primary_key
unique
foreign_key
check
exclusion
```

CHECK/exclusion expression text is not returned.

## 15. Output bounds

Envelope:

```ts
interface PostgresInspectionObservation {
  connection_id: string;
  operation: PostgresInspectOperation;
  items: unknown[];
  truncated: boolean;
  observed_at: string;
}
```

Bounds:

```text
items <= max_rows
query fetch <= max_rows + 1
serialized output <= max_output_bytes
metadata identifier <= 63 UTF-8 bytes
data_type <= 256 UTF-8 bytes
observed_at = UTC ISO-8601
```

If fetch returns `max_rows + 1`:

```text
items = first max_rows in canonical deterministic order
truncated = true
```

Output-byte overflow fails the whole invocation.

Do not silently byte-truncate JSON records.

## 16. Stable ordering

Every metadata SELECT includes a deterministic explicit ORDER BY appropriate to the operation.

Examples:

```text
schemas: schema
tables: schema, table, kind
columns: schema, table, ordinal_position, column
indexes: schema, table, index
constraints: schema, table, constraint
```

Provider normalization must not depend on server row arrival order.

## 17. No row-data boundary

S14H v1 must never read or return user table rows.

No production query may use an allowlisted application schema/table as a `FROM` data source.

Application relation names may appear only as catalog filter values.

A detector must fire if production SQL contains model-target table interpolation or data-select patterns.

## 18. Secret and diagnostic boundary

Secret values are forbidden from:

```text
ToolDescriptor
model input
normalized output
evidence refs
safe error
logs committed to git
verification report
STATE/CURRENT
Markdown artifacts
```

Do not expose raw node-postgres `Error` objects.

In particular, strip:

```text
message
detail
hint
where
position
internalPosition
internalQuery
schema
table
column
dataType
constraint
file
line
routine
stack
```

unless a fixed provider-owned normalized field explicitly permits it.

Safe messages are ASCII <=160 chars.

Connection_ref itself is not returned.

Tests use high-entropy sentinel credentials and prove absence from every result/error/evidence string.

## 19. Error mapping

Reuse existing Brain error codes.

Canonical mapping:

| Condition | Result |
|---|---|
| malformed/extra input | `FAIL / INVALID_INPUT / false` |
| schema outside allowlist | `FAIL / PERMISSION_DENIED / false` |
| missing/rejected connection resolver before deadline | `FAIL / PERMISSION_DENIED / false` |
| malformed resolved connection material | `FAIL / PERMISSION_DENIED / false` |
| authentication SQLSTATE 28xxx | `FAIL / PERMISSION_DENIED / false` |
| catalog privilege SQLSTATE 42501 | `FAIL / PERMISSION_DENIED / false` |
| DNS/TCP/TLS/connect unavailable | `FAIL / UNAVAILABLE / true` |
| deadline anywhere | `FAIL / TIMEOUT / true` |
| unsupported/malformed PostgreSQL response | `FAIL / INTERNAL_ERROR / false` |
| output overflow | `FAIL / EXECUTION_FAILED / false` |
| fixed inspection query execution failure not classified above | `FAIL / EXECUTION_FAILED / false` |

No hidden retry.

## 20. One monotonic deadline

One monotonic deadline starts at invocation entry.

Effective budget:

```text
min(request.timeout_ms, config.max_timeout_ms)
```

The same deadline covers:

```text
validation
resolver wait
connection-material validation
client creation
connect
BEGIN READ ONLY
read-only verification
metadata SELECT
normalization
output bounds
ROLLBACK
client.end
final success
```

The deadline is never reset.

Resolver/connect/query/cleanup Promise waits without AbortSignal must be bounded by the same deadline.

A timeout returns no partial output.

## 21. Resolver deadline

`PostgresConnectionResolver.resolve()` must be raced/bounded by the same invocation deadline.

A never-settling resolver cannot keep `invoke()` alive.

If deadline wins:

```text
TIMEOUT
retryable = true
```

A resolver rejection before deadline remains:

```text
PERMISSION_DENIED
retryable = false
```

Late resolver settlement/rejection is consumed and cannot mutate result or cause unhandled rejection.

## 22. Cleanup

Track:

```text
connected
transaction_started
```

Finally:

```text
if transaction_started:
  bounded best-effort ROLLBACK

if client created:
  bounded client.end()
```

A hanging rollback/end cannot keep `invoke()` pending beyond the bounded cleanup policy.

Cleanup failure cannot transform an already determined primary error into success.

No client survives legitimate completion.

No pool/background keepalive/resource survives.

## 23. Read-only does not mean no external effect

Descriptor remains:

```text
EXTERNAL
```

because DB connection/query activity is an external observable operation.

Do not downgrade to `NONE`.

Restricted denial of the capability or EXTERNAL class must produce:

```text
zero resolver call
zero client construction
zero network
zero SQL
```

## 24. Registry/provider swap invariant

Part B must prove:

```text
same AgentDefinition bytes
same capability_id = postgres.inspect
same semantic input
same permission policy

registry A:
postgres.inspect -> PgPostgresInspectProvider

registry B:
postgres.inspect -> independent compatible deterministic test provider
```

Both execute through actual Registry + Restricted + runAgent composition.

No Core/provider-specific branch.

## 25. Part B allowed scope

Part B may add/modify only:

```text
src/providers/capability/postgres/**
tests/postgres-capability/**
brain-bootstrap/reports/S14H-postgres-capability-verification.md
package.json
package-lock.json
```

Package manifests may change only for exact:

```text
pg = 8.23.0
@types/pg = 8.23.1
```

No other dependency/version drift.

Forbidden during Part B:

```text
src/core/**
AgentDefinition semantics
RestrictedCapabilityProvider
CapabilityRegistryProvider
brain-bootstrap/STATE.yaml
brain/context/CURRENT.md
S14A–S14G canonical artifacts/implementations/tests
S14I+
```

## 26. Test architecture

Canonical tests use a provider-private deterministic PostgreSQL driver/client factory seam.

The seam must simulate:

```text
resolver
connect
BEGIN
read-only verification
query
rows/fields
ROLLBACK
end
network/TLS/auth failures
SQLSTATE errors
hangs
late settlement
cleanup hangs
```

without public network.

The seam is provider-only; it never enters Core or AgentDefinition.

Production behavior must not branch on fixture IDs/expected outcomes.

## 27. Real PostgreSQL integration smoke

A real successful disposable PostgreSQL smoke is required before candidate readiness.

Part A integration performs only a host preflight and reports whether the environment already has one viable local mechanism:

```text
postgres + initdb binaries
docker
podman
```

Part B authorization must select one exact smoke mechanism from that factual preflight.

Real smoke requirements:

```text
local machine only
ephemeral/disposable database
no shared/company/public database
no user production/staging data
temporary credentials only
one allowed test schema
provider executes server/schemas/tables/columns/indexes/constraints
read-only transaction confirmed
known metadata returned
write attempt through provider impossible
cleanup succeeds
```

No system package installation without separate user authorization.

If no viable safe local PostgreSQL runtime exists:

```text
BLOCKED / POSTGRES_RUNTIME_UNAVAILABLE
```

Do not replace the smoke with a fake.

## 28. Canonical external facts frozen for v1

At 2026-09-10 authoring time:

```text
pg latest stable: 8.23.0
@types/pg latest: 8.23.1
node-postgres supports ESM
node-postgres Client uses environment variables for missing config fields
node-postgres supports parameterized queries
node-postgres Client supports connectionTimeoutMillis, statement_timeout and query_timeout
PostgreSQL supports BEGIN/START TRANSACTION READ ONLY
PostgreSQL system catalogs store schema metadata
```

These facts are frozen for S14H v1.

Package upgrades require controlled maintenance, never model selection.

## 29. Baseline failure policy

The **implementation baseline** is the exact S14H Part A integration SHA, not this semantic-authoring SHA.

Before Part B authorization:

1. mechanically integrate only the three canonical Part A files;
2. create a fresh WSL-native/ext4 worktree on that exact SHA;
3. use Node 24.19.x through NVM and Linux npm;
4. run `npm ci`;
5. `rm -rf dist`;
6. run the full existing suite;
7. capture raw counts, every failure identity and exact detector cause;
8. run a genuine build;
9. run the full suite again;
10. require exact pre/post identity/cause comparison;
11. separately preflight safe local PostgreSQL runtime availability.

Do not assume S14G's 35 failures remain the exact S14H baseline.

Do not inherit a wildcard failure allowance.

Do not edit historical tests or continuity files.

Windows `/mnt/c` is not canonical evidence for byte-sensitive tests.

## 30. Legacy harness compatibility policy

Adding `pg` and `@types/pg` in Part B will predictably trigger historical dependency guards.

No such failure is pre-authorized by this Part A.

After exact Part A baseline measurement, ChatGPT must separately author the precise Part B dependency compatibility allowance before coding, based on the actual baseline and the exact expected manifest change.

No builder may broaden an allowlist locally.

## 31. Part B verification requirements

Builder must prove at minimum:

```text
Node 24.19.x
pg exactly 8.23.0
@types/pg exactly 8.23.1
Part A byte identity
Core byte identity
AgentDefinition byte identity
S14A–S14G protected identity
dependency diff exact
postgres.inspect only / EXTERNAL
closed input/runtime validation
opaque connection_ref
resolver timeout semantics
explicit pg Client config with no env fallback
TLS policy enforcement
no connection string
fresh Client per invocation
no Pool/pg-native
fixed query registry
BEGIN TRANSACTION READ ONLY
fixed read-only verification
parameterized schema/table filters
no arbitrary SQL
no row data
no definition/source/comment leakage
operation-specific normalized output
deterministic ordering/truncation
output bounds
safe error mapping/no secret leak
one monotonic deadline
bounded rollback/end cleanup
Restricted denial before resolver/network
provider swap same AgentDefinition
canonical fixture/invariant/counter traceability
real disposable PostgreSQL integration smoke
full baseline/candidate pre-build comparison
real build
full candidate post-build comparison
git diff --check
no tracked DB data/socket/log/dump/credential artifact
```

## 32. Independent gate

After builder QA and ChatGPT source review:

```text
fresh session
non-authoring
non-builder
non-fork
read-only
exact committed remote candidate
fresh WSL-native/ext4 worktree
standalone verifier relay
separate ChatGPT acceptance
```

If accepted:

```text
S14H = PHASE_PASS / INTEGRATION_AUTHORIZED
S14 = IN_PROGRESS / NOT_CLOSED
S14I = NOT_AUTHORIZED
HI-054 = NOT_AWARDED
```
