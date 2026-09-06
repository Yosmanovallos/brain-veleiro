import { describe, expect, it } from "vitest";
import { load } from "js-yaml";
import { positives, negatives } from "./cases.js";
import {
  assertBoundaries, partAIntact, productionSources, productionSourceFiles, text,
  finalSpawnGap, unrelatedAwaits, startGitProcessBodyAwaits,
  processEnvReads, inferredScope, forbiddenSurface, closureClaims, overclaims, phaseText,
  importsChildProcess,
} from "./audit.js";
import {
  createNeverSpawns, versionGateIsFirst, versionProbeUsesProviderEnvNoPathFallback,
  invocationDeadlineNotReset, stubbornSameGroupDescendantReaped, timeoutMessageBounded,
  identityRecordedAndCanonicalised,
} from "./processExercises.js";

const quality = load(text("brain-bootstrap/quality-contracts/S14D_GIT_DEEP.yaml")) as {
  positive_fixtures: { id: string }[];
  negative_fixtures: { id: string }[];
  hard_invariants: { id: string }[];
  unsafe_counters: { id: string }[];
};

const N = (n: number) => `FX-NEG-${String(n).padStart(3, "0")}`;
const P = (n: number) => `FX-POS-${String(n).padStart(3, "0")}`;
const negRange = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => negatives[N(from + i)]);
const all = (...fns: Array<() => void | Promise<void>>) => async () => { for (const fn of fns) await fn(); };

/** The two capability descriptors truthfully declare side_effects NONE in source. */
const descriptorsAreNone = () => {
  const src = text("src/providers/capability/git/workspaceGitCapabilityProvider.ts");
  const block = src.slice(src.indexOf("const descriptors: ToolDescriptor[]"), src.indexOf("export class WorkspaceGitCapabilityProvider"));
  expect((block.match(/side_effects:\s*"NONE"/g) ?? []).length).toBe(2);
  expect(block).not.toMatch(/side_effects:\s*"(?:LOCAL|EXTERNAL)"/);
};

/** All canonical Git safety overrides are actually produced (contract §13, §19). */
const safetyFloorComplete = async () => {
  const env = await import("../../src/providers/capability/git/environment.js");
  const args = [...env.globalSafetyArgs("/canon/root"), ...env.buildArgv("STATUS", { canonicalRoot: "/canon/root" })];
  for (const pair of [
    "safe.directory=/canon/root", "core.worktree=/canon/root", "core.hooksPath=/nonexistent/brain-git-hooks",
    "core.fsmonitor=false", "core.untrackedCache=false", "core.pager=cat", "core.editor=/bin/false",
    "core.excludesFile=/dev/null", "core.attributesFile=/dev/null", "credential.helper=", "gpg.program=/bin/false",
    "commit.gpgsign=false", "log.showSignature=false", "tag.gpgSign=false", "gc.auto=0", "gc.autoDetach=false",
    "gc.writeCommitGraph=false", "maintenance.auto=false", "fetch.writeCommitGraph=false", "core.commitGraph=false",
    "protocol.file.allow=never", "protocol.ext.allow=never", "filter.lfs.smudge=cat", "filter.lfs.process=",
    "filter.lfs.required=false", "status.submoduleSummary=false", "submodule.recurse=false",
  ]) expect(args).toContain(pair);
  for (const opt of ["--no-pager", "--no-optional-locks", "--no-replace-objects", "--git-dir=/canon/root/.git", "--work-tree=/canon/root"]) {
    expect(args).toContain(opt);
  }
  const childEnv = env.buildGitEnv();
  for (const [k, v] of [
    ["PATH", "/usr/bin:/bin"], ["HOME", "/nonexistent"], ["GIT_CONFIG_NOSYSTEM", "1"],
    ["GIT_CONFIG_GLOBAL", "/dev/null"], ["GIT_CONFIG_SYSTEM", "/dev/null"], ["GIT_TERMINAL_PROMPT", "0"],
    ["GIT_ASKPASS", "/bin/false"], ["SSH_ASKPASS", "/bin/false"], ["GIT_SSH_COMMAND", "/bin/false"],
    ["GIT_PAGER", "cat"], ["GIT_OPTIONAL_LOCKS", "0"], ["GIT_LITERAL_PATHSPECS", "1"],
    ["GIT_NO_REPLACE_OBJECTS", "1"], ["GIT_LFS_SKIP_SMUDGE", "1"], ["GIT_DISCOVERY_ACROSS_FILESYSTEM", "0"],
    ["LC_ALL", "C"], ["LANG", "C"], ["TZ", "UTC"],
  ] as const) expect(childEnv[k]).toBe(v);
  // host GIT_* / credential / loader sentinels are simply absent from the map.
  for (const forbidden of ["GIT_DIR", "GIT_WORK_TREE", "GIT_EXEC_PATH", "GIT_CONFIG", "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_INDEX_FILE", "GIT_NAMESPACE", "GIT_CONFIG_COUNT", "LD_PRELOAD", "NODE_OPTIONS"]) {
    expect(forbidden in childEnv).toBe(false);
  }
};

