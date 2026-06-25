// Profil + vaka ZENGİNLEŞTİRME (additive, idempotent) — canlı Neon'a YALNIZCA BOŞ alanları doldurur.
// HİÇBİR ŞEY SİLMEZ; mevcut doktor düzenlemeleri + golden demo (Karim) KORUNUR (sadece null/boş alan yazılır).
// Tekrar çalıştırılabilir: ikinci çalıştırmada alanlar dolu → 0 değişiklik.
//   Küme A: doktor procedures (KSHFT işlem+fiyat) + markets (dile uygun pazarlar)
//   Küme B: vaka labResults (gerçek LOINC) + icd10Code + recommendedProcedures + CaseDocument (görüntüleme)
// Çalıştır: npx tsx scripts/enrich-profiles.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { COUNTRIES } from "../src/lib/constants";
import { branchKeyFromLabel, getBranchProcedures } from "../src/lib/procedures";
import { icd10ForBranchLabel, loincForBranchLabel } from "../src/data/coding";
import { doctorCredentials, generatedReviews, isFemaleName } from "../src/lib/doctor-profile";

const db = new PrismaClient();

// Deterministik hash → her çalıştırmada AYNI seçim (idempotent + tekrarlanabilir).
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

// LOINC → gerçekçi normal/anormal değer + birim (kodlar data/coding.ts'ten; değerler klinik aralıklara uygun).
const LAB_VALUES: Record<string, { unit: string; normal: string; abnormal: string }> = {
  "718-7": { unit: "g/dL", normal: "14.2", abnormal: "9.6" }, // Hemoglobin
  "777-3": { unit: "10^3/µL", normal: "248", abnormal: "96" }, // Trombosit
  "6690-2": { unit: "10^3/µL", normal: "7.1", abnormal: "14.8" }, // Lökosit
  "6598-7": { unit: "ng/mL", normal: "0.008", abnormal: "0.42" }, // Troponin T
  "33762-6": { unit: "pg/mL", normal: "78", abnormal: "1840" }, // NT-proBNP
  "2093-3": { unit: "mg/dL", normal: "186", abnormal: "271" }, // Kolesterol total
  "13457-7": { unit: "mg/dL", normal: "108", abnormal: "182" }, // LDL
  "2857-1": { unit: "ng/mL", normal: "1.1", abnormal: "7.6" }, // PSA
  "1988-5": { unit: "mg/L", normal: "3", abnormal: "52" }, // CRP
  "4548-4": { unit: "%", normal: "5.3", abnormal: "8.5" }, // HbA1c
  "2345-7": { unit: "mg/dL", normal: "92", abnormal: "171" }, // Glukoz
  "2160-0": { unit: "mg/dL", normal: "0.9", abnormal: "2.7" }, // Kreatinin
  "1742-6": { unit: "U/L", normal: "27", abnormal: "98" }, // ALT
  "1920-8": { unit: "U/L", normal: "24", abnormal: "91" }, // AST
  "1975-2": { unit: "mg/dL", normal: "0.8", abnormal: "2.9" }, // Bilirubin total
  "3016-3": { unit: "mIU/L", normal: "2.1", abnormal: "9.4" }, // TSH
  "48642-3": { unit: "mL/dk/1.73m²", normal: "96", abnormal: "37" }, // eGFR
  "2823-3": { unit: "mmol/L", normal: "4.2", abnormal: "5.9" }, // Potasyum
  "4537-7": { unit: "mm/saat", normal: "12", abnormal: "54" }, // ESR
  "11572-5": { unit: "IU/mL", normal: "9", abnormal: "68" }, // RF
  "33959-8": { unit: "ng/mL", normal: "0.05", abnormal: "2.3" }, // Prokalsitonin
};

// Doktorun konuştuğu (Türkçe dışı = hedef pazar) dillere karşılık gelen ülkeler + TR (yerel). 4-6 pazar.
function marketsFor(languages: string): string {
  const langs = languages.split(",").map((s) => s.trim()).filter(Boolean);
  const targetLangs = langs.filter((l) => l !== "Türkçe");
  const codes = new Set<string>(["TR"]); // her hekim Türkiye'de hizmet verir
  for (const c of COUNTRIES) {
    if (c.code === "TR") continue;
    if (c.langs.some((l) => targetLangs.includes(l))) codes.add(c.code);
  }
  return [...codes].slice(0, 6).join(",");
}

