import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as yaml from "js-yaml";
import type { AgentDefinition } from "../../src/core/agent/index.js";
import type { SkillCatalogEntry } from "../../src/core/skill/index.js";
import { validateSkillDefinition, toSkillDescriptor } from "../../src/core/skill/index.js";
import { LocalReferenceSkillProvider } from "../../src/providers/skill/localReferenceSkillProvider.js";
import { MultiCapabilityProvider } from "../agent/fixtures.js";
import { selectSkillForTask } from "../../src/intelligence/skills/selectSkillForTask.js";
import { referenceSkillCatalogEntries, repositoryGitWorkflowS13H } from "../../src/intelligence/skills/index.js";
import {
  classifyGitOperation,
  classifyRepositoryState,
  compareRepositoryGitWorkflowRuns,
  deriveWorkflowProfileFromRules,
  findRepositoryWorkflowForbiddenKeys,
  gateRepositoryGitWorkflow,
  planRepositoryGitWorkflow,
  REPOSITORY_GIT_WORKFLOW_COMPARISON_ASSERTIONS,
  REPOSITORY_GIT_WORKFLOW_SKILL_ID,
  synthesizeRepositoryWorkflowDecision,
  validateRepositoryWorkflowDecision,
  FAITHFUL_SYNTHESIS_PROFILE,
  NAIVE_SYNTHESIS_PROFILE,
} from "../../src/intelligence/repository-git-workflow/index.js";
import type {
  PlanRepositoryGitWorkflowOutcome,
  RepositoryGitWorkflowHarness,
  RepositoryGitWorkflowInput,
  RepositoryWorkflowDecision,
} from "../../src/intelligence/repository-git-workflow/index.js";
import {
  ALL_NEGATIVE_INPUTS,
  ALL_POSITIVE_INPUTS,
  DeterministicRepositoryGitWorkflowModelProvider,
  FX_POS_001_INPUT,
  FX_POS_002_INPUT,
  FX_POS_003_INPUT,
  FX_POS_004_INPUT,
  FX_POS_005_INPUT,
  goodDecision,
  workflowHost,
  NEG_DETACHED_HEAD,
  NEG_DIVERGED,
  NEG_RESET_HARD,
  NEG_AUTO_STASH,
  NEG_ENV_STAGED,
  NEG_UNRELATED_TRACKED,
} from "./fixtures.js";
import {
  FX_POS_001_TRUTH,
  FX_POS_002_TRUTH,
  FX_POS_003_TRUTH,
  FX_POS_004_TRUTH,
  FX_POS_005_TRUTH,
} from "./fixtureTruth.js";
import { makeTempRepo, makeBareRemote, snapshotFromRepo, git } from "./gitFixtures.js";

const SKILL_PATH = "brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md";
const QC_PATH = "brain-bootstrap/quality-contracts/S13H_REPOSITORY_GIT_WORKFLOW_DEEP.yaml";
const CONTRACT_PATH = "brain-bootstrap/specs/REPOSITORY_GIT_WORKFLOW_CONTRACT_S13H.md";

function clone<T>(v: T): T {
  return structuredClone(v);
}

function skillHarness(agentDef: AgentDefinition): RepositoryGitWorkflowHarness {
  return {
    baseDefinition: agentDef,
    skillProvider: new LocalReferenceSkillProvider(referenceSkillCatalogEntries),
    modelProvider: new DeterministicRepositoryGitWorkflowModelProvider(),
    capabilityProvider: new MultiCapabilityProvider([]),
  };
}
function noSkillHarness(agentDef: AgentDefinition): RepositoryGitWorkflowHarness {
  return {
    baseDefinition: agentDef,
    modelProvider: new DeterministicRepositoryGitWorkflowModelProvider(),
    capabilityProvider: new MultiCapabilityProvider([]),
  };
}

async function runSkill(input: RepositoryGitWorkflowInput): Promise<PlanRepositoryGitWorkflowOutcome> {
  return planRepositoryGitWorkflow(input, skillHarness(workflowHost));
}
async function runNoSkill(input: RepositoryGitWorkflowInput): Promise<PlanRepositoryGitWorkflowOutcome> {
  return planRepositoryGitWorkflow(input, noSkillHarness(workflowHost));
}

function instrumentEntries(entries: SkillCatalogEntry[]): {
  entries: SkillCatalogEntry[];
  spies: Map<string, ReturnType<typeof vi.fn>>;
} {
  const spies = new Map<string, ReturnType<typeof vi.fn>>();
  const instrumented = entries.map((entry) => {
    const spy = vi.fn(entry.load_definition);
    spies.set(entry.descriptor.id, spy);
    return { descriptor: entry.descriptor, load_definition: spy };
  });
  return { entries: instrumented, spies };
}

const SUITE = [
  { id: "FX-POS-001", input: FX_POS_001_INPUT, truth: FX_POS_001_TRUTH },
  { id: "FX-POS-002", input: FX_POS_002_INPUT, truth: FX_POS_002_TRUTH },
  { id: "FX-POS-003", input: FX_POS_003_INPUT, truth: FX_POS_003_TRUTH },
  { id: "FX-POS-004", input: FX_POS_004_INPUT, truth: FX_POS_004_TRUTH },
  { id: "FX-POS-005", input: FX_POS_005_INPUT, truth: FX_POS_005_TRUTH },
];

// Measured comparison figures (T62) — transcribed into the verification report.
const REAL_BASELINE_CORRECT = 136;
const REAL_SKILL_CORRECT = 155;
const REAL_TOTAL_PER_ARM = 155;

// ===========================================================================
// SKILL-ARTIFACT — Part A integration integrity
// ===========================================================================

