# Brain Software Architecture Skill — S13D

```yaml
id: software-architecture.adr.s13d
version: 1.0.0
description: >-
  Compare viable software-architecture alternatives across requirements fit,
  trade-offs, failure modes, cost, operations, and security, then produce an
  evidence-traceable proposed Architecture Decision Record for human approval.

applies_when:
  task_kinds:
    - software-architecture
    - architecture-decision
    - adr-authoring
    - technical-tradeoff-analysis
  signals:
    - architecture
    - alternatives
    - trade-offs
    - failure modes
    - cost
    - operations
    - security
    - ADR
  exclusions:
    - requirements discovery
    - deep research
    - implementation planning
    - agent design
    - tasks with fewer than two genuinely distinct architecture alternatives unless the run is explicitly BLOCKED

inputs:
  - name: architecture_input
    description: >-
      SoftwareArchitectureInput containing the architecture question, full S13B
      knowledge-gap context, optional S13C deep-research evidence, and optional
      candidate alternatives.
    required: true
    schema:
      type: object

outputs:
  - name: architecture_decision
    description: >-
      SoftwareArchitectureDecisionResult containing structured alternative analysis,
      a proposed ADR, and deterministic Markdown rendering.
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
    - brain-bootstrap/quality-contracts/S13D_SOFTWARE_ARCHITECTURE_DEEP.yaml

rules:
  - id: SA-R1
    level: MUST
    statement: Compare at least two and at most four genuinely distinct architecture alternatives before recommending one, unless the decision is BLOCKED.

  - id: SA-R2
    level: MUST
    statement: Mark every alternative origin as PROVIDED or GENERATED; generated alternatives must never be represented as stakeholder-approved choices.

  - id: SA-R3
    level: MUST
    statement: Evaluate every viable alternative against the same canonical decision dimensions rather than using different criteria for different alternatives.

  - id: SA-R4
    level: MUST
    statement: The canonical decision dimensions are requirements_fit, trade_offs, failure_modes, cost, operations, security, and reversibility.

  - id: SA-R5
    level: MUST
    statement: Hard constraints must be represented explicitly and evaluated for every alternative.

  - id: SA-R6
    level: MUST
    statement: Never recommend an alternative that has an unresolved hard-constraint FAIL.

  - id: SA-R7
    level: MUST
    statement: Preserve benefits and disadvantages for every viable alternative; do not create a one-sided comparison to justify a preferred answer.

  - id: SA-R8
    level: MUST
    statement: Failure-mode analysis must include trigger, impact, detectability or observable symptom, and mitigation or containment when known.

  - id: SA-R9
    level: MUST
    statement: Security analysis must address the security properties materially affected by the architecture decision and must not use generic security boilerplate as a substitute for decision-specific analysis.

  - id: SA-R10
    level: MUST
    statement: Cost analysis must distinguish implementation cost, ongoing operational cost, and cost uncertainty rather than inventing precise monetary values when none are evidenced.

  - id: SA-R11
    level: MUST
    statement: Operations analysis must consider deployment, observability, backup/recovery, failure handling, and operator burden when materially relevant.

  - id: SA-R12
    level: MUST
    statement: Reversibility must state migration or exit cost and identify lock-in where present.

  - id: SA-R13
    level: MUST
    statement: Architecture claims derived from S13B/S13C evidence must preserve traceability to their source references.

  - id: SA-R14
    level: MUST
    statement: S13C recommended_closure_state may inform decision readiness but S13D must not mutate or apply S13B/S13C closure state.

  - id: SA-R15
    level: MUST
    statement: Decision-critical unresolved gaps relevant to the architecture question must remain explicit and may force NEEDS_MORE_EVIDENCE or BLOCKED.

  - id: SA-R16
    level: MUST
    statement: Assumptions introduced during architecture analysis must be explicit, justified, risk-rated, and never presented as verified facts.

  - id: SA-R17
    level: MUST
    statement: If candidate alternatives are not supplied, S13D may generate plausible alternatives from the bounded decision context but must mark their origin GENERATED.

  - id: SA-R18
    level: MUST
    statement: Do not invoke research.lookup or any capability; missing evidence is surfaced rather than silently researched.

  - id: SA-R19
    level: MUST
    statement: The selected recommendation must explain why it wins against each rejected alternative, not merely why it is attractive in isolation.

  - id: SA-R20
    level: MUST
    statement: A recommendation may be READY_FOR_HUMAN_APPROVAL only when all architecture-critical hard constraints are evaluated and no decision-critical blocker remains relevant to the decision.

  - id: SA-R21
    level: MUST
    statement: Every ADR produced by S13D has status PROPOSED and approval_required true.

  - id: SA-R22
    level: MUST
    statement: S13D must not silently mark an ADR ACCEPTED; acceptance is an external human-approved state transition.

  - id: SA-R23
    level: MUST
    statement: The deterministic Markdown ADR must be rendered from the structured ADR object and must not contain additional semantic claims absent from the structured result.

  - id: SA-R24
    level: MUST
    statement: Keep context bounded to the architecture question, relevant S13B knowledge items, relevant S13C research items, candidate alternatives, selected Skill content, and the Quality Contract.

procedure:
  - id: SA-P1
    title: Validate architecture decision context
    instruction: >-
      Validate the architecture question, S13B knowledge-gap input, optional S13C
      deep-research result, and candidate alternatives. Preserve upstream inputs unchanged.
    requires:
      - architecture_input
    produces:
      - validated_architecture_context

  - id: SA-P2
    title: Extract decision drivers and hard constraints
    instruction: >-
      Derive bounded decision drivers from relevant S13B items and explicit architecture
      input. Mark hard constraints separately from preferences and preserve source refs.
    requires:
      - validated_architecture_context
    produces:
      - decision_drivers

  - id: SA-P3
    title: Establish candidate alternatives
    instruction: >-
      Use supplied alternatives when available and generate additional alternatives only
      when needed to reach a meaningful comparison. Keep total alternatives between two
      and four and mark each origin PROVIDED or GENERATED.
    requires:
      - decision_drivers
    produces:
      - alternatives

  - id: SA-P4
    title: Evaluate requirements fit
    instruction: >-
      Evaluate every alternative against every hard constraint and material decision
      driver using the same evaluation vocabulary.
    requires:
      - alternatives
      - decision_drivers
    produces:
      - requirements_fit_analysis

  - id: SA-P5
    title: Analyze trade-offs and reversibility
    instruction: >-
      Record benefits, disadvantages, migration cost, lock-in, reversibility, and material
      uncertainties for every viable alternative.
    requires:
      - requirements_fit_analysis
    produces:
      - tradeoff_analysis

  - id: SA-P6
    title: Analyze failure modes
    instruction: >-
      Identify architecture-specific failure modes for every viable alternative, including
      trigger, impact, observable symptom, and mitigation or containment when known.
    requires:
      - tradeoff_analysis
    produces:
      - failure_mode_analysis

  - id: SA-P7
    title: Analyze cost, operations, and security
    instruction: >-
      Compare implementation/operational cost, deployment and operator burden,
      backup/recovery and observability implications, and architecture-specific security
      properties without inventing precise unsupported values.
    requires:
      - failure_mode_analysis
    produces:
      - operational_analysis

  - id: SA-P8
    title: Evaluate evidence and unresolved blockers
    instruction: >-
      Trace material claims to bounded evidence, surface unsupported assumptions, and
      determine whether any decision-critical unresolved gap prevents a responsible
      recommendation.
    requires:
      - operational_analysis
    produces:
      - decision_readiness

  - id: SA-P9
    title: Select or defer recommendation
    instruction: >-
      Recommend one alternative only when the comparison supports it and no unresolved
      hard-constraint violation exists. Otherwise emit NEEDS_MORE_EVIDENCE or BLOCKED.
    requires:
      - decision_readiness
    produces:
      - recommendation

  - id: SA-P10
    title: Produce proposed ADR
    instruction: >-
      Build the structured proposed ADR with context, decision drivers, alternatives,
      decision, consequences, failure modes, cost, operations, security, evidence,
      assumptions, open questions, and approval requirement.
    requires:
      - recommendation
    produces:
      - structured_adr

  - id: SA-P11
    title: Render deterministic Markdown ADR
    instruction: >-
      Render Markdown only from the structured ADR fields using the canonical section
      order and without adding semantic content.
    requires:
      - structured_adr
    produces:
      - adr_markdown

verification:
  - id: SA-V1
    kind: DETERMINISTIC
    criterion: A non-blocked comparison contains between two and four distinct alternatives.
    evidence_required: true

  - id: SA-V2
    kind: DETERMINISTIC
    criterion: Every alternative is evaluated against all hard constraints and canonical architecture dimensions.
    evidence_required: true

  - id: SA-V3
    kind: DETERMINISTIC
    criterion: No recommended alternative has an unresolved hard-constraint FAIL.
    evidence_required: true

  - id: SA-V4
    kind: DETERMINISTIC
    criterion: Every viable alternative includes benefits, disadvantages, and at least one architecture-specific failure-mode analysis when a material failure mode exists in the fixture.
    evidence_required: true

  - id: SA-V5
    kind: DETERMINISTIC
    criterion: Cost, operations, security, and reversibility are present as separate decision dimensions.
    evidence_required: true

  - id: SA-V6
    kind: DETERMINISTIC
    criterion: Material recommendation claims preserve valid upstream or explicit-context evidence references.
    evidence_required: true

  - id: SA-V7
    kind: DETERMINISTIC
    criterion: Generated alternatives and assumptions are explicitly marked and never presented as verified upstream facts.
    evidence_required: true

  - id: SA-V8
    kind: DETERMINISTIC
    criterion: S13B and S13C inputs are unchanged after architecture analysis.
    evidence_required: true

  - id: SA-V9
    kind: DETERMINISTIC
    criterion: ADR status is PROPOSED and approval_required is true.
    evidence_required: true

  - id: SA-V10
    kind: DETERMINISTIC
    criterion: Markdown ADR is deterministically derived from the structured ADR and contains all canonical sections.
    evidence_required: true

  - id: SA-V11
    kind: DETERMINISTIC
    criterion: The Skill-assisted run improves the canonical architecture metrics versus a no-Skill baseline through the same generic Agent runtime.
    evidence_required: true

  - id: SA-V12
    kind: SEMANTIC
    criterion: The recommendation is balanced, evidence-aware, explicit about uncertainty, and does not manufacture architecture certainty.
    evidence_required: true

permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true

evals:
  - evals/s13d/software-architecture-positive
  - evals/s13d/software-architecture-negative
  - evals/s13d/skill-vs-baseline
```

