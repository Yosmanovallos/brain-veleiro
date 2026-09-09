// S14D — Git Capability: pure parsers and grammar validators.
//
// All functions here are deterministic and side-effect free. They convert fixed
// Git plumbing output into the structured public contract (they never let raw
// porcelain / raw ls-tree text become the model-visible result) and enforce the
// bounded revision / logical-path grammar before any value reaches Git.

import type { RepositoryStatusPath } from "./types.js";

export const LIMITS = {
  repositoryIdChars: 160,
  repositoryRootChars: 4096,
  gitExecutablePathChars: 4096,
  revisionChars: 64,
  pathChars: 4096,
  pathSegments: 256,
  pathSegmentUtf8Bytes: 255,
  statusPaths: 1000,
  blobBytes: 1048576,
  stdoutBytes: 1048576,
  stderrBytes: 65536,
  combinedOutputBytes: 1114112,
  repositoryTimeoutMs: 300000,
  terminationGraceMs: 500,
  groupCleanupBudgetMs: 4000,
  evidenceRefs: 4,
  safeErrorChars: 500,
} as const;

export const REPOSITORY_ID = /^[a-z0-9][a-z0-9._-]*$/;
const FULL_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

export const wellFormed = (value: string): boolean => !/[\uD800-\uDFFF]/u.test(value);

/**
 * Model revision grammar (contract §17, skill §2.6). Only `HEAD` or one full
 * 40/64-hex object id. Every Git revision mini-language form — short SHA,
 * branch/tag name, leading `-`, whitespace/control, NUL, `@{`, `}`, `:`, `^`,
 * `~`, `..`, `...`, ranges, reflog, index-stage syntax — is rejected here,
 * before the value is ever handed to Git.
 *
 * Returns the canonical revision string on success, or `null` on any violation.
 */
export function validateRevision(raw: unknown): string | null {
  if (raw === undefined) return "HEAD";
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > LIMITS.revisionChars) return null;
  if (raw === "HEAD") return "HEAD";
  if (FULL_OID.test(raw)) return raw.toLowerCase();
  return null;
}

export const isFullOid = (value: string): boolean => FULL_OID.test(value);

/**
 * Bounded logical repository-relative path grammar (contract §18, skill §5;
 * aligned with the S14B / S13H discipline). Rejects empty / oversized paths,
 * too many segments, oversized segments, NUL, lone surrogate, leading `/`,
 * Windows drive, UNC / backslash, empty internal segment, `.`, `..`, a
 * leading `-` and a leading `:` (Git pathspec magic). `GIT_LITERAL_PATHSPECS=1`
 * plus a provider-owned `--` mean the returned path is never a pathspec program.
 *
 * Returns the segment list on success, or `null` on any violation.
 */
export function validateLogicalPath(raw: unknown): string[] | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > LIMITS.pathChars) return null;
  if (!wellFormed(raw)) return null;
  if (raw.includes("\0") || raw.includes("\\")) return null;
  if (raw.startsWith("/")) return null;
  if (/^[A-Za-z]:/.test(raw)) return null;
  const parts = raw.split("/");
  if (parts.length > LIMITS.pathSegments) return null;
  for (const p of parts) {
    if (p.length === 0) return null;
    if (p === "." || p === "..") return null;
    if (Buffer.byteLength(p, "utf8") > LIMITS.pathSegmentUtf8Bytes) return null;
  }
  if (parts[0].startsWith("-") || parts[0].startsWith(":")) return null;
  return parts;
}

const PROTECTED_EXACT = new Set([
  ".git", ".ssh", ".gnupg", ".aws", ".azure", ".kube",
  ".npmrc", ".pypirc", ".netrc",
  "id_rsa", "id_ed25519",
]);
const PROTECTED_SUFFIX = [".pem", ".key", ".p12", ".pfx"];

/**
 * Structural protected-content floor for `repository.read` (contract §19,
 * skill §5, §40). Segment-aware and case-insensitive. `.env` and `.env.*` are
 * blocked with the single explicit `.env.example` exception. This structural
 * floor is primary; `sensitive()` content recognition is only a backstop and is
 * never described as complete secret detection.
 */
export function isProtectedContentPath(parts: string[]): boolean {
  return parts.some((segment) => {
    const n = segment.toLowerCase();
    if (PROTECTED_EXACT.has(n)) return true;
    if (n === ".env") return true;
    if (n.startsWith(".env.") && n !== ".env.example") return true;
    if (n.startsWith("credentials.")) return true;
    if (PROTECTED_SUFFIX.some((suffix) => n.endsWith(suffix))) return true;
    return false;
  });
}

