# Brain Skill Contract v1

**Status:** Canonical S12 semantic contract  
**Step:** S12 — Skill Registry y Skill Contract v1  
**Layer:** Skill content = Intelligence; discovery/loading contract = generic Core-adjacent boundary; concrete reference provider = Providers  
**Depends on:** S01 Vocabulary, S02 Core Boundaries, S05 Context Architecture, S09 Agent Runtime, S10 AgentDefinition, S11 Research Skill  
**Authoring split:** ChatGPT Part A → Claude Code Part B

---

## 1. Purpose

S12 defines how Brain represents, discovers, selects, and lazily loads reusable procedural knowledge without embedding the full skill catalog into every Agent prompt or Core runtime.

Canonical behavior:

```text
task
  ↓
AgentDefinition.skills allowlist
  ↓
SkillProvider.discover(...)
  ↓
small SkillDescriptor set only
  ↓
selection
  ↓
SkillProvider.load(selected_skill_id)
  ↓
full SkillDefinition for selected skill only
```

The central invariant is:

> **Discovery sees metadata; execution-time materialization loads full skill content only after selection.**

A Skill remains procedural Intelligence.

A Skill is not a Tool.

A Skill describes how work should be performed; capabilities/tools perform atomic operations.

S12 MUST NOT turn Skills into provider implementations, executable tool calls, role-specific runtime classes, or prompt-global static content.

---

# 2. S12 step contract preserved

The bootstrap requires these fields:

```yaml
id:
version:
description:
applies_when:
inputs:
outputs:
requires:
rules:
procedure:
verification:
permissions:
evals:
```

S12 makes every field concrete and machine-validatable without redefining the existing Brain vocabulary.

---

# 3. Scope

S12 defines:

- `SkillDefinition v1`;
- `SkillDescriptor v1`;
- `SkillProvider`;
- bounded metadata-only discovery;
- lazy full-skill loading;
- deterministic validation;
- agent skill allowlist filtering through existing `AgentDefinition.skills: string[]`;
- a reference local provider;
- migration of the S11 Research Skill into a typed S12-compatible runtime representation;
- deterministic Part B tests;
- PASS/failure conditions.

S12 does NOT define:

- Skill Factory;
- autonomous Skill generation;
- production S13x Skills;
- Capability Registry;
- MCP;
- Workflow Runtime;
- multi-agent delegation;
- Skill execution engine separate from the Agent Runtime;
- role-specific Skill runtime;
- prompt-global Skill injection;
- semantic vector retrieval infrastructure;
- external hosted model requirements.

---

# 4. Resolution of the six S12 ambiguities

## 4.1 Unknown 1 — concrete field shapes

### Decision

All twelve bootstrap fields receive exact TypeScript-compatible shapes in this contract.

No field remains an untyped prose placeholder.

The canonical runtime representation is `SkillDefinition`.

---

## 4.2 Unknown 2 — architecture placement

### Decision

S12 introduces a generic Core-adjacent `SkillProvider` contract.

The split is:

```text
Core-adjacent contracts
└── SkillProvider interface + Skill types

Intelligence
└── canonical Skill content / typed SkillDefinition values

Providers
└── concrete discovery/loading implementation
```

This follows the existing Brain boundary pattern:

```text
generic contract
≠
concrete provider implementation
```

The Core Agent Runtime MUST NOT contain Skill content, catalog contents, provider-specific loading logic, or Skill-name branching.

The existence of a generic `SkillProvider` does not mean the S09 `runAgent()` loop consumes Skills directly.

S12 only establishes discovery/loading infrastructure.

---

## 4.3 Unknown 3 — integration with `compileAgentDefinition()`

### Decision

S12 is **strictly additive** to S10.

`compileAgentDefinition()` MUST NOT be changed to resolve or inject Skill contents in S12.

Existing:

```ts
AgentDefinition.skills: string[]
```

remains an opaque allowlist/reference set.

S12 introduces a generic Intelligence-layer selection/loading path that may use those IDs as the Agent's allowed Skill set.

Conceptually:

```text
AgentDefinition.skills
       ↓
allowed skill IDs

task/query
       ↓
discover allowed metadata
       ↓
select
       ↓
load selected full skill
```

This prevents S12 from expanding S09/S10 runtime semantics prematurely.

A later step MAY define how loaded Skill content is compiled into a task Context Pack or execution plan.

That later integration MUST reuse this contract rather than redesign Skill discovery.

