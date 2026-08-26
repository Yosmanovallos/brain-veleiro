# Brain Researcher Agent v1

**Status:** Canonical S11 semantic contract
**Step:** S11 — Primer agente real: Researcher
**Layer:** Intelligence behavior executed through existing Core runtime
**Depends on:** S04, S05, S07, S09, S10
**Authoring split:** ChatGPT Part A → Claude Code Part B

---

# 1. Purpose

S11 introduces Brain's first real Agent behavior:

```text
Researcher
```

The purpose is not to introduce a new Agent Runtime.

The purpose is to prove that the generic runtime from S09 plus the declarative AgentDefinition model from S10 can execute a bounded, evidence-grounded research procedure whose important claims are independently traceable.

Canonical path:

```text
Research question
       ↓
S11 Research Skill
       +
S11 Quality Contract
       ↓
Researcher AgentDefinition
       ↓
S11 Intelligence materialization bridge
       ↓
S10 compileAgentDefinition()
       ↓
S09 runAgent()
       ↓
CapabilityProvider → research.lookup
       ↓
Evidence-grounded StructuredAgentOutput
```

No Researcher-specific Core runtime is permitted.

---

# 2. Verified foundations

S11 assumes the already-approved contracts:

```text
S04 Quality Architecture
S05 Context Architecture
S07 MemoryProvider
S09 Agent Runtime
S10 AgentDefinition
```

S11 MUST NOT redefine:

- `StructuredAgentOutput`;
- `TerminalOutcome`;
- `ModelProvider`;
- `CapabilityProvider`;
- `ToolDescriptor`;
- `AgentRunLimits`;
- AgentDefinition's generic role semantics;
- S07 durable-memory promotion rules.

---

# 3. Resolution of S11 ambiguities

## Decision 1 — Skill shape before S12

S12 has not defined Skill Contract v1.

Therefore S11 uses:

```text
brain-bootstrap/skills/RESEARCH_SKILL_S11.md
```

as a **provisional S11-only semantic Skill artifact**.

It is not the generic Brain Skill contract.

S12 later owns normalization/migration.

S11 MUST NOT pull S12 forward.

---

## Decision 2 — Evidence capability before S14

S11 genuinely needs to gather Evidence.

The existing `word_count` capability cannot satisfy:

- primary-source preference;
- source dates;
- cross-checking;
- contradictory evidence;
- claim traceability.

Therefore S11 introduces exactly one narrow reference capability:

```text
research.lookup
```

behind the existing S09 `CapabilityProvider`.

The S11 reference capability:

- searches a bounded deterministic local source corpus;
- performs a real lookup;
- is read-only;
- has side effect class `NONE`;
- returns source metadata and excerpt;
- is not a registry;
- is not MCP;
- is not a web-search architecture;
- does not define S14.

S14 remains responsible for the general capability/tool/MCP system later.

---

## Decision 3 — Real external LLM

S11 does **not** require a real external LLM for PASS.

Reason:

S11's architectural acceptance criteria are about observable research behavior:

- Knowledge Gap Analysis;
- evidence grounding;
- source traceability;
- cross-checking;
- contradictions;
- unknowns;
- value-of-information stopping;
- output validity.

Those properties can and SHOULD be verified deterministically.

Part B MAY use a deterministic research ModelProvider fixture/reference implementation for verification.

Important restriction:

The deterministic model MUST NOT contain the final research answer as a canned constant.

The test question's answer MUST be derived from Evidence returned by `research.lookup`.

A change in the source fixture must be capable of changing the resulting finding.

This proves actual evidence-dependent behavior rather than merely replaying a scripted final answer.

A future conforming real ModelProvider can replace the deterministic provider without changing Core.

S11 therefore proves the behavioral contract, not general real-world LLM research quality.

---

## Decision 4 — Output mapping

S11 does not redefine `StructuredAgentOutput`.

Mapping:

```text
StructuredAgentOutput.summary
=
ResearchResult.decision_relevant_summary

StructuredAgentOutput.data
=
ResearchResult

StructuredAgentOutput.evidence_refs
=
de-duplicated union of every evidence_ref
used by findings and contradictions
```

The S11 research shape is therefore data carried inside the S09 output contract.

---

## Decision 5 — Quality Contract

Canonical instance:

```text
brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml
```

Depth:

```text
STANDARD
```

This follows S04's explicit classification of a simple Agent as STANDARD.

