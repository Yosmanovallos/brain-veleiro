// S13Q Delivery Documentation & Demo — canonical shapes.
// Semantic authority: brain-bootstrap/specs/DELIVERY_DOCUMENTATION_DEMO_CONTRACT_S13Q.md
// Quality authority:  brain-bootstrap/quality-contracts/S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP.yaml

export type DeliveryStatus = "READY" | "PARTIAL" | "BLOCKED";

// Contract section 8 — claim status vocabulary.
export type ClaimStatus =
  | "IMPLEMENTED"
  | "VERIFIED"
  | "AVAILABLE_NOT_VERIFIED"
  | "NOT_IMPLEMENTED"
  | "DEFERRED"
  | "UNKNOWN";

export type FactConfidence = "VERIFIED" | "ACCEPTED" | "REPORTED";

export type RepositoryFactKind =
  | "PROJECT_NAME"
  | "PACKAGE_SCRIPT"
  | "COMMAND"
  | "FILE_OR_DIRECTORY"
  | "MODULE"
  | "PUBLIC_ENTRYPOINT"
  | "RUNTIME_REQUIREMENT"
  | "SAFE_ENV_VARIABLE_NAME"
  | "PORT"
  | "URL"
  | "ARCHITECTURE_COMPONENT"
  | "ARCHITECTURE_BOUNDARY"
  | "KNOWN_FEATURE"
  | "KNOWN_NON_FEATURE"
  | "DEMO_SURFACE";

export type EvidenceKind =
  | "TYPECHECK"
  | "BUILD"
  | "TEST"
  | "EVAL"
  | "INDEPENDENT_VERIFICATION"
  | "SECURITY_CHECK"
  | "BOUNDARY_AUDIT"
  | "GIT_AUDIT"
  | "DEMO_PROOF"
  | "OTHER_DETERMINISTIC";

export type EvidenceStatus = "PASS" | "FAIL" | "SKIPPED" | "BLOCKED" | "NOT_EVALUATED";

export type DemoSurfaceKind =
  | "CLI"
  | "LIBRARY_API"
  | "LOCAL_UI"
  | "LOCAL_HTTP_API"
  | "GENERATED_ARTIFACT"
  | "TEST_OR_EVAL_HARNESS"
  | "DOCUMENTED_INSPECTION"
  | "OTHER_EXISTING_SURFACE";

export type ArchitectureFactKind =
  | "COMPONENT"
  | "BOUNDARY"
  | "DEPENDENCY"
  | "FLOW"
  | "ABSENT_OR_DEFERRED";

export type LimitationSeverity = "LOW" | "MEDIUM" | "HIGH";
export type LimitationStatus = "KNOWN" | "UNVERIFIED" | "DEFERRED";

export type NextStepPriority = "P0" | "P1" | "P2" | "P3";
export type NextStepStatus = "PROPOSED" | "DEFERRED" | "REQUIRED_BEFORE_PRODUCTION";

// ---------------------------------------------------------------------------
// Input model (contract section 6)
// ---------------------------------------------------------------------------

export interface DeliveryIdentity {
  project_ref: string;
  revision_ref: string;
  delivery_scope_ref: string;
  audience: string;
  baseline_revision_ref?: string;
  accepted_ancestry_or_range_ref?: string;
  release_or_handoff_ref?: string;
}

export interface RepositoryFact {
  fact_id: string;
  kind: RepositoryFactKind;
  subject_ref: string;
  value: string;
  source_ref: string;
  revision_ref: string;
  confidence: FactConfidence;
  /** Caller's assertion about the claim status this fact supports. Validated, never trusted. */
  asserts_status?: ClaimStatus;
  /** Verification evidence id the caller cites for this fact. */
  evidence_ref?: string;
  /** Only meaningful for COMMAND / PACKAGE_SCRIPT facts. */
  setup_role?: "REQUIRED" | "OPTIONAL";
  expected_signal_ref?: string;
  precondition_refs?: readonly string[];
  purpose_ref?: string;
}

export interface VerificationEvidence {
  evidence_id: string;
  kind: EvidenceKind;
  subject_ref: string;
  revision_ref: string;
  status: EvidenceStatus;
  summary_ref: string;
  source_ref: string;
}

export interface DemoSurface {
  surface_ref: string;
  kind: DemoSurfaceKind;
  exists: boolean;
  revision_ref: string;
  entry_action_ref: string;
  precondition_refs: readonly string[];
  steps?: readonly DemoSurfaceStep[];
}

export interface DemoSurfaceStep {
  step_ref: string;
  title_ref: string;
  action_ref: string;
  expected_result_ref: string;
  evidence_ref?: string;
  env_sensitive: boolean;
  fallback_ref?: string;
}

export interface ArchitectureFact {
  fact_id: string;
  kind: ArchitectureFactKind;
  subject_ref: string;
  value: string;
  source_ref: string;
  revision_ref: string;
  /** Caller flag: this "fact" is actually a proposed decision. Blocks READY. */
  is_proposed_decision?: boolean;
}

