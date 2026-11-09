import { createHash } from "node:crypto";
import { readPrimaryPage } from "./social-calendar/primary-page";

export const STUDENT_EVENT_INDEX = "https://sks.ogu.edu.tr/Etkinlik/Index";
export interface StudentClubEvent {
  id: string; title: string; organizer: string; venue: string; city: string;
  startDay: string; endDay: string; sourceUrl: string; checkedAt: string; evidenceHash: string;
  status: "candidate";
}
const months = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
const entities: Record<string, string> = { ccedil: "ç", Ccedil: "Ç", uuml: "ü", Uuml: "Ü", ouml: "ö", Ouml: "Ö", nbsp: " ", amp: "&", quot: '"', apos: "'" };
export function eventText(html: string): string {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
      const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    }).replace(/&([a-z]+);/gi, (raw, key: string) => entities[key] ?? raw).replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
function day(text: string): string | null {
  const m = /^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = months.indexOf(m[2].toLocaleLowerCase("tr")) + 1;
  if (!month) return null;
  const iso = `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}
export function studentEventUrl(raw: string): string | null {
  try {
    const u = new URL(raw, STUDENT_EVENT_INDEX);
    if (u.origin !== "https://sks.ogu.edu.tr" || u.username || u.password || !/^\/Etkinlik\/Detay\/\d+\/[a-z0-9-]+$/.test(u.pathname)) return null;
    return u.origin + u.pathname;
  } catch { return null; }
}
export function discoverStudentEventUrls(html: string): string[] {
  return [...new Set([...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m => studentEventUrl(m[1])).filter((u): u is string => Boolean(u)))];
}
export function parseStudentClubEvent(html: string, sourceUrl: string, now = new Date()): StudentClubEvent | null {
  const url = studentEventUrl(sourceUrl);
  if (!url) return null;
  const heading = [...html.matchAll(/<(?:title|h1|h2)\b[^>]*>([\s\S]*?)<\/(?:title|h1|h2)>/gi)].map(m => eventText(m[1])).join(" ").toLocaleLowerCase("tr");
  if (/iptal|ertelen|cancelled|postponed/.test(heading)) return null;
  const text = eventText(html);
  // Restrict extraction to the actual event, excluding menu/footer recommendations.
  const block = text.match(/Etkinliği Düzenleyen\s*:\s*([\s\S]*?)Son Güncelleme Tarihi:/i)?.[1];
  if (!block || /iptal|ertelen|cancelled|postponed/.test(block.toLocaleLowerCase("tr"))) return null;
  const fields = /^(.+?)\s+Başlangıç-Bitiş Tarihi:\s*(.+?)\s+Etkinlik Adı:\s*(.+?)\s+Tür\s*:\s*(.+?)\s+Yer:\s*(.+)$/i.exec(block.trim());
  if (!fields) return null;
  const [, organizer, dates, title, , venue] = fields;
  if (!/tıp/i.test(organizer) || !/öğrenci/i.test(organizer) || !/kulüb|birliği/i.test(organizer)) return null;
  // Unknown/multi-day formats deliberately remain unpublished until a tested adapter exists.
  const startDay = day(dates);
  if (!startDay || title.length < 4 || title.length > 240 || venue.length < 4 || venue.length > 300) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if (startDay < today) return null;
  return { id: createHash("sha256").update(url).digest("hex"), title: title.trim(), organizer: organizer.trim(), venue: venue.trim(), city: "Eskişehir", startDay, endDay: startDay,
    sourceUrl: url, checkedAt: now.toISOString(), evidenceHash: createHash("sha256").update(block).digest("hex"), status: "candidate" };
}
export function studentEventIdentity(event: Pick<StudentClubEvent, "organizer" | "title" | "startDay" | "venue">): string {
  return `${event.organizer}|${event.title}|${event.startDay}|${event.venue}`.normalize("NFKC").toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}|]/gu, "");
}
export async function scanStudentClubEvents(now = new Date(), readPage = readPrimaryPage, previousUrls: string[] = []) {
  const result = { checkedAt: now.toISOString(), candidates: [] as StudentClubEvent[], checked: 0, rejected: 0, errors: [] as string[], complete: true, rejectedUrls: [] as string[], failedUrls: [] as string[] };
  let urls: string[];
  try { urls = [...new Set([...previousUrls.map(studentEventUrl).filter((u): u is string => Boolean(u)), ...discoverStudentEventUrls(await readPage(STUDENT_EVENT_INDEX))])]; }
  catch { return { ...result, complete: false, errors: ["student-index-unavailable"] }; }
  if (!urls.length) return { ...result, complete: false, errors: ["student-index-empty-or-changed"] };
  if (urls.length > 20) { result.complete = false; result.errors.push("student-scan-limit"); }
  const seen = new Set<string>();
  for (const url of urls.slice(0, 20)) {
    result.checked++;
    try {
      const event = parseStudentClubEvent(await readPage(url), url, now);
      if (!event) { result.rejected++; result.rejectedUrls.push(url); continue; }
      const key = studentEventIdentity(event);
      if (!seen.has(key)) { seen.add(key); result.candidates.push(event); }
    } catch { result.complete = false; result.errors.push("student-detail-unavailable"); result.failedUrls.push(url); }
  }
  result.candidates.sort((a, b) => a.startDay.localeCompare(b.startDay) || a.id.localeCompare(b.id));
  return result;
}
