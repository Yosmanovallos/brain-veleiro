# BRAIN — Quality Architecture v1

## 1. Purpose

Brain's Quality Architecture defines how rigor is selected, how decision-relevant uncertainty is exposed, how research is scoped, what counts as Evidence, how proposals are challenged, and what must be true before work is considered done.

Its objective is to prevent superficially plausible research, architecture, and implementation from being accepted merely because they sound coherent.

The governing principle is:

> **The amount of rigor must be proportional to risk, ambiguity, novelty, irreversibility, and consequence — not to an agent's preference.**

This architecture elaborates the existing Quality Contract skeleton without changing its canonical field names or its FAST / STANDARD / DEEP depth policy.

---

# 2. Quality Flow

For non-trivial work, quality is applied as an explicit control loop:

```text
TASK / SPEC
    ↓
KNOWLEDGE GAP ANALYSIS
    ↓
DEPTH SELECTION
    ↓
QUALITY CONTRACT
    ↓
RESEARCH / IMPLEMENTATION
    ↓
DETERMINISTIC QA
    ↓
CHALLENGE
    ↓
SEMANTIC / LLM REVIEW IF NEEDED
    ↓
VERIFY
    ↓
DONE
```

A later quality check may return work to an earlier stage when it exposes:

- unsupported assumptions;
- missing alternatives;
- unresolved decision-critical uncertainty;
- failed deterministic checks;
- insufficient Evidence;
- acceptance criteria that are not actually met.

Quality is therefore a set of gates and recovery paths, not a final review performed after all work is already complete.

---

# 3. Knowledge Gap Analysis

## 3.1 Definition

A **Knowledge Gap** is missing information whose resolution could materially alter:

- requirements;
- feasibility;
- architecture;
- security;
- risk;
- scope;
- implementation strategy;
- verification;
- delivery decisions.

A question is not a meaningful Knowledge Gap merely because it is unanswered.

The key test is:

> **Could a different answer change an important decision?**

If no, the question is likely trivia or optional background information.

---

## 3.2 Gap Classification

Each candidate gap should be classified as one of:

### DECISION_CRITICAL

The answer can materially change requirements, architecture, feasibility, safety, cost, or acceptance.

These gaps should be resolved before the affected decision is finalized whenever feasible.

### DECISION_RELEVANT

The answer may improve a decision or reveal a meaningful trade-off but does not currently block progress.

These gaps should be investigated when the expected value of additional information justifies the time or cost.

### CONTEXTUAL

The information helps understanding but is unlikely to change the decision.

Research is optional.

### TRIVIA

The information does not materially affect the task.

Do not spend research budget on it.

---

## 3.3 Required Gap Record

A material Knowledge Gap should identify:

- the question;
- why it matters;
- which decision it can change;
- preferred Evidence source;
- urgency;
- consequence if unresolved;
- whether an explicit assumption is allowed temporarily.

Example structure:

```text
Question:
Why it matters:
Decision affected:
Priority:
Preferred Evidence:
Consequence if unresolved:
Temporary assumption allowed:
```

---

## 3.4 Gap Closure Rules

A Knowledge Gap may be considered closed when one of the following is explicit:

```text
RESOLVED_WITH_EVIDENCE
RESOLVED_BY_AUTHORITY
ACCEPTED_AS_ASSUMPTION
DEFERRED_WITHOUT_DECISION_IMPACT
BLOCKED
```

A gap must not silently disappear from later artifacts.

If the work proceeds using an assumption, that assumption remains visible until independently validated or explicitly accepted by the authorized decision owner.

---

# 4. Depth Selection

Brain uses exactly three Quality Contract depth levels:

```text
FAST
STANDARD
DEEP
```

Depth must be selected from:

- risk;
- ambiguity;
- novelty;
- irreversibility;

and from the practical consequences of being wrong.

The depth level is not a measure of how long an answer should be.

It determines **how much verification, research, comparison, Evidence, and challenge are required**.

---

## 4.1 FAST

FAST is appropriate when the work is:

- trivial or highly bounded;
- low risk;
- low ambiguity;
- low novelty;
- easy to reverse;
- supported by sufficient local context;
- unlikely to cause material harm if wrong.

Typical examples include:

- small text or configuration corrections;
- obvious local refactors with existing tests;
- mechanical updates;
- low-impact deterministic changes.

FAST should not be chosen merely because time is limited.

If the work is high-risk, time pressure should reduce scope rather than falsely classify the work as FAST.

### FAST Expected Rigor

Typically:

- known gaps identified;
- Evidence required when a factual or execution claim is material;
- deterministic checks run when applicable;
- no unnecessary broad research;
- alternatives optional unless the decision is genuinely ambiguous;
- uncertainty remains explicit.

---

## 4.2 STANDARD

STANDARD is the default depth for meaningful engineering work where errors matter but do not justify maximum investigative rigor.

Typical examples include:

- product features;
- integrations;
- authentication;
- database changes;
- APIs;
- simple Agents;
- significant implementation changes;
- moderate-risk architectural decisions;
- work with non-trivial external dependencies.

STANDARD is appropriate when one or more of risk, ambiguity, novelty, or irreversibility is MEDIUM, or when implementation introduces meaningful interaction between components.

### STANDARD Expected Rigor

Typically:

- decision-relevant Knowledge Gaps required;
- primary sources preferred where available;
- meaningful alternatives compared;
- important claims supported by Evidence;
- deterministic QA required;
- implementation trade-offs made explicit;
- significant uncertainty surfaced;
- challenge procedure applied to important decisions.

---

## 4.3 DEEP

DEEP is required when consequences or uncertainty make superficial confidence unacceptable.

Typical examples include:

- new system architecture;
- autonomous or highly capable Agents;
- security-sensitive work;
- financial behavior;
- sensitive or regulated data;
- infrastructure decisions;
- difficult-to-reverse choices;
- unknown domains;
- high-risk migrations;
- decisions with material operational or business consequences.

DEEP should also be selected when multiple factors are HIGH even if the task superficially appears small.

### DEEP Expected Rigor

Typically:

- explicit Knowledge Gap Analysis;
- strong source quality requirements;
- cross-validation required for material claims where feasible;
- alternatives required;
- contradictory Evidence actively sought;
- explicit trade-off analysis;
- deterministic QA required;
- challenge protocol required;
- unresolved uncertainty must be visible;
- verification must be independent where feasible;
- completion requires stronger Evidence than model judgment.

---

# 5. Depth Selection Procedure

Use the following sequence.

## Step 1 — Rate the Four Canonical Factors

Rate:

```text
risk: LOW | MEDIUM | HIGH
ambiguity: LOW | MEDIUM | HIGH
novelty: LOW | MEDIUM | HIGH
irreversibility: LOW | MEDIUM | HIGH
```

The ratings should be supported by a short reason.

---

## Step 2 — Apply Depth Floor Rules

Use these minimums:

### FAST candidate

Only when all four factors are LOW and the task is bounded, familiar, and easily reversible.

### STANDARD floor

Use at least STANDARD when:

- any factor is MEDIUM;
- the task is a feature or integration;
- authentication, database, API, or simple Agent behavior is involved;
- several components interact;
- deterministic verification requires more than a trivial check.

### DEEP floor

Use DEEP when:

- security is materially involved;
- money or financial outcomes are materially involved;
- sensitive data is materially involved;
- autonomous Agent behavior is material;
- new architecture is being selected;
- infrastructure decisions are difficult to reverse;
- the domain is materially unfamiliar;
- any failure could cause substantial business, operational, privacy, or safety impact;
- multiple factors are HIGH.

A lower depth may not override a mandatory DEEP condition merely because the implementation appears straightforward.

---

## Step 3 — Consider Resource Constraints

Time, token, cost, or tooling limits may constrain how much work can be completed.

They do **not** change the intrinsic required depth.

When resource limits conflict with the selected depth:

```text
reduce scope
or
defer optional work
or
mark BLOCKED
```

before weakening essential Evidence or verification.

---

## Step 4 — Record Selection

The Quality Contract must record:

- selected depth;
- the four factor ratings;
- selection rationale;
- any mandatory floor that applied;
- any scope reduction caused by resource constraints.

---

# 6. Research Protocol

Research exists to close decision-relevant Knowledge Gaps.

It is not an invitation to collect unlimited information.

---

## 6.1 Research Question First

Every research activity should answer a defined question such as:

```text
What do we need to know?
Why can this change the decision?
What Evidence would be sufficient?
What would cause us to stop researching?
```

Do not begin with a broad topic when a narrower decision question is available.

---

## 6.2 Source Strategy

Evidence quality should be proportional to depth.

When applicable, prefer:

1. authoritative primary sources;
2. direct system/repository/runtime Evidence;
3. official technical documentation;
4. standards or specifications;
5. high-quality secondary analysis;
6. community experience as supporting Evidence, not automatic authority.

A source's relevance, recency, incentives, and limitations matter.

A primary source can still be outdated or irrelevant.

---

## 6.3 Cross-Validation

Cross-validation means checking a material claim against independent Evidence when the Quality Contract requires it.

It is especially valuable when:

- a source may be biased;
- information changes quickly;
- the decision is difficult to reverse;
- consequences are high;
- sources disagree.

Cross-validation does not mean collecting many sources that merely repeat the same upstream claim.

---

## 6.4 Alternatives

When `research.alternatives_required` is true, research must identify viable competing approaches rather than only support the first plausible option.

For each meaningful alternative record:

- expected benefit;
- cost;
- risk;
- constraints;
- assumptions;
- Evidence;
- reason accepted or rejected.

---

## 6.5 Contradictory Evidence

When `research.contradictory_evidence_required` is true, actively search for Evidence that could invalidate the favored conclusion.

Questions include:

- What source would disagree?
- Under what conditions does this approach fail?
- Which assumptions are most fragile?
- Is there a counterexample?
- Are negative results or operational failure reports available?
- Does the conclusion depend on one source family?

Contradictory Evidence must not be omitted because it weakens the preferred recommendation.

---

## 6.6 Value-of-Information Stop Rule

Research should stop when the expected value of additional information is lower than its cost or when additional information is unlikely to change the decision.

A practical stop test is:

```text
If another credible source disagreed,
could it materially change the decision?
```

If the answer is no and the Evidence threshold is satisfied, further research may be unnecessary.

Research should also stop when:

- required Knowledge Gaps are sufficiently resolved;
- the Quality Contract's Evidence standard is met;
- remaining uncertainty is explicit and acceptable;
- additional investigation would consume resources better spent on implementation or verification.

Research must not stop merely because the first plausible answer was found.

---

# 7. Evidence Contract

## 7.1 Evidence Principle

Evidence is a verifiable observation or artifact supporting or contradicting a claim.

Examples include:

- command output;
- exit codes;
- tests;
- diffs;
- traces;
- runtime observations;
- source documents;
- source-controlled artifacts;
- externally verifiable system state.

An Agent's statement:

```text
"the test passed"
```

is not Evidence.

The actual test output or equivalent verifiable record is Evidence.

---

## 7.2 Evidence Requirements

Each material Evidence record should preserve enough information to answer:

```text
What claim does this support or contradict?
What is the source?
When was it observed or published?
How directly does it support the claim?
How confident are we?
What are its limitations?
Can another reviewer reproduce or inspect it?
```

---

## 7.3 Evidence Status

Evidence-related information may use the existing status vocabulary:

```text
VERIFIED
PROVIDED
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

These labels describe epistemic/operational status.

They do not replace the Evidence itself.

For example:

```text
status: VERIFIED
```

is meaningless without a source or observation that allows verification.

---

## 7.4 Claim-to-Evidence Traceability

Material recommendations should be traceable:

```text
claim
  ↓
Evidence record(s)
  ↓
reasoning
  ↓
