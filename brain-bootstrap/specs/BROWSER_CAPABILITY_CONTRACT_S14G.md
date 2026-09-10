# S14G — Browser Inspect Capability Semantic Contract

**Parent:** S14 — Capability Registry, Tools and MCP  
**Phase:** S14G  
**Version:** 1.0.0  
**Status:** AUTHORING_READY  
**Classification:** RUNTIME_INFRASTRUCTURE  
**Depth:** DEEP  
**Semantic-authoring baseline:** `a3d73f6ae6d947b44391f0e13c065e58ecd4c002`  
**Honor invariant:** `HI-054 NOT_AWARDED`

## 1. Authority and phase boundary

The S14 parent contract defines the order:

```text
S14F GitHub
S14G Browser
S14H PostgreSQL Inspect
S14I Generic MCP Adapter
```

and gives `browser.inspect` as the canonical browser capability example.

S14F is verified and integrated. S14 remains open.

This contract is S14G Part A only. Part B requires separate explicit ChatGPT authorization after mechanical Part A integration and exact baseline measurement.

## 2. Exact capability and side effect

S14G v1 advertises exactly:

```text
browser.inspect
```

with:

```text
side_effects = EXTERNAL
```

The operation is read-oriented but can originate network traffic. No browser interaction/mutation capability is hidden inside it.

## 3. Existing interfaces remain unchanged

Reuse without semantic change:

```text
CapabilityProvider
ToolDescriptor
ToolInvocationRequest
ToolInvocationResult
NormalizedToolError
ToolSideEffectClass
RestrictedCapabilityProvider
CapabilityRegistryProvider
AgentDefinition.tools
AgentDefinition.capabilities
```

No Playwright/Chromium field enters `AgentDefinition`.

Any demonstrated need to modify Core, AgentDefinition semantics, Registry semantics, Restricted semantics, or the side-effect enum returns:

```text
CHATGPT_AUTHORING_REQUIRED
```

## 4. Closed input schema

```json
{
  "type": "object",
  "properties": {
    "url": {"type": "string", "minLength": 1, "maxLength": 2048},
    "wait_until": {"type": "string", "enum": ["domcontentloaded", "load"]}
  },
  "required": ["url"],
  "additionalProperties": false
}
```

Runtime validation is authoritative even if descriptor validation is bypassed.

## 5. Trusted configuration

Reference provider-layer shape:

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

Bounds:

```text
browser_id: 1..160 ASCII; ^[a-z0-9][a-z0-9._-]{0,159}$
allowed_navigation_origins: 1..8 unique canonical HTTPS origins
allowed_request_origins: 1..32 unique canonical HTTPS origins
allowed_navigation_origins ⊆ allowed_request_origins
max_timeout_ms: integer 1..60000
snapshot_depth: integer 1..20
max_snapshot_bytes: integer 4096..262144
max_links: integer 0..100
```

Each configured origin must canonicalize to exactly `scheme://host[:port]` with HTTPS and no userinfo/path/query/fragment.

Reject wildcard origins, IP literals, localhost, `.localhost`, `.local`, single-label hosts, controls/spaces, and non-HTTPS origins.

Unknown config fields fail closed.

Forbidden config keys/surfaces include:

```text
browser
engine
channel
executable_path
args
headless
proxy
headers
cookies
storage_state
http_credentials
client_certificates
permissions
user_agent
locale
timezone
viewport
downloads
service_workers
websocket
cdp
endpoint
connect
connect_over_cdp
env
```

## 6. Exact dependency and engine decision

S14G Part B may add exactly one runtime dependency:

```text
playwright-core: 1.63.0
```

Exact version; no semver range.

No other dependency or existing-version change is authorized.

Production engine:

```text
Playwright-managed Chromium
headless = true
```

Forbidden:

```text
chromium.connect
chromium.connectOverCDP
launchPersistentContext
executablePath override
channel override
custom model/config Chromium args
proxy
persistent browser profile
```

