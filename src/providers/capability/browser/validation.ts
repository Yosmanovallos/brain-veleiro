/**
 * S14G — Browser Inspect Capability: closed configuration/input validation,
 * bounded primitive grammars and the fixed safe error vocabulary.
 *
 * Runtime validation is INDEPENDENT of the public descriptor schema: every
 * bound asserted here holds even if a caller bypasses schema checking.
 */

import type { NormalizedToolError } from "../../../core/agent/types.js";
import {
  LIMITS,
  type BrowserInspectInput,
  type BrowserInspectProviderConfig,
} from "./types.js";

export type FailureCode = NormalizedToolError["code"];

export const SAFE_MESSAGES = {
  invalidConfig: "Invalid explicit browser inspect provider configuration.",
  invalidInput: "The browser inspect input or invocation envelope was invalid.",
  notFoundCapability: "Unknown browser inspect capability.",
  navigationDenied: "The requested URL is not in the allowed navigation origins.",
  requestDenied: "The requested network origin or method is not permitted by this configuration.",
  unavailable: "The browser runtime or remote site could not be reached.",
  downloadBlocked: "The navigation became a download and was not permitted.",
  wsBlocked: "WebSocket connections are blocked.",
  popupBlocked: "An additional page or popup was blocked.",
  timeout: "The browser inspection exceeded the effective timeout and in-flight work was aborted.",
  outputOverflow: "The browser observation exceeded the permitted bounds.",
  internalError: "The browser inspection could not complete safely.",
} as const;

export class Rejection extends Error {
  constructor(
    readonly code: FailureCode,
    readonly safeMessage: string,
    readonly retryableOverride?: boolean,
  ) {
    super("Browser inspection rejected.");
    this.name = "Rejection";
  }
}

export function reject(code: FailureCode, safeMessage: string, retryableOverride?: boolean): never {
  throw new Rejection(code, safeMessage, retryableOverride);
}

const invalid = (): never => reject("INVALID_INPUT", SAFE_MESSAGES.invalidInput);

// --- bounded primitives ---------------------------------------------------

export const BROWSER_ID_RE = /^[a-z0-9][a-z0-9._-]{0,159}$/;

export const ENVELOPE_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf-8");
}

export function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) return true;
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function hasControls(value: string, allow: readonly number[] = []): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (allow.includes(code)) continue;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function toSafeError(value: string): string {
  const ascii = value.replace(/[^\x20-\x7E]/g, "?");
  return ascii.length > LIMITS.safeErrorAsciiChars ? ascii.slice(0, LIMITS.safeErrorAsciiChars) : ascii;
}

/** Plain data object with no accessors, no exotic prototype. */
export function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value) as object | null) &&
    Reflect.ownKeys(value).every(
      (key) => typeof key === "string" && "value" in Object.getOwnPropertyDescriptor(value, key)!,
    )
  );
}

// --- trusted configuration (contract §5) ----------------------------------

const CONFIG_KEYS = [
  "browser_id",
  "allowed_navigation_origins",
  "allowed_request_origins",
  "max_timeout_ms",
  "snapshot_depth",
  "max_snapshot_bytes",
  "max_links",
] as const;

export function validateConfig(raw: unknown): BrowserInspectProviderConfig {
  const bad = (): never => reject("INVALID_INPUT", SAFE_MESSAGES.invalidConfig);
  if (!plainObject(raw)) return bad();
  for (const key of Object.keys(raw)) {
    if (!CONFIG_KEYS.includes(key as (typeof CONFIG_KEYS)[number])) return bad();
  }

  const {
    browser_id,
    allowed_navigation_origins,
    allowed_request_origins,
    max_timeout_ms,
    snapshot_depth,
    max_snapshot_bytes,
    max_links,
  } = raw;

  if (typeof browser_id !== "string" || !BROWSER_ID_RE.test(browser_id)) return bad();

  const navigationOrigins = validateOriginArray(allowed_navigation_origins, LIMITS.navigationOriginsMax, bad);
  const requestOrigins = validateOriginArray(allowed_request_origins, LIMITS.requestOriginsMax, bad);

  for (const origin of navigationOrigins) {
    if (!requestOrigins.includes(origin)) return bad();
  }

  if (
    typeof max_timeout_ms !== "number" ||
    !Number.isInteger(max_timeout_ms) ||
    max_timeout_ms < 1 ||
    max_timeout_ms > LIMITS.configTimeoutMs
  ) {
    return bad();
  }

  if (
    typeof snapshot_depth !== "number" ||
    !Number.isInteger(snapshot_depth) ||
    snapshot_depth < LIMITS.snapshotDepthMin ||
    snapshot_depth > LIMITS.snapshotDepthMax
  ) {
    return bad();
  }

  if (
    typeof max_snapshot_bytes !== "number" ||
    !Number.isInteger(max_snapshot_bytes) ||
    max_snapshot_bytes < LIMITS.maxSnapshotBytesMin ||
    max_snapshot_bytes > LIMITS.maxSnapshotBytesMax
  ) {
    return bad();
  }

  if (
    typeof max_links !== "number" ||
    !Number.isInteger(max_links) ||
    max_links < LIMITS.maxLinksMin ||
    max_links > LIMITS.maxLinksMax
  ) {
    return bad();
  }

  return {
    browser_id,
    allowed_navigation_origins: navigationOrigins,
    allowed_request_origins: requestOrigins,
    max_timeout_ms,
    snapshot_depth,
    max_snapshot_bytes,
    max_links,
  };
}

