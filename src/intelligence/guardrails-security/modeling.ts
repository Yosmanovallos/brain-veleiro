import { FORBIDDEN_CREDENTIAL_KEY_PATTERN, FORBIDDEN_SECURITY_BINDING_PATTERN, FUTURE_STAGE_IMPLEMENTATION_PATTERN, PRIOR_CONTRACT_REWRITE_PATTERN } from "./constants.js";
import type { GuardrailApprovalRequirement, GuardrailBlocker, GuardrailsAtomicDecision, GuardrailsSecurityDecision, GuardrailsSecurityInput, GuardrailsSecurityStatus, GuardrailsSecuritySynthesisProfile, GuardrailsSecurityValidationResult, SecurityCheckResult } from "./types.js";

const clone = <T>(value: T): T => structuredClone(value);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const subset = (values: readonly string[], allowed: readonly string[]): boolean => values.every((value) => allowed.includes(value));
const hasText = (value: unknown): boolean => typeof value === "string" && value.trim().length > 0;
const result = (passes: boolean): SecurityCheckResult => passes ? "PASS" : "FAIL";
const highImpact = (input: GuardrailsSecurityInput): boolean => input.action.impact === "HIGH_IMPACT" || input.action.impact === "DESTRUCTIVE_OR_IRREVERSIBLE";
const protectedAction = (input: GuardrailsSecurityInput): boolean => input.policy.authentication_required || input.policy.authorization_required || input.scope.kind !== "NONE" || Boolean(input.capability.requested_capability_id) || highImpact(input);

/** Finite known-key defense only. Values are intentionally not heuristically classified. */
export function findForbiddenCredentialKeys(value: unknown, path = "$", seen = new Set<object>()): string[] {
  if (value === null || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const found: string[] = [];
  if (Array.isArray(value)) value.forEach((item, index) => found.push(...findForbiddenCredentialKeys(item, `${path}[${index}]`, seen)));
  else for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) found.push(`${path}.${key}`);
    found.push(...findForbiddenCredentialKeys(item, `${path}.${key}`, seen));
  }
  return found;
}

function approvalPasses(input: GuardrailsSecurityInput): boolean {
  if (!highImpact(input)) return true;
  const record = input.approval.record;
  return Boolean(input.approval.policy.approval_path_allowed && record && hasText(record.approval_ref) && hasText(record.approver_ref) && hasText(record.authority_ref)
    && record.action_fingerprint === input.action.action_fingerprint
    && record.approved_at_epoch_ms <= input.approval.evaluation_time_epoch_ms
    && record.expires_at_epoch_ms >= input.approval.evaluation_time_epoch_ms
    && (!input.approval.policy.distinct_approver_required || record.approver_ref !== input.subject.proposer_ref));
}

function requiredApprovalPolicyPasses(input: GuardrailsSecurityInput): boolean {
  if (input.action.impact === "HIGH_IMPACT") return input.policy.approval_required_for_high_impact && input.approval.policy.approval_path_allowed;
  if (input.action.impact === "DESTRUCTIVE_OR_IRREVERSIBLE") return input.policy.approval_required_for_destructive && input.approval.policy.approval_path_allowed;
  return true;
}

function recoveryPasses(input: GuardrailsSecurityInput): boolean {
  if (input.action.impact !== "DESTRUCTIVE_OR_IRREVERSIBLE") return input.action.recovery_mode === "NOT_REQUIRED";
  return input.action.recovery_mode !== "NOT_REQUIRED" && hasText(input.action.recovery_evidence_ref)
    && (input.action.recovery_mode !== "IRREVERSIBILITY_ACKNOWLEDGEMENT" || input.approval.policy.approval_path_allowed);
}

function secretReferenceFields(input: GuardrailsSecurityInput): string[] {
  return input.sensitive_data.available_fields.filter((field) => field.classification === "SECRET_REFERENCE").map((field) => field.field_ref);
}

function sourceAuthorityPasses(input: GuardrailsSecurityInput): boolean {
  return input.content.items.every((item) => item.source_refs.length > 0 && (item.source === "AUTHORIZED_TASK_INSTRUCTION" ? true : item.authority === "DATA_ONLY"));
}

