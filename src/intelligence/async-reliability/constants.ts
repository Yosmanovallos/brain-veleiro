import type { AsyncReliabilityJobState, ReliabilityFailureClass } from "./types.js";
export const ASYNC_RELIABILITY_SKILL_ID = "intelligence.async-reliability.s13o";
export const ASYNC_RELIABILITY_QUALITY_CONTRACT_REF = "S13O_ASYNC_RELIABILITY_DEEP";
export const ASYNC_RELIABILITY_INPUT_MARKER = "[[ASYNC_RELIABILITY_INPUT]]";
export const ASYNC_RELIABILITY_SKILL_MARKER = "[[ASYNC_RELIABILITY_SKILL]]";
export const RETRY_CANDIDATES = new Set<ReliabilityFailureClass>(["TRANSIENT", "RATE_LIMITED", "TIMEOUT"]);
export const TERMINAL_JOB_STATES = new Set<AsyncReliabilityJobState>(["SUCCEEDED", "FAILED", "CANCELLED", "BLOCKED"]);
export const ALLOWED_JOB_TRANSITIONS: Record<AsyncReliabilityJobState, readonly AsyncReliabilityJobState[]> = { PENDING:["RUNNING","CANCELLED","BLOCKED"], RUNNING:["WAITING_RETRY","RECONCILING","SUCCEEDED","FAILED","CANCELLED","BLOCKED"], WAITING_RETRY:["RUNNING","CANCELLED","FAILED","BLOCKED"], RECONCILING:["RUNNING","SUCCEEDED","FAILED","CANCELLED","BLOCKED"], SUCCEEDED:[], FAILED:[], CANCELLED:[], BLOCKED:[] };
export const FORBIDDEN_SENSITIVE_KEY = /(?:password|secret(?:_?value)?|api_?key|access_?token|private_?key|cookie|bearer|authorization|idempotency[_-]?key|raw[_-]?(?:sensitive[_-]?)?(?:request|response|payload))/i;
export const FORBIDDEN_SENSITIVE_VALUE = /(?:-----BEGIN(?: RSA|EC|OPENSSH)? PRIVATE KEY-----|\bbearer\s+[a-z0-9._~+/=-]{4,}|\b(?:authorization|proxy-authorization|password|secret|api[_-]?key|access[_-]?token|cookie|idempotency[_-]?key)\s*[:=]\s*["']?[^\s"']{4,}|\braw[_-]?(?:sensitive[_-]?)?(?:request|response|payload)\s*[:=]\s*\S+)/i;

/** Rejects secret-bearing keys and values throughout canonical input/candidate shapes. */
export function containsForbiddenSensitiveMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "string") return FORBIDDEN_SENSITIVE_VALUE.test(value);
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsForbiddenSensitiveMaterial(item, seen));
  return Object.entries(value as Record<string, unknown>).some(([key, item]) => FORBIDDEN_SENSITIVE_KEY.test(key) || containsForbiddenSensitiveMaterial(item, seen));
}
