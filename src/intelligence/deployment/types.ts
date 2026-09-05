/** S13R Part A reference shapes. All authority is supplied by the caller. */
export type RuntimeKind = "LIBRARY_ONLY" | "HTTP_SERVICE" | "WORKER" | "CLI_PROCESS" | "OTHER_EXECUTABLE" | "NONE";
export type Transport = "HTTP" | "COMMAND" | "PROCESS" | "NONE";
export type EvidenceKind = "BUILD_PASS" | "IMAGE_BUILD_PASS" | "PROCESS_START_PASS" | "LIVENESS_PASS" | "READINESS_PASS" | "DEPLOYED_REVISION_OBSERVED" | "DEPLOYED_SMOKE_PASS";
export interface DeploymentIdentity { project_ref: string; revision_ref: string; deployment_scope_ref: string; baseline_revision_ref?: string; accepted_ancestry_or_range_ref?: string }
export interface RepositoryFact { fact_id: string; kind: string; value: string; source_ref: string; revision_ref: string; confidence: "VERIFIED" | "ACCEPTED" | "REPORTED" }
export interface RuntimeSurface { kind: RuntimeKind; entrypoint_ref?: string; start_command_ref?: string; start_command?: string; port_ref?: string; port?: number; health_transport: Transport }
export interface BuildContract { build_command: string; build_artifact_refs: string[]; runtime_name: string; runtime_version: string; package_manager?: string; install_command?: string }
export interface ContainerPolicy { strategy: "DOCKER_FIRST"; base_runtime_ref?: string; non_root_required?: boolean; read_only_root_preferred?: boolean; working_directory?: string }
export interface EnvironmentItem { name: string; requirement: "REQUIRED" | "OPTIONAL"; classification: "PUBLIC_CONFIG" | "SENSITIVE_REFERENCE"; source_ref: string; secret_ref?: string; presence?: "PRESENT" | "ABSENT" | "UNKNOWN" }
export interface HealthContract { transport: Transport; liveness_check?: string; readiness_check?: string; source_ref?: string }
export interface PersistenceContract { mode: "NONE" | "EPHEMERAL" | "PERSISTENT_LOCAL" | "EXTERNAL_SERVICE" | "UNKNOWN"; writable_path_ref?: string; volume_decision_ref?: string; external_service_ref?: string; replica_count?: number; shared_state_decision_ref?: string }
export interface DeploymentEvidence { evidence_id: string; kind: EvidenceKind; revision_ref: string; subject_ref: string; result: "PASS" | "FAIL" | "UNKNOWN"; source_ref: string; evidence_refs: string[] }
export interface ProviderAuthority { provider: string; decision_ref: string }
export interface DeploymentPolicy { require_liveness: boolean; require_readiness: boolean; require_deployed: boolean; render_dockerfile: boolean }
export interface DeploymentInput {
  identity: DeploymentIdentity; repository_facts: RepositoryFact[]; runtime_surface: RuntimeSurface;
  build_contract: BuildContract; container_policy: ContainerPolicy; environment_contract: EnvironmentItem[];
  health_contract: HealthContract; persistence_contract: PersistenceContract; deployment_evidence: DeploymentEvidence[];
  policy: DeploymentPolicy; provider_authority?: ProviderAuthority; evidence_refs?: string[];
}
export interface ContainerPlan { strategy: "DOCKER_FIRST"; base_image: string; working_directory: string; install_command?: string; build_command: string; artifacts: string[]; start_command: string; port?: number; non_root: boolean; read_only_root: boolean; healthcheck?: string; dockerfile: string | null }
export interface DeploymentDecision {
  status: "READY" | "PARTIAL" | "BLOCKED"; reason_code: string | null;
  deployment_identity: DeploymentIdentity | null;
  entrypoint_assessment: { eligible: boolean; kind: RuntimeKind; entrypoint_ref?: string } | null;
  build_plan: BuildContract | null; container_plan: ContainerPlan | null;
  environment_plan: EnvironmentItem[]; health_plan: HealthContract | null; persistence_plan: PersistenceContract | null;
  provider_mapping: string; provider_authority_ref: string | null;
  deployment_verification: { accepted_evidence_ids: string[]; missing_kinds: EvidenceKind[] };
  blockers: string[]; limitations: string[]; residual_unknowns: string[]; evidence_refs: string[];
}
export interface DeploymentAudit { candidate_gated: boolean; provider_visible_keys: string[]; hidden_io: boolean; changed_protected_paths: string[]; self_awards: boolean; provider_adapter: boolean; future_stages: string[] }
