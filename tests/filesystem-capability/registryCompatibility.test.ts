import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { load } from "js-yaml";
import { canonical, LIMITS } from "../../src/providers/capability/registry/validation.js";
import { assertBoundaries, registryPatchOnly, closureClaims, phaseText, text } from "./audit.js";
import type { CapabilityProvider, ToolDescriptor, ToolInvocationResult } from "../../src/core/agent/index.js";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";

const request = { run_id: "compatibility", turn: 1, call_id: "call", capability_id: "filesystem.read", input: {}, timeout_ms: 10000 };
const descriptor: ToolDescriptor = { capability_id: request.capability_id, name: "Read", description: "Read text", input_schema: {}, side_effects: "NONE" };
const success = (output: Record<string, unknown> = {}, evidence_refs: string[] = [], capability_id = request.capability_id): ToolInvocationResult => ({ status: "SUCCESS", call_id: request.call_id, capability_id, duration_ms: 0, output, evidence_refs });
async function through(result: ToolInvocationResult, d = { ...descriptor, capability_id: result.capability_id }, invocation = { ...request, capability_id: d.capability_id }) {
  const provider: CapabilityProvider = { async list_capabilities() { return [d]; }, async invoke() { return result; } };
  return new CapabilityRegistryProvider({ providers: [{ provider_id: "selected", provider }], bindings: [{ capability_id: invocation.capability_id, selected_provider_id: "selected" }] }).invoke(invocation);
}
const readOutput = (content: string, path = "read.txt") => ({ path, content, bytes: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") });
const readMaximum = () => success(readOutput("x".repeat(1048576)));
const listMaximum = () => success({ path: ".", entries: Array.from({ length: 1000 }, (_, i) => ({ name: String(i).padStart(4, "0") + "x".repeat(251), kind: "FILE" })) }, [], "filesystem.list");
const evidenceMaximum = () => { const path = ("a".repeat(255) + "/").repeat(15) + "b".repeat(254) + "/c"; return success(readOutput("text", path), ["workspace://" + path]); };

const compatibilityCases: Record<string, () => Promise<void>> = {
  "COMP-POS-001": async () => { const value = success(readOutput("control")); expect(await through(value)).toStrictEqual(value); },
  "COMP-POS-002": async () => { const value = readMaximum(); expect(await through(value)).toStrictEqual(value); },
  "COMP-POS-003": async () => { const value = listMaximum(); expect(await through(value)).toStrictEqual(value); },
  "COMP-POS-004": async () => { const value = evidenceMaximum(); expect(value.evidence_refs![0].length).toBe(4108); expect(await through(value)).toStrictEqual(value); },
  "COMP-NEG-001": async () => { expect(await through(success({ content: "x".repeat(8388609) }))).toMatchObject({ status: "FAIL", error: { code: "INTERNAL_ERROR" } }); },
  "COMP-NEG-002": async () => { expect(await through(success({}, ["x".repeat(8193)]))).toMatchObject({ status: "FAIL" }); },
  "COMP-NEG-003": async () => { const result = await through(success({ content: "x".repeat(8300000) + "\npassword=" + "synthetic-value" })); expect(result.status).toBe("FAIL"); expect(JSON.stringify(result)).not.toContain("synthetic-value"); },
  "COMP-NEG-004": async () => { expect(await through(success(), { ...descriptor, input_schema: { description: "x".repeat(100001) } })).toMatchObject({ status: "FAIL" }); },
};

const invariants: Record<string, () => Promise<void>> = {
  "S14B-COMP-HI-001": compatibilityCases["COMP-POS-002"],
  "S14B-COMP-HI-002": compatibilityCases["COMP-POS-003"],
  "S14B-COMP-HI-003": compatibilityCases["COMP-POS-004"],
  "S14B-COMP-HI-004": compatibilityCases["COMP-NEG-001"],
  "S14B-COMP-HI-005": compatibilityCases["COMP-NEG-002"],
  "S14B-COMP-HI-006": async () => { await compatibilityCases["COMP-NEG-004"](); expect(() => canonical({ value: "x".repeat(100001) })).toThrow(); expect(LIMITS.description).toBe(2000); },
  "S14B-COMP-HI-007": compatibilityCases["COMP-NEG-003"],
  "S14B-COMP-HI-008": async () => {
    for (const change of [{ call_id: "different" }, { capability_id: "filesystem.list" }]) {
      const result = await through({ ...success(), ...change }, descriptor, request);
      expect(result).toMatchObject({ status: "FAIL", call_id: request.call_id, capability_id: request.capability_id });
    }
  },
  "S14B-COMP-HI-009": async () => { registryPatchOnly(); },
  "S14B-COMP-HI-010": async () => { await compatibilityCases["COMP-POS-002"](); await compatibilityCases["COMP-POS-003"](); registryPatchOnly(); },
  "S14B-COMP-HI-011": async () => { assertBoundaries(); },
  "S14B-COMP-HI-012": async () => { expect(closureClaims(phaseText())).toBe(0); },
};
it("matches compatibility inventories to the parsed canonical addendum", () => {
  const quality = load(text("brain-bootstrap/quality-contracts/S14B_REGISTRY_COMPATIBILITY_ERRATUM_DEEP.yaml")) as { compatibility_invariants: { id: string }[]; required_tests: { synthetic_composed: { id: string }[] } };
  expect(Object.keys(invariants)).toEqual(quality.compatibility_invariants.map(i => i.id));
  expect(Object.keys(compatibilityCases)).toEqual(quality.required_tests.synthetic_composed.map(i => i.id));
  expect(Object.keys(invariants)).toHaveLength(12);
});
describe("compatibility invariants", () => { for (const [id, exercise] of Object.entries(invariants)) it(id, exercise, 30000); });

it("retains exact result, public contract, evidence, depth, node and accessor bounds", async () => {
  const wrapper = JSON.stringify(success({ content: "" })).length;
  const atLimit = success({ content: "x".repeat(8388608 - wrapper) });
  expect(JSON.stringify(atLimit).length).toBe(8388608);
  expect((await through(atLimit)).status).toBe("SUCCESS");
  expect((await through(success({ content: "x".repeat(8388609 - wrapper) }))).status).toBe("FAIL");
  expect(canonical("x".repeat(99998)).length).toBe(100000);
  expect(() => canonical("x".repeat(99999))).toThrow();
  expect(await through(success({}, ["x".repeat(8192)]))).toStrictEqual(success({}, ["x".repeat(8192)]));
  for (const count of [128, 129]) expect((await through(success({}, Array(count).fill("workspace://safe")))).status).toBe(count === 128 ? "SUCCESS" : "FAIL");
  let nested: Record<string, unknown> = {};
  for (let i = 0; i < 33; i++) nested = { next: nested };
  expect((await through(success(nested))).status).toBe("FAIL");
  expect((await through(success({ nodes: Array(10001).fill(0) }))).status).toBe("FAIL");
  let calls = 0;
  const raw = success(); Object.defineProperty(raw, "output", { enumerable: true, get() { calls++; return {}; } });
  expect((await through(raw)).status).toBe("FAIL"); expect(calls).toBe(0);
  expect((await through(success(Object.create({ inherited: true })))).status).toBe("FAIL");
});

describe("canonical registry compatibility", () => {
  for (const [id, exercise] of Object.entries(compatibilityCases)) it(id, exercise);
});

it("escaped control UTF-8 payload survives the worst-case JSON expansion", async () => {
  const value = success(readOutput("\u0001".repeat(1048576)));
  expect(JSON.stringify(value).length).toBeGreaterThan(6291456);
  expect(await through(value)).toStrictEqual(value);
});
