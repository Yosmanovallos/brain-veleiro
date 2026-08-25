# BRAIN — SESSION CLOSE

> Checklist for closing a session with a verified Handoff so another session can continue safely without replaying the entire conversation.

## 1. Stop New Work

Before closing:

- stop starting new tasks;
- stop expanding scope;
- finish or explicitly record the state of the current bounded action.

Session close is not the time to begin the next milestone.

## 2. Verify Final Repository / Runtime State

Independently observe the state relevant to continuity.

When repository state is relevant, record:

- repository root;
- branch;
- HEAD;
- worktree status;
- remote sync state when material.

Also verify critical task claims such as tests/checks, artifact existence, current build/runtime state, and unresolved failures.

Do not rely on earlier session observations if state may have changed.

## 3. Separate Completed vs. Unverified Work

Classify work as:

```text
VERIFIED_COMPLETED
UNVERIFIED
PARTIAL
BLOCKED
NOT_STARTED
```

Only VERIFIED_COMPLETED items may enter the Handoff's **verified completed work** section.

Everything else belongs under open issues or current status.

## 4. Collect Evidence References

Collect only the Evidence required to support continuity-critical claims.

Examples may include commit SHA, test report, command result, diff reference, artifact path, runtime observation, and verification report.

Do not paste unnecessary logs or secret values.

## 5. Record Decisions

Capture decisions that the next session must know.

For each:

- decision;
- status;
- authority/source;
- rationale;
- whether revalidation is needed.

Do not convert proposals into decisions silently.

## 6. Record Open Issues

Include failed checks, unresolved contradictions, unverified output, known defects, blockers, and deferred items that affect the next action.

Make each issue actionable.

## 7. Record Changed Files

List files added, modified, deleted, or moved.

Verify the list against real repository state when possible.

Do not assume conversational memory of file changes is complete.

## 8. Define One Next Exact Action

Write exactly one next operational action.

Good:

```text
Verify the current migration against the approved acceptance criteria.
```

Bad:

```text
Finish backend, then frontend, then QA, then deployment.
```

The Handoff transfers the frontier, not the whole future roadmap.

## 9. Define Do-Not-Do Constraints

List specific actions the next session must avoid.

Include any action that could skip a required gate, overwrite unverified work, invalidate Evidence, introduce unapproved scope, trust a known stale assumption, or damage repository history.

## 10. Record Assumptions Needing Revalidation

For every remaining material assumption record:

- statement;
- why it remains unresolved;
- impact if wrong;
- when it must be revalidated.

Never allow a prior assumption to become invisible merely because work progressed.

## 11. Write the Handoff

Create a new file under:

```text
brain/context/handoffs/
```

using:

```text
brain-bootstrap/templates/HANDOFF.template.md
```

Use the canonical naming convention defined in `brain/context/handoffs/README.md`.

The Handoff must include all required fields before it can be considered READY.

## 12. Update CURRENT.md

After the Handoff is written and verified, update:

```text
brain/context/CURRENT.md
```

Change only the small live pointer information:

- current objective;
- current branch;
- current HEAD;
- worktree status;
- current Handoff path;
- one-line current status;
- next exact action.

Do not copy the full Handoff into `CURRENT.md`.

## 13. Verify Continuity Artifacts

Before final close, check:

- `CURRENT.md` points to the newly created Handoff;
- referenced Handoff exists;
- branch/HEAD/status match the final verified state;
- Handoff contains all mandatory fields;
- no secrets exist in the continuity artifacts;
- next exact action is explicit;
- assumptions needing revalidation are explicit.

## 14. Optional Git Checkpoint

If the project's operating Rules require a Git checkpoint before session close:

- stage only intended artifacts;
- inspect staged changes;
- commit using the project's normal process;
- push only if permitted;
- verify local/remote state afterward.

This template does not mandate one specific version-control implementation for every Brain task.

## 15. Session Close Result

```text
SESSION_CLOSE_STATUS

STATUS: PASS | FAIL | BLOCKED

FINAL_VERIFIED_STATE:
- repository/root:
- branch:
- HEAD:
- worktree:
- remote state:

HANDOFF:
- path:
- readiness:
- all mandatory fields present:

CURRENT_POINTER:
- updated:
- points_to:

VERIFIED_COMPLETED_WORK:
...

OPEN_ISSUES:
...

ASSUMPTIONS_NEEDING_REVALIDATION:
...

NEXT_EXACT_ACTION:
...

DO_NOT_DO:
...

EVIDENCE:
...
```

Only `PASS` means the continuity boundary is safe to hand to a new session.

## 16. Final Rule

A session that will continue later is not responsibly closed until:

```text
real state verified
    ↓
Handoff written
    ↓
CURRENT.md updated
    ↓
continuity artifacts checked
    ↓
next exact action explicit
```

The next session must still reverify reality independently.
