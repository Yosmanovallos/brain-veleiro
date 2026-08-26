# Brain Requirements Discovery Skill — S13A

```yaml
id: requirements.discovery.s13a
version: 1.0.0
description: >-
  Convert an ambiguous client request into explicit goals, users, unknowns,
  assumptions, constraints, and testable acceptance criteria without silently
  inventing missing facts.

applies_when:
  task_kinds:
    - requirements
    - product-discovery
    - project-intake
  signals:
    - ambiguous request
    - unclear requirements
    - goals
    - users
    - constraints
    - acceptance criteria
    - assumptions
  exclusions:
    - verbatim transcription
    - pure translation
    - requests that already provide a complete validated specification and ask only for implementation

inputs:
  - name: raw_request
    description: The raw client or stakeholder request to analyze.
    required: true
    schema:
      type: string

outputs:
  - name: requirements_discovery
    description: Structured RequirementsDiscoveryResult for downstream planning and S13B gap analysis.
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
  quality_contract_refs:
    - brain-bootstrap/quality-contracts/S13A_REQUIREMENTS_DISCOVERY_STANDARD.yaml

rules:
  - id: RD-R1
    level: MUST
    statement: Distinguish what the client explicitly said from what the agent derived or assumed.

  - id: RD-R2
    level: MUST
    statement: Never invent a user, constraint, deadline, budget, integration, acceptance threshold, or business rule merely to make the specification look complete.

  - id: RD-R3
    level: MUST
    statement: Represent missing decision-relevant information as explicit unknowns instead of silently filling the gap.

  - id: RD-R4
    level: MUST
    statement: Assumptions must be explicit, justified, risk-rated, and marked for validation when they could change design or acceptance.

  - id: RD-R5
    level: MUST
    statement: Every acceptance criterion must be observable or testable and must link to at least one goal.

  - id: RD-R6
    level: MUST
    statement: Goals describe desired outcomes, not implementation details unless the client explicitly constrained the implementation.

  - id: RD-R7
    level: MUST
    statement: Constraints must preserve their origin and must not be promoted from a guess into an explicit client constraint.

  - id: RD-R8
    level: MUST
    statement: Users must be represented only when explicitly stated or defensibly derived; derived users must be marked DERIVED.

  - id: RD-R9
    level: MUST
    statement: The output must remain bounded to the current request and relevant current-project context; do not load unrelated historical or catalog content.

  - id: RD-R10
    level: SHOULD
    statement: Prefer a smaller set of precise goals and acceptance criteria over a larger set of speculative requirements.

  - id: RD-R11
    level: SHOULD
    statement: Preserve ambiguity when clarification would materially change scope, architecture, cost, risk, or acceptance.

  - id: RD-R12
    level: MUST
    statement: Produce a downstream handoff that tells S13B whether deeper gap analysis is ready and which blockers remain unresolved.

procedure:
  - id: RD-P1
    title: Normalize the raw request
    instruction: >-
      Restate the request as a bounded problem statement without adding facts.
      Preserve the original intent and identify any obvious ambiguity.
    requires:
      - raw_request
    produces:
      - normalized_request

  - id: RD-P2
    title: Extract explicit statements
    instruction: >-
      Identify explicit goals, users, constraints, requested behaviors, and
      acceptance expectations directly supported by the raw request.
    requires:
      - normalized_request
    produces:
      - explicit_items

  - id: RD-P3
    title: Derive bounded goals
    instruction: >-
      Convert explicit intent into outcome-oriented goals. Derived goals must
      remain traceable to the request and must not smuggle in implementation choices.
    requires:
      - explicit_items
    produces:
      - goals

  - id: RD-P4
    title: Identify users
    instruction: >-
      Record explicit users first. Add only defensible derived user categories,
      clearly marked DERIVED and accompanied by rationale.
    requires:
      - explicit_items
    produces:
      - users

  - id: RD-P5
    title: Surface unknowns
    instruction: >-
      Identify missing information that could change scope, behavior, acceptance,
      architecture, cost, risk, or sequencing. Mark whether each unknown is blocking.
    requires:
      - explicit_items
      - goals
    produces:
      - unknowns

  - id: RD-P6
    title: Make assumptions explicit
    instruction: >-
      Where progress requires a provisional interpretation, state it as an
      assumption, explain why it is needed, rate its risk, and mark whether it
      must be validated before implementation.
    requires:
      - unknowns
    produces:
      - assumptions

  - id: RD-P7
    title: Extract constraints
    instruction: >-
      Separate explicit constraints from defensible derived constraints.
      Preserve the constraint kind and origin.
    requires:
      - explicit_items
    produces:
      - constraints

  - id: RD-P8
    title: Draft acceptance criteria
    instruction: >-
      Convert goals into observable or testable acceptance criteria. Each
      criterion must link to one or more goal IDs and must not depend on an
      unmarked assumption.
    requires:
      - goals
      - assumptions
      - constraints
    produces:
      - acceptance_criteria

  - id: RD-P9
    title: Validate internal consistency
    instruction: >-
      Check for contradictions among goals, users, assumptions, constraints, and
      acceptance criteria. If a contradiction cannot be resolved from the request,
      convert it into an explicit unknown instead of silently choosing a side.
    requires:
      - goals
      - users
      - unknowns
      - assumptions
      - constraints
      - acceptance_criteria
    produces:
      - validated_discovery

  - id: RD-P10
    title: Prepare S13B handoff
    instruction: >-
      Set ready_for_gap_analysis and unresolved_blockers. The handoff must preserve
      all explicit unknowns and assumptions so S13B can perform deeper classification
      without rediscovering the original request from scratch.
    requires:
      - validated_discovery
    produces:
      - requirements_discovery

verification:
  - id: RD-V1
    kind: DETERMINISTIC
    criterion: The output contains all required RequirementsDiscoveryResult sections.
    evidence_required: true

  - id: RD-V2
    kind: DETERMINISTIC
    criterion: Every acceptance criterion links to at least one existing goal ID.
    evidence_required: true

  - id: RD-V3
    kind: DETERMINISTIC
    criterion: Every assumption contains rationale, risk, and must_validate.
    evidence_required: true

  - id: RD-V4
    kind: DETERMINISTIC
    criterion: No item marked EXPLICIT lacks a trace/reference to the raw request.
    evidence_required: true

  - id: RD-V5
    kind: DETERMINISTIC
    criterion: No unknown marked blocking is omitted from handoff.unresolved_blockers.
    evidence_required: true

  - id: RD-V6
    kind: DETERMINISTIC
    criterion: The Skill-assisted run scores better than the no-Skill baseline on the canonical S13A fixture metrics.
    evidence_required: true

  - id: RD-V7
    kind: SEMANTIC
    criterion: The discovery result preserves client intent without silently expanding scope.
    evidence_required: true

permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true

evals:
  - evals/s13a/requirements-discovery-positive
  - evals/s13a/requirements-discovery-negative
  - evals/s13a/skill-vs-baseline
```

