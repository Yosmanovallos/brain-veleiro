# Brain Deep Research Skill — S13C

```yaml
id: deep-research.evidence-grounded.s13c
version: 1.0.0
description: >-
  Research the highest-priority NEEDS_RESEARCH items produced by S13B using
  bounded, evidence-grounded investigation with source-quality preference,
  independent cross-validation, contradiction handling, explicit uncertainty,
  value-of-information stopping, and traceable closure recommendations.

applies_when:
  task_kinds:
    - deep-research
    - evidence-gathering
    - decision-research
  signals:
    - needs research
    - research queue
    - evidence
    - authoritative source
    - cross-check
    - contradiction
    - deep research
  exclusions:
    - items classified UNKNOWABLE
    - requirements discovery
    - knowledge-gap classification without evidence gathering
    - open-ended research without a bounded decision question

inputs:
  - name: knowledge_gap_analysis
    description: Full S13B KnowledgeGapAnalysisResult containing the prioritized research queue.
    required: true
    schema:
      type: object

  - name: max_research_items
    description: Maximum number of queue items to research in this run. Defaults to 1 and may not exceed 3.
    required: false
    schema:
      type: number

outputs:
  - name: deep_research
    description: Structured DeepResearchBatchResult preserving S13B traceability and S11 ResearchResult semantics.
    required: true
    schema:
      type: object

requires:
  skills:
    - research.evidence-grounded.s11
  capabilities:
    - research.lookup
  context_sources:
    - CURRENT_TASK
    - EXPLICIT_SPEC
    - VERIFIED_HANDOFF
    - ADR
    - COMPILED_KNOWLEDGE
  quality_contract_refs:
    - brain-bootstrap/quality-contracts/S13C_DEEP_RESEARCH_DEEP.yaml

rules:
  - id: DR-R1
    level: MUST
    statement: Research only items present in S13B research_queue and therefore already classified NEEDS_RESEARCH.

  - id: DR-R2
    level: MUST
    statement: Never research S13B UNKNOWABLE items unless a later canonical step explicitly reclassifies them first.

  - id: DR-R3
    level: MUST
    statement: Preserve S13B knowledge_item_id, decision_impact, blocking, and research_question through every research result.

  - id: DR-R4
    level: MUST
    statement: Preserve the S11 ResearchResult claim-level epistemic semantics EVIDENCED, INFERENCE, and UNCERTAIN without merging them with S13B item-level epistemic status.

  - id: DR-R5
    level: MUST
    statement: Prefer authoritative and primary sources for decision-critical and decision-relevant claims.

  - id: DR-R6
    level: MUST
    statement: For material evidenced claims, seek independent cross-validation when independent evidence is reasonably available.

  - id: DR-R7
    level: MUST
    statement: Sources sharing the same independence_group count as one independent source family for cross-validation.

  - id: DR-R8
    level: MUST
    statement: Search for contradictory or qualifying evidence before recommending a gap closure.

  - id: DR-R9
    level: MUST
    statement: Contradictory evidence remains visible in the final research result even when one side is judged stronger.

  - id: DR-R10
    level: MUST
    statement: Recency must be evaluated relative to the research question; stale evidence must be explicitly qualified and may not silently support a current-state claim.

  - id: DR-R11
    level: MUST
    statement: Every material claim must have evidence or be explicitly marked INFERENCE or UNCERTAIN with limitations, preserving S11 semantics.

  - id: DR-R12
    level: MUST
    statement: Do not promote an evidence-poor result to HIGH confidence merely because multiple sources repeat the same upstream claim.

  - id: DR-R13
    level: MUST
    statement: Use bounded research. Default to one research item per run and never process more than three S13B queue items in one run.

  - id: DR-R14
    level: MUST
    statement: Preserve S13B research_queue order when selecting items for a bounded batch.

  - id: DR-R15
    level: MUST
    statement: Use the S11 value-of-information stop semantics rather than searching indefinitely.

  - id: DR-R16
    level: MUST
    statement: SATISFIED requires enough evidence for the decision and no unresolved decision-critical contradiction that could change the answer.

  - id: DR-R17
    level: MUST
    statement: EXHAUSTED_WITH_UNCERTAINTY keeps residual uncertainty visible and must not be converted into a false resolved-with-evidence closure.

  - id: DR-R18
    level: MUST
    statement: MORE_RESEARCH_NEEDED keeps the gap open and normally recommends no closure state.

  - id: DR-R19
    level: MUST
    statement: S13C may recommend a canonical S04 closure state but must not mutate the upstream S13B KnowledgeGapAnalysisResult.

  - id: DR-R20
    level: MUST
    statement: A RESOLVED_WITH_EVIDENCE recommendation requires traceable evidence sufficient for the researched question.

  - id: DR-R21
    level: MUST
    statement: A RESOLVED_BY_AUTHORITY recommendation requires a source whose authority is sufficient for the specific question.

  - id: DR-R22
    level: MUST
    statement: A BLOCKED recommendation is allowed only when a decision-critical item cannot currently be resolved and that unresolved state blocks the relevant decision.

  - id: DR-R23
    level: MUST
    statement: S13C must not recommend ACCEPTED_AS_ASSUMPTION or DEFERRED_WITHOUT_DECISION_IMPACT for a NEEDS_RESEARCH item; those decisions belong outside deep research.

  - id: DR-R24
    level: MUST
    statement: Item-level uncertainty or evidence exhaustion does not automatically halt research on other selected queue items.

  - id: DR-R25
    level: MUST
    statement: A true runtime or capability failure that produces canonical S09 BLOCKED stops the current Agent run.

  - id: DR-R26
    level: MUST
    statement: Do not automatically promote unverified research output into durable memory.

  - id: DR-R27
    level: MUST
    statement: Do not introduce new web, MCP, vendor, or capability infrastructure in S13C; use research.lookup behind the existing CapabilityProvider boundary.

  - id: DR-R28
    level: MUST
    statement: Keep the context bounded to the selected queue items, relevant upstream traceability, selected Skill, Quality Contract, and retrieved evidence.

procedure:
  - id: DR-P1
    title: Validate the S13B research handoff
    instruction: >-
      Validate KnowledgeGapAnalysisResult, confirm the selected item IDs exist in
      research_queue, and reject any UNKNOWABLE or non-NEEDS_RESEARCH item.
    requires:
      - knowledge_gap_analysis
    produces:
      - validated_research_queue

  - id: DR-P2
    title: Select bounded research batch
    instruction: >-
      Select the first max_research_items entries from S13B research_queue,
      preserving canonical queue order. Default to 1; maximum 3.
    requires:
      - validated_research_queue
    produces:
      - selected_research_items

  - id: DR-P3
    title: Decompose each research question
    instruction: >-
      For each selected item, decompose the bounded research question into the
      minimum subquestions required to resolve the decision-relevant uncertainty.
      Preserve S11 Knowledge Gap Analysis semantics.
    requires:
      - selected_research_items
    produces:
      - research_plans

  - id: DR-P4
    title: Retrieve authoritative evidence
    instruction: >-
      Use research.lookup to retrieve bounded evidence, preferring primary and
      authoritative sources and recording source metadata, dates, locators, and
      independence groups.
    requires:
      - research_plans
    produces:
      - candidate_evidence

  - id: DR-P5
    title: Cross-check material claims
    instruction: >-
      For each decision-critical or decision-relevant evidenced claim, seek
      independent support where available and never count duplicate upstream
      source families as independent confirmation.
    requires:
      - candidate_evidence
    produces:
      - cross_checked_evidence

  - id: DR-P6
    title: Search for contradiction and qualification
    instruction: >-
      Look for evidence that contradicts, narrows, dates, or otherwise qualifies
      the leading answer before recommending closure.
    requires:
      - cross_checked_evidence
    produces:
      - contradiction_analysis

  - id: DR-P7
    title: Synthesize S11 ResearchResult
    instruction: >-
      Produce the canonical S11 ResearchResult for each selected queue item,
      preserving findings, evidence, confidence, limitations, contradictions,
      unknowns, research_status, and decision_relevant_summary.
    requires:
      - contradiction_analysis
    produces:
      - research_results

  - id: DR-P8
    title: Apply value-of-information stop rule
    instruction: >-
      Stop each item's research when S11 SATISFIED or
      EXHAUSTED_WITH_UNCERTAINTY is justified, or report MORE_RESEARCH_NEEDED
      when additional evidence could still materially change the decision.
    requires:
      - research_results
    produces:
      - stopped_research_results

  - id: DR-P9
    title: Recommend closure without mutating upstream state
    instruction: >-
      For each researched item, recommend RESOLVED_WITH_EVIDENCE,
      RESOLVED_BY_AUTHORITY, BLOCKED, or null according to the approved mapping.
      Do not mutate S13B closure_state.
    requires:
      - stopped_research_results
    produces:
      - closure_recommendations

  - id: DR-P10
    title: Build bounded batch result
    instruction: >-
      Return processed item results, deferred queue IDs, batch status, preserved
      traceability, evidence refs, limitations, and a decision-relevant summary.
    requires:
      - closure_recommendations
    produces:
      - deep_research

verification:
  - id: DR-V1
    kind: DETERMINISTIC
    criterion: Every processed item exists in S13B research_queue and is NEEDS_RESEARCH.
    evidence_required: true

  - id: DR-V2
    kind: DETERMINISTIC
    criterion: No UNKNOWABLE S13B item is researched.
    evidence_required: true

  - id: DR-V3
    kind: DETERMINISTIC
    criterion: Batch selection preserves S13B queue order and never exceeds three items.
    evidence_required: true

  - id: DR-V4
    kind: DETERMINISTIC
    criterion: Every item-level research object passes the canonical S11 ResearchResult validator.
    evidence_required: true

  - id: DR-V5
    kind: DETERMINISTIC
    criterion: Material evidenced claims use valid evidence metadata and do not count duplicate independence groups as independent support.
    evidence_required: true

  - id: DR-V6
    kind: DETERMINISTIC
    criterion: Contradictory evidence discovered by the fixture remains visible in the result.
    evidence_required: true

  - id: DR-V7
    kind: DETERMINISTIC
    criterion: Research status and recommended closure state satisfy the canonical S13C mapping.
    evidence_required: true

  - id: DR-V8
    kind: DETERMINISTIC
    criterion: The upstream S13B result remains unchanged after S13C research.
    evidence_required: true

  - id: DR-V9
    kind: DETERMINISTIC
    criterion: StructuredAgentOutput evidence_refs exactly deduplicate the selected item research evidence and authority references in first-occurrence order.
    evidence_required: true

  - id: DR-V10
    kind: DETERMINISTIC
    criterion: Changing material source evidence changes the corresponding finding, contradiction, confidence, research status, or closure recommendation.
    evidence_required: true

  - id: DR-V11
    kind: DETERMINISTIC
    criterion: The Skill-assisted run improves the canonical S13C metrics versus the no-Skill baseline through the same generic Agent runtime.
    evidence_required: true

  - id: DR-V12
    kind: SEMANTIC
    criterion: The synthesis states evidence, contradictions, uncertainty, and limits without manufacturing closure.
    evidence_required: true

permissions:
  allowed_capabilities:
    - research.lookup
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true

evals:
  - evals/s13c/deep-research-positive
  - evals/s13c/deep-research-negative
  - evals/s13c/skill-vs-baseline
```

