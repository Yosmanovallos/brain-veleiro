# BRAIN / brain-veleiro — S13K ChatGPT Part A canonical

**Step:** S13K — `frontend-product-surface`  
**Bootstrap objective:** `User flows and loading/empty/error/retry/approval/rejection states; basic accessibility.`  
**Upstream:** S13J VERIFIED PASS  
**Authoring mode:** ChatGPT Authoring Gate  
**Quality depth:** DEEP  
**Execution mode:** SKILL_ONLY  
**New AgentDefinition:** NO  
**Canonical Skill runtime side effects:** NONE  
**Framework/browser/provider neutral:** YES  
**S13L/S13O/S13P/S13Q/S13R/S14 implementations:** OUT OF SCOPE

> Integrate the three artifacts below verbatim. If Part B finds a semantic contradiction, return to ChatGPT Authoring Gate. Mechanical defects may be repaired locally only when these semantics remain unchanged.

---

# 0. Canonical resolutions

## A. Purpose

S13K is a reusable product-surface reasoning Skill. It converts one bounded user-facing product task plus approved upstream contracts into a structured, render-neutral `FrontendProductSurfaceDecision`.

It reasons about journeys, information hierarchy, interaction/state behavior, form feedback, retry affordances, approval/rejection states, responsive intent and basic accessibility evidence.

It does **not** create a frontend application, DOM, CSS, component library, browser automation, auth system, telemetry system or deployment.

## B. Execution mode

`S13K = SKILL_ONLY` under the S13E hierarchy: one-pass semantic synthesis plus deterministic validation. No adaptive observe-act-observe loop is required.

Forbidden:
- new S13K AgentDefinition;
- S13K-specific Core runtime;
- role or Skill-id branches in Core.

Runtime remains S12 metadata discovery → lazy Skill load → caller AgentDefinition → S10 compile → S09 run → parse candidate → deterministic gate.

## C. Quality depth

`DEEP` because product-surface mistakes can create inaccessible, dead-end, misleading, unsafe or destructive user experiences and can silently contradict backend/auth/retry contracts.

## D. Status

Canonical result status:

```text
READY
BLOCKED
```

`BLOCKED` has priority whenever the candidate invents unavailable product/API/security semantics or violates a hard invariant.

## E. Input authority

S13K consumes bounded, immutable caller-supplied facts. It may not invent:
- screens required by no goal;
- API states/fields/errors;
- permissions/auth roles;
- tenant rules;
- destructive-action policy;
- retry safety;
- product copy/brand voice;
- localization content;
- analytics events;
- business rules.

Missing information that changes a required user-flow decision is a blocker rather than a license to fabricate.

## F. Canonical input

`FrontendProductSurfaceInput` includes:
- task/spec refs;
- actor and user-goal refs;
- approved API surface variants/errors from S13I;
- approved auth/approval/destructive/retry policy refs when applicable;
- required product outcomes and constraints;
- bounded form/input intents;
- collection/list intent when applicable;
- copy/brand/localization policy refs if supplied;
- acceptance and evidence requirements.

## G. Canonical output

`FrontendProductSurfaceDecision` includes:
- status/blockers;
- user-flow graph;
- surface inventory;
- information hierarchy;
- state matrix;
- form/interaction contracts;
- feedback/retry contracts;
- responsive intent;
- accessibility intent/checklist;
- approval/rejection/destructive-action presentation requirements;
- traceability to source refs;
- acceptance/evidence projection;
- adjacent-stage deferrals.

It contains no framework object or executable renderer.

## H. Surface vocabulary

Render-neutral surface kinds:

```text
PAGE
REGION
COMPONENT
DIALOG
NOTIFICATION
NONVISUAL_INTERACTION
TERMINAL
```

These are semantic product-surface units, not React/Vue/etc. components.

## I. User-flow graph

A flow contains explicit entry nodes, goal nodes, transitions, terminal states and recovery/exit behavior.

Hard rules:
1. every required goal is reachable from at least one valid entry;
2. every required nonterminal node is reachable;
3. no nonterminal node may be a dead end unless the input explicitly marks it terminal;
4. recoverable error/interruption states require a recovery or safe-exit path;
5. multi-step interruptible flows declare back/cancel/exit behavior;
6. transitions have source-backed trigger/condition refs;
7. no hidden auth/approval transition is invented;
8. success is not reachable before required validation/approval conditions.

## J. State matrix

Canonical semantic state kinds:

```text
INITIAL
LOADING
PROGRESSIVE
EMPTY
SUCCESS
VALIDATION_ERROR
ERROR
UNAVAILABLE
RETRY_AVAILABLE
DISABLED
APPROVAL_PENDING
APPROVED
REJECTED
PERMISSION_DENIED
```

The matrix is applicability-driven. A state need not be shown when its upstream contract cannot occur, but every upstream variant/error/state that can occur must map to an explicit user-visible behavior or explicit nonvisual behavior.

S13K may not fabricate API variants merely to fill every enum value.

## K. Loading/progressive behavior

Loading state must preserve orientation and must not present stale success as current truth. Progressive rendering may be declared only when upstream data can safely arrive independently.

## L. Empty state

An applicable empty state must explain the semantic absence and expose a source-backed next action when one exists. It must not fabricate content or imply an error when the API says empty-success.

