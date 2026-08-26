# Brain Software Architecture Agent v1

**Status:** Canonical S13D execution/verification contract  
**Step:** S13D — software-architecture  
**Layer:** Intelligence over S12 Skill loading + S10 AgentDefinition + S09 Agent Runtime  
**Depends on:** S04, S05, S09, S10, S12, S13B, optionally S13C evidence  
**Authoring split:** ChatGPT Part A → Claude Code Part B

---

# 1. Purpose

S13D converts a bounded architecture question and already-classified/evidenced context into:

```text
balanced alternative comparison
+
trade-offs
+
failure modes
+
cost
+
operations
+
security
+
reversibility
+
proposed ADR
```

Canonical path:

```text
SoftwareArchitectureInput
        ↓
software-architect-v1
        ↓
S12 metadata-only Skill discovery
        ↓
software-architecture.adr.s13d
        ↓
lazy selected Skill load
        ↓
S13D materialization
        ↓
S10 compileAgentDefinition()
        ↓
S09 runAgent()
        ↓
SoftwareArchitectureDecisionResult
        ↓
structured proposed ADR
        +
deterministic Markdown ADR
        ↓
human approval required
```

No new Core runtime is introduced.

---

# 2. Executing Agent decision

Create:

```text
software-architect-v1
```

Do not reuse or modify:

```text
requirements-discoverer-v1
knowledge-gap-analyzer-v1
researcher-v1
deep-researcher-v1
```

Reason:

S13D is a distinct Intelligence responsibility:

```text
architecture synthesis and decision comparison
```

not:

```text
requirements discovery
gap classification
research
```

All roles continue to use the same generic runtime.

---

# 3. Canonical AgentDefinition

Part B must implement semantic values equivalent to:

```yaml
id: software-architect-v1
role: software-architect

objective: >-
  Compare viable software-architecture alternatives across decision drivers,
  hard constraints, trade-offs, failure modes, cost, operations, security,
  and reversibility, then produce an evidence-traceable proposed ADR for
  human approval without mutating upstream knowledge or research state.

model_policy:
  routing_class: QUALITY
  require_structured_decisions: true
  allow_provider_substitution: true

context_policy:
  retrieval_mode: BOUNDED
  max_context_tokens: 10000
  max_items: 50
  allowed_sources:
    - CURRENT_TASK
    - EXPLICIT_SPEC
    - VERIFIED_HANDOFF
    - ADR
    - COMPILED_KNOWLEDGE
  require_source_refs: true

tools: []

skills:
  - software-architecture.adr.s13d

capabilities: []

memory_policy:
  retrieve: true
  remember_candidate: true
  commit_verified_memory: false
  search_history: false
  promotion_policy: EXPLICIT_VERIFIED_ONLY

permissions:
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true

delegation:
  allowed: false

limits:
  max_turns: 12
  timeout_ms: 15000

termination:
  require_terminal_outcome: true
  require_explanation: true
  note: S13D uses canonical S09 terminal semantics.

rubric:
  quality_contract_ref: brain-bootstrap/quality-contracts/S13D_SOFTWARE_ARCHITECTURE_DEEP.yaml

evals:
  - evals/s13d/software-architecture-positive
  - evals/s13d/software-architecture-negative
  - evals/s13d/skill-vs-baseline
```

---

# 4. Capability decision

Canonical:

```text
tools: []
capabilities: []
```

S13D does not call:

```text
research.lookup
```

If evidence is insufficient:

```text
NEEDS_MORE_EVIDENCE
```

or:

```text
BLOCKED
```

is the correct architecture result.

Do not pull research/capability scope into S13D.

---

# 5. Skill decision

Create:

```text
software-architecture.adr.s13d
```

It does not require:

```text
research.evidence-grounded.s11
deep-research.evidence-grounded.s13c
```

as Skill dependencies.

S13D consumes their **outputs** when supplied.

This avoids:

```text
transitive Skill execution
duplicate research
hidden context expansion
```

---

# 6. Input contract

Canonical:

```ts
interface SoftwareArchitectureInput {
  architecture_question: string;

  knowledge_gap_analysis: KnowledgeGapAnalysisResult;

  deep_research?: DeepResearchBatchResult;

  candidate_alternatives?: ArchitectureAlternativeSeed[];
}
```

Validation:

```text
architecture_question non-empty

knowledge_gap_analysis valid

deep_research, when supplied, must be traceably compatible
with knowledge_gap_analysis

candidate_alternatives:
0..4
unique IDs
non-empty names/descriptions
valid origin
```

---

# 7. Upstream immutability

S13D must not mutate:

```text
KnowledgeGapAnalysisResult
DeepResearchBatchResult
```

Part B tests must deep-clone inputs before run and compare after run.

---

# 8. S13C evidence compatibility

When `deep_research` is supplied:

Every processed:

```text
knowledge_item_id
```

must resolve to a corresponding S13B item/research queue entry.

S13D may use:

```text
ResearchResult findings
evidence
contradictions
limitations
research_status
recommended_closure_state
```

as read-only architecture evidence.

It may not write an upstream closure state.

---

# 9. Relevant gap handling

S13D must identify S13B items that materially affect the architecture question.

Canonical architecture blockers include:

```text
DECISION_CRITICAL
+
blocking true
+
still unresolved for the architecture decision
```

A critical item may be considered sufficiently understood for architecture only when:

```text
upstream authority/evidence supports the needed decision driver
or
relevant S13C research is SATISFIED with sufficient evidence/authority
```

S13D still does not modify the item's upstream closure state.

---

# 10. Decision dimensions

Every viable alternative must be analyzed across:

```text
requirements_fit
trade_offs
failure_modes
cost
operations
security
reversibility
```

These are mandatory S13D dimensions.

They are not provider-specific.

---

# 11. Hard constraints

A decision driver with:

```text
hard == true
```

requires an explicit evaluation for every alternative.

Canonical invalid recommendation:

```text
recommended alternative
+
hard driver evaluation == FAIL
```

The validator must reject it.

---

# 12. Architecture comparison balance

Each viable alternative must have:

```text
>= 1 benefit
>= 1 disadvantage
```

unless one side is genuinely empty and the result explicitly explains why.

Reference fixtures require both.

The final recommendation must include rejection reasons for every non-selected alternative.

---

# 13. Failure-mode minimum

For each material fixture failure mode, output must contain:

```text
scenario
trigger
impact
observable_symptom
mitigation_or_containment
residual_risk
```

Do not use:

```text
"it may fail"
```

as sufficient failure-mode analysis.

---

# 14. Security minimum

Security analysis must be specific to architecture.

Reference validator checks presence of meaningful entries in:

```text
trust_boundaries
sensitive_data_exposure
credential_or_secret_implications
attack_surface_notes
security_tradeoffs
unresolved_security_questions
```

Not every array must be non-empty in every real case.

But the canonical fixture must exercise multiple fields.

Generic phrases such as:

```text
"use encryption"
"use best practices"
```

without architecture context do not satisfy the fixture.

---

# 15. Cost semantics

S13D uses relative categories:

```text
LOW
MEDIUM
HIGH
UNKNOWN
```

for:

```text
implementation
ongoing operations
migration/exit
```

unless explicit evidence contains real monetary values.

The reference implementation must not invent currency amounts.

---

# 16. Operations semantics

Operations analysis should address materially relevant:

```text
deployment complexity
operator burden
observability
backup/recovery
failure handling
```

If a dimension is not relevant:

```text
state that explicitly
```

rather than omitting the dimension silently.

---

# 17. Reversibility semantics

S13D must make visible:

```text
migration path
lock-in
exit cost
irreversible/costly decisions
```

This is required because architecture choice quality cannot be evaluated only by initial implementation attractiveness.

---

# 18. Decision status

Canonical:

```ts
type ArchitectureDecisionStatus =
  | "READY_FOR_HUMAN_APPROVAL"
  | "NEEDS_MORE_EVIDENCE"
  | "BLOCKED";
```

No:

```text
ACCEPTED
```

state exists in S13D Agent output.

---

# 19. Recommendation policy

## READY_FOR_HUMAN_APPROVAL

Requires:

```text
2..4 distinct alternatives

hard constraints fully evaluated

recommended alternative has no hard FAIL

no material DECISION_CRITICAL blocker remains

comparison covers all canonical dimensions

recommendation traceable

remaining assumptions/limitations explicit
```

## NEEDS_MORE_EVIDENCE

Requires:

```text
architecture question can be evaluated
but selecting a responsible winner still depends on unresolved material evidence
```

Canonical:

```text
recommended_alternative_id == null
```

## BLOCKED

Requires:

```text
insufficient or contradictory decision context prevents a valid comparison itself
```

---

# 20. ADR status and approval

Canonical:

```text
adr.status == PROPOSED
adr.approval_required == true
```

The Agent may recommend.

It cannot accept its own ADR.

No approval UI/workflow is implemented in S13D.

---

# 21. ADR Markdown

The structured ADR is the machine-verifiable source for the rendered Markdown within an Agent run.

The Markdown renderer is deterministic.

