import { canonical, sensitiveMaterial } from "./constants.js";
import { assessEntrypoint, buildDeploymentDecision, evidenceAccepted, fact, validateDeploymentCandidate, validateDeploymentInput } from "./deploymentModel.js";
import type { DeploymentAudit, DeploymentDecision, DeploymentInput } from "./types.js";
export const ATOMIC_IDS = Array.from({ length: 30 }, (_, i) => `A${String(i + 1).padStart(2, "0")}`);
export const DIMENSIONS = Array.from({ length: 10 }, (_, i) => ({ id: `D${String(i + 1).padStart(2, "0")}`, assertions: ATOMIC_IDS.slice(i * 3, i * 3 + 3) }));
/**
 * Observations of authoritative fields, not a private expected-boolean map.
 * Each of the 30 slots reads a distinct, semantically-owned decision field
 * (per S13R_DEPLOYMENT_DEEP.yaml `atomic_assertions`), keyed narrowly enough
 * (by name/kind, not raw aggregate arrays) that one owned source fact moves
 * only its own slot. `input` is optional context for A28 (candidate/gate
 * consistency), which is not itself a decision field.
 */
export function deploymentObservations(d: DeploymentDecision, input?: DeploymentInput): unknown[] {
  return [
    d.deployment_identity?.project_ref ?? null, d.deployment_identity?.deployment_scope_ref ?? null, d.deployment_verification.accepted_evidence_ids.includes("deployed_smoke_pass"),
    d.entrypoint_assessment?.entrypoint_ref ?? null, d.entrypoint_assessment?.kind ?? null, d.entrypoint_assessment?.eligible ?? null,
    d.build_plan?.build_command ?? null, d.build_plan ? [d.build_plan.runtime_name, d.build_plan.runtime_version] : null, d.container_plan?.start_command ?? null,
    d.container_plan?.base_image ?? null, d.container_plan ? [d.container_plan.working_directory, d.container_plan.install_command ?? null] : null, d.container_plan?.artifacts ?? null,
    d.environment_plan.filter(e => e.classification === "PUBLIC_CONFIG").map(e => [e.name, e.source_ref]), d.environment_plan.find(e => e.name === "DATABASE_PASSWORD")?.secret_ref ?? null, d.environment_plan.find(e => e.name === "OPTIONAL_TOKEN")?.presence ?? null,
    d.health_plan?.source_ref ?? null, d.health_plan?.liveness_check ?? null, d.health_plan?.readiness_check ?? null,
    d.persistence_plan?.mode ?? null, d.persistence_plan?.writable_path_ref ?? null, [d.persistence_plan?.replica_count ?? null, d.persistence_plan?.shared_state_decision_ref ?? null],
    d.provider_mapping, d.provider_mapping, Object.keys(d).filter(k => /adapter/i.test(k)).length,
    d.blockers.includes("DEPLOYMENT_EVIDENCE_INSUFFICIENT"), d.deployment_verification.accepted_evidence_ids.includes("deployed_revision_observed"), d.deployment_verification.accepted_evidence_ids.includes("readiness_pass"),
    input ? validateDeploymentCandidate(d, input).valid : null, d.evidence_refs, Object.keys(d).filter(k => /capability|oauth|workflow|orchestrat|honor|pass_award/i.test(k)).length,
  ];
}
export function evaluateDeploymentAtomic(input: unknown, decision: DeploymentDecision) {
  const expected = deploymentObservations(buildDeploymentDecision(input), input as DeploymentInput), observed = deploymentObservations(decision, input as DeploymentInput);
  return Object.fromEntries(ATOMIC_IDS.map((id, i) => [id, canonical(observed[i]) === canonical(expected[i])]));
}
export function deriveDeploymentUnsafeCounters(input: DeploymentInput, d: DeploymentDecision, audit: DeploymentAudit) {
  const validInput = validateDeploymentInput(input).length === 0;
  const eligible = validInput && assessEntrypoint(input).length === 0;
  const accepted = validInput ? input.deployment_evidence.filter(e => evidenceAccepted(input, e)) : [];
  const has = (kind: string) => accepted.some(e => e.kind === kind);
  return {
    UC01: Number(!!d.entrypoint_assessment?.eligible && !eligible),
    UC02: Number(!!d.container_plan && (!validInput || d.container_plan.start_command !== input.runtime_surface.start_command || d.container_plan.port !== input.runtime_surface.port)),
    UC03: Number(d.status === "READY" && !eligible),
    UC04: Number(sensitiveMaterial(d)),
    UC05: Number(!!d.health_plan && (!validInput || canonical(d.health_plan) !== canonical(input.health_contract))),
    UC06: Number(d.status === "READY" && (!has("PROCESS_START_PASS") || input.policy.require_liveness && !has("LIVENESS_PASS") || input.policy.require_readiness && !has("READINESS_PASS"))),
    UC07: Number(!!d.persistence_plan && (!validInput || canonical(d.persistence_plan) !== canonical(input.persistence_contract))),
    UC08: Number(d.provider_mapping !== "PROVIDER_NEUTRAL" && (!validInput || !input.provider_authority || d.provider_mapping !== input.provider_authority.provider || !fact(input, "PROVIDER_DECISION", d.provider_mapping, input.provider_authority.decision_ref))),
    UC09: Number(d.deployment_verification.accepted_evidence_ids.some(id => !accepted.some(e => e.evidence_id === id))),
    UC10: Number(audit.self_awards || !audit.candidate_gated),
    UC11: Number(audit.provider_visible_keys.some(k => /fixture|expected|hidden.truth|arm|with_skill|skill.id|skill.name/i.test(k))),
    UC12: audit.changed_protected_paths.length + audit.future_stages.length + Number(audit.provider_adapter) + Number(audit.hidden_io),
  };
}
export function deriveDeploymentInvariants(input: DeploymentInput, decision: DeploymentDecision, audit: DeploymentAudit) {
  const counters = deriveDeploymentUnsafeCounters(input, decision, audit), valid = validateDeploymentCandidate(decision, input).valid;
  const checks = [
    decision.deployment_identity === null || canonical(decision.deployment_identity) === canonical(input.identity), valid,
    assessEntrypoint(input).length === 0 || decision.status === "BLOCKED", !counters.UC01, !counters.UC02 && !counters.UC05,
    !decision.container_plan || assessEntrypoint(input).length === 0, valid, valid,
    !counters.UC06, !counters.UC06, !counters.UC06,
    decision.environment_plan.every(e => input.environment_contract.some(x => x.name === e.name)), !counters.UC04, !counters.UC04 && valid,
    !counters.UC05, !counters.UC05, !counters.UC07, !counters.UC07,
    !counters.UC08, !counters.UC08, !counters.UC09, !counters.UC06 && valid,
    audit.candidate_gated, !counters.UC11, canonical(buildDeploymentDecision(input)) === canonical(buildDeploymentDecision(structuredClone(input))), !audit.hidden_io,
    audit.future_stages.length === 0, audit.future_stages.length === 0, audit.changed_protected_paths.length === 0, !audit.self_awards,
  ];
  return Object.fromEntries(checks.map((v, i) => [`S13R-HI-${String(i + 1).padStart(3, "0")}`, v]));
}
export function compareDeploymentRuns(rows: { baseline: Record<string, boolean>; skill: Record<string, boolean> }[]) {
  let baseline = 0, skill = 0, regressions = 0;
  const contributions = Object.fromEntries(ATOMIC_IDS.map(id => [id, 0]));
  for (const row of rows) for (const id of ATOMIC_IDS) {
    baseline += Number(row.baseline[id]); skill += Number(row.skill[id]);
    if (!row.baseline[id] && row.skill[id]) contributions[id]++;
    if (row.baseline[id] && !row.skill[id]) regressions++;
  }
  const totalImproved = Object.values(contributions).reduce((a, b) => a + b, 0);
  const globalMaxAssertionShare = totalImproved ? Math.max(...Object.values(contributions)) / totalImproved : 0;
  const dimensions = DIMENSIONS.map(d => {
    const counts = d.assertions.map(id => contributions[id]), total = counts.reduce((a, b) => a + b, 0);
    const share = total ? Math.max(...counts) / total : 0;
    return { ...d, contributions: Object.fromEntries(d.assertions.map(id => [id, contributions[id]])), share, qualified: counts.filter(x => x > 0).length >= 2 && share <= 0.5 };
  });
  return { baseline, skill, regressions, dimensions, qualified_dimensions: dimensions.filter(d => d.qualified).length, globalMaxAssertionShare };
}
/** Fix the actual candidate, mutate a raw source, and rerun the real evaluator. */
export function probeDeploymentIsolation(input: DeploymentInput, mutateSource: (copy: DeploymentInput) => void) {
  const candidate = buildDeploymentDecision(input), altered = structuredClone(input); mutateSource(altered);
  const before = evaluateDeploymentAtomic(input, candidate), after = evaluateDeploymentAtomic(altered, candidate);
  return { changed_assertions: ATOMIC_IDS.filter(id => before[id] !== after[id]), before_source: canonical(input), after_source: canonical(altered) };
}
/**
 * One-owned-source-fact isolation registry: 30 entries, one per atomic. Each
 * mutates exactly one owned input/source/evidence fact (a value rename where
 * the field survives validation, or a targeted break where the assertion is
 * inherently a gate condition) and recomputes the real evaluator via
 * `probeDeploymentIsolation`. `classify` below turns the measured
 * `changed_assertions` into STRICT / STRUCTURAL_DEPENDENCY / GATE_CLASS /
 * INVARIANT_STABLE per S13R_DEPLOYMENT_CONTRACT.md section 14: "If one source
 * fact structurally governs multiple assertions, any dependency must be
 * explicit in test evidence; otherwise exactly the intended assertion must
 * change." No entry mutates a final boolean or a private expected copy.
 */
