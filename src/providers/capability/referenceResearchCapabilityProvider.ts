import type {
  CapabilityListRequest,
  CapabilityProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "../../core/agent/index.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID, RESEARCH_LOOKUP_MAX_LIMIT } from "../../intelligence/research/researchSkill.js";
import type { ResearchLookupResultItem, ResearchSourceRecord } from "../../intelligence/research/types.js";

/**
 * Reference implementation of the S11 `research.lookup` capability.
 *
 * Defined in brain-bootstrap/skills/RESEARCH_SKILL_S11.md section 4 and
 * brain-bootstrap/specs/RESEARCHER_AGENT_v1.md "Decision 2". Performs a
 * real, bounded, read-only lookup over a deterministic local source corpus
 * supplied by the caller — it is not a Capability Registry, not MCP, and
 * not a web-search architecture. Different relevant queries can and do
 * produce different result sets (matching is corpus-driven, not canned).
 *
 * See brain-bootstrap/specs/AGENT_RUNTIME_LOOP_v1.md sections 5-8 for the
 * CapabilityProvider contract this implements.
 */

const RESEARCH_LOOKUP_DESCRIPTOR: ToolDescriptor = {
  capability_id: RESEARCH_LOOKUP_CAPABILITY_ID,
  name: "Research Lookup",
  description:
    "Performs a real, bounded, read-only lookup over a deterministic local evidence source corpus. " +
    "Returns at most 5 results per call.",
  input_schema: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
  },
  output_schema: {
    type: "object",
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          required: [
            "source_ref",
            "title",
            "source_type",
            "authority",
            "independence_group",
            "observed_or_published_at",
            "locator",
            "excerpt",
          ],
        },
      },
    },
  },
  side_effects: "NONE",
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class ReferenceResearchCapabilityProvider implements CapabilityProvider {
  constructor(private readonly corpus: ResearchSourceRecord[]) {}

  async list_capabilities(_request?: CapabilityListRequest): Promise<ToolDescriptor[]> {
    return [RESEARCH_LOOKUP_DESCRIPTOR];
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const start = Date.now();

    if (request.capability_id !== RESEARCH_LOOKUP_DESCRIPTOR.capability_id) {
      return {
        status: "FAIL",
        call_id: request.call_id,
        capability_id: request.capability_id,
        error: { code: "NOT_FOUND", message: `Unknown capability '${request.capability_id}'.`, retryable: false },
        duration_ms: Date.now() - start,
      };
    }

    const query = request.input.query;
    if (typeof query !== "string" || query.trim().length === 0) {
      return {
        status: "FAIL",
        call_id: request.call_id,
        capability_id: request.capability_id,
        error: { code: "INVALID_INPUT", message: "input.query must be a non-empty string.", retryable: false },
        duration_ms: Date.now() - start,
      };
    }

    const rawLimit = request.input.limit;
    let limit = RESEARCH_LOOKUP_MAX_LIMIT;
    if (rawLimit !== undefined) {
      if (typeof rawLimit !== "number" || !Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > RESEARCH_LOOKUP_MAX_LIMIT) {
        return {
          status: "FAIL",
          call_id: request.call_id,
          capability_id: request.capability_id,
          error: {
            code: "INVALID_INPUT",
            message: `input.limit must be an integer between 1 and ${RESEARCH_LOOKUP_MAX_LIMIT}.`,
            retryable: false,
          },
          duration_ms: Date.now() - start,
        };
      }
      limit = rawLimit;
    }

    const normalizedQuery = normalize(query);
    const matches = this.corpus.filter((record) =>
      record.topic_tags.some((tag) => normalizedQuery.includes(normalize(tag))),
    );

    const results: ResearchLookupResultItem[] = matches.slice(0, limit).map((record) => ({
      source_ref: record.source_ref,
      title: record.title,
      source_type: record.source_type,
      authority: record.authority,
      independence_group: record.independence_group,
      observed_or_published_at: record.observed_or_published_at,
      locator: record.locator,
      excerpt: record.excerpt,
    }));

    return {
      status: "SUCCESS",
      call_id: request.call_id,
      capability_id: request.capability_id,
      output: { results },
      duration_ms: Date.now() - start,
    };
  }
}
