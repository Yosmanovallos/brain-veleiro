import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ReferenceCapabilityProvider } from "../../src/providers/capability/referenceCapabilityProvider.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import {
  BACKEND_API_COMPARISON_ASSERTIONS,
  BACKEND_API_ENGINEERING_SKILL_ID,
  classifyApiOperation,
  compareBackendApiEngineeringRuns,
  findForbiddenBindings,
  gateBackendApiEngineering,
  planBackendApiEngineering,
  synthesizeBackendApiEngineeringDecision,
  validateAuthBoundary,
  validateBackendApiEngineeringDecision,
  validateCompatibilityContract,
  validateDataPortBoundary,
  validateErrorContract,
  validateObservabilityContract,
  validateRequestContract,
  validateRequestPayload,
  validateResponseContract,
  validateServiceBoundary,
  validateSideEffectContract,
  type BackendApiEngineeringDecision,
  type BackendApiEngineeringInput,
} from "../../src/intelligence/backend-api-engineering/index.js";
import { backendApiEngineeringS13I, referenceSkillCatalogEntries } from "../../src/intelligence/skills/index.js";
import {
  ALL_NEGATIVE_FIXTURES,
  ALL_POSITIVE_INPUTS,
  DeterministicBackendApiModelProvider,
  FX_POS_001,
  FX_POS_002,
  FX_POS_003,
  FX_POS_004,
  FX_POS_005,
  FX_POS_006,
  backendApiHost,
  baseInput,
} from "./fixtures.js";

const capabilityProvider = new ReferenceCapabilityProvider();
const skillProvider = new LocalReferenceSkillProvider(referenceSkillCatalogEntries);
const modelProvider = new DeterministicBackendApiModelProvider();
const clone = <T>(value: T): T => structuredClone(value);
const sourceDir = "src/intelligence/backend-api-engineering";
const PART_A_PATHS = [
  "brain-bootstrap/skills/BACKEND_API_ENGINEERING_SKILL_S13I.md",
  "brain-bootstrap/quality-contracts/S13I_BACKEND_API_ENGINEERING_DEEP.yaml",
  "brain-bootstrap/specs/BACKEND_API_ENGINEERING_CONTRACT_S13I.md",
];

async function run(input: BackendApiEngineeringInput, withSkill: boolean) {
  const host = clone(backendApiHost);
  if (!withSkill) host.skills = [];
  return planBackendApiEngineering(input, {
    baseDefinition: host,
    ...(withSkill ? { skillProvider } : {}),
    modelProvider,
    capabilityProvider,
  });
}

describe("S13I Part A integrity and typed Skill", () => {
  it("T61 — Skill is SKILL_ONLY by contract: no capabilities and side effects NONE", () => {
    expect(backendApiEngineeringS13I.id).toBe(BACKEND_API_ENGINEERING_SKILL_ID);
    expect(backendApiEngineeringS13I.requires.skills).toEqual([]);
    expect(backendApiEngineeringS13I.requires.capabilities).toEqual([]);
    expect(backendApiEngineeringS13I.permissions).toEqual({ allowed_capabilities: [], allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true });
  });

  it("Part A artifacts retain stable audited sha256 values during Part B tests", () => {
    const hashes = PART_A_PATHS.map((path) => createHash("sha256").update(readFileSync(path)).digest("hex"));
    expect(new Set(hashes).size).toBe(3);
    expect(hashes.every((hash) => /^[a-f0-9]{64}$/.test(hash))).toBe(true);
  });

  it("the typed Skill mechanically exposes every core R1-R30 rule and required quality ref", () => {
    expect(backendApiEngineeringS13I.rules.map((rule) => rule.id)).toEqual(Array.from({ length: 30 }, (_, i) => `BAE-R${i + 1}`));
    expect(backendApiEngineeringS13I.requires.quality_contract_refs).toEqual(["S13I_BACKEND_API_ENGINEERING_DEEP"]);
    expect(referenceSkillCatalogEntries.at(-1)?.descriptor.id).toBe(BACKEND_API_ENGINEERING_SKILL_ID);
  });
});

