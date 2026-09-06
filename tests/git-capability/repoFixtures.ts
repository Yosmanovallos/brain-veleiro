import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { expect } from "vitest";
import { WorkspaceGitCapabilityProvider } from "../../src/providers/capability/git/workspaceGitCapabilityProvider.js";
import type { WorkspaceGitConfig } from "../../src/providers/capability/git/types.js";

/**
 * Disposable real-Git fixtures for S14D (contract §37, §38; skill §22).
 *
 * Every temp repository lives under `os.tmpdir()` — NEVER under the Brain
 * worktree — and the harness `git` runs with a fully pinned identity and no
 * global/system config so it works on any host. Fixture setup uses host `git`
 * directly to build ground truth; that is not the production provider (contract
 * §37). Nothing here mutates the Brain repository or its remote.
 */

/** Absolute path to the real host git, discovered once (never from PATH inside the provider). */
export const HOST_GIT = discoverHostGit();
function discoverHostGit(): string {
  for (const candidate of ["/usr/bin/git", "/bin/git", "/usr/local/bin/git"]) {
    if (existsSync(candidate)) return candidate;
  }
  const found = execFileSync("bash", ["-lc", "command -v git"], { encoding: "utf8" }).trim();
  if (!found || !isAbsolute(found)) throw new Error("no absolute host git found for S14D fixtures");
  return found;
}

function harnessGitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "s14d-fixture",
    GIT_AUTHOR_EMAIL: "s14d-fixture@example.invalid",
    GIT_COMMITTER_NAME: "s14d-fixture",
    GIT_COMMITTER_EMAIL: "s14d-fixture@example.invalid",
  };
}