// Branşın KSHFT işlemlerinden (fiyatı olan) deterministik 4-7 tane seç; taban↔tavan(×3) arası fiyat.
function proceduresFor(branchLabel: string, seed: number): Record<string, number> {
  const key = branchKeyFromLabel(branchLabel);
  if (!key) return {};
  const priced = getBranchProcedures(key).filter((p) => p.price && p.price > 0);
  if (!priced.length) return {};
  const n = 4 + (seed % 4); // 4-7
  const out: Record<string, number> = {};
  for (let i = 0; i < Math.min(n, priced.length); i++) {
    const p = priced[(seed + i * 7) % priced.length];
    if (out[p.code]) continue;
    const floor = p.price!;
    const ratio = 0.35 + ((hash(p.code) % 50) / 100); // taban×(1.35..1.85) → tavan(×3) altında, gerçekçi
    out[p.code] = Math.round((floor * (1 + ratio)) / 50) * 50; // 50₺'ye yuvarla
  }
  return out;
}

// Branşın LOINC paneli → labResults JSON [{loinc,name,value,unit,abnormal?}]; ~%40 anormal (deterministik).
function labsFor(branchLabel: string, caseId: string): string | null {
  const loincs = loincForBranchLabel(branchLabel);
  if (!loincs.length) return null;
  const labs = loincs.map((l) => {
    const v = LAB_VALUES[l.code];
    const abn = hash(caseId + l.code) % 5 < 2; // ~%40
    if (!v) return { loinc: l.code, name: l.label, value: "—", unit: "" };
    return { loinc: l.code, name: l.label, value: abn ? v.abnormal : v.normal, unit: v.unit, ...(abn ? { abnormal: true } : {}) };
  });
  return JSON.stringify(labs);
}

// Branşın ICD-10 listesinden deterministik bir tanı kodu.
function icdFor(branchLabel: string, caseId: string): string | null {
  const icds = icd10ForBranchLabel(branchLabel);
  if (!icds.length) return null;
  return icds[hash(caseId) % icds.length].code;
}

// Branşın işlemlerinden 1-2 önerilen tedavi → recommendedProcedures [{code,name,priceTRY}].
function recoFor(branchLabel: string, seed: number): string | null {
  const key = branchKeyFromLabel(branchLabel);
  if (!key) return null;
  const priced = getBranchProcedures(key).filter((p) => p.price && p.price > 0);
  if (!priced.length) return null;
  const n = 1 + (seed % 2); // 1-2
  const picks: { code: string; name: string; priceTRY: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = priced[(seed + i * 5) % priced.length];
    if (picks.some((x) => x.code === p.code)) continue;
    picks.push({ code: p.code, name: p.name, priceTRY: Math.round((p.price! * 1.6) / 50) * 50 });
  }
  return JSON.stringify(picks);
}

// Branşa uygun 2-3 gerçekçi yayın (deterministik) → publications JSON [{title,venue,year}].
function publicationsFor(branchLabel: string, seed: number): { title: string; venue: string; year: number }[] {
  const b = branchLabel;
  const titles = [
    `${b} hastalarında tedavi sonuçlarının retrospektif değerlendirilmesi`,
    `${b} pratiğinde güncel tanı ve tedavi yaklaşımları`,
    `Uluslararası hastalarda ${b.toLocaleLowerCase("tr-TR")} deneyimi: tek merkez serisi`,
    `${b} alanında minimal invaziv yöntemlerin klinik etkinliği`,
  ];
  const venues = ["Türk Tıp Dergisi", `Ulusal ${b} Kongresi`, "Journal of Clinical Medicine", "Anadolu Klinik Araştırmalar Dergisi"];
  const n = 2 + (seed % 2); // 2-3
  const out: { title: string; venue: string; year: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ title: titles[(seed + i) % titles.length], venue: venues[(seed + i * 3) % venues.length], year: 2026 - (1 + ((seed + i) % 6)) });
  }
  return out;
}