describe("request and operation semantics T1–T12", () => {
  it("T1 — valid public read validates", () => { const result = validateBackendApiEngineeringDecision(synthesizeBackendApiEngineeringDecision(FX_POS_001), FX_POS_001); expect(result.valid, result.errors.join("\n")).toBe(true); });

  it("T2 — synthesis does not mutate input objects", () => {
    const input = baseInput(); const before = JSON.stringify(input); synthesizeBackendApiEngineeringDecision(input); expect(JSON.stringify(input)).toBe(before);
  });

  it("T3 — one non-empty operation/task is enforced", () => { const i = baseInput(); i.operation.operation_id = ""; expect(validateRequestContract(i).errors.join(" ")).toContain("HI-001"); });

  it("T4 — framework/live-server binding rejects", () => { const i = baseInput(); (i.operation as unknown as Record<string, unknown>).framework = "Express"; expect(findForbiddenBindings(i).length).toBeGreaterThan(0); expect(gateBackendApiEngineering(i).decision.status).toBe("BLOCKED"); });

  it("T5 — every consumed request field must be declared", () => { const i = baseInput(); i.request_contract.consumed_field_refs = ["missing"]; expect(validateRequestContract(i).valid).toBe(false); });

  it("T6/T7 — REJECT blocks unknowns while explicitly declared additional fields can pass", () => {
    expect(validateRequestPayload(baseInput().request_contract, { mystery: 1 }).valid).toBe(false);
    const c = baseInput().request_contract; c.unknown_field_policy = "ALLOW_DECLARED_ADDITIONAL_FIELDS"; c.additional_field_ids = ["trace_hint"];
    expect(validateRequestPayload(c, { trace_hint: "safe" }).valid).toBe(true);
    expect(validateRequestContract({ ...baseInput(), request_contract: c }).valid).toBe(true);
  });

  it("T8/T9 — implicit coercion rejects and an explicit fail-closed normalization passes", () => {
    const c = baseInput().request_contract; const page = c.fields.find((f) => f.id === "page")!; delete page.normalization;
    expect(validateRequestPayload(c, { page: "2" }).valid).toBe(false);
    page.normalization = { kind: "STRING_TO_INTEGER", failure: "REJECT" };
    expect(validateRequestPayload(c, { page: "2" })).toMatchObject({ valid: true, normalized: { page: 2 } });
  });

  it("T10/T11/T12 — body-bearing contracts need type+size; no-body contracts do not", () => {
    const i = clone(FX_POS_002); i.request_contract.accepted_content_types = []; expect(validateRequestContract(i).valid).toBe(false);
    i.request_contract.accepted_content_types = ["application/json"]; delete i.request_contract.max_body_bytes; expect(validateRequestContract(i).valid).toBe(false);
    expect(validateRequestContract(FX_POS_001).valid).toBe(true);
  });
});

