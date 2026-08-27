# BRAIN — Repository Git Workflow Contract S13H

**Step:** S13H — repository-git-workflow  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**New AgentDefinition:** NO  
**Canonical Skill runtime side effects:** NONE  
**S14 Capability Registry:** OUT OF SCOPE  
**S13I backend-api-engineering:** OUT OF SCOPE

---

## 1. Purpose

Define a deterministic/synthesis contract for safe repository/Git workflow decisions without executing Git.

S13H receives a verified repository snapshot and outputs a structured plan that downstream authorized tooling may execute later.

---

## 2. Canonical TypeScript-compatible shapes

Mechanical names may follow repository conventions. Semantics are fixed.

```ts
export type RepositoryWorkflowStatus =
  | "READY"
  | "APPROVAL_REQUIRED"
  | "BLOCKED";

export type WorkspaceStrategy =
  | "KEEP_CURRENT"
  | "FEATURE_BRANCH"
  | "ISOLATED_WORKTREE"
  | "BLOCKED";

export type GitOperationClass =
  | "READ_ONLY"
  | "NON_DESTRUCTIVE_WRITE"
  | "REMOTE_NON_DESTRUCTIVE_WRITE"
  | "DESTRUCTIVE_OR_HISTORY_REWRITE";

export type PathDisposition =
  | "INTENDED"
  | "ALLOWED_SUPPORTING"
  | "EXCLUDED"
  | "PROTECTED"
  | "SENSITIVE"
  | "UNKNOWN";
```

### Repository snapshot

```ts
export interface RepositoryRemoteSnapshot {
  name: string;
  url?: string;
  fetch_url?: string;
  push_url?: string;
}

export interface RepositoryWorktreeSnapshot {
  path: string;
  branch?: string;
  head: string;
  is_current: boolean;
}

export interface RepositoryPathState {
  path: string;
  tracked: boolean;
  staged: boolean;
  modified: boolean;
  deleted: boolean;
  untracked: boolean;
  ignored?: boolean;
}

export interface RepositoryStateSnapshot {
  repository_id: string;

  branch: string | null;
  detached_head: boolean;
  head: string;

  upstream_ref?: string;
  upstream_head?: string;

  ahead: number;
  behind: number;

  paths: RepositoryPathState[];

  remotes: RepositoryRemoteSnapshot[];
  worktrees: RepositoryWorktreeSnapshot[];

  observed_at: string;
}
```

### Change intent

```ts
export interface RepositoryChangeIntent {
  task_ref: string;
  summary: string;

  intended_paths: string[];
  allowed_supporting_paths: string[];

  protected_semantic_paths: string[];
  explicitly_excluded_paths: string[];

  expected_change_kind:
    | "FEATURE"
    | "FIX"
    | "DOCS"
    | "TEST"
    | "REFACTOR"
    | "CHORE";
}
```

### Caller/repository policy

```ts
export interface RepositoryGitPolicy {
  direct_current_branch_allowed: boolean;

  protected_branch_patterns: string[];

  feature_branch_allowed: boolean;
  worktree_allowed: boolean;
  require_worktree_for_concurrent_builders: boolean;

  concurrent_builder_count: number;

  commit_authorized: boolean;
  push_authorized: boolean;
  branch_write_authorized: boolean;
  worktree_write_authorized: boolean;
  remote_review_write_authorized: boolean;

  remote_review_mode:
    | "NONE"
    | "PUSH_ONLY"
    | "REMOTE_REVIEW_OPTIONAL"
    | "REMOTE_REVIEW_REQUIRED";

  target_branch?: string;
  preferred_remote?: string;

  sensitive_path_patterns: string[];
  explicit_safe_sensitive_path_exceptions: string[];

  commit_message_style?: string;
}
```

### Validation requirements

```ts
export type ValidationPhase =
  | "BEFORE_COMMIT"
  | "BEFORE_PUSH";

export interface RepositoryValidationRequirement {
  id: string;
  phase: ValidationPhase;
  description: string;

  // Optional command is caller-provided evidence metadata.
  // S13H does not invent commands.
  command?: string;
}

export interface RepositoryValidationEvidence {
  requirement_id: string;
  status: "PASS" | "FAIL";

  observed_at: string;
  repository_fingerprint: string;

  evidence_ref?: string;
}
```

