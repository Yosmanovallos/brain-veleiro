import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "vitest";
import { HOST_GIT } from "./repoFixtures.js";

/**
 * Controlled fake-`git` fixture executables for the version gate and for
 * process-group cleanup exercises (contract §39, §37; skill §22). Real
 * canonical repository exercises always use {@link HOST_GIT}; these fixtures
 * only cover cases a real git binary cannot produce on demand — a chosen
 * version string, a hang, and a same-group descendant that resists SIGTERM.
 *
 * Each fixture is a Node script with a real absolute-`node` shebang and mode
 * 0o755, written OUTSIDE the Brain worktree, so the provider validates and
 * (in the drift/permission exercises) mutates exactly that file's identity.
 */

export type FakeGitBehavior =
  | "delegate" | "hang" | "hang-grandchild" | "stubborn-grandchild" | "flood-stderr-grandchild";

export interface FakeGitSpec {
  /** Emitted verbatim after `git version ` on `--version`. */
  version: string;
  /** What the fake does for any NON-`--version` argv. */
  behavior: FakeGitBehavior;
  /** For "*grandchild": absolute path of the pid marker the grandchild writes. */
  marker?: string;
}

function fakeGitSource(spec: FakeGitSpec): string {
  const version = JSON.stringify(spec.version);
  const real = JSON.stringify(HOST_GIT);
  const marker = JSON.stringify(spec.marker ?? "");
  const lines = [
    "const cp = require('node:child_process');",
    "const fs = require('node:fs');",
    "const args = process.argv.slice(2);",
    `if (args[0] === '--version') { process.stdout.write('git version ' + ${version} + '\\n'); process.exit(0); }`,
  ];
  if (spec.behavior === "delegate") {
    lines.push(`const r = cp.spawnSync(${real}, args, { stdio: ['ignore', 'inherit', 'inherit'] });`);
    lines.push("process.exit(r.status == null ? 1 : r.status);");
  } else if (spec.behavior === "hang") {
    lines.push("setInterval(() => {}, 1e9);");
  } else if (spec.behavior === "hang-grandchild") {
    lines.push(
      `const gc = cp.spawn(process.execPath, ['-e', "require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1e9)", ${marker}], { stdio: 'ignore' });`,
      "void gc; setInterval(() => {}, 1e9);",
    );
  } else if (spec.behavior === "flood-stderr-grandchild") {
    // grandchild writes its pid marker immediately; the leader waits for the
    // marker to exist, THEN floods stderr — so a fast provider overflow never
    // races the grandchild's marker write.
    lines.push(
      `const gc = cp.spawn(process.execPath, ['-e', "require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1e9)", ${marker}], { stdio: 'ignore' });`,
      "void gc;",
      `const wait = setInterval(() => { if (fs.existsSync(${marker})) { clearInterval(wait); const b = Buffer.alloc(65536, 101); setInterval(() => process.stderr.write(b), 3); } }, 5);`,
      "setInterval(() => {}, 1e9);",
    );
  } else {
    // stubborn-grandchild: installs a SIGTERM handler and refuses to exit;
    // NEVER calls setsid()/detach. The fake-git leader has no handler.
    lines.push(
      `const gc = cp.spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1e9)", ${marker}], { stdio: 'ignore' });`,
      "void gc; setInterval(() => {}, 1e9);",
    );
  }
  return lines.join("\n") + "\n";
}

export interface GitBin {
  dir: string;
  /** Write a fake git and return its absolute path. */
  fakeGit(name: string, spec: FakeGitSpec): Promise<string>;
  /** Write an arbitrary node script fixture and return its absolute path. */
  script(name: string, body: string): Promise<string>;
}

export async function withGitBin(exercise: (bin: GitBin) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(join(tmpdir(), "brain-s14d-bin-"));
  try {
    const bin: GitBin = {
      dir,
      async fakeGit(name, spec) {
        const path = join(dir, name);
        await fs.writeFile(path, `#!${process.execPath}\n${fakeGitSource(spec)}`, { mode: 0o755 });
        await fs.chmod(path, 0o755);
        return path;
      },
      async script(name, body) {
        const path = join(dir, name);
        await fs.writeFile(path, `#!${process.execPath}\n${body}\n`, { mode: 0o755 });
        await fs.chmod(path, 0o755);
        return path;
      },
    };
    await exercise(bin);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
    expect(existsSync(dir)).toBe(false);
  }
}

/** Real host git version triple, for tests that assert the runtime is in range. */
export function hostGitVersion(): { raw: string; major: number; minor: number; patch: number } {
  const raw = execFileSync(HOST_GIT, ["--version"], { encoding: "utf8" }).trim();
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(raw)!;
  return { raw, major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
