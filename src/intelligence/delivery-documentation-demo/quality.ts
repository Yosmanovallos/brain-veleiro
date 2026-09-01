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
// Owned-source-fact isolation — ONE shared detached RAW `{ input, audit }`
// model upstream of `buildDeliveryPackage` (QC `source_fact_isolation`,
// semantic contract §21). Repair #3 (2026-09-01): rejected mechanisms were
//   - cf49b45: direct `expected_observation` overwrite
//   - 1782a16: per-atomic detached DERIVED-decision projections
// Neither mutated an underlying input/evidence fact and reran the real
// producer. This layer clones the shared raw source, mutates exactly one real
// `DeliveryDocumentationDemoInput` / explicit audit-evidence field, reruns the
// real `buildDeliveryPackage`, and recomputes ALL 30 observations via the one
// real `observeAtomic` predicate — never a per-atomic result clone.
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

/**
 * Per-atomic owned underlying fact + a mutation of exactly that one real field.
 * The 30 `owned_fact` labels are pairwise distinct; each `mutate` throws
 * `ISOLATION_TARGET_ABSENT:<path>` if its target is missing.
 */
export const DELIVERY_ATOMIC_OWNED_SOURCE: Record<
  DeliveryAtomicId,
  { owned_fact: string; source_family: "input" | "audit"; mutate: (src: DeliveryAtomicRawSource) => void }
