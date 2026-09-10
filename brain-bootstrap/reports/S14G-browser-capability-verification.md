# S14G Browser Capability — Verification Report

## 1. Candidate identity

- Branch: `s14g-browser-capability-part-b`
- Part A baseline: `e4c90bc8a43f1ffb855617ba7db30ce4e46d2595`
- Previous source-review-failed candidate: `df3cdb90e87d4d6b31580de4d33af18c98de10a1`
- SR-G repair candidate: `20e0ff780de7494e8e7039208f9fb1f534bc3f54`
- Canonical-traceability candidate (this report): `1c4a182e1336f8c87f0339a3c599ca05bacd7120`
- Node: `v24.19.0` / npm: `11.17.0` / WSL-native ext4
- `core.autocrlf`: `false`
- Dependency: `playwright-core@1.63.0` exact (verified with `npm ls playwright-core --depth=0`)

## 2. Builder and control-plane notes

- **Primary coding worker (production source + SR-G repairs):** Claude Code (model `Opus`) — S14G provider source and SR-G-001 through SR-G-006 repairs.
- **Coding worker (canonical traceability test repair):** Codex GPT-5.6 Sol — commit `1c4a182` reconciles the test IDs to the canonical Part A semantics. This worker override was authorized by control plane after the Claude Code session limit; Devin did not author the rewrite.
- **Control-plane finalization:** Devin completed final QA, the verification report, the STEP_STATUS, and the commit/push. No production source code was authored by Devin; all code changes originated from the authorized coding workers.
- **CODING_FALLBACK_TO_DEVIN:** NO.
- **Independent verification:** Not launched.

### 2.1 Diff bookkeeping

- **FULL_CANDIDATE_SCOPE** (`e4c90bc..1c4a182`): 24 paths — `src/providers/capability/browser/**`, `tests/browser-capability/**`, this report, `package.json`, `package-lock.json`.
- **SOURCE_REVIEW_REPAIR_DIFF** (`df3cdb9..20e0ff7`): 13 paths — 5 production files + 7 new test files + `helpers.ts` + this report (SR-G-001..006 repairs).
- **TRACEABILITY_REPAIR_DIFF** (`20e0ff7..1c4a182`): 6 paths, test-only — `browserCapability.test.ts`, `cases.ts`, `hardInvariants.test.ts`, `unsafeCounters.test.ts`, `canonicalCases.ts` (new), `canonicalTraceability.test.ts` (new).

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

## 4b. Canonical traceability repair (S14G-SOURCE-REVIEW-ROUND-2)

Test-only reconciliation of the S14G suite to the byte-locked Part A inventory. Production source unchanged (`PRODUCTION_DEFECT: NONE` from the coding worker; verified in control-plane review).

- `tests/browser-capability/canonicalCases.ts` (new): canonical `FX-POS-001..010` and `FX-NEG-001..024` registries, one executable body per Part A intent. Prior fixtures are preserved as `LEGACY-*` building blocks; new bodies were written where no legacy fixture covered the canonical intent (redirect FX-POS-004, legal-maxima FX-POS-007, subresource/method/websocket/service-worker/popup/model-input/error-normalization negatives, and the scripted-deadline negatives FX-NEG-016..020 built on `deadlineDoubles.ts`).
- `FX-POS-010` is now the real pinned `playwright-core@1.63.0` Playwright-managed Chromium no-network smoke (version pin check, real `launch`, `setContent`, `ariaSnapshotJSON`, route-abort network silence, clean close). The former unreachable-origin case no longer occupies FX-POS-010.
- `hardInvariants.test.ts`: exactly one explicit executable test per `S14G-HI-001..S14G-HI-030`; each test name contains the exact canonical ID and exercises the YAML rule.
- `unsafeCounters.test.ts`: exact `UC01..UC10` with the Part A names; each counter is zero on the legitimate candidate source and independently fires on a deliberately unsafe control string.
- `tests/browser-capability/canonicalTraceability.test.ts` (new): deterministic oracle that parses `brain-bootstrap/quality-contracts/S14G_BROWSER_CAPABILITY_DEEP.yaml` and proves exact set equality for positive/negative fixture IDs, `S14G-HI-001..030`, and `UC01..UC10` — no missing canonical ID, no extra ID masquerading as canonical; SR-G-* regressions remain additional/noncanonical.

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

