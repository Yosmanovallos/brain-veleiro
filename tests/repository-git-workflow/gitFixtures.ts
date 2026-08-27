import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import type { RepositoryStateSnapshot } from "../../src/intelligence/repository-git-workflow/types.js";

/**
 * Disposable real-Git fixtures for S13H (contract §18, §20; Skill "Real Git
 * fixture policy").
 *
 * Every temp repo lives under `os.tmpdir()` — NEVER under the Brain tree — and
 * git runs with a fully pinned identity and no global/system config, so it
 * works on a machine whose only git identity is the Brain repo's local
 * `.git/config`. Tests MUST NOT mutate the real Brain repository or its remote.
 */

const GIT_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "s13h-fixture",
  GIT_AUTHOR_EMAIL: "s13h-fixture@example.invalid",
  GIT_COMMITTER_NAME: "s13h-fixture",
  GIT_COMMITTER_EMAIL: "s13h-fixture@example.invalid",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_TERMINAL_PROMPT: "0",
};

export function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    env: GIT_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export interface TempRepo {
  dir: string;
  cleanup: () => void;
  run: (...args: string[]) => string;
  writeFile: (rel: string, content: string) => void;
}

export function makeTempRepo(): TempRepo {
  const dir = mkdtempSync(join(tmpdir(), "s13h-repo-"));
  const run = (...args: string[]): string => git(dir, args);
  run("init", "-b", "main", ".");
  run("config", "user.name", "s13h-fixture");
  run("config", "user.email", "s13h-fixture@example.invalid");
  const writeFile = (rel: string, content: string): void => {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  return {
    dir,
    run,
    writeFile,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export function makeBareRemote(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "s13h-remote-"));
  git(dir, ["init", "--bare", "-b", "main", "."]);
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Build a RepositoryStateSnapshot from a real temp repo. */
export function snapshotFromRepo(repo: TempRepo): RepositoryStateSnapshot {
  const head = repo.run("rev-parse", "HEAD");
  let branch: string | null = null;
  let detached = false;
  try {
    const b = repo.run("symbolic-ref", "--quiet", "--short", "HEAD");
    branch = b || null;
  } catch {
    detached = true;
    branch = null;
  }

  let upstream_ref: string | undefined;
  let ahead = 0;
  let behind = 0;
  try {
    upstream_ref = repo.run("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
    const counts = repo.run("rev-list", "--left-right", "--count", `${upstream_ref}...HEAD`);
    const [b, a] = counts.split(/\s+/).map((n) => Number.parseInt(n, 10) || 0);
    behind = b;
    ahead = a;
  } catch {
    upstream_ref = undefined;
  }

  const status = repo.run("status", "--porcelain=v1", "-uall");
  const paths = status
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const x = line[0];
      const y = line[1];
      const path = line.slice(3).trim();
      const untracked = x === "?" && y === "?";
      return {
        path,
        tracked: !untracked,
        staged: !untracked && x !== " " && x !== "?",
        modified: y === "M" || x === "M",
        deleted: x === "D" || y === "D",
        untracked,
      };
    });

  const remotes = repo
    .run("remote", "-v")
    .split("\n")
    .filter((l) => l.includes("(fetch)"))
    .map((l) => {
      const [name, url] = l.split(/\s+/);
      return { name, url, fetch_url: url };
    });

  const worktrees = repo
    .run("worktree", "list", "--porcelain")
    .split("\n\n")
    .filter((b) => b.trim().length > 0)
    .map((block) => {
      const wtPath = /worktree (.+)/.exec(block)?.[1] ?? repo.dir;
      const wtHead = /HEAD ([0-9a-f]+)/.exec(block)?.[1] ?? head;
      const wtBranch = /branch refs\/heads\/(.+)/.exec(block)?.[1];
      return { path: wtPath, branch: wtBranch, head: wtHead, is_current: wtPath === repo.dir };
    });

  return {
    repository_id: repo.dir,
    branch,
    detached_head: detached,
    head,
    upstream_ref,
    upstream_head: undefined,
    ahead,
    behind,
    paths,
    remotes,
    worktrees,
    observed_at: new Date().toISOString(),
  };
}
