import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { chromium, type Browser } from "playwright-core";
import { PlaywrightChromiumFactory } from "../../src/providers/capability/browser/index.js";

/**
 * SR-G-005 — contract §22 real no-network smoke that MUST succeed. It drives
 * the production `PlaywrightChromiumFactory` and its adapters against the
 * pinned playwright-core and its Playwright-managed headless Chromium, with
 * provider-owned static content set on the page (no public network, no server).
 *
 * There is no try/catch tolerance: a missing or broken Chromium fails this test;
 * TIMEOUT/UNAVAILABLE is never an acceptable outcome for this invariant.
 * `setContent` is used only here, on the raw Playwright page observed through a
 * call-through spy; the production seam deliberately does not expose it.
 */

const SMOKE_HTML = `<!doctype html>
<html lang="en">
  <head><title>S14G smoke</title></head>
  <body>
    <main>
      <h1>Brain browser smoke</h1>
      <nav aria-label="Primary"><a href="https://qa.example.com/docs">Docs</a></nav>
      <p>Static provider-owned content.</p>
      <ul><li>Alpha</li><li>Beta</li></ul>
      <button type="button">Inert</button>
    </main>
  </body>
</html>`;

interface AriaNode {
  role?: string;
  name?: string;
  text?: string;
  url?: string;
  level?: number;
  children?: AriaNode[];
}

const flatten = (nodes: unknown): AriaNode[] => {
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((node: AriaNode) => [node, ...flatten(node.children)]);
};

describe("SR-G-005 real Chromium success smoke", () => {
  it("SR-G-005-01: pinned playwright-core launches managed headless Chromium, snapshots static content and closes cleanly", async () => {
    const require = createRequire(import.meta.url);
    expect((require("playwright-core/package.json") as { version: string }).version).toBe("1.63.0");
    expect(
      existsSync(chromium.executablePath()),
      "Playwright-managed Chromium is missing; run `npx playwright-core install chromium`",
    ).toBe(true);

    const launchSpy = vi.spyOn(chromium, "launch");
    let raw: Browser | undefined;
    try {
      // Launch through the production factory; the spy calls through to the real launch.
      const browser = await new PlaywrightChromiumFactory().launch();
      expect(launchSpy).toHaveBeenCalledTimes(1);
      expect(launchSpy.mock.calls[0][0]).toMatchObject({ headless: true });
      raw = await (launchSpy.mock.results[0].value as Promise<Browser>);
      expect(raw.browserType().name()).toBe("chromium");
      expect(raw.isConnected()).toBe(true);

      // Fresh non-persistent context with service workers blocked and downloads refused.
      const newContextSpy = vi.spyOn(raw, "newContext");
      const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
      expect(newContextSpy).toHaveBeenCalledTimes(1);
      expect(newContextSpy.mock.calls[0][0]).toEqual({ serviceWorkers: "block", acceptDownloads: false });
      expect(raw.contexts()).toHaveLength(1);
      const rawContext = raw.contexts()[0];
      // A persistent context has no owning Browser.
      expect(rawContext.browser()).toBe(raw);

      // Any network attempt is recorded and refused through the production route adapter.
      const requests: string[] = [];
      await context.route("**/*", async (route) => {
        requests.push(route.request().url());
        await route.abort("blockedbyclient");
      });

      // Exactly one page, loaded with provider-owned static HTML.
      const page = await context.newPage();
      expect(rawContext.pages()).toHaveLength(1);
      const rawPage = rawContext.pages()[0];
      await rawPage.setContent(SMOKE_HTML, { waitUntil: "load" });

      // Capture through the production page adapter with the canonical ARIA options.
      expect(await page.title()).toBe("S14G smoke");
      const controller = new AbortController();
      const snapshot = await page.ariaSnapshotJSON({
        mode: "default",
        boxes: false,
        depth: 10,
        signal: controller.signal,
        timeout: 0,
      });

      expect(JSON.stringify(snapshot).length).toBeGreaterThan(2);
      const nodes = flatten(snapshot);
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes).toContainEqual(expect.objectContaining({ role: "main" }));
      expect(nodes).toContainEqual(expect.objectContaining({ role: "heading", name: "Brain browser smoke", level: 1 }));
      expect(nodes).toContainEqual(expect.objectContaining({ role: "navigation", name: "Primary" }));
      expect(nodes).toContainEqual(expect.objectContaining({ role: "link", name: "Docs", url: "https://qa.example.com/docs" }));
      expect(nodes).toContainEqual(expect.objectContaining({ role: "list" }));
      expect(nodes.filter(n => n.role === "listitem").map(n => n.text)).toEqual(["Alpha", "Beta"]);
      expect(nodes).toContainEqual(expect.objectContaining({ role: "button", name: "Inert" }));
      expect(requests).toEqual([]);

      // Close page -> context -> browser through the production handles.
      await page.close();
      expect(rawPage.isClosed()).toBe(true);
      await context.close();
      expect(raw.contexts()).toHaveLength(0);
      await browser.close();
      expect(raw.isConnected()).toBe(false);
    } finally {
      launchSpy.mockRestore();
      // Only reached with a live browser if an assertion above already failed.
      if (raw?.isConnected()) await raw.close();
    }
  }, 30_000);
});
