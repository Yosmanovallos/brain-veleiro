import { expect } from "vitest";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import { semanticSignature } from "../../src/providers/capability/registry/validation.js";
import {
  RestrictedCapabilityProvider,
  compileAgentDefinition,
  runAgent,
  type AgentDefinition,
  type CapabilityProvider,
  type ModelProvider,
  type ToolDescriptor,
  type ToolInvocationRequest,
  type ToolInvocationResult,
  type ToolSideEffectClass,
} from "../../src/core/agent/index.js";
import {
  GitHubRestCapabilityProvider,
  GitHubTransportError,
  type GitHubCapabilityId,
  type GitHubCredentialResolver,
  type GitHubRestProviderConfig,
  type GitHubTransport,
  type GitHubTransportRequest,
  type GitHubTransportResponse,
} from "../../src/providers/capability/github/index.js";

export const REMOTE = "repository.remote.inspect";
export const REVIEW_INSPECT = "repository.review.inspect";
export const REVIEW_OPEN = "repository.review.open";
export const REVIEW_COMMENT = "repository.review.comment";
export const CHECKS = "repository.checks.inspect";

export const ALL_IDS: GitHubCapabilityId[] = [REMOTE, REVIEW_INSPECT, REVIEW_OPEN, REVIEW_COMMENT, CHECKS] as GitHubCapabilityId[];

/**
 * A SENTINEL, non-live, non-secret test string. It is not a GitHub credential,
 * grants nothing, and exists only so the tests can prove where the resolved
 * value is and is not allowed to appear.
 */
export const SENTINEL = "ghp_sentinel_test_credential_12345678";

export const HEAD_SHA = "a".repeat(40);
export const BASE_SHA = "b".repeat(40);
export const OTHER_SHA = "c".repeat(40);
export const SHA_256 = "d".repeat(64);

// --- deterministic injected transport (contract §21) -----------------------

export interface RecordedRequest {
  method: string;
  origin: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  max_response_bytes: number;
}

export interface Reply {
  status?: number;
  headers?: Record<string, string | undefined>;
  body?: string;
  json?: unknown;
  /** Deterministic transport failure. */
  fail?: "TIMEOUT" | "NETWORK" | "OVERFLOW";
  /** Never settles until the ONE invocation deadline aborts the request. */
  hang?: boolean;
}

export type Script = Reply[] | ((request: GitHubTransportRequest, index: number) => Reply);

/**
 * Records the exact method / origin / path / headers / bounded body of every
 * request the provider builds, and emulates status, headers, body, deterministic
 * abort and post-dispatch write uncertainty. It performs NO network I/O.
 */
export class FakeTransport implements GitHubTransport {
  readonly requests: RecordedRequest[] = [];
  constructor(private readonly script: Script = []) {}

  get paths(): string[] {
    return this.requests.map(r => `${r.method} ${r.path}`);
  }

  async send(request: GitHubTransportRequest): Promise<GitHubTransportResponse> {
    const index = this.requests.length;
    this.requests.push({
      method: request.method,
      origin: request.origin,
      path: request.path,
      headers: { ...request.headers },
      body: request.body,
      max_response_bytes: request.max_response_bytes,
    });
    const reply = typeof this.script === "function" ? this.script(request, index) : this.script[index];
    if (reply === undefined) throw new Error(`unscripted request #${index}: ${request.method} ${request.path}`);

    if (reply.hang === true) {
      return await new Promise<GitHubTransportResponse>((_resolve, rejectPromise) => {
        const abort = () => rejectPromise(new GitHubTransportError("TIMEOUT"));
        if (request.signal.aborted) { abort(); return; }
        request.signal.addEventListener("abort", abort, { once: true });
      });
    }
    if (reply.fail !== undefined) throw new GitHubTransportError(reply.fail);
    const safeHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(reply.headers ?? {})) {
      if (v !== undefined) safeHeaders[k] = v;
    }
    return {
      status: reply.status ?? 200,
      headers: safeHeaders,
      body: reply.body ?? JSON.stringify(reply.json ?? {}),
    };
  }
}

// --- sentinel credential resolver -----------------------------------------

export interface CredentialProbe {
  calls: number;
  refs: string[];
}

