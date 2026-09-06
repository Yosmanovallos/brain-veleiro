import fs, { type FileHandle } from "node:fs/promises";
import { constants, type Stats } from "node:fs";
import { isAbsolute } from "node:path";
import { performance } from "node:perf_hooks";
import type {
  CapabilityProvider,
  ToolDescriptor,
  ToolInvocationRequest,
  ToolInvocationResult,
  NormalizedToolError,
} from "../../../core/agent/types.js";
import { sensitive } from "../registry/validation.js";
import { buildGitEnv, buildArgv, NONEXISTENT_HOOKS_PATH } from "./environment.js";
import { startGitProcess, runGitProcess, type GitProcessOutcome } from "./process.js";
import {
  LIMITS,
  REPOSITORY_ID,
  wellFormed,
  validateRevision,
  isFullOid,
  validateLogicalPath,
  isProtectedContentPath,
  parseGitVersion,
  isSupportedGitVersion,
  parseStatusPorcelainV2,
  parseLsTree,
} from "./parsing.js";
import type {
  WorkspaceGitConfig,
  GitOperationFamily,
  RepositoryStatusObservation,
  RepositoryReadObservation,
} from "./types.js";

const dirFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const anchor = (handle: FileHandle): string => `/proc/self/fd/${handle.fd}`;
const same = (a: Stats, b: Stats): boolean => a.dev === b.dev && a.ino === b.ino;

class Rejection extends Error {
  constructor(readonly code: NormalizedToolError["code"] | "BLOCKED") { super("Git operation rejected."); }
}
function reject(code: NormalizedToolError["code"] | "BLOCKED"): never { throw new Rejection(code); }

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
    Reflect.ownKeys(value).every(key => typeof key === "string" && "value" in Object.getOwnPropertyDescriptor(value, key)!);
}

/**
 * One invocation-wide effective deadline. `start` is captured at invocation
 * entry and never reset. `tighten()` lowers the budget once
 * `config.max_timeout_ms` is applied; it can only shrink it. The version gate,
 * every repository Git subprocess, output handling and cleanup all draw from
 * this same remaining time — no subprocess receives a fresh timeout
 * (contract §6.4, §29).
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

interface PreparedExecutable { configured: string; realpath: string; dev: number; ino: number }

const STATUS_ID = "repository.status";
const READ_ID = "repository.read";

// Static, host-configuration-independent descriptors. No repository_id,
// repository_root, git_executable, git version, argv template, env, ref, branch
// or provider id appears here, so the concrete repository implementation behind
// one `repository.*` id can be swapped without an AgentDefinition edit
// (contract §33, §36).
const descriptors: ToolDescriptor[] = [
  {
    capability_id: STATUS_ID,
    name: "Observe local repository status",
    description: "Return a bounded, structured point-in-time observation of one explicitly bound local Git worktree: branch / detached / unborn state, HEAD object id, upstream ref and ahead/behind counters, and per-path staged/modified/deleted/untracked metadata (at most 1000 paths, names only, never file content or remote URLs). Read-only: no worktree, index, ref, config or object-store change.",
    side_effects: "NONE",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    output_schema: {
      type: "object",
      required: ["repository_id", "branch", "detached_head", "head", "ahead", "behind", "paths", "observed_at"],
      properties: {
        repository_id: { type: "string" },
        branch: { type: ["string", "null"] },
        detached_head: { type: "boolean" },
        head: { type: "string" },
        upstream_ref: { type: "string" },
        upstream_head: { type: "string" },
        ahead: { type: "integer", minimum: 0 },
        behind: { type: "integer", minimum: 0 },
        paths: {
          type: "array",
          maxItems: LIMITS.statusPaths,
          items: {
            type: "object",
            required: ["path", "tracked", "staged", "modified", "deleted", "untracked"],
            properties: {
              path: { type: "string" },
              tracked: { type: "boolean" },
              staged: { type: "boolean" },
              modified: { type: "boolean" },
              deleted: { type: "boolean" },
              untracked: { type: "boolean" },
            },
          },
        },
        observed_at: { type: "string" },
      },
    },
  },
  {
    capability_id: READ_ID,
    name: "Read a committed repository blob",
    description: "Return the UTF-8 content of exactly one regular committed file blob (at most 1048576 bytes) resolved through commit -> tree entry -> blob plumbing. Revision is HEAD or one full 40/64-hex commit object id; the path is a bounded logical repository-relative path. Never reads live worktree bytes, index stages, symlink targets, gitlink/submodule content, binary content or protected-content paths. Read-only.",
    side_effects: "NONE",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", minLength: 1, maxLength: LIMITS.pathChars },
        revision: { type: "string", minLength: 1, maxLength: LIMITS.revisionChars },
      },
      required: ["path"],
      additionalProperties: false,
    },
    output_schema: {
      type: "object",
      required: ["repository_id", "requested_revision", "resolved_commit", "path", "object_id", "size_bytes", "content"],
      properties: {
        repository_id: { type: "string" },
        requested_revision: { type: "string" },
        resolved_commit: { type: "string" },
        path: { type: "string" },
        object_id: { type: "string" },
        size_bytes: { type: "integer", minimum: 0, maximum: LIMITS.blobBytes },
        content: { type: "string" },
      },
    },
  },
];

/**
 * S14D — bounded, provider-neutral local Git observation layer.
 *
 * Runtime composition (contract §35, skill §19):
 *   RestrictedCapabilityProvider -> CapabilityRegistryProvider ->
 *   WorkspaceGitCapabilityProvider -> fixed Git operation table ->
 *   S14D-private child_process.spawn(shell:false)
 *
 * The model chooses only `{}` (repository.status) or `{ path, revision? }`
 * (repository.read). The repository id, repository root, git executable,
 * timeout bound, Git argv, child environment and safety config are all trusted
 * host-side configuration validated before the provider is invokable. None of
 * it enters `AgentDefinition` or the public descriptor.
 *
 * Non-goals (contract §48): no complete secret detection, no OS sandbox, no
 * universal hostile-Git containment, no atomic executable invocation, no
 * transaction isolation from a concurrent external Git process, no remote Git,
 * no Git mutation, no binary object API, no rollback.
 */
