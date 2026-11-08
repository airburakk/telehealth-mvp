import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FAMILY_MEDICINE_MONITORED_SOURCES, FAMILY_MEDICINE_MAX_SOURCE_BYTES, FAMILY_MEDICINE_MAX_SOURCES,
  FAMILY_MEDICINE_HYP_MAX_SOURCE_BYTES, FAMILY_MEDICINE_FETCH_TIMEOUT_MS, familyMedicineContentHash, isAllowedFamilyMedicineRedirect,
  nextFamilyMedicineSourceState, observeFamilyMedicineSource, sourceCheckIsStale, normalizeFamilyMedicineSourceLink,
  type SourceObservation,
} from "@/lib/family-medicine-refresh";
import { FAMILY_MEDICINE_WATCH_SOURCES } from "@/lib/family-medicine-watch-sources";
import { FAMILY_MEDICINE_RESOURCES } from "@/lib/family-medicine";
import { FAMILY_MEDICINE_SOURCE_CANDIDATES } from "@/lib/family-medicine-source-candidates";
import { ASM_WORKFLOWS, REPORT_WORKFLOWS } from "@/lib/family-medicine-workflows";

const now = new Date("2026-11-08T03:10:00Z");
const dayLater = new Date("2026-11-09T03:10:00Z");
const observation = (contentHash: string | null = "hash-a", checkedAt = now, errorTag: string | null = null): SourceObservation => ({ checkedAt, contentHash, httpStatus: contentHash ? 200 : 503, errorTag });
const bytes = (text: string) => new TextEncoder().encode(text);
const html = (extra = "") => `<html><title>Public guide</title><main>${"Saglik raporlari yonetmeligi. ".repeat(12)}${extra}</main></html>`;
const source = FAMILY_MEDICINE_MONITORED_SOURCES.find(s => !s.url.endsWith(".pdf"))!;
const pdfSource = FAMILY_MEDICINE_MONITORED_SOURCES.find(s => s.url.endsWith(".pdf"))!;
const response = (body = html()) => new Response(body, { headers: { "content-type": "text/html" } });
afterEach(() => vi.useRealTimers());

