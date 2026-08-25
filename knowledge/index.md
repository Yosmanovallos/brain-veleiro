# Brain Knowledge

This directory is Brain's canonical compiled Knowledge layer.

Canonical representation:

```text
Markdown + Git
```

Human-facing systems such as Notion may contribute or display Knowledge through optional adapters, but they are not required for Brain runtime.

## Structure

```text
knowledge/
├── sources/                raw source snapshots/manifests
├── concepts/               stable explanations of concepts
├── decisions/              retrieval-oriented decision knowledge
├── architecture-patterns/  reusable architecture patterns/tradeoffs
├── agent-patterns/         reusable agent-system patterns
└── failure-modes/          recurring failure patterns and mitigations
```

## Finding Knowledge

Start with the category that matches the question.

Examples:

```text
"What does X mean?"
→ concepts/

"Why did we choose Y?"
→ decisions/

"What architecture pattern applies?"
→ architecture-patterns/

"What agent pattern should we use?"
→ agent-patterns/

"How can this fail?"
→ failure-modes/

"What source supports this?"
→ sources/
```

Retrieve only the artifacts relevant to the current objective.

Do not load this entire directory into a Context Pack.

## Required Artifact Metadata

Compiled Knowledge artifacts should include:

- `id`
- `title`
- `kind`
- `epistemic_status`
- `provenance.source_refs`
- `provenance.compiled_at`
- `validity.state`
- `validity.last_checked_at`
- `validity.revalidate_when`

Recommended epistemic statuses:

```text
VERIFIED
PROVIDED
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

Recommended validity states:

```text
CURRENT
NEEDS_REVALIDATION
STALE
UNKNOWN
```

## Raw Sources

Files or manifests in `sources/` are source truth.

A compiled Knowledge artifact may cite or summarize them.

It must not silently modify them.

## Human-Facing Surfaces

Notion may be used as an optional human-facing authoring/review surface.

Canonical compiled Knowledge remains here in Markdown/Git.

If Notion is disconnected, Brain continues using this Knowledge tree.