Result: `PASS` — 11 test files, 125 tests, 0 failures (fresh WSL/ext4 worktree, `npm ci`, Node v24.19.0).

| Group | Count | Status |
|---|---|---|
| `browserCapability.test.ts` (FX-POS-001..010 + FX-NEG-001..024) | 34 | PASS |
| `hardInvariants.test.ts` (S14G-HI-001..030) | 30 | PASS |
| `unsafeCounters.test.ts` (UC01..UC10) | 10 | PASS |
| `canonicalTraceability.test.ts` (oracle) | 2 | PASS |
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

`SR-G-005-01: pinned playwright-core launches managed headless Chromium, snapshots static content and closes cleanly` passed, and canonical `FX-POS-010` (real Chromium no-network launch/context/snapshot/close) passed inside `browserCapability.test.ts`.

### 5.4 Timing-sensitive regression repeats

The full focused suite (`tests/browser-capability`, including the timing-sensitive deadline/cleanup and final-success-gate regressions) was run 10 consecutive times by the control plane in the fresh QA worktree. All 10 runs passed: 125/125 tests each run.

## 6. Build and full-suite QA

### 6.1 Pre-build

```bash
rm -rf dist
npm test
```

Result:

- Test files: 59 top-level files (19 failed | 40 passed)
- Tests: 2170
- Passed: 2135
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

- Tests: 2170
- Passed: 2135
- Failed: 35

Pre-build and post-build failure sets are identical (sorted-set diff: 0).

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

### 7.3 Additional failures authorized by Clarification-02 (15)

The remaining 15 failures are caused solely by the authorized S14G dependency/package change (`playwright-core@1.63.0` in `package.json`/`package-lock.json`). They are not S14G implementation regressions (all S14G tests pass) and are now explicitly authorized by `S14G-LEGACY-HARNESS-COMPATIBILITY-CLARIFICATION-02` (Issue #1 comment `5624887844`), which approves exactly 35 permitted legacy failures = 18 baseline + 2 Clarification-01 + 15 Clarification-02 — no wildcard, no old-test edits.

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

All 15 are authorized **S14G Clarification-02** identities: no S14G canonical test fails, no protected file is modified, the only new dependency is `playwright-core@1.63.0`, and the only new source/test files are within `src/providers/capability/browser/` and `tests/browser-capability/`. Observed detector causes match the permitted set exactly: protected-difference detectors report only `['package-lock.json', 'package.json']`; dependency detectors report only the added `playwright-core` key; the four Clarification-01 cause expansions report `STATE.yaml` + `CURRENT.md` + `package-lock.json` + `package.json`.

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
- Canonical traceability reconciled: `FX-POS-001..010`, `FX-NEG-001..024`, `S14G-HI-001..030`, `UC01..UC10` one-to-one with the Part A YAML, proven by the deterministic oracle `canonicalTraceability.test.ts`.
- Focused S14G suite passes (125/125, 11 files) including the real Chromium no-network smoke (`FX-POS-010`, `SR-G-005-01`).
- Timing-sensitive regressions: 10/10 consecutive full focused-suite runs pass.
- Pre/post-build failure sets are identical: exactly 35 failures.
- The 35 full-suite failures reconcile to 18 inherited baseline + 2 Clarification-01 + 15 Clarification-02 (Issue #1 comment `5624887844`), with exact approved causes only.
- Independent verification has not been launched; the candidate awaits ChatGPT final source-review recheck.
