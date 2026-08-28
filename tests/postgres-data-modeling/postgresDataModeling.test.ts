import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ReferenceCapabilityProvider } from "../../src/providers/capability/referenceCapabilityProvider.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import {
  POSTGRES_COMPARISON_ASSERTIONS, POSTGRES_DATA_MODELING_SKILL_ID, buildPostgresDataModelingArtifact,
  collectPostgresInputErrors, comparePostgresDataModelingRuns, gatePostgresDataModeling,
  planPostgresDataModeling, projectApiDataIntent, renderPostgresDdlPreview,
  synthesizePostgresDataModelingDecision, validatePostgresDataModelingDecision,
  type PostgresDataModelingDecision, type PostgresDataModelingInput,
} from "../../src/intelligence/postgres-data-modeling/index.js";
import { postgresDataModelingS13J, referenceSkillCatalogEntries } from "../../src/intelligence/skills/index.js";
import { ALL_NEGATIVE_FIXTURES, ALL_POSITIVE_INPUTS, DeterministicPostgresModelProvider, FX_POS_001, FX_POS_002, FX_POS_003, FX_POS_005, FX_POS_006, basePostgresInput, cloneFixture, postgresModelingHost } from "./fixtures.js";
import { FROZEN_POSTGRES_FIXTURE_TRUTH } from "./fixtureTruth.js";

const capabilityProvider = new ReferenceCapabilityProvider();
const skillProvider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
const modelProvider = new DeterministicPostgresModelProvider();
const sourceDir = "src/intelligence/postgres-data-modeling";
const PART_A = ["brain-bootstrap/skills/POSTGRES_DATA_MODELING_SKILL_S13J.md", "brain-bootstrap/quality-contracts/S13J_POSTGRES_DATA_MODELING_DEEP.yaml", "brain-bootstrap/specs/POSTGRES_DATA_MODELING_CONTRACT_S13J.md"];
async function run(input: PostgresDataModelingInput, withSkill: boolean) { const host = cloneFixture(postgresModelingHost); if (!withSkill) host.skills = []; return planPostgresDataModeling(input, { baseDefinition: host, ...(withSkill ? { skillProvider } : {}), modelProvider, capabilityProvider }); }

describe("S13J Part A integrity and SKILL_ONLY projection T1-T7", () => {
  it("Part A hashes remain exact", () => expect(PART_A.map((path) => createHash("sha256").update(readFileSync(path)).digest("hex"))).toEqual(["f78f183dfde94105f1c2d94559a6b7fde5af487aa710b07381200b8712d1bdde", "9431c6e4ea19266941071d5ba3522a8154a11bd9b19697a9762fbc8cc7c1f1a1", "d5d1487921f4022fe27d65c584a75b784a9fc9dd11d8eb3f056e13cfb7f73d75"]));
  it("T1/T3/T7 valid bounded input passes and missing task/schema blocks", () => { expect(validatePostgresDataModelingDecision(synthesizePostgresDataModelingDecision(FX_POS_001), FX_POS_001).valid).toBe(true); const a = basePostgresInput(); a.task_ref = ""; expect(collectPostgresInputErrors(a).length).toBeGreaterThan(0); const b = basePostgresInput(); b.target.schema_name = ""; expect(collectPostgresInputErrors(b).length).toBeGreaterThan(0); });
  it("T2 S13I projection and synthesis are immutable", () => { const data = [{ id: "read", kind: "READ" as const, resource: "entry", field_intent_refs: ["entry.id"], source_refs: ["spec"] }]; const atomic = { requirement: "ATOMIC_GROUP_REQUIRED" as const, logical_operation_refs: ["a", "b"] }; const before = JSON.stringify([data, atomic]); const projected = projectApiDataIntent(data, atomic); expect(JSON.stringify([data, atomic])).toBe(before); expect(projected.data_access_requirements[0].entity_ref).toBe("entry"); const input = basePostgresInput(); const inputBefore = JSON.stringify(input); synthesizePostgresDataModelingDecision(input); expect(JSON.stringify(input)).toBe(inputBefore); });
  it("T4/T5/T6 has no AgentDefinition/Core branch and Skill has no capabilities/side effects", () => { expect(readdirSync("src/intelligence/agent-definitions").some((name) => /postgres/i.test(name))).toBe(false); for (const dir of ["src/core/agent", "src/core/skill"]) for (const name of readdirSync(dir)) if (name.endsWith(".ts")) expect(readFileSync(join(dir, name), "utf8")).not.toContain(POSTGRES_DATA_MODELING_SKILL_ID); expect(postgresDataModelingS13J.requires.capabilities).toEqual([]); expect(postgresDataModelingS13J.permissions.allowed_side_effects).toEqual(["NONE"]); });
});

