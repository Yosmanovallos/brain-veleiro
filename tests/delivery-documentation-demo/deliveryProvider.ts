import type { ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import {
  DELIVERY_DOCUMENTATION_DEMO_INPUT_MARKER,
  DELIVERY_CEILINGS,
  collectStrings,
  containsForbiddenSensitiveMaterial,
} from "../../src/intelligence/delivery-documentation-demo/constants.js";
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
  DeliveryWarning,
  DemoStep,
  EvidenceIndexEntry,
  RepositoryFact,
  SetupRunStep,
  VerificationEvidence,
} from "../../src/intelligence/delivery-documentation-demo/types.js";

// ---------------------------------------------------------------------------
// Reusable delivery-engineering concepts recovered from arbitrary method prose.
// This model sees only the visible packet and the visible prose — no run-mode
// label, no per-case key, no target output, no evaluator import.
// ---------------------------------------------------------------------------
export interface DeliveryMethodFeatures {
  distinguishClaimStatus: boolean;
  buildArchitectureSummary: boolean;
  requireSetupSignals: boolean;
  buildDemoScript: boolean;
  filterMaterialLimitations: boolean;
  labelNextSteps: boolean;
  dedupOrderEvidence: boolean;
}

/** The section each concept owns in the produced package — used by the ablation proof. */
export const FEATURE_OWNED_SECTION: Record<keyof DeliveryMethodFeatures, keyof import("../../src/intelligence/delivery-documentation-demo/types.js").DeliveryPackage> = {
  distinguishClaimStatus: "executive_summary",
  buildArchitectureSummary: "architecture_summary",
  requireSetupSignals: "setup_and_run",
  buildDemoScript: "demo_script",
  filterMaterialLimitations: "limitations",
  labelNextSteps: "next_steps",
  dedupOrderEvidence: "evidence_index",
};

const normalize = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const has = (t: string, ...concepts: readonly string[]): boolean => concepts.some((c) => t.includes(normalize(c)));
const all = (t: string, ...groups: readonly (readonly string[])[]): boolean => groups.every((g) => has(t, ...g));

export function extractDeliveryMethodFeatures(prose: string): DeliveryMethodFeatures {
  const t = normalize(prose);
  return {
    distinguishClaimStatus: all(t, ["implemented"], ["verified"], ["distinct", "not conflated", "never conflated", "different states"]),
    buildArchitectureSummary: all(t, ["architecture summary", "architecture section"], ["describes", "existing", "already exists"]),
    requireSetupSignals: all(t, ["setup", "run step"], ["precondition", "expected", "observable signal"]),
    buildDemoScript: all(t, ["demo"], ["walkthrough", "reproducible", "existing surface"]),
    filterMaterialLimitations: all(t, ["limitation"], ["severity", "impact", "provenance"], ["explicit", "first class", "never euphemized", "represented"]),
    labelNextSteps: all(t, ["next step"], ["proposed", "deferred", "required before production", "status labeled", "labeled"]),
    dedupOrderEvidence: all(t, ["evidence index"], ["deduplicated", "deduplicate", "deterministically ordered", "deterministic order"]),
  };
}

export const ALL_FEATURES_ON: DeliveryMethodFeatures = {
  distinguishClaimStatus: true,
  buildArchitectureSummary: true,
  requireSetupSignals: true,
  buildDemoScript: true,
  filterMaterialLimitations: true,
  labelNextSteps: true,
  dedupOrderEvidence: true,
};
export const ALL_FEATURES_OFF: DeliveryMethodFeatures = {
  distinguishClaimStatus: false,
  buildArchitectureSummary: false,
  requireSetupSignals: false,
  buildDemoScript: false,
  filterMaterialLimitations: false,
  labelNextSteps: false,
  dedupOrderEvidence: false,
};

// ---------------------------------------------------------------------------
// Faithful re-derivation of the delivery package, parameterised only by the
// eight recovered concepts. With every concept present it reproduces the
// canonical structured package byte for byte; the module's gate checks that.
// ---------------------------------------------------------------------------
const sortStrings = (xs: readonly string[]): string[] => [...new Set(xs)].sort();
const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

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

