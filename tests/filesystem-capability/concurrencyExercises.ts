import fs from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { expect, vi } from "vitest";
import type { ToolInvocationResult } from "../../src/core/agent/index.js";
import { configured } from "./cases.js";
import { request, sandbox, sha, registry } from "./helpers.js";
import { activeTargetWriteLockCount, writeLockKey } from "../../src/providers/capability/filesystem/writeSerialization.js";
import { affirmativeAtomicClaims, closureClaims, finalPublicationGap, phaseText, reportText, unrelatedAwaits } from "./audit.js";

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function until(predicate: () => boolean, label: string, tries = 5000): Promise<void> {
  for (let i = 0; i < tries && !predicate(); i++) await tick();
  if (!predicate()) throw new Error(`concurrency condition never reached: ${label}`);
}
const tempResidue = async (dir: string) => (await fs.readdir(dir)).filter(n => n.startsWith(".brain-fs-"));
const overwrite = (path: string, content: string, expected: string) =>
  request("filesystem.write", { path, content, mode: "OVERWRITE_EXISTING", expected_sha256: expected });
const outcomes = (results: ToolInvocationResult[]) => ({
  success: results.filter(r => r.status === "SUCCESS").length,
  blocked: results.filter(r => r.status === "BLOCKED").length,
});

// ---------------------------------------------------------------------------
// Required regressions (CONC-POS-001..003 / CONC-NEG-001..003)
// ---------------------------------------------------------------------------

async function sameProviderConcurrentOverwrite(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "t"), "A");
    const provider = await configured(root);
    const stale = sha("A");
    const results = await Promise.all([
      provider.invoke(overwrite("t", "B", stale)),
      provider.invoke(overwrite("t", "C", stale)),
    ]);
    expect(outcomes(results)).toEqual({ success: 1, blocked: 1 });
    const winner = results[0].status === "SUCCESS" ? "B" : "C";
    expect(await fs.readFile(join(root, "t"), "utf8")).toBe(winner);
    expect(await tempResidue(root)).toEqual([]);
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

async function crossProviderConcurrentOverwrite(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "t"), "A");
    const first = await configured(root);
    const second = await configured(root);
    const stale = sha("A");
    const results = await Promise.all([
      first.invoke(overwrite("t", "B", stale)),
      second.invoke(overwrite("t", "C", stale)),
    ]);
    expect(outcomes(results)).toEqual({ success: 1, blocked: 1 });
    const winner = results[0].status === "SUCCESS" ? "B" : "C";
    expect(await fs.readFile(join(root, "t"), "utf8")).toBe(winner);
    expect(await tempResidue(root)).toEqual([]);
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

async function differentTargetsProgressConcurrently(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "a"), "A");
    await fs.writeFile(join(root, "b"), "B");
    const provider = await configured(root);
    let aParkedAtPublication = false;
    let bReachedPublication = false;
    let releaseA!: () => void;
    const parkedA = new Promise<void>(resolve => { releaseA = resolve; });
    const realRename = fs.rename.bind(fs);
    const spy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (String(to).endsWith("/a")) { aParkedAtPublication = true; await parkedA; }
      if (String(to).endsWith("/b")) bReachedPublication = true;
      return realRename(from as string, to as string);
    });
    try {
      const wa = provider.invoke(overwrite("a", "A2", sha("A")));
      await until(() => aParkedAtPublication, "writer A parked at its publication syscall");
      const wb = provider.invoke(overwrite("b", "B2", sha("B")));
      await until(() => bReachedPublication, "writer B reached its own publication while A is parked");
      expect(bReachedPublication).toBe(true);
      releaseA();
      const [ra, rb] = await Promise.all([wa, wb]);
      expect(ra.status).toBe("SUCCESS");
      expect(rb.status).toBe("SUCCESS");
      expect(await fs.readFile(join(root, "a"), "utf8")).toBe("A2");
      expect(await fs.readFile(join(root, "b"), "utf8")).toBe("B2");
    } finally {
      releaseA();
      spy.mockRestore();
    }
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

