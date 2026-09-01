import type {
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
} from "../../src/core/agent/index.js";
import {
  OBSERVABILITY_INPUT_MARKER,
  type ObservabilityBuildInput,
  type ObservabilityBuildResult,
  type SafeObservationCandidate,
} from "../../src/intelligence/observability-ai-systems/index.js";
import { createHash } from "node:crypto";

/**
 * Independent (non-canonical) reference synthesizer used by the two comparison
 * runs. It never imports the builder, gate or quality module, and carries no
 * scenario label, run-mode label, precomputed answer or grader truth. It parses
 * only the visible packet plus whatever generic method prose is present in the
 * materialized objective, and refines a naive projection using concepts
 * extracted from that prose.
 */

export interface ObservabilityMethodFeatures {
  rejectUnknownAndProhibited: boolean;
  preserveUnknownMetrics: boolean;
  keepCurrenciesSeparate: boolean;
  recomputeEffectivePriority: boolean;
  protectRequiredFromSampling: boolean;
  deterministicSamplingDigest: boolean;
  boundedRetentionDirective: boolean;
  truthfulStatusDecision: boolean;
  emitDroppedSummary: boolean;
  exactDecimalCost: boolean;
  enforceBoundedCardinality: boolean;
  keepConflictsAsDiagnostics: boolean;
}

const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hasAll = (t: string, ...groups: readonly (readonly string[])[]) =>
  groups.every((g) => g.some((c) => t.includes(normalize(c))));

export function extractObservabilityMethodFeatures(prose: string): ObservabilityMethodFeatures {
  const t = normalize(prose);
  return {
    rejectUnknownAndProhibited: hasAll(t, ["unknown key", "unknown keys", "safe schema"], ["reject", "never copy", "forbidden"]),
    preserveUnknownMetrics: hasAll(t, ["missing", "unknown"], ["never zero", "observed only", "not estimate"]),
    keepCurrenciesSeparate: hasAll(t, ["currency", "currencies"], ["within one", "per currency", "never", "cross currency"]),
    recomputeEffectivePriority: hasAll(t, ["priority", "caller priority"], ["recompute", "cannot downgrade", "required evidence"]),
    protectRequiredFromSampling: hasAll(t, ["sampling", "sampled out"], ["never", "run start", "terminal", "dropped summaries"]),
    deterministicSamplingDigest: hasAll(t, ["sampling"], ["deterministic"], ["seed", "observation id", "policy"]),
    boundedRetentionDirective: hasAll(t, ["retention"], ["directive", "ephemeral", "seven days", "thirty days"], ["never", "not perform", "durable"]),
    truthfulStatusDecision: hasAll(t, ["complete", "partial", "rejected"], ["decision table", "terminal", "outcome", "reason"]),
    emitDroppedSummary: hasAll(t, ["overflow", "dropped", "sampled"], ["count only", "summary", "partial"]),
    exactDecimalCost: hasAll(t, ["decimal", "canonical decimal"], ["exact", "non negative", "not", "binary float"]),
    enforceBoundedCardinality: hasAll(t, ["cardinality", "ceiling", "ceilings"], ["enforce", "lower but never raise", "overflow"]),
    keepConflictsAsDiagnostics: hasAll(t, ["conflict", "conflicts"], ["diagnostic", "diagnostics", "never overwrite", "lower precedence"]),
  };
}

function visibleRequest(statement: string): { packet: ObservabilityBuildInput; prose: string } {
  const visible = statement.split(OBSERVABILITY_INPUT_MARKER)[1]?.trimStart();
  if (!visible) throw new Error("missing visible observability packet");
  const nl = visible.indexOf("\n");
  const json = nl < 0 ? visible : visible.slice(0, nl);
  const prose = nl < 0 ? "" : visible.slice(nl + 1);
  return { packet: JSON.parse(json) as ObservabilityBuildInput, prose };
}

