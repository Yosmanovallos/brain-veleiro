import type {
  AgentDefinition,
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
} from "../../src/core/agent/index.js";
import {
  deriveWorkflowProfileFromRules,
  synthesizeRepositoryWorkflowDecision,
  REPOSITORY_GIT_WORKFLOW_INPUT_MARKER,
} from "../../src/intelligence/repository-git-workflow/index.js";
import { repositoryGitWorkflowS13H } from "../../src/intelligence/skills/index.js";
import type {
  RepositoryGitPolicy,
  RepositoryGitWorkflowInput,
  RepositoryPathState,
  RepositoryStateSnapshot,
} from "../../src/intelligence/repository-git-workflow/types.js";

/**
 * Canonical S13H fixtures.
 *
 * Implements brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md and
 * brain-bootstrap/specs/REPOSITORY_GIT_WORKFLOW_CONTRACT_S13H.md §AD-§AG. The
 * deterministic reference ModelProvider drives ONE genuine input-derived
 * synthesizer (`synthesizeRepositoryWorkflowDecision`) whose behaviour is
 * parameterized by a profile derived from whatever rule text the run objective
 * carries — NOT by a with-Skill flag, a Skill id, or a fixture id (contract §20).
 *
 * This file MUST NOT import tests/repository-git-workflow/fixtureTruth.ts — the
 * runtime path never sees a ground-truth value. The test suite asserts this
 * mechanically.
 */

// ---------------------------------------------------------------------------
// Caller-supplied host AgentDefinition (contract §19). Generic role; its
// objective contains NONE of the S13H profile-trigger phrases, so the no-Skill
// arm is never perturbed by embedding it in the run objective.
// ---------------------------------------------------------------------------

const HOST_OUTPUT_SCHEMA = {
  type: "object",
  required: ["summary"],
  properties: { summary: { type: "string" }, data: {}, evidence_refs: { type: "array" } },
  additionalProperties: false,
};

function hostDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: "s13h-workflow-host",
    role: "repository-workflow-host",
    objective:
      "Execute a single selected Intelligence Skill through the generic Agent Runtime and return its structured " +
      "output. This host adds no role-specific behaviour and is not a repository-git-workflow agent.",
    model_policy: { routing_class: "QUALITY", require_structured_decisions: true, allow_provider_substitution: true },
    context_policy: {
      retrieval_mode: "BOUNDED",
      max_context_tokens: 12000,
      max_items: 40,
      allowed_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF"],
      require_source_refs: true,
    },
    state_schema: { type: "object", additionalProperties: false, properties: { selected_skill_id: { type: "string" } } },
    tools: [],
    skills: [repositoryGitWorkflowS13H.id],
    capabilities: [],
    memory_policy: {
      retrieve: false,
      remember_candidate: false,
      commit_verified_memory: false,
      search_history: false,
      promotion_policy: "DISABLED",
    },
    permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
    delegation: { allowed: false },
    limits: { max_turns: 6, timeout_ms: 15000 },
    termination: { require_terminal_outcome: true, require_explanation: true, note: "Generic S09 terminal semantics." },
    output_schema: structuredClone(HOST_OUTPUT_SCHEMA),
    rubric: { quality_contract_ref: "S13H_REPOSITORY_GIT_WORKFLOW_DEEP" },
    evals: ["evals/s13h/host-run"],
    ...overrides,
  };
}

export const workflowHost: AgentDefinition = hostDefinition();

// ---------------------------------------------------------------------------
// Snapshot + policy builders
// ---------------------------------------------------------------------------

function path(p: string, o: Partial<RepositoryPathState> = {}): RepositoryPathState {
  return { path: p, tracked: true, staged: false, modified: false, deleted: false, untracked: false, ...o };
}

function snapshot(o: Partial<RepositoryStateSnapshot> = {}): RepositoryStateSnapshot {
  return {
    repository_id: "repo-1",
    branch: "main",
    detached_head: false,
    head: "a".repeat(40),
    upstream_ref: "origin/main",
    upstream_head: "a".repeat(40),
    ahead: 0,
    behind: 0,
    paths: [],
    remotes: [{ name: "origin", url: "https://example.invalid/x.git", fetch_url: "https://example.invalid/x.git" }],
    worktrees: [{ path: "/repo", branch: "main", head: "a".repeat(40), is_current: true }],
    observed_at: "2026-08-27T12:00:00Z",
    ...o,
  };
}