export class WorkspaceGitCapabilityProvider implements CapabilityProvider {
  private constructor(
    private readonly repositoryId: string,
    private readonly canonicalRoot: string,
    private readonly rootDevIno: { dev: number; ino: number },
    private readonly gitDevIno: { dev: number; ino: number },
    private readonly executable: PreparedExecutable,
    private readonly maxTimeoutMs: number,
  ) {}

  /**
   * Filesystem-only construction (contract §7, skill §2.8). Validates the
   * trusted configuration, canonicalises the root and git executable, validates
   * the standard v1 repository shape and records root / `.git` / executable
   * dev:ino identities. Performs NO process spawn — not `git --version`, not any
   * repository command.
   */
  static async create(config: WorkspaceGitConfig): Promise<WorkspaceGitCapabilityProvider> {
    try {
      if (process.platform !== "linux" || !constants.O_NOFOLLOW || !constants.O_DIRECTORY) reject("UNAVAILABLE");
      if (!plain(config) || Object.keys(config).some(k => !["repository_id", "repository_root", "git_executable", "max_timeout_ms"].includes(k))) reject("INVALID_INPUT");

      const { repository_id, repository_root, git_executable, max_timeout_ms } = config;
      if (typeof repository_id !== "string" || repository_id.length < 1 || repository_id.length > LIMITS.repositoryIdChars ||
          !REPOSITORY_ID.test(repository_id) || sensitive(repository_id)) reject("INVALID_INPUT");
      if (typeof repository_root !== "string" || !isAbsolute(repository_root) || repository_root.length > LIMITS.repositoryRootChars ||
          repository_root.includes("\0") || !wellFormed(repository_root)) reject("INVALID_INPUT");
      if (typeof git_executable !== "string" || !isAbsolute(git_executable) || git_executable.length > LIMITS.gitExecutablePathChars ||
          git_executable.includes("\0") || !wellFormed(git_executable)) reject("INVALID_INPUT");
      if (typeof max_timeout_ms !== "number" || !Number.isInteger(max_timeout_ms) ||
          max_timeout_ms < 1 || max_timeout_ms > LIMITS.repositoryTimeoutMs) reject("INVALID_INPUT");

      const root = await fs.realpath(repository_root);
      const rootHandle = await fs.open(root, dirFlags);
      let rootDevIno: { dev: number; ino: number };
      let gitDevIno: { dev: number; ino: number };
      try {
        const rootStat = await rootHandle.stat();
        if (!rootStat.isDirectory() || !same(rootStat, await fs.stat(anchor(rootHandle)))) reject("UNAVAILABLE");
        rootDevIno = { dev: rootStat.dev, ino: rootStat.ino };

        const gitPath = `${anchor(rootHandle)}/.git`;
        const gitLstat = await fs.lstat(gitPath);
        // `.git` must be a DIRECT real directory: symlink -> reject; a gitfile
        // (linked-worktree) is a regular file -> reject; bare layout has no
        // `.git` at all and is excluded by requiring this directory.
        if (gitLstat.isSymbolicLink() || !gitLstat.isDirectory()) reject("UNAVAILABLE");
        const gitHandle = await fs.open(gitPath, dirFlags);
        try {
          const gitStat = await gitHandle.stat();
          if (!same(gitStat, await fs.stat(anchor(gitHandle)))) reject("UNAVAILABLE");
          gitDevIno = { dev: gitStat.dev, ino: gitStat.ino };
          await WorkspaceGitCapabilityProvider.rejectUnsupportedShape(anchor(gitHandle));
        } finally {
          await gitHandle.close();
        }
      } finally {
        await rootHandle.close();
      }

      const exeRealpath = await fs.realpath(git_executable);
      const exeStat = await fs.stat(exeRealpath);
      if (!exeStat.isFile()) reject("INVALID_INPUT");
      await fs.access(exeRealpath, constants.X_OK);

      return new WorkspaceGitCapabilityProvider(
        repository_id,
        root,
        rootDevIno,
        gitDevIno,
        { configured: git_executable, realpath: exeRealpath, dev: exeStat.dev, ino: exeStat.ino },
        max_timeout_ms,
      );
    } catch {
      throw new Error("Invalid or unavailable explicit Git repository configuration.");
    }
  }