// attachment dosya adından belge türü + MIME.
function docMeta(file: string): { mime: string; type: string } {
  const f = file.toLocaleLowerCase("tr-TR");
  const isImg = /\.(jpg|jpeg|png)$/.test(f);
  const mime = isImg ? "image/jpeg" : "application/pdf";
  let type = "Tıbbi Belge";
  if (/(bt|mr|mri|rontgen|röntgen|usg|ultrason|panoramik|anjiyo|foto|görüntü|goruntu)/.test(f)) type = "Görüntüleme Raporu";
  else if (/(lab|tahlil|sonuc|sonuç|panel|psa|hormon|kan)/.test(f)) type = "Laboratuvar";
  else if (/(epikriz|rapor|biyopsi)/.test(f)) type = "Epikriz / Tıbbi Rapor";
  return { mime, type };
}

// ── Profil foto havuzu — cinsiyete göre (kontakt sayfasından el ile sınıflandırıldı; tam yollar) ──
// 32'lik ızgaradan 13 kadın + 19 erkek; + ilk görüntüden 1 kadın (Esmer) + 1 erkek (Volkan) → 14 kadın · 20 erkek.
const FEMALE_POOL = [
  "/photos/pool/p01.jpg", "/photos/pool/p03.jpg", "/photos/pool/p04.jpg", "/photos/pool/p09.jpg",
  "/photos/pool/p11.jpg", "/photos/pool/p12.jpg", "/photos/pool/p17.jpg", "/photos/pool/p18.jpg",
  "/photos/pool/p19.jpg", "/photos/pool/p20.jpg", "/photos/pool/p23.jpg", "/photos/pool/p25.jpg",
  "/photos/pool/p27.jpg", "/photos/doctor-female.jpg",
];
const MALE_POOL = [
  "/photos/pool/p02.jpg", "/photos/pool/p05.jpg", "/photos/pool/p06.jpg", "/photos/pool/p07.jpg",
  "/photos/pool/p08.jpg", "/photos/pool/p10.jpg", "/photos/pool/p13.jpg", "/photos/pool/p14.jpg",
  "/photos/pool/p15.jpg", "/photos/pool/p16.jpg", "/photos/pool/p21.jpg", "/photos/pool/p22.jpg",
  "/photos/pool/p24.jpg", "/photos/pool/p26.jpg", "/photos/pool/p28.jpg", "/photos/pool/p29.jpg",
  "/photos/pool/p30.jpg", "/photos/pool/p31.jpg", "/photos/pool/p32.jpg", "/photos/doctor-male.jpg",
];

// Her doktora cinsiyetine UYGUN, BENZERSİZ foto ata (deterministik, id sırası). Havuz ≥ doktor → tekrar YOK.
// Cinsiyet asla karışmaz. Atama deterministik → zaten doğruysa atla (idempotent), yanlışsa düzeltir.
async function enrichPhotos(): Promise<number> {
  const doctors = await db.doctor.findMany({ orderBy: { id: "asc" } });
  let fi = 0, mi = 0, upd = 0;
  for (const d of doctors) {
    const isF = isFemaleName(d.name);
    const pool = isF ? FEMALE_POOL : MALE_POOL;
    const photo = pool[(isF ? fi++ : mi++) % pool.length];
    if (d.photo === photo) continue; // zaten doğru atanmış
    await db.doctor.update({ where: { id: d.id }, data: { photo } });
    upd++;
  }
  return upd;
}

