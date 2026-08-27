import type { ModelDecisionRequest, ModelDecisionResult, ModelProvider } from "../../src/core/agent/index.js";
import type { KnowledgeGapAnalysisResult, KnowledgeItem } from "../../src/intelligence/knowledge-gap-analysis/types.js";
import type { DeepResearchBatchResult } from "../../src/intelligence/deep-research/types.js";
import type {
  ArchitectureAlternativeAnalysis,
  ArchitectureDecisionDriver,
  ArchitectureDecisionRecord,
  ArchitectureDecisionStatus,
  ArchitectureDriverKind,
  ArchitectureFit,
  ArchitectureSecurityProfile,
  RejectedAlternativeReasons,
  SoftwareArchitectureDecisionResult,
  SoftwareArchitectureInput,
  UnresolvedDecisionGap,
} from "../../src/intelligence/software-architecture/types.js";
import { hardDrivers, mapSoftwareArchitectureResultToStructuredOutput } from "../../src/intelligence/software-architecture/validateSoftwareArchitectureResult.js";
import { renderArchitectureDecisionRecord } from "../../src/intelligence/software-architecture/renderArchitectureDecisionRecord.js";
import {
  SOFTWARE_ARCHITECTURE_INPUT_MARKER,
  SOFTWARE_ARCHITECTURE_SKILL_MATERIALIZATION_MARKER,
} from "../../src/intelligence/software-architecture/materializeSoftwareArchitectureTask.js";

/**
 * Canonical S13D kiosk-persistence fixture corpus.
 *
 * Implements brain-bootstrap/skills/SOFTWARE_ARCHITECTURE_SKILL_S13D.md
 * sections 22-28. Positive and negative fixtures share ONE architecture
 * context (Skill file section 24: "Use the same architecture context") — the
 * "negative fixture" is what the naive BASELINE arm produces on that same
 * input, not a second scenario. The `SKILL` synthesizer is a genuine
 * rule-based function that reads the actual decision drivers derived from
 * the input (never a canned answer): mutating C1's `blocking` flag in the
 * input measurably changes its output (T27/§28), and the BASELINE
 * synthesizer reproduces, verbatim, the canonical bad answer Skill file
 * section 24 describes ("Choose remote Postgres because it scales better and
 * is industry standard.") while structurally omitting the analysis that
 * answer is criticized for omitting.
 */

// ---------------------------------------------------------------------------
// Fixture-authored domain knowledge (legitimate test-harness knowledge, not
// hidden production logic — mirrors S13C's fixture-declared corpus/step
// plans). A real Agent run would derive this via model judgment; this
// deterministic ModelProvider stand-in encodes it explicitly instead.
// ---------------------------------------------------------------------------

const DRIVER_KIND_BY_ITEM_ID: Record<string, ArchitectureDriverKind> = {
  C1: "HARD_CONSTRAINT",
  C2: "HARD_CONSTRAINT",
  C3: "OPERATIONS",
  C4: "BUSINESS",
  C5: "COST",
  C6: "SECURITY",
  C7: "DELIVERY",
  C8: "HARD_CONSTRAINT",
};

/** C1 — offline capability. WEAK becomes FAIL only while C1 is a hard constraint. */
const OFFLINE_CAPABILITY: Record<string, ArchitectureFit> = { "ALT-A": "STRONG", "ALT-B": "WEAK", "ALT-C": "STRONG" };
/** C2 — power-loss durability. Fixed regardless of C1's hard/soft state. */
const DURABILITY_CAPABILITY: Record<string, ArchitectureFit> = { "ALT-A": "STRONG", "ALT-B": "ACCEPTABLE", "ALT-C": "WEAK" };
/** C8 — local printer flow independent of a remote round-trip. Never mutated. */
const PRINTER_LOCAL_CAPABILITY: Record<string, ArchitectureFit> = { "ALT-A": "STRONG", "ALT-B": "FAIL", "ALT-C": "STRONG" };

function evaluateC1Fit(hard: boolean, altId: string): ArchitectureFit {
  const capability = OFFLINE_CAPABILITY[altId] ?? "UNKNOWN";
  if (hard && capability === "WEAK") return "FAIL";
  return capability;
}

// ---------------------------------------------------------------------------
// KIOSK_KGA — S13B KnowledgeGapAnalysisResult fixture (the kiosk context).
// ---------------------------------------------------------------------------

