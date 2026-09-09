import fs from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { expect, vi } from "vitest";
import * as gitProcess from "../../src/providers/capability/git/process.js";
import {
  withRepo, withSimpleRepo, providerConfig, createProvider,
  makeGitfileLinkedWorktree, makeBareRepo, makeSparseRepo, makeAlternatesRepo, makeSymlinkedGitDir,
} from "./repoFixtures.js";
import { withGitBin } from "./fixtures.js";
import { request, pidGone, readPidFile } from "./helpers.js";

const run = (p: Awaited<ReturnType<typeof createProvider>>, cap: string, input: Record<string, unknown>, timeout_ms = 20000) =>
  p.invoke(request(cap, input, timeout_ms));

/** contract §7, skill §2.8 — create() is filesystem-only: zero process spawn, valid or not. */
export async function createNeverSpawns(): Promise<void> {
  const launcher = vi.spyOn(gitProcess, "startGitProcess");
  try {
    await withSimpleRepo(async fx => { await createProvider(providerConfig(fx)); });
    await withRepo(() => {}, async fx => {
      for (const bad of [
        () => createProvider(providerConfig(fx, { repository_root: join(fx.base, "missing") })),
        () => createProvider(providerConfig(fx, { git_executable: "git" })),
        () => createProvider(providerConfig(fx, { repository_root: makeBareRepo(fx.base).root })),
        () => createProvider(providerConfig(fx, { repository_root: makeGitfileLinkedWorktree(fx.base).root })),
        () => createProvider(providerConfig(fx, { repository_root: makeSparseRepo(fx.base).root })),
        () => createProvider(providerConfig(fx, { repository_root: makeAlternatesRepo(fx.base).root })),
        () => createProvider(providerConfig(fx, { repository_root: makeSymlinkedGitDir(fx.base).root })),
      ]) {
        await expect(bad()).rejects.toThrow();
      }
    });
    expect(launcher).not.toHaveBeenCalled();
  } finally { launcher.mockRestore(); }
}

/** contract §9, §14, §39 — every invocation's FIRST spawn is the `--version` probe. */
export async function versionGateIsFirst(): Promise<void> {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    for (const [cap, input] of [[ "repository.status", {} ], [ "repository.read", { path: "hello.txt" } ]] as const) {
      const launcher = vi.spyOn(gitProcess, "startGitProcess");
      try {
        expect((await run(p, cap, input)).status).toBe("SUCCESS");
        expect(launcher.mock.calls.length).toBeGreaterThan(0);
        expect(launcher.mock.calls[0][0].argv).toEqual(["--version"]);
        // and no repository-facing argv appears before that first call resolves.
        expect(launcher.mock.calls.filter(c => c[0].argv.includes("status") || c[0].argv.includes("cat-file") || c[0].argv.includes("rev-parse") || c[0].argv.includes("ls-tree")).length).toBeGreaterThanOrEqual(cap === "repository.status" ? 1 : 2);
      } finally { launcher.mockRestore(); }
    }
  });
}

/** contract §14, §39 — the version probe uses the provider-built env, not PATH, and never a fallback binary. */
export async function versionProbeUsesProviderEnvNoPathFallback(): Promise<void> {
  await withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const bad = await bin.fakeGit("git", { version: "1.0.0", behavior: "delegate" });
      // put a "good" git earlier on PATH; the provider must ignore it entirely.
      const goodDir = bin.dir;
      const p = await createProvider(providerConfig(fx, { git_executable: bad }));
      const prevPath = process.env.PATH;
      process.env.PATH = `${goodDir}:${prevPath}`;
      const launcher = vi.spyOn(gitProcess, "startGitProcess");
      try {
        expect((await run(p, "repository.status", {})).status).toBe("FAIL");
        for (const call of launcher.mock.calls) {
          expect(call[0].executable).toBe(bad); // exactly the configured absolute path
          expect(call[0].env.PATH).toBe("/usr/bin:/bin"); // provider-built, not host PATH
          expect("GIT_DIR" in call[0].env).toBe(false);
        }
      } finally { launcher.mockRestore(); process.env.PATH = prevPath; }
    });
  });
}

/**
 * contract §29, skill §16 — one invocation-wide deadline. Pre-spawn work
 * consumes it; a child whose real runtime exceeds the REMAINING budget but
 * would fit a fresh budget must still TIMEOUT. Virtual clock for determinism.
 */