If Part B writes a fixture ADR file for verification, that file is generated test evidence, not automatically a canonical accepted architecture decision.

---

# 22. State schema

Canonical semantic state fields:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "selected_skill_id": {
      "type": "string"
    },
    "alternative_count": {
      "type": "number"
    },
    "hard_constraint_count": {
      "type": "number"
    },
    "decision_status": {
      "type": "string"
    },
    "adr_rendered": {
      "type": "boolean"
    }
  }
}
```

Core must not inspect these role-specific fields.

---

# 23. Materialization bridge

Part B should implement a narrow Intelligence-layer function equivalent to:

```text
materializeSoftwareArchitectureTask()
```

It may include:

```text
architecture_question
relevant S13B items
relevant S13C evidence
candidate alternatives
selected S13D Skill description/rules/procedure/verification
S13D Quality Contract constraints
```

It must not include:

```text
full Skill catalog
unrelated research corpus
whole session history
vendor/model configuration
unrelated ADR collection
```

This is not a generic architecture workflow engine.

---

# 24. Expected Part B artifacts

Responsibilities equivalent to:

```text
src/intelligence/skills/definitions/
  softwareArchitectureS13D.ts

src/intelligence/agent-definitions/
  softwareArchitectDefinition.ts

src/intelligence/software-architecture/
  types.ts
  materializeSoftwareArchitectureTask.ts
  validateSoftwareArchitectureResult.ts
  compareSoftwareArchitectureRuns.ts
  renderArchitectureDecisionRecord.ts

tests/software-architecture/
  fixtures.ts
  softwareArchitecture.test.ts

brain-bootstrap/reports/
  S13D-software-architecture-verification.md
```

Names may adapt mechanically to repository conventions.

Semantic responsibilities may not change.

---

# 25. Required deterministic tests — T1–T28

## T1 — canonical S13D Skill source exists

Verify:

```text
brain-bootstrap/skills/SOFTWARE_ARCHITECTURE_SKILL_S13D.md
```

contains:

```text
alternatives
trade-offs
failure modes
cost
operations
security
ADR
human approval
```

---

## T2 — typed Skill validates

S13D typed Skill passes S12 Skill validation.

---

## T3 — typed Skill preserves canonical semantics

Mechanically prove presence of:

```text
2..4 alternatives
canonical dimensions
hard-constraint rule
PROPOSED ADR
approval_required
zero capabilities
```

---

## T4 — DEEP Quality Contract integrity

Parse:

```text
brain-bootstrap/quality-contracts/S13D_SOFTWARE_ARCHITECTURE_DEEP.yaml
```

and prove:

```text
depth == DEEP
risk == HIGH
irreversibility == HIGH
research.alternatives_required == true
implementation.tradeoffs_required == true
verification.independent_review_required == true
```

---

## T5 — software-architect AgentDefinition validates

The real S13D AgentDefinition passes S10 validation.

---

## T6 — zero capability/tool dependency

Prove:

```text
AgentDefinition.tools == []
AgentDefinition.capabilities == []

