# S14G Browser Capability — Verification Report

## 1. Candidate identity

- Branch: `s14g-browser-capability-part-b`
- Part A baseline: `e4c90bc8a43f1ffb855617ba7db30ce4e46d2595`
- Node: `24.19.0` / npm: `11.17.0` / WSL-native
- Environment: `/home/yosman/brain-s14g-part-b` (Ubuntu on WSL)

## 2. Authorized scope

Additions are limited to:

- `src/providers/capability/browser/` — production provider (read-only browser inspect)
- `tests/browser-capability/` — deterministic fake factory, fixtures, hard invariants, unsafe counters, regressions, audit
- `brain-bootstrap/reports/S14G-browser-capability-verification.md`
- `package.json` and `package-lock.json` — exact pin of `playwright-core@1.63.0` only

Protected surfaces **not modified**:

- `src/core/**`
- `brain-bootstrap/STATE.yaml`
- `brain/context/CURRENT.md`
- S14A–S14F canonical files and implementations
- S14H+ surfaces

## 3. Implementation summary

Public capability:

```text
capability_id: browser.inspect
side_effects: EXTERNAL
```

Trusted provider config is closed and host-side; `BrowserInspectProviderConfig` exposes only the seven approved keys:

- `browser_id`
- `allowed_navigation_origins`
- `allowed_request_origins`
- `max_timeout_ms`
- `snapshot_depth`
- `max_snapshot_bytes`
- `max_links`

Runtime guarantees:

- One fresh Playwright Chromium launch per invocation, one non-persistent context, `serviceWorkers: "block"`
- HTTPS-only, GET/HEAD-only, origin-bound request routing
- Blocked redirects, downloads, popups, WebSockets, dialogs, non-GET/HTTPS methods
- Bounded ARIA snapshot and normalized HTTPS link extraction
- Single monotonic deadline with abort-driven cleanup
- Safe normalized error codes without raw browser payload leakage

Test coverage under `tests/browser-capability/`:

- 10 positive fixtures (`FX-POS-001`–`FX-POS-010`)
- 24 negative fixtures (`FX-NEG-001`–`FX-NEG-024`)
- 30 hard invariants (`HI-G-01`–`HI-G-30`)
- 10 unsafe counters (`UC-G-01`–`UC-G-10`)
- 4 regression tests (`RG-G-01`–`RG-G-04`)
- `audit.ts` with source scanners and git boundary helpers

## 4. Quality assurance

### 4.1 Type check

```bash
npm run typecheck
```

Result: `PASS` (exit 0).

### 4.2 Build

```bash
npm run build
```

Result: `PASS` (exit 0). `dist/` was generated and then removed before final status; it is not part of the commit.

### 4.3 Focused S14G test suite

```bash
npx vitest run tests/browser-capability
```

Result: `PASS` — 4 test files, 78 tests, 0 failures.

| Group | Count | Status |
|---|---|---|
| `browserCapability.test.ts` | 34 | PASS |
| `hardInvariants.test.ts` | 30 | PASS |
| `unsafeCounters.test.ts` | 10 | PASS |
| `regressions.test.ts` | 4 | PASS |

The real Playwright Chromium no-network smoke (`FX-POS-010` / `HI-G-10`) passes: an unreachable allowed origin returns `FAIL` with `TIMEOUT` or `UNAVAILABLE`, retryable `true`.

### 4.4 Full pre-build test run

Measured against the Part A baseline `e4c90bc` in an isolated `git worktree`:

- Test files: 48
- Tests: 2045
- Pass: 2027
- Fail: 18

All 18 baseline failures are inherited boundary-assertion failures in prior-phase test suites (git, github, shell) caused by `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` being different from those older phase baselines. No S14G code is involved.

### 4.5 Full post-build test run

Measured on the candidate:

- Test files: 52
- Tests: 2123
- Pass: 2088
- Fail: 35

The 35 failures break down as:

- 18 inherited failures (identical in identity and cause to the baseline run).
- 17 new failures in prior-phase boundary/dependency checks due to the authorized `playwright-core` pin in `package.json`/`package-lock.json` and the addition of `src/providers/capability/browser/` and `tests/browser-capability/` files (all new files are inside the S14G-authorized prefixes).

No S14G test fails. No protected file is modified. All 35 failures are attributable to prior-phase audit fixtures using baselines older than the Part A baseline.

### 4.6 Git checks

```bash
git status --short
```

Result:

```text
(clean — all authorized additions are committed)
```

```bash
git diff --check
```

Result: no whitespace errors.

```bash
git diff --name-status e4c90bc8a43f1ffb855617ba7db30ce4e46d2595
```

Result:

```text
A       brain-bootstrap/reports/S14G-browser-capability-verification.md
M       package-lock.json
M       package.json
A       src/providers/capability/browser/browserCapabilityProvider.ts
A       src/providers/capability/browser/chromiumFactory.ts
A       src/providers/capability/browser/descriptors.ts
A       src/providers/capability/browser/index.ts
A       src/providers/capability/browser/types.ts
A       src/providers/capability/browser/validation.ts
A       tests/browser-capability/audit.ts
A       tests/browser-capability/browserCapability.test.ts
A       tests/browser-capability/cases.ts
A       tests/browser-capability/hardInvariants.test.ts
A       tests/browser-capability/helpers.ts
A       tests/browser-capability/regressions.test.ts
A       tests/browser-capability/unsafeCounters.test.ts
```

