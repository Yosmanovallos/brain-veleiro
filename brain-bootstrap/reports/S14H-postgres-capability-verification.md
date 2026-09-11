# S14H PostgreSQL Inspect Capability — Part B Builder Verification

Date: 2026-09-10
Worktree: `/home/yosman/s14h-part-b`
Branch: `s14h-postgres-capability-part-b`

## Implemented files

Production provider:

- `src/providers/capability/postgres/types.ts`
- `src/providers/capability/postgres/descriptors.ts`
- `src/providers/capability/postgres/validation.ts`
- `src/providers/capability/postgres/queries.ts`
- `src/providers/capability/postgres/pgClientFactory.ts`
- `src/providers/capability/postgres/postgresCapabilityProvider.ts`
- `src/providers/capability/postgres/index.ts`

Verification:

- `tests/postgres-capability/helpers.ts`
- `tests/postgres-capability/canonicalCases.ts`
- `tests/postgres-capability/audit.ts`
- `tests/postgres-capability/positiveFixtures.test.ts`
- `tests/postgres-capability/negativeFixtures.test.ts`
- `tests/postgres-capability/hardInvariants.test.ts`
- `tests/postgres-capability/unsafeCounters.test.ts`
- `tests/postgres-capability/canonicalTraceability.test.ts`
- `tests/postgres-capability/realPostgresSmoke.test.ts`
- `tests/postgres-capability/envFallback.test.ts`

## Design correspondence

- Contract §§2–5: one static `postgres.inspect` / `EXTERNAL` descriptor; closed runtime input and exact six-operation matrix.
- §§6–7: copied/frozen provider configuration, exact key validation, schema restrictions, opaque resolver, bounded structured connection material, and loopback/verify-full TLS policy.
- §§9–13, 17: fresh explicitly configured `pg.Client`, disabled pipeline/keepalive/environment option fallback, fixed read-only command/query registry, parameter-only scope, qualified catalog reads, and no row-data query surface. Environment fallback is disabled with explicit connection fields, the non-empty provider-owned startup option `-c default_transaction_read_only=on`, and provider-owned `sslnegotiation: "postgres"`. `ssl` was already immune to `PGSSLMODE` because node-postgres uses an undefined check and the provider always supplies `ssl`. The hostile-all-`PG*` regression in `envFallback.test.ts` constructs the real installed `pg@8.23.0` `Client` from the exact captured production options and verifies the effective values.
- §§14–16: closed operation-specific normalization, identifier/type bounds, deterministic provider-side ordering, `max_rows + 1` truncation, and atomic serialized-output bound.
- §§18–22: fixed safe diagnostics, SQLSTATE/network mapping, one monotonic deadline, contained late promises, and bounded `ROLLBACK` then `end()` cleanup. `PgClientFactory` synchronously installs a client `error` listener that retains only a fatal boolean; wrapper operation gates and the provider's final success gate normalize that state to retryable `UNAVAILABLE`. Regressions cover a real `pg.Client` error emission without uncaught/raw-error escape and a deterministic provider path that cannot resurrect `SUCCESS` while preserving cleanup.
- §§23–24: restricted denial before resolver/client and actual Registry + Restricted + `runAgent` composition/provider compatibility tests. `FX-POS-011` and `S14H-HI-029` each execute both the real provider and an independently implemented compatible provider through `compileAgentDefinition` → `RestrictedCapabilityProvider` → `CapabilityRegistryProvider` → `runAgent`, with the same byte-identical frozen `AgentDefinition`.

## Canonical inventory

- Positive fixtures: 12 IDs implemented; 11 pass under the deterministic harness and canonical `FX-POS-012` is executable inside the gated real-smoke file.
- Negative fixtures: 26/26 pass.
- Hard invariants: 31 pass under the deterministic harness and canonical `S14H-HI-031` is executable inside the gated real-smoke file.
- Unsafe counters: 10/10 are zero on production and independently fireable.
- Traceability oracle: exact YAML-to-executable ID-set equality passes.

## QA evidence

- Runtime: Node `v24.19.0`, npm `11.17.0`.
- `npm run typecheck`: PASS on the repaired source.
- `npx vitest run tests/postgres-capability`: PASS — 7 files passed, 1 environment-gated file skipped; 85 tests passed, 2 skipped.
- `npx vitest run tests/postgres-capability --reporter=json`: PASS — 87 total, 85 passed, 2 skipped, 0 failed.
- Timing-sensitive focused suite: PASS for 10 consecutive runs; every run reported 85 passed, 2 skipped.
- `git diff --check`: PASS.
- Scope inspection: new implementation/test/report files are only in the authorized S14H paths. `package.json` and `package-lock.json` already contain the control-plane-provided exact `pg@8.23.0` and `@types/pg@8.23.1` changes; the builder did not edit or install dependencies.
- Protected surfaces: no Core, Registry, Restricted, Part A, S14A–S14G, STATE, CURRENT, or S14I+ file was edited.

## Real smoke facts

- Docker is not available in this WSL coding-worker environment, so no new live-database claim is made for this repaired candidate.
- A control-plane run against disposable PostgreSQL 16.15 established that `name[]` catalog aggregates arrived through node-postgres as array-literal strings. The fixed indexes/constraints queries now cast those values to `text[]`; deterministic regressions retain strict rejection of array-literal strings.
- Both canonical executable tests, `FX-POS-012` (all six operations) and `S14H-HI-031` (a real server observation), live in `realPostgresSmoke.test.ts`, are gated on `S14H_PG_REAL_SMOKE=1`, and consume only the five specified `S14H_PG_*` connection environment variables. The exact-ID traceability oracle now scans this file.
- Control-plane re-run on the repaired candidate: PENDING. The control plane will re-execute the disposable PostgreSQL smoke.

## Known limitation / remaining external gate

The prior candidate's disposable PostgreSQL smoke passed after the SQL array casts. This repaired candidate still requires the explicitly pending control-plane smoke re-run. No credentials are recorded here.
