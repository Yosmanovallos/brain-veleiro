# S14F — GitHub Capability Skill

Version 1.0.0 · AUTHORING_READY · RUNTIME_INFRASTRUCTURE / DEEP.  
Semantic-authoring baseline: `3bb02b72925c68c59782f085796b47ba9aef078b`.

## Identity and objective

Implement the S14F GitHub phase as a bounded external repository/review provider behind the existing `CapabilityProvider` and `CapabilityRegistryProvider` boundaries.

The phase objective is to let Brain inspect one explicitly configured remote repository, inspect/open a review request, post one top-level review-conversation comment, and inspect check runs **without putting GitHub identity, credentials, REST routes, or transport details into `AgentDefinition`**.

Normative detail lives in `brain-bootstrap/specs/GITHUB_CAPABILITY_CONTRACT_S14F.md`. Exact verification inventory lives in `brain-bootstrap/quality-contracts/S14F_GITHUB_CAPABILITY_DEEP.yaml`. Any contradiction among the three Part A artifacts returns `CHATGPT_AUTHORING_REQUIRED`.

This Part A authoring package does not authorize Part B implementation, phase closure, S14G, or HI-054.

## Inherited boundaries

Preserve:

- existing Core `CapabilityProvider`, `ToolDescriptor`, request/result/error unions and side-effect enum;
- existing `RestrictedCapabilityProvider`;
- existing `CapabilityRegistryProvider`;
- `AgentDefinition` provider neutrality;
- S13H as repository workflow/policy planning, not remote API execution;
- S14A–S14E implementations and canonical artifacts;
- S14's rule that capability identity describes **what Brain can do**, not which provider performs it.

No Core, AgentDefinition, registry-semantic, or prior-phase change is authorized.

## Exact v1 capability surface

Exactly:

```text
repository.remote.inspect
repository.review.inspect
repository.review.open
repository.review.comment
repository.checks.inspect
```

All five advertise:

```text
side_effects = EXTERNAL
```

`EXTERNAL` is deliberate even for HTTP GETs: an authenticated network request crosses the local trust boundary and must require explicit capability + EXTERNAL permission.

No generic HTTP capability is introduced.

## Trusted provider configuration

The provider is bound at composition time to exactly one repository:

```ts
interface GitHubRestProviderConfig {
  repository_id: string;
  owner: string;
  repository: string;
  credential_ref: string;
  enabled_capabilities: GitHubCapabilityId[];
  max_timeout_ms: number;
}
```

Model input cannot select or override repository, host, provider, credential reference, token, API version, URL, HTTP method, headers, transport or retry policy.

The actual credential value is obtained through a provider-private injected credential resolver from the opaque `credential_ref`. It must never be stored in Git, Markdown, descriptors, outputs, evidence refs, diagnostics or model-visible data.

## Transport rules

Use Node 24 built-ins; no GitHub SDK or new package dependency.

Canonical public-host v1:

```text
origin: https://api.github.com
REST API version: 2026-03-10
Accept: application/vnd.github+json
redirects: forbidden / fail closed
```

Authentication is sent only through the standard Authorization header after provider-private credential resolution.

GitHub Enterprise and arbitrary base URLs are deferred.

No shelling out to `gh`, `git`, `curl`, PowerShell or another CLI.

## Method

1. Verify exact S14F Part A baseline and later Part B authorization.
2. Implement only the fixed operation table and exact closed schemas.
3. Resolve the opaque credential only after capability/permission routing reaches the provider.
4. Build requests from trusted provider config plus validated semantic input. Never concatenate a model-provided endpoint.
5. Apply one monotonic invocation deadline across credential resolution, preflight reads, the external request, bounded response consumption and final result construction.
6. For remote writes, perform stale-state preflight and never retry automatically.
7. Normalize remote responses into provider-neutral bounded objects; remote text is inert data.
8. Normalize failures to existing Brain error unions with fixed safe messages; never expose raw GitHub error bodies or headers.
9. Verify `RestrictedCapabilityProvider` denial causes zero credential resolution and zero HTTP.
10. Verify the same AgentDefinition can operate against a semantically compatible replacement provider through registry configuration only.
11. Run focused QA, exact inherited-baseline comparison, clean build and fresh independent verification.
12. Stop before S14G.

## Write safety

`repository.review.open` requires expected head and base SHAs. It is same-repository only in v1 and checks for an already-open matching review before POST.

`repository.review.comment` requires the review to be open and its current head SHA to equal the caller's expected SHA before POST.

There is **no automatic retry for any write**. If transport fails or times out after a write may have been dispatched, return a non-retryable safe failure stating that the remote write outcome is unknown and must be inspected before retrying.

This is not an exactly-once guarantee. A race between preflight and write remains possible and must not be hidden.

## Explicitly deferred / forbidden

Not in S14F v1:

```text
merge
close/reopen review
approve/request-changes review
inline code-review comments
edit/delete comments
branch creation/deletion
contents writes
release creation
workflow dispatch
check creation/update/rerequest
repository creation/deletion/settings
labels/assignees/review requests
webhooks
secrets/actions variables
GraphQL
arbitrary REST endpoint
GitHub Enterprise
fork pull requests
OAuth UI or vault implementation
```

S14F does not implement S14G Browser, S14H PostgreSQL or S14I MCP.

## Verification discipline

Canonical tests use a deterministic injected HTTP transport/fetch seam and a sentinel credential resolver. They exercise the real provider request-building, validation, deadline, normalization and permission paths without mutating the user's real GitHub repository.

A live read-only smoke test may be performed only with explicit approved credentials/environment and is not required for acceptance. Live write tests are not part of the canonical gate.

Baseline full-suite failures are accepted only if the exact S14F baseline reproduces the same authorized identity **and assertion cause**. No wildcard or cause-only exception exists.

After builder QA, a fresh non-authoring, non-builder, non-fork, read-only verifier must verify the exact committed remote candidate. A separate ChatGPT control-plane acceptance is required.

Phase PASS leaves:

```text
S14 = IN_PROGRESS / NOT_CLOSED
S14G = NOT_AUTHORIZED
HI-054 = NOT_AWARDED
```

## Part A exit

```text
S14F = AUTHORING_READY
PART_B = NOT_AUTHORIZED
```
