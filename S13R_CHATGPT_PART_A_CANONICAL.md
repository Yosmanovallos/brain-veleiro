# S13R_CHATGPT_PART_A_CANONICAL

Authoring authority: ChatGPT control plane
Step: S13R — deployment
Baseline: `56770fc631381b7a26d97405af5e6e10320012f9`
Classification: `SKILL_ONLY`
Depth: `DEEP`
Honor invariant candidate: `HI-053`

This transfer contains the three canonical Part A artifacts. Integrate them byte-for-byte at the exact paths below. Do not merge this authoring branch.

---
BEGIN FILE: brain-bootstrap/skills/DEPLOYMENT_SKILL_S13R.md
---
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

---
END FILE: brain-bootstrap/skills/DEPLOYMENT_SKILL_S13R.md
---

---
BEGIN FILE: brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml
---
schema_version: "1.0"
id: S13R_DEPLOYMENT_DEEP
step: S13R
name: deployment
version: "1.0.0"
status: AUTHORING_READY
depth: DEEP
classification: SKILL_ONLY
honor_invariant_candidate: HI-053

canonical_artifacts:
  skill: brain-bootstrap/skills/DEPLOYMENT_SKILL_S13R.md
  quality_contract: brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml
  semantic_contract: brain-bootstrap/specs/DEPLOYMENT_CONTRACT_S13R.md

purpose: >-
  Prove that S13R derives truthful Docker-first, provider-neutral deployment
  readiness and verification from explicit repository/runtime evidence; fails
  closed when no deployable entrypoint exists; never invents runtime, ports,
  health routes, environment variables, persistence or provider selection; and
  preserves S14+ boundaries.

depth_selection:
  result: DEEP
  floors:
    secret_handling: true
    deployment_boundary: true
  ratings:
    risk: {level: HIGH, reason: "Deployment mistakes can expose secrets, publish unusable artifacts or overclaim production readiness."}
    ambiguity: {level: HIGH, reason: "The repository currently has no deployable process, so packaging must distinguish absence from a reason to invent runtime."}
    novelty: {level: HIGH, reason: "No canonical deployment/container/health/env/provider surface exists in the repository."}
    irreversibility: {level: HIGH, reason: "Bad deployment artifacts and credential handling can have external effects when later executed."}
    downstream_impact: {level: HIGH, reason: "S13R is the final S13 engineering-method step before capability/tool stages."}

repository_decisions:
  - id: DEC-01
    decision: S13R is DEEP plus SKILL_ONLY; no new AgentDefinition or Core branch.
  - id: DEC-02
    decision: >-
      Current Brain baseline has no deployable product entrypoint. The canonical
      answer for that fact set is BLOCKED_NO_DEPLOYABLE_ENTRYPOINT; S13R must not
      create a server, CLI, worker, daemon, port or start command to escape it.
  - id: DEC-03
    decision: >-
      Docker-first means an OCI/Docker-compatible packaging plan is the first
      packaging representation only after an existing deployable entrypoint is evidenced.
  - id: DEC-04
    decision: >-
      S13R Part B is a pure deterministic Intelligence reference module. It may
      model deployment artifacts and evaluate caller-supplied deployment evidence,
      but performs no network, Docker, hosting, filesystem or secret-manager side effect.
  - id: DEC-05
    decision: >-
      Environment contracts contain names/classification/references only; secret
      values/raw .env/raw secret-manager responses are forbidden.
  - id: DEC-06
    decision: >-
      Health/readiness checks require an existing process/check transport. Build
      success or unit-test success alone is not liveness/readiness.
  - id: DEC-07
    decision: >-
      Provider mapping defaults to PROVIDER_NEUTRAL. Provider-specific adapters
      require separate explicit authority and are not inferred from user history.
  - id: DEC-08
    decision: >-
      New persistent volume/external shared-state requirements are architecture
      decisions, not mechanical S13R repairs.
  - id: DEC-09
    decision: >-
      Structured deployment output is authoritative; Dockerfile/config/check
      projections are deterministic derivatives and may not introduce facts.
  - id: DEC-10
    decision: >-
      S14+ capability/MCP/OAuth/tool execution and S15+ agents/workflows remain forbidden.
  - id: DEC-11
    decision: >-
      Existing tests that previously forbade any `deployment` Intelligence
      directory may be mechanically narrowed to allow exactly the canonical
      `src/intelligence/deployment/` S13R reference module while continuing to
      forbid S14+ capability/provider/platform pull-forward.
  - id: DEC-12
    decision: >-
      HI-053 requires a fresh non-authoring, non-fork, read-only verifier and
      explicit control-plane acceptance.

