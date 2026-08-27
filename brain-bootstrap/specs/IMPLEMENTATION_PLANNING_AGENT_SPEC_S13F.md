# IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F

## Status

```yaml
step: S13F
artifact_role: execution_and_integration_spec
new_agent_definition: false
agent_need: SKILL_ONLY
quality_depth: DEEP
```

The filename follows the S13x Part A convention. Semantically, this artifact explicitly specifies that S13F MUST NOT create a dedicated implementation-planning AgentDefinition.

## 1. Purpose

Define the execution/integration contract for the S13F implementation-planning Skill while preserving:

```text
S12 Skill discovery/load
→ S10 compileAgentDefinition()
→ S09 runAgent()
```

No role-specific runtime is added.

S13F adds Intelligence semantics and deterministic validation around implementation planning only.

## 2. Canonical TypeScript contract

Part B MUST implement equivalent semantics to the following shapes. Mechanical naming refinements are allowed only if they preserve semantics exactly.

```ts
export type ApprovalStatus = "APPROVED" | "PENDING" | "REJECTED";

export interface ApprovalSnapshot {
  status: ApprovalStatus;
  evidence_ref?: string;
}

export type SpecPriority = "REQUIRED" | "SHOULD" | "OPTIONAL";
export type PlanPriority = "P0" | "P1" | "P2";

export interface PlanningRequirement {
  ref: string;
  priority: SpecPriority;
  statement: string;
  acceptance_refs: string[];
}

export interface PlanningNonFunctionalRequirement {
  ref: string;
  statement: string;
  success_condition?: string;
  verification_approach?: string;
  evidence_expected?: string;
}

export interface PlanningConstraint {
  ref: string;
  statement: string;
}

export interface PlanningAssumption {
  ref: string;
  statement: string;
}

export interface PlanningAcceptanceCriterion {
  ref: string;
  success_condition: string;
  verification_approach?: string;
  evidence_expected?: string;
}

export interface ImplementationPlanningSpecSnapshot {
  spec_id: string;
  version: string;
  approval: ApprovalSnapshot;
  requirements: PlanningRequirement[];
  non_functional_requirements: PlanningNonFunctionalRequirement[];
  constraints: PlanningConstraint[];
  assumptions: PlanningAssumption[];
  acceptance_criteria: PlanningAcceptanceCriterion[];
}

export interface ApprovedDecisionInput<T> {
  result: T;
  approval: ApprovalSnapshot;
}

export type AgentDesignApplicability = "APPLICABLE" | "NOT_APPLICABLE";

export interface ImplementationPlanningInput {
  spec: ImplementationPlanningSpecSnapshot;
  architecture: ApprovedDecisionInput<SoftwareArchitectureDecisionResult>;
  agent_design_applicability: AgentDesignApplicability;
  agent_engineering?: ApprovedDecisionInput<AgentEngineeringResult>;
  quality_contract_ref: string;
}

export type EvidenceKind =
  | "TYPECHECK"
  | "BUILD"
  | "STATIC_ANALYSIS"
  | "UNIT_TEST"
  | "INTEGRATION_TEST"
  | "E2E_TEST"
  | "SECURITY_CHECK"
  | "PERFORMANCE_CHECK"
  | "ARTIFACT_INSPECTION"
  | "MANUAL_REVIEW"
  | "OTHER_DETERMINISTIC";

export interface TaskAcceptanceCriterion {
  id: string;
  condition: string;
  verification_method: string;
  evidence_expected: string;
}

export interface TaskEvidenceRequirement {
  kind: EvidenceKind;
  description: string;
  source_ref?: string;
  manual_review_reason?: string;
}

export type TaskCompilationReadiness =
  | "READY_FOR_S13G"
  | "BLOCKED_PENDING_APPROVAL";

export interface ImplementationPlanTask {
  id: string;
  title: string;
  outcome: string;

  priority: PlanPriority;
  priority_rationale: string;

  spec_refs: string[];
  constraint_refs: string[];
  assumption_refs: string[];
  architecture_refs: string[];
  agent_decision_refs: string[];
  agent_definition_ref?: string;

  depends_on: string[];

  acceptance: TaskAcceptanceCriterion[];
  evidence_required: TaskEvidenceRequirement[];

  compilation_readiness: TaskCompilationReadiness;
  blocked_by: string[];
}

export interface ImplementationMilestone {
  id: string;
  title: string;
  objective: string;
  task_ids: string[];
  exit_criteria: string[];
}

export interface HighestRiskAssumption {
  ref: string;
  statement: string;
  impact: string;
  validation_strategy: string;
  affected_task_ids: string[];
}

export interface StopOrDeScopeRule {
  trigger: string;
  action: string;
  affected_priorities: PlanPriority[];
  protected_scope: string[];
  rationale: string;
}

export interface PlanCoverage {
  required_total: number;
  required_mapped_to_p0: number;
  required_blocked: number;

  should_total: number;
  should_mapped: number;

  optional_total: number;
  optional_mapped: number;

  acceptance_total: number;
  acceptance_mapped: number;

  unmapped_material_refs: string[];
}

export type ImplementationPlanStatus = "READY" | "PROVISIONAL" | "BLOCKED";

export interface ImplementationPlanResult {
  status: ImplementationPlanStatus;

  spec_ref: string;
  architecture_decision_refs: string[];
  agent_decision_refs: string[];

  milestones: ImplementationMilestone[];
  tasks: ImplementationPlanTask[];

  highest_risk_assumptions: HighestRiskAssumption[];
  stop_or_de_scope_rules: StopOrDeScopeRule[];

  coverage: PlanCoverage;

  blockers: string[];
  topological_order: string[];

  plan_markdown: string;
}
```

