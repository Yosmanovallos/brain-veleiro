# BRAIN — Deployment Contract S13R

## 1. Status and authority

```yaml
step: S13R
name: deployment
version: 1.0.0
depth: DEEP
classification: SKILL_ONLY
status: AUTHORING_READY
honor_invariant_candidate: HI-053
```

This semantic contract is the authority for S13R.

S13R follows S13Q delivery-documentation-demo and precedes S14 Capability Registry / Tools / MCP.

## 2. Repository-grounded resolution

The bootstrap roadmap defines:

```text
S13R — deployment
Docker first, environment/secrets, health checks, deploy verification; provider-specific adapters later.
```

Preflight at baseline `56770fc631381b7a26d97405af5e6e10320012f9` proves:

```text
Brain is a private TypeScript/ESM library/in-process SDK.
There is no product start script, bin, CLI, server, worker or daemon.
There is no product-bound port, health endpoint or runtime environment contract.
There is no Docker/platform/CI deployment artifact or selected provider.
```

The apparent contradiction is resolved normatively:

> S13R defines and verifies deployment semantics. It does not create a new product runtime merely so this repository can be deployed.

For the current Brain baseline, the correct deployment assessment is therefore blocked on the missing deployable entrypoint.

## 3. Canonical classification

```text
S13R = SKILL_ONLY + DEEP
```

No new adaptive AgentDefinition is justified. The work is deterministic reasoning over bounded caller-supplied repository/runtime/deployment evidence.

DEEP is required because deployment combines credential safety, runtime/process identity, external-effect readiness and a high risk of false production claims.

## 4. Architectural boundary

Part B may add a pure reference module equivalent to:

```text
src/intelligence/deployment/
  constants.ts
  types.ts
  validateDeploymentInput.ts
  deriveDeploymentFacts.ts
  assessEntrypoint.ts
  buildContainerPlan.ts
  buildEnvironmentPlan.ts
  buildHealthPlan.ts
  buildPersistencePlan.ts
  evaluateDeploymentEvidence.ts
  validateDeploymentCandidate.ts
  quality.ts
  deploymentSkill.ts
  planDeployment.ts
  index.ts
```

Exact filenames may follow repository convention.

Allowed adjacent changes:

```text
one append-only S12 Skill catalog entry
focused deterministic tests/fixtures
verification report/handoff
mechanical updates to existing boundary tests so they allow exactly the canonical S13R deployment reference module
```

Part B canonical logic performs no filesystem, shell, Docker-daemon, network, hosting or secret-manager side effect.

This contract does not authorize creation of a product runtime. It also does not authorize an actual repo-root Dockerfile for the current Brain baseline because no executable launch target exists to put in it.

## 5. Input model

Reference shape:

```ts
interface DeploymentInput {
  identity: DeploymentIdentity;
  repository_facts: readonly RepositoryFact[];
  runtime_surface: RuntimeSurface;
  build_contract: BuildContract;
  container_policy: ContainerPolicy;
  environment_contract: EnvironmentContract;
  health_contract: HealthContract;
  persistence_contract: PersistenceContract;
  deployment_evidence: readonly DeploymentEvidence[];
  policy: DeploymentPolicy;
  provider_authority?: ProviderAuthority;
  evidence_refs?: readonly SafeRef[];
}
```

### 5.1 DeploymentIdentity

Required:

```text
project_ref
revision_ref
deployment_scope_ref
```

Optional:

```text
baseline_revision_ref
accepted_ancestry_or_range_ref
```

All material evidence must bind to `revision_ref` or an explicitly accepted ancestry/range.

### 5.2 RuntimeSurface

Canonical fields:

```text
kind = LIBRARY_ONLY | HTTP_SERVICE | WORKER | CLI_PROCESS | OTHER_EXECUTABLE | NONE
entrypoint_ref?
start_command_ref?
start_command?
port_ref?
port?
health_transport = HTTP | COMMAND | PROCESS | NONE
```

`LIBRARY_ONLY` and `NONE` are not deployable process kinds by themselves.

The evaluator must not infer a missing entrypoint from build artifacts, package name, index barrels, tests or roadmap text.

### 5.3 BuildContract

Canonical fields:

```text
build_command
build_artifact_refs
runtime_name
runtime_version
package_manager?
install_command?
```

Every command/value must originate from accepted repository facts. The system must not choose npm/yarn/pnpm/bun or a runtime version merely because one is common.

### 5.4 ContainerPolicy

Canonical fields:

```text
strategy = DOCKER_FIRST
base_runtime_ref?
non_root_required?
read_only_root_preferred?
working_directory?
```

The policy cannot make an ineligible runtime eligible.

### 5.5 EnvironmentContract

Each environment item contains:

```text
name
requirement = REQUIRED | OPTIONAL
classification = PUBLIC_CONFIG | SENSITIVE_REFERENCE
source_ref
secret_ref?
```

