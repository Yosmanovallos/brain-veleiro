import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/**
 * S14G Part B builder baseline — the exact Part A integration SHA recorded by
 * the control plane before Part B authorization.
 */
export const baseline = "e4c90bc8a43f1ffb855617ba7db30ce4e46d2595";

export const text = (path: string): string => readFileSync(path, "utf8");
export const blobSha1 = (bytes: Buffer): string =>
  createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const GIT_MAXBUF = { encoding: "utf8" as const, maxBuffer: 64 * 1024 * 1024 };

// --- authorized S14G candidate surface -----------------------------------

/** Additions are permitted ONLY under these prefixes (contract §23). */
export const ALLOWED_ADD_PREFIXES = [
  "src/providers/capability/browser/",
  "tests/browser-capability/",
  "brain-bootstrap/reports/S14G-browser-capability-verification.md",
];

/** S14G is authorized to add exactly one pinned dependency in package manifests. */
export const ALLOWED_MODIFIED = ["package.json", "package-lock.json"];

const PRODUCTION_DIR = "src/providers/capability/browser";

export function productionSourceFiles(): string[] {
  return readdirSync(PRODUCTION_DIR)
    .filter(p => p.endsWith(".ts"))
    .sort()
    .map(p => join(PRODUCTION_DIR, p));
}

export function productionSources(): string {
  return productionSourceFiles().map(text).join("\n");
}

export const codeLines = (source: string): string =>
  source
    .split("\n")
    .filter(line => {
      const trimmed = line.trimStart();
      return !(trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*"));
    })
    .join("\n");

export const productionCode = (): string => codeLines(productionSources());

/** Production implementation code, excluding the public descriptor text which
 * legitimately enumerates forbidden output surfaces in natural language. */
export function productionImplementationCode(): string {
  return codeLines(productionSourceFiles().filter(p => !p.endsWith("descriptors.ts")).map(text).join("\n"));
}

/** Every tracked file at `baseline` must still be byte-identical, except allowed manifest edits. */
export function protectedDifferences(): string[] {
  const tracked = execFileSync("git", ["ls-tree", "-r", "--format=%(objectname) %(path)", baseline], GIT_MAXBUF)
    .trim()
    .split("\n");
  return tracked.flatMap(line => {
    const hash = line.slice(0, 40);
    const path = line.slice(41);
    if (ALLOWED_MODIFIED.includes(path)) return [];
    if (!existsSync(path)) return [path];
    return blobSha1(readFileSync(path)) === hash ? [] : [path];
  });
}

/** Baseline -> current worktree changes, working both before and after commit. */
export function candidateChanges(): Array<{ status: string; path: string }> {
  const tracked = execFileSync("git", ["diff", "--name-status", baseline], GIT_MAXBUF)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(line => {
      const [status, ...rest] = line.split("\t");
      return { status: status[0], path: rest.join("\t") };
    });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], GIT_MAXBUF)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(path => ({ status: "A", path }));
  return [...tracked, ...untracked];
}

/** Part A canonical S14G blobs are byte-identical at the candidate (contract §1). */
export function partAIntact(): void {
  for (const path of [
    "brain-bootstrap/skills/BROWSER_CAPABILITY_SKILL_S14G.md",
    "brain-bootstrap/specs/BROWSER_CAPABILITY_CONTRACT_S14G.md",
    "brain-bootstrap/quality-contracts/S14G_BROWSER_CAPABILITY_DEEP.yaml",
  ]) {
    expect(existsSync(path)).toBe(true);
    const diff = execFileSync("git", ["diff", "--name-only", baseline, "--", path], GIT_MAXBUF).trim();
    expect(diff).toBe("");
  }
}

/**
 * Mechanically verify the protected S14G boundary (contract §23):
 * only additions under authorized prefixes, zero modifications / deletions /
 * renames of pre-existing files, Part A intact, package manifests touched only
 * by the authorized pinned dependency, and no S14H+ artifact pulled forward.
 */
export function assertBoundaries(): void {
  expect(protectedDifferences()).toEqual([]);
  const changes = candidateChanges();
  const additions = changes.filter(c => c.status === "A");
  const modifications = changes.filter(c => c.status !== "A");
  expect(additions.every(c => ALLOWED_ADD_PREFIXES.some(prefix => c.path.startsWith(prefix)))).toBe(true);
  expect(modifications.map(c => c.path).sort()).toEqual([...ALLOWED_MODIFIED].sort());
  partAIntact();

  // No S14H+ canonical artifact or implementation was pulled forward.
  const future = execFileSync("git", ["ls-files"], GIT_MAXBUF)
    .trim()
    .split("\n")
    .filter(p => /S14[H-Z]|S1[5-9]|S[2-9][0-9]/.test(p));
  expect(future).toEqual([]);
}

/** Core + prior-phase implementation surfaces are byte-identical to baseline. */
export function assertPriorPhaseIdentity(): void {
  const surfaces = [
    "src/core/",
    "src/providers/capability/registry/",
    "src/providers/capability/documentation/",
    "src/providers/capability/filesystem/",
    "src/providers/capability/git/",
    "src/providers/capability/shell/",
    "src/providers/capability/github/",
    "tests/git-capability/",
    "tests/shell-capability/",
    "tests/documentation-capability/",
    "tests/filesystem-capability/",
    "tests/capability-registry/",
    "tests/github-capability/",
  ];
  for (const surface of surfaces) {
    const files = execFileSync("git", ["ls-tree", "-r", "--name-only", baseline, surface], GIT_MAXBUF)
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const file of files) {
      const want = execFileSync("git", ["rev-parse", `${baseline}:${file}`], GIT_MAXBUF).trim();
      expect(blobSha1(readFileSync(file))).toBe(want);
    }
  }
}

