/**
 * S14F — GitHub Capability: closed configuration/input validation, bounded
 * primitive grammars, the finite outbound secret floor and the fixed safe
 * error vocabulary (contract §4, §8, §14, §16).
 *
 * Runtime validation is INDEPENDENT of the public descriptor schemas: every
 * bound asserted here holds even if a caller bypasses schema checking
 * (S14F-HI-010).
 */

import type { NormalizedToolError } from "../../../core/agent/types.js";
import {
  GITHUB_CAPABILITY_IDS,
  LIMITS,
  type GitHubCapabilityId,
  type GitHubRestProviderConfig,
  type CommentRepositoryReviewInput,
  type OpenRepositoryReviewInput,
} from "./types.js";

export type FailureCode = NormalizedToolError["code"];

/** Every model-visible failure carries a fixed, bounded, ASCII safe message. */
export const SAFE_MESSAGES = {
  invalidConfig: "Invalid explicit GitHub repository provider configuration.",
  invalidInput: "The repository capability input or invocation envelope was invalid.",
  notFoundCapability: "Unknown or disabled repository capability.",
  credentialUnavailable: "The repository credential for this configuration could not be resolved.",
  accessDenied: "The remote repository service denied access for this operation.",
  redirectDenied: "The remote repository service answered with a redirect, which is not permitted.",
  remoteNotFound: "The remote repository resource is not available to this configuration.",
  remoteRejected: "The remote repository service rejected the operation as conflicting or unprocessable.",
  malformedRemote: "The remote repository response could not be normalized into a safe bounded result.",
  outputOverflow: "The remote response or normalized observation exceeded the permitted bounds.",
  unavailableRead: "The remote repository service was unavailable or rate limited; the read may be retried.",
  unavailableWrite: "The remote repository service was unavailable or rate limited before dispatch; no write was made.",
  timeoutRead: "The remote repository read exceeded the effective timeout and in-flight work was aborted.",
  timeoutWrite: "The remote repository write exceeded the effective timeout before dispatch; no write was made.",
  writeOutcomeUnknown: "The remote write outcome is unknown and must be inspected before any retry.",
  staleHead: "The expected head commit no longer matches the remote branch; no remote write was attempted.",
  staleBase: "The expected base commit no longer matches the remote branch; no remote write was attempted.",
  duplicateReview: "An open review already exists for this branch pair; no remote write was attempted.",
  reviewNotOpen: "The review is not open; no remote comment was attempted.",
  staleReviewHead: "The expected review head commit no longer matches; no remote comment was attempted.",
  secretFloor: "The outbound review text matched the finite secret floor; no remote write was attempted.",
  internalError: "The repository operation could not complete safely.",
} as const;

export class Rejection extends Error {
  constructor(
    readonly code: FailureCode,
    readonly safeMessage: string,
    readonly retryableOverride?: boolean,
  ) {
    super("Repository operation rejected.");
    this.name = "Rejection";
  }
}

export function reject(code: FailureCode, safeMessage: string, retryableOverride?: boolean): never {
  throw new Rejection(code, safeMessage, retryableOverride);
}

const invalid = (): never => reject("INVALID_INPUT", SAFE_MESSAGES.invalidInput);

// --- bounded primitives ---------------------------------------------------

export const REPOSITORY_ID_RE = /^[a-z0-9][a-z0-9._-]{0,159}$/;
export const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/;
export const REPOSITORY_RE = /^[A-Za-z0-9._-]{1,100}$/;
export const CREDENTIAL_REF_RE = /^[A-Za-z0-9._:/-]{1,256}$/;
export const ENVELOPE_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
export const SHA_RE = /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/;
export const BRANCH_RE = /^[A-Za-z0-9._/-]+$/;

/**
 * The finite outbound secret floor (contract §8). This is deliberately
 * INCOMPLETE and is not, and must not be described as, complete DLP.
 */
export const STATIC_SECRET_MARKERS = [
  "-----BEGIN PRIVATE KEY-----",
  "-----BEGIN RSA PRIVATE KEY-----",
  "-----BEGIN OPENSSH PRIVATE KEY-----",
] as const;

