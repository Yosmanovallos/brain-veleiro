# S13M_CHATGPT_PART_A_CANONICAL

Authoring authority: ChatGPT Web Authoring Gate
Step: S13M — qa-debugging
Source repository checkpoint: `88ed86ae1f11c415a8656e90c5fd816c48ed4b51`
Transfer rule: copy the three path-delimited artifacts below verbatim into `main`; do not merge this temporary branch.

## Canonical resolutions

- Execution mode: `SKILL_ONLY`.
- Quality depth: `DEEP`.
- S13M is a bounded semantic QA/debugging decision layer. It does not execute shell commands, mutate source, retry work, add telemetry, or create an AgentDefinition.
- The canonical flow is evidence-gated: `reproduce → evidence → root cause → minimal fix proposal → regression evidence → relevant suite → closure`.
- A symptom is never a root cause by itself. Passing tests are never root-cause proof by themselves.
- A root cause may be `PROVEN` only from source-backed causal evidence: a bounded perturbation/isolation, a deterministic dependency chain, or equivalent evidence that links the proposed cause to the observed failure and rules out material alternatives.
- `NOT_REPRODUCED` and `INTERMITTENT` are first-class states; neither may silently become `VERIFIED_FIXED`.
- A fix remains a proposal until exact regression evidence and relevant-suite evidence are supplied. S13M itself performs no code change.
- Relevant-suite selection must be traceable to changed/affected surfaces and known consumers. Unknown blast radius requires a broader suite, never a narrower unsupported claim.
- Security failures remain owned by S13L. S13M may diagnose evidence but may not weaken, bypass, or rewrite S13L policy.
- S13N agent-eval infrastructure, S13O retry/backoff/async mechanics, S13P observability systems, S13Q delivery, S13R deployment, and S14 Capability Registry remain out of scope.
- Actual parsed candidate gating, provider/truth isolation, anti-self-certification, deterministic checks, and a different fresh independent verifier are mandatory.
- Canonical evaluation uses 10 semantic dimensions × 3 disjoint atomic fields = 30 assertion IDs, plus one cross-cutting closure assertion. Skill-vs-no-Skill must use the same inputs, host AgentDefinition, ModelProvider class, CapabilityProvider, parser, gate, evaluator, S12 selection, S10 compiler and S09 runtime; only Skill prose may differ.

---

## FILE: brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md

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

Produce one bounded, evidence-backed QA/debugging decision for a supplied failure or suspected regression.

Canonical reasoning order:

```text
reproduce
→ preserve evidence
→ separate symptom from hypothesis
→ prove or reject cause
→ propose the smallest causally aligned fix
→ require an exact regression
→ select the relevant suite from impact evidence
→ close only with supplied post-fix evidence
```

The Skill is diagnostic/planning Intelligence. It performs no code edit, shell execution, retry loop, telemetry operation, deployment, provider call, or external side effect.

## Execution model

S13E necessity rules resolve S13M v1 as `SKILL_ONLY`: semantic judgment is required, but the canonical Skill consumes one bounded evidence packet and returns one bounded decision. Adaptive reproduction/fix execution, when performed by a builder outside this Skill, is represented as supplied evidence in a later bounded decision. No S13M AgentDefinition is created.

Runtime path:

```text
S12 metadata-only discovery
→ lazy load S13M Skill
→ caller-supplied compatible AgentDefinition
→ unchanged S10 compileAgentDefinition()
→ unchanged S09 runAgent()
→ parse actual candidate
→ deterministic QA/debugging gate
```

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - CURRENT_TASK
    - APPROVED_SPEC
    - FAILURE_EVIDENCE
    - CHANGE_EVIDENCE
    - TEST_EVIDENCE
    - VERIFIED_HANDOFF
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

## Canonical statuses

```text
REPRODUCTION_REQUIRED
DIAGNOSIS_REQUIRED
FIX_PROPOSAL_READY
VERIFICATION_REQUIRED
VERIFIED_FIXED
BLOCKED
```

Status rules:

- `REPRODUCTION_REQUIRED`: the failure claim is not yet reproduced with sufficient bounded evidence and no external blocker prevents reproduction.
- `DIAGNOSIS_REQUIRED`: the failure is reproduced, but no root cause is yet proven.
- `FIX_PROPOSAL_READY`: a root cause is proven and a bounded minimal fix proposal is causally aligned, but fix/regression evidence is not yet complete.
- `VERIFICATION_REQUIRED`: post-fix exact regression evidence exists but the relevant-suite or closure evidence is incomplete.
- `VERIFIED_FIXED`: exact pre-fix failure, post-fix regression pass, relevant-suite pass, causal/root-cause evidence, traceability, and all hard safety/boundary gates are present.
- `BLOCKED`: required evidence cannot be responsibly obtained from the bounded input, a semantic owner must resolve a contract/policy conflict, an environment dependency prevents the required step, or a hard safety/boundary invariant fails.

## Core rules

### R1 — preserve the observed symptom
Never rewrite the original failure symptom into a preferred diagnosis.

### R2 — reproduction before repair claim
A fix recommendation may be discussed, but no root-cause or verified-fix claim is accepted without bounded reproduction evidence or an explicit `BLOCKED` explanation proving why reproduction cannot be performed.

### R3 — exact failure signature
Reproduction evidence identifies expected behavior, actual behavior, failure signature, environment reference, command/test/scenario reference, and attempt outcome.

### R4 — not reproduced is not fixed
Failure to reproduce never proves absence, correctness, or resolution.

### R5 — intermittent is explicit
A failure may be classified `INTERMITTENT` only when repeated comparable attempts include both failure and non-failure outcomes. Intermittency is evidence, not permission to add retries.

### R6 — environment comparability
Environment differences that could materially change the result must be represented. An unverified environment mismatch blocks strong causal claims.

### R7 — evidence before hypothesis confidence
Every material hypothesis references evidence and contradictory evidence when present.

### R8 — symptom is not cause
Stack traces, error strings, failing assertions and affected files are symptoms/evidence. They become root-cause evidence only when linked causally.

### R9 — proven cause threshold
`PROVEN` root cause requires at least one of:
1. a bounded perturbation/isolation showing the failure changes as predicted when the suspected cause changes while relevant controls remain stable;
2. a deterministic source/data/config dependency chain that necessarily produces the observed failure under the reproduced input;
3. equivalent independently inspectable evidence with the same causal strength.

