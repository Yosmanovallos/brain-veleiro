import { classifyPath } from "./classifyChangedPaths.js";
import { defaultCommitTypeForChangeKind } from "./sharedNormalization.js";
import type { RepositoryCommitPlan, RepositoryGitWorkflowInput } from "./types.js";

/**
 * Brain — S13H commit-plan materialization (contract §11; Skill "Commit plan",
 * R8/R9; HI-015/HI-016).
 *
 * Produces ONE atomic commit plan whose `included_paths` are exactly the
 * INTENDED / ALLOWED_SUPPORTING changed paths — never "commit everything", never
 * a transfer/handoff file, never a sensitive/protected path. Nothing is
 * executed. Returns null when there is no coherent atomic change to plan.
 */

export interface CommitPlanProfile {
  /** Only INTENDED/ALLOWED_SUPPORTING paths are included (faithful). */
  isolatePaths: boolean;
  /** Message uses the repo `<type>: <summary>` convention (faithful). */
  conventionalMessage: boolean;
  /** No unrelated cleanup / no "commit everything" (faithful). */
  atomicOnly: boolean;
}

export const FAITHFUL_COMMIT_PLAN_PROFILE: CommitPlanProfile = {
  isolatePaths: true,
  conventionalMessage: true,
  atomicOnly: true,
};

export const NAIVE_COMMIT_PLAN_PROFILE: CommitPlanProfile = {
  isolatePaths: false,
  conventionalMessage: false,
  atomicOnly: false,
};

function changedPaths(input: RepositoryGitWorkflowInput): string[] {
  return input.repository.paths
    .filter((p) => p.tracked && (p.staged || p.modified || p.deleted))
    .map((p) => p.path);
}

export function buildCommitPlan(
  input: RepositoryGitWorkflowInput,
  profile: CommitPlanProfile,
): RepositoryCommitPlan | null {
  const ci = input.change_intent;
  const all = changedPaths(input);

  let included: string[];
  let excluded: string[];
  if (profile.isolatePaths) {
    included = [];
    excluded = [];
    for (const path of all) {
      const d = classifyPath(path, input, { tracked: true }).disposition;
      if (d === "INTENDED" || d === "ALLOWED_SUPPORTING") included.push(path);
      else excluded.push(path);
    }
  } else {
    // NAIVE: stage everything changed (contract §P "commit everything" — forbidden).
    included = [...all];
    excluded = [];
  }

  if (profile.isolatePaths && included.length === 0) return null;

  const type = profile.conventionalMessage ? defaultCommitTypeForChangeKind(ci.expected_change_kind) : "update";
  const summary = ci.summary.trim() || `apply ${ci.task_ref}`;
  const message = profile.conventionalMessage
    ? `${type}: ${summary}`
    : `${summary} (+ incidental cleanup)`; // NAIVE: bundles unrelated cleanup

  const required_validation_refs = input.validation_requirements
    .filter((r) => r.phase === "BEFORE_COMMIT")
    .map((r) => r.id);

  return {
    intent: profile.atomicOnly ? ci.summary : `${ci.summary} and nearby fixes`,
    included_paths: [...new Set(included)].sort(),
    excluded_paths: [...new Set(excluded)].sort(),
    message,
    required_validation_refs,
  };
}
