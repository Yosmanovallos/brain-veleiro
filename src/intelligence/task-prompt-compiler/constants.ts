/**
 * Brain — S13G Task Prompt Compiler constants.
 *
 * Stable identifiers and parseable marker strings shared by the S13G Skill
 * definition, the compilation bridge, the deterministic reference
 * ModelProvider fixture, and the tests. Mirrors
 * src/intelligence/implementation-planning/constants.ts.
 *
 * The canonical semantic source of truth for S13G is
 * brain-bootstrap/skills/TASK_PROMPT_COMPILER_SKILL_S13G.md,
 * brain-bootstrap/quality-contracts/S13G_TASK_PROMPT_COMPILER_DEEP.yaml, and
 * brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md
 * (ChatGPT-authored, integrated verbatim at commit f7ef335).
 */

/** Skill Contract v1 id — Skill file "Identity" block. */
export const TASK_PROMPT_COMPILER_SKILL_ID = "intelligence.task-prompt-compiler.s13g";

/** DEEP Quality Contract reference — Skill file "Requires" block. */
export const TASK_PROMPT_COMPILER_QUALITY_CONTRACT_REF =
  "brain-bootstrap/quality-contracts/S13G_TASK_PROMPT_COMPILER_DEEP.yaml";

/** Canonical Skill markdown artifact path. */
export const TASK_PROMPT_COMPILER_SKILL_ARTIFACT_PATH =
  "brain-bootstrap/skills/TASK_PROMPT_COMPILER_SKILL_S13G.md";

/** Canonical Execution Package Contract spec artifact path. */
export const TASK_PROMPT_COMPILER_SPEC_ARTIFACT_PATH =
  "brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md";

/**
 * Stable, parseable contract with the ModelProvider that consumes the
 * materialized objective (mirrors IMPLEMENTATION_PLANNING_INPUT_MARKER). Not
 * prose for a human reader.
 */
export const TASK_COMPILATION_INPUT_MARKER = "TASK_COMPILATION_INPUT:";

/** Present in the objective only when the S13G Skill body was materialized. */
export const TASK_COMPILATION_SKILL_MATERIALIZATION_MARKER = "SKILL_ID:";

/** Execution Package schema version (spec section 12). */
export const EXECUTION_PACKAGE_SCHEMA_VERSION = "1.0";

/**
 * Structured provider/runtime keys forbidden anywhere inside a READY
 * ExecutionPackage (spec section 13). This is the S13G-specific,
 * Stage-12+/S14/S17-facing list — deliberately NOT S13F's
 * STAGE_11_FORBIDDEN_KEYS (which forbids the very fields S13G legitimately
 * emits: tools, instructions, context, limits, ...).
 */
export const EXECUTION_PACKAGE_FORBIDDEN_KEYS: readonly string[] = [
  "provider",
  "provider_id",
  "connector",
  "mcp",
  "mcp_server",
  "credential",
  "secret_value",
  "token",
  "oauth_session",
  "api_key",
  "runtime_handle",
  "implementation_class",
  "endpoint",
  "shell_command_to_execute_now",
  "execution_result",
  "workflow_state",
  "workflow_node",
  "retry_state",
  "task_executor",
  "run_now",
  "deployment_result",
  "git_commit_result",
  "acceptance_passed",
  "tests_passed",
  "evidence_collected",
  "implementation_complete",
  "build_succeeded",
];
