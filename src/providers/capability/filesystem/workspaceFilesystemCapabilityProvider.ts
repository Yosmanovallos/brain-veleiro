import fs, { type FileHandle } from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import { isAbsolute } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { CapabilityProvider, ToolDescriptor, ToolInvocationRequest, ToolInvocationResult, NormalizedToolError } from "../../../core/agent/types.js";
import { sensitive } from "../registry/validation.js";

export interface WorkspaceFilesystemConfig {
  workspace_root: string;
  read_allow_prefixes: string[];
  write_allow_prefixes: string[];
}

const MAX_BYTES = 1048576;
const MAX_ENTRIES = 1000;
const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const fileFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const temporaryNames = new Map<string, Set<string>>();
const wellFormed = (value: string) => !/[\uD800-\uDFFF]/u.test(value);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const anchor = (handle: FileHandle) => `/proc/self/fd/${handle.fd}`;
const same = (a: Stats, b: Stats) => a.dev === b.dev && a.ino === b.ino;
const directoryKey = (stat: Stats) => `${stat.dev}:${stat.ino}`;

class Rejection extends Error {
  constructor(readonly code: NormalizedToolError["code"] | "BLOCKED") { super("Filesystem operation rejected."); }
}
function reject(code: NormalizedToolError["code"] | "BLOCKED"): never { throw new Rejection(code); }
function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).every(key => typeof key === "string" && "value" in Object.getOwnPropertyDescriptor(value, key)!);
}
function logical(value: unknown, root = false): string[] {
  if (typeof value !== "string" || !value || value.length > 4096 || !wellFormed(value) || value.includes("\0") || value.includes("\\") || value.startsWith("/") || /^[a-z]:/i.test(value)) reject("INVALID_INPUT");
  if (value === "." && root) return [];
  const parts = value.split("/");
  if (parts.length > 256 || parts.some(p => !p || p === "." || p === ".." || Buffer.byteLength(p) > 255)) reject("INVALID_INPUT");
  return parts;
}
function protectedPath(parts: string[]): boolean {
  return parts.some(p => {
    const n = p.toLowerCase();
    return [".git", ".ssh", ".gnupg", ".aws", ".azure", ".kube", ".npmrc", ".pypirc", ".netrc"].includes(n) ||
      n === ".env" || (n.startsWith(".env.") && n !== ".env.example") || n.endsWith(".pem") || n.endsWith(".key");
  });
}
function prefixes(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 64 || Object.keys(value).length !== value.length) reject("INVALID_INPUT");
  return value.map(p => { logical(p, true); return p as string; });
}
class Deadline {
  readonly start = performance.now();
  constructor(readonly timeout: number) {}
  check() { if (performance.now() - this.start >= this.timeout) reject("TIMEOUT"); }
  duration() { return Math.max(0, performance.now() - this.start); }
}
type Chain = { handle: FileHandle; stat: Stats; name?: string }[];

const pathSchema = { type: "string", minLength: 1, maxLength: 4096 };
const descriptors: ToolDescriptor[] = [
  { capability_id: "filesystem.read", name: "Read workspace text", description: "Read one permitted regular UTF-8 file, at most 1048576 bytes, with its SHA-256.", side_effects: "NONE",
    input_schema: { type: "object", properties: { path: pathSchema }, required: ["path"], additionalProperties: false },
    output_schema: { type: "object", required: ["path", "content", "bytes", "sha256"], properties: { path: pathSchema, content: { type: "string" }, bytes: { type: "integer", maximum: MAX_BYTES }, sha256: { type: "string" } } } },
  { capability_id: "filesystem.list", name: "List workspace directory", description: "List one permitted directory non-recursively, at most 1000 sorted entries. Use . for the workspace root.", side_effects: "NONE",
    input_schema: { type: "object", properties: { path: pathSchema }, required: ["path"], additionalProperties: false },
    output_schema: { type: "object", required: ["path", "entries"], properties: { path: pathSchema, entries: { type: "array", maxItems: MAX_ENTRIES, items: { type: "object", required: ["name", "kind"], properties: { name: { type: "string" }, kind: { enum: ["FILE", "DIRECTORY", "SYMLINK", "OTHER"] } } } } } } },
  { capability_id: "filesystem.write", name: "Write workspace text", description: "Create new text without clobbering, or atomically replace an existing single-link file with a matching expected SHA-256. Maximum 1048576 UTF-8 bytes.", side_effects: "LOCAL",
    input_schema: { type: "object", properties: { path: pathSchema, content: { type: "string", maxLength: MAX_BYTES }, mode: { enum: ["CREATE_NEW", "OVERWRITE_EXISTING"] }, expected_sha256: { type: "string", pattern: "^[a-f0-9]{64}$" } }, required: ["path", "content", "mode"], additionalProperties: false },
    output_schema: { type: "object", required: ["path", "bytes_written", "sha256", "created"], properties: { path: pathSchema, bytes_written: { type: "integer", maximum: MAX_BYTES }, sha256: { type: "string" }, created: { type: "boolean" } } } },
];

