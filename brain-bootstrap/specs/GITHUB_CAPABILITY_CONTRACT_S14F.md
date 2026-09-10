# S14F — GitHub Capability Semantic Contract

**Parent step:** S14  
**Phase:** S14F  
**Name:** GitHub  
**Version:** 1.0.0  
**Status:** AUTHORING_READY  
**Classification:** RUNTIME_INFRASTRUCTURE  
**Depth:** DEEP  
**Semantic-authoring baseline:** `3bb02b72925c68c59782f085796b47ba9aef078b`  
**Honor invariant:** `HI-054 NOT_AWARDED`

---

## 1. Authority and scope

This document is canonical S14F Part A semantics.

S14 requires capabilities to remain provider-neutral and places GitHub after Documentation/Search in the incremental capability roadmap. S14E is verified and integrated on the exact baseline above; S14 remains open.

S14F creates one GitHub REST provider behind existing capability infrastructure. It does not create a new Core connector abstraction, Auth Manager, MCP layer, workflow runtime, verifier agent or orchestrator.

Part B requires a separate explicit control-plane authorization after these three S14F Part A artifacts are integrated byte-for-byte and the repository facts are rechecked.

## 2. Existing interfaces preserved

S14F MUST reuse without semantic change:

```text
CapabilityProvider
ToolDescriptor
ToolInvocationRequest
ToolInvocationResult
NormalizedToolError
ToolSideEffectClass = NONE | LOCAL | EXTERNAL
RestrictedCapabilityProvider
CapabilityRegistryProvider
AgentDefinition.tools
AgentDefinition.capabilities
```

No provider/vendor identifier is added to AgentDefinition.

Any demonstrated need to change Core, AgentDefinition semantics, the registry collision/signature contract, or the side-effect enum returns `CHATGPT_AUTHORING_REQUIRED`.

## 3. Exact capability IDs

S14F v1 advertises exactly:

```text
repository.remote.inspect
repository.review.inspect
repository.review.open
repository.review.comment
repository.checks.inspect
```

All declare `side_effects = EXTERNAL`.

The IDs are provider-neutral semantic identities. They do not contain `github`, hostnames, REST route names, OAuth/PAT/App terminology or transport details.

An HTTP read is still `EXTERNAL` because it contacts an external system. `NONE` is not allowed for S14F network operations.

## 4. Provider configuration and construction

Reference shape:

```ts
type GitHubCapabilityId =
  | "repository.remote.inspect"
  | "repository.review.inspect"
  | "repository.review.open"
  | "repository.review.comment"
  | "repository.checks.inspect";

interface GitHubRestProviderConfig {
  repository_id: string;
  owner: string;
  repository: string;
  credential_ref: string;
  enabled_capabilities: GitHubCapabilityId[];
  max_timeout_ms: number;
}
```

Construction is provider-layer only and validates/copies configuration.

Bounds:

```text
repository_id: ^[a-z0-9][a-z0-9._-]{0,159}$
owner: 1..100 ASCII chars, GitHub-style alnum/hyphen identifier
repository: 1..100 ASCII chars from [A-Za-z0-9._-]
credential_ref: 1..256 safe ASCII chars from [A-Za-z0-9._:/-]
enabled_capabilities: unique, nonempty subset of the exact five IDs
max_timeout_ms: integer 1..60000
```

Unknown config fields fail construction with one fixed safe error.

The closed shape forbids token/password/authorization/headers/base_url/url/endpoint/api_version/method/graphql/command/executable/env fields.

No config discovery from `process.env`, cwd, Git config, installed CLI, browser session, account history or model output.

## 5. Credential boundary

The provider receives an injected provider-private resolver:

```ts
interface GitHubCredentialResolver {
  resolve(credential_ref: string): Promise<string>;
}
```

This is not a Core contract and does not select a vault implementation.

The resolver returns the secret only to provider-internal transport code. The raw value MUST NOT appear in AgentDefinition, descriptors, model-visible input, result output, evidence refs, events/diagnostics, safe error text, logs, repository files or Markdown.

Provider tests must prove a sentinel credential reaches only the Authorization header and is absent from all returned/public data.

Credential resolution occurs only for an enabled capability invocation that reaches the provider. A Restricted denial must occur before concrete invoke, therefore before credential resolution or HTTP activity.

## 6. Fixed transport profile

Canonical public GitHub v1 uses:

```text
scheme/host: https://api.github.com
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
User-Agent: bounded provider-owned constant
Authorization: Bearer <resolved credential>
```

Implementation uses Node 24 built-ins. No GitHub SDK or package dependency is authorized.

