/**
 * Static-analysis QA helpers for S14A negative fixtures that cannot be fired
 * by feeding input to the registry at runtime (FX-NEG-009, 010, 028).
 * Secret checks additionally exercise adversarial runtime inputs. See
 * brain-bootstrap/quality-contracts/
 * S14_CAPABILITY_REGISTRY_TOOLS_MCP_DEEP.yaml.
 *
 * Each detector is proven non-vacuous in capabilityRegistry.test.ts by first
 * firing it on a deliberately planted violating string, then applying the
 * SAME function to real registry source/output.
 */

/** Forbidden hidden-provider-selection signals (semantic contract section 7). */
const HIDDEN_SELECTOR_PATTERNS: RegExp[] = [
  /process\s*\.\s*env/,
  /require\s*\(\s*["']child_process["']\s*\)/,
  /from\s+["']child_process["']/,
  /execSync|spawnSync|execFileSync/,
  /existsSync\s*\(/,
  /\bfs\s*\.\s*readdirSync\b/,
];

/** Scans TypeScript/JavaScript source text for hidden provider-selection signals. Returns matched pattern sources. */
export function scanForHiddenProviderSelection(sourceText: string): string[] {
  return HIDDEN_SELECTOR_PATTERNS.filter((pattern) => pattern.test(sourceText)).map((pattern) => pattern.source);
}

/** Forbidden secret-shaped content (semantic contract section 19 / skill section "Secrets"). */
const SECRET_LIKE_PATTERNS: RegExp[] = [
  /\b(?:set-)?cookie["']?\s*:/i,
  /authorization\s*:\s*bearer/i,
  /\bapi[_-]?key\b/i,
  /\bpassword\s*[:=]/i,
  /\bsecret\s*[:=]/i,
  /\bsk-[a-z0-9]{10,}/i,
  /\bghp_[a-z0-9]{10,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

/** Scans arbitrary text/JSON for secret-shaped content. Returns matched pattern sources. */
export function scanForSecretLikeContent(text: string): string[] {
  return SECRET_LIKE_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

/**
 * Forbidden filesystem/shell/network import or call signals (contract
 * sections 9/15 — no real fs/shell/git/network/browser/database/MCP
 * execution is authorized anywhere in the S14A canonical path).
 */
const EXTERNAL_EXECUTION_PATTERNS: RegExp[] = [
  /from\s+["'](node:)?fs(\/promises)?["']/,
  /require\s*\(\s*["'](node:)?fs(\/promises)?["']\s*\)/,
  /from\s+["'](node:)?child_process["']/,
  /require\s*\(\s*["'](node:)?child_process["']\s*\)/,
  /from\s+["'](node:)?(net|http|https|dgram|tls)["']/,
  /require\s*\(\s*["'](node:)?(net|http|https|dgram|tls)["']\s*\)/,
  /\bfetch\s*\(/,
  /\bWebSocket\s*\(/,
];

/** Scans TypeScript/JavaScript source text for external-execution signals. Returns matched pattern sources. */
export function scanForExternalExecutionSignals(sourceText: string): string[] {
  return EXTERNAL_EXECUTION_PATTERNS.filter((pattern) => pattern.test(sourceText)).map((pattern) => pattern.source);
}

/** Forbidden S15+ pull-forward vocabulary (skill section "S15+ boundary"). */
const S15_PLUS_VOCABULARY_PATTERNS: RegExp[] = [
  /Verifier Agent/,
  /Architecture Challenger/,
  /Workflow Runtime/,
  /\bDelegation\b/,
  /\bOrchestrator\b/,
  /multi-agent routing/,
  /self-improvement/,
  /resource manager/i,
];

/** Scans source text for S15+ concepts pulled forward into S14A. Returns matched pattern sources. */
export function scanForS15PlusPullForward(sourceText: string): string[] {
  return S15_PLUS_VOCABULARY_PATTERNS.filter((pattern) => pattern.test(sourceText)).map((pattern) => pattern.source);
}

/** Forbidden hidden test-only branching signals (S14A-HI-022). */
const TEST_ONLY_BRANCHING_PATTERNS: RegExp[] = [
  /fixture_?id/i,
  /expected_?result/i,
  /model_?arm/i,
  /skill_?identity/i,
];

/** Scans production source text for branching on test-only concepts. Returns matched pattern sources. */
export function scanForTestOnlyBranching(sourceText: string): string[] {
  return TEST_ONLY_BRANCHING_PATTERNS.filter((pattern) => pattern.test(sourceText)).map((pattern) => pattern.source);
}
