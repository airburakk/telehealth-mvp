// M5 Faz 2 — Anonimleştirme (de-identification) katmanı.
// Bir vakayı, Partner doktor konsültasyon havuzuna aktarmadan önce KİŞİSEL VERİDEN ARINDIRIR:
//   (a) yapısal de-id  — kimlik/iletişim ALANLARINI düşür (ad, kimlik no, userId, dosya ekleri/DICOM)
//   (b) metin temizliği — serbest klinik metindeki satır-içi tanımlayıcıları (TC, pasaport, e-posta, telefon, ad) maskele
// Klinik içerik (semptom, süre, branşa özel yanıtlar, ICD-10, lab) KORUNUR — doktor görüş verebilsin diye.
//
// ⚠️ Bu "yapısal de-id"dir; tam KVKK/GDPR yeterliliği + DICOM PHI tag-strip ayrı faza park (todo).
// DICOM/görüntü ekleri bu fazda havuza HİÇ aktarılmaz (attachments tamamen düşürülür).
import { decryptField } from "./crypto";
import { COUNTRIES } from "./constants";

// ── Serbest metin temizleyici ──
const TC_RE = /\b\d{11}\b/g; // TC Kimlik (11 hane)
const PASSPORT_RE = /\b[A-Za-z]{1,2}\d{6,9}\b/g; // pasaport benzeri (1-2 harf + 6-9 hane)
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;
// Tam tarih (DOB) — İKİ ayraç şart → "13.8" (lab) · "C34.1" (ICD) · "120/80" (tansiyon) tetiklemez.
const DATE_RE = /\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g; // telefon benzeri uzun rakam dizisi

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Serbest metinden tanımlayıcıları maskele. names = hastanın adı (ve parçaları) — tam metinden çıkarılır.
export function scrubText(text: string, names: string[] = []): string {
  // Yapısal tanımlayıcılar İSİMDEN ÖNCE — yoksa e-posta yerel-parçası isim maskesiyle bozulur
  // ("ahmet@x.com" → "[ad]@x.com") ve domain sızar. DATE_RE, PHONE_RE'den önce (doğru etiket).
  let t = text
    .replace(EMAIL_RE, "[e-posta]")
    .replace(TC_RE, "[kimlik no]")
    .replace(PASSPORT_RE, "[belge no]")
    .replace(DATE_RE, "[tarih]")
    .replace(PHONE_RE, "[telefon]");
  // Sonra isim(ler): tam ad + ≥3 harfli parçalar
  const parts = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    const trimmed = n.trim();
    if (trimmed.length >= 3) parts.add(trimmed);
    for (const p of trimmed.split(/\s+/)) if (p.length >= 3) parts.add(p);
  }
  for (const p of parts) t = t.replace(new RegExp(escapeRe(p), "gi"), "[ad]");
  return t;
}

function regionLabel(country: string): string {
  const c = COUNTRIES.find((x) => x.code === country);
  return c ? c.name : country; // ülke = kaba bölge bağlamı (bireysel düzeyde tanımlayıcı değil)
}

// Şifreli/düz olabilen Case satırı (encryptField'li kolonlar decryptField'den geçirilir).
export interface DeidCaseInput {
  patientName: string;
  patientIdentifier?: string | null;
  country: string;
  language: string;
  symptoms: string;
  durationText?: string | null;
  extra?: string | null;
  branch: string;
  urgency: number;
  icd10Code?: string | null;
  labResults?: string | null;
}

export interface DeidResult {
  branch: string;
  region: string;
  language: string;
  urgency: number;
  icd10Code: string | null;
  clinicalSummary: string; // kimlikten arındırılmış klinik özet
  redactedFields: string[]; // şeffaflık/denetim: nelerin düşürüldüğü
}

// extra (branşa özel yanıt JSON'u) → okunabilir, temizlenmiş satırlar.
function extraToLines(extra: string | null | undefined, names: string[]): string[] {
  if (!extra) return [];
  try {
    const obj = JSON.parse(extra) as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(([k, v]) => `${k}: ${scrubText(String(v), names)}`);
  } catch {
    return [scrubText(extra, names)];
  }
}

// labResults JSON [{name,value,unit}] → "Ad: değer birim" satırları (klinik, kimliksiz).
function labsToLines(labResults: string | null | undefined): string[] {
  if (!labResults) return [];
  try {
    const arr = JSON.parse(labResults) as { name?: string; value?: string | number; unit?: string }[];
    if (!Array.isArray(arr)) return [];
    return arr.filter((l) => l && l.name).map((l) => `${l.name}: ${l.value ?? "?"}${l.unit ? " " + l.unit : ""}`);
  } catch {
    return [];
  }
}

// Bir vakayı anonim klinik özete dönüştür. Şifreli kolonlar (symptoms/extra) decryptField'den geçirilir.
export function deidentifyCase(c: DeidCaseInput): DeidResult {
  const patientName = decryptField(c.patientName) || "";
  const names = [patientName];

  const symptoms = scrubText(decryptField(c.symptoms) || "", names);
  const extraLines = extraToLines(decryptField(c.extra ?? null), names);
  // Lab satırları da scrub'dan geçer (analit adı/serbest metinde olası tanımlayıcıya karşı — T7).
  const labLines = labsToLines(c.labResults).map((l) => scrubText(l, names));

  const sections: string[] = [];
  if (symptoms.trim()) sections.push(`Şikâyet: ${symptoms.trim()}`);
  if (c.durationText) sections.push(`Süre: ${scrubText(c.durationText, names)}`);
  if (extraLines.length) sections.push(`Ek bulgular —\n${extraLines.map((l) => "• " + l).join("\n")}`);
  if (labLines.length) sections.push(`Laboratuvar —\n${labLines.map((l) => "• " + l).join("\n")}`);

  return {
    branch: c.branch,
    region: regionLabel(c.country),
    language: c.language,
    urgency: c.urgency,
    icd10Code: c.icd10Code ?? null,
    clinicalSummary: sections.join("\n\n") || "(klinik özet yok)",
    redactedFields: ["patientName", "patientIdentifier", "userId", "attachments/DICOM", "inline-identifiers"],
  };
}
