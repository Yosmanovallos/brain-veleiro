# BRAIN — Knowledge Architecture v1

## 1. Purpose

This document defines Brain's Knowledge layer: how reusable understanding is compiled, stored, cited, checked for validity, retrieved, and exposed to humans without turning any external authoring surface into a Core dependency.

The governing model is:

```text
raw / human-authored sources
        ↓
curation / compilation
        ↓
canonical Knowledge in Markdown/Git
        ↓
KnowledgeProvider retrieval
        ↓
bounded task-relevant subset
        ↓
Context Pack
```

Brain's Knowledge layer must preserve three separations:

1. **compiled Knowledge** — curated reusable understanding;
2. **human-authored knowledge surfaces** — places where people may author or review material, such as Notion;
3. **Memory** — experience-derived persisted information from prior Runs/interactions.

These concepts may interact, but they are not interchangeable.

---

# 2. Canonical Terms Preserved

## Knowledge

Brain reuses the canonical S01 meaning:

> Knowledge is curated, compiled, or externally sourced understanding about a project, domain, system, decision, architecture, concept, or environment that can support reasoning.

Knowledge should retain enough provenance, validity, and structure to distinguish established information from assumption or obsolete information.

## KnowledgeProvider

Brain reuses the S02 boundary:

> KnowledgeProvider stores, searches, and retrieves Knowledge assets through a generic interface.

A KnowledgeProvider may use different indexing/retrieval strategies, but those implementation choices do not redefine Knowledge.

The Core may depend on the generic KnowledgeProvider contract.

The Core must not depend on:

- Notion;
- a specific wiki product;
- a specific search engine;
- a vector database;
- a specific filesystem layout;
- a hosted content-management platform.

---

# 3. Three-Way Separation

## 3.1 Compiled Knowledge

Compiled Knowledge is the canonical reusable understanding that Brain may retrieve for reasoning.

Examples:

- architecture patterns;
- system concepts;
- failure modes;
- reusable decisions;
- agent patterns;
- synthesized understanding derived from one or more sources.

Compiled Knowledge belongs to the **Intelligence** layer.

Its canonical portable representation is Markdown stored in Git.

Compiled Knowledge may be derived from:

- raw source snapshots;
- repository evidence;
- official documentation;
- human-authored notes;
- approved research syntheses;
- Notion pages;
- verified decisions.

A compiled artifact must not silently erase its source lineage.

---

## 3.2 Human-Authored Knowledge / Notion Surface

Human-authored knowledge is material created or edited in a human-facing workspace.

Notion may serve as one such surface.

Notion is:

```text
OPTIONAL HUMAN-FACING KNOWLEDGE SURFACE / ADAPTER
```

Notion is **not**:

```text
Brain Core dependency
canonical source of truth for compiled Knowledge
required runtime infrastructure
```

Human-authored content from Notion becomes canonical Brain Knowledge only after it is:

1. retrieved through an adapter/process;
2. normalized or compiled into the canonical Markdown representation;
3. assigned provenance and validity metadata;
4. reviewed/accepted according to the applicable quality policy;
5. committed into Git.

Brain must remain operational with Notion disconnected.

---

## 3.3 Memory

Memory remains the S01/S07 experience-derived continuity mechanism.

Memory:

- originates from prior Runs/interactions/observations;
- may preserve durable facts or learned operational state;
- is selective and longer-lived than working context;
- may later contribute to Knowledge if explicitly curated.

Knowledge:

- is reusable understanding;
- is curated/compiled;
- is not dependent on a specific prior Thread or Run.

A useful relationship is:

```text
experience
  ↓
Memory
  ↓
explicit curation / verification
  ↓
Knowledge
```

Promotion is never automatic.

---

# 4. Canonical Representation: Markdown + Git

Markdown stored in Git is Brain's canonical, portable representation of compiled Knowledge.

This decision provides:

- inspectability;
- version history;
- diffs;
- portability;
- tool independence;
- reviewability;
- offline availability;
- deterministic references by path/commit.

The canonical rule is:

```text
Notion or another human surface
        ↓ optional adapter
Markdown/Git Knowledge
        ↓
Brain retrieval
```

