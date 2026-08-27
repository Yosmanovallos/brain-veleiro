# Brain Agent Engineering Agent v1

**Status:** Canonical S13E execution/verification contract  
**Step:** S13E — agent-engineering  
**Layer:** Intelligence over S12 Skill loading + S10 AgentDefinition + S09 Agent Runtime  
**Depends on:** S04, S05, S09, S10, S12; optionally consumes S13D output read-only  
**Authoring split:** ChatGPT Part A → Claude Code Part B

---

# 1. Purpose

S13E answers two questions in order:

```text
1. Does this bounded work unit need an Agent at all?

2. If yes:
   can an explicitly supplied existing Agent be reused,
   or is a new least-privilege single AgentDefinition required?
```

Only after those questions are answered may S13E design:

```text
goal
state
tools/capabilities
permissions
memory
termination
limits
output
rubric
evals
```

Canonical path:

```text
AgentEngineeringInput
        ↓
agent-engineer-v1
        ↓
S12 metadata-only Skill discovery
        ↓
agent-engineering.design.s13e
        ↓
lazy selected Skill load
        ↓
S13E materialization
        ↓
S10 compileAgentDefinition(agent-engineer-v1)
        ↓
S09 runAgent()
        ↓
AgentEngineeringResult
        ↓
NO_AGENT
or
REUSE_EXISTING
or
PROPOSED candidate AgentDefinition
        ↓
human approval required
```

No generic Agent Factory is introduced.

---

# 2. Executing Agent decision

Create:

```text
agent-engineer-v1
```

Do not reuse or modify:

```text
requirements-discoverer-v1
knowledge-gap-analyzer-v1
researcher-v1
deep-researcher-v1
software-architect-v1
```

`agent-engineer-v1` is itself a normal single AgentDefinition running through the same generic runtime.

---

# 3. Executing Agent capability decision

Canonical:

```text
tools: []
capabilities: []
```

S13E analyzes bounded design metadata.

It does not invoke the capabilities it is designing.

This is a design-time distinction:

```text
candidate Agent declared capability
!=
agent-engineer-v1 runtime capability
```

---

# 4. Executing Agent memory decision

Reference S13E execution uses:

```yaml
retrieve: false
remember_candidate: false
commit_verified_memory: false
search_history: false
promotion_policy: DISABLED
```

Reason:

Agent design must be traceable to the explicit current work-unit input and bounded supplied descriptors.

Historical memory must not silently cause capability or autonomy grants.

---

# 5. Input contract

Use the exact `AgentEngineeringInput` from the Skill contract.

Required:

```text
work_unit
available_agents
available_skill_ids
available_capabilities
```

Optional:

```text
architecture_decision
```

---

# 6. Bounded catalog discipline

Reference maxima:

```text
available_agents <= 10
available_skill_ids <= 20
available_capabilities <= 20
```

These are current-task inputs.

S13E must not query or load:

```text
all repository Agents
all Skills
all tools
all memory
```

into one run.

---

# 7. Agent necessity precedence

Decision precedence:

```text
1. validate input
2. BLOCKED if required design evidence is contradictory/missing
3. deterministic function eligibility
4. Skill-only eligibility
5. Agent-loop eligibility
6. existing-Agent reuse
7. new-Agent design
```

Do not jump directly to DESIGN_NEW.

---

# 8. Deterministic-function decision

Emit:

```text
NO_AGENT
DETERMINISTIC_FUNCTION
```

when the criteria in Skill §2.1 hold.

The canonical ADR renderer fixture must take this branch.

---

# 9. Skill-only decision

Emit:

```text
NO_AGENT
SKILL_ONLY
```

when the criteria in Skill §2.2 hold.

S13E may reference an existing Skill ID only if it is present in:

```text
available_skill_ids
```

If no applicable Skill is available, the result may still recommend:

```text
SKILL_ONLY
```

as an execution model while recording a missing-Skill limitation.

S13E does not create the Skill.

---

# 10. Agent-required decision

Emit:

```text
AGENT_REQUIRED
```

only under Skill §2.3.

A task with:

```text
next_action_depends_on_observation == false
```

