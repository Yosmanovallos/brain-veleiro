import { randomUUID } from "node:crypto";
import type { AgentDefinition } from "../../core/agent/index.js";
import type { SkillDefinition } from "../../core/skill/index.js";

/**
 * S13A Intelligence-layer Skill materialization bridge.
 *
 * Implements brain-bootstrap/specs/REQUIREMENTS_DISCOVERY_AGENT_v1.md
 * section 13. S12 intentionally did not define a generic prompt/context Skill
 * materializer, so this bridge is deliberately narrow: it only ever
 * materializes the one selected S13A Skill against a base
 * requirements-discoverer AgentDefinition and a current raw client request.
 * It never branches on `role` or `skill.id`, performs no registry discovery
 * itself (that is S12's job, exercised by the caller via
 * selectSkillForTask()/SkillProvider before this function runs), and is not a
 * generic Skill execution engine.
 *
 * The materialized objective may include only: the raw request; the selected
 * Skill's description, rules, procedure, and verification expectations; and
 * the Quality Contract reference. It must never include the full Skill
 * catalog, unrelated Skills, historical session corpus, or vendor/provider
 * details (section 13).
 *
 * These marker strings are a stable, parseable contract with the ModelProvider
 * that consumes the materialized objective (see
 * tests/requirements-discovery/fixtures.ts) — they are not prose for a human
 * reader.
 */

export const RAW_REQUEST_MARKER = "RAW_REQUEST:";
export const SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";

export interface MaterializeRequirementsDiscoveryTaskParams {
  baseDefinition: AgentDefinition;
  rawRequest: string;
  loadedSkill: SkillDefinition;
  qualityContractRef: string;
  taskId?: string;
}

function assertNonEmptyRawRequest(rawRequest: string | undefined): string {
  const trimmed = rawRequest?.trim();
  if (!trimmed) {
    throw new Error("materializeRequirementsDiscoveryTask requires a non-empty raw client request.");
  }
  return trimmed;
}

/**
 * Skill-assisted materialization: embeds the raw request plus the selected
 * Skill's description/rules/procedure/verification and the Quality Contract
 * reference into a task-specific AgentDefinition objective.
 */
export function materializeRequirementsDiscoveryTask(
  params: MaterializeRequirementsDiscoveryTaskParams,
): AgentDefinition {
  const rawRequest = assertNonEmptyRawRequest(params.rawRequest);
  const skill = params.loadedSkill;

  const rulesBlock = skill.rules.map((r) => `- [${r.level}] ${r.id}: ${r.statement}`).join("\n");
  const procedureBlock = skill.procedure.map((p) => `- ${p.id} ${p.title}: ${p.instruction}`).join("\n");
  const verificationBlock = skill.verification.map((v) => `- ${v.id} (${v.kind}): ${v.criterion}`).join("\n");

  const taskId = params.taskId ?? `${params.baseDefinition.id}-task-${randomUUID()}`;

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective:
      `${params.baseDefinition.objective}\n\n` +
      `${RAW_REQUEST_MARKER}\n${rawRequest}\n\n` +
      `${SKILL_MATERIALIZATION_MARKER} ${skill.id}\n` +
      `SKILL_DESCRIPTION: ${skill.description}\n` +
      `SKILL_RULES:\n${rulesBlock}\n` +
      `SKILL_PROCEDURE:\n${procedureBlock}\n` +
      `SKILL_VERIFICATION:\n${verificationBlock}\n` +
      `QUALITY_CONTRACT_REF: ${params.qualityContractRef}`,
  };
}

export interface MaterializeBaselineRequirementsDiscoveryTaskParams {
  baseDefinition: AgentDefinition;
  rawRequest: string;
  taskId?: string;
}

/**
 * Baseline materialization (REQUIREMENTS_DISCOVERY_AGENT_v1.md section 15):
 * embeds only the raw request — no S13A Skill is selected or materialized.
 * Everything else (base AgentDefinition, ModelProvider class/config, run
 * limits, S09/S10 runtime path) stays identical to the Skill-assisted run;
 * only this function's absence of SKILL_* content differs from
 * materializeRequirementsDiscoveryTask() above.
 */
export function materializeBaselineRequirementsDiscoveryTask(
  params: MaterializeBaselineRequirementsDiscoveryTaskParams,
): AgentDefinition {
  const rawRequest = assertNonEmptyRawRequest(params.rawRequest);
  const taskId = params.taskId ?? `${params.baseDefinition.id}-baseline-${randomUUID()}`;

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\n${RAW_REQUEST_MARKER}\n${rawRequest}`,
  };
}
