import {
  CONTEXT_SOURCE_LAYERS,
  CONTEXT_STATUSES,
  type TaskCompilationContextPackSnapshot,
  type TaskCompilationInput,
} from "./types.js";

/**
 * Brain — S13G Context Pack validation (a BLOCKED path, not a throw).
 *
 * Implements brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md sections
 * 5.11 and 6, and the Skill file "Context Pack" / "Context policy". S13G never
 * composes, retrieves, ranks, trims, or refreshes context — it only validates
 * the supplied, already-frozen S05 pack and, if it is materially invalid or
 * insufficient, returns blockers so `compileTaskExecutionPackage()` produces a
 * BLOCKED result.
 *
 * "Essential" == a context item whose `relevance.priority` is CRITICAL or HIGH.
 */

const CANONICAL_AUTHORITY_NAMES = [
  "runtime/repository reality",
  "explicit current spec",
  "verified current/handoff",
  "ADRs",
  "project instructions",
  "compiled knowledge",
  "durable memory",
  "historical sessions",
  "inference",
];

function normalizeWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 4),
  );
}

export function validateContextPackSnapshot(
  pack: TaskCompilationContextPackSnapshot,
  input: TaskCompilationInput,
): string[] {
  const blockers: string[] = [];
  const push = (msg: string): void => {
    blockers.push(`Context Pack: ${msg}`);
  };

  if (!pack.id || pack.id.trim().length === 0) push("id is missing.");
  if (!pack.objective || !pack.objective.statement || pack.objective.statement.trim().length === 0) {
    push("objective.statement is missing.");
  }

  // ---- canonical authority ordering (S05 — exactly the 9 ranks, in order).
  const ordering = pack.authority_policy?.ordering ?? [];
  if (ordering.length !== 9) {
    push(`authority_policy.ordering must carry the 9 canonical S05 ranks (got ${ordering.length}).`);
  } else {
    for (let i = 0; i < 9; i++) {
      if (ordering[i]?.rank !== i + 1) push(`authority_policy.ordering[${i}].rank must be ${i + 1}.`);
      if (ordering[i]?.name !== CANONICAL_AUTHORITY_NAMES[i]) {
        push(`authority_policy.ordering[${i}].name must be "${CANONICAL_AUTHORITY_NAMES[i]}".`);
      }
    }
  }

  // ---- bounded budget metadata (spec 5.11 — at least one concrete bound).
  const b = pack.budget ?? {};
  const concreteBounds = [b.max_tokens, b.max_characters, b.max_items].filter(
    (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  if (concreteBounds.length === 0) {
    push("budget must expose at least one concrete positive bound (max_tokens | max_characters | max_items).");
  }

  // ---- items.
  const seenIds = new Set<string>();
  for (const [i, item] of (pack.items ?? []).entries()) {
    const at = `items[${i}]`;
    if (!item.id || item.id.trim().length === 0) push(`${at}.id is missing.`);
    if (seenIds.has(item.id)) push(`${at}.id '${item.id}' is duplicated.`);
    seenIds.add(item.id);
    if (!CONTEXT_SOURCE_LAYERS.includes(item.source_layer)) push(`${at}.source_layer '${item.source_layer}' is not a canonical S05 layer.`);
    if (!Number.isInteger(item.authority_rank) || item.authority_rank < 1 || item.authority_rank > 9) {
      push(`${at}.authority_rank must be an integer 1..9.`);
    }
    if (!CONTEXT_STATUSES.includes(item.status)) push(`${at}.status '${item.status}' is not a canonical status.`);
    if (!item.provenance || !item.provenance.source_ref || item.provenance.source_ref.trim().length === 0) {
      push(`${at}.provenance.source_ref is missing.`);
    }
    if (!item.relevance || !item.relevance.reason || !["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(item.relevance.priority)) {
      push(`${at}.relevance {reason, priority} is missing or invalid.`);
    }

    // Essential items in an unusable epistemic state block compilation (spec 5.11).
    const essential = item.relevance?.priority === "CRITICAL" || item.relevance?.priority === "HIGH";
    if (essential && item.status === "BLOCKED") {
      push(`essential item '${item.id}' has status BLOCKED; S13G does not repair context.`);
    }
    if (essential && item.status === "UNKNOWN") {
      push(`essential item '${item.id}' has unresolved status UNKNOWN; S13G does not resolve context conflicts.`);
    }
  }

  // ---- objective alignment (spec 6 — materially compatible with the task outcome).
  if (pack.objective?.statement) {
    const outcomeWords = normalizeWords(input.task.outcome);
    const objectiveWords = normalizeWords(pack.objective.statement);
    let overlap = 0;
    for (const w of outcomeWords) if (objectiveWords.has(w)) overlap += 1;
    if (outcomeWords.size > 0 && overlap === 0) {
      push("objective is not materially aligned with the task outcome (zero significant-word overlap).");
    }
  }

  return blockers;
}