Not:

```text
Brain Core
        ↓
Notion directly
```

If Notion becomes unavailable, Brain still has access to already-compiled canonical Knowledge.

---

# 5. Knowledge Directory Structure

Canonical initial tree:

```text
knowledge/
├── index.md
├── sources/
├── concepts/
├── decisions/
├── architecture-patterns/
├── agent-patterns/
└── failure-modes/
```

Each directory has a distinct role.

---

## 5.1 `knowledge/index.md`

Purpose:

- entry point to the Knowledge layer;
- explains taxonomy;
- provides navigation;
- documents retrieval conventions;
- links to high-value knowledge areas;
- records the canonical structure.

It should not become a giant concatenated wiki.

---

## 5.2 `knowledge/sources/`

Purpose:

Preserve raw or minimally transformed source truth and source manifests.

Examples:

- immutable source snapshot;
- source manifest for an external URL/document;
- official documentation excerpt snapshot where permitted;
- repository evidence snapshot;
- stakeholder-provided source file reference;
- metadata describing where a source came from.

This directory is not for synthesized Knowledge.

### Raw-source rule

Once a raw source snapshot is cited by a compiled Knowledge artifact, it must not be silently overwritten.

If the source changes:

```text
old source snapshot
    remains immutable

new source version
    gets a new snapshot/manifest
```

The Knowledge artifact may then be revalidated against the new source.

---

## 5.3 `knowledge/concepts/`

Purpose:

Stable explanations of important domain/project/system concepts.

Examples:

- canonical terminology beyond the bootstrap vocabulary;
- domain model concepts;
- protocol explanations;
- product concepts;
- system behavior summaries.

A concept file explains **what something is**.

It should not be used to store architecture decisions or operational failure records.

---

## 5.4 `knowledge/decisions/`

Purpose:

Reusable decision knowledge derived from approved decisions.

Examples:

- distilled decision summaries;
- consequences that future reasoning should know;
- decision applicability conditions;
- superseded/current decision relationships.

This directory does not replace canonical ADRs.

Canonical ADRs remain their primary decision artifacts.

Knowledge files here are retrieval-oriented compilations that point back to the ADR.

---

## 5.5 `knowledge/architecture-patterns/`

Purpose:

Reusable architecture patterns, tradeoffs, constraints, and applicability rules.

Examples:

- provider/adapter boundaries;
- event-driven patterns;
- idempotency strategies;
- context architecture patterns;
- storage/consistency patterns.

An architecture pattern should answer:

```text
when is this pattern appropriate?
what problem does it solve?
what tradeoffs does it introduce?
when should it NOT be used?
```

It is not a project-specific ADR.

---

## 5.6 `knowledge/agent-patterns/`

Purpose:

Reusable patterns specifically for agentic systems.

Examples:

- bounded tool loops;
- planner/worker separation;
- verifier patterns;
- context-routing patterns;
- delegation constraints;
- stop/termination patterns;
- human-approval patterns.

These are reusable agent-system patterns, not concrete AgentDefinitions.

---

## 5.7 `knowledge/failure-modes/`

Purpose:

Reusable documented ways systems, architectures, integrations, or agent workflows fail.

Examples:

- stale context overrides reality;
- unbounded tool loop;
- duplicated side effects;
- context stuffing;
- provider-specific leakage into Core;
- silent retry amplification;
- stale Knowledge used without revalidation.

A failure-mode artifact should include:

- symptom;
- likely cause;
- detection;
- impact;
- prevention/mitigation;
- related patterns or decisions.

---

# 6. Knowledge Artifact Metadata Contract

Every compiled Knowledge artifact must carry enough metadata to answer:

```text
What is this?
Where did it come from?
What source(s) support it?
When was it compiled?
When was it last checked?
Is it still current?
What is its epistemic status?
What should trigger revalidation?
```

Recommended Markdown frontmatter:

```yaml
---
id: knowledge.example.unique-id
title: Example Knowledge Artifact
kind: concept | decision | architecture-pattern | agent-pattern | failure-mode

epistemic_status: VERIFIED | PROVIDED | ASSUMED | PROPOSED | UNKNOWN | BLOCKED

provenance:
  source_refs:
    - knowledge/sources/example-source.md
  compiled_by: human | agent | mixed
  compiled_at: YYYY-MM-DDTHH:MM:SSZ
  evidence_refs: []

validity:
  state: CURRENT | NEEDS_REVALIDATION | STALE | UNKNOWN
  last_checked_at: YYYY-MM-DDTHH:MM:SSZ
  valid_until: null
  revalidate_when:
    - source changes
    - referenced ADR is superseded

supersedes: []
superseded_by: []
tags: []
---
```

The exact metadata serialization may evolve later, but these semantics are required.

---

# 7. Epistemic Status vs. Validity

Brain must distinguish:

## Epistemic status

Uses the canonical S04 vocabulary:

```text
VERIFIED
PROVIDED
ASSUMED
PROPOSED
UNKNOWN
BLOCKED
```

This answers:

> How well supported is the claim?

## Validity / vigency

Uses:

```text
CURRENT
NEEDS_REVALIDATION
STALE
UNKNOWN
```

This answers:

> Is this Knowledge still current enough to use?

These are different dimensions.

Example:

```text
epistemic_status: VERIFIED
validity.state: STALE
```

means:

> This was well verified when compiled, but it is no longer safe to treat as current without revalidation.

---

# 8. Provenance Rules

Every compiled Knowledge artifact must reference its source(s).

A source reference should identify, when available:

- canonical path or locator;
- source type;
- retrieval/snapshot date;
- source owner/authority;
- immutable content hash for local snapshots;
- Evidence reference where applicable.

Example source manifest:

```yaml
source_id: source.example.001
type: official-documentation
locator: https://example.invalid/docs
retrieved_at: 2026-08-25T20:00:00Z
sha256: abcdef...
authority: primary
```

Knowledge artifacts should reference source IDs/paths rather than embedding complete source documents.

---

# 9. Raw-Source Immutability

Raw source truth must be preserved.

A compiled artifact:

```text
may cite a source
may summarize a source
may derive Knowledge from a source
```

but:

```text
must never mutate the cited raw source
```

Verification rule:

If a raw local source has hash:

```text
H_before
```

then after compilation:

```text
H_after == H_before
```

If the external source changes, create a new source record/snapshot instead of silently replacing the historical source artifact.

---

# 10. Knowledge Compilation Lifecycle

Canonical lifecycle:

```text
source discovered
    ↓
source captured/referenced
    ↓
provenance recorded
    ↓
claims extracted
    ↓
quality/evidence evaluation
    ↓
compiled Knowledge artifact
    ↓
validity metadata assigned
    ↓
Git commit
    ↓
retrievable through KnowledgeProvider
```

If the source or governing decision changes:

```text
revalidation trigger
    ↓
artifact marked NEEDS_REVALIDATION
    ↓
review
    ├─ still valid → CURRENT
    └─ invalid → STALE / superseded
```

---

# 11. Bounded Retrieval

Knowledge retrieval must follow S05:

> Retrieve by task relevance and expected decision value. Do not load a complete wiki or knowledge base into the Context Pack.

Canonical retrieval pattern:

```text
objective / query
    ↓
identify relevant knowledge category
    ↓
search/select candidate artifacts
    ↓
rank relevance
    ↓
check validity/provenance
    ↓
return bounded subset/references
    ↓
Core composes Context Pack
```

The KnowledgeProvider returns candidate Knowledge.

It does not own final Context Pack composition.

---

# 12. Retrieval Budget Rules

Knowledge retrieval should support:

- explicit result limit;
- task-specific query;
- category filtering;
- validity filtering;
- optional tags;
- provenance availability;
- references instead of full-document duplication.

When budget pressure exists, prefer:

1. current verified Knowledge;
2. directly relevant sections;
3. canonical references;
4. summaries with source links;

and omit:

- unrelated categories;
- stale Knowledge unless history is needed;
- entire source documents;
- complete wiki dumps.

---

# 13. Notion Participation

Notion may participate in two directions:

## Human → Brain

```text
human-authored Notion content
    ↓
Notion adapter / retrieval process
    ↓
source/provenance capture
    ↓
compile/review
    ↓
canonical Markdown/Git Knowledge
```

