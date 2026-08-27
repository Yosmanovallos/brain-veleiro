# BRAIN — Execution Package Contract S13G

**Status:** Canonical S13G semantic/execution contract  
**Step:** S13G — task-prompt-compiler  
**Layer:** Intelligence  
**Execution mode:** SKILL_ONLY  
**New AgentDefinition:** NO  
**Context composition:** external/upstream Core-owned S05 responsibility  
**Task execution:** OUT OF SCOPE

---

## 1. Purpose

Define the exact bounded contract that converts one S13F `ImplementationPlanTask` into a provider-neutral `ExecutionPackage`.

The package is the Stage-11 handoff between:

```text
PLAN
→ TASK COMPILATION
→ later BUILD / execution
```

It is not a human-friendly prompt string.

It is structured data with enough provenance to explain:

- what should be done;
- which instructions are authoritative;
- which bounded context is available;
- which provider-neutral tool/capability declarations may be used later;
- which limits apply;
- what output shape is expected;
- what acceptance criteria define success;
- what evidence must later prove success.

S13G never performs that target work.

---

## 2. Existing contracts reused

Part B MUST reuse existing repository types where available.

### S13F

Reuse:

```text
ImplementationPlanTask
TaskAcceptanceCriterion
TaskEvidenceRequirement
ImplementationPlanningSpecSnapshot
```

Do not duplicate `ImplementationPlanTask`.

### S10

Reuse:

```text
AgentDefinition
JsonSchemaLike
Agent limits / context policy / permissions
```

Do not redefine AgentDefinition.

### S12

Reuse:

```text
SkillDefinition
SkillDefinition requires/permissions/rules/procedure
```

Selected target Skills are already loaded S12 definitions.

### S05

Preserve the semantic fields of:

```text
CONTEXT_PACKET.schema.yaml
```

Part B may define a local TypeScript-compatible snapshot/projection because no canonical runtime TS type currently exists, but it MUST not redefine S05 semantics.

---

## 3. Canonical TypeScript-compatible shapes

The following semantic shapes are canonical. Mechanical import names may follow repository reality, but semantics must remain equivalent.

```ts
export type TaskCompilationStatus = "READY" | "BLOCKED";

export interface TaskCompilationSpecSnapshot {
  spec_id: string;
  version: string;
  approval: ApprovalSnapshot;

  requirements: PlanningRequirement[];
  non_functional_requirements: PlanningNonFunctionalRequirement[];
  constraints: PlanningConstraint[];
  assumptions: PlanningAssumption[];
  acceptance_criteria: PlanningAcceptanceCriterion[];
}
```

The arrays above are task-local bounded projections only.

Every included item MUST be material to the task.

### Context Pack projection

```ts
export type ContextStatus =
  | "VERIFIED"
  | "PROVIDED"
  | "ASSUMED"
  | "PROPOSED"
  | "UNKNOWN"
  | "BLOCKED";

export type ContextSourceLayer =
  | "identity"
  | "user context"
  | "durable memory"
  | "project instructions"
  | "compiled knowledge"
  | "historical sessions"
  | "current verified state"
  | "working context"
  | "child-agent packet";

export interface TaskCompilationContextProvenance {
  source_type: string;
  source_ref: string;
  observed_or_retrieved_at?: string;
}

export interface TaskCompilationContextRelevance {
  reason: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface TaskCompilationContextItem {
  id: string;
  source_layer: ContextSourceLayer;
  authority_rank: number;
  authority_name?: string;
  status: ContextStatus;
  provenance: TaskCompilationContextProvenance;
  relevance: TaskCompilationContextRelevance;
  evidence_ref?: string;

  // Existing S05 schema may carry reference and/or bounded inline content.
  // Part B must preserve the actual canonical fields present in repository.
  [key: string]: unknown;
}

export interface TaskCompilationContextPackSnapshot {
  id: string;

  objective: {
    statement: string;
    spec_ref?: string;
    acceptance_criteria_refs?: string[];
    quality_contract_ref?: string;
  };

  authority_policy: {
    ordering: Array<{
      rank: number;
      name: string;
    }>;
  };

  budget: Record<string, unknown>;

  items: TaskCompilationContextItem[];

  thread_ref?: string;
  run_ref?: string;
  parent_context_pack_ref?: string;
  selection?: Record<string, unknown>;
}
```

