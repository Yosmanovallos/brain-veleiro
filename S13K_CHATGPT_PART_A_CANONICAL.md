# S13K CHATGPT PART A CANONICAL TRANSFER

## Canonical resolutions

- **DECISION:** execution mode is `SKILL_ONLY`; no S13K AgentDefinition and no Core/runtime role or Skill-id branch.
- **DECISION:** Quality depth is `DEEP` because product-surface omissions span user recovery, accessibility, approval/destructive actions, async states and adjacent security/reliability boundaries.
- **DECISION:** S13K is framework-neutral planning/evaluation only. Part B may add Intelligence types, validators, planner/gate, eval fixtures, typed Skill projection and append-only catalog wiring; it may not add a web app, DOM, frontend framework, CSS/component system, browser runtime, server, auth/telemetry provider, deployment or Capability Registry.
- **DECISION:** `FrontendProductSurfaceDecision` is authoritative. Any prototype/render-like artifact is derived and non-authoritative.
- **DECISION:** S13I-derived request/response/error/auth facts are read-only bounded input; S13K cannot rewrite or invent them.
- **DECISION:** every reachable nonterminal flow node needs an outgoing transition or explicit external blocker. Every goal reaches a canonical terminal: `SUCCESS | CANCELLED | REJECTED | PERMISSION_DENIED | BLOCKED_EXTERNALLY`.
- **DECISION:** recoverable failures need user-visible recovery. Retry affordance is allowed only from explicit bounded input; mechanics remain S13O.
- **DECISION:** state applicability is explicit per surface/operation. Async actions require loading/in-flight, success and declared failure states; zero-capable collections require `EMPTY`; forms require validation; approval requires pending/approved/rejected; declared authorization denial requires permission-denied.
- **DECISION:** forms preserve field intent and recoverable input, associate errors, and prevent duplicate submission at the interaction-contract level without claiming server idempotency.
- **DECISION:** destructive actions require an approved guardrail/approval ref; missing policy blocks instead of being invented.
- **DECISION:** UI visibility/disabled state never counts as authorization enforcement. S13L owns policy/enforcement.
- **DECISION:** accessibility planning covers semantic structure, keyboard reachability, visible focus, focus order/restoration, accessible names/descriptions/errors/status, non-color-only meaning, reduced-motion intent and required contrast/target-size evidence. S13K cannot claim browser/WCAG conformance without executable evidence.
- **DECISION:** responsive intent preserves the primary goal/action, current error/approval status and required recovery at constrained widths; overflow needs an explicit strategy; breakpoints are not invented.
- **DECISION:** copy is represented as functional intent/source refs, not invented brand voice/localized strings.
- **DECISION:** anti-self-certification validates the actual parsed candidate; terminal `status`/`blockers` are recomputed; invalid content is preserved for diagnostics and never replaced by a separately synthesized faithful answer.
- **DECISION:** real proof uses unchanged S12 metadata discovery/lazy-load → S10 compile → S09 run with a caller-supplied generic host.
- **DECISION:** frozen comparison truth is provider-blind and may not import/call provider, production synthesizer, parser, gate or evaluator. A/B/C assertion IDs must observe different properties.
- **DECISION:** OI-A uses ten dimensions and `max_single_assertion_share = max(per_assertion_improved_instance_count) / total_dimension_improvement`; cross-cutting checks cannot qualify a dimension.
- **BOUNDARY:** S13L owns security policy/enforcement; S13O retry/backoff/idempotency/jobs; S13P AI observability; S13Q delivery/demo; S13R deployment; S14 executable browser/tool capability binding.
- **UNRESOLVED GAP:** no concrete product, brand/design tokens, localization, viewport/browser matrix, route tree/DOM or executable accessibility audit exists; Part B must not invent them.

---

## FILE: brain-bootstrap/skills/FRONTEND_PRODUCT_SURFACE_SKILL_S13K.md

# Frontend Product Surface Skill — S13K

```yaml
id: intelligence.frontend-product-surface.s13k
version: 1.0.0
description: Plan and validate framework-neutral user flows, complete interaction states, forms, feedback, responsive intent and basic accessibility without pulling forward rendering, security, reliability or deployment concerns.
applies_when:
  - a task requires a user-facing product flow or interaction surface
  - backend capability must be translated into bounded user-visible states and transitions
  - forms, collections, approvals, destructive intent or async actions need a verifiable surface contract
inputs: [FrontendProductSurfaceInput]
outputs: [FrontendProductSurfaceDecision]
requires:
  skills: []
  capabilities: []
  quality_contract_refs: [S13K_FRONTEND_PRODUCT_SURFACE_DEEP]
permissions:
  allowed_capabilities: []
  allowed_side_effects: [NONE]
  deny_unlisted_capabilities: true
evals: [S13K-FRONTEND-PRODUCT-SURFACE-OI-A]
```

