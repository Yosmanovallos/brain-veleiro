/**
 * Canonical S14A fixture id registry.
 *
 * brain-bootstrap/quality-contracts/S14_CAPABILITY_REGISTRY_TOOLS_MCP_DEEP.yaml
 * requires exactly 12 positive and exactly 28 negative fixtures, by exact id.
 * Every `it()` in capabilityRegistry.test.ts and staticAndBoundaryAudit.test.ts
 * that exercises one of these calls markPositive/markNegative with its id;
 * a final assertion in capabilityRegistry.test.ts proves the executed id set
 * equals this canonical set exactly (not merely the same count).
 */

export const POSITIVE_FIXTURE_IDS = [
  "FX-POS-001",
  "FX-POS-002",
  "FX-POS-003",
  "FX-POS-004",
  "FX-POS-005",
  "FX-POS-006",
  "FX-POS-007",
  "FX-POS-008",
  "FX-POS-009",
  "FX-POS-010",
  "FX-POS-011",
  "FX-POS-012",
] as const;

export const NEGATIVE_FIXTURE_IDS = [
  "FX-NEG-001",
  "FX-NEG-002",
  "FX-NEG-003",
  "FX-NEG-004",
  "FX-NEG-005",
  "FX-NEG-006",
  "FX-NEG-007",
  "FX-NEG-008",
  "FX-NEG-009",
  "FX-NEG-010",
  "FX-NEG-011",
  "FX-NEG-012",
  "FX-NEG-013",
  "FX-NEG-014",
  "FX-NEG-015",
  "FX-NEG-016",
  "FX-NEG-017",
  "FX-NEG-018",
  "FX-NEG-019",
  "FX-NEG-020",
  "FX-NEG-021",
  "FX-NEG-022",
  "FX-NEG-023",
  "FX-NEG-024",
  "FX-NEG-025",
  "FX-NEG-026",
  "FX-NEG-027",
  "FX-NEG-028",
] as const;

export type PositiveFixtureId = (typeof POSITIVE_FIXTURE_IDS)[number];
export type NegativeFixtureId = (typeof NEGATIVE_FIXTURE_IDS)[number];

const exercisedPositive = new Set<PositiveFixtureId>();
const exercisedNegative = new Set<NegativeFixtureId>();

export function markPositive(id: PositiveFixtureId): void {
  exercisedPositive.add(id);
}

export function markNegative(id: NegativeFixtureId): void {
  exercisedNegative.add(id);
}

export function exercisedPositiveIds(): PositiveFixtureId[] {
  return [...exercisedPositive].sort();
}

export function exercisedNegativeIds(): NegativeFixtureId[] {
  return [...exercisedNegative].sort();
}
