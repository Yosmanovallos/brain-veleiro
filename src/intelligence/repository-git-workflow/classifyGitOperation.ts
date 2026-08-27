import { DESTRUCTIVE_OPERATION_IDS } from "./constants.js";
import type { GitOperationClass } from "./types.js";

/**
 * Brain — S13H Git operation classification (contract §6; Skill "Operation
 * classes"). Works on normalized operation identifiers, NOT shell command
 * strings. A DESTRUCTIVE_OR_HISTORY_REWRITE operation may never appear in a
 * READY decision's `safe_operations` (HI-008).
 */

const READ_ONLY_OPS = new Set([
  "STATUS",
  "DIFF",
  "DIFF_STAGED",
  "LOG",
  "SHOW",
  "REV_PARSE",
  "BRANCH_SHOW_CURRENT",
  "WORKTREE_LIST",
  "REMOTE_LIST",
  "FETCH",
]);

const NON_DESTRUCTIVE_WRITE_OPS = new Set([
  "CREATE_BRANCH",
  "CREATE_WORKTREE",
  "STAGE_INTENDED_PATHS",
  "COMMIT_ATOMIC",
]);

const REMOTE_NON_DESTRUCTIVE_WRITE_OPS = new Set([
  "PUSH_NORMAL",
  "REMOTE_REVIEW_CREATE",
]);

const DESTRUCTIVE_SET = new Set(DESTRUCTIVE_OPERATION_IDS);

/**
 * Also recognise a handful of raw shell-ish spellings a caller might pass, so
 * the classifier is robust to `git reset --hard` as well as `RESET_HARD`.
 */
const RAW_DESTRUCTIVE_PATTERNS: RegExp[] = [
  /reset\s+--hard/i,
  /\bclean\s+-[a-z]*f[a-z]*d/i,
  /\brestore\s+\./i,
  /checkout\s+--\s+\./i,
  /branch\s+-D\b/i,
  /push\s+--force(?!-with-lease)/i,
  /push\s+--force-with-lease/i,
  /\brebase\b/i,
  /commit\s+--amend/i,
  /filter-branch|filter-repo/i,
  /\bstash\b/i,
];

export function classifyGitOperation(operation: string): GitOperationClass {
  const op = operation.trim();
  const upper = op.toUpperCase().replace(/[\s-]+/g, "_");

  if (DESTRUCTIVE_SET.has(upper) || RAW_DESTRUCTIVE_PATTERNS.some((re) => re.test(op))) {
    return "DESTRUCTIVE_OR_HISTORY_REWRITE";
  }
  if (REMOTE_NON_DESTRUCTIVE_WRITE_OPS.has(upper)) return "REMOTE_NON_DESTRUCTIVE_WRITE";
  if (NON_DESTRUCTIVE_WRITE_OPS.has(upper)) return "NON_DESTRUCTIVE_WRITE";
  if (READ_ONLY_OPS.has(upper)) return "READ_ONLY";

  // Unknown operation strings are treated conservatively as writes needing
  // authorization, never as READ_ONLY.
  return "NON_DESTRUCTIVE_WRITE";
}

export function isDestructiveOperation(operation: string): boolean {
  return classifyGitOperation(operation) === "DESTRUCTIVE_OR_HISTORY_REWRITE";
}
