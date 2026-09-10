import { describe, expect, it } from "vitest";
import { agentExec, assertCompatibleContracts, CompatibleRemoteInspectTestProvider, definition, harness, REMOTE } from "./helpers.js";

describe("S14F registry and provider swap", () => {
  it("executes repository.remote.inspect through Restricted -> registry -> GitHub provider", async () => {
    const h = harness({ script: [{ json: { default_branch: "main", private: false, archived: false, html_url: "https://github.com/acme/widget" } }] });
    const result = await agentExec(h.provider, REMOTE, {});
    expect(result.outcome).toBe("SUCCESS");
    expect(result.output?.data).toMatchObject({ repository_id: "qa.repo", default_branch: "main" });
  });

  it("swaps the provider under the same AgentDefinition and capability ID", async () => {
    const github = harness({ script: [{ json: { default_branch: "main", private: true, archived: false, html_url: "https://github.com/acme/widget" } }] });
    const compatible = new CompatibleRemoteInspectTestProvider({
      repository_id: "qa.repo",
      default_branch: "main",
      is_private: true,
      archived: false,
      web_url: "https://github.com/acme/widget",
    });
    await assertCompatibleContracts(github.provider, compatible, REMOTE);

    const bytesBefore = JSON.stringify(definition);
    const first = await agentExec(github.provider, REMOTE, {}, definition, "github-rest");
    const second = await agentExec(compatible, REMOTE, {}, definition, "compatible-test");
    expect(JSON.stringify(definition)).toBe(bytesBefore);
    expect([first.outcome, second.outcome]).toEqual(["SUCCESS", "SUCCESS"]);
    expect(Object.keys(first.output!.data!).sort()).toEqual(Object.keys(second.output!.data!).sort());
    expect(first.output?.data).toMatchObject({ repository_id: "qa.repo", is_private: true });
    expect(second.output?.data).toMatchObject({ repository_id: "qa.repo", is_private: true });
  });
});
