import {
  ABS_PATH_TOKEN,
  ARCHITECTURE_DECISION_MARKER,
  DELIVERY_CEILINGS,
  DEMO_BROWSER_MARKER,
  DEMO_RUNTIME_MARKER,
  ENV_TOKEN,
  FORBIDDEN_SENSITIVE_KEY,
  OVERCLAIM_PHRASE,
  PORT_TOKEN,
  RAW_ENV_MARKER,
  RAW_LOG_MARKER,
  S13R_MARKER,
  S14_MARKER,
  S15_MARKER,
  SELF_CERT_MARKER,
  URL_TOKEN,
  collectStrings,
  containsForbiddenSensitiveMaterial,
} from "./constants.js";
import type {
  ArchitectureSummary,
  ClaimStatus,
  DeliveryBlocker,
  DeliveryClaim,
  DeliveryCoverage,
  DeliveryDocumentationDemoInput,
  DeliveryDocumentationDemoResult,
  DeliveryLimitation,
  DeliveryNextStep,
  DeliveryPackage,
  DeliveryValidationResult,
  DeliveryWarning,
  DemoStep,
  EvidenceIndexEntry,
  RepositoryFact,
  SetupRunStep,
  VerificationEvidence,
} from "./types.js";

// ---------------------------------------------------------------------------
// Method features. Canonical build turns every feature ON; the same shape is
// what the truth-blind A/B provider reconstructs from method prose.
// ---------------------------------------------------------------------------
export interface DeliveryMethodFeatures {
  enforceRevisionIdentity: boolean;
  distinguishClaimStatus: boolean;
  requireClaimEvidence: boolean;
  buildArchitectureSummary: boolean;
  requireSetupSignals: boolean;
  guardInventedTokens: boolean;
  buildDemoSubSteps: boolean;
  requireDemoFallback: boolean;
  boundDemoToEvidence: boolean;
  filterMaterialLimitations: boolean;
  labelNextSteps: boolean;
  preserveStageBoundaries: boolean;
  dedupOrderEvidence: boolean;
  applyEvidencePrecedence: boolean;
  bindProvenance: boolean;
  renderMarkdown: boolean;
}

export const ALL_DELIVERY_FEATURES: DeliveryMethodFeatures = {
  enforceRevisionIdentity: true,
  distinguishClaimStatus: true,
  requireClaimEvidence: true,
  buildArchitectureSummary: true,
  requireSetupSignals: true,
  guardInventedTokens: true,
  buildDemoSubSteps: true,
  requireDemoFallback: true,
  boundDemoToEvidence: true,
  filterMaterialLimitations: true,
  labelNextSteps: true,
  preserveStageBoundaries: true,
  dedupOrderEvidence: true,
  applyEvidencePrecedence: true,
  bindProvenance: true,
  renderMarkdown: true,
};

const clone = <T>(v: T): T => structuredClone(v);
const sortStrings = (xs: readonly string[]): string[] => [...new Set(xs)].sort();
const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;
const isSafeRef = (v: unknown, max = DELIVERY_CEILINGS.max_safe_ref_chars): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max && !FORBIDDEN_SENSITIVE_KEY.test(v);
const isText = (v: unknown): v is string =>
  typeof v === "string" && v.length <= DELIVERY_CEILINGS.max_text_chars_per_field;

const EMPTY_COVERAGE: DeliveryCoverage = {
  required_sections_present: false,
  setup_required_steps: 0,
  setup_optional_steps: 0,
  demo_required_steps: 0,
  demo_steps_with_fallback: 0,
  claims_total: 0,
  claims_with_evidence: 0,
  limitations_total: 0,
  next_steps_total: 0,
  evidence_refs_total: 0,
  evidence_conflicts: 0,
  markdown_bytes: 0,
};

function blockedResult(blockers: DeliveryBlocker[]): DeliveryDocumentationDemoResult {
  return { status: "BLOCKED", blockers, package: null, coverage: { ...EMPTY_COVERAGE }, warnings: [] };
}

// ---------------------------------------------------------------------------
// Evidence helpers
// ---------------------------------------------------------------------------
const evidenceIndexById = (input: DeliveryDocumentationDemoInput): Map<string, VerificationEvidence> =>
  new Map(input.verification_evidence.map((e) => [e.evidence_id, e]));

function revisionAllowed(input: DeliveryDocumentationDemoInput, revisionRef: string): boolean {
  const id = input.delivery_identity;
  if (revisionRef === id.revision_ref) return true;
  if (id.accepted_ancestry_or_range_ref && id.accepted_ancestry_or_range_ref.length > 0) return true;
  if (id.baseline_revision_ref && revisionRef === id.baseline_revision_ref) return true;
  return false;
}

function passEvidenceForSubject(input: DeliveryDocumentationDemoInput, subjectRef: string): VerificationEvidence[] {
  return input.verification_evidence.filter(
    (e) => e.subject_ref === subjectRef && e.status === "PASS" && revisionAllowed(input, e.revision_ref),
  );
}

