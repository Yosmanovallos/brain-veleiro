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
