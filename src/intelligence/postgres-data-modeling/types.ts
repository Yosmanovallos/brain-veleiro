import type { TaskAcceptanceCriterion } from "../implementation-planning/types.js";

export type PostgresDataModelingStatus = "READY" | "BLOCKED";
export type PostgresModelingMode = "GREENFIELD" | "EVOLUTION";
export type PostgresPkStrategy = "SURROGATE_BIGINT" | "SURROGATE_UUID" | "NATURAL" | "COMPOSITE";
export type PostgresFkDeleteAction = "NO_ACTION" | "RESTRICT" | "CASCADE" | "SET_NULL";
export type PostgresIsolationLevel = "READ_COMMITTED" | "REPEATABLE_READ" | "SERIALIZABLE";
export type PostgresLockMode = "NONE" | "ROW_LOCK";
export type PostgresSensitivity = "NONE" | "PII" | "SECRET" | "CREDENTIAL_MATERIAL";
export type PostgresQueryCriticality = "LOW" | "MEDIUM" | "HIGH";
export type PostgresCardinalityClass = "SMALL_BOUNDED" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type PostgresQueryCheckStatus = "STATIC_PASS" | "RUNTIME_EVIDENCE_REQUIRED" | "BLOCKED";
export type PostgresMigrationPhase = "EXPAND" | "BACKFILL" | "VALIDATE" | "CUTOVER" | "CONTRACT";
export type PostgresMigrationTransactionMode = "REQUIRED" | "OPTIONAL" | "FORBIDDEN";
export type PostgresRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PostgresTargetFacts { schema_name: string; major_version?: number; extensions: string[]; rls_mode: "NOT_REQUESTED" | "REQUIRED_BY_UPSTREAM" | "DEFERRED_TO_S13L"; }
export interface NaturalKeyCandidateIntent { field_refs: string[]; domain_unique: boolean; stable: boolean; immutable: boolean; source_refs: string[]; }
export interface PostgresEntityIdentityIntent { distributed_generation_required: boolean; external_preallocation_required: boolean; association_identity: boolean; natural_key_candidates: NaturalKeyCandidateIntent[]; preferred_strategy?: PostgresPkStrategy; source_refs: string[]; }
export type PostgresSemanticType = "IDENTIFIER" | "TEXT" | "BOOLEAN" | "INTEGER" | "DECIMAL" | "MONEY" | "DATE" | "INSTANT" | "LOCAL_DATETIME" | "STATUS" | "JSON_DOCUMENT" | "ATOMIC_LIST" | "BINARY";
export interface PostgresFieldIntent { id: string; logical_name: string; semantic_type: PostgresSemanticType; required_at_insert: boolean; mutable: boolean; sensitivity: PostgresSensitivity; storage_security_ref?: string; closed_stable_values?: string[]; queryable_independently: boolean; relationship_target_ref?: string; source_refs: string[]; }
export interface PostgresEntityIntent { id: string; logical_name: string; persisted: boolean; fields: PostgresFieldIntent[]; identity: PostgresEntityIdentityIntent; tenant_scope_required: boolean; tenant_field_ref?: string; audit_requirements: { created_at_required: boolean; updated_at_required: boolean; updated_at_maintenance_owner?: "APPLICATION" | "DATABASE_APPROVED_TRIGGER"; soft_delete_required: boolean; }; source_refs: string[]; }
export interface PostgresRelationshipIntent { id: string; from_entity_ref: string; from_field_refs: string[]; to_entity_ref: string; to_field_refs: string[]; integrity_required: boolean; external_reference: boolean; child_may_outlive_parent: boolean; orphan_valid: boolean; preferred_delete_action?: PostgresFkDeleteAction; source_refs: string[]; }
export type PostgresDataAccessKind = "READ" | "CREATE" | "UPDATE" | "DELETE" | "EXISTS" | "LIST";
export interface PostgresDataAccessRequirement { id: string; kind: PostgresDataAccessKind; entity_ref: string; field_intent_refs: string[]; source_refs: string[]; }
export interface PostgresAtomicityIntent { requirement: "NONE" | "ATOMIC_GROUP_REQUIRED"; logical_operation_refs: string[]; source_refs: string[]; }
export interface PostgresPredicateIntent { field_ref: string; operator: "EQ" | "IN" | "RANGE" | "PREFIX" | "IS_NULL" | "IS_NOT_NULL"; }
export interface PostgresOrderIntent { field_ref: string; direction: "ASC" | "DESC"; }
export interface PostgresJoinIntent { from_field_ref: string; to_entity_ref: string; to_field_ref: string; }
export interface PostgresQueryPattern { id: string; operation_ref: string; entity_ref: string; joins: PostgresJoinIntent[]; predicates: PostgresPredicateIntent[]; order_by: PostgresOrderIntent[]; pagination: "NONE" | "LIMIT" | "OFFSET_LIMIT" | "KEYSET"; max_rows?: number; potentially_unbounded: boolean; n_plus_one_shape: boolean; cardinality: PostgresCardinalityClass; criticality: PostgresQueryCriticality; runtime_plan_evidence_required: boolean; source_refs: string[]; }
export interface PostgresMigrationCompatibilityInput { external_consumers_exist: boolean; backward_compatible_required: boolean; destructive_change_approved: boolean; destructive_approval_ref?: string; recovery_evidence_refs: string[]; populated_entities: string[]; large_or_hot_entities: string[]; }
export interface PostgresEvidenceRequirement { kind: "TYPECHECK" | "BUILD" | "CONTRACT_TEST" | "DDL_INSPECTION" | "QUERY_PLAN_FUTURE" | "MIGRATION_FUTURE" | "OTHER_DETERMINISTIC"; description: string; source_ref?: string; }
export interface PostgresDataModelingInput { task_ref: string; spec_refs: string[]; mode: PostgresModelingMode; target: PostgresTargetFacts; entities: PostgresEntityIntent[]; relationships: PostgresRelationshipIntent[]; data_access_requirements: PostgresDataAccessRequirement[]; atomicity_intent: PostgresAtomicityIntent; query_patterns: PostgresQueryPattern[]; migration_compatibility: PostgresMigrationCompatibilityInput; acceptance: TaskAcceptanceCriterion[]; evidence_required: PostgresEvidenceRequirement[]; }

