/** Pure state decisions, no provider API, credentials, DB or network calls. */
export const QUEUE_RISK_STATES = ["CANCEL_PENDING", "CANCEL_UNKNOWN", "PUBLISHED_RISK"] as const;
export function stateAfterRevoke(state: string): string {
  if (state === "PENDING") return "CANCELLED";
  if (state === "QUEUED") return "CANCEL_PENDING";
  if (["CLAIMED", "UNKNOWN", "PUBLICATION_UNKNOWN"].includes(state)) return "CANCEL_UNKNOWN";
  return state;
}
export function queueAcceptedState(approved: boolean, expectedDue: string, actualDue: string) {
  return approved && expectedDue === actualDue ? "QUEUED" : "CANCEL_PENDING";
}
export function publicationState(approved: boolean, previous: string) {
  return approved && !["PENDING", "CANCEL_PENDING", "CANCEL_UNKNOWN", "CANCELLED", "PUBLISHED_RISK"].includes(previous) ? "SUCCEEDED" : "PUBLISHED_RISK";
}
export function effectiveQueueState(state: string, claimedAt: Date | null, due: Date, now: Date) {
  if (state === "CLAIMED" && claimedAt && now.getTime() - claimedAt.getTime() > 1200000) return "UNKNOWN";
  if (state === "QUEUED" && now.getTime() > due.getTime() + 1200000) return "PUBLICATION_UNKNOWN";
  return state;
}
export function remoteRisk(state: string, packageApproved: boolean, providerQueueId: string | null, attempt: number) {
  return QUEUE_RISK_STATES.includes(state as typeof QUEUE_RISK_STATES[number]) ||
    (!packageApproved && attempt > 0 && !["CANCELLED", "SUCCEEDED"].includes(state)) ||
    (Boolean(providerQueueId) && ["UNKNOWN", "PUBLICATION_UNKNOWN"].includes(state));
}

/** An opaque Buffer queue ID is never publication evidence. The authenticated
 * observer must supply a public platform URL/ID and an actual publication time.
 * Shape validation does not claim that a provider read API has been verified.
 */
export function publicationEvidence(channel: string, platformId: string, url: string, publishedAt: string, now: Date) {
  if (!platformId || platformId.length > 300 || /[\u0000-\u001f]/.test(platformId)) throw new Error("Platform yayın kimliği gerekli.");
  let u: URL;
  try { u = new URL(url); } catch { throw new Error("Kamuya açık platform yayın bağlantısı gerekli."); }
  const hosts: Record<string, string[]> = { youtube: ["youtube.com", "www.youtube.com", "youtu.be"], x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    facebook: ["facebook.com", "www.facebook.com"], instagram: ["instagram.com", "www.instagram.com"], linkedin: ["linkedin.com", "www.linkedin.com"] };
  if (u.protocol !== "https:" || u.username || u.password || !hosts[channel]?.includes(u.hostname) || u.pathname === "/" || url.length > 1000) throw new Error("Yayın bağlantısı ilgili kamuya açık platforma ait olmalı.");
  if (channel === "youtube") {
    const videoId = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : u.pathname === "/watch" ? u.searchParams.get("v") : null;
    if (videoId !== platformId) throw new Error("YouTube yayın kimliği bağlantıyla eşleşmiyor.");
  }
  const date = new Date(publishedAt);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(publishedAt) || !Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + 300000) throw new Error("Gelecekteki plan saati yayın teyidi değildir.");
  return { platformId, publishedUrl: u.href, remotePublishedAt: date };
}
