import type { SkillDefinition } from "../../core/skill/index.js";
import {
  OBSERVABILITY_INPUT_MARKER,
  OBSERVABILITY_QUALITY_CONTRACT_REF,
  OBSERVABILITY_SKILL_ID,
} from "./constants.js";

export { OBSERVABILITY_INPUT_MARKER, OBSERVABILITY_QUALITY_CONTRACT_REF, OBSERVABILITY_SKILL_ID } from "./constants.js";

/** The 18 normative MUST rules from OBSERVABILITY_AI_SYSTEMS_SKILL_S13P.md, verbatim in intent. */
const mustRules = [
  "Every accepted observation binds exactly one non-empty run_id and trace_id; conflicting or cross-run bundle identity rejects the bundle.",
  "Accept only the explicit S13P safe schema; never ingest raw prompts, messages, context, retrieved content, tool arguments/results, headers, bodies, credentials, secrets, raw provider errors or arbitrary provider_metadata; unknown keys are rejected, never copied.",
  "Represent prompts with opaque prompt_ref plus explicit prompt_version and, only when approved, a sha256 template digest over canonical non-secret material; never retain prompt or user content.",
  "Represent a model call with safe provider_ref, model_ref and optional model_version_ref; account, organization, project, region, endpoint and credential data are forbidden.",
  "Represent tool activity with call_id, capability_id, phase, side-effect class, outcome, observed duration and normalized error code only; arguments and results are forbidden.",
  "Record tokens, cost and latency only when explicitly observed; missing means unknown, never zero; never estimate tokens, consult pricing, convert currency or infer latency from an unapproved clock.",
  "Cost amounts are non-negative canonical decimal strings with uppercase three-letter currencies; aggregate only within one currency and never emit a cross-currency total.",
  "sequence is the canonical order: a unique safe integer that strictly increases after deterministic sorting; timestamps add evidence but never override sequence, and skew or late evidence is never repaired by invention.",
  "Span IDs are unique within a trace, parents resolve or are explicitly marked missing, the accepted parent graph is acyclic, and COMPLETE requires a terminal run observation with explicit outcome and reason.",
  "Persist only normalized error source, category, code, retryability and an optional approved-tuple fingerprint; raw messages and stacks are forbidden.",
  "Sampling is deterministic from the versioned policy plus sampling_seed, run_id and observation_id; run start, terminal state, safety/policy violations, errors, failed/cancelled evidence and dropped summaries are never sampled out, and caller priority cannot downgrade required evidence.",
  "Enforce every per-run cardinality, reference, duration and serialized-byte ceiling; a policy may lower but never raise them; low-priority overflow is dropped deterministically with a count-only summary and PARTIAL status, and required overflow rejects the bundle.",
  "Produce a retention directive only (EPHEMERAL default, OPERATIONAL at most seven days, AUDIT_REF_ONLY at most thirty days); never lengthen a requested duration and never perform durable persistence.",
  "Never mutate caller inputs; byte-equivalent normalized inputs and policy produce identical order, diagnostics, aggregates and sampling decisions; time and randomness must be caller-supplied.",
  "Record a safe source kind and optional evidence refs per observation; a lower-precedence claim never overwrites a higher-precedence observation and conflicts remain diagnostics.",
  "S13P is DEEP plus SKILL_ONLY: a pure typed Intelligence reference module, focused tests and one append-only S12 catalog entry; never change Core, AgentDefinition, prior Part A, dependencies or provider bindings.",
  "S13P owns safe per-run observability vocabulary, validation, projection, bounded aggregation and the evidence bundle; cross-run storage, dashboards, alerting, fleet optimization and improvement loops belong to S20.",
  "The candidate implementation may emit diagnostics and completeness but never awards itself PASS, an honor invariant or independent verification; deterministic tests and a fresh non-authoring verifier recompute all claims.",
] as const;

