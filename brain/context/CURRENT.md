# BRAIN — Current Session Pointer

> This file is intentionally small. It points to the current verified operational frontier and must not duplicate the full Handoff.

**Template status:** `UNINITIALIZED | ACTIVE | BLOCKED | COMPLETE`

## Current Objective

`[one concise sentence describing the current active objective]`

## Current Repository State

**Branch:**  
`[branch or N/A]`

**HEAD:**  
`[commit SHA or N/A]`

**Worktree status:**  
`[CLEAN | DIRTY | UNKNOWN | N/A]`

**Last independently verified at:**  
`[timestamp or N/A]`

## Current Handoff

**Handoff file:**  
`brain/context/handoffs/[handoff-file].md`

**Handoff status:**  
`[VERIFIED | NEEDS_REVALIDATION | NONE]`

## Current Status

`[one concise sentence describing where the work currently stands]`

## Next Exact Action

`[single next permitted action — not a future roadmap]`

### Operating Rule

A new session must never trust this file or its referenced Handoff blindly.

Before continuing, verify current repository/runtime reality independently. If reality conflicts with this file or the Handoff, repository/runtime reality wins according to the canonical Context Authority order.

Update this file only after the new state has been verified.