---

# 1. Relationship to S11

S13C does **not** replace S11.

S11 remains the canonical foundation for evidence-grounded research.

S13C adds a deeper policy layer around it:

```text
S11
=
single bounded evidence-grounded research task
+
ResearchResult
+
evidence metadata
+
contradictions
+
unknowns
+
VOI stop
+
research.lookup

S13C
=
S13B research queue selection
+
bounded multi-item batch
+
S11 ResearchResult per item
+
DEEP cross-validation/source-quality floor
+
S13B traceability
+
closure recommendation
+
batch comparison/verification
```

The S13C typed Skill SHOULD mechanically reuse/compose the existing S11 typed research Skill where practical.

It MUST NOT modify S11 canonical files.

---

# 2. Skill dependency semantics

S13C declares:

```yaml
requires:
  skills:
    - research.evidence-grounded.s11
```

This is a semantic dependency.

S12 does not implement generic transitive Skill execution.

Therefore Part B MUST NOT create a new Core dependency resolver merely for S13C.

Operationally:

```text
deep-research.evidence-grounded.s13c
```

is the selected Skill.

Its typed/runtime representation may mechanically compose the already-approved S11 research semantics so the selected S13C Skill is complete at runtime.

---

# 3. Bounded research scope

Canonical:

```text
default max_research_items = 1
minimum = 1
maximum = 3
```