describe("schema, keys, constraints and domain types T8-T34", () => {
  it("T8-T15/T36 safe names and PK selection obey topology/proof without redundant UNIQUE", () => { const base = synthesizePostgresDataModelingDecision(FX_POS_001); expect(base.schema_model.tables.every((table) => table.primary_key.column_refs.length > 0)).toBe(true); const natural = basePostgresInput(); natural.entities[0].identity.preferred_strategy = "NATURAL"; const naturalDecision = synthesizePostgresDataModelingDecision(natural); expect(naturalDecision.schema_model.tables[0].primary_key.strategy).toBe("NATURAL"); expect(naturalDecision.schema_model.tables[0].unique_constraints).toEqual([]); const uuid = basePostgresInput(); uuid.entities[0].identity.distributed_generation_required = true; expect(synthesizePostgresDataModelingDecision(uuid).schema_model.tables[0].primary_key.strategy).toBe("SURROGATE_UUID"); const bad = basePostgresInput(); bad.entities[0].identity.preferred_strategy = "COMPOSITE"; expect(collectPostgresInputErrors(bad).join(" ")).toContain("composite"); });
  it("T16-T24 FK lifecycle, nullability, uniqueness and CHECK are enforced", () => { const d = synthesizePostgresDataModelingDecision(FX_POS_003); expect(d.schema_model.tables.find((t) => t.id === "entry")!.foreign_keys).toHaveLength(1); expect(d.schema_model.tables.flatMap((t) => t.columns).find((c) => c.id === "entry.title")!.nullable).toBe(false); expect(d.schema_model.tables[0].unique_constraints.length).toBeGreaterThan(0); expect(d.schema_model.tables.find((t) => t.id === "entry")!.check_constraints.length).toBeGreaterThan(0); for (const mutate of [(i: PostgresDataModelingInput) => { i.relationships[0].preferred_delete_action = "CASCADE"; i.relationships[0].child_may_outlive_parent = true; }, (i: PostgresDataModelingInput) => { i.relationships[0].preferred_delete_action = "SET_NULL"; i.relationships[0].orphan_valid = false; }]) { const i = basePostgresInput(); mutate(i); expect(collectPostgresInputErrors(i).length).toBeGreaterThan(0); } });
  it("T25-T34 tenancy is input-driven and time/money/status/JSONB/array/secrets are safe", () => { const tenant = synthesizePostgresDataModelingDecision(FX_POS_002); expect(tenant.schema_model.tables.every((t) => t.rls_required)).toBe(true); expect(synthesizePostgresDataModelingDecision(FX_POS_001).schema_model.tables.every((t) => !t.rls_required)).toBe(true); const domain = synthesizePostgresDataModelingDecision(FX_POS_003).schema_model.tables.flatMap((t) => t.columns); expect(domain.find((c) => c.id === "entry.created_at")!.postgres_type).toBe("timestamptz"); expect(domain.find((c) => c.id === "entry.amount")!.postgres_type).toMatch(/^numeric/); for (const semantic_type of ["JSON_DOCUMENT", "ATOMIC_LIST"] as const) { const i = basePostgresInput(); i.entities[0].fields[0].semantic_type = semantic_type; expect(collectPostgresInputErrors(i).length).toBeGreaterThan(0); } const secret = basePostgresInput(); secret.entities[0].fields[0].sensitivity = "SECRET"; expect(collectPostgresInputErrors(secret).join(" ")).toContain("S13L"); });
});

