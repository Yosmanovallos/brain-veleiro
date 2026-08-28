import type { ApiAtomicityContract, ApiDataPortRequirement } from "../backend-api-engineering/types.js";
import { SAFE_IDENTIFIER } from "./constants.js";
import type {
  PostgresAtomicityIntent, PostgresColumnDesign, PostgresDataAccessRequirement,
  PostgresDataModelingArtifact, PostgresDataModelingDecision, PostgresDataModelingInput,
  PostgresEntityIntent, PostgresIndexDesign, PostgresMigrationStep, PostgresPkStrategy, PostgresQueryCheck,
  PostgresTableDesign, PostgresValidationResult,
} from "./types.js";

export interface PostgresSynthesisProfile {
  schema_identity: boolean; constraints: boolean; domain_types: boolean; indexes: boolean;
  queries: boolean; transactions: boolean; migrations: boolean; tenant_boundary: boolean;
  traceability: boolean; runtime_boundary: boolean;
}
export const FAITHFUL_POSTGRES_PROFILE: PostgresSynthesisProfile = { schema_identity: true, constraints: true, domain_types: true, indexes: true, queries: true, transactions: true, migrations: true, tenant_boundary: true, traceability: true, runtime_boundary: true };
export const UNGUIDED_POSTGRES_PROFILE: PostgresSynthesisProfile = { schema_identity: false, constraints: false, domain_types: false, indexes: false, queries: false, transactions: false, migrations: false, tenant_boundary: false, traceability: false, runtime_boundary: false };

export function derivePostgresProfileFromRules(ruleText: readonly string[]): PostgresSynthesisProfile {
  const text = ruleText.join("\n").toLowerCase();
  return {
    schema_identity: /every persisted table has pk/.test(text) && /safe identifiers/.test(text),
    constraints: /relationship integrity is explicit/.test(text) && /concurrency-critical uniqueness belongs in db/.test(text),
    domain_types: /exact money is not floating point/.test(text) && /real instants use timestamptz/.test(text),
    indexes: /indexes come from access patterns/.test(text) && /do not duplicate pk\/unique indexes/.test(text),
    queries: /queries are bounded/.test(text) && /avoid n\+1 plans/.test(text),
    transactions: /atomic groups become transaction boundaries/.test(text) && /serializable requires retry handoff/.test(text),
    migrations: /existing schema evolution defaults to expand\/contract/.test(text) && /destructive migration requires approval/.test(text),
    tenant_boundary: /multi-tenancy is optional/.test(text) && /rls is never invented/.test(text),
    traceability: /acceptance\/evidence preserved/.test(text) && /inputs immutable/.test(text),
    runtime_boundary: /no live postgresql side effect/.test(text) && /no future-stage pull-forward/.test(text),
  };
}

export function projectApiDataIntent(data: readonly ApiDataPortRequirement[], atomicity: ApiAtomicityContract): { data_access_requirements: PostgresDataAccessRequirement[]; atomicity_intent: PostgresAtomicityIntent } {
  return {
    data_access_requirements: data.map((item) => ({ id: item.id, kind: item.kind === "ATOMIC_GROUP_REQUIRED" ? "UPDATE" : item.kind, entity_ref: item.resource, field_intent_refs: [...item.field_intent_refs], source_refs: [...item.source_refs] })),
    atomicity_intent: { requirement: atomicity.requirement, logical_operation_refs: [...atomicity.logical_operation_refs], source_refs: [] },
  };
}

