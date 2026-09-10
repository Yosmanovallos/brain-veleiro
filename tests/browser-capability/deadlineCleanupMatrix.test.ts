import { getEventListeners } from "node:events";
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolInvocationResult } from "../../src/core/agent/index.js";
import { BrowserInspectCapabilityProvider } from "../../src/providers/capability/browser/index.js";
import { baseConfig, failCode, harness, output, request } from "./helpers.js";
import { MATRIX_TITLE, MATRIX_URL, ScriptedBrowserFactory, type Settle, type Step } from "./deadlineDoubles.js";

/**
 * SR-G-004 — contract §16/§17 deadline and cleanup matrix. One monotonic
 * invocation deadline bounds launch, navigation, title/snapshot and cleanup;
 * each case drives the provider through the scripted fake seam with an
 * operation that never settles, or settles only after the deadline expired.
 */

const BUDGET = 150;
/** Late settlements land well after the deadline but before the test's drain. */
const LATE = BUDGET + 250;
/** Scheduling slack for a loaded host; still below a second full budget. */
const SLACK = 140;

const SETUP: Step[] = ["launch", "newContext", "newPage", "route", "routeWebSocket"];
const CLEANUP: Step[] = ["close:page", "close:context", "close:browser"];

const invokeWith = async (script: Partial<Record<Step, Settle>>, budget = BUDGET) => {
  const factory = new ScriptedBrowserFactory(script);
  const provider = new BrowserInspectCapabilityProvider(baseConfig({ max_timeout_ms: budget }), { browserFactory: factory });
  const started = performance.now();
  const result = await provider.invoke(request({ url: MATRIX_URL }, budget));
  return { factory, result, elapsed: performance.now() - started };
};

const expectTimeout = (result: ToolInvocationResult): void => {
  failCode(result, "TIMEOUT", true);
  expect(result).not.toHaveProperty("output");
  expect(result).not.toHaveProperty("evidence_refs");
  expect(JSON.stringify(result)).not.toContain(MATRIX_TITLE);
};

/** The one invocation signal is shared, aborted by disposal, and holds no provider listener. */
const expectOneDisposedSignal = (factory: ScriptedBrowserFactory): void => {
  expect(factory.signals.length).toBeGreaterThan(0);
  const [signal] = factory.signals;
  expect(factory.signals.every(s => s === signal)).toBe(true);
  expect(signal.aborted).toBe(true);
  expect(getEventListeners(signal, "abort")).toHaveLength(0);
};

/** Let every scheduled late settlement run, then drain pending microtasks. */
const drainLateWork = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, LATE + 50));
  await new Promise(resolve => setImmediate(resolve));
};

let unhandled: unknown[] = [];
const onUnhandled = (reason: unknown): void => void unhandled.push(reason);

beforeEach(() => {
  unhandled = [];
  process.on("unhandledRejection", onUnhandled);
});

afterEach(() => {
  process.off("unhandledRejection", onUnhandled);
});