async function enrichDoctors(): Promise<{ upd: number; reviews: number }> {
  const doctors = await db.doctor.findMany();
  let upd = 0, reviews = 0;
  for (const d of doctors) {
    const data: Record<string, unknown> = {};
    if (!d.procedures) {
      const procs = proceduresFor(d.branch, hash(d.id));
      if (Object.keys(procs).length) data.procedures = JSON.stringify(procs);
    }
    if (!d.markets || !d.markets.trim()) {
      const m = marketsFor(d.languages);
      if (m) data.markets = m;
    }
    // Akademik — boşsa doctor-profile.ts deterministik üretimini kalıcılaştır (her alan ayrı idempotent kontrol).
    if (!d.eduSchool || !d.specBoard || !d.certifications || !d.publications) {
      const cred = doctorCredentials(d);
      if (!d.eduSchool) { data.eduSchool = cred.diploma.school; data.eduYear = cred.diploma.year; }
      if (!d.specBoard) { data.specBoard = cred.uzmanlik.board; data.specYear = cred.uzmanlik.year; }
      if (!d.certifications) data.certifications = JSON.stringify(cred.certs);
      if (!d.publications) data.publications = JSON.stringify(publicationsFor(d.branch, hash(d.id)));
    }
    if (Object.keys(data).length) { await db.doctor.update({ where: { id: d.id }, data }); upd++; }

    // Yorumlar — hekimin hiç yorumu yoksa generatedReviews'ı kalıcı Review tablosuna yaz (mevcut seed yorumları korunur).
    const revCount = await db.review.count({ where: { doctorId: d.id } });
    if (revCount === 0) {
      for (const r of generatedReviews(d)) {
        await db.review.create({ data: { doctorId: d.id, author: r.author, country: r.country, stars: r.stars, text: r.text, createdAt: new Date(Date.now() - r.daysAgo * 86400000) } });
        reviews++;
      }
    }
  }
  return { upd, reviews };
}

async function enrichCases(): Promise<{ upd: number; docs: number }> {
  const cases = await db.case.findMany();
  let upd = 0, docs = 0;
  for (const c of cases) {
    const data: { labResults?: string; icd10Code?: string; recommendedProcedures?: string } = {};
    if (!c.labResults) { const l = labsFor(c.branch, c.id); if (l) data.labResults = l; }
    if (!c.icd10Code) { const i = icdFor(c.branch, c.id); if (i) data.icd10Code = i; }
    if (!c.recommendedProcedures) { const r = recoFor(c.branch, hash(c.id)); if (r) data.recommendedProcedures = r; }
    if (Object.keys(data).length) { await db.case.update({ where: { id: c.id }, data }); upd++; }

    // Belge yoksa, attachment'tan 1 görüntüleme/lab belgesi (golden demo deseni: AI alanları önceden dolu).
    const hasDoc = await db.caseDocument.count({ where: { caseId: c.id } });
    if (hasDoc === 0 && c.attachments) {
      const file = c.attachments.split(",")[0].trim();
      if (file) {
        const { mime, type } = docMeta(file);
        const icds = icd10ForBranchLabel(c.branch);
        const dx = icds.length ? icds[hash(c.id) % icds.length].label : c.branch;
        await db.caseDocument.create({
          data: {
            caseId: c.id, label: file, mimeType: mime, content: null,
            aiDocType: type,
            aiSummary: `${type} bulguları ${dx.toLocaleLowerCase("tr-TR")} ile uyumlu; hastanın başvuru şikâyetiyle ilişkili. İleri değerlendirme ve tedavi planı için uzman görüşü önerilir.`,
            aiTranslation: `Belge içeriği Türkçeye çevrildi (demo). Klinik bulgular ${c.branch} açısından değerlendirilmiştir.`,
            aiFlags: type === "Laboratuvar" ? "Referans dışı değer(ler) saptandı — klinik korelasyon gerekli." : null,
            assessedAt: new Date(),
          },
        });
        docs++;
      }
    }
  }
  return { upd, docs };
}

async function main() {
  const { upd: dUpd, reviews } = await enrichDoctors();
  const photos = await enrichPhotos();
  const { upd: cUpd, docs } = await enrichCases();
  const totDoctors = await db.doctor.count();
  const totCases = await db.case.count();
  console.log(`✓ Doktor güncellendi (procedures/markets/akademik): ${dUpd}/${totDoctors} · yeni yorum: ${reviews} · foto atandı: ${photos}`);
  console.log(`✓ Vaka güncellendi (lab/icd10/tedavi): ${cUpd}/${totCases} · yeni CaseDocument: ${docs}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await db.$disconnect(); });
