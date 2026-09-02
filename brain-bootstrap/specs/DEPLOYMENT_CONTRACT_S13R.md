# Deployment Engineering Contract — S13R

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

This contract is the semantic authority for S13R.

S13R defines a reusable Docker-first deployment-engineering method for target projects. It converts caller-supplied, verified repository/runtime facts into a provider-neutral containerization plan, safe environment/secret boundary, health/lifecycle mapping, persistence-preserving deployment handoff and evidence-based verification status.

It does **not** mean that `brain-veleiro` itself must become a web service. Repository reality at the S13R Authoring Gate proves `brain-veleiro` is a TypeScript library/in-process SDK with no production entry point, start command, public port or long-running process. S13R must preserve that fact rather than invent a server.

Normative words `MUST`, `MUST NOT`, `SHOULD`, `MAY`, `READY_TO_PACKAGE`, `PACKAGE_VERIFIED`, `DEPLOYED_VERIFIED`, `BLOCKED`, `UNKNOWN` and `DEFERRED` have strict contract meaning.

## 2. Repository-grounded identity

The bootstrap source defines:

```text
S13R — deployment
Docker first, environment/secrets, health checks, deploy verification; provider-specific adapters later.
```

S13Q explicitly deferred to S13R:

```text
Docker/containerization
environment/secrets provisioning
health checks
hosting/provider mapping
deployment execution
deployed verification
provider-specific deployment adapters
```

The phrase `provider-specific adapters later` constrains S13R v1: this step owns the provider-neutral method, artifacts, generic handoff and verification semantics, but does not hardcode or implement a specific hosting adapter absent a separate canonical decision.

## 3. Canonical resolution

### 3.1 Classification

```text
S13R = SKILL_ONLY
```

Reason: deployment is a reusable engineering procedure over repository/runtime/evidence facts. S13R does not require a new adaptive agent role, new AgentDefinition or Core runtime branch. It uses the existing generic Skill discovery/AgentDefinition/runtime path.

```text
S12 Skill discovery + exact lazy selected-Skill load
→ compatible existing AgentDefinition
→ S10 compileAgentDefinition()
→ S09 runAgent()
→ parse actual candidate
→ deterministic candidate gate
→ deterministic deployment evaluator
```

### 3.2 Quality depth

```text
S13R = DEEP
```

Deployment has infrastructure side effects, native dependency/platform compatibility, secret boundaries, network exposure and false production-readiness risk. A DEEP quality contract is mandatory.

### 3.3 Deployable-unit decision

Canonical unit kinds:

```text
SERVICE
WORKER
JOB
CLI
LIBRARY
NONE
```

S13R may package only an already-existing executable `SERVICE`, `WORKER`, `JOB` or `CLI` for executable container verification.

`LIBRARY` and `NONE` are valid classifications. They become `BLOCKED` when the requested deployment requires a process that does not exist. S13R cannot convert them into a service/worker/CLI by invention.

This is the ruling for the current `brain-veleiro` repository: applying S13R to `brain-veleiro` with a request for a live hosted service must block unless an upstream approved architecture first introduces an executable unit. The S13R reference implementation therefore demonstrates the method on target-project fixtures; it does not make Brain itself a server.

### 3.4 Provider posture

```text
S13R v1 provider posture = PROVIDER_NEUTRAL
```

No Render, Fly.io, Railway, Vercel, AWS, GCP, Azure, Kubernetes or other provider is canonical at this point.

S13R may emit a provider-neutral handoff containing:

```text
unit kind
artifact/revision identity
start command
ports/protocols when existing
health/readiness semantics when existing
environment-variable names
secret refs
persistence requirements
resource/privilege limitations when evidenced
verification requirements
```

A named-provider mapping may be validated only when an already-approved provider constraint is passed as input. It may not introduce SDK/MCP/OAuth/account provisioning logic in the reference planner.

### 3.5 Persistence posture

S13R preserves existing persistence. It does not decide that an ephemeral store must become durable, or that SQLite/local files must become Postgres/object storage.

For the current Brain reference memory provider, `:memory:` remains ephemeral/reference behavior. A caller-supplied file `databasePath` is not evidence that deployment requires a durable volume. A volume is justified only by an existing durability requirement or approved architecture fact.

### 3.6 Health posture

Health/readiness is runtime-kind-specific:

```text
SERVICE -> existing endpoint or executable health command
WORKER  -> existing process/self-check semantics
JOB     -> bounded execution + expected exit/result
CLI     -> bounded execution + expected exit/result
LIBRARY -> no process health
NONE    -> no process health
```

S13R MUST NOT create a health server or route merely because deployment tooling commonly expects one.

## 4. Architectural decision for Part B

Part B is a pure deterministic Intelligence reference module plus focused fixtures/tests.

Part B MAY add responsibilities equivalent to:

```text
src/intelligence/deployment/
  constants.ts
  types.ts
  validateDeploymentInput.ts
  classifyDeployableUnit.ts
  buildContainerPlan.ts
  buildEnvironmentPlan.ts
  buildPersistencePlan.ts
  buildHealthPlan.ts
  buildProviderHandoff.ts
  buildVerificationPlan.ts
  renderDockerfile.ts
  renderDockerignore.ts
  renderEnvExample.ts
  validateDeploymentCandidate.ts
  quality.ts
  deploymentSkill.ts
  planDeployment.ts
  index.ts
```

Exact filenames may follow repository conventions.

The existing pre-S13R boundary tests that forbid a `src/intelligence/deployment` directory may be updated **mechanically only** to recognize this newly authorized canonical S13R module, following the same pattern used by prior S13x additions. That mechanical authorization is not permission to weaken S14+ or Core boundaries.

Allowed Part B additions:

```text
one append-only S12 reference Skill catalog entry for intelligence.deployment.s13r
src/intelligence/deployment/** deterministic reference implementation
focused deployment fixtures/tests
one disposable executable target-project fixture under tests/deployment/fixtures/**
verification report and handoff
deterministic in-memory Dockerfile/.dockerignore/.env.example projection
mechanical adjacent boundary-test updates required solely by S13R's authorized module/catalog entry
```

Forbidden Part B changes:

```text
Core semantics
new AgentDefinition
new npm runtime/dev dependency
provider SDK or vendor client
MCP/connector/OAuth/account provisioning
production server/worker/CLI added to brain-veleiro
persistent database/provider migration
CI/CD platform or release automation
secret values
provider-specific deployment adapter
S14+ implementation
semantic edit to S09..S13Q canonical Part A
```

The reference module performs no filesystem, shell, Docker-daemon, environment, network or provider I/O. Real Docker evidence is produced by an external verification procedure operating on the deterministic artifact projection/fixture.

## 5. Canonical input model

```ts
type DeployableUnitKind = "SERVICE" | "WORKER" | "JOB" | "CLI" | "LIBRARY" | "NONE";

type DeploymentStatus =
  | "READY_TO_PACKAGE"
  | "PACKAGE_VERIFIED"
  | "DEPLOYED_VERIFIED"
  | "BLOCKED";

interface DeploymentInput {
  deployment_identity: DeploymentIdentity;
  repository_facts: readonly DeploymentRepositoryFact[];
  runtime_surface: RuntimeSurface;
  environment_contract: EnvironmentContract;
  persistence_facts: readonly PersistenceFact[];
  health_facts: readonly HealthFact[];
  verification_evidence: readonly DeploymentEvidence[];
  policy: DeploymentPolicy;
  provider_constraints?: ProviderConstraint;
  native_dependency_facts?: readonly NativeDependencyFact[];
  evidence_refs?: readonly SafeRef[];
}
```

All arrays are immutable caller data. The implementation MUST clone/normalize before processing and MUST NOT mutate caller input.

## 6. DeploymentIdentity

Required fields:

```text
project_ref
revision_ref
deployment_intent_ref
requested_unit_kind
artifact_ref
```

Optional:

```text
accepted_ancestor_refs
source_handoff_ref
```

All refs use the repository's bounded safe-ref grammar. Revision identity must be unambiguous.

## 7. RuntimeSurface

Required:

```text
kind
exists
```

Executable units (`SERVICE`, `WORKER`, `JOB`, `CLI`) additionally require evidence-backed values as applicable:

```text
entrypoint_ref
start_command_ref
start_command
runtime_ref
runtime_major
build_command_ref
build_command
protocol
ports
lifecycle_refs
```

`LIBRARY` and `NONE` MUST NOT carry a fabricated process start command.

For `SERVICE`, ports/routes/protocols appear only if explicit repository/runtime evidence supports them.