---

# 1. S13D input boundary

S13D is downstream of requirements/gap/research work but remains a reusable architecture-decision Skill.

Canonical:

```ts
interface SoftwareArchitectureInput {
  architecture_question: string;

  knowledge_gap_analysis: KnowledgeGapAnalysisResult;

  deep_research?: DeepResearchBatchResult;

  candidate_alternatives?: ArchitectureAlternativeSeed[];
}
```

Rules:

```text
architecture_question
required
non-empty
specific enough to describe one architecture decision

knowledge_gap_analysis
required
full S13B result
read-only

deep_research
optional
read-only
may contain evidence relevant to some NEEDS_RESEARCH items

candidate_alternatives
optional
0..4
```

No duplicated raw request field is required because:

```text
knowledge_gap_analysis.source_request
```

already preserves upstream client context.

---

# 2. Why S13B is required and S13C is optional

S13B provides the complete epistemic/decision context:

```text
KNOWN
TOLD
PROVEN
ASSUMED
NEEDS_RESEARCH
UNKNOWABLE

decision impact
blocking status
research queue
```

Architecture decisions must know what is established versus assumed.

S13C is optional because:

- an architecture decision may not require deep research;
- S13C may have processed only a bounded subset of the queue;
- architecture comparison must remain possible while explicitly reporting missing evidence.

