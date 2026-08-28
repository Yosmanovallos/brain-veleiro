import { SAFE_IDENTIFIER } from "./constants.js";
import type { PostgresArmScore, PostgresAssertionResult, PostgresComparison, PostgresDataModelingDecision, PostgresDataModelingInput, PostgresDimensionId, PostgresScoreCategory } from "./types.js";

export interface PostgresScoredRun { input: PostgresDataModelingInput; candidateDecision: PostgresDataModelingDecision; }
export interface FrozenPostgresFixtureTruth { task_ref: string; expected_assertions: Record<string, unknown>; }
export const POSTGRES_COMPARISON_ASSERTIONS: Array<{ id: string; category: PostgresScoreCategory }> = [
  ...[...Array(10)].flatMap((_, dimensionIndex) => [...Array(3)].map((__, assertionIndex) => ({ id: `SD${dimensionIndex + 1}-${String.fromCharCode(65 + assertionIndex)}`, category: `SD-${String(dimensionIndex + 1).padStart(3, "0")}` as PostgresDimensionId }))),
  { id: "XC-A", category: "REGRESSION_CROSS_CUTTING" },
];
const dimensions = [...Array(10)].map((_, index) => `SD-${String(index + 1).padStart(3, "0")}` as PostgresDimensionId);
const sorted = <T>(items: T[], key: (item: T) => string): T[] => [...items].sort((a, b) => key(a).localeCompare(key(b)));

/** Thirty independent observations; A/B/C never alias one whole-dimension predicate. */
export function extractPostgresAssertionObservations(decision: PostgresDataModelingDecision): Record<string, unknown> {
  const tables = sorted(decision.schema_model.tables, (table) => table.id);
  const columns = tables.flatMap((table) => sorted(table.columns, (column) => column.id).map((column) => ({ table: table.id, id: column.id, name: column.name, type: column.postgres_type, nullable: column.nullable, sensitivity: column.sensitivity })));
  const indexes = sorted(decision.index_plan.indexes, (index) => index.id); const queries = sorted(decision.query_check_plan.checks, (check) => check.query_ref); const transactions = sorted(decision.transaction_plan.transactions, (tx) => tx.id); const steps = sorted(decision.migration_plan.steps, (step) => step.id);
  return {
    "SD1-A": tables.map((table) => ({ id: table.id, schema: table.schema_name, name: table.name })),
    "SD1-B": tables.every((table) => SAFE_IDENTIFIER.test(table.schema_name) && SAFE_IDENTIFIER.test(table.name) && table.columns.every((column) => SAFE_IDENTIFIER.test(column.name))),
    "SD1-C": tables.map((table) => ({ id: table.id, strategy: table.primary_key.strategy, refs: table.primary_key.column_refs })),
    "SD2-A": tables.flatMap((table) => sorted(table.foreign_keys, (fk) => fk.id).map((fk) => ({ table: table.id, id: fk.id, from: fk.from_column_refs, to_table: fk.to_table_ref, to: fk.to_column_refs, delete: fk.on_delete, update: fk.on_update }))),
    "SD2-B": columns.map((column) => ({ id: column.id, nullable: column.nullable })),
    "SD2-C": tables.map((table) => ({ id: table.id, unique: table.unique_constraints.map((item) => item.column_refs), checks: table.check_constraints.map((item) => item.expression) })),
    "SD3-A": columns.map((column) => ({ id: column.id, type: column.type })),
    "SD3-B": columns.map((column) => ({ id: column.id, sensitivity: column.sensitivity })),
    "SD3-C": columns.filter((column) => column.type === "jsonb" || column.type.endsWith("[]")).map((column) => column.id),
    "SD4-A": indexes.map((index) => ({ id: index.id, table: index.table_ref, unique: index.unique, method: index.method })),
    "SD4-B": indexes.map((index) => ({ id: index.id, keys: index.key_column_refs, order: index.order ?? [], predicate: index.predicate ?? null, expression: index.expression ?? null })),
    "SD4-C": { rejected: decision.index_plan.rejected_redundant_index_refs, missing: decision.index_plan.missing_critical_access_refs },
    "SD5-A": queries.map((query) => ({ id: query.query_ref, status: query.status })),
    "SD5-B": queries.map((query) => ({ id: query.query_ref, indexes: query.supporting_index_refs, blockers: query.blockers })),
    "SD5-C": queries.map((query) => ({ id: query.query_ref, runtime: query.runtime_evidence_required })),
    "SD6-A": transactions.map((tx) => ({ id: tx.id, operations: tx.operation_refs })),
    "SD6-B": transactions.map((tx) => ({ id: tx.id, isolation: tx.isolation, lock: tx.lock_mode })),
    "SD6-C": transactions.map((tx) => ({ id: tx.id, order: tx.lock_order_refs, retry: tx.serializable_retry_handoff_ref ?? null, invariants: tx.invariant_refs })),
    "SD7-A": decision.migration_plan.compatibility_mode,
    "SD7-B": steps.map((step) => ({ id: step.id, phase: step.phase, mode: step.transaction_mode, destructive: step.destructive })),
    "SD7-C": steps.map((step) => ({ id: step.id, lock: step.lock_risk, rewrite: step.rewrite_risk, bounded: step.backfill_bounded, approval: step.approval_ref ?? null, recovery: step.recovery_evidence_refs })),
    "SD8-A": tables.map((table) => ({ id: table.id, rls: table.rls_required })),
    "SD8-B": tables.map((table) => ({ id: table.id, schema: table.schema_name })),
    "SD8-C": { extensions: decision.schema_model.required_extensions, versions: decision.schema_model.version_requirements },
    "SD9-A": { task: decision.task_ref, specs: decision.spec_refs }, "SD9-B": decision.acceptance, "SD9-C": decision.evidence_required,
    "SD10-A": { s13l: decision.boundary_handoffs.deferred_to_s13l, s13o: decision.boundary_handoffs.deferred_to_s13o, s13r: decision.boundary_handoffs.deferred_to_s13r, s14: decision.boundary_handoffs.deferred_to_s14 },
    "SD10-B": decision.boundary_handoffs.runtime_postgres_evidence_required,
    "SD10-C": { status: decision.status, blockers: decision.blockers },
    "XC-A": decision.task_ref.length > 0,
  };
}