---

## 4.4 Unknown 4 — canonical Skill artifact location

### Decision

Canonical human-authored Skill source artifacts remain under:

```text
brain-bootstrap/skills/
```

This preserves the S11 precedent and the established ChatGPT semantic-authoring boundary.

Example:

```text
brain-bootstrap/skills/RESEARCH_SKILL_S11.md
```

Runtime/typed representations MAY live under:

```text
src/intelligence/skills/
```

but those are derived executable representations, not the semantic source of truth.

Canonical rule:

```text
brain-bootstrap/skills/
= authored semantic truth

src/intelligence/skills/
= typed/runtime representation
```

Do not move or silently replace the S11 canonical Markdown source.

---

## 4.5 Unknown 5 — migration of `RESEARCH_SKILL_S11.md`

### Decision

Migration is IN SCOPE for S12, but it is non-destructive.

Part B MUST:

1. preserve `brain-bootstrap/skills/RESEARCH_SKILL_S11.md` as the canonical semantic source;
2. create an S12-compliant typed `SkillDefinition` for the Research Skill;
3. create the corresponding `SkillDescriptor`;
4. verify the S12 representation preserves the S11 semantics that S11 §19 marked as protected:
   - Knowledge Gap Analysis;
   - evidence grounding;
   - contradiction handling;
   - uncertainty handling;
   - value-of-information stop rule;
   - source traceability.

S12 MUST NOT rewrite those semantics merely to fit the generic contract.

If a mechanical representation choice cannot preserve them, S12 must BLOCK and return to ChatGPT rather than silently weakening the Research Skill.

---

## 4.6 Unknown 6 — architecture-only versus real Part B mechanism

### Decision

S12 requires a real Part B engineering deliverable.

Architecture-only is insufficient because the S12 PASS criterion requires observable proof that:

> an Agent can discover and load a relevant Skill without injecting the whole catalog into context.

Part B therefore MUST implement:

- the generic Skill types;
- `SkillProvider`;
- deterministic validation;
- a local reference Skill provider;
- metadata-only discovery;
- lazy full-content loading;
- AgentDefinition allowlist filtering;
- S11 Research Skill migration;
- deterministic tests proving bounded/lazy behavior.

No production-scale registry or search engine is required.

---

# 5. Canonical Skill Contract v1 types

Existing canonical Brain types SHOULD be reused where compatible.

In particular:

- use the existing `JsonSchemaLike` concept for structured input/output schemas;
- use the existing Tool side-effect vocabulary where permissions reference capability side effects;
- do not redefine AgentDefinition.

Canonical semantic shape:

```ts
interface SkillDefinition {
  id: string;
  version: string;
  description: string;

  applies_when: SkillApplicability;

  inputs: SkillIOField[];
  outputs: SkillIOField[];

  requires: SkillRequirements;

  rules: SkillRule[];
  procedure: SkillProcedureStep[];
  verification: SkillVerificationCheck[];

  permissions: SkillPermissionPolicy;

  evals: string[];
}
```

---

# 6. `id`

```ts
id: string;
```

Requirements:

- non-empty;
- stable;
- unique within the active Skill catalog;
- provider-neutral;
- SHOULD use lowercase dot-separated names.

Examples:

```text
research.evidence-grounded.s11
requirements.discovery.standard
qa.regression.standard
```

The Core MUST NOT branch on Skill IDs.

Forbidden:

```ts
if (skill.id === "research.evidence-grounded.s11") {
  // special Core behavior
}
```

---

# 7. `version`

```ts
version: string;
```

Skill Contract v1 uses semantic-version-compatible strings.

Example:

```text
1.0.0
```

The reference validator MUST reject empty versions.

Exact semver range/dependency resolution is out of S12 scope.

The S12 provider may require exact ID + version matching only.

---

# 8. `description`

```ts
description: string;
```

A compact discovery-oriented description.

Requirements:

- non-empty;
- states the outcome/procedure the Skill enables;
- MUST NOT contain secrets;
- MUST be safe to expose during broad metadata discovery.

The description is intentionally part of the lightweight discovery surface.

---

# 9. `applies_when`

Canonical shape:

```ts
interface SkillApplicability {
  task_kinds: string[];
  signals: string[];
  exclusions: string[];
}
```

## `task_kinds`

Broad task categories for which the Skill may be useful.

Examples:

```text
research
requirements
qa
documentation
```

