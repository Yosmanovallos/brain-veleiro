# Brain Research Skill — S11

```yaml
id: research.evidence-grounded.s11
version: 0.1.0
status: PROVISIONAL_S11
kind: RESEARCH_SKILL
layer: Intelligence
applies_to:
  - evidence_grounded_research
  - decision_support_research
quality_contract_ref: brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml
required_capabilities:
  - research.lookup
provider_neutral: true
delegation_required: false
```

## 1. Status and boundary

This artifact is the canonical Research Skill for S11 only.

It is intentionally **provisional in structure**, because S12 — Skill Contract v1 — has not yet defined Brain's generic Skill schema.

S11 MUST NOT invent the generic Skill Registry or final universal Skill contract.

S12 MAY migrate this artifact into the future canonical Skill shape, but MUST preserve its approved research semantics unless a later semantic decision explicitly supersedes them.

This Skill is Intelligence.

It does not implement a ModelProvider, CapabilityProvider, MemoryProvider, Skill Registry, workflow engine, or separate Agent Runtime.

---

# 2. Purpose

Produce research that is decision-relevant, observable, evidence-grounded, bounded, and explicit about uncertainty.

The Skill exists to prevent the failure mode:

```text
plausible prose
+
weak or missing evidence
+
hidden uncertainty
=
superficial research
```

The desired behavior is:

```text
question
→ Knowledge Gap Analysis
→ bounded evidence gathering
→ claim/evidence ledger
→ cross-check
→ contradiction/unknown analysis
→ value-of-information stop decision
→ decision-relevant synthesis
```

---

# 3. Inputs

The S11 Research Skill operates on:

```yaml
question:
  type: string
  required: true

quality_contract:
  required: true
  ref: brain-bootstrap/quality-contracts/S11_RESEARCHER_STANDARD.yaml

context:
  retrieval_mode: BOUNDED
  required: false

source_capability:
  capability_id: research.lookup
  required: true
```

`question` MUST be non-empty.

The researcher MUST NOT interpret a whole repository, wiki, history, or corpus as mandatory context.

Only bounded, task-relevant context may be supplied.

---

# 4. Required source capability

S11 requires one real evidence-gathering capability.

Canonical capability ID:

```text
research.lookup
```

This is an S11-scoped reference capability implemented behind the existing S09 `CapabilityProvider` contract.

It is NOT a Capability Registry and does NOT define S14.

## Input

```json
{
  "query": "string",
  "limit": 5
}
```

Validation:

```text
query: non-empty
limit: integer, 1..5
```

## Output

```json
{
  "results": [
    {
      "source_ref": "string",
      "title": "string",
      "source_type": "PRIMARY | SECONDARY | DIRECT_OBSERVATION | OTHER",
      "authority": "string",
      "independence_group": "string",
      "observed_or_published_at": "string",
      "locator": "string",
      "excerpt": "string"
    }
  ]
}
```

## Side effects

```text
NONE
```

for the S11 reference implementation.

The S11 reference implementation MUST perform a real lookup over a bounded deterministic source corpus.

It MUST NOT merely return one hardcoded answer regardless of query.

Different relevant queries MUST be able to produce different result sets.

No network, credentials, external LLM, MCP, or S14 Registry is required for S11 PASS.

---

# 5. Source strategy

Source preference:

```text
direct/runtime evidence where applicable
↓
authoritative primary source
↓
official/original documentation or specification
↓
high-quality independent secondary source
↓
other supporting evidence
```

Primary does not automatically mean correct.

The researcher must consider:

- relevance;
- authority;
- date;
- independence;
- limitations;
- contradiction.

For STANDARD and DEEP work, material claims SHOULD be cross-checked against independent Evidence when feasible.

Two documents that repeat the same upstream source do not count as independent cross-validation.

`independence_group` exists in the S11 reference capability specifically to make this mechanically testable.

---

# 6. Knowledge Gap Analysis

Research begins with the question, not with open-ended browsing.

Each material subquestion must be classified:

```text
DECISION_CRITICAL
DECISION_RELEVANT
CONTEXTUAL
TRIVIA
```

For each non-trivial gap record:

```yaml
id:
question:
gap_class:
why_it_matters:
decision_affected:
status:
```

Allowed status:

```text
OPEN
RESOLVED_WITH_EVIDENCE
RESOLVED_BY_AUTHORITY
ACCEPTED_AS_ASSUMPTION
DEFERRED_WITHOUT_DECISION_IMPACT
BLOCKED
```

Research budget MUST prioritize:

```text
DECISION_CRITICAL
>
DECISION_RELEVANT
>
CONTEXTUAL
>
TRIVIA
```

Do not spend research budget on TRIVIA while material gaps remain open.

---

# 7. Claim model

Each material finding MUST contain:

```yaml
claim:
criticality:
epistemic_status:
evidence: []
confidence:
limitations: []
```

`criticality`:

```text
DECISION_CRITICAL
DECISION_RELEVANT
CONTEXTUAL
```