describe("indexes, queries, transactions and migrations T35-T68", () => {
  it("T35-T49 index is query-derived, ordered and query checks are honest", () => { const d = synthesizePostgresDataModelingDecision(FX_POS_001); const index = d.index_plan.indexes[0]; expect(index.key_column_refs).toEqual(["entry.account_id", "entry.created_at"]); expect(index.covers_query_refs).toEqual(["entries_by_account"]); expect(index.concurrently_planned).toBe(true); expect(d.query_check_plan.checks[0]).toMatchObject({ status: "RUNTIME_EVIDENCE_REQUIRED", blockers: [] }); const unbounded = basePostgresInput(); unbounded.query_patterns[0].pagination = "NONE"; expect(collectPostgresInputErrors(unbounded).join(" ")).toContain("unbounded"); const n1 = basePostgresInput(); n1.query_patterns[0].n_plus_one_shape = true; expect(collectPostgresInputErrors(n1).join(" ")).toContain("N+1"); expect(JSON.stringify(d)).not.toMatch(/actual_explain_plan|actual_index_usage/i); });
  it("T50-T56 atomicity maps once to READ_COMMITTED; unsafe stronger/advisory claims cannot self-certify", () => { const d = synthesizePostgresDataModelingDecision(FX_POS_005); expect(d.transaction_plan.transactions).toHaveLength(1); expect(d.transaction_plan.transactions[0]).toMatchObject({ isolation: "READ_COMMITTED", lock_mode: "NONE" }); const bad = cloneFixture(d); bad.transaction_plan.transactions[0].isolation = "SERIALIZABLE"; expect(validatePostgresDataModelingDecision(bad, FX_POS_005).valid).toBe(false); });
  it("T57-T64 evolution uses expand/backfill/validate and concurrent index is transaction-forbidden", () => { const d = synthesizePostgresDataModelingDecision(FX_POS_006); expect(d.migration_plan.compatibility_mode).toBe("EXPAND_CONTRACT"); expect(d.migration_plan.steps.map((s) => s.phase)).toEqual(expect.arrayContaining(["EXPAND", "BACKFILL", "VALIDATE"])); expect(d.migration_plan.steps.find((s) => s.id.includes("idx_"))!.transaction_mode).toBe("FORBIDDEN"); expect(d.migration_plan.steps.find((s) => s.phase === "BACKFILL")!.backfill_bounded).toBe(true); const destructive = basePostgresInput(); destructive.migration_compatibility.destructive_change_approved = true; expect(collectPostgresInputErrors(destructive).length).toBeGreaterThan(0); });
  it("T65-T68 no trigger/search_path/extension/version invention", () => { const d = synthesizePostgresDataModelingDecision(FX_POS_001); expect(JSON.stringify(d)).not.toMatch(/trigger|search_path|pgcrypto/); expect(d.schema_model.required_extensions).toEqual([]); const bad = cloneFixture(d); bad.schema_model.required_extensions = ["pgcrypto"]; expect(validatePostgresDataModelingDecision(bad, FX_POS_001).valid).toBe(false); });
});

describe("authority, gate, runtime and fixtures T69-T81", () => {
  it("T69-T72 structured model is authority; DDL preserves order and is deterministic/qualified/credential-free", () => { const decision = synthesizePostgresDataModelingDecision(FX_POS_001); const first = renderPostgresDdlPreview(decision); expect(renderPostgresDdlPreview(decision)).toEqual(first); expect(first.every((sql) => sql.includes("app."))).toBe(true); expect(first.join(" ")).toMatch(/UNIQUE|FOREIGN KEY/); expect(first.join(" ")).toContain("account_id ASC, created_at DESC"); expect(first.join(" ")).not.toMatch(/password|credential|connection|search_path/i); expect(buildPostgresDataModelingArtifact(decision, FX_POS_001).decision).toEqual(decision); const corrupt = cloneFixture(decision); corrupt.schema_model.tables[1].foreign_keys = []; expect(() => buildPostgresDataModelingArtifact(corrupt, FX_POS_001)).toThrow(/unvalidated/); expect(decision.acceptance).toEqual(FX_POS_001.acceptance); });
  it("T73/T74 actual READY candidate missing FK or unsafe migration gates BLOCKED without substitution", () => { for (const corrupt of [(d: PostgresDataModelingDecision) => { d.schema_model.tables[1].foreign_keys = []; }, (d: PostgresDataModelingDecision) => { d.migration_plan.steps[0].destructive = true; }]) { const candidate = synthesizePostgresDataModelingDecision(FX_POS_001); corrupt(candidate); candidate.status = "READY"; candidate.blockers = []; const gated = gatePostgresDataModeling(FX_POS_001, candidate); expect(gated.decision.status).toBe("BLOCKED"); expect(gated.decision.schema_model).toEqual(candidate.schema_model); } });
  it("T75-T79 real S12 lazy-load then S10/S09 runtime succeeds and provider is truth-blind", async () => { const out = await run(FX_POS_001, true); expect(out.skillLoaded).toBe(true); expect(out.run.outcome).toBe("SUCCESS"); expect(out.decisionValidation.valid).toBe(true); expect((referenceSkillCatalogEntries.find((e) => e.descriptor.id === POSTGRES_DATA_MODELING_SKILL_ID)!.descriptor as unknown as Record<string, unknown>).rules).toBeUndefined(); expect(DeterministicPostgresModelProvider.PROVIDER_LABEL).toMatch(/deterministic\/reference/); const source = readFileSync("tests/postgres-data-modeling/fixtures.ts", "utf8"); expect(source).not.toMatch(/fixtureTruth|withSkill\s*[=:]|SKILL_ID.*(?:if|switch)|fixture[_-]?id.*(?:if|switch)/i); expect(readFileSync("tests/postgres-data-modeling/fixtureTruth.ts", "utf8")).not.toContain("synthesizePostgresDataModelingDecision"); });
  it.each(ALL_POSITIVE_INPUTS.map((input, index) => [`T80 FX-POS-${String(index + 1).padStart(3, "0")}`, input] as const))("%s is READY", (_name, input) => expect(validatePostgresDataModelingDecision(synthesizePostgresDataModelingDecision(input), input).valid).toBe(true));
  it.each(ALL_NEGATIVE_FIXTURES)("T81 $id fails deterministically", ({ input, decision }) => expect(validatePostgresDataModelingDecision(decision, input).valid).toBe(false));
});