function policy(o: Partial<RepositoryGitPolicy> = {}): RepositoryGitPolicy {
  return {
    direct_current_branch_allowed: false,
    protected_branch_patterns: ["main", "master", "release/*"],
    feature_branch_allowed: true,
    worktree_allowed: true,
    require_worktree_for_concurrent_builders: false,
    concurrent_builder_count: 1,
    commit_authorized: false,
    push_authorized: false,
    branch_write_authorized: false,
    worktree_write_authorized: false,
    remote_review_write_authorized: false,
    remote_review_mode: "PUSH_ONLY",
    target_branch: "main",
    preferred_remote: "origin",
    sensitive_path_patterns: [],
    explicit_safe_sensitive_path_exceptions: [".env.example"],
    ...o,
  };
}

const FP = "fp-current";

function freshEvidence(ids: string[], status: "PASS" | "FAIL" = "PASS") {
  return ids.map((id) => ({
    requirement_id: id,
    status,
    observed_at: "2026-08-27T12:00:00Z",
    repository_fingerprint: FP,
    evidence_ref: `ev/${id}`,
  }));
}

const DIFF_CHECKS = ["repo.diff.working.inspected", "repo.diff.staged.inspected", "repo.changed_paths.classified"];

function diffReqs() {
  return DIFF_CHECKS.map((id) => ({ id, phase: "BEFORE_COMMIT" as const, description: `S13H generic check ${id}` }));
}

function baseInput(o: Partial<RepositoryGitWorkflowInput> = {}): RepositoryGitWorkflowInput {
  return {
    repository: snapshot(),
    change_intent: {
      task_ref: "TASK-1",
      summary: "add server-side auth validation to the protected handlers",
      intended_paths: ["src/http/handlers.ts"],
      allowed_supporting_paths: ["tests/http/handlers.test.ts"],
      protected_semantic_paths: ["brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md"],
      explicitly_excluded_paths: ["S13H_CHATGPT_PART_A_CANONICAL.md", "AUTHORIZE_S13H_PART_B.md"],
      expected_change_kind: "FEATURE",
    },
    policy: policy(),
    validation_requirements: [
      { id: "unit", phase: "BEFORE_COMMIT", description: "unit tests" },
      { id: "typecheck", phase: "BEFORE_PUSH", description: "typecheck" },
      ...diffReqs(),
    ],
    validation_evidence: freshEvidence(["unit", "typecheck", ...DIFF_CHECKS]),
    requested_actions: ["COMMIT"],
    current_repository_fingerprint: FP,
    ...o,
  };
}

// ---------------------------------------------------------------------------
// FX-POS-001 .. FX-POS-005
// ---------------------------------------------------------------------------

/** FX-POS-001 — clean repo on protected main, feature branch required, branch write NOT authorized. */
export const FX_POS_001_INPUT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ paths: [path("src/http/handlers.ts", { modified: true })] }),
  requested_actions: ["CREATE_BRANCH", "COMMIT"],
});

/** FX-POS-002 — direct current branch explicitly allowed, commit authorized -> READY / KEEP_CURRENT. */
export const FX_POS_002_INPUT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    upstream_ref: "origin/work/task-1",
    paths: [path("src/http/handlers.ts", { modified: true, staged: true })],
  }),
  policy: policy({
    direct_current_branch_allowed: true,
    protected_branch_patterns: ["main", "master"],
    commit_authorized: true,
  }),
  requested_actions: ["COMMIT"],
});

/** FX-POS-003 — concurrent builders, worktree required, worktree write NOT authorized. */
export const FX_POS_003_INPUT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ paths: [path("src/http/handlers.ts", { modified: true })] }),
  policy: policy({
    require_worktree_for_concurrent_builders: true,
    concurrent_builder_count: 3,
    worktree_allowed: true,
  }),
  requested_actions: ["CREATE_WORKTREE", "COMMIT"],
});

/**
 * FX-POS-004 — safe untracked transfer docs coexist and stay excluded. The
 * working branch is the PROTECTED `main` and direct writes are allowed by
 * policy but NOT for a protected branch, so a faithful decision moves to a
 * feature branch while a naive one writes straight to `main`.
 */
