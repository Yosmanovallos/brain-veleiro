import type {
  TaskAcceptanceCriterion,
  TaskEvidenceRequirement,
} from "../implementation-planning/types.js";
import { EVIDENCE_KINDS } from "../implementation-planning/types.js";
import type { JsonSchemaLike } from "../../core/agent/index.js";
import { EXECUTION_PACKAGE_FORBIDDEN_KEYS } from "./constants.js";
import type { TaskCompilationInput } from "./types.js";

/**
 * Brain — S13G shared normalization / equality helpers.
 *
 * Implements the deterministic-comparison primitives of
 * brain-bootstrap/specs/EXECUTION_PACKAGE_CONTRACT_S13G.md sections 5, 10, 11,
 * 12, 13. These are shared VERBATIM between the reference synthesizer and
 * `validateExecutionPackage()` so scoring and enforcement cannot drift (the
 * S13D `hardDrivers` / S13F `sharedDerivations` precedent). Every function
 * takes only already-supplied bounded input — never a value the model claimed.
 */

/** Deterministic key-sorted JSON serialization for semantic equality tests. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Mechanical deep clone (spec section 6 — "A mechanical deep clone is allowed"). */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------------------
// Acceptance / evidence normalization + equality (spec sections 5.4, 5.5, 11)
// ---------------------------------------------------------------------------

export function normalizeAcceptance(items: TaskAcceptanceCriterion[]): TaskAcceptanceCriterion[] {
  return [...items]
    .map((a) => ({
      id: a.id.trim(),
      condition: a.condition.trim(),
      verification_method: a.verification_method.trim(),
      evidence_expected: a.evidence_expected.trim(),
    }))
    .sort((x, y) => x.id.localeCompare(y.id));
}

export function normalizeEvidence(items: TaskEvidenceRequirement[]): TaskEvidenceRequirement[] {
  return [...items]
    .map((e) => {
      const out: TaskEvidenceRequirement = {
        kind: e.kind,
        description: e.description.trim(),
      };
      if (e.source_ref !== undefined) out.source_ref = e.source_ref.trim();
      if (e.manual_review_reason !== undefined) out.manual_review_reason = e.manual_review_reason.trim();
      return out;
    })
    .sort((x, y) => {
      const k = x.kind.localeCompare(y.kind);
      if (k !== 0) return k;
      const d = x.description.localeCompare(y.description);
      if (d !== 0) return d;
      return (x.source_ref ?? "").localeCompare(y.source_ref ?? "");
    });
}

export function acceptanceEqual(a: TaskAcceptanceCriterion[], b: TaskAcceptanceCriterion[]): boolean {
  return stableStringify(normalizeAcceptance(a)) === stableStringify(normalizeAcceptance(b));
}

export function evidenceEqual(a: TaskEvidenceRequirement[], b: TaskEvidenceRequirement[]): boolean {
  return stableStringify(normalizeEvidence(a)) === stableStringify(normalizeEvidence(b));
}

/** Every evidence kind is in the canonical S13F EvidenceKind enum. */
export function evidenceKindsValid(items: TaskEvidenceRequirement[]): boolean {
  return items.every((e) => EVIDENCE_KINDS.includes(e.kind));
}

// ---------------------------------------------------------------------------
// JSON-schema equality (spec section 10 / HI-020)
// ---------------------------------------------------------------------------

export function jsonSchemaEqual(a: JsonSchemaLike, b: JsonSchemaLike): boolean {
  return stableStringify(a) === stableStringify(b);
}

// ---------------------------------------------------------------------------
// Material Spec-ref families (spec section 5.2) — the R-/NFR-/C-/A-/AC- refs
// the S13F task cites.
// ---------------------------------------------------------------------------

const REF_FAMILY_PATTERNS = [/^NFR-\d+$/, /^AC-\d+$/, /^R-\d+$/, /^C-\d+$/, /^A-\d+$/];

export function isMaterialRef(ref: string): boolean {
  return REF_FAMILY_PATTERNS.some((p) => p.test(ref));
}

/**
 * The set of Spec-family refs the task materially cites: `spec_refs`,
 * `constraint_refs`, `assumption_refs`. Architecture / agent-decision refs are
 * out of the bounded Spec projection's scope.
 */
export function taskMaterialSpecRefs(input: TaskCompilationInput): Set<string> {
  const s = new Set<string>();
  for (const r of input.task.spec_refs) if (isMaterialRef(r)) s.add(r);
  for (const r of input.task.constraint_refs) if (isMaterialRef(r)) s.add(r);
  for (const r of input.task.assumption_refs) if (isMaterialRef(r)) s.add(r);
  return s;
}

/** Every Spec-family ref legitimately present in the bounded Spec snapshot. */
export function boundedSpecSnapshotRefs(input: TaskCompilationInput): Set<string> {
  const s = new Set<string>();
  const spec = input.spec;
  for (const r of spec.requirements) {
    s.add(r.ref);
    for (const ac of r.acceptance_refs) s.add(ac);
  }
  for (const nfr of spec.non_functional_requirements) s.add(nfr.ref);
  for (const c of spec.constraints) s.add(c.ref);
  for (const a of spec.assumptions) s.add(a.ref);
  for (const ac of spec.acceptance_criteria) s.add(ac.ref);
  return s;
}

// ---------------------------------------------------------------------------
// Deterministic package_id (spec section 12)
// ---------------------------------------------------------------------------

/** Reversible escaping so ':' inside an id never collides with the separator. */
function escapeIdComponent(v: string): string {
  return v.replace(/%/g, "%25").replace(/:/g, "%3A");
}

export function computePackageId(input: TaskCompilationInput): string {
  return [
    "EP",
    escapeIdComponent(input.task.id),
    escapeIdComponent(input.context_pack.id),
    escapeIdComponent(input.agent_definition.id),
  ].join(":");
}

// ---------------------------------------------------------------------------
// Forbidden structured-key scan (spec section 13 / HI-024)
// ---------------------------------------------------------------------------

const FORBIDDEN_KEY_SET = new Set(EXECUTION_PACKAGE_FORBIDDEN_KEYS);

/**
 * Deep scan for any Stage-12+/S14/S17 provider/runtime key used as an object
 * KEY (not merely a substring of instruction prose — spec section 13
 * explicitly warns against a naive text regex).
 */
export function findExecutionPackageForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...findExecutionPackageForbiddenKeys(item, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY_SET.has(key)) hits.push(`${path}.${key}`);
      hits.push(...findExecutionPackageForbiddenKeys(child, `${path}.${key}`));
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Bounded secret detection (spec sections 14, 17) — explicit tagged/known
// secret material only; NOT a "perfect arbitrary-string secret detector".
// ---------------------------------------------------------------------------

/** Obvious credential shapes + an explicit `SECRET:` tag convention for fixtures. */
const KNOWN_SECRET_PATTERNS: RegExp[] = [
  /\bSECRET:\S+/,
  /\bsk-[A-Za-z0-9]{16,}/,
  /\bghp_[A-Za-z0-9]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

export function containsKnownSecretValue(value: unknown): boolean {
  if (typeof value === "string") {
    return KNOWN_SECRET_PATTERNS.some((p) => p.test(value));
  }
  if (Array.isArray(value)) return value.some(containsKnownSecretValue);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsKnownSecretValue);
  }
  return false;
}