// ---------------------------------------------------------------------------
// Structural + semantic validation. Fail-closed → BLOCKED.
// ---------------------------------------------------------------------------
export function validateDeliveryInput(
  value: unknown,
  features: DeliveryMethodFeatures = ALL_DELIVERY_FEATURES,
): { result: DeliveryValidationResult; blockers: DeliveryBlocker[] } {
  const blockers: DeliveryBlocker[] = [];
  const push = (code: string, detail: string) => {
    if (!blockers.some((b) => b.code === code && b.detail === detail)) blockers.push({ code, detail });
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { result: { valid: false, errors: ["malformed delivery input"] }, blockers: [{ code: "MALFORMED_INPUT", detail: "input is not an object" }] };
  }
  const input = value as DeliveryDocumentationDemoInput;
  const text = collectStrings(input);

  if (containsForbiddenSensitiveMaterial(input)) push("SECRET_MATERIAL", "input carries secret or credential material");
  if (RAW_LOG_MARKER.test(text)) push("RAW_LOG_MATERIAL", "input carries a raw log or stack trace");
  if (RAW_ENV_MARKER.test(text)) push("RAW_ENV_CONTENT", "input carries raw .env file content");

  const id = input.delivery_identity;
  if (!id || typeof id !== "object") push("MALFORMED_INPUT", "delivery_identity missing");
  else {
    if (!isSafeRef(id.project_ref)) push("MALFORMED_INPUT", "project_ref invalid");
    if (typeof id.revision_ref !== "string" || id.revision_ref.length === 0)
      push("MISSING_DELIVERY_REVISION", "delivery_identity.revision_ref is empty");
    else if (!isSafeRef(id.revision_ref)) push("MALFORMED_INPUT", "revision_ref invalid");
    if (!isSafeRef(id.delivery_scope_ref)) push("MALFORMED_INPUT", "delivery_scope_ref invalid");
    if (!isSafeRef(id.audience)) push("MALFORMED_INPUT", "audience invalid");
  }

  const policy = input.policy;
  if (!policy || typeof policy !== "object") push("MALFORMED_INPUT", "policy missing");
  else {
    for (const [key, ceiling] of Object.entries(DELIVERY_CEILINGS) as [keyof typeof DELIVERY_CEILINGS, number][]) {
      const v = (policy as unknown as Record<string, unknown>)[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) push("MALFORMED_INPUT", `policy.${key} invalid`);
      else if (v > ceiling) push("POLICY_RAISES_CEILING", `policy.${key} exceeds hard ceiling ${ceiling}`);
    }
    if (typeof policy.require_markdown_projection !== "boolean") push("MALFORMED_INPUT", "policy.require_markdown_projection invalid");
  }

  const surface = input.demo_surface;
  if (!surface || typeof surface !== "object") push("MALFORMED_INPUT", "demo_surface missing");
  else {
    if (!isSafeRef(surface.surface_ref)) push("MALFORMED_INPUT", "demo_surface.surface_ref invalid");
    if (typeof surface.exists !== "boolean") push("MALFORMED_INPUT", "demo_surface.exists invalid");
    if (!isSafeRef(surface.entry_action_ref)) push("MALFORMED_INPUT", "demo_surface.entry_action_ref invalid");
  }

  const arrays: [keyof typeof DELIVERY_CEILINGS, unknown][] = [
    ["max_repository_facts", input.repository_facts],
    ["max_verification_evidence", input.verification_evidence],
    ["max_architecture_facts", input.architecture_facts ?? []],
    ["max_limitations", input.limitations ?? []],
    ["max_next_steps", input.next_step_candidates ?? []],
  ];
  for (const [key, arr] of arrays) {
    if (!Array.isArray(arr)) push("MALFORMED_INPUT", `${key} array invalid`);
    else if (arr.length > DELIVERY_CEILINGS[key]) push("BOUND_EXCEEDED", `${key} exceeds ${DELIVERY_CEILINGS[key]}`);
  }

  // Nothing further if the shape itself is broken.
  if (blockers.some((b) => b.code === "MALFORMED_INPUT" || b.code === "SECRET_MATERIAL" || b.code === "RAW_LOG_MATERIAL" || b.code === "RAW_ENV_CONTENT")) {
    return { result: { valid: false, errors: blockers.map((b) => b.code) }, blockers };
  }

  const delivered = id.revision_ref;
  const knownFeatureImplemented = (subjectRef: string): boolean =>
    input.repository_facts.some(
      (f) => f.kind === "KNOWN_FEATURE" && f.subject_ref === subjectRef && (f.asserts_status === "IMPLEMENTED" || f.asserts_status === "VERIFIED"),
    );

  // --- Revision identity (R01) ---
  if (features.enforceRevisionIdentity) {
    if (surface && surface.revision_ref !== delivered && !revisionAllowed(input, surface.revision_ref))
      push("CONFLICTING_DELIVERY_REVISION", "demo_surface revision differs from delivered revision without accepted ancestry");
    for (const f of input.repository_facts) {
      if (f.kind === "KNOWN_FEATURE" && f.revision_ref !== delivered && !revisionAllowed(input, f.revision_ref))
        push("CLAIM_BOUND_TO_WRONG_REVISION", `fact ${f.fact_id} binds a feature claim to ${f.revision_ref}`);
    }
  }

  // --- Claim honesty (R02/R03/R06/R16) ---
  const evById = evidenceIndexById(input);
  for (const f of input.repository_facts) {
    if (f.evidence_ref && !evById.has(f.evidence_ref) && !(input.evidence_refs ?? []).includes(f.evidence_ref))
      push("EVIDENCE_REF_UNRESOLVED", `fact ${f.fact_id} cites unresolved evidence ${f.evidence_ref}`);
  }
  if (features.requireClaimEvidence || features.distinguishClaimStatus) {
    for (const f of input.repository_facts) {
      if (!f.asserts_status) continue;
      const roadmapSource = /roadmap|backlog|\bplan\b|todo|wishlist|future|proposal/i.test(f.source_ref);
      const passEv = passEvidenceForSubject(input, f.subject_ref);
      const cited = f.evidence_ref ? evById.get(f.evidence_ref) : undefined;
      const testNameOnly = input.repository_facts.some(
        (o) => o.fact_id === f.evidence_ref || (o.subject_ref === f.subject_ref && o.kind === "FILE_OR_DIRECTORY" && /test|spec|\.test\.|__tests__/i.test(o.value + o.source_ref)),
      );
      if (f.asserts_status === "IMPLEMENTED" && f.confidence === "REPORTED" && roadmapSource)
        push("ROADMAP_FEATURE_CLAIMED_IMPLEMENTED", `fact ${f.fact_id} claims a roadmap item as implemented`);
      if ((f.asserts_status === "VERIFIED" || f.asserts_status === "IMPLEMENTED") && passEv.length === 0 && testNameOnly && !cited)
        push("TEST_NAME_USED_AS_IMPLEMENTATION_PROOF", `fact ${f.fact_id} cites a test name, not executed evidence`);
      if (f.asserts_status === "VERIFIED" && passEv.length === 0 && !(cited && cited.status === "PASS"))
        push("UNSUPPORTED_VERIFIED_CLAIM", `fact ${f.fact_id} asserts VERIFIED without accepted PASS evidence`);
      if (f.asserts_status === "VERIFIED" && cited && (cited.status === "NOT_EVALUATED" || cited.status === "SKIPPED"))
        push("UNVERIFIED_PRESENTED_AS_PASS", `fact ${f.fact_id} presents ${cited.status} evidence as a pass`);
      if (
        f.asserts_status === "VERIFIED" &&
        f.confidence === "REPORTED" &&
        input.verification_evidence.some((e) => e.subject_ref === f.subject_ref && (e.kind === "TEST" || e.kind === "EVAL") && e.status === "FAIL")
      )
        push("PRECEDENCE_VIOLATION", `fact ${f.fact_id} (caller assertion) overrides a failing test for ${f.subject_ref}`);
      if (f.asserts_status === "VERIFIED" && !f.evidence_ref && /\bsee \b|refer to|as shown|documented in|per the docs/i.test(f.source_ref))
        push("PROSE_CITATION_NOT_EVIDENCE", `fact ${f.fact_id} substitutes a prose citation for an evidence ref`);
    }
  }

  // --- Production / deployment overclaim (R17 / section 10) ---
  const overclaimText = [
    ...input.repository_facts.filter((f) => f.kind === "KNOWN_FEATURE").map((f) => f.value),
    ...(input.limitations ?? []).map((l) => `${l.summary} ${l.impact}`),
    ...(input.next_step_candidates ?? []).map((n) => n.summary),
  ];
  for (const t of overclaimText) if (OVERCLAIM_PHRASE.test(t)) push("PRODUCTION_READINESS_OVERCLAIM", "delivery text makes an unsupported production/deployment claim");

  // --- Architecture summary is descriptive, not a redesign (R04 / section 11) ---
  if (features.buildArchitectureSummary) {
    for (const a of input.architecture_facts ?? []) {
      const decision = a.is_proposed_decision === true || ARCHITECTURE_DECISION_MARKER.test(a.value);
      if (!decision) continue;
      const kind = /database|datastore|postgres|mysql|mongo|\bsql\b/i.test(a.value)
        ? "database"
        : /agent|agentdefinition|verifier|challenger/i.test(a.value)
          ? "agent"
          : "provider";
      push("NEW_ARCHITECTURE_DECISION", `architecture fact ${a.fact_id} introduces a new ${kind} decision`);
    }
  }

  // --- Setup / run reproducibility (R05 / section 12) ---
  const commandFacts = input.repository_facts.filter((f) => f.kind === "COMMAND" || f.kind === "PACKAGE_SCRIPT");
  for (const f of commandFacts) {
    if (features.requireSetupSignals && f.setup_role === "REQUIRED") {
      if (f.confidence === "REPORTED") push("SETUP_COMMAND_NOT_IN_EVIDENCE", `command ${f.fact_id} is a required step but only REPORTED`);
      if (!f.expected_signal_ref || f.expected_signal_ref.length === 0)
        push("SETUP_EXPECTED_SIGNAL_MISSING", `required command ${f.fact_id} declares no expected signal`);
      if (features.preserveStageBoundaries && S13R_MARKER.test(f.value))
        push("S13R_DEPLOYMENT_PULLED_FORWARD", `required setup command ${f.fact_id} performs deployment work`);
    }
    if (features.guardInventedTokens) {
      const haystack = `${f.value} ${f.expected_signal_ref ?? ""}`;
      for (const m of haystack.matchAll(ENV_TOKEN)) {
        const name = m[1];
        if (!input.repository_facts.some((o) => o.kind === "SAFE_ENV_VARIABLE_NAME" && (o.value === name || o.subject_ref === name)))
          push("INVENTED_ENV_VARIABLE", `command ${f.fact_id} references undeclared env variable ${name}`);
      }
      for (const m of haystack.matchAll(PORT_TOKEN)) {
        const port = m[1];
        if (!input.repository_facts.some((o) => o.kind === "PORT" && o.value === port))
          push("INVENTED_PORT", `command ${f.fact_id} references undeclared port ${port}`);
      }
      for (const m of haystack.matchAll(URL_TOKEN)) {
        const url = m[0];
        if (!input.repository_facts.some((o) => o.kind === "URL" && (o.value === url || url.startsWith(o.value))))
          push("INVENTED_URL", `command ${f.fact_id} references undeclared URL ${url}`);
      }
      for (const m of haystack.matchAll(ABS_PATH_TOKEN)) {
        const p = m[1];
        if (p.length < 4) continue;
        if (!input.repository_facts.some((o) => o.kind === "FILE_OR_DIRECTORY" && (o.value === p || p.startsWith(o.value.endsWith("/") ? o.value : `${o.value}/`))))
          push("INVENTED_PATH", `command ${f.fact_id} references undeclared path ${p}`);
      }
    }
  }

  // --- Demo (R07/R08/R09 / section 13) ---
  if (features.buildDemoSubSteps && surface) {
    if (surface.exists === false) push("DEMO_SURFACE_DOES_NOT_EXIST", "demo surface does not exist");
    const actionRefs = [surface.entry_action_ref, ...(surface.steps ?? []).map((s) => `${s.action_ref} ${s.title_ref}`)];
    for (const a of actionRefs) {
      if (DEMO_RUNTIME_MARKER.test(a)) push("DEMO_CREATES_RUNTIME", "demo step would create a new server / deployment runtime");
      if (DEMO_BROWSER_MARKER.test(a)) push("DEMO_CREATES_BROWSER_AUTOMATION", "demo step would create browser automation or a recorder");
    }
    for (const s of surface.steps ?? []) {
      const ev = s.evidence_ref ? evById.get(s.evidence_ref) : undefined;
      if (features.boundDemoToEvidence) {
        if (s.expected_result_ref && s.expected_result_ref.length > 0 && !(ev && ev.status === "PASS"))
          push("DEMO_RESULT_UNSUPPORTED", `demo step ${s.step_ref} promises a result without accepted PASS evidence`);
        if (ev && (ev.status === "FAIL" || ev.status === "SKIPPED" || ev.status === "BLOCKED"))
          push("DEMO_EXCEEDS_EVIDENCE", `demo step ${s.step_ref} presents ${ev.status} behavior as a successful path`);
      }
      if (features.requireDemoFallback && s.env_sensitive === true && (!s.fallback_ref || s.fallback_ref.length === 0))
        push("DEMO_FALLBACK_MISSING", `environment-sensitive demo step ${s.step_ref} declares no fallback or stop condition`);
    }
  }

  // --- Limitations register (R10 / section 14) ---
  if (features.filterMaterialLimitations) {
    const suppressed = new Set(input.policy?.suppress_limitation_ids ?? []);
    for (const l of input.limitations ?? []) {
      if (suppressed.has(l.limitation_id) && l.severity === "HIGH" && l.status === "KNOWN")
        push("MATERIAL_LIMITATION_HIDDEN", `policy suppresses material limitation ${l.limitation_id}`);
      if (l.contradicts_subject_ref && knownFeatureImplemented(l.contradicts_subject_ref))
        push("LIMITATION_CONTRADICTED", `limitation ${l.limitation_id} contradicts an IMPLEMENTED/VERIFIED claim`);
    }
  }

  // --- Next steps & stage boundaries (R11/R18/R19 / sections 15/32/33) ---
  if (features.labelNextSteps) {
    for (const n of input.next_step_candidates ?? []) {
      if (n.claims_completed === true) push("NEXT_STEP_PRESENTED_AS_IMPLEMENTED", `next step ${n.next_step_id} is presented as already done`);
      if (!["PROPOSED", "DEFERRED", "REQUIRED_BEFORE_PRODUCTION"].includes(n.status))
        push("NEXT_STEP_STATUS_INVALID", `next step ${n.next_step_id} carries an invalid status label`);
    }
  }
  if (features.preserveStageBoundaries) {
    for (const a of input.architecture_facts ?? []) {
      if (a.kind === "ABSENT_OR_DEFERRED") continue;
      if (S14_MARKER.test(a.value)) push("S14_CAPABILITY_PULLED_FORWARD", `architecture fact ${a.fact_id} implements S14 capability/MCP work`);
      if (S15_MARKER.test(a.value)) push("S15_VERIFIER_PULLED_FORWARD", `architecture fact ${a.fact_id} implements an S15 verifier/workflow surface`);
    }
  }

  return { result: { valid: blockers.length === 0, errors: blockers.map((b) => b.code) }, blockers };
}

