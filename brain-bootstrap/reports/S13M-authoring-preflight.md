# S13M QA Debugging — ChatGPT Authoring Preflight

## Gate

```text
CHATGPT AUTHORING REQUEST
Step: S13M
Purpose: Author the complete canonical Part A for qa-debugging.
Controller action now: INSPECT + EVIDENCE ONLY
Part B: FORBIDDEN UNTIL VERBATIM INTEGRATION
```

## Canonical step contract

```text
S13M — qa-debugging
Reproduce → evidence → root cause → minimal fix → regression → relevant suite.
```

Every S13x requires ChatGPT-authored Intelligence semantics, positive and negative fixtures, real
execution through the existing runtime when applicable, deterministic QA, improvement evidence versus
no Skill where applicable, and a different fresh independent verifier before the next S13x.

## Verified repository facts

- Branch `main`; post-closure `HEAD == origin/main ==` `3eac82efcd102b2375ac383b1aa75a92c074c68d`.
- S00–S13L are `VERIFIED PASS`; S13L fresh verification was accepted by the ChatGPT control plane in
  issue #1 comment `5462919214`.
- Current independently executed baseline in the available WSL runtime: Node `v22.23.1`, npm
  `10.9.8`, `npm run typecheck` PASS and `npm test` `984/984` PASS across 19 Vitest files. The
  historical S13L verifier report records Node `v24.19.0`, npm `11.17.0` for its target; that is not
  substituted for the current observed runtime.
- `package.json` defines `typecheck` (`tsc --noEmit`), `test` (`vitest run`) and `build`
  (`tsc -p tsconfig.json`); TypeScript is strict ESM targeting ES2022. Current dependencies are
  `better-sqlite3`; development dependencies include TypeScript, Vitest and `js-yaml`.
- No tracked S13M/qa-debugging-named Skill, Quality Contract, spec, typed projection, source module,
  tests, AgentDefinition, provider, dependency or runtime implementation was found.
- S09 Core has provider-neutral `SUCCESS | FAIL | BLOCKED` model/tool outcomes, normalized error
  codes with a `retryable` boolean, structured output `evidence_refs`, ordered run events, bounded
  run limits and terminal reasons. Paths: `src/core/agent/types.ts` and `src/core/agent/runtime.ts`.
  The repository does not yet contain a general retry/backoff engine.
- S12 provides metadata discovery/lazy loading of selected Skills; S10 compiles AgentDefinitions;
  S09 executes the generic run loop. Later S13x use this real path with deterministic providers where
  relevant, rather than a separate skill-specific runtime.
- Existing S13A–S13L implementation patterns use pure Intelligence modules, typed projections in
  `src/intelligence/skills/definitions/`, input fixtures, deterministic providers, validators/gates,
  test suites and verification reports. S13K/S13L additionally use frozen truth, Skill-vs-no-Skill
  comparison and detached atomic-observation isolation; these are established evaluation mechanisms,
  not an automatic decision that every S13M concern needs the same mechanism.
- The global Spec Contract requires applicable deterministic/procedural QA before semantic
  verification and identifies reproducible failures as QA evidence. The Evidence Record template
  captures claim, source, reproducibility, limitations and contradictory evidence.

## Authority and boundaries to preserve

- S13M must build on existing deterministic checks and evidence representations without silently
  changing S09 runtime, S10 AgentDefinition or S12 Skill discovery semantics.
- S13L remains the provider-neutral security decision boundary. S13M may record a verified security
  failure as incident evidence but must not weaken, replace or implement S13L security policy.
- S13N owns agent-evaluation infrastructure; S13M must not pull forward golden-case/eval-platform
  systems beyond its bounded QA/debugging contract.
- S13O owns timeout/retry/backoff/idempotency/async-job mechanics. The existing `retryable` flag is a
  representation, not authorization to implement retry execution here.
- S13P owns observability systems; S13M must not introduce a telemetry/tracing platform. S13Q owns
  delivery/demo documentation, S13R deployment, and S14 executable Capability Registry/tool/MCP
  binding.
- No Core mutation, new runtime dependency, provider, credential, live secret, PII, network service,
  retry engine, observability vendor or future-stage source is authorized by this preflight.

## Requested canonical Part A categories

Following the S13L and earlier S13x convention, the transfer should delimit these artifact categories
at exact repository paths:

1. `brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md`
2. `brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_<DEPTH>.yaml`
3. `brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md`

The ChatGPT transfer must select the final execution mode and Quality depth; `<DEPTH>` is intentionally
unresolved in this factual preflight.

## Questions ChatGPT must resolve

1. execution mode and whether an AgentDefinition is justified under the S13E hierarchy;
2. Quality depth and bounded QA/debugging input/output/incident/evidence contract;
3. reproducibility evidence and deterministic observation requirements;
4. root-cause classification and the distinction among symptom, hypothesis, proven cause and
   unresolved cause;
5. minimal-fix policy, regression-test requirements and relevant-suite selection;
6. behavior when a failure cannot be reproduced, is flaky/intermittent, or is environmental, code,
   data or contract-related;
7. interaction with S13L security failures, S13N evals, S13O retry mechanics and S13P observability;
8. anti-self-certification and independent-evidence requirements, including whether/where OI-A-style
   isolation is applicable;
9. required positive and negative fixtures, deterministic evaluation design and exact Part B scope.

## Constraints and non-goals

- Do not write final S13M rules or resolve any question above in this preflight.
- Do not duplicate S13L security semantics, S13N evaluation infrastructure, S13O retry/async
  mechanics, S13P observability systems, S13Q delivery, S13R deployment or S14 capabilities.
- Do not claim that existing `retryable` flags provide retry behavior, that passing tests prove root
  cause, or that no regression can exist outside the selected evidence.
- Preserve input/evidence immutability, source traceability and explicit uncertainty where they apply.
- If S13M uses a Skill-vs-no-Skill claim, preserve the established same-input/runtime/provider and
  truth-blind anti-substitution principles; ChatGPT must decide the precise acceptance design.

## Required ChatGPT action

Author the complete canonical S13M Part A transfer on a temporary authoring branch. Do not modify
`main` or implement Part B. If the repository evidence is insufficient, mark the exact gap rather than
inventing semantics.
