# S13Q Isolation Erratum 1 — Canonical Part A Amendment

```yaml
step: S13Q
name: delivery-documentation-demo
amendment_id: S13Q-ERRATUM-001
version: 1.0.1
status: AUTHORING_READY
classification: SKILL_ONLY
depth: DEEP
honor_invariant_candidate: HI-052
```

## 1. Authority and scope

This file is a **normative canonical Part A amendment** for S13Q. It exists because Part B discovered a real semantic contradiction between strict single-observation isolation and the fail-closed / producer-coupled delivery model.

It supplements these canonical base artifacts, which remain byte-identical and authoritative for every unaffected rule:

```text
brain-bootstrap/skills/DELIVERY_DOCUMENTATION_DEMO_SKILL_S13Q.md
blob 1198834124dc32c34721130566efdc5fda78465f

brain-bootstrap/quality-contracts/S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml
blob 5f931e5372ff0319eee6e86fe0a1879c0300153f

brain-bootstrap/specs/DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md
blob 6d7078633c1d0a90e8204a277de6100ed517a112
```

This erratum supersedes only the conflicting isolation language in:

```text
Skill Verification: "prove single-observation isolation"
Quality Contract: source_fact_isolation.rule
Semantic Contract §21 Atomic quality model
```

All other S13Q Part A semantics, fixtures, counts, thresholds, boundaries, anti-gaming rules and HI-052 rules remain unchanged.

For purposes of S13Q verification, this erratum is part of the semantic contract.

## 2. Why the amendment exists

A real canonical producer may cause one governing source fact to fan out into more than one derived atomic observation. A fail-closed validation gate may also reject prohibited source material before a package-level observation can ever contain that material.

Therefore S13Q MUST prove **causal source ownership**, not artificial one-cell independence.

The goal remains strict:

```text
real underlying source/input/evidence/audit fact
→ real canonical producer / validation / gate
→ actual post-gate decision
→ real atomic evaluator
```

The amendment does **not** permit direct mutation of derived observations, result objects or correctness cells.

## 3. One shared raw-source model

Every isolation probe MUST start from one detached shared raw source model containing only canonical input facts plus explicit evaluation/audit facts when an assertion genuinely governs evaluator state.

Allowed raw source families are bounded to canonical S13Q inputs/audit evidence, including:

```text
delivery_identity
repository_facts
verification_evidence
demo_surface
architecture_facts
limitations
next_step_candidates
evidence_refs
policy
explicit candidate/gate/protected-surface audit facts
```

The shared raw source MUST NOT contain a separately mutable canonical result such as:

```text
DeliveryDocumentationDemoResult
package
coverage
blockers
warnings
expected_observation
actual_observation
correct
```

A probe may freeze those values for before/after comparison, but may not mutate them as the source action.

## 4. Governing-source semantic rule

A source mutation counts only when it targets the **semantic property named by the atomic assertion**.

Changing any arbitrary field that happens to appear in an observation tuple is invalid.

Examples:

```text
A09 no_new_architecture_decision_in_summary
→ must probe a real proposed/new architecture-decision source condition or its canonical gate path;
  removing an unrelated boundary merely to move `partial` is not valid A09 evidence.

A13 demo_surface_exists
→ must probe the existence/revision support of the declared demo surface;
  deleting a demo sub-step merely to change script length is not valid A13 evidence.

A03 implemented_verified_available_deferred_states_not_conflated
→ must probe claim-state derivation/precedence;
  renaming an unrelated subject only to move the tuple is not valid A03 evidence.
```

This rule applies to all A01..A30.

## 5. Isolation proof classes

Every A01..A30 MUST be classified as exactly one of:

```text
STRICT
STRUCTURAL_DEPENDENCY
GATE_CLASS
FAIL
```

No other class is allowed.

### 5.1 STRICT

`STRICT` requires all of:

1. freeze the original shared raw source;
2. freeze the original actual candidate/post-gate decision;
3. clone the shared raw source;
4. mutate exactly one governing underlying source fact;
5. rerun the real canonical producer/validation/gate/evaluator;
6. recompute all 30 atomic observations from the same rebuilt run;
7. the governing Axx observation changes;
8. no other Axx observation changes;
9. original source and original decision remain unchanged;
10. no expected/result/correctness cell is directly mutated.

### 5.2 STRUCTURAL_DEPENDENCY

`STRUCTURAL_DEPENDENCY` is allowed only when the canonical producer graph necessarily fans one semantically governing source fact into the governing atomic plus one or more other atomic observations.

It requires all STRICT conditions except item 8, replaced by:

```text
changed atomics == { governing Axx } ∪ exact minimal declared dependent set
```

The dependency set MUST:

- be minimal and exact for the governing mutation used;
- be justified by specific producer equations/lines or equivalent deterministic source evidence;
- contain no dimension-wide blanket waiver;
- contain no conservative superset merely because another branch might also move;
- be proposed in committed Part B source/evidence;
- be reviewed and explicitly accepted by ChatGPT control-plane before fresh independent verification may treat it as PASS.

An undeclared or over-broad cross-atomic change is `FAIL`.

This erratum replaces the Quality Contract phrase `unless the semantic contract explicitly declares a dependency` with this explicit dependency-approval protocol.

### 5.3 GATE_CLASS

`GATE_CLASS` is reserved for an atomic whose **semantically governing prohibited source condition is intentionally fail-closed before the derived package observation can contain that condition**.

A gate-class proof requires all of:

1. mutate exactly one governing raw source fact;
2. rerun the real validation / canonical producer / candidate gate path;
3. prove the expected governing blocker or rejection signal fires;
4. prove the corresponding unsafe counter is independently fireable;
5. prove the prohibited material does not leak into the accepted package/output;
6. prove the named canonical negative fixture exercises the same governing condition;
7. prove no derived decision/package/coverage/blocker/warning was directly mutated;
8. control-plane explicitly accepts that Axx as gate-class before independent verification treats it as PASS.

A gate-class atomic does not need its package-level observation to change if the whole point of the gate is to prevent the prohibited material from entering that observation.

Gate-class is a narrow safety exception, not a convenience for difficult isolation.

### 5.4 FAIL

Any of the following is `FAIL`:

```text
direct expected_observation mutation
direct actual_observation mutation
direct correct/result mutation
direct decision/package/coverage/blockers/warnings mutation
more than one independent source fact mutated in one probe
semantically irrelevant source mutation chosen only to move the tuple
fixture/scenario/arm-specific source choice
no real producer/gate/evaluator rerun
undeclared structural cross-change
over-broad dependency superset
dimension-level blanket waiver
silent no-op source mutation
```

## 6. Exactly one governing source fact

`exactly one governing source fact` means one existing canonical fact record or one explicit audit fact.

A single probe MUST NOT add one repository/evidence fact **and** edit another independent fact merely to force an assertion to move.

If an atomic can move only by coordinating multiple independent source facts, the builder MUST stop and report a remaining semantic gap rather than calling that one-fact isolation.

## 7. Dependency-map ruling requirements

Before a fresh verifier is authorized, the builder/control-plane source review MUST produce an exact table:

```text
Axx
classification = STRICT | STRUCTURAL_DEPENDENCY | GATE_CLASS
owned governing source fact
semantic reason the mutation governs that atomic
fresh producer/gate/evaluator rerun evidence
measured changed atomic set
exact declared dependent set (STRUCTURAL_DEPENDENCY only)
producer forcing evidence (STRUCTURAL_DEPENDENCY only)
blocker + counter + negative fixture evidence (GATE_CLASS only)
```

For `STRUCTURAL_DEPENDENCY`, measured changed set and declared dependent set MUST match exactly after including the governing Axx.

For `GATE_CLASS`, the control-plane must accept the exact Axx classification explicitly.

## 8. Anti-tautology regressions

S13Q MUST mechanically prove all of these are rejected as valid isolation evidence:

```text
1. mutating expected_observation directly;
2. mutating derived decision/package/coverage/blockers/warnings directly;
3. mutating a semantically unrelated raw source field merely because the observation tuple changes;
4. mutating two independent raw source facts in one probe while claiming one-fact isolation.
```

At least one positive STRICT probe, one accepted STRUCTURAL_DEPENDENCY probe when such dependencies exist, and one accepted GATE_CLASS probe when such classes exist MUST demonstrate the corresponding valid path.

## 9. Skill verification wording amendment

The Skill verification requirement:

```text
prove single-observation isolation
```

is replaced by:

```text
prove one-governing-source causal isolation for A01..A30 using STRICT evidence where possible,
exact minimal control-plane-approved STRUCTURAL_DEPENDENCY closure only where the canonical producer necessarily fans out,
and control-plane-approved GATE_CLASS evidence only for fail-closed safety invariants.
No direct derived-result mutation or semantically irrelevant probe counts.
```

## 10. Semantic Contract §21 amendment

Semantic Contract §21 is amended to read, in effect:

```text
Every atomic must be causally derived from its semantically governing underlying source/input/evidence/audit fact.
Isolation proof MUST mutate exactly one governing source fact and rerun the real producer/validation/gate/evaluator.
STRICT is the default.
STRUCTURAL_DEPENDENCY is allowed only under the exact minimal dependency protocol in this erratum.
GATE_CLASS is allowed only for control-plane-approved fail-closed safety invariants under this erratum.
All direct derived-result mutations and semantically irrelevant probes are forbidden fake isolation.
```

## 11. Quality Contract source_fact_isolation amendment

The original count remains:

```text
count: 30
```

All 30 A01..A30 still require evidence.

Passing the 30/30 gate now means:

```text
for every Axx:
  classification != FAIL
  governing source mutation is semantically valid
  real canonical path is rerun
  no forbidden direct result mutation occurs
  any structural dependency is exact/minimal and control-plane-approved
  any gate-class classification is control-plane-approved and backed by blocker + counter + negative fixture
```

## 12. A/B impact gate unchanged

The 12-scenario Skill-vs-no-Skill gate is unchanged.

After any isolation implementation change, the builder and fresh verifier MUST recompute the A/B run from scratch through:

```text
S12
→ S10
→ S09
→ actual parsed candidate
→ deterministic actual-candidate gate
→ post-gate decision
→ deterministic evaluator
```

Previous totals may be reproduced, but MUST NOT be assumed or carried forward without a fresh run.

## 13. Part A integrity after amendment

Canonical S13Q Part A becomes:

```text
1. DELIVERY_DOCUMENTATION_DEMO_SKILL_S13Q.md                 (unchanged original blob)
2. S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml               (unchanged original blob)
3. DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md             (unchanged original blob)
4. S13Q_ISOLATION_ERRATUM_1.md                              (this amendment)
```

The original three blobs MUST remain unchanged.

Independent verification MUST verify all four artifacts and must apply this erratum when interpreting isolation evidence.

## 14. Stop boundary

This amendment does NOT authorize S13R, HI-052, closure, Core changes, AgentDefinition changes, new dependencies or any future-stage implementation.

Part B must be repaired/reconciled to this amendment, produce a new candidate SHA, receive committed-source control-plane review, then pass a DIFFERENT fresh non-authoring, non-fork, read-only independent verification before HI-052 can be considered.
