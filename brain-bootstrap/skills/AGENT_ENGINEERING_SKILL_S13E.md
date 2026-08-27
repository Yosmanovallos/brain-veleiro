# Brain Agent Engineering Skill — S13E

```yaml
id: agent-engineering.design.s13e
version: 1.0.0
description: >-
  Decide whether a work unit genuinely requires an Agent and, only when justified,
  design a bounded least-privilege single Agent using the canonical S10
  AgentDefinition contract for goal, state, tools/capabilities, permissions,
  memory, termination, limits, output schema, rubric, and evals.

applies_when:
  task_kinds:
    - agent-engineering
    - agent-necessity
    - agent-design
    - execution-model-selection
  signals:
    - agent
    - adaptive loop
    - state
    - tools
    - permissions
    - memory
    - termination
    - evals
  exclusions:
    - multi-agent orchestration
    - workflow-runtime design
    - capability-registry construction
    - MCP creation
    - agent implementation planning
    - automatic agent registration

inputs:
  - name: agent_engineering_input
    description: >-
      Bounded AgentEngineeringInput containing one work unit, optional architecture
      context, existing Agent descriptors, available Skill IDs, and available
      capability descriptors.
    required: true
    schema:
      type: object

outputs:
  - name: agent_engineering_result
    description: >-
      Structured AgentEngineeringResult containing an Agent-necessity decision and,
      only when needed, either an existing-Agent reuse recommendation or a proposed
      new S10-shaped AgentDefinition with design rationale.
    required: true
    schema:
      type: object

requires:
  skills: []
  capabilities: []
  context_sources:
    - CURRENT_TASK
    - EXPLICIT_SPEC
    - VERIFIED_HANDOFF
    - ADR
    - COMPILED_KNOWLEDGE
  quality_contract_refs:
    - brain-bootstrap/quality-contracts/S13E_AGENT_ENGINEERING_DEEP.yaml

rules:
  - id: AE-R1
    level: MUST
    statement: Decide whether an Agent is necessary before designing one.

  - id: AE-R2
    level: MUST
    statement: Complexity, use of an LLM, or a long prompt alone never justifies an Agent.

  - id: AE-R3
    level: MUST
    statement: Prefer DETERMINISTIC_FUNCTION when the work unit is a fixed mapping with known steps, no observation-dependent next action, no retry/replan loop, and no within-run adaptive state.

  - id: AE-R4
    level: MUST
    statement: Prefer SKILL_ONLY when semantic judgment or reusable guidance is useful but execution can complete in one bounded decision without an observe-act-retry loop or conditional capability use.

  - id: AE-R5
    level: MUST
    statement: An Agent is justified only when an adaptive observe-decide-act-observe loop is required and at least one additional agentic signal exists such as conditional capability use, retry/replan, or persistent within-run state.

  - id: AE-R6
    level: MUST
    statement: When an Agent is required, prefer REUSE_EXISTING over DESIGN_NEW when a supplied existing Agent descriptor explicitly covers the task kind and satisfies capability, permission, and safety requirements.

  - id: AE-R7
    level: MUST
    statement: Never invent an existing Agent, Skill ID, capability ID, side-effect class, or provider.

  - id: AE-R8
    level: MUST
    statement: agent-engineer-v1 itself performs no tool or capability calls.

  - id: AE-R9
    level: MUST
    statement: A newly designed Agent must conform structurally to the existing S10 AgentDefinition v1 contract without modifying S10.

  - id: AE-R10
    level: MUST
    statement: The candidate Agent tools and capabilities sets must be identical and must be subsets of the available capability IDs supplied in the bounded input.

  - id: AE-R11
    level: MUST
    statement: Candidate capability selection follows least privilege; optional or unrelated capabilities require explicit justification and are excluded by default.

  - id: AE-R12
    level: MUST
    statement: Candidate permissions must allow only the side-effect classes required by selected capabilities and must keep deny_unlisted_capabilities true.

  - id: AE-R13
    level: MUST
    statement: Within-run Agent state and cross-run memory are separate concerns and must not be conflated.

  - id: AE-R14
    level: MUST
    statement: Cross-run memory is disabled unless the work unit explicitly requires prior verified history across runs.

  - id: AE-R15
    level: MUST
    statement: In S13E v1, a proposed candidate Agent always sets commit_verified_memory false; S13E never authorizes automatic durable-memory commits.

  - id: AE-R16
    level: MUST
    statement: Candidate termination preserves S09/S10 terminal semantics and never invents new terminal outcome values.

  - id: AE-R17
    level: MUST
    statement: Every proposed Agent has bounded max_turns and timeout_ms justified by the work-unit iteration budget.

  - id: AE-R18
    level: MUST
    statement: Every proposed Agent has an explicit state schema and output schema appropriate to the work unit.

  - id: AE-R19
    level: MUST
    statement: Every proposed Agent includes non-empty eval refs covering goal success, output contract, least privilege, termination, and at least one negative or safety scenario.

  - id: AE-R20
    level: MUST
    statement: The proposed Agent rubric points to the work unit quality contract supplied in input; S13E does not fabricate a task-specific Quality Contract.

  - id: AE-R21
    level: MUST
    statement: Context policy remains bounded and source-ref aware; never inject the full Agent catalog, full Skill catalog, or unrelated historical context.

  - id: AE-R22
    level: MUST
    statement: Delegation remains false in S13E v1 because S09/S10 do not provide a multi-agent coordination model.

  - id: AE-R23
    level: MUST
    statement: If an Agent is required but a required capability, output schema, quality contract ref, or safe iteration bound is missing, return BLOCKED instead of inventing the missing contract.

  - id: AE-R24
    level: MUST
    statement: S13D architecture context, when supplied, is read-only and may constrain the design but is never mutated or treated as human-approved merely because S13E consumed it.

  - id: AE-R25
    level: MUST
    statement: Every S13E result is PROPOSED and approval_required true; no candidate Agent is automatically registered, activated, committed, or deployed.

  - id: AE-R26
    level: MUST
    statement: Skill-vs-baseline metrics must score against test-only independent fixture truth and must not derive expected truth from the same output or rules being evaluated.

  - id: AE-R27
    level: MUST
    statement: Do not create a generic Agent Factory, meta-runtime, Capability Registry, MCP layer, Workflow Runtime, or Orchestrator in S13E.

procedure:
  - id: AE-P1
    title: Validate bounded input
    instruction: >-
      Validate the work unit, output schema, quality-contract reference, behavioral
      signals, bounded catalogs, optional architecture context, and source refs.
    requires:
      - agent_engineering_input
    produces:
      - validated_agent_engineering_input

  - id: AE-P2
    title: Classify execution model
    instruction: >-
      Decide whether the work unit is best served by a deterministic function,
      Skill-only execution, or an Agent by applying the canonical necessity
      criteria without using complexity or LLM usage as sufficient evidence.
    requires:
      - validated_agent_engineering_input
    produces:
      - necessity_classification

  - id: AE-P3
    title: Check existing-Agent reuse
    instruction: >-
      When an Agent is required, compare the work unit against supplied existing
      Agent descriptors and prefer reuse only when task-kind support, capabilities,
      permissions, and safety constraints are explicitly compatible.
    requires:
      - necessity_classification
    produces:
      - reuse_decision

  - id: AE-P4
    title: Identify blocking design gaps
    instruction: >-
      Before designing a new Agent, verify required capability IDs, output schema,
      quality-contract ref, allowed context sources, and iteration budget are
      available. Return BLOCKED if a safe definition cannot be authored.
    requires:
      - reuse_decision
    produces:
      - design_readiness

  - id: AE-P5
    title: Design goal, state, and output
    instruction: >-
      For DESIGN_NEW, define the candidate objective, bounded state schema, and
      output schema while keeping work-unit success conditions traceable.
    requires:
      - design_readiness
    produces:
      - goal_state_output_design

  - id: AE-P6
    title: Design tools and permissions
    instruction: >-
      Select the minimum capability IDs needed from the supplied capability list,
      mirror them exactly into tools and capabilities, and derive least-privilege
      allowed side-effect classes.
    requires:
      - goal_state_output_design
    produces:
      - capability_permission_design

  - id: AE-P7
    title: Design memory policy
    instruction: >-
      Distinguish within-run state from cross-run memory. Disable memory unless
      explicit cross-run history is required. Never enable commit_verified_memory.
    requires:
      - capability_permission_design
    produces:
      - memory_design

  - id: AE-P8
    title: Design termination and limits
    instruction: >-
      Preserve canonical terminal semantics and bind max_turns/timeout_ms to the
      explicit work-unit iteration budget with an explanatory stop rationale.
    requires:
      - memory_design
    produces:
      - termination_design

  - id: AE-P9
    title: Design evals and rubric
    instruction: >-
      Define eval refs for success, output shape, least privilege, termination, and
      negative/safety behavior, and reuse the supplied work-unit quality-contract ref.
    requires:
      - termination_design
    produces:
      - eval_design

  - id: AE-P10
    title: Build candidate AgentDefinition
    instruction: >-
      For DESIGN_NEW only, build a complete S10-shaped proposed AgentDefinition with
      delegation false, bounded context, provider-neutral model policy, and all
      approved design fields.
    requires:
      - eval_design
    produces:
      - candidate_agent_definition

  - id: AE-P11
    title: Produce proposal
    instruction: >-
      Return the need decision, reuse recommendation or new design when applicable,
      explicit limitations, PROPOSED status, and human-approval requirement without
      registering or executing the candidate Agent.
    requires:
      - candidate_agent_definition
    produces:
      - agent_engineering_result

verification:
  - id: AE-V1
    kind: DETERMINISTIC
    criterion: Fixed deterministic work is classified NO_AGENT with DETERMINISTIC_FUNCTION.
    evidence_required: true

  - id: AE-V2
    kind: DETERMINISTIC
    criterion: One-pass semantic guidance without an adaptive loop may be classified NO_AGENT with SKILL_ONLY.
    evidence_required: true

  - id: AE-V3
    kind: DETERMINISTIC
    criterion: Canonical adaptive-loop positive fixture is classified AGENT_REQUIRED.
    evidence_required: true

  - id: AE-V4
    kind: DETERMINISTIC
    criterion: Existing-Agent reuse is preferred over DESIGN_NEW when independent fixture truth says the supplied existing Agent satisfies the work unit.
    evidence_required: true

  - id: AE-V5
    kind: DETERMINISTIC
    criterion: A DESIGN_NEW candidate passes the existing S10 AgentDefinition validator.
    evidence_required: true

  - id: AE-V6
    kind: DETERMINISTIC
    criterion: Candidate tools equal capabilities and contain no ID absent from the supplied available-capability list.
    evidence_required: true

  - id: AE-V7
    kind: DETERMINISTIC
    criterion: Candidate memory, permissions, limits, termination, and evals satisfy the canonical S13E policies.
    evidence_required: true

  - id: AE-V8
    kind: DETERMINISTIC
    criterion: S13D architecture input, when supplied, remains unchanged after S13E execution.
    evidence_required: true

  - id: AE-V9
    kind: DETERMINISTIC
    criterion: Every S13E result is PROPOSED, approval_required true, and never auto-registers the candidate.
    evidence_required: true

  - id: AE-V10
    kind: DETERMINISTIC
    criterion: Skill-assisted output improves canonical S13E metrics versus a no-Skill baseline using independent test-only fixture truth.
    evidence_required: true

  - id: AE-V11
    kind: DETERMINISTIC
    criterion: Material work-unit signal changes alter the necessity decision or candidate design.
    evidence_required: true

  - id: AE-V12
    kind: SEMANTIC
    criterion: The design minimizes unnecessary agency and authority while remaining sufficient for the work unit.
    evidence_required: true

permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true

evals:
  - evals/s13e/agent-required-positive
  - evals/s13e/no-agent-negative
  - evals/s13e/reuse-existing
  - evals/s13e/skill-only
  - evals/s13e/skill-vs-baseline
```

