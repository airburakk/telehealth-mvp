import { describe, expect, it } from "vitest";
import { stateAfterRevoke, queueAcceptedState, publicationState, publicationEvidence, effectiveQueueState, remoteRisk } from "../../src/lib/social-calendar/queue-state";
const now = new Date("2026-10-19T17:31:00Z"), due = new Date("2026-10-19T17:30:00Z");
describe("provider queue is not publication", () => {
  it.each([['PENDING','CANCELLED'],['CLAIMED','CANCEL_UNKNOWN'],['UNKNOWN','CANCEL_UNKNOWN'],['QUEUED','CANCEL_PENDING'],['PUBLICATION_UNKNOWN','CANCEL_UNKNOWN'],['SUCCEEDED','SUCCEEDED']])("revoke %s -> %s", (a, b) => expect(stateAfterRevoke(a)).toBe(b));
  it("holds accepted queues and flags wrong dates/revoked acceptance", () => {
    expect(queueAcceptedState(true, due.toISOString(), due.toISOString())).toBe("QUEUED");
    expect(queueAcceptedState(false, due.toISOString(), due.toISOString())).toBe("CANCEL_PENDING");
    expect(queueAcceptedState(true, due.toISOString(), now.toISOString())).toBe("CANCEL_PENDING");
  });
  it("keeps a twelve-hour future queue distinct from a lost upload claim", () => {
    const claim = new Date("2026-10-19T05:30:00Z");
    expect(effectiveQueueState("QUEUED", claim, due, new Date("2026-10-19T08:00:00Z"))).toBe("QUEUED");
    expect(effectiveQueueState("QUEUED", claim, due, new Date("2026-10-19T18:00:00Z"))).toBe("PUBLICATION_UNKNOWN");
    expect(effectiveQueueState("CLAIMED", claim, due, now)).toBe("UNKNOWN");
  });
  it.each(["CANCEL_PENDING", "CANCEL_UNKNOWN", "CANCELLED", "PENDING"])("late publication after %s stays visible risk", state => expect(publicationState(true, state)).toBe("PUBLISHED_RISK"));
  it("requires a public platform link/id and actual publication time", () => {
    expect(publicationEvidence("youtube", "public-id", "https://www.youtube.com/shorts/public-id", due.toISOString(), now).platformId).toBe("public-id");
    for (const url of ["https://buffer.com/post/queue-id", "https://www.youtube.com/shorts/wrong-id", "javascript:alert(1)"])
      expect(() => publicationEvidence("youtube", "public-id", url, due.toISOString(), now)).toThrow();
    expect(() => publicationEvidence("youtube", "public-id", "https://www.youtube.com/shorts/public-id", "2026-10-20T17:30:00Z", now)).toThrow();
  });
  it("does not clear remote risk by local revocation", () => {
    expect(remoteRisk("CANCEL_PENDING", false, "queue-id", 1)).toBe(true);
    expect(remoteRisk("CANCEL_UNKNOWN", false, null, 1)).toBe(true);
    expect(remoteRisk("PUBLICATION_UNKNOWN", true, "queue-id", 1)).toBe(true);
    expect(remoteRisk("CANCELLED", false, "queue-id", 1)).toBe(false);
    expect(publicationState(false, "QUEUED")).toBe("PUBLISHED_RISK");
  });
});