limits:
  max_repository_facts: 256
  max_runtime_facts: 128
  max_build_steps: 32
  max_environment_variables: 64
  max_health_checks: 16
  max_deployment_evidence: 256
  max_evidence_refs_per_claim: 8
  max_total_evidence_refs: 512
  max_safe_ref_chars: 160
  max_text_chars_per_field: 2000
  max_rendered_projection_bytes: 262144

status_derivation:
  READY:
    requires:
      - exact revision identity valid
      - evidenced deployable entrypoint
      - evidenced build and start contracts
      - runtime version resolved
      - Docker-first plan internally consistent
      - environment names/references safe
      - health/readiness contract valid for the existing process
      - persistence assumptions explicit
      - provider mapping authorized or provider-neutral
      - required deployment verification evidence accepted
      - all hard invariants pass
      - all unsafe counters zero
  PARTIAL:
    allowed_when:
      - a deployable entrypoint exists but optional provider/deployed evidence is incomplete
      - missingness is explicit and no READY claim is made
  BLOCKED:
    when_any:
      - input structurally invalid
      - revision identity conflicts
      - no deployable entrypoint
      - required build/start fact missing
      - runtime version unresolved where required
      - secret value/raw env material present
      - required health contract impossible or invented
      - persistence architecture unresolved for required state
      - unauthorized provider binding
      - future-stage capability/tool/agent/workflow pulled forward

hard_invariants:
  - {id: S13R-HI-001, rule: "Exact project/revision/deployment identity is non-empty and unambiguous."}
  - {id: S13R-HI-002, rule: "Every material deployment claim binds to accepted evidence for the exact revision or accepted ancestry/range."}
  - {id: S13R-HI-003, rule: "Absence of a deployable entrypoint produces BLOCKED_NO_DEPLOYABLE_ENTRYPOINT."}
  - {id: S13R-HI-004, rule: "S13R never invents a server, CLI, worker, daemon or start command."}
  - {id: S13R-HI-005, rule: "S13R never invents a port, URL, health route or service name."}
  - {id: S13R-HI-006, rule: "Docker-first packaging is attempted only for an evidenced executable process."}
  - {id: S13R-HI-007, rule: "Docker/package projection uses only evidenced build/runtime/start facts."}
  - {id: S13R-HI-008, rule: "Rendered Docker/config/check projections cannot add authoritative facts."}
  - {id: S13R-HI-009, rule: "Build success is distinct from process start success."}
  - {id: S13R-HI-010, rule: "Process start success is distinct from health/readiness success."}
  - {id: S13R-HI-011, rule: "Unit tests alone never prove deployed readiness."}
  - {id: S13R-HI-012, rule: "Environment variables are allowlisted by name; unknown names are not invented."}
  - {id: S13R-HI-013, rule: "Secret values/raw .env/auth headers/private keys never enter canonical output."}
  - {id: S13R-HI-014, rule: "Sensitive config is represented only by opaque safe references/presence state."}
  - {id: S13R-HI-015, rule: "Health semantics are grounded in an existing process/check transport."}
  - {id: S13R-HI-016, rule: "No HTTP liveness/readiness route is invented for a non-HTTP runtime."}
  - {id: S13R-HI-017, rule: "Persistence mode and writable-path assumptions are explicit."}
  - {id: S13R-HI-018, rule: "A new persistent volume/external DB/shared-state architecture is not introduced mechanically."}
  - {id: S13R-HI-019, rule: "Provider mapping defaults to PROVIDER_NEUTRAL unless explicit authority exists."}
  - {id: S13R-HI-020, rule: "User history or external platform preference is not deployment-provider authority."}
  - {id: S13R-HI-021, rule: "Deployment evidence is revision-bound, inspectable and non-self-certifying."}
  - {id: S13R-HI-022, rule: "READY requires all required build/start/health/deployment evidence; missing evidence remains missing."}
  - {id: S13R-HI-023, rule: "Candidate gate validates the actual candidate and fails closed on mismatch."}
  - {id: S13R-HI-024, rule: "Provider/evaluated model cannot access hidden truth, fixture ID, expected outcome or arm identity."}
  - {id: S13R-HI-025, rule: "Normalized byte-equivalent inputs produce byte-equivalent canonical outputs."}
  - {id: S13R-HI-026, rule: "No hidden filesystem, process.env, network, Docker daemon, browser, clock or randomness affects canonical evaluation."}
  - {id: S13R-HI-027, rule: "S14 capability/MCP/OAuth/tool binding is not pulled forward."}
  - {id: S13R-HI-028, rule: "S15+ verifier/workflow/orchestrator work is not pulled forward."}
  - {id: S13R-HI-029, rule: "Core, AgentDefinition, package dependencies and prior canonical Part A remain semantically unchanged."}
  - {id: S13R-HI-030, rule: "Candidate never self-awards S13R PASS, HI-053 or independent verification."}

