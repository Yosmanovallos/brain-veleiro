# S14A Capability Registry Foundation — Builder Verification

Status: `BUILDER_PASS / INDEPENDENT VERIFICATION REQUIRED`

Authorization: GitHub Issue #1 comment `5548820269` (control-plane
`PART_B_AUTHORIZED`). Baseline: `ed95a984b41a8ae5df1d494743ec01b11dcf2381`
(the S14 Part A integration commit on `main`). Branch:
`s14a-capability-registry-foundation-part-b`, built in a dedicated,
clean `git worktree` created directly from `ed95a98` so the pre-existing,
unrelated, untouched S13N/S13O working-tree modifications and untracked
scaffold files documented on `main` could not be staged or altered by this
session.

**S14A: BUILDER_PASS_AWAITING_INDEPENDENT_VERIFICATION**
**S14: NOT_CLOSED**
**HI-054: NOT_AWARDED**

This builder does not self-approve. A fresh, non-authoring, non-fork,
read-only verifier must independently reproduce the evidence below against
the exact committed candidate before any control-plane acceptance.

## What this candidate is

A provider-neutral Capability Registry Foundation
(`src/providers/capability/registry/**`) that resolves stable capability IDs
to exactly one explicitly selected `CapabilityProvider` implementation, fails
closed on missing/ambiguous/unknown-provider bindings, and itself implements
the existing Core `CapabilityProvider` interface unchanged — so it composes
underneath `RestrictedCapabilityProvider` with zero special-case integration:

```
concrete providers -> CapabilityRegistryProvider -> RestrictedCapabilityProvider -> runAgent()
```

Production files (all new, nothing existing modified):

- `src/providers/capability/registry/types.ts` — `RegisteredCapabilityProvider`,
  `CapabilityRegistryBinding`, `CapabilityRegistryConfig`, finding/diagnostic
  types. No credential/auth/connection-reference field exists anywhere in
  this shape — S14A has no legitimate use for one, so none was added.
- `src/providers/capability/registry/validateConfig.ts` — pure,
  side-effect-free `validateCapabilityRegistryConfig()`: groups by id
  (never by array position), returns `DUPLICATE_PROVIDER_ID` (fatal),
  `UNKNOWN_PROVIDER_REFERENCE` and `AMBIGUOUS_CAPABILITY_BINDING`
  (per-capability, non-fatal) findings.
- `src/providers/capability/registry/capabilityRegistryProvider.ts` —
  `CapabilityRegistryProvider implements CapabilityProvider`. Constructor
  rejects (throws) only on fatal findings; every other finding is resolved
  to a fail-closed `BLOCKED` result scoped to just that one capability_id,
  leaving every other capability fully routable. `list_capabilities()`
  sorts capability ids alphabetically (registration-order-independent) and
  excludes any capability whose selected provider doesn't actually advertise
  a matching descriptor. `invoke()` fails closed with the canonical reason
  text `REQUIRED_CAPABILITY_MISSING` (no binding, or binding to an unknown
  provider id) or `AMBIGUOUS_CAPABILITY_BINDING` (two bindings for one
  capability), normalizes thrown provider errors into a bounded (500-char)
  `FAIL`/`INTERNAL_ERROR` without ever forwarding the call, and normalizes a
  provider that returns the wrong `call_id`/`capability_id` into `FAIL`
  rather than silently passing through or silently patching over the
  mismatch (this makes S14A-HI-010 non-vacuous — see "design decisions"
  below). A legitimate provider `SUCCESS`/`FAIL`/`BLOCKED` result is
  otherwise forwarded verbatim, unmodified.

Test files (all new): `tests/capability-registry/{fixtures,fixtureTruth,
staticAudit,baseline,capabilityRegistry.test}.ts` — 56 focused tests.

## Design decisions a verifier should know about (not assumptions to trust blindly — check them)

