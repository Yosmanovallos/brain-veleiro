# Brain Deep Research Agent v1

**Status:** Canonical S13C execution/verification contract  
**Step:** S13C — deep-research  
**Layer:** Intelligence over S12 Skill loading + S10 AgentDefinition + S09 Agent Runtime + S11 Research foundation  
**Depends on:** S04, S05, S09, S10, S11, S12, S13A, S13B  
**Authoring split:** ChatGPT Part A → Claude Code Part B

---

# 1. Purpose

S13C researches only the unresolved items that S13B deliberately placed in:

```text
research_queue
```

It does not rediscover gaps.

It does not research UNKNOWABLE items.

It does not introduce a search platform.

Canonical path:

```text
S13B KnowledgeGapAnalysisResult
        ↓
research_queue
        ↓
bounded queue selection (1 default, max 3)
        ↓
deep-researcher-v1
        ↓
S12 metadata discovery
        ↓
deep-research.evidence-grounded.s13c
        ↓
lazy selected Skill load
        ↓
S13C materialization
        ↓
S10 compileAgentDefinition()
        ↓
S09 runAgent()
        ↓
existing research.lookup
        ↓
S11 ResearchResult per queue item
        ↓
DeepResearchBatchResult
        ↓
closure recommendations + explicit limits
```

---

# 2. Agent decision

Create:

```text
deep-researcher-v1
```

Do not modify:

```text
researcher-v1
knowledge-gap-analyzer-v1
requirements-discoverer-v1
```

Reason:

S11 Researcher is the foundational evidence-gathering role.

S13C adds:

```text
S13B queue semantics
DEEP Quality Contract
bounded batch
closure recommendation
```

Creating a separate AgentDefinition preserves S11's already-verified behavior while reusing the same capability and generic runtime.

No new Agent Runtime exists.

---

# 3. Canonical AgentDefinition

Part B must implement semantic values equivalent to:

```yaml
id: deep-researcher-v1
role: deep-researcher

objective: >-
  Research the highest-priority S13B NEEDS_RESEARCH items using bounded,
  authoritative evidence gathering, independent cross-validation,
  contradiction analysis, S11 ResearchResult semantics, and traceable
  closure recommendations without mutating upstream gap state.

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

tools:
  - research.lookup

skills:
  - deep-research.evidence-grounded.s13c

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
  max_turns: 18
  timeout_ms: 20000

termination:
  require_terminal_outcome: true
  require_explanation: true
  note: S13C preserves canonical S09 terminal semantics.

rubric:
  quality_contract_ref: brain-bootstrap/quality-contracts/S13C_DEEP_RESEARCH_DEEP.yaml

evals:
  - evals/s13c/deep-research-positive
  - evals/s13c/deep-research-negative
  - evals/s13c/skill-vs-baseline
```

---

# 4. Capability decision

Canonical:

```text
tools == ["research.lookup"]
capabilities == ["research.lookup"]
```

Reuse the existing S11 capability.

No new:

```text
web.search
browser.search
mcp.search
deep-research.lookup
```

or equivalent is introduced.

S14 remains responsible for general capability/MCP architecture.

---

# 5. Input contract

Canonical:

```ts
interface DeepResearchInput {
  knowledge_gap_analysis: KnowledgeGapAnalysisResult;
  max_research_items?: number;
}
```

Rules:

```text
max_research_items default = 1
minimum = 1
maximum = 3
integer only
```

No duplicate raw request field.

Use:

```text
knowledge_gap_analysis.source_request
```

when source request context is needed.

---

# 6. Queue selection

Canonical selection:

```ts
selected = knowledge_gap_analysis.research_queue.slice(0, max_research_items)
```

Before selection:

- validate research queue;
- verify each ID maps to an upstream KnowledgeItem;
- verify upstream epistemic_status is NEEDS_RESEARCH;
- verify no selected ID appears in `handoff.unknowable_item_ids`.

No new ranking formula.

S13B owns priority.