export function sentinelResolver(value: unknown = SENTINEL): {
  resolver: GitHubCredentialResolver;
  probe: CredentialProbe;
} {
  const probe: CredentialProbe = { calls: 0, refs: [] };
  const resolver: GitHubCredentialResolver = {
    async resolve(credential_ref: string): Promise<string> {
      probe.calls++;
      probe.refs.push(credential_ref);
      if (value instanceof Error) throw value;
      return value as string;
    },
  };
  return { resolver, probe };
}

/**
 * A resolver whose single pending resolution the test settles explicitly (or
 * never), so credential-deadline behavior is exercised without timer races.
 */
export interface ControlledResolver {
  resolver: GitHubCredentialResolver;
  probe: CredentialProbe;
  settle(value: unknown): void;
  fail(error: unknown): void;
}

export function controlledResolver(): ControlledResolver {
  const probe: CredentialProbe = { calls: 0, refs: [] };
  let settle: (value: unknown) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const resolver: GitHubCredentialResolver = {
    resolve(credential_ref: string): Promise<string> {
      probe.calls++;
      probe.refs.push(credential_ref);
      return new Promise<string>((resolve, rejectPromise) => {
        settle = value => resolve(value as string);
        fail = rejectPromise;
      });
    },
  };
  return { resolver, probe, settle: value => settle(value), fail: error => fail(error) };
}

// --- harness ---------------------------------------------------------------

export const baseConfig = (over: Partial<GitHubRestProviderConfig> = {}): GitHubRestProviderConfig => ({
  repository_id: "qa.repo",
  owner: "acme",
  repository: "widget",
  credential_ref: "vault/github/qa",
  enabled_capabilities: [...ALL_IDS],
  max_timeout_ms: 5000,
  ...over,
});

export interface Harness {
  provider: GitHubRestCapabilityProvider;
  transport: FakeTransport;
  probe: CredentialProbe;
}

export function harness(options: {
  config?: Partial<GitHubRestProviderConfig>;
  script?: Script;
  credential?: unknown;
  omitResolver?: boolean;
  resolver?: { resolver: GitHubCredentialResolver; probe: CredentialProbe };
} = {}): Harness {
  const transport = new FakeTransport(options.script ?? []);
  const credentialValue = options.credential === undefined ? SENTINEL : options.credential;
  const { resolver, probe } = options.resolver ?? sentinelResolver(credentialValue);
  const provider = new GitHubRestCapabilityProvider(
    baseConfig(options.config),
    options.omitResolver === true ? { transport } : { credentialResolver: resolver, transport },
  );
  return { provider, transport, probe };
}

export const request = (
  capability_id: string,
  input: Record<string, unknown>,
  timeout_ms = 5000,
): ToolInvocationRequest => ({
  run_id: "github-exercise",
  call_id: "operation",
  turn: 1,
  capability_id,
  input,
  timeout_ms,
});

export function output(result: ToolInvocationResult): Record<string, unknown> {
  expect(result.status).toBe("SUCCESS");
  if (result.status !== "SUCCESS") throw new Error("Expected a successful repository observation");
  return result.output;
}

export const failCode = (value: ToolInvocationResult, code: string, retryable?: boolean): void => {
  expect(value).toMatchObject({ status: "FAIL", error: { code } });
  if (retryable !== undefined && value.status === "FAIL") expect(value.error.retryable).toBe(retryable);
};

/** No public surface of a result may contain the sentinel value. */
export function assertNoCredential(...values: unknown[]): void {
  for (const value of values) {
    expect(JSON.stringify(value) ?? "").not.toContain(SENTINEL);
  }
}

// --- remote payload fixtures (inert data) ----------------------------------

export const repoPayload = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 42,
  name: "widget",
  full_name: "acme/widget",
  private: true,
  archived: false,
  default_branch: "main",
  html_url: "https://github.com/acme/widget",
  clone_url: "https://github.com/acme/widget.git",
  description: "inert remote description",
  permissions: { admin: true, push: true },
  ...over,
});

