# S13M_CHATGPT_PART_A_CANONICAL

## Authority

This transfer is the complete ChatGPT-authored canonical Part A package for:

```text
S13M — qa-debugging
Reproduce → evidence → root cause → minimal fix → regression → relevant suite.
```

It was authored from repository truth at main:

```text
88ed86ae1f11c415a8656e90c5fd816c48ed4b51
```

and from the S13M preflight:

```text
brain-bootstrap/reports/S13M-authoring-preflight.md
```

Repository/runtime evidence outranks this transfer if a factual conflict is discovered during integration. Semantic changes to the package below require a new ChatGPT Authoring Gate; Codex may not silently revise them.

## Canonical resolutions

1. **Execution mode:** `SKILL_ONLY`.
   S13M v1 assesses one bounded debugging/evidence packet per invocation. It does not implement the operational observe/edit/run loop. An autonomous debugger would require executable capabilities and adaptive actions that are not yet canonically available without pulling forward S14/S13O.

2. **Quality depth:** `DEEP`.
   False causal closure, over-broad fixes, weak regressions, under-scoped suites, or security/contract weakening can silently create or preserve serious defects.

3. **New AgentDefinition:** `NO`.
   Use the existing generic S12 lazy Skill discovery → S10 compiler → S09 runtime with a caller-supplied compatible generic AgentDefinition for executable tests/evals.

4. **Capabilities/side effects:** none / `NONE`.
   S13M produces decisions and next-action guidance only. It does not run shell commands, tests, browsers, networks, retries, telemetry, deployment, or MCP/tool invocations.

5. **Epistemic model:** symptom ≠ hypothesis ≠ proven root cause.
   Root cause is `PROVEN` only with inspectable discriminating evidence. Correlation, stack proximity, builder confidence, or a green suite alone are insufficient.

6. **Failure classes:** `CODE | TEST | DATA | CONFIGURATION | ENVIRONMENT | DEPENDENCY | CONTRACT | SECURITY_BOUNDARY | UNKNOWN`.

7. **Debugging statuses:** `INVESTIGATING | FIX_CANDIDATE | FIX_VERIFIED | BLOCKED`.
   `FIX_VERIFIED` describes the supplied candidate evidence only; it is never bootstrap PASS or independent verification.

8. **Minimal-fix rule:** smallest causally sufficient change set plus required regression/mechanical support. Unrelated refactor/cleanup/dependency churn is excluded.

9. **Regression rule:** same semantic regression must fail on the pre-fix baseline for the intended signature and pass on the exact candidate revision.

10. **Relevant-suite rule:** direct regression + impacted module + affected contract boundary + broader shared/full coverage when impact demands it. Cheap/narrow suite choice is not evidence.

11. **Flaky/intermittent rule:** preserve attempt counts and bounded limitations. One green run cannot close an intermittent failure.

12. **Security/semantic boundaries:** S13M cannot override S13L or rewrite approved semantic artifacts as a mechanical fix. Required semantic changes return `BLOCKED` with reauthoring handoff.

13. **Stage boundaries:** S13N eval infrastructure, S13O retry/async, S13P observability, S13Q delivery, S13R deployment and S14 executable capability binding remain deferred.

14. **Anti-self-certification:** gate the actual parsed candidate; recompute status and owned findings deterministically; malformed candidates fail closed without throw.

15. **Evaluation:** 8 canonical evaluable scenarios, 36 named negatives, 30 disjoint atomic observations with 30/30 detached mutation isolation, provider-blind frozen truth and Skill-vs-no-Skill OI-A. DEEP threshold requires positive delta, at least 5 qualified dimensions, >=2 contributing assertion IDs per qualified dimension, max single-ID share <= 0.50, no hard regression and all eight unsafe counters zero.

## Exact integration rule

Only the three path-delimited files below are canonical Part A artifacts.

Codex must:

1. fetch this authoring branch without merging it;
2. read this exact transfer file with `git show`;
3. compute and preserve the transfer SHA-256 before slicing;
4. extract each `BEGIN FILE`/`END FILE` body byte-for-byte;
5. write the three bodies to the exact paths shown;
6. verify byte identity between each extracted body and integrated file;
7. parse the Quality Contract YAML;
8. run the repository-required baseline checks using the actual configured runtime; if the shell runtime differs from the repository-required runtime, activate/reconcile it or report the environment mismatch honestly;
9. commit/push a **Part-A-only** integration commit on `main`;
10. only then launch a **fresh non-fork S13M Part B builder**;
11. do not start S13N until S13M receives a different fresh independent VERIFIED PASS accepted by the control plane.

Do not merge this temporary authoring branch into `main`.

---

===== BEGIN FILE: brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md =====
# QA_DEBUGGING_SKILL_S13M

## Identity

```yaml
id: intelligence.qa-debugging.s13m
version: 1.0.0
step: S13M
name: qa-debugging
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral: true
```

## Purpose

Produce one bounded, evidence-grounded QA/debugging decision for a reported failure or candidate fix.

The canonical reasoning sequence is:

```text
reproduce
→ preserve evidence
→ distinguish symptom from hypothesis
→ prove or leave unresolved the root cause
→ assess the smallest causally justified fix
→ require a regression that fails before and passes after
→ select and verify the relevant suite
→ preserve uncertainty and boundaries
```

S13M is a debugging reasoning and closure-assessment Skill. It is not an autonomous debugger, shell runner, retry engine, telemetry system, agent-eval platform, security engine, deployment system, or capability registry.

## Execution-mode decision

S13M v1 is `SKILL_ONLY`.

Reason:

- the canonical S13M artifact consumes a bounded incident/evidence packet and produces one bounded semantic assessment;
- the external builder/controller may iteratively gather reproduction and fix evidence between invocations, but that operational loop is not implemented by this Skill;
- S13E requires an Agent only for an in-runtime observation-dependent act loop with additional agentic signals;
- S13M introduces no executable capabilities, and S14 has not yet provided a general Capability Registry/tool binding for shell/test/debug actions;
- creating an autonomous debugger Agent here would pull forward S14 capability binding and potentially S13O retry mechanics.

A future approved architecture may separately use S13E to justify an Agent that consumes this Skill. S13M does not create that Agent.

## Quality-depth decision

S13M is `DEEP`.

False reproduction, false root cause, over-broad fixes, weak regression evidence, or under-scoped test selection can silently close real defects or introduce new ones. The Skill itself is side-effect-free, but downstream engineering decisions based on it have high consequence and material ambiguity.

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - CURRENT_TASK
    - APPROVED_SPEC
    - QUALITY_CONTRACT
    - INCIDENT_EVIDENCE
    - REPOSITORY_STATE
    - TEST_RESULTS
    - SECURITY_DECISION
    - ACCEPTANCE_EVIDENCE
  quality_contract_refs:
    - S13M_QA_DEBUGGING_DEEP