/** Parsed `git version` triple. Vendor suffixes after a valid triple are ignored. */
export function parseGitVersion(stdout: string): { major: number; minor: number; patch: number } | null {
  const m = /^git version (\d+)\.(\d+)\.(\d+)/.exec(stdout.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** `2.45.0 <= version < 3.0.0` (contract §9). */
export function isSupportedGitVersion(v: { major: number; minor: number; patch: number }): boolean {
  if (!Number.isInteger(v.major) || !Number.isInteger(v.minor) || !Number.isInteger(v.patch)) return false;
  if (v.major !== 2) return false; // major 0/1 below floor, major 3+ at/above the exclusive ceiling
  if (v.minor > 45) return true;
  if (v.minor < 45) return false;
  return v.patch >= 0;
}

export interface ParsedStatus {
  branch: string | null;
  detached_head: boolean;
  head: string;
  upstream_ref?: string;
  ahead: number;
  behind: number;
  paths: RepositoryStatusPath[];
}

export type StatusParseResult =
  | { ok: true; value: ParsedStatus }
  | { ok: false; reason: "MALFORMED" | "TOO_MANY_PATHS" };

function boundedStatusPath(path: string): boolean {
  return validateLogicalPath(path) !== null;
}

/**
 * Parse `git status --porcelain=v2 --branch -z` output into the structured
 * public observation. NUL-record aware: a `2 ` (rename / copy) record consumes
 * the following NUL-separated field as its original path, so records are walked
 * with an explicit cursor rather than a naive split-and-iterate.
 */
export function parseStatusPorcelainV2(stdout: string): StatusParseResult {
  if (!stdout.endsWith("\0")) return { ok: false, reason: "MALFORMED" };
  const records = stdout.slice(0, -1).split("\0");
  const oid = "(?:[0-9a-f]{40}|[0-9a-f]{64})";
  const ordinaryXy = "[.MTAD]{2}";
  const renamedXy = "[.MADRCT]{2}";
  const sub = "(?:N\\.\\.\\.|S[.C][.M][.U])";
  const mode = "[0-7]{6}";
  const ordinary = new RegExp(`^1 (${ordinaryXy}) ${sub} ${mode} ${mode} ${mode} ${oid} ${oid} ([\\s\\S]+)$`);
  const renamed = new RegExp(`^2 (${renamedXy}) ${sub} ${mode} ${mode} ${mode} ${oid} ${oid} ([RC])(?:100|[1-9]?[0-9]) ([\\s\\S]+)$`);
  const unmerged = new RegExp(`^u (DD|AU|UD|UA|DU|AA|UU) ${sub} ${mode} ${mode} ${mode} ${mode} ${oid} ${oid} ${oid} ([\\s\\S]+)$`);
  const validRef = (value: string): boolean => value.length > 0 && value.length <= LIMITS.pathChars &&
    value !== "@" && value !== "(unknown)" && wellFormed(value) && !/[\x00-\x20\x7f~^:?*\[\\]/u.test(value) &&
    !value.startsWith(".") && !value.startsWith("-") && !value.startsWith("/") &&
    !value.endsWith(".") && !value.endsWith("/") && !value.endsWith(".lock") &&
    !value.includes("..") && !value.includes("//") && !value.includes("@{");

  let branch: string | null = null;
  let detached_head = false;
  let head = "";
  let upstream_ref: string | undefined;
  let ahead = 0;
  let behind = 0;
  let sawOid = false;
  let sawHead = false;
  let sawUpstream = false;
  let sawAb = false;
  let headerStage = 0;
  let sawEntry = false;
  const paths: RepositoryStatusPath[] = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.length === 0) return { ok: false, reason: "MALFORMED" };

    if (rec.startsWith("# ")) {
      if (sawEntry) return { ok: false, reason: "MALFORMED" };
      const body = rec.slice(2);
      if (body.startsWith("branch.oid ")) {
        if (sawOid || headerStage !== 0) return { ok: false, reason: "MALFORMED" };
        const value = body.slice("branch.oid ".length);
        if (value !== "(initial)" && !FULL_OID.test(value)) return { ok: false, reason: "MALFORMED" };
        head = value === "(initial)" ? "" : value;
        sawOid = true;
        headerStage = 1;
      } else if (body.startsWith("branch.head ")) {
        if (sawHead || headerStage !== 1) return { ok: false, reason: "MALFORMED" };
        const value = body.slice("branch.head ".length);
        if (value === "(detached)") { branch = null; detached_head = true; }
        else {
          if (!validRef(value)) return { ok: false, reason: "MALFORMED" };
          branch = value;
          detached_head = false;
        }
        sawHead = true;
        headerStage = 2;
      } else if (body.startsWith("branch.upstream ")) {
        if (sawUpstream || headerStage !== 2) return { ok: false, reason: "MALFORMED" };
        const value = body.slice("branch.upstream ".length);
        if (!validRef(value)) return { ok: false, reason: "MALFORMED" };
        upstream_ref = value;
        sawUpstream = true;
        headerStage = 3;
      } else if (body.startsWith("branch.ab ")) {
        if (sawAb || headerStage !== 3) return { ok: false, reason: "MALFORMED" };
        const match = /^\+(\d+) -(\d+)$/.exec(body.slice("branch.ab ".length));
        if (!match) return { ok: false, reason: "MALFORMED" };
        ahead = Number(match[1]);
        behind = Number(match[2]);
        if (!Number.isSafeInteger(ahead) || !Number.isSafeInteger(behind)) return { ok: false, reason: "MALFORMED" };
        sawAb = true;
        headerStage = 4;
      } else return { ok: false, reason: "MALFORMED" };
      continue;
    }

    sawEntry = true;
    const ordinaryMatch = ordinary.exec(rec);
    const renamedMatch = renamed.exec(rec);
    const unmergedMatch = unmerged.exec(rec);
    if (ordinaryMatch) {
      if (ordinaryMatch[1] === ".." || !boundedStatusPath(ordinaryMatch[2])) return { ok: false, reason: "MALFORMED" };
      paths.push(classify(ordinaryMatch[2], ordinaryMatch[1], false));
    } else if (renamedMatch) {
      if (!renamedMatch[1].includes(renamedMatch[2]) || i + 1 >= records.length ||
          !boundedStatusPath(renamedMatch[3]) || !boundedStatusPath(records[i + 1])) {
        return { ok: false, reason: "MALFORMED" };
      }
      i += 1;
      paths.push(classify(renamedMatch[3], renamedMatch[1], false));
    } else if (unmergedMatch) {
      if (!boundedStatusPath(unmergedMatch[2])) return { ok: false, reason: "MALFORMED" };
      paths.push(classify(unmergedMatch[2], unmergedMatch[1], false, true));
    } else if (rec.startsWith("? ")) {
      const path = rec.slice(2);
      if (!boundedStatusPath(path)) return { ok: false, reason: "MALFORMED" };
      paths.push({ path, tracked: false, staged: false, modified: false, deleted: false, untracked: true });
    } else if (rec.startsWith("! ")) {
      if (!boundedStatusPath(rec.slice(2))) return { ok: false, reason: "MALFORMED" };
    } else return { ok: false, reason: "MALFORMED" };

    if (paths.length > LIMITS.statusPaths) return { ok: false, reason: "TOO_MANY_PATHS" };
  }

  if (!sawOid || !sawHead || (sawAb && !sawUpstream) || (head === "" && detached_head) ||
      (detached_head && (branch !== null || sawUpstream)) || (!detached_head && branch === null)) {
    return { ok: false, reason: "MALFORMED" };
  }
  const value: ParsedStatus = { branch, detached_head, head, ahead, behind, paths };
  if (upstream_ref !== undefined) value.upstream_ref = upstream_ref;
  return { ok: true, value };
}

function classify(path: string, xy: string, untracked: boolean, unmerged = false): RepositoryStatusPath {
  const x = xy[0] ?? ".";
  const y = xy[1] ?? ".";
  if (unmerged) {
    return {
      path, tracked: true, staged: false,
      modified: true,
      deleted: x === "D" || y === "D",
      untracked: false,
    };
  }
  return {
    path,
    tracked: !untracked,
    staged: x !== "." && x !== "?",
    modified: x === "M" || y === "M" || x === "T" || y === "T",
    deleted: x === "D" || y === "D",
    untracked,
  };
}

export interface LsTreeEntry {
  mode: string;
  type: "blob" | "tree" | "commit";
  objectId: string;
  size: number | null;
}

export type LsTreeParseResult =
  | { ok: true; value: LsTreeEntry }
  | { ok: false; reason: "NOT_FOUND" | "MALFORMED" | "UNSUPPORTED_MODE" };

/**
 * Parse `git ls-tree -l -z <commit> -- <path>` output. Requires exactly one
 * entry that is a regular blob (`100644` / `100755`). A tree (`040000`), a
 * symlink (`120000`), a gitlink / submodule (`160000`), an unexpected mode,
 * zero entries or more than one entry are all fail-closed (contract §21.3).
 */
export function parseLsTree(stdout: string): LsTreeParseResult {
  const entries = stdout.split("\0").filter((e) => e.length > 0);
  if (entries.length === 0) return { ok: false, reason: "NOT_FOUND" };
  if (entries.length !== 1) return { ok: false, reason: "MALFORMED" };
  const m = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})[ \t]+(\d+|-)\t([\s\S]*)$/.exec(entries[0]);
  if (!m) return { ok: false, reason: "MALFORMED" };
  const mode = m[1];
  const type = m[2] as LsTreeEntry["type"];
  const objectId = m[3];
  const size = m[4] === "-" ? null : Number(m[4]);
  if (mode !== "100644" && mode !== "100755") return { ok: false, reason: "UNSUPPORTED_MODE" };
  if (type !== "blob") return { ok: false, reason: "UNSUPPORTED_MODE" };
  return { ok: true, value: { mode, type, objectId, size } };
}