export const BEARER_RE = /\bBearer[ \t]+[A-Za-z0-9._~+/-]{16,}={0,2}/i;

export function matchesSecretFloor(value: string): boolean {
  for (const marker of STATIC_SECRET_MARKERS) if (value.includes(marker)) return true;
  return BEARER_RE.test(value);
}

export const utf8Bytes = (value: string): number => Buffer.byteLength(value, "utf-8");

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

/** C0 controls + DEL, with an explicit allowance set. */
export function hasControls(value: string, allow: readonly number[] = []): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (allow.includes(code)) continue;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Plain data object with no accessors, no exotic prototype (S14F-HI-010). */
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

export function toSafeError(value: string): string {
  const ascii = value.replace(/[^\x20-\x7E]/g, "?");
  return ascii.length > LIMITS.safeErrorAsciiChars ? ascii.slice(0, LIMITS.safeErrorAsciiChars) : ascii;
}

// --- trusted configuration (contract §4) ----------------------------------

const CONFIG_KEYS = [
  "repository_id",
  "owner",
  "repository",
  "credential_ref",
  "enabled_capabilities",
  "max_timeout_ms",
] as const;

export function validateConfig(raw: unknown): GitHubRestProviderConfig {
  const bad = (): never => {
    throw new Error(SAFE_MESSAGES.invalidConfig);
  };
  if (!plainObject(raw)) return bad();
  for (const key of Object.keys(raw)) if (!CONFIG_KEYS.includes(key as (typeof CONFIG_KEYS)[number])) return bad();

  const { repository_id, owner, repository, credential_ref, enabled_capabilities, max_timeout_ms } = raw;

  if (typeof repository_id !== "string" || !REPOSITORY_ID_RE.test(repository_id)) return bad();
  if (typeof owner !== "string" || owner.length > LIMITS.ownerChars || !OWNER_RE.test(owner)) return bad();
  if (typeof repository !== "string" || !REPOSITORY_RE.test(repository) || repository === "." || repository === "..") return bad();
  if (typeof credential_ref !== "string" || !CREDENTIAL_REF_RE.test(credential_ref)) return bad();
  if (
    typeof max_timeout_ms !== "number" ||
    !Number.isInteger(max_timeout_ms) ||
    max_timeout_ms < 1 ||
    max_timeout_ms > LIMITS.configTimeoutMs
  ) {
    return bad();
  }
  if (!Array.isArray(enabled_capabilities) || enabled_capabilities.length < 1 || enabled_capabilities.length > GITHUB_CAPABILITY_IDS.length) {
    return bad();
  }
  const enabled: GitHubCapabilityId[] = [];
  for (const candidate of enabled_capabilities) {
    if (typeof candidate !== "string" || !GITHUB_CAPABILITY_IDS.includes(candidate as GitHubCapabilityId)) return bad();
    if (enabled.includes(candidate as GitHubCapabilityId)) return bad();
    enabled.push(candidate as GitHubCapabilityId);
  }

  return {
    repository_id,
    owner,
    repository,
    credential_ref,
    // Advertisement order is canonical, never caller-controlled.
    enabled_capabilities: GITHUB_CAPABILITY_IDS.filter((id) => enabled.includes(id)),
    max_timeout_ms,
  };
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
  if (typeof request.turn !== "number" || !Number.isInteger(request.turn) || request.turn < 0 || request.turn > LIMITS.reviewNumberMax) invalid();
  if (
    typeof request.timeout_ms !== "number" ||
    !Number.isInteger(request.timeout_ms) ||
    request.timeout_ms < 1 ||
    request.timeout_ms > LIMITS.reviewNumberMax
  ) {
    invalid();
  }
  if (!plainObject(request.input)) invalid();
}

function closedInput(input: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(input)) if (!allowed.includes(key)) invalid();
}

export function validateReviewNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > LIMITS.reviewNumberMax) invalid();
  return value as number;
}

export function validateSha(value: unknown): string {
  if (typeof value !== "string" || !SHA_RE.test(value)) invalid();
  return value as string;
}