When S13C is supplied, S13D may use only traceable research items relevant to the architecture question.

---

# 3. S13C closure boundary

S13D does not apply:

```text
recommended_closure_state
```

to S13B.

It may use S13C research output to determine whether a relevant decision driver has:

```text
sufficient evidence
remaining uncertainty
BLOCKED recommendation
MORE_RESEARCH_NEEDED
```

But upstream objects remain read-only.

If a decision-critical architecture driver is still unresolved and materially affects alternative selection:

```text
decision_status
=
NEEDS_MORE_EVIDENCE
or
BLOCKED
```

No closure mutation occurs.

---

# 4. Candidate alternatives

Canonical:

```ts
type ArchitectureAlternativeOrigin =
  | "PROVIDED"
  | "GENERATED";

interface ArchitectureAlternativeSeed {
  id: string;
  name: string;
  description: string;
  origin: ArchitectureAlternativeOrigin;
}
```

If the input provides:

```text
>= 2 viable alternatives
```

S13D may compare them directly.

If fewer than two are provided:

S13D may derive architecture alternatives from the bounded decision context.

Generated alternatives must be labeled:

```text
GENERATED
```

They are proposals for comparison, not stakeholder-approved options.

Maximum:

```text
4 alternatives
```

---

# 5. Decision drivers

