# S13O_CHATGPT_PART_A_CANONICAL

Handoff: `2026-08-31T021941Z-S13O-chatgpt-authoring-preflight-relay`
Base main: `e383d9d8a380221a80bf6fb23bbe892eee58bd81`
Canonical authoring commit: `c3caf494c8097d714f627ec93996bf0e48e1afce`

This temporary authoring branch is a transport package only. Do not merge it into `main`.

## Complete canonical Part A package

The complete authored Part A is the exact content of these three UTF-8 files on this same branch. Their Git blob IDs are the integrity authority:

1. `brain-bootstrap/skills/ASYNC_RELIABILITY_SKILL_S13O.md`
   - blob: `f4e151a79f1768465c711c5a433bd43df325430d`
2. `brain-bootstrap/quality-contracts/S13O_ASYNC_RELIABILITY_DEEP.yaml`
   - blob: `e967aaeaa0c85e93e6a2af818a369ec0ffbe3979`
3. `brain-bootstrap/specs/ASYNC_RELIABILITY_CONTRACT_S13O.md`
   - blob: `e973db80e98f37fbe8e41e700926f170373af70d`

No other semantic file is part of S13O Part A.

## Canonical semantic resolution

- S13O v1 is `DEEP` and `SKILL_ONLY`.
- Reference implementation is a pure deterministic reliability/state-transition library outside Core.
- No new AgentDefinition, Core special branch, provider binding, capability, durable queue/store, telemetry platform, HTTP client binding or dependency is authorized.
- S13O reasons over one already-observed operation/job attempt and does not itself execute retry, sleep, network, cancellation, queue, persistence or deduplication.
- Status: `READY | INCONCLUSIVE | BLOCKED`.
- Action: `COMPLETE | RETRY | RECONCILE | CANCEL | STOP | BLOCK`.
- Existing S09 `retryable` is evidence only, never retry authorization.
- Retry-eligible classes are bounded by attempt budget, elapsed budget, effective deadline, authority, replay safety, cancellation and job-state gates.
- Post-dispatch effectful timeout/unknown outcome remains `INCONCLUSIVE + RECONCILE` unless replay safety/reconciliation evidence proves otherwise.
- Exactly-once claims and raw secret/idempotency material are forbidden.
- S09 deadline/terminal ownership, S10/S13L authority, S13I effect semantics and S13P/S14/S15 boundaries remain intact.
- Quality gate: 50 hard invariants with HI-050 reserved for fresh independent verification; 30 atomic observations; >=12 positive/evaluable fixtures; 46 exact negatives; 30/30 isolation; real same-path S12→S10→S09 A/B; provider truth blindness; >=7/10 qualified dimensions; max single-assertion share <=0.50; zero atomic regressions; all 12 unsafe counters zero.

## Exact integration instructions

1. `git fetch origin`.
2. Do **not** merge this authoring branch.
3. Read the three canonical files from `origin/chatgpt-authoring/s13o-20260831t021941z-authoring-preflight-relay` with `git show`.
4. Verify the three blob IDs above before integration.
5. Copy those three files byte-for-byte to the same paths on `main`.
6. Verify byte identity and standalone YAML parsing for the quality contract.
7. Create and push a **Part-A-only** commit. Preserve the source branch/commit/blob audit trail in factual continuity/reporting.
8. Only after Part A is integrated may the primary builder implement Part B inside the canonical allowed scope (`src/intelligence/async-reliability/**`, Skill catalog/test/report/continuity surfaces) with zero unauthorized Core/provider/dependency/platform drift.
9. Run required deterministic QA, A/B impact, isolation and full build/test gates, then stop at `INDEPENDENT_VERIFICATION_REQUIRED`.
10. If implementation exposes a need to change Core, AgentDefinition, provider/dependency, durable queue/store or canonical semantics, stop and return to `CHATGPT_AUTHORING_REQUIRED`; do not widen scope mechanically.