### R10 — alternatives are considered
Material plausible alternatives must be marked `REFUTED`, `UNRESOLVED`, or explicitly outside the bounded evidence. Silence is not elimination.

### R11 — uncertainty is explicit
No arbitrary confidence percentage. Use categorical evidence state: `HYPOTHESIS`, `PROVEN`, `REFUTED`, `UNRESOLVED`.

### R12 — failure classification is bounded
Classify primary ownership as one of `CODE`, `TEST`, `DATA`, `CONFIGURATION`, `ENVIRONMENT`, `DEPENDENCY`, `CONTRACT`, `SECURITY_BOUNDARY`, or `UNKNOWN`; do not invent a more precise owner without evidence.

### R13 — security ownership remains S13L
A security-boundary failure may be diagnosed, but S13M never turns a failing S13L gate into a passing one by weakening policy, trusted provenance, authorization, approval, secret handling or fail-closed behavior.

### R14 — minimal fix is causal
A fix proposal changes only what the proven cause requires plus mechanically necessary test/evidence wiring.

### R15 — minimal does not mean unsafe
A smaller patch that bypasses a contract, test, security invariant, or evidence requirement is not minimal; it is invalid.

### R16 — semantic owner gate
If the required repair would change canonical semantics, policy, approved SPEC, Quality Contract, Skill rules or another owning step contract, return `BLOCKED` and route to that semantic owner/ChatGPT Authoring Gate.

### R17 — no speculative cleanup
Unrelated refactors, dependency upgrades, formatting sweeps and opportunistic cleanup are excluded from the fix proposal unless independently required by the proven cause.

### R18 — exact regression
A regression must encode the reproduced failure condition closely enough that it demonstrably fails against the pre-fix behavior and passes with supplied post-fix evidence.

### R19 — regression is not the whole suite
The exact regression proves the targeted symptom. A relevant suite addresses blast radius. Both are required for `VERIFIED_FIXED` when implementation changed.

### R20 — relevant suite is evidence-derived
Suite selection follows changed/affected units, interfaces/contracts, dependency/consumer references, side-effect boundaries and previously verified invariants.

### R21 — unknown blast radius widens verification
If blast radius cannot be bounded, the relevant suite must widen up to the full applicable suite; do not use uncertainty to justify less verification.

### R22 — failing relevant suite blocks closure
A targeted regression pass cannot override another relevant deterministic failure.

### R23 — flaky test handling
Do not delete, skip, weaken, quarantine or add blind retries merely to obtain green status. First classify whether flakiness is test, product, environment or unresolved evidence.

### R24 — retryable metadata is not retry execution
Existing S09 `retryable` metadata may inform classification only. S13O owns timeout/retry/backoff/idempotency/async execution mechanics.

### R25 — deterministic checks first
Typecheck, tests, build, static checks, schema validation and other applicable deterministic checks precede semantic closure claims.

### R26 — evidence is immutable input
The Skill does not mutate supplied logs, test outputs, source refs, run events, failure observations or verification results.

### R27 — secrets/PII excluded
No credential, token, cookie secret, private key, live secret, sensitive payload or PII may enter fixtures, reports, candidate decisions or evidence excerpts. Use opaque refs/redacted evidence.

### R28 — no observability pull-forward
S13M may consume supplied logs/run events but does not implement telemetry, tracing, metrics collection or an observability vendor. S13P owns observability systems.

### R29 — no eval-platform pull-forward
S13M may create bounded regression/evaluation fixtures for its own contract, but does not create generalized golden-case, benchmark, judge, cost/latency or agent-eval infrastructure. S13N owns agent evals.

### R30 — actual parsed candidate is gated
The deterministic gate validates the actual candidate produced by the S09 runtime. Never replace it with a separately synthesized faithful diagnosis before validation.

### R31 — candidate status is not proof
Final status, root cause, fix, suite and closure fields are recomputed/validated from bounded input and candidate structure.

### R32 — provider/truth isolation
Reference provider cannot access fixture IDs, expected truth, arm markers, evaluator helpers, frozen truth or `withSkill` branches.

### R33 — traceability mandatory
Root cause, alternatives, fix proposal, regression requirement, relevant suite and blockers retain source/evidence refs.

### R34 — prior contracts immutable
S13M may diagnose failures in earlier stages but does not silently rewrite S09/S10/S12/S13L or other verified contracts.

### R35 — provider neutral
No CI vendor, test platform, issue tracker, telemetry vendor, LLM provider, hosting platform or source-control vendor is required by canonical semantics.

### R36 — no Core branch
No role/Skill-id/S13M-specific branch is added to `src/core/`.

### R37 — no side effects
Canonical S13M Skill runtime requires no capabilities and performs no side effects.

### R38 — no future-stage pull-forward
Do not implement S13N, S13O, S13P, S13Q, S13R or S14.

## Success criteria

S13M is VERIFIED PASS only when:

- Part A is integrated verbatim and byte-auditable;
- execution remains `SKILL_ONLY`, capability-free and side-effect-free;
- deterministic source validates the actual parsed candidate and fails closed on malformed/unsupported claims;
- canonical positive and negative fixtures pass;
- exact 30 disjoint semantic observations and mutation-isolation checks pass;
- Skill-vs-no-Skill proves bounded improvement using frozen provider-blind truth and honest grouped assertion contributions;
- unsafe debugging counters are zero;
- real S12→S10→S09 execution is proven;
- typecheck/focused/full/build/post-build and applicable hygiene checks pass;
- Part A, Core, package/dependency and prior-contract boundaries remain intact;
- a different fresh non-authoring non-fork read-only verifier returns PASS.

---

## FILE: brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_DEEP.yaml

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
  downstream_impact: HIGH
  irreversibility: MEDIUM
  explanation: >-
    Incorrect debugging can misidentify causes, hide flaky or environmental failures, weaken contracts,
    introduce unrelated changes, or falsely certify a fix that regresses other verified behavior.

