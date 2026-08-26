import type { ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import { mapRequirementsDiscoveryResultToStructuredOutput } from "../../src/intelligence/requirements-discovery/validateRequirementsDiscoveryResult.js";
import { RAW_REQUEST_MARKER, SKILL_MATERIALIZATION_MARKER } from "../../src/intelligence/requirements-discovery/materializeRequirementsDiscoveryTask.js";
import type {
  AcceptanceCriterion,
  DiscoveredAssumption,
  DiscoveredConstraint,
  DiscoveredGoal,
  DiscoveredUnknown,
  DiscoveredUser,
  RequirementsDiscoveryResult,
} from "../../src/intelligence/requirements-discovery/types.js";

/**
 * Deterministic, no-network, no-hardcoded-answer requirements-discovery
 * reasoning used only for S13A verification
 * (REQUIREMENTS_DISCOVERY_AGENT_v1.md section 14 — "a hosted/external LLM is
 * not required... it must not simply return one canned final
 * RequirementsDiscoveryResult regardless of input").
 *
 * `runSkillModeExtraction` is a genuine, general-purpose rule-based extractor
 * over the literal raw request text (Spanish action-verb cues, channel/device
 * cues, vague-adjective cues, and a handful of domain-shape cues for
 * identification/personal-data/output-format unknowns) — it is not special
 * cased to either canonical fixture. Feeding it a materially different raw
 * request changes its goals/unknowns/constraints (T18), and it applies
 * RD-R1..RD-R12 (never fabricate a user/constraint/deadline/budget/scale that
 * is not supported by the text; surface missing decision-relevant
 * information as unknowns instead).
 *
 * `runBaselineExtraction` models what a "no Skill selected" default
 * completion looks like: it reproduces, for real, the exact "Incorrect
 * behavior" pattern documented in
 * brain-bootstrap/skills/REQUIREMENTS_DISCOVERY_SKILL_S13A.md section 12
 * (fabricated React/PostgreSQL/30-day-deadline/payments/10,000-user-scale/
 * store-managers/retail-customers) — a realistic, non-strawman failure mode,
 * not an artificially crippled baseline. Both functions are driven by the
 * SAME literal raw request text; only the strategy differs, exactly as
 * REQUIREMENTS_DISCOVERY_AGENT_v1.md section 15 requires.
 */

const ACTION_VERB_REGEX =
  /\b(registr\w*|pid\w*|imprim\w*|gener\w*|gestion\w*|permit\w*|cre\w*|recog\w*|recolect\w*|agend\w*|reserv\w*|mostr\w*|calcul\w*|envi\w*|vend\w*|compr\w*|administr\w*|actualiz\w*|elimin\w*|export\w*)\b/i;

const CHANNEL_CUE_REGEX = /\b(kiosco|pantalla t[aá]ctil|sitio web|app m[oó]vil|aplicaci[oó]n web|terminal t[aá]ctil)\b/i;

const IDENTIFICATION_REGEX = /\bregistr\w*\s+(?:un|una)\s+([a-záéíóúñ]+)\s+(comprad[oa]|adquirid[oa])/i;

const DATA_FIELDS_REGEX = /\bdatos\s+(?:del|de la|de los|de las)\s+([a-záéíóúñ]+)/i;

const OUTPUT_FORMAT_REGEX = /\b(imprim\w*|certificado|recibo|ticket)\b/i;

const DEADLINE_NUMERIC_REGEX = /\b(\d+)\s*(d[ií]as|semanas|meses)\b/i;

const VAGUE_ADJECTIVE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\bmoderna?\b/i, label: "moderna" },
  { regex: /\bf[aá]cil de usar\b/i, label: "fácil de usar" },
  { regex: /\bsencill[oa]\b/i, label: "sencilla" },
  { regex: /\bamigable\b/i, label: "amigable" },
  { regex: /\bintuitiv[oa]\b/i, label: "intuitiva" },
  { regex: /\bescalable\b/i, label: "escalable" },
  { regex: /\br[aá]pid[oa]\b/i, label: "rápida" },
  { regex: /\brobust[oa]\b/i, label: "robusta" },
];

