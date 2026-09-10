/**
 * S14F — GitHub Capability: trusted provider-layer configuration, credential,
 * transport and observation types.
 *
 * Defined by brain-bootstrap/skills/GITHUB_CAPABILITY_SKILL_S14F.md,
 * brain-bootstrap/specs/GITHUB_CAPABILITY_CONTRACT_S14F.md and
 * brain-bootstrap/quality-contracts/S14F_GITHUB_CAPABILITY_DEEP.yaml (canonical
 * Part A, integrated byte-for-byte at baseline
 * 040cc43ff2ad42deb06c8edf794e3bdfa7762be6).
 *
 * A `GitHubRestProviderConfig` is explicit host-side/administrative input. The
 * model never creates, mutates or overrides it, and none of its fields enter
 * `AgentDefinition`, the public `ToolDescriptor`, a `capability_id` or
 * model-visible output (contract §4, §5, §19).
 */

/** The exact five provider-neutral S14F capability identities (contract §3). */
export type GitHubCapabilityId =
  | "repository.remote.inspect"
  | "repository.review.inspect"
  | "repository.review.open"
  | "repository.review.comment"
  | "repository.checks.inspect";

/** Canonical advertisement order; also the exact authorized identity set. */
export const GITHUB_CAPABILITY_IDS: readonly GitHubCapabilityId[] = [
  "repository.remote.inspect",
  "repository.review.inspect",
  "repository.review.open",
  "repository.review.comment",
  "repository.checks.inspect",
] as const;

/**
 * Explicit trusted GitHub provider configuration (contract §4).
 *
 * The shape is CLOSED: there is deliberately no token/password/authorization/
 * header/base_url/url/endpoint/api_version/method/graphql/command/executable/env
 * field, and no value is ever discovered from `process.env`, cwd, Git config,
 * an installed CLI or model output.
 */
export interface GitHubRestProviderConfig {
  /** Logical repository identity, `^[a-z0-9][a-z0-9._-]{0,159}$`. */
  repository_id: string;
  /** GitHub-style owner identifier, 1..100 ASCII alnum/hyphen. */
  owner: string;
  /** Repository name, 1..100 ASCII chars from `[A-Za-z0-9._-]`. */
  repository: string;
  /** Opaque reference resolved by the provider-private credential resolver. */
  credential_ref: string;
  /** Unique, non-empty subset of the exact five capability identities. */
  enabled_capabilities: GitHubCapabilityId[];
  /** Upper timeout bound for one invocation, in ms; composed by minimum. */
  max_timeout_ms: number;
}

/**
 * Provider-private credential resolver (contract §5). This is NOT a Core
 * contract and selects no vault implementation. The resolved value is handed
 * only to transport code and never crosses the provider boundary.
 */
export interface GitHubCredentialResolver {
  resolve(credential_ref: string): Promise<string>;
}

/** The single authorized origin. There is no override in v1 (contract §6). */
export const GITHUB_ORIGIN = "https://api.github.com" as const;

/**
 * One fully-formed provider-owned HTTP request. Every field is built from
 * trusted configuration plus already-validated semantic input: the model never
 * selects a method, origin, path, query, header key or header value.
 */
export interface GitHubTransportRequest {
  method: "GET" | "POST";
  /** Fixed literal origin; an alternate origin is not representable. */
  origin: typeof GITHUB_ORIGIN;
  /** Absolute path (with optional query), already percent-encoded. */
  path: string;
  headers: Readonly<Record<string, string>>;
  /** JSON request body; only ever present on an authorized POST. */
  body?: string;
  /** The one invocation-wide deadline signal. */
  signal: AbortSignal;
  /** Hard cap on consumed response bytes. */
  max_response_bytes: number;
}

export interface GitHubTransportResponse {
  status: number;
  /** Lower-cased header names; raw values never cross the provider boundary. */
  headers: Readonly<Record<string, string>>;
  body: string;
}

/**
 * Provider-internal transport seam. Production uses the built-in Node 24
 * `node:https` transport; canonical tests inject a deterministic double. The
 * provider itself never branches on fixture id, run id or expected outcome
 * (contract §18, §21).
 */