S11 is reversible/bootstrap-scoped and does not yet introduce autonomous multi-agent, security, money, sensitive data, or difficult-to-reverse production infrastructure.

---

## Decision 6 — Deterministic verification

S11 requires explicit mechanical validation of:

- Skill artifact integrity;
- Quality Contract integrity;
- AgentDefinition validity;
- evidence retrieval;
- bounded retrieval;
- Knowledge Gap Analysis;
- evidence metadata;
- cross-validation;
- unsupported-claim rejection;
- contradiction exposure;
- unknown exposure;
- VOI stop behavior;
- exact StructuredAgentOutput mapping;
- provider neutrality;
- no role-specific Core runtime;
- evidence-dependent result behavior.

The required tests are defined in Section 15.

---

# 4. Transitional Skill materialization decision

S11 exposes an additional problem caused by step order:

```text
S11 needs a Skill
but
S12 generic Skill loading does not exist yet
```

S11 resolves this without creating a Skill Registry.

Part B MUST implement a narrow **Intelligence-layer S11 materialization bridge**.

Conceptually:

```text
question
+
approved Research Skill semantics
+
approved S11 Quality Contract
+
base Researcher AgentDefinition
        ↓
materializeResearchTask(...)
        ↓
task-specific AgentDefinition
        ↓
compileAgentDefinition(...)
        ↓
runAgent(...)
```

This bridge:

- belongs outside Core;
- handles only the one approved S11 Research Skill;
- performs no registry discovery;
- performs no version resolution;
- performs no dynamic plugin loading;
- MUST NOT branch inside Core on `role === "researcher"`.

The task-specific definition may derive its `objective` from:

- the base Researcher objective;
- current research question;
- applicable Research Skill rules/procedure;
- Quality Contract requirements.

This is a bounded explicit materialization of one approved Skill, not context stuffing of a knowledge base.

S12 may later replace this bridge with generic Skill loading.

---

# 5. Researcher AgentDefinition

Part B MUST create a real Intelligence-layer Researcher AgentDefinition with semantics equivalent to:

```yaml
id: researcher-v1
role: researcher

objective: >-
  Answer the current research question using bounded evidence gathering,
  Knowledge Gap Analysis, explicit claim-to-evidence traceability,
  contradiction and unknown handling, and the applicable value-of-information
  stop rule.

model_policy:
  routing_class: QUALITY
  require_structured_decisions: true
  allow_provider_substitution: true

context_policy:
  retrieval_mode: BOUNDED
  max_context_tokens: 8000
  max_items: 40
  allowed_sources:
    - CURRENT_TASK
    - CURRENT_RUN
    - EXPLICIT_SPEC
    - VERIFIED_HANDOFF
    - ADR
    - COMPILED_KNOWLEDGE
    - DURABLE_MEMORY
  require_source_refs: true

tools:
  - research.lookup

skills:
  - research.evidence-grounded.s11

capabilities:
  - research.lookup

memory_policy:
  retrieve: true
  remember_candidate: true
  commit_verified_memory: false
  search_history: true
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
  note: S11 Researcher uses canonical S09 terminal semantics.

rubric:
  quality_contract_ref: brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml

evals: []
```

`state_schema` and `output_schema` are specified below.

The implementation may adapt syntax to the exact existing TypeScript types.

Semantic values above are canonical.

---

# 6. Researcher working state schema

S11 may use a role-specific working-state schema while Core remains generic.

Equivalent `JsonSchemaLike`:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "open_gap_ids": {
      "type": "array",
      "items": { "type": "string" }
    },
    "lookup_count": {
      "type": "number"
    },
    "evidence_refs_seen": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

No Core logic may depend on these property names.

---

# 7. Research output model

Semantic `ResearchResult`:

```yaml
question: string

subquestions:
  - id: string
    question: string
    gap_class: DECISION_CRITICAL | DECISION_RELEVANT | CONTEXTUAL | TRIVIA
    why_it_matters: string
    decision_affected: string
    status: OPEN | RESOLVED_WITH_EVIDENCE | RESOLVED_BY_AUTHORITY | ACCEPTED_AS_ASSUMPTION | DEFERRED_WITHOUT_DECISION_IMPACT | BLOCKED

findings:
  - id: string
    claim: string
    criticality: DECISION_CRITICAL | DECISION_RELEVANT | CONTEXTUAL
    epistemic_status: EVIDENCED | INFERENCE | UNCERTAIN
    evidence:
      - evidence_ref: string
        source_ref: string
        source_title: string
        source_type: PRIMARY | SECONDARY | DIRECT_OBSERVATION | OTHER
        authority: string
        independence_group: string
        observed_or_published_at: string
        locator: string
        relationship: SUPPORTS | CONTRADICTS | QUALIFIES
    confidence: HIGH | MEDIUM | LOW
    limitations:
      - string

contradictions:
  - topic: string
    claim_refs:
      - string
    evidence_refs:
      - string
    description: string
    resolution: RESOLVED | UNRESOLVED | NOT_DECISION_RELEVANT
    limitations:
      - string

unknowns:
  - question: string
    gap_class: DECISION_CRITICAL | DECISION_RELEVANT | CONTEXTUAL
    reason_unresolved: string
    decision_impact: string
    revalidation_trigger: string

research_status:
  state: SATISFIED | EXHAUSTED_WITH_UNCERTAINTY | MORE_RESEARCH_NEEDED
  reason: string
  unresolved_decision_critical_gaps:
    - string
  additional_research_expected_to_change_decision: boolean

decision_relevant_summary: string
```

`research_status` is an additive S11 observability field.

It is necessary because S11 explicitly requires a mechanically testable value-of-information stop rule.

It is not a replacement for `TerminalOutcome`.

---

# 8. Exact AgentDefinition output_schema

Part B MUST encode an equivalent `JsonSchemaLike`.

Minimum exact semantics:

```json
{
  "type": "object",
  "required": [
    "question",
    "subquestions",
    "findings",
    "contradictions",
    "unknowns",
    "research_status",
    "decision_relevant_summary"
  ],
  "properties": {
    "question": {
      "type": "string"
    },
    "subquestions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "question",
          "gap_class",
          "why_it_matters",
          "decision_affected",
          "status"
        ]
      }
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "claim",
          "criticality",
          "epistemic_status",
          "evidence",
          "confidence",
          "limitations"
        ]
      }
    },
    "contradictions": {
      "type": "array"
    },
    "unknowns": {
      "type": "array"
    },
    "research_status": {
      "type": "object",
      "required": [
        "state",
        "reason",
        "unresolved_decision_critical_gaps",
        "additional_research_expected_to_change_decision"
      ]
    },
    "decision_relevant_summary": {
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

If the existing S09 `JsonSchemaLike` representation supports enum/item/property detail, Part B MUST encode the enum and nested requirements from Section 7 as well.

If existing `JsonSchemaLike` is intentionally shallow and cannot express those constraints, deterministic S11 result validation MUST enforce them outside Core.

Do not modify S09's schema type merely to obtain full JSON Schema functionality.

---

# 9. StructuredAgentOutput mapping

Given:

```text
result: ResearchResult
```

the canonical S09 output MUST be semantically:

```text
summary
= result.decision_relevant_summary
```

```text
data
= result
```

```text
evidence_refs
= unique deterministic union of:
  findings[*].evidence[*].evidence_ref
  +
  contradictions[*].evidence_refs[*]
