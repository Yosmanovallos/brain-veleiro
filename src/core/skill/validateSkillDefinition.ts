import type { SkillDefinition } from "./types.js";

/**
 * Deterministic SkillDefinition validator.
 *
 * Implements brain-bootstrap/specs/SKILL_CONTRACT_v1.md section 25. A
 * malformed Skill MUST fail before becoming a loadable runtime Skill
 * definition — no silent defaults for semantically required fields.
 */

const VALID_RULE_LEVELS = new Set(["MUST", "SHOULD", "MAY"]);
const VALID_VERIFICATION_KINDS = new Set(["DETERMINISTIC", "SEMANTIC", "HUMAN"]);
const VALID_SIDE_EFFECTS = new Set(["NONE", "LOCAL", "EXTERNAL"]);

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function isJsonSchemaLike(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSkillDefinition(definition: SkillDefinition): SkillValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(definition?.id)) errors.push("id must be a non-empty string");
  if (!isNonEmptyString(definition?.version)) errors.push("version must be a non-empty string");
  if (!isNonEmptyString(definition?.description)) errors.push("description must be a non-empty string");

  const applies_when = definition?.applies_when;
  if (!applies_when) {
    errors.push("applies_when is required");
  } else {
    const taskKinds = applies_when.task_kinds ?? [];
    const signals = applies_when.signals ?? [];
    const exclusions = applies_when.exclusions ?? [];
    if (taskKinds.length + signals.length < 1) {
      errors.push("applies_when.task_kinds + applies_when.signals must contain at least one item");
    }
    if (hasDuplicates(taskKinds)) errors.push("applies_when.task_kinds must not contain duplicate values");
    if (hasDuplicates(signals)) errors.push("applies_when.signals must not contain duplicate values");
    if (hasDuplicates(exclusions)) errors.push("applies_when.exclusions must not contain duplicate values");
  }

  const inputs = definition?.inputs ?? [];
  if (hasDuplicates(inputs.map((i) => i.name))) errors.push("inputs must have unique names");
  inputs.forEach((input, i) => {
    if (!isNonEmptyString(input.name)) errors.push(`inputs[${i}].name must be a non-empty string`);
    if (!isNonEmptyString(input.description)) errors.push(`inputs[${i}].description must be a non-empty string`);
    if (!isJsonSchemaLike(input.schema)) errors.push(`inputs[${i}].schema must be a valid JsonSchemaLike object`);
  });

  const outputs = definition?.outputs ?? [];
  if (hasDuplicates(outputs.map((o) => o.name))) errors.push("outputs must have unique names");
  outputs.forEach((output, i) => {
    if (!isNonEmptyString(output.name)) errors.push(`outputs[${i}].name must be a non-empty string`);
    if (!isNonEmptyString(output.description)) errors.push(`outputs[${i}].description must be a non-empty string`);
    if (!isJsonSchemaLike(output.schema)) errors.push(`outputs[${i}].schema must be a valid JsonSchemaLike object`);
  });

  const requires = definition?.requires;
  if (!requires) {
    errors.push("requires is required");
  } else {
    for (const field of ["skills", "capabilities", "context_sources", "quality_contract_refs"] as const) {
      const values = requires[field];
      if (!Array.isArray(values)) {
        errors.push(`requires.${field} must be an array`);
      } else if (hasDuplicates(values)) {
        errors.push(`requires.${field} must not contain duplicate IDs`);
      }
    }
  }

  const rules = definition?.rules ?? [];
  if (hasDuplicates(rules.map((r) => r.id))) errors.push("rules must have unique ids");
  rules.forEach((rule, i) => {
    if (!isNonEmptyString(rule.id)) errors.push(`rules[${i}].id must be a non-empty string`);
    if (!VALID_RULE_LEVELS.has(rule.level)) errors.push(`rules[${i}].level must be MUST | SHOULD | MAY`);
    if (!isNonEmptyString(rule.statement)) errors.push(`rules[${i}].statement must be a non-empty string`);
  });

  const procedure = definition?.procedure ?? [];
  if (procedure.length < 1) errors.push("procedure must contain at least 1 step");
  if (hasDuplicates(procedure.map((s) => s.id))) errors.push("procedure step ids must be unique");
  procedure.forEach((step, i) => {
    if (!isNonEmptyString(step.id)) errors.push(`procedure[${i}].id must be a non-empty string`);
    if (!isNonEmptyString(step.title)) errors.push(`procedure[${i}].title must be a non-empty string`);
    if (!isNonEmptyString(step.instruction)) errors.push(`procedure[${i}].instruction must be a non-empty string`);
  });

  const verification = definition?.verification ?? [];
  if (verification.length < 1) errors.push("verification must contain at least 1 check");
  if (hasDuplicates(verification.map((v) => v.id))) errors.push("verification check ids must be unique");
  verification.forEach((check, i) => {
    if (!isNonEmptyString(check.id)) errors.push(`verification[${i}].id must be a non-empty string`);
    if (!VALID_VERIFICATION_KINDS.has(check.kind)) {
      errors.push(`verification[${i}].kind must be DETERMINISTIC | SEMANTIC | HUMAN`);
    }
    if (!isNonEmptyString(check.criterion)) errors.push(`verification[${i}].criterion must be a non-empty string`);
  });

  const permissions = definition?.permissions;
  if (!permissions) {
    errors.push("permissions is required");
  } else {
    if (permissions.deny_unlisted_capabilities !== true) {
      errors.push("permissions.deny_unlisted_capabilities must be true");
    }
    const allowedSideEffects = permissions.allowed_side_effects ?? [];
    for (const effect of allowedSideEffects) {
      if (!VALID_SIDE_EFFECTS.has(effect)) {
        errors.push(`permissions.allowed_side_effects contains an invalid value '${effect}'`);
      }
    }
    const requiredCapabilities = requires?.capabilities ?? [];
    const allowedCapabilities = new Set(permissions.allowed_capabilities ?? []);
    for (const capability of requiredCapabilities) {
      if (!allowedCapabilities.has(capability)) {
        errors.push(
          `requires.capabilities contains '${capability}', which is not present in permissions.allowed_capabilities`,
        );
      }
    }
  }

  const evals = definition?.evals ?? [];
  if (evals.some((ref) => !isNonEmptyString(ref))) errors.push("evals entries must be non-empty strings");
  if (hasDuplicates(evals)) errors.push("evals must not contain duplicate references");

  return { valid: errors.length === 0, errors };
}