export function deriveExpectedGuardrailsAtomic(input: GuardrailsSecurityInput): GuardrailsAtomicDecision {
  const publicAllowed = input.subject.authentication_mode === "PUBLIC" && !input.policy.authentication_required;
  const authenticated = input.subject.authentication_mode === "AUTHENTICATED" && input.subject.authentication_state === "VERIFIED" && hasText(input.subject.principal_ref);
  const trustedIdentity = publicAllowed || (authenticated && input.subject.identity_provenance === "TRUSTED_AUTH_CONTEXT");
  const requiredGrants = subset(input.policy.required_authorization_grant_refs, input.subject.authorization_grant_refs);
  const scopeTrusted = input.scope.kind === "NONE" || input.scope.trusted_source === "AUTH_CONTEXT" || input.scope.trusted_source === "RESOURCE_LOOKUP";
  const scopeMatches = input.scope.kind === "NONE" || (hasText(input.scope.subject_scope_ref) && input.scope.subject_scope_ref === input.scope.resource_scope_ref);
  const crossScope = Boolean(input.scope.cross_scope_grant_ref && input.policy.cross_scope_allowed_with_explicit_grant);
  const tenantSafe = scopeTrusted && (scopeMatches || crossScope);
  const requested = input.capability.requested_capability_id;
  const noCapability = !requested;
  const capInAll = noCapability || [input.capability.agent_allowed_capability_ids, input.capability.skill_allowed_capability_ids, input.capability.caller_authorized_capability_ids, input.capability.policy_allowed_capability_ids].every((items) => items.includes(requested));
  const sideEffect = input.capability.descriptor_side_effect;
  const sideInAll = noCapability || Boolean(sideEffect && [input.capability.agent_allowed_side_effects, input.capability.skill_allowed_side_effects, input.capability.policy_allowed_side_effects].every((items) => items.includes(sideEffect)) && sideEffect === input.action.side_effect);
  const knownAndLeast = noCapability || (input.capability.capability_known && capInAll && sideInAll);
  const forbiddenKeys = findForbiddenCredentialKeys(input);
  const secretRefsValid = input.secrets.secret_refs.every((item) => /^secret-ref:[a-z0-9._:/-]+$/i.test(item.ref) && hasText(item.purpose_ref) && !input.subject.authorization_grant_refs.includes(item.ref));
  const secretFields = secretReferenceFields(input);
  const secretInDisclosure = input.sensitive_data.proposed_disclosure_field_refs.some((ref) => secretFields.includes(ref));
  const secretInLogs = input.sensitive_data.proposed_log_field_refs.some((ref) => secretFields.includes(ref));
  const secretInMemory = input.sensitive_data.proposed_durable_memory_field_refs.some((ref) => secretFields.includes(ref));
  // The canonical decision is not a secret-reference transport. TRANSIENT_ONLY can
  // authorize an internal transient use, but never disclosure, logging or memory.
  const propagationSafe = !secretInDisclosure && !secretInLogs && !secretInMemory;
  const purpose = input.sensitive_data.purpose_required_field_refs;
  const authorized = input.sensitive_data.authorized_disclosure_field_refs;
  const inputRefs = input.sensitive_data.available_fields.map((item) => item.field_ref);
  const disclosureKnown = subset(input.sensitive_data.proposed_disclosure_field_refs, inputRefs);
  const traceSources = input.spec_refs.length > 0 && input.content.items.every((item) => item.source_refs.length > 0);
  const evidenceValid = input.acceptance.every((item) => hasText(item.id) && hasText(item.condition) && hasText(item.verification_method) && hasText(item.evidence_expected))
    && input.evidence_required.every((item) => hasText(item.kind) && hasText(item.description));
  const enforcementNeeded = protectedAction(input);
  const policyKnown = hasText(input.policy.policy_ref) && hasText(input.enforcement.policy_snapshot_ref) && hasText(input.enforcement.policy_fingerprint) && hasText(input.enforcement.action_policy_fingerprint);
  const authorityPass = sourceAuthorityPasses(input);
  const toolAuthorityAttempt = input.content.items.some((item) => item.source === "TOOL_OUTPUT" && item.authority !== "DATA_ONLY");
  return {
    identity: {
      authentication_result: result(publicAllowed || authenticated),
      provenance_result: result(trustedIdentity),
      public_mode_result: input.subject.authentication_mode === "PUBLIC" ? result(publicAllowed) : "NOT_APPLICABLE",
    },
    scope: {
      authorization_result: input.policy.authorization_required ? result(requiredGrants && input.policy.required_authorization_grant_refs.length > 0) : "NOT_APPLICABLE",
      tenant_isolation_result: input.scope.kind === "NONE" ? "NOT_APPLICABLE" : result(tenantSafe),
      confused_deputy_result: input.scope.kind === "NONE" && !toolAuthorityAttempt ? "NOT_APPLICABLE" : result(tenantSafe && !toolAuthorityAttempt),
    },
    capability: {
      allowlist_result: noCapability ? "NOT_APPLICABLE" : result(capInAll),
      side_effect_result: noCapability ? "NOT_APPLICABLE" : result(sideInAll),
      least_privilege_result: noCapability ? "NOT_APPLICABLE" : result(knownAndLeast),
    },
    action: {
      impact_result: result(["READ_ONLY", "REVERSIBLE", "HIGH_IMPACT", "DESTRUCTIVE_OR_IRREVERSIBLE"].includes(input.action.impact) && (input.action.side_effect === "NONE" || Boolean(requested)) && requiredApprovalPolicyPasses(input)),
      approval_result: highImpact(input) ? result(approvalPasses(input)) : "NOT_APPLICABLE",
      recovery_result: input.action.impact === "DESTRUCTIVE_OR_IRREVERSIBLE" ? result(recoveryPasses(input)) : "NOT_APPLICABLE",
    },
    secrets: {
      no_secret_value_result: result(forbiddenKeys.length === 0 && input.secrets.known_secret_findings.length === 0),
      reference_result: input.secrets.secret_refs.length ? result(secretRefsValid) : "NOT_APPLICABLE",
      propagation_result: input.secrets.secret_refs.length || secretFields.length ? result(propagationSafe) : "NOT_APPLICABLE",
    },
    content: {
      instruction_data_result: result(authorityPass),
      indirect_injection_result: input.content.items.some((item) => item.instruction_like_finding) ? result(authorityPass && !toolAuthorityAttempt) : "NOT_APPLICABLE",
      authority_conflict_result: result(!input.content.unresolved_authority_conflict),
    },
    data: {
      minimization_result: result(disclosureKnown && subset(input.sensitive_data.proposed_disclosure_field_refs, purpose)),
      disclosure_result: result(disclosureKnown && subset(input.sensitive_data.proposed_disclosure_field_refs, authorized)),
      memory_logging_result: result(subset(input.sensitive_data.proposed_log_field_refs, purpose) && subset(input.sensitive_data.proposed_log_field_refs, authorized) && subset(input.sensitive_data.proposed_durable_memory_field_refs, purpose) && subset(input.sensitive_data.proposed_durable_memory_field_refs, authorized) && propagationSafe),
    },
    enforcement: {
      point_result: enforcementNeeded ? result(["CALLER_GUARD", "API_AUTHORIZATION_BOUNDARY", "RESTRICTED_CAPABILITY_BOUNDARY", "RESOURCE_POLICY_BOUNDARY"].includes(input.enforcement.enforcement_point)) : "NOT_APPLICABLE",
      freshness_result: result(input.enforcement.evidence_current && input.enforcement.policy_fingerprint === input.enforcement.action_policy_fingerprint),
      fail_closed_result: result(policyKnown && input.subject.authentication_state !== "UNKNOWN" && trustedIdentity),
    },
    traceability: {
      source_refs_result: result(traceSources),
      evidence_result: result(evidenceValid),
      blocker_traceability_result: result(input.spec_refs.length > 0 && hasText(input.policy.policy_ref)),
    },
    boundary: { provider_neutral_result: "PASS", future_stage_result: "PASS", prior_contract_result: "PASS" },
  };
}