---

# 1. Agent-necessity model

Canonical types:

```ts
type AgentNeedStatus =
  | "READY"
  | "BLOCKED";

type AgentRequirement =
  | "NO_AGENT"
  | "AGENT_REQUIRED";

type NonAgentStrategy =
  | "DETERMINISTIC_FUNCTION"
  | "SKILL_ONLY"
  | null;

type AgentAction =
  | "REUSE_EXISTING"
  | "DESIGN_NEW"
  | null;
```

Canonical result decision:

```ts
interface AgentNeedDecision {
  status: AgentNeedStatus;

  agent_requirement: AgentRequirement;

  non_agent_strategy: NonAgentStrategy;

  agent_action: AgentAction;

  reuse_agent_id: string | null;

  rationale: string;

  evidence_refs: string[];

  blocking_reasons: string[];
}
```

Validity:

```text
NO_AGENT
→ non_agent_strategy != null
→ agent_action == null
→ reuse_agent_id == null

AGENT_REQUIRED + READY
→ non_agent_strategy == null
→ agent_action == REUSE_EXISTING | DESIGN_NEW

REUSE_EXISTING
→ reuse_agent_id != null

DESIGN_NEW
→ reuse_agent_id == null

BLOCKED
→ no candidate AgentDefinition may be treated as ready
```

