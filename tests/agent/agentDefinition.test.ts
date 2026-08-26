import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  runAgent,
  validateAgentDefinition,
  compileAgentDefinition,
  RestrictedCapabilityProvider,
} from "../../src/core/agent/index.js";
import type { AgentDefinition } from "../../src/core/agent/index.js";
import {
  referenceResearcher,
  referenceBuilder,
  referenceVerifier,
} from "../../src/intelligence/agent-definitions/referenceDefinitions.js";
import { DeterministicReferenceModelProvider } from "../../src/providers/model/deterministicReferenceModelProvider.js";
import { ReferenceCapabilityProvider } from "../../src/providers/capability/referenceCapabilityProvider.js";
import { MultiCapabilityProvider } from "./fixtures.js";

const SAMPLE_TEXT = "the quick brown fox jumps"; // 5 words

function clone(definition: AgentDefinition): AgentDefinition {
  return structuredClone(definition);
}

describe("T1 — valid AgentDefinition accepted", () => {
  it("validateAgentDefinition passes for a complete valid definition", () => {
    const result = validateAgentDefinition(referenceBuilder);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("T2 — researcher definition validates", () => {
  it("passes canonical schema validation", () => {
    expect(validateAgentDefinition(referenceResearcher).valid).toBe(true);
  });
});

describe("T3 — builder definition validates", () => {
  it("passes canonical schema validation", () => {
    expect(validateAgentDefinition(referenceBuilder).valid).toBe(true);
  });
});

describe("T4 — verifier definition validates", () => {
  it("passes canonical schema validation", () => {
    expect(validateAgentDefinition(referenceVerifier).valid).toBe(true);
  });
});

describe("T5 — incomplete/malformed definition rejected", () => {
  it("rejects a definition missing objective", () => {
    const broken = clone(referenceBuilder);
    broken.objective = "";
    const result = validateAgentDefinition(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("objective"))).toBe(true);
  });

  it("rejects a definition with limits.max_turns = 0, before runAgent() would execute", () => {
    const broken = clone(referenceBuilder);
    broken.limits.max_turns = 0;
    expect(validateAgentDefinition(broken).valid).toBe(false);
    expect(() =>
      compileAgentDefinition(broken, {
        model_provider: new DeterministicReferenceModelProvider(),
        capability_provider: new ReferenceCapabilityProvider(),
      }),
    ).toThrow();
  });
});

describe("T6 — tools/capabilities invariant enforced", () => {
  it("rejects mismatched tools and capabilities sets", () => {
    const broken = clone(referenceBuilder);
    broken.tools = ["word_count"];
    broken.capabilities = ["different_capability"];
    const result = validateAgentDefinition(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("tools and capabilities"))).toBe(true);
  });
});

describe("T7 — capability list is restricted", () => {
  it("exposes only the allowed capability from a provider offering more", async () => {
    const provider = new MultiCapabilityProvider([
      { capability_id: "allowed_capability", name: "Allowed", description: "", input_schema: {}, side_effects: "NONE" },
      { capability_id: "forbidden_capability", name: "Forbidden", description: "", input_schema: {}, side_effects: "NONE" },
    ]);
    const restricted = new RestrictedCapabilityProvider(provider, new Set(["allowed_capability"]), new Set(["NONE"]));
    const visible = await restricted.list_capabilities();
    expect(visible.map((d) => d.capability_id)).toEqual(["allowed_capability"]);
  });
});

describe("T8 — forbidden capability invocation rejected", () => {
  it("rejects an invocation for a capability outside the allowlist before delegating", async () => {
    const provider = new MultiCapabilityProvider([
      { capability_id: "allowed_capability", name: "Allowed", description: "", input_schema: {}, side_effects: "NONE" },
      { capability_id: "forbidden_capability", name: "Forbidden", description: "", input_schema: {}, side_effects: "NONE" },
    ]);
    const restricted = new RestrictedCapabilityProvider(provider, new Set(["allowed_capability"]), new Set(["NONE"]));
    const result = await restricted.invoke({
      run_id: "test-run",
      turn: 1,
      call_id: "call-1",
      capability_id: "forbidden_capability",
      input: {},
      timeout_ms: 1000,
    });
    expect(result.status).toBe("BLOCKED");
  });
});

describe("T9 — side-effect permission enforced", () => {
  it("does not expose or allow invoking a capability whose side-effect class is not permitted", async () => {
    const provider = new MultiCapabilityProvider([
      { capability_id: "external_capability", name: "External", description: "", input_schema: {}, side_effects: "EXTERNAL" },
    ]);
    const restricted = new RestrictedCapabilityProvider(provider, new Set(["external_capability"]), new Set(["NONE"]));

    const visible = await restricted.list_capabilities();
    expect(visible).toEqual([]);

    const result = await restricted.invoke({
      run_id: "test-run",
      turn: 1,
      call_id: "call-1",
      capability_id: "external_capability",
      input: {},
      timeout_ms: 1000,
    });
    expect(result.status).toBe("BLOCKED");
  });
});

describe("T10 — AgentDefinition limits map to S09 without a parallel implementation", () => {
  it("passes limits through unchanged into RunAgentOptions", () => {
    const definition = clone(referenceBuilder);
    definition.limits = { max_turns: 3, timeout_ms: 1234 };
    const compiled = compileAgentDefinition(definition, {
      model_provider: new DeterministicReferenceModelProvider(),
      capability_provider: new ReferenceCapabilityProvider(),
    });
    expect(compiled.run_options.limits).toEqual({ max_turns: 3, timeout_ms: 1234 });
  });
});

describe("T11 — all roles execute through identical compiler/runtime path", () => {
  it("compiles and runs researcher, builder, and verifier through the same functions", async () => {
    const definitions = [referenceResearcher, referenceBuilder, referenceVerifier];
    const dependencies = {
      model_provider: new DeterministicReferenceModelProvider(),
      capability_provider: new ReferenceCapabilityProvider(),
    };

    for (const definition of definitions) {
      const compiled = compileAgentDefinition(definition, dependencies);
      const result = await runAgent({ ...compiled.run_options, initialWorkingState: { text: SAMPLE_TEXT } });
      expect(result.outcome).toBe("SUCCESS");
      expect(result.output?.data?.word_count).toBe(5);
    }
  });
});

describe("T12 — Core contains no role-conditional branching", () => {
  it("finds no researcher/builder/verifier branching in src/core/agent/", () => {
    const forbidden = [
      'role === "researcher"',
      "role === 'researcher'",
      'role === "builder"',
      "role === 'builder'",
      'role === "verifier"',
      "role === 'verifier'",
      "runresearcher(",
      "runbuilder(",
      "runverifier(",
    ];
    const coreDir = join(process.cwd(), "src", "core", "agent");
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8").toLowerCase();
          for (const token of forbidden) {
            if (text.includes(token.toLowerCase())) offenders.push(`${full}: contains "${token}"`);
          }
        }
      }
    }

    walk(coreDir);
    expect(offenders).toEqual([]);
  });
});