## Rules

1. `FPS-R01` Use only bounded actors, goals, entries, operation facts, fields, policy refs, acceptance and evidence.
2. `FPS-R02` Never invent screens, permissions, tenants, API variants, fields, business policy, brand copy, localization or analytics.
3. `FPS-R03` Every goal maps to a reachable path and terminal outcome.
4. `FPS-R04` Every flow has explicit entry nodes and actor applicability.
5. `FPS-R05` Reachable nonterminal dead ends are invalid.
6. `FPS-R06` Every declared recoverable failure has a recovery path.
7. `FPS-R07` Back/cancel behavior is explicit and cannot bypass destructive/approval guardrails.
8. `FPS-R08` Model semantic surfaces, not framework components.
9. `FPS-R09` Every surface declares purpose, primary content, primary action or rationale, and content priority.
10. `FPS-R10` Every canonical state is `REQUIRED`, `NOT_APPLICABLE`, or `DEFERRED_WITH_BLOCKER`.
11. `FPS-R11` Async operations require loading/in-flight, success and all declared failure states.
12. `FPS-R12` Zero-result collection behavior is a distinct `EMPTY` state.
13. `FPS-R13` Validation is distinct from domain/system failure.
14. `FPS-R14` Declared authorization denial is represented without implying client-side enforcement.
15. `FPS-R15` Approval-required work has pending/approved/rejected states and never auto-approves.
16. `FPS-R16` Retry requires explicit input authorization; runtime mechanics stay S13O.
17. `FPS-R17` Never infer retry for non-idempotent, destructive or external-side-effect work.
18. `FPS-R18` Forms preserve supplied field ids, requiredness, instructions and validation refs.
19. `FPS-R19` Field errors associate to fields; form/global errors have explicit non-color-only presentation intent.
20. `FPS-R20` Recoverable failures preserve user-entered values unless explicit bounded policy says otherwise.
21. `FPS-R21` In-flight submission prevents duplicate activation without claiming server idempotency.
22. `FPS-R22` Destructive action requires approved guardrail/approval ref or the decision blocks.
23. `FPS-R23` Loading/empty/error/rejection/denial feedback states explain safe bounded state and available next action.
24. `FPS-R24` Represent copy role/action intent and refs; do not fabricate product voice/localized strings.
25. `FPS-R25` Require meaningful semantic structure intent.
26. `FPS-R26` Every interaction intent is keyboard reachable; pointer/hover-only access is invalid.
27. `FPS-R27` Focus order, visible focus, context-entry focus and restoration are explicit where applicable.
28. `FPS-R28` Controls/fields/errors/status have accessible-name/description/association intent.
29. `FPS-R29` Important async/result changes include nonvisual status-announcement intent.
30. `FPS-R30` Do not claim contrast/target/browser/WCAG conformance without executable evidence.
31. `FPS-R31` Motion intent declares reduced-motion behavior when motion exists.
32. `FPS-R32` Constrained layouts preserve primary goal/action, current status and recovery.
33. `FPS-R33` Overflow-prone content has a deliberate wrap/reflow/scroll/alternate strategy.
34. `FPS-R34` Hidden/disabled UI is never authorization enforcement.
35. `FPS-R35` S13I-derived facts are immutable.
36. `FPS-R36` Do not pull forward S13L/S13O/S13P/S13Q/S13R/S14.
37. `FPS-R37` Gate the actual parsed candidate; never substitute a synthesized faithful answer.
38. `FPS-R38` Gate recomputes terminal status/blockers.
39. `FPS-R39` Planned accessibility/responsive behavior is not described as verified without evidence.
40. `FPS-R40` Skill effectiveness must traverse unchanged S12→S10→S09.
41. `FPS-R41` Reference provider cannot import frozen truth or branch on fixture id, Skill id or arm flag.
42. `FPS-R42` OI-A A/B/C observations are distinct; frozen truth is independent; raw contribution counts are exposed.
43. `FPS-R43` No frontend/DOM/browser/server runtime or dependency is introduced.
44. `FPS-R44` Outputs remain framework-neutral and never encode React/Vue/Svelte/component-library APIs.

## Procedure

1. Validate bounded input and record missing/contradictory facts.
2. Extract actors, goals, entries, acceptance and immutable operation facts.
3. Build flow graph with terminals, recovery, back and cancel transitions.
4. Inventory semantic surfaces and information/action priority.
5. Derive complete state applicability per surface/operation.
6. Derive form/submission contracts.
7. Derive feedback/retry/approval/destructive affordances strictly from approved facts.
8. Derive accessibility interaction requirements and evidence limits.
9. Derive responsive/adaptive and overflow intent.
10. Build traceability from requirements to flows/surfaces/states.
11. Validate the actual candidate and recompute blockers/status.
12. Emit evidence requirements and explicit adjacent-stage handoffs.