`epistemic_status`:

```text
EVIDENCED
INFERENCE
UNCERTAIN
```

## EVIDENCED

Requires at least one inspectable Evidence reference.

For STANDARD S11 research, a material claim SHOULD have two independent Evidence references when feasible.

If only one suitable source exists, the claim may remain `EVIDENCED`, but the limitation MUST say cross-validation was not available.

## INFERENCE

Used when the conclusion is reasoned from Evidence but is not directly stated or directly observed.

Requirements:

- supporting Evidence where available;
- explicit `epistemic_status: INFERENCE`;
- limitations describing the inferential step;
- confidence MUST NOT conceal the inference.

## UNCERTAIN

Used when available Evidence is insufficient to support a stronger claim.

Requirements:

- explicit `epistemic_status: UNCERTAIN`;
- limitations MUST explain what is missing;
- confidence SHOULD normally be LOW;
- the statement MUST NOT be phrased as a verified fact.

---

# 8. Evidence record carried in a finding

Each Evidence item exposed in the Researcher output MUST include:

```yaml
evidence_ref:
source_ref:
source_title:
source_type:
authority:
independence_group:
observed_or_published_at:
locator:
relationship:
```

`relationship`:

```text
SUPPORTS
CONTRADICTS
QUALIFIES
```

An Evidence reference without a resolvable source identifier/locator is not sufficient for S11 traceability.

---

# 9. Confidence

Canonical values:

```text
HIGH
MEDIUM
LOW
```

Confidence is not Evidence.

Suggested interpretation:

### HIGH

- strong direct Evidence;
- material claim cross-validated when required;
- no unresolved contradiction likely to change the claim.

### MEDIUM

- suitable Evidence exists;
- limitations or incomplete cross-validation remain;
- conclusion is still reasonably supported.

### LOW

- material inference;
- incomplete Evidence;
- relevant unresolved uncertainty;
- important source limitation.

A highly confident unsupported claim is invalid.

---

# 10. Contradictions

Contradictory Evidence MUST remain visible.

Do not silently choose the preferred source and discard the conflict.

Each material contradiction must contain:

```yaml
topic:
claim_refs: []
evidence_refs: []
description:
resolution:
limitations: []
```

`resolution`:

```text
RESOLVED
UNRESOLVED
NOT_DECISION_RELEVANT
```

For `UNRESOLVED`, the decision impact must be exposed either in `limitations` or the corresponding `unknowns` entry.

---

# 11. Unknowns

Residual unknowns MUST contain:

```yaml
question:
gap_class:
reason_unresolved:
decision_impact:
revalidation_trigger:
```

A decision-critical unknown must never disappear merely because research stopped.

If an unresolved unknown blocks a required decision, it must remain visible and the runtime may use the existing S09 `BLOCKED` terminal outcome.

No new TerminalOutcome is introduced.

---

# 12. Cross-check rule

Because the S11 Quality Contract is STANDARD:

```text
evidence.cross_validation = true
```

For each material `DECISION_CRITICAL` or `DECISION_RELEVANT` claim:

1. seek at least one authoritative/primary source where available;
2. seek independent corroborating or contradicting Evidence;
3. compare source dates and scope;
4. expose disagreement;
5. if independent cross-validation is impossible, record that limitation explicitly.

Cross-validation is not satisfied by duplicate upstream claims.

---

# 13. Value-of-Information stop rule

Research MUST NOT run indefinitely.

After each meaningful evidence round, evaluate:

```text
Are any DECISION_CRITICAL gaps still open?

Would another bounded lookup have a reasonable chance
of changing the decision or materially changing confidence?

Are Quality Contract evidence requirements already met?

Does an unresolved contradiction still affect the decision?
```

The Researcher output MUST contain:

```yaml
research_status:
  state:
  reason:
  unresolved_decision_critical_gaps: []
  additional_research_expected_to_change_decision:
```

Allowed `state`:

```text
SATISFIED
EXHAUSTED_WITH_UNCERTAINTY
MORE_RESEARCH_NEEDED
```

These are Research Skill states only.

They do NOT replace S09:

```text
SUCCESS
FAIL
BLOCKED
```

## SATISFIED

Use when:

- required material gaps are sufficiently resolved;
- Evidence requirements are met;
- remaining uncertainty is explicit and acceptable;
- further research is unlikely to change the decision.

## EXHAUSTED_WITH_UNCERTAINTY

Use when:

- available bounded Evidence is exhausted;
- some uncertainty remains;
- it is explicitly represented;
- no unresolved DECISION_CRITICAL gap prevents the requested decision.

This may still result in S09 `SUCCESS` when the Quality Contract permits residual uncertainty.

## MORE_RESEARCH_NEEDED

Use when additional information is expected to materially affect the decision.

If the run cannot continue because sources, permissions, or limits prevent required research, the existing S09 terminal outcome SHOULD be `BLOCKED`.

---

# 14. Procedure

## R1 — Normalize the question

