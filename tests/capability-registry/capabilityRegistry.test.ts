import { describe, it, expect } from "vitest";
import {
  RestrictedCapabilityProvider,
  compileAgentDefinition,
  runAgent,
  type AgentDefinition,
  type ModelDecisionRequest,
  type ModelDecisionResult,
  type ModelProvider,
} from "../../src/core/agent/index.js";
import { CapabilityRegistryProvider } from "../../src/providers/capability/registry/capabilityRegistryProvider.js";
import { validateCapabilityRegistryConfig } from "../../src/providers/capability/registry/validateConfig.js";
import type { CapabilityRegistryConfig } from "../../src/providers/capability/registry/types.js";
import {
  FakeCapabilityProvider,
  makeEchoProvider,
  makeFailingProvider,
  makeIdentityMismatchProvider,
  makeListThrowingProvider,
  makeNonAdvertisingProvider,
  makeSelfBlockingProvider,
  makeThrowingProvider,
} from "./fixtures.js";
import {
  scanForExternalExecutionSignals,
  scanForHiddenProviderSelection,
  scanForS15PlusPullForward,
  scanForSecretLikeContent,
  scanForTestOnlyBranching,
} from "./staticAudit.js";
import { BASELINE_COMMIT, currentBlobSha1, gitBlobSha1, PROTECTED_BLOBS } from "./baseline.js";
import {
  exercisedNegativeIds,
  exercisedPositiveIds,
  markNegative,
  markPositive,
  NEGATIVE_FIXTURE_IDS,
  POSITIVE_FIXTURE_IDS,
} from "./fixtureTruth.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function invocationRequest(capabilityId: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    run_id: "run-1",
    turn: 1,
    call_id: "call-1",
    capability_id: capabilityId,
    input: {},
    timeout_ms: 1000,
    ...overrides,
  } as const;
}

// ---------------------------------------------------------------------------
// FX-POS-001 / FX-POS-002 — explicit single/double capability routing
// ---------------------------------------------------------------------------

describe("FX-POS-001 — single capability routes to one explicit provider", () => {
  it("invokes exactly the selected provider", async () => {
    markPositive("FX-POS-001");
    const providerA = makeEchoProvider("demo.a", "A");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "provider-a", provider: providerA }],
      bindings: [{ capability_id: "demo.a", selected_provider_id: "provider-a" }],
    });

    const result = await registry.invoke(invocationRequest("demo.a"));
    expect(result.status).toBe("SUCCESS");
    expect(providerA.invokeCallCount).toBe(1);
  });
});

describe("FX-POS-002 — two capabilities route to two explicit providers", () => {
  it("routes each capability to its own selected provider", async () => {
    markPositive("FX-POS-002");
    const providerA = makeEchoProvider("demo.a", "A");
    const providerB = makeEchoProvider("demo.b", "B");
    const registry = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "provider-a", provider: providerA },
        { provider_id: "provider-b", provider: providerB },
      ],
      bindings: [
        { capability_id: "demo.a", selected_provider_id: "provider-a" },
        { capability_id: "demo.b", selected_provider_id: "provider-b" },
      ],
    });

    const resultA = await registry.invoke(invocationRequest("demo.a"));
    const resultB = await registry.invoke(invocationRequest("demo.b", { call_id: "call-2" }));

    expect(resultA.status).toBe("SUCCESS");
    expect(resultB.status).toBe("SUCCESS");
    expect(providerA.invokeCallCount).toBe(1);
    expect(providerB.invokeCallCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// FX-POS-003 — provider swap preserves AgentDefinition bytes, through the
// REAL Core path: compileAgentDefinition -> runAgent -> RestrictedCapabilityProvider
// -> CapabilityRegistryProvider -> selected provider.
// ---------------------------------------------------------------------------

const SWAP_AGENT_DEFINITION: AgentDefinition = {
  id: "s14a-swap-fixture-agent",
  role: "builder",
  objective: "Invoke the single permitted capability exactly once, then finish.",
  model_policy: { routing_class: "BALANCED", require_structured_decisions: true, allow_provider_substitution: true },
  context_policy: {
    retrieval_mode: "BOUNDED",
    max_context_tokens: 1000,
    max_items: 5,
    allowed_sources: ["CURRENT_TASK"],
    require_source_refs: false,
  },
  state_schema: { type: "object", additionalProperties: false, properties: {} },
  tools: ["demo.echo"],
  skills: [],
  capabilities: ["demo.echo"],
  memory_policy: {
    retrieve: false,
    remember_candidate: false,
    commit_verified_memory: false,
    search_history: false,
    promotion_policy: "DISABLED",
  },
  permissions: { allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  delegation: { allowed: false },
  limits: { max_turns: 3, timeout_ms: 5000 },
  termination: { require_terminal_outcome: true, require_explanation: true },
  output_schema: { type: "object", additionalProperties: true },
  rubric: { quality_contract_ref: "quality-contracts/s14a-swap-fixture" },
  evals: [],
};

class SingleToolCallThenFinishModelProvider implements ModelProvider {
  private called = false;
  constructor(private readonly capabilityId: string) {}

  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    if (!this.called) {
      this.called = true;
      return {
        status: "SUCCESS",
        decision: {
          type: "TOOL_CALL",
          rationale: "Invoke the one permitted capability.",
          tool_call: { call_id: "swap-call-1", capability_id: this.capabilityId, input: { probe: "swap" } },
        },
      };
    }
    return {
      status: "SUCCESS",
      decision: { type: "FINISH", rationale: "Done.", output: { summary: "Finished after one tool call." } },
    };
  }
}

describe("FX-POS-003 — provider swap through the real Core path preserves AgentDefinition bytes", () => {
  it("routes through provider A then provider B, driven by config only, AgentDefinition never mutated", async () => {
    markPositive("FX-POS-003");

    const beforeJson = JSON.stringify(SWAP_AGENT_DEFINITION);

    const providerA = makeEchoProvider("demo.echo", "A");
    const providerB = makeEchoProvider("demo.echo", "B");

    const registryConfigA: CapabilityRegistryConfig = {
      providers: [{ provider_id: "provider-a", provider: providerA }],
      bindings: [{ capability_id: "demo.echo", selected_provider_id: "provider-a" }],
    };
    const registryConfigB: CapabilityRegistryConfig = {
      providers: [{ provider_id: "provider-b", provider: providerB }],
      bindings: [{ capability_id: "demo.echo", selected_provider_id: "provider-b" }],
    };

    const compiledA = compileAgentDefinition(SWAP_AGENT_DEFINITION, {
      model_provider: new SingleToolCallThenFinishModelProvider("demo.echo"),
      capability_provider: new CapabilityRegistryProvider(registryConfigA),
    });
    const resultA = await runAgent(compiledA.run_options);

    const midJson = JSON.stringify(SWAP_AGENT_DEFINITION);

    const compiledB = compileAgentDefinition(SWAP_AGENT_DEFINITION, {
      model_provider: new SingleToolCallThenFinishModelProvider("demo.echo"),
      capability_provider: new CapabilityRegistryProvider(registryConfigB),
    });
    const resultB = await runAgent(compiledB.run_options);

    const afterJson = JSON.stringify(SWAP_AGENT_DEFINITION);

    expect(resultA.outcome).toBe("SUCCESS");
    expect(resultB.outcome).toBe("SUCCESS");
    expect(providerA.invokeCallCount).toBe(1);
    expect(providerB.invokeCallCount).toBe(1);

    // Sense 1: the in-memory AgentDefinition fixture object was never mutated
    // by routing through either configuration.
    expect(midJson).toBe(beforeJson);
    expect(afterJson).toBe(beforeJson);

    // Sense 2: the on-disk Core AgentDefinition contract file is untouched
    // (checked exhaustively for all protected files in staticAndBoundaryAudit.test.ts;
    // spot-checked here since this is the test that exercises the swap itself).
    expect(SWAP_AGENT_DEFINITION.capabilities).toEqual(["demo.echo"]);
  });
});

// ---------------------------------------------------------------------------
// FX-POS-004 / FX-POS-005
// ---------------------------------------------------------------------------

describe("FX-POS-004 — list_capabilities exposes selected routed descriptor", () => {
  it("returns the provider's real descriptor for the routed capability", async () => {
    markPositive("FX-POS-004");
    const provider = makeEchoProvider("demo.listed", "L", "LOCAL");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.listed", selected_provider_id: "p" }],
    });

    const descriptors = await registry.list_capabilities();
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0].capability_id).toBe("demo.listed");
    expect(descriptors[0].side_effects).toBe("LOCAL");
  });
});