describe("SKILL-ARTIFACT-1 — canonical S13H Part A files exist with the approved vocabulary", () => {
  it("the three integrated Part A artifacts exist at their canonical paths and are non-trivial", () => {
    for (const p of [SKILL_PATH, QC_PATH, CONTRACT_PATH]) {
      expect(readFileSync(p, "utf8").length).toBeGreaterThan(2000);
    }
    expect(readFileSync(SKILL_PATH, "utf8")).toMatch(/^# REPOSITORY_GIT_WORKFLOW_SKILL_S13H/);
    expect(readFileSync(QC_PATH, "utf8")).toMatch(/^id: S13H_REPOSITORY_GIT_WORKFLOW_DEEP/);
    expect(readFileSync(CONTRACT_PATH, "utf8")).toMatch(/^# BRAIN — Repository Git Workflow Contract S13H/);
  });

  it("the Skill markdown carries the canonical repository-workflow vocabulary", () => {
    const text = readFileSync(SKILL_PATH, "utf8").toLowerCase();
    for (const token of [
      "execution_mode: skill_only",
      "it does not execute git",
      "unrelated tracked changes block",
      "destructive/history rewrite forbidden by default",
      "no automatic stash",
      "diff inspection mandatory",
      "normal push only",
      "provider-neutral",
      "s06 remains session-handoff owner",
    ]) {
      expect(text).toContain(token);
    }
  });
});

describe("SKILL-ARTIFACT-2 — typed S13H Skill validates and preserves canonical semantics", () => {
  it("passes S12 SkillDefinition validation", () => {
    const result = validateSkillDefinition(repositoryGitWorkflowS13H);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("has 24 MUST rules, 16 procedure steps and 12 verification checks", () => {
    expect(repositoryGitWorkflowS13H.rules.length).toBe(24);
    expect(repositoryGitWorkflowS13H.rules.every((r) => r.level === "MUST")).toBe(true);
    expect(repositoryGitWorkflowS13H.procedure.length).toBe(16);
    expect(repositoryGitWorkflowS13H.verification.length).toBe(12);
  });

  it("is decision-only with no transitive Skill/capability dependency", () => {
    expect(repositoryGitWorkflowS13H.requires.skills).toEqual([]);
    expect(repositoryGitWorkflowS13H.requires.capabilities).toEqual([]);
    expect(repositoryGitWorkflowS13H.permissions.allowed_capabilities).toEqual([]);
    expect(repositoryGitWorkflowS13H.permissions.allowed_side_effects).toEqual(["NONE"]);
  });

  it("the rule statements drive a fully faithful synthesis profile; empty text drives a fully naive one", () => {
    const faithful = deriveWorkflowProfileFromRules(repositoryGitWorkflowS13H.rules.map((r) => r.statement));
    expect(Object.values(faithful).every((v) => v === true)).toBe(true);
    const naive = deriveWorkflowProfileFromRules([]);
    expect(Object.values(naive).every((v) => v === false)).toBe(true);
  });
});

describe("SKILL-ARTIFACT-3 — DEEP Quality Contract integrity", () => {
  it("parses and satisfies the canonical S13H structure", () => {
    const doc = yaml.load(readFileSync(QC_PATH, "utf8")) as Record<string, any>;
    expect(doc.depth).toBe("DEEP");
    expect(doc.step).toBe("S13H");
    expect(doc.rationale.risk).toBe("HIGH");
    expect(doc.hard_invariants.length).toBe(28);
    expect(doc.semantic_dimensions.length).toBe(10);
    expect(doc.fixtures.minimum_positive_evaluable).toBe(5);
    expect(doc.fixtures.minimum_negative).toBe(12);
    const ev = doc.skill_vs_no_skill_evaluation;
    expect(ev.minimum_additional_correct_assertions_total).toBe(8);
    expect(ev.improvement_distribution.minimum_distinct_dimensions).toBe(4);
    expect(ev.improvement_distribution.minimum_additional_correct_assertions_per_improved_dimension).toBe(2);
    expect(ev.hard_invariant_score_with_skill).toBe(1.0);
    expect(ev.maximum_destructive_recommendations_with_skill).toBe(0);
  });
});

describe("SKILL-ARTIFACT-4 — Repository Git Workflow Contract spec integrity", () => {
  it("declares SKILL_ONLY, no new AgentDefinition, and no git execution in the Skill runtime", () => {
    const text = readFileSync(CONTRACT_PATH, "utf8");
    expect(text).toContain("Execution mode:** SKILL_ONLY");
    expect(text).toContain("New AgentDefinition:** NO");
    expect(text).toContain("Canonical Skill runtime side effects:** NONE");
    expect(text).toContain("RepositoryWorkflowDecision");
    expect(text).toContain("RepositoryStateSnapshot");
    for (let n = 1; n <= 66; n++) expect(text).toMatch(new RegExp(`\\bT${n}\\b`));
  });
});

// ===========================================================================
// T1-T66 (contract §22) — canonical numbering preserved.
// ===========================================================================

describe("T1 — a valid clean snapshot parses and drives a decision", () => {
  it("FX-POS-002 -> a validator-clean decision", async () => {
    const out = await runSkill(FX_POS_002_INPUT);
    expect(out.run.outcome).toBe("SUCCESS");
    expect(validateRepositoryWorkflowDecision(out.decision, FX_POS_002_INPUT).valid).toBe(true);
  });
});

describe("T2 — the snapshot input is not mutated", () => {
  it("input deep-equals its pre-run clone", async () => {
    const input = clone(FX_POS_002_INPUT);
    const before = JSON.stringify(input);
    await runSkill(input);
    synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe("T3 — detached HEAD blocks", () => {
  it("status BLOCKED, no commit/push plan", async () => {
    const out = await runSkill(NEG_DETACHED_HEAD);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.commit_plan).toBeNull();
    expect(out.decision.workspace.strategy).toBe("BLOCKED");
  });
});

describe("T4 — an unrelated tracked modification blocks", () => {
  it("FX-NEG-001 -> BLOCKED", async () => {
    const out = await runSkill(NEG_UNRELATED_TRACKED);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.blockers.join(" ")).toMatch(/unrelated tracked/i);
  });
});

describe("T5 — an unrelated staged path blocks", () => {
  it("FX-NEG-002 -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[1].input);
    expect(out.decision.status).toBe("BLOCKED");
  });
});

describe("T6 — a safe excluded untracked file does not block", () => {
  it("FX-POS-004 -> not BLOCKED; excluded docs never in a commit plan", async () => {
    const out = await runSkill(FX_POS_004_INPUT);
    expect(out.decision.status).not.toBe("BLOCKED");
    for (const doc of ["S13H_CHATGPT_PART_A_CANONICAL.md", "AUTHORIZE_S13H_PART_B.md"]) {
      expect(out.decision.commit_plan?.included_paths ?? []).not.toContain(doc);
      const c = out.decision.path_classification.find((x) => x.path === doc);
      expect(c?.disposition).toBe("EXCLUDED");
    }
  });
});

describe("T7 — an unknown untracked file inside intended scope blocks", () => {
  it("FX-NEG-005 -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[4].input);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.blockers.join(" ")).toMatch(/outside intended\/supporting scope|UNKNOWN/i);
  });
});

describe("T8 — sensitive-path precedence over intended", () => {
  it("FX-NEG-006: an intended .env still classifies SENSITIVE and blocks", async () => {
    const out = await runSkill(NEG_ENV_STAGED);
    expect(out.decision.status).toBe("BLOCKED");
    const c = out.decision.path_classification.find((x) => x.path === ".env");
    expect(c?.disposition).toBe("SENSITIVE");
  });
});

describe("T9 — an explicit safe sensitive-path exception works", () => {
  it(".env.example is not treated as sensitive", () => {
    const input = clone(FX_POS_002_INPUT);
    input.repository.paths.push({
      path: ".env.example",
      tracked: true,
      staged: true,
      modified: true,
      deleted: false,
      untracked: false,
    });
    input.change_intent.intended_paths.push(".env.example");
    const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    const c = decision.path_classification.find((x) => x.path === ".env.example");
    expect(c?.disposition).not.toBe("SENSITIVE");
  });
});

describe("T10 — direct current branch requires explicit policy", () => {
  it("without direct permission the strategy is not KEEP_CURRENT", async () => {
    const out = await runSkill(FX_POS_001_INPUT);
    expect(out.decision.workspace.strategy).not.toBe("KEEP_CURRENT");
  });
});

describe("T11 — default without direct permission selects a feature branch", () => {
  it("FX-POS-001 -> FEATURE_BRANCH", async () => {
    const out = await runSkill(FX_POS_001_INPUT);
    expect(out.decision.workspace.strategy).toBe("FEATURE_BRANCH");
  });
});

describe("T12 — required worktree for concurrency selects an isolated worktree", () => {
  it("FX-POS-003 -> ISOLATED_WORKTREE", async () => {
    const out = await runSkill(FX_POS_003_INPUT);
    expect(out.decision.workspace.strategy).toBe("ISOLATED_WORKTREE");
  });
});

describe("T13 — required worktree but worktree disallowed blocks", () => {
  it("worktree required + worktree_allowed false -> BLOCKED", () => {
    const input = clone(FX_POS_003_INPUT);
    input.policy.worktree_allowed = false;
    const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    expect(decision.workspace.strategy).toBe("BLOCKED");
    expect(decision.status).toBe("BLOCKED");
  });
});

describe("T14 — a commit write without authorization requires approval", () => {
  it("FX-NEG-013 -> APPROVAL_REQUIRED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[12].input);
    expect(out.decision.status).toBe("APPROVAL_REQUIRED");
    expect(out.decision.approvals_required).toContain("COMMIT");
  });
});

describe("T15 — a push write without authorization requires approval", () => {
  it("FX-NEG-014 -> APPROVAL_REQUIRED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[13].input);
    expect(out.decision.status).toBe("APPROVAL_REQUIRED");
    expect(out.decision.approvals_required).toContain("PUSH");
  });
});

describe("T16 — worktree/branch write authorization gates work", () => {
  it("authorizing branch write clears the branch approval", () => {
    const input = clone(FX_POS_001_INPUT);
    input.policy.branch_write_authorized = true;
    input.policy.commit_authorized = true;
    const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    expect(decision.approvals_required).not.toContain("CREATE_BRANCH");
  });
});

describe("T17 — reset --hard classifies destructive and blocks", () => {
  it("FX-NEG-009 -> BLOCKED with RESET_HARD forbidden", async () => {
    const out = await runSkill(NEG_RESET_HARD);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.forbidden_operations.map((o) => o.operation)).toContain("RESET_HARD");
    expect(out.decision.safe_operations.map((o) => o.operation)).not.toContain("RESET_HARD");
  });
});

describe("T18 — clean -fd classifies destructive and blocks", () => {
  it("FX-NEG-010 -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[9].input);
    expect(out.decision.status).toBe("BLOCKED");
  });
});