### Requested action

```ts
export type RepositoryRequestedAction =
  | "CONTINUE_IMPLEMENTATION"
  | "CREATE_BRANCH"
  | "CREATE_WORKTREE"
  | "STAGE"
  | "COMMIT"
  | "PUSH"
  | "REMOTE_REVIEW";

export interface RepositoryGitWorkflowInput {
  repository: RepositoryStateSnapshot;

  change_intent: RepositoryChangeIntent;
  policy: RepositoryGitPolicy;

  validation_requirements: RepositoryValidationRequirement[];
  validation_evidence: RepositoryValidationEvidence[];

  requested_actions: RepositoryRequestedAction[];

  current_repository_fingerprint: string;
}
```

---

## 3. Path classification

```ts
export interface RepositoryPathClassification {
  path: string;
  disposition: PathDisposition;
  reason: string;
}
```

Canonical classification priority:

1. sensitive;
2. protected semantic path;
3. explicit intended;
4. allowed supporting;
5. explicit excluded;
6. known ignored/generated;
7. otherwise unknown.

A path MUST resolve to exactly one effective disposition.

If a path is both sensitive and intended:

```text
SENSITIVE wins
```

unless it matches an explicit repository safe exception.

---

## 4. Sensitive paths

Canonical built-in baseline patterns represent high-confidence classes:

```text
.env
.env.*
*.pem
*.key
credentials.*
*.p12
*.pfx
id_rsa
id_ed25519
```

Caller policy may extend them.

Caller policy may define exact safe exceptions such as:

```text
.env.example
```

No implementation may claim this is complete secret detection.

---

## 5. Workspace decision

```ts
export interface WorkspaceDecision {
  strategy: WorkspaceStrategy;

  branch_name?: string;
  worktree_path?: string;

  reason: string;
}
```

### 5.1 Detached HEAD

```text
BLOCKED
```

for normal implementation commit workflow.

### 5.2 Concurrent builders

If:

```text
concurrent_builder_count > 1
&&
require_worktree_for_concurrent_builders
```

then:

```text
ISOLATED_WORKTREE
```

when worktree policy allows it.

If worktree is required but disallowed:

```text
BLOCKED
```

### 5.3 Direct current branch

KEEP_CURRENT requires:

- explicit `direct_current_branch_allowed`;
- current branch not protected unless direct protected-branch writes are explicitly allowed by the same effective policy;
- no unrelated tracked/staged changes;
- no unsafe divergence;
- one primary builder owns current workspace;
- required write authorization for the requested next action.

### 5.4 Feature branch

Default when direct current branch is not explicitly allowed.

If feature branch is needed but `feature_branch_allowed == false`:

```text
BLOCKED
```

### 5.5 Worktree

Worktree path/name MUST be caller-provided or deterministically derived from task/branch identity by a documented mechanical rule.

The Skill does not create it.

---

## 6. Operation classification

```ts
export interface GitOperationProposal {
  operation: string;
  class: GitOperationClass;

  authorized: boolean;
  reason: string;
}
```

Part B may use normalized operation identifiers rather than shell command strings.

### Destructive/history-rewrite examples

Canonical forbidden set includes semantic equivalents of:

```text
RESET_HARD
CLEAN_UNTRACKED
CLEAN_ALL
RESTORE_BROAD
DELETE_BRANCH_FORCE
PUSH_FORCE
PUSH_FORCE_WITH_LEASE
REBASE_SHARED_HISTORY
AMEND_PUBLISHED_COMMIT
HISTORY_REWRITE
AUTO_STASH
```

No READY decision may include one.

---

## 7. Dirty-tree rules

### Tracked unrelated path

If any tracked changed/staged path is not:

```text
INTENDED
or
ALLOWED_SUPPORTING
```

then:

```text
BLOCKED
```

### Untracked

Known-safe EXCLUDED files do not block.

UNKNOWN untracked paths inside/near intended scope block until classified.

SENSITIVE blocks.

No deletion/clean/stash resolution is emitted.

---

## 8. Diff inspection evidence

The input/evidence contract must represent that caller/tooling inspected:

```text
working diff
staged diff
```

Part B may model this as required validation ids such as:

```text
repo.diff.working.inspected
repo.diff.staged.inspected
repo.changed_paths.classified
```

These are S13H generic repository checks, not project-specific build/test commands.

A commit request without passing current-fingerprint diff inspection evidence:

```text
BLOCKED
```

---

## 9. Validation fingerprint

Canonical evidence validity:

```text
evidence.repository_fingerprint
==
input.current_repository_fingerprint
```

for all required checks relevant to the requested action.

Stale evidence is ignored/fails the gate.

The fingerprint is caller-generated.

Part B may provide a deterministic helper for tests, but S13H semantics do not prescribe cryptographic algorithm.

---

## 10. Validation gate

```ts
export interface ValidationGateResult {
  status: "PASS" | "FAIL";
  missing_requirement_ids: string[];
  failed_requirement_ids: string[];
  stale_requirement_ids: string[];
}
```

### COMMIT

All `BEFORE_COMMIT` requirements PASS/current.

### PUSH

All `BEFORE_COMMIT` and `BEFORE_PUSH` requirements PASS/current.

S13H does not invent application-specific checks.

---

## 11. Commit plan

```ts
export interface RepositoryCommitPlan {
  intent: string;

  included_paths: string[];
  excluded_paths: string[];

  message: string;

  required_validation_refs: string[];
}
```

### Included paths

Every included path MUST be:

```text
INTENDED
or
ALLOWED_SUPPORTING
```

and not SENSITIVE/PROTECTED unexpected drift.

### Message

Default mapping:

```text
FEATURE  -> feat:
FIX      -> fix:
DOCS     -> docs:
TEST     -> test:
REFACTOR -> refactor:
CHORE    -> chore:
```

Caller repository convention may override.

No issue number invented.

---

## 12. Push plan

```ts
export interface RepositoryPushPlan {
  remote: string;
  branch: string;

  force: false;

  required_validation_refs: string[];
}
```

No force flag may become true.

Remote must resolve to supplied repository remote/policy.

---

## 13. Remote review handoff

```ts
export interface RemoteReviewHandoff {
  mode:
    | "NONE"
    | "PUSH_ONLY"
    | "REMOTE_REVIEW_OPTIONAL"
    | "REMOTE_REVIEW_REQUIRED";

  source_branch?: string;
  target_branch?: string;

  title?: string;
  summary?: string;

  changed_paths: string[];
  validation_evidence_refs: string[];

  open_issues: string[];
}
```

No provider API metadata.

Forbidden:

```text
github_token
gitlab_token
api_endpoint
mcp_server
provider_client
oauth_session
```

---

## 14. Repository handoff

```ts
export interface RepositoryHandoff {
  branch: string | null;
  head: string;
  upstream_ref?: string;

  ahead: number;
  behind: number;

  included_paths: string[];
  excluded_paths: string[];

  commit_refs: string[];

  push_status:
    | "NOT_REQUESTED"
    | "NOT_AUTHORIZED"
    | "PLANNED"
    | "DONE"
    | "FAILED";

  remote_review_status:
    | "NOT_REQUIRED"
    | "NOT_AUTHORIZED"
    | "PLANNED"
    | "DONE"
    | "BLOCKED";

  validation_evidence_refs: string[];

  open_issues: string[];
  next_repository_action: string;
  do_not_do: string[];
}
```

S13H may project caller-supplied completed-effect evidence into this structure.

It does not itself create commits/pushes.

---

## 15. Canonical result

```ts
export interface RepositoryWorkflowDecision {
  status: RepositoryWorkflowStatus;

  blockers: string[];
  approvals_required: string[];

  workspace: WorkspaceDecision;

  repository_findings: string[];

  safe_operations: GitOperationProposal[];
  forbidden_operations: GitOperationProposal[];

  path_classification: RepositoryPathClassification[];

  validation_gate: ValidationGateResult;

  commit_plan: RepositoryCommitPlan | null;
  push_plan: RepositoryPushPlan | null;

  remote_review_handoff: RemoteReviewHandoff;
  repository_handoff: RepositoryHandoff;
}
```

---

## 16. Status derivation

### BLOCKED has priority

Any hard safety failure → BLOCKED.

Examples:

- detached HEAD;
- unrelated tracked/staged path;
- sensitive path in proposed commit;
- unknown in-scope path;
- unresolved divergence;
- failed/stale required validation;
- destructive/history rewrite request;
- protected semantic drift;
- provider-specific remote binding;
- impossible required workspace policy.

### APPROVAL_REQUIRED

Only when no blocker exists and the sole missing gates are explicit authorization for safe non-destructive writes.

### READY

Only when:

- no blocker;
- no approval missing for requested action;
- required validation current/pass;
- requested operation class is allowed;
- change isolation passes.

---

## 17. No hidden Git execution

The S13H semantic implementation MUST NOT call:

```text
git add
git commit
git push
git checkout/switch
git worktree add/remove
git stash
git reset
git clean
provider PR API
```

inside the canonical Skill run.

Temporary test fixtures may invoke local Git in isolated temp directories to generate snapshots/ground truth.

---

## 18. Real Git fixture policy

Part B may create temporary repositories under the test runtime temporary directory.

Allowed:

```text
git init
git add
git commit
git branch
git checkout/switch in temp repo
git worktree in temp repo
git init --bare temp remote
git push to temp bare remote
```

only inside disposable isolated fixtures.

Forbidden:

- mutating the real Brain repo;
- using real origin for fixture writes;
- destructive commands against Brain;
- credentials/network dependency.

The tests should remove their temp directories mechanically where safe.

---

## 19. Compiler runtime path

No dedicated S13H AgentDefinition.

Semantic run:

```text
S12 metadata-only discovery
→ lazy load S13H Skill
→ caller-supplied compatible AgentDefinition
→ S10 compileAgentDefinition()
→ S09 runAgent()
→ parse candidate RepositoryWorkflowDecision
→ deterministic validation
```

No role/Skill-id-specific Core branch.

---

## 20. Skill-vs-no-Skill

Same runtime/input/provider/evaluator.

Only selected Skill semantics differ.

The provider MUST NOT receive:

```text
withSkill
fixtureId
S13H Skill id branch
frozen truth
```

It MAY react to actual materialized Skill instructions in its input.

---

## 21. Semantic dimensions

Evaluate independently:

```text
repository_state_safety
workspace_isolation
dirty_tree_and_change_isolation
destructive_operation_safety
validation_and_evidence_freshness
commit_quality
secrets_and_sensitive_paths
push_and_remote_review
handoff_and_traceability
stage_and_provider_boundary
```

Hard-invariant failures remain visible separately from aggregate scores.

---

## 22. Minimum T1–Tn coverage

Part B MUST provide equivalent semantic coverage for at least:

```text
T1   valid clean snapshot parses
T2   snapshot input is not mutated
T3   detached HEAD blocks
T4   unrelated tracked modification blocks
T5   unrelated staged path blocks
T6   safe excluded untracked file does not block
T7   unknown in-scope untracked file blocks
T8   sensitive path precedence over intended
T9   explicit safe sensitive-path exception works
T10  direct current branch requires explicit policy
T11  default without direct permission selects feature branch
T12  required worktree for concurrency selects isolated worktree
T13  required worktree but worktree disallowed blocks
T14  commit write without authorization requires approval
T15  push write without authorization requires approval
T16  worktree/branch write authorization gate works
T17  reset --hard classifies destructive and blocks
T18  clean -fd classifies destructive and blocks
T19  push --force blocks
T20  force-with-lease blocks
T21  automatic stash blocks
T22  rebase/amend shared/published history blocks
T23  ahead+behind divergence blocks
T24  behind-only state does not invent rebase/reset fix
T25  diff inspection evidence required before commit
T26  changed paths all classified
T27  commit includes only intended/supporting paths
T28  protected Part A drift blocks
T29  commit plan atomicity enforced
T30  default commit message type maps from change kind
T31  no issue/PR number invented
T32  project-specific validation requirements come only from input
T33  failed BEFORE_COMMIT check blocks commit
T34  stale fingerprint blocks
T35  fresh fingerprint passes
T36  BEFORE_PUSH requirements enforced for push
T37  .env sensitive path blocks
T38  private-key path blocks
T39  supplied high-confidence secret finding blocks
T40  implementation does not claim universal secret detection
T41  push plan force is always false
T42  push remote resolves to supplied remote/policy
T43  provider-specific remote review binding rejects
T44  mandatory remote review missing capability/authorization surfaces correctly
T45  repository handoff contains canonical fields
T46  S06 ownership remains external
T47  STATE/CURRENT ownership remains caller/session-close
T48  no Git write occurs in canonical Skill run
T49  no S13H AgentDefinition exists
T50  no role/Skill-id-specific Core branch exists
T51  S12 metadata-only discovery + lazy load proven
T52  S10 compileAgentDefinition + S09 runAgent proven
T53  temp real-Git fixture can model clean/dirty/diverged states without Brain mutation
T54  FX-POS-001 passes
T55  FX-POS-002 passes
T56  FX-POS-003 passes
T57  FX-POS-004 passes
T58  FX-POS-005 passes
T59  canonical negative fixtures fail/require approval correctly
T60  frozen truth inaccessible to provider/model
T61  no separate deliberately-bad baseline planner
T62  Skill-vs-no-Skill threshold passes
T63  no hard-invariant regression
T64  no S14 Capability Registry/provider implementation
T65  no S13I implementation
T66  full prior regression suite green
```

