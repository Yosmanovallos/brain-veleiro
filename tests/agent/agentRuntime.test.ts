import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { runAgent } from "../../src/core/agent/index.js";
import type { AgentRunResult, CapabilityProvider, ModelProvider } from "../../src/core/agent/index.js";
import { DeterministicReferenceModelProvider } from "../../src/providers/model/deterministicReferenceModelProvider.js";
import { ReferenceCapabilityProvider } from "../../src/providers/capability/referenceCapabilityProvider.js";
import {
  ImmediateFinishModelProvider,
  NeverFinishModelProvider,
  DelayedModelProvider,
  FailingModelProvider,
  UnknownCapabilityModelProvider,
  FaultInjectingCapabilityProvider,
  AlternateCapabilityProvider,
} from "./fixtures.js";

const SAMPLE_TEXT = "the quick brown fox jumps"; // 5 words

async function runWordCountTask(
  modelProvider: ModelProvider,
  capabilityProvider: CapabilityProvider,
  overrides: Partial<Parameters<typeof runAgent>[0]> = {},
): Promise<AgentRunResult> {
  return runAgent({
    modelProvider,
    capabilityProvider,
    goal: "Count the words in this supplied text and return the result structurally.",
    initialWorkingState: { text: SAMPLE_TEXT },
    limits: { max_turns: 5, timeout_ms: 5000 },
    ...overrides,
  });
}

describe("T1 — full real-tool loop", () => {
  it("resolves Goal -> TOOL_CALL -> real Tool -> Observation -> FINISH -> SUCCESS", async () => {
    const result = await runWordCountTask(new DeterministicReferenceModelProvider(), new ReferenceCapabilityProvider());

    expect(result.outcome).toBe("SUCCESS");
    expect(result.output?.data?.word_count).toBe(5);

    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toEqual([
      "RUN_STARTED",
      "CONTEXT_ACCEPTED",
      "MODEL_REQUESTED",
      "MODEL_DECIDED",
      "TOOL_REQUESTED",
      "TOOL_COMPLETED",
      "STATE_UPDATED",
      "MODEL_REQUESTED",
      "MODEL_DECIDED",
      "RUN_SUCCEEDED",
    ]);
  });
});

describe("T2 — structured final output", () => {
  it("returns summary, structured data, termination, and an event log on success", async () => {
    const result = await runWordCountTask(new DeterministicReferenceModelProvider(), new ReferenceCapabilityProvider());
    expect(typeof result.output?.summary).toBe("string");
    expect(result.output?.summary.length).toBeGreaterThan(0);
    expect(result.output?.data).toBeDefined();
    expect(result.termination).toBeDefined();
    expect(result.events.length).toBeGreaterThan(0);
  });

  it("fails validation when the model finishes without a valid structured output", async () => {
    class InvalidOutputModelProvider implements ModelProvider {
      async decide() {
        return {
          status: "SUCCESS" as const,
          decision: {
            type: "FINISH" as const,
            rationale: "invalid output on purpose",
            output: {} as unknown as { summary: string },
          },
        };
      }
    }
    const result = await runWordCountTask(new InvalidOutputModelProvider(), new ReferenceCapabilityProvider());
    expect(result.outcome).toBe("FAIL");
    expect(result.termination.reason_code).toBe("INVALID_STRUCTURED_OUTPUT");
  });
});

describe("T3 — max-turns termination", () => {
  it("terminates FAIL/MAX_TURNS_EXCEEDED and requests no decision beyond the limit", async () => {
    const result = await runWordCountTask(new NeverFinishModelProvider(), new ReferenceCapabilityProvider(), {
      limits: { max_turns: 2, timeout_ms: 5000 },
    });
    expect(result.outcome).toBe("FAIL");
    expect(result.termination.reason_code).toBe("MAX_TURNS_EXCEEDED");
    const modelRequests = result.events.filter((e) => e.type === "MODEL_REQUESTED");
    expect(modelRequests.length).toBe(2);
  });
});

describe("T4 — timeout termination", () => {
  it("terminates FAIL/TIMEOUT_EXCEEDED when the deadline is exceeded", async () => {
    const delayed = new DelayedModelProvider(new DeterministicReferenceModelProvider(), 150);
    const result = await runWordCountTask(delayed, new ReferenceCapabilityProvider(), {
      limits: { max_turns: 5, timeout_ms: 30 },
    });
    expect(result.outcome).toBe("FAIL");
    expect(result.termination.reason_code).toBe("TIMEOUT_EXCEEDED");
    expect(result.events.some((e) => e.type === "RUN_TIMED_OUT")).toBe(true);
  });
});