describe("T19 — push --force blocks", () => {
  it("classifyGitOperation('git push --force') is destructive", () => {
    expect(classifyGitOperation("git push --force")).toBe("DESTRUCTIVE_OR_HISTORY_REWRITE");
    expect(classifyGitOperation("PUSH_FORCE")).toBe("DESTRUCTIVE_OR_HISTORY_REWRITE");
  });
});

describe("T20 — force-with-lease blocks", () => {
  it("FX-NEG-011 -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[10].input);
    expect(out.decision.status).toBe("BLOCKED");
    expect(classifyGitOperation("push --force-with-lease")).toBe("DESTRUCTIVE_OR_HISTORY_REWRITE");
  });
});

describe("T21 — automatic stash blocks", () => {
  it("FX-NEG-012 -> BLOCKED, stash never a safe operation", async () => {
    const out = await runSkill(NEG_AUTO_STASH);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.safe_operations.some((o) => /stash/i.test(o.operation))).toBe(false);
  });
});

describe("T22 — rebase/amend of shared/published history blocks", () => {
  it("classifyGitOperation flags rebase / published amend", () => {
    expect(classifyGitOperation("git rebase origin/main")).toBe("DESTRUCTIVE_OR_HISTORY_REWRITE");
    expect(classifyGitOperation("git commit --amend")).toBe("DESTRUCTIVE_OR_HISTORY_REWRITE");
    expect(classifyGitOperation("REBASE_SHARED_HISTORY")).toBe("DESTRUCTIVE_OR_HISTORY_REWRITE");
  });
});

