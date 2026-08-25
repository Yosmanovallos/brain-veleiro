import { randomUUID } from "node:crypto";
import type {
  MemoryProvider,
  MemoryRecord,
  RetrieveRequest,
  RetrieveResult,
  RememberCandidateRequest,
  RememberCandidateResult,
  CommitVerifiedMemoryRequest,
  CommitVerifiedMemoryResult,
  SearchHistoryRequest,
  SearchHistoryResult,
} from "../src/core/memory/index.js";

/**
 * Minimal in-memory MemoryProvider used only to prove that Core-facing
 * behavior does not depend on LocalReferenceMemoryProvider (T8).
 * Test-only. Not a Brain artifact, not exported outside tests/.
 */
export class FakeMemoryProvider implements MemoryProvider {
  private readonly candidates = new Map<string, { content: string }>();
  private readonly memory: MemoryRecord[] = [];

  async retrieve(request: RetrieveRequest): Promise<RetrieveResult> {
    const records = this.memory.filter((r) => r.content.includes(request.query));
    return { outcome: records.length > 0 ? "SUCCESS" : "EMPTY", availability: "AVAILABLE", records };
  }

  async remember_candidate(request: RememberCandidateRequest): Promise<RememberCandidateResult> {
    const id = randomUUID();
    this.candidates.set(id, { content: request.content });
    return { outcome: "SUCCESS", availability: "AVAILABLE", candidateId: id };
  }

  async commit_verified_memory(
    request: CommitVerifiedMemoryRequest,
  ): Promise<CommitVerifiedMemoryResult> {
    if (["ASSUMED", "PROPOSED", "UNKNOWN", "BLOCKED"].includes(request.status)) {
      return { outcome: "INVALID_REQUEST", availability: "AVAILABLE", rejectedReason: "status not promotable" };
    }
    const content = request.candidateId
      ? this.candidates.get(request.candidateId)?.content
      : request.content;
    if (!content) {
      return { outcome: "INVALID_REQUEST", availability: "AVAILABLE", rejectedReason: "no content" };
    }
    const id = randomUUID();
    this.memory.push({
      id,
      content,
      status: request.status,
      provenance: request.provenance,
      createdAt: new Date().toISOString(),
    });
    return { outcome: "SUCCESS", availability: "AVAILABLE", memoryId: id };
  }

  async search_history(request: SearchHistoryRequest): Promise<SearchHistoryResult> {
    const records = this.memory.filter((r) => r.content.includes(request.query)).slice(0, request.limit);
    return { outcome: records.length > 0 ? "SUCCESS" : "EMPTY", availability: "AVAILABLE", records };
  }
}