decision
```

When multiple Evidence items conflict, the conflict must remain visible until resolved or explicitly accepted as uncertainty.

---

## 7.5 Evidence Freshness

Evidence must include enough temporal information to determine whether it may be stale.

Recency requirements depend on the decision.

For rapidly changing information, recent Evidence may be mandatory.

For stable standards or historical facts, older authoritative Evidence may remain valid.

Do not use "recent" as a universal quality proxy.

---

# 8. Challenger Protocol

The Challenger protocol is a **procedure**, not an AgentDefinition.

It can be executed by a human or an independent reasoning process.

Its purpose is to actively search for ways a proposal could be wrong before acceptance.

---

## 8.1 Challenger Independence

Where feasible, the challenger should not be the same reasoning pass that authored the proposal.

The challenger should receive:

- the proposal;
- relevant Spec;
- applicable Quality Contract;
- Evidence references;
- known assumptions;
- acceptance criteria.

It should not be instructed to defend the proposal.

---

## 8.2 Challenge Questions

For research findings:

- Which claim has the weakest Evidence?
- Is any conclusion based on correlation presented as causation?
- Are sources independent?
- Is important Evidence stale?
- What contradictory Evidence exists?
- Which unknown remains decision-critical?

For architecture decisions:

- What simpler alternative was rejected?
- What assumption makes this architecture work?
- What happens if that assumption fails?
- Which component is hardest to replace?
- Where is vendor or implementation coupling hidden?
- What failure mode has not been modeled?
- Is complexity justified by an actual requirement or Eval?
- Which decision is difficult to reverse?

For Specs:

- Is the problem confused with the proposed solution?
- Which requirement cannot be objectively verified?
- Is any important non-goal missing?
- Is an assumption presented as fact?
- Could two stakeholders interpret success differently?
- Is Human Approval based on explicit acceptance criteria?

For implementation:

- Which path is not tested?
- Are there false-positive checks?
- Is a mocked result being mistaken for production behavior?
- Can a retry cause duplication or inconsistent state?
- Are failure states observable?
- Is security dependent on caller discipline instead of enforcement?

---

## 8.3 Challenger Outcomes

The challenge produces one of:

```text
NO_MATERIAL_OBJECTION
REVISION_REQUIRED
ADDITIONAL_EVIDENCE_REQUIRED
ALTERNATIVE_REVIEW_REQUIRED
BLOCKED
```

Each objection should include:

- target claim/decision;
- concern;
- Evidence or reasoning;
- consequence;
- required response.

A challenger does not automatically override the original author.

It exposes issues that must be resolved or explicitly accepted.

---

# 9. Definition of Done

"Done" means that the result satisfies the required depth, not merely that an artifact exists.

---

## 9.1 FAST Definition of Done

FAST work is done when:

- scope is bounded;
- known material assumptions are visible;
- required deterministic checks pass;
- material factual/execution claims have Evidence;
- acceptance criteria are met;
- no unresolved issue materially changes the result.

A long research report is not required.

---

## 9.2 STANDARD Definition of Done

STANDARD work is done when:

- decision-relevant Knowledge Gaps are addressed;
- required alternatives and trade-offs are visible;
- material claims are supported by suitable Evidence;
- deterministic QA passes;
- meaningful uncertainty is explicit;
- applicable challenge questions have been addressed;
- acceptance criteria are verified;
- remaining risks or limitations are documented.

---

## 9.3 DEEP Definition of Done

DEEP work is done only when:

- decision-critical Knowledge Gaps are resolved or explicitly accepted as residual risk;
- primary/authoritative Evidence is used where available;
- material claims are cross-validated where feasible;
- meaningful alternatives are compared;
- contradictory Evidence was actively considered;
- trade-offs and failure modes are explicit;
- deterministic QA passes;
- challenge protocol is completed;
- independent verification is used where feasible;
- unresolved uncertainty is visible;
- acceptance criteria and Quality Contract requirements are satisfied with reproducible Evidence.

A DEEP result must not receive PASS solely because an LLM reviewer believes it is plausible.

---

# 10. Deterministic QA Before LLM Review

This ordering is mandatory:

```text
IMPLEMENTATION
    ↓
DETERMINISTIC CHECKS
    ↓
RESULT EVALUATION
    ↓
