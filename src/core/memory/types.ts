/**
 * Brain Core — MemoryProvider contract.
 *
 * Provider-neutral. Must never reference a concrete storage technology,
 * query language, schema, or file path. See brain-bootstrap/specs/MEMORY_PROVIDER.md.
 */

/** Canonical Brain epistemic/operational status vocabulary (S04). */
export type MemoryStatus =
  | "VERIFIED"
  | "PROVIDED"
  | "ASSUMED"
  | "PROPOSED"
  | "UNKNOWN"
  | "BLOCKED";

/** Provider availability model (MEMORY_PROVIDER.md section 4). */
export type ProviderAvailability =
  | "AVAILABLE"
  | "DISABLED"
  | "UNAVAILABLE"
  | "DEGRADED";

/** Minimum conceptual operation outcomes (MEMORY_PROVIDER.md section 15). */
export type OperationOutcome =
  | "SUCCESS"
  | "EMPTY"
  | "NOT_PERSISTED"
  | "DISABLED"
  | "UNAVAILABLE"
  | "DEGRADED"
  | "INVALID_REQUEST";

/** One normalized Memory item returned by retrieve() or search_history(). */
export interface MemoryRecord {
  id: string;
  content: string;
  status: MemoryStatus;
  provenance?: string;
  createdAt: string;
  revalidateAfter?: string;
}

export interface RetrieveRequest {
  query: string;
  scope?: string;
  maxResults?: number;
}

export interface RetrieveResult {
  outcome: OperationOutcome;
  availability: ProviderAvailability;
  records: MemoryRecord[];
}

export interface RememberCandidateRequest {
  content: string;
  status?: MemoryStatus;
  provenance?: string;
  scope?: string;
}

export interface RememberCandidateResult {
  outcome: OperationOutcome;
  availability: ProviderAvailability;
  candidateId?: string;
}

export interface CommitVerifiedMemoryRequest {
  candidateId?: string;
  content?: string;
  status: MemoryStatus;
  provenance: string;
}

export interface CommitVerifiedMemoryResult {
  outcome: OperationOutcome;
  availability: ProviderAvailability;
  memoryId?: string;
  rejectedReason?: string;
}

export interface SearchHistoryRequest {
  query: string;
  limit: number;
}

export interface SearchHistoryResult {
  outcome: OperationOutcome;
  availability: ProviderAvailability;
  records: MemoryRecord[];
}

/**
 * The replaceable boundary through which Brain Core persists and retrieves
 * experience-derived Memory. Method names are mandatory and must not be renamed.
 */
export interface MemoryProvider {
  retrieve(request: RetrieveRequest): Promise<RetrieveResult>;
  remember_candidate(
    request: RememberCandidateRequest,
  ): Promise<RememberCandidateResult>;
  commit_verified_memory(
    request: CommitVerifiedMemoryRequest,
  ): Promise<CommitVerifiedMemoryResult>;
  search_history(request: SearchHistoryRequest): Promise<SearchHistoryResult>;
}
