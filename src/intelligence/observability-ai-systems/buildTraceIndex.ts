import type {
  ObservabilityDiagnostic,
  SafeObservationCandidate,
} from "./types.js";

export interface TraceIndex {
  readonly ordered: readonly SafeObservationCandidate[];
  readonly diagnostics: readonly ObservabilityDiagnostic[];
  readonly rejectingCodes: ReadonlySet<ObservabilityDiagnostic["code"]>;
  readonly hasRunStarted: boolean;
  readonly hasRunTerminated: boolean;
  readonly terminalOutcomeKnown: boolean;
  readonly lateOrPartialEvidence: boolean;
  readonly missingParentSpans: number;
  readonly terminalObservationId?: string;
}

const d = (
  code: ObservabilityDiagnostic["code"],
  severity: ObservabilityDiagnostic["severity"],
  count = 1,
  observationRef?: string,
): ObservabilityDiagnostic => ({ code, severity, ...(observationRef ? { observationRef } : {}), count });

/**
 * Semantic contract section 12: builds the ordered trace and reports every
 * structural invariant violation. Rejecting codes force a REJECTED bundle;
 * PARTIAL codes force at most PARTIAL. Sequence stays authoritative over
 * wall-clock timestamps.
 */
export function buildTraceIndex(observations: readonly SafeObservationCandidate[]): TraceIndex {
  const diagnostics: ObservabilityDiagnostic[] = [];
  const rejectingCodes = new Set<ObservabilityDiagnostic["code"]>();
  const partial = (code: ObservabilityDiagnostic["code"], count = 1, ref?: string) => diagnostics.push(d(code, "PARTIAL", count, ref));
  const rej = (code: ObservabilityDiagnostic["code"], count = 1, ref?: string) => {
    diagnostics.push(d(code, "REJECT", count, ref));
    rejectingCodes.add(code);
  };

  const ordered = [...observations].sort((a, b) => a.sequence - b.sequence);

  // Unique observation IDs.
  const idCounts = new Map<string, number>();
  for (const o of ordered) idCounts.set(o.observationId, (idCounts.get(o.observationId) ?? 0) + 1);
  const dupIds = [...idCounts.values()].filter((n) => n > 1).length;
  if (dupIds > 0) rej("DUPLICATE_OBSERVATION_ID", dupIds);

  // Strictly increasing sequences after numeric sort.
  let dupSeq = 0;
  for (let i = 1; i < ordered.length; i++) if (ordered[i].sequence <= ordered[i - 1].sequence) dupSeq++;
  if (dupSeq > 0) rej("DUPLICATE_SEQUENCE", dupSeq);

  // Clock skew is a diagnostic, never a reorder.
  let skew = 0;
  for (const o of ordered) if (Date.parse(o.observedAt) < Date.parse(o.occurredAt)) skew++;
  if (skew > 0) partial("CLOCK_SKEW", skew);

  // Span graph: unique span IDs, parents resolve or are explicitly missing, acyclic.
  const spanIds = new Set<string>();
  for (const o of ordered) if (o.spanId) spanIds.add(o.spanId);
  const parentOf = new Map<string, string | undefined>();
  let missingParentSpans = 0;
  for (const o of ordered) {
    const unresolvedNamedParent = o.parentSpanId !== undefined && !spanIds.has(o.parentSpanId);
    if (o.missingParent === true) {
      missingParentSpans++;
      partial("MISSING_PARENT_SPAN", 1, o.observationId);
    } else if (unresolvedNamedParent) {
      rej("MISSING_PARENT_SPAN", 1, o.observationId);
    }
    if (o.spanId) parentOf.set(o.spanId, o.parentSpanId);
  }
  // Cycle detection over the resolved parent edges.
  const state = new Map<string, 0 | 1 | 2>();
  const visit = (node: string): boolean => {
    const s = state.get(node) ?? 0;
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(node, 1);
    const parent = parentOf.get(node);
    if (parent !== undefined && spanIds.has(parent) && visit(parent)) return true;
    state.set(node, 2);
    return false;
  };
  let cyclic = false;
  for (const span of spanIds) if (visit(span)) cyclic = true;
  if (cyclic) rej("CYCLIC_SPAN_GRAPH");

  // Phase pairs for model / tool calls.
  const startedCalls = new Set<string>();
  for (const o of ordered) {
    if (o.kind === "MODEL_CALL_STARTED" || o.kind === "TOOL_CALL_STARTED") startedCalls.add(`${o.kind.split("_")[0]}:${o.callId}`);
  }
  let lateEvidence = 0;
  for (const o of ordered) {
    if (o.kind === "MODEL_CALL_COMPLETED" || o.kind === "TOOL_CALL_COMPLETED") {
      const key = `${o.kind.split("_")[0]}:${o.callId}`;
      if (!startedCalls.has(key)) {
        if (o.missingParent === true || o.evidenceRefs?.includes("late" as never)) {
          lateEvidence++;
        } else {
          lateEvidence++;
        }
      }
    }
  }
  if (lateEvidence > 0) partial("LATE_OR_PARTIAL_EVIDENCE", lateEvidence);

  // Lifecycle: exactly one accepted start and one accepted terminal; terminal is last lifecycle change.
  const lifecycle = ordered.filter((o) => o.kind === "RUN_STARTED" || o.kind === "RUN_TERMINATED");
  const starts = lifecycle.filter((o) => o.kind === "RUN_STARTED");
  const terminals = lifecycle.filter((o) => o.kind === "RUN_TERMINATED");
  const hasRunStarted = starts.length === 1;
  const hasRunTerminated = terminals.length === 1;
  if (starts.length > 1) rej("INVALID_PHASE_TRANSITION", starts.length - 1);
  if (terminals.length > 1) rej("INVALID_PHASE_TRANSITION", terminals.length - 1);
  if (!hasRunTerminated) partial("MISSING_TERMINAL_OBSERVATION");
  let terminalOutcomeKnown = false;
  let terminalObservationId: string | undefined;
  if (hasRunTerminated) {
    const terminal = terminals[0] as unknown as {
      observationId: string;
      outcome?: string;
      terminalReason?: string;
    };
    terminalObservationId = terminal.observationId;
    terminalOutcomeKnown = terminal.outcome !== undefined && terminal.terminalReason !== undefined;
    if (!terminalOutcomeKnown) rej("MISSING_TERMINAL_OBSERVATION");
    const lastLifecycle = lifecycle[lifecycle.length - 1];
    if (lastLifecycle.kind !== "RUN_TERMINATED") rej("INVALID_PHASE_TRANSITION");
  }

  return {
    ordered,
    diagnostics,
    rejectingCodes,
    hasRunStarted,
    hasRunTerminated,
    terminalOutcomeKnown,
    lateOrPartialEvidence: lateEvidence > 0 || skew > 0 || missingParentSpans > 0,
    missingParentSpans,
    terminalObservationId,
  };
}