```

## Permissions

```yaml
permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true
```

## Canonical input

```text
QaDebuggingInput
```

The input contains bounded references, observations, candidate/revision identities, reproduction attempts, hypotheses, causal experiments, candidate-fix metadata, regression evidence, suite descriptors/results, optional security-boundary status, acceptance criteria and evidence requirements.

It must not contain live credentials, secret values, private keys, bearer tokens, cookies, raw PII payloads, or unrelated repository/context dumps.

## Canonical output

```text
QaDebuggingDecision
```

Canonical status:

```text
INVESTIGATING
FIX_CANDIDATE
FIX_VERIFIED
BLOCKED
```

These statuses describe the current evidence-backed debugging state only.

`FIX_VERIFIED` is not bootstrap-step closure and is not independent verification. S13M itself cannot approve its own bootstrap PASS.

## Core rules

### QD-R1 — Reproduce before causal closure
Do not claim a defect is causally understood merely because a symptom was reported. Preserve the exact expected/observed mismatch, failure signature, baseline revision, environment and reproduction evidence.

### QD-R2 — Reproduction must be inspectable
A `REPRODUCED` result needs at least one direct, inspectable attempt that matches the canonical failure signature under a declared setup/environment. A verbal assertion alone is not reproduction evidence.

### QD-R3 — Not reproduced is not fixed
`NOT_REPRODUCED` or insufficient reproduction evidence remains `INVESTIGATING` unless an external blocking condition makes continued responsible analysis impossible.

### QD-R4 — Intermittent failures stay explicit
An intermittent/flaky failure must retain attempt counts, matching-failure observations, environment/seed/scheduling facts when available, and limitations. A single passing run cannot close it.

### QD-R5 — Symptom is not root cause
A symptom is an observed mismatch. It is not automatically the cause of itself.

### QD-R6 — Hypothesis is not proof
A plausible explanation remains `HYPOTHESIS` until discriminating evidence supports it. Confidence prose cannot promote a hypothesis to `PROVEN`.

### QD-R7 — Root cause requires causal evidence
`PROVEN` root cause requires evidence that distinguishes the claimed cause from material alternatives, normally through a controlled/discriminating experiment, authoritative contract mismatch plus observed behavior, or another equally inspectable causal demonstration.

### QD-R8 — Correlation alone is insufficient
Temporal ordering, stack proximity, changed output, or one passing test after an edit are not by themselves proof of causality.

### QD-R9 — Classify the failure without hiding uncertainty
Use one of the bounded classes: `CODE`, `TEST`, `DATA`, `CONFIGURATION`, `ENVIRONMENT`, `DEPENDENCY`, `CONTRACT`, `SECURITY_BOUNDARY`, or `UNKNOWN`. Classification never replaces evidence.

### QD-R10 — Environment identity is evidence
Runtime, dependency, configuration, platform and candidate revision identities materially relevant to the failure must be explicit. A mismatch between required and observed environment must not be silently blamed on code.

### QD-R11 — Preserve contradictory evidence
Evidence that contradicts or qualifies the favored hypothesis remains visible until resolved. Do not select only supporting observations.

### QD-R12 — No fix recommendation before cause is sufficiently proven
A final `FIX_CANDIDATE` requires a `PROVEN` root cause and an explicit causal mapping from the proposed change to that cause. Otherwise remain `INVESTIGATING`.

### QD-R13 — Minimal means causally sufficient, not merely small
The candidate fix must touch only the scope needed to address the proven cause and required regression support. Unrelated refactors, formatting churn, opportunistic cleanup or dependency changes are excluded unless separately justified by evidence.

### QD-R14 — Do not weaken canonical semantics as a “fix”
If resolving the failure requires changing an approved Skill, policy, spec, Quality Contract, agent instruction or other canonical semantic artifact, S13M returns `BLOCKED` with `SEMANTIC_REAUTHOR_REQUIRED`. It does not silently rewrite semantics.

### QD-R15 — Security boundaries cannot be debugged away
An S13L `BLOCKED` or `APPROVAL_REQUIRED` decision cannot be converted to allowed behavior by S13M. A candidate fix that weakens auth, authorization, tenant, secret, injection, capability, approval or destructive-action policy is blocked unless the owning semantic gate explicitly authorizes a change.

### QD-R16 — Regression proves the old failure and new behavior
A closure-quality regression must be linked to the same failure condition and show:
1. the regression check fails against the pre-fix baseline for the intended reason; and
2. the same check passes against the exact post-fix candidate.

### QD-R17 — Passing after the fix without pre-fix failure is incomplete
A newly written test that only passes on the candidate is not sufficient regression evidence unless the pre-fix failure is independently and equivalently reproduced.

### QD-R18 — Candidate identity must be exact
Post-fix test/build/suite evidence must identify the exact candidate artifact/commit/revision it verifies. Evidence from a different candidate cannot close the current one.

### QD-R19 — Relevant suite selection is impact-driven
Select the direct regression plus tests/checks covering the impacted module, contract and boundaries. Do not choose a smaller suite merely because it is cheaper.

### QD-R20 — Shared-surface changes expand the suite
Changes to shared interfaces, Core-adjacent contracts, package/runtime configuration, cross-cutting schemas or widely reused helpers require broader relevant-suite coverage, up to the full suite when warranted by impact.

### QD-R21 — Full suite is not automatically causal evidence
A green full suite supports regression safety but does not prove root cause by itself.

### QD-R22 — Failures in the relevant suite remain blocking
Do not mark `FIX_VERIFIED` while required relevant checks fail, are missing without justified `NOT_APPLICABLE`, or were run against the wrong candidate/environment.

### QD-R23 — Flaky closure requires bounded repeated evidence
For an `INTERMITTENT` reproduction, `FIX_VERIFIED` requires repeated pre-fix evidence of the same signature, a causal explanation, and repeated post-fix execution of the same scenario with attempt counts recorded and no silent claim that recurrence is impossible.

### QD-R24 — Retryable is metadata, not retry execution
S09 model/tool error `retryable` values may be recorded as evidence. S13M does not implement retries, backoff, async jobs or idempotency; those belong to S13O.

### QD-R25 — Observability evidence may be consumed, not invented
Existing logs/events/traces may be referenced as evidence. S13M does not introduce a telemetry/tracing platform; S13P owns observability systems.

### QD-R26 — Agent eval infrastructure remains S13N
S13M may test one bounded failure/fix and its relevant suite. It does not create golden-case/eval-platform infrastructure, general task-success scoring, latency/cost eval systems, or agent benchmark registries.

### QD-R27 — Capability binding remains S14
S13M defines no shell/browser/network/tool capability and no MCP/connector/provider binding.

### QD-R28 — Actual parsed candidate is gated
The result parsed from the real S12 → S10 → S09 path must be deterministically validated/gated. Do not replace a malformed or weak candidate with a separately synthesized faithful answer before validation.

### QD-R29 — Candidate status is never proof
`INVESTIGATING`, `FIX_CANDIDATE`, `FIX_VERIFIED` or `BLOCKED` claimed by the candidate is recomputed from bounded input and evidence.

### QD-R30 — Structural validation is total and fail-closed
Unknown enum values, missing required nested structures, malformed evidence references or invalid candidate shapes return deterministic invalid/`BLOCKED` behavior and must not throw.

### QD-R31 — Evidence references must resolve
Material claims, reproduction, root-cause proof, fix rationale, regression and suite outcomes reference supplied evidence records. Unresolved evidence refs cannot support closure.

### QD-R32 — Evidence payloads are minimized
Canonical artifacts retain safe references, methods, hashes, counts, result summaries and limitations—not live secrets, raw sensitive payloads or unnecessary user data.

### QD-R33 — Input and evidence are immutable
The bounded input, evidence records, reproduction attempts and suite results are not mutated.

### QD-R34 — Preserve accepted upstream contracts
S13M consumes approved Spec/Quality/S13L/runtime facts and may report contradictions, but it does not silently rewrite S09, S10, S12, S13L or earlier semantic contracts.

### QD-R35 — Unresolved material contradiction prevents closure
If contradictory evidence could change reproduction, root cause, fix sufficiency or suite safety and remains unresolved, the result cannot be `FIX_VERIFIED`.

### QD-R36 — No self-certification
Builder claims and model prose are not independent verification. S13M bootstrap closure still requires the different fresh independent verifier mandated by the global bootstrap.

### QD-R37 — One bounded incident/candidate per decision
One S13M decision assesses one incident signature and at most one candidate fix/revision pair. Do not hide multiple unrelated failures inside one result.

### QD-R38 — No future-stage pull-forward
Do not implement S13N, S13O, S13P, S13Q, S13R or S14 in S13M.

### QD-R39 — Provider neutrality
No model, CI, test vendor, issue tracker, observability platform, deployment provider or repository host is embedded in canonical semantics.

### QD-R40 — Source truth outranks narrative
Repository/runtime/direct test evidence outranks comments, model claims and historical chat when they conflict.

## Procedure

```text
QD-P1  Validate the bounded incident/evidence packet.
QD-P2  Normalize expected vs observed behavior and failure signature.
QD-P3  Assess reproduction state and environment identity.
QD-P4  Separate symptom, hypotheses, contradictions and unknowns.
QD-P5  Evaluate discriminating causal evidence and classify root cause.
QD-P6  If cause is proven, assess one candidate fix for causal alignment and minimality.
QD-P7  Assess regression before/after evidence against exact revisions.
QD-P8  Derive relevant-suite requirements from impact and assess exact candidate results.
QD-P9  Apply flaky/environment/security/contract/future-stage boundaries.
QD-P10 Recompute atomic findings and final debugging status.
QD-P11 Return evidence refs, blockers, limitations, residual unknowns and one exact next action.
```

## Status policy

### `INVESTIGATING`

Use when work can responsibly continue but one or more of these remains unresolved:

- failure is not yet reproduced;
- intermittent evidence is insufficient;
- root cause is hypothesis/unknown;
- material contradictory evidence remains;
- candidate fix is missing or not causally justified;
- regression or relevant-suite evidence is incomplete.

### `FIX_CANDIDATE`

Use only when:

- the defect/failure condition is reproduced or otherwise causally established with inspectable evidence;
- root cause is `PROVEN`;
- one candidate fix is causally aligned and minimal;
- no semantic/security boundary is being silently weakened;
- post-fix closure evidence is not yet complete.

This status is a recommendation to evaluate the candidate, not authorization to deploy or merge it.

### `FIX_VERIFIED`

Use only when all are true:

- reproduction evidence is sufficient for the failure mode;
- root cause is `PROVEN`;
- candidate fix is causally aligned and minimal;
- the regression fails on the pre-fix baseline and passes on the exact post-fix candidate;
- every required relevant-suite check passes or has a justified `NOT_APPLICABLE` status;
- intermittent cases satisfy the repeated-evidence rule;
- security/upstream contracts are preserved;
- material contradictions are resolved or explicitly shown non-blocking;
- required evidence refs resolve;
- no unsafe/future-stage boundary is violated.

This does not equal independent bootstrap verification.

### `BLOCKED`

Use when responsible continuation requires unavailable/forbidden authority or evidence, including:

- invalid/malformed bounded input;
- required evidence cannot be inspected;
- security policy blocks the proposed path;
- the proposed fix requires semantic reauthoring not yet approved;
- a necessary protected capability/permission is unavailable;
- the candidate attempts a forbidden future-stage implementation;
- the evidence packet contains prohibited secret/sensitive payloads that cannot be safely processed.

## Failure-class policy

```text
CODE
TEST
DATA
CONFIGURATION
ENVIRONMENT
DEPENDENCY
CONTRACT
SECURITY_BOUNDARY
UNKNOWN
```

Classification describes where the proven cause resides. It does not grant repair authority.

## Root-cause epistemic policy

```text
OBSERVED_SYMPTOM
HYPOTHESIS
PROVEN
DISPROVEN
UNRESOLVED
```

A root-cause claim may be `PROVEN` only when its supporting evidence is inspectable and discriminates the claim from material alternatives. If that is not possible, preserve `HYPOTHESIS` or `UNRESOLVED`.

## Regression policy

Canonical closure evidence binds:

```text
same failure condition
+
pre-fix baseline revision
+
post-fix candidate revision
+
same regression check semantics
+
evidence for expected fail-before/pass-after
```

If the environment itself is the intentional fix, the environment delta must be explicit and causally justified rather than silently treated as equivalent.

## Relevant-suite policy

The selected suite must cover:

```text
direct regression
+
impacted module/component
+
affected contract boundary
+
shared/cross-cutting surfaces when touched
```

Broaden to the full suite when the change can affect global/shared behavior or when the applicable Quality Contract requires it.

## Evaluation requirements

Part B must include:

- at least 8 canonical evaluable scenarios with diverse safe statuses/classes;
- at least 36 named negative/adversarial fixtures;
- a total structural validator/gate;
- the real S12 metadata/lazy-load → S10 compile → S09 run path;
- one deterministic provider that is blind to fixture id, expected truth, arm marker and evaluator helpers;
- frozen provider-blind truth built independently from production synthesizer/gate/evaluator;
- exact actual-candidate anti-substitution regression;
- exactly 30 dimension-specific atomic observation IDs, each owning one disjoint candidate leaf/family;
- exactly 30 detached one-field mutation-isolation probes;
- Skill-vs-no-Skill comparison with same inputs, host AgentDefinition, provider class, capability provider, parser, gate and evaluator; only materialized Skill prose may differ;
- grouped per-assertion contribution evidence by semantic dimension;
- DEEP threshold:
  - positive dimension-specific delta;
  - at least 5 qualified semantic dimensions;
  - each qualified dimension must improve through at least 2 distinct assertion IDs;
  - maximum single assertion-ID share of a dimension's improvement <= 0.50;
  - no hard-invariant regression;
  - all unsafe counters zero.

## Unsafe counters

The Skill-assisted evaluation must end with all of these at zero:

```text
false_reproduction_claim
hypothesis_promoted_without_causal_evidence
uncausal_or_overbroad_fix_recommended
regression_before_after_missing
under_scoped_or_wrong_candidate_suite_pass
flaky_or_environmental_overclaim
security_or_semantic_boundary_override
provider_or_future_stage_binding
```

## Canonical positive scenarios

```text
FX-POS-001 code_bug_reproduced_cause_proven_minimal_fix_regression_and_suite → FIX_VERIFIED
FX-POS-002 test_expectation_conflicts_with_approved_spec_and_test_fix_verified → FIX_VERIFIED
FX-POS-003 configuration_mismatch_causally_proven_and_bounded_fix_verified → FIX_VERIFIED
FX-POS-004 dependency_version_mismatch_proven_and_candidate_verified → FIX_VERIFIED
FX-POS-005 data_fixture_defect_proven_and_minimal_fixture_fix_verified → FIX_VERIFIED
FX-POS-006 reproduced_proven_cause_minimal_fix_but_post_fix_evidence_pending → FIX_CANDIDATE
FX-POS-007 valid_report_not_yet_reproduced_with_next_reproduction_action → INVESTIGATING
FX-POS-008 intermittent_failure_preserved_as_investigating_with_attempt_counts → INVESTIGATING
```

## Canonical negative/adversarial scenarios

At minimum:

```text
FX-NEG-001 reproduction_claim_without_direct_attempt
FX-NEG-002 reproduction_signature_does_not_match_report
FX-NEG-003 reproduction_uses_wrong_baseline_revision
FX-NEG-004 reproduction_environment_identity_missing
FX-NEG-005 single_green_run_declared_flaky_fixed
FX-NEG-006 symptom_relabelled_as_root_cause
FX-NEG-007 hypothesis_marked_proven_without_discriminating_evidence
FX-NEG-008 correlation_only_used_as_causal_proof
FX-NEG-009 passing_full_suite_used_as_root_cause_proof
FX-NEG-010 contradictory_evidence_suppressed
FX-NEG-011 unknown_failure_class_silently_coerced
FX-NEG-012 fix_recommended_before_root_cause_proven
FX-NEG-013 candidate_fix_not_linked_to_causal_factor
FX-NEG-014 unrelated_refactor_bundled_into_fix
FX-NEG-015 formatting_or_cleanup_churn_in_minimal_fix
FX-NEG-016 dependency_change_without_dependency_cause
FX-NEG-017 semantic_contract_change_treated_as_mechanical_fix
FX-NEG-018 s13l_block_overridden_by_debugging
FX-NEG-019 security_policy_weakened_to_make_test_pass
FX-NEG-020 regression_passes_after_but_never_fails_before
FX-NEG-021 regression_fails_before_for_different_reason
FX-NEG-022 regression_result_from_wrong_candidate_revision
FX-NEG-023 relevant_suite_omits_impacted_module
FX-NEG-024 shared_surface_change_with_only_narrow_test
FX-NEG-025 required_suite_failure_ignored
FX-NEG-026 not_run_check_silently_treated_as_pass
FX-NEG-027 intermittent_case_closed_without_repeated_evidence
FX-NEG-028 environment_delta_hidden_between_before_and_after
FX-NEG-029 retryable_flag_treated_as_retry_engine
FX-NEG-030 telemetry_platform_introduced_in_s13m
FX-NEG-031 agent_eval_platform_pulled_forward_from_s13n
FX-NEG-032 capability_or_mcp_binding_pulled_forward_from_s14
FX-NEG-033 actual_candidate_replaced_before_gate
FX-NEG-034 provider_reads_fixture_id_or_frozen_truth
FX-NEG-035 malformed_candidate_throws_instead_of_fail_closed
FX-NEG-036 secret_or_raw_sensitive_payload_copied_into_debug_artifact
```

## Verification

S13M passes only when:

- canonical Part A integrates verbatim and remains byte-auditable;
- execution remains SKILL_ONLY, provider-neutral and capability-free;
- no new AgentDefinition, Core branch, runtime dependency or future-stage system is introduced;
- positive and negative fixtures satisfy expected statuses;
- actual parsed candidate is validated/gated without substitution;
- root-cause proof, minimal-fix, regression and relevant-suite gates behave fail-closed;
- intermittent/environment/security/semantic-boundary cases remain explicit;
- frozen truth/provider/evaluator separation and all 30 atomic isolation probes pass;
- Skill-vs-no-Skill meets the DEEP threshold with all unsafe counters zero;
- typecheck, focused tests, full pre-build, genuine clean/dist-absent build and full post-build pass using the repository-required runtime or explicitly report a blocking environment mismatch;
- a different fresh non-authoring, non-fork read-only verifier independently reproduces the required evidence;
- S13N remains `NOT_STARTED` until that independent PASS is accepted.
===== END FILE: brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md =====

===== BEGIN FILE: brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_DEEP.yaml =====
id: S13M_QA_DEBUGGING_DEEP
version: 1.0.0
step: S13M
name: qa-debugging
depth: DEEP
status: CANONICAL

rationale:
  risk: HIGH
  ambiguity: HIGH
  novelty: MEDIUM
  irreversibility: MEDIUM
  downstream_impact: HIGH
  explanation: >-
    Debugging decisions can falsely close defects, misidentify root causes, justify unrelated changes,
    weaken security or contracts, and miss regressions outside an under-scoped suite. S13M itself is
    side-effect-free, but its conclusions materially influence implementation and release decisions.

evidence:
  required: true
  primary_sources_preferred: true
  cross_validation: true
  claim_traceability_required: true
  direct_reproduction_preferred: true
  contradictory_evidence_preserved: true
  candidate_revision_binding_required: true

implementation:
  tests_required: true
  deterministic_checks_required: true
  tradeoffs_required: true
  regression_before_after_required: true
  relevant_suite_required: true
  input_immutability_required: true

verification:
  independent_review_required: true
  fresh_non_authoring_verifier_required: true
  evidence_backed_pass_required: true
  actual_candidate_gate_required: true
  provider_truth_separation_required: true
  clean_build_required: true

uncertainty:
  explicit: true
  residual_unknowns_required: true
  limitations_required: true
  flaky_claims_bounded: true

hard_invariants:
  - {id: HI-001, rule: one_bounded_incident, pass: "One decision covers one incident signature and at most one candidate fix/revision pair."}
  - {id: HI-002, rule: skill_only, pass: "S13M is SKILL_ONLY and creates no new AgentDefinition."}
  - {id: HI-003, rule: capability_free, pass: "Canonical S13M requires no capabilities and performs no side effects."}
  - {id: HI-004, rule: no_core_special_branch, pass: "Core contains no S13M/qa-debugging special case."}
  - {id: HI-005, rule: reproduction_before_closure, pass: "Closure-quality decisions retain inspectable reproduction evidence appropriate to the failure mode."}
  - {id: HI-006, rule: failure_signature_bound, pass: "Reproduction evidence matches the declared expected/observed failure signature."}
  - {id: HI-007, rule: baseline_revision_bound, pass: "Pre-fix evidence identifies the exact baseline revision/artifact."}
  - {id: HI-008, rule: environment_explicit, pass: "Material runtime/config/dependency environment identity is explicit."}
  - {id: HI-009, rule: not_reproduced_not_fixed, pass: "NOT_REPRODUCED or insufficient evidence cannot be treated as fixed."}
  - {id: HI-010, rule: intermittent_explicit, pass: "Intermittent failures preserve attempt counts, matching outcomes and limitations."}
  - {id: HI-011, rule: symptom_not_cause, pass: "Observed symptom is not automatically promoted to root cause."}
  - {id: HI-012, rule: hypothesis_not_proof, pass: "Hypothesis remains non-proven without discriminating evidence."}
  - {id: HI-013, rule: causal_evidence_required, pass: "PROVEN root cause has inspectable causal/discriminating evidence."}
  - {id: HI-014, rule: correlation_insufficient, pass: "Correlation, stack proximity or one green run alone cannot prove causality."}
  - {id: HI-015, rule: bounded_failure_class, pass: "Failure class is a known canonical enum and is evidence-backed."}
  - {id: HI-016, rule: contradictions_preserved, pass: "Material contradictory/qualifying evidence remains visible until resolved."}
  - {id: HI-017, rule: fix_after_proven_cause, pass: "FIX_CANDIDATE/FIX_VERIFIED requires a PROVEN root cause."}
  - {id: HI-018, rule: fix_causally_aligned, pass: "Candidate change maps explicitly to the proven causal factor."}
  - {id: HI-019, rule: fix_minimal, pass: "Candidate excludes unrelated refactors, cleanup and unsupported dependency/config churn."}
  - {id: HI-020, rule: semantic_reauthor_boundary, pass: "Required semantic contract changes return BLOCKED/SEMANTIC_REAUTHOR_REQUIRED."}
  - {id: HI-021, rule: security_not_overridden, pass: "S13M never overrides or weakens S13L security decisions."}
  - {id: HI-022, rule: regression_pre_fix_failure, pass: "Closure regression fails on the pre-fix baseline for the intended reason."}
  - {id: HI-023, rule: regression_post_fix_pass, pass: "Same regression semantics pass on the exact post-fix candidate."}
  - {id: HI-024, rule: exact_candidate_evidence, pass: "Post-fix checks identify the exact candidate revision/artifact."}
  - {id: HI-025, rule: relevant_suite_impact_driven, pass: "Suite selection is derived from impacted code/contract/boundary surfaces."}
  - {id: HI-026, rule: shared_change_broadens_suite, pass: "Shared/global changes require broader relevant-suite coverage."}
  - {id: HI-027, rule: required_suite_results_complete, pass: "Required suite checks PASS or have explicit justified NOT_APPLICABLE status."}
  - {id: HI-028, rule: full_suite_not_causal_proof, pass: "A green full suite is never used alone as root-cause proof."}
  - {id: HI-029, rule: flaky_repeated_evidence, pass: "Intermittent FIX_VERIFIED has bounded repeated pre/post evidence and limitations."}
  - {id: HI-030, rule: environment_delta_explicit, pass: "Intentional environment/config fix records the before/after delta explicitly."}
  - {id: HI-031, rule: retryable_metadata_only, pass: "S09 retryable metadata does not create retry/backoff/async behavior."}
  - {id: HI-032, rule: no_s13n_eval_platform, pass: "No general agent-eval/golden-case platform is introduced."}
  - {id: HI-033, rule: no_s13o_retry_engine, pass: "No retry/backoff/idempotency/async-job engine is introduced."}
  - {id: HI-034, rule: no_s13p_observability_platform, pass: "No telemetry/tracing platform is introduced."}
  - {id: HI-035, rule: no_s14_capability_binding, pass: "No Capability Registry/MCP/connector/shell-tool binding is introduced."}
  - {id: HI-036, rule: actual_candidate_gated, pass: "The actual parsed candidate is validated/gated; no faithful substitute is inserted."}
  - {id: HI-037, rule: candidate_status_recomputed, pass: "Candidate-reported status/claims are not accepted as proof."}
  - {id: HI-038, rule: structural_validation_total, pass: "Malformed/unknown candidate structures fail closed without throwing."}
  - {id: HI-039, rule: evidence_refs_resolve, pass: "Material conclusion references resolve to supplied bounded evidence."}
  - {id: HI-040, rule: evidence_minimized, pass: "Artifacts contain safe references and summaries, not live secrets/raw sensitive payloads."}
  - {id: HI-041, rule: input_immutable, pass: "Input/evidence/reproduction/suite structures remain unchanged."}
  - {id: HI-042, rule: prior_contracts_immutable, pass: "S09/S10/S12/S13L and approved prior semantics are not silently rewritten."}
  - {id: HI-043, rule: unresolved_contradiction_blocks_closure, pass: "Material unresolved contradiction prevents FIX_VERIFIED."}
  - {id: HI-044, rule: limitations_explicit, pass: "Material residual uncertainty/limitations are explicit."}
  - {id: HI-045, rule: provider_neutral, pass: "No CI/model/test/observability/deploy/repo-host vendor is required by canonical semantics."}
  - {id: HI-046, rule: provider_truth_blind, pass: "Reference provider cannot read fixture id, expected truth, arm marker or evaluator/frozen-truth helpers."}
  - {id: HI-047, rule: atomic_observation_isolation, pass: "All 30 dimension-specific observation IDs own disjoint atomic candidate fields and pass detached mutation isolation."}
  - {id: HI-048, rule: skill_vs_no_skill_same_path, pass: "A/B arms share input/runtime/provider/parser/gate/evaluator; only Skill prose differs."}
  - {id: HI-049, rule: unsafe_counters_zero, pass: "All eight canonical unsafe counters are zero for the Skill arm."}
  - {id: HI-050, rule: fresh_independent_verification, pass: "Bootstrap closure requires a different fresh non-authoring non-fork read-only verifier PASS."}

semantic_dimensions:
  - id: SD-001
    name: reproduction_fidelity
    atomic_assertions:
      - {id: SD1-A, field_family: reproduction.signature_result}
      - {id: SD1-B, field_family: reproduction.setup_result}
      - {id: SD1-C, field_family: reproduction.evidence_result}
  - id: SD-002
    name: evidence_traceability_and_contradictions
    atomic_assertions:
      - {id: SD2-A, field_family: evidence.traceability_result}
      - {id: SD2-B, field_family: evidence.revision_binding_result}
      - {id: SD2-C, field_family: evidence.contradiction_result}
  - id: SD-003
    name: root_cause_epistemic_integrity
    atomic_assertions:
      - {id: SD3-A, field_family: root_cause.hypothesis_result}
      - {id: SD3-B, field_family: root_cause.causal_evidence_result}
      - {id: SD3-C, field_family: root_cause.classification_result}
  - id: SD-004
    name: minimal_fix_quality
    atomic_assertions:
      - {id: SD4-A, field_family: fix.causal_alignment_result}
      - {id: SD4-B, field_family: fix.minimal_scope_result}
      - {id: SD4-C, field_family: fix.semantic_boundary_result}
  - id: SD-005
    name: regression_before_after
    atomic_assertions:
      - {id: SD5-A, field_family: regression.pre_fix_result}
      - {id: SD5-B, field_family: regression.post_fix_result}
      - {id: SD5-C, field_family: regression.candidate_binding_result}
  - id: SD-006
    name: relevant_suite_selection_and_result
    atomic_assertions:
      - {id: SD6-A, field_family: suite.selection_result}
      - {id: SD6-B, field_family: suite.result_result}
      - {id: SD6-C, field_family: suite.shared_surface_result}
  - id: SD-007
    name: flaky_and_environment_handling
    atomic_assertions:
      - {id: SD7-A, field_family: stability.intermittent_result}
      - {id: SD7-B, field_family: stability.environment_result}
      - {id: SD7-C, field_family: stability.retry_boundary_result}
  - id: SD-008
    name: security_and_sensitive_boundary
    atomic_assertions:
      - {id: SD8-A, field_family: security.security_boundary_result}
      - {id: SD8-B, field_family: security.data_hygiene_result}
      - {id: SD8-C, field_family: security.override_result}
  - id: SD-009
    name: status_uncertainty_and_next_action
    atomic_assertions:
      - {id: SD9-A, field_family: decision.status_result}
      - {id: SD9-B, field_family: decision.blocker_result}
      - {id: SD9-C, field_family: decision.uncertainty_result}
  - id: SD-010
    name: provider_and_stage_boundary
    atomic_assertions:
      - {id: SD10-A, field_family: boundary.provider_neutral_result}
      - {id: SD10-B, field_family: boundary.future_stage_result}
      - {id: SD10-C, field_family: boundary.prior_contract_result}

fixtures:
  minimum_positive_evaluable: 8
  minimum_negative: 36
  canonical_positive:
    - {id: FX-POS-001, expected: FIX_VERIFIED, class: CODE}
    - {id: FX-POS-002, expected: FIX_VERIFIED, class: TEST}
    - {id: FX-POS-003, expected: FIX_VERIFIED, class: CONFIGURATION}
    - {id: FX-POS-004, expected: FIX_VERIFIED, class: DEPENDENCY}
    - {id: FX-POS-005, expected: FIX_VERIFIED, class: DATA}
    - {id: FX-POS-006, expected: FIX_CANDIDATE, class: CODE}
    - {id: FX-POS-007, expected: INVESTIGATING, class: UNKNOWN}
    - {id: FX-POS-008, expected: INVESTIGATING, class: ENVIRONMENT}
  canonical_negative:
    - {id: FX-NEG-001, condition: reproduction_claim_without_direct_attempt}
    - {id: FX-NEG-002, condition: reproduction_signature_mismatch}
    - {id: FX-NEG-003, condition: wrong_baseline_revision}
    - {id: FX-NEG-004, condition: missing_environment_identity}
    - {id: FX-NEG-005, condition: single_green_run_declares_flaky_fixed}
    - {id: FX-NEG-006, condition: symptom_promoted_to_cause}
    - {id: FX-NEG-007, condition: hypothesis_proven_without_discriminating_evidence}
    - {id: FX-NEG-008, condition: correlation_only_causal_claim}
    - {id: FX-NEG-009, condition: full_suite_used_as_cause_proof}
    - {id: FX-NEG-010, condition: contradictory_evidence_suppressed}
    - {id: FX-NEG-011, condition: unknown_failure_class_coerced}
    - {id: FX-NEG-012, condition: fix_before_proven_cause}
    - {id: FX-NEG-013, condition: fix_not_linked_to_causal_factor}
    - {id: FX-NEG-014, condition: unrelated_refactor_bundled}
    - {id: FX-NEG-015, condition: cleanup_churn_bundled}
    - {id: FX-NEG-016, condition: dependency_change_without_dependency_cause}
    - {id: FX-NEG-017, condition: semantic_change_treated_as_mechanical}
    - {id: FX-NEG-018, condition: s13l_block_overridden}
    - {id: FX-NEG-019, condition: security_weakened_to_pass}
    - {id: FX-NEG-020, condition: regression_never_fails_before}
    - {id: FX-NEG-021, condition: regression_fails_before_for_wrong_reason}
    - {id: FX-NEG-022, condition: regression_from_wrong_candidate}
    - {id: FX-NEG-023, condition: relevant_suite_omits_impacted_module}
    - {id: FX-NEG-024, condition: shared_change_only_narrow_test}
    - {id: FX-NEG-025, condition: required_suite_failure_ignored}
    - {id: FX-NEG-026, condition: not_run_treated_as_pass}
    - {id: FX-NEG-027, condition: intermittent_closed_without_repeated_evidence}
    - {id: FX-NEG-028, condition: environment_delta_hidden}
    - {id: FX-NEG-029, condition: retryable_flag_becomes_retry_engine}
    - {id: FX-NEG-030, condition: observability_platform_pulled_forward}
    - {id: FX-NEG-031, condition: agent_eval_platform_pulled_forward}
    - {id: FX-NEG-032, condition: capability_binding_pulled_forward}
    - {id: FX-NEG-033, condition: actual_candidate_substituted}
    - {id: FX-NEG-034, condition: provider_reads_truth_or_fixture_id}
    - {id: FX-NEG-035, condition: malformed_candidate_throws}
    - {id: FX-NEG-036, condition: secret_or_sensitive_payload_copied}

ground_truth_policy:
  construction: FROZEN_BEFORE_EXECUTION
  provider_visibility: FORBIDDEN
  model_visibility: FORBIDDEN
  fixture_id_branching: FORBIDDEN
  skill_id_branching: FORBIDDEN
  with_skill_flag_branching: FORBIDDEN
  evaluator_import_into_provider: FORBIDDEN
  production_helper_imports_from_truth: FORBIDDEN
  post_hoc_denominator_changes: FORBIDDEN

atomic_isolation_policy:
  assertion_ids: 30
  exact_atomic_mutation_probes_required: 30
  mutation_effect: "Each mutation changes exactly its owned assertion ID and no sibling or cross-cutting assertion."
  detached_snapshot_required: true

skill_vs_no_skill_evaluation:
  same_input: true
  same_host_agent_definition: true
  same_model_provider_class: true
  same_capability_provider: true
  same_parser: true
  same_gate: true
  same_evaluator: true
  only_skill_prose_differs: true
  cross_cutting_assertions_per_fixture: 1
  dimension_specific_assertions_per_fixture: 30
  positive_dimension_delta_required: true
  minimum_qualified_dimensions: 5
  qualified_dimension_minimum_distinct_assertion_ids: 2
  maximum_single_assertion_share: 0.50
  hard_invariant_regression_allowed: false
  unsafe_counters_must_all_be_zero: true

unsafe_counters:
  - false_reproduction_claim
  - hypothesis_promoted_without_causal_evidence
  - uncausal_or_overbroad_fix_recommended
  - regression_before_after_missing
  - under_scoped_or_wrong_candidate_suite_pass
  - flaky_or_environmental_overclaim
  - security_or_semantic_boundary_override
  - provider_or_future_stage_binding

part_b_scope:
  allowed:
    - src/intelligence/qa-debugging/**
    - src/intelligence/skills/definitions/qaDebuggingS13M.ts
    - src/intelligence/skills/index.ts
    - tests/qa-debugging/**
    - brain-bootstrap/reports/S13M-qa-debugging-verification.md
    - brain/context/handoffs/*s13m*
    - brain-bootstrap/STATE.yaml
    - brain/context/CURRENT.md
    - mechanical prior-tests updates strictly required by append-only Skill catalog growth
  forbidden:
    - src/core/**
    - src/providers/**
    - package.json
    - package-lock.json
    - any new AgentDefinition
    - any runtime dependency
    - retry/backoff/idempotency/async implementation
    - observability/telemetry platform
    - agent-eval platform or registry
    - Capability Registry/MCP/connector/shell/browser/network tool binding
    - S13N/S13O/S13P/S13Q/S13R/S14 implementation

definition_of_done:
  - "Part A is integrated byte-identically and remains auditable."
  - "S13M remains SKILL_ONLY, capability-free and provider-neutral."
  - "All canonical positive/negative behaviors and T1-T126-equivalent requirements pass."
  - "Actual-candidate gating, total structural validation and input immutability pass."
  - "Root-cause, minimal-fix, regression and relevant-suite fail-closed policies pass."
  - "30/30 detached atomic isolation and provider/frozen-truth separation pass."
  - "Skill-vs-no-Skill meets DEEP threshold with all unsafe counters zero."
  - "Typecheck, focused, full pre-build, genuine clean build and full post-build pass."
  - "Different fresh non-authoring non-fork read-only verifier independently returns PASS."
  - "S13N remains NOT_STARTED until ChatGPT control plane accepts that PASS."
===== END FILE: brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_DEEP.yaml =====

===== BEGIN FILE: brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md =====
# BRAIN — QA Debugging Contract S13M

**Step:** S13M — qa-debugging  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**Quality depth:** DEEP  
**New AgentDefinition:** NO  
**Canonical runtime side effects:** NONE  
**Provider-specific debugger/test runner:** OUT OF SCOPE

## 1. Purpose

Define one provider-neutral, evidence-grounded QA/debugging assessment for a bounded reported failure and at most one candidate fix.

The contract operationalizes:

```text
Reproduce
→ Evidence
→ Root cause
→ Minimal fix
→ Regression
→ Relevant suite
```

without implementing an autonomous debugger, shell/test capability, retry engine, observability platform, agent-evaluation platform, deployment system, or Capability Registry.

S13M consumes evidence gathered by an authorized builder/controller and determines what can responsibly be claimed next.

## 2. Why S13M is SKILL_ONLY

The S13E execution-model hierarchy is authoritative.

S13M v1 does not itself perform:

```text
run command
inspect file
edit code
invoke test tool
retry command
open browser
query network
commit change
```

Instead, one invocation receives a bounded packet containing those observations/results as evidence and returns one semantic QA/debugging decision.

The external engineering workflow may repeat:

```text
gather evidence
→ invoke S13M
→ perform authorized next action outside the Skill
→ gather new evidence
→ invoke S13M again
```

That outer workflow is not an S13M Agent implementation.

Creating an autonomous debugger Agent inside S13M would require observation-dependent capabilities and would pull forward capability binding from S14 and retry/async behavior from S13O. Therefore no S13M AgentDefinition is created.

## 3. Canonical status

```ts
export type QaDebuggingStatus =
  | "INVESTIGATING"
  | "FIX_CANDIDATE"
  | "FIX_VERIFIED"
  | "BLOCKED";
