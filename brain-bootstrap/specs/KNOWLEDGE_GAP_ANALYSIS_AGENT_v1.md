# Brain Knowledge Gap Analysis Agent v1

**Status:** Canonical S13B execution/verification contract  
**Step:** S13B — knowledge-gap-analysis  
**Layer:** Intelligence over S12 Skill loading + S10 AgentDefinition + S09 Agent Runtime  
**Depends on:** S04, S05, S09, S10, S12, S13A  
**Authoring split:** ChatGPT Part A → Claude Code Part B

---

# 1. Purpose

S13B turns the structured result of requirements discovery into an explicit epistemic map:

```text
what is established
what was merely stated
what is directly proven
what is assumed
what requires research
what cannot currently be known
```

Canonical path:

```text
S13A RequirementsDiscoveryResult
        +
bounded context facts
        ↓
knowledge-gap-analyzer-v1
        ↓
S12 discover Skill metadata
        ↓
knowledge-gap.analysis.s13b
        ↓
lazy load selected Skill
        ↓
S13B materialization bridge
        ↓
S10 compileAgentDefinition()
        ↓
S09 runAgent()
        ↓
KnowledgeGapAnalysisResult
        ↓
S13C handoff
```

No new Agent Runtime is introduced.

---

# 2. Executing Agent decision

Create a new minimal AgentDefinition:

```text
knowledge-gap-analyzer-v1
```

Do not reuse:

```text
requirements-discoverer-v1
researcher-v1
```

Reason:

- requirements-discoverer owns S13A discovery;
- researcher owns evidence gathering;
- S13B owns epistemic classification;
- each remains configuration over the same generic runtime.

This preserves narrow permissions and clear Intelligence responsibilities.

---

# 3. Capability decision

Canonical:

```text
tools: []
capabilities: []
```

S13B does not call:

```text
research.lookup
```

or any other capability.

`PROVEN` means evidence is **already present** in bounded input/context.

If evidence must be gathered, classify the item:

```text
NEEDS_RESEARCH
```

and hand it to S13C.

This prevents S13B from pulling S13C/S14 forward.

---

# 4. Input contract

Canonical input:

```ts
interface KnowledgeGapAnalysisInput {
  requirements_discovery: RequirementsDiscoveryResult;
  context_facts: KnowledgeContextFact[];
}
```

`context_facts` MAY be empty.

Do not pass a second raw-request field.

The raw request is already contained in:

```text
requirements_discovery.request
```

---

# 5. KnowledgeContextFact

Canonical shape:

```ts
type KnowledgeFactBasis =
  | "CANONICAL_AUTHORITY"
  | "DIRECT_EVIDENCE"
  | "SOURCE_ASSERTION";

interface KnowledgeContextFact {
  id: string;
  statement: string;

  source_ref: string;
  authority: string;

  basis: KnowledgeFactBasis;

  observed_or_effective_at?: string;

  related_goal_ids: string[];
}
```

Semantics:

## CANONICAL_AUTHORITY

A current source has authority sufficient for this type of statement.

Possible classification:

```text
KNOWN
```

## DIRECT_EVIDENCE

Inspectably verifies a statement.

Possible classification:

```text
PROVEN
```

## SOURCE_ASSERTION

An assertion from a source/stakeholder not independently established.

Possible classification:

```text
TOLD
```

Context facts are supplied by bounded Context.

S13B does not retrieve them externally.

---

# 6. Canonical AgentDefinition

Part B must implement semantic values equivalent to:

```yaml
id: knowledge-gap-analyzer-v1
role: knowledge-gap-analyzer

objective: >-
  Classify the current requirements-discovery knowledge into known, told,
  proven, assumed, needs-research, and unknowable while preserving canonical
  decision impact, justified closure state, traceability, and a bounded handoff
  to deep research.

model_policy:
  routing_class: BALANCED
  require_structured_decisions: true
  allow_provider_substitution: true

context_policy:
  retrieval_mode: BOUNDED
  max_context_tokens: 7000
  max_items: 35
  allowed_sources:
    - CURRENT_TASK
    - EXPLICIT_SPEC
    - VERIFIED_HANDOFF
    - ADR
  require_source_refs: true

tools: []

skills:
  - knowledge-gap.analysis.s13b

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
  max_turns: 7
  timeout_ms: 12000

termination:
  require_terminal_outcome: true
  require_explanation: true
  note: S13B uses canonical S09 terminal semantics.

rubric:
  quality_contract_ref: brain-bootstrap/quality-contracts/S13B_KNOWLEDGE_GAP_ANALYSIS_STANDARD.yaml

evals:
  - evals/s13b/knowledge-gap-positive
  - evals/s13b/knowledge-gap-negative
  - evals/s13b/skill-vs-baseline
```

---

# 7. State schema

Canonical semantic state:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "normalized_item_count": {
      "type": "number"
    },
    "classified_item_count": {
      "type": "number"
    },
    "research_queue_count": {
      "type": "number"
    },
    "selected_skill_id": {
      "type": "string"
    }
  }
}
```

No Core code may depend on these fields.

---

# 8. EpistemicStatus

Canonical:

```ts
type EpistemicStatus =
  | "KNOWN"
  | "TOLD"
  | "PROVEN"
  | "ASSUMED"
  | "NEEDS_RESEARCH"
  | "UNKNOWABLE";
```

Exactly one status per knowledge item.

---

# 9. DecisionImpact

Reuse S04 exactly:

```ts
type DecisionImpact =
  | "DECISION_CRITICAL"
  | "DECISION_RELEVANT"
  | "CONTEXTUAL"
  | "TRIVIA";
```

Do not create a parallel impact vocabulary.

---

# 10. GapClosureState

Reuse S04 exactly, but nullable in S13B result:

```ts
type GapClosureState =
  | "RESOLVED_WITH_EVIDENCE"
  | "RESOLVED_BY_AUTHORITY"
  | "ACCEPTED_AS_ASSUMPTION"
  | "DEFERRED_WITHOUT_DECISION_IMPACT"
  | "BLOCKED";

type CurrentGapClosureState = GapClosureState | null;
```

`null` is not a new closure state.

It means no canonical closure state is currently justified.

---

# 11. KnowledgeItem

Canonical semantic shape:

```ts
interface KnowledgeItem {
  id: string;

  source_item_ref: string;
  source_kind:
    | "GOAL"
    | "USER"
    | "UNKNOWN"
    | "ASSUMPTION"
    | "CONSTRAINT"
    | "ACCEPTANCE_CRITERION"
    | "CONTEXT_FACT";

  statement: string;

  epistemic_status: EpistemicStatus;
  decision_impact: DecisionImpact;
  closure_state: CurrentGapClosureState;

  authority_refs: string[];
  evidence_refs: string[];
  assertion_refs: string[];

  assumption_rationale?: string;

  authority_sufficient: boolean;
  accepted_for_current_decision: boolean;

  blocking: boolean;

  related_goal_ids: string[];

  research_question?: string;

  rationale: string;
  limitations: string[];
}
```

---

# 12. Bucket index

Canonical:

```ts
interface KnowledgeBuckets {
  known: string[];
  told: string[];
  proven: string[];
  assumed: string[];
  needs_research: string[];
  unknowable: string[];
}
```

Every knowledge item ID MUST appear in exactly one bucket.

Bucket contents derive from:

```text
epistemic_status
```

They do not create a second classification.

---

# 13. Research queue

Canonical:

```ts
interface ResearchQueueItem {
  knowledge_item_id: string;
  research_question: string;
  decision_impact: DecisionImpact;
  blocking: boolean;
  why_research_matters: string;
}
```

Only:

```text
NEEDS_RESEARCH
```

items may appear.

Sort priority:

```text
DECISION_CRITICAL
>
DECISION_RELEVANT
>
CONTEXTUAL
>
TRIVIA
```

Within same impact:

```text
blocking true
>
blocking false
```

Then deterministic:

```text
knowledge_item_id ascending
```

---

# 14. S13C handoff

Canonical:

```ts
interface DeepResearchHandoff {
  ready_for_deep_research: boolean;

