// M5 Faz 3 — İki dummy Partner Doktor (İngilizce + Türkçe konuşan) + birer BELGELİ konsültasyon talebi.
// Gerçek yazma yoluyla aynı boru hattı: scrubText → encryptField → storeDocument (AI adımları
// bilinçli atlanır — summaryTr elle verilir, belge AI alanları boş kalır; havuz UI'ı ham belgeyi gösterir).
// İdempotent: partner/user upsert; talep yalnız o partnerin hiç talebi yoksa açılır (re-run → 0 yeni).
// Hiçbir şey SİLMEZ. Çalıştır: npx tsx scripts/add-demo-partners.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptField, decryptField } from "../src/lib/crypto";
import { scrubText } from "../src/lib/deidentify";
import { storeDocument, loadDocument } from "../src/lib/storage";

// ⚠️ ÜRETİM KORUMASI (fill-markets/rotate-kek eşleniği — db.ts guard'ı script'lerden geçmez):
//    DATABASE_URL prod parmak izini içeriyorsa ALLOW_PROD_PARTNER_SEED=1 AÇIKÇA verilmeli.
const fp = process.env.PROD_DB_FINGERPRINT;
if (fp && (process.env.DATABASE_URL ?? "").includes(fp) && process.env.ALLOW_PROD_PARTNER_SEED !== "1") {
  console.error("⛔ DATABASE_URL üretim veritabanına işaret ediyor; demo partner seed'i durduruldu.");
  console.error("   Bilinçli istiyorsan ALLOW_PROD_PARTNER_SEED=1 ile yeniden çalıştır.");
  process.exit(1);
}

const db = new PrismaClient();

