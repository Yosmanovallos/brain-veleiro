import { DEFAULT_DELIVERY_POLICY } from "../../src/intelligence/delivery-documentation-demo/index.js";
import type {
  ArchitectureFact,
  DeliveryDocumentationDemoInput,
  DeliveryPolicy,
  DemoSurface,
  LimitationFact,
  NextStepFact,
  RepositoryFact,
  VerificationEvidence,
} from "../../src/intelligence/delivery-documentation-demo/index.js";

export const REV = "rev:abc123def456";
export const OLD_REV = "rev:aaa000older0";

export const policy = (over: Partial<DeliveryPolicy> = {}): DeliveryPolicy => ({ ...DEFAULT_DELIVERY_POLICY, ...over });

export function baseInput(): DeliveryDocumentationDemoInput {
  const repository_facts: RepositoryFact[] = [
    { fact_id: "rf-name", kind: "PROJECT_NAME", subject_ref: "proj:brain", value: "brain-veleiro", source_ref: "src:package.json", revision_ref: REV, confidence: "ACCEPTED" },
    {
      fact_id: "rf-feat-parser",
      kind: "KNOWN_FEATURE",
      subject_ref: "feat:parser",
      value: "parses a bounded delivery input",
      source_ref: "src:module/deliveryModel.ts",
      revision_ref: REV,
      confidence: "ACCEPTED",
      asserts_status: "VERIFIED",
      evidence_ref: "ev-test-parser",
    },
    {
      fact_id: "rf-feat-builder",
      kind: "KNOWN_FEATURE",
      subject_ref: "feat:builder",
      value: "builds a structured delivery package",
      source_ref: "src:module/deliveryModel.ts",
      revision_ref: REV,
      confidence: "ACCEPTED",
      asserts_status: "IMPLEMENTED",
    },
    {
      fact_id: "rf-feat-reporter",
      kind: "KNOWN_FEATURE",
      subject_ref: "feat:reporter",
      value: "an optional HTML reporter surface",
      source_ref: "src:module/reporter.ts",
      revision_ref: REV,
      confidence: "REPORTED",
    },
    { fact_id: "rf-nonfeat-deploy", kind: "KNOWN_NON_FEATURE", subject_ref: "feat:deploy", value: "no deployment is performed by this module", source_ref: "src:contract", revision_ref: REV, confidence: "ACCEPTED" },
    {
      fact_id: "rf-cmd-build",
      kind: "PACKAGE_SCRIPT",
      subject_ref: "script:build",
      value: "npm run build",
      source_ref: "src:package.json",
      revision_ref: REV,
      confidence: "VERIFIED",
      setup_role: "REQUIRED",
      expected_signal_ref: "signal:dist directory emitted with no tsc error",
      purpose_ref: "compile the TypeScript module",
      precondition_refs: ["pre:node 24 active"],
    },
    {
      fact_id: "rf-cmd-test",
      kind: "PACKAGE_SCRIPT",
      subject_ref: "script:test",
      value: "BRAIN_LOG_LEVEL=$BRAIN_LOG_LEVEL npm test",
      source_ref: "src:package.json",
      revision_ref: REV,
      confidence: "VERIFIED",
      setup_role: "OPTIONAL",
      expected_signal_ref: "signal:all suites report pass",
    },
    { fact_id: "rf-env-log", kind: "SAFE_ENV_VARIABLE_NAME", subject_ref: "BRAIN_LOG_LEVEL", value: "BRAIN_LOG_LEVEL", source_ref: "src:README.md", revision_ref: REV, confidence: "ACCEPTED" },
  ];

  const verification_evidence: VerificationEvidence[] = [
    { evidence_id: "ev-typecheck", kind: "TYPECHECK", subject_ref: "repo", revision_ref: REV, status: "PASS", summary_ref: "sum:0 type errors", source_ref: "src:ci-run" },
    { evidence_id: "ev-test-parser", kind: "TEST", subject_ref: "feat:parser", revision_ref: REV, status: "PASS", summary_ref: "sum:parser suite green", source_ref: "src:ci-run" },
    { evidence_id: "ev-build", kind: "BUILD", subject_ref: "script:build", revision_ref: REV, status: "PASS", summary_ref: "sum:clean build", source_ref: "src:ci-run" },
    { evidence_id: "ev-demo-run", kind: "DEMO_PROOF", subject_ref: "demo:cli-run", revision_ref: REV, status: "PASS", summary_ref: "sum:cli produced a package", source_ref: "src:ci-run" },
    { evidence_id: "ev-cli-surface", kind: "OTHER_DETERMINISTIC", subject_ref: "surface:cli", revision_ref: REV, status: "PASS", summary_ref: "sum:cli entrypoint present", source_ref: "src:repo-scan" },
  ];

  const demo_surface: DemoSurface = {
    surface_ref: "surface:cli",
    kind: "CLI",
    exists: true,
    revision_ref: REV,
    entry_action_ref: "action:pipe a sample input through the existing cli entrypoint",
    precondition_refs: ["pre:build complete"],
    steps: [
      {
        step_ref: "ds-happy",
        title_ref: "Run the happy path",
        action_ref: "action:pipe a well-formed delivery input",
        expected_result_ref: "result:prints a READY package with a verified claim",
        evidence_ref: "ev-demo-run",
        env_sensitive: false,
        fallback_ref: "fallback:inspect stderr for a blocker code",
      },
      {
        step_ref: "ds-failure",
        title_ref: "Show a bounded failure path",
        action_ref: "action:pipe an input whose revision ref is empty",
        expected_result_ref: "result:prints a BLOCKED package citing MISSING_DELIVERY_REVISION",
        evidence_ref: "ev-demo-run",
        env_sensitive: true,
        fallback_ref: "fallback:skip when the sandbox has no writable stdin",
      },
    ],
  };

  const architecture_facts: ArchitectureFact[] = [
    { fact_id: "af-model", kind: "COMPONENT", subject_ref: "comp:model", value: "deterministic delivery package builder", source_ref: "src:module/deliveryModel.ts", revision_ref: REV },
    { fact_id: "af-quality", kind: "COMPONENT", subject_ref: "comp:quality", value: "atomic quality evaluator and unsafe counters", source_ref: "src:module/quality.ts", revision_ref: REV },
    { fact_id: "af-bound-core", kind: "BOUNDARY", subject_ref: "bound:core", value: "the module changes no Core or agent definition surface", source_ref: "src:contract", revision_ref: REV },
    { fact_id: "af-bound-runtime", kind: "BOUNDARY", subject_ref: "bound:runtime", value: "the module performs no filesystem, network or shell action", source_ref: "src:contract", revision_ref: REV },
    { fact_id: "af-dep-sqlite", kind: "DEPENDENCY", subject_ref: "dep:sqlite", value: "better-sqlite3 remains the only runtime dependency", source_ref: "src:package.json", revision_ref: REV },
    { fact_id: "af-absent-deploy", kind: "ABSENT_OR_DEFERRED", subject_ref: "comp:deploy", value: "a deployment path is intentionally deferred to a later stage", source_ref: "src:contract", revision_ref: REV },
  ];

  const limitations: LimitationFact[] = [
    {
      limitation_id: "lim-crlf",
      summary: "six pre-existing Part A files show CRLF line-ending noise",
      severity: "LOW",
      impact: "cosmetic only; an ignore-space diff is empty and the files predate this step",
      status: "KNOWN",
      source_refs: ["src:git-audit"],
    },
    {
      limitation_id: "lim-stdin",
      summary: "the failure-path demo step needs interactive stdin",
      severity: "MEDIUM",
      impact: "the step is skipped in a sandbox without a writable tty",
      status: "UNVERIFIED",
      source_refs: ["src:demo-notes"],
    },
  ];

  const next_step_candidates: NextStepFact[] = [
    {
      next_step_id: "ns-deploy",
      summary: "S13R: build the deployment adapter, environment provisioning and health checks",
      priority: "P1",
      status: "PROPOSED",
      dependency_or_owner_ref: "owner:deployment-track",
      source_refs: ["src:contract"],
    },
    {
      next_step_id: "ns-fixtures",
      summary: "add more negative fixtures for the parser edge cases",
      priority: "P2",
      status: "DEFERRED",
      dependency_or_owner_ref: "owner:qa-track",
      source_refs: ["src:backlog"],
    },
  ];

  return {
    delivery_identity: {
      project_ref: "proj:brain-veleiro",
      revision_ref: REV,
      delivery_scope_ref: "scope:s13q-reference-module",
      audience: "audience:next-engineering-session",
      baseline_revision_ref: OLD_REV,
      accepted_ancestry_or_range_ref: "ancestry:OLD_REV..REV linear",
      release_or_handoff_ref: "handoff:s13q-part-b",
    },
    repository_facts,
    verification_evidence,
    demo_surface,
    policy: policy(),
    architecture_facts,
    limitations,
    next_step_candidates,
    evidence_refs: ["ref:issue-1", "ref:s13q-preflight"],
  };
}

