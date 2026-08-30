import type { SkillDefinition } from "../../core/skill/index.js";
import { AGENT_EVALS_QUALITY_CONTRACT_REF, AGENT_EVALS_SKILL_ID } from "./constants.js";

const rules = ["Evaluate exactly one frozen golden case against exactly one already-observed run.", "Never expose truth, case identity, expected values, arm markers or evaluator helpers to the evaluated provider.", "Gate the actual parsed candidate and recompute deterministic facts from the same input; never substitute a faithful candidate.", "Safety is a hard gate and observed efficiency is never inferred from tokens, prices or FX.", "Use capability_id and observed S09-compatible trace data only; do not bind or execute tools.", "Keep missing optional efficiency evidence NOT_EVALUATED and missing required evidence INCONCLUSIVE unless an independent failure exists.", "Do not create an AgentDefinition, capability, provider, Core branch, platform, retry system, telemetry system, registry, connector or verifier Agent."];
export const agentEvalsS13N: SkillDefinition = {
  id: AGENT_EVALS_SKILL_ID, version: "1.0.0", description: "Produce one bounded deterministic evaluation decision for one already-observed agent run.",
  applies_when: { task_kinds: ["agent-evals"], signals: ["golden case", "observed run", "task success", "tool selection"], exclusions: ["benchmark service", "llm judge", "retry", "telemetry", "capability registry", "verifier agent"] },
  inputs: [{ name: "agent_eval_input", description: "One immutable AgentEvalInput with frozen truth and one exact observed run.", required: true, schema: { type: "object" } }],
  outputs: [{ name: "agent_eval_decision", description: "One deterministic-gateable PASS, FAIL, INCONCLUSIVE or BLOCKED decision.", required: true, schema: { type: "object" } }],
  requires: { skills: [], capabilities: [], context_sources: ["CURRENT_TASK", "APPROVED_SPEC", "QUALITY_CONTRACT", "AGENT_RUN_RESULT", "GOLDEN_CASE", "FROZEN_GROUND_TRUTH", "SECURITY_DECISION", "RUNTIME_METADATA"], quality_contract_refs: [AGENT_EVALS_QUALITY_CONTRACT_REF] },
  rules: rules.map((statement, index) => ({ id: `AE-R${index + 1}`, level: "MUST" as const, statement })),
  procedure: ["Validate packet", "Bind exact run", "Evaluate atomic dimensions", "Gate actual candidate", "Preserve uncertainty"].map((title, index) => ({ id: `AE-P${index + 1}`, title, instruction: title, requires: ["agent_eval_input"], produces: [`agent_evals_${index + 1}`] })),
  verification: Array.from({ length: 32 }, (_, i) => ({ id: `AE-V${i + 1}`, kind: "DETERMINISTIC" as const, criterion: `S13N contract T${String(i + 1).padStart(2, "0")} passes.`, evidence_required: true })),
  permissions: { allowed_capabilities: [], allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true }, evals: ["evals/s13n/positive", "evals/s13n/negative", "evals/s13n/skill-comparison"],
};
