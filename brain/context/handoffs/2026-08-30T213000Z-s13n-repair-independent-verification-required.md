# S13N repair — Independent Verification Required

Repair target: `5cd801ace4b3de78cb2e1627eb93242f86f70453`.

The repair addresses issue #1 comment `5471198433` without changing canonical Part A. The Part A blobs remain Skill `38a7673578d5164b303927bc4752aa61c4b75bc5`, Quality Contract `6f8c621c508477cd9fd553f7cd22e44310f602c0`, Contract `14d695fa6a98720cb465d6e881a0c560b279b486`.

- Real same-path A/B now executes S12 → S10 → S09 using one deterministic truth-blind provider and actual parsed candidates. Baseline 0/192; Skill 192/192; +192; SD-001..008 qualified; raw A/B/C 8/8/8 per dimension, denominator 24, max share 1/3, no regressions.
- Focused S13N 41/41; exact FX-NEG-001..032 literal status/evidence assertions; evaluator-linked detached atomic normalization isolation 24/24.
- Provider packet excludes case identity/truth/arm data; candidate and input validation are total/fail-closed; safe sensitive-output absence requires explicit normalized proof.
- HI-001..049 and unsafe counters are derived from actual arm/evaluator evidence. HI-050 is false/pending. All eight Skill unsafe counters are zero.
- WSL Node 24.19: typecheck PASS; full pre-build 1040/1040; dist absent before build; build PASS; full post-build 1040/1040.

Fresh verifier requirements are unchanged: different, non-authoring, non-fork, read-only; re-check actual S12/S10/S09 A/B path, provider blindness, candidate gate, exact 32 negatives, 24/24 isolation, raw A/B math, HI/unsafe derivation, Part A integrity and boundaries. Do not modify or push. S13O remains forbidden.

Report: `brain-bootstrap/reports/S13N-agent-evals-verification.md`.