Redirect following is forbidden. A redirect response fails closed.

No proxy, arbitrary CA path, custom DNS hook, model-provided header/query key, alternate host or arbitrary URL exists in v1.

GitHub Enterprise is deferred because arbitrary base URLs enlarge the SSRF/credential-forwarding surface and require a separate trust contract.

## 7. Fixed operation table

No arbitrary method/path interface exists.

Only these provider-internal REST families are allowed:

```text
REMOTE_INSPECT
REVIEW_INSPECT
REVIEW_HEAD_PREFLIGHT
REVIEW_BASE_PREFLIGHT
REVIEW_DUPLICATE_PREFLIGHT
REVIEW_OPEN
REVIEW_COMMENT_PREFLIGHT
REVIEW_COMMENT
CHECKS_INSPECT
```

Equivalent REST routes are constructed exclusively from trusted config and validated semantic identifiers. No GraphQL endpoint is called.

## 8. Common input rules

Every capability input is a closed object.

Common bounded primitives:

```text
review_number: integer 1..2147483647
commit SHA: exactly 40 or 64 ASCII hex chars
branch: 1..255 UTF-8 bytes; ASCII only; [A-Za-z0-9._/-]+
```

Branch additionally rejects leading/trailing slash or dot, leading hyphen, `//`, `..`, `@{`, backslash, ASCII controls and spaces.

Review title: 1..256 UTF-8 bytes, not whitespace-only, no C0/DEL.

Review/comment body: 1..65536 UTF-8 bytes when present/required, no lone surrogate, no C0 except TAB/LF/CR.

A finite outbound secret floor rejects write text containing the three canonical private-key markers used in S14E or a case-insensitive Bearer token-like sequence of at least 16 token characters. This is deliberately incomplete and MUST NOT be described as complete DLP.

## 9. repository.remote.inspect

Input is exactly `{}`.

Output:

```ts
interface RemoteRepositoryObservation {
  repository_id: string;
  default_branch: string;
  is_private: boolean;
  archived: boolean;
  web_url: string;
  observed_at: string;
}
```

Provider performs only fixed repository metadata GET. `observed_at` is UTC ISO-8601. `web_url` must be validated as an `https://github.com/...` URL.

Do not return description, README, topics, owner profile, permissions blob, raw API URL, clone URL or credential metadata.

## 10. repository.review.inspect

Input is exactly `{ review_number: integer }`.

Output:

```ts
type ReviewState = "OPEN" | "CLOSED" | "MERGED";

interface RepositoryReviewObservation {
  repository_id: string;
  review_number: number;
  state: ReviewState;
  draft: boolean;
  title: string;
  head_branch: string;
  head_sha: string;
  base_branch: string;
  base_sha: string;
  changed_files: number;
  comments_count: number;
  web_url: string;
  observed_at: string;
}
```

The review body, comments, review threads, patch/diff, author profile and arbitrary labels are not returned. Remote strings are inert data.

## 11. repository.review.open

Input:

```ts
interface OpenRepositoryReviewInput {
  head_branch: string;
  base_branch: string;
  expected_head_sha: string;
  expected_base_sha: string;
  title: string;
  body?: string;
  draft?: boolean;
}
```

Semantics:

1. validate input locally;
2. resolve credential;
3. GET configured repository's head branch and require SHA == expected_head_sha;
4. GET configured repository's base branch and require SHA == expected_base_sha;
5. query for existing OPEN review for the same configured repository/head/base;
6. if one exists, fail closed without POST;
7. POST create-review request using only validated same-repository branches;
8. normalize created review to `RepositoryReviewObservation`.

No fork owner is model-selectable. Fork PRs are deferred.

Stale head/base or duplicate-open-review preflight fails `EXECUTION_FAILED`, retryable false, before POST.

This preflight reduces duplicates but is not an exactly-once guarantee.

## 12. repository.review.comment

Input:

```ts
interface CommentRepositoryReviewInput {
  review_number: number;
  expected_head_sha: string;
  body: string;
}
```

Semantics:

1. validate locally;
2. resolve credential;
3. inspect pull request;
4. require state OPEN;
5. require current head SHA == expected_head_sha;
6. POST exactly one top-level pull-request conversation comment;
7. return normalized receipt.

Output:

```ts
interface RepositoryReviewCommentReceipt {
  repository_id: string;
  review_number: number;
  comment_id: string;
  web_url: string;
  created_at: string;
}
```

GitHub implements pull-request conversation comments through the issue-comment endpoint. This provider detail does not leak into the capability ID.

