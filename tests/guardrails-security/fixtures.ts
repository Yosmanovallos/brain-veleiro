import type { AgentDefinition, ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import { GUARDRAILS_SECURITY_INPUT_MARKER, deriveGuardrailsSecurityProfileFromRules, synthesizeGuardrailsSecurityDecision, type GuardrailsSecurityDecision, type GuardrailsSecurityInput, type GuardrailsSecurityStatus } from "../../src/intelligence/guardrails-security/index.js";
import { guardrailsSecurityS13L } from "../../src/intelligence/skills/index.js";
import { ALL_POSITIVE_INPUTS, FX_POS_001, FX_POS_002, FX_POS_003, FX_POS_004, FX_POS_005, FX_POS_006, FX_POS_007, FX_POS_008, NOW, approved, authenticated, baseGuardrailsSecurityInput, capability } from "./fixtureInputs.js";
export { ALL_POSITIVE_INPUTS, FX_POS_001, FX_POS_002, FX_POS_003, FX_POS_004, FX_POS_005, FX_POS_006, FX_POS_007, FX_POS_008, baseGuardrailsSecurityInput } from "./fixtureInputs.js";

const OUTPUT_SCHEMA = { type: "object", required: ["summary"], properties: { summary: { type: "string" }, data: {}, evidence_refs: { type: "array" } }, additionalProperties: false };
export const guardrailsSecurityHost: AgentDefinition = { id: "s13l-generic-skill-host", role: "generic-skill-host", objective: "Produce a bounded provider-neutral security decision from supplied policy and evidence references.", model_policy: { routing_class: "QUALITY", require_structured_decisions: true, allow_provider_substitution: true }, context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 16000, max_items: 50, allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF"], require_source_refs: true }, state_schema: { type: "object", additionalProperties: false, properties: { selected: { type: "string" } } }, tools: [], skills: [guardrailsSecurityS13L.id], capabilities: [], memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" }, permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true }, delegation: { allowed: false }, limits: { max_turns: 3, timeout_ms: 15000 }, termination: { require_terminal_outcome: true, require_explanation: true }, output_schema: structuredClone(OUTPUT_SCHEMA), rubric: { quality_contract_ref: "S13L_GUARDRAILS_SECURITY_DEEP" }, evals: ["evals/s13l/host-run"] };

