import type { SkillDefinition } from "../../../core/skill/index.js";
import { QA_DEBUGGING_QUALITY_CONTRACT_REF, QA_DEBUGGING_SKILL_ID } from "../../qa-debugging/constants.js";

const rules = [
  "Assess one bounded incident and at most one candidate revision; preserve immutable safe references only.",
  "S13M is SKILL_ONLY: it performs no command, edit, shell, browser, network, retry or capability action.",
  "Require inspectable reproduction matching the declared signature, baseline revision and material environment before closure.",
  "A symptom, correlation, model assertion or green full suite is not root-cause proof.",
  "Require discriminating causal evidence and preserve supporting, contradicting and qualifying evidence references.",
  "Recompute failure class, root-cause state, candidate status and atomic checks from the bounded input.",
  "Require a causally aligned, minimal candidate; reject unrelated refactor, cleanup, unsupported dependency/config change and security weakening.",
  "A semantic contract change is BLOCKED with SEMANTIC_REAUTHOR_REQUIRED; S13L BLOCKED or APPROVAL_REQUIRED is never overridden.",
  "Closure needs the same regression to fail before for the intended signature and pass after on the exact candidate revision.",
  "Select direct regression, impacted module and affected contract suites; shared surfaces broaden required coverage.",
  "Intermittent closure requires repeated bounded pre/post evidence, zero matching post-fix failures and stated limitations.",
  "Actual parsed candidates are total-validated and gated without a faithful substitute; malformed output fails closed without throwing.",
  "No raw secret/PII payload is retained; only safe evidence locators, hashes, counts and limitations are accepted.",
  "Do not implement S13N/S13O/S13P/S13Q/S13R/S14 systems or provider bindings in this Skill.",
  "FIX_VERIFIED is a debugging assessment only; S13M remains open pending fresh independent verification.",
];
export const qaDebuggingS13M: SkillDefinition = {
  id: QA_DEBUGGING_SKILL_ID, version: "1.0.0", description: "Produce one provider-neutral, fail-closed QA/debugging assessment for a bounded incident and candidate fix.",
  applies_when: { task_kinds: ["qa-debugging", "failure-assessment", "regression-closure"], signals: ["reproduce", "failure signature", "root cause", "minimal fix", "regression", "relevant suite"], exclusions: ["autonomous debugger", "shell runner", "retry engine", "telemetry platform", "agent eval platform", "capability registry", "deployment"] },
  inputs: [{ name: "qa_debugging_input", description: "One immutable QaDebuggingInput with bounded evidence references and no raw sensitive payload.", required: true, schema: { type: "object" } }],
  outputs: [{ name: "qa_debugging_decision", description: "A deterministic-gateable INVESTIGATING, FIX_CANDIDATE, FIX_VERIFIED or BLOCKED decision.", required: true, schema: { type: "object" } }],
  requires: { skills: [], capabilities: [], context_sources: ["CURRENT_TASK", "APPROVED_SPEC", "QUALITY_CONTRACT", "INCIDENT_EVIDENCE", "REPOSITORY_STATE", "TEST_RESULTS", "SECURITY_DECISION", "ACCEPTANCE_EVIDENCE"], quality_contract_refs: [QA_DEBUGGING_QUALITY_CONTRACT_REF] },
  rules: rules.map((statement, index) => ({ id: `QD-R${index + 1}`, level: "MUST" as const, statement })),
  procedure: [["QD-P1", "Validate packet", "Total-validate the bounded packet and reject unsafe or malformed structures."], ["QD-P2", "Derive reproduction", "Bind attempts to signature, baseline, environment and evidence."], ["QD-P3", "Assess cause", "Distinguish symptom, hypothesis, causal experiment and unresolved alternatives."], ["QD-P4", "Assess minimal fix", "Require causal alignment and preserve semantic/security boundaries."], ["QD-P5", "Assess regression", "Require equivalent before/after evidence on exact revisions."], ["QD-P6", "Select suite", "Derive direct, impacted, contract and shared-surface coverage."], ["QD-P7", "Gate actual candidate", "Validate the real parsed candidate without substitution."], ["QD-P8", "Preserve boundaries", "Return side-effect-free structured data and defer future systems."]].map(([id, title, instruction]) => ({ id, title, instruction, requires: ["qa_debugging_input"], produces: [id.toLowerCase()] })),
  verification: Array.from({ length: 18 }, (_, i) => ({ id: `QD-V${i + 1}`, kind: i === 17 ? "SEMANTIC" as const : "DETERMINISTIC" as const, criterion: `S13M canonical verification group ${i + 1} passes with evidence.`, evidence_required: true })),
  permissions: { allowed_capabilities: [], allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  evals: ["evals/s13m/qa-debugging-positive", "evals/s13m/qa-debugging-negative", "evals/s13m/qa-debugging-skill-comparison"],
};
