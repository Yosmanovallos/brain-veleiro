# S13R Deployment — Builder Verification

Status: `BUILDER PASS / INDEPENDENT VERIFICATION REQUIRED`

Branch: `codex/s13r-deployment-part-b`. Candidate at this report: HEAD of that
branch after this session's commit (isolation repair on top of `eb21bad`).

> **Continuity note.** Part A (Skill, Quality Contract, Semantic Contract) and
> the first Part B implementation (`deploymentModel.ts`, `quality.ts`,
> `deploymentSkill.ts`, `planDeployment.ts`, fixtures, and 58 focused tests)
> were authored in an earlier session on this branch (commits `be77b4c`,
> `d8262ed`, `eb21bad`). That session left one item open: the quality
> contract's `atomic_isolation_exact: 30` requires 30 real source-fact isolation
> probes, and only one demonstrative probe existed (`RUNTIME_VERSION`, showing
> 23/30 coupled — a finding, not a result). This session completes that item.
> Nothing else in the prior implementation was found to need repair.

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

**This session's work**: redesigned the 30-slot atomic observation vector to
remove four coupling defects, then built and ran a real 30-probe one-owned-
source-fact isolation registry (one probe per atomic, each mutating exactly
one raw input/source/evidence fact and recomputing the real decision).
Everything else in the prior implementation is unchanged.

HI-053 is **not** awarded by this builder and `S13R` remains not
`VERIFIED PASS`. A fresh non-authoring, non-fork, read-only verifier must
independently reproduce the evidence below next, per contract §24.

## Canonical Part A integrity

No Part A file was touched this session (`git diff` against the three
artifacts below is empty):

| Artifact | Git blob |
|---|---|
| `brain-bootstrap/skills/DEPLOYMENT_SKILL_S13R.md` | `b1b7f81fba7762ced07bcbd034a4a61be682efdf` |
| `brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml` | `d606ac01bdc21129fb21b5ca0aff0b6e57ccf29f` |
| `brain-bootstrap/specs/DEPLOYMENT_CONTRACT_S13R.md` | `4a513c9063c4985ed375c3fcc7c6c979280e7bf6` |

## This session's diff

Contained entirely to three files:

- `src/intelligence/deployment/quality.ts` — rewrote `deploymentObservations`
  (30 slots, redesigned; see below); widened `evaluateDeploymentAtomic` to pass
  `input` through (needed for A28); added `globalMaxAssertionShare` to
  `compareDeploymentRuns`; added `buildDeploymentIsolationRegistry` (30 probe
  specs) and `runDeploymentIsolationMatrix` (runs and classifies them).
- `tests/deployment/deployment.test.ts` — replaced the single demonstrative
  isolation test with the full 30-probe matrix test, plus a mechanical
  anti-tautology guard on the STRICT bucket.
- `tests/deployment/fixtures.ts` — added `providerInput`, `persistentLocalInput`,
  `readinessOptionalInput` isolation bases; enriched `FX-POS-004` with a
  second, absent-presence secret reference (its own canonical intent is
  plural: "sensitive *references*").