// ---------------------------------------------------------------------------
// Section builders (only reached when validation passed)
// ---------------------------------------------------------------------------
function deriveClaimStatus(
  input: DeliveryDocumentationDemoInput,
  f: RepositoryFact,
  features: DeliveryMethodFeatures,
): { status: ClaimStatus; evidence_refs: string[] } {
  const pass = passEvidenceForSubject(input, f.subject_ref).map((e) => e.evidence_id);
  if (f.kind === "KNOWN_NON_FEATURE") return { status: "NOT_IMPLEMENTED", evidence_refs: sortStrings(pass) };
  if (!features.distinguishClaimStatus) return { status: "IMPLEMENTED", evidence_refs: [] };
  const roadmapSource = /roadmap|backlog|\bplan\b|todo|wishlist|future|proposal/i.test(f.source_ref);
  if (roadmapSource) return { status: "DEFERRED", evidence_refs: [] };
  if (pass.length > 0) return { status: "VERIFIED", evidence_refs: sortStrings(pass) };
  if (f.confidence === "VERIFIED" || f.confidence === "ACCEPTED") return { status: "IMPLEMENTED", evidence_refs: [] };
  if (f.confidence === "REPORTED") return { status: "AVAILABLE_NOT_VERIFIED", evidence_refs: [] };
  return { status: "UNKNOWN", evidence_refs: [] };
}

