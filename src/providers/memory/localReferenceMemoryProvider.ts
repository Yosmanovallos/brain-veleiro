import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  MemoryProvider,
  MemoryRecord,
  MemoryStatus,
  RetrieveRequest,
  RetrieveResult,
  RememberCandidateRequest,
  RememberCandidateResult,
  CommitVerifiedMemoryRequest,
  CommitVerifiedMemoryResult,
  SearchHistoryRequest,
  SearchHistoryResult,
} from "../../core/memory/index.js";

/**
 * Reference implementation of Brain's MemoryProvider contract.
 *
 * Deterministic, local, credential-free. Backed internally by an embedded
 * relational store with a full-text index for historical search. This is
 * ONE replaceable implementation behind MemoryProvider — Brain Core never
 * imports this class or knows how it persists data.
 *
 * See brain-bootstrap/decisions/ADR-hermes-memory-role.md and
 * brain-bootstrap/decisions/ADR-runtime-foundation.md.
 */

const REJECTED_PROMOTION_STATUSES: ReadonlySet<MemoryStatus> = new Set([
  "ASSUMED",
  "PROPOSED",
  "UNKNOWN",
  "BLOCKED",
]);

const DEFAULT_MAX_RESULTS = 20;
const DEFAULT_SEARCH_LIMIT = 20;

export interface LocalReferenceMemoryProviderOptions {
  /** When false, the provider never opens or creates any local file. */
  enabled: boolean;
  /** Path to the local database file, or ":memory:" for an ephemeral store. */
  databasePath?: string;
}

interface CandidateRow {
  id: string;
  content: string;
  status: string;
  provenance: string | null;
  scope: string | null;
  created_at: string;
}

interface MemoryRow {
  id: string;
  content: string;
  status: string;
  provenance: string | null;
  created_at: string;
  revalidate_after: string | null;
}

interface HistoryRow {
  id: string;
  content: string;
  session_ref: string | null;
  created_at: string;
}

export class LocalReferenceMemoryProvider implements MemoryProvider {
  private readonly enabled: boolean;
  private db: InstanceType<typeof Database> | null = null;
  private unavailableReason: string | null = null;

  constructor(options: LocalReferenceMemoryProviderOptions) {
    this.enabled = options.enabled;
    if (!this.enabled) return;

    const db = new Database(options.databasePath ?? ":memory:");
    try {
      this.initializeSchema(db);
      this.db = db;
    } catch (error) {
      db.close();
      this.unavailableReason = `full-text search capability unavailable: ${(error as Error).message}`;
    }
  }

  /** True when the provider is enabled but its storage engine failed to initialize. */
  get isUnavailable(): boolean {
    return this.enabled && this.db === null;
  }

  /** Returns the reason all four methods must short-circuit, or null if usable. */
  private unavailability(): "DISABLED" | "UNAVAILABLE" | null {
    if (!this.enabled) return "DISABLED";
    if (!this.db) return "UNAVAILABLE";
    return null;
  }

  /** Reference-adapter-only helper (not part of the Brain Core contract). */
  static isFts5Available(): boolean {
    const probe = new Database(":memory:");
    try {
      probe.exec("CREATE VIRTUAL TABLE probe_fts USING fts5(content)");
      return true;
    } catch {
      return false;
    } finally {
      probe.close();
    }
  }