> = {
  A01: { owned_fact: "delivery_identity.revision_ref", source_family: "input", mutate: (s) => { reqTarget(mi(s).delivery_identity, "input.delivery_identity"); mi(s).delivery_identity.revision_ref = "rev:probe-a01aaaaaa"; } },
  A02: { owned_fact: "delivery_identity.audience", source_family: "input", mutate: (s) => { reqTarget(mi(s).delivery_identity, "input.delivery_identity"); mi(s).delivery_identity.audience = "audience:probe-a02"; } },
  A03: { owned_fact: "repository_facts[rf-nonfeat-deploy].subject_ref", source_family: "input", mutate: (s) => { rfBy(s, "rf-nonfeat-deploy").subject_ref = "feat:deploy-probe"; } },
  A04: { owned_fact: "verification_evidence[ev-test-parser].subject_ref", source_family: "input", mutate: (s) => { veBy(s, "ev-test-parser").subject_ref = "feat:parser-detached"; } },
  A05: { owned_fact: "repository_facts[rf-feat-reporter].subject_ref", source_family: "input", mutate: (s) => { rfBy(s, "rf-feat-reporter").subject_ref = "feat:reporter-probe"; } },
  A06: { owned_fact: "repository_facts[rf-feat-builder].source_ref", source_family: "input", mutate: (s) => { rfBy(s, "rf-feat-builder").source_ref = "src:roadmap/builder-plan"; } },
  A07: { owned_fact: "architecture_facts[af-model].source_ref", source_family: "input", mutate: (s) => { afBy(s, "af-model").source_ref = "src:module/deliveryModel-probe.ts"; } },
  A08: { owned_fact: "architecture_facts[af-bound-core].value", source_family: "input", mutate: (s) => { afBy(s, "af-bound-core").value = "the module changes no Core surface (probe)"; } },
  A09: { owned_fact: "architecture_facts[kind=BOUNDARY] (removed)", source_family: "input", mutate: (s) => { const facts = reqTarget(mi(s).architecture_facts, "input.architecture_facts"); mi(s).architecture_facts = facts.filter((a) => a.kind !== "BOUNDARY"); } },
  A10: { owned_fact: "verification_evidence[ev-build].subject_ref", source_family: "input", mutate: (s) => { veBy(s, "ev-build").subject_ref = "script:build-probe"; } },
  A11: { owned_fact: "repository_facts[rf-cmd-build].precondition_refs", source_family: "input", mutate: (s) => { const f = rfBy(s, "rf-cmd-build"); f.precondition_refs = [...(f.precondition_refs ?? []), "pre:probe-a11"]; } },
  A12: { owned_fact: "repository_facts[rf-cmd-test].value", source_family: "input", mutate: (s) => { const f = rfBy(s, "rf-cmd-test"); f.value = `${f.value} # probe`; } },
  A13: { owned_fact: "demo_surface.steps (last removed)", source_family: "input", mutate: (s) => { const steps = reqTarget(mi(s).demo_surface.steps, "input.demo_surface.steps"); if (steps.length === 0) throw new Error("ISOLATION_TARGET_ABSENT:input.demo_surface.steps[last]"); mi(s).demo_surface.steps = steps.slice(0, -1); } },
  A14: { owned_fact: "demo_surface.steps[ds-happy].action_ref", source_family: "input", mutate: (s) => { dsBy(s, "ds-happy").action_ref = ""; } },
  A15: { owned_fact: "demo_surface.steps[ds-happy].fallback_ref", source_family: "input", mutate: (s) => { dsBy(s, "ds-happy").fallback_ref = ""; } },
  A16: { owned_fact: "policy.suppress_limitation_ids", source_family: "input", mutate: (s) => { reqTarget(mi(s).policy, "input.policy").suppress_limitation_ids = ["lim-crlf"]; } },
  A17: { owned_fact: "limitations[lim-stdin].status", source_family: "input", mutate: (s) => { lfBy(s, "lim-stdin").status = "KNOWN"; } },
  A18: { owned_fact: "limitations[lim-crlf].severity", source_family: "input", mutate: (s) => { lfBy(s, "lim-crlf").severity = "MEDIUM"; } },
  A19: { owned_fact: "next_step_candidates[ns-fixtures].priority", source_family: "input", mutate: (s) => { nfBy(s, "ns-fixtures").priority = "P0"; } },
  A20: { owned_fact: "next_step_candidates[ns-fixtures].summary", source_family: "input", mutate: (s) => { const n = nfBy(s, "ns-fixtures"); n.summary = `${n.summary} deploy step`; } },
  A21: { owned_fact: "next_step_candidates[ns-deploy].summary", source_family: "input", mutate: (s) => { const n = nfBy(s, "ns-deploy"); n.summary = `${n.summary} S14`; } },
  A22: { owned_fact: "verification_evidence[ev-typecheck].evidence_id", source_family: "input", mutate: (s) => { veBy(s, "ev-typecheck").evidence_id = "ev-typecheck-probe"; } },
  A23: { owned_fact: "verification_evidence (append ev-probe-fail FAIL for subject repo)", source_family: "input", mutate: (s) => { reqTarget(mi(s).verification_evidence, "input.verification_evidence").push({ evidence_id: "ev-probe-fail", kind: "TEST", subject_ref: "repo", revision_ref: "rev:abc123def456", status: "FAIL", summary_ref: "sum:probe", source_ref: "src:ci" }); } },
  A24: { owned_fact: "delivery_identity.baseline_revision_ref", source_family: "input", mutate: (s) => { reqTarget(mi(s).delivery_identity, "input.delivery_identity"); mi(s).delivery_identity.baseline_revision_ref = "rev:probe-a24bbbbb"; } },
  A25: { owned_fact: "repository_facts[rf-cmd-build].value (secret material)", source_family: "input", mutate: (s) => { rfBy(s, "rf-cmd-build").value = "TOKEN=sk-deadbeefdeadbeef01 npm run build"; } },
  A26: { owned_fact: "repository_facts[rf-env-probe] added + repository_facts[rf-cmd-build].value", source_family: "input", mutate: (s) => { reqTarget(mi(s).repository_facts, "input.repository_facts").push({ fact_id: "rf-env-probe", kind: "SAFE_ENV_VARIABLE_NAME", subject_ref: "PROBE_VAR", value: "PROBE_VAR", source_ref: "src:README.md", revision_ref: "rev:abc123def456", confidence: "ACCEPTED" }); rfBy(s, "rf-cmd-build").value = "npm run build # ${PROBE_VAR}"; } },
  A27: { owned_fact: "repository_facts[rf-feat-builder].value (overclaim demonstration)", source_family: "input", mutate: (s) => { rfBy(s, "rf-feat-builder").value = "this module is production-ready"; } },
  A28: { owned_fact: "audit.input_snapshot_after", source_family: "audit", mutate: (s) => { s.audit.input_snapshot_after = `${reqTarget(s.audit.input_snapshot_after, "audit.input_snapshot_after")}::probe`; } },
  A29: { owned_fact: "audit.candidate_gate_valid", source_family: "audit", mutate: (s) => { s.audit.candidate_gate_valid = false; } },
  A30: { owned_fact: "audit.core_or_contract_changed", source_family: "audit", mutate: (s) => { s.audit.core_or_contract_changed = true; } },
};

