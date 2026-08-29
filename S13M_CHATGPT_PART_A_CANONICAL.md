# S13M_CHATGPT_PART_A_CANONICAL — semantic correction v1.0.1

## Authority

This is the complete ChatGPT Authoring Gate correction package for S13M after independent source review of implementation target `88d5ac53977db2af8382e70c1da7106848cf2ffa` on main `7aba95a6c19dc9443cb0caa2f892633c01eb357b`.

It corrects a semantic/schema inconsistency in canonical Part A. Repository/runtime facts outrank this package if a factual conflict is discovered. Codex must not invent or broaden semantics beyond the exact changes below.

The original Part A integration commit remains:

`3458df7171f8fb1bce5c921986d738faaeab8561`

Original canonical artifact hashes before this correction:

- `brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md` — SHA-256 `c88a056a3f00da2640c93a07058f9f657370dc9373b6d488da7434ade6da52a9`
- `brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_DEEP.yaml` — SHA-256 `23ee9cd62a6e65789cd1ada479941240470470f816cf16d79ce1f75b3548b5b9`
- `brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md` — SHA-256 `c32877152e08e90fd46b0b152133571927a7d2f6b41460382cfe7d856a6f1ce4`

## Why this Authoring Gate reopened

Canonical Part A says a required suite may close as `NOT_APPLICABLE` only with an explicit reason/evidence, but the canonical `QaSuiteResultInput` schema had no field in which to carry that explicit reason. Part B introduced `not_applicable_reason_ref` on its own. That was directionally correct but it silently changed a canonical input schema, so the semantic contract must be corrected by ChatGPT before independent executable verification.

The same review also makes two existing canonical requirements unambiguous so they cannot regress mechanically:

1. configuration/environment before→after deltas are evidence-backed, not merely different strings;
2. HI-046..HI-050 are harness/verifier meta-invariants and must fail closed until the required independent evidence exists.

No other S13M semantics change.

---

# Canonical resolution A — justified `NOT_APPLICABLE`

The canonical runtime schema is amended as follows.

In `brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md`, the canonical `QaSuiteResultInput` becomes exactly:

```ts
export interface QaSuiteResultInput {
  suite_ref: string;

  candidate_revision_ref: string;
  environment_ref: string;

  outcome: SuiteCheckOutcome;

  /**
   * Required only when outcome == "NOT_APPLICABLE".
   * Must identify the bounded evidence claim that explains why the
   * required suite is genuinely not applicable to this exact candidate.
   */
  not_applicable_reason_ref?: string;

  executed_check_count?: number;
  passed_check_count?: number;
  failed_check_count?: number;

  evidence_refs: string[];
}
```

Canonical rules:

- When `outcome != "NOT_APPLICABLE"`, `not_applicable_reason_ref` MUST be absent.
- When `outcome == "NOT_APPLICABLE"`:
  - `not_applicable_reason_ref` MUST be a non-empty safe reference;
  - `evidence_refs` MUST be non-empty;
  - every `evidence_ref` MUST resolve to a supplied `QaEvidenceRecordInput`;
  - at least one referenced evidence record MUST have `claim_ref == not_applicable_reason_ref`;
  - that reason-bearing evidence record MUST have relationship `SUPPORTS` or `QUALIFIES`, never `CONTRADICTS`;
  - the reason-bearing evidence record MUST retain its inspectable `locator_ref` and limitations;
  - unresolved/material contradictory evidence about applicability prevents closure.
- `NOT_APPLICABLE` is never a cheap substitute for an unrun/failing relevant check.
- A required suite with `NOT_RUN`, `FAIL`, missing result, wrong candidate, wrong environment, empty evidence, unresolvable evidence, missing reason, or unbound reason cannot close `FIX_VERIFIED`.

This is the only new canonical input field introduced by this correction.

---

# Canonical resolution B — configuration/environment delta evidence

Canonical S13M already requires the environment/config delta to be explicit. For `FIX_VERIFIED`, the meaning is now fixed precisely:

For a `CONFIGURATION_CHANGE` candidate:

- the pre-fix environment snapshot MUST be bound to a valid baseline reproduction attempt;
- the post-fix environment snapshot MUST be bound to a relevant-suite result for the exact candidate revision;
- both snapshots MUST have non-empty `evidence_refs` that resolve to supplied evidence records;
- both `configuration_snapshot_ref` values MUST be non-empty and MUST differ;
- the candidate's proven causal factor MUST map to that configuration change;
- the regression and relevant-suite gates remain independently required.

For an `ENVIRONMENT_CHANGE` candidate:

- the same pre-fix/post-fix binding rules apply;
- both snapshots MUST have non-empty resolving evidence;
- at least one material environment identity component MUST differ between before and after: `runtime_refs`, `dependency_snapshot_ref`, `configuration_snapshot_ref`, or `platform_ref`;
- the delta MUST be intentional and causally justified by the proven root cause;
- merely comparing two arbitrary IDs without evidence is insufficient.

For non-configuration/non-environment fixes, no artificial environment delta is required.

HI-030 (`environment_delta_explicit`) MUST evaluate these exact semantics rather than only checking that environment identity exists.

---

# Canonical resolution C — HI-046..HI-050 meta-invariants

HI-046..HI-050 are not candidate-prose facts. They are executable-harness / independent-verification facts.

Canonical evaluation policy:

- `HI-046 provider_truth_blind` is true only when direct source/harness inspection establishes that the reference provider cannot read fixture ID, expected truth, arm marker, evaluator/frozen-truth helpers, or an equivalent hidden answer channel.
- `HI-047 atomic_observation_isolation` is true only after all exactly 30 detached one-field mutation probes pass and each mutation changes exactly its owning observation ID.
- `HI-048 skill_vs_no_skill_same_path` is true only after direct harness inspection/execution establishes the same inputs, host AgentDefinition, ModelProvider class, CapabilityProvider, S12→S10→S09 runtime, parser, gate and evaluator, with only materialized Skill prose differing.
- `HI-049 unsafe_counters_zero` is recomputed from the actual gated candidate decisions and is true only when all eight canonical unsafe counters are zero.
- `HI-050 fresh_independent_verification` is false for builder execution. It becomes true only for a different fresh, non-authoring, non-fork, read-only verifier that has independently reconstructed repository authority and completed the required verification successfully.

All meta-invariants MUST default fail-closed when their external evidence is absent. A caller-supplied boolean is not evidence by itself; the verifier report must identify the direct source/runtime observation supporting each true meta-invariant.

Builder-stage OI-A may therefore report a partial hard-invariant score and MUST NOT call that bootstrap closure.

Fresh-verifier final procedure:

1. Independently establish HI-046, HI-047 and HI-048 from source + execution.
2. Recompute HI-049 from actual verifier-run outputs.
3. Re-run all ordinary S13M hard invariants and deterministic QA.
4. If and only if all required verifier checks are otherwise PASS and the verifier identity is demonstrably fresh/different/read-only, mark the verifier-context condition for HI-050 true and recompute the final 8×50 matrix.
5. Final S13M verifier evidence must show all 400/400 hard invariants, no hard-invariant regression, all eight unsafe counters zero, and the required OI-A threshold.
6. Even then, S13M is not bootstrap PASS until ChatGPT control plane accepts the fresh verifier handoff.

This two-phase evaluation is not builder self-certification: the builder is forbidden from supplying HI-050=true.

---

# Canonical Quality Contract amendment

Integrate the following normative section into `brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_DEEP.yaml` without altering existing invariant IDs, semantic dimensions, fixture IDs, unsafe counters, or Part B boundaries:

