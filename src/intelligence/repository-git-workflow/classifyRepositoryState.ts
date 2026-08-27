import type { RepositoryGitWorkflowInput, RepositoryStateSnapshot } from "./types.js";
import { pathMatchesAny } from "./sharedNormalization.js";

/**
 * Brain — S13H repository-state classification (contract §5.1, §7, §16;
 * Skill R1/R2/R5/R14).
 *
 * Reads the caller-supplied immutable snapshot and reports structural safety
 * facts. It never mutates the snapshot and never runs Git.
 */

export interface RepositoryStateClassification {
  detached_head: boolean;
  diverged: boolean;
  behind_only: boolean;
  ahead_only: boolean;
  /** Tracked (modified/staged/deleted) paths not owned by the change intent. */
  unrelated_tracked_paths: string[];
  /** Staged paths not owned by the change intent. */
  unrelated_staged_paths: string[];
  findings: string[];
  /** Hard-safety blockers derived purely from repository state. */
  blockers: string[];
}

function isOwnedByIntent(path: string, input: RepositoryGitWorkflowInput): boolean {
  const ci = input.change_intent;
  return (
    pathMatchesAny(path, ci.intended_paths) ||
    pathMatchesAny(path, ci.allowed_supporting_paths)
  );
}

export function classifyRepositoryState(
  input: RepositoryGitWorkflowInput,
): RepositoryStateClassification {
  const snap: RepositoryStateSnapshot = input.repository;
  const findings: string[] = [];
  const blockers: string[] = [];

  const detached_head = snap.detached_head === true || snap.branch === null;
  if (detached_head) {
    blockers.push("Detached HEAD: normal implementation commit workflow is not available (contract §5.1).");
  }

  const ahead = Number.isFinite(snap.ahead) ? snap.ahead : 0;
  const behind = Number.isFinite(snap.behind) ? snap.behind : 0;
  const diverged = ahead > 0 && behind > 0;
  const behind_only = ahead === 0 && behind > 0;
  const ahead_only = ahead > 0 && behind === 0;

  if (diverged) {
    blockers.push(
      `Branch has diverged from ${snap.upstream_ref ?? "upstream"} (ahead ${ahead}, behind ${behind}); ` +
        "commit/push planning is BLOCKED until the caller chooses a non-destructive reconciliation (contract §N).",
    );
  } else if (behind_only) {
    findings.push(
      `Branch is behind ${snap.upstream_ref ?? "upstream"} by ${behind}; a normal commit/push may be BLOCKED ` +
        "until the caller refreshes safely per repository policy. S13H does not prescribe rebase/reset.",
    );
  }

  const unrelated_tracked_paths: string[] = [];
  const unrelated_staged_paths: string[] = [];
  for (const p of snap.paths) {
    const changed = p.tracked && (p.modified || p.staged || p.deleted);
    if (!changed) continue;
    if (p.ignored) continue; // ignored/generated files are handled by their own gate
    if (isOwnedByIntent(p.path, input)) continue;
    unrelated_tracked_paths.push(p.path);
    if (p.staged) unrelated_staged_paths.push(p.path);
  }

  for (const p of snap.paths) {
    if (p.ignored && (p.staged || p.modified)) {
      blockers.push(
        `Ignored / generated file '${p.path}' is proposed for commit and repository policy does not declare it a tracked artifact (contract §I) — BLOCKED.`,
      );
    }
  }

  if (unrelated_tracked_paths.length > 0) {
    blockers.push(
      `Unrelated tracked change(s) present and not owned by change_intent: ${unrelated_tracked_paths.join(", ")}. ` +
        "S13H does not stash, restore, reset, clean or stage around them (Skill R5).",
    );
  }
  if (unrelated_staged_paths.length > 0) {
    blockers.push(
      `Unrelated staged path(s) present: ${unrelated_staged_paths.join(", ")}. A commit here would not be atomic (contract §7).`,
    );
  }

  if (!snap.repository_id || snap.repository_id.trim().length === 0) {
    blockers.push("Repository snapshot has no repository_id (contract §2).");
  }
  if (!snap.head || snap.head.trim().length === 0) {
    blockers.push("Repository snapshot has no HEAD (contract §2).");
  }

  return {
    detached_head,
    diverged,
    behind_only,
    ahead_only,
    unrelated_tracked_paths,
    unrelated_staged_paths,
    findings,
    blockers,
  };
}
