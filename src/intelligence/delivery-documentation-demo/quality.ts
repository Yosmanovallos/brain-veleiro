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

// ---------------------------------------------------------------------------
// The ONE real atomic predicate.
//
// `observeAtomic(id, input, decision, audit)` is the single observer body for
// all 30 atomics. Its output is byte-identical to the pre-refactor switch, so
// `buildDeliveryPackage`, the candidate gate, `evaluateDeliveryAtomicObservations`
// A/B scoring, the unsafe counters and `planDeliveryDocumentationDemo` are
// unaffected. The owned-source-fact isolation machinery below feeds this exact
// function a mutated shared raw `{ input, audit }` model plus the real rebuilt
// canonical decision — it never re-implements the predicate.
// ---------------------------------------------------------------------------

type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

function observeAtomic(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  decision: DeliveryDocumentationDemoResult,
  audit: DeliveryEvaluationAudit,
): unknown {
  const pkg = decision.package ?? null;
  const serialized = JSON.stringify(decision);
  const text = collectStrings(decision);
  const blk = (code: string) => (decision.blockers ?? []).some((b) => b.code === code || b.code.includes(code));
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

// ---------------------------------------------------------------------------
// One-governing-source causal isolation (QC `source_fact_isolation`; semantic
// contract §21 as amended by brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_1.md).
//
// Every A01..A30 is classified STRICT | STRUCTURAL_DEPENDENCY | GATE_CLASS |
// FAIL. One shared detached RAW `{ input, audit }` model is frozen upstream of
// `buildDeliveryPackage`; a probe clones it, mutates exactly ONE semantically
// governing raw fact (erratum §4/§6), reruns the real
// `validateDeliveryInput`/`buildDeliveryPackage`, recomputes all 30 atomic
// observations via the one real `observeAtomic`, and measures the changed set.
//
// Rejected mechanisms (mechanically proven invalid below):
//   - cf49b45: direct `expected_observation` overwrite       -> legacyExpectedObservationMutationEvidence
//   - 1782a16: direct derived-`decision` field overwrite     -> legacyDerivedDecisionMutationEvidence
//   - erratum §8.3: semantically irrelevant tuple-mover      -> legacyIrrelevantMoverEvidence
//   - erratum §8.4: two independent source facts in one probe -> legacyTwoFactEvidence
// ---------------------------------------------------------------------------

export interface DeliveryAtomicRawSource {
  input: DeliveryDocumentationDemoInput;
  audit: DeliveryEvaluationAudit;
}

/** The single shared detached raw source model. No `DeliveryDocumentationDemoResult`. */
export function deliveryAtomicRawSource(
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicRawSource {
  return structuredClone({ input, audit });
}

type MutableRawInput = DeepMutable<DeliveryDocumentationDemoInput>;
const mi = (s: DeliveryAtomicRawSource): MutableRawInput => s.input as unknown as MutableRawInput;
const reqTarget = <T>(v: T, path: string): NonNullable<T> => {
  if (v === undefined || v === null) throw new Error(`ISOLATION_TARGET_ABSENT:${path}`);
  return v as NonNullable<T>;
};
const rfBy = (s: DeliveryAtomicRawSource, id: string) =>
  reqTarget(mi(s).repository_facts.find((f) => f.fact_id === id), `input.repository_facts[fact_id=${id}]`);
const veBy = (s: DeliveryAtomicRawSource, id: string) =>
  reqTarget(mi(s).verification_evidence.find((e) => e.evidence_id === id), `input.verification_evidence[evidence_id=${id}]`);
const afBy = (s: DeliveryAtomicRawSource, id: string) =>
  reqTarget((mi(s).architecture_facts ?? []).find((a) => a.fact_id === id), `input.architecture_facts[fact_id=${id}]`);
const lfBy = (s: DeliveryAtomicRawSource, id: string) =>
  reqTarget((mi(s).limitations ?? []).find((l) => l.limitation_id === id), `input.limitations[limitation_id=${id}]`);
const nfBy = (s: DeliveryAtomicRawSource, id: string) =>
  reqTarget((mi(s).next_step_candidates ?? []).find((n) => n.next_step_id === id), `input.next_step_candidates[next_step_id=${id}]`);
const dsBy = (s: DeliveryAtomicRawSource, ref: string) =>
  reqTarget((mi(s).demo_surface.steps ?? []).find((x) => x.step_ref === ref), `input.demo_surface.steps[step_ref=${ref}]`);

export interface DeliveryAtomicOwnedSource {
  /** Human label — pairwise distinct across the 30. */
  owned_fact: string;
  /** Erratum §4: why this fact exercises the semantic property the atomic names. */
  governing_reason: string;
  source_family: "input" | "audit";
  /**
   * Declared raw-source dot-paths the one-fact mutation is expected to touch
   * (relative to the shared `{ input, audit }` model). The classifier requires
   * the MEASURED `mutated_field_paths` to conform to exactly these — a probe
   * whose measured paths land elsewhere is a semantically irrelevant tuple-mover
   * (erratum §8.3) and classifies FAIL.
   */
  governing_paths: string[];
  mutate: (src: DeliveryAtomicRawSource) => void;
}

/**
 * Per-atomic one governing source fact + the mutation of exactly that fact.
 * Frozen to the `baseInput()` fixture indices on purpose: a fixture reorder
 * must fail the conformance check loudly rather than silently follow the move.
 */
export const DELIVERY_ATOMIC_OWNED_SOURCE: Record<DeliveryAtomicId, DeliveryAtomicOwnedSource> = {
  A01: {
    owned_fact: "delivery_identity.revision_ref",
    governing_reason: "A01 delivered_revision_match observes [pkg.identity.revision_ref, pkg.provenance.revision_ref, input.delivery_identity.revision_ref]; the delivered revision spine IS delivery_identity.revision_ref.",
    source_family: "input",
    governing_paths: ["input.delivery_identity.revision_ref"],
    mutate: (s) => { mi(s).delivery_identity.revision_ref = "rev:probe-a01aaaaaa"; },
  },
  A02: {
    owned_fact: "delivery_identity.audience",
    governing_reason: "A02 scope_and_audience_preservation observes identity + executive_summary scope/audience; audience is the named property.",
    source_family: "input",
    governing_paths: ["input.delivery_identity.audience"],
    mutate: (s) => { mi(s).delivery_identity.audience = "audience:probe-a02"; },
  },
  A03: {
    owned_fact: "repository_facts[rf-feat-builder].confidence",
    governing_reason: "A03 implemented_verified_available_deferred_states_not_conflated observes the executive_summary.delivered [subject_ref, claim_status] table; deriveClaimStatus maps confidence ACCEPTED->IMPLEMENTED vs REPORTED->AVAILABLE_NOT_VERIFIED (deliveryModel.ts:371-372), i.e. the claim-state derivation the atomic names.",
    source_family: "input",
    governing_paths: ["input.repository_facts.2.confidence"],
    mutate: (s) => { rfBy(s, "rf-feat-builder").confidence = "REPORTED"; },
  },
  A04: {
    owned_fact: "verification_evidence[ev-test-parser].status",
    governing_reason: "A04 material_evidence_binding observes [claims_total, claims_with_evidence, every VERIFIED claim has evidence]; ev-test-parser is the PASS material evidence binding the one VERIFIED claim. Setting it FAIL removes the binding and fail-closes.",
    source_family: "input",
    governing_paths: ["input.verification_evidence.1.status"],
    mutate: (s) => { veBy(s, "ev-test-parser").status = "FAIL"; },
  },
  A05: {
    owned_fact: "repository_facts[rf-feat-reporter].confidence",
    governing_reason: "A05 unsupported_claim_handling observes [UNKNOWN claim count, AVAILABLE_NOT_VERIFIED subjects]; rf-feat-reporter is the only REPORTED feature fact, so its confidence drives the AVAILABLE_NOT_VERIFIED derivation (deliveryModel.ts:372) the atomic names.",
    source_family: "input",
    governing_paths: ["input.repository_facts.3.confidence"],
    mutate: (s) => { rfBy(s, "rf-feat-reporter").confidence = "ACCEPTED"; },
  },
  A06: {
    owned_fact: "repository_facts[rf-feat-builder].source_ref",
    governing_reason: "A06 roadmap_not_implementation_proof observes DEFERRED subjects; deriveClaimStatus routes a roadmap/backlog/plan source_ref to DEFERRED (deliveryModel.ts:368-369), i.e. the roadmap-vs-implementation distinction the atomic names.",
    source_family: "input",
    governing_paths: ["input.repository_facts.2.source_ref"],
    mutate: (s) => { rfBy(s, "rf-feat-builder").source_ref = "src:roadmap/builder-plan"; },
  },
  A07: {
    owned_fact: "architecture_facts[af-model].source_ref",
    governing_reason: "A07 components_from_facts observes components.map([subject_ref, source_ref]); source_ref is the fact each component is derived from.",
    source_family: "input",
    governing_paths: ["input.architecture_facts.0.source_ref"],
    mutate: (s) => { afBy(s, "af-model").source_ref = "src:module/deliveryModel-probe.ts"; },
  },
  A08: {
    owned_fact: "architecture_facts[af-bound-core].value",
    governing_reason: "A08 boundaries_preserved observes [boundaries, external_dependencies]; af-bound-core is a BOUNDARY fact whose value IS a preserved boundary line (buildArchitecture deliveryModel.ts:393).",
    source_family: "input",
    governing_paths: ["input.architecture_facts.2.value"],
    mutate: (s) => { afBy(s, "af-bound-core").value = "the module keeps every Core boundary intact (probe)"; },
  },
  A09: {
    owned_fact: "architecture_facts[af-model].is_proposed_decision",
    governing_reason: "A09 no_new_architecture_decision_in_summary: is_proposed_decision=true on one existing architecture_facts record is the exact governing raw-source condition (deliveryModel.ts:258-259). validateDeliveryInput fail-closes it to NEW_ARCHITECTURE_DECISION -> BLOCKED -> package:null before the proposed decision can enter an accepted architecture summary. GATE_CLASS per brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md §3/§7, backed by unsafe counter UC13_new_architecture_decision_introduced (erratum §4) and canonical negative fixture N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER.",
    source_family: "input",
    governing_paths: ["input.architecture_facts.0.is_proposed_decision"],
    mutate: (s) => { afBy(s, "af-model").is_proposed_decision = true; },
  },
  A10: {
    owned_fact: "verification_evidence[ev-build].subject_ref",
    governing_reason: "A10 steps_evidence_backed observes setup_and_run.map([step_id, evidence_refs, optional]); ev-build is the PASS evidence bound to the required build step by subject_ref (buildSetup deliveryModel.ts:405-407).",
    source_family: "input",
    governing_paths: ["input.verification_evidence.2.subject_ref"],
    mutate: (s) => { veBy(s, "ev-build").subject_ref = "script:build-probe"; },
  },
  A11: {
    owned_fact: "repository_facts[rf-cmd-build].precondition_refs",
    governing_reason: "A11 preconditions_and_expected_signals observes non-optional steps [step_id, expected_signal>0, precondition_refs]; precondition_refs is the named property (buildSetup deliveryModel.ts:413).",
    source_family: "input",
    governing_paths: ["input.repository_facts.5.precondition_refs"],
    mutate: (s) => { const f = rfBy(s, "rf-cmd-build"); f.precondition_refs = [...(f.precondition_refs ?? []), "pre:probe-a11"]; },
  },
  A12: {
    owned_fact: "repository_facts[rf-cmd-test].value",
    governing_reason: "A12 no_invented_token: an undeclared :port token in a command value is the governing prohibited condition; guardInventedTokens fail-closes to INVENTED_PORT -> BLOCKED (deliveryModel.ts:287-290) before an invented token can reach an accepted setup step.",
    source_family: "input",
    governing_paths: ["input.repository_facts.6.value"],
    mutate: (s) => { rfBy(s, "rf-cmd-test").value = "BRAIN_LOG_LEVEL=$BRAIN_LOG_LEVEL npm test --port 9137"; },
  },
  A13: {
    owned_fact: "demo_surface.exists",
    governing_reason: "A13 demo_surface_exists: demo_surface.exists=false is the exact governing condition; buildDemoSubSteps fail-closes to DEMO_SURFACE_DOES_NOT_EXIST -> BLOCKED (deliveryModel.ts:308).",
    source_family: "input",
    governing_paths: ["input.demo_surface.exists"],
    mutate: (s) => { mi(s).demo_surface.exists = false; },
  },
  A14: {
    owned_fact: "demo_surface.steps[ds-happy].action_ref",
    governing_reason: "A14 step_action_result_evidence_complete observes per-step [step_id, action>0, result>0, evidence_refs]; emptying ds-happy.action_ref exercises action completeness (buildDemo deliveryModel.ts:443).",
    source_family: "input",
    governing_paths: ["input.demo_surface.steps.0.action_ref"],
    mutate: (s) => { dsBy(s, "ds-happy").action_ref = ""; },
  },
  A15: {
    owned_fact: "demo_surface.steps[ds-happy].fallback_ref",
    governing_reason: "A15 fallback_or_stop_condition_truthful observes per-step [step_id, fallback>0] + coverage.demo_steps_with_fallback; ds-happy.fallback_ref is the named property (buildDemo deliveryModel.ts:446).",
    source_family: "input",
    governing_paths: ["input.demo_surface.steps.0.fallback_ref"],
    mutate: (s) => { dsBy(s, "ds-happy").fallback_ref = ""; },
  },
  A16: {
    owned_fact: "policy.suppress_limitation_ids",
    governing_reason: "A16 material_limitations_present observes pkg.limitations ids; policy.suppress_limitation_ids is the mechanism that removes a limitation from the register (buildLimitations deliveryModel.ts:453-455).",
    source_family: "input",
    governing_paths: ["input.policy.suppress_limitation_ids"],
    mutate: (s) => { reqTarget(mi(s).policy, "input.policy").suppress_limitation_ids = ["lim-crlf"]; },
  },
  A17: {
    owned_fact: "limitations[lim-stdin].status",
    governing_reason: "A17 unverified_unknown_explicit observes limitations with status UNVERIFIED|DEFERRED; lim-stdin.status is the named property.",
    source_family: "input",
    governing_paths: ["input.limitations.1.status"],
    mutate: (s) => { lfBy(s, "lim-stdin").status = "KNOWN"; },
  },
  A18: {
    owned_fact: "limitations[lim-crlf].severity",
    governing_reason: "A18 severity_impact_provenance_preserved observes per-limitation [limitation_id, severity, impact>0, source_refs]; severity is the named property.",
    source_family: "input",
    governing_paths: ["input.limitations.0.severity"],
    mutate: (s) => { lfBy(s, "lim-crlf").severity = "MEDIUM"; },
  },
  A19: {
    owned_fact: "next_step_candidates[ns-fixtures].status",
    governing_reason: "A19 status_labeled observes per-next-step [next_step_id, status, priority, dep>0]; status is the label the atomic names (buildNextSteps deliveryModel.ts:474).",
    source_family: "input",
    governing_paths: ["input.next_step_candidates.1.status"],
    mutate: (s) => { nfBy(s, "ns-fixtures").status = "PROPOSED"; },
  },
  A20: {
    owned_fact: "next_step_candidates[ns-deploy].status",
    governing_reason: "A20 s13r_deployment_boundary observes the status of S13R/deployment-matching next steps; ns-deploy is the S13R deployment next step and its status label is exactly the boundary property (kept proposed, not pulled forward).",
    source_family: "input",
    governing_paths: ["input.next_step_candidates.0.status"],
    mutate: (s) => { nfBy(s, "ns-deploy").status = "DEFERRED"; },
  },
  A21: {
    owned_fact: "architecture_facts[af-quality].value (S14 marker)",
    governing_reason: "A21 s14_s15_boundary: an architecture fact carrying S14 capability/MCP work is the governing prohibited condition; preserveStageBoundaries fail-closes to S14_CAPABILITY_PULLED_FORWARD -> BLOCKED (deliveryModel.ts:349) before an S14 pull-forward can reach the accepted summary.",
    source_family: "input",
    governing_paths: ["input.architecture_facts.1.value"],
    mutate: (s) => { afBy(s, "af-quality").value = "the module ships an mcp server and a connector binding"; },
  },
  A22: {
    owned_fact: "verification_evidence[ev-typecheck].evidence_id",
    governing_reason: "A22 resolve_and_deduplicate observes [evidence_index evidence_ids, evidence_refs_total]; the evidence_id is what buildEvidenceIndex resolves, deduplicates and orders (deliveryModel.ts:492-494).",
    source_family: "input",
    governing_paths: ["input.verification_evidence.0.evidence_id"],
    mutate: (s) => { veBy(s, "ev-typecheck").evidence_id = "ev-typecheck-probe"; },
  },
  A23: {
    owned_fact: "verification_evidence(append ev-probe-fail FAIL for subject repo)",
    governing_reason: "A23 conflict_precedence_without_erasure observes [provenance.conflict_notes, coverage.evidence_conflicts, EVIDENCE_CONFLICT warnings]; appending one FAIL evidence for a subject that already has a PASS is the exact same-subject conflict detectEvidenceConflicts records (deliveryModel.ts:521-524).",
    source_family: "input",
    governing_paths: ["input.verification_evidence.5"],
    mutate: (s) => {
      reqTarget(mi(s).verification_evidence, "input.verification_evidence").push({
        evidence_id: "ev-probe-fail", kind: "TEST", subject_ref: "repo", revision_ref: "rev:abc123def456",
        status: "FAIL", summary_ref: "sum:probe", source_ref: "src:ci",
      });
    },
  },
  A24: {
    owned_fact: "delivery_identity.baseline_revision_ref",
    governing_reason: "A24 revision_and_source_kind_complete observes [provenance.revision_ref, provenance.source_kinds, provenance.baseline_revision_ref]; baseline_revision_ref is a named provenance completeness field (buildProvenance deliveryModel.ts:506).",
    source_family: "input",
    governing_paths: ["input.delivery_identity.baseline_revision_ref"],
    mutate: (s) => { mi(s).delivery_identity.baseline_revision_ref = "rev:probe-a24bbbbb"; },
  },
  A25: {
    owned_fact: "demo_surface.steps[ds-failure].action_ref (secret bearer token)",
    governing_reason: "A25 no_secret_or_raw_sensitive_material: a bearer token value in a raw-source field is the governing prohibited condition; validateDeliveryInput fail-closes on SECRET_MATERIAL -> package:null (deliveryModel.ts:147,194) before the secret can reach any accepted output. Same payload family as negative fixture N34.",
    source_family: "input",
    governing_paths: ["input.demo_surface.steps.1.action_ref"],
    mutate: (s) => { dsBy(s, "ds-failure").action_ref = "action:call with header Authorization: Bearer abcdefghijklmnopqrstuvwx"; },
  },
  A26: {
    owned_fact: "repository_facts[rf-cmd-build].value (undeclared env variable)",
    governing_reason: "A26 secret_variable_names_only_when_approved: an undeclared $ENV name in a command value is the governing prohibited condition; guardInventedTokens fail-closes on INVENTED_ENV_VARIABLE -> BLOCKED (deliveryModel.ts:284) before an unapproved variable name can reach an accepted setup step. Same condition as negative fixture N12.",
    source_family: "input",
    governing_paths: ["input.repository_facts.5.value"],
    mutate: (s) => { rfBy(s, "rf-cmd-build").value = "npm run build $UNDECLARED_PROBE_VAR"; },
  },
  A27: {
    owned_fact: "limitations[lim-crlf].impact (raw stack trace)",
    governing_reason: "A27 no_raw_log_prompt_tool_or_private_payload: a raw stack trace in a raw-source field is the governing prohibited condition; validateDeliveryInput fail-closes on RAW_LOG_MATERIAL -> package:null (deliveryModel.ts:148,194) before the raw log can reach collectStrings(decision). A27's observation provably does not move (governing_changed=false). Same payload family as negative fixture N36.",
    source_family: "input",
    governing_paths: ["input.limitations.0.impact"],
    mutate: (s) => { lfBy(s, "lim-crlf").impact = "provider dump:\n    at Object.run (/srv/app/x.js:44:19)\n    at main (/srv/app/y.js:2:3)"; },
  },
  A28: {
    owned_fact: "audit.input_snapshot_after",
    governing_reason: "A28 output_and_ordering observes [snapshot_before===snapshot_after, buildDeliveryPackage determinism]; the input-stability audit fact is the named property.",
    source_family: "audit",
    governing_paths: ["audit.input_snapshot_after"],
    mutate: (s) => { s.audit.input_snapshot_after = `${reqTarget(s.audit.input_snapshot_after, "audit.input_snapshot_after")}::probe`; },
  },
  A29: {
    owned_fact: "audit.candidate_gate_valid",
    governing_reason: "A29 actual_candidate_and_no_self_certification observes [candidate_gate_valid, !self_certified, !SELF_CERT_MARKER]; candidate_gate_valid is the named property.",
    source_family: "audit",
    governing_paths: ["audit.candidate_gate_valid"],
    mutate: (s) => { s.audit.candidate_gate_valid = false; },
  },
  A30: {
    owned_fact: "audit.core_or_contract_changed",
    governing_reason: "A30 core_agentdef_dependencies_prior_contracts observes [!core_or_contract_changed, !provider_fixture_or_arm_branching, !hidden_io_or_clock]; core_or_contract_changed is the named property.",
    source_family: "audit",
    governing_paths: ["audit.core_or_contract_changed"],
    mutate: (s) => { s.audit.core_or_contract_changed = true; },
  },
};

/**
 * Erratum §5.2 STRUCTURAL_DEPENDENCY closures. `also_changes` is the EXACT
 * measured cross set (siblings only, governing Axx excluded). The classifier
 * requires set-equality with the measured cross — not subset, no superset, no
 * dimension waiver. Each is a real `buildDeliveryPackage` producer fan-out and
 * must be control-plane-approved before a fresh verifier treats it as PASS.
 */
export const DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES: Partial<
  Record<DeliveryAtomicId, { also_changes: DeliveryAtomicId[]; forcing: string }>
> = {
  A01: {
    also_changes: ["A24"],
    forcing: "buildProvenance threads delivery_identity.revision_ref into pkg.provenance.revision_ref (deliveryModel.ts:505); A24 observes pkg.provenance.revision_ref. Nothing else reads the delivered revision spine, so the cross is exactly {A24}.",
  },
  A03: {
    also_changes: ["A05"],
    forcing: "A03 and A05 both read pkg.executive_summary.delivered claim_status. rf-feat-builder ACCEPTED->REPORTED moves it IMPLEMENTED->AVAILABLE_NOT_VERIFIED, which enters A05's AVAILABLE_NOT_VERIFIED-subjects list (buildClaims/deriveClaimStatus deliveryModel.ts:371-372). claims_with_evidence is unchanged (both statuses yield evidence_refs:[]), so A04 does not move; provenance.source_kinds already contains repository_fact:REPORTED (rf-feat-reporter), so A24 does not move.",
  },
  A05: {
    also_changes: ["A03", "A24"],
    forcing: "rf-feat-reporter is the ONLY REPORTED fact in baseInput. REPORTED->ACCEPTED (a) moves its claim_status AVAILABLE_NOT_VERIFIED->IMPLEMENTED in the shared claim table A03 reads, and (b) deletes `repository_fact:REPORTED` from the deduped provenance.source_kinds set (buildProvenance deliveryModel.ts:499-503) that A24 reads. Asymmetry proof that {A03,A24} is minimal: A03's own probe adds a REPORTED that already exists, so its source_kinds set is unchanged and A24 stays put. No other lever moves A05 (UNKNOWN is unreachable via the 3-value confidence enum; roadmap source_ref is A06; adding PASS evidence drags in A04 and A22).",
  },
  A06: {
    also_changes: ["A03"],
    forcing: "A06 and A03 both read the shared claim table. rf-feat-builder source_ref -> roadmap token routes deriveClaimStatus to DEFERRED (deliveryModel.ts:368-369): A06's DEFERRED-subjects list and A03's claim_status row for feat:builder. confidence is untouched so source_kinds and A24 do not move.",
  },
  A16: {
    also_changes: ["A18"],
    forcing: "A16 and A18 both .map pkg.limitations. Suppressing lim-crlf removes it from the register (buildLimitations deliveryModel.ts:453-455): A16's id list and A18's per-limitation tuple both lose the row. lim-crlf is LOW/KNOWN so MATERIAL_LIMITATION_HIDDEN (HIGH/KNOWN only) does not fire and A17 (UNVERIFIED|DEFERRED only) is unaffected.",
  },
  A20: {
    also_changes: ["A19"],
    forcing: "A19 observes every next step's status; A20 observes the status of S13R/deployment-matching next steps. ns-deploy is S13R-matching, so relabelling its status (buildNextSteps deliveryModel.ts:474) necessarily moves both. A non-S13R next step (A19's own probe on ns-fixtures) moves only A19, proving {A19} is exact-and-minimal for the ns-deploy mutation.",
  },
  A23: {
    also_changes: ["A22"],
    forcing: "Inducing a same-subject PASS+FAIL conflict (detectEvidenceConflicts deliveryModel.ts:521-524) requires appending one verification_evidence record; buildEvidenceIndex then lists that new evidence_id, which A22 reads (deliveryModel.ts:492-494). evidence_refs_total also moves, but that is A22's own tuple element, so the cross is exactly {A22}.",
  },
};

/**
 * Erratum §5.3 GATE_CLASS invariants. The atomic's semantically governing
 * prohibited raw-source condition is fail-closed BEFORE the derived package
 * observation could carry it. Each requires (measured by the probe + asserted by
 * the S13Q test): the named `blocker` fires; `package === null` (no leak into an
 * accepted artifact); the `unsafe_counter` is independently fireable; the
 * `negative_fixture` exercises the same condition; no derived-result mutation.
 * Control-plane must explicitly accept each Axx as gate-class.
 */
export const DELIVERY_ATOMIC_GATE_CLASS: Partial<
  Record<DeliveryAtomicId, { blocker: string; unsafe_counter: string; negative_fixture: string; forcing: string }>
> = {
  A04: {
    blocker: "UNSUPPORTED_VERIFIED_CLAIM",
    unsafe_counter: "UC01_unsupported_implemented_or_verified_claim",
    negative_fixture: "N06_UNSUPPORTED_VERIFIED_CLAIM",
    forcing: "ev-test-parser FAIL removes the only PASS binding for the one VERIFIED claim; validateDeliveryInput pushes UNSUPPORTED_VERIFIED_CLAIM (deliveryModel.ts:233) -> package:null before A04's claims_with_evidence element could carry an unbacked VERIFIED claim.",
  },
  A09: {
    blocker: "NEW_ARCHITECTURE_DECISION",
    unsafe_counter: "UC13_new_architecture_decision_introduced",
    negative_fixture: "N08_ARCHITECTURE_SUMMARY_INTRODUCES_NEW_PROVIDER",
    forcing: "architecture_facts[af-model].is_proposed_decision=true fail-closes to NEW_ARCHITECTURE_DECISION (deliveryModel.ts:258-267) -> package:null before the proposed architecture decision could enter A09's accepted architecture_summary observation. af-model.value carries no database/agent keyword so the decision classifies as a new 'provider' decision, the same governing class as N08. S13Q_ISOLATION_ERRATUM_2 §3/§7.",
  },
  A12: {
    blocker: "INVENTED_PORT",
    unsafe_counter: "UC02_invented_setup_command_or_environment_detail",
    negative_fixture: "N13_INVENTED_PORT",
    forcing: "An undeclared :port token in a command value fail-closes to INVENTED_PORT (deliveryModel.ts:287-290) -> package:null before the invented token could reach A12's accepted command list.",
  },
  A13: {
    blocker: "DEMO_SURFACE_DOES_NOT_EXIST",
    unsafe_counter: "UC03_nonexistent_demo_surface_or_result",
    negative_fixture: "N17_DEMO_SURFACE_DOES_NOT_EXIST",
    forcing: "demo_surface.exists=false fail-closes to DEMO_SURFACE_DOES_NOT_EXIST (deliveryModel.ts:308) -> package:null before A13's demo_script.length element could describe a nonexistent surface.",
  },
  A21: {
    blocker: "S14_CAPABILITY_PULLED_FORWARD",
    unsafe_counter: "UC09_future_stage_pull_forward",
    negative_fixture: "N28_S14_CAPABILITY_MCP_PULLED_FORWARD",
    forcing: "An architecture fact carrying S14 capability/MCP work fail-closes to S14_CAPABILITY_PULLED_FORWARD (deliveryModel.ts:349) -> package:null before A21's S14/S15-filtered next-step list could carry the pull-forward.",
  },
  A25: {
    blocker: "SECRET_MATERIAL",
    unsafe_counter: "UC06_secret_or_raw_sensitive_material_emitted",
    negative_fixture: "N34_AUTH_HEADER_VALUE_IN_DEMO",
    forcing: "A bearer token value in a raw-source field fail-closes on SECRET_MATERIAL (deliveryModel.ts:147,194) -> package:null. SECRET_MATERIAL's detail is generic — the secret value never appears in any part of the decision.",
  },
  A26: {
    blocker: "INVENTED_ENV_VARIABLE",
    unsafe_counter: "UC02_invented_setup_command_or_environment_detail",
    negative_fixture: "N12_INVENTED_ENV_VARIABLE",
    forcing: "An undeclared $ENV name in a command value fail-closes on INVENTED_ENV_VARIABLE (deliveryModel.ts:284) -> package:null. The variable NAME appears only in the fail-closed rejection reason (blockers[].detail), never in an accepted package (package===null); contrast A25 where the secret VALUE is never echoed at all.",
  },
  A27: {
    blocker: "RAW_LOG_MATERIAL",
    unsafe_counter: "UC06_secret_or_raw_sensitive_material_emitted",
    negative_fixture: "N36_RAW_LOG_OR_PROVIDER_ERROR_COPIED",
    forcing: "A raw stack trace in a raw-source field fail-closes on RAW_LOG_MATERIAL (deliveryModel.ts:148,194) -> package:null before it could reach collectStrings(decision). A27's observation provably does not move (erratum §5.3 final paragraph: governing_changed=false is permitted for a fail-closed gate).",
  },
};

/**
 * Erratum 1 §6 / §14 remaining-semantic-gap register. An atomic listed here has
 * NO valid STRICT / STRUCTURAL_DEPENDENCY / GATE_CLASS path under the errata and
 * is reported honestly for control-plane ruling — never hidden as another class.
 *
 * EMPTY after S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md: the sole prior
 * entry A09 is resolved — Erratum 2 §3/§4 adds unsafe counter
 * UC13_new_architecture_decision_introduced and rules A09 = GATE_CLASS, so A09
 * now lives in DELIVERY_ATOMIC_GATE_CLASS. The map is retained (not deleted) so a
 * future gap can be registered without re-plumbing consumers.
 */
export const DELIVERY_ATOMIC_UNRESOLVED: Partial<Record<DeliveryAtomicId, { reason: string }>> = {};

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

/**
 * REJECTED isolation mechanism (candidate cf49b45). Directly overwrites an
 * already-derived `expected_observation` cell — it never mutates an owned raw
 * source field and never recomputes an observer. Retained and exported ONLY so
 * `isValidSourceFactIsolationEvidence` can mechanically prove it invalid.
 */
export function mutateDeliverySourceFact(facts: DeliverySourceFacts, id: DeliveryAtomicId): void {
  facts[id] = { ...facts[id], expected_observation: { isolation_probe_for: id } };
}

// ---------------------------------------------------------------------------
// One-governing-source isolation probe
// ---------------------------------------------------------------------------

/** Deep JSON diff → dot-paths (array indices as numeric segments) where two values differ. */
export function jsonDiffPaths(a: unknown, b: unknown, prefix = ""): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return [prefix || "<root>"];
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  const out: string[] = [];
  for (const k of keys) {
    const pa = (a as Record<string, unknown>)[k];
    const pb = (b as Record<string, unknown>)[k];
    if (JSON.stringify(pa) === JSON.stringify(pb)) continue;
    out.push(...jsonDiffPaths(pa, pb, prefix ? `${prefix}.${k}` : k));
  }
  return out.length ? out : [prefix || "<root>"];
}

const FORBIDDEN_SOURCE_PATH_SEGMENTS = [
  "decision", "package", "coverage", "blockers", "warnings",
  "expected_observation", "correct", "actual_observation", "field_family", "evidence",
] as const;

/** True only when every diff path is a real raw-source field (under `input.`/`audit.`, no derived segment). */
function pathsAreRawSourceOnly(paths: readonly string[]): boolean {
  if (paths.length === 0) return false;
  const forbidden: readonly string[] = FORBIDDEN_SOURCE_PATH_SEGMENTS;
  return paths.every((p: string) => {
    const segs = p.split(".");
    if (segs[0] !== "input" && segs[0] !== "audit") return false;
    return !segs.some((seg: string) => forbidden.includes(seg));
  });
}

/** The one fact-record prefix a raw-source diff path belongs to (erratum §6 one-fact rule). */
export function deliveryIsolationFactRecord(path: string): string {
  const segs = path.split(".");
  if (segs[0] === "audit") return "audit";
  if (segs[0] !== "input") return segs[0] || "<root>";
  const out: string[] = [segs[0], segs[1] ?? ""];
  let i = 2;
  if (segs[i] !== undefined && /^\d+$/.test(segs[i])) { out.push(segs[i]); i += 1; }
  if (segs[i] === "steps" && segs[i + 1] !== undefined && /^\d+$/.test(segs[i + 1])) { out.push("steps", segs[i + 1]); }
  return out.join(".");
}

/** Erratum §8.3: measured raw-source paths must conform to exactly the declared governing paths. */
function pathsConformToDeclared(measured: readonly string[], declared: readonly string[]): boolean {
  if (measured.length === 0 || declared.length === 0) return false;
  const hit = (p: string, g: string) => p === g || p.startsWith(`${g}.`);
  return measured.every((p) => declared.some((g) => hit(p, g))) && declared.every((g) => measured.some((p) => hit(p, g)));
}

export interface DeliveryAtomicIsolationProbe {
  id: DeliveryAtomicId;
  owned_fact: string;
  source_family: "input" | "audit";
  /** declared raw-source dot-paths the mutation is expected to touch */
  governing_paths: string[];
  /** the governing atomic's observation moved */
  governing_changed: boolean;
  /** every atomic whose observation moved (governing + siblings) */
  changed: DeliveryAtomicId[];
  /** siblings that moved (changed minus id) */
  cross: DeliveryAtomicId[];
  /** dot-paths that differ between the frozen shared raw source and the mutated clone */
  mutated_field_paths: string[];
  /** distinct fact-record prefixes among `mutated_field_paths` (erratum §6: must be exactly 1) */
  mutated_fact_records: string[];
  single_fact_record: boolean;
  /** measured paths conform to exactly `governing_paths` (erratum §8.3) */
  paths_conform: boolean;
  /** the real `buildDeliveryPackage` produced a different canonical decision (JSON) */
  producer_reran: boolean;
  original_source_unchanged: boolean;
  original_decision_unchanged: boolean;
  blocked: boolean;
  /** the rerun package is null (no accepted artifact) — the GATE_CLASS no-leak proof */
  accepted_package_null: boolean;
  /** blocker codes on the rerun decision */
  blockers: string[];
}

function runDeliveryIsolationProbe(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit,
  mutate: (src: DeliveryAtomicRawSource) => void,
  ownedFact: string,
  sourceFamily: "input" | "audit",
  governingPaths: readonly string[],
): DeliveryAtomicIsolationProbe {
  const origSrc = deliveryAtomicRawSource(input, audit);
  const origSrcJSON = JSON.stringify(origSrc);
  const origDecision = buildDeliveryPackage(origSrc.input);
  const origDecisionJSON = JSON.stringify(origDecision);
  const origObs: Record<string, string> = {};
  for (const k of DELIVERY_ATOMIC_IDS)
    origObs[k] = JSON.stringify(observeAtomic(k, origSrc.input, origDecision, origSrc.audit));

  const mut = structuredClone(origSrc);
  mutate(mut);
  const mutDecision = buildDeliveryPackage(mut.input);
  const mutObs: Record<string, string> = {};
  for (const k of DELIVERY_ATOMIC_IDS)
    mutObs[k] = JSON.stringify(observeAtomic(k, mut.input, mutDecision, mut.audit));

  const changed = DELIVERY_ATOMIC_IDS.filter((k) => origObs[k] !== mutObs[k]);
  const governing_changed = changed.includes(id);
  const cross = changed.filter((k) => k !== id);
  const mutated_field_paths = jsonDiffPaths(origSrc, mut);
  const mutated_fact_records = [...new Set(mutated_field_paths.map(deliveryIsolationFactRecord))];
  // §3: an audit-only mutation does not rerun the producer to a new JSON result.
  const producer_reran = JSON.stringify(mutDecision) !== origDecisionJSON;

  return {
    id,
    owned_fact: ownedFact,
    source_family: sourceFamily,
    governing_paths: [...governingPaths],
    governing_changed,
    changed: [...changed],
    cross,
    mutated_field_paths,
    mutated_fact_records,
    single_fact_record: mutated_fact_records.length === 1,
    paths_conform: pathsConformToDeclared(mutated_field_paths, governingPaths),
    producer_reran,
    original_source_unchanged: JSON.stringify(origSrc) === origSrcJSON,
    original_decision_unchanged: JSON.stringify(origDecision) === origDecisionJSON,
    blocked: mutDecision.status === "BLOCKED",
    accepted_package_null: mutDecision.package === null,
    blockers: (mutDecision.blockers ?? []).map((b) => b.code),
  };
}

/**
 * One-governing-source causal isolation for one atomic. Freeze ONE shared
 * detached raw `{ input, audit }` model; run the real `buildDeliveryPackage` and
 * compute all 30 observations via the one real `observeAtomic`. Clone the shared
 * raw source, run `DELIVERY_ATOMIC_OWNED_SOURCE[id].mutate` (exactly one
 * governing fact), rerun the real producer, recompute all 30 observations, diff.
 */
export function probeDeliveryAtomicSourceFactIsolation(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicIsolationProbe {
  const owned = DELIVERY_ATOMIC_OWNED_SOURCE[id];
  return runDeliveryIsolationProbe(id, input, audit, owned.mutate, owned.owned_fact, owned.source_family, owned.governing_paths);
}

/**
 * Erratum §5. STRICT: governing moved, zero cross. STRUCTURAL_DEPENDENCY:
 * governing moved and `cross` SET-EQUALS the declared `also_changes` (exact, not
 * subset). GATE_CLASS: the declared blocker fired, `package===null`. FAIL:
 * anything else — disturbed shared source/decision, a derived/non-source diff
 * path, >1 fact record (erratum §8.4), measured paths not conforming to the
 * declared governing paths (erratum §8.3), no real producer rerun, a
 * non-gate-class atomic that fail-closed, or an undeclared/over-broad cross.
 */
export function classifyDeliveryAtomicIsolation(
  p: DeliveryAtomicIsolationProbe,
): "STRICT" | "STRUCTURAL_DEPENDENCY" | "GATE_CLASS" | "FAIL" {
  if (!p.original_source_unchanged) return "FAIL";
  if (!p.original_decision_unchanged) return "FAIL";
  if (!pathsAreRawSourceOnly(p.mutated_field_paths)) return "FAIL"; // erratum §8.1 / §8.2
  if (p.mutated_fact_records.length !== 1) return "FAIL"; // erratum §8.4
  if (!p.paths_conform) return "FAIL"; // erratum §8.3
  if (!p.producer_reran && p.source_family !== "audit") return "FAIL";

  const gc = DELIVERY_ATOMIC_GATE_CLASS[p.id];
  if (gc) {
    return p.blocked && p.accepted_package_null && p.blockers.includes(gc.blocker) ? "GATE_CLASS" : "FAIL";
  }

  // A non-gate-class atomic that fail-closes has no isolation class (e.g. A09).
  if (p.blocked) return "FAIL";

  if (p.governing_changed && p.cross.length === 0) return "STRICT";

  const dep = DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES[p.id];
  if (p.governing_changed && dep && dep.also_changes.length > 0) {
    const declared = [...dep.also_changes].sort().join(",");
    const measured = [...p.cross].sort().join(",");
    if (declared === measured) return "STRUCTURAL_DEPENDENCY";
  }
  return "FAIL";
}

/**
 * Mechanical anti-tautology predicate. Accepts a probe only when every mutated
 * field path is a real raw-source field AND its classification is not FAIL.
 */
export function isValidSourceFactIsolationEvidence(p: DeliveryAtomicIsolationProbe): boolean {
  if (!pathsAreRawSourceOnly(p.mutated_field_paths)) return false;
  return classifyDeliveryAtomicIsolation(p) !== "FAIL";
}

/**
 * Reconstructs the REJECTED cf49b45 isolation action — a direct
 * `expected_observation` overwrite via `mutateDeliverySourceFact` — as a
 * probe-shaped record whose diff path carries the `expected_observation`
 * segment, so `isValidSourceFactIsolationEvidence` mechanically rejects it (erratum §8.1).
 */
export function legacyExpectedObservationMutationEvidence(
  input: DeliveryDocumentationDemoInput,
  id: DeliveryAtomicId,
): DeliveryAtomicIsolationProbe {
  const facts = deriveDeliverySourceFacts(input);
  const before = structuredClone(facts[id]);
  mutateDeliverySourceFact(facts, id);
  const mutated_field_paths = jsonDiffPaths(before, facts[id]);
  return {
    id,
    owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
    source_family: DELIVERY_ATOMIC_OWNED_SOURCE[id].source_family,
    governing_paths: [...DELIVERY_ATOMIC_OWNED_SOURCE[id].governing_paths],
    governing_changed: true,
    changed: [id],
    cross: [],
    mutated_field_paths,
    mutated_fact_records: [...new Set(mutated_field_paths.map(deliveryIsolationFactRecord))],
    single_fact_record: true,
    paths_conform: false,
    producer_reran: false,
    original_source_unchanged: true,
    original_decision_unchanged: true,
    blocked: false,
    accepted_package_null: false,
    blockers: [],
  };
}

/**
 * Reconstructs the REJECTED 1782a16 isolation action — a direct overwrite of an
 * already-derived `decision.package` / `coverage` / `blockers` field — as a
 * probe-shaped record whose diff paths carry `decision` segments, so
 * `isValidSourceFactIsolationEvidence` rejects it (erratum §8.2).
 */
export function legacyDerivedDecisionMutationEvidence(
  input: DeliveryDocumentationDemoInput,
  id: DeliveryAtomicId,
): DeliveryAtomicIsolationProbe {
  const before = { input, decision: buildDeliveryPackage(input) };
  const after = structuredClone(before);
  if (after.decision.package)
    after.decision.package.executive_summary.audience = `${after.decision.package.executive_summary.audience}::LEGACY_DERIVED_PROBE`;
  after.decision.coverage = { ...after.decision.coverage, claims_with_evidence: after.decision.coverage.claims_with_evidence + 1 };
  after.decision.blockers = [...after.decision.blockers, { code: "LEGACY_DERIVED_PROBE", detail: "direct derived-decision overwrite" }];
  const mutated_field_paths = jsonDiffPaths(before, after);
  return {
    id,
    owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
    source_family: DELIVERY_ATOMIC_OWNED_SOURCE[id].source_family,
    governing_paths: [...DELIVERY_ATOMIC_OWNED_SOURCE[id].governing_paths],
    governing_changed: true,
    changed: [id],
    cross: [],
    mutated_field_paths,
    mutated_fact_records: [...new Set(mutated_field_paths.map(deliveryIsolationFactRecord))],
    single_fact_record: false,
    paths_conform: false,
    producer_reran: false,
    original_source_unchanged: true,
    original_decision_unchanged: true,
    blocked: false,
    accepted_package_null: false,
    blockers: [],
  };
}

/**
 * Erratum §8.3 regression. Reconstructs a semantically irrelevant tuple-mover:
 * the pre-erratum A03 probe renamed an unrelated KNOWN_NON_FEATURE subject_ref
 * (rf-nonfeat-deploy) only to shift A03's [subject_ref, claim_status] tuple,
 * without exercising claim-state derivation/precedence. It is a real single
 * raw-source field, so `pathsAreRawSourceOnly` passes — but its measured path
 * does not conform to A03's declared governing path, so `paths_conform` is false
 * and the classifier returns FAIL.
 */
export function legacyIrrelevantMoverEvidence(
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicIsolationProbe {
  return runDeliveryIsolationProbe(
    "A03",
    input,
    audit,
    (s) => { rfBy(s, "rf-nonfeat-deploy").subject_ref = "feat:deploy-probe"; },
    "LEGACY_irrelevant_tuple_mover(rf-nonfeat-deploy.subject_ref)",
    "input",
    DELIVERY_ATOMIC_OWNED_SOURCE.A03.governing_paths,
  );
}

/**
 * Erratum §8.4 regression. Reconstructs the pre-erratum A26 probe: it ADDED one
 * SAFE_ENV_VARIABLE_NAME repository_fact AND edited a second independent COMMAND
 * fact's value in the same probe. Both diffs are raw-source `input.` fields, so
 * `pathsAreRawSourceOnly` passes — but they land on two distinct fact records,
 * so `mutated_fact_records.length !== 1` and the classifier returns FAIL.
 */
export function legacyTwoFactEvidence(
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicIsolationProbe {
  return runDeliveryIsolationProbe(
    "A26",
    input,
    audit,
    (s) => {
      reqTarget(mi(s).repository_facts, "input.repository_facts").push({
        fact_id: "rf-env-probe", kind: "SAFE_ENV_VARIABLE_NAME", subject_ref: "PROBE_VAR", value: "PROBE_VAR",
        source_ref: "src:README.md", revision_ref: "rev:abc123def456", confidence: "ACCEPTED",
      });
      rfBy(s, "rf-cmd-build").value = "npm run build # ${PROBE_VAR}";
    },
    "LEGACY_two_independent_facts(add rf-env-probe + edit rf-cmd-build.value)",
    "input",
    DELIVERY_ATOMIC_OWNED_SOURCE.A26.governing_paths,
  );
}


// ---------------------------------------------------------------------------
// Unsafe counters UC01..UC13 (QC section unsafe_counters). UC13 is added by
// brain-bootstrap/specs/S13Q_ISOLATION_ERRATUM_2_A09_UNSAFE_COUNTER.md §4/§5;
// per erratum §5 the QC's "UC01..UC12" / "12 unsafe counters" / "12/12" is
// interpreted as "UC01..UC13" / "13 unsafe counters" / "13/13" for the complete
// gate. UC01..UC12 meanings are unchanged.
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
  /** Erratum 2 §4: each governing NEW_ARCHITECTURE_DECISION violation the real S13Q validation/canonical path produced. */
  UC13_new_architecture_decision_introduced: number;
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
    // Erratum 2 §4/§6: the governing NEW_ARCHITECTURE_DECISION violation as surfaced by the
    // real validateDeliveryInput/buildDeliveryPackage path onto decision.blockers (blockedResult,
    // deliveryModel.ts:106-107 / 258-267). Not a constant, fixture branch, or expected-map lookup.
    UC13_new_architecture_decision_introduced: Number(
      (decision.blockers ?? []).some((b) => b.code === "NEW_ARCHITECTURE_DECISION"),
    ),
  };
}
