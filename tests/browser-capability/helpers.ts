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
  BrowserInspectCapabilityProvider,
  BROWSER_INSPECT,
  SAFE_MESSAGES,
  descriptorsFor,
  type BrowserContextHandle,
  type BrowserContextOptions,
  type BrowserFactory,
  type BrowserHandle,
  type BrowserInspectProviderConfig,
  type BrowserProviderDependencies,
  type DialogHandle,
  type DownloadHandle,
  type GotoOptions,
  type PageHandle,
  type Route,
  type RouteFrame,
  type RouteHandler,
  type RouteRequest,
  type WebSocketRoute,
  type WebSocketRouteHandler,
} from "../../src/providers/capability/browser/index.js";

export { BROWSER_INSPECT, SAFE_MESSAGES };

type AriaSnapshotOptions = Parameters<PageHandle["ariaSnapshotJSON"]>[0];

export const TEST_ORIGIN = "https://qa.example.com";
export const TEST_ORIGIN2 = "https://qa.other.com";
export const TEST_BROWSER_ID = "qa.browser";

export const baseConfig = (over: Partial<BrowserInspectProviderConfig> = {}): BrowserInspectProviderConfig => ({
  browser_id: TEST_BROWSER_ID,
  allowed_navigation_origins: [TEST_ORIGIN],
  allowed_request_origins: [TEST_ORIGIN, TEST_ORIGIN2],
  max_timeout_ms: 5000,
  snapshot_depth: 5,
  max_snapshot_bytes: 8192,
  max_links: 10,
  ...over,
});

export const request = (
  input: Record<string, unknown>,
  timeout_ms = 5000,
): ToolInvocationRequest => ({
  run_id: "browser-exercise",
  call_id: "op",
  turn: 1,
  capability_id: BROWSER_INSPECT,
  input,
  timeout_ms,
});

export const output = (result: ToolInvocationResult): BrowserInspectionShape => {
  expect(result.status).toBe("SUCCESS");
  if (result.status !== "SUCCESS") throw new Error("Expected a successful browser inspection");
  return result.output as unknown as BrowserInspectionShape;
};

export const failCode = (value: ToolInvocationResult, code: string, retryable?: boolean): void => {
  expect(value).toMatchObject({ status: "FAIL", error: { code } });
  if (retryable !== undefined && value.status === "FAIL") expect(value.error.retryable).toBe(retryable);
};

export interface BrowserInspectionShape {
  browser_id: string;
  final_url: string;
  title: string;
  aria_snapshot: unknown;
  links: Array<{ text: string; url: string }>;
  links_truncated: boolean;
  observed_at: string;
}

// --- deterministic fake browser seam (contract §21) -------------------------

function matchesPattern(pattern: string | RegExp, url: string): boolean {
  if (typeof pattern === "string") {
    if (pattern === "**/*") return true;
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" +
          pattern
            .replace(/\*\*/g, "<<<STARSTAR>>>")
            .replace(/\*/g, "[^/]*")
            .replace(/<<<STARSTAR>>>/g, ".*") +
          "$",
      );
      return regex.test(url);
    }
    return url === pattern;
  }
  return pattern.test(url);
}

export class FakeBrowserFactory implements BrowserFactory {
  launches = 0;
  browserCloseCount = 0;
  contextCloseCount = 0;
  pageCloseCount = 0;
  browsers: FakeBrowserHandle[] = [];
  onNewPage?: (page: FakePageHandle) => void;

  async launch(): Promise<BrowserHandle> {
    this.launches++;
    const browser = new FakeBrowserHandle(this);
    this.browsers.push(browser);
    return browser;
  }
}

class FakeBrowserHandle implements BrowserHandle {
  readonly contexts: FakeBrowserContextHandle[] = [];
  constructor(private readonly factory: FakeBrowserFactory) {}

