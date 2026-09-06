// S14C — Shell Capability: raw process-group launch, bounded capture and
// timeout / output-overflow cleanup.
//
// Canonical reference platform: Linux / WSL, Node 24. The provider creates one
// isolated POSIX process group per execution (`detached: true`, so the child is
// the group leader and `child.pid` is the group id). Every process that stays in
// that group — including a descendant that installs a SIGTERM handler and
// refuses to exit — is reaped by escalating SIGTERM → SIGKILL to the negative
// pgid and then polling group liveness until the group is gone or the bounded
// cleanup budget is exhausted. A profile that deliberately calls `setsid()` /
// starts its own session leaves the group and is outside the trusted LOCAL_ONLY
// threat model — no OS container or anti-daemon sandbox is claimed.
//
// Only `node:child_process` is used. `shell` is always false; no command string
// is ever composed. stdin is ignored/closed, there is no TTY, and the child
// environment is exactly what the caller passes (the host/parent environment is
// never inherited).

import { spawn, type ChildProcess } from "node:child_process";

export interface ProcessGroupLaunch {
  /** Canonical resolved executable realpath (provider-private). */
  executable: string;
  /** Fixed trusted argument vector. */
  argv: string[];
  /** Directory to run in — a `/proc/self/fd/<fd>` anchor whose fd the caller keeps open. */
  cwd: string;
  /** Exact child environment; no implicit host-environment inheritance. */
  env: Record<string, string>;
}

export interface ProcessBounds {
  maxStdoutBytes: number;
  maxStderrBytes: number;
  maxCombinedBytes: number;
  /**
   * Remaining time on the one invocation-wide effective deadline
   * (min(request.timeout_ms, profile.max_timeout_ms) minus pre-spawn elapsed),
   * not a fresh full timeout.
   */
  timeoutMs: number;
  /** Grace between SIGTERM and SIGKILL for the process group. */
  terminationGraceMs: number;
  /** Bounded budget, after the SIGKILL, to poll the group to extinction. */
  groupCleanupBudgetMs: number;
}

export type ProcessOutcome =
  | { kind: "EXIT"; exit_code: number | null; signal: string | null; stdout: Buffer; stderr: Buffer }
  | { kind: "TIMEOUT" }
  | { kind: "OUTPUT_OVERFLOW" }
  | { kind: "SPAWN_ERROR"; errno?: string };

/**
 * Launch the process group. This is intentionally synchronous and free of any
 * `await` / `.then` / I/O: it is the only statement between the provider's final
 * pre-spawn containment + identity + deadline checks and the kernel spawn.
 */
export function startProcessGroup(launch: ProcessGroupLaunch): ChildProcess {
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
 * Drive a launched process group to a bounded outcome.
 *
 * - Natural termination (any exit code, or an external signal) resolves `EXIT`
 *   with the raw captured bytes.
 * - Exceeding any raw output bound resolves `OUTPUT_OVERFLOW`; reaching the
 *   remaining effective deadline resolves `TIMEOUT`. Both first run the full
 *   escalation lifecycle against the whole process group. The group leader's
 *   `close` event does NOT by itself end that lifecycle: a stubborn same-group
 *   descendant is still SIGKILLed and awaited. No partial/truncated output is
 *   ever returned for these outcomes.
 * - A spawn failure (no group was created) resolves `SPAWN_ERROR`.
 */
export async function runProcessGroup(child: ChildProcess, bounds: ProcessBounds): Promise<ProcessOutcome> {
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

  return await new Promise<ProcessOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: ProcessOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve(outcome);
    };
    const finishTermination = (): void => finish(terminating === "TIMEOUT" ? { kind: "TIMEOUT" } : { kind: "OUTPUT_OVERFLOW" });

    // Escalation lifecycle. Owns resolution once termination begins; the leader's
    // close event cannot cancel it.
    const escalate = (): void => {
      signalGroup("SIGTERM");
      const cleanupDeadline = Date.now() + bounds.terminationGraceMs + bounds.groupCleanupBudgetMs;
      arm(() => {
        if (groupAlive()) signalGroup("SIGKILL");
        const poll = (): void => {
          if (!groupAlive() || Date.now() >= cleanupDeadline) return finishTermination();
          arm(poll, 25);
        };
        poll();
      }, bounds.terminationGraceMs);
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
      if (stdoutBytes > bounds.maxStdoutBytes || stdoutBytes + stderrBytes > bounds.maxCombinedBytes) beginTermination("OUTPUT_OVERFLOW");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (terminating) return;
      stderrBytes += chunk.length;
      stderrChunks.push(chunk);
      if (stderrBytes > bounds.maxStderrBytes || stdoutBytes + stderrBytes > bounds.maxCombinedBytes) beginTermination("OUTPUT_OVERFLOW");
    });

    arm(() => beginTermination("TIMEOUT"), Math.min(bounds.timeoutMs, 2147483647));

    child.on("close", (code, signal) => {
      leaderClosed = true;
      if (terminating) {
        // The escalation lifecycle owns resolution. Only take the fast path if
        // the entire group is already gone.
        if (!groupAlive()) finishTermination();
        return;
      }
      finish({ kind: "EXIT", exit_code: code, signal, stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks) });
    });
  });
}