export function validateBranch(value: unknown): string {
  if (typeof value !== "string") invalid();
  const branch = value as string;
  const bytes = utf8Bytes(branch);
  if (bytes < 1 || bytes > LIMITS.branchBytes) invalid();
  if (!BRANCH_RE.test(branch)) invalid();
  if (branch.startsWith("/") || branch.endsWith("/")) invalid();
  if (branch.startsWith(".") || branch.endsWith(".")) invalid();
  if (branch.startsWith("-")) invalid();
  if (branch.includes("//") || branch.includes("..") || branch.includes("@{") || branch.includes("\\")) invalid();
  if (hasControls(branch) || branch.includes(" ")) invalid();
  return branch;
}

export function validateTitle(value: unknown): string {
  if (typeof value !== "string") invalid();
  const title = value as string;
  const bytes = utf8Bytes(title);
  if (bytes < 1 || bytes > LIMITS.titleBytes) invalid();
  if (hasLoneSurrogate(title)) invalid();
  if (hasControls(title)) invalid();
  if (!/[^\s]/u.test(title)) invalid();
  return title;
}

export function validateBody(value: unknown): string {
  if (typeof value !== "string") invalid();
  const body = value as string;
  const bytes = utf8Bytes(body);
  if (bytes < 1 || bytes > LIMITS.bodyBytes) invalid();
  if (hasLoneSurrogate(body)) invalid();
  // TAB / LF / CR are the only permitted C0 code points in review prose.
  if (hasControls(body, [0x09, 0x0a, 0x0d])) invalid();
  return body;
}

/** Blocks a write BEFORE any mutation attempt (contract §8). */
export function assertSecretFloor(...texts: string[]): void {
  for (const text of texts) {
    if (matchesSecretFloor(text)) reject("EXECUTION_FAILED", SAFE_MESSAGES.secretFloor);
  }
}

// --- per-capability closed inputs (contract §9-§13) -----------------------

export function validateEmptyInput(input: Record<string, unknown>): void {
  closedInput(input, []);
}

export function validateReviewInspectInput(input: Record<string, unknown>): { review_number: number } {
  closedInput(input, ["review_number"]);
  return { review_number: validateReviewNumber(input.review_number) };
}

export function validateChecksInput(input: Record<string, unknown>): { commit_sha: string } {
  closedInput(input, ["commit_sha"]);
  return { commit_sha: validateSha(input.commit_sha) };
}

export function validateOpenReviewInput(input: Record<string, unknown>): OpenRepositoryReviewInput {
  closedInput(input, ["head_branch", "base_branch", "expected_head_sha", "expected_base_sha", "title", "body", "draft"]);
  const head_branch = validateBranch(input.head_branch);
  const base_branch = validateBranch(input.base_branch);
  if (head_branch === base_branch) invalid();
  const expected_head_sha = validateSha(input.expected_head_sha);
  const expected_base_sha = validateSha(input.expected_base_sha);
  const title = validateTitle(input.title);
  if (input.draft !== undefined && typeof input.draft !== "boolean") invalid();
  const result: OpenRepositoryReviewInput = {
    head_branch,
    base_branch,
    expected_head_sha,
    expected_base_sha,
    title,
    draft: input.draft === true,
  };
  if (input.body !== undefined) result.body = validateBody(input.body);
  assertSecretFloor(title, result.body ?? "");
  return result;
}

export function validateCommentInput(input: Record<string, unknown>): CommentRepositoryReviewInput {
  closedInput(input, ["review_number", "expected_head_sha", "body"]);
  const result: CommentRepositoryReviewInput = {
    review_number: validateReviewNumber(input.review_number),
    expected_head_sha: validateSha(input.expected_head_sha),
    body: validateBody(input.body),
  };
  assertSecretFloor(result.body);
  return result;
}

/** A resolved credential must be a bounded single-line ASCII header value. */
export function validateCredential(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > LIMITS.credentialChars) {
    reject("PERMISSION_DENIED", SAFE_MESSAGES.credentialUnavailable);
  }
  const credential = value as string;
  if (!/^[\x21-\x7e]+$/.test(credential)) reject("PERMISSION_DENIED", SAFE_MESSAGES.credentialUnavailable);
  return credential;
}