  async newContext(options: BrowserContextOptions): Promise<BrowserContextHandle> {
    const ctx = new FakeBrowserContextHandle(this, options, this.factory);
    this.contexts.push(ctx);
    return ctx;
  }

  async close(): Promise<void> {
    this.factory.browserCloseCount++;
  }
}

export class FakeBrowserContextHandle implements BrowserContextHandle {
  readonly pages: FakePageHandle[] = [];
  readonly wsConnections: FakeWebSocketRoute[] = [];
  private routeRegistry: Array<{ pattern: string | RegExp; handler: RouteHandler }> = [];
  private wsRouteRegistry: Array<{ pattern: string | RegExp; handler: WebSocketRouteHandler }> = [];
  private onPageHandler?: (page: PageHandle) => void;

  constructor(
    private readonly browser: FakeBrowserHandle,
    readonly options: BrowserContextOptions,
    readonly factory: FakeBrowserFactory,
  ) {}

  async newPage(): Promise<PageHandle> {
    const page = new FakePageHandle(this);
    this.pages.push(page);
    this.factory.onNewPage?.(page);
    return page;
  }

  async route(pattern: string | RegExp, handler: RouteHandler): Promise<void> {
    this.routeRegistry.push({ pattern, handler });
  }

  async routeWebSocket(pattern: string | RegExp, handler: WebSocketRouteHandler): Promise<void> {
    this.wsRouteRegistry.push({ pattern, handler });
  }

  onPage(handler: (page: PageHandle) => void): void {
    this.onPageHandler = handler;
  }

  async emitPage(page: FakePageHandle): Promise<void> {
    this.pages.push(page);
    const result = this.onPageHandler?.(page) as unknown;
    if (result && typeof (result as PromiseLike<unknown>).then === "function") await result;
  }

  async dispatchRouteAsync(route: FakeRoute): Promise<boolean> {
    let matched = false;
    for (const { pattern, handler } of this.routeRegistry) {
      if (matchesPattern(pattern, route.url())) {
        matched = true;
        const result = handler(route);
        if (result && typeof result.then === "function") await result;
      }
    }
    return matched;
  }

  async dispatchWebSocket(ws: FakeWebSocketRoute): Promise<boolean> {
    this.wsConnections.push(ws);
    let matched = false;
    for (const { pattern, handler } of this.wsRouteRegistry) {
      if (matchesPattern(pattern, ws.url())) {
        matched = true;
        const result = handler(ws);
        if (result && typeof result.then === "function") await result;
      }
    }
    return matched;
  }

  async close(): Promise<void> {
    this.factory.contextCloseCount++;
  }
}

export class FakePageHandle implements PageHandle {
  private _url = "about:blank";
  private _title = "";
  private _snapshot: unknown = [];
  private onDialogHandler?: (dialog: DialogHandle) => void;
  private onDownloadHandler?: (download: DownloadHandle) => void;

  // Test-controlled simulation hooks
  pendingPopups: string[] = [];
  downloadOnContinue = false;
  wsOnContinue: string[] = [];
  subresources: Array<{ url: string; method?: string }> = [];
  subresourceRequests: Array<{ url: string; allowed: boolean }> = [];
  hang = false;
  failOnGoto?: Error;
  redirectTo?: string;
  /** Runs inside `title()` before it resolves (late post-navigation events). */
  beforeTitle?: () => Promise<void> | void;
  /** Runs inside `ariaSnapshotJSON()` before it resolves (late post-navigation events). */
  beforeSnapshot?: (options: AriaSnapshotOptions) => Promise<void> | void;
  /** When set, `ariaSnapshotJSON()` ignores abort and resolves only after the signal aborts. */
  snapshotResolvesAfterAbort = false;

  constructor(readonly context: FakeBrowserContextHandle) {}

  setPage(title: string, snapshot: unknown): void {
    this._title = title;
    this._snapshot = snapshot;
  }

  setUrl(value: string): void {
    this._url = value;
  }

  url(): string {
    return this._url;
  }