cannot be classified AGENT_REQUIRED in the S13E v1 reference policy.

---

# 11. Existing Agent reuse

Before DESIGN_NEW:

Inspect only:

```text
input.available_agents
```

Reuse requires all explicit compatibility conditions.

S13E must not infer capability or task support from an Agent ID or role name alone.

---

# 12. New Agent design

`DESIGN_NEW` requires:

```text
work-unit output schema
quality-contract ref
required capability availability
allowed context sources
iteration budget when adaptive looping is required
```

Missing any required contract:

```text
BLOCKED
```

No partial runnable AgentDefinition may be emitted as ready.

---

# 13. Candidate AgentDefinition requirement

For `DESIGN_NEW`, the output contains a full:

```text
AgentDefinition
```

conforming to S10.

Part B must call the existing:

```text
validateDefinition()
```

or canonical S10 validator equivalent.

S13E must not implement a competing AgentDefinition validator.

Additional S13E semantic checks may wrap the canonical validator.

---

# 14. Candidate objective

Canonical:

```text
candidate.objective
=
work_unit.goal
```

or a semantics-preserving normalized version.

The design wrapper records:

```text
goal_rationale
```

No unrelated objective expansion.

---

# 15. Candidate role/id

S13E may propose:

```text
id
role
```

from the bounded task kind.

Reference generation must be deterministic in fixtures.

Example:

```text
incident-investigator-v1
role: incident-investigator
```

IDs are proposals.

They do not register the Agent.

---

# 16. Candidate state

The candidate state schema represents information that changes during one run.

Canonical incident fixture:

```text
current_hypothesis
observations
attempt
```

Cross-run history does not belong in state schema merely because memory exists.

---

# 17. Candidate tools and capabilities

Invariant:

```text
tools == capabilities
```

Candidate may select only:

```text
available_capabilities[*].id
```

Every `required_capability_id` must be selected.

Optional capability selection requires explicit rationale.

---

# 18. Candidate permissions

Canonical:

```text
deny_unlisted_capabilities == true
```

Always.

Allowed side effects:

```text
subset of work_unit.allowed_side_effect_classes
```

and sufficient for selected capabilities.

No capability escalation.

---

# 19. Candidate memory

Use Skill §14 exactly.

S13E v1 invariant:

```text
commit_verified_memory == false
```

Candidate memory must not be enabled to compensate for poorly designed state.

---

# 20. Candidate termination and limits

Use the supplied iteration budget.

No unlimited loop.

No custom terminal outcome enum.

Canonical:

```text
require_terminal_outcome == true
require_explanation == true
```

---

# 21. Candidate model policy

Provider-neutral.

Reference positive fixture:

```text
routing_class: QUALITY
require_structured_decisions: true
allow_provider_substitution: true
```

Different routing classes require design rationale.

No model vendor names.

---

# 22. Candidate context policy

Always:

```text
retrieval_mode: BOUNDED
require_source_refs: true
```

Allowed sources must be a subset of work-unit allowed sources.

Reference `max_context_tokens` and `max_items` must be finite positive integers.

---

# 23. Candidate delegation

Canonical:

```text
allowed: false
```

No S13E multi-agent design.

---

# 24. Candidate output schema and rubric

Exactly:

```text
candidate.output_schema
=
work_unit.expected_output_schema
```

```text
candidate.rubric.quality_contract_ref
=
work_unit.quality_contract_ref
```

No invented path.

---

# 25. Candidate eval refs

Candidate eval refs come from `ProposedAgentDesign.eval_plan`.

Minimum categories:

```text
GOAL_SUCCESS
OUTPUT_CONTRACT
LEAST_PRIVILEGE
TERMINATION
NEGATIVE_SAFETY
```

plus:

```text
MEMORY_POLICY
```

when cross-run memory is required.

No empty eval list.

---

# 26. Proposal and approval

Every result:

```text
PROPOSED
approval_required: true
```

S13E does not:

```text
write the candidate into src/intelligence/agent-definitions/
register it
activate it
deploy it
mark it accepted
```

except for the fixed `agent-engineer-v1` implementation that belongs to S13E itself.

