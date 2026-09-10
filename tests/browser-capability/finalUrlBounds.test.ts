import { describe, expect, it } from "vitest";
import { failCode, harness, output, request } from "./helpers.js";

/**
 * SR-G-001 — the final main-frame URL returned in SUCCESS must be an absolute
 * HTTPS URL with no userinfo, an exact allowed navigation origin, and at most
 * 2048 UTF-8 bytes (contract §14). Each case is a same-origin redirect: the
 * fake seam approves the requested URL in routing, then lands on `redirectTo`.
 */

const START = "https://qa.example.com/";
const FINAL_URL_BYTES = 2048;

const inspectRedirect = async (redirectTo: string) => {
  const h = harness();
  h.factory.onNewPage = (page) => {
    // Link-free snapshot so link resolution against the final URL cannot interfere.
    page.setPage("Redirected", [{ role: "document", name: "Redirected" }]);
    page.redirectTo = redirectTo;
  };
  const result = await h.provider.invoke(request({ url: START }));
  return { h, result };
};

describe("SR-G-001 final_url bounds", () => {
  it("SR-G-001-01: a same-origin final URL of exactly 2048 UTF-8 bytes succeeds", async () => {
    const finalUrl = START + "a".repeat(FINAL_URL_BYTES - START.length);
    expect(Buffer.byteLength(finalUrl, "utf-8")).toBe(FINAL_URL_BYTES);

    const { result } = await inspectRedirect(finalUrl);
    const observed = output(result);
    expect(observed.final_url).toBe(finalUrl);
    expect(Buffer.byteLength(observed.final_url, "utf-8")).toBe(FINAL_URL_BYTES);
  });

  it("SR-G-001-02: a same-origin final URL over 2048 UTF-8 bytes fails and is not returned", async () => {
    const asciiOver = START + "b".repeat(FINAL_URL_BYTES - START.length + 1);
    // Fewer than 2048 UTF-16 code units but more than 2048 UTF-8 bytes.
    const multibyteOver = START + "é".repeat(Math.ceil((FINAL_URL_BYTES - START.length + 1) / 2));
    expect(Buffer.byteLength(asciiOver, "utf-8")).toBe(FINAL_URL_BYTES + 1);
    expect(multibyteOver.length).toBeLessThan(FINAL_URL_BYTES);
    expect(Buffer.byteLength(multibyteOver, "utf-8")).toBeGreaterThan(FINAL_URL_BYTES);

    for (const [finalUrl, marker] of [
      [asciiOver, "bbbbbbbb"],
      [multibyteOver, "éééééééé"],
    ] as const) {
      const { h, result } = await inspectRedirect(finalUrl);
      failCode(result, "EXECUTION_FAILED", false);
      expect(result.status).not.toBe("SUCCESS");
      expect(JSON.stringify(result)).not.toContain(marker);
      expect(h.factory.browserCloseCount).toBe(1);
    }
  });

  it("SR-G-001-03: a same-origin final URL carrying userinfo fails and leaks no credentials", async () => {
    for (const finalUrl of [
      "https://qa-user:qa-secret-pw@qa.example.com/private-path",
      "https://qa-user@qa.example.com/private-path",
      "https://:qa-secret-pw@qa.example.com/private-path",
    ]) {
      const { h, result } = await inspectRedirect(finalUrl);
      failCode(result, "PERMISSION_DENIED", false);
      expect(result.status).not.toBe("SUCCESS");
      const serialized = JSON.stringify(result);
      for (const leak of ["qa-user", "qa-secret-pw", "private-path", "@qa.example.com"]) {
        expect(serialized).not.toContain(leak);
      }
      expect(h.factory.browserCloseCount).toBe(1);
    }
  });

  it("SR-G-001-04: a non-HTTPS final URL on the same host fails as a policy denial", async () => {
    const { result } = await inspectRedirect("http://qa.example.com/plain");
    failCode(result, "PERMISSION_DENIED", false);
    expect(JSON.stringify(result)).not.toContain("/plain");
  });
});
