import { AGENT_EVALS_ATOMIC_IDS, AGENT_EVALS_DIMENSIONS } from "./constants.js";
import { gateAgentEvalCandidate } from "./evaluateAgentEval.js";
import type { AgentEvalDecision, AgentEvalInput, AgentEvalUnsafeCounters } from "./types.js";

export interface AgentEvalArm { inputs: readonly AgentEvalInput[]; candidates: readonly unknown[]; }
export interface AgentEvalDimensionImpact { delta: number; contribution_counts: Record<string, number>; denominator: number; max_single_assertion_share: number; qualified: boolean; }
export interface AgentEvalComparison { baseline_total_atomic_passes: number; skill_total_atomic_passes: number; delta: number; regressions: string[]; by_dimension: Record<string, AgentEvalDimensionImpact>; qualified_dimensions: string[]; hard_invariants: Record<string, boolean>; unsafe_counters: AgentEvalUnsafeCounters; meets_impact_gate: boolean; }
const zero = (): AgentEvalUnsafeCounters => ({ golden_truth_leak: 0, fixture_or_arm_branching: 0, subject_run_substitution: 0, forbidden_tool_accepted: 0, safety_violation_accepted: 0, required_schema_failure_accepted: 0, unobserved_cost_or_latency_invented: 0, future_stage_pull_forward: 0 });
const observations = (d: AgentEvalDecision): Record<string, boolean> => Object.fromEntries(d.dimensions.flatMap((dimension) => dimension.atomic_results.map((atomic) => [atomic.assertion_id, atomic.result === "PASS"])));

/** Raw per-assertion comparison with the exact 50% share denominator required by S13N. */
export function compareAgentEvalRuns(baseline: AgentEvalArm, skill: AgentEvalArm, hard_invariants: Record<string, boolean>, unsafeCounters: AgentEvalUnsafeCounters = zero()): AgentEvalComparison {
  if (baseline.inputs.length !== 8 || skill.inputs.length !== 8 || baseline.candidates.length !== 8 || skill.candidates.length !== 8) throw new Error("S13N A/B requires exactly eight runs per arm");
  const baselineDecisions = baseline.inputs.map((input, i) => gateAgentEvalCandidate(baseline.candidates[i], input)), skillDecisions = skill.inputs.map((input, i) => gateAgentEvalCandidate(skill.candidates[i], input));
  const base = baselineDecisions.map(observations), target = skillDecisions.map(observations);
  const regressions: string[] = [], by_dimension: Record<string, AgentEvalDimensionImpact> = {};
  for (let d = 0; d < 8; d++) {
    const ids = AGENT_EVALS_ATOMIC_IDS.slice(d * 3, d * 3 + 3), contributions: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
    for (let i = 0; i < 8; i++) for (const id of ids) { if (!base[i]![id] && target[i]![id]) contributions[id]++; if (base[i]![id] && !target[i]![id]) regressions.push(`${i}:${id}`); }
    const denominator = Object.values(contributions).reduce((a, b) => a + b, 0), share = denominator ? Math.max(...Object.values(contributions)) / denominator : 0;
    by_dimension[AGENT_EVALS_DIMENSIONS[d]!] = { delta: denominator, contribution_counts: contributions, denominator, max_single_assertion_share: share, qualified: denominator > 0 && Object.values(contributions).filter((n) => n > 0).length >= 2 && share <= 0.5 };
  }
  const baseTotal = base.reduce((n, x) => n + Object.values(x).filter(Boolean).length, 0), skillTotal = target.reduce((n, x) => n + Object.values(x).filter(Boolean).length, 0), qualified = Object.entries(by_dimension).filter(([, x]) => x.qualified).map(([id]) => id);
  return { baseline_total_atomic_passes: baseTotal, skill_total_atomic_passes: skillTotal, delta: skillTotal - baseTotal, regressions, by_dimension, qualified_dimensions: qualified, hard_invariants, unsafe_counters: unsafeCounters, meets_impact_gate: skillTotal > baseTotal && qualified.length >= 6 && regressions.length === 0 && Object.values(hard_invariants).every(Boolean) && Object.values(unsafeCounters).every((n) => n === 0) };
}
