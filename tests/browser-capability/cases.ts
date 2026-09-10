import { expect } from "vitest";
import type { ToolInvocationRequest } from "../../src/core/agent/types.js";
import { BrowserInspectCapabilityProvider, PlaywrightChromiumFactory, SAFE_MESSAGES } from "../../src/providers/capability/browser/index.js";
import { Rejection } from "../../src/providers/capability/browser/validation.js";
import {
  CompatibleBrowserInspectTestProvider,
  DEFINITION_BYTES,
  type BrowserInspectionShape,
  baseConfig,
  definition,
  failCode,
  harness,
  latestContext,
  latestPage,
  output,
  request,
  agentExec,
  assertCompatibleContracts,
  TEST_ORIGIN,
  TEST_ORIGIN2,
  TEST_BROWSER_ID,
  BROWSER_INSPECT,
} from "./helpers.js";

const run = (h: ReturnType<typeof harness>, input: Record<string, unknown>, timeout_ms = 5000) =>
  h.provider.invoke(request(input, timeout_ms));

const keysOf = (value: Record<string, unknown>): string[] => Object.keys(value).sort();

const OUTPUT_KEYS = ["aria_snapshot", "browser_id", "final_url", "links", "links_truncated", "observed_at", "title"];

const snapshotWithLinks = (links: Array<{ text: string; url: string }>): unknown =>
  [
    {
      role: "document",
      name: "QA",
      children: [
        { role: "heading", name: "QA Page", level: 1 },
        ...links.map(l => ({ role: "link", name: l.text, url: l.url })),
      ],
    },
  ];

const snapshotWithNestedLinks = (): unknown =>
  [
    {
      role: "document",
      name: "Nested",
      children: [
        {
          role: "region",
          children: [
            { role: "link", name: "First", url: "/first" },
            { role: "link", name: "Second", url: "https://qa.other.com/second" },
          ],
        },
        { role: "link", name: "Third", url: "http://insecure.example.com/" },
        { role: "link", name: "Fourth", url: "/fourth?x=1" },
      ],
    },
  ];

// ---------------------------------------------------------------------------
// Positive fixtures
// ---------------------------------------------------------------------------

