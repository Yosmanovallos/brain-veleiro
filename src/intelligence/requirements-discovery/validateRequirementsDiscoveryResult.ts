import type { StructuredAgentOutput } from "../../core/agent/index.js";
import type {
  ConstraintKind,
  GoalPriority,
  ImpactLevel,
  OriginKind,
  RequirementsDiscoveryResult,
  RiskLevel,
} from "./types.js";

/**
 * Deterministic S13A RequirementsDiscoveryResult validation.
 *
 * Implements brain-bootstrap/specs/REQUIREMENTS_DISCOVERY_AGENT_v1.md
 * section 10 (traceability, acceptance-linkage, and handoff invariants) and
 * the structural completeness rules implied by sections 4-9. This validator
 * does not consume or produce a runtime TerminalOutcome; it validates the
 * `RequirementsDiscoveryResult` value carried inside
 * StructuredAgentOutput.data. S09's TerminalOutcome and StructuredAgentOutput
 * remain untouched.
 */

const VALID_ORIGINS = new Set<OriginKind>(["EXPLICIT", "DERIVED"]);
const VALID_PRIORITIES = new Set<GoalPriority>(["PRIMARY", "SECONDARY"]);
const VALID_IMPACTS = new Set<ImpactLevel>(["HIGH", "MEDIUM", "LOW"]);
const VALID_RISKS = new Set<RiskLevel>(["HIGH", "MEDIUM", "LOW"]);
const VALID_CONSTRAINT_KINDS = new Set<ConstraintKind>([
  "BUSINESS",
  "TECHNICAL",
  "TIME",
  "BUDGET",
  "LEGAL",
  "SECURITY",
  "COMPLIANCE",
  "OPERATIONS",
  "OTHER",
]);

