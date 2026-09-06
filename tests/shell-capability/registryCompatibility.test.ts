import { describe, expect, it } from "vitest";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import type { CapabilityProvider, ToolDescriptor, ToolInvocationResult } from "../../src/core/agent/index.js";
import { canonical } from "../../src/providers/capability/registry/validation.js";
import { withShellSandbox, profile, create, config } from "./fixtures.js";
import { request, output, registry } from "./helpers.js";

const invocation = { run_id: "compat", turn: 1, call_id: "call", capability_id: "shell.execute", input: { profile_id: "qa.x", cwd: "." }, timeout_ms: 30000 };
const descriptor: ToolDescriptor = { capability_id: "shell.execute", name: "Execute", description: "shell", input_schema: {}, side_effects: "LOCAL" };
const success = (out: Record<string, unknown>): ToolInvocationResult => ({ status: "SUCCESS", call_id: invocation.call_id, capability_id: invocation.capability_id, duration_ms: 0, output: out, evidence_refs: ["shell://qa.x@workspace/."] });

async function through(result: ToolInvocationResult): Promise<ToolInvocationResult> {
  const provider: CapabilityProvider = { async list_capabilities() { return [descriptor]; }, async invoke() { return result; } };
  return new CapabilityRegistryProvider({ providers: [{ provider_id: "s", provider }], bindings: [{ capability_id: "shell.execute", selected_provider_id: "s" }] }).invoke(invocation);
}

describe("registry result-envelope compatibility", () => {
  it("a real 1 MiB combined shell result round-trips through the real registry untruncated", async () => {
    await withShellSandbox(async sb => {
      const p = await create(config(sb.root, profile({ profile_id: "qa.max", executable: sb.script("emit"), argv: ["524288", "both"], max_timeout_ms: 30000 })));
      const direct = output(await p.invoke(request({ profile_id: "qa.max", cwd: "." }, 30000)));
      const viaRegistry = await registry(p).invoke(request({ profile_id: "qa.max", cwd: "." }, 30000));
      expect(viaRegistry.status).toBe("SUCCESS");
      if (viaRegistry.status === "SUCCESS") expect(viaRegistry.output).toStrictEqual(direct);
    });
  });

  it("a real worst-case control-char 1 MiB result survives the ~6x JSON escape expansion", async () => {
    await withShellSandbox(async sb => {
      const p = await create(config(sb.root, profile({ profile_id: "qa.ctrl", executable: sb.script("emitctrl"), argv: ["524288", "both"], max_timeout_ms: 30000 })));
      const viaRegistry = await registry(p).invoke(request({ profile_id: "qa.ctrl", cwd: "." }, 30000));
      expect(viaRegistry.status).toBe("SUCCESS");
      if (viaRegistry.status === "SUCCESS") {
        expect(JSON.stringify(viaRegistry).length).toBeGreaterThan(6291456);
        expect(JSON.stringify(viaRegistry).length).toBeLessThanOrEqual(8388608);
        expect((viaRegistry.output.stdout as string).length).toBe(524288);
      }
    });
  });

  it("max+1 raw output fails in the provider before any oversized result exists", async () => {
    await withShellSandbox(async sb => {
      const p = await create(config(sb.root, profile({ profile_id: "qa.over", executable: sb.script("emitctrl"), argv: ["700000", "both"], max_timeout_ms: 30000 })));
      const r = await registry(p).invoke(request({ profile_id: "qa.over", cwd: "." }, 30000));
      expect(r.status).toBe("FAIL");
    });
  });

  it("a synthetic oversized shell result is rejected by the registry, not truncated", async () => {
    const r = await through(success({ profile_id: "qa.x", cwd: ".", exit_code: 0, signal: null, stdout: "x".repeat(8388609), stderr: "", stdout_bytes: 8388609, stderr_bytes: 0 }));
    expect(r).toMatchObject({ status: "FAIL", error: { code: "INTERNAL_ERROR" } });
  });

  it("descriptor / public-contract canonical path (100000) is unchanged by S14C", () => {
    expect(canonical("x".repeat(99998)).length).toBe(100000);
    expect(() => canonical("x".repeat(99999))).toThrow();
  });
});