describe("SR-G-004 deadline and cleanup matrix", () => {
  it("SR-G-004-01: control — scripted doubles succeed and clean up page -> context -> browser", async () => {
    const { factory, result } = await invokeWith({});
    expect(output(result).title).toBe(MATRIX_TITLE);
    expect(factory.log).toEqual([...SETUP, "goto", "title", "snapshot", ...CLEANUP]);
    expectOneDisposedSignal(factory);
  });

  const hangs: Array<{ label: string; step: Step; log: Step[] }> = [
    { label: "browser launch", step: "launch", log: ["launch"] },
    { label: "navigation", step: "goto", log: [...SETUP, "goto", ...CLEANUP] },
    { label: "title extraction", step: "title", log: [...SETUP, "goto", "title", ...CLEANUP] },
    { label: "ARIA snapshot extraction", step: "snapshot", log: [...SETUP, "goto", "title", "snapshot", ...CLEANUP] },
  ];

  for (const { label, step, log } of hangs) {
    it(`SR-G-004-02-${step}: ${label} that never settles fails TIMEOUT at the one deadline and cleans up`, async () => {
      const { factory, result, elapsed } = await invokeWith({ [step]: "never" });
      expectTimeout(result);
      expect(elapsed).toBeLessThan(BUDGET + SLACK);
      expect(factory.log).toEqual(log);
      if (step !== "launch") expectOneDisposedSignal(factory);
    });
  }

  for (const step of ["launch", "goto", "title", "snapshot"] as const) {
    for (const outcome of ["resolve", "reject"] as const) {
      it(`SR-G-004-03-${step}-${outcome}: late ${step} completion (${outcome}) after the deadline cannot mutate the result or resurrect work`, async () => {
        const { factory, result, elapsed } = await invokeWith({ [step]: { after_ms: LATE, outcome } });
        expectTimeout(result);
        // The provider returned at the deadline, not when the late work settled.
        expect(elapsed).toBeLessThan(LATE);
        const marker = `${step}:${outcome === "resolve" ? "settled" : "rejected"}`;
        expect(factory.log).not.toContain(marker);

        const frozen = structuredClone(result);
        const atReturn = [...factory.log];
        await drainLateWork();

        expect(result).toEqual(frozen);
        expect(unhandled).toEqual([]);
        if (step === "launch" && outcome === "resolve") {
          // A browser that arrives after the deadline is closed and never used.
          expect(factory.log).toEqual([...atReturn, marker, "close:browser"]);
          expect(factory.log).not.toContain("newContext");
        } else {
          expect(factory.log).toEqual([...atReturn, marker]);
        }
      });
    }
  }

  for (const closing of CLEANUP) {
    it(`SR-G-004-04-${closing}-success: ${closing} that never settles is bounded and later closes still run`, async () => {
      const { factory, result, elapsed } = await invokeWith({ [closing]: "never" });
      // The observation and final success gate completed before cleanup began;
      // a hung close is bounded by the same deadline and cannot alter the result.
      expect(output(result).title).toBe(MATRIX_TITLE);
      expect(elapsed).toBeLessThan(BUDGET + SLACK);
      expect(factory.log).toEqual([...SETUP, "goto", "title", "snapshot", ...CLEANUP]);
      expectOneDisposedSignal(factory);
    });

    it(`SR-G-004-04-${closing}-timeout: ${closing} that never settles after a navigation timeout stays TIMEOUT and later closes still run`, async () => {
      const { factory, result, elapsed } = await invokeWith({ goto: "never", [closing]: "never" });
      expectTimeout(result);
      expect(elapsed).toBeLessThan(BUDGET + SLACK);
      expect(factory.log).toEqual([...SETUP, "goto", ...CLEANUP]);
      expectOneDisposedSignal(factory);
    });
  }

  it("SR-G-004-05: every close hanging at once is still bounded by the one deadline", async () => {
    const { factory, result, elapsed } = await invokeWith({ "close:page": "never", "close:context": "never", "close:browser": "never" });
    expect(output(result).title).toBe(MATRIX_TITLE);
    expect(elapsed).toBeLessThan(BUDGET + SLACK);
    expect(factory.log).toEqual([...SETUP, "goto", "title", "snapshot", ...CLEANUP]);
  });

  it("SR-G-004-06: the budget is one monotonic deadline — time spent in an earlier step is not refunded", async () => {
    const budget = 300;
    // Navigation consumes 60% of the budget, then the title hangs. One deadline
    // expires at ~300ms; a per-step or resettable budget would run to >= 480ms.
    const { factory, result, elapsed } = await invokeWith(
      { goto: { after_ms: budget * 0.6, outcome: "resolve" }, title: "never" },
      budget,
    );
    expectTimeout(result);
    expect(elapsed).toBeLessThan(budget * 1.5);
    expect(factory.log).toEqual([...SETUP, "goto", "goto:settled", "title", ...CLEANUP]);
    expectOneDisposedSignal(factory);
  });

  for (const [engineError, code, retryable] of [
    ["net::ERR_ABORTED", "PERMISSION_DENIED", false],
    ["net::ERR_NAME_NOT_RESOLVED", "UNAVAILABLE", true],
  ] as const) {
    it(`SR-G-004-07: an in-budget navigation rejection (${engineError}) passes through the deadline race to ${code}`, async () => {
      const h = harness();
      h.factory.onNewPage = (page) => {
        page.failOnGoto = new Error(engineError);
      };
      failCode(await h.provider.invoke(request({ url: MATRIX_URL })), code, retryable);
      expect(h.factory.pageCloseCount).toBe(1);
      expect(h.factory.contextCloseCount).toBe(1);
      expect(h.factory.browserCloseCount).toBe(1);
    });
  }
});
