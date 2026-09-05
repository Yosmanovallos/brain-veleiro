# CAPABILITY_REGISTRY_TOOLS_MCP_SKILL_S14

## Identity

```yaml
step: S14
name: capability-registry-tools-mcp
version: 1.0.0
depth: DEEP
classification: RUNTIME_INFRASTRUCTURE
status: AUTHORING_READY
honor_invariant_candidate: HI-054
```

## Purpose

S14 makes Brain agents request **stable capabilities** instead of depending on hardcoded integrations.

Canonical objective:

```text
AgentDefinition
   requests capability IDs
            ↓
RestrictedCapabilityProvider
            ↓
Capability Registry
            ↓
explicit capability → provider binding
            ↓
swappable CapabilityProvider implementation
```

Changing the concrete implementation of a capability must not require changing the `AgentDefinition`.

Examples:

```text
repository.read
    → local git provider
    OR GitHub-backed provider
    OR MCP-backed provider

documentation.search
    → local/docs provider
    OR web/docs provider
    OR MCP-backed provider

browser.inspect
    → local browser provider
    OR MCP-backed browser provider
```

The stable contract is the capability ID, not the vendor, transport, executable, SDK, MCP server or credential mechanism.

## Repository-grounded starting point

At S14 baseline `a8972569983a66f9b70303d1beea8d98772f3683`, Brain already has provider-neutral Core contracts:

- `CapabilityProvider`;
- `ToolDescriptor`;
- `ToolInvocationRequest`;
- `ToolInvocationResult`;
- `ToolSideEffectClass`;
- `RestrictedCapabilityProvider`;
- `AgentDefinition.tools`;
- `AgentDefinition.capabilities`.

S14 MUST reuse those contracts.

The foundation does not require a new Core interface and does not authorize modification of the existing AgentDefinition schema.

## Classification decision

```text
S14 = RUNTIME_INFRASTRUCTURE + DEEP
```

S14 is not a purely advisory Skill.

The roadmap explicitly requires incremental construction of real capability/tool infrastructure and prior stages deliberately deferred real capability execution to S14.

The Skill artifact in this Part A is normative engineering guidance for the stage; the executable registry/providers belong to Part B under `src/providers/**` or another already-permitted provider/adaptor layer, never as domain/vendor logic inside Core.

## Canonical architecture

```text
Agent Runtime (Core)
        │
        │ CapabilityProvider
        ▼
RestrictedCapabilityProvider
        │
        ▼
CapabilityRegistryProvider
        │
        ├── capability.a → provider X
        ├── capability.b → provider Y
        └── capability.c → provider Z
                         │
                  replaceable adapters
```

The registry itself implements the existing `CapabilityProvider` interface.

Core remains unaware of:

- registry implementation;
- provider IDs;
- MCP;
- GitHub;
- Playwright;
- PostgreSQL;
- filesystem paths;
- shell executables;
- OAuth;
- secret stores;
- provider SDKs.

## Core method

For every capability:

1. Keep one stable canonical `capability_id`.
2. Register provider implementations explicitly.
3. Resolve the selected implementation through explicit configuration.
4. Reject missing, ambiguous or conflicting bindings.
5. List only capabilities whose selected provider can actually describe them.
6. Preserve the canonical Brain `ToolDescriptor`.
7. Invoke through the selected provider.
8. Preserve `call_id` and `capability_id`.
9. Normalize failures to the existing `ToolInvocationResult`.
10. Apply `RestrictedCapabilityProvider` outside the registry so Agent permissions remain authoritative.
11. Keep credentials as opaque references outside prompts, descriptors, memory and git.
12. Emit inspectable evidence for routing and execution without exposing secret material.

## Registry semantics

### Stable capability identity

A capability ID is semantic and provider-neutral.

Valid conceptual examples:

```text
repository.read
repository.status
filesystem.read
shell.execute
documentation.search
browser.inspect
postgres.inspect
```

