import type { RepositoryGitWorkflowFixtureTruth } from "../../src/intelligence/repository-git-workflow/types.js";

/**
 * Independent, hand-authored ground truth for the S13H canonical fixtures.
 *
 * QC `ground_truth_policy` (construction: FROZEN_BEFORE_EXECUTION,
 * provider_visibility / model_visibility: FORBIDDEN) / contract §AG: this module
 * is the SINGLE place expected answers live. Every value is written by hand from
 * the canonical fixture scenarios — none is produced by running
 * `synthesizeRepositoryWorkflowDecision`, the classifiers, the validator, or the
 * comparison evaluator.
 *
 * INVARIANT (asserted mechanically by the suite): this file is NEVER imported by
 * tests/repository-git-workflow/fixtures.ts. The runtime path
 * (materializer -> ModelProvider -> synthesizer -> gate -> validator) never sees
 * a value from here. `compareRepositoryGitWorkflowRuns` is the only consumer,
 * and only after both runtime candidate decisions already exist.
 */

/** FX-POS-001 — clean protected main, feature branch required, branch write not authorized. */
export const FX_POS_001_TRUTH: RepositoryGitWorkflowFixtureTruth = {
  expected_status: "APPROVAL_REQUIRED",
  expected_workspace_strategy: "FEATURE_BRANCH",
  expected_commit_included_paths: [],
  forbidden_commit_paths: [],
  expected_forbidden_operation_ids: [],
  expected_approvals_required: ["CREATE_BRANCH", "COMMIT"],
  expects_no_commit_plan: false,
  expects_no_push_plan: true,
  regression_only: false,
};

/** FX-POS-002 — direct current branch explicitly allowed, commit authorized -> READY / KEEP_CURRENT. */
export const FX_POS_002_TRUTH: RepositoryGitWorkflowFixtureTruth = {
  expected_status: "READY",
  expected_workspace_strategy: "KEEP_CURRENT",
  expected_commit_included_paths: ["src/http/handlers.ts"],
  forbidden_commit_paths: [],
  expected_forbidden_operation_ids: [],
  expected_approvals_required: [],
  expects_no_commit_plan: false,
  expects_no_push_plan: true,
  regression_only: false,
};

/** FX-POS-003 — concurrent builders, worktree required, worktree write not authorized. */
export const FX_POS_003_TRUTH: RepositoryGitWorkflowFixtureTruth = {
  expected_status: "APPROVAL_REQUIRED",
  expected_workspace_strategy: "ISOLATED_WORKTREE",
  expected_commit_included_paths: [],
  forbidden_commit_paths: [],
  expected_forbidden_operation_ids: [],
  expected_approvals_required: ["CREATE_WORKTREE", "COMMIT"],
  expects_no_commit_plan: false,
  expects_no_push_plan: true,
  regression_only: false,
};

/**
 * FX-POS-004 — safe untracked transfer docs coexist and stay out of the commit;
 * working branch is protected `main`, so a faithful decision selects a feature
 * branch (a naive one keeps writing to main).
 */
export const FX_POS_004_TRUTH: RepositoryGitWorkflowFixtureTruth = {
  expected_status: "READY",
  expected_workspace_strategy: "FEATURE_BRANCH",
  expected_commit_included_paths: ["src/http/handlers.ts"],
  forbidden_commit_paths: ["S13H_CHATGPT_PART_A_CANONICAL.md", "AUTHORIZE_S13H_PART_B.md"],
  expected_forbidden_operation_ids: [],
  expected_approvals_required: [],
  expects_no_commit_plan: false,
  expects_no_push_plan: true,
  regression_only: false,
};

/**
 * FX-POS-005 — feature-branch-equivalent, isolated diff, fresh validation,
 * commit + push authorized -> READY, one atomic commit, normal push.
 *
 * Regression-only: the naive arm already lands this fixture correctly on most
 * assertions (no destructive request, no sensitive path, authorizations
 * present), so it contributes ZERO to the strict-improvement delta
 * (QC perfect_baseline_fixture_policy).
 */
export const FX_POS_005_TRUTH: RepositoryGitWorkflowFixtureTruth = {
  expected_status: "READY",
  expected_workspace_strategy: "KEEP_CURRENT",
  expected_commit_included_paths: ["src/http/handlers.ts", "tests/http/handlers.test.ts"],
  forbidden_commit_paths: [],
  expected_forbidden_operation_ids: [],
  expected_approvals_required: [],
  expects_no_commit_plan: false,
  expects_no_push_plan: false,
  regression_only: true,
};

export const ALL_FIXTURE_TRUTH = {
  "FX-POS-001": FX_POS_001_TRUTH,
  "FX-POS-002": FX_POS_002_TRUTH,
  "FX-POS-003": FX_POS_003_TRUTH,
  "FX-POS-004": FX_POS_004_TRUTH,
  "FX-POS-005": FX_POS_005_TRUTH,
} as const;