## 8. Repository facts

Allowed fact kinds include bounded values such as:

```text
RUNTIME_VERSION
PACKAGE_MANAGER
LOCKFILE
INSTALL_COMMAND
BUILD_COMMAND
START_COMMAND
ENTRYPOINT
PORT
PROTOCOL
HEALTH_ENDPOINT
HEALTH_COMMAND
SHUTDOWN_SIGNAL
WORKING_DIRECTORY
BUILD_OUTPUT
DOCKER_CONTEXT_INCLUDE
DOCKER_CONTEXT_EXCLUDE
NATIVE_DEPENDENCY
PLATFORM
LIBC
ARCHITECTURE
```

A fact records:

```text
fact_id
kind
subject_ref
value
revision_ref
source_ref
confidence = VERIFIED | COMMITTED | DECLARED
```

Free-form prose is not an executable fact.

## 9. EnvironmentContract

Each allowed variable is represented only by name/reference:

```ts
type EnvClass =
  | "PUBLIC_CONFIG"
  | "SECRET_REF"
  | "OPTIONAL_CONFIG"
  | "BUILD_ONLY"
  | "TEST_ONLY";
```

Fields:

```text
name
class
required
source_ref
safe_example_value?  // forbidden for SECRET_REF
```

Secret values are not part of the schema. Unknown variables fail validation rather than being copied.

A deterministic `.env.example` projection may contain:

- safe non-secret example values explicitly supplied as safe facts;
- empty placeholders or `<SECRET_REF:name>`-style non-secret reference markers for secret names.

It may never contain a secret value.

## 10. PersistenceFact

Canonical storage classes:

```text
EPHEMERAL_MEMORY
EPHEMERAL_FILE
DURABLE_LOCAL_FILE
EXTERNAL_DURABLE_SERVICE
NONE
```

Each fact states the current architecture, not a desired migration.

A volume/mount proposal is eligible only for `DURABLE_LOCAL_FILE` when the requirement is explicitly accepted. `EPHEMERAL_MEMORY` and `NONE` do not gain a volume by default.

## 11. HealthFact

Allowed health kinds:

```text
HTTP_HEALTH
COMMAND_HEALTH
PROCESS_SELF_CHECK
JOB_EXIT
CLI_EXIT
NONE
```

Every non-`NONE` fact binds the runtime surface and source evidence. HTTP health requires an existing route/port/protocol; S13R does not create them.

## 12. NativeDependencyFact

Fields:

```text
package_ref
native_kind
supported_runtime_majors
platform
architecture
libc
prebuilt_available
build_toolchain_refs
runtime_library_refs
source_ref
```

If target compatibility cannot be proven, the plan is `BLOCKED` rather than guessed.

## 13. ProviderConstraint

Canonical state:

```text
mode = PROVIDER_NEUTRAL | APPROVED_NAMED_PROVIDER
provider_ref?  // safe opaque/name ref only when already approved
requirements[]
source_ref
```

`APPROVED_NAMED_PROVIDER` is caller evidence that a separate decision already exists; it is not created by S13R.

No credential/account identifiers belong in this structure.

## 14. DeploymentEvidence

Allowed evidence levels:

```text
STATIC_PLAN
IMAGE_BUILT
CONTAINER_EXERCISED
EXTERNAL_DEPLOYMENT_OBSERVED
```

Common fields:

```text
evidence_id
level
revision_ref
artifact_ref
artifact_digest?
outcome = PASS | FAIL
observable_code
safe_ref
source_kind
```

External evidence may add provider-neutral safe fields:

```text
deployment_ref
observed_status
health_or_exit_outcome
safe_endpoint_ref?
```

Raw provider logs, credentials, headers, bodies, account IDs and tokens are forbidden.

Evidence precedence:

```text
accepted direct executable observation
> accepted artifact/build observation
> committed repository fact
> approved canonical contract/ADR
> accepted handoff
> caller assertion
> UNKNOWN
```

## 15. DeploymentPolicy

The v1 policy contains bounded choices only:

```text
require_docker_first: true
allow_provider_specific_artifact: false
require_non_root_when_feasible: true
require_lockfile_fidelity: true
require_secret_value_absence: true
require_exact_revision_binding: true
require_real_container_evidence_for_package_verified: true
allow_runtime_invention: false
allow_persistence_migration: false
allow_ci_cd_creation: false
```