function typeFor(field: PostgresEntityIntent["fields"][number], safe: boolean): string {
  if (!safe && field.semantic_type === "MONEY") return "double precision";
  if (!safe && field.semantic_type === "INSTANT") return "timestamp without time zone";
  const map: Record<string, string> = { IDENTIFIER: "text", TEXT: "text", BOOLEAN: "boolean", INTEGER: "bigint", DECIMAL: "numeric", MONEY: "numeric(19,4)", DATE: "date", INSTANT: "timestamptz", LOCAL_DATETIME: "timestamp without time zone", STATUS: "text", JSON_DOCUMENT: "jsonb", ATOMIC_LIST: "text[]", BINARY: "bytea" };
  return map[field.semantic_type];
}
function choosePk(entity: PostgresEntityIntent): { strategy: PostgresPkStrategy; refs: string[] } {
  const stable = entity.identity.natural_key_candidates.find((key) => key.domain_unique && key.stable && key.immutable);
  if (entity.identity.preferred_strategy === "NATURAL" && stable) return { strategy: "NATURAL", refs: [...stable.field_refs] };
  if (entity.identity.preferred_strategy === "COMPOSITE" && entity.identity.association_identity && stable && stable.field_refs.length <= 3) return { strategy: "COMPOSITE", refs: [...stable.field_refs] };
  if (entity.identity.distributed_generation_required || entity.identity.external_preallocation_required) return { strategy: "SURROGATE_UUID", refs: [`${entity.id}.id`] };
  return { strategy: "SURROGATE_BIGINT", refs: [`${entity.id}.id`] };
}
function columnFor(entity: PostgresEntityIntent, field: PostgresEntityIntent["fields"][number], safe: boolean): PostgresColumnDesign {
  return { id: field.id, name: field.logical_name, logical_field_ref: field.id, postgres_type: typeFor(field, safe), nullable: safe ? !field.required_at_insert : true, sensitivity: field.sensitivity };
}
function makeTable(input: PostgresDataModelingInput, entity: PostgresEntityIntent, profile: PostgresSynthesisProfile): PostgresTableDesign {
  const pk = choosePk(entity);
  const fields = entity.fields.map((field) => columnFor(entity, field, profile.domain_types));
  if (profile.schema_identity && !pk.refs.every((ref) => fields.some((f) => f.id === ref))) {
    fields.unshift({ id: `${entity.id}.id`, name: "id", logical_field_ref: `${entity.id}.id`, postgres_type: pk.strategy === "SURROGATE_UUID" ? "uuid" : "bigint", nullable: false, sensitivity: "NONE" });
  }
  return {
    id: entity.id,
    schema_name: profile.schema_identity ? input.target.schema_name : "public",
    name: entity.logical_name,
    columns: fields,
    primary_key: { strategy: pk.strategy, column_refs: profile.schema_identity ? pk.refs : [], justification_refs: [...entity.identity.source_refs] },
    foreign_keys: profile.constraints ? input.relationships.filter((rel) => rel.from_entity_ref === entity.id && rel.integrity_required && !rel.external_reference).map((rel) => ({ id: rel.id, from_column_refs: [...rel.from_field_refs], to_table_ref: rel.to_entity_ref, to_column_refs: [...rel.to_field_refs], on_delete: rel.preferred_delete_action ?? "NO_ACTION", on_update: "NO_ACTION", justification_refs: [...rel.source_refs] })) : [],
    unique_constraints: profile.constraints ? entity.identity.natural_key_candidates.filter((key) => key.domain_unique && JSON.stringify(key.field_refs) !== JSON.stringify(pk.refs)).map((key, index) => ({ id: `${entity.id}_uq_${index + 1}`, column_refs: [...key.field_refs], source_refs: [...key.source_refs] })) : [],
    check_constraints: profile.constraints ? entity.fields.filter((field) => field.semantic_type === "STATUS" && field.closed_stable_values?.length).map((field) => ({ id: `${field.id}_check`, expression: `${field.logical_name} IN (${field.closed_stable_values!.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")})`, source_refs: [...field.source_refs] })) : [],
    rls_required: profile.tenant_boundary && entity.tenant_scope_required && input.target.rls_mode === "REQUIRED_BY_UPSTREAM",
    source_refs: [...entity.source_refs],
  };
}
function makeIndex(query: PostgresDataModelingInput["query_patterns"][number]): PostgresIndexDesign {
  const equality = query.predicates.filter((item) => item.operator === "EQ" || item.operator === "IN").map((item) => item.field_ref);
  const range = query.predicates.filter((item) => item.operator === "RANGE" || item.operator === "PREFIX").map((item) => item.field_ref);
  const ordered = query.order_by.map((item) => item.field_ref).filter((ref) => !equality.includes(ref) && !range.includes(ref));
  return { id: `idx_${query.id}`, table_ref: query.entity_ref, unique: false, method: "BTREE", key_column_refs: [...equality, ...range, ...ordered], order: [...equality.map(() => "ASC" as const), ...range.map(() => "ASC" as const), ...query.order_by.filter((item) => ordered.includes(item.field_ref)).map((item) => item.direction)], include_column_refs: [], concurrently_planned: query.cardinality === "HIGH", covers_query_refs: [query.id], justification_refs: [...query.source_refs] };
}

