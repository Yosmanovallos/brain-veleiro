import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

// S14C Part B builder baseline — the mechanical Part A integration commit.
export const baseline = "3cd344d018dbf2d40a39a907a3494bba8f3d940b";
export const partABlobs: Record<string, string> = {
  "brain-bootstrap/skills/SHELL_CAPABILITY_SKILL_S14C.md": "defbd27f7787a42b2a797c178f75668db65502db",
  "brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml": "a0b84708dc7619648321004fe18d8d429becf84b",
  "brain-bootstrap/specs/SHELL_CAPABILITY_CONTRACT_S14C.md": "8626698c94aae66e74cd96d654625dcb638d7a47",
};

export const text = (path: string): string => readFileSync(path, "utf8");
export const blob = (bytes: Buffer): string => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

export function productionSources(): string {
  const dir = "src/providers/capability/shell";
  return readdirSync(dir).filter(p => p.endsWith(".ts")).map(p => text(join(dir, p))).join("\n");
}

// Two — and only two — authorized modifications of pre-existing tracked files:
//   1. tests/filesystem-capability/audit.ts   — the narrow S14B regression-harness
//      continuity exemption (see s14bAuditMaintenanceExact), unchanged since Round 2.
//   2. tests/filesystem-capability/concurrencyExercises.ts — the Round-4 narrow
//      test-harness determinism maintenance (authorized: Issue #1 comment
//      5556617161): replace the scheduling-sensitive `until(..., tries=5000)`
//      polling in two same-target write exercises with explicit deferred event
//      barriers resolved inside the intercepting `fs.rename` spy. Exercised
//      production semantics and canonical inventories are unchanged
//      (see concurrencyExercisesMaintenanceExact).
export const ALLOWED_MODIFIED = [
  "tests/filesystem-capability/audit.ts",
  "tests/filesystem-capability/concurrencyExercises.ts",
];