## M. Error/unavailable state

Errors map from approved upstream error/availability variants. Product-facing copy is represented as semantic copy intent unless approved copy text is supplied.

The surface must not expose raw stack, SQL, token, provider/internal path or hidden backend details.

## N. Retry boundary / S13O

A retry affordance is allowed only when:
- upstream marks the operation/read as safely retryable; or
- the side effect is read-only/idempotent; or
- an explicit S13O/idempotency/retry policy ref authorizes the behavior.

S13K owns only user-visible retry affordance/state. It does not implement backoff, retry loops, queues, idempotency stores or async reliability.

Unsafe non-idempotent/destructive actions cannot gain a retry button by frontend inference.

## O. Form/input contract

Each form/input intent declares:
- field ref;
- accessible label/name intent;
- requiredness from upstream contract;
- instruction/description intent when needed;
- validation timing policy;
- error association;
- user-input preservation policy after recoverable failure;
- submit lifecycle;
- duplicate-submit prevention while pending;
- cancel/exit behavior;
- destructive-action policy ref when relevant.

Validation timing may be `ON_SUBMIT`, `ON_BLUR`, `ON_CHANGE` or a bounded combination, but must be explicit and must not contradict upstream semantics.

S13K does not invent server validation rules.

## P. Feedback and submit lifecycle

A mutation submit lifecycle must represent at least:

```text
IDLE → SUBMITTING → SUCCESS | RECOVERABLE_ERROR | NONRECOVERABLE_ERROR
```

Duplicate submission while `SUBMITTING` is disabled unless the upstream contract explicitly proves safe multi-submit semantics.

## Q. Approval/rejection and human authority

Approval states are representations of approved upstream/human-authority contracts.

Rules:
- `APPROVAL_PENDING` does not imply success;
- `APPROVED` and `REJECTED` are distinct states;
- rejection preserves enough context for a valid next action when one is allowed;
- the frontend does not self-approve;
- destructive actions require an explicit approved guardrail/policy ref;
- S13K does not invent confirmation/approval policy that belongs to S13L/human authority.

## R. Auth/tenant boundary / S13L

S13K may represent public/authenticated/permission-denied states supplied by S13I/S13L contracts.

The surface never treats hidden/disabled UI as authorization enforcement.

Client-supplied user/tenant/owner state is not authority. Security enforcement remains server/policy side.

## S. Copy and localization

S13K may produce **copy intent**, such as:
- explain loading;
- explain empty result;
- explain recoverable failure;
- state approval pending;
- explain permission denial;
- identify next safe action.

It must not invent brand voice, legal text, policy text, translation strings or localization promises. Approved supplied copy may be projected unchanged.

## T. Information hierarchy

Each surface declares content priorities:

```text
PRIMARY
SECONDARY
SUPPORTING
OPTIONAL
```

Goal-critical actions/data cannot be hidden behind OPTIONAL content.

## U. Responsive intent

Framework-neutral viewport classes:

```text
NARROW
MEDIUM
WIDE
```

The contract specifies semantic adaptation, not pixel breakpoints unless supplied by design policy.

Rules:
- PRIMARY content/actions remain reachable in every applicable viewport class;
- essential content cannot be lost because of overflow;
- reordering must preserve semantic/focus order intent;
- tables/dense collections declare a narrow-viewport strategy;
- responsive behavior cannot make approval/auth/error information inaccessible.

## V. Basic accessibility baseline

Every READY decision must explicitly cover, when applicable:
- semantic structure/landmark intent;
- keyboard operability;
- logical focus order;
- visible focus intent;
- focus placement/restoration after dialog/navigation/error transitions;
- accessible name for interactive controls;
- description/instruction association where needed;
- form error association;
- status/error/async-update announcement intent;
- contrast intent tied to supplied accessibility/design baseline;
- reduced-motion intent for nonessential motion;
- touch-target intent;
- accessible responsive behavior.

S13K does not claim browser/AT conformance from a render-neutral contract. Any exception requires an explicit source ref and evidence requirement.

## W. Evidence limits

Render-neutral evidence may prove contract completeness and traceability, not actual browser layout or assistive-technology behavior.

Browser/DOM evidence is deferred until a concrete frontend/runtime exists. S13K Part B must not add browser automation merely to claim conformance.

## X. S13I boundary

S13K consumes S13I request/response/error/auth/collection contracts but does not silently revise them. Any required API behavior absent upstream becomes a blocker or upstream change request.

## Y. S13L boundary

S13K represents supplied security/approval requirements only. It does not design AuthN/AuthZ, tenant enforcement, secret management, prompt-injection policy or destructive-action security policy.

## Z. S13P/Q/R/S14 boundaries

- S13P owns AI-system observability.
- S13Q owns delivery/demo/documentation.
- S13R owns deployment.
- S14 owns executable tool/browser capability binding.

No future-stage implementation in S13K.

## AA. Anti-self-certification

Deterministic gate recomputes hard invariants from bounded input + candidate. It does not trust candidate `status`, `blockers`, `accessible`, `retry_safe`, `flow_complete` or similar self-claims.

Anchor: candidate claims READY but a required goal is unreachable → final result BLOCKED.

## AB. Evaluation / OI-A

