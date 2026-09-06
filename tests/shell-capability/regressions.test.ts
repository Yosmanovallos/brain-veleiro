import fs from "node:fs/promises";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import * as execution from "../../src/providers/capability/shell/execution.js";
import { withShellSandbox, profile, create, config } from "./fixtures.js";
import { request, output, registry } from "./helpers.js";
import { assertBoundaries, concurrencyExercisesMaintenanceExact, s14bAuditMaintenanceExact, s14bAuditMaintenanceMechanical } from "./audit.js";

it("the S14B regression-harness maintenance is exactly the authorized narrow change", async () => {
  s14bAuditMaintenanceExact();
  await s14bAuditMaintenanceMechanical();
  assertBoundaries(); // additions only under S14C paths + exactly the two authorized M
});

it("the S14B concurrency-exercise determinism maintenance is exactly the authorized event-barrier change", () => {
  concurrencyExercisesMaintenanceExact();
});

const run = (p: Awaited<ReturnType<typeof create>>, input: Record<string, unknown>, timeout_ms = 10000) => p.invoke(request(input, timeout_ms));

it("input accessors are rejected without evaluation", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    let getters = 0;
    const input = Object.defineProperty({ cwd: "." }, "profile_id", { enumerable: true, get() { getters++; return "qa.ok"; } });
    expect(await p.invoke(request(input))).toMatchObject({ status: "FAIL", error: { code: "INVALID_INPUT" } });
    expect(getters).toBe(0);
  });
});

it("an unknown capability id is blocked and descriptors are detached from provider state", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const ds = await p.list_capabilities();
    ds[0].side_effects = "NONE";
    ds[0].capability_id = "shell.mutated";
    expect((await p.list_capabilities())[0]).toMatchObject({ capability_id: "shell.execute", side_effects: "LOCAL" });
    expect((await p.invoke({ ...request({ profile_id: "qa.ok", cwd: "." }), capability_id: "shell.spawn" })).status).toBe("BLOCKED");
  });
});

it("a PATH-less explicit env still runs an absolute-path executable", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), env: {} })));
    const env = JSON.parse(output(await run(p, { profile_id: "qa.probe", cwd: "." })).stdout as string).env;
    expect(env).toEqual({});
  });
});

it("empty child output yields an exact empty-string SUCCESS with zero byte counts", async () => {
  await withShellSandbox(async sb => {
    await fs.writeFile(sb.script("silent"), `#!${process.execPath}\nprocess.exit(0);\n`, { mode: 0o755 });
    await fs.chmod(sb.script("silent"), 0o755);
    const p = await create(config(sb.root, profile({ profile_id: "qa.silent", executable: sb.script("silent") })));
    expect(output(await run(p, { profile_id: "qa.silent", cwd: "." }))).toEqual({
      profile_id: "qa.silent", cwd: ".", exit_code: 0, signal: null, stdout: "", stderr: "", stdout_bytes: 0, stderr_bytes: 0,
    });
  });
});

it("deep nested allowed cwd at the segment/length boundary runs and reports a logical cwd", async () => {
  await withShellSandbox(async sb => {
    let dir = sb.root;
    const parts: string[] = [];
    for (let i = 0; i < 6; i++) { parts.push(`d${i}`); dir = join(dir, `d${i}`); await fs.mkdir(dir); }
    const cwd = parts.join("/");
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: sb.script("probe"), cwd_allow_prefixes: ["d0"] })));
    const r = output(await run(p, { profile_id: "qa.probe", cwd }));
    expect(r.cwd).toBe(cwd);
    expect(r.stdout_bytes).toBeGreaterThan(0);
  });
});

it("evidence never contains argv, env, pid, executable realpath or output bodies", async () => {
  await withShellSandbox(async sb => {
    const exe = sb.script("probe");
    const p = await create(config(sb.root, profile({ profile_id: "qa.probe", executable: exe, argv: ["ARGV_SENTINEL"], env: { ENV_SENTINEL: "v" } })));
    const r = await run(p, { profile_id: "qa.probe", cwd: "." });
    const refs = (r.evidence_refs ?? []).join(" ");
    for (const forbidden of ["ARGV_SENTINEL", "ENV_SENTINEL", await fs.realpath(exe), await fs.realpath(sb.root)]) {
      expect(refs).not.toContain(forbidden);
    }
    expect(r.evidence_refs).toEqual(["shell://qa.probe@workspace/."]);
  });
});

it("a settled invocation reports a non-negative duration_ms", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const r = await run(p, { profile_id: "qa.ok", cwd: "." });
    expect(typeof r.duration_ms).toBe("number");
    expect(r.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

it("a request timeout of zero or a non-finite value is rejected before spawn", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const spy = vi.spyOn(execution, "startProcessGroup");
    try {
      for (const timeout_ms of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect((await p.invoke({ ...request({ profile_id: "qa.ok", cwd: "." }), timeout_ms })).status).toBe("FAIL");
      }
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});

it("the real registry routes shell.execute with no shell-specific branch and reports one diagnostic", async () => {
  await withShellSandbox(async sb => {
    const p = await create(config(sb.root, profile({ profile_id: "qa.ok", executable: sb.script("ok") })));
    const reg = registry(p);
    expect((await reg.list_capabilities()).map(d => d.capability_id)).toEqual(["shell.execute"]);
    expect(reg.diagnostics()).toHaveLength(1);
    expect(output(await reg.invoke(request({ profile_id: "qa.ok", cwd: "." }))).stdout).toBe("ready");
  });
});
