import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

export const baseline = "28acc89f00d62d5cdb626f3eee2e93ade69b0227";
export const registryFiles = ["src/providers/capability/registry/validation.ts", "src/providers/capability/registry/capabilityRegistryProvider.ts"];
export const text = (path: string) => readFileSync(path, "utf8");
export const prior = (path: string) => execFileSync("git", ["show", `${baseline}:${path}`], { maxBuffer: 8 * 1024 * 1024 });
export function productionSources(): string {
  const dir = "src/providers/capability/filesystem";
  return readdirSync(dir).filter(p => p.endsWith(".ts")).map(p => text(join(dir, p))).join("\n");
}
export const blob = (bytes: Buffer) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
export function protectedDifferences(): string[] {
  const tracked = execFileSync("git", ["ls-tree", "-r", "--format=%(objectname) %(path)", baseline], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim().split("\n");
  return tracked.flatMap(line => {
    const hash = line.slice(0, 40); const p = line.slice(41);
    if (registryFiles.includes(p)) return [];
    if (!existsSync(p)) return [p];
    return blob(readFileSync(p)) === hash ? [] : [p];
  });
}
export function registryPatchOnly() {
  const originalValidation = prior(registryFiles[0]).toString();
  const candidateValidation = text(registryFiles[0]);
  expect(candidateValidation).toBe(originalValidation
    .replace("export function canonical(value: unknown): string {", "export function canonical(value: unknown): string {\n  return canonicalWithin(value, 100000);\n}\n\nexport function canonicalToolResult(value: unknown): string {\n  return canonicalWithin(value, 8388608);\n}\n\nfunction canonicalWithin(value: unknown, maxChars: number): string {")
    .replace("text.length > 100000", "text.length > maxChars")
    .replace("ref.length > LIMITS.description", "ref.length > 8192"));
  expect(text(registryFiles[1])).toBe(prior(registryFiles[1]).toString().replace("{ canonical, LIMITS", "{ canonicalToolResult, LIMITS").replace("canonical(raw);", "canonicalToolResult(raw);"));
}
export function assertBoundaries() { expect(protectedDifferences()).toEqual([]); registryPatchOnly(); }
export const inferredScope = (source: string) => (source.match(/process\.(?:cwd|env)|homedir\s*\(|USERPROFILE|git\s+rev-parse/g) ?? []).length;
export const futureSurface = (source: string) => (source.match(/["'](?:node:)?(?:child_process|https?|net|tls)["']|\bfetch\s*\(|filesystem\.(?:delete|mkdir|rename|move|chmod|watch)|\b(?:McpClient|OAuthClient|Orchestrator|WorkflowRuntime)\b/g) ?? []).length;
export const closureClaims = (source: string) => (source.match(/\bS14\s*[:=]\s*["']?(?:CLOSED|PASS)\b|\bHI-054\s*[:=]\s*["']?AWARDED\b/g) ?? []).length;
export function phaseText() {
  const report = "brain-bootstrap/reports/S14B-filesystem-capability-verification.md";
  return [text("brain/context/CURRENT.md"), text("brain-bootstrap/STATE.yaml"), ...(existsSync(report) ? [text(report)] : [])].join("\n");
}
