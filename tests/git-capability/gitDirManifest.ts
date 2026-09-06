import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, lstatSync, readlinkSync } from "node:fs";
import { join, relative } from "node:path";
import { HOST_GIT } from "./repoFixtures.js";

/**
 * Whole-`.git` observation manifest for the `NONE` side-effect proof
 * (contract §16, §22; skill §12). Every regular file under `.git` contributes
 * its repository-relative name, type, size and content hash; directories and
 * symlinks contribute name + type (+ link target) so a replacement is detected.
 * atime is deliberately NOT part of the manifest (contract §16).
 *
 * This covers far more than `index/HEAD/refs`: it walks the entire subtree, so
 * `packed-refs`, `logs/**`, `FETCH_HEAD`, `ORIG_HEAD`, `shallow`, `gc.log`,
 * `objects/info/**`, `objects/pack/**`, `commit-graph`,
 * `objects/info/multi-pack-index` and `worktrees/**` are all included whenever
 * they exist.
 */
export function gitDirManifest(gitDir: string): string {
  const rows: string[] = [];
  const walk = (dir: string): void => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      rows.push(`${relative(gitDir, dir)}/ <unreadable:${(error as NodeJS.ErrnoException).code}>`);
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      const rel = relative(gitDir, full);
      if (entry.isDirectory()) {
        rows.push(`${rel}/ dir`);
        walk(full);
      } else if (entry.isSymbolicLink()) {
        rows.push(`${rel} symlink -> ${safeReadlink(full)}`);
      } else if (entry.isFile()) {
        const stat = lstatSync(full);
        const bytes = readFileSync(full);
        rows.push(`${rel} file ${stat.size} ${createHash("sha256").update(bytes).digest("hex")}`);
      } else {
        rows.push(`${rel} special`);
      }
    }
  };
  walk(gitDir);
  return rows.join("\n");
}

function safeReadlink(path: string): string {
  try { return readlinkSync(path); } catch { return "<unreadable>"; }
}

/** Names the manifest must be capable of noticing a change in (contract §16). */
export const MANIFEST_TRACKED_SURFACES = [
  "index", "HEAD", "refs", "packed-refs", "logs", "FETCH_HEAD", "ORIG_HEAD",
  "shallow", "gc.log", "objects/info", "objects/pack", "commit-graph",
  "objects/info/commit-graph", "objects/info/multi-pack-index", "worktrees",
] as const;

/**
 * Non-vacuous unsafe control (contract §22, skill §12). A PLAIN `git status`
 * — no `--no-optional-locks`, no `GIT_OPTIONAL_LOCKS=0`, no safety floor — run
 * against a stat-dirty index rewrites `.git/index`. Returns whether the manifest
 * changed so a test can assert the detector CAN fire, proving the canonical
 * safe-path non-mutation result is meaningful and not vacuous.
 *
 * The caller must pass a fixture whose index is stat-dirty (a tracked file whose
 * mtime changed but whose content did not) and whose index has NOT yet been
 * settled by a prior plain status.
 */
export function unsafePlainStatusMutatesIndex(root: string): { before: string; after: string; mutated: boolean } {
  const gitDir = join(root, ".git");
  const before = gitDirManifest(gitDir);
  execFileSync(HOST_GIT, ["status", "--porcelain"], {
    cwd: root,
    // A deliberately unsafe environment: optional locks enabled, no safety
    // config. This is the naive implementation S14D must NOT be.
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: process.env.HOME ?? "/root",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  const after = gitDirManifest(gitDir);
  return { before, after, mutated: before !== after };
}