Both arms use same input, AgentDefinition, ModelProvider, CapabilityProvider, S09/S10 runtime, parser, gate, evaluator and frozen truth. Only difference is presence/absence of S13K Skill content.

Forbidden:
- withSkill branch;
- fixture-id branch;
- S13K Skill-id branch;
- deliberately bad baseline provider;
- provider/model access to frozen truth;
- evaluator truth importing provider/synthesizer/parser/gate/evaluator;
- post-hoc denominator changes.

Cross-cutting assertions such as `overall status correct` do not qualify semantic dimensions.

A dimension qualifies only when:
- >=3 genuinely distinct dimension-specific scored assertion IDs exist;
- >=2 dimension-specific assertions improve;
- max contribution from one assertion ID / total dimension improvement <= 0.5.

Threshold:
- with-Skill hard invariants = 100%;
- dead-end required flows = 0;
- missing required upstream-state mappings = 0;
- unsafe retry/duplicate-submit/destructive affordance recommendations = 0;
- fabricated API/auth/policy states = 0;
- framework/browser/provider/future-stage bindings = 0;
- dimension-specific correct assertion delta >= +14;
- improved semantic dimensions >=5;
- no hard-invariant regression.

## AC. Canonical semantic dimensions

```text
SD-001 flow_graph_and_recovery
SD-002 surface_inventory_and_information_hierarchy
SD-003 state_matrix_and_feedback
SD-004 forms_validation_and_submit_lifecycle
SD-005 retry_approval_and_destructive_action_boundary
SD-006 accessibility_intent
SD-007 responsive_adaptive_behavior
SD-008 api_auth_and_policy_traceability
SD-009 acceptance_evidence_traceability
SD-010 framework_provider_and_future_stage_boundary
```

## AD. Canonical positive fixtures

1. `FX-POS-001 public-list`: loading, empty, success, recoverable error, pagination-aware list, narrow viewport strategy.
2. `FX-POS-002 authenticated-form`: declared fields, associated validation, submit pending, duplicate-submit disabled, success/error mapping.
3. `FX-POS-003 approval-flow`: pending/approved/rejected are distinct and human authority is preserved.
4. `FX-POS-004 destructive-action`: supplied S13L guardrail ref, no unsafe retry, clear cancel/approval path.
5. `FX-POS-005 responsive-accessible-surface`: keyboard/focus/name/status/priority intents preserved across NARROW/MEDIUM/WIDE.
6. `FX-POS-006 permission-and-unavailable`: explicit permission denied and unavailable states mapped from upstream variants without fabricating backend semantics.

## AE. Canonical negative fixtures

At minimum:
1. required goal unreachable;
2. unreachable required surface;
3. dead-end nonterminal flow;
4. recoverable error has no recovery/exit;
5. multi-step interruptible flow lacks cancel/back/exit policy;
6. fabricated API success/error state;
7. loading state missing for required async transition;
8. empty state missing for applicable collection;
9. error variant not mapped;
10. permission-denied variant hidden as generic success/empty;
11. unsafe retry on non-idempotent action;
12. duplicate submit allowed while pending without proof;
13. destructive action lacks approved guardrail ref;
14. frontend self-approves approval flow;
15. client tenant/user field treated as authority;
16. required form field lacks accessible label/name intent;
17. validation error not associated to field/summary intent;
18. recoverable error destroys user input without approved reason;
19. dialog transition loses/restores no focus intent;
20. keyboard-inaccessible required action;
21. async status has no announcement intent;
22. responsive NARROW state hides PRIMARY action/content;
23. responsive reorder contradicts focus/semantic order;
24. dense collection has no narrow-view strategy;
25. raw stack/SQL/token/internal path exposed in copy intent;
26. brand/legal/localization copy fabricated;
27. concrete React/Vue/Svelte/DOM/browser object embedded;
28. browser automation/runtime dependency pulled forward;
29. S13L/S13O/S13P/S13Q/S13R/S14 implementation pulled forward;
30. acceptance/evidence dropped, weakened or invented.

## AF. Part B allowed scope

Pure TypeScript Intelligence module equivalent to:

```text
src/intelligence/frontend-product-surface/
  constants.ts
  types.ts
  validateFrontendProductSurfaceInput.ts
  buildFlowGraph.ts
  validateFlowGraph.ts
  buildSurfaceInventory.ts
  buildStateMatrix.ts
  validateFormContracts.ts
  validateRetryApprovalBoundary.ts
  validateAccessibilityIntent.ts
  validateResponsiveIntent.ts
  validateTraceability.ts
  synthesizeFrontendProductSurfaceDecision.ts
  validateFrontendProductSurfaceDecision.ts
  gateFrontendProductSurface.ts
  planFrontendProductSurface.ts
  compareFrontendProductSurfaceRuns.ts
  index.ts

src/intelligence/skills/definitions/frontendProductSurfaceS13K.ts
tests/frontend-product-surface/...
brain-bootstrap/reports/S13K-frontend-product-surface-verification.md
```

Exact filenames may follow repository convention.

## AG. Forbidden Part B scope

No:
- React/Vue/Svelte/Angular/Hono/etc.;
- DOM renderer;
- HTML/CSS application shell;
- design-system/component-library package;
- browser automation dependency;
- auth provider/security engine;
- retry/backoff/idempotency runtime;
- observability vendor;
- deployment;
- Capability Registry;
- persistent browser/server runtime;
- S13L/S13O/S13P/S13Q/S13R/S14 implementation;
- Core mutation or new AgentDefinition.