1. **`call_id`/`capability_id` mismatch normalizes to `FAIL`, it is never
   force-corrected.** An earlier draft of this candidate silently rewrote a
   misbehaving provider's `call_id`/`capability_id` back to the request's
   own values before returning — that would have made S14A-HI-010
   ("registry preserves call_id and capability_id") vacuously true, since no
   input could ever violate it. Rejected in favor of detect-and-normalize-to-FAIL
   (proven by the `makeIdentityMismatchProvider` fixture and the
   "HI-010 non-vacuous" test), consistent with contract §17: "a provider's
   valid normalized FAIL/BLOCKED result is preserved" — a broken
   `call_id`/`capability_id` is not a valid result to begin with.
2. **`DUPLICATE_PROVIDER_ID` is the only *fatal* (constructor-throwing)
   finding.** `UNKNOWN_PROVIDER_REFERENCE` and `AMBIGUOUS_CAPABILITY_BINDING`
   are per-capability findings resolved to `BLOCKED` at list/invoke time
   instead, so one bad binding does not make every other capability in the
   same registry unconstructible. Semantic contract §17 describes both
   "route references unknown provider" and "two selected implementations"
   as "configuration invalid / fail closed" without mandating a specific
   channel; this reading satisfies both senses of "fail closed" (nothing
   ever silently resolves) while keeping the registry usable for its other,
   unaffected capabilities. `FX-NEG-002` and `FX-NEG-004` exercise the
   per-capability `BLOCKED` channel; `FX-NEG-005` exercises the fatal
   constructor-throw channel.
3. **`REQUIRED_CAPABILITY_MISSING` is used for three distinct causes**
   (totally unbound capability_id, empty/missing capability_id, and a
   binding to an unregistered provider id) — all three mean "no usable
   provider resolves for this capability" from the caller's perspective.
   `AMBIGUOUS_CAPABILITY_BINDING` is used only when more than one binding
   targets the same capability_id. These are the exact two reason-code
   tokens named in the Skill's fail-closed examples; both appear verbatim
   inside the `reason` string of the returned `BLOCKED` result (`reason` has
   no separate machine-readable code field in the existing Core
   `ToolInvocationResult` type, so the token is embedded in the text).
4. **The 6 numeric bounds in the quality contract's `limits:` block**
   (`max_registry_providers`, `max_registry_capabilities`,
   `max_capabilities_per_provider`, `max_safe_id_chars`,
   `max_descriptor_description_chars`, `max_diagnostic_refs`) are not hard
   invariants and are not enforced as runtime validation in this candidate —
   none of the 32 `S14A-HI-*` hard invariants or 28 negative fixtures require
   it, and adding unrequested bounds-checking would be speculative scope.
   All test fixtures stay well within those numeric bounds regardless.
5. **`PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY`** is a third, non-canonical
   reason token (not named verbatim anywhere in Part A) used for the one
   remaining fail-closed case: a resolvable, unambiguous binding whose
   selected provider's own `list_capabilities()` doesn't actually return a
   descriptor for the routed capability_id.

`FX-NEG-006` ("provider does not advertise routed capability") and
`FX-NEG-007` ("provider descriptor advertises mismatched capability id")
exercise **the same underlying guard** — `list_capabilities()`'s exact-string
`find(d => d.capability_id === capabilityId)` — through two constructions
(a provider advertising a totally unrelated id, and one advertising a
near-miss string), not two independently implemented mechanisms. Recorded
here explicitly so a verifier does not read the two fixture ids as proof of
two different code paths.

## Canonical Part A integrity

Git blob hashes of the three canonical Part A artifacts, at this candidate,
match the control-plane authorization comment `5548820269` exactly:

| Artifact | Blob |
|---|---|
| `brain-bootstrap/skills/CAPABILITY_REGISTRY_TOOLS_MCP_SKILL_S14.md` | `55a855d8223129b5cc5378bd2ba54671b7c991f3` |
| `brain-bootstrap/quality-contracts/S14_CAPABILITY_REGISTRY_TOOLS_MCP_DEEP.yaml` | `844ed67ff73b0f8f178407c2d7378135b3bc4045` |
| `brain-bootstrap/specs/CAPABILITY_REGISTRY_TOOLS_MCP_CONTRACT_S14.md` | `78564d6ccc1369f692a68d942e17e268d90df855` |