export function collectPostgresInputErrors(input: PostgresDataModelingInput): string[] {
  const errors: string[] = [];
  if (!input.task_ref.trim() || input.spec_refs.length === 0) errors.push("HI-001 one bounded task/spec slice is required");
  if (!SAFE_IDENTIFIER.test(input.target.schema_name)) errors.push("HI-006/007 explicit safe schema identifier required");
  if (new Set(input.entities.map((e) => e.id)).size !== input.entities.length || input.entities.length === 0) errors.push("HI-001 entity ids must be non-empty and unique");
  const entities = new Map(input.entities.map((e) => [e.id, e]));
  for (const entity of input.entities) {
    if (!SAFE_IDENTIFIER.test(entity.logical_name) || entity.fields.some((f) => !SAFE_IDENTIFIER.test(f.logical_name))) errors.push(`HI-007 unsafe identifier on ${entity.id}`);
    if (entity.persisted) {
      const stable = entity.identity.natural_key_candidates.find((key) => key.domain_unique && key.stable && key.immutable);
      if (entity.identity.preferred_strategy === "NATURAL" && !stable) errors.push(`HI-009 natural PK lacks stable immutable proof on ${entity.id}`);
      if (entity.identity.preferred_strategy === "COMPOSITE" && (!entity.identity.association_identity || !stable || stable.field_refs.length > 3)) errors.push(`HI-008 unjustified composite PK on ${entity.id}`);
    }
    if (entity.tenant_scope_required && (!entity.tenant_field_ref || !entity.fields.some((f) => f.id === entity.tenant_field_ref))) errors.push(`HI-015 tenant scope field missing on ${entity.id}`);
    if (!entity.tenant_scope_required && entity.tenant_field_ref) errors.push(`HI-015 tenant scope invented on ${entity.id}`);
    if (entity.audit_requirements.updated_at_required && !entity.audit_requirements.updated_at_maintenance_owner) errors.push(`HI-038 updated_at maintenance owner missing on ${entity.id}`);
    for (const field of entity.fields) {
      if ((field.sensitivity === "SECRET" || field.sensitivity === "CREDENTIAL_MATERIAL") && !field.storage_security_ref) errors.push(`HI-041 sensitive storage requires S13L reference: ${field.id}`);
      if ((field.semantic_type === "JSON_DOCUMENT" || field.semantic_type === "ATOMIC_LIST") && (field.queryable_independently || field.relationship_target_ref)) errors.push(`HI-018/019 relational semantics hidden in ${field.semantic_type}: ${field.id}`);
    }
  }
  for (const rel of input.relationships) {
    const from = entities.get(rel.from_entity_ref); const to = entities.get(rel.to_entity_ref);
    if (!from || !to || rel.from_field_refs.some((ref) => !from.fields.some((f) => f.id === ref)) || rel.to_field_refs.some((ref) => ref !== `${to?.id}.id` && !to?.fields.some((f) => f.id === ref))) errors.push(`HI-010 relationship references unknown entity/field: ${rel.id}`);
    if (rel.integrity_required && rel.external_reference) errors.push(`HI-010 relationship cannot be both integrity-required and external: ${rel.id}`);
    if (rel.preferred_delete_action === "CASCADE" && rel.child_may_outlive_parent) errors.push(`HI-011 unjustified CASCADE: ${rel.id}`);
    if (rel.preferred_delete_action === "SET_NULL" && (!rel.orphan_valid || rel.from_field_refs.some((ref) => from?.fields.find((f) => f.id === ref)?.required_at_insert))) errors.push(`HI-011 unsafe SET NULL: ${rel.id}`);
  }
  for (const query of input.query_patterns) {
    const entity = entities.get(query.entity_ref);
    const refs = [...query.predicates.map((p) => p.field_ref), ...query.order_by.map((o) => o.field_ref), ...query.joins.map((j) => j.from_field_ref)];
    if (!entity || refs.some((ref) => !entity.fields.some((f) => f.id === ref) && ref !== `${entity.id}.id`)) errors.push(`HI-024 query references unknown field/table: ${query.id}`);
    if (query.potentially_unbounded && (query.pagination === "NONE" || !query.max_rows || query.order_by.length === 0)) errors.push(`HI-024 unbounded or unstable query: ${query.id}`);
    if (query.n_plus_one_shape) errors.push(`HI-025 avoidable N+1 query: ${query.id}`);
    if (query.criticality === "HIGH" && query.cardinality === "HIGH" && query.predicates.length + query.order_by.length === 0) errors.push(`HI-022 critical access path has no viable index shape: ${query.id}`);
  }
  if (input.atomicity_intent.requirement === "ATOMIC_GROUP_REQUIRED" && input.atomicity_intent.logical_operation_refs.length < 2) errors.push("HI-027 atomic group requires multiple logical operations");
  if (input.mode === "EVOLUTION" && input.migration_compatibility.external_consumers_exist && !input.migration_compatibility.backward_compatible_required && !input.migration_compatibility.destructive_change_approved) errors.push("HI-032 compatibility or breaking approval required");
  if (input.migration_compatibility.destructive_change_approved && (!input.migration_compatibility.destructive_approval_ref || input.migration_compatibility.recovery_evidence_refs.length === 0)) errors.push("HI-033 destructive approval requires reference and recovery evidence");
  return errors;
}