---

# 7. S11 reuse contract

S13C reuses unchanged:

```text
ResearchResult
ResearchSubquestion / gap classes
Finding semantics
Evidence metadata
source_type
authority
independence_group
observed_or_published_at
locator
relationship
confidence
limitations
Contradiction semantics
Unknown semantics
research_status
VOI stop semantics
validateResearchResult()
research.lookup
```

S13C MUST NOT redefine these.

S13C adds wrapper types around `ResearchResult`.

---

# 8. Epistemic vocabulary boundary

S11 claim-level:

```text
EVIDENCED
INFERENCE
UNCERTAIN
```

S13B item-level:

```text
KNOWN
TOLD
PROVEN
ASSUMED
NEEDS_RESEARCH
UNKNOWABLE
```

These are not merged.

A S13C item begins upstream as:

```text
NEEDS_RESEARCH
```

Its individual findings may be:

```text
EVIDENCED
INFERENCE
UNCERTAIN
```

The S13C wrapper reports research completion and closure recommendation.

It does not rewrite the upstream item epistemic status.

---

# 9. DeepResearchItemResult

Canonical:

```ts
type S13CRecommendedClosureState =
  | "RESOLVED_WITH_EVIDENCE"
  | "RESOLVED_BY_AUTHORITY"
  | "BLOCKED"
  | null;

interface DeepResearchItemResult {
  knowledge_item_id: string;

  research_question: string;
  decision_impact:
    | "DECISION_CRITICAL"
    | "DECISION_RELEVANT"
    | "CONTEXTUAL"
    | "TRIVIA";

  blocking: boolean;

  upstream_epistemic_status: "NEEDS_RESEARCH";
  upstream_closure_state:
    | "RESOLVED_WITH_EVIDENCE"
    | "RESOLVED_BY_AUTHORITY"
    | "ACCEPTED_AS_ASSUMPTION"
    | "DEFERRED_WITHOUT_DECISION_IMPACT"
    | "BLOCKED"
    | null;

  research: ResearchResult;

  recommended_closure_state: S13CRecommendedClosureState;
  closure_rationale: string;

  limitations: string[];
}
```

Normally an S13B research_queue item should have:

```text
upstream_closure_state == null
```

but the field is preserved for defensive traceability.

If a supposedly researchable item already carries a contradictory resolved closure state, deterministic validation must reject or block it rather than silently research it.

---

# 10. DeepResearchBatchResult

Canonical:

```ts
type DeepResearchBatchStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "BLOCKED";

interface DeepResearchBatchResult {
  source_request: string;

  queue_snapshot: string[];

  selected_item_ids: string[];

  items: DeepResearchItemResult[];

  deferred_item_ids: string[];

  batch_status: DeepResearchBatchStatus;

  decision_relevant_summary: string;
}
```

Rules:

```text
queue_snapshot
=
S13B research_queue IDs in canonical order

selected_item_ids
=
first N queue IDs

deferred_item_ids
=
queue_snapshot minus selected_item_ids
```

`items` order must equal `selected_item_ids` order.

---

# 11. Batch status

## COMPLETE

All selected items produced valid S11 ResearchResult objects and valid S13C closure recommendations.

This does not mean every item was resolved.

An item may be COMPLETE with:

```text
MORE_RESEARCH_NEEDED
recommended_closure_state = null
```

because the run successfully reported that more research is required.

## PARTIAL

At least one selected item produced a valid result, while another item could not complete item-level processing without invalidating already-completed results.

Use only when the generic runtime itself still finishes validly.

## BLOCKED

Use when the Agent run is canonically blocked under S09 semantics or no selected item can be validly researched due to capability/runtime failure.

Do not convert evidence uncertainty alone into batch BLOCKED.

---

# 12. Closure recommendation validator

Canonical mapping:

```text
research.state == SATISFIED
+
sufficient direct evidence
→ RESOLVED_WITH_EVIDENCE

research.state == SATISFIED
+
singular/sufficient canonical authority establishes answer
→ RESOLVED_BY_AUTHORITY

research.state == EXHAUSTED_WITH_UNCERTAINTY
+
decision_impact == DECISION_CRITICAL
+
blocking == true
+
decision cannot proceed
→ BLOCKED (allowed)

research.state == EXHAUSTED_WITH_UNCERTAINTY
otherwise
→ null

research.state == MORE_RESEARCH_NEEDED
→ null
```

Invalid:

```text
MORE_RESEARCH_NEEDED
+
RESOLVED_WITH_EVIDENCE
```

Invalid:

```text
EXHAUSTED_WITH_UNCERTAINTY
+
RESOLVED_WITH_EVIDENCE
```

unless the uncertainty is explicitly unrelated to the researched closure claim and deterministic evidence still satisfies the exact closure question; reference S13C fixtures should avoid this edge case.

Invalid:

```text
RESOLVED_BY_AUTHORITY
```

without a sufficient authority evidence reference.

---

# 13. StructuredAgentOutput mapping

Do not redefine S09.

Canonical:

```text
StructuredAgentOutput.summary
=
DeepResearchBatchResult.decision_relevant_summary
```

```text
StructuredAgentOutput.data
=
DeepResearchBatchResult
```

```text
StructuredAgentOutput.evidence_refs
=
deterministic de-duplicated first-occurrence union of all:
  items[*].research.findings[*].evidence[*].evidence_ref
  +
  items[*].research.contradictions[*].evidence_refs
```

Do not include unrelated catalog/source refs.

---

# 14. Materialization

Part B should implement a narrow S13C Intelligence-layer bridge.

It may reuse:

```text
materializeResearchTask()
```

from S11 per selected research item, or mechanically equivalent S11 semantics.

S13C materialization adds only:

```text
S13B queue metadata
DEEP Quality Contract requirements
batch limits
closure recommendation policy
```

It must not build a generic Workflow Runtime.

---

# 15. Per-item research budget

The existing capability already bounds each lookup to at most five results.

S13C additionally defines a reference verification budget:

```text
max research.lookup calls per selected item = 4
```

This is a S13C reference verification bound.

It is not a universal provider contract.

Maximum candidate lookup results per item in the reference run:

```text
4 calls × 5 results = 20
```

The Agent need not use all calls.

VOI should stop earlier when appropriate.

Part B may enforce the call budget in the deterministic verification provider/model harness rather than changing the generic CapabilityProvider contract.

---

# 16. Deep source-floor validator

In addition to `validateResearchResult()`, S13C Part B must implement a deterministic deep validator.

For each decision-critical or decision-relevant `EVIDENCED` finding:

```text
count distinct independence_group values
```

Preferred minimum:

```text
>= 2
```

unless singular-authority exception is explicitly recorded.

For current-state material claims:

```text
recency limitation must be absent
or
explicitly qualified
```

Contradiction fixture evidence must remain represented.

The validator must not require impossible cross-validation when the source corpus does not contain independent evidence; instead it must require explicit limitation and appropriately reduced confidence/closure.

---

# 17. Skill-vs-baseline metrics

Canonical metrics:

```ts
interface DeepResearchComparisonMetrics {
  material_claim_evidence_coverage_ratio: number;

  independent_cross_validation_ratio: number;

  authoritative_or_primary_coverage_ratio: number;

  contradiction_visibility_ratio: number;

  traceability_coverage_ratio: number;

  unsupported_material_claim_count: number;

  duplicate_independence_overcount: number;

  stale_current_claim_without_limitation_count: number;

  closure_overclaim_count: number;
}
```

---

# 18. Metric semantics

## material_claim_evidence_coverage_ratio

Material findings that are either:

```text
EVIDENCED with >=1 evidence
or
explicit INFERENCE/UNCERTAIN with required limitations
```

divided by all material findings.

## independent_cross_validation_ratio

Eligible material evidenced findings that satisfy:

```text
>=2 distinct independence_group values
```

or valid singular-authority exception,

divided by eligible material evidenced findings.

## authoritative_or_primary_coverage_ratio

Material evidenced findings with at least one:

```text
PRIMARY
or sufficient authoritative
```

source where such a source is reasonably available in the fixture.

## contradiction_visibility_ratio

Known fixture contradictions surfaced in:

```text
ResearchResult.contradictions
```

divided by fixture contradictions.

## traceability_coverage_ratio

Processed S13B items preserving:

```text
knowledge_item_id
research_question
decision_impact
blocking
```

divided by processed items.

## unsupported_material_claim_count

Material claims presented as established without evidence or explicit inference/uncertainty marker.

## duplicate_independence_overcount

Number of times multiple evidence refs sharing one `independence_group` are counted as separate independent support.

## stale_current_claim_without_limitation_count

Current-state claims supported only by stale evidence without explicit limitation.

## closure_overclaim_count

Recommended closure states not justified by research status/evidence/authority mapping.

---

# 19. Improvement-vs-baseline requirements

Both runs must use:

```text
same DeepResearchInput
same deep-researcher-v1 base AgentDefinition
same ModelProvider class/configuration
same limits
same research.lookup capability/provider
same S09/S10 runtime
```

Difference:

```text
baseline:
  no S13C Skill selected/materialized

skill run:
  deep-research.evidence-grounded.s13c discovered
  lazily loaded
  materialized
```

Required strict improvements:

```text
skill.material_claim_evidence_coverage_ratio
>
baseline.material_claim_evidence_coverage_ratio
```

```text
skill.independent_cross_validation_ratio
>
baseline.independent_cross_validation_ratio
```

```text
skill.contradiction_visibility_ratio
>
baseline.contradiction_visibility_ratio
```

```text
skill.closure_overclaim_count
<
baseline.closure_overclaim_count
```

Canonical negative fixture must also satisfy:

```text
skill.duplicate_independence_overcount == 0
skill.unsupported_material_claim_count == 0
skill.contradiction_visibility_ratio == 1
```

No manually fabricated bad result outside the real runtime.

---

# 20. Evidence dependence

Part B must prove that changing a material source fixture changes at least one corresponding:

```text
finding
confidence
contradiction
research_status
recommended_closure_state
decision_relevant_summary
```

A canned deep-research answer fails.

---

# 21. Positive fixture characteristics

Minimum fixture:

```text
>= 1 S13B NEEDS_RESEARCH item
DECISION_CRITICAL
blocking true

>= 2 independent source groups supporting/qualifying the material answer
>= 1 PRIMARY or authoritative source
>= 1 qualifier or contradiction
dates present
locators present
```

The item should be resolvable to:

```text
SATISFIED
```

with justified:

```text
RESOLVED_WITH_EVIDENCE
or
RESOLVED_BY_AUTHORITY
```

The kiosk/plush scanner example from the Skill is canonical.

---

# 22. Negative fixture characteristics

Minimum:

```text
2 sources sharing one independence_group
+
1 newer authoritative contradictory source
+
current-state decision-critical question
```

The Skill run must:

```text
not count the duplicate pair as independent
surface the contradiction
prefer/qualify the newer authority appropriately
avoid unsupported HIGH confidence
avoid false closure
```

---

# 23. Required Part B responsibilities

Expected mechanically equivalent artifacts:

```text
src/intelligence/skills/definitions/
  deepResearchS13C.ts

src/intelligence/agent-definitions/
  deepResearcherDefinition.ts

src/intelligence/deep-research/
  types.ts
  selectDeepResearchItems.ts
  materializeDeepResearchTask.ts
  validateDeepResearchResult.ts
  compareDeepResearchRuns.ts

tests/deep-research/
  fixtures.ts
  deepResearch.test.ts

brain-bootstrap/reports/
  S13C-deep-research-verification.md
```

Part B MAY reuse/import existing:

```text
src/intelligence/research/types.ts
src/intelligence/research/validateResearchResult.ts
src/intelligence/research/materializeResearchTask.ts
src/providers/capability/referenceResearchCapabilityProvider.ts
```

Do not copy them into parallel S13C implementations unnecessarily.

---

# 24. Required deterministic tests — T1–T28

## T1 — canonical S13C Skill exists

Verify:

```text
brain-bootstrap/skills/DEEP_RESEARCH_SKILL_S13C.md
```

contains approved identity and protected S11 reuse semantics.

---

## T2 — typed S13C Skill validates

The derived Skill passes S12 `SkillDefinition` validation.

---

## T3 — S11 semantic dependency preserved

Mechanically prove S13C typed/runtime Skill preserves or composes:

```text
evidence grounding
confidence/limitations
contradictions
unknowns
VOI
source metadata
independence_group
```

from S11.

---

## T4 — dedicated DEEP Quality Contract integrity

Parse:

```text
brain-bootstrap/quality-contracts/S13C_DEEP_RESEARCH_DEEP.yaml
```

and prove:

```text
depth == DEEP
evidence.cross_validation == true
research.contradictory_evidence_required == true
research.value_of_information_stop_rule == true
verification.independent_review_required == true
```

---

## T5 — deep-researcher AgentDefinition validates

The real new AgentDefinition passes S10 validation.

---

## T6 — capability set exact

Prove:

```text
tools == ["research.lookup"]
capabilities == ["research.lookup"]
```

and no other capability is granted.

---

## T7 — exact S13C Skill allowlist

Prove:

```text
agent.skills == ["deep-research.evidence-grounded.s13c"]
```

No silent global Skill fallback.

---

## T8 — S12 discovery selects S13C

For a deep-research task:

- descriptor selection returns S13C;
- no full definitions load during discovery;
- Agent allowlist is honored.

---

## T9 — lazy selected load only

After selection:

```text
S13C loader called exactly once
unrelated Skill loaders called zero times
```

---

## T10 — queue selection bounded

Prove:

```text
default selects 1
max 3
>3 rejected
selection preserves S13B order
```

---

## T11 — only NEEDS_RESEARCH selectable

Attempting to select an upstream:

```text
KNOWN
TOLD
PROVEN
ASSUMED
UNKNOWABLE
```

item must fail.

---

## T12 — UNKNOWABLE exclusion

An ID appearing in S13B `unknowable_item_ids` must never be researched.

---

## T13 — S13B traceability preserved

Every result preserves:

```text
knowledge_item_id
research_question
decision_impact
blocking
```

exactly.

---

## T14 — S11 ResearchResult validator reused

Each item-level research object passes the existing canonical S11 validator.

Test must prove Part B did not create a weakened parallel validator in place of S11.

---

## T15 — S11 and S13B epistemic vocabularies remain separate

Mechanical/type test proves:

```text
research.findings[*].epistemic_status
=
EVIDENCED | INFERENCE | UNCERTAIN
```

while upstream item remains:

```text
NEEDS_RESEARCH
```

No merged enum.

---

## T16 — independent cross-validation

Positive fixture proves material claim can use:

```text
>=2 distinct independence_group
```

and validator counts groups, not evidence-ref count.

---

## T17 — duplicate group does not cross-validate

Negative fixture:

```text
COPY-A
COPY-B
same independence_group
```

must count as one independent source family.

---

## T18 — authoritative/primary preference

When fixture contains an available current primary/authoritative source, the deep result must include it for the material claim or explicitly explain why it is inapplicable.

---

## T19 — contradiction visible

The canonical negative contradiction must appear in:

```text
ResearchResult.contradictions
```

and must not be erased by synthesis.

---

## T20 — recency qualification

A current-state claim supported only by stale fixture evidence without explicit limitation must fail deep validation.

Stable-fact fixture may use older evidence when validity is explicitly justified.

---

## T21 — VOI/research-status mapping

Prove valid behavior for:

```text
SATISFIED
EXHAUSTED_WITH_UNCERTAINTY
MORE_RESEARCH_NEEDED
```

using unchanged S11 semantics.

---

## T22 — closure recommendation mapping

Reject at least:

```text
MORE_RESEARCH_NEEDED + RESOLVED_WITH_EVIDENCE

EXHAUSTED_WITH_UNCERTAINTY + unjustified RESOLVED_WITH_EVIDENCE

RESOLVED_BY_AUTHORITY without sufficient authority
```

and accept justified positive fixture closure.

---

## T23 — upstream S13B immutability

Run S13C and prove the input:

```text
KnowledgeGapAnalysisResult
```

is unchanged byte/deep-equality equivalent after execution.

---

## T24 — same S10/S09 runtime path

Both baseline and Skill-assisted deep research execute through:

```text
compileAgentDefinition()
runAgent()
```

No DeepResearch runtime exists in Core.

---

## T25 — no role/Skill branching in Core

Mechanical source scan finds no branch equivalent to:

```text
role === "deep-researcher"
skill.id === "deep-research.evidence-grounded.s13c"
```

inside generic Core.

---

## T26 — evidence-dependent output

Mutate a material source fixture.

Corresponding result must change in at least one approved evidence-dependent field.

A canned final answer fails.

---

## T27 — Skill improves over baseline

Compute all canonical metrics through real Agent runs.

Required strict improvements from Section 19 must pass.

Canonical negative fixture must have:

```text
duplicate_independence_overcount == 0
unsupported_material_claim_count == 0
contradiction_visibility_ratio == 1
```

for the Skill run.

---

## T28 — full regression

Run full suite.

All S07–S13B tests remain PASS.

Typecheck, clean build, post-build tests remain PASS.

---

# 25. Independent review

Before PASS, independent review must inspect:

```text
positive fixture
negative duplicate-source/contradiction fixture
queue selection
S11 validator reuse
DEEP source-floor behavior
closure recommendation
Skill-vs-baseline metrics
upstream immutability
no-Core-branch evidence
```

Reviewer must be able to explain:

1. why each researched item was eligible;
2. what evidence actually supports the answer;
3. which sources are independent;
4. which evidence is authoritative/primary;
5. what contradiction exists;
6. what limitations remain;
7. why research stopped;
8. why closure was or was not recommended;
9. why S13B state itself was not mutated.

If review finds a semantic defect in this Part A contract:

```text
S13C_FEEDBACK_REQUIRED
```

and STOP.

---

# 26. PASS criteria

S13C may PASS only if:

1. canonical S13C Skill exists;
2. S13C Skill conforms to S12 Skill Contract v1;
3. S13C preserves S11 research semantics without modifying S11;
4. dedicated DEEP Quality Contract exists;
5. `deep-researcher-v1` exists and validates;
6. only `research.lookup` is granted;
7. S12 discovery/lazy loading is exercised;
8. only S13B NEEDS_RESEARCH items are eligible;
9. UNKNOWABLE items are excluded;
10. default batch is one and maximum three;
11. S13B queue order is preserved;
12. every processed item preserves S13B traceability;
13. every item contains a valid S11 ResearchResult;
14. S11 claim epistemic status remains distinct from S13B item status;
15. material claims satisfy evidence-or-explicit-uncertainty rules;
16. independent cross-validation counts distinct independence groups;
17. primary/authoritative source preference is enforced when available;
18. current-state source recency is qualified;
19. contradictory evidence remains visible;
20. S11 VOI research statuses remain unchanged;
21. closure recommendation follows the approved mapping;
22. S13C does not mutate S13B closure state;
23. upstream KnowledgeGapAnalysisResult remains unchanged;
24. output depends on evidence/input;
25. Skill-assisted run improves canonical metrics versus baseline;
26. baseline and Skill run use the same generic runtime/provider setup;
27. no new capability/MCP/web/vendor infrastructure is introduced;
28. no automatic durable-memory promotion occurs;
29. no role/Skill-specific Core branching exists;
30. S14 and later steps remain unstarted;
31. T1–T28 PASS;
32. full regression PASS;
33. typecheck PASS;
34. clean build PASS;
35. post-build tests PASS;
36. independent review finds no unresolved semantic defect;
37. verification report records all material limitations and bugs found/fixed;
38. S13C closure does not automatically start the next bootstrap step.

