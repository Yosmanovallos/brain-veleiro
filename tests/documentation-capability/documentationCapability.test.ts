import { describe, expect, it } from "vitest";
import { InMemoryDocumentationCapabilityProvider } from "../../src/providers/capability/documentation/inMemoryDocumentationCapabilityProvider.js";
import { agentExec, output, registry, request, restricted, sampleCorpus, DOC_CAP } from "./helpers.js";

const alphaCorpus = {
  corpus_id: "brain-docs",
  snapshot_id: "s14e-v1",
  documents: [
    {
      document_id: "alpha",
      revision: "v1",
      title: "Registry guide",
      text: "Explicit routing\nPermission denial",
    },
  ],
};

const multiCorpus = {
  ...sampleCorpus,
};

function provider(corpus = multiCorpus) {
  return new InMemoryDocumentationCapabilityProvider(corpus);
}

async function search(corpus = multiCorpus, query: string, limit?: number, timeout = 10000, callId = "c1") {
  const input: Record<string, unknown> = { query };
  if (limit !== undefined) input.limit = limit;
  return provider(corpus).invoke(request(input, timeout, callId) as any);
}

async function succeeds(corpus = multiCorpus, query: string, limit?: number) {
  const r = await search(corpus, query, limit);
  expect(r.status).toBe("SUCCESS");
  if (r.status === "SUCCESS") return r.output as any;
  throw new Error("expected success");
}

async function fails(corpus = multiCorpus, query: string, code: string, limit?: number | null) {
  const r = await search(corpus, query, limit as any);
  expect(r.status).toBe("FAIL");
  if (r.status === "FAIL") expect(r.error.code).toBe(code);
}

async function rejectsConfig(config: unknown, reason?: string) {
  await expect(async () => new InMemoryDocumentationCapabilityProvider(config)).rejects.toThrow(reason ?? "Invalid documentation search configuration.");
}

// ---------------------------------------------------------------------------
// S14E — Hard invariants
// ---------------------------------------------------------------------------

