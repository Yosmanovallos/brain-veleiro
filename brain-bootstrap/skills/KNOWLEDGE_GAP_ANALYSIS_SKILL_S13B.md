# Brain Knowledge Gap Analysis Skill — S13B

```yaml
id: knowledge-gap.analysis.s13b
version: 1.0.0
description: >-
  Classify the current requirements-discovery knowledge into known, told,
  proven, assumed, needs-research, and unknowable while preserving decision
  impact, justified closure state, provenance, and a bounded handoff to deep research.

applies_when:
  task_kinds:
    - knowledge-gap-analysis
    - requirements-analysis
    - decision-preparation
  signals:
    - known
    - told
    - proven
    - assumed
    - needs research
    - unknowable
    - unresolved requirements
    - knowledge gaps
  exclusions:
    - open-ended deep research
    - evidence gathering from external sources
    - implementation planning before requirements discovery is structurally complete

inputs:
  - name: requirements_discovery
    description: Full S13A RequirementsDiscoveryResult.
    required: true
    schema:
      type: object

  - name: context_facts
    description: >-
      Optional bounded current-context facts already supplied by Context.
      These facts may establish canonical authority or direct proof without
      invoking a research capability.
    required: false
    schema:
      type: array

outputs:
  - name: knowledge_gap_analysis
    description: Structured KnowledgeGapAnalysisResult for S13C and downstream decisions.
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
  quality_contract_refs:
    - brain-bootstrap/quality-contracts/S13B_KNOWLEDGE_GAP_ANALYSIS_STANDARD.yaml

rules:
  - id: KGA-R1
    level: MUST
    statement: Treat epistemic status, decision impact, and closure state as three separate axes.

  - id: KGA-R2
    level: MUST
    statement: Never classify a stakeholder assertion as PROVEN merely because it is explicit.

  - id: KGA-R3
    level: MUST
    statement: PROVEN requires direct inspectable evidence already present in bounded context.

  - id: KGA-R4
    level: MUST
    statement: KNOWN requires a current canonical authority sufficient for the statement, not merely model confidence.

  - id: KGA-R5
    level: MUST
    statement: TOLD means explicitly asserted by a stakeholder or source but not independently established as KNOWN or PROVEN.

  - id: KGA-R6
    level: MUST
    statement: ASSUMED means provisionally accepted or derived without sufficient authority/evidence; it must never be presented as KNOWN or PROVEN.

  - id: KGA-R7
    level: MUST
    statement: NEEDS_RESEARCH is reserved for an unresolved, researchable question whose answer could materially affect a decision.

  - id: KGA-R8
    level: MUST
    statement: UNKNOWABLE is reserved for information that cannot reasonably be established now through bounded evidence or research, including future contingent choices or intrinsically unavailable facts.

  - id: KGA-R9
    level: MUST
    statement: Do not use UNKNOWABLE merely as a synonym for not-yet-researched.

  - id: KGA-R10
    level: MUST
    statement: Use the canonical S04 decision-impact vocabulary without renaming it.

  - id: KGA-R11
    level: MUST
    statement: Assign an S04 closure state only when current evidence, authority, accepted-assumption policy, or explicit blocking conditions justify it.

  - id: KGA-R12
    level: MUST
    statement: Do not assign RESOLVED_WITH_EVIDENCE to an item without inspectable evidence references.

  - id: KGA-R13
    level: MUST
    statement: Do not assign RESOLVED_BY_AUTHORITY unless the cited authority is sufficient for that statement.

  - id: KGA-R14
    level: MUST
    statement: Open NEEDS_RESEARCH items normally have no closure_state; S13B does not pretend that classification resolved them.

  - id: KGA-R15
    level: MUST
    statement: Preserve S13A origin, source excerpts, related goals, blockers, and assumptions rather than rediscovering the client request from scratch.

  - id: KGA-R16
    level: MUST
    statement: The S13C research queue contains only items classified NEEDS_RESEARCH.

  - id: KGA-R17
    level: MUST
    statement: Decision-critical NEEDS_RESEARCH items rank ahead of decision-relevant, contextual, and trivia items.

  - id: KGA-R18
    level: MUST
    statement: Do not invoke research.lookup or any other capability in S13B.

  - id: KGA-R19
    level: MUST
    statement: Keep context bounded to S13A output plus relevant current-authority facts; do not load unrelated corpus or full Skill catalog.

  - id: KGA-R20
    level: MUST
    statement: Produce an explicit S13C handoff without performing S13C deep research.

procedure:
  - id: KGA-P1
    title: Validate S13A input
    instruction: >-
      Confirm the full RequirementsDiscoveryResult is structurally valid and
      ready_for_gap_analysis is true or explicitly record why analysis is still useful.
    requires:
      - requirements_discovery
    produces:
      - validated_discovery

  - id: KGA-P2
    title: Normalize candidate knowledge items
    instruction: >-
      Convert S13A goals, users, unknowns, assumptions, constraints, acceptance
      criteria, and supplied context_facts into a uniform candidate-item set while
      preserving source references and related goal IDs.
    requires:
      - validated_discovery
    produces:
      - candidate_items

  - id: KGA-P3
    title: Classify epistemic status
    instruction: >-
      Assign exactly one of KNOWN, TOLD, PROVEN, ASSUMED, NEEDS_RESEARCH,
      or UNKNOWABLE to every candidate item using the canonical semantics in this Skill.
    requires:
      - candidate_items
    produces:
      - epistemically_classified_items

  - id: KGA-P4
    title: Assign decision impact
    instruction: >-
      Assign DECISION_CRITICAL, DECISION_RELEVANT, CONTEXTUAL, or TRIVIA independently
      from epistemic status. Preserve the S13A unknown-impact mapping where applicable.
    requires:
      - epistemically_classified_items
    produces:
      - impact_classified_items

  - id: KGA-P5
    title: Determine justified closure state
    instruction: >-
      Apply an S04 closure state only when current evidence/authority/assumption policy
      justifies it. Leave closure_state null for genuinely open items.
    requires:
      - impact_classified_items
    produces:
      - closure_annotated_items

  - id: KGA-P6
    title: Detect overclaims and conflicts
    instruction: >-
      Check for PROVEN without evidence, KNOWN without sufficient authority,
      ASSUMED hidden as fact, researchable items labeled UNKNOWABLE, and
      unknowable future choices labeled NEEDS_RESEARCH.
    requires:
      - closure_annotated_items
    produces:
      - validated_classification

  - id: KGA-P7
    title: Build bucket indexes
    instruction: >-
      Build deterministic ID buckets for known, told, proven, assumed,
      needs_research, and unknowable without duplicating or reclassifying items.
    requires:
      - validated_classification
    produces:
      - buckets

  - id: KGA-P8
    title: Prioritize research queue
    instruction: >-
      Select only NEEDS_RESEARCH items and sort by decision impact first,
      then blocking status, then deterministic ID ordering.
    requires:
      - validated_classification
    produces:
      - research_queue

  - id: KGA-P9
    title: Build S13C handoff
    instruction: >-
      Produce ready_for_deep_research, research_item_ids, decision_blockers,
      unknowable_item_ids, and notes. Do not resolve research items here.
    requires:
      - research_queue
      - buckets
    produces:
      - s13c_handoff

  - id: KGA-P10
    title: Summarize decision readiness
    instruction: >-
      Summarize what is established, what is merely asserted, what is assumed,
      what must be researched, and what cannot currently be known.
    requires:
      - validated_classification
      - s13c_handoff
    produces:
      - knowledge_gap_analysis

verification:
  - id: KGA-V1
    kind: DETERMINISTIC
    criterion: Every normalized item has exactly one valid epistemic_status.
    evidence_required: true

  - id: KGA-V2
    kind: DETERMINISTIC
    criterion: Every item has exactly one valid S04 decision_impact.
    evidence_required: true

  - id: KGA-V3
    kind: DETERMINISTIC
    criterion: Every PROVEN item has at least one direct evidence_ref.
    evidence_required: true

  - id: KGA-V4
    kind: DETERMINISTIC
    criterion: Every KNOWN item cites a sufficient canonical authority reference.
    evidence_required: true

  - id: KGA-V5
    kind: DETERMINISTIC
    criterion: No TOLD item is silently upgraded to PROVEN without evidence.
    evidence_required: true

  - id: KGA-V6
    kind: DETERMINISTIC
    criterion: research_queue contains only NEEDS_RESEARCH items in canonical priority order.
    evidence_required: true

  - id: KGA-V7
    kind: DETERMINISTIC
    criterion: UNKNOWABLE items are absent from research_queue.
    evidence_required: true

  - id: KGA-V8
    kind: DETERMINISTIC
    criterion: No open NEEDS_RESEARCH item is falsely marked resolved.
    evidence_required: true

  - id: KGA-V9
    kind: DETERMINISTIC
    criterion: Bucket indexes partition all item IDs exactly once.
    evidence_required: true

  - id: KGA-V10
    kind: DETERMINISTIC
    criterion: The Skill-assisted run improves canonical KGA metrics versus a no-Skill baseline through the same generic Agent runtime.
    evidence_required: true

  - id: KGA-V11
    kind: SEMANTIC
    criterion: The analysis preserves uncertainty and does not manufacture knowledge.
    evidence_required: true

permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true

evals:
  - evals/s13b/knowledge-gap-positive
  - evals/s13b/knowledge-gap-negative
  - evals/s13b/skill-vs-baseline
```

