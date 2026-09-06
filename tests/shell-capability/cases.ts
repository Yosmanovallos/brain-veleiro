import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, vi } from "vitest";
import * as execution from "../../src/providers/capability/shell/execution.js";
import { withShellSandbox, profile, create, config, type ShellSandbox } from "./fixtures.js";
import { request, output, registry, restricted, agentExec, definition, pidGone, readPidFile, CAP } from "./helpers.js";
import { assertBoundaries, closureClaims, inferredScope, phaseText, productionSources, shellFutureSurface, text } from "./audit.js";
import type { WorkspaceShellCommandProfile, WorkspaceShellConfig } from "../../src/providers/capability/shell/types.js";

type Provider = Awaited<ReturnType<typeof create>>;
const run = (p: Provider, input: Record<string, unknown>, timeout_ms = 10000) => p.invoke(request(input, timeout_ms));
const blocked = (value: unknown) => expect(value).toMatchObject({ status: "BLOCKED" });
const failCode = (value: unknown, code: string) => expect(value).toMatchObject({ status: "FAIL", error: { code } });

/**
 * Assert `body` rejected before any child process was launched — checked two
 * independent ways: the raw launcher spy is never called, and (for a profile
 * whose fixture would have written a marker file) no marker appears on disk.
 */
async function noSpawn(sb: ShellSandbox, body: () => Promise<void>): Promise<void> {
  const spy = vi.spyOn(execution, "startProcessGroup");
  try {
    await body();
    expect(spy).not.toHaveBeenCalled();
    expect(existsSync(join(sb.base, "SPAWNED"))).toBe(false);
  } finally { spy.mockRestore(); }
}

/** One-profile provider over a fresh sandbox. `redirect` writes base/SPAWNED if ever run. */
async function withProbe(overrides: Partial<WorkspaceShellCommandProfile>, exercise: (p: Provider, sb: ShellSandbox) => Promise<void>): Promise<void> {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.p", executable: sb.script("redirect"), argv: [join(sb.base, "SPAWNED")], ...overrides })));
    await exercise(p, sb);
  });
}

