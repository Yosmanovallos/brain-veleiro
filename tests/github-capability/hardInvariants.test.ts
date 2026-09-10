import { describe, expect, it } from "vitest";
import {
  assertBoundaries,
  assertNoNewDependency,
  assertPriorPhaseIdentity,
  closureClaims,
  forbiddenSurface,
  futurePhaseSurface,
  hiddenRetrySurface,
  inferredScope,
  originEscapeSurface,
  overclaims,
  partAIntact,
  phaseText,
  productionCode,
} from "./audit.js";
import { negatives, positives } from "./cases.js";

const invariants: Record<string, () => Promise<void>> = {
  "S14F-HI-001": positives["FX-POS-001"],
  "S14F-HI-002": async () => assertPriorPhaseIdentity(),
  "S14F-HI-003": positives["FX-POS-001"],
  "S14F-HI-004": negatives["FX-NEG-001"],
  "S14F-HI-005": negatives["FX-NEG-003"],
  "S14F-HI-006": positives["FX-POS-002"],
  "S14F-HI-007": negatives["FX-NEG-006"],
  "S14F-HI-008": positives["FX-POS-008"],
  "S14F-HI-009": positives["FX-POS-008"],
  "S14F-HI-010": negatives["FX-NEG-004"],
  "S14F-HI-011": negatives["FX-NEG-023"],
  "S14F-HI-012": positives["FX-POS-002"],
  "S14F-HI-013": negatives["FX-NEG-016"],
  "S14F-HI-014": negatives["FX-NEG-018"],
  "S14F-HI-015": negatives["FX-NEG-019"],
  "S14F-HI-016": negatives["FX-NEG-023"],
  "S14F-HI-017": negatives["FX-NEG-014"],
  "S14F-HI-018": negatives["FX-NEG-013"],
  "S14F-HI-019": positives["FX-POS-004"],
  "S14F-HI-020": negatives["FX-NEG-007"],
  "S14F-HI-021": negatives["FX-NEG-008"],
  "S14F-HI-022": negatives["FX-NEG-012"],
  "S14F-HI-023": positives["FX-POS-004"],
  "S14F-HI-024": negatives["FX-NEG-005"],
  "S14F-HI-025": negatives["FX-NEG-021"],
  "S14F-HI-026": positives["FX-POS-010"],
  "S14F-HI-027": async () => {
    assertNoNewDependency();
    const code = productionCode();
    expect(forbiddenSurface(code)).toBe(0);
    expect(hiddenRetrySurface(code)).toBe(0);
    expect(inferredScope(code)).toBe(0);
    expect(originEscapeSurface(code)).toBe(0);
    expect(futurePhaseSurface(code)).toBe(0);
  },
  "S14F-HI-028": async () => {
    partAIntact();
    assertBoundaries();
    expect(closureClaims(phaseText())).toBe(0);
    expect(overclaims(phaseText())).toBe(0);
  },
};

describe("canonical hard invariants", () => {
  for (const [id, fn] of Object.entries(invariants)) {
    it(id, fn);
  }
});
