import fs from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { ToolInvocationResult } from "../../src/core/agent/index.js";
import { configured, setup } from "./cases.js";
import { request, sandbox, output, sha } from "./helpers.js";
import { blob, closureClaims, futureSurface, inferredScope, phaseText, productionSources, protectedDifferences, prior } from "./audit.js";

const accepted = (results: ToolInvocationResult[]) => results.filter(r => r.status === "SUCCESS").length;
const changed = (before: Buffer, after: Buffer) => Number(!before.equals(after));
const exposures = (value: unknown, forbidden: string[]) => forbidden.filter(s => JSON.stringify(value).includes(s)).length;
function limitViolations(result: ToolInvocationResult, sourceBytes: number) {
  if (result.status !== "SUCCESS") return 0;
  const content = result.output.content;
  return Number(typeof content !== "string" || Buffer.byteLength(content) !== sourceBytes || sourceBytes > 1048576 || result.output.bytes !== sourceBytes);
}

it("UC01 path_escape_accepted: legitimate zero and real unsafe-reader detector fireability", async () => {
  await sandbox(async outside => {
    await fs.writeFile(join(outside, "outside"), "external text");
    await setup(async p => {
      const absolute = join(outside, "outside");
      expect(accepted([await p.invoke(request("filesystem.read", { path: absolute }))])).toBe(0);
      const unsafeContent = await fs.readFile(absolute, "utf8");
      const unsafeResult: ToolInvocationResult = { status: "SUCCESS", call_id: "observed", capability_id: "filesystem.read", output: { content: unsafeContent }, duration_ms: 0 };
      expect(accepted([unsafeResult])).toBe(1);
    });
  });
});
it("UC02 symlink_traversal_accepted: legitimate zero and actual follow-link outcome fires", async () => {
  await setup(async (p, root) => {
    await fs.symlink(join(root, "text.txt"), join(root, "alias"));
    expect((await fs.lstat(join(root, "alias"))).isSymbolicLink()).toBe(true);
    expect(accepted([await p.invoke(request("filesystem.read", { path: "alias" }))])).toBe(0);
    const content = await fs.readFile(join(root, "alias"), "utf8");
    expect(accepted([{ status: "SUCCESS", call_id: "observed", capability_id: "filesystem.read", output: { content }, duration_ms: 0 }])).toBe(1);
  });
});
it("UC03 implicit_root_or_scope_inference: missing config rejected; implicit-root mini-provider fires", async () => {
  const { WorkspaceFilesystemCapabilityProvider: P } = await import("../../src/providers/capability/filesystem/workspaceFilesystemCapabilityProvider.js");
  async function reachable(factory: () => Promise<Awaited<ReturnType<typeof P.create>>>) {
    try { const p = await factory(); return (await p.list_capabilities()).length; } catch { return 0; }
  }
  expect(await reachable(() => P.create({} as never))).toBe(0);
  expect(inferredScope(productionSources())).toBe(0);
  await sandbox(async root => {
    const implicitRoot = () => configured(root);
    expect(await reachable(implicitRoot)).toBe(3);
    expect(inferredScope("const root = process.cwd();")).toBe(1);
  });
});
it("UC04 unauthorized_read_or_list: observed scoped denials zero; broad-scope bypass fires", async () => {
  await setup(async (_p, root) => {
    const denied = await configured(root, ["nested"]);
    const requests = [request("filesystem.read", { path: "text.txt" }), request("filesystem.list", { path: "." })];
    expect(accepted(await Promise.all(requests.map(r => denied.invoke(r))))).toBe(0);
    const bypass = await configured(root, ["."]);
    expect(accepted(await Promise.all(requests.map(r => bypass.invoke(r))))).toBe(2);
  });
});
it("UC05 unauthorized_write_or_local_side_effect: measured target unchanged then bypass mutation fires", async () => {
  await setup(async (_p, root) => {
    const target = join(root, "text.txt"); const before = await fs.readFile(target);
    const denied = await configured(root, ["."], []);
    const r = request("filesystem.write", { path: "text.txt", content: "changed", mode: "OVERWRITE_EXISTING", expected_sha256: sha(before) });
    expect((await denied.invoke(r)).status).toBe("BLOCKED");
    expect(changed(before, await fs.readFile(target))).toBe(0);
    const bypass = await configured(root); output(await bypass.invoke(r));
    expect(changed(before, await fs.readFile(target))).toBe(1);
  });
});
it("UC06 create_new_clobber: actual no-clobber zero; naive writeFile clobber fires", async () => {
  await setup(async (p, root) => {
    const target = join(root, "text.txt"); const before = await fs.readFile(target);
    await p.invoke(request("filesystem.write", { path: "text.txt", content: "changed", mode: "CREATE_NEW" }));
    expect(changed(before, await fs.readFile(target))).toBe(0);
    await fs.writeFile(target, "naive clobber");
    expect(changed(before, await fs.readFile(target))).toBe(1);
  });
});
it("UC07 overwrite_without_matching_precondition: real stale-hash zero; naive overwrite fires", async () => {
  await setup(async (p, root) => {
    const target = join(root, "text.txt"); const before = await fs.readFile(target);
    const stale = sha("unrelated"); expect(stale).not.toBe(sha(before));
    await p.invoke(request("filesystem.write", { path: "text.txt", content: "changed", mode: "OVERWRITE_EXISTING", expected_sha256: stale }));
    expect(changed(before, await fs.readFile(target))).toBe(0);
    await fs.writeFile(target, "naive stale overwrite");
    expect(changed(before, await fs.readFile(target))).toBe(1);
  });
});
it("UC08 secret_or_absolute_path_exposure: real content blocked; raw file content detector fires", async () => {
  await setup(async (p, root) => {
    const credential = "password=" + "synthetic-value";
    await fs.writeFile(join(root, "sensitive"), credential + "\n" + root);
    const r = await p.invoke(request("filesystem.read", { path: "sensitive" }));
    expect(r.status).toBe("BLOCKED"); expect(exposures(r, [credential, root])).toBe(0);
    const naive = await fs.readFile(join(root, "sensitive"), "utf8");
    expect(exposures(naive, [credential, root])).toBe(2);
  });
});
it("UC09 silent_truncation_or_limit_bypass: real limit rejection zero; bounded naive slice fires", async () => {
  await setup(async (p, root) => {
    const target = join(root, "large"); await fs.writeFile(target, Buffer.alloc(1048577, 65));
    const bytes = (await fs.stat(target)).size;
    expect(limitViolations(await p.invoke(request("filesystem.read", { path: "large" })), bytes)).toBe(0);
    const truncated = (await fs.readFile(target)).subarray(0, 1048576).toString("utf8");
    expect(limitViolations({ status: "SUCCESS", call_id: "observed", capability_id: "filesystem.read", output: { content: truncated, bytes: Buffer.byteLength(truncated) }, duration_ms: 0 }, bytes)).toBe(1);
  });
});
it("UC10 protected_boundary_modified: all baseline bytes unchanged; mutated byte detector fires", () => {
  expect(protectedDifferences()).toEqual([]);
  const original = prior("src/core/agent/types.ts");
  const differences = (a: Buffer, b: Buffer) => Number(blob(a) !== blob(b));
  expect(differences(original, original)).toBe(0);
  expect(differences(original, Buffer.concat([original, Buffer.from("\n")]))).toBe(1);
});
it("UC11 future_phase_execution_pulled_forward: real source zero; forbidden import detector fires", () => {
  const source = productionSources(); expect(futureSurface(source)).toBe(0);
  expect(futureSurface(source + '\nimport cp from "node:child_process";')).toBe(1);
});
it("UC12 s14_or_hi054_self_closure: actual continuity/report zero; injected closure detector fires", () => {
  const source = phaseText(); expect(closureClaims(source)).toBe(0);
  expect(closureClaims(source + "\nS14: CLOSED\nHI-054: AWARDED\n")).toBe(2);
});
