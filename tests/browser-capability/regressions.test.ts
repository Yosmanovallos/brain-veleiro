import { describe, expect, it } from "vitest";
import { positives, negatives } from "./cases.js";
import { assertBoundaries, assertNoNewDependency, assertPriorPhaseIdentity, productionCode } from "./audit.js";
import { forbiddenSurface, futurePhaseSurface, hiddenRetrySurface, inferredScope, originEscapeSurface } from "./audit.js";

/**
 * S14G regression tests.
 *
 * These are the long-horizon fences: they do not exercise a single behavior but
 * guard the narrow, additive Part-B surface against the most expensive kind of
 * regression — drift outside the authorized scope, unexpected dependencies, or
 * the re-introduction of forbidden interaction/escape surfaces.
 */

describe("S14G regressions", () => {
  it("RG-G-01: all positive fixtures still pass", async () => {
    for (const [id, fn] of Object.entries(positives)) {
      await expect(fn()).resolves.not.toThrow();
    }
  });

  it("RG-G-02: all negative fixtures still fail in the expected direction", async () => {
    for (const [id, fn] of Object.entries(negatives)) {
      await expect(fn()).resolves.not.toThrow();
    }
  });

  it("RG-G-03: no forbidden interaction, retry, inferred, origin-escape or future-phase surface has drifted into production", () => {
    expect(forbiddenSurface()).toBe(0);
    expect(hiddenRetrySurface(productionCode())).toBe(0);
    expect(inferredScope(productionCode())).toBe(0);
    expect(originEscapeSurface(productionCode())).toBe(0);
    expect(futurePhaseSurface(productionCode())).toBe(0);
  });

  it("RG-G-04: authorized boundary, dependency and prior-phase identity are intact", () => {
    assertBoundaries();
    assertNoNewDependency();
    assertPriorPhaseIdentity();
  });
});
