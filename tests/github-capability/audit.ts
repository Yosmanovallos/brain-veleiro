import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/**
 * S14F Part B builder baseline — the exact Part A integration SHA recorded by
 * the control plane before Part B authorization (contract §25,
 * S14F_GITHUB_CAPABILITY_DEEP.yaml `baseline.implementation_baseline`).
 */
export const baseline = "040cc43ff2ad42deb06c8edf794e3bdfa7762be6";
export const semanticAuthoringMain = "3bb02b72925c68c59782f085796b47ba9aef078b";

/** Canonical S14F Part A blob identities at HEAD (contract §1, §23). */
export const partABlobs: Record<string, string> = {
  "brain-bootstrap/skills/GITHUB_CAPABILITY_SKILL_S14F.md": "2205c8b6edc8b4ec966e9605053a37c57e3f4959",
  "brain-bootstrap/quality-contracts/S14F_GITHUB_CAPABILITY_DEEP.yaml": "be5ab81c1c0b70db1f4d0a744ef3af7b2e69fee1",
  "brain-bootstrap/specs/GITHUB_CAPABILITY_CONTRACT_S14F.md": "800734bcdb9d699ba000b72d713424aba58cfd0d",
};
export const partASha256: Record<string, string> = {
  "brain-bootstrap/skills/GITHUB_CAPABILITY_SKILL_S14F.md": "83c2d757338a9ff5b49d2d372e0ff63d77fad6816d40e51522218ea14a683312",
  "brain-bootstrap/quality-contracts/S14F_GITHUB_CAPABILITY_DEEP.yaml": "3a3186f5785d3fd25880604c11a9766b794940bc2f0c28311bc08cc1721eb274",
  "brain-bootstrap/specs/GITHUB_CAPABILITY_CONTRACT_S14F.md": "53f08d122faf84fe07e6b728a046a5e70bf9b4b9055bb06cdf75c9eecf73500d",
};

export const text = (path: string): string => readFileSync(path, "utf8");
export const blobSha1 = (bytes: Buffer): string =>
  createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const GIT_MAXBUF = { encoding: "utf8" as const, maxBuffer: 64 * 1024 * 1024 };

// --- authorized S14F candidate surface -----------------------------------

/** Additions are permitted ONLY under these prefixes (contract §23). */
export const ALLOWED_ADD_PREFIXES = [
  "src/providers/capability/github/",
  "tests/github-capability/",
  "brain-bootstrap/reports/S14F-github-capability-verification.md",
];
/** S14F adds ZERO authorized modifications of pre-existing tracked files. */
export const ALLOWED_MODIFIED: string[] = [];

const PRODUCTION_DIR = "src/providers/capability/github";

export function productionSourceFiles(): string[] {
  return readdirSync(PRODUCTION_DIR).filter(p => p.endsWith(".ts")).sort().map(p => join(PRODUCTION_DIR, p));
}
export function productionSources(): string {
  return productionSourceFiles().map(text).join("\n");
}

/**
 * Executable lines only: whole-line `//`, block-comment open/close markers,
 * and `*` leader lines are dropped. Structural scanners run over this so a
 * prose disclaimer ("no proxy", "GitHub Enterprise is deferred") is never
 * mistaken for a code surface.
 */
export const codeLines = (source: string): string =>
  source.split("\n").filter(line => {
    const trimmed = line.trimStart();
    return !(trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*"));
  }).join("\n");

export const productionCode = (): string => codeLines(productionSources());

/** Every tracked file at `baseline` must still be byte-identical. */
export function protectedDifferences(): string[] {
  const tracked = execFileSync("git", ["ls-tree", "-r", "--format=%(objectname) %(path)", baseline], GIT_MAXBUF)
    .trim().split("\n");
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
    .trim().split("\n").filter(Boolean)
    .map(line => { const [status, ...rest] = line.split("\t"); return { status: status[0], path: rest.join("\t") }; });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], GIT_MAXBUF)
    .trim().split("\n").filter(Boolean)
    .map(path => ({ status: "A", path }));
  return [...tracked, ...untracked];
}