Part B may expose lower/stricter bounds but cannot loosen these canonical requirements.

## 16. Canonical output model

```ts
interface DeploymentResult {
  status: DeploymentStatus;
  blockers: readonly DeploymentBlocker[];
  deployment_identity: DeploymentIdentity;
  deployable_unit: DeployableUnitDecision;
  container_plan: ContainerPlan | null;
  environment_plan: EnvironmentPlan;
  secret_boundary: SecretBoundary;
  persistence_plan: PersistencePlan;
  health_plan: HealthPlan;
  provider_handoff: ProviderHandoff;
  verification_plan: VerificationPlan;
  accepted_evidence: readonly AcceptedDeploymentEvidence[];
  limitations: readonly DeploymentLimitation[];
  warnings: readonly DeploymentWarning[];
  provenance: DeploymentProvenance;
}
```

All arrays/orderings are deterministic.

## 17. ContainerPlan

The plan is a structured representation first. Dockerfile text is derivative.

Required fields for executable units:

```text
base_runtime_ref
runtime_major
platform
install_strategy
build_command
start_command
working_directory
build_context_includes
build_context_excludes
final_user
exposed_ports[]
native_build_requirements[]
proposed_files[]
```

`proposed_files` may include:

```text
Dockerfile
.dockerignore
.env.example  // only when environment names exist
```

No provider-specific manifest is part of the default S13R v1 output.

## 18. Dockerfile projection rules

A deterministic Dockerfile renderer MUST:

1. use an evidence-backed bounded runtime/base-image reference;
2. copy package manifests/lockfiles before source when that ecosystem strategy is applicable;
3. use lock-faithful install semantics;
4. use a separate build stage when native/build tooling or TypeScript compilation makes it materially safer/smaller;
5. exclude secret values and secret files;
6. include only evidence-backed build/start commands;
7. set a non-root final user when feasible;
8. expose only evidence-backed ports;
9. add a Docker `HEALTHCHECK` only when a valid existing health command can execute in the final image without inventing a route/tool;
10. preserve deterministic instruction order.

The renderer is not permitted to add `curl`, `wget`, shell packages or another health dependency merely to fabricate a probe unless that package addition is separately justified by the target's deployment plan.

## 19. Dockerignore projection rules

At minimum, absent an evidence-backed exception, exclude:

```text
.git
node_modules
dist
coverage
.env
.env.*
*.pem
*.key
*.p12
*.pfx
*.log
.tmp
tmp
```

`.env.example` may be included only when it contains no secret values.

Repository-specific safe exclusions may be added deterministically from facts.

## 20. Status derivation

### 20.1 BLOCKED

`BLOCKED` when any material condition is true:

- revision identity missing/conflicting;
- requested executable unit does not exist;
- entry/start/build command required but unsupported;
- port/health surface invented;
- env name unknown;
- secret value present;
- native target incompatible/unknown where required;
- persistence would be silently changed;
- unauthorized provider-specific artifact requested;
- actual candidate fails deterministic gate.

### 20.2 READY_TO_PACKAGE

Requires:

- all deterministic plan invariants pass;
- executable unit exists;
- container/environment/persistence/health plan is truthful;
- no secret value;
- no required real image/container evidence is yet accepted.

Docker runtime absence is compatible with `READY_TO_PACKAGE` only when all deterministic plan conditions pass and the limitation is explicit.

### 20.3 PACKAGE_VERIFIED

Requires everything for `READY_TO_PACKAGE` plus:

```text
IMAGE_BUILT PASS
CONTAINER_EXERCISED PASS
exact revision/artifact binding
applicable health/readiness or job/CLI exit observable PASS
```

Evidence must come from a real OCI/Docker runtime. Mocks/snapshots/simulated command transcripts do not qualify.

### 20.4 DEPLOYED_VERIFIED

Requires `PACKAGE_VERIFIED` semantics or equivalent exact external artifact provenance plus:

```text
EXTERNAL_DEPLOYMENT_OBSERVED PASS
exact deployed artifact/revision binding
applicable health/readiness or job/CLI exit observable PASS
```

No specific hosting provider is required by S13R closure. This status path must be tested deterministically with safe evidence fixtures, but real external-provider deployment is not a closure prerequisite while provider-specific adapters remain deferred.

## 21. Real executable-container gate