---

# 1. Purpose

This Skill converts an ambiguous request into a structured requirements-discovery artifact that can support planning and later Knowledge Gap Analysis.

It does not attempt to fully resolve uncertainty.

Its job is to make ambiguity **visible and structured**.

Canonical transformation:

```text
ambiguous request
   ↓
explicit intent extraction
   ↓
goals
users
unknowns
assumptions
constraints
acceptance criteria
   ↓
bounded S13B handoff
```

The Skill improves quality by preventing premature implementation planning based on hidden assumptions.

---

# 2. Boundary with S13B

S13A is **requirements discovery**.

S13B is **knowledge-gap analysis**.

S13A MUST NOT perform S13B's full classification:

```text
known
told
proven
assumed
needs-research
unknowable
```

S13A only prepares clean structured inputs for that later analysis.

For unknowns, S13A uses:

```text
impact: HIGH | MEDIUM | LOW
blocking: boolean
```

This is intentionally lighter than the canonical S04 Knowledge Gap taxonomy.

S13B later owns deeper classification.

---

# 3. Origin model

Items derived during requirements discovery use:

```text
EXPLICIT
DERIVED
ASSUMED
```

Semantics:

## EXPLICIT

Directly supported by the raw request.

Must retain a `source_excerpt`.

## DERIVED

A bounded interpretation needed to express the request structurally.

Must contain rationale.

Must not be presented as direct client language.

## ASSUMED

A provisional claim that is not sufficiently supported but is temporarily useful.

Assumptions live in the dedicated `assumptions` collection and must carry risk/validation requirements.

---

# 4. Goals

Goal shape:

```yaml
id:
statement:
origin:
source_excerpt:
rationale:
priority:
```

`priority`:

```text
PRIMARY
SECONDARY
```

Rules:

- every goal must describe an outcome;
- EXPLICIT goals require `source_excerpt`;
- DERIVED goals require `rationale`;
- goals must not contain arbitrary technical implementation unless explicitly requested.

---

# 5. Users

User shape:

```yaml
id:
description:
origin:
source_excerpt:
rationale:
needs: []
```

Rules:

- EXPLICIT user descriptions require source support;
- DERIVED users require rationale;
- if no defensible user can be identified, use `users: []` and add an unknown.

Never fabricate a persona to make the requirements look complete.

---

# 6. Unknowns

Unknown shape:

```yaml
id:
question:
why_it_matters:
impact:
blocking:
related_goal_ids: []
```

