import { describe, it } from "vitest";
import {
  assertBoundaries,
  assertNoNewDependency,
  assertPriorPhaseIdentity,
  partAIntact,
} from "./audit.js";

describe("S14F regression surface", () => {
  it("the Part B candidate surface is exactly additive under the authorized prefixes", () => {
    partAIntact();
    assertBoundaries();
  });

  it("no new dependency or protected prior-phase surface was modified", () => {
    assertNoNewDependency();
    assertPriorPhaseIdentity();
  });
});