Inline review comments, edits and deletes are deferred. Comment creation may trigger notifications; no automatic retry is allowed.

## 13. repository.checks.inspect

Input is exactly `{ commit_sha: string }`, where SHA is exact 40/64 hex. Branch/tag names are not accepted.

Output:

```ts
type CheckStatus = "QUEUED" | "IN_PROGRESS" | "COMPLETED";
type CheckConclusion =
  | "SUCCESS" | "FAILURE" | "NEUTRAL" | "CANCELLED"
  | "SKIPPED" | "TIMED_OUT" | "ACTION_REQUIRED" | "STALE" | "UNKNOWN";

interface RepositoryChecksObservation {
  repository_id: string;
  commit_sha: string;
  total_checks: number;
  truncated: boolean;
  checks: Array<{
    id: string;
    name: string;
    status: CheckStatus;
    conclusion?: CheckConclusion;
    web_url?: string;
    started_at?: string;
    completed_at?: string;
  }>;
  observed_at: string;
}
```

Provider requests check runs for the configured repository/commit, returns at most 100, and sorts normalized checks by ASCII name then string id. `truncated` is true when remote total_count exceeds returned items.

S14F v1 covers Check Runs, not legacy commit-status contexts.

## 14. Bounds

```text
provider-owned request JSON body <= 131072 UTF-8 bytes
consumed response body per HTTP request <= 1048576 UTF-8 bytes
checks <= 100
serialized S14F success output <= 262144 UTF-8 bytes
safe error text <= 160 ASCII chars
```

No partial SUCCESS on overflow or malformed response. No raw remote payload is returned.

## 15. Deadline and cancellation

One monotonic budget starts at `invoke()` entry:

```text
effective_timeout = min(request.timeout_ms, config.max_timeout_ms)
```

It is never reset across validation, credential resolution, preflights, request, response consumption, normalization and final success check.

Use `AbortController` or equivalent. No provider-created request/timer remains after completion.

Read timeout: `FAIL / TIMEOUT / retryable true`.

Write timeout, before or after dispatch: `FAIL / TIMEOUT / retryable false`. If dispatch may have occurred, use a fixed safe message that remote write outcome is unknown and must be inspected before retry.

Provider performs zero hidden retries.

## 16. HTTP/error normalization

Use existing Brain error codes only.

| Condition | Result |
|---|---|
| invalid local input/envelope | `FAIL / INVALID_INPUT / false` |
| unknown/disabled capability | `FAIL / NOT_FOUND / false` |
| credential resolution failure | `FAIL / PERMISSION_DENIED / false` |
| HTTP 401 | `FAIL / PERMISSION_DENIED / false` |
| HTTP 403 non-rate-limit | `FAIL / PERMISSION_DENIED / false` |
| HTTP 404 | `FAIL / NOT_FOUND / false` |
| HTTP 409/422 | `FAIL / EXECUTION_FAILED / false` |
| HTTP 429 or positively identified rate limit on READ | `FAIL / UNAVAILABLE / true` |
| HTTP 429/rate limit on WRITE | `FAIL / UNAVAILABLE / false` |
| HTTP 5xx/network error on READ | `FAIL / UNAVAILABLE / true` |
| HTTP 5xx/network error on WRITE | `FAIL / UNAVAILABLE / false` |
| deadline on READ | `FAIL / TIMEOUT / true` |
| deadline on WRITE | `FAIL / TIMEOUT / false` |
| redirect | `FAIL / PERMISSION_DENIED / false` |
| oversized/malformed 2xx | `FAIL / EXECUTION_FAILED / false` |
| unexpected provider defect | `FAIL / INTERNAL_ERROR / false` |

Rate-limit detection uses status plus recognized safe rate-limit headers; raw headers are never surfaced.

GitHub may use 403/404 for insufficient permissions depending on auth/resource context, so normalized errors must not overclaim resource existence.

## 17. Permissions and least privilege

Registry routing does not replace authorization. Runtime-visible composition must keep `RestrictedCapabilityProvider` outside concrete invocation so denial happens before credential/network activity.

Each AgentDefinition explicitly lists only needed capability IDs and permits EXTERNAL.

Credential provisioning follows least privilege. Current official GitHub documentation establishes at least:

```text
review.open    -> Pull requests repository permission: write
review.comment -> Pull requests write OR Issues write
checks.inspect -> Checks repository permission: read
```

S14F does not expose token permission inventory to the model.

## 18. Determinism and inert content

For identical normalized remote responses, output order and shape are deterministic.

No provider logic branches on fixture id, expected outcome, Skill arm, model choice or remote prose instructions.

