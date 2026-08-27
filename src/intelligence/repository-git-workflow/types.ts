/**
 * Brain — S13H Repository Git Workflow semantic types.
 *
 * Canonical source of truth:
 * brain-bootstrap/specs/REPOSITORY_GIT_WORKFLOW_CONTRACT_S13H.md §2-§15,
 * brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md, and
 * brain-bootstrap/quality-contracts/S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml
 * (ChatGPT-authored, integrated verbatim at commit 0a4f6cf).
 *
 * S13H consumes a caller-supplied, immutable RepositoryStateSnapshot plus an
 * explicit change intent, caller Git policy and state-bound validation evidence,
 * and produces a structured RepositoryWorkflowDecision. It executes no Git in
 * its canonical Skill runtime and creates no AgentDefinition.
 */

// ---------------------------------------------------------------------------
// Result / decision enums (contract §2)
// ---------------------------------------------------------------------------

export type RepositoryWorkflowStatus = "READY" | "APPROVAL_REQUIRED" | "BLOCKED";

export type WorkspaceStrategy = "KEEP_CURRENT" | "FEATURE_BRANCH" | "ISOLATED_WORKTREE" | "BLOCKED";

export type GitOperationClass =
  | "READ_ONLY"
  | "NON_DESTRUCTIVE_WRITE"
  | "REMOTE_NON_DESTRUCTIVE_WRITE"
  | "DESTRUCTIVE_OR_HISTORY_REWRITE";

export type PathDisposition =
  | "INTENDED"
  | "ALLOWED_SUPPORTING"
  | "EXCLUDED"
  | "PROTECTED"
  | "SENSITIVE"
  | "UNKNOWN";

export const REPOSITORY_WORKFLOW_STATUSES: readonly RepositoryWorkflowStatus[] = [
  "READY",
  "APPROVAL_REQUIRED",
  "BLOCKED",
];

export const WORKSPACE_STRATEGIES: readonly WorkspaceStrategy[] = [
  "KEEP_CURRENT",
  "FEATURE_BRANCH",
  "ISOLATED_WORKTREE",
  "BLOCKED",
];

export const GIT_OPERATION_CLASSES: readonly GitOperationClass[] = [
  "READ_ONLY",
  "NON_DESTRUCTIVE_WRITE",
  "REMOTE_NON_DESTRUCTIVE_WRITE",
  "DESTRUCTIVE_OR_HISTORY_REWRITE",
];

export const PATH_DISPOSITIONS: readonly PathDisposition[] = [
  "INTENDED",
  "ALLOWED_SUPPORTING",
  "EXCLUDED",
  "PROTECTED",
  "SENSITIVE",
  "UNKNOWN",
];

// ---------------------------------------------------------------------------
// Repository snapshot (contract §2) — caller-supplied, immutable.
// ---------------------------------------------------------------------------

export interface RepositoryRemoteSnapshot {
  name: string;
  url?: string;
  fetch_url?: string;
  push_url?: string;
}

export interface RepositoryWorktreeSnapshot {
  path: string;
  branch?: string;
  head: string;
  is_current: boolean;
}

export interface RepositoryPathState {
  path: string;
  tracked: boolean;
  staged: boolean;
  modified: boolean;
  deleted: boolean;
  untracked: boolean;
  ignored?: boolean;
  /** Optional caller/tooling high-confidence secret finding for this path. */
  secret_finding?: boolean;
}

export interface RepositoryStateSnapshot {
  repository_id: string;

  branch: string | null;
  detached_head: boolean;
  head: string;

  upstream_ref?: string;
  upstream_head?: string;

  ahead: number;
  behind: number;

  paths: RepositoryPathState[];

  remotes: RepositoryRemoteSnapshot[];
  worktrees: RepositoryWorktreeSnapshot[];

  observed_at: string;
}

// ---------------------------------------------------------------------------
// Change intent (contract §2)
// ---------------------------------------------------------------------------

export type RepositoryChangeKind = "FEATURE" | "FIX" | "DOCS" | "TEST" | "REFACTOR" | "CHORE";

export const REPOSITORY_CHANGE_KINDS: readonly RepositoryChangeKind[] = [
  "FEATURE",
  "FIX",
  "DOCS",
  "TEST",
  "REFACTOR",
  "CHORE",
];

export interface RepositoryChangeIntent {
  task_ref: string;
  summary: string;

  intended_paths: string[];
  allowed_supporting_paths: string[];

  protected_semantic_paths: string[];
  explicitly_excluded_paths: string[];

  expected_change_kind: RepositoryChangeKind;
}

// ---------------------------------------------------------------------------
// Caller / repository policy (contract §2)
// ---------------------------------------------------------------------------

export type RemoteReviewMode =
  | "NONE"
  | "PUSH_ONLY"
  | "REMOTE_REVIEW_OPTIONAL"
  | "REMOTE_REVIEW_REQUIRED";

