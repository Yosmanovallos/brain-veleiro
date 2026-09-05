import fs from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { configured, setup } from "./cases.js";
import { request, output, sha, registry, sandbox } from "./helpers.js";
import { committedDeadline, ordinaryWriteFailure, precommitTimeout } from "./failureExercises.js";

it("ordinary partial temporary write failure never changes targets and cleans its temporary files", ordinaryWriteFailure);
it("pre-commit expiry cleans temporary files and never mutates CREATE_NEW or overwrite target", precommitTimeout);
it("post-commit expiry returns actual success, never TIMEOUT", committedDeadline);
it.each(["", ".", "a//b", "a/./b", "a/../b", "a/", "C:relative", "\\\\host\\share", "a\0b", "\ud800"])("malformed path %j is rejected before filesystem target access", async path => {
  await setup(async p => {
    const spies = [vi.spyOn(fs, "open"), vi.spyOn(fs, "lstat"), vi.spyOn(fs, "realpath"), vi.spyOn(fs, "opendir")];
    try {
      expect(await p.invoke(request("filesystem.read", { path }))).toMatchObject({ status: "FAIL", error: { code: "INVALID_INPUT" } });
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally { spies.forEach(s => s.mockRestore()); }
  });
});
it("invalid UTF-16 write strings, byte overflow, invalid modes and unknown input fields cannot mutate", async () => {
  await setup(async (p, root) => {
    for (const change of [{ content: "\ud800" }, { content: "é".repeat(524289) }, { mode: "APPEND" }, { mode: "DELETE" }, { extra: true }, { expected_sha256: "a".repeat(64) }]) {
      expect(await p.invoke(request("filesystem.write", { path: "new", content: "text", mode: "CREATE_NEW", ...change }))).toMatchObject({ status: "FAIL", error: { code: "INVALID_INPUT" } });
    }
    expect(await fs.readdir(root)).toEqual(["nested", "text.txt"]);
  });
});
it("input accessors are rejected without evaluation", async () => {
  await setup(async p => {
    let getters = 0;
    const input = Object.defineProperty({}, "path", { enumerable: true, get() { getters++; return "text.txt"; } });
    expect(await p.invoke(request("filesystem.read", input))).toMatchObject({ status: "FAIL", error: { code: "INVALID_INPUT" } });
    expect(getters).toBe(0);
  });
});
it("scope matching respects segment boundaries and the configuration snapshot", async () => {
  await sandbox(async root => {
    await fs.mkdir(join(root, "allowed")); await fs.mkdir(join(root, "allowed-other"));
    await fs.writeFile(join(root, "allowed-other", "data"), "text");
    const read = ["allowed"]; const write: string[] = [];
    const { WorkspaceFilesystemCapabilityProvider: P } = await import("../../src/providers/capability/filesystem/workspaceFilesystemCapabilityProvider.js");
    const p = await P.create({ workspace_root: root, read_allow_prefixes: read, write_allow_prefixes: write });
    read.push("."); write.push(".");
    expect((await p.invoke(request("filesystem.read", { path: "allowed-other/data" }))).status).toBe("BLOCKED");
    expect((await p.invoke(request("filesystem.write", { path: "new", content: "text", mode: "CREATE_NEW" }))).status).toBe("BLOCKED");
  });
});
it("unknown capability is blocked and descriptors are detached without host configuration", async () => {
  await setup(async (p, root) => {
    const ds = await p.list_capabilities(); ds[0].side_effects = "EXTERNAL";
    expect((await p.list_capabilities())[0].side_effects).toBe("NONE");
    expect(JSON.stringify(ds)).not.toContain(root);
    expect((await p.invoke(request("filesystem.delete", { path: "text.txt" }))).status).toBe("BLOCKED");
  });
});
it("strict UTF-8 preserves BOM, supplementary code points, empty content and exact byte hashes", async () => {
  await setup(async (p, root) => {
    for (const content of ["", "\ufeffhello", "\u{1F642}", "\u0000\u0001\n\r\t"]) {
      await fs.writeFile(join(root, "utf8"), content);
      expect(output(await registry(p).invoke(request("filesystem.read", { path: "utf8" })))).toMatchObject({ content, bytes: Buffer.byteLength(content), sha256: sha(content) });
    }
  });
});
it("final pre-commit hash check blocks real intervening writes and cleans staging", async () => {
  await setup(async (p, root) => {
    const realOpen = fs.open.bind(fs); let changed = 0;
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, permissions) => {
      const handle = await realOpen(path, flags, permissions);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        const sync = handle.sync.bind(handle);
        vi.spyOn(handle, "sync").mockImplementation(async () => { await sync(); await fs.writeFile(join(root, "text.txt"), "intervening content"); changed++; });
      }
      return handle;
    });
    try { expect((await p.invoke(request("filesystem.write", { path: "text.txt", content: "replacement", mode: "OVERWRITE_EXISTING", expected_sha256: sha("Hello café 世界\n") }))).status).toBe("BLOCKED"); }
    finally { spy.mockRestore(); }
    expect(changed).toBe(1); expect(await fs.readFile(join(root, "text.txt"), "utf8")).toBe("intervening content");
    expect(await fs.readdir(root)).toEqual(["nested", "text.txt"]);
  });
});
it("CREATE_NEW publication EEXIST race never clobbers the winning complete file", async () => {
  await setup(async (p, root) => {
    const realLink = fs.link.bind(fs); let raced = 0;
    const spy = vi.spyOn(fs, "link").mockImplementation(async (from, to) => { await fs.writeFile(join(root, "new"), "winner", { flag: "wx" }); raced++; await realLink(from, to); });
    try { expect((await p.invoke(request("filesystem.write", { path: "new", content: "loser", mode: "CREATE_NEW" }))).status).toBe("BLOCKED"); }
    finally { spy.mockRestore(); }
    expect(raced).toBe(1); expect(await fs.readFile(join(root, "new"), "utf8")).toBe("winner");
    expect(await fs.readdir(root)).toEqual(["nested", "new", "text.txt"]);
  });
});
it("simultaneous real CREATE_NEW invocations publish exactly one complete payload", async () => {
  await setup(async (p, root) => {
    const contents = ["a".repeat(100000), "b".repeat(100000)];
    const results = await Promise.all(contents.map(content => p.invoke(request("filesystem.write", { path: "new", content, mode: "CREATE_NEW" }))));
    expect(results.filter(r => r.status === "SUCCESS")).toHaveLength(1);
    expect(results.filter(r => r.status === "BLOCKED")).toHaveLength(1);
    const winner = results.findIndex(r => r.status === "SUCCESS");
    expect(await fs.readFile(join(root, "new"), "utf8")).toBe(contents[winner]);
    expect(await fs.readdir(root)).toEqual(["nested", "new", "text.txt"]);
  });
});
it("temporary name collision cannot remove or overwrite a pre-existing file", async () => {
  await setup(async (p, root) => {
    const realOpen = fs.open.bind(fs); let collision: string | undefined;
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, permissions) => {
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        collision = String(path).split("/").at(-1)!;
        await fs.writeFile(join(root, collision), "preexisting", { flag: "wx" });
      }
      return realOpen(path, flags, permissions);
    });
    try { expect((await p.invoke(request("filesystem.write", { path: "new", content: "content", mode: "CREATE_NEW" }))).status).toBe("BLOCKED"); }
    finally { spy.mockRestore(); }
    expect(collision).toBeDefined(); expect(await fs.readFile(join(root, collision!), "utf8")).toBe("preexisting");
    await expect(fs.lstat(join(root, "new"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
it("temporary writes are not exposed by concurrent provider listing or direct reads", async () => {
  await setup(async (p, root) => {
    const realOpen = fs.open.bind(fs); let checked = 0;
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, permissions) => {
      const handle = await realOpen(path, flags, permissions);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        const sync = handle.sync.bind(handle);
        vi.spyOn(handle, "sync").mockImplementation(async () => {
          await sync();
          const name = String(path).split("/").at(-1)!;
          expect((await fs.readdir(root)).includes(name)).toBe(true);
          expect(output(await p.invoke(request("filesystem.list", { path: "." }))).entries).not.toContainEqual({ name, kind: "FILE" });
          expect((await p.invoke(request("filesystem.read", { path: name }))).status).toBe("BLOCKED"); checked++;
        });
      }
      return handle;
    });
    try { output(await p.invoke(request("filesystem.write", { path: "new", content: "content", mode: "CREATE_NEW" }))); }
    finally { spy.mockRestore(); }
    expect(checked).toBe(1);
  });
});
it.each(["filesystem.read", "filesystem.list"])("%s returns a bounded TIMEOUT and eventually closes a delayed real handle", async id => {
  await setup(async p => {
    const realOpen = fs.open.bind(fs); let release!: () => void;
    const hold = new Promise<void>(resolve => { release = resolve; });
    let closed!: () => void; const cleanup = new Promise<void>(resolve => { closed = resolve; });
    let opened = 0;
    const spy = vi.spyOn(fs, "open").mockImplementationOnce(async (path, flags, permissions) => {
      const handle = await realOpen(path, flags, permissions); opened++;
      const close = handle.close.bind(handle); vi.spyOn(handle, "close").mockImplementation(async () => { await close(); closed(); });
      await hold; return handle;
    });
    try { expect(await p.invoke(request(id, { path: id === "filesystem.list" ? "." : "text.txt" }, 10))).toMatchObject({ status: "FAIL", error: { code: "TIMEOUT" } }); }
    finally { release(); await cleanup; spy.mockRestore(); }
    expect(opened).toBe(1);
  });
});
it.each(["EACCES", "EPERM", "EIO"])("OS %s failures are normalized without private error text", async code => {
  await setup(async (p, root) => {
    const spy = vi.spyOn(fs, "open").mockRejectedValueOnce(Object.assign(new Error(root + " password=synthetic-private"), { code }));
    try {
      const result = await p.invoke(request("filesystem.read", { path: "text.txt" }));
      expect(result).toMatchObject({ status: "FAIL", error: { code: code === "EIO" ? "EXECUTION_FAILED" : "PERMISSION_DENIED" } });
      expect(JSON.stringify(result)).not.toContain(root); expect(JSON.stringify(result)).not.toContain("synthetic-private");
    } finally { spy.mockRestore(); }
  });
});
