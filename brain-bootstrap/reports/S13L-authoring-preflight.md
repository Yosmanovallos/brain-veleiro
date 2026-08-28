# S13L Guardrails Security — ChatGPT Authoring Preflight

## Gate

```text
CHATGPT AUTHORING REQUEST
Step: S13L
Purpose: Author the complete canonical Part A for guardrails-security.
Controller action now: INSPECT + EVIDENCE ONLY
Part B: FORBIDDEN UNTIL VERBATIM INTEGRATION
```

## Canonical step contract

```text
S13L — guardrails-security
AuthN/AuthZ, tenants, secrets, tool permissions, prompt injection, destructive-action policy.
```

Every S13x must integrate ChatGPT-authored Intelligence semantics, use positive and negative examples,
run through the real S12→S10→S09 path, prove improvement over no Skill, pass deterministic QA and
receive a different fresh independent verification before the next step.

## Verified repository facts

- Branch `main`; inspected start `HEAD == origin/main == 06909c4ed50cb62602b3f354b609451b6a57917c`.
- S00–S13K are independently `VERIFIED PASS`; current full suite is 858/858 on WSL Node 24.19.
- No S13L Skill, Quality Contract, spec, source module, tests, AgentDefinition, catalog entry,
  capability, dependency, auth provider, tenant platform or secret manager exists.
- The append-only Skill catalog has fourteen entries and ends with S13K.
- Core `RestrictedCapabilityProvider` generically filters discovery and invocation by explicit
  capability ID and allowed side-effect class (`NONE | LOCAL | EXTERNAL`). Agent and Skill contracts
  require deny-unlisted behavior; Core contains no role/S13L-specific branch.
- S13I already models provider-neutral authentication/authorization modes, trusted scope source,
  authorization-before-effect and non-authoritative client identity fields. It does not implement an
  auth provider, tenant platform, policy engine or secret manager.
- S13G rejects bounded known/explicit credential shapes from compiled execution packages. Its own
  source explicitly describes a finite pattern set, not universal secret detection.
- S13H treats destructive/history-rewrite Git operations as forbidden by default, requires explicit
  write authorization and blocks supplied high-confidence secret findings; it does not define the
  general S13L policy.
- S13J defers encryption/key-management/auth policy, requires references for secret-bearing storage
  intent and does not put secret values in fixtures/DDL. S13K consumes approved security/approval
  refs and explicitly denies client-side authorization enforcement.
- The existing S12 lazy Skill discovery → unchanged S10 compile → unchanged S09 runtime supports a
  caller-supplied generic host and deterministic provider, so no new AgentDefinition is presumed.

## Authority and boundaries to preserve

- S13L owns provider-neutral guardrail/security reasoning and policy contracts, not a concrete
  security product or production enforcement integration.
- Preserve S13I request/auth/error meanings, S13J tenant/storage declarations and S13K UI boundaries;
  S13L may validate/compose their approved facts but must not silently rewrite them.
- S14 owns executable Capability Registry/tool/MCP binding; S13L may constrain permissions and
  invocation policy without implementing the registry or a vendor adapter.
- S13M owns general QA/debugging; S13N agent-eval infrastructure; S13O retry/async mechanics; S13P
  observability; S13Q delivery; S13R deployment.
- No live credentials, secret values, personal data, tokens, cookies or authorization headers may
  enter artifacts, fixtures, prompts, logs, reports or git.
- Part B must not add an identity provider, policy engine, vault/KMS, crypto/auth middleware, network
  server, prompt-filter vendor, browser runtime, telemetry vendor, deployment or future-stage system.

## Requested canonical Part A targets

1. `brain-bootstrap/skills/GUARDRAILS_SECURITY_SKILL_S13L.md`
2. `brain-bootstrap/quality-contracts/S13L_GUARDRAILS_SECURITY_<DEPTH>.yaml`
3. `brain-bootstrap/specs/GUARDRAILS_SECURITY_CONTRACT_S13L.md`

The transfer must be byte-ready, complete, internally consistent and delimited by exact path. It
must include canonical resolutions and explicit unresolved gaps.

## Questions ChatGPT must resolve

1. exact execution mode under the S13E hierarchy and justified Quality depth;
2. provider-neutral bounded input, decision, status, blocker and evidence schemas;
3. the distinction between authentication, authorization, resource/tenant scoping, policy decision,
   UI visibility and enforcement, with deny-by-default semantics;
4. trusted identity/tenant provenance and prevention of client/prompt/tool-output authority claims;
5. least-privilege capability/tool permission composition across AgentDefinition, selected Skills,
   tool descriptors, caller authorization and side-effect classes;
6. destructive/irreversible/high-impact action classification, approval/confirmation, separation of
   proposer and approver, recovery evidence, freshness and fail-closed behavior;
7. secret-reference lifecycle without secret values: allowed references, redaction, propagation,
   logging/memory/context/output restrictions and limitations of deterministic detection;
8. prompt-injection and untrusted-content model: instruction/data separation, provenance, authority
   order, indirect injection, retrieved content/tool output, conflicting instructions and safe stop;
9. tenant isolation and cross-tenant confused-deputy prevention without inventing a tenant platform;
10. handling unknown/insufficient policy, ambiguous identity, stale approval, missing evidence,
    overbroad capability and unavailable enforcement points;
11. privacy/sensitive-data minimization and output disclosure without authoring a complete compliance
    framework not evidenced by the repo;
12. canonical security-decision artifacts, traceability and anti-self-certification gate over the
    actual parsed candidate;
13. at least six diverse positive fixtures and meaningful negatives spanning auth bypass, forged
    tenant/user identity, cross-tenant access, secret leakage, direct/indirect injection, overbroad
    permissions, destructive action without approval, stale approval, unsafe tool output and
    provider/future-stage pull-forward;
14. real S12→S10→S09 execution with one deterministic truth-blind provider and no fixture-ID,
    Skill-ID or `withSkill` branching;
15. frozen provider-blind truth and OI-A dimensions/assertions that are genuinely independent, with
    exhaustive atomic-isolation regressions from the outset, raw contribution shares, thresholds and
    zero unsafe/security recommendation counters;
16. exact T1–Tn coverage, allowed Part B modules and forbidden scope;
17. explicit boundaries to S13M/N/O/P/Q/R and S14, and whether a new AgentDefinition is forbidden.

## Constraints and non-goals

- Codex must not author or silently revise S13L semantics.
- Do not modify Core, prior canonical Part A semantics or earlier verified behavior unless ChatGPT
  explicitly identifies a separately authorized compatibility change.
- Do not claim perfect secret or prompt-injection detection, complete OWASP/compliance coverage,
  cryptographic correctness, production authorization enforcement or provider-specific security.
- A deterministic provider may see only bounded input plus materialized Skill content, never frozen
  truth, fixture identity, arm markers or evaluator helpers.
- Truth must not import/call provider, synthesizer, parser, gate or evaluator; observation IDs must
  own disjoint atomic field families and be adversarially proven.

## Acceptance for the authoring transfer

- three complete artifacts at exact paths plus canonical resolutions/unresolved gaps;
- standalone parseable Quality Contract YAML and TypeScript-compatible provider-neutral shapes;
- explicit hard invariants, adjacent-step boundaries, positives, negatives and T1–Tn matrix;
- actual-candidate gate, OI-A with atomic isolation, safety counters and exact allowed Part B scope;
- no invented repository state or secret-bearing example data.

## Required ChatGPT action

Author the complete canonical S13L Part A transfer on a temporary authoring branch. Do not implement
Part B or modify `main`. If evidence is insufficient, mark the exact gap instead of inventing it.
