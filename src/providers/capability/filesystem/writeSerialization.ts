// Provider-layer, process-local serialization for S14B `filesystem.write`.
//
// Two `filesystem.write` calls that target the same canonical workspace and the
// same validated logical target path must not evaluate their preconditions,
// stage, publish or clean up concurrently, even when they are issued through
// separate `WorkspaceFilesystemCapabilityProvider` instances bound to that same
// workspace. Without this, two `OVERWRITE_EXISTING` writers sharing one stale
// `expected_sha256` could both observe the old bytes, both stage, and both
// publish (last-writer-wins) -- a silent lost update.
//
// The lock identity is provider-layer only: it is derived from the canonical
// root filesystem identity (device + inode of the resolved workspace root) plus
// the validated logical target path. It never reads `AgentDefinition`,
// `ToolDescriptor`, `provider_id`, `call_id`, model-visible configuration or any
// other model-facing surface, and no lock data is emitted in results, errors or
// evidence.
//
// Different logical targets resolve to different keys and are independently
// lockable -- there is no workspace-global write lock. Unrelated workspaces have
// distinct root identities and never share a lock domain.
//
// Lifecycle: a lock domain is created lazily on first waiter and deleted as soon
// as it has no pending holders, so completed one-shot targets do not accumulate
// in the process-local map. No new runtime dependency is introduced.

interface TargetLockDomain {
  /** Resolves when the current holder releases; the next waiter chains on this. */
  tail: Promise<void>;
  /** Holders that have entered the queue and not yet released. */
  pending: number;
}

const targetLockDomains = new Map<string, TargetLockDomain>();

/**
 * Build the provider-layer lock key for one write target.
 *
 * The NUL separator is collision-proof: a validated logical path can never
 * contain NUL, so no target string can forge the `<dev>:<ino>` identity prefix
 * of a different workspace root.
 *
 * @param rootDev canonical workspace root device id (`Stats.dev`)
 * @param rootIno canonical workspace root inode (`Stats.ino`)
 * @param logicalTarget already-validated workspace-relative logical path
 */
export function writeLockKey(rootDev: number, rootIno: number, logicalTarget: string): string {
  return `${rootDev}:${rootIno}\u0000${logicalTarget}`;
}

/**
 * Run `operation` while holding the exclusive same-target write lock for `key`.
 *
 * Acquisition happens before `operation` is invoked; the lock is released when
 * `operation` settles, whether it returns, throws a rejection, times out or is
 * blocked. A rejection from a previous holder (including a cleanup error) is
 * contained and never poisons later waiters on the same key.
 */
export async function withTargetWriteLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  let domain = targetLockDomains.get(key);
  if (!domain) {
    domain = { tail: Promise.resolve(), pending: 0 };
    targetLockDomains.set(key, domain);
  }
  domain.pending += 1;
  const prior = domain.tail;
  let release!: () => void;
  domain.tail = new Promise<void>(resolve => { release = resolve; });

  let released = false;
  const finish = (): void => {
    if (released) return;
    released = true;
    domain!.pending -= 1;
    if (domain!.pending === 0 && targetLockDomains.get(key) === domain) targetLockDomains.delete(key);
    release();
  };

  try {
    await prior;
  } catch {
    // A previous holder's failure belongs to that call only.
  }
  try {
    return await operation();
  } finally {
    finish();
  }
}

/** Diagnostic-only: count of live same-target write lock domains (never model-visible). */
export function activeTargetWriteLockCount(): number {
  return targetLockDomains.size;
}
