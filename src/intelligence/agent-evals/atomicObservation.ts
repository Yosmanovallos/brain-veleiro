import { AGENT_EVALS_ATOMIC_IDS } from "./constants.js";
import type { AgentEvalCheckResult } from "./types.js";

/** Detached reference observation used only for atomic-isolation and A/B scoring evidence. */
export type AgentEvalAtomicObservation = Record<(typeof AGENT_EVALS_ATOMIC_IDS)[number], AgentEvalCheckResult>;
export const createPassingAtomicObservation = (): AgentEvalAtomicObservation => Object.fromEntries(AGENT_EVALS_ATOMIC_IDS.map((id) => [id, "PASS"])) as AgentEvalAtomicObservation;
export const evaluateAtomicObservation = (observation: Readonly<AgentEvalAtomicObservation>): Record<string, boolean> => Object.fromEntries(AGENT_EVALS_ATOMIC_IDS.map((id) => [id, observation[id] === "PASS"]));