---

# 1. Canonical epistemic taxonomy

S13B's objective names six categories.

They are a single mutually-exclusive axis:

```text
KNOWN
TOLD
PROVEN
ASSUMED
NEEDS_RESEARCH
UNKNOWABLE
```

Every analyzed knowledge item MUST receive exactly one.

---

## 1.1 KNOWN

Use `KNOWN` when the statement is established by a current canonical authority sufficient for that kind of statement.

Examples:

- an explicit current spec defines a requirement;
- a current ADR establishes an architectural decision;
- repository/runtime reality establishes current state and direct test evidence is not the classification focus.

`KNOWN` is authority-grounded.

It is not model intuition.

Required:

```text
authority_refs.length >= 1
authority_sufficient == true
```

Typical closure:

```text
RESOLVED_BY_AUTHORITY
```

when that authority is sufficient for the current decision.

---

## 1.2 TOLD

Use `TOLD` when an authorized stakeholder or source explicitly asserted something but S13B does not have sufficient current authority/evidence to call it KNOWN or PROVEN.

Examples:

```text
"The client says there are 10,000 active users."
"The stakeholder says the launch date is November."
```

Those may be important.

They are not automatically verified facts.

Required:

```text
assertion_refs.length >= 1
```

Closure may remain null.

A TOLD requirement/preferences claim MAY be `RESOLVED_BY_AUTHORITY` only when the stakeholder is inherently authoritative for that decision, e.g. a product owner choosing a desired behavior.

