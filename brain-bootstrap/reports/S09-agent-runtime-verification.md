# S09 — Agent Runtime Fundamentals Verification

## Artifacts Integrated (verbatim from ChatGPT authoring, `S09_Brain_Agent_Runtime_Fundamentals_Artifacts.md`)

- `brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md` (Part A — semantic contract)
- `brain-bootstrap/decisions/ADR-agent-runtime-model-provider.md` (Part A — decision: `DeterministicReferenceModelProvider`, no external LLM for S09)

## Implementation (Claude Code, Part B, built directly on the approved contract)

| Path | Role |
|---|---|
| `src/core/agent/types.ts` | Provider-neutral contract types (`ModelProvider`, `CapabilityProvider`, message/event/state/termination schemas) — Core, zero storage/vendor-specific code |
| `src/core/agent/runtime.ts` | `runAgent()` — the canonical loop (spec §14), depends only on `./types.js` |
| `src/core/agent/index.ts` | Re-export |
| `src/providers/model/deterministicReferenceModelProvider.ts` | `DeterministicReferenceModelProvider` — the approved S09 reference `ModelProvider`, no network/credentials |
| `src/providers/capability/referenceCapabilityProvider.ts` | `ReferenceCapabilityProvider` — exposes one real Tool, `word_count`, which actually computes a word count (not a canned answer) |
| `tests/agent/fixtures.ts` | Test-only fakes: `ImmediateFinishModelProvider`, `NeverFinishModelProvider`, `DelayedModelProvider`, `FailingModelProvider`, `UnknownCapabilityModelProvider`, `FaultInjectingCapabilityProvider`, `AlternateCapabilityProvider`, `DelayedCapabilityProvider` |
| `tests/agent/agentRuntime.test.ts` | T1–T12 contract tests |

No new dependencies were added (`git diff --stat -- package.json package-lock.json` is empty).

## Contract Tests (T1–T12)

All executed via `npm test` (`vitest run`).

| Test | Result | Notes |
|---|---|---|
| T1 — Full real-tool loop | **PASS** | `DeterministicReferenceModelProvider` + `ReferenceCapabilityProvider`; goal requires counting 5 real words; exact event-type sequence asserted (`RUN_STARTED → CONTEXT_ACCEPTED → MODEL_REQUESTED → MODEL_DECIDED → TOOL_REQUESTED → TOOL_COMPLETED → STATE_UPDATED → MODEL_REQUESTED → MODEL_DECIDED → RUN_SUCCEEDED`) |
| T2 — Structured final output | **PASS** | Successful Run returns `summary`, `data`, `termination`, non-empty event log; a fake provider that finishes with `output: {}` (missing `summary`) is rejected with `INVALID_STRUCTURED_OUTPUT` |
| T3 — Max-turns termination | **PASS** | `NeverFinishModelProvider` + `max_turns: 2` → `FAIL` / `MAX_TURNS_EXCEEDED`; exactly 2 `MODEL_REQUESTED` events, no third |
| T4 — Timeout termination | **PASS** | `DelayedModelProvider` (150ms delay) + `timeout_ms: 30` → `FAIL` / `TIMEOUT_EXCEEDED`; a `RUN_TIMED_OUT` event exists |
| T5 — Tool failure path | **PASS** | `FaultInjectingCapabilityProvider` always returns normalized `FAIL` → Runtime does not crash, emits `TOOL_FAILED`, terminates `FAIL` / `TOOL_ERROR` |
| T6 — Blocked capability path | **PASS** | `UnknownCapabilityModelProvider` requests a capability absent from `list_capabilities()` → `BLOCKED` / `REQUIRED_CAPABILITY_MISSING`, validated by Core before any `invoke()` call |
| T7 — ModelProvider substitution | **PASS** | Same assertion helper run unmodified against `DeterministicReferenceModelProvider` and the fake `ImmediateFinishModelProvider` |
| T8 — CapabilityProvider substitution | **PASS** | Same assertion helper run unmodified against `ReferenceCapabilityProvider` (`word_count`) and `AlternateCapabilityProvider` (`char_count`) — a genuinely different real Tool, not a mock |
| T9 — No provider/vendor leakage into Core | **PASS** | Mechanical scan of every `.ts` file under `src/core/agent/` for the tokens `openai`, `anthropic`, `gemini`, `claude`, `hermes`, `notion`, `better-sqlite3`, `langgraph`, `langchain` (case-insensitive) found zero matches |
| T10 — Event-log explainability | **PASS** | Sequence numbers strictly monotonic (+1 each); exactly one terminal event per Run; full expected event-type set present; last event is the terminal event |
| T11 — Usage unavailable | **PASS** | `DeterministicReferenceModelProvider` never sets `usage` → final `result.usage` is `undefined`, not fabricated as `0` |
| T12 — Provider error normalization | **PASS** | `FailingModelProvider` returns a `NormalizedModelError` → `FAIL` / `MODEL_ERROR`, message propagated, no provider-specific exception type ever thrown/caught |