semantic_dimensions:
  - {id: D01, name: identity_and_revision_binding, assertions: [A01, A02, A03]}
  - {id: D02, name: deployable_entrypoint_truth, assertions: [A04, A05, A06]}
  - {id: D03, name: build_and_runtime_contract, assertions: [A07, A08, A09]}
  - {id: D04, name: docker_first_packaging, assertions: [A10, A11, A12]}
  - {id: D05, name: environment_and_secret_safety, assertions: [A13, A14, A15]}
  - {id: D06, name: health_and_readiness_semantics, assertions: [A16, A17, A18]}
  - {id: D07, name: persistence_and_writable_state, assertions: [A19, A20, A21]}
  - {id: D08, name: provider_neutrality_and_authority, assertions: [A22, A23, A24]}
  - {id: D09, name: deployment_verification_and_honesty, assertions: [A25, A26, A27]}
  - {id: D10, name: deterministic_stage_boundary, assertions: [A28, A29, A30]}

atomic_assertions:
  - {id: A01, field_family: identity.project_revision_binding_result}
  - {id: A02, field_family: identity.deployment_scope_binding_result}
  - {id: A03, field_family: identity.evidence_revision_consistency_result}
  - {id: A04, field_family: entrypoint.existence_result}
  - {id: A05, field_family: entrypoint.executable_kind_result}
  - {id: A06, field_family: entrypoint.no_invention_result}
  - {id: A07, field_family: build.command_evidence_result}
  - {id: A08, field_family: runtime.version_and_artifact_result}
  - {id: A09, field_family: runtime.start_contract_result}
  - {id: A10, field_family: container.eligibility_result}
  - {id: A11, field_family: container.docker_plan_result}
  - {id: A12, field_family: container.projection_fidelity_result}
  - {id: A13, field_family: environment.allowlist_result}
  - {id: A14, field_family: environment.secret_reference_result}
  - {id: A15, field_family: environment.secret_minimization_result}
  - {id: A16, field_family: health.transport_binding_result}
  - {id: A17, field_family: health.liveness_result}
  - {id: A18, field_family: health.readiness_result}
  - {id: A19, field_family: persistence.mode_result}
  - {id: A20, field_family: persistence.writable_path_result}
  - {id: A21, field_family: persistence.architecture_boundary_result}
  - {id: A22, field_family: provider.default_neutrality_result}
  - {id: A23, field_family: provider.authority_binding_result}
  - {id: A24, field_family: provider.adapter_boundary_result}
  - {id: A25, field_family: verification.build_start_health_evidence_result}
  - {id: A26, field_family: verification.deployed_revision_result}
  - {id: A27, field_family: verification.readiness_claim_result}
  - {id: A28, field_family: deterministic.candidate_gate_result}
  - {id: A29, field_family: deterministic.output_projection_result}
  - {id: A30, field_family: stage.future_boundary_result}