function buildClaims(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): DeliveryClaim[] {
  const featureFacts = input.repository_facts.filter((f) => f.kind === "KNOWN_FEATURE" || f.kind === "KNOWN_NON_FEATURE");
  const claims = featureFacts.map((f) => {
    const { status, evidence_refs } = deriveClaimStatus(input, f, features);
    return { claim_id: f.fact_id, subject_ref: f.subject_ref, text: f.value, claim_status: status, evidence_refs };
  });
  return claims.sort((a, b) => a.claim_id.localeCompare(b.claim_id));
}

function buildArchitecture(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): ArchitectureSummary {
  const facts = input.architecture_facts ?? [];
  if (!features.buildArchitectureSummary || facts.length === 0)
    return { present: false, partial: true, components: [], boundaries: [], external_dependencies: [], absent_or_deferred: [] };
  const components = facts
    .filter((a) => a.kind === "COMPONENT")
    .map((a) => ({ subject_ref: a.subject_ref, responsibility: a.value, source_ref: a.source_ref }))
    .sort((x, y) => x.subject_ref.localeCompare(y.subject_ref));
  const boundaries = sortStrings(facts.filter((a) => a.kind === "BOUNDARY").map((a) => a.value));
  const external_dependencies = sortStrings(facts.filter((a) => a.kind === "DEPENDENCY").map((a) => a.value));
  const absent_or_deferred = sortStrings(facts.filter((a) => a.kind === "ABSENT_OR_DEFERRED").map((a) => a.value));
  const partial = components.length === 0 || boundaries.length === 0;
  return { present: true, partial, components, boundaries, external_dependencies, absent_or_deferred };
}

