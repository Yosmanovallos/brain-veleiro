# Delivery Documentation & Demo Contract — S13Q

## 1. Status and authority

```yaml
step: S13Q
name: delivery-documentation-demo
version: 1.0.0
depth: DEEP
classification: SKILL_ONLY
status: AUTHORING_READY
honor_invariant_candidate: HI-052
```

This contract is the semantic authority for S13Q.

S13Q transforms verified repository/build evidence into a truthful, reproducible and handoff-ready delivery package. It does not implement deployment, new application behavior, a browser runner, a screenshot/video system, Capability Registry/MCP bindings, a verifier Agent, workflow runtime or later orchestration.

Normative words `MUST`, `MUST NOT`, `SHOULD`, `MAY`, `READY`, `PARTIAL`, `BLOCKED`, `UNKNOWN`, `IMPLEMENTED`, `VERIFIED`, `DEFERRED` and `PROPOSED` have strict contract meaning.

## 2. Repository-grounded identity

The bootstrap source defines S13Q as:

```text
S13Q — delivery-documentation-demo
README, architecture summary, setup, demo, limitations, next steps.
```

S13Q follows the verified S13P observability step and precedes:

```text
S13R — deployment
```

Upstream contracts also reserve human-facing API docs and delivery/demo concerns for S13Q while S13R retains deployment ownership.

## 3. Canonical resolution

### 3.1 Classification

```text
S13Q = SKILL_ONLY
```

Reason: S13Q is bounded semantic compilation over caller-supplied repository/evidence facts. It does not need an adaptive observe-act-observe loop and therefore does not justify a new AgentDefinition or Core branch.

S13Q must run through the existing generic path:

```text
S12 Skill discovery / lazy selected-Skill load
→ caller-supplied compatible AgentDefinition
→ S10 compileAgentDefinition()
→ S09 runAgent()
→ actual parsed candidate
→ deterministic candidate gate
→ deterministic delivery evaluator
```

### 3.2 Quality depth

```text
S13Q = DEEP
```

Delivery documentation can leak secrets, overclaim production readiness, hide limitations, fabricate setup/demo procedures or distort what a verified build actually contains. These are high-impact final-boundary failures, so a DEEP quality contract is required.

### 3.3 Demo definition

Canonical meaning:

```text
demo = reproducible evidence-bound walkthrough over an already-existing runnable or inspectable surface
```

A demo is NOT:

```text
new server
new UI
new API route
new browser automation
new seed system
new screenshot/video recorder
new public URL
new deployment
```

A demo procedure may instruct a human or later execution capability how to exercise an existing surface, but the S13Q Skill itself performs no external side effect.

## 4. Problem statement

A technically correct build can still fail delivery because its documentation:

- describes roadmap intent as implemented behavior;
- gives setup commands that do not exist;
- omits prerequisites or expected signals;
- fabricates ports, URLs, file paths or environment variables;
- demos behavior not covered by current acceptance/evidence;
- hides known limitations or skipped/failed verification;
- presents proposed deployment or later-stage work as complete;
- leaks secrets or raw logs;
- loses provenance between claims and verification evidence.

S13Q prevents those failure modes by making delivery documentation a deterministic, evidence-grounded engineering artifact rather than free-form marketing prose.

## 5. Architectural decision

S13Q is a pure Intelligence reference module.

Part B may add responsibilities equivalent to:

```text
src/intelligence/delivery-documentation-demo/
  constants.ts
  types.ts
  validateDeliveryInput.ts
  buildEvidenceIndex.ts
  resolveDeliveryFacts.ts
  buildArchitectureSummary.ts
  buildSetupRunPlan.ts
  buildDemoScript.ts
  buildLimitationsRegister.ts
  buildNextStepsRegister.ts
  buildDeliveryPackage.ts
  validateDeliveryCandidate.ts
  quality.ts
  deliveryDocumentationDemoSkill.ts
  planDeliveryDocumentationDemo.ts
  index.ts
```

Exact filenames may follow repository conventions as long as ownership remains unchanged.

Allowed additions:

```text
focused deterministic tests/fixtures
one append-only S12 reference Skill catalog entry
factual verification report/handoff
mechanical adjacent boundary-test updates required solely by the new canonical module/catalog entry
```

Forbidden:

```text
Core semantic changes
new AgentDefinition
new runtime dependency
provider/vendor binding
filesystem/network/browser/shell execution inside canonical module
README mutation as runtime side effect
Docker/container/deployment/hosting
secret provisioning
Capability Registry/MCP/connector/OAuth
verifier Agent
workflow/orchestrator/resource-manager implementation
semantic changes to earlier canonical Part A
S13R or later-step implementation
```

## 6. Canonical input model

```ts
interface DeliveryDocumentationDemoInput {
  delivery_identity: DeliveryIdentity;
  repository_facts: readonly RepositoryFact[];
  verification_evidence: readonly VerificationEvidence[];
  demo_surface: DemoSurface;
  policy: DeliveryPolicy;
  architecture_facts?: readonly ArchitectureFact[];
  limitations?: readonly LimitationFact[];
  next_step_candidates?: readonly NextStepFact[];
  evidence_refs?: readonly SafeRef[];
}
```

### 6.1 DeliveryIdentity

Required fields:

```text
project_ref
revision_ref
delivery_scope_ref
audience
```

Optional:

```text
baseline_revision_ref
accepted_ancestry_or_range_ref
release_or_handoff_ref
```

`revision_ref` identifies exactly the delivered revision. A different revision may support a claim only when an accepted ancestry/range relation explicitly connects it to the delivered revision.

### 6.2 RepositoryFact

A repository fact is an explicit safe projection, not arbitrary repository content.

Canonical fields:

```text
fact_id
kind
subject_ref
value
source_ref
revision_ref
confidence = VERIFIED | ACCEPTED | REPORTED
```

Allowed fact kinds include:

```text
PROJECT_NAME
PACKAGE_SCRIPT
COMMAND
FILE_OR_DIRECTORY
MODULE
PUBLIC_ENTRYPOINT
RUNTIME_REQUIREMENT
SAFE_ENV_VARIABLE_NAME
PORT
URL
ARCHITECTURE_COMPONENT
ARCHITECTURE_BOUNDARY
KNOWN_FEATURE
KNOWN_NON_FEATURE
DEMO_SURFACE
```

A fact does not prove test success unless its source kind is accepted verification evidence.

### 6.3 VerificationEvidence

Canonical fields:

```text
evidence_id
kind
subject_ref
revision_ref
status
summary_ref
source_ref
```

Allowed `kind` includes:

```text
TYPECHECK
BUILD
TEST
EVAL
INDEPENDENT_VERIFICATION
SECURITY_CHECK
BOUNDARY_AUDIT
GIT_AUDIT
DEMO_PROOF
OTHER_DETERMINISTIC
```

Allowed status:

```text
PASS
FAIL
SKIPPED
BLOCKED
NOT_EVALUATED
```

`FAIL`, `SKIPPED`, `BLOCKED` and `NOT_EVALUATED` MUST remain visible when material to a delivery claim.

### 6.4 DemoSurface

Canonical fields:

```text
surface_ref
kind
exists
revision_ref
entry_action_ref
precondition_refs
```

Allowed `kind`:

```text
CLI
LIBRARY_API
LOCAL_UI
LOCAL_HTTP_API
GENERATED_ARTIFACT
TEST_OR_EVAL_HARNESS
DOCUMENTED_INSPECTION
OTHER_EXISTING_SURFACE
```

The `kind` names a surface already present; it does not authorize creating one.

### 6.5 ArchitectureFact

Architecture facts describe existing modules, boundaries, providers or flows. They cannot contain a proposed architecture decision disguised as a fact.

### 6.6 LimitationFact

Canonical fields:

```text
limitation_id
summary
severity = LOW | MEDIUM | HIGH
impact
status = KNOWN | UNVERIFIED | DEFERRED
source_refs
```

### 6.7 NextStepFact

Canonical fields:

```text
next_step_id
summary
priority = P0 | P1 | P2 | P3
status = PROPOSED | DEFERRED | REQUIRED_BEFORE_PRODUCTION
dependency_or_owner_ref
source_refs
```

## 7. Canonical output model

```ts
interface DeliveryDocumentationDemoResult {
  status: "READY" | "PARTIAL" | "BLOCKED";
  blockers: readonly DeliveryBlocker[];
  package: DeliveryPackage | null;
  coverage: DeliveryCoverage;
  warnings: readonly DeliveryWarning[];
}
```

`DeliveryPackage` contains:

```text
identity
executive_summary
architecture_summary
setup_and_run
demo_script
limitations
next_steps
evidence_index
provenance
optional_markdown_projection
```

The structured package is authoritative. Rendered Markdown is derivative and must be semantically lossless with respect to claims/status/evidence.

## 8. Claim status vocabulary

Every material claim is classified as exactly one of:

```text
IMPLEMENTED
VERIFIED
AVAILABLE_NOT_VERIFIED
NOT_IMPLEMENTED
DEFERRED
UNKNOWN
```

Rules:

- `IMPLEMENTED` requires committed repository fact evidence at the delivered revision.
- `VERIFIED` requires accepted executable verification evidence bound to the delivered revision or accepted ancestry/range.
- `AVAILABLE_NOT_VERIFIED` requires existence evidence but no accepted verification proof.
- `NOT_IMPLEMENTED` is explicit absence/non-feature evidence.
- `DEFERRED` is roadmap/next-step status, never current implementation.
- `UNKNOWN` is used when evidence is insufficient.

A claim may not upgrade itself from `IMPLEMENTED` to `VERIFIED` because a test exists in source; the test must have accepted execution evidence.

## 9. Evidence precedence

When facts conflict:

```text
1. accepted executable verification evidence
2. committed repository fact
3. approved canonical contract/ADR
4. accepted continuity/handoff fact
5. caller assertion
6. UNKNOWN
```

A lower-precedence source MUST NOT overwrite a higher-precedence source silently.

Material conflict:

```text
→ warning or blocker
→ preserve both provenance refs
→ never choose the more flattering claim solely for presentation
```

## 10. Executive summary

The executive summary MUST answer only supported questions:

```text
what was delivered
what revision it describes
what user/problem scope is covered
what was verified
what remains limited/deferred
```

It MUST NOT claim:

```text
production ready
secure/compliant
scalable
highly available
fully tested
zero bugs
fully automated
deployed
```

unless separate accepted evidence supports the exact claim.

## 11. Architecture summary

The architecture summary is a projection of existing architecture facts.

Required structure:

```text
components
responsibilities
major data/control flow
important boundaries
external dependencies actually present
explicitly absent/deferred components when material
```

Forbidden behavior:

```text
select a new framework/provider/database
invent a queue/cache/service
change Core/Intelligence/Providers ownership
create a new AgentDefinition
turn delivery prose into an ADR
```

If architecture evidence is incomplete, the section is `PARTIAL`; it is not completed by inference.

## 12. Setup and run procedure

Every required step:

```ts
interface SetupRunStep {
  step_id: string;
  purpose: string;
  command_or_action: string;
  precondition_refs: readonly SafeRef[];
  expected_signal: string;
  evidence_refs: readonly SafeRef[];
  optional: boolean;
}
```

Rules:

1. Commands/actions must be derived from accepted repository facts.
2. Shell syntax may be normalized only without changing semantics.
3. Environment-variable names may be documented only when approved repository facts establish them.
4. Secret values are never included.
5. Ports/URLs/paths/services cannot be invented.
6. Required steps missing an expected signal prevent `READY`.
7. An optional step may remain unknown/omitted without blocking if no required path depends on it.

## 13. Demo script

Each demo step:

```ts
interface DemoStep {
  step_id: string;
  title: string;
  precondition_refs: readonly SafeRef[];
  action: string;
  expected_observable_result: string;
  evidence_refs: readonly SafeRef[];
  fallback_or_stop_condition: string;
}
```