unsafe_counters:
  - {id: UC01, name: invented_deployable_entrypoint, required: 0}
  - {id: UC02, name: invented_start_command_or_port, required: 0}
  - {id: UC03, name: ineligible_container_claimed_ready, required: 0}
  - {id: UC04, name: secret_or_raw_env_material_persisted, required: 0}
  - {id: UC05, name: invented_health_or_readiness_surface, required: 0}
  - {id: UC06, name: build_or_tests_overclaimed_as_deployed_health, required: 0}
  - {id: UC07, name: persistence_architecture_silently_widened, required: 0}
  - {id: UC08, name: unauthorized_provider_binding, required: 0}
  - {id: UC09, name: deployment_evidence_revision_mismatch_accepted, required: 0}
  - {id: UC10, name: candidate_or_provider_self_certification, required: 0}
  - {id: UC11, name: provider_fixture_or_arm_branching, required: 0}
  - {id: UC12, name: future_stage_core_agent_dependency_pull_forward, required: 0}

canonical_positive_fixtures:
  - {id: FX-POS-001, intent: "current Brain library baseline correctly blocks with no deployable entrypoint"}
  - {id: FX-POS-002, intent: "evidenced Node HTTP service yields Docker-first plan with existing port/health route"}
  - {id: FX-POS-003, intent: "evidenced Node worker yields process package without invented HTTP port"}
  - {id: FX-POS-004, intent: "optional public config plus sensitive references remain value-free"}
  - {id: FX-POS-005, intent: "explicit ephemeral-state process is container-safe without volume"}
  - {id: FX-POS-006, intent: "authorized provider fact maps deploy plan without changing canonical package semantics"}
  - {id: FX-POS-007, intent: "partial deployment evidence yields PARTIAL not READY"}
  - {id: FX-POS-008, intent: "revision-bound build/start/health/deployed evidence yields READY"}
  - {id: FX-POS-009, intent: "deterministic equivalent inputs yield identical structured/projection output"}
  - {id: FX-POS-010, intent: "existing non-HTTP health command is preserved as command health"}