export interface PostgresColumnDesign { id: string; name: string; logical_field_ref: string; postgres_type: string; nullable: boolean; default_expression?: string; sensitivity: PostgresSensitivity; }
export interface PostgresPrimaryKeyDesign { strategy: PostgresPkStrategy; column_refs: string[]; justification_refs: string[]; }
export interface PostgresForeignKeyDesign { id: string; from_column_refs: string[]; to_table_ref: string; to_column_refs: string[]; on_delete: PostgresFkDeleteAction; on_update: "NO_ACTION" | "CASCADE"; justification_refs: string[]; }
export interface PostgresUniqueConstraintDesign { id: string; column_refs: string[]; predicate?: string; source_refs: string[]; }
export interface PostgresCheckConstraintDesign { id: string; expression: string; source_refs: string[]; }
export interface PostgresTableDesign { id: string; schema_name: string; name: string; columns: PostgresColumnDesign[]; primary_key: PostgresPrimaryKeyDesign; foreign_keys: PostgresForeignKeyDesign[]; unique_constraints: PostgresUniqueConstraintDesign[]; check_constraints: PostgresCheckConstraintDesign[]; rls_required: boolean; source_refs: string[]; }
export interface PostgresSchemaModel { tables: PostgresTableDesign[]; required_extensions: string[]; version_requirements: Array<{ feature: string; minimum_major_version: number; source_refs: string[] }>; }
export interface PostgresIndexDesign { id: string; table_ref: string; unique: boolean; method: "BTREE"; key_column_refs: string[]; order?: Array<"ASC" | "DESC">; include_column_refs: string[]; predicate?: string; expression?: string; concurrently_planned: boolean; covers_query_refs: string[]; justification_refs: string[]; }
export interface PostgresIndexPlan { indexes: PostgresIndexDesign[]; rejected_redundant_index_refs: string[]; missing_critical_access_refs: string[]; }
export interface PostgresQueryCheck { query_ref: string; status: PostgresQueryCheckStatus; supporting_index_refs: string[]; blockers: string[]; runtime_evidence_required: string[]; }
export interface PostgresQueryCheckPlan { checks: PostgresQueryCheck[]; }
export interface PostgresTransactionDesign { id: string; operation_refs: string[]; isolation: PostgresIsolationLevel; lock_mode: PostgresLockMode; lock_order_refs: string[]; invariant_refs: string[]; serializable_retry_handoff_ref?: string; source_refs: string[]; }
export interface PostgresTransactionPlan { transactions: PostgresTransactionDesign[]; }
export interface PostgresMigrationStep { id: string; phase: PostgresMigrationPhase; description: string; entity_refs: string[]; transaction_mode: PostgresMigrationTransactionMode; destructive: boolean; lock_risk: PostgresRiskLevel; rewrite_risk: PostgresRiskLevel; backfill_bounded: boolean; approval_ref?: string; recovery_evidence_refs: string[]; source_refs: string[]; }
export interface PostgresMigrationPlan { steps: PostgresMigrationStep[]; compatibility_mode: "GREENFIELD" | "EXPAND_CONTRACT" | "BREAKING_APPROVED"; }
export interface PostgresBoundaryHandoffs { deferred_to_s13l: string[]; deferred_to_s13o: string[]; deferred_to_s13r: string[]; deferred_to_s14: string[]; runtime_postgres_evidence_required: string[]; }
export interface PostgresDataModelingDecision { status: PostgresDataModelingStatus; blockers: string[]; task_ref: string; spec_refs: string[]; schema_model: PostgresSchemaModel; index_plan: PostgresIndexPlan; query_check_plan: PostgresQueryCheckPlan; transaction_plan: PostgresTransactionPlan; migration_plan: PostgresMigrationPlan; boundary_handoffs: PostgresBoundaryHandoffs; acceptance: TaskAcceptanceCriterion[]; evidence_required: PostgresEvidenceRequirement[]; }
export interface PostgresDataModelingArtifact { decision: PostgresDataModelingDecision; ddl_preview: string[]; }
export interface PostgresValidationResult { valid: boolean; errors: string[]; }

