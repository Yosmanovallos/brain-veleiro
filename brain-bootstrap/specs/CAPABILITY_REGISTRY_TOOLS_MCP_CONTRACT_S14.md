# BRAIN — Capability Registry, Tools and MCP Contract S14

## 1. Status and authority

```yaml
step: S14
name: capability-registry-tools-mcp
version: 1.0.0
depth: DEEP
classification: RUNTIME_INFRASTRUCTURE
status: AUTHORING_READY
honor_invariant_candidate: HI-054
baseline: a8972569983a66f9b70303d1beea8d98772f3683
```

This semantic contract is the authority for S14.

The S14 objective is:

> Agents request capabilities, not hardcoded integrations.

The final stage criterion is:

> Changing the implementation of a capability does not require changing the AgentDefinition.

## 2. Repository-grounded resolution

The repository already contains the generic Core contracts required to support capability execution:

```text
CapabilityProvider
ToolDescriptor
ToolInvocationRequest
ToolInvocationResult
RestrictedCapabilityProvider
AgentDefinition.tools
AgentDefinition.capabilities
```

Therefore S14 MUST NOT introduce a parallel Core abstraction merely to implement a registry.

Canonical dependency direction:

```text
AgentDefinition
      │ capability IDs
      ▼
Agent Runtime
      │
      ▼
RestrictedCapabilityProvider
      │
      ▼
CapabilityRegistryProvider
      │
      ├── provider A
      ├── provider B
      └── provider C
```

The registry is infrastructure outside Core.

## 3. Classification

```text
S14 = RUNTIME_INFRASTRUCTURE + DEEP
```

Rationale:

- S14 introduces real execution-capability infrastructure.
- Filesystem, shell, git, remote APIs, browser and database adapters create real side-effect/security boundaries.
- Previous S13 stages deliberately deferred real tool/provider execution to S14.
- The roadmap explicitly says to build capabilities incrementally.

The existence of a normative Skill artifact does not make the executable stage `SKILL_ONLY`.

## 4. No-Core-change decision

S14A must preserve byte identity of existing Core contracts unless a later explicit ChatGPT Authoring Gate proves a real incompatibility.

In S14A:

```text
NO change to CapabilityProvider
NO change to ToolDescriptor
NO change to ToolInvocationRequest
NO change to ToolInvocationResult
NO change to RestrictedCapabilityProvider
NO change to AgentDefinition schema
```

A need to modify any of these is:

```text
CHATGPT_AUTHORING_REQUIRED
```

not a builder-local design decision.

## 5. Capability identity

A capability ID describes what Brain can do, not how it is implemented.

Canonical examples:

```text
filesystem.read
shell.execute
repository.read
repository.status
documentation.search
browser.inspect
postgres.inspect
```

Provider/vendor identity belongs in registry/provider configuration.

`AgentDefinition` remains implementation-neutral.

## 6. Capability registry

Reference provider-layer shape:

```ts
interface CapabilityRegistryBinding {
  capability_id: string;
  selected_provider_id: string;
}

interface RegisteredCapabilityProvider {
  provider_id: string;
  provider: CapabilityProvider;
}

class CapabilityRegistryProvider implements CapabilityProvider {
  // explicit providers + explicit routing
}
```

Exact implementation syntax may follow repository conventions.

The semantic requirements are normative:

- provider IDs unique;
- explicit routing;
- one selected provider per invokable capability;
- provider must actually advertise the routed capability;
- descriptor must be compatible;
- missing route fails closed;
- ambiguous route fails closed;
- invocation is forwarded only to the selected provider;
- output is normalized to existing Core result types.

## 7. Provider-selection policy

v1 resolution is explicit configuration.

Forbidden hidden selectors:

```text
process.env
filesystem detection
installed CLI detection
network reachability
user historical preference
fixture ID
expected outcome
Skill arm
model choice
provider registration order
```

Provider replacement occurs by changing registry configuration/composition, not AgentDefinition.

## 8. Descriptor contract

The registry must not fabricate ToolDescriptor semantics.

The selected provider is authoritative for its descriptor subject to validation.

The registry must reject semantic collisions where two implementations claiming one capability expose incompatible public contracts unless an explicit future compatibility policy authorizes them.

S14A does not create automatic schema-merging behavior.

## 9. Permission composition

The registry is not an authorization substitute.

Canonical runtime composition:

```text
CapabilityRegistryProvider
        ↓
RestrictedCapabilityProvider
        ↓
Agent Runtime
```

`RestrictedCapabilityProvider` remains responsible for:

- Agent capability allowlist;
- permitted side-effect classes.

The registry must not invoke around that boundary.

## 10. Side effects

Existing side-effect classes remain:

```text
NONE
LOCAL
EXTERNAL
```

No new side-effect enum is introduced in S14A.

Providers must truthfully declare their class.

A registry may preserve or reject a descriptor but never downgrade side effects to make an invocation pass permission checks.

## 11. Secret-reference boundary

S14 recognizes that concrete adapters may later need credentials.

Canonical S14 representation is provider-layer only:

```text
provider_id
auth_ref?
credential_ref?
connection_ref?
```

These are opaque references.

Secret values are forbidden from:

- AgentDefinition;
- capability IDs;
- ToolDescriptor;
- prompts;
- model-visible tool input unless the capability's explicit semantic input genuinely requires user-supplied sensitive material under a separately approved contract;
- event details;
- diagnostic text;
- git;
- Markdown.

S14 does not choose a vault implementation.

## 12. MCP boundary

MCP is not added to Core.

A generic MCP adapter must eventually implement existing `CapabilityProvider`.

Reference direction:

```text
MCP client/transport
      ↓
McpCapabilityProvider
      ↓
CapabilityRegistryProvider
      ↓
RestrictedCapabilityProvider
```

