import { synthesizePostgresDataModelingDecision } from "./modeling.js";
import type { PostgresArmScore, PostgresAssertionResult, PostgresComparison, PostgresDataModelingDecision, PostgresDataModelingInput, PostgresDimensionId, PostgresScoreCategory } from "./types.js";

export interface PostgresScoredRun { input: PostgresDataModelingInput; candidateDecision: PostgresDataModelingDecision; }
export const POSTGRES_COMPARISON_ASSERTIONS: Array<{ id: string; category: PostgresScoreCategory }> = [
  ...[...Array(10)].flatMap((_, dimensionIndex) => [...Array(3)].map((__, assertionIndex) => ({
    id: `SD${dimensionIndex + 1}-${String.fromCharCode(65 + assertionIndex)}`,
    category: `SD-${String(dimensionIndex + 1).padStart(3, "0")}` as PostgresDimensionId,
  }))),
  { id: "XC-A", category: "REGRESSION_CROSS_CUTTING" },
];
const dimensions = [...Array(10)].map((_, index) => `SD-${String(index + 1).padStart(3, "0")}` as PostgresDimensionId);
function values(decision: PostgresDataModelingDecision): unknown[] { return [decision.schema_model, decision.schema_model.tables.map((t) => [t.primary_key, t.foreign_keys, t.unique_constraints, t.check_constraints]), decision.schema_model.tables.map((t) => t.columns.map((c) => [c.postgres_type, c.nullable, c.sensitivity])), decision.index_plan, decision.query_check_plan, decision.transaction_plan, decision.migration_plan, decision.schema_model.tables.map((t) => [t.schema_name, t.rls_required]), [decision.task_ref, decision.spec_refs, decision.acceptance, decision.evidence_required], decision.boundary_handoffs]; }
function score(runs: readonly PostgresScoredRun[]): PostgresArmScore {
  const assertions: PostgresAssertionResult[] = [];
  let missing = 0, destructive = 0, unsafeQuery = 0, runtime = 0, future = 0;
  for (const run of runs) {
    const expected = synthesizePostgresDataModelingDecision(run.input); const actualValues = values(run.candidateDecision); const expectedValues = values(expected);
    dimensions.forEach((dimension, index) => { for (let assertionIndex = 0; assertionIndex < 3; assertionIndex++) assertions.push({ id: `SD${index + 1}-${String.fromCharCode(65 + assertionIndex)}`, category: dimension, correct: JSON.stringify(actualValues[index]) === JSON.stringify(expectedValues[index]), hard_invariant: true }); });
    assertions.push({ id: "XC-A", category: "REGRESSION_CROSS_CUTTING", correct: run.candidateDecision.task_ref === run.input.task_ref, hard_invariant: true });
    missing += run.candidateDecision.schema_model.tables.filter((t) => !t.primary_key.column_refs.length).length + run.input.relationships.filter((rel) => rel.integrity_required && !rel.external_reference && !run.candidateDecision.schema_model.tables.some((t) => t.foreign_keys.some((fk) => fk.id === rel.id))).length;
    destructive += run.candidateDecision.migration_plan.steps.filter((s) => s.destructive && (!s.approval_ref || !s.recovery_evidence_refs.length)).length;
    unsafeQuery += run.candidateDecision.query_check_plan.checks.filter((c) => c.status === "BLOCKED").length;
    runtime += run.candidateDecision.schema_model.required_extensions.filter((x) => !run.input.target.extensions.includes(x)).length;
    future += Object.values(run.candidateDecision.boundary_handoffs).every(Array.isArray) && run.candidateDecision.boundary_handoffs.deferred_to_s14.length ? 0 : 1;
  }
  const by_dimension = Object.fromEntries(dimensions.map((dimension) => { const selected = assertions.filter((a) => a.category === dimension); return [dimension, { assertion_ids: [...new Set(selected.map((a) => a.id))], total: selected.length, correct: selected.filter((a) => a.correct).length }]; })) as PostgresArmScore["by_dimension"];
  const cross = assertions.filter((a) => a.category === "REGRESSION_CROSS_CUTTING");
  return { total_assertions: assertions.length, correct: assertions.filter((a) => a.correct).length, by_dimension, cross_cutting: { assertion_ids: [...new Set(cross.map((a) => a.id))], total: cross.length, correct: cross.filter((a) => a.correct).length }, hard_invariant_total: assertions.filter((a) => a.hard_invariant).length, hard_invariant_correct: assertions.filter((a) => a.hard_invariant && a.correct).length, missing_key_fk_constraint_recommendations: missing, unsafe_destructive_migration_recommendations: destructive, unbounded_or_n_plus_one_critical_query_recommendations: unsafeQuery, provider_credential_live_runtime_bindings: runtime, future_stage_pull_forward_violations: future, assertions };
}
export function comparePostgresDataModelingRuns(baselineRuns: readonly PostgresScoredRun[], skillRuns: readonly PostgresScoredRun[]): PostgresComparison {
  if (baselineRuns.length !== skillRuns.length || baselineRuns.length < 6) throw new Error("S13J comparison requires matching arms with at least six positives.");
  const baseline = score(baselineRuns), skill = score(skillRuns);
  const dimension_improvements = Object.fromEntries(dimensions.map((dimension) => { const delta = skill.by_dimension[dimension].correct - baseline.by_dimension[dimension].correct; const contributions: Record<string, number> = {}; for (const id of skill.by_dimension[dimension].assertion_ids) { const s = skill.assertions.filter((a) => a.category === dimension && a.id === id); const b = baseline.assertions.filter((a) => a.category === dimension && a.id === id); contributions[id] = s.reduce((sum, item, index) => sum + (item.correct && !b[index]?.correct ? 1 : 0), 0); } const max = Math.max(0, ...Object.values(contributions)); return [dimension, { delta, scored_assertions: skill.by_dimension[dimension].assertion_ids.length, single_assertion_contributions: contributions, max_single_assertion_share: delta > 0 ? max / delta : 0 }]; })) as PostgresComparison["dimension_improvements"];
  const improved_dimensions = dimensions.filter((dimension) => { const e = dimension_improvements[dimension]; return e.scored_assertions >= 3 && e.delta >= 2 && e.max_single_assertion_share <= 0.5; });
  const dimension_specific_total_delta = dimensions.reduce((sum, dimension) => sum + dimension_improvements[dimension].delta, 0);
  const hard_invariant_regressed = skill.hard_invariant_correct < baseline.hard_invariant_correct;
  const meets_threshold = skill.hard_invariant_correct === skill.hard_invariant_total && skill.missing_key_fk_constraint_recommendations === 0 && skill.unsafe_destructive_migration_recommendations === 0 && skill.unbounded_or_n_plus_one_critical_query_recommendations === 0 && skill.provider_credential_live_runtime_bindings === 0 && skill.future_stage_pull_forward_violations === 0 && dimension_specific_total_delta >= 16 && improved_dimensions.length >= 6 && !hard_invariant_regressed;
  return { baseline, skill, dimension_specific_total_delta, improved_dimensions, dimension_improvements, hard_invariant_regressed, meets_threshold };
}
