import type { SkillDefinition } from "../../../core/skill/index.js";
import {
  REPOSITORY_GIT_WORKFLOW_QUALITY_CONTRACT_REF,
  REPOSITORY_GIT_WORKFLOW_SKILL_ID,
} from "../../repository-git-workflow/constants.js";

/**
 * Typed Skill Contract v1 representation of the S13H Repository Git Workflow
 * Skill.
 *
 * Canonical semantic source of truth:
 * brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md (ChatGPT-authored,
 * integrated verbatim at commit 0a4f6cf). This file is a *runtime
 * representation* of it, mirroring
 * src/intelligence/skills/definitions/taskPromptCompilerS13G.ts. It does not
 * weaken or reinterpret any rule; it assigns MECHANICAL ids (`RGW-R1..RGW-R24`,
 * `RGW-P1..RGW-P16`, `RGW-V1..RGW-V12`) while preserving each statement
 * verbatim-in-substance.
 *
 * `requires.skills: []` / `requires.capabilities: []` — S13H is decision-
 * compilation only. It consumes a caller-supplied repository snapshot; it never
 * runs git and never binds a provider.
 */
export const repositoryGitWorkflowS13H: SkillDefinition = {
  id: REPOSITORY_GIT_WORKFLOW_SKILL_ID,
  version: "1.0.0",

  description:
    "Turn a verified repository/Git state snapshot plus explicit change intent, validation evidence and caller " +
    "policy into a safe, traceable, provider-neutral repository workflow decision covering preflight, branch/worktree " +
    "strategy, dirty-tree safety, diff/change isolation, validation gates, atomic commit planning, normal push " +
    "planning, provider-neutral remote review handoff and repository handoff evidence. It does not execute Git.",

  applies_when: {
    task_kinds: ["repository-git-workflow", "git-workflow-decision", "commit-planning", "branch-worktree-decision"],
    signals: [
      "repository preflight",
      "branch",
      "worktree",
      "diff",
      "change isolation",
      "commit plan",
      "push",
      "pull request",
      "remote review",
      "repository handoff",
      "destructive operation",
    ],
    exclusions: [
      "git execution",
      "capability registry",
      "github api",
      "gitlab api",
      "bitbucket api",
      "pr creation executor",
      "merge executor",
      "rebase executor",
      "deployment",
      "backend-api-engineering",
    ],
  },

  inputs: [
    {
      name: "repository_git_workflow_input",
      description:
        "Bounded RepositoryGitWorkflowInput: an immutable caller-supplied RepositoryStateSnapshot, an explicit " +
        "RepositoryChangeIntent, a caller RepositoryGitPolicy, RepositoryValidationRequirement[] + state-bound " +
        "RepositoryValidationEvidence[], the requested repository actions, and the current repository fingerprint.",
      required: true,
      schema: { type: "object" },
    },
  ],

  outputs: [
    {
      name: "repository_workflow_decision",
      description:
        "Structured RepositoryWorkflowDecision { status: READY | APPROVAL_REQUIRED | BLOCKED, blockers[], " +
        "approvals_required[], workspace, repository_findings[], safe_operations[], forbidden_operations[], " +
        "path_classification[], validation_gate, commit_plan | null, push_plan | null, remote_review_handoff, " +
        "repository_handoff }. No Git command is executed.",
      required: true,
      schema: { type: "object" },
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["REPOSITORY_STATE", "CHANGE_INTENT", "CALLER_GIT_POLICY", "VALIDATION_EVIDENCE"],
    quality_contract_refs: [REPOSITORY_GIT_WORKFLOW_QUALITY_CONTRACT_REF],
  },

  rules: [
    { id: "RGW-R1", level: "MUST", statement: "Snapshot first: never reason from an assumed branch/HEAD/dirty state; a decision is based on an explicit RepositoryStateSnapshot." },
    { id: "RGW-R2", level: "MUST", statement: "Snapshot immutable: do not mutate or fabricate repository state in the Skill; the canonical Skill runtime performs zero Git/repository writes." },
    { id: "RGW-R3", level: "MUST", statement: "Default isolation: if caller/repository policy does not explicitly allow direct work on the current branch, prefer FEATURE_BRANCH; do not default to direct current-branch writes." },
    { id: "RGW-R4", level: "MUST", statement: "Worktree for real concurrency/isolation: use ISOLATED_WORKTREE only when caller policy or a genuine concurrency/isolation need justifies it." },
    { id: "RGW-R5", level: "MUST", statement: "Unrelated tracked changes block: never overwrite, stage around, stash, or absorb them; any unrelated tracked/staged change blocks the normal workflow." },
    { id: "RGW-R6", level: "MUST", statement: "Untracked is classified, not deleted: every untracked file is classified (INTENDED / EXCLUDED_SAFE / SENSITIVE / UNKNOWN); known-safe excluded untracked files may coexist; unknown/sensitive files in scope block." },
    { id: "RGW-R7", level: "MUST", statement: "Diff inspection mandatory: no commit-ready decision without working/staged diff evidence and classified changed paths." },
    { id: "RGW-R8", level: "MUST", statement: "Atomic commits only: one coherent logical change per commit plan; no commit everything." },
    { id: "RGW-R9", level: "MUST", statement: "No commit-all: every included path is explicit and justified as INTENDED or ALLOWED_SUPPORTING." },
    { id: "RGW-R10", level: "MUST", statement: "Semantic Part A protection: unexpected changes to protected canonical semantic artifacts block and return to the ChatGPT Authoring Gate." },
    { id: "RGW-R11", level: "MUST", statement: "Explicit write authorization: branch/worktree creation, staging, commit, push, and remote review creation require caller authorization before READY." },
    { id: "RGW-R12", level: "MUST", statement: "Destructive/history rewrite forbidden by default: no normal S13H plan may recommend reset --hard, clean -fd/-fdx, broad restore/checkout, branch -D, force push, force-with-lease, shared-history rebase, post-publication amend, or automatic history rewrite; such operations never become READY." },
    { id: "RGW-R13", level: "MUST", statement: "No automatic stash: preservation strategy belongs to the user/caller; S13H does not stash automatically." },
    { id: "RGW-R14", level: "MUST", statement: "Divergence blocks unsafe write planning: a detached HEAD or unresolved ahead+behind divergence blocks the normal commit/push flow; divergence blocks unsafe write planning and S13H does not prescribe rebase/reset." },
    { id: "RGW-R15", level: "MUST", statement: "Validation requirements are inputs: do not invent project-specific QA commands; consume the supplied RepositoryValidationRequirement[] and RepositoryValidationEvidence[]." },
    { id: "RGW-R16", level: "MUST", statement: "Validation must match current state: stale evidence does not pass; required evidence is bound to the current repository/diff fingerprint." },
    { id: "RGW-R17", level: "MUST", statement: "Sensitive paths block: known sensitive paths/secret findings cannot enter a normal commit." },
    { id: "RGW-R18", level: "MUST", statement: "No perfect-secret-scanner claim: use explicit repository/caller sensitive-path policy and supplied scan findings, never a claim that arbitrary secret strings are perfectly detectable." },
    { id: "RGW-R19", level: "MUST", statement: "Normal push only: no force semantics; a READY push plan carries no force/history-rewrite behaviour." },
    { id: "RGW-R20", level: "MUST", statement: "PR is provider-neutral handoff: do not bind GitHub/GitLab/Bitbucket APIs; the remote review handoff is provider-neutral and carries no token/endpoint/client/MCP/OAuth field." },
    { id: "RGW-R21", level: "MUST", statement: "S06 remains session-handoff owner: S13H emits a repository-specific handoff projection only and does not replace full session continuity." },
    { id: "RGW-R22", level: "MUST", statement: "STATE/CURRENT remain caller/session-close bookkeeping: S13H does not autonomously own continuity artifacts." },
    { id: "RGW-R23", level: "MUST", statement: "No S14 pull-forward: do not implement Git capability providers or a Capability Registry." },
    { id: "RGW-R24", level: "MUST", statement: "No S13I pull-forward: do not implement backend API engineering, routes, controllers or services." },
  ],

  procedure: [
    { id: "RGW-P1", title: "Consume the immutable snapshot", instruction: "Read the caller-supplied RepositoryStateSnapshot; never discover or mutate real Git state.", requires: ["repository_git_workflow_input"], produces: ["state_read"] },
    { id: "RGW-P2", title: "Classify repository state safety", instruction: "Detect detached HEAD, divergence (ahead/behind), and unrelated tracked/staged changes; each unsafe state is a blocker.", requires: ["state_read"], produces: ["state_class"] },
    { id: "RGW-P3", title: "Decide workspace strategy", instruction: "Select KEEP_CURRENT / FEATURE_BRANCH / ISOLATED_WORKTREE / BLOCKED from state + caller policy; default to FEATURE_BRANCH without explicit direct-branch permission.", requires: ["state_class"], produces: ["workspace"] },
    { id: "RGW-P4", title: "Classify changed paths", instruction: "Classify every changed/untracked path against intended / allowed_supporting / excluded / protected / sensitive / unknown by the canonical priority.", requires: ["state_class"], produces: ["path_class"] },
    { id: "RGW-P5", title: "Enforce change isolation", instruction: "A commit may contain only INTENDED or ALLOWED_SUPPORTING paths; a path outside scope or an UNKNOWN in scope blocks; protected-artifact drift blocks and returns to the Authoring Gate.", requires: ["path_class"], produces: ["isolation_gate"] },
    { id: "RGW-P6", title: "Block sensitive paths", instruction: "Any sensitive path or high-confidence secret finding in the change set blocks; never claim perfect detection.", requires: ["path_class"], produces: ["secret_gate"] },
    { id: "RGW-P7", title: "Classify requested operations", instruction: "Classify each requested/implied Git operation as READ_ONLY / NON_DESTRUCTIVE_WRITE / REMOTE_NON_DESTRUCTIVE_WRITE / DESTRUCTIVE_OR_HISTORY_REWRITE; a destructive/history-rewrite or automatic stash never becomes READY.", requires: ["state_class"], produces: ["op_class"] },
    { id: "RGW-P8", title: "Require diff inspection evidence", instruction: "Before a commit can be READY, require current-fingerprint working-diff, staged-diff and changed-path-classification evidence.", requires: ["isolation_gate"], produces: ["diff_gate"] },
    { id: "RGW-P9", title: "Evaluate the validation gate", instruction: "Consume the supplied validation requirements/evidence; a missing/failed/stale required BEFORE_COMMIT or BEFORE_PUSH check fails the gate.", requires: ["diff_gate"], produces: ["validation_gate"] },
    { id: "RGW-P10", title: "Materialize an atomic commit plan", instruction: "Produce one atomic commit plan with explicit included/excluded paths, a `<type>: <summary>` message, and required_validation_refs; never commit-all.", requires: ["validation_gate"], produces: ["commit_plan"] },
    { id: "RGW-P11", title: "Materialize a normal push plan", instruction: "If push is requested and authorized, produce a normal push plan (force is literally false) to a supplied remote target.", requires: ["commit_plan"], produces: ["push_plan"] },
    { id: "RGW-P12", title: "Build the provider-neutral remote review handoff", instruction: "Produce a provider-neutral RemoteReviewHandoff (source/target branch, title, summary, changed paths, evidence refs, open issues); no provider API call or binding.", requires: ["push_plan"], produces: ["remote_review"] },
    { id: "RGW-P13", title: "Compute required approvals", instruction: "List each requested non-destructive write that lacks explicit caller authorization; safe-but-unauthorized yields APPROVAL_REQUIRED.", requires: ["op_class"], produces: ["approvals"] },
    { id: "RGW-P14", title: "Project the repository handoff", instruction: "Emit the repository-specific handoff (branch/HEAD/upstream/ahead/behind/included/excluded/commit refs/push+review status/evidence refs/open issues/next action/do-not-do); do not replace S06.", requires: ["remote_review"], produces: ["repo_handoff"] },
    { id: "RGW-P15", title: "Derive status deterministically", instruction: "BLOCKED has priority for any hard safety failure; APPROVAL_REQUIRED only when the sole missing gates are explicit authorization for safe non-destructive writes; otherwise READY.", requires: ["approvals", "validation_gate", "secret_gate", "isolation_gate"], produces: ["decision"] },
    { id: "RGW-P16", title: "Stop before execution", instruction: "Return the RepositoryWorkflowDecision; do not run git add/commit/push/branch/worktree/stash/reset/clean or any provider PR API.", requires: ["decision"], produces: ["repository_workflow_decision"] },
  ],

  verification: [
    { id: "RGW-V1", kind: "DETERMINISTIC", criterion: "A decision is based on an explicit RepositoryStateSnapshot and the canonical Skill runtime performs zero Git writes.", evidence_required: true },
    { id: "RGW-V2", kind: "DETERMINISTIC", criterion: "Detached HEAD and unresolved ahead+behind divergence never produce a normal READY implementation commit/push workflow.", evidence_required: true },
    { id: "RGW-V3", kind: "DETERMINISTIC", criterion: "Any unrelated tracked/staged change blocks; no automatic stash/restore/reset/clean is emitted.", evidence_required: true },
    { id: "RGW-V4", kind: "DETERMINISTIC", criterion: "Every changed/untracked path is classified; a commit plan includes only INTENDED or ALLOWED_SUPPORTING paths." , evidence_required: true },
    { id: "RGW-V5", kind: "DETERMINISTIC", criterion: "No reset --hard / clean -fd / force push / force-with-lease / shared-history rebase / published amend / automatic stash ever appears as a READY safe operation.", evidence_required: true },
    { id: "RGW-V6", kind: "DETERMINISTIC", criterion: "Branch/worktree/stage/commit/push/remote-review writes require explicit caller authorization before READY; safe-but-unauthorized yields APPROVAL_REQUIRED.", evidence_required: true },
    { id: "RGW-V7", kind: "DETERMINISTIC", criterion: "Validation requirements are consumed from input; missing/failed/stale required evidence fails the gate; no project-specific QA command is invented.", evidence_required: true },
    { id: "RGW-V8", kind: "DETERMINISTIC", criterion: "Known sensitive paths and high-confidence supplied secret findings cannot enter a READY commit; no universal perfect-detector claim is made.", evidence_required: true },
    { id: "RGW-V9", kind: "DETERMINISTIC", criterion: "A READY push plan carries force === false and a supplied remote target; the remote review handoff carries no provider-specific binding.", evidence_required: true },
    { id: "RGW-V10", kind: "DETERMINISTIC", criterion: "The repository handoff is reproducible and traceable and does not replace the S06 session handoff; STATE/CURRENT are not autonomously edited.", evidence_required: true },
    { id: "RGW-V11", kind: "DETERMINISTIC", criterion: "No new repository-git-workflow AgentDefinition or role/Skill-id Core branch exists; the Skill runs through unchanged S12 discovery + lazy load, S10 compileAgentDefinition and S09 runAgent.", evidence_required: true },
    { id: "RGW-V12", kind: "SEMANTIC", criterion: "The Skill-vs-no-Skill comparison shows strict improvement over the no-Skill arm on frozen ground truth with zero destructive/unintended-path/secret-path recommendations.", evidence_required: true },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: [
    "evals/s13h/clean-feature-branch-required",
    "evals/s13h/direct-current-branch-allowed",
    "evals/s13h/isolated-worktree-concurrency",
    "evals/s13h/safe-excluded-untracked-docs",
    "evals/s13h/atomic-commit-normal-push",
    "evals/s13h/skill-vs-no-skill",
  ],
};