const rich = () => deriveGuardrailsSecurityProfileFromRules([...guardrailsSecurityS13L.rules.map((rule) => rule.statement), ...guardrailsSecurityS13L.procedure.map((step) => step.instruction)]);
export const NEGATIVE_CONDITIONS = ["protected_action_missing_authentication", "forged_client_principal_as_authority", "authorization_missing_for_protected_action", "client_tenant_field_used_as_authority", "tenant_scope_mismatch_without_cross_scope_grant", "tool_output_redirects_target_tenant", "capability_missing_agent_allowlist", "capability_missing_skill_allowlist", "capability_missing_caller_authorization", "capability_disallowed_by_security_policy", "side_effect_class_disallowed", "unknown_capability_id", "high_impact_missing_policy_approval_path", "approval_action_fingerprint_mismatch", "approval_expired", "proposer_equals_approver", "destructive_missing_recovery_or_irreversibility_evidence", "approval_present_but_authz_failed", "explicit_secret_value_field_present", "supplied_high_confidence_secret_finding", "secret_value_authorized_for_log_output", "retrieved_document_instruction_elevated_to_policy", "tool_output_grants_capability", "historical_memory_overrides_current_policy", "unresolved_authority_conflict", "sensitive_field_disclosed_without_declared_purpose", "disclosure_exceeds_authorized_field_refs", "protected_action_has_no_enforcement_point", "stale_policy_or_action_fingerprint_evidence", "candidate_claims_allow_while_hard_gate_fails", "identity_provider_specific_binding", "vault_kms_or_crypto_implementation_binding", "prompt_filter_vendor_binding", "capability_registry_or_mcp_implemented_in_s13l", "prior_s13i_j_k_semantics_silently_rewritten", "future_stage_system_pull_forward"] as const;
function negative(index: number, source: GuardrailsSecurityInput, mutateInput?: (input: GuardrailsSecurityInput) => void, mutateDecision?: (decision: GuardrailsSecurityDecision) => void, expected: GuardrailsSecurityStatus = "BLOCKED") { const input = structuredClone(source); mutateInput?.(input); const decision = synthesizeGuardrailsSecurityDecision(input, rich()); mutateDecision?.(decision); return { id: `FX-NEG-${String(index).padStart(3, "0")}`, condition: NEGATIVE_CONDITIONS[index - 1], input, decision, expected }; }
const authMissing = (input: GuardrailsSecurityInput) => { input.subject.authentication_state = "UNKNOWN"; delete input.subject.principal_ref; };
export const ALL_NEGATIVE_FIXTURES = [
  negative(1, FX_POS_002, authMissing),
  negative(2, FX_POS_002, (i) => { i.subject.identity_provenance = "UNTRUSTED_INPUT"; }),
  negative(3, FX_POS_002, (i) => { i.subject.authorization_grant_refs = []; }),
  negative(4, FX_POS_002, (i) => { i.scope.trusted_source = "NONE"; i.scope.client_supplied_scope_field_refs = ["body.tenant_id"]; }),
  negative(5, FX_POS_002, (i) => { i.scope.resource_scope_ref = "tenant:beta"; }),
  negative(6, FX_POS_002, (i) => { i.scope.resource_scope_ref = "tenant:beta"; i.content.items.push({ item_ref: "tool:redirect", source: "TOOL_OUTPUT", authority: "TASK_INSTRUCTION", instruction_like_finding: true, source_refs: ["tool:output"] }); }),
  negative(7, FX_POS_003, (i) => { i.capability.agent_allowed_capability_ids = []; }),
  negative(8, FX_POS_003, (i) => { i.capability.skill_allowed_capability_ids = []; }),
  negative(9, FX_POS_003, (i) => { i.capability.caller_authorized_capability_ids = []; }),
  negative(10, FX_POS_003, (i) => { i.capability.policy_allowed_capability_ids = []; }),
  negative(11, FX_POS_004, (i) => { i.capability.policy_allowed_side_effects = ["NONE"]; }),
  negative(12, FX_POS_003, (i) => { i.capability.capability_known = false; }),
  negative(13, FX_POS_004, (i) => { i.policy.approval_required_for_high_impact = false; i.approval.policy.approval_path_allowed = false; }),
  negative(14, FX_POS_004, (i) => { i.approval.record!.action_fingerprint = "fp:other"; }, undefined, "APPROVAL_REQUIRED"),
  negative(15, FX_POS_004, (i) => { i.approval.record!.expires_at_epoch_ms = NOW - 1; }, undefined, "APPROVAL_REQUIRED"),
  negative(16, FX_POS_004, (i) => { i.approval.record!.approver_ref = i.subject.proposer_ref!; }, undefined, "APPROVAL_REQUIRED"),
  negative(17, FX_POS_005, (i) => { i.action.recovery_mode = "NOT_REQUIRED"; delete i.action.recovery_evidence_ref; }),
  negative(18, FX_POS_004, (i) => { i.subject.authorization_grant_refs = []; }),
  negative(19, FX_POS_001, (i) => { (i as unknown as Record<string, unknown>).access_token = "fixture-redacted-value"; }),
  negative(20, FX_POS_007, (i) => { i.secrets.known_secret_findings = [{ finding_ref: "finding:1", confidence: "HIGH", source_ref: "scanner:bounded" }]; }),
  negative(21, FX_POS_007, (i) => { (i as unknown as Record<string, unknown>).secret_value = "fixture-redacted-value"; i.secrets.allow_safe_ref_in_logs = true; }),
  negative(22, FX_POS_006, (i) => { i.content.items[1].authority = "TASK_INSTRUCTION"; }),
  negative(23, FX_POS_003, (i) => { i.content.items.push({ item_ref: "tool:grant", source: "TOOL_OUTPUT", authority: "TASK_INSTRUCTION", instruction_like_finding: true, source_refs: ["tool:output"] }); }),
  negative(24, FX_POS_001, (i) => { i.content.items.push({ item_ref: "memory:old", source: "HISTORICAL_MEMORY", authority: "TASK_INSTRUCTION", instruction_like_finding: true, source_refs: ["memory:old"] }); }),
  negative(25, FX_POS_001, (i) => { i.content.unresolved_authority_conflict = true; }),
  negative(26, FX_POS_001, (i) => { i.sensitive_data.proposed_disclosure_field_refs = ["field:title"]; }),
  negative(27, FX_POS_001, (i) => { i.sensitive_data.purpose_required_field_refs = ["field:title"]; i.sensitive_data.proposed_disclosure_field_refs = ["field:title"]; }),
  negative(28, FX_POS_002, (i) => { i.enforcement.enforcement_point = "NOT_APPLICABLE"; }),
  negative(29, FX_POS_001, (i) => { i.enforcement.action_policy_fingerprint = "policy-fp:stale"; }),
  negative(30, FX_POS_002, authMissing, (d) => { d.status = "ALLOW"; for (const group of Object.values(d.atomic)) for (const key of Object.keys(group)) (group as Record<string, string>)[key] = "PASS"; }),
  negative(31, FX_POS_001, undefined, (d) => { d.blockers.push({ code: "BINDING", message: "Auth0 provider binding", source_refs: ["candidate"] }); }),
  negative(32, FX_POS_001, undefined, (d) => { d.blockers.push({ code: "BINDING", message: "Vault KMS implementation binding", source_refs: ["candidate"] }); }),
  negative(33, FX_POS_001, undefined, (d) => { d.blockers.push({ code: "BINDING", message: "Lakera prompt shield vendor binding", source_refs: ["candidate"] }); }),
  negative(34, FX_POS_001, undefined, (d) => { d.blockers.push({ code: "FUTURE", message: "Capability Registry implemented as MCP server", source_refs: ["candidate"] }); }),
  negative(35, FX_POS_001, undefined, (d) => { d.blockers.push({ code: "PRIOR", message: "rewrite S13I contract semantics", source_refs: ["candidate"] }); }),
  negative(36, FX_POS_001, undefined, (d) => { d.blockers.push({ code: "FUTURE", message: "S13M debugging framework implemented", source_refs: ["candidate"] }); }),
] as const;