## AH. Unresolved gaps

No semantic blocker remains for Part A. Concrete branding, exact copy, pixel breakpoints, framework/component choice, browser/AT conformance and product-specific security policy are intentionally deferred to supplied policy or later implementation/evidence.

---

# ARTIFACT 1

Target path:
`brain-bootstrap/skills/FRONTEND_PRODUCT_SURFACE_SKILL_S13K.md`

```markdown
# FRONTEND_PRODUCT_SURFACE_SKILL_S13K

## Identity

```yaml
id: intelligence.frontend-product-surface.s13k
version: 1.0.0
step: S13K
name: frontend-product-surface
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral: true
```

## Purpose

Produce one render-neutral, framework-neutral product-surface decision from bounded user goals and approved upstream contracts.

The Skill owns user-flow, surface/state/form/feedback/responsive/basic-accessibility reasoning. It does not implement a frontend.

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - CURRENT_PRODUCT_TASK
    - APPROVED_SPEC
    - APPROVED_API_CONTRACTS
    - APPROVED_SECURITY_APPROVAL_RETRY_POLICY_REFS
    - ACCEPTANCE_EVIDENCE
  quality_contract_refs:
    - S13K_FRONTEND_PRODUCT_SURFACE_DEEP
```

## Permissions

```yaml
permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true
```

## Input

Canonical: `FrontendProductSurfaceInput`.

It contains bounded task/spec/actor/goal/API/policy/form/acceptance/evidence inputs. Inputs are immutable.

## Output

Canonical: `FrontendProductSurfaceDecision` with status `READY | BLOCKED`.

## Rules

1. One bounded product-surface task per decision.
2. Framework/browser/provider neutral.
3. Every required goal reachable from a valid entry.
4. No unreachable required surface.
5. No nonterminal dead end.
6. Recoverable failures require recovery or safe exit.
7. Multi-step interruptible flows declare back/cancel/exit behavior.
8. Every applicable upstream API/error/auth state maps to explicit surface behavior.
9. Do not fabricate API/auth/tenant/business-policy states.
10. Loading, empty, error, permission and approval states remain semantically distinct.
11. Retry affordance requires upstream retry safety/idempotency/S13O policy.
12. Duplicate submit is disabled while pending unless explicitly proven safe.
13. Destructive action requires supplied guardrail/approval ref.
14. Frontend never self-approves or acts as authorization enforcement.
15. Forms have accessible name/label intent and associated validation errors.
16. Recoverable form failure preserves input unless an approved reason says otherwise.
17. Async/status changes have announcement intent when required.
18. Dialog/navigation transitions declare focus placement/restoration intent.
19. Required actions are keyboard-operable in the contract.
20. PRIMARY content/action remains reachable in NARROW/MEDIUM/WIDE.
21. Responsive reordering preserves semantic/focus-order intent.
22. Dense collections declare narrow-viewport behavior.
23. Raw backend/internal/secret details never become user copy.
24. Copy intent does not invent brand/legal/localization text.
25. Accessibility contract is intent/evidence, not a false browser-conformance claim.
26. S13I semantics are consumed, not rewritten.
27. S13L security policy is referenced, not invented.
28. S13O retry mechanics are deferred.
29. S13P/Q/R/S14 remain out of scope.
30. Acceptance/evidence is preserved and traceable.
31. Candidate status is not trusted; deterministic gate recomputes invariants.
32. Canonical Skill runtime has no side effects.

## Failure policy

Semantic contradiction → return to ChatGPT Authoring Gate.
Mechanical defect → minimal local repair + rerun affected verification.

## Success criteria

Part A integrity, Skill Contract validation, positives/negatives, real S12→S10→S09 execution, anti-self-certification, OI-A-safe comparison, typecheck/full tests/build/post-build, builder review and fresh independent verification must all pass before S13L.
```

---

# ARTIFACT 2

Target path:
`brain-bootstrap/quality-contracts/S13K_FRONTEND_PRODUCT_SURFACE_DEEP.yaml`

```yaml
id: S13K_FRONTEND_PRODUCT_SURFACE_DEEP
version: 1.0.0
step: S13K
name: frontend-product-surface
depth: DEEP
status: CANONICAL

rationale:
  risk: HIGH
  ambiguity: HIGH
  novelty: MEDIUM
  irreversibility: MEDIUM
  downstream_impact: HIGH
  explanation: >-
    Product-surface mistakes can create dead ends, inaccessible interactions,
    misleading approval/auth states, unsafe retries/destructive actions, or
    contracts that contradict backend semantics.

