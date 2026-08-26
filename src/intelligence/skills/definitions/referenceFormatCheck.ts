import type { SkillDefinition } from "../../../core/skill/index.js";

/**
 * Reference/test Skill (SKILL_CONTRACT_v1.md section 31): exists only to
 * prove discovery ranking and lazy loading against a catalog containing more
 * than one Skill. NOT a production S13x Skill.
 */
export const referenceFormatCheck: SkillDefinition = {
  id: "reference.format-check.v1",
  version: "1.0.0",

  description: "Check a bounded text input against basic formatting rules and report violations.",

  applies_when: {
    task_kinds: ["qa", "formatting"],
    signals: ["format", "lint", "style-check"],
    exclusions: [],
  },

  inputs: [
    {
      name: "text",
      description: "The bounded text to check.",
      required: true,
      schema: { type: "string" },
    },
  ],

  outputs: [
    {
      name: "format_report",
      description: "A structured report of formatting violations found, if any.",
      required: true,
      schema: { type: "object" },
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["CURRENT_TASK"],
    quality_contract_refs: [],
  },

  rules: [
    {
      id: "R1",
      level: "MUST",
      statement: "Report every violation found; do not silently drop any.",
    },
  ],

  procedure: [
    {
      id: "P1",
      title: "Check formatting",
      instruction: "Inspect the input text against the applicable formatting rules and record violations.",
      requires: ["text"],
      produces: ["format_report"],
    },
  ],

  verification: [
    {
      id: "V1",
      kind: "DETERMINISTIC",
      criterion: "format_report is present and structurally valid.",
      evidence_required: true,
    },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: [],
};
