# S12 — Skill Registry / Skill Contract v1 — Verification Report

Part A (semantic authoring): `brain-bootstrap/specs/SKILL_CONTRACT_v1.md`, authored by ChatGPT, integrated verbatim.
Part B (this report): Claude Code implementation, tests, and verification.

## 1. Implementation inventory

| Path | Role |
|---|---|
| `src/core/skill/types.ts` | Skill Contract v1 type definitions (`SkillDefinition`, `SkillDescriptor`, `SkillProvider`, `SkillDiscoveryRequest`, `SkillLoadRequest`, `SkillCatalogEntry`, `SkillApplicability`, `SkillIOField`, `SkillRequirements`, `SkillRule(Level)`, `SkillProcedureStep`, `SkillVerificationCheck(Kind)`, `SkillPermissionPolicy`) |
| `src/core/skill/validateSkillDefinition.ts` | `validateSkillDefinition()` — structural validator |
| `src/core/skill/descriptor.ts` | `toSkillDescriptor()` — metadata-only projection |
| `src/core/skill/index.ts` | Core re-exports |
| `src/providers/skill/localReferenceSkillProvider.ts` | `LocalReferenceSkillProvider implements SkillProvider` — bounded metadata-only discovery, lazy exact-selection load, deterministic lexical ranking |
| `src/intelligence/skills/definitions/referenceSummarize.ts` | trivial reference Skill |
| `src/intelligence/skills/definitions/referenceFormatCheck.ts` | trivial reference Skill |
| `src/intelligence/skills/definitions/researchEvidenceGroundedS11.ts` | typed runtime migration of `RESEARCH_SKILL_S11.md`, non-destructive |
| `src/intelligence/skills/selectSkillForTask.ts` | `selectSkillForTask()` — Agent-allowlist-bounded selection/load helper |
| `src/intelligence/skills/index.ts` | `referenceSkillCatalogEntries` (3 entries), re-exports |
| `tests/skill/fixtures.ts` | `buildValidSkillDefinition()`, `clone()` |
| `tests/skill/skillContract.test.ts` | T1–T20 + T13B, 37 test cases |

No production dependency was added (`package.json`/`package-lock.json` diff against S11 is empty).

## 2. Test results — T1–T20 (+ T13B)

All 21 `describe` blocks / 37 `it` cases pass.

| ID | Assertion | Result |
|---|---|---|
| T1 | Valid `SkillDefinition` accepted | PASS |
| T2 | Malformed required fields rejected (one case per field) | PASS |
| T3 | `applies_when` validation (empty `task_kinds`, missing `signals`) | PASS |
| T4 | Structured IDs (rules/procedure/verification) are unique | PASS |
| T5 | `requires.capabilities` ⊆ `permissions.allowed_capabilities` invariant | PASS |
| T6 | `permissions.allowed_side_effects` reuses S09's `ToolSideEffectClass` vocabulary (no redefinition) | PASS |
| T7 | `toSkillDescriptor()` output is metadata-only (no `procedure`/`verification`/full I/O content) | PASS |
| T8 | `discover()` never returns more than the resolved limit; explicit `limit` respected; `limit > 20` is **clamped to 20**, not rejected (documented decision, §3 below) | PASS |
| T9 | `discover()` invokes **0** `load_definition` calls — metadata-only | PASS |
| T10 | Deterministic lexical ranking: research-like query ranks the Research Skill first; a `summarize`-style query ranks `referenceSummarize` first | PASS |
| T11 | `AgentDefinition.skills` allowlist excludes a Skill from discovery/selection/load even when lexically relevant | PASS |
| T12 | Empty allowlist selects nothing; never falls back to the global catalog | PASS |
| T13 | `provider.load()` is lazy and exact: selected loader called exactly 1×, unrelated loaders 0× | PASS |
| **T13B** (added during verification, not in original T1–T20) | `selectSkillForTask()` end-to-end through the **real, unmodified** `researcherDefinition` loads only the Research Skill (1×); a second case with an allowlist covering all 3 Skills still loads only the 1 selected Skill after ranking 3 discovered candidates | PASS |
| T14 | Unknown Skill id load fails with a deterministic `Unknown Skill id` error | PASS |
| T15 | Exact-version semantics: mismatched version rejected, matching version accepted | PASS |
| T16 | Loaded `SkillDefinition` is revalidated (structurally invalid loaded content is rejected, not trusted blindly) | PASS |
| T17 | S11 Research Skill migration preserves protected semantics (KGA/evidence/cross-check/contradictions/unknowns/VOI/traceability rules present, `output_schema`/`context_sources` reused by reference from `researcherDefinition`) | PASS |
| T18 | S10 `compileAgentDefinition()` path unchanged by S12 (no Skill content injected) | PASS |
| T19 | No `skill.id === ...` (or equivalent) conditional exists anywhere in `src/core/` | PASS |
| T20 | Full regression touch-point: S09/S10/S11 existing test suites still pass unmodified | PASS |