export class WorkspaceFilesystemCapabilityProvider implements CapabilityProvider {
  private constructor(private readonly root: string, private readonly rootStat: Stats, private readonly readPrefixes: string[], private readonly writePrefixes: string[]) {}

  static async create(config: WorkspaceFilesystemConfig): Promise<WorkspaceFilesystemCapabilityProvider> {
    try {
      if (!plain(config) || Object.keys(config).some(k => !["workspace_root", "read_allow_prefixes", "write_allow_prefixes"].includes(k)) ||
          typeof config.workspace_root !== "string" || !isAbsolute(config.workspace_root) || config.workspace_root.includes("\0") || !wellFormed(config.workspace_root)) reject("INVALID_INPUT");
      const read = prefixes(config.read_allow_prefixes);
      const write = prefixes(config.write_allow_prefixes);
      if (process.platform !== "linux" || !constants.O_NOFOLLOW || !constants.O_DIRECTORY) reject("UNAVAILABLE");
      const root = await fs.realpath(config.workspace_root);
      const handle = await fs.open(root, directoryFlags);
      try {
        const stat = await handle.stat();
        if (!stat.isDirectory() || !same(stat, await fs.stat(anchor(handle)))) reject("UNAVAILABLE");
        return new WorkspaceFilesystemCapabilityProvider(root, stat, read, write);
      } finally { await handle.close(); }
    } catch { throw new Error("Invalid or unavailable explicit filesystem workspace configuration."); }
  }