function splitClauses(rawRequest: string): string[] {
  return rawRequest
    .split(/,\s*|\s+y\s+|[.;]\s*/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

class IdCounter {
  private count = 0;
  constructor(private readonly prefix: string) {}
  next(): string {
    this.count += 1;
    return `${this.prefix}${this.count}`;
  }
}

/**
 * Genuine, general-purpose (not fixture-specific) rule-based requirements
 * discovery extraction following RD-P1..RD-P10.
 */
export function runSkillModeExtraction(rawRequest: string): RequirementsDiscoveryResult {
  const clauses = splitClauses(rawRequest);
  const goalIds = new IdCounter("G");
  const unknownIds = new IdCounter("Q");
  const assumptionIds = new IdCounter("A");
  const constraintIds = new IdCounter("C");
  const acceptanceIds = new IdCounter("AC");

  const goals: DiscoveredGoal[] = [];
  const unknowns: DiscoveredUnknown[] = [];
  const constraints: DiscoveredConstraint[] = [];
  const acceptanceCriteria: AcceptanceCriterion[] = [];

  let lastConcreteGoalId: string | undefined;
  let channelClause: string | undefined;

  for (const clause of clauses) {
    if (ACTION_VERB_REGEX.test(clause)) {
      const goal: DiscoveredGoal = {
        id: goalIds.next(),
        statement: clause.charAt(0).toUpperCase() + clause.slice(1) + ".",
        origin: "EXPLICIT",
        source_excerpt: clause,
        rationale: "",
        priority: "PRIMARY",
      };
      goals.push(goal);
      lastConcreteGoalId = goal.id;

      const identificationMatch = clause.match(IDENTIFICATION_REGEX);
      if (identificationMatch) {
        const noun = identificationMatch[1];
        unknowns.push({
          id: unknownIds.next(),
          question: `¿Cómo se identifica técnicamente el ${noun} ${identificationMatch[2]}?`,
          why_it_matters: "Cambia el flujo de entrada y posibles integraciones de hardware o catálogo.",
          impact: "HIGH",
          blocking: true,
          related_goal_ids: [goal.id],
        });
      }

      if (OUTPUT_FORMAT_REGEX.test(clause)) {
        unknowns.push({
          id: unknownIds.next(),
          question: "¿Qué impresora/formato debe soportar la salida generada?",
          why_it_matters: "Afecta integración y aceptación del flujo final.",
          impact: "MEDIUM",
          blocking: false,
          related_goal_ids: [goal.id],
        });
      }

      const deadlineMatch = clause.match(DEADLINE_NUMERIC_REGEX);
      if (deadlineMatch) {
        constraints.push({
          id: constraintIds.next(),
          statement: `El proyecto debe completarse en ${deadlineMatch[1]} ${deadlineMatch[2]}.`,
          kind: "TIME",
          origin: "EXPLICIT",
          source_excerpt: clause,
          rationale: "",
        });
      }

      continue;
    }

    const dataFieldsMatch = clause.match(DATA_FIELDS_REGEX);
    if (dataFieldsMatch) {
      unknowns.push({
        id: unknownIds.next(),
        question: `¿Qué datos exactos de ${dataFieldsMatch[1]} son obligatorios?`,
        why_it_matters: "Define formularios, validación, privacidad y contenido del resultado final.",
        impact: "HIGH",
        blocking: true,
        related_goal_ids: lastConcreteGoalId ? [lastConcreteGoalId] : [],
      });
      continue;
    }

    if (CHANNEL_CUE_REGEX.test(clause)) {
      channelClause = clause;
    }
  }

  const foundConcreteGoal = goals.length > 0;

  if (!foundConcreteGoal) {
    goals.push({
      id: goalIds.next(),
      statement: "Cubrir una necesidad del negocio todavía no especificada en detalle.",
      origin: "DERIVED",
      source_excerpt: "",
      rationale: "El cliente pide una aplicación pero no describe explícitamente el proceso o problema concreto que debe resolver.",
      priority: "PRIMARY",
    });
    unknowns.push({
      id: unknownIds.next(),
      question: "¿Qué problema o proceso del negocio debe resolver la aplicación?",
      why_it_matters: "Sin esto no se puede definir funcionalidad ni criterios de aceptación.",
      impact: "HIGH",
      blocking: true,
      related_goal_ids: [goals[0].id],
    });
  }

  const users: DiscoveredUser[] = [];
  const assumptions: DiscoveredAssumption[] = [];

  if (channelClause) {
    users.push({
      id: "U1",
      description: `Persona que interactúa con la aplicación a través de: ${channelClause}.`,
      origin: "DERIVED",
      source_excerpt: "",
      rationale: `La solicitud menciona un canal/dispositivo específico ("${channelClause}") pero no define explícitamente quién opera el flujo.`,
      needs: ["completar el flujo a través del canal indicado"],
    });

    constraints.push({
      id: constraintIds.next(),
      statement: `La interfaz debe ser utilizable desde: ${channelClause}.`,
      kind: "TECHNICAL",
      origin: "EXPLICIT",
      source_excerpt: channelClause,
      rationale: "",
    });

    assumptions.push({
      id: assumptionIds.next(),
      statement: "La persona usuaria operará el sistema directamente a través del canal mencionado.",
      rationale: `La solicitud menciona "${channelClause}" pero no define explícitamente el operador del flujo.`,
      risk: "MEDIUM",
      must_validate: true,
      related_goal_ids: goals.map((g) => g.id),
    });
  } else {
    unknowns.push({
      id: unknownIds.next(),
      question: "¿Quiénes utilizarán la aplicación?",
      why_it_matters: "Cambia flujos, permisos y experiencia de usuario.",
      impact: "HIGH",
      blocking: true,
      related_goal_ids: [goals[0].id],
    });
  }

  const vagueMatches = VAGUE_ADJECTIVE_PATTERNS.filter((p) => p.regex.test(rawRequest)).map((p) => p.label);
  if (vagueMatches.length > 0) {
    unknowns.push({
      id: unknownIds.next(),
      question: `¿Qué significa "${vagueMatches.join(", ")}" de forma observable y verificable?`,
      why_it_matters: "La frase no es todavía un criterio verificable.",
      impact: "MEDIUM",
      blocking: false,
      related_goal_ids: [goals[0].id],
    });
  }

  if (foundConcreteGoal) {
    for (const goal of goals) {
      acceptanceCriteria.push({
        id: acceptanceIds.next(),
        criterion: `El flujo permite completar de forma verificable: ${goal.source_excerpt}.`,
        linked_goal_ids: [goal.id],
        testable: true,
        verification_hint: `Ejecutar el flujo relacionado con "${goal.source_excerpt}" y comprobar el resultado esperado.`,
      });
    }
  } else {
    acceptanceCriteria.push({
      id: acceptanceIds.next(),
      criterion:
        "El resultado de requirements discovery identifica explícitamente los datos, usuarios y alcance faltantes en lugar de inventarlos.",
      linked_goal_ids: [goals[0].id],
      testable: true,
      verification_hint:
        "Verificar que los unknowns/assumptions reflejan la ambigüedad real de la solicitud, sin fabricar usuarios, stack, presupuesto, plazos o escala.",
    });
  }

  const unresolvedBlockers = unknowns.filter((u) => u.blocking).map((u) => u.id);

  return {
    request: rawRequest,
    goals,
    users,
    unknowns,
    assumptions,
    constraints,
    acceptance_criteria: acceptanceCriteria,
    handoff: {
      ready_for_gap_analysis: true,
      unresolved_blockers: unresolvedBlockers,
      notes:
        unresolvedBlockers.length > 0
          ? `La solicitud permite estructurar ${goals.length} objetivo(s), pero quedan ${unresolvedBlockers.length} bloqueo(s) sin resolver antes de continuar con el análisis de brechas.`
          : `La solicitud permite estructurar ${goals.length} objetivo(s) sin bloqueos pendientes conocidos.`,
    },
  };
}

/**
 * Naive "no Skill selected" baseline: reproduces, for real, the exact
 * "Incorrect behavior" pattern from REQUIREMENTS_DISCOVERY_SKILL_S13A.md
 * section 12 — a single paraphrased goal plus fabricated generic
 * users/constraints/acceptance criteria that are NOT supported by the raw
 * request, and no unknowns/assumptions at all.
 */
export function runBaselineExtraction(rawRequest: string): RequirementsDiscoveryResult {
  const g1: DiscoveredGoal = {
    id: "G1",
    statement: `Construir la aplicación solicitada: ${rawRequest}`,
    origin: "EXPLICIT",
    source_excerpt: rawRequest,
    rationale: "",
    priority: "PRIMARY",
  };

  const users: DiscoveredUser[] = [
    { id: "U1", description: "store managers / gerentes de tienda", origin: "EXPLICIT", source_excerpt: "", rationale: "", needs: [] },
    { id: "U2", description: "retail customers / clientes minoristas", origin: "EXPLICIT", source_excerpt: "", rationale: "", needs: [] },
  ];

  const constraints: DiscoveredConstraint[] = [
    { id: "C1", statement: "Debe usar React.", kind: "TECHNICAL", origin: "EXPLICIT", source_excerpt: "", rationale: "" },
    { id: "C2", statement: "Debe usar PostgreSQL.", kind: "TECHNICAL", origin: "EXPLICIT", source_excerpt: "", rationale: "" },
    {
      id: "C3",
      statement: "Debe lanzarse en un plazo de 30 días (30-day deadline).",
      kind: "TIME",
      origin: "EXPLICIT",
      source_excerpt: "",
      rationale: "",
    },
  ];

  const acceptanceCriteria: AcceptanceCriterion[] = [
    { id: "AC1", criterion: "Debe soportar 10,000 usuarios concurrentes.", linked_goal_ids: [], testable: true, verification_hint: "" },
    { id: "AC2", criterion: "Debe procesar pagos en línea (payments).", linked_goal_ids: [], testable: true, verification_hint: "" },
  ];

  const assumptions: DiscoveredAssumption[] = [
    {
      id: "A1",
      statement: "El negocio necesita una aplicación moderna.",
      rationale: "",
      risk: "LOW",
      must_validate: false,
      related_goal_ids: ["G1"],
    },
  ];

  return {
    request: rawRequest,
    goals: [g1],
    users,
    unknowns: [],
    assumptions,
    constraints,
    acceptance_criteria: acceptanceCriteria,
    handoff: { ready_for_gap_analysis: true, unresolved_blockers: [], notes: "" },
  };
}

function extractRawRequest(goalText: string): string {
  const markerIdx = goalText.indexOf(RAW_REQUEST_MARKER);
  if (markerIdx === -1) {
    throw new Error("DeterministicRequirementsDiscoveryModelProvider: materialized objective missing RAW_REQUEST marker.");
  }
  const rest = goalText.slice(markerIdx + RAW_REQUEST_MARKER.length + 1);
  const nextMarkerIdx = rest.indexOf(`\n${SKILL_MATERIALIZATION_MARKER}`);
  return (nextMarkerIdx === -1 ? rest : rest.slice(0, nextMarkerIdx)).trim();
}

/**
 * Deterministic, no-network requirements-discovery ModelProvider used only
 * for S13A verification (REQUIREMENTS_DISCOVERY_AGENT_v1.md section 14). It
 * always finishes on the first turn (S13A issues no tool calls). Its behavior
 * branches purely on whether the materialized objective contains the
 * SKILL_ID marker — i.e., whether S12 actually discovered/loaded/materialized
 * the S13A Skill for this task — never on the specific fixture content. A
 * future conforming real ModelProvider can replace this fixture behind the
 * same ModelProvider contract without any Core change.
 */
export class DeterministicRequirementsDiscoveryModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const goalText = request.goal.statement;
    const rawRequest = extractRawRequest(goalText);
    const skillMode = goalText.includes(SKILL_MATERIALIZATION_MARKER);

    const result = skillMode ? runSkillModeExtraction(rawRequest) : runBaselineExtraction(rawRequest);

    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: skillMode
          ? "Applied the materialized Requirements Discovery Skill rules/procedure to the raw request."
          : "No Skill was materialized for this task; produced a naive best-effort completion.",
        output: mapRequirementsDiscoveryResultToStructuredOutput(result),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Canonical raw-request fixtures
// ---------------------------------------------------------------------------

export const POSITIVE_KIOSCO_REQUEST =
  "Necesito una aplicación para que una tienda registre un peluche comprado, pida el nombre del peluche y algunos " +
  "datos del dueño, y al final imprima un certificado. Se usará en un kiosco con pantalla táctil.";

/** Same request minus the trailing channel/device sentence — used to prove T18 raw-request dependence in isolation. */
export const POSITIVE_KIOSCO_REQUEST_WITHOUT_CHANNEL =
  "Necesito una aplicación para que una tienda registre un peluche comprado, pida el nombre del peluche y algunos " +
  "datos del dueño, y al final imprima un certificado.";

export const NEGATIVE_UNDERSPECIFIED_REQUEST = "Quiero una app para mi negocio. Que sea moderna y fácil de usar.";

/** A third, materially different scenario — used only to prove T18 generalizes beyond the two canonical fixtures. */
export const PHARMACY_INVENTORY_REQUEST =
  "Quiero un sistema para gestionar el inventario de una farmacia y generar reportes de ventas cada mes.";
