# ADR — Notion as Optional Human Knowledge Surface

**Status:** Proposed — pending S08 integration and verification

## Context

Brain requires a reusable Knowledge layer that humans can inspect and contribute to.

A human-facing workspace such as Notion can provide a convenient authoring/review surface.

However, Brain's Core/Provider architecture requires provider substitution.

The S02 substitution test already established that the Core must not know whether Knowledge came from Notion or another repository.

S08 also requires Brain to continue functioning when Notion is disconnected.

## Decision

Brain adopts:

```text
Markdown + Git
```

as the canonical portable representation of compiled Knowledge.

Notion is classified as:

```text
OPTIONAL HUMAN-FACING KNOWLEDGE SURFACE / ADAPTER
```

Notion is not:

- a Brain Core dependency;
- required runtime infrastructure;
- the canonical source of truth for compiled Knowledge;
- the only place Knowledge may be authored or reviewed.

Human-authored Notion content may be imported, cited, compiled, and reviewed into canonical Markdown/Git Knowledge.

Canonical Knowledge may also be published outward to Notion for human consumption.

The Core depends only on Knowledge/KnowledgeProvider contracts.

## Architecture

```text
                 humans
                   │
                   ▼
                Notion
                   │
          optional adapter/sync
                   │
                   ▼
          Markdown/Git Knowledge
                   │
            KnowledgeProvider
                   │
                   ▼
               Brain Core
```

Notion may be absent:

```text
Notion disconnected
        ↓
Markdown/Git Knowledge still available
        ↓
Brain continues operating
```

## Alternatives Considered

### Alternative 1 — Notion as canonical Knowledge store

**Rejected.**

Reasons:

- creates runtime/provider coupling;
- offline operation becomes weaker;
- canonical history depends on an external service;
- portability decreases;
- provider substitution becomes harder.

### Alternative 2 — Duplicate canonical truth in both Git and Notion

**Rejected.**

Reasons:

- creates two competing sources of truth;
- sync conflicts become semantic ambiguity;
- difficult to determine which version wins.

### Alternative 3 — Markdown/Git only, no human-facing adapter

**Acceptable baseline but incomplete as long-term UX.**

Brain can operate this way.

However, optional human-facing surfaces can improve collaboration and editing.

Therefore Notion remains optional rather than prohibited.

### Alternative 4 — Markdown/Git canonical + optional Notion adapter

**Accepted.**

Reasons:

- preserves portability;
- supports offline/Build Day operation;
- keeps Core provider-neutral;
- allows human-friendly authoring/review;
- makes Notion disconnect non-fatal.

## Consequences

### Positive

- Brain Knowledge remains versioned and portable.
- Notion can be added/removed without Core changes.
- human collaboration remains possible.
- source provenance can be preserved.
- Build Day operation is not dependent on Notion availability.

### Costs

- sync/import/export needs an adapter later;
- human edits in Notion are not canonical until compiled into Git;
- conflict handling must be explicit;
- Notion-specific rich formatting may require normalization.

## Sync Conflict Rule

If canonical Git Knowledge and a Notion page diverge:

```text
Git artifact
= current canonical compiled Knowledge

Notion divergence
= candidate human-authored update
```

The candidate update must go through provenance/compilation/review before becoming canonical.

## Provider Substitution Test

Replace:

```text
Notion adapter
```

with:

```text
another human-facing knowledge repository
```

Expected result:

```text
Brain Core contracts unchanged
Knowledge definition unchanged
KnowledgeProvider contract unchanged
Markdown/Git canonical representation unchanged
```

Result required:

```text
PASS
```
