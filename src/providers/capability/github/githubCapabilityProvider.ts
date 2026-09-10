/**
 * S14F — bounded, provider-neutral remote repository/review capability layer.
 *
 * Runtime composition (contract §17, skill §19):
 *   RestrictedCapabilityProvider -> CapabilityRegistryProvider ->
 *   GitHubRestCapabilityProvider -> fixed REST operation table ->
 *   S14F-private HTTPS transport (node:https, one fixed origin)
 *
 * The model chooses only bounded semantic input: `{}`, `{ review_number }`,
 * `{ commit_sha }`, or the closed review-open / review-comment objects. The
 * repository binding, opaque credential reference, enabled-capability subset and
 * timeout bound are all trusted host-side configuration. None of them enters
 * `AgentDefinition`, a `capability_id`, a public descriptor or model-visible
 * output (contract §4, §5, §19).
 *
 * Non-goals (contract §8, §11, §21): this is NOT complete DLP, NOT an
 * exactly-once write guarantee, NOT a general HTTP capability, and it does not
 * implement GitHub Enterprise, GraphQL, fork reviews, or any mutation outside
 * the two authorized review writes.
 */

import { performance } from "node:perf_hooks";
import type {
  CapabilityListRequest,
  CapabilityProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "../../../core/agent/types.js";
import { descriptorsFor } from "./descriptors.js";
import { NodeHttpsGitHubTransport } from "./httpsTransport.js";
import {
  buildRoute,
  OPERATION_METHOD,
  OPERATION_SUCCESS_STATUS,
  type RouteParams,
} from "./routes.js";
import {
  normalizeChecks,
  normalizeCommentReceipt,
  normalizeRepository,
  normalizeReview,
  parseRemoteArray,
  parseRemoteObject,
  type RepositoryBinding,
} from "./normalize.js";
import {
  Rejection,
  SAFE_MESSAGES,
  plainObject as isPlainObject,
  reject,
  toSafeError,
  utf8Bytes,
  validateChecksInput,
  validateCommentInput,
  validateConfig,
  validateCredential,
  validateEmptyInput,
  validateEnvelope,
  validateOpenReviewInput,
  validateReviewInspectInput,
  type FailureCode,
} from "./validation.js";
import {
  GITHUB_ORIGIN,
  GitHubTransportError,
  LIMITS,
  type GitHubCapabilityId,
  type GitHubCredentialResolver,
  type GitHubOperationFamily,
  type GitHubProviderDependencies,
  type GitHubRestProviderConfig,
  type GitHubTransport,
  type GitHubTransportResponse,
} from "./types.js";

/** Provider-owned constant request headers (contract §6). */
const ACCEPT = "application/vnd.github+json";
const API_VERSION = "2026-03-10";
const USER_AGENT = "brain-github-capability/1.0.0";
const JSON_CONTENT_TYPE = "application/json";

/** The two capability identities that may reach a POST. */
const WRITE_CAPABILITIES: readonly GitHubCapabilityId[] = ["repository.review.open", "repository.review.comment"];

/**
 * ONE monotonic invocation budget (contract §15). `start` is captured at
 * `invoke()` entry and never reset; credential resolution, every preflight, the
 * request, bounded response consumption, normalization and the final success
 * check all draw from it. A single `AbortController` carries it into transport.
 */
class Deadline {
  readonly start = performance.now();
  readonly controller = new AbortController();
  private budget = Number.POSITIVE_INFINITY;
  private timer: NodeJS.Timeout | undefined;

  /** Arm once, with `min(request.timeout_ms, config.max_timeout_ms)`. */
  arm(effectiveTimeoutMs: number): void {
    this.budget = effectiveTimeoutMs;
    this.timer = setTimeout(() => this.controller.abort(), Math.max(0, this.remaining()));
  }
  remaining(): number {
    return this.start + this.budget - performance.now();
  }
  expired(): boolean {
    return this.remaining() <= 0 || this.controller.signal.aborted;
  }
  duration(): number {
    return Math.max(0, Math.round(performance.now() - this.start));
  }
  /**
   * Bound a provider-side wait by THIS deadline without a second timer: the
   * returned promise rejects as soon as the one controller aborts. A later
   * settlement of `pending` is observed (never unhandled) and discarded, and the
   * provider-created abort listener is removed on every settle path.
   */
  bound<T>(pending: Promise<T>): Promise<T> {
    const signal = this.controller.signal;
    return new Promise<T>((resolve, rejectPromise) => {
      const onAbort = (): void => rejectPromise(new Error(SAFE_MESSAGES.internalError));
      if (signal.aborted) {
        pending.then(undefined, () => undefined);
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
      pending.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener("abort", onAbort);
          rejectPromise(error);
        },
      );
    });
  }
  /** Leaves no provider-created timer or in-flight request behind. */
  dispose(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.controller.abort();
  }
}

