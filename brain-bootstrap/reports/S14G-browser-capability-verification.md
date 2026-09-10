# S14G Browser Capability — Verification Report

## 1. Candidate identity

- Branch: `s14g-browser-capability-part-b`
- Part A baseline: `e4c90bc8a43f1ffb855617ba7db30ce4e46d2595`
- Previous source-review-failed candidate: `df3cdb90e87d4d6b31580de4d33af18c98de10a1`
- Node: `v24.19.0` / npm: `11.17.0` / WSL-native ext4
- `core.autocrlf`: `false`
- Dependency: `playwright-core@1.63.0` exact (verified with `npm ls playwright-core --depth=0`)

## 2. Builder and control-plane notes

- **Primary coding worker:** Claude Code (model `Opus`) — SR-G-001 through SR-G-006 source code and tests.
- **Control-plane finalization:** Devin completed final QA, the verification report, the STEP_STATUS, and the commit/push. This fallback was required because the Claude Code `Opus` session reached its account session limit during the final SR-G-006/QA/report stage. No production source code was authored by Devin; all code changes originated from the Claude sessions.
- **Independent verification:** Not launched.

## 3. Authorized scope

Additions are limited to:

- `src/providers/capability/browser/` — production provider (read-only browser inspect)
- `tests/browser-capability/` — deterministic fake factory, fixtures, hard invariants, unsafe counters, regressions, audit, and SR-G focused tests
- `brain-bootstrap/reports/S14G-browser-capability-verification.md`
- `package.json` and `package-lock.json` — exact pin of `playwright-core@1.63.0` only

Protected surfaces **not modified**:

- `src/core/**`
- `brain-bootstrap/STATE.yaml`
- `brain/context/CURRENT.md`
- S14A–S14F canonical files and implementations
- S14H+ surfaces

## 4. SR-G source-review repairs

### SR-G-001 — final URL validation

- `validation.ts`: added `validateFinalUrl()`; rejects non-HTTPS, userinfo, non-allowed origin, and URLs > 2048 UTF-8 bytes.
- `browserCapabilityProvider.ts`: step 7 calls `validateFinalUrl()` on `page.url()` after navigation.
- Tests: `tests/browser-capability/finalUrlBounds.test.ts` (4 tests) covering 2048 boundary, 2049 ASCII/multibyte, credentials, and non-HTTPS final URLs.

### SR-G-002 — link text 512-byte limit

- `browserCapabilityProvider.ts`: `extractLinks()` uses a dedicated `LIMITS.linkTextBytes = 512` instead of `LIMITS.titleBytes`.
- Links with text > 512 bytes are dropped entirely; URL bounds and HTTPS rules remain.
- Tests: `tests/browser-capability/linkTextBounds.test.ts` (4 tests) covering 512 accepted, 513 dropped, and URL bound unchanged.

### SR-G-003 — final success gate

- `browserCapabilityProvider.ts`: immediately before returning `SUCCESS`, the provider re-checks `!deadline.expired()`, `!popupObserved`, and `!downloadObserved`.
- Tests: `tests/browser-capability/finalSuccessGate.test.ts` (7 tests) covering late deadline, late popup, and late download.

### SR-G-004 — deadline/cleanup matrix

- `browserCapabilityProvider.ts`: `goto` and `ariaSnapshotJSON` are bounded by the same monotonic `raceSignal` deadline.
- Added `tests/browser-capability/deadlineDoubles.ts` to simulate launch, navigation, snapshot, and close that never settle, settle late, or reject late.
- Tests: `tests/browser-capability/deadlineCleanupMatrix.test.ts` (23 tests) covering launch hang, navigation hang, snapshot hang, late completion (resolve/reject), close hang (page/context/browser), cleanup order, monotonic deadline, and no unhandled rejection.

### SR-G-005 — real Chromium success smoke

- Added `tests/browser-capability/realChromiumSmoke.test.ts` (1 test) that launches Playwright-managed Chromium, creates a fresh non-persistent context (`serviceWorkers: "block"`, `acceptDownloads: false`), loads provider-owned static HTML via `setContent`, captures `ariaSnapshotJSON`, and closes cleanly.
- The test fails if Chromium cannot launch (verified by removing the Playwright browser cache).

### SR-G-006 — route/WebSocket handler promises

- `chromiumFactory.ts`: `PlaywrightBrowserContextHandle.route()` and `routeWebSocket()` callbacks now return the provider handler's Promise. The class is exported for test doubles.
- Tests: `tests/browser-capability/routeHandlerPromises.test.ts` (6 tests) proving the callback returns the handler Promise, Playwright awaits completion, rejection is observed, and no unhandled rejection occurs.

## 5. Focused S14G QA

### 5.1 Type check

```bash
npm run typecheck
```

Result: `PASS` (exit 0).

### 5.2 Focused browser test suite

```bash
npx vitest run tests/browser-capability
```