Part A canonical files (`brain-bootstrap/skills/BROWSER_CAPABILITY_SKILL_S14G.md`, `brain-bootstrap/specs/BROWSER_CAPABILITY_CONTRACT_S14G.md`, `brain-bootstrap/quality-contracts/S14G_BROWSER_CAPABILITY_DEEP.yaml`) are byte-identical to Part A baseline.

No S14H+ artifacts are present.

## 5. Inherited baseline failures

| # | Failure identity | Cause | S14G attribution |
|---|---|---|---|
| 1 | `tests/git-capability/gitCapability.test.ts > FX-NEG-040` | Prior-phase `assertBoundaries` (STATE/CURRENT drift from S14D baseline) | Inherited |
| 2 | `tests/git-capability/gitCapability.test.ts > S14D-HI-002` | Same as #1 | Inherited |
| 3 | `tests/git-capability/gitCapability.test.ts > S14D-HI-039` | Same as #1 | Inherited |
| 4 | `tests/git-capability/gitCapability.test.ts > S14D-HI-040` | Same as #1 | Inherited |
| 5 | `tests/git-capability/regressions.test.ts` | Same as #1 | Inherited |
| 6 | `tests/git-capability/unsafeCounters.test.ts > UC10` | Same as #1 | Inherited |
| 7 | `tests/github-capability/githubCapability.test.ts > FX-NEG-024` | `assertBoundaries` (STATE/CURRENT drift from S14F baseline) | Inherited |
| 8 | `tests/github-capability/hardInvariants.test.ts > S14F-HI-028` | Same as #7 | Inherited |
| 9 | `tests/github-capability/regressions.test.ts` | Same as #7 | Inherited |
| 10 | `tests/github-capability/unsafeCounters.test.ts > UC09` | Same as #7 | Inherited |
| 11 | `tests/shell-capability/regressions.test.ts` | `assertBoundaries` (STATE/CURRENT drift from S14B baseline) | Inherited |
| 12 | `tests/shell-capability/shellCapability.test.ts > FX-NEG-042` | Same as #11 | Inherited |
| 13 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-002` | Same as #11 | Inherited |
| 14 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-038` | Same as #11 | Inherited |
| 15 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-033` | Same as #11 | Inherited |
| 16 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-037` | Same as #11 | Inherited |
| 17 | `tests/shell-capability/shellCapability.test.ts > S14C-HI-039` | Same as #11 | Inherited |
| 18 | `tests/shell-capability/unsafeCounters.test.ts > UC10` | Same as #11 | Inherited |
| 19 | `tests/github-capability/hardInvariants.test.ts > S14F-HI-027` | `assertNoNewDependency` sees `playwright-core` | Authorized dependency pin |
| 20 | `tests/github-capability/regressions.test.ts > no new dependency` | Same as #19 | Authorized dependency pin |
| 21 | `tests/capability-registry/capabilityRegistry.test.ts > FX-NEG-027` | `package.json/package-lock.json` not byte-identical to baseline | Authorized manifest edit |
| 22 | `tests/capability-registry/capabilityRegistry.test.ts > UC11` | Same as #21 | Authorized manifest edit |
| 23 | `tests/filesystem-capability/filesystemCapability.test.ts > FX-NEG-034` | S14B audit sees S14G additions | Authorized S14G additions |
| 24 | `tests/filesystem-capability/filesystemCapability.test.ts > S14B-HI-033` | Same as #23 | Authorized S14G additions |
| 25 | `tests/filesystem-capability/filesystemCapability.test.ts > S14B-HI-034` | Same as #23 | Authorized S14G additions |
| 26 | `tests/filesystem-capability/registryCompatibility.test.ts > S14B-COMP-HI-011` | Same as #23 | Authorized S14G additions |
| 27 | `tests/filesystem-capability/unsafeCounters.test.ts > UC10` | Same as #23 | Authorized S14G additions |
| 28 | `tests/frontend-product-surface/frontendProductSurface.test.ts > T97/T98` | `package.json` new dependency | Authorized dependency pin |
| 29 | `tests/backend-api-engineering/backendApiEngineering.test.ts > T91` | `package.json` new runtime dependency | Authorized dependency pin |
| 30 | `tests/guardrails-security/guardrailsSecurity.test.ts` | `package.json` new dependency | Authorized dependency pin |
| 31 | `tests/postgres-data-modeling/postgresDataModeling.test.ts` | `package.json` new dependency | Authorized dependency pin |
| 32 | `tests/async-reliability/asyncReliability.test.ts > FX-NEG-046` | `package.json` new dependency | Authorized dependency pin |
| 33 | `tests/async-reliability/asyncReliability.test.ts > HI-001..049` | `package.json` new dependency | Authorized dependency pin |
| 34 | `tests/git-capability/gitCapability.test.ts > FX-NEG-041` | S14D audit sees S14G additions | Authorized S14G additions |
| 35 | `tests/git-capability/gitCapability.test.ts > S14D-HI-020` | Same as #34 | Authorized S14G additions |

## 6. Closure state

- S14: `IN_PROGRESS`
- S14G: `CANDIDATE_RETURNED_FOR_CHATGPT_SOURCE_REVIEW` — implementation and focused QA complete; full-suite legacy failure count (35) exceeds the control-plane authorized inventory (20). No S14G canonical test fails, and the extra 15 failures are prior-phase boundary/dependency guards. A fresh control-plane decision is required before independent verification.
- S14H: `NOT_AUTHORIZED`
- `HI-054`: `NOT_AWARDED`

## 7. Verifier declaration

This report was produced by the same S14G Part B authoring session. Final verification, independent fresh-session re-run, and control-plane acceptance are still required by the S14G contract.
