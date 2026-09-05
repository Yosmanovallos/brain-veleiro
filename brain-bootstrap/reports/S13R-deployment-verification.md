# S13R Deployment — Builder Verification

Status: `BUILDER PASS (round 2) / INDEPENDENT VERIFICATION REQUIRED`

Branch: `codex/s13r-deployment-part-b`. Candidate at this report: HEAD of that
branch (round-2 fix commit, on top of the round-1 candidate `81b98a1`).

> **Continuity note.** Part A (Skill, Quality Contract, Semantic Contract) and
> the first Part B implementation (`deploymentModel.ts`, `quality.ts`,
> `deploymentSkill.ts`, `planDeployment.ts`, fixtures, and 58 focused tests)
> were authored in an earlier session on this branch (commits `be77b4c`,
> `d8262ed`, `eb21bad`). That session left one item open: the quality
> contract's `atomic_isolation_exact: 30` requires 30 real source-fact isolation
> probes, and only one demonstrative probe existed (`RUNTIME_VERSION`, showing
> 23/30 coupled — a finding, not a result). A later session (this report,
> round 1) completed that item and committed `81b98a1`.

## Round 1 independent verification: FAIL (superseded by round 2 below)

A fresh, non-authoring, non-fork verifier (a different process from the one
that produced `81b98a1`, given none of that session's reasoning) inspected
`81b98a1` against baseline `56770fc` and returned **STATUS: FAIL**. Summary of
its finding (full defect text preserved for the record):

> **A22 ≡ A23 are the identical expression, not two distinct atomic
> assertions.** `quality.ts` read `d.provider_mapping` for both slots, and
> `DeploymentDecision` carried exactly one provider-identity field, so the two
> were mathematically forced to agree on every possible input, not merely
> coincidentally correlated in the fixture set. Collapsing the duplicate
> signal makes D08 have only 1 distinct non-zero contributor
> (`{A22≡A23:1, A24:0}`), which fails the `>=2 distinct improved assertion
> IDs` qualification rule → D08 does not qualify → `qualified_dimensions`
> drops from the reported 7 to **6**, below the contractual floor of 7.

The verifier also surfaced two non-blocking items, addressed below: (a) the
isolation test only pinned classification *counts*, not exact id-sets, so a
probe that mutated the wrong fact could in principle silently reclassify into
a different bucket undetected; (b) `main`'s Part A (`d8262ed`) and this
branch's Part A (`be77b4c`) are two different, both-legitimate ChatGPT
authoring-gate transfers, which is a control-plane reconciliation question,
not a Part B defect — it is flagged here for the control plane, not resolved
by this builder.

## Round 2 fix

`A22` (`provider.default_neutrality_result`) and `A23`
(`provider.authority_binding_result`) are contractually distinct field
families (`S13R_DEPLOYMENT_DEEP.yaml` lines 197–198); the implementation must
carry two genuinely distinct decision-content signals, not one. Fix:

- Added `provider_authority_ref: string | null` to `DeploymentDecision`
  (`types.ts`) — echoes back `input.provider_authority?.decision_ref`,
  `null` when neutral. This is a Part B implementation addition, not a Part A
  edit: the semantic contract's §12 "protected claims" already lists
  "provider authority" as one concept; representing it as *which provider*
  (`provider_mapping`) plus *which decision authorized it*
  (`provider_authority_ref`) is a more faithful realization of that same
  protected claim, not a new one. `deploymentModel.ts`'s `blockedDecision`
  and `buildDeploymentDecision` set it accordingly; the independent test-side
  `deploymentProvider.ts` (the A/B visible-packet mock) was updated in
  lockstep so both arms' candidates stay structurally comparable to the real
  decision.
- `A22` now reads `provider_mapping`; `A23` now reads `provider_authority_ref`
  — genuinely different fields.
- Redesigned the A23/A24 probes so the independence is *proven*, not just
  declared: A23's probe renames only `decision_ref` (provider name
  unchanged) — its measured cross-set does **not** include A22. A24's probe
  renames only the provider name (`decision_ref` unchanged) — its cross-set
  includes A22 but not A23. A22's own probe (binding authority from nothing)
  still moves both, since both facts are set at once on first bind — that
  residual pairing is now a real, asymmetric structural relationship, not a
  forced identity.
