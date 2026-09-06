import fs, { type FileHandle } from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import { isAbsolute } from "node:path";
import { performance } from "node:perf_hooks";
import type { CapabilityProvider, ToolDescriptor, ToolInvocationRequest, ToolInvocationResult, NormalizedToolError } from "../../../core/agent/types.js";
import { sensitive } from "../registry/validation.js";
import { runProcessGroup, startProcessGroup } from "./execution.js";
import type { WorkspaceShellConfig } from "./types.js";

// Canonical S14C limits (brain-bootstrap/quality-contracts/S14C_SHELL_DEEP.yaml).
const LIMITS = {
  profileIdChars: 160,
  profiles: 64,
  executablePathChars: 4096,
  cwdChars: 4096,
  cwdSegments: 256,
  cwdSegmentBytes: 255,
  fixedArgs: 64,
  argBytes: 4096,
  totalArgvBytes: 32768,
  envEntries: 32,
  envKeyChars: 128,
  envValueBytes: 4096,
  totalEnvBytes: 32768,
  stdoutBytes: 524288,
  stderrBytes: 524288,
  combinedBytes: 1048576,
  profileTimeoutMs: 300000,
  terminationGraceMs: 500,
  // Bounded budget to poll a stubborn process group to extinction after SIGKILL
  // before a provider-induced TIMEOUT / EXECUTION_FAILED is finally resolved.
  groupCleanupBudgetMs: 4000,
  cwdAllowPrefixes: 64,
} as const;

const PROFILE_ID = /^[a-z0-9][a-z0-9._-]*$/;
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
// Dynamic-loader / runtime-injection keys forbidden in a trusted profile env.
const DANGEROUS_ENV = new Set([
  "LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES", "DYLD_LIBRARY_PATH",
  "NODE_OPTIONS", "PYTHONPATH", "PYTHONHOME", "RUBYOPT", "PERL5OPT", "BASH_ENV",
  "ENV", "IFS", "SHELLOPTS",
]);
// Recognizable credential-bearing env names (finite recognizer, not universal).
const CREDENTIAL_ENV = /(?:^|_)(?:token|password|passwd|passphrase|secret|cookie|authorization|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|credential|auth[_-]?ref|connection[_-]?ref|private[_-]?key)(?:_|$)/i;

const dirFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const wellFormed = (value: string): boolean => !/[\uD800-\uDFFF]/u.test(value);
const anchor = (handle: FileHandle): string => `/proc/self/fd/${handle.fd}`;
const same = (a: Stats, b: Stats): boolean => a.dev === b.dev && a.ino === b.ino;

class Rejection extends Error {
  constructor(readonly code: NormalizedToolError["code"] | "BLOCKED") { super("Shell operation rejected."); }
}
function reject(code: NormalizedToolError["code"] | "BLOCKED"): never { throw new Rejection(code); }

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).every(key => typeof key === "string" && "value" in Object.getOwnPropertyDescriptor(value, key)!);
}

// Provider-neutral workspace-relative logical path grammar, aligned with S14B.
function logical(value: unknown): string[] {
  if (typeof value !== "string" || !value || value.length > LIMITS.cwdChars || !wellFormed(value) ||
      value.includes("\0") || value.includes("\\") || value.startsWith("/") || /^[a-z]:/i.test(value)) reject("INVALID_INPUT");
  if (value === ".") return [];
  const parts = (value as string).split("/");
  if (parts.length > LIMITS.cwdSegments || parts.some(p => !p || p === "." || p === ".." || Buffer.byteLength(p) > LIMITS.cwdSegmentBytes)) reject("INVALID_INPUT");
  return parts;
}

function protectedPath(parts: string[]): boolean {
  return parts.some(p => {
    const n = p.toLowerCase();
    return [".git", ".ssh", ".gnupg", ".aws", ".azure", ".kube", ".npmrc", ".pypirc", ".netrc"].includes(n) ||
      n === ".env" || (n.startsWith(".env.") && n !== ".env.example") || n.endsWith(".pem") || n.endsWith(".key");
  });
}

/**
 * One invocation-wide effective deadline. `start` is captured at invocation
 * entry (before the profile is known) and is never reset. `tighten()` lowers the
 * budget once `profile.max_timeout_ms` is known; it can only shrink it. Every
 * pre-spawn step, the child runtime budget and provider-induced cleanup all draw
 * from this same remaining time.
 */