function knownItem(partial: Pick<KnowledgeItem, "id" | "statement" | "decision_impact" | "blocking"> & { rationale?: string }): KnowledgeItem {
  return {
    id: partial.id,
    source_item_ref: `requirements.constraint.${partial.id.toLowerCase()}`,
    source_kind: "CONSTRAINT",
    statement: partial.statement,
    epistemic_status: "KNOWN",
    decision_impact: partial.decision_impact,
    closure_state: null,
    authority_refs: ["stakeholder-brief"],
    evidence_refs: [],
    assertion_refs: [],
    authority_sufficient: true,
    accepted_for_current_decision: true,
    blocking: partial.blocking,
    related_goal_ids: [],
    rationale: partial.rationale ?? `Stakeholder-provided operating condition for the kiosk architecture decision.`,
    limitations: [],
  };
}

export const KIOSK_ITEMS: KnowledgeItem[] = [
  knownItem({ id: "C1", statement: "The kiosk must complete the purchase/certificate workflow during WAN outages lasting up to 8 hours.", decision_impact: "DECISION_CRITICAL", blocking: true }),
  knownItem({ id: "C2", statement: "A sudden power loss must not corrupt an already-confirmed transaction.", decision_impact: "DECISION_CRITICAL", blocking: true }),
  knownItem({ id: "C3", statement: "One kiosk process writes locally at a time.", decision_impact: "CONTEXTUAL", blocking: false }),
  knownItem({ id: "C4", statement: "Expected annual volume is approximately 30,000 completed transactions per kiosk.", decision_impact: "DECISION_RELEVANT", blocking: false }),
  knownItem({ id: "C5", statement: "The store has a low operations budget and no dedicated database administrator.", decision_impact: "DECISION_RELEVANT", blocking: false }),
  knownItem({ id: "C6", statement: "Transactions include limited customer PII and must not be exposed through unnecessary network paths.", decision_impact: "DECISION_RELEVANT", blocking: false }),
  knownItem({ id: "C7", statement: "When connectivity returns, completed transactions must be synchronized to a central service.", decision_impact: "DECISION_RELEVANT", blocking: false }),
  knownItem({ id: "C8", statement: "The certificate printer is attached locally and the customer-facing flow must not depend on a remote round-trip.", decision_impact: "DECISION_CRITICAL", blocking: true }),
];

export const KIOSK_KGA: KnowledgeGapAnalysisResult = {
  source_request: "Kiosk offline-capable transaction persistence and synchronization architecture.",
  items: KIOSK_ITEMS,
  buckets: { known: KIOSK_ITEMS.map((i) => i.id), told: [], proven: [], assumed: [], needs_research: [], unknowable: [] },
  research_queue: [],
  handoff: { ready_for_deep_research: false, research_item_ids: [], decision_blockers: [], unknowable_item_ids: [], notes: "No NEEDS_RESEARCH items in the kiosk fixture." },
  decision_readiness_summary: "All operating constraints for the kiosk architecture decision are KNOWN from the stakeholder brief.",
};

export const KIOSK_ARCHITECTURE_QUESTION =
  "¿Cómo debe persistir y sincronizar transacciones un kiosco de tienda que debe seguir operando durante interrupciones de Internet?";

export const KIOSK_INPUT: SoftwareArchitectureInput = {
  architecture_question: KIOSK_ARCHITECTURE_QUESTION,
  knowledge_gap_analysis: KIOSK_KGA,
  candidate_alternatives: [
    { id: "ALT-A", name: "Local SQLite + transactional outbox sync", description: "Write transactions to a local SQLite database inside a transaction, then sync via a durable outbox once connectivity returns.", origin: "PROVIDED" },
    { id: "ALT-B", name: "Remote Postgres-only synchronous writes", description: "Every transaction writes synchronously to a central Postgres instance over the network.", origin: "PROVIDED" },
    { id: "ALT-C", name: "Local JSON files + periodic batch upload", description: "Append transactions to local JSON files and upload completed batches periodically.", origin: "PROVIDED" },
  ],
};

/** Mutated fixture (Skill file section 28 / Agent spec T27): C1 is no longer a hard constraint. */
export const KIOSK_INPUT_C1_SOFT: SoftwareArchitectureInput = {
  ...KIOSK_INPUT,
  knowledge_gap_analysis: {
    ...KIOSK_KGA,
    items: KIOSK_ITEMS.map((item) => (item.id === "C1" ? { ...item, blocking: false } : item)),
  },
};

/** T22 fixture: an unresolved DECISION_CRITICAL blocker relevant to the architecture question. */
const UNRESOLVED_BLOCKER_ITEM: KnowledgeItem = {
  id: "C9",
  source_item_ref: "requirements.constraint.c9",
  source_kind: "CONSTRAINT",
  statement: "Which data-residency regulation applies to storing customer PII locally on the kiosk versus centrally?",
  epistemic_status: "NEEDS_RESEARCH",
  decision_impact: "DECISION_CRITICAL",
  closure_state: null,
  authority_refs: [],
  evidence_refs: [],
  assertion_refs: [],
  authority_sufficient: false,
  accepted_for_current_decision: false,
  blocking: true,
  related_goal_ids: [],
  research_question: "Which data-residency regulation applies to storing customer PII locally on the kiosk versus centrally?",
  rationale: "The applicable data-residency regime materially affects whether local PII storage (ALT-A/ALT-C) is permissible.",
  limitations: [],
};