function score(runs: readonly PostgresScoredRun[], frozenTruth: ReadonlyMap<string, FrozenPostgresFixtureTruth>): PostgresArmScore {
  const assertions: PostgresAssertionResult[] = []; let missing = 0, destructive = 0, unsafeQuery = 0, runtime = 0, future = 0;
  for (const run of runs) {
    const truth = frozenTruth.get(run.input.task_ref); if (!truth) throw new Error(`Missing frozen truth for ${run.input.task_ref}`); const actual = extractPostgresAssertionObservations(run.candidateDecision);
    for (const assertion of POSTGRES_COMPARISON_ASSERTIONS) assertions.push({ ...assertion, correct: JSON.stringify(actual[assertion.id]) === JSON.stringify(truth.expected_assertions[assertion.id]), hard_invariant: true });
    missing += run.candidateDecision.schema_model.tables.filter((table) => !table.primary_key.column_refs.length).length + run.input.relationships.filter((rel) => rel.integrity_required && !rel.external_reference && !run.candidateDecision.schema_model.tables.some((table) => table.foreign_keys.some((fk) => fk.id === rel.id))).length;
    destructive += run.candidateDecision.migration_plan.steps.filter((step) => step.destructive && (!step.approval_ref || !step.recovery_evidence_refs.length)).length; unsafeQuery += run.candidateDecision.query_check_plan.checks.filter((check) => check.status === "BLOCKED").length; runtime += run.candidateDecision.schema_model.required_extensions.filter((extension) => !run.input.target.extensions.includes(extension)).length; future += run.candidateDecision.boundary_handoffs.deferred_to_s14.length ? 0 : 1;
  }
  const by_dimension = Object.fromEntries(dimensions.map((dimension) => { const selected = assertions.filter((assertion) => assertion.category === dimension); return [dimension, { assertion_ids: [...new Set(selected.map((assertion) => assertion.id))], total: selected.length, correct: selected.filter((assertion) => assertion.correct).length }]; })) as PostgresArmScore["by_dimension"]; const cross = assertions.filter((assertion) => assertion.category === "REGRESSION_CROSS_CUTTING");
  return { total_assertions: assertions.length, correct: assertions.filter((assertion) => assertion.correct).length, by_dimension, cross_cutting: { assertion_ids: [...new Set(cross.map((assertion) => assertion.id))], total: cross.length, correct: cross.filter((assertion) => assertion.correct).length }, hard_invariant_total: assertions.length, hard_invariant_correct: assertions.filter((assertion) => assertion.correct).length, missing_key_fk_constraint_recommendations: missing, unsafe_destructive_migration_recommendations: destructive, unbounded_or_n_plus_one_critical_query_recommendations: unsafeQuery, provider_credential_live_runtime_bindings: runtime, future_stage_pull_forward_violations: future, assertions };
}