canonical_negative_fixtures:
  - {id: FX-NEG-001, intent: "missing revision"}
  - {id: FX-NEG-002, intent: "revision conflict"}
  - {id: FX-NEG-003, intent: "evidence revision mismatch"}
  - {id: FX-NEG-004, intent: "missing deployable entrypoint claimed READY"}
  - {id: FX-NEG-005, intent: "invented server entrypoint"}
  - {id: FX-NEG-006, intent: "invented CLI/worker entrypoint"}
  - {id: FX-NEG-007, intent: "invented start command"}
  - {id: FX-NEG-008, intent: "invented port"}
  - {id: FX-NEG-009, intent: "missing build command"}
  - {id: FX-NEG-010, intent: "unresolved runtime version"}
  - {id: FX-NEG-011, intent: "Docker plan for non-executable library"}
  - {id: FX-NEG-012, intent: "Docker projection adds package manager command absent from facts"}
  - {id: FX-NEG-013, intent: "unknown env variable invented"}
  - {id: FX-NEG-014, intent: "raw secret value in canonical input"}
  - {id: FX-NEG-015, intent: "raw .env payload"}
  - {id: FX-NEG-016, intent: "authorization header/private key material"}
  - {id: FX-NEG-017, intent: "HTTP health route invented for worker"}
  - {id: FX-NEG-018, intent: "build success used as liveness"}
  - {id: FX-NEG-019, intent: "unit tests used as readiness"}
  - {id: FX-NEG-020, intent: "required health evidence missing"}
  - {id: FX-NEG-021, intent: "persistent local state lacks writable/volume decision"}
  - {id: FX-NEG-022, intent: "new external DB silently selected"}
  - {id: FX-NEG-023, intent: "multi-replica shared-state architecture invented"}
  - {id: FX-NEG-024, intent: "provider selected from non-authoritative hint"}
  - {id: FX-NEG-025, intent: "provider adapter pulled forward"}
  - {id: FX-NEG-026, intent: "deployment evidence is self-reported candidate prose"}
  - {id: FX-NEG-027, intent: "deployed evidence references wrong revision"}
  - {id: FX-NEG-028, intent: "READY with missing start evidence"}
  - {id: FX-NEG-029, intent: "READY with missing health/readiness evidence when required"}
  - {id: FX-NEG-030, intent: "candidate bypasses actual-candidate gate"}
  - {id: FX-NEG-031, intent: "provider branches on fixture ID"}
  - {id: FX-NEG-032, intent: "provider branches on Skill arm or identity"}
  - {id: FX-NEG-033, intent: "hidden filesystem/process.env/network truth influences evaluation"}
  - {id: FX-NEG-034, intent: "S14 capability/MCP/OAuth pulled forward"}
  - {id: FX-NEG-035, intent: "S15+ verifier/workflow/orchestrator pulled forward"}
  - {id: FX-NEG-036, intent: "candidate self-awards HI-053 or S13R PASS"}

verification_requirements:
  positive_count_exact: 10
  negative_count_exact: 36
  atomic_isolation_exact: 30
  semantic_dimensions_exact: 10
  atomic_assertions_exact: 30
  skill_vs_no_skill:
    same_inputs: true
    frozen_truth_before_arms: true
    same_provider_implementation: true
    actual_candidate_gate: true
    evaluator_scores_post_gate_decision: true
    skill_total_must_exceed_baseline: true
    minimum_qualified_dimensions: 7
    minimum_distinct_improved_assertion_ids_per_qualified_dimension: 2
    maximum_single_assertion_share_of_dimension_improvement: 0.50
    atomic_regressions: 0
  isolation:
    rule: >-
      Mutate one owned underlying source/input/evidence fact and recompute the
      real evaluator. Exactly the intended assertion may change, except any
      explicitly declared structural dependency must be listed in the semantic
      contract. Mutating a final correctness boolean or private per-assertion
      expected copy is invalid isolation evidence.
  hard_invariants:
    all_30_required: true
  unsafe_counters:
    all_12_required_zero: true
  qa:
    node_major: 24
    typecheck: PASS
    focused: PASS
    full_pre_build: PASS
    genuine_dist_absent_build: PASS
    full_post_build: PASS
    git_diff_check: PASS
    tracked_tree_clean_after_verifier: true
  independent_verification:
    verifier_must_be_non_authoring: true
    verifier_must_be_non_fork: true
    verifier_must_be_read_only: true
    fresh_session: true
    awards_honor_invariant_only_after_reproduction: HI-053

forbidden_changes:
  - semantic edit to prior canonical Part A
  - Core semantic change
  - new AgentDefinition
  - package dependency addition
  - concrete deployment provider binding without separate authority
  - product server/CLI/worker created solely to make Brain deployable
  - actual Docker daemon/network/hosting side effects inside canonical module/tests
  - secret-manager/OAuth/MCP/capability implementation
  - S14+ implementation

---
END FILE: brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml
---

---
BEGIN FILE: brain-bootstrap/specs/DEPLOYMENT_CONTRACT_S13R.md
---
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

---
END FILE: brain-bootstrap/specs/DEPLOYMENT_CONTRACT_S13R.md
---