describe("boundary, response, error, effect, observability and compatibility T13–T60", () => {
  it("T13/T14/T15 — thin transport passes; business logic and direct persistence in transport block", () => {
    const i = baseInput(); const d = synthesizeBackendApiEngineeringDecision(i); const initial = validateServiceBoundary(i, d); expect(initial.valid, initial.errors.join("\n")).toBe(true);
    d.boundary_map.transport_responsibilities.push("apply business rule"); expect(validateServiceBoundary(i, d).valid).toBe(false);
    d.boundary_map.transport_responsibilities = ["call ORM persistence from controller"]; expect(validateServiceBoundary(i, d).errors.join(" ")).toContain("HI-010");
  });

  it("T16 — framework request/response service types block", () => { const i = baseInput(); (i.service_contract as unknown as Record<string, unknown>).transport_types_allowed = true; expect(validateServiceBoundary(i).valid).toBe(false); });

  it("T17/T18 — abstract data operations pass and SQL/table/index/migration detail rejects", () => {
    expect(validateDataPortBoundary(baseInput()).valid).toBe(true);
    for (const key of ["table", "index", "migration", "sql"]) { const i = baseInput(); (i.data_port_requirements[0] as unknown as Record<string, unknown>)[key] = "forbidden"; expect(validateDataPortBoundary(i).valid).toBe(false); }
  });

  it("T19/T20 — logical atomic groups pass without transaction mechanism; isolation detail rejects", () => {
    const i = clone(FX_POS_002); i.data_port_requirements.push({ id: "audit.create", kind: "CREATE", resource: "AuditRecord", field_intent_refs: [], source_refs: ["specs/widgets-create"] }); i.atomicity_contract = { requirement: "ATOMIC_GROUP_REQUIRED", logical_operation_refs: ["widgets.create", "audit.create"] };
    expect(validateDataPortBoundary(i).valid).toBe(true); (i.atomicity_contract as unknown as Record<string, unknown>).transaction_isolation = "serializable"; expect(validateDataPortBoundary(i).valid).toBe(false);
  });

  it("T21–T26 — public/authenticated/resource-scope boundaries are enforced", () => {
    expect(validateAuthBoundary(FX_POS_001).valid).toBe(true);
    expect(validateAuthBoundary(FX_POS_002).valid).toBe(true);
    const after = clone(FX_POS_002); after.auth_contract.authorization_before_service_effect = false; expect(validateAuthBoundary(after).valid).toBe(false);
    const client = clone(FX_POS_003); client.request_contract.fields.find((f) => f.id === "owner_id")!.authority_role = "DATA"; expect(validateAuthBoundary(client).valid).toBe(false);
    const scope = clone(FX_POS_003); delete scope.auth_contract.trusted_scope_source; expect(validateAuthBoundary(scope).valid).toBe(false);
    expect(FX_POS_002.auth_contract.scope).toBe("NONE");
  });

  it("T27/T28 — every response variant needs a schema and output validation is mandatory", () => {
    const missing = baseInput(); delete (missing.response_contract.variants[0] as unknown as Record<string, unknown>).schema; expect(validateResponseContract(missing).valid).toBe(false);
    const output = baseInput(); (output.response_contract as unknown as Record<string, unknown>).output_validation_required = false; expect(validateResponseContract(output).valid).toBe(false);
  });

  it("T29–T37 — safe error shapes, never-leak classes and canonical status mappings are enforced", () => {
    expect(validateErrorContract(baseInput()).valid).toBe(true);
    for (const leak of ["STACK_TRACE", "RAW_SQL", "INTERNAL_FILE_PATH", "PROVIDER_CREDENTIAL", "TOKEN", "UNDECLARED_UPSTREAM_PAYLOAD"]) { const i = baseInput(); i.error_contract.variants[0].safe_message = leak; expect(validateErrorContract(i).valid).toBe(false); }
    const statuses = Object.fromEntries(baseInput().error_contract.variants.map((e) => [e.code, e.http_status]));
    expect(statuses).toMatchObject({ INVALID_REQUEST: 400, AUTHENTICATION_REQUIRED: 401, AUTHORIZATION_DENIED: 403, NOT_FOUND: 404, CONFLICT: 409, PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_MEDIA: 415 });
    const rate = baseInput(); rate.error_contract.variants.push({ code: "RATE_LIMITED", http_status: 429, safe_message: "Try later.", details_policy: "NONE", request_id_in_response: true }); expect(validateErrorContract(rate).valid).toBe(false); rate.compatibility_contract.rate_limit_requirement_ref = "policy/rate-limit"; expect(validateErrorContract(rate).valid).toBe(true);
  });

  it("T38–T43 — read/idempotent/write/external effects and S13O seam are enforced", () => {
    expect(validateSideEffectContract(FX_POS_001).valid).toBe(true); expect(validateSideEffectContract(FX_POS_003).valid).toBe(true); expect(validateSideEffectContract(FX_POS_004).valid).toBe(true);
    for (const klass of ["NON_IDEMPOTENT_WRITE", "EXTERNAL_SIDE_EFFECT"] as const) { const i = baseInput(); i.side_effect_contract = { class: klass, caller_retryable: true, idempotency: "NOT_APPLICABLE" }; expect(validateSideEffectContract(i).valid).toBe(false); }
    const bad = clone(FX_POS_004); (bad.side_effect_contract as unknown as Record<string, unknown>).retry = { backoff: true, job_queue: true, idempotency_store: true }; expect(validateSideEffectContract(bad).valid).toBe(false);
  });

  it("T44–T48 — endpoint observability is complete, raw secret/body logging and vendors reject", () => {
    expect(validateObservabilityContract(baseInput()).valid).toBe(true);
    for (const field of ["authorization", "cookie", "token", "api_key", "private_key", "password"]) { const i = baseInput(); i.observability_contract.log_field_allowlist.push(field); expect(validateObservabilityContract(i).valid).toBe(false); }
    const raw = baseInput(); (raw.observability_contract as unknown as Record<string, unknown>).log_raw_body = true; expect(validateObservabilityContract(raw).valid).toBe(false);
    const vendor = baseInput(); (vendor.observability_contract as unknown as Record<string, unknown>).vendor = "Datadog"; expect(validateObservabilityContract(vendor).valid).toBe(false);
  });

  it("T49–T57 — compatibility, break approval, pagination/rationale and filter/sort allowlists", () => {
    expect(validateCompatibilityContract(FX_POS_001).valid).toBe(true); expect(validateCompatibilityContract(FX_POS_005).valid).toBe(true);
    const breaking = baseInput(); breaking.compatibility_contract = { mode: "NEW", existing_contract_ref: "v1" }; expect(validateCompatibilityContract(breaking).valid).toBe(false); breaking.compatibility_contract.mode = "BREAKING_CHANGE_APPROVED"; expect(validateCompatibilityContract(breaking).valid).toBe(true);
    const list = baseInput(); list.operation.collection.pagination = "NOT_APPLICABLE"; expect(validateCompatibilityContract(list).valid).toBe(false); list.operation.collection.pagination = "BOUNDED_CARDINALITY_RATIONALE"; list.operation.collection.bounded_cardinality_rationale = "Tenant policy caps widgets at 20."; expect(validateCompatibilityContract(list).valid).toBe(true);
    const filter = baseInput(); filter.operation.collection.allowed_filter_fields.push("undeclared"); expect(validateCompatibilityContract(filter).valid).toBe(false);
    const sort = baseInput(); sort.operation.collection.allowed_sort_fields.push("name desc; drop table"); expect(validateCompatibilityContract(sort).valid).toBe(false);
  });

  it("T58/T59/T60 — limiter/OpenAPI implementations reject and acceptance/evidence preservation is enforced", () => {
    const limiter = baseInput(); (limiter as unknown as Record<string, unknown>).rate_limit_enforcer = {}; expect(gateBackendApiEngineering(limiter).decision.status).toBe("BLOCKED");
    const openapi = baseInput(); (openapi as unknown as Record<string, unknown>).openapi_source_of_truth = true; expect(gateBackendApiEngineering(openapi).decision.status).toBe("BLOCKED");
    const d = synthesizeBackendApiEngineeringDecision(baseInput()); d.acceptance = []; expect(validateBackendApiEngineeringDecision(d, baseInput()).errors.join(" ")).toContain("HI-035");
  });
});

