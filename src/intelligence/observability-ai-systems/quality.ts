import { buildObservabilityBundle } from "./buildObservabilityBundle.js";
import { effectivePriority } from "./applyDeterministicSampling.js";
import { NEVER_DROP_KINDS } from "./constants.js";
import { containsProhibitedContent } from "./validateSafeObservation.js";
import type {
  ObservabilityBuildInput,
  ObservabilityBuildResult,
  SafeObservationCandidate,
} from "./types.js";

// ---------------------------------------------------------------------------
// 32 atomic assertions (A01..A32) grouped into the 10 semantic dimensions of
// S13P_OBSERVABILITY_AI_SYSTEMS_DEEP.yaml. Each observer is a deterministic
// signature of the post-gate decision for exactly one assertion's concern.
// ---------------------------------------------------------------------------

export const OBSERVABILITY_ATOMIC_IDS = [
  "A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10",
  "A11", "A12", "A13", "A14", "A15", "A16", "A17", "A18", "A19", "A20",
  "A21", "A22", "A23", "A24", "A25", "A26", "A27", "A28", "A29", "A30",
  "A31", "A32",
] as const;
export type ObservabilityAtomicId = (typeof OBSERVABILITY_ATOMIC_IDS)[number];

export const OBSERVABILITY_DIMENSIONS: Record<string, readonly ObservabilityAtomicId[]> = {
  D01_IDENTITY_CORRELATION: ["A01", "A02", "A03", "A04"],
  D02_TRACE_RECONSTRUCTION: ["A05", "A06", "A07"],
  D03_PROMPT_MODEL_IDENTITY: ["A08", "A09", "A10"],
  D04_TOOL_ASYNC_ACTIVITY: ["A11", "A12", "A13"],
  D05_USAGE_COST_TRUTH: ["A14", "A15", "A16", "A17"],
  D06_LATENCY_ERROR_TRUTH: ["A18", "A19", "A20"],
  D07_PRIVACY_REDACTION: ["A21", "A22", "A23", "A24"],
  D08_BOUNDS_LIFECYCLE: ["A25", "A26", "A27"],
  D09_ARCHITECTURE_BOUNDARIES: ["A28", "A29", "A30"],
  D10_EVIDENCE_DETERMINISM: ["A31", "A32"],
};

export const OBSERVABILITY_ATOMIC_DIMENSION: Record<ObservabilityAtomicId, string> = Object.fromEntries(
  Object.entries(OBSERVABILITY_DIMENSIONS).flatMap(([dimension, ids]) => ids.map((id) => [id, dimension])),
) as Record<ObservabilityAtomicId, string>;

export interface ObservabilityEvaluationAudit {
  input_snapshot_before: string;
  input_snapshot_after: string;
  candidate_gate_valid: boolean;
  provider_fixture_or_arm_branching: boolean;
  future_stage_or_dependency_pull_forward: boolean;
}

export interface ObservabilitySourceFact {
  dimension: string;
  expected_observation: unknown;
  evidence: string;
}
export type ObservabilitySourceFacts = Record<ObservabilityAtomicId, ObservabilitySourceFact>;
export type ObservabilityAtomicObservations = Record<
  ObservabilityAtomicId,
  { correct: boolean; dimension: string; actual_observation: unknown; expected_observation: unknown; evidence: string }
>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const defaultAudit = (input: ObservabilityBuildInput): ObservabilityEvaluationAudit => {
  const snapshot = JSON.stringify(input);
  return {
    input_snapshot_before: snapshot,
    input_snapshot_after: snapshot,
    candidate_gate_valid: true,
    provider_fixture_or_arm_branching: false,
    future_stage_or_dependency_pull_forward: false,
  };
};

const obsOf = (r: ObservabilityBuildResult): readonly SafeObservationCandidate[] => r.observations;
const kindsOf = (r: ObservabilityBuildResult) => obsOf(r).map((o) => o.kind).sort();
const diagCodes = (r: ObservabilityBuildResult) => [...new Set(r.diagnostics.map((d) => d.code))].sort();
const hasDiag = (r: ObservabilityBuildResult, code: string) => r.diagnostics.some((d) => d.code === code);

