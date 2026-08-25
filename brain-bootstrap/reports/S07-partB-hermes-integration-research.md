# S07 Part B — Hermes Integration Research

> This is an evidence/research report, not implementation. No adapter code, config, or contract-test implementation was written. `MEMORY_PROVIDER.md` was not semantically modified.

## 1. Executive Decision

**C. ONLY_AS_DEVELOPMENT_SESSION_SYSTEM**

Hermes Agent's genuinely public, stable, documented surfaces (API Server HTTP+SSE, Sessions REST API, TUI Gateway, ACP) are all built around **conversational/session control**, not a deterministic memory CRUD service. None of them expose a machine-callable, non-LLM-mediated way to read or write the built-in durable memory (`MEMORY.md`/`USER.md`): the official docs state explicitly "There is no `read` action — memory content is automatically injected into the system prompt," and writes only happen when the agent's own reasoning decides to invoke its internal `memory` tool during a conversation turn. The internal `agent.memory_provider.MemoryProvider` Python ABC — the one artifact that looks most like "the interface Brain should call" — is confirmed by its own source docstring to be "an abstract base class for pluggable memory providers" wired into Hermes's own `MemoryManager`/`run_agent.py`: an extension point for plugging backends **into** Hermes, not an external API for calling **out of** it. Session/chat control is genuinely solid and would serve Brain well as a development/session-continuity tool (complementary to S06), but forcing Brain's `MemoryProvider` contract onto Hermes Agent itself would mean either accepting non-deterministic LLM-mediated memory operations, or coupling to internal/undocumented internals. Neither is acceptable per Brain's existing Quality Architecture (S04) and Evidence rules. **This does not select D**, because a real, high-quality path exists (see §12): several of Hermes's *external memory provider plugins* have their own independently documented, deterministic REST APIs that Brain could call directly, decoupled from Hermes's own agent loop.

## 2. Target Version

- **release:** Hermes Agent v0.20.5
- **tag:** `v2026.8.19`
- **commit:** tag `v2026.8.19` (verified via `gh api repos/NousResearch/hermes-agent/git/trees/v2026.8.19` and `.../releases`)
- **verification date:** 2026-08-25
- **newer release found:** No. `gh api repos/NousResearch/hermes-agent/releases` lists `v2026.8.19` as the most recent non-prerelease, published 2026-08-21T12:16:39Z; no newer stable tag exists as of this check (repo `pushed_at` shows commits after the tag, on `main`, but no new release was cut).
- **decision:** Evaluate against `v2026.8.19` as instructed. All file/doc reads in this report were pinned to `?ref=v2026.8.19`.

## 3. Official Integration Surfaces

| Surface | Public/stable? | Memory read | Memory write | History | Auth | Coupling | Verdict |
|---|---|---|---|---|---|---|---|
| **API Server** (HTTP+SSE, `/v1/*`, `/api/sessions/*`, `/api/jobs/*`) | Yes — versioned, documented, `/v1/capabilities` machine-readable | No documented endpoint; memory is auto-injected into system prompt only | No deterministic endpoint; only via conversational turn asking the agent to remember | Partial — `/api/sessions` (list) + `/api/sessions/{id}/messages` (per-session messages), no cross-session full-text search endpoint | Bearer `API_SERVER_KEY` | Low-medium (network boundary, but grants full toolset incl. `terminal`) | Best available surface for session/chat control; **not sufficient alone** for memory read/write |
| **TUI Gateway** (JSON-RPC stdio/WebSocket) | Yes, documented — but oriented at interactive gateway/messaging clients | Same limitation as API Server (agent-mediated) | Same limitation | Session lifecycle/history RPCs exist, similar shape to Sessions API | Local process/gateway auth model | Medium (long-lived interactive process assumption) | Not clearly better than API Server for a headless Brain adapter |
| **ACP** (JSON-RPC over stdio, subprocess) | Yes, documented — explicitly editor-integration-focused | Same limitation; session-search is an in-conversation tool, not an RPC Brain calls directly | Same limitation | Sessions tracked only in-memory by the ACP adapter for the life of that subprocess; `list/load/resume/fork` scoped to the running ACP server | Host-spawned subprocess, inherits local Hermes credentials | High for a persistent backend use case (one subprocess per editor session, ephemeral) | Wrong shape for a standing Brain memory backend |
| **Python in-process `AIAgent`** | No — internal implementation class, not a documented/versioned public API | Would require internal knowledge of undocumented methods/files | Same | Same | N/A (in-process) | Highest — direct code coupling, not even a network boundary | `INTERNAL_UNSTABLE`; violates Core substitutability principle more severely than a network adapter would |