async function externalContentDriftBeforeFinalPrecondition(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "t"), "A");
    const provider = await configured(root);
    const realOpen = fs.open.bind(fs);
    let intervened = 0;
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, mode) => {
      const handle = await realOpen(path as string, flags as number, mode as number);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        const realSync = handle.sync.bind(handle);
        vi.spyOn(handle, "sync").mockImplementation(async () => {
          await realSync();
          await fs.writeFile(join(root, "t"), "EXTERNAL");
          intervened++;
        });
      }
      return handle;
    });
    try {
      expect((await provider.invoke(overwrite("t", "B", sha("A")))).status).toBe("BLOCKED");
    } finally {
      spy.mockRestore();
    }
    expect(intervened).toBe(1);
    expect(await fs.readFile(join(root, "t"), "utf8")).toBe("EXTERNAL");
    expect(await tempResidue(root)).toEqual([]);
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

async function parentChainDriftBeforeFinalContainment(): Promise<void> {
  await sandbox(async root => {
    await fs.mkdir(join(root, "dir"));
    await fs.writeFile(join(root, "dir", "t"), "A");
    const provider = await configured(root);
    const realOpen = fs.open.bind(fs);
    let swapped = 0;
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, mode) => {
      const handle = await realOpen(path as string, flags as number, mode as number);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        const realSync = handle.sync.bind(handle);
        vi.spyOn(handle, "sync").mockImplementation(async () => {
          await realSync();
          await fs.rename(join(root, "dir"), join(root, "dir-moved"));
          await fs.mkdir(join(root, "dir"));
          swapped++;
        });
      }
      return handle;
    });
    try {
      expect((await provider.invoke(overwrite("dir/t", "B", sha("A")))).status).toBe("BLOCKED");
    } finally {
      spy.mockRestore();
    }
    expect(swapped).toBe(1);
    expect(await fs.readFile(join(root, "dir-moved", "t"), "utf8")).toBe("A");
    await expect(fs.lstat(join(root, "dir", "t"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await tempResidue(join(root, "dir-moved"))).toEqual([]);
    expect(await tempResidue(join(root, "dir"))).toEqual([]);
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

async function writeFailureReleasesTargetLock(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "t"), "A");
    const provider = await configured(root);

    const realOpen = fs.open.bind(fs);
    const failSpy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, mode) => {
      const handle = await realOpen(path as string, flags as number, mode as number);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        vi.spyOn(handle, "write").mockRejectedValue(Object.assign(new Error("synthetic private OS failure"), { code: "EIO" }));
      }
      return handle;
    });
    let failed: ToolInvocationResult;
    try {
      failed = await provider.invoke(overwrite("t", "B", sha("A")));
    } finally {
      failSpy.mockRestore();
    }
    expect(failed.status).toBe("FAIL");
    expect(activeTargetWriteLockCount()).toBe(0);

    const recovered = await provider.invoke(overwrite("t", "B2", sha("A")));
    expect(recovered.status).toBe("SUCCESS");
    expect(await fs.readFile(join(root, "t"), "utf8")).toBe("B2");
    expect(await tempResidue(root)).toEqual([]);
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

// ---------------------------------------------------------------------------
// Deterministic same-target interception (S14B-CONC-HI-001 / 002 / 006)
// ---------------------------------------------------------------------------