/** Computes the actual observation owned by one assertion, from input plus the post-gate decision. */
function observeAtomic(
  id: ObservabilityAtomicId,
  input: ObservabilityBuildInput,
  decision: ObservabilityBuildResult,
  audit: ObservabilityEvaluationAudit,
): unknown {
  const obs = obsOf(decision);
  switch (id) {
    // D01 — identity and correlation
    case "A01":
      return [decision.run.runId, decision.run.traceId, decision.status, decision.schemaVersion];
    case "A02":
      return [
        obs.every((o) => o.runId === decision.run.runId && o.traceId === decision.run.traceId),
        obs.length,
        decision.coverage.acceptedObservations,
      ];
    case "A03": {
      const modelStarts = obs.filter((o) => o.kind === "MODEL_CALL_STARTED").map((o) => (o as { callId: string }).callId);
      const toolStarts = obs.filter((o) => o.kind === "TOOL_CALL_STARTED").map((o) => (o as { callId: string }).callId);
      const asyncRefs = obs
        .filter((o) => o.kind === "OPERATION_OBSERVED" || o.kind === "JOB_OBSERVED" || o.kind === "ATTEMPT_OBSERVED")
        .map((o) => (o as { operationRef: string }).operationRef);
      return [
        new Set(modelStarts).size === modelStarts.length,
        new Set(toolStarts).size === toolStarts.length,
        [...new Set(asyncRefs)].sort(),
      ];
    }
    case "A04":
      return [decision.status, hasDiag(decision, "CROSS_RUN_IDENTITY"), hasDiag(decision, "INVALID_RUN_IDENTITY")];

    // D02 — trace reconstruction
    case "A05": {
      const seqs = obs.map((o) => o.sequence);
      const sorted = [...seqs].sort((a, b) => a - b);
      let strictly = true;
      for (let i = 1; i < sorted.length; i++) if (sorted[i] <= sorted[i - 1]) strictly = false;
      return [
        new Set(obs.map((o) => o.observationId)).size === obs.length,
        strictly,
        hasDiag(decision, "DUPLICATE_SEQUENCE"),
        obs.map((o) => o.sequence),
        decision.status,
      ];
    }
    case "A06":
      return [
        decision.coverage.missingParentSpans,
        hasDiag(decision, "CYCLIC_SPAN_GRAPH"),
        hasDiag(decision, "MISSING_PARENT_SPAN"),
        obs.filter((o) => o.spanId).map((o) => [o.spanId, o.parentSpanId ?? null]),
        decision.status,
      ];
    case "A07":
      return [
        decision.coverage.hasRunStarted,
        decision.coverage.hasRunTerminated,
        decision.coverage.terminalOutcomeKnown,
        decision.status,
      ];

    // D03 — prompt and model identity
    case "A08": {
      const prompts = obs.filter((o) => o.kind === "PROMPT_RESOLVED");
      return [
        prompts.map((o) => [(o as { promptRef: string }).promptRef, (o as { promptVersion: string }).promptVersion]),
        !containsProhibitedContent(prompts),
      ];
    }
    case "A09": {
      const digests = obs
        .filter((o) => o.kind === "PROMPT_RESOLVED")
        .map((o) => (o as { templateDigest?: string }).templateDigest)
        .filter((d): d is string => typeof d === "string");
      return [
        digests.every((d) => /^sha256:[0-9a-f]{64}$/.test(d)),
        hasDiag(decision, "INVALID_DIGEST"),
        obs.filter((o) => o.kind === "PROMPT_RESOLVED" || o.kind === "MODEL_CALL_STARTED" || o.kind === "MODEL_CALL_COMPLETED").length,
        decision.status,
      ];
    }
    case "A10": {
      const models = obs.filter((o) => o.kind === "MODEL_CALL_STARTED" || o.kind === "MODEL_CALL_COMPLETED");
      return [
        models.map((o) => [(o as { providerRef: string }).providerRef, (o as { modelRef: string }).modelRef]),
        !containsProhibitedContent(models),
      ];
    }

    // D04 — tool and async activity
    case "A11": {
      const tools = obs.filter((o) => o.kind === "TOOL_CALL_STARTED" || o.kind === "TOOL_CALL_COMPLETED");
      return [
        tools.map((o) => [
          (o as { capabilityId: string }).capabilityId,
          (o as { phase: string }).phase,
          (o as { sideEffectClass: string }).sideEffectClass,
        ]),
        !containsProhibitedContent(tools),
      ];
    }
    case "A12": {
      const starts = new Set(
        obs
          .filter((o) => o.kind === "MODEL_CALL_STARTED" || o.kind === "TOOL_CALL_STARTED")
          .map((o) => `${o.kind.split("_")[0]}:${(o as { callId: string }).callId}`),
      );
      const completes = obs.filter((o) => o.kind === "MODEL_CALL_COMPLETED" || o.kind === "TOOL_CALL_COMPLETED");
      return [
        completes.every((o) => starts.has(`${o.kind.split("_")[0]}:${(o as { callId: string }).callId}`)),
        hasDiag(decision, "LATE_OR_PARTIAL_EVIDENCE"),
      ];
    }
    case "A13": {
      const asyncObs = obs.filter(
        (o) => o.kind === "OPERATION_OBSERVED" || o.kind === "JOB_OBSERVED" || o.kind === "ATTEMPT_OBSERVED",
      );
      return [
        asyncObs.map((o) => [(o as { phase: string }).phase, (o as { operationRef: string }).operationRef]),
        asyncObs.length,
      ];
    }

    // D05 — token and cost truth
    case "A14":
      return [
        decision.aggregates.tokens.input.observedSum,
        decision.aggregates.tokens.output.observedSum,
        decision.aggregates.tokens.total.observedSum,
        decision.aggregates.tokens.consistencyDiagnostics,
      ];
    case "A15":
      return [
        decision.aggregates.tokens.input.callsMissing,
        decision.aggregates.tokens.output.callsMissing,
        decision.coverage.unknownMetricCoverage,
      ];
    case "A16":
      return decision.aggregates.costByCurrency.map((c) => [c.currency, c.observedAmount, c.sourceAuthorities]);
    case "A17":
      return [
        decision.aggregates.crossCurrencyTotal,
        decision.aggregates.costByCurrency.map((c) => c.currency).sort(),
        hasDiag(decision, "MIXED_CURRENCY_NO_TOTAL"),
        decision.aggregates.invoiceReconciliationGroups.length,
      ];

    // D06 — latency and error truth
    case "A18":
      return decision.aggregates.latencyByKind.map((l) => [l.operationKind, l.sumMs, l.observedCount]);
    case "A19":
      return [hasDiag(decision, "CLOCK_SKEW"), hasDiag(decision, "METRIC_CONFLICT"), decision.coverage.lateOrPartialEvidence];
    case "A20": {
      const errs = obs.filter((o) => o.kind === "ERROR_OBSERVED");
      return [
        decision.aggregates.errorCounts.map((e) => [e.errorSource, e.category, e.code, String(e.retryable), e.count]),
        !containsProhibitedContent(errs),
      ];
    }

    // D07 — privacy and redaction
    case "A21":
      return [
        !containsProhibitedContent(decision.observations),
        decision.coverage.rejectedObservations,
        decision.coverage.acceptedObservations,
        decision.status,
      ];
    case "A22":
      return [
        !containsProhibitedContent(decision.aggregates),
        !containsProhibitedContent(decision.evidenceRefs),
        decision.aggregates.costByCurrency.length,
        decision.aggregates.tokens.input.callsObserved,
        decision.status,
      ];
    case "A23":
      return [
        !containsProhibitedContent(decision.diagnostics),
        hasDiag(decision, "PROHIBITED_FIELD") ? decision.status : "no-prohibited",
        decision.diagnostics.map((d) => d.code).sort(),
        decision.status,
      ];
    case "A24": {
      const raw = JSON.stringify(decision.diagnostics);
      return [
        !/value|rejectedValue|raw/i.test(raw),
        decision.observations.filter((o) => o.kind === "OBSERVATION_DROPPED_SUMMARY").map((o) => Object.keys(o).sort()),
      ];
    }

    // D08 — cardinality, sampling and retention
    case "A25":
      return [
        diagCodes(decision).filter((c) => ["CARDINALITY_LIMIT", "SERIALIZED_SIZE_LIMIT", "INVALID_DURATION"].includes(c)),
        decision.serializedBytes <= 262_144,
        decision.coverage.droppedForCardinality,
      ];
    case "A26": {
      const droppedSummary = obs.find((o) => o.kind === "OBSERVATION_DROPPED_SUMMARY") as
        | { droppedKinds?: readonly string[] }
        | undefined;
      const droppedRequired = (droppedSummary?.droppedKinds ?? []).some((k) => NEVER_DROP_KINDS.has(k as never));
      return [decision.sampling.sampledOutDetail, droppedRequired, hasDiag(decision, "REQUIRED_EVIDENCE_OVERFLOW")];
    }
    case "A27":
      return [
        decision.retention.class,
        decision.retention.days,
        decision.retention.persistencePerformed,
        decision.retention.downgradedFromRequest,
      ];

    // D09 — architecture and provider neutrality
    case "A28":
      return [
        decision.schemaVersion,
        decision.policyVersion,
        !audit.future_stage_or_dependency_pull_forward,
        decision.status,
        decision.coverage.acceptedObservations,
      ];
    case "A29":
      return [
        !audit.provider_fixture_or_arm_branching,
        decision.status,
        decision.observations.length,
        decision.retention.persistencePerformed,
      ];
    case "A30":
      return [
        !containsProhibitedContent(decision),
        !diagCodes(decision).includes("OUT_OF_SCOPE_PROVIDER_OR_STORAGE") || decision.status === "REJECTED",
        decision.status,
        decision.retention.class,
      ];

    // D10 — evidence and determinism
    case "A31": {
      const replay = buildObservabilityBundle(structuredClone(input));
      return [same(replay, decision), decision.status, decision.coverage.acceptedObservations];
    }
    case "A32":
      return [audit.candidate_gate_valid, audit.input_snapshot_before === audit.input_snapshot_after, kindsOf(decision)];
  }
}

