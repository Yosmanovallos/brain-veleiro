import type { AgentDefinition, JsonSchemaLike } from "../../core/agent/index.js";
import type { SkillDefinition } from "../../core/skill/index.js";
import type {
  ApprovalSnapshot,
  ImplementationPlanTask,
  PlanningAcceptanceCriterion,
  PlanningAssumption,
  PlanningConstraint,
  PlanningNonFunctionalRequirement,
  PlanningRequirement,
  TaskAcceptanceCriterion,
  TaskEvidenceRequirement,
} from "../implementation-planning/types.js";

/**
 * Brain — S13G Task Prompt Compiler semantic types (Stage 11 TASK-COMPILATION).
 *
 * Canonical source of truth: brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md
 * sections 3-4, brain-bootstrap/skills/TASK_PROMPT_COMPILER_SKILL_S13G.md, and
 * brain-bootstrap/quality-contracts/S13G_TASK_PROMPT_COMPILER_DEEP.yaml
 * (ChatGPT-authored, integrated verbatim at commit f7ef335).
 *
 * S13G consumes the S13F `ImplementationPlanTask` / `TaskAcceptanceCriterion` /
 * `TaskEvidenceRequirement` / `ImplementationPlanningSpecSnapshot`, the S10
 * `AgentDefinition` / `JsonSchemaLike`, and S12 `SkillDefinition` objects
 * read-only (spec section 2 — "Part B MUST reuse existing repository types").
 * It never mutates any of them and never creates an AgentDefinition or
 * composes a Context Pack.
 */

// ---------------------------------------------------------------------------
// Result status (spec section 3 — only READY | BLOCKED; no PROVISIONAL)
// ---------------------------------------------------------------------------

export type TaskCompilationStatus = "READY" | "BLOCKED";

// ---------------------------------------------------------------------------
// Bounded task-local Spec projection (spec section 3, decision C)
// ---------------------------------------------------------------------------

export interface TaskCompilationSpecSnapshot {
  spec_id: string;
  version: string;
  approval: ApprovalSnapshot;

  requirements: PlanningRequirement[];
  non_functional_requirements: PlanningNonFunctionalRequirement[];
  constraints: PlanningConstraint[];
  assumptions: PlanningAssumption[];
  acceptance_criteria: PlanningAcceptanceCriterion[];
}

// ---------------------------------------------------------------------------
// Context Pack projection (spec section 3, decision D) — a TypeScript-compatible
// projection of brain-bootstrap/specs/CONTEXT_PACKET.schema.yaml. S13G never
// composes context; it validates and faithfully projects the supplied,
// already-frozen S05 pack.
// ---------------------------------------------------------------------------

export type ContextStatus =
  | "VERIFIED"
  | "PROVIDED"
  | "ASSUMED"
  | "PROPOSED"
  | "UNKNOWN"
  | "BLOCKED";

export const CONTEXT_STATUSES: readonly ContextStatus[] = [
  "VERIFIED",
  "PROVIDED",
  "ASSUMED",
  "PROPOSED",
  "UNKNOWN",
  "BLOCKED",
];

export type ContextSourceLayer =
  | "identity"
  | "user context"
  | "durable memory"
  | "project instructions"
  | "compiled knowledge"
  | "historical sessions"
  | "current verified state"
  | "working context"
  | "child-agent packet";

export const CONTEXT_SOURCE_LAYERS: readonly ContextSourceLayer[] = [
  "identity",
  "user context",
  "durable memory",
  "project instructions",
  "compiled knowledge",
  "historical sessions",
  "current verified state",
  "working context",
  "child-agent packet",
];

/** Layers whose imperative text MUST NOT be promoted to an instruction (spec 7.4). */
export const NON_NORMATIVE_CONTEXT_LAYERS: readonly ContextSourceLayer[] = [
  "durable memory",
  "compiled knowledge",
  "historical sessions",
  "working context",
  "child-agent packet",
];

export interface TaskCompilationContextProvenance {
  source_type: string;
  source_ref: string;
  observed_or_retrieved_at?: string;
}

export interface TaskCompilationContextRelevance {
  reason: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface TaskCompilationContextContent {
  kind?: "INLINE" | "EXCERPT" | "SUMMARY" | "REFERENCE_ONLY";
  text?: string;
  content_ref?: string;
}

export interface TaskCompilationContextItem {
  id: string;
  source_layer: ContextSourceLayer;
  authority_rank: number;
  authority_name?: string;
  status: ContextStatus;
  provenance: TaskCompilationContextProvenance;
  relevance: TaskCompilationContextRelevance;
  evidence_ref?: string;
  content?: TaskCompilationContextContent;
}

export interface TaskCompilationContextObjective {
  statement: string;
  spec_ref?: string;
  acceptance_criteria_refs?: string[];
  quality_contract_ref?: string;
}

export interface TaskCompilationContextAuthorityPolicy {
  ordering: Array<{ rank: number; name: string }>;
}

export interface TaskCompilationContextBudget {
  max_tokens?: number;
  max_characters?: number;
  max_items?: number;
  reserved_output_tokens?: number;
}

export interface TaskCompilationContextPackSnapshot {
  id: string;
  objective: TaskCompilationContextObjective;
  authority_policy: TaskCompilationContextAuthorityPolicy;
  budget: TaskCompilationContextBudget;
  items: TaskCompilationContextItem[];

