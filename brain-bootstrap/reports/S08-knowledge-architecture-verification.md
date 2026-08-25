# S08 — Knowledge Layer Verification

## Artifacts Integrated (verbatim from ChatGPT authoring, `S08_Brain_Knowledge_Architecture_Artifacts.md`)

- `brain-bootstrap/specs/KNOWLEDGE_ARCHITECTURE_v1.md`
- `brain-bootstrap/decisions/ADR-notion-knowledge-adapter.md`
- `knowledge/index.md`
- `knowledge/sources/README.md`
- `knowledge/concepts/README.md`
- `knowledge/decisions/README.md`
- `knowledge/architecture-patterns/README.md`
- `knowledge/agent-patterns/README.md`
- `knowledge/failure-modes/README.md`

The author's "Illustrative Example" (Section 19 of `KNOWLEDGE_ARCHITECTURE_v1.md`) was explicitly marked "guidance only" and was **not** materialized as a repo file — consistent with the handoff prompt's non-goal that a real ingest exercise, not an illustrative one, is Claude Code's responsibility.

## Required Verification Exercise (per S08 step contract: "Ingerir una fuente pequeña, producir knowledge artifact citado, recuperarlo para una consulta y demostrar que la fuente original no cambió")

A real, already-VERIFIED repository fact was used as the small source — not fabricated content — per principle 2 ("No PASS sin evidencia") and the Context Authority rule that repository evidence outranks inference.

### 1. Ingest

Source: `brain-bootstrap/reports/S07-reference-memory-provider-verification.md`, section "FTS5 Verification Evidence" (already committed at `3d3bf8687b98013f3ab9c5e9b1ff955deb079851`).

Origin hash before snapshotting:
```
f215c66886cd7db02de076782b1b8cc19b3b21052fcc02ad2033b7a5d3d82a17
```

Snapshot created at `knowledge/sources/s07-fts5-match-hyphen-bug-source.md`, quoting the paragraph verbatim and recording `origin_sha256` in its frontmatter.

### 2. Compile

Cited Knowledge artifact created at `knowledge/failure-modes/fts5-match-syntax-collision.md`, with full frontmatter per the `KNOWLEDGE_ARCHITECTURE_v1.md` §6 metadata contract (`id`, `kind`, `epistemic_status: VERIFIED`, `provenance.source_refs` pointing at the snapshot, `validity.state: CURRENT`, `revalidate_when`).

### 3. Retrieve by query (bounded)

```
$ grep -rl -i "fts5" knowledge/ --include="*.md"
knowledge/failure-modes/fts5-match-syntax-collision.md
knowledge/sources/s07-fts5-match-hyphen-bug-source.md

$ grep -rl -i "hyphen" knowledge/ --include="*.md"
knowledge/failure-modes/fts5-match-syntax-collision.md
knowledge/sources/s07-fts5-match-hyphen-bug-source.md
```

Result: exactly the compiled artifact and its cited source were returned — not the 7 other unrelated `knowledge/` files (index + 6 category READMEs) — demonstrating bounded retrieval per §11/§12 and the S05 rule "Do not load a complete wiki or knowledge base into the Context Pack."

### 4. Prove the original source is unchanged

```
$ sha256sum brain-bootstrap/reports/S07-reference-memory-provider-verification.md
f215c66886cd7db02de076782b1b8cc19b3b21052fcc02ad2033b7a5d3d82a17
```

Identical to the pre-ingest hash. The snapshot's declared `origin_sha256` also matches. **PASS.**

## Mechanical Checks

| Check | Result |
|---|---|
| "OPTIONAL HUMAN-FACING KNOWLEDGE SURFACE / ADAPTER" language present in both spec and ADR | PASS |
| Notion explicitly listed as NOT a Core dependency / NOT canonical source of truth | PASS |
| No Notion/wiki SDK or package added (`package.json`/`package-lock.json` diff empty for this step) | PASS |
| `npm run typecheck` | PASS (0 errors) |
| `npm test` | PASS (16/16, unchanged from S07 — S08 is docs-only, no `src/`/`tests/` changes) |
| Knowledge/KnowledgeProvider definitions reused verbatim from S01/S02, not redefined | PASS (manual diff against `BRAIN_VOCABULARY_v0.2.md` and `BRAIN_CORE_BOUNDARIES.md`) |
| Bounded-retrieval rule reused verbatim from S05 | PASS (`CONTEXT_ARCHITECTURE_v1.md` §5 "compiled knowledge" quoted correctly in `KNOWLEDGE_ARCHITECTURE_v1.md` §11) |
| Raw-source immutability mechanically demonstrated (not just asserted) | PASS (hash comparison above) |
| 6 `knowledge/` subdirectories have non-overlapping, distinct stated purposes | PASS (manual read of all 6 READMEs — each explicitly excludes the others' scope, e.g. `decisions/README.md` explicitly says "It does not replace ADRs", `concepts/README.md` explicitly excludes "ADRs; failure reports; architecture-pattern guidance; raw source files") |

## PASS Criteria (from S08 step contract)

> "Knowledge puede consultarse sin cargar la base completa y Notion puede desconectarse sin romper Brain."

- Knowledge consultable without loading the full base: demonstrated above (bounded `grep` retrieval).
- Notion can disconnect without breaking Brain: structurally true by construction — nothing in `src/core/` or `src/providers/memory/` (the only runtime code that exists as of S07) references Notion at all; `KNOWLEDGE_ARCHITECTURE_v1.md` and the ADR both explicitly mandate Notion-disconnected operation (§14 / Consequences); no KnowledgeProvider adapter (Notion-backed or otherwise) has been implemented yet, so there is no runtime dependency to disconnect from in the first place — this remains a **structural/architectural PASS**, with concrete Notion-adapter code deferred to a future step as explicitly scoped by the ChatGPT authoring's non-goals.

## Open Issues

- No `KnowledgeProvider` interface/implementation exists yet in `src/` — S08 was scoped as architecture-only (mirroring S07 Part A vs Part B), consistent with the handoff prompt's explicit non-goal "Do not design the concrete KnowledgeProvider adapter/implementation code."
- `S07_Closure_Checkpoint.md` and `S08_Brain_Knowledge_Architecture_Artifacts.md` remain as untracked transfer files at the repo root — left for the closure checkpoint to evaluate for cleanup, consistent with established practice.
