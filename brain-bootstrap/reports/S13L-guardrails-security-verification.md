# S13L Guardrails Security — Builder Verification

## Result

Builder identity: fresh non-fork Codex primary builder. Builder status: `PASS`; workflow status:
`INDEPENDENT_VERIFICATION_REQUIRED`.

S13L is a provider-neutral, capability-free, side-effect-free `SKILL_ONLY` decision layer. It
returns `ALLOW | APPROVAL_REQUIRED | BLOCKED` and implements no identity/policy/vault/crypto/auth
provider, middleware, enforcement runtime, Capability Registry or future-stage system.

## Authority and Part A integrity

- Matching issue #1 responses: `5457707989` and `5457770283`.
- Authoring commit/transfer: `73bf85e139b497edbb1ec16d4f6475b0a84f3a00`,
  `S13L_CHATGPT_PART_A_CANONICAL.md`, SHA-256
  `f8800cf97ab10dab247996a32a527f42d7d22a3ca0b286c901e59f32657e45e1`.
- Part-A-only integration commit: `30e896bb02bed2b44c023a5119e6ab12d15b0e3d`.
- Skill SHA-256: `572da7681d138de5549931f9df00a850c4152670a3ba2a3dcbf694c724f0b3af`.
- Quality Contract SHA-256:
  `cdaf6753dceef210208016c81acf3106c4d5f37079426ae7a442313c6d9e9f1c`.
- Contract SHA-256: `5f7eb7849934609870a09dd17ee8b9e45a8d878642754ed5bbed6bbc0f2e6bf5`.
- Part B verification target: `dac2ca5f28c36fccc045003dfece26a6086af951`.
- The three Part A files have an empty diff from their Part-A-only commit.

## Implemented surface

- `src/intelligence/guardrails-security/`: canonical types, pure boundary derivation, finite known-key
  secret defense, candidate validation/gate, real S12/S10/S09 harness and OI-A comparator.
- `src/intelligence/skills/definitions/guardrailsSecurityS13L.ts`: typed canonical Skill projection;
  capabilities `[]`, side effects `NONE`.
- `src/intelligence/skills/index.ts`: append-only fifteenth catalog registration.
- `tests/guardrails-security/`: eight positives, all exact 36 named negatives, independently
  projected frozen truth, real deterministic provider/runtime, anti-substitution regression,
  T1–T112-equivalent coverage and 30 exhaustive isolation probes.
- Prior S13J/S13K tests received only append-only catalog/future-step mechanical relaxation.

## Deterministic security evidence

- AuthN/AuthZ is deny-by-default. Protected identity requires verified trusted provenance; ordinary
  client fields, retrieved content and tool output cannot establish principal or scope authority.
- Tenant/resource mismatch requires an explicit policy-approved cross-scope grant. Confused-deputy
  redirection by tool output blocks.
- Capability permission is the conjunction of AgentDefinition, selected-Skill, caller and policy
  allowlists plus descriptor/action side-effect intersection; unknown capabilities block.
- High/destructive actions require an approved path. Approval must be exact-fingerprint, fresh at
  caller-supplied time and distinct when required. Recovery/irreversibility evidence is mandatory
  for destructive actions, and approval never overrides another failed gate.
- Secret-value fields are absent from the schema. A bounded recursive known-key defense and supplied
  HIGH findings block; this is explicitly finite and makes no perfect-detection claim. Opaque refs
  grant no authority and are not transported to disclosure, logs, memory or decision output.
- User payload, retrieval, tool output, history and external documents stay `DATA_ONLY`; direct and
  indirect injection cannot become task/policy/identity/permission/approval authority.
- Disclosure, logging and durable-memory field refs are independently bounded by declared purpose
  and authorization, with stricter secret-reference behavior.
- Protected operations require a provider-neutral enforcement point. Unknown/stale policy,
  fingerprint, impact or enforcement data fails closed.
- The actual candidate parsed from `runAgent()` reaches the gate. Corrupt atomic/spec markers survive
  to the blocked output, proving no faithful replacement. Extra candidate capability, side effect or
  disclosure projection also blocks.

## Real runtime and oracle isolation

Both arms use the same eight inputs, generic caller-supplied AgentDefinition type, deterministic
provider class, CapabilityProvider, parser, gate, evaluator, S10 compiler and S09 runtime. Only
materialized semantic Skill prose differs. S12 discovery is metadata-only and lazily loads exactly
the selected S13L definition.

The provider has no fixture-id, Skill-id or `withSkill` branch and imports no frozen truth. Frozen
truth imports only S13L types and pure fixture inputs; it imports/calls no provider, synthesizer,
parser, gate or evaluator.

