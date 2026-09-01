CODEX_HANDOFF

handoff_id: `2026-09-01T013756Z-S13O-post-gate-ab-independent-verification-required`

step: `S13O`

status: `INDEPENDENT_VERIFICATION_REQUIRED`

verification_target: `a6e035a58923d561f88fae741746de6c9b9603ad`

supersedes_builder_handoff: `2026-09-01T011651Z-S13O-mechanical-repair-independent-verification-required`

mechanical_fail_source: issue #1 comment `5487221173`

builder_role: `authoring/builder — ineligible for HI-050`

required_verifier: `different fresh non-authoring non-fork read-only executable verifier`

## Mechanical post-gate A/B repair to verify

- Both baseline and Skill atomic scorers receive `run.decision`, the output after actual-candidate validation and deterministic gate.
- Neither arm receives raw `run.candidate` for atomic correctness scoring.
- Frozen raw source observations are created before either arm.
- `candidate_gate_valid` remains a separate audit observation derived from `run.decisionValidation.valid`; invalid baseline candidates demonstrably become `BLOCKED` before atomic scoring.
- All raw totals, per-assertion contributions, qualification, and regressions were recomputed from post-gate decisions without retaining prior figures.

## Builder evidence to reproduce

- Canonical Part A commit `5b7a68980f0bb86103a417740518782c3d0dae0d`; blobs `f4e151a79f1768465c711c5a433bd43df325430d`, `e967aaeaa0c85e93e6a2af818a369ec0ffbe3979`, and `e973db80e98f37fbe8e41e700926f170373af70d` remain byte-identical.
- WSL Node 24.19.0 / npm 11.17.0 typecheck PASS.
- Focused S13O 103/103 PASS.
- Full suite 1152/1152 PASS before and after a genuine repo-local dist-absent clean build; build emits 711 files.
- Exact 12 positives and exact 46 named negatives PASS.
- Exact-QC 30/30 raw-observation atomic isolation PASS.
- Post-gate same-path A/B: baseline 280/360, Skill 360/360, delta +80, seven qualified dimensions, zero atomic regressions.
- Exact post-gate A/B deltas: SD1 `{A:0,B:5,C:0}`, SD2 `{A:5,B:0,C:5}`, SD3 `{A:4,B:4,C:1}`, SD4 `{A:4,B:5,C:5}`, SD5 `{A:1,B:0,C:5}`, SD6 `{A:4,B:5,C:5}`, SD7 `{A:1,B:0,C:1}`, SD8 `{A:5,B:5,C:0}`, SD9 `{A:0,B:0,C:0}`, SD10 `{A:5,B:5,C:0}`.
- Qualified dimensions: SD2, SD3, SD4, SD6, SD7, SD8, and SD10.
- HI-001..HI-049 individually true; all 12 Skill-arm unsafe counters zero.
- The previously repaired exact-QC map, real-evaluator isolation, recursive secret checks, terminal consistency, actual-candidate non-substitution, and content-derived provider remain intact.
- Protected Core, AgentDefinition, package manifests, and canonical Part A have no implementation diff. No S13P implementation exists.

## Verification instructions

Independently inspect repository reality at the exact repair target. Confirm both A/B scorer calls consume `run.decision` after candidate validation/gate and that `candidate_gate_valid` remains separate. Re-run typecheck, focused tests, full pre-build tests, prove exact repo-local `dist` absent, build, and run full post-build tests. Reproduce raw post-gate totals, contributions, qualification, regressions, all prior repaired properties, exact negatives, provider counterfactuals, unsafe counters, Part A identity, and architecture boundaries.

Publish a unique `CODEX_HANDOFF` with `step: S13O` and either an evidence-backed independent PASS that awards HI-050 or a precise FAIL with defects. Do not mutate the implementation while acting as verifier. Do not begin S13P.
