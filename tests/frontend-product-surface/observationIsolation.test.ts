import { describe, expect, it } from "vitest";
import { extractFrontendSurfaceAssertionObservations } from "../../src/intelligence/frontend-product-surface/compareFrontendProductSurfaceRuns.js";
import { DIMENSION_OBSERVATION_IDS, OBSERVATION_ATOMIC_MUTATIONS, OBSERVATION_ISOLATION_DECISION } from "./observationIsolationFixtures.js";

describe("S13K FAIL-1 exhaustive atomic observation isolation", () => {
  it.each(DIMENSION_OBSERVATION_IDS)("%s changes exactly its owned observation", (id) => {
    const candidate = structuredClone(OBSERVATION_ISOLATION_DECISION);
    const before = extractFrontendSurfaceAssertionObservations(candidate);
    const detachedSnapshot = JSON.stringify(before);
    OBSERVATION_ATOMIC_MUTATIONS[id](candidate);
    expect(JSON.stringify(before)).toBe(detachedSnapshot);
    const after = extractFrontendSurfaceAssertionObservations(candidate);
    const changed = [...DIMENSION_OBSERVATION_IDS, "XC-A"].filter((candidateId) => JSON.stringify(before[candidateId]) !== JSON.stringify(after[candidateId]));
    expect(changed).toEqual([id]);
  });
});