hard_invariants:
  - { id: HI-001, rule: one_bounded_task, pass: "Exactly one bounded product-surface task is represented." }
  - { id: HI-002, rule: skill_only, pass: "No new AgentDefinition or Core special branch exists." }
  - { id: HI-003, rule: no_runtime_side_effect, pass: "Canonical Skill runtime performs no browser/server/external side effect." }
  - { id: HI-004, rule: provider_framework_neutral, pass: "No concrete UI framework/browser/provider binding exists." }
  - { id: HI-005, rule: goals_reachable, pass: "Every required user goal is reachable from a valid entry." }
  - { id: HI-006, rule: required_surfaces_reachable, pass: "Every required nonterminal surface is reachable." }
  - { id: HI-007, rule: no_dead_end, pass: "No required nonterminal flow node is a dead end." }
  - { id: HI-008, rule: recovery_or_exit, pass: "Recoverable error/interruption states expose recovery or safe exit." }
  - { id: HI-009, rule: interruptible_exit_policy, pass: "Interruptible multi-step flows declare back/cancel/exit behavior." }
  - { id: HI-010, rule: upstream_state_traceability, pass: "Every applicable upstream state/variant maps to explicit behavior." }
  - { id: HI-011, rule: no_fabricated_api_state, pass: "No API/auth/policy state is invented." }
  - { id: HI-012, rule: async_loading_semantics, pass: "Required async transitions have non-misleading loading/progressive semantics." }
  - { id: HI-013, rule: applicable_empty_state, pass: "Applicable collection empty-success has explicit empty behavior." }
  - { id: HI-014, rule: error_mapping, pass: "Applicable error variants map to safe actionable behavior." }
  - { id: HI-015, rule: retry_safety, pass: "Retry affordance exists only with source-backed retry safety/idempotency/S13O policy." }
  - { id: HI-016, rule: duplicate_submit_safety, pass: "Duplicate submit is prevented while pending unless explicitly proven safe." }
  - { id: HI-017, rule: destructive_guardrail_ref, pass: "Destructive intent requires approved guardrail/approval source ref." }
  - { id: HI-018, rule: no_self_approval, pass: "Frontend cannot self-approve a human/policy approval flow." }
  - { id: HI-019, rule: no_client_auth_authority, pass: "Client UI state is never authorization/tenant authority." }
  - { id: HI-020, rule: form_accessible_name, pass: "Required form controls have accessible name/label intent." }
  - { id: HI-021, rule: validation_error_association, pass: "Validation errors are associated with affected input/summary intent." }
  - { id: HI-022, rule: preserve_recoverable_input, pass: "Recoverable form failure preserves user input unless an approved reason says otherwise." }
  - { id: HI-023, rule: keyboard_required_actions, pass: "Required interactive actions declare keyboard operability." }
  - { id: HI-024, rule: focus_transition, pass: "Dialog/navigation/error transitions preserve explicit focus placement/restoration intent." }
  - { id: HI-025, rule: async_announcement, pass: "Relevant async/status/error changes declare announcement intent." }
  - { id: HI-026, rule: no_false_accessibility_claim, pass: "Render-neutral evidence does not claim browser/AT conformance." }
  - { id: HI-027, rule: responsive_primary_reachable, pass: "PRIMARY content/actions remain reachable across applicable viewport classes." }
  - { id: HI-028, rule: responsive_semantic_order, pass: "Responsive reorder does not contradict semantic/focus-order intent." }
  - { id: HI-029, rule: dense_collection_narrow_strategy, pass: "Dense/unbounded collection has a narrow-viewport strategy." }
  - { id: HI-030, rule: safe_copy, pass: "No raw stack/SQL/secret/internal path becomes product copy." }
  - { id: HI-031, rule: no_fabricated_brand_copy, pass: "Brand/legal/localization text is not invented." }
  - { id: HI-032, rule: s13i_immutable_boundary, pass: "S13I API semantics are not silently changed." }
  - { id: HI-033, rule: future_stage_boundary, pass: "No S13L/S13O/S13P/S13Q/S13R/S14 implementation is introduced." }
  - { id: HI-034, rule: acceptance_evidence_preserved, pass: "Acceptance/evidence is preserved without weakening or invention." }
  - { id: HI-035, rule: anti_self_certification, pass: "Gate recomputes hard invariants/status from input plus candidate." }
  - { id: HI-036, rule: input_immutability, pass: "Bounded input is not mutated." }

semantic_dimensions:
  - { id: SD-001, name: flow_graph_and_recovery }
  - { id: SD-002, name: surface_inventory_and_information_hierarchy }
  - { id: SD-003, name: state_matrix_and_feedback }
  - { id: SD-004, name: forms_validation_and_submit_lifecycle }
  - { id: SD-005, name: retry_approval_and_destructive_action_boundary }
  - { id: SD-006, name: accessibility_intent }
  - { id: SD-007, name: responsive_adaptive_behavior }
  - { id: SD-008, name: api_auth_and_policy_traceability }
  - { id: SD-009, name: acceptance_evidence_traceability }
  - { id: SD-010, name: framework_provider_and_future_stage_boundary }

fixtures:
  minimum_positive_evaluable: 6
  minimum_negative: 20

