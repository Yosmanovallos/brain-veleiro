import { randomUUID } from "node:crypto";
import type { AgentDefinition } from "../../core/agent/index.js";

/**
 * S11 Intelligence-layer Skill materialization bridge.
 *
 * Implements brain-bootstrap/specs/RESEARCHER_AGENT_v1.md section 4.
 *
 * S12 (generic Skill loading / Skill Registry) does not exist yet, so this
 * bridge is deliberately narrow: it only ever materializes the one approved
 * S11 Research Skill against a base Researcher AgentDefinition and a current
 * research question. It performs no registry discovery, no version
 * resolution, no dynamic plugin loading, and it never branches on
 * `role`. S12 may later replace this bridge with generic Skill loading.
 */

export interface MaterializeResearchTaskParams {
  baseDefinition: AgentDefinition;
  question: string;
  taskId?: string;
}

export function materializeResearchTask(params: MaterializeResearchTaskParams): AgentDefinition {
  const question = params.question?.trim();
  if (!question) {
    throw new Error("materializeResearchTask requires a non-empty research question.");
  }

  const taskId = params.taskId ?? `${params.baseDefinition.id}-task-${randomUUID()}`;

  return {
    ...structuredClone(params.baseDefinition),
    id: taskId,
    objective: `${params.baseDefinition.objective}\n\nCurrent research question: ${question}`,
  };
}