## Required verification

At least six positives, meaningful negatives, anti-substitution regression, real S12→S10→S09 run, frozen provider-blind Skill-vs-no-Skill comparison, no forbidden dependency/stage pull-forward, full deterministic QA and fresh independent verification.

---

## FILE: brain-bootstrap/quality-contracts/S13K_FRONTEND_PRODUCT_SURFACE_DEEP.yaml

```yaml
id: S13K_FRONTEND_PRODUCT_SURFACE_DEEP
version: 1.0.0
status: CANONICAL
depth: DEEP
risk: HIGH
ambiguity: HIGH
novelty: MEDIUM
irreversibility: MEDIUM

evidence:
  required: true
  primary_sources_preferred: true
  cross_validation: true
  no_conformance_claim_without_executable_evidence: true
research:
  knowledge_gaps_required: true
  alternatives_required: false
implementation:
  tests_required: true
  deterministic_checks_required: true
  tradeoffs_required: true
uncertainty:
  explicit: true
execution:
  mode: SKILL_ONLY
  new_agent_definition: FORBIDDEN
  core_role_or_skill_branch: FORBIDDEN
  side_effects: [NONE]
  frontend_runtime_dependency: FORBIDDEN
  browser_or_dom_execution: FORBIDDEN
  provider_binding: FORBIDDEN
fixtures:
  minimum_positive_evaluable: 6
  minimum_negative: 30
  canonical_positive_ids: [FPS-POS-001, FPS-POS-002, FPS-POS-003, FPS-POS-004, FPS-POS-005, FPS-POS-006]

hard_invariants:
  - {id: HI-001, rule: "Input has actor, goal, entry, acceptance and traceable spec/source refs."}
  - {id: HI-002, rule: "Candidate invents no actor, goal, permission, tenant policy, API state, field, business rule, branding or localization."}
  - {id: HI-003, rule: "Every goal has a reachable canonical terminal."}
  - {id: HI-004, rule: "Every entry identifies actor and goal/source refs."}
  - {id: HI-005, rule: "Reachable nonterminal nodes have outgoing transition or explicit external blocker."}
  - {id: HI-006, rule: "Every recoverable failure exposes a recovery transition."}
  - {id: HI-007, rule: "Back/cancel cannot bypass approval/destructive requirements."}
  - {id: HI-008, rule: "Surface inventory is semantic and framework-neutral."}
  - {id: HI-009, rule: "Every surface declares purpose, primary content, action-or-rationale and priority."}
  - {id: HI-010, rule: "Canonical state applicability is explicit."}
  - {id: HI-011, rule: "Async operations include loading, success and declared failures."}
  - {id: HI-012, rule: "Zero-capable collections include EMPTY."}
  - {id: HI-013, rule: "Forms include distinct validation/error presentation."}
  - {id: HI-014, rule: "Declared authorization denial is represented without client-side enforcement claim."}
  - {id: HI-015, rule: "Approval flows include pending, approved and rejected without auto-approval."}
  - {id: HI-016, rule: "Retry affordance requires explicit bounded authorization and does not implement S13O mechanics."}
  - {id: HI-017, rule: "Unsafe retry for non-idempotent/destructive/external effects is not invented."}
  - {id: HI-018, rule: "Form field ids, requiredness and validation intent are preserved."}
  - {id: HI-019, rule: "Errors are associated and not color-only."}
  - {id: HI-020, rule: "Recoverable failures preserve entered values unless explicit policy says otherwise."}
  - {id: HI-021, rule: "In-flight submission prevents duplicate activation without server-idempotency claim."}
  - {id: HI-022, rule: "Destructive actions require approved guardrail/approval ref or BLOCKED."}
  - {id: HI-023, rule: "Feedback states expose safe state and next-action intent when available."}
  - {id: HI-024, rule: "Product voice, localized strings and branding are not fabricated."}
  - {id: HI-025, rule: "Semantic structure intent is present."}
  - {id: HI-026, rule: "Every interaction intent is keyboard reachable; pointer-only is forbidden."}
  - {id: HI-027, rule: "Focus order and visible focus are explicit."}
  - {id: HI-028, rule: "Context changes define initial/restored focus where applicable."}
  - {id: HI-029, rule: "Controls/fields/errors/status have accessible-name/association/announcement intent."}
  - {id: HI-030, rule: "Meaning does not rely on color alone."}
  - {id: HI-031, rule: "Motion plans include reduced-motion behavior when applicable."}
  - {id: HI-032, rule: "No unsupported browser/WCAG/contrast/target conformance claim is made."}
  - {id: HI-033, rule: "Responsive intent preserves primary goal/action, current status and recovery."}
  - {id: HI-034, rule: "Overflow-prone content has explicit strategy."}
  - {id: HI-035, rule: "UI visibility/disabled state is never authorization enforcement."}
  - {id: HI-036, rule: "S13I-derived upstream facts are immutable."}
  - {id: HI-037, rule: "S13L/S13O/S13P/S13Q/S13R/S14 are not pulled forward."}
  - {id: HI-038, rule: "The actual parsed candidate is the object deterministically validated."}
  - {id: HI-039, rule: "Gate recomputes status/blockers and never substitutes faithful synthesized output."}
  - {id: HI-040, rule: "Real proof traverses S12 metadata discovery/lazy-load, S10 compile and S09 runtime."}
  - {id: HI-041, rule: "Reference provider has no frozen-truth import or fixture/Skill/arm branch."}
  - {id: HI-042, rule: "OI-A truth is provider-blind, A/B/C are distinct, raw contributions exposed, XC excluded from qualification."}
  - {id: HI-043, rule: "No frontend framework, DOM/browser runtime, CSS/component system, server/auth/telemetry/deployment/Capability Registry is introduced."}
  - {id: HI-044, rule: "Output contains no framework/component-library APIs."}

semantic_dimensions:
  - {id: SD-001, name: flow_goal_reachability_and_recovery, assertions: [SD1-A, SD1-B, SD1-C]}
  - {id: SD-002, name: surface_inventory_information_hierarchy_traceability, assertions: [SD2-A, SD2-B, SD2-C]}
  - {id: SD-003, name: state_matrix_completeness_and_distinction, assertions: [SD3-A, SD3-B, SD3-C]}
  - {id: SD-004, name: form_validation_and_submit_integrity, assertions: [SD4-A, SD4-B, SD4-C]}
  - {id: SD-005, name: feedback_error_retry_and_input_recovery, assertions: [SD5-A, SD5-B, SD5-C]}
  - {id: SD-006, name: approval_destructive_auth_boundary, assertions: [SD6-A, SD6-B, SD6-C]}
  - {id: SD-007, name: semantic_accessible_names_errors_and_status, assertions: [SD7-A, SD7-B, SD7-C]}
  - {id: SD-008, name: keyboard_focus_motion_and_nonvisual_access, assertions: [SD8-A, SD8-B, SD8-C]}
  - {id: SD-009, name: responsive_priority_overflow_and_content_intent, assertions: [SD9-A, SD9-B, SD9-C]}
  - {id: SD-010, name: authority_evidence_stage_boundaries_and_gate_honesty, assertions: [SD10-A, SD10-B, SD10-C]}

skill_vs_no_skill:
  metric_id: S13K-FRONTEND-PRODUCT-SURFACE-OI-A
  arms: {same_inputs: true, same_host: true, same_model_provider_class: true, same_capability_provider: true, same_parser_gate_evaluator: true, only_skill_materialization_differs: true}
  scoring:
    dimensional_assertions_per_fixture: 30
    cross_cutting_assertions_per_fixture: 1
    cross_cutting_can_qualify_dimension: false
    frozen_truth_provider_blind: true
    distinct_assertion_observations_required: true
    expose_raw_per_assertion_contributions: true
    max_single_assertion_share_formula: "max(per_assertion_improved_instance_count) / total_dimension_improvement"
  thresholds:
    hard_invariant_score_with_skill: 1.0
    minimum_dimension_specific_total_delta: 12
    minimum_distinct_dimensions: 5
    minimum_scored_assertions_per_qualified_dimension: 3
    minimum_improvement_per_qualified_dimension: 2
    maximum_single_assertion_share_of_dimension_improvement: 0.5
    hard_invariant_regression_allowed: false
    unsafe_counters_with_skill_must_all_equal_zero: true
  unsafe_counters:
    - dead_end_or_unrecoverable_flow_recommendations
    - unsafe_retry_or_duplicate_submit_recommendations
    - destructive_or_approval_guardrail_bypass_recommendations
    - inaccessible_interaction_recommendations
    - framework_provider_or_future_stage_pull_forward_violations

evidence_categories: [CONTRACT_INSPECTION, FLOW_GRAPH_CHECK, STATE_MATRIX_CHECK, FORM_INTERACTION_CHECK, ACCESSIBILITY_INTENT_CHECK, RESPONSIVE_INTENT_CHECK, TRACEABILITY_CHECK, NEGATIVE_FIXTURE, REAL_AGENT_RUNTIME, SKILL_VS_NO_SKILL, TYPECHECK, BUILD, FULL_TEST_SUITE, CLEAN_BUILD, POST_BUILD_TEST_SUITE, SOURCE_BOUNDARY_CHECK, INDEPENDENT_VERIFICATION]
pass_conditions:
  - all hard invariants pass
  - fixture minimums pass
  - real S12-S10-S09 runtime proof passes
  - OI-A thresholds pass with provider-blind truth
  - unsafe counters are zero with Skill
  - Part A remains byte-identical
  - no forbidden dependency/stage pull-forward exists
  - fresh non-authoring read-only verifier returns PASS
fail_conditions:
  - semantic mismatch or fabricated facts
  - actual-candidate substitution/self-certification
  - dead-end, recovery or required-state omission
  - inaccessible/unsafe retry/destructive behavior
  - OI-A oracle leakage/aliased observations
  - framework/browser/provider/future-stage pull-forward
  - missing independent verification
```