`Record<string, unknown>` above is a compatibility placeholder only for fields already present in the canonical S05 schema. Part B MUST validate the actual existing schema rather than use it as permission to invent fields.

### Selected target Skills

Use:

```ts
SkillDefinition[]
```

No competing selected-Skill type is required for input.

### Capability selection

```ts
export interface TaskCompilationCapability {
  id: string;
  source_refs: string[];
}
```

Capability IDs are provider-neutral.

### Constraints

```ts
export interface TaskCompilationConstraint {
  ref: string;
  statement: string;
  source_refs: string[];
}
```

### Canonical input

```ts
export interface TaskCompilationInput {
  task: ImplementationPlanTask;

  spec: TaskCompilationSpecSnapshot;

  agent_definition: AgentDefinition;

  context_pack: TaskCompilationContextPackSnapshot;

  selected_skills: SkillDefinition[];

  capabilities: TaskCompilationCapability[];

  constraints: TaskCompilationConstraint[];

  acceptance: TaskAcceptanceCriterion[];

  evidence_required: TaskEvidenceRequirement[];
}
```

---

## 4. Execution Package shapes

### Instruction

```ts
export type ExecutionInstructionKind =
  | "TASK"
  | "SPEC"
  | "SKILL"
  | "CONSTRAINT"
  | "POLICY"
  | "SAFETY";

export interface ExecutionInstruction {
  id: string;
  kind: ExecutionInstructionKind;
  text: string;
  source_refs: string[];
}
```

### Objective

```ts
export interface ExecutionObjective {
  statement: string;
  task_ref: string;
  spec_refs: string[];
}
```

`statement` MUST preserve `task.outcome`.

### Context

```ts
export interface ExecutionContext {
  context_pack_ref: string;
  objective: TaskCompilationContextPackSnapshot["objective"];
  authority_policy: TaskCompilationContextPackSnapshot["authority_policy"];
  budget: TaskCompilationContextPackSnapshot["budget"];
  items: TaskCompilationContextPackSnapshot["items"];
}
```

This is a faithful immutable projection of the supplied Context Pack.

### Tool declaration

```ts
export interface ExecutionToolDeclaration {
  id: string;
  capability_ref: string;
}
```

No provider fields are allowed.

Forbidden examples:

```text
provider
connector
mcp_server
credential
token
oauth_session
implementation_class
endpoint
runtime_handle
```

### Limits

```ts
export interface ExecutionLimits {
  max_turns: number;
  timeout_ms: number;
  context_budget: TaskCompilationContextPackSnapshot["budget"];
}
```

No additional limit may be invented.

### Selected Skill reference

```ts
export interface ExecutionSkillRef {
  id: string;
  version: string;
}
```

### Package

```ts
export interface ExecutionPackage {
  schema_version: "1.0";

  package_id: string;
  task_ref: string;
  agent_definition_ref: string;

  selected_skill_refs: ExecutionSkillRef[];
  capability_refs: string[];

  objective: ExecutionObjective;
  instructions: ExecutionInstruction[];
  context: ExecutionContext;
  tools: ExecutionToolDeclaration[];
  limits: ExecutionLimits;

  output_schema: JsonSchemaLike;

  acceptance: TaskAcceptanceCriterion[];
  evidence: TaskEvidenceRequirement[];
}
```

### Result

```ts
export interface TaskCompilationResult {
  status: TaskCompilationStatus;
  blockers: string[];
  package: ExecutionPackage | null;
}
```

---

## 5. Deterministic input invariants

### 5.1 Task readiness

Required:

```text
task.compilation_readiness == READY_FOR_S13G
```

Otherwise BLOCKED.

### 5.2 Task-local Spec

All task material refs MUST resolve.

The bounded Spec snapshot MUST NOT contain unrelated material refs.

Mechanical supporting metadata may be preserved when necessary, but material requirements/constraints/acceptance are task-local.