/**
 * Producer-forced structural dependencies (semantic contract §21). Each of
 * these 9 atomics governs its own observation but the canonical
 * `buildDeliveryPackage` necessarily co-moves a small, specific set of sibling
 * observations from the SAME source mutation — Part A §21 defines multiple
 * atomics over one package array / the revision spine. These are consequences,
 * not waivers; `also_changes` is the exact permitted cross set.
 */
export const DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES: Partial<
  Record<DeliveryAtomicId, { also_changes: DeliveryAtomicId[]; forcing: string }>
> = {
  A01: { also_changes: ["A24"], forcing: "buildProvenance (deliveryModel.ts:505 `revision_ref: id.revision_ref`) threads delivery_identity.revision_ref into pkg.provenance.revision_ref, which A24 also reads." },
  A04: { also_changes: ["A03"], forcing: "A03 observes the entire executive_summary.delivered [subject_ref,claim_status] table; claims_total/claims_with_evidence are pure functions of claim status (buildClaims/deriveClaimStatus deliveryModel.ts:360-383)." },
  A05: { also_changes: ["A03"], forcing: "same shared claim table; A05's UNKNOWN-count / AVAILABLE_NOT_VERIFIED-subjects are claim-status functions." },
  A06: { also_changes: ["A03"], forcing: "same shared claim table; A06's DEFERRED-subjects is a claim-status function." },
  A09: { also_changes: ["A07", "A08"], forcing: "architecture_summary.partial = components.length===0 || boundaries.length===0 (deliveryModel.ts:396); A07 observes components, A08 observes boundaries." },
  A13: { also_changes: ["A14", "A15"], forcing: "A13's demo_script.length element requires a demo-step add/remove, which moves the per-step tuples A14 and A15 observe (buildDemo deliveryModel.ts:422-450)." },
  A16: { also_changes: ["A18"], forcing: "A16 and A18 both .map the same pkg.limitations array and both read limitation_id (buildLimitations deliveryModel.ts:452-466)." },
  A23: { also_changes: ["A22"], forcing: "inducing a same-subject PASS+FAIL conflict (detectEvidenceConflicts deliveryModel.ts:513-527) requires growing the verification_evidence set, which A22's evidence-index observation reads." },
  A26: { also_changes: ["A12"], forcing: "A26 reads env-var tokens INSIDE pkg.setup_and_run command text that A12 also observes; A26's allApproved/noInlineSecretValue elements cannot flip without a validation block (INVENTED_ENV_VARIABLE deliveryModel.ts:285 / SECRET_MATERIAL)." },
};

/**
 * Package-level safety-gate invariants (A25, A27). No source mutation can move
 * these observations in isolation: `validateDeliveryInput` fail-closes on the
 * prohibited material BEFORE it reaches the producer, so the governing element
 * only exists on a blocked package (A25) or provably never moves (A27).
 * Verified by named negative fixtures + unsafe counters, not by isolation.
 */
export const DELIVERY_ATOMIC_GATE_CLASS: Partial<Record<DeliveryAtomicId, { forcing: string }>> = {
  A25: { forcing: "validateDeliveryInput short-circuits on SECRET_MATERIAL (deliveryModel.ts:147,194) -> package:null; A25's blocker-count element exists ONLY on a blocked package. Verified by negative fixtures N33/N34/N35 + UC06, not by source-fact isolation." },
  A27: { forcing: "forbidden material in input is caught by validateDeliveryInput (deliveryModel.ts:148-149 raw-log/raw-env, :254 overclaim) BEFORE it can reach collectStrings(decision); A27's observation provably never moves under any source mutation. Verified by N07/N35/N36 + UC05/UC06." },
};

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
 * `isValidSourceFactIsolationEvidence` can mechanically prove it invalid; it is
 * NOT a valid source-fact isolation probe. Use `probeDeliveryAtomicSourceFactIsolation`.
 */
