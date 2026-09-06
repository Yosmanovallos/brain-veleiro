/**
 * S14D — Git Capability: trusted provider-layer configuration and observation
 * types.
 *
 * Defined by brain-bootstrap/skills/GIT_CAPABILITY_SKILL_S14D.md,
 * brain-bootstrap/quality-contracts/S14D_GIT_DEEP.yaml and
 * brain-bootstrap/specs/GIT_CAPABILITY_CONTRACT_S14D.md (canonical Part A,
 * integrated byte-for-byte at baseline b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7).
 *
 * A `WorkspaceGitConfig` is explicit host-side/administrative input. The model
 * never creates, mutates or overrides it. Model-visible invocation input is only
 * `{}` (repository.status) or `{ path, revision? }` (repository.read). None of
 * these fields enter `AgentDefinition`, the public `ToolDescriptor`,
 * `capability_id` or model-visible output — swapping the concrete repository
 * implementation behind one `repository.*` capability id must not require an
 * `AgentDefinition` edit (contract §4, §36).
 */

/** Explicit trusted Git provider configuration (contract §6). */
export interface WorkspaceGitConfig {
  /** Logical repository identifier, grammar `^[a-z0-9][a-z0-9._-]*$`, <=160 chars. */
  repository_id: string;
  /** Explicit absolute host path to an ordinary non-bare worktree root; realpath-canonicalized. */
  repository_root: string;
  /** Explicit absolute host path to the git executable; realpath-canonicalized, regular, executable. */
  git_executable: string;
  /** Upper timeout bound for one invocation, in ms; composed by minimum with the request. */
  max_timeout_ms: number;
}

/** repository.status structured observation (contract §15). */
export interface RepositoryStatusObservation {
  repository_id: string;
  branch: string | null;
  detached_head: boolean;
  /** Full 40/64-hex object id, or "" for an unborn branch. */
  head: string;
  upstream_ref?: string;
  upstream_head?: string;
  ahead: number;
  behind: number;
  paths: RepositoryStatusPath[];
  /** UTC ISO-8601. */
  observed_at: string;
}

export interface RepositoryStatusPath {
  path: string;
  tracked: boolean;
  staged: boolean;
  modified: boolean;
  deleted: boolean;
  untracked: boolean;
}

/** repository.read structured observation (contract §20). */
export interface RepositoryReadObservation {
  repository_id: string;
  requested_revision: string;
  resolved_commit: string;
  path: string;
  object_id: string;
  size_bytes: number;
  content: string;
}

/**
 * Closed internal Git operation families (contract §11). The model never selects
 * a Git command, subcommand, argv, `-c` option, git-dir/work-tree, format,
 * remote or output target. Each family maps to exactly one fixed provider-owned
 * argv template built from module constants plus, at most, one already-validated
 * `revision`/`object_id` (`HEAD` or full hex) and one already-validated logical
 * path placed after a provider-owned `--`.
 */
export type GitOperationFamily =
  | "VERSION"
  | "STATUS"
  | "RESOLVE_HEAD"
  | "VERIFY_COMMIT_OBJECT"
  | "RESOLVE_TREE_ENTRY"
  | "READ_BLOB";