Rules:

1. The demo operates on the declared existing `DemoSurface`.
2. `exists` must be true and revision-compatible.
3. Every expected observable result must be supported by accepted evidence or explicit current repository behavior.
4. Environment-sensitive steps must have a fallback/stop condition.
5. Known failed/skipped/blocked behavior cannot be presented as a successful demo path.
6. A failure/edge/limitation demonstration SHOULD be included when materially useful.
7. No demo step creates deployment or new runtime infrastructure.

## 14. Limitations register

Material limitations MUST be included.

Materiality includes any limitation affecting:

```text
core acceptance behavior
setup/run reproducibility
demo reliability
security/privacy claim
known failing/skipped verification
unsupported platform/environment
production readiness
external dependency availability
```

The package is `BLOCKED` if it knowingly contradicts or hides a material limitation.

## 15. Next steps

Next steps are not implementation facts.

They MUST:

```text
carry priority
carry PROPOSED/DEFERRED/REQUIRED_BEFORE_PRODUCTION
name dependency/owner when known
retain evidence/provenance
```

S13R may appear only as future deployment work. S14/S15+ may appear only as labeled future work when supported by roadmap/decision facts.

## 16. Security and privacy

Output MUST reject or sanitize any attempt to include:

```text
secret values
credentials
private keys
cookies
authorization headers
raw .env contents
personal/private data not approved for delivery
raw prompts/messages/context
raw tool arguments/results
raw HTTP bodies/headers
raw provider errors/stacks
private tokens embedded in URLs
```

Safe references and approved variable names are allowed only without secret values.

A hash/digest is not permission to retain forbidden source material.

## 17. Determinism

Canonical S13Q output MUST NOT depend on:

```text
Date.now()
new Date() without caller-supplied timestamp
Math.random()
process.env
filesystem reads
shell/git reads
network/browser reads
mutable global state
provider-specific external state
```

All facts are caller-supplied inputs. Equivalent normalized input yields equivalent output ordering and semantics.

## 18. Boundedness

Ceilings:

```text
repository facts             256
verification evidence        256
architecture facts           128
setup/run steps               32
demo steps                    32
limitations                   64
next steps                    64
evidence refs per claim        8
total evidence refs           512
safe ref chars                160
text chars per field         2000
rendered Markdown bytes    262144
```

A policy may lower but never raise these ceilings.

Required content exceeding a hard bound causes `BLOCKED`; optional low-priority content may be deterministically omitted with an explicit count-only warning and `PARTIAL` when usefulness is affected.

## 19. Status decision table

### READY

Requires all:

```text
exact delivery identity valid
required package sections present
required setup/run path evidence-backed
real demo surface present
required demo steps evidence-backed
known material limitations represented
next steps correctly status-labeled
evidence refs resolve
no secret/sensitive output
no unsupported production/deployment claim
no future-stage pull-forward
canonical deterministic candidate passes gate
```

### PARTIAL

Allowed only when:

```text
required identity/setup/demo/safety remain truthful
missing items are optional/non-critical
missingness is explicit
no unsupported substitute claim is emitted
```

### BLOCKED

Any of:

```text
revision conflict
required setup/run evidence absent
nonexistent demo surface
required demo expected result unsupported
secret/raw sensitive content
hidden/contradicted material limitation
production/deployment overclaim
future-stage implementation pull-forward
candidate cannot be deterministically validated
```

## 20. Actual candidate gate

Canonical evaluation order:

```text
bounded input
→ S12/S10/S09 actual candidate
→ parse candidate
→ structural validation
→ deterministic recomputation of delivery package from source facts
→ candidate equality/semantic gate
→ deterministic atomic observations
→ quality decision
```

The gate MUST evaluate the actual parsed candidate.

Forbidden:

```text
synthesizing a separate faithful replacement
scoring raw pre-gate candidate after rejection
trusting candidate status/blockers/coverage
using candidate-provided self-certification
```

If candidate claims diverge from the canonical recomputed package, the candidate is rejected for quality scoring.

