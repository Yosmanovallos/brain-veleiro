---
source_id: source.brain.s07-fts5-hyphen-bug
type: repository-evidence-snapshot
locator: brain-bootstrap/reports/S07-reference-memory-provider-verification.md (## FTS5 Verification Evidence)
retrieved_at: 2026-08-25T12:00:00Z
authority: primary
origin_sha256: f215c66886cd7db02de076782b1b8cc19b3b21052fcc02ad2033b7a5d3d82a17
---

Verbatim excerpt from `brain-bootstrap/reports/S07-reference-memory-provider-verification.md`, section "FTS5 Verification Evidence" (already committed at commit `3d3bf8687b98013f3ab9c5e9b1ff955deb079851`):

> A real-world caveat worth naming as evidence discipline: the initial implementation queried `history_fts MATCH ?` with the raw caller-supplied string. This failed for input containing a hyphen (`SqliteError: no such column: db` on the query `"vector-db-vs-keyword-search"`) because FTS5's `MATCH` operator has its own query-expression syntax where `-` and `:` are meaningful. Fixed by wrapping the caller's query as an escaped FTS5 phrase (`toFts5PhraseQuery`) before passing it to `MATCH`, so `search_history()` always performs literal-phrase matching rather than exposing FTS5's query-expression syntax to callers. This was caught by T3 failing on first run, root-caused, and fixed — recorded here rather than silently smoothed over.

This is an immutable snapshot of already-VERIFIED repository evidence. It must not be edited; if the originating report changes, a new source snapshot with a new `source_id` must be created instead.
