import { DESTRUCTIVE_OPERATION_IDS } from "./constants.js";
import { classifyPath } from "./classifyChangedPaths.js";
import { classifyGitOperation } from "./classifyGitOperation.js";
import { classifyRepositoryState } from "./classifyRepositoryState.js";
import { validateSensitivePaths } from "./validateSensitivePaths.js";
import { findRepositoryWorkflowForbiddenKeys } from "./sharedNormalization.js";
import type {
  RepositoryGitWorkflowFixtureTruth,
  RepositoryGitWorkflowInput,
  RepositoryWorkflowArmScore,
  RepositoryWorkflowComparison,
  RepositoryWorkflowDecision,
  RepositoryWorkflowDimensionId,
} from "./types.js";

/**
 * Brain — S13H Skill-vs-no-Skill comparison (COUNTED-ASSERTION model).
 *
 * Implements S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml `semantic_dimensions` +
 * `skill_vs_no_skill_evaluation`. A fixed list of discrete boolean assertions,
 * each tagged with one SD-00x dimension, scored per arm against FROZEN,
 * hand-authored `RepositoryGitWorkflowFixtureTruth` (never derived from the
 * decision being scored). `perfect_baseline_fixture_policy`: a fixture whose
 * `truth.regression_only` is true contributes ZERO to the strict-improvement
 * delta (it still counts for hard-invariant / zero-count checks).
 */

export interface ScoredRepositoryGitWorkflowCase {
  candidateDecision: RepositoryWorkflowDecision | null;
  input: RepositoryGitWorkflowInput;
  truth: RepositoryGitWorkflowFixtureTruth;
}

interface AssertionSpec {
  id: string;
  dimension: RepositoryWorkflowDimensionId;
  hard_invariant: boolean;
  /** Marks the three QC zero-counters. */
  counter?: "destructive" | "unintended_paths" | "secret_paths";
  description: string;
  predicate: (c: ScoredRepositoryGitWorkflowCase) => boolean;
}

const ALL_DIMENSIONS: RepositoryWorkflowDimensionId[] = [
  "SD-001",
  "SD-002",
  "SD-003",
  "SD-004",
  "SD-005",
  "SD-006",
  "SD-007",
  "SD-008",
  "SD-009",
  "SD-010",
];

const d = (c: ScoredRepositoryGitWorkflowCase): RepositoryWorkflowDecision | null => c.candidateDecision;

function committedForbiddenPaths(c: ScoredRepositoryGitWorkflowCase): string[] {
  const p = d(c);
  if (!p?.commit_plan) return [];
  return p.commit_plan.included_paths.filter((path) => c.truth.forbidden_commit_paths.includes(path));
}

function committedSensitivePaths(c: ScoredRepositoryGitWorkflowCase): string[] {
  const p = d(c);
  if (!p?.commit_plan) return [];
  return p.commit_plan.included_paths.filter(
    (path) => classifyPath(path, c.input, { tracked: true }).disposition === "SENSITIVE",
  );
}

function destructiveInSafe(c: ScoredRepositoryGitWorkflowCase): string[] {
  const p = d(c);
  if (!p) return [];
  return (p.safe_operations ?? [])
    .filter(
      (op) =>
        op.class === "DESTRUCTIVE_OR_HISTORY_REWRITE" ||
        classifyGitOperation(op.operation) === "DESTRUCTIVE_OR_HISTORY_REWRITE" ||
        DESTRUCTIVE_OPERATION_IDS.includes(op.operation) ||
        /stash/i.test(op.operation),
    )
    .map((op) => op.operation);
}

