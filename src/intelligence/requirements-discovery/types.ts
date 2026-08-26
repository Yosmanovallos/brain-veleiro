/**
 * Brain — S13A Requirements Discovery semantic types.
 *
 * Defined in brain-bootstrap/specs/REQUIREMENTS_DISCOVERY_AGENT_v1.md section 7
 * and brain-bootstrap/skills/REQUIREMENTS_DISCOVERY_SKILL_S13A.md sections 3-10
 * (ChatGPT-authored, integrated verbatim as prose; these are the TypeScript
 * shapes Part B derives from that contract). This module belongs to
 * Intelligence: it describes the requirements-discoverer's data model, not a
 * Core runtime concept. `RequirementsDiscoveryResult` is carried as data
 * inside the existing, unmodified S09 `StructuredAgentOutput` — see
 * mapRequirementsDiscoveryResultToStructuredOutput in
 * ./validateRequirementsDiscoveryResult.js.
 *
 * Deliberately excluded: S13B's full Knowledge Gap taxonomy
 * (known/told/proven/assumed/needs-research/unknowable). S13A uses only the
 * lighter impact/blocking shape for unknowns (REQUIREMENTS_DISCOVERY_AGENT_v1.md
 * section 2/6) — see the `ImpactLevel` type below, which intentionally does not
 * reuse or alias any S13B vocabulary.
 */

export type OriginKind = "EXPLICIT" | "DERIVED";

export type GoalPriority = "PRIMARY" | "SECONDARY";

export type ImpactLevel = "HIGH" | "MEDIUM" | "LOW";

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export type ConstraintKind =
  | "BUSINESS"
  | "TECHNICAL"
  | "TIME"
  | "BUDGET"
  | "LEGAL"
  | "SECURITY"
  | "COMPLIANCE"
  | "OPERATIONS"
  | "OTHER";

export interface DiscoveredGoal {
  id: string;
  statement: string;
  origin: OriginKind;
  source_excerpt: string;
  rationale: string;
  priority: GoalPriority;
}

export interface DiscoveredUser {
  id: string;
  description: string;
  origin: OriginKind;
  source_excerpt: string;
  rationale: string;
  needs: string[];
}

export interface DiscoveredUnknown {
  id: string;
  question: string;
  why_it_matters: string;
  impact: ImpactLevel;
  blocking: boolean;
  related_goal_ids: string[];
}

export interface DiscoveredAssumption {
  id: string;
  statement: string;
  rationale: string;
  risk: RiskLevel;
  must_validate: boolean;
  related_goal_ids: string[];
}

export interface DiscoveredConstraint {
  id: string;
  statement: string;
  kind: ConstraintKind;
  origin: OriginKind;
  source_excerpt: string;
  rationale: string;
}

export interface AcceptanceCriterion {
  id: string;
  criterion: string;
  linked_goal_ids: string[];
  testable: boolean;
  verification_hint: string;
}

export interface RequirementsDiscoveryHandoff {
  ready_for_gap_analysis: boolean;
  unresolved_blockers: string[];
  notes: string;
}

export interface RequirementsDiscoveryResult {
  request: string;
  goals: DiscoveredGoal[];
  users: DiscoveredUser[];
  unknowns: DiscoveredUnknown[];
  assumptions: DiscoveredAssumption[];
  constraints: DiscoveredConstraint[];
  acceptance_criteria: AcceptanceCriterion[];
  handoff: RequirementsDiscoveryHandoff;
}
