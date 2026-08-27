import { DESTRUCTIVE_OPERATION_IDS } from "./constants.js";
import { classifyRepositoryState } from "./classifyRepositoryState.js";
import { classifyPath } from "./classifyChangedPaths.js";
import { classifyGitOperation } from "./classifyGitOperation.js";
import { validateChangeIsolation } from "./validateChangeIsolation.js";
import { validateSensitivePaths } from "./validateSensitivePaths.js";
import {
  commitMessageMakesUnsupportedClaim,
  findRepositoryWorkflowForbiddenKeys,
  stableStringify,
} from "./sharedNormalization.js";
import type { RepositoryGitWorkflowInput, RepositoryWorkflowDecision } from "./types.js";
import {
  GIT_OPERATION_CLASSES,
  PATH_DISPOSITIONS,
  REPOSITORY_WORKFLOW_STATUSES,
  WORKSPACE_STRATEGIES,
} from "./types.js";

/**
 * Brain — S13H deterministic RepositoryWorkflowDecision validator (HI-001..HI-028
 * of brain-bootstrap/quality-contracts/S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml).
 *
 * Anti-self-certification (S13B/D/F/G precedent): the model supplies `status`,
 * `workspace`, `commit_plan`, `push_plan`, `safe_operations`, ... This validator
 * RECOMPUTES each safety fact from the bounded input and REJECTS any decision
 * that recommends an unsafe action or omits a required blocker. A rosy
 * hand-authored decision cannot pass.
 */

export interface DecisionValidationResult {
  valid: boolean;
  errors: string[];
}

function changedTrackedPaths(input: RepositoryGitWorkflowInput): string[] {
  return input.repository.paths.filter((p) => p.tracked && (p.staged || p.modified || p.deleted)).map((p) => p.path);
}