const ATOMIC_PATHS = ["identity.authentication_result", "identity.provenance_result", "identity.public_mode_result", "scope.authorization_result", "scope.tenant_isolation_result", "scope.confused_deputy_result", "capability.allowlist_result", "capability.side_effect_result", "capability.least_privilege_result", "action.impact_result", "action.approval_result", "action.recovery_result", "secrets.no_secret_value_result", "secrets.reference_result", "secrets.propagation_result", "content.instruction_data_result", "content.indirect_injection_result", "content.authority_conflict_result", "data.minimization_result", "data.disclosure_result", "data.memory_logging_result", "enforcement.point_result", "enforcement.freshness_result", "enforcement.fail_closed_result", "traceability.source_refs_result", "traceability.evidence_result", "traceability.blocker_traceability_result", "boundary.provider_neutral_result", "boundary.future_stage_result", "boundary.prior_contract_result"] as const;
const readPath = (value: unknown, path: string): unknown => path.split(".").reduce<unknown>((current, part) => current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined, value);
const flip = (value: SecurityCheckResult): SecurityCheckResult => value === "PASS" ? "FAIL" : "PASS";

export function deriveGuardrailsSecurityProfileFromRules(ruleTexts: readonly string[]): GuardrailsSecuritySynthesisProfile {
  const text = ruleTexts.join("\n");
  return { complete_atomic_reasoning: /deny by default|positive.*authorization/i.test(text) && /secret values forbidden|opaque secret/i.test(text) && /instruction.*data|prompt injection/i.test(text), complete_traceability: /traceability.*mandatory|source\/evidence refs/i.test(text), safe_boundaries: /provider neutrality|no later-stage pull-forward/i.test(text) };
}