export type PostgresDimensionId = "SD-001" | "SD-002" | "SD-003" | "SD-004" | "SD-005" | "SD-006" | "SD-007" | "SD-008" | "SD-009" | "SD-010";
export type PostgresScoreCategory = PostgresDimensionId | "REGRESSION_CROSS_CUTTING";
export interface PostgresAssertionResult { id: string; category: PostgresScoreCategory; correct: boolean; hard_invariant: boolean; }
export interface PostgresArmScore { total_assertions: number; correct: number; by_dimension: Record<PostgresDimensionId, { assertion_ids: string[]; total: number; correct: number }>; cross_cutting: { assertion_ids: string[]; total: number; correct: number }; hard_invariant_total: number; hard_invariant_correct: number; missing_key_fk_constraint_recommendations: number; unsafe_destructive_migration_recommendations: number; unbounded_or_n_plus_one_critical_query_recommendations: number; provider_credential_live_runtime_bindings: number; future_stage_pull_forward_violations: number; assertions: PostgresAssertionResult[]; }
export interface PostgresComparison { baseline: PostgresArmScore; skill: PostgresArmScore; dimension_specific_total_delta: number; improved_dimensions: PostgresDimensionId[]; dimension_improvements: Record<PostgresDimensionId, { delta: number; scored_assertions: number; single_assertion_contributions: Record<string, number>; max_single_assertion_share: number }>; hard_invariant_regressed: boolean; meets_threshold: boolean; }
export type { TaskAcceptanceCriterion };