S13R factual closure requires at least one real disposable container build and exercise against an **existing executable fixture project**.

Part B may add a bounded fixture under:

```text
tests/deployment/fixtures/existing-node-service/
```

The fixture MAY contain a minimal Node 24 service using only built-in runtime APIs, with its start command, port and health route explicitly present in the fixture before the S13R artifact plan is generated. The deployment skill must derive from those facts; it may not hide them in expected-answer lookup.

Required real proof:

```text
render exact Dockerfile/.dockerignore from candidate plan
write only into disposable fixture/work directory
real docker/OCI build succeeds
capture safe image/artifact identity
disposable container starts
existing fixture observable succeeds
container stops/cleans up
no secret material emitted
```

If the builder environment lacks a usable Docker/OCI runtime, it may complete deterministic Part B implementation and publish a candidate, but status remains:

```text
BLOCKED_FOR_EXECUTABLE_VERIFICATION
```

No fresh verifier or HI-053 award is authorized until the real gate is produced in an approved environment.

## 22. Reference fixture is not product architecture

The executable deployment fixture exists only to verify the S13R method. It MUST live under `tests/deployment/fixtures/**` or an equivalent explicitly test-only path.

It does NOT create:

```text
brain-veleiro production server
brain-veleiro public port
brain-veleiro health endpoint
new Core capability
new AgentDefinition
```

Existing anti-server guardrails for `src/**` remain semantically valid.

## 23. Source-fact isolation

Every A01..A30 MUST be derived from an owned underlying input/evidence fact.

A valid isolation probe:

```text
shared raw DeploymentInput + audit evidence
→ clone
→ mutate exactly one governing source fact
→ rerun canonical validation/planner/candidate gate/evaluator
→ recompute all A01..A30
→ measure changed atomic set
```

Direct mutation of:

```text
DeploymentResult
container_plan
environment_plan
health_plan
unsafe counter
expected observation
actual observation
correct flag
```

is not valid isolation.

No structural cross-assertion dependency is pre-authorized by Part A. If Part B proves one is unavoidable, STOP and return the exact measured causal set to ChatGPT Authoring Gate before verification; do not invent a waiver.

## 24. Unsafe counters

The canonical counters are UC01..UC16 from the Quality Contract.

Each must:

- derive from real governing source/candidate evidence;
- be zero on all canonical positive fixtures and Skill-arm A/B candidates;
- be independently fireable with at least one named negative fixture;
- never branch on fixture ID, scenario ID, arm ID or expected truth.

## 25. Same-path Skill-vs-no-Skill proof

Use 12 frozen scenarios and 30 atomic assertions per arm.

The provider receives the same visible task/input facts in both arms. The Skill arm additionally receives the exact selected S13R Skill content through S12 lazy load. Provider cannot see fixture/scenario/arm IDs or expected truth.

Path:

```text
S12
→ S10
→ S09
→ actual parsed candidate
→ deterministic candidate gate
→ post-gate evaluator
```

Baseline may be weaker naturally but MUST NOT use a deliberately bad synthesizer.

PASS thresholds:

```text
Skill score > baseline score
qualified dimensions >= 7/10
>= 2 distinct improved assertion IDs per qualified dimension
max one assertion share <= 0.50 within each qualified dimension
0 atomic regressions
all Skill-arm UC01..UC16 = 0
```

Contribution math groups by assertion ID; `1/delta` is not a valid concentration calculation.

## 26. Candidate gate

The candidate gate validates the **actual parsed candidate**.

The gate may deterministically recompute:

- required schema/status constraints;
- secret absence;
- exact revision and deployable-unit consistency;
- provider/persistence/stage boundaries;
- evidence-level eligibility.

It MUST NOT replace the actual candidate with a separately synthesized faithful plan before scoring.

## 27. Secret detection boundary

Structural exclusion is primary. Defensive pattern checks may reject obviously secret-bearing values but cannot claim universal secret detection.

No test may prove secret safety solely by searching for one literal token. Canonical negative coverage must include multiple secret classes and structural locations.

## 28. Determinism

The reference module MUST NOT call:

```text
Date.now
new Date without caller value
Math.random
process.env
filesystem
git
shell/child_process
Docker API/CLI
network/fetch/http
cloud provider API
mutable module-global state
```

Equal normalized inputs and audit evidence produce byte-equivalent results and artifact projections.