---

# 27. Failure conditions

S13C must FAIL or remain BLOCKED if:

- it researches an UNKNOWABLE item;
- it researches an item not present in S13B research_queue;
- it re-ranks S13B queue without explicit canonical authority;
- it processes more than three items in one run;
- it introduces a new search/MCP/vendor capability;
- it modifies S11 canonical semantics;
- it modifies S13B canonical semantics/state;
- it merges S11 claim epistemic status with S13B item epistemic status;
- duplicate independence-group sources are counted as independent support;
- available contradictory evidence is hidden;
- stale evidence is presented as current without qualification;
- a material claim lacks evidence or explicit inference/uncertainty marker;
- MORE_RESEARCH_NEEDED receives a false resolved closure;
- EXHAUSTED_WITH_UNCERTAINTY is silently converted into evidence certainty;
- closure is recommended without sufficient evidence/authority;
- a canned result ignores source fixture changes;
- Skill-vs-baseline comparison is fabricated outside the real runtime;
- a new Core DeepResearch runtime or role branch is created;
- unverified research is automatically promoted to durable memory;
- regression/typecheck/build fails.

---

# 28. Part B verification report

Part B must create:

```text
brain-bootstrap/reports/S13C-deep-research-verification.md
```

Minimum contents:

```text
implementation inventory
T1–T28 result table
pre-build test count
post-build test count
typecheck
build

positive research fixture
negative duplicate-source/contradiction fixture

selected queue items
batch bound/order evidence
S13B eligibility evidence
UNKNOWABLE exclusion

S11 ResearchResult validator reuse evidence
claim-level epistemic evidence

source quality
independence groups
primary/authority evidence
recency evidence
contradiction evidence

VOI/research status
closure recommendation rationale

Skill-vs-baseline metrics
same-runtime proof

evidence-dependence mutation proof
upstream S13B immutability proof

S12 discovery/lazy-load evidence
zero-new-capability evidence
no-Core-branch evidence

independent review findings
bugs found/fixed
limitations
deferred scope
```

---

# 29. Deferred scope

S13C does not implement:

```text
general Capability Registry
MCP
web search provider architecture
hosted model integration
Verifier Agent
multi-agent research
Workflow Runtime
Orchestrator
automatic application of closure recommendations
automatic durable-memory promotion
Knowledge Graph runtime
Skill Factory
self-improvement
```

---

# 30. Expected closure flow

```text
ChatGPT Part A
↓
Claude Code integrates 3 semantic artifacts verbatim
↓
S13C Part B
↓
typed S13C Skill
deep-researcher-v1
bounded queue selection
S11 reuse
DEEP validation
fixtures
baseline comparison
T1–T28
↓
independent review
↓
typecheck/tests/build/post-build tests
↓
verification report
↓
STATE.yaml
↓
continuity handoff
↓
commit/push
↓
STEP_STATUS
↓
STOP
```

---

# 31. Author-side self-check

All fourteen S13C ambiguities are resolved.

The architecture deliberately reuses the proven S11 research foundation without modifying it, while giving S13C its own Skill and AgentDefinition because S13C adds a distinct contract: consume only S13B's prioritized NEEDS_RESEARCH queue, apply DEEP evidence-quality rules, preserve queue traceability, and recommend closure without mutating upstream state.

S13C introduces no new capability infrastructure, no MCP/web architecture, no provider-specific model dependency, no multi-agent/workflow runtime, and no automatic durable-memory promotion.

**Author-side status: READY_FOR_S13C_PART_B.**
