import type {
  RemoteReviewHandoff,
  RepositoryCommitPlan,
  RepositoryGitWorkflowInput,
  WorkspaceDecision,
} from "./types.js";

/**
 * Brain — S13H provider-neutral remote review / PR handoff (contract §13; Skill
 * "Remote review handoff", R20; HI-023).
 *
 * Provider-neutral fields ONLY. No GitHub/GitLab/Bitbucket token, endpoint,
 * client, MCP server or OAuth session — those belong to the future S14
 * capability layer. S13H never calls a PR API.
 */
export function buildRemoteReviewHandoff(
  input: RepositoryGitWorkflowInput,
  workspace: WorkspaceDecision,
  commitPlan: RepositoryCommitPlan | null,
): RemoteReviewHandoff {
  const mode = input.policy.remote_review_mode;

  const source_branch =
    workspace.strategy === "KEEP_CURRENT"
      ? input.repository.branch ?? undefined
      : workspace.branch_name ?? input.repository.branch ?? undefined;

  const target_branch = input.policy.target_branch ?? input.repository.upstream_ref?.split("/").pop();

  const changed_paths = commitPlan ? [...commitPlan.included_paths] : [...input.change_intent.intended_paths];

  const validation_evidence_refs = input.validation_evidence
    .filter((e) => e.status === "PASS" && e.repository_fingerprint === input.current_repository_fingerprint)
    .map((e) => e.evidence_ref ?? e.requirement_id);

  return {
    mode,
    source_branch,
    target_branch,
    title:
      mode === "NONE"
        ? undefined
        : `${input.change_intent.expected_change_kind}: ${input.change_intent.summary}`.slice(0, 120),
    summary: mode === "NONE" ? undefined : input.change_intent.summary,
    changed_paths,
    validation_evidence_refs,
    open_issues: [],
  };
}