**Why T13B was added:** the original T1–T20 suite proved lazy-exact-load only via direct `provider.load()` calls (T13) and only tested `selectSkillForTask()` with a *mutated clone* of `researcherDefinition` (T11/T12), never the real production `researcherDefinition.skills` allowlist. This left §26's central invariant — "It MUST NOT load every discovered Skill merely to rank them; only the selected Skill may be fully loaded" — unproven for the actual production selection path, and left `researcherDefinition.skills = ["research.evidence-grounded.s11"]` itself unverified against the real catalog (an id rename could have silently broken production selection without failing any test). T13B closes both gaps.

**T11 fix during verification:** the original T11 assertions used `.not.toBe(researchEvidenceGroundedS11.id)` against `result.selected?.id` / `result.loaded?.id`. If discovery had returned nothing (`undefined`), those assertions would still pass vacuously. Strengthened to assert the positive expected outcome (`referenceFormatCheck.id`), so the test now distinguishes "allowlist filtered correctly" from "discovery silently broke."

## 3. Deterministic implementation decisions made in Part B (not fixed by the contract's literal text)

- **`discover()` limit > 20**: SKILL_CONTRACT_v1.md leaves "rejected or bounded" open for a limit above `MAX_LIMIT`. Implemented as **clamp to 20**, not reject. Non-integer or `< 1` limits are rejected outright (`Error`). Covered by T8.
- **`load()` step ordering**: implemented in the literal §24 order — locate → fail-if-unknown → invoke loader → validate loaded definition → verify id match → verify version match → return — rather than checking version before invoking the loader.
- **`SkillCatalogEntry` layering**: the type lives in `src/core/skill/types.ts` (Core-adjacent, generic data shape) so `src/intelligence/skills/index.ts` can assemble `referenceSkillCatalogEntries` importing only Core types and its own Skill definitions, with zero import of any concrete Provider. `LocalReferenceSkillProvider` (Providers) consumes `SkillCatalogEntry[]` at the call site, mirroring how `AgentRuntimeDependencies` are injected at call sites rather than wired inside Intelligence.

## 4. Quality checks

- `npm run typecheck` — 0 errors.
- `npm test` (pre-build) — **121/121 passed** (84 pre-S12 + 37 new S12 tests: 35 original T1–T20 + 2 T13B cases).
- `rm -rf dist && npm run build` — succeeded, no errors.
- `npm test` (post-build) — **121/121 passed**, unchanged. Zero regressions.

## 5. Mechanical boundary checks

1. `grep -rniE 'skill\.id[[:space:]]*===' src/core/` → **NONE FOUND**. No Skill-name conditional branching anywhere in Core.
2. `grep -rn "from \"../../providers\|from \"../providers\|from \"../../intelligence\|from \"../intelligence" src/core/skill/` → **NONE FOUND**. `src/core/skill/` imports nothing from Providers or Intelligence.
3. `git diff --stat -- src/core/agent/compileDefinition.ts src/core/agent/runtime.ts` → empty diff. S10's compile path and S09's runtime loop are untouched by S12.
4. `git diff --stat -- package.json package-lock.json` → empty diff. No new dependency was needed for S12 (unlike S11, which added `js-yaml`).

## 6. Discovery/loader-invocation evidence (concrete numbers)