class Deadline {
  readonly start = performance.now();
  private budget: number;
  constructor(timeout: number) { this.budget = timeout; }
  tighten(timeout: number): void { this.budget = Math.min(this.budget, timeout); }
  remaining(): number { return this.budget - (performance.now() - this.start); }
  check(): void { if (this.remaining() <= 0) reject("TIMEOUT"); }
  duration(): number { return Math.max(0, performance.now() - this.start); }
}

type Chain = { handle: FileHandle; stat: Stats; name?: string }[];

interface PreparedExecutable { configured: string; realpath: string; dev: number; ino: number }
interface PreparedProfile {
  profile_id: string;
  executable: PreparedExecutable;
  argv: string[];
  env: Record<string, string>;
  cwdAllowPrefixes: string[];
  maxTimeoutMs: number;
}

const profileIdSchema = { type: "string", minLength: 1, maxLength: LIMITS.profileIdChars, pattern: PROFILE_ID.source };
const cwdSchema = { type: "string", minLength: 1, maxLength: LIMITS.cwdChars };
const descriptor: ToolDescriptor = {
  capability_id: "shell.execute",
  name: "Execute a workspace command profile",
  description: "Run one pre-authorized command profile in a permitted workspace directory and observe its exit status and bounded UTF-8 stdout/stderr. Model-visible input is only a profile_id and a logical cwd; the executable, arguments and environment are fixed trusted provider configuration.",
  side_effects: "LOCAL",
  input_schema: {
    type: "object",
    properties: { profile_id: profileIdSchema, cwd: cwdSchema },
    required: ["profile_id", "cwd"],
    additionalProperties: false,
  },
  output_schema: {
    type: "object",
    required: ["profile_id", "cwd", "exit_code", "signal", "stdout", "stderr", "stdout_bytes", "stderr_bytes"],
    properties: {
      profile_id: { type: "string" },
      cwd: { type: "string" },
      exit_code: { type: ["integer", "null"] },
      signal: { type: ["string", "null"] },
      stdout: { type: "string" },
      stderr: { type: "string" },
      stdout_bytes: { type: "integer", maximum: LIMITS.stdoutBytes },
      stderr_bytes: { type: "integer", maximum: LIMITS.stderrBytes },
    },
  },
};

/**
 * S14C — bounded pre-authorized command-profile executor.
 *
 * Runtime composition:
 *   RestrictedCapabilityProvider -> CapabilityRegistryProvider ->
 *   WorkspaceShellCapabilityProvider -> trusted profile -> child_process.spawn(shell:false)
 *
 * The model chooses only `{ profile_id, cwd }`. Everything else — executable,
 * argv, env, workspace root, timeouts, output bounds — is trusted host-side
 * configuration validated before the provider is invokable. No provider/profile
 * data enters `AgentDefinition` or the public descriptor, so the concrete
 * implementation behind one `profile_id` can be swapped without an
 * `AgentDefinition` edit.
 */
export class WorkspaceShellCapabilityProvider implements CapabilityProvider {
  private constructor(
    private readonly root: string,
    private readonly rootStat: Stats,
    private readonly profiles: ReadonlyMap<string, PreparedProfile>,
  ) {}

  static async create(config: WorkspaceShellConfig): Promise<WorkspaceShellCapabilityProvider> {
    try {
      if (!plain(config) || Object.keys(config).some(k => !["workspace_root", "profiles"].includes(k)) ||
          typeof config.workspace_root !== "string" || !isAbsolute(config.workspace_root) ||
          config.workspace_root.length > LIMITS.executablePathChars || config.workspace_root.includes("\0") || !wellFormed(config.workspace_root)) reject("INVALID_INPUT");
      if (!Array.isArray(config.profiles) || Object.keys(config.profiles).length !== config.profiles.length ||
          config.profiles.length < 1 || config.profiles.length > LIMITS.profiles) reject("INVALID_INPUT");
      if (process.platform !== "linux" || !constants.O_NOFOLLOW || !constants.O_DIRECTORY) reject("UNAVAILABLE");

      const root = await fs.realpath(config.workspace_root);
      const handle = await fs.open(root, dirFlags);
      let rootStat: Stats;
      try {
        rootStat = await handle.stat();
        if (!rootStat.isDirectory() || !same(rootStat, await fs.stat(anchor(handle)))) reject("UNAVAILABLE");
      } finally { await handle.close(); }

      const prepared = new Map<string, PreparedProfile>();
      for (const raw of config.profiles) {
        const profile = WorkspaceShellCapabilityProvider.prepareProfileShape(raw);
        if (prepared.has(profile.profile_id)) reject("INVALID_INPUT");
        const realpath = await fs.realpath(profile.executable.configured);
        const stat = await fs.stat(realpath);
        if (!stat.isFile()) reject("INVALID_INPUT");
        await fs.access(realpath, constants.X_OK);
        profile.executable = { configured: profile.executable.configured, realpath, dev: stat.dev, ino: stat.ino };
        prepared.set(profile.profile_id, profile);
      }
      return new WorkspaceShellCapabilityProvider(root, rootStat, prepared);
    } catch {
      throw new Error("Invalid or unavailable explicit shell workspace configuration.");
    }
  }