Skill.requires.capabilities == []
Skill.permissions.allowed_capabilities == []
```

---

## T7 — exact Skill allowlist

Prove:

```text
agent.skills == ["software-architecture.adr.s13d"]
```

---

## T8 — S12 discovery selects S13D

For a software-architecture task:

```text
S13D descriptor selected
metadata-only discovery
Agent allowlist honored
```

---

## T9 — lazy selected load only

After selection:

```text
S13D loader called once
unrelated Skill loaders called zero times
```

---

## T10 — input contract validation

Reject:

```text
empty architecture_question
invalid S13B input
>4 alternatives
duplicate alternative IDs
```

Accept:

```text
S13B only
S13B + S13C
```

---

## T11 — upstream compatibility

When S13C input exists:

Every processed deep-research `knowledge_item_id` must resolve to S13B context.

Invalid mismatch fails.

---

## T12 — upstream immutability

After run:

```text
knowledge_gap_analysis unchanged
deep_research unchanged
```

deep equality.

---

## T13 — alternative count and origin

Non-blocked positive fixture:

```text
2..4 alternatives
unique IDs
each origin PROVIDED|GENERATED
```

---

## T14 — hard-constraint coverage

Every hard constraint has one evaluation per alternative.

---

## T15 — hard-constraint violation blocks recommendation

An alternative with:

```text
hard driver == FAIL
```

cannot be the recommended alternative.

Canonical negative fixture proves remote Postgres-only is not recommendable while offline operation is hard.

---

## T16 — balanced comparison

Each canonical fixture alternative includes:

```text
benefit
disadvantage
```

and recommendation contains rejection reasons for non-selected alternatives.

---

## T17 — canonical dimension coverage

Every viable positive-fixture alternative has:

```text
requirements fit
trade-offs
failure modes
cost
operations
security
reversibility
```

---

## T18 — failure-mode structure

Fixture failure modes validate:

```text
trigger
impact
observable symptom
mitigation/containment
residual risk
```

---

## T19 — architecture-specific security

Positive fixture security analysis includes architecture-specific differences between local and remote persistence.

Generic boilerplate-only output must fail the canonical fixture validator.

---

## T20 — cost/operations/reversibility

Positive fixture proves separate:

```text
implementation cost
operational cost
exit cost
deployment/operator burden
backup/recovery
migration/lock-in
```

---

## T21 — evidence traceability

Material recommendation claims resolve to valid:

```text
S13B refs
S13C refs
or explicit fixture/context refs
```

Metric denominator must include fixture-defined material claims, not only already-traceable output claims.

---

## T22 — unresolved critical gap prevents readiness

Given a fixture where a relevant:

```text
DECISION_CRITICAL
blocking
```

item remains unresolved and materially affects selection:

```text
READY_FOR_HUMAN_APPROVAL
```

must be rejected.

Expected:

```text
NEEDS_MORE_EVIDENCE
or
BLOCKED
```

---

## T23 — ADR semantics

Prove:

```text
adr.status == PROPOSED
adr.approval_required == true
```

and no `ACCEPTED` output is possible in the canonical type/reference implementation.

---

## T24 — deterministic Markdown ADR

Render structured ADR.

Prove canonical section order and that material rendered decision/alternatives/evidence correspond to structured fields.

No extra semantic claim may appear only in Markdown.

---

## T25 — same S10/S09 runtime path

Baseline and Skill run execute through:

```text
compileAgentDefinition()
runAgent()
```

No SoftwareArchitecture runtime in Core.

---

## T26 — no role/Skill branching in Core

Mechanical scan finds no branch equivalent to:

```text
role === "software-architect"
skill.id === "software-architecture.adr.s13d"
```

in generic Core.

---

## T27 — input dependence + Skill improvement

Run:

```text
positive fixture
negative fixture
mutated offline-constraint fixture
```

Prove:

```text
output changes when material architecture constraint changes
```

and canonical Skill-vs-baseline strict improvements/negative exact values all pass.

---

## T28 — full regression

Run entire suite.

S07–S13C remain PASS.

Typecheck, clean build, and post-build tests remain PASS.

---

# 26. Independent review

Before S13D PASS, independent review must inspect:

```text
positive fixture
negative hard-constraint fixture
mutated input fixture
alternative fairness
hard constraints
failure modes
cost
operations
security
reversibility
evidence traceability
unresolved blockers
ADR human-approval semantics
Skill-vs-baseline metrics
S13B/S13C immutability
no-Core-branch evidence
```

Reviewer must be able to answer:

1. What exact architecture decision is being made?
2. What are the viable alternatives?
3. What hard constraints govern the choice?
4. What is gained and lost with each alternative?
5. How can each alternative fail?
6. What are the cost and operational consequences?
7. What architecture-specific security trade-offs exist?
8. Which evidence supports the recommendation?
9. What assumptions and unknowns remain?
10. Why is the selected alternative superior to each rejected alternative?
11. Is the result truly ready for human approval?
12. Why is the ADR still PROPOSED rather than ACCEPTED?

---

# 27. PASS criteria

S13D may PASS only if:

1. canonical S13D Skill exists;
2. Skill conforms to S12 Skill Contract v1;
3. dedicated DEEP Quality Contract exists;
4. `software-architect-v1` exists and validates;
5. no capabilities/tools are required;
6. S12 discovery/lazy loading is exercised;
7. same S10 compiler/S09 runtime is used;
8. SoftwareArchitectureInput accepts full S13B context;
9. optional S13C context is read-only and traceably compatible;
10. upstream S13B/S13C inputs remain unchanged;
11. a non-blocked decision compares 2–4 alternatives;
12. every alternative origin is explicit;
13. hard constraints are evaluated for every alternative;
14. no recommended alternative violates a hard constraint;
15. every viable alternative has balanced benefits/disadvantages;
16. all canonical architecture dimensions are covered;
17. material failure modes are structured and explicit;
18. cost does not invent unsupported monetary precision;
19. operations analysis is decision-specific;
20. security analysis is architecture-specific;
21. reversibility/lock-in are explicit;
22. generated assumptions remain visible;
23. evidence traceability is valid;
24. unresolved decision-critical gaps prevent false readiness;
25. recommendation compares winner against rejected alternatives;
26. ADR status is PROPOSED;
27. approval_required is true;
28. deterministic Markdown ADR matches structured ADR;
29. S13D does not apply S13C closure state;
30. Skill-assisted run improves canonical metrics versus baseline;
31. negative fixture has zero hard-constraint violation recommendation;
32. output changes when material architecture input changes;
33. no role/Skill-specific Core branching exists;
34. no new capability/MCP/research infrastructure is introduced;
35. S13E remains NOT_STARTED;
36. T1–T28 PASS;
37. full regression PASS;
38. typecheck PASS;
39. clean build PASS;
40. post-build tests PASS;
41. independent review finds no unresolved semantic defect;
42. verification report records real bugs/limitations honestly;
43. generated ADR is not automatically committed as accepted architectural authority.

---

# 28. Failure conditions

S13D must FAIL or remain BLOCKED if:

- it recommends an alternative without comparing at least one genuine alternative;
- it recommends an alternative with an unresolved hard-constraint FAIL;
- it uses different comparison criteria to favor the selected option;
- it hides material disadvantages of the recommended alternative;
- it ignores a fixture-defined material failure mode;
- it omits cost, operations, security, or reversibility from a non-blocked canonical comparison;
- it invents precise cost values without evidence;
- it uses generic security boilerplate instead of architecture-specific analysis;
- it treats generated alternatives as stakeholder-approved;
- it hides assumptions as verified facts;
- it loses evidence traceability;
- it reports READY_FOR_HUMAN_APPROVAL despite a relevant unresolved decision-critical blocker;
- it mutates S13B/S13C input or applies S13C closure recommendations;
- it marks the ADR ACCEPTED;
- it sets approval_required false;
- Markdown contains semantic claims absent from the structured ADR;
- the Skill-vs-baseline comparison is fabricated outside the real runtime;
- output is canned and does not react to material input changes;
- it creates a new Core runtime or role/Skill branch;
- it introduces a new capability, MCP, or research provider;
- it implements S13E agent-engineering;
- regression/typecheck/build fails.

---

# 29. Verification report

Part B must create:

```text
brain-bootstrap/reports/S13D-software-architecture-verification.md
```

Minimum contents:

```text
implementation inventory