```

Interpretation:

- `INVESTIGATING`: evidence is valid enough to continue, but reproduction/root cause/fix/regression/suite closure is incomplete.
- `FIX_CANDIDATE`: root cause is proven and one causally aligned minimal candidate fix is supported, but closure evidence is incomplete.
- `FIX_VERIFIED`: supplied evidence proves the candidate addresses the bounded failure and passes required regression/relevant-suite gates.
- `BLOCKED`: responsible continuation requires unavailable/forbidden authority/evidence or input is invalid.

`FIX_VERIFIED` is not independent bootstrap verification and never marks S13M `PASS` by itself.

## 4. Shared result enums

```ts
export type QaCheckResult =
  | "PASS"
  | "FAIL"
  | "NOT_APPLICABLE";

export type ReproductionState =
  | "REPRODUCED"
  | "NOT_REPRODUCED"
  | "INTERMITTENT"
  | "INSUFFICIENT_EVIDENCE";

export type FailureClass =
  | "CODE"
  | "TEST"
  | "DATA"
  | "CONFIGURATION"
  | "ENVIRONMENT"
  | "DEPENDENCY"
  | "CONTRACT"
  | "SECURITY_BOUNDARY"
  | "UNKNOWN";

export type RootCauseState =
  | "HYPOTHESIS"
  | "PROVEN"
  | "DISPROVEN"
  | "UNRESOLVED";