describe("family medicine monitoring catalog", () => {
  it("deduplicates every directory and candidate URL and covers every workflow", () => {
    const expected = new Set([...FAMILY_MEDICINE_RESOURCES, ...FAMILY_MEDICINE_SOURCE_CANDIDATES, ...FAMILY_MEDICINE_WATCH_SOURCES].map(s => s.url));
    expect(FAMILY_MEDICINE_MONITORED_SOURCES.map(s => s.url).sort()).toEqual([...expected].sort());
    expect(FAMILY_MEDICINE_MONITORED_SOURCES.length).toBeLessThanOrEqual(FAMILY_MEDICINE_MAX_SOURCES);
    for (const workflow of [...REPORT_WORKFLOWS, ...ASM_WORKFLOWS]) expect(FAMILY_MEDICINE_MONITORED_SOURCES.some(s => s.workflowIds.includes(workflow.id))).toBe(true);
    for (const s of FAMILY_MEDICINE_MONITORED_SOURCES) expect(isAllowedFamilyMedicineRedirect(s.url)).toBe(true);
  });
  it("allows trusted HTTPS hosts only, never credentials, non-default ports, or lookalike hosts", () => {
    for (const url of ["http://hsgm.saglik.gov.tr/", "https://localhost/", "https://127.0.0.1/", "https://169.254.169.254/", "file:///etc/passwd", "https://hsgm.saglik.gov.tr.evil.invalid/", "https://user:secret@hsgm.saglik.gov.tr/", "https://hsgm.saglik.gov.tr:8443/"]) expect(isAllowedFamilyMedicineRedirect(url)).toBe(false);
  });
});
describe("technical state is separate from clinical approval", () => {
  it("first success establishes an unreviewed baseline; unchanged second success is only technical", () => {
    const initial = nextFamilyMedicineSourceState(null, observation());
    expect(initial).toMatchObject({ status: "baseline", baselineHash: "hash-a", contentHash: "hash-a", consecutiveFailures: 0 });
    const next = nextFamilyMedicineSourceState(initial, observation("hash-a", dayLater));
    expect(next).toMatchObject({ status: "current", changedAt: null, lastSuccessAt: dayLater });
    expect(next).not.toHaveProperty("clinicalAt");
    expect(next).not.toHaveProperty("legalAt");
  });
  it("retains change detection on repeated reads and even a return to the initial bytes", () => {
    const first = nextFamilyMedicineSourceState(null, observation());
    const changed = nextFamilyMedicineSourceState(first, observation("hash-b", dayLater));
    expect(changed).toMatchObject({ status: "changed", baselineHash: "hash-a", contentHash: "hash-b", changedAt: dayLater });
    expect(nextFamilyMedicineSourceState(changed, observation("hash-b", dayLater)).status).toBe("changed");
    expect(nextFamilyMedicineSourceState(changed, observation("hash-a", dayLater)).status).toBe("changed");
    const later = new Date(dayLater.getTime() + 3_600_000);
    expect(nextFamilyMedicineSourceState(changed, observation("hash-c", later))).toMatchObject({ status: "changed", changedAt: later, contentHash: "hash-c" });
  });
  it("failed fetch never replaces a good hash or implies freshness, recovery keeps change history", () => {
    const first = nextFamilyMedicineSourceState(null, observation());
    const changed = nextFamilyMedicineSourceState(first, observation("hash-b", dayLater));
    const failed = nextFamilyMedicineSourceState(changed, observation(null, dayLater, "http-403"));
    expect(failed).toMatchObject({ status: "unreachable", contentHash: "hash-b", baselineHash: "hash-a", consecutiveFailures: 1, lastSuccessAt: dayLater, changedAt: dayLater });
    expect(nextFamilyMedicineSourceState(failed, observation("hash-b", dayLater))).toMatchObject({ status: "changed", consecutiveFailures: 0, errorTag: null });
  });
  it("ignores out-of-order observations and marks unchecked/future/older-than72h evidence stale", () => {
    const initial = nextFamilyMedicineSourceState(null, observation("hash-b", dayLater));
    expect(nextFamilyMedicineSourceState(initial, observation())).toBe(initial);
    expect(sourceCheckIsStale(null, now)).toBe(true);
    expect(sourceCheckIsStale(dayLater, now)).toBe(true);
    expect(sourceCheckIsStale(new Date(now.getTime() - 72 * 3_600_000), now)).toBe(false);
    expect(sourceCheckIsStale(new Date(now.getTime() - 72 * 3_600_000 - 1), now)).toBe(true);
  });
});
describe("bounded source hashing", () => {
  it("ignores script/style/whitespace churn but detects visible text and attachment changes", () => {
    const a = familyMedicineContentHash(bytes(html("<script>token1</script>")), "text/html", false);
    expect(familyMedicineContentHash(bytes(html("<script>token2</script><style>h1{color:red}</style>  \n")), "text/html", false)).toBe(a);
    expect(familyMedicineContentHash(bytes(html("changed regulation")), "text/html", false)).not.toBe(a);
    expect(familyMedicineContentHash(bytes(html('<a href="v1.pdf">Guide</a>')), "text/html", false)).not.toBe(familyMedicineContentHash(bytes(html('<a href="v2.pdf">Guide</a>')), "text/html", false));
  });
  it("decodes historical Windows1254 gazette HTML before hashing", () => {
    const legacy = Buffer.from('<meta charset="Windows-1254">' + html("Sa\u00f0l\u00fdk raporlar\u00fd"), "latin1");
    const modern = bytes('<meta charset="utf-8">' + html("Sağlık raporları"));
    expect(familyMedicineContentHash(legacy, "text/html", false)).toBe(familyMedicineContentHash(modern, "text/html", false));
  });
  it("hashes full PDF bytes and rejects HTML masquerading as PDF", () => {
    expect(familyMedicineContentHash(bytes("%PDF-1.7" + "A".repeat(200)), "application/pdf", true)).not.toBe(familyMedicineContentHash(bytes("%PDF-1.7" + "B".repeat(200)), "application/pdf", true));
    expect(() => familyMedicineContentHash(bytes(html()), "text/html", true)).toThrow("invalid-pdf");
  });
  it("does not accept login, CAPTCHA, empty, wrong MIME, or oversized pages as success", () => {
    expect(() => familyMedicineContentHash(bytes(""), "text/html", false)).toThrow("empty-body");
    expect(() => familyMedicineContentHash(bytes(html().replace("Public guide", "Access denied")), "text/html", false)).toThrow("blocked-or-login-page");
    expect(() => familyMedicineContentHash(bytes(html('<input type="password">')), "text/html", false)).toThrow("blocked-or-login-page");
    expect(() => familyMedicineContentHash(bytes("short"), "text/plain", false)).toThrow("empty-or-short-page");
    expect(() => familyMedicineContentHash(bytes(html()), "application/json", false)).toThrow("unsupported-content-type");
    expect(() => familyMedicineContentHash(new Uint8Array(FAMILY_MEDICINE_MAX_SOURCE_BYTES + 1), "text/html", false)).toThrow("body-too-large");
  });
});
describe("TAHUD guide signed-link stability", () => {
  const guide = "https://tahud.org.tr/kitap/tani-ve-tedavi-rehberi-2026";
  const host = "fls-a0a0308e-a96c-4ec8-9dd4-74ff94fc9977.367be3a2035528943240074d0096e0cd.r2.cloudflarestorage.com";
  const signed = (signature: string, path = "guide-2026.pdf", extra = "") =>
    `https://${host}/books/attachments/${path}?X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&amp;X-Amz-Algorithm=AWS4-HMAC-SHA256&amp;X-Amz-Credential=fixture&amp;X-Amz-Date=${signature === "a" ? "20261108T210000Z" : "20261108T210001Z"}&amp;X-Amz-SignedHeaders=host&amp;X-Amz-Expires=300&amp;X-Amz-Signature=${signature.repeat(64)}${extra}`;
  const hash = (link: string, source = guide, text = "Guide") => familyMedicineContentHash(bytes(html(`<a href="${link}">${text}</a>`)), "text/html", false, FAMILY_MEDICINE_MAX_SOURCE_BYTES, source);
  it("ignores only known ephemeral authentication parameters on the exact observed source and host", () => {
    expect(normalizeFamilyMedicineSourceLink(guide, signed("a"))).toBe(`https://${host}/books/attachments/guide-2026.pdf`);
    expect(hash(signed("a"))).toBe(hash(signed("b")));
    expect(isAllowedFamilyMedicineRedirect(`https://${host}/books/attachments/guide-2026.pdf`)).toBe(false);
  });
  it("still detects changed document paths, versions, other query values, fragments and visible content", () => {
    const baseline = hash(signed("a"));
    expect(hash(signed("a", "guide-2027.pdf"))).not.toBe(baseline);
    expect(hash(signed("a", undefined, "&amp;versionId=v2"))).not.toBe(hash(signed("b", undefined, "&amp;versionId=v1")));
    expect(hash(signed("a", undefined, "&amp;revision=2"))).not.toBe(hash(signed("b", undefined, "&amp;revision=1")));
    expect(hash(signed("a") + "#page=2")).not.toBe(baseline);
    expect(hash(signed("a"), guide, "Updated guide")).not.toBe(baseline);
  });
  it("does not normalize other pages, hosts, paths, credentials or unsigned links", () => {
    expect(hash(signed("a"), "https://tahud.org.tr/haberler")).not.toBe(hash(signed("b"), "https://tahud.org.tr/haberler"));
    for (const link of [signed("a").replace(host, "other.r2.cloudflarestorage.com"), signed("a").replace("/books/attachments/", "/private/"),
      signed("a").replace("https://", "https://user:pass@"), signed("a").replace("AWS4-HMAC-SHA256", "other"), signed("a").replace("X-Amz-Signature", "documentVersion")]) {
      expect(normalizeFamilyMedicineSourceLink(guide, link)).toBe(link);
    }
  });
});

