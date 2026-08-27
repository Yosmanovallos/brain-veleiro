# IMPLEMENTATION_PLANNING_SKILL_S13F

## Identity

```yaml
id: intelligence.implementation-planning.s13f
version: 1.0.0
step: S13F
name: implementation-planning
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral: true
```

## Purpose

Convert an approved bounded Spec plus architecture and, where applicable, agent-design decisions into a deterministic implementation plan with P0/P1/P2 scope, small verifiable tasks, explicit static dependencies, milestones, high-risk assumptions, and stop/de-scope rules.

This Skill produces planning semantics only. It does not execute tasks and does not compile execution packages.

## Canonical boundary

S13F corresponds to Stage 10 `PLAN`.

S13G corresponds to Stage 11 `TASK-COMPILATION`.

This Skill MUST stop at the Stage 10 boundary.

### Allowed output semantics

- milestones / increments;
- static task dependencies;
- small verifiable task boundaries;
- P0/P1/P2 scope;
- highest-risk assumptions;
- stop/de-scope rules;
- requirement/constraint/decision traceability;
- acceptance and evidence requirements;
- readiness of each task for later S13G compilation.

### Forbidden output semantics

The Skill MUST NOT create or bind:

- Execution Package;
- task prompt;
- objective/instructions package;
- Context Pack;
- selected Skills;
- tools;
- capabilities;
- runtime limits;
- output contract for an executor;
- Task Executor;
- Workflow Runtime;
- graph runtime;
- MCP;
- Agent Factory.

## Agent necessity

Canonical S13E hierarchy:

```text
one-pass semantic guidance → SKILL_ONLY
```

Implementation planning is bounded one-pass semantic synthesis.

Therefore:

```text
new implementation-planning AgentDefinition: FORBIDDEN
```

The caller may supply an already-compatible AgentDefinition or test harness to run the Skill through the existing generic runtime. This Skill does not select, create, materialize, or activate an AgentDefinition.

## Requires

```yaml
requires:
  skills: []
  tools: []
  connectors: []
  secret_refs: []
```

S13D and S13E outputs are input data, not Skill execution dependencies.

## Inputs

The canonical bounded input is `ImplementationPlanningInput`.

### 1. Spec

`ImplementationPlanningSpecSnapshot` is required.

It contains only planning-relevant fields derived from the canonical Spec:

- Spec id/version;
- ApprovalSnapshot;
- requirements `R-###`;
- non-functional requirements `NFR-###`;
- constraints `C-###`;
- assumptions `A-###`;
- acceptance criteria `AC-###`;
- source priorities `REQUIRED | SHOULD | OPTIONAL`;
- success / verification / evidence fields where present.

This bounded snapshot does not replace or redefine the canonical Spec artifact.

The Spec MUST be `APPROVED`.

If not:

```text
result.status = BLOCKED
tasks = []
```

### 2. Architecture

An architecture input is required for S13F bootstrap sequencing and contains:

```text
SoftwareArchitectureDecisionResult
+
ApprovalSnapshot
```

The S13D result is read-only.

Approval handling:

```text
REJECTED → BLOCKED
PENDING  → PROVISIONAL
APPROVED → eligible for READY
```

A PENDING architecture proposal is never treated as active. Tasks that materially reference it are `BLOCKED_PENDING_APPROVAL`, as are their transitive dependents.

### 3. Agent-design applicability

The caller MUST declare one of:

```text
APPLICABLE
NOT_APPLICABLE
```

If `APPLICABLE`, an `AgentEngineeringResult + ApprovalSnapshot` is required.

If absent:

```text
result.status = BLOCKED
```

If present:

```text
REJECTED → BLOCKED
PENDING  → PROVISIONAL for affected tasks
APPROVED → may contribute refs to READY tasks
```

S13F never activates a candidate AgentDefinition.

### 4. Quality Contract reference

A reference to the applicable S13F Quality Contract is required.

## Priority semantics

```text
P0 = required for minimum successful outcome
P1 = valuable after P0
P2 = optional if budget/risk permit
```

### Mapping rules

- Every `REQUIRED` requirement MUST be mapped to one or more P0 tasks or to an explicit blocker.
- `SHOULD` maps to P1 by default.
- `OPTIONAL` maps to P2 by default.
- Any exception MUST carry a traceable `priority_rationale`.
- P0 MUST NOT depend on P1 or P2.
- P1 MUST NOT depend on P2.
- P2 MAY depend on P0, P1, or P2 when the DAG remains valid.
- P0 MUST NOT be silently de-scoped.

Priority is scope semantics, not execution order by itself.

## Task contract

Each plan item MUST have:

```text
id
title
outcome
priority
priority_rationale
spec_refs
constraint_refs
assumption_refs
architecture_refs
agent_decision_refs
optional agent_definition_ref
depends_on
acceptance
evidence_required
compilation_readiness
blocked_by
```

### Small-task rule

A task is small and verifiable only when all are true:

1. one primary observable outcome;
2. acceptance can be decided from its own evidence plus declared prerequisites;
3. all acceptance criteria concern that same outcome;
4. two independently acceptable outcomes are split;
5. independent implementation surfaces are split unless atomicity is justified;
6. at least one material source ref justifies the task;
7. acceptance and evidence are explicit;
8. no Stage 11 execution-package fields are embedded.

Do not use arbitrary estimates such as hours, line counts, token counts, or file counts as the definition of “small”.

## Acceptance contract

Each task acceptance criterion contains:

```text
id
condition
verification_method
evidence_expected
```

The condition MUST be binary enough to support a PASS/FAIL judgment.

`verification_method` describes the verification class or approach. It does not invent a concrete command when the input does not provide one.