MCP server names, transport endpoints and OAuth details remain outside AgentDefinition.

S14A does not authorize live MCP execution.

## 13. Incremental construction contract

The canonical roadmap order is:

1. filesystem;
2. shell;
3. git;
4. documentation/search;
5. GitHub;
6. browser;
7. PostgreSQL inspect;
8. others only when a real need appears.

Because the execution/security surface is too broad for one safe atomic builder step, S14 is implemented under bounded phases:

```text
S14A Capability Registry Foundation
S14B Filesystem
S14C Shell
S14D Git
S14E Documentation/Search
S14F GitHub
S14G Browser
S14H PostgreSQL Inspect
S14I Generic MCP Adapter
```

The internal phase notation does not change the top-level roadmap identity: all remain inside S14.

A phase PASS does not close S14.

## 14. S14A scope

S14A owns only the provider-neutral registry foundation.

Expected Part B scope may include:

```text
src/providers/capability/registry/**
tests/capability-registry/**
verification report/handoff
strictly mechanical exports if existing provider barrel conventions require them
```

Exact paths may follow repository convention, but provider-layer placement is required.

S14A may use existing deterministic reference providers and purpose-built in-memory fakes.

No external side effect is needed to prove the registry contract.

## 15. S14A forbidden scope

S14A MUST NOT:

- access the real filesystem for capability behavior;
- execute shell commands;
- execute git;
- call GitHub;
- call web/docs services;
- launch a browser;
- connect PostgreSQL;
- connect to an MCP server;
- implement OAuth;
- store credentials;
- add a package dependency;
- create a workflow runtime;
- create a verifier agent;
- create delegation/orchestration;
- change Core semantics;
- change AgentDefinition semantics.

## 16. Provider swap acceptance

The defining S14A counterfactual is:

```text
same AgentDefinition bytes
same capability_id
same permission policy
same invocation semantic input

configuration A:
capability → provider A

configuration B:
capability → provider B
```

Both executions must route to the selected provider without an AgentDefinition edit.

The test must inspect actual configuration/routing behavior, not merely compare two handcrafted expected values.

## 17. Failure semantics

S14A should normalize registry-local failures into existing Brain tool semantics.

Examples:

### Missing capability

```text
invoke unknown capability
→ BLOCKED or normalized NOT_FOUND according to existing runtime convention
```

The implementation must choose one consistent contract and test it.

### Missing provider

```text
route references unknown provider
→ configuration invalid / fail closed
```

### Ambiguous binding

```text
two selected implementations for same capability
→ configuration invalid / fail closed
```

### Provider failure

A provider's valid normalized `FAIL`/`BLOCKED` result is preserved.

Thrown implementation errors must not leak raw secret-bearing objects or crash the registry boundary unnormalized.

## 18. Determinism

For equivalent provider registration and routing configuration:

```text
list_capabilities output order
routing decision
validation result
diagnostic representation
```

must be deterministic.

Provider insertion order may not alter semantic resolution.

## 19. Diagnostics and evidence

Registry diagnostics may expose safe identifiers:

```text
capability_id
provider_id
routing status
validation reason code
safe evidence refs
```

They must not expose:

```text
token
password
cookie
authorization header
private key
raw OAuth response
raw credential object
```

## 20. S13G boundary

S13G intentionally materializes unbound capability declarations.

S14 must not retrofit provider identity into that execution package.

Binding occurs later at runtime composition.

## 21. S13H boundary

S13H owns repository/git engineering decisions.

S14D may later execute a git capability consistent with authorized S13H decisions.

S14A only establishes the registry infrastructure and does not execute git.

## 22. S13L boundary

S13L owns guardrail/security policy reasoning.

S14 uses the existing permission/side-effect restrictions.

S14 cannot weaken a denial to make a provider usable.

## 23. S15+ boundary

Forbidden S14 pull-forward:

```text
Verifier Agent
Architecture Challenger
Workflow Runtime
Delegation
Orchestrator
multi-agent planning
self-improvement
resource/eval operating system
```

## 24. S14A Part B verification

Builder must prove:

```text
Node 24
Part A byte identity
Core byte identity
AgentDefinition byte identity
no dependency change
focused registry tests
12 exact positive fixtures
28 exact negative fixtures
all S14A-HI-001..032
UC01..UC12 zero on legitimate paths and independently fireable
provider-swap AgentDefinition byte identity
registration-order counterfactual determinism
RestrictedCapabilityProvider composition
actual registry invoke path
no filesystem/shell/git/network/browser/database/MCP side effects
S13G boundary integrity
S13H boundary integrity
full suite before clean build
repo-local dist absent
genuine build
full suite after build
git diff --check
```

The builder may not self-approve.

## 25. S14A independent gate

After S14A builder evidence:

- use a fresh;
- non-authoring;
- non-fork;
- read-only verifier;
- verify the exact committed candidate;
- post a standalone verifier relay;
- obtain a separate control-plane acceptance.

If S14A passes:

```text
S14A = PHASE PASS
S14 = IN_PROGRESS
HI-054 = NOT_AWARDED
```

Only then may the control plane authorize S14B.

## 26. Final S14 gate

S14 final closure requires all roadmap-required phases to be complete and accepted.

Final invariant:

```text
changing the implementation of a capability
does not require changing AgentDefinition
```

Final closure additionally requires:

- capability/provider boundary remains provider-neutral;
- Core remains vendor-neutral;
- permission enforcement remains intact;
- secrets remain reference-only;
- MCP remains an adapter implementation behind CapabilityProvider;
- no S15+ pull-forward;
- fresh final verification;
- separate control-plane acceptance.

Only final S14 closure may award:

```text
HI-054
```
