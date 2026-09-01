import type { AsyncReliabilityJobState, ReliabilityFailureClass } from "./types.js";
export const ASYNC_RELIABILITY_SKILL_ID = "intelligence.async-reliability.s13o";
export const ASYNC_RELIABILITY_QUALITY_CONTRACT_REF = "S13O_ASYNC_RELIABILITY_DEEP";
export const ASYNC_RELIABILITY_INPUT_MARKER = "[[ASYNC_RELIABILITY_INPUT]]";
export const ASYNC_RELIABILITY_SKILL_MARKER = "[[ASYNC_RELIABILITY_SKILL]]";
export const RETRY_CANDIDATES = new Set<ReliabilityFailureClass>(["TRANSIENT", "RATE_LIMITED", "TIMEOUT"]);
export const TERMINAL_JOB_STATES = new Set<AsyncReliabilityJobState>(["SUCCEEDED", "FAILED", "CANCELLED", "BLOCKED"]);
export const ALLOWED_JOB_TRANSITIONS: Record<AsyncReliabilityJobState, readonly AsyncReliabilityJobState[]> = { PENDING:["RUNNING","CANCELLED","BLOCKED"], RUNNING:["WAITING_RETRY","RECONCILING","SUCCEEDED","FAILED","CANCELLED","BLOCKED"], WAITING_RETRY:["RUNNING","CANCELLED","FAILED","BLOCKED"], RECONCILING:["RUNNING","SUCCEEDED","FAILED","CANCELLED","BLOCKED"], SUCCEEDED:[], FAILED:[], CANCELLED:[], BLOCKED:[] };
export const FORBIDDEN_SENSITIVE_KEY = /(?:password|secret(?:_?value)?|api_?key|access_?token|private_?key|cookie|bearer|authorization|idempotency[_-]?key|raw[_-]?(?:sensitive[_-]?)?(?:request|response|payload))/i;
