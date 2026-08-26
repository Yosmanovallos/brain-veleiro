# Brain Requirements Discovery Agent v1

**Status:** Canonical S13A execution/verification contract  
**Step:** S13A — requirements-discovery  
**Layer:** Intelligence behavior over S12 Skill loading + S10 AgentDefinition + S09 Agent Runtime  
**Depends on:** S04, S05, S09, S10, S12  
**Authoring split:** ChatGPT Part A → Claude Code Part B

---

# 1. Purpose

S13A must not only author a Skill.

The shared S13x acceptance checklist requires:

```text
ejecutar con un agente real
```

Therefore S13A introduces one minimal real AgentDefinition whose purpose is to prove the Skill through the existing generic runtime.

Canonical path:

```text
raw request
   ↓
requirements-discoverer-v1
   ↓
S12 metadata discovery
   ↓
requirements.discovery.s13a selected
   ↓
lazy load selected Skill only
   ↓
S13A Intelligence materialization bridge
   ↓
S10 compileAgentDefinition()
   ↓
S09 runAgent()
   ↓
StructuredAgentOutput
```

No new runtime is allowed.

---

# 2. Why not reuse `researcher-v1`

S13A MUST NOT expand `researcher-v1` merely to satisfy the acceptance checklist.

Reason:

- Researcher has a research-specific objective;
- Researcher has `research.lookup`;
- Researcher has a dedicated research Quality Contract;
- S13A requires no capability;
- requirements discovery is semantically distinct from evidence-gathering research.

Reusing Researcher would blur Intelligence role boundaries and create unnecessary permissions.

Therefore create a new minimal AgentDefinition:

```text
requirements-discoverer-v1
```

This is configuration, not a new Agent Runtime.

---

# 3. Canonical AgentDefinition

Part B must implement semantic values equivalent to:

```yaml
id: requirements-discoverer-v1
role: requirements-discoverer

objective: >-
  Convert the current ambiguous client request into a structured requirements
  discovery result using the selected Requirements Discovery Skill, while
  preserving unknowns and assumptions instead of inventing missing requirements.

model_policy:
  routing_class: BALANCED
  require_structured_decisions: true
  allow_provider_substitution: true

context_policy:
  retrieval_mode: BOUNDED
  max_context_tokens: 6000
  max_items: 25
  allowed_sources:
    - CURRENT_TASK
    - EXPLICIT_SPEC
    - VERIFIED_HANDOFF
  require_source_refs: true

tools: []

skills:
  - requirements.discovery.s13a

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
  max_turns: 6
  timeout_ms: 10000

termination:
  require_terminal_outcome: true
  require_explanation: true
  note: S13A uses canonical S09 terminal semantics.

rubric:
  quality_contract_ref: brain-bootstrap/quality-contracts/S13A_REQUIREMENTS_DISCOVERY_STANDARD.yaml

evals:
  - evals/s13a/requirements-discovery-positive
  - evals/s13a/requirements-discovery-negative
  - evals/s13a/skill-vs-baseline
```

`state_schema` and `output_schema` follow this contract below.

---

# 4. Capability decision

S13A requires:

```yaml
requires:
  capabilities: []
```

The AgentDefinition must likewise use:

```yaml
tools: []
capabilities: []
```

Reason:

The raw client request is already current-task input.

Reading that input is not an external atomic operation and therefore does not require a Tool.

S13A must not invent a `requirements.read` capability merely to make the Skill look executable.

---

# 5. Memory decision

Reference S13A execution uses no durable memory:

```text
retrieve: false
remember_candidate: false
commit_verified_memory: false
search_history: false
promotion_policy: DISABLED
```

Reason:

The acceptance target is current-request discovery.

Historical memory could make deterministic verification harder and could introduce unsupported client-specific assumptions.

Later production orchestration may choose broader memory policy through AgentDefinition configuration.

---

# 6. State schema

Canonical semantic state:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "raw_request_present": {
      "type": "boolean"
    },
    "selected_skill_id": {
      "type": "string"
    },
    "discovery_complete": {
      "type": "boolean"
    }
  }
}
```

No Core logic may depend on these fields.

---

# 7. RequirementsDiscoveryResult

Canonical semantic shape:

```yaml
request: string