## `signals`

Small discovery terms/phrases that indicate relevance.

Examples:

```text
evidence
cross-check
unknowns
research question
```

These are metadata hints, not executable instructions.

## `exclusions`

Conditions that explicitly make the Skill inappropriate.

Example:

```text
Do not use when the user only requests verbatim transcription.
```

Validation:

```text
task_kinds.length + signals.length >= 1
```

`applies_when` is available during discovery and therefore MUST remain compact.

---

# 10. `inputs`

Canonical shape:

```ts
interface SkillIOField {
  name: string;
  description: string;
  required: boolean;
  schema: JsonSchemaLike;
}
```

`inputs`:

```ts
SkillIOField[]
```

Each input describes data the Skill procedure expects.

A Skill MUST NOT embed actual secrets inside input definitions.

Secret values, if ever required by a later capability/provider flow, remain outside Skill content.

Duplicate input names are invalid.

---

# 11. `outputs`

Same shape:

```ts
SkillIOField[]
```

Outputs describe expected artifacts/data produced by successful application of the Skill procedure.

Duplicate output names are invalid.

The Skill output contract MUST NOT replace the Agent Runtime's canonical `StructuredAgentOutput`.

If an Agent uses the Skill, later orchestration/materialization may map Skill outputs into Agent state/output.

That mapping is not defined by S12.

---

# 12. `requires`

Canonical shape:

```ts
interface SkillRequirements {
  skills: string[];
  capabilities: string[];
  context_sources: string[];
  quality_contract_refs: string[];
}
```

## `skills`

Other Skill IDs required by this Skill.

S12 does NOT implement transitive execution or dependency graphs.

The reference provider only validates that declared referenced Skills can exist in the catalog when such validation is requested.

Circular-dependency resolution is deferred.

## `capabilities`

Capability IDs required to carry out the procedure.

These are references to existing/future CapabilityProvider descriptors.

A Skill does not execute them itself.

## `context_sources`

Context classes or canonical context references required by the procedure.

These remain provider-neutral strings and MUST respect S05 bounded retrieval.

## `quality_contract_refs`

Quality Contract references that must apply when using the Skill.

The Skill MUST NOT inline or redefine a Quality Contract.

---

# 13. `rules`

Canonical shape:

```ts
type SkillRuleLevel = "MUST" | "SHOULD" | "MAY";

interface SkillRule {
  id: string;
  level: SkillRuleLevel;
  statement: string;
}
```

Requirements:

- `id` unique within the Skill;
- `statement` non-empty;
- rules are declarative;
- rules MUST NOT contain executable provider code.

`MUST` indicates a mandatory condition.

`SHOULD` indicates a strong default that may be overridden only with explicit justification.

`MAY` indicates optional behavior.

---

# 14. `procedure`

Canonical shape:

```ts
interface SkillProcedureStep {
  id: string;
  title: string;
  instruction: string;
  requires: string[];
  produces: string[];
}
```

Requirements:

- step IDs unique;
- order in the array is canonical procedure order;
- `instruction` non-empty;
- `requires` names logical prerequisites/artifacts;
- `produces` names expected intermediate artifacts/results.

A procedure step describes what to do.

It does not implement the Tool/Capability call itself.

---

# 15. `verification`

Canonical shape:

```ts
type SkillVerificationKind =
  | "DETERMINISTIC"
  | "SEMANTIC"
  | "HUMAN";

interface SkillVerificationCheck {
  id: string;
  kind: SkillVerificationKind;
  criterion: string;
  evidence_required: boolean;
}
```

A Skill SHOULD contain at least one verification check.

If a Skill's Quality Contract requires deterministic verification, at least one check MUST use:

```text
DETERMINISTIC
```

Verification definitions are Intelligence.

Execution results become run/test evidence.

---

# 16. `permissions`

Canonical shape:

```ts
interface SkillPermissionPolicy {
  allowed_capabilities: string[];
  allowed_side_effects: ToolSideEffectClass[];
  deny_unlisted_capabilities: true;
}
```

`ToolSideEffectClass` MUST reuse the existing S09/S10 vocabulary:

```text
NONE
LOCAL
EXTERNAL
```

Invariant:

```text
set(requires.capabilities)
⊆
set(permissions.allowed_capabilities)
```

A Skill cannot require a capability that its own permission policy forbids.

`deny_unlisted_capabilities` MUST be `true` in v1.

S12 defines the policy shape.