function validateOriginArray(value: unknown, max: number, bad: () => never): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) return bad();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return bad();
    const origin = canonicalOrigin(item, bad);
    if (seen.has(origin)) return bad();
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

export function canonicalOrigin(value: string, fail: () => never = invalid): string {
  if (utf8Bytes(value) > LIMITS.urlBytes || hasControls(value) || hasLoneSurrogate(value)) return fail();
  let parsed: URL | undefined;
  try {
    parsed = new URL(value);
  } catch {
    return fail();
  }
  if (!parsed) return fail();

  if (parsed.protocol !== "https:") return fail();
  if (parsed.username || parsed.password) return fail();
  if (!parsed.hostname) return fail();
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return fail();
  if (parsed.origin !== value) return fail();
  if (isForbiddenHostname(parsed.hostname)) return fail();
  return parsed.origin;
}

export function isForbiddenHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return true;
  if (!hostname.includes(".")) return true; // single-label
  if (hostname.includes("*") || hostname.includes("?")) return true;
  if (hostname.startsWith(".") || hostname.endsWith(".")) return true;

  const parts = hostname.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) return true; // IPv4
  if (hostname.includes(":")) return true; // IPv6 or port leaked into hostname

  return false;
}

// --- invocation envelope (contract §8, §15) -------------------------------

export function validateEnvelope(request: {
  run_id: unknown;
  call_id: unknown;
  turn: unknown;
  timeout_ms: unknown;
  input: unknown;
}): void {
  if (typeof request.run_id !== "string" || !ENVELOPE_ID_RE.test(request.run_id)) invalid();
  if (typeof request.call_id !== "string" || !ENVELOPE_ID_RE.test(request.call_id)) invalid();
  if (
    typeof request.turn !== "number" ||
    !Number.isInteger(request.turn) ||
    request.turn < 0 ||
    request.turn > Number.MAX_SAFE_INTEGER
  ) {
    invalid();
  }
  if (
    typeof request.timeout_ms !== "number" ||
    !Number.isInteger(request.timeout_ms) ||
    request.timeout_ms < 1 ||
    request.timeout_ms > LIMITS.configTimeoutMs
  ) {
    invalid();
  }
  if (!plainObject(request.input)) invalid();
}

// --- closed input (contract §4) -------------------------------------------

export function validateInput(input: Record<string, unknown>, allowedOrigins: string[]): BrowserInspectInput {
  const allowed = ["url", "wait_until"];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) invalid();
  }

  const rawUrl = input.url;
  if (typeof rawUrl !== "string") throw invalid();
  const url = validateUrl(rawUrl, allowedOrigins);

  let waitUntil: "domcontentloaded" | "load" = "domcontentloaded";
  if (input.wait_until !== undefined) {
    if (input.wait_until !== "domcontentloaded" && input.wait_until !== "load") invalid();
    waitUntil = input.wait_until as "domcontentloaded" | "load";
  }

  return { url, wait_until: waitUntil };
}

export function validateUrl(value: string, allowedOrigins: string[]): string {
  if (utf8Bytes(value) > LIMITS.urlBytes || hasLoneSurrogate(value) || hasControls(value)) throw invalid();

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalid();
  }

  if (parsed.protocol !== "https:") throw invalid();
  if (parsed.username || parsed.password) throw invalid();
  if (!parsed.hostname) throw invalid();
  if (isForbiddenHostname(parsed.hostname)) throw invalid();

  const origin = parsed.origin;
  if (!allowedOrigins.includes(origin)) reject("PERMISSION_DENIED", SAFE_MESSAGES.navigationDenied);

  return value;
}

// --- safe output helpers --------------------------------------------------

export function safeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function isAllowedOrigin(value: string, allowed: ReadonlySet<string>): boolean {
  const origin = safeOrigin(value);
  if (!origin) return false;
  if (safeOrigin(origin) !== origin) return false; // ensure canonical
  return allowed.has(origin);
}