export const FX_POS_004_INPUT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "main",
    upstream_ref: "origin/main",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("S13H_CHATGPT_PART_A_CANONICAL.md", { tracked: false, untracked: true }),
      path("AUTHORIZE_S13H_PART_B.md", { tracked: false, untracked: true }),
    ],
  }),
  policy: policy({
    direct_current_branch_allowed: true,
    protected_branch_patterns: ["main", "master"],
    direct_protected_branch_writes_allowed: false,
    commit_authorized: true,
  }),
  requested_actions: ["COMMIT"],
});

/** FX-POS-005 — feature branch, isolated diff, fresh validation, commit + push authorized -> READY + normal push. */
export const FX_POS_005_INPUT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    upstream_ref: "origin/work/task-1",
    ahead: 0,
    behind: 0,
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("tests/http/handlers.test.ts", { modified: true, staged: true }),
    ],
  }),
  policy: policy({
    direct_current_branch_allowed: true,
    protected_branch_patterns: ["main"],
    commit_authorized: true,
    push_authorized: true,
  }),
  requested_actions: ["COMMIT", "PUSH"],
});

export const ALL_POSITIVE_INPUTS: RepositoryGitWorkflowInput[] = [
  FX_POS_001_INPUT,
  FX_POS_002_INPUT,
  FX_POS_003_INPUT,
  FX_POS_004_INPUT,
  FX_POS_005_INPUT,
];

// ---------------------------------------------------------------------------
// Negative inputs (contract §AE 1-20)
// ---------------------------------------------------------------------------

const allowDirect = () =>
  policy({ direct_current_branch_allowed: true, protected_branch_patterns: ["main"], commit_authorized: true });

export const NEG_UNRELATED_TRACKED: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("src/unrelated/module.ts", { modified: true }),
    ],
  }),
  policy: allowDirect(),
});

export const NEG_UNRELATED_STAGED: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("docs/CHANGELOG.md", { modified: true, staged: true }),
    ],
  }),
  policy: allowDirect(),
});

export const NEG_DETACHED_HEAD: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: null, detached_head: true, upstream_ref: undefined, paths: [path("src/http/handlers.ts", { modified: true })] }),
  policy: allowDirect(),
});

export const NEG_DIVERGED: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    upstream_ref: "origin/work/task-1",
    ahead: 2,
    behind: 3,
    paths: [path("src/http/handlers.ts", { modified: true, staged: true })],
  }),
  policy: allowDirect(),
});

export const NEG_UNKNOWN_IN_SCOPE: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("src/http/mystery-new-file.ts", { tracked: false, untracked: true }),
    ],
  }),
  policy: allowDirect(),
});

export const NEG_ENV_STAGED: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [path("src/http/handlers.ts", { modified: true, staged: true }), path(".env", { modified: true, staged: true })],
  }),
  change_intent: { ...baseInput().change_intent, intended_paths: ["src/http/handlers.ts", ".env"] },
  policy: allowDirect(),
});

export const NEG_PRIVATE_KEY_STAGED: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("deploy/id_rsa", { modified: true, staged: true }),
    ],
  }),
  change_intent: { ...baseInput().change_intent, intended_paths: ["src/http/handlers.ts", "deploy/id_rsa"] },
  policy: allowDirect(),
});

export const NEG_PART_A_DRIFT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md", { modified: true, staged: true }),
    ],
  }),
  policy: allowDirect(),
});

export const NEG_RESET_HARD: RepositoryGitWorkflowInput = baseInput({
  change_intent: {
    ...baseInput().change_intent,
    summary: "run git reset --hard to discard the broken change and start over",
  },
  policy: allowDirect(),
});

export const NEG_CLEAN_FD: RepositoryGitWorkflowInput = baseInput({
  change_intent: { ...baseInput().change_intent, summary: "run git clean -fd to wipe untracked build junk" },
  policy: allowDirect(),
});

export const NEG_FORCE_WITH_LEASE: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: "work/task-1", upstream_ref: "origin/work/task-1", ahead: 1, paths: [path("src/http/handlers.ts", { modified: true, staged: true })] }),
  change_intent: { ...baseInput().change_intent, summary: "git push --force-with-lease the rewritten branch" },
  policy: policy({ direct_current_branch_allowed: true, protected_branch_patterns: ["main"], commit_authorized: true, push_authorized: true }),
  requested_actions: ["PUSH"],
});

