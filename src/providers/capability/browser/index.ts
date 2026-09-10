/**
 * S14G — Browser Inspect Capability public entry point.
 *
 * Exports the provider class plus the trusted configuration, factory seam and
 * validation contracts a host composition needs. Nothing here is imported by
 * Core, by `AgentDefinition`, or by any other capability provider.
 */

export { BrowserInspectCapabilityProvider } from "./browserCapabilityProvider.js";
export { PlaywrightChromiumFactory } from "./chromiumFactory.js";
export { descriptorsFor } from "./descriptors.js";
export { BROWSER_INSPECT, LIMITS } from "./types.js";
export {
  SAFE_MESSAGES,
  canonicalOrigin,
  isForbiddenHostname,
  validateConfig,
  validateEnvelope,
  validateInput,
  validateUrl,
} from "./validation.js";
export type {
  BrowserCapabilityId,
  BrowserContextHandle,
  BrowserContextOptions,
  BrowserFactory,
  BrowserHandle,
  BrowserInspectInput,
  BrowserInspectProviderConfig,
  BrowserInspectionObservation,
  BrowserProviderDependencies,
  DialogHandle,
  DownloadHandle,
  GotoOptions,
  PageHandle,
  Route,
  RouteFrame,
  RouteHandler,
  RouteRequest,
  WebSocketRoute,
  WebSocketRouteHandler,
} from "./types.js";