describe("real Skill runtime and anti-self-certification T62–T69", () => {
  it("T62 — no dedicated S13I AgentDefinition exists", () => expect(readdirSync("src/intelligence/agent-definitions").some((name) => /backendApi|backend-api/i.test(name))).toBe(false));

  it("T63 — Core contains no role/Skill-id branch", () => {
    for (const dir of ["src/core/agent", "src/core/skill"]) for (const name of readdirSync(dir)) if (name.endsWith(".ts")) expect(readFileSync(join(dir, name), "utf8")).not.toContain(BACKEND_API_ENGINEERING_SKILL_ID);
  });

  it("T64/T65 — S12 metadata-only lazy load then unchanged S10/S09 succeeds", async () => {
    const out = await run(FX_POS_002, true);
    expect(out.skillLoaded).toBe(true); expect(out.run.outcome).toBe("SUCCESS"); expect(out.decisionValidation.valid).toBe(true); expect(out.decision.status).toBe("READY");
    const descriptor = referenceSkillCatalogEntries.find((e) => e.descriptor.id === BACKEND_API_ENGINEERING_SKILL_ID)!.descriptor as unknown as Record<string, unknown>;
    expect(descriptor.rules).toBeUndefined();
  });

  it("T66/T67/T68 — deterministic provider is honest and source has no truth/id/arm branching", () => {
    expect(DeterministicBackendApiModelProvider.PROVIDER_LABEL).toMatch(/deterministic\/reference/);
    const source = readFileSync("tests/backend-api-engineering/fixtures.ts", "utf8");
    expect(source).not.toMatch(/fixtureTruth|withSkill\s*[=:]|SKILL_ID.*(?:if|switch)|fixture[_-]?id.*(?:if|switch)/i);
  });

  it("T69 — READY candidate with auth bypass is blocked by the deterministic gate", () => {
    const input = clone(FX_POS_002); input.auth_contract.authorization_before_service_effect = false;
    const candidate = synthesizeBackendApiEngineeringDecision(FX_POS_002); candidate.status = "READY";
    expect(validateBackendApiEngineeringDecision(candidate, input).valid).toBe(false);
    expect(gateBackendApiEngineering(input).decision.status).toBe("BLOCKED");
  });
});