Actual invocation enforcement continues to occur at the appropriate existing capability/provider boundary.

---

# 17. `evals`

```ts
evals: string[];
```

Each entry is an opaque Eval identifier/reference.

Skill Contract v1 does not inline Eval definitions, datasets, metrics, or graders.

Duplicate Eval IDs are invalid.

---

# 18. Complete example shape

Illustrative only:

```ts
const exampleSkill: SkillDefinition = {
  id: "example.analysis.v1",
  version: "1.0.0",

  description:
    "Analyze a bounded problem and produce an evidence-backed structured result.",

  applies_when: {
    task_kinds: ["analysis"],
    signals: ["compare", "evaluate", "evidence"],
    exclusions: ["verbatim transcription"],
  },

  inputs: [
    {
      name: "question",
      description: "The bounded question to analyze.",
      required: true,
      schema: {
        type: "string",
      },
    },
  ],

  outputs: [
    {
      name: "analysis",
      description: "Structured analysis result.",
      required: true,
      schema: {
        type: "object",
      },
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["CURRENT_TASK"],
    quality_contract_refs: [],
  },

  rules: [
    {
      id: "R1",
      level: "MUST",
      statement: "Keep retrieval bounded to task-relevant context.",
    },
  ],

  procedure: [
    {
      id: "P1",
      title: "Analyze",
      instruction: "Analyze the bounded question using available evidence.",
      requires: ["question"],
      produces: ["analysis"],
    },
  ],

  verification: [
    {
      id: "V1",
      kind: "DETERMINISTIC",
      criterion: "Required output fields exist.",
      evidence_required: true,
    },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: [],
};
```

This example does not define a production Skill.

---

# 19. SkillDescriptor v1

Discovery MUST NOT expose the full `SkillDefinition`.

Canonical lightweight descriptor:

```ts
interface SkillDescriptor {
  id: string;
  version: string;
  description: string;

  applies_when: SkillApplicability;

  required_capability_ids: string[];
  quality_contract_refs: string[];
}
```

Descriptor MUST NOT contain:

- `rules`;
- full `procedure`;
- `verification`;
- full `inputs`;
- full `outputs`;
- executable code;
- large source content;
- secrets.

`required_capability_ids` is a compact projection of:

```text
SkillDefinition.requires.capabilities
```

`quality_contract_refs` is a compact projection of:

```text
SkillDefinition.requires.quality_contract_refs
```

The descriptor exists specifically so the catalog can be searched without loading full Skills.

---

# 20. SkillProvider v1

Canonical generic provider contract:

```ts
interface SkillDiscoveryRequest {
  query: string;

  allowed_skill_ids?: string[];

  task_kinds?: string[];

  limit?: number;
}

interface SkillLoadRequest {
  id: string;
  version?: string;
}

interface SkillProvider {
  discover(
    request: SkillDiscoveryRequest
  ): Promise<SkillDescriptor[]>;

  load(
    request: SkillLoadRequest
  ): Promise<SkillDefinition>;
}
```

No concrete provider implementation is part of the contract.

No Skill catalog data belongs in Core.

---

# 21. Discovery semantics

`discover()` performs bounded metadata-only discovery.

Rules:

```text
query
- required non-empty string

limit
- default: 5
- minimum: 1
- maximum: 20
```

If:

```ts
allowed_skill_ids
```

is provided, returned descriptors MUST be a subset of that allowlist.

This is how S12 safely combines generic Skill discovery with:

```ts
AgentDefinition.skills: string[]
```

without changing the S10 type.

If:

```ts
task_kinds
```

is provided, it MAY improve deterministic relevance ranking.

The reference provider MUST rank using descriptor metadata only.

A simple deterministic lexical ranking is sufficient for S12.

Embeddings, LLM ranking, graph ranking, and external search are not required.

---

# 22. Lazy-loading invariant

The full Skill catalog MUST NOT be loaded during discovery.

The provider MUST have a separable metadata path and content-loading path.

Reference architecture:

```ts
interface SkillCatalogEntry {
  descriptor: SkillDescriptor;
  load_definition: () => Promise<SkillDefinition>;
}
```

The concrete reference implementation MAY use lazy imports, deferred loaders, or equivalent mechanics.

The exact mechanism is an implementation detail.

The observable invariant is not:

```text
"uses dynamic import"
```

The observable invariant is:

```text
discover()
→ descriptor metadata only
→ zero full-definition loader calls

load(selected_id)
→ exactly selected definition loader is called
→ unrelated definitions remain unloaded
```

This MUST be proven deterministically.

---

# 23. Catalog boundedness

The reference provider MUST NOT return the entire catalog by default.

Default:

```text
limit = 5
```

Maximum:

```text
20
```

Discovery response size is therefore bounded.

A future provider may search a large registry internally, but the Agent-facing result remains a small descriptor set.

---

# 24. Load semantics

`load()` receives an exact Skill ID and optional exact version.

Behavior:

1. locate the catalog entry;
2. fail explicitly if the Skill is unknown;
3. invoke only the selected definition loader;
4. validate the loaded `SkillDefinition`;
5. verify loaded `id` matches requested `id`;
6. if version requested, verify exact version match;
7. return the full definition.

No fallback to a similarly named Skill.

No silent version substitution in v1.

---

# 25. Validation contract

Part B MUST implement deterministic:

```ts
validateSkillDefinition(definition)
```

or mechanically equivalent functionality.

Minimum validations:

```text
id
- non-empty

version
- non-empty

description
- non-empty

applies_when
- task_kinds + signals contains at least one item
- no duplicate values within each list

inputs
- unique non-empty names
- non-empty descriptions
- valid JsonSchemaLike-compatible schema

outputs
- unique non-empty names
- non-empty descriptions
- valid JsonSchemaLike-compatible schema

requires
- all fields present
- no duplicate IDs within arrays

rules
- unique IDs
- valid level
- non-empty statement

procedure
- at least 1 step
- unique step IDs
- non-empty title
- non-empty instruction

verification
- at least 1 check
- unique IDs
- valid kind
- non-empty criterion

permissions
- deny_unlisted_capabilities === true
- valid existing side-effect values
- requires.capabilities subset of permissions.allowed_capabilities

evals
- unique non-empty refs
```

Malformed Skills MUST fail before becoming loadable runtime Skill definitions.

---

# 26. Skill selection service

S12 MUST provide a generic Intelligence-layer selection/loading helper.

Conceptual shape:

```ts
interface SkillSelectionRequest {
  task: string;
  agent_definition: AgentDefinition;
  provider: SkillProvider;
  limit?: number;
}

interface SkillSelectionResult {
  discovered: SkillDescriptor[];
  selected?: SkillDescriptor;
  loaded?: SkillDefinition;
}
```

Exact type names may vary.

Required semantics:

```text
agent_definition.skills
→ allowed_skill_ids for discovery
```

If:

```text
AgentDefinition.skills == []
```

then no Skill is selectable.

The selector MUST NOT bypass the Agent allowlist.

The reference selector MAY use deterministic descriptor ranking and select the highest-ranked matching Skill.

It MUST NOT load every discovered Skill merely to rank them.

Only the selected Skill may be fully loaded.

---

# 27. Relationship to Context Architecture

Skill discovery is a retrieval problem and MUST obey S05.

The Context Pack should not contain:

```text
every Skill definition
```

Instead:

```text
task
→ small descriptors
→ selected Skill
→ selected full content
```

S12 explicitly forbids:

```text
catalog.map(skill => fullSkillText)
→ prompt
```

Metadata may be broadly searchable.

Full procedural content is loaded on demand.

---

# 28. Relationship to AgentDefinition

S10 remains unchanged:

```ts
skills: string[];
```

Semantics after S12:

```text
AgentDefinition.skills
=
maximum Skill IDs this Agent may select/load
```

It is not:

- the full Skill content;
- a role-specific runtime map;
- a set of executable functions.

S12 does not change AgentDefinition's schema.

---

# 29. Relationship to capabilities

A Skill may declare:

```text
requires.capabilities
```

and:

```text
permissions.allowed_capabilities
```

but it does not provide those capabilities.

Capabilities continue to be implemented/exposed through the existing CapabilityProvider boundary.

Skill selection MUST NOT make an unlisted capability automatically available to an Agent.

Later execution must satisfy both Agent permissions and Skill permissions.

S12 does not define the final multi-policy merge algorithm.

---

# 30. S11 Research Skill migration

S12 Part B MUST create a typed S12 `SkillDefinition` corresponding to:

```text
brain-bootstrap/skills/RESEARCH_SKILL_S11.md
```

Suggested derived runtime path:

```text
src/intelligence/skills/definitions/researchEvidenceGroundedS11.ts
```