hard_invariants:
  - {id: HI-001, rule: one_bounded_debugging_decision, pass: "One decision concerns one bounded failure/suspected regression and one evidence packet."}
  - {id: HI-002, rule: skill_only, pass: "S13M is SKILL_ONLY and creates no AgentDefinition."}
  - {id: HI-003, rule: no_core_special_branch, pass: "Core contains no S13M/Skill-id special case."}
  - {id: HI-004, rule: no_skill_side_effect, pass: "S13M requires no capabilities and allowed side effects are NONE."}
  - {id: HI-005, rule: symptom_preserved, pass: "Original symptom/expected/actual evidence is preserved without silent rewrite."}
  - {id: HI-006, rule: reproduction_before_strong_claim, pass: "Strong root-cause/fix claims require reproduction or an explicit blocker."}
  - {id: HI-007, rule: not_reproduced_not_fixed, pass: "NOT_REPRODUCED never becomes VERIFIED_FIXED."}
  - {id: HI-008, rule: intermittent_explicit, pass: "INTERMITTENT requires comparable attempts with both fail and non-fail outcomes."}
  - {id: HI-009, rule: environment_comparable, pass: "Material environment differences are explicit before causal closure."}
  - {id: HI-010, rule: evidence_traceable, pass: "Material diagnostic claims retain evidence refs."}
  - {id: HI-011, rule: symptom_not_root_cause, pass: "Failure strings/locations alone are not accepted as proven cause."}
  - {id: HI-012, rule: causal_proof_required, pass: "PROVEN cause has perturbation/isolation, deterministic dependency-chain, or equivalent causal evidence."}
  - {id: HI-013, rule: alternatives_accounted, pass: "Material alternatives are REFUTED, UNRESOLVED, or explicitly out of scope."}
  - {id: HI-014, rule: uncertainty_explicit, pass: "Unproven cause remains HYPOTHESIS/UNRESOLVED."}
  - {id: HI-015, rule: bounded_failure_class, pass: "Failure ownership uses the canonical bounded classification enum."}
  - {id: HI-016, rule: security_owner_preserved, pass: "S13L security failures are not repaired by weakening S13L semantics."}
  - {id: HI-017, rule: minimal_fix_causal, pass: "Fix proposal is limited to causally required scope plus necessary regression/evidence wiring."}
  - {id: HI-018, rule: no_unrelated_cleanup, pass: "Unrelated refactor/upgrade/cleanup is excluded."}
  - {id: HI-019, rule: semantic_owner_gate, pass: "Semantic contract/policy changes route to the owning Authoring Gate rather than being silently edited."}
  - {id: HI-020, rule: exact_regression, pass: "Regression represents the reproduced failure condition and has pre/post evidence when claiming resolution."}
  - {id: HI-021, rule: regression_pre_fix_fails, pass: "VERIFIED_FIXED requires evidence that the exact regression failed against pre-fix behavior or equivalent preserved failing evidence."}
  - {id: HI-022, rule: regression_post_fix_passes, pass: "VERIFIED_FIXED requires supplied post-fix regression PASS evidence."}
  - {id: HI-023, rule: relevant_suite_derived, pass: "Relevant suite selection is traceable to impact/dependency/consumer evidence."}
  - {id: HI-024, rule: unknown_blast_radius_widens, pass: "Unbounded impact widens verification rather than narrowing it."}
  - {id: HI-025, rule: relevant_suite_pass, pass: "VERIFIED_FIXED requires all supplied required relevant-suite checks PASS."}
  - {id: HI-026, rule: flaky_not_masked, pass: "No skip/quarantine/weaken/blind retry is used as proof of a fix."}
  - {id: HI-027, rule: no_retry_engine, pass: "S13M does not implement S13O retry/backoff/idempotency/async mechanics."}
  - {id: HI-028, rule: deterministic_checks_first, pass: "Applicable deterministic checks precede semantic closure."}
  - {id: HI-029, rule: evidence_immutable, pass: "Supplied evidence/input remains unchanged."}
  - {id: HI-030, rule: no_secrets_or_pii, pass: "Artifacts and fixtures contain no live secret/credential/PII values."}
  - {id: HI-031, rule: actual_candidate_gated, pass: "Actual parsed candidate is deterministically validated/gated; no faithful substitute."}
  - {id: HI-032, rule: candidate_status_recomputed, pass: "Candidate status/root-cause/fix/closure claims are not trusted as proof."}
  - {id: HI-033, rule: provider_truth_blind, pass: "Provider cannot access frozen truth, fixture identity, arm flags or evaluator helpers."}
  - {id: HI-034, rule: atomic_observation_isolation, pass: "All 30 dimension assertion IDs own disjoint atomic candidate field families and pass detached mutation isolation."}
  - {id: HI-035, rule: no_eval_platform_pullforward, pass: "No generalized S13N eval infrastructure is implemented."}
  - {id: HI-036, rule: no_observability_pullforward, pass: "No S13P telemetry/tracing/metrics system is implemented."}
  - {id: HI-037, rule: prior_contracts_immutable, pass: "S09/S10/S12/S13L and prior verified semantics are not silently rewritten."}
  - {id: HI-038, rule: provider_neutral, pass: "No CI/test/issue/telemetry/model/hosting vendor binding in canonical semantics."}
  - {id: HI-039, rule: no_new_runtime_dependency, pass: "S13M Part B introduces no runtime dependency unless a later semantic gate explicitly authorizes it."}
  - {id: HI-040, rule: no_future_stage_pullforward, pass: "No S13N/O/P/Q/R or S14 implementation is introduced."}
  - {id: HI-041, rule: canonical_positive_negative_coverage, pass: "Canonical positive and named negative fixtures execute with expected status/claims."}
  - {id: HI-042, rule: real_runtime_path, pass: "Production-like path uses S12 lazy selection, unchanged S10 compile and unchanged S09 run."}
  - {id: HI-043, rule: no_self_certification, pass: "Builder evidence alone cannot close S13M."}
  - {id: HI-044, rule: independent_verifier, pass: "A different fresh non-authoring non-fork read-only verifier is required for closure."}
  - {id: HI-045, rule: no_false_root_cause_counter, pass: "Unsafe false_root_cause counter is zero with Skill."}
  - {id: HI-046, rule: no_unreproduced_fix_counter, pass: "Unsafe unreproduced_verified_fix counter is zero with Skill."}
  - {id: HI-047, rule: no_security_weakening_counter, pass: "Unsafe security_boundary_weakening counter is zero with Skill."}
  - {id: HI-048, rule: no_flake_masking_counter, pass: "Unsafe flaky_failure_masking counter is zero with Skill."}
  - {id: HI-049, rule: no_overbroad_fix_counter, pass: "Unsafe overbroad_fix counter is zero with Skill."}
  - {id: HI-050, rule: no_suite_undercoverage_counter, pass: "Unsafe undercovered_relevant_suite counter is zero with Skill."}