## 4. Brain Contract Mapping

| Brain method | Hermes primitive/surface | Exact evidence | Mapping quality | Gap |
|---|---|---|---|---|
| `retrieve()` | None deterministic through documented Hermes surfaces | `website/docs/user-guide/features/memory.md`: "There is no `read` action — memory content is automatically injected into the system prompt at session start." | **NONE** (via Hermes' own memory); `PARTIAL` if repurposed to mean "read `~/.hermes/memories/MEMORY.md` directly from disk" (documented file location/format, but not an API contract) | No supported read API; a direct file read is possible but not a stable contract Hermes commits to |
| `remember_candidate()` | None — no external staging/candidate concept | `memory.md` §"Controlling memory writes (`write_approval`)": staging (`/memory pending`) is an internal approval gate for the agent's *own* writes, not an externally-callable "submit a candidate" API | **NONE** | Candidate staging must remain entirely Brain-side, exactly as `MEMORY_PROVIDER.md` already assumes |
| `commit_verified_memory()` | None deterministic; only "ask the agent to remember X" in a chat turn | Same source; also confirmed the built-in `memory` tool is invoked by the agent's own reasoning, never by an external caller directly | **NONE** (via Hermes' own memory); a real external provider's own API (e.g. Mem0 self-hosted `/memories` POST) would be `ACCEPTABLE_SHIM` if Brain talks to that provider directly | A prompt-based "remember this" is not a machine-verifiable write per RQ4's own bar |
| `search_history()` | `GET /api/sessions` + `GET /api/sessions/{id}/messages` | `website/docs/user-guide/features/api-server.md` §"Sessions API" | `PARTIAL` | Gives bounded session listing + message retrieval, but no full-text/semantic search endpoint; FTS5 `session_search` is documented as an agent-invoked tool (`memory.md` §"Session Search"), not a public API. Brain would need its own index over listed sessions' messages, or direct (unsupported) SQLite access to `~/.hermes/state.db` |

## 5. Candidate Memory Lifecycle

Hermes does **not** support a true candidate-before-commit lifecycle exposed to an external caller. Internally, `write_approval: true` stages the *agent's own* memory-tool calls for human review (`/memory pending` / `approve` / `reject`), which is a human-in-the-loop gate, not a programmatic staging API Brain could call. **Candidate staging (Brain's `remember_candidate()`) must remain entirely Brain-side**, exactly as already designed in `MEMORY_PROVIDER.md` §3.2/§14 — this finding does not require any change to the contract, it simply confirms the contract's existing assumption was correct.

## 6. Durable Memory

- **Built-in behavior:** Two bounded files, `MEMORY.md` (2,200 chars / ~800 tokens) and `USER.md` (1,375 chars / ~500 tokens), stored at `~/.hermes/memories/`, injected as a frozen system-prompt block at session start.
- **Limits:** Hard character caps; writes that would exceed the limit are rejected with an error requiring the agent to consolidate first. No auto-compaction.
- **Write operations:** `add`, `replace` (substring match), `remove` (substring match) — all invoked by the agent's own `memory` tool, mediated by LLM reasoning during a turn.
- **Persistence:** Immediate to disk; visible to tool responses immediately, but not reflected in the system prompt until the next session starts (frozen-snapshot-per-session design).
- **Verification/result observability:** Tool calls return structured success/error JSON (e.g. the "memory full" error shown in the docs) — this *is* machine-parseable if Brain were the one issuing the tool call, but Brain cannot issue that tool call directly; only the Hermes agent's own LLM turn can.
- **Public vs internal surface:** Documented file format/location (semi-public, documentation-grade), but no committed public read/write API. External provider plugins (§below) are a separate, additive system with genuinely public per-provider APIs.

## 7. History/Search