---

## FILE: brain-bootstrap/specs/FRONTEND_PRODUCT_SURFACE_CONTRACT_S13K.md

# Frontend Product Surface Contract — S13K

## 1. Scope

S13K defines reusable Intelligence-layer planning for user-facing product surfaces before concrete frontend implementation. It owns user-flow topology, semantic surface inventory, state completeness, form/submission behavior, feedback/recovery affordances, approved approval/rejection/destructive surface behavior, responsive intent, basic accessibility interaction requirements, traceability and deterministic validation.

It does not own rendering, framework/CSS/design system, browser automation, auth/security policy, retry mechanics, telemetry, delivery, deployment or capability binding.

## 2. Execution

```text
S12 discover/lazy-load → S10 compile → S09 runAgent → parse actual candidate → deterministic S13K gate → READY|BLOCKED
```

Mode: `SKILL_ONLY`. Caller-supplied generic host is sufficient. Dedicated S13K AgentDefinition is forbidden.

## 3. TypeScript-compatible contract

```ts
export type SurfaceDecisionStatus = "READY" | "BLOCKED";
export type SurfaceApplicability = "REQUIRED" | "NOT_APPLICABLE" | "DEFERRED_WITH_BLOCKER";
export type FlowTerminalClass = "SUCCESS" | "CANCELLED" | "REJECTED" | "PERMISSION_DENIED" | "BLOCKED_EXTERNALLY";
export type SurfaceKind = "PAGE" | "REGION" | "DIALOG" | "NOTIFICATION" | "FORM" | "COLLECTION" | "DETAIL" | "NONVISUAL_INTERACTION";
export type InteractionStateKind = "INITIAL" | "LOADING" | "EMPTY" | "SUCCESS" | "VALIDATION_ERROR" | "DOMAIN_ERROR" | "UNAVAILABLE" | "RETRY_AVAILABLE" | "DISABLED" | "APPROVAL_PENDING" | "APPROVED" | "REJECTED" | "PERMISSION_DENIED";
export type ContentPriority = "P0_PRIMARY" | "P1_SUPPORTING" | "P2_DEFERABLE";
export type ApiEffectClass = "READ" | "IDEMPOTENT_WRITE" | "NON_IDEMPOTENT_WRITE" | "EXTERNAL_SIDE_EFFECT";

export interface SurfaceActorIntent { id: string; description: string; source_refs: string[]; }
export interface SurfaceGoalIntent { id: string; actor_refs: string[]; description: string; source_refs: string[]; }
export interface SurfaceEntryIntent { id: string; actor_refs: string[]; goal_refs: string[]; description: string; source_refs: string[]; }
export interface SurfaceFieldIntent { id: string; label_intent: string; instruction_ref?: string; required: boolean; input_kind: "TEXT"|"NUMBER"|"BOOLEAN"|"CHOICE"|"DATE"|"DATETIME"|"FILE"|"OTHER"; validation_refs: string[]; sensitive: boolean; source_refs: string[]; }
export interface SurfaceErrorIntent { code: string; class: "VALIDATION"|"DOMAIN"|"AUTHENTICATION"|"AUTHORIZATION"|"NOT_FOUND"|"CONFLICT"|"UNAVAILABLE"|"OTHER_SAFE"; recoverable: boolean; user_action_intent?: string; source_refs: string[]; }
export interface SurfaceOperationIntent {
  id: string; purpose: string; effect_class: ApiEffectClass; async: boolean; may_return_empty: boolean;
  fields: SurfaceFieldIntent[]; safe_error_variants: SurfaceErrorIntent[];
  authentication_required: boolean; authorization_denied_possible: boolean;
  retry_affordance: "NOT_ALLOWED"|"ALLOWED_BY_APPROVED_INPUT"|"REQUIRES_CONFIRMATION_OR_APPROVAL";
  retry_policy_ref?: string; destructive: boolean; destructive_guardrail_ref?: string;
  approval_requirement: "NONE"|"HUMAN_APPROVAL_REQUIRED"; approval_policy_ref?: string; source_refs: string[];
}
export interface ResponsiveConstraintIntent { id: string; description: string; priority: ContentPriority; constrained_width_behavior: "PRESERVE"|"REFLOW"|"WRAP"|"SCROLL_WITH_CONTEXT"|"ALTERNATE_PRESENTATION"|"DEFER_P2_ONLY"; source_refs: string[]; }
export interface AccessibilityIntent { keyboard_required: true; visible_focus_required: true; focus_restoration_required_for_context_changes: true; non_color_only_meaning_required: true; status_announcement_required_for_async_changes: true; reduced_motion_required_when_motion_present: true; contrast_evidence_required: true; target_size_evidence_required: true; conformance_claim_allowed_without_executable_evidence: false; }
export interface ApprovedSurfacePolicyRefs { security_policy_refs: string[]; destructive_action_policy_refs: string[]; retry_policy_refs: string[]; approval_policy_refs: string[]; content_style_refs: string[]; localization_refs: string[]; }
export interface FrontendProductSurfaceInput { task_ref: string; spec_refs: string[]; actors: SurfaceActorIntent[]; goals: SurfaceGoalIntent[]; entries: SurfaceEntryIntent[]; operations: SurfaceOperationIntent[]; responsive_constraints: ResponsiveConstraintIntent[]; accessibility_intent: AccessibilityIntent; approved_policy_refs: ApprovedSurfacePolicyRefs; acceptance: Array<{id:string;statement:string;source_refs:string[]}>; evidence_required: Array<{kind:string;description:string;source_ref?:string}>; }

export interface FlowNode { id: string; kind: "ENTRY"|"SURFACE"|"ACTION"|"DECISION"|"WAITING"|"TERMINAL"; actor_refs: string[]; goal_refs: string[]; surface_ref?: string; operation_ref?: string; terminal_class?: FlowTerminalClass; source_refs: string[]; }
export interface FlowTransition { id: string; from: string; to: string; trigger: "ENTER"|"ACTIVATE"|"SUBMIT"|"SUCCESS"|"VALIDATION_FAILURE"|"DOMAIN_FAILURE"|"UNAVAILABLE"|"RETRY"|"BACK"|"CANCEL"|"APPROVED"|"REJECTED"|"PERMISSION_DENIED"; recoverable: boolean; guardrail_ref?: string; source_refs: string[]; }
export interface UserFlowGraph { nodes: FlowNode[]; transitions: FlowTransition[]; entry_node_refs: string[]; goal_terminal_refs: Record<string,string[]>; }
export interface SurfaceDefinition { id: string; kind: SurfaceKind; purpose: string; actor_refs: string[]; goal_refs: string[]; primary_content_refs: string[]; primary_action_intent?: string; no_primary_action_rationale?: string; content_priority: ContentPriority; semantic_structure_intent: string[]; source_refs: string[]; }
export interface SurfaceStateRequirement { surface_ref: string; operation_ref?: string; state: InteractionStateKind; applicability: SurfaceApplicability; rationale: string; message_role?: "INFORMATION"|"PROGRESS"|"EMPTY"|"ERROR"|"SUCCESS"|"WARNING"|"STATUS"; action_intent?: string; source_refs: string[]; }
export interface FormInteractionContract { surface_ref: string; operation_ref: string; field_refs: string[]; preserve_values_on_recoverable_failure: boolean; prevent_duplicate_submit_while_in_flight: boolean; validation_timing: "ON_SUBMIT"|"ON_BLUR_AND_SUBMIT"|"EXPLICIT_INPUT_POLICY"; field_error_association_required: boolean; form_error_summary_required: boolean; cancel_behavior: string; destructive_guardrail_ref?: string; source_refs: string[]; }
export interface AccessibilityInteractionContract { surface_ref: string; semantic_structure_required: boolean; keyboard_reachable: boolean; focus_order_intent: string[]; visible_focus_required: boolean; initial_focus_intent?: string; restore_focus_intent?: string; accessible_name_refs: string[]; description_error_association_refs: string[]; status_announcement_refs: string[]; non_color_only_meaning: boolean; reduced_motion_intent: "NOT_APPLICABLE"|"REQUIRED"; contrast_evidence_required: boolean; target_size_evidence_required: boolean; browser_conformance_claim: false; }
export interface ResponsiveSurfaceContract { surface_ref: string; priority: ContentPriority; constrained_width_behavior: string; overflow_strategy: string; preserves_primary_action: boolean; preserves_error_or_approval_status: boolean; preserves_recovery_action: boolean; source_refs: string[]; }
export interface StageBoundaryHandoffs { deferred_to_s13l: string[]; deferred_to_s13o: string[]; deferred_to_s13p: string[]; deferred_to_s13q: string[]; deferred_to_s13r: string[]; deferred_to_s14: string[]; }
export interface FrontendProductSurfaceDecision { status: SurfaceDecisionStatus; blockers: string[]; task_ref: string; spec_refs: string[]; flow_graph: UserFlowGraph; surfaces: SurfaceDefinition[]; state_matrix: SurfaceStateRequirement[]; forms: FormInteractionContract[]; accessibility: AccessibilityInteractionContract[]; responsive: ResponsiveSurfaceContract[]; traceability: Array<{requirement_ref:string;flow_refs:string[];surface_refs:string[];state_refs:string[]}>; boundaries: StageBoundaryHandoffs; acceptance: FrontendProductSurfaceInput["acceptance"]; evidence_required: FrontendProductSurfaceInput["evidence_required"]; }
export interface FrontendProductSurfaceValidation { valid: boolean; errors: string[]; checked_invariant_ids: string[]; }
```

