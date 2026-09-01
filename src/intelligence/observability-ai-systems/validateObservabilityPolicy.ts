import { POLICY_KEYS, S13P_LIMITS } from "./constants.js";
import type { ObservabilityDiagnostic, ObservabilityPolicy } from "./types.js";
import { containsProhibitedContent, isPlainObject, isSafeInteger, isSafeRef } from "./validateSafeObservation.js";

export interface PolicyCheck {
  readonly valid: boolean;
  readonly diagnostics: readonly ObservabilityDiagnostic[];
  readonly retentionDowngraded: boolean;
}

const reject = (fieldPath: string): ObservabilityDiagnostic => ({
  code: "INVALID_POLICY",
  severity: "REJECT",
  fieldPath,
  count: 1,
});

/**
 * Semantic contract section 9 and 7: a policy override MUST be stricter than or
 * equal to the v1 ceilings and MUST NOT raise any of them. Retention above the
 * class ceiling is downgraded to a PARTIAL directive rather than accepted.
 */
export function validateObservabilityPolicy(value: unknown): PolicyCheck {
  const diagnostics: ObservabilityDiagnostic[] = [];
  let retentionDowngraded = false;

  if (!isPlainObject(value)) return { valid: false, diagnostics: [reject("policy")], retentionDowngraded };
  if (Object.keys(value).some((key) => !POLICY_KEYS.includes(key))) diagnostics.push(reject("policy.unknownKey"));
  if (containsProhibitedContent(value)) diagnostics.push({ code: "PROHIBITED_FIELD", severity: "REJECT", fieldPath: "policy", count: 1 });

  if (value.policyVersion !== "s13p.policy.v1") diagnostics.push(reject("policy.policyVersion"));

  if (!isPlainObject(value.limits)) {
    diagnostics.push(reject("policy.limits"));
  } else {
    const limitKeys = Object.keys(S13P_LIMITS) as (keyof typeof S13P_LIMITS)[];
    if (Object.keys(value.limits).some((key) => !limitKeys.includes(key as keyof typeof S13P_LIMITS)))
      diagnostics.push(reject("policy.limits.unknownKey"));
    for (const key of limitKeys) {
      const supplied = (value.limits as Record<string, unknown>)[key];
      if (supplied === undefined) continue;
      if (!isSafeInteger(supplied) || supplied > S13P_LIMITS[key]) diagnostics.push(reject(`policy.limits.${key}`));
    }
  }

  const bp = value.successDetailSamplingBasisPoints;
  if (!isSafeInteger(bp) || bp > S13P_LIMITS.samplingBasisPointsMax) diagnostics.push(reject("policy.successDetailSamplingBasisPoints"));

  if (!isSafeRef(value.samplingSeed)) diagnostics.push(reject("policy.samplingSeed"));

  const retention = value.requestedRetention;
  if (!isPlainObject(retention)) {
    diagnostics.push(reject("policy.requestedRetention"));
  } else if (Object.keys(retention).some((key) => key !== "class" && key !== "days")) {
    diagnostics.push(reject("policy.requestedRetention.unknownKey"));
  } else {
    const cls = retention.class;
    const days = retention.days;
    if (cls === "EPHEMERAL") {
      if (days !== 0) diagnostics.push(reject("policy.requestedRetention.days"));
    } else if (cls === "OPERATIONAL") {
      if (!isSafeInteger(days) || days < 1) diagnostics.push(reject("policy.requestedRetention.days"));
      else if (days > S13P_LIMITS.maxOperationalRetentionDays) retentionDowngraded = true;
    } else if (cls === "AUDIT_REF_ONLY") {
      if (!isSafeInteger(days) || days < 1) diagnostics.push(reject("policy.requestedRetention.days"));
      else if (days > S13P_LIMITS.maxAuditRefRetentionDays) retentionDowngraded = true;
    } else {
      diagnostics.push(reject("policy.requestedRetention.class"));
    }
  }

  if (typeof value.allowTemplateDigest !== "boolean") diagnostics.push(reject("policy.allowTemplateDigest"));
  if (typeof value.allowErrorFingerprint !== "boolean") diagnostics.push(reject("policy.allowErrorFingerprint"));

  return { valid: diagnostics.length === 0, diagnostics, retentionDowngraded };
}

/** Effective ceiling for one limit: the stricter of the policy override and the v1 ceiling. */
export function effectiveLimit(policy: ObservabilityPolicy, key: keyof typeof S13P_LIMITS): number {
  const override = policy.limits?.[key];
  const ceiling = S13P_LIMITS[key];
  return typeof override === "number" && override >= 0 && override <= ceiling ? override : ceiling;
}