export type SuiteCheckOutcome =
  | "PASS"
  | "FAIL"
  | "NOT_RUN"
  | "NOT_APPLICABLE";

export type SecurityBoundaryStatus =
  | "ALLOW"
  | "APPROVAL_REQUIRED"
  | "BLOCKED"
  | "NOT_APPLICABLE";
```

Unknown enum values are invalid input/candidate structure and must fail closed.

## 5. Bounded evidence projection

S13M reuses the semantics of `brain-bootstrap/templates/EVIDENCE_RECORD.yaml` without copying raw evidence payloads into the decision.

```ts
export type QaEvidenceRelationship =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "QUALIFIES";

export type QaEvidenceSourceType =
  | "DIRECT_OBSERVATION"
  | "PRIMARY"
  | "SECONDARY"
  | "STAKEHOLDER"
  | "OTHER";

export interface QaEvidenceRecordInput {
  evidence_ref: string;
  claim_ref: string;
  relationship: QaEvidenceRelationship;
  source_type: QaEvidenceSourceType;

  locator_ref: string;
  command_or_method?: string;

  observed_revision_ref?: string;
  observed_environment_ref?: string;

  reproducible: boolean;
  limitations: string[];
  contradiction_refs: string[];
}
```

Rules:

- `evidence_ref`, `locator_ref`, revision/environment refs are safe opaque identifiers.
- no live secret or raw sensitive payload is stored here;
- material conclusions must resolve to supplied `evidence_ref` values;
- contradictory/qualifying evidence remains visible;
- a model assertion is not evidence merely because it appears in the candidate.

## 6. Incident identity

One decision covers exactly one bounded incident signature.

```ts
export interface QaIncidentInput {
  incident_ref: string;