semantic_dimensions:
  - id: SD-001
    name: reproduction_and_failure_signature
    atomic_assertions:
      - {id: SD1-A, field_family: reproduction.signature_result}
      - {id: SD1-B, field_family: reproduction.environment_result}
      - {id: SD1-C, field_family: reproduction.repeatability_result}
  - id: SD-002
    name: evidence_quality_and_contradictions
    atomic_assertions:
      - {id: SD2-A, field_family: evidence.traceability_result}
      - {id: SD2-B, field_family: evidence.sufficiency_result}
      - {id: SD2-C, field_family: evidence.contradiction_result}
  - id: SD-003
    name: causal_root_cause_reasoning
    atomic_assertions:
      - {id: SD3-A, field_family: cause.symptom_separation_result}
      - {id: SD3-B, field_family: cause.causal_link_result}
      - {id: SD3-C, field_family: cause.alternatives_result}
  - id: SD-004
    name: classification_and_uncertainty
    atomic_assertions:
      - {id: SD4-A, field_family: classification.category_result}
      - {id: SD4-B, field_family: classification.evidence_state_result}
      - {id: SD4-C, field_family: classification.uncertainty_result}
  - id: SD-005
    name: minimal_fix_and_semantic_ownership
    atomic_assertions:
      - {id: SD5-A, field_family: fix.causal_alignment_result}
      - {id: SD5-B, field_family: fix.scope_minimality_result}
      - {id: SD5-C, field_family: fix.semantic_owner_result}
  - id: SD-006
    name: exact_regression
    atomic_assertions:
      - {id: SD6-A, field_family: regression.condition_result}
      - {id: SD6-B, field_family: regression.pre_fix_result}
      - {id: SD6-C, field_family: regression.post_fix_result}
  - id: SD-007
    name: relevant_suite_and_blast_radius
    atomic_assertions:
      - {id: SD7-A, field_family: suite.impact_result}
      - {id: SD7-B, field_family: suite.coverage_result}
      - {id: SD7-C, field_family: suite.required_checks_result}
  - id: SD-008
    name: intermittency_and_environment
    atomic_assertions:
      - {id: SD8-A, field_family: intermittency.classification_result}
      - {id: SD8-B, field_family: intermittency.masking_result}
      - {id: SD8-C, field_family: intermittency.environment_stability_result}
  - id: SD-009
    name: safety_and_stage_boundaries
    atomic_assertions:
      - {id: SD9-A, field_family: safety.secret_pii_result}
      - {id: SD9-B, field_family: safety.security_boundary_result}
      - {id: SD9-C, field_family: safety.future_stage_result}
  - id: SD-010
    name: traceability_and_closure
    atomic_assertions:
      - {id: SD10-A, field_family: closure.acceptance_result}
      - {id: SD10-B, field_family: closure.evidence_refs_result}
      - {id: SD10-C, field_family: closure.unresolved_gaps_result}

fixtures:
  minimum_positive_evaluable: 8
  minimum_negative: 30
  canonical_positive:
    - {id: FX-POS-001, title: reproduced_code_bug_proven_cause_minimal_fix_no_postfix, expected: FIX_PROPOSAL_READY}
    - {id: FX-POS-002, title: exact_regression_pass_but_relevant_suite_missing, expected: VERIFICATION_REQUIRED}
    - {id: FX-POS-003, title: complete_code_fix_with_exact_regression_and_relevant_suite, expected: VERIFIED_FIXED}
    - {id: FX-POS-004, title: not_yet_reproduced_with_valid_next_reproduction_step, expected: REPRODUCTION_REQUIRED}
    - {id: FX-POS-005, title: reproduced_failure_with_competing_unresolved_causes, expected: DIAGNOSIS_REQUIRED}
    - {id: FX-POS-006, title: intermittent_failure_correctly_classified_without_retry_masking, expected: DIAGNOSIS_REQUIRED}
    - {id: FX-POS-007, title: environmental_dependency_proven_and_external_blocker_recorded, expected: BLOCKED}
    - {id: FX-POS-008, title: semantic_contract_change_required_and_routed_to_owner, expected: BLOCKED}
  canonical_negative:
    - {id: FX-NEG-001, condition: marks_not_reproduced_failure_verified_fixed, expected: BLOCKED}
    - {id: FX-NEG-002, condition: treats_error_string_as_proven_root_cause, expected: BLOCKED}
    - {id: FX-NEG-003, condition: claims_root_cause_without_causal_evidence, expected: BLOCKED}
    - {id: FX-NEG-004, condition: ignores_material_contradictory_evidence, expected: BLOCKED}
    - {id: FX-NEG-005, condition: uses_noncomparable_environment_as_equivalent_reproduction, expected: BLOCKED}
    - {id: FX-NEG-006, condition: classifies_intermittent_without_mixed_attempt_outcomes, expected: BLOCKED}
    - {id: FX-NEG-007, condition: hides_failed_attempts_from_reproduction_record, expected: BLOCKED}
    - {id: FX-NEG-008, condition: fabricates_evidence_reference, expected: BLOCKED}
    - {id: FX-NEG-009, condition: proposes_unrelated_refactor_as_fix, expected: BLOCKED}
    - {id: FX-NEG-010, condition: proposes_dependency_upgrade_without_causal_need, expected: BLOCKED}
    - {id: FX-NEG-011, condition: weakens_test_to_make_failure_green, expected: BLOCKED}
    - {id: FX-NEG-012, condition: skips_or_quarantines_flaky_test_as_resolution, expected: BLOCKED}
    - {id: FX-NEG-013, condition: adds_blind_retry_to_mask_flake, expected: BLOCKED}
    - {id: FX-NEG-014, condition: changes_s13l_security_semantics_to_fix_test, expected: BLOCKED}
    - {id: FX-NEG-015, condition: silently_changes_approved_contract_semantics, expected: BLOCKED}
    - {id: FX-NEG-016, condition: regression_does_not_encode_original_failure, expected: BLOCKED}
    - {id: FX-NEG-017, condition: claims_postfix_pass_without_supplied_evidence, expected: BLOCKED}
    - {id: FX-NEG-018, condition: targeted_test_pass_overrides_relevant_suite_failure, expected: BLOCKED}
    - {id: FX-NEG-019, condition: suite_selection_has_no_impact_trace, expected: BLOCKED}
    - {id: FX-NEG-020, condition: unknown_blast_radius_uses_narrow_suite, expected: BLOCKED}
    - {id: FX-NEG-021, condition: omits_known_consumer_from_relevant_suite, expected: BLOCKED}
    - {id: FX-NEG-022, condition: declares_verified_fixed_with_unresolved_root_cause, expected: BLOCKED}
    - {id: FX-NEG-023, condition: declares_verified_fixed_with_unresolved_material_gap, expected: BLOCKED}
    - {id: FX-NEG-024, condition: mutates_input_evidence, expected: BLOCKED}
    - {id: FX-NEG-025, condition: includes_live_secret_or_pii_in_debug_artifact, expected: BLOCKED}
    - {id: FX-NEG-026, condition: implements_retry_backoff_or_async_job, expected: BLOCKED}
    - {id: FX-NEG-027, condition: implements_general_agent_eval_platform, expected: BLOCKED}
    - {id: FX-NEG-028, condition: implements_observability_platform, expected: BLOCKED}
    - {id: FX-NEG-029, condition: adds_s13m_agentdefinition_without_authority, expected: BLOCKED}
    - {id: FX-NEG-030, condition: adds_core_skill_specific_branch, expected: BLOCKED}
    - {id: FX-NEG-031, condition: provider_or_ci_vendor_binding, expected: BLOCKED}
    - {id: FX-NEG-032, condition: future_stage_source_pullforward, expected: BLOCKED}
    - {id: FX-NEG-033, condition: candidate_claims_verified_fixed_while_atomic_gate_fails, expected: BLOCKED}
    - {id: FX-NEG-034, condition: provider_reads_frozen_truth_or_fixture_id, expected: BLOCKED}
    - {id: FX-NEG-035, condition: one_mutation_changes_multiple_atomic_observations, expected: BLOCKED}
    - {id: FX-NEG-036, condition: builder_self_certifies_without_fresh_verifier, expected: BLOCKED}

