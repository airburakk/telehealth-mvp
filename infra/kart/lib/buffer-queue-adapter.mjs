// Official GraphQL contract: https://developers.buffer.com/reference.html
// No environment/credential reads, route, timer, enqueue or publish capability.
const ENDPOINT = "https://api.buffer.com";
const POST_QUERY = `query WeeklyQueuePost($input: PostInput!) { post(input: $input) {
  id channelId status dueAt sentAt externalLink schedulingType notificationStatus allowedActions
} }`;
const DELETE_MUTATION = `mutation WeeklyQueueDelete($input: DeletePostInput!) {
  deletePost(input: $input) { __typename ... on DeletePostSuccess { id } }
}`;
const id = value => typeof value === "string" && /^[a-f0-9]{24}$/i.test(value);
const unknown = reason => ({ observation: "UNKNOWN", reason, requiresHuman: true });
const instant = s => typeof s === "string" && Number.isFinite(Date.parse(s));

/** Account capability must be independently verified before an existing token
 * is passed in. Default-disabled even when a token exists. No automatic retry:
 * transport/error/delete uncertainty remains visible to the application ledger.
 */
export function createBufferQueueAdapter({ token, channelId, readVerified = false, cancelVerified = false, fetchImpl = fetch, now = Date.now }) {
  async function call(query, postId) {
    try {
      const r = await fetchImpl(ENDPOINT, { method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ query, variables: { input: { id: postId } } }) });
      const text = await r.text();
      if (!r.ok || text.length > 262144) return null;
      const result = JSON.parse(text);
      return result.errors?.length ? null : result.data;
    } catch { return null; }
  }
  async function readPost(postId) {
    if (!readVerified || !token || !id(channelId) || !id(postId)) return null;
    const result = await call(POST_QUERY, postId), p = result?.post;
    if (!p || p.id !== postId || p.channelId !== channelId) return null;
    return p;
  }
  return {
    async observe(postId) {
      const p = await readPost(postId);
      if (!p) return unknown("READ_DISABLED_FAILED_OR_WRONG_ACCOUNT");
      // Reminder/manual marked-as-published is not automatic public proof.
      if (p.schedulingType !== "automatic" || p.notificationStatus) return unknown("MANUAL_PUBLICATION_REQUIRES_REVIEW");
      if (p.status === "scheduled" && instant(p.dueAt) && !p.sentAt && !p.externalLink)
        return { observation: "QUEUED", providerQueueId: p.id, dueAt: new Date(p.dueAt).toISOString(), observedAt: new Date(now()).toISOString() };
      // The schema supplies externalLink/sentAt but no universal platform ID.
      // Forward a human-review candidate, NEVER infer identity from a Buffer ID
      // or automatically mark app publication from status=sent alone.
      if (p.status === "sent") return { ...unknown("PUBLICATION_EVIDENCE_REQUIRES_PLATFORM_CHECK"), providerQueueId: p.id,
        ...(typeof p.externalLink === "string" ? { candidatePublishedUrl: p.externalLink } : {}),
        ...(instant(p.sentAt) ? { candidatePublishedAt: new Date(p.sentAt).toISOString() } : {}) };
      return unknown(`REMOTE_${["draft", "error", "needs_approval", "sending"].includes(p.status) ? p.status.toUpperCase() : "UNRECOGNIZED"}`);
    },
    async cancel(postId, { cancelRequested = false } = {}) {
      if (!cancelRequested || !cancelVerified) return unknown("CANCELLATION_NOT_AUTHORIZED_OR_VERIFIED");
      const p = await readPost(postId); // fresh same-account preflight, no cached record
      if (!p || p.status !== "scheduled" || p.schedulingType !== "automatic" || p.notificationStatus || p.sentAt || p.externalLink || !instant(p.dueAt) || Date.parse(p.dueAt) <= now() + 120000 || !p.allowedActions?.includes("deletePost"))
        return unknown("REMOTE_JOB_NOT_SAFELY_DELETABLE");
      const result = await call(DELETE_MUTATION, postId);
      if (result?.deletePost?.__typename !== "DeletePostSuccess" || result.deletePost.id !== postId) return unknown("CANCEL_OUTCOME_UNCERTAIN");
      // Deletes the Buffer record. A concurrent dispatch/external platform post
      // cannot be disproved by an absent record, so don't emit CANCELLED.
      return { ...unknown("BUFFER_DELETION_ACK_REQUIRES_RECONCILIATION"), providerQueueId: postId, deletionAcknowledged: true };
    },
  };
}