## Exact Skill-vs-no-Skill / OI-A

```text
assertions per arm: 248 (8 fixtures × 31, including XC-A)
baseline correct: 120/248
with-Skill correct: 248/248
dimension-specific delta: +128
qualified dimensions: SD-001, SD-002, SD-003, SD-004, SD-005, SD-006, SD-007, SD-008 (8)
baseline hard invariants: 392/400
with-Skill hard invariants: 400/400
hard-invariant regression: false
threshold: PASS
```

Raw improved-instance contributions grouped by assertion id:

```text
SD-001: SD1-A=8 SD1-B=8 SD1-C=0 (delta 16, max share 1/2)
SD-002: SD2-A=8 SD2-B=8 SD2-C=0 (delta 16, max share 1/2)
SD-003: SD3-A=8 SD3-B=8 SD3-C=0 (delta 16, max share 1/2)
SD-004: SD4-A=8 SD4-B=8 SD4-C=0 (delta 16, max share 1/2)
SD-005: SD5-A=8 SD5-B=8 SD5-C=0 (delta 16, max share 1/2)
SD-006: SD6-A=8 SD6-B=8 SD6-C=0 (delta 16, max share 1/2)
SD-007: SD7-A=8 SD7-B=8 SD7-C=0 (delta 16, max share 1/2)
SD-008: SD8-A=8 SD8-B=8 SD8-C=0 (delta 16, max share 1/2)
SD-009: SD9-A=0 SD9-B=0 SD9-C=0 (delta 0, max share 0)
SD-010: SD10-A=0 SD10-B=0 SD10-C=0 (delta 0, max share 0)
```

All 30 IDs own one atomic candidate leaf. The 30-probe regression deep-clones the candidate, mutates
one owned leaf, proves only its exact ID changes, proves no sibling or XC-A change, and proves the
pre-mutation observation snapshot remains detached.

Unsafe counters with Skill:

```text
auth_bypass=0
cross_tenant_authority=0
overbroad_capability=0
destructive_approval_bypass=0
secret_value_propagation=0
untrusted_instruction_elevation=0
sensitive_data_overdisclosure=0
provider_or_future_stage_binding=0
```

## Builder adversarial review repairs

1. Secret-reference propagation initially allowed caller flags to widen `TRANSIENT_ONLY`; the final
   gate treats the decision as non-transport and blocks user/log/memory propagation, with three
   explicit regressions.
2. Candidate atomic checks initially did not reject extra terminal permission/disclosure fields;
   the final gate blocks capability, side-effect and disclosure smuggling.
3. Runtime enum handling now fails closed for unknown impact/enforcement values.
4. Non-NONE side effects without a requested bounded capability now fail impact validation.
5. Content-source tests now cover USER_PAYLOAD, RETRIEVED_CONTENT, TOOL_OUTPUT, HISTORICAL_MEMORY and
   EXTERNAL_DOCUMENT individually; logging and durable memory independently require purpose+authz.
6. All 36 negative fixtures now carry the exact canonical condition names, not numeric count alone.

## Canonical final QA

WSL Node `v24.19.0` on the final candidate:

- `npm run typecheck`: PASS, zero errors.
- focused S13L: 115/115 PASS (85 canonical/boundary/runtime tests + 30 isolation probes).
- full pre-build suite: 973/973 PASS.
- Existing ignored `dist` was moved to an exact validated sibling temp path; `dist` was confirmed
  absent; `npm run build` PASS; generated `dist` confirmed; generated output removed and the prior
  ignored `dist` restored byte-for-byte at its original path.
- full post-build suite: 973/973 PASS.
- eight positives and all 36 named negatives: exact expected outcomes.
- `git diff --check`: PASS.
- package manifests, `src/core/` and Part A: unchanged.

## Boundary audit

No new AgentDefinition, Core branch, dependency, Capability Registry/S14, MCP/connector/tool
provider, identity/policy/tenant platform, vault/KMS/crypto/auth middleware, server/network
enforcement, prompt-filter vendor, compliance framework, persistent handle or S13M/N/O/P/Q/R
implementation was added. S13M remains `NOT_STARTED` and forbidden.

## Required next action

A different fresh non-authoring, non-fork, read-only verifier must independently reproduce the exact
target, hashes, 115 focused/973 full counts, 8/36 fixtures, candidate anti-substitution, real runtime,
30/30 isolation, raw OI-A figures, eight zero unsafe counters and boundaries. Only its `VERIFIED PASS`
may close S13L and authorize S13M.
