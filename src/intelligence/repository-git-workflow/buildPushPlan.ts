import type { RepositoryGitWorkflowInput, RepositoryPushPlan, WorkspaceDecision } from "./types.js";

/**
 * Brain — S13H push-plan materialization (contract §12; Skill "Push plan", R19;
 * HI-022).
 *
 * Normal push only. `force` is the literal `false` in the type, so a forced
 * push is a compile error, not a runtime check. Returns null when a push is not
 * requested or cannot resolve a remote target.
 */
export function buildPushPlan(
  input: RepositoryGitWorkflowInput,
  workspace: WorkspaceDecision,
): RepositoryPushPlan | null {
  if (!input.requested_actions.includes("PUSH")) return null;

  const remote =
    input.policy.preferred_remote ??
    input.repository.remotes.find((r) => r.name === "origin")?.name ??
    input.repository.remotes[0]?.name;
  if (!remote) return null;

  const branch =
    workspace.strategy === "KEEP_CURRENT"
      ? input.repository.branch ?? ""
      : workspace.branch_name ?? input.repository.branch ?? "";
  if (!branch) return null;

  const required_validation_refs = input.validation_requirements
    .filter((r) => r.phase === "BEFORE_COMMIT" || r.phase === "BEFORE_PUSH")
    .map((r) => r.id);

  return { remote, branch, force: false, required_validation_refs };
}