export function synthesizePostgresDataModelingDecision(input: PostgresDataModelingInput, profile: PostgresSynthesisProfile = FAITHFUL_POSTGRES_PROFILE): PostgresDataModelingDecision {
  const errors = collectPostgresInputErrors(input);
  const tables = input.entities.filter((entity) => entity.persisted).map((entity) => makeTable(input, entity, profile));
  const indexes = profile.indexes ? input.query_patterns.filter((query) => query.predicates.length + query.order_by.length > 0).map(makeIndex) : [];
  const checks: PostgresQueryCheck[] = input.query_patterns.map((query) => {
    const supporting = indexes.filter((index) => index.covers_query_refs.includes(query.id)).map((index) => index.id);
    const blocked = !profile.queries || query.n_plus_one_shape || (query.potentially_unbounded && (query.pagination === "NONE" || !query.max_rows || query.order_by.length === 0)) || (query.criticality === "HIGH" && query.cardinality === "HIGH" && supporting.length === 0);
    return { query_ref: query.id, status: blocked ? "BLOCKED" : query.runtime_plan_evidence_required ? "RUNTIME_EVIDENCE_REQUIRED" : "STATIC_PASS", supporting_index_refs: supporting, blockers: blocked ? ["query is not statically safe"] : [], runtime_evidence_required: query.runtime_plan_evidence_required && profile.runtime_boundary ? ["future EXPLAIN evidence via S14"] : [] };
  });
  const compatibility = input.mode === "GREENFIELD" ? "GREENFIELD" : input.migration_compatibility.destructive_change_approved ? "BREAKING_APPROVED" : "EXPAND_CONTRACT";
  const migrationSteps: PostgresMigrationStep[] = profile.migrations ? (compatibility === "GREENFIELD" ? [{ id: "migration-create", phase: "EXPAND" as const, description: "Create validated schema objects", entity_refs: tables.map((t) => t.id), transaction_mode: "REQUIRED" as const, destructive: false, lock_risk: "LOW" as const, rewrite_risk: "LOW" as const, backfill_bounded: true, recovery_evidence_refs: [], source_refs: [...input.spec_refs] }] : [
    { id: "migration-expand", phase: "EXPAND" as const, description: "Add backward-compatible structures", entity_refs: tables.map((t) => t.id), transaction_mode: "OPTIONAL" as const, destructive: false, lock_risk: input.migration_compatibility.large_or_hot_entities.length ? "MEDIUM" as const : "LOW" as const, rewrite_risk: "LOW" as const, backfill_bounded: true, recovery_evidence_refs: [...input.migration_compatibility.recovery_evidence_refs], source_refs: [...input.spec_refs] },
    { id: "migration-backfill", phase: "BACKFILL" as const, description: "Backfill populated entities in bounded batches", entity_refs: [...input.migration_compatibility.populated_entities], transaction_mode: "OPTIONAL" as const, destructive: false, lock_risk: "LOW" as const, rewrite_risk: "MEDIUM" as const, backfill_bounded: true, recovery_evidence_refs: [...input.migration_compatibility.recovery_evidence_refs], source_refs: [...input.spec_refs] },
    { id: "migration-validate", phase: "VALIDATE" as const, description: "Validate data and constraints before cutover", entity_refs: tables.map((t) => t.id), transaction_mode: "OPTIONAL" as const, destructive: false, lock_risk: "LOW" as const, rewrite_risk: "LOW" as const, backfill_bounded: true, recovery_evidence_refs: [...input.migration_compatibility.recovery_evidence_refs], source_refs: [...input.spec_refs] },
  ]) : [];
  if (profile.migrations) for (const index of indexes.filter((item) => item.concurrently_planned)) migrationSteps.push({ id: `migration-${index.id}`, phase: "EXPAND", description: `Create ${index.id} concurrently`, entity_refs: [index.table_ref], transaction_mode: "FORBIDDEN", destructive: false, lock_risk: "LOW", rewrite_risk: "LOW", backfill_bounded: true, recovery_evidence_refs: [], source_refs: [...index.justification_refs] });
  const decision: PostgresDataModelingDecision = {
    status: errors.length ? "BLOCKED" : "READY", blockers: [...errors], task_ref: input.task_ref, spec_refs: [...input.spec_refs],
    schema_model: { tables, required_extensions: profile.runtime_boundary ? [...input.target.extensions] : ["pgcrypto"], version_requirements: [] },
    index_plan: { indexes, rejected_redundant_index_refs: [], missing_critical_access_refs: profile.indexes ? [] : input.query_patterns.filter((q) => q.criticality === "HIGH").map((q) => q.id) },
    query_check_plan: { checks },
    transaction_plan: { transactions: profile.transactions && input.atomicity_intent.requirement === "ATOMIC_GROUP_REQUIRED" ? [{ id: "tx-atomic-group", operation_refs: [...input.atomicity_intent.logical_operation_refs], isolation: "READ_COMMITTED", lock_mode: "NONE", lock_order_refs: [], invariant_refs: [...input.atomicity_intent.source_refs], source_refs: [...input.atomicity_intent.source_refs] }] : [] },
    migration_plan: { steps: migrationSteps, compatibility_mode: compatibility },
    boundary_handoffs: profile.runtime_boundary ? { deferred_to_s13l: input.entities.some((e) => e.fields.some((f) => f.sensitivity !== "NONE")) ? ["storage security policy"] : [], deferred_to_s13o: [], deferred_to_s13r: ["migration rollout execution"], deferred_to_s14: ["PostgreSQL runtime capability and plan inspection"], runtime_postgres_evidence_required: input.query_patterns.filter((q) => q.runtime_plan_evidence_required).map((q) => q.id) } : { deferred_to_s13l: [], deferred_to_s13o: [], deferred_to_s13r: [], deferred_to_s14: [], runtime_postgres_evidence_required: [] },
    acceptance: profile.traceability ? structuredClone(input.acceptance) : [], evidence_required: profile.traceability ? structuredClone(input.evidence_required) : [],
  };
  return decision;
}