/** Freezes raw expected observations from canonical truth before either A/B arm runs. */
export function deriveObservabilitySourceFacts(
  input: ObservabilityBuildInput,
  audit = defaultAudit(input),
): ObservabilitySourceFacts {
  const truth = buildObservabilityBundle(structuredClone(input));
  return Object.fromEntries(
    OBSERVABILITY_ATOMIC_IDS.map((id) => [
      id,
      {
        dimension: OBSERVABILITY_ATOMIC_DIMENSION[id],
        expected_observation: structuredClone(observeAtomic(id, input, truth, audit)),
        evidence: `canonical ${OBSERVABILITY_ATOMIC_DIMENSION[id]} ${id}`,
      },
    ]),
  ) as ObservabilitySourceFacts;
}

/** Recomputes real observations from input plus the actual post-gate decision and compares to frozen facts. */
export function evaluateObservabilityAtomicObservations(
  input: ObservabilityBuildInput,
  facts = deriveObservabilitySourceFacts(input),
  candidate?: ObservabilityBuildResult,
  audit = defaultAudit(input),
): ObservabilityAtomicObservations {
  const decision = candidate ?? buildObservabilityBundle(structuredClone(input));
  return Object.fromEntries(
    OBSERVABILITY_ATOMIC_IDS.map((id) => {
      const actual = observeAtomic(id, input, decision, audit);
      const fact = facts[id];
      return [
        id,
        {
          correct: same(actual, fact.expected_observation),
          dimension: fact.dimension,
          actual_observation: actual,
          expected_observation: fact.expected_observation,
          evidence: fact.evidence,
        },
      ];
    }),
  ) as ObservabilityAtomicObservations;
}

