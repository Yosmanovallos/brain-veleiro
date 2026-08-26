import type { AgentDefinition } from "./definition.js";

/**
 * Deterministic AgentDefinition validator.
 *
 * Implements brain-bootstrap/specs/AGENT_DEFINITION_v1.md section 20.
 * A malformed definition MUST fail before invoking runAgent() — there are
 * no silent defaults for semantically required fields.
 */

const VALID_ROUTING_CLASSES = new Set(["DEFAULT", "ECONOMY", "BALANCED", "QUALITY"]);
const VALID_CONTEXT_SOURCES = new Set([
  "CURRENT_TASK",
  "CURRENT_RUN",
  "EXPLICIT_SPEC",
  "VERIFIED_HANDOFF",
  "ADR",
  "COMPILED_KNOWLEDGE",
  "DURABLE_MEMORY",
  "HISTORICAL_SESSION",
]);
const VALID_PROMOTION_POLICIES = new Set(["DISABLED", "EXPLICIT_VERIFIED_ONLY"]);
const VALID_SIDE_EFFECTS = new Set(["NONE", "LOCAL", "EXTERNAL"]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function sameSet(a: string[], b: string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const item of setA) if (!setB.has(item)) return false;
  return true;
}

function isJsonSchemaLike(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAgentDefinition(definition: AgentDefinition): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(definition.id)) errors.push("id must be a non-empty string");
  if (!isNonEmptyString(definition.role)) errors.push("role must be a non-empty string");
  if (!isNonEmptyString(definition.objective)) errors.push("objective must be a non-empty string");

  const mp = definition.model_policy;
  if (!mp || !VALID_ROUTING_CLASSES.has(mp.routing_class)) {
    errors.push("model_policy.routing_class must be one of DEFAULT | ECONOMY | BALANCED | QUALITY");
  }
  if (!mp || mp.require_structured_decisions !== true) {
    errors.push("model_policy.require_structured_decisions must be true");
  }

  const cp = definition.context_policy;
  if (!cp || cp.retrieval_mode !== "BOUNDED") {
    errors.push("context_policy.retrieval_mode must be BOUNDED");
  }
  if (!cp || !(cp.max_context_tokens > 0)) {
    errors.push("context_policy.max_context_tokens must be > 0");
  }
  if (!cp || !(cp.max_items > 0)) {
    errors.push("context_policy.max_items must be > 0");
  }
  if (cp?.allowed_sources) {
    for (const source of cp.allowed_sources) {
      if (!VALID_CONTEXT_SOURCES.has(source)) {
        errors.push(`context_policy.allowed_sources contains an invalid source '${source}'`);
      }
    }
  }

  if (!isJsonSchemaLike(definition.state_schema)) {
    errors.push("state_schema must be a valid JsonSchemaLike object");
  }
  if (!isJsonSchemaLike(definition.output_schema)) {
    errors.push("output_schema must be a valid JsonSchemaLike object");
  }

  const tools = definition.tools ?? [];
  const capabilities = definition.capabilities ?? [];
  if (hasDuplicates(tools)) errors.push("tools must not contain duplicate capability IDs");
  if (hasDuplicates(capabilities)) errors.push("capabilities must not contain duplicate capability IDs");
  if (!sameSet(tools, capabilities)) {
    errors.push("tools and capabilities must represent the same normalized set of capability IDs");
  }

  const memPolicy = definition.memory_policy;
  if (!memPolicy) {
    errors.push("memory_policy is required");
  } else {
    for (const field of ["retrieve", "remember_candidate", "commit_verified_memory", "search_history"] as const) {
      if (typeof memPolicy[field] !== "boolean") {
        errors.push(`memory_policy.${field} must be a boolean`);
      }
    }
    if (!VALID_PROMOTION_POLICIES.has(memPolicy.promotion_policy)) {
      errors.push("memory_policy.promotion_policy must be DISABLED | EXPLICIT_VERIFIED_ONLY");
    }
  }

  const permissions = definition.permissions;
  if (!permissions || permissions.deny_unlisted_capabilities !== true) {
    errors.push("permissions.deny_unlisted_capabilities must be true");
  }
  if (!permissions || !Array.isArray(permissions.allowed_side_effects) || permissions.allowed_side_effects.length === 0) {
    errors.push("permissions.allowed_side_effects must be a non-empty array");
  } else {
    for (const effect of permissions.allowed_side_effects) {
      if (!VALID_SIDE_EFFECTS.has(effect)) {
        errors.push(`permissions.allowed_side_effects contains an invalid value '${effect}'`);
      }
    }
  }

  if (!definition.delegation || definition.delegation.allowed !== false) {
    errors.push("delegation.allowed must be false (delegation is inert in AgentDefinition v1)");
  }

  const limits = definition.limits;
  if (!limits || !(limits.max_turns >= 1)) errors.push("limits.max_turns must be >= 1");
  if (!limits || !(limits.timeout_ms >= 1)) errors.push("limits.timeout_ms must be >= 1");

  const termination = definition.termination;
  if (!termination || termination.require_terminal_outcome !== true) {
    errors.push("termination.require_terminal_outcome must be true");
  }
  if (!termination || termination.require_explanation !== true) {
    errors.push("termination.require_explanation must be true");
  }

  if (!definition.rubric || !isNonEmptyString(definition.rubric.quality_contract_ref)) {
    errors.push("rubric.quality_contract_ref must be a non-empty string");
  }

  const evals = definition.evals ?? [];
  if (evals.some((ref) => !isNonEmptyString(ref))) {
    errors.push("evals entries must be non-empty strings");
  }
  if (hasDuplicates(evals)) {
    errors.push("evals must not contain duplicate references");
  }

  return { valid: errors.length === 0, errors };
}