Candidate definitions created by fixtures remain test output.

---

# 27. S13D relationship

S13D output may constrain:

```text
goal
constraints
security requirements
operations requirements
architecture-specific capability needs
```

but S13E does not reinterpret an S13D PROPOSED ADR as accepted architecture.

Input remains immutable.

---

# 28. StructuredAgentOutput

Canonical mapping from Skill §27 applies.

No new S09 output type.

---

# 29. Materialization bridge

Part B may implement:

```text
materializeAgentEngineeringTask()
```

in Intelligence.

It may include:

```text
work unit
optional relevant S13D context
bounded existing-Agent descriptors
bounded available Skill IDs
bounded capability descriptors
selected S13E Skill rules/procedure/verification
S13E Quality Contract constraints
```

It must not include:

```text
full Agent catalog
full Skill catalog
Capability Registry
historical session corpus
provider/model configuration
unrelated architecture/research artifacts
```

---

# 30. Candidate builder

Part B may implement a narrow function equivalent to:

```text
buildProposedAgentDefinition()
```

inside:

```text
src/intelligence/agent-engineering/
```

This function:

```text
builds one proposed AgentDefinition from an already-approved S13E design
```

It is **not**:

```text
an Agent Factory
a registry
a runtime compiler replacement
a code generator
a deployment system
```

The actual structural validator remains S10.

---

# 31. Exact Part B scope

Expected responsibilities equivalent to:

```text
src/intelligence/skills/definitions/
  agentEngineeringS13E.ts

src/intelligence/agent-definitions/
  agentEngineerDefinition.ts

src/intelligence/agent-engineering/
  types.ts
  materializeAgentEngineeringTask.ts
  classifyAgentNeed.ts
  selectReusableAgent.ts
  buildProposedAgentDefinition.ts
  validateAgentEngineeringResult.ts
  compareAgentEngineeringRuns.ts

tests/agent-engineering/
  fixtures.ts
  agentEngineering.test.ts

brain-bootstrap/reports/
  S13E-agent-engineering-verification.md
```

Mechanical naming may follow real repo conventions.

Explicitly forbidden Part B artifacts:

```text
AgentFactory
AgentRegistry
MetaAgentRuntime
MultiAgentCoordinator
CapabilityRegistry
MCP manager
automatic candidate writer/registrar
S13F implementation-planning code
```

---

# 32. Deterministic comparison truth

Part B test fixtures must maintain:

```text
runtime input
```

separately from:

```text
fixture truth
```

The fixture truth object must not appear in:

```text
ModelProvider task text
materialized Skill context
Agent state
candidate builder
validator
```

It is consumed only by the test/comparison evaluator after runtime outputs exist.

---

# 33. Required deterministic tests — T1–T30

## T1 — canonical S13E Skill exists

Verify:

```text
brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md
```

contains:

```text
agent necessity
goal
state
tools/capabilities
permissions
memory
termination
evals
human approval
```

---

## T2 — typed Skill validates

S13E typed Skill passes the existing S12 Skill validator.

---

## T3 — typed Skill preserves canonical semantics

Mechanically prove presence of:

```text
DETERMINISTIC_FUNCTION
SKILL_ONLY
AGENT_REQUIRED
REUSE_EXISTING
DESIGN_NEW
least privilege
no automatic registration
```

---

## T4 — DEEP Quality Contract integrity

Parse:

```text
brain-bootstrap/quality-contracts/S13E_AGENT_ENGINEERING_DEEP.yaml
```

and prove:

```text
depth == DEEP
risk == HIGH
irreversibility == HIGH
implementation.deterministic_checks_required == true
challenge.required == true
verification.independent_review_required == true
```

---

## T5 — agent-engineer AgentDefinition validates

The real `agent-engineer-v1` passes S10 validation.

---

## T6 — executing Agent has zero capabilities

Prove:

```text
agent-engineer-v1.tools == []
agent-engineer-v1.capabilities == []

Skill.requires.capabilities == []
Skill.permissions.allowed_capabilities == []
```

---

## T7 — exact S13E Skill allowlist

Prove:

```text
agent-engineer-v1.skills == ["agent-engineering.design.s13e"]
```

