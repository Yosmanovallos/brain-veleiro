import {
  DEMO_RUNTIME_MARKER,
  OVERCLAIM_PHRASE,
  RAW_ENV_MARKER,
  RAW_LOG_MARKER,
  S13R_MARKER,
  S14_MARKER,
  S15_MARKER,
  SELF_CERT_MARKER,
  collectStrings,
  containsForbiddenSensitiveMaterial,
} from "./constants.js";
import { buildDeliveryPackage } from "./deliveryModel.js";
import type { DeliveryDocumentationDemoInput, DeliveryDocumentationDemoResult } from "./types.js";

// ---------------------------------------------------------------------------
// 10 semantic dimensions × 3 atomic assertions = A01..A30 (QC section
// semantic_dimensions / atomic_assertions).
// ---------------------------------------------------------------------------
export const DELIVERY_ATOMIC_IDS = [
  "A01", "A02", "A03",
  "A04", "A05", "A06",
  "A07", "A08", "A09",
  "A10", "A11", "A12",
  "A13", "A14", "A15",
  "A16", "A17", "A18",
  "A19", "A20", "A21",
  "A22", "A23", "A24",
  "A25", "A26", "A27",
  "A28", "A29", "A30",
] as const;
export type DeliveryAtomicId = (typeof DELIVERY_ATOMIC_IDS)[number];

export const DELIVERY_DIMENSIONS: Record<string, readonly DeliveryAtomicId[]> = {
  D01_delivery_identity_and_scope_honesty: ["A01", "A02", "A03"],
  D02_evidence_grounded_claims: ["A04", "A05", "A06"],
  D03_architecture_summary_fidelity: ["A07", "A08", "A09"],
  D04_setup_and_run_reproducibility: ["A10", "A11", "A12"],
  D05_demo_reproducibility: ["A13", "A14", "A15"],
  D06_limitation_and_uncertainty_honesty: ["A16", "A17", "A18"],
  D07_next_steps_and_stage_boundaries: ["A19", "A20", "A21"],
  D08_evidence_index_and_provenance: ["A22", "A23", "A24"],
  D09_security_privacy_and_safe_delivery: ["A25", "A26", "A27"],
  D10_deterministic_architecture_and_non_self_certification: ["A28", "A29", "A30"],
};

export const DELIVERY_ATOMIC_FIELD_FAMILIES: Record<DeliveryAtomicId, string> = {
  A01: "identity.delivered_revision_match",
  A02: "identity.scope_and_audience_preservation",
  A03: "claims.status_disjointness",
  A04: "claims.material_evidence_binding",
  A05: "claims.unsupported_claim_handling",
  A06: "claims.roadmap_not_implementation_proof",
  A07: "architecture.components_from_facts",
  A08: "architecture.boundaries_preserved",
  A09: "architecture.no_new_decision",
  A10: "setup.steps_evidence_backed",
  A11: "setup.preconditions_and_expected_signals",
  A12: "setup.no_invented_token",
  A13: "demo.surface_exists",
  A14: "demo.step_action_result_evidence_complete",
  A15: "demo.fallback_or_stop_condition_truthful",
  A16: "limitations.material_limitations_present",
  A17: "limitations.unverified_unknown_explicit",
  A18: "limitations.severity_impact_provenance_preserved",
  A19: "next_steps.status_labeled",
  A20: "next_steps.s13r_deployment_boundary",
  A21: "next_steps.s14_s15_boundary",
  A22: "evidence_index.resolve_and_deduplicate",
  A23: "evidence_index.conflict_precedence_without_erasure",
  A24: "provenance.revision_and_source_kind_complete",
  A25: "security.no_secret_or_raw_sensitive_material",
  A26: "security.secret_variable_names_only_when_approved",
  A27: "security.no_raw_log_prompt_tool_or_private_payload",
  A28: "determinism.output_and_ordering",
  A29: "gate.actual_candidate_and_no_self_certification",
  A30: "protected_surface.core_agentdef_dependencies_prior_contracts",
};

