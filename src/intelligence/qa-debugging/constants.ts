export const QA_DEBUGGING_SKILL_ID = "intelligence.qa-debugging.s13m";
export const QA_DEBUGGING_QUALITY_CONTRACT_REF = "S13M_QA_DEBUGGING_DEEP";
export const QA_DEBUGGING_INPUT_MARKER = "[[QA_DEBUGGING_INPUT]]";
export const QA_DEBUGGING_SKILL_MARKER = "[[QA_DEBUGGING_SKILL]]";

/** Deliberately bounded structural hygiene, not secret discovery. */
export const FORBIDDEN_SENSITIVE_KEY = /(?:password|secret(?:_?value)?|api_?key|access_?token|private_?key|cookie|bearer)/i;
export const FUTURE_STAGE_PATTERN = /(?:retry|backoff|idempotency|async[ _-]?job|telemetry|tracing|observability|golden[ _-]?case|capability registry|\bmcp\b|shell|browser|network|deployment)/i;