export const positives: Record<string, () => Promise<void>> = {
  "FX-POS-001": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const caps = await p.list_capabilities();
    expect(caps.map(d => [d.capability_id, d.side_effects])).toEqual([[CAP, "LOCAL"]]);
    expect(caps).toHaveLength(1);
  }),
  "FX-POS-002": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    expect(output(await run(p, { profile_id: "qa.ok", cwd: "." }))).toEqual({
      profile_id: "qa.ok", cwd: ".", exit_code: 0, signal: null, stdout: "ready", stderr: "", stdout_bytes: 5, stderr_bytes: 0,
    });
  }),
  "FX-POS-003": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.exit2", executable: sb.script("exit2") })));
    expect(output(await run(p, { profile_id: "qa.exit2", cwd: "." }))).toMatchObject({ exit_code: 2, signal: null, stderr: "boom", stdout: "" });
  }),
  "FX-POS-004": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), cwd_allow_prefixes: ["nested"] })));
    const r = output(await run(p, { profile_id: "qa.probe", cwd: "nested/deep" }));
    expect(JSON.parse(r.stdout as string).cwd).toBe("workspace:///nested/deep");
    expect(r.cwd).toBe("nested/deep");
  }),
  "FX-POS-005": () => withShellSandbox(async sb => {
    const meta = [";", "|", "&&", "$(id)", "`whoami`", "*", "> redirected.txt", "a b\tc"];
    const p = await create(config(sb.root, profile({ profile_id: "qa.meta", executable: sb.script("probe"), argv: meta })));
    const r = output(await run(p, { profile_id: "qa.meta", cwd: "." }));
    expect(JSON.parse(r.stdout as string).argv).toEqual(meta);
    await expect(fs.lstat(join(sb.root, "redirected.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  }),
  "FX-POS-006": () => withShellSandbox(async sb => {
    process.env.BRAIN_S14C_HOST_SENTINEL = "leak";
    try {
      const p = await create(config(sb.root, profile({ profile_id: "qa.env", executable: sb.script("probe"), env: { SAFE_KEY: "safe-value", PATH: "/usr/bin:/bin" } })));
      const env = JSON.parse((output(await run(p, { profile_id: "qa.env", cwd: "." })).stdout as string)).env;
      expect(env).toEqual({ SAFE_KEY: "safe-value", PATH: "/usr/bin:/bin" });
    } finally { delete process.env.BRAIN_S14C_HOST_SENTINEL; }
  }),
  "FX-POS-007": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.max", executable: sb.script("emit"), argv: ["524288", "both"], max_timeout_ms: 30000 })));
    const direct = output(await run(p, { profile_id: "qa.max", cwd: "." }, 30000));
    expect([direct.stdout_bytes, direct.stderr_bytes]).toEqual([524288, 524288]);
    expect((direct.stdout as string).length).toBe(524288);
    const viaRegistry = await registry(p).invoke(request({ profile_id: "qa.max", cwd: "." }, 30000));
    expect(viaRegistry.status).toBe("SUCCESS");
    if (viaRegistry.status === "SUCCESS") expect(viaRegistry.output).toEqual(direct);
  }),
  "FX-POS-008": () => withShellSandbox(async sb => {
    const fast = await create(config(sb.root, profile({ profile_id: "qa.sleep", executable: sb.script("sleep"), max_timeout_ms: 5000 })));
    expect(output(await run(fast, { profile_id: "qa.sleep", cwd: "." }, 4000))).toMatchObject({ exit_code: 0, stdout: "slept" });
    const spin = await create(config(sb.root, profile({ profile_id: "qa.spin", executable: sb.script("spin"), max_timeout_ms: 30000 })));
    let started = Date.now();
    failCode(await run(spin, { profile_id: "qa.spin", cwd: "." }, 250), "TIMEOUT");
    expect(Date.now() - started).toBeLessThan(5000);
    const capped = await create(config(sb.root, profile({ profile_id: "qa.capped", executable: sb.script("spin"), max_timeout_ms: 250 })));
    started = Date.now();
    failCode(await run(capped, { profile_id: "qa.capped", cwd: "." }, 30000), "TIMEOUT");
    expect(Date.now() - started).toBeLessThan(5000);
  }),
  "FX-POS-009": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const r = restricted(p, [CAP], ["NONE", "LOCAL"]);
    expect((await r.list_capabilities()).map(d => [d.capability_id, d.side_effects])).toEqual([[CAP, "LOCAL"]]);
    expect(output(await r.invoke(request({ profile_id: "qa.ok", cwd: "." }))).stdout).toBe("ready");
  }),
  "FX-POS-010": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const direct = output(await run(p, { profile_id: "qa.ok", cwd: "." }));
    const reg = registry(p);
    const viaRegistry = await reg.invoke(request({ profile_id: "qa.ok", cwd: "." }));
    expect(viaRegistry.status).toBe("SUCCESS");
    if (viaRegistry.status === "SUCCESS") expect(viaRegistry.output).toEqual(direct);
    expect(reg.diagnostics().map(d => d.capability_id)).toEqual([CAP]);
  }),
  "FX-POS-011": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const result = await agentExec(registry(p) as never, { profile_id: "qa.ok", cwd: "." });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.events.some(e => e.type === "TOOL_COMPLETED")).toBe(true);
    expect((result.output?.data as Record<string, unknown>)?.stdout).toBe("ready");
    expect(result.output?.evidence_refs).toEqual(["shell://qa.ok@workspace/."]);
  }),
  "FX-POS-012": () => withShellSandbox(async sb => {
    const before = JSON.stringify(definition);
    const a = await create(config(sb.root, profile({ profile_id: "qa.swap", executable: sb.script("ok"), argv: [] })));
    const first = await agentExec(registry(a, "impl-a") as never, { profile_id: "qa.swap", cwd: "." }, "impl-a");
    expect((first.output?.data as Record<string, unknown>)?.stdout).toBe("ready");
    const b = await create(config(sb.root, profile({ profile_id: "qa.swap", executable: sb.script("probe"), argv: ["x"] })));
    const second = await agentExec(registry(b, "impl-b") as never, { profile_id: "qa.swap", cwd: "." }, "impl-b");
    expect(second.outcome).toBe("SUCCESS");
    expect(JSON.parse((second.output?.data as Record<string, unknown>)?.stdout as string).argv).toEqual(["x"]);
    expect(JSON.stringify(definition)).toBe(before);
  }),
  "FX-POS-013": () => withShellSandbox(async sb => {
    const marker = join(sb.base, "pos13.pid");
    const p = await create(config(sb.root, profile({ profile_id: "qa.tree", executable: sb.script("tree"), argv: [marker], max_timeout_ms: 600 })));
    failCode(await run(p, { profile_id: "qa.tree", cwd: "." }, 5000), "TIMEOUT");
    const gcPid = await readPidFile(marker);
    expect(await pidGone(gcPid)).toBe(true);
    const ok = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    expect(output(await run(ok, { profile_id: "qa.ok", cwd: "." })).stdout).toBe("ready");
  }),
  "FX-POS-014": async () => {
    let removed = "";
    await withShellSandbox(async sb => {
      removed = sb.base;
      const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
      output(await run(p, { profile_id: "qa.ok", cwd: "." }));
    });
    await expect(fs.lstat(removed)).rejects.toMatchObject({ code: "ENOENT" });
  },
};