  research_item_ids: string[];

  decision_blockers: string[];

  unknowable_item_ids: string[];

  notes: string;
}
```

Rules:

```text
research_item_ids
=
research_queue knowledge_item_ids

decision_blockers
=
items where blocking == true
AND closure_state is null or BLOCKED
AND epistemic_status is NEEDS_RESEARCH or UNKNOWABLE

unknowable_item_ids
=
all UNKNOWABLE item IDs
```

`ready_for_deep_research` is true when:

```text
research_item_ids.length > 0
```

and the S13B result is valid.

It does not mean research has started.

---

# 15. KnowledgeGapAnalysisResult

Canonical:

```ts
interface KnowledgeGapAnalysisResult {
  source_request: string;

  items: KnowledgeItem[];

  buckets: KnowledgeBuckets;

  research_queue: ResearchQueueItem[];

  handoff: DeepResearchHandoff;

  decision_readiness_summary: string;
}
```

---

# 16. StructuredAgentOutput mapping

Do not redefine S09.

Canonical:

```text
StructuredAgentOutput.summary
=
KnowledgeGapAnalysisResult.decision_readiness_summary
```

```text
StructuredAgentOutput.data
=
KnowledgeGapAnalysisResult
```

```text
StructuredAgentOutput.evidence_refs
=
deterministic de-duplicated first-occurrence union of:
  items[*].evidence_refs
  +
  items[*].authority_refs
```

`assertion_refs` are not automatically evidence.

---

# 17. Output schema

Part B must encode an equivalent `JsonSchemaLike` where supported.

Minimum top-level semantics:

```json
{
  "type": "object",
  "required": [
    "source_request",
    "items",
    "buckets",
    "research_queue",
    "handoff",
    "decision_readiness_summary"
  ],
  "properties": {
    "source_request": { "type": "string" },
    "items": { "type": "array" },
    "buckets": { "type": "object" },
    "research_queue": { "type": "array" },
    "handoff": { "type": "object" },
    "decision_readiness_summary": { "type": "string" }
  },
  "additionalProperties": false
}
```

If S09 `JsonSchemaLike` is too shallow for all nested invariants, enforce them in a deterministic S13B validator outside Core.

Do not expand the generic schema system merely for S13B.

---

# 18. Normalization from S13A

Part B must deterministically normalize all relevant S13A categories.

Minimum coverage:

```text
goals
users
unknowns
assumptions
constraints
acceptance_criteria
context_facts
```

Each normalized item retains:

```text
source_item_ref
related_goal_ids
blocking where applicable
origin/authority/evidence provenance
```

S13B does not need to create standalone knowledge items from:

```text
handoff.notes
```

unless implementation requires it for summary only.

---

# 19. Initial classification hints from S13A

These are hints, not unconditional final classifications.

## EXPLICIT goal/user/constraint

Initial tendency:

```text
TOLD
```

unless current source is sufficient authority for the statement's type, in which case it may be:

```text
KNOWN
```

Example:

A stakeholder is authoritative for:

```text
"I want the kiosk to support touchscreen input."
```

but not necessarily for:

```text
"We currently have exactly 10,000 active users."
```

---

## DERIVED goal/user/constraint

Initial tendency:

```text
ASSUMED
```

unless bounded authority/evidence establishes it.

---

## S13A assumption

Initial:

```text
ASSUMED
```

unless bounded evidence/authority upgrades it.

---

## S13A unknown

Initial candidates:

```text
NEEDS_RESEARCH
UNKNOWABLE
```

according to whether evidence/research can reasonably establish the answer now.

---

## Acceptance criterion

Its desired behavior may be:

```text
KNOWN
```

when current client/spec authority establishes it as an acceptance requirement.

It is not:

```text
PROVEN
```

merely because it is testable.

A future test result could prove satisfaction, but S13B is analyzing requirement knowledge, not implementation verification.

---

# 20. Closure-state validation

Deterministic invalid combinations include:

```text
PROVEN
+
evidence_refs.length == 0
```

```text
KNOWN
+
authority_sufficient == false
```

```text
RESOLVED_WITH_EVIDENCE
+
evidence_refs.length == 0
```

```text
RESOLVED_BY_AUTHORITY
+
authority_sufficient == false
```

```text
ACCEPTED_AS_ASSUMPTION
+
epistemic_status != ASSUMED
```

```text
NEEDS_RESEARCH
+
closure_state == RESOLVED_WITH_EVIDENCE
```

unless the item was reclassified before final output.

Final output must be internally consistent.

---

# 21. Skill-vs-baseline metrics

Part B must compute deterministic metrics:

```ts
interface KnowledgeGapComparisonMetrics {
  classification_coverage_ratio: number;
  decision_impact_coverage_ratio: number;