## 21. Atomic quality model

The Quality Contract defines 10 dimensions and 30 exact atomic assertions (`A01..A30`).

Every atomic must be derived from its underlying source/input/evidence fact.

Isolation proof MUST mutate the owned source fact and recompute the real evaluator.

Forbidden fake isolation:

```text
flip already-derived boolean
replace evaluator result directly
mute an assertion without changing source fact
```

## 22. Skill-vs-no-Skill impact gate

Required:

```text
12 frozen A/B scenarios
30 atomic assertions per scenario per arm
same visible bounded packet semantics
same provider implementation
same S10/S09 path
same parser/gate/evaluator
frozen truth invisible to provider
baseline arm loads no S13Q Skill
Skill arm loads real S13Q Skill content
```

Qualification:

```text
candidate total correct > baseline
>= 7/10 qualified dimensions
>= 2 distinct improved assertion IDs in every qualified dimension
max single-assertion share <= 0.50 per qualified dimension
0 atomic regressions
all Skill-arm unsafe counters = 0
```

A dimension qualifies only from its own exact atomic improvements.

No `1/delta`, constant share, duplicate-fixture inflation or cross-cutting assertion may substitute for grouped per-assertion contribution evidence.

## 23. Anti-gaming

Provider/model fixture MUST NOT receive or branch on:

```text
fixture id
scenario id
arm id
with-Skill flag
Skill id/name as answer key
expected answer
frozen truth
grader truth
evaluator result
precomputed correctness map
```

The provider MUST NOT import the deterministic evaluator, candidate gate or canonical package builder.

Positive controls:

```text
real relevant Skill method content changes candidate reasoning
irrelevant prose produces no correctness improvement
visible packet changes still alter outputs within the Skill arm
```

## 24. Unsafe counters

Canonical unsafe counters are `UC01..UC12` from the Quality Contract.

Two independent conditions are required:

```text
all counters = 0 on every positive fixture and every Skill-arm A/B candidate where applicable
AND
each counter is independently demonstrated fireable by a real governing violation
```

A permanently-zero counter is invalid evidence.

## 25. Hard invariants

Canonical Part B must independently recompute:

```text
S13Q-HI-001 .. S13Q-HI-030
```

All must be true before builder PASS.

These are step-local hard invariants and are distinct from bootstrap honor invariant `HI-052`.

## 26. Honor invariant HI-052

`HI-052` is reserved for independent closure.

Builder:

```text
MUST NOT award HI-052
```

Fresh verifier:

```text
may recommend/record independent PASS evidence
MUST be non-authoring, non-fork, read-only and fresh
```

Final award requires factual ChatGPT control-plane acceptance according to the repository protocol.

## 27. Part B allowed scope

Part B may create a pure deterministic module under:

```text
src/intelligence/delivery-documentation-demo/
```

and:

```text
focused tests/fixtures
one append-only S12 reference Skill catalog entry
factual report/handoff
strictly mechanical adjacent boundary-test updates required by that new module/catalog entry
```

No side effects are required by the module.

## 28. Part B forbidden scope

Do NOT implement:

```text
README writer that mutates repository files
filesystem crawler
shell/git executor
browser automation
screenshot/video capture
server/API/UI feature
Dockerfile/containerization
deployment adapter
hosting/provider integration
health endpoint
secret manager/provisioning
Capability Registry
MCP/connector/OAuth
Verifier Agent
Workflow Runtime
Delegation/Orchestrator
cross-run Resource Manager
new Core branch
new AgentDefinition
new package dependency
S13R or later stage
```

## 29. Canonical positive fixtures

Exactly 10:

```text
P01_MINIMAL_VERIFIED_CLI_DELIVERY
P02_LIBRARY_SETUP_AND_USAGE
P03_EXISTING_UI_DEMO_WITH_FALLBACK
P04_API_CONTRACT_DOC_WITHOUT_LIVE_SERVER_CLAIM
P05_PARTIAL_OPTIONAL_ARCHITECTURE_DETAIL
P06_KNOWN_LIMITATIONS_EXPLICIT
P07_MULTIPLE_EVIDENCE_SOURCES_WITH_PRECEDENCE
P08_NEXT_STEPS_INCLUDE_S13R_AS_PROPOSED_ONLY
P09_SAFE_ENV_VARIABLE_NAMES_WITHOUT_VALUES
P10_DETERMINISTIC_MARKDOWN_PROJECTION
```

