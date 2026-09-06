// S14D — Git Capability: fixed provider-built child environment, fixed Git
// safety option/config floor, and the closed provider-owned operation table.
//
// Nothing in this file reads `process.env`. The child environment is
// constructed from module constants only (contract §12, §18). The Git safety
// floor (contract §13, §19) is applied to every repository-facing invocation
// and is model-immutable. The operation table (contract §11) has no network or
// mutation path: `buildArgv` only ever emits `--version`, `status`, `rev-parse`,
// `cat-file` and `ls-tree` from fixed templates.

import type { GitOperationFamily } from "./types.js";

/**
 * Exact provider-built child environment. The host/parent environment is never
 * spread, merged or inherited; a host `GIT_DIR` / `GIT_WORK_TREE` /
 * `GIT_EXEC_PATH` / `GIT_CONFIG*` / `GIT_OBJECT_DIRECTORY` /
 * `GIT_ALTERNATE_OBJECT_DIRECTORIES` / `GIT_INDEX_FILE` / `GIT_NAMESPACE` /
 * credential / `LD_*` / `NODE_OPTIONS` value cannot reach or redirect the child
 * because it is simply not in this map (contract §12).
 */
export function buildGitEnv(): Record<string, string> {
  const env: Record<string, string> = Object.create(null);
  const entries: Array<[string, string]> = [
    ["PATH", "/usr/bin:/bin"],
    ["HOME", "/nonexistent"],
    ["XDG_CONFIG_HOME", "/nonexistent"],
    ["GNUPGHOME", "/nonexistent"],

    ["GIT_CONFIG_NOSYSTEM", "1"],
    ["GIT_CONFIG_GLOBAL", "/dev/null"],
    ["GIT_CONFIG_SYSTEM", "/dev/null"],

    ["GIT_TERMINAL_PROMPT", "0"],
    ["GIT_ASKPASS", "/bin/false"],
    ["SSH_ASKPASS", "/bin/false"],
    ["GIT_SSH_COMMAND", "/bin/false"],

    ["GIT_PAGER", "cat"],
    ["GIT_OPTIONAL_LOCKS", "0"],
    ["GIT_LITERAL_PATHSPECS", "1"],
    ["GIT_NO_REPLACE_OBJECTS", "1"],
    ["GIT_LFS_SKIP_SMUDGE", "1"],
    ["GIT_DISCOVERY_ACROSS_FILESYSTEM", "0"],

    ["LC_ALL", "C"],
    ["LANG", "C"],
    ["TZ", "UTC"],
  ];
  for (const [key, value] of entries) env[key] = value;
  return env;
}

/** Provider-internal hooks path — a non-existent directory, never surfaced. */
export const NONEXISTENT_HOOKS_PATH = "/nonexistent/brain-git-hooks";

/**
 * Fixed Git `-c` config overrides (contract §13, §19). Model-immutable. No
 * override is omitted because it appears redundant on a particular developer
 * machine. `<root>` placeholders are substituted with the canonical realpath at
 * call time by {@link safetyConfigPairs}.
 */
const CONFIG_OVERRIDE_TEMPLATE: ReadonlyArray<readonly [string, string]> = [
  ["safe.directory", "<root>"],
  ["core.worktree", "<root>"],

  ["core.hooksPath", NONEXISTENT_HOOKS_PATH],
  ["core.fsmonitor", "false"],
  ["core.untrackedCache", "false"],
  ["core.pager", "cat"],
  ["core.editor", "/bin/false"],
  ["core.excludesFile", "/dev/null"],
  ["core.attributesFile", "/dev/null"],

  ["credential.helper", ""],
  ["gpg.program", "/bin/false"],
  ["commit.gpgsign", "false"],
  ["log.showSignature", "false"],
  ["tag.gpgSign", "false"],

  ["gc.auto", "0"],
  ["gc.autoDetach", "false"],
  ["gc.writeCommitGraph", "false"],
  ["maintenance.auto", "false"],
  ["fetch.writeCommitGraph", "false"],
  ["core.commitGraph", "false"],

  ["protocol.file.allow", "never"],
  ["protocol.ext.allow", "never"],

  ["filter.lfs.smudge", "cat"],
  ["filter.lfs.process", ""],
  ["filter.lfs.required", "false"],

  ["status.submoduleSummary", "false"],
  ["submodule.recurse", "false"],
];

