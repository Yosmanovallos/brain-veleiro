import { aggregateObservedUsage } from "./aggregateObservedUsage.js";
import {
  applyDeterministicSampling,
  effectivePriority,
  summariseDroppedKinds,
  terminalEvidenceRefs,
} from "./applyDeterministicSampling.js";
import { buildTraceIndex } from "./buildTraceIndex.js";
import { NEVER_DROP_KINDS, S13P_LIMITS } from "./constants.js";
import { effectiveLimit, validateObservabilityPolicy } from "./validateObservabilityPolicy.js";
import {
  containsProhibitedContent,
  isPlainObject,
  validateRunIdentity,
  validateSafeObservation,
} from "./validateSafeObservation.js";
import type {
  BuildStatus,
  ObservabilityBuildInput,
  ObservabilityBuildResult,
  ObservabilityCoverage,
  ObservabilityDiagnostic,
  ObservabilityPolicy,
  RetentionDirective,
  SafeObservationCandidate,
  SafeRunIdentity,
} from "./types.js";

const EMPTY_AGGREGATES = aggregateObservedUsage([]).aggregates;

function mergeDiagnostics(diags: readonly ObservabilityDiagnostic[]): ObservabilityDiagnostic[] {
  const map = new Map<string, ObservabilityDiagnostic>();
  for (const d of diags) {
    const key = `${d.code}|${d.severity}|${d.fieldPath ?? ""}|${d.observationRef ?? ""}`;
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, count: existing.count + d.count } : { ...d });
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function rejectedResult(
  run: SafeRunIdentity | undefined,
  policy: ObservabilityPolicy | undefined,
  diagnostics: readonly ObservabilityDiagnostic[],
): ObservabilityBuildResult {
  const safeRun: SafeRunIdentity =
    run && typeof run.runId === "string" && typeof run.traceId === "string"
      ? { runId: run.runId, traceId: run.traceId }
      : { runId: "invalid", traceId: "invalid" };
  const retention: RetentionDirective = {
    class: "EPHEMERAL",
    days: 0,
    downgradedFromRequest: false,
    persistencePerformed: false,
    note: "REJECTED bundle performs no persistence",
  };
  const body: Omit<ObservabilityBuildResult, "serializedBytes"> = {
    schemaVersion: "s13p.bundle.v1",
    policyVersion: "s13p.policy.v1",
    status: "REJECTED",
    run: safeRun,
    observations: [],
    diagnostics: mergeDiagnostics(diagnostics),
    coverage: {
      acceptedObservations: 0,
      rejectedObservations: 0,
      requiredObservationsPresent: false,
      hasRunStarted: false,
      hasRunTerminated: false,
      terminalOutcomeKnown: false,
      lateOrPartialEvidence: false,
      missingParentSpans: 0,
      sampledDetailCount: 0,
      droppedForCardinality: 0,
      droppedForSize: 0,
      unknownMetricCoverage: true,
    },
    aggregates: EMPTY_AGGREGATES,
    retention,
    sampling: { basisPoints: 0, seed: policy?.samplingSeed ?? "invalid", eligibleDetail: 0, retainedDetail: 0, sampledOutDetail: 0 },
    evidenceRefs: [],
  };
  return freeze({ ...body, serializedBytes: Buffer.byteLength(JSON.stringify(body), "utf8") });
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) freeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

function retentionDirective(policy: ObservabilityPolicy, downgraded: boolean): RetentionDirective {
  const requested = policy.requestedRetention;
  if (requested.class === "EPHEMERAL")
    return { class: "EPHEMERAL", days: 0, downgradedFromRequest: false, persistencePerformed: false, note: "no durable retention" };
  const ceiling =
    requested.class === "OPERATIONAL" ? S13P_LIMITS.maxOperationalRetentionDays : S13P_LIMITS.maxAuditRefRetentionDays;
  const days = Math.min(requested.days, ceiling);
  return {
    class: requested.class,
    days,
    downgradedFromRequest: downgraded || days !== requested.days,
    persistencePerformed: false,
    note: "directive only; a future durable layer must enforce it",
  };
}

/**
 * Public Part B seam (semantic contract section 19). Pure and deterministic:
 * no wall clock, no randomness, no environment, no IO, no input mutation. It
 * never awards PASS or HI-051 and never branches on fixtures or test names.
 */