T1–T28 result table
assertion count

typecheck
pre-build total
build
post-build total

positive kiosk architecture fixture
negative hard-constraint fixture
mutated-input fixture

decision drivers
hard constraints
alternative origins
requirements fit

trade-offs
failure modes
cost
operations
security
reversibility

evidence traceability
assumptions
unresolved decision gaps

ADR structured output
Markdown rendering
PROPOSED/human-approval evidence

Skill-vs-baseline metrics
same-runtime proof
input-dependence proof

S12 discovery/lazy loading
zero-capability evidence
S13B/S13C immutability
no-Core-branch evidence
no-new-dependency evidence

independent review findings
bugs found/fixed
limitations
deferred scope
```

---

# 30. Deferred scope

S13D does not implement:

```text
S13E agent-engineering
implementation planning
task prompt compilation
Verifier Agent
Capability Registry
MCP
new research provider
Workflow Runtime
Orchestrator
human approval workflow
automatic ADR acceptance
automatic application of S13C closure recommendations
automatic durable-memory promotion
Knowledge Graph runtime
Skill Factory
self-improvement
```

---

# 31. Expected closure flow

```text
ChatGPT S13D Part A
↓
Claude Code integrates 3 artifacts verbatim
↓
S13D Part B
↓
typed Skill
software-architect-v1
types
materialization
validator
ADR renderer
comparison metrics
fixtures
T1–T28
↓
independent review
↓
typecheck/tests/build/post-build
↓
verification report
↓
STATE.yaml S13D PASS
↓
continuity handoff toward S13E
↓
commit/push
↓
STEP_STATUS
↓
STOP
```

S13E must not start automatically.

---

# 32. Author-side self-check

All eleven S13D ambiguities are resolved.

The resulting architecture intentionally keeps responsibilities separated:

```text
S13B
classifies what is known/unknown/researchable

S13C
researches selected NEEDS_RESEARCH items

S13D
compares software architecture alternatives and produces a proposed ADR

S13E
remains responsible for deciding/designing Agents
```

S13D therefore:

- does not become another research step;
- does not apply S13C closure recommendations;
- does not mutate upstream state;
- does not introduce capabilities;
- does not accept its own ADR;
- does not pull agent-engineering forward.

Its durable contribution is an evidence-traceable **PROPOSED** ADR plus a balanced architecture comparison ready for human review.

**Author-side status: READY_FOR_S13D_PART_B.**