/** Part A canonical blobs are byte-identical at the candidate (contract §1). */
export function partAIntact(): void {
  for (const [path, want] of Object.entries(partABlobs)) {
    expect(execFileSync("git", ["rev-parse", `HEAD:${path}`], { encoding: "utf8" }).trim()).toBe(want);
  }
  for (const [path, want] of Object.entries(partASha256)) {
    expect(sha256(readFileSync(path))).toBe(want);
  }
}

/**
 * Mechanically verify the protected S14F boundary (contract §23):
 * only additions under authorized prefixes, zero modifications / deletions /
 * renames of pre-existing files, Part A intact, package manifests and
 * continuity files untouched, and no S14G+ artifact pulled forward.
 */
export function assertBoundaries(): void {
  expect(protectedDifferences()).toEqual([]);
  const changes = candidateChanges();
  const additions = changes.filter(c => c.status === "A");
  const modifications = changes.filter(c => c.status !== "A");
  expect(additions.every(c => ALLOWED_ADD_PREFIXES.some(prefix => c.path.startsWith(prefix)))).toBe(true);
  expect(modifications).toEqual([]);
  partAIntact();

  for (const manifest of ["package.json", "package-lock.json", "tsconfig.json", "vitest.config.ts"]) {
    const want = execFileSync("git", ["rev-parse", `${baseline}:${manifest}`], { encoding: "utf8" }).trim();
    expect(blobSha1(readFileSync(manifest))).toBe(want);
  }
  for (const continuity of ["brain-bootstrap/STATE.yaml", "brain/context/CURRENT.md"]) {
    const want = execFileSync("git", ["rev-parse", `${baseline}:${continuity}`], { encoding: "utf8" }).trim();
    expect(blobSha1(readFileSync(continuity))).toBe(want);
  }
  // No S14G+ canonical artifact or implementation was pulled forward.
  const future = execFileSync("git", ["ls-files"], GIT_MAXBUF).trim().split("\n")
    .filter(p => /S14[G-Z]|S1[5-9]|S[2-9][0-9]/.test(p));
  expect(future).toEqual([]);
  expect(existsSync("src/providers/capability/browser")).toBe(false);
  expect(existsSync("src/providers/capability/postgres")).toBe(false);
  expect(existsSync("src/providers/capability/mcp")).toBe(false);
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
    "tests/git-capability/",
    "tests/shell-capability/",
    "tests/documentation-capability/",
    "tests/filesystem-capability/",
    "tests/capability-registry/",
  ];
  for (const surface of surfaces) {
    const files = execFileSync("git", ["ls-tree", "-r", "--name-only", baseline, surface], GIT_MAXBUF)
      .trim().split("\n").filter(Boolean);
    for (const file of files) {
      const want = execFileSync("git", ["rev-parse", `${baseline}:${file}`], { encoding: "utf8" }).trim();
      expect(blobSha1(readFileSync(file))).toBe(want);
    }
  }
}