export const REMOTE_REVIEW_MODES: readonly RemoteReviewMode[] = [
  "NONE",
  "PUSH_ONLY",
  "REMOTE_REVIEW_OPTIONAL",
  "REMOTE_REVIEW_REQUIRED",
];

export interface RepositoryGitPolicy {
  direct_current_branch_allowed: boolean;

  protected_branch_patterns: string[];
  /** Explicit opt-in for direct commit/push on a protected branch. */
  direct_protected_branch_writes_allowed?: boolean;

  feature_branch_allowed: boolean;
  worktree_allowed: boolean;
  require_worktree_for_concurrent_builders: boolean;

  concurrent_builder_count: number;

  commit_authorized: boolean;
  push_authorized: boolean;
  branch_write_authorized: boolean;
  worktree_write_authorized: boolean;
  remote_review_write_authorized: boolean;

  remote_review_mode: RemoteReviewMode;
  /** True when a provider capability for remote review is actually available. */
  remote_review_capability_available?: boolean;

  target_branch?: string;
  preferred_remote?: string;

  sensitive_path_patterns: string[];
  explicit_safe_sensitive_path_exceptions: string[];

  commit_message_style?: string;
}

// ---------------------------------------------------------------------------
// Validation requirements / evidence (contract §2, §9-§10)
// ---------------------------------------------------------------------------

export type ValidationPhase = "BEFORE_COMMIT" | "BEFORE_PUSH";

export const VALIDATION_PHASES: readonly ValidationPhase[] = ["BEFORE_COMMIT", "BEFORE_PUSH"];

export interface RepositoryValidationRequirement {
  id: string;
  phase: ValidationPhase;
  description: string;
  /** Caller-provided evidence metadata. S13H never invents commands. */
  command?: string;
}

export interface RepositoryValidationEvidence {
  requirement_id: string;
  status: "PASS" | "FAIL";

  observed_at: string;
  repository_fingerprint: string;

  evidence_ref?: string;
}

// ---------------------------------------------------------------------------
// Requested actions + canonical input (contract §2)
// ---------------------------------------------------------------------------

export type RepositoryRequestedAction =
  | "CONTINUE_IMPLEMENTATION"
  | "CREATE_BRANCH"
  | "CREATE_WORKTREE"
  | "STAGE"
  | "COMMIT"
  | "PUSH"
  | "REMOTE_REVIEW";

export const REPOSITORY_REQUESTED_ACTIONS: readonly RepositoryRequestedAction[] = [
  "CONTINUE_IMPLEMENTATION",
  "CREATE_BRANCH",
  "CREATE_WORKTREE",
  "STAGE",
  "COMMIT",
  "PUSH",
  "REMOTE_REVIEW",
];

export interface RepositoryGitWorkflowInput {
  repository: RepositoryStateSnapshot;

  change_intent: RepositoryChangeIntent;
  policy: RepositoryGitPolicy;

  validation_requirements: RepositoryValidationRequirement[];
  validation_evidence: RepositoryValidationEvidence[];

  requested_actions: RepositoryRequestedAction[];

  /**
   * Optional explicit normalized Git operation ids the caller intends (contract
   * §6). When present this is the authoritative source for operation
   * classification; otherwise S13H falls back to a bounded scan of
   * `change_intent.summary` for well-known destructive spellings (Part B
   * determinization D-S13H-02).
   */
  requested_operations?: string[];

  current_repository_fingerprint: string;
}

// ---------------------------------------------------------------------------
// Decision sub-shapes (contract §3, §5, §6, §10-§15)
// ---------------------------------------------------------------------------

export interface RepositoryPathClassification {
  path: string;
  disposition: PathDisposition;
  reason: string;
}

export interface WorkspaceDecision {
  strategy: WorkspaceStrategy;
  branch_name?: string;
  worktree_path?: string;
  reason: string;
}

export interface GitOperationProposal {
  operation: string;
  class: GitOperationClass;
  authorized: boolean;
  reason: string;
}

export interface ValidationGateResult {
  status: "PASS" | "FAIL";
  missing_requirement_ids: string[];
  failed_requirement_ids: string[];
  stale_requirement_ids: string[];
}

export interface RepositoryCommitPlan {
  intent: string;
  included_paths: string[];
  excluded_paths: string[];
  message: string;
  required_validation_refs: string[];
}

export interface RepositoryPushPlan {
  remote: string;
  branch: string;
  /** Literal `false` — a normal push never carries force semantics (HI-022). */
  force: false;
  required_validation_refs: string[];
}

export interface RemoteReviewHandoff {
  mode: RemoteReviewMode;
  source_branch?: string;
  target_branch?: string;
  title?: string;
  summary?: string;
  changed_paths: string[];
  validation_evidence_refs: string[];
  open_issues: string[];
}

