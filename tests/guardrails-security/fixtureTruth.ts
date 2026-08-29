import type { FrozenGuardrailsSecurityFixtureTruth, GuardrailsAtomicDecision, GuardrailsSecurityInput } from "../../src/intelligence/guardrails-security/types.js";
import { ALL_POSITIVE_INPUTS } from "./fixtureInputs.js";

/** Provider-blind frozen oracle. It imports/calls no provider, synthesizer, parser, gate or evaluator. */
function projectAtomicOracle(input: GuardrailsSecurityInput): GuardrailsAtomicDecision {
  const publicMode = input.subject.authentication_mode === "PUBLIC";
  const scoped = input.scope.kind !== "NONE";
  const requested = Boolean(input.capability.requested_capability_id);
  const high = input.action.impact === "HIGH_IMPACT" || input.action.impact === "DESTRUCTIVE_OR_IRREVERSIBLE";
  const destructive = input.action.impact === "DESTRUCTIVE_OR_IRREVERSIBLE";
  const hasSecretRefs = input.secrets.secret_refs.length > 0;
  const hasInjectionFinding = input.content.items.some((item) => item.instruction_like_finding);
  const approval = !high || Boolean(input.approval.record);
  return {
    identity: { authentication_result: "PASS", provenance_result: "PASS", public_mode_result: publicMode ? "PASS" : "NOT_APPLICABLE" },
    scope: { authorization_result: input.policy.authorization_required ? "PASS" : "NOT_APPLICABLE", tenant_isolation_result: scoped ? "PASS" : "NOT_APPLICABLE", confused_deputy_result: scoped ? "PASS" : "NOT_APPLICABLE" },
    capability: { allowlist_result: requested ? "PASS" : "NOT_APPLICABLE", side_effect_result: requested ? "PASS" : "NOT_APPLICABLE", least_privilege_result: requested ? "PASS" : "NOT_APPLICABLE" },
    action: { impact_result: "PASS", approval_result: high ? (approval ? "PASS" : "FAIL") : "NOT_APPLICABLE", recovery_result: destructive ? "PASS" : "NOT_APPLICABLE" },
    secrets: { no_secret_value_result: "PASS", reference_result: hasSecretRefs ? "PASS" : "NOT_APPLICABLE", propagation_result: hasSecretRefs ? "PASS" : "NOT_APPLICABLE" },
    content: { instruction_data_result: "PASS", indirect_injection_result: hasInjectionFinding ? "PASS" : "NOT_APPLICABLE", authority_conflict_result: "PASS" },
    data: { minimization_result: "PASS", disclosure_result: "PASS", memory_logging_result: "PASS" },
    enforcement: { point_result: publicMode ? "NOT_APPLICABLE" : "PASS", freshness_result: "PASS", fail_closed_result: "PASS" },
    traceability: { source_refs_result: "PASS", evidence_result: "PASS", blocker_traceability_result: "PASS" },
    boundary: { provider_neutral_result: "PASS", future_stage_result: "PASS", prior_contract_result: "PASS" },
  };
}
function observe(atomic: GuardrailsAtomicDecision): Record<string, unknown> { return {
  "SD1-A": atomic.identity.authentication_result, "SD1-B": atomic.identity.provenance_result, "SD1-C": atomic.identity.public_mode_result,
  "SD2-A": atomic.scope.authorization_result, "SD2-B": atomic.scope.tenant_isolation_result, "SD2-C": atomic.scope.confused_deputy_result,
  "SD3-A": atomic.capability.allowlist_result, "SD3-B": atomic.capability.side_effect_result, "SD3-C": atomic.capability.least_privilege_result,
  "SD4-A": atomic.action.impact_result, "SD4-B": atomic.action.approval_result, "SD4-C": atomic.action.recovery_result,
  "SD5-A": atomic.secrets.no_secret_value_result, "SD5-B": atomic.secrets.reference_result, "SD5-C": atomic.secrets.propagation_result,
  "SD6-A": atomic.content.instruction_data_result, "SD6-B": atomic.content.indirect_injection_result, "SD6-C": atomic.content.authority_conflict_result,
  "SD7-A": atomic.data.minimization_result, "SD7-B": atomic.data.disclosure_result, "SD7-C": atomic.data.memory_logging_result,
  "SD8-A": atomic.enforcement.point_result, "SD8-B": atomic.enforcement.freshness_result, "SD8-C": atomic.enforcement.fail_closed_result,
  "SD9-A": atomic.traceability.source_refs_result, "SD9-B": atomic.traceability.evidence_result, "SD9-C": atomic.traceability.blocker_traceability_result,
  "SD10-A": atomic.boundary.provider_neutral_result, "SD10-B": atomic.boundary.future_stage_result, "SD10-C": atomic.boundary.prior_contract_result, "XC-A": true,
}; }
export const FROZEN_GUARDRAILS_SECURITY_FIXTURE_TRUTH: readonly FrozenGuardrailsSecurityFixtureTruth[] = Object.freeze(ALL_POSITIVE_INPUTS.map((input) => Object.freeze({ task_ref: input.task_ref, expected_assertions: Object.freeze(observe(projectAtomicOracle(input))) })));
