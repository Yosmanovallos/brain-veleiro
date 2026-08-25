# Knowledge Sources

This directory stores raw or minimally transformed source truth and source manifests.

Use it for:

- immutable source snapshots;
- external-source manifests;
- official documentation references;
- repository evidence snapshots;
- stakeholder-provided source references.

Do not place synthesized Knowledge here.

## Naming

Use descriptive kebab-case names:

```text
official-api-docs-2026-08-25.md
auth-requirements-source.md
repository-observation-001.md
```

For versioned external sources, prefer creating a new source artifact instead of overwriting an already-cited snapshot.

## Minimum Source Metadata

Recommended:

```yaml
source_id:
type:
locator:
retrieved_at:
authority:
sha256:
```

`sha256` is especially useful for local immutable snapshots.

## Immutability Rule

If another Knowledge artifact cites a source here, the source must not be silently rewritten.

New source version:

```text
new file / new source id
```

not:

```text
overwrite old cited source
```
