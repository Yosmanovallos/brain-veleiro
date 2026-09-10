/**
 * S14G — bounded, provider-neutral browser inspection capability.
 *
 * Exposes exactly `browser.inspect` with `side_effects = EXTERNAL`. The model
 * provides only a bounded URL and an optional wait strategy; every other
 * browser/engine/network/lifetime decision is trusted host-side configuration.
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
import { PlaywrightChromiumFactory } from "./chromiumFactory.js";
import {
  LIMITS,
  type BrowserHandle,
  type BrowserContextHandle,
  type BrowserFactory,
  type BrowserInspectProviderConfig,
  type BrowserProviderDependencies,
  type PageHandle,
  type Route,
  type RouteRequest,
  type WebSocketRoute,
} from "./types.js";
import {
  Rejection,
  SAFE_MESSAGES,
  reject,
  toSafeError,
  utf8Bytes,
  validateConfig,
  validateEnvelope,
  validateFinalUrl,
  validateInput,
} from "./validation.js";

/**
 * ONE monotonic invocation budget (contract §16). `start` is captured at
 * `invoke()` entry and never reset. A single `AbortController` carries it
 * into every signal-aware Playwright operation and every provider-private race.
 */
class Deadline {
  readonly start = performance.now();
  readonly controller = new AbortController();
  private budget = Number.POSITIVE_INFINITY;
  private timer: NodeJS.Timeout | undefined;

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
   * settlement of `pending` is observed and discarded, and the provider-created
   * abort listener is removed on every settle path.
   */
  bound<T>(pending: Promise<T>): Promise<T> {
    const signal = this.controller.signal;
    return new Promise<T>((resolve, rejectPromise) => {
      const onAbort = (): void => rejectPromise(new Error(SAFE_MESSAGES.timeout));
      if (signal.aborted) {
        pending.then(() => undefined, () => undefined);
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

  dispose(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.controller.abort();
  }
}

export class BrowserInspectCapabilityProvider implements CapabilityProvider {
  private readonly config: BrowserInspectProviderConfig;
  private readonly factory: BrowserFactory;

  constructor(config: unknown, dependencies: BrowserProviderDependencies = {}) {
    if (dependencies === null || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      throw new Error(SAFE_MESSAGES.invalidConfig);
    }
    for (const key of Object.keys(dependencies)) {
      if (key !== "browserFactory") throw new Error(SAFE_MESSAGES.invalidConfig);
    }

    this.config = validateConfig(config);
    this.factory = dependencies.browserFactory ?? new PlaywrightChromiumFactory();
  }

  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return descriptorsFor();
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const deadline = new Deadline();
    const identity = { call_id: request.call_id, capability_id: request.capability_id };
    let browser: BrowserHandle | undefined;
    let context: BrowserContextHandle | undefined;
    let page: PageHandle | undefined;
    let downloadObserved = false;
    let popupObserved = false;

    try {
      // 1. Capability routing, envelope and closed input validation first.
      if (request.capability_id !== "browser.inspect") {
        reject("NOT_FOUND", SAFE_MESSAGES.notFoundCapability);
      }
      validateEnvelope(request);
      deadline.arm(Math.min(request.timeout_ms, this.config.max_timeout_ms));
      const input = validateInput(request.input, this.config.allowed_navigation_origins);

      // 2. Launch a fresh, headless, Playwright-managed Chromium.
      browser = await this.launchBrowser(deadline);

      // 3. Create one fresh non-persistent context with service workers blocked.
      context = await this.raceSignal(browser.newContext({ serviceWorkers: "block", acceptDownloads: false }), deadline);

      // 4. Create exactly one primary page and attach blocking handlers.
      page = await this.raceSignal(context.newPage(), deadline);
      this.attachPageHandlers(page, deadline, () => {
        downloadObserved = true;
      });
      context.onPage((popup) => {
        popupObserved = true;
        this.raceSignal(popup.close(), deadline).catch(() => undefined);
      });

      // 5. Install request and WebSocket routing before navigation.
      const allowedRequest = new Set(this.config.allowed_request_origins);
      const allowedNavigation = new Set(this.config.allowed_navigation_origins);
      await this.raceSignal(
        context.route("**/*", this.createRouteHandler(allowedRequest, allowedNavigation, page)),
        deadline,
      );
      await this.raceSignal(
        context.routeWebSocket("**/*", (ws) => {
          ws.onMessage(() => undefined);
          this.raceSignal(ws.close(), deadline).catch(() => undefined);
        }),
        deadline,
      );

      // 6. Navigate with the one invocation signal and a disabled Playwright timeout.
      await page.goto(input.url, {
        waitUntil: input.wait_until,
        signal: deadline.controller.signal,
        timeout: 0,
      });

      // 7. Revalidate the final main-frame URL: HTTPS, no userinfo, allowed origin, byte bound.
      const finalUrl = validateFinalUrl(page.url(), allowedNavigation);

      // A navigation that became a download or opened an extra page cannot be a success.
      if (downloadObserved) {
        reject("PERMISSION_DENIED", SAFE_MESSAGES.downloadBlocked);
      }
      if (popupObserved) {
        reject("PERMISSION_DENIED", SAFE_MESSAGES.popupBlocked);
      }

      // 8. Capture the bounded title.
      const title = await this.raceSignal(page.title(), deadline);
      if (utf8Bytes(title) > LIMITS.titleBytes) {
        reject("EXECUTION_FAILED", SAFE_MESSAGES.outputOverflow);
      }

      // 9. Capture the bounded ARIA snapshot.
      const ariaSnapshot = await page.ariaSnapshotJSON({
        mode: "default",
        boxes: false,
        depth: this.config.snapshot_depth,
        signal: deadline.controller.signal,
        timeout: 0,
      });

      const snapshotText = JSON.stringify(ariaSnapshot);
      if (utf8Bytes(snapshotText) > this.config.max_snapshot_bytes) {
        reject("EXECUTION_FAILED", SAFE_MESSAGES.outputOverflow);
      }

      // 10. Extract provider-owned, deterministic, bounded HTTPS links.
      const { links, truncated } = extractLinks(ariaSnapshot, finalUrl, this.config.max_links);

      // 11. Build and bound the final observation.
      const observedAt = new Date().toISOString();
      const output = {
        browser_id: this.config.browser_id,
        final_url: finalUrl,
        title,
        aria_snapshot: ariaSnapshot,
        links,
        links_truncated: truncated,
        observed_at: observedAt,
      };

      const outputText = JSON.stringify(output);
      if (utf8Bytes(outputText) > LIMITS.outputBytes) {
        reject("EXECUTION_FAILED", SAFE_MESSAGES.outputOverflow);
      }

      // 12. Final success gate: the one deadline must still hold, and a popup or
      // download observed late (during title/snapshot/finalization) still fails.
      if (deadline.expired()) {
        reject("TIMEOUT", SAFE_MESSAGES.timeout);
      }
      if (downloadObserved) {
        reject("PERMISSION_DENIED", SAFE_MESSAGES.downloadBlocked);
      }
      if (popupObserved) {
        reject("PERMISSION_DENIED", SAFE_MESSAGES.popupBlocked);
      }

      return {
        status: "SUCCESS",
        ...identity,
        output,
        evidence_refs: [`browser://${this.config.browser_id}`],
        duration_ms: deadline.duration(),
      };
    } catch (error) {
      return this.normalizeError(error, identity, deadline, downloadObserved);
    } finally {
      await this.closeAll(page, context, browser, deadline);
      deadline.dispose();
    }
  }

  // --- browser lifecycle and race helpers ---------------------------------

  private async launchBrowser(deadline: Deadline): Promise<BrowserHandle> {
    let captured: BrowserHandle | undefined;
    let rejected = false;

    const launch = this.factory.launch().then((b) => {
      if (rejected) {
        b.close().catch(() => undefined);
        throw new Error(SAFE_MESSAGES.unavailable);
      }
      captured = b;
      return b;
    });

    try {
      return await this.raceSignal(launch, deadline);
    } catch (error) {
      rejected = true;
      if (captured) {
        captured.close().catch(() => undefined);
      }
      throw error;
    }
  }

  private raceSignal<T>(pending: Promise<T>, deadline: Deadline): Promise<T> {
    const signal = deadline.controller.signal;

    return new Promise<T>((resolve, rejectPromise) => {
      let settled = false;
      const onAbort = (): void => {
        if (!settled) {
          settled = true;
          pending.then(() => undefined, () => undefined);
          rejectPromise(new Error(SAFE_MESSAGES.timeout));
        }
      };

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });

      pending.then(
        (value) => {
          if (!settled) {
            settled = true;
            signal.removeEventListener("abort", onAbort);
            resolve(value);
          }
        },
        (error: unknown) => {
          if (!settled) {
            settled = true;
            signal.removeEventListener("abort", onAbort);
            rejectPromise(error);
          }
        },
      );
    });
  }

  // --- request policy ------------------------------------------------------

  private createRouteHandler(
    allowedRequest: ReadonlySet<string>,
    allowedNavigation: ReadonlySet<string>,
    page: PageHandle,
  ): (route: Route) => Promise<void> {
    return async (route: Route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method().toUpperCase();
      const isMainFrame = this.isMainFrameNavigation(request, page);

      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        await route.abort("aborted");
        return;
      }

      if (parsed.protocol !== "https:") {
        await route.abort("aborted");
        return;
      }

      if (method !== "GET" && method !== "HEAD") {
        await route.abort("aborted");
        return;
      }

      const origin = parsed.origin;
      if (isMainFrame && !allowedNavigation.has(origin)) {
        await route.abort("aborted");
        return;
      }

      if (!allowedRequest.has(origin)) {
        await route.abort("aborted");
        return;
      }

      await route.continue();
    };
  }

