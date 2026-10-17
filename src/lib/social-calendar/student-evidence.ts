// Explicit adapter: TÜBİTAK 2209-A official TR program page + its same-year call PDF.
// No generic scholarship scraping, stale DB deadline/eligibility reuse, or inferred clock times.
import { createHash } from "node:crypto";
import { formatIsoDayTr } from "../iso-day";
import type { PlanPayload } from "./payload";
import { isDayString } from "./series";

export const TUBITAK_2209A_URL = "https://tubitak.gov.tr/tr/burslar/lisans-onlisans/destek-programlari/2209-universite-ogrencileri-arastirma-projeleri-destekleme-programi";
const LEGACY_URL = "https://tubitak.gov.tr/en/scholarships/degree-associate-degree/destek-programlari/2209-research-project-support-programme-undergraduate-students";
export const sourceDigest = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
const text = (s: string) => s.normalize("NFKC").toLocaleLowerCase("tr-TR")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

export function supportsStudentSource(row: { title: string; sourceUrl: string }): boolean {
  try {
    const u = new URL(row.sourceUrl); u.hash = "";
    return /2209\s*-\s*a/i.test(row.title) && [TUBITAK_2209A_URL, LEGACY_URL].includes(u.toString().replace(/\/$/, ""));
  } catch { return false; }
}

export interface StudentCall {
  year: string; callKey: string; deadlineAt: string; pdfUrl: string;
}
export type StudentCheck<T> = { ok: true; value: T } | { ok: false; reason: string };

