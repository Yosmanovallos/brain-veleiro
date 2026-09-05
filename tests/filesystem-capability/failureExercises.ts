import fs, { type FileHandle } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { expect, vi } from "vitest";
import { configured, setup } from "./cases.js";
import { request, output, sha, registry, sandbox } from "./helpers.js";

const writing = (mode: string) => request("filesystem.write", { path: mode === "CREATE_NEW" ? "new" : "text.txt", content: "replacement", mode, ...(mode === "OVERWRITE_EXISTING" ? { expected_sha256: sha("Hello café 世界\n") } : {}) });
async function unchanged(root: string) {
  expect(await fs.readdir(root)).toEqual(["nested", "text.txt"]);
  expect(await fs.readFile(join(root, "text.txt"), "utf8")).toBe("Hello café 世界\n");
}
export async function ordinaryWriteFailure() {
  for (const mode of ["CREATE_NEW", "OVERWRITE_EXISTING"]) await setup(async (p, root) => {
    const realOpen = fs.open.bind(fs);
    let written = 0;
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, permissions) => {
      const handle = await realOpen(path, flags, permissions);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        const realWrite = handle.write.bind(handle);
        vi.spyOn(handle, "write").mockImplementation(async (...args: any[]) => {
          const bytes = args[0] as Buffer;
          written += (await realWrite(bytes, 0, 3, 0)).bytesWritten;
          throw Object.assign(new Error("synthetic private OS failure"), { code: "EIO" });
        });
      }
      return handle;
    });
    try { expect(await p.invoke(writing(mode))).toMatchObject({ status: "FAIL", error: { code: "EXECUTION_FAILED" } }); }
    finally { spy.mockRestore(); }
    expect(written).toBe(3); await unchanged(root);
  });
}
export async function precommitTimeout() {
  for (const mode of ["CREATE_NEW", "OVERWRITE_EXISTING"]) await setup(async (p, root) => {
    let now = performance.now();
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const realOpen = fs.open.bind(fs);
    let synced = 0;
    const spy = vi.spyOn(fs, "open").mockImplementation(async (path, flags, permissions) => {
      const handle = await realOpen(path, flags, permissions);
      if (typeof flags === "number" && (flags & constants.O_CREAT)) {
        const sync = handle.sync.bind(handle);
        vi.spyOn(handle, "sync").mockImplementation(async () => { await sync(); synced++; now += 20000; });
      }
      return handle;
    });
    try { expect(await p.invoke(writing(mode))).toMatchObject({ status: "FAIL", error: { code: "TIMEOUT" } }); }
    finally { spy.mockRestore(); clock.mockRestore(); }
    expect(synced).toBe(1); await unchanged(root);
  });
}
export async function committedDeadline() {
  for (const mode of ["CREATE_NEW", "OVERWRITE_EXISTING"]) await setup(async (p, root) => {
    let now = performance.now();
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const method = mode === "CREATE_NEW" ? "link" : "rename";
    const real = fs[method].bind(fs);
    let commits = 0;
    const spy = vi.spyOn(fs, method).mockImplementation(async (from, to) => { await real(from, to); now += 20000; commits++; });
    try { output(await p.invoke(writing(mode))); }
    finally { spy.mockRestore(); clock.mockRestore(); }
    expect(commits).toBe(1);
    expect(await fs.readFile(join(root, mode === "CREATE_NEW" ? "new" : "text.txt"), "utf8")).toBe("replacement");
    expect((await fs.readdir(root)).filter(n => n.startsWith(".brain-fs-"))).toEqual([]);
  });
}

export async function withDeepPath(parts: string[], exercise: (root: string, path: string, parent: FileHandle) => Promise<void>) {
  await sandbox(async root => {
    const handles: FileHandle[] = [await fs.open(root, constants.O_RDONLY | constants.O_DIRECTORY)];
    const directories = parts.slice(0, -1);
    try {
      for (const name of directories) {
        const path = `/proc/self/fd/${handles.at(-1)!.fd}/${name}`;
        await fs.mkdir(path);
        handles.push(await fs.open(path, constants.O_RDONLY | constants.O_DIRECTORY));
      }
      await exercise(root, parts.join("/"), handles.at(-1)!);
    } finally {
      for (let i = handles.length - 1; i > 0; i--) {
        for (const entry of await fs.readdir(`/proc/self/fd/${handles[i].fd}`)) await fs.unlink(`/proc/self/fd/${handles[i].fd}/${entry}`);
        await handles[i].close();
        await fs.rmdir(`/proc/self/fd/${handles[i - 1].fd}/${directories[i - 1]}`);
      }
      await handles[0].close();
    }
  });
}
export async function exactBounds() {
  await setup(async (p, root) => {
    await fs.mkdir(join(root, "many"));
    const names = Array.from({ length: 1000 }, (_, i) => String(i).padStart(4, "0") + "a".repeat(251));
    await Promise.all(names.map(n => fs.writeFile(join(root, "many", n), "")));
    expect(output(await registry(p).invoke(request("filesystem.list", { path: "many" }))).entries).toEqual(names.map(name => ({ name, kind: "FILE" })));
    await fs.writeFile(join(root, "many", "overflow"), "");
    expect(await p.invoke(request("filesystem.list", { path: "many" }))).toMatchObject({ status: "FAIL", error: { code: "INVALID_INPUT" } });
    for (const mode of ["read_allow_prefixes", "write_allow_prefixes"] as const) {
      const config = { workspace_root: root, read_allow_prefixes: ["."], write_allow_prefixes: ["."] };
      config[mode] = Array.from({ length: 64 }, (_, i) => `scope${i}`);
      const { WorkspaceFilesystemCapabilityProvider: P } = await import("../../src/providers/capability/filesystem/workspaceFilesystemCapabilityProvider.js");
      await expect(P.create(config)).resolves.toBeInstanceOf(P);
      config[mode].push("overflow"); await expect(P.create(config)).rejects.toThrow();
    }
    for (const path of ["a".repeat(4097), Array(257).fill("a").join("/"), "é".repeat(128), "a".repeat(256)]) {
      const spy = vi.spyOn(fs, "open");
      try { expect(await p.invoke(request("filesystem.read", { path }))).toMatchObject({ status: "FAIL", error: { code: "INVALID_INPUT" } }); expect(spy).not.toHaveBeenCalled(); }
      finally { spy.mockRestore(); }
    }
  });
  const long = [...Array(15).fill("a".repeat(255)), "b".repeat(254), "c"];
  expect(long.join("/").length).toBe(4096);
  for (const parts of [long, [...Array(255).fill("a"), "b"], ["é".repeat(127) + "a"]]) {
    await withDeepPath(parts, async (root, path, parent) => {
      const p = registry(await configured(root));
      output(await p.invoke(request("filesystem.write", { path, mode: "CREATE_NEW", content: "boundary" })));
      const result = await p.invoke(request("filesystem.read", { path }));
      expect(output(result).content).toBe("boundary");
      expect(result.evidence_refs).toEqual([`workspace://${path}`]);
      expect(await fs.readFile(`/proc/self/fd/${parent.fd}/${parts.at(-1)}`, "utf8")).toBe("boundary");
    });
  }
}
