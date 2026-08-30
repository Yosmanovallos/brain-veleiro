import { AGENT_EVALS_ATOMIC_IDS, AGENT_EVALS_DIMENSIONS } from "./constants.js";
import { deriveAgentEvalDecision, deriveAgentEvalDecisionFromSourceFacts, deriveAgentEvalSourceFacts, evaluateAgentEvalCandidateGate, validateAgentEvalCandidate, validateAgentEvalInput } from "./evaluateAgentEval.js";
import { evaluateAtomicObservation, mutateAgentEvalSourceFact } from "./atomicObservation.js";
import type { PlanAgentEvalsOutcome } from "./planAgentEvals.js";
import type { AgentEvalDecision, AgentEvalInput, AgentEvalSourceSnapshot, AgentEvalUnsafeCounters } from "./types.js";

export interface AgentEvalArm { inputs: readonly AgentEvalInput[]; outcomes: readonly PlanAgentEvalsOutcome[]; }
export interface AgentEvalDimensionImpact { delta: number; contribution_counts: Record<string, number>; denominator: number; max_single_assertion_share: number; qualified: boolean; }
export interface AgentEvalComparison { baseline_total_atomic_passes: number; skill_total_atomic_passes: number; delta: number; regressions: string[]; by_dimension: Record<string, AgentEvalDimensionImpact>; qualified_dimensions: string[]; hard_invariants: Record<string, boolean>; hard_invariant_evidence: Record<string, string>; unsafe_counters: AgentEvalUnsafeCounters; meets_impact_gate: boolean; }
export interface AgentEvalComparisonEvidence { sources: AgentEvalSourceSnapshot; }

type ProbeSet = ReturnType<typeof runAdversarialProbes>;
type SourceAudit = ReturnType<typeof auditAgentEvalSourceSnapshot>;

export const S13N_PROTECTED_PRIOR_PATHS = [
  "brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md",
  "src/core/agent/runtime.ts",
  "src/core/agent/types.ts",
  "src/core/agent/restrictedCapabilityProvider.ts",
  "brain-bootstrap/specs/AGENT_DEFINITION_v1.md",
  "src/core/agent/definition.ts",
  "src/core/agent/compileDefinition.ts",
  "src/core/agent/validateDefinition.ts",
  "brain-bootstrap/specs/SKILL_CONTRACT_v1.md",
  "src/core/skill/types.ts",
  "src/core/skill/validateSkillDefinition.ts",
  "src/core/skill/descriptor.ts",
  "src/core/skill/index.ts",
  "src/providers/skill/localReferenceSkillProvider.ts",
  "brain-bootstrap/skills/GUARDRAILS_SECURITY_SKILL_S13L.md",
  "brain-bootstrap/quality-contracts/S13L_GUARDRAILS_SECURITY_DEEP.yaml",
  "brain-bootstrap/specs/GUARDRAILS_SECURITY_CONTRACT_S13L.md",
  "src/intelligence/guardrails-security/types.ts",
  "src/intelligence/guardrails-security/planGuardrailsSecurity.ts",
  "src/intelligence/guardrails-security/modeling.ts",
  "src/intelligence/guardrails-security/compareGuardrailsSecurityRuns.ts",
  "brain-bootstrap/skills/QA_DEBUGGING_SKILL_S13M.md",
  "brain-bootstrap/quality-contracts/S13M_QA_DEBUGGING_DEEP.yaml",
  "brain-bootstrap/specs/QA_DEBUGGING_CONTRACT_S13M.md",
  "src/intelligence/qa-debugging/types.ts",
  "src/intelligence/qa-debugging/planQaDebugging.ts",
  "src/intelligence/qa-debugging/modeling.ts",
  "src/intelligence/qa-debugging/compareQaDebuggingRuns.ts",
] as const;

const S13N_PART_A_BLOBS: Readonly<Record<string, string>> = {
  "brain-bootstrap/skills/AGENT_EVALS_SKILL_S13N.md": "38a7673578d5164b303927bc4752aa61c4b75bc5",
  "brain-bootstrap/quality-contracts/S13N_AGENT_EVALS_DEEP.yaml": "6f8c621c508477cd9fd553f7cd22e44310f602c0",
  "brain-bootstrap/specs/AGENT_EVALS_CONTRACT_S13N.md": "14d695fa6a98720cb465d6e881a0c560b279b486",
};

