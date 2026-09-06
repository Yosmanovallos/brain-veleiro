import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

// S14C Part B builder baseline — the mechanical Part A integration commit.
export const baseline = "3cd344d018dbf2d40a39a907a3494bba8f3d940b";
export const partABlobs: Record<string, string> = {
  "brain-bootstrap/skills/SHELL_CAPABILITY_SKILL_S14C.md": "defbd27f7787a42b2a797c178f75668db65502db",
  "brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml": "a0b84708dc7619648321004fe18d8d429becf84b",
  "brain-bootstrap/specs/SHELL_CAPABILITY_CONTRACT_S14C.md": "8626698c94aae66e74cd96d654625dcb638d7a47",
};

export const text = (path: string): string => readFileSync(path, "utf8");
export const blob = (bytes: Buffer): string => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

export function productionSources(): string {
  const dir = "src/providers/capability/shell";
  return readdirSync(dir).filter(p => p.endsWith(".ts")).map(p => text(join(dir, p))).join("\n");
}

// Round 2 has exactly one authorized modification of a pre-existing tracked file:
// the narrow S14B regression-harness maintenance (see s14bAuditMaintenanceExact).
export const ALLOWED_MODIFIED = ["tests/filesystem-capability/audit.ts"];

// Every OTHER tracked file at `baseline` must still be byte-identical.
export function protectedDifferences(): string[] {
  const tracked = execFileSync("git", ["ls-tree", "-r", "--format=%(objectname) %(path)", baseline], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim().split("\n");
  return tracked.flatMap(line => {
    const hash = line.slice(0, 40);
    const path = line.slice(41);
    if (ALLOWED_MODIFIED.includes(path)) return [];
    if (!existsSync(path)) return [path];
    return blob(readFileSync(path)) === hash ? [] : [path];
  });
}

// New candidate files must be additions under an authorized S14C path.
const ALLOWED_ADD_PREFIXES = ["src/providers/capability/shell/", "tests/shell-capability/", "brain-bootstrap/reports/S14C-"];
/** Baseline -> current worktree changes, working both before and after commit. */
export function candidateChanges(): Array<{ status: string; path: string }> {
  const tracked = execFileSync("git", ["diff", "--name-status", baseline], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .trim().split("\n").filter(Boolean)
    .map(line => { const [status, ...rest] = line.split("\t"); return { status: status[0], path: rest.join("\t") }; });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .trim().split("\n").filter(Boolean)
    .map(path => ({ status: "A", path }));
  return [...tracked, ...untracked];
}

/** Part A canonical blobs are byte-identical at the candidate. */
export function partAIntact(): void {
  for (const [path, want] of Object.entries(partABlobs)) {
    const got = execFileSync("git", ["rev-parse", `HEAD:${path}`], { encoding: "utf8" }).trim();
    expect(got).toBe(want);
  }
}

/**
 * Prove the modification of `tests/filesystem-capability/audit.ts` is EXACTLY the
 * authorized narrow maintenance: exempt only `STATE.yaml` and `CURRENT.md` from
 * `protectedDifferences()`, keep the `registryFiles` special case, keep
 * `registryPatchOnly()` byte-identical, and change nothing else.
 */
export function s14bAuditMaintenanceExact(): void {
  const path = "tests/filesystem-capability/audit.ts";
  const before = execFileSync("git", ["show", `${baseline}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const registryLine = 'export const registryFiles = ["src/providers/capability/registry/validation.ts", "src/providers/capability/registry/capabilityRegistryProvider.ts"];';
  const guardOld = "    if (registryFiles.includes(p)) return [];";
  const guardNew = "    if (registryFiles.includes(p) || acceptedContinuityFiles.includes(p)) return [];";
  const continuityConst = 'export const acceptedContinuityFiles = ["brain-bootstrap/STATE.yaml", "brain/context/CURRENT.md"];';
  // baseline preconditions for the transform to be well-defined
  expect(before.includes(registryLine)).toBe(true);
  expect(before.includes(guardOld)).toBe(true);
  expect(before.includes("acceptedContinuityFiles")).toBe(false);

  const expected = before
    .replace(registryLine,
      `${registryLine}\n// Continuity metadata the ACCEPTED S14B phase-closure intentionally rewrote after\n// \`baseline\`. These two paths only are exempt from the byte-for-byte protected\n// comparison; every other tracked file at \`baseline\` stays fully protected.\n${continuityConst}`)
    .replace(guardOld, guardNew);

  expect(text(path)).toBe(expected);

  // The forward transform above already proves every other line — including
  // `registryPatchOnly()` and the frozen `990483…` baseline SHA — is byte-identical
  // to `${baseline}:tests/filesystem-capability/audit.ts`. These are cross-checks:
  const lines = before.split("\n");
  const patchStart = lines.findIndex(l => l.startsWith("export function registryPatchOnly()"));
  const patchLen = lines.slice(patchStart).findIndex((l, i) => i > 0 && l === "}") + 1;
  const patchBefore = lines.slice(patchStart, patchStart + patchLen).join("\n");
  expect(text(path).includes(patchBefore)).toBe(true);
  expect(text(path).includes('export const baseline = "990483118d623d4af5caf6b2d05cb79a4a3feb02";')).toBe(true);
  expect(text(path).includes("if (registryFiles.includes(p) || acceptedContinuityFiles.includes(p)) return [];")).toBe(true);
}

/** Runtime cross-checks of the S14B maintenance, assertable on their own. */
export async function s14bAuditMaintenanceMechanical(): Promise<void> {
  const mod = await import("../filesystem-capability/audit.js");
  // exactly and only the two continuity paths are exempt
  expect(mod.acceptedContinuityFiles).toEqual(["brain-bootstrap/STATE.yaml", "brain/context/CURRENT.md"]);
  // the registryFiles special case is preserved unchanged
  expect(mod.registryFiles).toEqual(["src/providers/capability/registry/validation.ts", "src/providers/capability/registry/capabilityRegistryProvider.ts"]);
  // no OTHER tracked S14B baseline file drifted
  expect(protectedDifferences()).toEqual([]);
  s14bAuditMaintenanceExact();
}

export function assertBoundaries(): void {
  expect(protectedDifferences()).toEqual([]);
  const changes = candidateChanges();
  const additions = changes.filter(c => c.status === "A");
  const modifications = changes.filter(c => c.status !== "A");
  expect(additions.every(c => ALLOWED_ADD_PREFIXES.some(prefix => c.path.startsWith(prefix)))).toBe(true);
  expect(modifications.map(c => `${c.status}\t${c.path}`)).toEqual(["M\ttests/filesystem-capability/audit.ts"]);
  partAIntact();
  s14bAuditMaintenanceExact();
}

// Hidden workspace-root inference — identical to the S14B scanner.
export const inferredScope = (source: string): number =>
  (source.match(/process\.(?:cwd|env)|homedir\s*\(|USERPROFILE|git\s+rev-parse/g) ?? []).length;

// Future-phase / non-canonical execution surface. NOTE: unlike the S14B
// `futureSurface` scanner this MUST allow `node:child_process` — it is S14C's
// authorized execution mechanism. It forbids a shell parser, exec-style command
// strings, PTY, raw network, and later-phase connectors instead.
export const shellFutureSurface = (source: string): number =>
  (source.match(/shell\s*:\s*true|\/bin\/sh\b|-c\s+["'`]|\bexecSync\s*\(|\bexecFileSync\s*\(|\.exec\s*\(|\bnode-pty\b|["'](?:node:)?(?:https?|net|tls|dgram)["']|\bfetch\s*\(|\b(?:Octokit|McpClient|OAuthClient|WorkflowRuntime|Orchestrator)\b|\bgit\s+(?:rev-parse|clone|commit|push|fetch)\b/g) ?? []).length;

export const closureClaims = (source: string): number =>
  (source.match(/\bS14\s*[:=]\s*["']?(?:CLOSED|PASS)\b|\bHI-054\s*[:=]\s*["']?AWARDED\b/g) ?? []).length;

export function phaseText(): string {
  const report = "brain-bootstrap/reports/S14C-shell-capability-verification.md";
  return [text("brain/context/CURRENT.md"), text("brain-bootstrap/STATE.yaml"), ...(existsSync(report) ? [text(report)] : [])].join("\n");
}

// S14C-HI-014 / contract §32: nothing but the synchronous deadline check may sit
// between the final executable-identity recheck and the spawn call.
export function finalSpawnGap(): string {
  const src = text("src/providers/capability/shell/workspaceShellCapabilityProvider.ts");
  const start = src.lastIndexOf("await this.recheckExecutable(");
  const spawnAt = src.indexOf("startProcessGroup(", start);
  if (start < 0 || spawnAt < 0) throw new Error("final pre-spawn window markers not found");
  return src.slice(src.indexOf(";", start) + 1, spawnAt);
}
export const unrelatedAwaits = (gap: string): number => (gap.match(/\bawait\b|\.then\s*\(/g) ?? []).length;

export function startGroupBodyAwaits(): number {
  const src = text("src/providers/capability/shell/execution.ts");
  const start = src.indexOf("export function startProcessGroup(");
  const end = src.indexOf("\n}", start);
  if (start < 0 || end < 0) throw new Error("startProcessGroup body markers not found");
  return (src.slice(start, end).match(/\bawait\b|\.then\s*\(/g) ?? []).length;
}
