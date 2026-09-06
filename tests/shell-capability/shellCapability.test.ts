import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { positives, negatives } from "./cases.js";
import { withShellSandbox, profile, create, config } from "./fixtures.js";
import { request, registry, CAP } from "./helpers.js";
import { assertBoundaries, closureClaims, finalSpawnGap, inferredScope, phaseText, productionSources, s14bAuditMaintenanceMechanical, shellFutureSurface, startGroupBodyAwaits, text, unrelatedAwaits } from "./audit.js";
import {
  boundedEvidence, configTimeoutBounds, executableDrift, executableInsideWorkspace,
  explicitRootOnly, externalSignal, permissionDeniedAtSpawn, preSpawnTimeoutProfileSmaller,
  preSpawnTimeoutRequestSmaller, remainingBudgetNotReset, stdioShape,
  stubbornGrandchildOverflow, stubbornGrandchildTimeout, timeoutMessageBounded,
} from "./processExercises.js";

const quality = load(text("brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml")) as {
  positive_fixtures: { id: string }[];
  negative_fixtures: { id: string }[];
  hard_invariants: { id: string }[];
  unsafe_counters: { id: string }[];
};

const N = (n: number) => `FX-NEG-${String(n).padStart(3, "0")}`;
const seq = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => negatives[N(from + i)]);
const all = (...fns: Array<() => void | Promise<void>>) => async () => { for (const fn of fns) await fn(); };