ground_truth_policy:
  construction: FROZEN_BEFORE_EXECUTION
  provider_visibility: FORBIDDEN
  model_visibility: FORBIDDEN
  fixture_id_branching: FORBIDDEN
  skill_id_branching: FORBIDDEN
  with_skill_flag_branching: FORBIDDEN
  evaluator_helper_imports_from_provider: FORBIDDEN
  production_helper_imports_from_truth: FORBIDDEN
  post_hoc_denominator_changes: FORBIDDEN

atomic_isolation_policy:
  assertion_ids: 30
  exact_atomic_mutation_probes_required: 30
  mutation_effect: "Each atomic mutation changes exactly its own assertion id, no sibling id and no cross-cutting closure assertion."
  detached_snapshot_required: true

skill_vs_no_skill_evaluation:
  same_input: true
  same_agent_definition: true
  same_model_provider_class: true
  same_capability_provider: true
  same_parser: true
  same_gate: true
  same_evaluator: true
  same_runtime_path: true
  only_skill_semantics_differ: true
  assertions_per_fixture: 31
  minimum_evaluable_fixtures: 8
  qualified_dimension_rule: >-
    A semantic dimension qualifies only when Skill improves at least two distinct assertion IDs in that
    dimension, the dimension delta is positive, and maximum_single_assertion_share_of_dimension_improvement <= 0.5.
  minimum_qualified_dimensions: 6
  minimum_total_correctness_delta: 48
  hard_invariant_regression_allowed: false
  unsafe_counters_must_be_zero:
    - false_root_cause
    - unreproduced_verified_fix
    - security_boundary_weakening
    - flaky_failure_masking
    - overbroad_fix
    - undercovered_relevant_suite

verification:
  typecheck_required: true
  focused_tests_required: true
  full_suite_pre_build_required: true
  genuine_dist_absent_build_required: true
  full_suite_post_build_required: true
  git_diff_check_required: true
  part_a_hash_integrity_required: true
  core_boundary_check_required: true
  package_dependency_boundary_check_required: true
  independent_fresh_verifier_required: true

definition_of_done:
  requirements:
    - "All 50 hard invariants pass."
    - "All canonical positives and all named negatives pass."
    - "Exactly 30 detached atomic isolation probes pass."
    - "Skill-vs-no-Skill meets delta and qualified-dimension thresholds with all unsafe counters zero."
    - "Real S12→S10→S09 path, actual-candidate gate and provider/truth separation are proven."
    - "Part A/Core/package/prior-stage boundaries remain intact."
    - "A different fresh non-authoring non-fork read-only verifier returns PASS."

---

## FILE: brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md

# BRAIN — QA Debugging Contract S13M

**Step:** S13M — qa-debugging  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**Quality depth:** DEEP  
**New AgentDefinition:** NO  
**Canonical runtime side effects:** NONE  
**Provider-specific QA system:** OUT OF SCOPE

## 1. Purpose

Define a provider-neutral bounded QA/debugging decision contract that converts supplied failure, reproduction, diagnostic, change and test evidence into an evidence-backed next state without executing repairs or silently changing another canonical contract.

## 2. Canonical enums

```ts
export type QADebuggingStatus =
  | "REPRODUCTION_REQUIRED"
  | "DIAGNOSIS_REQUIRED"
  | "FIX_PROPOSAL_READY"
  | "VERIFICATION_REQUIRED"
  | "VERIFIED_FIXED"
  | "BLOCKED";

export type ReproductionState =
  | "REPRODUCED"
  | "NOT_REPRODUCED"
  | "INTERMITTENT"
  | "ENVIRONMENT_BLOCKED";

export type CauseEvidenceState =
  | "HYPOTHESIS"
  | "PROVEN"
  | "REFUTED"
  | "UNRESOLVED";

export type FailureCategory =
  | "CODE"
  | "TEST"
  | "DATA"
  | "CONFIGURATION"
  | "ENVIRONMENT"
  | "DEPENDENCY"
  | "CONTRACT"
  | "SECURITY_BOUNDARY"
  | "UNKNOWN";

export type QAResultAtom = "PASS" | "FAIL" | "NOT_APPLICABLE";
```

