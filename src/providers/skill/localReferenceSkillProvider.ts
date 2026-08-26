import type {
  SkillCatalogEntry,
  SkillDefinition,
  SkillDescriptor,
  SkillDiscoveryRequest,
  SkillLoadRequest,
  SkillProvider,
} from "../../core/skill/index.js";
import { validateSkillDefinition } from "../../core/skill/index.js";

/**
 * Reference implementation of Brain's SkillProvider contract.
 *
 * Defined in brain-bootstrap/specs/SKILL_CONTRACT_v1.md sections 20-24 and
 * 31-32. Backs discovery with cheap SkillDescriptor metadata only; full
 * SkillDefinition content is loaded lazily, and only for the exact selected
 * Skill. No network, no credentials, no external ranking service — a
 * deterministic lexical scoring formula is sufficient (section 32).
 */

const DEFAULT_LIMIT = 5;
const MIN_LIMIT = 1;
const MAX_LIMIT = 20;

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/**
 * Deterministic lexical relevance score over descriptor metadata only
 * (id / description / applies_when.task_kinds / applies_when.signals) —
 * never over full Skill content. Stronger, more specific fields (id,
 * explicit relevance signals) outweigh weaker ones (free-text description).
 * Ties are broken by `id` in the caller, making the ordering fully
 * deterministic for a fixed catalog + request.
 */
function scoreDescriptor(descriptor: SkillDescriptor, queryTokens: readonly string[], taskKinds?: readonly string[]): number {
  const idTokens = normalizeTokens(descriptor.id);
  const descriptionTokens = normalizeTokens(descriptor.description);
  const signalTokens = descriptor.applies_when.signals.flatMap(normalizeTokens);
  const taskKindTokens = descriptor.applies_when.task_kinds.flatMap(normalizeTokens);

  let score = 0;
  for (const token of queryTokens) {
    if (idTokens.includes(token)) score += 5;
    if (signalTokens.includes(token)) score += 4;
    if (taskKindTokens.includes(token)) score += 3;
    if (descriptionTokens.includes(token)) score += 1;
  }

  if (taskKinds) {
    for (const requestedKind of taskKinds) {
      if (descriptor.applies_when.task_kinds.includes(requestedKind)) score += 2;
    }
  }

  return score;
}

function rankDescriptors(descriptors: SkillDescriptor[], query: string, taskKinds?: string[]): SkillDescriptor[] {
  const queryTokens = normalizeTokens(query);
  return [...descriptors]
    .map((descriptor) => ({ descriptor, score: scoreDescriptor(descriptor, queryTokens, taskKinds) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.descriptor.id.localeCompare(b.descriptor.id)))
    .map((entry) => entry.descriptor);
}

/** Requests above MAX_LIMIT are bounded (clamped), not rejected — documented per SKILL_CONTRACT_v1.md T8. */
function resolveLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < MIN_LIMIT) {
    throw new Error(`limit must be an integer >= ${MIN_LIMIT}.`);
  }
  return Math.min(limit, MAX_LIMIT);
}

export class LocalReferenceSkillProvider implements SkillProvider {
  private readonly entries: Map<string, SkillCatalogEntry>;

  constructor(entries: SkillCatalogEntry[]) {
    this.entries = new Map(entries.map((entry) => [entry.descriptor.id, entry]));
  }

  async discover(request: SkillDiscoveryRequest): Promise<SkillDescriptor[]> {
    if (typeof request.query !== "string" || request.query.trim().length === 0) {
      throw new Error("SkillDiscoveryRequest.query must be a non-empty string.");
    }
    const limit = resolveLimit(request.limit);

    let candidates = Array.from(this.entries.values()).map((entry) => entry.descriptor);

    if (request.allowed_skill_ids) {
      const allowed = new Set(request.allowed_skill_ids);
      candidates = candidates.filter((descriptor) => allowed.has(descriptor.id));
    }

    // Metadata-only: this method never touches entry.load_definition().
    const ranked = rankDescriptors(candidates, request.query, request.task_kinds);
    return ranked.slice(0, limit);
  }

  async load(request: SkillLoadRequest): Promise<SkillDefinition> {
    const entry = this.entries.get(request.id);
    if (!entry) {
      throw new Error(`Unknown Skill id '${request.id}'.`);
    }

    // Section 24: invoke only the selected definition loader.
    const definition = await entry.load_definition();

    const validation = validateSkillDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Loaded SkillDefinition '${request.id}' failed validation: ${validation.errors.join("; ")}`);
    }

    if (definition.id !== request.id) {
      throw new Error(`Loaded SkillDefinition id '${definition.id}' does not match requested id '${request.id}'.`);
    }

    if (request.version !== undefined && definition.version !== request.version) {
      throw new Error(
        `Skill '${request.id}' version mismatch: requested '${request.version}', loaded definition has '${definition.version}'.`,
      );
    }

    return definition;
  }
}
