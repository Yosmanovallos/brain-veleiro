import fs from "node:fs/promises";
import { join } from "node:path";
import { expect, vi } from "vitest";
import { WorkspaceFilesystemCapabilityProvider as Provider } from "../../src/providers/capability/filesystem/workspaceFilesystemCapabilityProvider.js";
import { sandbox, request, sha, output, registry, restricted, agentRead, definition } from "./helpers.js";
import { assertBoundaries, closureClaims, futureSurface, inferredScope, phaseText, productionSources } from "./audit.js";

export const configured = (root: string, read = ["."], write = ["."]) => Provider.create({ workspace_root: root, read_allow_prefixes: read, write_allow_prefixes: write });
export async function setup(exercise: (p: Provider, root: string) => Promise<void>) {
  await sandbox(async root => {
    await fs.mkdir(join(root, "nested"));
    await fs.writeFile(join(root, "text.txt"), "Hello café 世界\n");
    await fs.writeFile(join(root, "nested", "child.txt"), "nested content");
    await exercise(await configured(root), root);
  });
}
const read = (p: Provider, path = "text.txt") => p.invoke(request("filesystem.read", { path }));
const write = (p: Provider, path: string, content = "replacement", mode = "CREATE_NEW", expected_sha256?: string) => p.invoke(request("filesystem.write", { path, content, mode, ...(expected_sha256 === undefined ? {} : { expected_sha256 }) }));
const fail = (value: unknown, code: string) => expect(value).toMatchObject({ status: "FAIL", error: { code } });
const blocked = (value: unknown) => expect(value).toMatchObject({ status: "BLOCKED" });
export const positives: Record<string, () => Promise<void>> = {
  "FX-POS-001": () => setup(async p => {
    expect(output(await p.invoke(request("filesystem.list", { path: "." }))).entries).toEqual([{ name: "nested", kind: "DIRECTORY" }, { name: "text.txt", kind: "FILE" }]);
    expect(output(await p.invoke(request("filesystem.list", { path: "nested" }))).entries).toEqual([{ name: "child.txt", kind: "FILE" }]);
  }),
  "FX-POS-002": () => setup(async p => { const content = "Hello café 世界\n"; expect(output(await read(p))).toEqual({ path: "text.txt", content, bytes: Buffer.byteLength(content), sha256: sha(content) }); }),
  "FX-POS-003": () => setup(async (p, root) => { expect(output(await write(p, "nested/new.txt"))).toEqual({ path: "nested/new.txt", bytes_written: 11, sha256: sha("replacement"), created: true }); expect(await fs.readFile(join(root, "nested/new.txt"), "utf8")).toBe("replacement"); }),
  "FX-POS-004": () => setup(async (p, root) => { expect(output(await write(p, "text.txt", "replacement", "OVERWRITE_EXISTING", sha("Hello café 世界\n")))).toMatchObject({ created: false, sha256: sha("replacement") }); expect(await fs.readFile(join(root, "text.txt"), "utf8")).toBe("replacement"); }),
  "FX-POS-005": () => setup(async (p, root) => { const r = await read(p); expect(r.evidence_refs).toEqual(["workspace://text.txt"]); expect(JSON.stringify(r)).not.toContain(root); }),
  "FX-POS-006": () => setup(async (p, root) => { await fs.symlink(join(root, "text.txt"), join(root, "link")); const entries = output(await p.invoke(request("filesystem.list", { path: "." }))).entries; expect(entries).toContainEqual({ name: "link", kind: "SYMLINK" }); blocked(await read(p, "link")); }),
  "FX-POS-007": () => setup(async p => { const r = restricted(p); expect((await r.list_capabilities()).map(d => [d.capability_id, d.side_effects])).toEqual([["filesystem.list", "NONE"], ["filesystem.read", "NONE"]]); output(await r.invoke(request("filesystem.read", { path: "text.txt" }))); output(await r.invoke(request("filesystem.list", { path: "." }))); }),
  "FX-POS-008": () => setup(async (p, root) => { expect((await p.list_capabilities()).find(d => d.capability_id === "filesystem.write")?.side_effects).toBe("LOCAL"); blocked(await restricted(p).invoke(request("filesystem.write", { path: "new", mode: "CREATE_NEW", content: "text" }))); output(await restricted(p, undefined, true).invoke(request("filesystem.write", { path: "new", mode: "CREATE_NEW", content: "text" }))); expect(await fs.readFile(join(root, "new"), "utf8")).toBe("text"); }),
  "FX-POS-009": () => setup(async p => { expect(output(await registry(p).invoke(request("filesystem.read", { path: "text.txt" })))).toEqual(output(await read(p))); }),
  "FX-POS-010": () => setup(async p => { const r = await agentRead(p); expect(r.output?.data?.content).toBe("Hello café 世界\n"); expect(r.output?.evidence_refs).toEqual(["workspace://text.txt"]); }),
  "FX-POS-011": () => setup(async p => { const before = JSON.stringify(definition); const a = await agentRead(p, "first"); await sandbox(async root => { await fs.writeFile(join(root, "text.txt"), "second root"); const b = await agentRead(await configured(root), "second"); expect(b.output?.data?.content).toBe("second root"); expect(a.output?.data?.content).not.toBe(b.output?.data?.content); }); expect(JSON.stringify(definition)).toBe(before); }),
  "FX-POS-012": () => setup(async (p, root) => { const first = output(await read(p)); output(await write(p, "text.txt", "roundtrip", "OVERWRITE_EXISTING", first.sha256 as string)); expect(output(await read(p)).sha256).toBe(sha("roundtrip")); expect(await fs.readFile(join(root, "text.txt"), "utf8")).toBe("roundtrip"); }),
  "FX-POS-013": () => setup(async (p, root) => { for (const [i, content] of ["a".repeat(1048576), "\u0001".repeat(1048576), "é".repeat(524288)].entries()) { const path = `maximum${i}`; const r = registry(p); expect(output(await r.invoke(request("filesystem.write", { path, mode: "CREATE_NEW", content }))).bytes_written).toBe(1048576); expect(output(await r.invoke(request("filesystem.read", { path }))).content).toBe(content); expect((await fs.stat(join(root, path))).size).toBe(1048576); } }),
  "FX-POS-014": async () => { let removed = ""; await sandbox(async root => { removed = root; const p = await configured(root); output(await write(p, "owned")); }); await expect(fs.lstat(removed)).rejects.toMatchObject({ code: "ENOENT" }); },
};

