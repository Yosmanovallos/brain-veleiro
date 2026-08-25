# BRAIN — HANDOFF

> Structured transfer artifact for continuing work safely without replaying the full conversation.

## Metadata

**Handoff ID:**  
`[HANDOFF-...]`

**Created at:**  
`[...]`

**Created by:**  
`[...]`

**Session / Run reference:**  
`[...]`

**Status:**  
`VERIFIED | NEEDS_REVALIDATION | BLOCKED`

# 1. objective

`[Exact active objective at session close. Keep it bounded and operational.]`

# 2. branch/HEAD/status

**Repository root:**  
`[...]`

**Branch:**  
`[...]`

**HEAD:**  
`[...]`

**Worktree status:**  
`CLEAN | DIRTY | UNKNOWN`

**Remote / sync state if relevant:**  
`[...]`

**Verification status:**  
`VERIFIED | PROVIDED | ASSUMED | UNKNOWN | BLOCKED`

**Evidence reference(s):**  
`[...]`

# 3. verified completed work

Record only work that is actually verified.

| ID | Completed item | Verification | Evidence ref |
|---|---|---|---|
| CW-001 | `...` | `...` | `...` |

Do not record intended work as completed work.

If something was produced but not verified, place it under **open issues** instead.

# 4. commands/evidence

List commands, checks, observations, or other Evidence needed to reproduce the session's important claims.

| ID | Command / Method | Result | Exit / Status | Evidence ref |
|---|---|---|---|---|
| EV-001 | `...` | `...` | `...` | `...` |

Rules:

- Agent assertions are not Evidence.
- Do not include secret values.
- Prefer inspectable artifact refs, command output refs, commit SHAs, test reports, or equivalent reproducible observations.

# 5. decisions

Record decisions that materially constrain what the next session should do.

| Decision ID | Decision | Status | Authority / Source | Rationale |
|---|---|---|---|---|
| D-001 | `...` | `VERIFIED | PROVIDED | PROPOSED` | `...` | `...` |

Do not silently promote PROPOSED decisions to VERIFIED.

# 6. open issues

| Issue ID | Issue | Impact | Status | What would resolve it |
|---|---|---|---|---|
| OI-001 | `...` | `...` | `UNKNOWN | BLOCKED | ASSUMED | PROVIDED` | `...` |

Include failed checks, unverified work, unresolved contradictions, missing information, known defects, and deferred but still relevant work.

# 7. changed files

| Path | Change | Verified? | Notes |
|---|---|---|---|
| `...` | `ADDED | MODIFIED | DELETED | MOVED` | `YES | NO` | `...` |

This is not a substitute for checking the real repository in the next session.

# 8. next exact action

Provide exactly one next permitted operational action.

`[...]`

The next session should perform this action only after independently verifying that the Handoff is still current.

Do not write a multi-step roadmap here.

# 9. do-not-do

Explicitly record actions that the next session must avoid.

- `[...]`
- `[...]`

# 10. assumptions needing revalidation

| Assumption ID | Assumption | Why currently assumed | Impact if wrong | Revalidate before |
|---|---|---|---|---|
| A-001 | `...` | `...` | `...` | `...` |

Allowed statuses:

```text
ASSUMED
PROVIDED
UNKNOWN
BLOCKED
```

A Handoff must never make an assumption look VERIFIED merely because it was used during the prior session.

# 11. Relevant Context References

**Current Spec:**  
`[...]`

**Current ADR(s):**  
`[...]`

**Relevant Quality Contract:**  
`[...]`

**Relevant Evidence:**  
`[...]`

**Relevant Context Pack / source refs:**  
`[...]`

Do not paste complete historical conversations.

# 12. Staleness / Revalidation Triggers

This Handoff must be revalidated if any of the following occurs:

- repository HEAD differs;
- branch differs;
- worktree changes unexpectedly;
- external/runtime state changed;
- referenced Spec or ADR changed;
- a required test/check now fails;
- newer verified Evidence contradicts a claim here.

# 13. Close Verification

Before declaring the Handoff ready:

- [ ] objective is current and bounded.
- [ ] branch/HEAD/status were independently observed.
- [ ] verified completed work contains only verified items.
- [ ] commands/evidence are reproducible or inspectable.
- [ ] decisions have authority/status.
- [ ] open issues are explicit.
- [ ] changed files are listed.
- [ ] next exact action is exactly one action.
- [ ] do-not-do is explicit.
- [ ] assumptions needing revalidation are visible.
- [ ] no secrets are included.
- [ ] full transcript is not copied into this Handoff.

**Handoff readiness:**  
`READY | NEEDS_REVALIDATION | BLOCKED`