export function mutateDeliverySourceFact(facts: DeliverySourceFacts, id: DeliveryAtomicId): void {
  facts[id] = { ...facts[id], expected_observation: { isolation_probe_for: id } };
}

// ---------------------------------------------------------------------------
// Owned-source-fact isolation probe (QC `source_fact_isolation`; contract §21)
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

export interface DeliveryAtomicIsolationProbe {
  id: DeliveryAtomicId;
  owned_fact: string;
  source_family: "input" | "audit";
  /** the governing atomic's observation moved */
  governing_changed: boolean;
  /** every atomic whose observation moved (governing + siblings) */
  changed: DeliveryAtomicId[];
  /** siblings that moved (changed minus id) */
  cross: DeliveryAtomicId[];
  /** dot-paths that differ between the frozen shared raw source and the mutated clone */
  mutated_field_paths: string[];
  /** the real `buildDeliveryPackage` produced a different canonical decision (JSON) */
  producer_reran: boolean;
  original_source_unchanged: boolean;
  original_decision_unchanged: boolean;
  blocked: boolean;
}

/**
 * Owned-source-fact isolation for one atomic. Freeze ONE shared detached raw
 * `{ input, audit }` model; run the real `buildDeliveryPackage` and compute all
 * 30 observations via the one real `observeAtomic`. Clone the shared raw source,
 * mutate exactly one real input/audit field (`DELIVERY_ATOMIC_OWNED_SOURCE[id]`),
 * rerun the real producer, recompute all 30 observations from that one rebuilt
 * decision, and diff. No per-atomic result clone; no `expected_observation` or
 * derived-`decision` mutation.
 */
