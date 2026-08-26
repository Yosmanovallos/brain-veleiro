import type { JsonSchemaLike, ToolSideEffectClass } from "../agent/index.js";

/**
 * Brain — Skill Contract v1.
 *
 * Defined in brain-bootstrap/specs/SKILL_CONTRACT_v1.md (ChatGPT-authored,
 * integrated verbatim). These are Core-adjacent contracts (the SkillProvider
 * interface and the generic Skill types it operates on) — mirroring how
 * ModelProvider/CapabilityProvider live in src/core/agent/types.ts. Skill
 * *content* (concrete SkillDefinition values) is Intelligence and lives
 * under src/intelligence/skills/; concrete SkillProvider implementations are
 * Providers and live under src/providers/skill/.
 *
 * Core code that imports these types must never import a concrete
 * SkillProvider implementation or concrete Skill content.
 */

// ---------------------------------------------------------------------------
// Section 6-18 — SkillDefinition field shapes
// ---------------------------------------------------------------------------

export interface SkillApplicability {
  task_kinds: string[];
  signals: string[];
  exclusions: string[];
}

export interface SkillIOField {
  name: string;
  description: string;
  required: boolean;
  schema: JsonSchemaLike;
}

export interface SkillRequirements {
  skills: string[];
  capabilities: string[];
  context_sources: string[];
  quality_contract_refs: string[];
}

export type SkillRuleLevel = "MUST" | "SHOULD" | "MAY";

export interface SkillRule {
  id: string;
  level: SkillRuleLevel;
  statement: string;
}

export interface SkillProcedureStep {
  id: string;
  title: string;
  instruction: string;
  requires: string[];
  produces: string[];
}

export type SkillVerificationKind = "DETERMINISTIC" | "SEMANTIC" | "HUMAN";

export interface SkillVerificationCheck {
  id: string;
  kind: SkillVerificationKind;
  criterion: string;
  evidence_required: boolean;
}

export interface SkillPermissionPolicy {
  allowed_capabilities: string[];
  allowed_side_effects: ToolSideEffectClass[];
  deny_unlisted_capabilities: true;
}

// ---------------------------------------------------------------------------
// Section 5 — SkillDefinition (the full, loaded-on-demand shape)
// ---------------------------------------------------------------------------

export interface SkillDefinition {
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

// ---------------------------------------------------------------------------
// Section 19 — SkillDescriptor (the lightweight, discovery-only projection)
// ---------------------------------------------------------------------------

export interface SkillDescriptor {
  id: string;
  version: string;
  description: string;

  applies_when: SkillApplicability;

  required_capability_ids: string[];
  quality_contract_refs: string[];
}

// ---------------------------------------------------------------------------
// Section 20 — SkillProvider contract
// ---------------------------------------------------------------------------

export interface SkillDiscoveryRequest {
  query: string;

  allowed_skill_ids?: string[];
  task_kinds?: string[];

  limit?: number;
}

export interface SkillLoadRequest {
  id: string;
  version?: string;
}

export interface SkillProvider {
  discover(request: SkillDiscoveryRequest): Promise<SkillDescriptor[]>;
  load(request: SkillLoadRequest): Promise<SkillDefinition>;
}

// ---------------------------------------------------------------------------
// Section 22 — lazy-loading catalog entry
//
// Generic reference architecture for any SkillProvider implementation that
// backs discovery with cheap descriptors and defers full-definition loading
// until a specific Skill is selected. This is a data shape, not a concrete
// provider — Intelligence code may build SkillCatalogEntry[] values without
// depending on any concrete src/providers/ implementation.
// ---------------------------------------------------------------------------

export interface SkillCatalogEntry {
  descriptor: SkillDescriptor;
  load_definition: () => Promise<SkillDefinition>;
}
