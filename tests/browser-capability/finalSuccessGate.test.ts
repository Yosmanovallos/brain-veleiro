import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { FakePageHandle, SAFE_MESSAGES, failCode, harness, output, request } from "./helpers.js";
import type { ToolInvocationResult } from "../../src/core/agent/index.js";

/**
 * SR-G-003 — SUCCESS is returned only if, immediately before returning, the one
 * monotonic invocation deadline has not expired and no popup or download has
 * been observed (contract §16 "final success check"). Each case lets navigation
 * succeed and the post-navigation checks pass, then produces the event late,
 * during title or ARIA snapshot extraction, through the deterministic fake seam.
 */

const START = "https://qa.example.com/";
const TITLE = "Late event page";

const setup = (config: Parameters<typeof harness>[0] = {}) => {
  const h = harness(config);
  const pages: FakePageHandle[] = [];
  h.factory.onNewPage = (page) => {
    page.setPage(TITLE, [{ role: "document", name: "Late", children: [{ role: "link", name: "Home", url: "/" }] }]);
    pages.push(page);
  };
  return { h, pages };
};

const emitPopup = async (page: FakePageHandle): Promise<void> => {
  const popup = new FakePageHandle(page.context);
  popup.setUrl("https://qa.example.com/popup");
  await page.context.emitPage(popup);
};

const expectNoObservation = (result: ToolInvocationResult): void => {
  expect(result.status).toBe("FAIL");
  expect(result).not.toHaveProperty("output");
  expect(result).not.toHaveProperty("evidence_refs");
  expect(JSON.stringify(result)).not.toContain(TITLE);
};

describe("SR-G-003 final success gate", () => {
  it("SR-G-003-01: control — the late-event hooks alone do not prevent SUCCESS", async () => {
    const { h, pages } = setup();
    const reached: string[] = [];
    const onPage = h.factory.onNewPage!;
    h.factory.onNewPage = (page) => {
      onPage(page);
      page.beforeTitle = () => void reached.push("title");
      page.beforeSnapshot = () => void reached.push("snapshot");
    };
    const observed = output(await h.provider.invoke(request({ url: START })));
    expect(observed.title).toBe(TITLE);
    expect(reached).toEqual(["title", "snapshot"]);
    expect(pages).toHaveLength(1);
  });

  it("SR-G-003-02: deadline aborting during snapshot extraction fails TIMEOUT even if the snapshot resolves", async () => {
    const { h } = setup({ config: { max_timeout_ms: 100 } });
    let abortedAtSnapshotEntry: boolean | undefined;
    const onPage = h.factory.onNewPage!;
    h.factory.onNewPage = (page) => {
      onPage(page);
      page.beforeSnapshot = (options) => {
        abortedAtSnapshotEntry = options.signal.aborted;
      };
      // Models an extraction that completes successfully despite the abort.
      page.snapshotResolvesAfterAbort = true;
    };

    const result = await h.provider.invoke(request({ url: START }, 100));
    // Navigation and title succeeded inside the budget; expiry happened late.
    expect(abortedAtSnapshotEntry).toBe(false);
    failCode(result, "TIMEOUT", true);
    expectNoObservation(result);
  });

  it("SR-G-003-03: deadline elapsing on the monotonic clock before the abort timer fires still fails TIMEOUT", async () => {
    const budget = 50;
    const { h } = setup({ config: { max_timeout_ms: budget } });
    let abortedAtSnapshotEntry: boolean | undefined;
    const onPage = h.factory.onNewPage!;
    h.factory.onNewPage = (page) => {
      onPage(page);
      page.beforeSnapshot = (options) => {
        abortedAtSnapshotEntry = options.signal.aborted;
        // Block the event loop past the whole budget: the one deadline has
        // elapsed by the clock while its abort timer has not yet run.
        const entered = performance.now();
        while (performance.now() - entered <= budget + 1) {
          // busy-wait
        }
      };
    };

    const result = await h.provider.invoke(request({ url: START }, budget));
    expect(abortedAtSnapshotEntry).toBe(false);
    failCode(result, "TIMEOUT", true);
    expectNoObservation(result);
  });

  for (const stage of ["title", "snapshot"] as const) {
    it(`SR-G-003-04-${stage}: a popup observed during ${stage} extraction fails PERMISSION_DENIED`, async () => {
      const { h, pages } = setup();
      const onPage = h.factory.onNewPage!;
      h.factory.onNewPage = (page) => {
        onPage(page);
        const hook = () => emitPopup(page);
        if (stage === "title") page.beforeTitle = hook;
        else page.beforeSnapshot = hook;
      };

      const result = await h.provider.invoke(request({ url: START }));
      expect(pages).toHaveLength(1);
      expect(h.factory.browsers[0].contexts[0].pages).toHaveLength(2);
      failCode(result, "PERMISSION_DENIED", false);
      if (result.status === "FAIL") expect(result.error.message).toBe(SAFE_MESSAGES.popupBlocked);
      expectNoObservation(result);
    });

    it(`SR-G-003-05-${stage}: a download observed during ${stage} extraction fails PERMISSION_DENIED`, async () => {
      const { h } = setup();
      const downloads: Array<ReturnType<FakePageHandle["emitDownload"]>> = [];
      const onPage = h.factory.onNewPage!;
      h.factory.onNewPage = (page) => {
        onPage(page);
        const hook = () => void downloads.push(page.emitDownload());
        if (stage === "title") page.beforeTitle = hook;
        else page.beforeSnapshot = hook;
      };

      const result = await h.provider.invoke(request({ url: START }));
      expect(downloads).toHaveLength(1);
      expect(downloads[0].cancelled).toBe(true);
      failCode(result, "PERMISSION_DENIED", false);
      if (result.status === "FAIL") expect(result.error.message).toBe(SAFE_MESSAGES.downloadBlocked);
      expectNoObservation(result);
    });
  }
});