---

# 2. Necessity criteria

## 2.1 Deterministic function

Canonical preference:

```text
NO_AGENT
+
DETERMINISTIC_FUNCTION
```

when all are true:

```text
the transformation is structurally fixed;
the required sequence/order of steps is known before execution;
the next action does not depend on an observation produced by a previous action;
no retry/replan loop is required;
no persistent within-run adaptive state is required;
semantic judgment is not the core operation.
```

Examples:

```text
render a typed ADR object into deterministic Markdown
sort/filter/format validated data
apply a fixed schema transformation
```

---

## 2.2 Skill-only

Canonical preference:

```text
NO_AGENT
+
SKILL_ONLY
```

when:

```text
semantic judgment or reusable procedural guidance is useful
BUT
one bounded decision/model pass is sufficient;
there is no observation-dependent action loop;
there is no conditional capability sequence;
there is no retry/replan loop;
persistent adaptive state is unnecessary.
```

An LLM may still be used.

The absence of an Agent does not imply the absence of a model.

---

## 2.3 Agent required

Canonical:

```text
AGENT_REQUIRED
```

only when:

```text
next_action_depends_on_observation == true
```

AND at least one of:

```text
requires_conditional_capability_use == true
requires_retry_or_replan == true
requires_within_run_state == true
```

This explicitly ties S13E to the S09 Agent Runtime loop rather than to vague task complexity.

---

## 2.4 Insufficient reasons

These alone do not justify an Agent:

```text
task is difficult
task is long
task uses an LLM
task uses a Skill
task has many input fields
task requires high-quality reasoning
task produces a large artifact
```

---

# 3. Reuse-existing decision

When `AGENT_REQUIRED`, S13E checks supplied existing Agent descriptors.

A supplied existing Agent is reusable only if:

```text
the descriptor explicitly lists the work-unit task_kind;

its tools/capabilities include every required capability ID;

it does not require a capability ID unavailable to the current work unit;

its allowed side-effect classes fit within the work unit allowed side effects;

its memory behavior is not broader than the work unit allows;

its output/rubric contract is explicitly compatible according to the descriptor.
```