describe("T23 — ahead+behind divergence blocks", () => {
  it("FX-NEG-004 -> BLOCKED", async () => {
    const out = await runSkill(NEG_DIVERGED);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.commit_plan).toBeNull();
    expect(out.decision.push_plan).toBeNull();
  });
});

describe("T24 — behind-only state does not invent a rebase/reset fix", () => {
  it("a behind-only branch yields a finding, never a rebase/reset safe operation", () => {
    const input = clone(FX_POS_002_INPUT);
    input.repository.ahead = 0;
    input.repository.behind = 2;
    const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    expect(decision.safe_operations.some((o) => /rebase|reset/i.test(o.operation))).toBe(false);
    expect(decision.repository_findings.join(" ")).toMatch(/behind/i);
  });
});

describe("T25 — diff inspection evidence is required before commit", () => {
  it("FX-NEG-020 (no diff-inspection evidence) -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[19].input);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.blockers.join(" ")).toMatch(/diff.inspection|repo\.diff/i);
  });
});

describe("T26 — changed paths are all classified", () => {
  it("every changed/untracked snapshot path appears in path_classification", async () => {
    const out = await runSkill(FX_POS_004_INPUT);
    const ids = new Set(out.decision.path_classification.map((c) => c.path));
    for (const p of FX_POS_004_INPUT.repository.paths) {
      const changed = (p.tracked && (p.modified || p.staged || p.deleted)) || p.untracked;
      if (changed) expect(ids.has(p.path)).toBe(true);
    }
  });
});

describe("T27 — commit includes only intended/supporting paths", () => {
  it("FX-POS-005 commit plan is scoped to the intended + supporting diff", async () => {
    const out = await runSkill(FX_POS_005_INPUT);
    expect(out.decision.commit_plan?.included_paths).toEqual([
      "src/http/handlers.ts",
      "tests/http/handlers.test.ts",
    ]);
  });
});

describe("T28 — protected Part A drift blocks and returns to the Authoring Gate", () => {
  it("FX-NEG-008 -> BLOCKED naming the Authoring Gate", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[7].input);
    expect(out.decision.status).toBe("BLOCKED");
  });
  it("a genuinely protected drift path surfaces RETURN_TO_CHATGPT_AUTHORING_GATE", () => {
    const input = clone(FX_POS_002_INPUT);
    input.repository.paths.push({
      path: "brain-bootstrap/skills/REPOSITORY_GIT_WORKFLOW_SKILL_S13H.md",
      tracked: true,
      staged: true,
      modified: true,
      deleted: false,
      untracked: false,
    });
    const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    expect(decision.status).toBe("BLOCKED");
    expect(decision.blockers.join(" ")).toMatch(/RETURN_TO_CHATGPT_AUTHORING_GATE/);
  });
});

describe("T29 — commit-plan atomicity is enforced", () => {
  it("a mutated plan bundling an unrelated tracked path is rejected", () => {
    const input = clone(NEG_UNRELATED_TRACKED);
    const decision = goodDecision(input);
    const pkg = clone(decision);
    pkg.commit_plan = {
      intent: "x",
      included_paths: ["src/http/handlers.ts", "src/unrelated/module.ts"],
      excluded_paths: [],
      message: "feat: x",
      required_validation_refs: [],
    };
    const v = validateRepositoryWorkflowDecision(pkg, input);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("HI-016") || e.includes("HI-012"))).toBe(true);
  });
});

describe("T30 — the default commit message type maps from the change kind", () => {
  it("FEATURE -> feat:", async () => {
    const out = await runSkill(FX_POS_002_INPUT);
    expect(out.decision.commit_plan?.message).toMatch(/^feat: /);
  });
});

describe("T31 — no issue/PR number is invented", () => {
  it("the commit message contains no #NNN token", async () => {
    const out = await runSkill(FX_POS_002_INPUT);
    expect(out.decision.commit_plan?.message ?? "").not.toMatch(/#\d+/);
  });
});

describe("T32 — project-specific validation requirements come only from input", () => {
  it("commit_plan.required_validation_refs is a subset of supplied requirement ids", async () => {
    const out = await runSkill(FX_POS_002_INPUT);
    const ids = new Set(FX_POS_002_INPUT.validation_requirements.map((r) => r.id));
    for (const ref of out.decision.commit_plan?.required_validation_refs ?? []) {
      expect(ids.has(ref)).toBe(true);
    }
  });
});

describe("T33 — a failed BEFORE_COMMIT check blocks commit", () => {
  it("FX-NEG-017 -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[16].input);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.validation_gate.failed_requirement_ids).toContain("unit");
  });
});

