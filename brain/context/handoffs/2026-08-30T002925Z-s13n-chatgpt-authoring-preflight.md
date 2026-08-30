# S13N CHATGPT AUTHORING PREFLIGHT

## Step

S13N — agent-evals

## Objective

Prepare canonical semantics for evaluating agent behavior without creating a general future-stage platform
prematurely. This artifact records repository facts and open semantic questions only.

## Verified repository state

- Preflight start: `HEAD == origin/main == cf7b14e87da5f94b98ca7b1e74815e6104ab580e` on `main`.
- Tracked worktree is clean at preflight start; 13 retained, pre-existing root-level Markdown scaffolds
  remain untracked and are outside this work.
- Canonical shell runtime: Node `v24.19.0`, npm `11.17.0` via WSL nvm; no global configuration changed.
- S13M qa-debugging is `VERIFIED PASS`: fresh verifier handoff `2026-08-29T235800Z-S13M-fresh-executable-verifier-pass`,
  issue #1 comment `5465618108`; control-plane acceptance is issue #1 comment `5465631151`.
- No tracked S13N/agent-evals Skill, Quality Contract, SPEC, source module, test directory, AgentDefinition,
  Skill catalog entry, capability, provider, dependency or general eval platform exists.
- The append-only reference Skill catalog contains 16 entries ending at S13M:
  `src/intelligence/skills/index.ts`.
- `package.json` has no evaluation, telemetry, workflow, retry, browser, network, MCP or provider-SDK
  dependency; production dependency remains `better-sqlite3` for the isolated S07 reference memory adapter.

## Canonical sources

- `.claude/skills/brain-build-day-bootstrap/SKILL.md` — S13N’s high-level objective and mandatory
  ChatGPT Authoring Gate.
- `brain-bootstrap/STATE.yaml` and `brain/context/CURRENT.md` — current verified continuity.
- `brain-bootstrap/reports/S13M-qa-debugging-verification.md` and issue #1 comments `5465618108`,
  `5465631151` — the immediately preceding verified closure.
- `brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md`, `src/core/agent/types.ts`,
  `src/core/agent/runtime.ts` — generic run, event and optional usage/cost contracts.
- `brain-bootstrap/specs/AGENT_DEFINITION_v1.md`, `src/core/agent/compileDefinition.ts` — generic,
  role-independent compilation and capability restriction.
- `brain-bootstrap/specs/SKILL_CONTRACT_v1.md`, `src/providers/skill/localReferenceSkillProvider.ts`,
  `src/intelligence/skills/index.ts` — metadata-only discovery and selected-skill lazy loading.
- `brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md`,
  `brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_DEEP.yaml`, and
  `brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md` — immediately adjacent S13M boundary and
  verification conventions.

## Existing reusable mechanisms

- S09 has provider-neutral `ModelProvider`, structured model outputs, tool-call events, termination
  outcomes, run/event IDs, optional normalized token/cost usage and bounded turn/time inputs. Usage is
  omitted when unavailable; Core must not infer cost from a vendor price table.
- S10 compiles every valid AgentDefinition through the same generic S09 path and restricts declared
  capabilities/side-effect classes without role-specific branches.
- S12 discovers Skill descriptors without loading definitions, then lazily loads and validates only the
  selected entry. Existing S13 code executes through S12 → S10 → S09 rather than a separate runtime.
- Test suites for S13E, S13K, S13L and S13M demonstrate deterministic `ModelProvider` fixtures,
  same-path Skill-vs-no-Skill materialization, independently maintained frozen truth, candidate gates,
  comparison functions, raw assertion contributions, hard invariants and unsafe counters.
- S13K, S13L and S13M demonstrate detached atomic-observation fixtures and one-field mutation probes;
  S13M’s final verifier independently reproduced 30/30 such probes. These are available patterns, not
  prescribed S13N semantics.