No change to `deploymentModel.ts`, `deploymentSkill.ts`, `planDeployment.ts`,
`types.ts`, `constants.ts`, or the independent test-side `deploymentProvider.ts`
(the A/B baseline/skill arms' visible-packet provider).

## Observation-vector defects found and fixed

The prior `deploymentObservations` had four coupling defects that made
isolation impossible to demonstrate honestly:

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
   bound. Fixed: A23 now reads `provider_mapping` directly — the same field as
   A22, deliberately (see below), not the unbounded aggregate.

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
  A23→[A22,A28]  A28→[A29]
GATE_CLASS(2):  A06, A25 (each collapses ~20 other slots to their BLOCKED
  default; the full lists are in S13R_ISOLATION_30)
INVARIANT_STABLE(2):  A24→[A22,A23,A28] (own signal stays 0)
                       A30→[] (own signal stays 0, and moves nothing else)
```

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

### The STRUCTURAL_DEPENDENCY → A29 pattern (8 of 11 entries)

A04, A12, A13, A14, A15, A16, A20, A21 each *bind a new reference* (an
alternate entrypoint, a second build artifact, a rebound provenance/secret
reference, a relocated writable path) and each such binding requires a *new*
backing `repository_fact`. `evidence_refs` (A29) is the deduped fact-id ledger
over the whole input, so any new fact_id necessarily moves it too. This is one
mechanical reason, not eight separate ones. A22 also binds a new reference
(the provider authority, via a new `PROVIDER_DECISION` fact) and so also
carries `A29` — but A22's *primary* declared dependency is the A22 ↔ A23 pair
below, since both read the same field. A23 itself carries no `A29`: its own
probe is a value-only rename of an *existing* fact, no new fact_id involved.
The remaining two entries, A22 ↔ A23 and A28 ↔ A29, are declared separately
below (A28↔A29 is the mutual pair from each other's own dedicated probe, not
the new-reference pattern).

### A22 / A23 — a deliberate, declared redundancy

A22 (`default_neutrality`) and A23 (`authority_binding`) both read
`d.provider_mapping`, the same expression, on purpose. `DeploymentDecision`
has exactly one field carrying provider identity; splitting A22/A23 cleanly
would require adding a new decision field (e.g. echoing back
`provider_authority.decision_ref`) purely to manufacture two independent
signals for one governed fact, which is worse than declaring the true
dependency. A22 probes presence (absent → bound); A23 probes identity (bound →
renamed), from a different base (`providerInput`), and both correctly move
together. A24 rides the same rename and separately proves the adapter-key
boundary (`Object.keys(d)` matching `/adapter/i`) stays at 0 even while
provider identity legitimately changes — an `INVARIANT_STABLE`, not a bug.

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

## Skill-vs-no-Skill (fresh figures, this session)

Same 10 canonical positive fixtures, same materialized S12 → S10 → S09 path,
same visible-packet `DeploymentProvider` (`tests/deployment/deploymentProvider.ts`,
unchanged), both arms scored only on the post-gate decision:

- Baseline (no Skill): **100** / 300 max. Skill: **300** / 300. Delta: **+200**.
- Regressions: **0**.
- Qualified dimensions: **7 / 10** (floor: ≥7).
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

## QA (Node 24.19.0 / npm 11.17.0, this session)

- Typecheck: PASS.
- Full suite pre-build: **1381/1381** across 25 files.
- Repo-local `dist/` genuinely absent, then `tsc -p tsconfig.json` clean build:
  PASS, **816 files** emitted (272 `.js` + 272 `.d.ts` + 272 `.js.map`).
- Full suite post-build: **1381/1381**.
- `git diff --check` scoped to this session's diff (`src/intelligence/deployment`,
  `tests/deployment`): clean. An unscoped, repo-wide `git diff --check` is
  **not** clean — it flags trailing whitespace in six pre-existing S13N/S13O
  files that were already modified in the working tree before this session
  and were not touched by it (confirmed via `git status`/`git diff --stat` on
  those exact paths, both empty). A verifier running the unscoped command
  should expect exactly those six pre-existing hits and nothing from this
  candidate's own files.
- Canonical Part A: byte-identical (see blob table above); no return to the
  ChatGPT Authoring Gate required.
- Boundaries: no Core, AgentDefinition, `package.json`/`package-lock.json`,
  provider SDK/vendor binding, Docker daemon, network, filesystem, clock,
  randomness, or S14+ surface introduced or touched
  (`canonical module side-effect and catalog boundaries` test; manual diff
  review of this session's three-file change).

## Next exact action

A fresh, non-authoring, non-fork, read-only verifier must independently
reproduce: the 58/58 focused tests, the 30/30 isolation matrix and its exact
classification counts (15/11/2/2), the A/B figures above
(100 → 300, 0 regressions, 7/10 qualified, share 0.05), all 30 hard invariants,
all 12 unsafe counters, the full 1381/1381 pre/post-build suite, and Part A
byte identity — against this exact candidate commit. Only after that
reproduction may HI-053 be awarded and `S13R` marked `VERIFIED PASS`. This
builder does not update `STATE.yaml` or `CURRENT.md` closure fields.
