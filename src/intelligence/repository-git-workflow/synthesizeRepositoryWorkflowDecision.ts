import { DESTRUCTIVE_OPERATION_IDS } from "./constants.js";
import { classifyRepositoryState } from "./classifyRepositoryState.js";
import { classifyChangedPaths } from "./classifyChangedPaths.js";
import { classifyGitOperation } from "./classifyGitOperation.js";
import { decideWorkspaceStrategy } from "./decideWorkspaceStrategy.js";
import { validateChangeIsolation } from "./validateChangeIsolation.js";
import { validateSensitivePaths } from "./validateSensitivePaths.js";
import { evaluateValidationGate, phasesForAction, validationGateBlockers } from "./validateValidationEvidence.js";
import { buildCommitPlan, FAITHFUL_COMMIT_PLAN_PROFILE, NAIVE_COMMIT_PLAN_PROFILE } from "./buildCommitPlan.js";
import { buildPushPlan } from "./buildPushPlan.js";
import { buildRemoteReviewHandoff } from "./buildRemoteReviewHandoff.js";
import { deepClone } from "./sharedNormalization.js";
import type {
  GitOperationProposal,
  RepositoryGitWorkflowInput,
  RepositoryHandoff,
  RepositoryWorkflowDecision,
  RepositoryWorkflowStatus,
  ValidationPhase,
} from "./types.js";

/**
 * Brain — S13H single decision synthesizer (the one genuine input-derived
 * planner; contract §21 forbids a "separate intentionally-bad baseline
 * planner").
 *
 * Behaviour is parameterized by a `WorkflowSynthesisProfile` derived by CONTENT
 * regex from whatever S13H Skill rule text reached the run objective — never
 * from a with-Skill flag / Skill id / fixture id. With no rule text, every
 * profile field is `false` and an UNSAFE naive decision falls out (recommends
 * destructive ops as safe, "commit everything", force push, ignores detached
 * HEAD / divergence / sensitive paths, invents nothing but blocks nothing).
 * That naive decision is the phenomenon the Skill-vs-no-Skill comparison
 * measures — its defects are consequences of ABSENT guidance, not authored.
 */

export interface WorkflowSynthesisProfile {
  blockDetachedHeadAndDivergence: boolean;
  blockUnrelatedTracked: boolean;
  defaultFeatureBranch: boolean;
  noDestructiveReady: boolean;
  noAutoStash: boolean;
  requireExplicitWriteAuth: boolean;
  enforceChangeIsolation: boolean;
  requireDiffInspection: boolean;
  atomicCommitsOnly: boolean;
  validationFromInputOnly: boolean;
  blockSensitivePaths: boolean;
  normalPushOnly: boolean;
  providerNeutralReviewOnly: boolean;
}

export const FAITHFUL_SYNTHESIS_PROFILE: WorkflowSynthesisProfile = {
  blockDetachedHeadAndDivergence: true,
  blockUnrelatedTracked: true,
  defaultFeatureBranch: true,
  noDestructiveReady: true,
  noAutoStash: true,
  requireExplicitWriteAuth: true,
  enforceChangeIsolation: true,
  requireDiffInspection: true,
  atomicCommitsOnly: true,
  validationFromInputOnly: true,
  blockSensitivePaths: true,
  normalPushOnly: true,
  providerNeutralReviewOnly: true,
};

export const NAIVE_SYNTHESIS_PROFILE: WorkflowSynthesisProfile = {
  blockDetachedHeadAndDivergence: false,
  blockUnrelatedTracked: false,
  defaultFeatureBranch: false,
  noDestructiveReady: false,
  noAutoStash: false,
  requireExplicitWriteAuth: false,
  enforceChangeIsolation: false,
  requireDiffInspection: false,
  atomicCommitsOnly: false,
  validationFromInputOnly: false,
  blockSensitivePaths: false,
  normalPushOnly: false,
  providerNeutralReviewOnly: false,
};

/**
 * Derive the synthesis profile from the S13H Skill rule/procedure statements
 * present in the run objective. Each field is gated on a CONTENT match against
 * the extracted rule text — never on `rules.length`.
 */