  thread_ref?: string;
  run_ref?: string;
  parent_context_pack_ref?: string;
}

// ---------------------------------------------------------------------------
// Capability + constraint inputs (spec section 3)
// ---------------------------------------------------------------------------

export interface TaskCompilationCapability {
  id: string;
  source_refs: string[];
}

export interface TaskCompilationConstraint {
  ref: string;
  statement: string;
  source_refs: string[];
}

// ---------------------------------------------------------------------------
// Canonical input (spec section 3.4)
// ---------------------------------------------------------------------------

export interface TaskCompilationInput {
  task: ImplementationPlanTask;
  spec: TaskCompilationSpecSnapshot;
  agent_definition: AgentDefinition;
  context_pack: TaskCompilationContextPackSnapshot;
  selected_skills: SkillDefinition[];
  capabilities: TaskCompilationCapability[];
  constraints: TaskCompilationConstraint[];
  acceptance: TaskAcceptanceCriterion[];
  evidence_required: TaskEvidenceRequirement[];
}

// ---------------------------------------------------------------------------
// Execution Package shapes (spec section 4)
// ---------------------------------------------------------------------------

export type ExecutionInstructionKind =
  | "TASK"
  | "SPEC"
  | "SKILL"
  | "CONSTRAINT"
  | "POLICY"
  | "SAFETY";

export const EXECUTION_INSTRUCTION_KINDS: readonly ExecutionInstructionKind[] = [
  "TASK",
  "SPEC",
  "SKILL",
  "CONSTRAINT",
  "POLICY",
  "SAFETY",
];

export interface ExecutionInstruction {
  id: string;
  kind: ExecutionInstructionKind;
  text: string;
  source_refs: string[];
}

export interface ExecutionObjective {
  statement: string;
  task_ref: string;
  spec_refs: string[];
}

export interface ExecutionContext {
  context_pack_ref: string;
  objective: TaskCompilationContextObjective;
  authority_policy: TaskCompilationContextAuthorityPolicy;
  budget: TaskCompilationContextBudget;
  items: TaskCompilationContextItem[];
}

export interface ExecutionToolDeclaration {
  id: string;
  capability_ref: string;
}

export interface ExecutionLimits {
  max_turns: number;
  timeout_ms: number;
  context_budget: TaskCompilationContextBudget;
}

export interface ExecutionSkillRef {
  id: string;
  version: string;
}

export interface ExecutionPackage {
  schema_version: "1.0";

  package_id: string;
  task_ref: string;
  agent_definition_ref: string;

  selected_skill_refs: ExecutionSkillRef[];
  capability_refs: string[];

  objective: ExecutionObjective;
  instructions: ExecutionInstruction[];
  context: ExecutionContext;
  tools: ExecutionToolDeclaration[];
  limits: ExecutionLimits;

  output_schema: JsonSchemaLike;

  acceptance: TaskAcceptanceCriterion[];
  evidence: TaskEvidenceRequirement[];
}

export interface TaskCompilationResult {
  status: TaskCompilationStatus;
  blockers: string[];
  package: ExecutionPackage | null;
}

// ---------------------------------------------------------------------------
// Skill-vs-no-Skill comparison (Skill file "Success criteria", QC
// skill_vs_no_skill_evaluation, spec sections 18-22) — a COUNTED-ASSERTION
// model: the QC thresholds ("+6 correct assertions total", ">= 3 improved
// dimensions", ">= +2 per improved dimension") cannot be expressed with ratio
// metrics.
// ---------------------------------------------------------------------------

export type TaskCompilationDimensionId =
  | "SD-001" // objective_and_scope_fidelity
  | "SD-002" // instruction_quality_and_provenance
  | "SD-003" // context_fidelity_and_boundedness
  | "SD-004" // skill_compilation_correctness
  | "SD-005" // capability_tool_safety
  | "SD-006" // limits_and_schema_fidelity
  | "SD-007" // acceptance_evidence_fidelity
  | "SD-008" // security_and_instruction_separation
  | "SD-009"; // stage_boundary_and_provider_neutrality

export interface TaskCompilationDimensionScore {
  total: number;
  correct: number;
}

export interface TaskCompilationArmScore {
  total_assertions: number;
  correct: number;
  by_dimension: Record<TaskCompilationDimensionId, TaskCompilationDimensionScore>;
  hard_invariant_total: number;
  hard_invariant_correct: number;
  stage_boundary_violations: number;
  invented_authority_tool_limit_schema_refs: number;
}

export interface TaskCompilationComparison {
  baseline: TaskCompilationArmScore;
  skill: TaskCompilationArmScore;
  additional_correct_total: number;
  improved_dimensions: TaskCompilationDimensionId[];
  hard_invariant_regressed: boolean;
  meets_threshold: boolean;
}

/**
 * Test-only independent ground truth (Skill file "Success criteria", QC
 * `ground_truth_policy`, spec section 18). This shape MUST NOT be constructed
 * from, or passed into, the materializer / ModelProvider / Skill selection /
 * synthesizer / validator. It is consumed only by the comparison evaluator,
 * and only after both runtime outputs already exist.
 */
export interface TaskCompilationFixtureTruth {
  expected_status: TaskCompilationStatus;
  /** The exact objective statement a faithful compile must preserve. */
  expected_objective_statement: string;
  /** Spec/constraint/skill refs that MUST be cited by at least one instruction. */
  required_instruction_source_refs: string[];
  /** Context item ids that MUST all survive into the package, unchanged. */
  required_context_item_ids: string[];
  /** Context item ids that MUST NOT be the sole source of any instruction. */
  non_normative_context_item_ids: string[];
  expected_tool_ids: string[];
  expected_max_turns: number;
  expected_timeout_ms: number;
  /** Selected-Skill MUST-rule instruction count a faithful compile emits (lower bound). */
  min_skill_must_instructions: number;
  has_secret_bearing_input: boolean;
}