Browser executable files/cache are environment state, never Git content.

## 7. Browser binary/runtime provisioning

The pinned package does not itself guarantee a runnable browser executable.

After Part B authorization, canonical QA may perform only the user-level untracked install:

```bash
npx playwright-core install chromium
```

Not automatically authorized:

```text
sudo
apt/apt-get
npx playwright-core install-deps
branded Chrome/Edge install
global npm install
system-wide browser replacement
```

If Chromium cannot launch without unapproved system mutation, return:

```text
BLOCKED / BROWSER_RUNTIME_UNAVAILABLE
```

with exact missing-runtime evidence.

## 8. Browser isolation

Every invocation uses:

```text
fresh browser launch
fresh non-persistent BrowserContext
exactly one primary Page
serviceWorkers = block
no persistent userDataDir
no storage state
no HTTP credentials
no proxy
no client certificate
no granted permissions
no trace/video/HAR/screenshot artifact
```

No cookie/storage/profile state survives invocation completion.

Pooling/reuse is deferred because the current provider interface has no canonical browser-process lifecycle contract.

## 9. Input URL validation

`url` must:

```text
be valid UTF-8
be <= 2048 UTF-8 bytes
parse as an absolute URL
use https:
have no username/password
have a hostname
have exact origin in allowed_navigation_origins
```

Reject:

```text
http:
file:
data:
javascript:
blob:
about:
ftp:
ws:
wss:
localhost
IP-literal top-level navigation
unapproved origin
embedded credentials
control characters
malformed URL
```

Path/query/fragment are allowed only after the trusted origin passes.

`wait_until` defaults to `domcontentloaded`; only `domcontentloaded` and `load` are accepted. `networkidle` is not exposed.

## 10. Request routing policy

Before page navigation, the provider installs BrowserContext routing for all HTTP(S) requests.

A request may continue only if:

```text
scheme == https
method == GET or HEAD
origin ∈ allowed_request_origins
```

No request method is rewritten. No request is fulfilled using model-provided content. No provider Authorization/Cookie/custom header is added.

Main-frame navigation must also remain within `allowed_navigation_origins`.

Redirect hops remain subject to request routing before continuation. After `goto`, final `page.url()` is revalidated against allowed navigation origins before success.

## 11. Service workers and WebSockets

BrowserContext MUST use:

```text
serviceWorkers: "block"
```

because request interception otherwise does not cover service-worker-handled requests reliably.

Before page creation/navigation, WebSocket routing is installed and WebSockets are prevented from connecting to servers.

S14G v1 has no WebSocket allowlist.

## 12. Popups, downloads, dialogs, extra pages

Exactly one primary Page is allowed.

Any extra Page/popup created by remote content is immediately closed and must prevent a hidden second-page success.

Downloads are never persisted and never implicitly invoke filesystem behavior.

A navigation that becomes a download fails safely.

Blocking dialogs are provider-dismissed so remote content cannot hang the invocation. Dialog text is not returned.

## 13. Snapshot semantics

After successful navigation, obtain:

```text
title
final URL
ARIA snapshot JSON
bounded links
```

Use provider-owned ARIA options equivalent to:

```text
mode = "default"
boxes = false
depth = config.snapshot_depth
signal = invocation deadline signal
timeout = 0
```

`mode = "ai"` is not canonical because page references are useless after the page is closed.

Model-supplied JavaScript/evaluate source, locator programs, selectors, and Playwright commands are forbidden.

Links may be extracted only through a fixed provider-owned routine.

Each normalized link:

```text
text <= 512 UTF-8 bytes
url <= 2048 UTF-8 bytes
absolute HTTPS URL only
```

At most `max_links` are returned in deterministic DOM order. If more exist, `links_truncated = true`.

ARIA snapshot itself is never silently truncated. Snapshot overflow fails the whole invocation.

## 14. Output

Reference:

```ts
interface BrowserInspectionObservation {
  browser_id: string;
  final_url: string;
  title: string;
  aria_snapshot: unknown;
  links: Array<{
    text: string;
    url: string;
  }>;
  links_truncated: boolean;
  observed_at: string;
}
```

Bounds:

```text
title <= 1024 UTF-8 bytes
final_url <= 2048 UTF-8 bytes
snapshot <= config.max_snapshot_bytes
links <= config.max_links
serialized success <= 393216 UTF-8 bytes
observed_at = UTC ISO-8601
safe error <= 160 ASCII chars
```

Output must not contain raw HTML, script source, cookies, local/session storage, browser args/path, HTTP headers/bodies, console output, network dump, stack trace, Playwright objects/errors, downloads, screenshots, traces, videos, or HAR.

## 15. Remote content is inert

Page title/text/ARIA/link text is untrusted remote data.

It cannot change config, origins, request methods, permissions, routing, AgentDefinition, capability selection, browser engine, deadline, WebSocket/service-worker policy, or invoke another capability.

No production logic branches on remote prose such as “ignore previous rules”.

## 16. One deadline

One monotonic invocation deadline starts at `invoke()` entry:

```text
effective_timeout = min(request.timeout_ms, config.max_timeout_ms)
```

The same budget covers:

```text
validation
browser launch
context creation
route installation
page creation
navigation
title/snapshot/link extraction
normalization
final success check
```

Where Playwright supports AbortSignal, use the same invocation signal.

Where an async operation does not support AbortSignal, bound the Promise with the same deadline/controller using a provider-private race helper. Do not introduce a second resettable timeout budget.

Timeout:

```text
FAIL / TIMEOUT / retryable true
```

No partial success.

## 17. Bounded cleanup

Regardless of SUCCESS/FAIL/TIMEOUT, close best-effort in `finally`:

```text
page -> context -> browser
```

Cleanup cannot turn a primary failure into success and must itself be bounded.

Tests must cover timeout/failure during launch, navigation, snapshot, and cleanup, including a close that never resolves.

No provider-created process/page/context/timer/listener remains after legitimate bounded cleanup paths.

## 18. Error normalization

Reuse existing Brain error codes.

| Condition | Result |
|---|---|
| malformed/extra input | `FAIL / INVALID_INPUT / false` |
| URL/origin/method policy denial | `FAIL / PERMISSION_DENIED / false` |
| browser binary/runtime unavailable | `FAIL / UNAVAILABLE / true` |
| navigation DNS/TLS/network failure | `FAIL / UNAVAILABLE / true` |
| timeout | `FAIL / TIMEOUT / true` |
| snapshot/output overflow | `FAIL / EXECUTION_FAILED / false` |
| popup/download/forbidden browser channel | `FAIL / PERMISSION_DENIED / false` |
| unexpected provider defect | `FAIL / INTERNAL_ERROR / false` |

Raw Playwright/page errors, stack traces, browser paths, remote HTML, headers, or secrets are never surfaced.

## 19. Restricted and registry composition

Registry routing is not authorization.

A denied `browser.inspect` or denied `EXTERNAL` side-effect class MUST cause:

```text
zero browser launch
zero context/page creation
zero network
```

The actual runtime path must still be through Registry + Restricted + `runAgent` composition.

## 20. Provider-swap invariant

Part B must prove:

```text
same AgentDefinition bytes
same capability_id = browser.inspect
same semantic input
same permission policy

configuration A:
browser.inspect -> Playwright Chromium provider

configuration B:
browser.inspect -> independently implemented compatible deterministic test provider
```

No provider-specific Core branch is allowed.

## 21. Explicit forbidden operation surface

No reachable S14G v1 operation for:

```text
click
fill
type
select
press
submit
upload
download
screenshot
pdf
evaluate
cookies
storage
auth
persistent session
browser pooling
remote attach/CDP
proxy
permissions
geolocation
camera/microphone
clipboard
WebAuthn
extensions
multiple-page workflows
WebSockets
service workers
non-HTTPS navigation
private/internal-network browsing
```

## 22. Part B test strategy

Canonical tests use a provider-private deterministic browser/factory seam plus pure network-policy, deadline, cleanup, and unsafe-counter oracles.

The production candidate may not branch on fixture IDs or expected outcomes.

Part B also requires a real no-network smoke:

```text
import playwright-core 1.63.0
locate Playwright-managed Chromium
launch headless
create non-persistent context
create page
set provider-owned static content
capture ariaSnapshotJSON
close page/context/browser
```

The real smoke proves package/engine integration only; public internet is not required.

## 23. No-auth boundary

S14G v1 does not accept or resolve:

```text
credential_ref
storage_state_ref
cookie
Authorization header
HTTP Basic credentials
client certificates
password
browser profile
```

Authenticated browsing requires a future separate secret/session contract.

## 24. Part B allowed scope

Part B may modify only:

```text
src/providers/capability/browser/**
tests/browser-capability/**
brain-bootstrap/reports/S14G-browser-capability-verification.md
package.json
package-lock.json
```

`package.json` and `package-lock.json` may change only for the exact pinned addition:

```text
playwright-core = 1.63.0
```

No Part B change to:

```text
src/core/**
AgentDefinition semantics
RestrictedCapabilityProvider
CapabilityRegistryProvider
brain-bootstrap/STATE.yaml
brain/context/CURRENT.md
S14A-S14F canonical artifacts/implementations
S14H+
```

Continuity state changes belong only to later control-plane-approved phase closure.

## 25. Baseline failure policy

The Part B implementation baseline is the exact **Part A integration SHA**, not the semantic-authoring SHA.

After Part A integration, create a fresh WSL-native/ext4 worktree using Node 24.19.x and Linux npm, run `npm ci`, full suite before build, genuine build, and full suite after build.

Capture raw counts, every failure identity, and exact assertion cause.

Do **not** assume S14G inherits exactly the previous 14 failures: S14F closure changed continuity files and prior regression detectors are byte-sensitive.

Any later baseline allowance is exact-identity + exact-cause only. No wildcard based on wording such as “STATE/CURRENT drift”.

Do not edit historical tests or continuity files to make the suite green.

Windows `/mnt/c` primary-worktree output is not canonical evidence for byte-sensitive gates because S14F already established a real CRLF/autocrlf contamination mode.

## 26. Part B quality requirements

Builder must prove at minimum:

```text
Node 24.19.x
playwright-core exactly 1.63.0
Part A byte identity
Core byte identity
AgentDefinition byte identity
S14A-S14F protected identity
exact dependency diff
exact browser.inspect descriptor
EXTERNAL side effect
closed input/runtime validation
trusted exact-origin config
HTTPS-only navigation
GET/HEAD-only routed requests
redirect/final-URL revalidation
service workers blocked
WebSockets blocked
fresh nonpersistent browser state
no auth/storage
no interaction/model JS
popup/download blocking
bounded ARIA/link/output
one deadline
bounded cleanup
safe error normalization
Restricted denial before launch/network
provider swap same AgentDefinition
real Chromium no-network smoke
all hard invariants/fixtures/unsafe counters
full baseline/candidate pre-build comparison
genuine build
full candidate post-build comparison
git diff --check
no tracked browser/cache/dist artifacts
```

## 27. Independent gate and lifecycle

After builder QA and ChatGPT source review, verification must use a fresh non-authoring, non-builder, non-fork, read-only verifier on the exact committed remote candidate in a clean WSL-native/ext4 worktree.

A successful S14G closure leaves:

```text
S14G = PHASE_PASS
S14 = IN_PROGRESS / NOT_CLOSED
S14H = NOT_AUTHORIZED
HI-054 = NOT_AWARDED
```
