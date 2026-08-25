# ADR — Canonical Context Authority Ordering

**Status:** Proposed — pending S05 integration and verification

## Context

Brain retrieves context from multiple sources with different purposes and reliability characteristics.

These sources can disagree.

Examples include:

- current repository/runtime observations;
- approved Specs;
- verified current-state artifacts or Handoffs;
- architecture decisions;
- project instructions;
- compiled Knowledge;
- durable Memory;
- historical sessions;
- model inference.

Without an explicit authority policy, a model may incorrectly prefer:

- the most recent statement;
- the longest document;
- a remembered fact;
- a confident inference;
- a historical session;
- a provider-returned result;

even when a more authoritative current source contradicts it.

Brain therefore requires a deterministic minimum authority order for resolving context conflicts.

## Decision

Brain adopts the following canonical authority order:

```text
1. runtime/repository reality
2. explicit current spec
3. verified current/handoff
4. ADRs
5. project instructions
6. compiled knowledge
7. durable memory
8. historical sessions
9. inference
```

This order is used when two or more context items make conflicting claims relevant to the same decision.

The higher-authority source wins for that claim unless:

- the higher-authority source is itself unavailable or not applicable to the claim;
- the conflict cannot be resolved with sufficient Evidence;
- an explicit newer architectural decision changes the authority policy.

Authority is claim-specific.

A source does not become globally correct merely because it holds a high authority rank.

### Relationship to Status

Authority rank and epistemic status are distinct.

Brain continues using:

```text
VERIFIED
PROVIDED
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

A high-authority category should still be verified when verification is required.

### Relationship to Recency

Recency is an important freshness attribute but is not the primary conflict-resolution rule.

A newer historical conversation does not override current repository reality.

### Relationship to Confidence

Confidence cannot override authority.

A highly confident inference remains below explicit verified sources.

## Rationale

The selected order favors:

1. what the system currently **is**;
2. what the current approved work explicitly **requires**;
3. what the latest verified continuity artifact says;
4. intentional architecture decisions;
5. project operating instructions;
6. reusable curated Knowledge;
7. remembered experience;
8. historical conversational context;
9. inference.

This supports Brain's principles:

- Evidence before confidence;
- Context is retrieved, not stuffed;
- current reality must be verified;
- Memory is not canonical repository truth;
- historical conversation must not silently dominate present state.

## Alternatives Considered

### Alternative 1 — Recency-Based Resolution

Always prefer the newest source.

**Advantages**

- easy to understand;
- simple implementation;
- useful when all sources have similar authority.

**Disadvantages**

- a recent chat message could override the actual repository;
- new but unverified information could override an approved Spec;
- timestamps do not establish correctness;
- copied or regenerated stale artifacts can appear newer than canonical sources.

**Decision:** Rejected.

Recency remains metadata, not the primary authority mechanism.

---

### Alternative 2 — Confidence-Based Resolution

Prefer the claim with the highest model/source confidence.

**Advantages**

- adaptable;
- useful when reasoning under uncertainty;
- can help rank weak sources.

**Disadvantages**

- confidence is not Evidence;
- models can be confidently wrong;
- authoritative sources should not lose to inferred certainty;
- confidence scoring can vary by provider or implementation.

**Decision:** Rejected as the primary authority rule.

Confidence may remain auxiliary metadata.

---

### Alternative 3 — Majority / Source-Count Resolution

Prefer the claim supported by the most sources.

**Advantages**

- can be useful for independent cross-validation;
- simple for homogeneous evidence sets.

**Disadvantages**

- many sources may repeat the same incorrect upstream claim;
- three historical notes should not override one current repository observation;
- authority is more important than count for project-state facts.

**Decision:** Rejected as the primary authority rule.

Source count may support Evidence evaluation where appropriate.

---

### Alternative 4 — Provider-Specific Priority

Let each retrieval/provider implementation decide source priority.

**Advantages**

- easy local optimization;
- flexible per integration.

**Disadvantages**

- fragments Brain's semantics;
- makes behavior provider-dependent;
- breaks Core-level reproducibility;
- makes substitution tests weaker;
- allows external adapters to decide canonical project truth.

**Decision:** Rejected.

Providers retrieve candidates; Core applies the canonical authority policy during Context Pack composition.

---

### Alternative 5 — Canonical Fixed Authority Order

Use the nine-level order defined in this ADR.

**Advantages**

- predictable;
- auditable;
- provider-agnostic;
- compatible with Context Pack provenance;
- prevents Memory/history from overriding current reality;
- supports deterministic contradiction tests.

**Disadvantages**

- requires provenance metadata;
- requires claim-specific conflict handling;
- some complex cases may still remain UNKNOWN;
- future source classes may require an explicit ADR update.

**Decision:** Accepted.

## Consequences

### Positive

- contradictory context becomes explainable;
- current repository/runtime reality cannot be silently overridden by Memory or chat history;
- Specs retain authority over intended requirements;
- providers remain replaceable;
- child Context Packs can preserve authority/provenance;
- stale context can remain available without becoming canonical;
- verification can mechanically test conflict resolution.

### Costs

- context items need provenance and authority metadata;
- composition requires ranking/conflict logic;
- some sources need freshness checks;
- unresolved contradictions may produce BLOCKED rather than a convenient guess.

### Operational Consequence

When a conflict is found, Brain should preserve enough information to explain:

```text
claim A
source / authority

vs.

claim B
source / authority

winner
reason
```

Lower-authority records should not be deleted solely because they lost a conflict. They may remain useful historical context.

## Compatibility Constraint

The canonical term remains **Context Pack**.

The literal schema filename `CONTEXT_PACKET.schema.yaml` is retained only because it is required by the bootstrap contract.

No second "Context Packet" concept is introduced.

## Verification

S05 satisfies this ADR when a contradiction among:

- durable Memory;
- verified Handoff;
- current repository/runtime reality;

resolves in favor of repository/runtime reality for a current-state claim and the resolution can be explained from the recorded authority metadata.
