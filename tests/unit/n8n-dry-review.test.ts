import { describe, expect, it } from "vitest";
import workflow from "../../infra/n8n/doctorium-rubrik-dry-review.json";

describe("n8n offline dry-review export", () => {
  it("cannot schedule or post content and carries no credentials", () => {
    expect(workflow.active).toBe(false);
    expect(workflow.nodes.map(n => n.type)).toEqual(["n8n-nodes-base.manualTrigger", "n8n-nodes-base.httpRequest"]);
    const http = workflow.nodes[1];
    expect(http.parameters).toMatchObject({ method: "POST", url: "http://kart:3000/rubrik/bugun?kuru=1" });
    expect(http.retryOnFail).toBe(false);
    expect(JSON.stringify(workflow)).not.toMatch(/credentials|Bearer|\/sonuc|access_token|scheduleTrigger/);
    expect(workflow.settings.saveDataSuccessExecution).toBe("none");
  });
});