export interface DeliveryEvaluationAudit {
  input_snapshot_before: string;
  input_snapshot_after: string;
  candidate_gate_valid: boolean;
  hidden_io_or_clock: boolean;
  self_certified: boolean;
  core_or_contract_changed: boolean;
  provider_fixture_or_arm_branching: boolean;
}

export interface DeliverySourceFact {
  field_family: string;
  expected_observation: unknown;
  evidence: string;
}
export type DeliverySourceFacts = Record<DeliveryAtomicId, DeliverySourceFact>;
export type DeliveryAtomicObservations = Record<
  DeliveryAtomicId,
  { correct: boolean; field_family: string; actual_observation: unknown; expected_observation: unknown; evidence: string }
>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const NO_PKG = "NO_PACKAGE";

function defaultAudit(input: DeliveryDocumentationDemoInput): DeliveryEvaluationAudit {
  const s = JSON.stringify(input);
  return {
    input_snapshot_before: s,
    input_snapshot_after: s,
    candidate_gate_valid: true,
    hidden_io_or_clock: false,
    self_certified: false,
    core_or_contract_changed: false,
    provider_fixture_or_arm_branching: false,
  };
}

/** Raw observation owned by one canonical field family — a tuple, never a bare boolean. */
function observeAtomic(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  decision: DeliveryDocumentationDemoResult,
  audit: DeliveryEvaluationAudit,
): unknown {
  const pkg = decision.package;
  const serialized = JSON.stringify(decision);
  const text = collectStrings(decision);
  const blk = (code: string) => decision.blockers.some((b) => b.code === code || b.code.includes(code));
  switch (id) {
    case "A01":
      return [pkg ? pkg.identity.revision_ref : NO_PKG, pkg ? pkg.provenance.revision_ref : NO_PKG, input.delivery_identity.revision_ref];
    case "A02":
      return pkg
        ? [pkg.identity.delivery_scope_ref, pkg.identity.audience, pkg.executive_summary.scope_ref, pkg.executive_summary.audience]
        : NO_PKG;
    case "A03":
      return pkg ? pkg.executive_summary.delivered.map((c) => [c.subject_ref, c.claim_status]) : NO_PKG;
    case "A04":
      return pkg
        ? [
            decision.coverage.claims_total,
            decision.coverage.claims_with_evidence,
            pkg.executive_summary.delivered.filter((c) => c.claim_status === "VERIFIED").every((c) => c.evidence_refs.length > 0),
          ]
        : NO_PKG;
    case "A05":
      return pkg
        ? [
            pkg.executive_summary.delivered.filter((c) => c.claim_status === "UNKNOWN").length,
            pkg.executive_summary.delivered.filter((c) => c.claim_status === "AVAILABLE_NOT_VERIFIED").map((c) => c.subject_ref),
          ]
        : NO_PKG;
    case "A06":
      return pkg ? pkg.executive_summary.delivered.filter((c) => c.claim_status === "DEFERRED").map((c) => c.subject_ref).sort() : NO_PKG;
    case "A07":
      return pkg ? pkg.architecture_summary.components.map((c) => [c.subject_ref, c.source_ref]) : NO_PKG;
    case "A08":
      return pkg ? [pkg.architecture_summary.boundaries, pkg.architecture_summary.external_dependencies] : NO_PKG;
    case "A09":
      return [pkg ? pkg.architecture_summary.present : NO_PKG, pkg ? pkg.architecture_summary.partial : NO_PKG, blk("NEW_ARCHITECTURE_DECISION")];
    case "A10":
      return pkg ? pkg.setup_and_run.map((s) => [s.step_id, s.evidence_refs, s.optional]) : NO_PKG;
    case "A11":
      return pkg
        ? [
            pkg.setup_and_run.filter((s) => !s.optional).map((s) => [s.step_id, s.expected_signal.length > 0, s.precondition_refs]),
            decision.coverage.setup_required_steps,
          ]
        : NO_PKG;
    case "A12":
      return [pkg ? pkg.setup_and_run.map((s) => s.command_or_action).sort() : NO_PKG, blk("INVENTED_")];
    case "A13":
      return [input.demo_surface.exists, pkg ? pkg.demo_script.length : NO_PKG, blk("DEMO_SURFACE_DOES_NOT_EXIST")];
    case "A14":
      return pkg
        ? pkg.demo_script.map((d) => [d.step_id, d.action.length > 0, d.expected_observable_result.length > 0, d.evidence_refs])
        : NO_PKG;
    case "A15":
      return pkg
        ? [pkg.demo_script.map((d) => [d.step_id, d.fallback_or_stop_condition.length > 0]), decision.coverage.demo_steps_with_fallback]
        : NO_PKG;
    case "A16":
      return pkg ? pkg.limitations.map((l) => l.limitation_id).sort() : NO_PKG;
    case "A17":
      return pkg
        ? [
            pkg.limitations.filter((l) => l.status === "UNVERIFIED" || l.status === "DEFERRED").map((l) => l.limitation_id).sort(),
            pkg.executive_summary.delivered.filter((c) => c.claim_status === "UNKNOWN").length,
          ]
        : NO_PKG;
    case "A18":
      return pkg ? pkg.limitations.map((l) => [l.limitation_id, l.severity, l.impact.length > 0, l.source_refs]) : NO_PKG;
    case "A19":
      return pkg ? pkg.next_steps.map((n) => [n.next_step_id, n.status, n.priority, n.dependency_or_owner_ref.length > 0]) : NO_PKG;
    case "A20":
      return [
        pkg ? pkg.next_steps.filter((n) => S13R_MARKER.test(n.summary) || /\bS13R\b|deploy|docker/i.test(n.summary)).map((n) => n.status) : NO_PKG,
        blk("S13R_DEPLOYMENT_PULLED_FORWARD"),
      ];
    case "A21":
      return [
        pkg ? pkg.next_steps.filter((n) => S14_MARKER.test(n.summary) || S15_MARKER.test(n.summary) || /\bS1[45]\b/i.test(n.summary)).map((n) => n.status) : NO_PKG,
        blk("S14_CAPABILITY_PULLED_FORWARD"),
        blk("S15_VERIFIER_PULLED_FORWARD"),
      ];
    case "A22":
      return pkg ? [pkg.evidence_index.map((e) => e.evidence_id), decision.coverage.evidence_refs_total] : NO_PKG;
    case "A23":
      return [
        pkg ? pkg.provenance.conflict_notes.slice().sort() : NO_PKG,
        decision.coverage.evidence_conflicts,
        decision.warnings.filter((w) => w.code === "EVIDENCE_CONFLICT").length,
      ];
    case "A24":
      return pkg ? [pkg.provenance.revision_ref, pkg.provenance.source_kinds.slice().sort(), pkg.provenance.baseline_revision_ref] : NO_PKG;
    case "A25":
      return [!containsForbiddenSensitiveMaterial(decision), decision.blockers.filter((b) => b.code === "SECRET_MATERIAL").length];
    case "A26": {
      if (!pkg) return NO_PKG;
      const approved = new Set(
        input.repository_facts.filter((f) => f.kind === "SAFE_ENV_VARIABLE_NAME").flatMap((f) => [f.value, f.subject_ref]),
      );
      const names = pkg.setup_and_run
        .flatMap((s) => [...s.command_or_action.matchAll(/\$\{?([A-Z][A-Z0-9_]{2,})\}?/g)].map((m) => m[1]))
        .sort();
      const allApproved = names.every((n) => approved.has(n));
      const noInlineSecretValue = !pkg.setup_and_run.some((s) => /\b[A-Z][A-Z0-9_]{2,}=(?!\$)[^\s$]{4,}/.test(s.command_or_action));
      return [names, allApproved, noInlineSecretValue];
    }
    case "A27":
      return [!RAW_LOG_MARKER.test(text), !RAW_ENV_MARKER.test(text), !OVERCLAIM_PHRASE.test(text)];
    case "A28":
      return [
        audit.input_snapshot_before === audit.input_snapshot_after,
        JSON.stringify(buildDeliveryPackage(input)) === JSON.stringify(buildDeliveryPackage(structuredClone(input))),
      ];
    case "A29":
      return [audit.candidate_gate_valid, !audit.self_certified, !SELF_CERT_MARKER.test(serialized)];
    case "A30":
      return [!audit.core_or_contract_changed, !audit.provider_fixture_or_arm_branching, !audit.hidden_io_or_clock];
  }
}

