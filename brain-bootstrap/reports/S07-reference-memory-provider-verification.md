# S07 — Reference MemoryProvider Implementation Verification

## Runtime

- Node: `v24.19.0` (installed/activated via `nvm install 24` / `nvm use 24`, isolated to the working shell — no global nvm default changed, no `.nvmrc` created, no sudo, no system-wide Node install modified)
- npm: `v11.17.0` (bundled with the nvm-installed Node 24)
- Activation evidence: `/home/yosman/.nvm/versions/node/v24.19.0/bin/node --version` → `v24.19.0`; confirmed by explicitly prepending that path to `PATH` for every command in this session.

## Dependencies Introduced

| Package | Version | Type | Justification |
|---|---|---|---|
| `better-sqlite3` | `13.0.3` | runtime | Explicitly authorized by `ADR-runtime-foundation.md` as the S07 reference-provider persistence library; synchronous API keeps the provider simple and deterministic; ships a prebuilt native binding (no compile step needed in this environment, verified below) |
| `typescript` | `7.0.2` | dev | Explicitly authorized language for the Brain runtime |
| `vitest` | `4.1.11` | dev | Explicitly authorized test runner |
| `@types/node` | `26.3.0` | dev | Type definitions for Node built-ins used (`node:crypto`, `node:fs`, `node:os`, `node:path`) |
| `@types/better-sqlite3` | `9.6.0` | dev | Type definitions for `better-sqlite3` (the package itself ships no `types` field) |

No other dependency was installed. No MCP SDK, web framework, ORM, vector/embedding library, agent framework, or Hermes package was added — confirmed by `npm ls --depth=0` showing exactly these 5 packages.

## Exact Runtime Paths Created

```
package.json
package-lock.json
tsconfig.json
src/core/memory/types.ts
src/core/memory/index.ts
src/providers/memory/localReferenceMemoryProvider.ts
tests/fakeMemoryProvider.ts
tests/memoryProvider.test.ts
```

No web frontend, HTTP server, ORM, MCP runtime, workflow engine, agent runtime, authentication, deployment stack, vector DB, or graph system was scaffolded.

## Contract Tests (T1–T10)

All executed via `npm test` (`vitest run`).

