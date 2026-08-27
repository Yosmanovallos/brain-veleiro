import type { ExecutionToolDeclaration, TaskCompilationInput } from "./types.js";

/**
 * Brain — S13G tool materialization.
 *
 * Implements brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md section 8
 * and the Skill file "Tools". One provider-neutral UNBOUND `ExecutionToolDeclaration`
 * per validated target capability, sorted deterministically by id. No provider,
 * connector, MCP, credential, endpoint, or runtime handle — ever.
 */
export function materializeExecutionTools(input: TaskCompilationInput): ExecutionToolDeclaration[] {
  const ids = Array.from(new Set(input.capabilities.map((c) => c.id))).sort();
  return ids.map((id) => ({ id, capability_ref: id }));
}
