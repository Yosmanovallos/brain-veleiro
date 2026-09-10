/**
 * S14G — Browser Inspect Capability: trusted provider-layer configuration,
 * browser-factory seam and observation contract.
 *
 * Defined by brain-bootstrap/specs/BROWSER_CAPABILITY_CONTRACT_S14G.md,
 * brain-bootstrap/skills/BROWSER_CAPABILITY_SKILL_S14G.md and
 * brain-bootstrap/quality-contracts/S14G_BROWSER_CAPABILITY_DEEP.yaml.
 *
 * A `BrowserInspectProviderConfig` is explicit host-side/administrative input.
 * The model never creates, mutates or overrides it, and none of its fields enter
 * `AgentDefinition`, the public `ToolDescriptor`, a `capability_id` or
 * model-visible output.
 */

import type {
  CapabilityProvider,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "../../../core/agent/types.js";

/** The one public capability identity for S14G v1. */
export type BrowserCapabilityId = "browser.inspect";

export const BROWSER_INSPECT: BrowserCapabilityId = "browser.inspect";

/** Trusted provider-layer configuration. */
export interface BrowserInspectProviderConfig {
  /** Logical browser identity, `^[a-z0-9][a-z0-9._-]{0,159}$`. */
  browser_id: string;
  /** 1..8 unique canonical HTTPS origins allowed for top-level navigation. */
  allowed_navigation_origins: string[];
  /** 1..32 unique canonical HTTPS origins allowed for any request. */
  allowed_request_origins: string[];
  /** Upper timeout bound for one invocation, in ms. */
  max_timeout_ms: number;
  /** ARIA snapshot traversal depth. */
  snapshot_depth: number;
  /** ARIA snapshot maximum serialized byte length. */
  max_snapshot_bytes: number;
  /** Maximum number of normalized HTTPS links returned. */
  max_links: number;
}

/** Closed semantic input after validation. */
export interface BrowserInspectInput {
  url: string;
  wait_until: "domcontentloaded" | "load";
}

/** Bounded public observation. */
export interface BrowserInspectionObservation {
  browser_id: string;
  final_url: string;
  title: string;
  aria_snapshot: unknown;
  links: Array<{ text: string; url: string }>;
  links_truncated: boolean;
  observed_at: string;
}

/** Every S14G bound. */
export const LIMITS = {
  browserIdChars: 160,
  configTimeoutMs: 60000,
  snapshotDepthMin: 1,
  snapshotDepthMax: 20,
  maxSnapshotBytesMin: 4096,
  maxSnapshotBytesMax: 262144,
  maxLinksMin: 0,
  maxLinksMax: 100,
  urlBytes: 2048,
  navigationOriginsMax: 8,
  requestOriginsMax: 32,
  titleBytes: 1024,
  finalUrlBytes: 2048,
  outputBytes: 393216,
  safeErrorAsciiChars: 160,
  envelopeIdChars: 128,
} as const;

/** Optional injected dependencies. */
export interface BrowserProviderDependencies {
  browserFactory?: BrowserFactory;
}

/** Production Chromium or deterministic test double entry point. */
export interface BrowserFactory {
  launch(): Promise<BrowserHandle>;
}

/** Browser lifetime handle. */
export interface BrowserHandle {
  newContext(options: BrowserContextOptions): Promise<BrowserContextHandle>;
  close(): Promise<void>;
}

/** Non-persistent context handle. */
export interface BrowserContextHandle {
  newPage(): Promise<PageHandle>;
  route(pattern: string | RegExp, handler: RouteHandler): Promise<void>;
  routeWebSocket(pattern: string | RegExp, handler: WebSocketRouteHandler): Promise<void>;
  onPage(handler: (page: PageHandle) => void): void;
  close(): Promise<void>;
}

/** A single browser page handle. */
export interface PageHandle {
  goto(url: string, options: GotoOptions): Promise<void>;
  url(): string;
  title(): Promise<string>;
  ariaSnapshotJSON(options: AriaSnapshotOptions): Promise<unknown>;
  onDialog(handler: (dialog: DialogHandle) => void): void;
  onDownload(handler: (download: DownloadHandle) => void): void;
  close(): Promise<void>;
}

/** Route handler signature. */
export type RouteHandler = (route: Route) => Promise<void> | void;

/** WebSocket route handler signature. */
export type WebSocketRouteHandler = (ws: WebSocketRoute) => Promise<void> | void;

/** New context options relevant to S14G. */
export interface BrowserContextOptions {
  serviceWorkers: "block";
  acceptDownloads: false;
}

/** Page navigation options relevant to S14G. */
export interface GotoOptions {
  waitUntil: "domcontentloaded" | "load";
  signal: AbortSignal;
  timeout: number;
}

/** ARIA snapshot options relevant to S14G. */
export interface AriaSnapshotOptions {
  mode: "default";
  boxes: false;
  depth: number;
  signal: AbortSignal;
  timeout: number;
}

/** Network route abstraction. */
export interface Route {
  request(): RouteRequest;
  abort(errorCode?: string): Promise<void>;
  continue(): Promise<void>;
}

/** Network request abstraction. */
export interface RouteRequest {
  method(): string;
  url(): string;
  isNavigationRequest(): boolean;
  frame(): RouteFrame | null;
}

/** Frame abstraction for main-frame detection. */
export interface RouteFrame {
  parentFrame(): RouteFrame | null;
}

/** WebSocket route abstraction. */
export interface WebSocketRoute {
  url(): string;
  onMessage(handler: (message: string | Uint8Array) => unknown): void;
  close(options?: { code?: number; reason?: string }): Promise<void>;
}

/** Dialog abstraction. */
export interface DialogHandle {
  dismiss(): Promise<void>;
}

/** Download abstraction. */
export interface DownloadHandle {
  cancel(): Promise<void>;
}

/** Provider class contract. */
export interface BrowserInspectCapabilityProvider extends CapabilityProvider {
  invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult>;
}
