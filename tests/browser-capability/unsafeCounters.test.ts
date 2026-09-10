import { describe, expect, it } from "vitest";
import { positives, negatives } from "./cases.js";
import { harness } from "./helpers.js";
import type { ToolInvocationRequest } from "../../src/core/agent/types.js";
import {
  forbiddenConfigSurface,
  forbiddenSurface,
  futurePhaseSurface,
  hiddenRetrySurface,
  inferredScope,
  originEscapeSurface,
  overclaims,
  phaseText,
  productionCode,
  productionSources,
  closureClaims,
} from "./audit.js";

/**
 * S14G unsafe counters.
 *
 * Each test below asserts that a source-level guard is currently at zero on
 * production code, and that it is independently fireable by an injected signal.
 */

describe("S14G unsafe counters", () => {
  it("UC-G-01: origin escape surface is zero and fires on injected transport / proxy / redirect hints", () => {
    expect(originEscapeSurface(productionCode())).toBe(0);
    const injected =
      productionCode() +
      "\nconst client = { baseURL: 'https://evil/', followRedirects: 10, proxy: 'http://evil', rejectUnauthorized: false };";
    expect(originEscapeSurface(injected)).toBeGreaterThan(0);
  });

  it("UC-G-02: inferred scope is zero and fires on injected credential / environment discovery", () => {
    expect(inferredScope(productionCode())).toBe(0);
    const injected = productionCode() + "\nconst token = process.env.GITHUB_TOKEN || homedir() + '/.netrc';";
    expect(inferredScope(injected)).toBeGreaterThan(0);
  });

  it("UC-G-03: forbidden interaction surface is zero and fires on injected Playwright / eval / raw dependency hints", () => {
    expect(forbiddenSurface()).toBe(0);
    const injected =
      productionCode() +
      "\nawait page.evaluate(() => document.cookie); await page.screenshot({ path: 'x.png' }); import { exec } from 'node:child_process';";
    expect(forbiddenSurface(injected)).toBeGreaterThan(0);
  });

  it("UC-G-04: forbidden config surface is zero and fires when extra config keys are added", () => {
    expect(forbiddenConfigSurface()).toEqual([]);
    const tampered = productionSources().replace(
      /(export\s+interface\s+BrowserInspectProviderConfig\s*\{[\s\S]*?max_links:\s*number;)/,
      "$1\n  proxy: string;\n  headless: boolean;",
    );
    const bad = forbiddenConfigSurface(tampered);
    expect(bad).toContain("proxy");
    expect(bad).toContain("headless");
  });

  it("UC-G-05: hidden retry surface is zero and fires on injected retry loop", () => {
    expect(hiddenRetrySurface(productionCode())).toBe(0);
    const injected =
      productionCode() +
      "\nfor (let attempt = 0; attempt < 5; attempt++) { try { await fn(); } catch { await backoff(); } }";
    expect(hiddenRetrySurface(injected)).toBeGreaterThan(0);
  });

  it("UC-G-06: future-phase surface is zero and fires on injected future phase ids", () => {
    expect(futurePhaseSurface(productionCode())).toBe(0);
    const injected =
      productionCode() + "\nconst x = 'browser.navigate'; const y = 'mcp.call'; const z = 'database.query';";
    expect(futurePhaseSurface(injected)).toBeGreaterThan(0);
  });

  it("UC-G-07: overclaim / closure language is zero and fires on injected awards", () => {
    const text = phaseText();
    expect(overclaims(text)).toBe(0);
    expect(closureClaims(text)).toBe(0);
    const injected =
      text +
      "\ncomplete DLP, exactly-once, guaranteed delivery.\nS14: CLOSED / HI-054: AWARDED";
    expect(overclaims(injected)).toBeGreaterThan(0);
    expect(closureClaims(injected)).toBeGreaterThan(0);
  });

  it("UC-G-08: popups are counted and closed", negatives["FX-NEG-021"]);

  it("UC-G-09: downloads are counted and cancelled", negatives["FX-NEG-020"]);

  it("UC-G-10: WebSocket route is closed without data exchange", async () => {
    const h = harness();
    h.factory.onNewPage = (page) => {
      page.setPage("Socket", { role: "document", name: "socket" });
      page.wsOnContinue = ["wss://qa.example.com/socket"];
    };
    const result = await h.provider.invoke({
      run_id: "run-uc10",
      turn: 0,
      call_id: "uc10",
      capability_id: "browser.inspect",
      input: { url: "https://qa.example.com/" },
      timeout_ms: 5000,
    } as unknown as ToolInvocationRequest);
    expect(result.status).toBe("SUCCESS");
    const ctx = h.factory.browsers[0]?.contexts[0];
    expect(ctx?.wsConnections.length).toBeGreaterThanOrEqual(1);
    expect(ctx?.wsConnections[0]?.closed).toBe(true);
    expect(ctx?.wsConnections[0]?.messages).toHaveLength(0);
  });
});
