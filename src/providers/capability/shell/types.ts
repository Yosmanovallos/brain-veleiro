/**
 * S14C — Shell Capability: trusted provider-layer configuration types.
 *
 * Defined by brain-bootstrap/skills/SHELL_CAPABILITY_SKILL_S14C.md,
 * brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml and
 * brain-bootstrap/specs/SHELL_CAPABILITY_CONTRACT_S14C.md.
 *
 * A `WorkspaceShellConfig` is explicit host-side/administrative input. The model
 * never creates, mutates or overrides it. Model-visible invocation input is only
 * `{ profile_id, cwd }` (see workspaceShellCapabilityProvider.ts). None of these
 * fields enter `AgentDefinition`, the public `ToolDescriptor`, `capability_id`
 * or model-visible output — swapping the concrete executable/argv/env behind one
 * `profile_id` must not require an `AgentDefinition` edit.
 */

/** One pre-authorized command profile. `profile_id` is a semantic policy id. */
export interface WorkspaceShellCommandProfile {
  /** Stable safe id, grammar `^[a-z0-9][a-z0-9._-]*$`, provider-private argv/env. */
  profile_id: string;
  /** Explicit absolute host path to the executable; provider-private, never model-visible. */
  executable: string;
  /** Fixed trusted argument vector; the model cannot append/replace/interpolate/inject. */
  argv: string[];
  /** Explicit child environment; the host/parent environment is never implicitly inherited. */
  env: Record<string, string>;
  /** Logical workspace-relative prefixes this profile may run in (`.` = root only). */
  cwd_allow_prefixes: string[];
  /** Upper timeout bound for this profile, in ms; composed by minimum with the request. */
  max_timeout_ms: number;
  /** Declared side-effect class of the configured command. */
  declared_effects: "LOCAL_ONLY";
}

/** Explicit trusted shell provider configuration. */
export interface WorkspaceShellConfig {
  /** Explicit absolute workspace root; never inferred from cwd/env/home/git/scan. */
  workspace_root: string;
  /** Registered command profiles, unique by `profile_id`. */
  profiles: WorkspaceShellCommandProfile[];
}