Mechanical grouping is allowed.

Semantic coverage MUST remain complete.

---

## 23. Independent verification

Builder self-review is not final independent verification.

Before S13I:

- fresh session;
- implementation not authored there;
- read-only;
- re-run deterministic QA;
- inspect Part A integrity;
- inspect provider/eval source;
- re-measure Skill-vs-no-Skill;
- map T1–T66/equivalent;
- prove real Brain repo not mutated by fixture tests;
- prove S14/S13I boundaries.

---

## 24. Part B candidate scope

Equivalent responsibilities:

```text
src/intelligence/repository-git-workflow/
  constants.ts
  types.ts
  classifyRepositoryState.ts
  classifyGitOperation.ts
  decideWorkspaceStrategy.ts
  classifyChangedPaths.ts
  validateChangeIsolation.ts
  validateSensitivePaths.ts
  validateValidationEvidence.ts
  buildCommitPlan.ts
  buildPushPlan.ts
  buildRemoteReviewHandoff.ts
  validateRepositoryWorkflowDecision.ts
  planRepositoryGitWorkflow.ts
  compareRepositoryGitWorkflowRuns.ts
  index.ts
```

and:

```text
src/intelligence/skills/definitions/repositoryGitWorkflowS13H.ts
tests/repository-git-workflow/...
```

Exact filenames may follow repository conventions.

---

## 25. Forbidden scope

Do not implement:

```text
Capability Registry S14
Git capability provider
GitHub/GitLab/Bitbucket API
MCP
PR creation executor
merge/rebase/reset/stash executor
Task Executor
Workflow Runtime
deployment
backend-api-engineering S13I
Verifier Agent S15
```

---

## 26. PASS criteria

S13H closes PASS only when:

1. Part A integrated verbatim.
2. Part A remains separately auditable.
3. Skill remains SKILL_ONLY.
4. No new AgentDefinition.
5. Canonical Skill runtime performs no Git write.
6. Workspace strategy obeys repository/caller policy.
7. Unrelated tracked/staged changes block.
8. Safe excluded untracked files may coexist.
9. Unknown/sensitive in-scope paths block.
10. Destructive/history rewrite operations never become READY.
11. No automatic stash.
12. Diff inspection/change isolation are mandatory before commit.
13. Validation requirements are source-derived.
14. Validation evidence is current-state-bound.
15. Atomic commit plan only.
16. Sensitive paths/known secrets block.
17. Push is normal/non-force only.
18. Remote review is provider-neutral.
19. Repository handoff is traceable and does not replace S06.
20. No S14 capability/provider implementation.
21. No S13I implementation.
22. Real S12 → S10 → S09 runtime proven.
23. Real temporary-Git fixtures do not mutate Brain repo.
24. Positive fixtures pass.
25. Negative fixtures fail/require approval correctly.
26. Skill-vs-no-Skill threshold passes.
27. typecheck passes.
28. full tests pass.
29. clean build passes.
30. post-build tests pass.
31. fresh independent verification passes.
32. commit/push closure succeeds when separately authorized by caller.
33. STOP before S13I.