export function probeDeliveryAtomicSourceFactIsolation(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicIsolationProbe {
  const origSrc = deliveryAtomicRawSource(input, audit);
  const origSrcJSON = JSON.stringify(origSrc);
  const origDecision = buildDeliveryPackage(origSrc.input);
  const origDecisionJSON = JSON.stringify(origDecision);
  const origObs: Record<string, string> = {};
  for (const k of DELIVERY_ATOMIC_IDS)
    origObs[k] = JSON.stringify(observeAtomic(k, origSrc.input, origDecision, origSrc.audit));

  const mut = structuredClone(origSrc);
  DELIVERY_ATOMIC_OWNED_SOURCE[id].mutate(mut);
  const mutDecision = buildDeliveryPackage(mut.input);
  const mutObs: Record<string, string> = {};
  for (const k of DELIVERY_ATOMIC_IDS)
    mutObs[k] = JSON.stringify(observeAtomic(k, mut.input, mutDecision, mut.audit));

  const changed = DELIVERY_ATOMIC_IDS.filter((k) => origObs[k] !== mutObs[k]);
  const governing_changed = changed.includes(id);
  const cross = changed.filter((k) => k !== id);
  const mutated_field_paths = jsonDiffPaths(origSrc, mut);
  // §3 text says `mutDecision !== origDecision`; those are always distinct object refs,
  // so the meaningful reading (and the one the classifier's audit-only exemption needs) is
  // JSON inequality — audit-only mutations do not rerun the producer to a new result.
  const producer_reran = JSON.stringify(mutDecision) !== origDecisionJSON;

  return {
    id,
    owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
    source_family: DELIVERY_ATOMIC_OWNED_SOURCE[id].source_family,
    governing_changed,
    changed: [...changed],
    cross,
    mutated_field_paths,
    producer_reran,
    original_source_unchanged: JSON.stringify(origSrc) === origSrcJSON,
    original_decision_unchanged: JSON.stringify(origDecision) === origDecisionJSON,
    blocked: mutDecision.status === "BLOCKED",
  };
}

/**
 * STRICT           — governing moved, zero cross.
 * STRUCTURAL_DEPENDENCY — governing moved; cross ⊆ the producer-forced `also_changes` set (§21).
 * GATE_CLASS        — A25 forced BLOCKED, or A27 provably un-movable.
 * FAIL             — anything else, or the shared raw source / canonical decision was disturbed,
 *                    or a diff path touched a derived / non-source segment.
 */
export function classifyDeliveryAtomicIsolation(
  p: DeliveryAtomicIsolationProbe,
): "STRICT" | "STRUCTURAL_DEPENDENCY" | "GATE_CLASS" | "FAIL" {
  if (!p.original_source_unchanged) return "FAIL";
  if (!p.original_decision_unchanged) return "FAIL";
  if (!pathsAreRawSourceOnly(p.mutated_field_paths)) return "FAIL";
  if (!p.producer_reran && p.source_family !== "audit") return "FAIL";

  if (DELIVERY_ATOMIC_GATE_CLASS[p.id]) {
    if (p.id === "A25" && p.blocked) return "GATE_CLASS";
    if (p.id === "A27" && !p.governing_changed && p.blocked) return "GATE_CLASS";
    return "FAIL";
  }

  if (p.governing_changed && p.cross.length === 0) return "STRICT";

  const dep = DELIVERY_ATOMIC_STRUCTURAL_DEPENDENCIES[p.id];
  if (p.governing_changed && dep && p.cross.every((k) => dep.also_changes.includes(k)))
    return "STRUCTURAL_DEPENDENCY";

  return "FAIL";
}

/**
 * Mechanical anti-tautology predicate. Accepts a probe (or probe-shaped record)
 * only when its classification is not FAIL AND every mutated field path is a
 * real raw-source field — never `decision` / `package` / `coverage` / `blockers`
 * / `warnings` / `expected_observation` / `correct` / `actual_observation`.
 */
export function isValidSourceFactIsolationEvidence(p: DeliveryAtomicIsolationProbe): boolean {
  if (!pathsAreRawSourceOnly(p.mutated_field_paths)) return false;
  return classifyDeliveryAtomicIsolation(p) !== "FAIL";
}

/**
 * Reconstructs the REJECTED cf49b45 isolation action — a direct
 * `expected_observation` overwrite via `mutateDeliverySourceFact` — as a
 * probe-shaped record whose diff path carries the `expected_observation`
 * segment, so `isValidSourceFactIsolationEvidence` mechanically rejects it.
 */
export function legacyExpectedObservationMutationEvidence(
  input: DeliveryDocumentationDemoInput,
  id: DeliveryAtomicId,
): DeliveryAtomicIsolationProbe {
  const facts = deriveDeliverySourceFacts(input);
  const before = structuredClone(facts[id]);
  mutateDeliverySourceFact(facts, id);
  return {
    id,
    owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
    source_family: DELIVERY_ATOMIC_OWNED_SOURCE[id].source_family,
    governing_changed: true,
    changed: [id],
    cross: [],
    mutated_field_paths: jsonDiffPaths(before, facts[id]),
    producer_reran: false,
    original_source_unchanged: true,
    original_decision_unchanged: true,
    blocked: false,
  };
}

/**
 * Reconstructs the REJECTED 1782a16 isolation action — a direct overwrite of an
 * already-derived `decision.package` / `coverage` / `blockers` field — as a
 * probe-shaped record whose diff paths carry `decision` / `package` / `coverage`
 * / `blockers` segments, so `isValidSourceFactIsolationEvidence` rejects it.
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
  return {
    id,
    owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
    source_family: DELIVERY_ATOMIC_OWNED_SOURCE[id].source_family,
    governing_changed: true,
    changed: [id],
    cross: [],
    mutated_field_paths: jsonDiffPaths(before, after),
    producer_reran: false,
    original_source_unchanged: true,
    original_decision_unchanged: true,
    blocked: false,
  };
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