/** The only dependency change is the exact pinned `playwright-core` addition. */
export function assertNoNewDependency(): void {
  const manifest = JSON.parse(text("package.json")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  expect(Object.keys(manifest.dependencies).sort()).toEqual(["better-sqlite3", "playwright-core"]);
  expect(manifest.dependencies["playwright-core"]).toBe("1.63.0");
  expect(Object.keys(manifest.devDependencies).sort()).toEqual([
    "@types/better-sqlite3",
    "@types/js-yaml",
    "@types/node",
    "js-yaml",
    "typescript",
    "vitest",
  ]);

  // Production imports only Node built-ins, `playwright-core`, and in-phase / core-type modules.
  for (const file of productionSourceFiles()) {
    for (const match of text(file).matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      expect(
        specifier.startsWith("node:") ||
          specifier.startsWith("./") ||
          specifier.startsWith("../") ||
          specifier === "playwright-core",
      ).toBe(true);
    }
  }
}

// --- source-level structural scanners -------------------------------------

/** Forbidden Playwright interaction, remote attach, transport or dependency surface. */
export const forbiddenSurface = (source = productionImplementationCode()): number =>
  (source.match(
    /\b(?:browserWSEndpoint|connectOverCDP|launchServer|channel|executablePath|executable|extraHTTPHeaders|setExtraHTTPHeaders|cookies|storageState|httpCredentials|clientCertificates|permissions|userAgent|user_agent|viewport|downloadsPath|recordHar|recordVideo|tracing|screenshot|setContent|evaluate|evaluateHandle|exposeBinding|routeWebSocket.*connectToServer|from\s+["'](?:node:)?(?:child_process|net|dgram|http|https)["']|from\s+["'](?:axios|node-fetch|got|undici)["']|fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|require\s*\(\s*["'](?:node:)?child_process["']\s*\)|\bexec\s*\(|\beval\s*\()/g,
  ) ?? []).length;

/** Extra, model-supplied browser configuration surfaces outside the seven trusted keys. */
export const forbiddenConfigSurface = (source = productionSources()): string[] => {
  const matches = [...source.matchAll(/export\s+interface\s+BrowserInspectProviderConfig\s*\{([\s\S]*?)^\}/gms)];
  if (matches.length === 0) return ["BrowserInspectProviderConfig not found"];
  const props = new Set<string>();
  for (const match of matches) {
    for (const m of [...match[1].matchAll(/\b(\w+)\s*[:?]/g)]) {
      props.add(m[1]);
    }
  }
  const allowed = new Set([
    "browser_id",
    "allowed_navigation_origins",
    "allowed_request_origins",
    "max_timeout_ms",
    "snapshot_depth",
    "max_snapshot_bytes",
    "max_links",
  ]);
  return [...props].filter(p => !allowed.has(p));
};

/** Hidden retry machinery. */
export const hiddenRetrySurface = (source: string): number =>
  (source.match(
    /for\s*\([^)]*\b(?:attempt|retry|retries|tries)\b|while\s*\([^)]*\b(?:attempt|retry|retries|tries)\b|\bretryCount\b|\bmaxRetries\b|\bbackoff\b|\bp-retry\b/gi,
  ) ?? []).length;

/** Ambient credential / configuration discovery. */
export const inferredScope = (source: string): number =>
  (source.match(
    /process\.env\s*[.[]|\.\.\.\s*process\.env\b|Object\.\w+\s*\(\s*process\.env\b|process\.cwd\s*\(|homedir\s*\(|USERPROFILE|GITHUB_TOKEN|GH_TOKEN|\.netrc|~\/\.config\b/g,
  ) ?? []).length;

/** Alternate origin / SSRF / redirect-following / proxy / CA surface. */
export const originEscapeSurface = (source: string): number =>
  (source.match(
    /base_?url|baseUrl|\bendpoint\b|followRedirects?|maxRedirects?|\bproxy\b|\bca:\s|rejectUnauthorized|setDefaultResultOrder|lookup\s*:|connectOverCDP|browserWSEndpoint/gi,
  ) ?? []).length;

/** S14H+ / future-phase execution surface pulled forward. */
export const futurePhaseSurface = (source: string): number => {
  const matches = source.match(/["'`](?:browser|database|mcp|workflow)\.[a-z]+/g) ?? [];
  return matches.filter(m => m.slice(1) !== "browser.inspect").length;
};

/** S14 / HI-054 self-closure claims. */
export const closureClaims = (source: string): number =>
  (source.match(/\bS14\s*[:=]\s*["']?(?:CLOSED|PASS)\b|\bHI-054\s*[:=]\s*["']?AWARDED\b|\bS14G\s*[:=]\s*["']?AUTHORIZED\b/g) ?? []).length;

/** Affirmative over-claim language forbidden by contract §8 / §11. */
export const overclaims = (source: string): number => {
  const re =
    /(?:\b(?:no|not|never|never a|without|cannot|does not|doesn't|is not)\b[^.\n]{0,40})?(complete DLP|complete secret detection|exactly[- ]once|guaranteed delivery|guarantees? no duplicate)/gi;
  let count = 0;
  for (const m of source.matchAll(re)) {
    const lead = source.slice(Math.max(0, m.index - 48), m.index + m[0].length - m[1].length).toLowerCase();
    if (!/\b(?:no|not|never|without|cannot|doesn't|do not|does not)\b/.test(lead)) count++;
  }
  return count;
};

export function phaseText(): string {
  const report = "brain-bootstrap/reports/S14G-browser-capability-verification.md";
  return [
    text("brain/context/CURRENT.md"),
    text("brain-bootstrap/STATE.yaml"),
    ...(existsSync(report) ? [text(report)] : []),
  ].join("\n");
}