  /** Reject sparse-checkout state, active object alternates and sibling-worktree admin state (contract §7.2, §26). */
  private static async rejectUnsupportedShape(gitAnchor: string): Promise<void> {
    const absent = async (rel: string): Promise<void> => {
      try {
        await fs.lstat(`${gitAnchor}/${rel}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      reject("UNAVAILABLE");
    };
    await absent("objects/info/alternates");
    await absent("objects/info/http-alternates");
    await absent("info/sparse-checkout");
    // A populated `.git/worktrees/` is the administrative state of a checkout
    // that owns linked worktrees; S14D v1 does not traverse sibling worktrees.
    try {
      const entries = await fs.readdir(`${gitAnchor}/worktrees`);
      if (entries.length > 0) reject("UNAVAILABLE");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async list_capabilities(): Promise<ToolDescriptor[]> {
    return structuredClone(descriptors);
  }

  async invoke(request: ToolInvocationRequest): Promise<ToolInvocationResult> {
    const deadline = new Deadline(Number.isFinite(request.timeout_ms) && request.timeout_ms > 0 ? request.timeout_ms : 1);
    const identity = { call_id: request.call_id, capability_id: request.capability_id };
    let rootHandle: FileHandle | undefined;
    try {
      if (!Number.isFinite(request.timeout_ms) || request.timeout_ms <= 0 || !plain(request.input)) reject("INVALID_INPUT");
      if (request.capability_id !== STATUS_ID && request.capability_id !== READ_ID) reject("BLOCKED");
      deadline.tighten(this.maxTimeoutMs);

      const input = { ...request.input };
      // Fully validate the model-visible request BEFORE opening the repository
      // or spawning anything: an invalid request performs no repository-facing
      // Git execution (contract §14, §20).
      let plan: { kind: "status" } | { kind: "read"; revision: string; requestedRevision: string; parts: string[] };
      if (request.capability_id === STATUS_ID) {
        if (Object.keys(input).length !== 0) reject("INVALID_INPUT");
        plan = { kind: "status" };
      } else {
        if (Object.keys(input).some(k => !["path", "revision"].includes(k))) reject("INVALID_INPUT");
        const revision = validateRevision(input.revision);
        if (revision === null) reject("INVALID_INPUT");
        const parts = validateLogicalPath(input.path);
        if (parts === null) reject("INVALID_INPUT");
        if (typeof input.path === "string" && sensitive(input.path)) reject("BLOCKED");
        if (isProtectedContentPath(parts)) reject("BLOCKED");
        plan = {
          kind: "read",
          revision,
          requestedRevision: typeof input.revision === "string" ? input.revision : "HEAD",
          parts,
        };
      }

      deadline.check();
      rootHandle = await this.openRoot();
      const cwd = anchor(rootHandle);

      // Version gate BEFORE any repository-facing operation (contract §9, §14).
      await this.versionGate(cwd, deadline);

      if (plan.kind === "status") {
        const output = await this.doStatus(cwd, deadline);
        return {
          status: "SUCCESS", ...identity, output,
          evidence_refs: [`repository://${this.repositoryId}/status`],
          duration_ms: deadline.duration(),
        };
      }
      const output = await this.doRead(plan.revision, plan.requestedRevision, plan.parts, cwd, deadline);
      return {
        status: "SUCCESS", ...identity,
        output: output as unknown as Record<string, unknown>,
        evidence_refs: [`repository://${this.repositoryId}@${output.resolved_commit}/${output.path}`],
        duration_ms: deadline.duration(),
      };
    } catch (error) {
      const code = error instanceof Rejection ? error.code : this.errorCode(error);
      if (code === "BLOCKED") {
        return {
          status: "BLOCKED", ...identity,
          reason: "Repository capability, side-effect policy, protected-content floor or output-safety precondition denied the operation.",
          duration_ms: deadline.duration(),
        };
      }
      return {
        status: "FAIL", ...identity,
        error: { code, message: this.message(code), retryable: code === "TIMEOUT" },
        duration_ms: deadline.duration(),
      };
    } finally {
      if (rootHandle) { try { await rootHandle.close(); } catch { /* already closed */ } }
    }
  }