  unsupported_proven_count: number;
  told_as_proven_count: number;
  hidden_assumption_count: number;

  research_target_capture_ratio: number;

  unknowable_misclassified_as_research_count: number;

  closure_overclaim_count: number;
}
```

Semantics:

## classification_coverage_ratio

```text
classified items / classifiable normalized items
```

## decision_impact_coverage_ratio

```text
items with valid impact / all normalized items
```

## unsupported_proven_count

Items marked PROVEN without evidence.

## told_as_proven_count

Expected-TOLD fixture items incorrectly marked PROVEN.

## hidden_assumption_count

Fixture-known assumptions/derived unsupported items emitted as KNOWN/PROVEN/TOLD without assumption visibility.

## research_target_capture_ratio

Expected researchable items correctly classified NEEDS_RESEARCH.

## unknowable_misclassified_as_research_count

Expected UNKNOWABLE fixture items incorrectly sent to research.

## closure_overclaim_count

Items assigned a closure state not justified by evidence/authority/accepted assumption/defer/block semantics.

---

# 22. Improvement PASS thresholds

Use:

```text
same KnowledgeGapAnalysisInput
same base AgentDefinition
same ModelProvider class/config
same limits
same S09/S10 runtime
```

Difference:

```text
baseline:
  S13B Skill not selected/materialized

skill run:
  knowledge-gap.analysis.s13b discovered
  lazily loaded
  materialized
```

Required:

```text
skill.classification_coverage_ratio
>
baseline.classification_coverage_ratio
```

```text
skill.research_target_capture_ratio
>
baseline.research_target_capture_ratio
```

```text
skill.unsupported_proven_count
<
baseline.unsupported_proven_count
```

```text
skill.closure_overclaim_count
<
baseline.closure_overclaim_count
```

For the canonical negative fixture:

```text
skill.told_as_proven_count == 0
skill.unknowable_misclassified_as_research_count == 0
```

At least one strict structural improvement and one strict epistemic-safety improvement are mandatory.

Do not manually fabricate a bad baseline result outside the runtime.

---

# 23. Materialization bridge

S13B uses a narrow Intelligence-layer bridge analogous to S13A.

Conceptual responsibility:

```text
KnowledgeGapAnalysisInput
+
selected S13B Skill
+
S13B Quality Contract requirements
↓
task-specific materialization
↓
same generic Agent runtime
```

It may include:

```text
requirements_discovery
bounded context_facts
selected Skill description
selected Skill rules
selected Skill procedure
selected Skill verification criteria
Quality Contract reference/relevant constraints
```

It MUST NOT include:

```text
entire Skill catalog
unrelated Skills
full wiki
research corpus
provider/vendor details
```

This is not a generic Skill execution engine.

---

# 24. Real-agent verification

"Real agent" means:

```text
real AgentDefinition
+
real S12 discovery/load
+
real S10 compileAgentDefinition()
+
real S09 runAgent()
```

A deterministic conforming ModelProvider is permitted.

No external LLM is required.

The verification model must be input-dependent.

Changing the S13A result/context facts must be capable of changing classifications/research queue.

A single canned final result fails.

---

# 25. Part B scope

Part B must implement classification infrastructure only.

Expected responsibilities equivalent to:

```text
src/intelligence/skills/definitions/
  knowledgeGapAnalysisS13B.ts