  async goto(url: string, options: GotoOptions): Promise<void> {
    if (this.hang) {
      return new Promise((_resolve, reject) => {
        const onAbort = () => reject(new Error(SAFE_MESSAGES.timeout));
        if (options.signal.aborted) {
          onAbort();
          return;
        }
        options.signal.addEventListener("abort", onAbort, { once: true });
      });
    }

    if (this.failOnGoto) {
      throw this.failOnGoto;
    }

    return new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new Error(SAFE_MESSAGES.timeout));
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });

      const cleanup = () => options.signal.removeEventListener("abort", onAbort);
      const route = new FakeRoute(this, url, "GET", true, resolve, reject, cleanup);

      this.context
        .dispatchRouteAsync(route)
        .then((matched) => {
          if (!matched) {
            route.continue();
          }
        })
        .catch((error: unknown) => reject(error instanceof Error ? error : new Error(String(error))));
    });
  }

  async loadSubresource(url: string, method = "GET"): Promise<FakeRoute> {
    const route = new FakeRoute(this, url, method, false, () => undefined, () => undefined, () => undefined, true);
    await this.context.dispatchRouteAsync(route);
    return route;
  }

  async title(): Promise<string> {
    await this.beforeTitle?.();
    return this._title;
  }

  async ariaSnapshotJSON(options: AriaSnapshotOptions): Promise<unknown> {
    await this.beforeSnapshot?.(options);
    if (this.snapshotResolvesAfterAbort && !options.signal.aborted) {
      await new Promise<void>((resolve) => options.signal.addEventListener("abort", () => resolve(), { once: true }));
    }
    return this._snapshot;
  }

  onDialog(handler: (dialog: DialogHandle) => void): void {
    this.onDialogHandler = handler;
  }

  onDownload(handler: (download: DownloadHandle) => void): void {
    this.onDownloadHandler = handler;
  }

  emitDialog(): FakeDialogHandle {
    const dialog = new FakeDialogHandle();
    this.onDialogHandler?.(dialog);
    return dialog;
  }

  emitDownload(): FakeDownloadHandle {
    const download = new FakeDownloadHandle();
    this.onDownloadHandler?.(download);
    return download;
  }

  async close(): Promise<void> {
    this.context.factory.pageCloseCount++;
  }

  async afterContinue(): Promise<void> {
    if (this.downloadOnContinue) {
      this.emitDownload();
    }
    for (const url of this.wsOnContinue) {
      const ws = new FakeWebSocketRoute(url);
      await this.context.dispatchWebSocket(ws);
    }
    for (const { url, method } of this.subresources) {
      const route = new FakeRoute(this, url, method ?? "GET", false, () => undefined, () => undefined, () => undefined, true);
      await this.context.dispatchRouteAsync(route);
      this.subresourceRequests.push({ url, allowed: route.allowed });
    }
    for (const url of this.pendingPopups) {
      const popup = new FakePageHandle(this.context);
      popup.setUrl(url);
      await this.context.emitPage(popup);
    }
  }
}

export class FakeRoute implements Route {
  private _continued = false;
  private _aborted = false;
  private _errorCode?: string;

  constructor(
    private readonly page: FakePageHandle,
    private readonly _url: string,
    private readonly _method: string,
    private readonly _isNavigation: boolean,
    private readonly resolve: () => void,
    private readonly reject: (error: Error) => void,
    private readonly cleanup: () => void,
    private readonly _isSubresource = false,
  ) {}

  get allowed(): boolean {
    return this._continued;
  }

  get blocked(): boolean {
    return this._aborted;
  }

  url(): string {
    return this._url;
  }

  method(): string {
    return this._method;
  }

  request(): RouteRequest {
    return new FakeRouteRequest(this._url, this._method, this._isNavigation, new FakeRouteFrame(null));
  }

