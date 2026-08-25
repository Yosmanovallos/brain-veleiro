# SPEC

> Formal description of what must be achieved.  
> Do not encode implementation choices unless they are confirmed requirements or constraints.

## 1. Metadata

**Spec ID:**  
`[SPEC-...]`

**Title:**  
`[short descriptive title]`

**Status:**  
`DRAFT | READY_FOR_APPROVAL | APPROVED | APPROVED_WITH_ASSUMPTIONS | CHANGES_REQUIRED`

**Owner / Requester:**  
`[...]`

**Decision Authority:**  
`[...]`

**Created:**  
`[...]`

**Last Updated:**  
`[...]`

## 2. Objective

### Problem

What verified or stakeholder-provided problem is this work intended to solve?

`[...]`

### Desired Outcome

What state should be true after successful completion?

`[...]`

### Why It Matters

What business, user, operational, or technical outcome makes this work valuable?

`[...]`

## 3. Scope

### In Scope

- `[...]`
- `[...]`

### Explicit Non-Goals

- `[...]`
- `[...]`

Non-goals are intentionally excluded from this Spec and must not be silently introduced during implementation.

## 4. Stakeholders

| Stakeholder / Role | Need / Responsibility | Authority |
|---|---|---|
| `...` | `...` | `...` |

## 5. Requirements

Each requirement should describe **what must be true**, not how it must be implemented unless implementation itself is a confirmed constraint.

### Functional / Behavioral Requirements

#### R-001 — `[requirement title]`

**Requirement:**  
`[...]`

**Source:**  
`RAW REQUEST | DISCOVERY | RESEARCH | RULE | OTHER`

**Priority:**  
`REQUIRED | SHOULD | OPTIONAL`

#### R-002 — `[requirement title]`

**Requirement:**  
`[...]`

**Source:**  
`[...]`

**Priority:**  
`[...]`

### Non-Functional Requirements

Include only when relevant.

Examples of categories—not mandatory requirements—may include:

- reliability;
- performance;
- security;
- privacy;
- accessibility;
- maintainability;
- auditability;
- cost;
- latency;
- operational constraints.

#### NFR-001 — `[title]`

**Requirement:**  
`[...]`

**Source:**  
`[...]`

## 6. Constraints

| ID | Constraint | Source | Status |
|---|---|---|---|
| C-001 | `...` | `...` | `VERIFIED / PROVIDED / ASSUMED` |

## 7. Assumptions in Force

| Assumption ID | Statement | Impact if Wrong | Revalidation Required Before |
|---|---|---|---|
| A-001 | `...` | `...` | `...` |

No hidden assumptions are permitted.

## 8. Acceptance Criteria

### AC-001

**Related requirement:**  
`R-...`

**Success condition:**  
`[...]`

**Verification approach:**  
`[...]`

**Evidence expected:**  
`[...]`

### AC-002

**Related requirement:**  
`R-...`

**Success condition:**  
`[...]`

**Verification approach:**  
`[...]`

**Evidence expected:**  
`[...]`

## 9. Open Questions

| ID | Question | Owner | Impact | Deadline / Revalidation Point |
|---|---|---|---|---|
| Q-001 | `...` | `...` | `...` | `...` |

If an unanswered question can materially invalidate the Spec, return it to KNOWLEDGE GAPS or mark the Spec BLOCKED.

## 10. Quality Contract Reference

**Applicable Quality Contract / Level:**  
`[...]`

**Reason selected:**  
`[...]`

The detailed Quality Contract schema and depth/risk model are defined separately.

## 11. Evidence / Research References

| ID | Claim / Decision Supported | Evidence / Knowledge Reference | Status |
|---|---|---|---|
| E-001 | `...` | `...` | `VERIFIED / PROVIDED / ASSUMED` |

## 12. Approval

### Approval Decision

`PENDING | APPROVED | APPROVED_WITH_EXPLICIT_ASSUMPTIONS | CHANGES_REQUIRED | BLOCKED`

### Approver

`[...]`

### Approval Date

`[...]`

### Conditions / Notes

`[...]`

### Assumptions Explicitly Accepted

- `A-...`

## 13. Traceability Check

- [ ] Every required behavior has a Requirement ID.
- [ ] Every critical requirement has verifiable Acceptance Criteria.
- [ ] Constraints have sources.
- [ ] Assumptions are explicit.
- [ ] Critical unknowns have not been hidden as assumptions.
- [ ] Non-goals are explicit.
- [ ] No architecture was selected merely because it is familiar.
- [ ] Quality Contract is referenced.
- [ ] Human approval authority is identified.