A factual assertion requiring verification remains open unless separately established.

---

## 1.3 PROVEN

Use `PROVEN` only when direct inspectable evidence already present in bounded context verifies the statement.

Examples:

- deterministic test result;
- direct runtime observation;
- current repository content proving implementation state;
- other directly inspectable evidence.

Required:

```text
evidence_refs.length >= 1
```

Canonical closure:

```text
RESOLVED_WITH_EVIDENCE
```

PROVEN is stricter than TOLD.

---

## 1.4 ASSUMED

Use `ASSUMED` for a provisional interpretation not sufficiently established by authority/evidence.

S13A assumptions normally remain ASSUMED unless new bounded context explicitly upgrades them.

Required:

```text
assumption_rationale non-empty
```

Closure:

```text
ACCEPTED_AS_ASSUMPTION
```

only if:

```text
accepted_for_current_decision == true
```

Otherwise closure remains null.

---

## 1.5 NEEDS_RESEARCH

Use `NEEDS_RESEARCH` when:

1. the answer is not established by current bounded context;
2. the question is researchable;
3. obtaining evidence could materially affect a decision.

Typical examples:

```text
Which scanner protocol does the target hardware support?
What retention rule applies in the target jurisdiction?
Which API limitation affects the required workflow?
```

S13B does not resolve it.

Canonical closure:

```text
null
```

until later work.

The item becomes eligible for S13C's research queue.

---

## 1.6 UNKNOWABLE

Use `UNKNOWABLE` when the information cannot reasonably be established now through evidence/research.

Examples:

- a future stakeholder choice not yet made;
- a future contingent event with no determinable answer;
- inaccessible information where no feasible evidence path exists for the current decision window.