## 4. Input authority

Input is bounded and immutable. S13I-derived operation/error/auth facts may be projected only from supplied facts and source refs. Unknown facts remain blockers/gaps.

## 5. Flow rules

Every entry has an ENTRY node; every goal reaches a canonical terminal; reachable nonterminals cannot dead-end; recoverable failures require recovery; retry transitions require explicit retry authorization; back/cancel cannot bypass approved guardrails.

## 6. Semantic surfaces

Allowed surface kinds are semantic. Framework component names, CSS classes, DOM selectors, routers/toasts/modal APIs and browser locators are forbidden.

## 7. State derivation

For each relevant surface/operation, all canonical states receive explicit applicability. Async → loading/success/declared failures. Zero-capable collection → empty. Fields → validation error. Authorization-denied possible → permission denied. Human approval → pending/approved/rejected. Approved retry → retry available. In-flight submit → duplicate-activation prevention/disabled. Unavailable variant → unavailable. Empty, validation, domain/system and denied remain distinct.

## 8. Forms/feedback

Forms preserve field refs/requiredness/validation, associate errors, preserve recoverable input, prevent duplicate submission, expose cancel behavior and require approved destructive guardrails. Feedback records message role and safe bounded next-action intent; finalized product voice/localization is not invented.

## 9. Approval/security/reliability boundaries

