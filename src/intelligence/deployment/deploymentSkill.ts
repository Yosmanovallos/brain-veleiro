import type { SkillDefinition } from '../../core/skill/index.js';
// Method statements copied verbatim from canonical Part A, not authored here.
export const deploymentSkillS13R: SkillDefinition = {
  "id": "intelligence.deployment.s13r",
  "version": "1.0.0",
  "description": "Use this Skill to reason about deployment readiness and provider-neutral deployment packaging from explicit repository/runtime evidence. S13R owns Docker-first packaging intent, environment/secrets injection contracts, health/readiness semantics, deployment evidence evaluation and deployed-verification reasoning. It must fail closed when the product has no evidenced deployable entrypoint.",
  "applies_when": {
    "task_kinds": [
      "deployment"
    ],
    "signals": [
      "deployment",
      "Docker",
      "environment",
      "health",
      "evidence"
    ],
    "exclusions": [
      "capability registry",
      "workflow runtime"
    ]
  },
  "inputs": [
    {
      "name": "deployment_input",
      "description": "DeploymentInput",
      "required": true,
      "schema": {
        "type": "object"
      }
    }
  ],
  "outputs": [
    {
      "name": "deployment_result",
      "description": "DeploymentDecision",
      "required": true,
      "schema": {
        "type": "object"
      }
    }
  ],
  "requires": {
    "skills": [],
    "capabilities": [],
    "context_sources": [
      "CURRENT_TASK",
      "REPOSITORY_FACT"
    ],
    "quality_contract_refs": [
      "brain-bootstrap/quality-contracts/S13R_DEPLOYMENT_DEEP.yaml"
    ]
  },
  "rules": [
    {
      "id": "DEP-R1",
      "level": "MUST",
      "statement": "Bind the exact project/revision/deployment scope."
    },
    {
      "id": "DEP-R2",
      "level": "MUST",
      "statement": "Validate the repository/build/runtime facts structurally."
    },
    {
      "id": "DEP-R3",
      "level": "MUST",
      "statement": "Determine whether a deployable entrypoint exists from evidence only."
    },
    {
      "id": "DEP-R4",
      "level": "MUST",
      "statement": "If no entrypoint exists, return `BLOCKED_NO_DEPLOYABLE_ENTRYPOINT`; do not create one."
    },
    {
      "id": "DEP-R5",
      "level": "MUST",
      "statement": "If a deployable entrypoint exists, derive a Docker-first packaging plan from exact build/start/runtime facts."
    },
    {
      "id": "DEP-R6",
      "level": "MUST",
      "statement": "Derive environment requirements from an allowlisted set of variable names only; secret values stay external references."
    },
    {
      "id": "DEP-R7",
      "level": "MUST",
      "statement": "Evaluate writable path, persistence and single/multi-replica assumptions explicitly."
    },
    {
      "id": "DEP-R8",
      "level": "MUST",
      "statement": "Derive health/readiness checks only from an existing transport or process contract. Never invent an HTTP port/route."
    },
    {
      "id": "DEP-R9",
      "level": "MUST",
      "statement": "Keep deployment provider mapping `PROVIDER_NEUTRAL` unless an authorized provider fact exists."
    },
    {
      "id": "DEP-R10",
      "level": "MUST",
      "statement": "Evaluate supplied build/start/health/deployed evidence and derive `READY`, `PARTIAL` or `BLOCKED` without self-certification."
    },
    {
      "id": "DEP-R11",
      "level": "MUST",
      "statement": "Emit structured authoritative output first; rendered Docker/config/check snippets are deterministic derivative projections only."
    },
    {
      "id": "DEP-R12",
      "level": "MUST",
      "statement": "Preserve S14+ capability/MCP/OAuth/tool execution and S15+ verifier/workflow/orchestration boundaries."
    }
  ],
  "procedure": [
    {
      "id": "DEP-P1",
      "title": "Core method 1",
      "instruction": "Bind the exact project/revision/deployment scope.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P2",
      "title": "Core method 2",
      "instruction": "Validate the repository/build/runtime facts structurally.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P3",
      "title": "Core method 3",
      "instruction": "Determine whether a deployable entrypoint exists from evidence only.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P4",
      "title": "Core method 4",
      "instruction": "If no entrypoint exists, return `BLOCKED_NO_DEPLOYABLE_ENTRYPOINT`; do not create one.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P5",
      "title": "Core method 5",
      "instruction": "If a deployable entrypoint exists, derive a Docker-first packaging plan from exact build/start/runtime facts.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P6",
      "title": "Core method 6",
      "instruction": "Derive environment requirements from an allowlisted set of variable names only; secret values stay external references.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P7",
      "title": "Core method 7",
      "instruction": "Evaluate writable path, persistence and single/multi-replica assumptions explicitly.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P8",
      "title": "Core method 8",
      "instruction": "Derive health/readiness checks only from an existing transport or process contract. Never invent an HTTP port/route.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P9",
      "title": "Core method 9",
      "instruction": "Keep deployment provider mapping `PROVIDER_NEUTRAL` unless an authorized provider fact exists.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P10",
      "title": "Core method 10",
      "instruction": "Evaluate supplied build/start/health/deployed evidence and derive `READY`, `PARTIAL` or `BLOCKED` without self-certification.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P11",
      "title": "Core method 11",
      "instruction": "Emit structured authoritative output first; rendered Docker/config/check snippets are deterministic derivative projections only.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    },
    {
      "id": "DEP-P12",
      "title": "Core method 12",
      "instruction": "Preserve S14+ capability/MCP/OAuth/tool execution and S15+ verifier/workflow/orchestration boundaries.",
      "requires": [
        "deployment_input"
      ],
      "produces": [
        "deployment_result"
      ]
    }
  ],
  "verification": [
    {
      "id": "DEP-V1",
      "kind": "DETERMINISTIC",
      "criterion": "Part B must provide real same-path Skill-vs-no-Skill evaluation with frozen provider-blind truth; exact candidate gating; deterministic evaluator; canonical positive/negative fixtures; atomic isolation; grouped assertion contribution accounting; hard invariants; unsafe counters; typecheck/full-suite/clean-build/post-build; no Part A/Core/AgentDefinition/dependency/provider drift.",
      "evidence_required": true
    }
  ],
  "permissions": {
    "allowed_capabilities": [],
    "allowed_side_effects": [
      "NONE"
    ],
    "deny_unlisted_capabilities": true
  },
  "evals": [
    "eval:s13r"
  ]
};