If more than one Agent qualifies:

```text
prefer the least-privilege candidate
```

using:

```text
fewer capabilities
then fewer allowed side-effect classes
then deterministic ID ordering
```

S13E does not inspect hidden implementation behavior to infer compatibility.

Compatibility must be present in bounded input metadata.

---

# 4. S13E input contract

Canonical:

```ts
interface AgentEngineeringInput {
  work_unit: AgentEngineeringWorkUnit;

  architecture_decision?: SoftwareArchitectureDecisionResult;

  available_agents: AvailableAgentDescriptor[];

  available_skill_ids: string[];

  available_capabilities: AvailableCapabilityDescriptor[];
}
```

Bounded reference limits:

```text
available_agents: 0..10
available_skill_ids: 0..20
available_capabilities: 0..20
```

No full catalogs.

---

# 5. AgentEngineeringWorkUnit

Canonical:

```ts
interface AgentEngineeringWorkUnit {
  id: string;

  task_kind: string;

  goal: string;

  description: string;

  expected_output_schema: JsonSchemaLike;

  quality_contract_ref: string;

  success_conditions: string[];

  constraints: string[];

  allowed_context_sources: AgentContextSource[];

  required_capability_ids: string[];

  optional_capability_ids: string[];

  allowed_side_effect_classes: ToolSideEffectClass[];

  behavior: AgentBehaviorSignals;

  iteration_budget?: {
    max_turns: number;
    timeout_ms: number;
  };

  source_refs: string[];
}
```

The work unit supplies bounded design evidence.

It is not an AgentDefinition.

---

# 6. AgentBehaviorSignals

Canonical:

```ts
interface AgentBehaviorSignals {
  fixed_steps_known_in_advance: boolean;

  semantic_judgment_required: boolean;

  next_action_depends_on_observation: boolean;

  requires_conditional_capability_use: boolean;

  requires_retry_or_replan: boolean;

  requires_within_run_state: boolean;

  requires_cross_run_history: boolean;
}
```

These are input facts/requirements.

They must carry traceability through:

```text
work_unit.source_refs
```

Part B must not infer fixture ground truth from the resulting classification.

---

# 7. Available capability descriptor

Canonical:

```ts
interface AvailableCapabilityDescriptor {
  id: string;

  description: string;

  side_effect_class: ToolSideEffectClass;
}
```

This is bounded design metadata.

It is **not** the S14 Capability Registry.

S13E does not:

```text
register
instantiate
invoke
discover globally
```

a capability through this structure.

---

# 8. Available Agent descriptor

Canonical:

```ts
interface AvailableAgentDescriptor {
  definition: AgentDefinition;

  supported_task_kinds: string[];

  compatible_quality_contract_refs: string[];

  notes: string;
}
```

This descriptor exists only to make reuse decisions from explicit bounded evidence.

It does not modify AgentDefinition v1.

---

# 9. Candidate design status

Canonical:

```ts
type AgentDesignProposalStatus =
  | "PROPOSED";
```

No S13E output state:

```text
ACCEPTED
ACTIVE
REGISTERED
DEPLOYED
```

is allowed.

---

# 10. ProposedAgentDesign

Canonical:

```ts
interface ProposedAgentDesign {
  proposal_status: "PROPOSED";

  candidate_definition: AgentDefinition;

  goal_rationale: string;

  state_design: AgentStateDesign;

  capability_design: CapabilityDesign;

  permission_rationale: string;

  memory_rationale: string;

  termination_design: TerminationDesign;

  eval_plan: AgentEvalPlanItem[];

  model_policy_rationale: string;

  context_policy_rationale: string;

  skill_selection_rationale: string;

  limitations: string[];
}
```

The canonical `candidate_definition` is a full S10-shaped AgentDefinition.

---

# 11. State design

Canonical:

```ts
interface AgentStateDesign {
  purpose: string;

  fields: {
    name: string;
    type:
      | "string"
      | "number"
      | "boolean"
      | "array"
      | "object";

    required: boolean;

    description: string;
  }[];
}
```

`candidate_definition.state_schema` must deterministically correspond to these fields.

State is:

```text
within-run mutable Agent state
```

not durable memory.

---

# 12. Capability design

Canonical:

```ts
interface CapabilityDesign {
  selected_capability_ids: string[];

  required_capability_ids: string[];

  optional_capabilities_selected: {
    id: string;
    rationale: string;
  }[];

  rejected_available_capabilities: {
    id: string;
    reason: string;
  }[];
}
```

Invariant:

```text
candidate_definition.tools
==
candidate_definition.capabilities
==
selected_capability_ids
```

Every selected ID must exist in:

```text
input.available_capabilities
```

Every required ID must be selected.

Optional IDs are excluded unless explicit rationale proves necessity.

---

# 13. Permissions

Candidate:

```text
deny_unlisted_capabilities == true
```

always.

Allowed side-effect classes must be no broader than:

```text
work_unit.allowed_side_effect_classes
```

and must be sufficient for the selected capabilities.

For a candidate with no capabilities:

```text
allowed_side_effects == ["NONE"]
```

in the reference design.

S13E v1 does not invent capability-specific policy beyond S10.