Approval/security policy comes from input; no auto-approval, tenant inference or UI-as-authorization. Retry affordance comes from input; no backoff/idempotency/job implementation.

## 10. Accessibility

Require semantic structure, keyboard reachability, visible focus, focus order/restoration, accessible names, error/description association, async status announcement, non-color-only meaning, reduced-motion behavior when applicable, and contrast/target-size evidence requirements. Actual browser/WCAG conformance cannot be claimed here.

## 11. Responsive intent

At constrained widths preserve P0 primary action, current error/approval/denial status and required recovery. P2 may defer. Overflow requires explicit strategy. Do not invent breakpoints.

## 12. Anti-self-certification

`candidate = parse(run.output.data)` → validate that exact candidate against input → clone candidate → recompute `status/blockers`. Invalid candidate content is preserved; gate never invokes a faithful synthesizer to replace it.

## 13. Reference provider/evaluator

Provider may use bounded input + materialized rule prose only. No frozen truth/evaluator import, fixture-id/Skill-id/arm branch or shared truth helper. Evaluator truth is provider-blind and A/B/C observations are distinct.

## 14. Positives

`FPS-POS-001` public collection/search with loading/success/empty/unavailable/recovery; `002` authenticated non-idempotent create form; `003` destructive delete with approved guardrail; `004` human approval pending/approved/rejected; `005` responsive detail + explicitly retryable async refresh; `006` permission-denied possibility + contextual dialog/focus lifecycle.