const clone = <T>(value: T): T => structuredClone(value);
const atomic = (decision: AgentEvalDecision, id: string) => decision.dimensions.flatMap((dimension) => dimension.atomic_results).find((entry) => entry.assertion_id === id);
const postGateObservations = (outcome: PlanAgentEvalsOutcome): Record<string, boolean> => Object.fromEntries(AGENT_EVALS_ATOMIC_IDS.map((id) => [id, outcome.gate.observations[id]?.correct === true]));

export function auditAgentEvalSourceSnapshot(snapshot: AgentEvalSourceSnapshot) {
  const providerImports = snapshot.provider_source.split(/\r?\n/).filter((line) => /^\s*import\b/.test(line)).join("\n");
  const providerExecutable = snapshot.provider_source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const boundedSource = [snapshot.provider_source, snapshot.evaluator_source, snapshot.planner_source, snapshot.skill_source].join("\n");
  const retryPullForward = /\b(retryEngine|backoffPolicy|idempotencyEngine|asyncJob)\b/i.test(boundedSource);
  const observabilityPullForward = /\b(telemetryExporter|tracingExporter|monitoringDashboard)\b/i.test(boundedSource);
  const capabilityPlatformPullForward = /\b(capabilityRegistry|mcpConnector)\b/i.test(boundedSource);
  const verifierAgentPullForward = /\bverifierAgent\b/i.test(boundedSource);
  const s13mMechanicsPullForward = /\b(rootCauseAnalyzer|debugReproducer|fixPrescription|regressionSuiteSelector)\b/i.test(boundedSource);
  const futurePullForward = retryPullForward || observabilityPullForward || capabilityPlatformPullForward || verifierAgentPullForward;
  const providerForbiddenImport = /(?:fixtures?|evaluateAgentEval|compareAgentEvalRuns|truthBuilder|goldenTruth)/i.test(providerImports);
  const hiddenBranch = /\b(?:if|switch)\s*\([^)]*\b(case_id|truth_ref|frozen_truth|expected_values?|expected_capabilit(?:y|ies)|withSkill|withoutSkill|arm_marker|fixtureTruth)\b|\b(case_id|truth_ref|frozen_truth|expected_values?|expected_capabilit(?:y|ies)|withSkill|withoutSkill|arm_marker|fixtureTruth)\b\s*(?:===|!==|\?)/.test(providerExecutable);
  const normalize = (path: string) => path.replaceAll("\\", "/");
  const allowedCommittedPath = (path: string): boolean => /^(src\/intelligence\/agent-evals\/|tests\/agent-evals\/|src\/intelligence\/skills\/index\.ts$|brain-bootstrap\/STATE\.yaml$|brain\/context\/CURRENT\.md$|brain-bootstrap\/reports\/S13N-agent-evals-verification\.md$|brain\/context\/handoffs\/[^/]*s13n[^/]*\.md$|tests\/(?:guardrails-security\/guardrailsSecurity|repository-git-workflow\/repositoryGitWorkflow)\.test\.ts$|brain-bootstrap\/(?:skills\/AGENT_EVALS_SKILL_S13N\.md|quality-contracts\/S13N_AGENT_EVALS_DEEP\.yaml|specs\/AGENT_EVALS_CONTRACT_S13N\.md)$)/i.test(normalize(path));
  const committedRangeValid = snapshot.committed_range.base === "e73bcb10abbc1835e64836a8f957c045e583478b"
    && /^[0-9a-f]{40}$/.test(snapshot.committed_range.head)
    && snapshot.committed_range.head !== snapshot.committed_range.base
    && snapshot.committed_range.changed_paths.length > 0
    && snapshot.committed_range.changed_paths.every(allowedCommittedPath);
  const protectedSurfacesPreserved = S13N_PROTECTED_PRIOR_PATHS.every((path) => snapshot.expected_protected_blobs[path] !== undefined && snapshot.expected_protected_blobs[path] === snapshot.actual_protected_blobs[path]);
  const partAPreserved = Object.entries(S13N_PART_A_BLOBS).every(([path, blob]) => snapshot.expected_part_a_blobs[path] === blob && snapshot.actual_part_a_blobs[path] === blob);
  return {
    providerForbiddenImport,
    hiddenBranch,
    futurePullForward,
    retryPullForward,
    observabilityPullForward,
    capabilityPlatformPullForward,
    verifierAgentPullForward,
    s13mMechanicsPullForward,
    coreSpecialBranch: /agent-evals|S13N/i.test(snapshot.core_sources),
    newAgentDefinition: /\b(?:const|let|var)\s+\w+\s*:\s*AgentDefinition\s*=/.test(snapshot.skill_source + snapshot.evaluator_source),
    newCapabilityBinding: /implements\s+CapabilityProvider|class\s+\w*CapabilityProvider|\.invoke\(/.test(snapshot.skill_source + snapshot.evaluator_source + snapshot.planner_source),
    providerVendorBinding: /from\s+["'][^"']*(openai|anthropic|langsmith|datadog|github-actions)/i.test(providerImports),
    packageUnchanged: JSON.stringify(JSON.parse(snapshot.package_json_before)) === JSON.stringify(JSON.parse(snapshot.package_json_after)),
    priorContractsPreserved: committedRangeValid && protectedSurfacesPreserved && partAPreserved,
  };
}

function runAdversarialProbes(input: AgentEvalInput, outcome: PlanAgentEvalsOutcome) {
  const providerAudit = outcome.providerAudit;
  const wrongOutput = clone(input); (wrongOutput.observed_run.output!.data!.decision as Record<string, unknown>).status = "wrong";
  const missingOutput = clone(input); delete missingOutput.observed_run.output!.data!.decision;
  const forbidden = clone(input); forbidden.observed_run.tool_descriptors = [{ capability_id: "forbidden.tool", side_effects: "NONE" }]; forbidden.observed_run.events.splice(1, 0, { event_id: "probe:forbidden", run_id: forbidden.observed_run.run_id, sequence: 2, timestamp: "2026-08-30T00:00:00.050Z", type: "TOOL_REQUESTED", capability_id: "forbidden.tool", side_effects: "NONE", outcome: "BLOCKED" }); forbidden.observed_run.events[2]!.sequence = 3;
  const safeBlock = clone(input); safeBlock.observed_run.outcome = "BLOCKED"; safeBlock.observed_run.termination.outcome = "BLOCKED"; safeBlock.observed_run.termination.reason_code = "POLICY_BLOCK";
  const weakenedBlock = clone(input); weakenedBlock.frozen_truth.safety_assertions = [{ assertion_id: "safety-sensitive", kind: "REQUIRE_SAFE_BLOCK", policy_ref: "policy:block" }]; weakenedBlock.golden_case.policy_refs = ["policy:block"]; weakenedBlock.golden_case.safety_expectation.policy_refs = ["policy:block"]; weakenedBlock.evidence = [{ evidence_ref: "policy:block", claim_ref: "policy:block", relationship: "SUPPORTS", source_type: "PRIMARY", locator_ref: "policy", observed_run_id: weakenedBlock.observed_run.run_id, policy_ref: "policy:block", limitations: [] }];
  const missingTrace = clone(input); missingTrace.observed_run.termination.triggering_event_id = "missing:event";
  const optionalCost = clone(input); delete optionalCost.observed_run.usage!.cost_amount; delete optionalCost.observed_run.usage!.cost_currency;
  const optionalLatency = clone(input); optionalLatency.observed_run.events[0]!.type = "MODEL_REQUESTED";
  const requiredCost = clone(optionalCost); requiredCost.golden_case.efficiency_expectation.cost!.requirement = "REQUIRED";
  const currencyMismatch = clone(input); currencyMismatch.golden_case.efficiency_expectation.cost!.requirement = "REQUIRED"; currencyMismatch.observed_run.usage!.cost_currency = "EUR";
  const contradiction = clone(input); contradiction.evidence.push({ evidence_ref: "probe:contradiction", claim_ref: "task-output", relationship: "CONTRADICTS", source_type: "DIRECT_OBSERVATION", locator_ref: "probe", observed_run_id: contradiction.observed_run.run_id, limitations: [] });
  const malformedCandidateBlocked = (() => { try { const malformed = {}; return evaluateAgentEvalCandidateGate(malformed, malformed, input, providerAudit).decision.status === "BLOCKED" && !validateAgentEvalCandidate(malformed).valid; } catch { return false; } })();
  const alteredCandidate = clone(outcome.candidate) as AgentEvalDecision; for (const item of alteredCandidate.dimensions.flatMap((dimension) => dimension.atomic_results)) item.result = "INCONCLUSIVE";
  const alteredGate = evaluateAgentEvalCandidateGate(alteredCandidate, alteredCandidate, input, providerAudit);
  const candidateClaimsIgnored = JSON.stringify(alteredGate.decision) === JSON.stringify(outcome.gate.decision);
  const optionalDecision = deriveAgentEvalDecision(optionalCost, providerAudit), optionalLatencyDecision = deriveAgentEvalDecision(optionalLatency, providerAudit), requiredDecision = deriveAgentEvalDecision(requiredCost, providerAudit), currencyDecision = deriveAgentEvalDecision(currencyMismatch, providerAudit), forbiddenDecision = deriveAgentEvalDecision(forbidden, providerAudit), weakenedDecision = deriveAgentEvalDecision(weakenedBlock, providerAudit), wrongDecision = deriveAgentEvalDecision(wrongOutput, providerAudit), missingDecision = deriveAgentEvalDecision(missingOutput, providerAudit), safeBlockDecision = deriveAgentEvalDecision(safeBlock, providerAudit), contradictionDecision = deriveAgentEvalDecision(contradiction, providerAudit), missingTraceDecision = deriveAgentEvalDecision(missingTrace, providerAudit);
  const noCostInvented = optionalDecision.observed_metrics.cost_amount === undefined && optionalDecision.observed_metrics.cost_currency === undefined;
  const noLatencyInvented = optionalLatencyDecision.observed_metrics.latency_ms === undefined;
  let isolationPasses = 0;
  const baseSources = deriveAgentEvalSourceFacts(input, providerAudit), baseDecision = deriveAgentEvalDecisionFromSourceFacts(input, baseSources), baseObservation = evaluateAtomicObservation(baseDecision), sourceSnapshot = JSON.stringify(baseSources);
  for (const id of AGENT_EVALS_ATOMIC_IDS) { const detached = clone(baseSources); mutateAgentEvalSourceFact(detached, id); const changed = AGENT_EVALS_ATOMIC_IDS.filter((key) => JSON.stringify(baseObservation[key]) !== JSON.stringify(evaluateAtomicObservation(deriveAgentEvalDecisionFromSourceFacts(input, detached))[key])); if (changed.length === 1 && changed[0] === id && JSON.stringify(baseSources) === sourceSnapshot && detached !== baseSources && detached[id] !== baseSources[id]) isolationPasses++; }
  return { wrongDecision, missingDecision, forbiddenDecision, safeBlockDecision, weakenedDecision, missingTraceDecision, optionalDecision, optionalLatencyDecision, requiredDecision, currencyDecision, contradictionDecision, malformedCandidateBlocked, candidateClaimsIgnored, noCostInvented, noLatencyInvented, isolationPasses };
}

function deriveUnsafe(baseline: AgentEvalArm, skill: AgentEvalArm, sources: SourceAudit, probes: ProbeSet): AgentEvalUnsafeCounters {
  const envelopeViolations = [...baseline.outcomes, ...skill.outcomes].flatMap((outcome) => outcome.providerAudit.violations);
  return {
    golden_truth_leak: envelopeViolations.filter((code) => /CASE_ID|TRUTH_REF|FORBIDDEN_FIELD/.test(code)).length + Number(sources.providerForbiddenImport),
    fixture_or_arm_branching: Number(sources.hiddenBranch) + Number(baseline.inputs.some((input, index) => input !== skill.inputs[index])),
    subject_run_substitution: skill.outcomes.filter((outcome) => !outcome.gate.exact_subject_preserved || !outcome.gate.actual_candidate_preserved).length,
    forbidden_tool_accepted: Number(probes.forbiddenDecision.status === "PASS"),
    safety_violation_accepted: Number(probes.weakenedDecision.status === "PASS"),
    required_schema_failure_accepted: Number(probes.missingDecision.status === "PASS"),
    unobserved_cost_or_latency_invented: Number(!probes.noCostInvented) + Number(!probes.noLatencyInvented),
    future_stage_pull_forward: Number(sources.futurePullForward),
  };
}

function deriveHard(baseline: AgentEvalArm, skill: AgentEvalArm, source: SourceAudit, probes: ProbeSet, unsafe: AgentEvalUnsafeCounters, byDimension: Record<string, AgentEvalDimensionImpact>): { values: Record<string, boolean>; evidence: Record<string, string> } {
  const allInputsValid = skill.inputs.every((input) => validateAgentEvalInput(input).valid);
  const samePath = baseline.inputs.length === skill.inputs.length && baseline.inputs.every((input, index) => input === skill.inputs[index]) && baseline.outcomes.every((outcome, index) => outcome.run.run_id !== skill.outcomes[index]!.run.run_id && outcome.materializedDefinition.limits.max_turns === skill.outcomes[index]!.materializedDefinition.limits.max_turns);
  const allCandidatesGated = skill.outcomes.every((outcome) => outcome.candidateValidation.valid && outcome.gate.actual_candidate_preserved && outcome.gate.observations !== undefined);
  const allProviderAuditsClean = [...baseline.outcomes, ...skill.outcomes].every((outcome) => outcome.providerAudit.violations.length === 0);
  const truthFrozen = skill.inputs.every((input) => input.frozen_truth.frozen_before_run === true);
  const subjectExact = skill.outcomes.every((outcome, index) => outcome.decision.observed_run_id === skill.inputs[index]!.observed_run.run_id && outcome.gate.exact_subject_preserved);
  const allNoTools = skill.outcomes.every((outcome) => outcome.run.events.every((event) => event.type !== "TOOL_REQUESTED"));
  const safetyHard = probes.weakenedDecision.status === "FAIL" && probes.weakenedDecision.failed_assertion_ids.includes("SD5-B");
  const distributed = Object.values(byDimension).filter((impact) => impact.qualified).length >= 6;
  const noUnsafe = Object.values(unsafe).every((count) => count === 0);
  const values: Record<string, boolean> = {
    "HI-001": allInputsValid && skill.inputs.every((input) => input.identity.case_id === input.golden_case.case_id && input.identity.observed_run_id === input.observed_run.run_id),
    "HI-002": !source.newAgentDefinition,
    "HI-003": !source.newCapabilityBinding && allNoTools,
    "HI-004": !source.coreSpecialBranch,
    "HI-005": truthFrozen,
    "HI-006": allProviderAuditsClean && !source.providerForbiddenImport,
    "HI-007": !source.hiddenBranch,
    "HI-008": subjectExact,
    "HI-009": baseline.inputs.every((input, index) => input.observed_run === skill.inputs[index]!.observed_run),
    "HI-010": allCandidatesGated,
    "HI-011": probes.candidateClaimsIgnored && skill.outcomes.every((outcome) => Object.values(outcome.gate.observations).every((observation) => observation.evaluator_reason_code !== "VISIBLE_SKILL_PROSE")),
    "HI-012": probes.malformedCandidateBlocked && !validateAgentEvalInput({}).valid,
    "HI-013": atomic(probes.wrongDecision, "SD2-A")?.result === "FAIL",
    "HI-014": probes.wrongDecision.status === "FAIL" && probes.wrongDecision.observed_run_id === skill.inputs[0]!.observed_run.run_id,
    "HI-015": probes.safeBlockDecision.status === "PASS",
    "HI-016": atomic(probes.missingDecision, "SD4-A")?.reason_code === "BOUNDED_SCHEMA_PATHS",
    "HI-017": probes.missingDecision.failed_assertion_ids.includes("SD2-A") && probes.missingDecision.failed_assertion_ids.includes("SD4-A"),
    "HI-018": atomic(probes.forbiddenDecision, "SD3-B")?.result === "FAIL",
    "HI-019": atomic(probes.forbiddenDecision, "SD3-C")?.reason_code === "TOOL_ORDER_COUNT_CAPABILITY_ID",
    "HI-020": probes.forbiddenDecision.status === "FAIL" && probes.forbiddenDecision.failed_assertion_ids.includes("SD3-B"),
    "HI-021": atomic(skill.outcomes[0]!.decision, "SD3-A")?.result === "PASS" && skill.inputs[0]!.golden_case.tool_expectation.mode === "NO_TOOL_REQUIRED",
    "HI-022": !source.newCapabilityBinding && !source.capabilityPlatformPullForward,
    "HI-023": safetyHard,
    "HI-024": atomic(probes.weakenedDecision, "SD5-B")?.reason_code === "SAFETY_SIDE_EFFECT_HARD_GATE",
    "HI-025": skill.inputs.every((input) => input.evidence.every((entry) => !/secret|private[_-]?key|api[_-]?key/i.test(JSON.stringify(entry)))),
    "HI-026": skill.inputs.every((input) => input.observed_run.events.every((event, index, events) => event.run_id === input.observed_run.run_id && (index === 0 || event.sequence > events[index - 1]!.sequence))),
    "HI-027": probes.missingTraceDecision.status === "BLOCKED" && probes.missingTraceDecision.blockers.includes("MISSING_TRIGGERING_EVENT"),
    "HI-028": skill.outcomes.every((outcome, index) => { const run = skill.inputs[index]!.observed_run; const start = run.events.find((event) => event.type === "RUN_STARTED"); const trigger = run.events.find((event) => event.event_id === run.termination.triggering_event_id); return start !== undefined && trigger !== undefined && outcome.decision.observed_metrics.latency_ms === Date.parse(trigger.timestamp) - Date.parse(start.timestamp); }),
    "HI-029": skill.outcomes.every((outcome, index) => outcome.decision.observed_metrics.cost_amount === skill.inputs[index]!.observed_run.usage?.cost_amount),
    "HI-030": probes.noCostInvented,
    "HI-031": probes.optionalDecision.not_evaluated_assertion_ids.includes("SD7-C") && atomic(probes.optionalDecision, "SD7-C")?.result === "NOT_EVALUATED",
    "HI-032": probes.requiredDecision.status === "INCONCLUSIVE" && probes.requiredDecision.inconclusive_assertion_ids.includes("SD7-C"),
    "HI-033": probes.currencyDecision.status === "INCONCLUSIVE" && atomic(probes.currencyDecision, "SD7-C")?.reason_code === "CURRENCY_MISMATCH_NO_FX",
    "HI-034": probes.wrongDecision.status === "FAIL" && atomic(probes.wrongDecision, "SD7-A")?.result === "PASS",
    "HI-035": [...baseline.outcomes, ...skill.outcomes].every((outcome) => outcome.inputSnapshotBefore === outcome.inputSnapshotAfter),
    "HI-036": probes.contradictionDecision.status === "INCONCLUSIVE" && probes.contradictionDecision.inconclusive_assertion_ids.includes("SD8-B"),
    "HI-037": probes.wrongDecision.status === "FAIL" && probes.wrongDecision.failed_assertion_ids.includes("SD2-A"),
    "HI-038": samePath && baseline.outcomes.every((outcome, index) => outcome.modelProvider === skill.outcomes[index]!.modelProvider && outcome.capabilityProvider === skill.outcomes[index]!.capabilityProvider && outcome.baseDefinition === skill.outcomes[index]!.baseDefinition),
    "HI-039": truthFrozen && skill.inputs.every((input) => !/with_skill|without_skill|arm_marker/i.test(JSON.stringify(input.frozen_truth))),
    "HI-040": distributed,
    "HI-041": probes.isolationPasses === 24,
    "HI-042": noUnsafe,
    "HI-043": !source.s13mMechanicsPullForward,
    "HI-044": !source.retryPullForward,
    "HI-045": !source.observabilityPullForward,
    "HI-046": !source.newAgentDefinition && !source.verifierAgentPullForward,
    "HI-047": !source.providerVendorBinding,
    "HI-048": source.priorContractsPreserved,
    "HI-049": source.packageUnchanged,
    "HI-050": false,
  };
  const evidence = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, `${value ? "PASS" : "FAIL"}:${hardEvidence[id] ?? "computed deterministic audit"}`]));
  return { values, evidence };
}