export function buildObservabilityBundle(input: unknown): ObservabilityBuildResult {
  const collected: ObservabilityDiagnostic[] = [];

  // 1. top-level shape and policy.
  if (!isPlainObject(input)) return rejectedResult(undefined, undefined, [{ code: "INVALID_POLICY", severity: "REJECT", count: 1 }]);
  const typed = input as Partial<ObservabilityBuildInput>;
  if (!Array.isArray(typed.observations))
    return rejectedResult(undefined, undefined, [{ code: "INVALID_POLICY", severity: "REJECT", fieldPath: "observations", count: 1 }]);
  if (typed.evidenceRefs !== undefined && !Array.isArray(typed.evidenceRefs))
    collected.push({ code: "UNSAFE_REF", severity: "REJECT", fieldPath: "evidenceRefs", count: 1 });

  const policyCheck = validateObservabilityPolicy(typed.policy);
  collected.push(...policyCheck.diagnostics);
  if (!policyCheck.valid) return rejectedResult(typed.run as SafeRunIdentity, typed.policy as ObservabilityPolicy, collected);
  const policy = typed.policy as ObservabilityPolicy;

  // 2. run / trace identity.
  const identityCheck = validateRunIdentity(typed.run);
  collected.push(...identityCheck.diagnostics);
  if (!identityCheck.valid) return rejectedResult(typed.run as SafeRunIdentity, policy, collected);
  const run = typed.run as SafeRunIdentity;

  const evidenceRefs = [...(typed.evidenceRefs ?? [])];
  if (
    evidenceRefs.length > effectiveLimit(policy, "maxEvidenceRefsPerRun") ||
    containsProhibitedContent(evidenceRefs)
  ) {
    collected.push({ code: "UNSAFE_REF", severity: "REJECT", fieldPath: "evidenceRefs", count: 1 });
    return rejectedResult(run, policy, collected);
  }

  // 3-5. per-candidate exact-kind validation; prohibited/unknown fields reject before aggregation.
  const accepted: SafeObservationCandidate[] = [];
  let rejectedObservations = 0;
  let requiredRejected = false;
  const requiredKind = (o: unknown): boolean =>
    isPlainObject(o) &&
    (NEVER_DROP_KINDS.has(o.kind as SafeObservationCandidate["kind"]) ||
      o.priority === "REQUIRED" ||
      ((o.kind === "MODEL_CALL_COMPLETED" || o.kind === "TOOL_CALL_COMPLETED") &&
        (o.outcome === "FAILURE" || o.outcome === "CANCELLED")));

  let hardRejectItem = false;
  for (const candidate of typed.observations) {
    const check = validateSafeObservation(candidate, run, {
      allowTemplateDigest: policy.allowTemplateDigest,
      allowErrorFingerprint: policy.allowErrorFingerprint,
    });
    if (check.valid) {
      accepted.push(candidate as SafeObservationCandidate);
      continue;
    }
    rejectedObservations++;
    const prohibitedOrCrossRun = check.diagnostics.some(
      (d) => d.code === "PROHIBITED_FIELD" || d.code === "CROSS_RUN_IDENTITY" || d.code === "INVALID_RUN_IDENTITY",
    );
    if (prohibitedOrCrossRun) {
      collected.push(...check.diagnostics);
      hardRejectItem = true;
      continue;
    }
    if (requiredKind(candidate)) {
      requiredRejected = true;
      collected.push(...check.diagnostics);
      continue;
    }
    // Optional (non-required) item: its violation rejects only the item; the bundle is at most PARTIAL.
    for (const d of check.diagnostics) collected.push({ ...d, severity: "PARTIAL" });
  }

  if (hardRejectItem || requiredRejected) return rejectedResult(run, policy, collected);

  // 6-7. uniqueness, sequences, span graph, phase pairs, terminal semantics.
  const trace = buildTraceIndex(accepted);
  collected.push(...trace.diagnostics);

  // 8-9. classify never-drop vs eligible detail; deterministic sampling.
  const protectedEvidence = terminalEvidenceRefs(accepted, trace.terminalObservationId);
  const basisPoints = Math.min(policy.successDetailSamplingBasisPoints, S13P_LIMITS.samplingBasisPointsMax);
  const sampling = applyDeterministicSampling(trace.ordered, policy.samplingSeed, run.runId, basisPoints, protectedEvidence);
  collected.push(...sampling.diagnostics);

  // 10. cardinality and byte bounds.
  let retained = [...sampling.retained];
  const droppedForCardinality: SafeObservationCandidate[] = [];
  const limitsToCheck: [keyof typeof S13P_LIMITS, (o: SafeObservationCandidate) => string | undefined][] = [
    ["maxSpansPerRun", (o) => o.spanId],
    ["maxPromptRefsPerRun", (o) => (o.kind === "PROMPT_RESOLVED" ? o.promptRef : undefined)],
    ["maxModelRefsPerRun", (o) => (o.kind === "MODEL_CALL_STARTED" || o.kind === "MODEL_CALL_COMPLETED" ? o.modelRef : undefined)],
    ["maxCapabilityRefsPerRun", (o) => (o.kind === "TOOL_CALL_STARTED" || o.kind === "TOOL_CALL_COMPLETED" ? o.capabilityId : undefined)],
    ["maxErrorCodesPerRun", (o) => (o.kind === "ERROR_OBSERVED" ? o.code : undefined)],
  ];
  for (const [limitKey, extract] of limitsToCheck) {
    const ceiling = effectiveLimit(policy, limitKey);
    const seen = new Set<string>();
    const kept: SafeObservationCandidate[] = [];
    for (const o of retained) {
      const value = extract(o);
      if (value === undefined) {
        kept.push(o);
        continue;
      }
      if (seen.size < ceiling || seen.has(value)) {
        seen.add(value);
        kept.push(o);
      } else if (effectivePriority(o) === "REQUIRED" || NEVER_DROP_KINDS.has(o.kind)) {
        collected.push({ code: "REQUIRED_EVIDENCE_OVERFLOW", severity: "REJECT", count: 1 });
        return rejectedResult(run, policy, collected);
      } else {
        droppedForCardinality.push(o);
      }
    }
    retained = kept;
  }

  const distinctCurrencies = new Set(
    retained.filter((o) => o.kind === "COST_OBSERVED").map((o) => (o as { currency: string }).currency),
  );
  if (distinctCurrencies.size > effectiveLimit(policy, "maxCurrenciesPerRun")) {
    collected.push({ code: "CARDINALITY_LIMIT", severity: "REJECT", fieldPath: "currency", count: 1 });
    return rejectedResult(run, policy, collected);
  }

  const observationCeiling = effectiveLimit(policy, "maxObservationsPerRun");
  if (accepted.length > observationCeiling) {
    const requiredCount = accepted.filter((o) => effectivePriority(o) === "REQUIRED" || NEVER_DROP_KINDS.has(o.kind)).length;
    if (requiredCount > observationCeiling) {
      collected.push({ code: "REQUIRED_EVIDENCE_OVERFLOW", severity: "REJECT", count: 1 });
      return rejectedResult(run, policy, collected);
    }
    while (retained.length > observationCeiling) {
      const idx = retained.findIndex((o) => effectivePriority(o) === "DETAIL" || effectivePriority(o) === "NORMAL");
      if (idx < 0) break;
      droppedForCardinality.push(retained[idx]);
      retained.splice(idx, 1);
    }
  }

  if (droppedForCardinality.length > 0)
    collected.push({ code: "CARDINALITY_LIMIT", severity: "PARTIAL", count: droppedForCardinality.length });

  const allDropped = [...sampling.sampledOut, ...droppedForCardinality];
  const droppedForSize: SafeObservationCandidate[] = [];
  if (allDropped.length > 0) {
    retained.push({
      schemaVersion: "s13p.observation.v1",
      observationId: `s13p.dropped.summary.${retained.length}`,
      runId: run.runId,
      traceId: run.traceId,
      sequence: Number.MAX_SAFE_INTEGER,
      occurredAt: accepted[0]?.occurredAt ?? "1970-01-01T00:00:00Z",
      observedAt: accepted[0]?.observedAt ?? "1970-01-01T00:00:00Z",
      source: "CALLER_SAFE",
      kind: "OBSERVATION_DROPPED_SUMMARY",
      priority: "REQUIRED",
      reason: sampling.sampledOut.length > 0 ? "SAMPLING" : "CARDINALITY",
      droppedCount: allDropped.length,
      droppedKinds: summariseDroppedKinds(allDropped),
    });
  }

  // 11. aggregate accepted observed facts (over the retained, safe set).
  const aggregation = aggregateObservedUsage(retained);
  collected.push(...aggregation.diagnostics);

  // 6. serialized-size ceiling.
  const bundleCeiling = effectiveLimit(policy, "maxBundleBytes");
  const retention = retentionDirective(policy, policyCheck.retentionDowngraded);
  if (policyCheck.retentionDowngraded) collected.push({ code: "RETENTION_DOWNGRADED", severity: "PARTIAL", count: 1 });

  const buildBody = (obs: readonly SafeObservationCandidate[], status: BuildStatus): Omit<ObservabilityBuildResult, "serializedBytes"> => ({
    schemaVersion: "s13p.bundle.v1",
    policyVersion: "s13p.policy.v1",
    status,
    run,
    observations: obs,
    diagnostics: mergeDiagnostics(collected),
    coverage: buildCoverage(obs, accepted, rejectedObservations, trace, sampling.summary.sampledOutDetail, droppedForCardinality.length, droppedForSize.length),
    aggregates: aggregation.aggregates,
    retention,
    sampling: sampling.summary,
    evidenceRefs,
  });

  let working = [...retained];
  let bodyForSize = buildBody(working, "PARTIAL");
  let serializedBytes = Buffer.byteLength(JSON.stringify(bodyForSize), "utf8");
  while (serializedBytes > bundleCeiling) {
    const idx = working.findIndex((o) => effectivePriority(o) === "DETAIL");
    const fallbackIdx = idx < 0 ? working.findIndex((o) => effectivePriority(o) === "NORMAL") : idx;
    if (fallbackIdx < 0) {
      collected.push({ code: "SERIALIZED_SIZE_LIMIT", severity: "REJECT", count: 1 });
      return rejectedResult(run, policy, collected);
    }
    droppedForSize.push(working[fallbackIdx]);
    working.splice(fallbackIdx, 1);
    bodyForSize = buildBody(working, "PARTIAL");
    serializedBytes = Buffer.byteLength(JSON.stringify(bodyForSize), "utf8");
  }
  if (droppedForSize.length > 0) collected.push({ code: "SERIALIZED_SIZE_LIMIT", severity: "PARTIAL", count: droppedForSize.length });
  retained = working;

  // 12. status decision table (semantic contract section 18).
  const merged = mergeDiagnostics(collected);
  const anyReject = merged.some((d) => d.severity === "REJECT") || trace.rejectingCodes.size > 0;
  let status: BuildStatus;
  if (anyReject || !trace.hasRunStarted || !trace.hasRunTerminated || !trace.terminalOutcomeKnown) {
    status = "REJECTED";
  } else {
    const tokens = aggregation.aggregates.tokens;
    const incompleteTokenCoverage =
      tokens.input.callsObserved + tokens.output.callsObserved + tokens.total.callsObserved > 0 &&
      (tokens.input.callsMissing > 0 || tokens.output.callsMissing > 0 || tokens.total.callsMissing > 0);
    const anyPartial =
      merged.some((d) => d.severity === "PARTIAL") ||
      rejectedObservations > 0 ||
      sampling.summary.sampledOutDetail > 0 ||
      droppedForCardinality.length > 0 ||
      droppedForSize.length > 0 ||
      trace.lateOrPartialEvidence ||
      retention.downgradedFromRequest ||
      incompleteTokenCoverage;
    status = anyPartial ? "PARTIAL" : "COMPLETE";
  }

  if (status === "REJECTED") return rejectedResult(run, policy, collected);

  const finalBody = buildBody(
    [...retained].sort((a, b) => a.sequence - b.sequence),
    status,
  );
  const result: ObservabilityBuildResult = {
    ...finalBody,
    serializedBytes: Buffer.byteLength(JSON.stringify(finalBody), "utf8"),
  };
  return freeze(structuredClone(result));
}

function buildCoverage(
  retained: readonly SafeObservationCandidate[],
  accepted: readonly SafeObservationCandidate[],
  rejectedObservations: number,
  trace: ReturnType<typeof buildTraceIndex>,
  sampledDetailCount: number,
  droppedForCardinality: number,
  droppedForSize: number,
): ObservabilityCoverage {
  const usageKinds = retained.filter((o) => o.kind === "USAGE_OBSERVED" || o.kind === "COST_OBSERVED" || o.kind === "LATENCY_OBSERVED");
  return {
    acceptedObservations: retained.length,
    rejectedObservations,
    requiredObservationsPresent: trace.hasRunStarted && trace.hasRunTerminated && trace.terminalOutcomeKnown,
    hasRunStarted: trace.hasRunStarted,
    hasRunTerminated: trace.hasRunTerminated,
    terminalOutcomeKnown: trace.terminalOutcomeKnown,
    lateOrPartialEvidence: trace.lateOrPartialEvidence,
    missingParentSpans: trace.missingParentSpans,
    sampledDetailCount,
    droppedForCardinality,
    droppedForSize,
    unknownMetricCoverage: usageKinds.length === 0,
  };
}
