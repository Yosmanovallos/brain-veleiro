import type { AgentDefinition, ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import { FRONTEND_PRODUCT_SURFACE_INPUT_MARKER, deriveFrontendSurfaceProfileFromRules, synthesizeFrontendProductSurfaceDecision, type FrontendProductSurfaceDecision, type FrontendProductSurfaceInput } from "../../src/intelligence/frontend-product-surface/index.js";
import { frontendProductSurfaceS13K } from "../../src/intelligence/skills/index.js";
import { ALL_POSITIVE_INPUTS, FX_POS_001, FX_POS_002, FX_POS_003, FX_POS_004, FX_POS_005, FX_POS_006 } from "./fixtureInputs.js";
export { ALL_POSITIVE_INPUTS, FX_POS_001, FX_POS_002, FX_POS_003, FX_POS_004, FX_POS_005, FX_POS_006, baseFrontendSurfaceInput } from "./fixtureInputs.js";

const OUTPUT_SCHEMA = { type: "object", required: ["summary"], properties: { summary: { type: "string" }, data: {}, evidence_refs: { type: "array" } }, additionalProperties: false };
export const frontendSurfaceHost: AgentDefinition = { id: "s13k-generic-skill-host", role: "generic-skill-host", objective: "Produce a bounded render-neutral product-surface decision from supplied product facts.", model_policy: { routing_class: "QUALITY", require_structured_decisions: true, allow_provider_substitution: true }, context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 16000, max_items: 50, allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF"], require_source_refs: true }, state_schema: { type: "object", additionalProperties: false, properties: { selected: { type: "string" } } }, tools: [], skills: [frontendProductSurfaceS13K.id], capabilities: [], memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" }, permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true }, delegation: { allowed: false }, limits: { max_turns: 3, timeout_ms: 15000 }, termination: { require_terminal_outcome: true, require_explanation: true }, output_schema: structuredClone(OUTPUT_SCHEMA), rubric: { quality_contract_ref: "S13K_FRONTEND_PRODUCT_SURFACE_DEEP" }, evals: ["evals/s13k/host-run"] };

