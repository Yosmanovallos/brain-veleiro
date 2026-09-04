# DEPLOYMENT_SKILL_S13R

## Identity

```yaml
step: S13R
name: deployment
version: 1.0.0
depth: DEEP
classification: SKILL_ONLY
status: AUTHORING_READY
honor_invariant_candidate: HI-053
```

## Purpose

Use this Skill to reason about deployment readiness and provider-neutral deployment packaging from explicit repository/runtime evidence. S13R owns Docker-first packaging intent, environment/secrets injection contracts, health/readiness semantics, deployment evidence evaluation and deployed-verification reasoning. It must fail closed when the product has no evidenced deployable entrypoint.

S13R does not invent an application runtime to make deployment possible.

Canonical baseline fact for Brain at authoring time:

```text
no product server
no CLI/bin entrypoint
no worker/daemon entrypoint
no startup command
no product port
no runtime env-var contract
no deployment provider selection
```

Therefore the Brain repository itself is currently `BLOCKED_NO_DEPLOYABLE_ENTRYPOINT` for an executable deployment package unless later caller-supplied repository evidence establishes a real launch surface. That blocked result is correct behavior, not a reason to fabricate a server.

## When to use

Use S13R when a caller needs to answer, from explicit evidence:

- what exact revision is being packaged;
- whether a real deployable process/entrypoint exists;
- whether Docker/container packaging is valid for that process;
- which build/start commands and runtime prerequisites are real;
- which environment variable names are allowed/required without exposing values;
- what liveness/readiness contract is actually supported;
- whether persistence/writable-path assumptions are container-safe;
- whether deployment evidence proves build/start/health success;
- whether provider mapping is generic or an already-authorized concrete adapter;
- whether deployed verification is complete, partial or blocked.

## Canonical path

```text
S12 Skill discovery / lazy selected-Skill load
→ caller-supplied compatible AgentDefinition
→ S10 compileAgentDefinition()
→ S09 runAgent()
→ actual parsed deployment candidate
→ deterministic candidate gate
→ deterministic deployment evaluator
```

The actual candidate must be validated and gated. Do not replace it with a separately synthesized faithful answer before evaluation.

## Required input families

The bounded input must provide explicit safe projections for:

```text
deployment_identity
repository_facts
runtime_surface
build_contract
container_policy
environment_contract
health_contract
persistence_contract
deployment_evidence
policy
```

Optional evidence may include provider mapping only when the repository or caller authority explicitly establishes it.

Never read secret values from the environment, filesystem or process state as hidden truth.

## Core method

1. Bind the exact project/revision/deployment scope.
2. Validate the repository/build/runtime facts structurally.
3. Determine whether a deployable entrypoint exists from evidence only.
4. If no entrypoint exists, return `BLOCKED_NO_DEPLOYABLE_ENTRYPOINT`; do not create one.
5. If a deployable entrypoint exists, derive a Docker-first packaging plan from exact build/start/runtime facts.
6. Derive environment requirements from an allowlisted set of variable names only; secret values stay external references.
7. Evaluate writable path, persistence and single/multi-replica assumptions explicitly.
8. Derive health/readiness checks only from an existing transport or process contract. Never invent an HTTP port/route.
9. Keep deployment provider mapping `PROVIDER_NEUTRAL` unless an authorized provider fact exists.
10. Evaluate supplied build/start/health/deployed evidence and derive `READY`, `PARTIAL` or `BLOCKED` without self-certification.
11. Emit structured authoritative output first; rendered Docker/config/check snippets are deterministic derivative projections only.
12. Preserve S14+ capability/MCP/OAuth/tool execution and S15+ verifier/workflow/orchestration boundaries.

## Docker-first meaning

`Docker first` means:

```text
when an evidenced deployable process exists, the first canonical packaging representation is an OCI/Docker-compatible process package plan.
```

It does NOT mean:

```text
invent a process
invent a port
invent a health route
invent a startup command
invent environment variables
invent a persistent volume
select Render/Fly/Railway/Vercel/AWS/GCP/Azure/etc.
```

A deterministic Dockerfile projection MAY be produced from an eligible structured plan, but it may not add facts absent from the plan.

## Deployment status

Canonical top-level statuses:

```text
READY
PARTIAL
BLOCKED
```

Canonical blocker reason codes include:

```text
INVALID_DEPLOYMENT_INPUT
REVISION_IDENTITY_CONFLICT
BLOCKED_NO_DEPLOYABLE_ENTRYPOINT
BUILD_COMMAND_UNAVAILABLE
START_COMMAND_UNAVAILABLE
RUNTIME_VERSION_UNRESOLVED
ENV_CONTRACT_UNRESOLVED
SECRET_MATERIAL_PRESENT
HEALTH_CONTRACT_UNRESOLVED
PERSISTENCE_CONTRACT_UNRESOLVED
DEPLOYMENT_EVIDENCE_INSUFFICIENT
PROVIDER_MAPPING_UNAUTHORIZED
FUTURE_STAGE_PULL_FORWARD
```

`READY` means the supplied deployment contract and evidence satisfy S13R. It does not imply production security, SLOs, autoscaling, backup/recovery, multi-region availability, compliance or operational support.

## Environment and secret safety

Allowed canonical representation:

```text
name
required/optional
classification = PUBLIC_CONFIG | SENSITIVE_REFERENCE
source_ref / secret_ref
presence status
```

Forbidden:

```text
secret values
API keys
passwords
cookies
authorization headers
private keys
raw .env payloads
raw secret-manager responses
```

S13R may describe how a runtime expects references to be injected. It does not provision OAuth/MCP/connectors or a secret manager.

## Health/readiness semantics

Health must be transport-grounded.

- Existing HTTP process + evidenced route: HTTP liveness/readiness may be modeled.
- Existing CLI/worker process with explicit check command: process/command health may be modeled.
- No long-running process or check surface: health remains `UNAVAILABLE`/`BLOCKED`; do not create a route.

A successful build is not liveness. A successful unit test suite is not deployed readiness.

## Persistence semantics

S13R must identify whether runtime state requires:

```text
NONE
EPHEMERAL
PERSISTENT_LOCAL
EXTERNAL_SERVICE
UNKNOWN
```

A new persistent volume, external database or shared-state architecture is not mechanically introduced by S13R when current architecture does not already require/authorize it. Such a change is an architecture decision and must stop at `CHATGPT_AUTHORING_REQUIRED`/ADR gate.

## Provider neutrality

Default:

```text
provider_mapping = PROVIDER_NEUTRAL
```

Provider-specific adapters are later/explicit work. A concrete provider may appear only when caller/repository evidence proves an already-authorized provider decision. User history outside the repository is not authority.

## Forbidden pull-forward

S13R MUST NOT implement or claim:

```text
S14 Capability Registry / Tools / MCP / OAuth / connector binding
S15 Verifier Agent
S16 Architecture Challenger
S17 Workflow Runtime
S18 Delegation
S19 Orchestrator
S20+ resource/eval operating systems
provider-specific multi-cloud deployment factory
new adaptive AgentDefinition
Core role-specific branch
new product server solely for deployment
```

## Output

The authoritative structured result should include at least:

```text
status
reason_code
deployment_identity
entrypoint_assessment
build_plan
container_plan
environment_plan
health_plan
persistence_plan
provider_mapping
deployment_verification
blockers
limitations
residual_unknowns
evidence_refs
```

Rendered Docker/config/check material is derivative and must be byte-deterministic for normalized equivalent inputs.

## Fail-closed examples

### Example A — current Brain baseline

Input facts say TypeScript library, build/test scripts exist, but no start command/server/CLI/worker.

Expected:

```text
status: BLOCKED
reason_code: BLOCKED_NO_DEPLOYABLE_ENTRYPOINT
Dockerfile projection: absent
provider_mapping: PROVIDER_NEUTRAL
```

### Example B — evidenced Node worker

Input proves exact Node version, build command, executable worker start command, no inbound port, explicit process health command, no persistent local state.

Expected: a Docker-first process plan may be `READY` if all required evidence is present. No HTTP health route is invented.

### Example C — secret value supplied

Input contains `DATABASE_PASSWORD=actual-value`.

Expected: `BLOCKED / SECRET_MATERIAL_PRESENT`, with returned output sanitizing the value.

## Acceptance evidence

Part B must provide real same-path Skill-vs-no-Skill evaluation with frozen provider-blind truth; exact candidate gating; deterministic evaluator; canonical positive/negative fixtures; atomic isolation; grouped assertion contribution accounting; hard invariants; unsafe counters; typecheck/full-suite/clean-build/post-build; no Part A/Core/AgentDefinition/dependency/provider drift.

HI-053 is not self-awarded. It requires a different fresh non-authoring/non-fork/read-only verifier and control-plane acceptance.

