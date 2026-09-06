import fs from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { expect, vi } from "vitest";
import * as execution from "../../src/providers/capability/shell/execution.js";
import { withShellSandbox, profile, create, config } from "./fixtures.js";
import { request, output, registry, pidGone, readPidFile, until } from "./helpers.js";

const run = (p: Awaited<ReturnType<typeof create>>, input: Record<string, unknown>, timeout_ms = 10000) => p.invoke(request(input, timeout_ms));

/** S14C-HI-014 — executable identity replaced after create(): fail closed, no spawn. */
export async function executableDrift(): Promise<void> {
  await withShellSandbox(async sb => {
    const exe = sb.script("ok");
    const p = await create(config(sb.root, profile({ profile_id: "qa.drift", executable: exe })));
    // Replace the file: same path, new inode.
    await fs.rm(exe);
    await fs.writeFile(exe, `#!${process.execPath}\nprocess.stdout.write("swapped");\n`, { mode: 0o755 });
    await fs.chmod(exe, 0o755);
    const spy = vi.spyOn(execution, "startProcessGroup");
    try {
      expect(await run(p, { profile_id: "qa.drift", cwd: "." })).toMatchObject({ status: "FAIL", error: { code: "UNAVAILABLE" } });
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
}

/** S14C-HI-030 — OS denies exec at launch: normalized PERMISSION_DENIED, no leak. */
export async function permissionDeniedAtSpawn(): Promise<void> {
  await withShellSandbox(async sb => {
    const exe = sb.script("ok");
    const p = await create(config(sb.root, profile({ profile_id: "qa.perm", executable: exe })));
    await fs.chmod(exe, 0o000); // same inode: identity recheck still passes; execve fails EACCES
    const r = await run(p, { profile_id: "qa.perm", cwd: "." });
    expect(r).toMatchObject({ status: "FAIL", error: { code: "PERMISSION_DENIED" } });
    if (r.status === "FAIL") {
      expect(r.error.message.length).toBeLessThanOrEqual(500);
      expect(JSON.stringify(r)).not.toContain(await fs.realpath(sb.root).catch(() => "\0"));
    }
    await fs.chmod(exe, 0o755);
  });
}

/** S14C-HI-017 — stdin is closed and there is no TTY on the child. */
export async function stdioShape(): Promise<void> {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe") })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    try {
      output(await run(p, { profile_id: "qa.probe", cwd: "." }));
      expect(spy).toHaveBeenCalledTimes(1);
      const child = spy.mock.results[0].value as import("node:child_process").ChildProcess;
      expect(child.stdin).toBeNull();
      expect(child.stdio[0]).toBeNull();
    } finally { spy.mockRestore(); }
  });
}

/** S14C-HI-027 — an external signal is reported truthfully as a SUCCESS observation. */
export async function externalSignal(): Promise<void> {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.spin", executable: sb.script("spin"), max_timeout_ms: 30000 })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    try {
      const invocation = run(p, { profile_id: "qa.spin", cwd: "." }, 30000);
      const child = await until(() => spy.mock.results[0]?.value as import("node:child_process").ChildProcess | undefined);
      await until(() => (typeof child.pid === "number" ? child.pid : undefined));
      process.kill(child.pid as number, "SIGTERM");
      const r = await invocation;
      expect(r.status).toBe("SUCCESS");
      if (r.status === "SUCCESS") expect(r.output).toMatchObject({ exit_code: null, signal: "SIGTERM" });
    } finally { spy.mockRestore(); }
  });
}

/** S14C-HI-021 — profile timeout must be positive and <= 300000 ms. */
export async function configTimeoutBounds(): Promise<void> {
  await withShellSandbox(async sb => {
    for (const max_timeout_ms of [0, -1, 300001, Number.NaN, Number.POSITIVE_INFINITY, "5" as never]) {
      await expect(create(config(sb.root, profile({ executable: sb.script("ok"), max_timeout_ms })))).rejects.toThrow();
    }
    await expect(create(config(sb.root, profile({ executable: sb.script("ok"), max_timeout_ms: 300000 })))).resolves.toBeDefined();
  });
}

