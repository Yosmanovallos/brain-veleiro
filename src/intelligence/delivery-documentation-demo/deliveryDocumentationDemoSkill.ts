import type { SkillDefinition } from "../../core/skill/index.js";
import {
  DELIVERY_DOCUMENTATION_DEMO_QUALITY_CONTRACT_REF,
  DELIVERY_DOCUMENTATION_DEMO_SKILL_ID,
} from "./constants.js";
export {
  DELIVERY_DOCUMENTATION_DEMO_QUALITY_CONTRACT_REF,
  DELIVERY_DOCUMENTATION_DEMO_SKILL_ID,
} from "./constants.js";

// Generic method prose. Each statement expresses a reusable delivery-engineering
// concept — never a fixture id, arm id, expected answer or grader truth.
const mustRules = [
  "Every delivery package identifies the exact delivered project revision; an ambiguous or conflicting revision blocks a ready package.",
  "A claim that depends on another revision is admissible only through an explicit accepted ancestry or range relation.",
  "The structured package is authoritative; rendered Markdown is a derivative projection and adds no claim.",
  "Every material claim is traceable to accepted repository facts or executed verification evidence, or it is marked unknown or a limitation.",
  "Implemented and verified are distinct claim states and are never conflated; a source test alone does not prove verified.",
  "A roadmap, spec, backlog, todo, mock, fixture or test name never proves implementation; such claims are deferred or available-not-verified.",
  "Unsupported claims are omitted or marked unknown; polished prose is never treated as evidence.",
  "The architecture summary describes the architecture that already exists and its established boundaries.",
  "The architecture summary introduces no new provider, database, queue, framework, service, deployment topology or agent decision.",
  "When architecture evidence is incomplete the architecture section is partial; it is not completed by inference.",
  "Every required setup or run step is derived from an accepted repository command or package script fact.",
  "Every required setup or run step declares its preconditions and an expected observable signal.",
  "Environment variable names, ports, URLs, file paths and service names are never invented; each must appear in an accepted repository fact.",
  "Secret values, credentials, cookies, authorization headers and private keys never enter delivery content; a safe variable name may appear without its value.",
  "The demo is a reproducible evidence-bound walkthrough over an already-existing runnable or inspectable surface.",
  "The demo never creates a new server, route, UI, browser automation, screenshot recorder, seed system, public URL or deployment.",
  "The declared demo surface must exist and be revision compatible before any demo step is emitted.",
  "Every demo step declares an action, an expected observable result and resolvable evidence references.",
  "Every environment-sensitive demo step declares a truthful fallback or stop condition instead of promising success.",
  "A demo step shows only behavior supported by accepted acceptance, evaluation or test evidence; skipped, failed or blocked behavior is never shown as a success path.",
  "Known material limitations, unverified areas and material uncertainty are represented explicitly with severity, impact and provenance and are never euphemized away.",
  "Next steps are recommendations labeled proposed, deferred or required-before-production; they never mutate current implementation status.",
  "Deployment, containerization, health checks and hosting are later-stage work; they appear only as future next steps, never as performed or completed work.",
  "Capability registry, connector, MCP, OAuth, verifier agent, workflow runtime and orchestration work is later-stage work and is not pulled forward.",
  "The evidence index resolves every referenced id, is deduplicated and is deterministically ordered; a prose citation is not an evidence reference.",
  "When evidence conflicts, canonical source precedence is applied and both provenance references are retained; a lower-precedence claim never silently overwrites executable verification.",
  "Provenance records the delivered revision, any accepted ancestry relation and the kinds of sources consulted.",
  "Delivery output contains no raw logs, raw prompts, raw tool payloads, raw provider errors or private personal data.",
  "Output is deterministic: byte-equivalent normalized inputs yield byte-equivalent packages with identical ordering, with no wall clock, randomness, environment or hidden IO.",
  "The candidate never awards its own step pass, honor invariant or independent verification; a deterministic gate recomputes the package and a fresh verifier confirms it.",
] as const;

