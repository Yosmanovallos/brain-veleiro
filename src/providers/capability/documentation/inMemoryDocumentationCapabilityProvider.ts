import type {
  CapabilityListRequest,
  CapabilityProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "../../../core/agent/index.js";
import { createHash } from "crypto";

const CAPABILITY_ID = "documentation.search";
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const PROVIDER_TIMEOUT_MS = 5000;

const LIMITS = {
  maxDocuments: 256,
  maxIdChars: 64,
  maxTitleBytes: 256,
  maxTextBytes: 65536,
  maxTotalTitleTextBytes: 4194304,
  maxLineBytes: 1024,
  maxQueryBytes: 256,
  maxUniqueTokens: 16,
  maxTokenBytes: 64,
  maxEnvelopeIdChars: 128,
  maxTimeoutMs: 60000,
  maxResultJsonBytes: 262144,
  safeErrorAsciiChars: 160,
  yieldScanInterval: 32,
} as const;

const ID_RE = /^[a-z][a-z0-9-]{0,63}$/;

const SAFE_ERROR_MESSAGES = {
  invalidConfig: "Invalid documentation search configuration.",
  invalidInput: "Invalid documentation search input.",
  notFound: "Unknown documentation search capability.",
  timeout: "Documentation search timed out.",
  executionFailed: "Documentation search output overflow.",
  internalError: "Documentation search internal error.",
} as const;

const STATIC_SECRET_MARKERS = [
  "-----BEGIN PRIVATE KEY-----",
  "-----BEGIN RSA PRIVATE KEY-----",
  "-----BEGIN OPENSSH PRIVATE KEY-----",
] as const;

const BEARER_RE = /\bBearer[ \t]+[A-Za-z0-9._~+/-]{16,}={0,2}/i;

interface InternalDocument {
  document_id: string;
  revision: string;
  title: string;
  text: string;
  lines: readonly string[];
  content_sha256: string;
}

const INPUT_SCHEMA: ToolDescriptor["input_schema"] = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: {
      type: "string",
      minLength: 1,
      maxLength: LIMITS.maxQueryBytes,
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_LIMIT,
    },
  },
};

const OUTPUT_SCHEMA: ToolDescriptor["output_schema"] = {
  type: "object",
  additionalProperties: false,
  required: ["corpus_id", "snapshot_id", "coverage", "total_matches", "truncated", "results"],
  properties: {
    corpus_id: { type: "string" },
    snapshot_id: { type: "string" },
    coverage: { enum: ["OFFLINE_SNAPSHOT"] },
    total_matches: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["document_id", "revision", "title", "excerpt", "line_start", "line_end", "content_sha256", "locator"],
        properties: {
          document_id: { type: "string" },
          revision: { type: "string" },
          title: { type: "string" },
          excerpt: { type: "string" },
          line_start: { type: "integer", minimum: 1 },
          line_end: { type: "integer", minimum: 1 },
          content_sha256: { type: "string" },
          locator: { type: "string" },
        },
      },
    },
  },
};

const DESCRIPTOR: ToolDescriptor = {
  capability_id: CAPABILITY_ID,
  name: "Documentation Search",
  description: "Searches an explicitly supplied offline documentation snapshot and returns literal excerpts with provenance.",
  input_schema: INPUT_SCHEMA,
  output_schema: OUTPUT_SCHEMA,
  side_effects: "NONE",
  timeout_ms: PROVIDER_TIMEOUT_MS,
};

function safeUtf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf-8");
}

function toSafeError(original: string): string {
  const ascii = original.replace(/[^\x20-\x7E]/g, "?");
  return ascii.length > LIMITS.safeErrorAsciiChars ? ascii.slice(0, LIMITS.safeErrorAsciiChars) : ascii;
}

function hasForbiddenTitleControls(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function hasForbiddenTextControls(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0x09 || code === 0x0a) continue;
    if (code < 0x20 || code === 0x7f) return true;
    const next = value.charCodeAt(i + 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (next < 0xdc00 || next > 0xdfff) return true;
    }
  }
  return false;
}

