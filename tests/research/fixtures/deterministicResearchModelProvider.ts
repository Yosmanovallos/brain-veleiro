import type {
  ModelDecisionRequest,
  ModelDecisionResult,
  ModelProvider,
  ObservationMessage,
} from "../../../src/core/agent/index.js";
import { mapResearchResultToStructuredOutput } from "../../../src/intelligence/research/validateResearchResult.js";
import type { ResearchLookupOutput, ResearchResult } from "../../../src/intelligence/research/types.js";
import { RESEARCH_LOOKUP_CAPABILITY_ID } from "../../../src/intelligence/research/researchSkill.js";

/**
 * Deterministic, no-network research ModelProvider used only for S11
 * verification (RESEARCHER_AGENT_v1.md "Decision 3" — S11 does not require a
 * real external LLM for PASS).
 *
 * It is NOT a hardcoded final answer: on every turn it issues exactly the
 * next planned bounded `research.lookup` call, then once all planned lookups
 * have produced observations it calls `buildResult` with those *actual*
 * observations (not with the corpus directly) to construct the ResearchResult.
 * `buildResult` implementations read `.output.results` from each observation,
 * so a change to the underlying source corpus changes what the Researcher's
 * evidence/confidence/contradictions end up containing (proven by T23).
 *
 * A future conforming real ModelProvider can replace this fixture behind the
 * same ModelProvider contract without any Core change.
 */

export interface ResearchLookupStep {
  query: string;
  limit?: number;
}

export interface DeterministicResearchModelProviderConfig {
  steps: ResearchLookupStep[];
  buildResult: (observations: ObservationMessage[]) => ResearchResult;
}

function lookupOutputOf(observation: ObservationMessage): ResearchLookupOutput {
  return (observation.output ?? { results: [] }) as unknown as ResearchLookupOutput;
}

export class DeterministicResearchModelProvider implements ModelProvider {
  constructor(private readonly config: DeterministicResearchModelProviderConfig) {}

  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const completedLookups = request.state.prior_observations.length;

    if (completedLookups < this.config.steps.length) {
      const step = this.config.steps[completedLookups];
      return {
        status: "SUCCESS",
        decision: {
          type: "TOOL_CALL",
          rationale: `Executing planned bounded research.lookup step ${completedLookups + 1}/${this.config.steps.length}: "${step.query}".`,
          tool_call: {
            call_id: `s11-lookup-${completedLookups + 1}`,
            capability_id: RESEARCH_LOOKUP_CAPABILITY_ID,
            input: { query: step.query, ...(step.limit !== undefined ? { limit: step.limit } : {}) },
          },
        },
      };
    }

    const result = this.config.buildResult(request.state.prior_observations);

    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: "All planned bounded lookups completed; synthesizing the evidence-grounded ResearchResult.",
        output: mapResearchResultToStructuredOutput(result),
      },
    };
  }
}

export { lookupOutputOf };
