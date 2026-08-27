/**
 * Brain — S13F Implementation Planning constants.
 *
 * Stable identifiers and parseable marker strings shared by the S13F Skill
 * definition, the materialization bridge, the deterministic ModelProvider
 * fixture, and the tests. Mirrors
 * src/intelligence/agent-engineering/agentEngineeringSkill.ts.
 *
 * The canonical semantic source of truth for S13F is
 * brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md,
 * brain-bootstrap/quality-contracts/S13F_IMPLEMENTATION_PLANNING_DEEP.yaml, and
 * brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md
 * (ChatGPT-authored, integrated verbatim).
 */

/** Skill Contract v1 id — Skill file "Identity" block. */
export const IMPLEMENTATION_PLANNING_SKILL_ID = "intelligence.implementation-planning.s13f";

/** DEEP Quality Contract reference — Skill file "Inputs" section 4. */
export const IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF =
  "brain-bootstrap/quality-contracts/S13F_IMPLEMENTATION_PLANNING_DEEP.yaml";

/** Canonical Skill markdown artifact path. */
export const IMPLEMENTATION_PLANNING_SKILL_ARTIFACT_PATH =
  "brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md";

/** Canonical execution/integration spec artifact path. */
export const IMPLEMENTATION_PLANNING_SPEC_ARTIFACT_PATH =
  "brain-bootstrap/specs/IMPLEMENTATION_PLANNING_AGENT_SPEC_S13F.md";

/**
 * Stable, parseable contract with the ModelProvider that consumes the
 * materialized objective (mirrors AGENT_ENGINEERING_INPUT_MARKER). Not prose
 * for a human reader.
 */
export const IMPLEMENTATION_PLANNING_INPUT_MARKER = "IMPLEMENTATION_PLANNING_INPUT:";

/** Present in the objective only for the Skill-assisted arm, never the baseline. */
export const IMPLEMENTATION_PLANNING_SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";
