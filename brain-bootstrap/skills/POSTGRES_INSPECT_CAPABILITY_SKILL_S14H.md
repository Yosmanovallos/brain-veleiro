# S14H — PostgreSQL Inspect Capability Skill

Version 1.0.0 · AUTHORING_READY · RUNTIME_INFRASTRUCTURE / DEEP.  
Semantic-authoring baseline: `8edd55a6b95e1b3c71ce07b342ea6348a70cac6b`.

## Objective

Implement S14H as a **bounded, metadata-only PostgreSQL inspection provider** behind the existing `CapabilityProvider` and `CapabilityRegistryProvider` boundaries.

S14H v1 exposes exactly one semantic capability:

```text
postgres.inspect
```

The capability exists to let Brain understand the structure of a trusted PostgreSQL database without granting arbitrary SQL or row-data access.

S14H v1 is intentionally **not** a SQL execution capability.

It does not expose:

```text
postgres.query
postgres.execute
database.query
database.write
DDL
DML
COPY
LISTEN/NOTIFY
functions/procedures
row sampling
table contents
view definitions
trigger bodies
stored code
roles/grants
settings
statistics
extensions
large objects
logical replication
```

Normative semantics:
`brain-bootstrap/specs/POSTGRES_INSPECT_CAPABILITY_CONTRACT_S14H.md`

Executable quality inventory:
`brain-bootstrap/quality-contracts/S14H_POSTGRES_INSPECT_CAPABILITY_DEEP.yaml`

A contradiction among canonical Part A artifacts returns:

```text
CHATGPT_AUTHORING_REQUIRED
```

## Inherited architecture

Preserve without semantic change:

- `CapabilityProvider`;
- `ToolDescriptor`;
- `ToolInvocationRequest`;
- `ToolInvocationResult`;
- `RestrictedCapabilityProvider`;
- `CapabilityRegistryProvider`;
- provider-neutral `AgentDefinition`;
- all accepted S14A–S14G implementations and canonical artifacts;
- side-effect classes `NONE | LOCAL | EXTERNAL`.

No PostgreSQL/vendor identity enters `AgentDefinition`.

## Exact capability

```text
postgres.inspect
side_effects = EXTERNAL
```

`EXTERNAL` is mandatory because the provider connects to an external database service even though its SQL surface is read-only.

## Exact v1 input

```ts
type PostgresInspectOperation =
  | "server"
  | "schemas"
  | "tables"
  | "columns"
  | "indexes"
  | "constraints";

interface PostgresInspectInput {
  operation: PostgresInspectOperation;
  schema?: string;
  table?: string;
}
```

Operation rules:

```text
server:
  schema forbidden
  table forbidden

schemas:
  schema forbidden
  table forbidden

tables:
  schema optional
  table forbidden

columns:
  schema required
  table required

indexes:
  schema required
  table required

constraints:
  schema required
  table required
```

There is no model-supplied SQL, limit, host, database, user, password, SSL setting, search path or connection string.

## Provider configuration

Reference provider-layer shape:

```ts
interface PostgresInspectProviderConfig {
  connection_id: string;
  connection_ref: string;
  allowed_schemas: string[];
  max_timeout_ms: number;
  max_rows: number;
  max_output_bytes: number;
}

interface PostgresConnectionResolver {
  resolve(connection_ref: string): Promise<PostgresConnectionMaterial>;
}
```

`connection_ref` is opaque and provider-private.

`PostgresConnectionMaterial` is resolved only inside the provider boundary and contains structured connection material. It is never returned to the model.

The model cannot select or override:

```text
host
port
database
user
password
connection string
SSL/TLS
CA
servername
application_name
pool size
keepalive
query timeout
statement timeout
search_path
startup options
driver
native libpq
socket path
retry policy
```

## Connection decision

S14H v1 uses a fresh `pg.Client` per invocation.

It does **not** use:

```text
Pool
pg-native
libpq
environment-derived PGHOST/PGUSER/PGPASSWORD/PGDATABASE
connection-string query parameters
persistent sessions
shared transactions
```

Every connection field used by `pg.Client` must be supplied explicitly from validated provider-private material so node-postgres cannot fall back to environment variables.

## Read-only transaction

A successful inspection executes inside:

```sql
BEGIN TRANSACTION READ ONLY
```

followed by exactly one provider-owned fixed metadata `SELECT`, followed by:

```sql
ROLLBACK
```

