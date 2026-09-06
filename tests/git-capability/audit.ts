import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

/**
 * S14D Part B builder baseline — the exact authorized remote main
 * (control-plane: Part B authorization comment 5562679259).
 */
export const baseline = "b41f4fe5bb1b7562bf0ece080f344beb4de3b8f7";
export const partAParent = "4bceeb777127655369ff274b490233764c3e9fd9";

/** Canonical S14D Part A blob identities at HEAD (contract §4, §44). */
export const partABlobs: Record<string, string> = {
  "brain-bootstrap/skills/GIT_CAPABILITY_SKILL_S14D.md": "029661c9e7387c14f98599e3aa98141e72aeaae0",
  "brain-bootstrap/quality-contracts/S14D_GIT_DEEP.yaml": "f4f5f2353413afd078ee3e53eb4cbd246efea416",
  "brain-bootstrap/specs/GIT_CAPABILITY_CONTRACT_S14D.md": "c30b25be01080a89e4e6463b0fd3280929999c99",
};
export const partASha256: Record<string, string> = {
  "brain-bootstrap/skills/GIT_CAPABILITY_SKILL_S14D.md": "5deef86117a8e504f6de4c3c5af1b14a6fb249624a2d77c1d9e5d029757eb70b",
  "brain-bootstrap/quality-contracts/S14D_GIT_DEEP.yaml": "cf10efa00b0bcb5ab831dfb17799dd5e39af0d1c66d3f76cbc9152a73ea7d8d9",
  "brain-bootstrap/specs/GIT_CAPABILITY_CONTRACT_S14D.md": "195af8caed6f593179e662d26c5b5cad19a6e0a5e0987da4c38d1363c691ae56",
};

export const text = (path: string): string => readFileSync(path, "utf8");
export const blobSha1 = (bytes: Buffer): string =>
  createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const GIT_MAXBUF = { encoding: "utf8" as const, maxBuffer: 64 * 1024 * 1024 };

// --- authorized S14D candidate surface -----------------------------------

/** Additions are permitted ONLY under these prefixes. No existing file may change. */
export const ALLOWED_ADD_PREFIXES = [
  "src/providers/capability/git/",
  "tests/git-capability/",
  "brain-bootstrap/reports/S14D-git-capability-verification.md",
];
/** S14D adds ZERO authorized modifications of pre-existing tracked files (contract §44). */
export const ALLOWED_MODIFIED: string[] = [];

export function productionSources(): string {
  const dir = "src/providers/capability/git";
  return readdirSync(dir).filter(p => p.endsWith(".ts")).sort().map(p => text(join(dir, p))).join("\n");
}
export function productionSourceFiles(): string[] {
  const dir = "src/providers/capability/git";
  return readdirSync(dir).filter(p => p.endsWith(".ts")).sort().map(p => join(dir, p));
}

/** Every tracked file at `baseline` must still be byte-identical (nothing is exempt). */
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

/** Part A canonical blobs are byte-identical at the candidate (contract §4). */
export function partAIntact(): void {
  for (const [path, want] of Object.entries(partABlobs)) {
    const got = execFileSync("git", ["rev-parse", `HEAD:${path}`], { encoding: "utf8" }).trim();
    expect(got).toBe(want);
  }
  for (const [path, want] of Object.entries(partASha256)) {
    expect(sha256(readFileSync(path))).toBe(want);
  }
}

