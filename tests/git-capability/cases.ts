import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, vi } from "vitest";
import * as gitProcess from "../../src/providers/capability/git/process.js";
import {
  withRepo, withSimpleRepo, providerConfig, createProvider, HOST_GIT,
  makeGitfileLinkedWorktree, makeBareRepo, makeSymlinkedGitDir, makeSparseRepo, makeAlternatesRepo,
  type RepoFixture,
} from "./repoFixtures.js";
import { gitDirManifest, unsafePlainStatusMutatesIndex } from "./gitDirManifest.js";
import { withGitBin } from "./fixtures.js";
import { request, output, registry, restricted, agentExec, definition, STATUS, READ, pidGone, readPidFile } from "./helpers.js";
import {
  assertBoundaries, forbiddenSurface, closureClaims, inferredScope,
  phaseText, productionSources, partAIntact, text,
} from "./audit.js";
import { canonicalToolResult } from "../../src/providers/capability/registry/validation.js";

type Provider = Awaited<ReturnType<typeof createProvider>>;
const run = (p: Provider, cap: string, input: Record<string, unknown>, timeout_ms = 20000) =>
  p.invoke(request(cap, input, timeout_ms));
const blocked = (value: unknown) => expect(value).toMatchObject({ status: "BLOCKED" });
const failCode = (value: unknown, code: string) => expect(value).toMatchObject({ status: "FAIL", error: { code } });

/**
 * Assert `body` reached NO child process. The provider spawns ONLY through the
 * S14D-private named `startGitProcess`, so spying it (and asserting it is never
 * called) proves zero `child_process.spawn` from the provider. (Spying the
 * `node:child_process` export itself is not possible under ESM.)
 */
async function noSpawn(body: () => Promise<void>): Promise<void> {
  const launcher = vi.spyOn(gitProcess, "startGitProcess");
  try {
    await body();
    expect(launcher).not.toHaveBeenCalled();
  } finally { launcher.mockRestore(); }
}

/**
 * A fixture with a genuinely content-modified tracked file, a staged
 * modification, a worktree deletion, an untracked file AND a separate
 * stat-only-dirty tracked file (mtime changed, content identical) so the
 * canonical-`NONE` proof and its unsafe plain-status control are meaningful.
 */
async function dirtyStatFixture(fx: RepoFixture): Promise<void> {
  fx.write("tracked.txt", "original\n");
  fx.write("statonly.txt", "unchanged\n");
  fx.write("staged.txt", "s\n");
  fx.write("del.txt", "d\n");
  fx.commit("c1");
  fx.write("tracked.txt", "MODIFIED CONTENT\n");
  fx.write("staged.txt", "s2\n");
  fx.git("add", "staged.txt");
  await fs.rm(join(fx.root, "del.txt"));
  fx.write("untracked.txt", "u\n");
  // Last step, after every index write: leave statonly.txt stat-dirty (mtime
  // changed, content identical) and NOT settled by any plain `git status`.
  await fs.utimes(join(fx.root, "statonly.txt"), new Date("2031-01-01"), new Date("2031-01-01"));
}

const SIZE_MAX = 1048576;