Canonical:

```ts
type ArchitectureDriverKind =
  | "HARD_CONSTRAINT"
  | "QUALITY_ATTRIBUTE"
  | "BUSINESS"
  | "OPERATIONS"
  | "SECURITY"
  | "COST"
  | "DELIVERY"
  | "OTHER";

interface ArchitectureDecisionDriver {
  id: string;
  statement: string;

  kind: ArchitectureDriverKind;

  hard: boolean;

  source_refs: string[];

  rationale: string;
}
```

Every `hard: true` driver must be evaluated for every alternative.

---

# 6. Architecture evaluation vocabulary

Avoid false numeric precision.

Canonical:

```ts
type ArchitectureFit =
  | "STRONG"
  | "ACCEPTABLE"
  | "WEAK"
  | "FAIL"
  | "UNKNOWN";
```

For each alternative and driver:

```ts
interface ArchitectureDriverEvaluation {
  driver_id: string;

  fit: ArchitectureFit;

  rationale: string;

  evidence_refs: string[];

  limitations: string[];
}
```

`FAIL` on a hard constraint disqualifies the alternative until the violation is resolved.

`UNKNOWN` on a decision-critical hard constraint may prevent recommendation.

---

# 7. Failure mode

Canonical:

```ts
interface ArchitectureFailureMode {
  id: string;

  alternative_id: string;

  scenario: string;

  trigger: string;

  impact: string;

  observable_symptom: string;

  mitigation_or_containment: string;

  residual_risk:
    | "HIGH"
    | "MEDIUM"
    | "LOW"
    | "UNKNOWN";

  evidence_refs: string[];
}
```

Do not invent a mitigation when unknown.

Use:

```text
mitigation_or_containment: "UNKNOWN"
```

with explicit limitation if necessary.

---

# 8. Cost profile

Canonical:

```ts
interface ArchitectureCostProfile {
  implementation_cost:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "UNKNOWN";

  ongoing_operational_cost:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "UNKNOWN";

  migration_or_exit_cost:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "UNKNOWN";

  cost_drivers: string[];

  limitations: string[];
}
```

This is relative architecture comparison.

Do not invent dollar amounts.

---

# 9. Operations profile

Canonical:

```ts
interface ArchitectureOperationsProfile {
  deployment_complexity:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "UNKNOWN";

  operator_burden:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "UNKNOWN";

  observability_notes: string[];

  backup_recovery_notes: string[];

  failure_handling_notes: string[];

  limitations: string[];
}
```

---

# 10. Security profile

Canonical:

```ts
interface ArchitectureSecurityProfile {
  trust_boundaries: string[];

  sensitive_data_exposure: string[];

  credential_or_secret_implications: string[];

  attack_surface_notes: string[];

  security_tradeoffs: string[];

  unresolved_security_questions: string[];

  evidence_refs: string[];
}
```

No generic "use best practices" filler is sufficient.

Security content must relate to the compared architecture.

---

# 11. Reversibility profile

Canonical:

```ts
interface ArchitectureReversibilityProfile {
  reversibility:
    | "HIGH"
    | "MEDIUM"
    | "LOW"
    | "UNKNOWN";

  migration_path: string;

  lock_in_factors: string[];

  irreversible_or_costly_choices: string[];

  limitations: string[];
}
```

---

# 12. Alternative analysis

Canonical:

```ts
interface ArchitectureAlternativeAnalysis {
  id: string;

  name: string;

  description: string;

  origin:
    | "PROVIDED"
    | "GENERATED";

  driver_evaluations: ArchitectureDriverEvaluation[];

  benefits: string[];

  disadvantages: string[];

  failure_modes: ArchitectureFailureMode[];

  cost: ArchitectureCostProfile;

  operations: ArchitectureOperationsProfile;

  security: ArchitectureSecurityProfile;

  reversibility: ArchitectureReversibilityProfile;

  evidence_refs: string[];

  assumptions: ArchitectureAssumption[];
}
```