`impact`:

```text
HIGH
MEDIUM
LOW
```

S13A does not attempt to answer these unknowns through research.

Unknowns are discovery artifacts.

Research/deeper resolution belongs to later steps.

---

# 7. Assumptions

Assumption shape:

```yaml
id:
statement:
rationale:
risk:
must_validate:
related_goal_ids: []
```

`risk`:

```text
HIGH
MEDIUM
LOW
```

If an assumption could materially alter architecture, cost, security, scope, or acceptance:

```text
must_validate: true
```

A HIGH-risk assumption must not be hidden inside an acceptance criterion.

---

# 8. Constraints

Constraint shape:

```yaml
id:
statement:
kind:
origin:
source_excerpt:
rationale:
```

`kind`:

```text
BUSINESS
TECHNICAL
TIME
BUDGET
LEGAL
SECURITY
COMPLIANCE
OPERATIONS
OTHER
```

EXPLICIT constraints require source support.

DERIVED constraints require rationale.

ASSUMED is not allowed as a constraint origin; uncertain constraints belong in `assumptions` until validated.

---

# 9. Acceptance criteria

Acceptance criterion shape:

```yaml
id:
criterion:
linked_goal_ids: []
testable:
verification_hint:
```

Rules:

```text
linked_goal_ids.length >= 1
testable == true
criterion non-empty
verification_hint non-empty
```

Acceptance criteria must describe observable behavior/outcomes.

Forbidden examples:

```text
"The app should be good."
"Use a modern architecture."
"Make it scalable."
```

unless the raw request defines measurable meaning.

---

# 10. S13B handoff

Handoff shape:

```yaml
ready_for_gap_analysis:
unresolved_blockers: []
notes:
```

`unresolved_blockers` contains unknown IDs where:

```text
blocking == true
```

`ready_for_gap_analysis` means:

> the discovery artifact is structurally complete enough for S13B to classify and prioritize gaps.

It does **not** mean all unknowns are resolved.

---

# 11. Positive worked example

## Raw request

```text
Necesito una aplicación para que una tienda registre un peluche comprado,
pida el nombre del peluche y algunos datos del dueño, y al final imprima
un certificado. Se usará en un kiosco con pantalla táctil.
```

## Correct discovery behavior

### Goals

```yaml
- id: G1
  statement: Permitir registrar un peluche comprado mediante un flujo de kiosco.
  origin: EXPLICIT
  source_excerpt: "una aplicación para que una tienda registre un peluche comprado"
  rationale: ""
  priority: PRIMARY

- id: G2
  statement: Recoger el nombre del peluche y datos del dueño necesarios para completar el registro.
  origin: EXPLICIT
  source_excerpt: "pida el nombre del peluche y algunos datos del dueño"
  rationale: ""
  priority: PRIMARY

- id: G3
  statement: Generar un certificado imprimible al finalizar el flujo.
  origin: EXPLICIT
  source_excerpt: "al final imprima un certificado"
  rationale: ""
  priority: PRIMARY
```

### Users

```yaml
- id: U1
  description: Persona que utiliza el kiosco para registrar el peluche.
  origin: DERIVED
  source_excerpt: ""
  rationale: El request describe un kiosco interactivo pero no nombra explícitamente al usuario final.
  needs:
    - completar el flujo desde pantalla táctil
    - obtener el certificado final
```

### Unknowns

```yaml
- id: Q1
  question: ¿Cómo se identifica técnicamente el peluche comprado?
  why_it_matters: Cambia el flujo de entrada y posibles integraciones de hardware.
  impact: HIGH
  blocking: true
  related_goal_ids: [G1]

- id: Q2
  question: ¿Qué datos exactos del dueño son obligatorios?
  why_it_matters: Define formularios, validación, privacidad y contenido del certificado.
  impact: HIGH
  blocking: true
  related_goal_ids: [G2]

- id: Q3
  question: ¿Qué impresora/formato debe soportar el certificado?
  why_it_matters: Afecta integración y aceptación del flujo final.
  impact: MEDIUM
  blocking: false
  related_goal_ids: [G3]
```

### Assumptions

```yaml
- id: A1
  statement: El flujo será operado directamente por el cliente desde la pantalla táctil.
  rationale: El request menciona un kiosco con pantalla táctil pero no define operador.
  risk: MEDIUM
  must_validate: true
  related_goal_ids: [G1, G2]
```

### Constraints

```yaml
- id: C1
  statement: La interfaz debe ser utilizable desde una pantalla táctil de kiosco.
  kind: TECHNICAL
  origin: EXPLICIT
  source_excerpt: "Se usará en un kiosco con pantalla táctil."
  rationale: ""
```

### Acceptance criteria