  /**
   * Reference-adapter-only helper for seeding historical session content.
   * Not part of the Brain Core MemoryProvider contract: history ingestion
   * is the responsibility of whatever session/transcript source feeds this
   * provider (e.g. a future SessionStore integration), not of Brain Core.
   */
  recordHistory(content: string, sessionRef?: string): void {
    if (!this.enabled || !this.db) return;
    const stmt = this.db.prepare(
      "INSERT INTO history_fts (id, content, session_ref, created_at) VALUES (?, ?, ?, ?)",
    );
    stmt.run(randomUUID(), content, sessionRef ?? null, new Date().toISOString());
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  async retrieve(request: RetrieveRequest): Promise<RetrieveResult> {
    const unavailable = this.unavailability();
    if (unavailable) {
      return { outcome: unavailable, availability: unavailable, records: [] };
    }
    const maxResults = request.maxResults ?? DEFAULT_MAX_RESULTS;
    const pattern = `%${request.query}%`;
    const rows = this.db!
      .prepare(
        "SELECT id, content, status, provenance, created_at, revalidate_after FROM memory WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
      )
      .all(pattern, maxResults) as MemoryRow[];

    const records = rows.map(toMemoryRecord);
    return {
      outcome: records.length > 0 ? "SUCCESS" : "EMPTY",
      availability: "AVAILABLE",
      records,
    };
  }

  async remember_candidate(
    request: RememberCandidateRequest,
  ): Promise<RememberCandidateResult> {
    const unavailable = this.unavailability();
    if (unavailable) {
      return { outcome: "NOT_PERSISTED", availability: unavailable };
    }
    const id = randomUUID();
    this.db!
      .prepare(
        "INSERT INTO candidates (id, content, status, provenance, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        request.content,
        request.status ?? "PROPOSED",
        request.provenance ?? null,
        request.scope ?? null,
        new Date().toISOString(),
      );
    return { outcome: "SUCCESS", availability: "AVAILABLE", candidateId: id };
  }

  async commit_verified_memory(
    request: CommitVerifiedMemoryRequest,
  ): Promise<CommitVerifiedMemoryResult> {
    const unavailable = this.unavailability();
    if (unavailable) {
      return { outcome: "NOT_PERSISTED", availability: unavailable };
    }

    if (REJECTED_PROMOTION_STATUSES.has(request.status)) {
      return {
        outcome: "INVALID_REQUEST",
        availability: "AVAILABLE",
        rejectedReason: `status '${request.status}' may not be durably promoted without new Evidence/authority`,
      };
    }

    if (request.status === "PROVIDED" && !request.provenance) {
      return {
        outcome: "INVALID_REQUEST",
        availability: "AVAILABLE",
        rejectedReason:
          "PROVIDED promotion requires an explicit provenance/authority reference",
      };
    }

    let content = request.content;
    if (request.candidateId) {
      const candidate = this.db!
        .prepare("SELECT id, content FROM candidates WHERE id = ?")
        .get(request.candidateId) as Pick<CandidateRow, "id" | "content"> | undefined;
      if (!candidate) {
        return {
          outcome: "INVALID_REQUEST",
          availability: "AVAILABLE",
          rejectedReason: `no candidate found for id '${request.candidateId}'`,
        };
      }
      content = candidate.content;
    }

    if (!content) {
      return {
        outcome: "INVALID_REQUEST",
        availability: "AVAILABLE",
        rejectedReason: "commit requires either a candidateId or explicit content",
      };
    }

    const id = randomUUID();
    this.db!
      .prepare(
        "INSERT INTO memory (id, content, status, provenance, created_at, revalidate_after) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, content, request.status, request.provenance, new Date().toISOString(), null);

    return { outcome: "SUCCESS", availability: "AVAILABLE", memoryId: id };
  }

  async search_history(request: SearchHistoryRequest): Promise<SearchHistoryResult> {
    const unavailable = this.unavailability();
    if (unavailable) {
      return { outcome: unavailable, availability: unavailable, records: [] };
    }
    const limit = Math.max(1, request.limit);
    const rows = this.db!
      .prepare(
        "SELECT id, content, session_ref, created_at FROM history_fts WHERE history_fts MATCH ? ORDER BY rank LIMIT ?",
      )
      .all(toFts5PhraseQuery(request.query), limit) as HistoryRow[];

    const records: MemoryRecord[] = rows.map((row) => ({
      id: row.id,
      content: row.content,
      status: "PROVIDED",
      provenance: row.session_ref ?? undefined,
      createdAt: row.created_at,
    }));

    return {
      outcome: records.length > 0 ? "SUCCESS" : "EMPTY",
      availability: "AVAILABLE",
      records,
    };
  }

  private initializeSchema(db: InstanceType<typeof Database>): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        provenance TEXT,
        scope TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        provenance TEXT,
        created_at TEXT NOT NULL,
        revalidate_after TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS history_fts USING fts5(
        id UNINDEXED,
        content,
        session_ref UNINDEXED,
        created_at UNINDEXED
      );
    `);
  }
}

function toMemoryRecord(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    content: row.content,
    status: row.status as MemoryStatus,
    provenance: row.provenance ?? undefined,
    createdAt: row.created_at,
    revalidateAfter: row.revalidate_after ?? undefined,
  };
}

/**
 * FTS5's MATCH syntax gives special meaning to characters such as '-' and ':'.
 * Treating the caller's query as a literal phrase (rather than an FTS5 query
 * expression) avoids syntax errors on ordinary free-text input.
 */
function toFts5PhraseQuery(query: string): string {
  return `"${query.replace(/"/g, '""')}"`;
}
