# FRONTEND_PRODUCT_SURFACE_SKILL_S13K

## Identity

```yaml
id: intelligence.frontend-product-surface.s13k
version: 1.0.0
step: S13K
name: frontend-product-surface
quality_depth: DEEP
execution_mode: SKILL_ONLY
provider_neutral: true
```

## Purpose

Produce one render-neutral, framework-neutral product-surface decision from bounded user goals and approved upstream contracts.

The Skill owns user-flow, surface/state/form/feedback/responsive/basic-accessibility reasoning. It does not implement a frontend.

## Requires

```yaml
requires:
  skills: []
  capabilities: []
  context_sources:
    - CURRENT_PRODUCT_TASK
    - APPROVED_SPEC
    - APPROVED_API_CONTRACTS
    - APPROVED_SECURITY_APPROVAL_RETRY_POLICY_REFS
    - ACCEPTANCE_EVIDENCE
  quality_contract_refs:
    - S13K_FRONTEND_PRODUCT_SURFACE_DEEP
```

## Permissions

```yaml
permissions:
  allowed_capabilities: []
  allowed_side_effects:
    - NONE
  deny_unlisted_capabilities: true
```

## Input

Canonical: `FrontendProductSurfaceInput`.

It contains bounded task/spec/actor/goal/API/policy/form/acceptance/evidence inputs. Inputs are immutable.

## Output

Canonical: `FrontendProductSurfaceDecision` with status `READY | BLOCKED`.

## Rules

1. One bounded product-surface task per decision.
2. Framework/browser/provider neutral.
3. Every required goal reachable from a valid entry.
4. No unreachable required surface.
5. No nonterminal dead end.
6. Recoverable failures require recovery or safe exit.
7. Multi-step interruptible flows declare back/cancel/exit behavior.
8. Every applicable upstream API/error/auth state maps to explicit surface behavior.
9. Do not fabricate API/auth/tenant/business-policy states.
10. Loading, empty, error, permission and approval states remain semantically distinct.
11. Retry affordance requires upstream retry safety/idempotency/S13O policy.
12. Duplicate submit is disabled while pending unless explicitly proven safe.
13. Destructive action requires supplied guardrail/approval ref.
14. Frontend never self-approves or acts as authorization enforcement.
15. Forms have accessible name/label intent and associated validation errors.
16. Recoverable form failure preserves input unless an approved reason says otherwise.
17. Async/status changes have announcement intent when required.
18. Dialog/navigation transitions declare focus placement/restoration intent.
19. Required actions are keyboard-operable in the contract.
20. PRIMARY content/action remains reachable in NARROW/MEDIUM/WIDE.
21. Responsive reordering preserves semantic/focus-order intent.
22. Dense collections declare narrow-viewport behavior.
23. Raw backend/internal/secret details never become user copy.
24. Copy intent does not invent brand/legal/localization text.
25. Accessibility contract is intent/evidence, not a false browser-conformance claim.
26. S13I semantics are consumed, not rewritten.
27. S13L security policy is referenced, not invented.
28. S13O retry mechanics are deferred.
29. S13P/Q/R/S14 remain out of scope.
30. Acceptance/evidence is preserved and traceable.
31. Candidate status is not trusted; deterministic gate recomputes invariants.
32. Canonical Skill runtime has no side effects.

## Failure policy

Semantic contradiction → return to ChatGPT Authoring Gate.
Mechanical defect → minimal local repair + rerun affected verification.

## Success criteria

Part A integrity, Skill Contract validation, positives/negatives, real S12→S10→S09 execution, anti-self-certification, OI-A-safe comparison, typecheck/full tests/build/post-build, builder review and fresh independent verification must all pass before S13L.