src/intelligence/agent-definitions/
  knowledgeGapAnalyzerDefinition.ts

src/intelligence/knowledge-gap-analysis/
  types.ts
  materializeKnowledgeGapAnalysisTask.ts
  validateKnowledgeGapAnalysisResult.ts
  compareKnowledgeGapAnalysisRuns.ts

tests/knowledge-gap-analysis/
  fixtures.ts
  knowledgeGapAnalysis.test.ts

brain-bootstrap/reports/
  S13B-knowledge-gap-analysis-verification.md
```

Exact filenames may adapt mechanically to repo conventions.

Part B MUST NOT implement:

```text
deep research
research.lookup orchestration
S13C
new capability
```

---

# 26. Required deterministic tests

Part B must implement tests equivalent to T1–T24.

---

## T1 — canonical Skill source exists

Verify:

```text
brain-bootstrap/skills/KNOWLEDGE_GAP_ANALYSIS_SKILL_S13B.md
```

contains the approved six-way taxonomy and orthogonal S04 semantics.

---

## T2 — typed SkillDefinition validates

The derived S13B TypeScript Skill passes S12 Skill validation.

---

## T3 — typed Skill preserves canonical semantics

Mechanically prove presence of:

```text
KNOWN
TOLD
PROVEN
ASSUMED
NEEDS_RESEARCH
UNKNOWABLE

decision-impact separation
nullable closure-state policy
no capability
S13C handoff
```

---

## T4 — Quality Contract integrity

Parse:

```text
brain-bootstrap/quality-contracts/S13B_KNOWLEDGE_GAP_ANALYSIS_STANDARD.yaml
```

and prove:

```text
depth == STANDARD
research.knowledge_gaps_required == true
uncertainty.explicit == true
implementation.deterministic_checks_required == true
verification.independent_review_required == true
```

---

## T5 — knowledge-gap-analyzer AgentDefinition validates

The real S13B AgentDefinition passes S10 validation.

---

## T6 — no capability/tool dependency

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
agent.skills == ["knowledge-gap.analysis.s13b"]
```

---

## T8 — S12 discovery selects S13B

For a KGA task:

- S13B descriptor ranks/selects correctly;
- Agent allowlist is honored;
- no full Skill definition loads during discovery.

---

## T9 — lazy selected load only

After selection:

```text
S13B loader called exactly once
unrelated Skill loaders called zero times
```

---

## T10 — same S10/S09 runtime path

Execute through:

```text
compileAgentDefinition()
runAgent()
```

No separate KGA runtime.

---

## T11 — no role/Skill conditional in Core

Mechanical scan finds no Core branch equivalent to:

```text
role === "knowledge-gap-analyzer"
skill.id === "knowledge-gap.analysis.s13b"
```

---

## T12 — full S13A input consumed

Positive fixture proves normalization covers:

```text
goals
users
unknowns
assumptions
constraints
acceptance_criteria
context_facts
```

without requiring raw-request duplication.

---

## T13 — epistemic status partition

Every item has exactly one valid status.

Bucket IDs partition all item IDs exactly once.

---

## T14 — impact axis independent

Every item has valid S04 impact.

Fixture proves two items may share epistemic status but have different decision impact.

---

## T15 — PROVEN requires evidence

Invalid:

```text
PROVEN
evidence_refs = []
```

must fail.

---

