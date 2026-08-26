import type { SkillDefinition } from "../../../core/skill/index.js";

/**
 * Reference/test Skill (SKILL_CONTRACT_v1.md section 31): exists only to
 * prove discovery ranking and lazy loading against a catalog containing more
 * than one Skill. NOT a production S13x Skill.
 */
export const referenceSummarize: SkillDefinition = {
  id: "reference.summarize.v1",
  version: "1.0.0",

  description: "Summarize a bounded text input into a short structured summary.",

  applies_when: {
    task_kinds: ["summarization", "documentation"],
    signals: ["summarize", "summary", "condense"],
    exclusions: [],
  },

  inputs: [
    {
      name: "text",
      description: "The bounded source text to summarize.",
      required: true,
      schema: { type: "string" },
    },
  ],

  outputs: [
    {
      name: "summary",
      description: "A short summary of the source text.",
      required: true,
      schema: { type: "string" },
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
      statement: "The summary must be shorter than the source text.",
    },
  ],

  procedure: [
    {
      id: "P1",
      title: "Summarize",
      instruction: "Condense the input text into a short summary that preserves its key points.",
      requires: ["text"],
      produces: ["summary"],
    },
  ],

  verification: [
    {
      id: "V1",
      kind: "DETERMINISTIC",
      criterion: "summary.length is strictly less than text.length.",
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
