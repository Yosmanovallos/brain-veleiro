# S14F GitHub REST Capability — Part B Verification Report

## 1. Scope and authorization

- **Phase / step:** S14F Part B (bounded GitHub REST capability provider).
- **Authorization status:** `S14F-PART-B-AUTHORIZATION = AUTHORIZED`.
- **Implementation baseline:** `040cc43ff2ad42deb06c8edf794e3bdfa7762be6`.
- **Branch:** `s14f-github-capability-part-b`.
- **S14 status:** still in progress; not closed.
- **S14G / HI-054:** not authorized / not awarded.

Only the following paths were added or modified:

- `src/providers/capability/github/`
- `tests/github-capability/`
- `brain-bootstrap/reports/S14F-github-capability-verification.md`

No pre-existing tracked files were modified; `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `STATE.yaml`, `CURRENT.md`, Core, `AgentDefinition`, `CapabilityRegistryProvider`, `RestrictedCapabilityProvider`, and prior-phase surfaces remain byte-identical to the baseline.

## 2. Environment

| Item | Value |
|------|-------|
| Node | `v24.19.0` |
| npm | `11.17.0` |
| Vitest | `4.1.11` |
| OS worktree | WSL-native ext4 `/home/yosman/brain-veleiro-s14f-part-b` |
| Baseline SHA | `040cc43ff2ad42deb06c8edf794e3bdfa7762be6` |

## 3. Provider implementation summary

The provider lives under `src/providers/capability/github/` and exposes exactly the five canonical, provider-neutral, `EXTERNAL` capability identities:

1. `repository.remote.inspect`
2. `repository.review.inspect`
3. `repository.review.open`
4. `repository.review.comment`
5. `repository.checks.inspect`

Composition is:

```text
RestrictedCapabilityProvider → CapabilityRegistryProvider → GitHubRestCapabilityProvider
```

The provider uses a fixed `https://api.github.com` origin through a Node `node:https` transport (`httpsTransport.ts`), with provider-owned headers, API version `2026-03-10`, redirect refusal, bounded response consumption, a single monotonic deadline, and no hidden retries. Credential resolution is private to the provider, credentials appear only in the `Authorization` header, and raw remote payloads never cross the provider boundary.

## 4. Test inventory

The focused Part B suite under `tests/github-capability/` contains:

| Suite | Tests |
|-------|-------|
| `githubCapability.test.ts` | 38 canonical fixtures (14 positive + 24 negative) |
| `hardInvariants.test.ts` | 28 hard invariants (S14F-HI-001 … S14F-HI-028) |
| `unsafeCounters.test.ts` | 10 unsafe counters (UC01 … UC10) |
| `regressions.test.ts` | 2 regression/boundary checks |
| `registryCompatibility.test.ts` | 2 registry / provider-swap checks |
| `credentialDeadline.test.ts` | 5 SR-001 credential-deadline regressions (added by the §11 correction) |
| **Total** | **85 / 85 passed** after the §11 correction (80 / 80 at candidate `3372914`) |

### 4.1 Hard invariants (28/28)

`hardInvariants.test.ts` maps each invariant to a concrete assertion or fixture from `cases.ts` and `audit.ts`. All invariants pass.

### 4.2 Positive fixtures (14/14)

`FX-POS-001` through `FX-POS-014` pass.

### 4.3 Negative fixtures (24/24)

`FX-NEG-001` through `FX-NEG-024` pass.

### 4.4 Unsafe counters (all zero)

All ten unsafe counters are zero on the production code and trigger the expected injected-control detectors:

- UC01 origin/transport escape
- UC02 credential/environment discovery
- UC03 redirect/SSRF/arbitrary endpoint/GraphQL escape
- UC04 restricted/enabled capability bypass
- UC05 stale/wrong-review write
- UC06 hidden retry / ambiguous write retry
- UC07 raw remote error payload / instruction execution
- UC08 request/response/output/array bound bypass
- UC09 protected boundary / dependency / prior-phase drift
- UC10 forbidden GitHub mutation / future phase / self-closure

## 5. Full builder QA

Commands executed:

```bash
rm -rf dist
npm test
npm run build
npm test
```

### 5.1 Pre-build `npm test`

- **Total:** 2040 tests
- **Passed:** 2026
- **Failed:** 14

### 5.2 Build

```bash
npm run build
```

TypeScript build completed with exit code `0`. `dist/` was produced under `dist/src/providers/capability/github/` and is ignored by `.gitignore` (`dist/`); it is not committed.

### 5.3 Post-build `npm test`

- **Total:** 2040 tests
- **Passed:** 2026
- **Failed:** 14

Build did not introduce any new failures.