---

# 14. Memory policy

## Default

If:

```text
requires_cross_run_history == false
```

then canonical candidate memory:

```yaml
retrieve: false
remember_candidate: false
commit_verified_memory: false
search_history: false
promotion_policy: DISABLED
```

## Explicit cross-run history required

If:

```text
requires_cross_run_history == true
```

then S13E may propose:

```yaml
retrieve: true
remember_candidate: true
commit_verified_memory: false
search_history: true
promotion_policy: EXPLICIT_VERIFIED_ONLY
```

only when the work-unit context permits verified history use.

Canonical invariant in S13E v1:

```text
commit_verified_memory == false
```

always.

Reason:

S13E designs an Agent.

It does not authorize automatic durable truth promotion.

---

# 15. Termination and limits

Candidate always preserves:

```yaml
termination:
  require_terminal_outcome: true
  require_explanation: true
```

and may include a note.

No new terminal outcome names are created.

For `DESIGN_NEW`:

```text
work_unit.iteration_budget
```

is mandatory when the necessity decision depends on retry, conditional capabilities, or iterative state.

Candidate limits must be bounded by the explicit budget.

Reference invariant:

```text
candidate.max_turns == work_unit.iteration_budget.max_turns

candidate.timeout_ms == work_unit.iteration_budget.timeout_ms
```

unless a smaller bound is proposed with explicit rationale.

S13E may not silently raise either bound above input.

---

# 16. Skills in the candidate Agent

Candidate `skills[]` may contain only IDs from:

```text
input.available_skill_ids
```

Selection is optional.

A Skill is justified when:

```text
the work unit benefits from reusable semantic/procedural guidance
```

but the Agent loop is still independently justified.

S13E does not create missing Skills.

If a required Skill is missing:

```text
state limitation or BLOCKED
```

rather than inventing an ID.

---

# 17. Model policy

S13E remains provider-neutral.

Candidate routing guidance:

```text
QUALITY
```

for high-risk/high-ambiguity adaptive work;

```text
BALANCED
```

for moderate bounded adaptive work.

`DEFAULT` or `ECONOMY` may be used only with explicit rationale.

No provider/model name appears in the candidate definition.

Canonical:

```text
require_structured_decisions == true
allow_provider_substitution == true
```

for the S13E reference fixture.

---

# 18. Context policy

Candidate must use:

```text
retrieval_mode: BOUNDED
require_source_refs: true
```

Allowed sources must be a non-empty subset of:

```text
work_unit.allowed_context_sources
```

Reference bounds:

```text
max_context_tokens > 0
max_items > 0
```

with rationale.

No full Agent/Skill catalog may be injected.

---

# 19. Delegation

Canonical S13E v1:

```text
delegation.allowed == false
```

Always.

S13E does not design:

```text
sub-agents
delegation graphs
multi-agent coordination
```

because current S09/S10 do not support them.

---

# 20. Output schema and rubric

For a new candidate:

```text
candidate_definition.output_schema
=
work_unit.expected_output_schema
```

and:

```text
candidate_definition.rubric.quality_contract_ref
=
work_unit.quality_contract_ref
```

S13E does not fabricate either.

This is why both are required work-unit input.

---

# 21. Eval plan

Canonical categories for every new Agent:

```ts
type AgentEvalCategory =
  | "GOAL_SUCCESS"
  | "OUTPUT_CONTRACT"
  | "LEAST_PRIVILEGE"
  | "TERMINATION"
  | "NEGATIVE_SAFETY"
  | "MEMORY_POLICY";
```

Canonical:

```ts
interface AgentEvalPlanItem {
  category: AgentEvalCategory;

  ref: string;

  rationale: string;
}
```

Minimum required categories:

```text
GOAL_SUCCESS
OUTPUT_CONTRACT
LEAST_PRIVILEGE
TERMINATION
NEGATIVE_SAFETY
```

`MEMORY_POLICY` is additionally required when:

```text
requires_cross_run_history == true
```

`candidate_definition.evals` is the ordered list of plan refs.

Refs are proposals.

S13E does not implement those target-Agent eval suites.

---

# 22. AgentEngineeringResult

Canonical:

```ts
interface AgentEngineeringResult {
  work_unit_id: string;

  proposal_status: "PROPOSED";

  approval_required: true;

  need_decision: AgentNeedDecision;

  design: ProposedAgentDesign | null;

  reuse_agent_id: string | null;

  non_agent_recommendation: {
    strategy:
      | "DETERMINISTIC_FUNCTION"
      | "SKILL_ONLY";

    rationale: string;
  } | null;

  warnings: string[];

  approval_note: string;
}
```

Validity:

```text
DESIGN_NEW
→ design != null
→ reuse_agent_id == null

REUSE_EXISTING
→ design == null
→ reuse_agent_id != null

NO_AGENT
→ design == null
→ reuse_agent_id == null
→ non_agent_recommendation != null

BLOCKED
→ design == null
unless the design is explicitly marked incomplete and is never treated as runnable;
reference implementation SHOULD use design == null.
```

---

# 23. Human approval

Every result:

```text
proposal_status == PROPOSED
approval_required == true
```