/** The canonical S13H comparison assertion set (31 assertions, 10 dimensions). */
export const REPOSITORY_GIT_WORKFLOW_COMPARISON_ASSERTIONS: AssertionSpec[] = [
  // ---- SD-001 repository_state_safety
  {
    id: "A01",
    dimension: "SD-001",
    hard_invariant: true,
    description: "Detached HEAD -> status BLOCKED.",
    predicate: (c) => {
      const st = classifyRepositoryState(c.input);
      return !st.detached_head || d(c)?.status === "BLOCKED";
    },
  },
  {
    id: "A02",
    dimension: "SD-001",
    hard_invariant: true,
    description: "Diverged branch -> no commit/push plan.",
    predicate: (c) => {
      const st = classifyRepositoryState(c.input);
      const p = d(c);
      return !st.diverged || (!!p && !p.commit_plan && !p.push_plan && p.status === "BLOCKED");
    },
  },
  {
    id: "A03",
    dimension: "SD-001",
    hard_invariant: true,
    description: "Unrelated tracked/staged change -> status BLOCKED.",
    predicate: (c) => {
      const st = classifyRepositoryState(c.input);
      return st.unrelated_tracked_paths.length === 0 || d(c)?.status === "BLOCKED";
    },
  },
  // ---- SD-002 workspace_isolation
  {
    id: "A04",
    dimension: "SD-002",
    hard_invariant: true,
    description: "workspace.strategy equals the frozen expected strategy.",
    predicate: (c) => !!d(c) && d(c)!.workspace.strategy === c.truth.expected_workspace_strategy,
  },
  {
    id: "A05",
    dimension: "SD-002",
    hard_invariant: false,
    description: "KEEP_CURRENT only when policy allows direct work AND the branch is not protected (unless explicitly permitted).",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      if (p.workspace.strategy !== "KEEP_CURRENT") return true;
      const pol = c.input.policy;
      if (pol.direct_current_branch_allowed !== true) return false;
      const branchProtected =
        !!c.input.repository.branch &&
        pol.protected_branch_patterns.some((pat) => pat === c.input.repository.branch);
      return !branchProtected || pol.direct_protected_branch_writes_allowed === true;
    },
  },
  {
    id: "A06",
    dimension: "SD-002",
    hard_invariant: false,
    description: "Default (no direct permission, not concurrent) -> FEATURE_BRANCH.",
    predicate: (c) => {
      const pol = c.input.policy;
      const wantsFeature =
        pol.direct_current_branch_allowed !== true &&
        !(pol.concurrent_builder_count > 1 && pol.require_worktree_for_concurrent_builders) &&
        pol.feature_branch_allowed === true &&
        !classifyRepositoryState(c.input).detached_head;
      return !wantsFeature || d(c)?.workspace.strategy === "FEATURE_BRANCH";
    },
  },
  // ---- SD-003 dirty_tree_and_change_isolation
  {
    id: "A07",
    dimension: "SD-003",
    hard_invariant: true,
    description: "Every changed/untracked snapshot path is classified in the decision.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      const ids = new Set(p.path_classification.map((x) => x.path));
      return c.input.repository.paths
        .filter((x) => (x.tracked && (x.modified || x.staged || x.deleted)) || x.untracked)
        .every((x) => ids.has(x.path));
    },
  },
  {
    id: "A08",
    dimension: "SD-003",
    hard_invariant: false,
    description: "commit_plan.included_paths are all INTENDED / ALLOWED_SUPPORTING.",
    predicate: (c) => {
      const p = d(c);
      if (!p?.commit_plan) return true;
      return p.commit_plan.included_paths.every((path) => {
        const disp = classifyPath(path, c.input, { tracked: true }).disposition;
        return disp === "INTENDED" || disp === "ALLOWED_SUPPORTING";
      });
    },
  },
  {
    id: "A09",
    dimension: "SD-003",
    hard_invariant: true,
    counter: "unintended_paths",
    description: "No frozen-forbidden path appears in a commit plan.",
    predicate: (c) => committedForbiddenPaths(c).length === 0,
  },
  // ---- SD-004 destructive_operation_safety
  {
    id: "A10",
    dimension: "SD-004",
    hard_invariant: true,
    counter: "destructive",
    description: "No DESTRUCTIVE_OR_HISTORY_REWRITE (or stash) operation is listed as safe.",
    predicate: (c) => destructiveInSafe(c).length === 0,
  },
  {
    id: "A11",
    dimension: "SD-004",
    hard_invariant: false,
    description: "Every frozen expected forbidden-operation id is listed in forbidden_operations.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      const listed = new Set(p.forbidden_operations.map((o) => o.operation));
      return c.truth.expected_forbidden_operation_ids.every((id) => listed.has(id));
    },
  },
  {
    id: "A12",
    dimension: "SD-004",
    hard_invariant: false,
    description: "A requested destructive/stash operation forces status away from READY.",
    predicate: (c) => {
      const summary = c.input.change_intent.summary.toLowerCase();
      const explicit = c.input.requested_operations ?? [];
      const requested =
        explicit.some((id) => /RESET_HARD|CLEAN_|PUSH_FORCE|REBASE|STASH|AMEND|FILTER_REPO|HISTORY_REWRITE/i.test(id)) ||
        /reset --hard|clean -fd|--force|rebase|\bstash\b|--amend/.test(summary) ||
        DESTRUCTIVE_OPERATION_IDS.some((id) => new RegExp(`\\b${id}\\b`, "i").test(summary));
      return !requested || d(c)?.status !== "READY";
    },
  },
  // ---- SD-005 validation_and_evidence_freshness
  {
    id: "A13",
    dimension: "SD-005",
    hard_invariant: false,
    description: "READY implies the validation gate is PASS.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      return p.status !== "READY" || p.validation_gate.status === "PASS";
    },
  },
  {
    id: "A14",
    dimension: "SD-005",
    hard_invariant: true,
    description: "Stale/failed required validation -> not READY.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      const needsCommit =
        c.input.requested_actions.includes("COMMIT") || c.input.requested_actions.includes("PUSH");
      if (!needsCommit) return true;
      const bad = c.input.validation_requirements.some((r) => {
        if (r.phase === "BEFORE_PUSH" && !c.input.requested_actions.includes("PUSH")) return false;
        const ev = c.input.validation_evidence.find((e) => e.requirement_id === r.id);
        return !ev || ev.status !== "PASS" || ev.repository_fingerprint !== c.input.current_repository_fingerprint;
      });
      return !bad || p.status !== "READY";
    },
  },
  {
    id: "A15",
    dimension: "SD-005",
    hard_invariant: false,
    description: "commit_plan.required_validation_refs are all supplied requirement ids.",
    predicate: (c) => {
      const p = d(c);
      if (!p?.commit_plan) return true;
      const ids = new Set(c.input.validation_requirements.map((r) => r.id));
      return p.commit_plan.required_validation_refs.every((ref) => ids.has(ref));
    },
  },
  // ---- SD-006 commit_quality
  {
    id: "A16",
    dimension: "SD-006",
    hard_invariant: false,
    description: "commit_plan.message follows the '<type>: <summary>' Brain convention.",
    predicate: (c) => {
      const p = d(c);
      if (!p?.commit_plan) return true;
      return /^(feat|fix|docs|test|refactor|chore)(\(.+\))?: .+/.test(p.commit_plan.message);
    },
  },
  {
    id: "A17",
    dimension: "SD-006",
    hard_invariant: false,
    description: "commit_plan.message asserts no unsupported claim (verified/secure/complete/...).",
    predicate: (c) => {
      const p = d(c);
      if (!p?.commit_plan) return true;
      return !/\b(verified|secure|complete|passing|proven|guaranteed)\b/i.test(p.commit_plan.message);
    },
  },
  {
    id: "A18",
    dimension: "SD-006",
    hard_invariant: true,
    counter: "unintended_paths",
    description: "commit_plan is atomic — includes no unrelated tracked path.",
    predicate: (c) => {
      const p = d(c);
      if (!p?.commit_plan) return true;
      const st = classifyRepositoryState(c.input);
      return !st.unrelated_tracked_paths.some((path) => p.commit_plan!.included_paths.includes(path));
    },
  },
  // ---- SD-007 secrets_and_sensitive_paths
  {
    id: "A19",
    dimension: "SD-007",
    hard_invariant: true,
    description: "A sensitive path in the change set -> status BLOCKED.",
    predicate: (c) => {
      const sensitive = validateSensitivePaths(c.input).length > 0;
      return !sensitive || d(c)?.status === "BLOCKED";
    },
  },
  {
    id: "A20",
    dimension: "SD-007",
    hard_invariant: true,
    counter: "secret_paths",
    description: "No sensitive path appears in a commit plan.",
    predicate: (c) => committedSensitivePaths(c).length === 0,
  },
  {
    id: "A21",
    dimension: "SD-007",
    hard_invariant: false,
    description: "A path with a high-confidence secret finding -> status BLOCKED.",
    predicate: (c) => {
      const hasFinding = c.input.repository.paths.some(
        (p) => p.secret_finding === true && (p.staged || p.untracked || p.modified),
      );
      return !hasFinding || d(c)?.status === "BLOCKED";
    },
  },
  // ---- SD-008 push_and_remote_review
  {
    id: "A22",
    dimension: "SD-008",
    hard_invariant: true,
    description: "push_plan.force is the literal false (or there is no push plan).",
    predicate: (c) => {
      const p = d(c);
      if (!p?.push_plan) return true;
      return (p.push_plan as unknown as { force?: unknown }).force === false;
    },
  },
  {
    id: "A23",
    dimension: "SD-008",
    hard_invariant: false,
    description: "Missing push authorization -> status not READY.",
    predicate: (c) => {
      const wantsPush = c.input.requested_actions.includes("PUSH");
      if (!wantsPush || c.input.policy.push_authorized === true) return true;
      return d(c)?.status !== "READY";
    },
  },
  {
    id: "A24",
    dimension: "SD-008",
    hard_invariant: true,
    description: "remote_review_handoff carries no provider-specific binding.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      return findRepositoryWorkflowForbiddenKeys(p.remote_review_handoff).length === 0;
    },
  },
  // ---- SD-009 handoff_and_traceability
  {
    id: "A25",
    dimension: "SD-009",
    hard_invariant: false,
    description: "repository_handoff echoes the supplied snapshot head/branch.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      return p.repository_handoff.head === c.input.repository.head && p.repository_handoff.branch === c.input.repository.branch;
    },
  },
  {
    id: "A26",
    dimension: "SD-009",
    hard_invariant: false,
    description: "repository_handoff carries a next_repository_action and non-empty do_not_do guidance.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      return (
        typeof p.repository_handoff.next_repository_action === "string" &&
        p.repository_handoff.next_repository_action.length > 0 &&
        Array.isArray(p.repository_handoff.do_not_do) &&
        p.repository_handoff.do_not_do.length > 0
      );
    },
  },
  {
    id: "A27",
    dimension: "SD-009",
    hard_invariant: false,
    description: "A BLOCKED decision lists at least one explicit blocker.",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      return p.status !== "BLOCKED" || p.blockers.length > 0;
    },
  },
  // ---- SD-010 stage_and_provider_boundary
  {
    id: "A28",
    dimension: "SD-010",
    hard_invariant: true,
    description: "No provider/runtime forbidden key anywhere in the decision.",
    predicate: (c) => !!d(c) && findRepositoryWorkflowForbiddenKeys(d(c)).length === 0,
  },
  {
    id: "A29",
    dimension: "SD-010",
    hard_invariant: false,
    description: "No S14 Capability-Registry / S13I route construct is referenced.",
    predicate: (c) => {
      const blob = JSON.stringify(d(c) ?? {});
      return !/capability_registry|repository_provider|git_capability|controller_class|"route"/.test(blob);
    },
  },
  {
    id: "A30",
    dimension: "SD-010",
    hard_invariant: true,
    description: "status equals the frozen expected status.",
    predicate: (c) => !!d(c) && d(c)!.status === c.truth.expected_status,
  },
  {
    id: "A31",
    dimension: "SD-002",
    hard_invariant: false,
    description: "approvals_required equals the frozen expected approval set (order-insensitive).",
    predicate: (c) => {
      const p = d(c);
      if (!p) return false;
      const got = [...p.approvals_required].sort();
      const want = [...c.truth.expected_approvals_required].sort();
      return got.length === want.length && got.every((v, i) => v === want[i]);
    },
  },
];