---

# 13. Architecture assumptions

Canonical:

```ts
interface ArchitectureAssumption {
  id: string;

  statement: string;

  rationale: string;

  risk:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  must_validate: boolean;

  source_refs: string[];
}
```

An assumption with no upstream support may have:

```text
source_refs: []
```

but must remain visibly an assumption.

---

# 14. Decision readiness

Canonical:

```ts
type ArchitectureDecisionStatus =
  | "READY_FOR_HUMAN_APPROVAL"
  | "NEEDS_MORE_EVIDENCE"
  | "BLOCKED";
```

## READY_FOR_HUMAN_APPROVAL

Allowed only when:

```text
>= 2 viable alternatives were compared

all hard constraints evaluated

recommended alternative has no hard-constraint FAIL

no relevant DECISION_CRITICAL blocker remains unresolved

material recommendation rationale is traceable

ADR can honestly state remaining limitations
```

## NEEDS_MORE_EVIDENCE

Use when:

```text
the decision can be framed and alternatives compared
but critical evidence needed to responsibly select one is still missing
```

Recommended alternative may be:

```text
null
```

or a provisional preference explicitly marked as not ready for approval.

Canonical reference implementation SHOULD use:

```text
recommended_alternative_id: null
```

for deterministic verification.

## BLOCKED

Use when:

```text
the architecture question itself cannot be responsibly evaluated
because required decision context is absent or contradictory
```

---

# 15. Architecture Decision Record

Canonical:

```ts
type AdrStatus =
  | "PROPOSED";

interface ArchitectureDecisionRecord {
  id: string;

  title: string;

  status: "PROPOSED";

  decision_question: string;

  context: string;

  decision_drivers: ArchitectureDecisionDriver[];

  alternatives_considered: string[];

  decision: string;

  selected_alternative_id: string | null;

  rationale: string;

  positive_consequences: string[];

  negative_consequences: string[];

  failure_modes: ArchitectureFailureMode[];

  cost_considerations: string[];

  operational_considerations: string[];

  security_considerations: string[];

  evidence_refs: string[];

  assumptions: ArchitectureAssumption[];

  unresolved_questions: string[];

  approval_required: true;

  approval_note: string;
}
```

Canonical:

```text
status == PROPOSED
approval_required == true
```

Always.

S13D never emits:

```text
ACCEPTED
```

---

# 16. Human approval

The ADR generated by S13D is a recommendation artifact.

Human approval is required before an external process may mark it accepted.

Canonical approval note:

```text
"This ADR is a proposed architecture decision. Human approval is required before it is treated as accepted or used as durable architectural authority."
```

Part B must not implement an approval workflow.

It only preserves the requirement.

---

# 17. SoftwareArchitectureDecisionResult

Canonical:

```ts
interface SoftwareArchitectureDecisionResult {
  architecture_question: string;

  decision_status: ArchitectureDecisionStatus;

  decision_drivers: ArchitectureDecisionDriver[];

  alternatives: ArchitectureAlternativeAnalysis[];

  recommended_alternative_id: string | null;

  recommendation_summary: string;

  rejected_alternative_reasons: {
    alternative_id: string;
    reasons: string[];
  }[];

  unresolved_decision_gaps: {
    knowledge_item_id: string;
    reason: string;
    decision_impact:
      | "DECISION_CRITICAL"
      | "DECISION_RELEVANT"
      | "CONTEXTUAL"
      | "TRIVIA";
  }[];

  adr: ArchitectureDecisionRecord;

  adr_markdown: string;
}
```

---

# 18. StructuredAgentOutput mapping

Do not redefine S09.

Canonical:

```text
StructuredAgentOutput.summary
=
SoftwareArchitectureDecisionResult.recommendation_summary
```

```text
StructuredAgentOutput.data
=
SoftwareArchitectureDecisionResult
```

```text
StructuredAgentOutput.evidence_refs
=
deterministic de-duplicated first-occurrence union of:

decision_drivers[*].source_refs
+
alternatives[*].evidence_refs
+
alternatives[*].driver_evaluations[*].evidence_refs
+
alternatives[*].security.evidence_refs
+
adr.evidence_refs
```

Generated alternative IDs are not evidence refs.

---

# 19. Markdown ADR rendering

Part B must implement deterministic rendering from:

```text
ArchitectureDecisionRecord
```