export const positives: Record<string, () => Promise<void>> = {
  // Exactly one closed, truthfully EXTERNAL descriptor, free of provider identity.
  "FX-POS-001": async () => {
    const h = harness();
    const descriptors = await h.provider.list_capabilities();
    expect(descriptors).toHaveLength(1);
    const [d] = descriptors;
    expect(d.capability_id).toBe(BROWSER_INSPECT);
    expect(d.side_effects).toBe("EXTERNAL");
    expect(d.input_schema.additionalProperties).toBe(false);
    expect((d.output_schema as Record<string, unknown>).additionalProperties).toBe(false);
    const serialized = JSON.stringify(descriptors);
    for (const forbidden of ["qa.example.com", "qa.other.com", "qa.browser", "chromium", "playwright", "proxy", "headless"]) {
      expect(serialized).not.toContain(forbidden);
    }
    // Descriptors are detached copies.
    d.side_effects = "NONE";
    const fresh = await h.provider.list_capabilities();
    expect(fresh[0].side_effects).toBe("EXTERNAL");
  },

  // Happy-path inspection returns bounded observation and deterministic HTTPS links.
  "FX-POS-002": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("QA Page", snapshotWithLinks([
        { text: "Home", url: "/" },
        { text: "Other", url: "https://qa.other.com/other" },
      ]));
    };
    const result = await run(h, { url: "https://qa.example.com/" });
    const observed = output(result);
    expect(observed).toMatchObject({
      browser_id: TEST_BROWSER_ID,
      final_url: "https://qa.example.com/",
      title: "QA Page",
      links_truncated: false,
    });
    expect(observed.links).toEqual([
      { text: "Home", url: "https://qa.example.com/" },
      { text: "Other", url: "https://qa.other.com/other" },
    ]);
    expect(observed.observed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(result.evidence_refs).toEqual(["browser://qa.browser"]);
  },

  // Both wait_until values succeed and are preserved in the observation.
  "FX-POS-003": async () => {
    for (const wait_until of ["domcontentloaded", "load"] as const) {
      const h = harness();
      h.factory.onNewPage = (page) => page.setPage("Wait", [{ role: "document", name: "Wait" }]);
      const observed = output(await run(h, { url: "https://qa.example.com/", wait_until }));
      expect(observed.final_url).toBe("https://qa.example.com/");
      expect(observed.title).toBe("Wait");
    }
  },

  // Links are resolved, filtered to HTTPS, deduplicated by DOM order and truncation is reported.
  "FX-POS-004": async () => {
    const h = harness({ config: { max_links: 2 } });
    h.factory.onNewPage = (page) => page.setPage("Links", snapshotWithNestedLinks());
    const observed = output(await run(h, { url: "https://qa.example.com/page" }));
    expect(observed.links).toEqual([
      { text: "First", url: "https://qa.example.com/first" },
      { text: "Second", url: "https://qa.other.com/second" },
    ]);
    expect(observed.links_truncated).toBe(true);
  },

  // Allowed request-origin subresources continue; forbidden ones are blocked without failing the page.
  "FX-POS-005": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("Subresources", [{ role: "document", name: "Sub" }]);
      page.subresources = [
        { url: "https://qa.other.com/style.css" },
        { url: "https://qa.example.com/script.js" },
        { url: "https://evil.invalid/pixel.png" },
      ];
    };
    output(await run(h, { url: "https://qa.example.com/" }));
    const page = latestPage(h.factory);
    expect(page.subresourceRequests).toEqual([
      { url: "https://qa.other.com/style.css", allowed: true },
      { url: "https://qa.example.com/script.js", allowed: true },
      { url: "https://evil.invalid/pixel.png", allowed: false },
    ]);
  },

  // A snapshot that fits the configured max_snapshot_bytes succeeds exactly at the bound.
  "FX-POS-006": async () => {
    const h = harness({ config: { max_snapshot_bytes: 4096 } });
    const snapshot = { role: "document", name: "Sized", children: [] };
    h.factory.onNewPage = (page) => page.setPage("Sized", snapshot);
    const observed = output(await run(h, { url: "https://qa.example.com/" }));
    expect(observed.aria_snapshot).toEqual(snapshot);
    expect(Buffer.byteLength(JSON.stringify(observed.aria_snapshot), "utf-8")).toBeLessThanOrEqual(4096);
  },

  // Real registry + Restricted + runAgent composition executes the allowed capability.
  "FX-POS-007": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => page.setPage("Agent", snapshotWithLinks([{ text: "Home", url: "/" }]));
    const result = await agentExec(h.provider, { url: "https://qa.example.com/" });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.output?.data).toMatchObject({ browser_id: TEST_BROWSER_ID, final_url: "https://qa.example.com/" });
    expect(result.output?.evidence_refs).toEqual(["browser://qa.browser"]);
  },

  // A compatible implementation swap preserves the exact AgentDefinition bytes.
  "FX-POS-008": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => page.setPage("Swap", [{ role: "document", name: "Swap" }]);
    const compatible = new CompatibleBrowserInspectTestProvider();
    await assertCompatibleContracts(h.provider, compatible, BROWSER_INSPECT);

    const bytesBefore = JSON.stringify(definition);
    const first = await agentExec(h.provider, { url: "https://qa.example.com/" }, definition, "browser-inspect");
    const second = await agentExec(compatible, { url: "https://qa.example.com/" }, definition, "compatible-test");
    expect(JSON.stringify(definition)).toBe(bytesBefore);
    expect(bytesBefore).toBe(DEFINITION_BYTES);
    expect([first.outcome, second.outcome]).toEqual(["SUCCESS", "SUCCESS"]);
    expect(DEFINITION_BYTES).not.toContain("qa.example.com");
  },

  // Cleanup oracle: exactly one fresh browser, context and page are launched and closed per invoke.
  "FX-POS-009": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => page.setPage("Clean", [{ role: "document", name: "Clean" }]);
    output(await run(h, { url: "https://qa.example.com/" }));
    expect(h.factory.launches).toBe(1);
    expect(h.factory.browserCloseCount).toBe(1);
    expect(h.factory.contextCloseCount).toBe(1);
    expect(h.factory.pageCloseCount).toBe(1);
  },

  // Real Playwright Chromium no-network smoke: an unreachable allowed origin yields TIMEOUT or UNAVAILABLE.
  "FX-POS-010": async () => {
    const unreachable = "https://unreachable.invalid.example";
    const provider = new BrowserInspectCapabilityProvider(
      baseConfig({
        max_timeout_ms: 1500,
        allowed_navigation_origins: [unreachable],
        allowed_request_origins: [unreachable],
      }),
      { browserFactory: new PlaywrightChromiumFactory() },
    );
    const result = await provider.invoke(request({ url: `${unreachable}/` }, 1500));
    expect(result.status).toBe("FAIL");
    if (result.status === "FAIL") {
      expect(["TIMEOUT", "UNAVAILABLE"]).toContain(result.error.code);
      expect(result.error.retryable).toBe(true);
    }
  },
};