## Evidence contract

Each task contains one or more evidence requirements:

```text
kind
description
source_ref
```

Allowed evidence kinds are bounded to:

```text
TYPECHECK
BUILD
STATIC_ANALYSIS
UNIT_TEST
INTEGRATION_TEST
E2E_TEST
SECURITY_CHECK
PERFORMANCE_CHECK
ARTIFACT_INSPECTION
MANUAL_REVIEW
OTHER_DETERMINISTIC
```

`MANUAL_REVIEW` requires an explicit reason why deterministic evidence is insufficient.

## Static dependency model

`depends_on` is the single canonical source of dependency edges.

Validation MUST reject:

- missing dependency refs;
- self-dependencies;
- duplicate dependencies;
- cycles;
- P0 → P1/P2;
- P1 → P2;
- milestone ordering that points to a later milestone.

A deterministic topological order MAY be derived but MUST NOT become a second source of truth.

S13F does not execute the graph.

## Milestones / increments

Every task MUST belong to exactly one milestone.

Each milestone contains:

```text
id
title
objective
task_ids
exit_criteria
```

Milestones are ordered.

A milestone exit criterion describes the observable increment completed by its task set.

## Highest-risk assumptions

The plan MUST surface material assumptions that can invalidate cost, sequencing, feasibility, or acceptance.

Each item contains:

```text
ref
statement
impact
validation_strategy
affected_task_ids
```

Prefer upstream `A-###` refs. A planning-local assumption is allowed only when clearly marked as derived and not promoted to durable truth.

## Stop / de-scope rules

Each rule contains:

```text
trigger
action
affected_priorities
protected_scope
rationale
```

Required behavior:

1. de-scope P2 before P1;
2. protect P0;
3. never remove P0 silently;
4. if minimum successful outcome is no longer achievable, stop/escalate instead of falsely returning READY.

## Approval and plan status

Plan status is one of:

```text
READY
PROVISIONAL
BLOCKED
```

### READY

Allowed only when:

- Spec is APPROVED;
- architecture decision is not rejected;
- all material upstream decisions required by READY tasks are APPROVED;
- agent-design applicability is satisfied;
- all structural validators pass.

### PROVISIONAL

Allowed when:

- Spec is APPROVED;
- no required upstream decision is REJECTED;
- at least one material architecture or agent-design decision is PENDING.

Affected tasks and transitive dependents MUST be:

```text
BLOCKED_PENDING_APPROVAL
```

No PENDING proposal becomes active.

### BLOCKED

Required when any of these hold:

- Spec is not APPROVED;
- architecture is REJECTED;
- agent-design is APPLICABLE but missing;
- applicable agent-design is REJECTED;
- bounded input is invalid or materially incomplete.

A BLOCKED result MUST explain blockers and MUST NOT masquerade as an executable plan.

## S13G handoff fields

A task may carry only planning-level data needed to serve as the Stage 11 `task`:

```text
task id/title/outcome
priority
source refs
decision refs
optional approved AgentDefinition ref
dependencies
acceptance
evidence required
compilation readiness
```

The following remain unresolved until S13G:

```text
Context Pack
selected Skills
capability bindings
tool bindings
execution instructions
limits
executor output contract
Execution Package
```

## Deterministic rendering

The structured `ImplementationPlanResult` is authoritative.

`plan_markdown` MUST be rendered deterministically from that structure.

No semantic information may exist only in Markdown.

## Procedure

1. Validate bounded input and approval snapshots.
2. Build the material-ref set from the Spec.
3. Read architecture and agent-engineering inputs without mutation.
4. Identify minimum successful outcome and scope tiers.
5. Produce milestone candidates.
6. Decompose outcomes into small verifiable task candidates.
7. Attach source and decision refs.
8. Attach acceptance and evidence requirements.
9. Assign P0/P1/P2 with rationale.
10. Build static `depends_on`.
11. Validate DAG and tier dependency invariants.
12. Propagate pending-approval blocking transitively.
13. Surface highest-risk assumptions.
14. Produce stop/de-scope rules.
15. Compute source-derived coverage counts.
16. Reject or repair semantic invalidity inside the bounded planning pass.
17. Produce structured result.
18. Render deterministic Markdown.
19. Stop before Stage 11.

## Coverage

Coverage denominators MUST be derived from bounded source refs.

At minimum report:

```text
required_total
required_mapped_to_p0
required_blocked
should_total
should_mapped
optional_total
optional_mapped
acceptance_total
acceptance_mapped
unmapped_material_refs
```

Do not invent a denominator after seeing model output.

## Failure conditions

Semantic failure includes:

- missing P0 coverage for a REQUIRED ref without blocker;
- invalid P0/P1/P2 dependency direction;
- dependency cycle;
- task with multiple independent primary outcomes;
- task without acceptance;
- task without evidence;
- unresolved or invented material refs;
- silent activation of PENDING/REJECTED decisions;
- hidden de-scope of P0;
- Stage 11 fields emitted by S13F;
- plan Markdown disagreeing with structured result.

Mechanical failure includes parser/type/rendering defects that do not change this contract.

Semantic failures return to ChatGPT Authoring Gate. Mechanical failures may be repaired locally without changing semantics.

## Success criteria

S13F succeeds only when:

- the Part A artifacts are integrated verbatim;
- real positive and negative examples pass;
- deterministic structural validators pass;
- DEEP Quality Contract passes;
- the same evaluation suite demonstrates meaningful Skill improvement over a no-Skill baseline on independent frozen ground-truth assertions;
- typecheck/tests/build/post-build tests pass;
- verification evidence is recorded;
- no S13G scope is pulled forward.