describe("T5 — tool failure path", () => {
  it("does not crash, records TOOL_FAILED, and terminates FAIL/TOOL_ERROR", async () => {
    const result = await runWordCountTask(new DeterministicReferenceModelProvider(), new FaultInjectingCapabilityProvider());
    expect(result.outcome).toBe("FAIL");
    expect(result.termination.reason_code).toBe("TOOL_ERROR");
    expect(result.events.some((e) => e.type === "TOOL_FAILED")).toBe(true);
  });
});

describe("T6 — blocked capability path", () => {
  it("terminates BLOCKED/REQUIRED_CAPABILITY_MISSING for an unavailable capability", async () => {
    const result = await runWordCountTask(new UnknownCapabilityModelProvider(), new ReferenceCapabilityProvider());
    expect(result.outcome).toBe("BLOCKED");
    expect(result.termination.reason_code).toBe("REQUIRED_CAPABILITY_MISSING");
  });
});

describe("T7 — ModelProvider substitution", () => {
  async function exerciseLoop(modelProvider: ModelProvider): Promise<void> {
    const result = await runWordCountTask(modelProvider, new ReferenceCapabilityProvider());
    expect(result.outcome).toBe("SUCCESS");
    expect(result.output?.summary).toBeTruthy();
  }

  it("passes identically against the deterministic reference provider", async () => {
    await exerciseLoop(new DeterministicReferenceModelProvider());
  });

  it("passes identically against a fake alternate provider", async () => {
    await exerciseLoop(new ImmediateFinishModelProvider());
  });
});

describe("T8 — CapabilityProvider substitution", () => {
  async function exerciseLoop(capabilityProvider: CapabilityProvider): Promise<void> {
    const result = await runWordCountTask(new DeterministicReferenceModelProvider(), capabilityProvider);
    expect(result.outcome).toBe("SUCCESS");
  }

  it("passes identically against ReferenceCapabilityProvider (word_count)", async () => {
    await exerciseLoop(new ReferenceCapabilityProvider());
  });

  it("passes identically against AlternateCapabilityProvider (char_count)", async () => {
    await exerciseLoop(new AlternateCapabilityProvider());
  });
});

describe("T9 — no provider/vendor leakage into Brain Core", () => {
  it("contains no vendor-specific tokens under src/core/agent/", () => {
    const forbidden = [
      "openai",
      "anthropic",
      "gemini",
      "claude",
      "hermes",
      "notion",
      "better-sqlite3",
      "langgraph",
      "langchain",
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
            if (text.includes(token)) offenders.push(`${full}: contains "${token}"`);
          }
        }
      }
    }

    walk(coreDir);
    expect(offenders).toEqual([]);
  });
});

describe("T10 — event-log explainability", () => {
  it("reconstructs the full run from a monotonic event log with exactly one terminal event", async () => {
    const result = await runWordCountTask(new DeterministicReferenceModelProvider(), new ReferenceCapabilityProvider());

    const sequences = result.events.map((e) => e.sequence);
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i]).toBe(sequences[i - 1] + 1);
    }

    const terminalTypes = new Set(["RUN_SUCCEEDED", "RUN_FAILED", "RUN_BLOCKED", "RUN_TIMED_OUT", "RUN_MAX_TURNS"]);
    const terminalEvents = result.events.filter((e) => terminalTypes.has(e.type));
    expect(terminalEvents.length).toBe(1);

    const types = result.events.map((e) => e.type);
    expect(types).toContain("RUN_STARTED");
    expect(types).toContain("MODEL_REQUESTED");
    expect(types).toContain("MODEL_DECIDED");
    expect(types).toContain("TOOL_REQUESTED");
    expect(types).toContain("TOOL_COMPLETED");
    expect(types).toContain("STATE_UPDATED");
    expect(types[types.length - 1]).toBe("RUN_SUCCEEDED");
  });
});

describe("T11 — usage unavailable", () => {
  it("succeeds without fabricating zero usage when the provider reports none", async () => {
    const result = await runWordCountTask(new DeterministicReferenceModelProvider(), new ReferenceCapabilityProvider());
    expect(result.outcome).toBe("SUCCESS");
    expect(result.usage).toBeUndefined();
  });
});

describe("T12 — provider error normalization", () => {
  it("surfaces only a normalized error and terminates FAIL/MODEL_ERROR", async () => {
    const result = await runWordCountTask(new FailingModelProvider(), new ReferenceCapabilityProvider());
    expect(result.outcome).toBe("FAIL");
    expect(result.termination.reason_code).toBe("MODEL_ERROR");
    expect(result.termination.message).toContain("Simulated model provider failure");
  });
});