/** S14C-HI-004 — no hidden workspace-root selection; an unconfigured root is rejected. */
export async function explicitRootOnly(): Promise<void> {
  await withShellSandbox(async sb => {
    await expect(create({} as never)).rejects.toThrow();
    await expect(create({ workspace_root: "workspace", profiles: [profile({ executable: sb.script("ok") })] } as never)).rejects.toThrow();
    await expect(create({ workspace_root: join(sb.root, "nested", "missing"), profiles: [profile({ executable: sb.script("ok") })] })).rejects.toThrow();
  });
}

/** S14C-HI-020 — evidence stays bounded and logical. */
export async function boundedEvidence(): Promise<void> {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), cwd_allow_prefixes: ["nested"] })));
    const r = await run(p, { profile_id: "qa.probe", cwd: "nested/deep" });
    expect(r.evidence_refs).toEqual(["shell://qa.probe@workspace/nested/deep"]);
    expect((r.evidence_refs ?? []).length).toBeLessThanOrEqual(4);
  });
}

// --- Round 2 remediation regressions -------------------------------------------

/**
 * BLOCKER A — a same-group descendant that catches SIGTERM and refuses to exit
 * is still SIGKILLed and reaped before the provider resolves. The group leader
 * dies on SIGTERM first, so its `close` must NOT end the escalation lifecycle.
 */
async function stubbornDescendant(scriptName: "stubborn" | "stubbornflood", maxMs: number, requestMs: number, code: "TIMEOUT" | "EXECUTION_FAILED"): Promise<void> {
  await withShellSandbox(async sb => {
    const marker = join(sb.base, `${scriptName}.pid`);
    const p = await create(config(sb.root, profile({ profile_id: `qa.${scriptName}`, executable: sb.script(scriptName), argv: [marker], max_timeout_ms: maxMs })));
    const started = Date.now();
    const r = await run(p, { profile_id: `qa.${scriptName}`, cwd: "." }, requestMs);
    const elapsed = Date.now() - started;
    expect(r).toMatchObject({ status: "FAIL", error: { code } });
    // Resolution waited for the escalation lifecycle: at least the SIGTERM->SIGKILL
    // grace beyond the trigger. For TIMEOUT the trigger is the deadline itself.
    expect(elapsed).toBeGreaterThanOrEqual(code === "TIMEOUT" ? maxMs : 450);
    const gcPid = await readPidFile(marker);
    if (scriptName === "stubbornflood") {
      const ready = JSON.parse(await fs.readFile(`${marker}.ready`, "utf8")) as { event: string; pid: number; pgrp: number; parent_pgrp: number; stubborn: boolean };
      expect(ready).toMatchObject({ event: "ready", pid: gcPid, stubborn: true });
      expect(ready.pgrp).toBe(ready.parent_pgrp);
    }
    expect(await pidGone(gcPid)).toBe(true);
    // a later legitimate invocation still works
    const ok = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    expect(output(await run(ok, { profile_id: "qa.ok", cwd: "." })).stdout).toBe("ready");
  });
}
export const stubbornGrandchildTimeout = () => stubbornDescendant("stubborn", 600, 8000, "TIMEOUT");
export const stubbornGrandchildOverflow = () => stubbornDescendant("stubbornflood", 30000, 30000, "EXECUTION_FAILED");

/**
 * BLOCKER B — the one effective deadline is min(request, profile) measured from
 * invocation entry; pre-spawn work consumes it. A pre-spawn fs step made to
 * elapse past the smaller bound yields FAIL/TIMEOUT with NO spawn. The clock is
 * virtualised so the proof is deterministic, not wall-clock timing.
 */
