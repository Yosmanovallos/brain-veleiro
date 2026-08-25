import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readdirSync, statSync } from "node:fs";
import { LocalReferenceMemoryProvider } from "../src/providers/memory/localReferenceMemoryProvider.js";
import { FakeMemoryProvider } from "./fakeMemoryProvider.js";
import type { MemoryProvider } from "../src/core/memory/index.js";

const tempDirs: string[] = [];

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "brain-memory-provider-test-"));
  tempDirs.push(dir);
  return join(dir, "memory.db");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("T1 — durable fact", () => {
  it("commits a VERIFIED candidate and returns it via retrieve()", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    const candidate = await provider.remember_candidate({
      content: "the project uses branch main",
      status: "VERIFIED",
    });
    expect(candidate.outcome).toBe("SUCCESS");
    expect(candidate.candidateId).toBeDefined();

    const commit = await provider.commit_verified_memory({
      candidateId: candidate.candidateId,
      status: "VERIFIED",
      provenance: "git branch --show-current",
    });
    expect(commit.outcome).toBe("SUCCESS");
    expect(commit.memoryId).toBeDefined();

    const result = await provider.retrieve({ query: "branch main" });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.records.some((r) => r.id === commit.memoryId)).toBe(true);
    provider.close();
  });
});

describe("T2 — fresh provider instance / persistence across processes", () => {
  it("retrieves a committed fact from a brand-new provider instance over the same database", async () => {
    const dbPath = tempDbPath();
    const first = new LocalReferenceMemoryProvider({ enabled: true, databasePath: dbPath });
    const candidate = await first.remember_candidate({
      content: "staging server needs port 2222",
      status: "VERIFIED",
    });
    await first.commit_verified_memory({
      candidateId: candidate.candidateId,
      status: "VERIFIED",
      provenance: "ops runbook",
    });
    first.close();

    const second = new LocalReferenceMemoryProvider({ enabled: true, databasePath: dbPath });
    const result = await second.retrieve({ query: "port 2222" });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.records.length).toBeGreaterThan(0);
    second.close();
  });
});

describe("T3 — cold history", () => {
  it("keeps historical content out of retrieve() but findable via search_history()", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    provider.recordHistory("we discussed the vector-db-vs-keyword-search tradeoff weeks ago", "session-42");

    const hot = await provider.retrieve({ query: "vector-db-vs-keyword-search" });
    expect(hot.records.length).toBe(0);

    const cold = await provider.search_history({ query: "vector-db-vs-keyword-search", limit: 10 });
    expect(cold.outcome).toBe("SUCCESS");
    expect(cold.records.length).toBeGreaterThan(0);
    provider.close();
  });
});

describe("T4 — candidate isolation", () => {
  it("does not expose a bare candidate as committed durable memory", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    await provider.remember_candidate({ content: "unverified guess about the deployment target", status: "PROPOSED" });

    const result = await provider.retrieve({ query: "unverified guess" });
    expect(result.records.length).toBe(0);
    provider.close();
  });
});

describe("T5 — promotion gate", () => {
  const rejectedStatuses = ["ASSUMED", "PROPOSED", "UNKNOWN", "BLOCKED"] as const;

  for (const status of rejectedStatuses) {
    it(`rejects durable promotion for status ${status}`, async () => {
      const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
      const result = await provider.commit_verified_memory({
        content: `some ${status} claim`,
        status,
        provenance: "test",
      });
      expect(result.outcome).toBe("INVALID_REQUEST");
      expect(result.rejectedReason).toBeTruthy();
      provider.close();
    });
  }

  it("rejects PROVIDED promotion without provenance/authority", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    const result = await provider.commit_verified_memory({
      content: "user said they prefer dark mode",
      status: "PROVIDED",
      provenance: "",
    });
    expect(result.outcome).toBe("INVALID_REQUEST");
    provider.close();
  });

  it("accepts PROVIDED promotion when an explicit authority/provenance is given", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    const result = await provider.commit_verified_memory({
      content: "user explicitly stated they prefer dark mode",
      status: "PROVIDED",
      provenance: "explicit user statement, session-7",
    });
    expect(result.outcome).toBe("SUCCESS");
    provider.close();
  });
});

