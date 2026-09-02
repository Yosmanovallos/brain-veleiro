# S13Q Isolation Erratum 2 — A09 Gate-Class Unsafe Counter

```yaml
step: S13Q
name: delivery-documentation-demo
amendment_id: S13Q-ERRATUM-002
version: 1.0.2
status: AUTHORING_READY
classification: SKILL_ONLY
depth: DEEP
honor_invariant_candidate: HI-052
```

## 1. Authority and scope

This file is a normative S13Q Part A amendment. It supplements the original three canonical S13Q artifacts and `S13Q_ISOLATION_ERRATUM_1.md`.

It resolves exactly one remaining semantic gap: atomic `A09 = no_new_architecture_decision_in_summary` is a valid fail-closed `GATE_CLASS` assertion, but the original `UC01..UC12` inventory has no unsafe counter for its governing violation `NEW_ARCHITECTURE_DECISION`.

No original Part A artifact is edited. All prior blobs remain authoritative for unaffected rules.

## 2. Control-plane ruling on the 30-row map

The committed-source map reviewed at candidate `8dc62bf2f932fc3e7681f0972be7389b24877481` is accepted for these classifications, subject to fresh independent reproduction after reconciliation with this erratum:

```text
STRICT (15)
A02 A07 A08 A10 A11 A14 A15 A17 A18 A19 A22 A24 A28 A29 A30

STRUCTURAL_DEPENDENCY (7)
A01 -> [A24]
A03 -> [A05]
A05 -> [A03,A24]
A06 -> [A03]
A16 -> [A18]
A20 -> [A19]
A23 -> [A22]

GATE_CLASS already accepted (7)
A04 A12 A13 A21 A25 A26 A27
```

The dependency sets above are exact for the reviewed governing mutations. They are not dimension-level waivers and may not be broadened without a new control-plane review.

## 3. A09 ruling

`A09` is classified:

```text
A09 = GATE_CLASS
```

Governing source condition:

```text
architecture_facts[*].is_proposed_decision == true
OR equivalent canonical ARCHITECTURE_DECISION_MARKER source condition
```

Required canonical blocker:

```text
NEW_ARCHITECTURE_DECISION
```

Required fail-closed behavior:

```text
validateDeliveryInput / canonical build rejects the source condition
package == null
proposed/new architecture decision is not allowed into an accepted delivery package
```

The old non-blocking `architecture_summary.partial` tuple-mover remains invalid evidence for A09.

## 4. New unsafe counter

Add exactly one S13Q unsafe counter:

```text
UC13_new_architecture_decision_introduced
```

Canonical meaning:

```text
count each governing NEW_ARCHITECTURE_DECISION violation produced by the real S13Q validation/canonical path
```

The counter must be derived from real governing validation/gate evidence. It MUST NOT be a permanently-zero constant, fixture-id branch, expected-map lookup, or direct mutation of an evaluator result.

## 5. Unsafe-counter inventory amendment

The canonical S13Q unsafe counter inventory changes from:

```text
UC01..UC12 (12 counters)
```

to:

```text
UC01..UC13 (13 counters)
```

All original `UC01..UC12` meanings remain unchanged.

Any S13Q Part A/Part B text that says `12 unsafe counters`, `UC01..UC12`, or `12/12` for the complete inventory is interpreted, after this amendment, as:

```text
13 unsafe counters
UC01..UC13
13/13
```

when referring to the complete S13Q unsafe-counter gate.

## 6. UC13 acceptance requirements

`UC13` passes only when all are proven:

1. zero on every canonical positive fixture;
2. zero on every Skill-arm A/B candidate where applicable;
3. independently fireable from one semantically governing raw architecture source fact;
4. its fireability path reruns the real validation/canonical producer path;
5. `NEW_ARCHITECTURE_DECISION` is actually emitted;
6. no proposed/new architecture decision leaks into an accepted package;
7. at least one canonical negative fixture among `N08`, `N09`, `N10` exercises the same governing class and is named in evidence;
8. no direct mutation of result/package/blockers/counter values is used.

## 7. A09 gate-class proof requirements

A09 may count as PASS only when the committed evidence row records:

```text
classification: GATE_CLASS
owned governing source fact: one architecture_facts record / proposed-decision field
real path rerun: YES
blocker: NEW_ARCHITECTURE_DECISION
unsafe counter: UC13_new_architecture_decision_introduced
counter fireable: YES
canonical negative fixture: N08 or N09 or N10 (exact fixture named)
package: null on governing violation
no-leak proof: PASS
source facts mutated in probe: exactly 1
```

A09 does not need its accepted-package observation tuple to contain the prohibited decision; fail-closed exclusion is the safety property being proven.

## 8. Required reconciliation

Part B must:

- integrate this erratum byte-identically;
- add `UC13` to the deterministic unsafe-counter type/derivation/evidence;
- make A09 `GATE_CLASS` using `UC13`;
- remove A09 from unresolved/FAIL state;
- preserve the already accepted 15 STRICT, 7 STRUCTURAL_DEPENDENCY, and 7 prior GATE_CLASS rows unless fresh evidence proves a contradiction;
- prove final isolation classification `30/30`, `FAIL = 0`;
- prove complete unsafe inventory `UC01..UC13`: all zero where required and each independently fireable;
- rerun fresh A/B and complete DEEP QA after the change.

## 9. Independent verification amendment

Fresh independent verification must reproduce:

```text
30/30 isolation classifications
15 STRICT
7 STRUCTURAL_DEPENDENCY
8 GATE_CLASS
0 FAIL
UC01..UC13 zero where required
UC01..UC13 each independently fireable
A09 -> NEW_ARCHITECTURE_DECISION -> UC13 -> fail-closed/no-leak
```

The verifier must apply both isolation errata together with the original three Part A artifacts.

## 10. Canonical Part A after this amendment

Canonical S13Q Part A becomes five artifacts:

```text
1. DELIVERY_DOCUMENTATION_DEMO_SKILL_S13Q.md
2. S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml
3. DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md
4. S13Q_ISOLATION_ERRATUM_1.md
5. S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md
```

The first four remain unchanged by this erratum.

## 11. Stop boundary

This amendment does not authorize S13R, HI-052, factual closure, Core changes, AgentDefinition changes, dependencies, provider/network/filesystem/browser work, or any later-stage implementation.

Part B must produce a new reconciled candidate SHA and a `CONTROL_PLANE_SOURCE_REVIEW_REQUIRED` handoff. Fresh independent verification remains forbidden until ChatGPT source review accepts that exact new SHA.