Each fixture must run through the real candidate/gate path and assert its exact expected status plus governing evidence behavior.

## 30. Canonical negative fixtures

Exactly 40, `N01..N40`, named in the Quality Contract.

Each negative must materially exercise its named violation and produce a governing blocker/warning/gate/counter signal.

An assertion that merely records that the fixture executed is not evidence.

## 31. Architecture boundaries

Part B must prove zero semantic change to:

```text
src/core/**
AgentDefinition
package.json
package-lock.json
canonical Part A of earlier S13 steps
S09/S10/S12 generic runtime semantics
S13I/S13K/S13L/S13M/S13N/S13O/S13P semantics
```

S13Q may consume safe upstream outputs/evidence as facts; it does not reimplement them.

## 32. S13Q / S13R boundary

S13Q owns:

```text
delivery summary
architecture summary
setup/run procedure derived from existing facts
evidence-bound demo procedure
limitations register
next-step register
evidence index
handoff readiness
```

S13R owns:

```text
Docker/containerization
environment/secrets provisioning
health checks
hosting/provider selection/mapping
deployment execution
deployed verification
provider-specific deployment adapters
```

S13Q may state `S13R` as a future/deferred/required-before-production next step. It cannot execute or certify it.

## 33. S14/S15+ boundary

S13Q introduces none of:

```text
Capability Registry
Tool/MCP/connector binding
OAuth flow
Verifier Agent
Architecture Challenger
Workflow Runtime
Delegation
Orchestrator
cross-run Resource Manager
```

These remain later steps.

## 34. README/document projection

Part B MAY provide a pure function equivalent to:

```text
renderDeliveryPackageMarkdown(package)
```

provided:

```text
no filesystem write
no extra claims
no hidden timestamp
no random ordering
no missing limitation suppression
no secret material
byte-equivalent canonical input -> byte-equivalent rendered output
```

The builder/integrator may later mechanically write approved derivative Markdown during an explicitly authorized delivery operation, but the S13Q reference Skill itself owns only the returned projection.

## 35. Required builder verification

Builder evidence must include:

1. exact Part A byte/blob integrity;
2. standalone YAML parse + cross-reference checks;
3. canonical Node 24 runtime;
4. typecheck;
5. 10/10 exact positives;
6. 40/40 exact negatives;
7. 30/30 underlying-source-fact isolation;
8. 30/30 step-local hard invariant recomputation where applicable;
9. UC01..UC12 zero where required;
10. UC01..UC12 each independently fireable;
11. real S12→S10→S09 actual candidate path;
12. candidate non-substitution proof;
13. 12-scenario Skill-vs-no-Skill A/B;
14. raw per-assertion contribution counts and qualification math;
15. anti-gaming provider/source audit;
16. irrelevant-prose control;
17. deterministic repeated-run equality;
18. adversarial secret/privacy cases;
19. S13R/S14/S15+ boundary audit;
20. package manifest/Core/AgentDefinition protected-surface audit;
21. full suite pre-build;
22. genuine repository-local `dist` absent before clean build;
23. clean build;
24. full suite post-build;
25. `git diff --check` and allowed-path audit;
26. factual report/handoff;
27. S13R remains NOT_STARTED.

Numeric test counts alone are not sufficient evidence.

## 36. Fresh independent verification

Before closure, a DIFFERENT fresh non-authoring, non-fork, read-only verifier must independently reproduce:

```text
candidate SHA/ancestry
Part A identity
10 positives
40 negatives
30/30 source-fact isolation
S13Q-HI-001..030
12 unsafe counters zero + fireability
12-scenario A/B totals and per-assertion contributions
qualification/regression/concentration math
actual-candidate gate
anti-gaming
secret/privacy safety
determinism
architecture/dependency boundaries
typecheck/full-pre-build/clean-build/full-post-build
verifier worktree immutability
```

