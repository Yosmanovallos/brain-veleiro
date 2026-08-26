# S10 — AgentDefinition v1 Verification

## Artifact Integrated (verbatim from ChatGPT authoring, `AGENT_DEFINITION_v1.md`)

- `brain-bootstrap/specs/AGENT_DEFINITION_v1.md` — verified byte-identical to the ChatGPT response's `## File:` section content via `diff`.

## Implementation (Claude Code, Part B, built directly on the approved contract)

| Path | Role |
|---|---|
| `src/core/agent/definition.ts` | `AgentDefinition` and all policy sub-types (Core-adjacent schema, per the contract's own framing: "Intelligence, compiled into the generic Core Agent Runtime") |
| `src/core/agent/validateDefinition.ts` | `validateAgentDefinition()` — deterministic validation per contract §20 |
| `src/core/agent/restrictedCapabilityProvider.ts` | `RestrictedCapabilityProvider` — generic capability/side-effect restriction wrapper per §23 |
| `src/core/agent/compileDefinition.ts` | `compileAgentDefinition()` and `assertCapabilitiesExist()` — the generic compilation boundary per §21-26 |
| `src/core/agent/index.ts` | Updated re-exports |
| `src/core/agent/types.ts` | Minor mechanical refactor: extracted `ToolSideEffectClass` as a named exported type (was inline in `ToolDescriptor`) so `AgentPermissionPolicy` could reuse it without redefinition — no semantic change, confirmed by the unchanged S09 test suite |
| `src/intelligence/agent-definitions/referenceDefinitions.ts` | `referenceResearcher`, `referenceBuilder`, `referenceVerifier` — the three illustrative instances from contract §28, copied verbatim (capability_id `word_count` already matched the real S09 reference Tool, so no substitution was needed per §28's instruction) |
| `tests/agent/fixtures.ts` | Added `MultiCapabilityProvider` fixture for capability-restriction tests |
| `tests/agent/agentDefinition.test.ts` | T1–T14 contract tests |

**Design note on file placement:** the `AgentDefinition` type, validator, and compiler live under `src/core/agent/` (not a separate `intelligence/` module) because the contract explicitly frames `AgentDefinition` as "Intelligence, compiled into the generic Core Agent Runtime" and requires T12 to scan "Core Agent runtime/compiler files" — this mirrors how `ToolDescriptor`/`JsonSchemaLike` (Core-adjacent shapes) already coexist with concrete Tools living in `src/providers/`. The concrete AgentDefinition *values* (the three reference role configs) are genuine Intelligence content and live under the new `src/intelligence/` directory, consistent with S02's Core/Intelligence/Providers architecture — this is the first Intelligence-layer TypeScript module in the repo.

No new dependencies were added (`git diff --stat -- package.json package-lock.json` is empty).

## Contract Tests (T1–T14)

All executed via `npm test` (`vitest run`).

| Test | Result | Notes |
|---|---|---|
| T1 — Valid AgentDefinition accepted | **PASS** | `referenceBuilder` validates with zero errors |
| T2 — Researcher definition validates | **PASS** | |
| T3 — Builder definition validates | **PASS** | |
| T4 — Verifier definition validates | **PASS** | |
| T5 — Incomplete/malformed definition rejected | **PASS** | Empty `objective` rejected; `limits.max_turns: 0` rejected both by `validateAgentDefinition()` directly and by `compileAgentDefinition()` throwing before any `runAgent()` call — no silent default |
| T6 — tools/capabilities invariant enforced | **PASS** | Mismatched sets (`tools: [word_count]` vs `capabilities: [different_capability]`) rejected |
| T7 — Capability list is restricted | **PASS** | `RestrictedCapabilityProvider` against a 2-capability fake provider exposes only the allowlisted one |
| T8 — Forbidden capability invocation rejected | **PASS** | Invoking the non-allowlisted capability returns `BLOCKED` without ever reaching the injected provider's `invoke()` |
| T9 — Side-effect permission enforced | **PASS** | A capability with `side_effects: EXTERNAL` is neither listed nor invokable when the policy permits only `NONE` |
| T10 — AgentDefinition limits map to S09 | **PASS** | Distinctive `{max_turns: 3, timeout_ms: 1234}` passes through `compileAgentDefinition()` into `RunAgentOptions.limits` unchanged — no parallel limits implementation |
| T11 — All roles execute through identical compiler/runtime path | **PASS** | `referenceResearcher`, `referenceBuilder`, `referenceVerifier` all compiled via the same `compileAgentDefinition()` and run via the same `runAgent()` inside one loop (no per-role branch in the test itself); all three reach `SUCCESS` with `data.word_count === 5` |
| T12 — Core contains no role-conditional branching | **PASS** | Mechanical scan of every `.ts` file under `src/core/agent/` for `role === "researcher"` / `"builder"` / `"verifier"` (both quote styles) and `runResearcher(`/`runBuilder(`/`runVerifier(` found zero matches |
| T13 — Delegation remains disabled | **PASS** | A definition with `delegation.allowed: true` is rejected by `validateAgentDefinition()` |
| T14 — Provider neutrality | **PASS** | Recursively walked every string value inside all three reference `AgentDefinition` objects (not raw file text, to correctly exclude source comments) — zero matches for `openai`, `anthropic`, `gemini`, `hermes`, `notion`, `better-sqlite3`, `localreferencememoryprovider`, `deterministicreferencemodelprovider`, `referencecapabilityprovider`, `langgraph`, `langchain` |

**Full run:** `Test Files 3 passed (3)`, `Tests 46 passed (46)` (16 from S07 + 15 from S09, both unchanged, + 15 new from S10 — T5 contributes 2 cases).

## Core/Provider Boundary Checks

- `grep -rn "from \"../../providers\|from \"../providers\|providers/|intelligence/" src/core/` → only two doc-comment lines in `definition.ts` (prose, not imports). No Core file imports a concrete provider or Intelligence content.
- `src/intelligence/agent-definitions/referenceDefinitions.ts` imports only the `AgentDefinition` type from Core — no provider imports.

## Quality Gates

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (0 errors) |
| `npm test` | PASS (46/46) |
| `npm run build` (`rm -rf dist && npm run build && npm test`) | PASS — build succeeds, post-build test run still 46/46 |
| `package.json` / `package-lock.json` diff | empty — no new dependencies |

## Acceptance Criteria (from `AGENT_DEFINITION_v1.md` §32–33)

All satisfied: researcher/builder/verifier are three `AgentDefinition` configurations executing through one generic compiler and one S09 Agent Runtime with zero role-specific branching (T12); all three definitions validate; malformed definitions fail deterministically before `runAgent()` (T5); capability restrictions and side-effect permissions are enforced (T7–T9); S09 `AgentRunLimits` are reused directly, not duplicated (T10); S09 terminal semantics are untouched — `compileAgentDefinition()` never constructs a `TerminalOutcome` itself; no concrete provider implementation enters any `AgentDefinition` (T14); delegation remains disabled (T13); no S11 production agent behavior was implemented — the three reference definitions use the same trivial `word_count` capability and the S09 deterministic reference `ModelProvider`, exactly as the contract's non-goals require.

## PASS Criterion (from S10 step contract)

> "Los tres roles cambian por configuración y políticas, no por lógica especial duplicada."

Demonstrated by T11 (identical compile+run call executed in a loop over all three definitions, reaching `SUCCESS` for each) and T12 (mechanical proof that no role-conditional code exists anywhere in `src/core/agent/`).

## Open Issues

- `AGENT_DEFINITION_v1.md` remains as an untracked transfer file at the repo root — left for the closure checkpoint to evaluate for cleanup, consistent with established practice.
- Per the contract's own explicit deferral, `model_policy`/`context_policy`/`memory_policy` are validated but not yet consumed by any resolver (no `ModelProvider`-selection, `ContextProvider`, or memory-permission enforcement logic exists yet) — this is intentional S10 scope, not a gap.
- `output_schema` validation against `StructuredAgentOutput.data` (contract §22, step 9, marked "optionally") was not implemented, since none of the required T1–T14 tests exercise it and a full JSON-schema validator would exceed S09/S10's explicitly minimal scope ("S09 does not require a complete JSON Schema implementation"). Left for a future step if a real need arises.
