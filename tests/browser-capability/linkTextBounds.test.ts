import { describe, expect, it } from "vitest";
import { harness, output, request } from "./helpers.js";

/**
 * SR-G-002 — each normalized link carries text of at most 512 UTF-8 bytes and
 * an absolute HTTPS URL of at most 2048 UTF-8 bytes (contract §13). A link that
 * violates either bound is not a normalized link: it is excluded whole (never
 * text-truncated) and does not count toward `links_truncated`, which reports
 * only that more normalized links existed than `max_links`.
 */

const START = "https://qa.example.com/";
const LINK_TEXT_BYTES = 512;
const LINK_URL_BYTES = 2048;

const bytes = (value: string): number => Buffer.byteLength(value, "utf-8");

const inspectLinks = async (links: Array<{ text: string; url: string }>, max_links = 10) => {
  // Snapshot room for the oversized fixtures so only the link bound is exercised.
  const h = harness({ config: { max_links, max_snapshot_bytes: 16384 } });
  h.factory.onNewPage = (page) => {
    page.setPage("Links", [
      { role: "document", name: "Links", children: links.map(l => ({ role: "link", name: l.text, url: l.url })) },
    ]);
  };
  return output(await h.provider.invoke(request({ url: START })));
};

describe("SR-G-002 link text and URL bounds", () => {
  it("SR-G-002-01: link text of exactly 512 UTF-8 bytes is returned unmodified", async () => {
    const ascii = "t".repeat(LINK_TEXT_BYTES);
    const multibyte = "é".repeat(LINK_TEXT_BYTES / 2);
    expect(bytes(ascii)).toBe(LINK_TEXT_BYTES);
    expect(bytes(multibyte)).toBe(LINK_TEXT_BYTES);

    const observed = await inspectLinks([
      { text: ascii, url: "/ascii" },
      { text: multibyte, url: "/multibyte" },
    ]);
    expect(observed.links).toEqual([
      { text: ascii, url: "https://qa.example.com/ascii" },
      { text: multibyte, url: "https://qa.example.com/multibyte" },
    ]);
    expect(observed.links_truncated).toBe(false);
  });

  it("SR-G-002-02: link text over 512 UTF-8 bytes excludes the whole link and is never truncated", async () => {
    const asciiOver = "x".repeat(LINK_TEXT_BYTES + 1);
    // Fewer than 512 UTF-16 code units but 513 UTF-8 bytes.
    const multibyteOver = "y" + "é".repeat(LINK_TEXT_BYTES / 2);
    // Within the former 1024-byte title bound, so it pins the dedicated link bound.
    const titleSized = "z".repeat(1024);
    expect(bytes(asciiOver)).toBe(LINK_TEXT_BYTES + 1);
    expect(multibyteOver.length).toBeLessThan(LINK_TEXT_BYTES);
    expect(bytes(multibyteOver)).toBe(LINK_TEXT_BYTES + 1);

    const observed = await inspectLinks([
      { text: "Before", url: "/before" },
      { text: asciiOver, url: "/ascii-over" },
      { text: multibyteOver, url: "/multibyte-over" },
      { text: titleSized, url: "/title-sized" },
      { text: "After", url: "/after" },
    ]);
    expect(observed.links).toEqual([
      { text: "Before", url: "https://qa.example.com/before" },
      { text: "After", url: "https://qa.example.com/after" },
    ]);
    expect(observed.links_truncated).toBe(false);
    const serializedLinks = JSON.stringify(observed.links);
    for (const marker of ["xxxxxxxx", "yé", "zzzzzzzz", "-over", "title-sized"]) {
      expect(serializedLinks).not.toContain(marker);
    }
  });

  it("SR-G-002-03: link URLs remain bounded at 2048 UTF-8 bytes and HTTPS-only", async () => {
    const atBound = START + "a".repeat(LINK_URL_BYTES - START.length);
    const overBound = START + "b".repeat(LINK_URL_BYTES - START.length + 1);
    expect(bytes(atBound)).toBe(LINK_URL_BYTES);
    expect(bytes(overBound)).toBe(LINK_URL_BYTES + 1);

    const observed = await inspectLinks([
      { text: "At bound", url: atBound },
      { text: "Over bound", url: overBound },
      { text: "Plain", url: "http://qa.example.com/plain" },
    ]);
    expect(observed.links).toEqual([{ text: "At bound", url: atBound }]);
    expect(observed.links_truncated).toBe(false);
  });

  it("SR-G-002-04: excluded links do not count toward max_links or links_truncated", async () => {
    const over = "o".repeat(LINK_TEXT_BYTES + 1);

    const excludedOnly = await inspectLinks([
      { text: over, url: "/over" },
      { text: "Kept", url: "/kept" },
    ], 1);
    expect(excludedOnly.links).toEqual([{ text: "Kept", url: "https://qa.example.com/kept" }]);
    expect(excludedOnly.links_truncated).toBe(false);

    const moreNormalized = await inspectLinks([
      { text: "One", url: "/one" },
      { text: over, url: "/over" },
      { text: "Two", url: "/two" },
    ], 1);
    expect(moreNormalized.links).toEqual([{ text: "One", url: "https://qa.example.com/one" }]);
    expect(moreNormalized.links_truncated).toBe(true);
  });
});