async function heldLockBlocksSecondSameTargetWriter(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "t"), "A");
    const first = await configured(root);
    const second = await configured(root);

    let opensObserved = 0;
    let renameCalls = 0;
    let releaseFirstPublication!: () => void;
    const firstParked = new Promise<void>(resolve => { releaseFirstPublication = resolve; });
    const realOpen = fs.open.bind(fs);
    const realRename = fs.rename.bind(fs);
    const openSpy = vi.spyOn(fs, "open").mockImplementation((path, flags, mode) => {
      opensObserved++;
      return realOpen(path as string, flags as number, mode as number);
    });
    const renameSpy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      renameCalls++;
      if (renameCalls === 1) await firstParked;
      return realRename(from as string, to as string);
    });
    try {
      const w1 = first.invoke(overwrite("t", "B", sha("A")));
      await until(() => renameCalls === 1, "writer 1 parked inside its publication syscall");
      const opensAtPark = opensObserved;

      const w2 = second.invoke(overwrite("t", "C", sha("A")));
      // Give writer 2 every opportunity to touch the filesystem while writer 1 holds the lock.
      for (let i = 0; i < 200; i++) await tick();

      // Writer 2 has not opened a single handle and has not reached its own publication.
      expect(opensObserved).toBe(opensAtPark);
      expect(renameCalls).toBe(1);

      releaseFirstPublication();
      const [r1, r2] = await Promise.all([w1, w2]);
      expect(r1.status).toBe("SUCCESS");
      expect(r2.status).toBe("BLOCKED");
      // Writer 2 only ran (and became BLOCKED on the now-stale hash) after the lock freed.
      expect(opensObserved).toBeGreaterThan(opensAtPark);
      expect(renameCalls).toBe(1);
      expect(await fs.readFile(join(root, "t"), "utf8")).toBe("B");
      expect(await tempResidue(root)).toEqual([]);
    } finally {
      releaseFirstPublication();
      openSpy.mockRestore();
      renameSpy.mockRestore();
    }
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

// ---------------------------------------------------------------------------
// Supporting invariant proofs
// ---------------------------------------------------------------------------

async function timeoutReleasesTargetLock(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "t"), "A");
    const provider = await configured(root);
    let now = performance.now();
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const realOpen = fs.open.bind(fs);
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, mode) => {
      const handle = await realOpen(path as string, flags as number, mode as number);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        const realSync = handle.sync.bind(handle);
        vi.spyOn(handle, "sync").mockImplementation(async () => { await realSync(); now += 20000; });
      }
      return handle;
    });
    let timedOut: ToolInvocationResult;
    try {
      timedOut = await provider.invoke(overwrite("t", "B", sha("A")));
    } finally {
      spy.mockRestore();
      clock.mockRestore();
    }
    expect(timedOut).toMatchObject({ status: "FAIL", error: { code: "TIMEOUT" } });
    expect(activeTargetWriteLockCount()).toBe(0);
    expect(await fs.readFile(join(root, "t"), "utf8")).toBe("A");

    const recovered = await provider.invoke(overwrite("t", "B2", sha("A")));
    expect(recovered.status).toBe("SUCCESS");
    expect(await tempResidue(root)).toEqual([]);
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

async function idleLockDomainsDoNotAccumulate(): Promise<void> {
  await sandbox(async root => {
    for (const name of ["a", "b", "c", "d"]) await fs.writeFile(join(root, name), name.toUpperCase());
    const provider = await configured(root);
    // Sequential one-shot writes to distinct targets.
    for (const name of ["a", "b", "c", "d"]) {
      expect((await provider.invoke(overwrite(name, name + "2", sha(name.toUpperCase())))).status).toBe("SUCCESS");
    }
    expect(activeTargetWriteLockCount()).toBe(0);
    // Concurrent writes across distinct targets.
    const results = await Promise.all(["a", "b", "c", "d"].map(name =>
      provider.invoke(request("filesystem.write", { path: name + "-new", content: "x", mode: "CREATE_NEW" }))));
    expect(results.every(r => r.status === "SUCCESS")).toBe(true);
    expect(activeTargetWriteLockCount()).toBe(0);
  });
}