describe("T34 — a stale fingerprint blocks", () => {
  it("FX-NEG-015 -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[14].input);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.validation_gate.stale_requirement_ids).toContain("unit");
  });
});

describe("T35 — a fresh fingerprint passes", () => {
  it("FX-POS-002 validation gate is PASS", async () => {
    const out = await runSkill(FX_POS_002_INPUT);
    expect(out.decision.validation_gate.status).toBe("PASS");
  });
});

describe("T36 — BEFORE_PUSH requirements are enforced for push", () => {
  it("a failed BEFORE_PUSH check blocks a push-requesting input", () => {
    const input = clone(FX_POS_005_INPUT);
    input.validation_evidence = input.validation_evidence.map((e) =>
      e.requirement_id === "typecheck" ? { ...e, status: "FAIL" as const } : e,
    );
    const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    expect(decision.status).toBe("BLOCKED");
  });
});

describe("T37 — a .env sensitive path blocks", () => {
  it("FX-NEG-006 -> BLOCKED", async () => {
    const out = await runSkill(NEG_ENV_STAGED);
    expect(out.decision.status).toBe("BLOCKED");
  });
});

describe("T38 — a private-key path blocks", () => {
  it("FX-NEG-007 -> BLOCKED", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[6].input);
    expect(out.decision.status).toBe("BLOCKED");
  });
});

describe("T39 — a supplied high-confidence secret finding blocks", () => {
  it("a path with secret_finding=true forces BLOCKED", () => {
    const input = clone(FX_POS_002_INPUT);
    input.repository.paths[0] = { ...input.repository.paths[0], secret_finding: true };
    const decision = synthesizeRepositoryWorkflowDecision(input, FAITHFUL_SYNTHESIS_PROFILE);
    expect(decision.status).toBe("BLOCKED");
  });
});

describe("T40 — the implementation does not claim universal secret detection", () => {
  it("the Skill markdown and QC both disclaim perfect detection", () => {
    expect(readFileSync(SKILL_PATH, "utf8").toLowerCase()).toContain("no perfect-secret-scanner claim");
    const doc = yaml.load(readFileSync(QC_PATH, "utf8")) as Record<string, any>;
    expect(doc.hard_invariants.some((h: any) => h.rule === "no_perfect_secret_detection_claim")).toBe(true);
  });
});

describe("T41 — the push plan force is always false", () => {
  it("FX-POS-005 push plan carries the literal false", async () => {
    const out = await runSkill(FX_POS_005_INPUT);
    expect(out.decision.push_plan?.force).toBe(false);
  });
});

describe("T42 — the push remote resolves to a supplied remote / policy", () => {
  it("FX-POS-005 push plan targets origin", async () => {
    const out = await runSkill(FX_POS_005_INPUT);
    expect(out.decision.push_plan?.remote).toBe("origin");
  });
});

describe("T43 — a provider-specific remote review binding rejects", () => {
  it("injecting a github_token into the handoff fails validation", () => {
    const decision = goodDecision(FX_POS_005_INPUT) as unknown as Record<string, any>;
    decision.remote_review_handoff.github_token = "x";
    const v = validateRepositoryWorkflowDecision(decision as unknown as RepositoryWorkflowDecision, FX_POS_005_INPUT);
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("HI-023"))).toBe(true);
  });
});

describe("T44 — a mandatory remote review with no capability surfaces correctly", () => {
  it("FX-NEG-018 -> BLOCKED (missing capability, not merely missing authorization)", async () => {
    const out = await runSkill(ALL_NEGATIVE_INPUTS[17].input);
    expect(out.decision.status).toBe("BLOCKED");
    expect(out.decision.blockers.join(" ")).toMatch(/remote review .*capability/i);
  });
});

describe("T45 — the repository handoff contains the canonical fields", () => {
  it("FX-POS-002 handoff carries branch/head/status/next action/do-not-do", async () => {
    const out = await runSkill(FX_POS_002_INPUT);
    const h = out.decision.repository_handoff;
    expect(h.head).toBe(FX_POS_002_INPUT.repository.head);
    expect(h.branch).toBe(FX_POS_002_INPUT.repository.branch);
    expect(typeof h.push_status).toBe("string");
    expect(typeof h.remote_review_status).toBe("string");
    expect(h.next_repository_action.length).toBeGreaterThan(0);
    expect(h.do_not_do.length).toBeGreaterThan(0);
  });
});

describe("T46 — S06 session-continuity ownership remains external", () => {
  it("the Skill markdown states S06 remains the session-handoff owner", () => {
    expect(readFileSync(SKILL_PATH, "utf8").toLowerCase()).toContain("s06 remains session-handoff owner");
  });
});

describe("T47 — STATE/CURRENT ownership remains caller/session-close", () => {
  it("the decision proposes no STATE.yaml / CURRENT.md write by default", async () => {
    const out = await runSkill(FX_POS_002_INPUT);
    expect(out.decision.commit_plan?.included_paths ?? []).not.toContain("brain-bootstrap/STATE.yaml");
    expect(readFileSync(SKILL_PATH, "utf8")).toMatch(/STATE\/CURRENT remain caller\/session-close bookkeeping/i);
  });
});

describe("T48 — no Git write occurs in the canonical Skill run", () => {
  it("the S13H module source contains no git-execution call", () => {
    const dir = "src/intelligence/repository-git-workflow";
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, entry), "utf8");
      // No process-spawning primitive of any kind is imported or used.
      expect(text).not.toMatch(/execFileSync|execSync|\bexec\(|spawnSync|\bspawn\(|child_process|node:child_process/);
    }
  });
});