export interface RequirementsDiscoveryResultValidation {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * RD-V4 requires a trace/reference *to the raw request*, not merely a
 * non-empty string: an EXPLICIT item whose source_excerpt is not literally
 * contained in the request is not a genuine trace back to what the client
 * said, so it is rejected the same as an empty excerpt would be.
 */
function validateOriginTraceability(
  origin: OriginKind,
  sourceExcerpt: string,
  rationale: string,
  context: string,
  errors: string[],
  rawRequest: string,
): void {
  if (!VALID_ORIGINS.has(origin)) {
    errors.push(`${context}.origin must be EXPLICIT | DERIVED`);
    return;
  }
  if (origin === "EXPLICIT") {
    if (!isNonEmptyString(sourceExcerpt)) {
      errors.push(`${context} is EXPLICIT but source_excerpt is empty (RD-V4 traceability violation)`);
    } else if (!rawRequest.includes(sourceExcerpt)) {
      errors.push(
        `${context} is EXPLICIT but source_excerpt is not a literal trace back to the raw request (RD-V4 traceability violation)`,
      );
    }
  }
  if (origin === "DERIVED" && !isNonEmptyString(rationale)) {
    errors.push(`${context} is DERIVED but rationale is empty`);
  }
}

export function validateRequirementsDiscoveryResult(
  result: RequirementsDiscoveryResult,
): RequirementsDiscoveryResultValidation {
  const errors: string[] = [];

  if (!isNonEmptyString(result?.request)) {
    errors.push("request must be a non-empty string");
  }
  const rawRequest = result?.request ?? "";

  const goals = result?.goals ?? [];
  if (hasDuplicates(goals.map((g) => g.id))) errors.push("goals must have unique ids");
  const goalIds = new Set(goals.map((g) => g.id));
  goals.forEach((goal, i) => {
    const ctx = `goals[${i}]`;
    if (!isNonEmptyString(goal.statement)) errors.push(`${ctx}.statement must be a non-empty string`);
    if (!VALID_PRIORITIES.has(goal.priority)) errors.push(`${ctx}.priority must be PRIMARY | SECONDARY`);
    validateOriginTraceability(goal.origin, goal.source_excerpt, goal.rationale, ctx, errors, rawRequest);
  });

  const users = result?.users ?? [];
  if (hasDuplicates(users.map((u) => u.id))) errors.push("users must have unique ids");
  users.forEach((user, i) => {
    const ctx = `users[${i}]`;
    if (!isNonEmptyString(user.description)) errors.push(`${ctx}.description must be a non-empty string`);
    validateOriginTraceability(user.origin, user.source_excerpt, user.rationale, ctx, errors, rawRequest);
  });

  const unknowns = result?.unknowns ?? [];
  if (hasDuplicates(unknowns.map((u) => u.id))) errors.push("unknowns must have unique ids");
  unknowns.forEach((unknown, i) => {
    const ctx = `unknowns[${i}]`;
    if (!isNonEmptyString(unknown.question)) errors.push(`${ctx}.question must be a non-empty string`);
    if (!isNonEmptyString(unknown.why_it_matters)) errors.push(`${ctx}.why_it_matters must be a non-empty string`);
    if (!VALID_IMPACTS.has(unknown.impact)) errors.push(`${ctx}.impact must be HIGH | MEDIUM | LOW`);
    if (typeof unknown.blocking !== "boolean") errors.push(`${ctx}.blocking must be a boolean`);
    for (const relatedId of unknown.related_goal_ids ?? []) {
      if (!goalIds.has(relatedId)) errors.push(`${ctx}.related_goal_ids references unknown goal id '${relatedId}'`);
    }
  });

  const assumptions = result?.assumptions ?? [];
  if (hasDuplicates(assumptions.map((a) => a.id))) errors.push("assumptions must have unique ids");
  assumptions.forEach((assumption, i) => {
    const ctx = `assumptions[${i}]`;
    if (!isNonEmptyString(assumption.statement)) errors.push(`${ctx}.statement must be a non-empty string`);
    if (!isNonEmptyString(assumption.rationale)) errors.push(`${ctx}.rationale must be a non-empty string`);
    if (!VALID_RISKS.has(assumption.risk)) errors.push(`${ctx}.risk must be HIGH | MEDIUM | LOW`);
    if (typeof assumption.must_validate !== "boolean") errors.push(`${ctx}.must_validate must be a boolean`);
    for (const relatedId of assumption.related_goal_ids ?? []) {
      if (!goalIds.has(relatedId)) errors.push(`${ctx}.related_goal_ids references unknown goal id '${relatedId}'`);
    }
  });

  const constraints = result?.constraints ?? [];
  if (hasDuplicates(constraints.map((c) => c.id))) errors.push("constraints must have unique ids");
  constraints.forEach((constraint, i) => {
    const ctx = `constraints[${i}]`;
    if (!isNonEmptyString(constraint.statement)) errors.push(`${ctx}.statement must be a non-empty string`);
    if (!VALID_CONSTRAINT_KINDS.has(constraint.kind)) errors.push(`${ctx}.kind is invalid`);
    validateOriginTraceability(constraint.origin, constraint.source_excerpt, constraint.rationale, ctx, errors, rawRequest);
  });

  const acceptanceCriteria = result?.acceptance_criteria ?? [];
  if (hasDuplicates(acceptanceCriteria.map((a) => a.id))) errors.push("acceptance_criteria must have unique ids");
  acceptanceCriteria.forEach((criterion, i) => {
    const ctx = `acceptance_criteria[${i}]`;
    if (!isNonEmptyString(criterion.criterion)) errors.push(`${ctx}.criterion must be a non-empty string`);
    if (!Array.isArray(criterion.linked_goal_ids) || criterion.linked_goal_ids.length < 1) {
      errors.push(`${ctx}.linked_goal_ids must contain at least one goal id (RD-R5)`);
    } else {
      for (const goalId of criterion.linked_goal_ids) {
        if (!goalIds.has(goalId)) errors.push(`${ctx}.linked_goal_ids references unknown goal id '${goalId}'`);
      }
    }
    if (criterion.testable !== true) errors.push(`${ctx}.testable must be true`);
    if (!isNonEmptyString(criterion.verification_hint)) errors.push(`${ctx}.verification_hint must be a non-empty string`);
  });

  const handoff = result?.handoff;
  if (!handoff || typeof handoff.ready_for_gap_analysis !== "boolean") {
    errors.push("handoff.ready_for_gap_analysis must be a boolean");
  }
  if (!handoff || !Array.isArray(handoff.unresolved_blockers)) {
    errors.push("handoff.unresolved_blockers must be an array");
  } else {
    const unknownIds = new Set(unknowns.map((u) => u.id));
    for (const blockerId of handoff.unresolved_blockers) {
      if (!unknownIds.has(blockerId)) {
        errors.push(`handoff.unresolved_blockers references unknown id '${blockerId}' not present in unknowns`);
      }
    }
    const blockerSet = new Set(handoff.unresolved_blockers);
    for (const unknown of unknowns) {
      if (unknown.blocking && !blockerSet.has(unknown.id)) {
        errors.push(`unknowns[${unknown.id}] is blocking but missing from handoff.unresolved_blockers (RD-V5)`);
      }
    }
  }
  if (!handoff || typeof handoff.notes !== "string") {
    errors.push("handoff.notes must be a string");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * REQUIREMENTS_DISCOVERY_AGENT_v1.md section 8/9 — exact StructuredAgentOutput
 * mapping.
 *
 * summary = a short requirements-discovery summary derived from the actual
 *   result (goal/user/unknown/blocker counts) — never a canned constant.
 * data = result
 * evidence_refs = [] (S13A uses no external evidence capability; traceability
 *   to the raw request lives in origin/source_excerpt, not S09 evidence refs)
 */
export function mapRequirementsDiscoveryResultToStructuredOutput(
  result: RequirementsDiscoveryResult,
): StructuredAgentOutput {
  const blockingCount = result.handoff.unresolved_blockers.length;
  const summary =
    `Requirements discovery for "${result.request.slice(0, 80)}${result.request.length > 80 ? "..." : ""}" ` +
    `produced ${result.goals.length} goal(s), ${result.users.length} user(s), ${result.unknowns.length} unknown(s) ` +
    `(${blockingCount} blocking), ${result.assumptions.length} assumption(s), ${result.constraints.length} ` +
    `constraint(s), and ${result.acceptance_criteria.length} acceptance criterion/criteria. Ready for gap ` +
    `analysis: ${result.handoff.ready_for_gap_analysis ? "yes" : "no"}.`;

  return {
    summary,
    data: result as unknown as Record<string, unknown>,
    evidence_refs: [],
  };
}