/** Tracks whether an authorized POST may already have reached the remote. */
interface WriteContext {
  isWrite: boolean;
  dispatched: boolean;
}

export class GitHubRestCapabilityProvider implements CapabilityProvider {
  private readonly config: GitHubRestProviderConfig;
  private readonly binding: RepositoryBinding;
  private readonly credentialResolver: GitHubCredentialResolver | undefined;
  private readonly transport: GitHubTransport;

  constructor(config: GitHubRestProviderConfig, dependencies: GitHubProviderDependencies = {}) {
    if (dependencies === null || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      throw new Error(SAFE_MESSAGES.invalidConfig);
    }
    for (const key of Object.keys(dependencies)) {
      if (key !== "credentialResolver" && key !== "transport") throw new Error(SAFE_MESSAGES.invalidConfig);
    }
    const credentialResolver = dependencies.credentialResolver;
    const transport = dependencies.transport;
    if (credentialResolver !== undefined && typeof credentialResolver?.resolve !== "function") {
      throw new Error(SAFE_MESSAGES.invalidConfig);
    }
    if (transport !== undefined && typeof transport?.send !== "function") {
      throw new Error(SAFE_MESSAGES.invalidConfig);
    }

    this.config = validateConfig(config);
    this.binding = {
      repository_id: this.config.repository_id,
      owner: this.config.owner,
      repository: this.config.repository,
    };
    this.credentialResolver = credentialResolver;
    // Omitting the transport selects the built-in fixed-origin Node HTTPS
    // transport. Production NEVER branches on a fixture, run id or test flag.
    this.transport = transport ?? new NodeHttpsGitHubTransport();
  }

  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return descriptorsFor(this.config.enabled_capabilities);
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const deadline = new Deadline();
    const identity = { call_id: request.call_id, capability_id: request.capability_id };
    const capability = request.capability_id as GitHubCapabilityId;
    const write: WriteContext = { isWrite: WRITE_CAPABILITIES.includes(capability), dispatched: false };
    let credential: string | undefined;