Invalid capability IDs encode implementation:

```text
github.repository.read
playwright.browser.inspect
context7.documentation.search
mcp.server42.repository.read
```

Provider-specific names may exist in provider metadata/configuration but not as the required AgentDefinition capability identity.

### Explicit routing

Provider resolution is explicit.

Allowed:

```text
capability_id → selected_provider_id
```

Not allowed:

- silently inspect environment variables and choose a provider;
- choose based on installed CLI availability without explicit policy;
- choose based on user history;
- choose based on fixture ID;
- allow the model to select a provider by vendor name when only the capability is authorized;
- first-provider-wins behavior for ambiguous duplicates.

### Multiple implementations

Multiple implementations of one capability may be registered, but v1 requires exactly one explicit selected provider for an invokable capability.

If zero selected providers exist:

```text
BLOCKED / REQUIRED_CAPABILITY_MISSING
```

If multiple selected providers conflict:

```text
BLOCKED / AMBIGUOUS_CAPABILITY_BINDING
```

No arbitrary fallback.

### Descriptor consistency

The selected provider's descriptor must match the routed capability ID.

The registry must not silently rewrite:

- `capability_id`;
- side-effect class;
- input schema;
- output schema;
- timeout semantics.

A provider swap may change implementation metadata outside the AgentDefinition, but the capability's public semantic contract must remain compatible.

## Runtime composition rule

Canonical composition:

```text
concrete providers
      ↓
CapabilityRegistryProvider
      ↓
RestrictedCapabilityProvider
      ↓
runAgent()
```

The registry resolves implementation.

`RestrictedCapabilityProvider` authorizes visibility/invocation.

Neither may replace the other's responsibility.

## Security model

S14 introduces execution infrastructure, so least privilege is mandatory.

### Secrets

Never place secret values in:

- ToolDescriptor;
- ToolInvocationRequest produced by the model;
- AgentDefinition;
- Skill content;
- Markdown;
- event details;
- evidence refs;
- git.

Provider configuration may contain only opaque safe references such as:

```text
credential_ref
auth_ref
connection_ref
```

S14 v1 does not define a vault vendor and does not mint OAuth tokens.

### Side effects

Existing Core side-effect classes remain authoritative:

```text
NONE
LOCAL
EXTERNAL
```

The registry must not downgrade a provider's side-effect class.

`RestrictedCapabilityProvider` remains the runtime enforcement boundary.

### Shell/filesystem

No shell or filesystem execution is authorized during S14A foundation.

Later S14 phases must separately define:

- workspace/root scope;
- read/write policy;
- command allow/deny semantics;
- path traversal protections;
- timeout/cancellation;
- bounded output;
- destructive-operation confirmation where required.

### External providers

GitHub, browser, PostgreSQL, MCP and any remote API require separate phase authorization and test contracts before live use.

## MCP decision

MCP is an adapter mechanism, not a new Core concept.

Canonical direction:

```text
MCP transport/client
        ↓
McpCapabilityProvider
        ↓
CapabilityProvider
        ↓
CapabilityRegistryProvider
```

MCP server/tool names do not enter AgentDefinition.

MCP adapter details remain provider-layer implementation.

Live MCP connections are NOT authorized by S14A.

## OAuth / credentials decision

S14 defines only the provider-layer **reference boundary**:

```text
provider config
  → opaque auth/credential reference
  → injected resolver/client outside model-visible data
```

S14 does not define:

- an OAuth consent UI;
- token minting;
- refresh-token storage;
- a vault provider;
- secret synchronization.

Those require explicit later authorization when a concrete connector needs them.

## Incremental S14 phases

S14 is an umbrella stage.

The roadmap order is preserved:

```text
S14A — Capability Registry Foundation
S14B — filesystem
S14C — shell
S14D — git
S14E — documentation/search
S14F — GitHub
S14G — browser
S14H — PostgreSQL inspect
S14I — generic MCP adapter / transport compatibility
S14J+ — only when a demonstrated need appears
```