export const deliveryDocumentationDemoSkillS13Q: SkillDefinition = {
  id: DELIVERY_DOCUMENTATION_DEMO_SKILL_ID,
  version: "1.0.0",
  description:
    "Turn verified repository and build evidence into one bounded, truthful and reproducible delivery package — README-grade summary, existing-architecture summary, evidence-backed setup/run procedure, evidence-bound demo walkthrough, explicit limitations, status-labeled next steps and provenance — without inventing product behavior or pulling deployment, capability, verifier or runtime work forward.",
  applies_when: {
    task_kinds: ["delivery-documentation", "handoff-readiness", "demo-script", "readme-derivation", "architecture-summary"],
    signals: ["deliver", "handoff", "README", "setup instructions", "demo walkthrough", "limitations", "next steps", "evidence index"],
    exclusions: ["deployment", "containerization", "hosting", "browser automation", "connector binding", "verifier agent", "workflow runtime"],
  },
  inputs: [
    {
      name: "delivery_documentation_demo_input",
      description: "One bounded DeliveryDocumentationDemoInput of identity, repository facts, verification evidence, demo surface and policy.",
      required: true,
      schema: { type: "object" },
    },
  ],
  outputs: [
    {
      name: "delivery_documentation_demo_result",
      description: "One deterministic DeliveryDocumentationDemoResult with status, blockers, structured package, coverage and warnings.",
      required: true,
      schema: { type: "object" },
    },
  ],
  requires: {
    skills: [],
    capabilities: [],
    context_sources: ["CURRENT_TASK", "APPROVED_SPEC", "QUALITY_CONTRACT", "AGENT_RUN_RESULT", "REPOSITORY_FACT", "RUNTIME_METADATA"],
    quality_contract_refs: [DELIVERY_DOCUMENTATION_DEMO_QUALITY_CONTRACT_REF],
  },
  rules: mustRules.map((statement, index) => ({ id: `DDD-R${index + 1}`, level: "MUST" as const, statement })),
  procedure: [
    {
      id: "DDD-P1",
      title: "Confirm scope and revision",
      instruction: "Confirm S13Q scope and the exact delivered revision; freeze caller-supplied repository and evidence facts.",
      requires: ["delivery_documentation_demo_input"],
      produces: ["frozen_facts"],
    },
    {
      id: "DDD-P2",
      title: "Ground claims and sections",
      instruction: "Derive claim statuses, architecture summary, setup/run steps and demo steps only from accepted facts and evidence, applying source precedence.",
      requires: ["frozen_facts"],
      produces: ["grounded_sections"],
    },
    {
      id: "DDD-P3",
      title: "Register limitations and next steps",
      instruction: "Record material limitations and unknowns explicitly and emit status-labeled next steps without future-stage pull-forward.",
      requires: ["grounded_sections"],
      produces: ["registers"],
    },
    {
      id: "DDD-P4",
      title: "Emit and gate",
      instruction: "Recompute coverage and status deterministically, emit the immutable structured package plus an optional Markdown projection, and gate the actual candidate against a fresh recomputation.",
      requires: ["registers"],
      produces: ["delivery_documentation_demo_result"],
    },
  ],
  verification: [
    { id: "DDD-V1", kind: "DETERMINISTIC", criterion: "Every material claim resolves to accepted evidence or is marked unknown/limitation.", evidence_required: true },
    { id: "DDD-V2", kind: "DETERMINISTIC", criterion: "Setup/run and demo steps invent no command, env variable, port, URL or path and stay within existing surfaces.", evidence_required: true },
    { id: "DDD-V3", kind: "DETERMINISTIC", criterion: "The candidate package is recomputed and byte-compared; no self-certification is trusted.", evidence_required: true },
  ],
  permissions: { allowed_capabilities: [], allowed_side_effects: ["NONE"], deny_unlisted_capabilities: true },
  evals: ["evals/s13q/claim-status-honesty", "evals/s13q/setup-demo-reproducibility", "evals/s13q/stage-boundaries"],
};
