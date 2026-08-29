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