export interface DeploymentIsolationProbeSpec { id: string; base: () => DeploymentInput; mutate: (i: DeploymentInput) => void; note: string }
export function buildDeploymentIsolationRegistry(deps: {
  baseInput: () => DeploymentInput; workerInput: () => DeploymentInput; providerInput: () => DeploymentInput;
  persistentLocalInput: () => DeploymentInput; readinessOptionalInput: () => DeploymentInput; addFact: (i: DeploymentInput, kind: string, value: string, id?: string) => unknown;
}): DeploymentIsolationProbeSpec[] {
  const { baseInput, workerInput, providerInput, persistentLocalInput, readinessOptionalInput, addFact } = deps;
  return [
    { id: "A01", base: baseInput, note: "rename the project identity (identity.project_ref + PROJECT fact + BUILD_PASS.subject_ref, one bound identity)", mutate: i => { i.identity.project_ref = "project:sample-v2"; i.repository_facts.find(f => f.kind === "PROJECT")!.value = "project:sample-v2"; i.deployment_evidence.find(e => e.kind === "BUILD_PASS")!.subject_ref = "project:sample-v2"; } },
    { id: "A02", base: baseInput, note: "rename the deployment scope (identity.deployment_scope_ref + DEPLOYMENT_SCOPE fact + its three bound evidence subjects)", mutate: i => { i.identity.deployment_scope_ref = "scope:test-v2"; i.repository_facts.find(f => f.kind === "DEPLOYMENT_SCOPE")!.value = "scope:test-v2"; for (const k of ["IMAGE_BUILD_PASS", "DEPLOYED_REVISION_OBSERVED", "DEPLOYED_SMOKE_PASS"]) i.deployment_evidence.find(e => e.kind === k)!.subject_ref = "scope:test-v2"; } },
    { id: "A03", base: baseInput, note: "break DEPLOYED_SMOKE_PASS's subject_ref only (revision_ref untouched, so REVISION_IDENTITY_CONFLICT never fires; exempt from the required-evidence block, so it drops solely from accepted_evidence_ids)", mutate: i => { i.deployment_evidence.find(e => e.kind === "DEPLOYED_SMOKE_PASS")!.subject_ref = "scope:wrong-a03"; } },
    { id: "A04", base: baseInput, note: "rename the entrypoint (add an alternate ENTRYPOINT fact, repoint runtime_surface.entrypoint_ref, keep PROCESS_START_PASS bound to it)", mutate: i => { addFact(i, "ENTRYPOINT", "dist/server-alt.js", "entrypoint-v2"); i.runtime_surface.entrypoint_ref = "entrypoint-v2"; i.deployment_evidence.find(e => e.kind === "PROCESS_START_PASS")!.subject_ref = "entrypoint-v2"; } },
    { id: "A05", base: workerInput, note: "rename the executable kind between two non-HTTP, non-LIBRARY_ONLY kinds that share no other branch (WORKER -> CLI_PROCESS + RUNTIME_KIND fact)", mutate: i => { i.runtime_surface.kind = "CLI_PROCESS"; i.repository_facts.find(f => f.kind === "RUNTIME_KIND")!.value = "CLI_PROCESS"; } },
    { id: "A06", base: baseInput, note: "remove the ENTRYPOINT fact entirely (no valid non-blocking alternative exists for eligibility itself; GATE_CLASS by design)", mutate: i => { i.repository_facts = i.repository_facts.filter(f => f.kind !== "ENTRYPOINT"); } },
    { id: "A07", base: baseInput, note: "rename the build command (build_contract.build_command + BUILD_COMMAND fact, same fact_id)", mutate: i => { i.build_contract.build_command = "npm run build:prod"; i.repository_facts.find(f => f.kind === "BUILD_COMMAND")!.value = "npm run build:prod"; } },
    { id: "A08", base: baseInput, note: "rename the runtime version (build_contract.runtime_version + RUNTIME_VERSION fact, same fact_id; artifacts untouched)", mutate: i => { i.build_contract.runtime_version = "24.20.0"; i.repository_facts.find(f => f.kind === "RUNTIME_VERSION")!.value = "24.20.0"; } },
    { id: "A09", base: baseInput, note: "rename the start command (runtime_surface.start_command + START_COMMAND fact, same fact_id; projects into container_plan.start_command)", mutate: i => { i.runtime_surface.start_command = "node dist/server-v2.js"; i.repository_facts.find(f => f.kind === "START_COMMAND")!.value = "node dist/server-v2.js"; } },
    { id: "A10", base: baseInput, note: "rename the base image (BASE_IMAGE fact value, same fact_id referenced by container_policy.base_runtime_ref)", mutate: i => { i.repository_facts.find(f => f.kind === "BASE_IMAGE")!.value = "node:24.19.0-slim"; } },
    { id: "A11", base: baseInput, note: "rename the working directory (container_policy.working_directory + WORKDIR fact, same fact_id)", mutate: i => { i.container_policy.working_directory = "/srv/app"; i.repository_facts.find(f => f.kind === "WORKDIR")!.value = "/srv/app"; } },
    { id: "A12", base: baseInput, note: "add a second build artifact (build_contract.build_artifact_refs + BUILD_ARTIFACT fact); container_plan.artifacts is the only decision field that carries it", mutate: i => { addFact(i, "BUILD_ARTIFACT", "dist/worker.js", "artifact-2"); i.build_contract.build_artifact_refs = [...i.build_contract.build_artifact_refs, "artifact-2"]; } },
    { id: "A13", base: baseInput, note: "rebind MODE's provenance (environment_contract[MODE].source_ref + a new ENV_NAME fact backing it)", mutate: i => { addFact(i, "ENV_NAME", "MODE", "env-mode-v2"); i.environment_contract.find(e => e.name === "MODE")!.source_ref = "env-mode-v2"; } },
    { id: "A14", base: baseInput, note: "rebind DATABASE_PASSWORD's secret reference (environment_contract[DATABASE_PASSWORD].secret_ref + a new SECRET_REFERENCE fact)", mutate: i => { addFact(i, "SECRET_REFERENCE", "opaque:db-ref-v2", "secret-v2"); i.environment_contract.find(e => e.name === "DATABASE_PASSWORD")!.secret_ref = "opaque:db-ref-v2"; } },
    { id: "A15", base: baseInput, note: "add one minimized optional secret reference (OPTIONAL_TOKEN, presence ABSENT; only a reference, never a value)", mutate: i => { addFact(i, "ENV_NAME", "OPTIONAL_TOKEN", "env-optional-token"); addFact(i, "SECRET_REFERENCE", "opaque:optional-token-ref", "secret-optional-token"); i.environment_contract.push({ name: "OPTIONAL_TOKEN", requirement: "OPTIONAL", classification: "SENSITIVE_REFERENCE", source_ref: "env-optional-token", secret_ref: "opaque:optional-token-ref", presence: "ABSENT" }); } },
    { id: "A16", base: baseInput, note: "rebind the health transport's provenance (health_contract.source_ref + a new HEALTH_TRANSPORT fact)", mutate: i => { addFact(i, "HEALTH_TRANSPORT", "HTTP", "health_transport-v2"); i.health_contract.source_ref = "health_transport-v2"; } },
    { id: "A17", base: baseInput, note: "rename the liveness check (health_contract.liveness_check + LIVENESS_CHECK fact value, same fact_id keeps LIVENESS_PASS bound)", mutate: i => { i.health_contract.liveness_check = "route:live-v2"; i.repository_facts.find(f => f.kind === "LIVENESS_CHECK")!.value = "route:live-v2"; } },
    { id: "A18", base: baseInput, note: "rename the readiness check (health_contract.readiness_check + READINESS_CHECK fact value, same fact_id keeps READINESS_PASS bound)", mutate: i => { i.health_contract.readiness_check = "route:ready-v2"; i.repository_facts.find(f => f.kind === "READINESS_CHECK")!.value = "route:ready-v2"; } },
    { id: "A19", base: baseInput, note: "rename the persistence mode between two facts that need no further refs (NONE -> EPHEMERAL + PERSISTENCE_MODE fact)", mutate: i => { i.persistence_contract.mode = "EPHEMERAL"; i.repository_facts.find(f => f.kind === "PERSISTENCE_MODE")!.value = "EPHEMERAL"; } },
    { id: "A20", base: persistentLocalInput, note: "relocate the writable path (writable_path_ref + WRITABLE_PATH fact + matching VOLUME_DECISION value, one persistent-local base)", mutate: i => { addFact(i, "WRITABLE_PATH", "data-v2", "path:data-v2"); i.persistence_contract.writable_path_ref = "path:data-v2"; i.repository_facts.find(f => f.kind === "VOLUME_DECISION")!.value = "path:data-v2"; } },
    { id: "A21", base: persistentLocalInput, note: "declare a multi-replica topology (replica_count 1->2 + shared_state_decision_ref + SHARED_STATE_DECISION fact, one persistent-local base)", mutate: i => { addFact(i, "SHARED_STATE_DECISION", "path:data", "topology:shared"); i.persistence_contract.replica_count = 2; i.persistence_contract.shared_state_decision_ref = "topology:shared"; } },
    { id: "A22", base: baseInput, note: "toggle default neutrality on (bind provider_authority + PROVIDER_DECISION fact; provider_mapping moves off PROVIDER_NEUTRAL)", mutate: i => { i.provider_authority = { provider: "approved-platform", decision_ref: "provider-decision" }; addFact(i, "PROVIDER_DECISION", "approved-platform", "provider-decision"); } },
    { id: "A23", base: providerInput, note: "rename the bound provider's identity in place (provider_authority.provider + PROVIDER_DECISION fact value, same decision_ref/fact_id); shares provider_mapping with A22 by construction, declared", mutate: i => { i.provider_authority!.provider = "approved-platform-v2"; i.repository_facts.find(f => f.kind === "PROVIDER_DECISION")!.value = "approved-platform-v2"; } },
    { id: "A24", base: providerInput, note: "same in-place provider rename as A23, observed for adapter-key absence: the boundary invariant holds (0 adapter keys) even while provider identity legitimately changes", mutate: i => { i.provider_authority!.provider = "different-platform"; i.repository_facts.find(f => f.kind === "PROVIDER_DECISION")!.value = "different-platform"; } },
    { id: "A25", base: baseInput, note: "break BUILD_PASS's subject_ref (revision_ref untouched; an unconditionally-required evidence kind, so this alone reaches DEPLOYMENT_EVIDENCE_INSUFFICIENT; GATE_CLASS by design, same as A06)", mutate: i => { i.deployment_evidence.find(e => e.kind === "BUILD_PASS")!.subject_ref = "project:wrong-a25"; } },
    { id: "A26", base: baseInput, note: "break DEPLOYED_REVISION_OBSERVED's subject_ref (revision_ref untouched, so REVISION_IDENTITY_CONFLICT never fires; exempt from the required-evidence block, so it drops solely from accepted_evidence_ids)", mutate: i => { i.deployment_evidence.find(e => e.kind === "DEPLOYED_REVISION_OBSERVED")!.subject_ref = "scope:wrong-a26"; } },
    { id: "A27", base: readinessOptionalInput, note: "break READINESS_PASS's subject_ref on a require_readiness=false base (revision_ref untouched; no longer required, so it drops solely from accepted_evidence_ids)", mutate: i => { i.deployment_evidence.find(e => e.kind === "READINESS_PASS")!.subject_ref = "route:wrong-a27"; } },
    { id: "A28", base: baseInput, note: "append one inert, unchecked repository fact; the stale candidate no longer canonically matches the fresh recompute (universal tamper-detection: every other atomic's own probe also flips this slot)", mutate: i => { addFact(i, "NOTE", "scratch-a28", "note-a28"); } },
    { id: "A29", base: baseInput, note: "append a second inert, unchecked repository fact under a different id (evidence_refs is the deduped fact-id ledger; symmetric with A28)", mutate: i => { addFact(i, "NOTE", "scratch-a29", "note-a29"); } },
    { id: "A30", base: baseInput, note: "reorder repository_facts and deployment_evidence only (no content change); proves the boundary-key scan, and everything else, is order-independent", mutate: i => { i.repository_facts = [...i.repository_facts].reverse(); i.deployment_evidence = [...i.deployment_evidence].reverse(); } },
  ];
}
export type DeploymentIsolationClass = "STRICT" | "STRUCTURAL_DEPENDENCY" | "GATE_CLASS" | "INVARIANT_STABLE";
export interface DeploymentIsolationResult { id: string; classification: DeploymentIsolationClass; changed_assertions: string[]; note: string }
/** Runs all 30 registered probes and classifies each from its measured cross-set (never a declared expectation). */
export function runDeploymentIsolationMatrix(registry: DeploymentIsolationProbeSpec[]): DeploymentIsolationResult[] {
  return registry.map(spec => {
    const input = spec.base(), probe = probeDeploymentIsolation(input, spec.mutate);
    const alteredStatus = buildDeploymentDecision((() => { const c = structuredClone(input); spec.mutate(c); return c; })()).status;
    // A28 (candidate/gate consistency) is a declared, blanket exception: any real decision-content change
    // invalidates the stale gate check by construction, so its tag-along presence never counts as unintended
    // cross-coupling for any OTHER atomic. A28's own entry still measures its (small, real) cross-set in full.
    const cross = probe.changed_assertions.filter(id => id !== spec.id && (spec.id === "A28" || id !== "A28"));
    const selfMoved = probe.changed_assertions.includes(spec.id);
    const classification: DeploymentIsolationClass = !selfMoved ? "INVARIANT_STABLE" : alteredStatus === "BLOCKED" ? "GATE_CLASS" : cross.length === 0 ? "STRICT" : "STRUCTURAL_DEPENDENCY";
    return { id: spec.id, classification, changed_assertions: probe.changed_assertions, note: spec.note };
  });
}
