import type { SkillDefinition } from "../../src/core/skill/index.js";

/** A minimal, structurally valid SkillDefinition used as a mutation baseline for negative tests. */
export function buildValidSkillDefinition(): SkillDefinition {
  return {
    id: "test.example.v1",
    version: "1.0.0",
    description: "A minimal valid example Skill used only by contract tests.",

    applies_when: {
      task_kinds: ["testing"],
      signals: ["example"],
      exclusions: [],
    },

    inputs: [{ name: "input_a", description: "An example input.", required: true, schema: { type: "string" } }],
    outputs: [{ name: "output_a", description: "An example output.", required: true, schema: { type: "string" } }],

    requires: {
      skills: [],
      capabilities: ["example_capability"],
      context_sources: ["CURRENT_TASK"],
      quality_contract_refs: [],
    },

    rules: [{ id: "R1", level: "MUST", statement: "Do the example thing correctly." }],

    procedure: [
      {
        id: "P1",
        title: "Do it",
        instruction: "Perform the example procedure.",
        requires: ["input_a"],
        produces: ["output_a"],
      },
    ],

    verification: [{ id: "V1", kind: "DETERMINISTIC", criterion: "output_a is non-empty.", evidence_required: true }],

    permissions: {
      allowed_capabilities: ["example_capability"],
      allowed_side_effects: ["NONE"],
      deny_unlisted_capabilities: true,
    },

    evals: [],
  };
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