function hasLoneSurrogates(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const next = value.charCodeAt(i + 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (next < 0xdc00 || next > 0xdfff) return true;
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function normalizeCrlf(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sha256Lowercase(value: string): string {
  return createHash("sha256").update(value, "utf-8").digest("hex").toLowerCase();
}

function validateId(id: string, context: string): void {
  if (typeof id !== "string" || !ID_RE.test(id)) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
  }
  if (id.length > LIMITS.maxIdChars) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
  }
}

function checkSecretFloor(value: string): void {
  for (const marker of STATIC_SECRET_MARKERS) {
    if (value.includes(marker)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
  }
  if (BEARER_RE.test(value)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
}

function validateConfig(raw: unknown): { corpus_id: string; snapshot_id: string; documents: InternalDocument[] } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
  }

  const input = raw as Record<string, unknown>;
  const allowedKeys = new Set(["corpus_id", "snapshot_id", "documents"]);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
  }

  const corpus_id = input.corpus_id;
  const snapshot_id = input.snapshot_id;
  const documentsRaw = input.documents;

  if (typeof corpus_id !== "string" || typeof snapshot_id !== "string" || !Array.isArray(documentsRaw)) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
  }

  validateId(corpus_id, "corpus_id");
  validateId(snapshot_id, "snapshot_id");

  if (documentsRaw.length > LIMITS.maxDocuments) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
  }

  const documentIds = new Set<string>();
  const documents: InternalDocument[] = [];
  let totalTitleTextBytes = 0;

  for (const docRaw of documentsRaw) {
    if (docRaw === null || typeof docRaw !== "object" || Array.isArray(docRaw)) {
      throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    }
    const doc = docRaw as Record<string, unknown>;
    const docAllowedKeys = new Set(["document_id", "revision", "title", "text"]);
    for (const key of Object.keys(doc)) {
      if (!docAllowedKeys.has(key)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    }

    const document_id = doc.document_id;
    const revision = doc.revision;
    const titleRaw = doc.title;
    const textRaw = doc.text;

    if (typeof document_id !== "string" || typeof revision !== "string" || typeof titleRaw !== "string" || typeof textRaw !== "string") {
      throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    }

    validateId(document_id, "document_id");
    validateId(revision, "revision");

    if (documentIds.has(document_id)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    documentIds.add(document_id);

    if (safeUtf8ByteLength(titleRaw) < 1 || safeUtf8ByteLength(titleRaw) > LIMITS.maxTitleBytes) {
      throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    }
    if (!/\S/.test(titleRaw)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    if (hasForbiddenTitleControls(titleRaw)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    if (hasLoneSurrogates(titleRaw)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);

    if (hasLoneSurrogates(textRaw)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);

    const normalizedText = normalizeCrlf(textRaw);
    const normalizedTitle = titleRaw;

    if (hasForbiddenTextControls(normalizedText)) throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);

    if (safeUtf8ByteLength(normalizedText) < 1 || safeUtf8ByteLength(normalizedText) > LIMITS.maxTextBytes) {
      throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    }

    checkSecretFloor(normalizedTitle);
    checkSecretFloor(normalizedText);

    const titleBytes = safeUtf8ByteLength(normalizedTitle);
    const textBytes = safeUtf8ByteLength(normalizedText);
    totalTitleTextBytes += titleBytes + textBytes;
    if (totalTitleTextBytes > LIMITS.maxTotalTitleTextBytes) {
      throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
    }

    const lines = normalizedText.split("\n");
    for (const line of lines) {
      if (safeUtf8ByteLength(line) > LIMITS.maxLineBytes) {
        throw new Error(SAFE_ERROR_MESSAGES.invalidConfig);
      }
    }

    const content_sha256 = sha256Lowercase(normalizedText);

    documents.push({
      document_id,
      revision,
      title: normalizedTitle,
      text: normalizedText,
      lines,
      content_sha256,
    });
  }

  return { corpus_id, snapshot_id, documents };
}

function asciiFold(value: string): string {
  return value.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function validateQueryTokens(query: unknown): string[] {
  if (typeof query !== "string") throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  if (safeUtf8ByteLength(query) < 1 || safeUtf8ByteLength(query) > LIMITS.maxQueryBytes) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }
  if (hasLoneSurrogates(query)) throw new Error(SAFE_ERROR_MESSAGES.invalidInput);

  for (let i = 0; i < query.length; i++) {
    const code = query.charCodeAt(i);
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code < 0x20 || code === 0x7f) throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }

  const pieces = query.split(/[ \t\n\r]+/);
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const piece of pieces) {
    if (piece.length === 0) continue;
    const folded = asciiFold(piece);
    const tokenBytes = safeUtf8ByteLength(folded);
    if (tokenBytes < 1 || tokenBytes > LIMITS.maxTokenBytes) throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
    if (!seen.has(folded)) {
      seen.add(folded);
      tokens.push(folded);
    }
  }

  if (tokens.length < 1 || tokens.length > LIMITS.maxUniqueTokens) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }

  return tokens;
}