```yaml
meta_hard_invariant_policy:
  default: FAIL_CLOSED
  builder_may_self_assert: false
  hi_046_provider_truth_blind:
    evidence: DIRECT_SOURCE_AND_HARNESS_INSPECTION
  hi_047_atomic_observation_isolation:
    evidence: EXACT_30_OF_30_DETACHED_MUTATION_PROBES
  hi_048_skill_vs_no_skill_same_path:
    evidence: DIRECT_HARNESS_INSPECTION_AND_EXECUTION
  hi_049_unsafe_counters_zero:
    evidence: RECOMPUTED_FROM_ACTUAL_GATED_OUTPUTS
  hi_050_fresh_independent_verification:
    evidence: DIFFERENT_FRESH_NON_AUTHORING_NON_FORK_READ_ONLY_VERIFIER_PASS
    builder_value: false
  final_verifier_requirement:
    hard_invariants: "400/400 across 8 canonical fixtures"
    unsafe_counters: ALL_ZERO
    control_plane_acceptance_still_required: true

not_applicable_policy:
  explicit_reason_ref_required: true
  reason_ref_binding: "Must equal claim_ref of at least one evidence record named by the suite result evidence_refs."
  evidence_refs_nonempty: true
  evidence_refs_must_resolve: true
  allowed_reason_relationships: [SUPPORTS, QUALIFIES]
  contradiction_blocks_closure: true

environment_delta_policy:
  configuration_change:
    before_after_snapshots_required: true
    nonempty_resolving_evidence_required: true
    distinct_configuration_snapshot_refs_required: true
  environment_change:
    before_after_snapshots_required: true
    nonempty_resolving_evidence_required: true
    material_identity_delta_required: true
```

Do not rename or delete HI-001..HI-050.

---

# Canonical Skill amendment

`brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md` otherwise remains semantically unchanged. Add only these two clarifying sentences to the existing rules:

Under QD-R22:

> A justified `NOT_APPLICABLE` result requires an explicit bounded reason reference bound to non-empty resolving evidence for that exact candidate/environment; an unbound reason string is not sufficient.

Under QD-R10 (or immediately after it):

> For `CONFIGURATION_CHANGE` or `ENVIRONMENT_CHANGE` closure, both before and after identities require non-empty resolving evidence, and the material delta itself must be explicit rather than inferred from arbitrary identifier inequality.

No other Skill rule changes.

---

# Required Part A correction integration

Codex must perform exactly this sequence on `main`:

1. Fetch branch `chatgpt-authoring/s13m-20260829-230336z-correction` without merging it.
2. Read `S13M_CHATGPT_PART_A_CANONICAL.md` with `git show` and preserve its SHA-256 in the audit/report.
3. Verify current main still descends from `7aba95a6c19dc9443cb0caa2f892633c01eb357b` and that no later unreviewed S13M/S13N work exists. If reality differs, stop and hand off the conflict.
4. Apply only the canonical semantic amendments above to the three existing S13M Part A artifacts on main.
5. Do not copy the transfer file into main and do not merge the authoring branch.
6. Ensure the resulting spec/runtime schema agree exactly on `not_applicable_reason_ref` and its evidence binding.
7. Ensure configuration/environment delta gating requires non-empty resolving before/after environment evidence.
8. Ensure HI-046..HI-050 remain external/meta fail-closed exactly as specified; builder must not set HI-050=true.
9. Create and push a **Part-A-correction-only** commit before any Part B repair. Record pre/post hashes and diff.
10. Only after that Part-A correction commit, make the minimal Part B mechanical alignment required by the corrected canonical semantics:
    - reject `not_applicable_reason_ref` on non-`NOT_APPLICABLE` outcomes;
    - require reason_ref→referenced-evidence-record.claim_ref binding and SUPPORTS/QUALIFIES relationship;
    - require non-empty resolving before/after environment evidence for configuration/environment closure and HI-030;
    - preserve all previous S13M repairs and actual-candidate gating;
    - preserve provider/frozen-truth isolation and exact 30/30 isolation;
    - do not start S13N.
11. Re-run canonical Node 24 builder QA and update the S13M builder report honestly. Builder hard-invariant totals may remain fail-closed for meta invariants; do not fake 400/400.
12. Commit/push the bounded Part B alignment separately.
13. Post a NEW unique `CODEX_HANDOFF` with `status: INDEPENDENT_VERIFICATION_REQUIRED` and include both the Part-A correction commit and Part-B alignment target.
14. Stop. A fresh verifier may run only after ChatGPT source review of that new handoff.

## Non-goals / boundaries

This correction does NOT authorize:

- S13N or any later step;
- Core changes;
- provider/dependency changes;
- a new AgentDefinition;
- capabilities/tools/network/shell/browser access;
- retry/backoff/idempotency/async behavior;
- observability/deployment/delivery systems;
- security weakening;
- changes to S09/S10/S12/S13L semantics;
- any additional S13M semantic redesign beyond the three resolutions above.

S13M remains `IN_PROGRESS` until a fresh independent verifier PASS is accepted by ChatGPT control plane.
