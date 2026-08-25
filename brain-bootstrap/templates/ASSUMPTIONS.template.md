# ASSUMPTIONS

> Record every material assumption used because verified or authoritative information is unavailable.

An assumption is temporary.

It must never silently become a fact merely because later work depended on it.

## 1. Assumption Register

### A-001 — `[short title]`

**Statement**

`[...]`

**Why this assumption is necessary**

`[...]`

**Information currently missing**

`[...]`

**Basis**

`PROVIDED_HINT | PRIOR_KNOWLEDGE | INFERENCE | TEMPORARY_WORKING_CHOICE | OTHER`

**Confidence**

`HIGH | MEDIUM | LOW`

Confidence does not convert the assumption into Evidence.

**Impact if wrong**

`LOW | MEDIUM | HIGH | CRITICAL`

**What would be affected**

- requirements: `YES / NO`
- architecture: `YES / NO`
- implementation: `YES / NO`
- security/risk: `YES / NO`
- delivery/schedule: `YES / NO`
- other: `[...]`

**How to validate**

`[...]`

**Who / what can validate it**

`[...]`

**Must be validated before**

`DISCOVERY EXIT | SPEC APPROVAL | ARCHITECTURE | BUILD | VERIFY | DELIVERY | OTHER`

**Status**

`OPEN | ACCEPTED_TEMPORARILY | VERIFIED | INVALIDATED | SUPERSEDED`

**Evidence if later verified**

`[...]`

**Superseded by**

`[...]`

## 2. Additional Assumptions

Repeat the same structure for:

```text
A-002
A-003
...
```

## 3. Assumption Risk View

| ID | Impact if Wrong | Confidence | Revalidate Before | Current Status |
|---|---|---|---|---|
| A-001 | `...` | `...` | `...` | `...` |

High-impact assumptions should be resolved earlier than low-impact assumptions where feasible.

## 4. Approval-Relevant Assumptions

Assumptions that the HUMAN APPROVAL gate must explicitly accept:

- `A-...`
- `A-...`

The approver must be shown the impact if these assumptions are wrong.

## 5. Invalidated Assumptions

Do not delete historical assumptions after they become false.

| ID | Invalidated By | Date / Run | Affected Work | Required Recovery |
|---|---|---|---|---|
| `...` | `...` | `...` | `...` | `...` |

## 6. Assumption Exit Check

- [ ] Are all material assumptions recorded?
- [ ] Is their impact if wrong explicit?
- [ ] Are high-impact assumptions scheduled for early validation?
- [ ] Has any assumption silently been treated as VERIFIED?
- [ ] Does any OPEN assumption now block responsible continuation?
- [ ] Do approval-relevant assumptions have an identified approver?
