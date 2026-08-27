import type { ArchitectureDecisionRecord } from "./types.js";

/**
 * Deterministic Markdown ADR renderer.
 *
 * Implements brain-bootstrap/skills/SOFTWARE_ARCHITECTURE_SKILL_S13D.md
 * section 19 (canonical section order) and SA-R23/SA-V10 — the Markdown is
 * rendered purely from the structured ArchitectureDecisionRecord fields and
 * must never introduce a semantic claim absent from that structured object.
 */

function bulletList(items: readonly string[]): string {
  if (items.length === 0) return "_None recorded._";
  return items.map((item) => `- ${item}`).join("\n");
}

export function renderArchitectureDecisionRecord(adr: ArchitectureDecisionRecord): string {
  const lines: string[] = [];

  lines.push(`# ADR: ${adr.title}`, "");
  lines.push("## Status", "", adr.status, "");
  lines.push("## Context", "", adr.context, "");
  lines.push("## Decision Drivers", "");
  lines.push(
    adr.decision_drivers.length === 0
      ? "_None recorded._"
      : adr.decision_drivers
          .map((d) => `- **${d.id}** [${d.kind}${d.hard ? ", HARD" : ""}]: ${d.statement}`)
          .join("\n"),
  );
  lines.push("");
  lines.push("## Alternatives Considered", "", bulletList(adr.alternatives_considered), "");
  lines.push("## Decision", "", adr.decision, "");
  lines.push("## Rationale", "", adr.rationale, "");
  lines.push("## Consequences", "");
  lines.push("### Positive", "", bulletList(adr.positive_consequences), "");
  lines.push("### Negative", "", bulletList(adr.negative_consequences), "");
  lines.push("## Failure Modes", "");
  lines.push(
    adr.failure_modes.length === 0
      ? "_None recorded._"
      : adr.failure_modes
          .map(
            (fm) =>
              `- **${fm.id}** (${fm.alternative_id}): ${fm.scenario} — trigger: ${fm.trigger}; impact: ${fm.impact}; ` +
              `observable: ${fm.observable_symptom}; mitigation: ${fm.mitigation_or_containment}; residual risk: ${fm.residual_risk}`,
          )
          .join("\n"),
  );
  lines.push("");
  lines.push("## Cost", "", bulletList(adr.cost_considerations), "");
  lines.push("## Operations", "", bulletList(adr.operational_considerations), "");
  lines.push("## Security", "", bulletList(adr.security_considerations), "");
  lines.push("## Evidence", "", bulletList(adr.evidence_refs), "");
  lines.push("## Assumptions", "");
  lines.push(
    adr.assumptions.length === 0
      ? "_None recorded._"
      : adr.assumptions.map((a) => `- **${a.id}** [risk: ${a.risk}]: ${a.statement} — ${a.rationale}`).join("\n"),
  );
  lines.push("");
  lines.push("## Open Questions", "", bulletList(adr.unresolved_questions), "");
  lines.push("## Approval", "", `approval_required: ${adr.approval_required}`, "", adr.approval_note, "");

  return lines.join("\n");
}