Canonical section order:

```markdown
# ADR: <title>

## Status

## Context

## Decision Drivers

## Alternatives Considered

## Decision

## Rationale

## Consequences

### Positive

### Negative

## Failure Modes

## Cost

## Operations

## Security

## Evidence

## Assumptions

## Open Questions

## Approval
```

The renderer may format lists/tables mechanically.

It must not invent claims absent from the structured ADR.

---

# 20. Existing ADR precedent

Existing repository ADRs under:

```text
brain-bootstrap/decisions/
```

are format precedent, not a schema constraint.

S13D therefore produces:

```text
typed ADR
+
deterministic Markdown
```

This preserves machine validation while remaining compatible with the repository's durable Markdown/Git architecture.

---

# 21. Capabilities

Canonical:

```text
tools: []
capabilities: []
```

S13D does not reuse:

```text
research.lookup
```

Reason:

S13D is the architecture synthesis/decision step.

If S13B/S13C evidence is insufficient, it must expose:

```text
NEEDS_MORE_EVIDENCE
```

rather than silently performing another research phase.

This preserves S13C's bounded research responsibility and avoids pulling later capability infrastructure forward.

---

# 22. Quality depth

Canonical:

```text
DEEP
```

Reason:

Architecture decisions can create:

```text
cross-cutting constraints
migration cost
operational burden
security exposure
failure propagation
long-term lock-in
```

and the S13D objective explicitly requires:

```text
alternatives
trade-offs
failure modes
cost
operations
security
ADR
```

The reference S13D Quality Contract therefore sets a DEEP floor.

---

# 23. Canonical positive fixture

## Scenario

Architecture question:

```text
¿Cómo debe persistir y sincronizar transacciones un kiosco de tienda que debe seguir operando durante interrupciones de Internet?
```

Fixture context states explicitly:

```text
C1 HARD:
The kiosk must complete the purchase/certificate workflow during WAN outages lasting up to 8 hours.

C2 HARD:
A sudden power loss must not corrupt an already-confirmed transaction.

C3:
One kiosk process writes locally at a time.

C4:
Expected annual volume is approximately 30,000 completed transactions per kiosk.

C5:
The store has a low operations budget and no dedicated database administrator.

C6:
Transactions include limited customer PII and must not be exposed through unnecessary network paths.

C7:
When connectivity returns, completed transactions must be synchronized to a central service.

C8:
The certificate printer is attached locally and the customer-facing flow must not depend on a remote round-trip.
```

All statements are fixture input.

They are not claims about the actual Brain repository.

---

## Candidate alternatives

### ALT-A — Local SQLite + transactional outbox sync

```text
origin: PROVIDED
```

### ALT-B — Remote Postgres-only synchronous writes

```text
origin: PROVIDED
```

### ALT-C — Local JSON files + periodic batch upload

```text
origin: PROVIDED
```

---

## Expected comparison highlights

### ALT-A

Expected:

```text
offline hard constraint:
STRONG

power-loss durability:
STRONG/ACCEPTABLE with transactional persistence

operations:
LOW/MEDIUM

security:
reduced mandatory WAN path during local transaction;
local PII storage still needs protection

failure modes:
local DB corruption
disk loss
outbox backlog
sync conflict
```

### ALT-B

Expected:

```text
offline hard constraint:
FAIL

central consistency:
benefit

operations:
higher remote dependency

failure mode:
WAN outage prevents transaction completion
```

It cannot be recommended while C1 remains hard.

### ALT-C

Expected:

```text
offline:
STRONG

implementation simplicity:
benefit

power-loss / atomicity / corruption handling:
WEAK or materially riskier

operations:
low infrastructure burden

failure modes:
partial write
file corruption
duplicate batch upload
manual repair complexity
```

---

## Expected decision

The reference Skill-guided fixture should recommend:

```text
ALT-A
```

with:

```text
decision_status:
READY_FOR_HUMAN_APPROVAL

ADR status:
PROPOSED

approval_required:
true
```

It must explicitly explain why:

```text
ALT-B is rejected because it violates the offline hard constraint

ALT-C is rejected because its durability/recovery trade-offs are materially worse for confirmed transactions
```

The fixture is a verification scenario, not a universal recommendation that SQLite is always superior.

---

# 24. Canonical negative fixture

Use the same architecture context.