---

## T8 — S12 discovery selects S13E

For an agent-engineering task:

```text
S13E descriptor selected
metadata-only discovery
Agent allowlist honored
```

---

## T9 — lazy selected load only

After selection:

```text
S13E loader called exactly once
unrelated Skill loaders called zero times
```

---

## T10 — input validation

Reject at least:

```text
empty goal
missing output schema
missing quality-contract ref
duplicate capability IDs
required capability ID absent from available list when Agent design is required
available_agents > 10
available_skills > 20
available_capabilities > 20
```

---

## T11 — deterministic negative fixture chooses no Agent

Canonical ADR renderer:

```text
NO_AGENT
DETERMINISTIC_FUNCTION
design == null
```

---

## T12 — Skill-only fixture chooses no Agent

Canonical checklist-review fixture:

```text
NO_AGENT
SKILL_ONLY
design == null
```

---

## T13 — adaptive positive fixture requires Agent

Canonical incident-investigation fixture:

```text
AGENT_REQUIRED
```

---

## T14 — reuse-existing fixture avoids a new Agent

Canonical evidence-research fixture:

```text
AGENT_REQUIRED
REUSE_EXISTING
reuse_agent_id == researcher-v1
design == null
```

---

## T15 — missing required capability blocks

Remove:

```text
incident.logs
```

from available capabilities.

Expected:

```text
status == BLOCKED
no candidate definition
```

No invented capability.

---

## T16 — new candidate passes S10 validator

Incident fixture DESIGN_NEW candidate passes the real existing S10 validator.

No weakened parallel structural validation.

---

## T17 — tools/capabilities identity + availability

Prove:

```text
candidate.tools == candidate.capabilities
```

and every selected ID exists in bounded input.

---

## T18 — least privilege

Positive fixture:

```text
incident.read selected
incident.logs selected
incident.admin not selected
```

---

## T19 — permission bound

Candidate allowed side-effect classes are sufficient for selected capabilities and no broader than work-unit allowed classes.

`deny_unlisted_capabilities == true`.

---

## T20 — state vs memory separation

Positive fixture state includes within-run investigation state.

Cross-run memory remains disabled.

---

## T21 — cross-run memory policy

A dedicated fixture with:

```text
requires_cross_run_history == true
```

may enable:

```text
retrieve
remember_candidate
search_history
EXPLICIT_VERIFIED_ONLY
```

but still:

```text
commit_verified_memory == false
```

---

## T22 — termination and limits

Positive candidate:

```text
require_terminal_outcome == true
require_explanation == true
max_turns <= supplied max_turns
timeout_ms <= supplied timeout_ms
```

and no new terminal outcome enum.

---

## T23 — output/rubric/evals completeness

Prove:

```text
candidate.output_schema == work-unit expected schema
candidate.rubric ref == work-unit quality ref
required eval categories all represented
eval refs non-empty
```

---

## T24 — proposal/human approval semantics

Every canonical result:

```text
proposal_status == PROPOSED
approval_required == true
```

No:

```text
ACCEPTED
ACTIVE
REGISTERED
DEPLOYED
```

reference output state.

---

## T25 — optional S13D input immutability

When architecture decision is supplied:

```text
deep equality before/after
```

and its ADR remains PROPOSED.

---

## T26 — no Agent Factory / no candidate auto-registration

Mechanical scan proves no new:

```text
AgentFactory
AgentRegistry
MetaAgentRuntime
registerGeneratedAgent
```

or equivalent generic mechanism is introduced by S13E.

---

## T27 — same S10/S09 runtime path

Baseline and Skill run use:

```text
compileAgentDefinition(agent-engineer-v1)
runAgent()
```

No S13E-specific Core runtime.

---

## T28 — no role/Skill branching in Core

Mechanical scan finds no branch equivalent to:

```text
role === "agent-engineer"
skill.id === "agent-engineering.design.s13e"
```

inside generic Core.

---

## T29 — independent-truth Skill improvement + input dependence

Execute canonical positive/negative/Skill-only/reuse fixtures.

Prove required strict metric improvements from Skill §36.