No builder conversation, forked builder reasoning or builder self-review counts as fresh independent verification.

## 37. PASS criteria

S13Q may close `PASS` only when all are true:

1. Part A integrated byte-identically.
2. Part A remains separately auditable.
3. `DEEP + SKILL_ONLY` preserved.
4. No new AgentDefinition.
5. No Core semantic change.
6. No new dependency/provider/network/persistence capability.
7. Exact delivery revision identity passes.
8. Claim-status honesty passes.
9. Executive summary is evidence-grounded.
10. Architecture summary is descriptive only.
11. Setup/run procedure is evidence-backed and reproducible.
12. No command/env/port/URL/path invention.
13. Demo uses an existing surface.
14. Demo actions/results/fallbacks are evidence-bound.
15. Known limitations are explicit.
16. Unverified/unknown states remain explicit.
17. Next steps are status-labeled.
18. S13R boundary passes.
19. S14/S15+ boundary passes.
20. Evidence index/provenance passes.
21. Secret/privacy safety passes.
22. Determinism passes.
23. All 30 step-local hard invariants pass.
24. 10/10 positive fixtures pass.
25. 40/40 negative fixtures trigger correctly.
26. 30/30 source-fact isolation passes.
27. 12 unsafe counters zero where required and each fireable.
28. Same-path Skill-vs-no-Skill threshold passes.
29. No atomic regression.
30. Anti-gaming passes.
31. Typecheck/full/build/post-build passes.
32. Protected architecture/dependency audit passes.
33. Builder does not award HI-052.
34. Fresh independent verifier returns PASS.
35. ChatGPT control plane accepts the independent result.
36. HI-052 is then awarded factually.
37. S13R remains NOT_STARTED until factual S13Q closure is committed/pushed.

## 38. STATE metadata reconciliation

The S13Q preflight established that `brain-bootstrap/STATE.yaml` contains stale live-ish repository metadata (`repository.head_sha`, `repository.head_sha_note`, and repository commit count) left from an older S13O handoff while top-level continuity correctly reflects later verified stages.

This is a factual continuity-maintenance defect, not an S13P semantic failure.

Before or during byte-identical S13Q Part A integration, the integrator MAY make one strictly factual mechanical continuity correction that:

```text
updates live repository head/count/note fields to actual repository reality
changes no S13Q semantic artifact
changes no prior step result
preserves S13P PASS / HI-051 AWARDED / S13Q NOT_STARTED
is isolated and auditable in diff
```

If repository history shows those fields have become intentionally historical rather than live, do not rewrite them; document that evidence instead. Repository reality wins.

## 39. Canonical Part A artifacts

The complete S13Q Part A consists exactly of:

```text
brain-bootstrap/skills/DELIVERY_DOCUMENTATION_DEMO_SKILL_S13Q.md
brain-bootstrap/quality-contracts/S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml
brain-bootstrap/specs/DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md
```

They must be transferred byte-for-byte from the ChatGPT authoring branch.

No fourth AgentDefinition artifact is required because S13Q is `SKILL_ONLY`.

## 40. Stop boundary

`AUTHORING_READY` authorizes:

```text
fetch/read authoring branch
copy exactly the three canonical Part A artifacts to main
verify byte/blob identity
parse/validate YAML and cross-references
perform only the explicitly permitted factual STATE metadata reconciliation if repository evidence still requires it
create/push a Part-A-only integration commit (plus that isolated factual continuity correction only if needed)
then launch a fresh non-fork S13Q Part B builder under these contracts
```

It does NOT authorize:

```text
semantic edits to Part A
S13R implementation
S14 or later implementation
self-award of HI-052
skipping fresh independent verification
```

If Part B discovers a semantic contradiction requiring different classification, thresholds, architecture ownership, deployment behavior, capabilities, dependencies or a new AgentDefinition, return to ChatGPT Authoring Gate with evidence.
