/**
 * Brain — S13H Repository Git Workflow constants.
 *
 * Stable identifiers and parseable marker strings shared by the S13H Skill
 * definition, the workflow bridge, the deterministic reference ModelProvider
 * fixture, and the tests. Mirrors
 * src/intelligence/task-prompt-compiler/constants.ts.
 *
 * The canonical semantic source of truth for S13H is
 * brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md,
 * brain-bootstrap/quality-contracts/S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml, and
 * brain-bootstrap/specs/REPOSITORY_GIT_WORKFLOW_CONTRACT_S13H.md
 * (ChatGPT-authored, integrated verbatim at commit 0a4f6cf).
 */

/** Skill Contract v1 id — Skill file "Identity" block. */
export const REPOSITORY_GIT_WORKFLOW_SKILL_ID = "intelligence.repository-git-workflow.s13h";

/** DEEP Quality Contract reference — Skill file "Requires" block. */
export const REPOSITORY_GIT_WORKFLOW_QUALITY_CONTRACT_REF = "S13H_REPOSITORY_GIT_WORKFLOW_DEEP";

/** Canonical Skill markdown artifact path. */
export const REPOSITORY_GIT_WORKFLOW_SKILL_ARTIFACT_PATH =
  "brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md";

/** Canonical Quality Contract artifact path. */
export const REPOSITORY_GIT_WORKFLOW_QUALITY_CONTRACT_ARTIFACT_PATH =
  "brain-bootstrap/quality-contracts/S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml";

/** Canonical contract spec artifact path. */
export const REPOSITORY_GIT_WORKFLOW_CONTRACT_ARTIFACT_PATH =
  "brain-bootstrap/specs/REPOSITORY_GIT_WORKFLOW_CONTRACT_S13H.md";

/**
 * Stable, parseable contract with the ModelProvider that consumes the
 * materialized objective (mirrors TASK_COMPILATION_INPUT_MARKER). Not prose for
 * a human reader.
 */
export const REPOSITORY_GIT_WORKFLOW_INPUT_MARKER = "REPOSITORY_GIT_WORKFLOW_INPUT:";

/** Present in the objective only when the S13H Skill body was materialized. */
export const REPOSITORY_GIT_WORKFLOW_SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";

/**
 * Structured provider/runtime keys forbidden anywhere inside a
 * RepositoryWorkflowDecision (Skill file "Remote review handoff" / contract §13,
 * §17). Provider-specific remote binding, credential material and executor
 * handles belong to the future S14 capability layer, never to the S13H
 * Intelligence decision.
 */
export const REPOSITORY_WORKFLOW_FORBIDDEN_KEYS: readonly string[] = [
  "github_token",
  "gitlab_token",
  "bitbucket_token",
  "api_endpoint",
  "api_token",
  "mcp_server",
  "provider_client",
  "provider_id",
  "connector",
  "oauth_session",
  "credential",
  "secret_value",
  "access_token",
  "runtime_handle",
  "implementation_class",
  "pr_api_call",
  "merge_executor",
  "rebase_executor",
  "reset_executor",
  "stash_executor",
  "shell_command_to_execute_now",
  "execution_result",
  "task_executor",
  "workflow_state",
];

/**
 * Canonical DESTRUCTIVE_OR_HISTORY_REWRITE operation ids (Skill file "Operation
 * classes" / contract §6). Normalized identifiers, not shell command strings.
 * None may appear in a READY decision's `safe_operations`.
 */
export const DESTRUCTIVE_OPERATION_IDS: readonly string[] = [
  "RESET_HARD",
  "CLEAN_UNTRACKED",
  "CLEAN_ALL",
  "RESTORE_BROAD",
  "CHECKOUT_BROAD",
  "DELETE_BRANCH_FORCE",
  "PUSH_FORCE",
  "PUSH_FORCE_WITH_LEASE",
  "REBASE_SHARED_HISTORY",
  "AMEND_PUBLISHED_COMMIT",
  "HISTORY_REWRITE",
  "FILTER_REPO",
  "AUTO_STASH",
];

/**
 * High-confidence sensitive path baseline patterns (Skill file "Sensitive-path
 * policy" / contract §4). This is an explicit, bounded list — NOT a claim of
 * perfect arbitrary-secret detection. Caller policy may extend it and may
 * declare exact safe exceptions (e.g. `.env.example`).
 */
export const SENSITIVE_PATH_BASELINE_PATTERNS: readonly string[] = [
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "credentials.*",
  "*.p12",
  "*.pfx",
  "id_rsa",
  "id_ed25519",
];

/** The fixed compilation-boundary / safety marker cited by generic S13H findings. */
export const REPOSITORY_WORKFLOW_BOUNDARY_REF = "policy:s13h-repository-workflow-boundary";

/** Generic S13H repository checks (contract §8) — NOT project build/test commands. */
export const S13H_DIFF_INSPECTION_CHECK_IDS: readonly string[] = [
  "repo.diff.working.inspected",
  "repo.diff.staged.inspected",
  "repo.changed_paths.classified",
];