export const reviewPayload = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  number: 7,
  state: "open",
  draft: false,
  merged: false,
  merged_at: null,
  title: "Bounded remote review",
  head: { ref: "feature/s14f", sha: HEAD_SHA, label: "acme:feature/s14f" },
  base: { ref: "main", sha: BASE_SHA, label: "acme:main" },
  changed_files: 3,
  comments: 2,
  html_url: "https://github.com/acme/widget/pull/7",
  body: "inert remote review body",
  user: { login: "someone", id: 5 },
  diff_url: "https://github.com/acme/widget/pull/7.diff",
  ...over,
});

export const refPayload = (branch: string, sha: string): Record<string, unknown> => ({
  ref: `refs/heads/${branch}`,
  node_id: "REF_kwDO",
  url: `https://api.github.com/repos/acme/widget/git/refs/heads/${branch}`,
  object: { sha, type: "commit", url: `https://api.github.com/repos/acme/widget/git/commits/${sha}` },
});

export const commentPayload = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 900001,
  node_id: "IC_kwDO",
  html_url: "https://github.com/acme/widget/pull/7#issuecomment-900001",
  created_at: "2026-03-10T12:00:00Z",
  updated_at: "2026-03-10T12:00:00Z",
  body: "inert remote echo",
  user: { login: "bot", id: 9 },
  ...over,
});

export const checkRun = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 11,
  name: "build",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/acme/widget/runs/11",
  started_at: "2026-03-10T11:00:00Z",
  completed_at: "2026-03-10T11:05:00Z",
  output: { title: "inert", summary: "inert" },
  ...over,
});

export const checksPayload = (
  runs: Array<Record<string, unknown>>,
  total_count = runs.length,
): Record<string, unknown> => ({ total_count, check_runs: runs });

/** The canonical happy-path script for one repository.review.open. */
export const openReviewScript = (over: { created?: Record<string, unknown>; existing?: unknown[] } = {}): Reply[] => [
  { json: refPayload("feature/s14f", HEAD_SHA) },
  { json: refPayload("main", BASE_SHA) },
  { json: over.existing ?? [] },
  { status: 201, json: over.created ?? reviewPayload() },
];

export const openReviewInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  head_branch: "feature/s14f",
  base_branch: "main",
  expected_head_sha: HEAD_SHA,
  expected_base_sha: BASE_SHA,
  title: "Bounded remote review",
  ...over,
});

export const commentInput = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  review_number: 7,
  expected_head_sha: HEAD_SHA,
  body: "Automated observation.",
  ...over,
});

// --- registry / Restricted / runAgent composition --------------------------

export function registry(
  provider: CapabilityProvider,
  provider_id = "github-rest",
  ids: string[] = [...ALL_IDS],
): CapabilityRegistryProvider {
  return new CapabilityRegistryProvider({
    providers: [{ provider_id, provider }],
    bindings: ids.map(capability_id => ({ capability_id, selected_provider_id: provider_id })),
  });
}

export function restricted(
  provider: CapabilityProvider,
  ids: string[] = [...ALL_IDS],
  sideEffects: ToolSideEffectClass[] = ["EXTERNAL"],
  provider_id = "github-rest",
): RestrictedCapabilityProvider {
  return new RestrictedCapabilityProvider(registry(provider, provider_id, ids), new Set(ids), new Set(sideEffects));
}

/**
 * A byte-stable AgentDefinition used for the real runAgent path and the
 * provider-swap counterfactual. It contains no GitHub host, owner, repository,
 * route, method, header, API version, credential or provider identity
 * (S14F-HI-003, contract §19).
 */
