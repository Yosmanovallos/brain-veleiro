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

## Design correspondence

- Contract §§2–5: one static `postgres.inspect` / `EXTERNAL` descriptor; closed runtime input and exact six-operation matrix.
- §§6–7: copied/frozen provider configuration, exact key validation, schema restrictions, opaque resolver, bounded structured connection material, and loopback/verify-full TLS policy.
- §§9–13, 17: fresh explicitly configured `pg.Client`, disabled pipeline/keepalive/environment option fallback, fixed read-only command/query registry, parameter-only scope, qualified catalog reads, and no row-data query surface.
- §§14–16: closed operation-specific normalization, identifier/type bounds, deterministic provider-side ordering, `max_rows + 1` truncation, and atomic serialized-output bound.
- §§18–22: fixed safe diagnostics, SQLSTATE/network mapping, one monotonic deadline, contained late promises, and bounded `ROLLBACK` then `end()` cleanup.
- §§23–24: restricted denial before resolver/client and actual Registry + Restricted + `runAgent` composition/provider compatibility tests.

## Canonical inventory

- Positive fixtures: 12 IDs implemented; 11 pass under the deterministic harness and `FX-POS-012` is gated with the real smoke.
- Negative fixtures: 26/26 pass.
- Hard invariants: 32/32 pass.
- Unsafe counters: 10/10 are zero on production and independently fireable.
- Traceability oracle: exact YAML-to-executable ID-set equality passes.

## QA evidence

- Runtime: Node `v24.19.0`, npm `11.17.0`.
- `npm run typecheck`: PASS.
- `npx vitest run tests/postgres-capability`: PASS after the PostgreSQL-array and smoke-oracle fixes — 6 files passed, 1 environment-gated file skipped; 83 tests passed, 2 skipped (the canonical real-smoke fixture and real-smoke file).
- Deadline-sensitive negative + hard-invariant families: PASS for 10 consecutive runs, 58/58 tests each run.
- `git diff --check`: PASS.
- Scope inspection: new implementation/test/report files are only in the authorized S14H paths. `package.json` and `package-lock.json` already contain the control-plane-provided exact `pg@8.23.0` and `@types/pg@8.23.1` changes; the builder did not edit or install dependencies.
- Protected surfaces: no Core, Registry, Restricted, Part A, S14A–S14G, STATE, CURRENT, or S14I+ file was edited.

## Real smoke facts

- Host preflight: `docker` is available; `postgres`, `initdb`, and `podman` were not found.
- A control-plane run against disposable PostgreSQL 16.15 established that `name[]` catalog aggregates arrived through node-postgres as array-literal strings. The fixed indexes/constraints queries now cast those values to `text[]`; deterministic regressions retain strict rejection of array-literal strings.
- The test is gated on `S14H_PG_REAL_SMOKE=1` and consumes only the five specified `S14H_PG_*` connection environment variables.
- Control-plane image ID: `sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685` (local `postgres:16-alpine`, `--pull=never`, run by immutable ID)
- Control-plane image digest: `postgres@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`
- Control-plane smoke result: PASS against disposable PostgreSQL 16.15; all six operations returned successful, normalized observations.

## Known limitation / remaining external gate

The real disposable PostgreSQL smoke was run by the control plane and passed after the SQL array casts and smoke-oracle correction. No credentials are recorded here.