const FORBIDDEN_KEY = /(?:password|secret|api[_-]?key|access[_-]?token|private[_-]?key|cookie|bearer|authorization)/i;
const RAW_LOG = /(?:Traceback \(most recent call last\)|^\s*at [\w$.<>]+ \(.*:\d+:\d+\)|\n\s{2,}at .+:\d+:\d+\))/m;
const RAW_ENV = /(?:^|\n)[A-Z][A-Z0-9_]{2,}=[^\n]+\n[A-Z][A-Z0-9_]{2,}=/;
const OVERCLAIM = /\b(production[- ]ready|zero[- ]bugs?|fully[- ]tested|highly[- ]available|deployed to production)\b/i;
const ARCH_DECISION = /\b(introduce|adopt|migrate to|switch to|we should use|recommend using|new (?:provider|database|datastore|queue|cache|framework|service|agent))\b/i;
const S13R_RE = /\b(dockerfile|containeriz(?:e|ation)|deployment (?:script|pipeline|adapter|manifest)|health[- ]?check endpoint)\b/i;
const S14_RE = /\b(capability registry|mcp server|connector binding|oauth flow)\b/i;
const S15_RE = /\b(verifier agent|challenger agent|new agentdefinition|workflow runtime|orchestrator implementation)\b/i;

const isSafeRef = (v: unknown, max = DELIVERY_CEILINGS.max_safe_ref_chars): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max && !FORBIDDEN_KEY.test(v);

function revisionAllowed(input: DeliveryDocumentationDemoInput, rev: string): boolean {
  const id = input.delivery_identity;
  if (rev === id.revision_ref) return true;
  if (id.accepted_ancestry_or_range_ref && id.accepted_ancestry_or_range_ref.length > 0) return true;
  if (id.baseline_revision_ref && rev === id.baseline_revision_ref) return true;
  return false;
}
function passFor(input: DeliveryDocumentationDemoInput, subject: string): VerificationEvidence[] {
  return input.verification_evidence.filter((e) => e.subject_ref === subject && e.status === "PASS" && revisionAllowed(input, e.revision_ref));
}