  private isMainFrameNavigation(request: RouteRequest, _page: PageHandle): boolean {
    if (!request.isNavigationRequest()) return false;
    const frame = request.frame();
    if (!frame) {
      // The very first navigation may not yet have a frame; treat it as the
      // primary page being navigated.
      return true;
    }
    return frame.parentFrame() === null;
  }

  // --- page handlers -------------------------------------------------------

  private attachPageHandlers(page: PageHandle, deadline: Deadline, onDownload: () => void): void {
    page.onDialog((dialog) => {
      this.raceSignal(dialog.dismiss(), deadline).catch(() => undefined);
    });
    page.onDownload((download) => {
      onDownload();
      this.raceSignal(download.cancel(), deadline).catch(() => undefined);
    });
  }

  // --- cleanup -------------------------------------------------------------

  private async closeAll(
    page: PageHandle | undefined,
    context: BrowserContextHandle | undefined,
    browser: BrowserHandle | undefined,
    deadline: Deadline,
  ): Promise<void> {
    for (const target of [page, context, browser] as Array<{ close(): Promise<void> } | undefined>) {
      if (!target) continue;
      try {
        await deadline.bound(target.close());
      } catch {
        // Cleanup cannot turn a primary failure into success; carry on.
      }
    }
  }

  // --- error normalization -------------------------------------------------