export const KIOSK_INPUT_WITH_UNRESOLVED_BLOCKER: SoftwareArchitectureInput = {
  ...KIOSK_INPUT,
  knowledge_gap_analysis: {
    ...KIOSK_KGA,
    items: [...KIOSK_ITEMS, UNRESOLVED_BLOCKER_ITEM],
    buckets: { ...KIOSK_KGA.buckets, needs_research: ["C9"] },
    research_queue: [{ knowledge_item_id: "C9", research_question: UNRESOLVED_BLOCKER_ITEM.research_question!, decision_impact: "DECISION_CRITICAL", blocking: true, why_research_matters: UNRESOLVED_BLOCKER_ITEM.rationale }],
    handoff: { ready_for_deep_research: true, research_item_ids: ["C9"], decision_blockers: ["C9"], unknowable_item_ids: [], notes: "C9 blocks a responsible architecture recommendation until researched." },
  },
};

// ---------------------------------------------------------------------------
// Minimal S13C compatibility fixtures (T11) — deliberately separate from the
// kiosk narrative, mirroring S13C's own T10-T12 unit-level fixture style.
// ---------------------------------------------------------------------------

const MINI_ITEM: KnowledgeItem = knownItem({ id: "X1", statement: "Minimal S13C-compatibility fixture item.", decision_impact: "DECISION_RELEVANT", blocking: false });
export const MINI_KGA: KnowledgeGapAnalysisResult = {
  source_request: "Minimal S13C-compatibility fixture.",
  items: [MINI_ITEM],
  buckets: { known: ["X1"], told: [], proven: [], assumed: [], needs_research: [], unknowable: [] },
  research_queue: [],
  handoff: { ready_for_deep_research: false, research_item_ids: [], decision_blockers: [], unknowable_item_ids: [], notes: "" },
  decision_readiness_summary: "Minimal fixture.",
};

/** Exported so tests can build a deep_research batch for any KGA item id (e.g. a kiosk item for T12). */
export function miniDeepResearchBatch(knowledgeItemId: string): DeepResearchBatchResult {
  return {
    source_request: "Minimal S13C-compatibility fixture.",
    queue_snapshot: [knowledgeItemId],
    selected_item_ids: [knowledgeItemId],
    deferred_item_ids: [],
    batch_status: "COMPLETE",
    decision_relevant_summary: "Minimal research result.",
    items: [
      {
        knowledge_item_id: knowledgeItemId,
        research_question: "Minimal research question.",
        decision_impact: "DECISION_RELEVANT",
        blocking: false,
        upstream_epistemic_status: "NEEDS_RESEARCH",
        upstream_closure_state: null,
        research: {
          question: "Minimal research question.",
          subquestions: [],
          findings: [],
          contradictions: [],
          unknowns: [],
          research_status: { state: "SATISFIED", reason: "Minimal fixture.", unresolved_decision_critical_gaps: [], additional_research_expected_to_change_decision: false },
          decision_relevant_summary: "Minimal research result.",
        },
        recommended_closure_state: "RESOLVED_WITH_EVIDENCE",
        closure_rationale: "Minimal fixture.",
        limitations: [],
      },
    ],
  };
}

/** Valid: every deep_research item resolves to a MINI_KGA item. */
export const MINI_DEEP_RESEARCH_VALID: DeepResearchBatchResult = miniDeepResearchBatch("X1");
/** Invalid: references a knowledge_item_id absent from MINI_KGA.items (T11 rejection case). */
export const MINI_DEEP_RESEARCH_INVALID: DeepResearchBatchResult = miniDeepResearchBatch("X-UNKNOWN");

// ---------------------------------------------------------------------------
// Shared, genuine (non-canned) computation — used by the SKILL synthesizer.
// ---------------------------------------------------------------------------

export function deriveDecisionDrivers(kga: KnowledgeGapAnalysisResult): ArchitectureDecisionDriver[] {
  return kga.items
    .filter((item) => DRIVER_KIND_BY_ITEM_ID[item.id])
    .map((item) => ({
      id: item.id,
      statement: item.statement,
      kind: DRIVER_KIND_BY_ITEM_ID[item.id],
      hard: item.decision_impact === "DECISION_CRITICAL" && item.blocking === true,
      source_refs: [...item.evidence_refs, ...item.authority_refs],
      rationale: item.rationale,
    }));
}

