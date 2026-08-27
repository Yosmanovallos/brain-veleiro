import { DEFAULT_ERROR_STATUS, NEVER_LEAK_CLASSES } from "./constants.js";
import { stableStringify, pushError } from "./sharedValidation.js";
import type { ApiErrorVariant, BackendApiEngineeringInput, BackendApiValidationResult } from "./types.js";

function inferredCategory(code: string): keyof typeof DEFAULT_ERROR_STATUS | undefined {
  const c = code.toLowerCase();
  if (/payload.*large/.test(c)) return "payload_too_large";
  if (/unsupported.*media/.test(c)) return "unsupported_media";
  if (/rate.*limit/.test(c)) return "rate_limit";
  if (/authentication|unauthenticated|invalid_auth/.test(c)) return "authentication";
  if (/authorization|forbidden|access_denied/.test(c)) return "authorization";
  if (/not.*found/.test(c)) return "not_found";
  if (/conflict/.test(c)) return "conflict";
  if (/validation|invalid_request/.test(c)) return "validation";
  if (/internal/.test(c)) return "internal";
  return undefined;
}

function leaks(variant: ApiErrorVariant): boolean {
  const blob = stableStringify(variant).toUpperCase();
  return NEVER_LEAK_CLASSES.some((token) => blob.includes(token)) ||
    /\b(SELECT|INSERT|UPDATE|DELETE)\b.+\b(FROM|INTO|SET)\b|-----BEGIN .*PRIVATE KEY-----|[A-Z]:\\|\/home\//i.test(blob);
}

export function validateErrorContract(input: BackendApiEngineeringInput): BackendApiValidationResult {
  const errors: string[] = [];
  const codes = new Set<string>();
  for (const variant of input.error_contract.variants ?? []) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(variant.code) || codes.has(variant.code)) pushError(errors, "HI-021", `error code '${variant.code}' is not stable/unique`);
    codes.add(variant.code);
    if (!variant.safe_message?.trim() || !Number.isInteger(variant.http_status)) pushError(errors, "HI-021", `error '${variant.code}' lacks safe message/status`);
    if (variant.details_policy === "SAFE_SCHEMA_BOUNDED" && !variant.details_schema) pushError(errors, "HI-021", `error '${variant.code}' needs a bounded details schema`);
    const category = inferredCategory(variant.code);
    if (category && variant.http_status !== DEFAULT_ERROR_STATUS[category]) pushError(errors, "HI-021", `${variant.code} must map to ${DEFAULT_ERROR_STATUS[category]}`);
    if (variant.http_status === 429 && !input.compatibility_contract.rate_limit_requirement_ref) pushError(errors, "HI-033", "429 requires a rate-limit requirement ref");
    if (leaks(variant)) pushError(errors, "HI-022", `error '${variant.code}' exposes a never-leak class`);
  }
  return { valid: errors.length === 0, errors };
}