LLM / SEMANTIC REVIEW IF NEEDED
```

Examples of deterministic checks may include, when applicable:

- tests;
- static validation;
- type validation;
- build verification;
- reproducible commands;
- security checks;
- schema validation;
- data consistency checks;
- artifact existence checks.

No specific tool or vendor is required by this architecture.

---

## 10.1 Ordering Rule

If deterministic checks applicable to a task have not run, an LLM review cannot substitute for them.

If deterministic checks fail, the failure must be addressed before semantic review is trusted as verification unless the purpose of the semantic review is explicitly to diagnose that failure.

---

## 10.2 Why

LLMs are useful for:

- semantic comparison;
- identifying omissions;
- reviewing reasoning;
- challenging architecture;
- assessing whether requirements appear satisfied.

They are weaker than deterministic systems for claims such as:

```text
Does this compile?
Did this test pass?
Does this schema parse?
Is this exact file present?
Did the command exit successfully?
```

Brain therefore uses deterministic Evidence first and semantic judgment second.

---

# 11. Uncertainty Representation

Uncertainty must be surfaced rather than hidden behind confident prose.

For material claims record, when relevant:

- confidence;
- limitation;
- unknowns;
- assumptions;
- contradictory Evidence;
- revalidation condition.

---

## 11.1 Confidence

Use:

```text
HIGH
MEDIUM
LOW
```

Confidence expresses current belief strength.

It is not Evidence.

A highly confident unsupported claim remains unsupported.

---

## 11.2 Limitations

A limitation explains what the Evidence or conclusion does not establish.

Examples:

```text
source covers only one environment
runtime behavior not tested under concurrency
information may be stale
sample size is small
provider behavior inferred from documentation only
```

---

## 11.3 Residual Unknowns

A result may still proceed with uncertainty if the Quality Contract and decision authority allow it.

Residual unknowns must state:

- what remains unknown;
- why it was not resolved;
- possible impact;
- revalidation trigger;
- whether acceptance requires explicit acknowledgment.

---

## 11.4 Prohibited Behavior

Do not convert:

```text
UNKNOWN → VERIFIED
ASSUMED → VERIFIED
PROPOSED → VERIFIED
```

without new Evidence or authoritative confirmation.

---

# 12. Quality Contract Application Rules

A Quality Contract should be established before substantive research, architecture, or implementation for non-trivial work.

It should answer:

```text
How deep must this work go?
What Evidence is required?
Must sources be cross-validated?
Must alternatives be evaluated?
Must contradictory Evidence be sought?
What deterministic checks are mandatory?
Must trade-offs be explicit?
How must uncertainty be shown?
What does DONE mean for this task?
```

The Quality Contract is an Intelligence artifact.

Execution Evidence remains a Core concern according to the existing Brain vocabulary and architecture boundaries.

---

# 13. Proposed Additions to the Seed Skeleton

The existing seed skeleton is sufficient to establish the canonical quality dimensions, but it does not carry enough operational metadata to explain why a depth was selected or what artifact the Quality Contract applies to.

This version therefore proposes additive fields only.

The original fields and semantics remain unchanged.

Proposed additions include:

- `id`
- `version`
- `applies_to`
- `selection_rationale`
- `mandatory_depth_floor`
- `resource_constraints`
- `definition_of_done`
- `challenge.required`
- `verification.independent_review_required`
- `evidence.recency_required`
- `evidence.minimum_source_quality`

These additions make Quality Contracts auditable without replacing any canonical field from the seed skeleton.

---

# 14. Quality Architecture Exit Check

Before accepting work, verify:

- [ ] Depth was selected from risk, ambiguity, novelty, and irreversibility.
- [ ] Required Knowledge Gaps were identified.
- [ ] Research was scoped by decision impact.
- [ ] Evidence requirements were met.
- [ ] Required alternatives were considered.
- [ ] Required contradictory Evidence was sought.
- [ ] Deterministic QA ran before semantic review.
- [ ] Challenge protocol ran when required.
- [ ] Uncertainty and limitations are explicit.
- [ ] Definition of Done for the selected depth is satisfied.
- [ ] PASS is backed by Evidence rather than assertion.