## Brain → Human

```text
canonical Markdown/Git Knowledge
    ↓
optional publishing/sync adapter
    ↓
Notion human-facing view
```

Conflict rule:

The canonical compiled artifact in Git remains Brain's portable source of truth.

A divergent Notion page is treated as:

```text
candidate human-authored update
```

until it is recompiled/reviewed into Git.

---

# 14. Notion-Disconnected Mode

Brain must work when:

```text
Notion = disconnected
```

Expected behavior:

- canonical Markdown Knowledge remains available;
- local Knowledge retrieval remains possible;
- existing Context Pack composition remains possible;
- no Core failure occurs merely because Notion is unavailable;
- Notion-specific sync/import/export simply becomes unavailable.

This is mandatory.

---

# 15. Relationship to Evidence

Knowledge may be derived from multiple Evidence records.

Evidence supports concrete claims.

Knowledge is reusable understanding compiled from one or more sources/Evidence items.

A Knowledge artifact should reference Evidence when the distinction matters.

It should not duplicate the entire Evidence schema inline.

---

# 16. Relationship to Handoff and Current State

Knowledge is not the current operational frontier.

Current repository/runtime reality and verified current/Handoff remain higher-authority context sources.

Therefore:

```text
Knowledge says X
current repo/runtime proves Y
→ Y wins for current-state truth
```

The Knowledge artifact should be marked for revalidation if the conflict reveals it is stale.

---

# 17. Relationship to Memory

Memory may inspire or supply candidate material for Knowledge compilation.

But:

```text
Memory
→ not automatically Knowledge
```

The compilation step must explicitly evaluate:

- future reuse value;
- authority;
- Evidence;
- validity;
- scope;
- provenance.

---

# 18. Minimal Knowledge Artifact Naming Convention

Recommended filename:

```text
<short-kebab-case-topic>.md
```

Examples:

```text
provider-boundary.md
stale-context-override.md
bounded-agent-loop.md
```

Do not encode mutable status such as `final`, `latest`, or `new` into filenames.

Version/history belongs in Git and metadata.

---

# 19. Illustrative Example

This example is guidance only.

## Illustrative Raw Source

`knowledge/sources/illustrative-context-rule-source.md`

```markdown
---
source_id: source.illustrative.context-rule
type: illustrative
retrieved_at: 2026-08-25T20:00:00Z
authority: illustrative-only
---

Brain should retrieve only the context needed for the current task instead of loading an entire repository, wiki, or historical conversation.
```

## Illustrative Compiled Knowledge

`knowledge/architecture-patterns/bounded-context-retrieval.md`

```markdown
---
id: knowledge.architecture.bounded-context-retrieval
title: Bounded Context Retrieval
kind: architecture-pattern
epistemic_status: PROVIDED

provenance:
  source_refs:
    - knowledge/sources/illustrative-context-rule-source.md
  compiled_by: human
  compiled_at: 2026-08-25T20:05:00Z
  evidence_refs: []

validity:
  state: CURRENT
  last_checked_at: 2026-08-25T20:05:00Z
  valid_until: null
  revalidate_when:
    - governing context architecture changes

supersedes: []
superseded_by: []
tags:
  - context
  - retrieval
---

# Bounded Context Retrieval

Use targeted retrieval to assemble only the information needed for the current objective.

Avoid loading full repositories, wikis, or historical conversations when a smaller relevant subset is sufficient.

## Source

Derived from:
`knowledge/sources/illustrative-context-rule-source.md`
```

The compiled artifact cites the raw source.

It does not overwrite or mutate it.

---

# 20. Definition of Done for S08 Architecture

The Knowledge architecture is structurally complete when:

- Markdown/Git is canonical;
- Notion is optional;
- Brain works without Notion;
- all required knowledge directories have distinct roles;
- raw sources are separate and immutable;
- provenance is mandatory;
- vigency/validity is explicit;
- stale Knowledge can be detected;
- retrieval is bounded;
- KnowledgeProvider remains replaceable;
- Knowledge is distinct from Memory, Evidence, Handoff, and Context Pack.