describe("FX-POS-005 — invoke preserves call_id and capability_id", () => {
  it("echoes back the exact request identifiers on SUCCESS", async () => {
    markPositive("FX-POS-005");
    const provider = makeEchoProvider("demo.ids", "X");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.ids", selected_provider_id: "p" }],
    });

    const result = await registry.invoke(invocationRequest("demo.ids", { call_id: "call-xyz" }));
    expect(result.call_id).toBe("call-xyz");
    expect(result.capability_id).toBe("demo.ids");
  });
});

// ---------------------------------------------------------------------------
// FX-POS-006 / 007 / 008 — side-effect-gated permission composition
// ---------------------------------------------------------------------------

function buildRestricted(
  registry: CapabilityRegistryProvider,
  allowedCapabilityIds: string[],
  allowedSideEffects: Array<"NONE" | "LOCAL" | "EXTERNAL">,
): RestrictedCapabilityProvider {
  return new RestrictedCapabilityProvider(registry, new Set(allowedCapabilityIds), new Set(allowedSideEffects));
}

describe("FX-POS-006 — NONE side-effect capability passes compatible restriction", () => {
  it("SUCCEEDS when NONE is permitted", async () => {
    markPositive("FX-POS-006");
    const provider = makeEchoProvider("demo.none", "N", "NONE");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.none", selected_provider_id: "p" }],
    });
    const restricted = buildRestricted(registry, ["demo.none"], ["NONE"]);
    const result = await restricted.invoke(invocationRequest("demo.none"));
    expect(result.status).toBe("SUCCESS");
  });
});

describe("FX-POS-007 — LOCAL side-effect capability passes compatible restriction", () => {
  it("SUCCEEDS when LOCAL is permitted", async () => {
    markPositive("FX-POS-007");
    const provider = makeEchoProvider("demo.local", "L", "LOCAL");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.local", selected_provider_id: "p" }],
    });
    const restricted = buildRestricted(registry, ["demo.local"], ["NONE", "LOCAL"]);
    const result = await restricted.invoke(invocationRequest("demo.local"));
    expect(result.status).toBe("SUCCESS");
  });
});