### 5.3 Spec approval

The bounded snapshot MUST preserve approved status.

S13G does not upgrade approval.

### 5.4 Acceptance equality

Normalize and compare:

```text
input.acceptance
==
task.acceptance
```

Semantic mismatch → BLOCKED.

Order-only normalization is allowed when order has no canonical semantic meaning.

### 5.5 Evidence equality

Normalize and compare:

```text
input.evidence_required
==
task.evidence_required
```

Semantic mismatch → BLOCKED.

### 5.6 Constraint resolution

Every:

```text
task.constraint_refs
```

MUST resolve to one supplied constraint and to valid upstream source material where applicable.

Unknown / duplicate / conflicting constraint refs → BLOCKED.

### 5.7 Agent identity

If:

```text
task.agent_definition_ref
```

exists, it MUST equal:

```text
input.agent_definition.id
```

### 5.8 Selected Skills

Every supplied target Skill MUST:

- be a valid S12 `SkillDefinition`;
- be unique by `id@version`;
- have `id` allowed by `AgentDefinition.skills`.

No full catalog access is needed.

### 5.9 Capability compatibility

For each selected Skill:

```text
set(skill.requires.capabilities)
⊆
set(input.capabilities[].id)
```

For each compilation capability:

```text
capability.id ∈ AgentDefinition.capabilities
capability.id ∈ AgentDefinition.tools
```

where current S10 normalization requires the same target execution set.

Any contradiction → BLOCKED.

### 5.10 Permission compatibility

Selected Skill permission policy MUST not prohibit a capability that the compilation input requires for that Skill.

S13G does not implement provider-side invocation enforcement.

### 5.11 Context Pack validity

Validate against actual canonical S05 schema semantics.

At minimum:

- non-empty `id`;
- objective statement;
- canonical authority ordering;
- bounded budget metadata;
- item ids unique;
- required item source layer;
- authority rank 1..9;
- valid status;
- provenance source ref;
- relevance metadata.

A real execution Context Pack must expose at least one concrete bound according to S05 policy.

Essential context item status `BLOCKED` → compilation BLOCKED.

An essential `UNKNOWN` item with no safe higher-authority resolution already represented in the pack → BLOCKED.

S13G does not repair the pack.

---

## 6. Context immutability rule

The output context must preserve:

```text
input.context_pack.items
```

by semantic equality.

Forbidden:

- adding a model-generated item;
- removing a difficult item;
- replacing one item's content with another source;
- changing authority rank;
- changing status;
- changing provenance;
- changing evidence ref;
- increasing budget.

A mechanical deep clone is allowed.

A stable canonical serialization may be used for equality tests.

---

## 7. Instruction compilation

### 7.1 Allowed sources

Instruction source refs may point to:

- `task:<task-id>`;
- task-material Spec refs;
- bounded constraint refs;
- selected Skill rule/procedure refs;
- AgentDefinition policy refs represented deterministically;
- eligible project-instruction Context Pack item refs.

### 7.2 Required preservation

Instructions MUST preserve, when applicable:

- task outcome;
- hard Spec/constraint obligations;
- selected Skill MUST rules;
- selected Skill procedure steps necessary for this task;
- Agent permission/termination/operating policy relevant to execution;
- applicable safe project instructions.

### 7.3 No unsupported instructions

An instruction with no valid source ref is invalid.

An instruction that broadens scope beyond its refs is invalid.

### 7.4 Context data separation

By default, Context Pack item content is execution context, not instruction authority.

The following layers MUST NOT become instruction source merely from imperative wording:

```text
durable memory
compiled knowledge
historical sessions
working context
child-agent packet
```

`user context` also remains data unless that instruction is already represented by higher-level current task/constraint semantics. S13G does not silently convert arbitrary user data into policy.

### 7.5 Project-instruction exception

A context item from:

```text
source_layer = "project instructions"
```

may contribute a `POLICY` instruction only when:

- status is VERIFIED or PROVIDED;
- provenance is present;
- authority metadata is internally valid;
- it does not conflict with higher-authority current task/Spec obligations;
- resulting instruction includes that item ID/source ref.