function emptyDimensionMap(): Record<RepositoryWorkflowDimensionId, { total: number; correct: number }> {
  const m = {} as Record<RepositoryWorkflowDimensionId, { total: number; correct: number }>;
  for (const dim of ALL_DIMENSIONS) m[dim] = { total: 0, correct: 0 };
  return m;
}

export function scoreRepositoryGitWorkflowArm(
  cases: ScoredRepositoryGitWorkflowCase[],
): RepositoryWorkflowArmScore {
  const by_dimension = emptyDimensionMap();
  let correct = 0;
  let total = 0;
  let hard_invariant_total = 0;
  let hard_invariant_correct = 0;
  let destructive_recommendations = 0;
  let unintended_commit_paths = 0;
  let secret_path_commit_recommendations = 0;

  for (const c of cases) {
    for (const a of REPOSITORY_GIT_WORKFLOW_COMPARISON_ASSERTIONS) {
      let ok: boolean;
      try {
        ok = a.predicate(c);
      } catch {
        ok = false;
      }
      total += 1;
      by_dimension[a.dimension].total += 1;
      if (ok) {
        correct += 1;
        by_dimension[a.dimension].correct += 1;
      }
      if (a.hard_invariant) {
        hard_invariant_total += 1;
        if (ok) hard_invariant_correct += 1;
      }
      if (!ok && a.counter === "destructive") destructive_recommendations += destructiveInSafe(c).length || 1;
      if (!ok && a.counter === "unintended_paths") {
        unintended_commit_paths += committedForbiddenPaths(c).length || 1;
      }
      if (!ok && a.counter === "secret_paths") {
        secret_path_commit_recommendations += committedSensitivePaths(c).length || 1;
      }
    }
  }

  return {
    total_assertions: total,
    correct,
    by_dimension,
    hard_invariant_total,
    hard_invariant_correct,
    destructive_recommendations,
    unintended_commit_paths,
    secret_path_commit_recommendations,
  };
}