/** A minimal but valid input: identity + one implemented claim + one command + one PASS evidence,
 *  no optional sections and no demo sub-steps. Builder and a feature-blind synthesizer coincide here. */
export function minimalInput(seed: string): DeliveryDocumentationDemoInput {
  return {
    delivery_identity: {
      project_ref: `proj:${seed}`,
      revision_ref: REV,
      delivery_scope_ref: `scope:${seed}`,
      audience: "audience:reviewer",
    },
    repository_facts: [
      { fact_id: "rf-name", kind: "PROJECT_NAME", subject_ref: "proj", value: seed, source_ref: "src:package.json", revision_ref: REV, confidence: "ACCEPTED" },
      { fact_id: "rf-feat", kind: "KNOWN_FEATURE", subject_ref: `feat:${seed}`, value: `${seed} core behavior`, source_ref: "src:module", revision_ref: REV, confidence: "ACCEPTED" },
      { fact_id: "rf-cmd", kind: "PACKAGE_SCRIPT", subject_ref: "script:install", value: "npm ci", source_ref: "src:package.json", revision_ref: REV, confidence: "ACCEPTED" },
    ],
    verification_evidence: [
      { evidence_id: "ev-a-typecheck", kind: "TYPECHECK", subject_ref: "repo", revision_ref: REV, status: "PASS", summary_ref: "sum:clean", source_ref: "src:ci" },
    ],
    demo_surface: {
      surface_ref: "surface:lib",
      kind: "LIBRARY_API",
      exists: true,
      revision_ref: REV,
      entry_action_ref: "action:import the public entrypoint and call it",
      precondition_refs: [],
    },
    policy: policy(),
  };
}

type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;

export type MutableInput = DeepMutable<DeliveryDocumentationDemoInput>;

export const mutate = (
  value: DeliveryDocumentationDemoInput,
  fn: (v: MutableInput) => void,
): DeliveryDocumentationDemoInput => {
  const copy = structuredClone(value) as MutableInput;
  fn(copy);
  return copy as DeliveryDocumentationDemoInput;
};
