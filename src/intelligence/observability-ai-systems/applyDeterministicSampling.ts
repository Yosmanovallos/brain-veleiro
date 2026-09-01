import { createHash } from "node:crypto";
import { NEVER_DROP_KINDS } from "./constants.js";
import type {
  ObservabilityDiagnostic,
  ObservationKind,
  ObservationPriority,
  SafeObservationCandidate,
  SamplingSummary,
} from "./types.js";

/**
 * Semantic contract section 8 / rule R11: the builder recomputes the effective
 * priority from kind, phase and outcome. Caller-supplied `priority` is
 * declarative only and can never downgrade never-drop evidence or make an
 * unsafe observation eligible for sampling.
 */
export function effectivePriority(o: SafeObservationCandidate): ObservationPriority {
  if (NEVER_DROP_KINDS.has(o.kind)) return "REQUIRED";
  switch (o.kind) {
    case "MODEL_CALL_COMPLETED":
    case "TOOL_CALL_COMPLETED":
      return o.outcome === "FAILURE" || o.outcome === "CANCELLED" ? "REQUIRED" : "DETAIL";
    case "OPERATION_OBSERVED":
    case "JOB_OBSERVED":
    case "ATTEMPT_OBSERVED":
      return o.phase === "FAILED" || o.phase === "CANCELLED" ? "REQUIRED" : "NORMAL";
    case "USAGE_OBSERVED":
    case "COST_OBSERVED":
    case "LATENCY_OBSERVED":
      return "NORMAL";
    case "PROMPT_RESOLVED":
    case "MODEL_CALL_STARTED":
    case "TOOL_CALL_STARTED":
      return "DETAIL";
    default:
      return "NORMAL";
  }
}

/** Marks the observations that are structurally the sole evidence for a terminal status. */
export function terminalEvidenceRefs(
  observations: readonly SafeObservationCandidate[],
  terminalObservationId: string | undefined,
): ReadonlySet<string> {
  const refs = new Set<string>();
  if (!terminalObservationId) return refs;
  const terminal = observations.find((o) => o.observationId === terminalObservationId);
  for (const r of terminal?.evidenceRefs ?? []) refs.add(r);
  return refs;
}

export interface SamplingResult {
  readonly retained: readonly SafeObservationCandidate[];
  readonly sampledOut: readonly SafeObservationCandidate[];
  readonly summary: SamplingSummary;
  readonly diagnostics: readonly ObservabilityDiagnostic[];
  readonly requiredEvidenceSampledOut: boolean;
}

/**
 * Semantic contract section 9: deterministic SHA-256 sampling over
 * `s13p.policy.v1\n<seed>\n<runId>\n<observationId>`. The first eight digest
 * bytes are read as an unsigned big-endian integer; the observation is retained
 * when `value mod 10_000 < basisPoints`. Never applied to REQUIRED / never-drop
 * evidence.
 */
export function applyDeterministicSampling(
  observations: readonly SafeObservationCandidate[],
  seed: string,
  runId: string,
  basisPoints: number,
  protectedEvidence: ReadonlySet<string> = new Set(),
): SamplingResult {
  const retained: SafeObservationCandidate[] = [];
  const sampledOut: SafeObservationCandidate[] = [];
  let eligibleDetail = 0;
  let requiredEvidenceSampledOut = false;

  for (const o of observations) {
    const priority = effectivePriority(o);
    const isProtected =
      priority === "REQUIRED" ||
      NEVER_DROP_KINDS.has(o.kind) ||
      (o.observationId !== undefined && protectedEvidence.has(o.observationId)) ||
      (o.evidenceRefs ?? []).some((r) => protectedEvidence.has(r));

    if (isProtected || priority !== "DETAIL") {
      retained.push(o);
      continue;
    }
    eligibleDetail++;
    const digest = createHash("sha256")
      .update(`s13p.policy.v1\n${seed}\n${runId}\n${o.observationId}`, "utf8")
      .digest();
    const value = digest.readBigUInt64BE(0);
    if (Number(value % 10_000n) < basisPoints) retained.push(o);
    else sampledOut.push(o);
  }

  // Defence-in-depth: a REQUIRED item must never have been dropped.
  for (const o of sampledOut) {
    if (effectivePriority(o) === "REQUIRED" || NEVER_DROP_KINDS.has(o.kind)) requiredEvidenceSampledOut = true;
  }

  const diagnostics: ObservabilityDiagnostic[] = [];
  if (sampledOut.length > 0)
    diagnostics.push({ code: "SAMPLED_DETAIL", severity: "PARTIAL", count: sampledOut.length });
  if (requiredEvidenceSampledOut)
    diagnostics.push({ code: "REQUIRED_EVIDENCE_OVERFLOW", severity: "REJECT", count: 1 });

  return {
    retained,
    sampledOut,
    diagnostics,
    requiredEvidenceSampledOut,
    summary: {
      basisPoints,
      seed,
      eligibleDetail,
      retainedDetail: eligibleDetail - sampledOut.length,
      sampledOutDetail: sampledOut.length,
    },
  };
}

export function summariseDroppedKinds(dropped: readonly SafeObservationCandidate[]): readonly ObservationKind[] {
  return [...new Set(dropped.map((o) => o.kind))].sort();
}
