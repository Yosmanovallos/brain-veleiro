# S14A Capability Registry Foundation — Corrected Builder Verification

Status: BUILDER_PASS_AWAITING_INDEPENDENT_VERIFICATION
S14: NOT_CLOSED
HI-054: NOT_AWARDED

## Scope and lineage

Baseline Part A: `ed95a984b41a8ae5df1d494743ec01b11dcf2381`.
Original Claude candidate: `0847d79a14e575da8ae4849fdef9b4a2316a631f`.
Correction branch: `codex/s14a-registry-corrections`.
The user requested completion of the current S14A implementation and correction
of errors left by the prior builder. This report supersedes that candidate's
builder claims; its original report remains available in git history.

Core, AgentDefinition, Part A, S13G, S13H, dependencies, STATE.yaml and CURRENT.md
remain unchanged. S14B and later phases are outside this implementation.

## Findings reproduced and corrected

The original suite passed 1437/1437, but did not establish the claimed safety.
The first 36 additional regression cases were run against the exact original
candidate in a detached worktree: 32 failed, 4 passed. The same 36 passed on the
corrected implementation. Two further tests bind the implementation limits and
fixture IDs to parsed canonical YAML and check aggregate catalog boundaries.

1. Raw thrown messages could expose credentials; list exceptions escaped through
   RestrictedCapabilityProvider. Failures now use constant safe messages, never
   inspect thrown values, and discovery failures expose an empty list.
2. Empty, oversized, credential-shaped and known vendor-qualified capability
   identifiers were accepted in configuration. Configuration now rejects those
   values and unexpected fields without echoing invalid input.
3. Diagnostics returned references to mutable internal routes. They now return
   detached values, sorted and capped at 128 entries. Internal route validation
   is not truncated, so capabilities beyond the diagnostic window still block.
4. Incompatible public schemas/side effects were accepted. The old HI-019 test
   explicitly expected that violation. It now requires rejection, with zero
   provider invocations. All registered catalogs are checked in sorted provider
   order, once per discovery/invocation operation. Only the selected provider is
   invoked. Duplicate advertisements are rejected; equivalent object-key order
   is accepted. Input/output schema, timeout and side-effect changes collide.
5. Descriptor and result shapes were trusted at runtime. Invalid catalogs,
   metadata, evidence and invocation results now fail closed. Returned objects
   and forwarded requests are detached from provider/caller-owned mutable data.
6. A descriptor could change after RestrictedCapabilityProvider authorized it.
   The registry now remembers published semantic contracts and blocks drift for
   its lifetime. Reconfiguration requires a new registry instance.
7. Canonical limits were not enforced. Provider/binding/catalog sizes, identifier
   and description lengths, and evidence/diagnostic counts are now bounded.
8. Secret fixtures only scanned clean values. FX-NEG-017..020 and UC07 now drive
   adversarial configuration, descriptors and exceptions through the real registry.

## Implementation decisions and limits

- Production is four provider-layer files: types, validateConfig, validation and
  capabilityRegistryProvider. No new Core abstraction or dependency exists.
- Invalid configuration and duplicate provider identities reject construction.
  Ambiguous routes and unknown provider references block affected capabilities.
- An invalid/throwing catalog fails discovery closed for the entire operation;
  incompatible valid advertisements exclude only their colliding capability.
  Unselected providers are inspected to enforce the canonical collision rule.
- Schema compatibility is conservative structural equality with sorted object
  keys, not a JSON Schema theorem prover. Names/descriptions may differ between
  compatible implementations; schemas, effects and timeout semantics may not.
- JSON contract validation is bounded to depth 32, 10000 nodes and 100000 encoded
  characters. Accessors, non-JSON values and recognizable credential patterns are
  rejected. Valid normalized results are preserved by value, not object identity.
- Credential recognition cannot identify every arbitrary opaque string. Provider
  implementations remain responsible for not putting secrets in public content;
  S14A introduces no credential resolver, vault, real adapter or external execution.
- Static scans complement runtime tests; they are not represented as proof about
  arbitrary injected third-party code. Canonical providers used here are in-memory.

## Contract evidence map

| Invariants | Executable evidence |
| --- | --- |
| HI-001,007 | FX-NEG-001/008 and invalid binding regressions |
| HI-002..006,017,018,020..022 | routing/ambiguity fixtures, explicit swap and order counterfactual, validation findings, static selectors |
| HI-008..010 | real compileAgentDefinition/runAgent swap, baseline byte identities, mismatched and mutated request/result regressions |
| HI-011,012,019 | missing/mismatched advertisements, collision matrix, duplicate and drift regressions |
| HI-013..015 | real RestrictedCapabilityProvider NONE/LOCAL/EXTERNAL and allowlist cases |
| HI-016 | throwing discovery/invoke, non-stringifiable thrown objects, malformed result regressions |
| HI-023,024,032 | runtime secret injection cases, bounded diagnostics/evidence, detached route regression |
| HI-025,026,028,029 | baseline blob checks, protected diff and Core import scan |
| HI-027,030 | source execution/late-stage scans and in-memory actual invocation fixtures |
| HI-031 | no S14 closure/HI-054 award claim; independent acceptance remains required |

The canonical fixture IDs remain exactly 12 positives and 28 negatives. The
additional regression cases are separate from those canonical ID sets. UC01..12
remain zero on legitimate paths, with planted violations/naive controls proving
the detectors fire. UC07 additionally checks actual exception output.

## Reproducible QA

Use WSL with the existing Node 24 installation and Linux node_modules:

```sh
export PATH=/home/yosman/.nvm/versions/node/v24.19.0/bin:$PATH
npm run typecheck
npm test -- tests/capability-registry --reporter=default
npm test -- --reporter=default
test ! -e dist
npm run build
npm test -- --reporter=default
git -c core.autocrlf=true -c core.safecrlf=false diff --check
```

Windows Node is 24.18.0, but the existing native dependencies are installed for
Linux. QA uses WSL Node 24.19.0/npm 11.17.0, without reinstalling dependencies or
changing the lockfile. Final measured counts are recorded in the completion
handoff after the final checks. Earlier corrected run: 92 focused, 1473 full
before/after clean build, 846 emitted files. Two later requirement-boundary tests
bring the measured final counts to 94 focused / 1475 full. Final QA passed on 2026-09-05: typecheck, 94/94 focused, 1475/1475 pre-build, dist-absent build (846 files), 1475/1475 post-build, and native Git diff check. Logs: ../brain-s14a-evidence/{pre-build,post-build}.log.

## Next gate

A fresh non-authoring, non-fork, read-only verifier must inspect the exact
committed corrected candidate. Its standalone relay must then receive separate
control-plane acceptance before main integration or S14B authorization.
This builder report is not an independent verifier approval.