Canonical approval note:

```text
"This Agent-engineering result is a proposal. Human approval is required before a new AgentDefinition is registered, activated, or treated as durable execution authority."
```

S13E Part B must not implement:

```text
registration
activation
deployment
approval UI
automatic Git commit of candidate definitions
```

---

# 24. Relation to S13D

S13E is reusable independently.

Optional:

```ts
architecture_decision?: SoftwareArchitectureDecisionResult;
```

When supplied:

```text
it is read-only;
its decision drivers/constraints may constrain the work unit;
its ADR remains PROPOSED;
its approval state is not changed;
its evidence may be cited through source refs.
```

S13E does not require S13D to be `READY_FOR_HUMAN_APPROVAL`.

If the supplied architecture context is materially BLOCKED or contains unresolved gaps that prevent safe Agent design:

```text
S13E may return BLOCKED.
```

---

# 25. Canonical executing Agent

Create:

```text
agent-engineer-v1
```

Canonical semantic AgentDefinition:

```yaml
id: agent-engineer-v1
role: agent-engineer

objective: >-
  Decide whether a bounded work unit genuinely requires an Agent and, only when
  justified, recommend reuse of an explicitly supplied compatible Agent or design
  a least-privilege proposed S10 AgentDefinition for human approval.

model_policy:
  routing_class: QUALITY
  require_structured_decisions: true
  allow_provider_substitution: true

context_policy:
  retrieval_mode: BOUNDED
  max_context_tokens: 9000
  max_items: 40
  allowed_sources:
    - CURRENT_TASK
    - EXPLICIT_SPEC
    - VERIFIED_HANDOFF
    - ADR
    - COMPILED_KNOWLEDGE
  require_source_refs: true

tools: []

skills:
  - agent-engineering.design.s13e

capabilities: []

memory_policy:
  retrieve: false
  remember_candidate: false
  commit_verified_memory: false
  search_history: false
  promotion_policy: DISABLED

permissions:
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true

delegation:
  allowed: false

limits:
  max_turns: 10
  timeout_ms: 15000

termination:
  require_terminal_outcome: true
  require_explanation: true
  note: S13E uses canonical S09 terminal semantics.

rubric:
  quality_contract_ref: brain-bootstrap/quality-contracts/S13E_AGENT_ENGINEERING_DEEP.yaml

evals:
  - evals/s13e/agent-required-positive
  - evals/s13e/no-agent-negative
  - evals/s13e/reuse-existing
  - evals/s13e/skill-only
  - evals/s13e/skill-vs-baseline
```

---

# 26. agent-engineer-v1 state schema

Canonical semantic state:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "selected_skill_id": {
      "type": "string"
    },
    "necessity_decided": {
      "type": "boolean"
    },
    "agent_required": {
      "type": "boolean"
    },
    "design_complete": {
      "type": "boolean"
    }
  }
}
```

Core must not inspect these role-specific fields.

---

# 27. StructuredAgentOutput mapping

Do not redefine S09.

Canonical:

```text
StructuredAgentOutput.summary
=
short summary of the Agent-necessity/design recommendation
```

```text
StructuredAgentOutput.data
=
AgentEngineeringResult
```

```text
StructuredAgentOutput.evidence_refs
=
deterministic first-occurrence de-duplicated union of:

need_decision.evidence_refs
+
work-unit source refs materially referenced by design rationale
+
optional S13D refs materially referenced by the result
```

Available capability IDs and Agent IDs are not evidence refs unless the input explicitly supplies a source ref for them.

---

# 28. Canonical positive fixture — new Agent justified

## Work unit

```text
id:
incident-investigator

task_kind:
incident-investigation

goal:
Investigate an incident by reading the incident record, choosing which logs to inspect
based on observations, updating a hypothesis, and retrying/replanning until the incident
has a bounded evidence-backed explanation or the iteration budget is exhausted.
```

Behavior:

```yaml
fixed_steps_known_in_advance: false
semantic_judgment_required: true
next_action_depends_on_observation: true
requires_conditional_capability_use: true
requires_retry_or_replan: true
requires_within_run_state: true
requires_cross_run_history: false
```

Available capabilities:

```text
incident.read
side_effect: NONE

incident.logs
side_effect: NONE

incident.admin
side_effect: NONE
```

Required:

```text
incident.read
incident.logs
```

`incident.admin` is intentionally available but unnecessary.

Available existing Agent descriptors:

```text
none supporting task_kind incident-investigation
```

Iteration budget:

```text
max_turns: 8
timeout_ms: 12000
```

Independent fixture truth:

```text
agent_requirement:
AGENT_REQUIRED

agent_action:
DESIGN_NEW

expected_capability_ids:
incident.read
incident.logs

forbidden_or_unnecessary_capability_ids:
incident.admin

expected_memory_policy:
all false
promotion_policy DISABLED

expected_required_eval_categories:
GOAL_SUCCESS
OUTPUT_CONTRACT
LEAST_PRIVILEGE
TERMINATION
NEGATIVE_SAFETY
```

Correct candidate state fields include at least:

```text
current_hypothesis
observations
attempt
```

No cross-run memory is needed.

---

# 29. Canonical negative fixture — Agent must NOT be created

Work unit:

```text
id:
adr-markdown-render