  private normalizeError(
    error: unknown,
    identity: { call_id: string; capability_id: string },
    deadline: Deadline,
    downloadObserved: boolean,
  ): ToolInvocationResult {
    const rejection = error instanceof Rejection ? error : undefined;
    if (rejection) {
      return {
        status: "FAIL",
        ...identity,
        error: {
          code: rejection.code,
          message: toSafeError(rejection.safeMessage),
          retryable:
            rejection.retryableOverride ??
            (rejection.code === "TIMEOUT" || rejection.code === "UNAVAILABLE"),
        },
        duration_ms: deadline.duration(),
      };
    }

    if (deadline.expired()) {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "TIMEOUT", message: toSafeError(SAFE_MESSAGES.timeout), retryable: true },
        duration_ms: deadline.duration(),
      };
    }

    if (downloadObserved) {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "PERMISSION_DENIED", message: toSafeError(SAFE_MESSAGES.downloadBlocked), retryable: false },
        duration_ms: deadline.duration(),
      };
    }

    const text = String(error);
    if (text.includes("ERR_ABORTED") || text.includes("ERR_BLOCKED")) {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "PERMISSION_DENIED", message: toSafeError(SAFE_MESSAGES.requestDenied), retryable: false },
        duration_ms: deadline.duration(),
      };
    }

    if (text.includes("net::ERR_") || text.includes("ERR_NAME_NOT_RESOLVED") || text.includes("ERR_CONNECTION")) {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "UNAVAILABLE", message: toSafeError(SAFE_MESSAGES.unavailable), retryable: true },
        duration_ms: deadline.duration(),
      };
    }

    if (text.includes("Executable doesn't exist") || text.includes("browser has been closed") || text.includes("Failed to launch")) {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "UNAVAILABLE", message: toSafeError(SAFE_MESSAGES.unavailable), retryable: true },
        duration_ms: deadline.duration(),
      };
    }

    return {
      status: "FAIL",
      ...identity,
      error: { code: "INTERNAL_ERROR", message: toSafeError(SAFE_MESSAGES.internalError), retryable: false },
      duration_ms: deadline.duration(),
    };
  }
}

// --- link extraction -------------------------------------------------------

function extractLinks(
  snapshot: unknown,
  pageUrl: string,
  maxLinks: number,
): { links: Array<{ text: string; url: string }>; truncated: boolean } {
  const found: Array<{ text: string; url: string }> = [];

  const visit = (node: unknown): void => {
    if (typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.role === "link" && typeof obj.url === "string") {
      const text = typeof obj.name === "string" ? obj.name : "";
      const resolved = resolveLink(String(obj.url), pageUrl);
      // A link outside the per-link bounds is not a normalized link: it is
      // excluded whole, never text-truncated, and does not set links_truncated.
      if (resolved !== undefined && utf8Bytes(text) <= LIMITS.linkTextBytes && utf8Bytes(resolved) <= LIMITS.urlBytes) {
        found.push({ text, url: resolved });
      }
    }
    if (obj.children !== undefined) visit(obj.children);
  };

  visit(snapshot);

  const truncated = found.length > maxLinks;
  const links: Array<{ text: string; url: string }> = [];
  for (let i = 0; i < Math.min(found.length, maxLinks); i++) {
    links.push(found[i]);
  }
  return { links, truncated };
}

function resolveLink(raw: string, pageUrl: string): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw, pageUrl);
    if (parsed.protocol !== "https:") return undefined;
    if (parsed.username || parsed.password) return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}