Verified twice: once via `git rev-parse HEAD:<path>` at branch construction
(before any edit), once again inside the automated test suite via
`tests/capability-registry/baseline.ts` (`gitBlobSha1()` — a from-scratch
reimplementation of `git hash-object`, independently confirmed to reproduce
`git`'s own hash for a real file before being trusted for anything else).

## Protected-surface byte identity

All confirmed byte-identical to baseline `ed95a98` via the same
git-blob-hash mechanism (`FX-NEG-021/022/023/027`, `UC08/UC09/UC11`):

- `src/core/agent/types.ts` (Core `CapabilityProvider` contract)
- `src/core/agent/restrictedCapabilityProvider.ts`
- `src/core/agent/definition.ts` (`AgentDefinition` schema)
- `src/intelligence/task-prompt-compiler/types.ts` (`ExecutionToolDeclaration`,
  S13G boundary)
- `src/intelligence/skills/definitions/taskPromptCompilerS13G.ts`
- `src/intelligence/skills/definitions/repositoryGitWorkflowS13H.ts`
  (S13H boundary)
- `package.json`, `package-lock.json` (no dependency change)

`git status --porcelain=v1` on the candidate branch shows only new,
untracked additions (`src/providers/capability/registry/`,
`tests/capability-registry/`, this report) — no existing tracked file was
modified, staged or deleted. `git diff --check`: clean.

Static structural proof (not just "it happened not to" in this run):
`src/providers/capability/registry/{capabilityRegistryProvider,
validateConfig}.ts` contain zero `fs`/`child_process`/`net`/`http`/`https`/
`fetch` import or call surface at all — verified by a regex scanner proven
non-vacuous first against planted violating snippets, then applied for real
(`FX-NEG-024/025/026`, `UC10`). The same scanner methodology (fire on a
planted violation, then scan the real source) is used for hidden
`process.env`/CLI-probing signals (`FX-NEG-009/010`, `UC02`), secret-shaped
content in descriptors/diagnostics (`FX-NEG-017..020`, `UC07`), test-only
branching (`S14A-HI-022`) and S15+ vocabulary (`S14A-HI-030`, `UC12`).
`src/core/**` was separately grepped for any `from`/`require` import of a
`providers/` path (`S14A-HI-029`) — none found (`src/core/agent/
definition.ts`'s own pre-existing doc-comment prose mentions `src/providers/`
descriptively; the check matches only real import/require statement shapes,
not prose, and was proven to actually match a planted import statement
first).

## Quality contract coverage

**Positives — exactly 12/12** (`FX-POS-001`..`FX-POS-012`), **negatives —
exactly 28/28** (`FX-NEG-001`..`FX-NEG-028`), by exact id set (not just
count) — enforced by a final assertion in `capabilityRegistry.test.ts`
against the canonical id lists in `fixtureTruth.ts`.

`FX-POS-003` (provider swap preserves `AgentDefinition` bytes) runs through
the **real Core path**: `compileAgentDefinition()` → `runAgent()` →
`RestrictedCapabilityProvider` → `CapabilityRegistryProvider` → selected
provider, using the existing `tests/agent/` harness pattern (a
`ModelProvider` fake issuing one real `TOOL_CALL` then `FINISH`). Two
configurations (provider A selected, then provider B selected) route through
the identical `AgentDefinition` fixture object; `JSON.stringify()` of that
fixture is captured before, between and after both runs and asserted
identical in all three snapshots ("byte identity" sense 1: the in-memory
object). `src/core/agent/definition.ts`'s on-disk contract byte identity
(sense 2) is checked separately and exhaustively above, not conflated with
sense 1.

All **32 S14A hard invariants** (`S14A-HI-001`..`S14A-HI-032`) and all **12
unsafe counters** (`UC01`..`UC12`) are exercised. Each unsafe counter is
proven non-vacuous by first running its detector/check against a
deliberately bad adversarial input or a small test-only "wrong"
mini-implementation (never touching production code) to show it can return
non-zero, then applying the same detector to the real candidate and
confirming exactly zero.

`FX-POS-010` ("multiple implementations registered but one explicit
selection resolves deterministically") uses two providers bound under two
*different* capability ids to prove only the selected one is ever invoked;
the same-id case (two providers both actually advertising one identical
`capability_id`) is what `S14A-HI-019` ("duplicate incompatible capability
descriptors are rejected") covers separately, proven by registering two
providers that both independently advertise the same nominal
`capability_id` with incompatible input schemas, binding only one of them,
and confirming `list_capabilities()` returns exactly one descriptor (the
selected provider's) with no merge/duplication attempt and the unselected
provider's `list_capabilities()` never even called.

`validateCapabilityRegistryConfig()` is also unit-tested directly (pure
function, no registry construction) against a config containing all three
finding types simultaneously, asserting the exact returned code set.

## QA

Node `v24.19.0` / npm `11.17.0` (`~/.local/bin/node` on this machine is a
symlink to nvm's Node `v22.23.1` and shadows nvm's shim earlier in `PATH`;
all commands below were run with nvm's `v24.19.0/bin` explicitly prepended
to `PATH`). `npm ci --ignore-scripts` was required to install dependencies:
this WSL environment has no `make`/`gcc` and no passwordless `sudo`, so
`better-sqlite3`'s implicit `node-gyp rebuild` install-script fails; the
package resolves at runtime through its own bundled N-API prebuild
(`node_modules/better-sqlite3/prebuilds/linux-x64.node`, ABI-stable across
Node versions), confirmed working under Node 24 (`require('better-sqlite3')`
succeeds) before any test ran. This is a lockfile-exact install
(`npm ci`) with zero dependency change.

- `typecheck` (`tsc --noEmit`): PASS, before and after adding S14A.
- `focused` (`tests/capability-registry/**`): **56/56 PASS**.
- `full_pre_build`: **1437/1437 PASS** across 26 files (baseline was
  1381/1381 across 25 files at this exact `ed95a98` baseline, confirmed
  before writing any S14A code).
- `dist_absent_before_build`: confirmed (`ls dist` → no such file).
- `build` (`tsc -p tsconfig.json`): PASS. 840 emitted files = 280 `.js` +
  280 `.d.ts` + 280 `.js.map` (272 baseline compiled units + 8 new S14A
  `.ts` files = 280; matches exactly).
- `full_post_build`: **1437/1437 PASS**, same count as pre-build.
- `git diff --check`: clean.
- `git status --porcelain=v1`: only new, untracked additions (listed
  above) — no existing tracked file touched.

## Boundaries respected

No Core semantic edit. No `AgentDefinition` schema edit. No new package
dependency. No filesystem/shell/git-process/GitHub/web/browser/PostgreSQL/
MCP/OAuth execution anywhere in the S14A production or test path (proven
structurally, not just by absence of observed side effects in this run). No
S15+ concept (Verifier Agent, Architecture Challenger, Workflow Runtime,
Delegation, Orchestrator, multi-agent routing, self-improvement, resource
manager) referenced in production source. S13G's unbound
`ExecutionToolDeclaration` shape (`{id, capability_ref}`) and S13H's
repository/git decision skill are untouched (byte-identical). `STATE.yaml`
and `CURRENT.md` were not touched by this candidate.

## What this builder is explicitly NOT claiming

This report does not claim `S14` is `CLOSED`, does not claim `HI-054` is
`AWARDED`, and does not self-approve S14A. `S14A` is
`BUILDER_PASS_AWAITING_INDEPENDENT_VERIFICATION`; `S14` remains `NOT_CLOSED`;
`HI-054` remains `NOT_AWARDED`. Per contract §25, the next required step is a
fresh, non-authoring, non-fork, read-only verifier independently reproducing
this evidence against the exact committed candidate SHA, followed by a
separate control-plane acceptance, before `S14B` may be authorized.