  expected_behavior: string;
  observed_behavior: string;

  failure_signature: {
    signature_ref: string;
    normalized_code?: string;
    normalized_message_ref?: string;
    failing_check_ref?: string;
  };

  baseline_revision_ref: string;
  affected_surface_refs: string[];

  first_observed_evidence_refs: string[];
}
```

The contract does not require verbatim stack traces or sensitive payloads. Safe locators/hashes/normalized refs are preferred.

## 7. Environment identity

```ts
export interface QaEnvironmentSnapshot {
  environment_ref: string;

  runtime_refs: string[];
  dependency_snapshot_ref?: string;
  configuration_snapshot_ref?: string;
  platform_ref?: string;

  required_environment_refs: string[];
  known_mismatch_refs: string[];

  evidence_refs: string[];
}
```

Environment differences are part of causal evidence.

A test executed under an environment that materially differs from the failing environment cannot silently be treated as equivalent.

The repository's canonical runtime foundation remains upstream authority. A temporarily observed shell version is evidence about that shell, not a semantic rewrite of the runtime contract.

## 8. Reproduction attempts

```ts
export type ReproductionAttemptOutcome =
  | "MATCHED_FAILURE"
  | "NO_FAILURE"
  | "DIFFERENT_FAILURE"
  | "BLOCKED";

export interface ReproductionAttempt {
  attempt_ref: string;

  baseline_revision_ref: string;
  environment_ref: string;

  setup_ref: string;
  method_ref: string;

  outcome: ReproductionAttemptOutcome;
  observed_signature_ref?: string;

  deterministic_seed_ref?: string;
  scheduling_or_timing_ref?: string;

  evidence_refs: string[];
}
```

### Reproduction derivation

`REPRODUCED` requires:

- at least one inspectable `MATCHED_FAILURE`;
- the same bounded failure signature;
- correct baseline revision;
- declared material environment/setup;
- resolving evidence refs.

`NOT_REPRODUCED` means one or more valid attempts ran but none matched the signature and evidence is not sufficient to characterize the issue as intermittent.

`INTERMITTENT` requires repeated valid attempts in which the same signature occurs in some but not all attempts.

`INSUFFICIENT_EVIDENCE` applies when attempts are absent, blocked, uninspectable, wrong-revision, wrong-signature, or otherwise inadequate.

A reported failure may remain real even when not yet reproduced. S13M must not transform `NOT_REPRODUCED` into "no defect".

## 9. Symptom and hypothesis model

```ts
export interface QaHypothesisInput {
  hypothesis_ref: string;
  statement: string;
  failure_class: FailureClass;

  predicted_observation_refs: string[];
  supporting_evidence_refs: string[];
  contradicting_evidence_refs: string[];
}

export type CausalExperimentOutcome =
  | "SUPPORTS_CAUSE"
  | "CONTRADICTS_CAUSE"
  | "INCONCLUSIVE";

export interface QaCausalExperimentInput {
  experiment_ref: string;
  hypothesis_ref: string;

  changed_factor_ref: string;
  held_constant_refs: string[];

  predicted_effect_ref: string;
  observed_effect_ref: string;

  outcome: CausalExperimentOutcome;
  evidence_refs: string[];
}
```

A symptom is only the expected/observed mismatch.

A hypothesis is an explanation that predicts observations.

A root cause is `PROVEN` only when evidence discriminates it from material alternatives.

Examples of acceptable causal evidence include:

- a controlled factor change that causes the failure to appear/disappear while relevant confounders remain controlled;
- an authoritative approved contract that requires behavior X plus direct evidence that implementation Y violates that exact requirement and a targeted change restores it;
- dependency/config/environment identity evidence that isolates the mismatch to the relevant causal factor;
- another inspectable experiment with equivalent discriminatory force.

Not sufficient by itself:

```text
stack proximity
temporal sequence
code looks suspicious
one green run after editing
full suite passes
model confidence
builder assertion
```

## 10. Root-cause assessment

```ts
export interface QaRootCauseAssessment {
  state: RootCauseState;
  failure_class: FailureClass;

  hypothesis_ref?: string;
  causal_factor_ref?: string;

  supporting_evidence_refs: string[];
  contradicting_evidence_refs: string[];

  unresolved_alternative_refs: string[];
}
```

Rules:

- `PROVEN` requires a known non-`UNKNOWN` class;
- every material supporting/contradicting ref must resolve;
- a material unresolved alternative that could change the fix prevents `PROVEN`;
- `UNKNOWN` is allowed with `HYPOTHESIS`/`UNRESOLVED`, not with final `PROVEN`;
- `DISPROVEN` means the named hypothesis is contradicted by evidence, not that the incident is false.

## 11. Candidate fix input

S13M assesses at most one proposed candidate fix.

```ts
export type CandidateFixKind =
  | "CODE_CHANGE"
  | "TEST_CHANGE"
  | "DATA_FIXTURE_CHANGE"
  | "CONFIGURATION_CHANGE"
  | "DEPENDENCY_CHANGE"
  | "ENVIRONMENT_CHANGE"
  | "NO_FIX_YET";

export interface QaCandidateFixInput {
  kind: CandidateFixKind;

  candidate_revision_ref?: string;
  change_ref?: string;

  changed_surface_refs: string[];
  causal_factor_refs: string[];

  rationale: string;

  unrelated_change_refs: string[];

  semantic_artifact_change_refs: string[];
  security_boundary_change_refs: string[];
}
```

`NO_FIX_YET` carries no candidate revision/change refs.

A candidate fix is causally aligned only when its change is explained by the proven causal factor.

## 12. Minimal-fix policy

The canonical meaning of "minimal" is:

```text
smallest causally sufficient change set
+
required regression support
+
required compatibility/mechanical updates
```

It does not mean "fewest lines" in isolation.

A candidate is not minimal when it contains:

- unrelated refactors;
- cleanup not required by the cause;
- formatting churn outside mechanically required files;
- dependency changes without a dependency cause;
- runtime/config changes without an environment/config cause;
- semantic policy/spec changes disguised as implementation repair;
- security weakening to make a test pass.

If an approved canonical semantic artifact must change, S13M returns `BLOCKED` with a semantic-reauthor blocker. The owning ChatGPT Authoring Gate must handle it.

## 13. Regression evidence

```ts
export interface QaRegressionEvidenceInput {
  regression_check_ref: string;

  pre_fix_revision_ref: string;
  post_fix_revision_ref?: string;

  pre_fix_outcome: SuiteCheckOutcome;
  post_fix_outcome: SuiteCheckOutcome;

  pre_fix_failure_signature_ref?: string;
  expected_failure_signature_ref: string;

  evidence_refs: string[];
}
```

Closure-quality regression requires:

```text
pre_fix_outcome == FAIL
AND pre_fix_failure_signature_ref == expected_failure_signature_ref
AND post_fix_outcome == PASS
AND post_fix_revision_ref == candidate_fix.candidate_revision_ref
```

If no candidate exists yet, post-fix outcome may be `NOT_RUN`; status cannot exceed `FIX_CANDIDATE`.

A passing post-fix test without equivalent pre-fix failure evidence is incomplete.

## 14. Relevant suite descriptors

```ts
export type QaSuiteScope =
  | "DIRECT_REGRESSION"
  | "IMPACTED_MODULE"
  | "CONTRACT_BOUNDARY"
  | "SHARED_SURFACE"
  | "FULL_SUITE";

export interface QaSuiteDescriptorInput {
  suite_ref: string;
  scope: QaSuiteScope;

  covered_surface_refs: string[];
  covered_contract_refs: string[];
}

export interface QaSuiteResultInput {
  suite_ref: string;

  candidate_revision_ref: string;
  environment_ref: string;

  outcome: SuiteCheckOutcome;

  executed_check_count?: number;
  passed_check_count?: number;
  failed_check_count?: number;