function buildSetup(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): SetupRunStep[] {
  const facts = input.repository_facts.filter((f) => f.kind === "COMMAND" || f.kind === "PACKAGE_SCRIPT");
  const steps = facts.map((f, i) => {
    const optional = features.requireSetupSignals ? f.setup_role !== "REQUIRED" : true;
    const evidence_refs = sortStrings(
      input.verification_evidence
        .filter((e) => (e.subject_ref === f.subject_ref || e.subject_ref === f.fact_id) && e.status === "PASS")
        .map((e) => e.evidence_id),
    );
    return {
      step_id: `setup-${String(i + 1).padStart(2, "0")}`,
      purpose: f.purpose_ref ?? f.subject_ref,
      command_or_action: f.value,
      precondition_refs: [...(f.precondition_refs ?? [])].map(String).sort(),
      expected_signal: features.requireSetupSignals ? f.expected_signal_ref ?? "" : "",
      evidence_refs,
      optional,
    };
  });
  return steps.slice(0, input.policy.max_setup_steps);
}

function buildDemo(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): DemoStep[] {
  const s = input.demo_surface;
  const evById = evidenceIndexById(input);
  const entry: DemoStep = {
    step_id: "demo-00",
    title: `Enter ${s.surface_ref}`,
    precondition_refs: [...s.precondition_refs].map(String).sort(),
    action: s.entry_action_ref,
    expected_observable_result: `surface ${s.surface_ref} is reachable`,
    evidence_refs: sortStrings(
      input.verification_evidence.filter((e) => e.subject_ref === s.surface_ref && e.status === "PASS").map((e) => e.evidence_id),
    ),
    fallback_or_stop_condition: `stop if ${s.surface_ref} is unavailable`,
  };
  if (!features.buildDemoSubSteps) return [entry].slice(0, input.policy.max_demo_steps);
  const rest = (s.steps ?? []).map((step, i) => {
    const ev = step.evidence_ref ? evById.get(step.evidence_ref) : undefined;
    return {
      step_id: `demo-${String(i + 1).padStart(2, "0")}`,
      title: step.title_ref,
      precondition_refs: [],
      action: step.action_ref,
      expected_observable_result: step.expected_result_ref,
      evidence_refs: ev && ev.status === "PASS" ? [ev.evidence_id] : [],
      fallback_or_stop_condition: step.fallback_ref ?? (step.env_sensitive ? "" : "no fallback required"),
    };
  });
  return [entry, ...rest].slice(0, input.policy.max_demo_steps);
}