task_kind:
deterministic-render

goal:
Render a validated ArchitectureDecisionRecord into Markdown using a fixed canonical
section order.
```

Behavior:

```yaml
fixed_steps_known_in_advance: true
semantic_judgment_required: false
next_action_depends_on_observation: false
requires_conditional_capability_use: false
requires_retry_or_replan: false
requires_within_run_state: false
requires_cross_run_history: false
```

Required capabilities:

```text
[]
```

Independent fixture truth:

```text
agent_requirement:
NO_AGENT

non_agent_strategy:
DETERMINISTIC_FUNCTION
```

This fixture is intentionally grounded in the already-existing S13D deterministic ADR renderer pattern.

Creating a new Agent for this task is a canonical S13E failure.

---

# 30. Skill-only fixture

Work unit:

```text
id:
architecture-rubric-review

task_kind:
semantic-checklist-review

goal:
Review a supplied architecture summary against a bounded static architecture checklist
and return structured findings in one pass.
```

Behavior:

```yaml
fixed_steps_known_in_advance: true
semantic_judgment_required: true
next_action_depends_on_observation: false
requires_conditional_capability_use: false
requires_retry_or_replan: false
requires_within_run_state: false
requires_cross_run_history: false
```

Truth:

```text
agent_requirement:
NO_AGENT

non_agent_strategy:
SKILL_ONLY
```

The point is:

```text
semantic reasoning != Agent requirement
```

---

# 31. Reuse-existing fixture

Work unit:

```text
task_kind:
evidence-research
```

Behavior requires:

```text
adaptive observation
conditional research.lookup use
retry/replan
within-run research state
```

Required capability:

```text
research.lookup
```

Supplied available Agent descriptor:

```text
definition:
researcher-v1

supported_task_kinds:
- evidence-research

compatible_quality_contract_refs:
- <fixture quality contract ref>
```

Independent fixture truth:

```text
agent_requirement:
AGENT_REQUIRED

agent_action:
REUSE_EXISTING

reuse_agent_id:
researcher-v1

new AgentDefinition:
must NOT be created
```

---

# 32. Blocking fixture

If positive incident investigation requires:

```text
incident.read
incident.logs
```

but:

```text
incident.logs
```

is absent from `available_capabilities`:

canonical:

```text
status:
BLOCKED

agent_requirement:
AGENT_REQUIRED

candidate:
none
```

S13E must not invent:

```text
incident.logs
```

or silently omit a required capability.

---

# 33. Skill-vs-baseline fixture truth separation

Part B must define a test-only object equivalent to:

```ts
interface AgentEngineeringFixtureTruth {
  expected_agent_requirement: AgentRequirement;

  expected_non_agent_strategy: NonAgentStrategy;

  expected_agent_action: AgentAction;

  expected_reuse_agent_id: string | null;

  expected_capability_ids: string[];

  forbidden_capability_ids: string[];

  expected_memory_policy?: AgentMemoryPolicy;

  expected_limit_bounds?: {
    max_turns: number;
    timeout_ms: number;
  };

  required_eval_categories: AgentEvalCategory[];

  required_design_sections: string[];
}
```

Critical invariant:

```text
FixtureTruth is NOT passed to:

materializeAgentEngineeringTask()
Agent ModelProvider input
Skill selection
candidate builder
validator
```

The comparison module receives fixture truth only after both runtime outputs already exist.

This breaks the repeated prior-step metric defect where the system being scored also defines its own expected answer.

---

# 34. S13E comparison metrics

Canonical:

```ts
interface AgentEngineeringComparisonMetrics {
  necessity_accuracy_ratio: number;

  strategy_accuracy_ratio: number;

  design_completeness_ratio: number;

  least_privilege_accuracy_ratio: number;

  memory_policy_accuracy_ratio: number;

  termination_policy_accuracy_ratio: number;

  eval_coverage_ratio: number;

  unnecessary_new_agent_count: number;

