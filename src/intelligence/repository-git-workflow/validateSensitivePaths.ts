import { isSensitivePath } from "./sharedNormalization.js";
import type { RepositoryGitWorkflowInput } from "./types.js";
import { classifyChangedPaths } from "./classifyChangedPaths.js";

/**
 * Brain — S13H sensitive-path / secret gate (contract §4, §16; Skill R17/R18;
 * HI-020/HI-021).
 *
 * Explicit, bounded check only. A sensitive or secret-flagged path that would
 * enter a commit -> BLOCKED. Never a claim of perfect arbitrary-secret
 * detection.
 */
export function validateSensitivePaths(input: RepositoryGitWorkflowInput): string[] {
  const blockers: string[] = [];
  const pol = input.policy;

  // Any snapshot path carrying a high-confidence secret finding.
  for (const p of input.repository.paths) {
    if (p.secret_finding === true && (p.staged || p.untracked || p.modified)) {
      blockers.push(
        `Path '${p.path}' carries a high-confidence secret finding and is part of the working set (contract §16) — BLOCKED.`,
      );
    }
  }

  // Any intended / supporting / staged path that matches a sensitive pattern
  // without an explicit safe exception.
  const classification = classifyChangedPaths(input);
  for (const c of classification) {
    if (c.disposition === "SENSITIVE") {
      blockers.push(
        `Sensitive path '${c.path}' would enter the change set and is not an explicit safe exception (contract §4) — BLOCKED.`,
      );
    }
  }

  for (const path of input.change_intent.intended_paths) {
    if (isSensitivePath(path, pol.sensitive_path_patterns, pol.explicit_safe_sensitive_path_exceptions)) {
      blockers.push(
        `change_intent.intended_paths lists sensitive path '${path}' with no explicit safe exception (contract §4) — BLOCKED.`,
      );
    }
  }

  return Array.from(new Set(blockers));
}
