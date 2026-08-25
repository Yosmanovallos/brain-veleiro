# BRAIN — SESSION BOOT

> Checklist for safely resuming work from project context + CURRENT + Handoff without replaying the full previous conversation.

## 1. Establish Session Scope

Before changing anything, identify:

**Project / repository:**  
`[...]`

**Expected current objective:**  
`[...]`

**Expected active step/task:**  
`[...]`

Do not start implementation yet.

## 2. Read Canonical Continuity Sources

Read, in this order:

1. project-level operating instructions relevant to this repository;
2. `brain/context/CURRENT.md`;
3. the Handoff referenced by `CURRENT.md`;
4. the explicit current Spec relevant to the task;
5. directly relevant ADRs / Quality Contract if required.

Do **not** load all historical sessions, all Memory, all Knowledge, or the full previous transcript by default.

## 3. Extract Handoff Claims to Verify

Before trusting the Handoff, extract at minimum:

- expected repository root;
- expected branch;
- expected HEAD;
- expected worktree status;
- claimed completed work;
- important changed files;
- referenced test/check status;
- next exact action;
- assumptions needing revalidation.

Treat these as claims awaiting current verification.

## 4. Independently Verify Repository / Runtime Reality

Use the real environment to verify the claims applicable to the task.

Minimum repository verification when version control is relevant:

```text
repository root
branch
HEAD
worktree status
remote state when material
```

Also verify any critical Handoff claims required to resume safely, such as artifact existence, test status, build status, configuration state, runtime behavior, and current external-system state when relevant.

The verification mechanism is environment-dependent and must remain tool/provider-agnostic.

## 5. Apply Canonical Authority Order

When reality and the Handoff disagree, use:

```text
1. runtime/repository reality
2. explicit current spec
3. verified current/handoff
4. ADRs
5. project instructions
6. compiled knowledge
7. durable memory
8. historical sessions
9. inference
```

A Handoff is rank 3. Current repository/runtime reality is rank 1.

Do not "fix" the repository simply to make it match the Handoff unless a higher-authority requirement explicitly requires that change.

## 6. Record Continuity Differences

| Claim | Handoff value | Verified current value | Winner | Required action |
|---|---|---|---|---|
| `...` | `...` | `...` | `...` | `...` |

Classify unresolved claims using:

```text
VERIFIED
PROVIDED
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

## 7. Revalidate Assumptions

For each item under **assumptions needing revalidation**:

- verify it now if the task depends on it;
- keep it ASSUMED if explicitly allowed;
- mark UNKNOWN if insufficient information exists;
- mark BLOCKED if continuation would be unsafe or invalid.

Do not silently treat prior assumptions as facts.

## 8. Confirm the Next Exact Action

After verification, determine whether the Handoff's **next exact action** is still valid.

- If still valid: proceed with exactly that action.
- If stale but recoverable: update the operational understanding and perform the earliest valid recovery action.
- If it would skip required work: do not execute it.
- If continuation is unsafe: return `BLOCKED` with conflicting Evidence.

## 9. Build Initial Context Pack

Create only the bounded context needed for the resumed action.

Include, as relevant:

- objective;
- current verified state;
- applicable Spec;
- relevant project instructions;
- relevant ADR/Quality Contract;
- selected Evidence;
- only the minimum historical continuity required.

Do not paste the full Handoff into every downstream task if references or bounded excerpts are sufficient.

## 10. Session Boot Result

```text
SESSION_BOOT_STATUS

STATUS: READY | NEEDS_RECONCILIATION | BLOCKED

VERIFIED_CURRENT_STATE:
- repository/root:
- branch:
- HEAD:
- worktree:
- other critical state:

HANDOFF_COMPARISON:
- claims checked:
- stale claims:
- unresolved claims:

ASSUMPTIONS_REVALIDATED:
...

NEXT_EXACT_ACTION:
...

CONTEXT_RETRIEVED:
...

CONTEXT_EXCLUDED:
...

EVIDENCE:
...
```

Only `READY` permits continuing the task.

## 11. Boot Stop Rule

Do not:

- start later steps;
- trust stale Handoff claims;
- load full transcripts without a specific gap;
- modify the repository before minimum state verification;
- silently resolve contradictions through inference.