```

Recommended deterministic ordering:

```text
first occurrence order
```

No duplicate Evidence IDs.

An Evidence ref listed in `StructuredAgentOutput.evidence_refs` MUST occur in the ResearchResult.

---

# 10. Material claim acceptance invariant

This is S11's primary mechanical invariant.

For every finding where:

```text
criticality == DECISION_CRITICAL
```

one of the following MUST be true:

### Path A — Evidenced

```text
epistemic_status == EVIDENCED
AND
evidence.length >= 1
```

For STANDARD depth, independent cross-validation must additionally be attempted.

### Path B — Explicit inference

```text
epistemic_status == INFERENCE
AND
limitations.length >= 1
```

Any available supporting Evidence must remain attached.

### Path C — Explicit uncertainty

```text
epistemic_status == UNCERTAIN
AND
limitations.length >= 1
```

and the related uncertainty must remain visible in `unknowns` when decision-relevant.

Forbidden:

```text
DECISION_CRITICAL
+
evidence.length == 0
+
epistemic_status == EVIDENCED
```

This MUST fail deterministic validation.

---

# 11. Cross-validation invariant

For STANDARD S11:

A DECISION_CRITICAL or DECISION_RELEVANT `EVIDENCED` finding SHOULD contain Evidence from at least two different:

```text
independence_group
```

values when the source corpus makes independent Evidence available.

If only one independent source is available:

- finding may remain;
- limitation MUST explicitly state cross-validation could not be completed;
- confidence MUST reflect the limitation.

The deterministic fixture set MUST include at least one claim where independent cross-validation is possible so Part B can prove this behavior positively.

---

# 12. Contradiction invariant

The S11 deterministic research corpus MUST contain at least one meaningful conflicting or qualifying Evidence pair.

The Researcher must not discard one side.

Result must contain a `contradictions` entry referencing the conflicting Evidence.

If the conflict cannot be resolved:

```text
resolution: UNRESOLVED
```

and the limitation/decision impact must remain visible.

---

# 13. Unknown invariant

The deterministic verification scenario MUST contain at least one question/gap for which the bounded source corpus cannot supply sufficient Evidence.

The result MUST surface that fact in:

```text
unknowns
```

It MUST NOT fabricate a finding to fill the gap.

---

# 14. Value-of-information invariant

The Researcher must evaluate the stop condition after evidence collection.

A run may return:

### SATISFIED

when:

- no blocking DECISION_CRITICAL gap remains;
- Quality Contract Evidence requirements are satisfied;
- another lookup is unlikely to materially change the decision.

### EXHAUSTED_WITH_UNCERTAINTY

when:

- the bounded source set is exhausted;
- uncertainty remains;
- uncertainty is explicit;
- the decision may still proceed under the Quality Contract.

### MORE_RESEARCH_NEEDED

when:

- another plausible lookup could materially change the answer;
- required gaps/evidence thresholds remain incomplete.

If continued research is required but unavailable due to capability/resource/permission limits, use S09's existing:

```text
BLOCKED
```

when appropriate.

No fourth TerminalOutcome is created.

---

# 15. Required S11 contract tests

Part B MUST implement deterministic tests with equivalent semantics.

Test names may vary.

Semantics may not.

## T1 — Research Skill artifact integrity

Verify:

```text
brain-bootstrap/skills/RESEARCH_SKILL_S11.md
```

exists and contains the canonical:

```text
research.evidence-grounded.s11
research.lookup
Knowledge Gap Analysis
cross-check
contradictions
unknowns
value-of-information
```

semantics.

---

## T2 — Quality Contract instance integrity

Parse:

```text
brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml
```

and prove:

```text
depth == STANDARD
evidence.required == true
evidence.primary_sources_preferred == true
evidence.cross_validation == true
research.knowledge_gaps_required == true
research.contradictory_evidence_required == true
research.value_of_information_stop_rule == true
challenge.required == true
verification.independent_review_required == true
uncertainty.explicit == true
```

Also prove all canonical S04 template sections remain present.

---

## T3 — Researcher AgentDefinition validates

The real S11 Researcher AgentDefinition passes the existing S10 validation path.

---

## T4 — Researcher remains on generic runtime

Prove Researcher executes through:

```text
compileAgentDefinition()
→
runAgent()
```

No `runResearcherRuntime()` or alternative Core loop exists.

---

## T5 — no role conditional in Core

Mechanical source scan finds no new Core control flow equivalent to:

```text
role === "researcher"
```

---

## T6 — capability policy is exact

Researcher AgentDefinition exposes:

```text
tools == ["research.lookup"]
capabilities == ["research.lookup"]
```

and the S10 restricted capability boundary prevents unlisted capability invocation.

---

## T7 — research.lookup performs a real bounded lookup

Given at least two distinct queries over the deterministic research corpus:

- the provider executes actual lookup logic;
- outputs are determined by corpus/query;
- result count never exceeds `limit`;
- `limit > 5` is rejected or bounded according to the approved input validation;
- the provider does not return one identical canned answer for every query.

---

## T8 — bounded retrieval

Prove Researcher does not request the complete source corpus by default.

Reference lookup call limit is at most:

```text
5
```

per call.

---

## T9 — Knowledge Gap Analysis visible

For the S11 real verification question:

- `subquestions.length >= 1`;
- each subquestion contains `gap_class`;
- at least one gap is DECISION_CRITICAL or DECISION_RELEVANT;
- each material gap exposes why it matters and decision affected.

---

## T10 — authoritative source preference

When the reference corpus contains both a relevant PRIMARY source and lower-authority supporting source, the resulting material claim includes the PRIMARY source when applicable.

---

## T11 — evidence metadata completeness

Every Evidence item used by a material finding includes non-empty:

```text
evidence_ref
source_ref
source_title
source_type
authority
independence_group
observed_or_published_at
locator
relationship
```

---

## T12 — claim confidence and limitations

Every material finding contains:

```text
confidence
epistemic_status
limitations
```

with valid canonical values.

---

## T13 — STANDARD cross-validation

For a fixture claim with two independently sourced supporting items:

- both are represented;
- their `independence_group` values differ;
- the claim satisfies cross-validation.

A duplicate/upstream-equivalent pair MUST NOT be counted as independent.

---

## T14 — unsupported critical claim rejected

Construct an invalid result:

```text
criticality = DECISION_CRITICAL
epistemic_status = EVIDENCED
evidence = []
```

S11 deterministic result validation MUST reject it.

---

## T15 — explicit inference accepted but visible

Construct a decision-critical inference with:

```text
epistemic_status = INFERENCE
limitations.length >= 1
```

and suitable supporting Evidence where available.

Validator accepts the shape but preserves that it is inference rather than converting it to EVIDENCED.

---

## T16 — explicit uncertainty accepted but visible

A claim with insufficient Evidence may use:

```text
epistemic_status = UNCERTAIN
```

only when limitation is explicit and corresponding material uncertainty is not hidden.

---

## T17 — contradictions surfaced

Use fixture Evidence that materially disagrees.

Result contains a contradiction referencing both sides.

The test fails if the conflict is silently omitted.

---

## T18 — unknowns surfaced

Use a material gap absent from the fixture corpus.

Result contains an `unknowns` entry.

The Researcher MUST NOT manufacture Evidence or a resolved factual finding.

---

## T19 — value-of-information SATISFIED

Fixture where all decision-critical gaps are sufficiently resolved and another lookup cannot materially alter the decision.

Expected:

```text
research_status.state == SATISFIED
additional_research_expected_to_change_decision == false
```

with non-empty reason.

---

## T20 — value-of-information unresolved path

Fixture where a decision-critical gap remains and additional research could matter.

Expected:

```text
MORE_RESEARCH_NEEDED
```

or existing S09 `BLOCKED` when the bounded capability cannot continue.

No fabricated resolution.

---

## T21 — StructuredAgentOutput exact mapping

Prove:

```text
output.summary
==
output.data.decision_relevant_summary
```

and `data` contains the canonical ResearchResult shape.

---

## T22 — evidence_refs exact mapping

Prove `StructuredAgentOutput.evidence_refs` equals the deterministic de-duplicated first-occurrence union of Evidence refs used by findings and contradictions.

No orphan or duplicate refs.

---

## T23 — evidence-dependent result

Modify a material source in the deterministic fixture corpus while keeping the question/model sequencing equivalent.

The corresponding research finding or confidence/contradiction outcome MUST change.

This proves the final research result is derived from observed Evidence rather than a canned final answer.

---

## T24 — provider neutrality

Mechanical inspection proves canonical S11 AgentDefinition, Skill, and Quality Contract values do not require a concrete model vendor/provider implementation.

Reference implementation class names in provider/test code are not configuration dependencies.

---

## T25 — memory safety

Prove S11 Researcher policy does not permit automatic unverified durable-memory promotion:

```text
commit_verified_memory == false
promotion_policy == EXPLICIT_VERIFIED_ONLY
```

No research finding becomes durable memory merely because the Researcher emitted it.

---

## T26 — full regression

Existing S07/S09/S10 tests continue to pass unchanged alongside S11 tests.

---

# 16. Real unknown verification scenario

S11's closure verification MUST use a bounded research question whose answer is not directly encoded in:

- AgentDefinition.objective;
- test assertion text;
- deterministic model's final response;
- Research Skill artifact.

The required answer must depend on the source corpus.

Minimum corpus characteristics:

```text
>= 3 source records
>= 1 PRIMARY source
>= 2 independent source groups supporting/cross-checking one material claim
>= 1 contradictory or qualifying Evidence item
>= 1 deliberately unresolved material gap
source dates present
```

The question must require synthesis across more than one source.

The deterministic model may control predictable decision sequencing, but it MUST consume returned tool observations to construct its result.

---

# 17. Independent verifier criterion

S11's step contract states that an independent verifier must be able to trace each important claim.

The verifier need not be implemented as the future S15 Verifier Agent.

For S11 closure, an independent verification procedure may mechanically inspect the ResearchResult.

For every DECISION_CRITICAL finding it must be able to traverse:

```text
finding
→ evidence_ref
→ source_ref
→ source metadata/locator
→ inspected fixture/source content
```

If that trace breaks, S11 cannot PASS.

---

# 18. Expected Part B artifacts

Exact filenames may adapt to existing repository conventions, but Part B should produce equivalent responsibilities for:

```text
src/intelligence/
  agent-definitions/
    researcherDefinition.ts
  research/
    researchSkill.ts
    materializeResearchTask.ts
    validateResearchResult.ts
    types.ts

