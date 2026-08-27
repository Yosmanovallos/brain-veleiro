import type {
  RepositoryGitWorkflowInput,
  RepositoryRequestedAction,
  WorkspaceDecision,
} from "./types.js";
import { pathMatchesAny } from "./sharedNormalization.js";

/**
 * Brain — S13H workspace-strategy decision (contract §5; Skill "Workspace
 * strategy", R3/R4; HI-009/HI-010).
 *
 * Decision policy (contract §5, Part A §E), evaluated in order:
 *   1 ISOLATED_WORKTREE  — explicit isolation need / concurrent builders
 *   2 FEATURE_BRANCH     — direct current-branch work not explicitly allowed (canonical default)
 *   3 KEEP_CURRENT       — only when every precondition holds
 *   4 BLOCKED            — no safe strategy
 *
 * A detached HEAD blocks before any of the above. GitHub branch-protection is
 * NEVER inferred from an API — only `policy.protected_branch_patterns`.
 */

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Deterministic mechanical derivation (contract §5.5) — the Skill does not create it. */
export function derivedFeatureBranchName(input: RepositoryGitWorkflowInput): string {
  return `work/${slug(input.change_intent.task_ref || "task")}`;
}

export function derivedWorktreePath(input: RepositoryGitWorkflowInput): string {
  return `../.worktrees/${slug(input.change_intent.task_ref || "task")}`;
}

function branchIsProtected(branch: string | null, patterns: string[]): boolean {
  if (!branch) return false;
  return patterns.some((p) => branch === p || pathMatchesAny(branch, [p]));
}

/** Write authorization required for the requested next action, if any. */
function writeAuthorizationPresent(
  action: RepositoryRequestedAction | undefined,
  input: RepositoryGitWorkflowInput,
): boolean {
  const pol = input.policy;
  switch (action) {
    case "CREATE_BRANCH":
      return pol.branch_write_authorized === true;
    case "CREATE_WORKTREE":
      return pol.worktree_write_authorized === true;
    case "STAGE":
    case "COMMIT":
      return pol.commit_authorized === true;
    case "PUSH":
      return pol.push_authorized === true;
    case "REMOTE_REVIEW":
      return pol.remote_review_write_authorized === true;
    default:
      return true; // CONTINUE_IMPLEMENTATION / undefined need no write authz
  }
}

export interface WorkspaceStrategyOutcome {
  decision: WorkspaceDecision;
  blockers: string[];
}

export function decideWorkspaceStrategy(
  input: RepositoryGitWorkflowInput,
  opts: { hasUnrelatedTrackedChanges: boolean; diverged: boolean; detachedHead: boolean },
): WorkspaceStrategyOutcome {
  const pol = input.policy;
  const snap = input.repository;
  const blockers: string[] = [];

  if (opts.detachedHead) {
    return {
      decision: { strategy: "BLOCKED", reason: "Detached HEAD — no safe implementation workspace strategy (contract §5.1)." },
      blockers: [],
    };
  }

  const concurrency = Number.isFinite(pol.concurrent_builder_count) ? pol.concurrent_builder_count : 1;
  const worktreeRequired = concurrency > 1 && pol.require_worktree_for_concurrent_builders === true;

  // 1 — ISOLATED_WORKTREE
  if (worktreeRequired) {
    if (pol.worktree_allowed !== true) {
      return {
        decision: {
          strategy: "BLOCKED",
          reason: "Concurrent builders require worktree isolation but policy.worktree_allowed is false (contract §5.2).",
        },
        blockers: [],
      };
    }
    return {
      decision: {
        strategy: "ISOLATED_WORKTREE",
        worktree_path: derivedWorktreePath(input),
        branch_name: derivedFeatureBranchName(input),
        reason: `${concurrency} concurrent builders and require_worktree_for_concurrent_builders — isolated worktree required.`,
      },
      blockers,
    };
  }

  const branchProtected = branchIsProtected(snap.branch, pol.protected_branch_patterns);
  const protectedDirectAllowed = branchProtected && pol.direct_protected_branch_writes_allowed === true;

  // 2 — FEATURE_BRANCH (canonical default)
  const directAllowed =
    pol.direct_current_branch_allowed === true && (!branchProtected || protectedDirectAllowed);

  if (!directAllowed) {
    if (pol.feature_branch_allowed !== true) {
      return {
        decision: {
          strategy: "BLOCKED",
          reason: branchProtected
            ? "Current branch is protected, direct writes are not allowed, and feature_branch_allowed is false (contract §5.4)."
            : "Direct current-branch work is not explicitly allowed and feature_branch_allowed is false (contract §5.4).",
        },
        blockers: [],
      };
    }
    return {
      decision: {
        strategy: "FEATURE_BRANCH",
        branch_name: derivedFeatureBranchName(input),
        reason: branchProtected
          ? "Current branch is protected; source implementation work defaults to a feature branch (contract §F)."
          : "Direct current-branch work is not explicitly allowed; feature branch is the canonical default (contract §5.4).",
      },
      blockers,
    };
  }

  // 3 — KEEP_CURRENT preconditions
  const failed: string[] = [];
  if (opts.hasUnrelatedTrackedChanges) failed.push("unrelated tracked/staged changes exist");
  if (opts.diverged) failed.push("branch has unsafe unresolved divergence");
  if (concurrency > 1) failed.push("more than one builder owns the working tree");
  const nextAction = input.requested_actions.find((a) => a !== "CONTINUE_IMPLEMENTATION");
  if (!writeAuthorizationPresent(nextAction, input)) {
    // Not a KEEP_CURRENT failure per se — authorization is handled downstream as
    // APPROVAL_REQUIRED — so KEEP_CURRENT may still be selected here.
  }

  if (failed.length > 0) {
    return {
      decision: {
        strategy: "BLOCKED",
        reason: `KEEP_CURRENT preconditions not met: ${failed.join("; ")} (contract §5.3).`,
      },
      blockers: [],
    };
  }

  return {
    decision: {
      strategy: "KEEP_CURRENT",
      branch_name: snap.branch ?? undefined,
      reason: "Repository policy explicitly allows direct work on the current branch and state is safe (contract §5.3).",
    },
    blockers,
  };
}