async function preSpawnDeadline(maxMs: number, requestMs: number): Promise<void> {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.slow", executable: sb.script("ok"), max_timeout_ms: maxMs })));
    let clock = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
    const realRealpath = fs.realpath.bind(fs);
    const rpSpy = vi.spyOn(fs, "realpath").mockImplementationOnce(async (target: Parameters<typeof fs.realpath>[0]) => {
      clock += Math.min(maxMs, requestMs) + 50; // consume the whole effective budget in one pre-spawn step
      return realRealpath(target);
    });
    const spawnSpy = vi.spyOn(execution, "startProcessGroup");
    try {
      expect(await run(p, { profile_id: "qa.slow", cwd: "." }, requestMs)).toMatchObject({ status: "FAIL", error: { code: "TIMEOUT" } });
      expect(spawnSpy).not.toHaveBeenCalled();
      expect(rpSpy).toHaveBeenCalledTimes(1);
    } finally { nowSpy.mockRestore(); rpSpy.mockRestore(); spawnSpy.mockRestore(); }
  });
}
export const preSpawnTimeoutProfileSmaller = () => preSpawnDeadline(100, 5000);
export const preSpawnTimeoutRequestSmaller = () => preSpawnDeadline(5000, 100);

/**
 * BLOCKER B — pre-spawn elapsed time is charged against the CHILD runtime budget:
 * it is not reset to a fresh full effective timeout at spawn. Virtual clock for
 * the deadline arithmetic; a real child whose real runtime exceeds the *remaining*
 * budget but would fit a *fresh* budget must still TIMEOUT.
 */
export async function remainingBudgetNotReset(): Promise<void> {
  await withShellSandbox(async sb => {
    // effective total 400ms; pre-spawn consumes 320ms -> ~80ms remaining.
    const p = await create(config(sb.root, profile({ profile_id: "qa.rb", executable: sb.script("sleepN"), argv: ["260"], max_timeout_ms: 400 })));
    let clock = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => clock);
    const realRealpath = fs.realpath.bind(fs);
    const rpSpy = vi.spyOn(fs, "realpath").mockImplementationOnce(async (target: Parameters<typeof fs.realpath>[0]) => {
      clock += 320;
      return realRealpath(target);
    });
    try {
      const r = await run(p, { profile_id: "qa.rb", cwd: "." }, 5000);
      // ~80ms remaining < 260ms child -> TIMEOUT. A reset-to-400ms bug would let
      // the 260ms child finish -> SUCCESS.
      expect(r).toMatchObject({ status: "FAIL", error: { code: "TIMEOUT" } });
      // The 320ms must be spent in the single post-create() realpath recheck; if a
      // future refactor moved the pre-spawn identity check the budget would be
      // charged elsewhere and this test would pass for the wrong reason.
      expect(rpSpy).toHaveBeenCalledTimes(1);
    } finally { nowSpy.mockRestore(); rpSpy.mockRestore(); }
  });
}

// --- Round 3 remediation regressions -----------------------------------------

/**
 * ROUND-2 SOURCE-AUDIT BLOCKER #1 — a legal profile whose executable lives
 * physically INSIDE workspace_root. Contract §26 requires the canonical
 * executable realpath -> `<executable>` and canonical workspace root ->
 * `workspace://`. If the workspace-root prefix is substituted first, an
 * executable-under-root path degrades to `workspace:///tools/inside-exe` and
 * never becomes `<executable>`. The executable-specific replacements must run
 * before the root replacement.
 *
 * The fixture executable is written under `<root>/tools/` and prints both its own
 * launch path (`process.argv[1]`, i.e. the realpath the provider passed to spawn)
 * and its `process.cwd()` (which resolves to the workspace root). The normalized
 * `exe` must be exactly `<executable>` (executable token wins over the overlapping
 * root prefix) AND the normalized `cwd` must still be `workspace://` (a
 * non-executable path under the root is NOT collapsed to `<executable>` and the
 * raw root never leaks) — the two directions together pin the replacement order.
 */