Also mutate material behavior/capability input and prove the output changes.

Fixture truth must remain test-only and absent from model/materialization input.

---

## T30 — full regression

Run complete suite.

S07–S13D remain PASS.

Typecheck, clean build, and post-build tests remain PASS.

---

# 34. Independent review

Before S13E PASS, independent review must inspect:

```text
agent necessity criteria
deterministic negative fixture
Skill-only fixture
adaptive positive fixture
reuse-existing fixture
blocked missing-capability fixture

candidate S10 validity
least privilege
permissions
state vs memory
termination/limits
eval plan
proposal/human approval

fixture-truth separation
Skill-vs-baseline metrics
input dependence

optional S13D immutability
no Agent Factory
no Core branching
```

Reviewer must answer:

1. Why is an Agent actually necessary in the positive case?
2. Why is an Agent unnecessary in the deterministic negative case?
3. Why does the Skill-only case not need an adaptive loop?
4. Why is reuse better than creating a duplicate Agent?
5. Does the candidate have only the capabilities it needs?
6. Is within-run state being confused with cross-run memory?
7. Can the candidate loop indefinitely?
8. What negative/safety eval protects against over-authority?
9. Is the candidate merely PROPOSED?
10. Is independent test truth genuinely outside the model/comparison synthesis path?

If the review finds a semantic defect in Part A:

```text
S13E_FEEDBACK_REQUIRED
```

and STOP.

---

# 35. PASS criteria

S13E may PASS only if:

1. canonical S13E Skill exists;
2. Skill conforms to S12 Skill Contract v1;
3. dedicated DEEP Quality Contract exists;
4. `agent-engineer-v1` exists and validates;
5. agent-engineer-v1 uses zero tools/capabilities;
6. same S12 → S10 → S09 runtime path is used;
7. deterministic fixed work yields NO_AGENT + DETERMINISTIC_FUNCTION;
8. one-pass semantic work can yield NO_AGENT + SKILL_ONLY;
9. adaptive positive fixture yields AGENT_REQUIRED;
10. existing compatible Agent reuse is preferred over DESIGN_NEW;
11. missing required capability yields BLOCKED rather than fabrication;
12. DESIGN_NEW output contains a full S10-shaped candidate AgentDefinition;
13. candidate passes the existing S10 validator;
14. candidate tools equal capabilities;
15. selected capability IDs exist in bounded input;
16. least-privilege fixture excludes unnecessary capability IDs;
17. permissions are no broader than allowed work-unit side effects;
18. within-run state and cross-run memory remain distinct;
19. default cross-run memory is disabled;
20. cross-run history is enabled only when explicitly required;
21. commit_verified_memory remains false;
22. delegation remains false;
23. candidate termination preserves canonical S09/S10 semantics;
24. candidate limits do not exceed explicit work-unit budget;
25. candidate output schema comes from input;
26. candidate rubric ref comes from input;
27. candidate eval plan covers required categories;
28. no full Agent/Skill/capability catalog is injected;
29. optional S13D input remains immutable;
30. every result is PROPOSED;
31. every result requires human approval;
32. no candidate is auto-registered/activated/deployed;
33. fixture truth is never passed to the model/materializer/builder;
34. Skill-vs-baseline metrics use independent fixture truth;
35. required strict metric improvements pass;
36. negative exact assertions pass;
37. reuse exact assertions pass;
38. input mutations change output materially;
39. no Agent Factory, Capability Registry, multi-agent runtime, or later-step orchestration is introduced;
40. no role/Skill-specific Core branch exists;
41. S13F remains NOT_STARTED;
42. T1–T30 PASS;
43. full regression PASS;
44. typecheck PASS;
45. clean build PASS;
46. post-build tests PASS;
47. independent review finds no unresolved semantic defect;
48. verification report records real bugs/limitations honestly.

---

# 36. Failure conditions

S13E must FAIL or remain BLOCKED if:

- it creates an Agent merely because a task is complex or uses an LLM;
- it creates an Agent for the deterministic ADR-renderer fixture;
- it creates an Agent for the canonical Skill-only fixture;
- it designs a new Agent when an explicitly compatible supplied Agent should be reused;
- it invents a capability ID or Agent ID;
- it silently drops a required capability;
- it grants an unnecessary capability;
- candidate tools and capabilities differ;
- candidate permissions exceed allowed side-effect classes;
- it confuses within-run state with cross-run memory;
- it enables cross-run memory without explicit requirement;
- it sets commit_verified_memory true;
- it invents new terminal outcome semantics;
- it exceeds the work-unit iteration budget;
- it invents output schema or quality-contract refs;
- candidate evals omit negative/safety or least-privilege coverage;
- it auto-registers, activates, deploys, or accepts its own candidate;
- it mutates S13D architecture input;
- it uses fixture truth in model/materialized input;
- its metrics derive expected truth from the same output being scored;
- Skill-vs-baseline comparison is fabricated outside the real runtime;
- output is canned and ignores material behavior/capability input changes;
- it builds a generic Agent Factory, multi-agent runtime, Capability Registry, MCP layer, or S13F implementation;
- it adds S13E role/Skill branching to Core;
- regression/typecheck/build fails.

---

# 37. Verification report

Part B must create:

```text
brain-bootstrap/reports/S13E-agent-engineering-verification.md
```

Minimum contents:

```text
implementation inventory

T1–T30 result table
assertion count

typecheck
pre-build total
build
post-build total

deterministic no-agent fixture
Skill-only fixture
adaptive new-Agent fixture
reuse-existing fixture
blocked missing-capability fixture
cross-run-memory fixture

Agent-necessity decision evidence
candidate S10 validation
tools/capabilities identity
least privilege
permissions
state schema
memory
termination
limits
output schema
rubric
eval plan

PROPOSED/human-approval evidence
S13D immutability evidence

independent fixture-truth separation proof
Skill-vs-baseline metric table
per-metric divergence evidence
input-mutation evidence

S12 discovery/lazy-load evidence
same-runtime proof
zero S13E runtime capability evidence
no Agent Factory evidence
no Core branch evidence
no-new-dependency evidence

independent review findings
bugs found/fixed
limitations
deferred scope
```

---

# 38. Deferred scope

S13E does not implement:

```text
S13F implementation-planning
S13G task-prompt-compiler
Capability Registry
MCP
new capability implementations
Verifier Agent
Architecture Challenger
Workflow Runtime
multi-agent coordination
Orchestrator
Agent Registry
generic Agent Factory
automatic Agent registration
automatic Agent activation
deployment
human approval workflow
Skill Factory
self-improvement
automatic durable-memory promotion
```

---

# 39. Expected closure flow

```text
ChatGPT S13E Part A
↓
Claude Code integrates 3 artifacts verbatim
↓
S13E Part B
↓
typed Skill
agent-engineer-v1
types
necessity classifier
reuse selector
candidate builder
validator
metrics
fixtures
T1–T30
↓
independent review
↓
typecheck/tests/build/post-build
↓
verification report
↓
STATE.yaml S13E PASS
↓
continuity handoff toward S13F
↓
commit/push
↓
STEP_STATUS
↓
STOP
```

S13F must not start automatically.

---

# 40. Author-side self-check

All S13E ambiguities A–Q are resolved.

The design deliberately prevents “everything becomes an Agent” by requiring a real adaptive loop before an Agent is justified.

The hierarchy is:

```text
fixed transformation
→ deterministic function

one-pass semantic guidance
→ Skill-only

adaptive observe-decide-act-observe loop
→ Agent

Agent already exists and explicitly fits
→ reuse it

Agent required and no existing Agent fits
→ design one proposed single Agent

required design evidence missing
→ BLOCKED
```

The new Agent design is complete enough to map to the existing S10 AgentDefinition without modifying S10, but it remains:

```text
PROPOSED
human approval required
not registered
not activated
not deployed
```

S13E itself remains a normal zero-capability Agent using the same generic runtime.

The metric contract explicitly fixes the recurring prior-step weakness by separating:

```text
runtime/model input
```

from:

```text
independent test-only fixture truth
```

so the component being evaluated cannot define its own expected answer.

**Author-side status: READY_FOR_S13E_PART_B.**