## 6. Inherited failures (baseline comparison)

The 14 failures are exactly the inherited, documented baseline failures. Their identities and root causes are unchanged and are not introduced by Part B.

### 6.1 Failure identities

| # | Suite | Test |
|---|-------|------|
| 1 | `tests/git-capability/gitCapability.test.ts` | `FX-NEG-040` |
| 2 | `tests/git-capability/gitCapability.test.ts` | `S14D-HI-002` |
| 3 | `tests/git-capability/gitCapability.test.ts` | `S14D-HI-039` |
| 4 | `tests/git-capability/gitCapability.test.ts` | `S14D-HI-040` |
| 5 | `tests/git-capability/regressions.test.ts` | `the S14D candidate surface is exactly additive under the authorized prefixes` |
| 6 | `tests/git-capability/unsafeCounters.test.ts` | `UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires` |
| 7 | `tests/shell-capability/regressions.test.ts` | `the S14B regression-harness maintenance is exactly the authorized narrow change` |
| 8 | `tests/shell-capability/shellCapability.test.ts` | `FX-NEG-042` |
| 9 | `tests/shell-capability/shellCapability.test.ts` | `S14C-HI-002` |
| 10 | `tests/shell-capability/shellCapability.test.ts` | `S14C-HI-033` |
| 11 | `tests/shell-capability/shellCapability.test.ts` | `S14C-HI-037` |
| 12 | `tests/shell-capability/shellCapability.test.ts` | `S14C-HI-038` |
| 13 | `tests/shell-capability/shellCapability.test.ts` | `S14C-HI-039` |
| 14 | `tests/shell-capability/unsafeCounters.test.ts` | `UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires` |

### 6.2 Failure cause

Every inherited failure has the same single root cause: legacy `git-capability` and `shell-capability` boundary checks compare the current worktree against older continuity baselines, and those baselines are stale because the implementation baseline `040cc43` already contains newer `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` bytes. The assertion is:

```text
AssertionError: expected [ 'brain-bootstrap/STATE.yaml', 'brain/context/CURRENT.md' ] to deeply equal []
```

This is pre-existing S14D/S14C harness drift, not Part B code or test breakage. No Part B paths appear in the failure stacks.

### 6.3 Failure identity / cause diff

- **Failure identity diff vs baseline:** `0` (same 14 suite/test identities).
- **Failure cause diff vs baseline:** `0` (same `STATE.yaml` / `CURRENT.md` continuity drift).

## 7. Git checks

```bash
git diff --check 040cc43..HEAD
```

No whitespace or conflict-marker errors.

`git status` shows only the authorized Part B additions:

```text
src/providers/capability/github/
tests/github-capability/
brain-bootstrap/reports/S14F-github-capability-verification.md
```

No modifications, renames, deletions, or dependency files are present.

## 8. Protected-surface verification

- `assertBoundaries()` from `tests/github-capability/audit.ts` passes for the Part B baseline `040cc43`.
- `assertNoNewDependency()` passes; `package.json` / `package-lock.json` are byte-identical to the baseline.
- `assertPriorPhaseIdentity()` passes; Core, `AgentDefinition`, registry, and restricted provider blobs are unchanged.
- `partAIntact()` passes; Part A byte identity is preserved.
- `closureClaims()` and `overclaims()` on `phaseText()` are zero; no S14 closure, HI-054, or S14G authorization claims are made.

## 9. Final state

- S14F Part B implementation and tests are complete.
- The provider is bounded, provider-neutral, credential-safe, and uses only the authorized GitHub REST surface.
- All 28 hard invariants, 14 positive fixtures, 24 negative fixtures, and 10 unsafe counters pass.
- Full suite QA passes except the 14 documented inherited failures, whose identity and cause are unchanged from the baseline.
- No merge, phase closure, or independent-verification claim is made.
- Independent verification is intentionally deferred to a separate fresh session.

## 10. SHAs

- **Implementation baseline:** `040cc43ff2ad42deb06c8edf794e3bdfa7762be6`
- **Candidate code commit:** `53f5bbd` (contains the provider, tests, and this report before remote SHA insertion).
- **Remote branch SHA verified at push:** `5d4268e8a2253320209a0176c476b3f14ba40a04` (matches `FETCH_HEAD` after `git fetch origin s14f-github-capability-part-b`).
- **Final remote branch tip:** recorded in the `STEP_STATUS` handoff after any subsequent report update.

## 11. Source-review correction SR-001 (credential resolution deadline)

Sections 5 to 10 describe candidate `3372914` and have not been updated for this correction. This section supersedes the focused-suite counts. It does not restate the full builder QA or git-status results: those will be re-measured by the control plane.