  async continue(): Promise<void> {
    if (this._continued || this._aborted) return;
    this._continued = true;
    this.cleanup();
    if (!this._isSubresource) {
      this.page.setUrl(this.page.redirectTo ?? this._url);
      await this.page.afterContinue();
    }
    this.resolve();
  }

  async abort(errorCode?: string): Promise<void> {
    if (this._continued || this._aborted) return;
    this._aborted = true;
    this._errorCode = errorCode;
    this.cleanup();
    if (!this._isSubresource) {
      const code = errorCode === "aborted" ? "ERR_ABORTED" : "ERR_FAILED";
      this.reject(new Error(`net::${code}`));
    } else {
      this.resolve();
    }
  }
}

export class FakeRouteRequest implements RouteRequest {
  constructor(
    private readonly _url: string,
    private readonly _method: string,
    private readonly _isNavigation: boolean,
    private readonly _frame: RouteFrame | null,
  ) {}

  method(): string {
    return this._method;
  }

  url(): string {
    return this._url;
  }

  isNavigationRequest(): boolean {
    return this._isNavigation;
  }

  frame(): RouteFrame | null {
    return this._frame;
  }
}

export class FakeRouteFrame implements RouteFrame {
  constructor(private readonly parent: RouteFrame | null) {}

  parentFrame(): RouteFrame | null {
    return this.parent;
  }
}

export class FakeWebSocketRoute implements WebSocketRoute {
  readonly messages: Array<string | Uint8Array> = [];
  closed = false;
  closeOptions?: { code?: number; reason?: string };
  private messageHandler?: (message: string | Uint8Array) => unknown;

  constructor(readonly _url: string) {}

  url(): string {
    return this._url;
  }

  onMessage(handler: (message: string | Uint8Array) => unknown): void {
    this.messageHandler = handler;
  }

  send(message: string | Uint8Array): void {
    this.messages.push(message);
    this.messageHandler?.(message);
  }

  async close(options?: { code?: number; reason?: string }): Promise<void> {
    this.closed = true;
    this.closeOptions = options;
  }
}

class FakeDialogHandle implements DialogHandle {
  dismissed = false;

  async dismiss(): Promise<void> {
    this.dismissed = true;
  }
}

class FakeDownloadHandle implements DownloadHandle {
  cancelled = false;

  async cancel(): Promise<void> {
    this.cancelled = true;
  }
}

// --- harness -------------------------------------------------------------

export interface Harness {
  provider: BrowserInspectCapabilityProvider;
  factory: FakeBrowserFactory;
}

export function harness(options: {
  config?: Partial<BrowserInspectProviderConfig>;
  omitFactory?: boolean;
} = {}): Harness {
  const factory = new FakeBrowserFactory();
  const dependencies: BrowserProviderDependencies = options.omitFactory === true ? {} : { browserFactory: factory };
  const provider = new BrowserInspectCapabilityProvider(baseConfig(options.config), dependencies);
  return { provider, factory };
}

export function latestPage(factory: FakeBrowserFactory): FakePageHandle {
  const ctx = factory.browsers[0]?.contexts[0];
  const page = ctx?.pages[ctx.pages.length - 1];
  if (!page) throw new Error("No fake page has been created");
  return page;
}

export function latestContext(factory: FakeBrowserFactory): FakeBrowserContextHandle {
  const ctx = factory.browsers[0]?.contexts[0];
  if (!ctx) throw new Error("No fake context has been created");
  return ctx;
}

export function configureLatestPage(factory: FakeBrowserFactory, title: string, snapshot: unknown): FakePageHandle {
  const page = latestPage(factory);
  page.setPage(title, snapshot);
  return page;
}

// --- registry / Restricted / runAgent composition --------------------------

export function registry(provider: CapabilityProvider, provider_id = "browser-inspect", ids: string[] = [BROWSER_INSPECT]): CapabilityRegistryProvider {
  return new CapabilityRegistryProvider({
    providers: [{ provider_id, provider }],
    bindings: ids.map(capability_id => ({ capability_id, selected_provider_id: provider_id })),
  });
}