  unsupported_capability_count: number;
}
```

---

# 35. Metric definitions, divergence cases, and ground truth

## 35.1 necessity_accuracy_ratio

Definition:

```text
fixture cases whose agent_requirement matches independent fixture truth
/
all scored fixture cases
```

Concrete divergence:

```text
baseline creates an Agent for deterministic ADR rendering;
Skill run returns NO_AGENT.
```

Ground truth:

```text
test-only AgentEngineeringFixtureTruth
```

not output-derived.

---

## 35.2 strategy_accuracy_ratio

Definition:

```text
fixture cases whose non-agent strategy or Agent action
(DETERMINISTIC_FUNCTION / SKILL_ONLY / REUSE_EXISTING / DESIGN_NEW)
matches independent fixture truth
/
all scored cases
```

Concrete divergence:

```text
baseline designs a new Agent for evidence-research;
Skill run reuses researcher-v1.
```

Ground truth:

```text
test-only fixture truth
```

plus explicit bounded available-Agent descriptor.

---

## 35.3 design_completeness_ratio

For `DESIGN_NEW` fixture only.

Fixed denominator:

```text
goal
state
model policy
context policy
skills
tools/capabilities
permissions
memory
delegation
limits
termination
output schema
rubric
evals
```

Definition:

```text
canonically complete sections
/
14 fixed required sections
```

Concrete divergence:

```text
baseline omits permissions, memory rationale, evals, or state;
Skill run supplies all required sections.
```

Ground truth:

```text
this canonical fixed section list
```

not candidate output.

---

## 35.4 least_privilege_accuracy_ratio

Definition:

```text
expected selected capability IDs matched
/
expected capability IDs plus incorrectly selected IDs
```

Concrete divergence:

```text
baseline selects incident.admin in addition to incident.read/incident.logs;
Skill run selects only required incident.read/incident.logs.
```

Ground truth:

```text
fixture truth expected_capability_ids + forbidden_capability_ids
```

---

## 35.5 memory_policy_accuracy_ratio

Definition:

```text
candidate memory-policy fields matching independent expected policy
/
all canonical memory-policy fields
```

Concrete divergence:

```text
baseline enables retrieval/history for the incident fixture;
Skill run keeps memory disabled because cross-run history is false.
```

Ground truth:

```text
fixture truth expected_memory_policy
```

---

## 35.6 termination_policy_accuracy_ratio

Definition:

```text
canonical termination flags + limits matching independent work-unit budget
/
all required termination/limit checks
```

Concrete divergence:

```text
baseline raises max_turns above the supplied iteration budget;
Skill run respects max_turns 8 / timeout 12000.
```

Ground truth:

```text
work-unit iteration_budget
```

which exists before synthesis.

---

## 35.7 eval_coverage_ratio

Definition:

```text
required eval categories represented
/
fixture-truth required eval categories
```

Concrete divergence:

```text
baseline includes only happy-path goal success;
Skill run additionally includes output, least-privilege, termination, and negative-safety evals.
```

Ground truth:

```text
fixture truth required_eval_categories
```

---

## 35.8 unnecessary_new_agent_count

Count:

```text
cases where output DESIGN_NEW
but independent truth says NO_AGENT or REUSE_EXISTING
```

Concrete divergence:

```text
baseline creates Agents for deterministic renderer and reusable evidence-research;
Skill run creates neither.
```

Ground truth:

```text
fixture truth expected action
```

---

## 35.9 unsupported_capability_count

Count:

```text
selected capability IDs absent from available_capabilities
+
fixture-forbidden/unnecessary selected capability IDs
```

Concrete divergence:

```text
baseline selects incident.admin or invents an unknown capability;
Skill run selects neither.
```

Ground truth:

```text
bounded input available-capability list
+
fixture truth forbidden list
```

---

# 36. Skill-vs-baseline requirements

Both runs use:

```text
same AgentEngineeringInput
same agent-engineer-v1 base AgentDefinition
same ModelProvider class/configuration
same limits
same S09/S10 runtime
same bounded catalogs
```

Difference:

```text
baseline:
S13E Skill not selected/materialized

Skill run:
agent-engineering.design.s13e
discovered
lazily loaded
materialized
```

Required strict improvements across the canonical fixture suite:

```text
skill.necessity_accuracy_ratio
>
baseline.necessity_accuracy_ratio
```

```text
skill.strategy_accuracy_ratio
>
baseline.strategy_accuracy_ratio
```

```text
skill.design_completeness_ratio
>
baseline.design_completeness_ratio
```

```text
skill.least_privilege_accuracy_ratio
>
baseline.least_privilege_accuracy_ratio
```

```text
skill.eval_coverage_ratio
>
baseline.eval_coverage_ratio
```

```text
skill.unnecessary_new_agent_count
<
baseline.unnecessary_new_agent_count
```

```text
skill.unsupported_capability_count
<
baseline.unsupported_capability_count
```

Canonical exact assertions:

Negative deterministic fixture:

```text
skill.agent_requirement == NO_AGENT
skill.non_agent_strategy == DETERMINISTIC_FUNCTION
skill.design == null
```

Skill-only fixture:

```text
skill.agent_requirement == NO_AGENT
skill.non_agent_strategy == SKILL_ONLY
```

Reuse fixture:

```text
skill.agent_requirement == AGENT_REQUIRED
skill.agent_action == REUSE_EXISTING
skill.reuse_agent_id == researcher-v1
skill.design == null
```

Positive new-Agent fixture:

```text
skill.agent_requirement == AGENT_REQUIRED
skill.agent_action == DESIGN_NEW
candidate passes S10 validator
selected capabilities == ["incident.read", "incident.logs"]
incident.admin not selected
```

---

# 37. Input dependence

Part B must mutate material signals and prove the result changes.

Canonical mutation A:

```text
incident fixture:
next_action_depends_on_observation
true → false

requires_conditional_capability_use
true → false

requires_retry_or_replan
true → false

requires_within_run_state
true → false
```

while converting the work to a fixed one-pass transformation.

Result must change from:

```text
AGENT_REQUIRED
```

to:

```text
NO_AGENT
```

with appropriate strategy.

Canonical mutation B:

Remove:

```text
incident.logs
```

from available capabilities.

Result must change from:

```text
DESIGN_NEW READY
```

to:

```text
BLOCKED
```

A canned result fails.