| Test | Result | Notes |
|---|---|---|
| T1 — Durable fact | **PASS** | Candidate with `VERIFIED` status committed; `retrieve()` returns it by content match |
| T2 — Fresh provider instance | **PASS** | Provider closed and a brand-new instance opened against the same on-disk temp database file; committed fact still retrievable |
| T3 — Cold history | **PASS** | Content seeded via `recordHistory()` (reference-adapter-only helper, not part of the Core contract) does not appear in `retrieve()`, but is found by `search_history()` |
| T4 — Candidate isolation | **PASS** | A bare `remember_candidate()` call never appears in `retrieve()` results |
| T5 — Promotion gate | **PASS** | `ASSUMED`, `PROPOSED`, `UNKNOWN`, `BLOCKED` all rejected with `INVALID_REQUEST`; `PROVIDED` rejected without provenance, accepted with explicit provenance (per `MEMORY_PROVIDER.md` §3.3's authority rule) |
| T6 — Explicit VERIFIED promotion | **PASS** | Content absent from `retrieve()` before commit, present after `commit_verified_memory()` succeeds |
| T7 — Disabled provider | **PASS** | All 4 methods return `DISABLED`/`NOT_PERSISTED` + `DISABLED` availability; `existsSync(dbPath)` confirmed `false` — no database file was ever created |
| T8 — Substitution boundary | **PASS** | The same Core-facing assertion function ran unmodified against both `LocalReferenceMemoryProvider` and a minimal in-memory `FakeMemoryProvider` (test-only, `tests/fakeMemoryProvider.ts`) |
| T9 — No storage leakage | **PASS** | Mechanical scan of every `.ts` file under `src/core/` for the tokens `better-sqlite3`, `sqlite`, `fts5`, `create table`, `select `, `insert into` (case-insensitive) found zero matches |
| T10 — Bounded search | **PASS** | 5 history records inserted; `search_history()` called with `limit: 2`; result length ≤ 2 |

**Full run:** `Test Files 1 passed (1)`, `Tests 16 passed (16)` (T5 and T8 each contribute multiple assertions/sub-cases).

## FTS5 Verification Evidence

```
$ node -e "const db=new (require('better-sqlite3'))(':memory:'); db.exec('CREATE VIRTUAL TABLE t USING fts5(c)'); console.log('FTS5 available: true')"
FTS5 available: true
```

Also exercised indirectly by every `search_history()`-touching test (T3, T10) using the real `history_fts` virtual table. The provider's constructor wraps schema initialization in a try/catch (`initializeSchema`); on failure it closes the database, records `unavailableReason`, and leaves `this.db === null`, which the `unavailability()` guard reports as `UNAVAILABLE` (not `DISABLED`) to every one of the four methods — this path was implemented per the S07 instruction to fail closed rather than silently degrade to loading all history in memory, though it was not exercised by a live test here since this environment's SQLite build does have FTS5.

A real-world caveat worth naming as evidence discipline: the initial implementation queried `history_fts MATCH ?` with the raw caller-supplied string. This failed for input containing a hyphen (`SqliteError: no such column: db` on the query `"vector-db-vs-keyword-search"`) because FTS5's `MATCH` operator has its own query-expression syntax where `-` and `:` are meaningful. Fixed by wrapping the caller's query as an escaped FTS5 phrase (`toFts5PhraseQuery`) before passing it to `MATCH`, so `search_history()` always performs literal-phrase matching rather than exposing FTS5's query-expression syntax to callers. This was caught by T3 failing on first run, root-caused, and fixed — recorded here rather than silently smoothed over.

## Disabled-Mode Evidence

Covered by T7 (above). Additionally confirmed by code inspection: the constructor only calls `new Database(...)` inside `if (this.enabled)` — when `enabled: false` is passed, no `Database` instance is ever constructed, so no file-system side effect can occur regardless of what `databasePath` was given.

## Persistence-Across-New-Instance Evidence

Covered by T2 (above): a real on-disk SQLite file (in a `mkdtempSync`-created temp directory, not inside the repository or `$HOME`) is written by one provider instance, that instance is explicitly `.close()`d, a second independent `LocalReferenceMemoryProvider` is constructed against the same file path, and it retrieves the same committed fact — demonstrating real cross-process-shaped persistence, not just in-memory state reuse.

## Substitution-Boundary Evidence

Covered by T8 (above). The shared assertion helper (`exerciseCoreBehavior`) is typed against the `MemoryProvider` interface only and calls exactly the four canonical methods; it is invoked once with `LocalReferenceMemoryProvider` and once with `FakeMemoryProvider` without any conditional logic distinguishing them, and both pass identically.

## No-Storage-Leakage Evidence

Covered by T9 (above), executed mechanically as part of the automated test suite (not just a manual grep at write-time) so it will catch future regressions automatically.

## Commands Executed

```
$ nvm install 24 && nvm use 24                     → Node v24.19.0 activated (this shell only)
$ npm init -y                                       → package.json scaffolded, then hand-edited to name/type/scripts
$ npm install better-sqlite3                        → added, 0 vulnerabilities
$ npm install -D typescript vitest @types/node @types/better-sqlite3
$ node -e "...better-sqlite3(':memory:')..."        → confirmed native binding loads without a build step
$ node -e "...CREATE VIRTUAL TABLE ... fts5..."     → confirmed FTS5 works
$ npm run typecheck  (tsc --noEmit)                 → 0 errors
$ npm test           (vitest run)                   → 16/16 passed
$ npm run build      (tsc -p tsconfig.json)          → succeeded, emitted to dist/ (gitignored)
$ git status --porcelain=v1 / git diff --stat        → reviewed, only expected files touched
$ find ... -iname "*.db"                             → no stray database files in the repo
$ grep ... (secrets, user-home paths, Hermes deps)   → all clean
```

## Limitations

- The reference provider's `retrieve()` uses a simple `LIKE '%query%'` substring match over the small durable-memory table, not FTS5 — this is intentional (durable memory is meant to stay small per S07's governing rule; FTS5 is reserved for `search_history()`'s larger historical corpus) but means `retrieve()` is not a semantic/fuzzy search.
- `recordHistory()` is a reference-adapter-only method, not part of the `MemoryProvider` Core contract — there is currently no Brain-level mechanism that feeds real session history into it; that integration (likely via a future SessionStore Provider or S06 Handoff pipeline) is out of scope for S07.
- The `UNAVAILABLE` (FTS5-missing) code path is implemented and structurally exercised via the same `unavailability()` guard as `DISABLED`, but was not exercised by a dedicated failing-FTS5 test, since forcing a real SQLite build without FTS5 in this environment was not attempted (out of scope / would require a different native binary).
- `package-lock.json` pins exact resolved versions but was generated from whatever the npm registry served during this session; no additional pinning/audit step (e.g. `npm audit`) beyond npm's own install-time vulnerability report (0 found) was run.

## Remaining Open Issues

- None blocking for S07 itself. `package.json`, `package-lock.json`, `tsconfig.json`, `src/`, and `tests/` are new, untracked, and **not committed** — no commit/push was performed per instruction.
- `S07_Architecture_Decision_Hermes_Role.md` and `S07_Runtime_Foundation_Decision.md` remain as untracked temporary transfer files at the repo root (the former was already noted as not-yet-cleaned in the prior turn since it wasn't named in that cleanup instruction; the latter has not been evaluated for cleanup yet either) — left for the user/closure checkpoint to handle explicitly, consistent with the established pattern for these files.
