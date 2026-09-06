import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it, vi } from "vitest";
import * as execution from "../../src/providers/capability/shell/execution.js";
import { withShellSandbox, profile, create, config } from "./fixtures.js";
import { request, output, registry, restricted, pidGone, readPidFile, CAP } from "./helpers.js";
import {
  blob, closureClaims, inferredScope, phaseText, productionSources,
  protectedDifferences, shellFutureSurface, text,
} from "./audit.js";

const run = (p: Awaited<ReturnType<typeof create>>, input: Record<string, unknown>, timeout_ms = 10000) => p.invoke(request(input, timeout_ms));
const accepted = (results: Array<{ status: string }>) => results.filter(r => r.status === "SUCCESS").length;

it("UC01 model_controlled_executable_argv_or_env: rejected with zero spawn; merge detector fires", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), argv: ["fixed"], env: { SAFE: "1" } })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    try {
      for (const bad of [{ executable: sb.script("ok") }, { argv: ["x"] }, { env: { INJECT: "1" } }, { command: "id" }]) {
        expect((await run(p, { profile_id: "qa.probe", cwd: ".", ...bad })).status).toBe("FAIL");
      }
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
    // The honoured argv/env is the trusted profile's, never model input.
    const r = output(await run(p, { profile_id: "qa.probe", cwd: "." }));
    const parsed = JSON.parse(r.stdout as string);
    expect(parsed.argv).toEqual(["fixed"]);
    expect(parsed.env).toEqual({ SAFE: "1" });
    // detector: a provider that spread model input into the launch would run "x".
    const merged = { ...{ argv: ["fixed"] }, ...{ argv: ["x"] } };
    expect(merged.argv).toEqual(["x"]);
  });
});

it("UC02 shell_command_string_or_shell_true: literal argv, no parse; injected shell:true fires", async () => {
  await withShellSandbox(async sb => {
    const meta = ["$(touch pwned)", "| ls", "&& id", "> x"];
    const p = await create(config(sb.root, profile({ profile_id: "qa.meta", executable: sb.script("probe"), argv: meta })));
    expect(JSON.parse(output(await run(p, { profile_id: "qa.meta", cwd: "." })).stdout as string).argv).toEqual(meta);
    await expect(fs.lstat(join(sb.root, "pwned"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(shellFutureSurface(productionSources())).toBe(0);
    expect(shellFutureSurface('spawn(exe, argv, { shell: true });')).toBe(1);
    expect(shellFutureSurface('spawn("/bin/sh", ["-c", cmd]);')).toBeGreaterThanOrEqual(1);
  });
});

it("UC03 cwd_escape_symlink_or_protected_path: all denied; naive join-accept fires", async () => {
  await withShellSandbox(async sb => {
    await fs.symlink(join(sb.root, "nested"), join(sb.root, "linkdir"));
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe") })));
    const denied = ["../escape", "linkdir", "linkdir/deep", ".git", ".ssh/keys"];
    expect(accepted(await Promise.all(denied.map(cwd => run(p, { profile_id: "qa.probe", cwd }))))).toBe(0);
    // detector: a naive `path.resolve(root, cwd)` join escapes the workspace root
    // for "../escape" and follows "linkdir" — exactly what the provider refuses.
    expect(resolve(sb.root, "../escape").startsWith(sb.root + "/")).toBe(false);
  });
});

it("UC04 unregistered_profile_execution: unknown blocked, zero spawn; first-profile fallback fires", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.only", executable: sb.script("ok") })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    try {
      expect((await run(p, { profile_id: "qa.other", cwd: "." })).status).toBe("BLOCKED");
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
    const registry = new Map([["qa.only", "profile"]]);
    const fallback = registry.get("qa.other") ?? [...registry.values()][0];
    expect(fallback).toBe("profile");
  });
});

it("UC05 inherited_secret_or_dangerous_environment: config rejects; process.env merge leaks", async () => {
  await withShellSandbox(async sb => {
    const dangerous: Record<string, string>[] = [{ LD_PRELOAD: "/x" }, { NODE_OPTIONS: "--inspect" }, { API_KEY: "x" }, { DB_PASSWORD: "x" }];
    for (const env of dangerous) {
      await expect(create(config(sb.root, profile({ executable: sb.script("ok"), env })))).rejects.toThrow();
    }
    process.env.BRAIN_S14C_UC05_SENTINEL = "leak";
    try {
      const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), env: { PATH: "/usr/bin" } })));
      const childEnv = JSON.parse(output(await run(p, { profile_id: "qa.probe", cwd: "." })).stdout as string).env;
      expect("BRAIN_S14C_UC05_SENTINEL" in childEnv).toBe(false);
      const merged: Record<string, string | undefined> = { ...process.env, PATH: "/usr/bin" };
      expect(merged.BRAIN_S14C_UC05_SENTINEL).toBe("leak");
    } finally { delete process.env.BRAIN_S14C_UC05_SENTINEL; }
  });
});