No model-supplied SQL text is accepted.

No query string is built by concatenating model data.

Schema/table values are parameters only.

All catalog references are provider-owned and schema-qualified.

## Metadata-only surface

`postgres.inspect` may return only bounded structural metadata.

### server

Safe version metadata only:

```text
server_version
server_version_num
```

No host, database, user, address, backend PID or credential information.

### schemas

Only configured `allowed_schemas` that actually exist.

### tables

Bounded relation metadata under configured schemas:

```text
schema
table
kind
```

Canonical kinds:

```text
table
partitioned_table
view
materialized_view
foreign_table
```

### columns

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

The default expression itself is never returned.

### indexes

```text
schema
table
index
unique
primary
columns
expression_index
```

Raw `pg_get_indexdef()` output is forbidden.

### constraints

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

CHECK expressions and raw constraint definitions are forbidden.

## Output envelope

```ts
interface PostgresInspectionObservation {
  connection_id: string;
  operation: PostgresInspectOperation;
  items: unknown[];
  truncated: boolean;
  observed_at: string;
}
```

Items are operation-specific closed normalized records.

The provider never returns:

```text
host
port
database name
database user
password
connection_ref
connection string
SSL material
raw SQL
raw PostgreSQL error
SQLSTATE detail/hint/where
table row values
comments
default expressions
view definitions
function bodies
trigger bodies
role/grant data
server settings beyond safe version metadata
```

## Trusted schema boundary

`allowed_schemas` is trusted host-side configuration.

Model-supplied `schema` must exactly match one configured schema.

S14H v1 rejects configured system schemas:

```text
pg_catalog
information_schema
pg_toast
pg_temp*
pg_toast_temp*
```

No wildcard schema permission.

## Dependency decision

S14H Part B may add exactly:

```text
pg@8.23.0
@types/pg@8.23.1
```

with exact pins.

`pg` is runtime; `@types/pg` is dev-only.

No `pg-native`.

No other dependency/version drift.

Part A itself changes no package manifest.

## Deadline

One monotonic invocation deadline begins at `invoke()` entry and covers:

```text
input validation
connection_ref resolution
connection-material validation
pg Client creation
connect
BEGIN READ ONLY
metadata SELECT
normalization
output bounds
ROLLBACK/cleanup
final success gate
```

Where node-postgres lacks AbortSignal support, awaited work is bounded by the same provider deadline/controller.

The deadline never resets.

No hidden retry.

## Cleanup

Every invocation creates at most one client.

On all paths:

```text
best-effort ROLLBACK if transaction started
client.end()
```

must be attempted under bounded cleanup.

A hung resolver/connect/query/rollback/end cannot keep `invoke()` pending indefinitely.

Late settlement cannot mutate an already returned result or leak an unhandled rejection.

## Real PostgreSQL smoke

Part B candidate readiness requires one successful **disposable local PostgreSQL** smoke if a permitted local runtime is available.

The Part A integration step must first report whether the host already provides any of:

```text
postgres + initdb
docker
podman
```

No Part A installation.

Part B smoke provisioning must be separately authorized from the observed host facts.

Never use:

```text
shared production/staging database
public internet database
company database
user personal database
sudo
apt/apt-get
brew
system package mutation
```

If no safe disposable local PostgreSQL runtime is available, return `BLOCKED` for the real-smoke gate instead of faking success.

## Explicitly deferred

Not in S14H v1:

```text
arbitrary SELECT
row sampling
EXPLAIN
EXPLAIN ANALYZE
write SQL
DDL
DML
COPY
prepared statements chosen by model
stored procedure/function execution
LISTEN/NOTIFY
logical replication
database creation/drop
role/grant management
schema creation/drop
migration execution
connection pooling
SSH tunnels
cloud IAM database auth
RDS/Azure/GCP token generation
proxy selection
multi-database discovery
cross-database access
```

## Phase lifecycle

```text
Part A authored
→ mechanical Part A integration
→ exact post-Part-A baseline measurement
→ safe local-Postgres runtime preflight
→ separate Part B authorization
→ builder candidate
→ ChatGPT source review
→ fresh independent verifier
→ separate ChatGPT acceptance
→ docs-only phase closure
```

A phase PASS leaves:

```text
S14H = PHASE_PASS
S14 = IN_PROGRESS / NOT_CLOSED
S14I = NOT_AUTHORIZED
HI-054 = NOT_AWARDED
```