## 15. Negatives

At minimum: unreachable goal, dead end, missing recovery, guardrail bypass, invented actor/goal/API state, missing loading/empty/validation/permission/rejected states, conflated errors, auto-approval, unauthorized/unsafe retry, duplicate submit, lost recoverable input, unassociated error, color-only meaning, pointer-only interaction, missing focus lifecycle/name/status announcement/reduced-motion, unsupported conformance claim, constrained layout hiding primary/recovery, missing overflow strategy, UI-as-auth, invented tenant/security policy, framework/browser/provider/future-stage pull-forward, candidate substitution, provider truth leakage, aliased A/B/C, and cross-cutting dimension qualification.

## 16. OI-A

Same six inputs/host/provider class/capability provider/parser/gate/evaluator; only Skill materialization differs. Per fixture: 30 dimensional + 1 cross-cutting observations. Dimension qualifies only if scored observations >=3, delta >=2, and max single assertion share <=0.5. Global: hard invariants 100%, unsafe counters zero, dimension delta >=12, >=5 qualified dimensions, no hard regression.

Distinct A/B/C observations:
- SD-001 goal terminal / dead-end absence / recovery.
- SD-002 bounded refs / hierarchy completeness / traceability.
- SD-003 required state presence / explicit applicability / state distinction.
- SD-004 field fidelity / error association / duplicate-submit+cancel.
- SD-005 value preservation / actionable feedback / retry authorization.
- SD-006 approval lifecycle / destructive guardrail / auth-boundary honesty.
- SD-007 semantics / names+errors / status announcements.
- SD-008 keyboard+visible focus / focus lifecycle / non-color+reduced motion.
- SD-009 constrained priority / recovery+overflow / no invented copy/breakpoints.
- SD-010 immutable upstream+no policy invention / no forbidden binding / gate+evidence honesty.