The exact filename may adapt to repository conventions.

The typed definition MUST preserve at least:

```text
id
version
description/outcome
applicability
required research.lookup capability
Quality Contract reference
Knowledge Gap Analysis rule
evidence-grounding rules
cross-check rule
contradiction handling
unknown handling
VOI stop rule
verification semantics
read-only capability permissions
```

The S11 Markdown file remains canonical.

The TypeScript object is a runtime representation.

No S11 semantic rule may be deleted to simplify S12.

---

# 31. Reference local SkillProvider

Part B MUST implement a real reference provider.

Suggested responsibility:

```text
src/providers/skill/localReferenceSkillProvider.ts
```

It MUST:

- expose descriptor metadata without loading full definitions;
- support bounded discovery;
- support `allowed_skill_ids`;
- deterministically rank metadata relevance;
- load one exact selected Skill lazily;
- validate the loaded definition;
- produce explicit not-found/version errors;
- contain no concrete model-provider dependency;
- require no network or credentials.

The provider MUST contain at least:

```text
Research Skill S11
+
at least 2 additional small test/reference Skill entries
```

The additional entries exist only to prove discovery ranking and lazy loading.

They MUST NOT become production S13x Skills.

Use clearly reference/test identities such as:

```text
reference.summarize.v1
reference.format-check.v1
```

---

# 32. Discovery ranking for the reference provider

A deterministic lexical algorithm is sufficient.

Reference ranking MAY use normalized matches over:

```text
id
description
applies_when.task_kinds
applies_when.signals
```

Requirements:

- same input/catalog → same ordering;
- stronger exact/whole-token matches rank above weaker matches;
- ties resolved deterministically, e.g. by `id`;
- ranking MUST NOT inspect full Skill rules/procedure/content.

This is an implementation rule for the reference provider, not a universal ranking algorithm for future providers.

---

# 33. Metadata privacy/safety

Descriptors MUST NOT contain:

- credentials;
- secret values;
- API tokens;
- large source documents;
- full operational procedures that are unnecessary for discovery.

Discovery is allowed to expose:

- ID;
- version;
- description;
- applicability metadata;
- required capability IDs;
- Quality Contract refs.

Anything more expensive or sensitive remains behind `load()`.

---

# 34. Required S12 Part B artifacts

Part B SHOULD produce mechanically equivalent responsibilities for:

```text
src/core/skill/
  types.ts
  validateSkillDefinition.ts
  index.ts

src/providers/skill/
  localReferenceSkillProvider.ts

src/intelligence/skills/
  definitions/
    researchEvidenceGroundedS11.ts
    referenceSummarize.ts
    referenceFormatCheck.ts
  selectSkillForTask.ts
  index.ts

tests/skill/
  fixtures.ts
  skillContract.test.ts

brain-bootstrap/reports/
  S12-skill-registry-verification.md
```

Exact filenames may adapt to existing repository conventions.

Semantic architecture may not.

---

# 35. Required deterministic contract tests

Part B MUST implement tests equivalent to T1–T20 below.

Names may vary.

Semantics may not.

---

## T1 — valid SkillDefinition accepted

A complete valid Skill passes deterministic validation.

---

## T2 — malformed required field rejected

Examples:

```text
empty id
empty version
empty description
missing procedure
```

must be rejected explicitly.

No silent defaults for required semantic fields.

---

## T3 — applies_when validation

A Skill with both:

```text
task_kinds = []
signals = []
```

must fail.

Duplicate applicability values must fail or be normalized deterministically before validation; reference implementation SHOULD reject duplicates.

---

## T4 — unique structured IDs

Duplicate:

```text
input names
output names
rule IDs
procedure step IDs
verification IDs
eval refs
```

must be rejected.

---

## T5 — capability permission invariant

If:

```text
requires.capabilities
```

contains a capability not present in:

```text
permissions.allowed_capabilities
```

validation must fail.

---

## T6 — S09 side-effect vocabulary reused

Skill permission side effects accept only the existing canonical side-effect values.

No new parallel side-effect vocabulary is introduced.

---

## T7 — descriptor projection is metadata-only

Given a full SkillDefinition, its `SkillDescriptor` must contain only the approved descriptor fields.

It must not expose:

```text
rules
procedure
verification
full inputs
full outputs
```

---

## T8 — discover is bounded

With a catalog larger than the requested limit:

```text
discover({ limit: 2 })
```

