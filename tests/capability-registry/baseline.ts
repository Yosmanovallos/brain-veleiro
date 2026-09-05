import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Baseline git blob identities captured at S14A candidate baseline
 * ed95a984b41a8ae5df1d494743ec01b11dcf2381 (`git rev-parse HEAD:<path>`),
 * BEFORE any S14A Part B production/test file was added. Used to prove
 * protected surfaces are byte-identical after S14A implementation
 * (FX-NEG-021/022/023/027, S14A-HI-008/009/025/026, UC08/UC09/UC11).
 */
export const BASELINE_COMMIT = "ed95a984b41a8ae5df1d494743ec01b11dcf2381";

export const PROTECTED_BLOBS: Record<string, string> = {
  "src/core/agent/types.ts": "a832376ac38ed2ee0dbde941d700d5b116586f02",
  "src/core/agent/restrictedCapabilityProvider.ts": "40797515c7c55284dd97d3614b978f869aaaa486",
  "src/core/agent/definition.ts": "00fd4aa5876ed29152dd2151900103e7ea72351e",
  "src/intelligence/task-prompt-compiler/types.ts": "8fea88535fcdabfcdb956182cab2cd1b7eeddd9b",
  "src/intelligence/skills/definitions/taskPromptCompilerS13G.ts": "a602bd483374d12982c8576d938f6820b724304b",
  "src/intelligence/skills/definitions/repositoryGitWorkflowS13H.ts": "2aee101cf00656a3e3c865aaaa98683f438b9117",
  "package.json": "59ce9653a6a54483625d318ee17bedae7ad2eb44",
  "package-lock.json": "6d9cb3ceb9cdbf9b88f889f28cb165eaecc2810e",
  "brain-bootstrap/skills/CAPABILITY_REGISTRY_TOOLS_MCP_SKILL_S14.md": "55a855d8223129b5cc5378bd2ba54671b7c991f3",
  "brain-bootstrap/quality-contracts/S14_CAPABILITY_REGISTRY_TOOLS_MCP_DEEP.yaml":
    "844ed67ff73b0f8f178407c2d7378135b3bc4045",
  "brain-bootstrap/specs/CAPABILITY_REGISTRY_TOOLS_MCP_CONTRACT_S14.md": "78564d6ccc1369f692a68d942e17e268d90df855",
};

/** Replicates `git hash-object`: sha1("blob " + byteLength + "\0" + content). */
export function gitBlobSha1(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  return createHash("sha1").update(Buffer.concat([header, content])).digest("hex");
}

export function currentBlobSha1(relativePath: string): string {
  const bytes = readFileSync(join(process.cwd(), relativePath));
  return gitBlobSha1(bytes);
}