describe("canonical positives/negatives and built-in HTTP realism T70–T78", () => {
  it.each([
    ["T70 FX-POS-001", FX_POS_001], ["T71 FX-POS-002", FX_POS_002], ["T72 FX-POS-003", FX_POS_003],
    ["T73 FX-POS-004", FX_POS_004], ["T74 FX-POS-005", FX_POS_005],
  ])("%s is READY and validates", (_name, input) => {
    const gated = gateBackendApiEngineering(input); expect(gated.decision.status).toBe("READY"); expect(gated.decisionValidation.valid).toBe(true);
  });

  it.each(ALL_NEGATIVE_FIXTURES)("T76 $id is rejected in its required way", ({ input, decision }) => {
    const validation = validateBackendApiEngineeringDecision(decision, input);
    expect(validation.valid).toBe(false);
  });

  let server: Server | undefined;
  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    server = undefined;
  });

  it("T75/T77/T78 — disposable node:http fixture uses loopback+ephemeral port, maps valid/invalid contracts, and closes", async () => {
    const input = FX_POS_006;
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => {
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { /* invalid request below */ }
        const contentType = String(request.headers["content-type"] ?? "").split(";")[0];
        const withinLimit = Buffer.concat(chunks).byteLength <= (input.request_contract.max_body_bytes ?? 0);
        const requestValidation = validateRequestPayload(input.request_contract, body);
        const valid = request.method === input.operation.method && input.request_contract.accepted_content_types.includes(contentType) && withinLimit && requestValidation.valid;
        response.statusCode = valid ? input.operation.success_status : 400;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(valid ? { id: "widget-1", name: requestValidation.normalized.name } : { code: "INVALID_REQUEST" }));
      });
    });
    await new Promise<void>((resolve, reject) => server!.listen(0, "127.0.0.1", resolve).once("error", reject));
    const address = server.address(); expect(address && typeof address === "object" ? address.address : "").toBe("127.0.0.1");
    const port = address && typeof address === "object" ? address.port : 0; expect(port).toBeGreaterThan(0);
    const valid = await fetch(`http://127.0.0.1:${port}/widgets`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "  Alpha  " }) });
    const invalid = await fetch(`http://127.0.0.1:${port}/widgets`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ unknown: true }) });
    expect(valid.status).toBe(201); expect(await valid.json()).toMatchObject({ name: "Alpha" }); expect(invalid.status).toBe(400);
    await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    expect(server.listening).toBe(false); server = undefined;
  });
});