Cross-cutting `XC-A` checks READY for positive fixtures only and cannot qualify dimensions.

Unsafe counters: dead-end/unrecoverable flow, unsafe retry/duplicate submit, destructive/approval bypass, inaccessible interaction, and framework/provider/future-stage pull-forward; all zero with Skill.

## 17. T1–T100 matrix

T1 valid input; T2 immutability; T3 missing bounded intent; T4 invented facts; T5 goal terminal; T6 unreachable terminal; T7 dead end; T8 missing recovery; T9 cancel; T10 guardrail bypass; T11 terminal classes; T12 traceability. T13 neutral surface kinds; T14 framework binding; T15 purpose; T16 primary content; T17 action/rationale; T18 priority; T19 valid refs; T20 acceptance traceability. T21 loading; T22 success; T23 declared failures; T24 empty; T25 validation; T26 denied; T27 pending; T28 approved; T29 rejected; T30 retry; T31 explicit applicability; T32 empty distinct; T33 validation distinct; T34 in-flight duplicate prevention. T35 field refs; T36 requiredness; T37 validation refs; T38 field error association; T39 form summary; T40 preserve values; T41 duplicate prevention; T42 missing prevention blocks; T43 cancel; T44 destructive guardrail; T45 message role; T46 next action; T47 invented voice; T48 unsafe retry. T49 approval lifecycle; T50 auto-approval; T51 destructive transition protected; T52 missing guardrail; T53 permission denied; T54 UI-as-auth; T55 invented security/tenant; T56 S13L handoff. T57 semantics; T58 keyboard; T59 pointer-only; T60 visible focus; T61 focus order; T62 initial focus; T63 restore focus; T64 accessible names; T65 error associations; T66 status announcement; T67 color-only; T68 reduced motion; T69 contrast evidence; T70 target evidence; T71 unsupported conformance; T72 nonvisual interaction. T73 responsive contract; T74 primary preserved; T75 status preserved; T76 recovery preserved; T77 P2 defer; T78 overflow; T79 invented breakpoint; T80 neutral responsive. T81 typed Skill; T82 no AgentDefinition; T83 no Core branch; T84 metadata discovery; T85 lazy load; T86 S10 compile; T87 S09 run; T88 actual candidate; T89 corrupt field preserved; T90 corrupt blocks; T91 candidate required; T92 terminal recompute; T93 no truth import; T94 no fixture/Skill/arm branch; T95 independent truth; T96 distinct A/B/C; T97 raw contribution formula; T98 XC excluded; T99 no forbidden pull-forward; T100 prior/full/typecheck/clean-build/post-build green.

## 18. Allowed Part B scope

Allowed: `src/intelligence/frontend-product-surface/**`, `src/intelligence/skills/definitions/frontendProductSurfaceS13K.ts`, append-only `src/intelligence/skills/index.ts`, `tests/frontend-product-surface/**`, S13K reports/handoffs and mechanical STATE/CURRENT updates. A prior test may be mechanically relaxed only if it assumed S13J stayed permanently last in the append-only catalog.

Forbidden: semantic `src/core/**` changes, dependency additions, frontend app/framework/DOM/CSS/browser/server/auth/telemetry/deployment/capability implementation, or S13L/S13O/S13P/S13Q/S13R/S14 implementation.

## 19. Evidence and PASS

Require Part A hashes/YAML parse, typed Skill projection, fixture counts, invariants, real S12→S10→S09 run, anti-substitution, frozen truth, distinct observations, raw contributions, unsafe counters, boundary/dependency scans, typecheck, focused/full tests, dist-absent clean build, post-build suite and fresh non-authoring read-only independent verification.

S13K closes only when all are PASS and Part A is unchanged. Until then S13L is forbidden.

## 20. Explicit unresolved gaps

Do not invent concrete visual design, route tree/DOM, exact viewport/browser matrix, branding/design tokens, final copy, localization, executable accessibility audit, analytics, real security policy, retry runtime or production frontend deployment.
