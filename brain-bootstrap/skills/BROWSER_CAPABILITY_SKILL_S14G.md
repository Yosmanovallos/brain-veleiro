# S14G — Browser Inspect Capability Skill

Version 1.0.0 · AUTHORING_READY · RUNTIME_INFRASTRUCTURE / DEEP.  
Semantic-authoring baseline: `a3d73f6ae6d947b44391f0e13c065e58ecd4c002`.

## Objective

Implement S14G as a bounded read-oriented browser inspection provider behind the existing `CapabilityProvider`, `CapabilityRegistryProvider`, and `RestrictedCapabilityProvider` boundaries.

S14G v1 exposes exactly:

```text
browser.inspect
```

with:

```text
side_effects = EXTERNAL
```

The capability renders and inspects JavaScript-driven public HTTPS pages while keeping Playwright, Chromium, browser executable identity, network policy, and provider identity outside `AgentDefinition`.

## Narrow v1 boundary

S14G v1 deliberately does **not** click, type, fill, select, submit, upload, download, screenshot, execute model-supplied JavaScript, persist browser sessions, reuse cookies/storage, authenticate, attach to a user's browser, connect over CDP, use a proxy, or browse arbitrary/internal origins.

Interactive/authenticated computer-use semantics require a future separate authoring gate.

## Exact input

```ts
interface BrowserInspectInput {
  url: string;
  wait_until?: "domcontentloaded" | "load";
}
```

The object is closed. `wait_until` defaults to `domcontentloaded`. `networkidle` is not exposed.

## Trusted provider configuration

```ts
interface BrowserInspectProviderConfig {
  browser_id: string;
  allowed_navigation_origins: string[];
  allowed_request_origins: string[];
  max_timeout_ms: number;
  snapshot_depth: number;
  max_snapshot_bytes: number;
  max_links: number;
}
```

Model input cannot override engine, executable/channel, browser args, headless mode, proxy, origins, request methods, headers, cookies, storage state, HTTP credentials, client certificates, permissions, WebSockets, service workers, downloads, locale, timezone, viewport, CDP, or remote browser endpoint.

## Browser engine decision

Part B may add exactly:

```text
playwright-core = 1.63.0
```

as a pinned runtime dependency. No caret/range and no other package/version change.

Production v1 uses Playwright-managed Chromium in headless mode. Browser binaries are runtime/deployment artifacts and must never be committed.

Canonical QA may later install Chromium to the user's Playwright cache with:

```bash
npx playwright-core install chromium
```

only after Part B authorization. `sudo`, `install-deps`, branded browser installation, executable-path override, browser-channel override, and system-wide mutation are not authorized by this Part A.

## Isolation

Every invocation uses:

```text
fresh browser launch
fresh non-persistent BrowserContext
exactly one primary Page
serviceWorkers = block
WebSockets blocked
GET/HEAD-only browser network policy
no persistent userDataDir
no auth/storage state
no trace/video/HAR/screenshot artifacts
```

Per-invocation launch/close is intentionally preferred over pooling because the current capability contract has no canonical browser-process lifecycle.

## Network policy

The input URL must be absolute HTTPS, credential-free, bounded, and its exact origin must already exist in trusted `allowed_navigation_origins`.

Every browser HTTP(S) request is intercepted before continuation and must satisfy:

```text
scheme = https
method = GET or HEAD
origin ∈ allowed_request_origins
```

`allowed_navigation_origins` must be a subset of `allowed_request_origins`.

Configured origins are exact, with no wildcards, and reject IP literals, localhost, `.localhost`, `.local`, userinfo, query/fragment/path components, and non-HTTPS schemes. S14G v1 is for explicitly approved public DNS origins, not private-network browsing.

Service workers are blocked before navigation. WebSocket connections are prevented from connecting. Redirect hops remain subject to routing policy, and final main-frame URL is revalidated before output.

## Snapshot

After allowed navigation, the provider returns normalized inert data:

```text
page title
final URL
bounded ARIA snapshot JSON
bounded HTTPS links
UTC observed_at
```

ARIA snapshot uses provider-owned options equivalent to:

```text
mode = default
boxes = false
depth = config.snapshot_depth
signal = invocation deadline signal
timeout = 0
```

The model cannot provide an evaluate expression, selector program, or browser command.

Links are extracted only by provider-owned fixed logic and returned in deterministic DOM order. At most `max_links` are returned; list truncation is explicit through `links_truncated`.

ARIA snapshot itself is not silently truncated. Overflow fails the whole invocation.

## Output

```ts
interface BrowserInspectionObservation {
  browser_id: string;
  final_url: string;
  title: string;
  aria_snapshot: unknown;
  links: Array<{ text: string; url: string }>;
  links_truncated: boolean;
  observed_at: string;
}
```

Do not return raw HTML, cookies, storage, browser process arguments, executable path, request/response headers or bodies, console logs, stack traces, screenshots, traces, videos, HAR files, or downloaded bytes.

## Deadline and cleanup

One monotonic deadline starts at `invoke()` entry:

```text
effective_timeout = min(request.timeout_ms, config.max_timeout_ms)
```

The same budget covers validation, browser launch, context/page creation, route installation, navigation, snapshot/link extraction, normalization, and final success.

Use the same AbortSignal where Playwright supports it. Any awaited operation without native signal support must be bounded by the same deadline/controller, not a reset timer.

In `finally`, page, context, and browser are closed best-effort. Cleanup itself is bounded. No browser process/timer/listener/page may remain after legitimate cleanup paths.

## Verification

Canonical tests use a provider-private deterministic browser seam plus request-policy and cleanup oracles. Production behavior may not branch on fixture IDs or expected outcomes.

Part B must also prove a real no-network Playwright/Chromium smoke: import the pinned package, launch headless Chromium, create a non-persistent context and page, set provider-owned static content, capture `ariaSnapshotJSON`, and close cleanly.

Public internet and real accounts are not canonical test dependencies.

A fresh non-authoring, non-builder, non-fork, read-only verifier is required on the exact committed candidate, followed by separate ChatGPT acceptance.

Phase PASS leaves:

```text
S14G = PHASE_PASS
S14 = IN_PROGRESS / NOT_CLOSED
S14H = NOT_AUTHORIZED
HI-054 = NOT_AWARDED
```