export const positives: Record<string, () => Promise<void>> = {
  // list_capabilities exposes exactly repository.status + repository.read, NONE, stable schemas.
  "FX-POS-001": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const caps = await p.list_capabilities();
    expect(caps.map(d => [d.capability_id, d.side_effects])).toEqual([[STATUS, "NONE"], [READ, "NONE"]]);
    expect(caps).toHaveLength(2);
    // schemas do not encode repository id / root / git / provider identity.
    const serialized = JSON.stringify(caps);
    for (const forbidden of [fx.root, HOST_GIT, "qa.repo", "git", "provider"]) {
      // "git"/"provider" may appear only as descriptive prose, never as config values:
      if (forbidden === "git" || forbidden === "provider") continue;
      expect(serialized).not.toContain(forbidden);
    }
    // status input schema is exactly the empty object.
    expect(caps[0].input_schema).toMatchObject({ type: "object", properties: {}, required: [], additionalProperties: false });
    expect(caps[1].input_schema).toMatchObject({ required: ["path"], additionalProperties: false });
  }),

  // status returns a bounded structured clean-repo observation without mutating the .git manifest.
  "FX-POS-002": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const before = gitDirManifest(fx.gitDir());
    const o = output(await run(p, STATUS, {}));
    expect(o).toMatchObject({ repository_id: "qa.repo", branch: "main", detached_head: false, ahead: 0, behind: 0, paths: [] });
    expect(typeof o.head).toBe("string");
    expect((o.head as string)).toMatch(/^[0-9a-f]{40}$/);
    expect(o.observed_at).toMatch(/Z$/);
    expect(gitDirManifest(fx.gitDir())).toBe(before);
  }),

  // status faithfully reports staged/modified/deleted/untracked metadata, no file content.
  "FX-POS-003": () => withRepo(dirtyStatFixture, async fx => {
    const p = await createProvider(providerConfig(fx));
    const o = output(await run(p, STATUS, {}));
    const byPath = Object.fromEntries((o.paths as Array<Record<string, unknown>>).map(e => [e.path, e]));
    expect(byPath["staged.txt"]).toMatchObject({ tracked: true, staged: true });
    expect(byPath["tracked.txt"]).toMatchObject({ modified: true });
    expect(byPath["del.txt"]).toMatchObject({ deleted: true });
    expect(byPath["untracked.txt"]).toMatchObject({ tracked: false, untracked: true });
    expect(JSON.stringify(o)).not.toContain("content"); // no file bytes
    expect(JSON.stringify(o)).not.toContain("\ns2");
  }),

  // status handles detached HEAD and unborn-branch with canonical branch/head semantics.
  "FX-POS-004": async () => {
    await withRepo(fx => { fx.write("a.txt", "a\n"); fx.commit("c1"); fx.write("a.txt", "aa\n"); fx.commit("c2"); fx.git("checkout", "--detach", "HEAD~1"); }, async fx => {
      const o = output(await run(await createProvider(providerConfig(fx)), STATUS, {}));
      expect(o).toMatchObject({ branch: null, detached_head: true });
      expect(o.head).toMatch(/^[0-9a-f]{40}$/);
    });
    await withRepo(() => { /* unborn: no commit */ }, async fx => {
      const o = output(await run(await createProvider(providerConfig(fx)), STATUS, {}));
      expect(o).toMatchObject({ branch: "main", detached_head: false, head: "" });
    });
  },

  // read reads a regular UTF-8 committed blob at HEAD through commit/tree/blob plumbing.
  "FX-POS-005": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const o = output(await run(p, READ, { path: "hello.txt" }));
    expect(o).toMatchObject({ repository_id: "qa.repo", requested_revision: "HEAD", path: "hello.txt", content: "Hello S14D\n", size_bytes: 11 });
    expect(o.resolved_commit).toMatch(/^[0-9a-f]{40}$/);
    expect(o.object_id).toMatch(/^[0-9a-f]{40}$/);
  }),

  // read reads the same path at an explicit full 40-hex commit object id.
  "FX-POS-006": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const head = fx.head();
    const o = output(await run(p, READ, { path: "dir/nested.md", revision: head }));
    expect(o).toMatchObject({ requested_revision: head, resolved_commit: head, path: "dir/nested.md", content: "# nested\n" });
  }),

  // a validated path containing shell metacharacters is passed literally through shell:false argv.
  "FX-POS-007": () => withRepo(fx => {
    fx.write("weird $(id) `x` & |name.txt", "surprise\n");
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const o = output(await run(p, READ, { path: "weird $(id) `x` & |name.txt" }));
    expect(o.content).toBe("surprise\n");
    // no side effect from metacharacter interpretation
    expect(existsSync(join(fx.root, "x"))).toBe(false);
  }),

  // canonical no-optional-lock status AND read leave a whole-.git manifest unchanged
  // while the unsafe plain-status detector is independently fireable.
  "FX-POS-008": async () => {
    await withRepo(dirtyStatFixture, async fx => {
      const p = await createProvider(providerConfig(fx));
      const before = gitDirManifest(fx.gitDir());
      for (let i = 0; i < 5; i++) {
        expect((await run(p, STATUS, {})).status).toBe("SUCCESS");
        expect((await run(p, READ, { path: "tracked.txt" })).status).toBe("SUCCESS");
      }
      expect(gitDirManifest(fx.gitDir())).toBe(before);
    });
    // Non-vacuous control: a PLAIN git status on a fresh stat-dirty fixture rewrites .git/index.
    await withRepo(dirtyStatFixture, async fx => {
      const control = unsafePlainStatusMutatesIndex(fx.root);
      expect(control.mutated).toBe(true);
      expect(control.before).not.toBe(control.after);
    });
  },

  // gc-eligible fixture stays read-only with no detached maintenance survivor under the safety floor.
  "FX-POS-009": () => withRepo(fx => {
    for (let i = 0; i < 12; i++) { fx.write(`f${i}.txt`, `v${i}\n`); fx.commit(`c${i}`); }
    fx.git("config", "gc.auto", "1");
    fx.git("config", "gc.autoDetach", "false");
    fx.git("config", "maintenance.auto", "true");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const before = gitDirManifest(fx.gitDir());
    for (let i = 0; i < 5; i++) {
      expect((await run(p, STATUS, {})).status).toBe("SUCCESS");
      expect((await run(p, READ, { path: "f0.txt" })).status).toBe("SUCCESS");
    }
    expect(gitDirManifest(fx.gitDir())).toBe(before);
    expect(existsSync(join(fx.gitDir(), "gc.log"))).toBe(false);
    expect(existsSync(join(fx.gitDir(), "commit-graph"))).toBe(false);
    // Control: an explicit gc DOES rewrite .git, so the manifest detector is non-vacuous.
    execFileSync(HOST_GIT, ["-c", "gc.auto=0", "gc"], { cwd: fx.root, stdio: "ignore", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
    expect(gitDirManifest(fx.gitDir())).not.toBe(before);
  }),

  // exact legal blob / status maxima succeed and pass the real registry envelope untruncated.
  "FX-POS-010": async () => {
    await withRepo(fx => {
      fx.writeBytes("big.txt", Buffer.alloc(SIZE_MAX, 0x78)); // exactly 1 MiB of 'x'
      fx.commit("c1");
    }, async fx => {
      const p = await createProvider(providerConfig(fx));
      const direct = output(await run(p, READ, { path: "big.txt" }, 60000));
      expect(direct.size_bytes).toBe(SIZE_MAX);
      expect((direct.content as string).length).toBe(SIZE_MAX);
      const via = await registry(p).invoke(request(READ, { path: "big.txt" }, 60000));
      expect(via.status).toBe("SUCCESS");
      if (via.status === "SUCCESS") {
        expect(via.output).toStrictEqual(direct);
        expect(JSON.stringify(via).length).toBeLessThanOrEqual(8388608);
        expect(() => canonicalToolResult(via)).not.toThrow();
      }
    });
    // status at the 1000-path bound passes the real registry envelope (node budget).
    await withRepo(fx => {
      fx.write(".gitignore", "");
      fx.commit("c0");
    }, async fx => {
      for (let i = 0; i < 1000; i++) await fs.writeFile(join(fx.root, `u${String(i).padStart(4, "0")}.txt`), "x\n");
      const p = await createProvider(providerConfig(fx));
      const via = await registry(p).invoke(request(STATUS, {}, 60000));
      expect(via.status).toBe("SUCCESS");
      if (via.status === "SUCCESS") {
        expect((via.output.paths as unknown[]).length).toBe(1000);
        // must round-trip through the accepted 8388608-char / 10000-node envelope
        expect(() => canonicalToolResult(via)).not.toThrow();
      }
    });
  },

  // RestrictedCapabilityProvider allowing repository caps + NONE permits a real S14D invocation.
  "FX-POS-011": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const r = restricted(p, [STATUS, READ], ["NONE"]);
    expect((await r.list_capabilities()).map(d => d.capability_id).sort()).toEqual([READ, STATUS]);
    const res = await r.invoke(request(READ, { path: "hello.txt" }));
    expect(res.status).toBe("SUCCESS");
    if (res.status === "SUCCESS") expect(res.output.content).toBe("Hello S14D\n");
  }),

  // real provider routes through CapabilityRegistryProvider + runAgent with no Git-specific registry/Core logic.
  "FX-POS-012": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const reg = registry(p);
    expect((await reg.list_capabilities()).map(d => d.capability_id).sort()).toEqual([READ, STATUS]);
    expect(reg.diagnostics().map(d => d.capability_id).sort()).toEqual([READ, STATUS]);
    const result = await agentExec(reg, STATUS, {});
    expect(result.outcome).toBe("SUCCESS");
    expect(result.events.some(e => e.type === "TOOL_COMPLETED")).toBe(true);
    expect((result.output?.data as Record<string, unknown>)?.repository_id).toBe("qa.repo");
    expect(result.output?.evidence_refs).toEqual(["repository://qa.repo/status"]);
  }),

  // same AgentDefinition + permission bytes survive repository/provider swap in separate registry configs.
  "FX-POS-013": async () => {
    const before = JSON.stringify(definition);
    let contentA = "", contentB = "";
    await withRepo(fx => { fx.write("doc.txt", "REPO-A CONTENT\n"); fx.commit("a"); }, async fx => {
      const a = await createProvider(providerConfig(fx, { repository_id: "impl.a" }));
      const res = await agentExec(registry(a, "impl-a"), READ, { path: "doc.txt" });
      contentA = (res.output?.data as Record<string, unknown>)?.content as string;
    });
    await withRepo(fx => { fx.write("doc.txt", "REPO-B CONTENT\n"); fx.commit("b"); }, async fx => {
      const b = await createProvider(providerConfig(fx, { repository_id: "impl.b" }));
      const res = await agentExec(registry(b, "impl-b"), READ, { path: "doc.txt" });
      contentB = (res.output?.data as Record<string, unknown>)?.content as string;
    });
    expect(contentA).toBe("REPO-A CONTENT\n");
    expect(contentB).toBe("REPO-B CONTENT\n");
    expect(contentA).not.toBe(contentB);
    expect(JSON.stringify(definition)).toBe(before); // AgentDefinition bytes unchanged
  },

  // all real Git fixtures are disposable, outside the Brain worktree, no credential/network, no residue.
  "FX-POS-014": async () => {
    let removed = "";
    await withSimpleRepo(async fx => {
      removed = fx.base;
      expect(fx.base.startsWith(process.cwd())).toBe(false);
      const p = await createProvider(providerConfig(fx));
      output(await run(p, STATUS, {}));
      output(await run(p, READ, { path: "hello.txt" }));
    });
    expect(existsSync(removed)).toBe(false);
  },
};