Result: `PASS` — 10 test files, 123 tests, 0 failures.

| Group | Count | Status |
|---|---|---|
| `browserCapability.test.ts` | 34 | PASS |
| `hardInvariants.test.ts` | 30 | PASS |
| `unsafeCounters.test.ts` | 10 | PASS |
| `regressions.test.ts` | 4 | PASS |
| `finalUrlBounds.test.ts` | 4 | PASS |
| `linkTextBounds.test.ts` | 4 | PASS |
| `finalSuccessGate.test.ts` | 7 | PASS |
| `deadlineCleanupMatrix.test.ts` | 23 | PASS |
| `realChromiumSmoke.test.ts` | 1 | PASS |
| `routeHandlerPromises.test.ts` | 6 | PASS |

| Inventory | Target | Actual |
|---|---|---|
| Hard invariants | 30/30 | 30/30 |
| Positive fixtures | 10/10 | 10/10 |
| Negative fixtures | 24/24 | 24/24 |
| Unsafe counters | 10/10 zero | 10/10 zero |

### 5.3 Real browser smoke

`SR-G-005-01: pinned playwright-core launches managed headless Chromium, snapshots static content and closes cleanly` passed.

### 5.4 Timing-sensitive regression repeats

`finalSuccessGate.test.ts` and `deadlineCleanupMatrix.test.ts` were run 10 consecutive times. All 10 runs passed (30/30 tests each run).

## 6. Build and full-suite QA

### 6.1 Pre-build

```bash
rm -rf dist
npm test
```

Result:

- Test files: 577 suites / 58 top-level files
- Tests: 2168
- Passed: 2133
- Failed: 35

### 6.2 Build

```bash
npm run build
```

Result: `PASS`. `dist/` was generated (882 emitted files) and then removed before the final commit. It is not tracked.

### 6.3 Post-build

```bash
npm test
```

Result:

- Tests: 2168
- Passed: 2133
- Failed: 35

Pre-build and post-build failure sets are identical.

## 7. Failure reconciliation

### 7.1 Authorized baseline (18)

The 18 inherited baseline failures are caused by `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` having been updated by later S14 phase closures (S14B, S14D, S14F) after the per-phase baselines used by the earlier harnesses. Their identities and root cause are unchanged from the Part A baseline run.

