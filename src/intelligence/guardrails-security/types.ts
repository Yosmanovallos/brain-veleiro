import type { TaskAcceptanceCriterion, TaskEvidenceRequirement } from "../implementation-planning/types.js";

export type GuardrailsSecurityStatus = "ALLOW" | "APPROVAL_REQUIRED" | "BLOCKED";
export type SecurityCheckResult = "PASS" | "FAIL" | "NOT_APPLICABLE";
export type AuthenticationMode = "PUBLIC" | "AUTHENTICATED";
export type AuthenticationState = "ANONYMOUS" | "VERIFIED" | "UNKNOWN";
export type IdentityProvenance = "TRUSTED_AUTH_CONTEXT" | "NONE" | "UNTRUSTED_INPUT";
export type SecurityScopeKind = "NONE" | "OWNER" | "TENANT" | "RESOURCE" | "CUSTOM";
export type TrustedScopeSource = "AUTH_CONTEXT" | "RESOURCE_LOOKUP" | "NONE";
export type ToolSideEffectClass = "NONE" | "LOCAL" | "EXTERNAL";
export type SecurityImpactClass = "READ_ONLY" | "REVERSIBLE" | "HIGH_IMPACT" | "DESTRUCTIVE_OR_IRREVERSIBLE";
export type RecoveryEvidenceMode = "NOT_REQUIRED" | "RECOVERY_PLAN" | "IRREVERSIBILITY_ACKNOWLEDGEMENT";
export type SecurityContentSource = "AUTHORIZED_TASK_INSTRUCTION" | "USER_PAYLOAD" | "RETRIEVED_CONTENT" | "TOOL_OUTPUT" | "HISTORICAL_MEMORY" | "EXTERNAL_DOCUMENT";
export type SecurityContentAuthority = "TASK_INSTRUCTION" | "DATA_ONLY";
export type DataSensitivityClass = "PUBLIC" | "INTERNAL" | "PERSONAL" | "SENSITIVE" | "SECRET_REFERENCE";
export type SecurityEnforcementPoint = "NOT_APPLICABLE" | "CALLER_GUARD" | "API_AUTHORIZATION_BOUNDARY" | "RESTRICTED_CAPABILITY_BOUNDARY" | "RESOURCE_POLICY_BOUNDARY";