function validateFull(input: DeliveryDocumentationDemoInput): DeliveryBlocker[] {
  const blockers: DeliveryBlocker[] = [];
  const push = (code: string, detail: string) => {
    if (!blockers.some((b) => b.code === code && b.detail === detail)) blockers.push({ code, detail });
  };
  const text = collectStrings(input);
  if (containsForbiddenSensitiveMaterial(input)) push("SECRET_MATERIAL", "input carries secret or credential material");
  if (RAW_LOG.test(text)) push("RAW_LOG_MATERIAL", "input carries a raw log or stack trace");
  if (RAW_ENV.test(text)) push("RAW_ENV_CONTENT", "input carries raw .env file content");

  const id = input.delivery_identity;
  if (!id || typeof id !== "object") push("MALFORMED_INPUT", "delivery_identity missing");
  else {
    if (!isSafeRef(id.project_ref)) push("MALFORMED_INPUT", "project_ref invalid");
    if (typeof id.revision_ref !== "string" || id.revision_ref.length === 0) push("MISSING_DELIVERY_REVISION", "delivery_identity.revision_ref is empty");
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
  if (blockers.some((b) => ["MALFORMED_INPUT", "SECRET_MATERIAL", "RAW_LOG_MATERIAL", "RAW_ENV_CONTENT"].includes(b.code))) return blockers;

  const delivered = id.revision_ref;
  const evById = new Map(input.verification_evidence.map((e) => [e.evidence_id, e]));
  const knownFeatureImplemented = (subject: string) =>
    input.repository_facts.some((f) => f.kind === "KNOWN_FEATURE" && f.subject_ref === subject && (f.asserts_status === "IMPLEMENTED" || f.asserts_status === "VERIFIED"));

  if (surface && surface.revision_ref !== delivered && !revisionAllowed(input, surface.revision_ref))
    push("CONFLICTING_DELIVERY_REVISION", "demo_surface revision differs from delivered revision without accepted ancestry");
  for (const f of input.repository_facts)
    if (f.kind === "KNOWN_FEATURE" && f.revision_ref !== delivered && !revisionAllowed(input, f.revision_ref))
      push("CLAIM_BOUND_TO_WRONG_REVISION", `fact ${f.fact_id} binds a feature claim to ${f.revision_ref}`);

  for (const f of input.repository_facts)
    if (f.evidence_ref && !evById.has(f.evidence_ref) && !(input.evidence_refs ?? []).includes(f.evidence_ref))
      push("EVIDENCE_REF_UNRESOLVED", `fact ${f.fact_id} cites unresolved evidence ${f.evidence_ref}`);

  for (const f of input.repository_facts) {
    if (!f.asserts_status) continue;
    const roadmapSource = /roadmap|backlog|\bplan\b|todo|wishlist|future|proposal/i.test(f.source_ref);
    const passEv = passFor(input, f.subject_ref);
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

  const overclaimText = [
    ...input.repository_facts.filter((f) => f.kind === "KNOWN_FEATURE").map((f) => f.value),
    ...(input.limitations ?? []).map((l) => `${l.summary} ${l.impact}`),
    ...(input.next_step_candidates ?? []).map((n) => n.summary),
  ];
  for (const s of overclaimText) if (OVERCLAIM.test(s)) push("PRODUCTION_READINESS_OVERCLAIM", "delivery text makes an unsupported production/deployment claim");

  for (const a of input.architecture_facts ?? []) {
    const decision = a.is_proposed_decision === true || ARCH_DECISION.test(a.value);
    if (!decision) continue;
    const kind = /database|datastore|postgres|mysql|mongo|\bsql\b/i.test(a.value)
      ? "database"
      : /agent|agentdefinition|verifier|challenger/i.test(a.value)
        ? "agent"
        : "provider";
    push("NEW_ARCHITECTURE_DECISION", `architecture fact ${a.fact_id} introduces a new ${kind} decision`);
  }

  const commandFacts = input.repository_facts.filter((f) => f.kind === "COMMAND" || f.kind === "PACKAGE_SCRIPT");
  for (const f of commandFacts) {
    if (f.setup_role === "REQUIRED") {
      if (f.confidence === "REPORTED") push("SETUP_COMMAND_NOT_IN_EVIDENCE", `command ${f.fact_id} is a required step but only REPORTED`);
      if (!f.expected_signal_ref || f.expected_signal_ref.length === 0)
        push("SETUP_EXPECTED_SIGNAL_MISSING", `required command ${f.fact_id} declares no expected signal`);
      if (S13R_RE.test(f.value)) push("S13R_DEPLOYMENT_PULLED_FORWARD", `required setup command ${f.fact_id} performs deployment work`);
    }
    const haystack = `${f.value} ${f.expected_signal_ref ?? ""}`;
    for (const m of haystack.matchAll(/\$\{?([A-Z][A-Z0-9_]{2,})\}?/g)) {
      const name = m[1];
      if (!input.repository_facts.some((o) => o.kind === "SAFE_ENV_VARIABLE_NAME" && (o.value === name || o.subject_ref === name)))
        push("INVENTED_ENV_VARIABLE", `command ${f.fact_id} references undeclared env variable ${name}`);
    }
    for (const m of haystack.matchAll(/(?:--port[ =]|:)\s?(\d{2,5})\b/g)) {
      const port = m[1];
      if (!input.repository_facts.some((o) => o.kind === "PORT" && o.value === port))
        push("INVENTED_PORT", `command ${f.fact_id} references undeclared port ${port}`);
    }
    for (const m of haystack.matchAll(/\bhttps?:\/\/[^\s"'`]+/g)) {
      const url = m[0];
      if (!input.repository_facts.some((o) => o.kind === "URL" && (o.value === url || url.startsWith(o.value))))
        push("INVENTED_URL", `command ${f.fact_id} references undeclared URL ${url}`);
    }
    for (const m of haystack.matchAll(/(?<![:\w])(\/(?:[\w.-]+\/)*[\w.-]+)/g)) {
      const p = m[1];
      if (p.length < 4) continue;
      if (!input.repository_facts.some((o) => o.kind === "FILE_OR_DIRECTORY" && (o.value === p || p.startsWith(o.value.endsWith("/") ? o.value : `${o.value}/`))))
        push("INVENTED_PATH", `command ${f.fact_id} references undeclared path ${p}`);
    }
  }

  if (surface) {
    if (surface.exists === false) push("DEMO_SURFACE_DOES_NOT_EXIST", "demo surface does not exist");
    const actionRefs = [surface.entry_action_ref, ...(surface.steps ?? []).map((s) => `${s.action_ref} ${s.title_ref}`)];
    for (const a of actionRefs) {
      if (/\b(start(?:s|ing)? (?:a |the )?(?:new )?server|spin up|deploy(?:ment)?|docker run|docker compose up|kubectl|helm install|npm run deploy|listen on port|bind to port|provision (?:a )?(?:host|instance)|create (?:a )?public url|expose (?:a )?tunnel)\b/i.test(a))
        push("DEMO_CREATES_RUNTIME", "demo step would create a new server / deployment runtime");
      if (/\b(puppeteer|playwright|selenium|webdriver|headless chrome|browser automation|record (?:a )?video|capture (?:a )?screenshot|screen recording)\b/i.test(a))
        push("DEMO_CREATES_BROWSER_AUTOMATION", "demo step would create browser automation or a recorder");
    }
    for (const s of surface.steps ?? []) {
      const ev = s.evidence_ref ? evById.get(s.evidence_ref) : undefined;
      if (s.expected_result_ref && s.expected_result_ref.length > 0 && !(ev && ev.status === "PASS"))
        push("DEMO_RESULT_UNSUPPORTED", `demo step ${s.step_ref} promises a result without accepted PASS evidence`);
      if (ev && (ev.status === "FAIL" || ev.status === "SKIPPED" || ev.status === "BLOCKED"))
        push("DEMO_EXCEEDS_EVIDENCE", `demo step ${s.step_ref} presents ${ev.status} behavior as a successful path`);
      if (s.env_sensitive === true && (!s.fallback_ref || s.fallback_ref.length === 0))
        push("DEMO_FALLBACK_MISSING", `environment-sensitive demo step ${s.step_ref} declares no fallback or stop condition`);
    }
  }

  const suppressed = new Set(input.policy?.suppress_limitation_ids ?? []);
  for (const l of input.limitations ?? []) {
    if (suppressed.has(l.limitation_id) && l.severity === "HIGH" && l.status === "KNOWN")
      push("MATERIAL_LIMITATION_HIDDEN", `policy suppresses material limitation ${l.limitation_id}`);
    if (l.contradicts_subject_ref && knownFeatureImplemented(l.contradicts_subject_ref))
      push("LIMITATION_CONTRADICTED", `limitation ${l.limitation_id} contradicts an IMPLEMENTED/VERIFIED claim`);
  }

  for (const n of input.next_step_candidates ?? []) {
    if (n.claims_completed === true) push("NEXT_STEP_PRESENTED_AS_IMPLEMENTED", `next step ${n.next_step_id} is presented as already done`);
    if (!["PROPOSED", "DEFERRED", "REQUIRED_BEFORE_PRODUCTION"].includes(n.status))
      push("NEXT_STEP_STATUS_INVALID", `next step ${n.next_step_id} carries an invalid status label`);
  }
  for (const a of input.architecture_facts ?? []) {
    if (a.kind === "ABSENT_OR_DEFERRED") continue;
    if (S14_RE.test(a.value)) push("S14_CAPABILITY_PULLED_FORWARD", `architecture fact ${a.fact_id} implements S14 capability/MCP work`);
    if (S15_RE.test(a.value)) push("S15_VERIFIER_PULLED_FORWARD", `architecture fact ${a.fact_id} implements an S15 verifier/workflow surface`);
  }
  return blockers;
}

function deriveClaimStatus(input: DeliveryDocumentationDemoInput, f: RepositoryFact, features: DeliveryMethodFeatures): { status: ClaimStatus; evidence_refs: string[] } {
  const pass = passFor(input, f.subject_ref).map((e) => e.evidence_id);
  if (f.kind === "KNOWN_NON_FEATURE") return { status: "NOT_IMPLEMENTED", evidence_refs: sortStrings(pass) };
  if (!features.distinguishClaimStatus) return { status: "IMPLEMENTED", evidence_refs: [] };
  const roadmapSource = /roadmap|backlog|\bplan\b|todo|wishlist|future|proposal/i.test(f.source_ref);
  if (roadmapSource) return { status: "DEFERRED", evidence_refs: [] };
  if (pass.length > 0) return { status: "VERIFIED", evidence_refs: sortStrings(pass) };
  if (f.confidence === "VERIFIED" || f.confidence === "ACCEPTED") return { status: "IMPLEMENTED", evidence_refs: [] };
  if (f.confidence === "REPORTED") return { status: "AVAILABLE_NOT_VERIFIED", evidence_refs: [] };
  return { status: "UNKNOWN", evidence_refs: [] };
}

function synthesizeArchitecture(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): ArchitectureSummary {
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
  return { present: true, partial: components.length === 0 || boundaries.length === 0, components, boundaries, external_dependencies, absent_or_deferred };
}

function synthesizeSetup(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): SetupRunStep[] {
  const facts = input.repository_facts.filter((f) => f.kind === "COMMAND" || f.kind === "PACKAGE_SCRIPT");
  return facts
    .map((f, i) => ({
      step_id: `setup-${String(i + 1).padStart(2, "0")}`,
      purpose: f.purpose_ref ?? f.subject_ref,
      command_or_action: f.value,
      precondition_refs: [...(f.precondition_refs ?? [])].map(String).sort(),
      expected_signal: features.requireSetupSignals ? f.expected_signal_ref ?? "" : "",
      evidence_refs: sortStrings(
        input.verification_evidence.filter((e) => (e.subject_ref === f.subject_ref || e.subject_ref === f.fact_id) && e.status === "PASS").map((e) => e.evidence_id),
      ),
      optional: features.requireSetupSignals ? f.setup_role !== "REQUIRED" : true,
    }))
    .slice(0, input.policy.max_setup_steps);
}

function synthesizeDemo(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): DemoStep[] {
  const s = input.demo_surface;
  const evById = new Map(input.verification_evidence.map((e) => [e.evidence_id, e]));
  const entry: DemoStep = {
    step_id: "demo-00",
    title: `Enter ${s.surface_ref}`,
    precondition_refs: [...s.precondition_refs].map(String).sort(),
    action: s.entry_action_ref,
    expected_observable_result: `surface ${s.surface_ref} is reachable`,
    evidence_refs: sortStrings(input.verification_evidence.filter((e) => e.subject_ref === s.surface_ref && e.status === "PASS").map((e) => e.evidence_id)),
    fallback_or_stop_condition: `stop if ${s.surface_ref} is unavailable`,
  };
  if (!features.buildDemoScript) return [entry].slice(0, input.policy.max_demo_steps);
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

function synthesizeLimitations(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): DeliveryLimitation[] {
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

function synthesizeNextSteps(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): DeliveryNextStep[] {
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

function synthesizeEvidenceIndex(input: DeliveryDocumentationDemoInput, features: DeliveryMethodFeatures): EvidenceIndexEntry[] {
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
  return entries
    .filter((e) => (seen.has(e.evidence_id) ? false : (seen.add(e.evidence_id), true)))
    .sort((a, b) => a.evidence_id.localeCompare(b.evidence_id))
    .slice(0, input.policy.max_total_evidence_refs);
}

function detectConflicts(input: DeliveryDocumentationDemoInput): string[] {
  const bySubject = new Map<string, VerificationEvidence[]>();
  for (const e of input.verification_evidence) {
    const list = bySubject.get(e.subject_ref) ?? [];
    list.push(e);
    bySubject.set(e.subject_ref, list);
  }
  const notes: string[] = [];
  for (const [subject, list] of bySubject) {
    const statuses = new Set(list.map((e) => e.status));
    if (statuses.has("PASS") && (statuses.has("FAIL") || statuses.has("BLOCKED")))
      notes.push(`conflicting verification statuses for ${subject}; executable failure retained`);
  }
  return notes.sort();
}

function renderMarkdown(pkg: DeliveryPackage): string {
  const L: string[] = [];
  L.push(`# Delivery Package — ${pkg.identity.project_ref}`, "", "## Identity");
  L.push(`- revision: ${pkg.identity.revision_ref}`, `- scope: ${pkg.identity.delivery_scope_ref}`, `- audience: ${pkg.identity.audience}`, "", "## Executive summary");
  for (const c of pkg.executive_summary.delivered) L.push(`- [${c.claim_status}] ${c.subject_ref}: ${c.text}`);
  L.push(`- verified subjects: ${pkg.executive_summary.verified.join(", ") || "none"}`);
  L.push(`- limited or deferred: ${pkg.executive_summary.limited_or_deferred.join(", ") || "none"}`, "", "## Architecture summary");
  if (!pkg.architecture_summary.present) L.push("- not provided (no accepted architecture facts)");
  else {
    for (const comp of pkg.architecture_summary.components) L.push(`- component ${comp.subject_ref}: ${comp.responsibility}`);
    for (const b of pkg.architecture_summary.boundaries) L.push(`- boundary: ${b}`);
    for (const d of pkg.architecture_summary.external_dependencies) L.push(`- dependency: ${d}`);
    for (const x of pkg.architecture_summary.absent_or_deferred) L.push(`- absent or deferred: ${x}`);
  }
  L.push("", "## Setup and run");
  for (const s of pkg.setup_and_run) L.push(`- ${s.step_id}${s.optional ? " (optional)" : ""}: ${s.command_or_action} => expect: ${s.expected_signal || "n/a"}`);
  L.push("", "## Demo script");
  for (const d of pkg.demo_script) L.push(`- ${d.step_id}: ${d.action} => ${d.expected_observable_result} [fallback: ${d.fallback_or_stop_condition || "n/a"}]`);
  L.push("", "## Limitations");
  for (const l of pkg.limitations) L.push(`- [${l.severity}/${l.status}] ${l.limitation_id}: ${l.summary}`);
  if (pkg.limitations.length === 0) L.push("- none recorded");
  L.push("", "## Next steps");
  for (const n of pkg.next_steps) L.push(`- [${n.status}/${n.priority}] ${n.next_step_id}: ${n.summary}`);
  if (pkg.next_steps.length === 0) L.push("- none recorded");
  L.push("", "## Evidence index");
  for (const e of pkg.evidence_index) L.push(`- ${e.evidence_id} (${e.kind}/${e.status}) ${e.subject_ref}`);
  L.push("", "## Provenance");
  L.push(`- revision: ${pkg.provenance.revision_ref}`, `- source kinds: ${pkg.provenance.source_kinds.join(", ") || "none"}`);
  for (const c of pkg.provenance.conflict_notes) L.push(`- conflict: ${c}`);
  return L.join("\n");
}

export function synthesizeDeliveryPackage(input: DeliveryDocumentationDemoInput, prose: string): DeliveryDocumentationDemoResult {
  return synthesizeDeliveryPackageWithFeatures(input, extractDeliveryMethodFeatures(prose));
}

/** Same producer, driven by an explicit concept set — for per-feature ablation. */
export function synthesizeDeliveryPackageWithFeatures(
  input: DeliveryDocumentationDemoInput,
  features: DeliveryMethodFeatures,
): DeliveryDocumentationDemoResult {
  const blockers = validateFull(input);
  if (blockers.length > 0) return { status: "BLOCKED", blockers, package: null, coverage: { ...EMPTY_COVERAGE }, warnings: [] };

  const id = input.delivery_identity;
  const warnings: DeliveryWarning[] = [];
  const warn = (code: string, detail: string) => warnings.push({ code, detail });

  const featureFacts = input.repository_facts.filter((f) => f.kind === "KNOWN_FEATURE" || f.kind === "KNOWN_NON_FEATURE");
  const claims: DeliveryClaim[] = featureFacts
    .map((f) => {
      const { status, evidence_refs } = deriveClaimStatus(input, f, features);
      return { claim_id: f.fact_id, subject_ref: f.subject_ref, text: f.value, claim_status: status, evidence_refs };
    })
    .sort((a, b) => a.claim_id.localeCompare(b.claim_id));

  const architecture = synthesizeArchitecture(input, features);
  const setup = synthesizeSetup(input, features);
  const demo = synthesizeDemo(input, features);
  const limitations = synthesizeLimitations(input, features);
  const nextSteps = synthesizeNextSteps(input, features);
  const conflicts = detectConflicts(input);
  const evidenceIndex = synthesizeEvidenceIndex(input, features);
  const provenance = {
    revision_ref: id.revision_ref,
    baseline_revision_ref: id.baseline_revision_ref ?? null,
    accepted_ancestry_or_range_ref: id.accepted_ancestry_or_range_ref ?? null,
    source_kinds: sortStrings([
      ...input.repository_facts.map((f) => `repository_fact:${f.confidence}`),
      ...input.verification_evidence.map((e) => `verification:${e.kind}`),
      ...(input.architecture_facts && input.architecture_facts.length > 0 ? ["architecture_fact"] : []),
    ]),
    conflict_notes: [...conflicts].sort(),
  };

  const verifiedSubjects = sortStrings(claims.filter((c) => c.claim_status === "VERIFIED").map((c) => c.subject_ref));
  const limitedOrDeferred = sortStrings([
    ...claims.filter((c) => c.claim_status === "DEFERRED" || c.claim_status === "AVAILABLE_NOT_VERIFIED" || c.claim_status === "UNKNOWN").map((c) => c.subject_ref),
    ...limitations.map((l) => l.limitation_id),
  ]);

  const pkgNoMarkdown: DeliveryPackage = {
    identity: {
      project_ref: id.project_ref,
      revision_ref: id.revision_ref,
      delivery_scope_ref: id.delivery_scope_ref,
      audience: id.audience,
      ...(id.baseline_revision_ref ? { baseline_revision_ref: id.baseline_revision_ref } : {}),
      ...(id.accepted_ancestry_or_range_ref ? { accepted_ancestry_or_range_ref: id.accepted_ancestry_or_range_ref } : {}),
      ...(id.release_or_handoff_ref ? { release_or_handoff_ref: id.release_or_handoff_ref } : {}),
    },
    executive_summary: {
      delivered: claims,
      revision_ref: id.revision_ref,
      scope_ref: id.delivery_scope_ref,
      audience: id.audience,
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
    const rendered = renderMarkdown(pkgNoMarkdown);
    if (utf8Bytes(rendered) > input.policy.max_rendered_markdown_bytes) warn("MARKDOWN_OMITTED", "rendered Markdown exceeds the byte ceiling");
    else markdown = rendered;
  }
  const pkg: DeliveryPackage = { ...pkgNoMarkdown, optional_markdown_projection: markdown };

  const setupRequired = setup.filter((s) => !s.optional);
  const demoWithFallback = demo.filter((d) => d.fallback_or_stop_condition.length > 0);
  const requiredSectionsPresent =
    claims.length >= 1 && setup.length >= 1 && demo.length >= 1 && evidenceIndex.length >= 1 && provenance.source_kinds.length >= 1;

  if (!requiredSectionsPresent)
    return {
      status: "BLOCKED",
      blockers: [{ code: "REQUIRED_SECTION_MISSING", detail: "a required delivery section could not be constructed from accepted facts" }],
      package: null,
      coverage: { ...EMPTY_COVERAGE },
      warnings,
    };

  const partialReasons: string[] = [];
  if (!architecture.present) partialReasons.push("architecture summary absent (no accepted architecture facts)");
  else if (architecture.partial) partialReasons.push("architecture summary incomplete");
  if (setupRequired.length === 0) partialReasons.push("no required setup step");
  if (claims.some((c) => c.claim_status === "UNKNOWN")) partialReasons.push("one or more claims are UNKNOWN");
  if (claims.filter((c) => c.claim_status === "VERIFIED").length === 0) partialReasons.push("no verified claim");
  if ((input.next_step_candidates ?? []).length === 0) partialReasons.push("no next-step candidates supplied");
  if (input.policy.require_markdown_projection && markdown === null) partialReasons.push("Markdown projection unavailable");
  for (const c of conflicts) warn("EVIDENCE_CONFLICT", c);

  const status = partialReasons.length > 0 ? "PARTIAL" : "READY";
  for (const r of partialReasons) warn("PARTIAL_SECTION", r);

  const coverage: DeliveryCoverage = {
    required_sections_present: requiredSectionsPresent,
    setup_required_steps: setupRequired.length,
    setup_optional_steps: setup.length - setupRequired.length,
    demo_required_steps: demo.length,
    demo_steps_with_fallback: demoWithFallback.length,
    claims_total: claims.length,
    claims_with_evidence: claims.filter((c) => c.evidence_refs.length > 0).length,
    limitations_total: limitations.length,
    next_steps_total: nextSteps.length,
    evidence_refs_total: evidenceIndex.length,
    evidence_conflicts: conflicts.length,
    markdown_bytes: markdown ? utf8Bytes(markdown) : 0,
  };

  return { status, blockers: [], package: pkg, coverage, warnings };
}

function visibleRequest(statement: string): { packet: DeliveryDocumentationDemoInput; prose: string } {
  const visible = statement.split(DELIVERY_DOCUMENTATION_DEMO_INPUT_MARKER)[1]?.trimStart();
  if (!visible) throw new Error("missing visible delivery packet");
  const newline = visible.indexOf("\n");
  const json = newline < 0 ? visible : visible.slice(0, newline);
  const prose = newline < 0 ? "" : visible.slice(newline + 1);
  return { packet: JSON.parse(json) as DeliveryDocumentationDemoInput, prose };
}

export class DeliveryProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const { packet, prose } = visibleRequest(request.goal.statement);
    const candidate = synthesizeDeliveryPackage(packet, prose);
    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: "derived from the visible delivery facts and the visible method prose",
        output: { summary: "delivery package", data: candidate as unknown as Record<string, unknown> },
      },
    };
  }
}