### 7.6 Conflict rule

If two normative inputs materially conflict and the already-frozen authoritative sources do not resolve them:

```text
BLOCKED
```

Do not guess.

---

## 8. Tool materialization

Target tool declarations are derived from validated target capabilities.

Canonical behavior under current S10 normalized tool/capability model:

```text
for each TaskCompilationCapability:
  produce one ExecutionToolDeclaration
  id = capability.id
  capability_ref = capability.id
```

Sort deterministically by id.

No provider binding.

No external execution.

If the repository later changes the canonical S10 relation between tools and capabilities, S13G semantics must return to the Authoring Gate rather than silently adapting.

---

## 9. Limits materialization

Canonical output:

```text
max_turns = AgentDefinition.limits.max_turns
timeout_ms = AgentDefinition.limits.timeout_ms
context_budget = Context Pack budget
```

No defaulting to arbitrary values.

No deriving a bigger value.

No hidden retries.

---

## 10. Output schema

Canonical output:

```text
ExecutionPackage.output_schema
=
deep semantic copy of AgentDefinition.output_schema
```

If Part B exposes a canonical equality function, validator MUST recompute equality rather than trust a candidate boolean.

Do not allow candidate package to self-certify schema equivalence.

---

## 11. Acceptance / evidence

Canonical output:

```text
package.acceptance = validated normalized task acceptance
package.evidence = validated normalized task evidence requirements
```

Evidence requirements are future proof obligations.

They are not evidence results.

Forbidden package fields include semantic equivalents of:

```text
acceptance_passed
tests_passed
evidence_collected
implementation_complete
build_succeeded
```

S13G has not executed the target task.

---

## 12. Package metadata

### schema_version

```text
1.0
```

### package_id

MUST be deterministic from bounded execution identity.

Recommended canonical materialization:

```text
EP:<task.id>:<context_pack.id>:<agent_definition.id>
```

If characters require mechanical escaping, use a deterministic reversible escaping rule.

Do not use random UUIDs in deterministic fixtures.

### task_ref

```text
task.id
```

### agent_definition_ref

```text
agent_definition.id
```

### selected_skill_refs

Deterministically sorted:

```text
[{id, version}, ...]
```

### capability_refs

Deterministically sorted unique target capability IDs.

---

## 13. Forbidden package fields / semantic leakage

A READY `ExecutionPackage` MUST NOT contain provider/runtime implementation fields such as:

```text
provider
provider_id
connector
mcp
mcp_server
credential
secret_value
token
oauth_session
api_key
runtime_handle
implementation_class
shell_command_to_execute_now
execution_result
workflow_state
workflow_node
retry_state
task_executor
run_now
deployment_result
git_commit_result
```

The validator should use structured key/shape rules, not pretend an arbitrary text regex can perfectly detect every semantic leak.

Human-readable instruction text may contain ordinary words like "provider" or "token" when discussing a task; semantic validation must not mistake that alone for a forbidden structured binding.

---

## 14. Secret handling

Known secret values MUST NOT enter the package.

Reference fixtures should represent explicit secret-bearing fields or tagged fixture values.

Do not claim generic perfect secret scanning.

If a required secret value would be needed at later execution:

- package may refer only to an approved opaque secret reference if upstream contract supplies one;
- actual injection occurs at a later provider/auth boundary.

S13G does not add a Secret Manager.

---

## 15. Compiler execution model

No dedicated S13G AgentDefinition.

Recommended Part B shape:

```ts
compileTaskExecutionPackage(input, executionHarness)
```

or equivalent dependency injection.

The S13G compiler Skill itself executes through:

```text
S12 metadata discovery
→ select compiler Skill
→ lazy load compiler Skill
→ caller-supplied compatible AgentDefinition
→ S10 compileAgentDefinition()
→ S09 runAgent()
→ parse semantic candidate
→ deterministic package validation
```

No compiler-specific branch in Core.

No direct synthesizer-only call is sufficient for shared S13x acceptance step 8.

Tests may additionally call deterministic validators/materializers directly for unit coverage.

---

## 16. Distinguish two Skill sets