function validateLimit(raw: unknown): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (typeof raw !== "number" || !Number.isInteger(raw) || !Number.isFinite(raw)) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }
  if (raw < 1 || raw > MAX_LIMIT) throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  return raw;
}

function validateEnvelope(request: ToolInvocationRequest): void {
  if (typeof request.run_id !== "string" || typeof request.call_id !== "string") {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }
  if (request.run_id.length > LIMITS.maxEnvelopeIdChars || request.call_id.length > LIMITS.maxEnvelopeIdChars) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(request.run_id) || !/^[A-Za-z0-9._:-]+$/.test(request.call_id)) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }
  if (typeof request.turn !== "number" || !Number.isInteger(request.turn) || !Number.isFinite(request.turn) || request.turn < 0) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }
  if (typeof request.timeout_ms !== "number" || !Number.isInteger(request.timeout_ms) || !Number.isFinite(request.timeout_ms) || request.timeout_ms < 1 || request.timeout_ms > LIMITS.maxTimeoutMs) {
    throw new Error(SAFE_ERROR_MESSAGES.invalidInput);
  }
}

async function yieldControl(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

export class InMemoryDocumentationCapabilityProvider implements CapabilityProvider {
  private readonly corpus_id: string;
  private readonly snapshot_id: string;
  private readonly documents: readonly InternalDocument[];

  constructor(config: unknown) {
    const validated = validateConfig(config);
    this.corpus_id = validated.corpus_id;
    this.snapshot_id = validated.snapshot_id;
    this.documents = Object.freeze(validated.documents.map((d) => Object.freeze({ ...d })));
  }

  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return [JSON.parse(JSON.stringify(DESCRIPTOR)) as ToolDescriptor];
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const start = performance.now();
    const duration = () => Math.max(0, Math.floor(performance.now() - start));
    const budget = Math.min(request.timeout_ms, PROVIDER_TIMEOUT_MS);
    let lineCounter = 0;

    const checkDeadline = async (): Promise<void> => {
      if (duration() >= budget) throw new Error(SAFE_ERROR_MESSAGES.timeout);
    };

    const maybeYield = async (): Promise<void> => {
      lineCounter++;
      if (lineCounter % LIMITS.yieldScanInterval === 0) {
        await checkDeadline();
        await yieldControl();
      } else {
        await checkDeadline();
      }
    };

    try {
      if (request.capability_id !== CAPABILITY_ID) {
        return this.fail(request.call_id, "NOT_FOUND", SAFE_ERROR_MESSAGES.notFound, duration());
      }

      await checkDeadline();
      validateEnvelope(request);
      await checkDeadline();

      const input = request.input;
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return this.fail(request.call_id, "INVALID_INPUT", SAFE_ERROR_MESSAGES.invalidInput, duration());
      }

      const inputRecord = input as Record<string, unknown>;
      const inputAllowedKeys = new Set(["query", "limit"]);
      for (const key of Object.keys(inputRecord)) {
        if (!inputAllowedKeys.has(key)) {
          return this.fail(request.call_id, "INVALID_INPUT", SAFE_ERROR_MESSAGES.invalidInput, duration());
        }
      }

      let tokens: string[];
      let limit: number;
      try {
        tokens = validateQueryTokens(inputRecord.query as unknown);
        limit = validateLimit(inputRecord.limit);
      } catch {
        return this.fail(request.call_id, "INVALID_INPUT", SAFE_ERROR_MESSAGES.invalidInput, duration());
      }

      await checkDeadline();

      const matches: Array<{ document: InternalDocument; lineIndex: number }> = [];

      for (const document of this.documents) {
        await checkDeadline();
        const docTitleFolded = asciiFold(document.title);

        for (let i = 0; i < document.lines.length; i++) {
          await maybeYield();
          const lineFolded = asciiFold(document.lines[i]);
          const allTokensInTitleOrLine = tokens.every(
            (token) => docTitleFolded.includes(token) || lineFolded.includes(token)
          );
          if (allTokensInTitleOrLine) {
            matches.push({ document, lineIndex: i });
            break;
          }
        }
      }

      matches.sort((a, b) => (a.document.document_id < b.document.document_id ? -1 : 1));

      const totalMatches = matches.length;
      const selected = matches.slice(0, limit);
      const truncated = totalMatches > selected.length;

      const results = selected.map((m) => {
        const document = m.document;
        const lineNumber = m.lineIndex + 1;
        const excerpt = document.lines[m.lineIndex];
        const locator = `documentation://${this.corpus_id}/${this.snapshot_id}/${document.document_id}/${document.revision}#L${lineNumber}-L${lineNumber}`;
        return {
          document_id: document.document_id,
          revision: document.revision,
          title: document.title,
          excerpt,
          line_start: lineNumber,
          line_end: lineNumber,
          content_sha256: document.content_sha256,
          locator,
        };
      });

      const output: Record<string, unknown> = {
        corpus_id: this.corpus_id,
        snapshot_id: this.snapshot_id,
        coverage: "OFFLINE_SNAPSHOT",
        total_matches: totalMatches,
        truncated,
        results,
      };

      const outputJson = JSON.stringify(output);
      if (Buffer.byteLength(outputJson, "utf-8") > LIMITS.maxResultJsonBytes) {
        return this.fail(request.call_id, "EXECUTION_FAILED", SAFE_ERROR_MESSAGES.executionFailed, duration());
      }

      await checkDeadline();

      return {
        status: "SUCCESS",
        call_id: request.call_id,
        capability_id: CAPABILITY_ID,
        output,
        evidence_refs: results.map((r) => r.locator),
        duration_ms: duration(),
      };
    } catch (err) {
      const message = err instanceof Error ? toSafeError(err.message) : SAFE_ERROR_MESSAGES.internalError;
      if (message === SAFE_ERROR_MESSAGES.timeout || message.includes("timed out")) {
        return this.fail(request.call_id, "TIMEOUT", SAFE_ERROR_MESSAGES.timeout, duration(), true);
      }
      if (message === SAFE_ERROR_MESSAGES.invalidInput) {
        return this.fail(request.call_id, "INVALID_INPUT", SAFE_ERROR_MESSAGES.invalidInput, duration());
      }
      if (message === SAFE_ERROR_MESSAGES.invalidConfig) {
        return this.fail(request.call_id, "EXECUTION_FAILED", toSafeError("Invalid documentation search configuration."), duration());
      }
      if (message === SAFE_ERROR_MESSAGES.executionFailed) {
        return this.fail(request.call_id, "EXECUTION_FAILED", SAFE_ERROR_MESSAGES.executionFailed, duration());
      }
      return this.fail(request.call_id, "INTERNAL_ERROR", SAFE_ERROR_MESSAGES.internalError, duration());
    }
  }

  private fail(call_id: string, code: "NOT_FOUND" | "INVALID_INPUT" | "TIMEOUT" | "EXECUTION_FAILED" | "INTERNAL_ERROR", message: string, duration_ms: number, retryable = false): ToolInvocationResult {
    return {
      status: "FAIL",
      call_id,
      capability_id: CAPABILITY_ID,
      error: {
        code,
        message,
        retryable,
      },
      duration_ms,
    };
  }
}
