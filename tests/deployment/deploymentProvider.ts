import type { ModelProvider, ModelDecisionRequest, ModelDecisionResult } from "../../src/core/agent/index.js";
import type { DeploymentDecision, DeploymentInput, EvidenceKind } from "../../src/intelligence/deployment/types.js";
// Independent visible-packet model; imports no planner, validator, scorer, fixture or Skill identity.
export function concepts(prose: string) {
  const s = prose.toLowerCase();
  return { identity: /project\/revision/.test(s), entrypoint: /deployable entrypoint/.test(s), build: /build\/start/.test(s), container: /docker-first/.test(s), environment: /variable names/.test(s), health: /health\/readiness/.test(s), persistence: /persistence/.test(s), provider: /provider_neutral/.test(s), evidence: /evidence.*ready.*partial.*blocked/.test(s), projection: /deterministic derivative/.test(s) };
}
export function synthesize(input: DeploymentInput, prose: string): DeploymentDecision {
  const method = concepts(prose), i = input;
  const blocked: DeploymentDecision = { status: "BLOCKED", reason_code: "BLOCKED_NO_DEPLOYABLE_ENTRYPOINT", deployment_identity: null, entrypoint_assessment: null, build_plan: null, container_plan: null, environment_plan: [], health_plan: null, persistence_plan: null, provider_mapping: "PROVIDER_NEUTRAL", deployment_verification: { accepted_evidence_ids: [], missing_kinds: [] }, blockers: ["BLOCKED_NO_DEPLOYABLE_ENTRYPOINT"], limitations: ["No deployment execution or independent verification is performed."], residual_unknowns: [], evidence_refs: [] };
  if (method.entrypoint && ["LIBRARY_ONLY", "NONE"].includes(i.runtime_surface.kind)) return blocked;
  const required: EvidenceKind[] = ["BUILD_PASS", "IMAGE_BUILD_PASS", "PROCESS_START_PASS", ...(i.policy.require_liveness ? ["LIVENESS_PASS" as const] : []), ...(i.policy.require_readiness ? ["READINESS_PASS" as const] : []), ...(i.policy.require_deployed ? ["DEPLOYED_REVISION_OBSERVED" as const, "DEPLOYED_SMOKE_PASS" as const] : [])];
  const accepted = i.deployment_evidence.filter(e => e.result === "PASS" && e.revision_ref === i.identity.revision_ref && e.evidence_refs.length && e.evidence_refs.every(r => i.repository_facts.some(f => f.fact_id === r && f.kind === "EVIDENCE_SOURCE")));
  const missing = required.filter(k => !accepted.some(e => e.kind === k));
  const partial = missing.length > 0 || !accepted.some(e => e.kind === "DEPLOYED_REVISION_OBSERVED");
  const image = i.repository_facts.find(f => f.fact_id === i.container_policy.base_runtime_ref)?.value ?? "";
  const h = i.health_contract.transport === "COMMAND" ? i.health_contract.liveness_check : undefined;
  const docker = [`FROM ${image}`, `WORKDIR ${i.container_policy.working_directory}`, "COPY . .", ...(i.build_contract.install_command ? [`RUN ${i.build_contract.install_command}`] : []), `RUN ${i.build_contract.build_command}`, ...(i.runtime_surface.port ? [`EXPOSE ${i.runtime_surface.port}`] : []), ...(h ? [`HEALTHCHECK CMD ${h}`] : []), `CMD ${i.runtime_surface.start_command}`].join("\n") + "\n";
  return { status: partial ? "PARTIAL" : "READY", reason_code: partial ? "DEPLOYMENT_EVIDENCE_INSUFFICIENT" : null,
    deployment_identity: method.identity ? structuredClone(i.identity) : null,
    entrypoint_assessment: method.entrypoint ? { eligible: true, kind: i.runtime_surface.kind, entrypoint_ref: i.runtime_surface.entrypoint_ref } : null,
    build_plan: method.build ? structuredClone(i.build_contract) : null,
    container_plan: method.container ? { strategy: "DOCKER_FIRST", base_image: image, working_directory: i.container_policy.working_directory!, ...(i.build_contract.install_command ? { install_command: i.build_contract.install_command } : {}), build_command: i.build_contract.build_command, artifacts: [...i.build_contract.build_artifact_refs].sort(), start_command: i.runtime_surface.start_command!, ...(i.runtime_surface.port ? { port: i.runtime_surface.port } : {}), non_root: !!i.container_policy.non_root_required, read_only_root: !!i.container_policy.read_only_root_preferred, ...(h ? { healthcheck: h } : {}), dockerfile: method.projection && i.policy.render_dockerfile ? docker : null } : null,
    environment_plan: method.environment ? structuredClone(i.environment_contract).sort((a, b) => a.name.localeCompare(b.name, "en")) : [], health_plan: method.health ? structuredClone(i.health_contract) : null, persistence_plan: method.persistence ? structuredClone(i.persistence_contract) : null,
    provider_mapping: method.provider ? i.provider_authority?.provider ?? "PROVIDER_NEUTRAL" : "PROVIDER_NEUTRAL", deployment_verification: method.evidence ? { accepted_evidence_ids: accepted.map(e => e.evidence_id).sort(), missing_kinds: missing } : { accepted_evidence_ids: [], missing_kinds: [] }, blockers: [], limitations: blocked.limitations, residual_unknowns: missing, evidence_refs: [...new Set(i.repository_facts.map(f => f.fact_id))].sort(),
  };
}
export class DeploymentProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const packet = request.goal.statement.split("DEPLOYMENT_INPUT_JSON:")[1].trimStart();
    const newline = packet.indexOf("\n"), input = JSON.parse(packet.slice(0, newline)) as DeploymentInput, prose = packet.slice(newline + 1);
    return { status: "SUCCESS", decision: { type: "FINISH", rationale: "Derived from visible deployment facts and method prose.", output: { summary: "deployment assessment", data: synthesize(input, prose) as unknown as Record<string, unknown> } } };
  }
}