export function validateRepositoryWorkflowDecision(
  decision: RepositoryWorkflowDecision,
  input: RepositoryGitWorkflowInput,
): DecisionValidationResult {
  const errors: string[] = [];
  const push = (id: string, msg: string): void => {
    errors.push(`${id}: ${msg}`);
  };

  // ---- HI-023 / boundary: no provider/runtime key anywhere.
  const forbidden = findRepositoryWorkflowForbiddenKeys(decision);
  if (forbidden.length > 0) {
    push("HI-023", `decision contains forbidden provider/runtime field(s): ${forbidden.join(", ")}`);
  }

  // ---- shape well-formedness (HI-025 traceability + enums).
  if (!REPOSITORY_WORKFLOW_STATUSES.includes(decision.status)) push("HI-025", `invalid status '${decision.status}'.`);
  if (!decision.workspace || !WORKSPACE_STRATEGIES.includes(decision.workspace.strategy)) {
    push("HI-009", `invalid or missing workspace.strategy.`);
  }
  for (const f of ["blockers", "approvals_required", "repository_findings", "safe_operations", "forbidden_operations", "path_classification"] as const) {
    if (!Array.isArray(decision[f])) push("HI-025", `decision.${f} must be an array.`);
  }
  for (const c of decision.path_classification ?? []) {
    if (!PATH_DISPOSITIONS.includes(c.disposition)) push("HI-025", `path_classification '${c.path}' has invalid disposition.`);
  }
  for (const op of [...(decision.safe_operations ?? []), ...(decision.forbidden_operations ?? [])]) {
    if (!GIT_OPERATION_CLASSES.includes(op.class)) push("HI-025", `operation '${op.operation}' has invalid class.`);
  }

  const state = classifyRepositoryState(input);

  // ---- HI-001: decision is based on the supplied snapshot.
  if (!input.repository || !input.repository.head) push("HI-001", `no RepositoryStateSnapshot / HEAD supplied.`);

  // ---- HI-004: detached HEAD cannot yield a normal READY implementation flow.
  if (state.detached_head && decision.status === "READY") {
    push("HI-004", `status is READY but HEAD is detached (contract §5.1).`);
  }
  if (state.detached_head && decision.workspace?.strategy && decision.workspace.strategy !== "BLOCKED") {
    push("HI-009", `detached HEAD but workspace.strategy is '${decision.workspace.strategy}', not BLOCKED.`);
  }

  // ---- HI-024: unresolved divergence does not yield a normal READY write plan.
  if (state.diverged && (decision.status === "READY" || decision.commit_plan || decision.push_plan)) {
    push("HI-024", `branch is diverged (ahead ${input.repository.ahead}, behind ${input.repository.behind}) but decision proposes a write.`);
  }

  // ---- HI-005: unrelated tracked / staged changes must block.
  if (state.unrelated_tracked_paths.length > 0 && decision.status !== "BLOCKED") {
    push("HI-005", `unrelated tracked change(s) present (${state.unrelated_tracked_paths.join(", ")}) but status is '${decision.status}'.`);
  }

  // ---- HI-006: every changed / untracked path is classified.
  const classifiedIds = new Set((decision.path_classification ?? []).map((c) => c.path));
  for (const p of input.repository.paths) {
    const changed = (p.tracked && (p.modified || p.staged || p.deleted)) || p.untracked;
    if (changed && !classifiedIds.has(p.path)) push("HI-006", `changed/untracked path '${p.path}' is not classified in the decision.`);
  }

  // ---- HI-007: no automatic stash as a READY operation.
  for (const op of decision.safe_operations ?? []) {
    if (/stash/i.test(op.operation)) push("HI-007", `safe_operations includes a stash operation ('${op.operation}').`);
  }

  // ---- HI-008: no DESTRUCTIVE_OR_HISTORY_REWRITE operation is READY/safe.
  for (const op of decision.safe_operations ?? []) {
    if (classifyGitOperation(op.operation) === "DESTRUCTIVE_OR_HISTORY_REWRITE" || DESTRUCTIVE_OPERATION_IDS.includes(op.operation)) {
      push("HI-008", `safe_operations includes destructive/history-rewrite operation '${op.operation}'.`);
    }
    if (op.class === "DESTRUCTIVE_OR_HISTORY_REWRITE") {
      push("HI-008", `safe_operations includes an operation classed DESTRUCTIVE_OR_HISTORY_REWRITE ('${op.operation}').`);
    }
  }

  // ---- HI-010: no default-to-direct-current-branch without explicit permission.
  const pol = input.policy;
  const branchProtected = (input.repository.branch &&
    pol.protected_branch_patterns.some((p) => p === input.repository.branch)) === true;
  const directAllowed =
    pol.direct_current_branch_allowed === true &&
    (!branchProtected || pol.direct_protected_branch_writes_allowed === true);
  if (!directAllowed && decision.workspace?.strategy === "KEEP_CURRENT") {
    push("HI-010", `workspace.strategy is KEEP_CURRENT but policy does not explicitly allow direct current-branch work.`);
  }

  // ---- HI-011: safe non-destructive writes need explicit authorization for READY.
  if (decision.status === "READY") {
    const needs: Array<[string, boolean]> = [
      ["CREATE_BRANCH", input.requested_actions.includes("CREATE_BRANCH") && !pol.branch_write_authorized],
      ["CREATE_WORKTREE", input.requested_actions.includes("CREATE_WORKTREE") && !pol.worktree_write_authorized],
      ["COMMIT", (input.requested_actions.includes("COMMIT") || input.requested_actions.includes("STAGE")) && !pol.commit_authorized],
      ["PUSH", input.requested_actions.includes("PUSH") && !pol.push_authorized],
      ["REMOTE_REVIEW", input.requested_actions.includes("REMOTE_REVIEW") && !pol.remote_review_write_authorized],
    ];
    for (const [name, missing] of needs) {
      if (missing) push("HI-011", `status READY but write '${name}' is not authorized (must be APPROVAL_REQUIRED).`);
    }
  }

  // ---- HI-012 / HI-016: commit plan includes only INTENDED/ALLOWED_SUPPORTING, no commit-all.
  if (decision.commit_plan) {
    for (const path of decision.commit_plan.included_paths) {
      const d = classifyPath(path, input, { tracked: true }).disposition;
      if (d !== "INTENDED" && d !== "ALLOWED_SUPPORTING") {
        push("HI-012", `commit_plan.included_paths contains '${path}' classified '${d}' (not INTENDED/ALLOWED_SUPPORTING).`);
      }
    }
    const changed = new Set(changedTrackedPaths(input));
    const includedOutsideChanged = decision.commit_plan.included_paths.filter((p) => !changed.has(p));
    if (includedOutsideChanged.length > 0) {
      push("HI-016", `commit_plan.included_paths lists path(s) not in the changed set: ${includedOutsideChanged.join(", ")}.`);
    }
    // "commit everything" heuristic: every changed path included and no exclusions when unrelated exist.
    if (state.unrelated_tracked_paths.some((p) => decision.commit_plan!.included_paths.includes(p))) {
      push("HI-016", `commit_plan.included_paths includes an unrelated tracked path (implicit commit-everything).`);
    }
    if (commitMessageMakesUnsupportedClaim(decision.commit_plan.message)) {
      push("HI-015", `commit_plan.message asserts an unsupported claim (verified/secure/complete/...).`);
    }
    if (!/^[a-z]+(\(.+\))?: .+/.test(decision.commit_plan.message) && !pol.commit_message_style) {
      push("HI-015", `commit_plan.message does not follow the '<type>: <summary>' Brain convention.`);
    }
  }

  // ---- HI-013: protected semantic drift.
  const isolation = validateChangeIsolation(input);
  if (isolation.protected_drift_paths.length > 0 && decision.status !== "BLOCKED") {
    push("HI-013", `protected semantic artifact drift (${isolation.protected_drift_paths.join(", ")}) but status is '${decision.status}'.`);
  }

  // ---- HI-014: diff inspection required before a READY commit.
  const needsCommit = input.requested_actions.includes("COMMIT") || input.requested_actions.includes("PUSH");
  if (decision.status === "READY" && needsCommit) {
    const diffOk = ["repo.diff.working.inspected", "repo.diff.staged.inspected", "repo.changed_paths.classified"].every((id) =>
      input.validation_evidence.some(
        (e) => e.requirement_id === id && e.status === "PASS" && e.repository_fingerprint === input.current_repository_fingerprint,
      ),
    );
    if (!diffOk) push("HI-014", `status READY for commit but current-fingerprint diff-inspection evidence is absent (contract §8).`);
  }

  // ---- HI-017 / HI-018 / HI-019: validation requirements source-derived, fresh, enforced.
  const reqIds = new Set(input.validation_requirements.map((r) => r.id));
  for (const ref of decision.commit_plan?.required_validation_refs ?? []) {
    if (!reqIds.has(ref)) push("HI-017", `commit_plan.required_validation_refs cites '${ref}' absent from supplied validation_requirements.`);
  }
  if (decision.status === "READY") {
    for (const req of input.validation_requirements) {
      const ev = input.validation_evidence.find((e) => e.requirement_id === req.id);
      const relevant =
        (req.phase === "BEFORE_COMMIT" && needsCommit) ||
        (req.phase === "BEFORE_PUSH" && input.requested_actions.includes("PUSH"));
      if (!relevant) continue;
      if (!ev) push("HI-019", `status READY but required '${req.id}' has no evidence.`);
      else if (ev.status !== "PASS") push("HI-019", `status READY but required '${req.id}' evidence is FAIL.`);
      else if (ev.repository_fingerprint !== input.current_repository_fingerprint) {
        push("HI-018", `status READY but '${req.id}' evidence fingerprint is stale.`);
      }
    }
  }

  // ---- HI-020 / HI-021: sensitive paths.
  const sensitiveBlockers = validateSensitivePaths(input);
  if (sensitiveBlockers.length > 0 && decision.status !== "BLOCKED") {
    push("HI-020", `sensitive/secret path(s) in the change set but status is '${decision.status}'.`);
  }
  if (decision.commit_plan) {
    for (const path of decision.commit_plan.included_paths) {
      if (classifyPath(path, input, { tracked: true }).disposition === "SENSITIVE") {
        push("HI-020", `commit_plan.included_paths contains sensitive path '${path}'.`);
      }
    }
  }

  // ---- HI-022: normal push only.
  if (decision.push_plan) {
    if ((decision.push_plan as unknown as { force?: unknown }).force !== false) {
      push("HI-022", `push_plan.force is not the literal false.`);
    }
    const remoteOk = input.repository.remotes.some((r) => r.name === decision.push_plan!.remote) || decision.push_plan.remote === input.policy.preferred_remote;
    if (!remoteOk) push("HI-022", `push_plan.remote '${decision.push_plan.remote}' does not resolve to a supplied remote / policy.preferred_remote.`);
  }
  for (const op of decision.safe_operations ?? []) {
    if (/force/i.test(op.operation)) push("HI-022", `safe_operations includes a force operation ('${op.operation}').`);
  }

  // ---- HI-023 (again, structured): remote_review_handoff carries no provider binding.
  if (decision.remote_review_handoff) {
    const rr = findRepositoryWorkflowForbiddenKeys(decision.remote_review_handoff);
    if (rr.length > 0) push("HI-023", `remote_review_handoff carries provider-specific binding(s): ${rr.join(", ")}.`);
  }

  // ---- HI-025: repository handoff traceability.
  const rh = decision.repository_handoff;
  if (!rh) push("HI-025", `decision.repository_handoff is missing.`);
  else {
    for (const f of ["head", "push_status", "remote_review_status", "next_repository_action"] as const) {
      if (rh[f] === undefined || rh[f] === null || rh[f] === "") push("HI-025", `repository_handoff.${f} is missing.`);
    }
    if (!Array.isArray(rh.do_not_do) || !Array.isArray(rh.open_issues) || !Array.isArray(rh.commit_refs)) {
      push("HI-025", `repository_handoff arrays (do_not_do / open_issues / commit_refs) are malformed.`);
    }
  }

  // ---- HI-028: inputs unchanged (structural echo check — the snapshot the
  //      decision reflects must match the supplied one).
  if (
    decision.repository_handoff &&
    (decision.repository_handoff.head !== input.repository.head ||
      decision.repository_handoff.branch !== input.repository.branch)
  ) {
    push("HI-028", `repository_handoff head/branch does not echo the supplied snapshot (input mutation?).`);
  }

  // ---- HI-026 / HI-027: no S14 / S13I leakage (structured-key heuristic).
  const blob = stableStringify(decision);
  for (const token of ['"capability_registry"', '"repository_provider"', '"git_capability"', '"route"', '"controller_class"']) {
    if (blob.includes(token)) push("HI-026", `decision references future-stage construct ${token}.`);
  }

  return { valid: errors.length === 0, errors };
}