- **Failed candidate:** `3372914ca1b879485c1961ead6fec2223e87ed7a`
- **Implementation baseline:** `040cc43ff2ad42deb06c8edf794e3bdfa7762be6` (unchanged)
- **Environment:** Node `v24.19.0`, npm `11.17.0`, Vitest `4.1.11`

### 11.1 Defect

`resolveCredential()` awaited `credentialResolver.resolve(...)` without racing it against the invocation deadline (contract §15). A never-settling resolver could keep `invoke()` alive past the effective timeout, and a resolver rejecting after expiry was classified `PERMISSION_DENIED` instead of `TIMEOUT`.

### 11.2 Repair (`src/providers/capability/github/githubCapabilityProvider.ts` only)

- `Deadline.bound(pending)` races a provider-side wait against the existing single `AbortController`. It creates no second timer and no resettable budget. The deadline is still armed once in `invoke()` with `min(request.timeout_ms, config.max_timeout_ms)` and the start time is still captured at `invoke()` entry.
- The provider-created abort listener is `{ once: true }` and is removed on both the fulfil and reject paths. A settlement arriving after the deadline has a rejection handler attached and is discarded, so it is never unhandled and its value is never stored.
- `resolveCredential()` awaits `deadline.bound(...)`. If the wait fails and `deadline.expired()` holds (which includes `signal.aborted`), the result goes through the existing `failTimeout(write)`: READ gives `TIMEOUT` / retryable `true` / `timeoutRead`, and WRITE gives `TIMEOUT` / retryable `false` / `timeoutWrite` because `write.dispatched` is still `false`. Otherwise the result stays `PERMISSION_DENIED` / `credentialUnavailable`. A synchronously throwing resolver is also mapped to `PERMISSION_DENIED`.
- `GitHubCredentialResolver`, Core, `AgentDefinition`, registry, restricted provider and dependency manifests are unchanged. Nothing is retried.

### 11.3 Regression evidence (non-canonical, `tests/github-capability/credentialDeadline.test.ts`)

| Test | Assertion |
|------|-----------|
| `SR-001-T1` | Hanging resolver on READ (remote / review / checks inspect, and a request-side short timeout): `FAIL` / `TIMEOUT` / retryable `true` / `timeoutRead`, resolver calls `1`, HTTP `0` |
| `SR-001-T2` | Hanging resolver on WRITE (`review.open`, `review.comment`): `FAIL` / `TIMEOUT` / retryable `false` / `timeoutWrite`, HTTP `0` (no preflight, no POST) |
| `SR-001-T3` | Resolver rejection before the deadline (immediate, explicit pending, synchronous throw): `FAIL` / `PERMISSION_DENIED` / retryable `false` / `credentialUnavailable`, HTTP `0`, no rejection text echoed |
| `SR-001-T4` | Late settle or late reject after timeout (READ and both WRITEs): result bytes unchanged, HTTP `0`, no unhandled rejection, no credential in the result |
| `SR-001-T5` | Success path: every abort listener added during the resolver wait is removed |

Canonical `FX-NEG-014` (read) and `FX-NEG-015` (write, pre-dispatch) each gained a hanging-resolver assertion covering code, message, resolver count and zero HTTP, with no wall-clock bound. No canonical fixture was renumbered, removed or weakened.

Counterfactual: when these tests run against the unrepaired provider from `3372914`, `SR-001-T1`, `T2` and `T4` hit the 5 s test timeout and `T5` observes no bounded listener. `T3` passes on both versions, because that behavior is preserved.

### 11.4 QA

- `npm run typecheck`: exit `0`.
- `npx vitest run tests/github-capability/credentialDeadline.test.ts`: 10 consecutive runs, `5 / 5` passed each time.
- `npx vitest run tests/github-capability`: `85 / 85` passed. Inventories: `28 / 28` hard invariants, `14 / 14` positive fixtures, `24 / 24` negative fixtures, `10 / 10` unsafe counters zero.
- Worktree hygiene: the temporary control-plane prompt file was removed before final QA. `assertBoundaries()` passed.
- Full builder QA (post-correction, same WSL-native worktree):
  - `rm -rf dist` then `npm test`: **2031 passed / 14 failed** (2045 total)
  - `npm run build`: exit `0`; `dist/` produced and ignored
  - `npm test`: **2031 passed / 14 failed** (2045 total)
  - Inherited failure identities and cause unchanged from baseline `040cc43` (`brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` continuity drift)
- `git diff --check 040cc43..HEAD`: no whitespace errors.
- **Final remote branch tip:** recorded in the `STEP_STATUS` handoff.

No merge, phase closure, HI-054 award or S14G authorization is made or implied.
