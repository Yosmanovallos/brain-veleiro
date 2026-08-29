# BRAIN — Current Session Pointer

> This file is intentionally small. It points to the current verified operational frontier and must not duplicate the full Handoff.

**Template status:** `ACTIVE`

## Current Objective

S00–S13L are `VERIFIED PASS`. S13M qa-debugging repository inspection and authoring preflight are
the only allowed next major-step work. S13M semantic authoring and Part B remain forbidden.

## Current Repository State

**Branch:**
`main`

**Verification target:**
`0b3925f1f3461d603c99683b00af1c725667f4dd` (S13L fresh-verifier documentation checkpoint)

**Worktree status:**
`tracked clean as of this update; 13 retained pre-existing untracked Markdown scaffolds; verify independently`

**Last independently verified at:**
`2026-08-29T14:14:15Z (S13L fresh non-authoring non-fork read-only verifier PASS)`

## Current Handoff

**Handoff file:**
`brain/context/handoffs/2026-08-29T142749Z-s13l-verified-pass.md`

**Handoff status:**
`VERIFIED PASS / CLOSED`

## Current Status

S13L is independently VERIFIED PASS. A different fresh non-authoring, non-fork, read-only verifier
reproduced Part A integrity, repair regressions 11/11, actual-candidate malformed-shape fail-closed
behavior, focused 126/126, full 984/984 before and after a genuinely dist-absent build, 8/8 positives,
36/36 named negatives, 30/30 atomic isolation, OI-A `120/248 → 248/248` (`+128`), hard invariants
`392/400 → 400/400`, all eight unsafe counters zero, future-stage boundaries and `git diff --check`.
ChatGPT control-plane accepted the verifier in issue #1 comment `5462919214`.

## Next Exact Action

Close S13L continuity, then inspect repository reality for S13M qa-debugging and publish a compact
`CHATGPT_AUTHORING_REQUIRED` evidence pack. Do not author S13M semantic artifacts or implement S13M
Part B before a matching canonical ChatGPT Part A is integrated verbatim.

### Operating Rule

A new session must never trust this file or its referenced Handoff blindly.

Before continuing, verify current repository/runtime reality independently. If reality conflicts with
this file or the Handoff, repository/runtime reality wins according to the canonical Context Authority
order.

Update this file only after the new state has been verified.