returns at most 2 descriptors.

Default limit is 5.

Requests above 20 are rejected or bounded according to one deterministic implementation rule documented in the report.

---

## T9 — discovery uses metadata only

Instrument definition loaders.

Call:

```text
discover(...)
```

Assert:

```text
full definition loader calls == 0
```

Discovery ranking must succeed using descriptors only.

---

## T10 — relevant Skill ranks/selects correctly

Given a research-like task and a catalog containing the S11 Research descriptor plus unrelated reference Skills, the Research Skill must rank above unrelated entries using deterministic descriptor metadata.

No full Skill may be loaded merely to rank.

---

## T11 — AgentDefinition Skill allowlist enforced

Given:

```ts
agent.skills = ["reference.format-check.v1"]
```

a research query MUST NOT return/load:

```text
research.evidence-grounded.s11
```

even if the query strongly matches research.

---

## T12 — empty Agent Skill allowlist selects nothing

Given:

```ts
agent.skills = []
```

selection returns no loaded Skill.

No global catalog fallback is permitted.

---

## T13 — load is lazy and exact

After discovery, loading one selected Skill must:

```text
call selected loader exactly once
call unrelated loaders zero times
```

and return the exact requested Skill.

---

## T14 — unknown Skill load fails explicitly

Loading an unknown ID returns/throws a deterministic not-found failure.

No fuzzy fallback.

---

## T15 — exact-version semantics

If a version is requested and does not match the catalog entry, load fails explicitly.

No silent upgrade/downgrade.

---

## T16 — loaded Skill is revalidated

A catalog entry whose lazy loader returns a malformed SkillDefinition must fail during `load()`.

Catalog registration alone must not make malformed content trustworthy.

---

## T17 — S11 Research Skill migration preserves protected semantics

The typed S12 Research Skill representation must mechanically demonstrate presence of the S11-protected semantics:

```text
Knowledge Gap Analysis
evidence grounding
cross-check
contradictions
unknowns / uncertainty
value-of-information stop rule
source traceability
research.lookup requirement
STANDARD Researcher Quality Contract reference
```

The test may inspect typed rules/procedure/verification fields.

---

## T18 — S10 compile path remains unchanged

S12 tests must prove that Skill discovery/loading does not require a Researcher-specific or Skill-specific branch in:

```text
compileAgentDefinition()
runAgent()
```

Existing S09/S10 behavior remains green.

---

## T19 — Core contains no Skill-name conditionals

Mechanical source scan over generic Core Agent/Skill code must find no control flow equivalent to:

```text
skill.id === "research.evidence-grounded.s11"
skill.id === "reference.summarize.v1"
```

Reference Skill IDs may appear in Intelligence/provider fixtures/tests.

They must not control Core behavior.

---

## T20 — full regression

Run the complete existing suite.

All S07–S11 behavior must continue passing.

Typecheck and build must also pass.

---

# 36. Additional verification evidence required

The S12 verification report MUST record:

- descriptor count in the reference catalog;
- full-definition loader invocation counts during discovery;
- loader invocation counts during selected load;
- bounded discovery result count;
- allowlist rejection demonstration;
- exact-version rejection demonstration;
- S11 Research Skill migration verification;
- Core boundary check;
- no Skill-name branch check;
- typecheck result;
- build result;
- complete test count;
- pre/post-build regression status.

---

# 37. PASS criteria

S12 may receive PASS only if all are evidenced:

1. `SKILL_CONTRACT_v1.md` exists as canonical semantic contract.
2. `SkillDefinition` implements all twelve bootstrap fields with the approved shapes.
3. `SkillDescriptor` exposes metadata only.
4. `SkillProvider.discover()` is bounded.
5. Discovery causes zero full Skill loads.
6. Relevance ranking uses descriptor metadata only.
7. `AgentDefinition.skills` acts as the maximum discover/load allowlist.
8. Empty Agent Skill allowlist cannot fall back to the global catalog.
9. Only the selected Skill is fully loaded.
10. Unknown Skill IDs fail explicitly.
11. Version mismatch fails explicitly.
12. Loaded definitions are validated before use.
13. S11 Research Skill is represented through Skill Contract v1 without changing protected S11 semantics.
14. Canonical authored Skill sources remain under `brain-bootstrap/skills/`.
15. Generic Core Agent Runtime remains unchanged by Skill identity.
16. No Skill-name-specific Core branch exists.
17. No full catalog is injected into task context.
18. No production S13x Skill family is pulled forward.
19. Existing tests remain PASS.
20. New S12 deterministic tests PASS.
21. Typecheck PASS.
22. Build PASS.
23. Verification report contains evidence, not only claims.