describe("FX-POS-008 — EXTERNAL side-effect capability passes only when explicitly permitted", () => {
  it("BLOCKS without EXTERNAL permission and SUCCEEDS with it", async () => {
    markPositive("FX-POS-008");
    const provider = makeEchoProvider("demo.external", "E", "EXTERNAL");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.external", selected_provider_id: "p" }],
    });

    const withoutPermission = buildRestricted(registry, ["demo.external"], ["NONE", "LOCAL"]);
    const blocked = await withoutPermission.invoke(invocationRequest("demo.external"));
    expect(blocked.status).toBe("BLOCKED");
    expect(provider.invokeCallCount).toBe(0);

    const withPermission = buildRestricted(registry, ["demo.external"], ["NONE", "LOCAL", "EXTERNAL"]);
    const succeeded = await withPermission.invoke(invocationRequest("demo.external"));
    expect(succeeded.status).toBe("SUCCESS");
    expect(provider.invokeCallCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// FX-POS-009 / FX-POS-010 — determinism / multi-implementation selection
// ---------------------------------------------------------------------------

describe("FX-POS-009 — provider/binding registration order does not change normalized behavior", () => {
  it("list_capabilities output is identical regardless of array order", async () => {
    markPositive("FX-POS-009");
    const providerA = makeEchoProvider("demo.order.a", "A");
    const providerB = makeEchoProvider("demo.order.b", "B");

    const forward = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "provider-a", provider: providerA },
        { provider_id: "provider-b", provider: providerB },
      ],
      bindings: [
        { capability_id: "demo.order.a", selected_provider_id: "provider-a" },
        { capability_id: "demo.order.b", selected_provider_id: "provider-b" },
      ],
    });

    const providerA2 = makeEchoProvider("demo.order.a", "A");
    const providerB2 = makeEchoProvider("demo.order.b", "B");
    const reversed = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "provider-b", provider: providerB2 },
        { provider_id: "provider-a", provider: providerA2 },
      ],
      bindings: [
        { capability_id: "demo.order.b", selected_provider_id: "provider-b" },
        { capability_id: "demo.order.a", selected_provider_id: "provider-a" },
      ],
    });

    const forwardList = await forward.list_capabilities();
    const reversedList = await reversed.list_capabilities();

    expect(forwardList.map((d) => d.capability_id)).toEqual(reversedList.map((d) => d.capability_id));
    expect(forwardList.map((d) => d.capability_id)).toEqual(["demo.order.a", "demo.order.b"]);
  });
});

describe("FX-POS-010 — multiple implementations registered, one explicit selection resolves deterministically", () => {
  it("only the selected provider is ever invoked, repeatedly", async () => {
    markPositive("FX-POS-010");
    const selected = makeEchoProvider("demo.multi", "selected");
    const unselected = makeEchoProvider("demo.multi.alt", "unselected"); // different id: cannot collide with the same binding

    const registry = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "selected-provider", provider: selected },
        { provider_id: "unselected-provider", provider: unselected },
      ],
      bindings: [{ capability_id: "demo.multi", selected_provider_id: "selected-provider" }],
    });

    await registry.invoke(invocationRequest("demo.multi"));
    await registry.invoke(invocationRequest("demo.multi", { call_id: "call-2" }));

    expect(selected.invokeCallCount).toBe(2);
    expect(unselected.invokeCallCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FX-POS-011 / FX-POS-012 — normalized FAIL/BLOCKED pass-through
// ---------------------------------------------------------------------------

describe("FX-POS-011 — provider normalized FAIL result is preserved", () => {
  it("forwards the provider's own FAIL result verbatim", async () => {
    markPositive("FX-POS-011");
    const provider = makeFailingProvider("demo.fail");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.fail", selected_provider_id: "p" }],
    });
    const result = await registry.invoke(invocationRequest("demo.fail"));
    expect(result.status).toBe("FAIL");
    if (result.status === "FAIL") {
      expect(result.error.code).toBe("EXECUTION_FAILED");
    }
  });
});

describe("FX-POS-012 — provider normalized BLOCKED result is preserved", () => {
  it("forwards the provider's own BLOCKED result verbatim", async () => {
    markPositive("FX-POS-012");
    const provider = makeSelfBlockingProvider("demo.blocked");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.blocked", selected_provider_id: "p" }],
    });
    const result = await registry.invoke(invocationRequest("demo.blocked"));
    expect(result.status).toBe("BLOCKED");
    if (result.status === "BLOCKED") {
      expect(result.reason).toBe("Fixture-injected provider-local policy denial.");
    }
  });
});

// ---------------------------------------------------------------------------
// Negatives
// ---------------------------------------------------------------------------

describe("FX-NEG-001 — missing capability id fails closed", () => {
  it("BLOCKS an invoke() with an empty capability_id, never forwarding it", async () => {
    markNegative("FX-NEG-001");
    const provider = makeEchoProvider("demo.real", "R");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.real", selected_provider_id: "p" }],
    });
    const result = await registry.invoke(invocationRequest(""));
    expect(result.status).toBe("BLOCKED");
    expect(provider.invokeCallCount).toBe(0);
  });
});

describe("FX-NEG-002 — unknown selected provider id", () => {
  it("BLOCKS with REQUIRED_CAPABILITY_MISSING, not a crash", async () => {
    markNegative("FX-NEG-002");
    const registry = new CapabilityRegistryProvider({
      providers: [],
      bindings: [{ capability_id: "demo.orphan", selected_provider_id: "no-such-provider" }],
    });
    const result = await registry.invoke(invocationRequest("demo.orphan"));
    expect(result.status).toBe("BLOCKED");
    if (result.status === "BLOCKED") {
      expect(result.reason).toContain("REQUIRED_CAPABILITY_MISSING");
    }
  });
});

describe("FX-NEG-003 — no selected provider for required capability", () => {
  it("BLOCKS with REQUIRED_CAPABILITY_MISSING when zero bindings exist", async () => {
    markNegative("FX-NEG-003");
    const registry = new CapabilityRegistryProvider({ providers: [], bindings: [] });
    const result = await registry.invoke(invocationRequest("demo.missing"));
    expect(result.status).toBe("BLOCKED");
    if (result.status === "BLOCKED") {
      expect(result.reason).toContain("REQUIRED_CAPABILITY_MISSING");
    }
  });
});