function negative(index: number, source: FrontendProductSurfaceInput, mutate: (input: FrontendProductSurfaceInput, decision: FrontendProductSurfaceDecision) => void) { const input = structuredClone(source); const decision = synthesizeFrontendProductSurfaceDecision(input, { complete_states: true, complete_forms: true, safe_boundaries: true, complete_accessibility: true, complete_responsive: true, complete_traceability: true, explicit_deferrals: true }); mutate(input, decision); return { id: `FX-NEG-${String(index).padStart(3, "0")}`, input, decision }; }
export const ALL_NEGATIVE_FIXTURES = [
  negative(1, FX_POS_001, (_i, d) => { d.flow_graph.edges = []; }),
  negative(2, FX_POS_001, (_i, d) => { d.surfaces = d.surfaces.filter((s) => s.surface_ref !== d.flow_graph.entry_node_ids[0]); }),
  negative(3, FX_POS_001, (_i, d) => { d.flow_graph.edges = []; d.flow_graph.goal_node_ids = []; }),
  negative(4, FX_POS_001, (_i, d) => { const s = d.state_matrix.find((x) => x.state === "ERROR")!; s.recovery_action_refs = []; }),
  negative(5, FX_POS_005, (_i, d) => { d.flow_graph.interruptible_exit_policy_refs = []; }),
  negative(6, FX_POS_001, (_i, d) => { d.state_matrix.push({ ...structuredClone(d.state_matrix[0]), state: "ERROR", upstream_variant_refs: ["variant:fabricated"] }); }),
  negative(7, FX_POS_001, (_i, d) => { d.state_matrix = d.state_matrix.filter((s) => s.state !== "LOADING"); }),
  negative(8, FX_POS_001, (_i, d) => { d.state_matrix = d.state_matrix.filter((s) => s.state !== "EMPTY"); }),
  negative(9, FX_POS_001, (_i, d) => { d.state_matrix.find((s) => s.upstream_variant_refs.includes("variant:list-error"))!.state = "SUCCESS"; }),
  negative(10, FX_POS_006, (_i, d) => { d.state_matrix.find((s) => s.upstream_variant_refs.includes("variant:report-denied"))!.state = "EMPTY"; }),
  negative(11, FX_POS_004, (_i, d) => { d.retries.push({ source_variant_ref: "variant:delete-error", allowed: true }); }),
  negative(12, FX_POS_002, (_i, d) => { d.forms[0].duplicate_submit_disabled_while_pending = false; }),
  negative(13, FX_POS_004, (_i, d) => { delete d.forms[0].destructive_guardrail_ref; }),
  negative(14, FX_POS_003, (_i, d) => { (d.approvals[0] as unknown as { frontend_can_self_approve: boolean }).frontend_can_self_approve = true; }),
  negative(15, FX_POS_006, (_i, d) => { d.blockers = ["client tenant field is authoritative enforcement"]; }),
  negative(16, FX_POS_002, (i) => { i.form_intents[0].field_intents[0].accessible_name_intent = ""; }),
  negative(17, FX_POS_002, (_i, d) => { d.accessibility.error_association_refs = []; }),
  negative(18, FX_POS_002, (_i, d) => { d.forms[0].preserve_input_on_recoverable_error = false; }),
  negative(19, FX_POS_005, (_i, d) => { d.accessibility.focus_restore_transition_refs = []; }),
  negative(20, FX_POS_005, (_i, d) => { d.accessibility.keyboard_required_action_refs = []; }),
  negative(21, FX_POS_001, (_i, d) => { d.accessibility.announcement_state_refs = []; }),
  negative(22, FX_POS_005, (_i, d) => { const row = d.responsive.find((r) => r.viewport === "NARROW")!; row.primary_action_refs = []; row.primary_content_refs = []; }),
  negative(23, FX_POS_005, (_i, d) => { const row = d.responsive.find((r) => r.viewport === "NARROW")!; row.semantic_order_preserved = false; row.focus_order_preserved = false; }),
  negative(24, FX_POS_001, (_i, d) => { d.responsive.filter((r) => r.viewport === "NARROW").forEach((r) => { r.overflow_strategy = "Use compact mode."; }); }),
  negative(25, FX_POS_001, (_i, d) => { d.state_matrix[0].copy_intent = "Show raw stack trace and SQLSTATE token=secret."; }),
  negative(26, FX_POS_001, (_i, d) => { d.state_matrix[0].copy_intent = "Use official brand voice and legally required certified translation."; }),
  negative(27, FX_POS_001, (_i, d) => { d.blockers = ["Embed React DOM component."]; }),
  negative(28, FX_POS_001, (_i, d) => { d.deferred_to_s14 = ["Playwright browser automation dependency included"]; }),
  negative(29, FX_POS_001, (_i, d) => { d.deferred_to_s13o = ["implemented retry loop and backoff"]; }),
  negative(30, FX_POS_001, (_i, d) => { d.acceptance = []; d.evidence_required = []; }),
];

function extractInput(goal: string): FrontendProductSurfaceInput { const at = goal.indexOf(FRONTEND_PRODUCT_SURFACE_INPUT_MARKER); if (at < 0) throw new Error("S13K input marker missing"); const after = goal.slice(at + FRONTEND_PRODUCT_SURFACE_INPUT_MARKER.length).trim(); const end = after.indexOf("\n\n"); return JSON.parse(end < 0 ? after : after.slice(0, end)) as FrontendProductSurfaceInput; }
export class DeterministicFrontendSurfaceModelProvider implements ModelProvider { static readonly PROVIDER_LABEL = "deterministic/reference provider; bounded product input and semantic rule prose only; no frozen truth, fixture ids, arm flags, browser, provider, or side effect"; async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> { const input = extractInput(request.goal.statement); const profile = deriveFrontendSurfaceProfileFromRules([request.goal.statement]); const decision = synthesizeFrontendProductSurfaceDecision(input, profile); return { status: "SUCCESS", decision: { type: "FINISH", rationale: "Derived from bounded product facts and materialized semantic rule prose.", output: { summary: `Frontend product-surface decision ${decision.status}`, data: decision as unknown as Record<string, unknown>, evidence_refs: [...input.spec_refs] } } }; } }
