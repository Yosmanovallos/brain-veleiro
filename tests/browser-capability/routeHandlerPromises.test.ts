import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BrowserContext } from "playwright-core";
import { PlaywrightBrowserContextHandle } from "../../src/providers/capability/browser/chromiumFactory.js";
import type { Route, WebSocketRoute } from "../../src/providers/capability/browser/index.js";

/**
 * SR-G-006 — the callbacks the adapter registers with Playwright must RETURN the
 * provider handler's Promise, so Playwright tracks its completion and observes
 * its rejection instead of the Promise being orphaned.
 *
 * The real `PlaywrightBrowserContextHandle` is driven against a structural
 * BrowserContext double that dispatches exactly like playwright-core 1.63.0:
 *   route:          RouteHandler._handleInternal -> Promise.all([handled, cb(route, request)])
 *   routeWebSocket: WebSocketRouteHandler.handle -> await cb(ws); await ws._afterHandle()
 * The double records what each callback returned and when it settled.
 */

type RouteCallback = (route: unknown, request: unknown) => unknown;
type WebSocketCallback = (ws: unknown) => unknown;

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

const deferred = (): Deferred => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const tick = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

class PlaywrightContextDouble {
  routeCallback?: RouteCallback;
  wsCallback?: WebSocketCallback;
  readonly events: string[] = [];
  lastReturn: unknown = "not-called";

  async route(_pattern: string | RegExp, callback: RouteCallback): Promise<void> {
    this.routeCallback = callback;
  }

  async routeWebSocket(_pattern: string | RegExp, callback: WebSocketCallback): Promise<void> {
    this.wsCallback = callback;
  }

  /** playwright-core 1.63.0 `RouteHandler._handleInternal`. */
  async dispatchRoute(): Promise<void> {
    const request = { url: () => "https://qa.example.com/", method: () => "GET" };
    const pwRoute = { request: () => request, abort: async () => undefined, continue: async () => undefined };
    this.lastReturn = this.routeCallback!(pwRoute, request);
    await Promise.all([Promise.resolve(true), this.lastReturn]);
    this.events.push("route-handled");
  }

  /** playwright-core 1.63.0 `WebSocketRouteHandler.handle`. */
  async dispatchWebSocket(): Promise<void> {
    const pwWs = { url: () => "wss://qa.example.com/socket", onMessage: () => undefined, close: async () => undefined };
    this.lastReturn = this.wsCallback!(pwWs);
    await this.lastReturn;
    this.events.push("ws-afterHandle");
  }
}

const adapterOver = (double: PlaywrightContextDouble): PlaywrightBrowserContextHandle =>
  new PlaywrightBrowserContextHandle(double as unknown as BrowserContext);

describe("SR-G-006 route/WebSocket handler promises reach Playwright", () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown): void => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled.length = 0;
    process.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  it("SR-G-006-01: the route callback returns the provider handler's own Promise", async () => {
    const double = new PlaywrightContextDouble();
    let handlerPromise: Promise<void> | undefined;
    let seen: Route | undefined;
    await adapterOver(double).route("**/*", route => {
      seen = route;
      handlerPromise = Promise.resolve();
      return handlerPromise;
    });

    await double.dispatchRoute();

    expect(double.lastReturn).toBeInstanceOf(Promise);
    expect(double.lastReturn).toBe(handlerPromise);
    expect(seen?.request().url()).toBe("https://qa.example.com/");
  });

  it("SR-G-006-02: Playwright's route dispatch stays pending until the async handler completes", async () => {
    const double = new PlaywrightContextDouble();
    const gate = deferred();
    let completed = false;
    await adapterOver(double).route("**/*", async () => {
      await gate.promise;
      completed = true;
    });

    const dispatch = double.dispatchRoute();
    await tick();
    expect(double.events).toEqual([]);
    expect(completed).toBe(false);

    gate.resolve();
    await dispatch;
    expect(completed).toBe(true);
    expect(double.events).toEqual(["route-handled"]);
  });

  it("SR-G-006-03: a rejecting route handler is observed by Playwright, not orphaned", async () => {
    const double = new PlaywrightContextDouble();
    const failure = new Error("route.abort failed");
    await adapterOver(double).route("**/*", async () => {
      await tick();
      throw failure;
    });

    await expect(double.dispatchRoute()).rejects.toBe(failure);
    await tick();
    await tick();
    expect(double.events).toEqual([]);
    expect(unhandled).toEqual([]);
  });

  it("SR-G-006-04: the WebSocket callback returns the handler's Promise and _afterHandle waits for it", async () => {
    const double = new PlaywrightContextDouble();
    const gate = deferred();
    let handlerPromise: Promise<void> | undefined;
    let seen: WebSocketRoute | undefined;
    await adapterOver(double).routeWebSocket("**/*", ws => {
      seen = ws;
      handlerPromise = gate.promise;
      return handlerPromise;
    });

    const dispatch = double.dispatchWebSocket();
    await tick();
    expect(double.lastReturn).toBe(handlerPromise);
    expect(double.events).toEqual([]);

    gate.resolve();
    await dispatch;
    expect(double.events).toEqual(["ws-afterHandle"]);
    expect(seen?.url()).toBe("wss://qa.example.com/socket");
  });

  it("SR-G-006-05: a rejecting WebSocket handler is observed by Playwright, not orphaned", async () => {
    const double = new PlaywrightContextDouble();
    const failure = new Error("ws.close failed");
    await adapterOver(double).routeWebSocket("**/*", async () => {
      await tick();
      throw failure;
    });

    await expect(double.dispatchWebSocket()).rejects.toBe(failure);
    await tick();
    await tick();
    expect(double.events).toEqual([]);
    expect(unhandled).toEqual([]);
  });

  it("SR-G-006-06: synchronous handlers still hand Playwright a non-Promise and complete immediately", async () => {
    const double = new PlaywrightContextDouble();
    const adapter = adapterOver(double);
    let routeCalls = 0;
    let wsCalls = 0;
    await adapter.route("**/*", () => {
      routeCalls++;
    });
    await adapter.routeWebSocket("**/*", () => {
      wsCalls++;
    });

    await double.dispatchRoute();
    expect(double.lastReturn).toBeUndefined();
    await double.dispatchWebSocket();
    expect(double.lastReturn).toBeUndefined();
    expect([routeCalls, wsCalls]).toEqual([1, 1]);
    expect(double.events).toEqual(["route-handled", "ws-afterHandle"]);
    expect(unhandled).toEqual([]);
  });
});