- Reference catalog size: **3** descriptors (`research.evidence-grounded.s11`, `referenceSummarize`, `referenceFormatCheck`) — `src/intelligence/skills/index.ts`.
- `discover()` loader invocations: **0**, always — proven by T9 (spied loaders across all 3 entries, none called after `discover()`).
- `load()` loader invocations for the selected Skill: **exactly 1** — proven by T13 (direct call) and T13B (through `selectSkillForTask()`).
- `load()` loader invocations for unrelated Skills during a selection: **0** — proven by T13 and both T13B cases, including the case where all 3 Skills are allow-listed and discovery legitimately ranks 3 candidates before loading only the top 1.

## 7. Allowlist and exact-version rejection evidence

- Allowlist rejection: T11 — `referenceFormatCheck`-only allowlist excludes the lexically-favored Research Skill entirely from `discovered`; T12 — empty allowlist selects nothing and never falls back to the global catalog.
- Exact-version rejection: T15 — requesting `researchEvidenceGroundedS11` at version `"999.0.0"` rejects with a `version mismatch` error; requesting the exact current version succeeds.

## 8. S11 migration fidelity

`researchEvidenceGroundedS11` (T17):
- Reuses `researcherDefinition.output_schema` and `researcherDefinition.context_policy.allowed_sources` **by reference** (not re-typed), so the migration cannot silently drift from the S11 AgentDefinition contract.
- All 7 protected S11 rule families are present as individually-identified `rules[]` entries: `R-KGA`, `R-EVIDENCE`, `R-CROSSCHECK`, `R-CONTRADICTIONS`, `R-UNKNOWNS`, `R-VOI`, `R-TRACEABILITY`.
- `brain-bootstrap/skills/RESEARCH_SKILL_S11.md` remains the canonical authored source; this file is a derived, non-destructive typed runtime representation only — nothing in the Markdown was deleted, weakened, or overridden.

## 9. Limitations / deferred, non-blocking

- **Reference aliasing, not defensive copying**: `researchEvidenceGroundedS11.outputs[0].schema` and `.requires.context_sources` share object/array references with `researcherDefinition`, and `toSkillDescriptor()` passes `applies_when` by reference (while shallow-copying its sibling array fields). Nothing in the current codebase mutates these values post-construction, so this is not a live defect, but it is inconsistent with the rest of `toSkillDescriptor()`'s copy behavior. Worth a defensive-copy pass if either object ever becomes mutable at runtime.
- **Laziness is thunk-level, not module-level**: `load_definition: async () => researchEvidenceGroundedS11` (and the other two entries) close over statically-imported `SkillDefinition` objects, so the full catalog is already resident in memory once `src/intelligence/skills/index.ts` is imported — there is no dynamic `import()` deferring module load. SKILL_CONTRACT_v1.md §22 explicitly permits this ("the exact mechanism is an implementation detail"; the invariant it enforces is *loader-call counts*, which T9/T13/T13B prove directly). Stated here for clarity, since "lazy loading" could otherwise be misread as dynamic module loading.
- **§24 step 5 (loaded-id-mismatch guard) has no dedicated test**: T14/T15/T16 cover unknown-id, version-mismatch, and revalidation-of-invalid-content respectively, but no test forces `load_definition()` to return a definition whose `id` differs from the requested id. Not required by the T1–T20 contract; the guard exists in `localReferenceSkillProvider.ts` (line `if (definition.id !== request.id) ...`) but is currently unreachable by any real catalog entry, since every entry's loader returns its own statically-referenced constant.

## 10. Bugs found and fixed during this verification pass

None in the implementation itself. Two **test-coverage gaps** were found (both in `tests/skill/skillContract.test.ts`, not in `src/`) via an independent advisor review before this report was finalized, and both are fixed above:
1. T11 could pass vacuously on a broken discovery path (`.not.toBe` against a possibly-`undefined` value) — fixed to assert the positive expected result.
2. §26's central "never load every discovered Skill merely to rank" invariant, and the production `researcherDefinition.skills` allowlist itself, were untested through the real `selectSkillForTask()` path — fixed by adding T13B.

## 11. Conclusion

S12 Part B is implemented and verified: typecheck clean, 121/121 tests passing pre- and post-build, all four mechanical Core-boundary checks pass, the S11 migration is faithful and non-destructive, and the contract's central anti-over-fetch invariant is now proven end-to-end through the real production Researcher AgentDefinition, not just through synthetic fixtures.

**PASS.**
