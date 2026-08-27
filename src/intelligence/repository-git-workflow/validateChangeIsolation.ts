import { classifyChangedPaths, classifyPath } from "./classifyChangedPaths.js";
import type { RepositoryGitWorkflowInput } from "./types.js";

/**
 * Brain — S13H change-isolation validation (contract §7, §10; Skill R8/R9/R10;
 * HI-012/HI-013).
 *
 * Every candidate changed/staged path must resolve to INTENDED or
 * ALLOWED_SUPPORTING. A protected canonical semantic path that shows unexpected
 * drift -> BLOCKED + RETURN_TO_CHATGPT_AUTHORING_GATE.
 */

export interface ChangeIsolationResult {
  ok: boolean;
  /** Staged/changed candidate paths outside the intended/supporting scope. */
  out_of_scope_paths: string[];
  /** Protected semantic paths showing unexpected drift. */
  protected_drift_paths: string[];
  blockers: string[];
  return_to_authoring_gate: boolean;
}

/** Paths currently staged or modified in the tracked working set. */
function candidateCommitPaths(input: RepositoryGitWorkflowInput): string[] {
  return input.repository.paths
    .filter((p) => p.tracked && (p.staged || p.modified || p.deleted))
    .map((p) => p.path);
}

export function validateChangeIsolation(input: RepositoryGitWorkflowInput): ChangeIsolationResult {
  const blockers: string[] = [];
  const out_of_scope_paths: string[] = [];
  const protected_drift_paths: string[] = [];

  for (const path of candidateCommitPaths(input)) {
    const c = classifyPath(path, input, { tracked: true });
    if (c.disposition === "PROTECTED") {
      protected_drift_paths.push(path);
      continue;
    }
    if (c.disposition !== "INTENDED" && c.disposition !== "ALLOWED_SUPPORTING") {
      out_of_scope_paths.push(path);
    }
  }

  // Any UNKNOWN classification anywhere in the change set also blocks isolation.
  for (const c of classifyChangedPaths(input)) {
    if (c.disposition === "UNKNOWN") {
      out_of_scope_paths.push(c.path);
    }
  }

  const unique = (a: string[]): string[] => Array.from(new Set(a));
  const oos = unique(out_of_scope_paths);
  const drift = unique(protected_drift_paths);

  if (oos.length > 0) {
    blockers.push(
      `Change set includes path(s) outside intended/supporting scope: ${oos.join(", ")}. ` +
        "A commit here would not be isolated (contract §10) — BLOCKED.",
    );
  }
  if (drift.length > 0) {
    blockers.push(
      `Protected canonical semantic artifact(s) show unexpected drift: ${drift.join(", ")}. ` +
        "BLOCKED — RETURN_TO_CHATGPT_AUTHORING_GATE (contract §10).",
    );
  }

  return {
    ok: blockers.length === 0,
    out_of_scope_paths: oos,
    protected_drift_paths: drift,
    blockers,
    return_to_authoring_gate: drift.length > 0,
  };
}
