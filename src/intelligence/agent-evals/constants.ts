export const AGENT_EVALS_SKILL_ID = "intelligence.agent-evals.s13n";
export const AGENT_EVALS_QUALITY_CONTRACT_REF = "S13N_AGENT_EVALS_DEEP";
export const AGENT_EVALS_DIMENSIONS = ["SD-001", "SD-002", "SD-003", "SD-004", "SD-005", "SD-006", "SD-007", "SD-008"] as const;
export const AGENT_EVALS_ATOMIC_IDS = AGENT_EVALS_DIMENSIONS.flatMap((dimension, i) => ["A", "B", "C"].map((suffix) => `SD${i + 1}-${suffix}`));