function buildLimitations(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): DeliveryLimitation[] {
  const suppressed = new Set(input.policy.suppress_limitation_ids ?? []);
  return (input.limitations ?? [])
    .filter((l) => !suppressed.has(l.limitation_id))
    .map((l) => ({
      limitation_id: l.limitation_id,
      summary: l.summary,
      severity: l.severity,
      impact: features.filterMaterialLimitations ? l.impact : "",
      status: l.status,
      source_refs: features.filterMaterialLimitations ? [...l.source_refs].sort() : [],
    }))
    .sort((a, b) => a.limitation_id.localeCompare(b.limitation_id))
    .slice(0, input.policy.max_limitations);
}

function buildNextSteps(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): DeliveryNextStep[] {
  return (input.next_step_candidates ?? [])
    .map((n) => ({
      next_step_id: n.next_step_id,
      summary: n.summary,
      priority: n.priority,
      status: features.labelNextSteps ? n.status : "PROPOSED",
      dependency_or_owner_ref: features.labelNextSteps ? n.dependency_or_owner_ref : "",
      source_refs: features.labelNextSteps ? [...n.source_refs].sort() : [],
    }))
    .sort((a, b) => a.next_step_id.localeCompare(b.next_step_id))
    .slice(0, input.policy.max_next_steps);
}

function buildEvidenceIndex(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): EvidenceIndexEntry[] {
  const entries = input.verification_evidence.map((e) => ({
    evidence_id: e.evidence_id,
    kind: e.kind,
    status: e.status,
    subject_ref: e.subject_ref,
    revision_ref: e.revision_ref,
    source_ref: e.source_ref,
  }));
  if (!features.dedupOrderEvidence) return entries;
  const seen = new Set<string>();
  const deduped = entries.filter((e) => (seen.has(e.evidence_id) ? false : (seen.add(e.evidence_id), true)));
  return deduped.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id)).slice(0, input.policy.max_total_evidence_refs);
}

function buildProvenance(input: DeliveryDocumentationDemoInput, _features: DeliveryMethodFeatures, conflicts: string[]): DeliveryPackage["provenance"] {
  const id = input.delivery_identity;
  const source_kinds = sortStrings([
    ...input.repository_facts.map((f) => `repository_fact:${f.confidence}`),
    ...input.verification_evidence.map((e) => `verification:${e.kind}`),
    ...(input.architecture_facts && input.architecture_facts.length > 0 ? ["architecture_fact"] : []),
  ]);
  return {
    revision_ref: id.revision_ref,
    baseline_revision_ref: id.baseline_revision_ref ?? null,
    accepted_ancestry_or_range_ref: id.accepted_ancestry_or_range_ref ?? null,
    source_kinds,
    conflict_notes: [...conflicts].sort(),
  };
}

function detectEvidenceConflicts(input: DeliveryDocumentationDemoInput, _features: DeliveryMethodFeatures): string[] {
  const notes: string[] = [];
  const bySubject = new Map<string, VerificationEvidence[]>();
  for (const e of input.verification_evidence) {
    const list = bySubject.get(e.subject_ref) ?? [];
    list.push(e);
    bySubject.set(e.subject_ref, list);
  }
  for (const [subject, list] of bySubject) {
    const statuses = new Set(list.map((e) => e.status));
    if (statuses.has("PASS") && (statuses.has("FAIL") || statuses.has("BLOCKED")))
      notes.push(`conflicting verification statuses for ${subject}; executable failure retained`);
  }
  return notes.sort();
}

