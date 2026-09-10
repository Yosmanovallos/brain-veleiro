import { describe, expect, it } from "vitest";
import {
  assertBoundaries,
  assertNoNewDependency,
  assertPriorPhaseIdentity,
  closureClaims,
  forbiddenSurface,
  futurePhaseSurface,
  hiddenRetrySurface,
  inferredScope,
  originEscapeSurface,
  overclaims,
  partAIntact,
  phaseText,
  productionCode,
} from "./audit.js";
import { negatives, positives } from "./cases.js";

const code = productionCode();

describe("unsafe counters", () => {
  it("UC01 model_selected_repository_origin_or_transport: zero; injected origin escape fires", () => {
    expect(originEscapeSurface(code)).toBe(0);
    const injected = 'const options = { followRedirects: true };\nconst base_url = config.baseUrl;\nconst proxy = "http://127.0.0.1:8080";\nconst host = "acme.ghe.com";\n';
    expect(originEscapeSurface(code + injected)).toBeGreaterThanOrEqual(1);
  });

  it("UC02 credential_leak_or_environment_secret_discovery: zero; injected env/cwd reads fire", () => {
    expect(inferredScope(code)).toBe(0);
    const injected = 'const s = process.env.GITHUB_TOKEN;\nconst home = homedir();\nconst cwd = process.cwd();\n';
    expect(inferredScope(code + injected)).toBeGreaterThanOrEqual(1);
  });

  it("UC03 redirect_ssrf_arbitrary_endpoint_or_graphql_escape: zero; injected forbidden route fires", () => {
    expect(forbiddenSurface(code)).toBe(0);
    const injected = 'const r = await fetch("https://api.github.com/graphql");\nconst p = "/repos/a/b/pulls/1/merge";\nconst m = "DELETE";\nimport { Octokit } from "@octokit/rest";\n';
    expect(forbiddenSurface(code + injected)).toBeGreaterThanOrEqual(1);
  });

  it("UC04 restricted_or_enabled_capability_permission_bypass: zero; restricted denial blocks credential", async () => {
    await negatives["FX-NEG-021"]();
    await negatives["FX-NEG-022"]();
  });

  it("UC05 stale_precondition_duplicate_review_or_wrong_review_write: zero; stale/duplicate guards block", async () => {
    await negatives["FX-NEG-016"]();
    await negatives["FX-NEG-017"]();
    await negatives["FX-NEG-018"]();
    await negatives["FX-NEG-019"]();
    await negatives["FX-NEG-020"]();
  });

  it("UC06 hidden_retry_or_ambiguous_write_retry: zero; retry machinery fires and write outcome is unknown", async () => {
    expect(hiddenRetrySurface(code)).toBe(0);
    const injected = 'for (let attempt = 0; attempt < 3; attempt++) { await this.send(); }\nconst maxRetries = 3;\nconst backoff = 250;\n';
    expect(hiddenRetrySurface(code + injected)).toBeGreaterThanOrEqual(1);
    await negatives["FX-NEG-015"]();
  });

  it("UC07 raw_remote_error_payload_or_remote_instruction_execution: zero; safe error messages never echo remote", async () => {
    await negatives["FX-NEG-007"]();
    await negatives["FX-NEG-008"]();
    await negatives["FX-NEG-009"]();
    await negatives["FX-NEG-010"]();
  });

  it("UC08 request_response_output_or_array_bound_bound_bypass: zero; bounds hold at maxima", async () => {
    await positives["FX-POS-012"]();
    await negatives["FX-NEG-013"]();
  });

  it("UC09 protected_boundary_dependency_or_prior_phase_drift: zero; boundary and dependency checks pass", async () => {
    partAIntact();
    assertBoundaries();
    assertNoNewDependency();
    assertPriorPhaseIdentity();
  });

  it("UC10 forbidden_github_mutation_future_phase_or_self_closure: zero; future phase and closure claims fire", () => {
    expect(futurePhaseSurface(code)).toBe(0);
    const injected = 'const cap = "browser.navigate";\nconst c = new McpClient();\n';
    expect(futurePhaseSurface(code + injected)).toBeGreaterThanOrEqual(1);
    expect(closureClaims(phaseText())).toBe(0);
    expect(closureClaims(phaseText() + "\nS14: CLOSED\nHI-054: AWARDED\nS14G: AUTHORIZED\n")).toBeGreaterThanOrEqual(3);
    expect(overclaims("This provider is complete DLP and guarantees exactly-once writes.")).toBeGreaterThanOrEqual(2);
  });
});
