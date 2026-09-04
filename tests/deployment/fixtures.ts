import type { DeploymentInput, DeploymentAudit, RepositoryFact, EvidenceKind } from "../../src/intelligence/deployment/types.js";
export const audit = (): DeploymentAudit => ({ candidate_gated: true, provider_visible_keys: ["repository_facts", "runtime_surface", "method_prose"], hidden_io: false, changed_protected_paths: [], self_awards: false, provider_adapter: false, future_stages: [] });
export function addFact(i: DeploymentInput, kind: string, value: string, id = kind.toLowerCase()): RepositoryFact {
  const f: RepositoryFact = { fact_id: id, kind, value, source_ref: "repo:manifest", revision_ref: i.identity.revision_ref, confidence: "VERIFIED" }; i.repository_facts.push(f); return f;
}
export function baseInput(): DeploymentInput {
  const i: DeploymentInput = {
    identity: { project_ref: "project:sample", revision_ref: "revision:1", deployment_scope_ref: "scope:test" }, repository_facts: [],
    runtime_surface: { kind: "HTTP_SERVICE", entrypoint_ref: "entrypoint", start_command_ref: "start_command", start_command: "node dist/server.js", port_ref: "port", port: 8080, health_transport: "HTTP" },
    build_contract: { build_command: "npm run build", build_artifact_refs: ["artifact"], runtime_name: "node", runtime_version: "24.19.0", package_manager: "npm", install_command: "npm ci" },
    container_policy: { strategy: "DOCKER_FIRST", base_runtime_ref: "base_image", working_directory: "/app" },
    environment_contract: [ { name: "MODE", requirement: "OPTIONAL", classification: "PUBLIC_CONFIG", source_ref: "env-mode" }, { name: "DATABASE_PASSWORD", requirement: "REQUIRED", classification: "SENSITIVE_REFERENCE", source_ref: "env-password", secret_ref: "opaque:db-ref", presence: "PRESENT" } ],
    health_contract: { transport: "HTTP", liveness_check: "route:live", readiness_check: "route:ready", source_ref: "health_transport" }, persistence_contract: { mode: "NONE" },
    deployment_evidence: [], policy: { require_liveness: true, require_readiness: true, require_deployed: true, render_dockerfile: true },
  };
  for (const [k, v, ref] of [ ["PROJECT", i.identity.project_ref], ["DEPLOYMENT_SCOPE", i.identity.deployment_scope_ref], ["RUNTIME_KIND", "HTTP_SERVICE"], ["ENTRYPOINT", "dist/server.js", "entrypoint"], ["START_COMMAND", "node dist/server.js"], ["PORT", "8080"], ["BUILD_COMMAND", "npm run build"], ["BUILD_ARTIFACT", "dist/server.js", "artifact"], ["RUNTIME_NAME", "node"], ["RUNTIME_VERSION", "24.19.0"], ["PACKAGE_MANAGER", "npm"], ["INSTALL_COMMAND", "npm ci"], ["BASE_IMAGE", "node:24.19.0"], ["WORKDIR", "/app"], ["COPY_CONTEXT", ". ."], ["SHELL_COMMAND_SUPPORT", "DOCKER_DEFAULT_SHELL"], ["ENV_NAME", "MODE", "env-mode"], ["ENV_NAME", "DATABASE_PASSWORD", "env-password"], ["SECRET_REFERENCE", "opaque:db-ref"], ["HEALTH_TRANSPORT", "HTTP"], ["LIVENESS_CHECK", "route:live"], ["READINESS_CHECK", "route:ready"], ["PERSISTENCE_MODE", "NONE"], ["EVIDENCE_SOURCE", "artifact:verification", "proof"] ]) addFact(i, k, v, ref);
  const subjects: Record<EvidenceKind, string> = { BUILD_PASS: i.identity.project_ref, IMAGE_BUILD_PASS: i.identity.deployment_scope_ref, PROCESS_START_PASS: "entrypoint", LIVENESS_PASS: "liveness_check", READINESS_PASS: "readiness_check", DEPLOYED_REVISION_OBSERVED: i.identity.deployment_scope_ref, DEPLOYED_SMOKE_PASS: i.identity.deployment_scope_ref };
  for (const [kind, subject] of Object.entries(subjects)) i.deployment_evidence.push({ evidence_id: kind.toLowerCase(), kind: kind as EvidenceKind, revision_ref: i.identity.revision_ref, subject_ref: subject, result: "PASS", source_ref: "proof", evidence_refs: ["proof"] });
  return i;
}
export function libraryInput() { const i = baseInput(); i.runtime_surface = { kind: "LIBRARY_ONLY", health_transport: "NONE" }; i.health_contract = { transport: "NONE" }; i.environment_contract = []; i.policy.require_liveness = i.policy.require_readiness = false; i.repository_facts = i.repository_facts.filter(f => !["PORT", "START_COMMAND", "ENTRYPOINT", "ENV_NAME", "SECRET_REFERENCE", "HEALTH_TRANSPORT", "LIVENESS_CHECK", "READINESS_CHECK"].includes(f.kind)); i.repository_facts.find(f => f.kind === "RUNTIME_KIND")!.value = "LIBRARY_ONLY"; return i; }
export function workerInput() { const i = baseInput(); i.runtime_surface.kind = "WORKER"; i.runtime_surface.health_transport = "COMMAND"; delete i.runtime_surface.port; delete i.runtime_surface.port_ref; i.health_contract.transport = "COMMAND"; i.health_contract.liveness_check = "node checks/live.js"; i.health_contract.readiness_check = "node checks/ready.js"; for (const f of i.repository_facts) { if (f.kind === "RUNTIME_KIND") f.value = "WORKER"; if (f.kind === "HEALTH_TRANSPORT") f.value = "COMMAND"; if (f.kind === "LIVENESS_CHECK") f.value = i.health_contract.liveness_check; if (f.kind === "READINESS_CHECK") f.value = i.health_contract.readiness_check; } for (const e of i.deployment_evidence) { if (e.kind === "LIVENESS_PASS") e.subject_ref = "liveness_check"; if (e.kind === "READINESS_PASS") e.subject_ref = "readiness_check"; } return i; }
export function positives(): { id: string; input: DeploymentInput; status: string }[] {
  const inputs = [libraryInput(), baseInput(), workerInput(), baseInput(), baseInput(), baseInput(), baseInput(), baseInput(), baseInput(), workerInput()];
  inputs[4].persistence_contract.mode = "EPHEMERAL"; inputs[4].repository_facts.find(f => f.kind === "PERSISTENCE_MODE")!.value = "EPHEMERAL";
  inputs[5].provider_authority = { provider: "approved-platform", decision_ref: "provider-decision" }; addFact(inputs[5], "PROVIDER_DECISION", "approved-platform", "provider-decision");
  inputs[6].deployment_evidence = inputs[6].deployment_evidence.filter(e => !e.kind.startsWith("DEPLOYED"));
  inputs[8].repository_facts.reverse(); inputs[8].deployment_evidence.reverse();
  return inputs.map((input, n) => ({ id: `FX-POS-${String(n + 1).padStart(3, "0")}`, input, status: n === 0 ? "BLOCKED" : n === 6 ? "PARTIAL" : "READY" }));
}