/**
 * Mechanically verify the protected S14D boundary (contract §44):
 * only additions under authorized prefixes, zero modifications / deletions /
 * renames / copies of pre-existing files, Part A intact, package manifests and
 * continuity files untouched, and no S14E+ artifact.
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
  // No S14E+ canonical artifact was pulled forward.
  const s14ePlus = execFileSync("git", ["ls-files"], GIT_MAXBUF).trim().split("\n")
    .filter(p => /S14[E-Z]|S1[5-9]|S[2-9]\d/.test(p));
  expect(s14ePlus).toEqual([]);
}

// --- source-level structural scanners -----------------------------------

/** Hidden repository-root / discovery inference (skill §9, contract §25). */
export const inferredScope = (source: string): number =>
  (source.match(/process\.cwd\s*\(|process\.env\s*[.\[]|homedir\s*\(|USERPROFILE|--show-toplevel|rev-parse[^"'\n]*--git-dir/g) ?? []).length;

/** Actual `process.env` READS (a prose mention in a doc comment is not one). */
export const processEnvReads = (source: string): number =>
  (source.match(/process\.env\s*[.\[]|\.\.\.\s*process\.env\b|Object\.\w+\s*\(\s*process\.env\b/g) ?? []).length;

/** Files that IMPORT node:child_process (only process.ts may). */
export const importsChildProcess = (source: string): number =>
  (source.match(/from ["'](?:node:)?child_process["']|require\(\s*["'](?:node:)?child_process["']\s*\)/g) ?? []).length;

/**
 * Future-phase / non-canonical / mutation / network execution surface
 * (contract §11.1, §17, §21). NOTE: `node:child_process` IS S14D's authorized
 * mechanism (in process.ts only) so it is NOT flagged here; a shell parser, a
 * PTY, a raw network module, a remote connector class, `fetch()` or a
 * later-phase `repository.*` verb IS. The absence of a mutation/network Git
 * subcommand is asserted structurally against `buildArgv` output +
 * `STRUCTURAL_DENY_SET`, not by scanning bare words here (the deny-set is data).
 */
export const forbiddenSurface = (source: string): number =>
  (source.match(
    /shell\s*:\s*true|\/bin\/sh\b|\bnode-pty\b|from ["'](?:node:)?(?:https?|net|tls|dgram)["']|require\(["'](?:node:)?(?:https?|net|tls|dgram)["']\)|\bfetch\s*\(|\bnew\s+(?:Octokit|McpClient|OAuthClient|WorkflowRuntime|Orchestrator)\b|["']repository\.(?:diff|log|show|commit|stage|branch|checkout|push|fetch|pull|clone)["']/g,
  ) ?? []).length;

/** S14 / HI-054 self-closure claims — the exact S14C-parity scanner (contract §43, §48). */
export const closureClaims = (source: string): number =>
  (source.match(/\bS14\s*[:=]\s*["']?(?:CLOSED|PASS)\b|\bHI-054\s*[:=]\s*["']?AWARDED\b/g) ?? []).length;

/**
 * AFFIRMATIVE over-claim language the residuals contract (§48) forbids. Only
 * counts a claim that is NOT immediately negated ("no", "not", "never",
 * "without", "does not"). Intended for the verification report, not source
 * comments (which legitimately carry the negated disclaimers).
 */
export const overclaims = (source: string): number => {
  const re = /(?:\b(?:no|not|never|without|cannot|does not|doesn't|no claim of)\b[^.\n]{0,40})?(complete secret detection|OS[- ]level sandbox|universal (?:hostile-git |daemon )?containment|atomic (?:executable invocation|fexecve|race-free exec)|guaranteed (?:extinction|rollback|process-group termination)|transaction isolation)/gi;
  let count = 0;
  for (const m of source.matchAll(re)) {
    const lead = source.slice(Math.max(0, m.index - 40), m.index + m[0].length - m[1].length).toLowerCase();
    if (!/\b(?:no|not|never|without|cannot|doesn't|do not|does not)\b/.test(lead)) count++;
  }
  return count;
};

export function phaseText(): string {
  const report = "brain-bootstrap/reports/S14D-git-capability-verification.md";
  return [text("brain/context/CURRENT.md"), text("brain-bootstrap/STATE.yaml"), ...(existsSync(report) ? [text(report)] : [])].join("\n");
}

// --- final pre-spawn window (contract §8, §29) --------------------------

/** Source between the last executable-identity recheck and the spawn call. */
export function finalSpawnGap(): string {
  const src = text("src/providers/capability/git/workspaceGitCapabilityProvider.ts");
  const start = src.lastIndexOf("await this.recheckExecutable(");
  const spawnAt = src.indexOf("startGitProcess(", start);
  if (start < 0 || spawnAt < 0) throw new Error("final pre-spawn window markers not found");
  return src.slice(src.indexOf(";", start) + 1, spawnAt);
}
export const unrelatedAwaits = (gap: string): number => (gap.match(/\bawait\b|\.then\s*\(/g) ?? []).length;

export function startGitProcessBodyAwaits(): number {
  const src = text("src/providers/capability/git/process.ts");
  const start = src.indexOf("export function startGitProcess(");
  const end = src.indexOf("\n}", start);
  if (start < 0 || end < 0) throw new Error("startGitProcess body markers not found");
  return (src.slice(start, end).match(/\bawait\b|\.then\s*\(/g) ?? []).length;
}

// --- pre-existing inherited S14C harness failures ----------------------

/**
 * The 8 failing tests in `tests/shell-capability/**` are PRE-EXISTING at the
 * S14D builder baseline `b41f4fe` — they fail on a pristine clone before any
 * S14D file exists. Root cause: the CLOSED S14C test harness pins its
 * continuity baseline at `3cd344d…` and never exempted the two continuity
 * files that the S14C phase closure + S14D Part A integration legitimately
 * rewrote afterwards. `tests/shell-capability/**` is a protected surface S14D
 * may not modify (contract §43, §20; skill §20).
 *
 * This asserts the CAUSE, converting "trust me, pre-existing" into a fireable
 * check an auditor can re-run.
 */
export const S14C_CONTINUITY_BASELINE = "3cd344d018dbf2d40a39a907a3494bba8f3d940b";
export const PRE_EXISTING_S14C_FAILURES = [
  "tests/shell-capability/regressions.test.ts > the S14B regression-harness maintenance is exactly the authorized narrow change",
  "tests/shell-capability/unsafeCounters.test.ts > UC10 protected_boundary_or_dependency_modified: zero drift; mutated-byte detector fires",
  "tests/shell-capability/shellCapability.test.ts > canonical negatives > FX-NEG-042",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-002",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-033",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-037",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-038",
  "tests/shell-capability/shellCapability.test.ts > canonical hard invariants > S14C-HI-039",
];

export function assertPreExistingS14CFailureCause(): void {
  // 1. S14D changed nothing under tests/shell-capability/**.
  const shellAuditNow = readFileSync("tests/shell-capability/audit.ts");
  const shellAuditBaseline = execFileSync("git", ["show", `${baseline}:tests/shell-capability/audit.ts`], GIT_MAXBUF);
  expect(shellAuditNow.toString("utf8")).toBe(shellAuditBaseline);

  // 2. The S14C harness pins the stale continuity baseline, and its OWN
  //    protectedDifferences() exempts only the two filesystem test files — it
  //    never added a STATE.yaml / CURRENT.md continuity exemption.
  expect(shellAuditBaseline).toContain(`export const baseline = "${S14C_CONTINUITY_BASELINE}";`);
  expect(shellAuditBaseline).toContain('export const ALLOWED_MODIFIED = [\n  "tests/filesystem-capability/audit.ts",\n  "tests/filesystem-capability/concurrencyExercises.ts",\n];');
  expect(/protectedDifferences[\s\S]{0,600}(?:STATE\.yaml|CURRENT\.md)/.test(shellAuditBaseline)).toBe(false);

  // 3. The two continuity files legitimately drifted between that pin and HEAD.
  const drifted = execFileSync("git", ["diff", "--name-only", `${S14C_CONTINUITY_BASELINE}..HEAD`], GIT_MAXBUF)
    .trim().split("\n");
  expect(drifted).toContain("brain-bootstrap/STATE.yaml");
  expect(drifted).toContain("brain/context/CURRENT.md");

  // 4. Every other tracked shell-capability file is also byte-identical to baseline.
  const shellFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", `${baseline}`, "tests/shell-capability/"], GIT_MAXBUF)
    .trim().split("\n").filter(Boolean);
  for (const f of shellFiles) {
    const want = execFileSync("git", ["rev-parse", `${baseline}:${f}`], { encoding: "utf8" }).trim();
    expect(blobSha1(readFileSync(f))).toBe(want);
  }
}