function statusFromAtomic(atomic: GuardrailsAtomicDecision): GuardrailsSecurityStatus {
  const failures = ATOMIC_PATHS.filter((path) => readPath(atomic, path) === "FAIL");
  const nonApproval = failures.filter((path) => path !== "action.approval_result");
  if (nonApproval.length) return "BLOCKED";
  if (failures.includes("action.approval_result")) return "APPROVAL_REQUIRED";
  return "ALLOW";
}

function blockersFromAtomic(input: GuardrailsSecurityInput, atomic: GuardrailsAtomicDecision): GuardrailBlocker[] {
  return ATOMIC_PATHS.filter((path) => path !== "action.approval_result" && readPath(atomic, path) === "FAIL").map((path) => ({ code: `GUARDRAIL_${path.replace(/[.]/g, "_").toUpperCase()}`, message: `Required security check failed: ${path}.`, source_refs: [...input.spec_refs, input.policy.policy_ref].filter(Boolean) }));
}

function approvalRequirements(input: GuardrailsSecurityInput, atomic: GuardrailsAtomicDecision): GuardrailApprovalRequirement[] {
  return atomic.action.approval_result === "FAIL" && statusFromAtomic(atomic) === "APPROVAL_REQUIRED" ? [{ code: "FRESH_ACTION_BOUND_APPROVAL", action_fingerprint: input.action.action_fingerprint, reason: "A fresh, action-bound and policy-authorized distinct approval is required.", required_evidence_refs: [input.policy.policy_ref, "approval:action-fingerprint", "approval:freshness", "approval:authority"] }] : [];
}

