import type { SkillDefinition } from "../../../core/skill/index.js";
import {
  IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF,
  IMPLEMENTATION_PLANNING_SKILL_ID,
} from "../../implementation-planning/constants.js";

/**
 * Typed Skill Contract v1 representation of the S13F Implementation Planning
 * Skill.
 *
 * Canonical semantic source of truth:
 * brain-bootstrap/skills/IMPLEMENTATION_PLANNING_SKILL_S13F.md (ChatGPT-authored,
 * integrated verbatim). This file is a *runtime representation* of it, mirroring
 * src/intelligence/skills/definitions/agentEngineeringS13E.ts. It does not
 * weaken or reinterpret any rule.
 *
 * Unlike S13A-S13E, the S13F Part A Skill markdown ships PROSE-structured rules
 * with NO `XX-R#`/`XX-P#`/`XX-V#` ids. This typed representation therefore
 * assigns MECHANICAL ids (`IP-R#`, `IP-P1..IP-P19` matching the markdown's
 * numbered Procedure 1-19, `IP-V#`) while preserving each statement's meaning
 * verbatim-in-substance. This is a mechanical, not a semantic, choice and is
 * recorded in the S13F verification report.
 *
 * `requires.skills: []` / `requires.capabilities: []` (Skill file "Requires") —
 * S13F declares no transitive Skill dependency and is synthesis-only, invoking
 * no tool or capability.
 */