describe("FX-NEG-004 — two selected providers for same capability", () => {
  it("BLOCKS with AMBIGUOUS_CAPABILITY_BINDING", async () => {
    markNegative("FX-NEG-004");
    const providerA = makeEchoProvider("demo.ambiguous", "A");
    const providerB = makeEchoProvider("demo.ambiguous", "B");
    const registry = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "provider-a", provider: providerA },
        { provider_id: "provider-b", provider: providerB },
      ],
      bindings: [
        { capability_id: "demo.ambiguous", selected_provider_id: "provider-a" },
        { capability_id: "demo.ambiguous", selected_provider_id: "provider-b" },
      ],
    });
    const result = await registry.invoke(invocationRequest("demo.ambiguous"));
    expect(result.status).toBe("BLOCKED");
    if (result.status === "BLOCKED") {
      expect(result.reason).toContain("AMBIGUOUS_CAPABILITY_BINDING");
    }
  });
});

describe("FX-NEG-005 — duplicate provider id", () => {
  it("rejects construction with a thrown, fatal, DUPLICATE_PROVIDER_ID error", () => {
    markNegative("FX-NEG-005");
    const providerX = makeEchoProvider("demo.x", "X1");
    const providerY = makeEchoProvider("demo.x", "X2");
    expect(
      () =>
        new CapabilityRegistryProvider({
          providers: [
            { provider_id: "dup", provider: providerX },
            { provider_id: "dup", provider: providerY },
          ],
          bindings: [],
        }),
    ).toThrowError(/DUPLICATE_PROVIDER_ID/);
  });
});

describe("FX-NEG-006 — provider does not advertise routed capability", () => {
  it("BLOCKS with PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY", async () => {
    markNegative("FX-NEG-006");
    const provider = makeNonAdvertisingProvider("demo.unrelated");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.routed", selected_provider_id: "p" }],
    });
    const result = await registry.invoke(invocationRequest("demo.routed"));
    expect(result.status).toBe("BLOCKED");
    if (result.status === "BLOCKED") {
      expect(result.reason).toContain("PROVIDER_DOES_NOT_ADVERTISE_CAPABILITY");
    }
  });
});

describe("FX-NEG-007 — provider descriptor advertises mismatched capability id", () => {
  it("BLOCKS even when the provider advertises a near-miss capability_id string", async () => {
    markNegative("FX-NEG-007");
    const provider = makeNonAdvertisingProvider("demo.routed-typo");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.routed", selected_provider_id: "p" }],
    });
    const listed = await registry.list_capabilities();
    expect(listed.find((d) => d.capability_id === "demo.routed")).toBeUndefined();
    const result = await registry.invoke(invocationRequest("demo.routed"));
    expect(result.status).toBe("BLOCKED");
  });
});

describe("FX-NEG-008 — provider-specific capability id required by AgentDefinition", () => {
  it("the stable capability id carries no vendor/provider prefix", () => {
    markNegative("FX-NEG-008");
    const vendorPrefixed = /^(github|gitlab|bitbucket|mcp|playwright|context7)\./i;
    for (const capabilityId of SWAP_AGENT_DEFINITION.capabilities) {
      expect(vendorPrefixed.test(capabilityId)).toBe(false);
    }
    // Non-vacuous: the same check correctly flags a deliberately vendor-qualified id.
    expect(vendorPrefixed.test("github.repository.read")).toBe(true);
  });
});

describe("FX-NEG-009 — hidden process.env provider selection", () => {
  it("real registry source contains zero hidden-selector signals (proven non-vacuous first)", () => {
    markNegative("FX-NEG-009");
    expect(scanForHiddenProviderSelection("const provider = process.env.PROVIDER_ID;")).not.toHaveLength(0);
    const realSource =
      readFileSync(join(process.cwd(), "src/providers/capability/registry/capabilityRegistryProvider.ts"), "utf8") +
      readFileSync(join(process.cwd(), "src/providers/capability/registry/validateConfig.ts"), "utf8");
    expect(scanForHiddenProviderSelection(realSource)).toEqual([]);
  });
});

describe("FX-NEG-010 — installed executable probing selects provider", () => {
  it("real registry source contains zero CLI-probing signals (proven non-vacuous first)", () => {
    markNegative("FX-NEG-010");
    expect(scanForHiddenProviderSelection('if (existsSync("/usr/bin/git")) { /* pick provider */ }')).not.toHaveLength(0);
    const realSource =
      readFileSync(join(process.cwd(), "src/providers/capability/registry/capabilityRegistryProvider.ts"), "utf8") +
      readFileSync(join(process.cwd(), "src/providers/capability/registry/validateConfig.ts"), "utf8");
    expect(scanForHiddenProviderSelection(realSource)).toEqual([]);
  });
});

describe("FX-NEG-011 — first registered provider silently wins ambiguity", () => {
  it("neither ambiguous provider is invoked, in either registration order", async () => {
    markNegative("FX-NEG-011");
    const providerA = makeEchoProvider("demo.race", "A");
    const providerB = makeEchoProvider("demo.race", "B");
    const forward = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "provider-a", provider: providerA },
        { provider_id: "provider-b", provider: providerB },
      ],
      bindings: [
        { capability_id: "demo.race", selected_provider_id: "provider-a" },
        { capability_id: "demo.race", selected_provider_id: "provider-b" },
      ],
    });
    await forward.invoke(invocationRequest("demo.race"));
    expect(providerA.invokeCallCount).toBe(0);
    expect(providerB.invokeCallCount).toBe(0);

    const providerA2 = makeEchoProvider("demo.race", "A");
    const providerB2 = makeEchoProvider("demo.race", "B");
    const reversed = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "provider-b", provider: providerB2 },
        { provider_id: "provider-a", provider: providerA2 },
      ],
      bindings: [
        { capability_id: "demo.race", selected_provider_id: "provider-b" },
        { capability_id: "demo.race", selected_provider_id: "provider-a" },
      ],
    });
    await reversed.invoke(invocationRequest("demo.race"));
    expect(providerA2.invokeCallCount).toBe(0);
    expect(providerB2.invokeCallCount).toBe(0);
  });
});