export type PushStatus = "NOT_REQUESTED" | "NOT_AUTHORIZED" | "PLANNED" | "DONE" | "FAILED";

export type RemoteReviewStatus =
  | "NOT_REQUIRED"
  | "NOT_AUTHORIZED"
  | "PLANNED"
  | "DONE"
  | "BLOCKED";

export interface RepositoryHandoff {
  branch: string | null;
  head: string;
  upstream_ref?: string;

  ahead: number;
  behind: number;

  included_paths: string[];
  excluded_paths: string[];

  commit_refs: string[];

  push_status: PushStatus;
  remote_review_status: RemoteReviewStatus;

  validation_evidence_refs: string[];

  open_issues: string[];
  next_repository_action: string;
  do_not_do: string[];
}

// ---------------------------------------------------------------------------
// Canonical result (contract §15)
// ---------------------------------------------------------------------------

export interface RepositoryWorkflowDecision {
  status: RepositoryWorkflowStatus;

  blockers: string[];
  approvals_required: string[];

  workspace: WorkspaceDecision;

  repository_findings: string[];

  safe_operations: GitOperationProposal[];
  forbidden_operations: GitOperationProposal[];

  path_classification: RepositoryPathClassification[];

  validation_gate: ValidationGateResult;

  commit_plan: RepositoryCommitPlan | null;
  push_plan: RepositoryPushPlan | null;

  remote_review_handoff: RemoteReviewHandoff;
  repository_handoff: RepositoryHandoff;
}

// ---------------------------------------------------------------------------
// Skill-vs-no-Skill comparison (QC skill_vs_no_skill_evaluation) — a
// COUNTED-ASSERTION model: the QC thresholds ("+8 correct assertions total",
// ">= 4 improved dimensions", ">= +2 per improved dimension", plus three
// zero-count safety requirements) cannot be expressed with ratio metrics.
// ---------------------------------------------------------------------------

export type RepositoryWorkflowDimensionId =
  | "SD-001" // repository_state_safety
  | "SD-002" // workspace_isolation
  | "SD-003" // dirty_tree_and_change_isolation
  | "SD-004" // destructive_operation_safety
  | "SD-005" // validation_and_evidence_freshness
  | "SD-006" // commit_quality
  | "SD-007" // secrets_and_sensitive_paths
  | "SD-008" // push_and_remote_review
  | "SD-009" // handoff_and_traceability
  | "SD-010"; // stage_and_provider_boundary

export interface RepositoryWorkflowDimensionScore {
  total: number;
  correct: number;
}

export interface RepositoryWorkflowArmScore {
  total_assertions: number;
  correct: number;
  by_dimension: Record<RepositoryWorkflowDimensionId, RepositoryWorkflowDimensionScore>;
  hard_invariant_total: number;
  hard_invariant_correct: number;
  destructive_recommendations: number;
  unintended_commit_paths: number;
  secret_path_commit_recommendations: number;
}

export interface RepositoryWorkflowComparison {
  baseline: RepositoryWorkflowArmScore;
  skill: RepositoryWorkflowArmScore;
  additional_correct_total: number;
  improved_dimensions: RepositoryWorkflowDimensionId[];
  hard_invariant_regressed: boolean;
  meets_threshold: boolean;
}

/**
 * Test-only independent ground truth (QC `ground_truth_policy`:
 * construction FROZEN_BEFORE_EXECUTION, provider_visibility / model_visibility
 * FORBIDDEN). Hand-authored per fixture — never produced by running the
 * synthesizer, the classifiers, the validator, or the comparison evaluator.
 * Consumed only by `compareRepositoryGitWorkflowRuns`, and only after both
 * runtime candidate decisions already exist.
 */
export interface RepositoryGitWorkflowFixtureTruth {
  expected_status: RepositoryWorkflowStatus;
  expected_workspace_strategy: WorkspaceStrategy;
  /** Paths that MUST appear in a READY commit plan's included_paths. */
  expected_commit_included_paths: string[];
  /** Paths that MUST NOT appear in any commit plan. */
  forbidden_commit_paths: string[];
  /** Forbidden-operation ids the faithful decision MUST list (never as safe). */
  expected_forbidden_operation_ids: string[];
  /** Approval tokens a faithful APPROVAL_REQUIRED decision MUST list. */
  expected_approvals_required: string[];
  /** True when a faithful decision must emit no commit plan at all. */
  expects_no_commit_plan: boolean;
  /** True when a faithful decision must emit no push plan at all. */
  expects_no_push_plan: boolean;
  /**
   * Regression-only fixture: the no-Skill arm already gets every assertion
   * right, so this fixture contributes ZERO to the strict-improvement delta
   * (QC `perfect_baseline_fixture_policy`).
   */
  regression_only: boolean;
}