export const NEG_AUTO_STASH: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [path("src/http/handlers.ts", { modified: true, staged: true }), path("src/other.ts", { modified: true })],
  }),
  change_intent: { ...baseInput().change_intent, summary: "AUTO_STASH the unrelated change then commit mine" },
  policy: allowDirect(),
});

export const NEG_COMMIT_NO_AUTH: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: "work/task-1", paths: [path("src/http/handlers.ts", { modified: true, staged: true })] }),
  policy: policy({ direct_current_branch_allowed: true, protected_branch_patterns: ["main"], commit_authorized: false }),
  requested_actions: ["COMMIT"],
});

export const NEG_PUSH_NO_AUTH: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: "work/task-1", upstream_ref: "origin/work/task-1", paths: [path("src/http/handlers.ts", { modified: true, staged: true })] }),
  policy: policy({ direct_current_branch_allowed: true, protected_branch_patterns: ["main"], commit_authorized: true, push_authorized: false }),
  requested_actions: ["COMMIT", "PUSH"],
});

export const NEG_STALE_FINGERPRINT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: "work/task-1", paths: [path("src/http/handlers.ts", { modified: true, staged: true })] }),
  policy: allowDirect(),
  validation_evidence: [
    { requirement_id: "unit", status: "PASS", observed_at: "2026-08-27T11:00:00Z", repository_fingerprint: "fp-OLD", evidence_ref: "ev/unit" },
    ...freshEvidence(DIFF_CHECKS),
  ],
});

export const NEG_PATH_OUTSIDE_SCOPE: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("src/billing/charge.ts", { modified: true, staged: true }),
    ],
  }),
  policy: allowDirect(),
});

export const NEG_FAILED_BEFORE_COMMIT: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: "work/task-1", paths: [path("src/http/handlers.ts", { modified: true, staged: true })] }),
  policy: allowDirect(),
  validation_evidence: [
    { requirement_id: "unit", status: "FAIL", observed_at: "2026-08-27T12:00:00Z", repository_fingerprint: FP, evidence_ref: "ev/unit" },
    ...freshEvidence(DIFF_CHECKS),
  ],
});

export const NEG_MANDATORY_REVIEW_UNAVAILABLE: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: "work/task-1", upstream_ref: "origin/work/task-1", paths: [path("src/http/handlers.ts", { modified: true, staged: true })] }),
  policy: policy({
    direct_current_branch_allowed: true,
    protected_branch_patterns: ["main"],
    commit_authorized: true,
    push_authorized: true,
    remote_review_mode: "REMOTE_REVIEW_REQUIRED",
    remote_review_capability_available: false,
    remote_review_write_authorized: false,
  }),
  requested_actions: ["COMMIT", "PUSH", "REMOTE_REVIEW"],
});

export const NEG_GENERATED_FILE_NO_POLICY: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({
    branch: "work/task-1",
    paths: [
      path("src/http/handlers.ts", { modified: true, staged: true }),
      path("dist/http/handlers.js", { modified: true, staged: true, ignored: true }),
    ],
  }),
  policy: allowDirect(),
});

export const NEG_DIFF_EVIDENCE_MISSING: RepositoryGitWorkflowInput = baseInput({
  repository: snapshot({ branch: "work/task-1", paths: [path("src/http/handlers.ts", { modified: true, staged: true })] }),
  policy: allowDirect(),
  validation_evidence: freshEvidence(["unit", "typecheck"]), // no diff-inspection evidence
});