export const implementationPlanningS13F: SkillDefinition = {
  id: IMPLEMENTATION_PLANNING_SKILL_ID,
  version: "1.0.0",

  description:
    "Convert an approved bounded Spec plus architecture and, where applicable, agent-design decisions into a " +
    "deterministic implementation plan with P0/P1/P2 scope, small verifiable tasks, explicit static dependencies, " +
    "milestones, highest-risk assumptions, and stop/de-scope rules. Planning semantics only: it does not execute " +
    "tasks and does not compile execution packages (Stage 10 PLAN, not Stage 11 TASK-COMPILATION).",

  applies_when: {
    task_kinds: ["implementation-planning", "work-breakdown", "plan-decomposition", "milestone-planning"],
    signals: [
      "plan",
      "P0",
      "P1",
      "P2",
      "milestone",
      "dependency",
      "task",
      "verifiable",
      "acceptance",
      "scope",
      "increment",
    ],
    exclusions: [
      "task-prompt-compilation",
      "execution-package-generation",
      "context-pack-assembly",
      "workflow-runtime-design",
      "task-executor-construction",
      "capability-registry-construction",
    ],
  },

  inputs: [
    {
      name: "implementation_planning_input",
      description:
        "Bounded ImplementationPlanningInput: an ImplementationPlanningSpecSnapshot (with ApprovalSnapshot), an " +
        "ApprovedDecisionInput<SoftwareArchitectureDecisionResult>, an agent_design_applicability flag, an optional " +
        "ApprovedDecisionInput<AgentEngineeringResult>, and the Quality Contract reference.",
      required: true,
      schema: { type: "object" },
    },
  ],

  outputs: [
    {
      name: "implementation_plan_result",
      description:
        "Structured ImplementationPlanResult (status READY | PROVISIONAL | BLOCKED, milestones, small verifiable " +
        "tasks with P0/P1/P2 priority, static depends_on, acceptance and evidence requirements, per-task " +
        "compilation_readiness, highest-risk assumptions, stop/de-scope rules, input-derived coverage, blockers, " +
        "topological order) plus a deterministically rendered plan_markdown.",
      required: true,
      schema: { type: "object" },
    },
  ],

  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["CURRENT_TASK", "EXPLICIT_SPEC", "VERIFIED_HANDOFF", "ADR", "COMPILED_KNOWLEDGE"],
    quality_contract_refs: [IMPLEMENTATION_PLANNING_QUALITY_CONTRACT_REF],
  },

  rules: [
    { id: "IP-R1", level: "MUST", statement: "S13F corresponds to Stage 10 PLAN; S13G corresponds to Stage 11 TASK-COMPILATION, and this Skill MUST stop at the Stage 10 boundary." },
    { id: "IP-R2", level: "MUST", statement: "The Skill MUST NOT create or bind an Execution Package, task prompt, objective/instructions package, Context Pack, selected Skills, tools, capabilities, runtime limits, or an executor output contract." },
    { id: "IP-R3", level: "MUST", statement: "Implementation planning is bounded one-pass semantic synthesis; a new implementation-planning AgentDefinition is FORBIDDEN and the Skill never selects, creates, materializes, or activates an AgentDefinition." },
    { id: "IP-R4", level: "MUST", statement: "S13D and S13E outputs are input data consumed read-only, not Skill execution dependencies; requires.skills stays empty." },
    { id: "IP-R5", level: "MUST", statement: "The Spec MUST be APPROVED; otherwise result.status = BLOCKED and tasks = []." },
    { id: "IP-R6", level: "MUST", statement: "A REJECTED architecture or applicable agent-design decision produces BLOCKED; an APPLICABLE agent-design with no AgentEngineeringResult produces BLOCKED." },
    { id: "IP-R7", level: "MUST", statement: "A PENDING architecture or agent-design proposal is never treated as active; tasks that materially reference it, and their transitive dependents, are BLOCKED_PENDING_APPROVAL and the plan is PROVISIONAL." },
    { id: "IP-R8", level: "MUST", statement: "S13F never activates a candidate AgentDefinition and no PENDING proposal becomes active." },
    { id: "IP-R9", level: "MUST", statement: "Every REQUIRED requirement MUST be mapped to one or more P0 tasks or to an explicit blocker." },
    { id: "IP-R10", level: "MUST", statement: "SHOULD maps to P1 by default, OPTIONAL maps to P2 by default, and any exception MUST carry a traceable priority_rationale." },
    { id: "IP-R11", level: "MUST", statement: "P0 MUST NOT depend on P1 or P2, P1 MUST NOT depend on P2, and P0 MUST NOT be silently de-scoped." },
    { id: "IP-R12", level: "MUST", statement: "A task is small and verifiable only when it has one primary observable outcome, acceptance decidable from its own evidence, all acceptance criteria concern that same outcome, and independently acceptable outcomes are split." },
    { id: "IP-R13", level: "MUST", statement: "Do not use arbitrary estimates such as hours, line counts, token counts, or file counts as the definition of small." },
    { id: "IP-R14", level: "MUST", statement: "Every task carries at least one material source ref, explicit acceptance, and explicit evidence, and embeds no Stage 11 execution-package fields." },
    { id: "IP-R15", level: "MUST", statement: "Each acceptance criterion condition MUST be binary enough to support a PASS/FAIL judgment and verification_method does not invent a concrete command the input did not provide." },
    { id: "IP-R16", level: "MUST", statement: "Evidence kinds are bounded to the canonical list and MANUAL_REVIEW requires an explicit reason why deterministic evidence is insufficient." },
    { id: "IP-R17", level: "MUST", statement: "depends_on is the single canonical source of dependency edges; validation MUST reject missing refs, self-dependencies, duplicate dependencies, cycles, P0->P1/P2, P1->P2, and milestone ordering that points to a later milestone." },
    { id: "IP-R18", level: "MUST", statement: "A deterministic topological order MAY be derived but MUST NOT become a second source of truth, and S13F does not execute the graph." },
    { id: "IP-R19", level: "MUST", statement: "Every task MUST belong to exactly one milestone and milestones are ordered." },
    { id: "IP-R20", level: "MUST", statement: "The plan MUST surface material highest-risk assumptions, preferring upstream A-### refs, without promoting a planning-local assumption to durable truth." },
    { id: "IP-R21", level: "MUST", statement: "Stop/de-scope rules MUST de-scope P2 before P1, protect P0, never remove P0 silently, and stop/escalate instead of falsely returning READY when the minimum successful outcome is no longer achievable." },
    { id: "IP-R22", level: "MUST", statement: "A BLOCKED result MUST explain blockers and MUST NOT masquerade as an executable plan." },
    { id: "IP-R23", level: "MUST", statement: "The structured ImplementationPlanResult is authoritative; plan_markdown MUST be rendered deterministically from that structure and no semantic information may exist only in Markdown." },
    { id: "IP-R24", level: "MUST", statement: "Coverage denominators MUST be derived from bounded source refs; do not invent a denominator after seeing model output." },
  ],

  procedure: [
    { id: "IP-P1", title: "Validate bounded input and approval snapshots", instruction: "Validate the bounded ImplementationPlanningInput and every ApprovalSnapshot.", requires: ["implementation_planning_input"], produces: ["validated_input"] },
    { id: "IP-P2", title: "Build the material-ref set from the Spec", instruction: "Enumerate every R-/NFR-/C-/A-/AC- material ref present in the bounded Spec snapshot.", requires: ["validated_input"], produces: ["material_ref_set"] },
    { id: "IP-P3", title: "Read architecture and agent-engineering inputs without mutation", instruction: "Consume the S13D SoftwareArchitectureDecisionResult and the optional S13E AgentEngineeringResult read-only.", requires: ["validated_input"], produces: ["upstream_context"] },
    { id: "IP-P4", title: "Identify minimum successful outcome and scope tiers", instruction: "Determine the minimum successful outcome and assign P0/P1/P2 scope tiers per the priority mapping rules.", requires: ["material_ref_set", "upstream_context"], produces: ["scope_tiers"] },
    { id: "IP-P5", title: "Produce milestone candidates", instruction: "Group the scope tiers into ordered milestone candidates with observable exit criteria.", requires: ["scope_tiers"], produces: ["milestone_candidates"] },
    { id: "IP-P6", title: "Decompose outcomes into small verifiable task candidates", instruction: "Split outcomes into tasks each with one primary observable outcome; split independently acceptable outcomes and independent surfaces.", requires: ["milestone_candidates"], produces: ["task_candidates"] },
    { id: "IP-P7", title: "Attach source and decision refs", instruction: "Attach material Spec refs, constraint refs, assumption refs, architecture refs, and agent-decision refs to each task.", requires: ["task_candidates"], produces: ["traced_tasks"] },
    { id: "IP-P8", title: "Attach acceptance and evidence requirements", instruction: "Give every task binary acceptance criteria and bounded evidence requirements.", requires: ["traced_tasks"], produces: ["verifiable_tasks"] },
    { id: "IP-P9", title: "Assign P0/P1/P2 with rationale", instruction: "Finalize each task priority with a traceable priority_rationale, respecting REQUIRED->P0, SHOULD->P1, OPTIONAL->P2 defaults.", requires: ["verifiable_tasks"], produces: ["prioritized_tasks"] },
    { id: "IP-P10", title: "Build static depends_on", instruction: "Populate each task's depends_on with existing task ids only, as a static DAG.", requires: ["prioritized_tasks"], produces: ["dependency_graph"] },
    { id: "IP-P11", title: "Validate DAG and tier dependency invariants", instruction: "Reject missing/self/duplicate deps, cycles, P0->P1/P2, P1->P2, and later-milestone dependencies.", requires: ["dependency_graph"], produces: ["validated_graph"] },
    { id: "IP-P12", title: "Propagate pending-approval blocking transitively", instruction: "Mark tasks materially referencing a PENDING decision, and their transitive dependents, BLOCKED_PENDING_APPROVAL.", requires: ["validated_graph"], produces: ["readiness_marked_tasks"] },
    { id: "IP-P13", title: "Surface highest-risk assumptions", instruction: "Surface material assumptions that can invalidate cost, sequencing, feasibility, or acceptance, preferring A-### refs.", requires: ["readiness_marked_tasks"], produces: ["risk_assumptions"] },
    { id: "IP-P14", title: "Produce stop/de-scope rules", instruction: "Produce rules that de-scope P2 before P1, protect P0, and stop/escalate when the minimum successful outcome is unreachable.", requires: ["risk_assumptions"], produces: ["descope_rules"] },
    { id: "IP-P15", title: "Compute source-derived coverage counts", instruction: "Compute coverage counts with denominators derived only from bounded source refs.", requires: ["descope_rules"], produces: ["coverage"] },
    { id: "IP-P16", title: "Reject or repair semantic invalidity inside the bounded planning pass", instruction: "Within the bounded pass, reject or repair any plan that violates the failure conditions.", requires: ["coverage"], produces: ["clean_plan"] },
    { id: "IP-P17", title: "Produce structured result", instruction: "Emit the structured ImplementationPlanResult with status READY | PROVISIONAL | BLOCKED.", requires: ["clean_plan"], produces: ["structured_result"] },
    { id: "IP-P18", title: "Render deterministic Markdown", instruction: "Render plan_markdown deterministically from the structured result; no semantic info only in Markdown.", requires: ["structured_result"], produces: ["plan_markdown"] },
    { id: "IP-P19", title: "Stop before Stage 11", instruction: "Stop at the Stage 10 boundary; do not compile instructions, bind tools, assemble a Context Pack, or build an Execution Package.", requires: ["plan_markdown"], produces: ["implementation_plan_result"] },
  ],

  verification: [
    { id: "IP-V1", kind: "DETERMINISTIC", criterion: "A not-APPROVED Spec, a REJECTED decision, or an APPLICABLE agent-design with no result yields status BLOCKED with zero tasks.", evidence_required: true },
    { id: "IP-V2", kind: "DETERMINISTIC", criterion: "A PENDING architecture or agent-design decision yields status PROVISIONAL with the affected tasks and transitive dependents BLOCKED_PENDING_APPROVAL and no proposal activated.", evidence_required: true },
    { id: "IP-V3", kind: "DETERMINISTIC", criterion: "Every REQUIRED requirement is mapped to a P0 task or an explicit blocker; SHOULD defaults to P1 and OPTIONAL to P2.", evidence_required: true },
    { id: "IP-V4", kind: "DETERMINISTIC", criterion: "The dependency graph rejects missing/self/duplicate edges, direct and indirect cycles, P0->P1/P2, P1->P2, and later-milestone dependencies.", evidence_required: true },
    { id: "IP-V5", kind: "DETERMINISTIC", criterion: "Every non-blocker task has at least one acceptance criterion and at least one evidence requirement; MANUAL_REVIEW carries a reason.", evidence_required: true },
    { id: "IP-V6", kind: "DETERMINISTIC", criterion: "Every task cites at least one material source ref and every ref resolves inside the bounded input.", evidence_required: true },
    { id: "IP-V7", kind: "DETERMINISTIC", criterion: "Every task belongs to exactly one ordered milestone.", evidence_required: true },
    { id: "IP-V8", kind: "DETERMINISTIC", criterion: "Coverage denominators equal the input-derived recompute and are never taken from candidate output.", evidence_required: true },
    { id: "IP-V9", kind: "DETERMINISTIC", criterion: "topological_order equals the deterministically derived order and is not a second source of truth.", evidence_required: true },
    { id: "IP-V10", kind: "DETERMINISTIC", criterion: "plan_markdown is exactly the deterministic rendering of the structured result.", evidence_required: true },
    { id: "IP-V11", kind: "DETERMINISTIC", criterion: "The output contains no Stage 11 execution-package field and introduces no new AgentDefinition.", evidence_required: true },
    { id: "IP-V12", kind: "SEMANTIC", criterion: "The plan splits work into small verifiable tasks rather than giant tasks, and stop/de-scope rules protect the minimum successful outcome.", evidence_required: true },
  ],

  permissions: {
    allowed_capabilities: [],
    allowed_side_effects: ["NONE"],
    deny_unlisted_capabilities: true,
  },

  evals: [
    "evals/s13f/ready-positive",
    "evals/s13f/provisional-pending-approval",
    "evals/s13f/blocked-negatives",
    "evals/s13f/skill-vs-no-skill",
  ],
};
