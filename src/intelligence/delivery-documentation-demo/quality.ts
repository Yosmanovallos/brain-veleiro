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
// Owned raw source-fact projection layer
// (QC `source_fact_isolation`; semantic contract §21)
//
// Each A01..A30 owns a detached, deep-cloned RAW projection of exactly the
// input / decision-section / audit fields its predicate reads. The real
// predicate body lives ONCE, in `observeAtomicFromSourceFact`, and is
// recomputed from that projection. `observeAtomic` is a thin wrapper that
// builds the projection from `(input, decision, audit)` and delegates — its
// output is byte-identical to the pre-refactor single switch, so
// `buildDeliveryPackage`, the candidate gate, `evaluateDeliveryAtomicObservations`
// A/B scoring, the unsafe counters and `planDeliveryDocumentationDemo` are
// unaffected.
// ---------------------------------------------------------------------------

type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

export interface DeliveryAtomicProjection {
  input: DeepMutable<Partial<DeliveryDocumentationDemoInput>>;
  decision: DeepMutable<Partial<DeliveryDocumentationDemoResult>>;
  audit: DeepMutable<Partial<DeliveryEvaluationAudit>>;
}

/** A detached raw slice owned by exactly one atomic. Note: no `expected_observation`. */
export interface DeliveryAtomicSourceFact {
  field_family: string;
  owned_fact: string;
  projection: DeliveryAtomicProjection;
}
export type DeliveryAtomicSourceFacts = Record<DeliveryAtomicId, DeliveryAtomicSourceFact>;