describe("OI-A and boundary closure T82-T98", () => {
  it("T82-T91 comparison uses frozen independent truth and passes OI-A", async () => {
    const baseline = [], skill = [];
    for (const input of ALL_POSITIVE_INPUTS) {
      const b = await run(input, false), s = await run(input, true);
      baseline.push({ input, candidateDecision: b.candidate });
      skill.push({ input, candidateDecision: s.candidate });
    }
    const comparison = comparePostgresDataModelingRuns(baseline, skill, FROZEN_POSTGRES_FIXTURE_TRUTH);
    expect(POSTGRES_COMPARISON_ASSERTIONS.filter((a) => a.category === "REGRESSION_CROSS_CUTTING")).toHaveLength(1);
    expect(comparison.baseline).toMatchObject({ correct: 56, total_assertions: 186 });
    expect(comparison.skill).toMatchObject({ correct: 186, total_assertions: 186 });
    expect(comparison.dimension_specific_total_delta).toBe(130);
    expect(comparison.improved_dimensions).toEqual(["SD-001", "SD-002", "SD-003", "SD-004", "SD-005", "SD-006", "SD-007", "SD-008", "SD-009", "SD-010"]);
    expect(Object.fromEntries(Object.entries(comparison.dimension_improvements).map(([id, value]) => [id, value.single_assertion_contributions]))).toEqual({
      "SD-001": { "SD1-A": 6, "SD1-B": 0, "SD1-C": 6 },
      "SD-002": { "SD2-A": 6, "SD2-B": 6, "SD2-C": 6 },
      "SD-003": { "SD3-A": 6, "SD3-B": 6, "SD3-C": 0 },
      "SD-004": { "SD4-A": 6, "SD4-B": 6, "SD4-C": 6 },
      "SD-005": { "SD5-A": 6, "SD5-B": 6, "SD5-C": 6 },
      "SD-006": { "SD6-A": 1, "SD6-B": 1, "SD6-C": 1 },
      "SD-007": { "SD7-A": 0, "SD7-B": 6, "SD7-C": 6 },
      "SD-008": { "SD8-A": 1, "SD8-B": 6, "SD8-C": 6 },
      "SD-009": { "SD9-A": 0, "SD9-B": 6, "SD9-C": 6 },
      "SD-010": { "SD10-A": 6, "SD10-B": 6, "SD10-C": 0 },
    });
    for (const dimension of comparison.improved_dimensions) {
      const evidence = comparison.dimension_improvements[dimension];
      expect(evidence.scored_assertions).toBe(3);
      expect(Object.keys(evidence.single_assertion_contributions)).toHaveLength(3);
      expect(evidence.max_single_assertion_share).toBeLessThanOrEqual(0.5);
    }
    expect(comparison.skill.hard_invariant_correct).toBe(comparison.skill.hard_invariant_total);
    expect(comparison.skill).toMatchObject({ missing_key_fk_constraint_recommendations: 0, unsafe_destructive_migration_recommendations: 0, unbounded_or_n_plus_one_critical_query_recommendations: 0, provider_credential_live_runtime_bindings: 0, future_stage_pull_forward_violations: 0 });
    expect(comparison.hard_invariant_regressed).toBe(false);
    expect(comparison.meets_threshold).toBe(true);
  });
  it("T92 one synthesizer serves both arms", () => { const files = readdirSync(sourceDir); expect(files.filter((name) => /synthesize/i.test(name))).toEqual([]); expect(files.some((name) => /baseline|bad/i.test(name))).toBe(false); });
  it("T93-T96 no DB/runtime/future-stage implementation or S07 mutation", () => { const pkg = JSON.parse(readFileSync("package.json", "utf8")); expect(pkg.dependencies).toEqual({ "better-sqlite3": "^13.0.3" }); const source = readdirSync(sourceDir).filter((name) => name.endsWith(".ts")).map((name) => readFileSync(join(sourceDir, name), "utf8")).join("\n"); expect(source).not.toMatch(/from ["'](?:pg|postgres|typeorm|prisma)|createConnection|new Pool|\.query\(/); expect(readdirSync("src/intelligence").some((name) => /guardrails-security|async-reliability|deployment|capability-registry/i.test(name))).toBe(false); expect(referenceSkillCatalogEntries.length).toBeGreaterThanOrEqual(13); expect(referenceSkillCatalogEntries[12]!.descriptor.id).toBe(POSTGRES_DATA_MODELING_SKILL_ID); });
});
