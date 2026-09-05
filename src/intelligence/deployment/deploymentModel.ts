import { canonical, LIMITS, safeRef, sensitiveMaterial } from "./constants.js";
import type { ContainerPlan, DeploymentDecision, DeploymentEvidence, DeploymentInput, EvidenceKind, RepositoryFact } from "./types.js";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const string = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= LIMITS.max_text_chars_per_field && !/[\r\n\0]/.test(v);
const keys = (v: Record<string, unknown>, allowed: string[]) => Object.keys(v).every(k => allowed.includes(k));
const enumValue = (v: unknown, choices: string[]) => typeof v === "string" && choices.includes(v);
const refs = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && v.every(safeRef) && new Set(v).size === v.length;
const optional = (v: Record<string, unknown>, names: string[], check = safeRef) => names.every(k => v[k] === undefined || check(v[k]));
export const revisionAllowed = (input: DeploymentInput, revision: string): boolean => revision === input.identity.revision_ref || (!!input.identity.accepted_ancestry_or_range_ref && !!input.identity.baseline_revision_ref && revision === input.identity.baseline_revision_ref && input.repository_facts.some(f => f.fact_id === input.identity.accepted_ancestry_or_range_ref && f.kind === "ACCEPTED_REVISION" && f.value === revision && f.revision_ref === input.identity.revision_ref && f.confidence !== "REPORTED"));
export function fact(input: DeploymentInput, kind: string, value?: string, ref?: string): RepositoryFact | undefined {
  return input.repository_facts.find(f => f.kind === kind && (value === undefined || f.value === value) && (ref === undefined || f.fact_id === ref) && f.confidence !== "REPORTED" && revisionAllowed(input, f.revision_ref));
}
const kinds = ["BUILD_PASS", "IMAGE_BUILD_PASS", "PROCESS_START_PASS", "LIVENESS_PASS", "READINESS_PASS", "DEPLOYED_REVISION_OBSERVED", "DEPLOYED_SMOKE_PASS"];
const transports = ["HTTP", "COMMAND", "PROCESS", "NONE"];
export function validateDeploymentInput(raw: unknown): string[] {
  if (sensitiveMaterial(raw)) return ["SECRET_MATERIAL_PRESENT"];
  if (!object(raw)) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!keys(raw, ["identity", "repository_facts", "runtime_surface", "build_contract", "container_policy", "environment_contract", "health_contract", "persistence_contract", "deployment_evidence", "policy", "provider_authority", "evidence_refs"])) return ["INVALID_DEPLOYMENT_INPUT"];
  const { identity: i, repository_facts: f, runtime_surface: r, build_contract: b, container_policy: c, environment_contract: e, health_contract: h, persistence_contract: p, deployment_evidence: d, policy: y, provider_authority: a } = raw;
  if (!object(i) || !keys(i, ["project_ref", "revision_ref", "deployment_scope_ref", "baseline_revision_ref", "accepted_ancestry_or_range_ref"]) || ![i.project_ref, i.revision_ref, i.deployment_scope_ref].every(safeRef) || !optional(i, ["baseline_revision_ref", "accepted_ancestry_or_range_ref"])) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!Array.isArray(f) || f.length > LIMITS.max_repository_facts || !f.every(x => object(x) && keys(x, ["fact_id", "kind", "value", "source_ref", "revision_ref", "confidence"]) && [x.fact_id, x.kind, x.source_ref, x.revision_ref].every(safeRef) && string(x.value) && enumValue(x.confidence, ["VERIFIED", "ACCEPTED", "REPORTED"])) || new Set(f.map(x => x.fact_id)).size !== f.length) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!object(r) || !keys(r, ["kind", "entrypoint_ref", "start_command_ref", "start_command", "port_ref", "port", "health_transport"]) || !enumValue(r.kind, ["LIBRARY_ONLY", "HTTP_SERVICE", "WORKER", "CLI_PROCESS", "OTHER_EXECUTABLE", "NONE"]) || !enumValue(r.health_transport, transports) || !optional(r, ["entrypoint_ref", "start_command_ref", "port_ref"]) || !optional(r, ["start_command"], string) || r.port !== undefined && (!Number.isInteger(r.port) || Number(r.port) < 1 || Number(r.port) > 65535)) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!object(b) || !keys(b, ["build_command", "build_artifact_refs", "runtime_name", "runtime_version", "package_manager", "install_command"]) || ![b.build_command, b.runtime_name, b.runtime_version].every(x => typeof x === "string" && x.length <= 2000 && !/[\r\n\0]/.test(x)) || !refs(b.build_artifact_refs, 32) || !optional(b, ["package_manager", "install_command"], string)) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!object(c) || !keys(c, ["strategy", "base_runtime_ref", "non_root_required", "read_only_root_preferred", "working_directory"]) || c.strategy !== "DOCKER_FIRST" || !optional(c, ["base_runtime_ref"]) || !optional(c, ["working_directory"], string) || [c.non_root_required, c.read_only_root_preferred].some(x => x !== undefined && typeof x !== "boolean")) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!Array.isArray(e) || e.length > 64 || !e.every(x => object(x) && keys(x, ["name", "requirement", "classification", "source_ref", "secret_ref", "presence"]) && typeof x.name === "string" && /^[A-Z_][A-Z0-9_]*$/.test(x.name) && safeRef(x.source_ref) && enumValue(x.requirement, ["REQUIRED", "OPTIONAL"]) && enumValue(x.classification, ["PUBLIC_CONFIG", "SENSITIVE_REFERENCE"]) && optional(x, ["secret_ref"]) && (x.presence === undefined || enumValue(x.presence, ["PRESENT", "ABSENT", "UNKNOWN"]))) || new Set(e.map(x => x.name)).size !== e.length) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!object(h) || !keys(h, ["transport", "liveness_check", "readiness_check", "source_ref"]) || !enumValue(h.transport, transports) || !optional(h, ["source_ref"]) || !optional(h, ["liveness_check", "readiness_check"], string)) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!object(p) || !keys(p, ["mode", "writable_path_ref", "volume_decision_ref", "external_service_ref", "replica_count", "shared_state_decision_ref"]) || !enumValue(p.mode, ["NONE", "EPHEMERAL", "PERSISTENT_LOCAL", "EXTERNAL_SERVICE", "UNKNOWN"]) || !optional(p, ["writable_path_ref", "volume_decision_ref", "external_service_ref", "shared_state_decision_ref"]) || p.replica_count !== undefined && (!Number.isInteger(p.replica_count) || Number(p.replica_count) < 1)) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!Array.isArray(d) || d.length > 256 || !d.every(x => object(x) && keys(x, ["evidence_id", "kind", "revision_ref", "subject_ref", "result", "source_ref", "evidence_refs"]) && [x.evidence_id, x.revision_ref, x.subject_ref, x.source_ref].every(safeRef) && enumValue(x.kind, kinds) && enumValue(x.result, ["PASS", "FAIL", "UNKNOWN"]) && refs(x.evidence_refs, 8)) || new Set(d.map(x => x.evidence_id)).size !== d.length || d.reduce((sum, x) => sum + x.evidence_refs.length, 0) > 512) return ["INVALID_DEPLOYMENT_INPUT"];
  if (!object(y) || !keys(y, ["require_liveness", "require_readiness", "require_deployed", "render_dockerfile"]) || [y.require_liveness, y.require_readiness, y.require_deployed, y.render_dockerfile].some(x => typeof x !== "boolean")) return ["INVALID_DEPLOYMENT_INPUT"];
  if (a !== undefined && (!object(a) || !keys(a, ["provider", "decision_ref"]) || !safeRef(a.provider) || !safeRef(a.decision_ref))) return ["INVALID_DEPLOYMENT_INPUT"];
  if (raw.evidence_refs !== undefined && !refs(raw.evidence_refs, 512)) return ["INVALID_DEPLOYMENT_INPUT"];
  return [];
}
export function blockedDecision(codes: string[]): DeploymentDecision {
  return { status: "BLOCKED", reason_code: codes[0], deployment_identity: null, entrypoint_assessment: null, build_plan: null, container_plan: null, environment_plan: [], health_plan: null, persistence_plan: null, provider_mapping: "PROVIDER_NEUTRAL", provider_authority_ref: null, deployment_verification: { accepted_evidence_ids: [], missing_kinds: [] }, blockers: [...new Set(codes)].sort(), limitations: ["No deployment execution or independent verification is performed."], residual_unknowns: [], evidence_refs: [] };
}
export function assessEntrypoint(input: DeploymentInput): string[] {
  const r = input.runtime_surface;
  if (["LIBRARY_ONLY", "NONE"].includes(r.kind)) return ["BLOCKED_NO_DEPLOYABLE_ENTRYPOINT"];
  if (!r.entrypoint_ref || !fact(input, "ENTRYPOINT", undefined, r.entrypoint_ref) || !fact(input, "RUNTIME_KIND", r.kind)) return ["BLOCKED_NO_DEPLOYABLE_ENTRYPOINT"];
  if (!r.start_command_ref || !r.start_command || !fact(input, "START_COMMAND", r.start_command, r.start_command_ref)) return ["START_COMMAND_UNAVAILABLE"];
  return [];
}
export function buildContainerPlan(input: DeploymentInput): ContainerPlan | null {
  if (assessEntrypoint(input).length) return null;
  const b = input.build_contract, c = input.container_policy, r = input.runtime_surface;
  const image = c.base_runtime_ref && fact(input, "BASE_IMAGE", undefined, c.base_runtime_ref);
  if (!image || !c.working_directory || !fact(input, "WORKDIR", c.working_directory)) return null;
  const plan: ContainerPlan = { strategy: "DOCKER_FIRST", base_image: image.value, working_directory: c.working_directory, ...(b.install_command ? { install_command: b.install_command } : {}), build_command: b.build_command, artifacts: [...b.build_artifact_refs].sort(), start_command: r.start_command!, ...(r.port ? { port: r.port } : {}), non_root: !!c.non_root_required, read_only_root: !!c.read_only_root_preferred, ...(input.health_contract.transport === "COMMAND" && input.health_contract.liveness_check ? { healthcheck: input.health_contract.liveness_check } : {}), dockerfile: null };
  // Security requirements are intent, not invented image user identities.
  if (input.policy.render_dockerfile && !plan.non_root && fact(input, "COPY_CONTEXT", ". .") && fact(input, "SHELL_COMMAND_SUPPORT", "DOCKER_DEFAULT_SHELL")) plan.dockerfile = renderDockerfile(plan);
  return plan;
}
export function renderDockerfile(p: ContainerPlan): string {
  const lines = [`FROM ${p.base_image}`, `WORKDIR ${p.working_directory}`, "COPY . .", ...(p.install_command ? [`RUN ${p.install_command}`] : []), `RUN ${p.build_command}`, ...(p.port ? [`EXPOSE ${p.port}`] : []), ...(p.healthcheck ? [`HEALTHCHECK CMD ${p.healthcheck}`] : []), `CMD ${p.start_command}`];
  return lines.join("\n") + "\n";
}
export function evidenceAccepted(input: DeploymentInput, e: DeploymentEvidence): boolean {
  const subjects: Record<EvidenceKind, string | undefined> = { BUILD_PASS: input.identity.project_ref, IMAGE_BUILD_PASS: input.identity.deployment_scope_ref, PROCESS_START_PASS: input.runtime_surface.entrypoint_ref, LIVENESS_PASS: fact(input, "LIVENESS_CHECK", input.health_contract.liveness_check)?.fact_id, READINESS_PASS: fact(input, "READINESS_CHECK", input.health_contract.readiness_check)?.fact_id, DEPLOYED_REVISION_OBSERVED: input.identity.deployment_scope_ref, DEPLOYED_SMOKE_PASS: input.identity.deployment_scope_ref };
  return e.result === "PASS" && revisionAllowed(input, e.revision_ref) && e.subject_ref === subjects[e.kind] && e.evidence_refs.length > 0 && e.evidence_refs.every(ref => !!fact(input, "EVIDENCE_SOURCE", undefined, ref)) && !!fact(input, "EVIDENCE_SOURCE", undefined, e.source_ref);
}
export function evaluateDeploymentEvidence(input: DeploymentInput) {
  const accepted = input.deployment_evidence.filter(e => evidenceAccepted(input, e));
  const required: EvidenceKind[] = ["BUILD_PASS", "IMAGE_BUILD_PASS", "PROCESS_START_PASS", ...(input.policy.require_liveness ? ["LIVENESS_PASS" as const] : []), ...(input.policy.require_readiness ? ["READINESS_PASS" as const] : []), ...(input.policy.require_deployed ? ["DEPLOYED_REVISION_OBSERVED" as const, "DEPLOYED_SMOKE_PASS" as const] : [])];
  return { accepted_evidence_ids: accepted.map(e => e.evidence_id).sort(), missing_kinds: required.filter(k => !accepted.some(e => e.kind === k)) };
}
export function deriveDeploymentFacts(input: DeploymentInput): string[] {
  const errors: string[] = []; const add = (yes: unknown, code: string) => { if (yes) errors.push(code); };
  add(!fact(input, "PROJECT", input.identity.project_ref) || !fact(input, "DEPLOYMENT_SCOPE", input.identity.deployment_scope_ref), "REVISION_IDENTITY_CONFLICT");
  add(input.repository_facts.some(f => !revisionAllowed(input, f.revision_ref)) || input.deployment_evidence.some(e => !revisionAllowed(input, e.revision_ref)), "REVISION_IDENTITY_CONFLICT");
  const singletonKinds = ["PROJECT", "DEPLOYMENT_SCOPE", "RUNTIME_KIND", "BUILD_COMMAND", "RUNTIME_NAME", "RUNTIME_VERSION", "START_COMMAND", "PORT", "PERSISTENCE_MODE", "PROVIDER_DECISION", "HEALTH_TRANSPORT"];
  add(singletonKinds.some(k => new Set(input.repository_facts.filter(f => f.kind === k && f.confidence !== "REPORTED").map(f => f.value)).size > 1), "REVISION_IDENTITY_CONFLICT");
  errors.push(...assessEntrypoint(input));
  const b = input.build_contract, r = input.runtime_surface, h = input.health_contract, p = input.persistence_contract;
  add(!fact(input, "BUILD_COMMAND", b.build_command), "BUILD_COMMAND_UNAVAILABLE");
  add(!fact(input, "RUNTIME_NAME", b.runtime_name) || !fact(input, "RUNTIME_VERSION", b.runtime_version) || b.build_artifact_refs.length === 0 || b.build_artifact_refs.some(ref => !fact(input, "BUILD_ARTIFACT", undefined, ref)), "RUNTIME_VERSION_UNRESOLVED");
  add(b.package_manager && !fact(input, "PACKAGE_MANAGER", b.package_manager) || b.install_command && !fact(input, "INSTALL_COMMAND", b.install_command), "BUILD_COMMAND_UNAVAILABLE");
  add(r.port !== undefined && (!r.port_ref || !fact(input, "PORT", String(r.port), r.port_ref) || r.kind !== "HTTP_SERVICE"), "HEALTH_CONTRACT_UNRESOLVED");
  add(input.environment_contract.some(e => !fact(input, "ENV_NAME", e.name, e.source_ref) || e.classification === "SENSITIVE_REFERENCE" && (!e.secret_ref || !fact(input, "SECRET_REFERENCE", e.secret_ref)) || e.classification === "PUBLIC_CONFIG" && e.secret_ref !== undefined || e.requirement === "REQUIRED" && e.presence !== "PRESENT"), "ENV_CONTRACT_UNRESOLVED");
  add(h.transport !== r.health_transport || h.transport === "HTTP" && (r.kind !== "HTTP_SERVICE" || !r.port || !r.port_ref) || h.transport === "NONE" && (!!h.liveness_check || !!h.readiness_check) || h.transport !== "NONE" && (!h.source_ref || !fact(input, "HEALTH_TRANSPORT", h.transport, h.source_ref)), "HEALTH_CONTRACT_UNRESOLVED");
  add(h.liveness_check && !fact(input, "LIVENESS_CHECK", h.liveness_check) || h.readiness_check && !fact(input, "READINESS_CHECK", h.readiness_check) || input.policy.require_liveness && !h.liveness_check || input.policy.require_readiness && !h.readiness_check, "HEALTH_CONTRACT_UNRESOLVED");
  add(!fact(input, "PERSISTENCE_MODE", p.mode) || p.mode === "UNKNOWN" || p.mode === "PERSISTENT_LOCAL" && (!p.writable_path_ref || !fact(input, "WRITABLE_PATH", undefined, p.writable_path_ref) || !p.volume_decision_ref || !fact(input, "VOLUME_DECISION", p.writable_path_ref, p.volume_decision_ref)) || p.mode === "EXTERNAL_SERVICE" && (!p.external_service_ref || !fact(input, "EXTERNAL_SERVICE", undefined, p.external_service_ref)) || (p.replica_count ?? 1) > 1 && !["NONE", "EPHEMERAL"].includes(p.mode) && (!p.shared_state_decision_ref || !fact(input, "SHARED_STATE_DECISION", undefined, p.shared_state_decision_ref)), "PERSISTENCE_CONTRACT_UNRESOLVED");
  add(input.provider_authority && !fact(input, "PROVIDER_DECISION", input.provider_authority.provider, input.provider_authority.decision_ref), "PROVIDER_MAPPING_UNAUTHORIZED");
  return [...new Set(errors)];
}
export function buildDeploymentDecision(raw: unknown): DeploymentDecision {
  const invalid = validateDeploymentInput(raw); if (invalid.length) return blockedDecision(invalid);
  const input = raw as DeploymentInput, issues = deriveDeploymentFacts(input);
  if (issues.length) return blockedDecision(issues);
  const container = buildContainerPlan(input); if (!container) return blockedDecision(["RUNTIME_VERSION_UNRESOLVED"]);
  const verification = evaluateDeploymentEvidence(input);
  const requiredMissing = verification.missing_kinds.filter(k => !["DEPLOYED_REVISION_OBSERVED", "DEPLOYED_SMOKE_PASS"].includes(k));
  if (requiredMissing.length) return blockedDecision(["DEPLOYMENT_EVIDENCE_INSUFFICIENT"]);
  const projectionMissing = input.policy.render_dockerfile && !container.dockerfile;
  const partial = verification.missing_kinds.length > 0 || !input.deployment_evidence.some(e => e.kind === "DEPLOYED_REVISION_OBSERVED" && evidenceAccepted(input, e)) || input.container_policy.non_root_required || projectionMissing;
  return { status: partial ? "PARTIAL" : "READY", reason_code: partial ? "DEPLOYMENT_EVIDENCE_INSUFFICIENT" : null, deployment_identity: structuredClone(input.identity), entrypoint_assessment: { eligible: true, kind: input.runtime_surface.kind, entrypoint_ref: input.runtime_surface.entrypoint_ref }, build_plan: structuredClone(input.build_contract), container_plan: container, environment_plan: structuredClone(input.environment_contract).sort((a, b) => a.name.localeCompare(b.name, "en")), health_plan: structuredClone(input.health_contract), persistence_plan: structuredClone(input.persistence_contract), provider_mapping: input.provider_authority?.provider ?? "PROVIDER_NEUTRAL", provider_authority_ref: input.provider_authority?.decision_ref ?? null, deployment_verification: verification, blockers: [], limitations: ["No deployment execution or independent verification is performed."], residual_unknowns: [...verification.missing_kinds, ...(input.container_policy.non_root_required ? ["NON_ROOT_IMAGE_USER_UNRESOLVED"] : []), ...(projectionMissing ? ["DOCKER_PROJECTION_AUTHORITY_UNRESOLVED"] : [])], evidence_refs: [...new Set(input.repository_facts.map(f => f.fact_id))].sort() };
}
export function validateDeploymentCandidate(candidate: unknown, input: unknown): { valid: boolean; errors: string[] } {
  if (sensitiveMaterial(candidate)) return { valid: false, errors: ["SECRET_MATERIAL_PRESENT"] };
  try { const expected = buildDeploymentDecision(input); return canonical(candidate) === canonical(expected) ? { valid: true, errors: [] } : { valid: false, errors: ["CANDIDATE_REJECTED"] }; }
  catch { return { valid: false, errors: ["INVALID_DEPLOYMENT_INPUT"] }; }
}
export function evaluateDeploymentCandidateGate(input: unknown, candidate: unknown) {
  const validation = validateDeploymentCandidate(candidate, input);
  // Preserve the actual accepted candidate; never substitute the recomputed answer.
  return { validation, decision: validation.valid ? structuredClone(candidate) as DeploymentDecision : blockedDecision(validation.errors) };
}
