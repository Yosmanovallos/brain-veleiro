import { describe, it } from "vitest";
import { positives, negatives } from "./cases.js";

describe("browser capability positives", () => {
  for (const [id, fn] of Object.entries(positives)) {
    it(id, fn);
  }
});

describe("browser capability negatives", () => {
  for (const [id, fn] of Object.entries(negatives)) {
    it(id, fn);
  }
});