Selection:

```text
take the first N items from S13B research_queue
```

No re-ranking inside S13C.

S13B already owns queue priority.

Optional explicit requested item IDs MAY be introduced mechanically only if:

```text
they are a subset of research_queue
and their processing order remains the S13B canonical order
```

If no such field is needed by Part B, omit it.

Do not create a workflow engine.

---

# 4. DEEP source-quality policy

S13C preserves all S11 evidence requirements and strengthens the minimum for material claims.

For a decision-critical or decision-relevant `EVIDENCED` finding:

## Preferred

At least:

```text
2 independent independence_group values
```

and, when reasonably available:

```text
>= 1 PRIMARY or authoritative source
```

## Singular-authority exception

One source may be sufficient when the question is inherently governed by a single canonical authority.

Examples:

```text
official product limit from the vendor's current canonical documentation
current law text from the governing authority
current repository/runtime evidence for a repository-state question
```

The result must explicitly say why singular authority is sufficient.

## If independent evidence is unavailable

The result may still complete only if:

```text
limitation is explicit
confidence reflects the evidence weakness
closure recommendation does not overclaim
```

For decision-critical factual questions, lack of reasonable cross-validation normally caps confidence at:

```text
MEDIUM
```

unless the singular-authority exception applies.

---

# 5. Independence rule