export const ALL_NEGATIVE_INPUTS: { id: string; input: RepositoryGitWorkflowInput; expected: "BLOCKED" | "APPROVAL_REQUIRED" }[] = [
  { id: "FX-NEG-001", input: NEG_UNRELATED_TRACKED, expected: "BLOCKED" },
  { id: "FX-NEG-002", input: NEG_UNRELATED_STAGED, expected: "BLOCKED" },
  { id: "FX-NEG-003", input: NEG_DETACHED_HEAD, expected: "BLOCKED" },
  { id: "FX-NEG-004", input: NEG_DIVERGED, expected: "BLOCKED" },
  { id: "FX-NEG-005", input: NEG_UNKNOWN_IN_SCOPE, expected: "BLOCKED" },
  { id: "FX-NEG-006", input: NEG_ENV_STAGED, expected: "BLOCKED" },
  { id: "FX-NEG-007", input: NEG_PRIVATE_KEY_STAGED, expected: "BLOCKED" },
  { id: "FX-NEG-008", input: NEG_PART_A_DRIFT, expected: "BLOCKED" },
  { id: "FX-NEG-009", input: NEG_RESET_HARD, expected: "BLOCKED" },
  { id: "FX-NEG-010", input: NEG_CLEAN_FD, expected: "BLOCKED" },
  { id: "FX-NEG-011", input: NEG_FORCE_WITH_LEASE, expected: "BLOCKED" },
  { id: "FX-NEG-012", input: NEG_AUTO_STASH, expected: "BLOCKED" },
  { id: "FX-NEG-013", input: NEG_COMMIT_NO_AUTH, expected: "APPROVAL_REQUIRED" },
  { id: "FX-NEG-014", input: NEG_PUSH_NO_AUTH, expected: "APPROVAL_REQUIRED" },
  { id: "FX-NEG-015", input: NEG_STALE_FINGERPRINT, expected: "BLOCKED" },
  { id: "FX-NEG-016", input: NEG_PATH_OUTSIDE_SCOPE, expected: "BLOCKED" },
  { id: "FX-NEG-017", input: NEG_FAILED_BEFORE_COMMIT, expected: "BLOCKED" },
  { id: "FX-NEG-018", input: NEG_MANDATORY_REVIEW_UNAVAILABLE, expected: "BLOCKED" },
  { id: "FX-NEG-019", input: NEG_GENERATED_FILE_NO_POLICY, expected: "BLOCKED" },
  { id: "FX-NEG-020", input: NEG_DIFF_EVIDENCE_MISSING, expected: "BLOCKED" },
];

// ---------------------------------------------------------------------------
// A hand-mutated GOOD decision that the deterministic validator must reject.
// ---------------------------------------------------------------------------

export function goodDecision(input: RepositoryGitWorkflowInput) {
  return synthesizeRepositoryWorkflowDecision(
    input,
    deriveWorkflowProfileFromRules(repositoryGitWorkflowS13H.rules.map((r) => r.statement)),
  );
}

// ---------------------------------------------------------------------------
// Deterministic reference ModelProvider — always FINISHes on the first turn
// (S13H issues no tool calls). Its synthesis PROFILE is derived from whatever
// rule text the run objective carries. Deterministic reference provider, NOT a
// production LLM (contract §20, §26).
// ---------------------------------------------------------------------------

function extractWorkflowInput(goalText: string): RepositoryGitWorkflowInput {
  const idx = goalText.indexOf(REPOSITORY_GIT_WORKFLOW_INPUT_MARKER);
  if (idx === -1) throw new Error("DeterministicRepositoryGitWorkflowModelProvider: input marker not found.");
  const after = goalText.slice(idx + REPOSITORY_GIT_WORKFLOW_INPUT_MARKER.length).trim();
  const end = after.indexOf("\n\n");
  const jsonText = end === -1 ? after : after.slice(0, end);
  return JSON.parse(jsonText) as RepositoryGitWorkflowInput;
}

export class DeterministicRepositoryGitWorkflowModelProvider implements ModelProvider {
  static readonly PROVIDER_LABEL =
    "deterministic reference ModelProvider (no external LLM, no network, no credentials); reacts only to the materialized run objective";

  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const goalText = request.goal.statement;
    const input = extractWorkflowInput(goalText);
    // Profile derived from the WHOLE materialized objective — never a with-Skill
    // flag / Skill id / fixture id. With no S13H rule text present, every field
    // is false and an unsafe naive decision falls out.
    const profile = deriveWorkflowProfileFromRules([goalText]);
    const decision = synthesizeRepositoryWorkflowDecision(input, profile);
    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale:
          "Produced a candidate RepositoryWorkflowDecision from the bounded input under the synthesis profile derived from the run objective.",
        output: {
          summary: `RepositoryWorkflowDecision: ${decision.status}, ${decision.blockers.length} blocker(s).`,
          data: decision as unknown as Record<string, unknown>,
          evidence_refs: [input.repository.head],
        },
      },
    };
  }
}