describe("T13 — delegation remains disabled", () => {
  it("rejects a definition attempting to enable delegation", () => {
    const broken = clone(referenceBuilder);
    (broken.delegation as unknown as { allowed: boolean }).allowed = true;
    const result = validateAgentDefinition(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("delegation"))).toBe(true);
  });
});

describe("T14 — provider neutrality", () => {
  it("contains no concrete provider implementation name in any reference AgentDefinition's configuration values", () => {
    const forbidden = [
      "openai",
      "anthropic",
      "gemini",
      "hermes",
      "notion",
      "better-sqlite3",
      "localreferencememoryprovider",
      "deterministicreferencemodelprovider",
      "referencecapabilityprovider",
      "langgraph",
      "langchain",
    ];

    function collectStrings(value: unknown, acc: string[]): void {
      if (typeof value === "string") {
        acc.push(value);
      } else if (Array.isArray(value)) {
        for (const item of value) collectStrings(item, acc);
      } else if (value && typeof value === "object") {
        for (const v of Object.values(value)) collectStrings(v, acc);
      }
    }

    const strings: string[] = [];
    for (const definition of [referenceResearcher, referenceBuilder, referenceVerifier]) {
      collectStrings(definition, strings);
    }

    const offenders = strings.filter((s) => forbidden.some((token) => s.toLowerCase().includes(token)));
    expect(offenders).toEqual([]);
  });
});