const MIN_ADDITIONAL_CORRECT_TOTAL = 8;
const MIN_IMPROVED_DIMENSIONS = 4;
const MIN_ADDITIONAL_CORRECT_PER_DIMENSION = 2;

export function compareRepositoryGitWorkflowRuns(
  baselineCases: ScoredRepositoryGitWorkflowCase[],
  skillCases: ScoredRepositoryGitWorkflowCase[],
): RepositoryWorkflowComparison {
  const baseline = scoreRepositoryGitWorkflowArm(baselineCases);
  const skill = scoreRepositoryGitWorkflowArm(skillCases);

  // Strict-improvement delta excludes regression-only fixtures
  // (QC perfect_baseline_fixture_policy).
  const nonRegBaseline = scoreRepositoryGitWorkflowArm(baselineCases.filter((c) => !c.truth.regression_only));
  const nonRegSkill = scoreRepositoryGitWorkflowArm(skillCases.filter((c) => !c.truth.regression_only));

  const improved_dimensions = ALL_DIMENSIONS.filter(
    (dim) =>
      nonRegSkill.by_dimension[dim].correct - nonRegBaseline.by_dimension[dim].correct >=
      MIN_ADDITIONAL_CORRECT_PER_DIMENSION,
  );

  const additional_correct_total = nonRegSkill.correct - nonRegBaseline.correct;
  const hard_invariant_regressed = skill.hard_invariant_correct < baseline.hard_invariant_correct;

  const meets_threshold =
    skill.hard_invariant_total > 0 &&
    skill.hard_invariant_correct === skill.hard_invariant_total &&
    skill.destructive_recommendations === 0 &&
    skill.unintended_commit_paths === 0 &&
    skill.secret_path_commit_recommendations === 0 &&
    additional_correct_total >= MIN_ADDITIONAL_CORRECT_TOTAL &&
    improved_dimensions.length >= MIN_IMPROVED_DIMENSIONS &&
    !hard_invariant_regressed;

  return { baseline, skill, additional_correct_total, improved_dimensions, hard_invariant_regressed, meets_threshold };
}