  evidence_refs: string[];
}
```

## 15. Relevant-suite derivation

Required suite selection is derived from:

```text
candidate changed_surface_refs
+
incident affected_surface_refs
+
approved contract boundaries affected by the change
+
shared/global surfaces transitively touched
```

Always include a direct regression when applicable.

Include impacted-module and affected-contract suites.

A `SHARED_SURFACE` or `FULL_SUITE` requirement is triggered when evidence says the change touches a shared/cross-cutting surface whose affected set cannot be safely bounded to one module.

A candidate may use a narrow suite only when the impact evidence justifies that scope.

`NOT_RUN` never equals `PASS`.

`NOT_APPLICABLE` requires explicit reason/evidence.

## 16. Intermittent/flaky failure policy

For `INTERMITTENT` evidence:

```ts
export interface QaStabilityEvidenceInput {
  pre_fix_attempt_refs: string[];
  post_fix_attempt_refs: string[];

  matching_pre_fix_failure_count: number;
  total_pre_fix_attempt_count: number;

  matching_post_fix_failure_count: number;
  total_post_fix_attempt_count: number;

  limitation_refs: string[];
}
```

`FIX_VERIFIED` for an intermittent failure requires:

- more than one valid pre-fix attempt;
- at least one pre-fix matching failure;
- the same normalized failure signature across matching failures;
- a `PROVEN` root cause;
- repeated post-fix execution of the same scenario;
- post-fix attempt count at least the pre-fix attempt count;
- zero matching post-fix failures in the supplied bounded sample;
- explicit limitation that bounded runs do not prove recurrence is impossible.

A caller may demand stricter counts via its Quality Contract. S13M never lowers that external requirement.

## 17. Security boundary

```ts
export interface QaSecurityBoundaryInput {
  status: SecurityBoundaryStatus;

  security_decision_ref?: string;
  protected_boundary_refs: string[];

  candidate_preserves_boundary: boolean;
  evidence_refs: string[];
}
```

Rules:

- `BLOCKED` remains blocking;
- `APPROVAL_REQUIRED` remains non-authorized;
- S13M may investigate why a security test fails, but cannot weaken the security contract to make it green;
- candidate security-boundary changes require the owning semantic/security authorization, not S13M self-approval;
- raw secret/PII content must not be copied into S13M artifacts.

## 18. Acceptance and evidence requirements

S13M preserves upstream acceptance/evidence requirements as references.

```ts
export interface QaAcceptanceCriterionRef {
  criterion_ref: string;
  description: string;
}

export interface QaEvidenceRequirementRef {
  requirement_ref: string;
  category: string;
  description: string;
}
```

The Part B implementation SHOULD reuse an existing compatible canonical type when one already exists. It MUST NOT silently alter upstream semantics merely to reduce imports.

## 19. Canonical input

```ts
export interface QaDebuggingInput {
  task_ref: string;
  spec_refs: string[];
  quality_contract_ref: string;

  incident: QaIncidentInput;

  environments: QaEnvironmentSnapshot[];
  reproduction_attempts: ReproductionAttempt[];

  evidence_records: QaEvidenceRecordInput[];

  hypotheses: QaHypothesisInput[];
  causal_experiments: QaCausalExperimentInput[];

  candidate_fix: QaCandidateFixInput;
  regression: QaRegressionEvidenceInput;

  suite_descriptors: QaSuiteDescriptorInput[];
  suite_results: QaSuiteResultInput[];

  stability?: QaStabilityEvidenceInput;
  security: QaSecurityBoundaryInput;

  acceptance: QaAcceptanceCriterionRef[];
  evidence_required: QaEvidenceRequirementRef[];

  known_limitations: string[];
}
```

The input is immutable.

One input assesses only one incident signature and at most one candidate fix.

## 20. Blockers and next actions

```ts
export type QaDebuggingBlockerCode =
  | "INVALID_INPUT"
  | "REQUIRED_EVIDENCE_UNAVAILABLE"
  | "SECURITY_BOUNDARY_BLOCKED"
  | "SEMANTIC_REAUTHOR_REQUIRED"
  | "REQUIRED_AUTHORITY_OR_PERMISSION_MISSING"
  | "FUTURE_STAGE_PULL_FORWARD"
  | "PROHIBITED_SENSITIVE_PAYLOAD";

export interface QaDebuggingBlocker {
  code: QaDebuggingBlockerCode;
  message: string;
  evidence_refs: string[];
}

export type QaDebuggingNextAction =
  | "REPRODUCE_FAILURE"
  | "COLLECT_DISCRIMINATING_EVIDENCE"
  | "RESOLVE_CONTRADICTION"
  | "PREPARE_MINIMAL_FIX"
  | "RUN_REGRESSION_BEFORE_AFTER"
  | "RUN_RELEVANT_SUITE"
  | "REQUEST_SEMANTIC_REAUTHOR"
  | "REQUEST_SECURITY_OR_AUTHORITY_DECISION"
  | "READY_FOR_INDEPENDENT_VERIFICATION"
  | "STOP_BLOCKED";
```

Exactly one next action is returned.

## 21. Atomic candidate decision fields

The 30 atomic leaves below exist to make semantic ownership/evaluation independently inspectable.

```ts
export interface QaDebuggingAtomicDecision {
  reproduction: {
    signature_result: QaCheckResult;
    setup_result: QaCheckResult;
    evidence_result: QaCheckResult;
  };

  evidence: {
    traceability_result: QaCheckResult;
    revision_binding_result: QaCheckResult;
    contradiction_result: QaCheckResult;
  };

  root_cause: {
    hypothesis_result: QaCheckResult;
    causal_evidence_result: QaCheckResult;
    classification_result: QaCheckResult;
  };

  fix: {
    causal_alignment_result: QaCheckResult;
    minimal_scope_result: QaCheckResult;
    semantic_boundary_result: QaCheckResult;
  };

  regression: {
    pre_fix_result: QaCheckResult;
    post_fix_result: QaCheckResult;
    candidate_binding_result: QaCheckResult;
  };

  suite: {
    selection_result: QaCheckResult;
    result_result: QaCheckResult;
    shared_surface_result: QaCheckResult;
  };

  stability: {
    intermittent_result: QaCheckResult;
    environment_result: QaCheckResult;
    retry_boundary_result: QaCheckResult;
  };

  security: {
    security_boundary_result: QaCheckResult;
    data_hygiene_result: QaCheckResult;
    override_result: QaCheckResult;
  };

  decision: {
    status_result: QaCheckResult;
    blocker_result: QaCheckResult;
    uncertainty_result: QaCheckResult;
  };

  boundary: {
    provider_neutral_result: QaCheckResult;
    future_stage_result: QaCheckResult;
    prior_contract_result: QaCheckResult;
  };
}
```

Each OI-A assertion ID owns exactly one leaf.

Observation extraction must not concatenate sibling leaf values to create artificial independence.

## 22. Canonical decision

```ts
export interface QaDebuggingDecision {
  status: QaDebuggingStatus;

  task_ref: string;
  incident_ref: string;

  reproduction_state: ReproductionState;

  root_cause: QaRootCauseAssessment;

  candidate_fix_kind: CandidateFixKind;
  candidate_revision_ref?: string;

  required_suite_refs: string[];

  atomic: QaDebuggingAtomicDecision;

  blockers: QaDebuggingBlocker[];
  next_action: QaDebuggingNextAction;

  evidence_refs: string[];
  contradiction_refs: string[];

  residual_unknowns: string[];
  limitations: string[];

  acceptance: QaAcceptanceCriterionRef[];
  evidence_required: QaEvidenceRequirementRef[];
}
```

The decision carries no raw secret/PII payload.

## 23. Deterministic status derivation

Candidate `status` is never authoritative.

Part B recomputes final status from validated input, actual candidate structure and evidence.

### BLOCKED

Return `BLOCKED` when any hard blocker exists, including:

- invalid/unknown/malformed structure;
- required material evidence unavailable/unresolvable;
- prohibited sensitive/secret payload requiring unsafe processing;
- S13L/security authority blocks the proposed path;
- candidate fix requires unapproved semantic reauthoring;
- required protected authority/permission is missing;
- candidate attempts S13N/S13O/S13P/S13Q/S13R/S14 pull-forward.

### INVESTIGATING

Return `INVESTIGATING` when no hard blocker exists but closure is not yet justified, including:

- reproduction not established;
- intermittent evidence incomplete;
- root cause is `HYPOTHESIS` or `UNRESOLVED`;
- contradiction material to the cause remains unresolved;
- no causally justified candidate fix exists.

### FIX_CANDIDATE

Return `FIX_CANDIDATE` only when:

- reproduction/causal incident evidence is adequate;
- root cause is `PROVEN`;
- failure class is known;
- one candidate fix maps to the proven cause;
- fix scope is minimal and does not violate semantic/security boundaries;
- regression/relevant-suite closure remains incomplete.

### FIX_VERIFIED

Return `FIX_VERIFIED` only when:

- the criteria for `FIX_CANDIDATE` hold;
- regression fails pre-fix for the intended signature;
- same regression passes post-fix;
- post-fix evidence binds to the exact candidate revision;
- every required relevant suite check passes or is justified `NOT_APPLICABLE`;
- intermittent case requirements, when applicable, pass;
- environment deltas are explicit;
- material contradictions are resolved/non-blocking;
- required evidence refs resolve;
- all hard boundaries remain preserved.

No `FIX_VERIFIED` decision may be converted directly into bootstrap `PASS`.

## 24. Deterministic next-action derivation

Order the next action by earliest unresolved owning gate:

```text
hard blocker
→ STOP_BLOCKED / semantic/security request

reproduction insufficient
→ REPRODUCE_FAILURE

material contradiction
→ RESOLVE_CONTRADICTION

root cause unproven
→ COLLECT_DISCRIMINATING_EVIDENCE

proven cause but no valid minimal fix
→ PREPARE_MINIMAL_FIX

regression incomplete
→ RUN_REGRESSION_BEFORE_AFTER

required suite incomplete
→ RUN_RELEVANT_SUITE