- Closed the harness gap: the isolation test now pins the **exact id set**
  of all four classification buckets (`idsOf("STRICT")`, etc.), not just
  their counts, so a probe drifting to the wrong bucket fails the test even
  if the totals still sum to 30. Added explicit asserts that A23's
  `changed_assertions` excludes A22 and A22's includes A23, so the
  asymmetry itself is regression-tested.

Re-measured after the fix: **D08 contributions unchanged** (`{A22:1, A23:1,
A24:0}`, share `0.5`, qualified) — because A22/A23 already moved together on
the 10 canonical A/B fixtures' only provider-bearing case (binding from
neutral, `FX-POS-006`); the fix makes that pairing *true by measurement*
instead of *true by construction*. `qualified_dimensions` is still **7**, but
now for the reason the contract intends: two real, distinct signals both
happened to improve together, not one signal double-counted under two
names. Full re-verification below.

## Outcome

S13R Part B is a pure, deterministic Intelligence reference module that turns
verified repository facts, evidence and policy into a bounded, honest
deployment assessment (identity binding, entrypoint eligibility, build/runtime
contract, Docker-first container plan, environment/secret allowlist, health
plan, persistence plan, provider mapping, and evidence-gated
READY/PARTIAL/BLOCKED status) — reachable through the real S12 → S10 → S09
path and gated by a deterministic recomputation of the canonical decision. The
canonical current-repo positive (`FX-POS-001`) proves the module refuses to
manufacture deployability for a library with no entrypoint. No Core,
AgentDefinition, dependency, provider SDK/vendor binding, Docker daemon,
network, filesystem, clock or randomness surface was introduced.