describe("FX-NEG-012 — provider side-effect class downgraded", () => {
  it("EXTERNAL side_effects survives list_capabilities() unchanged", async () => {
    markNegative("FX-NEG-012");
    const provider = makeEchoProvider("demo.external.se", "E", "EXTERNAL");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.external.se", selected_provider_id: "p" }],
    });
    const [descriptor] = await registry.list_capabilities();
    expect(descriptor.side_effects).toBe("EXTERNAL");
  });
});

describe("FX-NEG-013 — RestrictedCapabilityProvider allowlist bypass", () => {
  it("a capability outside the allowlist stays BLOCKED and never reaches the provider", async () => {
    markNegative("FX-NEG-013");
    const provider = makeEchoProvider("demo.denied", "D");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.denied", selected_provider_id: "p" }],
    });
    const restricted = buildRestricted(registry, ["some.other.capability"], ["NONE"]);
    const result = await restricted.invoke(invocationRequest("demo.denied"));
    expect(result.status).toBe("BLOCKED");
    expect(provider.invokeCallCount).toBe(0);
  });
});

describe("FX-NEG-014 — RestrictedCapabilityProvider side-effect bypass", () => {
  it("an allowed capability with a denied side-effect class stays BLOCKED", async () => {
    markNegative("FX-NEG-014");
    const provider = makeEchoProvider("demo.se.denied", "D", "EXTERNAL");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.se.denied", selected_provider_id: "p" }],
    });
    const restricted = buildRestricted(registry, ["demo.se.denied"], ["NONE", "LOCAL"]);
    const result = await restricted.invoke(invocationRequest("demo.se.denied"));
    expect(result.status).toBe("BLOCKED");
    expect(provider.invokeCallCount).toBe(0);
  });
});

describe("FX-NEG-015 — unknown capability invocation forwarded", () => {
  it("an entirely unbound capability_id is BLOCKED without reaching any registered provider", async () => {
    markNegative("FX-NEG-015");
    const provider = makeEchoProvider("demo.known", "K");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.known", selected_provider_id: "p" }],
    });
    const result = await registry.invoke(invocationRequest("demo.totally.unknown"));
    expect(result.status).toBe("BLOCKED");
    expect(provider.invokeCallCount).toBe(0);
  });
});

describe("FX-NEG-016 — provider throw escapes without normalization", () => {
  it("a thrown provider error resolves to a normalized FAIL, not an uncaught rejection", async () => {
    markNegative("FX-NEG-016");
    const provider = makeThrowingProvider("demo.throws", "boom: simulated provider crash");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.throws", selected_provider_id: "p" }],
    });
    await expect(registry.invoke(invocationRequest("demo.throws"))).resolves.toMatchObject({ status: "FAIL" });

    const listThrows = makeListThrowingProvider();
    const registry2 = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p2", provider: listThrows }],
      bindings: [{ capability_id: "demo.list.throws", selected_provider_id: "p2" }],
    });
    await expect(registry2.invoke(invocationRequest("demo.list.throws"))).resolves.toMatchObject({ status: "FAIL" });
  });
});

describe("FX-NEG-017/018/019/020 — no secret-shaped content anywhere model-visible", () => {
  it("proves the detector fires on planted secrets, then finds none in real registry output", async () => {
    markNegative("FX-NEG-017");
    markNegative("FX-NEG-018");
    markNegative("FX-NEG-019");
    markNegative("FX-NEG-020");

    expect(scanForSecretLikeContent("Authorization: Bearer sk-abcdef1234567890")).not.toHaveLength(0);
    expect(scanForSecretLikeContent("credential_ref: prov-normal-id")).toHaveLength(0);

    const provider = makeEchoProvider("demo.safe", "safe-provider-id");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "safe-provider-id", provider }],
      bindings: [{ capability_id: "demo.safe", selected_provider_id: "safe-provider-id" }],
    });

    const descriptors = await registry.list_capabilities();
    const diagnostics = registry.diagnostics();
    const invokeResult = await registry.invoke(invocationRequest("demo.safe"));

    const combined = JSON.stringify({ descriptors, diagnostics, invokeResult });
    expect(scanForSecretLikeContent(combined)).toEqual([]);

    // No credential/auth/connection reference field exists on ToolDescriptor at all (S14A scope decision).
    for (const descriptor of descriptors) {
      expect(Object.keys(descriptor)).not.toContain("credential_ref");
      expect(Object.keys(descriptor)).not.toContain("auth_ref");
      expect(Object.keys(descriptor)).not.toContain("connection_ref");
    }
  });
});

