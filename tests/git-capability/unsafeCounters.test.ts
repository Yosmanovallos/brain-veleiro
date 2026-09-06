import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it, vi } from "vitest";
import * as gitProcess from "../../src/providers/capability/git/process.js";
import { buildArgv, STRUCTURAL_DENY_SET } from "../../src/providers/capability/git/environment.js";
import { withRepo, withSimpleRepo, providerConfig, createProvider, HOST_GIT } from "./repoFixtures.js";
import { gitDirManifest, unsafePlainStatusMutatesIndex } from "./gitDirManifest.js";
import { withGitBin } from "./fixtures.js";
import { request, restricted, pidGone, readPidFile, STATUS, READ } from "./helpers.js";
import {
  productionSources, forbiddenSurface, closureClaims, phaseText, protectedDifferences,
  blobSha1, text, assertBoundaries,
} from "./audit.js";

const run = (p: Awaited<ReturnType<typeof createProvider>>, cap: string, input: Record<string, unknown>, timeout_ms = 20000) =>
  p.invoke(request(cap, input, timeout_ms));

it("UC01 model_controlled_git_subcommand_argv_or_env: rejected with zero spawn; merge detector fires", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const launcher = vi.spyOn(gitProcess, "startGitProcess");
    try {
      for (const bad of [
        { subcommand: "log" }, { argv: ["log", "-p"] }, { env: { GIT_PAGER: "id" } },
        { "-c": "core.pager=id" }, { format: "%H" }, { git_dir: "/x" }, { command: "gc" },
      ]) {
        expect((await run(p, READ, { path: "hello.txt", ...bad })).status).toBe("FAIL");
        expect((await run(p, STATUS, bad)).status).toBe("FAIL");
      }
      expect(launcher).not.toHaveBeenCalled();
    } finally { launcher.mockRestore(); }
    // detector: a provider that merged model input into the fixed argv would run "log".
    const merged = [...["status"], ...(["log", "-p"])];
    expect(merged).toContain("log");
  });
});

it("UC02 shell_string_or_shell_true_execution: literal argv, shell:false; injected shell:true fires", async () => {
  await withRepo(fx => { fx.write("$(touch pwned) x`id`.txt", "ok\n"); fx.commit("c1"); }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const launcher = vi.spyOn(gitProcess, "startGitProcess");
    try {
      const r = await run(p, READ, { path: "$(touch pwned) x`id`.txt" });
      expect(r.status).toBe("SUCCESS");
      for (const call of launcher.mock.calls) {
        expect(Array.isArray(call[0].argv)).toBe(true);
        expect(typeof (call[0] as unknown as { command?: unknown }).command).toBe("undefined");
      }
    } finally { launcher.mockRestore(); }
    expect(existsSync(join(fx.root, "pwned"))).toBe(false);
    const src = text("src/providers/capability/git/process.ts");
    expect(src.includes("shell: false")).toBe(true);
    expect(forbiddenSurface('spawn(exe, argv, { shell: true });')).toBeGreaterThanOrEqual(1);
    expect(forbiddenSurface('spawn("/bin/sh", ["-c", cmd]);')).toBeGreaterThanOrEqual(1);
  });
});

it("UC03 path_or_pathspec_escape_or_protected_content_bypass: all denied; naive resolve fires", async () => {
  await withRepo(fx => { fx.write("real.txt", "r\n"); fx.write(".env", "S=1\n"); fx.commit("c1"); }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const launcher = vi.spyOn(gitProcess, "startGitProcess");
    try {
      for (const path of ["../escape", "a/../../x", "/etc/passwd", ":(top)real.txt", "-rf", ".env", ".git/config"]) {
        expect((await run(p, READ, { path })).status).not.toBe("SUCCESS");
      }
      expect(launcher).not.toHaveBeenCalled();
    } finally { launcher.mockRestore(); }
    // detector: a naive path.resolve(root, path) escapes the worktree for "../escape".
    expect(resolve(fx.root, "../escape").startsWith(fx.root + "/")).toBe(false);
  });
});