**Work across both rounds**: redesigned the 30-slot atomic observation vector
to remove five coupling defects (four in round 1; the fifth, introduced by
round 1's own fix, found by the round-1 fresh verifier and fixed in round 2),
then built and ran a real 30-probe one-owned-source-fact isolation registry
(one probe per atomic, each mutating exactly one raw input/source/evidence
fact and recomputing the real decision). Everything else in the prior
implementation is unchanged.

HI-053 is **not** awarded by this builder and `S13R` remains not
`VERIFIED PASS`. A fresh non-authoring, non-fork, read-only verifier must
independently reproduce the evidence below next, per contract §24.

## Canonical Part A integrity

No Part A file was touched in round 1 or round 2 (`git diff` against the
three artifacts below, at any commit on this branch since `be77b4c`, is
empty):

| Artifact | Git blob (this branch) |
|---|---|
| `brain-bootstrap/skills/DEPLOYMENT_SKILL_S13R.md` | `b1b7f81fba7762ced07bcbd034a4a61be682efdf` |
| `brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml` | `d606ac01bdc21129fb21b5ca0aff0b6e57ccf29f` |
| `brain-bootstrap/specs/DEPLOYMENT_CONTRACT_S13R.md` | `4a513c9063c4985ed375c3fcc7c6c979280e7bf6` |

### Disclosed, not resolved: this branch's Part A differs from `main`'s

The round-1 fresh verifier found that `main`/`origin/main` (`d8262ed`) carries
a *different* set of blob hashes for these same three files than this branch
does (confirmed again here: `main:...DEPLOYMENT_SKILL_S13R.md` is
`7f41d7935906095ab9a9ec44633035a8f42e7d55`, not `b1b7f81f...`; similarly for
the other two). The verifier traced this branch's version (`be77b4c`) to a
second, later ChatGPT authoring-gate transfer
(`origin/chatgpt-authoring/s13r-20260902-034300z`) and confirmed it is a
legitimate authoring-gate output, not a fabricated or tampered rewrite — but
`be77b4c`'s commit message does not cite that authority the way `d8262ed`'s
does, and `main` and this branch now disagree on which Part A is canonical.
This builder does not resolve which Part A is authoritative — that is a
control-plane reconciliation question (which of the two authoring-gate
transfers supersedes the other, and whether `main` needs to fast-forward or
this branch needs to rebase onto `main`'s version before merge) — and is
surfaced here rather than adjudicated.

## Full diff across both rounds

Contained to five files total:

- `src/intelligence/deployment/quality.ts` — rewrote `deploymentObservations`
  (30 slots, redesigned; see below); widened `evaluateDeploymentAtomic` to pass
  `input` through (needed for A28); added `globalMaxAssertionShare` to
  `compareDeploymentRuns`; added `buildDeploymentIsolationRegistry` (30 probe
  specs) and `runDeploymentIsolationMatrix` (runs and classifies them).
- `tests/deployment/deployment.test.ts` — replaced the single demonstrative
  isolation test with the full 30-probe matrix test, a mechanical
  anti-tautology guard on the STRICT bucket, and (round 2) exact id-set pins
  for all four classification buckets plus the A22/A23 asymmetry asserts.
- `tests/deployment/fixtures.ts` — added `providerInput`, `persistentLocalInput`,
  `readinessOptionalInput` isolation bases; enriched `FX-POS-004` with a
  second, absent-presence secret reference (its own canonical intent is
  plural: "sensitive *references*").
- `src/intelligence/deployment/types.ts` (round 2) — added
  `provider_authority_ref: string | null` to `DeploymentDecision`.
- `src/intelligence/deployment/deploymentModel.ts` (round 2) — set the new
  field in `blockedDecision` (`null`) and `buildDeploymentDecision`
  (`input.provider_authority?.decision_ref ?? null`).
- `tests/deployment/deploymentProvider.ts` (round 2) — mirrored the new field
  in the independent A/B visible-packet provider mock, gated by the same
  `method.provider` concept flag as `provider_mapping`.

No change to `deploymentSkill.ts`, `planDeployment.ts`, or `constants.ts` in
either round.

## Observation-vector defects found and fixed

The prior `deploymentObservations` had five coupling defects that made
isolation impossible to demonstrate honestly — four found and fixed in round
1, one (A22/A23) found by the round-1 independent verifier and fixed in round
2:

1. **A12 ≡ A29** — both read `d.container_plan?.dockerfile`, the identical
   expression. Any dockerfile-affecting mutation moved both; neither could
   ever be independent. Fixed: A12 now reads `container_plan.artifacts`
   (added build artifact); A29 now reads `evidence_refs` (the deduped fact-id
   ledger).
2. **A26 ⊂ A01** — A01 read `[project_ref, revision_ref]`; A26 read
   `revision_ref` alone, a strict subset of A01's own tuple. Fixed: A01 now
   reads `project_ref` only; A26 now reads whether `DEPLOYED_REVISION_OBSERVED`
   is in `accepted_evidence_ids`.
3. **A03 ⊂ A25** — A25 read the *entire* `deployment_verification` object,
   which contains everything A03 (`accepted_evidence_ids`) reads. Fixed: A25
   now reads a scoped blocker flag; A03 reads whether `DEPLOYED_SMOKE_PASS`
   is accepted.
4. **A22 → unbounded via A23** — A23 read
   `provider_mapping === "PROVIDER_NEUTRAL" ? null : evidence_refs`, so *any*
   unrelated new fact anywhere in the input moved A23 whenever a provider was
   bound. Round-1 fix: A23 read `provider_mapping` directly — the same field
   as A22. This was itself defect 5, caught by the round-1 fresh verifier,
   not by this builder.
5. **A22 ≡ A23** (round-1 fresh-verifier finding; fixed round 2) — the
   round-1 fix for defect 4 replaced an unbounded-aggregate bug with an
   exact-duplicate bug: both slots read the literal same expression, and
   `DeploymentDecision` had only one field to read. Fixed by adding
   `provider_authority_ref` (see Round 2 fix above) so A22/A23 are
   genuinely distinct, asymmetric signals.

## The 30-probe isolation registry

`buildDeploymentIsolationRegistry` + `runDeploymentIsolationMatrix`
(`src/intelligence/deployment/quality.ts`) implement one probe per atomic:
pick a valid base input (`baseInput`, `workerInput`, or one of three new
purpose-built bases), mutate exactly one owned source fact via
`probeDeploymentIsolation` (freeze the real candidate, mutate a clone, recompute
the real `buildDeploymentDecision`), and record which of the 30 observation
slots actually differ. Classification is derived from the measurement, never
declared:

- **STRICT** — only the intended assertion moved (mod. the A28 exemption
  below). 15/30: A01, A02, A03, A05, A07, A08, A09, A10, A11, A17, A18, A19,
  A26, A27, A29.
- **STRUCTURAL_DEPENDENCY** — a small, mechanically-explained cross-set.
  11/30: A04, A12, A13, A14, A15, A16, A20, A21, A22, A23, A28.
- **GATE_CLASS** — the mutation collapses `status` to `BLOCKED`, nulling every
  substructure uniformly. 2/30: A06, A25.
- **INVARIANT_STABLE** — the atomic's own signal never moves under its probe
  (an absence/order invariant, proved stable through a real, otherwise-
  effective mutation). 2/30: A24, A30.

15 + 11 + 2 + 2 = 30/30, matching `atomic_isolation_exact: 30`. Full measured
matrix (`S13R_ISOLATION_30`) and summary (`S13R_ISOLATION_SUMMARY`) are printed
by the isolation test; reproduced here:

```
STRICT(15): A01→[A28] A02→[A28] A03→[A28] A05→[A28] A07→[A28] A08→[A28]
            A09→[A28] A10→[A28] A11→[A28] A17→[A28] A18→[A28] A19→[A28]
            A26→[A28] A27→[A28] A29→[A28]
STRUCTURAL_DEPENDENCY(11):
  A04→[A28,A29]  A12→[A28,A29]  A13→[A28,A29]  A14→[A28,A29]  A15→[A28,A29]
  A16→[A28,A29]  A20→[A28,A29]  A21→[A28,A29]  A22→[A23,A28,A29]
  A23→[A28,A29]  A28→[A29]
GATE_CLASS(2):  A06, A25 (each collapses ~20 other slots to their BLOCKED
  default; the full lists are in S13R_ISOLATION_30)
INVARIANT_STABLE(2):  A24→[A22,A28] (own signal stays 0; does not move A23)
                       A30→[] (own signal stays 0, and moves nothing else)
```

Note the asymmetry proving A22/A23 are genuinely distinct (round 2): A22's
own probe moves A23 (binding sets both facts at once), but A23's own probe
does **not** move A22 (renaming only `decision_ref` leaves `provider_mapping`
untouched), and A24's probe moves A22 but not A23 (renaming only the
provider name leaves `provider_authority_ref` untouched). If A22 and A23
still read the same field, A23's probe would have to move A22 too — it does
not, which is the regression test now in place.

### Why A28 is exempted from every other atomic's cross-set — and why that's not amnesty

A28 (`deterministic.candidate_gate_result`) is defined as
`validateDeploymentCandidate(decision, input).valid` — is the frozen candidate
still canonically identical to a fresh recompute from the (possibly mutated)
input. By construction, *any* real decision-content change invalidates a
stale candidate, so A28 is the one assertion that is supposed to be universally
sensitive (that is its entire purpose: detect drift). Treating its tag-along
presence as unintended coupling would make the STRICT bucket permanently empty
regardless of how clean every other slot is.

This is not a blanket carve-out: `runDeploymentIsolationMatrix` only drops A28
from the *cross-set used for classification*; A28's own row still reports its
full, real cross-set (`[A29]`, from the one inert fact both probes add). The
test adds a mechanical guard (`deployment.test.ts`, "A28 blanket exemption is
a narrow, measured carve-out") asserting that every STRICT entry's *raw,
pre-exemption* `changed_assertions` is exactly `{self, A28}` — nothing else
was waved through. A30 is the independent negative control: its reorder-only
mutation is a genuine no-op (fact/evidence lookups are order-independent and
every order-sensitive projection is explicitly `.sort()`ed), and its measured
cross-set is empty, including A28 — proving the exemption tracks a real
causal property, not a name-based bypass.

### The STRUCTURAL_DEPENDENCY → A29 pattern (9 of 11 entries)

A04, A12, A13, A14, A15, A16, A20, A21, and (round 2) A23 each *bind a new
reference* (an alternate entrypoint, a second build artifact, a rebound
provenance/secret reference, a relocated writable path, a rebound provider
decision) and each such binding requires a *new* backing `repository_fact`.
`evidence_refs` (A29) is the deduped fact-id ledger over the whole input, so
any new fact_id necessarily moves it too. This is one mechanical reason, not
nine separate ones. A22 also binds a new reference (the provider authority,
via a new `PROVIDER_DECISION` fact on first bind) and so also carries `A29`.
The remaining two entries, A22 ↔ A23 and A28 ↔ A29, are declared separately
below (A28↔A29 is the mutual pair from each other's own dedicated probe, not
the new-reference pattern).

### A22 / A23 — genuinely distinct signals with one real, asymmetric pairing

A22 (`default_neutrality`) reads `d.provider_mapping`; A23
(`authority_binding`) reads `d.provider_authority_ref` (added round 2,
mirroring `input.provider_authority?.decision_ref`) — two different fields on
`DeploymentDecision`, satisfying the contract's two distinct field families
(`S13R_DEPLOYMENT_DEEP.yaml` lines 197–198). Three probes establish the
relationship is real structure, not a relabeled duplicate: A22's own probe
(bind authority from nothing) moves both, because binding sets `provider` and
`decision_ref` at once; A23's own probe (rename `decision_ref` only, same
`providerInput()` base) moves only A23, `provider_mapping` untouched; A24's
own probe (rename the provider name only, same base, same `decision_ref`)
moves A22 but not A23, and separately proves the adapter-key boundary
(`Object.keys(d)` matching `/adapter/i`) stays at 0 even while provider
identity legitimately changes (`INVARIANT_STABLE`, not a bug). The asymmetry
between A22's probe (moves A23) and A23's probe (does not move A22) is the
proof: a genuine duplicate expression would move both, both directions,
always. `deployment.test.ts` asserts this asymmetry directly.

### GATE_CLASS: A06 and A25

A06 removes the `ENTRYPOINT` fact entirely; A25 breaks `BUILD_PASS`'s
`subject_ref` (an unconditionally-required evidence kind). Both are
`deriveDeploymentFacts` conditions that, on failure, return
`blockedDecision(...)`, which nulls every decision substructure uniformly
regardless of which single check fired. There is no valid non-blocking
alternative for either check (existence/required-evidence-sufficiency are
inherently all-or-nothing in this model), so both are genuinely GATE_CLASS,
each attributable to exactly one blocker code (`BLOCKED_NO_DEPLOYABLE_ENTRYPOINT`
for A06, `DEPLOYMENT_EVIDENCE_INSUFFICIENT` for A25 — confirmed disjoint by
measurement). Per contract §14 ("if one source fact structurally governs
multiple assertions, any dependency must be explicit in test evidence"), this
is that explicit test evidence; no edit to the semantic contract was needed or
made.

**Implementation pitfall found and fixed during this work**: the first attempt
mutated `revision_ref` on `DEPLOYED_SMOKE_PASS` / `DEPLOYED_REVISION_OBSERVED` /
`BUILD_PASS` / `READINESS_PASS` evidence to test A03/A25/A26/A27. All four
actually tripped `deriveDeploymentFacts`'s unconditional
`REVISION_IDENTITY_CONFLICT` check (line 71, `!revisionAllowed`, which applies
to *every* evidence entry regardless of whether that evidence kind is later
exempted from the required-evidence block) — collapsing to full `BLOCKED`
instead of the intended narrow, non-blocking evidence-acceptance signal. Fixed
by mutating `subject_ref` instead (checked only by `evidenceAccepted`, not by
the earlier identity-conflict gate). This was only found by running the actual
probes, not by paper analysis of the model — a genuine trap in the ledger of
"which single-fact break stays inside its own blast radius."

## Skill-vs-no-Skill (re-measured after the round-2 fix)

Same 10 canonical positive fixtures, same materialized S12 → S10 → S09 path,
same visible-packet `DeploymentProvider` (`tests/deployment/deploymentProvider.ts`,
updated only to carry the new `provider_authority_ref` field in lockstep with
`provider_mapping`), both arms scored only on the post-gate decision:

- Baseline (no Skill): **100** / 300 max. Skill: **300** / 300. Delta: **+200**.
- Regressions: **0**.
- Qualified dimensions: **7 / 10** (floor: ≥7) — numerically identical to
  round 1, but D08 (`A22, A23, A24`) is now qualified for a real reason:
  `{A22:1, A23:1, A24:0}` are two genuinely distinct, independently-provable
  signals that happen to both improve on the one provider-bearing canonical
  fixture (`FX-POS-006`), not one signal read twice under two names.

  **Pre-empting a follow-up reading**: both contributions come from
  `FX-POS-006`, and in the visible-packet mock (`deploymentProvider.ts:25`)
  both `provider_mapping` and `provider_authority_ref` are gated by the same
  `method.provider` concept flag (parsed from the Skill prose), so on the
  baseline arm both fields collapse to neutral/null together, and on the
  Skill arm both resolve together. This is **not** special to D08: every one
  of the ten dimensions' fields is gated by exactly one shared `method.X`
  flag in this mock (`method.identity` for D01's three fields,
  `method.entrypoint` for D02's, `method.container` for D04's, and so on,
  `deploymentProvider.ts:20-25`) — that is the mock's uniform design (does
  the Skill's prose unlock this whole concept, not this one field), not a
  D08-specific coincidence. The contract's qualification rule
  (`>=2 distinct improved assertion IDs`) is about the real decision's
  assertion IDs, which are now genuinely distinct (see the asymmetry probes
  above) — it does not require the *scoring mock's* two flags to be
  independent, and none of the other seven qualified dimensions meet a
  stricter bar than that either.
- Global max single-assertion share of positive delta: **0.05** (10 / 200).

### The three unqualified dimensions, named and explained

Reporting "7/10" without naming the three that failed, and why, would hide
exactly what a verifier needs to check first:

- **D07** (`A19, A20, A21` — persistence): unqualified, 1 distinct
  contributor (`A19`; `A20`/`A21` are 0). Real property of the canonical
  fixture set, not a defect: no `FX-POS-*` intent covers `PERSISTENT_LOCAL` or
  multi-replica (`FX-POS-005`'s intent is explicitly *ephemeral, without
  volume*). `A20`/`A21` are still exercised — by their own isolation probes,
  on the purpose-built `persistentLocalInput()` base — just not by the 10
  canonical A/B fixtures.
- **D09** (`A25, A26, A27` — verification): unqualified, share `0.529 > 0.50`
  (`A25` is 0; `A26`/`A27` carry all the improvement). `A25`'s governing
  condition (required-evidence insufficiency causing `BLOCKED`) never differs
  between arms across 10 fixtures that are all designed to reach a real
  decision.
- **D10** (`A28, A29, A30` — determinism): unqualified, share `0.526 > 0.50`
  (`A30` is 0 by construction — an order-invariance check, not an
  improvement-shaped signal — `A28`/`A29` carry the rest).

`A15` (secret minimization, in D05) was structurally-silent in the same way as
D07's members before this session — no canonical fixture exercised it, so it
was `null` in both arms for all 10 positives — even though D05 was already
qualified on its other two assertions. It is fixed here, not merely reported: `FX-POS-004`'s
canonical intent is plural ("optional public config plus sensitive
*references* remain value-free"), so this session added a second, optional,
not-yet-present secret reference to that one fixture (input enrichment within
the stated intent, per contract §20; the named condition — value-free — is not
weakened). `A15` now scores `1`, and `D05` moved from a fragile 2-contributor
`0.50` share to a genuine 3-contributor `0.474` share. This did not change the
qualified-dimension count (D05 was already qualified) but it removed a second
structurally-silent assertion from the same category as D07/D09/D10.

**7 is exactly the contract floor (`minimum_qualified_dimensions: 7`), not a
comfortable margin.** A fresh verifier re-implementing this scoring loop (as
§24 and the S13Q precedent both require) landing one contribution differently
anywhere in D01–D08 would drop the count to 6 and fail. This is disclosed, not
hidden, and is a property of what the 10 canonical positive fixtures can
exercise — not something this session judged safe to fix by further enriching
fixtures beyond the one A15 case above, which was a genuine "never scoreable at
all" defect rather than "thin margin."

## `INVARIANT_STABLE` — a fourth classification bucket, and why

S13Q's precedent used three: STRICT / STRUCTURAL_DEPENDENCY / GATE_CLASS.
Neither name is contract-mandated; both are builder-invented vocabulary for
satisfying contract §14's actual normative text. S13R adds a fourth,
`INVARIANT_STABLE`, for the two atomics (`A24`, `A30`) whose own governing
signal is an *absence* invariant (no adapter-shaped keys; order-independence)
that cannot vary under any real input mutation in a correct implementation.
Under a naive reading of §14 ("exactly the intended assertion must change"),
an atomic whose own slot never moves looks like a failed probe. It is not: the
probe is real (a genuine authority-identity swap for A24; a genuine array
reversal for A30), it recomputes the real evaluator, and the fact that the
invariant *holds* — measured, not assumed — is the intended proof.

## Unsafe counters, hard invariants, fixtures (unchanged from prior session, reverified)

- `UC01..UC12`: zero on every canonical positive and on the Skill arm; each
  independently shown to fire (`all unsafe counters are behavior/audit
  derived...` test).
- `S13R-HI-001..030`: all true, recomputed outside the module for every
  positive fixture.
- Exact 10 positives (`FX-POS-001..010`), exact 36 negatives
  (`FX-NEG-001..036`), both counted against the quality contract's own `id:`
  occurrences (`exact fixture inventory matches canonical IDs`).
- Provider blindness: the visible-packet `DeploymentProvider` cannot see
  fixture ID, expected result, arm name, `with_skill`, or Skill
  ID/name-as-answer-key; guidance consumption is content-derived
  (`provider consumes content without Skill identity answer key`).
- Actual-candidate gating: a tampered candidate is rejected and never
  replaced with a synthesized "faithful" substitute
  (`gate blocks altered actual candidate...`).

## QA (Node 24.19.0 / npm 11.17.0, re-run after the round-2 fix)

- Typecheck: PASS.
- Full suite pre-build: **1381/1381** across 25 files.
- Repo-local `dist/` genuinely absent, then `tsc -p tsconfig.json` clean build:
  PASS, **816 files** emitted (272 `.js` + 272 `.d.ts` + 272 `.js.map`,
  unchanged count from round 1 — the schema addition is one field on an
  existing type, not a new module).
- Full suite post-build: **1381/1381**.
- `git diff --check` scoped to the full candidate diff (`src/intelligence/deployment`,
  `tests/deployment`): clean. An unscoped, repo-wide `git diff --check` is
  **not** clean — it flags trailing whitespace in exactly six pre-existing
  S13N/S13O files that were already modified in the working tree before this
  work began and were not touched by it (confirmed via `git status`/`git diff
  --stat` on those exact paths, both empty, and independently reconfirmed by
  the round-1 fresh verifier). A verifier running the unscoped command should
  expect exactly those six pre-existing hits and nothing from this
  candidate's own files.
- Canonical Part A: byte-identical to this branch's own history since
  `be77b4c` (see blob table above); no return to the ChatGPT Authoring Gate
  required for this builder's own work. See the disclosed `main`-vs-branch
  Part A divergence above, which is separate from this point and unresolved
  by design.
- Boundaries: no Core, AgentDefinition, `package.json`/`package-lock.json`,
  provider SDK/vendor binding, Docker daemon, network, filesystem, clock,
  randomness, or S14+ surface introduced or touched
  (`canonical module side-effect and catalog boundaries` test; manual diff
  review of the full five-file change across both rounds).

## Next exact action

A fresh, non-authoring, non-fork, read-only verifier — a *different* process
from the round-1 verifier, which has now seen this candidate's reasoning and
so cannot re-verify it independently — must independently reproduce: the
58/58 focused tests, the 30/30 isolation matrix and its exact classification
**id sets** (not just the 15/11/2/2 counts — round 1 passed on counts alone
while carrying the A22≡A23 defect), the A22/A23 asymmetry specifically, the
A/B figures above (100 → 300, 0 regressions, 7/10 qualified, share 0.05, and
that D08's two contributors are genuinely distinct), all 30 hard invariants,
all 12 unsafe counters, the full 1381/1381 pre/post-build suite, and Part A
byte identity against this branch's own history — against this exact
candidate commit. It should also independently judge whether the disclosed
`main`-vs-branch Part A divergence blocks closure or is a separate
control-plane concern. Only after that reproduction may HI-053 be awarded and
`S13R` marked `VERIFIED PASS`. This builder does not update `STATE.yaml` or
`CURRENT.md` closure fields.