A semantically bad architecture result says:

```text
"Choose remote Postgres because it scales better and is industry standard."
```

while:

```text
ignoring C1 offline operation
not analyzing WAN outage failure
not evaluating operations burden
not evaluating security/network exposure
not discussing migration/reversibility
providing no evidence refs
providing no comparison of ALT-A/ALT-C
```

This is a canonical semantic failure.

The Skill-assisted run must not recommend ALT-B while:

```text
C1 HARD
+
ALT-B fit == FAIL
```

remain true.

---

# 25. Skill-vs-baseline metrics

Canonical:

```ts
interface SoftwareArchitectureComparisonMetrics {
  canonical_dimension_coverage_ratio: number;

  hard_constraint_coverage_ratio: number;

  alternative_balance_ratio: number;

  failure_mode_coverage_ratio: number;

  evidence_traceability_ratio: number;

  assumption_visibility_ratio: number;

  security_dimension_coverage_ratio: number;

  unsupported_recommendation_count: number;

  hard_constraint_violation_count: number;
}
```

---

# 26. Metric semantics

## canonical_dimension_coverage_ratio

Required architecture dimensions evaluated across viable alternatives:

```text
requirements_fit
trade_offs
failure_modes
cost
operations
security
reversibility
```

divided by:

```text
required dimensions × viable alternatives
```

---

## hard_constraint_coverage_ratio

Hard-constraint/alternative evaluation pairs present:

```text
/
all hard-constraint/alternative pairs
```

---

## alternative_balance_ratio

Alternatives that contain:

```text
>= 1 benefit
AND
>= 1 disadvantage
```

divided by viable alternatives.

---

## failure_mode_coverage_ratio

Fixture-expected material failure modes surfaced:

```text
/
fixture-expected material failure modes
```

Fixture truth must be explicit in test data.

---

## evidence_traceability_ratio

Material recommendation/comparison claims with valid upstream or explicit-context source refs:

```text
/
material claims requiring traceability
```

Do not make this metric vacuously 1 by defining the denominator from already-traceable output only.

---

## assumption_visibility_ratio

Fixture-known or generated assumptions emitted explicitly as assumptions:

```text
/
fixture-known or generated assumptions
```

---

## security_dimension_coverage_ratio

Viable alternatives with architecture-specific security analysis:

```text
/
viable alternatives
```

---

## unsupported_recommendation_count

Recommendation assertions that:

```text
lack comparison support
or
contradict explicit driver evaluation
or
lack required evidence/assumption labeling
```

---

## hard_constraint_violation_count

Number of recommended alternatives with:

```text
>= 1 unresolved HARD_CONSTRAINT fit == FAIL
```

Canonical valid result:

```text
0
```

---

# 27. Skill-vs-baseline requirements

Both runs must use:

```text
same SoftwareArchitectureInput
same software-architect-v1 base AgentDefinition
same ModelProvider class/configuration
same Agent limits
same S09/S10 runtime
```

Difference:

```text
baseline:
  no S13D Skill selected/materialized

skill run:
  software-architecture.adr.s13d
  discovered
  lazily loaded
  materialized
```

Required strict improvements on positive fixture:

```text
skill.canonical_dimension_coverage_ratio
>
baseline.canonical_dimension_coverage_ratio
```

```text
skill.failure_mode_coverage_ratio
>
baseline.failure_mode_coverage_ratio
```

```text
skill.evidence_traceability_ratio
>
baseline.evidence_traceability_ratio
```

```text
skill.hard_constraint_violation_count
<
baseline.hard_constraint_violation_count
```

Required negative fixture exact values:

```text
skill.hard_constraint_violation_count == 0
skill.unsupported_recommendation_count == 0
skill.security_dimension_coverage_ratio == 1
```

At least one strict improvement must demonstrate:

```text
comparison completeness
```

and at least one must demonstrate:

```text
decision safety
```

Do not manually fabricate a bad baseline outside `runAgent()`.

---

# 28. Input dependence

Part B must mutate one material fixture input, for example:

Change:

```text
C1:
offline operation is HARD
```

to:

```text
C1:
offline operation is not required
```

while keeping the rest of the architecture context stable.

The result must change materially in at least one:

```text
driver evaluation
alternative viability
recommendation
rejected-alternative rationale
failure-mode priority
decision_status
ADR decision
```

A canned ADR fails.
