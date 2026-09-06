import fs from "node:fs/promises";
import { join } from "node:path";
import { expect, vi } from "vitest";
import * as execution from "../../src/providers/capability/shell/execution.js";
import { withShellSandbox, profile, create, config } from "./fixtures.js";
import { request, output, until } from "./helpers.js";

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