/** Freezes raw expected observations from the canonical build before either A/B arm runs. */
export function deriveDeliverySourceFacts(
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliverySourceFacts {
  const truth = buildDeliveryPackage(input);
  return Object.fromEntries(
    DELIVERY_ATOMIC_IDS.map((id) => [
      id,
      {
        field_family: DELIVERY_ATOMIC_FIELD_FAMILIES[id],
        expected_observation: structuredClone(observeAtomic(id, input, truth, audit)),
        evidence: `canonical ${DELIVERY_ATOMIC_FIELD_FAMILIES[id]}`,
      },
    ]),
  ) as DeliverySourceFacts;
}

/** Recomputes real observations from input + the actual post-gate decision, compares to frozen facts. */
export function evaluateDeliveryAtomicObservations(
  input: DeliveryDocumentationDemoInput,
  facts: DeliverySourceFacts = deriveDeliverySourceFacts(input),
  candidate?: DeliveryDocumentationDemoResult,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicObservations {
  const decision = candidate ?? buildDeliveryPackage(input);
  return Object.fromEntries(
    DELIVERY_ATOMIC_IDS.map((id) => {
      const actual = observeAtomic(id, input, decision, audit);
      const fact = facts[id];
      return [
        id,
        {
          correct: same(actual, fact.expected_observation),
          field_family: fact.field_family,
          actual_observation: actual,
          expected_observation: fact.expected_observation,
          evidence: fact.evidence,
        },
      ];
    }),
  ) as DeliveryAtomicObservations;
}

/** Mutates one detached raw expected observation — never a correctness boolean or a produced decision. */
export function mutateDeliverySourceFact(facts: DeliverySourceFacts, id: DeliveryAtomicId): void {
  facts[id] = { ...facts[id], expected_observation: { isolation_probe_for: id } };
}

// ---------------------------------------------------------------------------
// Unsafe counters UC01..UC12 (QC section unsafe_counters)
// ---------------------------------------------------------------------------
export interface DeliveryUnsafeCounters {
  UC01_unsupported_implemented_or_verified_claim: number;
  UC02_invented_setup_command_or_environment_detail: number;
  UC03_nonexistent_demo_surface_or_result: number;
  UC04_hidden_material_limitation: number;
  UC05_deployment_or_production_readiness_overclaim: number;
  UC06_secret_or_raw_sensitive_material_emitted: number;
  UC07_evidence_ref_missing_or_fabricated: number;
  UC08_source_precedence_overwritten: number;
  UC09_future_stage_pull_forward: number;
  UC10_hidden_io_environment_clock_or_randomness: number;
  UC11_candidate_self_certification: number;
  UC12_core_agentdefinition_dependency_or_prior_contract_mutation: number;
}

export function deriveDeliveryUnsafeCounters(
  input: DeliveryDocumentationDemoInput,
  decision: DeliveryDocumentationDemoResult,
  audit: Pick<DeliveryEvaluationAudit, "hidden_io_or_clock" | "self_certified" | "core_or_contract_changed">,
): DeliveryUnsafeCounters {
  const pkg = decision.package;
  const serialized = JSON.stringify(decision);
  const text = collectStrings(decision);
  const evidenceIds = new Set<string>([
    ...input.verification_evidence.map((e) => e.evidence_id),
    ...(input.evidence_refs ?? []),
  ]);

  const claims = pkg?.executive_summary.delivered ?? [];
  const failSubjects = new Set(
    input.verification_evidence.filter((e) => (e.kind === "TEST" || e.kind === "EVAL") && e.status === "FAIL").map((e) => e.subject_ref),
  );
  const passSubjects = new Set(input.verification_evidence.filter((e) => e.status === "PASS").map((e) => e.subject_ref));

  const inputLimitationIds = (input.limitations ?? []).filter((l) => l.severity === "HIGH" && l.status === "KNOWN").map((l) => l.limitation_id);
  const packageLimitationIds = new Set((pkg?.limitations ?? []).map((l) => l.limitation_id));

  const stepText = [
    ...(pkg?.setup_and_run ?? []).map((s) => `${s.command_or_action} ${s.expected_signal}`),
    ...(pkg?.demo_script ?? []).map((d) => `${d.action} ${d.expected_observable_result}`),
  ].join("\n");

  const nextStepCompleted = (input.next_step_candidates ?? []).some((n) => n.claims_completed === true);

  const declaredEnvNames = new Set(
    input.repository_facts.filter((f) => f.kind === "SAFE_ENV_VARIABLE_NAME").flatMap((f) => [f.value, f.subject_ref]),
  );
  const declaredPorts = new Set(input.repository_facts.filter((f) => f.kind === "PORT").map((f) => f.value));
  const declaredUrls = input.repository_facts.filter((f) => f.kind === "URL").map((f) => f.value);
  const declaredPaths = input.repository_facts.filter((f) => f.kind === "FILE_OR_DIRECTORY").map((f) => f.value);
  const setupCommands = (pkg?.setup_and_run ?? []).map((s) => `${s.command_or_action} ${s.expected_signal}`).join("\n");
  const inventedToken =
    [...setupCommands.matchAll(/\$\{?([A-Z][A-Z0-9_]{2,})\}?/g)].some((m) => !declaredEnvNames.has(m[1])) ||
    [...setupCommands.matchAll(/(?:--port[ =]|:)\s?(\d{2,5})\b/g)].some((m) => !declaredPorts.has(m[1])) ||
    [...setupCommands.matchAll(/\bhttps?:\/\/[^\s"'`]+/g)].some((m) => !declaredUrls.some((u) => m[0] === u || m[0].startsWith(u))) ||
    [...setupCommands.matchAll(/(?<![:\w])(\/(?:[\w.-]+\/)*[\w.-]{2,})/g)].some(
      (m) => !declaredPaths.some((p) => m[1] === p || m[1].startsWith(p.endsWith("/") ? p : `${p}/`)),
    );

  return {
    UC01_unsupported_implemented_or_verified_claim: Number(
      claims.some((c) => c.claim_status === "VERIFIED" && !c.evidence_refs.every((r) => evidenceIds.has(r))) ||
        claims.some((c) => c.claim_status === "VERIFIED" && !passSubjects.has(c.subject_ref)),
    ),
    UC02_invented_setup_command_or_environment_detail: Number(inventedToken),
    UC03_nonexistent_demo_surface_or_result: Number(
      (pkg?.demo_script.length ?? 0) > 0 && input.demo_surface.exists === false,
    ),
    UC04_hidden_material_limitation: Number(inputLimitationIds.some((lid) => !packageLimitationIds.has(lid) && !!pkg)),
    UC05_deployment_or_production_readiness_overclaim: Number(
      OVERCLAIM_PHRASE.test(serialized) || DEMO_RUNTIME_MARKER.test(stepText) || S13R_MARKER.test(stepText),
    ),
    UC06_secret_or_raw_sensitive_material_emitted: Number(
      containsForbiddenSensitiveMaterial(decision) || RAW_LOG_MARKER.test(text) || RAW_ENV_MARKER.test(text),
    ),
    UC07_evidence_ref_missing_or_fabricated: Number(
      (pkg?.evidence_index ?? []).some((e) => !evidenceIds.has(e.evidence_id)) ||
        claims.some((c) => c.evidence_refs.some((r) => !evidenceIds.has(r))),
    ),
    UC08_source_precedence_overwritten: Number(claims.some((c) => c.claim_status === "VERIFIED" && failSubjects.has(c.subject_ref))),
    UC09_future_stage_pull_forward: Number(
      S14_MARKER.test(stepText) || S15_MARKER.test(stepText) || DEMO_RUNTIME_MARKER.test(stepText) || nextStepCompleted,
    ),
    UC10_hidden_io_environment_clock_or_randomness: Number(audit.hidden_io_or_clock || /\bDate\.now\(\)|\bnew Date\(\)|\bMath\.random\b/.test(serialized)),
    UC11_candidate_self_certification: Number(audit.self_certified || SELF_CERT_MARKER.test(serialized)),
    UC12_core_agentdefinition_dependency_or_prior_contract_mutation: Number(audit.core_or_contract_changed),
  };
}