    try {
      // 1. Capability routing first: an unknown or disabled identity performs
      //    ZERO credential resolution and ZERO HTTP (contract §16).
      if (!this.config.enabled_capabilities.includes(capability)) {
        reject("NOT_FOUND", SAFE_MESSAGES.notFoundCapability);
      }

      // 2. Envelope + closed input validation, still before any credential or
      //    network activity (S14F-HI-010).
      validateEnvelope(request);
      const input = { ...request.input };
      deadline.arm(Math.min(request.timeout_ms, this.config.max_timeout_ms));

      let output: Record<string, unknown>;
      let evidence: string[];

      switch (capability) {
        case "repository.remote.inspect": {
          validateEmptyInput(input);
          credential = await this.resolveCredential(deadline, write);
          const payload = parseRemoteObject(await this.send("REMOTE_INSPECT", credential, deadline, write, {}));
          output = normalizeRepository(payload, this.binding) as unknown as Record<string, unknown>;
          evidence = [`repository://${this.binding.repository_id}`];
          break;
        }
        case "repository.review.inspect": {
          const { review_number } = validateReviewInspectInput(input);
          credential = await this.resolveCredential(deadline, write);
          const payload = parseRemoteObject(
            await this.send("REVIEW_INSPECT", credential, deadline, write, { review_number }),
          );
          const review = normalizeReview(payload, this.binding);
          if (review.review_number !== review_number) reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
          output = review as unknown as Record<string, unknown>;
          evidence = [`repository://${this.binding.repository_id}/review/${review_number}`];
          break;
        }
        case "repository.review.open": {
          const semantic = validateOpenReviewInput(input);
          credential = await this.resolveCredential(deadline, write);

          await this.requireBranchTip("REVIEW_HEAD_PREFLIGHT", credential, deadline, write, semantic.head_branch, semantic.expected_head_sha, SAFE_MESSAGES.staleHead);
          await this.requireBranchTip("REVIEW_BASE_PREFLIGHT", credential, deadline, write, semantic.base_branch, semantic.expected_base_sha, SAFE_MESSAGES.staleBase);

          const existing = parseRemoteArray(
            await this.send("REVIEW_DUPLICATE_PREFLIGHT", credential, deadline, write, {
              head_branch: semantic.head_branch,
              base_branch: semantic.base_branch,
            }),
          );
          if (existing.length > LIMITS.duplicateReviewProbe) reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
          // A matching open review blocks the POST entirely. This reduces
          // duplicates; it is NOT an exactly-once guarantee (contract §11).
          if (existing.length > 0) reject("EXECUTION_FAILED", SAFE_MESSAGES.duplicateReview);

          const requestBody: Record<string, unknown> = {
            title: semantic.title,
            head: semantic.head_branch,
            base: semantic.base_branch,
            draft: semantic.draft === true,
          };
          if (semantic.body !== undefined) requestBody.body = semantic.body;

          const payload = parseRemoteObject(
            await this.send("REVIEW_OPEN", credential, deadline, write, {}, this.encodeRequestBody(requestBody)),
          );
          const review = normalizeReview(payload, this.binding);
          if (review.head_branch !== semantic.head_branch || review.base_branch !== semantic.base_branch) {
            reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
          }
          output = review as unknown as Record<string, unknown>;
          evidence = [`repository://${this.binding.repository_id}/review/${review.review_number}`];
          break;
        }
        case "repository.review.comment": {
          const semantic = validateCommentInput(input);
          credential = await this.resolveCredential(deadline, write);

          const preflight = normalizeReview(
            parseRemoteObject(
              await this.send("REVIEW_COMMENT_PREFLIGHT", credential, deadline, write, {
                review_number: semantic.review_number,
              }),
            ),
            this.binding,
          );
          if (preflight.review_number !== semantic.review_number) reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
          if (preflight.state !== "OPEN") reject("EXECUTION_FAILED", SAFE_MESSAGES.reviewNotOpen);
          if (preflight.head_sha !== semantic.expected_head_sha.toLowerCase()) {
            reject("EXECUTION_FAILED", SAFE_MESSAGES.staleReviewHead);
          }

          const payload = parseRemoteObject(
            await this.send(
              "REVIEW_COMMENT",
              credential,
              deadline,
              write,
              { review_number: semantic.review_number },
              this.encodeRequestBody({ body: semantic.body }),
            ),
          );
          const receipt = normalizeCommentReceipt(payload, this.binding, semantic.review_number);
          output = receipt as unknown as Record<string, unknown>;
          evidence = [
            `repository://${this.binding.repository_id}/review/${receipt.review_number}/comment/${receipt.comment_id}`,
          ];
          break;
        }
        case "repository.checks.inspect": {
          const { commit_sha } = validateChecksInput(input);
          credential = await this.resolveCredential(deadline, write);
          const payload = parseRemoteObject(
            await this.send("CHECKS_INSPECT", credential, deadline, write, { commit_sha }),
          );
          output = normalizeChecks(payload, this.binding, commit_sha) as unknown as Record<string, unknown>;
          evidence = [`repository://${this.binding.repository_id}/commit/${commit_sha.toLowerCase()}/checks`];
          break;
        }
        default:
          reject("NOT_FOUND", SAFE_MESSAGES.notFoundCapability);
      }

      const serialized = JSON.stringify(output);
      if (utf8Bytes(serialized) > LIMITS.successOutputBytes) {
        reject("EXECUTION_FAILED", SAFE_MESSAGES.outputOverflow);
      }
      // Final credential non-leakage backstop before anything becomes public
      // (S14F-HI-008, S14F-HI-009).
      if (credential !== undefined && (serialized.includes(credential) || evidence.some((ref) => ref.includes(credential!)))) {
        reject("INTERNAL_ERROR", SAFE_MESSAGES.internalError);
      }
      this.ensureTime(deadline, write);

      return {
        status: "SUCCESS",
        ...identity,
        output,
        evidence_refs: evidence,
        duration_ms: deadline.duration(),
      };
    } catch (error) {
      const rejection = error instanceof Rejection ? error : undefined;
      const code: FailureCode = rejection?.code ?? "INTERNAL_ERROR";
      const message = toSafeError(rejection?.safeMessage ?? SAFE_MESSAGES.internalError);
      const retryable =
        rejection?.retryableOverride ?? ((code === "TIMEOUT" || code === "UNAVAILABLE") && !write.isWrite);
      return {
        status: "FAIL",
        ...identity,
        error: { code, message, retryable },
        duration_ms: deadline.duration(),
      };
    } finally {
      credential = undefined;
      deadline.dispose();
    }
  }

  // --- credential boundary (contract §5) ----------------------------------

  private async resolveCredential(deadline: Deadline, write: WriteContext): Promise<string> {
    this.ensureTime(deadline, write);
    // No process.env discovery, no default token, no ambient session: without an
    // explicitly injected provider-private resolver the operation fails closed.
    const resolver = this.credentialResolver;
    if (resolver === undefined) {
      reject("PERMISSION_DENIED", SAFE_MESSAGES.credentialUnavailable);
    }
    // The resolver wait draws from the same invocation deadline (contract §15):
    // a never-settling resolver cannot outlive it, and expiry is classified as
    // TIMEOUT before any preflight or POST. `write.dispatched` stays false here.
    let resolved: unknown;
    try {
      resolved = await deadline.bound(Promise.resolve().then(() => resolver.resolve(this.config.credential_ref)));
    } catch {
      if (deadline.expired()) this.failTimeout(write);
      reject("PERMISSION_DENIED", SAFE_MESSAGES.credentialUnavailable);
    }
    this.ensureTime(deadline, write);
    return validateCredential(resolved);
  }

  // --- fixed operation runner ---------------------------------------------

  private encodeRequestBody(body: Record<string, unknown>): string {
    const text = JSON.stringify(body);
    if (utf8Bytes(text) > LIMITS.requestBodyBytes) reject("EXECUTION_FAILED", SAFE_MESSAGES.outputOverflow);
    return text;
  }

  /**
   * Execute exactly one family of the fixed operation table. The resolved
   * credential reaches ONLY the Authorization header of this one request.
   */
  private async send(
    family: GitHubOperationFamily,
    credential: string,
    deadline: Deadline,
    write: WriteContext,
    params: RouteParams,
    jsonBody?: string,
  ): Promise<string> {
    this.ensureTime(deadline, write);
    const method = OPERATION_METHOD[family];
    const headers: Record<string, string> = {
      accept: ACCEPT,
      "x-github-api-version": API_VERSION,
      "user-agent": USER_AGENT,
      authorization: `Bearer ${credential}`,
    };
    if (jsonBody !== undefined) headers["content-type"] = JSON_CONTENT_TYPE;

    // The one point at which a remote mutation may become observable.
    if (method === "POST") write.dispatched = true;

    let response: GitHubTransportResponse;
    try {
      response = await this.transport.send({
        method,
        origin: GITHUB_ORIGIN,
        path: buildRoute(family, this.binding, params),
        headers,
        ...(jsonBody === undefined ? {} : { body: jsonBody }),
        signal: deadline.controller.signal,
        max_response_bytes: LIMITS.responseBodyBytes,
      });
    } catch (error) {
      if (deadline.expired() || (error instanceof GitHubTransportError && error.kind === "TIMEOUT")) {
        this.failTimeout(write);
      }
      if (error instanceof GitHubTransportError && error.kind === "OVERFLOW") {
        reject("EXECUTION_FAILED", SAFE_MESSAGES.outputOverflow);
      }
      this.failUnavailable(write);
    }

    this.ensureTime(deadline, write);
    if (typeof response.status !== "number" || !Number.isInteger(response.status) || typeof response.body !== "string") {
      reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
    }
    if (utf8Bytes(response.body) > LIMITS.responseBodyBytes) {
      reject("EXECUTION_FAILED", SAFE_MESSAGES.outputOverflow);
    }
    this.assertStatus(family, response.status, response.headers, write);
    return response.body;
  }

  /**
   * Normalize HTTP outcomes to existing Brain errors (contract §16). Raw remote
   * bodies, headers and stacks never cross the provider boundary, and a 404 is
   * never described as proof that a resource does or does not exist.
   */
  private assertStatus(
    family: GitHubOperationFamily,
    status: number,
    headers: Readonly<Record<string, string>>,
    write: WriteContext,
  ): void {
    if (status >= 300 && status < 400) reject("PERMISSION_DENIED", SAFE_MESSAGES.redirectDenied);
    if (status === 401) reject("PERMISSION_DENIED", SAFE_MESSAGES.accessDenied);
    if (status === 403) {
      if (this.rateLimited(headers)) this.failUnavailable(write);
      reject("PERMISSION_DENIED", SAFE_MESSAGES.accessDenied);
    }
    if (status === 404) reject("NOT_FOUND", SAFE_MESSAGES.remoteNotFound);
    if (status === 429) this.failUnavailable(write);
    if (status === 409 || status === 422) reject("EXECUTION_FAILED", SAFE_MESSAGES.remoteRejected);
    if (status >= 500 && status <= 599) this.failUnavailable(write);
    if (status !== OPERATION_SUCCESS_STATUS[family]) reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
  }

  /** Status plus recognized safe rate-limit headers; raw values are dropped. */
  private rateLimited(headers: Readonly<Record<string, string>>): boolean {
    return headers["x-ratelimit-remaining"] === "0" || typeof headers["retry-after"] === "string";
  }

  private ensureTime(deadline: Deadline, write: WriteContext): void {
    if (deadline.expired()) this.failTimeout(write);
  }

  private failTimeout(write: WriteContext): never {
    if (!write.isWrite) reject("TIMEOUT", SAFE_MESSAGES.timeoutRead);
    // A write is never retried automatically, and a post-dispatch outcome is
    // reported as genuinely unknown (contract §15, §16).
    reject("TIMEOUT", write.dispatched ? SAFE_MESSAGES.writeOutcomeUnknown : SAFE_MESSAGES.timeoutWrite);
  }

  private failUnavailable(write: WriteContext): never {
    if (!write.isWrite) reject("UNAVAILABLE", SAFE_MESSAGES.unavailableRead);
    reject("UNAVAILABLE", write.dispatched ? SAFE_MESSAGES.writeOutcomeUnknown : SAFE_MESSAGES.unavailableWrite);
  }

  // --- write preconditions (contract §11) ---------------------------------

  /** Same-repository branch tip must equal the caller's expected commit id. */
  private async requireBranchTip(
    family: "REVIEW_HEAD_PREFLIGHT" | "REVIEW_BASE_PREFLIGHT",
    credential: string,
    deadline: Deadline,
    write: WriteContext,
    branch: string,
    expectedSha: string,
    staleMessage: string,
  ): Promise<void> {
    const payload = parseRemoteObject(await this.send(family, credential, deadline, write, { branch }));
    if (payload.ref !== `refs/heads/${branch}`) reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
    const object = payload.object;
    if (!isPlainObject(object) || typeof object.sha !== "string") {
      reject("EXECUTION_FAILED", SAFE_MESSAGES.malformedRemote);
    }
    if ((object.sha as string).toLowerCase() !== expectedSha.toLowerCase()) {
      reject("EXECUTION_FAILED", staleMessage);
    }
  }
}