goals:
  - id: string
    statement: string
    origin: EXPLICIT | DERIVED
    source_excerpt: string
    rationale: string
    priority: PRIMARY | SECONDARY

users:
  - id: string
    description: string
    origin: EXPLICIT | DERIVED
    source_excerpt: string
    rationale: string
    needs:
      - string

unknowns:
  - id: string
    question: string
    why_it_matters: string
    impact: HIGH | MEDIUM | LOW
    blocking: boolean
    related_goal_ids:
      - string

assumptions:
  - id: string
    statement: string
    rationale: string
    risk: HIGH | MEDIUM | LOW
    must_validate: boolean
    related_goal_ids:
      - string

constraints:
  - id: string
    statement: string
    kind: BUSINESS | TECHNICAL | TIME | BUDGET | LEGAL | SECURITY | COMPLIANCE | OPERATIONS | OTHER
    origin: EXPLICIT | DERIVED
    source_excerpt: string
    rationale: string

acceptance_criteria:
  - id: string
    criterion: string
    linked_goal_ids:
      - string
    testable: true
    verification_hint: string

handoff:
  ready_for_gap_analysis: boolean
  unresolved_blockers:
    - string
  notes: string
```

---

# 8. Output mapping to S09

S13A does not redefine `StructuredAgentOutput`.

Canonical mapping:

```text
StructuredAgentOutput.summary
=
short requirements-discovery summary

StructuredAgentOutput.data
=
RequirementsDiscoveryResult

StructuredAgentOutput.evidence_refs
=
[]
```

S13A uses no external evidence capability.

Traceability to the raw request lives inside:

```text
origin
source_excerpt
```

rather than S09 evidence refs.

---

# 9. Exact output-schema semantics

Part B must encode an equivalent `JsonSchemaLike` where supported.

Minimum required top-level fields:

```json
{
  "type": "object",
  "required": [
    "request",
    "goals",
    "users",
    "unknowns",
    "assumptions",
    "constraints",
    "acceptance_criteria",
    "handoff"
  ],
  "properties": {
    "request": { "type": "string" },
    "goals": { "type": "array" },
    "users": { "type": "array" },
    "unknowns": { "type": "array" },
    "assumptions": { "type": "array" },
    "constraints": { "type": "array" },
    "acceptance_criteria": { "type": "array" },
    "handoff": { "type": "object" }
  },
  "additionalProperties": false
}
```

If existing `JsonSchemaLike` cannot express every nested invariant, deterministic S13A result validation must enforce the remaining rules outside Core.

Do not expand S09's schema system merely for S13A.

---

# 10. Result validation

Part B must implement:

```text
validateRequirementsDiscoveryResult(...)
```

or equivalent deterministic validation.

Minimum invariants:

## Request

```text
request non-empty
```

## IDs

Unique within each collection:

```text
goal IDs
user IDs
unknown IDs
assumption IDs
constraint IDs
acceptance criterion IDs
```

## Goals

```text
statement non-empty
origin valid
priority valid
EXPLICIT → source_excerpt non-empty
DERIVED → rationale non-empty
```

## Users

```text
description non-empty
origin valid
EXPLICIT → source_excerpt non-empty
DERIVED → rationale non-empty
```

## Unknowns

```text
question non-empty
why_it_matters non-empty
impact valid
related_goal_ids reference real goals
```

## Assumptions

```text
statement non-empty
rationale non-empty
risk valid
related_goal_ids reference real goals
```

## Constraints

```text
statement non-empty
kind valid
origin valid
EXPLICIT → source_excerpt non-empty
DERIVED → rationale non-empty
```

## Acceptance criteria

```text
criterion non-empty
linked_goal_ids.length >= 1
every linked_goal_id exists
testable === true
verification_hint non-empty
```

## Handoff

```text
every unresolved_blocker references an unknown ID
every blocking unknown appears in unresolved_blockers
no non-blocking unknown is required to appear
```

---

# 11. S13B handoff contract

S13B receives the entire `RequirementsDiscoveryResult`.

S13B may classify:

```text
goals
users
unknowns
assumptions
constraints
acceptance criteria
```

using its later canonical categories.

S13A MUST NOT pre-classify items as:

```text
known
told
proven
needs-research
unknowable
```

because those semantics belong to S13B.

S13A only preserves enough origin/ambiguity information for S13B to work efficiently.

---

# 12. S12 Skill loading requirement

S13A execution must genuinely use S12.

Required behavior:

```text
agent.skills
= ["requirements.discovery.s13a"]