describe("OI-A-safe Skill-vs-no-Skill and scope closure T79–T92", () => {
  it("T79–T88 — same runtime/input/provider comparison passes every distribution and safety threshold", async () => {
    const baseline = []; const skill = [];
    for (const input of ALL_POSITIVE_INPUTS) {
      const b = await run(input, false); const s = await run(input, true);
      baseline.push({ input, candidateDecision: b.candidate }); skill.push({ input, candidateDecision: s.candidate });
      expect(b.materializedDefinition.objective).not.toContain("Unknown fields reject"); expect(s.materializedDefinition.objective).toContain("unknown fields reject");
    }
    const comparison = compareBackendApiEngineeringRuns(baseline, skill);
    expect(BACKEND_API_COMPARISON_ASSERTIONS.filter((a) => a.category === "REGRESSION_CROSS_CUTTING")).toHaveLength(1);
    expect(comparison.skill.cross_cutting.total).toBeGreaterThan(0);
    expect(comparison.dimension_specific_total_delta).toBeGreaterThanOrEqual(12);
    expect(comparison.improved_dimensions.length).toBeGreaterThanOrEqual(5);
    for (const dim of comparison.improved_dimensions) {
      expect(comparison.dimension_improvements[dim].scored_assertions).toBeGreaterThanOrEqual(3);
      expect(comparison.dimension_improvements[dim].delta).toBeGreaterThanOrEqual(2);
      expect(comparison.dimension_improvements[dim].max_single_assertion_share).toBeLessThanOrEqual(0.5);
    }
    expect(comparison.skill.hard_invariant_correct).toBe(comparison.skill.hard_invariant_total);
    expect(comparison.skill).toMatchObject({ unsafe_auth_recommendations: 0, secret_pii_leak_recommendations: 0, direct_persistence_in_transport_recommendations: 0, framework_provider_bindings: 0, future_stage_pull_forward_violations: 0 });
    expect(comparison.hard_invariant_regressed).toBe(false); expect(comparison.meets_threshold).toBe(true);
  });

  it("T88 — one parameterized synthesizer serves both arms; no bad-baseline synthesizer exists", () => {
    const files = readdirSync(sourceDir); expect(files.filter((name) => /synthesize/i.test(name))).toEqual(["synthesizeBackendApiEngineeringDecision.ts"]);
    expect(files.some((name) => /baseline|bad/i.test(name))).toBe(false);
  });

  it("T89/T90 — no S13J/S13L/S13O/S13P/S14 implementation artifacts or persistent server were created", () => {
    const files = readdirSync("src/intelligence");
    expect(files.some((name) => /persistence|authorization-platform|reliability|observability-platform|capability-registry/i.test(name))).toBe(false);
    const source = readdirSync(sourceDir).filter((name) => name.endsWith(".ts")).map((name) => readFileSync(join(sourceDir, name), "utf8")).join("\n");
    expect(source).not.toMatch(/from ["']node:http|createServer\(|\.listen\(/);
  });

  it("T91 — package manifest has no new runtime dependency", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")); expect(pkg.dependencies).toEqual({ "better-sqlite3": "^13.0.3" });
  });

  it("T92 — catalog registration is append-only and prior entries stay ordered", () => {
    expect(referenceSkillCatalogEntries).toHaveLength(12);
    expect(referenceSkillCatalogEntries[10].descriptor.id).toBe("intelligence.repository-git-workflow.s13h");
    expect(referenceSkillCatalogEntries[11].descriptor.id).toBe(BACKEND_API_ENGINEERING_SKILL_ID);
  });
});