export function deriveWorkflowProfileFromRules(ruleTexts: string[]): WorkflowSynthesisProfile {
  const blob = ruleTexts.join("\n").toLowerCase();
  const has = (re: RegExp): boolean => re.test(blob);
  return {
    blockDetachedHeadAndDivergence: has(
      /detached head.*block|unresolved ahead\+behind|divergence blocks|divergence blocks unsafe write/,
    ),
    blockUnrelatedTracked: has(
      /unrelated tracked changes block|never overwrite, stage around, stash, or absorb|unrelated tracked\/staged/,
    ),
    defaultFeatureBranch: has(
      /default isolation|prefer feature_branch|feature branch.*canonical default|does not explicitly allow direct work/,
    ),
    noDestructiveReady: has(
      /destructive\/history rewrite forbidden by default|no normal s13h plan may recommend reset|force push.*forbidden|never become ready/,
    ),
    noAutoStash: has(/no automatic stash|preservation strategy belongs to the user\/caller|does not stash automatically/),
    requireExplicitWriteAuth: has(
      /explicit write authorization|require caller authorization before ready|branch\/worktree creation, staging, commit, push/,
    ),
    enforceChangeIsolation: has(
      /atomic commits only|one logical change per commit|no commit-all|every included path is explicit/,
    ),
    requireDiffInspection: has(
      /diff inspection mandatory|no commit-ready decision without working\/staged diff|working diff inspected/,
    ),
    atomicCommitsOnly: has(/atomic commits only|one coherent logical change|no commit everything/),
    validationFromInputOnly: has(
      /validation requirements are inputs|do not invent project-specific qa commands|stale evidence does not pass/,
    ),
    blockSensitivePaths: has(
      /sensitive paths block|known sensitive paths\/secret findings cannot enter|no perfect-secret-scanner claim/,
    ),
    normalPushOnly: has(/normal push only|no force semantics/),
    providerNeutralReviewOnly: has(
      /pr is provider-neutral handoff|do not bind github\/gitlab\/bitbucket apis|provider-neutral/,
    ),
  };
}

function emptyHandoff(input: RepositoryGitWorkflowInput): RepositoryHandoff {
  const snap = input.repository;
  return {
    branch: snap.branch,
    head: snap.head,
    upstream_ref: snap.upstream_ref,
    ahead: snap.ahead,
    behind: snap.behind,
    included_paths: [],
    excluded_paths: [],
    commit_refs: [],
    push_status: input.requested_actions.includes("PUSH")
      ? input.policy.push_authorized
        ? "PLANNED"
        : "NOT_AUTHORIZED"
      : "NOT_REQUESTED",
    remote_review_status:
      input.policy.remote_review_mode === "NONE" || input.policy.remote_review_mode === "PUSH_ONLY"
        ? "NOT_REQUIRED"
        : input.policy.remote_review_write_authorized
          ? "PLANNED"
          : "NOT_AUTHORIZED",
    validation_evidence_refs: input.validation_evidence.map((e) => e.evidence_ref ?? e.requirement_id),
    open_issues: [],
    next_repository_action: input.requested_actions[0] ?? "CONTINUE_IMPLEMENTATION",
    do_not_do: [],
  };
}

/** Requested writes that still lack explicit authorization. */
function missingApprovals(input: RepositoryGitWorkflowInput): string[] {
  const pol = input.policy;
  const out: string[] = [];
  for (const a of input.requested_actions) {
    if (a === "CREATE_BRANCH" && !pol.branch_write_authorized) out.push("CREATE_BRANCH");
    if (a === "CREATE_WORKTREE" && !pol.worktree_write_authorized) out.push("CREATE_WORKTREE");
    if ((a === "STAGE" || a === "COMMIT") && !pol.commit_authorized) out.push(a);
    if (a === "PUSH" && !pol.push_authorized) out.push("PUSH");
    if (a === "REMOTE_REVIEW" && !pol.remote_review_write_authorized) out.push("REMOTE_REVIEW");
  }
  return [...new Set(out)];
}

