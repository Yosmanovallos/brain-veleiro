export const GUARDRAILS_SECURITY_SKILL_ID = "intelligence.guardrails-security.s13l";
export const GUARDRAILS_SECURITY_QUALITY_CONTRACT_REF = "S13L_GUARDRAILS_SECURITY_DEEP";
export const GUARDRAILS_SECURITY_INPUT_MARKER = "[[GUARDRAILS_SECURITY_INPUT]]";
export const GUARDRAILS_SECURITY_SKILL_MARKER = "[[GUARDRAILS_SECURITY_SKILL]]";

/** A deliberately finite key/shape defense. It is not arbitrary-string secret detection. */
export const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /^(?:password|passwd|secret(?:_?value)?|api_?key|access_?token|refresh_?token|bearer_?token|private_?key|cookie_?secret|client_?secret)$/i;
export const FORBIDDEN_SECURITY_BINDING_PATTERN = /\b(?:auth0|okta|keycloak|cognito|vault|kms|snyk|lakera|prompt shield|capability registry|mcp server|oauth middleware|jwt verifier|soc\s*2 certified|hipaa compliant)\b/i;
export const FUTURE_STAGE_IMPLEMENTATION_PATTERN = /\b(?:S13M|S13N|S13O|S13P|S13Q|S13R|S14)\b.{0,48}\b(?:implemented|runtime|provider|framework|registry|stack|deployment)\b/i;
export const PRIOR_CONTRACT_REWRITE_PATTERN = /\b(?:rewrite|replace|override)\b.{0,48}\bS13[ijk]\b/i;