function canonical(value: unknown): string { return JSON.stringify(value); }
export function validatePostgresDataModelingDecision(candidate: PostgresDataModelingDecision, input: PostgresDataModelingInput): PostgresValidationResult {
  const expected = synthesizePostgresDataModelingDecision(input);
  const errors = [...collectPostgresInputErrors(input)];
  for (const key of ["task_ref", "spec_refs", "schema_model", "index_plan", "query_check_plan", "transaction_plan", "migration_plan", "boundary_handoffs", "acceptance", "evidence_required"] as const) if (canonical(candidate[key]) !== canonical(expected[key])) errors.push(`HI-044 candidate ${key} differs from deterministic contract`);
  if (candidate.status !== expected.status) errors.push("HI-044 candidate status is self-certified");
  if (canonical(candidate.blockers) !== canonical(expected.blockers)) errors.push("HI-044 candidate blockers differ from recomputed blockers");
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function q(name: string): string { if (!SAFE_IDENTIFIER.test(name)) throw new Error(`Unsafe derived DDL identifier: ${name}`); return name; }
function columnName(table: PostgresTableDesign, ref: string): string { return table.columns.find((column) => column.id === ref)?.name ?? ref.split(".").at(-1)!; }
export function renderPostgresDdlPreview(decision: PostgresDataModelingDecision): string[] {
  if (decision.status !== "READY") return [];
  const ddl: string[] = [];
  for (const table of [...decision.schema_model.tables].sort((a, b) => a.id.localeCompare(b.id))) {
    const body = table.columns.map((column) => `  ${q(column.name)} ${column.postgres_type}${column.default_expression ? ` DEFAULT ${column.default_expression}` : ""}${column.nullable ? "" : " NOT NULL"}`);
    body.push(`  CONSTRAINT ${q(`${table.name}_pkey`)} PRIMARY KEY (${table.primary_key.column_refs.map((ref) => q(columnName(table, ref))).join(", ")})`);
    for (const unique of table.unique_constraints) body.push(`  CONSTRAINT ${q(unique.id)} UNIQUE (${unique.column_refs.map((ref) => q(columnName(table, ref))).join(", ")})`);
    for (const check of table.check_constraints) body.push(`  CONSTRAINT ${q(check.id)} CHECK (${check.expression})`);
    for (const fk of table.foreign_keys) { const target = decision.schema_model.tables.find((t) => t.id === fk.to_table_ref)!; body.push(`  CONSTRAINT ${q(fk.id)} FOREIGN KEY (${fk.from_column_refs.map((ref) => q(columnName(table, ref))).join(", ")}) REFERENCES ${q(target.schema_name)}.${q(target.name)} (${fk.to_column_refs.map((ref) => q(columnName(target, ref))).join(", ")}) ON DELETE ${fk.on_delete.replace("_", " ")} ON UPDATE ${fk.on_update.replace("_", " ")}`); }
    ddl.push(`CREATE TABLE ${q(table.schema_name)}.${q(table.name)} (\n${body.join(",\n")}\n);`);
    if (table.rls_required) ddl.push(`ALTER TABLE ${q(table.schema_name)}.${q(table.name)} ENABLE ROW LEVEL SECURITY;`);
  }
  for (const index of [...decision.index_plan.indexes].sort((a, b) => a.id.localeCompare(b.id))) { const table = decision.schema_model.tables.find((t) => t.id === index.table_ref)!; ddl.push(`CREATE INDEX ${index.concurrently_planned ? "CONCURRENTLY " : ""}${q(index.id)} ON ${q(table.schema_name)}.${q(table.name)} USING btree (${index.key_column_refs.map((ref, position) => `${q(columnName(table, ref))} ${index.order?.[position] ?? "ASC"}`).join(", ")});`); }
  return ddl;
}
export function buildPostgresDataModelingArtifact(decision: PostgresDataModelingDecision, input: PostgresDataModelingInput): PostgresDataModelingArtifact { const validation = validatePostgresDataModelingDecision(decision, input); if (!validation.valid || decision.status !== "READY") throw new Error(`Cannot render unvalidated S13J decision: ${validation.errors.join("; ")}`); return { decision: structuredClone(decision), ddl_preview: renderPostgresDdlPreview(decision) }; }
