# S14F — GitHub REST Capability Part B — VERIFIED PASS / INTEGRATED

## Phase Facts

- **phase:** S14F
- **step:** S14 — CAPABILITY_REGISTRY_TOOLS_MCP (RUNTIME_INFRASTRUCTURE / DEEP)
- **status:** PHASE_PASS / INTEGRATED
- **verified candidate:** 54401f943e5e01e461f578230ac804e97ba50c3d
- **previous source-review failed candidate:** 3372914ca1b879485c1961ead6fec2223e87ed7a
- **baseline before closure:** 040cc43ff2ad42deb06c8edf794e3bdfa7762be6
- **branch:** s14f-github-capability-part-b
- **closure timestamp:** 2026-09-10T15:06:03Z

## Authority Chain

1. **Fresh independent verifier relay**
   - source: Antigravity CLI fresh non-authoring, non-builder, non-fork, read-only verifier
   - issue #1 comment: `5620849939`
   - status: `PASS_WITH_DOCUMENTED_BASELINE_FAILURES`
   - in_reply_to_comment_id: n/a

2. **ChatGPT control-plane acceptance**
   - issue #1 comment: `5620853896`
   - in_reply_to_comment_id: `5620849939`
   - decision: `VERIFIED_PASS_ACCEPTED / S14F_PHASE_INTEGRATION_AUTHORIZED`

## SR-001 Repair

- **defect:** credential resolution awaited the resolver directly without an invocation deadline, so a never-settling resolver could keep `invoke()` pending indefinitely and a late rejection could be misclassified.
- **primary coding worker attempted:** Codex GPT-5.6 Sol returned HTTP `401 Unauthorized`.
- **fallback coding worker:** Claude Code Opus authored the bounded repair.
- **repair commit:** 6cd64c44a573cab61cb92d61c89fec52ef8a741a
- **later report-only bookkeeping commits:** 186412d and 54401f9 (the verified candidate)
- **mechanism:** one monotonic `Deadline`, armed once with `min(request.timeout_ms, config.max_timeout_ms)`, existing `AbortController`; `resolveCredential()` awaits `deadline.bound(resolver.resolve(...))`; no second timer; late resolver settlement/rejection observed and discarded; read timeout classified `TIMEOUT / retryable true / timeoutRead`; pre-dispatch write timeout `TIMEOUT / retryable false / timeoutWrite` with `write.dispatched` false.

## Verification Evidence

- exact HEAD: `54401f943e5e01e461f578230ac804e97ba50c3d`
- npm ci: PASS
- npm run typecheck: PASS
- SR-001 credentialDeadline.test.ts: 10 consecutive runs, 5/5 each
- focused S14F: 85/85 PASS
- hard invariants: 28/28
- positive fixtures: 14/14
- negative fixtures: 24/24
- unsafe counters: 10/10 zero
- baseline full pre-build: 1946 passed / 14 failed
- candidate full pre-build: 2031 passed / 14 failed
- npm run build: PASS
- baseline full post-build: 1946 passed / 14 failed
- candidate full post-build: 2031 passed / 14 failed
- failure identity diff: 0
- failure cause check: exact — all 14 inherited failures attributable only to `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md`
- scope check: PASS
- dependency check: PASS
- Part A byte identity: PASS
- committed dist: none
- git diff --check: PASS
- live GitHub writes: NONE

## Count Reconciliation

The fresh verifier reconstructed the exact counts:

- baseline `040cc43ff2ad42deb06c8edf794e3bdfa7762be6`: 1946 passed / 14 failed
- candidate `54401f943e5e01e461f578230ac804e97ba50c3d`: 2031 passed / 14 failed

The +85 candidate passes are the new S14F Part B tests under `tests/github-capability`.
The 14 inherited failure identities and their assertion causes are unchanged.

## Correction Details

- primary modified file: `src/providers/capability/github/githubCapabilityProvider.ts`
- change: `resolveCredential()` now awaits the resolver through `deadline.bound(...)`, using the single invocation `Deadline` and `AbortController`.
- the change is local to the GitHub capability provider; no Core, registry, AgentDefinition, filesystem, shell, git, documentation or dependency change.
- a dedicated regression file `tests/github-capability/credentialDeadline.test.ts` was added.
- `tests/github-capability/cases.ts` and `tests/github-capability/helpers.ts` were updated to support the regression probes.
- production source, Part A artifacts, `package.json`, `package-lock.json` and `dist` remain untouched by the implementation.

## Closure Diff

This docs-only phase-closure commit adds exactly:

- `brain-bootstrap/STATE.yaml`
- `brain/context/CURRENT.md`
- `brain/context/handoffs/20260910T150646Z-s14f-verified-pass-phase-closure.md`

## Protected Artifacts

The following remain byte-identical to the verified candidate `54401f9`:

- `src/providers/capability/github/**`
- `tests/github-capability/**`
- `brain-bootstrap/reports/S14F-github-capability-verification.md`
- `brain-bootstrap/specs/GITHUB_CAPABILITY_CONTRACT_S14F.md`
- `brain-bootstrap/skills/GITHUB_CAPABILITY_SKILL_S14F.md`
- `brain-bootstrap/quality-contracts/S14F_GITHUB_CAPABILITY_DEEP.yaml`
- `package.json`, `package-lock.json`

## Remaining State

- `S14F`: `PHASE_PASS / INTEGRATED`
- `S14`: `IN_PROGRESS / NOT_CLOSED`
- `S14G`: `NOT_AUTHORIZED`
- `HI-054`: `NOT_AWARDED`

## Next Allowed Action

Return to ChatGPT for the **S14G authoring gate**.

Do not implement, inspect, or author S14G before that gate.