export const definition: AgentDefinition = Object.freeze({
  id: "remote-repository-observer",
  role: "observer",
  objective: "Observe the permitted remote repository and return the observation.",
  model_policy: { routing_class: "BALANCED", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 1000, max_items: 5, allowed_sources: ["CURRENT_TASK"], require_source_refs: false },
  state_schema: { type: "object" },
  tools: [REMOTE],
  skills: [],
  capabilities: [REMOTE],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["EXTERNAL"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 20000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" },
  rubric: { quality_contract_ref: "brain-bootstrap/quality-contracts/S14F_GITHUB_CAPABILITY_DEEP.yaml" },
  evals: [],
}) as AgentDefinition;

/** The exact serialized AgentDefinition both provider-swap arms must share. */
export const DEFINITION_BYTES = JSON.stringify(definition);

export function definitionWith(over: Partial<AgentDefinition>): AgentDefinition {
  return { ...structuredClone(definition), ...over } as AgentDefinition;
}

/**
 * Drive one capability through the real
 * RestrictedCapabilityProvider -> registry -> provider -> runAgent path.
 */
export async function agentExec(
  capabilityProvider: CapabilityProvider,
  capability_id: string,
  input: Record<string, unknown>,
  agentDefinition: AgentDefinition = definition,
  provider_id = "github-rest",
) {
  const model: ModelProvider = {
    async decide(r) {
      const observation = r.state.prior_observations.at(-1);
      if (!observation) {
        return {
          status: "SUCCESS",
          decision: { type: "TOOL_CALL", rationale: "Observe the remote repository.", tool_call: { call_id: "obs", capability_id, input } },
        };
      }
      return {
        status: "SUCCESS",
        decision: {
          type: "FINISH",
          rationale: "Return the observation.",
          output: { summary: "Observed.", data: observation.output, evidence_refs: observation.evidence_refs },
        },
      };
    },
  };
  const compiled = compileAgentDefinition(agentDefinition, {
    model_provider: model,
    capability_provider: registry(capabilityProvider, provider_id, agentDefinition.capabilities),
  });
  expect(compiled.run_options.capabilityProvider).toBeInstanceOf(RestrictedCapabilityProvider);
  return runAgent(compiled.run_options);
}

// --- independently implemented compatible provider (contract §19) ----------

/**
 * A second, INDEPENDENT implementation of the public
 * `repository.remote.inspect` contract. It shares no code with the GitHub REST
 * provider: the descriptor below is written out by hand and the observation is
 * produced from a local record. The swap fixture asserts that the two
 * descriptors carry the same registry semantic signature, so the same
 * AgentDefinition bytes route to either implementation through registry
 * configuration alone.
 */
export class CompatibleRemoteInspectTestProvider implements CapabilityProvider {
  constructor(
    private readonly record: {
      repository_id: string;
      default_branch: string;
      is_private: boolean;
      archived: boolean;
      web_url: string;
    },
  ) {}

  async list_capabilities(): Promise<ToolDescriptor[]> {
    return [
      {
        capability_id: REMOTE,
        name: "Inspect the bound remote repository",
        description:
          "Return one bounded, structured observation of the single explicitly bound remote repository: its default branch, private and archived flags and canonical web URL. Read-only, but classified EXTERNAL because it crosses the local trust boundary. No description, README, topics, owner profile, permission blob, clone URL or transport metadata is returned.",
        side_effects: "EXTERNAL",
        input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
        output_schema: {
          type: "object",
          additionalProperties: false,
          required: ["repository_id", "default_branch", "is_private", "archived", "web_url", "observed_at"],
          properties: {
            repository_id: { type: "string" },
            default_branch: { type: "string" },
            is_private: { type: "boolean" },
            archived: { type: "boolean" },
            web_url: { type: "string" },
            observed_at: { type: "string" },
          },
        },
      },
    ];
  }

  async invoke(invocation: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const identity = { call_id: invocation.call_id, capability_id: invocation.capability_id };
    if (invocation.capability_id !== REMOTE || Object.keys(invocation.input).length !== 0) {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "INVALID_INPUT", message: "Unsupported compatible-provider request.", retryable: false },
        duration_ms: 0,
      };
    }
    return {
      status: "SUCCESS",
      ...identity,
      output: { ...this.record, observed_at: new Date().toISOString() },
      evidence_refs: [`repository://${this.record.repository_id}`],
      duration_ms: 0,
    };
  }
}

/** Both implementations publish one identical public capability contract. */
export async function assertCompatibleContracts(a: CapabilityProvider, b: CapabilityProvider, id: string): Promise<void> {
  const find = async (p: CapabilityProvider) => (await p.list_capabilities()).find(d => d.capability_id === id)!;
  const left = await find(a);
  const right = await find(b);
  expect(left).toBeDefined();
  expect(right).toBeDefined();
  expect(semanticSignature(left)).toBe(semanticSignature(right));
}