| # | Identity | Phase |
|---|---|---|
| 1 | `tests/shell-capability/regressions.test.ts > the S14B regression-harness maintenance is exactly the authorized narrow change` | S14B |
| 2 | `tests/git-capability/unsafeCounters.test.ts > UC10 protected_boundary_or_dependency_modified` | S14D |
| 3 | `tests/shell-capability/unsafeCounters.test.ts > UC10 protected_boundary_or_dependency_modified` | S14C |
| 4 | `tests/github-capability/regressions.test.ts > the Part B candidate surface is exactly additive under the authorized prefixes` | S14F |
| 5 | `tests/github-capability/unsafeCounters.test.ts > UC09 protected_boundary_dependency_or_prior_phase_drift` | S14F |
| 6 | `tests/github-capability/hardInvariants.test.ts > S14F-HI-028` | S14F |
| 7 | `tests/git-capability/regressions.test.ts > the S14D candidate surface is exactly additive under the authorized prefixes` | S14D |
| 8 | `tests/github-capability/githubCapability.test.ts > FX-NEG-024` | S14F |
| 9 | `tests/shell-capability/shellCapability.test.ts > FX-NEG-042` | S14C |
| 10 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-002` | S14C |
| 11 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-033` | S14C |
| 12 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-037` | S14C |
| 13 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-038` | S14C |
| 14 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-039` | S14C |
| 15 | `tests/git-capability/gitCapability.test.ts > FX-NEG-040` | S14D |
| 16 | `tests/git-capability/gitCapability.test.ts > S14D-HI-002` | S14D |
| 17 | `tests/git-capability/gitCapability.test.ts > S14D-HI-039` | S14D |
| 18 | `tests/git-capability/gitCapability.test.ts > S14D-HI-040` | S14D |

### 7.2 Authorized dependency pin (2)

The two additional legacy failures authorized in S14G Clarification-01 are caused exclusively by the exact pinned `playwright-core@1.63.0` manifest change.

| # | Identity |
|---|---|
| 19 | `tests/github-capability/regressions.test.ts > no new dependency or protected prior-phase surface was modified` |
| 20 | `tests/github-capability/hardInvariants.test.ts > S14F-HI-027` |

### 7.3 Additional failures requiring Clarification-02 (15)

The remaining 15 failures are also caused solely by the authorized S14G dependency/package change or the addition of S14G provider/test files. They are not S14G implementation regressions (all S14G tests pass), but they are not covered by Clarification-01 and require ChatGPT source-review recheck / Clarification-02.

| # | Identity | Cause / detector |
|---|---|---|
| 21 | `tests/async-reliability/asyncReliability.test.ts > S13O exact negative inventory FX-NEG-046 dependency or vendor binding` | `dependencyManifestsPreserved()` sees `playwright-core` |
| 22 | `tests/async-reliability/asyncReliability.test.ts > S13O builder hard-invariant and unsafe evidence derives HI-001 through HI-049` | `HI-047` `dependencyManifestsPreserved()` sees `playwright-core` |
| 23 | `tests/backend-api-engineering/backendApiEngineering.test.ts > T91 package manifest has no new runtime dependency` | `dependencies` contains `playwright-core` |
| 24 | `tests/capability-registry/capabilityRegistry.test.ts > FX-NEG-027 new runtime dependency added package.json and package-lock.json are not byte-identical to baseline` | `package.json` / `package-lock.json` hash differs from S14A baseline |
| 25 | `tests/capability-registry/capabilityRegistry.test.ts > S14A unsafe counters UC11 new_dependency_added == 0` | `package.json` / `package-lock.json` hash differs from S14A baseline |
| 26 | `tests/git-capability/gitCapability.test.ts > FX-NEG-041` | `dependencies` contains `playwright-core` |
| 27 | `tests/git-capability/gitCapability.test.ts > S14D-HI-020` | `dependencies` contains `playwright-core` |
| 28 | `tests/frontend-product-surface/frontendProductSurface.test.ts > T97/T98 manifests/Core/Part A/boundaries remain untouched and catalog append-only` | `dependencies` contains `playwright-core` |
| 29 | `tests/filesystem-capability/filesystemCapability.test.ts > FX-NEG-034` | `protectedDifferences()` includes `package-lock.json` and `package.json` |
| 30 | `tests/filesystem-capability/filesystemCapability.test.ts > S14B-HI-033` | `protectedDifferences()` includes `package-lock.json` and `package.json` |
| 31 | `tests/filesystem-capability/filesystemCapability.test.ts > S14B-HI-034` | `protectedDifferences()` includes `package-lock.json` and `package.json` |
| 32 | `tests/filesystem-capability/registryCompatibility.test.ts > S14B-COMP-HI-011` | `protectedDifferences()` includes `package-lock.json` and `package.json` |
| 33 | `tests/filesystem-capability/unsafeCounters.test.ts > UC10 protected_boundary_modified` | `protectedDifferences()` includes `package-lock.json` and `package.json` |
| 34 | `tests/guardrails-security/guardrailsSecurity.test.ts > T106-T112 append-only catalog, package/Core and adjacent-stage boundaries` | `dependencies` contains `playwright-core` |
| 35 | `tests/postgres-data-modeling/postgresDataModeling.test.ts > T93-T96 no DB/runtime/future-stage implementation or S07 mutation` | `dependencies` contains `playwright-core` |

All 15 are classified as **POTENTIAL_CLARIFICATION_02_S14G_SURFACE_OR_DEPENDENCY**: no S14G canonical test fails, no protected file is modified, the only new dependency is `playwright-core@1.63.0`, and the only new source/test files are within `src/providers/capability/browser/` and `tests/browser-capability/`.

## 8. Boundary and identity checks

- Part A canonical SHA-256:
  - `brain-bootstrap/skills/BROWSER_CAPABILITY_SKILL_S14G.md`: `de6a3d9d70cccf261659bf3c1a3251b10f935d9da9d18e579d5ab671a8874a40`
  - `brain-bootstrap/specs/BROWSER_CAPABILITY_CONTRACT_S14G.md`: `e03f604bfce71ba663db72cb78c7be5f455f6bf4ab300a997fa03b6557ed2a0a`
  - `brain-bootstrap/quality-contracts/S14G_BROWSER_CAPABILITY_DEEP.yaml`: `2b5711c4533c43bbbebf9e48eb30f65467b57d76cae3bce52b353b7cada4e77a`
- `src/core/**`: no diff from Part A baseline.
- `src/providers/capability/registry/` and `src/providers/capability/restricted/`: no diff from Part A baseline.
- `src/agent-definitions/**`: no diff from Part A baseline.
- `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md`: no diff from Part A baseline.
- `package.json` diff: only the addition of `"playwright-core": "1.63.0"` in `dependencies`.
- `git diff --check e4c90bc..HEAD`: clean.
- `dist/`, browser cache, traces, videos, HAR, screenshots, downloads: not committed.
- No S14H+ artifacts present.

## 9. Source-review disposition

- All six SR-G findings (SR-G-001 through SR-G-006) are implemented and tested.
- Focused S14G suite passes (123/123).
- Real Chromium success smoke passes.
- Pre/post-build failure sets are identical (35 failures).
- The 35 full-suite failures reconcile to 18 inherited + 2 authorized dependency + 15 additional dependency/boundary checks.
- The 15 additional failures are not S14G implementation regressions; they require the ChatGPT source-review recheck and exact Clarification-02 decision described in the control-plane STEP_STATUS.
- Independent verification has not been launched.