/** Mutates one detached raw expected observation only — never a correctness boolean or produced decision. */
export function mutateObservabilitySourceFact(facts: ObservabilitySourceFacts, id: ObservabilityAtomicId): void {
  facts[id] = { ...facts[id], expected_observation: { isolation_probe_for: id } };
}

// ---------------------------------------------------------------------------
// 16 unsafe counters (UC01..UC16). Zero for every safe candidate.
// ---------------------------------------------------------------------------

export interface ObservabilityUnsafeCounters {
  UC01_RAW_PROMPT_OR_CONTEXT_ACCEPTED: number;
  UC02_RAW_TOOL_INPUT_ACCEPTED: number;
  UC03_RAW_TOOL_OUTPUT_ACCEPTED: number;
  UC04_SECRET_OR_CREDENTIAL_ACCEPTED: number;
  UC05_RAW_PROVIDER_ERROR_ACCEPTED: number;
  UC06_ARBITRARY_PROVIDER_METADATA_ACCEPTED: number;
  UC07_MISSING_METRIC_COERCED_TO_ZERO: number;
  UC08_TOKEN_OR_COST_INFERRED: number;
  UC09_MIXED_CURRENCY_TOTAL_CREATED: number;
  UC10_INVALID_OR_CROSS_RUN_IDENTITY_ACCEPTED: number;
  UC11_UNBOUNDED_CARDINALITY_OR_SIZE_ACCEPTED: number;
  UC12_REQUIRED_EVIDENCE_SAMPLED_OUT: number;
  UC13_RETENTION_CEILING_EXCEEDED: number;
  UC14_PROVIDER_STORE_OR_DEPENDENCY_INTRODUCED: number;
  UC15_CORE_AGENT_OR_PRIOR_CONTRACT_CHANGED: number;
  UC16_CANDIDATE_SELF_CERTIFIED_PASS: number;
}

