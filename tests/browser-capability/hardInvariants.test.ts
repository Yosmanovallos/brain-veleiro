import { describe, expect, it } from "vitest";
import { positives, negatives } from "./cases.js";
import {
  assertBoundaries,
  assertNoNewDependency,
  assertPriorPhaseIdentity,
  forbiddenConfigSurface,
  forbiddenSurface,
  futurePhaseSurface,
  hiddenRetrySurface,
  inferredScope,
  originEscapeSurface,
  overclaims,
  phaseText,
  closureClaims,
  productionCode,
} from "./audit.js";

/**
 * S14G hard invariants.
 *
 * 30 mechanical, mostly independent, mostly path-covering assertions that
 * express the invariant clauses of the S14G browser capability contract.
 */

describe("S14G hard invariants", () => {
  // --- positive contract invariants (10) ---
  it("HI-G-01: descriptor exposes browser.inspect with EXTERNAL side effects", positives["FX-POS-001"]);
  it("HI-G-02: happy path returns the bounded output shape with deterministic fields", positives["FX-POS-002"]);
  it("HI-G-03: wait_until accepts domcontentloaded and load", positives["FX-POS-003"]);
  it("HI-G-04: links are HTTPS-only, bounded and truncation is signalled", positives["FX-POS-004"]);
  it("HI-G-05: subresources from allowed request origins succeed", positives["FX-POS-005"]);
  it("HI-G-06: serialized snapshot respects max_snapshot_bytes", positives["FX-POS-006"]);
  it("HI-G-07: registry, restricted, agent and evidence wiring all agree", positives["FX-POS-007"]);
  it("HI-G-08: an independent compatible provider can replace the implementation", positives["FX-POS-008"]);
  it("HI-G-09: every invocation creates a fresh browser / context / page and closes them", positives["FX-POS-009"]);
  it("HI-G-10: real Playwright Chromium over an unreachable origin fails safe", positives["FX-POS-010"]);

  // --- configuration / validation invariants (8) ---
  it("HI-G-11: missing or non-record provider config is rejected", negatives["FX-NEG-001"]);
  it("HI-G-12: navigation origins must be a subset of request origins", negatives["FX-NEG-002"]);
  it("HI-G-13: forbidden browser config surfaces are rejected by validateConfig", negatives["FX-NEG-003"]);
  it("HI-G-14: origin grammar rejects userinfo, paths, non-HTTPS and forbidden hosts", negatives["FX-NEG-004"]);
  it("HI-G-15: origin count, uniqueness and browser_id duplicate bounds are enforced", negatives["FX-NEG-005"]);
  it("HI-G-16: numeric configuration bounds (timeout, depth, bytes, links) are enforced", negatives["FX-NEG-007"]);
  it("HI-G-17: browser_id grammar and length are enforced", negatives["FX-NEG-008"]);
  it("HI-G-18: provider config is not exposed through descriptor or output", negatives["FX-NEG-009"]);

  // --- envelope and input invariants (5) ---
  it("HI-G-19: missing capability_id or wrong provider blocks invocation", negatives["FX-NEG-010"]);
  it("HI-G-20: input objects are closed and reject extra properties", negatives["FX-NEG-011"]);
  it("HI-G-21: URL byte length, controls and scheme are enforced", async () => {
    await negatives["FX-NEG-012"]();
    await negatives["FX-NEG-013"]();
    await negatives["FX-NEG-014"]();
  });
  it("HI-G-22: wait_until and navigation/request origin policies are enforced", async () => {
    await negatives["FX-NEG-015"]();
    await negatives["FX-NEG-016"]();
  });
  it("HI-G-23: main-frame and cross-origin redirects are enforced", async () => {
    await negatives["FX-NEG-017"]();
    await negatives["FX-NEG-018"]();
  });

  // --- runtime security invariants (4) ---
  it("HI-G-24: disallowed schemes, methods and cross-origin subresources are blocked", negatives["FX-NEG-019"]);
  it("HI-G-25: downloads and popups are rejected as PERMISSION_DENIED", async () => {
    await negatives["FX-NEG-020"]();
    await negatives["FX-NEG-021"]();
  });
  it("HI-G-26: invocations cannot exceed the single invocation deadline", negatives["FX-NEG-022"]);
  it("HI-G-27: snapshot overflow is a bounded execution failure", negatives["FX-NEG-023"]);
  it("HI-G-28: browser launch failure is reported as UNAVAILABLE", negatives["FX-NEG-024"]);

  // --- source / audit invariants (3) ---
  it("HI-G-29: production code has no forbidden interaction, network, retry, escape or future-phase surfaces", () => {
    expect(forbiddenSurface()).toBe(0);
    expect(hiddenRetrySurface(productionCode())).toBe(0);
    expect(inferredScope(productionCode())).toBe(0);
    expect(originEscapeSurface(productionCode())).toBe(0);
    expect(futurePhaseSurface(productionCode())).toBe(0);
    expect(forbiddenConfigSurface()).toEqual([]);
  });

  it("HI-G-30: authorized scope, dependencies and prior-phase identity are preserved", () => {
    assertBoundaries();
    assertNoNewDependency();
    assertPriorPhaseIdentity();
    expect(overclaims(phaseText())).toBe(0);
    expect(closureClaims(phaseText())).toBe(0);
  });
});
