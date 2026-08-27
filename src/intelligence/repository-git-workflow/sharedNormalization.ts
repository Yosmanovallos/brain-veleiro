import { REPOSITORY_WORKFLOW_FORBIDDEN_KEYS, SENSITIVE_PATH_BASELINE_PATTERNS } from "./constants.js";

/**
 * Brain — S13H shared normalization / matching helpers.
 *
 * Deterministic primitives shared VERBATIM between the reference synthesizer and
 * `validateRepositoryWorkflowDecision()` so scoring and enforcement cannot
 * drift (the S13D `hardDrivers` / S13F `sharedDerivations` / S13G
 * `sharedNormalization` precedent). Every function takes only already-supplied
 * bounded input — never a value the model claimed.
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

/** Mechanical deep clone (the snapshot/inputs are never mutated — HI-028). */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

// ---------------------------------------------------------------------------
// Forbidden provider/runtime key scan (Skill "Remote review handoff" / HI-023)
// ---------------------------------------------------------------------------

const FORBIDDEN_KEY_SET = new Set(REPOSITORY_WORKFLOW_FORBIDDEN_KEYS);

/**
 * Deep scan for any provider/runtime key used as an object KEY (not merely a
 * substring of human-readable prose — contract §13 warns against a naive text
 * regex).
 */
export function findRepositoryWorkflowForbiddenKeys(value: unknown, path = "$"): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => hits.push(...findRepositoryWorkflowForbiddenKeys(item, `${path}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY_SET.has(key)) hits.push(`${path}.${key}`);
      hits.push(...findRepositoryWorkflowForbiddenKeys(child, `${path}.${key}`));
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Sensitive-path matching (Skill "Sensitive-path policy" / contract §4)
// ---------------------------------------------------------------------------

/** Translate a `.gitignore`-style glob (only `*` wildcard, no `/`) into a RegExp. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`(^|/)${escaped}$`);
}

/**
 * True when `path` matches a high-confidence sensitive pattern (baseline +
 * caller-supplied) and is NOT an exact caller-declared safe exception. This is
 * an explicit bounded check, never a claim of perfect secret detection
 * (HI-021).
 */
export function isSensitivePath(
  path: string,
  extraPatterns: readonly string[] = [],
  safeExceptions: readonly string[] = [],
): boolean {
  const base = path.split("/").pop() ?? path;
  if (safeExceptions.includes(path) || safeExceptions.includes(base)) return false;
  const patterns = [...SENSITIVE_PATH_BASELINE_PATTERNS, ...extraPatterns];
  return patterns.some((p) => globToRegExp(p).test(path) || globToRegExp(p).test(base));
}

// ---------------------------------------------------------------------------
// Path glob membership (intended / supporting / excluded / protected sets)
// ---------------------------------------------------------------------------

/** Exact path or `dir/` prefix or simple `*` glob membership. */
export function pathMatchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => {
    if (p === path) return true;
    if (p.endsWith("/") && path.startsWith(p)) return true;
    if (p.includes("*")) {
      const re = new RegExp(
        "^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
      );
      return re.test(path);
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Change-kind -> default Brain commit prefix (contract §11)
// ---------------------------------------------------------------------------

export function defaultCommitTypeForChangeKind(kind: string): string {
  switch (kind) {
    case "FEATURE":
      return "feat";
    case "FIX":
      return "fix";
    case "DOCS":
      return "docs";
    case "TEST":
      return "test";
    case "REFACTOR":
      return "refactor";
    case "CHORE":
      return "chore";
    default:
      return "chore";
  }
}

/** Words a commit message may not assert unless supporting evidence exists. */
const UNSUPPORTED_CLAIM_WORDS = /\b(verified|secure|complete|passing|proven|guaranteed)\b/i;

export function commitMessageMakesUnsupportedClaim(message: string): boolean {
  return UNSUPPORTED_CLAIM_WORDS.test(message);
}