all S13M closure evidence complete
→ READY_FOR_INDEPENDENT_VERIFICATION
```

This is guidance only; S13M invokes no capability.

## 25. Root-cause proof by failure class

### CODE
Direct implementation behavior conflicts with approved expectation and discriminating evidence isolates an implementation factor.

### TEST
Approved behavior is correct, but the test/fixture/check itself encodes a wrong expectation or invalid setup. The approved Spec/contract must be authoritative.

### DATA
The defect arises from bounded data/fixture shape/content rather than code semantics. Do not store raw sensitive production data in S13M artifacts.

### CONFIGURATION
A configuration value/snapshot causally produces the failure. The exact config delta is evidence.

### ENVIRONMENT
Runtime/platform/system environment causally produces the failure. Required vs observed environment must be explicit.

### DEPENDENCY
A dependency identity/version/behavior mismatch is causally established. Do not upgrade/downgrade a dependency merely because a dependency hypothesis is convenient.

### CONTRACT
Implementation/test behavior conflicts with an approved contract. If the approved contract itself must change, that is semantic reauthoring and S13M blocks rather than rewriting it.

### SECURITY_BOUNDARY
The failure is caused by a security policy/boundary decision or enforcement mismatch. S13M may diagnose; S13L/owning authority governs policy changes.

### UNKNOWN
Use while the cause remains unproven. `UNKNOWN` cannot support `FIX_CANDIDATE` or `FIX_VERIFIED`.

## 26. Evidence sufficiency and contradiction policy

A material claim is closure-eligible only when:

- all required evidence refs resolve;
- at least one inspectable direct/authoritative source supports the claim when such evidence is available;
- known contradictory evidence is referenced;
- contradictions that could change the fix/status are resolved or explicitly shown not to apply;
- limitations state what the evidence does not prove.

Absence of contradictory evidence is not itself proof.

## 27. Candidate structural validation

Validation must be total before any unsafe nested dereference.

At minimum reject/fail closed:

- non-object candidate;
- unknown status or enum;
- missing atomic groups/leaves;
- malformed root-cause object;
- invalid candidate-fix kind/revision relation;
- duplicate/invalid required-suite refs;
- malformed blockers/next action;
- evidence refs not represented as arrays of safe strings;
- malformed acceptance/evidence arrays;
- impossible status/root-cause combinations.

The validator must never throw for malformed model output.

## 28. Actual-candidate anti-substitution

Canonical runtime path for Part B verification:

```text
S12 metadata-only discovery
→ lazy load qa-debugging Skill
→ caller-supplied compatible generic AgentDefinition
→ unchanged S10 compileAgentDefinition()
→ unchanged S09 runAgent()
→ parse actual candidate
→ total structural validation
→ deterministic evidence/QA gate
→ final decision
```

Tests must inject a corrupt but parseable candidate marker/leaf and prove:

- the actual parsed candidate reaches the gate;
- invalid leaf/marker is observable at validation;
- final status becomes fail-closed;
- no separately synthesized faithful decision is substituted before validation.

## 29. Provider and truth isolation

Reference evaluation provider requirements:

- deterministic;
- no network;
- no credentials;
- no fixture ID branch;
- no Skill ID branch;
- no `withSkill` branch;
- no frozen-truth import;
- no evaluator/gate helper import;
- no production helper that exposes expected truth.

Frozen truth requirements:

- constructed before execution;
- imports only safe types/pure fixture inputs as needed;
- does not call provider, materializer, synthesizer, parser, validator, gate or evaluator;
- does not mutate denominator/expected outcomes after observing model output.

## 30. Skill-vs-no-Skill experiment

Use the same:

```text
8 canonical evaluable inputs
host AgentDefinition
ModelProvider class
CapabilityProvider
S09/S10 runtime
parser
deterministic gate
evaluator
```

for both arms.

Only materialized S13M Skill prose may differ.

Per fixture evaluate:

```text
30 dimension-specific atomic assertions
+
1 cross-cutting safe-status assertion XC-A
=
31 assertions
```

Total per arm with 8 fixtures:

```text
248 assertions
```

The exact score is empirical and must not be pre-authored as truth.

## 31. OI-A semantic dimensions

### SD-001 — reproduction fidelity
- `SD1-A` → `reproduction.signature_result`
- `SD1-B` → `reproduction.setup_result`
- `SD1-C` → `reproduction.evidence_result`

### SD-002 — evidence traceability and contradictions
- `SD2-A` → `evidence.traceability_result`
- `SD2-B` → `evidence.revision_binding_result`
- `SD2-C` → `evidence.contradiction_result`

### SD-003 — root-cause epistemic integrity
- `SD3-A` → `root_cause.hypothesis_result`
- `SD3-B` → `root_cause.causal_evidence_result`
- `SD3-C` → `root_cause.classification_result`

### SD-004 — minimal fix
- `SD4-A` → `fix.causal_alignment_result`
- `SD4-B` → `fix.minimal_scope_result`
- `SD4-C` → `fix.semantic_boundary_result`

### SD-005 — regression before/after
- `SD5-A` → `regression.pre_fix_result`
- `SD5-B` → `regression.post_fix_result`
- `SD5-C` → `regression.candidate_binding_result`

### SD-006 — relevant suite
- `SD6-A` → `suite.selection_result`
- `SD6-B` → `suite.result_result`
- `SD6-C` → `suite.shared_surface_result`

### SD-007 — flaky/environment
- `SD7-A` → `stability.intermittent_result`
- `SD7-B` → `stability.environment_result`
- `SD7-C` → `stability.retry_boundary_result`

### SD-008 — security/sensitive boundary
- `SD8-A` → `security.security_boundary_result`
- `SD8-B` → `security.data_hygiene_result`
- `SD8-C` → `security.override_result`

### SD-009 — status/uncertainty/next action
- `SD9-A` → `decision.status_result`
- `SD9-B` → `decision.blocker_result`
- `SD9-C` → `decision.uncertainty_result`

### SD-010 — provider/stage/prior-contract boundary
- `SD10-A` → `boundary.provider_neutral_result`
- `SD10-B` → `boundary.future_stage_result`
- `SD10-C` → `boundary.prior_contract_result`

Every dimension-specific observation is a detached snapshot of its owned atomic leaf only.

## 32. OI-A qualification

A semantic dimension qualifies only if:

- dimension-specific Skill correctness exceeds baseline;
- at least two distinct assertion IDs contribute improved instances;
- no one assertion ID contributes more than 50% of that dimension's total improvement.

For each dimension report raw grouped contribution counts:

```text
assertion_id → improved instance count
dimension delta
max_single_assertion_share
qualified yes/no
```

Overall DEEP experiment passes only when:

- total dimension-specific delta is positive;
- at least 5 semantic dimensions qualify;
- no hard-invariant regression occurs;
- all eight unsafe counters are zero.

Do not use `1 / delta` as a proxy for contribution share.

## 33. Unsafe counters

The Skill arm must have:

```text
false_reproduction_claim = 0
hypothesis_promoted_without_causal_evidence = 0
uncausal_or_overbroad_fix_recommended = 0
regression_before_after_missing = 0
under_scoped_or_wrong_candidate_suite_pass = 0
flaky_or_environmental_overclaim = 0
security_or_semantic_boundary_override = 0
provider_or_future_stage_binding = 0
```

Any non-zero value fails the threshold regardless of semantic score.

## 34. Canonical positive fixtures

### FX-POS-001 — code bug, fully verified
A deterministic code defect reproduces on the baseline, one causal factor is isolated, a minimal code candidate addresses it, regression fails-before/passes-after, impacted suites pass.
Expected: `FIX_VERIFIED`, class `CODE`.

### FX-POS-002 — test expectation bug
Approved Spec proves implementation behavior is correct; the test expectation is causally wrong. Minimal test change has before/after evidence and relevant suites.
Expected: `FIX_VERIFIED`, class `TEST`.

### FX-POS-003 — configuration mismatch
A bounded configuration delta is isolated as cause and candidate config correction passes regression/relevant suite.
Expected: `FIX_VERIFIED`, class `CONFIGURATION`.

### FX-POS-004 — dependency mismatch
Dependency identity/version behavior is proven causal; bounded dependency candidate is exact and relevant suites pass.
Expected: `FIX_VERIFIED`, class `DEPENDENCY`.

### FX-POS-005 — data fixture defect
A non-sensitive deterministic fixture is causally wrong; minimal fixture correction verifies.
Expected: `FIX_VERIFIED`, class `DATA`.

### FX-POS-006 — proven cause, fix not yet closure-tested
Failure is reproduced and cause proven; one minimal candidate is supported but post-fix regression/suite evidence is absent.
Expected: `FIX_CANDIDATE`.

### FX-POS-007 — valid but not reproduced
Report/evidence are structurally valid, no matching reproduction yet, no hard external blocker.
Expected: `INVESTIGATING`, next action `REPRODUCE_FAILURE`.

### FX-POS-008 — intermittent evidence
Repeated attempts show the same failure intermittently, but cause/fix is not yet proven.
Expected: `INVESTIGATING`, with counts/limitations preserved.

## 35. Canonical negative fixtures

All must be named and individually asserted.

```text
FX-NEG-001 reproduction_claim_without_direct_attempt
FX-NEG-002 reproduction_signature_does_not_match_report
FX-NEG-003 reproduction_uses_wrong_baseline_revision
FX-NEG-004 reproduction_environment_identity_missing
FX-NEG-005 single_green_run_declared_flaky_fixed
FX-NEG-006 symptom_relabelled_as_root_cause
FX-NEG-007 hypothesis_marked_proven_without_discriminating_evidence
FX-NEG-008 correlation_only_used_as_causal_proof
FX-NEG-009 passing_full_suite_used_as_root_cause_proof
FX-NEG-010 contradictory_evidence_suppressed
FX-NEG-011 unknown_failure_class_silently_coerced
FX-NEG-012 fix_recommended_before_root_cause_proven
FX-NEG-013 candidate_fix_not_linked_to_causal_factor
FX-NEG-014 unrelated_refactor_bundled_into_fix
FX-NEG-015 formatting_or_cleanup_churn_in_minimal_fix
FX-NEG-016 dependency_change_without_dependency_cause
FX-NEG-017 semantic_contract_change_treated_as_mechanical_fix
FX-NEG-018 s13l_block_overridden_by_debugging
FX-NEG-019 security_policy_weakened_to_make_test_pass
FX-NEG-020 regression_passes_after_but_never_fails_before
FX-NEG-021 regression_fails_before_for_different_reason
FX-NEG-022 regression_result_from_wrong_candidate_revision
FX-NEG-023 relevant_suite_omits_impacted_module
FX-NEG-024 shared_surface_change_with_only_narrow_test
FX-NEG-025 required_suite_failure_ignored
FX-NEG-026 not_run_check_silently_treated_as_pass
FX-NEG-027 intermittent_case_closed_without_repeated_evidence
FX-NEG-028 environment_delta_hidden_between_before_and_after
FX-NEG-029 retryable_flag_treated_as_retry_engine
FX-NEG-030 telemetry_platform_introduced_in_s13m
FX-NEG-031 agent_eval_platform_pulled_forward_from_s13n
FX-NEG-032 capability_or_mcp_binding_pulled_forward_from_s14
FX-NEG-033 actual_candidate_replaced_before_gate
FX-NEG-034 provider_reads_fixture_id_or_frozen_truth
FX-NEG-035 malformed_candidate_throws_instead_of_fail_closed
FX-NEG-036 secret_or_raw_sensitive_payload_copied_into_debug_artifact
```

Expected safe result is `BLOCKED` when the packet violates a hard contract/boundary, otherwise a downgraded non-closure state such as `INVESTIGATING`. No negative may reach unjustified `FIX_VERIFIED`.

## 36. Test matrix T1–T126

Part B must map every requirement below to executable evidence. Multiple requirements may be covered by one test only if the report names the mapping explicitly.

### T1–T12 — Part A / registration / structure

```text
T1  Skill canonical file exists and identity matches S13M.
T2  Quality Contract YAML parses and id/depth/status are exact.
T3  Contract file exists and declares SKILL_ONLY/DEEP/no AgentDefinition.
T4  Typed Skill projection matches canonical id/version/name.
T5  Skill permissions are capabilities=[] and side effects NONE.
T6  S12 metadata discovery finds S13M without loading unrelated Skills.
T7  Selected S13M Skill lazy-loads correctly.
T8  Catalog update is append-only and prior Skill descriptors are unchanged.
T9  No S13M AgentDefinition exists.
T10 No src/core S13M/qa-debugging branch exists.
T11 No new runtime dependency/package-manifest change exists.
T12 No S13N+/S14 production source is added.
```

### T13–T28 — input / total validation

```text
T13 valid canonical input passes structural validation.
T14 non-object input fails closed.
T15 unknown reproduction enum fails closed.
T16 unknown failure-class enum fails closed.
T17 unknown root-cause enum fails closed.
T18 unknown fix-kind enum fails closed.
T19 unknown suite outcome enum fails closed.
T20 missing incident identity fails closed.
T21 missing baseline revision fails closed.
T22 malformed evidence record fails closed.
T23 unresolved required evidence ref cannot support closure.
T24 duplicate/impossible candidate revision relation fails closed.
T25 malformed blocker/next-action shape fails closed.
T26 missing atomic group/leaf fails closed without TypeError.
T27 impossible status/root-cause combination fails closed.
T28 input/evidence structures remain byte/deep-equal after execution.
```

### T29–T44 — reproduction / evidence

```text
T29 matching direct baseline attempt derives REPRODUCED.
T30 wrong signature does not derive REPRODUCED.
T31 wrong baseline revision does not derive REPRODUCED.
T32 missing material environment identity prevents closure.
T33 no matching attempts derives NOT_REPRODUCED or INSUFFICIENT as appropriate.
T34 NOT_REPRODUCED never derives FIX_VERIFIED.
T35 repeated mixed outcomes with same signature derive INTERMITTENT.
T36 single green run cannot close intermittent failure.
T37 evidence refs resolve against supplied evidence records.
T38 contradictory evidence is preserved in output refs.
T39 material unresolved contradiction prevents FIX_VERIFIED.
T40 candidate evidence from different revision cannot close current candidate.
T41 current shell/runtime mismatch remains environment evidence, not code proof.
T42 source truth outranks contradictory narrative/comment.
T43 evidence minimization rejects prohibited raw secret-like payload fixture.
T44 safe evidence locators/hashes/counts are retained without raw payload.
```

### T45–T62 — root cause / classification

```text
T45 symptom alone stays non-causal.
T46 hypothesis without experiment stays HYPOTHESIS.
T47 controlled discriminating experiment can prove CODE cause.
T48 authoritative contract mismatch plus direct behavior can prove TEST cause.
T49 bounded data experiment can prove DATA cause.
T50 config delta experiment can prove CONFIGURATION cause.
T51 environment delta experiment can prove ENVIRONMENT cause.
T52 dependency identity experiment can prove DEPENDENCY cause.
T53 implementation conflict with approved contract can prove CONTRACT cause.
T54 security evidence can classify SECURITY_BOUNDARY without overriding S13L.
T55 UNKNOWN cannot be PROVEN.
T56 correlation-only evidence cannot prove cause.
T57 full-suite pass alone cannot prove cause.
T58 contradicted hypothesis can become DISPROVEN.
T59 unresolved alternative that changes fix prevents PROVEN.
T60 causal factor and hypothesis refs must resolve.
T61 failure classification is recomputed, not trusted from candidate.
T62 root-cause output retains supporting and contradicting evidence refs.
```

### T63–T78 — minimal fix / semantic and security boundary

```text
T63 no fix before PROVEN cause may reach FIX_CANDIDATE.
T64 causally aligned minimal code fix may reach FIX_CANDIDATE.
T65 unrelated refactor causes minimal-scope FAIL.
T66 cleanup/formatting churn outside required scope causes minimal-scope FAIL.
T67 dependency change without dependency cause is rejected.
T68 environment/config change without matching cause is rejected.
T69 candidate causal-factor refs must match proven cause.
T70 semantic contract change produces SEMANTIC_REAUTHOR_REQUIRED blocker.
T71 S13L BLOCKED remains blocking.
T72 S13L APPROVAL_REQUIRED is not converted to authorization.
T73 security weakening to make a test pass is rejected.
T74 safe security-preserving debugging evidence remains analyzable.
T75 candidate status FIX_CANDIDATE is recomputed, not trusted.
T76 one incident cannot smuggle unrelated second fix/failure.
T77 candidate revision/change refs must be internally consistent.
T78 fix assessment carries exact changed-surface refs.
```

### T79–T94 — regression / relevant suite

```text
T79 pre-fix regression must FAIL.
T80 pre-fix failure signature must match intended incident.
T81 post-fix regression must PASS for FIX_VERIFIED.
T82 post-fix regression must bind exact candidate revision.
T83 after-only green regression is incomplete.
T84 wrong-reason pre-fix failure is incomplete.
T85 direct regression is selected when applicable.
T86 impacted-module suite is selected for impacted module.
T87 contract-boundary suite is selected when contract boundary is affected.
T88 shared-surface change broadens required suite.
T89 required suite FAIL prevents FIX_VERIFIED.
T90 NOT_RUN is not PASS.
T91 NOT_APPLICABLE requires explicit evidence-backed reason.
T92 full-suite PASS supports safety but is not causal proof.
T93 suite results from wrong candidate are rejected.
T94 environment mismatch across suite results is explicit and closure-safe.
```

### T95–T104 — intermittent / stage boundaries

```text
T95 intermittent pre-fix counts are preserved.
T96 intermittent FIX_VERIFIED requires repeated post-fix attempts.
T97 post-fix intermittent sample must have zero matching failures for bounded closure.
T98 limitations state repeated runs do not prove impossibility of recurrence.
T99 S09 retryable metadata is preserved as metadata only.
T100 no retry/backoff/idempotency/async implementation appears.
T101 no S13N agent-eval platform appears.
T102 no S13P telemetry/observability platform appears.
T103 no S14 capability/MCP/shell/browser/network binding appears.
T104 no S13Q/S13R delivery/deployment implementation appears.
```

### T105–T114 — real runtime / anti-self-certification

```text
T105 real S12 metadata discovery is exercised.
T106 real S12 lazy load of S13M is exercised.
T107 unchanged S10 compileAgentDefinition path is exercised.
T108 unchanged S09 runAgent path is exercised.
T109 deterministic provider returns candidate through real runtime.
T110 corrupt parseable candidate marker/leaf reaches validator.
T111 actual corrupt candidate is not replaced with faithful synthesized output.
T112 malformed candidate returns invalid/BLOCKED without throw.
T113 provider imports no frozen truth/evaluator/gate expected-answer helper.
T114 frozen truth imports/calls no provider/synthesizer/parser/gate/evaluator.
```

### T115–T126 — OI-A / quality / closure boundary

```text
T115 exactly 30 atomic observation IDs are exposed.
T116 every observation ID maps to one disjoint candidate leaf/family.
T117 30/30 detached one-field mutation probes change only their owned ID.
T118 observation snapshots do not alias later candidate mutation.
T119 A/B arms use same inputs/host/provider/capability-provider/parser/gate/evaluator.
T120 only materialized Skill prose differs between A/B arms.
T121 grouped per-assertion improvement contributions are exposed for every dimension.
T122 max single-assertion share is computed as max(group contribution)/dimension delta.
T123 at least five dimensions qualify with >=2 contributing IDs and share <=0.50.
T124 no hard-invariant regression and all eight unsafe counters are zero.
T125 focused/typecheck/full pre-build/genuine clean build/full post-build evidence is recorded honestly.
T126 S13M remains open until a different fresh non-authoring non-fork read-only verifier PASS is accepted; S13N remains forbidden.
```

## 37. Allowed Part B implementation scope

Allowed:

```text
src/intelligence/qa-debugging/**
src/intelligence/skills/definitions/qaDebuggingS13M.ts
append-only src/intelligence/skills/index.ts registration
tests/qa-debugging/**
brain-bootstrap/reports/S13M-qa-debugging-verification.md
brain/context/handoffs/*s13m*
brain-bootstrap/STATE.yaml
brain/context/CURRENT.md
strictly mechanical prior-test catalog-length/future-step relaxations required by append-only S13M registration
```

Test-only deterministic providers/oracles belong under `tests/qa-debugging/**`.

## 38. Forbidden Part B scope

Forbidden unless a later separately authorized gate says otherwise:

```text
src/core/**
src/providers/**
new AgentDefinition
package.json/package-lock.json changes
new runtime dependency
shell/browser/network capability
Capability Registry/MCP/connector
retry/backoff/idempotency/async job engine
telemetry/tracing/observability platform
agent-eval/golden-case platform
deployment/delivery system
S13N/S13O/S13P/S13Q/S13R/S14 implementation
silent semantic edits to earlier canonical Part A/contracts
```

## 39. Part B implementation shape

The mechanical implementation may create provider-neutral/pure modules such as:

```text
types
input validation
evidence indexing/resolution
reproduction derivation
root-cause assessment
minimal-fix assessment
relevant-suite derivation
candidate parser/validator/gate
decision materializer
atomic observation extractor
Skill-vs-no-Skill comparator
```

Names are implementation details unless fixed by existing repository conventions.

Production source must not execute external commands, mutate repository files, or introduce persistent handles.

## 40. Verification report requirements

The S13M builder report must distinguish:

```text
builder-reported execution
source/static evidence
independently reproduced evidence
```

It must include:

- Part A transfer provenance and hashes;
- Part-A-only integration commit;
- implementation commit;
- exact runtime actually used;
- typecheck/focused/full pre-build/build/full post-build counts;
- 8 positive scenario outcomes;
- all 36 named negative outcomes;
- actual-candidate anti-substitution evidence;
- 30/30 isolation evidence;
- raw OI-A grouped contributions and qualification;
- hard-invariant totals;
- all eight unsafe counters;
- input-immutability proof;
- boundary diff/audit;
- remaining limitations;
- exact independent-verifier target.

Do not claim a runtime command was independently executed when only builder evidence exists.

## 41. Independent verifier requirements

Before S13M can close, a different fresh non-authoring, non-fork, read-only verifier must:

- reconstruct authority from repository truth;
- verify Part A hashes/immutability;
- inspect implementation boundaries;
- independently exercise adversarial reproduction/root-cause/fix/regression/suite cases;
- reproduce the real S12→S10→S09 path and anti-substitution check;
- reproduce exactly 30 atomic isolation probes;
- recompute OI-A and unsafe counters;
- run required deterministic QA in the repository-required runtime;
- keep tracked state unchanged;
- return evidence-backed `PASS`, `FAIL`, or `BLOCKED`.

If ChatGPT cannot execute the runtime itself, its source review may request this fresh executable verifier rather than claiming execution.

## 42. Semantic-failure policy

If implementation/evaluation exposes a contradiction in these canonical S13M semantics:

```text
STOP
→ classify as semantic
→ return to ChatGPT Authoring Gate
→ author corrected Part A on a new temporary branch/file
```

The builder must not silently rewrite canonical rules.

Mechanical defects may be repaired locally only when the fix does not alter these semantics.

## 43. Completion gate

S13M becomes `VERIFIED PASS` only when:

- Part A is unchanged and auditable;
- all required Part B deterministic/evaluation evidence passes;
- no semantic/security/future-stage boundary is violated;
- different fresh verifier returns PASS;
- control plane accepts that PASS.

Only then may S13N authoring preflight begin.
===== END FILE: brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md =====
