import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { text } from "./audit.js";
import { invariants, regressions } from "./concurrencyExercises.js";

const clarification = load(text("brain-bootstrap/quality-contracts/S14B_WRITE_CONCURRENCY_CLARIFICATION_DEEP.yaml")) as {
  concurrency_invariants: { id: string }[];
  required_regressions: { id: string }[];
};

it("maps the canonical write-concurrency clarification inventories one-to-one", () => {
  expect(Object.keys(invariants)).toEqual(clarification.concurrency_invariants.map(i => i.id));
  expect(Object.keys(regressions)).toEqual(clarification.required_regressions.map(i => i.id));
  expect(Object.keys(invariants)).toHaveLength(12);
  expect(Object.keys(regressions)).toHaveLength(6);
  expect(Object.keys(regressions)).toEqual(["CONC-POS-001", "CONC-POS-002", "CONC-POS-003", "CONC-NEG-001", "CONC-NEG-002", "CONC-NEG-003"]);
});

describe("write-concurrency required regressions", () => {
  for (const [id, exercise] of Object.entries(regressions)) it(id, exercise, 30000);
});

describe("write-concurrency hard invariants", () => {
  for (const [id, exercise] of Object.entries(invariants)) it(id, exercise, 45000);
});
