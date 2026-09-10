/**
 * S14F — GitHub Capability: deterministic remote-response normalization
 * (contract §9-§13, §18, §23).
 *
 * Remote strings are INERT DATA. Nothing here branches on remote prose, and no
 * raw remote payload, header or error body crosses the provider boundary: every
 * field is re-typed, re-bounded and rebuilt into a provider-neutral object.
 */

import {
  LIMITS,
  type CheckConclusion,
  type CheckStatus,
  type RemoteRepositoryObservation,
  type RepositoryCheckObservation,
  type RepositoryChecksObservation,
  type RepositoryReviewCommentReceipt,
  type RepositoryReviewObservation,
  type ReviewState,
} from "./types.js";
import {
  BRANCH_RE,
  SAFE_MESSAGES,
  SHA_RE,
  hasControls,
  hasLoneSurrogate,
  plainObject,
  reject,
  utf8Bytes,
} from "./validation.js";

export interface RepositoryBinding {
  repository_id: string;
  owner: string;
  repository: string;
}

const malformed = (): never => reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);

export function parseRemoteObject(body: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return malformed();
  }
  if (!plainObject(parsed)) return malformed();
  return parsed;
}

export function parseRemoteArray(body: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    return malformed();
  }
  if (!Array.isArray(parsed)) return malformed();
  return parsed;
}

function remoteText(value: unknown, maxBytes: number, allowEmpty = false): string {
  if (typeof value !== "string") return malformed();
  const bytes = utf8Bytes(value);
  if (bytes > maxBytes || (!allowEmpty && bytes < 1)) return malformed();
  if (hasLoneSurrogate(value) || hasControls(value, [0x09, 0x0a, 0x0d])) return malformed();
  return value;
}

/** Single-line remote label (title, branch, check name): no C0 at all. */
function remoteLabel(value: unknown, maxBytes: number): string {
  const text = remoteText(value, maxBytes);
  if (hasControls(text)) return malformed();
  return text;
}

function remoteBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") return malformed();
  return value;
}

function remoteInteger(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return malformed();
  return value;
}

function remoteSha(value: unknown): string {
  if (typeof value !== "string" || !SHA_RE.test(value)) return malformed();
  return value.toLowerCase();
}

function remoteBranch(value: unknown): string {
  if (typeof value !== "string") return malformed();
  const bytes = utf8Bytes(value);
  if (bytes < 1 || bytes > LIMITS.branchBytes || !BRANCH_RE.test(value)) return malformed();
  return value;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** Remote timestamps are re-emitted as canonical UTC ISO-8601 `Z` strings. */
export function remoteTimestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 32 || !ISO_RE.test(value)) return malformed();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return malformed();
  return parsed.toISOString();
}

export function nowUtc(): string {
  return new Date().toISOString();
}

const WEB_URL_TAIL_RE = /^[A-Za-z0-9._~/#?=&%:@!$'()*+,;-]*$/;

/**
 * `web_url` must be an `https://github.com/{owner}/{repository}` URL for the one
 * bound repository. A foreign origin, owner or repository fails closed; no
 * remote-chosen URL is ever surfaced unvalidated (contract §9, §12, §13).
 */
export function validateWebUrl(value: unknown, binding: RepositoryBinding): string {
  if (typeof value !== "string" || value.length < 1 || value.length > LIMITS.webUrlChars) return malformed();
  const prefix = `https://github.com/${binding.owner}/${binding.repository}`;
  if (!value.toLowerCase().startsWith(prefix.toLowerCase())) return malformed();
  const tail = value.slice(prefix.length);
  if (tail !== "" && !tail.startsWith("/") && !tail.startsWith("#")) return malformed();
  if (!WEB_URL_TAIL_RE.test(tail)) return malformed();
  return value;
}

// --- repository.remote.inspect --------------------------------------------

export function normalizeRepository(payload: Record<string, unknown>, binding: RepositoryBinding): RemoteRepositoryObservation {
  return {
    repository_id: binding.repository_id,
    default_branch: remoteBranch(payload.default_branch),
    is_private: remoteBoolean(payload.private),
    archived: remoteBoolean(payload.archived),
    web_url: validateWebUrl(payload.html_url, binding),
    observed_at: nowUtc(),
  };
}

// --- repository.review.* --------------------------------------------------

export function reviewState(payload: Record<string, unknown>): ReviewState {
  const merged = payload.merged_at !== null && payload.merged_at !== undefined ? true : payload.merged === true;
  if (typeof payload.state !== "string") return malformed();
  if (payload.state === "open") {
    if (merged) return malformed();
    return "OPEN";
  }
  if (payload.state !== "closed") return malformed();
  return merged ? "MERGED" : "CLOSED";
}

function reviewRef(value: unknown): { branch: string; sha: string } {
  if (!plainObject(value)) return malformed();
  return { branch: remoteBranch(value.ref), sha: remoteSha(value.sha) };
}

export function normalizeReview(payload: Record<string, unknown>, binding: RepositoryBinding): RepositoryReviewObservation {
  const head = reviewRef(payload.head);
  const base = reviewRef(payload.base);
  return {
    repository_id: binding.repository_id,
    review_number: remoteInteger(payload.number, 1, LIMITS.reviewNumberMax),
    state: reviewState(payload),
    draft: remoteBoolean(payload.draft),
    title: remoteLabel(payload.title, LIMITS.remoteTitleBytes),
    head_branch: head.branch,
    head_sha: head.sha,
    base_branch: base.branch,
    base_sha: base.sha,
    changed_files: remoteInteger(payload.changed_files, 0, LIMITS.reviewNumberMax),
    comments_count: remoteInteger(payload.comments, 0, LIMITS.reviewNumberMax),
    web_url: validateWebUrl(payload.html_url, binding),
    observed_at: nowUtc(),
  };
}

export function normalizeCommentReceipt(
  payload: Record<string, unknown>,
  binding: RepositoryBinding,
  review_number: number,
): RepositoryReviewCommentReceipt {
  const id = payload.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) return malformed();
  return {
    repository_id: binding.repository_id,
    review_number,
    comment_id: String(id),
    web_url: validateWebUrl(payload.html_url, binding),
    created_at: remoteTimestamp(payload.created_at),
  };
}

