import { describe, expect, it } from "vitest";
import { RestrictedCapabilityProvider, type CapabilityProvider, type ToolDescriptor, type ToolInvocationRequest } from "../../src/core/agent/index.js";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import type { CapabilityRegistryConfig } from "../../src/providers/capability/registry/types.js";
import { FakeCapabilityProvider, makeEchoProvider } from "./fixtures.js";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { LIMITS } from "../../src/providers/capability/registry/validation.js";
import { NEGATIVE_FIXTURE_IDS, POSITIVE_FIXTURE_IDS } from "./fixtureTruth.js";

const request = (): ToolInvocationRequest => ({ run_id: "run", turn: 1, call_id: "call", capability_id: "demo.read", input: {}, timeout_ms: 1000 });
const descriptor = (): ToolDescriptor => ({ capability_id: "demo.read", name: "read", description: "Read a reference value", input_schema: {}, side_effects: "NONE" });
const config = (provider: CapabilityProvider): CapabilityRegistryConfig => ({ providers: [{ provider_id: "a", provider }], bindings: [{ capability_id: "demo.read", selected_provider_id: "a" }] });

describe("registry boundary regressions", () => {
  it("matches limits and exact fixture identities to the parsed canonical contract", () => {
    const quality = load(readFileSync("brain-bootstrap/quality-contracts/S14_CAPABILITY_REGISTRY_TOOLS_MCP_DEEP.yaml", "utf8")) as {
      limits: Record<string, number>; s14a_positive_fixtures: { id: string }[]; s14a_negative_fixtures: { id: string }[];
    };
    expect(quality.s14a_positive_fixtures.map(f => f.id)).toEqual(POSITIVE_FIXTURE_IDS);
    expect(quality.s14a_negative_fixtures.map(f => f.id)).toEqual(NEGATIVE_FIXTURE_IDS);
    expect(quality.limits).toEqual({ max_registry_providers: LIMITS.providers, max_registry_capabilities: LIMITS.capabilities,
      max_capabilities_per_provider: LIMITS.perProvider, max_safe_id_chars: LIMITS.id,
      max_descriptor_description_chars: LIMITS.description, max_diagnostic_refs: LIMITS.diagnostics });
  });
  it("accepts inclusive capability limits and rejects aggregate catalog overflow", async () => {
    const providers = Array.from({ length: 2 }, (_, n) => ({ provider_id: `p${n}`, provider: new FakeCapabilityProvider(
      Array.from({ length: 128 }, (_, i) => ({ ...descriptor(), capability_id: `demo.c${n * 128 + i}` }))) }));
    const bindings = Array.from({ length: 256 }, (_, i) => ({ capability_id: `demo.c${i}`, selected_provider_id: `p${Math.floor(i / 128)}` }));
    expect(await new CapabilityRegistryProvider({ providers, bindings }).list_capabilities()).toHaveLength(256);
    providers.push({ provider_id: "extra", provider: new FakeCapabilityProvider([{ ...descriptor(), capability_id: "demo.extra" }]) });
    expect(await new CapabilityRegistryProvider({ providers, bindings }).list_capabilities()).toEqual([]);
  });
  it.each(["", "github.repository.read", "demo read", "a".repeat(161)])("rejects invalid capability binding %s", id => {
    const cfg = config(makeEchoProvider("demo.read", "a"));
    cfg.bindings[0].capability_id = id;
    expect(() => new CapabilityRegistryProvider(cfg)).toThrow(/INVALID_CONFIG/);
  });
  it.each(["sk-abcdef1234567890", "Authorization: Bearer test-token", "", "a".repeat(161)])("rejects unsafe provider identifiers without echoing %s", id => {
    const cfg = config(makeEchoProvider("demo.read", "a"));
    cfg.providers[0].provider_id = id;
    cfg.bindings[0].selected_provider_id = id;
    try { new CapabilityRegistryProvider(cfg); expect.fail("accepted invalid identifier"); }
    catch (error) { expect(String(error)).toContain("INVALID_CONFIG"); if (id) expect(String(error)).not.toContain(id); }
  });
  it("rejects extra credential configuration fields", () => {
    const cfg = { ...config(makeEchoProvider("demo.read", "a")), credential_ref: "private-reference" };
    expect(() => new CapabilityRegistryProvider(cfg)).toThrow(/INVALID_CONFIG/);
  });
  it.each([null, {}, { providers: [], bindings: [null] }])("rejects malformed configuration", cfg => {
    expect(() => new CapabilityRegistryProvider(cfg as unknown as CapabilityRegistryConfig)).toThrow(/INVALID_CONFIG/);
  });
  it("enforces provider and binding limits", () => {
    const cfg = config(makeEchoProvider("demo.read", "a"));
    cfg.providers = Array.from({ length: 65 }, (_, i) => ({ provider_id: `p${i}`, provider: makeEchoProvider("demo.read", "a") }));
    expect(() => new CapabilityRegistryProvider(cfg)).toThrow(/INVALID_CONFIG/);
    const cfg2 = config(makeEchoProvider("demo.read", "a"));
    cfg2.bindings = Array.from({ length: 257 }, (_, i) => ({ capability_id: `demo.c${i}`, selected_provider_id: "a" }));
    expect(() => new CapabilityRegistryProvider(cfg2)).toThrow(/INVALID_CONFIG/);
  });
  it("bounds diagnostics without dropping unresolved routes and returns detached values", async () => {
    const cfg = config(makeEchoProvider("demo.read", "a"));
    cfg.bindings = Array.from({ length: 256 }, (_, i) => ({ capability_id: `demo.c${i}`, selected_provider_id: "missing" }));
    const registry = new CapabilityRegistryProvider(cfg);
    expect(registry.diagnostics()).toHaveLength(128);
    expect((await registry.invoke({ ...request(), capability_id: "demo.c255" })).status).toBe("BLOCKED");
    const a = makeEchoProvider("demo.read", "a");
    const b = makeEchoProvider("demo.read", "b");
    const registry2 = new CapabilityRegistryProvider({ ...config(a), providers: [{ provider_id: "a", provider: a }, { provider_id: "b", provider: b }] });
    const route = registry2.diagnostics()[0].route;
    if (route.status === "RESOLVED") route.selected_provider_id = "b";
    await registry2.invoke(request());
    expect(a.invokeCallCount).toBe(1); expect(b.invokeCallCount).toBe(0);
  });
  it.each(["invoke", "list"])("normalizes secret-bearing and non-stringifiable %s exceptions", async method => {
    for (const thrown of [new Error("Authorization: Bearer planted-value"), { toString() { throw new Error("conversion"); } }]) {
      const provider: CapabilityProvider = {
        async list_capabilities() { if (method === "list") throw thrown; return [descriptor()]; },
        async invoke() { throw thrown; },
      };
      const registry = new CapabilityRegistryProvider(config(provider));
      const result = await registry.invoke(request());
      expect(result.status).toBe("FAIL"); expect(JSON.stringify(result)).not.toContain("planted-value");
      if (method === "list") {
        await expect(registry.list_capabilities()).resolves.toEqual([]);
        const restricted = new RestrictedCapabilityProvider(registry, new Set(["demo.read"]), new Set(["NONE"]));
        await expect(restricted.invoke(request())).resolves.toMatchObject({ status: "BLOCKED" });
      }
    }
  });
  it.each([
    { description: "Authorization: Bearer planted-value" },
    { credential_ref: "private-reference" },
    { input_schema: { password: "planted-value" } },
    { description: "x".repeat(2001) }, { side_effects: "INVALID" }, { timeout_ms: -1 }, { input_schema: null },
  ])("rejects malformed or sensitive descriptors", async change => {
    const provider = new FakeCapabilityProvider([{ ...descriptor(), ...change } as ToolDescriptor]);
    const registry = new CapabilityRegistryProvider(config(provider));
    expect(await registry.list_capabilities()).toEqual([]);
    expect((await registry.invoke(request())).status).not.toBe("SUCCESS");
    expect(provider.invokeCallCount).toBe(0);
  });
  it("rejects duplicate advertisements and per-provider overflow", async () => {
    for (const ds of [[descriptor(), descriptor()], Array.from({ length: 129 }, (_, i) => ({ ...descriptor(), capability_id: `demo.c${i}` }))]) {
      const provider = new FakeCapabilityProvider(ds);
      const registry = new CapabilityRegistryProvider(config(provider));
      expect(await registry.list_capabilities()).toEqual([]);
      expect((await registry.invoke(request())).status).not.toBe("SUCCESS");
      expect(provider.invokeCallCount).toBe(0);
    }
  });
  it.each(["input_schema", "output_schema", "side_effects", "timeout_ms"])("rejects incompatible %s in both provider orders", async key => {
    const changed = { ...descriptor(), [key]: key === "side_effects" ? "EXTERNAL" : key === "timeout_ms" ? 500 : { type: "object" } };
    const a = new FakeCapabilityProvider([descriptor()]); const b = new FakeCapabilityProvider([changed]);
    for (const providers of [[{ provider_id: "a", provider: a }, { provider_id: "b", provider: b }], [{ provider_id: "b", provider: b }, { provider_id: "a", provider: a }]]) {
      const registry = new CapabilityRegistryProvider({ ...config(a), providers });
      expect(await registry.list_capabilities()).toEqual([]);
      expect((await registry.invoke(request())).status).toBe("BLOCKED");
    }
    expect(a.invokeCallCount + b.invokeCallCount).toBe(0);
  });
  it("preserves equivalent schema key order and isolates returned descriptors", async () => {
    const a = new FakeCapabilityProvider([{ ...descriptor(), input_schema: { type: "object", properties: {} } }]);
    const b = new FakeCapabilityProvider([{ ...descriptor(), input_schema: { properties: {}, type: "object" } }]);
    const registry = new CapabilityRegistryProvider({ ...config(a), providers: [{ provider_id: "a", provider: a }, { provider_id: "b", provider: b }] });
    const listed = await registry.list_capabilities(); expect(listed).toHaveLength(1);
    listed[0].side_effects = "EXTERNAL";
    expect((await registry.list_capabilities())[0].side_effects).toBe("NONE");
    expect((await registry.invoke(request())).status).toBe("SUCCESS");
  });
  it("blocks descriptor drift between permission check and invocation", async () => {
    let lists = 0; let invokes = 0;
    const provider: CapabilityProvider = {
      async list_capabilities() { return [{ ...descriptor(), side_effects: ++lists === 1 ? "NONE" : "EXTERNAL" }]; },
      async invoke(r) { invokes++; return { status: "SUCCESS", call_id: r.call_id, capability_id: r.capability_id, output: {}, duration_ms: 0 }; },
    };
    const restricted = new RestrictedCapabilityProvider(new CapabilityRegistryProvider(config(provider)), new Set(["demo.read"]), new Set(["NONE"]));
    expect((await restricted.invoke(request())).status).toBe("BLOCKED"); expect(invokes).toBe(0);
  });
  it.each([null, {}, { status: "SUCCESS", output: null }, { status: "FAIL", error: null }, { status: "BLOCKED", reason: 42 }])("normalizes malformed invocation results", async malformed => {
    const provider = new FakeCapabilityProvider([descriptor()], () => malformed as never);
    await expect(new CapabilityRegistryProvider(config(provider)).invoke(request())).resolves.toMatchObject({ status: "FAIL", call_id: "call", capability_id: "demo.read" });
  });
  it("does not let providers mutate caller request or result identity", async () => {
    const r = request();
    const provider = new FakeCapabilityProvider([descriptor()], req => {
      req.call_id = "changed"; req.input.modified = true;
      return { status: "SUCCESS", call_id: req.call_id, capability_id: req.capability_id, output: {}, duration_ms: 0 };
    });
    expect((await new CapabilityRegistryProvider(config(provider)).invoke(r)).status).toBe("FAIL");
    expect(r).toEqual(request());
  });
});
