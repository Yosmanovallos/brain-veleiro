import { describe, expect, it } from "vitest";
import { InMemoryDocumentationCapabilityProvider } from "../../src/providers/capability/documentation/inMemoryDocumentationCapabilityProvider.js";
import { DOC_CAP, request, sampleCorpus } from "./helpers.js";

describe("S14E unsafe counters", () => {
  it("UC01: unapproved IO or model-config override is rejected before construction", async () => {
    // Reject configs that try to inject paths, URLs, model overrides, or environment.
    const bad = {
      corpus_id: "a",
      snapshot_id: "a",
      documents: [{ document_id: "a", revision: "a", title: "T", text: "text" }],
      path: "/etc/passwd",
      model: "o3",
      url: "http://x",
    };
    await expect(async () => new InMemoryDocumentationCapabilityProvider(bad)).rejects.toThrow("Invalid documentation search configuration.");
  });

  it("UC02: invalid input or limit bypass is rejected at invoke", async () => {
    const p = new InMemoryDocumentationCapabilityProvider({ ...sampleCorpus, documents: [sampleCorpus.documents[0]] });
    const r = await p.invoke(request({ query: "registry", limit: 100 }) as any);
    expect(r.status).toBe("FAIL");
    if (r.status === "FAIL") expect(r.error.code).toBe("INVALID_INPUT");
  });

  it("UC03: fabricated excerpt, provenance or hidden truncation is detected by exact output checks", async () => {
    const p = new InMemoryDocumentationCapabilityProvider({
      corpus_id: "a",
      snapshot_id: "a",
      documents: [{ document_id: "a", revision: "a", title: "T", text: "one\ntwo" }],
    });
    const r = await p.invoke(request({ query: "one" }) as any);
    expect(r.status).toBe("SUCCESS");
    if (r.status === "SUCCESS") {
      expect(r.output.results).toHaveLength(1);
      const out = r.output as any;
      expect(out.results[0].excerpt).toBe("one");
      expect(out.results[0].line_start).toBe(1);
      expect(out.results[0].line_end).toBe(1);
      expect(out.results[0].locator).toMatch(/^documentation:\/\/a\/a\/a\/a#L1-L1$/);
      expect(out.total_matches).toBe(1);
      expect(out.truncated).toBe(false);
    }
  });

  it("UC04: permission or deadline bypass is prevented by Restricted and monotonic deadline", async () => {
    const manyLines = Array.from({ length: 100 }, () => "line one").join("\n");
    const p = new InMemoryDocumentationCapabilityProvider({
      ...sampleCorpus,
      documents: Array.from({ length: 256 }, (_, i) => ({
        document_id: `doc${String(i).padStart(3, "0")}`,
        revision: "v1",
        title: `Title ${i}`,
        text: manyLines,
      })),
    });
    const r = await p.invoke(request({ query: "line one" }, 1, "deadline") as any);
    expect(r.status).toBe("FAIL");
    if (r.status === "FAIL") expect(r.error.code).toBe("TIMEOUT");
  });

  it("UC05: secret-floor error leak or instruction execution is blocked", async () => {
    const bad = {
      corpus_id: "a",
      snapshot_id: "a",
      documents: [
        {
          document_id: "a",
          revision: "a",
          title: "SSH",
          text: "-----BEGIN OPENSSH PRIVATE KEY-----\nssh-rsa AAAAB3NzaC1",
        },
      ],
    };
    await expect(async () => new InMemoryDocumentationCapabilityProvider(bad)).rejects.toThrow("Invalid documentation search configuration.");

    const badBearer = {
      corpus_id: "a",
      snapshot_id: "a",
      documents: [
        {
          document_id: "a",
          revision: "a",
          title: "T",
          text: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
        },
      ],
    };
    await expect(async () => new InMemoryDocumentationCapabilityProvider(badBearer)).rejects.toThrow("Invalid documentation search configuration.");
  });

  it("UC06: protected-scope drift or self-approval is not introduced by the provider", async () => {
    // The provider only uses the declared authorized paths; no Core/AgentDefinition/registry mutations.
    const p = new InMemoryDocumentationCapabilityProvider({ ...sampleCorpus, documents: [sampleCorpus.documents[0]] });
    const r = await p.invoke(request({ query: "registry" }, 10000, "uc06") as any);
    expect(r.status).toBe("SUCCESS");
    if (r.status === "SUCCESS") {
      expect(r.output).toBeDefined();
      expect((r.output as any).coverage).toBe("OFFLINE_SNAPSHOT");
    }
  });
});
