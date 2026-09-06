import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute, sep } from "node:path";
import { expect } from "vitest";
import { WorkspaceShellCapabilityProvider } from "../../src/providers/capability/shell/workspaceShellCapabilityProvider.js";
import type { WorkspaceShellCommandProfile, WorkspaceShellConfig } from "../../src/providers/capability/shell/types.js";

// Deterministic Node fixture programs. Each is written outside the repository
// worktree with a real absolute-`node` shebang and mode 0o755, so the profile's
// `executable` is the script path itself (its identity/permissions are the ones
// the provider validates and, in the drift/permission exercises, mutates).
const SCRIPTS: Record<string, string> = {
  ok: `process.stdout.write("ready");`,
  probe: `process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), env: process.env, cwd: process.cwd() }));`,
  exit2: `process.stderr.write("boom"); process.exit(2);`,
  emit: `const n = Number(process.argv[2]); const s = process.argv[3]; const b = Buffer.alloc(n, 120); if (s === "out" || s === "both") process.stdout.write(b); if (s === "err" || s === "both") process.stderr.write(b);`,
  emitctrl: `const n = Number(process.argv[2]); const s = process.argv[3]; const b = Buffer.alloc(n, 1); if (s === "out" || s === "both") process.stdout.write(b); if (s === "err" || s === "both") process.stderr.write(b);`,
  badutf8: `process.stdout.write(Buffer.from([0xff, 0xfe, 0x80]));`,
  secret: `process.stdout.write("api_key=" + "synthetic-abcdef123456");`,
  leak: `process.stdout.write(process.argv[2] + "|" + process.argv[3]);`,
  spin: `setInterval(() => {}, 1e9);`,
  redirect: `require("node:fs").writeFileSync(process.argv[2], "written"); process.stdout.write("done");`,
  sleep: `setTimeout(() => process.stdout.write("slept"), 150);`,
  sleepN: `setTimeout(() => process.stdout.write("slept"), Number(process.argv[2]));`,
  tree: `const cp = require("node:child_process"); const marker = process.argv[2];
const gc = cp.spawn(process.execPath, ["-e", "require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1e9)", marker], { stdio: "ignore" });
process.stdout.write("parent " + process.pid + " gc " + gc.pid); setInterval(() => {}, 1e9);`,
  treeflood: `const cp = require("node:child_process"); const f = require("node:fs"); const marker = process.argv[2];
const gc = cp.spawn(process.execPath, ["-e", "const f=require('fs'); const pg=p=>{const s=f.readFileSync('/proc/'+p+'/stat','utf8'); return Number(s.slice(s.lastIndexOf(')')+2).split(' ')[2]);}; f.writeFileSync(process.argv[1], String(process.pid)); if (!process.send) process.exit(70); process.send({ event:'ready', pid:process.pid, pgrp:pg('self'), parent_pgrp:pg(process.ppid), stubborn:false }); setInterval(() => {}, 1e9)", marker], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
gc.once("message", proof => { const marked = Number(f.readFileSync(marker, "utf8")); if (proof?.event !== "ready" || proof.pid !== gc.pid || marked !== gc.pid) process.exit(71); f.writeFileSync(marker + ".ready", JSON.stringify(proof)); const b = Buffer.alloc(65536, 120); setInterval(() => process.stdout.write(b), 5); });
gc.once("exit", () => process.exit(72)); setInterval(() => {}, 1e9);`,
  // Stubborn same-group grandchild: installs a SIGTERM handler and refuses to
  // exit; NEVER calls setsid()/detach. The leader has no SIGTERM handler, so it
  // dies on SIGTERM first — the provider must still SIGKILL the group.
  stubborn: `const cp = require("node:child_process"); const marker = process.argv[2];
const gc = cp.spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); require('fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1e9)", marker], { stdio: "ignore" });
process.stdout.write("parent " + process.pid + " gc " + gc.pid); setInterval(() => {}, 1e9);`,
  stubbornflood: `const cp = require("node:child_process"); const f = require("node:fs"); const marker = process.argv[2];
const gc = cp.spawn(process.execPath, ["-e", "const f=require('fs'); process.on('SIGTERM', () => {}); const pg=p=>{const s=f.readFileSync('/proc/'+p+'/stat','utf8'); return Number(s.slice(s.lastIndexOf(')')+2).split(' ')[2]);}; f.writeFileSync(process.argv[1], String(process.pid)); if (!process.send) process.exit(70); process.send({ event:'ready', pid:process.pid, pgrp:pg('self'), parent_pgrp:pg(process.ppid), stubborn:true }); setInterval(() => {}, 1e9)", marker], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
gc.once("message", proof => { const marked = Number(f.readFileSync(marker, "utf8")); if (proof?.event !== "ready" || proof.pid !== gc.pid || marked !== gc.pid) process.exit(71); f.writeFileSync(marker + ".ready", JSON.stringify(proof)); const b = Buffer.alloc(65536, 120); setInterval(() => process.stdout.write(b), 5); });
gc.once("exit", () => process.exit(72)); setInterval(() => {}, 1e9);`,
};

export const fixtureSource = (name: "treeflood" | "stubbornflood"): string => SCRIPTS[name];

export interface ShellSandbox {
  base: string;
  root: string;
  bin: string;
  script(name: keyof typeof SCRIPTS): string;
}

/** Disposable workspace + fixture-binary tree under os.tmpdir(), removed afterwards. */
export async function withShellSandbox(exercise: (sb: ShellSandbox) => Promise<void>): Promise<void> {
  const base = await fs.mkdtemp(join(tmpdir(), "brain-s14c-"));
  const rel = relative(process.cwd(), base);
  expect(isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)).toBe(true);
  const root = join(base, "workspace");
  const bin = join(base, "bin");
  try {
    await fs.mkdir(root);
    await fs.mkdir(bin);
    await fs.mkdir(join(root, "nested"));
    await fs.mkdir(join(root, "nested", "deep"));
    for (const [name, body] of Object.entries(SCRIPTS)) {
      const path = join(bin, name);
      await fs.writeFile(path, `#!${process.execPath}\n${body}\n`, { mode: 0o755 });
      await fs.chmod(path, 0o755);
    }
    await exercise({ base, root, bin, script: name => join(bin, name) });
  } finally {
    await fs.rm(base, { recursive: true, force: true });
    await expect(fs.lstat(base)).rejects.toMatchObject({ code: "ENOENT" });
  }
}

/** A minimally-valid LOCAL_ONLY profile; override fields per exercise. */
export function profile(overrides: Partial<WorkspaceShellCommandProfile> = {}): WorkspaceShellCommandProfile {
  return {
    profile_id: "qa.probe",
    executable: "/nonexistent",
    argv: [],
    env: {},
    cwd_allow_prefixes: ["."],
    max_timeout_ms: 5000,
    declared_effects: "LOCAL_ONLY",
    ...overrides,
  };
}

export const create = (config: WorkspaceShellConfig): Promise<WorkspaceShellCapabilityProvider> =>
  WorkspaceShellCapabilityProvider.create(config);

/** Build a single-profile config rooted at `root`. */
export function config(root: string, only: WorkspaceShellCommandProfile): WorkspaceShellConfig {
  return { workspace_root: root, profiles: [only] };
}