function extractInput(goal: string): GuardrailsSecurityInput { const at = goal.indexOf(GUARDRAILS_SECURITY_INPUT_MARKER); if (at < 0) throw new Error("S13L input marker missing"); const after = goal.slice(at + GUARDRAILS_SECURITY_INPUT_MARKER.length).trim(); const end = after.indexOf("\n\n"); return JSON.parse(end < 0 ? after : after.slice(0, end)) as GuardrailsSecurityInput; }
export class DeterministicGuardrailsSecurityModelProvider implements ModelProvider { static readonly PROVIDER_LABEL = "deterministic/reference provider; bounded security input and semantic rule prose only; no frozen truth, fixture ids, Skill ids, arm flags, provider binding, or side effect"; async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> { const input = extractInput(request.goal.statement); const profile = deriveGuardrailsSecurityProfileFromRules([request.goal.statement]); const decision = synthesizeGuardrailsSecurityDecision(input, profile); return { status: "SUCCESS", decision: { type: "FINISH", rationale: "Derived only from bounded policy/evidence facts and materialized semantic rule prose.", output: { summary: `Guardrails security decision ${decision.status}`, data: decision as unknown as Record<string, unknown>, evidence_refs: [...input.spec_refs] } } }; } }
export { approved, authenticated, capability };