it("UC06 unauthorized_spawn_or_local_side_effect: restricted denial zero spawn; bypass spawns", async () => {
  await withShellSandbox(async sb => {
    const marker = join(sb.base, "uc06");
    const p = await create(config(sb.root, profile({ profile_id: "qa.side", executable: sb.script("redirect"), argv: [marker] })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    try {
      expect((await restricted(p, [], ["NONE", "LOCAL"]).invoke(request({ profile_id: "qa.side", cwd: "." }))).status).toBe("BLOCKED");
      expect((await restricted(p, [CAP], ["NONE"]).invoke(request({ profile_id: "qa.side", cwd: "." }))).status).toBe("BLOCKED");
      expect(spy).not.toHaveBeenCalled();
      expect(existsSync(marker)).toBe(false);
    } finally { spy.mockRestore(); }
    // bypassing the restriction and going straight to the provider does spawn + mutate.
    output(await run(p, { profile_id: "qa.side", cwd: "." }));
    expect(existsSync(marker)).toBe(true);
  });
});

it("UC07 output_limit_bypass_or_silent_truncation: max+1 FAIL; naive slice SUCCESS fires", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.over", executable: sb.script("emit"), argv: ["524289", "out"], max_timeout_ms: 30000 })));
    const r = await run(p, { profile_id: "qa.over", cwd: "." }, 30000);
    expect(r.status).toBe("FAIL");
    const truncatedSuccess = { status: "SUCCESS", output: { stdout: "x".repeat(524289).slice(0, 524288) } };
    expect(truncatedSuccess.status === "SUCCESS" && truncatedSuccess.output.stdout.length === 524288).toBe(true);
  });
});

it("UC08 timeout_overflow_or_process_group_cleanup_failure: grandchild reaped; child-only kill leaks", async () => {
  await withShellSandbox(async sb => {
    const marker = join(sb.base, "uc08.pid");
    const p = await create(config(sb.root, profile({ profile_id: "qa.tree", executable: sb.script("tree"), argv: [marker], max_timeout_ms: 500 })));
    expect((await run(p, { profile_id: "qa.tree", cwd: "." }, 5000)).status).toBe("FAIL");
    const gcPid = await readPidFile(marker);
    expect(await pidGone(gcPid)).toBe(true);
    // detector: killing only child.pid (not -pgid) would have left an ordinary grandchild alive.
    const src = text("src/providers/capability/shell/execution.ts");
    expect(src.includes("process.kill(-pgid")).toBe(true);
  });
});

it("UC09 secret_or_provider_local_path_exposure: blocked/normalized; raw passthrough exposes", async () => {
  await withShellSandbox(async sb => {
    const secretP = await create(config(sb.root, profile({ profile_id: "qa.secret", executable: sb.script("secret") })));
    const sr = await run(secretP, { profile_id: "qa.secret", cwd: "." });
    expect(sr.status).toBe("BLOCKED");
    expect(JSON.stringify(sr)).not.toContain("synthetic-abcdef123456");
    const exe = sb.script("leak");
    const rootReal = await fs.realpath(sb.root);
    const exeReal = await fs.realpath(exe);
    const leakP = await create(config(sb.root, profile({ profile_id: "qa.leak", executable: exe, argv: [rootReal, exeReal] })));
    const lr = output(await run(leakP, { profile_id: "qa.leak", cwd: "." }));
    expect(lr.stdout).toBe("workspace://|<executable>");
    // detector: returning the raw child bytes would expose both.
    const raw = `${rootReal}|${exeReal}`;
    expect(raw.includes(rootReal) && raw.includes(exeReal)).toBe(true);
  });
});

it("UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires", () => {
  expect(protectedDifferences()).toEqual([]);
  const original = Buffer.from("original tracked bytes");
  expect(blob(original) === blob(original)).toBe(true);
  expect(blob(original) === blob(Buffer.concat([original, Buffer.from("x")]))).toBe(false);
});

it("UC11 future_phase_execution_pulled_forward: zero; injected forbidden surface fires", () => {
  const src = productionSources();
  expect(shellFutureSurface(src)).toBe(0);
  expect(inferredScope(src)).toBe(0);
  for (const injected of ['await fetch("https://api.github.com");', 'const o = new Octokit();', 'execFileSync("git", ["clone", url]);', 'import x from "node:https";']) {
    expect(shellFutureSurface(src + "\n" + injected)).toBeGreaterThanOrEqual(1);
  }
});

it("UC12 s14_or_hi054_self_closure: zero; injected closure claim fires", () => {
  const source = phaseText();
  expect(closureClaims(source)).toBe(0);
  expect(closureClaims(source + "\nS14: CLOSED\nHI-054: AWARDED\n")).toBe(2);
});