const badCwds: Array<[string, string[]]> = [
  ["FX-NEG-007", ["/etc/passwd", "/", "/tmp/x"]],
  ["FX-NEG-008", ["C:/work/file", "c:/x", "D:\\x"]],
  ["FX-NEG-009", ["//host/share/file", "\\\\host\\share", "a\\b"]],
  ["FX-NEG-010", ["../file", "a/../b", "..", "nested/../../x"]],
  ["FX-NEG-011", ["a/./b", "a//b", "./a", "a/", "a\0b", ""]],
  ["FX-NEG-012", ["a".repeat(4097), Array(257).fill("a").join("/"), "\u00e9".repeat(128)]],
];

export const negatives: Record<string, () => Promise<void>> = {
  "FX-NEG-001": () => withProbe({}, (p, sb) => noSpawn(sb, async () => { blocked(await run(p, { profile_id: "qa.unregistered", cwd: "." })); })),
  "FX-NEG-002": () => withProbe({}, (p, sb) => noSpawn(sb, async () => {
    for (const profile_id of ["", "Bad", "no spaces", "-leading", ".leading", "x".repeat(161), "UPPER"]) failCode(await run(p, { profile_id, cwd: "." }), "INVALID_INPUT");
    failCode(await run(p, { profile_id: 5 as never, cwd: "." }), "INVALID_INPUT");
  })),
  "FX-NEG-003": () => withProbe({}, (p, sb) => noSpawn(sb, async () => { failCode(await run(p, { profile_id: "qa.p", cwd: ".", executable: sb.script("probe") }), "INVALID_INPUT"); })),
  "FX-NEG-004": () => withProbe({}, (p, sb) => noSpawn(sb, async () => {
    failCode(await run(p, { profile_id: "qa.p", cwd: ".", argv: ["x"] }), "INVALID_INPUT");
    failCode(await run(p, { profile_id: "qa.p", cwd: ".", args: ["x"] }), "INVALID_INPUT");
  })),
  "FX-NEG-005": () => withProbe({}, (p, sb) => noSpawn(sb, async () => {
    failCode(await run(p, { profile_id: "qa.p", cwd: ".", env: { X: "1" } }), "INVALID_INPUT");
    failCode(await run(p, { profile_id: "qa.p", cwd: ".", environment: { X: "1" } }), "INVALID_INPUT");
  })),
  "FX-NEG-006": () => withProbe({}, (p, sb) => noSpawn(sb, async () => {
    for (const extra of [{ stdin: "d" }, { shell: true }, { provider_id: "x" }, { timeout_ms: 1 }, { command: "ls" }, { host_path: "/x" }]) {
      failCode(await run(p, { profile_id: "qa.p", cwd: ".", ...extra }), "INVALID_INPUT");
    }
  })),
  ...Object.fromEntries(badCwds.map(([id, paths]) => [id, () => withProbe({}, (p, sb) => noSpawn(sb, async () => {
    for (const cwd of paths) failCode(await run(p, { profile_id: "qa.p", cwd }), "INVALID_INPUT");
  }))])),
  "FX-NEG-013": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), cwd_allow_prefixes: ["nested"] })));
    await noSpawn(sb, async () => {
      blocked(await run(p, { profile_id: "qa.probe", cwd: "." }));
      blocked(await run(p, { profile_id: "qa.probe", cwd: "nested-other" }));
    });
    expect(output(await run(p, { profile_id: "qa.probe", cwd: "nested" })).cwd).toBe("nested");
  }),
  "FX-NEG-014": () => withProbe({ cwd_allow_prefixes: ["."] }, (p, sb) => noSpawn(sb, async () => {
    for (const cwd of [".git", ".git/hooks", ".ssh", ".gnupg/x", ".aws", ".azure/y", ".kube"]) blocked(await run(p, { profile_id: "qa.p", cwd }));
  })),
  "FX-NEG-015": () => withShellSandbox(async sb => {
    await fs.symlink(join(sb.root, "nested"), join(sb.root, "linkdir"));
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe") })));
    await noSpawn(sb, async () => { blocked(await run(p, { profile_id: "qa.probe", cwd: "linkdir/deep" })); });
  }),
  "FX-NEG-016": () => withShellSandbox(async sb => {
    await fs.symlink(join(sb.root, "nested"), join(sb.root, "linkdir"));
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe") })));
    await noSpawn(sb, async () => { blocked(await run(p, { profile_id: "qa.probe", cwd: "linkdir" })); });
  }),
  "FX-NEG-017": () => withProbe({}, (p, sb) => noSpawn(sb, async () => { failCode(await run(p, { profile_id: "qa.p", cwd: "absent/dir" }), "NOT_FOUND"); })),
  "FX-NEG-018": () => withShellSandbox(async sb => {
    await fs.writeFile(join(sb.root, "afile"), "x");
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe") })));
    await noSpawn(sb, async () => { failCode(await run(p, { profile_id: "qa.probe", cwd: "afile" }), "INVALID_INPUT"); });
  }),
  "FX-NEG-019": () => withShellSandbox(async sb => {
    await expect(create(config(sb.root, profile({ executable: "bin/ok" })))).rejects.toThrow();
    await expect(create(config(sb.root, profile({ executable: "./ok" })))).rejects.toThrow();
  }),
  "FX-NEG-020": () => withShellSandbox(async sb => {
    await expect(create(config(sb.root, profile({ executable: join(sb.bin, "missing-exe") })))).rejects.toThrow();
  }),
  "FX-NEG-021": () => withShellSandbox(async sb => {
    await expect(create(config(sb.root, profile({ executable: sb.root })))).rejects.toThrow();
    await expect(create(config(sb.root, profile({ executable: sb.bin })))).rejects.toThrow();
  }),
  "FX-NEG-022": () => withShellSandbox(async sb => {
    await fs.chmod(sb.script("ok"), 0o644);
    await expect(create(config(sb.root, profile({ executable: sb.script("ok") })))).rejects.toThrow();
  }),
  "FX-NEG-023": () => withShellSandbox(async sb => {
    await expect(create({ workspace_root: sb.root, profiles: [
      profile({ profile_id: "qa.dup", executable: sb.script("ok") }),
      profile({ profile_id: "qa.dup", executable: sb.script("probe") }),
    ] })).rejects.toThrow();
  }),
  "FX-NEG-024": () => withShellSandbox(async sb => {
    const many = Array.from({ length: 65 }, (_, i) => profile({ profile_id: `qa.p${i}`, executable: sb.script("ok") }));
    await expect(create({ workspace_root: sb.root, profiles: many })).rejects.toThrow();
    await expect(create({ workspace_root: sb.root, profiles: many.slice(0, 64) })).resolves.toBeDefined();
  }),
  "FX-NEG-025": () => withShellSandbox(async sb => {
    for (const profile_id of ["Bad Id", "x".repeat(161), "has space", "UPPER", "-x", ""]) {
      await expect(create(config(sb.root, profile({ profile_id, executable: sb.script("ok") })))).rejects.toThrow();
    }
  }),
  "FX-NEG-026": () => withShellSandbox(async sb => {
    await expect(create(config(sb.root, profile({ executable: sb.script("ok"), argv: Array(65).fill("a") })))).rejects.toThrow();
  }),
  "FX-NEG-027": () => withShellSandbox(async sb => {
    await expect(create(config(sb.root, profile({ executable: sb.script("ok"), argv: ["a".repeat(4097)] })))).rejects.toThrow();
    await expect(create(config(sb.root, profile({ executable: sb.script("ok"), argv: Array(9).fill("a".repeat(4096)) })))).rejects.toThrow();
    await expect(create(config(sb.root, profile({ executable: sb.script("ok"), argv: Array(8).fill("a".repeat(4096)) })))).resolves.toBeDefined();
  }),
  "FX-NEG-028": () => withShellSandbox(async sb => {
    await expect(create(config(sb.root, profile({ executable: sb.script("ok"), argv: ["a\0b"] })))).rejects.toThrow();
  }),
  "FX-NEG-029": () => withShellSandbox(async sb => {
    const base = (env: Record<string, string>): WorkspaceShellConfig => config(sb.root, profile({ executable: sb.script("ok"), env }));
    await expect(create(base(Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`K${i}`, "v"]))))).rejects.toThrow();
    await expect(create(base({ ["K".repeat(129)]: "v" }))).rejects.toThrow();
    await expect(create(base({ K: "v".repeat(4097) }))).rejects.toThrow();
    await expect(create(base(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`K${i}`, "v".repeat(4096)]))))).rejects.toThrow();
    await expect(create(base({ SAFE: "value", PATH: "/usr/bin" }))).resolves.toBeDefined();
  }),
  "FX-NEG-030": () => withShellSandbox(async sb => {
    for (const key of ["API_KEY", "MY_SECRET", "DB_PASSWORD", "SESSION_TOKEN", "ACCESS_TOKEN", "CLIENT_SECRET", "AUTH_REF", "GH_TOKEN"]) {
      await expect(create(config(sb.root, profile({ executable: sb.script("ok"), env: { [key]: "x" } })))).rejects.toThrow();
    }
  }),
  "FX-NEG-031": () => withShellSandbox(async sb => {
    for (const key of ["LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES", "NODE_OPTIONS", "PYTHONPATH", "PYTHONHOME", "RUBYOPT", "PERL5OPT", "BASH_ENV", "ENV", "IFS", "SHELLOPTS"]) {
      await expect(create(config(sb.root, profile({ executable: sb.script("ok"), env: { [key]: "x" } })))).rejects.toThrow();
    }
  }),
  "FX-NEG-032": () => withShellSandbox(async sb => {
    process.env.BRAIN_S14C_ABSENT_SENTINEL = "must-not-leak";
    try {
      const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), env: { PATH: "/usr/bin:/bin" } })));
      const env = JSON.parse((output(await run(p, { profile_id: "qa.probe", cwd: "." })).stdout as string)).env;
      expect("BRAIN_S14C_ABSENT_SENTINEL" in env).toBe(false);
      expect(env).toEqual({ PATH: "/usr/bin:/bin" });
    } finally { delete process.env.BRAIN_S14C_ABSENT_SENTINEL; }
  }),
  "FX-NEG-033": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.o", executable: sb.script("emit"), argv: ["524289", "out"], max_timeout_ms: 30000 })));
    const r = await run(p, { profile_id: "qa.o", cwd: "." }, 30000);
    failCode(r, "EXECUTION_FAILED");
    expect(r.status).not.toBe("SUCCESS");
  }),
  "FX-NEG-034": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.e", executable: sb.script("emit"), argv: ["524289", "err"], max_timeout_ms: 30000 })));
    failCode(await run(p, { profile_id: "qa.e", cwd: "." }, 30000), "EXECUTION_FAILED");
  }),
  "FX-NEG-035": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.c", executable: sb.script("emit"), argv: ["700000", "both"], max_timeout_ms: 30000 })));
    failCode(await run(p, { profile_id: "qa.c", cwd: "." }, 30000), "EXECUTION_FAILED");
  }),
  "FX-NEG-036": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.bad", executable: sb.script("badutf8") })));
    const r = await run(p, { profile_id: "qa.bad", cwd: "." });
    failCode(r, "INVALID_INPUT");
    expect(JSON.stringify(r)).not.toContain("\\ufffd");
  }),
  "FX-NEG-037": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.secret", executable: sb.script("secret") })));
    const r = await run(p, { profile_id: "qa.secret", cwd: "." });
    blocked(r);
    expect(JSON.stringify(r)).not.toContain("synthetic-abcdef123456");
  }),
  "FX-NEG-038": () => withShellSandbox(async sb => {
    const exe = sb.script("leak");
    const rootReal = await fs.realpath(sb.root);
    const exeReal = await fs.realpath(exe);
    const p = await create(config(sb.root, profile({ profile_id: "qa.leak", executable: exe, argv: [rootReal, exeReal] })));
    const r = await run(p, { profile_id: "qa.leak", cwd: "." });
    expect(output(r).stdout).toBe("workspace://|<executable>");
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain(rootReal);
    expect(serialized).not.toContain(exeReal);
    expect(r.evidence_refs).toEqual(["shell://qa.leak@workspace/."]);
  }),
  "FX-NEG-039": () => withShellSandbox(async sb => {
    for (const [name, key, timeout, code, maxMs] of [["tree", "t", 5000, "TIMEOUT", 600], ["treeflood", "f", 30000, "EXECUTION_FAILED", 30000]] as const) {
      const marker = join(sb.base, `neg39-${key}.pid`);
      const p = await create(config(sb.root, profile({ profile_id: `qa.${key}`, executable: sb.script(name), argv: [marker], max_timeout_ms: maxMs })));
      failCode(await run(p, { profile_id: `qa.${key}`, cwd: "." }, timeout), code);
      const gcPid = await readPidFile(marker);
      if (name === "treeflood") {
        const ready = JSON.parse(await fs.readFile(`${marker}.ready`, "utf8")) as { event: string; pid: number; pgrp: number; parent_pgrp: number; stubborn: boolean };
        expect(ready).toMatchObject({ event: "ready", pid: gcPid, stubborn: false });
        expect(ready.pgrp).toBe(ready.parent_pgrp);
      }
      expect(await pidGone(gcPid)).toBe(true);
    }
  }),
  "FX-NEG-040": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    const spyInvoke = vi.spyOn(p, "invoke");
    try {
      blocked(await restricted(p, [], ["NONE", "LOCAL"]).invoke(request({ profile_id: "qa.ok", cwd: "." })));
      expect(spy).not.toHaveBeenCalled();
      expect(spyInvoke).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); spyInvoke.mockRestore(); }
  }),
  "FX-NEG-041": () => withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    const spyInvoke = vi.spyOn(p, "invoke");
    try {
      blocked(await restricted(p, [CAP], ["NONE"]).invoke(request({ profile_id: "qa.ok", cwd: "." })));
      expect(spy).not.toHaveBeenCalled();
      expect(spyInvoke).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); spyInvoke.mockRestore(); }
  }),
  "FX-NEG-042": async () => {
    assertBoundaries();
    const src = productionSources();
    expect(shellFutureSurface(src)).toBe(0);
    expect(inferredScope(src)).toBe(0);
    expect(closureClaims(phaseText())).toBe(0);
    expect(text("package.json")).not.toMatch(/"(?:node-pty|execa|shelljs|cross-spawn|zx)"/);
    const report = "brain-bootstrap/reports/S14C-shell-capability-verification.md";
    if (existsSync(report)) {
      expect(/\b(?:provides?|guarantees?|is)\s+(?:an?\s+)?(?:OS-level\s+network sandbox|arbitrary-executable sandbox|container isolation)/i.test(text(report))).toBe(false);
    }
  },
};