const NEVER_DROP = new Set([
  "RUN_STARTED",
  "RUN_TERMINATED",
  "ERROR_OBSERVED",
  "POLICY_VIOLATION",
  "OBSERVATION_DROPPED_SUMMARY",
]);
const BASE_KEYS = new Set([
  "schemaVersion", "observationId", "runId", "traceId", "spanId", "parentSpanId", "missingParent",
  "sequence", "occurredAt", "observedAt", "source", "kind", "evidenceRefs", "priority",
]);
const KIND_KEYS: Record<string, string[]> = {
  RUN_STARTED: ["phase", "terminalReason", "outcome"],
  RUN_TERMINATED: ["phase", "terminalReason", "outcome"],
  PROMPT_RESOLVED: ["promptRef", "promptVersion", "templateDigest", "componentRefs"],
  MODEL_CALL_STARTED: ["callId", "phase", "providerRef", "modelRef", "modelVersionRef", "outcome", "durationMs"],
  MODEL_CALL_COMPLETED: ["callId", "phase", "providerRef", "modelRef", "modelVersionRef", "outcome", "durationMs"],
  TOOL_CALL_STARTED: ["callId", "capabilityId", "phase", "sideEffectClass", "outcome", "inputSchemaRef", "outputSchemaRef", "durationMs", "errorCode"],
  TOOL_CALL_COMPLETED: ["callId", "capabilityId", "phase", "sideEffectClass", "outcome", "inputSchemaRef", "outputSchemaRef", "durationMs", "errorCode"],
  USAGE_OBSERVED: ["callId", "inputTokens", "outputTokens", "totalTokens", "cachedInputTokens", "sourceAuthority"],
  COST_OBSERVED: ["callId", "amount", "currency", "sourceAuthority", "pricingRef"],
  LATENCY_OBSERVED: ["operationKind", "operationRef", "durationMs", "clockSource", "startedAt", "endedAt"],
  ERROR_OBSERVED: ["errorSource", "category", "code", "retryable", "fingerprint", "relatedRef"],
  OPERATION_OBSERVED: ["operationRef", "jobId", "attemptId", "attemptNumber", "phase", "outcome", "durationMs", "errorCode"],
  JOB_OBSERVED: ["operationRef", "jobId", "attemptId", "attemptNumber", "phase", "outcome", "durationMs", "errorCode"],
  ATTEMPT_OBSERVED: ["operationRef", "jobId", "attemptId", "attemptNumber", "phase", "outcome", "durationMs", "errorCode"],
  POLICY_VIOLATION: ["policyCode", "disposition", "affectedObservationRef"],
  OBSERVATION_DROPPED_SUMMARY: ["reason", "droppedCount", "droppedKinds"],
};
const PROHIBITED_KEY = /(?:prompt_?text|\bmessages?\b|\bcontent\b|\bcontext\b|context_?text|retrieved|tool_?input|tool_?output|arguments|results?|command|payload|headers?|\bbody\b|cookie|credential|authorization|\bbearer\b|api[_-]?key|secret|private[_-]?key|\btoken\b|stack|stacktrace|provider_?metadata|\bmetadata\b|account|tenant|organization|\bendpoint\b|\bregion\b|\bemail\b)/i;
const PROHIBITED_VALUE = /(?:-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\bbearer\s+[A-Za-z0-9._~+/=-]{6,}|\b(?:authorization|api[_-]?key|access[_-]?token|secret|password|cookie)\s*[:=]\s*\S{4,}|\bhttps?:\/\/|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/;

function prohibited(value: unknown): boolean {
  if (typeof value === "string") return PROHIBITED_VALUE.test(value);
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(prohibited);
  return Object.entries(value as Record<string, unknown>).some(([k, v]) => PROHIBITED_KEY.test(k) || prohibited(v));
}

function candidateHasUnknownOrProhibited(o: SafeObservationCandidate): boolean {
  const allowed = new Set([...BASE_KEYS, ...(KIND_KEYS[o.kind] ?? ["__invalid__"])]);
  if (!KIND_KEYS[o.kind]) return true;
  if (Object.keys(o).some((k) => !allowed.has(k))) return true;
  return prohibited(o);
}

const microMul = 1_000_000n;
function toMicros(a: string): bigint {
  const [w, f = ""] = a.split(".");
  return BigInt(w) * microMul + BigInt((f + "000000").slice(0, 6) || "0");
}
function fromMicros(m: bigint): string {
  const w = m / microMul;
  const f = m % microMul;
  if (f === 0n) return w.toString();
  return `${w}.${f.toString().padStart(6, "0").replace(/0+$/, "")}`;
}

function digestRetain(seed: string, runId: string, observationId: string, bp: number): boolean {
  const d = createHash("sha256").update(`s13p.policy.v1\n${seed}\n${runId}\n${observationId}`, "utf8").digest();
  return Number(d.readBigUInt64BE(0) % 10_000n) < bp;
}

function effPriority(o: SafeObservationCandidate, recompute: boolean): string {
  if (!recompute) return o.priority;
  if (NEVER_DROP.has(o.kind)) return "REQUIRED";
  if ((o.kind === "MODEL_CALL_COMPLETED" || o.kind === "TOOL_CALL_COMPLETED")) return o.outcome === "FAILURE" || o.outcome === "CANCELLED" ? "REQUIRED" : "DETAIL";
  if (o.kind === "OPERATION_OBSERVED" || o.kind === "JOB_OBSERVED" || o.kind === "ATTEMPT_OBSERVED") return o.phase === "FAILED" || o.phase === "CANCELLED" ? "REQUIRED" : "NORMAL";
  if (o.kind === "USAGE_OBSERVED" || o.kind === "COST_OBSERVED" || o.kind === "LATENCY_OBSERVED") return "NORMAL";
  if (o.kind === "PROMPT_RESOLVED" || o.kind === "MODEL_CALL_STARTED" || o.kind === "TOOL_CALL_STARTED") return "DETAIL";
  return "NORMAL";
}

/** Produces one packet-derived candidate bundle, refined only by concepts found in prose. */
export function synthesizeObservabilityBundle(
  input: ObservabilityBuildInput,
  prose: string,
): ObservabilityBuildResult {
  const f = extractObservabilityMethodFeatures(prose);
  const run = { runId: input.run.runId, traceId: input.run.traceId };
  const evidenceRefs = [...(input.evidenceRefs ?? [])];

  // 1. accept/reject observations.
  const accepted: SafeObservationCandidate[] = [];
  let rejectedObservations = 0;
  let requiredRejected = false;
  for (const o of input.observations) {
    const bad =
      o.runId !== run.runId ||
      o.traceId !== run.traceId ||
      (f.rejectUnknownAndProhibited && candidateHasUnknownOrProhibited(o));
    if (bad) {
      rejectedObservations++;
      if (NEVER_DROP.has(o.kind) || o.priority === "REQUIRED") requiredRejected = true;
      continue;
    }
    accepted.push(o);
  }

  const prohibitedAnywhere = input.observations.some((o) => o.runId === run.runId && o.traceId === run.traceId && prohibited(o));
  if ((!f.rejectUnknownAndProhibited && prohibitedAnywhere) || requiredRejected || prohibited(input.run)) {
    return rejected(run, input);
  }

  // 2. order + trace facts.
  const ordered = [...accepted].sort((a, b) => a.sequence - b.sequence);
  const starts = ordered.filter((o) => o.kind === "RUN_STARTED");
  const terminals = ordered.filter((o) => o.kind === "RUN_TERMINATED");
  const hasRunStarted = starts.length === 1;
  const hasRunTerminated = terminals.length === 1;
  const terminal = terminals[0] as { outcome?: string; terminalReason?: string } | undefined;
  const terminalOutcomeKnown = !!terminal && terminal.outcome !== undefined && terminal.terminalReason !== undefined;
  const seqs = ordered.map((o) => o.sequence);
  let strictlyIncreasing = true;
  for (let i = 1; i < seqs.length; i++) if (seqs[i] <= seqs[i - 1]) strictlyIncreasing = false;
  const dupIds = new Set(ordered.map((o) => o.observationId)).size !== ordered.length;
  const spanIds = new Set(ordered.filter((o) => o.spanId).map((o) => o.spanId));
  let unresolvedParent = false;
  let missingParentSpans = 0;
  for (const o of ordered) {
    if (o.parentSpanId !== undefined && !spanIds.has(o.parentSpanId)) {
      if (o.missingParent === true) missingParentSpans++;
      else unresolvedParent = true;
    }
    if (o.parentSpanId === undefined && o.missingParent === true) missingParentSpans++;
  }
  let skew = 0;
  for (const o of ordered) if (Date.parse(o.observedAt) < Date.parse(o.occurredAt)) skew++;
  const startedCalls = new Set(
    ordered.filter((o) => o.kind === "MODEL_CALL_STARTED" || o.kind === "TOOL_CALL_STARTED").map((o) => `${o.kind.split("_")[0]}:${(o as { callId: string }).callId}`),
  );
  let lateEvidence = 0;
  for (const o of ordered)
    if ((o.kind === "MODEL_CALL_COMPLETED" || o.kind === "TOOL_CALL_COMPLETED") && !startedCalls.has(`${o.kind.split("_")[0]}:${(o as { callId: string }).callId}`)) lateEvidence++;

  if (!strictlyIncreasing || dupIds || unresolvedParent || !hasRunStarted || !hasRunTerminated || !terminalOutcomeKnown) {
    return rejected(run, input);
  }

  // 3. sampling.
  const bp = Math.min(input.policy.successDetailSamplingBasisPoints, 10_000);
  const terminalEvidence = new Set(terminal ? (ordered.find((o) => o.kind === "RUN_TERMINATED")?.evidenceRefs ?? []) : []);
  const retained: SafeObservationCandidate[] = [];
  const sampledOut: SafeObservationCandidate[] = [];
  let eligibleDetail = 0;
  for (const o of ordered) {
    const priority = effPriority(o, f.recomputeEffectivePriority);
    const isProtected =
      (f.protectRequiredFromSampling && (priority === "REQUIRED" || NEVER_DROP.has(o.kind))) ||
      (o.evidenceRefs ?? []).some((r) => terminalEvidence.has(r)) ||
      terminalEvidence.has(o.observationId);
    if (isProtected || priority !== "DETAIL") {
      retained.push(o);
      continue;
    }
    eligibleDetail++;
    const keep = f.deterministicSamplingDigest ? digestRetain(input.policy.samplingSeed, run.runId, o.observationId, bp) : bp >= 10_000;
    if (keep) retained.push(o);
    else sampledOut.push(o);
  }

  if (sampledOut.some((o) => NEVER_DROP.has(o.kind) || effPriority(o, true) === "REQUIRED")) return rejected(run, input);

  // cardinality caps
  let work = [...retained];
  const droppedForCardinality: SafeObservationCandidate[] = [];
  const eff = (key: string, dflt: number) => {
    const ov = (input.policy.limits as Record<string, number> | undefined)?.[key];
    return typeof ov === "number" && ov >= 0 && ov <= dflt ? ov : dflt;
  };
  const caps: Array<[number, (o: SafeObservationCandidate) => string | undefined]> = [
    [eff("maxSpansPerRun", 256), (o) => o.spanId],
    [eff("maxPromptRefsPerRun", 32), (o) => (o.kind === "PROMPT_RESOLVED" ? (o as { promptRef: string }).promptRef : undefined)],
    [eff("maxModelRefsPerRun", 16), (o) => (o.kind === "MODEL_CALL_STARTED" || o.kind === "MODEL_CALL_COMPLETED" ? (o as { modelRef: string }).modelRef : undefined)],
    [eff("maxCapabilityRefsPerRun", 64), (o) => (o.kind === "TOOL_CALL_STARTED" || o.kind === "TOOL_CALL_COMPLETED" ? (o as { capabilityId: string }).capabilityId : undefined)],
    [eff("maxErrorCodesPerRun", 32), (o) => (o.kind === "ERROR_OBSERVED" ? (o as { code: string }).code : undefined)],
  ];
  if (f.enforceBoundedCardinality) {
    for (const [ceiling, extract] of caps) {
      const seen = new Set<string>();
      const kept: SafeObservationCandidate[] = [];
      for (const o of work) {
        const v = extract(o);
        if (v === undefined) { kept.push(o); continue; }
        if (seen.size < ceiling || seen.has(v)) { seen.add(v); kept.push(o); }
        else if (NEVER_DROP.has(o.kind) || effPriority(o, true) === "REQUIRED") return rejected(run, input);
        else droppedForCardinality.push(o);
      }
      work = kept;
    }
  }

  const allDropped = [...sampledOut, ...droppedForCardinality];
  let workObs = [...work];
  if ((f.emitDroppedSummary || f.enforceBoundedCardinality) && allDropped.length > 0) {
    workObs.push({
      schemaVersion: "s13p.observation.v1",
      observationId: `s13p.dropped.summary.${work.length}`,
      runId: run.runId,
      traceId: run.traceId,
      sequence: Number.MAX_SAFE_INTEGER,
      occurredAt: ordered[0]?.occurredAt ?? "1970-01-01T00:00:00Z",
      observedAt: ordered[0]?.observedAt ?? "1970-01-01T00:00:00Z",
      source: "CALLER_SAFE",
      kind: "OBSERVATION_DROPPED_SUMMARY",
      priority: "REQUIRED",
      reason: sampledOut.length > 0 ? "SAMPLING" : "CARDINALITY",
      droppedCount: allDropped.length,
      droppedKinds: [...new Set(allDropped.map((o) => o.kind))].sort() as SafeObservationCandidate["kind"][],
    } as SafeObservationCandidate);
  }

  // 4. aggregate.
  const usage = workObs.filter((o) => o.kind === "USAGE_OBSERVED") as unknown as Array<Record<string, unknown>>;
  const comp = (key: string) => {
    let observedSum = 0, callsObserved = 0, callsMissing = 0;
    for (const u of usage) {
      const v = u[key] as number | undefined;
      if (typeof v === "number") { observedSum += v; callsObserved++; }
      else if (f.preserveUnknownMetrics) callsMissing++;
    }
    return { observedSum, callsObserved, callsMissing };
  };
  const tokens = {
    input: comp("inputTokens"), output: comp("outputTokens"), total: comp("totalTokens"), cachedInput: comp("cachedInputTokens"),
    consistencyDiagnostics: usage.filter((u) => typeof u.inputTokens === "number" && typeof u.outputTokens === "number" && typeof u.totalTokens === "number" && u.totalTokens !== (u.inputTokens as number) + (u.outputTokens as number)).length,
  };

  const costRows = workObs.filter((o) => o.kind === "COST_OBSERVED") as unknown as Array<Record<string, unknown>>;
  const prec: Record<string, number> = { RUNTIME: 3, PROVIDER_REPORTED: 2, INVOICE_EVIDENCE: 1 };
  const operationalCost = costRows.filter((c) => c.sourceAuthority !== "INVOICE_EVIDENCE");
  const invoiceCost = costRows.filter((c) => c.sourceAuthority === "INVOICE_EVIDENCE");
  const groupCost = (rows: Array<Record<string, unknown>>, applyPrec: boolean) => {
    const byCur = new Map<string, Array<Record<string, unknown>>>();
    for (const c of rows) { const l = byCur.get(c.currency as string) ?? []; l.push(c); byCur.set(c.currency as string, l); }
    return [...byCur.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, rs]) => {
      const bestPerCall = new Map<string, Record<string, unknown>>();
      const noCall: Array<Record<string, unknown>> = [];
      for (const c of rs) {
        if (c.callId === undefined) { noCall.push(c); continue; }
        const ex = bestPerCall.get(c.callId as string);
        if (!ex || (applyPrec && prec[c.sourceAuthority as string] > prec[ex.sourceAuthority as string])) bestPerCall.set(c.callId as string, c);
      }
      const contributing = [...bestPerCall.values(), ...noCall];
      let micros = 0n;
      for (const c of contributing) micros += toMicros(c.amount as string);
      return {
        currency,
        observedAmount: f.exactDecimalCost ? fromMicros(micros) : String(contributing.reduce((s, c) => s + parseFloat(c.amount as string), 0)),
        observationCount: rs.length,
        callsWithCost: new Set(contributing.filter((c) => c.callId !== undefined).map((c) => c.callId)).size,
        callsMissingCost: 0,
        sourceAuthorities: [...new Set(rs.map((c) => c.sourceAuthority as string))].sort(),
      };
    });
  };
  const costByCurrency = groupCost(operationalCost, true);
  const crossCurrencyTotal = f.keepCurrenciesSeparate
    ? null
    : costByCurrency.length > 1
      ? fromMicros(operationalCost.reduce((s, c) => s + toMicros(c.amount as string), 0n))
      : null;

  const latRows = workObs.filter((o) => o.kind === "LATENCY_OBSERVED") as unknown as Array<Record<string, unknown>>;
  const latKinds = ["RUN", "MODEL_CALL", "TOOL_CALL", "API", "JOB", "ATTEMPT"] as const;
  const latencyByKind = latKinds
    .map((k) => latRows.filter((l) => l.operationKind === k))
    .filter((rs) => rs.length > 0)
    .map((rs) => {
      const ds = rs.map((l) => l.durationMs as number);
      const sumMs = ds.reduce((a, b) => a + b, 0);
      return { operationKind: rs[0].operationKind as (typeof latKinds)[number], observedCount: rs.length, missingCount: 0, minMs: Math.min(...ds), maxMs: Math.max(...ds), sumMs, average: { sumMs, count: rs.length } };
    });

  const errRows = workObs.filter((o) => o.kind === "ERROR_OBSERVED") as unknown as Array<Record<string, unknown>>;
  const errMap = new Map<string, { errorSource: string; category: string; code: string; retryable: unknown; count: number }>();
  const retryByIdentity = new Map<string, Set<string>>();
  for (const e of errRows) {
    const identity = `${e.errorSource}|${e.category}|${e.code}`;
    const key = `${identity}|${String(e.retryable)}`;
    const ex = errMap.get(key);
    errMap.set(key, ex ? { ...ex, count: ex.count + 1 } : { errorSource: e.errorSource as string, category: e.category as string, code: e.code as string, retryable: e.retryable, count: 1 });
    const seen = retryByIdentity.get(identity) ?? new Set<string>();
    seen.add(String(e.retryable));
    retryByIdentity.set(identity, seen);
  }
  const errorCounts = [...errMap.values()].sort((a, b) => `${a.errorSource}${a.category}${a.code}`.localeCompare(`${b.errorSource}${b.category}${b.code}`));
  const retryConflicts = f.keepConflictsAsDiagnostics ? [...retryByIdentity.values()].filter((s) => s.size > 1).length : 0;

  const aggregates = {
    tokens,
    costByCurrency,
    crossCurrencyTotal,
    latencyByKind,
    errorCounts,
    invoiceReconciliationGroups: groupCost(invoiceCost, false),
  };

  // 5. retention.
  const req = input.policy.requestedRetention;
  let retention: ObservabilityBuildResult["retention"];
  if (req.class === "EPHEMERAL") retention = { class: "EPHEMERAL", days: 0, downgradedFromRequest: false, persistencePerformed: false, note: "no durable retention" };
  else {
    const ceiling = req.class === "OPERATIONAL" ? 7 : 30;
    const days = f.boundedRetentionDirective ? Math.min(req.days, ceiling) : req.days;
    retention = { class: req.class, days, downgradedFromRequest: f.boundedRetentionDirective && days !== req.days, persistencePerformed: false, note: "directive only; a future durable layer must enforce it" };
  }

  // 6. status.
  const diagnostics: Array<{ code: string; severity: string; count: number; fieldPath?: string; observationRef?: string }> = [];
  const pushD = (code: string, severity: string, count = 1, fieldPath?: string) =>
    diagnostics.push({ code, severity, ...(fieldPath ? { fieldPath } : {}), count });
  if (skew > 0) pushD("CLOCK_SKEW", "PARTIAL", skew);
  if (droppedForCardinality.length > 0) pushD("CARDINALITY_LIMIT", "PARTIAL", droppedForCardinality.length);
  if (missingParentSpans > 0) for (const o of ordered.filter((x) => x.missingParent === true)) diagnostics.push({ code: "MISSING_PARENT_SPAN", severity: "PARTIAL", observationRef: o.observationId, count: 1 });
  if (lateEvidence > 0) pushD("LATE_OR_PARTIAL_EVIDENCE", "PARTIAL", lateEvidence);
  if (sampledOut.length > 0) pushD("SAMPLED_DETAIL", "PARTIAL", sampledOut.length);
  if (tokens.consistencyDiagnostics > 0) pushD("TOKEN_TOTAL_MISMATCH", "PARTIAL", tokens.consistencyDiagnostics);
  if (retryConflicts > 0) pushD("METRIC_CONFLICT", "PARTIAL", retryConflicts, "error.retryable");
  if (costByCurrency.length > 1) pushD("MIXED_CURRENCY_NO_TOTAL", "INFO", 1, "cost");
  if (retention.downgradedFromRequest) pushD("RETENTION_DOWNGRADED", "PARTIAL", 1);
  diagnostics.sort((a, b) => a.code.localeCompare(b.code));

  const incompleteTokenCoverage =
    f.preserveUnknownMetrics &&
    tokens.input.callsObserved + tokens.output.callsObserved + tokens.total.callsObserved > 0 &&
    (tokens.input.callsMissing > 0 || tokens.output.callsMissing > 0 || tokens.total.callsMissing > 0);
  const anyPartial =
    rejectedObservations > 0 || sampledOut.length > 0 || skew > 0 || missingParentSpans > 0 || lateEvidence > 0 ||
    droppedForCardinality.length > 0 || retryConflicts > 0 ||
    tokens.consistencyDiagnostics > 0 || retention.downgradedFromRequest || incompleteTokenCoverage;
  const status: ObservabilityBuildResult["status"] = f.truthfulStatusDecision ? (anyPartial ? "PARTIAL" : "COMPLETE") : "COMPLETE";

  const finalObs = [...workObs].sort((a, b) => a.sequence - b.sequence);
  const usageKinds = finalObs.filter((o) => o.kind === "USAGE_OBSERVED" || o.kind === "COST_OBSERVED" || o.kind === "LATENCY_OBSERVED");
  const coverage = {
    acceptedObservations: finalObs.length,
    rejectedObservations,
    requiredObservationsPresent: hasRunStarted && hasRunTerminated && terminalOutcomeKnown,
    hasRunStarted,
    hasRunTerminated,
    terminalOutcomeKnown,
    lateOrPartialEvidence: lateEvidence > 0 || skew > 0 || missingParentSpans > 0,
    missingParentSpans,
    sampledDetailCount: sampledOut.length,
    droppedForCardinality: droppedForCardinality.length,
    droppedForSize: 0,
    unknownMetricCoverage: usageKinds.length === 0,
  };
  const sampling = {
    basisPoints: bp,
    seed: input.policy.samplingSeed,
    eligibleDetail,
    retainedDetail: eligibleDetail - sampledOut.length,
    sampledOutDetail: sampledOut.length,
  };
  const body = {
    schemaVersion: "s13p.bundle.v1" as const,
    policyVersion: "s13p.policy.v1" as const,
    status,
    run,
    observations: finalObs,
    diagnostics,
    coverage,
    aggregates,
    retention,
    sampling,
    evidenceRefs,
  };
  return { ...body, serializedBytes: Buffer.byteLength(JSON.stringify(body), "utf8") } as ObservabilityBuildResult;
}