discover(task, allowed_skill_ids)
→ descriptor for S13A

load("requirements.discovery.s13a")
→ full selected SkillDefinition only
```

Part B must prove:

- metadata discovery occurs before load;
- unrelated Skills are not fully loaded;
- Agent allowlist is enforced;
- exact selected Skill is loaded.

Do not bypass S12 by directly importing the full Skill in the verification path without exercising discovery/load.

---

# 13. Narrow S13A materialization bridge

S12 intentionally did not define a generic prompt/context Skill materializer.

S13A must therefore introduce only a narrow Intelligence-layer bridge.

Conceptual responsibility:

```ts
materializeRequirementsDiscoveryTask(
  rawRequest,
  agentDefinition,
  loadedSkillDefinition,
  qualityContractRef
)
```

The bridge may produce a task-specific goal/instruction payload for `runAgent()`.

It may include only:

- raw request;
- selected Skill description;
- selected Skill rules;
- selected Skill procedure;
- selected Skill verification expectations;
- Quality Contract reference/required quality constraints.

It MUST NOT include:

- the entire Skill catalog;
- unrelated Skills;
- historical session corpus;
- vendor/provider details.

This bridge is S13A-specific transitional Intelligence code.

It is not a generic Skill execution engine.

---

# 14. Real-agent verification

"Real agent" for S13A means:

```text
real AgentDefinition
+
real S12 discovery/load
+
real S10 compile path
+
real S09 runAgent loop
+
deterministic conforming ModelProvider allowed for verification
```

A hosted/external LLM is not required.

The verification model must respond to the materialized selected Skill instructions and raw request.

It must not simply return one canned final RequirementsDiscoveryResult regardless of input.

Changing the raw request must be capable of changing the resulting discovery output.

---

# 15. Skill-vs-baseline comparison

Use:

```text
same request
same requirements-discoverer-v1 base definition
same provider class
same limits
same generic runtime
```

### Baseline

Do not select/materialize the S13A Skill.

### Skill run

Use S12 to discover + load + materialize `requirements.discovery.s13a`.

The baseline may produce a simpler interpretation, but it must still run legitimately through the same generic Agent architecture.

No manually fabricated "bad baseline JSON" outside the runtime.

---

# 16. Canonical comparison metrics

Part B must compute deterministic metrics:

```yaml
required_section_coverage:
  range: 0..7

explicit_traceability_count:
  integer

unknown_capture_count:
  integer

assumption_visibility_count:
  integer

acceptance_linkage_ratio:
  range: 0..1

acceptance_testability_ratio:
  range: 0..1

fabricated_fact_count:
  integer

unmarked_assumption_count:
  integer
```

For the canonical positive or negative fixture, S13A PASS requires:

```text
skill.required_section_coverage
>
baseline.required_section_coverage
```

and:

```text
skill.acceptance_linkage_ratio
>
baseline.acceptance_linkage_ratio
```

and:

```text
skill.unmarked_assumption_count
<
baseline.unmarked_assumption_count
```

For the underspecified negative fixture:

```text
skill.fabricated_fact_count == 0
```

At least one uncertainty-safety metric and one structural-quality metric must show strict improvement.

---

# 17. Required Part B artifacts

Part B should produce mechanically equivalent responsibilities for:

```text
src/intelligence/skills/definitions/
  requirementsDiscoveryS13A.ts

src/intelligence/agent-definitions/
  requirementsDiscovererDefinition.ts