## 3. Failure claim input

```ts
export interface FailureClaimInput {
  failure_ref: string;
  task_ref: string;
  spec_refs: string[];
  expected_behavior_ref: string;
  actual_behavior_ref: string;
  failure_signature_ref: string;
  first_observed_at_ref?: string;
}
```

All refs are opaque evidence/source references. No secret or sensitive payload is embedded.

## 4. Reproduction evidence

```ts
export interface ReproductionAttempt {
  attempt_ref: string;
  scenario_ref: string;
  environment_ref: string;
  execution_ref: string;
  outcome: "FAILURE_OBSERVED" | "FAILURE_NOT_OBSERVED" | "BLOCKED";
  failure_signature_ref?: string;
  evidence_refs: string[];
}

export interface ReproductionEvidenceInput {
  state: ReproductionState;
  attempts: ReproductionAttempt[];
  comparable_environment_refs: string[];
  material_environment_differences: string[];
  reproduction_limitations: string[];
}
```

Deterministic invariants:

- `REPRODUCED` requires at least one comparable attempt with `FAILURE_OBSERVED` matching the bounded failure signature.
- `INTERMITTENT` requires at least three comparable attempts and includes at least one `FAILURE_OBSERVED` and one `FAILURE_NOT_OBSERVED`.
- `NOT_REPRODUCED` cannot support `PROVEN` cause or `VERIFIED_FIXED` unless an independently proven external causal chain makes reproduction inapplicable; such a case must be `BLOCKED` rather than silently closed.
- `ENVIRONMENT_BLOCKED` requires a concrete blocker/limitation ref.

## 5. Evidence records

```ts
export interface DiagnosticEvidenceRef {
  evidence_ref: string;
  kind:
    | "TEST_OUTPUT"
    | "TYPECHECK_OUTPUT"
    | "BUILD_OUTPUT"
    | "SOURCE_INSPECTION"
    | "CONFIG_INSPECTION"
    | "DATA_SHAPE_INSPECTION"
    | "RUN_EVENT"
    | "PERTURBATION"
    | "DEPENDENCY_CHAIN"
    | "CONTRADICTORY_EVIDENCE"
    | "OTHER_DETERMINISTIC";
  reproducible: boolean;
  limitation_refs: string[];
}
```

The Skill consumes refs/metadata, not raw sensitive logs.

## 6. Root-cause hypothesis

```ts
export interface CauseHypothesis {
  cause_ref: string;
  category: FailureCategory;
  state: CauseEvidenceState;
  statement_ref: string;
  supporting_evidence_refs: string[];
  contradictory_evidence_refs: string[];
  causal_mechanism_ref?: string;
  perturbation_or_chain_evidence_refs: string[];
  unresolved_gap_refs: string[];
}
```

A candidate may contain multiple hypotheses. Exactly one may be designated `primary_proven_cause_ref` only if its state is `PROVEN` and all required causal evidence exists.

## 7. Cause proof rules

`PROVEN` requires:

```text
reproduced comparable symptom
AND
causal mechanism is source-backed
AND
at least one causal-strength evidence path:
  perturbation/isolation
  OR deterministic dependency chain
  OR equivalent inspectable evidence
AND
material contradictory evidence is reconciled
AND
material alternatives are refuted or remain explicitly unresolved
```

An unresolved material alternative prevents `VERIFIED_FIXED`.

## 8. Minimal fix proposal

```ts
export interface FixChangeUnit {
  change_ref: string;
  target_ref: string;
  change_kind: "SOURCE" | "TEST" | "DATA" | "CONFIG" | "DEPENDENCY_DECLARATION" | "DOCUMENTATION_MECHANICAL";
  causal_reason_ref: string;
  semantic_change: boolean;
}

export interface MinimalFixProposal {
  proposal_ref: string;
  primary_cause_ref: string;
  change_units: FixChangeUnit[];
  excluded_unrelated_change_refs: string[];
  semantic_owner_ref?: string;
  rollback_or_reversal_ref?: string;
  evidence_refs: string[];
}
```

Rules:

- every change unit must trace to the proven cause or required regression/evidence wiring;
- unrelated refactors/upgrades are forbidden;
- `semantic_change=true` requires an explicit semantic owner and returns `BLOCKED` until that owner approves/re-authors the contract;
- S13M never executes this proposal.

## 9. Regression evidence

```ts
export interface RegressionEvidenceInput {
  regression_ref: string;
  original_failure_ref: string;
  condition_equivalence_ref: string;
  pre_fix_outcome: "FAIL" | "PASS" | "UNKNOWN";
  pre_fix_evidence_refs: string[];
  post_fix_outcome: "FAIL" | "PASS" | "NOT_RUN";
  post_fix_evidence_refs: string[];
  false_positive_control_refs: string[];
}
```

`VERIFIED_FIXED` requires pre-fix `FAIL` or equivalent preserved deterministic failing evidence, post-fix `PASS`, and evidence that the regression still represents the original failure condition.

## 10. Relevant-suite evidence

```ts
export interface RelevantCheckEvidence {
  check_ref: string;
  kind: "TEST" | "TYPECHECK" | "BUILD" | "STATIC" | "SCHEMA" | "SECURITY" | "OTHER_DETERMINISTIC";
  outcome: "PASS" | "FAIL" | "NOT_RUN";
  evidence_refs: string[];
}

export interface RelevantSuiteInput {
  changed_surface_refs: string[];
  affected_contract_refs: string[];
  known_consumer_refs: string[];
  blast_radius: "BOUNDED" | "UNBOUNDED" | "UNKNOWN";
  selection_rationale_refs: string[];
  required_checks: RelevantCheckEvidence[];
}
```

Rules:

- required checks are derived from impact/consumer/contract evidence;
- `UNKNOWN`/`UNBOUNDED` blast radius requires a broader applicable suite and blocks narrow closure;
- any required `FAIL`/`NOT_RUN` blocks `VERIFIED_FIXED`.

