# BRAIN — Handoffs Directory

This directory stores structured **Handoff** artifacts for real Brain sessions.

A Handoff transfers the minimum verified operational state required to continue work safely in another session, Agent, model, platform, or execution context without replaying the full prior conversation.

Handoffs are not:

- full transcripts;
- general Memory;
- Context Pack replacements;
- informal summaries;
- substitutes for verifying current repository/runtime state.

## Canonical Template

Create each Handoff from:

`brain-bootstrap/templates/HANDOFF.template.md`

## Naming Convention

Use:

```text
YYYY-MM-DDTHHMMSSZ-<short-objective-slug>.md
```

Example:

```text
2026-08-25T194500Z-context-runtime-integration.md
```

If exact UTC timestamps are unavailable, use a sortable local timestamp with timezone documented in the Handoff.

Avoid names such as:

```text
latest.md
handoff-new.md
final-final.md
```

The active Handoff is referenced from:

`brain/context/CURRENT.md`

## Lifecycle

```text
SESSION A
  ↓
verify final state
  ↓
write Handoff
  ↓
update CURRENT.md
  ↓
close session

SESSION B
  ↓
read project context
  ↓
read CURRENT.md
  ↓
read referenced Handoff
  ↓
independently verify real state
  ↓
resolve stale claims
  ↓
continue next exact action
```

## Authority Rule

A Handoff has lower authority than current repository/runtime reality.

If a Handoff says `branch = release` but independent verification shows `branch = main`, the current verified repository state wins.

The mismatch must be surfaced and the stale Handoff claim must not be silently trusted.

## Retention

Do not overwrite old Handoffs merely because they became stale.

Historical Handoffs may remain useful for auditability and understanding prior operational frontiers.

Create a new Handoff when a new continuity boundary is reached.