No value field exists for sensitive material.

Unknown names are not guessed.

### 5.6 HealthContract

Canonical fields:

```text
transport = HTTP | COMMAND | PROCESS | NONE
liveness_check?
readiness_check?
source_ref?
```

For HTTP, any path/port must be evidenced by the runtime surface. For COMMAND, the exact check command must be evidenced. For PROCESS, only process-level semantics may be claimed.

`NONE` is valid for a non-running library but cannot support deployment READY for a long-running service requiring health evidence.

### 5.7 PersistenceContract

Canonical mode:

```text
NONE
EPHEMERAL
PERSISTENT_LOCAL
EXTERNAL_SERVICE
UNKNOWN
```

Include writable-path facts only when real. A volume/external service is not selected by inference.

### 5.8 DeploymentEvidence

Canonical evidence kinds include:

```text
BUILD_PASS
IMAGE_BUILD_PASS
PROCESS_START_PASS
LIVENESS_PASS
READINESS_PASS
DEPLOYED_REVISION_OBSERVED
DEPLOYED_SMOKE_PASS
```

Evidence fields include:

```text
evidence_id
kind
revision_ref
subject_ref
result = PASS | FAIL | UNKNOWN
source_ref
evidence_refs
```

Evidence must be non-empty, resolving and revision-consistent to support READY.

Candidate prose saying "deployed" is not deployment evidence.

## 6. Entrypoint eligibility

Canonical rule:

```text
if runtime_surface.kind in {LIBRARY_ONLY, NONE}
  => BLOCKED / BLOCKED_NO_DEPLOYABLE_ENTRYPOINT
```

An executable kind additionally requires an evidenced entrypoint/start contract.

The following are not entrypoint proof:

```text
TypeScript compilation
presence of dist/
index.ts barrels
unit tests
package.json name/type
README roadmap
S13Q setup/demo text
```

No workaround may synthesize a new server/worker/CLI.

## 7. Docker-first packaging

If and only if entrypoint eligibility passes, derive a structured Docker plan containing facts such as:

```text
runtime/base image intent
working directory
copy/install/build phases
runtime artifact set
start command
exposed port only when real
user/security intent
healthcheck only when real
```

The canonical plan may produce a deterministic Dockerfile projection.

The projection is not authority. It cannot introduce an install command, runtime image, port, command, path or environment name absent from accepted facts/policy.

If required container facts are unknown, status is PARTIAL/BLOCKED rather than guessed.

## 8. Environment and secrets

Secret minimization is mandatory.

The canonical shape stores only secret references and presence state. It rejects secret-bearing canonical keys or values including credentials, bearer tokens, private keys, raw `.env` payloads and raw secret-manager responses.

Returned BLOCKED decisions must sanitize blocker text and references so the rejected value is not echoed.

S13R defines injection requirements, not a concrete secret manager.

## 9. Health/readiness

Canonical separation:

```text
build success != process start success
process start success != liveness
liveness != readiness
unit tests != deployed readiness
```

Health/readiness must be derived from the existing process semantics.

- HTTP: path/port must already exist.
- Worker/CLI: command/process check only if already defined.
- No process: no invented health endpoint.

## 10. Persistence

The evaluator must make persistence assumptions explicit.

`PERSISTENT_LOCAL` requires an evidenced writable path plus an authorized persistence/volume decision. `EXTERNAL_SERVICE` requires an already-authorized external-service fact.

For the current Brain memory provider, an optional caller-supplied SQLite path does not itself authorize a deployment volume or external DB. Default/reference `:memory:` behavior remains an upstream fact, not an S13R architecture migration.

If deployment would require a new persistence architecture, the builder must stop at a semantic/ADR gate instead of silently widening S13R.

## 11. Provider mapping

Canonical default:

```text
PROVIDER_NEUTRAL
```

A provider-specific mapping is allowed only when explicit `ProviderAuthority` references a canonical repository/caller decision. The provider name may affect adapter projection but cannot alter core package truth.

No provider can be inferred from prior user projects or preferences.

Provider-specific adapters are not part of this initial S13R Part B.

## 12. Candidate gate

Execution order is normative:

```text
model/provider candidate
→ parse candidate
→ deterministic structural validation
→ recompute protected fields/claims from input facts
→ fail-closed candidate gate
→ deterministic evaluator
```

The gate validates the actual candidate. It must not discard that candidate and score a separately synthesized answer.

Protected claims include:

```text
entrypoint existence/kind
build/start commands
runtime version
port/health surface
environment names
persistence mode
provider authority
revision identity
READY/PARTIAL/BLOCKED status
```

## 13. Provider blindness and evidence truth

Real Skill-vs-no-Skill evaluation must preserve identical:

```text
inputs
frozen source truth
generic provider implementation
capability provider
base AgentDefinition
S12/S10/S09 execution path
parser
gate
evaluator
```