describe("T6 — explicit VERIFIED promotion", () => {
  it("does not appear as durable memory until commit_verified_memory succeeds", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    const candidate = await provider.remember_candidate({
      content: "the API rate limit is 100 requests per minute",
      status: "PROPOSED",
    });

    const before = await provider.retrieve({ query: "rate limit is 100" });
    expect(before.records.length).toBe(0);

    const commit = await provider.commit_verified_memory({
      candidateId: candidate.candidateId,
      status: "VERIFIED",
      provenance: "official API docs",
    });
    expect(commit.outcome).toBe("SUCCESS");

    const after = await provider.retrieve({ query: "rate limit is 100" });
    expect(after.records.length).toBeGreaterThan(0);
    provider.close();
  });
});

describe("T7 — disabled provider", () => {
  it("never creates a database file and returns safe disabled results for all four methods", async () => {
    const dbPath = tempDbPath();
    rmSync(dbPath, { force: true });
    const provider = new LocalReferenceMemoryProvider({ enabled: false, databasePath: dbPath });

    const retrieve = await provider.retrieve({ query: "anything" });
    expect(retrieve.outcome).toBe("DISABLED");
    expect(retrieve.availability).toBe("DISABLED");
    expect(retrieve.records).toEqual([]);

    const candidate = await provider.remember_candidate({ content: "anything", status: "PROPOSED" });
    expect(candidate.outcome).toBe("NOT_PERSISTED");
    expect(candidate.availability).toBe("DISABLED");

    const commit = await provider.commit_verified_memory({ content: "anything", status: "VERIFIED", provenance: "x" });
    expect(commit.outcome).toBe("NOT_PERSISTED");
    expect(commit.availability).toBe("DISABLED");

    const history = await provider.search_history({ query: "anything", limit: 5 });
    expect(history.outcome).toBe("DISABLED");
    expect(history.records).toEqual([]);

    expect(existsSync(dbPath)).toBe(false);
    provider.close();
  });
});

describe("T8 — substitution boundary", () => {
  async function exerciseCoreBehavior(provider: MemoryProvider): Promise<void> {
    const candidate = await provider.remember_candidate({ content: "shared substitution fact", status: "VERIFIED" });
    expect(candidate.outcome).toBe("SUCCESS");
    const commit = await provider.commit_verified_memory({
      candidateId: candidate.candidateId,
      status: "VERIFIED",
      provenance: "substitution test",
    });
    expect(commit.outcome).toBe("SUCCESS");
    const result = await provider.retrieve({ query: "shared substitution fact" });
    expect(result.records.length).toBeGreaterThan(0);
  }

  it("passes identically against LocalReferenceMemoryProvider", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    await exerciseCoreBehavior(provider);
    provider.close();
  });

  it("passes identically against a fake in-memory MemoryProvider", async () => {
    const provider = new FakeMemoryProvider();
    await exerciseCoreBehavior(provider);
  });
});

describe("T9 — no storage leakage into Brain Core", () => {
  it("contains no storage-specific tokens under src/core/", () => {
    const forbidden = ["better-sqlite3", "sqlite", "fts5", "create table", "select ", "insert into"];
    const coreDir = join(process.cwd(), "src", "core");
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

describe("T10 — bounded search", () => {
  it("respects an explicit result limit", async () => {
    const provider = new LocalReferenceMemoryProvider({ enabled: true, databasePath: tempDbPath() });
    for (let i = 0; i < 5; i++) {
      provider.recordHistory(`bounded search fixture entry number ${i}`, `session-${i}`);
    }
    const result = await provider.search_history({ query: "bounded search fixture", limit: 2 });
    expect(result.records.length).toBeLessThanOrEqual(2);
    provider.close();
  });
});
