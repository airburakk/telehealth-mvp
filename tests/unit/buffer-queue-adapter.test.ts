import { describe, expect, it, vi } from "vitest";
import { createBufferQueueAdapter } from "../../infra/kart/lib/buffer-queue-adapter.mjs";
const postId = "0123456789abcdef01234567", channelId = "abcdef0123456789abcdef01";
const now = () => Date.parse("2026-10-19T10:00:00Z");
const post = { id: postId, channelId, status: "scheduled", schedulingType: "automatic", notificationStatus: null,
  dueAt: "2026-10-19T17:30:00Z", sentAt: null, externalLink: null, allowedActions: ["deletePost"] };
const response = (data: unknown) => new Response(JSON.stringify({ data }));
describe("official Buffer read/delete adapter, disconnected by default", () => {
  it("never calls any transport without separately verified capabilities", async () => {
    const fetchImpl = vi.fn(); const a = createBufferQueueAdapter({ token: "test-only", channelId, fetchImpl, now });
    expect((await a.observe(postId)).observation).toBe("UNKNOWN");
    expect((await a.cancel(postId, { cancelRequested: true })).observation).toBe("UNKNOWN");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("queries the official endpoint with variables and validates destination before reporting a queue", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ post }));
    const a = createBufferQueueAdapter({ token: "test-only", channelId, readVerified: true, fetchImpl, now });
    expect(await a.observe(postId)).toMatchObject({ observation: "QUEUED", dueAt: new Date(post.dueAt).toISOString(), providerQueueId: postId });
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.buffer.com"); expect(request.redirect).toBe("error");
    expect(JSON.parse(request.body).variables).toEqual({ input: { id: postId } });
    expect(JSON.parse(request.body).query).toContain("PostInput!");
    fetchImpl.mockResolvedValue(response({ post: { ...post, channelId: postId } }));
    expect((await a.observe(postId)).observation).toBe("UNKNOWN");
  });
  it.each([
    { status: "sent", sentAt: "2026-10-19T09:00:00Z", externalLink: "https://youtube.com/watch?v=test" },
    { status: "sending" }, { status: "new_future_status" }, { schedulingType: "notification" }, { notificationStatus: "markedAsPublished" },
  ])("does not manufacture public completion from %j", async change => {
    const a = createBufferQueueAdapter({ token: "test-only", channelId, readVerified: true, now, fetchImpl: vi.fn().mockResolvedValue(response({ post: { ...post, ...change } })) });
    expect((await a.observe(postId)).observation).toBe("UNKNOWN");
  });
  it("does not treat GraphQL errors, empty records, HTTP failure or transport uncertainty as confirmed absence", async () => {
    for (const reply of [new Response(JSON.stringify({ errors: [{ message: "not found" }] })), response({ post: null }), new Response("unavailable", { status: 503 })]) {
      const a = createBufferQueueAdapter({ token: "test-only", channelId, readVerified: true, now, fetchImpl: vi.fn().mockResolvedValue(reply) });
      expect((await a.observe(postId)).observation).toBe("UNKNOWN");
    }
  });
  it("requires fresh allowedActions, scheduled future state and explicit cancellation request", async () => {
    for (const change of [{ status: "sent" }, { allowedActions: [] }, { dueAt: "2026-10-19T10:01:00Z" }]) {
      const fetchImpl = vi.fn().mockResolvedValue(response({ post: { ...post, ...change } }));
      const a = createBufferQueueAdapter({ token: "test-only", channelId, readVerified: true, cancelVerified: true, fetchImpl, now });
      await a.cancel(postId); expect(fetchImpl).not.toHaveBeenCalled();
      expect((await a.cancel(postId, { cancelRequested: true })).observation).toBe("UNKNOWN");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
  it("keeps a successful delete acknowledgment uncertain rather than claiming external cancellation", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({ post })).mockResolvedValueOnce(response({ deletePost: { __typename: "DeletePostSuccess", id: postId } }));
    const a = createBufferQueueAdapter({ token: "test-only", channelId, readVerified: true, cancelVerified: true, fetchImpl, now });
    expect(await a.cancel(postId, { cancelRequested: true })).toMatchObject({ observation: "UNKNOWN", deletionAcknowledged: true, requiresHuman: true });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).query).toContain("DeletePostInput!");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("never retries an uncertain delete", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response({ post })).mockRejectedValueOnce(new Error("test transport closed"));
    const a = createBufferQueueAdapter({ token: "test-only", channelId, readVerified: true, cancelVerified: true, fetchImpl, now });
    expect(await a.cancel(postId, { cancelRequested: true })).toMatchObject({ reason: "CANCEL_OUTCOME_UNCERTAIN" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