describe("T49 — no repository-git-workflow AgentDefinition exists", () => {
  it("src/intelligence/agent-definitions/ gains no git-workflow agent", () => {
    const dir = "src/intelligence/agent-definitions";
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, entry), "utf8");
      expect(text).not.toContain(REPOSITORY_GIT_WORKFLOW_SKILL_ID);
      expect(text).not.toMatch(/role:\s*["'][a-z-]*git-workflow[a-z-]*["']/i);
    }
  });
  it("the S13H module imports nothing from ../agent-definitions/", () => {
    const dir = "src/intelligence/repository-git-workflow";
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".ts")) continue;
      expect(readFileSync(join(dir, entry), "utf8")).not.toMatch(/from\s+["'][^"']*agent-definitions/);
    }
  });
});

describe("T50 — no role/Skill-id-specific Core branch exists", () => {
  it("src/core/ contains no repository-git-workflow identifier or git-workflow role branch", () => {
    const offenders: string[] = [];
    function walk(d: string) {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (full.endsWith(".ts")) {
          const text = readFileSync(full, "utf8");
          if (
            text.includes("repository-git-workflow") ||
            /role\s*===\s*["']git-workflow["']/.test(text) ||
            /skillId\s*===\s*["']intelligence\.repository-git-workflow/.test(text)
          ) {
            offenders.push(full);
          }
        }
      }
    }
    walk("src/core");
    expect(offenders).toEqual([]);
  });
});

describe("T51 — S12 metadata-only discovery + lazy load are proven", () => {
  it("no full definition loads during discovery", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    await provider.discover({ query: "repository git workflow commit push", allowed_skill_ids: workflowHost.skills });
    for (const spy of spies.values()) expect(spy).not.toHaveBeenCalled();
  });
  it("selectSkillForTask loads only the S13H loader, exactly once", async () => {
    const { entries, spies } = instrumentEntries(referenceSkillCatalogEntries);
    const provider = new LocalReferenceSkillProvider(entries);
    const selection = await selectSkillForTask({
      task: "repository git workflow preflight branch worktree diff commit push handoff",
      agent_definition: workflowHost,
      provider,
    });
    expect(selection.loaded?.id).toBe(REPOSITORY_GIT_WORKFLOW_SKILL_ID);
    expect(spies.get(REPOSITORY_GIT_WORKFLOW_SKILL_ID)).toHaveBeenCalledTimes(1);
    for (const [id, spy] of spies.entries()) {
      if (id !== REPOSITORY_GIT_WORKFLOW_SKILL_ID) expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("T52 — the compiler run uses unchanged S10 compileAgentDefinition + S09 runAgent", () => {
  it("with-Skill and no-Skill runs both SUCCEED and differ only in the materialized objective", async () => {
    const withSkill = await runSkill(FX_POS_002_INPUT);
    const noSkill = await runNoSkill(FX_POS_002_INPUT);
    expect(withSkill.run.outcome).toBe("SUCCESS");
    expect(noSkill.run.outcome).toBe("SUCCESS");
    expect(withSkill.skillLoaded).toBe(true);
    expect(noSkill.skillLoaded).toBe(false);
    expect(withSkill.materializedDefinition.objective).toContain("SKILL_ID:");
    expect(noSkill.materializedDefinition.objective).not.toContain("SKILL_ID:");
    expect(withSkill.materializedDefinition.limits).toEqual(noSkill.materializedDefinition.limits);
    expect(withSkill.materializedDefinition.tools).toEqual(noSkill.materializedDefinition.tools);
  });
});

describe("T53 — a temp real-Git fixture models states without mutating the Brain repo", () => {
  it("clean / dirty / diverged snapshots come from disposable repos; Brain repo is untouched", () => {
    // Contract §20: prove the Brain repo's tracked status, HEAD, and origin/main
    // are all unchanged by the fixture block (not merely the .git dir mtime).
    const brainHeadBefore = git(".", ["rev-parse", "HEAD"]);
    const brainStatusBefore = git(".", ["status", "--porcelain=v1"]);
    const brainOriginBefore = git(".", ["rev-parse", "origin/main"]);
    const repo = makeTempRepo();
    const remote = makeBareRemote();
    try {
      repo.writeFile("a.txt", "one\n");
      repo.run("add", "a.txt");
      repo.run("commit", "-m", "feat: first");
      repo.run("remote", "add", "origin", remote.dir);
      repo.run("push", "-u", "origin", "main");
      const clean = snapshotFromRepo(repo);
      expect(clean.branch).toBe("main");
      expect(clean.detached_head).toBe(false);
      expect(clean.paths).toEqual([]);

      repo.writeFile("b.txt", "dirty\n");
      const dirty = snapshotFromRepo(repo);
      expect(dirty.paths.some((p) => p.path === "b.txt" && p.untracked)).toBe(true);

      repo.writeFile("a.txt", "one-local\n");
      repo.run("commit", "-am", "feat: local ahead");
      const ahead = snapshotFromRepo(repo);
      expect(ahead.ahead).toBe(1);
    } finally {
      repo.cleanup();
      remote.cleanup();
    }
    expect(git(".", ["rev-parse", "HEAD"])).toBe(brainHeadBefore);
    expect(git(".", ["status", "--porcelain=v1"])).toBe(brainStatusBefore);
    expect(git(".", ["rev-parse", "origin/main"])).toBe(brainOriginBefore);
  });
});

for (const [n, id] of [
  [54, "FX-POS-001"],
  [55, "FX-POS-002"],
  [56, "FX-POS-003"],
  [57, "FX-POS-004"],
  [58, "FX-POS-005"],
] as const) {
  const entry = SUITE.find((s) => s.id === id)!;
  describe(`T${n} — ${id} passes`, () => {
    it(`${id} decision matches its frozen ground truth and validates`, async () => {
      const out = await runSkill(entry.input);
      expect(out.decision.status).toBe(entry.truth.expected_status);
      expect(out.decision.workspace.strategy).toBe(entry.truth.expected_workspace_strategy);
      expect(validateRepositoryWorkflowDecision(out.decision, entry.input).valid).toBe(true);
      if (entry.truth.expected_commit_included_paths.length > 0) {
        expect(out.decision.commit_plan?.included_paths).toEqual(entry.truth.expected_commit_included_paths);
      }
      for (const forbidden of entry.truth.forbidden_commit_paths) {
        expect(out.decision.commit_plan?.included_paths ?? []).not.toContain(forbidden);
      }
      expect(out.decision.approvals_required.slice().sort()).toEqual(
        entry.truth.expected_approvals_required.slice().sort(),
      );
      if (entry.truth.expects_no_commit_plan) expect(out.decision.commit_plan).toBeNull();
      if (entry.truth.expects_no_push_plan) expect(out.decision.push_plan).toBeNull();
    });
  });
}

describe("T59 — the canonical negative fixtures each fail in the required way", () => {
  for (const { id, input, expected } of ALL_NEGATIVE_INPUTS) {
    it(`${id} -> ${expected}`, async () => {
      const out = await runSkill(input);
      expect(out.decision.status).toBe(expected);
      if (expected === "BLOCKED") {
        expect(out.decision.blockers.length).toBeGreaterThan(0);
        expect(out.decision.commit_plan).toBeNull();
      }
    });
  }
  it("covers >= 12 negatives (QC minimum_negative)", () => {
    expect(ALL_NEGATIVE_INPUTS.length).toBeGreaterThanOrEqual(12);
  });
});

describe("T60 — frozen ground truth is inaccessible to the model / provider", () => {
  it("fixtures.ts never imports fixtureTruth.ts and no truth token reaches the materialized objective", () => {
    const fixturesText = readFileSync("tests/repository-git-workflow/fixtures.ts", "utf8");
    for (const line of fixturesText.split("\n")) {
      const isModuleRef = /^\s*(import|export)\b/.test(line) || /\brequire\s*\(/.test(line);
      if (isModuleRef) expect(line).not.toMatch(/fixtureTruth/i);
    }
    expect(fixturesText).not.toMatch(/RepositoryGitWorkflowFixtureTruth/);
    for (const token of ["expected_status", "expected_workspace_strategy", "forbidden_commit_paths", "regression_only"]) {
      expect(fixturesText).not.toContain(token);
    }
  });
});

describe("T61 — no separate deliberately-bad baseline planner", () => {
  it("one synthesizer, profile derived from rule text; no withSkill / fixtureId / skillId branch", () => {
    const comparatorText = readFileSync(
      "src/intelligence/repository-git-workflow/compareRepositoryGitWorkflowRuns.ts",
      "utf8",
    );
    expect(comparatorText).not.toMatch(/synthesize(Baseline|Bad|Naive)Decision/);
    const providerText = readFileSync("tests/repository-git-workflow/fixtures.ts", "utf8");
    expect(providerText).not.toMatch(/if\s*\(\s*withSkill/);
    expect(providerText).not.toMatch(/fixtureId\s*===|skillId\s*===/);
    const a = skillHarness(workflowHost);
    const b = noSkillHarness(workflowHost);
    expect(a.baseDefinition).toBe(b.baseDefinition);
    expect(a.modelProvider.constructor).toBe(b.modelProvider.constructor);
  });
});

describe("T62 — the Skill-vs-no-Skill improvement threshold passes", () => {
  async function buildComparison() {
    const skillCases = [];
    const baselineCases = [];
    for (const { input, truth } of SUITE) {
      const s = await runSkill(input);
      const b = await runNoSkill(input);
      skillCases.push({ candidateDecision: s.candidate, input, truth });
      baselineCases.push({ candidateDecision: b.candidate, input, truth });
    }
    return compareRepositoryGitWorkflowRuns(baselineCases, skillCases);
  }

  it("with-Skill hard invariants 100%, 0 destructive/unintended/secret recs, >= +8 correct, >= 4 improved dims", async () => {
    const cmp = await buildComparison();
    expect(cmp.skill.hard_invariant_correct).toBe(cmp.skill.hard_invariant_total);
    expect(cmp.skill.destructive_recommendations).toBe(0);
    expect(cmp.skill.unintended_commit_paths).toBe(0);
    expect(cmp.skill.secret_path_commit_recommendations).toBe(0);
    expect(cmp.additional_correct_total).toBeGreaterThanOrEqual(8);
    expect(cmp.improved_dimensions.length).toBeGreaterThanOrEqual(4);
    expect(cmp.hard_invariant_regressed).toBe(false);
    expect(cmp.meets_threshold).toBe(true);
    expect(cmp.baseline.correct).toBeLessThan(cmp.skill.correct);

    expect(cmp.skill.total_assertions).toBe(REAL_TOTAL_PER_ARM);
    expect(cmp.skill.correct).toBe(REAL_SKILL_CORRECT);
    expect(cmp.baseline.correct).toBe(REAL_BASELINE_CORRECT);
  });

  it("each improved dimension contributes at least +2 correct assertions", async () => {
    const cmp = await buildComparison();
    for (const d of cmp.improved_dimensions) {
      expect(cmp.skill.by_dimension[d].correct - cmp.baseline.by_dimension[d].correct).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("T63 — no hard-invariant regression", () => {
  it("skill hard-invariant score is perfect and >= baseline", async () => {
    const skillCases = [];
    const baselineCases = [];
    for (const { input, truth } of SUITE) {
      skillCases.push({ candidateDecision: (await runSkill(input)).candidate, input, truth });
      baselineCases.push({ candidateDecision: (await runNoSkill(input)).candidate, input, truth });
    }
    const cmp = compareRepositoryGitWorkflowRuns(baselineCases, skillCases);
    expect(cmp.skill.hard_invariant_correct).toBe(cmp.skill.hard_invariant_total);
    expect(cmp.skill.hard_invariant_correct).toBeGreaterThanOrEqual(cmp.baseline.hard_invariant_correct);
  });
  it("the comparison assertion set has 31 assertions across all 10 dimensions", () => {
    expect(REPOSITORY_GIT_WORKFLOW_COMPARISON_ASSERTIONS.length).toBe(31);
    const dims = new Set(REPOSITORY_GIT_WORKFLOW_COMPARISON_ASSERTIONS.map((a) => a.dimension));
    expect(dims.size).toBe(10);
  });
});

describe("T64 — no S14 Capability Registry / provider implementation is introduced", () => {
  it("no src/providers or src/core git capability appears; the module imports no provider", () => {
    const dir = "src/intelligence/repository-git-workflow";
    for (const entry of readdirSync(dir)) {
      if (!entry.endsWith(".ts")) continue;
      const text = readFileSync(join(dir, entry), "utf8");
      expect(text).not.toMatch(/from\s+["'][^"']*providers/);
      expect(text).not.toMatch(/CapabilityRegistry|GitProvider|GitHubAdapter/);
    }
  });
});

describe("T65 — S13H contains no S13I backend-api-engineering pull-forward", () => {
  it("the S13H implementation remains isolated after separately authorized S13I begins", () => {
    const s13hIndex = readFileSync("src/intelligence/repository-git-workflow/index.ts", "utf8");
    expect(s13hIndex).not.toContain("backend-api-engineering");
    expect(statSync("src/intelligence/backend-api-engineering").isDirectory()).toBe(true);
  });
});

describe("T66 — the full prior regression surface remains green", () => {
  it("the reference Skill catalog preserves the first 11 entries through S13H", () => {
    const ids = referenceSkillCatalogEntries.map((e) => e.descriptor.id);
    expect(ids.length).toBeGreaterThanOrEqual(11);
    expect(ids.slice(0, 10)).toEqual([
      "research.evidence-grounded.s11",
      "reference.summarize.v1",
      "reference.format-check.v1",
      "requirements.discovery.s13a",
      "knowledge-gap.analysis.s13b",
      "deep-research.evidence-grounded.s13c",
      "software-architecture.adr.s13d",
      "agent-engineering.design.s13e",
      "intelligence.implementation-planning.s13f",
      "intelligence.task-prompt-compiler.s13g",
    ]);
    expect(ids[10]).toBe(REPOSITORY_GIT_WORKFLOW_SKILL_ID);
  });
  it("no forbidden vendor / provider token appears in the S13H Part A artifacts", () => {
    const forbidden = /openai|anthropic api key|gpt-4|claude-[0-9]/i;
    expect(readFileSync(SKILL_PATH, "utf8")).not.toMatch(forbidden);
    expect(readFileSync(QC_PATH, "utf8")).not.toMatch(forbidden);
    expect(readFileSync(CONTRACT_PATH, "utf8")).not.toMatch(forbidden);
  });
  it("descriptor projection remains metadata-only for the S13H Skill", () => {
    const descriptor = toSkillDescriptor(repositoryGitWorkflowS13H);
    expect(descriptor.id).toBe(REPOSITORY_GIT_WORKFLOW_SKILL_ID);
    expect((descriptor as any).rules).toBeUndefined();
    expect((descriptor as any).procedure).toBeUndefined();
  });
});

// ===========================================================================
// Extra helper coverage — mechanical regression anchors.
// ===========================================================================

describe("anchor — the deterministic gate never trusts the model's claimed status", () => {
  it("a candidate that claims READY on a detached-HEAD input is still BLOCKED by the gate", async () => {
    const out = await runNoSkill(NEG_DETACHED_HEAD);
    expect(out.candidate.status).toBe("READY"); // the naive model happily claims READY
    expect(out.decision.status).toBe("BLOCKED"); // the deterministic gate overrides it
  });
});

describe("anchor — profile derivation is content-driven, not a mode switch", () => {
  it("the no-Skill materialized objective yields a naive profile; the with-Skill one yields faithful", async () => {
    const withSkill = await runSkill(FX_POS_002_INPUT);
    const noSkill = await runNoSkill(FX_POS_002_INPUT);
    expect(
      Object.values(deriveWorkflowProfileFromRules([withSkill.materializedDefinition.objective])).every((v) => v === true),
    ).toBe(true);
    expect(
      Object.values(deriveWorkflowProfileFromRules([noSkill.materializedDefinition.objective])).every((v) => v === false),
    ).toBe(true);
  });
});

describe("anchor — the gate self-validates its authoritative decision", () => {
  it("gateRepositoryGitWorkflow returns a HI-001..HI-028 valid decision for every canonical fixture", () => {
    for (const input of [...ALL_POSITIVE_INPUTS, ...ALL_NEGATIVE_INPUTS.map((n) => n.input)]) {
      const { decision, decisionValidation } = gateRepositoryGitWorkflow(input);
      expect(decisionValidation.valid).toBe(true);
      expect(["READY", "APPROVAL_REQUIRED", "BLOCKED"]).toContain(decision.status);
      expect(findRepositoryWorkflowForbiddenKeys(decision)).toEqual([]);
    }
  });
});

describe("anchor — classifyRepositoryState reports structural safety facts without mutation", () => {
  it("FX-NEG-004 is diverged; FX-POS-002 is clean", () => {
    expect(classifyRepositoryState(NEG_DIVERGED).diverged).toBe(true);
    const clean = classifyRepositoryState(FX_POS_002_INPUT);
    expect(clean.diverged).toBe(false);
    expect(clean.detached_head).toBe(false);
  });
});