/** The real predicate for one atomic, reading ONLY its own detached raw projection. */
export function observeAtomicFromSourceFact(id: DeliveryAtomicId, fact: DeliveryAtomicSourceFact): unknown {
  const input = fact.projection.input as unknown as DeliveryDocumentationDemoInput;
  const decision = fact.projection.decision as unknown as DeliveryDocumentationDemoResult;
  const audit = fact.projection.audit as unknown as DeliveryEvaluationAudit;
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

/** Builds atomic `id`'s owned raw projection from the live evaluation inputs (deep-cloned, detached). */
export function buildDeliveryAtomicProjection(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  decision: DeliveryDocumentationDemoResult,
  audit: DeliveryEvaluationAudit,
): DeliveryAtomicProjection {
  const pkg = decision.package;
  type PartialDecision = Partial<DeliveryDocumentationDemoResult>;
  const inp = (keys: (keyof DeliveryDocumentationDemoInput)[]): Partial<DeliveryDocumentationDemoInput> =>
    Object.fromEntries(keys.map((k) => [k, input[k]])) as Partial<DeliveryDocumentationDemoInput>;
  const aud = (keys: (keyof DeliveryEvaluationAudit)[]): Partial<DeliveryEvaluationAudit> =>
    Object.fromEntries(keys.map((k) => [k, audit[k]])) as Partial<DeliveryEvaluationAudit>;
  const pk = (keys: string[]): PartialDecision => ({
    package: pkg
      ? (Object.fromEntries(keys.map((k) => [k, (pkg as unknown as Record<string, unknown>)[k]])) as unknown as DeliveryDocumentationDemoResult["package"])
      : null,
  });
  const withTop = (base: PartialDecision, keys: (keyof DeliveryDocumentationDemoResult)[]): PartialDecision => {
    const out: Record<string, unknown> = { ...base };
    for (const k of keys) out[k] = decision[k];
    return out as PartialDecision;
  };
  let raw: { input: Partial<DeliveryDocumentationDemoInput>; decision: PartialDecision; audit: Partial<DeliveryEvaluationAudit> };
  switch (id) {
    case "A01": raw = { input: inp(["delivery_identity"]), decision: pk(["identity", "provenance"]), audit: {} }; break;
    case "A02": raw = { input: {}, decision: pk(["identity", "executive_summary"]), audit: {} }; break;
    case "A03": raw = { input: {}, decision: pk(["executive_summary"]), audit: {} }; break;
    case "A04": raw = { input: {}, decision: withTop(pk(["executive_summary"]), ["coverage"]), audit: {} }; break;
    case "A05": raw = { input: {}, decision: pk(["executive_summary"]), audit: {} }; break;
    case "A06": raw = { input: {}, decision: pk(["executive_summary"]), audit: {} }; break;
    case "A07": raw = { input: {}, decision: pk(["architecture_summary"]), audit: {} }; break;
    case "A08": raw = { input: {}, decision: pk(["architecture_summary"]), audit: {} }; break;
    case "A09": raw = { input: {}, decision: withTop(pk(["architecture_summary"]), ["blockers"]), audit: {} }; break;
    case "A10": raw = { input: {}, decision: pk(["setup_and_run"]), audit: {} }; break;
    case "A11": raw = { input: {}, decision: withTop(pk(["setup_and_run"]), ["coverage"]), audit: {} }; break;
    case "A12": raw = { input: {}, decision: withTop(pk(["setup_and_run"]), ["blockers"]), audit: {} }; break;
    case "A13": raw = { input: inp(["demo_surface"]), decision: withTop(pk(["demo_script"]), ["blockers"]), audit: {} }; break;
    case "A14": raw = { input: {}, decision: pk(["demo_script"]), audit: {} }; break;
    case "A15": raw = { input: {}, decision: withTop(pk(["demo_script"]), ["coverage"]), audit: {} }; break;
    case "A16": raw = { input: {}, decision: pk(["limitations"]), audit: {} }; break;
    case "A17": raw = { input: {}, decision: pk(["limitations", "executive_summary"]), audit: {} }; break;
    case "A18": raw = { input: {}, decision: pk(["limitations"]), audit: {} }; break;
    case "A19": raw = { input: {}, decision: pk(["next_steps"]), audit: {} }; break;
    case "A20": raw = { input: {}, decision: withTop(pk(["next_steps"]), ["blockers"]), audit: {} }; break;
    case "A21": raw = { input: {}, decision: withTop(pk(["next_steps"]), ["blockers"]), audit: {} }; break;
    case "A22": raw = { input: {}, decision: withTop(pk(["evidence_index"]), ["coverage"]), audit: {} }; break;
    case "A23": raw = { input: {}, decision: withTop(pk(["provenance"]), ["coverage", "warnings"]), audit: {} }; break;
    case "A24": raw = { input: {}, decision: pk(["provenance"]), audit: {} }; break;
    case "A25": raw = { input: {}, decision: { ...decision }, audit: {} }; break;
    case "A26": raw = { input: inp(["repository_facts"]), decision: pk(["setup_and_run"]), audit: {} }; break;
    case "A27": raw = { input: {}, decision: { ...decision }, audit: {} }; break;
    case "A28": raw = { input: { ...input }, decision: {}, audit: aud(["input_snapshot_before", "input_snapshot_after"]) }; break;
    case "A29": raw = { input: {}, decision: { ...decision }, audit: aud(["candidate_gate_valid", "self_certified"]) }; break;
    case "A30": raw = { input: {}, decision: {}, audit: aud(["core_or_contract_changed", "provider_fixture_or_arm_branching", "hidden_io_or_clock"]) }; break;
    default: raw = { input: {}, decision: {}, audit: {} };
  }
  return structuredClone(raw) as DeliveryAtomicProjection;
}

/** Thin wrapper: build the atomic's owned projection, then delegate to the one real predicate. */
function observeAtomic(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  decision: DeliveryDocumentationDemoResult,
  audit: DeliveryEvaluationAudit,
): unknown {
  return observeAtomicFromSourceFact(id, {
    field_family: DELIVERY_ATOMIC_FIELD_FAMILIES[id],
    owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
    projection: buildDeliveryAtomicProjection(id, input, decision, audit),
  });
}

// ---------------------------------------------------------------------------
// Per-atomic owned raw field: its name + a mutation of exactly that one field.
// The 30 owned fields are pairwise distinct; each `mutate` throws if its target
// is absent, and is written to always move the value.
// ---------------------------------------------------------------------------
type MutProj = {
  input: DeepMutable<DeliveryDocumentationDemoInput>;
  decision: DeepMutable<DeliveryDocumentationDemoResult>;
  audit: DeepMutable<DeliveryEvaluationAudit>;
};
const reqTarget = <T>(v: T, what: string): NonNullable<T> => {
  if (v === undefined || v === null) throw new Error(`ISOLATION_TARGET_ABSENT:${what}`);
  return v as NonNullable<T>;
};
const PROBE = "::ISOLATION_PROBE";

export const DELIVERY_ATOMIC_OWNED_SOURCE: Record<
  DeliveryAtomicId,
  { owned_fact: string; mutate: (fact: DeliveryAtomicSourceFact) => void }
> = {
  A01: { owned_fact: "input.delivery_identity.revision_ref", mutate: (f) => { const p = f.projection as unknown as MutProj; const di = reqTarget(p.input.delivery_identity, "A01 delivery_identity"); di.revision_ref = `${reqTarget(di.revision_ref, "A01 revision_ref")}${PROBE}`; } },
  A02: { owned_fact: "package.identity.audience", mutate: (f) => { const p = f.projection as unknown as MutProj; const id = reqTarget(reqTarget(p.decision.package, "A02 package").identity, "A02 identity"); id.audience = `${reqTarget(id.audience, "A02 audience")}${PROBE}`; } },
  A03: { owned_fact: "package.executive_summary.delivered[0].claim_status", mutate: (f) => { const p = f.projection as unknown as MutProj; const c = reqTarget(reqTarget(p.decision.package, "A03 package").executive_summary.delivered[0], "A03 delivered[0]"); c.claim_status = c.claim_status === "UNKNOWN" ? "DEFERRED" : "UNKNOWN"; } },
  A04: { owned_fact: "decision.coverage.claims_with_evidence", mutate: (f) => { const p = f.projection as unknown as MutProj; const cov = reqTarget(p.decision.coverage, "A04 coverage"); cov.claims_with_evidence = reqTarget(cov.claims_with_evidence, "A04 claims_with_evidence") + 1; } },
  A05: { owned_fact: "package.executive_summary.delivered[2].subject_ref", mutate: (f) => { const p = f.projection as unknown as MutProj; const c = reqTarget(reqTarget(p.decision.package, "A05 package").executive_summary.delivered[2], "A05 delivered[2]"); c.subject_ref = `${reqTarget(c.subject_ref, "A05 subject_ref")}${PROBE}`; } },
  A06: { owned_fact: "package.executive_summary.delivered[3].claim_status", mutate: (f) => { const p = f.projection as unknown as MutProj; const c = reqTarget(reqTarget(p.decision.package, "A06 package").executive_summary.delivered[3], "A06 delivered[3]"); c.claim_status = c.claim_status === "DEFERRED" ? "IMPLEMENTED" : "DEFERRED"; } },
  A07: { owned_fact: "package.architecture_summary.components[0].source_ref", mutate: (f) => { const p = f.projection as unknown as MutProj; const comp = reqTarget(reqTarget(p.decision.package, "A07 package").architecture_summary.components[0], "A07 components[0]"); comp.source_ref = `${reqTarget(comp.source_ref, "A07 source_ref")}${PROBE}`; } },
  A08: { owned_fact: "package.architecture_summary.boundaries[0]", mutate: (f) => { const p = f.projection as unknown as MutProj; const b = reqTarget(p.decision.package, "A08 package").architecture_summary.boundaries; reqTarget(b[0], "A08 boundaries[0]"); b[0] = `${b[0]}${PROBE}`; } },
  A09: { owned_fact: "package.architecture_summary.present", mutate: (f) => { const p = f.projection as unknown as MutProj; const a = reqTarget(p.decision.package, "A09 package").architecture_summary; a.present = !a.present; } },
  A10: { owned_fact: "package.setup_and_run[0].evidence_refs", mutate: (f) => { const p = f.projection as unknown as MutProj; const s = reqTarget(reqTarget(p.decision.package, "A10 package").setup_and_run[0], "A10 setup_and_run[0]"); reqTarget(s.evidence_refs, "A10 evidence_refs").push(`ev${PROBE}`); } },
  A11: { owned_fact: "decision.coverage.setup_required_steps", mutate: (f) => { const p = f.projection as unknown as MutProj; const cov = reqTarget(p.decision.coverage, "A11 coverage"); cov.setup_required_steps = reqTarget(cov.setup_required_steps, "A11 setup_required_steps") + 1; } },
  A12: { owned_fact: "package.setup_and_run[0].command_or_action", mutate: (f) => { const p = f.projection as unknown as MutProj; const s = reqTarget(reqTarget(p.decision.package, "A12 package").setup_and_run[0], "A12 setup_and_run[0]"); s.command_or_action = `${reqTarget(s.command_or_action, "A12 command_or_action")} ${PROBE}`; } },
  A13: { owned_fact: "input.demo_surface.exists", mutate: (f) => { const p = f.projection as unknown as MutProj; const ds = reqTarget(p.input.demo_surface, "A13 demo_surface"); ds.exists = !ds.exists; } },
  A14: { owned_fact: "package.demo_script[0].action", mutate: (f) => { const p = f.projection as unknown as MutProj; const d = reqTarget(reqTarget(p.decision.package, "A14 package").demo_script[0], "A14 demo_script[0]"); d.action = d.action && d.action.length > 0 ? "" : `x${PROBE}`; } },
  A15: { owned_fact: "decision.coverage.demo_steps_with_fallback", mutate: (f) => { const p = f.projection as unknown as MutProj; const cov = reqTarget(p.decision.coverage, "A15 coverage"); cov.demo_steps_with_fallback = reqTarget(cov.demo_steps_with_fallback, "A15 demo_steps_with_fallback") + 1; } },
  A16: { owned_fact: "package.limitations[0].limitation_id", mutate: (f) => { const p = f.projection as unknown as MutProj; const l = reqTarget(reqTarget(p.decision.package, "A16 package").limitations[0], "A16 limitations[0]"); l.limitation_id = `${reqTarget(l.limitation_id, "A16 limitation_id")}${PROBE}`; } },
  A17: { owned_fact: "package.limitations[0].status", mutate: (f) => { const p = f.projection as unknown as MutProj; const l = reqTarget(reqTarget(p.decision.package, "A17 package").limitations[0], "A17 limitations[0]"); l.status = l.status === "KNOWN" ? "UNVERIFIED" : "KNOWN"; } },
  A18: { owned_fact: "package.limitations[0].severity", mutate: (f) => { const p = f.projection as unknown as MutProj; const l = reqTarget(reqTarget(p.decision.package, "A18 package").limitations[0], "A18 limitations[0]"); l.severity = l.severity === "HIGH" ? "LOW" : "HIGH"; } },
  A19: { owned_fact: "package.next_steps[0].priority", mutate: (f) => { const p = f.projection as unknown as MutProj; const n = reqTarget(reqTarget(p.decision.package, "A19 package").next_steps[0], "A19 next_steps[0]"); n.priority = n.priority === "P3" ? "P0" : "P3"; } },
  A20: { owned_fact: "package.next_steps[0].status", mutate: (f) => { const p = f.projection as unknown as MutProj; const n = reqTarget(reqTarget(p.decision.package, "A20 package").next_steps[0], "A20 next_steps[0]"); n.status = n.status === "DEFERRED" ? "PROPOSED" : "DEFERRED"; } },
  A21: { owned_fact: "package.next_steps[1].summary", mutate: (f) => { const p = f.projection as unknown as MutProj; const n = reqTarget(reqTarget(p.decision.package, "A21 package").next_steps[1], "A21 next_steps[1]"); n.summary = `${reqTarget(n.summary, "A21 summary")} S14`; } },
  A22: { owned_fact: "package.evidence_index[0].evidence_id", mutate: (f) => { const p = f.projection as unknown as MutProj; const e = reqTarget(reqTarget(p.decision.package, "A22 package").evidence_index[0], "A22 evidence_index[0]"); e.evidence_id = `${reqTarget(e.evidence_id, "A22 evidence_id")}${PROBE}`; } },
  A23: { owned_fact: "package.provenance.conflict_notes", mutate: (f) => { const p = f.projection as unknown as MutProj; const prov = reqTarget(p.decision.package, "A23 package").provenance; reqTarget(prov.conflict_notes, "A23 conflict_notes").push(`note${PROBE}`); } },
  A24: { owned_fact: "package.provenance.baseline_revision_ref", mutate: (f) => { const p = f.projection as unknown as MutProj; const prov = reqTarget(p.decision.package, "A24 package").provenance; prov.baseline_revision_ref = `${prov.baseline_revision_ref ?? ""}${PROBE}`; } },
  A25: { owned_fact: "decision.blockers", mutate: (f) => { const p = f.projection as unknown as MutProj; reqTarget(p.decision.blockers, "A25 blockers").push({ code: "SECRET_MATERIAL", detail: "isolation probe" }); } },
  A26: { owned_fact: "input.repository_facts[kind=SAFE_ENV_VARIABLE_NAME].kind", mutate: (f) => { const p = f.projection as unknown as MutProj; const rf = reqTarget(p.input.repository_facts, "A26 repository_facts").find((x) => x.kind === "SAFE_ENV_VARIABLE_NAME"); reqTarget(rf, "A26 SAFE_ENV_VARIABLE_NAME fact").kind = "URL"; } },
  A27: { owned_fact: "decision.warnings", mutate: (f) => { const p = f.projection as unknown as MutProj; reqTarget(p.decision.warnings, "A27 warnings").push({ code: "ISOLATION_PROBE", detail: "deployed to production" }); } },
  A28: { owned_fact: "audit.input_snapshot_after", mutate: (f) => { const p = f.projection as unknown as MutProj; p.audit.input_snapshot_after = `${reqTarget(p.audit.input_snapshot_after, "A28 input_snapshot_after")}${PROBE}`; } },
  A29: { owned_fact: "audit.candidate_gate_valid", mutate: (f) => { const p = f.projection as unknown as MutProj; p.audit.candidate_gate_valid = !p.audit.candidate_gate_valid; } },
  A30: { owned_fact: "audit.core_or_contract_changed", mutate: (f) => { const p = f.projection as unknown as MutProj; p.audit.core_or_contract_changed = !p.audit.core_or_contract_changed; } },
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

/** Freezes the 30 owned raw projections from the canonical build. Each is disjoint per owned field. */
export function deriveDeliveryAtomicSourceFacts(
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicSourceFacts {
  const truth = buildDeliveryPackage(input);
  return Object.fromEntries(
    DELIVERY_ATOMIC_IDS.map((id) => [
      id,
      {
        field_family: DELIVERY_ATOMIC_FIELD_FAMILIES[id],
        owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
        projection: buildDeliveryAtomicProjection(id, input, truth, audit),
      },
    ]),
  ) as DeliveryAtomicSourceFacts;
}

export interface DeliveryAtomicIsolationProbe {
  id: DeliveryAtomicId;
  owned_fact: string;
  governing_changed: boolean;
  cross_assertion_changes: DeliveryAtomicId[];
  changed_source_paths: string[];
  observation_recomputed: boolean;
  original_input_unchanged: boolean;
  original_facts_unchanged: boolean;
  mutated_raw_projection_field: boolean;
  recomputed_via_real_observer: boolean;
  mutated_expected_observation: boolean;
  mutated_correct_flag: boolean;
  mutated_decision: boolean;
}

/**
 * Isolation proof for one atomic: freeze the 30 canonical owned projections and
 * their real observations; deep-clone `facts[id]`; mutate exactly one owned raw
 * field of that clone; recompute the REAL observer for all 30 atomics feeding
 * the mutated clone only for `id` (every other atomic reads its own untouched
 * projection). Only `id`'s observation moves — by construction of disjoint
 * ownership. Nothing real (input, canonical facts) is mutated.
 */
export function probeDeliveryAtomicSourceFactIsolation(
  id: DeliveryAtomicId,
  input: DeliveryDocumentationDemoInput,
  audit: DeliveryEvaluationAudit = defaultAudit(input),
): DeliveryAtomicIsolationProbe {
  const inputBefore = JSON.stringify(input);
  const facts = deriveDeliveryAtomicSourceFacts(input, audit);
  const factsBefore = JSON.stringify(facts);

  const canonical: Record<string, string> = {};
  for (const k of DELIVERY_ATOMIC_IDS) canonical[k] = JSON.stringify(observeAtomicFromSourceFact(k, facts[k]));

  const factBefore = structuredClone(facts[id]);
  const mutatedFact = structuredClone(facts[id]);
  DELIVERY_ATOMIC_OWNED_SOURCE[id].mutate(mutatedFact);
  const changed_source_paths = jsonDiffPaths(factBefore, mutatedFact);

  const recomputedFacts: DeliveryAtomicSourceFacts = { ...facts, [id]: mutatedFact };
  const after: Record<string, string> = {};
  for (const k of DELIVERY_ATOMIC_IDS) after[k] = JSON.stringify(observeAtomicFromSourceFact(k, recomputedFacts[k]));

  const reRun = JSON.stringify(observeAtomicFromSourceFact(id, mutatedFact));
  const governing_changed = after[id] !== canonical[id];
  const changed = DELIVERY_ATOMIC_IDS.filter((k) => canonical[k] !== after[k]);
  const insideProjection =
    changed_source_paths.length > 0 && changed_source_paths.every((p) => p === "projection" || p.startsWith("projection."));
  const touches = (seg: string) => changed_source_paths.some((p) => p.split(".").includes(seg));

  return {
    id,
    owned_fact: DELIVERY_ATOMIC_OWNED_SOURCE[id].owned_fact,
    governing_changed,
    cross_assertion_changes: changed.filter((k) => k !== id),
    changed_source_paths,
    observation_recomputed: governing_changed && after[id] === reRun,
    original_input_unchanged: JSON.stringify(input) === inputBefore,
    original_facts_unchanged: JSON.stringify(facts) === factsBefore,
    mutated_raw_projection_field: insideProjection && !touches("expected_observation") && !touches("correct"),
    recomputed_via_real_observer: after[id] === reRun,
    mutated_expected_observation: touches("expected_observation"),
    mutated_correct_flag: touches("correct"),
    mutated_decision: !insideProjection,
  };
}

/**
 * Mechanical anti-tautology predicate. Returns `true` ONLY when the isolation
 * action changed a raw field strictly inside `projection.*` (never
 * `expected_observation` / `correct` / `actual_observation`), the real observer
 * was recomputed from it, the governing assertion moved, and no sibling moved.
 * Returns `false` for the rejected direct-`expected_observation` mutation.
 */
export function isValidSourceFactIsolationEvidence(r: {
  changed_source_paths: string[];
  observation_recomputed: boolean;
  governing_changed: boolean;
  cross_assertion_changes: readonly string[];
}): boolean {
  if (!Array.isArray(r.changed_source_paths) || r.changed_source_paths.length === 0) return false;
  const forbidden = ["expected_observation", "correct", "actual_observation", "field_family", "evidence"];
  for (const p of r.changed_source_paths) {
    if (p !== "projection" && !p.startsWith("projection.")) return false;
    if (p.split(".").some((seg) => forbidden.includes(seg))) return false;
  }
  if (!r.observation_recomputed) return false;
  if (!r.governing_changed) return false;
  if (!Array.isArray(r.cross_assertion_changes) || r.cross_assertion_changes.length !== 0) return false;
  return true;
}

/**
 * Reconstructs the REJECTED cf49b45 isolation action (direct `expected_observation`
 * overwrite via `mutateDeliverySourceFact`) as a probe-shaped record, so the
 * regression can prove `isValidSourceFactIsolationEvidence` mechanically rejects it.
 */
export function legacyMutationEvidence(
  input: DeliveryDocumentationDemoInput,
  id: DeliveryAtomicId,
): {
  id: DeliveryAtomicId;
  changed_source_paths: string[];
  observation_recomputed: boolean;
  governing_changed: boolean;
  cross_assertion_changes: DeliveryAtomicId[];
} {
  const facts = deriveDeliverySourceFacts(input);
  const before = structuredClone(facts[id]);
  mutateDeliverySourceFact(facts, id);
  return {
    id,
    changed_source_paths: jsonDiffPaths(before, facts[id]),
    observation_recomputed: false,
    governing_changed: true,
    cross_assertion_changes: [],
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