Part B MUST clearly distinguish:

### Compiler Skill

```text
intelligence.task-prompt-compiler.s13g
```

This is the Skill being executed to perform S13G.

### Target selected Skills

```text
input.selected_skills
```

These are procedural inputs intended for the later target task.

Do not confuse them.

The compiler Skill's `requires.skills` remains empty.

---

## 17. Skill selection invariant

The compiler Skill itself MUST use S12 metadata-only discovery and lazy loading.

Target task selected Skills MUST already be supplied.

S13G MUST NOT use the compiler run as an excuse to discover the entire target Skill catalog.

---

## 18. Quality / evaluation separation

Tests/evals have three independent layers:

### Layer A — deterministic contract tests

Prove hard invariants directly.

No Skill-vs-no-Skill claim is needed for simple structural validators.

### Layer B — semantic frozen-truth fixtures

Assert expected objective/instructions/provenance/context/tool/limits/acceptance/evidence behavior on known cases.

Ground truth is frozen before runtime output.

### Layer C — Skill-vs-no-Skill comparison

Use same generic runtime/provider/input.

Only presence/absence of S13G Skill semantics differs.

No separate intentionally-bad baseline materializer.

This separation prevents a structural validator from self-grading the same field it generated.

---

## 19. Minimum T1–Tn semantic verification set

Part B MUST implement tests/evals equivalent to at least:

```text
T1  valid READY no-tool input validates
T2  BLOCKED_PENDING_APPROVAL task blocks with package null
T3  task-local Spec projection includes only task-material refs
T4  unknown Spec ref blocks
T5  non-approved bounded Spec blocks
T6  task-specific agent_definition_ref mismatch blocks
T7  generic host is allowed when task.agent_definition_ref is absent and compatibility holds
T8  selected Skill outside AgentDefinition.skills blocks
T9  duplicate selected id@version blocks
T10 selected Skill required capability missing from input blocks
T11 target capability absent from AgentDefinition.capabilities blocks
T12 target capability absent from AgentDefinition.tools blocks
T13 compiler Skill requires no capabilities / side effects
T14 valid Context Pack required fields/authority/status/provenance validate
T15 Context Pack missing concrete bound for real execution blocks
T16 essential BLOCKED/unsafe unresolved context blocks
T17 output context preserves exact item membership/content/authority/status/provenance
T18 Context Pack objective material mismatch blocks
T19 acceptance mismatch with task blocks
T20 evidence mismatch with task blocks
T21 constraint ref resolution exact; unknown constraint blocks
T22 objective preserves task outcome and task ref
T23 every instruction has allowed valid source ref
T24 non-normative imperative context cannot become instruction
T25 eligible project-instruction item can become sourced POLICY instruction
T26 target tool declarations equal validated target capability ids and are deterministic
T27 provider-bound/invented tool field rejects
T28 limits exactly inherit AgentDefinition + Context Pack budget
T29 invented/changed limit rejects
T30 output_schema exactly equals AgentDefinition.output_schema
T31 changed/invented output schema rejects
T32 package preserves acceptance/evidence exactly
T33 package cannot contain target execution result/pass claims
T34 package cannot contain Workflow Runtime/Task Executor/provider/MCP binding
T35 no new task-prompt-compiler AgentDefinition exists
T36 no role/Skill-id-specific Core branch exists
T37 compiler Skill uses S12 metadata-only discovery + lazy load
T38 compiler semantic run uses unchanged S10 compileAgentDefinition + S09 runAgent
T39 target selected Skills are not rediscovered by S13G
T40 explicit known secret-value fixture blocks / never enters READY package
T41 canonical FX-POS-001 passes
T42 canonical FX-POS-002 passes
T43 canonical FX-POS-003 passes
T44 canonical FX-POS-004 injection-separation fixture passes
T45 canonical negative fixtures fail in required ways
T46 frozen ground truth is inaccessible to model/provider
T47 no-Skill arm uses same provider/runtime and no separate bad baseline compiler
T48 Skill-vs-no-Skill meets +6 / 3 dimensions / +2 each threshold
T49 no hard invariant regression
T50 full prior regression suite remains green
```

