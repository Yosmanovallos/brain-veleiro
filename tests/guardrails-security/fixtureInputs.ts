import type { GuardrailsSecurityInput } from "../../src/intelligence/guardrails-security/types.js";

const NOW = 1_800_000_000_000;
export function baseGuardrailsSecurityInput(): GuardrailsSecurityInput {
  return {
    task_ref: "TASK-GSS-001", spec_refs: ["spec:security", "policy:public-read"],
    subject: { authentication_mode: "PUBLIC", authentication_state: "ANONYMOUS", identity_provenance: "NONE", authorization_grant_refs: [] },
    scope: { kind: "NONE", trusted_source: "NONE", client_supplied_scope_field_refs: [] },
    capability: { agent_allowed_capability_ids: [], agent_allowed_side_effects: ["NONE"], skill_allowed_capability_ids: [], skill_allowed_side_effects: ["NONE"], caller_authorized_capability_ids: [], policy_allowed_capability_ids: [], policy_allowed_side_effects: ["NONE"], capability_known: true },
    action: { action_id: "public.read", action_fingerprint: "fp:public-read:v1", impact: "READ_ONLY", side_effect: "NONE", recovery_mode: "NOT_REQUIRED" },
    approval: { evaluation_time_epoch_ms: NOW, policy: { approval_path_allowed: false, distinct_approver_required: false } },
    secrets: { secret_refs: [], known_secret_findings: [], allow_safe_ref_in_transient_decision: false, allow_safe_ref_in_logs: false, allow_safe_ref_in_durable_memory: false, allow_safe_ref_in_user_output: false },
    content: { items: [{ item_ref: "task:current", source: "AUTHORIZED_TASK_INSTRUCTION", authority: "TASK_INSTRUCTION", instruction_like_finding: false, source_refs: ["spec:security"] }], unresolved_authority_conflict: false },
    sensitive_data: { available_fields: [{ field_ref: "field:title", classification: "PUBLIC", purpose_ref: "purpose:read" }], purpose_required_field_refs: [], authorized_disclosure_field_refs: [], proposed_disclosure_field_refs: [], proposed_log_field_refs: [], proposed_durable_memory_field_refs: [] },
    enforcement: { enforcement_point: "NOT_APPLICABLE", policy_snapshot_ref: "policy:public-read", policy_fingerprint: "policy-fp:v1", action_policy_fingerprint: "policy-fp:v1", evidence_current: true },
    policy: { policy_ref: "policy:public-read", authentication_required: false, authorization_required: false, required_authorization_grant_refs: [], cross_scope_allowed_with_explicit_grant: false, approval_required_for_high_impact: false, approval_required_for_destructive: false, allowed_secret_reference_propagation: "NONE" },
    acceptance: [{ id: "AC-GSS-1", condition: "Decision fails closed.", verification_method: "CONTRACT_TEST", evidence_expected: "Deterministic decision evidence." }],
    evidence_required: [{ kind: "SECURITY_CHECK", description: "Boundary decision regression.", source_ref: "spec:security" }],
  };
}
function authenticated(task: string): GuardrailsSecurityInput { const input = baseGuardrailsSecurityInput(); input.task_ref = task; input.subject = { authentication_mode: "AUTHENTICATED", authentication_state: "VERIFIED", principal_ref: "principal:alice", identity_provenance: "TRUSTED_AUTH_CONTEXT", authorization_grant_refs: ["grant:tenant-read"], proposer_ref: "principal:alice" }; input.scope = { kind: "TENANT", subject_scope_ref: "tenant:alpha", resource_scope_ref: "tenant:alpha", trusted_source: "AUTH_CONTEXT", client_supplied_scope_field_refs: [] }; input.policy.authentication_required = true; input.policy.authorization_required = true; input.policy.required_authorization_grant_refs = ["grant:tenant-read"]; input.enforcement.enforcement_point = "API_AUTHORIZATION_BOUNDARY"; return input; }
function approved(input: GuardrailsSecurityInput): void { input.approval = { evaluation_time_epoch_ms: NOW, policy: { approval_path_allowed: true, distinct_approver_required: true }, record: { approval_ref: "approval:review-1", approver_ref: "principal:bob", action_fingerprint: input.action.action_fingerprint, approved_at_epoch_ms: NOW - 1000, expires_at_epoch_ms: NOW + 60_000, authority_ref: "authority:security-policy" } }; }
function capability(input: GuardrailsSecurityInput, id = "capability:records-write", side: "NONE" | "LOCAL" | "EXTERNAL" = "NONE"): void { input.capability = { requested_capability_id: id, descriptor_side_effect: side, agent_allowed_capability_ids: [id], agent_allowed_side_effects: [side], skill_allowed_capability_ids: [id], skill_allowed_side_effects: [side], caller_authorized_capability_ids: [id], policy_allowed_capability_ids: [id], policy_allowed_side_effects: [side], capability_known: true }; input.action.side_effect = side; input.enforcement.enforcement_point = "RESTRICTED_CAPABILITY_BOUNDARY"; }