- **Session persistence:** All CLI/messaging/API-server sessions stored in SQLite (`~/.hermes/state.db`) with FTS5 full-text search, per `memory.md`.
- **Listing:** `GET /api/sessions` (paginated, filterable by source, `include_children`) — public, documented.
- **Messages:** `GET /api/sessions/{id}/messages` — public, documented, per-session.
- **Search capability:** The FTS5-backed `session_search` tool is documented under the agent's own tool surface (`memory.md` §"Session Search", cross-referenced to `/user-guide/sessions#session-search-tool`), i.e., it is something the **agent** calls during a conversation, not a REST endpoint Brain can call directly.
- **Conclusion:** Brain needs its own bounded search/index if it wants `search_history()` to do real full-text search — the Sessions API's list+messages primitives are sufficient to *build* such an index (fetch bounded sets of sessions/messages on demand) but do not provide search themselves.

## 8. Internal APIs We Must NOT Depend On

- **`agent.memory_provider.MemoryProvider`** (confirmed via its own module docstring, fetched at the target tag): *"Abstract base class for pluggable memory providers... Registration: Plugins ship in `plugins/memory/<name>/`... Lifecycle (called by MemoryManager, wired in `run_agent.py`)."* This is unambiguously an **internal plugin ABI for extending Hermes**, not a client API for calling Hermes. Using it directly would mean running Brain's memory logic *inside* the Hermes process as a plugin — architecturally backwards from Brain's Core → MemoryProvider → Adapter direction, and would couple Brain to Hermes's internal Python package structure (`agent/`, `acp_adapter/`), which is not a versioned public contract.
- **Direct SQLite access to `~/.hermes/state.db`**: documented to exist and use FTS5, but its schema is not published as a stable public contract — classify as `INTERNAL_UNSTABLE` unless Nous Research explicitly documents the schema as supported for external consumption (no such documentation was found).
- **Direct file read/write of `MEMORY.md`/`USER.md`**: format and location are documented (`DOCUMENTED_BUT_SPECIALIZED`), but this is documentation for *understanding what the agent does*, not a committed external I/O contract — a future Hermes release could change the storage format without treating it as a breaking API change, since it was never advertised as one.

## 9. Disabled Mode

No new information changes what `MEMORY_PROVIDER.md` §18 already specifies. Regardless of which surface is eventually chosen for Part B, the disabled-adapter behavior is entirely Brain-side logic:

```text
retrieve() -> empty + DISABLED
remember_candidate() -> NOT_PERSISTED + DISABLED
commit_verified_memory() -> NOT_PERSISTED + DISABLED
search_history() -> empty + DISABLED
```

This does not require Hermes to be installed merely to instantiate a disabled adapter stub — confirmed as still valid and unaffected by this research.

## 10. Security and Config

Only verified requirements, from `website/docs/user-guide/features/api-server.md`:

- `API_SERVER_ENABLED=true` / `API_SERVER_KEY=<bearer token>` required to enable the API Server (required for every deployment, even loopback-only).
- Default bind: `127.0.0.1:8642` (localhost only); CORS disabled by default, explicit allowlist (`API_SERVER_CORS_ORIGINS`) needed for browser access.
- Security headers present by default (`X-Content-Type-Options`, `Referrer-Policy`).
- **Important security note for adapter design:** *"The API server gives full access to hermes-agent's toolset, including terminal commands."* An adapter holding `API_SERVER_KEY` would be granted far more than memory access — it would be able to execute shell commands through the agent. Any future Brain adapter using this surface must scope its own usage strictly to session/chat endpoints and must not be treated as a narrow "memory-only" credential.
- External memory providers each have their own separate credential requirements (e.g. `MEM0_API_KEY`, `HINDSIGHT_API_KEY`, `SUPERMEMORY_API_KEY`, etc.) — not investigated further here since choosing one is a Part-B-adjacent decision (see §12).
- No secret value was printed, requested, or created during this research.

## 11. Remaining Gaps