// Every OTHER tracked file at `baseline` must still be byte-identical.
export function protectedDifferences(): string[] {
  const tracked = execFileSync("git", ["ls-tree", "-r", "--format=%(objectname) %(path)", baseline], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim().split("\n");
  return tracked.flatMap(line => {
    const hash = line.slice(0, 40);
    const path = line.slice(41);
    if (ALLOWED_MODIFIED.includes(path)) return [];
    if (!existsSync(path)) return [path];
    return blob(readFileSync(path)) === hash ? [] : [path];
  });
}

// New candidate files must be additions under an authorized S14C path.
const ALLOWED_ADD_PREFIXES = ["src/providers/capability/shell/", "tests/shell-capability/", "brain-bootstrap/reports/S14C-"];
/** Baseline -> current worktree changes, working both before and after commit. */
export function candidateChanges(): Array<{ status: string; path: string }> {
  const tracked = execFileSync("git", ["diff", "--name-status", baseline], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .trim().split("\n").filter(Boolean)
    .map(line => { const [status, ...rest] = line.split("\t"); return { status: status[0], path: rest.join("\t") }; });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .trim().split("\n").filter(Boolean)
    .map(path => ({ status: "A", path }));
  return [...tracked, ...untracked];
}

/** Part A canonical blobs are byte-identical at the candidate. */
export function partAIntact(): void {
  for (const [path, want] of Object.entries(partABlobs)) {
    const got = execFileSync("git", ["rev-parse", `HEAD:${path}`], { encoding: "utf8" }).trim();
    expect(got).toBe(want);
  }
}

/**
 * Prove the modification of `tests/filesystem-capability/audit.ts` is EXACTLY the
 * authorized narrow maintenance: exempt only `STATE.yaml` and `CURRENT.md` from
 * `protectedDifferences()`, keep the `registryFiles` special case, keep
 * `registryPatchOnly()` byte-identical, and change nothing else.
 */
export function s14bAuditMaintenanceExact(): void {
  const path = "tests/filesystem-capability/audit.ts";
  const before = execFileSync("git", ["show", `${baseline}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const registryLine = 'export const registryFiles = ["src/providers/capability/registry/validation.ts", "src/providers/capability/registry/capabilityRegistryProvider.ts"];';
  const guardOld = "    if (registryFiles.includes(p)) return [];";
  const guardNew = "    if (registryFiles.includes(p) || acceptedContinuityFiles.includes(p)) return [];";
  const continuityConst = 'export const acceptedContinuityFiles = ["brain-bootstrap/STATE.yaml", "brain/context/CURRENT.md"];';
  // baseline preconditions for the transform to be well-defined
  expect(before.includes(registryLine)).toBe(true);
  expect(before.includes(guardOld)).toBe(true);
  expect(before.includes("acceptedContinuityFiles")).toBe(false);

  const expected = before
    .replace(registryLine,
      `${registryLine}\n// Continuity metadata the ACCEPTED S14B phase-closure intentionally rewrote after\n// \`baseline\`. These two paths only are exempt from the byte-for-byte protected\n// comparison; every other tracked file at \`baseline\` stays fully protected.\n${continuityConst}`)
    .replace(guardOld, guardNew);

  expect(text(path)).toBe(expected);

  // The forward transform above already proves every other line — including
  // `registryPatchOnly()` and the frozen `990483…` baseline SHA — is byte-identical
  // to `${baseline}:tests/filesystem-capability/audit.ts`. These are cross-checks:
  const lines = before.split("\n");
  const patchStart = lines.findIndex(l => l.startsWith("export function registryPatchOnly()"));
  const patchLen = lines.slice(patchStart).findIndex((l, i) => i > 0 && l === "}") + 1;
  const patchBefore = lines.slice(patchStart, patchStart + patchLen).join("\n");
  expect(text(path).includes(patchBefore)).toBe(true);
  expect(text(path).includes('export const baseline = "990483118d623d4af5caf6b2d05cb79a4a3feb02";')).toBe(true);
  expect(text(path).includes("if (registryFiles.includes(p) || acceptedContinuityFiles.includes(p)) return [];")).toBe(true);
}

/** Runtime cross-checks of the S14B maintenance, assertable on their own. */
export async function s14bAuditMaintenanceMechanical(): Promise<void> {
  const mod = await import("../filesystem-capability/audit.js");
  // exactly and only the two continuity paths are exempt
  expect(mod.acceptedContinuityFiles).toEqual(["brain-bootstrap/STATE.yaml", "brain/context/CURRENT.md"]);
  // the registryFiles special case is preserved unchanged
  expect(mod.registryFiles).toEqual(["src/providers/capability/registry/validation.ts", "src/providers/capability/registry/capabilityRegistryProvider.ts"]);
  // no OTHER tracked S14B baseline file drifted
  expect(protectedDifferences()).toEqual([]);
  s14bAuditMaintenanceExact();
}

const CONCURRENCY_EXERCISES = "tests/filesystem-capability/concurrencyExercises.ts";
const CONCURRENCY_TEST = "tests/filesystem-capability/concurrency.test.ts";
// The two exercises whose publication-observation timing the Round-4 maintenance
// converts from until(...) event-loop polling to deferred event barriers.
const AUTHORIZED_BARRIER_FNS = ["differentTargetsProgressConcurrently", "heldLockBlocksSecondSameTargetWriter"];
// Canonical exercise functions of concurrencyExercises.ts, in source order. Their
// mapping to CONC-* / S14B-CONC-HI-* ids lives in the byte-identical
// concurrency.test.ts plus the frozen quality-contract YAML.
const CONCURRENCY_EXERCISE_FNS = [
  "sameProviderConcurrentOverwrite", "crossProviderConcurrentOverwrite",
  "differentTargetsProgressConcurrently", "externalContentDriftBeforeFinalPrecondition",
  "parentChainDriftBeforeFinalContainment", "writeFailureReleasesTargetLock",
  "heldLockBlocksSecondSameTargetWriter", "timeoutReleasesTargetLock",
  "idleLockDomainsDoNotAccumulate", "lockIdentityIsNotModelVisible",
  "finalPublicationWindowHasNoUnrelatedAwait", "reportDisclosesResidualWithoutOverclaiming",
  "phaseRemainsOpen",
];

function gitBlob(ref: string): string {
  return execFileSync("git", ["rev-parse", ref], { encoding: "utf8" }).trim();
}
function fnDeclIndex(src: string, name: string): number {
  return src.search(new RegExp(String.raw`\n(?:async )?function ` + name + String.raw`\s*\(`));
}
/** Slice one named top-level function, from its declaration to the next exercise fn / the export block. */
function fnSlice(src: string, name: string): string {
  const start = fnDeclIndex(src, name);
  if (start < 0) throw new Error(`function ${name} missing in ${CONCURRENCY_EXERCISES}`);
  const later = CONCURRENCY_EXERCISE_FNS.map(n => fnDeclIndex(src, n)).filter(i => i > start);
  const exportsAt = src.indexOf("\nexport const regressions");
  return src.slice(start, Math.min(...[...later, exportsAt].filter(i => i > start)));
}

/**
 * Prove tests/filesystem-capability/concurrencyExercises.ts changed ONLY for the
 * authorized Round-4 event-barrier determinism maintenance:
 *  - concurrency.test.ts is byte-identical to baseline;
 *  - the import block, the stable const helpers, EVERY exercise function other
 *    than the two authorized ones, and the whole canonical inventory / export
 *    block are byte-identical to baseline;
 *  - the scheduling-sensitive polling primitives (until(, tries=, the setImmediate
 *    tick, the 200-iteration for spin) are gone and NO retry / sleep / timer was
 *    introduced;
 *  - the two authorized functions did change, and their asserted
 *    SUCCESS / BLOCKED / byte / lock-residue outcomes are all preserved.
 */
export function concurrencyExercisesMaintenanceExact(): void {
  // concurrency.test.ts fully untouched.
  expect(blob(readFileSync(CONCURRENCY_TEST))).toBe(gitBlob(baseline + ":" + CONCURRENCY_TEST));

  const before = execFileSync("git", ["show", baseline + ":" + CONCURRENCY_EXERCISES], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const after = text(CONCURRENCY_EXERCISES);

  // Baseline really did carry the polling primitives being removed.
  expect(before.includes("async function until(")).toBe(true);
  expect(before.includes("for (let i = 0; i < 200; i++) await tick();")).toBe(true);
  expect(before.includes("setImmediate")).toBe(true);

  // No polling / retry / sleep / timer anywhere in the maintained file.
  for (const forbidden of [
    "until(", "tries =", "tries=", "setImmediate", "setTimeout", "setInterval",
    ".retry(", "retry:", "for (let i = 0; i < 200", "tick(",
  ]) {
    expect(after.includes(forbidden)).toBe(false);
  }
  // The replacement is an explicit deferred barrier helper.
  expect(/const deferred = \(\)[^=]*=>/.test(after)).toBe(true);
  expect(after.includes("new Promise<void>(r => { resolve = r; })")).toBe(true);

  // Import block byte-identical (through the last import line).
  const headerEnd = before.indexOf("\n", before.indexOf("import { affirmativeAtomicClaims")) + 1;
  expect(headerEnd).toBeGreaterThan(1);
  expect(after.slice(0, headerEnd)).toBe(before.slice(0, headerEnd));

  // Stable const helpers (tempResidue / overwrite / outcomes) + section comment,
  // from `const tempResidue` up to the first exercise function: identical.
  const stableFrom = (s: string) => s.indexOf("\nconst tempResidue");
  const stableTo = (s: string) => fnDeclIndex(s, "sameProviderConcurrentOverwrite");
  expect(stableFrom(after)).toBeGreaterThan(0);
  expect(after.slice(stableFrom(after), stableTo(after))).toBe(before.slice(stableFrom(before), stableTo(before)));

  // Every exercise function EXCEPT the two authorized barrier conversions: byte-identical.
  for (const name of CONCURRENCY_EXERCISE_FNS) {
    if (AUTHORIZED_BARRIER_FNS.includes(name)) {
      expect(fnSlice(after, name)).not.toBe(fnSlice(before, name)); // it did change
    } else {
      expect(fnSlice(after, name)).toBe(fnSlice(before, name));      // untouched
    }
  }

  // Canonical inventories + re-exports: byte-identical to baseline.
  expect(after.slice(after.indexOf("\nexport const regressions"))).toBe(before.slice(before.indexOf("\nexport const regressions")));

  // The two converted exercises keep their exact asserted outcomes.
  const diffTargets = fnSlice(after, "differentTargetsProgressConcurrently");
  for (const need of ['expect(ra.status).toBe("SUCCESS")', 'expect(rb.status).toBe("SUCCESS")',
    '.toBe("A2")', '.toBe("B2")', "expect(activeTargetWriteLockCount()).toBe(0)"]) {
    expect(diffTargets.includes(need)).toBe(true);
  }
  const heldLock = fnSlice(after, "heldLockBlocksSecondSameTargetWriter");
  for (const need of ['expect(r1.status).toBe("SUCCESS")', 'expect(r2.status).toBe("BLOCKED")',
    'expect(await fs.readFile(join(root, "t"), "utf8")).toBe("B")',
    "expect(await tempResidue(root)).toEqual([])", "expect(activeTargetWriteLockCount()).toBe(0)"]) {
    expect(heldLock.includes(need)).toBe(true);
  }

  // `heldLockBlocksSecondSameTargetWriter` asserts "no filesystem precondition
  // and no publication while writer 1 holds the lock" with NO scheduling wait.
  // That is only sound while the S14B provider path from `invoke()` into
  // `withTargetWriteLock`'s `await prior` contains no `await` / `.then(` and no
  // filesystem I/O, so writer 2 is enqueued synchronously. Enforce that
  // precondition against the live production source (read-only; no production
  // file is modified).
  const fsProvider = text("src/providers/capability/filesystem/workspaceFilesystemCapabilityProvider.ts");
  const invokeAt = fsProvider.indexOf("async invoke(");
  const performCallAt = fsProvider.indexOf("this.perform(", invokeAt);
  expect(invokeAt).toBeGreaterThanOrEqual(0);
  expect(performCallAt).toBeGreaterThan(invokeAt);
  // invoke() up to the `this.perform(...)` call: fully synchronous.
  expect(unrelatedAwaits(fsProvider.slice(invokeAt, performCallAt))).toBe(0);
  // perform() dispatches the write path by returning `withTargetWriteLock(...)`
  // directly, with nothing awaited before it.
  const performDeclAt = fsProvider.indexOf("private async perform(");
  const lockCallAt = fsProvider.indexOf("withTargetWriteLock(", performDeclAt);
  expect(performDeclAt).toBeGreaterThanOrEqual(0);
  expect(lockCallAt).toBeGreaterThan(performDeclAt);
  expect(unrelatedAwaits(fsProvider.slice(performDeclAt, lockCallAt))).toBe(0);
  expect(/return withTargetWriteLock\(/.test(fsProvider.slice(performDeclAt, lockCallAt + 40))).toBe(true);
  // withTargetWriteLock increments the queue depth BEFORE its first `await`.
  const serialization = text("src/providers/capability/filesystem/writeSerialization.ts");
  const wtwlAt = serialization.indexOf("export async function withTargetWriteLock");
  const firstAwaitAt = serialization.indexOf("await ", wtwlAt);
  expect(wtwlAt).toBeGreaterThanOrEqual(0);
  expect(firstAwaitAt).toBeGreaterThan(wtwlAt);
  expect(serialization.slice(wtwlAt, firstAwaitAt).includes(".pending += 1")).toBe(true);
}

export function assertBoundaries(): void {
  expect(protectedDifferences()).toEqual([]);
  const changes = candidateChanges();
  const additions = changes.filter(c => c.status === "A");
  const modifications = changes.filter(c => c.status !== "A");
  expect(additions.every(c => ALLOWED_ADD_PREFIXES.some(prefix => c.path.startsWith(prefix)))).toBe(true);
  expect(modifications.map(c => `${c.status}\t${c.path}`).sort()).toEqual([
    "M\ttests/filesystem-capability/audit.ts",
    "M\ttests/filesystem-capability/concurrencyExercises.ts",
  ]);
  partAIntact();
  s14bAuditMaintenanceExact();
  concurrencyExercisesMaintenanceExact();
}

// Hidden workspace-root inference — identical to the S14B scanner.
export const inferredScope = (source: string): number =>
  (source.match(/process\.(?:cwd|env)|homedir\s*\(|USERPROFILE|git\s+rev-parse/g) ?? []).length;

// Future-phase / non-canonical execution surface. NOTE: unlike the S14B
// `futureSurface` scanner this MUST allow `node:child_process` — it is S14C's
// authorized execution mechanism. It forbids a shell parser, exec-style command
// strings, PTY, raw network, and later-phase connectors instead.
export const shellFutureSurface = (source: string): number =>
  (source.match(/shell\s*:\s*true|\/bin\/sh\b|-c\s+["'`]|\bexecSync\s*\(|\bexecFileSync\s*\(|\.exec\s*\(|\bnode-pty\b|["'](?:node:)?(?:https?|net|tls|dgram)["']|\bfetch\s*\(|\b(?:Octokit|McpClient|OAuthClient|WorkflowRuntime|Orchestrator)\b|\bgit\s+(?:rev-parse|clone|commit|push|fetch)\b/g) ?? []).length;

export const closureClaims = (source: string): number =>
  (source.match(/\bS14\s*[:=]\s*["']?(?:CLOSED|PASS)\b|\bHI-054\s*[:=]\s*["']?AWARDED\b/g) ?? []).length;

export function phaseText(): string {
  const report = "brain-bootstrap/reports/S14C-shell-capability-verification.md";
  return [text("brain/context/CURRENT.md"), text("brain-bootstrap/STATE.yaml"), ...(existsSync(report) ? [text(report)] : [])].join("\n");
}

// S14C-HI-014 / contract §32: nothing but the synchronous deadline check may sit
// between the final executable-identity recheck and the spawn call.
export function finalSpawnGap(): string {
  const src = text("src/providers/capability/shell/workspaceShellCapabilityProvider.ts");
  const start = src.lastIndexOf("await this.recheckExecutable(");
  const spawnAt = src.indexOf("startProcessGroup(", start);
  if (start < 0 || spawnAt < 0) throw new Error("final pre-spawn window markers not found");
  return src.slice(src.indexOf(";", start) + 1, spawnAt);
}
export const unrelatedAwaits = (gap: string): number => (gap.match(/\bawait\b|\.then\s*\(/g) ?? []).length;

export function startGroupBodyAwaits(): number {
  const src = text("src/providers/capability/shell/execution.ts");
  const start = src.indexOf("export function startProcessGroup(");
  const end = src.indexOf("\n}", start);
  if (start < 0 || end < 0) throw new Error("startProcessGroup body markers not found");
  return (src.slice(start, end).match(/\bawait\b|\.then\s*\(/g) ?? []).length;
}