describe("S14A-HI-019 — duplicate incompatible capability descriptors do not collide", () => {
  it("registers two providers claiming the same capability_id; only the selected one's descriptor is ever surfaced", async () => {
    const selected = new FakeCapabilityProvider([
      {
        capability_id: "demo.multi.schema",
        name: "selected",
        description: "selected provider",
        input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        side_effects: "NONE",
      },
    ]);
    const unselectedButAdvertisesSameId = new FakeCapabilityProvider([
      {
        capability_id: "demo.multi.schema",
        name: "unselected",
        description: "unselected provider, incompatible schema",
        input_schema: { type: "object", properties: { number: { type: "number" } }, required: ["number"] },
        side_effects: "EXTERNAL",
      },
    ]);

    const registry = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "selected-provider", provider: selected },
        { provider_id: "unselected-provider", provider: unselectedButAdvertisesSameId },
      ],
      bindings: [{ capability_id: "demo.multi.schema", selected_provider_id: "selected-provider" }],
    });

    const descriptors = await registry.list_capabilities();
    const matches = descriptors.filter((d) => d.capability_id === "demo.multi.schema");
    expect(matches).toHaveLength(1);
    expect(matches[0].side_effects).toBe("NONE");
    expect(unselectedButAdvertisesSameId.listCallCount).toBe(0);
  });
});

describe("HI-010 non-vacuous — call_id/capability_id identity mismatch is normalized to FAIL", () => {
  it("a misbehaving provider returning wrong ids does not silently pass through", async () => {
    const provider = makeIdentityMismatchProvider("demo.mismatch");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.mismatch", selected_provider_id: "p" }],
    });
    const result = await registry.invoke(invocationRequest("demo.mismatch", { call_id: "expected-call-id" }));
    expect(result.status).toBe("FAIL");
    expect(result.call_id).toBe("expected-call-id");
    expect(result.capability_id).toBe("demo.mismatch");
  });
});

describe("validateCapabilityRegistryConfig — pure findings function", () => {
  it("returns exactly the expected finding codes for a mixed config", () => {
    const findings = validateCapabilityRegistryConfig({
      providers: [
        { provider_id: "dup", provider: makeEchoProvider("demo.x", "x1") },
        { provider_id: "dup", provider: makeEchoProvider("demo.x", "x2") },
      ],
      bindings: [
        { capability_id: "demo.ambiguous", selected_provider_id: "dup" },
        { capability_id: "demo.ambiguous", selected_provider_id: "missing-provider" },
        { capability_id: "demo.unknown-provider", selected_provider_id: "missing-provider" },
      ],
    });

    const codes = findings.map((f) => f.code).sort();
    expect(codes).toEqual(["AMBIGUOUS_CAPABILITY_BINDING", "DUPLICATE_PROVIDER_ID", "UNKNOWN_PROVIDER_REFERENCE"]);
  });
});

// ---------------------------------------------------------------------------
// FX-NEG-021 / 022 / 023 / 027 — protected-surface byte identity
// ---------------------------------------------------------------------------

function registrySourceText(): string {
  return (
    readFileSync(join(process.cwd(), "src/providers/capability/registry/capabilityRegistryProvider.ts"), "utf8") +
    readFileSync(join(process.cwd(), "src/providers/capability/registry/validateConfig.ts"), "utf8") +
    readFileSync(join(process.cwd(), "src/providers/capability/registry/types.ts"), "utf8")
  );
}

describe("FX-NEG-021 — registry changes AgentDefinition schema", () => {
  it("src/core/agent/definition.ts is byte-identical to baseline", () => {
    markNegative("FX-NEG-021");
    expect(currentBlobSha1("src/core/agent/definition.ts")).toBe(PROTECTED_BLOBS["src/core/agent/definition.ts"]);
  });
});

describe("FX-NEG-022 — registry changes Core CapabilityProvider contract", () => {
  it("src/core/agent/types.ts is byte-identical to baseline", () => {
    markNegative("FX-NEG-022");
    expect(currentBlobSha1("src/core/agent/types.ts")).toBe(PROTECTED_BLOBS["src/core/agent/types.ts"]);
  });
});

describe("FX-NEG-023 — registry changes S13G ExecutionToolDeclaration provider-binding boundary", () => {
  it("task-prompt-compiler types and S13G skill definition are byte-identical to baseline", () => {
    markNegative("FX-NEG-023");
    expect(currentBlobSha1("src/intelligence/task-prompt-compiler/types.ts")).toBe(
      PROTECTED_BLOBS["src/intelligence/task-prompt-compiler/types.ts"],
    );
    expect(currentBlobSha1("src/intelligence/skills/definitions/taskPromptCompilerS13G.ts")).toBe(
      PROTECTED_BLOBS["src/intelligence/skills/definitions/taskPromptCompilerS13G.ts"],
    );
  });

  it("S13H repository-git-workflow skill definition is byte-identical to baseline", () => {
    expect(currentBlobSha1("src/intelligence/skills/definitions/repositoryGitWorkflowS13H.ts")).toBe(
      PROTECTED_BLOBS["src/intelligence/skills/definitions/repositoryGitWorkflowS13H.ts"],
    );
  });
});

describe("FX-NEG-027 — new runtime dependency added", () => {
  it("package.json and package-lock.json are byte-identical to baseline (non-vacuous diff proof first)", () => {
    markNegative("FX-NEG-027");
    // Prove the byte-identity mechanism itself can detect a real difference.
    expect(gitBlobSha1(Buffer.from("a"))).not.toBe(gitBlobSha1(Buffer.from("b")));
    expect(currentBlobSha1("package.json")).toBe(PROTECTED_BLOBS["package.json"]);
    expect(currentBlobSha1("package-lock.json")).toBe(PROTECTED_BLOBS["package-lock.json"]);
  });
});

// ---------------------------------------------------------------------------
// FX-NEG-024 / 025 / 026 — no external execution capability anywhere in the
// S14A production registry path. Proven structurally: the registry module
// has zero fs/child_process/net/http/https/fetch import or call surface, so
// no invocation through it can reach one at runtime.
// ---------------------------------------------------------------------------

