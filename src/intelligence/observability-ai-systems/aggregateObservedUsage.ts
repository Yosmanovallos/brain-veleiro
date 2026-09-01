import type {
  CostObservation,
  CurrencyCostAggregate,
  ErrorCountAggregate,
  ErrorObservation,
  LatencyKindAggregate,
  LatencyObservation,
  ObservabilityAggregates,
  ObservabilityDiagnostic,
  SafeObservationCandidate,
  TokenAggregate,
  UsageObservation,
} from "./types.js";

// ---------------------------------------------------------------------------
// Exact decimal arithmetic in integer micro-units (10^-6). No binary float.
// ---------------------------------------------------------------------------

const MICRO = 1_000_000n;

export function costAmountToMicros(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * MICRO + BigInt(fracPadded || "0");
}

export function microsToCostAmount(micros: bigint): string {
  const whole = micros / MICRO;
  const frac = micros % MICRO;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

function emptyComponent() {
  return { observedSum: 0, callsObserved: 0, callsMissing: 0 };
}

/** Semantic contract section 15.1: observed sums plus coverage counts, never a coerced full-run total. */
export function aggregateTokens(usage: readonly UsageObservation[]): TokenAggregate {
  const input = emptyComponent();
  const output = emptyComponent();
  const total = emptyComponent();
  const cachedInput = emptyComponent();
  let consistencyDiagnostics = 0;
  for (const u of usage) {
    for (const [key, comp] of [
      ["inputTokens", input],
      ["outputTokens", output],
      ["totalTokens", total],
      ["cachedInputTokens", cachedInput],
    ] as const) {
      const v = (u as unknown as Record<string, unknown>)[key] as number | undefined;
      if (typeof v === "number") {
        comp.observedSum += v;
        comp.callsObserved += 1;
      } else {
        comp.callsMissing += 1;
      }
    }
    if (
      typeof u.inputTokens === "number" &&
      typeof u.outputTokens === "number" &&
      typeof u.totalTokens === "number" &&
      u.totalTokens !== u.inputTokens + u.outputTokens
    )
      consistencyDiagnostics++;
    if (typeof u.cachedInputTokens === "number" && typeof u.inputTokens === "number" && u.cachedInputTokens > u.inputTokens)
      consistencyDiagnostics++;
  }
  return { input, output, total, cachedInput, consistencyDiagnostics };
}

/**
 * Semantic contract section 11 / 15.2: group by currency and source authority,
 * apply source precedence per call+currency so a lower-precedence duplicate is a
 * diagnostic and never increases the total. Invoice evidence is a separate
 * reconciliation group.
 */
export function aggregateCost(cost: readonly CostObservation[]): {
  costByCurrency: CurrencyCostAggregate[];
  invoiceReconciliationGroups: CurrencyCostAggregate[];
  diagnostics: ObservabilityDiagnostic[];
} {
  const diagnostics: ObservabilityDiagnostic[] = [];
  const precedence: Record<CostObservation["sourceAuthority"], number> = {
    RUNTIME: 3,
    PROVIDER_REPORTED: 2,
    INVOICE_EVIDENCE: 1,
  };

  const operational = cost.filter((c) => c.sourceAuthority !== "INVOICE_EVIDENCE");
  const invoice = cost.filter((c) => c.sourceAuthority === "INVOICE_EVIDENCE");

  const buildGroups = (rows: readonly CostObservation[], applyPrecedence: boolean): CurrencyCostAggregate[] => {
    const byCurrency = new Map<string, CostObservation[]>();
    for (const c of rows) {
      const list = byCurrency.get(c.currency) ?? [];
      list.push(c);
      byCurrency.set(c.currency, list);
    }
    const aggregates: CurrencyCostAggregate[] = [];
    for (const [currency, rowsForCurrency] of [...byCurrency.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      // One authoritative value per (callId, currency).
      const bestPerCall = new Map<string, CostObservation>();
      const noCallRows: CostObservation[] = [];
      for (const c of rowsForCurrency) {
        if (c.callId === undefined) {
          noCallRows.push(c);
          continue;
        }
        const existing = bestPerCall.get(c.callId);
        if (!existing || (applyPrecedence && precedence[c.sourceAuthority] > precedence[existing.sourceAuthority])) {
          if (existing) diagnostics.push({ code: "METRIC_CONFLICT", severity: "PARTIAL", fieldPath: "cost", count: 1 });
          bestPerCall.set(c.callId, c);
        } else if (applyPrecedence) {
          diagnostics.push({ code: "METRIC_CONFLICT", severity: "PARTIAL", fieldPath: "cost", count: 1 });
        }
      }
      const contributing = [...bestPerCall.values(), ...noCallRows];
      let micros = 0n;
      for (const c of contributing) micros += costAmountToMicros(c.amount);
      const callsWithCost = new Set(contributing.filter((c) => c.callId !== undefined).map((c) => c.callId)).size;
      aggregates.push({
        currency,
        observedAmount: microsToCostAmount(micros),
        observationCount: rowsForCurrency.length,
        callsWithCost,
        callsMissingCost: 0,
        sourceAuthorities: [...new Set(rowsForCurrency.map((c) => c.sourceAuthority))].sort(),
      });
    }
    return aggregates;
  };

  const costByCurrency = buildGroups(operational, true);
  if (new Set(costByCurrency.map((c) => c.currency)).size > 1)
    diagnostics.push({ code: "MIXED_CURRENCY_NO_TOTAL", severity: "INFO", fieldPath: "cost", count: 1 });

  return { costByCurrency, invoiceReconciliationGroups: buildGroups(invoice, false), diagnostics };
}

/** Semantic contract section 15.3: group by operationKind; average is a rational, never rounded. */
export function aggregateLatency(latency: readonly LatencyObservation[]): LatencyKindAggregate[] {
  const kinds: LatencyObservation["operationKind"][] = ["RUN", "MODEL_CALL", "TOOL_CALL", "API", "JOB", "ATTEMPT"];
  const out: LatencyKindAggregate[] = [];
  for (const kind of kinds) {
    const rows = latency.filter((l) => l.operationKind === kind);
    if (rows.length === 0) continue;
    const durations = rows.map((l) => l.durationMs);
    const sumMs = durations.reduce((a, b) => a + b, 0);
    out.push({
      operationKind: kind,
      observedCount: rows.length,
      missingCount: 0,
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
      sumMs,
      average: { sumMs, count: rows.length },
    });
  }
  return out;
}

/** Semantic contract section 15.4: count by safe source/category/code/retryability, no raw messages. */
export function aggregateErrors(errors: readonly ErrorObservation[]): {
  errorCounts: ErrorCountAggregate[];
  diagnostics: ObservabilityDiagnostic[];
} {
  const diagnostics: ObservabilityDiagnostic[] = [];
  const map = new Map<string, ErrorCountAggregate>();
  const retryByIdentity = new Map<string, Set<ErrorObservation["retryable"]>>();
  for (const e of errors) {
    const identity = `${e.errorSource}|${e.category}|${e.code}`;
    const key = `${identity}|${String(e.retryable)}`;
    const existing = map.get(key);
    map.set(
      key,
      existing
        ? { ...existing, count: existing.count + 1 }
        : { errorSource: e.errorSource, category: e.category, code: e.code, retryable: e.retryable, count: 1 },
    );
    const seen = retryByIdentity.get(identity) ?? new Set();
    seen.add(e.retryable);
    retryByIdentity.set(identity, seen);
  }
  for (const seen of retryByIdentity.values())
    if (seen.size > 1) diagnostics.push({ code: "METRIC_CONFLICT", severity: "PARTIAL", fieldPath: "error.retryable", count: 1 });
  return {
    errorCounts: [...map.values()].sort((a, b) =>
      `${a.errorSource}${a.category}${a.code}`.localeCompare(`${b.errorSource}${b.category}${b.code}`),
    ),
    diagnostics,
  };
}

export function aggregateObservedUsage(accepted: readonly SafeObservationCandidate[]): {
  aggregates: ObservabilityAggregates;
  diagnostics: readonly ObservabilityDiagnostic[];
} {
  const usage = accepted.filter((o): o is UsageObservation => o.kind === "USAGE_OBSERVED");
  const cost = accepted.filter((o): o is CostObservation => o.kind === "COST_OBSERVED");
  const latency = accepted.filter((o): o is LatencyObservation => o.kind === "LATENCY_OBSERVED");
  const errors = accepted.filter((o): o is ErrorObservation => o.kind === "ERROR_OBSERVED");

  const tokens = aggregateTokens(usage);
  const costResult = aggregateCost(cost);
  const latencyByKind = aggregateLatency(latency);
  const errorResult = aggregateErrors(errors);

  const diagnostics: ObservabilityDiagnostic[] = [...costResult.diagnostics, ...errorResult.diagnostics];
  if (tokens.consistencyDiagnostics > 0)
    diagnostics.push({ code: "TOKEN_TOTAL_MISMATCH", severity: "PARTIAL", count: tokens.consistencyDiagnostics });

  return {
    aggregates: {
      tokens,
      costByCurrency: costResult.costByCurrency,
      crossCurrencyTotal: null,
      latencyByKind,
      errorCounts: errorResult.errorCounts,
      invoiceReconciliationGroups: costResult.invoiceReconciliationGroups,
    },
    diagnostics,
  };
}