/** Run host git in `cwd` with a pinned identity; setup ground truth only. */
export function rawGit(cwd: string, args: string[]): string {
  return execFileSync(HOST_GIT, ["-c", "commit.gpgsign=false", "-c", "gc.auto=0", ...args], {
    cwd,
    env: harnessGitEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

export interface RepoFixture {
  /** The disposable base directory (removed afterwards). */
  base: string;
  /** The worktree root passed to the provider. */
  root: string;
  git(...args: string[]): string;
  write(rel: string, content: string): void;
  writeBytes(rel: string, bytes: Buffer): void;
  commit(message: string): string;
  head(): string;
  gitDir(): string;
}

function makeFixture(base: string, root: string): RepoFixture {
  return {
    base,
    root,
    git: (...args: string[]) => rawGit(root, args),
    write(rel: string, content: string) {
      const full = join(root, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, content);
    },
    writeBytes(rel: string, bytes: Buffer) {
      const full = join(root, rel);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, bytes);
    },
    commit(message: string) {
      rawGit(root, ["add", "-A"]);
      rawGit(root, ["commit", "-m", message]);
      return rawGit(root, ["rev-parse", "HEAD"]);
    },
    head: () => rawGit(root, ["rev-parse", "HEAD"]),
    gitDir: () => join(root, ".git"),
  };
}

/**
 * Create a disposable ordinary `-b main` worktree, run `build`, then `use`, then
 * remove everything and assert no residue. `build` runs before the provider is
 * created; `use` receives the ready fixture.
 */
export async function withRepo(
  build: (fx: RepoFixture) => void | Promise<void>,
  use: (fx: RepoFixture) => Promise<void>,
): Promise<void> {
  const base = mkdtempSync(join(tmpdir(), "brain-s14d-"));
  const rel = relative(process.cwd(), base);
  expect(isAbsolute(rel) || rel === ".." || rel.startsWith(`..`)).toBe(true);
  const root = join(base, "repo");
  try {
    mkdirSync(root);
    rawGit(root, ["init", "-b", "main", "."]);
    const fx = makeFixture(base, root);
    await build(fx);
    await use(fx);
  } finally {
    rmSync(base, { recursive: true, force: true });
    expect(existsSync(base)).toBe(false);
  }
}

/** A minimal committed repo: one regular UTF-8 blob `hello.txt` at HEAD. */
export async function withSimpleRepo(use: (fx: RepoFixture) => Promise<void>): Promise<void> {
  await withRepo((fx) => {
    fx.write("hello.txt", "Hello S14D\n");
    fx.write("dir/nested.md", "# nested\n");
    fx.commit("init");
  }, use);
}

export const providerConfig = (fx: RepoFixture, overrides: Partial<WorkspaceGitConfig> = {}): WorkspaceGitConfig => ({
  repository_id: "qa.repo",
  repository_root: fx.root,
  git_executable: HOST_GIT,
  max_timeout_ms: 30000,
  ...overrides,
});

export const createProvider = (config: WorkspaceGitConfig): Promise<WorkspaceGitCapabilityProvider> =>
  WorkspaceGitCapabilityProvider.create(config);

// --- unsupported / adversarial repository shapes ---------------------------

/** Convert `<root>/.git` into a linked-worktree gitfile pointing elsewhere. */
export function makeGitfileLinkedWorktree(base: string): { root: string } {
  const mainRepo = join(base, "main-repo");
  mkdirSync(mainRepo);
  rawGit(mainRepo, ["init", "-b", "main", "."]);
  writeFileSync(join(mainRepo, "a.txt"), "a\n");
  rawGit(mainRepo, ["add", "-A"]);
  rawGit(mainRepo, ["commit", "-m", "c1"]);
  const linked = join(base, "linked");
  rawGit(mainRepo, ["worktree", "add", linked]);
  // `<linked>/.git` is now a regular gitfile referencing <mainRepo>/.git/worktrees/linked
  return { root: linked };
}

/** A bare repository (no worktree, no `.git` subdirectory). */
export function makeBareRepo(base: string): { root: string } {
  const bare = join(base, "bare.git");
  mkdirSync(bare);
  rawGit(bare, ["init", "--bare", "-b", "main", "."]);
  return { root: bare };
}

/** An ordinary repo whose `.git` is a symlink to a sibling real git dir. */
export function makeSymlinkedGitDir(base: string): { root: string } {
  const real = join(base, "realrepo");
  mkdirSync(real);
  rawGit(real, ["init", "-b", "main", "."]);
  writeFileSync(join(real, "a.txt"), "a\n");
  rawGit(real, ["add", "-A"]);
  rawGit(real, ["commit", "-m", "c1"]);
  const shadow = join(base, "shadow");
  mkdirSync(shadow);
  symlinkSync(join(real, ".git"), join(shadow, ".git"));
  return { root: shadow };
}

/** An ordinary repo carrying sparse-checkout administrative state. */
export function makeSparseRepo(base: string): { root: string } {
  const root = join(base, "sparse");
  mkdirSync(root);
  rawGit(root, ["init", "-b", "main", "."]);
  writeFileSync(join(root, "a.txt"), "a\n");
  writeFileSync(join(root, "b.txt"), "b\n");
  rawGit(root, ["add", "-A"]);
  rawGit(root, ["commit", "-m", "c1"]);
  rawGit(root, ["sparse-checkout", "set", "--no-cone", "--skip-checks", "/a.txt"]);
  return { root };
}

/** An ordinary repo with an active `objects/info/alternates` file. */
export function makeAlternatesRepo(base: string): { root: string } {
  const donor = join(base, "donor");
  mkdirSync(donor);
  rawGit(donor, ["init", "-b", "main", "."]);
  writeFileSync(join(donor, "a.txt"), "a\n");
  rawGit(donor, ["add", "-A"]);
  rawGit(donor, ["commit", "-m", "donor"]);

  const root = join(base, "borrower");
  mkdirSync(root);
  rawGit(root, ["init", "-b", "main", "."]);
  writeFileSync(join(root, "b.txt"), "b\n");
  rawGit(root, ["add", "-A"]);
  rawGit(root, ["commit", "-m", "borrower"]);
  mkdirSync(join(root, ".git", "objects", "info"), { recursive: true });
  writeFileSync(join(root, ".git", "objects", "info", "alternates"), `${join(donor, ".git", "objects")}\n`);
  return { root };
}

/** Read a `.git`-relative file if present. */
export function gitFileText(gitDir: string, rel: string): string | undefined {
  const full = join(gitDir, rel);
  return existsSync(full) ? readFileSync(full, "utf8") : undefined;
}
