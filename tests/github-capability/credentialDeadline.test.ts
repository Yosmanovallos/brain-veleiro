import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKS, HEAD_SHA, REMOTE, REVIEW_COMMENT, REVIEW_INSPECT, REVIEW_OPEN, SENTINEL,
  assertNoCredential, commentInput, controlledResolver, failCode, harness, openReviewInput,
  output, repoPayload, request, sentinelResolver, type Harness,
} from "./helpers.js";
import { SAFE_MESSAGES, type GitHubCredentialResolver } from "../../src/providers/capability/github/index.js";

/**
 * Non-canonical regression evidence for source-review finding SR-001: the
 * credential-resolution wait is bounded by the ONE invocation deadline
 * (contract §15). These do not renumber or replace FX-POS-* / FX-NEG-*.
 */

const SHORT_BUDGET_MS = 60;

const run = (h: Harness, capability_id: string, input: Record<string, unknown>, timeout_ms = 5000) =>
  h.provider.invoke(request(capability_id, input, timeout_ms));

/** Let every pending microtask, immediate and unhandled-rejection check drain. */
const drain = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise<void>(resolve => setTimeout(resolve, 0));
};

const hangingHarness = () => {
  const control = controlledResolver();
  const h = harness({ config: { max_timeout_ms: SHORT_BUDGET_MS }, resolver: control, script: [] });
  return { h, control };
};

let unhandled: unknown[];
const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };

beforeEach(() => {
  unhandled = [];
  process.on("unhandledRejection", onUnhandled);
});
afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
  vi.restoreAllMocks();
});