```yaml
- id: AC1
  criterion: El flujo permite completar el registro del peluche desde la interfaz táctil sin requerir teclado físico.
  linked_goal_ids: [G1]
  testable: true
  verification_hint: Ejecutar el flujo completo usando únicamente controles táctiles.

- id: AC2
  criterion: El flujo solicita y conserva el nombre del peluche antes de finalizar el registro.
  linked_goal_ids: [G2]
  testable: true
  verification_hint: Completar el flujo y comprobar que el nombre introducido aparece en el resultado final.

- id: AC3
  criterion: Al completar un registro válido se genera una salida de certificado lista para impresión.
  linked_goal_ids: [G3]
  testable: true
  verification_hint: Ejecutar un registro válido y verificar la existencia de la salida imprimible.
```

### Handoff

```yaml
ready_for_gap_analysis: true
unresolved_blockers:
  - Q1
  - Q2
notes: >-
  El request permite estructurar el objetivo del kiosco, pero las decisiones de
  identificación del producto y datos obligatorios requieren análisis posterior.
```

---

# 12. Negative worked example

## Raw request

```text
Quiero una app para mi negocio. Que sea moderna y fácil de usar.
```

## Incorrect behavior

The Skill must reject or prevent behavior equivalent to:

```text
Users:
- retail customers
- store managers

Constraints:
- must use React
- must use PostgreSQL
- launch in 30 days

Acceptance:
- support 10,000 users
- process payments
```

None of those facts exist in the request.

## Correct behavior

```yaml
goals:
  - id: G1
    statement: Crear una aplicación para apoyar una necesidad del negocio todavía no especificada.
    origin: DERIVED
    source_excerpt: ""
    rationale: El cliente pide una app para su negocio pero no declara el proceso o problema concreto.
    priority: PRIMARY

users: []

unknowns:
  - id: Q1
    question: ¿Qué problema o proceso del negocio debe resolver la aplicación?
    why_it_matters: Sin esto no se puede definir funcionalidad ni aceptación.
    impact: HIGH
    blocking: true
    related_goal_ids: [G1]

  - id: Q2
    question: ¿Quiénes utilizarán la aplicación?
    why_it_matters: Cambia flujos, permisos y experiencia de usuario.
    impact: HIGH
    blocking: true
    related_goal_ids: [G1]

  - id: Q3
    question: ¿Qué significa "moderna y fácil de usar" de forma observable?
    why_it_matters: La frase no es todavía un criterio verificable.
    impact: MEDIUM
    blocking: false
    related_goal_ids: [G1]

assumptions: []

constraints: []

acceptance_criteria:
  - id: AC1
    criterion: El resultado de requirements discovery identifica explícitamente los datos faltantes necesarios antes de definir funcionalidades de implementación.
    linked_goal_ids: [G1]
    testable: true
    verification_hint: Verificar que los usuarios, stack, integraciones, escala y plazo no son inventados y aparecen como unknowns cuando correspondan.

handoff:
  ready_for_gap_analysis: true
  unresolved_blockers:
    - Q1
    - Q2
  notes: El request es insuficiente para especificar una aplicación concreta sin aclaraciones adicionales.
```

This is a successful negative-case outcome.

The Skill succeeds by **refusing to fabricate completeness**.

---

# 13. Improvement-over-baseline requirement

S13A must prove value compared with execution without the Skill.

The comparison must use:

```text
same raw request
same Agent runtime
same base AgentDefinition
same ModelProvider class/configuration
same run limits
```

The only intentional difference is:

```text
baseline
→ no S13A Skill selected/materialized

skill run
→ requirements.discovery.s13a selected and materialized
```

The comparison must be deterministic for the canonical test fixtures.

Required scoring dimensions:

```text
required_section_coverage
explicit_vs_derived_traceability
unknown_capture
assumption_visibility
acceptance_criteria_linkage
acceptance_criteria_testability
fabricated_fact_count
unmarked_assumption_count
```

Minimum PASS comparison:

```text
skill required_section_coverage > baseline
skill unknown_capture >= baseline
skill fabricated_fact_count <= baseline
skill unmarked_assumption_count < baseline
skill acceptance_criteria_linkage > baseline
skill acceptance_criteria_testability > baseline
```

At least one metric must show strict improvement in structural completeness and at least one must show strict improvement in uncertainty/assumption safety.

A comparison constructed so the baseline intentionally violates hardcoded assertions without running through the same generic Agent path is invalid.

---

# 14. S13A Skill self-check

This Skill stays inside S13A's narrow responsibility: discovering and structuring requirements from ambiguous input. It does not perform full Knowledge Gap Analysis, research, implementation planning, or capability execution. Missing facts remain explicit rather than being fabricated, and the output is shaped specifically so S13B can perform deeper classification later.

