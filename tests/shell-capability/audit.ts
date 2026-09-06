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

// S14C adds only new files; every tracked file at `baseline` must still be
// byte-identical. No file is excluded — S14C is authorized to modify none.
export function protectedDifferences(): string[] {
  const tracked = execFileSync("git", ["ls-tree", "-r", "--format=%(objectname) %(path)", baseline], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim().split("\n");
  return tracked.flatMap(line => {
    const hash = line.slice(0, 40);
    const path = line.slice(41);
    if (!existsSync(path)) return [path];
    return blob(readFileSync(path)) === hash ? [] : [path];
  });
}

// Every candidate change must be an ADDITION under an authorized S14C path.
const ALLOWED_ADD_PREFIXES = ["src/providers/capability/shell/", "tests/shell-capability/", "brain-bootstrap/reports/S14C-"];
export function candidateAdditions(): Array<{ status: string; path: string }> {
  return execFileSync("git", ["diff", "--name-status", baseline, "HEAD"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
    .trim().split("\n").filter(Boolean)
    .map(line => { const [status, ...rest] = line.split("\t"); return { status, path: rest.join("\t") }; });
}

/** Part A canonical blobs are byte-identical at the candidate. */
export function partAIntact(): void {
  for (const [path, want] of Object.entries(partABlobs)) {
    const got = execFileSync("git", ["rev-parse", `HEAD:${path}`], { encoding: "utf8" }).trim();
    expect(got).toBe(want);
  }
}

export function assertBoundaries(): void {
  expect(protectedDifferences()).toEqual([]);
  const changes = candidateAdditions();
  expect(changes.every(c => c.status === "A")).toBe(true);
  expect(changes.every(c => ALLOWED_ADD_PREFIXES.some(prefix => c.path.startsWith(prefix)))).toBe(true);
  partAIntact();
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