Two sources with the same:

```text
independence_group
```

count as one source family.

They may both appear as evidence.

They may not satisfy a two-independent-source requirement by themselves.

This protects against:

```text
syndicated article
mirror
copied documentation
same upstream dataset
same press release repeated by multiple sites
```

---

# 6. Recency rule

Recency is question-relative.

A source must not be rejected merely for age if the researched fact is stable.

For current-state claims, the evidence must be current enough to support:

```text
now
currently
latest
supported today
current policy
current limit
```

If a stale source is retained:

```text
limitation must explicitly qualify its temporal validity
```

and the result must not phrase the stale evidence as current fact without qualification.

---

# 7. Contradiction rule

Before closure recommendation for a material gap, the deep-research process must attempt to detect:

```text
direct contradiction
scope qualification
version mismatch
date mismatch
authority conflict
```

A contradiction cannot be removed merely because one side appears weaker.

It must remain visible in:

```text
ResearchResult.contradictions
```

with resolution/limitations according to S11 semantics.

---

# 8. Value-of-information stopping

Reuse S11 exactly:

```text
SATISFIED
EXHAUSTED_WITH_UNCERTAINTY
MORE_RESEARCH_NEEDED
```

S13C adds no fourth research-status value.

## SATISFIED

Use when:

```text
decision-relevant evidence requirement is met
material contradiction is resolved or explicitly non-decision-relevant
additional bounded lookup is unlikely to change the decision
```

## EXHAUSTED_WITH_UNCERTAINTY

Use when:

```text
bounded evidence was exhausted
uncertainty remains explicit
additional available research is not expected to resolve it within current bounds
```

## MORE_RESEARCH_NEEDED

Use when:

```text
additional reachable evidence could materially change the decision
```

A provider/runtime inability to continue may still yield canonical S09:

```text
BLOCKED
```

at runtime level.

---

# 9. Recommended closure mapping

S13C does not write S13B state.

It emits:

```text
recommended_closure_state
```

Allowed values for S13C:

```text
RESOLVED_WITH_EVIDENCE
RESOLVED_BY_AUTHORITY
BLOCKED
null
```

S13C MUST NOT recommend:

```text
ACCEPTED_AS_ASSUMPTION
DEFERRED_WITHOUT_DECISION_IMPACT
```

for a `NEEDS_RESEARCH` item.

## Mapping

### SATISFIED

If direct/independent evidence resolves the question:

```text
RESOLVED_WITH_EVIDENCE
```

If the correct answer is established by a singular or sufficient canonical authority:

```text
RESOLVED_BY_AUTHORITY
```

### EXHAUSTED_WITH_UNCERTAINTY

Normally:

```text
null
```

If:

```text
decision_impact == DECISION_CRITICAL
blocking == true
and current evidence limits make the decision unable to proceed
```

then:

```text
BLOCKED
```

may be recommended.

### MORE_RESEARCH_NEEDED

```text
null
```

### Runtime/capability BLOCKED

The Agent run uses existing S09 terminal semantics.

Do not manufacture item-level closure from a failed run.

---

# 10. Who applies closure

S13C is allowed to **recommend** closure.

It does not mutate the upstream `KnowledgeGapAnalysisResult`.

Application of the recommendation requires a later verified/human/orchestration decision.

For S13C's own bootstrap PASS, deterministic tests verify that the recommendation is justified.

