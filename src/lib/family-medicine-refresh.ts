import { createHash } from "node:crypto";
import { FAMILY_MEDICINE_RESOURCES } from "./family-medicine";
import { FAMILY_MEDICINE_SOURCE_CANDIDATES } from "./family-medicine-source-candidates";
import { ASM_WORKFLOWS, REPORT_WORKFLOWS } from "./family-medicine-workflows";
import { FAMILY_MEDICINE_WATCH_SOURCES, prepareFamilyMedicineWatchHtml } from "./family-medicine-watch-sources";

/** Technical change detection only: no medical/legal validation, source text storage, or publication. */
export const FAMILY_MEDICINE_REFRESH_RESOURCE = "refresh-family-medicine";
export const FAMILY_MEDICINE_STALE_HOURS = 72;
export const FAMILY_MEDICINE_FETCH_TIMEOUT_MS = 12_000;
export const FAMILY_MEDICINE_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
// Official May 2026 HYP revision is 9,256,227 bytes (220 pages); other sources keep 8 MiB.
export const FAMILY_MEDICINE_HYP_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const FAMILY_MEDICINE_MAX_SOURCES = 20;
export const FAMILY_MEDICINE_SOURCE_GAP_MS = 250;
export type SourceStatus = "baseline" | "current" | "changed" | "unreachable";
export interface MonitoredFamilyMedicineSource {
  sourceKey: string; url: string; title: string; resourceIds: string[]; workflowIds: string[];
}
const workflows = [...REPORT_WORKFLOWS, ...ASM_WORKFLOWS];
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const manifest = new Map<string, MonitoredFamilyMedicineSource>();
for (const resource of FAMILY_MEDICINE_RESOURCES) {
  manifest.set(resource.url, {
    sourceKey: sha256(resource.url), url: resource.url, title: resource.title, resourceIds: [resource.id],
    workflowIds: workflows.filter(w => w.sourceIds.includes(resource.id)).map(w => w.id),
  });
}
for (const candidate of FAMILY_MEDICINE_SOURCE_CANDIDATES) {
  const source = manifest.get(candidate.url) ?? {
    sourceKey: sha256(candidate.url), url: candidate.url, title: candidate.version, resourceIds: [], workflowIds: [],
  };
  if (!source.workflowIds.includes(candidate.workflowId)) source.workflowIds.push(candidate.workflowId);
  manifest.set(candidate.url, source);
}
for (const source of FAMILY_MEDICINE_WATCH_SOURCES) {
  manifest.set(source.url, {
    sourceKey: sha256(source.url), url: source.url, title: source.title,
    resourceIds: [source.id], workflowIds: [],
  });
}
/** Only code-reviewed public source URLs. Editorial/user-submitted URLs are NEVER fetched. */
export const FAMILY_MEDICINE_MONITORED_SOURCES: readonly MonitoredFamilyMedicineSource[] = [...manifest.values()];
const expectedPageTerms: Record<string, readonly string[]> = {
  ...Object.fromEntries(FAMILY_MEDICINE_WATCH_SOURCES.map(s => [s.id, s.expectedTerms])),
  "report-regulation": ["saglik", "rapor"], "report-repeal": ["rapor", "yonerge"],
  "asm-forms": ["aile", "hekimligi"], "tahud": ["tani", "tedavi"],
  "hyp-versions": ["hastalik", "yonetim", "kilavuz"],
  "asm": ["asm", "ahb"], "regulation": ["aile", "hekimligi"],
};
const plainLatin = (value: string) => value.toLowerCase().replace(/ı/g, "i").normalize("NFKD").replace(/\p{M}/gu, "");
const allowedHosts = new Set(FAMILY_MEDICINE_MONITORED_SOURCES.map(s => new URL(s.url).hostname));
export function isAllowedFamilyMedicineRedirect(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && allowedHosts.has(url.hostname);
  } catch { return false; }
}
export interface SourceObservation {
  checkedAt: Date; contentHash: string | null; httpStatus: number | null; errorTag: string | null;
}
export interface SourceCheckState {
  status: SourceStatus; baselineHash: string | null; contentHash: string | null;
  checkedAt: Date; lastSuccessAt: Date | null; changedAt: Date | null;
  consecutiveFailures: number; errorTag: string | null; httpStatus: number | null;
}
export function sourceCheckIsStale(lastSuccessAt: Date | null, now: Date): boolean {
  return !lastSuccessAt || !Number.isFinite(lastSuccessAt.getTime()) || lastSuccessAt > now ||
    now.getTime() - lastSuccessAt.getTime() > FAMILY_MEDICINE_STALE_HOURS * 3_600_000;
}
/** Never replace a good hash with an error page or automatically clear a detected change. */
export function nextFamilyMedicineSourceState(previous: SourceCheckState | null, observed: SourceObservation): SourceCheckState {
  if (previous && previous.checkedAt > observed.checkedAt) return previous;
  if (!observed.contentHash || observed.errorTag) return {
    ...observed, status: "unreachable", baselineHash: previous?.baselineHash ?? null,
    contentHash: previous?.contentHash ?? null, lastSuccessAt: previous?.lastSuccessAt ?? null,
    changedAt: previous?.changedAt ?? null, consecutiveFailures: Math.min((previous?.consecutiveFailures ?? 0) + 1, 2_147_483_647),
  };
  const baselineHash = previous?.baselineHash ?? observed.contentHash;
  const contentChanged = !!previous?.contentHash && previous.contentHash !== observed.contentHash;
  const changedAt = contentChanged ? observed.checkedAt : previous?.changedAt ?? null;
  return {
    ...observed, baselineHash, changedAt, lastSuccessAt: observed.checkedAt, consecutiveFailures: 0,
    status: changedAt ? "changed" : previous?.baselineHash ? "current" : "baseline",
  };
}
class SourceFetchError extends Error {}