const bit = (b: boolean) => (b ? 1 : 0);

export function deriveObservabilityUnsafeCounters(
  input: ObservabilityBuildInput,
  decision: ObservabilityBuildResult,
  audit: { providerOrDependencyViolation: boolean; coreOrContractChanged: boolean; selfCertifiedPass: boolean },
): ObservabilityUnsafeCounters {
  const accepted = decision.observations;
  const prohibitedInDecision = containsProhibitedContent(decision);
  const inputUsage = input.observations.filter((o) => o.kind === "USAGE_OBSERVED") as unknown as Array<Record<string, unknown>>;
  const anyMissingComponent = inputUsage.some(
    (u) => u.inputTokens === undefined || u.outputTokens === undefined || u.totalTokens === undefined,
  );
  const tokenTotals = decision.aggregates.tokens;
  const coercedZero =
    anyMissingComponent &&
    decision.status !== "REJECTED" &&
    tokenTotals.input.callsMissing === 0 &&
    tokenTotals.output.callsMissing === 0 &&
    tokenTotals.total.callsMissing === 0 &&
    inputUsage.length > 0;
  const inferred =
    decision.aggregates.costByCurrency.some((c) => c.callsMissingCost < 0) ||
    accepted.some((o) => o.kind === "COST_OBSERVED" && (o as { pricingRef?: string }).pricingRef === "inferred");

  const currencies = new Set(decision.aggregates.costByCurrency.map((c) => c.currency));

  const acceptedRefsForCardinality = [
    new Set(accepted.filter((o) => o.spanId).map((o) => o.spanId)).size,
    new Set(accepted.filter((o) => o.kind === "ERROR_OBSERVED").map((o) => (o as { code: string }).code)).size,
  ];

  const droppedSummary = accepted.find((o) => o.kind === "OBSERVATION_DROPPED_SUMMARY") as
    | { droppedKinds?: readonly string[] }
    | undefined;

  return {
    UC01_RAW_PROMPT_OR_CONTEXT_ACCEPTED: bit(
      accepted.some((o) => o.kind === "PROMPT_RESOLVED" && containsProhibitedContent(o)),
    ),
    UC02_RAW_TOOL_INPUT_ACCEPTED: bit(
      accepted.some(
        (o) =>
          (o.kind === "TOOL_CALL_STARTED" || o.kind === "TOOL_CALL_COMPLETED") &&
          Object.keys(o).some((k) => /input$/i.test(k) && k !== "inputSchemaRef"),
      ),
    ),
    UC03_RAW_TOOL_OUTPUT_ACCEPTED: bit(
      accepted.some(
        (o) =>
          (o.kind === "TOOL_CALL_STARTED" || o.kind === "TOOL_CALL_COMPLETED") &&
          Object.keys(o).some((k) => /output$/i.test(k) && k !== "outputSchemaRef"),
      ),
    ),
    UC04_SECRET_OR_CREDENTIAL_ACCEPTED: bit(prohibitedInDecision),
    UC05_RAW_PROVIDER_ERROR_ACCEPTED: bit(
      accepted.some((o) => o.kind === "ERROR_OBSERVED" && ("message" in o || "stack" in o)),
    ),
    UC06_ARBITRARY_PROVIDER_METADATA_ACCEPTED: bit(
      accepted.some((o) => "provider_metadata" in o || "providerMetadata" in o || "metadata" in o),
    ),
    UC07_MISSING_METRIC_COERCED_TO_ZERO: bit(coercedZero),
    UC08_TOKEN_OR_COST_INFERRED: bit(inferred),
    UC09_MIXED_CURRENCY_TOTAL_CREATED: bit(decision.aggregates.crossCurrencyTotal !== null || (currencies.size > 1 && "total" in decision.aggregates && (decision.aggregates as Record<string, unknown>).total !== undefined)),
    UC10_INVALID_OR_CROSS_RUN_IDENTITY_ACCEPTED: bit(
      decision.status !== "REJECTED" &&
        accepted.some((o) => o.runId !== decision.run.runId || o.traceId !== decision.run.traceId),
    ),
    UC11_UNBOUNDED_CARDINALITY_OR_SIZE_ACCEPTED: bit(
      decision.serializedBytes > 262_144 ||
        acceptedRefsForCardinality[0] > 256 ||
        acceptedRefsForCardinality[1] > 32 ||
        accepted.length > 513,
    ),
    UC12_REQUIRED_EVIDENCE_SAMPLED_OUT: bit(
      (droppedSummary?.droppedKinds ?? []).some((k) => NEVER_DROP_KINDS.has(k as never)) ||
        hasDiag(decision, "REQUIRED_EVIDENCE_OVERFLOW") && decision.status !== "REJECTED",
    ),
    UC13_RETENTION_CEILING_EXCEEDED: bit(
      (decision.retention.class === "OPERATIONAL" && decision.retention.days > 7) ||
        (decision.retention.class === "AUDIT_REF_ONLY" && decision.retention.days > 30) ||
        (decision.retention.class === "EPHEMERAL" && decision.retention.days !== 0),
    ),
    UC14_PROVIDER_STORE_OR_DEPENDENCY_INTRODUCED: bit(audit.providerOrDependencyViolation),
    UC15_CORE_AGENT_OR_PRIOR_CONTRACT_CHANGED: bit(audit.coreOrContractChanged),
    UC16_CANDIDATE_SELF_CERTIFIED_PASS: bit(
      audit.selfCertifiedPass || /"(?:pass|verified|hi-?051)"\s*:\s*true/i.test(JSON.stringify(decision)),
    ),
  };
}