async function lockIdentityIsNotModelVisible(): Promise<void> {
  await sandbox(async root => {
    await fs.writeFile(join(root, "t"), "A");
    const provider = await configured(root);
    const rootStat = await fs.stat(await fs.realpath(root));
    const key = writeLockKey(Number(rootStat.dev), Number(rootStat.ino), "t");
    expect(key).toMatch(/^\d+:\d+/);

    const composed = registry(provider);
    const result = await composed.invoke(overwrite("t", "B", sha("A")));
    expect(result.status).toBe("SUCCESS");
    const serialized = JSON.stringify(result);
    // The provider-layer lock key, the raw dev:ino identity and the host path are all absent.
    expect(serialized).not.toContain(key);
    expect(serialized).not.toMatch(/"\d+:\d+/);
    expect(serialized).not.toContain(root);
    expect(result.evidence_refs).toEqual(["workspace://t"]);

    const descriptors = JSON.stringify(await provider.list_capabilities());
    expect(descriptors.toLowerCase()).not.toContain("lock");
    expect(descriptors).not.toMatch(/\d+:\d+/);
    expect(descriptors).not.toContain(root);
  });
}

function finalPublicationWindowHasNoUnrelatedAwait(): void {
  const gap = finalPublicationGap();
  expect(unrelatedAwaits(gap)).toBe(0);
  // Fireability: an injected unrelated await is detected.
  expect(unrelatedAwaits(gap + "\n      await this.checkChain(chain, deadline);")).toBe(1);
}

function reportDisclosesResidualWithoutOverclaiming(): void {
  const report = reportText();
  expect(affirmativeAtomicClaims(report)).toBe(0);
  // Fireability: an affirmative atomic-CAS claim would be caught.
  expect(affirmativeAtomicClaims("The provider guarantees an atomic compare-and-swap against all host processes.")).toBeGreaterThan(0);
  expect(/NOT CLAIMED IN V1/.test(report)).toBe(true);
  expect(/residual/i.test(report)).toBe(true);
}

function phaseRemainsOpen(): void {
  expect(closureClaims(phaseText())).toBe(0);
  expect(closureClaims("S14: CLOSED\nHI-054: AWARDED")).toBe(2);
}

// ---------------------------------------------------------------------------
// Canonical inventories
// ---------------------------------------------------------------------------

export const regressions: Record<string, () => Promise<void>> = {
  "CONC-POS-001": sameProviderConcurrentOverwrite,
  "CONC-POS-002": crossProviderConcurrentOverwrite,
  "CONC-POS-003": differentTargetsProgressConcurrently,
  "CONC-NEG-001": externalContentDriftBeforeFinalPrecondition,
  "CONC-NEG-002": parentChainDriftBeforeFinalContainment,
  "CONC-NEG-003": writeFailureReleasesTargetLock,
};

export const invariants: Record<string, () => Promise<void>> = {
  "S14B-CONC-HI-001": sameProviderConcurrentOverwrite,
  "S14B-CONC-HI-002": heldLockBlocksSecondSameTargetWriter,
  "S14B-CONC-HI-003": crossProviderConcurrentOverwrite,
  "S14B-CONC-HI-004": differentTargetsProgressConcurrently,
  "S14B-CONC-HI-005": lockIdentityIsNotModelVisible,
  "S14B-CONC-HI-006": heldLockBlocksSecondSameTargetWriter,
  "S14B-CONC-HI-007": async () => { await writeFailureReleasesTargetLock(); await timeoutReleasesTargetLock(); await idleLockDomainsDoNotAccumulate(); },
  "S14B-CONC-HI-008": externalContentDriftBeforeFinalPrecondition,
  "S14B-CONC-HI-009": parentChainDriftBeforeFinalContainment,
  "S14B-CONC-HI-010": async () => { finalPublicationWindowHasNoUnrelatedAwait(); },
  "S14B-CONC-HI-011": async () => { reportDisclosesResidualWithoutOverclaiming(); },
  "S14B-CONC-HI-012": async () => { phaseRemainsOpen(); },
};

export {
  timeoutReleasesTargetLock,
  idleLockDomainsDoNotAccumulate,
  heldLockBlocksSecondSameTargetWriter,
};