  async list_capabilities(): Promise<ToolDescriptor[]> { return structuredClone(descriptors); }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const deadline = new Deadline(request.timeout_ms);
    const identity = { call_id: request.call_id, capability_id: request.capability_id };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!Number.isFinite(request.timeout_ms) || request.timeout_ms <= 0 || !plain(request.input)) reject("INVALID_INPUT");
      const id = request.capability_id;
      if (!descriptors.some(d => d.capability_id === id)) reject("BLOCKED");
      const input = { ...request.input };
      const writing = id === "filesystem.write";
      if (Object.keys(input).some(k => !(writing ? ["path", "content", "mode", "expected_sha256"] : ["path"]).includes(k))) reject("INVALID_INPUT");
      const parts = logical(input.path, id === "filesystem.list");
      const path = input.path as string;
      if (protectedPath(parts) || sensitive(path) || path.includes(this.root)) reject("BLOCKED");
      const scopes = writing ? this.writePrefixes : this.readPrefixes;
      if (!scopes.some(p => p === "." || path === p || path.startsWith(p + "/"))) reject("BLOCKED");
      let bytes: Buffer | undefined;
      if (writing) {
        if (typeof input.content !== "string" || input.content.length > MAX_BYTES || !wellFormed(input.content) ||
            !["CREATE_NEW", "OVERWRITE_EXISTING"].includes(input.mode as string) ||
            (input.mode === "OVERWRITE_EXISTING" && (typeof input.expected_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.expected_sha256))) ||
            (input.mode === "CREATE_NEW" && input.expected_sha256 !== undefined)) reject("INVALID_INPUT");
        bytes = Buffer.from(input.content, "utf8");
        if (bytes.length > MAX_BYTES) reject("INVALID_INPUT");
        if (sensitive(input.content) || input.content.includes(this.root)) reject("BLOCKED");
      }
      deadline.check();
      const operation = this.perform(id, path, parts, input, bytes, deadline);
      const result = writing ? await operation : await Promise.race([operation, new Promise<never>((_resolve, rejectTimeout) => {
        timer = setTimeout(() => rejectTimeout(new Rejection("TIMEOUT")), Math.min(request.timeout_ms, 2147483647));
      })]);
      return { status: "SUCCESS", ...identity, output: result, evidence_refs: [`workspace://${path}`], duration_ms: deadline.duration() };
    } catch (error) {
      const code = error instanceof Rejection ? error.code : this.errorCode(error);
      if (code === "BLOCKED") return { status: "BLOCKED", ...identity, reason: "Filesystem policy or safety precondition denied the operation.", duration_ms: deadline.duration() };
      return { status: "FAIL", ...identity, error: { code, message: "Filesystem operation could not complete safely.", retryable: code === "TIMEOUT" }, duration_ms: deadline.duration() };
    } finally { if (timer) clearTimeout(timer); }
  }

  private errorCode(error: unknown): NormalizedToolError["code"] | "BLOCKED" {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") return "NOT_FOUND";
    if (code === "EACCES" || code === "EPERM") return "PERMISSION_DENIED";
    if (code === "ELOOP" || code === "EEXIST") return "BLOCKED";
    if (code === "ENOTDIR" || code === "EISDIR" || code === "ENAMETOOLONG") return "INVALID_INPUT";
    return "EXECUTION_FAILED";
  }

  private async chain(parts: string[], deadline: Deadline): Promise<Chain> {
    const chain: Chain = [];
    try {
      deadline.check();
      const root = await fs.open(this.root, directoryFlags);
      chain.push({ handle: root, stat: this.rootStat });
      if (!same(await root.stat(), this.rootStat)) reject("BLOCKED");
      for (const name of parts) {
        deadline.check();
        const parent = chain.at(-1)!;
        const path = `${anchor(parent.handle)}/${name}`;
        const stat = await fs.lstat(path);
        if (stat.isSymbolicLink()) reject("BLOCKED");
        if (!stat.isDirectory()) reject("INVALID_INPUT");
        const handle = await fs.open(path, directoryFlags);
        chain.push({ handle, stat, name });
        if (!same(stat, await handle.stat())) reject("BLOCKED");
      }
      await this.checkChain(chain, deadline);
      return chain;
    } catch (error) { await this.closeChain(chain); throw error; }
  }

  private async checkChain(chain: Chain, deadline: Deadline) {
    deadline.check();
    const root = await fs.lstat(this.root);
    if (root.isSymbolicLink() || !same(root, this.rootStat)) reject("BLOCKED");
    for (let i = 1; i < chain.length; i++) {
      const stat = await fs.lstat(`${anchor(chain[i - 1].handle)}/${chain[i].name}`);
      if (stat.isSymbolicLink() || !stat.isDirectory() || !same(stat, chain[i].stat)) reject("BLOCKED");
    }
    deadline.check();
  }

  private async closeChain(chain: Chain) { for (const entry of chain.reverse()) await entry.handle.close(); }

  private async readBytes(path: string, deadline: Deadline, singleLink = false): Promise<{ bytes: Buffer; stat: Stats }> {
    deadline.check();
    const before = await fs.lstat(path);
    if (before.isSymbolicLink()) reject("BLOCKED");
    if (!before.isFile()) reject("INVALID_INPUT");
    if (singleLink && before.nlink !== 1) reject("BLOCKED");
    if (before.size > MAX_BYTES) reject("INVALID_INPUT");
    const handle = await fs.open(path, fileFlags);
    try {
      const stat = await handle.stat();
      if (!same(before, stat) || !stat.isFile() || (singleLink && stat.nlink !== 1)) reject("BLOCKED");
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      let offset = 0;
      while (offset < buffer.length) {
        deadline.check();
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (!bytesRead) break;
        offset += bytesRead;
      }
      if (offset > MAX_BYTES) reject("INVALID_INPUT");
      const after = await handle.stat();
      const named = await fs.lstat(path);
      if (!same(after, named) || named.isSymbolicLink() || after.size !== offset || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs || (singleLink && after.nlink !== 1)) reject("BLOCKED");
      deadline.check();
      return { bytes: buffer.subarray(0, offset), stat: after };
    } finally { await handle.close(); }
  }

  private async perform(id: string, path: string, parts: string[], input: Record<string, unknown>, bytes: Buffer | undefined, deadline: Deadline): Promise<Record<string, unknown>> {
    const chain = await this.chain(id === "filesystem.list" ? parts : parts.slice(0, -1), deadline);
    try {
      const parent = chain.at(-1)!;
      const name = parts.at(-1)!;
      if (id !== "filesystem.list" && temporaryNames.get(directoryKey(parent.stat))?.has(name)) reject("BLOCKED");
      if (id === "filesystem.read") {
        const result = await this.readBytes(`${anchor(parent.handle)}/${name}`, deadline);
        let content: string;
        try { content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(result.bytes); } catch { reject("INVALID_INPUT"); }
        if (sensitive(content) || content.includes(this.root)) reject("BLOCKED");
        await this.checkChain(chain, deadline);
        return { path, content, bytes: result.bytes.length, sha256: hash(result.bytes) };
      }
      if (id === "filesystem.list") {
        const entries: { name: string; kind: string }[] = [];
        const dir = await fs.opendir(anchor(parent.handle), { bufferSize: 32 });
        try {
          while (true) {
            deadline.check();
            const entry = await dir.read();
            if (!entry) break;
            if (temporaryNames.get(directoryKey(parent.stat))?.has(entry.name)) continue;
            if (entries.length === MAX_ENTRIES) reject("INVALID_INPUT");
            if (sensitive(entry.name) || !wellFormed(entry.name) || Buffer.byteLength(entry.name) > 255) reject("BLOCKED");
            entries.push({ name: entry.name, kind: entry.isSymbolicLink() ? "SYMLINK" : entry.isFile() ? "FILE" : entry.isDirectory() ? "DIRECTORY" : "OTHER" });
          }
        } finally { await dir.close(); }
        await this.checkChain(chain, deadline);
        entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
        return { path, entries };
      }
      return await this.writeFile(chain, name, path, bytes!, input, deadline);
    } finally { await this.closeChain(chain); }
  }

  private async precondition(target: string, input: Record<string, unknown>, deadline: Deadline) {
    deadline.check();
    if (input.mode === "CREATE_NEW") {
      try { await fs.lstat(target); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
      reject("BLOCKED");
    }
    const current = await this.readBytes(target, deadline, true);
    if (hash(current.bytes) !== input.expected_sha256) reject("BLOCKED");
    return current.stat;
  }

  private async writeFile(chain: Chain, name: string, path: string, bytes: Buffer, input: Record<string, unknown>, deadline: Deadline): Promise<Record<string, unknown>> {
    const parent = chain.at(-1)!;
    const target = `${anchor(parent.handle)}/${name}`;
    const original = await this.precondition(target, input, deadline);
    const tempName = `.brain-fs-${randomBytes(16).toString("hex")}.tmp`;
    const tempPath = `${anchor(parent.handle)}/${tempName}`;
    const key = directoryKey(parent.stat);
    const active = temporaryNames.get(key) ?? new Set<string>();
    temporaryNames.set(key, active);
    active.add(tempName);
    let temp: FileHandle | undefined;
    let owned: Stats | undefined;
    let committed = false;
    try {
      await this.checkChain(chain, deadline);
      temp = await fs.open(tempPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      owned = await temp.stat();
      let offset = 0;
      while (offset < bytes.length) {
        deadline.check();
        const result = await temp.write(bytes, offset, bytes.length - offset, offset);
        if (result.bytesWritten <= 0) reject("EXECUTION_FAILED");
        offset += result.bytesWritten;
      }
      await temp.sync();
      await temp.close(); temp = undefined;
      await this.checkChain(chain, deadline);
      const staged = await fs.lstat(tempPath);
      if (!same(staged, owned) || !staged.isFile() || staged.nlink !== 1 || staged.size !== bytes.length) reject("BLOCKED");
      const final = await this.precondition(target, input, deadline);
      if (original && (!final || !same(original, final))) reject("BLOCKED");
      deadline.check();
      if (input.mode === "CREATE_NEW") await fs.link(tempPath, target);
      else await fs.rename(tempPath, target);
      committed = true;
      return { path, bytes_written: bytes.length, sha256: hash(bytes), created: input.mode === "CREATE_NEW" };
    } finally {
      try {
        if (temp) await temp.close();
      } finally {
        try {
          if (owned) {
            try {
              const current = await fs.lstat(tempPath);
              if (same(current, owned) && !current.isSymbolicLink()) await fs.unlink(tempPath);
            } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !committed) throw error; }
          }
        } finally { active.delete(tempName); if (!active.size) temporaryNames.delete(key); }
      }
    }
  }
}