  // --- identity gates -------------------------------------------------------

  private async openRoot(): Promise<FileHandle> {
    const handle = await fs.open(this.canonicalRoot, dirFlags);
    try {
      const stat = await handle.stat();
      if (!stat.isDirectory() || !same(stat, await fs.stat(anchor(handle))) ||
          stat.dev !== this.rootDevIno.dev || stat.ino !== this.rootDevIno.ino) reject("UNAVAILABLE");
      return handle;
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  /** Final relevant root / `.git` identity check before a repository-facing spawn (contract §8). */
  private async recheckRepositoryIdentity(cwd: string): Promise<void> {
    const rootLstat = await fs.lstat(this.canonicalRoot);
    if (rootLstat.isSymbolicLink() || !rootLstat.isDirectory() ||
        rootLstat.dev !== this.rootDevIno.dev || rootLstat.ino !== this.rootDevIno.ino) reject("UNAVAILABLE");
    const gitLstat = await fs.lstat(`${cwd}/.git`);
    if (gitLstat.isSymbolicLink() || !gitLstat.isDirectory() ||
        gitLstat.dev !== this.gitDevIno.dev || gitLstat.ino !== this.gitDevIno.ino) reject("UNAVAILABLE");
  }

  /** Final executable identity check before a spawn; no PATH fallback (contract §8). */
  private async recheckExecutable(): Promise<string> {
    try {
      const real = await fs.realpath(this.executable.configured);
      const stat = await fs.stat(real);
      if (real === this.executable.realpath && stat.isFile() &&
          stat.dev === this.executable.dev && stat.ino === this.executable.ino) return real;
    } catch {
      // fall through to fail closed
    }
    return reject("UNAVAILABLE");
  }

  // --- fixed operation runner --------------------------------------------

  private async runGit(
    family: GitOperationFamily,
    opInput: { revision?: string; path?: string; objectId?: string },
    cwd: string,
    deadline: Deadline,
    bounds: { stdout: number; stderr: number; combined: number },
  ): Promise<{ outcome: GitProcessOutcome }> {
    deadline.check();
    // Final pre-spawn window: repository identity recheck, then executable
    // identity recheck, then a synchronous remaining-deadline calculation, then
    // the immediate spawn. No unrelated await sits between the executable
    // recheck and startGitProcess (contract §8, §29).
    if (family !== "VERSION") await this.recheckRepositoryIdentity(cwd);
    const executable = await this.recheckExecutable();
    deadline.check();
    const remainingMs = deadline.remaining();
    const argv = buildArgv(family, { canonicalRoot: this.canonicalRoot, ...opInput });
    const child = startGitProcess({ executable, argv, cwd, env: buildGitEnv() });
    const outcome = await runGitProcess(child, {
      maxStdoutBytes: bounds.stdout,
      maxStderrBytes: bounds.stderr,
      maxCombinedBytes: bounds.combined,
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
    return { outcome };
  }

  private decodeUtf8(bytes: Buffer, onInvalid: NormalizedToolError["code"]): string {
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      return reject(onInvalid);
    }
  }

  private async versionGate(cwd: string, deadline: Deadline): Promise<void> {
    const { outcome } = await this.runGit("VERSION", {}, cwd, deadline, { stdout: 65536, stderr: 65536, combined: 131072 });
    if (outcome.kind !== "EXIT" || outcome.exit_code !== 0) reject("UNAVAILABLE");
    const version = parseGitVersion(this.decodeUtf8(outcome.stdout, "UNAVAILABLE"));
    if (!version || !isSupportedGitVersion(version)) reject("UNAVAILABLE");
  }

  // --- repository.status -------------------------------------------------

  private async doStatus(cwd: string, deadline: Deadline): Promise<Record<string, unknown>> {
    const { outcome } = await this.runGit("STATUS", {}, cwd, deadline, {
      stdout: LIMITS.stdoutBytes, stderr: LIMITS.stderrBytes, combined: LIMITS.combinedOutputBytes,
    });
    if (outcome.kind !== "EXIT" || outcome.exit_code !== 0) reject("EXECUTION_FAILED");
    const text = this.decodeUtf8(outcome.stdout, "EXECUTION_FAILED");
    const parsed = parseStatusPorcelainV2(text);
    if (!parsed.ok) reject("EXECUTION_FAILED");
    const s = parsed.value;
    if (s.head !== "" && !isFullOid(s.head)) reject("EXECUTION_FAILED");
    if (s.paths.length > LIMITS.statusPaths) reject("EXECUTION_FAILED");

    const paths = s.paths.map(p => ({ ...p, path: this.normalize(p.path) }));
    const observation: RepositoryStatusObservation = {
      repository_id: this.repositoryId,
      branch: s.branch === null ? null : this.normalize(s.branch),
      detached_head: s.detached_head,
      head: s.head,
      ahead: s.ahead,
      behind: s.behind,
      paths,
      observed_at: new Date().toISOString(),
    };
    if (s.upstream_ref !== undefined) observation.upstream_ref = this.normalize(s.upstream_ref);

    const serialized = JSON.stringify(observation);
    if (serialized.includes(this.canonicalRoot) || serialized.includes(this.executable.realpath) ||
        serialized.includes(this.executable.configured) || serialized.includes(NONEXISTENT_HOOKS_PATH) ||
        sensitive(serialized)) reject("BLOCKED");
    return observation as unknown as Record<string, unknown>;
  }

  // --- repository.read -------------------------------------------------

  private async doRead(
    revision: string,
    requestedRevision: string,
    parts: string[],
    cwd: string,
    deadline: Deadline,
  ): Promise<RepositoryReadObservation> {
    const logicalPath = parts.join("/");

    // 1. resolve the revision to a committed commit object id.
    let resolvedCommit: string;
    if (revision === "HEAD") {
      const { outcome } = await this.runGit("RESOLVE_HEAD", {}, cwd, deadline, { stdout: 65536, stderr: 65536, combined: 131072 });
      if (outcome.kind !== "EXIT" || outcome.exit_code !== 0) reject("NOT_FOUND"); // unborn HEAD
      const head = this.decodeUtf8(outcome.stdout, "EXECUTION_FAILED").trim();
      if (!isFullOid(head)) reject("NOT_FOUND");
      resolvedCommit = head;
    } else {
      const { outcome } = await this.runGit("VERIFY_COMMIT_OBJECT", { objectId: revision }, cwd, deadline, { stdout: 65536, stderr: 65536, combined: 131072 });
      if (outcome.kind !== "EXIT" || outcome.exit_code !== 0) reject("NOT_FOUND");
      const type = this.decodeUtf8(outcome.stdout, "EXECUTION_FAILED").trim();
      if (type !== "commit") reject("NOT_FOUND");
      resolvedCommit = revision;
    }

    // 2. resolve exactly one regular blob tree entry at the validated path.
    const { outcome: lsOutcome } = await this.runGit(
      "RESOLVE_TREE_ENTRY",
      { revision: resolvedCommit, path: logicalPath },
      cwd, deadline, { stdout: LIMITS.stdoutBytes, stderr: LIMITS.stderrBytes, combined: LIMITS.combinedOutputBytes },
    );
    if (lsOutcome.kind !== "EXIT" || lsOutcome.exit_code !== 0) reject("NOT_FOUND");
    const entry = parseLsTree(this.decodeUtf8(lsOutcome.stdout, "EXECUTION_FAILED"));
    if (!entry.ok) {
      reject(entry.reason === "MALFORMED" ? "EXECUTION_FAILED" : "NOT_FOUND");
    }
    if (entry.value.size !== null && entry.value.size > LIMITS.blobBytes) reject("EXECUTION_FAILED");

    // 3. read only the already-resolved blob object id.
    const { outcome: blobOutcome } = await this.runGit(
      "READ_BLOB",
      { objectId: entry.value.objectId },
      cwd, deadline, { stdout: LIMITS.blobBytes, stderr: LIMITS.stderrBytes, combined: LIMITS.combinedOutputBytes },
    );
    if (blobOutcome.kind !== "EXIT" || blobOutcome.exit_code !== 0) reject("EXECUTION_FAILED");
    const bytes = blobOutcome.stdout;
    if (bytes.length > LIMITS.blobBytes) reject("EXECUTION_FAILED");

    // 4. strict UTF-8, secret backstop, host-path normalisation.
    const decoded = this.decodeUtf8(bytes, "INVALID_INPUT");
    const content = this.normalize(decoded);
    if (sensitive(decoded) || sensitive(content)) reject("BLOCKED");

    const observation: RepositoryReadObservation = {
      repository_id: this.repositoryId,
      requested_revision: requestedRevision,
      resolved_commit: resolvedCommit,
      path: logicalPath,
      object_id: entry.value.objectId,
      size_bytes: bytes.length,
      content,
    };
    const serialized = JSON.stringify(observation);
    if (serialized.includes(this.canonicalRoot) || serialized.includes(this.executable.realpath) ||
        serialized.includes(this.executable.configured) || serialized.includes(NONEXISTENT_HOOKS_PATH)) reject("BLOCKED");
    return observation;
  }

  // --- normalisation / error mapping ------------------------------------

  /**
   * Host-path normalisation before model visibility (contract §24, §30). The
   * executable identity is collapsed before the broader repository-root prefix
   * in case the two strings overlap.
   */
  private normalize(text: string): string {
    return text
      .split(this.executable.realpath).join("<git>")
      .split(this.executable.configured).join("<git>")
      .split(this.canonicalRoot).join(`repository://${this.repositoryId}`)
      .split(NONEXISTENT_HOOKS_PATH).join("<hooks>");
  }

  private errorCode(error: unknown): NormalizedToolError["code"] | "BLOCKED" {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "EACCES" || code === "EPERM") return "PERMISSION_DENIED";
    if (code === "ELOOP" || code === "ENOENT" || code === "ENOTDIR" || code === "ENAMETOOLONG") return "UNAVAILABLE";
    return "INTERNAL_ERROR";
  }

  private message(code: NormalizedToolError["code"]): string {
    switch (code) {
      case "INVALID_INPUT": return "The repository request, revision grammar, path grammar or decoded content was invalid.";
      case "NOT_FOUND": return "The requested revision, commit or repository path was not found in committed local history.";
      case "PERMISSION_DENIED": return "The operating system denied access required to observe the repository.";
      case "UNAVAILABLE": return "The Git runtime version or repository shape is unsupported, or a repository or executable identity changed before execution.";
      // Bounded and truthful: a finite process-group termination and cleanup are
      // attempted and may return with the group not yet fully reaped. No claim
      // of guaranteed extinction, no claim that anything was rolled back.
      case "TIMEOUT": return "The repository operation exceeded the effective timeout; a bounded process-group termination and cleanup attempt was made before returning.";
      case "EXECUTION_FAILED": return "The repository operation produced output beyond the permitted bounds or could not be parsed into a safe structured result.";
      default: return "The repository operation could not complete safely.";
    }
  }
}