/** `["-c", "key=value", ...]` for the canonical root (contract §13, §19). */
export function safetyConfigArgs(canonicalRoot: string): string[] {
  const out: string[] = [];
  for (const [key, value] of CONFIG_OVERRIDE_TEMPLATE) {
    out.push("-c", `${key}=${value.replace("<root>", canonicalRoot)}`);
  }
  return out;
}

/**
 * Fixed global Git safety prefix (contract §13). `--git-dir` / `--work-tree`
 * pin the invocation to the trusted config; `GIT_DISCOVERY_ACROSS_FILESYSTEM=0`
 * in the env is defence in depth. The model supplies none of these values.
 */
export function globalSafetyArgs(canonicalRoot: string): string[] {
  return [
    "--no-pager",
    "--no-optional-locks",
    "--no-replace-objects",
    `--git-dir=${canonicalRoot}/.git`,
    `--work-tree=${canonicalRoot}`,
    ...safetyConfigArgs(canonicalRoot),
  ];
}

/** Fixed canonical status template (contract §15.2). */
export const STATUS_ARGS: readonly string[] = [
  "status",
  "--porcelain=v2",
  "--branch",
  "-z",
  "--untracked-files=all",
  "--ignore-submodules=all",
];

export interface OperationInput {
  /** Canonical repository root realpath. */
  canonicalRoot: string;
  /** Already grammar-validated `HEAD` or full 40/64-hex object id. */
  revision?: string;
  /** Already grammar-validated logical repository-relative path. */
  path?: string;
  /** Already resolved full 40/64-hex object id (commit or blob). */
  objectId?: string;
}

/**
 * The ENTIRE set of Git argv this provider can ever produce. Every branch is a
 * fixed template; the only model-influenced values are `revision` (constrained
 * to `HEAD` or full hex before it reaches here) and `path` (constrained to the
 * bounded logical grammar and placed strictly after a provider-owned `--`).
 *
 * There is deliberately no `default:` pass-through and no string concatenation
 * of a command line.
 */
export function buildArgv(family: GitOperationFamily, input: OperationInput): string[] {
  const g = (): string[] => globalSafetyArgs(input.canonicalRoot);
  switch (family) {
    case "VERSION":
      return ["--version"];
    case "STATUS":
      return [...g(), ...STATUS_ARGS];
    case "RESOLVE_HEAD":
      // HEAD only; never a model revision expression.
      return [...g(), "rev-parse", "--verify", "--end-of-options", "HEAD"];
    case "VERIFY_COMMIT_OBJECT": {
      const oid = input.objectId ?? "";
      if (!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(oid)) throw new Error("INVALID_OPERATION_INPUT");
      return [...g(), "cat-file", "-t", oid];
    }
    case "RESOLVE_TREE_ENTRY": {
      const commit = input.revision ?? "";
      const path = input.path ?? "";
      if (!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(commit)) throw new Error("INVALID_OPERATION_INPUT");
      // `-l` yields the object size so an oversized blob is rejected before it
      // is read. `-z` NUL-terminates; `--` ends options; the literal path is the
      // final argv value and is never treated as a pathspec program.
      return [...g(), "ls-tree", "-l", "-z", commit, "--", path];
    }
    case "READ_BLOB": {
      const oid = input.objectId ?? "";
      if (!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(oid)) throw new Error("INVALID_OPERATION_INPUT");
      return [...g(), "cat-file", "blob", oid];
    }
    default: {
      // Exhaustiveness guard — a new family cannot silently become a generic runner.
      const never: never = family;
      throw new Error(`UNKNOWN_OPERATION_FAMILY:${String(never)}`);
    }
  }
}

/**
 * Structural deny set (contract §11.1, §17). Referenced by the source-level
 * operation-table audit; no code path in this directory may emit any of these
 * as a Git subcommand.
 */
export const STRUCTURAL_DENY_SET: readonly string[] = [
  "fetch", "pull", "push", "clone", "ls-remote", "remote", "submodule",
  "send-pack", "receive-pack", "upload-pack", "daemon", "credential",
  "add", "commit", "rm", "mv", "branch", "checkout", "switch", "restore",
  "reset", "clean", "stash", "worktree", "tag", "notes", "update-ref",
  "config", "gc", "maintenance", "repack", "prune", "replace", "rebase",
  "merge", "cherry-pick", "am", "apply",
];