1. No verified deterministic external API for durable-memory read or write via Hermes Agent's own surfaces.
2. No verified public full-text search endpoint for session history (only list + per-session messages).
3. Exact doc-to-tag currency not fully diffed — the docs read here were fetched pinned to `v2026.8.19`, but Nous Research's doc-versioning policy relative to tags vs. `main` was not independently confirmed beyond that pin.
4. If the external-provider-as-shared-backend path (§12) is pursued, no specific provider's own API has yet been vetted in depth (which of Mem0-self-hosted / Holographic / RetainDB / Supermemory best fits Brain's four-method contract, its own auth model, and its own stability guarantees) — that is new research scope, not yet done.
5. Whether Brain and a real "development-session" use of Hermes (§1's C verdict) should be pursued at all is a product decision for the user, not resolved here.

## 12. Recommended Part B Architecture

Conceptual only — no source code.

**Option pursued if the user wants Hermes for developer/session continuity (matches Executive Decision C):**

```text
Human developer
    ↓ (interactive CLI/ACP/editor)
Hermes Agent
    ↓ (its own session/memory features)
Hermes-owned state (~/.hermes/*)
```

This is a *separate, human-facing tool*, not something Brain's automated `MemoryProvider` calls at runtime. It complements S06 (a developer could use Hermes as their own daily-driver session tool while building Brain) without being wired into Brain's Core contract at all.

**Option pursued if the user wants a working, deterministic `MemoryProvider` adapter soon:**

```text
Brain Core
    ↓
Brain MemoryProvider (contract, unchanged)
    ↓
Brain-side candidate store + search index (small, Brain-owned; required per §5/§7 regardless of backend)
    ↓
Adapter targeting a memory provider's OWN public API directly
    ↓
e.g. Mem0 self-hosted (/memories, /search over HTTP + X-API-Key)
    or Holographic (local SQLite + FTS5, zero external dependency, MIT/free)
```

In this option, "Hermes Agent" is **not** the thing Brain's adapter talks to at all — Brain talks directly to whichever backend (e.g. Mem0-self-hosted, or the zero-dependency local Holographic store) is chosen, using that backend's own documented, versioned, deterministic API. Hermes Agent could *optionally* be configured to use the same backend (via `memory.provider`) purely so a human using Hermes interactively shares recall with Brain — but that becomes a nice-to-have, not a dependency of Brain's contract. This decouples Brain entirely from Hermes's internal plugin ABI and from any non-deterministic LLM-mediated step, satisfying the S07 rules and the Disabled-Adapter Test cleanly.

This second option is a genuine architectural pivot from "Hermes Adapter" (calling the Hermes Agent process) to "a Hermes-*compatible* backend adapter" (calling a backend Hermes also happens to support) — which is exactly the kind of finding this research spike exists to surface.

## 13. Implementation Authorization Decision

**NEEDS_CHATGPT_ARCHITECTURE_DECISION**

Reasoning: this research did not just fill in missing facts about a pre-agreed integration boundary — it found that the step's original framing ("Hermes Adapter" = an adapter that talks to the Hermes Agent process) does not have a deterministic, substitutable, public surface to build on, and that the more promising path (§12, option 2) redirects the adapter's actual target to a *different* system (a Hermes-compatible external memory-provider backend) that Hermes itself merely also happens to support. That redirection is a semantic/architectural decision — not a mechanical implementation detail — and per this bootstrap's own Authoring Gate, a decision of that shape belongs with ChatGPT (potentially updating `MEMORY_PROVIDER.md`'s §1/§17 framing or producing a new ADR), not with Claude Code choosing unilaterally. Claude Code did not implement anything and will not until that decision is made.

---

## Verification (mechanical, before finishing)

```
$ git status --porcelain=v1
 M brain-bootstrap/STATE.yaml
?? S07_Brain_Hermes_Research_MemoryProvider_PartA.md
?? S07_PartB_Hermes_Integration_Research_Spike.md
?? brain-bootstrap/reports/S07-partA-memory-provider-verification.md
?? brain-bootstrap/reports/S07-partB-hermes-integration-research.md
?? brain-bootstrap/specs/MEMORY_PROVIDER.md
→ no Brain source code added (no .py/.js/.ts/etc. files created)
→ no dependency added (no package.json/requirements.txt/pyproject.toml touched — none exist in this repo)
→ no secret created (no .env, no credential values written anywhere)
→ no S08 artifact exists (brain-bootstrap/specs has no S08-named file; STATE.yaml S08 remains NOT_STARTED)
→ MEMORY_PROVIDER.md not semantically modified this turn (only read for cross-referencing; git diff shows no changes since S07 Part A integration)
```