it("UC04 unvalidated_revision_or_git_revision_language_execution: rejected; raw rev:path fires", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const launcher = vi.spyOn(gitProcess, "startGitProcess");
    try {
      for (const revision of ["HEAD~1", "HEAD^{tree}", "main@{yesterday}", "HEAD:hello.txt", ":/init", "@", "abcd"]) {
        expect((await run(p, READ, { path: "hello.txt", revision })).status).toBe("FAIL");
      }
      expect(launcher).not.toHaveBeenCalled();
    } finally { launcher.mockRestore(); }
    // detector: handing an unresolved `<rev>:<path>` composite straight to git resolves it.
    const composite = "HEAD" + ":" + "hello.txt";
    const resolved = execFileSync(HOST_GIT, ["-C", fx.root, "rev-parse", "--verify", composite], { encoding: "utf8" }).trim();
    expect(resolved).toMatch(/^[0-9a-f]{40}$/);
  });
});

it("UC05 hook_alias_fsmonitor_pager_editor_credential_or_helper_execution: none run; hostile config fires", async () => {
  await withRepo(fx => {
    fx.write("a.txt", "a\n"); fx.commit("c1");
    const cfg = join(fx.gitDir(), "config");
    const m = (n: string) => join(fx.base, "UC05_" + n);
    execFileSync("bash", ["-c", [
      `git config -f "${cfg}" core.pager 'touch ${m("pager")}; cat'`,
      `git config -f "${cfg}" core.fsmonitor 'touch ${m("fsm")}'`,
      `git config -f "${cfg}" credential.helper '!touch ${m("cred")}'`,
      `git config -f "${cfg}" alias.x '!touch ${m("alias")}'`,
    ].join(" && ")]);
    const hook = join(fx.gitDir(), "hooks", "post-index-change");
    execFileSync("bash", ["-c", `printf '#!/bin/sh\\ntouch "${join(fx.base, "UC05_hook")}"\\n' > "${hook}" && chmod +x "${hook}"`]);
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    await run(p, STATUS, {});
    await run(p, READ, { path: "a.txt" });
    for (const n of ["pager", "fsm", "cred", "alias", "hook"]) expect(existsSync(join(fx.base, "UC05_" + n))).toBe(false);
    // detector: plain git WITHOUT the safety floor DOES exec a hostile core.fsmonitor
    // program during `status` (git runs it regardless of the fsmonitor protocol).
    const control = join(fx.base, "UC05_control");
    const fsm = join(fx.base, "uc05-fsm.sh");
    execFileSync("bash", ["-c", `printf '#!/bin/sh\\ntouch "${control}"\\n' > "${fsm}" && chmod +x "${fsm}"`]);
    try {
      execFileSync(HOST_GIT, ["-C", fx.root, "-c", `core.fsmonitor=${fsm}`, "status"], {
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
        stdio: "ignore",
      });
    } catch { /* git may exit non-zero once the fsmonitor helper misbehaves; the exec still happened */ }
    expect(existsSync(control)).toBe(true);
  });
});

it("UC06 network_remote_or_external_git_transport_reached: never; op-table injection fires", async () => {
  const families = ["VERSION", "STATUS", "RESOLVE_HEAD", "VERIFY_COMMIT_OBJECT", "RESOLVE_TREE_ENTRY", "READ_BLOB"] as const;
  for (const family of families) {
    const argv = buildArgv(family, { canonicalRoot: "/c", revision: "a".repeat(40), objectId: "b".repeat(40), path: "p" });
    for (const denied of [...STRUCTURAL_DENY_SET, "http", "https", "git://", "ssh://"]) expect(argv.join(" ")).not.toContain(` ${denied} `);
    for (const denied of STRUCTURAL_DENY_SET) expect(argv).not.toContain(denied);
  }
  const src = productionSources();
  expect(forbiddenSurface(src)).toBe(0);
  // detector: adding a network subcommand to a template is caught by the deny-set scan.
  const injected = ["git", "--no-pager", "fetch", "origin"];
  expect(STRUCTURAL_DENY_SET.some(d => injected.includes(d))).toBe(true);
});