- `tests/qa-debugging/` is the closest current reusable layout: deterministic provider, bounded inputs,
  frozen truth, isolation fixtures, a candidate gate and a comparison module. Its semantic rules remain
  S13M-specific and must not be copied as S13N policy.

## Architectural boundaries verified from repository evidence

- S13M owns bounded incident reproduction, evidence, cause, minimal-fix, regression and relevant-suite
  assessment. Its canonical contract explicitly prohibits a general agent-eval/golden-case platform.
- S13O owns timeout/retry/backoff/idempotency/async-job mechanics. S09 exposes only a normalized
  `retryable` representation and generic timeout limit; it has no retry engine.
- S13P owns observability systems. S09 event records and optional ModelProvider usage are existing
  runtime metadata, not a telemetry/tracing platform or a complete latency/cost accounting system.
- S14 owns Capability Registry, MCP, connector and executable tool binding. S09 has a generic injected
  CapabilityProvider and tool descriptors, but no S14 registry/binding exists.
- S15 owns an independent verifier agent. Existing fresh-verifier evidence is a process/handoff pattern,
  not an S15 implementation.
- No current S13H–S13M AgentDefinition exists; the available AgentDefinitions are S11/S13A–S13E plus
  generic references. Existing S13H–S13M skills are cataloged as bounded Intelligence data. Repository
  evidence does not itself justify a new S13N AgentDefinition or capability.

## Candidate Part A artifacts expected

Following the established S13x convention, ChatGPT should confirm or revise these provisional path names
in a byte-ready transfer. They are path candidates only; this preflight does not author their content.

1. `brain-bootstrap/skills/AGENT_EVALS_SKILL_S13N.md`
2. `brain-bootstrap/quality-contracts/S13N_AGENT_EVALS_<DEPTH>.yaml`
3. `brain-bootstrap/specs/AGENT_EVALS_CONTRACT_S13N.md`

## Questions ChatGPT must resolve

- Exact S13N purpose/scope and whether it is `SKILL_ONLY` or needs another already-supported shape.
- Evaluation object: candidate, run, agent, task, or a bounded combination; anti-substitution requirements.
- Golden-case contract, fixture ownership, positive/negative requirements and provider/truth separation.
- Tool-selection evaluation semantics without creating S14 binding or a new tool platform.
- Schema-compliance, task-success and safety evaluation semantics and their boundaries with S13L/S13M.
- Latency/cost semantics: whether existing optional runtime metadata supports only deterministic,
  bounded/reference evaluation or any stronger conclusion; no observability platform may be assumed.
- Hard invariants, semantic dimensions, unsafe counters, atomic isolation and Skill-vs-no-Skill design.
- Whether a new AgentDefinition or any new capability is justified; repository evidence does not decide it.
- Deterministic/reference evaluation limits, independent verification requirements and exact T1–Tn coverage.
- Stage boundaries with S13M, S13O, S13P, S14 and S15, plus any ambiguity ChatGPT finds in canonical sources.

## Open implementation questions

- Which existing materialization/gating/comparison modules can be reused mechanically once canonical
  Part A defines the S13N object model and acceptance rules.
- Whether runtime event timestamps and optional usage fields are sufficient evidence for S13N’s
  latency/cost goals, or only inputs to bounded reference fixtures.
- Whether the currently generic capability descriptors and S09 tool-call events can support a bounded
  tool-selection assertion without new registry, connector or provider behavior.

## Non-goals

- No canonical S13N Skill, Quality Contract, SPEC, score, threshold, golden-case rule, fixture policy or
  runtime/platform is authored here.
- No Core mutation, provider-specific evaluation architecture, AgentDefinition, capability, dependency,
  retry/async system, observability platform, Capability Registry/MCP binding or S15 verifier agent.
- No implementation of S13O or later stage.

## Required ChatGPT action

Inspect repository truth and this preflight, resolve S13N semantics, author COMPLETE canonical Part A on
an isolated temporary ChatGPT-authoring branch, and return `AUTHORING_READY`. Do not modify `main` or
implement S13N Part B.