  private static prepareProfileShape(raw: unknown): PreparedProfile {
    if (!plain(raw) || Object.keys(raw).some(k => !["profile_id", "executable", "argv", "env", "cwd_allow_prefixes", "max_timeout_ms", "declared_effects"].includes(k))) reject("INVALID_INPUT");
    const { profile_id, executable, argv, env, cwd_allow_prefixes, max_timeout_ms, declared_effects } = raw;
    if (typeof profile_id !== "string" || profile_id.length > LIMITS.profileIdChars || !PROFILE_ID.test(profile_id)) reject("INVALID_INPUT");
    if (typeof executable !== "string" || !isAbsolute(executable) || executable.length > LIMITS.executablePathChars || executable.includes("\0") || !wellFormed(executable)) reject("INVALID_INPUT");
    if (!Array.isArray(argv) || Object.keys(argv).length !== argv.length || argv.length > LIMITS.fixedArgs) reject("INVALID_INPUT");
    let argvBytes = 0;
    for (const arg of argv) {
      if (typeof arg !== "string" || arg.includes("\0") || !wellFormed(arg) || Buffer.byteLength(arg) > LIMITS.argBytes) reject("INVALID_INPUT");
      argvBytes += Buffer.byteLength(arg);
    }
    if (argvBytes > LIMITS.totalArgvBytes) reject("INVALID_INPUT");
    if (!plain(env)) reject("INVALID_INPUT");
    const envKeys = Object.keys(env);
    if (envKeys.length > LIMITS.envEntries) reject("INVALID_INPUT");
    let envBytes = 0;
    const materializedEnv: Record<string, string> = Object.create(null);
    for (const key of envKeys) {
      const value = (env as Record<string, unknown>)[key];
      if (typeof value !== "string" || key.length > LIMITS.envKeyChars || !ENV_KEY.test(key) || key.includes("\0") ||
          value.includes("\0") || !wellFormed(value) || Buffer.byteLength(value) > LIMITS.envValueBytes ||
          DANGEROUS_ENV.has(key) || CREDENTIAL_ENV.test(key) || sensitive(`${key}=${value}`) || sensitive(value)) reject("INVALID_INPUT");
      envBytes += Buffer.byteLength(key) + Buffer.byteLength(value);
      materializedEnv[key] = value;
    }
    if (envBytes > LIMITS.totalEnvBytes) reject("INVALID_INPUT");
    if (!Array.isArray(cwd_allow_prefixes) || Object.keys(cwd_allow_prefixes).length !== cwd_allow_prefixes.length || cwd_allow_prefixes.length > LIMITS.cwdAllowPrefixes) reject("INVALID_INPUT");
    for (const prefix of cwd_allow_prefixes) logical(prefix);
    if (typeof max_timeout_ms !== "number" || !Number.isFinite(max_timeout_ms) || max_timeout_ms <= 0 || max_timeout_ms > LIMITS.profileTimeoutMs) reject("INVALID_INPUT");
    if (declared_effects !== "LOCAL_ONLY") reject("INVALID_INPUT");
    return {
      profile_id,
      executable: { configured: executable, realpath: executable, dev: -1, ino: -1 },
      argv: [...argv] as string[],
      env: materializedEnv,
      cwdAllowPrefixes: [...cwd_allow_prefixes] as string[],
      maxTimeoutMs: max_timeout_ms,
    };
  }