// ---------------------------------------------------------------------------
// Negative fixtures
// ---------------------------------------------------------------------------

const badConfig = (config: unknown): void => {
  try {
    new BrowserInspectCapabilityProvider(config as Record<string, unknown>);
    throw new Error("Expected construction to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(Rejection);
    if (error instanceof Rejection) {
      expect(error.code).toBe("INVALID_INPUT");
      expect(error.safeMessage).toBe(SAFE_MESSAGES.invalidConfig);
    }
  }
};

export const negatives: Record<string, () => Promise<void>> = {
  // Unknown or forbidden keys, missing required fields, and wrong types fail construction.
  "FX-NEG-001": async () => {
    for (const bad of [
      null,
      undefined,
      42,
      "config",
      {},
      { ...baseConfig(), extra: 1 },
      { ...baseConfig(), headless: true },
      { ...baseConfig(), proxy: "http://127.0.0.1" },
      { ...baseConfig(), executablePath: "/bin/chromium" },
      { browser_id: "qa" },
      { ...baseConfig(), browser_id: null },
      { ...baseConfig(), allowed_navigation_origins: undefined },
      { ...baseConfig(), allowed_request_origins: "https://qa.example.com" },
      { ...baseConfig(), max_timeout_ms: "fast" },
      { ...baseConfig(), snapshot_depth: 1.5 },
    ] as unknown[]) {
      badConfig(bad);
    }
  },

  // Navigation-origins must be a subset of request-origins.
  "FX-NEG-002": async () => {
    badConfig(baseConfig({
      allowed_navigation_origins: ["https://qa.example.com", "https://evil.invalid"],
      allowed_request_origins: ["https://qa.example.com"],
    }));
  },

  // Explicit forbidden configuration surfaces are rejected: channel, args, viewport, cookies, etc.
  "FX-NEG-003": async () => {
    for (const forbidden of [
      "channel",
      "args",
      "headless",
      "viewport",
      "userAgent",
      "locale",
      "timezoneId",
      "cookies",
      "storageState",
      "httpCredentials",
      "clientCertificates",
      "permissions",
      "proxy",
      "downloadsPath",
      "recordHar",
      "recordVideo",
    ]) {
      badConfig({ ...baseConfig(), [forbidden]: {} });
    }
  },

  // Origins must be exact, canonical, allowed HTTPS origins.
  "FX-NEG-004": async () => {
    for (const origin of [
      "http://qa.example.com",
      "https://qa.example.com/",
      "https://qa.example.com/path",
      "https://qa.example.com?x=1",
      "https://qa.example.com#frag",
      "https://user:pass@qa.example.com",
      "https://localhost",
      "https://my.local",
      "https://my.localhost",
      "https://127.0.0.1",
      "https://[::1]",
      "https://single",
      "https://qa*.example.com",
      "ftp://qa.example.com",
      "file:///etc/passwd",
      "",
      "qa.example.com",
    ]) {
      badConfig(baseConfig({
        allowed_navigation_origins: [origin],
        allowed_request_origins: [origin],
      }));
    }
  },

  // Navigation-origins bounds: 1..8, request-origins: 1..32.
  "FX-NEG-005": async () => {
    badConfig(baseConfig({ allowed_navigation_origins: [], allowed_request_origins: [TEST_ORIGIN] }));
    badConfig(baseConfig({ allowed_navigation_origins: Array(9).fill(TEST_ORIGIN), allowed_request_origins: Array(9).fill(TEST_ORIGIN) }));
    badConfig(baseConfig({ allowed_request_origins: [], allowed_navigation_origins: [TEST_ORIGIN] }));
    badConfig(baseConfig({ allowed_request_origins: Array(33).fill(TEST_ORIGIN), allowed_navigation_origins: [TEST_ORIGIN] }));
  },

  // Duplicate origins are not allowed.
  "FX-NEG-006": async () => {
    badConfig(baseConfig({ allowed_navigation_origins: [TEST_ORIGIN, TEST_ORIGIN], allowed_request_origins: [TEST_ORIGIN, TEST_ORIGIN] }));
  },

  // Numeric configuration bounds.
  "FX-NEG-007": async () => {
    badConfig(baseConfig({ max_timeout_ms: 0 }));
    badConfig(baseConfig({ max_timeout_ms: 60001 }));
    badConfig(baseConfig({ snapshot_depth: 0 }));
    badConfig(baseConfig({ snapshot_depth: 21 }));
    badConfig(baseConfig({ max_snapshot_bytes: 4095 }));
    badConfig(baseConfig({ max_snapshot_bytes: 262145 }));
    badConfig(baseConfig({ max_links: -1 }));
    badConfig(baseConfig({ max_links: 101 }));
  },

  // browser_id must match the allowed grammar.
  "FX-NEG-008": async () => {
    for (const id of ["", "A", "-start", "start ", "a b", "a".repeat(161)]) {
      badConfig(baseConfig({ browser_id: id }));
    }
  },

  // Wrong capability id, invalid envelope fields and bad input all fail closed.
  "FX-NEG-009": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => page.setPage("Fail", [{ role: "document", name: "Fail" }]);
    failCode(await h.provider.invoke({ ...request({ url: "https://qa.example.com/" }), capability_id: "browser.navigate" }), "NOT_FOUND", false);
  },

  // Invalid envelope.
  "FX-NEG-010": async () => {
    const h = harness();
    const base = { capability_id: BROWSER_INSPECT, input: { url: "https://qa.example.com/" }, timeout_ms: 5000 };
    for (const bad of [
      { ...base, call_id: "" },
      { ...base, run_id: "" },
      { ...base, turn: -1 },
      { ...base, turn: 1.5 },
      { ...base, timeout_ms: 0 },
      { ...base, timeout_ms: 100000 },
    ]) {
      failCode(await h.provider.invoke(bad as unknown as ToolInvocationRequest), "INVALID_INPUT", false);
    }
  },

  // Input must be a closed object with only allowed keys.
  "FX-NEG-011": async () => {
    const h = harness();
    failCode(await run(h, { url: "https://qa.example.com/", extra: 1 }), "INVALID_INPUT", false);
    failCode(await run(h, null as unknown as Record<string, unknown>), "INVALID_INPUT", false);
  },

  // URL must be a bounded, well-formed HTTPS URL.
  "FX-NEG-012": async () => {
    const h = harness();
    for (const bad of ["", "a".repeat(2049), 42, null, "https://\x01invalid"]) {
      failCode(await run(h, { url: bad as string }), "INVALID_INPUT", false);
    }
  },

  // Only https scheme is accepted.
  "FX-NEG-013": async () => {
    const h = harness();
    for (const bad of [
      "http://qa.example.com/",
      "ftp://qa.example.com/",
      "file:///etc/passwd",
      "data:text/html,hi",
      "javascript:alert(1)",
    ]) {
      failCode(await run(h, { url: bad }), "INVALID_INPUT", false);
    }
  },

  // Forbidden hostname patterns.
  "FX-NEG-014": async () => {
    const h = harness();
    for (const bad of [
      "https://localhost/",
      "https://my.local/",
      "https://my.localhost/",
      "https://single/",
      "https://127.0.0.1/",
      "https://[::1]/",
      "https://*.example.com/",
    ]) {
      failCode(await run(h, { url: bad }), "INVALID_INPUT", false);
    }
  },

  // URL origin must be in the allowed navigation origins.
  "FX-NEG-015": async () => {
    const h = harness();
    failCode(await run(h, { url: "https://evil.invalid/" }), "PERMISSION_DENIED", false);
  },

  // wait_until must be one of the two allowed values.
  "FX-NEG-016": async () => {
    const h = harness();
    failCode(await run(h, { url: "https://qa.example.com/", wait_until: "networkidle" }), "INVALID_INPUT", false);
    failCode(await run(h, { url: "https://qa.example.com/", wait_until: 1 as unknown as string }), "INVALID_INPUT", false);
  },

  // Main-frame navigation to a forbidden origin is aborted.
  "FX-NEG-017": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("Block", [{ role: "document", name: "Block" }]);
      page.redirectTo = "https://evil.invalid/";
    };
    failCode(await run(h, { url: "https://qa.example.com/" }), "PERMISSION_DENIED", false);
  },

  // A final URL (post-redirect) outside the allowed navigation origins is rejected.
  "FX-NEG-018": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("Redirect", [{ role: "document", name: "Redirect" }]);
      page.redirectTo = "https://qa.other.com/evil";
    };
    failCode(await run(h, { url: "https://qa.example.com/" }), "PERMISSION_DENIED", false);
  },

  // Subresources with disallowed methods, schemes or origins are blocked.
  "FX-NEG-019": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("Block", [{ role: "document", name: "Block" }]);
      page.subresources = [
        { url: "https://qa.other.com/api", method: "POST" },
        { url: "https://qa.other.com/api", method: "DELETE" },
        { url: "http://qa.example.com/script.js" },
        { url: "https://evil.invalid/pixel.png" },
      ];
    };
    output(await run(h, { url: "https://qa.example.com/" }));
    const page = latestPage(h.factory);
    expect(page.subresourceRequests.every(r => !r.allowed)).toBe(true);
  },

  // Download observed fails the invocation.
  "FX-NEG-020": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("Download", [{ role: "document", name: "Download" }]);
      page.downloadOnContinue = true;
    };
    failCode(await run(h, { url: "https://qa.example.com/" }), "PERMISSION_DENIED", false);
  },

  // Popup / extra page observed fails the invocation.
  "FX-NEG-021": async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("Popup", [{ role: "document", name: "Popup" }]);
      page.pendingPopups = ["https://qa.example.com/popup"];
    };
    failCode(await run(h, { url: "https://qa.example.com/" }), "PERMISSION_DENIED", false);
  },

  // Timeout when navigation does not settle before the effective deadline.
  "FX-NEG-022": async () => {
    const h = harness({ config: { max_timeout_ms: 200 } });
    h.factory.onNewPage = (page) => {
      page.hang = true;
    };
    const result = await run(h, { url: "https://qa.example.com/" }, 200);
    failCode(result, "TIMEOUT", true);
  },

  // Snapshot overflow is rejected.
  "FX-NEG-023": async () => {
    const h = harness({ config: { max_snapshot_bytes: 4096 } });
    h.factory.onNewPage = (page) => page.setPage("Overflow", { role: "document", name: "a".repeat(8192) });
    failCode(await run(h, { url: "https://qa.example.com/" }), "EXECUTION_FAILED", false);
  },

  // Browser launch failure is reported as UNAVAILABLE.
  "FX-NEG-024": async () => {
    const factory = {
      launch: async () => {
        throw new Error("Executable doesn't exist at /fake");
      },
    };
    const provider = new BrowserInspectCapabilityProvider(baseConfig(), { browserFactory: factory });
    failCode(await provider.invoke(request({ url: "https://qa.example.com/" })), "UNAVAILABLE", true);
  },
};