export function synthesizeGuardrailsSecurityDecision(input: GuardrailsSecurityInput, profile: GuardrailsSecuritySynthesisProfile = deriveGuardrailsSecurityProfileFromRules([])): GuardrailsSecurityDecision {
  const atomic = clone(deriveExpectedGuardrailsAtomic(input));
  if (!profile.complete_atomic_reasoning) for (let index = 0; index < ATOMIC_PATHS.length; index += 3) for (const offset of [0, 1]) {
    const [group, field] = ATOMIC_PATHS[index + offset].split(".");
    const record = (atomic as unknown as Record<string, Record<string, SecurityCheckResult>>)[group];
    record[field] = flip(record[field]);
  }
  if (!profile.complete_traceability) { atomic.traceability.source_refs_result = flip(atomic.traceability.source_refs_result); atomic.traceability.evidence_result = flip(atomic.traceability.evidence_result); }
  if (!profile.safe_boundaries) { atomic.boundary.provider_neutral_result = flip(atomic.boundary.provider_neutral_result); atomic.boundary.future_stage_result = flip(atomic.boundary.future_stage_result); }
  const expected = deriveExpectedGuardrailsAtomic(input); const status = statusFromAtomic(expected);
  return { status, task_ref: input.task_ref, spec_refs: [...input.spec_refs], atomic, blockers: blockersFromAtomic(input, expected), approval_requirements: approvalRequirements(input, expected), permitted_capability_ids: status === "ALLOW" && input.capability.requested_capability_id ? [input.capability.requested_capability_id] : [], permitted_side_effects: status === "ALLOW" ? [input.action.side_effect] : [], allowed_disclosure_field_refs: status === "ALLOW" ? [...input.sensitive_data.proposed_disclosure_field_refs] : [], enforcement_required: protectedAction(input), enforcement_point: input.enforcement.enforcement_point, acceptance: clone(input.acceptance), evidence_required: clone(input.evidence_required) };
}

function inputErrors(input: GuardrailsSecurityInput): string[] {
  const errors: string[] = [];
  if (!hasText(input.task_ref) || !hasText(input.action.action_id) || !hasText(input.action.action_fingerprint)) errors.push("HI-001: one bounded task/action with an opaque fingerprint is required.");
  if (!input.spec_refs.length) errors.push("HI-043: spec refs and supplied evidence must be preserved.");
  if (!["NOT_APPLICABLE", "CALLER_GUARD", "API_AUTHORIZATION_BOUNDARY", "RESTRICTED_CAPABILITY_BOUNDARY", "RESOURCE_POLICY_BOUNDARY"].includes(input.enforcement.enforcement_point)) errors.push("HI-037: enforcement point enum is unknown.");
  if (findForbiddenCredentialKeys(input).length) errors.push("HI-026: finite scanner found a forbidden credential-like key.");
  return errors;
}

function structuralErrors(candidate: GuardrailsSecurityDecision, input: GuardrailsSecurityInput, expected: GuardrailsAtomicDecision): string[] {
  const errors: string[] = [];
  if (candidate.task_ref !== input.task_ref || !same(candidate.spec_refs, input.spec_refs)) errors.push("HI-001: candidate task/spec boundary differs from the bounded input.");
  for (const path of ATOMIC_PATHS) if (readPath(candidate.atomic, path) !== readPath(expected, path)) errors.push(`HI-041: actual candidate atomic field ${path} differs from deterministic recomputation.`);
  if (!same(candidate.acceptance, input.acceptance) || !same(candidate.evidence_required, input.evidence_required)) errors.push("HI-043: acceptance/evidence was changed or invented.");
  const expectedStatus = statusFromAtomic(expected); const expectedCapabilities = expectedStatus === "ALLOW" && input.capability.requested_capability_id ? [input.capability.requested_capability_id] : []; const expectedSideEffects = expectedStatus === "ALLOW" ? [input.action.side_effect] : []; const expectedDisclosure = expectedStatus === "ALLOW" ? input.sensitive_data.proposed_disclosure_field_refs : [];
  if (!same(candidate.permitted_capability_ids, expectedCapabilities) || !same(candidate.permitted_side_effects, expectedSideEffects) || !same(candidate.allowed_disclosure_field_refs, expectedDisclosure)) errors.push("HI-024: candidate permission/disclosure projection exceeds deterministic least privilege.");
  if (candidate.enforcement_required !== protectedAction(input) || candidate.enforcement_point !== input.enforcement.enforcement_point) errors.push("HI-037: candidate enforcement projection differs from bounded input.");
  if (candidate.blockers.some((item) => !item.source_refs.length) || candidate.approval_requirements.some((item) => !item.required_evidence_refs.length || item.action_fingerprint !== input.action.action_fingerprint)) errors.push("HI-042: blocker/approval traceability is incomplete.");
  const serialized = JSON.stringify(candidate);
  if (FORBIDDEN_SECURITY_BINDING_PATTERN.test(serialized)) errors.push("HI-045: provider/security-runtime binding is forbidden.");
  if (FUTURE_STAGE_IMPLEMENTATION_PATTERN.test(serialized)) errors.push("HI-048: future-stage implementation is forbidden.");
  if (PRIOR_CONTRACT_REWRITE_PATTERN.test(serialized)) errors.push("HI-047: prior S13I/J/K rewrite is forbidden.");
  if (findForbiddenCredentialKeys(candidate).length) errors.push("HI-026: decision contains a forbidden credential-like key.");
  return errors;
}