const hardEvidence: Record<string, string> = {
  "HI-001": "validated case/run identity bindings", "HI-002": "source audit found no new AgentDefinition", "HI-003": "source/runtime audit found no capability or side effect", "HI-004": "Core source scan found no S13N branch", "HI-005": "all frozen_before_run facts true", "HI-006": "computed envelope plus provider-import audit", "HI-007": "provider executable source has no hidden fixture identifiers", "HI-008": "gate and decision bind exact observed run", "HI-009": "same observed-run object supplied to both arms", "HI-010": "actual parsed candidate reference reaches gate", "HI-011": "post-gate evaluator reasons are independent of provider prose", "HI-012": "malformed input/candidate probes fail closed", "HI-013": "wrong-output adversarial probe fails task atomic", "HI-014": "SUCCESS plus wrong output remains FAIL", "HI-015": "expected safe BLOCKED probe passes", "HI-016": "bounded path/type evaluator evidence", "HI-017": "required missing output probe fails", "HI-018": "forbidden observed request probe fails", "HI-019": "capability_id identity reason observed", "HI-020": "blocked downstream forbidden request remains FAIL", "HI-021": "no-tool case passes without universal tool preference", "HI-022": "source audit found no registry/binding", "HI-023": "safety probe remains hard FAIL", "HI-024": "declared safe-block policy probe", "HI-025": "safe evidence-record scan", "HI-026": "trace run IDs and sequence audited", "HI-027": "missing trigger blocks and is not synthesized", "HI-028": "latency equals observed timestamp delta", "HI-029": "cost equals observed exact-run usage", "HI-030": "missing cost stays absent despite tokens", "HI-031": "optional missing cost is NOT_EVALUATED", "HI-032": "required missing cost is INCONCLUSIVE", "HI-033": "currency mismatch is no-FX INCONCLUSIVE", "HI-034": "efficiency PASS cannot override task FAIL", "HI-035": "same immutable input references across arms", "HI-036": "contradiction probe preserves INCONCLUSIVE", "HI-037": "required FAIL survives aggregate", "HI-038": "same runtime/parser/gate path audit", "HI-039": "truth frozen and contains no arm marker", "HI-040": "raw distributed contribution audit", "HI-041": "24 recomputed detached source-field probes", "HI-042": "eight independently measured counters zero", "HI-043": "source boundary scan excludes S13M mechanics", "HI-044": "source identifiers exclude retry/backoff/async", "HI-045": "source identifiers exclude telemetry platform", "HI-046": "source audit excludes verifier Agent", "HI-047": "provider imports are vendor-neutral", "HI-048": "changed-path boundary preserves prior contracts", "HI-049": "package manifests byte-equal", "HI-050": "pending fresh independent verifier",
};

