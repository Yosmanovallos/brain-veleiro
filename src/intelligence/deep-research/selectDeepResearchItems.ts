import type { CurrentGapClosureState, DecisionImpact } from "../knowledge-gap-analysis/types.js";
import type { DeepResearchInput } from "./types.js";

/**
 * S13C bounded queue selection.
 *
 * Implements brain-bootstrap/specs/DEEP_RESEARCH_AGENT_v1.md section 6
 * (Queue selection) and the Skill's DR-P1/DR-P2 procedure steps. This is
 * deliberately a plain deterministic function, not model judgment: which
 * items are eligible and how many are selected is a mechanical property of
 * the S13B `KnowledgeGapAnalysisResult` structure, never something an LLM
 * needs to decide. It is used both to fail fast before a task is
 * materialized (../materializeDeepResearchTask.js) and directly by tests
 * (T10/T11/T12) independent of the full Agent runtime.
 *
 * S13B already owns `research_queue` priority (DR-R14) — this function never
 * re-ranks; it only validates and slices.
 */

export interface SelectedDeepResearchItem {
  knowledge_item_id: string;
  research_question: string;
  decision_impact: DecisionImpact;
  blocking: boolean;
  upstream_epistemic_status: "NEEDS_RESEARCH";
  upstream_closure_state: CurrentGapClosureState;
}

export interface DeepResearchQueueSelection {
  queue_snapshot: string[];
  selected: SelectedDeepResearchItem[];
  selected_item_ids: string[];
  deferred_item_ids: string[];
}

const MIN_MAX_RESEARCH_ITEMS = 1;
const MAX_MAX_RESEARCH_ITEMS = 3;
const DEFAULT_MAX_RESEARCH_ITEMS = 1;

export function selectDeepResearchItems(input: DeepResearchInput): DeepResearchQueueSelection {
  const kga = input?.knowledge_gap_analysis;
  if (!kga || !Array.isArray(kga.research_queue) || !Array.isArray(kga.items) || !kga.handoff) {
    throw new Error("selectDeepResearchItems requires a valid KnowledgeGapAnalysisResult (research_queue, items, handoff).");
  }

  const maxItems = input.max_research_items ?? DEFAULT_MAX_RESEARCH_ITEMS;
  if (!Number.isInteger(maxItems) || maxItems < MIN_MAX_RESEARCH_ITEMS || maxItems > MAX_MAX_RESEARCH_ITEMS) {
    throw new Error(
      `max_research_items must be an integer between ${MIN_MAX_RESEARCH_ITEMS} and ${MAX_MAX_RESEARCH_ITEMS}, got ${String(maxItems)}.`,
    );
  }

  const queue_snapshot = kga.research_queue.map((r) => r.knowledge_item_id);
  const unknowableIds = new Set(kga.handoff.unknowable_item_ids ?? []);
  const itemsById = new Map(kga.items.map((i) => [i.id, i]));

  const selectedEntries = kga.research_queue.slice(0, maxItems);

  const selected: SelectedDeepResearchItem[] = selectedEntries.map((entry) => {
    const upstream = itemsById.get(entry.knowledge_item_id);
    if (!upstream) {
      throw new Error(
        `research_queue entry '${entry.knowledge_item_id}' does not map to any upstream KnowledgeItem (DR-P1).`,
      );
    }
    if (upstream.epistemic_status !== "NEEDS_RESEARCH") {
      throw new Error(
        `research_queue entry '${entry.knowledge_item_id}' has upstream epistemic_status ` +
          `'${upstream.epistemic_status}', not NEEDS_RESEARCH — only NEEDS_RESEARCH items are eligible (DR-R1).`,
      );
    }
    if (unknowableIds.has(entry.knowledge_item_id)) {
      throw new Error(
        `research_queue entry '${entry.knowledge_item_id}' appears in handoff.unknowable_item_ids — ` +
          "UNKNOWABLE items must never be researched (DR-R2).",
      );
    }
    return {
      knowledge_item_id: entry.knowledge_item_id,
      research_question: entry.research_question,
      decision_impact: entry.decision_impact,
      blocking: entry.blocking,
      upstream_epistemic_status: "NEEDS_RESEARCH",
      upstream_closure_state: upstream.closure_state,
    };
  });

  const selected_item_ids = selected.map((s) => s.knowledge_item_id);
  const selectedIdSet = new Set(selected_item_ids);
  const deferred_item_ids = queue_snapshot.filter((id) => !selectedIdSet.has(id));

  return { queue_snapshot, selected, selected_item_ids, deferred_item_ids };
}
