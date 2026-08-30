import { createHash } from "node:crypto";
import type { AgentEvalInput, AgentEvalProviderAudit, AgentEvalSourceSnapshot } from "./types.js";

const issuedAudits = new WeakMap<object, string>();
const auditBinding = (input: AgentEvalInput): string => `${input.identity.case_id}\u0000${input.identity.truth_ref}\u0000${input.identity.observed_run_id}`;
const forbiddenKeys = new Set(["case_id", "truth_ref", "frozen_truth", "expected", "allowed", "required_capability_ids", "allowed_capability_ids", "forbidden_capability_ids", "required_tool_order", "safety_assertions", "with_skill", "without_skill", "arm_marker"]);

function walk(value: unknown, path: string, violations: string[]): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (forbiddenKeys.has(key)) violations.push(`PROVIDER_FORBIDDEN_FIELD:${next}`);
    walk(child, next, violations);
  }
}

/** Audits the exact materialized provider envelope. Callers provide data, never pass/fail booleans. */
export function auditAgentEvalProviderEnvelope(input: AgentEvalInput, visiblePacket: unknown): AgentEvalProviderAudit {
  const violations: string[] = [];
  walk(visiblePacket, "", violations);
  const encoded = JSON.stringify(visiblePacket);
  for (const [code, secret] of [["CASE_ID", input.identity.case_id], ["TRUTH_REF", input.identity.truth_ref]] as const) {
    if (encoded.includes(JSON.stringify(secret))) violations.push(`PROVIDER_${code}_LEAK`);
  }
  const audit: AgentEvalProviderAudit = Object.freeze({ audit_kind: "COMPUTED_PROVIDER_ENVELOPE_AUDIT", violations: Object.freeze([...new Set(violations)]), visible_packet_sha256: createHash("sha256").update(encoded).digest("hex") });
  issuedAudits.set(audit, auditBinding(input));
  return audit;
}

export function isComputedProviderAudit(value: unknown, input?: AgentEvalInput): value is AgentEvalProviderAudit {
  if (!value || typeof value !== "object" || !issuedAudits.has(value as object)) return false;
  return input === undefined || issuedAudits.get(value as object) === auditBinding(input);
}

export function auditAgentEvalArmParity(baseline: readonly AgentEvalInput[], skill: readonly AgentEvalInput[]): string[] {
  const violations: string[] = [];
  if (baseline.length !== skill.length) violations.push("AB_ARM_LENGTH_DIFFERENCE");
  baseline.forEach((input, index) => {
    if (input !== skill[index]) violations.push(`AB_INPUT_REFERENCE_DIFFERENCE:${index}`);
    if (JSON.stringify(input.frozen_truth) !== JSON.stringify(skill[index]?.frozen_truth)) violations.push(`AB_FROZEN_TRUTH_DIFFERENCE:${index}`);
    if (JSON.stringify(input.observed_run) !== JSON.stringify(skill[index]?.observed_run)) violations.push(`AB_SUBJECT_PROJECTION_DIFFERENCE:${index}`);
  });
  return violations;
}

export function auditAgentEvalBoundarySource(snapshot: AgentEvalSourceSnapshot): string[] {
  const text = [snapshot.provider_source, snapshot.evaluator_source, snapshot.planner_source, snapshot.skill_source].join("\n");
  const checks: Array<[RegExp, string]> = [[/\b(retryEngine|backoffPolicy|idempotencyEngine|asyncJob)\b/i, "FUTURE_RETRY_PLATFORM"], [/\b(telemetryExporter|tracingExporter|monitoringDashboard)\b/i, "FUTURE_OBSERVABILITY_PLATFORM"], [/\b(capabilityRegistry|mcpConnector)\b/i, "FUTURE_CAPABILITY_PLATFORM"], [/\bverifierAgent\b/i, "FUTURE_VERIFIER_AGENT"]];
  return checks.filter(([pattern]) => pattern.test(text)).map(([, code]) => code);
}
