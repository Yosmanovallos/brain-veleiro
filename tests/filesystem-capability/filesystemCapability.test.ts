import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { positives, negatives, setup } from "./cases.js";
import { text, assertBoundaries, registryPatchOnly, closureClaims, phaseText } from "./audit.js";

const quality = load(text("brain-bootstrap/quality-contracts/S14B_FILESYSTEM_DEEP.yaml")) as { positive_fixtures: { id: string }[]; negative_fixtures: { id: string }[]; hard_invariants: { id: string }[]; unsafe_counters: { id: string }[] };
const invariants: Record<string, () => Promise<void>> = {
  "S14B-HI-001": () => setup(async p => { expect((await p.list_capabilities()).map(d => d.capability_id).sort()).toEqual(["filesystem.list", "filesystem.read", "filesystem.write"]); }),
  "S14B-HI-002": positives["FX-POS-009"],
  "S14B-HI-003": negatives["FX-NEG-033"],
  "S14B-HI-004": negatives["FX-NEG-001"],
  "S14B-HI-005": async () => { for (let i = 1; i <= 8; i++) await negatives[`FX-NEG-${String(i).padStart(3, "0")}`](); },
  "S14B-HI-006": async () => { await negatives["FX-NEG-009"](); await negatives["FX-NEG-010"](); },
  "S14B-HI-007": negatives["FX-NEG-010"],
  "S14B-HI-008": async () => { await negatives["FX-NEG-011"](); await negatives["FX-NEG-012"](); },
  "S14B-HI-009": async () => { await negatives["FX-NEG-013"](); await negatives["FX-NEG-014"](); },
  "S14B-HI-010": negatives["FX-NEG-015"],
  "S14B-HI-011": negatives["FX-NEG-013"],
  "S14B-HI-012": async () => { await positives["FX-POS-002"](); await negatives["FX-NEG-017"](); await negatives["FX-NEG-024"](); await negatives["FX-NEG-027"](); },
  "S14B-HI-013": async () => { await positives["FX-POS-001"](); await negatives["FX-NEG-026"](); },
  "S14B-HI-014": async () => { await positives["FX-POS-013"](); await negatives["FX-NEG-025"](); },
  "S14B-HI-015": negatives["FX-NEG-020"],
  "S14B-HI-016": negatives["FX-NEG-022"],
  "S14B-HI-017": negatives["FX-NEG-023"],
  "S14B-HI-018": async () => { const { ordinaryWriteFailure } = await import("./failureExercises.js"); await ordinaryWriteFailure(); },
  "S14B-HI-019": async () => { const { precommitTimeout } = await import("./failureExercises.js"); await precommitTimeout(); },
  "S14B-HI-020": async () => { await negatives["FX-NEG-028"](); await negatives["FX-NEG-029"](); },
  "S14B-HI-021": negatives["FX-NEG-032"],
  "S14B-HI-022": positives["FX-POS-005"],
  "S14B-HI-023": positives["FX-POS-007"],
  "S14B-HI-024": positives["FX-POS-008"],
  "S14B-HI-025": negatives["FX-NEG-030"],
  "S14B-HI-026": negatives["FX-NEG-031"],
  "S14B-HI-027": positives["FX-POS-009"],
  "S14B-HI-028": positives["FX-POS-011"],
  "S14B-HI-029": negatives["FX-NEG-032"],
  "S14B-HI-030": async () => { const { committedDeadline } = await import("./failureExercises.js"); await committedDeadline(); },
  "S14B-HI-031": async () => { const { exactBounds } = await import("./failureExercises.js"); await exactBounds(); },
  "S14B-HI-032": async () => { registryPatchOnly(); },
  "S14B-HI-033": async () => { assertBoundaries(); },
  "S14B-HI-034": async () => { assertBoundaries(); },
  "S14B-HI-035": negatives["FX-NEG-035"],
  "S14B-HI-036": async () => { expect(closureClaims(phaseText())).toBe(0); },
};

it("parses and matches exact authorized inventories", () => {
  expect(Object.keys(positives)).toEqual(quality.positive_fixtures.map(f => f.id));
  expect(Object.keys(negatives)).toEqual(quality.negative_fixtures.map(f => f.id));
  expect(Object.keys(invariants)).toEqual(quality.hard_invariants.map(f => f.id));
  expect(Object.keys(positives)).toHaveLength(14); expect(Object.keys(negatives)).toHaveLength(36); expect(Object.keys(invariants)).toHaveLength(36);
  expect(quality.unsafe_counters.map(f => f.id)).toEqual(Array.from({ length: 12 }, (_, i) => `UC${String(i + 1).padStart(2, "0")}`));
});
for (const [label, cases] of [["canonical positives", positives], ["canonical negatives", negatives], ["canonical invariants", invariants]] as const) {
  describe(label, () => { for (const [id, exercise] of Object.entries(cases)) it(id, exercise, 30000); });
}