---

# 38. Failure conditions

S12 MUST FAIL or remain BLOCKED if:

- full Skill definitions are loaded during ordinary discovery;
- the entire catalog is injected into Context;
- discovery bypasses `AgentDefinition.skills` allowlist;
- empty allowlist falls back to every Skill;
- Core branches on Skill IDs;
- Skill content moves into generic Agent Core;
- a Skill is treated as an executable Tool;
- a malformed loaded Skill is accepted silently;
- version mismatch silently substitutes another version;
- S11 protected semantics are removed or weakened;
- S12 silently changes `AgentDefinition.skills` away from `string[]`;
- S12 rewrites `compileAgentDefinition()` to embed Skill contents;
- S12 creates production S13x Skills;
- S12 introduces Skill Factory/MCP/multi-agent/Workflow scope;
- regressions occur in approved S07–S11 behavior.

---

# 39. Deferred scope

S12 does not decide:

```text
generic Skill dependency graph execution
semantic/vector Skill ranking
Skill marketplace/distribution
remote Skill providers
Skill signatures/trust system
Skill authoring UI
Skill Factory
automatic Skill generation
Skill performance optimization
Skill version-range resolution
multi-Skill orchestration
prompt/context materialization strategy
```

These require later evidence and explicit contracts.

---

# 40. Part B implementation rule

Claude Code may make mechanical implementation decisions such as:

- filenames consistent with the repo;
- error class naming;
- small helper-function decomposition;
- deterministic lexical scoring formula;
- test fixture wording.

Claude Code MUST NOT make new semantic decisions about:

- Skill field meanings;
- discovery versus load boundary;
- AgentDefinition allowlist semantics;
- provider/core/intelligence boundaries;
- migration scope;
- protected S11 semantics;
- PASS criteria.

If implementation exposes a semantic contradiction, return:

```text
S12_FEEDBACK_REQUIRED
```

with evidence and STOP.

Do not silently revise this contract.

---

# 41. Expected S12 closure flow

```text
ChatGPT Part A
  ↓
integrate SKILL_CONTRACT_v1.md verbatim
  ↓
Claude Code Part B
  ↓
implement types + provider + selector + S11 migration
  ↓
T1–T20
  ↓
typecheck
  ↓
full tests
  ↓
build
  ↓
post-build tests
  ↓
verification report
  ↓
STATE.yaml
  ↓
PASS | FAIL | BLOCKED
```

Do not begin S13x automatically after S12.

---

# 42. Decision summary

| Ambiguity | S12 canonical decision |
|---|---|
| Field shapes | All 12 fields receive concrete typed shapes in `SkillDefinition`. |
| Architecture placement | Generic Core-adjacent `SkillProvider` contract; Skill content in Intelligence; concrete provider under Providers. |
| S10 compiler integration | Deferred; S12 remains additive and does not modify `compileAgentDefinition()` to inject Skill contents. |
| Canonical authored Skill path | `brain-bootstrap/skills/` remains canonical. |
| Runtime Skill path | `src/intelligence/skills/` is derived runtime representation only. |
| S11 migration | In S12 scope, non-destructive; canonical Markdown preserved and typed v1 representation added. |
| Real engineering mechanism | Required in Part B. |
| Discovery | Metadata-only, bounded. |
| Full content loading | Selected Skill only, lazy. |
| Agent Skill policy | `AgentDefinition.skills: string[]` is the maximum discover/load allowlist. |
| Ranking | Deterministic descriptor-only lexical reference implementation sufficient. |
| Production S13x Skills | Out of scope. |

---

## Author-side self-check

All six S12 ambiguities are explicitly resolved. The contract gives every bootstrap field a concrete implementable shape while preserving Skill ≠ Tool, Intelligence ≠ Core, and the existing `AgentDefinition.skills: string[]` contract. Discovery is mechanically separated from lazy loading, so Part B can prove that full Skill contents are not injected across the catalog. S11 migration is included without rewriting its protected Research semantics, and T1–T20 plus the PASS/failure conditions are concrete enough for Claude Code to implement and verify without additional semantic architecture decisions.

**Author-side status: READY_FOR_S12_PART_B.**