  async list_capabilities(): Promise<ToolDescriptor[]> {
    return [structuredClone(descriptor)];
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const deadline = new Deadline(Number.isFinite(request.timeout_ms) && request.timeout_ms > 0 ? request.timeout_ms : 1);
    const identity = { call_id: request.call_id, capability_id: request.capability_id };
    try {
      if (!Number.isFinite(request.timeout_ms) || request.timeout_ms <= 0 || !plain(request.input)) reject("INVALID_INPUT");
      if (request.capability_id !== "shell.execute") reject("BLOCKED");
      const input = { ...request.input };
      if (Object.keys(input).some(k => !["profile_id", "cwd"].includes(k))) reject("INVALID_INPUT");
      if (typeof input.profile_id !== "string" || input.profile_id.length > LIMITS.profileIdChars || !PROFILE_ID.test(input.profile_id)) reject("INVALID_INPUT");
      const profile = this.profiles.get(input.profile_id);
      if (!profile) reject("BLOCKED");
      // The one effective deadline: from invocation entry, min(request, profile).
      // It is tightened here, never reset — every step below draws from it.
      deadline.tighten(profile.maxTimeoutMs);
      const parts = logical(input.cwd);
      const cwd = input.cwd as string;
      if (protectedPath(parts)) reject("BLOCKED");
      // A `.` allow-prefix authorizes the whole workspace tree (including cwd
      // `.`); any other prefix authorizes only itself and its subtree, so cwd
      // `.` stays denied unless the profile explicitly lists `.`.
      if (!profile.cwdAllowPrefixes.some(p => p === "." || cwd === p || cwd.startsWith(`${p}/`))) reject("BLOCKED");
      deadline.check();
      const output = await this.execute(profile, cwd, parts, deadline);
      return { status: "SUCCESS", ...identity, output, evidence_refs: [`shell://${profile.profile_id}@workspace/${cwd}`], duration_ms: deadline.duration() };
    } catch (error) {
      const code = error instanceof Rejection ? error.code : this.errorCode(error);
      if (code === "BLOCKED") return { status: "BLOCKED", ...identity, reason: "Shell profile, cwd policy or output-safety precondition denied the execution.", duration_ms: deadline.duration() };
      return { status: "FAIL", ...identity, error: { code, message: this.message(code), retryable: code === "TIMEOUT" }, duration_ms: deadline.duration() };
    }
  }

  private message(code: NormalizedToolError["code"]): string {
    switch (code) {
      case "INVALID_INPUT": return "The shell invocation input or the resolved workspace path was invalid.";
      case "NOT_FOUND": return "The requested workspace cwd does not exist.";
      case "PERMISSION_DENIED": return "The operating system denied execution of the configured command.";
      case "UNAVAILABLE": return "The configured command is unavailable or its identity changed before launch.";
      // Bounded, truthful: cleanup is attempted within a finite budget and may
      // return with the group not yet fully reaped. No claim of guaranteed group
      // extinction, no claim that already-completed LOCAL side effects are undone.
      case "TIMEOUT": return "The command exceeded the effective execution timeout; bounded process-group termination and cleanup were attempted before returning.";
      default: return "The command could not be launched or produced output beyond the permitted bounds.";
    }
  }

  private errorCode(error: unknown): NormalizedToolError["code"] | "BLOCKED" {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") return "NOT_FOUND";
    if (code === "EACCES" || code === "EPERM") return "PERMISSION_DENIED";
    if (code === "ELOOP") return "BLOCKED";
    if (code === "ENOTDIR" || code === "EISDIR" || code === "ENAMETOOLONG") return "INVALID_INPUT";
    return "EXECUTION_FAILED";
  }

