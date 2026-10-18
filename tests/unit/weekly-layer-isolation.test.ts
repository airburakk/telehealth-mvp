import { describe, expect, it } from "vitest";
import workflow from "../../infra/n8n/doctorium-weekly-draft-check.json";
describe("separate weekly n8n layer", () => {
  it("has no daily trigger/state, enqueue, publish, cancel or embedded credential path", () => {
    expect(workflow.active).toBe(false);
    expect(workflow.nodes.map(n => n.type)).toEqual(["n8n-nodes-base.manualTrigger", "n8n-nodes-base.httpRequest"]);
    expect(workflow.nodes[1].parameters).toMatchObject({ method: "GET", authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth" });
    expect(workflow.nodes[1].parameters.url).toContain("/rubrik/haftalik/durum");
    expect(workflow.nodes[1].retryOnFail).toBe(false);
    expect(JSON.stringify(workflow)).not.toMatch(/\/sosyal\/|\/rubrik\/bugun|staticData|scheduleTrigger|Bearer|access_token|createPost|deletePost|media_publish|youtubeShortsGunu/);
    expect(workflow.settings.saveManualExecutions).toBe(false);
  });
});
