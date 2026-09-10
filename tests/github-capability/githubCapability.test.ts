import { describe, it } from "vitest";
import { negatives, positives } from "./cases.js";

describe("canonical positives", () => {
  for (const [id, fn] of Object.entries(positives)) {
    it(id, fn);
  }
});

describe("canonical negatives", () => {
  for (const [id, fn] of Object.entries(negatives)) {
    it(id, fn);
  }
});