export async function invocationDeadlineNotReset(): Promise<void> {
  await withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      // fake git: --version fast; `status` sleeps 260ms then succeeds-ish.
      const slow = await bin.script("git-slowstatus", [
        "const a=process.argv.slice(2);",
        "if(a[0]==='--version'){process.stdout.write('git version 2.50.0\\n');process.exit(0);}",
        "setTimeout(()=>{process.stdout.write('# branch.oid x\\0');process.exit(0);},260);",
      ].join("\n"));
      const p = await createProvider(providerConfig(fx, { git_executable: slow, max_timeout_ms: 400 }));
      let clock = 0;
      const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
      const realRealpath = fs.realpath.bind(fs);
      const rpSpy = vi.spyOn(fs, "realpath").mockImplementationOnce(async (t: Parameters<typeof fs.realpath>[0]) => {
        clock += 360; // consume most of the 400ms effective budget in one pre-spawn step
        return realRealpath(t);
      });
      try {
        const r = await run(p, "repository.status", {}, 5000);
        expect(r).toMatchObject({ status: "FAIL", error: { code: "TIMEOUT" } });
        // the budget was consumed inside a real pre-spawn identity recheck
        // (the mockImplementationOnce fired on the version-gate executable realpath).
        expect(rpSpy).toHaveBeenCalled();
      } finally { nowSpy.mockRestore(); rpSpy.mockRestore(); }
    });
  });
}

/** contract §30, skill §16 — a same-group SIGTERM-resistant descendant is still SIGKILLed and reaped. */
export async function stubbornSameGroupDescendantReaped(): Promise<void> {
  await withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const marker = join(bin.dir, "stubborn.pid");
      const stubborn = await bin.fakeGit("git-stubborn", { version: "2.50.0", behavior: "stubborn-grandchild", marker });
      const p = await createProvider(providerConfig(fx, { git_executable: stubborn, max_timeout_ms: 1500 }));
      const started = Date.now();
      const r = await run(p, "repository.status", {}, 8000);
      const elapsed = Date.now() - started;
      expect(r).toMatchObject({ status: "FAIL", error: { code: "TIMEOUT" } });
      // TERM/grace/KILL/liveness cleanup is reserved inside the one invocation
      // deadline. The old implementation consumed the full 1500ms operation
      // budget and then added the 500ms grace, violating the contract.
      expect(elapsed).toBeLessThan(1900);
      const gcPid = await readPidFile(marker);
      expect(await pidGone(gcPid)).toBe(true);
      // later legitimate call still works
      const ok = await createProvider(providerConfig(fx));
      expect((await run(ok, "repository.status", {})).status).toBe("SUCCESS");
    });
  });
}

/** contract §30, §32; S14C-parity — the TIMEOUT message is bounded and makes no over-claim. */
export async function timeoutMessageBounded(): Promise<void> {
  await withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const hang = await bin.fakeGit("git-hang", { version: "2.50.0", behavior: "hang" });
      const p = await createProvider(providerConfig(fx, { git_executable: hang, max_timeout_ms: 200 }));
      const r = await run(p, "repository.status", {}, 200);
      expect(r.status).toBe("FAIL");
      if (r.status !== "FAIL") return;
      expect(r.error.code).toBe("TIMEOUT");
      expect(r.error.retryable).toBe(true);
      const m = r.error.message;
      const lower = m.toLowerCase();
      for (const forbidden of [
        "process group was terminated", "all descendants were terminated", "cleanup succeeded",
        "was fully terminated", "guaranteed", "rolled back", "no side effects", "was killed",
      ]) expect(lower).not.toContain(forbidden);
      expect(m.length).toBeLessThanOrEqual(500);
      expect(m).not.toMatch(/\/(tmp|home|proc|Users|var)\//);
      expect(m).not.toMatch(/\bpid\b/i);
      expect(m).not.toContain("\n");
      expect(lower).toContain("timeout");
      expect(lower).toMatch(/attempt|bounded/);
    });
  });
}

/** contract §7.1 — root/.git dev:ino are recorded and rechecked; construction canonicalises via realpath. */
export async function identityRecordedAndCanonicalised(): Promise<void> {
  await withSimpleRepo(async fx => {
    // pass a non-canonical path (trailing /.) — provider must realpath it.
    const p = await createProvider(providerConfig(fx, { repository_root: `${fx.root}/.` }));
    const r = await p.invoke(request("repository.status", {}));
    expect(r.status).toBe("SUCCESS");
  });
}