export function readStudentCall(html: string, slotDay: string, now: Date): StudentCheck<StudentCall> {
  const t = text(html);
  if (/başvurular[\s\S]{0,60}(?:durdurul|iptal edil)|çağrı[\s\S]{0,30}(?:iptal edil|ertelen)/u.test(t)) return { ok: false, reason: "call-not-open" };
  // Bind year AND time to the current program's explicit opening announcement, not a historic table/footer.
  const matches = [...t.matchAll(/2209\s*-\s*a üniversite öğrencileri araştırma projeleri destekleme programı (\d{4}) yılı çağrısı başvuruya açılmıştır\.\s*başvurular (\d{1,2}) (\p{L}+) (\d{4}) günü saat (\d{2})[.:](\d{2})['’]?a kadar/gu)];
  if (matches.length !== 1) return { ok: false, reason: "current-call-deadline-missing-or-ambiguous" };
  const m = matches[0]!;
  const months = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
  const month = months.indexOf(m[3]!) + 1;
  const day = `${m[4]}-${String(month).padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  if (!isDayString(day) || m[1] !== m[4] || m[1] !== slotDay.slice(0, 4) || Number(m[5]) > 23 || Number(m[6]) > 59) {
    return { ok: false, reason: "call-year-or-date-invalid" };
  }
  // TÜBİTAK's Turkish call times are Türkiye local time. Do not fall back to end-of-day UTC.
  const deadlineAt = `${day}T${m[5]}:${m[6]}:00+03:00`;
  if (Date.parse(deadlineAt) <= now.getTime() || Date.parse(deadlineAt) <= Date.parse(`${slotDay}T12:00:00+03:00`)) {
    return { ok: false, reason: "call-closes-before-slot" };
  }
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].flatMap((x) => {
    try {
      const url = new URL(x[1]!, TUBITAK_2209A_URL);
      return url.protocol === "https:" && url.hostname === "tubitak.gov.tr" && !url.port && !url.username && !url.password
        && new RegExp(`^/sites/default/files/\\d{4}-\\d{2}/2209-A_${m[1]}_Yili_Cagri_Duyurusu\\.pdf$`, "i").test(url.pathname)
        && !url.search && !url.hash ? [url.toString()] : [];
    } catch { return []; }
  });
  const pdfs = [...new Set(links)];
  if (pdfs.length !== 1) return { ok: false, reason: "same-year-official-call-pdf-missing" };
  return { ok: true, value: { year: m[1]!, callKey: `tubitak-2209a:${m[1]}`, deadlineAt, pdfUrl: pdfs[0]! } };
}

export function verifyStudentRules(pdfText: string, call: StudentCall): StudentCheck<true> {
  const t = text(pdfText);
  const requirements = [
    t.includes(`${call.year} yılı`) && /2209\s*-\s*a/.test(t),
    /türkiye'de lisans veya ön lisans derecesi veren bir programda\*? kayıtlı olmak/.test(t),
    /açık öğretim ve hazırlık sınıfı öğrencileri projede yürütücü ya da proje ortağı olarak yer alamaz/.test(t),
    /projenin bir akademik danışman rehberliğinde yapılıyor olması/.test(t),
    /araştırmacı bilgi sistemi'ne \(arbis\) kaydolunması/.test(t),
    /akademik danışmanın güncel yök kaydının olması zorunludur/.test(t),
    /sistem son başvuru günü mesai bitiminde \(\d{2}[.:]\d{2}\) başvuruya kapatılır/.test(t),
    /danışman onayı/.test(t),
    /son başvuru tarihine kadar sisteme girilen bilgileri onaylanmayan/.test(t),
    /kuruluş yetkilisinin imzası/.test(t),
  ];
  const clocks = [...t.matchAll(/sistem son başvuru günü mesai bitiminde \((\d{2})[.:](\d{2})\) başvuruya kapatılır/g)];
  if (!requirements.every(Boolean)) return { ok: false, reason: "current-eligibility-or-adviser-rules-missing" };
  if (clocks.some((m) => `${m[1]}:${m[2]}` !== call.deadlineAt.slice(11, 16))) return { ok: false, reason: "primary-deadline-time-conflict" };
  return { ok: true, value: true };
}

export function buildStudentDraft(call: StudentCall): PlanPayload {
  const deadline = `${formatIsoDayTr(call.deadlineAt.slice(0, 10))} saat ${call.deadlineAt.slice(11, 16)} (Türkiye saati)`;
  return { v: 1, slides: [
    { role: "kapak", title: `TÜBİTAK 2209-A · ${call.year}`, body: "Üniversite öğrencileri için araştırma projesi desteği", auto: true },
    { role: "genel", title: "Takvim ve onay sırası", body: `Öğrenci başvurusu ve danışman onayı için son tarih: ${deadline}.\nBaşvuru TYBS üzerinden yapılır. Kuruluş yetkilisinin e-imzası ayrı aşamadır; tek başına öğrenci başvurusu yeterli değildir.`, auto: true },
    { role: "genel", title: "Kimler için?", body: "Türkiye'de lisans veya ön lisans programına kayıtlı öğrenciler. Açık Öğretim ve Hazırlık Sınıfı öğrencileri yürütücü veya proje ortağı olamaz.\nARBİS kaydı ve akademik danışman gerekir. Danışmanın güncel YÖK kaydı bulunmalıdır.\nBu bir koşul özetidir; diğer sınırlamalar ve başvuru koşulları resmî çağrı metnindedir.", auto: true },
    { role: "kaynak", title: "Resmî kaynak ve kontrol", body: "TÜBİTAK program sayfası ve aynı yılın çağrı duyurusu kontrol edilmiştir. Takvim ve koşullar değişebilir; işlem öncesinde resmî kaynakları yeniden kontrol edin.\nBilgilendirme amaçlı süreç özetidir.", auto: true },
  ], caption: `Öğrenci köşesi · TÜBİTAK 2209-A ${call.year}\n\nSon başvuru ve danışman onayı: ${deadline}.\nTürkiye'de lisans/ön lisans öğrencileri için araştırma projesi desteği. Açık Öğretim ve Hazırlık Sınıfı kapsam dışıdır. ARBİS kaydı, akademik danışman ve kuruluş e-imzası aşamalarını resmî çağrıdan kontrol edin.\n\nKoşulların tamamı ve güncel takvim resmî kaynaklardadır.`,
    hashtags: ["#ÖğrenciKöşesi", "#TÜBİTAK", "#Araştırma", "#Doctorium"],
    sources: [{ label: "TÜBİTAK 2209-A program sayfası", ref: TUBITAK_2209A_URL }, { label: `${call.year} resmî çağrı duyurusu`, ref: call.pdfUrl }],
  };
}