State the research question narrowly enough to support a decision.

Do not replace the user's question with a broader topic.

---

## R2 — Perform Knowledge Gap Analysis

Create decision-relevant subquestions.

Classify each gap.

Identify what Evidence could close it.

---

## R3 — Prioritize

Research:

1. DECISION_CRITICAL;
2. DECISION_RELEVANT;
3. CONTEXTUAL only when useful.

Ignore TRIVIA unless explicitly requested.

---

## R4 — Build bounded queries

Each `research.lookup` call must target a specific unresolved gap.

Do not request the entire source corpus.

Maximum S11 reference lookup:

```text
5 results per call
```

---

## R5 — Prefer authoritative Evidence

When suitable primary/authoritative Evidence is available, prefer it for material factual claims.

Record source metadata and date.

---

## R6 — Build claim/evidence ledger

For each candidate material conclusion, record:

- claim;
- criticality;
- epistemic status;
- Evidence;
- confidence;
- limitations.

Do this before final synthesis.

---

## R7 — Cross-check

For STANDARD/DEEP:

- seek independent support;
- seek contradiction;
- check date/scope differences.

Do not equate repetition with independence.

---

## R8 — Surface contradictions and unknowns

Material conflicts and unresolved gaps remain explicit.

Never smooth them away to make the final answer sound cleaner.

---

## R9 — Evaluate value of information

Apply the stop rule.

If another lookup is unlikely to change the decision and the Quality Contract is satisfied, stop.

If a critical gap remains and further evidence is obtainable, continue.

If required evidence is unavailable, surface the limitation and block when necessary.

---

## R10 — Produce decision-relevant synthesis

The final summary MUST:

- answer the actual question;
- distinguish evidence from inference;
- expose the strongest limitations;
- include decision-relevant contradictions/unknowns;
- avoid dumping irrelevant source material.

---

# 15. Output requirements

The Research Skill's semantic result is:

```yaml
question:
subquestions: []
findings: []
contradictions: []
unknowns: []
research_status:
decision_relevant_summary:
```

The exact runtime mapping is defined by:

```text
brain-bootstrap/specs/RESEARCHER_AGENT_v1.md
```

---

# 16. Memory rule

The Researcher may:

```text
retrieve
remember_candidate
search_history
```

when permitted by AgentDefinition policy.

It MUST NOT independently promote unverified research conclusions to durable memory.

`commit_verified_memory` remains subject to the existing S07 verified-promotion contract.

Research output is not automatically durable truth.

---

# 17. Prohibited behavior

The Researcher MUST NOT:

- fabricate a source;
- fabricate a publication/observation date;
- cite a source it did not receive or inspect;
- present inference as direct Evidence;
- hide material contradictory Evidence;
- remove an unresolved decision-critical unknown;
- claim cross-validation from duplicated upstream Evidence;
- load an entire corpus when bounded retrieval is sufficient;
- lower evidence standards because of time pressure;
- promote its own unverified claims to durable memory;
- select a concrete provider/vendor through this Skill;
- invoke capabilities outside its AgentDefinition allowlist.

---

# 18. Verification checklist

S11 Research Skill behavior passes only when all applicable checks hold:

- [ ] question is explicit;
- [ ] Knowledge Gap Analysis is visible;
- [ ] material gaps have classifications;
- [ ] primary/authoritative sources are preferred where available;
- [ ] STANDARD cross-check is performed or inability is explicit;
- [ ] every material finding has `criticality`;
- [ ] every material finding has `epistemic_status`;
- [ ] every EVIDENCED finding has Evidence;
- [ ] every material Evidence item includes source/date/locator;
- [ ] every finding has confidence;
- [ ] every finding has limitations, even if empty only when genuinely none are known;
- [ ] material contradictions are surfaced;
- [ ] unresolved material unknowns are surfaced;
- [ ] VOI stop state/reason is explicit;
- [ ] decision-relevant summary answers the question;
- [ ] no decision-critical claim is unsupported and unmarked;
- [ ] provider neutrality is preserved;
- [ ] context remains bounded.

---

# 19. S12 migration rule

When S12 defines Skill Contract v1:

```text
RESEARCH_SKILL_S11.md
→ validate/migrate into generic Skill Contract
```

S12 may change:

- packaging;
- generic metadata shape;
- registry/discovery representation;
- loading mechanism.

S12 must not silently change:

- Knowledge Gap Analysis semantics;
- evidence-grounding rules;
- contradiction handling;
- uncertainty rules;
- VOI stop semantics;
- source traceability requirements.

Any semantic change requires explicit review.

---

## S11 Research Skill self-check

This Skill is sufficiently concrete to guide deterministic S11 behavior but intentionally does not define Brain's future generic Skill system. It requires one bounded read-only evidence capability behind the existing S09 interface and does not require a network, external LLM, MCP, or Capability Registry. It makes claim grounding, cross-checking, contradiction handling, uncertainty, and value-of-information termination observable rather than aspirational.