export interface LimitationFact {
  limitation_id: string;
  summary: string;
  severity: LimitationSeverity;
  impact: string;
  status: LimitationStatus;
  source_refs: readonly string[];
  /** Subject whose IMPLEMENTED/VERIFIED claim this limitation would contradict. */
  contradicts_subject_ref?: string;
}

export interface NextStepFact {
  next_step_id: string;
  summary: string;
  priority: NextStepPriority;
  status: NextStepStatus;
  dependency_or_owner_ref: string;
  source_refs: readonly string[];
  /** Caller flag: this next step is presented as already done. Blocks READY. */
  claims_completed?: boolean;
}

export interface DeliveryPolicy {
  max_repository_facts: number;
  max_verification_evidence: number;
  max_architecture_facts: number;
  max_setup_steps: number;
  max_demo_steps: number;
  max_limitations: number;
  max_next_steps: number;
  max_evidence_refs_per_claim: number;
  max_total_evidence_refs: number;
  max_safe_ref_chars: number;
  max_text_chars_per_field: number;
  max_rendered_markdown_bytes: number;
  require_markdown_projection: boolean;
  /** Limitation ids the caller wants suppressed. Suppressing a HIGH/KNOWN one blocks. */
  suppress_limitation_ids?: string[];
}

export interface DeliveryDocumentationDemoInput {
  delivery_identity: DeliveryIdentity;
  repository_facts: readonly RepositoryFact[];
  verification_evidence: readonly VerificationEvidence[];
  demo_surface: DemoSurface;
  policy: DeliveryPolicy;
  architecture_facts?: readonly ArchitectureFact[];
  limitations?: readonly LimitationFact[];
  next_step_candidates?: readonly NextStepFact[];
  evidence_refs?: readonly string[];
}

// ---------------------------------------------------------------------------
// Output model (contract section 7)
// ---------------------------------------------------------------------------

export interface DeliveryClaim {
  claim_id: string;
  subject_ref: string;
  text: string;
  claim_status: ClaimStatus;
  evidence_refs: string[];
}

export interface ArchitectureComponentSummary {
  subject_ref: string;
  responsibility: string;
  source_ref: string;
}

export interface ArchitectureSummary {
  present: boolean;
  partial: boolean;
  components: ArchitectureComponentSummary[];
  boundaries: string[];
  external_dependencies: string[];
  absent_or_deferred: string[];
}

export interface ExecutiveSummary {
  delivered: DeliveryClaim[];
  revision_ref: string;
  scope_ref: string;
  audience: string;
  verified: string[];
  limited_or_deferred: string[];
}

export interface SetupRunStep {
  step_id: string;
  purpose: string;
  command_or_action: string;
  precondition_refs: string[];
  expected_signal: string;
  evidence_refs: string[];
  optional: boolean;
}

export interface DemoStep {
  step_id: string;
  title: string;
  precondition_refs: string[];
  action: string;
  expected_observable_result: string;
  evidence_refs: string[];
  fallback_or_stop_condition: string;
}

export interface DeliveryLimitation {
  limitation_id: string;
  summary: string;
  severity: LimitationSeverity;
  impact: string;
  status: LimitationStatus;
  source_refs: string[];
}

export interface DeliveryNextStep {
  next_step_id: string;
  summary: string;
  priority: NextStepPriority;
  status: NextStepStatus;
  dependency_or_owner_ref: string;
  source_refs: string[];
}

export interface EvidenceIndexEntry {
  evidence_id: string;
  kind: EvidenceKind;
  status: EvidenceStatus;
  subject_ref: string;
  revision_ref: string;
  source_ref: string;
}

export interface DeliveryProvenance {
  revision_ref: string;
  baseline_revision_ref: string | null;
  accepted_ancestry_or_range_ref: string | null;
  source_kinds: string[];
  conflict_notes: string[];
}

export interface DeliveryPackage {
  identity: DeliveryIdentity;
  executive_summary: ExecutiveSummary;
  architecture_summary: ArchitectureSummary;
  setup_and_run: SetupRunStep[];
  demo_script: DemoStep[];
  limitations: DeliveryLimitation[];
  next_steps: DeliveryNextStep[];
  evidence_index: EvidenceIndexEntry[];
  provenance: DeliveryProvenance;
  optional_markdown_projection: string | null;
}

export interface DeliveryCoverage {
  required_sections_present: boolean;
  setup_required_steps: number;
  setup_optional_steps: number;
  demo_required_steps: number;
  demo_steps_with_fallback: number;
  claims_total: number;
  claims_with_evidence: number;
  limitations_total: number;
  next_steps_total: number;
  evidence_refs_total: number;
  evidence_conflicts: number;
  markdown_bytes: number;
}

export interface DeliveryBlocker {
  code: string;
  detail: string;
}

export interface DeliveryWarning {
  code: string;
  detail: string;
}

export interface DeliveryDocumentationDemoResult {
  status: DeliveryStatus;
  blockers: DeliveryBlocker[];
  package: DeliveryPackage | null;
  coverage: DeliveryCoverage;
  warnings: DeliveryWarning[];
}

export interface DeliveryValidationResult {
  valid: boolean;
  errors: string[];
}