export const observabilityAiSystemsSkillS13P: SkillDefinition = {
  id: OBSERVABILITY_SKILL_ID,
  version: "1.0.0",
  description:
    "Produce a bounded, provider-neutral, privacy-safe and deterministically verifiable per-run observability bundle from explicitly safe projections of run, prompt-version, model-call, tool-call, usage, cost, latency, error, operation, job and attempt evidence.",
  applies_when: {
    task_kinds: ["observability-ai-systems", "run-trace-projection", "usage-cost-evidence", "observability-bundle"],
    signals: ["run trace", "prompt version", "model call", "tool call", "tokens", "cost", "latency", "normalized error", "observability bundle"],
    exclusions: ["telemetry vendor selection", "collector or exporter", "dashboard or alerting", "cross-run analytics", "S20 orchestration", "raw prompt or payload capture"],
  },
  inputs: [
    { name: "run", description: "Stable opaque run_id/trace_id plus optional safe task, agent and eval refs.", required: true, schema: { type: "object" } },
    { name: "observations", description: "Explicit safe SafeObservationCandidate projections; never raw runtime event.details.", required: true, schema: { type: "array" } },
    { name: "policy", description: "Versioned ObservabilityPolicy at or below the S13P ceilings.", required: true, schema: { type: "object" } },
    { name: "evidence_refs", description: "Optional bounded safe evidence references.", required: false, schema: { type: "array" } },
  ],
  outputs: [
    { name: "observability_build_result", description: "One immutable ObservabilityBuildResult (COMPLETE | PARTIAL | REJECTED).", required: true, schema: { type: "object" } },
  ],
  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["CURRENT_TASK", "APPROVED_SPEC", "QUALITY_CONTRACT", "AGENT_RUN_RESULT", "RUNTIME_METADATA"],
    quality_contract_refs: [OBSERVABILITY_QUALITY_CONTRACT_REF],
  },
  rules: mustRules.map((statement, index) => ({ id: `S13P-R${String(index + 1).padStart(2, "0")}`, level: "MUST" as const, statement })),
  procedure: [
    { id: "S13P-P1", title: "Confirm scope", instruction: "Verify the task is per-run safe observability, not vendor selection, storage, deployment or S20 optimization.", requires: ["run", "observations", "policy"], produces: ["scoped_request"] },
    { id: "S13P-P2", title: "Validate policy and identity", instruction: "Apply v1 defaults, ensure every override is equal to or stricter than the ceilings, and establish one safe run_id/trace_id.", requires: ["scoped_request"], produces: ["validated_context"] },
    { id: "S13P-P3", title: "Enforce safety before aggregation", instruction: "Validate each candidate against its exact kind, reject prohibited/unknown fields and unsafe refs, then check uniqueness, sequences, span acyclicity, phases and terminality.", requires: ["validated_context"], produces: ["safe_observations"] },
    { id: "S13P-P4", title: "Sample, bound and aggregate", instruction: "Mark never-drop evidence, apply deterministic sampling and cardinality/byte caps with count-only summaries, then aggregate observed tokens, per-currency cost, latency by kind and normalized error counts.", requires: ["safe_observations"], produces: ["bounded_bundle"] },
    { id: "S13P-P5", title: "Decide status and freeze", instruction: "Return COMPLETE, PARTIAL or REJECTED from the normative decision table and emit an immutable bundle with diagnostics, coverage, aggregates, retention directive and evidence refs.", requires: ["bounded_bundle"], produces: ["observability_build_result"] },
  ],
  verification: [
    { id: "S13P-V1", kind: "DETERMINISTIC", criterion: "Prohibited raw/secret content never enters an accepted observation, diagnostic or aggregate.", evidence_required: true },
    { id: "S13P-V2", kind: "DETERMINISTIC", criterion: "Missing metrics remain unknown; sampling never removes required evidence; currencies are never combined.", evidence_required: true },
    { id: "S13P-V3", kind: "DETERMINISTIC", criterion: "External gates recompute status, coverage and aggregates from the actual candidate.", evidence_required: true },
  ],
  permissions: { allowed_capabilities: [], allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  evals: ["evals/s13p/safe-projection", "evals/s13p/observed-usage", "evals/s13p/sampling-bounds"],
};
