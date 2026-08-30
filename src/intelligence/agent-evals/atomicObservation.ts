import { AGENT_EVALS_ATOMIC_IDS } from "./constants.js";
import type { AgentEvalAtomicSourceFacts, AgentEvalDecision } from "./types.js";

/** Detached reference observation used only for atomic-isolation and A/B scoring evidence. */
/** Normalized detached observations extracted from a real deterministic evaluator decision. */
export const evaluateAtomicObservation = (decision: AgentEvalDecision): Record<string, unknown> => Object.fromEntries(decision.dimensions.flatMap((dimension) => dimension.atomic_results.map((atomic) => [atomic.assertion_id, { result: atomic.result, reason_code: atomic.reason_code }])));
/** Mutates a detached source observation, never an already-produced decision. */
export const mutateAgentEvalSourceFact = (sourceFacts: AgentEvalAtomicSourceFacts, id: string): void => {
  if (!AGENT_EVALS_ATOMIC_IDS.includes(id) || !sourceFacts[id]) throw new Error(`Unknown canonical atomic source ${id}`);
  sourceFacts[id] = { ...sourceFacts[id], result: sourceFacts[id].result === "PASS" ? "FAIL" : "PASS", reason_code: `SOURCE_FACT_MUTATION:${id}`, evidence_refs: [...sourceFacts[id].evidence_refs] };
};