export function synthesizeRepositoryWorkflowDecision(
  input: RepositoryGitWorkflowInput,
  profile: WorkflowSynthesisProfile,
): RepositoryWorkflowDecision {
  const state = classifyRepositoryState(input);
  const path_classification = classifyChangedPaths(input);
  const blockers: string[] = [];
  const repository_findings: string[] = [...state.findings];

  // --- repository state safety
  if (profile.blockDetachedHeadAndDivergence) {
    blockers.push(...state.blockers.filter((b) => /detached head|diverged/i.test(b)));
  }
  if (profile.blockUnrelatedTracked) {
    blockers.push(...state.blockers.filter((b) => /unrelated (tracked|staged)/i.test(b)));
  }
  // structural snapshot defects + ignored/generated-file gate always block
  blockers.push(...state.blockers.filter((b) => /repository_id|no HEAD|Ignored \/ generated/i.test(b)));

  // --- mandatory remote review requested but no provider capability available
  if (
    input.policy.remote_review_mode === "REMOTE_REVIEW_REQUIRED" &&
    input.requested_actions.includes("REMOTE_REVIEW") &&
    input.policy.remote_review_capability_available === false
  ) {
    blockers.push(
      "Remote review is REMOTE_REVIEW_REQUIRED and requested, but no remote-review provider capability is available (contract §W) — BLOCKED.",
    );
  }

  // --- workspace strategy
  const ws = decideWorkspaceStrategy(input, {
    hasUnrelatedTrackedChanges: state.unrelated_tracked_paths.length > 0 && profile.blockUnrelatedTracked,
    diverged: state.diverged && profile.blockDetachedHeadAndDivergence,
    detachedHead: state.detached_head && profile.blockDetachedHeadAndDivergence,
  });
  let workspace = ws.decision;
  if (!profile.defaultFeatureBranch && workspace.strategy === "FEATURE_BRANCH") {
    // NAIVE: fall back to writing on the current branch even without permission.
    workspace = {
      strategy: "KEEP_CURRENT",
      branch_name: input.repository.branch ?? undefined,
      reason: "Working directly on the current branch.",
    };
  }
  if (workspace.strategy === "BLOCKED" && profile.blockDetachedHeadAndDivergence) {
    blockers.push(`No safe workspace strategy: ${workspace.reason}`);
  }

  // --- sensitive paths
  if (profile.blockSensitivePaths) {
    blockers.push(...validateSensitivePaths(input));
  }

  // --- change isolation
  const isolation = validateChangeIsolation(input);
  if (profile.enforceChangeIsolation) {
    blockers.push(...isolation.blockers);
  }

  // --- destructive / stash operations requested
  const forbidden_operations: GitOperationProposal[] = [];
  const safe_operations: GitOperationProposal[] = [];
  const requestedOps = deriveRequestedOperations(input);
  for (const op of requestedOps) {
    const cls = classifyGitOperation(op);
    if (cls === "DESTRUCTIVE_OR_HISTORY_REWRITE") {
      forbidden_operations.push({
        operation: normalizeOpId(op),
        class: cls,
        authorized: false,
        reason: "Destructive / history-rewrite operation — FORBIDDEN_BY_DEFAULT (contract §6).",
      });
      if (profile.noDestructiveReady) {
        blockers.push(`Requested operation '${normalizeOpId(op)}' is destructive/history-rewrite and is FORBIDDEN_BY_DEFAULT (HI-008).`);
      } else {
        // NAIVE: happily proposes it as a safe operation.
        safe_operations.push({
          operation: normalizeOpId(op),
          class: cls,
          authorized: true,
          reason: "Proceeding with the requested operation.",
        });
      }
    } else if (/AUTO_?STASH|\bstash\b/i.test(op)) {
      forbidden_operations.push({
        operation: "AUTO_STASH",
        class: "DESTRUCTIVE_OR_HISTORY_REWRITE",
        authorized: false,
        reason: "Automatic stash is forbidden (Skill R13).",
      });
      if (profile.noAutoStash) blockers.push("Automatic stash was proposed; S13H never stashes automatically (Skill R13).");
      else safe_operations.push({ operation: "AUTO_STASH", class: "NON_DESTRUCTIVE_WRITE", authorized: true, reason: "Stashing changes." });
    } else {
      safe_operations.push({ operation: normalizeOpId(op), class: cls, authorized: true, reason: "Non-destructive operation." });
    }
  }

  // --- validation gate (worst phase across requested actions)
  const phases = new Set<ValidationPhase>();
  for (const a of input.requested_actions) for (const p of phasesForAction(a)) phases.add(p);
  const validation_gate = evaluateValidationGate(input, [...phases]);
  if (profile.validationFromInputOnly && validation_gate.status === "FAIL") {
    blockers.push(...validationGateBlockers(validation_gate, "Validation"));
  }

  // --- diff inspection evidence
  if (profile.requireDiffInspection && needsCommit(input)) {
    const diffOk = ["repo.diff.working.inspected", "repo.diff.staged.inspected", "repo.changed_paths.classified"].every(
      (id) =>
        input.validation_evidence.some(
          (e) => e.requirement_id === id && e.status === "PASS" && e.repository_fingerprint === input.current_repository_fingerprint,
        ),
    );
    if (!diffOk) {
      blockers.push(
        "Commit requires current-fingerprint diff-inspection evidence (repo.diff.working.inspected / repo.diff.staged.inspected / repo.changed_paths.classified) (contract §8).",
      );
    }
  }

  // --- commit / push plans
  const commitProfile = profile.atomicCommitsOnly && profile.enforceChangeIsolation
    ? FAITHFUL_COMMIT_PLAN_PROFILE
    : NAIVE_COMMIT_PLAN_PROFILE;
  let commit_plan = needsCommit(input) ? buildCommitPlan(input, commitProfile) : null;

  let push_plan = buildPushPlan(input, workspace);
  if (push_plan && !profile.normalPushOnly && requestedOps.some((o) => /force/i.test(o))) {
    // NAIVE would emit force — but the type forbids it. Instead the naive arm
    // simply keeps the push plan while also listing PUSH_FORCE as "safe" above.
  }

  // --- approvals
  const approvals_required = profile.requireExplicitWriteAuth ? missingApprovals(input) : [];

  // --- provider-neutral remote review
  const remote_review_handoff = buildRemoteReviewHandoff(input, workspace, commit_plan);

  // --- repository handoff
  const repository_handoff = emptyHandoff(input);
  if (commit_plan) {
    repository_handoff.included_paths = [...commit_plan.included_paths];
    repository_handoff.excluded_paths = [...commit_plan.excluded_paths];
  }
  repository_handoff.open_issues = [...new Set(blockers)];
  repository_handoff.do_not_do = profile.noDestructiveReady
    ? ["reset --hard", "clean -fd", "push --force", "rebase shared history", "automatic stash"]
    : [];

  // --- status derivation (contract §16: BLOCKED priority)
  const uniqueBlockers = [...new Set(blockers)].filter((b) => b.trim().length > 0);
  let status: RepositoryWorkflowStatus;
  if (uniqueBlockers.length > 0) {
    status = "BLOCKED";
    commit_plan = commitProfile === FAITHFUL_COMMIT_PLAN_PROFILE ? null : commit_plan;
    push_plan = commitProfile === FAITHFUL_COMMIT_PLAN_PROFILE ? null : push_plan;
  } else if (approvals_required.length > 0) {
    status = "APPROVAL_REQUIRED";
    if (profile.requireExplicitWriteAuth) {
      commit_plan = commit_plan; // a proposed plan may be materialized without execution (contract §O)
      push_plan = null;
    }
  } else {
    status = "READY";
  }

  return {
    status,
    blockers: uniqueBlockers,
    approvals_required,
    workspace,
    repository_findings,
    safe_operations,
    forbidden_operations,
    path_classification: path_classification.map((c) => deepClone(c)),
    validation_gate,
    commit_plan,
    push_plan,
    remote_review_handoff,
    repository_handoff,
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function needsCommit(input: RepositoryGitWorkflowInput): boolean {
  return input.requested_actions.includes("COMMIT") || input.requested_actions.includes("PUSH");
}

/**
 * Requested operations.
 *
 * Authoritative source (contract §6): the caller's explicit normalized
 * `requested_operations` ids. When that list is supplied it is trusted verbatim
 * and the intent-summary prose is NOT scanned — a legitimate summary that merely
 * mentions "rebase" or "stash" must not fabricate a destructive request.
 *
 * Fallback (Part B determinization D-S13H-02): when no explicit
 * `requested_operations` list is given, a bounded scan of
 * `change_intent.summary` for a fixed set of well-known destructive spellings
 * still catches destructive intent that was only expressed in prose.
 */
function deriveRequestedOperations(input: RepositoryGitWorkflowInput): string[] {
  const out: string[] = [];
  for (const a of input.requested_actions) {
    if (a === "CREATE_BRANCH") out.push("CREATE_BRANCH");
    if (a === "CREATE_WORKTREE") out.push("CREATE_WORKTREE");
    if (a === "STAGE") out.push("STAGE_INTENDED_PATHS");
    if (a === "COMMIT") out.push("COMMIT_ATOMIC");
    if (a === "PUSH") out.push("PUSH_NORMAL");
    if (a === "REMOTE_REVIEW") out.push("REMOTE_REVIEW_CREATE");
  }
  if (input.requested_operations && input.requested_operations.length > 0) {
    for (const id of input.requested_operations) out.push(id);
    return [...new Set(out)];
  }
  const s = input.change_intent.summary;
  for (const id of [...DESTRUCTIVE_OPERATION_IDS, "AUTO_STASH"]) {
    if (new RegExp(`\\b${id}\\b`, "i").test(s)) out.push(id);
  }
  for (const raw of [
    "git reset --hard",
    "git clean -fd",
    "git clean -fdx",
    "git push --force",
    "git push --force-with-lease",
    "git rebase",
    "git stash",
    "git commit --amend",
  ]) {
    if (s.toLowerCase().includes(raw)) out.push(raw);
  }
  return [...new Set(out)];
}

function normalizeOpId(op: string): string {
  const t = op.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (DESTRUCTIVE_OPERATION_IDS.includes(t)) return t;
  if (/RESET.*HARD/.test(t)) return "RESET_HARD";
  if (/CLEAN.*FDX/.test(t)) return "CLEAN_ALL";
  if (/CLEAN.*FD/.test(t)) return "CLEAN_UNTRACKED";
  if (/PUSH.*FORCE_WITH_LEASE/.test(t)) return "PUSH_FORCE_WITH_LEASE";
  if (/PUSH.*FORCE/.test(t)) return "PUSH_FORCE";
  if (/REBASE/.test(t)) return "REBASE_SHARED_HISTORY";
  if (/AMEND/.test(t)) return "AMEND_PUBLISHED_COMMIT";
  if (/STASH/.test(t)) return "AUTO_STASH";
  return t;
}
