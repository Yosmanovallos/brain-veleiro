import type { ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import type { RequirementsDiscoveryResult } from "../../src/intelligence/requirements-discovery/types.js";
import {
  KGA_INPUT_MARKER,
  KGA_SKILL_MATERIALIZATION_MARKER,
} from "../../src/intelligence/knowledge-gap-analysis/materializeKnowledgeGapAnalysisTask.js";
import { mapKnowledgeGapAnalysisResultToStructuredOutput } from "../../src/intelligence/knowledge-gap-analysis/validateKnowledgeGapAnalysisResult.js";
import { FUTURE_CONTINGENT_CHOICE_CUES } from "../../src/intelligence/knowledge-gap-analysis/compareKnowledgeGapAnalysisRuns.js";
import type {
  CurrentGapClosureState,
  DecisionImpact,
  DeepResearchHandoff,
  KnowledgeBuckets,
  KnowledgeContextFact,
  KnowledgeGapAnalysisInput,
  KnowledgeGapAnalysisResult,
  KnowledgeItem,
  KnowledgeItemSourceKind,
  ResearchQueueItem,
} from "../../src/intelligence/knowledge-gap-analysis/types.js";

/**
 * Deterministic, no-network, no-hardcoded-answer knowledge-gap-analysis
 * reasoning used only for S13B verification
 * (KNOWLEDGE_GAP_ANALYSIS_AGENT_v1.md section 24 — "a hosted/external LLM is
 * not required... the verification model must be input-dependent").
 *
 * `runSkillModeClassification` is a genuine, general-purpose rule-based
 * classifier (not special-cased to either canonical fixture):
 *   - GOAL/USER/CONSTRAINT/ACCEPTANCE_CRITERION: EXPLICIT-origin items are a
 *     client's own stated requirement/preference, which the client is
 *     inherently authoritative for (KGA_AGENT_v1.md section 19) -> KNOWN;
 *     DERIVED items -> ASSUMED.
 *   - ASSUMPTION / UNKNOWN: NEEDS_RESEARCH / ASSUMED by default, UPGRADED to
 *     UNKNOWABLE only when a genuine future-contingent-choice text cue is
 *     found either in the item's own text or in a context_fact linked to it
 *     via shared related_goal_ids (never a fixture-specific special case).
 *   - CONTEXT_FACT: classified from its own `basis`
 *     (DIRECT_EVIDENCE->PROVEN, CANONICAL_AUTHORITY->KNOWN,
 *     SOURCE_ASSERTION->TOLD), unless its own statement is itself a
 *     future-contingent-choice cue, in which case UNKNOWABLE.
 *
 * `runBaselineClassification` models what a "no Skill selected" default
 * completion looks like: it reproduces, for real, the exact "Incorrect
 * behavior" failure pattern documented in
 * brain-bootstrap/skills/KNOWLEDGE_GAP_ANALYSIS_SKILL_S13B.md section 6
 * (TOLD -> PROVEN because the client said it; UNKNOWABLE -> NEEDS_RESEARCH
 * when no evidence search can determine a future choice) plus never
 * consuming `acceptance_criteria` at all (a naive completion doesn't know
 * KGA-P2 requires normalizing every S13A category). Both functions are
 * driven by the SAME literal input; only the strategy differs.
 */

const IMPACT_MAP: Record<"HIGH" | "MEDIUM" | "LOW", DecisionImpact> = {
  HIGH: "DECISION_CRITICAL",
  MEDIUM: "DECISION_RELEVANT",
  LOW: "CONTEXTUAL",
};

const IMPACT_RANK: Record<DecisionImpact, number> = {
  DECISION_CRITICAL: 0,
  DECISION_RELEVANT: 1,
  CONTEXTUAL: 2,
  TRIVIA: 3,
};

function makeItem(
  partial: Partial<KnowledgeItem> &
    Pick<
      KnowledgeItem,
      "id" | "source_item_ref" | "source_kind" | "statement" | "epistemic_status" | "decision_impact" | "closure_state" | "related_goal_ids" | "rationale"
    >,
): KnowledgeItem {
  return {
    authority_refs: [],
    evidence_refs: [],
    assertion_refs: [],
    authority_sufficient: false,
    accepted_for_current_decision: false,
    blocking: false,
    limitations: [],
    ...partial,
  };
}

/** Returns the matched future-contingent-choice cue text, or undefined if none applies to this item. */
function futureChoiceCue(
  ownText: string,
  relatedIds: readonly string[],
  ownId: string,
  contextFacts: readonly KnowledgeContextFact[],
): string | undefined {
  if (FUTURE_CONTINGENT_CHOICE_CUES.test(ownText)) return ownText;
  const linked = contextFacts.find(
    (f) => (f.id === ownId || f.related_goal_ids.some((id) => relatedIds.includes(id))) && FUTURE_CONTINGENT_CHOICE_CUES.test(f.statement),
  );
  return linked?.statement;
}

function classifyRequirementLikeItem(params: {
  idPrefix: string;
  sourceKind: KnowledgeItemSourceKind;
  statement: string;
  origin: "EXPLICIT" | "DERIVED";
  relatedGoalIds: string[];
}): KnowledgeItem {
  const { idPrefix, sourceKind, statement, origin, relatedGoalIds } = params;
  if (origin === "EXPLICIT") {
    return makeItem({
      id: `K-${idPrefix}`,
      source_item_ref: idPrefix,
      source_kind: sourceKind,
      statement,
      epistemic_status: "KNOWN",
      decision_impact: "DECISION_RELEVANT",
      closure_state: "RESOLVED_BY_AUTHORITY",
      authority_refs: ["requirements_discovery.request"],
      authority_sufficient: true,
      related_goal_ids: relatedGoalIds,
      rationale: "The current client request is authoritative for this desired requirement.",
    });
  }
  return makeItem({
    id: `K-${idPrefix}`,
    source_item_ref: idPrefix,
    source_kind: sourceKind,
    statement,
    epistemic_status: "ASSUMED",
    decision_impact: "DECISION_RELEVANT",
    closure_state: null,
    assumption_rationale: "Derived without an explicit client statement; provisional until validated.",
    related_goal_ids: relatedGoalIds,
    rationale: "Derived item without sufficient authority/evidence yet.",
  });
}

function buildBuckets(items: readonly KnowledgeItem[]): KnowledgeBuckets {
  const buckets: KnowledgeBuckets = { known: [], told: [], proven: [], assumed: [], needs_research: [], unknowable: [] };
  for (const item of items) {
    switch (item.epistemic_status) {
      case "KNOWN":
        buckets.known.push(item.id);
        break;
      case "TOLD":
        buckets.told.push(item.id);
        break;
      case "PROVEN":
        buckets.proven.push(item.id);
        break;
      case "ASSUMED":
        buckets.assumed.push(item.id);
        break;
      case "NEEDS_RESEARCH":
        buckets.needs_research.push(item.id);
        break;
      case "UNKNOWABLE":
        buckets.unknowable.push(item.id);
        break;
    }
  }
  return buckets;
}

function buildResearchQueue(items: readonly KnowledgeItem[]): ResearchQueueItem[] {
  const candidates = items.filter((i) => i.epistemic_status === "NEEDS_RESEARCH");
  const sorted = [...candidates].sort((a, b) => {
    const rankDiff = IMPACT_RANK[a.decision_impact] - IMPACT_RANK[b.decision_impact];
    if (rankDiff !== 0) return rankDiff;
    if (a.blocking !== b.blocking) return a.blocking ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return sorted.map((item) => ({
    knowledge_item_id: item.id,
    research_question: item.research_question ?? item.statement,
    decision_impact: item.decision_impact,
    blocking: item.blocking,
    why_research_matters: item.rationale,
  }));
}

function buildHandoff(items: readonly KnowledgeItem[], researchQueue: readonly ResearchQueueItem[]): DeepResearchHandoff {
  const research_item_ids = researchQueue.map((r) => r.knowledge_item_id);
  const unknowable_item_ids = items.filter((i) => i.epistemic_status === "UNKNOWABLE").map((i) => i.id);
  const decision_blockers = items
    .filter(
      (i) =>
        i.blocking &&
        (i.closure_state === null || i.closure_state === "BLOCKED") &&
        (i.epistemic_status === "NEEDS_RESEARCH" || i.epistemic_status === "UNKNOWABLE"),
    )
    .map((i) => i.id);

  return {
    ready_for_deep_research: research_item_ids.length > 0,
    research_item_ids,
    decision_blockers,
    unknowable_item_ids,
    notes:
      research_item_ids.length > 0
        ? `S13C should prioritize ${research_item_ids.length} research item(s); ${decision_blockers.length} decision blocker(s) currently unresolved.`
        : `No items require deep research; ${unknowable_item_ids.length} item(s) remain permanently unknowable.`,
  };
}

function buildSummary(items: readonly KnowledgeItem[], researchQueue: readonly ResearchQueueItem[], handoff: DeepResearchHandoff): string {
  const counts = { known: 0, told: 0, proven: 0, assumed: 0, needs_research: 0, unknowable: 0 };
  for (const item of items) {
    const key = item.epistemic_status.toLowerCase() as keyof typeof counts;
    counts[key] += 1;
  }
  return (
    `Classified ${items.length} item(s): ${counts.known} known, ${counts.told} told, ${counts.proven} proven, ` +
    `${counts.assumed} assumed, ${counts.needs_research} needing research, ${counts.unknowable} unknowable. ` +
    `${researchQueue.length} item(s) queued for S13C deep research; ${handoff.decision_blockers.length} decision blocker(s) remain.`
  );
}

/**
 * Genuine, general-purpose (not fixture-specific) rule-based knowledge-gap
 * classification following KGA-P1..KGA-P10.
 */
export function runSkillModeClassification(input: KnowledgeGapAnalysisInput): KnowledgeGapAnalysisResult {
  const rd = input.requirements_discovery;
  const contextFacts = input.context_facts;
  const items: KnowledgeItem[] = [];

  for (const goal of rd.goals) {
    items.push(
      classifyRequirementLikeItem({ idPrefix: goal.id, sourceKind: "GOAL", statement: goal.statement, origin: goal.origin, relatedGoalIds: [goal.id] }),
    );
  }
  for (const user of rd.users) {
    items.push(
      classifyRequirementLikeItem({ idPrefix: user.id, sourceKind: "USER", statement: user.description, origin: user.origin, relatedGoalIds: [user.id] }),
    );
  }
  for (const constraint of rd.constraints) {
    items.push(
      classifyRequirementLikeItem({
        idPrefix: constraint.id,
        sourceKind: "CONSTRAINT",
        statement: constraint.statement,
        origin: constraint.origin,
        relatedGoalIds: [constraint.id],
      }),
    );
  }
  for (const ac of rd.acceptance_criteria) {
    items.push(
      classifyRequirementLikeItem({
        idPrefix: ac.id,
        sourceKind: "ACCEPTANCE_CRITERION",
        statement: ac.criterion,
        origin: "EXPLICIT",
        relatedGoalIds: ac.linked_goal_ids,
      }),
    );
  }

  for (const assumption of rd.assumptions) {
    const cue = futureChoiceCue(assumption.statement, assumption.related_goal_ids, assumption.id, contextFacts);
    if (cue) {
      items.push(
        makeItem({
          id: `K-${assumption.id}`,
          source_item_ref: assumption.id,
          source_kind: "ASSUMPTION",
          statement: assumption.statement,
          epistemic_status: "UNKNOWABLE",
          decision_impact: "DECISION_RELEVANT",
          closure_state: null,
          related_goal_ids: assumption.related_goal_ids,
          rationale: `Related context indicates an undecided future choice: "${cue}"`,
        }),
      );
    } else {
      items.push(
        makeItem({
          id: `K-${assumption.id}`,
          source_item_ref: assumption.id,
          source_kind: "ASSUMPTION",
          statement: assumption.statement,
          epistemic_status: "ASSUMED",
          decision_impact: "DECISION_RELEVANT",
          closure_state: null,
          assumption_rationale: assumption.rationale || "Provisional interpretation without sufficient authority/evidence.",
          related_goal_ids: assumption.related_goal_ids,
          rationale: "S13A assumption retained as ASSUMED; no bounded context upgrades it.",
        }),
      );
    }
  }

  for (const unknown of rd.unknowns) {
    // Unlike assumptions, an unknown's future-contingent-choice status is
    // read only from its own question text — not from context_facts sharing
    // a related_goal_id, which (unlike a 1:1 assumption link) would too
    // easily leak a signal meant for one specific assumption onto every
    // other unknown that happens to touch the same goal.
    const cue = FUTURE_CONTINGENT_CHOICE_CUES.test(unknown.question) ? unknown.question : undefined;
    const decision_impact = IMPACT_MAP[unknown.impact];
    if (cue) {
      items.push(
        makeItem({
          id: `K-${unknown.id}`,
          source_item_ref: unknown.id,
          source_kind: "UNKNOWN",
          statement: unknown.question,
          epistemic_status: "UNKNOWABLE",
          decision_impact,
          closure_state: null,
          blocking: unknown.blocking,
          related_goal_ids: unknown.related_goal_ids,
          research_question: unknown.question,
          rationale: `This is a future contingent choice, not a researchable fact: "${cue}"`,
        }),
      );
    } else {
      items.push(
        makeItem({
          id: `K-${unknown.id}`,
          source_item_ref: unknown.id,
          source_kind: "UNKNOWN",
          statement: unknown.question,
          epistemic_status: "NEEDS_RESEARCH",
          decision_impact,
          closure_state: null,
          blocking: unknown.blocking,
          related_goal_ids: unknown.related_goal_ids,
          research_question: unknown.question,
          rationale: unknown.why_it_matters,
        }),
      );
    }
  }

  for (const fact of contextFacts) {
    if (FUTURE_CONTINGENT_CHOICE_CUES.test(fact.statement)) {
      items.push(
        makeItem({
          id: `K-${fact.id}`,
          source_item_ref: fact.id,
          source_kind: "CONTEXT_FACT",
          statement: fact.statement,
          epistemic_status: "UNKNOWABLE",
          decision_impact: "DECISION_RELEVANT",
          closure_state: null,
          related_goal_ids: fact.related_goal_ids,
          rationale: "This context fact itself states an undecided future choice.",
        }),
      );
      continue;
    }
    if (fact.basis === "DIRECT_EVIDENCE") {
      items.push(
        makeItem({
          id: `K-${fact.id}`,
          source_item_ref: fact.id,
          source_kind: "CONTEXT_FACT",
          statement: fact.statement,
          epistemic_status: "PROVEN",
          decision_impact: "DECISION_RELEVANT",
          closure_state: "RESOLVED_WITH_EVIDENCE",
          evidence_refs: [fact.source_ref],
          related_goal_ids: fact.related_goal_ids,
          rationale: "Direct inspectable evidence is already present in bounded context.",
        }),
      );
    } else if (fact.basis === "CANONICAL_AUTHORITY") {
      items.push(
        makeItem({
          id: `K-${fact.id}`,
          source_item_ref: fact.id,
          source_kind: "CONTEXT_FACT",
          statement: fact.statement,
          epistemic_status: "KNOWN",
          decision_impact: "DECISION_RELEVANT",
          closure_state: "RESOLVED_BY_AUTHORITY",
          authority_refs: [fact.source_ref],
          authority_sufficient: true,
          related_goal_ids: fact.related_goal_ids,
          rationale: "A current canonical authority is sufficient for this statement.",
        }),
      );
    } else {
      items.push(
        makeItem({
          id: `K-${fact.id}`,
          source_item_ref: fact.id,
          source_kind: "CONTEXT_FACT",
          statement: fact.statement,
          epistemic_status: "TOLD",
          decision_impact: "DECISION_RELEVANT",
          closure_state: null,
          assertion_refs: [fact.source_ref],
          related_goal_ids: fact.related_goal_ids,
          rationale: "An assertion from a source/stakeholder not independently established as KNOWN or PROVEN.",
        }),
      );
    }
  }

  const buckets = buildBuckets(items);
  const research_queue = buildResearchQueue(items);
  const handoff = buildHandoff(items, research_queue);
  const decision_readiness_summary = buildSummary(items, research_queue, handoff);

  return { source_request: rd.request, items, buckets, research_queue, handoff, decision_readiness_summary };
}

/**
 * Naive "no Skill selected" baseline: reproduces, for real, the exact
 * "Incorrect behavior" pattern from KNOWLEDGE_GAP_ANALYSIS_SKILL_S13B.md
 * section 6 — every stakeholder assertion/statement is treated as already
 * PROVEN, and every S13A unknown defaults to NEEDS_RESEARCH even when it is
 * a future contingent choice. It also never normalizes `acceptance_criteria`
 * at all (a naive completion does not know KGA-P2 requires every S13A
 * category to be covered).
 */
export function runBaselineClassification(input: KnowledgeGapAnalysisInput): KnowledgeGapAnalysisResult {
  const rd = input.requirements_discovery;
  const items: KnowledgeItem[] = [];

  const overclaim = (id: string, sourceKind: KnowledgeItemSourceKind, statement: string, relatedGoalIds: string[]): KnowledgeItem =>
    makeItem({
      id: `K-${id}`,
      source_item_ref: id,
      source_kind: sourceKind,
      statement,
      epistemic_status: "PROVEN",
      decision_impact: "DECISION_RELEVANT",
      closure_state: "RESOLVED_WITH_EVIDENCE",
      evidence_refs: [],
      related_goal_ids: relatedGoalIds,
      rationale: "Naive completion: any stated item is treated as already established.",
    });

  for (const goal of rd.goals) items.push(overclaim(goal.id, "GOAL", goal.statement, [goal.id]));
  for (const user of rd.users) items.push(overclaim(user.id, "USER", user.description, [user.id]));
  for (const constraint of rd.constraints) items.push(overclaim(constraint.id, "CONSTRAINT", constraint.statement, [constraint.id]));
  for (const assumption of rd.assumptions) items.push(overclaim(assumption.id, "ASSUMPTION", assumption.statement, assumption.related_goal_ids));
  for (const fact of input.context_facts) items.push(overclaim(fact.id, "CONTEXT_FACT", fact.statement, fact.related_goal_ids));

  for (const unknown of rd.unknowns) {
    items.push(
      makeItem({
        id: `K-${unknown.id}`,
        source_item_ref: unknown.id,
        source_kind: "UNKNOWN",
        statement: unknown.question,
        epistemic_status: "NEEDS_RESEARCH",
        decision_impact: IMPACT_MAP[unknown.impact],
        closure_state: null,
        blocking: unknown.blocking,
        related_goal_ids: unknown.related_goal_ids,
        research_question: unknown.question,
        rationale: "Naive completion: every open question defaults to needing research, including future choices.",
      }),
    );
  }

  const buckets = buildBuckets(items);
  const research_queue = buildResearchQueue(items);
  const handoff = buildHandoff(items, research_queue);
  const decision_readiness_summary = buildSummary(items, research_queue, handoff);

  return { source_request: rd.request, items, buckets, research_queue, handoff, decision_readiness_summary };
}

function extractKgaInput(goalText: string): KnowledgeGapAnalysisInput {
  const markerIdx = goalText.indexOf(KGA_INPUT_MARKER);
  if (markerIdx === -1) {
    throw new Error("DeterministicKnowledgeGapAnalysisModelProvider: materialized objective missing KGA_INPUT marker.");
  }
  const rest = goalText.slice(markerIdx + KGA_INPUT_MARKER.length + 1);
  const nextMarkerIdx = rest.indexOf(`\n${KGA_SKILL_MATERIALIZATION_MARKER}`);
  const jsonText = (nextMarkerIdx === -1 ? rest : rest.slice(0, nextMarkerIdx)).trim();
  return JSON.parse(jsonText) as KnowledgeGapAnalysisInput;
}

/**
 * Deterministic, no-network knowledge-gap-analysis ModelProvider used only
 * for S13B verification. Always finishes on the first turn (S13B issues no
 * tool calls). Its behavior branches purely on whether the materialized
 * objective contains the SKILL_ID marker — i.e., whether S12 actually
 * discovered/loaded/materialized the S13B Skill for this task — never on
 * the specific fixture content.
 */
export class DeterministicKnowledgeGapAnalysisModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const goalText = request.goal.statement;
    const input = extractKgaInput(goalText);
    const skillMode = goalText.includes(KGA_SKILL_MATERIALIZATION_MARKER);

    const result = skillMode ? runSkillModeClassification(input) : runBaselineClassification(input);

    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: skillMode
          ? "Applied the materialized Knowledge Gap Analysis Skill rules/procedure to the input."
          : "No Skill was materialized for this task; produced a naive best-effort classification.",
        output: mapKnowledgeGapAnalysisResultToStructuredOutput(result),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Canonical fixtures
// ---------------------------------------------------------------------------

const POSITIVE_REQUIREMENTS_DISCOVERY: RequirementsDiscoveryResult = {
  request:
    "Necesito una aplicación para que una tienda registre un peluche comprado, pida el nombre del peluche y algunos " +
    "datos del dueño, y al final imprima un certificado. Se usará en un kiosco con pantalla táctil.",
  goals: [
    {
      id: "G1",
      statement: "Permitir registrar un peluche comprado mediante un flujo de kiosco.",
      origin: "EXPLICIT",
      source_excerpt: "registre un peluche comprado",
      rationale: "",
      priority: "PRIMARY",
    },
    {
      id: "G2",
      statement: "Recoger el nombre del peluche y datos del dueño necesarios para completar el registro.",
      origin: "EXPLICIT",
      source_excerpt: "pida el nombre del peluche y algunos datos del dueño",
      rationale: "",
      priority: "PRIMARY",
    },
    {
      id: "G3",
      statement: "Generar un certificado imprimible al finalizar el flujo.",
      origin: "EXPLICIT",
      source_excerpt: "al final imprima un certificado",
      rationale: "",
      priority: "PRIMARY",
    },
  ],
  users: [
    {
      id: "U1",
      description: "Persona que utiliza el kiosco para registrar el peluche.",
      origin: "DERIVED",
      source_excerpt: "",
      rationale: "El request describe un kiosco interactivo pero no nombra explícitamente al usuario final.",
      needs: ["completar el flujo desde pantalla táctil", "obtener el certificado final"],
    },
  ],
  unknowns: [
    {
      id: "Q1",
      question: "¿Cómo se identifica técnicamente el peluche comprado?",
      why_it_matters: "Cambia el flujo de entrada y posibles integraciones de hardware.",
      impact: "HIGH",
      blocking: true,
      related_goal_ids: ["G1"],
    },
    {
      id: "Q2",
      question: "¿Qué datos exactos del dueño son obligatorios?",
      why_it_matters: "Define formularios, validación, privacidad y contenido del certificado.",
      impact: "HIGH",
      blocking: true,
      related_goal_ids: ["G2"],
    },
    {
      id: "Q3",
      question: "¿Qué impresora/formato debe soportar el certificado?",
      why_it_matters: "Afecta integración y aceptación del flujo final.",
      impact: "MEDIUM",
      blocking: false,
      related_goal_ids: ["G3"],
    },
  ],
  assumptions: [
    {
      id: "A1",
      statement: "El flujo será operado directamente por el cliente desde la pantalla táctil.",
      rationale: "El request menciona un kiosco con pantalla táctil pero no define operador.",
      risk: "MEDIUM",
      must_validate: true,
      related_goal_ids: ["G1", "G2"],
    },
  ],
  constraints: [
    {
      id: "C1",
      statement: "La interfaz debe ser utilizable desde una pantalla táctil de kiosco.",
      kind: "TECHNICAL",
      origin: "EXPLICIT",
      source_excerpt: "Se usará en un kiosco con pantalla táctil.",
      rationale: "",
    },
  ],
  acceptance_criteria: [
    {
      id: "AC1",
      criterion: "El flujo permite completar el registro del peluche desde la interfaz táctil sin requerir teclado físico.",
      linked_goal_ids: ["G1"],
      testable: true,
      verification_hint: "Ejecutar el flujo completo usando únicamente controles táctiles.",
    },
    {
      id: "AC2",
      criterion: "El flujo solicita y conserva el nombre del peluche antes de finalizar el registro.",
      linked_goal_ids: ["G2"],
      testable: true,
      verification_hint: "Completar el flujo y comprobar que el nombre introducido aparece en el resultado final.",
    },
    {
      id: "AC3",
      criterion: "Al completar un registro válido se genera una salida de certificado lista para impresión.",
      linked_goal_ids: ["G3"],
      testable: true,
      verification_hint: "Ejecutar un registro válido y verificar la existencia de la salida imprimible.",
    },
  ],
  handoff: {
    ready_for_gap_analysis: true,
    unresolved_blockers: ["Q1", "Q2"],
    notes:
      "El request permite estructurar el objetivo del kiosco, pero las decisiones de identificación del producto y " +
      "datos obligatorios requieren análisis posterior.",
  },
};

const POSITIVE_CONTEXT_FACTS: KnowledgeContextFact[] = [
  {
    id: "CF1",
    statement: "La interfaz objetivo es un kiosco táctil.",
    source_ref: "request:S13A",
    authority: "CURRENT_CLIENT_REQUEST",
    basis: "CANONICAL_AUTHORITY",
    related_goal_ids: ["C1"],
  },
  {
    id: "CF2",
    statement: "Una impresora Zebra ZD421 conectada al entorno de prueba imprimió correctamente el certificado de fixture.",
    source_ref: "test:printer-fixture-001",
    authority: "DETERMINISTIC_TEST",
    basis: "DIRECT_EVIDENCE",
    related_goal_ids: ["G3"],
  },
  {
    id: "CF3",
    statement: "El cliente todavía no ha decidido si el kiosco será operado por el comprador o por un empleado.",
    source_ref: "stakeholder-note:operator-undecided",
    authority: "CURRENT_CLIENT_DECISION_STATE",
    basis: "CANONICAL_AUTHORITY",
    related_goal_ids: ["G1", "G2"],
  },
  {
    id: "CF4",
    statement: "El gerente de la tienda estima que se registrarán unos 50 peluches por día.",
    source_ref: "stakeholder-note:volume-estimate",
    authority: "STORE_MANAGER_ESTIMATE",
    basis: "SOURCE_ASSERTION",
    related_goal_ids: ["G1"],
  },
];

export const POSITIVE_KGA_INPUT: KnowledgeGapAnalysisInput = {
  requirements_discovery: POSITIVE_REQUIREMENTS_DISCOVERY,
  context_facts: POSITIVE_CONTEXT_FACTS,
};

/** Same input minus the operator-undecided context fact — used to prove T22 input dependence in isolation. */
export const POSITIVE_KGA_INPUT_WITHOUT_UNDECIDED_OPERATOR_FACT: KnowledgeGapAnalysisInput = {
  requirements_discovery: POSITIVE_REQUIREMENTS_DISCOVERY,
  context_facts: POSITIVE_CONTEXT_FACTS.filter((f) => f.id !== "CF3"),
};

const NEGATIVE_REQUIREMENTS_DISCOVERY: RequirementsDiscoveryResult = {
  request: "El cliente afirma que la plataforma ya tiene 10.000 usuarios activos y quiere decidir el proveedor de pagos el próximo mes.",
  goals: [
    {
      id: "G1",
      statement: "Preparar la aplicación para el volumen declarado.",
      origin: "DERIVED",
      source_excerpt: "",
      rationale: "El cliente menciona un volumen de usuarios pero no especifica requisitos técnicos concretos derivados de él.",
      priority: "PRIMARY",
    },
  ],
  users: [],
  unknowns: [
    {
      id: "Q1",
      question: "¿Cuántos usuarios activos verificables existen actualmente?",
      why_it_matters: "Determina el dimensionamiento real de la infraestructura necesaria.",
      impact: "HIGH",
      blocking: false,
      related_goal_ids: ["G1"],
    },
    {
      id: "Q2",
      question: "¿Qué proveedor de pagos elegirá finalmente el cliente el próximo mes?",
      impact: "MEDIUM",
      why_it_matters: "Afecta la integración de pagos a implementar.",
      blocking: false,
      related_goal_ids: ["G1"],
    },
  ],
  assumptions: [],
  constraints: [],
  acceptance_criteria: [],
  handoff: {
    ready_for_gap_analysis: true,
    unresolved_blockers: [],
    notes: "El volumen declarado y la elección de proveedor de pagos permanecen sin confirmar.",
  },
};

const NEGATIVE_CONTEXT_FACTS: KnowledgeContextFact[] = [
  {
    id: "CF1",
    statement: "La plataforma ya tiene 10.000 usuarios activos.",
    source_ref: "request:S13A",
    authority: "CLIENT_STATEMENT",
    basis: "SOURCE_ASSERTION",
    related_goal_ids: ["G1"],
  },
];

export const NEGATIVE_KGA_INPUT: KnowledgeGapAnalysisInput = {
  requirements_discovery: NEGATIVE_REQUIREMENTS_DISCOVERY,
  context_facts: NEGATIVE_CONTEXT_FACTS,
};
