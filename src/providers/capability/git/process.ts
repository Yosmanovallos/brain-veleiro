// S14D — Git Capability: S14D-private bounded process runner.
//
// This is a deliberately self-contained runner under
// src/providers/capability/git/**. It does NOT route through shell.execute and
// does NOT import S14C into a shared cross-provider surface (skill §2.9,
// contract §10). It reproduces the accepted S14C process guarantees S14D needs:
//
//   child_process.spawn, shell:false, stdin ignored/closed, stdout/stderr
//   bounded pipes, no TTY/PTY, provider-created POSIX process group
//   (detached:true so child.pid is the group id), exact provider-built env,
//   one invocation-wide deadline, no hidden retry, bounded output, and
//   timeout / output-overflow -> SIGTERM -> grace -> SIGKILL -> bounded
//   group-liveness cleanup where the leader's `close` cannot cancel the
//   escalation lifecycle.
//
// A Git process that deliberately calls setsid() / starts its own session
// leaves the group and is outside this threat model; auto-maintenance is
// configured off (environment.ts) specifically so canonical Git operations do
// not spawn such a daemon. No OS sandbox, no rollback and no atomic-fexecve
// protection are claimed.

import { spawn, type ChildProcess } from "node:child_process";
import { performance } from "node:perf_hooks";

export interface GitProcessLaunch {
  /** Canonical resolved git executable realpath (provider-private). */
  executable: string;
  /** Fixed provider-built argument vector. */
  argv: string[];
  /** Working directory — a `/proc/self/fd/<fd>` anchor whose fd the caller keeps open. */
  cwd: string;
  /** Exact child environment; the host/parent environment is never inherited. */
  env: Record<string, string>;
}

export interface GitProcessBounds {
  maxStdoutBytes: number;
  maxStderrBytes: number;
  maxCombinedBytes: number;
  /** Absolute deadline from the invocation's monotonic performance clock. */
  deadlineMs: number;
  /** Grace between SIGTERM and SIGKILL for the process group. */
  terminationGraceMs: number;
  /** Bounded budget, after the SIGKILL, to poll the group to extinction. */
  groupCleanupBudgetMs: number;
}

export type GitProcessOutcome =
  | { kind: "EXIT"; exit_code: number | null; signal: string | null; stdout: Buffer; stderr: Buffer }
  | { kind: "TIMEOUT" }
  | { kind: "OUTPUT_OVERFLOW" }
  | { kind: "SPAWN_ERROR"; errno?: string };

/**
 * Launch the process group. Intentionally synchronous and free of any
 * `await` / `.then` / I/O: it is the only statement between the provider's final
 * pre-spawn identity + deadline checks and the kernel spawn.
 */
export function startGitProcess(launch: GitProcessLaunch): ChildProcess {
  return spawn(launch.executable, launch.argv, {
    cwd: launch.cwd,
    env: launch.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    detached: true,
    windowsHide: true,
  });
}

/**
 * Drive a launched Git process group to a bounded outcome.
 *
 * - Natural termination (any exit code, or an external signal) resolves `EXIT`
 *   with the raw captured bytes.
 * - Exceeding any raw output bound resolves `OUTPUT_OVERFLOW`; reaching the
 *   remaining effective deadline resolves `TIMEOUT`. Both first run the full
 *   escalation lifecycle against the whole process group; the leader's `close`
 *   event does NOT by itself end that lifecycle. No partial / truncated output
 *   is ever returned for these outcomes.
 * - A spawn failure (no group was created) resolves `SPAWN_ERROR`.
 */
export async function runGitProcess(child: ChildProcess, bounds: GitProcessBounds): Promise<GitProcessOutcome> {
  const hardDeadline = bounds.deadlineMs;
  const remainingBudgetMs = Math.min(Math.max(0, hardDeadline - performance.now()), 2147483647);
  // Cleanup is part of the invocation deadline. Reserve as much of the
  // remaining budget as possible for TERM/grace/KILL/liveness instead of
  // starting cleanup only after the full operation budget has expired.
  const cleanupReserveMs = Math.min(
    Math.max(0, remainingBudgetMs - 1),
    Math.max(0, bounds.terminationGraceMs) + Math.max(0, bounds.groupCleanupBudgetMs),
    Math.floor(remainingBudgetMs / 2),
  );
  const executionBudgetMs = Math.max(0, remainingBudgetMs - cleanupReserveMs);
  const pgid = typeof child.pid === "number" ? child.pid : undefined;
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let terminating: "TIMEOUT" | "OUTPUT_OVERFLOW" | undefined;
  let leaderClosed = false;

  const timers = new Set<NodeJS.Timeout>();
  const arm = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    t.unref?.();
    timers.add(t);
  };
  const clearTimers = (): void => { for (const t of timers) clearTimeout(t); timers.clear(); };

  const signalGroup = (signal: NodeJS.Signals): void => {
    try {
      if (pgid !== undefined) process.kill(-pgid, signal);
      else child.kill(signal);
    } catch {
      // ESRCH — the group is already gone.
    }
  };
  const groupAlive = (): boolean => {
    if (pgid === undefined) return !leaderClosed;
    try { process.kill(-pgid, 0); return true; }
    catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
  };

  return await new Promise<GitProcessOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: GitProcessOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve(outcome);
    };
    const finishTermination = (): void =>
      finish(terminating === "TIMEOUT" ? { kind: "TIMEOUT" } : { kind: "OUTPUT_OVERFLOW" });

    // Escalation lifecycle. Owns resolution once termination begins; the
    // leader's close event cannot cancel it.
    const escalate = (): void => {
      signalGroup("SIGTERM");
      const graceMs = Math.min(Math.max(0, bounds.terminationGraceMs), Math.max(0, hardDeadline - performance.now()));
      arm(() => {
        if (groupAlive()) signalGroup("SIGKILL");
        const cleanupDeadline = Math.min(
          hardDeadline,
          performance.now() + Math.max(0, bounds.groupCleanupBudgetMs),
        );
        const poll = (): void => {
          if (!groupAlive() || performance.now() >= cleanupDeadline) return finishTermination();
          arm(poll, Math.min(25, Math.max(1, cleanupDeadline - performance.now())));
        };
        poll();
      }, graceMs);
    };

    const beginTermination = (reason: "TIMEOUT" | "OUTPUT_OVERFLOW"): void => {
      if (terminating) return;
      terminating = reason;
      escalate();
    };

    child.on("error", (error: NodeJS.ErrnoException) => finish({ kind: "SPAWN_ERROR", errno: error.code }));

    child.stdout?.on("data", (chunk: Buffer) => {
      if (terminating) return;
      stdoutBytes += chunk.length;
      stdoutChunks.push(chunk);
      if (stdoutBytes > bounds.maxStdoutBytes || stdoutBytes + stderrBytes > bounds.maxCombinedBytes) {
        beginTermination("OUTPUT_OVERFLOW");
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (terminating) return;
      stderrBytes += chunk.length;
      stderrChunks.push(chunk);
      if (stderrBytes > bounds.maxStderrBytes || stdoutBytes + stderrBytes > bounds.maxCombinedBytes) {
        beginTermination("OUTPUT_OVERFLOW");
      }
    });

    arm(() => beginTermination("TIMEOUT"), executionBudgetMs);

    child.on("close", (code, signal) => {
      leaderClosed = true;
      if (terminating) {
        if (!groupAlive()) finishTermination();
        return;
      }
      finish({ kind: "EXIT", exit_code: code, signal, stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks) });
    });
  });
}