This preserves evidence without pretending that research output automatically becomes durable truth.

---

# 11. Positive worked example

Use a researchable S13B item from the kiosk/plush context.

Upstream item:

```yaml
knowledge_item_id: K-Q1
research_question: ¿Cómo se identifica técnicamente el peluche comprado?
decision_impact: DECISION_CRITICAL
blocking: true
epistemic_status: NEEDS_RESEARCH
closure_state: null
```

Reference fixture evidence should include at least:

```yaml
- source_ref: SRC-PRIMARY-1
  source_type: PRIMARY
  authority: vendor-canonical
  independence_group: vendor-docs
  observed_or_published_at: 2026-08-01
  locator: /scanner/integration
  excerpt: >-
    The supported kiosk scanner identifies the product using the encoded product identifier.

- source_ref: SRC-INDEPENDENT-2
  source_type: DIRECT_OBSERVATION
  authority: verified-test-fixture
  independence_group: local-test
  observed_or_published_at: 2026-08-20
  locator: test/scanner-fixture
  excerpt: >-
    Scanning fixture AX-104 produced product identifier AX-104 and selected the matching product record.

- source_ref: SRC-QUALIFIER-3
  source_type: PRIMARY
  authority: vendor-canonical
  independence_group: vendor-docs
  observed_or_published_at: 2026-08-01
  locator: /scanner/limitations
  excerpt: >-
    The scanner returns an identifier only; product metadata must be resolved by the application.
```

Correct deep-research behavior:

```text
- decompose:
    1. what identifier is physically encoded/read?
    2. what does the scanner return?
    3. where does product metadata resolution occur?

- cross-check:
    vendor-docs + independent local-test

- qualifier remains visible:
    scanner returns identifier, not complete product metadata

- research_status:
    SATISFIED

- recommended_closure_state:
    RESOLVED_WITH_EVIDENCE

- limitation:
    production scanner hardware/encoding configuration still requires deployment-specific verification if different from fixture
```

The answer must not inflate:

```text
"scanner returns complete product data"
```

because the qualifier says otherwise.

---

# 12. Canonical negative example

Research item:

```yaml
knowledge_item_id: K-NEG-1
research_question: ¿El proveedor X soporta actualmente la característica requerida?
decision_impact: DECISION_CRITICAL
blocking: true
epistemic_status: NEEDS_RESEARCH
closure_state: null
```

Fixture corpus:

```yaml
- source_ref: COPY-A
  source_type: SECONDARY
  authority: community-summary
  independence_group: upstream-blog-1
  observed_or_published_at: 2026-01-10
  locator: /summary-a
  excerpt: El proveedor soporta la característica.

- source_ref: COPY-B
  source_type: SECONDARY
  authority: syndicated-summary
  independence_group: upstream-blog-1
  observed_or_published_at: 2026-01-12
  locator: /summary-b
  excerpt: El proveedor soporta la característica.

- source_ref: OFFICIAL-CURRENT
  source_type: PRIMARY
  authority: vendor-canonical
  independence_group: vendor-docs
  observed_or_published_at: 2026-08-20
  locator: /current-limitations
  excerpt: La característica no está soportada en la versión actual.
```

Incorrect behavior:

```text
COPY-A + COPY-B
→ counted as two independent sources
→ contradiction OFFICIAL-CURRENT hidden
→ HIGH confidence
→ RESOLVED_WITH_EVIDENCE in favor of support
```

Correct behavior:

```text
COPY-A + COPY-B
→ one independence group

OFFICIAL-CURRENT
→ surfaced as contradiction / stronger current authority

result
→ contradiction visible
→ no false cross-validation
→ answer reflects current authoritative limitation

research_status
→ SATISFIED if the current authoritative source is sufficient

recommended_closure_state
→ RESOLVED_BY_AUTHORITY
```

If the fixture instead makes the authority ambiguous, the correct result is:

```text
EXHAUSTED_WITH_UNCERTAINTY or MORE_RESEARCH_NEEDED
recommended_closure_state: null
```

Never hide the contradiction.

---

# 13. Self-check

S13C is bounded deep research, not a new search platform. It consumes S13B's already-prioritized NEEDS_RESEARCH queue, uses the existing `research.lookup` capability, preserves the S11 ResearchResult and VOI semantics, strengthens source-quality/cross-validation requirements, and emits traceable closure recommendations without mutating upstream truth.