export function restricted(
  provider: CapabilityProvider,
  ids: string[] = [BROWSER_INSPECT],
  sideEffects: ToolSideEffectClass[] = ["EXTERNAL"],
  provider_id = "browser-inspect",
): RestrictedCapabilityProvider {
  return new RestrictedCapabilityProvider(registry(provider, provider_id, ids), new Set(ids), new Set(sideEffects));
}

export const definition: AgentDefinition = Object.freeze({
  id: "browser-page-observer",
  role: "observer",
  objective: "Observe the permitted public HTTPS page and return a bounded browser inspection.",
  model_policy: { routing_class: "BALANCED", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: { retrieval_mode: "BOUNDED", max_context_tokens: 1000, max_items: 5, allowed_sources: ["CURRENT_TASK"], require_source_refs: false },
  state_schema: { type: "object" },
  tools: [BROWSER_INSPECT],
  skills: [],
  capabilities: [BROWSER_INSPECT],
  memory_policy: { retrieve: false, remember_candidate: false, commit_verified_memory: false, search_history: false, promotion_policy: "DISABLED" },
  permissions: { allowed_side_effects: ["EXTERNAL"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 20000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object" },
  rubric: { quality_contract_ref: "brain-bootstrap/quality-contracts/S14G_BROWSER_CAPABILITY_DEEP.yaml" },
  evals: [],
}) as AgentDefinition;

export const DEFINITION_BYTES = JSON.stringify(definition);

export function definitionWith(over: Partial<AgentDefinition>): AgentDefinition {
  return { ...structuredClone(definition), ...over } as AgentDefinition;
}

export async function agentExec(
  capabilityProvider: CapabilityProvider,
  input: Record<string, unknown>,
  agentDefinition: AgentDefinition = definition,
  provider_id = "browser-inspect",
) {
  const model: ModelProvider = {
    async decide(r) {
      const observation = r.state.prior_observations.at(-1);
      if (!observation) {
        return {
          status: "SUCCESS",
          decision: { type: "TOOL_CALL", rationale: "Inspect the permitted page.", tool_call: { call_id: "obs", capability_id: BROWSER_INSPECT, input } },
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

export class CompatibleBrowserInspectTestProvider implements CapabilityProvider {
  async list_capabilities(): Promise<ToolDescriptor[]> {
    return descriptorsFor();
  }

  async invoke(invocation: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const identity = { call_id: invocation.call_id, capability_id: invocation.capability_id };
    if (invocation.capability_id !== BROWSER_INSPECT || typeof invocation.input !== "object" || invocation.input === null) {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "INVALID_INPUT", message: "Unsupported compatible-provider request.", retryable: false },
        duration_ms: 0,
      };
    }
    const input = invocation.input as Record<string, unknown>;
    if (typeof input.url !== "string") {
      return {
        status: "FAIL",
        ...identity,
        error: { code: "INVALID_INPUT", message: "Missing url.", retryable: false },
        duration_ms: 0,
      };
    }
    return {
      status: "SUCCESS",
      ...identity,
      output: {
        browser_id: "compatible-browser",
        final_url: input.url as string,
        title: "Compatible observation",
        aria_snapshot: [],
        links: [],
        links_truncated: false,
        observed_at: new Date().toISOString(),
      },
      evidence_refs: ["browser://compatible-browser"],
      duration_ms: 0,
    };
  }
}

export async function assertCompatibleContracts(a: CapabilityProvider, b: CapabilityProvider, id: string): Promise<void> {
  const find = async (p: CapabilityProvider) => (await p.list_capabilities()).find(d => d.capability_id === id)!;
  const left = await find(a);
  const right = await find(b);
  expect(left).toBeDefined();
  expect(right).toBeDefined();
  expect(semanticSignature(left)).toBe(semanticSignature(right));
}
