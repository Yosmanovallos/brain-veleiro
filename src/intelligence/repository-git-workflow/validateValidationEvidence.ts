import type {
  RepositoryGitWorkflowInput,
  ValidationGateResult,
  ValidationPhase,
} from "./types.js";

/**
 * Brain — S13H validation gate (contract §9, §10; Skill R15/R16; HI-017 /
 * HI-018 / HI-019).
 *
 * S13H NEVER invents project-specific QA commands. It consumes the caller's
 * RepositoryValidationRequirement[] and RepositoryValidationEvidence[], and:
 *   - a required check with no evidence            -> missing
 *   - a required check whose evidence is FAIL      -> failed
 *   - a required check whose evidence fingerprint  -> stale
 *     != input.current_repository_fingerprint
 * Any of missing / failed / stale for the relevant phase(s) -> gate FAIL.
 */

/** Requirement ids relevant to a requested action. COMMIT needs BEFORE_COMMIT;
 * PUSH needs BEFORE_COMMIT + BEFORE_PUSH. */
export function phasesForAction(action: string): ValidationPhase[] {
  if (action === "PUSH" || action === "REMOTE_REVIEW") return ["BEFORE_COMMIT", "BEFORE_PUSH"];
  if (action === "COMMIT" || action === "STAGE") return ["BEFORE_COMMIT"];
  return [];
}

export function evaluateValidationGate(
  input: RepositoryGitWorkflowInput,
  phases: readonly ValidationPhase[],
): ValidationGateResult {
  const relevant = input.validation_requirements.filter((r) => phases.includes(r.phase));
  const evidenceByReq = new Map<string, (typeof input.validation_evidence)[number]>();
  for (const e of input.validation_evidence) evidenceByReq.set(e.requirement_id, e);

  const missing_requirement_ids: string[] = [];
  const failed_requirement_ids: string[] = [];
  const stale_requirement_ids: string[] = [];

  for (const req of relevant) {
    const ev = evidenceByReq.get(req.id);
    if (!ev) {
      missing_requirement_ids.push(req.id);
      continue;
    }
    if (ev.status !== "PASS") {
      failed_requirement_ids.push(req.id);
      continue;
    }
    if (ev.repository_fingerprint !== input.current_repository_fingerprint) {
      stale_requirement_ids.push(req.id);
    }
  }

  const status: "PASS" | "FAIL" =
    missing_requirement_ids.length === 0 &&
    failed_requirement_ids.length === 0 &&
    stale_requirement_ids.length === 0
      ? "PASS"
      : "FAIL";

  return { status, missing_requirement_ids, failed_requirement_ids, stale_requirement_ids };
}

/** Human-readable blockers for a FAIL gate. */
export function validationGateBlockers(gate: ValidationGateResult, phaseLabel: string): string[] {
  const out: string[] = [];
  if (gate.missing_requirement_ids.length > 0) {
    out.push(`${phaseLabel}: required validation has no evidence: ${gate.missing_requirement_ids.join(", ")} (contract §10).`);
  }
  if (gate.failed_requirement_ids.length > 0) {
    out.push(`${phaseLabel}: required validation failed: ${gate.failed_requirement_ids.join(", ")} (contract §10).`);
  }
  if (gate.stale_requirement_ids.length > 0) {
    out.push(
      `${phaseLabel}: validation evidence is stale relative to current_repository_fingerprint: ${gate.stale_requirement_ids.join(", ")} (contract §9).`,
    );
  }
  return out;
}
