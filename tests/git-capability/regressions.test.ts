import { expect, it, vi } from "vitest";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import * as gitProcess from "../../src/providers/capability/git/process.js";
import { withSimpleRepo, providerConfig, createProvider } from "./repoFixtures.js";
import { request, registry, output, STATUS, READ } from "./helpers.js";
import { assertBoundaries, assertPreExistingS14CFailureCause, PRE_EXISTING_S14C_FAILURES } from "./audit.js";

const run = (p: Awaited<ReturnType<typeof createProvider>>, cap: string, input: Record<string, unknown>, timeout_ms = 20000) =>
  p.invoke(request(cap, input, timeout_ms));

it("the S14D candidate surface is exactly additive under the authorized prefixes", () => {
  assertBoundaries();
});

it("the 8 failing tests/shell-capability tests are PRE-EXISTING inherited S14C-harness failures, cause verified", () => {
  // S14D changed nothing under tests/shell-capability/**; the failures come from the
  // CLOSED S14C harness pinning its continuity baseline at 3cd344d… with no
  // continuity-file exemption, and STATE.yaml / CURRENT.md legitimately moving on
  // afterwards. tests/shell-capability/** is a protected surface S14D may not modify.
  assertPreExistingS14CFailureCause();
  expect(PRE_EXISTING_S14C_FAILURES).toHaveLength(8);
});

it("rejects a configured repository root that is itself a symlink", async () => {
  await withSimpleRepo(async fx => {
    const linkedRoot = join(fx.base, "configured-root-link");
    symlinkSync(fx.root, linkedRoot, "dir");
    await expect(createProvider(providerConfig(fx, { repository_root: linkedRoot }))).rejects.toThrow(
      "Invalid or unavailable explicit Git repository configuration.",
    );
  });
});

it("input accessors are rejected without evaluation", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    let getters = 0;
    const input = Object.defineProperty({}, "path", { enumerable: true, get() { getters++; return "hello.txt"; } });
    expect(await p.invoke({ ...request(READ, input) })).toMatchObject({ status: "FAIL", error: { code: "INVALID_INPUT" } });
    expect(getters).toBe(0);
  });
});

it("an unknown capability id is blocked and descriptors are detached from provider state", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const ds = await p.list_capabilities();
    ds[0].side_effects = "EXTERNAL";
    ds[0].capability_id = "repository.mutated";
    const fresh = await p.list_capabilities();
    expect(fresh.map(d => [d.capability_id, d.side_effects])).toEqual([[STATUS, "NONE"], [READ, "NONE"]]);
    expect((await p.invoke({ ...request(STATUS, {}), capability_id: "repository.diff" })).status).toBe("BLOCKED");
    expect((await p.invoke({ ...request(STATUS, {}), capability_id: "repository.commit" })).status).toBe("BLOCKED");
  });
});

it("a settled invocation reports a non-negative duration_ms", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const r = await run(p, STATUS, {});
    expect(typeof r.duration_ms).toBe("number");
    expect(r.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

it("a request timeout of zero or a non-finite value is rejected before any spawn", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const launcher = vi.spyOn(gitProcess, "startGitProcess");
    try {
      for (const timeout_ms of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect((await p.invoke({ ...request(STATUS, {}), timeout_ms })).status).toBe("FAIL");
      }
      expect(launcher).not.toHaveBeenCalled();
    } finally { launcher.mockRestore(); }
  });
});

it("the real registry routes both repository.* ids with no git-specific branch and two diagnostics", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const reg = registry(p);
    expect((await reg.list_capabilities()).map(d => d.capability_id).sort()).toEqual([READ, STATUS]);
    expect(reg.diagnostics()).toHaveLength(2);
    expect(output(await reg.invoke(request(READ, { path: "hello.txt" }))).content).toBe("Hello S14D\n");
  });
});

it("observed_at is a UTC ISO-8601 timestamp and head is a full oid or empty", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const o = output(await run(p, STATUS, {}));
    expect(o.observed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(o.head === "" || /^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(o.head as string)).toBe(true);
  });
});

it("evidence refs are logical repository:// URIs only, at most 4, never a host path", async () => {
  await withSimpleRepo(async fx => {
    const p = await createProvider(providerConfig(fx));
    const st = await run(p, STATUS, {});
    const rd = await run(p, READ, { path: "hello.txt" });
    expect(st.evidence_refs).toEqual(["repository://qa.repo/status"]);
    expect(rd.evidence_refs?.[0]).toMatch(/^repository:\/\/qa\.repo@[0-9a-f]{40}\/hello\.txt$/);
    for (const r of [st, rd]) {
      expect((r.evidence_refs ?? []).length).toBeLessThanOrEqual(4);
      for (const ref of r.evidence_refs ?? []) expect(ref).not.toContain(fx.root);
    }
  });
});