export const FX_POS_001 = baseGuardrailsSecurityInput();
export const FX_POS_002 = authenticated("TASK-GSS-002");
export const FX_POS_003 = (() => { const input = authenticated("TASK-GSS-003"); capability(input, "capability:metadata-read", "NONE"); return input; })();
export const FX_POS_004 = (() => { const input = authenticated("TASK-GSS-004"); input.action = { action_id: "billing.adjust", action_fingerprint: "fp:billing-adjust:v1", impact: "HIGH_IMPACT", side_effect: "EXTERNAL", recovery_mode: "NOT_REQUIRED" }; capability(input, "capability:billing-adjust", "EXTERNAL"); input.policy.approval_required_for_high_impact = true; approved(input); return input; })();
export const FX_POS_005 = (() => { const input = authenticated("TASK-GSS-005"); input.action = { action_id: "record.delete", action_fingerprint: "fp:record-delete:v1", impact: "DESTRUCTIVE_OR_IRREVERSIBLE", side_effect: "EXTERNAL", recovery_mode: "RECOVERY_PLAN", recovery_evidence_ref: "recovery:backup-and-restore" }; capability(input, "capability:record-delete", "EXTERNAL"); input.policy.approval_required_for_destructive = true; approved(input); return input; })();
export const FX_POS_006 = (() => { const input = baseGuardrailsSecurityInput(); input.task_ref = "TASK-GSS-006"; input.content.items.push({ item_ref: "retrieval:malicious-text", source: "RETRIEVED_CONTENT", authority: "DATA_ONLY", instruction_like_finding: true, source_refs: ["retrieval:source-1"] }); return input; })();
export const FX_POS_007 = (() => { const input = baseGuardrailsSecurityInput(); input.task_ref = "TASK-GSS-007"; input.secrets.secret_refs = [{ ref: "secret-ref:payments-primary", purpose_ref: "purpose:payment-auth" }]; input.secrets.allow_safe_ref_in_transient_decision = true; return input; })();
export const FX_POS_008 = (() => { const input = authenticated("TASK-GSS-008"); input.action = { action_id: "access.rotate", action_fingerprint: "fp:access-rotate:v1", impact: "HIGH_IMPACT", side_effect: "EXTERNAL", recovery_mode: "NOT_REQUIRED" }; capability(input, "capability:access-rotate", "EXTERNAL"); input.policy.approval_required_for_high_impact = true; input.approval.policy = { approval_path_allowed: true, distinct_approver_required: true }; return input; })();
export const ALL_POSITIVE_INPUTS = [FX_POS_001, FX_POS_002, FX_POS_003, FX_POS_004, FX_POS_005, FX_POS_006, FX_POS_007, FX_POS_008] as const;
export { NOW, authenticated, approved, capability };