export function comparePostgresDataModelingRuns(baselineRuns: readonly PostgresScoredRun[], skillRuns: readonly PostgresScoredRun[], frozenTruthEntries: readonly FrozenPostgresFixtureTruth[]): PostgresComparison {
  if (baselineRuns.length !== skillRuns.length || baselineRuns.length < 6 || frozenTruthEntries.length !== skillRuns.length) throw new Error("S13J comparison requires matching six-plus arms and frozen truth."); const truth = new Map(frozenTruthEntries.map((entry) => [entry.task_ref, entry])); const baseline = score(baselineRuns, truth), skill = score(skillRuns, truth);
  const dimension_improvements = Object.fromEntries(dimensions.map((dimension) => { const delta = skill.by_dimension[dimension].correct - baseline.by_dimension[dimension].correct; const contributions: Record<string, number> = {}; for (const id of skill.by_dimension[dimension].assertion_ids) { const skillItems = skill.assertions.filter((item) => item.category === dimension && item.id === id); const baselineItems = baseline.assertions.filter((item) => item.category === dimension && item.id === id); contributions[id] = skillItems.reduce((sum, item, index) => sum + (item.correct && !baselineItems[index]?.correct ? 1 : 0), 0); } const max = Math.max(0, ...Object.values(contributions)); return [dimension, { delta, scored_assertions: skill.by_dimension[dimension].assertion_ids.length, single_assertion_contributions: contributions, max_single_assertion_share: delta > 0 ? max / delta : 0 }]; })) as PostgresComparison["dimension_improvements"];
  const improved_dimensions = dimensions.filter((dimension) => { const evidence = dimension_improvements[dimension]; return evidence.scored_assertions >= 3 && evidence.delta >= 2 && evidence.max_single_assertion_share <= 0.5; }); const dimension_specific_total_delta = dimensions.reduce((sum, dimension) => sum + dimension_improvements[dimension].delta, 0); const hard_invariant_regressed = skill.hard_invariant_correct < baseline.hard_invariant_correct;
  const meets_threshold = skill.hard_invariant_correct === skill.hard_invariant_total && skill.missing_key_fk_constraint_recommendations === 0 && skill.unsafe_destructive_migration_recommendations === 0 && skill.unbounded_or_n_plus_one_critical_query_recommendations === 0 && skill.provider_credential_live_runtime_bindings === 0 && skill.future_stage_pull_forward_violations === 0 && dimension_specific_total_delta >= 16 && improved_dimensions.length >= 6 && !hard_invariant_regressed;
  return { baseline, skill, dimension_specific_total_delta, improved_dimensions, dimension_improvements, hard_invariant_regressed, meets_threshold };
}
