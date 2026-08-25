---
id: knowledge.failure-mode.fts5-match-syntax-collision
title: SQLite FTS5 MATCH treats free-text characters as query syntax
kind: failure-mode

epistemic_status: VERIFIED

provenance:
  source_refs:
    - knowledge/sources/s07-fts5-match-hyphen-bug-source.md
  compiled_by: agent
  compiled_at: 2026-08-25T12:05:00Z
  evidence_refs:
    - brain-bootstrap/reports/S07-reference-memory-provider-verification.md

validity:
  state: CURRENT
  last_checked_at: 2026-08-25T12:05:00Z
  valid_until: null
  revalidate_when:
    - the MemoryProvider reference adapter changes its search_history() implementation
    - the underlying SQLite/FTS5 version changes

supersedes: []
superseded_by: []
tags:
  - sqlite
  - fts5
  - search
  - provider-implementation-detail
---

# SQLite FTS5 MATCH Syntax Collision

## Symptom

A full-text search query using SQLite FTS5's `MATCH` operator throws a syntax error (e.g. `SqliteError: no such column: db`) for ordinary free-text input that happens to contain a hyphen or colon.

## Cause

FTS5's `MATCH` operator does not treat the query string as literal text. It parses it as an FTS5 query expression, where characters such as `-` (column filter / NOT) and `:` (column specifier) carry special meaning. A caller-supplied string like `vector-db-vs-keyword-search` is interpreted as query syntax, not as a phrase to search for.

## Detection

Caught by an automated contract test (T3 in the `MemoryProvider` reference-adapter test suite) that exercises `search_history()` with realistic free-text content containing hyphens.

## Impact

Any provider or caller that passes raw, unescaped user/agent text directly into an FTS5 `MATCH` clause is at risk of spurious syntax errors on ordinary input — this is not an edge case, it is common in real free-text queries (compound terms, slugs, technical phrases).

## Prevention / Mitigation

Wrap the caller-supplied query as an escaped FTS5 phrase (a quoted literal) before passing it to `MATCH`, so the search always performs literal-phrase matching instead of exposing FTS5's query-expression syntax to callers. Reference implementation: `toFts5PhraseQuery()` in `src/providers/memory/localReferenceMemoryProvider.ts`.

## Related Patterns / Decisions

- `brain-bootstrap/specs/MEMORY_PROVIDER.md` (`search_history()` contract)
- `brain-bootstrap/decisions/ADR-hermes-memory-role.md` (LocalReferenceMemoryProvider as the approved reference adapter)

## Source

Derived from a verified, already-committed repository evidence snapshot:
`knowledge/sources/s07-fts5-match-hyphen-bug-source.md`