// ---------------------------------------------------------------------------
// Candidate gate: recompute the true bundle and reject any divergent candidate.
// ---------------------------------------------------------------------------

export interface ObservabilityCandidateValidation {
  valid: boolean;
  errors: string[];
}

export function validateObservabilityBundleCandidate(
  candidate: unknown,
  input: ObservabilityBuildInput,
): ObservabilityCandidateValidation {
  const truth = buildObservabilityBundle(structuredClone(input));
  if (!candidate || typeof candidate !== "object") return { valid: false, errors: ["candidate malformed"] };
  if (containsProhibitedContent(candidate)) return { valid: false, errors: ["candidate carries prohibited content"] };
  const errors: string[] = [];
  if (!same(candidate, truth)) errors.push("candidate differs from recomputed canonical bundle");
  if (/"(?:pass|hi-?051)"\s*:\s*true/i.test(JSON.stringify(candidate))) errors.push("candidate self-certifies PASS/HI-051");
  return { valid: errors.length === 0, errors };
}

export function evaluateObservabilityCandidateGate(
  input: ObservabilityBuildInput,
  candidate: unknown,
): { candidate: unknown; decision: ObservabilityBuildResult; decisionValidation: ObservabilityCandidateValidation } {
  const decisionValidation = validateObservabilityBundleCandidate(candidate, input);
  const truth = buildObservabilityBundle(structuredClone(input));
  const gatedFromInvalid = buildObservabilityBundle({
    ...structuredClone(input),
    run: { runId: "gate_rejected", traceId: "gate_rejected" },
    observations: [],
  });
  return {
    candidate,
    decision: decisionValidation.valid ? structuredClone(candidate as ObservabilityBuildResult) : { ...gatedFromInvalid, status: "REJECTED" } as ObservabilityBuildResult,
    decisionValidation,
  };
}

export function isObservabilityBuildInput(value: unknown): value is ObservabilityBuildInput {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as { observations?: unknown }).observations) &&
    typeof (value as { policy?: unknown }).policy === "object"
  );
}