export interface GitHubTransport {
  send(request: GitHubTransportRequest): Promise<GitHubTransportResponse>;
}

/** Failure kinds a transport may report; everything else is treated as network. */
export type GitHubTransportFailureKind = "TIMEOUT" | "NETWORK" | "OVERFLOW";

export class GitHubTransportError extends Error {
  constructor(readonly kind: GitHubTransportFailureKind) {
    super("GitHub transport failure.");
    this.name = "GitHubTransportError";
  }
}

export interface GitHubProviderDependencies {
  credentialResolver?: GitHubCredentialResolver;
  transport?: GitHubTransport;
}

/**
 * Closed internal REST operation families (contract §7). There is no arbitrary
 * method/path interface: each family maps to exactly one provider-owned route
 * template filled from trusted config plus validated semantic identifiers.
 */
export type GitHubOperationFamily =
  | "REMOTE_INSPECT"
  | "REVIEW_INSPECT"
  | "REVIEW_HEAD_PREFLIGHT"
  | "REVIEW_BASE_PREFLIGHT"
  | "REVIEW_DUPLICATE_PREFLIGHT"
  | "REVIEW_OPEN"
  | "REVIEW_COMMENT_PREFLIGHT"
  | "REVIEW_COMMENT"
  | "CHECKS_INSPECT";

/** Every S14F bound (contract §4, §8, §14, §15). */
export const LIMITS = {
  repositoryIdChars: 160,
  ownerChars: 100,
  repositoryChars: 100,
  credentialRefChars: 256,
  configTimeoutMs: 60000,
  envelopeIdChars: 128,
  reviewNumberMax: 2147483647,
  branchBytes: 255,
  titleBytes: 256,
  bodyBytes: 65536,
  requestBodyBytes: 131072,
  responseBodyBytes: 1048576,
  successOutputBytes: 262144,
  checks: 100,
  rawCheckRuns: 1000,
  duplicateReviewProbe: 100,
  safeErrorAsciiChars: 160,
  credentialChars: 4096,
  webUrlChars: 512,
  remoteTitleBytes: 4096,
  remoteNameBytes: 4096,
} as const;

// --- provider-neutral bounded observations (contract §9-§13) ---------------

export interface RemoteRepositoryObservation {
  repository_id: string;
  default_branch: string;
  is_private: boolean;
  archived: boolean;
  web_url: string;
  /** UTC ISO-8601, always `Z`-suffixed. */
  observed_at: string;
}

export type ReviewState = "OPEN" | "CLOSED" | "MERGED";

export interface RepositoryReviewObservation {
  repository_id: string;
  review_number: number;
  state: ReviewState;
  draft: boolean;
  title: string;
  head_branch: string;
  head_sha: string;
  base_branch: string;
  base_sha: string;
  changed_files: number;
  comments_count: number;
  web_url: string;
  observed_at: string;
}

export interface RepositoryReviewCommentReceipt {
  repository_id: string;
  review_number: number;
  comment_id: string;
  web_url: string;
  created_at: string;
}

export type CheckStatus = "QUEUED" | "IN_PROGRESS" | "COMPLETED";

export type CheckConclusion =
  | "SUCCESS"
  | "FAILURE"
  | "NEUTRAL"
  | "CANCELLED"
  | "SKIPPED"
  | "TIMED_OUT"
  | "ACTION_REQUIRED"
  | "STALE"
  | "UNKNOWN";

export interface RepositoryCheckObservation {
  id: string;
  name: string;
  status: CheckStatus;
  conclusion?: CheckConclusion;
  web_url?: string;
  started_at?: string;
  completed_at?: string;
}

export interface RepositoryChecksObservation {
  repository_id: string;
  commit_sha: string;
  total_checks: number;
  truncated: boolean;
  checks: RepositoryCheckObservation[];
  observed_at: string;
}

/** Semantic inputs, after validation (contract §11, §12). */
export interface OpenRepositoryReviewInput {
  head_branch: string;
  base_branch: string;
  expected_head_sha: string;
  expected_base_sha: string;
  title: string;
  body?: string;
  draft?: boolean;
}

export interface CommentRepositoryReviewInput {
  review_number: number;
  expected_head_sha: string;
  body: string;
}