Only selected Skill prose/availability differs.

The evaluated provider may not see:

```text
fixture ID
expected result
hidden truth
atomic evaluator helpers
arm name
with_skill flag
Skill ID/name as answer key
```

Guidance consumption must be content-derived.

## 14. Atomic quality and isolation

The Quality Contract owns 10 semantic dimensions x 3 atomic assertions = 30 observations.

Canonical isolation requires mutating one owned underlying input/source/evidence fact, then recomputing the real decision/evaluator. Do not mutate a final boolean or a private expected-observation copy.

If one source fact structurally governs multiple assertions, any dependency must be explicit in test evidence; otherwise exactly the intended assertion must change.

## 15. Skill-vs-no-Skill threshold

Required:

```text
Skill atomic correctness > baseline
>= 7/10 qualified dimensions
>= 2 distinct improved assertion IDs per qualified dimension
max single assertion share <= 0.50
0 atomic regressions
all 30 S13R hard invariants true in Skill arm
all 12 unsafe counters == 0
```

Grouped contribution share is:

```text
max(improved instances contributed by one assertion ID)
/
total improved instances in that dimension
```

Never use `1 / delta` as a proxy.

## 16. Canonical current-repo positive

The fixture representing authoring baseline must prove that an honest deployment Skill improves behavior by refusing false packaging:

```text
runtime kind: LIBRARY_ONLY
build: typecheck/test/build known
start command: absent
product port: absent
health transport: NONE
provider: none
```

Correct outcome:

```text
BLOCKED
BLOCKED_NO_DEPLOYABLE_ENTRYPOINT
no Dockerfile projection
no provider selection
no invented env vars
```

This fixture prevents the stage from becoming a mechanism for manufacturing deployability.

## 17. Architecture boundaries

S13R may own the pure deployment reference module and deployment Skill semantics.

S13R does not own:

```text
new application server architecture
Capability Registry
MCP/OAuth/connectors
tool execution binding
Verifier Agent
Architecture Challenger
Workflow Runtime
Delegation
Orchestrator
resource-manager operating system
multi-provider deployment factory
```

Core remains provider-neutral and cannot import the deployment module/provider implementation.

No package dependency addition is expected or authorized by Part A.

## 18. Existing boundary-test reconciliation

Earlier tests may contain pre-S13R assertions that `src/intelligence` has no `deployment` directory. Once this Part A is integrated, the builder may mechanically narrow those assertions so they:

```text
allow exactly src/intelligence/deployment/** as S13R
continue forbidding capability-registry/provider-platform/future-stage implementation
```

This is a stage-boundary update, not permission to weaken unrelated tests.

## 19. Part B expected scope

Expected additions are bounded to:

```text
src/intelligence/deployment/**
one Skill catalog append
focused tests/fixtures
verification report/handoff
strictly mechanical adjacent boundary-test updates
factual STATE/CURRENT transitions
```

Do not create a usable production deployment for Brain by adding runtime behavior outside this contract.

## 20. Positive and negative fixtures

Part B must implement exactly the 10 positive and 36 negative fixture IDs listed in the Quality Contract. Fixture semantics are authoritative; builders may enrich input detail but may not weaken the named failure condition.

## 21. Unsafe counters

UC01..UC12 are behavior/audit-derived. They must not simply initialize to zero.

Each counter must have at least one adversarial test proving the forbidden condition increments or is otherwise detected, while every canonical Skill-arm fixture must finish with zero unsafe counters.

## 22. Determinism and side-effect boundary

Canonical evaluation is pure with respect to caller-owned inputs.

Forbidden hidden inputs:

```text
filesystem discovery
process.env values
Docker daemon state
network/provider APIs
browser state
wall clock
randomness
```

Real external deployment execution may be performed only by a later caller/capability outside this pure reference evaluator and represented back as explicit `DeploymentEvidence`. S13R does not pull S14 capability execution forward.

## 23. Verification protocol

Builder evidence must include:

```text
Node 24
typecheck
focused S13R tests
exact 10 positives
exact 36 negatives
30/30 real source/evidence isolation
actual-candidate gating
provider blindness/counterfactual guidance tests
same-path A/B with raw grouped contributions
HI-001..030 true
UC01..UC12 zero on Skill arm
full pre-build suite
proof repo-local dist absent
genuine build
full post-build suite
git diff --check
Part A byte identity
Core/AgentDefinition/dependency/provider/S14+ boundary checks
```

The builder cannot award HI-053.

## 24. Independent close gate

After builder PASS, a different fresh non-authoring, non-fork, read-only verifier must independently inspect committed source/tree evidence and execute the required checks against the exact candidate.

Only after the verifier reproduces all required evidence may it report HI-053 PASS. The control plane then accepts or rejects closure.

S14 remains forbidden until S13R is `VERIFIED PASS / CLOSED` and the control plane explicitly advances the frontier.

