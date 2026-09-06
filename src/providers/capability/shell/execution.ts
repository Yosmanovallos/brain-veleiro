// S14C — Shell Capability: raw process-group launch, bounded capture and
// timeout / output-overflow cleanup.
//
// Canonical reference platform: Linux / WSL, Node 24. The provider creates one
// isolated POSIX process group per execution (`detached: true`, so the child is
// the group leader and `child.pid` is the group id). Ordinary children that stay
// in that group are reaped together by signalling the negative pgid. A profile
// that deliberately calls `setsid()` / starts its own session is outside the
// trusted LOCAL_ONLY threat model — no OS container or anti-daemon sandbox is
// claimed.
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
  /** Effective timeout = min(request.timeout_ms, profile.max_timeout_ms). */
  timeoutMs: number;
  /** Grace between SIGTERM and SIGKILL for the process group. */
  terminationGraceMs: number;
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
 * - Exceeding any raw output bound resolves `OUTPUT_OVERFLOW` after terminating
 *   the group; no partial/truncated output is returned.
 * - Reaching the effective timeout resolves `TIMEOUT` after terminating the
 *   group.
 * - A spawn failure (no group was created) resolves `SPAWN_ERROR`.
 *
 * Cleanup is bounded: SIGTERM, then SIGKILL after the grace, then a final
 * watchdog so a stuck pipe can never hang the caller.
 */
export async function runProcessGroup(child: ChildProcess, bounds: ProcessBounds): Promise<ProcessOutcome> {
  const pgid = typeof child.pid === "number" ? child.pid : undefined;
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let terminating: "TIMEOUT" | "OUTPUT_OVERFLOW" | undefined;

  const timers = new Set<NodeJS.Timeout>();
  const arm = (fn: () => void, ms: number): void => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    t.unref?.();
    timers.add(t);
  };
  const clearTimers = (): void => { for (const t of timers) clearTimeout(t); timers.clear(); };

  const killGroup = (signal: NodeJS.Signals): void => {
    try {
      if (pgid !== undefined) process.kill(-pgid, signal);
      else child.kill(signal);
    } catch {
      // ESRCH — the group is already gone.
    }
  };

  return await new Promise<ProcessOutcome>((resolve) => {
    const finish = (outcome: ProcessOutcome): void => { clearTimers(); resolve(outcome); };

    const beginTermination = (reason: "TIMEOUT" | "OUTPUT_OVERFLOW"): void => {
      if (terminating) return;
      terminating = reason;
      killGroup("SIGTERM");
      arm(() => killGroup("SIGKILL"), bounds.terminationGraceMs);
      arm(() => finish(reason === "TIMEOUT" ? { kind: "TIMEOUT" } : { kind: "OUTPUT_OVERFLOW" }), bounds.terminationGraceMs * 4 + 100);
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
      if (terminating === "TIMEOUT") return finish({ kind: "TIMEOUT" });
      if (terminating === "OUTPUT_OVERFLOW") return finish({ kind: "OUTPUT_OVERFLOW" });
      finish({ kind: "EXIT", exit_code: code, signal, stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks) });
    });
  });
}
