import type { SkillDefinition } from "../../../core/skill/index.js";
import { agentEngineerDefinition } from "../../agent-definitions/agentEngineerDefinition.js";
import { AGENT_ENGINEERING_QUALITY_CONTRACT_REF, AGENT_ENGINEERING_SKILL_ID } from "../../agent-engineering/agentEngineeringSkill.js";

/**
 * Typed Skill Contract v1 representation of the S13E Agent Engineering Skill.
 *
 * Defined in brain-bootstrap/skills/AGENT_ENGINEERING_SKILL_S13E.md
 * (ChatGPT-authored, integrated verbatim). The canonical semantic source of
 * truth remains that Markdown artifact — this file is a *runtime
 * representation* of it, mirroring
 * src/intelligence/skills/definitions/softwareArchitectureS13D.ts. It does
 * not weaken or reinterpret any AE-R/AE-P/AE-V rule.
 *
 * `outputs[0].schema` is reused directly from
 * src/intelligence/agent-definitions/agentEngineerDefinition.ts (the S13E
 * AgentDefinition) so the two stay in sync.
 *
 * `requires.skills: []` / `requires.capabilities: []` (Skill file section:
 * requires) — S13E declares no transitive Skill dependency and the executing
 * agent-engineer-v1 performs no tool/capability calls (AE-R8).
 */