`SoftwareArchitectureDecisionResult` and `AgentEngineeringResult` MUST be imported from their existing S13D/S13E modules and consumed read-only. Do not duplicate them.

## 3. Input validation

### 3.1 Spec refs

Supported material ref families:

```text
R-###
NFR-###
C-###
A-###
AC-###
```

Validation MUST ensure uniqueness within each bounded category and reject malformed or duplicate refs.

### 3.2 Approval

Validation matrix:

| Spec | Architecture | Agent applicability | Agent input | Result |
|---|---|---|---|---|
| APPROVED | APPROVED | NOT_APPLICABLE | absent | eligible READY |
| APPROVED | PENDING | NOT_APPLICABLE | absent | PROVISIONAL |
| APPROVED | APPROVED | APPLICABLE | APPROVED | eligible READY |
| APPROVED | APPROVED | APPLICABLE | PENDING | PROVISIONAL |
| not APPROVED | any | any | any | BLOCKED |
| APPROVED | REJECTED | any | any | BLOCKED |
| APPROVED | any | APPLICABLE | absent | BLOCKED |
| APPROVED | any | APPLICABLE | REJECTED | BLOCKED |

This matrix is semantic and canonical.

## 4. Planning output validation

Part B MUST implement deterministic structural validation after semantic synthesis.

### 4.1 Task IDs

Task IDs MUST be unique and stable within one plan.

Recommended canonical form:

```text
TASK-001
TASK-002
...
```

### 4.2 Material refs

All task source refs MUST resolve inside the bounded input or explicitly allowed approved decision identifiers.

Unknown material refs are semantic invalidity.

Incidental text mentions do not count as material refs merely because a substring resembles an ID.

### 4.3 Priority

Validator MUST enforce:

```text
P0 !-> P1
P0 !-> P2
P1 !-> P2
```

where `A -> B` means task A depends on task B.

Every REQUIRED `R-###` MUST have:

```text
one or more mapped P0 tasks
OR
an explicit plan blocker
```

### 4.4 DAG

Implement a deterministic dependency validator.

It MUST detect:

- missing dependency;
- self dependency;
- duplicate dependency;
- direct cycle;
- indirect cycle.

A deterministic topological order is derived only after validation.

No execution scheduler is added.

### 4.5 Task atomicity

Structural checks cannot fully prove semantic atomicity.

Part B therefore uses two layers:

1. semantic generation/review under the S13F Skill;
2. deterministic checks for structural evidence of validity.

Ground-truth fixtures MUST independently assert atomicity on known examples.

### 4.6 Acceptance / evidence

Each task needs non-empty acceptance and evidence.

For `MANUAL_REVIEW`:

```text
manual_review_reason MUST be non-empty
```

No invented shell command is required by this contract.

### 4.7 Milestones

Every task appears in exactly one milestone.

Milestones are ordered.

If a task in milestone N depends on a task in a later milestone, validation fails.

### 4.8 Approval propagation

For every task that materially references a PENDING architecture or agent-design decision:

```text
compilation_readiness = BLOCKED_PENDING_APPROVAL
```

Then propagate that status through `depends_on` transitively.

A task may be `READY_FOR_S13G` only when all material approvals it depends on are APPROVED.

This is static compilation readiness, not runtime task completion state.

## 5. Deterministic coverage

Coverage denominators are computed from input before candidate-plan scoring.

Do not accept candidate-supplied totals.

At minimum:

```text
required_total = count(spec.requirements where priority=REQUIRED)
should_total = count(spec.requirements where priority=SHOULD)
optional_total = count(spec.requirements where priority=OPTIONAL)
acceptance_total = count(spec.acceptance_criteria)
```

Mappings are derived from validated task refs.

`unmapped_material_refs` is derived by set difference.

The implementation MUST NOT repair bad coverage by changing denominators.

## 6. Deterministic Markdown

Implement a renderer from `ImplementationPlanResult`.

Required sections:

```text
Status
P0
P1
P2
Milestones
Dependencies
Highest-risk assumptions
Stop/de-scope rules
Coverage
Blockers
S13G readiness
```

The renderer receives no model output other than the already validated structure.

Snapshot or exact-string tests are recommended.

## 7. Execution model

No new planning AgentDefinition is permitted.

Recommended integration shape:

```ts
planImplementation(input, executionHarness)
```

or equivalent dependency injection where:

- the caller supplies a compatible existing AgentDefinition / runtime harness;
- S13F supplies the selected Skill and bounded planning contract;
- S12 discovery/lazy load remains unchanged;
- S10 compileAgentDefinition() remains unchanged;
- S09 runAgent() remains unchanged.

Forbidden:

```text
if skillId === "implementation-planning" inside Core
if role === "planner" inside Core
new S13F-only runtime
```

Tests may use the deterministic reference model/provider already present in the repo. Evidence MUST call it a deterministic/reference provider, not a real production LLM.

## 8. Skill selection

S13F MUST use the S12 metadata-only discovery pattern:

```text
metadata discovery
→ select implementation-planning Skill
→ lazy load selected Skill body
→ generic compile/run path
```

No eager loading of all Skill bodies.

No Skill-id-specific branch in Core.

## 9. Part B file scope

Claude Code may create an implementation equivalent to:

```text
src/intelligence/implementation-planning/
  constants.ts
  types.ts
  validatePlanningInput.ts
  validateImplementationPlan.ts
  analyzeDependencies.ts
  computePlanCoverage.ts
  renderImplementationPlanMarkdown.ts
  planImplementation.ts
  index.ts
```

Exact mechanical filenames may vary if repository conventions require it, but responsibilities MUST remain bounded to S13F.

Tests may be added under the repo's existing test convention.

## 10. Part B forbidden scope

Do not add:

```text
ImplementationPlanning AgentDefinition
Workflow Runtime
Task Executor
task graph runtime
Prompt Compiler
Execution Package
Context Compiler
Capability Registry
MCP
Agent Factory
new durable-memory promotion
S13G code
S17 graph runtime code
```

Do not mutate S13D/S13E result types to make S13F easier.

## 11. Canonical fixtures

### F1 — READY

Approved Spec + approved Architecture + `NOT_APPLICABLE` agent design.

Expected:

- READY;
- REQUIRED covered by P0;
- SHOULD defaults P1;
- OPTIONAL defaults P2;
- valid DAG;
- acceptance/evidence on all tasks;
- deterministic coverage;
- no Stage 11 fields.

### F2 — PROVISIONAL

Approved Spec + PENDING Architecture.

Expected:

- PROVISIONAL;
- architecture-dependent tasks blocked;
- transitive dependents blocked;
- unaffected task may remain READY_FOR_S13G if it has no material dependency on the pending decision;
- no proposal activation.

### F3 — APPROVED AGENT DECISION