Do NOT use UNKNOWABLE merely because research has not happened yet.

If decision impact is:

```text
CONTEXTUAL
TRIVIA
```

S13B MAY assign:

```text
DEFERRED_WITHOUT_DECISION_IMPACT
```

If an UNKNOWABLE item is:

```text
DECISION_CRITICAL
```

and the decision truly cannot proceed without it, S13B MAY assign:

```text
BLOCKED
```

Otherwise closure remains null.

---

# 2. Orthogonality with S04

S13B does not replace S04.

Each knowledge item has three independent dimensions:

```text
epistemic_status
decision_impact
closure_state
```

Example:

```yaml
epistemic_status: TOLD
decision_impact: DECISION_CRITICAL
closure_state: null
```

This means:

> the stakeholder asserted a decision-critical fact, but it is not yet sufficiently established.

Another:

```yaml
epistemic_status: PROVEN
decision_impact: DECISION_RELEVANT
closure_state: RESOLVED_WITH_EVIDENCE
```

Another:

```yaml
epistemic_status: ASSUMED
decision_impact: DECISION_RELEVANT
closure_state: ACCEPTED_AS_ASSUMPTION
```

These axes must never be collapsed into one enum.

---

# 3. Mapping S13A unknown impact to S04 impact

S13A already uses:

```text
HIGH
MEDIUM
LOW
```

For S13A `unknowns` only, S13B uses this deterministic initial mapping:

```text
HIGH
→ DECISION_CRITICAL

MEDIUM
→ DECISION_RELEVANT

LOW
→ CONTEXTUAL
```

S13B MAY downgrade to `TRIVIA` only when the item is demonstrably irrelevant to the requested decision and the rationale is explicit.

For S13A goals/users/assumptions/constraints/acceptance criteria and supplied context facts, decision impact is assigned based on decision effect rather than this mapping.

---

# 4. Closure-state policy

Allowed existing S04 values:

```text
RESOLVED_WITH_EVIDENCE
RESOLVED_BY_AUTHORITY
ACCEPTED_AS_ASSUMPTION
DEFERRED_WITHOUT_DECISION_IMPACT
BLOCKED
```

S13B output additionally permits:

```text
closure_state: null
```

because S04 defines closure states, but S13B must also represent gaps that are still genuinely open.

This does not invent a new S04 closure state.

It means:

> no S04 closure state is currently justified.

Rules:

```text
PROVEN
→ normally RESOLVED_WITH_EVIDENCE

KNOWN
→ normally RESOLVED_BY_AUTHORITY

TOLD
→ null unless source is sufficient authority for the decision itself

ASSUMED
→ ACCEPTED_AS_ASSUMPTION only when accepted_for_current_decision == true

NEEDS_RESEARCH
→ normally null

UNKNOWABLE + low/non-decision impact
→ may DEFERRED_WITHOUT_DECISION_IMPACT

UNKNOWABLE + decision-critical + cannot proceed
→ may BLOCKED
```

---

# 5. Positive worked example

Input builds on the verified S13A kiosk/plush discovery result.

Relevant S13A items:

```yaml
request: >-
  Necesito una aplicación para que una tienda registre un peluche comprado,
  pida el nombre del peluche y algunos datos del dueño, y al final imprima
  un certificado. Se usará en un kiosco con pantalla táctil.

unknowns:
  - id: Q1
    question: ¿Cómo se identifica técnicamente el peluche comprado?
    impact: HIGH
    blocking: true

  - id: Q2
    question: ¿Qué datos exactos del dueño son obligatorios?
    impact: HIGH
    blocking: true

  - id: Q3
    question: ¿Qué impresora/formato debe soportar el certificado?
    impact: MEDIUM
    blocking: false

assumptions:
  - id: A1
    statement: El flujo será operado directamente por el cliente desde la pantalla táctil.
    risk: MEDIUM
    must_validate: true

constraints:
  - id: C1
    statement: La interfaz debe ser utilizable desde una pantalla táctil de kiosco.
    origin: EXPLICIT
```

Bounded context facts:

```yaml
- id: CF1
  statement: La interfaz objetivo es un kiosco táctil.
  source_ref: request:S13A
  basis: CANONICAL_AUTHORITY
  authority: CURRENT_CLIENT_REQUEST

- id: CF2
  statement: Una impresora Zebra ZD421 conectada al entorno de prueba imprimió correctamente el certificado de fixture.
  source_ref: test:printer-fixture-001
  basis: DIRECT_EVIDENCE
  authority: DETERMINISTIC_TEST

- id: CF3
  statement: El cliente todavía no ha decidido si el kiosco será operado por el comprador o por un empleado.
  source_ref: stakeholder-note:operator-undecided
  basis: CANONICAL_AUTHORITY
  authority: CURRENT_CLIENT_DECISION_STATE
```

Expected classifications include:

```yaml
- id: K-C1
  source_item_ref: C1
  statement: La interfaz debe ser utilizable desde una pantalla táctil de kiosco.
  epistemic_status: KNOWN
  decision_impact: DECISION_RELEVANT
  closure_state: RESOLVED_BY_AUTHORITY
  authority_refs:
    - request:S13A
  evidence_refs: []
  assertion_refs: []
  rationale: The current client request is authoritative for this desired constraint.

- id: K-Q1
  source_item_ref: Q1
  statement: ¿Cómo se identifica técnicamente el peluche comprado?
  epistemic_status: NEEDS_RESEARCH
  decision_impact: DECISION_CRITICAL
  closure_state: null
  authority_refs: []
  evidence_refs: []
  assertion_refs: []
  rationale: The answer is unresolved but researchable and changes hardware/integration design.

- id: K-Q2
  source_item_ref: Q2
  statement: ¿Qué datos exactos del dueño son obligatorios?
  epistemic_status: NEEDS_RESEARCH
  decision_impact: DECISION_CRITICAL
  closure_state: null
  rationale: The answer can be established through stakeholder/domain investigation and affects forms/privacy.

- id: K-PRINT
  source_item_ref: CF2
  statement: The fixture certificate can be printed on the tested Zebra ZD421 environment.
  epistemic_status: PROVEN
  decision_impact: DECISION_RELEVANT
  closure_state: RESOLVED_WITH_EVIDENCE
  evidence_refs:
    - test:printer-fixture-001
  rationale: Direct deterministic test evidence is already present.

- id: K-A1
  source_item_ref: A1
  statement: El flujo será operado directamente por el cliente.
  epistemic_status: UNKNOWABLE
  decision_impact: DECISION_RELEVANT
  closure_state: null
  rationale: The stakeholder has explicitly not made that future product choice yet; additional factual research cannot decide it.
```

Expected research queue:

```yaml
research_queue:
  - K-Q1
  - K-Q2
```

The operator-choice item is **not** sent to research.

---

# 6. Negative worked example

Input:

```yaml
requirements_discovery:
  request: >-
    El cliente afirma que la plataforma ya tiene 10.000 usuarios activos
    y quiere decidir el proveedor de pagos el próximo mes.

  goals:
    - id: G1
      statement: Preparar la aplicación para el volumen declarado.
      origin: DERIVED

  unknowns:
    - id: Q1
      question: ¿Cuántos usuarios activos verificables existen actualmente?
      impact: HIGH
      blocking: false

    - id: Q2
      question: ¿Qué proveedor de pagos elegirá finalmente el cliente el próximo mes?
      impact: MEDIUM
      blocking: false

  assumptions: []
  constraints: []
  users: []
  acceptance_criteria: []
```

No direct evidence verifies 10,000 active users.

Correct behavior:

```text
"10,000 active users"
→ TOLD
not PROVEN
```

The current user-count verification question:

```text
Q1
→ NEEDS_RESEARCH
```

The future payment-provider choice:

```text
Q2
→ UNKNOWABLE
```

because the client has not made the decision yet.

Incorrect behavior includes:

```text
TOLD → PROVEN because the client said it
UNKNOWABLE → NEEDS_RESEARCH when no evidence search can determine a future choice
NEEDS_RESEARCH → RESOLVED_WITH_EVIDENCE without evidence
```

---

# 7. S13B self-check

This Skill performs classification and prioritization only. It does not gather new external evidence, does not resolve research gaps, and does not redefine S04 gap-impact or closure semantics. Its central value is preventing assertions, assumptions, researchable gaps, and truly unknowable items from being collapsed into a single undifferentiated "unknown" bucket.