export interface SecuritySubjectInput { authentication_mode: AuthenticationMode; authentication_state: AuthenticationState; principal_ref?: string; identity_provenance: IdentityProvenance; authorization_grant_refs: string[]; proposer_ref?: string; }
export interface SecurityScopeInput { kind: SecurityScopeKind; subject_scope_ref?: string; resource_scope_ref?: string; trusted_source: TrustedScopeSource; cross_scope_grant_ref?: string; client_supplied_scope_field_refs: string[]; }
export interface SecurityCapabilityInput { requested_capability_id?: string; descriptor_side_effect?: ToolSideEffectClass; agent_allowed_capability_ids: string[]; agent_allowed_side_effects: ToolSideEffectClass[]; skill_allowed_capability_ids: string[]; skill_allowed_side_effects: ToolSideEffectClass[]; caller_authorized_capability_ids: string[]; policy_allowed_capability_ids: string[]; policy_allowed_side_effects: ToolSideEffectClass[]; capability_known: boolean; }
export interface SecurityActionInput { action_id: string; action_fingerprint: string; impact: SecurityImpactClass; side_effect: ToolSideEffectClass; recovery_mode: RecoveryEvidenceMode; recovery_evidence_ref?: string; }
export interface SecurityApprovalPolicyInput { approval_path_allowed: boolean; distinct_approver_required: boolean; }
export interface SecurityApprovalRecord { approval_ref: string; approver_ref: string; action_fingerprint: string; approved_at_epoch_ms: number; expires_at_epoch_ms: number; authority_ref: string; }
export interface SecurityApprovalInput { evaluation_time_epoch_ms: number; policy: SecurityApprovalPolicyInput; record?: SecurityApprovalRecord; }
export interface OpaqueSecretReference { ref: string; purpose_ref: string; }
export interface KnownSecretFinding { finding_ref: string; confidence: "HIGH"; source_ref: string; }
export interface SecretHandlingInput { secret_refs: OpaqueSecretReference[]; known_secret_findings: KnownSecretFinding[]; allow_safe_ref_in_transient_decision: boolean; allow_safe_ref_in_logs: boolean; allow_safe_ref_in_durable_memory: boolean; allow_safe_ref_in_user_output: boolean; }
export interface SecurityContentItem { item_ref: string; source: SecurityContentSource; authority: SecurityContentAuthority; instruction_like_finding: boolean; source_refs: string[]; }
export interface ContentAuthorityInput { items: SecurityContentItem[]; unresolved_authority_conflict: boolean; }
export interface SensitiveDataFieldIntent { field_ref: string; classification: DataSensitivityClass; purpose_ref: string; }
export interface SensitiveDataInput { available_fields: SensitiveDataFieldIntent[]; purpose_required_field_refs: string[]; authorized_disclosure_field_refs: string[]; proposed_disclosure_field_refs: string[]; proposed_log_field_refs: string[]; proposed_durable_memory_field_refs: string[]; }
export interface SecurityEnforcementInput { enforcement_point: SecurityEnforcementPoint; policy_snapshot_ref: string; policy_fingerprint: string; action_policy_fingerprint: string; evidence_current: boolean; }
export interface SecurityPolicySnapshot { policy_ref: string; authentication_required: boolean; authorization_required: boolean; required_authorization_grant_refs: string[]; cross_scope_allowed_with_explicit_grant: boolean; approval_required_for_high_impact: boolean; approval_required_for_destructive: boolean; allowed_secret_reference_propagation: "TRANSIENT_ONLY" | "NONE"; }
export interface GuardrailsSecurityInput { task_ref: string; spec_refs: string[]; subject: SecuritySubjectInput; scope: SecurityScopeInput; capability: SecurityCapabilityInput; action: SecurityActionInput; approval: SecurityApprovalInput; secrets: SecretHandlingInput; content: ContentAuthorityInput; sensitive_data: SensitiveDataInput; enforcement: SecurityEnforcementInput; policy: SecurityPolicySnapshot; acceptance: TaskAcceptanceCriterion[]; evidence_required: TaskEvidenceRequirement[]; }
export interface GuardrailBlocker { code: string; message: string; source_refs: string[]; }
export interface GuardrailApprovalRequirement { code: string; action_fingerprint: string; reason: string; required_evidence_refs: string[]; }
export interface GuardrailsAtomicDecision {
  identity: { authentication_result: SecurityCheckResult; provenance_result: SecurityCheckResult; public_mode_result: SecurityCheckResult };
  scope: { authorization_result: SecurityCheckResult; tenant_isolation_result: SecurityCheckResult; confused_deputy_result: SecurityCheckResult };
  capability: { allowlist_result: SecurityCheckResult; side_effect_result: SecurityCheckResult; least_privilege_result: SecurityCheckResult };
  action: { impact_result: SecurityCheckResult; approval_result: SecurityCheckResult; recovery_result: SecurityCheckResult };
  secrets: { no_secret_value_result: SecurityCheckResult; reference_result: SecurityCheckResult; propagation_result: SecurityCheckResult };
  content: { instruction_data_result: SecurityCheckResult; indirect_injection_result: SecurityCheckResult; authority_conflict_result: SecurityCheckResult };
  data: { minimization_result: SecurityCheckResult; disclosure_result: SecurityCheckResult; memory_logging_result: SecurityCheckResult };
  enforcement: { point_result: SecurityCheckResult; freshness_result: SecurityCheckResult; fail_closed_result: SecurityCheckResult };
  traceability: { source_refs_result: SecurityCheckResult; evidence_result: SecurityCheckResult; blocker_traceability_result: SecurityCheckResult };
  boundary: { provider_neutral_result: SecurityCheckResult; future_stage_result: SecurityCheckResult; prior_contract_result: SecurityCheckResult };
}
export interface GuardrailsSecurityDecision { status: GuardrailsSecurityStatus; task_ref: string; spec_refs: string[]; atomic: GuardrailsAtomicDecision; blockers: GuardrailBlocker[]; approval_requirements: GuardrailApprovalRequirement[]; permitted_capability_ids: string[]; permitted_side_effects: ToolSideEffectClass[]; allowed_disclosure_field_refs: string[]; enforcement_required: boolean; enforcement_point: SecurityEnforcementPoint; acceptance: TaskAcceptanceCriterion[]; evidence_required: TaskEvidenceRequirement[]; }
export interface GuardrailsSecurityValidationResult { valid: boolean; errors: string[]; hard_invariants: Record<string, boolean>; recomputed_status: GuardrailsSecurityStatus; }
export interface GuardrailsSecuritySynthesisProfile { complete_atomic_reasoning: boolean; complete_traceability: boolean; safe_boundaries: boolean; }
export type GuardrailsSecurityDimensionId = "SD-001" | "SD-002" | "SD-003" | "SD-004" | "SD-005" | "SD-006" | "SD-007" | "SD-008" | "SD-009" | "SD-010";
export type GuardrailsSecurityScoreCategory = GuardrailsSecurityDimensionId | "REGRESSION_CROSS_CUTTING";
export interface GuardrailsSecurityAssertionResult { id: string; category: GuardrailsSecurityScoreCategory; correct: boolean; hard_invariant: boolean; fixture_ref: string; }
export interface GuardrailsSecurityUnsafeCounters { auth_bypass: number; cross_tenant_authority: number; overbroad_capability: number; destructive_approval_bypass: number; secret_value_propagation: number; untrusted_instruction_elevation: number; sensitive_data_overdisclosure: number; provider_or_future_stage_binding: number; }
export interface GuardrailsSecurityArmScore { total_assertions: number; correct: number; by_dimension: Record<GuardrailsSecurityDimensionId, { assertion_ids: string[]; total: number; correct: number }>; cross_cutting: { assertion_ids: string[]; total: number; correct: number }; hard_invariant_total: number; hard_invariant_correct: number; unsafe_counters: GuardrailsSecurityUnsafeCounters; assertions: GuardrailsSecurityAssertionResult[]; }
export interface GuardrailsSecurityComparison { baseline: GuardrailsSecurityArmScore; skill: GuardrailsSecurityArmScore; dimension_specific_total_delta: number; improved_dimensions: GuardrailsSecurityDimensionId[]; dimension_improvements: Record<GuardrailsSecurityDimensionId, { delta: number; scored_assertions: number; single_assertion_contributions: Record<string, number>; max_single_assertion_share: number }>; hard_invariant_regressed: boolean; meets_threshold: boolean; }
export interface FrozenGuardrailsSecurityFixtureTruth { task_ref: string; expected_assertions: Record<string, unknown>; }
export type { TaskAcceptanceCriterion, TaskEvidenceRequirement };