Approved Spec + approved Architecture + `APPLICABLE` + approved AgentEngineeringResult.

Expected:

- relevant tasks may reference the approved agent decision;
- AgentDefinition ref is carried only when the approved decision points to one;
- S13F does not create or activate an Agent.

### N1 — SPEC NOT APPROVED

Expected BLOCKED.

### N2 — CYCLE

Candidate:

```text
TASK-001 depends_on TASK-002
TASK-002 depends_on TASK-001
```

Expected validator rejection.

### N3 — PRIORITY INVERSION

Candidate P0 depends on P1/P2.

Expected validator rejection.

### N4 — UNVERIFIABLE TASK

Candidate task has no acceptance or evidence.

Expected validator rejection.

### N5 — MISSING AGENT INPUT

`APPLICABLE` with no AgentEngineeringResult.

Expected BLOCKED.

### N6 — STAGE 11 LEAK

Candidate contains fields such as:

```text
tools
context_packet
selected_skills
execution_instructions
execution_package
```

Expected boundary rejection.

### N7 — UNKNOWN MATERIAL REF

Candidate references an unknown `R-999`.

Expected rejection.

## 12. Skill-vs-no-Skill evaluation

Use the exact same:

- bounded input;
- model/provider/harness;
- output parse/validator;
- frozen ground-truth fixture assertions.

Compare these dimensions independently:

```text
scope_priority_correctness
task_atomicity
verifiability
dependency_quality
traceability_and_coverage
approval_safety
stage_boundary
risk_and_descope_quality
```

PASS requires:

```text
with-Skill hard invariants = 100%
with-Skill S13G boundary violations = 0
with-Skill total correct assertions >= no-Skill + 4
improvement spans >= 2 dimensions
each improved dimension contributes >= +2 correct assertions
no hard-invariant regression
```

Do not use a weighted score to hide failure in a hard dimension.

If a no-Skill fixture is already perfect, retain it as regression coverage or replace/add another evaluable fixture. Do not manufacture a one-assertion margin.

## 13. Minimum T1–Tn verification set

Part B MUST include tests equivalent in coverage to:

```text
T1  bounded input validates approved READY case
T2  non-approved Spec blocks
T3  rejected Architecture blocks
T4  APPLICABLE agent-design without result blocks
T5  pending Architecture creates PROVISIONAL
T6  pending Agent decision creates PROVISIONAL
T7  pending blocker propagates transitively
T8  REQUIRED coverage requires P0 or explicit blocker
T9  P0 cannot depend on P1/P2
T10 P1 cannot depend on P2
T11 missing dependency ref rejects
T12 self dependency rejects
T13 direct cycle rejects
T14 indirect cycle rejects
T15 task without acceptance rejects
T16 task without evidence rejects
T17 manual review without reason rejects
T18 unknown material ref rejects
T19 every task belongs to exactly one milestone
T20 later-milestone dependency rejects
T21 coverage denominator derives from input
T22 deterministic topological order
T23 deterministic Markdown derives from structured result
T24 Stage 11 forbidden field rejects
T25 no new planning AgentDefinition is introduced
T26 S12 metadata-only discovery + lazy load path remains
T27 generic S10/S09 runtime path remains
T28 canonical READY fixture passes
T29 canonical PROVISIONAL fixture passes
T30 canonical negative fixtures fail correctly
T31 Skill-vs-no-Skill uses frozen ground truth
T32 Skill improvement threshold passes across >=2 dimensions
T33 reference provider evidence is labeled accurately
T34 full regression suite remains green
```

Test numbers may be mechanically reorganized, but semantic coverage MUST not be reduced.

## 14. PASS criteria for S13F

S13F can close PASS only when all are true:

1. Part A integrated verbatim.
2. Part B stays within S13F boundary.
3. Independent review finds no semantic drift.
4. All S13F hard invariants pass.
5. Canonical positives pass.
6. Canonical negatives fail in the expected way.
7. Skill-vs-no-Skill threshold passes on frozen ground truth.
8. typecheck passes.
9. full tests pass.
10. clean build passes.
11. post-build tests pass.
12. verification report records exact evidence.
13. STATE/CURRENT/handoff are updated mechanically.
14. commit/push succeeds.
15. STOP before S13G.
