import { isSensitivePath, pathMatchesAny } from "./sharedNormalization.js";
import type {
  PathDisposition,
  RepositoryGitWorkflowInput,
  RepositoryPathClassification,
} from "./types.js";

/**
 * Brain — S13H changed-path classification (contract §3; Skill "Change
 * isolation", "Dirty-tree policy").
 *
 * Canonical classification priority (contract §3):
 *   1 sensitive
 *   2 protected semantic path
 *   3 explicit intended
 *   4 allowed supporting
 *   5 explicit excluded
 *   6 known ignored / generated
 *   7 otherwise unknown
 *
 * A path that is both sensitive and intended -> SENSITIVE wins, unless it
 * matches an explicit caller safe exception.
 */

export function classifyPath(
  path: string,
  input: RepositoryGitWorkflowInput,
  opts: { tracked?: boolean; untracked?: boolean; ignored?: boolean; secret_finding?: boolean } = {},
): RepositoryPathClassification {
  const ci = input.change_intent;
  const pol = input.policy;

  if (
    opts.secret_finding === true ||
    isSensitivePath(path, pol.sensitive_path_patterns, pol.explicit_safe_sensitive_path_exceptions)
  ) {
    return {
      path,
      disposition: "SENSITIVE",
      reason:
        opts.secret_finding === true
          ? "Caller/tooling reported a high-confidence secret finding for this path."
          : "Matches a high-confidence sensitive-path pattern with no explicit safe exception.",
    };
  }

  if (pathMatchesAny(path, ci.protected_semantic_paths)) {
    return { path, disposition: "PROTECTED", reason: "Declared a protected canonical semantic artifact." };
  }

  if (pathMatchesAny(path, ci.intended_paths)) {
    return { path, disposition: "INTENDED", reason: "Explicitly named in change_intent.intended_paths." };
  }

  if (pathMatchesAny(path, ci.allowed_supporting_paths)) {
    return {
      path,
      disposition: "ALLOWED_SUPPORTING",
      reason: "Explicitly named in change_intent.allowed_supporting_paths.",
    };
  }

  if (pathMatchesAny(path, ci.explicitly_excluded_paths)) {
    return { path, disposition: "EXCLUDED", reason: "Explicitly named in change_intent.explicitly_excluded_paths." };
  }

  if (opts.ignored === true) {
    return { path, disposition: "EXCLUDED", reason: "Ignored / generated artifact; excluded by default (contract §I)." };
  }

  return {
    path,
    disposition: "UNKNOWN",
    reason: "Not resolvable to any intended / supporting / excluded / protected set.",
  };
}

/**
 * Classify every changed / untracked path in the snapshot. Unchanged tracked
 * paths are not part of a workflow decision and are omitted.
 */
export function classifyChangedPaths(
  input: RepositoryGitWorkflowInput,
): RepositoryPathClassification[] {
  const out: RepositoryPathClassification[] = [];
  for (const p of input.repository.paths) {
    const changed = (p.tracked && (p.modified || p.staged || p.deleted)) || p.untracked;
    if (!changed) continue;
    out.push(
      classifyPath(p.path, input, {
        tracked: p.tracked,
        untracked: p.untracked,
        ignored: p.ignored,
        secret_finding: p.secret_finding,
      }),
    );
  }
  return out;
}

export const COMMITTABLE_DISPOSITIONS: readonly PathDisposition[] = ["INTENDED", "ALLOWED_SUPPORTING"];