// --- repository.checks.inspect --------------------------------------------

const CHECK_STATUS: Readonly<Record<string, CheckStatus>> = {
  queued: "QUEUED",
  in_progress: "IN_PROGRESS",
  completed: "COMPLETED",
};

const CHECK_CONCLUSION: Readonly<Record<string, CheckConclusion>> = {
  success: "SUCCESS",
  failure: "FAILURE",
  neutral: "NEUTRAL",
  cancelled: "CANCELLED",
  skipped: "SKIPPED",
  timed_out: "TIMED_OUT",
  action_required: "ACTION_REQUIRED",
  stale: "STALE",
};

function normalizeCheckRun(value: unknown, binding: RepositoryBinding): RepositoryCheckObservation {
  if (!plainObject(value)) return malformed();
  const id = value.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1) return malformed();
  const status = typeof value.status === "string" ? CHECK_STATUS[value.status] : undefined;
  if (status === undefined) return malformed();

  const check: RepositoryCheckObservation = {
    id: String(id),
    name: remoteLabel(value.name, LIMITS.remoteNameBytes),
    status,
  };

  if (value.conclusion !== null && value.conclusion !== undefined) {
    if (typeof value.conclusion !== "string" || utf8Bytes(value.conclusion) > 64) return malformed();
    // An unrecognized remote conclusion is reported as UNKNOWN, never echoed.
    check.conclusion = CHECK_CONCLUSION[value.conclusion] ?? "UNKNOWN";
  }
  if (value.html_url !== null && value.html_url !== undefined) {
    check.web_url = validateWebUrl(value.html_url, binding);
  }
  if (value.started_at !== null && value.started_at !== undefined) {
    check.started_at = remoteTimestamp(value.started_at);
  }
  if (value.completed_at !== null && value.completed_at !== undefined) {
    check.completed_at = remoteTimestamp(value.completed_at);
  }
  return check;
}

/** ASCII name, then string id: one total order for identical remote payloads. */
function compareChecks(a: RepositoryCheckObservation, b: RepositoryCheckObservation): number {
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function normalizeChecks(
  payload: Record<string, unknown>,
  binding: RepositoryBinding,
  commit_sha: string,
): RepositoryChecksObservation {
  const runs = payload.check_runs;
  if (!Array.isArray(runs) || runs.length > LIMITS.rawCheckRuns) return malformed();
  const total = remoteInteger(payload.total_count, 0, LIMITS.reviewNumberMax);

  const normalized = runs.map((run) => normalizeCheckRun(run, binding)).sort(compareChecks);
  const checks = normalized.slice(0, LIMITS.checks);
  if (total < checks.length) return malformed();

  return {
    repository_id: binding.repository_id,
    commit_sha: commit_sha.toLowerCase(),
    total_checks: total,
    truncated: total > checks.length,
    checks,
    observed_at: nowUtc(),
  };
}