## 29. Protected boundaries

S13R may not change semantic behavior in:

```text
src/core/**
existing AgentDefinition compiler/runtime
S09..S13Q canonical Part A
existing provider ports
```

S14+ remain out of scope:

```text
Capability Registry / Tools / MCP
Verifier Agent
Architecture Challenger
Workflow Runtime
Delegation
Orchestrator
cross-run Resource Manager
Build-Day Operating Model
unknown-domain E2E
Freeze / Release
```

CI/CD creation is also excluded from S13R v1 unless separately authorized.

## 30. Deployment claims and production claims

Allowed claims are bounded:

```text
plan valid
image built
container exercised
deployment observed
health/exit observable passed
```

Forbidden inference without separate evidence:

```text
production-ready
secure in all environments
highly available
scalable
backed up
SLO-compliant
compliant/certified
cost-optimized
release-ready
```

## 31. Canonical positive inventory

Exactly 12:

```text
P01_EXISTING_NODE_SERVICE_DOCKER_PLAN
P02_EXISTING_WORKER_WITH_PROCESS_SELF_CHECK
P03_ONE_SHOT_JOB_EXIT_VERIFICATION
P04_EXISTING_CLI_CONTAINER_ARTIFACT
P05_ENV_NAMES_AND_SECRET_REFS_ONLY
P06_EPHEMERAL_SQLITE_PRESERVED
P07_PREAPPROVED_DURABLE_FILE_VOLUME
P08_NATIVE_ADDON_WITH_EXPLICIT_BUILD_TOOLCHAIN
P09_PROVIDER_NEUTRAL_HANDOFF
P10_RUNTIME_UNAVAILABLE_READY_TO_PACKAGE_ONLY
P11_REAL_CONTAINER_EVIDENCE_PACKAGE_VERIFIED
P12_EXTERNAL_EVIDENCE_DEPLOYED_VERIFIED
```

## 32. Canonical negative inventory

Exactly N01..N40 as named in `S13R_DEPLOYMENT_DEEP.yaml`.

Every negative fixture must assert the governing blocker/counter, not merely that the overall status is `BLOCKED`.

## 33. Verification order

Required order:

1. exact Part A blob identity;
2. static/type correctness;
3. P01..P12 and N01..N40;
4. A01..A30 source-fact isolation;
5. S13R-HI-001..030;
6. UC01..UC16 zero/fireability;
7. artifact projection determinism/secret safety;
8. actual-candidate same-path A/B;
9. full suite pre-build;
10. genuine dist-absent clean build;
11. full suite post-build;
12. protected-boundary/diff audit;
13. real disposable Docker/OCI build + container exercise;
14. fresh non-authoring independent verification;
15. control-plane acceptance/HI-053/factual closure.

A deterministic test snapshot is not a substitute for step 13.

## 34. Environment-blocked execution

The current Authoring Gate knows that the primary WSL builder environment lacks a usable Docker daemon/runtime.

Therefore Part B instructions must distinguish:

```text
IMPLEMENTATION_COMPLETE
DETERMINISTIC_QA_PASS
BLOCKED_FOR_EXECUTABLE_VERIFICATION
```

A candidate may be committed/pushed with the first two true and the third true. It MUST NOT be labeled independently verified or ready for factual closure until the real container gate succeeds.

Enabling/installing/changing host Docker is not automatically authorized by Part A. The builder must use an already-available approved environment or return the environmental blocker to the control plane/user.

## 35. Part B stop boundary

Canonical Part A consists of exactly:

```text
brain-bootstrap/skills/DEPLOYMENT_SKILL_S13R.md
brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml
brain-bootstrap/specs/DEPLOYMENT_CONTRACT_S13R.md
```

They are integrated byte-identically.

After integration, S13R remains `NOT_STARTED` until explicit Part B authorization is issued according to repository protocol.

Part B must stop after producing its candidate/evidence handoff. It cannot self-award PASS/HI-053, factually close S13R or start S14.

## 36. Non-goals

- Turning `brain-veleiro` into a production HTTP server.
- Hardcoding a deployment vendor.
- Multi-provider deployment factory.
- Provider SDK/MCP/OAuth/account-resource management.
- Database/persistence migration.
- Secret-value storage/provisioning.
- CI/CD platform or release automation.
- S14+ work.
- Production-readiness certification.