## T16 — KNOWN requires sufficient authority

Invalid:

```text
KNOWN
authority_sufficient = false
```

must fail.

---

## T17 — negative fixture keeps TOLD distinct

The statement:

```text
"the platform already has 10,000 active users"
```

with stakeholder assertion only must be:

```text
TOLD
```

not PROVEN.

---

## T18 — researchable gap becomes NEEDS_RESEARCH

The fixture's current active-user verification or equivalent researchable question must become:

```text
NEEDS_RESEARCH
```

and appear in research_queue.

---

## T19 — future contingent choice becomes UNKNOWABLE

The undecided future payment-provider choice must be:

```text
UNKNOWABLE
```

and MUST NOT appear in research_queue.

---

## T20 — closure-state overclaim rejected

At least these invalid cases must fail:

```text
RESOLVED_WITH_EVIDENCE without evidence
RESOLVED_BY_AUTHORITY without sufficient authority
NEEDS_RESEARCH marked RESOLVED_WITH_EVIDENCE
```

---

## T21 — research queue ordering

Given multiple NEEDS_RESEARCH items:

```text
DECISION_CRITICAL
before
DECISION_RELEVANT
before
CONTEXTUAL
before
TRIVIA
```

then blocking before non-blocking, then deterministic ID.

---

## T22 — raw/input dependence

Change a material S13A item or context fact.

The corresponding epistemic classification, impact, closure, or research queue must change.

A canned final result fails.

---

## T23 — Skill improves over baseline

Both baseline and Skill-assisted runs must use the same generic architecture.

Compute canonical metrics and prove the required strict improvements from Section 22.

Negative fixture must prove:

```text
told_as_proven_count == 0
unknowable_misclassified_as_research_count == 0
```

for Skill run.

---

## T24 — full regression

Run the entire suite.

S07–S13A tests remain PASS.

Typecheck, build, post-build test count remain PASS.

---

# 27. Independent review

Before S13B PASS, independent review must inspect:

```text
positive fixture
negative fixture
Skill-vs-baseline metrics
research queue
closure-state validation
no-Core-branch evidence
```

Reviewer must be able to answer:

1. which items are established;
2. which are only asserted;
3. which are directly proven;
4. which remain assumptions;
5. which must be researched;
6. which cannot currently be known;
7. whether any item was falsely marked resolved;
8. why the S13C handoff is safe.

A prose-only claim is insufficient without deterministic evidence.

---

# 28. Positive fixture minimum characteristics

The canonical positive fixture must include at least:

```text
>= 1 KNOWN item
>= 1 TOLD item or explicit stakeholder assertion
>= 1 PROVEN item with direct evidence
>= 1 ASSUMED item
>= 2 NEEDS_RESEARCH items
>= 1 UNKNOWABLE item
>= 1 DECISION_CRITICAL research item
>= 1 justified closure state
>= 1 open null closure state
```

The exact example may use the kiosk/plush case authored in Part A.

---

# 29. Negative fixture minimum characteristics

Must include:

```text
unverified stakeholder factual assertion
+
researchable current fact
+
future contingent stakeholder choice
```

Expected:

```text
assertion → TOLD
current researchable fact → NEEDS_RESEARCH
future contingent choice → UNKNOWABLE
```

No PROVEN without evidence.

---

# 30. PASS criteria

S13B may PASS only if:

1. canonical S13B Skill exists;
2. Skill conforms to S12 Skill Contract v1;
3. dedicated STANDARD Quality Contract exists;
4. knowledge-gap-analyzer-v1 exists and validates;
5. no capabilities/tools are required;
6. S12 discovery/lazy-loading path is exercised;
7. same S10 compiler + S09 runtime are used;
8. full S13A result is accepted as input;
9. bounded context facts may add authority/evidence without external retrieval;
10. every item has exactly one epistemic status;
11. every item has exactly one S04 decision impact;
12. closure state is independently represented and nullable;
13. PROVEN always has evidence;
14. KNOWN always has sufficient authority;
15. TOLD is not silently upgraded to PROVEN;
16. assumptions remain visible;
17. researchable unresolved items become NEEDS_RESEARCH;
18. unknowable future-contingent items do not enter research queue;
19. research queue is correctly prioritized;
20. S13C handoff is valid;
21. Skill-assisted run improves deterministic KGA metrics versus baseline;
22. output depends on input/context;
23. no role/Skill-specific Core branching exists;
24. S13C deep research is not implemented;
25. existing regression remains PASS;
26. typecheck PASS;
27. build PASS;
28. post-build tests PASS;
29. independent review finds no unresolved semantic defect;
30. verification report records limitations/bugs honestly;
31. S13C remains NOT_STARTED at S13B closure.

---

# 31. Failure conditions

S13B must FAIL or remain BLOCKED if:

- a TOLD factual assertion is labeled PROVEN without evidence;
- a PROVEN item lacks evidence;
- a KNOWN item lacks sufficient authority;
- an assumption is hidden as established fact;
- a researchable item is labeled UNKNOWABLE to avoid research;
- a future contingent choice is sent to research as if evidence could decide it;
- a NEEDS_RESEARCH item is falsely marked resolved;
- S04 impact and closure taxonomies are replaced by new parallel vocabularies;
- full Skill catalog is injected into context;
- `research.lookup` or other capability is introduced into S13B;
- S13C research work is pulled forward;
- a new Core runtime is created;
- Core branches on S13B role or Skill ID;
- the baseline comparison is manually fabricated;
- the result is canned and does not depend on input;
- existing S13A semantics are rewritten;
- regression/typecheck/build fails.

---

# 32. Verification report

Part B must create:

```text
brain-bootstrap/reports/S13B-knowledge-gap-analysis-verification.md
```

Minimum contents:

```text
implementation inventory
T1–T24 result table
pre-build test count
post-build test count
typecheck
build

positive fixture classifications
negative fixture classifications

KNOWN/TOLD/PROVEN/ASSUMED/NEEDS_RESEARCH/UNKNOWABLE evidence

S04 impact-axis evidence
closure-state/null evidence

research queue ordering
S13C handoff evidence

Skill-vs-baseline metrics
same-runtime proof

input-dependence proof

S12 discovery/lazy-load evidence

no-Core-branch checks
provider neutrality
no-capability check

independent review findings
bugs found/fixed
limitations
deferred scope
```

---

# 33. Deferred scope

S13B does not implement:

```text
deep research
research queries
evidence retrieval
source ranking
cross-source synthesis
Capability Registry
MCP
Verifier Agent
multi-agent coordination
Workflow Runtime
Orchestrator
Skill Factory
```

S13C receives the prioritized research queue.

---

# 34. Expected S13B closure flow

```text
ChatGPT Part A
↓
integrate 3 semantic artifacts verbatim
↓
S13B Part B
↓
typed Skill
knowledge-gap-analyzer AgentDefinition
materialization
validation
baseline comparison
fixtures
T1–T24
↓
independent review
↓
typecheck/tests/build/post-build tests
↓
verification report
↓
STATE.yaml
↓
commit/push
↓
STEP_STATUS
↓
STOP before S13C
```

---

# 35. Author-side self-check

All ten S13B ambiguities are resolved. The six bootstrap labels are defined as a mutually-exclusive **epistemic-status axis**, while S04 decision impact and closure state remain separate canonical dimensions. S13B uses no capabilities and does not perform deep research: it classifies current bounded knowledge and prepares a prioritized S13C queue. The complete Skill, dedicated STANDARD Quality Contract, AgentDefinition contract, positive/negative examples, deterministic comparison metrics, T1–T24 tests, PASS/failure conditions, and Part B boundary are concrete enough for Claude Code to implement without further semantic decisions.

**Author-side status: READY_FOR_S13B_PART_B.**
