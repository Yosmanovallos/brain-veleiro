import { describe, expect, it } from "vitest";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import { canonical, canonicalToolResult } from "../../src/providers/capability/registry/validation.js";
import type { CapabilityProvider, ToolDescriptor, ToolInvocationResult } from "../../src/core/agent/index.js";
import { withRepo, providerConfig, createProvider } from "./repoFixtures.js";
import { request, output, registry, READ, STATUS } from "./helpers.js";

const SIZE_MAX = 1048576;

describe("registry result-envelope compatibility", () => {
  it("a real 1 MiB committed blob round-trips through the real registry untruncated", async () => {
    await withRepo(fx => { fx.writeBytes("big.txt", Buffer.alloc(SIZE_MAX, 0x78)); fx.commit("c1"); }, async fx => {
      const p = await createProvider(providerConfig(fx));
      const direct = output(await p.invoke(request(READ, { path: "big.txt" }, 60000)));
      const via = await registry(p).invoke(request(READ, { path: "big.txt" }, 60000));
      expect(via.status).toBe("SUCCESS");
      if (via.status === "SUCCESS") {
        expect(via.output).toStrictEqual(direct);
        expect(via.output.size_bytes).toBe(SIZE_MAX);
        expect(JSON.stringify(via).length).toBeGreaterThan(SIZE_MAX);
        expect(JSON.stringify(via).length).toBeLessThanOrEqual(8388608);
        expect(() => canonicalToolResult(via)).not.toThrow();
      }
    });
  });

  it("a worst-case control-byte 1 MiB blob survives the JSON escape expansion under the envelope", async () => {
    await withRepo(fx => { fx.writeBytes("ctrl.txt", Buffer.alloc(SIZE_MAX, 0x09)); fx.commit("c1"); }, async fx => {
      const p = await createProvider(providerConfig(fx));
      const via = await registry(p).invoke(request(READ, { path: "ctrl.txt" }, 60000));
      expect(via.status).toBe("SUCCESS");
      if (via.status === "SUCCESS") {
        expect((via.output.content as string).length).toBe(SIZE_MAX);
        expect(JSON.stringify(via).length).toBeLessThanOrEqual(8388608);
        expect(() => canonicalToolResult(via)).not.toThrow();
      }
    });
  });

  it("a 1000-path status result passes the real 10000-node / 8388608-char envelope", async () => {
    await withRepo(fx => { fx.write(".keep", ""); fx.commit("c0"); }, async fx => {
      for (let i = 0; i < 1000; i++) await fx.write(`u${String(i).padStart(4, "0")}.txt`, "x\n");
      const p = await createProvider(providerConfig(fx));
      const via = await registry(p).invoke(request(STATUS, {}, 60000));
      expect(via.status).toBe("SUCCESS");
      if (via.status === "SUCCESS") {
        expect((via.output.paths as unknown[]).length).toBe(1000);
        expect(() => canonicalToolResult(via)).not.toThrow();
      }
    });
  });

  it("a synthetic oversized repository result is rejected by the registry, not truncated", async () => {
    const descriptor: ToolDescriptor = {
      capability_id: READ, name: "read", description: "read", input_schema: {}, side_effects: "NONE",
    };
    const oversized: ToolInvocationResult = {
      status: "SUCCESS", call_id: "call", capability_id: READ, duration_ms: 0,
      output: { repository_id: "x", content: "x".repeat(8388609) },
    };
    const provider: CapabilityProvider = { async list_capabilities() { return [descriptor]; }, async invoke() { return oversized; } };
    const reg = new CapabilityRegistryProvider({
      providers: [{ provider_id: "s", provider }], bindings: [{ capability_id: READ, selected_provider_id: "s" }],
    });
    const r = await reg.invoke(request(READ, {}));
    expect(r).toMatchObject({ status: "FAIL", error: { code: "INTERNAL_ERROR" } });
  });

  it("descriptor / public-contract canonical path (100000) is unchanged by S14D", () => {
    expect(canonical("x".repeat(99998)).length).toBe(100000);
    expect(() => canonical("x".repeat(99999))).toThrow();
  });

  it("two divergent repository.read descriptors co-registered collide and fail closed", async () => {
    await withRepo(fx => { fx.write("a.txt", "a\n"); fx.commit("c1"); }, async fx => {
      const real = await createProvider(providerConfig(fx));
      const divergent: CapabilityProvider = {
        async list_capabilities() {
          return [{
            capability_id: READ, name: "d", description: "d",
            input_schema: { type: "object", additionalProperties: true }, side_effects: "EXTERNAL",
          }];
        },
        async invoke() { return { status: "SUCCESS", call_id: "c", capability_id: READ, output: {}, duration_ms: 0 }; },
      };
      const reg = new CapabilityRegistryProvider({
        providers: [{ provider_id: "real", provider: real }, { provider_id: "d", provider: divergent }],
        bindings: [
          { capability_id: READ, selected_provider_id: "real" },
          { capability_id: STATUS, selected_provider_id: "real" },
        ],
      });
      expect((await reg.list_capabilities()).some(d => d.capability_id === READ)).toBe(false);
      expect((await reg.invoke(request(READ, { path: "a.txt" }))).status).toBe("BLOCKED");
      // repository.status, advertised by only one provider, is unaffected.
      expect((await reg.list_capabilities()).some(d => d.capability_id === STATUS)).toBe(true);
    });
  });
});
