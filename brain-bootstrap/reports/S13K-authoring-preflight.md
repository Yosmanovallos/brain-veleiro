# S13K Frontend Product Surface — ChatGPT Authoring Preflight

## Gate

```text
CHATGPT AUTHORING REQUEST
Step: S13K
Purpose: Author the complete canonical Part A for frontend-product-surface.
Builder action now: INSPECT + EVIDENCE ONLY
Part B: FORBIDDEN UNTIL INTEGRATION
```

## Canonical step contract

```text
S13K — frontend-product-surface
User flows and loading/empty/error/retry/approval/rejection states; basic accessibility.
```

Every S13x must integrate a ChatGPT-authored Skill/knowledge contract, create positive and negative
examples, run an eval through the real agent runtime, prove improvement versus no Skill, repair
mechanical defects locally, and receive fresh independent verification before the next S13x.

## Verified repository facts

- branch `main`; inspected start HEAD/origin `044337619871469c35251bb7d078551f785b86b3`;
- S00–S13J are `VERIFIED PASS`; S13J independent report is versioned;
- current Node 24.19 baseline: typecheck PASS, full suite 768/768, clean build PASS;
- no S13K Skill, Quality Contract, spec, source module, test suite, AgentDefinition, or catalog entry;
- there is no React/Vue/Svelte/DOM/browser/UI framework, CSS system, component library, browser-test
  dependency, generated app shell, or frontend build pipeline;
- the Skill catalog has 13 append-only entries, ending with S13J;
- S13I exposes provider-neutral request, success-response, stable safe-error, auth-boundary,
  collection/pagination, compatibility, acceptance, and evidence contracts suitable as bounded
  upstream surface intent; it does not define screen/component behavior;
- S13J is SKILL_ONLY data-model planning and is not a frontend dependency;
- the real S12 discovery/lazy-load → S10 compile → S09 agent runtime path accepts a caller-supplied
  generic host/model provider and has supported all prior S13x evals without a new AgentDefinition.

## Authority and boundaries to preserve

- Core depends on contracts, never frontend frameworks or concrete rendering implementations;
- S13K owns product-surface reasoning: user journeys, information hierarchy, interaction/state
  contracts, form behavior, feedback, responsive intent, and basic accessibility evidence;
- S13I owns backend API/request/response/error semantics. S13K may consume explicit upstream API
  contracts but must not silently change them;
- S13L owns AuthN/AuthZ, tenants, secrets, prompt injection, permissions, and destructive-action
  security policy. S13K may represent approved security/approval requirements but not invent policy;
- S13O owns retry/backoff/idempotency/async-job runtime mechanics. S13K owns only user-visible state
  and bounded retry affordance derived from upstream contracts;
- S13P owns AI-system observability; S13Q delivery/demo docs; S13R deployment; S14 executable
  browser/tool capability binding;
- S13K Part B must not add a web app, UI framework, browser automation runtime, design system
  package, server, auth provider, telemetry provider, deployment, or later-step implementation.

## Requested canonical Part A targets

1. `brain-bootstrap/skills/FRONTEND_PRODUCT_SURFACE_SKILL_S13K.md`
2. `brain-bootstrap/quality-contracts/S13K_FRONTEND_PRODUCT_SURFACE_<DEPTH>.yaml`
3. `brain-bootstrap/specs/FRONTEND_PRODUCT_SURFACE_CONTRACT_S13K.md`

The transfer must be byte-ready, complete, internally consistent, and separately delimited by exact
path. Include canonical resolutions and explicit unresolved gaps.

## Questions ChatGPT must resolve

1. exact execution mode under the S13E hierarchy and justified Quality depth;
2. canonical provider-neutral input/result types and terminal READY/BLOCKED semantics;
3. how approved goals, actors, acceptance criteria, API variants/errors, constraints, and evidence
   enter without inventing screens, permissions, data, copy, branding, or business policy;
4. user-flow graph rules: entry points, goals, transitions, back/cancel, success, interruption,
   recovery, approval/rejection, and unreachable/dead-end detection;
5. surface/information-hierarchy contract and what may count as a page, region, component, dialog,
   notification, or nonvisual interaction without binding a framework;
6. canonical state matrix for initial/loading/progressive/empty/success/validation/error/offline-or-
   unavailable/retry/disabled/approval-pending/approved/rejected/permission-denied states;
7. form/input rules: labels, instructions, requiredness, validation timing, error association,
   preservation of user input, submit lifecycle, duplicate submit, cancel and destructive intent;
8. retry and optimistic/pessimistic interaction rules while preserving the S13O boundary;
9. accessibility baseline: semantic structure, keyboard/focus order/restoration, visible focus,
   accessible names/descriptions/errors/status announcements, contrast/motion/touch-target intent,
   and explicit exceptions/evidence without claiming browser conformance prematurely;
10. responsive/adaptive behavior, content priority, overflow and reduced viewport rules;
11. loading/empty/error copy and actionability without fabricating product voice or localization;
12. how auth/authorization/tenant state is represented without client-side security enforcement;
13. approval/rejection and destructive-action UX boundary with S13L and human authority;
14. evidence artifacts: flow graph, surface inventory, state matrix, interaction contract,
    accessibility checklist, traceability, and optional render-neutral prototype schema;
15. anti-self-certification: invariants/status/blockers recomputed from bounded input and candidate;
16. canonical positives and negative cases including missing loading/empty/error, dead-end flow,
    inaccessible control, focus loss, unassociated validation, retrying unsafe action, hidden
    authorization assumption, fabricated API state, destructive action without approved guardrail,
    framework/browser/provider pull-forward, and inaccessible responsive behavior;
17. real S12→S10→S09 execution and truth-blind deterministic provider constraints;
18. OI-A-safe distinct dimensions/thresholds with frozen provider-blind truth, at least three
    genuinely different assertion IDs per qualifying dimension, raw grouped contributions, and no
    cross-cutting assertion used to qualify a dimension;
19. exact T1–Tn semantic coverage and allowed Part B file/module scope;
20. explicit boundary to S13L/S13O/S13P/S13Q/S13R/S14 and whether a new AgentDefinition is forbidden.

## Constraints and non-goals

- Codex must not author or silently revise S13K semantics.
- Do not add a frontend framework, DOM renderer, CSS system, component library, browser dependency,
  web server, auth provider, telemetry vendor, deployment, or Capability Registry.
- Do not modify S13I/S13J canonical semantics or prior Skill behavior.
- Preserve provider-neutral Core/runtime boundaries and append-only Skill catalog order.
- A deterministic reference model is allowed only if it executes through the real runtime, sees no
  frozen truth, and cannot branch on fixture ID, Skill ID, or a with-Skill flag.
- Comparison truth must not import/call the production provider, synthesizer, parser, gate, or
  evaluator, and assertion IDs must represent distinct observations rather than aliases.

## Acceptance for the authoring transfer

- three complete artifacts at exact paths plus canonical resolutions and unresolved gaps;
- standalone parseable Quality Contract YAML;
- TypeScript-compatible framework-neutral input/output shapes;
- explicit adjacent-step boundaries and forbidden scope;
- enumerated T1–Tn cases, six-plus positives, meaningful negatives, evidence categories, and OI-A;
- no invented repository state; facts/decisions/proposals/blocked gaps distinguished.

## Required ChatGPT action

Author and deliver the complete canonical S13K Part A transfer. Do not implement Part B. If a
repository fact is insufficient, mark the exact gap rather than inventing it.