/** The dependency manifests are untouched: S14F adds no package (S14F-HI-027). */
export function assertNoNewDependency(): void {
  const manifest = JSON.parse(text("package.json")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  expect(Object.keys(manifest.dependencies).sort()).toEqual(["better-sqlite3"]);
  expect(Object.keys(manifest.devDependencies).sort()).toEqual(
    ["@types/better-sqlite3", "@types/js-yaml", "@types/node", "js-yaml", "typescript", "vitest"],
  );
  const baselineManifest = execFileSync("git", ["show", `${baseline}:package.json`], GIT_MAXBUF);
  expect(text("package.json")).toBe(baselineManifest);
  // Production imports only Node built-ins and in-phase / Core-type modules.
  for (const file of productionSourceFiles()) {
    for (const match of text(file).matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      expect(
        specifier.startsWith("node:") || specifier.startsWith("./") || specifier.startsWith("../"),
      ).toBe(true);
    }
  }
}

// --- source-level structural scanners -------------------------------------

/**
 * Forbidden operation / transport / dependency surface (contract §6, §20).
 * A mutating HTTP method, a forbidden GitHub route family, GraphQL, an SDK, a
 * CLI fallback, an ambient `fetch` or a raw socket module all count.
 */
export const forbiddenSurface = (source: string): number =>
  (source.match(
    /\bmethod:\s*["'`](?:PUT|PATCH|DELETE|HEAD|OPTIONS)["'`]|["'`](?:PUT|PATCH|DELETE)["'`]\s*[,;)]|\/graphql\b|\/merge\b|\/reviews\b|\/requested_reviewers\b|\/labels\b|\/assignees\b|\/releases\b|\/dispatches\b|\/secrets\b|\/hooks\b|\/actions\/variables\b|\/git\/refs\b|\/contents\/|\bOctokit\b|from\s+["'](?:@octokit|octokit|axios|node-fetch|got|undici)|from\s+["'](?:node:)?(?:child_process|net|dgram|http)["']|require\(\s*["'](?:node:)?child_process["']\s*\)|\bexecFileSync?\b|\bspawnSync?\s*\(|\bfetch\s*\(|\bgh\s+(?:pr|api|repo|issue)\b|\bcurl\s+-/g,
  ) ?? []).length;

/** Hidden retry machinery (contract §15, S14F-HI-022). */
export const hiddenRetrySurface = (source: string): number =>
  (source.match(
    /for\s*\([^)]*\b(?:attempt|retry|retries|tries)\b|while\s*\([^)]*\b(?:attempt|retry|retries|tries)\b|\bretryCount\b|\bmaxRetries\b|\bbackoff\b|\bp-retry\b/gi,
  ) ?? []).length;

/** Ambient credential / configuration discovery (contract §4, §5). */
export const inferredScope = (source: string): number =>
  (source.match(
    /process\.env\s*[.[]|\.\.\.\s*process\.env\b|Object\.\w+\s*\(\s*process\.env\b|process\.cwd\s*\(|homedir\s*\(|USERPROFILE|GITHUB_TOKEN|GH_TOKEN|\.netrc|~\/\.config\/gh/g,
  ) ?? []).length;

/** Alternate origin / SSRF / redirect-following surface (contract §6, §7). */
export const originEscapeSurface = (source: string): number =>
  (source.match(
    /base_?url|baseUrl|\bendpoint\b|followRedirects?|maxRedirects|\bproxy\b|\bca:\s|rejectUnauthorized|setDefaultResultOrder|lookup\s*:|api\.github\.com\.[a-z]|githubusercontent|\.ghe\.com|enterprise/gi,
  ) ?? []).length;

/** S14G+ / future-phase execution surface pulled forward (contract §27). */
export const futurePhaseSurface = (source: string): number =>
  (source.match(
    /\bnew\s+(?:McpClient|BrowserProvider|PlaywrightProvider|PostgresProvider|WorkflowRuntime|Orchestrator|AuthManager)\b|["'`](?:browser|database|mcp|workflow)\.[a-z]/g,
  ) ?? []).length;

/** S14 / HI-054 self-closure claims (contract §27). */
export const closureClaims = (source: string): number =>
  (source.match(/\bS14\s*[:=]\s*["']?(?:CLOSED|PASS)\b|\bHI-054\s*[:=]\s*["']?AWARDED\b|\bS14G\s*[:=]\s*["']?AUTHORIZED\b/g) ?? []).length;

/**
 * AFFIRMATIVE over-claim language forbidden by contract §8 / §11 (complete DLP,
 * exactly-once writes). Only counts a claim that is NOT immediately negated.
 */
export const overclaims = (source: string): number => {
  const re = /(?:\b(?:no|not|never|never a|without|cannot|does not|doesn't|is not)\b[^.\n]{0,40})?(complete DLP|complete secret detection|exactly[- ]once|guaranteed delivery|guarantees? no duplicate)/gi;
  let count = 0;
  for (const m of source.matchAll(re)) {
    const lead = source.slice(Math.max(0, m.index - 48), m.index + m[0].length - m[1].length).toLowerCase();
    if (!/\b(?:no|not|never|without|cannot|doesn't|do not|does not)\b/.test(lead)) count++;
  }
  return count;
};

export function phaseText(): string {
  const report = "brain-bootstrap/reports/S14F-github-capability-verification.md";
  return [
    text("brain/context/CURRENT.md"),
    text("brain-bootstrap/STATE.yaml"),
    ...(existsSync(report) ? [text(report)] : []),
  ].join("\n");
}

// --- inherited baseline failures ------------------------------------------

/**
 * The 14 failing tests in `tests/git-capability/**` and `tests/shell-capability/**`
 * are PRE-EXISTING at the S14F Part A integration baseline `040cc43` — they fail
 * on a pristine clone before any S14F file exists. Root cause: those CLOSED
 * harnesses pin older continuity baselines and never exempted the two continuity
 * files (`brain-bootstrap/STATE.yaml`, `brain/context/CURRENT.md`) that later
 * phase closures legitimately rewrote. Both directories are protected surfaces
 * S14F may not modify (contract §23, §25).
 */
export const INHERITED_FAILURES = [
  "tests/git-capability/gitCapability.test.ts > canonical negatives > FX-NEG-040",
  "tests/git-capability/gitCapability.test.ts > canonical hard invariants > S14D-HI-002",
  "tests/git-capability/gitCapability.test.ts > canonical hard invariants > S14D-HI-039",
  "tests/git-capability/gitCapability.test.ts > canonical hard invariants > S14D-HI-040",
  "tests/git-capability/regressions.test.ts > the S14D candidate surface is exactly additive under the authorized prefixes",
  "tests/git-capability/unsafeCounters.test.ts > UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires",
  "tests/shell-capability/regressions.test.ts > the S14B regression-harness maintenance is exactly the authorized narrow change",
  "tests/shell-capability/shellCapability.test.ts > canonical negatives > FX-NEG-042",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-002",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-038",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-033",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-037",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-039",
  "tests/shell-capability/unsafeCounters.test.ts > UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires",
];

export const S14D_CONTINUITY_BASELINE = "b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7";
export const S14C_CONTINUITY_BASELINE = "3cd344d018dbf2d40a39a907a3494bba8f3d940b";

/**
 * Assert the CAUSE of the inherited failures rather than asserting "trust me,
 * pre-existing": the two closed harnesses pin stale baselines, they exempt no
 * continuity file, and exactly the two authorized continuity paths drifted.
 */
export function assertInheritedFailureCause(): void {
  const gitAudit = execFileSync("git", ["show", `${baseline}:tests/git-capability/audit.ts`], GIT_MAXBUF);
  const shellAudit = execFileSync("git", ["show", `${baseline}:tests/shell-capability/audit.ts`], GIT_MAXBUF);

  // 1. S14F changed nothing under either protected test surface.
  expect(text("tests/git-capability/audit.ts")).toBe(gitAudit);
  expect(text("tests/shell-capability/audit.ts")).toBe(shellAudit);

  // 2. Both harnesses pin an older continuity baseline with no continuity exemption.
  expect(gitAudit).toContain(`export const baseline = "${S14D_CONTINUITY_BASELINE}";`);
  expect(shellAudit).toContain(`export const baseline = "${S14C_CONTINUITY_BASELINE}";`);
  expect(/protectedDifferences[\s\S]{0,600}(?:STATE\.yaml|CURRENT\.md)/.test(gitAudit)).toBe(false);
  expect(/protectedDifferences[\s\S]{0,600}(?:STATE\.yaml|CURRENT\.md)/.test(shellAudit)).toBe(false);

  // 3. Exactly the two authorized continuity paths drifted between each pin and HEAD.
  for (const pin of [S14D_CONTINUITY_BASELINE, S14C_CONTINUITY_BASELINE]) {
    const drifted = execFileSync("git", ["diff", "--name-only", `${pin}..${baseline}`], GIT_MAXBUF)
      .trim().split("\n").filter(Boolean);
    expect(drifted).toContain("brain-bootstrap/STATE.yaml");
    expect(drifted).toContain("brain/context/CURRENT.md");
  }

  // 4. The S14F harness, pinned at the Part A integration baseline, is clean.
  expect(protectedDifferences()).toEqual([]);
}