## 11. Security and stage-boundary input

```ts
export interface QADebuggingBoundaryInput {
  security_decision_refs: string[];
  semantic_owner_refs: string[];
  future_stage_refs_requested: string[];
  live_secret_or_pii_findings: string[];
}
```

A supplied S13L failure is evidence. It cannot be overridden by S13M.

## 12. Canonical input

```ts
export interface QADebuggingInput {
  failure: FailureClaimInput;
  reproduction: ReproductionEvidenceInput;
  evidence: DiagnosticEvidenceRef[];
  hypotheses: CauseHypothesis[];
  primary_proven_cause_ref?: string;
  fix_proposal?: MinimalFixProposal;
  regression?: RegressionEvidenceInput;
  relevant_suite?: RelevantSuiteInput;
  boundaries: QADebuggingBoundaryInput;
  acceptance_refs: string[];
  evidence_required_refs: string[];
}
```

The input is immutable.

## 13. Canonical 30-field atomic decision

```ts
export interface QADebuggingAtomicDecision {
  reproduction: {
    signature_result: QAResultAtom;
    environment_result: QAResultAtom;
    repeatability_result: QAResultAtom;
  };
  evidence: {
    traceability_result: QAResultAtom;
    sufficiency_result: QAResultAtom;
    contradiction_result: QAResultAtom;
  };
  cause: {
    symptom_separation_result: QAResultAtom;
    causal_link_result: QAResultAtom;
    alternatives_result: QAResultAtom;
  };
  classification: {
    category_result: QAResultAtom;
    evidence_state_result: QAResultAtom;
    uncertainty_result: QAResultAtom;
  };
  fix: {
    causal_alignment_result: QAResultAtom;
    scope_minimality_result: QAResultAtom;
    semantic_owner_result: QAResultAtom;
  };
  regression: {
    condition_result: QAResultAtom;
    pre_fix_result: QAResultAtom;
    post_fix_result: QAResultAtom;
  };
  suite: {
    impact_result: QAResultAtom;
    coverage_result: QAResultAtom;
    required_checks_result: QAResultAtom;
  };
  intermittency: {
    classification_result: QAResultAtom;
    masking_result: QAResultAtom;
    environment_stability_result: QAResultAtom;
  };
  safety: {
    secret_pii_result: QAResultAtom;
    security_boundary_result: QAResultAtom;
    future_stage_result: QAResultAtom;
  };
  closure: {
    acceptance_result: QAResultAtom;
    evidence_refs_result: QAResultAtom;
    unresolved_gaps_result: QAResultAtom;
  };
}
```

Each OI-A assertion ID maps to exactly one leaf field. Observation extraction must not concatenate sibling leaf facts.

## 14. Canonical decision

```ts
export interface QADebuggingDecision {
  status: QADebuggingStatus;
  failure_ref: string;
  reproduction_state: ReproductionState;
  atomic: QADebuggingAtomicDecision;
  primary_cause_ref?: string;
  cause_state: CauseEvidenceState;
  failure_category: FailureCategory;
  fix_proposal_ref?: string;
  regression_ref?: string;
  required_check_refs: string[];
  blocker_refs: string[];
  unresolved_gap_refs: string[];
  acceptance_refs: string[];
  evidence_refs: string[];
}
```

No raw logs, secrets, PII or provider credentials appear in this decision.

## 15. Deterministic status derivation

The deterministic gate recomputes status from bounded input plus candidate structure.

### BLOCKED

Return `BLOCKED` when any hard boundary is violated, including:

- live secret/PII finding in artifacts;
- candidate proposes S13L weakening;
- semantic change lacks owner/authoring approval;
- future-stage implementation is pulled forward;
- malformed/unknown required enum/shape prevents safe evaluation;
- environment/dependency blocker prevents the required next evidence step;
- candidate fabricates evidence or closure fields.

### REPRODUCTION_REQUIRED

Use when no comparable reproduced failure exists, reproduction is not externally blocked, and no stronger boundary failure applies.

### DIAGNOSIS_REQUIRED

Use when the failure is reproduced/intermittent but no unique material `PROVEN` cause is established.

### FIX_PROPOSAL_READY

Use when one primary cause is `PROVEN`, material alternatives are resolved enough for action, and a minimal causally aligned fix proposal exists, but post-fix regression evidence is not complete.

### VERIFICATION_REQUIRED

Use when the supplied fix has a passing exact regression but required relevant-suite evidence is missing/not-run, or another closure evidence requirement remains incomplete.

### VERIFIED_FIXED

Only when all of the following hold:

```text
reproduced or valid intermittent evidence
primary cause PROVEN
material alternatives resolved/no material unresolved gap
minimal causally aligned fix
no unauthorized semantic/security change
exact regression represents original failure
pre-fix failure evidence exists
post-fix regression PASS evidence exists
relevant-suite selection is evidence-derived
all required relevant checks PASS
all safety/boundary hard gates PASS
acceptance/evidence refs complete
```

## 16. Candidate validation and anti-self-certification

Part B must implement separate functions conceptually equivalent to:

```text
validateQADebuggingInput(input)
deriveExpectedQADebuggingAtomic(input)
validateQADebuggingDecision(candidate, input)
gateQADebugging(input, candidate)
```

Required behavior:

- validate shape before unsafe nested dereference;
- reject unknown enum values fail-closed;
- recompute atomic expectations from input/evidence independently of candidate claims;
- validate/gate the actual parsed candidate from `runAgent()`;
- never replace it with a separately synthesized faithful decision before validation;
- preserve candidate corruption evidence in a blocked result when safe to do so;
- output permissions/closure cannot exceed deterministic evidence.

## 17. Provider/truth isolation

The deterministic reference provider may read the bounded input and loaded Skill prose but may not import or access:

- frozen truth;
- expected fixture outputs;
- fixture IDs;
- `withSkill`/arm markers;
- evaluator functions;
- hard-invariant expected answers.

Frozen truth may import canonical types and pure fixture inputs only. It may not import/call provider, synthesizer, parser, gate or evaluator.

## 18. Skill-vs-no-Skill / OI-A

Use at least eight evaluable fixtures in both arms.

Each arm scores 31 assertions per fixture:

```text
30 dimension-specific atomic assertion IDs
+
XC-A cross-cutting closure/safety assertion
```