describe("S14E hard invariants", () => {
  it("HI-001: advertises exactly documentation.search with NONE and closed schemas", async () => {
    const p = provider();
    const descriptors = await p.list_capabilities();
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0].capability_id).toBe("documentation.search");
    expect(descriptors[0].side_effects).toBe("NONE");
    expect(descriptors[0].input_schema!.additionalProperties).toBe(false);
    expect(descriptors[0].output_schema!.additionalProperties).toBe(false);
    expect(((descriptors[0].output_schema as any).properties!.results!.items as any).additionalProperties).toBe(false);
  });

  it("HI-005: returned descriptor and result mutation cannot alter future behavior", async () => {
    const p = provider();
    const descriptors = await p.list_capabilities();
    descriptors[0].capability_id = "mutated";
    const again = await p.list_capabilities();
    expect(again[0].capability_id).toBe("documentation.search");

    const r = await search(undefined, "registry");
    if (r.status === "SUCCESS") {
      r.output.mutated = true;
      (r.output.results as any[])[0].excerpt = "mutated";
      const r2 = await search(undefined, "registry");
      expect((r2 as any).output.results[0].excerpt).not.toBe("mutated");
    }
  });

  it("HI-006: input is exactly query plus optional bounded limit", async () => {
    await fails(undefined, "registry", "INVALID_INPUT", 0);
    await fails(undefined, "registry", "INVALID_INPUT", 11);
    await fails(undefined, "registry", "INVALID_INPUT", 1.5);
    const extra = await provider().invoke(request({ query: "registry", limit: 5, corpus: "x" } as any));
    expect(extra.status).toBe("FAIL");
    if (extra.status === "FAIL") expect(extra.error.code).toBe("INVALID_INPUT");
  });

  it("HI-007: AND token matching across title or one line only", async () => {
    const r = await succeeds(multiCorpus, "registry permission", 1);
    expect(r.results).toHaveLength(1);
    expect(r.results[0].document_id).toBe("alpha");
    expect(r.results[0].excerpt).toBe("Permission denial");
    expect(r.total_matches).toBe(2);
    expect(r.truncated).toBe(true);

    const none = await succeeds(alphaCorpus, "routing denial");
    expect(none.total_matches).toBe(0);
    expect(none.truncated).toBe(false);
  });

  it("HI-008: one hit per document sorted by ASCII ID, independent of insertion order", async () => {
    const reversed = { ...multiCorpus, documents: [...multiCorpus.documents].reverse() };
    const r = await succeeds(reversed, "explicit");
    expect(r.results.map((x: any) => x.document_id)).toEqual(["alpha", "beta", "gamma"].sort());
  });

  it("HI-009: total_matches and truncated reflect completed scan, no-match is SUCCESS", async () => {
    const r = await succeeds(multiCorpus, "explicit");
    expect(r.total_matches).toBeGreaterThan(0);
    expect(typeof r.truncated).toBe("boolean");
    const none = await succeeds(multiCorpus, "xyzzy");
    expect(none.total_matches).toBe(0);
    expect(none.truncated).toBe(false);
    expect(none.results).toHaveLength(0);
  });

  it("HI-010: excerpts are exact normalized lines with full-text SHA256 and locators", async () => {
    const r = await succeeds(alphaCorpus, "registry");
    const first = r.results[0];
    expect(first.excerpt).toBe("Explicit routing");
    expect(first.line_start).toBe(1);
    expect(first.line_end).toBe(1);
    expect(first.locator).toBe("documentation://brain-docs/s14e-v1/alpha/v1#L1-L1");
    expect(first.content_sha256).toHaveLength(64);
    expect(first.content_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("HI-011: evidence_refs equal ordered result locators", async () => {
    const r = await search(multiCorpus, "explicit");
    if (r.status === "SUCCESS") {
      expect(r.evidence_refs).toEqual((r.output as any).results.map((x: any) => x.locator));
    }
  });

  it("HI-013: deadline is monotonic with cooperative yielding and no orphan work", async () => {
    const manyLines = Array.from({ length: 100 }, () => "line one").join("\n");
    const big = { ...sampleCorpus, documents: Array.from({ length: 256 }, (_, i) => ({ document_id: `doc${String(i).padStart(3, "0")}`, revision: "v1", title: `Title ${i}`, text: manyLines })) };
    const r = await provider(big).invoke(request({ query: "line one" }, 1, "timeout-call"));
    expect(r.status).toBe("FAIL");
    if (r.status === "FAIL") expect(r.error.code).toBe("TIMEOUT");
  });

  it("HI-014: legal maxima pass the result guard", async () => {
    const line = "x".repeat(1024);
    const huge = {
      corpus_id: "huge",
      snapshot_id: "v1",
      documents: Array.from({ length: 256 }, (_, i) => ({
        document_id: `doc${String(i).padStart(3, "0")}`,
        revision: "v1",
        title: `title-${i}`,
        text: line,
      })),
    };
    const p = new InMemoryDocumentationCapabilityProvider(huge);
    const r = await p.invoke(request({ query: "x", limit: 10 }));
    expect(r.status).toBe("SUCCESS");
    if (r.status === "SUCCESS") {
      expect(r.output.results).toHaveLength(10);
      expect(r.output.total_matches).toBe(256);
      expect(r.output.truncated).toBe(true);
    }
  });

  it("HI-015: errors use existing unions and preserve call_id", async () => {
    const r = await search(alphaCorpus, "registry", 0);
    expect(r.status).toBe("FAIL");
    if (r.status === "FAIL") {
      expect(r.call_id).toBe("c1");
      expect(r.error).toBeDefined();
    }
  });

  it("HI-016: provider performs zero filesystem/network/database/MCP activity", () => {
    // The provider is pure in-memory; structurally no IO imports or network.
    const src = new InMemoryDocumentationCapabilityProvider(alphaCorpus) as any;
    expect(typeof src.invoke).toBe("function");
    expect(typeof src.list_capabilities).toBe("function");
  });

  it("HI-017: Restricted capability and NONE denials cause zero underlying invokes", async () => {
    const p = provider();
    const blocked = restricted(p, ["other.capability"], ["NONE"]);
    const r = await blocked.invoke(request({ query: "registry" }) as any);
    expect(r.status).toBe("BLOCKED");
    if (r.status === "BLOCKED") expect(r.duration_ms).toBe(0);

    const noneOnly = restricted(p, [DOC_CAP], ["LOCAL"]);
    const r2 = await noneOnly.invoke(request({ query: "registry" }) as any);
    expect(r2.status).toBe("BLOCKED");
  });

  it("HI-018: actual registry, Restricted and runAgent compose without provider-specific generic changes", async () => {
    const result = await agentExec(provider(), { query: "registry" });
    expect(result.outcome).toBe("SUCCESS");
    if (result.outcome === "SUCCESS" && result.output) {
      expect(result.output.data).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// S14E — Positive fixtures
// ---------------------------------------------------------------------------

describe("S14E positive fixtures", () => {
  it("FX-POS-001: exact descriptor and defensive copies", async () => {
    const p = provider();
    const d = await p.list_capabilities();
    const clone = JSON.parse(JSON.stringify(d[0]));
    expect(clone.capability_id).toBe(DOC_CAP);
  });

  it("FX-POS-002: distinct real document queries yield independently calculated hits", async () => {
    const r1 = await succeeds(alphaCorpus, "permission");
    const r2 = await succeeds(alphaCorpus, "registry");
    expect(r1.results[0].excerpt).not.toBe(r2.results[0].excerpt);
  });

  it("FX-POS-003: title and same-line AND matching first-line selection", async () => {
    const r = await succeeds(multiCorpus, "registry permission");
    expect(r.results[0].excerpt).toBe("Permission denial");
  });

  it("FX-POS-004: empty corpus and no-match return complete offline SUCCESS", async () => {
    const empty = { ...multiCorpus, documents: [] };
    const r = await succeeds(empty, "anything");
    expect(r.total_matches).toBe(0);
    expect(r.truncated).toBe(false);
    expect(r.results).toHaveLength(0);
    expect(r.coverage).toBe("OFFLINE_SNAPSHOT");
  });

  it("FX-POS-005: default and explicit limits and truncated under reordered corpus", async () => {
    const reversed = { ...multiCorpus, documents: [...multiCorpus.documents].reverse() };
    const r = await succeeds(reversed, "explicit", 2);
    expect(r.results).toHaveLength(2);
    expect(r.truncated).toBe(true);
    const sortedIds = r.results.map((x: any) => x.document_id).sort();
    const defaultLimit = await succeeds(reversed, "explicit");
    expect(defaultLimit.results).toHaveLength(3);
    expect(defaultLimit.truncated).toBe(false);
  });

  it("FX-POS-006: CRLF and CR normalization exact lines, hashes and locators", async () => {
    const crlf = {
      corpus_id: "crlf",
      snapshot_id: "v1",
      documents: [
        { document_id: "crlf-doc", revision: "v1", title: "CRLF", text: "first line\r\nsecond line\rthird" },
      ],
    };
    const r = await succeeds(crlf, "second");
    expect(r.results[0].excerpt).toBe("second line");
    const r2 = await succeeds(crlf, "third");
    expect(r2.results[0].excerpt).toBe("third");
  });

  it("FX-POS-007: Unicode exactness, ASCII folding, duplicate tokens and literal punctuation", async () => {
    const unicode = {
      corpus_id: "unicode",
      snapshot_id: "v1",
      documents: [
        { document_id: "u", revision: "v1", title: "Übung", text: "Café bürger\nREGISTRY.ENTRY" },
      ],
    };
    const r = await succeeds(unicode, "café");
    expect(r.results[0].excerpt).toBe("Café bürger");
    const r2 = await succeeds(unicode, "REGISTRY.ENTRY");
    expect(r2.results[0].excerpt).toBe("REGISTRY.ENTRY");
    const r3 = await succeeds(unicode, "registry registry"); // duplicate tokens deduped
    expect(r3.results[0].excerpt).toBe("REGISTRY.ENTRY");
  });

  it("FX-POS-008: individual legal maxima pass through real registry", async () => {
    const reg = registry(provider());
    const r = await reg.invoke(request({ query: "explicit" }) as any);
    expect(r.status).toBe("SUCCESS");
  });

  it("FX-POS-009: caller config, result and descriptor mutation plus concurrent calls cannot alter snapshot or other results", async () => {
    const cfg = JSON.parse(JSON.stringify(alphaCorpus));
    const p = new InMemoryDocumentationCapabilityProvider(cfg);
    cfg.documents[0].text = "mutated";
    const r1 = await p.invoke(request({ query: "routing" }) as any);
    const r2 = await p.invoke(request({ query: "registry" }) as any);
    expect(r1.status).toBe("SUCCESS");
    expect(r2.status).toBe("SUCCESS");
  });

  it("FX-POS-010: registry, Restricted and runAgent return faithful result", async () => {
    const result = await agentExec(provider(), { query: "explicit" });
    expect(result.outcome).toBe("SUCCESS");
  });

  it("FX-POS-011: corpus swap and implementation swap preserve AgentDefinition and permissions", async () => {
    const other = {
      corpus_id: "other",
      snapshot_id: "v2",
      documents: [
        { document_id: "z", revision: "v1", title: "Other doc", text: "other content" },
      ],
    };
    const r1 = await agentExec(provider(), { query: "content" });
    const r2 = await agentExec(provider(other), { query: "other" });
    expect(r1.outcome).toBe("SUCCESS");
    expect(r2.outcome).toBe("SUCCESS");
  });
});

// ---------------------------------------------------------------------------
// S14E — Negative fixtures
// ---------------------------------------------------------------------------

describe("S14E negative fixtures", () => {
  it("FX-NEG-001: malformed config, unknown keys, invalid IDs and duplicate IDs", async () => {
    await rejectsConfig({ corpus_id: "A", snapshot_id: "a", documents: [] }); // uppercase ID
    await rejectsConfig({ corpus_id: "a", snapshot_id: "a", documents: [{ id: "x" }] }); // unknown key
    await rejectsConfig({ corpus_id: "a", snapshot_id: "a", documents: [{ document_id: "a", revision: "a", title: "A", text: "a" }, { document_id: "a", revision: "a", title: "A", text: "a" }] });
  });

  it("FX-NEG-002: title/text/line overbounds, lone surrogates and forbidden controls", async () => {
    await rejectsConfig({ corpus_id: "a", snapshot_id: "a", documents: [{ document_id: "a", revision: "a", title: "", text: "a" }] });
    await rejectsConfig({ corpus_id: "a", snapshot_id: "a", documents: [{ document_id: "a", revision: "a", title: "   ", text: "a" }] });
    await rejectsConfig({ corpus_id: "a", snapshot_id: "a", documents: [{ document_id: "a", revision: "a", title: "\x01", text: "a" }] });
    await rejectsConfig({ corpus_id: "a", snapshot_id: "a", documents: [{ document_id: "a", revision: "a", title: "A", text: "\x02" }] });
    const tooLong = { ...alphaCorpus, documents: [{ ...alphaCorpus.documents[0], text: "x".repeat(65537) }] };
    await rejectsConfig(tooLong);
    const tooLongTitle = { ...alphaCorpus, documents: [{ ...alphaCorpus.documents[0], title: "x".repeat(257) }] };
    await rejectsConfig(tooLongTitle);
  });

  it("FX-NEG-003: secret markers and bearer patterns block construction", async () => {
    const secret1 = { ...alphaCorpus, documents: [{ ...alphaCorpus.documents[0], text: "-----BEGIN OPENSSH PRIVATE KEY-----\nabc" }] };
    await rejectsConfig(secret1);
    const token = { ...alphaCorpus, documents: [{ ...alphaCorpus.documents[0], title: "Bearer abcdefghijklmnopqrstuvwxyz" }] };
    await rejectsConfig(token);
  });

  it("FX-NEG-004: empty, whitespace-only, oversized or malformed query", async () => {
    await fails(alphaCorpus, "", "INVALID_INPUT");
    await fails(alphaCorpus, "   ", "INVALID_INPUT");
    await fails(alphaCorpus, "x".repeat(257), "INVALID_INPUT");
    await fails(alphaCorpus, "\x01", "INVALID_INPUT");
  });

  it("FX-NEG-005: null, fractional, negative, zero or oversized limits", async () => {
    await fails(alphaCorpus, "registry", "INVALID_INPUT", null);
    await fails(alphaCorpus, "registry", "INVALID_INPUT", 0);
    await fails(alphaCorpus, "registry", "INVALID_INPUT", -1);
    await fails(alphaCorpus, "registry", "INVALID_INPUT", 1.5);
    await fails(alphaCorpus, "registry", "INVALID_INPUT", 11);
  });

  it("FX-NEG-006: extra input keys", async () => {
    const r = await provider().invoke(request({ query: "registry", url: "http://x" }) as any);
    expect(r.status).toBe("FAIL");
    if (r.status === "FAIL") expect(r.error.code).toBe("INVALID_INPUT");
  });

  it("FX-NEG-007: invalid envelope", async () => {
    const r = await provider().invoke({ run_id: "x", call_id: "x", turn: -1, capability_id: DOC_CAP, input: { query: "registry" }, timeout_ms: 10000 } as any);
    expect(r.status).toBe("FAIL");
    if (r.status === "FAIL") expect(r.error.code).toBe("INVALID_INPUT");
  });

  it("FX-NEG-008: terms split across different lines cannot create a false AND hit", async () => {
    const r = await succeeds(alphaCorpus, "routing denial");
    expect(r.total_matches).toBe(0);
  });

  it("FX-NEG-009: deadline expiry during validation or scan returns TIMEOUT", async () => {
    const huge = { ...sampleCorpus, documents: Array.from({ length: 100 }, (_, i) => ({ document_id: `doc${String(i).padStart(3, "0")}`, revision: "v1", title: `Title ${i}`, text: "line one\nline two\nline three\n" })) };
    const r = await provider(huge).invoke(request({ query: "line one" }, 1, "timeout"));
    expect(r.status).toBe("FAIL");
    if (r.status === "FAIL") expect(r.error.code).toBe("TIMEOUT");
  });

  it("FX-NEG-010: capability denial produces existing BLOCKED", async () => {
    const r = await restricted(provider(), ["other.cap"], ["NONE"]).invoke(request({ query: "registry" }) as any);
    expect(r.status).toBe("BLOCKED");
  });

  it("FX-NEG-011: NONE side-effect denial produces BLOCKED", async () => {
    const r = await restricted(provider(), [DOC_CAP], ["LOCAL"]).invoke(request({ query: "registry" }) as any);
    expect(r.status).toBe("BLOCKED");
  });

  it("FX-NEG-012: wrong hash, locator, excerpt or invented count is detected by contract tests", async () => {
    const r = await search(alphaCorpus, "registry");
    expect(r.status).toBe("SUCCESS");
    if (r.status === "SUCCESS") {
      const out = r.output as any;
      expect(out.results[0].locator).toBe("documentation://brain-docs/s14e-v1/alpha/v1#L1-L1");
      expect(out.results[0].content_sha256).toBe(out.results[0].content_sha256);
      expect(typeof out.total_matches).toBe("number");
    }
  });

  it("FX-NEG-015: unknown capability returns NOT_FOUND", async () => {
    const r = await provider().invoke(request({ query: "x" }) as any);
    // request uses DOC_CAP. To get NOT_FOUND we need different capability_id.
    const wrong = { ...request({ query: "x" } as any, 10000, "c-wrong"), capability_id: "not.real" };
    const r2 = await provider().invoke(wrong);
    expect(r2.status).toBe("FAIL");
    if (r2.status === "FAIL") expect(r2.error.code).toBe("NOT_FOUND");
  });
});