export function computeUnresolvedGaps(input: SoftwareArchitectureInput): UnresolvedDecisionGap[] {
  const resolvedIds = new Set(
    (input.deep_research?.items ?? []).filter((i) => i.research.research_status.state === "SATISFIED").map((i) => i.knowledge_item_id),
  );
  return input.knowledge_gap_analysis.items
    .filter((item) => item.decision_impact === "DECISION_CRITICAL" && item.blocking === true)
    .filter((item) => item.epistemic_status === "NEEDS_RESEARCH" || item.epistemic_status === "UNKNOWABLE")
    .filter((item) => !resolvedIds.has(item.id))
    .map((item) => ({ knowledge_item_id: item.id, reason: item.rationale, decision_impact: item.decision_impact }));
}

// ---------------------------------------------------------------------------
// Per-alternative fixture content (SKILL mode) — genuinely varied,
// architecture-specific detail, per Skill file section 23.
// ---------------------------------------------------------------------------

interface AltContent {
  benefits: string[];
  disadvantages: string[];
  failureModes: Array<{ scenario: string; trigger: string; impact: string; observable_symptom: string; mitigation_or_containment: string; residual_risk: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" }>;
  cost: { implementation_cost: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; ongoing_operational_cost: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; migration_or_exit_cost: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; cost_drivers: string[] };
  operations: { deployment_complexity: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; operator_burden: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; observability_notes: string[]; backup_recovery_notes: string[]; failure_handling_notes: string[] };
  security: ArchitectureSecurityProfile;
  reversibility: { reversibility: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"; migration_path: string; lock_in_factors: string[]; irreversible_or_costly_choices: string[] };
  assumptions: Array<{ id: string; statement: string; rationale: string; risk: "HIGH" | "MEDIUM" | "LOW"; must_validate: boolean }>;
}

const ALT_CONTENT: Record<string, AltContent> = {
  "ALT-A": {
    benefits: [
      "Works fully offline for the required 8-hour WAN outage window (C1)",
      "Local transactional writes protect against corruption on power loss (C2)",
      "Printer flow never depends on a remote round-trip (C8)",
    ],
    disadvantages: [
      "Requires implementing and maintaining an outbox sync mechanism",
      "Eventual-consistency window exists until the outbox drains after connectivity returns",
      "The local SQLite file must be protected and backed up per kiosk",
    ],
    failureModes: [
      { scenario: "Local SQLite database file corruption", trigger: "Disk-level fault or abrupt process kill mid-write", impact: "Local transaction history for the kiosk becomes unreadable", observable_symptom: "SQLite integrity check fails on next startup", mitigation_or_containment: "Write-ahead logging plus periodic integrity checks and local backup snapshots", residual_risk: "LOW" },
      { scenario: "Kiosk disk loss", trigger: "Physical disk failure", impact: "Unsynced local transactions since the last successful sync are lost", observable_symptom: "Kiosk fails to boot or the local database is missing", mitigation_or_containment: "Frequent outbox flush cadence bounds the loss window; printer receipt provides a paper fallback record", residual_risk: "MEDIUM" },
      { scenario: "Outbox sync conflict", trigger: "Two kiosks or a kiosk and a manual correction race on the same central record after reconnection", impact: "Central service may receive a duplicate or out-of-order transaction", observable_symptom: "Central service rejects or flags a duplicate transaction ID", mitigation_or_containment: "Idempotent sync keyed by a locally generated transaction UUID", residual_risk: "LOW" },
    ],
    cost: { implementation_cost: "MEDIUM", ongoing_operational_cost: "LOW", migration_or_exit_cost: "MEDIUM", cost_drivers: ["outbox sync mechanism development", "per-kiosk local storage management"] },
    operations: { deployment_complexity: "MEDIUM", operator_burden: "LOW", observability_notes: ["Local database health and outbox backlog depth can be monitored via the periodic sync job"], backup_recovery_notes: ["Local file backup plus outbox log allows replay after a recovery"], failure_handling_notes: ["Outbox retries queue transactions locally until connectivity returns, matching the low-DBA-budget constraint (C5)"] },
    security: {
      trust_boundaries: ["The local kiosk device is a distinct trust boundary from the central service"],
      sensitive_data_exposure: ["Local PII remains on the kiosk disk until synced, requiring disk-level protection rather than network-in-transit protection alone"],
      credential_or_secret_implications: ["Sync credentials for the outbox uploader must be stored securely on the kiosk device"],
      attack_surface_notes: ["WAN exposure is limited to the periodic outbox sync window rather than every transaction (reduces exposure versus ALT-B, per C6)"],
      security_tradeoffs: ["Reduced network exposure per-transaction trades against increased importance of physical/disk-level kiosk security"],
      unresolved_security_questions: ["Disk-encryption approach for the local SQLite file has not yet been decided"],
      evidence_refs: ["C6"],
    },
    reversibility: { reversibility: "MEDIUM", migration_path: "The outbox sync target can be swapped for a different central service without changing the local write path", lock_in_factors: ["SQLite file format", "outbox schema"], irreversible_or_costly_choices: [] },
    assumptions: [{ id: "AS-A1", statement: "Local kiosk disk capacity is sufficient to hold the outbox backlog for an 8-hour outage at expected volume (C4)", rationale: "No direct evidence of kiosk disk capacity was supplied in the bounded context", risk: "MEDIUM", must_validate: true }],
  },
  "ALT-B": {
    benefits: ["Central consistency with no local reconciliation logic needed", "Single source of truth simplifies backup and reporting"],
    disadvantages: ["Cannot complete transactions during WAN outages (C1)", "Customer-facing printer flow is blocked on remote round-trip latency and availability (C8)"],
    failureModes: [
      { scenario: "WAN outage prevents transaction completion", trigger: "Loss of Internet connectivity at the kiosk site", impact: "No purchase/certificate can be completed until connectivity is restored", observable_symptom: "Every write attempt times out or fails against the central Postgres instance", mitigation_or_containment: "UNKNOWN", residual_risk: "HIGH" },
    ],
    cost: { implementation_cost: "LOW", ongoing_operational_cost: "MEDIUM", migration_or_exit_cost: "LOW", cost_drivers: ["central Postgres instance operation without a dedicated DBA (C5)"] },
    operations: { deployment_complexity: "LOW", operator_burden: "MEDIUM", observability_notes: ["Central database can be monitored centrally"], backup_recovery_notes: ["Single central backup covers all kiosks"], failure_handling_notes: ["No local fallback exists during an outage; transactions simply block (C1)"] },
    security: {
      trust_boundaries: ["The kiosk is a thin client; the trust boundary is the WAN link to the central service on every transaction"],
      sensitive_data_exposure: ["Customer PII transits the WAN on every single transaction rather than only during periodic sync (C6)"],
      credential_or_secret_implications: ["Kiosk must hold live database credentials capable of writing every transaction"],
      attack_surface_notes: ["Constant WAN dependency increases the exposure window compared to a batched/periodic sync approach"],
      security_tradeoffs: ["Centralization simplifies auditing but maximizes per-transaction network exposure"],
      unresolved_security_questions: ["Network segmentation approach for kiosk-to-database traffic has not been decided"],
      evidence_refs: ["C6"],
    },
    reversibility: { reversibility: "HIGH", migration_path: "No local persistent state to migrate away from", lock_in_factors: [], irreversible_or_costly_choices: [] },
    assumptions: [],
  },
  "ALT-C": {
    benefits: ["Simple to implement with no local database engine dependency", "Works offline for the required window (C1)"],
    disadvantages: ["Materially higher risk of partial or corrupted writes on power loss than a transactional store (C2)", "Manual repair complexity for corrupted files", "Duplicate-upload risk during batch synchronization"],
    failureModes: [
      { scenario: "Partial write on power loss", trigger: "Power loss while a JSON file is being appended", impact: "The in-progress transaction record may be truncated or malformed", observable_symptom: "The local file fails to parse as valid JSON on next read", mitigation_or_containment: "Append-only writes with a trailing commit marker per record; unmarked records are treated as incomplete", residual_risk: "MEDIUM" },
      { scenario: "Local file corruption", trigger: "Disk-level fault", impact: "Some or all pending local transactions become unreadable", observable_symptom: "Parse failures across multiple records in the same file", mitigation_or_containment: "UNKNOWN", residual_risk: "HIGH" },
      { scenario: "Duplicate batch upload", trigger: "A batch upload partially succeeds and is retried", impact: "Some transactions may be recorded twice centrally", observable_symptom: "Central service receives the same transaction identifier twice", mitigation_or_containment: "Idempotent upload keyed by a locally generated transaction ID", residual_risk: "MEDIUM" },
    ],
    cost: { implementation_cost: "LOW", ongoing_operational_cost: "LOW", migration_or_exit_cost: "LOW", cost_drivers: ["manual repair effort for corrupted local files"] },
    operations: { deployment_complexity: "LOW", operator_burden: "MEDIUM", observability_notes: ["File parse failures are the primary observable signal"], backup_recovery_notes: ["Local files can be copied for backup but corrupted files require manual repair"], failure_handling_notes: ["No transactional guarantee on local writes; failure handling relies on manual intervention (raises operator burden versus the low-DBA-budget constraint, C5)"] },
    security: {
      trust_boundaries: ["The local kiosk device is a distinct trust boundary, same as ALT-A"],
      sensitive_data_exposure: ["Local PII remains in plaintext JSON files on the kiosk disk unless separately encrypted"],
      credential_or_secret_implications: ["Batch-upload credentials must be stored securely on-device"],
      attack_surface_notes: ["Reduced WAN exposure during the offline window, similar to ALT-A"],
      security_tradeoffs: ["Same reduced network exposure as ALT-A, but weaker local durability increases the risk window for exposed unsynced data"],
      unresolved_security_questions: ["Whether local JSON files require field-level PII encryption has not been decided"],
      evidence_refs: ["C6"],
    },
    reversibility: { reversibility: "HIGH", migration_path: "Local JSON files can be migrated to another format by a one-time batch conversion", lock_in_factors: [], irreversible_or_costly_choices: [] },
    assumptions: [{ id: "AS-C1", statement: "The expected transaction volume (C4) keeps individual JSON files small enough that parse/repair remains tractable", rationale: "No direct evidence of a volume threshold beyond which this becomes impractical was supplied", risk: "MEDIUM", must_validate: true }],
  },
};

function alternativeName(seedId: string): { name: string; description: string } {
  const seed = KIOSK_INPUT.candidate_alternatives!.find((s) => s.id === seedId)!;
  return { name: seed.name, description: seed.description };
}

function buildSkillAlternative(seedId: string, decisionDrivers: ArchitectureDecisionDriver[]): ArchitectureAlternativeAnalysis {
  const content = ALT_CONTENT[seedId];
  const { name, description } = alternativeName(seedId);
  const isC1Hard = decisionDrivers.find((d) => d.id === "C1")?.hard ?? false;

  const driver_evaluations = [
    { driver_id: "C1", fit: evaluateC1Fit(isC1Hard, seedId), rationale: `Offline capability assessment for ${seedId} against the ${isC1Hard ? "hard" : "soft"} WAN-outage constraint.`, evidence_refs: ["C1"], limitations: [] },
    { driver_id: "C2", fit: DURABILITY_CAPABILITY[seedId] ?? "UNKNOWN", rationale: `Power-loss durability assessment for ${seedId}.`, evidence_refs: ["C2"], limitations: [] },
    { driver_id: "C8", fit: PRINTER_LOCAL_CAPABILITY[seedId] ?? "UNKNOWN", rationale: `Local printer round-trip independence assessment for ${seedId}.`, evidence_refs: ["C8"], limitations: [] },
  ].filter((e) => decisionDrivers.some((d) => d.id === e.driver_id));

  return {
    id: seedId,
    name,
    description,
    origin: "PROVIDED",
    driver_evaluations,
    benefits: content.benefits,
    disadvantages: content.disadvantages,
    failure_modes: content.failureModes.map((fm, i) => ({ id: `FM-${seedId}-${i + 1}`, alternative_id: seedId, ...fm, evidence_refs: [] })),
    cost: { ...content.cost, limitations: [] },
    operations: { ...content.operations, limitations: [] },
    security: content.security,
    reversibility: { ...content.reversibility, limitations: [] },
    evidence_refs: ["C1", "C2", "C8"],
    assumptions: content.assumptions.map((a) => ({ ...a, source_refs: [] })),
  };
}

function scoreAlternative(alt: ArchitectureAlternativeAnalysis): number {
  const weight: Record<ArchitectureFit, number> = { STRONG: 2, ACCEPTABLE: 1, WEAK: -1, FAIL: -100, UNKNOWN: 0 };
  return alt.driver_evaluations.reduce((sum, e) => sum + weight[e.fit], 0);
}

function buildAdr(
  input: SoftwareArchitectureInput,
  decisionDrivers: ArchitectureDecisionDriver[],
  alternatives: ArchitectureAlternativeAnalysis[],
  decisionStatus: ArchitectureDecisionStatus,
  recommendedId: string | null,
  recommendationSummary: string,
  rejectedReasons: RejectedAlternativeReasons[],
  unresolvedGaps: UnresolvedDecisionGap[],
): ArchitectureDecisionRecord {
  const recommended = recommendedId ? alternatives.find((a) => a.id === recommendedId) : undefined;
  return {
    id: "ADR-S13D-1",
    title: input.architecture_question,
    status: "PROPOSED",
    decision_question: input.architecture_question,
    context: `Kiosk architecture decision with ${decisionDrivers.length} identified decision drivers (${hardDrivers(decisionDrivers).length} hard constraints).`,
    decision_drivers: decisionDrivers,
    alternatives_considered: alternatives.map((a) => `${a.id}: ${a.name}`),
    decision: recommended ? `Adopt ${recommended.name}.` : "No alternative is recommended at this time.",
    selected_alternative_id: recommendedId,
    rationale: recommendationSummary,
    positive_consequences: recommended?.benefits ?? [],
    negative_consequences: recommended?.disadvantages ?? [],
    failure_modes: recommended?.failure_modes ?? alternatives.flatMap((a) => a.failure_modes),
    cost_considerations: recommended ? [`implementation: ${recommended.cost.implementation_cost}`, `ongoing: ${recommended.cost.ongoing_operational_cost}`, `migration/exit: ${recommended.cost.migration_or_exit_cost}`] : [],
    operational_considerations: recommended ? [...recommended.operations.observability_notes, ...recommended.operations.backup_recovery_notes, ...recommended.operations.failure_handling_notes] : [],
    security_considerations: recommended ? [...recommended.security.sensitive_data_exposure, ...recommended.security.security_tradeoffs] : [],
    evidence_refs: recommended?.evidence_refs ?? [],
    assumptions: recommended?.assumptions ?? [],
    unresolved_questions: [...(recommended?.security.unresolved_security_questions ?? []), ...unresolvedGaps.map((g) => g.reason)],
    approval_required: true,
    approval_note: "This ADR is a proposed architecture decision. Human approval is required before it is treated as accepted or used as durable architectural authority.",
  };
}

/** Genuine, rule-based SKILL synthesis — reads decision drivers/alternatives from the actual input. */
export function synthesizeSkillArchitectureResult(input: SoftwareArchitectureInput): SoftwareArchitectureDecisionResult {
  const decisionDrivers = deriveDecisionDrivers(input.knowledge_gap_analysis);
  const hardIds = hardDrivers(decisionDrivers).map((d) => d.id);
  const seedIds = (input.candidate_alternatives ?? []).map((s) => s.id);
  const alternatives = seedIds.map((id) => buildSkillAlternative(id, decisionDrivers));
  const unresolvedGaps = computeUnresolvedGaps(input);

  const hasFail = (alt: ArchitectureAlternativeAnalysis) => hardIds.some((id) => alt.driver_evaluations.find((e) => e.driver_id === id)?.fit === "FAIL");
  const viable = alternatives.filter((a) => !hasFail(a));

  let decisionStatus: ArchitectureDecisionStatus;
  if (unresolvedGaps.length > 0) decisionStatus = "NEEDS_MORE_EVIDENCE";
  else if (viable.length === 0) decisionStatus = "BLOCKED";
  else decisionStatus = "READY_FOR_HUMAN_APPROVAL";

  let recommendedId: string | null = null;
  let recommendationSummary: string;
  let rejectedReasons: RejectedAlternativeReasons[] = [];

  if (decisionStatus === "READY_FOR_HUMAN_APPROVAL") {
    const scored = [...viable].sort((a, b) => scoreAlternative(b) - scoreAlternative(a) || a.id.localeCompare(b.id));
    const winner = scored[0];
    recommendedId = winner.id;
    recommendationSummary = `${winner.id} (${winner.name}) is recommended: it satisfies every hard constraint with the strongest overall fit among the compared alternatives.`;
    rejectedReasons = alternatives
      .filter((a) => a.id !== recommendedId)
      .map((a) => {
        const reasons: string[] = [];
        for (const id of hardIds) {
          const evaluation = a.driver_evaluations.find((e) => e.driver_id === id);
          if (evaluation?.fit === "FAIL") {
            const driver = decisionDrivers.find((d) => d.id === id)!;
            reasons.push(`Violates hard constraint ${id}: ${driver.statement}`);
          }
        }
        if (reasons.length === 0) {
          reasons.push(`${winner.id} has a stronger overall fit across the compared decision drivers than ${a.id}.`);
        }
        return { alternative_id: a.id, reasons };
      });
  } else if (decisionStatus === "NEEDS_MORE_EVIDENCE") {
    recommendationSummary = `Additional evidence is required before responsibly recommending an alternative for: ${input.architecture_question}`;
  } else {
    recommendationSummary = "The architecture decision cannot currently be evaluated responsibly: every candidate alternative violates a hard constraint.";
  }

  const adr = buildAdr(input, decisionDrivers, alternatives, decisionStatus, recommendedId, recommendationSummary, rejectedReasons, unresolvedGaps);

  return {
    architecture_question: input.architecture_question,
    decision_status: decisionStatus,
    decision_drivers: decisionDrivers,
    alternatives,
    recommended_alternative_id: recommendedId,
    recommendation_summary: recommendationSummary,
    rejected_alternative_reasons: rejectedReasons,
    unresolved_decision_gaps: unresolvedGaps,
    adr,
    adr_markdown: renderArchitectureDecisionRecord(adr),
  };
}

/**
 * Genuine (input-derived, never a hardcoded constant) BASELINE synthesis —
 * reproduces, structurally, the canonical bad answer Skill file section 24
 * describes: recommends ALT-B, ignores the offline hard constraint, performs
 * no real driver evaluation, compares no other alternative, and uses generic
 * security boilerplate. It still mechanically derives decision_drivers (a
 * cheap parse step, not the Skill's value-add — see
 * ./validateSoftwareArchitectureResult.js's docstring for why the validator
 * cannot be fooled by a result that simply omits evaluations) and reports a
 * structurally correct ADR status, since those are type-contract mechanics,
 * not analytical judgment.
 */
export function synthesizeBaselineArchitectureResult(input: SoftwareArchitectureInput): SoftwareArchitectureDecisionResult {
  const decisionDrivers = deriveDecisionDrivers(input.knowledge_gap_analysis);
  const altBSeed = (input.candidate_alternatives ?? []).find((s) => s.id === "ALT-B");

  const altB: ArchitectureAlternativeAnalysis | null = altBSeed
    ? {
        id: "ALT-B",
        name: altBSeed.name,
        description: altBSeed.description,
        origin: "PROVIDED",
        driver_evaluations: [],
        benefits: ["Scales better", "Industry standard"],
        disadvantages: [],
        failure_modes: [],
        cost: { implementation_cost: "UNKNOWN", ongoing_operational_cost: "UNKNOWN", migration_or_exit_cost: "UNKNOWN", cost_drivers: [], limitations: [] },
        operations: { deployment_complexity: "UNKNOWN", operator_burden: "UNKNOWN", observability_notes: [], backup_recovery_notes: [], failure_handling_notes: [], limitations: [] },
        security: { trust_boundaries: [], sensitive_data_exposure: [], credential_or_secret_implications: [], attack_surface_notes: ["use encryption", "use best practices"], security_tradeoffs: [], unresolved_security_questions: [], evidence_refs: [] },
        reversibility: { reversibility: "UNKNOWN", migration_path: "", lock_in_factors: [], irreversible_or_costly_choices: [], limitations: [] },
        evidence_refs: [],
        assumptions: [],
      }
    : null;

  const alternatives = altB ? [altB] : [];
  const recommendationSummary = "Choose remote Postgres because it scales better and is industry standard.";

  const adr = buildAdr(input, decisionDrivers, alternatives, "READY_FOR_HUMAN_APPROVAL", altB?.id ?? null, recommendationSummary, [], []);

  return {
    architecture_question: input.architecture_question,
    decision_status: "READY_FOR_HUMAN_APPROVAL",
    decision_drivers: decisionDrivers,
    alternatives,
    recommended_alternative_id: altB?.id ?? null,
    recommendation_summary: recommendationSummary,
    rejected_alternative_reasons: [],
    unresolved_decision_gaps: [],
    adr,
    adr_markdown: renderArchitectureDecisionRecord(adr),
  };
}

// ---------------------------------------------------------------------------
// Deterministic ModelProvider — always FINISHes on the first turn (S13D
// issues no tool calls; zero capabilities). Branches purely on whether the
// materialized objective contains the SKILL_ID marker.
// ---------------------------------------------------------------------------

function extractArchitectureInput(goalText: string): SoftwareArchitectureInput {
  const markerIndex = goalText.indexOf(SOFTWARE_ARCHITECTURE_INPUT_MARKER);
  if (markerIndex === -1) throw new Error("DeterministicSoftwareArchitectureModelProvider: input marker not found in goal text.");
  const afterMarker = goalText.slice(markerIndex + SOFTWARE_ARCHITECTURE_INPUT_MARKER.length).trim();
  const jsonEnd = afterMarker.indexOf("\n\n");
  const jsonText = jsonEnd === -1 ? afterMarker : afterMarker.slice(0, jsonEnd);
  return JSON.parse(jsonText) as SoftwareArchitectureInput;
}

export class DeterministicSoftwareArchitectureModelProvider implements ModelProvider {
  async decide(request: ModelDecisionRequest): Promise<ModelDecisionResult> {
    const goalText = request.goal.statement;
    const input = extractArchitectureInput(goalText);
    const skillMode = goalText.includes(SOFTWARE_ARCHITECTURE_SKILL_MATERIALIZATION_MARKER);

    const result = skillMode ? synthesizeSkillArchitectureResult(input) : synthesizeBaselineArchitectureResult(input);

    return {
      status: "SUCCESS",
      decision: {
        type: "FINISH",
        rationale: skillMode
          ? "Applied the materialized Software Architecture Skill rules/procedure to the input."
          : "No Skill was materialized for this task; produced a naive best-effort recommendation.",
        output: mapSoftwareArchitectureResultToStructuredOutput(result),
      },
    };
  }
}