const invariants: Record<string, () => void | Promise<void>> = {
  "S14C-HI-001": positives["FX-POS-001"],
  "S14C-HI-002": all(assertBoundaries, positives["FX-POS-009"], positives["FX-POS-011"]),
  "S14C-HI-003": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    for (const d of await p.list_capabilities()) expect(d.side_effects).toBe("LOCAL");
    expect((await p.list_capabilities()).map(d => d.capability_id)).toEqual([CAP]);
  }),
  "S14C-HI-004": all(explicitRootOnly, async () => { expect(inferredScope(productionSources())).toBe(0); }),
  "S14C-HI-005": all(negatives["FX-NEG-003"], negatives["FX-NEG-004"], negatives["FX-NEG-005"]),
  "S14C-HI-006": all(negatives["FX-NEG-003"], negatives["FX-NEG-004"], negatives["FX-NEG-005"], negatives["FX-NEG-006"]),
  "S14C-HI-007": all(negatives["FX-NEG-001"], negatives["FX-NEG-002"]),
  "S14C-HI-008": all(...seq(7, 12)),
  "S14C-HI-009": negatives["FX-NEG-013"],
  "S14C-HI-010": all(negatives["FX-NEG-015"], negatives["FX-NEG-016"], negatives["FX-NEG-018"]),
  "S14C-HI-011": all(negatives["FX-NEG-015"], negatives["FX-NEG-016"]),
  "S14C-HI-012": negatives["FX-NEG-014"],
  "S14C-HI-013": all(...seq(19, 22)),
  "S14C-HI-014": all(executableDrift, async () => {
    expect(unrelatedAwaits(finalSpawnGap())).toBe(0);
    expect(startGroupBodyAwaits()).toBe(0);
  }),
  "S14C-HI-015": all(negatives["FX-NEG-004"], positives["FX-POS-005"]),
  "S14C-HI-016": all(positives["FX-POS-005"], async () => { expect(shellFutureSurface(productionSources())).toBe(0); }),
  "S14C-HI-017": all(stdioShape, async () => { expect(shellFutureSurface(productionSources())).toBe(0); }),
  "S14C-HI-018": all(positives["FX-POS-006"], negatives["FX-NEG-032"]),
  "S14C-HI-019": all(negatives["FX-NEG-030"], negatives["FX-NEG-031"]),
  "S14C-HI-020": all(negatives["FX-NEG-024"], negatives["FX-NEG-026"], negatives["FX-NEG-027"], negatives["FX-NEG-028"], negatives["FX-NEG-029"], boundedEvidence),
  "S14C-HI-021": all(positives["FX-POS-008"], configTimeoutBounds, preSpawnTimeoutProfileSmaller, preSpawnTimeoutRequestSmaller, remainingBudgetNotReset),
  "S14C-HI-022": all(positives["FX-POS-007"], negatives["FX-NEG-033"], negatives["FX-NEG-034"]),
  "S14C-HI-023": negatives["FX-NEG-036"],
  "S14C-HI-024": all(negatives["FX-NEG-033"], negatives["FX-NEG-034"], negatives["FX-NEG-035"]),
  "S14C-HI-025": negatives["FX-NEG-037"],
  "S14C-HI-026": all(negatives["FX-NEG-038"], executableInsideWorkspace),
  "S14C-HI-027": all(positives["FX-POS-003"], externalSignal),
  "S14C-HI-028": all(positives["FX-POS-013"], stubbornGrandchildTimeout, timeoutMessageBounded, async () => {
    const report = "brain-bootstrap/reports/S14C-shell-capability-verification.md";
    if (existsSync(report)) expect(/timeout\s+(?:means|guarantees|implies)\s+no\s+(?:filesystem|local)\s+mutation/i.test(text(report))).toBe(false);
  }),
  "S14C-HI-029": all(negatives["FX-NEG-039"], stubbornGrandchildTimeout, stubbornGrandchildOverflow),
  "S14C-HI-030": all(permissionDeniedAtSpawn, negatives["FX-NEG-038"]),
  "S14C-HI-031": negatives["FX-NEG-040"],
  "S14C-HI-032": negatives["FX-NEG-041"],
  "S14C-HI-033": all(positives["FX-POS-010"], assertBoundaries),
  "S14C-HI-034": positives["FX-POS-011"],
  "S14C-HI-035": positives["FX-POS-012"],
  "S14C-HI-036": all(positives["FX-POS-007"], () => withShellSandbox(async sb => {
    // A legal maximum (1 MiB combined) worst-case-escaped result must pass the
    // real registry result envelope (8388608 chars) untruncated.
    const at = await create(config(sb.root, profile({ profile_id: "qa.ctrl", executable: sb.script("emitctrl"), argv: ["524288", "both"], max_timeout_ms: 30000 })));
    const viaRegistry = await registry(at).invoke(request({ profile_id: "qa.ctrl", cwd: "." }, 30000));
    expect(viaRegistry.status).toBe("SUCCESS");
    if (viaRegistry.status === "SUCCESS") {
      expect(viaRegistry.output.stdout_bytes).toBe(524288);
      expect(JSON.stringify(viaRegistry).length).toBeGreaterThan(6291456);
    }
    // max+1 fails in the provider before any oversized result is composed.
    const over = await create(config(sb.root, profile({ profile_id: "qa.ctrlover", executable: sb.script("emitctrl"), argv: ["700000", "both"], max_timeout_ms: 30000 })));
    expect((await registry(over).invoke(request({ profile_id: "qa.ctrlover", cwd: "." }, 30000))).status).toBe("FAIL");
  })),
  "S14C-HI-037": all(() => assertBoundaries(), s14bAuditMaintenanceMechanical),
  "S14C-HI-038": all(assertBoundaries, async () => {
    for (const path of ["package.json", "package-lock.json"]) {
      const baselineBytes = execFileSync("git", ["show", `3cd344d018dbf2d40a39a907a3494bba8f3d940b:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
      expect(text(path)).toBe(baselineBytes);
    }
  }),
  "S14C-HI-039": all(negatives["FX-NEG-042"], async () => { expect(shellFutureSurface(productionSources())).toBe(0); }),
  "S14C-HI-040": async () => { expect(closureClaims(phaseText())).toBe(0); },
};

it("parses and matches the exact authorized S14C inventories", () => {
  expect(Object.keys(positives)).toEqual(quality.positive_fixtures.map(f => f.id));
  expect(Object.keys(negatives)).toEqual(quality.negative_fixtures.map(f => f.id));
  expect(Object.keys(invariants)).toEqual(quality.hard_invariants.map(f => f.id));
  expect(Object.keys(positives)).toHaveLength(14);
  expect(Object.keys(negatives)).toHaveLength(42);
  expect(Object.keys(invariants)).toHaveLength(40);
  expect(quality.unsafe_counters.map(f => f.id)).toEqual(Array.from({ length: 12 }, (_, i) => `UC${String(i + 1).padStart(2, "0")}`));
});

// Some hard invariants bundle several process exercises (real timeouts + escalation
// grace + cleanup polling), so a single `it` can legitimately run for tens of
// seconds on a slow verifier host. 120s keeps generous headroom without masking a
// genuine hang.
for (const [label, cases] of [["canonical positives", positives], ["canonical negatives", negatives], ["canonical hard invariants", invariants]] as const) {
  describe(label, () => { for (const [id, exercise] of Object.entries(cases)) it(id, exercise as () => Promise<void>, 120000); });
}
