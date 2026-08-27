# REPOSITORY_GIT_WORKFLOW_SKILL_S13H

## Identity

```yaml
id: intelligence.repository-git-workflow.s13h
version: 1.0.0
step: S13H
name: repository-git-workflow
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral: true
```

## Purpose

Turn a verified repository/Git state snapshot plus explicit change intent, validation evidence and caller policy into a safe, traceable repository workflow decision.

The Skill covers:

```text
preflight
branch/worktree strategy
dirty-tree safety
diff/change isolation
validation gates
atomic commit planning
normal push planning
provider-neutral remote review handoff
repository-specific handoff evidence
```

It does not execute Git.

## Execution mode

```text
one-pass semantic guidance → SKILL_ONLY
```

No repository-git AgentDefinition is created.

The Skill runs through an existing compatible caller-supplied AgentDefinition / generic S12 → S10 → S09 runtime.

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - REPOSITORY_STATE
    - CHANGE_INTENT
    - CALLER_GIT_POLICY
    - VALIDATION_EVIDENCE
  quality_contract_refs:
    - S13H_REPOSITORY_GIT_WORKFLOW_DEEP
```

## Permissions

```yaml
permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true
```

Repository mutations are future execution-layer actions, not compiler-Skill side effects.

## Input

Canonical:

```text
RepositoryGitWorkflowInput
```

with:

```text
repository
change_intent
policy
validation_requirements
validation_evidence
requested_actions
```

## Output

Canonical:

```text
RepositoryWorkflowDecision
```

Status:

```text
READY
APPROVAL_REQUIRED
BLOCKED
```

The decision includes:

```text
workspace_strategy
repository_findings
approvals_required
safe_operations
forbidden_operations
path_classification
validation_gate
commit_plan
push_plan
remote_review_handoff
repository_handoff
```

No Git command is executed by S13H.

## Core rules

### R1 — snapshot first

Never reason from an assumed branch/HEAD/dirty state.

### R2 — snapshot immutable

Do not mutate or fabricate repository state in the Skill.

### R3 — default isolation

If caller/repository policy does not explicitly allow direct work on the current branch, prefer FEATURE_BRANCH.

### R4 — worktree for real concurrency/isolation

Use ISOLATED_WORKTREE only when caller policy or concurrency/isolation need justifies it.

### R5 — unrelated tracked changes block

Never overwrite, stage around, stash, or absorb them.

### R6 — untracked is classified, not deleted

Known-safe excluded untracked files may coexist.

Unknown/sensitive files in scope block.

### R7 — diff inspection mandatory

No commit-ready decision without working/staged diff evidence and classified changed paths.

### R8 — atomic commits only

One logical change per commit plan.

### R9 — no commit-all

Every included path is explicit and justified.

### R10 — semantic Part A protection

Unexpected changes to protected canonical semantic artifacts block and return to ChatGPT Authoring Gate.

### R11 — explicit write authorization

Branch/worktree creation, staging, commit, push, and remote review creation require caller authorization before READY.

### R12 — destructive/history rewrite forbidden by default

No normal S13H plan may recommend reset --hard, clean -fd/-fdx, broad restore/checkout, branch -D, force push, force-with-lease, shared-history rebase, post-publication amend, or automatic history rewrite.

### R13 — no automatic stash

Preservation strategy belongs to the user/caller.

### R14 — divergence blocks unsafe write planning

Detached HEAD or unresolved ahead+behind divergence blocks normal commit/push flow.

### R15 — validation requirements are inputs

Do not invent project-specific QA commands.

### R16 — validation must match current state

Stale evidence does not pass.

### R17 — sensitive paths block

Known sensitive paths/secret findings cannot enter a normal commit.

### R18 — no perfect-secret-scanner claim

Use explicit repository/caller sensitive-path policy and supplied scan findings.

### R19 — normal push only

No force semantics.

### R20 — PR is provider-neutral handoff

Do not bind GitHub/GitLab/Bitbucket APIs.

### R21 — S06 remains session-handoff owner

S13H emits repository-specific handoff data only.

### R22 — STATE/CURRENT remain caller/session-close bookkeeping

Do not autonomously own continuity artifacts.

### R23 — no S14 pull-forward

Do not implement Git capability providers or Capability Registry.

### R24 — no S13I pull-forward

Do not implement backend API engineering.

## Workspace strategy

```text
KEEP_CURRENT
FEATURE_BRANCH
ISOLATED_WORKTREE
BLOCKED
```

### KEEP_CURRENT

Allowed only when current branch is valid, direct-write policy explicitly allows it, one primary builder owns the tree, change isolation passes, divergence is safe, and required write authorization exists for the next write.

### FEATURE_BRANCH

Canonical default when direct-current-branch work is not explicitly allowed.

### ISOLATED_WORKTREE

Use for explicit workspace isolation or concurrent builders where separation is required.

### BLOCKED

Use when no safe strategy can be chosen from current state/policy.

## Operation classes

```text
READ_ONLY
NON_DESTRUCTIVE_WRITE
REMOTE_NON_DESTRUCTIVE_WRITE
DESTRUCTIVE_OR_HISTORY_REWRITE
```

Destructive/history-rewrite operations are forbidden by default.

## Dirty-tree policy

Tracked:

```text
unrelated → BLOCKED
intended → allowed only when explicitly owned by change intent
```

Untracked:

```text
INTENDED
EXCLUDED_SAFE
SENSITIVE
UNKNOWN
```

No deletion/clean/stash is automatic.

## Change isolation

Every changed/staged candidate path must resolve to:

```text
INTENDED
ALLOWED_SUPPORTING
EXCLUDED
PROTECTED
SENSITIVE
UNKNOWN
```

A commit may contain only:

```text
INTENDED
ALLOWED_SUPPORTING
```

## Validation gate

Consume:

```text
ValidationRequirement[]
ValidationEvidence[]
```

Do not invent project commands.

Evidence must be bound to the current repository/diff fingerprint.

Failed or stale required evidence blocks.

## Commit plan

A proposed atomic commit contains:

```text
intent
included_paths
excluded_paths
message
required_validation_refs
```

Default Brain message style:

```text
<type>: <concise imperative summary>
```

Default types:

```text
feat
fix
docs
test
refactor
chore
```

## Push plan

Normal push only.

Requires:

```text
push authorization
valid local commit plan/state
valid remote target
fresh validation
no divergence requiring rewrite
```

## Remote review handoff

Modes:

```text
NONE
PUSH_ONLY
REMOTE_REVIEW_OPTIONAL
REMOTE_REVIEW_REQUIRED
```

Provider-neutral fields only.

No provider API call.

## Sensitive-path policy

High-confidence examples:

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

Repository policy may add explicit safe exceptions such as `.env.example`.

## Failure policy

BLOCKED when:

- repository state is unsafe/unknown;
- tracked unrelated changes exist;
- detached HEAD;
- unresolved divergence;
- destructive/history rewrite requested;
- validation required but failed/stale/missing;
- sensitive path would enter commit;
- commit path is outside intended/supporting scope;
- protected semantic artifact changed unexpectedly;
- provider-specific remote API is embedded;
- S14/S13I scope is pulled forward.

APPROVAL_REQUIRED when workflow is safe but a non-destructive write lacks caller authorization.

## Success criteria

S13H passes only when:

- Part A is integrated verbatim;
- Skill remains SKILL_ONLY;
- no new AgentDefinition exists;
- no repository mutation occurs in canonical Skill runtime;
- workspace strategy follows explicit policy/state;
- unrelated tracked changes block;
- safe untracked exclusions are preserved;
- destructive/history-rewrite operations never become READY;
- validation evidence is state-bound;
- commit plans are atomic and path-isolated;
- sensitive paths are blocked;
- push plans are normal/non-force;
- PR/review remains provider-neutral;
- real S12 → S10 → S09 Skill runtime is proven;
- positive/negative fixtures pass;
- Skill-vs-no-Skill threshold passes;
- typecheck/tests/build/post-build pass;
- fresh independent verification passes;
- S13I remains NOT_STARTED.