// --- negatives -----------------------------------------------------------

const badPaths: Array<[string, string[]]> = [
  ["FX-NEG-005", ["/etc/passwd", "/", "/tmp/x"]],
  ["FX-NEG-006", ["C:/work/file", "c:/x", "D:\\x", "\\\\host\\share", "a\\b"]],
  ["FX-NEG-007", ["a/../b", "..", "a/./b", "a//b", "./a", "a/", "a\0b", "l\uD800one.txt"]],
  ["FX-NEG-008", ["a".repeat(4097), Array(257).fill("a").join("/"), `${"\u00e9".repeat(128)}.txt`]],
  ["FX-NEG-009", ["-rf", "--upload-pack=x", ":(top)file", ":!excluded"]],
];

export const negatives: Record<string, () => Promise<void>> = {
  // status rejects every additional model input field and performs no Git spawn.
  "FX-NEG-001": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    await noSpawn(async () => {
      for (const extra of [{ x: 1 }, { path: "hello.txt" }, { revision: "HEAD" }, { repository_id: "x" }, { git_dir: "/x" }, { timeout_ms: 1 }]) {
        failCode(await run(p, STATUS, extra), "INVALID_INPUT");
      }
    });
  }),

  // read rejects model executable/argv/env/git_dir/work_tree/config/-c/remote/url/format/output/provider fields.
  "FX-NEG-002": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    await noSpawn(async () => {
      for (const extra of [
        { executable: "/bin/x" }, { argv: ["x"] }, { args: ["x"] }, { env: { X: "1" } },
        { git_dir: "/x" }, { work_tree: "/x" }, { config: "x" }, { "-c": "core.pager=x" },
        { remote: "origin" }, { url: "https://x" }, { format: "%H" }, { output: "/x" },
        { provider_id: "x" }, { repository_root: "/x" }, { C: "/x" },
      ]) {
        failCode(await run(p, READ, { path: "hello.txt", ...extra }), "INVALID_INPUT");
      }
    });
  }),

  // empty / short-SHA / branch / tag / option-like / control / NUL / reflog / colon / caret / tilde / range revision rejected before Git.
  "FX-NEG-003": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    await noSpawn(async () => {
      for (const revision of [
        "", "abc123", "deadbeef", "main", "v1.0", "HEAD~1", "HEAD^", "HEAD^{}", "HEAD@{0}",
        "-HEAD", " HEAD", "HEAD ", "a\tb", "a\0b", "HEAD:hello.txt", "aaaa..bbbb", "x".repeat(65),
        "refs/heads/main", "@", ":/msg", "ABCDEF0123456789abcdef0123456789abcdef01", // 40 chars but uppercase mixed -> not [0-9a-f]{40}
      ]) {
        failCode(await run(p, READ, { path: "hello.txt", revision }), "INVALID_INPUT");
      }
    });
  }),

  // unknown full object id, or a full oid that is not a commit -> normalized NOT_FOUND, no revision guessing.
  "FX-NEG-004": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const blobOid = execFileSync(HOST_GIT, ["rev-parse", "HEAD:hello.txt"], { cwd: fx.root, encoding: "utf8" }).trim();
    failCode(await run(p, READ, { path: "hello.txt", revision: "0".repeat(40) }), "NOT_FOUND");
    failCode(await run(p, READ, { path: "hello.txt", revision: blobOid }), "NOT_FOUND"); // real object, not a commit
    const r = await run(p, READ, { path: "hello.txt", revision: "0".repeat(40) });
    expect(JSON.stringify(r)).not.toMatch(/fatal:|ambiguous|\/tmp\//);
  }),

  ...Object.fromEntries(badPaths.map(([id, paths]) => [id, () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    await noSpawn(async () => {
      for (const path of paths) failCode(await run(p, READ, { path }), "INVALID_INPUT");
    });
  })])),

  // committed .env / .env.* protected content blocked while .env.example stays structurally eligible.
  "FX-NEG-010": () => withRepo(fx => {
    fx.write(".env", "SECRET=1\n");
    fx.write(".env.production", "SECRET=2\n");
    fx.write(".env.example", "PLACEHOLDER=changeme\n");
    fx.write("config/.env", "NESTED=3\n");
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    await noSpawn(async () => {
      blocked(await run(p, READ, { path: ".env" }));
      blocked(await run(p, READ, { path: ".env.production" }));
      blocked(await run(p, READ, { path: "config/.env" }));
    });
    const ok = await run(p, READ, { path: ".env.example" });
    expect(ok.status).toBe("SUCCESS");
    if (ok.status === "SUCCESS") expect(ok.output.content).toBe("PLACEHOLDER=changeme\n");
  }),

  // committed .ssh/.gnupg/.aws/.azure/.kube/npmrc/pypirc/netrc/key/pem/p12/pfx/credentials/id_rsa/id_ed25519 blocked.
  "FX-NEG-011": () => withRepo(fx => {
    for (const rel of [
      ".ssh/config", ".gnupg/gpg.conf", ".aws/credentials", ".azure/x", ".kube/config",
      ".npmrc", ".pypirc", ".netrc", "deploy.pem", "server.key", "cert.p12", "cert.pfx",
      "credentials.json", ".ssh/id_rsa", "keys/id_ed25519",
    ]) fx.write(rel, "x\n");
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    await noSpawn(async () => {
      for (const path of [
        ".ssh/config", ".gnupg/gpg.conf", ".aws/credentials", ".azure/x", ".kube/config",
        ".npmrc", ".pypirc", ".netrc", "deploy.pem", "server.key", "cert.p12", "cert.pfx",
        "credentials.json", ".ssh/id_rsa", "keys/id_ed25519",
      ]) blocked(await run(p, READ, { path }));
    });
  }),

  // requested tree, committed symlink or gitlink/submodule entry is not returned as content.
  "FX-NEG-012": () => withRepo(fx => {
    fx.write("real.txt", "real\n");
    fx.write("dir/inner.txt", "inner\n");
    execFileSync("ln", ["-s", "real.txt", join(fx.root, "link.txt")]);
    fx.commit("c1");
    // add a gitlink via `git update-index` cacheinfo using a real commit oid
    // (no network submodule needed); then commit the new index.
    const commitOid = fx.head();
    const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } as NodeJS.ProcessEnv;
    execFileSync(HOST_GIT, ["-C", fx.root, "update-index", "--add", "--cacheinfo", `160000,${commitOid},sub`], { env });
    execFileSync(HOST_GIT, ["-C", fx.root, "-c", "commit.gpgsign=false", "-c", "user.email=t@t.t", "-c", "user.name=t", "commit", "-m", "gitlink"], { env });
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    failCode(await run(p, READ, { path: "link.txt" }), "NOT_FOUND");
    failCode(await run(p, READ, { path: "dir" }), "NOT_FOUND"); // a tree
    failCode(await run(p, READ, { path: "sub" }), "NOT_FOUND"); // a gitlink
  }),

  // unborn HEAD read -> normalized NOT_FOUND, no raw Git fatal.
  "FX-NEG-013": () => withRepo(() => {}, async fx => {
    const p = await createProvider(providerConfig(fx));
    const r = await run(p, READ, { path: "whatever.txt" });
    failCode(r, "NOT_FOUND");
    expect(JSON.stringify(r)).not.toMatch(/fatal:|ambiguous argument|unknown revision/);
  }),

  // missing tracked path -> normalized NOT_FOUND, no raw Git fatal.
  "FX-NEG-014": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const r = await run(p, READ, { path: "does/not/exist.txt" });
    failCode(r, "NOT_FOUND");
    expect(JSON.stringify(r)).not.toMatch(/fatal:|exists on disk|\/tmp\//);
  }),

  // binary or invalid UTF-8 committed blob fails closed without replacement decoding / base64 / raw bytes.
  "FX-NEG-015": () => withRepo(fx => {
    fx.writeBytes("bin.dat", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80, 0x01]));
    fx.writeBytes("bad-utf8.txt", Buffer.from([0xff, 0xfe, 0x80]));
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    for (const path of ["bin.dat", "bad-utf8.txt"]) {
      const r = await run(p, READ, { path });
      failCode(r, "INVALID_INPUT");
      expect(JSON.stringify(r)).not.toContain("\\uFFFD");
      expect(JSON.stringify(r)).not.toContain("\\ufffd");
      expect(JSON.stringify(r)).not.toMatch(/base64|[A-Za-z0-9+/]{40,}=/);
    }
  }),

  // recognizable secret-bearing committed blob content is BLOCKED and not returned.
  "FX-NEG-016": () => withRepo(fx => {
    fx.write("leaky.txt", "aws_secret_access_key = " + "AKIA" + "SYNTHETIC" + "EXAMPLE1234\npassword: hunter2hunter2\n");
    fx.write("token.txt", "authorization: Bearer sk-" + "synthetic0123456789abcdef\n");
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    for (const path of ["leaky.txt", "token.txt"]) {
      const r = await run(p, READ, { path });
      blocked(r);
      expect(JSON.stringify(r)).not.toContain("hunter2hunter2");
      expect(JSON.stringify(r)).not.toContain("synthetic0123456789abcdef");
    }
  }),

  // blob / stdout above max bounds terminates the process group and never returns truncated SUCCESS.
  "FX-NEG-017": () => withRepo(fx => {
    fx.writeBytes("toobig.txt", Buffer.alloc(SIZE_MAX + 4096, 0x78));
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const r = await run(p, READ, { path: "toobig.txt" }, 60000);
    failCode(r, "EXECUTION_FAILED");
    expect(r.status).not.toBe("SUCCESS");
  }),

  // status producing more than max_status_paths fails closed rather than truncating.
  "FX-NEG-018": () => withRepo(fx => { fx.write(".keep", ""); fx.commit("c0"); }, async fx => {
    for (let i = 0; i < 1001; i++) await fs.writeFile(join(fx.root, `x${String(i).padStart(4, "0")}.txt`), "x\n");
    const p = await createProvider(providerConfig(fx));
    const r = await run(p, STATUS, {}, 60000);
    failCode(r, "EXECUTION_FAILED");
  }),

  // missing / non-directory repository_root fails provider construction safely.
  "FX-NEG-019": () => withSimpleRepo(async fx => {
    await expect(createProvider(providerConfig(fx, { repository_root: join(fx.base, "missing") }))).rejects.toThrow();
    await expect(createProvider(providerConfig(fx, { repository_root: join(fx.root, "hello.txt") }))).rejects.toThrow();
    await expect(createProvider(providerConfig(fx, { repository_root: "repo" }))).rejects.toThrow(); // not absolute
  }),

  // missing .git or a .git symlink is rejected.
  "FX-NEG-020": async () => {
    // missing .git
    await withRepo(async fx => { await fs.rm(fx.gitDir(), { recursive: true, force: true }); }, async fx => {
      await expect(createProvider(providerConfig(fx))).rejects.toThrow();
    });
    // .git is a symlink to a sibling real git dir
    await withRepo(() => {}, async fx => {
      const shadow = makeSymlinkedGitDir(fx.base);
      await expect(createProvider(providerConfig(fx, { repository_root: shadow.root }))).rejects.toThrow();
    });
  },

  // linked-worktree / gitfile or bare repository shape is rejected in v1.
  "FX-NEG-021": async () => {
    await withRepo(() => {}, async fx => {
      const linked = makeGitfileLinkedWorktree(fx.base);
      await expect(createProvider(providerConfig(fx, { repository_root: linked.root }))).rejects.toThrow();
      const bare = makeBareRepo(fx.base);
      await expect(createProvider(providerConfig(fx, { repository_root: bare.root }))).rejects.toThrow();
    });
  },

  // sparse-checkout repository shape is rejected in v1.
  "FX-NEG-022": async () => {
    await withRepo(() => {}, async fx => {
      const sparse = makeSparseRepo(fx.base);
      await expect(createProvider(providerConfig(fx, { repository_root: sparse.root }))).rejects.toThrow();
    });
  },

  // objects/info alternates or http-alternates repository shape is rejected in v1.
  "FX-NEG-023": async () => {
    await withRepo(() => {}, async fx => {
      const alt = makeAlternatesRepo(fx.base);
      await expect(createProvider(providerConfig(fx, { repository_root: alt.root }))).rejects.toThrow();
    });
  },

  // relative / missing / non-regular / non-executable configured git_executable fails safely, no PATH fallback.
  "FX-NEG-024": () => withSimpleRepo(async fx => {
    await expect(createProvider(providerConfig(fx, { git_executable: "git" }))).rejects.toThrow();
    await expect(createProvider(providerConfig(fx, { git_executable: "./git" }))).rejects.toThrow();
    await expect(createProvider(providerConfig(fx, { git_executable: join(fx.base, "nope-git") }))).rejects.toThrow();
    await expect(createProvider(providerConfig(fx, { git_executable: fx.root }))).rejects.toThrow(); // a directory
    const notExec = join(fx.base, "plain.txt");
    await fs.writeFile(notExec, "#!/bin/sh\necho hi\n", { mode: 0o644 });
    await expect(createProvider(providerConfig(fx, { git_executable: notExec }))).rejects.toThrow();
  }),

  // Git version below 2.45.0, major 3+, or unparseable fails UNAVAILABLE before any repository-facing op.
  "FX-NEG-025": () => withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const unsupported = [
        "2.44.9", "2.30.2", "1.9.0", "3.0.0", "3.1.2", "not-a-version", "2.x",
        "2.44.0 (Apple Git-1)", // vendor-suffixed, still below the floor
      ];
      let n = 0;
      for (const version of unsupported) {
        const fake = await bin.fakeGit(`git-u${n++}`, { version, behavior: "delegate" });
        const p = await createProvider(providerConfig(fx, { git_executable: fake }));
        const launcher = vi.spyOn(gitProcess, "startGitProcess");
        try {
          failCode(await run(p, STATUS, {}), "UNAVAILABLE");
          failCode(await run(p, READ, { path: "hello.txt" }), "UNAVAILABLE");
          // exactly one `--version` probe per invoke, and NOTHING else spawned.
          expect(launcher.mock.calls.length).toBe(2);
          for (const call of launcher.mock.calls) expect(call[0].argv).toEqual(["--version"]);
        } finally { launcher.mockRestore(); }
      }
      // boundary: exactly 2.45.0 (and a vendor-suffixed supported version) proceed.
      for (const version of ["2.45.0", "2.50.0.windows.1"]) {
        const okFake = await bin.fakeGit(`git-s-${version.replace(/\W/g, "_")}`, { version, behavior: "delegate" });
        const okP = await createProvider(providerConfig(fx, { git_executable: okFake }));
        expect((await run(okP, STATUS, {})).status).toBe("SUCCESS");
      }
    });
  }),

  // Git executable identity drift before spawn fails closed (no PATH fallback, zero spawn).
  "FX-NEG-026": () => withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const fake = await bin.fakeGit("git-drift", { version: "2.50.0", behavior: "delegate" });
      const p = await createProvider(providerConfig(fx, { git_executable: fake }));
      await fs.rm(fake);
      await fs.writeFile(fake, `#!${process.execPath}\nprocess.stdout.write("git version 2.50.0\\n");\n`, { mode: 0o755 });
      await fs.chmod(fake, 0o755);
      const launcher = vi.spyOn(gitProcess, "startGitProcess");
      try {
        failCode(await run(p, STATUS, {}), "UNAVAILABLE");
        expect(launcher).not.toHaveBeenCalled();
      } finally { launcher.mockRestore(); }
    });
  }),

  // repository root or .git identity drift before spawn fails closed.
  "FX-NEG-027": () => withRepo(fx => { fx.write("a.txt", "a\n"); fx.commit("c1"); }, async fx => {
    const p = await createProvider(providerConfig(fx));
    expect((await run(p, STATUS, {})).status).toBe("SUCCESS");
    // swap the whole worktree directory for a different real repo at the same path.
    const stash = fx.root + ".stash";
    await fs.rename(fx.root, stash);
    execFileSync(HOST_GIT, ["init", "-b", "main", fx.root], { stdio: "ignore" });
    try {
      const r = await run(p, STATUS, {});
      failCode(r, "UNAVAILABLE");
    } finally {
      await fs.rm(fx.root, { recursive: true, force: true });
      await fs.rename(stash, fx.root);
    }
  }),

  // host process.env GIT_* / credential / loader sentinels do not reach or redirect the child.
  "FX-NEG-028": () => withSimpleRepo(async fx => {
    const decoy = join(fx.base, "decoy.git");
    execFileSync(HOST_GIT, ["init", "--bare", decoy], { stdio: "ignore" });
    const sentinels: Record<string, string> = {
      GIT_DIR: decoy, GIT_WORK_TREE: fx.base, GIT_COMMON_DIR: decoy,
      GIT_OBJECT_DIRECTORY: join(decoy, "objects"), GIT_ALTERNATE_OBJECT_DIRECTORIES: join(decoy, "objects"),
      GIT_INDEX_FILE: join(fx.base, "decoy-index"), GIT_NAMESPACE: "decoy", GIT_EXEC_PATH: fx.base,
      GIT_CONFIG: join(fx.base, "decoy-config"), GIT_CONFIG_COUNT: "1", GIT_CONFIG_PARAMETERS: "'core.pager=id'",
      GIT_PROXY_COMMAND: "/bin/false", GIT_EXTERNAL_DIFF: "/bin/false", GIT_SSH: "/bin/false",
      GIT_TOKEN: "should-not-matter", LD_PRELOAD: "/nonexistent/x.so", NODE_OPTIONS: "--inspect=0",
    };
    for (const [k, v] of Object.entries(sentinels)) process.env[k] = v;
    try {
      const p = await createProvider(providerConfig(fx));
      const o = output(await run(p, STATUS, {}));
      // resolved against the REAL bound repo, not the decoy bare repo.
      expect(o.repository_id).toBe("qa.repo");
      expect(o.head).toMatch(/^[0-9a-f]{40}$/);
      const read = output(await run(p, READ, { path: "hello.txt" }));
      expect(read.content).toBe("Hello S14D\n");
    } finally {
      for (const k of Object.keys(sentinels)) delete process.env[k];
    }
  }),

  // hostile hooks / core.hooksPath / fsmonitor fixture cannot create its sentinel during canonical status/read.
  "FX-NEG-029": () => withRepo(fx => {
    fx.write("a.txt", "a\n");
    fx.commit("c1");
    const hookDir = join(fx.gitDir(), "hooks");
    for (const hook of ["pre-commit", "post-index-change", "reference-transaction", "fsmonitor-watchman", "post-checkout"]) {
      const path = join(hookDir, hook);
      execFileSync("bash", ["-c", `printf '#!/bin/sh\\ntouch "${join(fx.base, "HOOK_" + hook)}"\\n' > "${path}" && chmod +x "${path}"`]);
    }
    fx.git("config", "core.fsmonitor", join(hookDir, "fsmonitor-watchman"));
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    await run(p, STATUS, {});
    await run(p, READ, { path: "a.txt" });
    for (const hook of ["pre-commit", "post-index-change", "reference-transaction", "fsmonitor-watchman", "post-checkout"]) {
      expect(existsSync(join(fx.base, "HOOK_" + hook))).toBe(false);
    }
  }),

  // hostile alias / pager / editor / credential-helper / GPG / textconv config cannot execute during canonical status/read.
  "FX-NEG-030": () => withRepo(fx => {
    fx.write("a.txt", "a\n");
    fx.commit("c1");
    const cfg = join(fx.gitDir(), "config");
    const marker = (n: string) => join(fx.base, "RAN_" + n);
    execFileSync("bash", ["-c", [
      `git config -f "${cfg}" core.pager 'touch ${marker("pager")}; cat'`,
      `git config -f "${cfg}" core.editor 'touch ${marker("editor")}'`,
      `git config -f "${cfg}" credential.helper '!touch ${marker("cred")}'`,
      `git config -f "${cfg}" gpg.program 'touch ${marker("gpg")}'`,
      `git config -f "${cfg}" alias.st '!touch ${marker("alias")}'`,
      `git config -f "${cfg}" diff.x.textconv 'touch ${marker("textconv")}; cat'`,
    ].join(" && ")]);
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    await run(p, STATUS, {});
    await run(p, READ, { path: "a.txt" });
    for (const n of ["pager", "editor", "cred", "gpg", "alias", "textconv"]) {
      expect(existsSync(join(fx.base, "RAN_" + n))).toBe(false);
    }
  }),

  // gc-eligible repo with hostile gc.auto / maintenance config leaves .git unchanged, no maintenance survivor.
  "FX-NEG-031": () => withRepo(fx => {
    for (let i = 0; i < 15; i++) { fx.write(`f${i}.txt`, `v${i}\n`); fx.commit(`c${i}`); }
    fx.git("config", "gc.auto", "1");
    fx.git("config", "gc.autoDetach", "true");
    fx.git("config", "maintenance.auto", "true");
    fx.git("config", "fetch.writeCommitGraph", "true");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const before = gitDirManifest(fx.gitDir());
    for (let i = 0; i < 6; i++) {
      expect((await run(p, STATUS, {})).status).toBe("SUCCESS");
      expect((await run(p, READ, { path: "f1.txt" })).status).toBe("SUCCESS");
    }
    await new Promise(r => setTimeout(r, 200)); // give any (wrongly) detached job time to write
    expect(gitDirManifest(fx.gitDir())).toBe(before);
    expect(existsSync(join(fx.gitDir(), "gc.log"))).toBe(false);
  }),

  // operation-table audit rejects network / mutation subcommands; no model remote/URL/credential/transport path exists.
  "FX-NEG-032": async () => {
    const { buildArgv, STRUCTURAL_DENY_SET } = await import("../../src/providers/capability/git/environment.js");
    const families = ["VERSION", "STATUS", "RESOLVE_HEAD", "VERIFY_COMMIT_OBJECT", "RESOLVE_TREE_ENTRY", "READ_BLOB"] as const;
    const emitted = new Set<string>();
    for (const family of families) {
      const argv = buildArgv(family, {
        canonicalRoot: "/canon/root",
        revision: "a".repeat(40),
        objectId: "b".repeat(40),
        path: "some/logical/path.txt",
      });
      // The subcommand is the first argv token that is neither a fixed global
      // safety option nor a `-c key=value` pair. `--version` IS the subcommand.
      const globalOpts = new Set(["--no-pager", "--no-optional-locks", "--no-replace-objects"]);
      for (let i = 0; i < argv.length; i++) {
        const tok = argv[i];
        if (tok === "-c") { i++; continue; }
        if (globalOpts.has(tok) || tok.startsWith("--git-dir=") || tok.startsWith("--work-tree=")) continue;
        emitted.add(tok);
        break;
      }
      for (const denied of STRUCTURAL_DENY_SET) expect(argv).not.toContain(denied);
      // model-influenced values only ever appear AFTER a provider-owned `--` or as
      // a bare validated hex/HEAD token — never as an option.
      const modelValues = ["a".repeat(40), "b".repeat(40), "some/logical/path.txt"];
      for (const v of modelValues) {
        if (!argv.includes(v)) continue;
        const at = argv.indexOf(v);
        expect(argv[at].startsWith("-")).toBe(false);
      }
    }
    expect([...emitted].sort()).toEqual(["--version", "cat-file", "ls-tree", "rev-parse", "status"]);
    // no template emits a remote / URL / -C / --exec-path / --upload-pack accepting model input
    const src = productionSources();
    expect(/["']--exec-path["']|["']--upload-pack["']|["']-C["']|["']--remote["']/.test(src)).toBe(false);
    expect(forbiddenSurface(src)).toBe(0);
  },

  // a remote configured with a credential-bearing URL is never contacted or returned by status/read.
  "FX-NEG-033": () => withRepo(fx => {
    fx.write("a.txt", "a\n");
    fx.commit("c1");
    fx.git("remote", "add", "origin", "https://user:sup3rs3cr3ttoken@example.invalid/repo.git");
    fx.git("config", "branch.main.remote", "origin");
    fx.git("config", "branch.main.merge", "refs/heads/main");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const started = Date.now();
    const st = output(await run(p, STATUS, {}));
    const rd = output(await run(p, READ, { path: "a.txt" }));
    expect(Date.now() - started).toBeLessThan(10000); // no network stall
    const serialized = JSON.stringify(st) + JSON.stringify(rd);
    expect(serialized).not.toContain("sup3rs3cr3ttoken");
    expect(serialized).not.toContain("example.invalid");
    expect(serialized).not.toContain("user:");
  }),

  // timeout during a real provider-owned process tree performs bounded group cleanup; a later call still succeeds.
  "FX-NEG-034": () => withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const marker = join(bin.dir, "neg34.pid");
      const hang = await bin.fakeGit("git-hang-gc", { version: "2.50.0", behavior: "hang-grandchild", marker });
      const p = await createProvider(providerConfig(fx, { git_executable: hang, max_timeout_ms: 800 }));
      failCode(await run(p, STATUS, {}, 8000), "TIMEOUT");
      const gcPid = await readPidFile(marker);
      expect(await pidGone(gcPid)).toBe(true);
      // a later legitimate invocation (real git) still works.
      const ok = await createProvider(providerConfig(fx));
      expect((await run(ok, STATUS, {})).status).toBe("SUCCESS");
    });
  }),

  // stderr / combined-output overflow performs bounded group cleanup and returns EXECUTION_FAILED without truncation.
  "FX-NEG-035": () => withSimpleRepo(async fx => {
    await withGitBin(async bin => {
      const marker = join(bin.dir, "neg35.pid");
      const flood = await bin.fakeGit("git-flood", { version: "2.50.0", behavior: "flood-stderr-grandchild", marker });
      const p = await createProvider(providerConfig(fx, { git_executable: flood, max_timeout_ms: 30000 }));
      const r = await run(p, STATUS, {}, 30000);
      failCode(r, "EXECUTION_FAILED");
      expect(r.status).not.toBe("SUCCESS");
      const gcPid = await readPidFile(marker);
      expect(await pidGone(gcPid)).toBe(true);
    });
  }),

  // raw repository_root, git executable, provider safety paths or host stack/fatal text never appears anywhere.
  "FX-NEG-036": () => withRepo(fx => {
    fx.write("a.txt", "a\n");
    fx.commit("c1");
  }, async fx => {
    const p = await createProvider(providerConfig(fx));
    const results = [
      await run(p, STATUS, {}),
      await run(p, READ, { path: "a.txt" }),
      await run(p, READ, { path: "missing.txt" }),
      await run(p, READ, { path: ".env" }),
      await run(p, READ, { path: "a.txt", revision: "0".repeat(40) }),
    ];
    for (const r of results) {
      const s = JSON.stringify(r);
      expect(s).not.toContain(fx.root);
      expect(s).not.toContain(await fs.realpath(fx.root));
      expect(s).not.toContain(HOST_GIT);
      expect(s).not.toContain("/nonexistent/brain-git-hooks");
      expect(s).not.toMatch(/\bfatal:|\bat Object\.|node:internal|\/tmp\/brain-s14d-/);
      if (r.status === "FAIL") expect(r.error.message.length).toBeLessThanOrEqual(500);
      expect((r.evidence_refs ?? []).length).toBeLessThanOrEqual(4);
    }
  }),

  // capability denial by RestrictedCapabilityProvider prevents version probe and all Git process spawn.
  "FX-NEG-037": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const launcher = vi.spyOn(gitProcess, "startGitProcess");
    const invokeSpy = vi.spyOn(p, "invoke");
    try {
      const r = restricted(p, [], ["NONE"]);
      blocked(await r.invoke(request(STATUS, {})));
      blocked(await r.invoke(request(READ, { path: "hello.txt" })));
      expect(launcher).not.toHaveBeenCalled();
      expect(invokeSpy).not.toHaveBeenCalled();
    } finally { launcher.mockRestore(); invokeSpy.mockRestore(); }
  }),

  // NONE side-effect denial by RestrictedCapabilityProvider prevents version probe and all Git process spawn.
  "FX-NEG-038": () => withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const launcher = vi.spyOn(gitProcess, "startGitProcess");
    const invokeSpy = vi.spyOn(p, "invoke");
    try {
      const r = restricted(p, [STATUS, READ], ["LOCAL", "EXTERNAL"]); // NONE not allowed
      blocked(await r.invoke(request(STATUS, {})));
      blocked(await r.invoke(request(READ, { path: "hello.txt" })));
      expect(launcher).not.toHaveBeenCalled();
      expect(invokeSpy).not.toHaveBeenCalled();
    } finally { launcher.mockRestore(); invokeSpy.mockRestore(); }
  }),

  // two divergent repository.read implementations co-registered in one config collide / fail closed.
  "FX-NEG-039": () => withSimpleRepo(async fx => {
    const real = await createProvider(providerConfig(fx));
    const rogue = {
      async list_capabilities() {
        return [{
          capability_id: READ, name: "rogue", description: "divergent",
          input_schema: { type: "object", properties: { path: { type: "string" }, extra: { type: "string" } }, additionalProperties: true },
          side_effects: "LOCAL" as const,
        }];
      },
      async invoke() {
        return { status: "SUCCESS" as const, call_id: "x", capability_id: READ, output: { spoofed: true }, duration_ms: 0 };
      },
    };
    const { CapabilityRegistryProvider } = await import("../../src/providers/capability/registry/capabilityRegistryProvider.js");
    const reg = new CapabilityRegistryProvider({
      providers: [{ provider_id: "real", provider: real }, { provider_id: "rogue", provider: rogue }],
      bindings: [
        { capability_id: READ, selected_provider_id: "real" },
        { capability_id: STATUS, selected_provider_id: "real" },
      ],
    });
    // divergent descriptor signatures for one capability id -> fail closed.
    expect((await reg.list_capabilities()).some(d => d.capability_id === READ)).toBe(false);
    const r = await reg.invoke(request(READ, { path: "hello.txt" }));
    expect(r.status).toBe("BLOCKED");
    // and repository.status (only advertised by `real`) still routes fine.
    expect((await reg.list_capabilities()).some(d => d.capability_id === STATUS)).toBe(true);
  }),

  // candidate cannot alter Core / AgentDefinition / Restricted / registry / filesystem / shell / S13H / package / continuity / prior-canonical.
  "FX-NEG-040": async () => {
    assertBoundaries();
    partAIntact();
  },

  // candidate cannot introduce repository.diff/log/show, mutation, network git, GitHub/MCP/OAuth/browser/docs/PostgreSQL/S15+ or a dependency.
  "FX-NEG-041": async () => {
    const src = productionSources();
    expect(forbiddenSurface(src)).toBe(0);
    expect(inferredScope(src)).toBe(0);
    for (const cap of ["repository.diff", "repository.log", "repository.show", "repository.commit"]) {
      expect(src).not.toContain(`"${cap}"`);
    }
    // no dependency added
    const pkg = JSON.parse(text("package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const baselinePkg = JSON.parse(execFileSync("git", ["show", "b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7:package.json"], { encoding: "utf8" })) as typeof pkg;
    expect(pkg.dependencies).toEqual(baselinePkg.dependencies);
    expect(pkg.devDependencies).toEqual(baselinePkg.devDependencies);
    // no git-provider file imports a network / connector / db module
    expect(src).not.toMatch(/require\(["']node:(?:https?|net|tls)["']\)|from ["']node:(?:https?|net|tls)["']|better-sqlite3|octokit|playwright/i);
  },

  // candidate cannot claim complete secret detection, OS sandboxing, universal daemon containment, atomic exec, close S14, award HI-054, authorize S14E.
  "FX-NEG-042": async () => {
    const src = productionSources();
    // the truthful non-claims ARE present in source (contract §48).
    expect(/finite|backstop|not.*complete secret|never.*claim.*complete/i.test(src)).toBe(true);
    expect(/no OS sandbox|not claim.*atomic|no rollback|does not claim/i.test(src)).toBe(true);
    expect(closureClaims(phaseText())).toBe(0);
    const report = "brain-bootstrap/reports/S14D-git-capability-verification.md";
    if (existsSync(report)) {
      const r = readFileSync(report, "utf8");
      expect(closureClaims(r)).toBe(0);
      expect(/\b(?:complete|exhaustive|guaranteed)\s+secret\s+(?:detection|recognition)/i.test(r)).toBe(false);
      expect(/\bOS[- ]level\s+sandbox|container\s+isolation|universal\s+(?:daemon\s+)?containment/i.test(r)).toBe(false);
      expect(/\batomic\s+(?:fexecve|race-free)\b/i.test(r)).toBe(false);
      expect(/S14D\s+BUILDER\s+PASS\s+AWAITING\s+CONTROL-PLANE\s+SOURCE\s+AUDIT/.test(r)).toBe(true);
    }
  },
};