export async function executableInsideWorkspace(): Promise<void> {
  await withShellSandbox(async sb => {
    const dir = join(sb.root, "tools");
    await fs.mkdir(dir);
    const exe = join(dir, "inside-exe");
    await fs.writeFile(exe, `#!${process.execPath}\nprocess.stdout.write(JSON.stringify({ exe: process.argv[1], cwd: process.cwd() }));\n`, { mode: 0o755 });
    await fs.chmod(exe, 0o755);
    const rootReal = await fs.realpath(sb.root);
    const exeReal = await fs.realpath(exe);
    // The overlap precondition the Round-2 order got wrong.
    expect(exeReal.startsWith(`${rootReal}/`)).toBe(true);
    const cfg = config(sb.root, profile({ profile_id: "qa.inside", executable: exe }));

    for (const via of ["provider", "registry"] as const) {
      const p = await create(cfg);
      const r = via === "provider"
        ? await run(p, { profile_id: "qa.inside", cwd: "." })
        : await registry(p).invoke(request({ profile_id: "qa.inside", cwd: "." }));
      const o = output(r);
      const emitted = JSON.parse(o.stdout as string) as { exe: string; cwd: string };
      // The executable token wins over the overlapping workspace-root prefix...
      expect(emitted.exe).toBe("<executable>");
      // ...and a non-executable path under the root is still `workspace://`,
      // never `<executable>` and never the raw root.
      expect(emitted.cwd).toBe("workspace://");
      expect(String(o.stdout)).not.toContain("workspace:///tools/inside-exe");
      const serialized = JSON.stringify(r);
      expect(serialized).not.toContain(exeReal);
      expect(serialized).not.toContain(rootReal);
      if (via === "provider") expect(r.evidence_refs).toEqual(["shell://qa.inside@workspace/."]);
    }
  });
}

/**
 * ROUND-2 SOURCE-AUDIT BLOCKER #2 — the canonical TIMEOUT failure message must
 * stay within the bounded guarantee. Cleanup is attempted within a finite
 * budget and may return with the group not yet fully reaped, so the message
 * must not assert unconditional process-group / child extinction, must not
 * leak host detail, and must not claim rollback of completed LOCAL effects.
 * Status/code/retryable are unchanged.
 */
export async function timeoutMessageBounded(): Promise<void> {
  await withShellSandbox(async sb => {
    // Small real timeout; `spin` has no SIGTERM handler so it dies immediately
    // and no SIGKILL escalation runs. Whether the deadline is reached pre- or
    // post-spawn the returned message is the same canonical TIMEOUT message.
    const p = await create(config(sb.root, profile({ profile_id: "qa.spin", executable: sb.script("spin"), max_timeout_ms: 150 })));
    const r = await run(p, { profile_id: "qa.spin", cwd: "." }, 150);
    expect(r.status).toBe("FAIL");
    if (r.status !== "FAIL") return;
    expect(r.error.code).toBe("TIMEOUT");
    expect(r.error.retryable).toBe(true);
    const m = r.error.message;
    const lower = m.toLowerCase();
    for (const forbidden of [
      "process group was terminated",
      "process group has been terminated",
      "all children were terminated",
      "all descendants were terminated",
      "cleanup succeeded",
      "was fully terminated",
      "were fully terminated",
      "guaranteed",
      "was killed",
      "were killed",
    ]) expect(lower).not.toContain(forbidden);
    // no rollback / no-side-effect claim
    expect(lower).not.toContain("rolled back");
    expect(lower).not.toContain("no side effects");
    expect(lower).not.toContain("no local");
    // bounded, host-detail-free
    expect(m.length).toBeLessThanOrEqual(500);
    expect(m).not.toMatch(/\/(tmp|home|proc|Users|private|var)\//);
    expect(m).not.toMatch(/\bpid\b/i);
    expect(m).not.toContain("\n");
    // it does describe a bounded attempt
    expect(lower).toContain("timeout");
    expect(lower).toMatch(/attempt|bounded/);
  });
}