Mechanical grouping is allowed.

Semantic coverage MUST NOT be reduced merely to lower test count.

---

## 20. Skill-vs-no-Skill dimensions

Compare independently:

```text
objective_and_scope_fidelity
instruction_quality_and_provenance
context_fidelity_and_boundedness
skill_compilation_correctness
capability_tool_safety
limits_and_schema_fidelity
acceptance_evidence_fidelity
security_and_instruction_separation
stage_boundary_and_provider_neutrality
```

Do not hide a hard-invariant failure inside a weighted aggregate.

---

## 21. Deterministic provider restrictions

A deterministic reference ModelProvider used for S13G eval MUST NOT:

```text
if (skillId === S13G_ID) ...
if (fixtureId === ...) ...
if (withSkill) ...
```

It MUST NOT import frozen fixture truth.

It MAY behave differently because the actual materialized input/instructions differ when selected Skill content is present; that is the phenomenon being evaluated.

Independent review must inspect source to prove this.

---

## 22. Part B candidate module scope

A bounded implementation may use responsibilities equivalent to:

```text
src/intelligence/task-prompt-compiler/
  constants.ts
  types.ts
  validateTaskCompilationInput.ts
  projectTaskCompilationSpec.ts
  validateContextPackSnapshot.ts
  validateTargetExecutionCompatibility.ts
  compileExecutionInstructions.ts
  materializeExecutionTools.ts
  materializeExecutionLimits.ts
  validateExecutionPackage.ts
  compileTaskExecutionPackage.ts
  compareTaskCompilationRuns.ts
  index.ts
```

Plus:

```text
src/intelligence/skills/definitions/taskPromptCompilerS13G.ts
tests/task-prompt-compiler/...
```

Exact filenames may follow repo conventions.

Do not add a new AgentDefinition.

---

## 23. Forbidden Part B scope

Part B MUST NOT implement:

```text
Context Pack composition/retrieval
ContextProvider
Capability Registry
tool/provider adapters
MCP
Connector/Auth
Tool execution
Task Executor
Workflow Runtime
Execution Graph
BUILD implementation
repository-git-workflow S13H
full guardrails-security S13L
Agent Factory
Skill Factory
multi-agent delegation
automatic durable-memory promotion
```

---

## 24. Independent verification requirements

Before S13G overall PASS:

1. primary builder completes Part B and deterministic QA;
2. a read-only independent pass not authored by that implementation rechecks:
   - Part A integrity;
   - package contract;
   - runtime path;
   - no Agent;
   - context ownership;
   - provider-neutral tool boundary;
   - injection separation;
   - Skill-vs-no-Skill raw counts;
   - T1–T50/equivalent mapping;
   - typecheck/tests/build/post-build;
   - git/state/handoff;
   - S13H NOT_STARTED.

Builder self-review alone is not final independent verification.

---

## 25. PASS criteria

S13G closes PASS only when all are true:

1. ChatGPT Part A integrated verbatim.
2. S13G Skill remains SKILL_ONLY.
3. No new AgentDefinition.
4. Task must be READY_FOR_S13G.
5. Context Pack remains Core-composed and immutable through S13G.
6. Selected target Skills are already selected and are allowlisted.
7. Target capability/tool output remains provider-neutral and unbound.
8. Objective/instructions are source-traceable.
9. Untrusted context does not escalate into instructions.
10. Limits/output schema are inherited, not invented.
11. Acceptance/evidence are preserved, not weakened.
12. No secret values are knowingly packaged.
13. No target execution occurs.
14. No later-stage runtime/provider/S13H scope is pulled forward.
15. All hard invariants pass.
16. Positive fixtures pass.
17. Negative fixtures fail as required.
18. Skill-vs-no-Skill strict improvement threshold passes.
19. Generic S12 → S10 → S09 compiler runtime proof passes.
20. typecheck passes.
21. full tests pass.
22. clean build passes.
23. post-build tests pass.
24. independent verification passes.
25. STATE/CURRENT/handoff are updated only after verified closure.
26. commit/push succeeds if PASS.
27. STOP before S13H.