/** node:child_process is imported ONLY by process.ts; the provider imports the named launcher (spy-able). */
const spawnIsIsolated = () => {
  const proc = text("src/providers/capability/git/process.ts");
  expect(/\bspawn\s*\(/.test(proc)).toBe(true);
  expect(importsChildProcess(proc)).toBe(1);
  for (const file of productionSourceFiles()) {
    if (file.endsWith("process.ts")) continue;
    expect(importsChildProcess(text(file))).toBe(0);
  }
  const provider = text("src/providers/capability/git/workspaceGitCapabilityProvider.ts");
  expect(provider).toContain('import { startGitProcess, runGitProcess');
  expect(proc).toContain("shell: false");
  expect(proc).toContain('stdio: ["ignore", "pipe", "pipe"]');
  expect(proc).toContain("detached: true");
};

const invariants: Record<string, () => void | Promise<void>> = {
  "S14D-HI-001": positives[P(1)],
  "S14D-HI-002": all(assertBoundaries, positives[P(11)], positives[P(12)]),
  "S14D-HI-003": all(descriptorsAreNone, positives[P(1)], positives[P(8)]),
  "S14D-HI-004": all(negatives[N(1)], negatives[N(2)], () => { expect(inferredScope(productionSources())).toBe(0); }),
  "S14D-HI-005": createNeverSpawns,
  "S14D-HI-006": all(...negRange(20, 23)),
  "S14D-HI-007": all(negatives[N(27)], identityRecordedAndCanonicalised),
  "S14D-HI-008": all(negatives[N(24)], negatives[N(26)], versionProbeUsesProviderEnvNoPathFallback),
  "S14D-HI-009": all(negatives[N(25)], versionGateIsFirst),
  "S14D-HI-010": all(negatives[N(1)], negatives[N(2)]),
  "S14D-HI-011": all(negatives[N(3)], negatives[N(4)]),
  "S14D-HI-012": all(...negRange(5, 9)),
  "S14D-HI-013": all(negatives[N(10)], negatives[N(11)]),
  "S14D-HI-014": all(positives[P(3)], negatives[N(18)], negatives[N(33)]),
  "S14D-HI-015": all(positives[P(5)], positives[P(6)], negatives[N(12)]),
  "S14D-HI-016": all(negatives[N(32)], negatives[N(2)], spawnIsIsolated),
  "S14D-HI-017": all(spawnIsIsolated, positives[P(7)], () => { expect(startGitProcessBodyAwaits()).toBe(0); }),
  "S14D-HI-018": all(negatives[N(28)], () => { expect(processEnvReads(productionSources())).toBe(0); }),
  "S14D-HI-019": all(safetyFloorComplete, negatives[N(29)], negatives[N(30)], negatives[N(31)]),
  "S14D-HI-020": all(negatives[N(32)], negatives[N(33)], negatives[N(41)]),
  "S14D-HI-021": all(negatives[N(12)], negatives[N(21)], negatives[N(23)]),
  "S14D-HI-022": all(positives[P(8)], safetyFloorComplete),
  "S14D-HI-023": all(positives[P(9)], negatives[N(31)]),
  "S14D-HI-024": invocationDeadlineNotReset,
  "S14D-HI-025": all(negatives[N(17)], negatives[N(18)], negatives[N(35)], positives[P(10)], negatives[N(36)]),
  "S14D-HI-026": negatives[N(15)],
  "S14D-HI-027": all(negatives[N(16)], negatives[N(42)]),
  "S14D-HI-028": all(negatives[N(36)], positives[P(2)], positives[P(5)]),
  "S14D-HI-029": all(negatives[N(34)], negatives[N(35)], stubbornSameGroupDescendantReaped, timeoutMessageBounded, () => {
    expect(overclaims(productionSources())).toBe(0);
  }),
  "S14D-HI-030": all(negatives[N(29)], negatives[N(30)], negatives[N(31)]),
  "S14D-HI-031": all(positives[P(2)], positives[P(3)], positives[P(4)], negatives[N(18)]),
  "S14D-HI-032": all(positives[P(10)], negatives[N(10)], negatives[N(12)], negatives[N(14)], negatives[N(15)], negatives[N(17)]),
  "S14D-HI-033": negatives[N(37)],
  "S14D-HI-034": negatives[N(38)],
  "S14D-HI-035": all(positives[P(12)], negatives[N(39)]),
  "S14D-HI-036": all(positives[P(11)], positives[P(12)]),
  "S14D-HI-037": all(positives[P(13)], negatives[N(39)]),
  "S14D-HI-038": positives[P(10)],
  "S14D-HI-039": all(negatives[N(40)], negatives[N(41)]),
  "S14D-HI-040": all(negatives[N(42)], () => { expect(closureClaims(phaseText())).toBe(0); }, assertBoundaries),
};

it("parses and matches the exact authorized S14D inventories", () => {
  expect(Object.keys(positives)).toEqual(quality.positive_fixtures.map(f => f.id));
  expect(Object.keys(negatives)).toEqual(quality.negative_fixtures.map(f => f.id));
  expect(Object.keys(invariants)).toEqual(quality.hard_invariants.map(f => f.id));
  expect(Object.keys(positives)).toHaveLength(14);
  expect(Object.keys(negatives)).toHaveLength(42);
  expect(Object.keys(invariants)).toHaveLength(40);
  expect(quality.unsafe_counters.map(f => f.id)).toEqual(Array.from({ length: 12 }, (_, i) => `UC${String(i + 1).padStart(2, "0")}`));
});

it("final pre-spawn window holds only the synchronous remaining-deadline check", () => {
  expect(unrelatedAwaits(finalSpawnGap())).toBe(0);
});

// Real Git + real process-group cleanup exercises can legitimately run for tens of
// seconds on a slow verifier host; 120s keeps headroom without masking a hang.
for (const [label, cases] of [
  ["canonical positives", positives],
  ["canonical negatives", negatives],
  ["canonical hard invariants", invariants],
] as const) {
  describe(label, () => { for (const [id, exercise] of Object.entries(cases)) it(id, exercise as () => Promise<void>, 120000); });
}