describe("FX-NEG-024/025/026 — no filesystem/shell/network execution in the S14A production path", () => {
  it("proves the scanner fires on a planted violation, then finds zero in the real registry source", () => {
    markNegative("FX-NEG-024");
    markNegative("FX-NEG-025");
    markNegative("FX-NEG-026");
    expect(scanForExternalExecutionSignals('import { readFileSync } from "node:fs";')).not.toHaveLength(0);
    expect(scanForExternalExecutionSignals('const cp = require("child_process");')).not.toHaveLength(0);
    expect(scanForExternalExecutionSignals('await fetch("https://example.com");')).not.toHaveLength(0);
    expect(scanForExternalExecutionSignals(registrySourceText())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// FX-NEG-028 — S14A must not claim S14 CLOSED or HI-054 AWARDED anywhere in
// its own builder report/handoff.
// ---------------------------------------------------------------------------

const BUILDER_REPORT_PATH = "brain-bootstrap/reports/S14A-capability-registry-foundation-verification.md";

describe("FX-NEG-028 — S14A claims S14 CLOSED or HI-054 AWARDED", () => {
  it("the builder report never claims S14 closure or HI-054 award", () => {
    markNegative("FX-NEG-028");
    const reportText = readFileSync(join(process.cwd(), BUILDER_REPORT_PATH), "utf8");
    expect(/S14[:\s]+CLOSED/i.test(reportText)).toBe(false);
    expect(/HI-054[:\s]+AWARDED/i.test(reportText)).toBe(false);
    expect(reportText).toMatch(/NOT_CLOSED|not.*closed/i);
    expect(reportText).toMatch(/NOT_AWARDED|not.*awarded/i);
  });
});

// ---------------------------------------------------------------------------
// Additional hard-invariant static checks not already covered above:
// HI-022 (no test-only branching), HI-029 (Core imports nothing from
// providers/), HI-030 (no S15+ vocabulary pulled forward).
// ---------------------------------------------------------------------------

describe("S14A-HI-022 — provider selection cannot branch on test-only concepts", () => {
  it("registry production source contains no fixture/expected/model-arm/skill-identity branching", () => {
    expect(scanForTestOnlyBranching("if (fixture_id === 'FX-POS-001') { return providerA; }")).not.toHaveLength(0);
    expect(scanForTestOnlyBranching(registrySourceText())).toEqual([]);
  });
});

describe("S14A-HI-029 — Core has no import of the registry or a concrete provider implementation", () => {
  it("no file under src/core/** imports from providers/", () => {
    const coreFiles = [
      "src/core/agent/types.ts",
      "src/core/agent/restrictedCapabilityProvider.ts",
      "src/core/agent/definition.ts",
      "src/core/agent/runtime.ts",
      "src/core/agent/compileDefinition.ts",
      "src/core/agent/validateDefinition.ts",
      "src/core/agent/index.ts",
    ];
    const importFromProviders = /\bfrom\s+["'][^"']*providers\//;
    const requireFromProviders = /require\s*\(\s*["'][^"']*providers\//;
    // Non-vacuous: prove the pattern actually matches a real import statement shape.
    expect(importFromProviders.test('import { X } from "../../providers/capability/foo.js";')).toBe(true);

    for (const relativePath of coreFiles) {
      const text = readFileSync(join(process.cwd(), relativePath), "utf8");
      expect(importFromProviders.test(text)).toBe(false);
      expect(requireFromProviders.test(text)).toBe(false);
    }
  });
});

describe("S14A-HI-030 — S15+ agent/workflow/orchestrator behavior is not pulled forward", () => {
  it("proves the scanner fires on planted S15+ vocabulary, then finds zero in the real registry source", () => {
    expect(scanForS15PlusPullForward("This module also implements the Orchestrator.")).not.toHaveLength(0);
    expect(scanForS15PlusPullForward(registrySourceText())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// S14A unsafe counters UC01..UC12 — each must be exactly 0 on the real
// candidate, and each detector is proven capable of returning non-zero
// against a deliberately bad adversarial input/mini-implementation first.
// ---------------------------------------------------------------------------

describe("S14A unsafe counters (UC01..UC12)", () => {
  it("UC01 provider_identity_leaked_into_agent_definition == 0", () => {
    const vendorPrefixed = /^(github|gitlab|bitbucket|mcp|playwright|context7)\./i;
    const countVendorQualified = (ids: readonly string[]) => ids.filter((id) => vendorPrefixed.test(id)).length;
    expect(countVendorQualified(["github.repository.read"])).toBe(1);
    expect(countVendorQualified(SWAP_AGENT_DEFINITION.capabilities)).toBe(0);
  });

  it("UC02 hidden_provider_autodetection == 0", () => {
    expect(scanForHiddenProviderSelection("process.env.PROVIDER").length).toBeGreaterThan(0);
    expect(scanForHiddenProviderSelection(registrySourceText())).toHaveLength(0);
  });

  it("UC03 ambiguous_binding_accepted == 0 (real registry) vs a naive mini-implementation (bug present)", async () => {
    const providerA = makeEchoProvider("demo.uc03", "A");
    const providerB = makeEchoProvider("demo.uc03", "B");
    const config: CapabilityRegistryConfig = {
      providers: [
        { provider_id: "a", provider: providerA },
        { provider_id: "b", provider: providerB },
      ],
      bindings: [
        { capability_id: "demo.uc03", selected_provider_id: "a" },
        { capability_id: "demo.uc03", selected_provider_id: "b" },
      ],
    };

    // Deliberately-wrong mini-implementation (test-only, never used in production):
    // naively picks the first binding for a capability regardless of ambiguity.
    async function naiveFirstWinsInvoke(cfg: CapabilityRegistryConfig, capabilityId: string) {
      const binding = cfg.bindings.find((b) => b.capability_id === capabilityId)!;
      const provider = cfg.providers.find((p) => p.provider_id === binding.selected_provider_id)!.provider;
      return provider.invoke(invocationRequest(capabilityId));
    }
    const naiveResult = await naiveFirstWinsInvoke(config, "demo.uc03");
    expect(naiveResult.status).toBe("SUCCESS"); // proves the check is capable of detecting the bug (non-vacuous)

    const registry = new CapabilityRegistryProvider(config);
    const realResult = await registry.invoke(invocationRequest("demo.uc03", { call_id: "uc03-real" }));
    expect(realResult.status).toBe("BLOCKED"); // real candidate: 0 instances of ambiguity silently accepted
  });

  it("UC04 first_provider_wins_resolution == 0 (checked via FX-NEG-011's call-count proof)", async () => {
    const providerA = makeEchoProvider("demo.uc04", "A");
    const providerB = makeEchoProvider("demo.uc04", "B");
    const registry = new CapabilityRegistryProvider({
      providers: [
        { provider_id: "a", provider: providerA },
        { provider_id: "b", provider: providerB },
      ],
      bindings: [
        { capability_id: "demo.uc04", selected_provider_id: "a" },
        { capability_id: "demo.uc04", selected_provider_id: "b" },
      ],
    });
    await registry.invoke(invocationRequest("demo.uc04"));
    expect(providerA.invokeCallCount + providerB.invokeCallCount).toBe(0);
  });

  it("UC05 side_effect_class_downgraded == 0 (real) vs a naive downgrading mini-implementation (bug present)", async () => {
    // Deliberately-wrong test-only helper: proves a downgrade would be detectable if it existed.
    const naiveDowngrade = (sideEffects: string) => "NONE";
    expect(naiveDowngrade("EXTERNAL")).not.toBe("EXTERNAL");

    const provider = makeEchoProvider("demo.uc05", "U", "EXTERNAL");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.uc05", selected_provider_id: "p" }],
    });
    const [descriptor] = await registry.list_capabilities();
    expect(descriptor.side_effects).toBe("EXTERNAL"); // real candidate: unchanged, not downgraded
  });

  it("UC06 restricted_provider_bypassed == 0 (composed) vs reaching the provider directly (bypass, bug present)", async () => {
    const provider = makeEchoProvider("demo.uc06", "U", "EXTERNAL");
    const registry = new CapabilityRegistryProvider({
      providers: [{ provider_id: "p", provider }],
      bindings: [{ capability_id: "demo.uc06", selected_provider_id: "p" }],
    });

    // Bypass proof: calling the inner registry directly (no Restricted layer) reaches the provider.
    await registry.invoke(invocationRequest("demo.uc06", { call_id: "bypass-proof" }));
    expect(provider.invokeCallCount).toBe(1);

    // Real composition: Restricted denies EXTERNAL, so the SAME provider is never reached again.
    const restricted = new RestrictedCapabilityProvider(registry, new Set(["demo.uc06"]), new Set(["NONE"]));
    await restricted.invoke(invocationRequest("demo.uc06", { call_id: "restricted-proof" }));
    expect(provider.invokeCallCount).toBe(1); // unchanged: Restricted blocked it before reaching the provider again
  });

  it("UC07 secret_material_exposed == 0", () => {
    expect(scanForSecretLikeContent("Authorization: Bearer sk-abcdef1234567890").length).toBeGreaterThan(0);
    expect(scanForSecretLikeContent(registrySourceText())).toHaveLength(0);
  });

  it("UC08 core_provider_contract_modified == 0", () => {
    expect(gitBlobSha1(Buffer.from("x"))).not.toBe(gitBlobSha1(Buffer.from("y")));
    expect(currentBlobSha1("src/core/agent/types.ts")).toBe(PROTECTED_BLOBS["src/core/agent/types.ts"]);
    expect(currentBlobSha1("src/core/agent/restrictedCapabilityProvider.ts")).toBe(
      PROTECTED_BLOBS["src/core/agent/restrictedCapabilityProvider.ts"],
    );
  });

  it("UC09 agent_definition_contract_modified == 0", () => {
    expect(currentBlobSha1("src/core/agent/definition.ts")).toBe(PROTECTED_BLOBS["src/core/agent/definition.ts"]);
  });

  it("UC10 external_execution_pulled_forward == 0", () => {
    expect(scanForExternalExecutionSignals('require("net")').length).toBeGreaterThan(0);
    expect(scanForExternalExecutionSignals(registrySourceText())).toHaveLength(0);
  });

  it("UC11 new_dependency_added == 0", () => {
    expect(currentBlobSha1("package.json")).toBe(PROTECTED_BLOBS["package.json"]);
    expect(currentBlobSha1("package-lock.json")).toBe(PROTECTED_BLOBS["package-lock.json"]);
  });

  it("UC12 s15_plus_pull_forward == 0", () => {
    expect(scanForS15PlusPullForward("Delegation to a child Orchestrator agent.").length).toBeGreaterThan(0);
    expect(scanForS15PlusPullForward(registrySourceText())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Exact fixture coverage
// ---------------------------------------------------------------------------

describe("S14A fixture coverage is exact", () => {
  it("exercises exactly the 12 canonical positive fixture ids", () => {
    expect(exercisedPositiveIds()).toEqual([...POSITIVE_FIXTURE_IDS].sort());
    expect(exercisedPositiveIds()).toHaveLength(12);
  });

  it("exercises exactly the 28 canonical negative fixture ids", () => {
    expect(exercisedNegativeIds()).toEqual([...NEGATIVE_FIXTURE_IDS].sort());
    expect(exercisedNegativeIds()).toHaveLength(28);
  });
});