describe("curated fetch boundary", () => {
  it("does not fetch a caller-supplied URL or unknown source key", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(observeFamilyMedicineSource("https://127.0.0.1/", fetcher)).rejects.toThrow("Unknown curated");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses no-store, manual redirects, omitted credentials, and returns a digest only", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response());
    const result = await observeFamilyMedicineSource(source.sourceKey, fetcher, now);
    expect(result).toMatchObject({ errorTag: null, httpStatus: 200, checkedAt: now });
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(fetcher).toHaveBeenCalledWith(source.url, expect.objectContaining({ cache: "no-store", redirect: "manual", credentials: "omit" }));
    expect(result).not.toHaveProperty("body");
  });
  it("blocks redirects to private or unlisted hosts before a second fetch", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }));
    expect(await observeFamilyMedicineSource(source.sourceKey, fetcher, now)).toMatchObject({ contentHash: null, errorTag: "disallowed-destination" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a generic200 page unrelated to the intended official source", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(`<html><title>Welcome</title>${"Generic homepage. ".repeat(30)}</html>`));
    expect(await observeFamilyMedicineSource(source.sourceKey, fetcher, now)).toMatchObject({ errorTag: "unexpected-page-content", contentHash: null });
  });
  it("bounds trusted redirects", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 302, headers: { location: source.url } }));
    expect(await observeFamilyMedicineSource(source.sourceKey, fetcher, now)).toMatchObject({ errorTag: "too-many-redirects" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("isolates remote errors and rejects non200/oversized or misleading PDF responses", async () => {
    expect(await observeFamilyMedicineSource(source.sourceKey, vi.fn<typeof fetch>().mockRejectedValue(new Error("secret bearer token")), now)).toMatchObject({ errorTag: "network-error" });
    expect(await observeFamilyMedicineSource(source.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 403 })), now)).toMatchObject({ errorTag: "http-403" });
    expect(await observeFamilyMedicineSource(source.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(new Response("", { headers: { "content-length": String(FAMILY_MEDICINE_MAX_SOURCE_BYTES + 1) } })), now)).toMatchObject({ errorTag: "body-too-large" });
    expect(await observeFamilyMedicineSource(pdfSource.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(response()), now)).toMatchObject({ errorTag: "invalid-pdf" });
  });
  it("limits bytes during streaming even without Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(FAMILY_MEDICINE_MAX_SOURCE_BYTES + 1)); } });
    expect(await observeFamilyMedicineSource(source.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { "content-type": "text/html" } })), now)).toMatchObject({ errorTag: "body-too-large" });
  });
  it("monitors embedded official legislation changes and keeps parser failures distinct from network errors", async () => {
    const target = FAMILY_MEDICINE_MONITORED_SOURCES.find(s => s.resourceIds.includes("hsgm-family-legislation"))!;
    const page = (title: string) => html(`<script>const publications = ${JSON.stringify([{ id: 1, title, category: "Yönetmelik", url: "https://hsgm.saglik.gov.tr/depo/kural.pdf", created: "2026-11-08", tags: [] }])};</script>`);
    const first = await observeFamilyMedicineSource(target.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(response(page("Aile Hekimliği Yönetmeliği"))), now);
    const changed = await observeFamilyMedicineSource(target.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(response(page("Aile Hekimliği Yeni Yönetmeliği"))), now);
    expect(first.errorTag).toBeNull();
    expect(changed.errorTag).toBeNull();
    expect(first.contentHash).not.toBe(changed.contentHash);
    expect(await observeFamilyMedicineSource(target.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(response(html())), now)).toMatchObject({ contentHash: null, errorTag: "family-medicine-watch-missing-catalog" });
    expect(await observeFamilyMedicineSource(target.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(new Response(page("Aile Hekimliği"), { headers: { "content-type": "application/pdf" } })), now)).toMatchObject({ contentHash: null, errorTag: "unsupported-content-type" });
    expect(await observeFamilyMedicineSource(target.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(response(page("Aile Hekimliği").replace("Public guide", "Access denied"))), now)).toMatchObject({ errorTag: "blocked-or-login-page" });
  });
  it("allows the larger official HYP PDF only within its 12 MiB cap", async () => {
    const body = new Uint8Array(FAMILY_MEDICINE_MAX_SOURCE_BYTES + 1);
    body.set(bytes("%PDF-1.7"));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { headers: { "content-type": "application/pdf" } }));
    const result = await observeFamilyMedicineSource(pdfSource.sourceKey, fetcher, now);
    expect(pdfSource.resourceIds).toContain("hyp");
    expect(result.errorTag).toBeNull();
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    const oversized = new Response("", { headers: { "content-length": String(FAMILY_MEDICINE_HYP_MAX_SOURCE_BYTES + 1) } });
    expect(await observeFamilyMedicineSource(pdfSource.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(oversized), now)).toMatchObject({ errorTag: "body-too-large" });
    const otherPdf = FAMILY_MEDICINE_MONITORED_SOURCES.find(s => s.url.endsWith(".pdf") && !s.resourceIds.includes("hyp"))!;
    const otherResponse = new Response(body, { headers: { "content-type": "application/pdf" } });
    expect(await observeFamilyMedicineSource(otherPdf.sourceKey, vi.fn<typeof fetch>().mockResolvedValue(otherResponse), now)).toMatchObject({ errorTag: "body-too-large" });
  });
  it("aborts a stalled request within the per-source budget", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("aborted")))));
    const result = observeFamilyMedicineSource(source.sourceKey, fetcher, now);
    await vi.advanceTimersByTimeAsync(FAMILY_MEDICINE_FETCH_TIMEOUT_MS);
    expect(await result).toMatchObject({ errorTag: "timeout" });
  });
});