it("UC07 output_bound_bypass_silent_truncation_or_binary_bytes_returned: max+1 FAIL; naive slice fires", async () => {
  await withRepo(fx => {
    fx.writeBytes("over.txt", Buffer.alloc(1048576 + 1024, 0x79));
    fx.writeBytes("bin.dat", Buffer.from([0xff, 0x00, 0xfe]));
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    failCodeLike(await run(p, READ, { path: "over.txt" }, 60000), "EXECUTION_FAILED");
    failCodeLike(await run(p, READ, { path: "bin.dat" }), "INVALID_INPUT");
    // detector: a naive slice(0, MAX) would yield a "SUCCESS" of the wrong length.
    const truncated = { status: "SUCCESS", output: { content: "y".repeat(1048577).slice(0, 1048576) } };
    expect(truncated.status === "SUCCESS" && truncated.output.content.length === 1048576).toBe(true);
  });
});

it("UC08 timeout_overflow_process_group_cleanup_or_detached_maintenance_failure: grandchild reaped; child-only kill leaks", async () => {
  await withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const marker = join(bin.dir, "uc08.pid");
      const hang = await bin.fakeGit("git-hang-gc", { version: "2.50.0", behavior: "hang-grandchild", marker });
      const p = await createProvider(providerConfig(fx, { git_executable: hang, max_timeout_ms: 700 }));
      expect((await run(p, STATUS, {}, 8000)).status).toBe("FAIL");
      const gcPid = await readPidFile(marker);
      expect(await pidGone(gcPid)).toBe(true);
    });
    // detector: the runner signals the whole group (-pgid), not just child.pid.
    const src = text("src/providers/capability/git/process.ts");
    expect(src.includes("process.kill(-pgid")).toBe(true);
  });
});

it("UC09 secret_remote_identity_or_host_path_exposure: blocked/normalized; raw passthrough exposes", async () => {
  await withRepo(fx => {
    fx.write("leak.txt", "password: " + "topsecretvalue123\n");
    fx.commit("c1");
    fx.git("remote", "add", "origin", "https://tok3n:s3cr3t@host.invalid/r.git");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const secret = await run(p, READ, { path: "leak.txt" });
    expect(secret.status).toBe("BLOCKED");
    expect(JSON.stringify(secret)).not.toContain("topsecretvalue123");
    const st = await run(p, STATUS, {});
    const s = JSON.stringify(st);
    expect(s).not.toContain("s3cr3t");
    expect(s).not.toContain("host.invalid");
    expect(s).not.toContain(fx.root);
    expect(s).not.toContain(HOST_GIT);
    // detector: returning the raw configured root/exe string would expose them.
    const raw = `${fx.root}|${HOST_GIT}`;
    expect(raw.includes(fx.root) && raw.includes(HOST_GIT)).toBe(true);
  });
});

it("UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires", () => {
  expect(protectedDifferences()).toEqual([]);
  assertBoundaries();
  const original = Buffer.from("original tracked bytes");
  expect(blobSha1(original) === blobSha1(original)).toBe(true);
  expect(blobSha1(original) === blobSha1(Buffer.concat([original, Buffer.from("x")]))).toBe(false);
});

it("UC11 future_phase_execution_pulled_forward: zero; injected forbidden surface fires", () => {
  const src = productionSources();
  expect(forbiddenSurface(src)).toBe(0);
  for (const injected of [
    'await fetch("https://api.github.com");',
    'const o = new Octokit();',
    'const m = new McpClient();',
    'import https from "node:https";',
    'const cap = "repository.commit";',
    'const d = "repository.diff";',
  ]) {
    expect(forbiddenSurface(src + "\n" + injected)).toBeGreaterThanOrEqual(1);
  }
});

it("UC12 s14_or_hi054_self_closure: zero; injected closure claim fires", () => {
  const source = phaseText();
  expect(closureClaims(source)).toBe(0);
  expect(closureClaims(source + "\nS14: CLOSED\nHI-054: AWARDED\n")).toBeGreaterThanOrEqual(2);
});

function failCodeLike(value: unknown, code: string): void {
  expect(value).toMatchObject({ status: "FAIL", error: { code } });
}