export const agentEngineeringS13E: SkillDefinition = {
  id: AGENT_ENGINEERING_SKILL_ID,
  version: "1.0.0",

  description:
    "Decide whether a work unit genuinely requires an Agent and, only when justified, design a bounded " +
    "least-privilege single Agent using the canonical S10 AgentDefinition contract for goal, state, " +
    "tools/capabilities, permissions, memory, termination, limits, output schema, rubric, and evals.",

  applies_when: {
    task_kinds: ["agent-engineering", "agent-necessity", "agent-design", "execution-model-selection"],
    signals: ["agent", "adaptive loop", "state", "tools", "permissions", "memory", "termination", "evals"],
    exclusions: [
      "multi-agent orchestration",
      "workflow-runtime design",
      "capability-registry construction",
      "MCP creation",
      "agent implementation planning",
      "automatic agent registration",
    ],
  },

  inputs: [
    {
      name: "agent_engineering_input",
      description:
        "Bounded AgentEngineeringInput containing one work unit, optional architecture context, existing Agent " +
        "descriptors, available Skill IDs, and available capability descriptors.",
      required: true,
      schema: { type: "object" },
    },
  ],

  outputs: [
    {
      name: "agent_engineering_result",
      description:
        "Structured AgentEngineeringResult containing an Agent-necessity decision and, only when needed, either an " +
        "existing-Agent reuse recommendation or a proposed new S10-shaped AgentDefinition with design rationale.",
      required: true,
      schema: agentEngineerDefinition.output_schema,
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    quality_contract_refs: [AGENT_ENGINEERING_QUALITY_CONTRACT_REF],
  },

  rules: [
    { id: "AE-R1", level: "MUST", statement: "Decide whether an Agent is necessary before designing one." },
    { id: "AE-R2", level: "MUST", statement: "Complexity, use of an LLM, or a long prompt alone never justifies an Agent." },
    { id: "AE-R3", level: "MUST", statement: "Prefer DETERMINISTIC_FUNCTION when the work unit is a fixed mapping with known steps, no observation-dependent next action, no retry/replan loop, and no within-run adaptive state." },
    { id: "AE-R4", level: "MUST", statement: "Prefer SKILL_ONLY when semantic judgment or reusable guidance is useful but execution can complete in one bounded decision without an observe-act-retry loop or conditional capability use." },
    { id: "AE-R5", level: "MUST", statement: "An Agent is justified only when an adaptive observe-decide-act-observe loop is required and at least one additional agentic signal exists such as conditional capability use, retry/replan, or persistent within-run state." },
    { id: "AE-R6", level: "MUST", statement: "When an Agent is required, prefer REUSE_EXISTING over DESIGN_NEW when a supplied existing Agent descriptor explicitly covers the task kind and satisfies capability, permission, and safety requirements." },
    { id: "AE-R7", level: "MUST", statement: "Never invent an existing Agent, Skill ID, capability ID, side-effect class, or provider." },
    { id: "AE-R8", level: "MUST", statement: "agent-engineer-v1 itself performs no tool or capability calls." },
    { id: "AE-R9", level: "MUST", statement: "A newly designed Agent must conform structurally to the existing S10 AgentDefinition v1 contract without modifying S10." },
    { id: "AE-R10", level: "MUST", statement: "The candidate Agent tools and capabilities sets must be identical and must be subsets of the available capability IDs supplied in the bounded input." },
    { id: "AE-R11", level: "MUST", statement: "Candidate capability selection follows least privilege; optional or unrelated capabilities require explicit justification and are excluded by default." },
    { id: "AE-R12", level: "MUST", statement: "Candidate permissions must allow only the side-effect classes required by selected capabilities and must keep deny_unlisted_capabilities true." },
    { id: "AE-R13", level: "MUST", statement: "Within-run Agent state and cross-run memory are separate concerns and must not be conflated." },
    { id: "AE-R14", level: "MUST", statement: "Cross-run memory is disabled unless the work unit explicitly requires prior verified history across runs." },
    { id: "AE-R15", level: "MUST", statement: "In S13E v1, a proposed candidate Agent always sets commit_verified_memory false; S13E never authorizes automatic durable-memory commits." },
    { id: "AE-R16", level: "MUST", statement: "Candidate termination preserves S09/S10 terminal semantics and never invents new terminal outcome values." },
    { id: "AE-R17", level: "MUST", statement: "Every proposed Agent has bounded max_turns and timeout_ms justified by the work-unit iteration budget." },
    { id: "AE-R18", level: "MUST", statement: "Every proposed Agent has an explicit state schema and output schema appropriate to the work unit." },
    { id: "AE-R19", level: "MUST", statement: "Every proposed Agent includes non-empty eval refs covering goal success, output contract, least privilege, termination, and at least one negative or safety scenario." },
    { id: "AE-R20", level: "MUST", statement: "The proposed Agent rubric points to the work unit quality contract supplied in input; S13E does not fabricate a task-specific Quality Contract." },
    { id: "AE-R21", level: "MUST", statement: "Context policy remains bounded and source-ref aware; never inject the full Agent catalog, full Skill catalog, or unrelated historical context." },
    { id: "AE-R22", level: "MUST", statement: "Delegation remains false in S13E v1 because S09/S10 do not provide a multi-agent coordination model." },
    { id: "AE-R23", level: "MUST", statement: "If an Agent is required but a required capability, output schema, quality contract ref, or safe iteration bound is missing, return BLOCKED instead of inventing the missing contract." },
    { id: "AE-R24", level: "MUST", statement: "S13D architecture context, when supplied, is read-only and may constrain the design but is never mutated or treated as human-approved merely because S13E consumed it." },
    { id: "AE-R25", level: "MUST", statement: "Every S13E result is PROPOSED and approval_required true; no candidate Agent is automatically registered, activated, committed, or deployed." },
    { id: "AE-R26", level: "MUST", statement: "Skill-vs-baseline metrics must score against test-only independent fixture truth and must not derive expected truth from the same output or rules being evaluated." },
    { id: "AE-R27", level: "MUST", statement: "Do not create a generic Agent Factory, meta-runtime, Capability Registry, MCP layer, Workflow Runtime, or Orchestrator in S13E." },
  ],

  procedure: [
    {
      id: "AE-P1",
      title: "Validate bounded input",
      instruction:
        "Validate the work unit, output schema, quality-contract reference, behavioral signals, bounded catalogs, optional architecture context, and source refs.",
      requires: ["agent_engineering_input"],
      produces: ["validated_agent_engineering_input"],
    },
    {
      id: "AE-P2",
      title: "Classify execution model",
      instruction:
        "Decide whether the work unit is best served by a deterministic function, Skill-only execution, or an Agent by applying the canonical necessity criteria without using complexity or LLM usage as sufficient evidence.",
      requires: ["validated_agent_engineering_input"],
      produces: ["necessity_classification"],
    },
    {
      id: "AE-P3",
      title: "Check existing-Agent reuse",
      instruction:
        "When an Agent is required, compare the work unit against supplied existing Agent descriptors and prefer reuse only when task-kind support, capabilities, permissions, and safety constraints are explicitly compatible.",
      requires: ["necessity_classification"],
      produces: ["reuse_decision"],
    },
    {
      id: "AE-P4",
      title: "Identify blocking design gaps",
      instruction:
        "Before designing a new Agent, verify required capability IDs, output schema, quality-contract ref, allowed context sources, and iteration budget are available. Return BLOCKED if a safe definition cannot be authored.",
      requires: ["reuse_decision"],
      produces: ["design_readiness"],
    },
    {
      id: "AE-P5",
      title: "Design goal, state, and output",
      instruction:
        "For DESIGN_NEW, define the candidate objective, bounded state schema, and output schema while keeping work-unit success conditions traceable.",
      requires: ["design_readiness"],
      produces: ["goal_state_output_design"],
    },
    {
      id: "AE-P6",
      title: "Design tools and permissions",
      instruction:
        "Select the minimum capability IDs needed from the supplied capability list, mirror them exactly into tools and capabilities, and derive least-privilege allowed side-effect classes.",
      requires: ["goal_state_output_design"],
      produces: ["capability_permission_design"],
    },
    {
      id: "AE-P7",
      title: "Design memory policy",
      instruction:
        "Distinguish within-run state from cross-run memory. Disable memory unless explicit cross-run history is required. Never enable commit_verified_memory.",
      requires: ["capability_permission_design"],
      produces: ["memory_design"],
    },
    {
      id: "AE-P8",
      title: "Design termination and limits",
      instruction:
        "Preserve canonical terminal semantics and bind max_turns/timeout_ms to the explicit work-unit iteration budget with an explanatory stop rationale.",
      requires: ["memory_design"],
      produces: ["termination_design"],
    },
    {
      id: "AE-P9",
      title: "Design evals and rubric",
      instruction:
        "Define eval refs for success, output shape, least privilege, termination, and negative/safety behavior, and reuse the supplied work-unit quality-contract ref.",
      requires: ["termination_design"],
      produces: ["eval_design"],
    },
    {
      id: "AE-P10",
      title: "Build candidate AgentDefinition",
      instruction:
        "For DESIGN_NEW only, build a complete S10-shaped proposed AgentDefinition with delegation false, bounded context, provider-neutral model policy, and all approved design fields.",
      requires: ["eval_design"],
      produces: ["candidate_agent_definition"],
    },
    {
      id: "AE-P11",
      title: "Produce proposal",
      instruction:
        "Return the need decision, reuse recommendation or new design when applicable, explicit limitations, PROPOSED status, and human-approval requirement without registering or executing the candidate Agent.",
      requires: ["candidate_agent_definition"],
      produces: ["agent_engineering_result"],
    },
  ],

  verification: [
    { id: "AE-V1", kind: "DETERMINISTIC", criterion: "Fixed deterministic work is classified NO_AGENT with DETERMINISTIC_FUNCTION.", evidence_required: true },
    { id: "AE-V2", kind: "DETERMINISTIC", criterion: "One-pass semantic guidance without an adaptive loop may be classified NO_AGENT with SKILL_ONLY.", evidence_required: true },
    { id: "AE-V3", kind: "DETERMINISTIC", criterion: "Canonical adaptive-loop positive fixture is classified AGENT_REQUIRED.", evidence_required: true },
    { id: "AE-V4", kind: "DETERMINISTIC", criterion: "Existing-Agent reuse is preferred over DESIGN_NEW when independent fixture truth says the supplied existing Agent satisfies the work unit.", evidence_required: true },
    { id: "AE-V5", kind: "DETERMINISTIC", criterion: "A DESIGN_NEW candidate passes the existing S10 AgentDefinition validator.", evidence_required: true },
    { id: "AE-V6", kind: "DETERMINISTIC", criterion: "Candidate tools equal capabilities and contain no ID absent from the supplied available-capability list.", evidence_required: true },
    { id: "AE-V7", kind: "DETERMINISTIC", criterion: "Candidate memory, permissions, limits, termination, and evals satisfy the canonical S13E policies.", evidence_required: true },
    { id: "AE-V8", kind: "DETERMINISTIC", criterion: "S13D architecture input, when supplied, remains unchanged after S13E execution.", evidence_required: true },
    { id: "AE-V9", kind: "DETERMINISTIC", criterion: "Every S13E result is PROPOSED, approval_required true, and never auto-registers the candidate.", evidence_required: true },
    { id: "AE-V10", kind: "DETERMINISTIC", criterion: "Skill-assisted output improves canonical S13E metrics versus a no-Skill baseline using independent test-only fixture truth.", evidence_required: true },
    { id: "AE-V11", kind: "DETERMINISTIC", criterion: "Material work-unit signal changes alter the necessity decision or candidate design.", evidence_required: true },
    { id: "AE-V12", kind: "SEMANTIC", criterion: "The design minimizes unnecessary agency and authority while remaining sufficient for the work unit.", evidence_required: true },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: [
    "evals/s13e/agent-required-positive",
    "evals/s13e/no-agent-negative",
    "evals/s13e/reuse-existing",
    "evals/s13e/skill-only",
    "evals/s13e/skill-vs-baseline",
  ],
};