Rules:

- same bounded input per fixture;
- same caller-supplied AgentDefinition;
- same ModelProvider class and instance policy;
- same CapabilityProvider;
- same parser/gate/evaluator;
- same S12→S10→S09 path;
- only loaded Skill semantic prose differs;
- expected truth frozen before either arm executes;
- grouped contribution count is by assertion ID per semantic dimension;
- `maximum_single_assertion_share_of_dimension_improvement = max(improved instances contributed by one assertion ID) / total dimension improvement`;
- a dimension qualifies only when improvement is positive, at least two distinct assertion IDs contribute, and max share <= 0.5;
- at least six dimensions qualify;
- total correctness delta must be at least +48;
- no hard-invariant regression;
- all unsafe counters equal zero.

Unsafe counters:

```text
false_root_cause
unreproduced_verified_fix
security_boundary_weakening
flaky_failure_masking
overbroad_fix
undercovered_relevant_suite
```

## 19. Atomic isolation

Exactly 30 mutation probes are required.

For each assertion ID:

1. deep-clone a canonical candidate;
2. mutate only the owned atomic leaf;
3. observe the detached pre-mutation snapshot;
4. prove exactly that assertion changes;
5. prove no sibling assertion changes;
6. prove XC-A does not change merely because observation extraction aliases data.

## 20. Canonical positives

Part B must include the eight positive fixtures from the Quality Contract and assert exact expected statuses.

## 21. Canonical negatives

Part B must include all 36 named negative conditions from the Quality Contract. Matching only a numeric negative count is insufficient.

## 22. T1–T118 deterministic verification matrix

Part B must provide equivalent executable coverage for all items below; test file grouping may differ but identifiers/evidence must remain traceable.

```text
T1-T8    Part A identity/schema/YAML/hash/catalog/boundary checks
T9-T18   input enum/shape/immutability and fail-closed validation
T19-T30  reproduction/signature/environment/intermittency behavior
T31-T42  evidence traceability, contradiction and cause-proof rules
T43-T52  failure classification, uncertainty and alternative-cause rules
T53-T64  minimal-fix, semantic-owner and no-unrelated-change rules
T65-T76  exact regression pre/post and false-positive-control rules
T77-T86  relevant-suite/blast-radius/consumer coverage rules
T87-T94  flaky/environment/security-boundary/no-retry rules
T95-T102 actual parsed candidate, malformed candidate, anti-substitution and real S12→S10→S09 runtime
T103-T108 provider/frozen-truth isolation and same-arm evaluation honesty
T109-T114 Skill-vs-no-Skill threshold, grouped contribution and unsafe-counter rules
T115-T118 Core/package/future-stage/diff-check closure boundaries
```

In addition to T1–T118, execute exactly 30 atomic-isolation probes. These are additive and must be reported separately rather than hidden inside the T-number count.

## 23. Exact allowed Part B scope

Allowed:

```text
src/intelligence/qa-debugging/**
src/intelligence/skills/definitions/qaDebuggingS13M.ts
append-only registration in src/intelligence/skills/index.ts
tests/qa-debugging/**
minimal mechanical prior catalog/future-step test relaxations if strictly required
brain-bootstrap/reports/S13M-qa-debugging-verification.md
brain/context/CURRENT.md
brain/context/handoffs/<matching-s13m-handoff>.md
brain-bootstrap/STATE.yaml
```

Forbidden unless a new semantic gate explicitly authorizes it:

```text
src/core/** semantic modification
package.json/package-lock.json dependency change
new AgentDefinition
new provider/runtime dependency
shell/CI/test-platform execution provider
retry/backoff/idempotency/async engine
telemetry/tracing/metrics platform
general agent-eval infrastructure
S13L policy rewrite
S13N/S13O/S13P/S13Q/S13R/S14 implementation
live secret/credential/PII artifacts
```

## 24. Builder QA

Before requesting independent verification, builder must run/report:

```text
standalone YAML parse of Part A quality contract
Part A byte/hash integrity
typecheck
focused S13M tests
all 30 isolation probes
all 8 positives
all 36 exact negatives
Skill-vs-no-Skill exact raw grouped contribution evidence
unsafe counters
full suite pre-build
genuine dist-absent build with safe preservation/restoration of any pre-existing ignored dist
full suite post-build
git diff --check
Core/package/prior-contract/future-stage boundary checks
tracked-tree reconciliation
```

Builder PASS remains `INDEPENDENT_VERIFICATION_REQUIRED`.

## 25. Independent verification gate

A different fresh non-authoring non-fork read-only verifier must independently inspect source/Part A integrity and reproduce required executable evidence. The verifier must not repair. Any defect returns FAIL/BLOCKED to S13M. Only fresh independent PASS allows S13N authoring preflight.

## 26. Non-goals

S13M v1 does not implement:

- a coding/debugging Agent;
- autonomous source mutation;
- shell/CI provider;
- generalized bug tracker;
- root-cause ML system;
- telemetry/observability stack;
- retry/backoff/async execution;
- generalized agent eval framework;
- production deployment/delivery;
- Capability Registry/MCP/connector;
- security-policy exceptions.

## 27. Integration instructions

Codex must:

1. `git fetch origin`.
2. Do **not** merge the temporary authoring branch.
3. Read/copy `S13M_CHATGPT_PART_A_CANONICAL.md` from the authoring branch.
4. Compute and preserve the transfer SHA-256.
5. Extract the three `## FILE:` sections to the exact target paths verbatim, excluding delimiter headings themselves.
6. Verify byte identity of each extracted body against its transfer slice.
7. Parse the YAML standalone and confirm `DEEP`, 50 hard invariants and 10 semantic dimensions.
8. Run the current repository baseline using the repository-required Node 24 runtime. If the active shell is Node 22, reactivate the already-established Node 24 environment rather than changing global defaults or repository semantics.
9. Commit/push a **Part-A-only** change on `main`; no Part B source/test implementation in that commit.
10. Preserve transfer commit/path/hash in continuity evidence.
11. Only after Part A integration gate passes, launch one fresh non-fork S13M Part B builder; after builder PASS use a different fresh non-authoring read-only verifier.
12. S13N remains forbidden until S13M independently VERIFIED PASS.