  private async execute(profile: PreparedProfile, cwd: string, parts: string[], deadline: Deadline): Promise<Record<string, unknown>> {
    const chain = await this.buildChain(parts, deadline);
    try {
      // Final pre-spawn window: containment recheck, then executable identity
      // recheck, then a synchronous remaining-budget check, then the immediate
      // spawn. No unrelated await is permitted between the identity recheck and
      // spawn; the remaining budget is computed synchronously.
      await this.recheckChain(chain, deadline);
      const executable = await this.recheckExecutable(profile, deadline);
      deadline.check();
      const remainingMs = deadline.remaining();
      const child = startProcessGroup({ executable, argv: profile.argv, cwd: anchor(chain.at(-1)!.handle), env: { ...profile.env } });
      const outcome = await runProcessGroup(child, {
        maxStdoutBytes: LIMITS.stdoutBytes,
        maxStderrBytes: LIMITS.stderrBytes,
        maxCombinedBytes: LIMITS.combinedBytes,
        timeoutMs: Math.max(1, remainingMs),
        terminationGraceMs: LIMITS.terminationGraceMs,
        groupCleanupBudgetMs: LIMITS.groupCleanupBudgetMs,
      });
      if (outcome.kind === "TIMEOUT") reject("TIMEOUT");
      if (outcome.kind === "OUTPUT_OVERFLOW") reject("EXECUTION_FAILED");
      if (outcome.kind === "SPAWN_ERROR") {
        if (outcome.errno === "EACCES" || outcome.errno === "EPERM") reject("PERMISSION_DENIED");
        if (outcome.errno === "ENOENT") reject("UNAVAILABLE");
        reject("EXECUTION_FAILED");
      }
      let stdout: string;
      let stderr: string;
      try {
        stdout = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(outcome.stdout);
        stderr = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(outcome.stderr);
      } catch { reject("INVALID_INPUT"); }
      const safeStdout = this.normalize(stdout, profile, executable);
      const safeStderr = this.normalize(stderr, profile, executable);
      if (sensitive(stdout) || sensitive(stderr) || sensitive(safeStdout) || sensitive(safeStderr)) reject("BLOCKED");
      return {
        profile_id: profile.profile_id,
        cwd,
        exit_code: outcome.exit_code,
        signal: outcome.signal,
        stdout: safeStdout,
        stderr: safeStderr,
        stdout_bytes: outcome.stdout.length,
        stderr_bytes: outcome.stderr.length,
      };
    } finally {
      await this.closeChain(chain);
    }
  }

  private normalize(text: string, profile: PreparedProfile, executable: string): string {
    // Most specific first: a legal profile executable may live physically inside
    // workspace_root (e.g. <root>/tools/tool). The executable realpath and the
    // configured executable string must be collapsed to `<executable>` BEFORE the
    // workspace-root prefix is replaced, otherwise an executable-under-root path
    // would become `workspace:///tools/tool` and never reach `<executable>`.
    // Plain longest-first exact-substring replacement; no regex, no universal
    // host-path classification.
    return text
      .split(executable).join("<executable>")
      .split(profile.executable.configured).join("<executable>")
      .split(this.root).join("workspace://");
  }

  private async recheckExecutable(profile: PreparedProfile, deadline: Deadline): Promise<string> {
    deadline.check();
    try {
      const real = await fs.realpath(profile.executable.configured);
      const stat = await fs.stat(real);
      if (real === profile.executable.realpath && stat.isFile() && stat.dev === profile.executable.dev && stat.ino === profile.executable.ino) return real;
    } catch {
      // fall through to fail closed
    }
    return reject("UNAVAILABLE");
  }

  private async buildChain(parts: string[], deadline: Deadline): Promise<Chain> {
    const chain: Chain = [];
    try {
      deadline.check();
      const root = await fs.open(this.root, dirFlags);
      chain.push({ handle: root, stat: this.rootStat });
      if (!same(await root.stat(), this.rootStat)) reject("BLOCKED");
      for (const name of parts) {
        deadline.check();
        const parent = chain.at(-1)!;
        const path = `${anchor(parent.handle)}/${name}`;
        const stat = await fs.lstat(path);
        if (stat.isSymbolicLink()) reject("BLOCKED");
        if (!stat.isDirectory()) reject("INVALID_INPUT");
        const handle = await fs.open(path, dirFlags);
        chain.push({ handle, stat, name });
        if (!same(stat, await handle.stat())) reject("BLOCKED");
      }
      await this.recheckChain(chain, deadline);
      return chain;
    } catch (error) {
      await this.closeChain(chain);
      throw error;
    }
  }

  private async recheckChain(chain: Chain, deadline: Deadline): Promise<void> {
    deadline.check();
    const root = await fs.lstat(this.root);
    if (root.isSymbolicLink() || !same(root, this.rootStat)) reject("BLOCKED");
    for (let i = 1; i < chain.length; i++) {
      const stat = await fs.lstat(`${anchor(chain[i - 1].handle)}/${chain[i].name}`);
      if (stat.isSymbolicLink() || !stat.isDirectory() || !same(stat, chain[i].stat)) reject("BLOCKED");
    }
    deadline.check();
  }

  private async closeChain(chain: Chain): Promise<void> {
    for (const entry of [...chain].reverse()) {
      try { await entry.handle.close(); } catch { /* already closed */ }
    }
  }
}