src/intelligence/requirements-discovery/
  types.ts
  materializeRequirementsDiscoveryTask.ts
  validateRequirementsDiscoveryResult.ts
  compareRequirementsDiscoveryRuns.ts

tests/requirements-discovery/
  fixtures.ts
  requirementsDiscovery.test.ts

brain-bootstrap/reports/
  S13A-requirements-discovery-verification.md
```

Exact filenames may adapt to repository conventions.

No semantic architecture change is allowed.

---

# 18. Required deterministic tests

Part B must implement tests equivalent to T1–T22.

## T1 — canonical Skill source exists

Verify:

```text
brain-bootstrap/skills/REQUIREMENTS_DISCOVERY_SKILL_S13A.md
```

contains the approved S13A identity and semantics.

---

## T2 — typed SkillDefinition validates

The derived TypeScript S13A Skill passes S12 `SkillDefinition` validation.

---

## T3 — typed Skill preserves canonical semantics

Mechanically verify presence of rules/procedure for:

```text
goals
users
unknowns
assumptions
constraints
acceptance criteria
no fabrication
explicit/derived distinction
S13B handoff
```

---

## T4 — dedicated Quality Contract integrity

Parse:

```text
brain-bootstrap/quality-contracts/S13A_REQUIREMENTS_DISCOVERY_STANDARD.yaml
```

and prove the canonical sections exist and:

```text
depth == STANDARD
uncertainty.explicit == true
verification.independent_review_required == true
implementation.tests_required == true
```

---

## T5 — requirements-discoverer AgentDefinition validates

The real AgentDefinition passes S10 validation.

---

## T6 — Agent has no capability/tool dependency

Prove:

```text
tools == []
capabilities == []
```

and the Skill:

```text
requires.capabilities == []
permissions.allowed_capabilities == []
```

---

## T7 — Skill allowlist exact

Prove:

```text
agent.skills == ["requirements.discovery.s13a"]
```

for the canonical AgentDefinition.

---

## T8 — S12 discovery selects S13A

For an ambiguous requirements request:

- descriptor discovery returns S13A as relevant;
- Agent allowlist is respected;
- no full Skill loads occur during ranking.

---

## T9 — lazy load selected Skill only

After selection:

```text
S13A loader called exactly once
unrelated Skill loaders called zero times
```

---

## T10 — same S10/S09 runtime path

S13A executes through:

```text
compileAgentDefinition()
runAgent()
```

No `runRequirementsDiscovery()` Core runtime exists.

---

## T11 — no Skill/role conditional in Core

Mechanical source scan finds no branch equivalent to:

```text
role === "requirements-discoverer"
skill.id === "requirements.discovery.s13a"
```

inside generic Core.

---

## T12 — positive fixture result validates

Use the canonical kiosco/peluche fixture from the Skill.

The result passes deterministic validation.

---

## T13 — positive fixture captures required sections

Result contains:

```text
goals
users
unknowns
assumptions
constraints
acceptance_criteria
handoff
```

with at least one goal, unknown, constraint, and acceptance criterion.

---

## T14 — traceability rules enforced

Invalid:

```text
origin = EXPLICIT
source_excerpt = ""
```

must fail for goal/user/constraint.

Invalid:

```text
origin = DERIVED
rationale = ""
```

must fail where required.

---

## T15 — acceptance linkage enforced

An acceptance criterion referencing a nonexistent goal must fail.

An acceptance criterion with:

```text
testable = false
```

must fail.

---

## T16 — blocker handoff enforced

Every:

```text
unknown.blocking == true
```

must appear in:

```text
handoff.unresolved_blockers
```

Missing blocker reference must fail.

---

## T17 — negative fixture refuses fabrication

Use:

```text
"Quiero una app para mi negocio. Que sea moderna y fácil de usar."
```

The Skill-assisted run must not invent:

```text
React
PostgreSQL
30-day deadline
payments
10,000-user scale
store managers
retail customers
```

unless such facts appear in the input.

The correct output must surface blocking unknowns.

---

## T18 — raw-request dependence

Change the raw request materially.

The resulting goals/unknowns/constraints must change.

A single canned final response must fail this test.

---

## T19 — baseline executes through same architecture

Baseline and Skill run both execute through the generic S10/S09 path.

The test must prove the comparison is not between a real Agent run and a manually constructed fake baseline result.

---

## T20 — Skill improves over baseline

Compute the canonical metrics.

Required strict improvements:

```text
required_section_coverage
acceptance_linkage_ratio
unmarked_assumption_count
```

and zero fabricated facts on the negative fixture.

---

## T21 — no S13B semantics pulled forward

Mechanical inspection of canonical S13A Skill/typed representation must prove it does not define the later S13B classification vocabulary as its own output taxonomy.

Mentioning S13B in documentation/handoff text is allowed.

Using the S13B categories as S13A output fields is forbidden.

---

## T22 — full regression

Run complete suite.

All S07–S12 tests remain PASS.

Typecheck, build, and post-build tests remain PASS.

---

# 19. Independent review criterion

Before S13A PASS, independent verification must inspect at least:

- one positive fixture;
- one negative fixture;
- one Skill-vs-baseline comparison;
- one mechanical no-Core-branch check.

The verifier must be able to explain:

1. what the Skill added;
2. what unsupported facts it prevented;
3. which unknowns remained explicit;
4. why the resulting artifact is ready for S13B.

A prose-only claim that "the Skill improved output" is insufficient without metric/test evidence.

---

# 20. PASS criteria

S13A may PASS only if:

1. canonical S13A Skill exists;
2. it conforms to S12 Skill Contract v1;
3. dedicated STANDARD Quality Contract exists;
4. requirements-discoverer AgentDefinition exists and validates;
5. Agent uses no capabilities;
6. S12 discovery/lazy loading is exercised;
7. only selected Skill is fully loaded;
8. Agent executes through S10 compiler + S09 runtime;
9. positive fixture passes;
10. negative fixture passes without fabricated requirements;
11. output contains goals, users, unknowns, assumptions, constraints, acceptance criteria, and S13B handoff;
12. explicit/derived traceability is enforced;
13. acceptance criteria are linked and testable;
14. blocking unknowns are preserved in handoff;
15. Skill-assisted run shows deterministic improvement versus baseline;
16. output changes when input changes;
17. S13B classification semantics are not pulled forward;
18. no role/Skill-specific Core branch exists;
19. no provider/vendor is hardcoded in canonical Intelligence artifacts;
20. full regression remains PASS;
21. typecheck PASS;
22. build PASS;
23. verification report records evidence and limitations;
24. S13B is not started automatically.

---

# 21. Failure conditions

S13A must FAIL or remain BLOCKED if:

- unsupported client facts are invented;
- ambiguous requirements are silently converted into explicit requirements;
- acceptance criteria are untestable or unlinked;
- blocking unknowns disappear from the handoff;
- the Agent requires a new unnecessary capability;
- the Researcher Agent is repurposed instead of using the approved minimal S13A AgentDefinition;
- a new Core runtime is created;
- Core branches on S13A role/Skill ID;
- full Skill catalog is injected into context;
- Skill vs baseline comparison is manually fabricated rather than executed;
- the baseline uses a materially different runtime/provider setup;
- S13B's full classification taxonomy is implemented early;
- existing S00–S12 contracts are silently changed;
- regression tests fail.

---

# 22. Deferred scope

S13A does not decide:

```text
full knowledge-gap classification
research requirements
deep research procedure
implementation architecture
capability discovery
workflow orchestration
multi-agent coordination
automatic client clarification loop
production UI for requirements intake
Skill Factory
```

Those belong to later steps.

---

# 23. Author-side self-check

S13A now has a complete semantic contract, a Skill conforming to S12, a dedicated Quality Contract, a minimal real AgentDefinition, a concrete output model, a bounded S13B handoff, deterministic positive/negative fixtures, and a measurable Skill-vs-baseline acceptance test. It introduces no capability and no new Core runtime. It preserves the boundary between discovery (S13A) and full gap classification (S13B), so Claude Code can implement Part B without additional semantic decisions.

**Author-side status: READY_FOR_S13A_PART_B.**