skill_vs_no_skill_evaluation:
  same_input: true
  same_agent_definition: true
  same_model_provider: true
  same_capability_provider: true
  same_s09_s10_runtime: true
  same_parser_gate_evaluator: true
  frozen_truth_provider_blind: true
  fixture_id_branching: FORBIDDEN
  skill_id_branching: FORBIDDEN
  with_skill_flag_branching: FORBIDDEN
  deliberately_bad_baseline: FORBIDDEN
  post_hoc_denominator_changes: FORBIDDEN
  cross_cutting_assertions_may_qualify_dimension: false
  minimum_dimension_specific_scored_assertion_ids_per_qualified_dimension: 3
  minimum_additional_correct_assertions_per_qualified_dimension: 2
  maximum_single_assertion_share_of_dimension_improvement: 0.5
  hard_invariant_score_with_skill: 1.0
  minimum_additional_correct_dimension_specific_assertions_total: 14
  minimum_qualified_dimensions: 5
  maximum_dead_end_required_flows_with_skill: 0
  maximum_missing_required_state_mappings_with_skill: 0
  maximum_unsafe_retry_duplicate_destructive_recommendations_with_skill: 0
  maximum_fabricated_api_auth_policy_states_with_skill: 0
  maximum_framework_browser_provider_future_stage_bindings_with_skill: 0
  hard_invariant_regression_allowed: false

pass_criteria:
  - "All hard invariants pass."
  - "All canonical positive fixtures pass."
  - "Canonical negatives block/reject correctly."
  - "Actual parsed candidate is deterministically gated."
  - "Real S12→S10→S09 runtime path is proven."
  - "Provider/model cannot see frozen truth."
  - "OI-A thresholds pass with raw grouped assertion-ID contributions."
  - "No frontend/browser/runtime dependency is added."
  - "typecheck passes."
  - "full tests pass."
  - "clean build passes."
  - "post-build tests pass."
  - "fresh independent verification passes before S13L."

failure_policy:
  semantic: RETURN_TO_CHATGPT_AUTHORING_GATE
  mechanical: REPAIR_LOCALLY_AND_REVERIFY
```

---

# ARTIFACT 3

Target path:
`brain-bootstrap/specs/FRONTEND_PRODUCT_SURFACE_CONTRACT_S13K.md`

```markdown
# BRAIN — Frontend Product Surface Contract S13K

**Step:** S13K  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**Quality depth:** DEEP  
**Runtime side effects:** NONE

## 1. Purpose

Define a render-neutral product-surface contract for one bounded user-facing task without choosing or implementing a frontend framework.

## 2. Canonical types

```ts
export type FrontendSurfaceStatus = "READY" | "BLOCKED";

export type SurfaceKind =
  | "PAGE"
  | "REGION"
  | "COMPONENT"
  | "DIALOG"
  | "NOTIFICATION"
  | "NONVISUAL_INTERACTION"
  | "TERMINAL";

export type SurfaceStateKind =
  | "INITIAL"
  | "LOADING"
  | "PROGRESSIVE"
  | "EMPTY"
  | "SUCCESS"
  | "VALIDATION_ERROR"
  | "ERROR"
  | "UNAVAILABLE"
  | "RETRY_AVAILABLE"
  | "DISABLED"
  | "APPROVAL_PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PERMISSION_DENIED";

export type ContentPriority = "PRIMARY" | "SECONDARY" | "SUPPORTING" | "OPTIONAL";
export type ViewportClass = "NARROW" | "MEDIUM" | "WIDE";
export type ValidationTiming = "ON_SUBMIT" | "ON_BLUR" | "ON_CHANGE";
```

## 3. Input

```ts
export interface SurfaceActorGoal {
  actor_ref: string;
  goal_ref: string;
  source_refs: string[];
}

export interface UpstreamSurfaceVariant {
  operation_ref: string;
  variant_ref: string;
  semantic_kind: "SUCCESS" | "EMPTY" | "VALIDATION_ERROR" | "ERROR" | "UNAVAILABLE" | "PERMISSION_DENIED";
  retryability: "NOT_RETRYABLE" | "SAFE_RETRY" | "POLICY_REQUIRED";
  source_refs: string[];
}

export interface SurfaceFormFieldIntent {
  field_ref: string;
  required: boolean;
  accessible_name_intent: string;
  description_intent?: string;
  validation_timings: ValidationTiming[];
  error_association_required: boolean;
  preserve_on_recoverable_error: boolean;
  source_refs: string[];
}

export interface SurfaceFormIntent {
  form_ref: string;
  field_intents: SurfaceFormFieldIntent[];
  duplicate_submit_policy: "DISABLE_WHILE_PENDING" | "EXPLICITLY_SAFE_MULTI_SUBMIT";
  cancel_exit_policy: string;
  destructive_guardrail_ref?: string;
  source_refs: string[];
}

export interface SurfacePolicyRefs {
  security_refs: string[];
  approval_refs: string[];
  retry_refs: string[];
  copy_brand_refs: string[];
  accessibility_refs: string[];
  responsive_refs: string[];
}

export interface FrontendProductSurfaceInput {
  task_ref: string;
  spec_refs: string[];
  actors_goals: SurfaceActorGoal[];
  entry_intent_refs: string[];
  required_outcome_refs: string[];
  upstream_variants: UpstreamSurfaceVariant[];
  form_intents: SurfaceFormIntent[];
  policy_refs: SurfacePolicyRefs;
  acceptance: readonly unknown[];
  evidence_required: readonly unknown[];
}
```

Inputs are immutable.

## 4. Flow graph