const invalidPaths = ["/etc/passwd", "C:/work/file", "//host/share/file", "nested\\file", "../file", "nested/./child.txt", "text\0.txt", "a".repeat(256)];
export const negatives: Record<string, () => Promise<void>> = Object.fromEntries(invalidPaths.map((path, i) => [`FX-NEG-${String(i + 1).padStart(3, "0")}`, () => setup(async p => {
  for (const capability of ["filesystem.read", "filesystem.list", "filesystem.write"]) {
    const spy = vi.spyOn(fs, "open");
    try { const r = await p.invoke(request(capability, { path, ...(capability === "filesystem.write" ? { mode: "CREATE_NEW", content: "text" } : {}) })); expect(r.status).not.toBe("SUCCESS"); expect(spy).not.toHaveBeenCalled(); }
    finally { spy.mockRestore(); }
  }
})]));
Object.assign(negatives, {
  "FX-NEG-009": () => setup(async (_p, root) => { const p = await configured(root, ["nested"]); blocked(await read(p)); blocked(await p.invoke(request("filesystem.list", { path: "." }))); }),
  "FX-NEG-010": () => setup(async (_p, root) => { for (const scopes of [[], ["nested"]]) { const p = await configured(root, ["."], scopes); blocked(await write(p, "new")); await expect(fs.lstat(join(root, "new"))).rejects.toMatchObject({ code: "ENOENT" }); } }),
  "FX-NEG-011": () => setup(async (p, root) => { await fs.mkdir(join(root, ".git")); await fs.writeFile(join(root, ".git/config"), "ordinary text"); blocked(await read(p, ".git/config")); blocked(await write(p, ".git/new")); blocked(await p.invoke(request("filesystem.list", { path: ".git" }))); }),
  "FX-NEG-012": () => setup(async (p, root) => { for (const name of [".env", ".env.local", ".npmrc", ".pypirc", ".netrc", "file.pem", "file.key"]) { await fs.writeFile(join(root, name), "ordinary text"); blocked(await read(p, name)); blocked(await write(p, name, "replacement", "OVERWRITE_EXISTING", sha("ordinary text"))); expect(await fs.readFile(join(root, name), "utf8")).toBe("ordinary text"); } for (const name of [".ssh", ".gnupg", ".aws", ".azure", ".kube"]) { await fs.mkdir(join(root, name)); await fs.writeFile(join(root, name, "data"), "ordinary"); blocked(await read(p, `${name}/data`)); } await fs.writeFile(join(root, ".env.example"), "ordinary text"); output(await read(p, ".env.example")); }),
  "FX-NEG-013": () => setup(async (p, root) => { await sandbox(async outside => { await fs.writeFile(join(outside, "data"), "outside"); for (const [name, target] of [["inside", join(root, "nested")], ["outside", outside]]) { await fs.symlink(target, join(root, name)); blocked(await read(p, `${name}/${name === "inside" ? "child.txt" : "data"}`)); blocked(await write(p, `${name}/new`)); } expect(await fs.readdir(outside)).toEqual(["data"]); }); }),
  "FX-NEG-014": () => setup(async (p, root) => { await sandbox(async outside => { await fs.writeFile(join(outside, "data"), "outside"); for (const [name, target] of [["inside", join(root, "text.txt")], ["outside", join(outside, "data")]]) { await fs.symlink(target, join(root, name)); blocked(await read(p, name)); blocked(await write(p, name)); blocked(await write(p, name, "replacement", "OVERWRITE_EXISTING", sha("outside"))); } expect(await fs.readFile(join(outside, "data"), "utf8")).toBe("outside"); }); }),
  "FX-NEG-015": () => setup(async (p, root) => { await sandbox(async outside => { await fs.link(join(root, "text.txt"), join(outside, "alias")); expect((await fs.stat(join(root, "text.txt"))).nlink).toBe(2); blocked(await write(p, "text.txt", "replacement", "OVERWRITE_EXISTING", sha("Hello café 世界\n"))); expect(await fs.readFile(join(outside, "alias"), "utf8")).toBe("Hello café 世界\n"); }); }),
  "FX-NEG-016": () => setup(async p => { fail(await read(p, "missing"), "NOT_FOUND"); }),
  "FX-NEG-017": () => setup(async p => { fail(await read(p, "nested"), "INVALID_INPUT"); }),
  "FX-NEG-018": () => setup(async p => { fail(await p.invoke(request("filesystem.list", { path: "text.txt" })), "INVALID_INPUT"); }),
  "FX-NEG-019": () => setup(async (p, root) => { fail(await write(p, "absent/new"), "NOT_FOUND"); await expect(fs.lstat(join(root, "absent"))).rejects.toMatchObject({ code: "ENOENT" }); }),
  "FX-NEG-020": () => setup(async (p, root) => { blocked(await write(p, "text.txt")); expect(await fs.readFile(join(root, "text.txt"), "utf8")).toBe("Hello café 世界\n"); }),
  "FX-NEG-021": () => setup(async (p, root) => { expect((await write(p, "missing", "text", "OVERWRITE_EXISTING", sha(""))).status).not.toBe("SUCCESS"); await expect(fs.lstat(join(root, "missing"))).rejects.toMatchObject({ code: "ENOENT" }); }),
  "FX-NEG-022": () => setup(async (p, root) => { fail(await write(p, "text.txt", "replacement", "OVERWRITE_EXISTING"), "INVALID_INPUT"); expect(await fs.readFile(join(root, "text.txt"), "utf8")).toBe("Hello café 世界\n"); }),
  "FX-NEG-023": () => setup(async (p, root) => { blocked(await write(p, "text.txt", "replacement", "OVERWRITE_EXISTING", sha("stale"))); expect(await fs.readFile(join(root, "text.txt"), "utf8")).toBe("Hello café 世界\n"); expect(await fs.readdir(root)).toEqual(["nested", "text.txt"]); }),
  "FX-NEG-024": () => setup(async (p, root) => { await fs.writeFile(join(root, "large"), Buffer.alloc(1048577, 65)); fail(await read(p, "large"), "INVALID_INPUT"); }),
  "FX-NEG-025": () => setup(async (p, root) => { fail(await write(p, "large", "a".repeat(1048577)), "INVALID_INPUT"); await expect(fs.lstat(join(root, "large"))).rejects.toMatchObject({ code: "ENOENT" }); }),
  "FX-NEG-026": () => setup(async (p, root) => { await fs.mkdir(join(root, "many")); await Promise.all(Array.from({ length: 1001 }, (_, i) => fs.writeFile(join(root, "many", String(i)), ""))); fail(await p.invoke(request("filesystem.list", { path: "many" })), "INVALID_INPUT"); }),
  "FX-NEG-027": () => setup(async (p, root) => { for (const bytes of [Buffer.from([0xff]), Buffer.from([0xc0, 0x80]), Buffer.from([0xed, 0xa0, 0x80]), Buffer.from([0xe2, 0x82])]) { await fs.writeFile(join(root, "invalid"), bytes); fail(await read(p, "invalid"), "INVALID_INPUT"); } }),
  "FX-NEG-028": () => setup(async (p, root) => { for (const content of secretShapes()) { await fs.writeFile(join(root, "sensitive"), content); const r = await read(p, "sensitive"); blocked(r); expect(JSON.stringify(r)).not.toContain(content); } }),
  "FX-NEG-029": () => setup(async (p, root) => { for (const content of secretShapes()) { blocked(await write(p, "sensitive", content)); await expect(fs.lstat(join(root, "sensitive"))).rejects.toMatchObject({ code: "ENOENT" }); } }),
  "FX-NEG-030": () => setup(async p => { const spy = vi.spyOn(p, "invoke"); const r = restricted(p, []); for (const id of ["filesystem.read", "filesystem.list"]) blocked(await r.invoke(request(id, { path: "text.txt" }))); expect(spy).not.toHaveBeenCalled(); }),
  "FX-NEG-031": () => setup(async (p, root) => { const spy = vi.spyOn(p, "invoke"); blocked(await restricted(p).invoke(request("filesystem.write", { path: "new", mode: "CREATE_NEW", content: "text" }))); expect(spy).not.toHaveBeenCalled(); await expect(fs.lstat(join(root, "new"))).rejects.toMatchObject({ code: "ENOENT" }); }),
  "FX-NEG-032": () => setup(async (p, root) => { for (const path of ["missing", "../outside", "text.txt", ".git/config"]) { const r = await read(p, path); expect(JSON.stringify(r)).not.toContain(root); if (r.status === "FAIL") expect(r.error.message.length).toBeLessThanOrEqual(500); if (r.status === "BLOCKED") expect(r.reason.length).toBeLessThanOrEqual(500); expect(r.evidence_refs?.length ?? 0).toBeLessThanOrEqual(8); } }),
  "FX-NEG-033": async () => { for (const config of [{}, { workspace_root: ".", read_allow_prefixes: ["."], write_allow_prefixes: [] }]) await expect(Provider.create(config as never)).rejects.toThrow(); expect(inferredScope(productionSources())).toBe(0); },
  "FX-NEG-034": async () => { assertBoundaries(); },
  "FX-NEG-035": async () => { expect(futureSurface(productionSources())).toBe(0); },
  "FX-NEG-036": async () => { expect(closureClaims(phaseText())).toBe(0); },
} satisfies Record<string, () => Promise<void>>);

export function secretShapes(): string[] {
  return ["Authorization: Bearer", "Proxy-Authorization: Bearer", "Cookie:", "Set-Cookie:", "password=", "passwd=", "passphrase=", "api_key=", "api-key=", "client_secret=", "access_token=", "refresh_token=", "id_token=", "session_token=", "credential_ref=", "auth_ref=", "connection_ref="].map(key => `${key} synthetic-value`).concat(["sk-" + "synthetic012345", "ghp_" + "synthetic012345", "-----BEGIN " + "PRIVATE KEY-----"]);
}