**Full run:** `Test Files 2 passed (2)`, `Tests 31 passed (31)` (16 from S07's `MemoryProvider` suite, unchanged, + 15 from the new Agent Runtime suite — T2/T7/T8 each contribute 2 cases).

## Bug Found and Fixed During Verification

The first version of the `T3` test fixture (`NeverFinishModelProvider`) issued `TOOL_CALL` with an empty `input: {}` on every turn. Because `ReferenceCapabilityProvider.invoke()` correctly rejects a `word_count` call missing `input.text`, every turn failed with `TOOL_ERROR` before `max_turns` could ever be reached — the test failed with `reason_code: "TOOL_ERROR"` instead of the expected `"MAX_TURNS_EXCEEDED"`. Root-caused to the fixture (not the Runtime): fixed by having `NeverFinishModelProvider` forward `request.state.working_state` as the tool input (matching `DeterministicReferenceModelProvider`'s pattern), so the Tool succeeds every turn while the fake provider still never recognizes completion. Recorded here per the established practice of not silently smoothing over caught bugs.

## Core/Provider Boundary Checks

- `grep -rn "from \"../../providers\|from \"../providers\|providers/" src/core/` → empty. No Core file imports a concrete provider.
- `src/core/agent/runtime.ts` imports only from `./types.js`.
- `DeterministicReferenceModelProvider` and `ReferenceCapabilityProvider` live under `src/providers/`, not `src/core/`.

## Quality Gates

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (0 errors) |
| `npm test` | PASS (31/31) |
| `npm run build` (`rm -rf dist && npm run build && npm test`) | PASS — build succeeds, post-build test run still 31/31 (confirms `vitest.config.ts`'s `dist/**` exclusion still holds with the new `tests/agent/` directory) |
| `package.json` / `package-lock.json` diff | empty — no new dependencies |

## Acceptance Criteria (from `AGENT_RUNTIME_LOOP_v1.md` §26)

All criteria satisfied: `ModelProvider` and `CapabilityProvider` contracts implemented; Agent Runtime Core depends only on those contracts; `DeterministicReferenceModelProvider` and `ReferenceCapabilityProvider` both live outside Core; at least one real Tool (`word_count`, later also `char_count`) exists outside Core; T1–T12 pass; structured final output, max-turn limit, timeout, failure/blocked states, ordered event log, explicit termination explanation, and provider substitution are all demonstrated; no vendor/tool implementation leaks into Core; no S10 `AgentDefinition` work has started (confirmed: no `AgentDefinition` type, schema, or file exists anywhere in the repo).

## PASS Criteria (from S09 step contract)

> "Se puede explicar y observar cada iteración del loop, incluido por qué terminó."

Demonstrated by T10: every Run's event log reconstructs the full iteration history (model requests, decisions, tool calls, observations, state updates) with monotonically increasing sequence numbers and exactly one terminal event carrying an explicit machine-readable `reason_code` and `message` — never a bare "done" or "failed".

## Open Issues

- No `AgentDefinition` (S10) exists yet — explicitly out of scope for S09, confirmed not started.
- `S08_Closure_Checkpoint.md` and `S09_Brain_Agent_Runtime_Fundamentals_Artifacts.md` remain as untracked transfer files at the repo root — left for the closure checkpoint to evaluate for cleanup, consistent with established practice.
- The reference `DeterministicReferenceModelProvider` is intentionally generic (acts on `request.capabilities[0]`), which is sufficient for S09's single-tool scenarios; a future step introducing multiple simultaneously available capabilities would need a smarter (still deterministic, still credential-free) selection policy — not required by S09's acceptance criteria.