function rejected(run: { runId: string; traceId: string }, input: ObservabilityBuildInput): ObservabilityBuildResult {
  const body = {
    schemaVersion: "s13p.bundle.v1" as const,
    policyVersion: "s13p.policy.v1" as const,
    status: "REJECTED" as const,
    run,
    observations: [],
    diagnostics: [],
    coverage: {
      acceptedObservations: 0, rejectedObservations: 0, requiredObservationsPresent: false, hasRunStarted: false,
      hasRunTerminated: false, terminalOutcomeKnown: false, lateOrPartialEvidence: false, missingParentSpans: 0,
      sampledDetailCount: 0, droppedForCardinality: 0, droppedForSize: 0, unknownMetricCoverage: true,
    },
    aggregates: {
      tokens: { input: { observedSum: 0, callsObserved: 0, callsMissing: 0 }, output: { observedSum: 0, callsObserved: 0, callsMissing: 0 }, total: { observedSum: 0, callsObserved: 0, callsMissing: 0 }, cachedInput: { observedSum: 0, callsObserved: 0, callsMissing: 0 }, consistencyDiagnostics: 0 },
      costByCurrency: [], crossCurrencyTotal: null, latencyByKind: [], errorCounts: [], invoiceReconciliationGroups: [],
    },
    retention: { class: "EPHEMERAL" as const, days: 0, downgradedFromRequest: false, persistencePerformed: false as const, note: "REJECTED bundle performs no persistence" },
    sampling: { basisPoints: 0, seed: input.policy?.samplingSeed ?? "invalid", eligibleDetail: 0, retainedDetail: 0, sampledOutDetail: 0 },
    evidenceRefs: [],
  };
  return { ...body, serializedBytes: Buffer.byteLength(JSON.stringify(body), "utf8") } as ObservabilityBuildResult;
}

export class BundleProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const { packet, prose } = visibleRequest(request.goal.statement);
    const candidate = synthesizeObservabilityBundle(packet, prose);
    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: "derived from visible run facts and method prose",
        output: { summary: "observability bundle", data: candidate as unknown as Record<string, unknown> },
      },
    };
  }
}