src/providers/capability/
  referenceResearchCapabilityProvider.ts

tests/research/
  fixtures/
  researcher.test.ts

brain-bootstrap/reports/
  S11-researcher-verification.md
```

The canonical semantic Markdown/YAML artifacts remain:

```text
brain-bootstrap/skills/RESEARCH_SKILL_S11.md
brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml
brain-bootstrap/specs/RESEARCHER_AGENT_v1.md
```

Part B MAY choose mechanically equivalent code filenames if the existing repository structure dictates them.

It MUST NOT make additional semantic decisions.

---

# 19. Non-goals

S11 does not implement:

- generic Skill Contract v1;
- Skill Registry;
- Capability Registry;
- MCP;
- production web search;
- browser automation;
- external hosted LLM requirement;
- Verifier Agent;
- multi-agent delegation;
- Workflow Runtime;
- Orchestrator;
- Knowledge Graph runtime;
- Skill Factory;
- self-improvement;
- LangGraph;
- autonomous durable-memory promotion.

---

# 20. PASS criteria

S11 may receive PASS only if all of the following are evidenced:

1. Research Skill artifact is present and matches approved Part A semantics.
2. S11 Quality Contract instance is present and valid against the canonical S04 shape.
3. Real Researcher AgentDefinition validates using S10.
4. Researcher executes through the same S10 compiler and S09 runtime.
5. `research.lookup` performs a real bounded read-only evidence lookup.
6. The real verification question requires evidence-dependent synthesis.
7. Knowledge Gap Analysis is visible.
8. Material claims expose source/date/confidence/limitations.
9. STANDARD cross-validation is demonstrated.
10. Contradictory Evidence is surfaced.
11. An unresolved material unknown is surfaced.
12. VOI stop behavior is observable.
13. StructuredAgentOutput mapping is exact.
14. Every DECISION_CRITICAL claim has Evidence or is explicitly marked INFERENCE/UNCERTAIN with limitations.
15. Independent verification can trace every important evidenced claim back to a source.
16. No concrete provider/vendor leaks into canonical AgentDefinition/Skill/Quality Contract configuration.
17. No role-specific Core runtime branch exists.
18. No unverified research finding is automatically promoted to durable memory.
19. All required S11 tests pass.
20. Existing regression suite remains PASS.
21. Typecheck and build remain PASS.
22. Verification report records limitations honestly.

---

# 21. Failure conditions

S11 MUST FAIL or remain BLOCKED if:

- a DECISION_CRITICAL claim is presented as evidenced with no Evidence;
- a source/date/locator is fabricated;
- a material contradiction is intentionally hidden;
- a material unknown is converted into a fact without Evidence;
- cross-validation is claimed using duplicated upstream Evidence;
- Researcher requires a separate Core runtime;
- Core branches on Researcher identity;
- `research.lookup` is only a canned response rather than a real lookup;
- final research output does not depend on retrieved Evidence;
- Quality Contract requirements are silently downgraded;
- a new TerminalOutcome is invented;
- a concrete vendor becomes part of canonical Agent configuration;
- Skill Registry/S14/multi-agent scope is pulled forward unnecessarily;
- research conclusions auto-promote into durable Memory;
- old tests regress.

---

# 22. Deferred scope

Successful S11 does NOT prove:

```text
general web research quality
hosted LLM quality
open-internet source discovery
production source ranking
generic Skill loading
generic capability discovery
multi-agent verification
```

Those limitations MUST remain visible in the S11 verification report.

S11 proves:

```text
Brain can execute one genuine,
bounded,
evidence-dependent,
observable research behavior
through its existing generic Agent architecture.
```

---

# 23. S11 author-side self-check

All six open ambiguities from the Claude Code handoff are explicitly resolved. S11 uses a provisional Research Skill rather than pre-implementing S12, and exactly one narrow read-only reference capability rather than pre-implementing S14. A real external LLM is deliberately not required: deterministic verification must prove that the final result depends on retrieved Evidence, while provider substitution remains intact. The exact output mapping, Quality Contract, validation invariants, T1–T26 test contract, PASS criteria, and failure conditions are concrete enough for Claude Code Part B without another semantic architecture decision.

**Author-side status: READY_FOR_S11_PART_B.**