Remote title/branch/check names cannot invoke tools, change permission/config, approve writes, select URLs or change retry policy.

## 19. Provider swap invariant

Part B must prove at least one capability with:

```text
same AgentDefinition bytes
same capability_id
same semantic input
same permission policy

registry A -> GitHubRestCapabilityProvider
registry B -> independently implemented compatible test provider
```

Both execute through actual registry + Restricted + runAgent, with no provider-specific Core branching.

## 20. Explicit forbidden operation surface

No reachable operation for merge, close/reopen review, approve/request changes, inline review comment, edit/delete comment, create/delete branch, write/delete contents, releases, workflow dispatch, check mutation, repository/admin mutation, secrets, variables, webhooks, labels, assignees, reviewer requests, arbitrary REST or GraphQL.

## 21. Side-effect test strategy

Canonical Part B tests MUST NOT mutate the user's real GitHub repository.

Use injected deterministic transport and sentinel credential resolver. The transport records exact method/origin/path/headers/bounded body, emulates status/headers/body, supports deterministic abort/timeout and can simulate post-dispatch write uncertainty.

The production provider defaults to real Node HTTP/fetch behavior when supplied an actual resolver. Tests may inject the seam; production cannot branch on test IDs.

Optional live read-only smoke is allowed only with explicit approved credentials/environment and is not required for acceptance. Live writes are not canonical gate evidence.

## 22. S13H relationship

S13H is planning/policy and can produce a remote-review handoff; it performs no provider API write.

S14F executes only explicit capability invocations permitted by AgentDefinition/Restricted policy. A plan is evidence, not automatic approval.

## 23. Protected Part B scope

Later Part B is limited to additions under:

```text
src/providers/capability/github/**
tests/github-capability/**
brain-bootstrap/reports/S14F-github-capability-verification.md
```

No package/lock change. No change to Core, AgentDefinition semantics, Restricted, registry, S13H, S14A–S14E artifacts/implementations, STATE.yaml or CURRENT.md during candidate implementation.

## 24. External API facts frozen for v1

At authoring time, current official GitHub documentation establishes:

- REST is versioned; `2026-03-10` is supported and selected with `X-GitHub-Api-Version`;
- `application/vnd.github+json` is recommended;
- Bearer-token REST authentication is supported;
- create pull request requires Pull requests write for fine-grained credentials;
- create pull-request conversation comment uses the issue-comment endpoint and accepts Issues write or Pull requests write;
- listing check runs for a Git ref requires Checks read;
- comment creation may trigger notifications and secondary rate limiting.

A future incompatible API version needs reviewed provider-version maintenance, not model-selected negotiation.

## 25. Baseline-failure policy

Exact implementation baseline for Part B is the Part A integration SHA recorded after mechanical integration.

The known inherited inventory entering S14F is the exact 14 identities authorized by S14E clarification `5610124295`. It is **provisional** until reproduced on the exact S14F Part A integration baseline.

Carry-forward is allowed only if baseline and candidate reproduce the same identity and same assertion cause, and the cause remains exactly the historical `brain-bootstrap/STATE.yaml` + `brain/context/CURRENT.md` protected-difference pair.

If identity/cause changes or any additional failure appears, return `CHATGPT_AUTHORING_REQUIRED`. Do not edit historical tests or continuity files to make the suite green.

Candidate may add passing S14F tests, so total passed counts need not equal baseline. Raw counts remain required.

## 26. Verification requirements

Builder must prove Node 24, Part A/Core/AgentDefinition/prior-phase identity, no dependency change, fixed five EXTERNAL descriptors, closed validation, one-repository binding, secret non-leakage, fixed host/version/routes, redirect denial, read/write separation, stale-SHA and duplicate write preflights, zero hidden retries, ambiguous-write handling, bounds, deterministic normalization, inert remote content, Restricted denial before credential/network, provider swap same AgentDefinition, all hard invariants/fixtures/counters, full baseline/candidate pre/post-build comparison, genuine clean build and `git diff --check`.

No paid/live model is required.

## 27. Lifecycle

```text
Part A authored
→ mechanical Part A integration
→ factual compatibility/baseline measurement
→ separate Part B authorization
→ builder candidate
→ fresh non-authoring/non-builder/non-fork read-only verifier
→ standalone relay
→ separate ChatGPT acceptance
→ docs-only phase closure/integration
```

If S14F passes:

```text
S14F = PHASE_PASS
S14 = IN_PROGRESS / NOT_CLOSED
S14G = NOT_AUTHORIZED
HI-054 = NOT_AWARDED
```

Only final S14 closure may award HI-054.