```ts
export interface SurfaceFlowNode {
  id: string;
  kind: SurfaceKind;
  purpose: string;
  source_refs: string[];
  terminal: boolean;
}

export interface SurfaceFlowEdge {
  id: string;
  from: string;
  to: string;
  trigger: string;
  condition_source_refs: string[];
  recovery: boolean;
}

export interface UserFlowGraph {
  entry_node_ids: string[];
  goal_node_ids: string[];
  nodes: SurfaceFlowNode[];
  edges: SurfaceFlowEdge[];
  interruptible_exit_policy_refs: string[];
}
```

Deterministic validation recomputes reachability, dead ends, recovery and terminal semantics.

## 5. Surface inventory / hierarchy

```ts
export interface SurfaceInventoryItem {
  surface_ref: string;
  kind: SurfaceKind;
  priority: ContentPriority;
  goal_refs: string[];
  source_refs: string[];
}
```

Goal-critical content/actions cannot be OPTIONAL-only.

## 6. State matrix

```ts
export interface SurfaceStateContract {
  surface_ref: string;
  state: SurfaceStateKind;
  applicable: boolean;
  upstream_variant_refs: string[];
  copy_intent?: string;
  available_action_refs: string[];
  recovery_action_refs: string[];
  announcement_required: boolean;
  source_refs: string[];
}
```

Every applicable upstream variant must map to at least one state contract. S13K does not invent missing upstream variants.

## 7. Forms

```ts
export interface FormInteractionContract {
  form_ref: string;
  field_refs: string[];
  submit_lifecycle: readonly ["IDLE", "SUBMITTING", "SUCCESS_OR_ERROR"];
  duplicate_submit_disabled_while_pending: boolean;
  preserve_input_on_recoverable_error: boolean;
  cancel_exit_policy: string;
  destructive_guardrail_ref?: string;
}
```

## 8. Retry / approval / destructive boundary

```ts
export interface RetryAffordanceContract {
  source_variant_ref: string;
  allowed: boolean;
  authorization_ref?: string;
}

export interface ApprovalPresentationContract {
  approval_ref: string;
  pending_state_ref: string;
  approved_state_ref: string;
  rejected_state_ref: string;
  frontend_can_self_approve: false;
}
```

Unsafe retry cannot be inferred from UI preference.

## 9. Accessibility intent

```ts
export interface AccessibilityIntent {
  semantic_structure_required: boolean;
  keyboard_required_action_refs: string[];
  focus_order_refs: string[];
  focus_restore_transition_refs: string[];
  visible_focus_required: boolean;
  accessible_name_control_refs: string[];
  description_association_refs: string[];
  error_association_refs: string[];
  announcement_state_refs: string[];
  contrast_policy_ref?: string;
  reduced_motion_policy_ref?: string;
  touch_target_policy_ref?: string;
  exception_refs: string[];
  browser_conformance_claimed: false;
}
```

## 10. Responsive intent

```ts
export interface ResponsiveSurfaceIntent {
  surface_ref: string;
  viewport: ViewportClass;
  primary_content_refs: string[];
  primary_action_refs: string[];
  overflow_strategy: string;
  semantic_order_preserved: boolean;
  focus_order_preserved: boolean;
}
```

No pixel breakpoint is invented unless supplied by policy.

## 11. Traceability

```ts
export interface SurfaceTraceabilityEntry {
  artifact_ref: string;
  source_refs: string[];
}
```

Every flow node, state, form rule, approval/retry rule and accessibility exception has source refs.

## 12. Canonical decision

```ts
export interface FrontendProductSurfaceDecision {
  status: FrontendSurfaceStatus;
  blockers: string[];
  task_ref: string;
  spec_refs: string[];
  flow_graph: UserFlowGraph;
  surfaces: SurfaceInventoryItem[];
  state_matrix: SurfaceStateContract[];
  forms: FormInteractionContract[];
  retries: RetryAffordanceContract[];
  approvals: ApprovalPresentationContract[];
  accessibility: AccessibilityIntent;
  responsive: ResponsiveSurfaceIntent[];
  traceability: SurfaceTraceabilityEntry[];
  acceptance: readonly unknown[];
  evidence_required: readonly unknown[];
  deferred_to_s13l: string[];
  deferred_to_s13o: string[];
  deferred_to_s13p: string[];
  deferred_to_s13q: string[];
  deferred_to_s13r: string[];
  deferred_to_s14: string[];
}
```

## 13. Status derivation

Any hard invariant failure → BLOCKED. Otherwise READY.

Candidate status/blockers are not authoritative; the deterministic gate recomputes them.

## 14. Copy policy

Copy is semantic intent unless exact approved text is supplied. No fabricated brand/legal/localization text.

## 15. Auth policy

Visibility/disabled state is never authorization enforcement. Permission denied is mapped only from approved upstream policy/API semantics.

## 16. Accessibility evidence limit

Render-neutral contract evidence cannot claim browser/assistive-technology conformance.

## 17. Evaluation dimensions

Use SD-001..SD-010 from the Quality Contract. OI-A qualification requires distinct assertion IDs and grouped contribution math.

## 18. Canonical positives

`FX-POS-001` through `FX-POS-006` are exactly those listed in canonical resolution AD.

## 19. Canonical negatives

At minimum the 30 cases listed in canonical resolution AE must be represented by deterministic fixtures/tests.

## 20. Minimum semantic test matrix

Part B must provide equivalent coverage for:

```text
T1   valid bounded input
T2   input immutability
T3   one-task boundary
T4   no framework/browser binding
T5   required goal reachability
T6   unreachable required goal blocks
T7   unreachable required surface blocks
T8   nonterminal dead-end blocks
T9   recoverable error recovery path passes
T10  recoverable error without recovery/exit blocks
T11  interruptible multi-step cancel/back/exit required
T12  flow transition source refs required
T13  success cannot bypass required approval/validation
T14  applicable loading mapping required
T15  applicable empty mapping required
T16  API error mapping required
T17  unavailable mapping required when upstream exposes it
T18  permission-denied mapping required when upstream exposes it
T19  no fabricated API state
T20  empty-success is not generic error
T21  raw internal error details cannot become copy
T22  copy intent may be semantic placeholder
T23  brand/legal/localization fabrication rejects
T24  form field accessible-name intent required
T25  requiredness comes from upstream intent
T26  validation timing explicit
T27  validation error association required
T28  recoverable form input preservation
T29  submit lifecycle explicit
T30  duplicate submit disabled while pending
T31  explicitly safe multi-submit requires source proof
T32  cancel/exit form policy explicit
T33  safe retry for read/idempotent operation passes
T34  unsafe retry for non-idempotent action blocks
T35  S13O retry-policy ref can authorize affordance without implementing mechanics
T36  destructive action requires guardrail ref
T37  frontend self-approval blocks
T38  approval pending/approved/rejected remain distinct
T39  rejection next-action traceability
T40  client user/tenant field cannot be authority
T41  hidden/disabled control cannot count as auth enforcement
T42  keyboard intent for required action
T43  focus order declared
T44  focus restoration declared for dialog/navigation transition
T45  visible-focus intent required
T46  accessible names for controls
T47  descriptions/instructions association when needed
T48  error association intent
T49  async/status announcement intent
T50  no false browser/AT conformance claim
T51  accessibility exception requires source/evidence ref
T52  NARROW primary content remains reachable
T53  NARROW primary action remains reachable
T54  MEDIUM/WIDE semantic intent valid
T55  responsive reorder preserves semantic order
T56  responsive reorder preserves focus order
T57  dense collection narrow strategy required
T58  no essential-content overflow loss
T59  surface inventory goal traceability
T60  PRIMARY/SECONDARY/SUPPORTING/OPTIONAL hierarchy valid
T61  goal-critical content not OPTIONAL-only
T62  every state/flow/form rule has source traceability
T63  S13I semantics remain unchanged
T64  S13L policy referenced not invented
T65  S13O mechanics absent
T66  S13P/Q/R/S14 implementation absent
T67  acceptance preserved
T68  evidence preserved
T69  candidate READY with unreachable goal gates BLOCKED
T70  no S13K AgentDefinition
T71  no Core Skill-id/role branch
T72  Skill definition has no capabilities and side effects NONE
T73  S12 metadata-only discovery proven
T74  lazy S13K load proven
T75  S10 compileAgentDefinition proven
T76  S09 runAgent proven
T77  provider cannot see frozen truth
T78  no fixture-id/Skill-id/withSkill branch
T79  frozen truth does not import provider/synthesizer/parser/gate/evaluator
T80  assertions A/B/C are genuinely distinct observations
T81  raw contribution counts grouped by assertion ID
T82  max single assertion share <=0.5 for qualified dimensions
T83  >=3 distinct assertion IDs per qualified dimension
T84  >=2 improved assertions per qualified dimension
T85  total dimension-specific delta >=14
T86  >=5 qualified dimensions
T87  Skill hard invariants 100%
T88  zero dead-end/missing-state/unsafe-affordance/fabrication/binding safety counters
T89  no hard-invariant regression
T90  FX-POS-001 passes
T91  FX-POS-002 passes
T92  FX-POS-003 passes
T93  FX-POS-004 passes
T94  FX-POS-005 passes
T95  FX-POS-006 passes
T96  canonical negatives block/reject correctly
T97  typecheck/full regression suite green
T98  clean build/post-build green
```

## 21. Part B allowed scope

Pure TypeScript Intelligence/Skill/tests/report only, equivalent to the module list in canonical resolution AF.

## 22. Forbidden scope

No frontend framework, DOM/browser runtime, CSS/design system, browser automation, auth provider, retry runtime, observability vendor, deployment, Capability Registry, future-stage implementation, Core mutation or new AgentDefinition.

## 23. PASS criteria

Part A verbatim integrity; deterministic gate; positives/negatives; real S12→S10→S09 execution; OI-A thresholds; no dependency/framework pull-forward; typecheck/full tests/clean build/post-build; builder review; fresh independent verification; S13L NOT_STARTED.
```

---

# Integration instruction

1. Fetch this authoring branch; do **not** merge it into main.
2. Preserve SHA-256 of this transfer file.
3. Extract/integrate the three exact path-delimited artifacts verbatim on main.
4. Verify byte identity and standalone YAML parse.
5. Run Node 24 baseline typecheck/full tests.
6. Create/push a Part-A-only commit containing only the three canonical artifacts.
7. Preserve transfer/hash audit evidence.
8. Continue S13K Part B under the existing master authorization, preferably in a fresh non-fork S13K builder context per the context-rotation rule.
9. Do not start S13L until fresh independent S13K VERIFIED PASS.