S14 cannot be marked CLOSED merely because S14A passes.

Each execution-bearing phase must have its own bounded authoring/verification extension before implementation.

### S14A authorized scope

S14A may implement only:

```text
provider-neutral registry types/config
CapabilityRegistryProvider implementing existing CapabilityProvider
explicit routing
duplicate/missing/ambiguous binding rejection
descriptor consistency validation
provider swapping through configuration
deterministic in-memory/reference-provider fixtures
permission-composition tests with RestrictedCapabilityProvider
registry evidence/diagnostics that contain no secret values
```

S14A may NOT implement:

```text
filesystem execution
shell execution
git process execution
GitHub API calls
web search
browser automation
PostgreSQL connections
MCP network/client execution
OAuth
credential storage
new Core interfaces
AgentDefinition changes
new package dependency
S15+ work
```

## Phase transition rule

After each S14 phase:

```text
builder evidence
→ fresh non-authoring verifier
→ control-plane acceptance
→ phase handoff
→ explicit authorization for next S14 phase
```

No phase implicitly authorizes the next.

## Relationship to prior stages

### S09

S09 already owns the Core `CapabilityProvider` and Tool invocation contract.

S14 consumes it; it does not replace it.

### S10

AgentDefinition already declares tools/capabilities.

S14 must prove provider swapping does not require AgentDefinition edits.

### S12

S12's registry/lazy-load principles are reusable patterns but S14 is not the Skill Registry.

### S13G

Execution packages deliberately contain unbound capability declarations.

S14 resolves implementation outside that package; do not inject provider/MCP/credential fields into S13G artifacts.

### S13H

S13H intentionally deferred real git execution.

S14D may later supply the actual git capability provider, but S14A does not pull that execution forward.

### S13L

S13L owns permission/security reasoning.

S14 enforces the existing side-effect/allowlist boundary at runtime and must not weaken it.

### S13O / S13P

Retry/async and observability Skills provide policy/decision knowledge.

S14 must not silently create a new workflow runtime, retry orchestrator or telemetry platform.

## S15+ boundary

S14 does not own:

- Verifier Agent;
- Architecture Challenger;
- Workflow Runtime;
- Delegation;
- Orchestrator;
- multi-agent routing;
- self-improvement;
- resource manager;
- provider-selection by autonomous agent reasoning.

## Fail-closed examples

### Missing route

```text
Agent requires repository.read
registry has provider implementations
no explicit selected binding
→ BLOCKED
```

### Duplicate selected providers

```text
repository.read → local-git
repository.read → github
both selected
→ BLOCKED / AMBIGUOUS_CAPABILITY_BINDING
```

### Provider swap

```text
AgentDefinition.capabilities = ["repository.read"]

config A:
repository.read → local-git

config B:
repository.read → github

AgentDefinition bytes unchanged
→ PASS
```

### Permission denial

```text
registered capability side_effects = EXTERNAL
Agent allowed_side_effects excludes EXTERNAL
→ RestrictedCapabilityProvider blocks invocation
```

### Provider-specific leak

```text
AgentDefinition requires "github.repository.read"
only because GitHub adapter is selected
→ FAIL
```

## S14 global PASS criterion

S14 is not complete until:

```text
changing a capability implementation does not require changing AgentDefinition
```

and all authorized incremental phases required by the canonical roadmap have passed their own independent verification and control-plane closure gates.

## S14A immediate acceptance target

S14A PASS proves only the registry foundation:

- no Core change;
- no AgentDefinition change;
- explicit deterministic routing;
- capability/provider decoupling;
- provider swap with unchanged AgentDefinition;
- permission composition preserved;
- ambiguous/missing bindings fail closed;
- no hidden provider detection;
- no external side effects;
- no new dependency;
- no S15+ pull-forward.

HI-054 is NOT awarded at S14A. It remains the final S14 honor-invariant candidate.
