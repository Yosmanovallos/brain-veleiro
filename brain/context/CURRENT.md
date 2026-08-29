# BRAIN — Current Session Pointer

> This file is intentionally small. It points to the current verified operational frontier and must not duplicate the full Handoff.

**Template status:** `ACTIVE`

## Current Objective

S00–S13L are `VERIFIED PASS`. S13M qa-debugging Part B has a new material-evidence builder repair and
requires control-plane review before any fresh independent verifier. S13N remains forbidden.

## Current Repository State

**Branch:**
`main`

**Verification target:**
`de6f2b4aa3631d25261b45b29f839651add101a0` (S13M material-evidence repair target)

**Worktree status:**
`tracked clean as of this update; 13 retained pre-existing untracked Markdown scaffolds; verify independently`

**Last builder evidence at:**
`2026-08-29T22:16:51Z (independent verification remains required)`

## Current Handoff

**Handoff file:**
`brain/context/handoffs/2026-08-29T221651Z-s13m-material-evidence-independent-verification-required.md`

**Handoff status:**
`INDEPENDENT_VERIFICATION_REQUIRED`

## Current Status

S13M canonical Part A remains byte-identical to integration commit `3458df7`; material-evidence repair
target is `de6f2b4`. Builder evidence passes on WSL Node 24.19.0: typecheck, focused S13M 11/11,
pre-build 995/995, genuine dist-absent build with ignored prior dist restored, and post-build 995/995.
OI-A was recomputed as 16/248 to 248/248 (+232), HI 240/400 to 400/400. This is not an independent PASS.

## Next Exact Action

Review the new builder handoff and decide whether a fresh independent verifier may run. Do not start S13N.

### Operating Rule

A new session must never trust this file or its referenced Handoff blindly.

Before continuing, verify current repository/runtime reality independently. If reality conflicts with
this file or the Handoff, repository/runtime reality wins according to the canonical Context Authority
order.

Update this file only after the new state has been verified.
