/**
 * S14F — GitHub Capability public entry point.
 *
 * Exports the provider class plus the trusted configuration, credential and
 * transport contracts a host composition needs. Nothing here is imported by
 * Core, by `AgentDefinition`, or by any other capability provider.
 */

export { GitHubRestCapabilityProvider } from "./githubCapabilityProvider.js";
export { NodeHttpsGitHubTransport } from "./httpsTransport.js";
export { descriptorsFor } from "./descriptors.js";
export { buildRoute, OPERATION_METHOD, OPERATION_SUCCESS_STATUS, type RouteParams } from "./routes.js";
export { GITHUB_CAPABILITY_IDS, GITHUB_ORIGIN, GitHubTransportError, LIMITS } from "./types.js";
export type {
  CheckConclusion,
  CheckStatus,
  CommentRepositoryReviewInput,
  GitHubCapabilityId,
  GitHubCredentialResolver,
  GitHubOperationFamily,
  GitHubProviderDependencies,
  GitHubRestProviderConfig,
  GitHubTransport,
  GitHubTransportFailureKind,
  GitHubTransportRequest,
  GitHubTransportResponse,
  OpenRepositoryReviewInput,
  RemoteRepositoryObservation,
  RepositoryCheckObservation,
  RepositoryChecksObservation,
  RepositoryReviewCommentReceipt,
  RepositoryReviewObservation,
  ReviewState,
} from "./types.js";
export { SAFE_MESSAGES, STATIC_SECRET_MARKERS, matchesSecretFloor } from "./validation.js";
export type { RepositoryBinding } from "./normalize.js";