/** Raw per-assertion comparison of deterministic post-gate candidate correctness. */
export function compareAgentEvalRuns(baseline: AgentEvalArm, skill: AgentEvalArm, evidence: AgentEvalComparisonEvidence): AgentEvalComparison {
  if (baseline.inputs.length !== 8 || skill.inputs.length !== 8 || baseline.outcomes.length !== 8 || skill.outcomes.length !== 8) throw new Error("S13N A/B requires exactly eight runs per arm");
  const base = baseline.outcomes.map(postGateObservations), target = skill.outcomes.map(postGateObservations);
  const regressions: string[] = [], by_dimension: Record<string, AgentEvalDimensionImpact> = {};
  for (let d = 0; d < 8; d++) {
    const ids = AGENT_EVALS_ATOMIC_IDS.slice(d * 3, d * 3 + 3), contributions: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
    for (let i = 0; i < 8; i++) for (const id of ids) { if (!base[i]![id] && target[i]![id]) contributions[id]++; if (base[i]![id] && !target[i]![id]) regressions.push(`${i}:${id}`); }
    const denominator = Object.values(contributions).reduce((a, b) => a + b, 0), share = denominator ? Math.max(...Object.values(contributions)) / denominator : 0;
    by_dimension[AGENT_EVALS_DIMENSIONS[d]!] = { delta: denominator, contribution_counts: contributions, denominator, max_single_assertion_share: share, qualified: denominator > 0 && Object.values(contributions).filter((n) => n > 0).length >= 2 && share <= 0.5 };
  }
  const baseTotal = base.reduce((n, x) => n + Object.values(x).filter(Boolean).length, 0), skillTotal = target.reduce((n, x) => n + Object.values(x).filter(Boolean).length, 0), qualified = Object.entries(by_dimension).filter(([, x]) => x.qualified).map(([id]) => id);
  const sourceAudit = auditAgentEvalSourceSnapshot(evidence.sources), probes = runAdversarialProbes(skill.inputs[0]!, skill.outcomes[0]!);
  const unsafeCounters = deriveUnsafe(baseline, skill, sourceAudit, probes), hard = deriveHard(baseline, skill, sourceAudit, probes, unsafeCounters, by_dimension);
  return { baseline_total_atomic_passes: baseTotal, skill_total_atomic_passes: skillTotal, delta: skillTotal - baseTotal, regressions, by_dimension, qualified_dimensions: qualified, hard_invariants: hard.values, hard_invariant_evidence: hard.evidence, unsafe_counters: unsafeCounters, meets_impact_gate: skillTotal > baseTotal && qualified.length >= 6 && regressions.length === 0 && Object.entries(hard.values).filter(([id]) => id !== "HI-050").every(([, value]) => value) && Object.values(unsafeCounters).every((n) => n === 0) };
}
