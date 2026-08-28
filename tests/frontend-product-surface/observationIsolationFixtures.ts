import type { FrontendProductSurfaceDecision } from "../../src/intelligence/frontend-product-surface/types.js";

export const DIMENSION_OBSERVATION_IDS = [...Array(10)].flatMap((_, dimension) => ["A", "B", "C"].map((suffix) => `SD${dimension + 1}-${suffix}`));

/** Hand-authored probe fixture: it imports no truth, provider, synthesizer, parser, gate or evaluator. */
export const OBSERVATION_ISOLATION_DECISION: FrontendProductSurfaceDecision = {
  status: "READY", blockers: [], task_ref: "probe:task", spec_refs: ["probe:spec"],
  flow_graph: {
    entry_node_ids: ["probe:entry"], goal_node_ids: ["probe:goal"], interruptible_exit_policy_refs: ["probe:exit"],
    nodes: [{ id: "probe:entry", kind: "PAGE", purpose: "Enter", source_refs: ["probe:spec"], terminal: false }, { id: "probe:goal", kind: "TERMINAL", purpose: "Finish", source_refs: ["probe:spec"], terminal: true }],
    edges: [{ id: "probe:edge", from: "probe:entry", to: "probe:goal", trigger: "continue", condition_source_refs: ["probe:spec"], recovery: false }],
  },
  surfaces: [{ surface_ref: "probe:surface", kind: "PAGE", priority: "PRIMARY", goal_refs: ["probe:goal"], source_refs: ["probe:spec"] }],
  state_matrix: [{ surface_ref: "probe:surface", state: "SUCCESS", applicable: true, upstream_variant_refs: ["probe:variant"], copy_intent: "Explain success.", available_action_refs: ["probe:action"], recovery_action_refs: ["probe:exit"], announcement_required: false, source_refs: ["probe:source"] }],
  forms: [{ form_ref: "probe:form", field_refs: ["probe:field"], submit_lifecycle: ["IDLE", "SUBMITTING", "SUCCESS_OR_ERROR"], duplicate_submit_disabled_while_pending: true, preserve_input_on_recoverable_error: true, cancel_exit_policy: "probe:cancel", destructive_guardrail_ref: "probe:guardrail" }],
  retries: [{ source_variant_ref: "probe:variant", allowed: true, authorization_ref: "probe:retry-policy" }],
  approvals: [{ approval_ref: "probe:approval", pending_state_ref: "probe:pending", approved_state_ref: "probe:approved", rejected_state_ref: "probe:rejected", frontend_can_self_approve: false }],
  accessibility: { semantic_structure_required: true, keyboard_required_action_refs: ["probe:action"], focus_order_refs: ["probe:surface"], focus_restore_transition_refs: ["probe:edge"], visible_focus_required: true, accessible_name_control_refs: ["probe:field"], description_association_refs: ["probe:description"], error_association_refs: ["probe:error"], announcement_state_refs: ["probe:state"], contrast_policy_ref: "probe:contrast", reduced_motion_policy_ref: "probe:motion", touch_target_policy_ref: "probe:touch", exception_refs: [], browser_conformance_claimed: false },
  responsive: [{ surface_ref: "probe:surface", viewport: "NARROW", primary_content_refs: ["probe:content"], primary_action_refs: ["probe:action"], overflow_strategy: "probe:reflow", semantic_order_preserved: true, focus_order_preserved: true }],
  traceability: [{ artifact_ref: "probe:artifact", source_refs: ["probe:source"] }],
  acceptance: [{ id: "probe:acceptance", condition: "accepted" }], evidence_required: [{ kind: "CONTRACT_TEST", description: "probe evidence" }],
  deferred_to_s13l: ["probe:security"], deferred_to_s13o: ["probe:retry"], deferred_to_s13p: ["probe:observability"], deferred_to_s13q: ["probe:delivery"], deferred_to_s13r: ["probe:deployment"], deferred_to_s14: ["probe:capability"],
};

export const OBSERVATION_ATOMIC_MUTATIONS: Record<string, (decision: FrontendProductSurfaceDecision) => void> = {
  "SD1-A": (d) => { d.flow_graph.edges[0].to = "probe:unreachable"; },
  "SD1-B": (d) => { d.flow_graph.nodes[0].terminal = true; },
  "SD1-C": (d) => { d.flow_graph.edges[0].recovery = true; },
  "SD2-A": (d) => { d.surfaces[0].kind = "REGION"; },
  "SD2-B": (d) => { d.surfaces[0].priority = "SECONDARY"; },
  "SD2-C": (d) => { d.surfaces[0].goal_refs[0] = "probe:other-goal"; },
  "SD3-A": (d) => { d.state_matrix[0].state = "EMPTY"; },
  "SD3-B": (d) => { d.state_matrix[0].upstream_variant_refs[0] = "probe:other-variant"; },
  "SD3-C": (d) => { d.state_matrix[0].announcement_required = true; },
  "SD4-A": (d) => { d.forms[0].field_refs[0] = "probe:other-field"; },
  "SD4-B": (d) => { d.forms[0].duplicate_submit_disabled_while_pending = false; },
  "SD4-C": (d) => { d.forms[0].preserve_input_on_recoverable_error = false; },
  "SD5-A": (d) => { d.retries[0].allowed = false; },
  "SD5-B": (d) => { d.approvals[0].pending_state_ref = "probe:other-pending"; },
  "SD5-C": (d) => { (d.approvals[0] as unknown as { frontend_can_self_approve: boolean }).frontend_can_self_approve = true; },
  "SD6-A": (d) => { d.accessibility.visible_focus_required = false; },
  "SD6-B": (d) => { d.accessibility.accessible_name_control_refs[0] = "probe:other-name"; },
  "SD6-C": (d) => { d.accessibility.focus_order_refs[0] = "probe:other-focus"; },
  "SD7-A": (d) => { d.responsive[0].viewport = "MEDIUM"; },
  "SD7-B": (d) => { d.responsive[0].primary_content_refs[0] = "probe:other-content"; },
  "SD7-C": (d) => { d.responsive[0].semantic_order_preserved = false; },
  "SD8-A": (d) => { d.traceability[0].artifact_ref = "probe:other-artifact"; },
  "SD8-B": (d) => { d.traceability[0].source_refs[0] = "probe:other-source"; },
  "SD8-C": (d) => { d.retries[0].source_variant_ref = "probe:other-retry-variant"; },
  "SD9-A": (d) => { d.task_ref = "probe:other-task"; },
  "SD9-B": (d) => { (d.acceptance[0] as { condition: string }).condition = "changed"; },
  "SD9-C": (d) => { (d.evidence_required[0] as { description: string }).description = "changed"; },
  "SD10-A": (d) => { d.deferred_to_s13l[0] = "probe:other-security"; },
  "SD10-B": (d) => { d.deferred_to_s13q[0] = "probe:other-delivery"; },
  "SD10-C": (d) => { d.status = "BLOCKED"; },
};
