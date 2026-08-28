import { describe, expect, it } from "vitest";
import { extractGuardrailsSecurityAssertionObservations } from "../../src/intelligence/guardrails-security/compareGuardrailsSecurityRuns.js";
import { DIMENSION_OBSERVATION_IDS, OBSERVATION_ATOMIC_MUTATIONS, OBSERVATION_ISOLATION_DECISION } from "./observationIsolationFixtures.js";

describe("S13L exhaustive atomic observation isolation T100-T105", () => {
  it.each(DIMENSION_OBSERVATION_IDS)("%s changes exactly its owned detached observation", (id) => {
    const candidate = structuredClone(OBSERVATION_ISOLATION_DECISION); const before = extractGuardrailsSecurityAssertionObservations(candidate); const detachedSnapshot = JSON.stringify(before);
    OBSERVATION_ATOMIC_MUTATIONS[id](candidate); expect(JSON.stringify(before)).toBe(detachedSnapshot); const after = extractGuardrailsSecurityAssertionObservations(candidate);
    const changed = [...DIMENSION_OBSERVATION_IDS, "XC-A"].filter((candidateId) => JSON.stringify(before[candidateId]) !== JSON.stringify(after[candidateId])); expect(changed).toEqual([id]);
  });
});
