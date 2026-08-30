# S13N Agent Evals — Builder Verification

## Status

Builder QA is `PASS`; S13N remains `IN_PROGRESS` / `INDEPENDENT_VERIFICATION_REQUIRED`. HI-050 is deliberately pending. S13O and later stages remain forbidden.

## Authority and immutable Part A

- Authoring approval: issue #1 comment `5471091138`.
- Part A integration: `e73bcb10abbc1835e64836a8f957c045e583478b`.
- First mechanical repair: `5cd801ace4b3de78cb2e1627eb93242f86f70453`.
- Second independent source-verification FAIL: issue #1 comment `5471291211`.
- Current mechanical repair: `f90f8d760913d505e60831ff69b2004c30f73cf8`.
- Canonical blobs remain exact:
  - Skill `38a7673578d5164b303927bc4752aa61c4b75bc5`
  - Quality Contract `6f8c621c508477cd9fd553f7cd22e44310f602c0`
  - Contract `14d695fa6a98720cb465d6e881a0c560b279b486`

## Mechanical repair evidence

- The real A/B path remains S12 selected Skill load → S10 compile → S09 `runAgent` → parse actual candidate → total validation → actual-candidate gate → deterministic evaluator → normalized post-gate observations → comparison.
- Benchmark correctness is no longer a raw provider PASS count. Each scored observation records the candidate result, independently recomputed evaluator result/reason, and equality after the gate. An adversarial candidate-claim mutation proves the evaluator decision is unchanged.
- Provider separation is computed from the exact provider-visible envelope and issued as a branded, case/truth/run-bound audit. Literal/forged audit objects cannot make SD1-B pass. Source checks inspect the actual provider imports and executable branching surface.
- All eight unsafe counters are measured from provider-envelope/source audits, exact candidate/subject gate evidence, and independent forbidden-tool, safety, schema, missing-cost, missing-latency, and future-boundary probes.
- HI-001..HI-049 are explicitly mapped to their owning validation, runtime, gate, evaluator, adversarial, immutability, isolation, source, Part A blob, or package-manifest evidence. HI-050 is `false` pending a different fresh verifier.
- The exact FX-NEG-001..032 fixtures exercise their named conditions. In particular, 002/003/004 leak forbidden provider inputs, 006 substitutes the subject object, 007 substitutes the actual candidate, 031 changes A/B input/truth identity, and 032 injects an actual future retry-platform source identifier.
- Atomic isolation derives 24 detached source observations from a valid packet, mutates one owned source fact, recomputes the real evaluator and normalization path, and proves exactly one atomic changes without aliases: 24/24.

## Real post-gate A/B result

- Canonical positives: 8/8 distinct shapes (no tool, required tool, safe block, schema/evidence, optional cost absent, required latency, allowed tool, required matching-currency cost).
- Baseline: `0/192` correct post-gate atomic observations.
- Skill: `191/192` correct post-gate atomic observations.
- Delta: `+191`; regressions: zero; qualified dimensions: SD-001..SD-008 (8/8).
- SD-001..SD-006 and SD-008: A/B/C contributions `8/8/8`, denominator `24`, maximum share `1/3`.
- SD-007: A/B/C contributions `8/8/7`, denominator `23`, maximum share `8/23 = 0.347826`.
- The one non-correct Skill claim is intentional evidence: FX-POS-005 recomputes optional absent cost as `NOT_EVALUATED`, while the provider claimed PASS.

## Builder QA (WSL Node 24.19.0 / npm 11.17.0)

- Part A blob integrity: PASS, 3/3 exact.
- `npm run typecheck`: PASS, zero errors.
- Focused `tests/agent-evals/agentEvals.test.ts`: PASS, 41/41.
- Exact negatives: PASS, FX-NEG-001..032 (32/32) with exact status, signal, and reason.
- Underlying-source isolation: PASS, 24/24.
- HI-001..HI-049: PASS from individual evidence; HI-050 false/pending.
- Unsafe counters: all eight exactly zero.
- Full pre-build suite: PASS, 21 files / 1040 tests.
- `dist/` resolved to the repository-only target, removed, and proven absent.
- Clean build: PASS.
- Full post-build suite: PASS, 21 files / 1040 tests.
- `git diff --check`: PASS.
- Boundaries: no Core change, AgentDefinition, capability/provider implementation, package dependency, retry/async engine, observability platform, registry/MCP/connector, verifier Agent, or S13O+ implementation.

## Required next action

Run only a different fresh non-authoring, non-fork, read-only S13N verifier against the committed/pushed target. Do not start S13O.
