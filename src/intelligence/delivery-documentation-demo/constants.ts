import type { DeliveryPolicy } from "./types.js";

export const DELIVERY_DOCUMENTATION_DEMO_SKILL_ID = "intelligence.delivery-documentation-demo.s13q";
export const DELIVERY_DOCUMENTATION_DEMO_QUALITY_CONTRACT_REF = "S13Q_DELIVERY_DOCUMENTATION_DEMO_DEEP";
export const DELIVERY_DOCUMENTATION_DEMO_INPUT_MARKER = "[[DELIVERY_DOCUMENTATION_DEMO_INPUT]]";

// Contract section 18 — ceilings. A policy may lower but never raise these.
export const DELIVERY_CEILINGS = {
  max_repository_facts: 256,
  max_verification_evidence: 256,
  max_architecture_facts: 128,
  max_setup_steps: 32,
  max_demo_steps: 32,
  max_limitations: 64,
  max_next_steps: 64,
  max_evidence_refs_per_claim: 8,
  max_total_evidence_refs: 512,
  max_safe_ref_chars: 160,
  max_text_chars_per_field: 2000,
  max_rendered_markdown_bytes: 262144,
} as const;

export const DEFAULT_DELIVERY_POLICY: DeliveryPolicy = {
  ...DELIVERY_CEILINGS,
  require_markdown_projection: true,
};

// Contract section 9 — evidence precedence (highest first).
export const PRECEDENCE_ORDER = [
  "EXECUTABLE_VERIFICATION",
  "COMMITTED_REPOSITORY_FACT",
  "APPROVED_CONTRACT",
  "CONTINUITY_HANDOFF",
  "CALLER_ASSERTION",
  "UNKNOWN",
] as const;

// Contract section 10 — executive summary MUST NOT claim these without separate evidence.
export const OVERCLAIM_PHRASE =
  /\b(production[- ]ready|prod[- ]ready|zero[- ]bugs?|bug[- ]free|fully[- ]tested|fully[- ]automated|highly[- ]available|infinitely[- ]scalable|enterprise[- ]grade|battle[- ]tested|secure against all|compliant with all|deployed to production|live in production|ready to ship to customers)\b/i;

// Contract sections 3.3 / 13 — a demo MUST NOT create a new runtime.
export const DEMO_RUNTIME_MARKER =
  /\b(start(?:s|ing)? (?:a |the )?(?:new )?server|spin up|deploy(?:ment)?|docker run|docker compose up|kubectl|helm install|npm run deploy|listen on port|bind to port|provision (?:a )?(?:host|instance)|create (?:a )?public url|expose (?:a )?tunnel)\b/i;

export const DEMO_BROWSER_MARKER =
  /\b(puppeteer|playwright|selenium|webdriver|headless chrome|browser automation|record (?:a )?video|capture (?:a )?screenshot|screen recording)\b/i;

// Contract sections 15 / 32 / 33 — later-stage responsibilities that must not be pulled forward.
export const S13R_MARKER =
  /\b(dockerfile|containeriz(?:e|ation)|deployment (?:script|pipeline|adapter|manifest)|health[- ]?check endpoint|hosting provider mapping|secrets provisioning|environment provisioning)\b/i;
export const S14_MARKER =
  /\b(capability registry|mcp server|connector binding|oauth flow|tool binding registration|register (?:a )?connector)\b/i;
export const S15_MARKER =
  /\b(verifier agent|challenger agent|new agentdefinition|workflow runtime|orchestrator implementation|cross[- ]run resource manager)\b/i;

// Contract section 16 — forbidden secret / raw material.
export const FORBIDDEN_SENSITIVE_KEY =
  /(?:password|secret(?:_?value)?|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|cookie|set-cookie|bearer|authorization|proxy-authorization|session[_-]?token)/i;

export const FORBIDDEN_SENSITIVE_VALUE =
  /(?:-----BEGIN(?: RSA| EC| OPENSSH| PGP)? PRIVATE KEY-----|\bbearer\s+[A-Za-z0-9._~+/=-]{8,}|\b(?:authorization|proxy-authorization|cookie|set-cookie|password|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|session[_-]?token)\s*[:=]\s*["']?[^\s"']{6,}|\bsk-[A-Za-z0-9]{12,}|\bghp_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{12,}|\bxox[baprs]-[A-Za-z0-9-]{10,})/i;

// Raw log / stack trace / provider error dump.
export const RAW_LOG_MARKER =
  /(?:Traceback \(most recent call last\)|^\s*at [\w$.<>]+ \(.*:\d+:\d+\)|\bECONNREFUSED\b.*\n.*\bat \w|\n\s{2,}at .+:\d+:\d+\)|\bUnhandledPromiseRejection\b)/m;

// Raw .env file dump (two or more KEY=VALUE assignment lines).
export const RAW_ENV_MARKER = /(?:^|\n)[A-Z][A-Z0-9_]{2,}=[^\n]+\n[A-Z][A-Z0-9_]{2,}=/;

// Fresh-timestamp / nondeterminism markers (contract section 17).
export const FRESH_TIMESTAMP_MARKER =
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b|\bgenerated (?:at|on) \d|\bDate\.now\(\)|\bnew Date\(\)/;

// Candidate self-certification markers (contract section 26).
export const SELF_CERT_MARKER =
  /\b(hi[-_]?052|self[-_ ]?award|self[-_ ]?certif\w*|independently verified by this|step (?:pass|closure) granted|honor invariant awarded)\b/i;

// Architecture "decision disguised as a fact" markers (contract section 11).
export const ARCHITECTURE_DECISION_MARKER =
  /\b(introduce|adopt|migrate to|switch to|replace .+ with|we should use|recommend using|let'?s use|new (?:provider|database|datastore|queue|cache|framework|service|agent|broker))\b/i;

// Env var / port / url / path tokens embedded in a command string (contract section 12).
export const ENV_TOKEN = /\$\{?([A-Z][A-Z0-9_]{2,})\}?/g;
export const PORT_TOKEN = /(?:--port[ =]|:)\s?(\d{2,5})\b/g;
export const URL_TOKEN = /\bhttps?:\/\/[^\s"'`]+/g;
export const ABS_PATH_TOKEN = /(?<![:\w])(\/(?:[\w.-]+\/)*[\w.-]+)/g;

/** Recursive scan for secret-bearing keys or values anywhere in a value graph. */
export function containsForbiddenSensitiveMaterial(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "string") return FORBIDDEN_SENSITIVE_VALUE.test(value);
  if (!value || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsForbiddenSensitiveMaterial(item, seen));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) => FORBIDDEN_SENSITIVE_KEY.test(key) || containsForbiddenSensitiveMaterial(item, seen),
  );
}

/** Every string leaf in a value graph, newline-joined — for markers that depend on real line breaks. */
export function collectStrings(value: unknown, out: string[] = [], seen = new WeakSet<object>()): string {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object" && !seen.has(value)) {
    seen.add(value);
    if (Array.isArray(value)) for (const item of value) collectStrings(item, out, seen);
    else for (const item of Object.values(value as Record<string, unknown>)) collectStrings(item, out, seen);
  }
  return out.join("\n");
}

/** True when a value graph carries raw log / raw .env / fresh-timestamp / self-cert material. */
export function containsRawOrNondeterministicMaterial(value: unknown): boolean {
  const text = collectStrings(value);
  return RAW_LOG_MARKER.test(text) || RAW_ENV_MARKER.test(text) || FRESH_TIMESTAMP_MARKER.test(text) || SELF_CERT_MARKER.test(text);
}