function decodeSourceText(bytes: Uint8Array, contentType: string): string {
  // Official historical gazette pages still declare Windows-1254 in a meta tag.
  const prefix = new TextDecoder("windows-1252").decode(bytes.slice(0, 4096));
  const charset = (contentType.match(/\bcharset\s*=\s*["']?([^\s"'>;]+)/i)?.[1] ??
    prefix.match(/<meta\b[^>]*\bcharset\s*=\s*["']?([^\s"'>;]+)/i)?.[1] ?? "utf-8").toLowerCase();
  if (!["utf-8", "utf8", "us-ascii", "windows-1254", "iso-8859-9", "windows-1252", "iso-8859-1"].includes(charset)) throw new SourceFetchError("unsupported-charset");
  return new TextDecoder(charset).decode(bytes);
}

const TAHUD_GUIDE_URL = "https://tahud.org.tr/kitap/tani-ve-tedavi-rehberi-2026";
const TAHUD_GUIDE_DOWNLOAD_HOST = "fls-a0a0308e-a96c-4ec8-9dd4-74ff94fc9977.367be3a2035528943240074d0096e0cd.r2.cloudflarestorage.com";
const SIGNED_DOWNLOAD_AUTH_PARAMS = [
  "X-Amz-Content-Sha256", "X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date",
  "X-Amz-SignedHeaders", "X-Amz-Expires", "X-Amz-Signature",
] as const;
/** Only the observed guide attachment rotates its signed URL on each request.
 * Keep its document path, fragment and every non-auth query parameter. Never fetch it,
 * expand the fetch allowlist, or store/log signed URL values. Other sources stay unchanged. */
export function normalizeFamilyMedicineSourceLink(sourceUrl: string | undefined, link: string): string {
  if (sourceUrl !== TAHUD_GUIDE_URL) return link;
  try {
    const url = new URL(link.replace(/&amp;/gi, "&"));
    if (url.protocol !== "https:" || url.hostname !== TAHUD_GUIDE_DOWNLOAD_HOST || url.username || url.password || url.port ||
      !/^\/books\/attachments\/[^/]+\.pdf$/i.test(url.pathname) ||
      url.searchParams.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" ||
      !/^[a-f0-9]{64}$/i.test(url.searchParams.get("X-Amz-Signature") ?? "")) return link;
    for (const name of SIGNED_DOWNLOAD_AUTH_PARAMS) url.searchParams.delete(name);
    return url.href;
  } catch { return link; }
}

/** Stable visible HTML reduces script/token/whitespace noise; PDF bytes are hashed in full. */
export function familyMedicineContentHash(bytes: Uint8Array, contentType: string, expectPdf: boolean, maxBytes = FAMILY_MEDICINE_MAX_SOURCE_BYTES, sourceUrl?: string): string {
  if (bytes.length === 0) throw new SourceFetchError("empty-body");
  if (bytes.length > Math.min(maxBytes, FAMILY_MEDICINE_HYP_MAX_SOURCE_BYTES)) throw new SourceFetchError("body-too-large");
  if (expectPdf || contentType.includes("application/pdf")) {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-" || bytes.length < 100) throw new SourceFetchError("invalid-pdf");
    return sha256(bytes);
  }
  if (!/text\/(html|plain)|application\/xhtml\+xml/i.test(contentType)) throw new SourceFetchError("unsupported-content-type");
  const text = decodeSourceText(bytes, contentType);
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  if (/access denied|forbidden|captcha|just a moment|not found|404|verify (you are|your identity)|giri[sş]|sign in|log in/i.test(title) ||
      /cf-chl-|g-recaptcha|hcaptcha|<input[^>]*type=["']password/i.test(text)) throw new SourceFetchError("blocked-or-login-page");
  const normalized = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length < 80) throw new SourceFetchError("empty-or-short-page");
  // A replaced attachment URL matters even when the visible link text is unchanged.
  const links = [...text.matchAll(/<(?:a|iframe)\b[^>]*?\b(?:href|src)=["']([^"']+)["']/gi)].map(m => normalizeFamilyMedicineSourceLink(sourceUrl, m[1])).sort();
  return sha256(JSON.stringify({ text: normalized, links }));
}

/** Fetch is keyed by the fixed catalog, not by a URL argument. Redirects stay on trusted public hosts. */
export async function observeFamilyMedicineSource(
  sourceKey: string,
  fetcher: typeof fetch = fetch,
  checkedAt = new Date(),
): Promise<SourceObservation> {
  const source = FAMILY_MEDICINE_MONITORED_SOURCES.find(s => s.sourceKey === sourceKey);
  if (!source) throw new Error("Unknown curated family-medicine source");
  const maxBytes = source.resourceIds.includes("hyp") ? FAMILY_MEDICINE_HYP_MAX_SOURCE_BYTES : FAMILY_MEDICINE_MAX_SOURCE_BYTES;
  let httpStatus: number | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FAMILY_MEDICINE_FETCH_TIMEOUT_MS);
  try {
    let url = source.url;
    for (let redirects = 0; redirects <= 2; redirects++) {
      if (!isAllowedFamilyMedicineRedirect(url)) throw new SourceFetchError("disallowed-destination");
      const response = await fetcher(url, {
        method: "GET", cache: "no-store", redirect: "manual", credentials: "omit", signal: controller.signal,
        headers: { Accept: "text/html,application/pdf,text/plain;q=0.8", "User-Agent": "Doctorium-Source-Monitor/1.0" },
      });
      httpStatus = response.status;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (redirects === 2) throw new SourceFetchError("too-many-redirects");
        const location = response.headers.get("location");
        if (!location) throw new SourceFetchError("redirect-without-location");
        url = new URL(location, url).href;
        continue;
      }
      if (response.status !== 200) { await response.body?.cancel(); throw new SourceFetchError(`http-${response.status}`); }
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > maxBytes) {
        await response.body?.cancel(); throw new SourceFetchError("body-too-large");
      }
      if (!response.body) throw new SourceFetchError("empty-body");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { await reader.cancel(); throw new SourceFetchError("body-too-large"); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const expectPdf = /\.pdf$/i.test(new URL(source.url).pathname);
      let hashBytes = bytes;
      let hashContentType = response.headers.get("content-type") ?? "";
      const watch = FAMILY_MEDICINE_WATCH_SOURCES.find(s => s.url === source.url);
      if (watch) {
        // Publisher index adapters receive validated HTML only, never PDF/JSON/login pages.
        if (!/^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i.test(hashContentType)) throw new SourceFetchError("unsupported-content-type");
        familyMedicineContentHash(bytes, hashContentType, false, maxBytes);
        try {
          hashBytes = new TextEncoder().encode(prepareFamilyMedicineWatchHtml(source.url, decodeSourceText(bytes, hashContentType)));
        } catch (error) {
          const tag = error instanceof Error && /^family-medicine-watch-[a-z-]{1,60}$/.test(error.message)
            ? error.message : "family-medicine-watch-contract-error";
          throw new SourceFetchError(tag);
        }
        hashContentType = "text/html; charset=utf-8";
      }
      const contentHash = familyMedicineContentHash(hashBytes, hashContentType, expectPdf, maxBytes, source.url);
      if (!expectPdf) {
        if (new URL(url).pathname === "/" && new URL(source.url).pathname !== "/") throw new SourceFetchError("unexpected-homepage");
        const page = plainLatin(decodeSourceText(hashBytes, hashContentType).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "));
        const terms = source.resourceIds.flatMap(id => expectedPageTerms[id] ?? []);
        if (!terms.every(term => page.includes(term))) throw new SourceFetchError("unexpected-page-content");
      }
      return { checkedAt, contentHash, httpStatus, errorTag: null };
    }
    throw new SourceFetchError("too-many-redirects");
  } catch (error) {
    // Fixed codes only: arbitrary remote response/error text never enters audit or the database.
    return { checkedAt, contentHash: null, httpStatus, errorTag: error instanceof SourceFetchError ? error.message : controller.signal.aborted ? "timeout" : "network-error" };
  } finally { clearTimeout(timeout); }
}