// ── Minimal tek sayfalık PDF üretici (bağımlılıksız; Helvetica/WinAnsi → metin Latin-1'de kalmalı,
//    ğ/ş/ı içeren Türkçe karakter KULLANMA — dummy belge için diakritiksiz metin yeterli) ──
function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = `BT /F1 12 Tf 50 780 Td 16 TL\n${lines.map((l) => `(${esc(l)}) Tj T*`).join("\n")}\nET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefAt = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

interface DemoPartner {
  email: string;
  name: string;
  country: string; // ISO kod (constants.COUNTRIES)
  countryName: string; // requestedByName "(Ülke)" eki — route ile aynı biçim
  institution: string;
  branch: string; // BRANCHES label
  language: string; // LANGUAGES etiketi — partner arayüz/okuma dili
  request: {
    branchLimited: boolean;
    branch: string | null; // dolu = yalnız bu branş hekimleri görür
    language: string; // hastanın dili
    urgency: number;
    icd10Code: string;
    summary: string; // anonim klinik özet (kaynak dilde)
    summaryTr: string; // TR çeviri — AI çağrılmadan elle (TR kaynakta aynı metin = servis davranışı)
    doc: { label: string; lines: string[] };
  };
}

const PARTNERS: DemoPartner[] = [
  {
    email: "partner-en@air.test",
    name: "Emily Carter",
    country: "GB",
    countryName: "Birleşik Krallık",
    institution: "Thames Cardiology Institute",
    branch: "Kardiyoloji",
    language: "İngilizce",
    request: {
      branchLimited: false, // genel havuz — tüm consultOptIn hekimler görür
      branch: null,
      language: "İngilizce",
      urgency: 3,
      icd10Code: "I25.1",
      summary:
        "58-year-old male patient with known coronary artery disease, on statin and beta-blocker therapy. " +
        "Recurrent exertional chest tightness over the past 6 weeks despite medication adherence. " +
        "Recent treadmill stress test positive at moderate workload; echocardiography shows mild inferior wall " +
        "hypokinesia with preserved ejection fraction (55%). Lab panel attached. Seeking opinion on whether to " +
        "proceed with coronary angiography or intensify medical therapy first.",
      summaryTr:
        "Bilinen koroner arter hastalığı olan, statin ve beta-bloker tedavisi altındaki 58 yaşında erkek hasta. " +
        "Tedavi uyumuna rağmen son 6 haftadır tekrarlayan efor ilişkili göğüs sıkışması. Yakın tarihli treadmill " +
        "efor testi orta yükte pozitif; ekokardiyografide korunmuş ejeksiyon fraksiyonu (%55) ile birlikte hafif " +
        "inferior duvar hipokinezisi. Laboratuvar paneli ekte. Koroner anjiyografiye mi geçilmeli yoksa önce " +
        "medikal tedavi mi yoğunlaştırılmalı, görüş talep edilmektedir.",
      doc: {
        label: "lab-panel-2026-07.pdf",
        lines: [
          "THAMES CARDIOLOGY INSTITUTE - LAB REPORT (anonymised)",
          "",
          "Patient: [REDACTED]   Age: 58   Sex: M",
          "Date: 2026-07-21",
          "",
          "Total cholesterol: 212 mg/dL  (ref < 200)",
          "LDL-C:             138 mg/dL  (ref < 100)",
          "HDL-C:              41 mg/dL  (ref > 40)",
          "Triglycerides:     174 mg/dL  (ref < 150)",
          "hs-Troponin T:     11 ng/L    (ref < 14)",
          "NT-proBNP:         180 pg/mL  (ref < 125)",
          "Creatinine:        1.02 mg/dL (ref 0.7-1.2)",
          "HbA1c:             5.9 %      (ref < 5.7)",
          "",
          "Comment: borderline lipid control on current statin dose.",
        ],
      },
    },
  },
  {
    email: "partner-tr@air.test",
    name: "Kerem Aydın",
    country: "DE",
    countryName: "Almanya",
    institution: "Rhein Onkoloji Merkezi",
    branch: "Onkoloji",
    language: "Türkçe",
    request: {
      branchLimited: true, // yalnız Onkoloji hekimleri görür (dev: doktor@air.test Onkoloji)
      branch: "Onkoloji",
      language: "Türkçe",
      urgency: 4,
      icd10Code: "C50.9",
      summary:
        "62 yaşında kadın hasta; sol memede 2,8 cm kitle, tru-cut biyopsi sonucu invaziv duktal karsinom " +
        "(ER+/PR+, HER2 negatif, Ki-67 %22). Aksiller ultrasonda tek şüpheli lenf nodu, İİAB sonucu bekleniyor. " +
        "PET-BT'de uzak metastaz saptanmadı. Patoloji özeti ekte. Neoadjuvan kemoterapi mi yoksa önce cerrahi mi " +
        "tercih edilmeli; hormonoterapi planlaması dahil görüş talep ediyorum.",
      summaryTr:
        "62 yaşında kadın hasta; sol memede 2,8 cm kitle, tru-cut biyopsi sonucu invaziv duktal karsinom " +
        "(ER+/PR+, HER2 negatif, Ki-67 %22). Aksiller ultrasonda tek şüpheli lenf nodu, İİAB sonucu bekleniyor. " +
        "PET-BT'de uzak metastaz saptanmadı. Patoloji özeti ekte. Neoadjuvan kemoterapi mi yoksa önce cerrahi mi " +
        "tercih edilmeli; hormonoterapi planlaması dahil görüş talep ediyorum.",
      doc: {
        label: "patoloji-ozeti-2026-07.pdf",
        lines: [
          "RHEIN ONKOLOJI MERKEZI - PATOLOJI OZETI (anonim)",
          "",
          "Hasta: [GIZLENDI]   Yas: 62   Cinsiyet: K",
          "Tarih: 2026-07-18",
          "",
          "Materyal: sol meme tru-cut biyopsi (3 kor)",
          "Tani: invaziv duktal karsinom, grade 2",
          "Tumor boyutu (US): 2.8 cm",
          "ER: pozitif (%90)   PR: pozitif (%75)",
          "HER2: negatif (IHK 1+)",
          "Ki-67: %22",
          "",
          "Not: aksiller lenf nodu IIAB sonucu beklenmektedir.",
        ],
      },
    },
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("1234", 10);
  for (const p of PARTNERS) {
    // 1) PartnerDoctor + User (upsert — re-run güvenli)
    const partner = await db.partnerDoctor.upsert({
      where: { email: p.email },
      create: {
        name: p.name, title: "Dr.", country: p.country, institution: p.institution,
        branch: p.branch, email: p.email, language: p.language, verified: true,
      },
      update: { language: p.language, verified: true },
    });
    await db.user.upsert({
      where: { email: p.email },
      create: { email: p.email, name: `Dr. ${p.name}`, role: "PARTNER", passwordHash, partnerId: partner.id },
      update: { role: "PARTNER", partnerId: partner.id },
    });

    // 2) Belgeli konsültasyon talebi — yalnız bu partnerin hiç talebi yoksa (idempotentlik)
    const exists = await db.consultationRequest.findFirst({
      where: { requestedByPartnerId: partner.id }, select: { id: true },
    });
    if (exists) {
      console.log(`↷ ${p.email}: talep zaten var (${exists.id}) — atlandı`);
      continue;
    }
    const r = p.request;
    // Gerçek yol ile aynı: yapısal scrub (dummy metin zaten anonim ama boru hattına sadık kal) + şifreleme
    const summary = scrubText(r.summary, []);
    const created = await db.consultationRequest.create({
      data: {
        requestedByPartnerId: partner.id,
        requestedByName: `Dr. ${p.name} (${p.countryName})`,
        branch: r.branchLimited ? r.branch : null,
        region: p.countryName,
        language: r.language,
        urgency: r.urgency,
        icd10Code: r.icd10Code,
        clinicalSummary: encryptField(summary),
        summaryTr: encryptField(scrubText(r.summaryTr, [])),
        status: "OPEN",
      },
    });
    const dataUrl = `data:application/pdf;base64,${makePdf(r.doc.lines).toString("base64")}`;
    await db.consultationRequestDocument.create({
      data: {
        requestId: created.id,
        label: r.doc.label,
        mime: "application/pdf",
        fileData: (await storeDocument(dataUrl, { keyPrefix: "consult-doc" })) as string,
      },
    });
    console.log(`✓ ${p.email} (${p.language}) → talep ${created.id} [${r.branchLimited ? r.branch : "genel havuz"}] + 1 PDF`);
  }

  // 3) Doğrulama: şifreleme + belge round-trip (yaz-oku kanıtı; PHI loglanmaz)
  for (const p of PARTNERS) {
    const partner = await db.partnerDoctor.findUnique({ where: { email: p.email }, select: { id: true } });
    const req = await db.consultationRequest.findFirst({
      where: { requestedByPartnerId: partner!.id },
      select: { id: true, clinicalSummary: true, documents: { select: { fileData: true, label: true } } },
    });
    const plain = decryptField(req!.clinicalSummary);
    const doc = req!.documents[0] ? await loadDocument(req!.documents[0].fileData) : null;
    const pdfOk = typeof doc === "string" && doc.startsWith("data:application/pdf;base64,");
    console.log(`  ✔ ${p.email}: özet çözüldü (${plain.length} kr) · belge ${pdfOk ? "PDF round-trip OK" : "SORUN!"} (${req!.documents[0]?.label})`);
  }
  console.log("Giriş: partner-en@air.test / 1234 · partner-tr@air.test / 1234");
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