export function validateGuardrailsSecurityInput(input: GuardrailsSecurityInput): GuardrailsSecurityValidationResult {
  const expected = deriveExpectedGuardrailsAtomic(input); const errors = [...inputErrors(input), ...ATOMIC_PATHS.filter((path) => readPath(expected, path) === "FAIL" && path !== "action.approval_result").map((path) => `HI-039: required gate failed at ${path}.`)];
  const recomputed_status = errors.length ? "BLOCKED" : statusFromAtomic(expected);
  const hard = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`HI-${String(index + 1).padStart(3, "0")}`, true]));
  if (errors.length) hard["HI-039"] = false;
  return { valid: errors.length === 0, errors, hard_invariants: hard, recomputed_status };
}

export function validateGuardrailsSecurityDecision(candidate: GuardrailsSecurityDecision, input: GuardrailsSecurityInput): GuardrailsSecurityValidationResult {
  const expected = deriveExpectedGuardrailsAtomic(input); const base = inputErrors(input); const structural = structuralErrors(candidate, input, expected); const expectedStatus = base.length || ATOMIC_PATHS.some((path) => path !== "action.approval_result" && readPath(expected, path) === "FAIL") ? "BLOCKED" : statusFromAtomic(expected);
  const statusErrors = candidate.status === expectedStatus ? [] : [`HI-041: candidate status '${candidate.status}' differs from recomputed '${expectedStatus}'.`];
  const errors = [...base, ...structural, ...statusErrors]; const hard = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`HI-${String(index + 1).padStart(3, "0")}`, true]));
  for (const error of errors) { const match = error.match(/HI-\d{3}/); if (match) hard[match[0]] = false; }
  return { valid: errors.length === 0, errors, hard_invariants: hard, recomputed_status: expectedStatus };
}

export function gateGuardrailsSecurity(input: GuardrailsSecurityInput, candidate: GuardrailsSecurityDecision): { decision: GuardrailsSecurityDecision; decisionValidation: GuardrailsSecurityValidationResult } {
  const expected = deriveExpectedGuardrailsAtomic(input); const errors = [...inputErrors(input), ...structuralErrors(candidate, input, expected)]; const expectedStatus = statusFromAtomic(expected); const decision = clone(candidate);
  decision.status = errors.length ? "BLOCKED" : expectedStatus;
  decision.blockers = [...blockersFromAtomic(input, expected), ...errors.map((message, index) => ({ code: `CANDIDATE_GATE_${index + 1}`, message, source_refs: [...input.spec_refs, input.policy.policy_ref].filter(Boolean) }))];
  decision.approval_requirements = errors.length ? [] : approvalRequirements(input, expected);
  decision.permitted_capability_ids = decision.status === "ALLOW" && input.capability.requested_capability_id ? [input.capability.requested_capability_id] : [];
  decision.permitted_side_effects = decision.status === "ALLOW" ? [input.action.side_effect] : [];
  decision.allowed_disclosure_field_refs = decision.status === "ALLOW" ? [...input.sensitive_data.proposed_disclosure_field_refs] : [];
  return { decision, decisionValidation: validateGuardrailsSecurityDecision(decision, input) };
}

export const GUARDRAILS_ATOMIC_PATHS = ATOMIC_PATHS;