// ---------------------------------------------------------------------------
// Deterministic Markdown projection (R13 / section 34)
// ---------------------------------------------------------------------------
export function renderDeliveryPackageMarkdown(pkg: DeliveryPackage): string {
  const L: string[] = [];
  L.push(`# Delivery Package — ${pkg.identity.project_ref}`);
  L.push("");
  L.push("## Identity");
  L.push(`- revision: ${pkg.identity.revision_ref}`);
  L.push(`- scope: ${pkg.identity.delivery_scope_ref}`);
  L.push(`- audience: ${pkg.identity.audience}`);
  L.push("");
  L.push("## Executive summary");
  for (const c of pkg.executive_summary.delivered) L.push(`- [${c.claim_status}] ${c.subject_ref}: ${c.text}`);
  L.push(`- verified subjects: ${pkg.executive_summary.verified.join(", ") || "none"}`);
  L.push(`- limited or deferred: ${pkg.executive_summary.limited_or_deferred.join(", ") || "none"}`);
  L.push("");
  L.push("## Architecture summary");
  if (!pkg.architecture_summary.present) L.push("- not provided (no accepted architecture facts)");
  else {
    for (const comp of pkg.architecture_summary.components) L.push(`- component ${comp.subject_ref}: ${comp.responsibility}`);
    for (const b of pkg.architecture_summary.boundaries) L.push(`- boundary: ${b}`);
    for (const d of pkg.architecture_summary.external_dependencies) L.push(`- dependency: ${d}`);
    for (const x of pkg.architecture_summary.absent_or_deferred) L.push(`- absent or deferred: ${x}`);
  }
  L.push("");
  L.push("## Setup and run");
  for (const s of pkg.setup_and_run)
    L.push(`- ${s.step_id}${s.optional ? " (optional)" : ""}: ${s.command_or_action} => expect: ${s.expected_signal || "n/a"}`);
  L.push("");
  L.push("## Demo script");
  for (const d of pkg.demo_script)
    L.push(`- ${d.step_id}: ${d.action} => ${d.expected_observable_result} [fallback: ${d.fallback_or_stop_condition || "n/a"}]`);
  L.push("");
  L.push("## Limitations");
  for (const l of pkg.limitations) L.push(`- [${l.severity}/${l.status}] ${l.limitation_id}: ${l.summary}`);
  if (pkg.limitations.length === 0) L.push("- none recorded");
  L.push("");
  L.push("## Next steps");
  for (const n of pkg.next_steps) L.push(`- [${n.status}/${n.priority}] ${n.next_step_id}: ${n.summary}`);
  if (pkg.next_steps.length === 0) L.push("- none recorded");
  L.push("");
  L.push("## Evidence index");
  for (const e of pkg.evidence_index) L.push(`- ${e.evidence_id} (${e.kind}/${e.status}) ${e.subject_ref}`);
  L.push("");
  L.push("## Provenance");
  L.push(`- revision: ${pkg.provenance.revision_ref}`);
  L.push(`- source kinds: ${pkg.provenance.source_kinds.join(", ") || "none"}`);
  for (const c of pkg.provenance.conflict_notes) L.push(`- conflict: ${c}`);
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Canonical package builder
// ---------------------------------------------------------------------------
export function buildDeliveryPackage(
  value: unknown,
  features: DeliveryMethodFeatures = ALL_DELIVERY_FEATURES,
): DeliveryDocumentationDemoResult {
  const validation = validateDeliveryInput(value, features);
  if (!validation.result.valid) return blockedResult(validation.blockers);

  const input = clone(value as DeliveryDocumentationDemoInput);
  const warnings: DeliveryWarning[] = [];
  const warn = (code: string, detail: string) => warnings.push({ code, detail });

  const claims = buildClaims(input, features);
  const architecture = buildArchitecture(input, features);
  const setup = buildSetup(input, features);
  const demo = buildDemo(input, features);
  const limitations = buildLimitations(input, features);
  const nextSteps = buildNextSteps(input, features);
  const conflicts = detectEvidenceConflicts(input, features);
  const evidenceIndex = buildEvidenceIndex(input, features);
  const provenance = buildProvenance(input, features, conflicts);

  const verifiedSubjects = sortStrings(claims.filter((c) => c.claim_status === "VERIFIED").map((c) => c.subject_ref));
  const limitedOrDeferred = sortStrings([
    ...claims.filter((c) => c.claim_status === "DEFERRED" || c.claim_status === "AVAILABLE_NOT_VERIFIED" || c.claim_status === "UNKNOWN").map((c) => c.subject_ref),
    ...limitations.map((l) => l.limitation_id),
  ]);

  const pkgNoMarkdown: DeliveryPackage = {
    identity: {
      project_ref: input.delivery_identity.project_ref,
      revision_ref: input.delivery_identity.revision_ref,
      delivery_scope_ref: input.delivery_identity.delivery_scope_ref,
      audience: input.delivery_identity.audience,
      ...(input.delivery_identity.baseline_revision_ref ? { baseline_revision_ref: input.delivery_identity.baseline_revision_ref } : {}),
      ...(input.delivery_identity.accepted_ancestry_or_range_ref
        ? { accepted_ancestry_or_range_ref: input.delivery_identity.accepted_ancestry_or_range_ref }
        : {}),
      ...(input.delivery_identity.release_or_handoff_ref ? { release_or_handoff_ref: input.delivery_identity.release_or_handoff_ref } : {}),
    },
    executive_summary: {
      delivered: claims,
      revision_ref: input.delivery_identity.revision_ref,
      scope_ref: input.delivery_identity.delivery_scope_ref,
      audience: input.delivery_identity.audience,
      verified: verifiedSubjects,
      limited_or_deferred: limitedOrDeferred,
    },
    architecture_summary: architecture,
    setup_and_run: setup,
    demo_script: demo,
    limitations,
    next_steps: nextSteps,
    evidence_index: evidenceIndex,
    provenance,
    optional_markdown_projection: null,
  };

  let markdown: string | null = null;
  if (input.policy.require_markdown_projection) {
    const rendered = renderDeliveryPackageMarkdown(pkgNoMarkdown);
    const bytes = utf8Bytes(rendered);
    if (bytes > input.policy.max_rendered_markdown_bytes) warn("MARKDOWN_OMITTED", "rendered Markdown exceeds the byte ceiling");
    else markdown = rendered;
  }
  const pkg: DeliveryPackage = { ...pkgNoMarkdown, optional_markdown_projection: markdown };

  // --- coverage ---
  const setupRequired = setup.filter((s) => !s.optional);
  const demoWithFallback = demo.filter((d) => d.fallback_or_stop_condition.length > 0);
  const claimsWithEvidence = claims.filter((c) => c.evidence_refs.length > 0).length;
  const markdownBytes = markdown ? utf8Bytes(markdown) : 0;

  // --- status derivation (section 19) ---
  const requiredSectionsPresent =
    claims.length >= 1 && setup.length >= 1 && demo.length >= 1 && evidenceIndex.length >= 1 && provenance.source_kinds.length >= 1;

  let status: DeliveryDocumentationDemoResult["status"] = "READY";
  const partialReasons: string[] = [];
  if (!architecture.present) partialReasons.push("architecture summary absent (no accepted architecture facts)");
  else if (architecture.partial) partialReasons.push("architecture summary incomplete");
  if (setupRequired.length === 0) partialReasons.push("no required setup step");
  if (claims.some((c) => c.claim_status === "UNKNOWN")) partialReasons.push("one or more claims are UNKNOWN");
  if (claims.filter((c) => c.claim_status === "VERIFIED").length === 0) partialReasons.push("no verified claim");
  if ((input.next_step_candidates ?? []).length === 0) partialReasons.push("no next-step candidates supplied");
  if (input.policy.require_markdown_projection && markdown === null) partialReasons.push("Markdown projection unavailable");
  if (conflicts.length > 0) for (const c of conflicts) warn("EVIDENCE_CONFLICT", c);

  if (!requiredSectionsPresent) {
    // Required identity/setup/demo/evidence structurally thin but not unsafe.
    status = "BLOCKED";
    return {
      status,
      blockers: [{ code: "REQUIRED_SECTION_MISSING", detail: "a required delivery section could not be constructed from accepted facts" }],
      package: null,
      coverage: { ...EMPTY_COVERAGE },
      warnings,
    };
  }
  if (partialReasons.length > 0) {
    status = "PARTIAL";
    for (const r of partialReasons) warn("PARTIAL_SECTION", r);
  }

  const coverage: DeliveryCoverage = {
    required_sections_present: requiredSectionsPresent,
    setup_required_steps: setupRequired.length,
    setup_optional_steps: setup.length - setupRequired.length,
    demo_required_steps: demo.length,
    demo_steps_with_fallback: demoWithFallback.length,
    claims_total: claims.length,
    claims_with_evidence: claimsWithEvidence,
    limitations_total: limitations.length,
    next_steps_total: nextSteps.length,
    evidence_refs_total: evidenceIndex.length,
    evidence_conflicts: conflicts.length,
    markdown_bytes: markdownBytes,
  };

  return { status, blockers: [], package: pkg, coverage, warnings };
}

// ---------------------------------------------------------------------------
// Actual-candidate gate (contract section 20) — recompute, never trust.
// ---------------------------------------------------------------------------
export function validateDeliveryCandidate(candidate: unknown, input: unknown): DeliveryValidationResult {
  const expected = buildDeliveryPackage(input);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return { valid: false, errors: ["candidate is not an object"] };
  const c = candidate as Record<string, unknown>;
  const serialized = JSON.stringify(c);
  const text = collectStrings(c);
  const errors: string[] = [];
  if (containsForbiddenSensitiveMaterial(c)) errors.push("candidate carries secret or credential material");
  if (RAW_LOG_MARKER.test(text)) errors.push("candidate carries a raw log or stack trace");
  if (RAW_ENV_MARKER.test(text)) errors.push("candidate carries raw .env content");
  if (SELF_CERT_MARKER.test(text) || SELF_CERT_MARKER.test(serialized)) errors.push("candidate self-certifies or self-awards a step / honor invariant");
  // Fresh timestamp not present in the input.
  const inputSerialized = JSON.stringify(input);
  for (const m of serialized.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g))
    if (!inputSerialized.includes(m[0])) errors.push("candidate inserts a nondeterministic timestamp");
  for (const key of ["status", "blockers", "package", "coverage", "warnings"] as const)
    if (JSON.stringify(c[key]) !== JSON.stringify((expected as unknown as Record<string, unknown>)[key]))
      errors.push(`candidate ${key} diverges from the recomputed canonical package`);
  return { valid: errors.length === 0, errors };
}

export function evaluateDeliveryCandidateGate(input: unknown, candidate: unknown): {
  candidate: unknown;
  decision: DeliveryDocumentationDemoResult;
  decisionValidation: DeliveryValidationResult;
} {
  const decisionValidation = validateDeliveryCandidate(candidate, input);
  const decision = decisionValidation.valid
    ? clone(candidate as DeliveryDocumentationDemoResult)
    : blockedResult([{ code: "CANDIDATE_REJECTED", detail: decisionValidation.errors[0] ?? "candidate failed the deterministic gate" }]);
  return { candidate, decision, decisionValidation };
}
