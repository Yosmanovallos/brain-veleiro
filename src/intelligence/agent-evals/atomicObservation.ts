import { AGENT_EVALS_ATOMIC_IDS } from "./constants.js";
import type { AgentEvalDecision } from "./types.js";

/** Detached reference observation used only for atomic-isolation and A/B scoring evidence. */
/** Normalized detached observations extracted from a real deterministic evaluator decision. */
export const evaluateAtomicObservation = (decision: AgentEvalDecision): Record<string, unknown> => Object.fromEntries(decision.dimensions.flatMap((dimension) => dimension.atomic_results.map((atomic) => [atomic.assertion_id, { result: atomic.result, reason_code: atomic.reason_code }])));
export const mutateDecisionAtomic = (decision: AgentEvalDecision, id: string): void => { const atomic = decision.dimensions.flatMap((dimension) => dimension.atomic_results).find((entry) => entry.assertion_id === id); if (!atomic) throw new Error(`Unknown canonical atomic ${id}`); atomic.result = atomic.result === "PASS" ? "FAIL" : "PASS"; atomic.reason_code = "ISOLATION_MUTATION"; };