describe("SR-001 credential resolution is bounded by the invocation deadline", () => {
  it("SR-001-T1 hanging resolver on READ: TIMEOUT, retryable, one resolution, zero HTTP", async () => {
    for (const [capability, input] of [
      [REMOTE, {}], [REVIEW_INSPECT, { review_number: 7 }], [CHECKS, { commit_sha: HEAD_SHA }],
    ] as const) {
      const { h, control } = hangingHarness();
      const result = await run(h, capability, input);
      failCode(result, "TIMEOUT", true);
      if (result.status === "FAIL") expect(result.error.message).toBe(SAFE_MESSAGES.timeoutRead);
      expect(result.duration_ms).toBeLessThan(4000);
      expect(control.probe.calls).toBe(1);
      expect(h.transport.requests).toHaveLength(0);
    }

    // The request timeout also bounds the resolver wait: min(request, config).
    const control = controlledResolver();
    const shared = harness({ config: { max_timeout_ms: 5000 }, resolver: control, script: [] });
    const result = await run(shared, REMOTE, {}, SHORT_BUDGET_MS);
    failCode(result, "TIMEOUT", true);
    if (result.status === "FAIL") expect(result.error.message).toBe(SAFE_MESSAGES.timeoutRead);
    expect(result.duration_ms).toBeLessThan(4000);
    expect(control.probe.calls).toBe(1);
    expect(shared.transport.requests).toHaveLength(0);
  });

  it("SR-001-T2 hanging resolver on WRITE: pre-dispatch TIMEOUT, not retryable, zero HTTP", async () => {
    for (const [capability, input] of [[REVIEW_OPEN, openReviewInput()], [REVIEW_COMMENT, commentInput()]] as const) {
      const { h, control } = hangingHarness();
      const result = await run(h, capability, input);
      failCode(result, "TIMEOUT", false);
      if (result.status === "FAIL") {
        expect(result.error.message).toBe(SAFE_MESSAGES.timeoutWrite);
        expect(result.error.message).not.toBe(SAFE_MESSAGES.writeOutcomeUnknown);
      }
      expect(result.duration_ms).toBeLessThan(4000);
      expect(control.probe.calls).toBe(1);
      // No preflight GET and no POST was ever built.
      expect(h.transport.requests).toHaveLength(0);
    }
  });

  it("SR-001-T3 resolver rejection before the deadline stays PERMISSION_DENIED with zero HTTP", async () => {
    // Immediate async rejection under a large budget.
    const immediate = harness({ credential: new Error("vault down: secret-material-xyz"), script: [{ json: repoPayload() }] });
    const denied = await run(immediate, REMOTE, {});
    failCode(denied, "PERMISSION_DENIED", false);
    if (denied.status === "FAIL") expect(denied.error.message).toBe(SAFE_MESSAGES.credentialUnavailable);
    expect(JSON.stringify(denied)).not.toContain("secret-material-xyz");
    expect(immediate.transport.requests).toHaveLength(0);

    // Explicit rejection of a pending resolution, well before the deadline.
    for (const [capability, input] of [[REMOTE, {}], [REVIEW_OPEN, openReviewInput()]] as const) {
      const control = controlledResolver();
      const h = harness({ resolver: control, script: [] });
      const pending = run(h, capability, input);
      await vi.waitFor(() => expect(control.probe.calls).toBe(1));
      control.fail(new Error("vault down: secret-material-xyz"));
      const result = await pending;
      failCode(result, "PERMISSION_DENIED", false);
      if (result.status === "FAIL") expect(result.error.message).toBe(SAFE_MESSAGES.credentialUnavailable);
      expect(JSON.stringify(result)).not.toContain("secret-material-xyz");
      expect(h.transport.requests).toHaveLength(0);
    }

    // A resolver that throws synchronously is also a credential failure.
    const throwing: GitHubCredentialResolver = {
      resolve(): Promise<string> { throw new Error("sync secret-material-xyz"); },
    };
    const sync = harness({ resolver: { resolver: throwing, probe: { calls: 0, refs: [] } }, script: [] });
    const syncResult = await run(sync, REMOTE, {});
    failCode(syncResult, "PERMISSION_DENIED", false);
    if (syncResult.status === "FAIL") expect(syncResult.error.message).toBe(SAFE_MESSAGES.credentialUnavailable);
    expect(sync.transport.requests).toHaveLength(0);
  });

  it("SR-001-T4 late resolver settlement or rejection after the deadline changes nothing", async () => {
    for (const [capability, input, retryable, message] of [
      [REMOTE, {}, true, SAFE_MESSAGES.timeoutRead],
      [REVIEW_OPEN, openReviewInput(), false, SAFE_MESSAGES.timeoutWrite],
      [REVIEW_COMMENT, commentInput(), false, SAFE_MESSAGES.timeoutWrite],
    ] as const) {
      for (const late of ["settle", "fail"] as const) {
        const { h, control } = hangingHarness();
        const result = await run(h, capability, input);
        failCode(result, "TIMEOUT", retryable);
        if (result.status === "FAIL") expect(result.error.message).toBe(message);
        const snapshot = JSON.stringify(result);

        if (late === "settle") control.settle(SENTINEL);
        else control.fail(new Error(`late rejection ${SENTINEL}`));
        await drain();

        // The returned result is final, nothing reached transport, nothing leaked.
        expect(JSON.stringify(result)).toBe(snapshot);
        expect(h.transport.requests).toHaveLength(0);
        expect(control.probe.calls).toBe(1);
        assertNoCredential(result);
        expect(unhandled).toEqual([]);
      }
    }
  });

  it("SR-001-T5 the resolver wait adds and removes its own abort listener on success", async () => {
    const added: unknown[] = [];
    const removed: unknown[] = [];
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    vi.spyOn(EventTarget.prototype, "addEventListener").mockImplementation(function (this: EventTarget, type, listener, options) {
      if (type === "abort") added.push(listener);
      return add.call(this, type, listener, options);
    });
    vi.spyOn(EventTarget.prototype, "removeEventListener").mockImplementation(function (this: EventTarget, type, listener, options) {
      if (type === "abort") removed.push(listener);
      return remove.call(this, type, listener, options);
    });

    const { resolver, probe } = sentinelResolver();
    const h = harness({ resolver: { resolver, probe }, script: [{ json: repoPayload() }] });
    const result = await run(h, REMOTE, {});
    output(result);
    expect(probe.calls).toBe(1);
    expect(h.transport.requests).toHaveLength(1);
    expect(added.length).toBeGreaterThanOrEqual(1);
    expect(removed).toEqual(added);
  });
});
