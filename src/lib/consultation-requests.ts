// M5 — Konsültasyon Talepleri havuzu servisi.
// Partner doktor bir vakayı ANONİMLEŞTİREREK havuza yazar; kayıtlı doktorlar (consultOptIn) görüş verir.
// Klinik içerik (clinicalSummary/answerText/belge AI/öneriler) at-rest şifrelidir (lib/crypto).
// Faz 1 (v3.x): belge yükleme + assessDocument AI değerlendirme/FHIR + çift-yönlü çeviri
// (özet→TR yanıtlayan doktor için · görüş→hasta dili partnere) + yapılandırılmış kodlu öneriler.
import { db } from "./db";
import { encryptField, decryptField } from "./crypto";
import { storeDocument, loadDocument } from "./storage";
import { deidentifyCase, scrubText } from "./deidentify";
import { deidentifyDicom } from "./dicom-deidentify";
import { translateText, assessDocument, redactPersonNames } from "./ai-clinical";
import { notifyUser, notifyDoctorById } from "./notify";
import { loincForBranchLabel } from "@/data/coding";
import { COUNTRIES as ALL_COUNTRIES } from "./constants";
import { publishLiveNudge } from "./ably-server";

// DICOM PHI tag-strip başarısızlığı — route 400'e çevirir (fail-closed: sıyrılamayan dosya SAKLANMAZ,
// talep hiç açılmaz). Mesaj kullanıcı onaylı (2026-07-20).
export class DicomRejectedError extends Error {
  constructor(label: string) {
    super(`${label}: DICOM dosyası okunamadı veya anonimleştirilemedi; dosya kaydedilmedi.`);
    this.name = "DicomRejectedError";
  }
}

export const PAYMENT_PER_ANSWER = 50; // USD — yanıt başına ödeme (simüle)

function clampUrgency(u: number): number {
  return Math.min(5, Math.max(1, Math.round(Number(u) || 3)));
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    const p = JSON.parse(s);
    return p ?? fallback;
  } catch {
    return fallback;
  }
}

// ── Partner formundan anonim talep (+ opsiyonel belgeler) ──
export interface PartnerDocInput {
  label: string;
  mime: string;
  dataUrl: string; // base64 data URL
}

export interface PartnerRequestInput {
  partnerId?: string | null; // partner akışı (M5 Faz 3)
  partnerName: string; // görünen ad (iç-doktor akışında "Dr. X (Platform)")
  requestedByDoctorId?: string | null; // İÇ VAKADAN açan platform doktoru (v6.33 Faz 3) — havuzda kendine gösterilmez
  sourceCaseId?: string | null; // iç izlenebilirlik (yanıtlayan hekime gösterilmez)
  summaryIsTurkish?: boolean; // özet TR yazıldıysa summaryTr çeviri ÇAĞRILMADAN doğrudan doldurulur (v6.33)
  branchLimited: boolean;
  branch?: string | null;
  region: string;
  language: string;
  urgency: number;
  icd10Code?: string | null;
  clinicalSummary: string;
}

export async function createRequestFromInput(input: PartnerRequestInput, documents: PartnerDocInput[] = []): Promise<string> {
  // (0) DICOM PHI tag-strip — KAYIT ÖNCESİ hazırlık (v6.32): application/dicom belgelerin kimlik/kurum
  //     etiketleri sunucuda sıyrılır (lib/dicom-deidentify; piksel verisi dokunulmaz — burned-in yazıyı
  //     partner formda beyanla doğrular). Sıyrılamayan dosya = DicomRejectedError → HİÇBİR kayıt yazılmaz.
  //     uidMap talep-başına paylaşılır: aynı çalışmanın çoklu dosyaları tutarlı yeni UID alır.
  const uidMap = new Map<string, string>();
  const prepared = documents.slice(0, 8).filter((d) => d?.dataUrl).map((d) => {
    if (d.mime !== "application/dicom") return d;
    try {
      const raw = Buffer.from(d.dataUrl.replace(/^data:[^;]*;base64,/, ""), "base64");
      const { bytes } = deidentifyDicom(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer, uidMap);
      return { ...d, dataUrl: `data:application/dicom;base64,${Buffer.from(bytes).toString("base64")}` };
    } catch {
      throw new DicomRejectedError(d.label || "belge");
    }
  });

  // (1) Yapısal satır-içi temizlik: e-posta/TC/telefon/tarih maskelenir (deidentify.scrubText).
  const structural = scrubText(input.clinicalSummary.trim().slice(0, 5000), []);
  // (2) AI isim redaksiyonu: yapısal scrub'ın yakalayamadığı DÜZ hasta/kişi adlarını [ad] ile maskele
  //     (partner serbest-metni — sistem hastanın adını bilmez; KVKK/GDPR minimizasyon). Best-effort:
  //     AI yoksa/hata ise yapısal scrub ile devam (submit'i bozma; en kötü durum = önceki davranış).
  //     İsim KAYDEDİLMEDEN ÖNCE maskelenir → düz ad DB'ye hiç yazılmaz + summaryTr çevirisi de temiz olur.
  let summary = structural;
  try {
    summary = await redactPersonNames(structural);
  } catch (e) {
    console.warn("[consult] AI isim redaksiyonu atlandı — yapısal scrub ile devam:", e instanceof Error ? e.message : e);
  }
  const created = await db.consultationRequest.create({
    data: {
      requestedByPartnerId: input.partnerId ?? null,
      requestedByDoctorId: input.requestedByDoctorId ?? null,
      sourceCaseId: input.sourceCaseId ?? null,
      requestedByName: input.partnerName,
      branch: input.branchLimited ? input.branch ?? null : null,
      region: input.region,
      language: input.language,
      urgency: clampUrgency(input.urgency),
      icd10Code: input.icd10Code?.trim() || null,
      clinicalSummary: encryptField(summary),
      // Özet TR kaynaklıysa summaryTr = redaksiyon SONRASI aynı metin — translateText hiç çağrılmaz
      // (TR→"Türkçe" çevirisinin İngilizce'ye kayması v6.32 doğrulamasında gözlendi; kök çözüm burada).
      summaryTr: input.summaryIsTurkish ? encryptField(summary) : null,
      status: "OPEN",
    },
  });
  // Belgeler ham (şifreli) yazılır; AI değerlendirmesi processRequestAi'da yapılır. DICOM'lar (0)'da sıyrıldı.
  for (const d of prepared) {
    await db.consultationRequestDocument.create({
      data: { requestId: created.id, label: (d.label || "belge").slice(0, 200), mime: d.mime || "application/octet-stream", fileData: (await storeDocument(d.dataUrl, { keyPrefix: "consult-doc" })) as string }, // object storage / inline şifreli (T11)
    });
  }
  return created.id;
}

// ── v6.33 Faz 3: İÇ VAKADAN havuza konsültasyon ──
// Atanan doktor vakayı kimlikten arındırıp havuza açar. Özet taslağı deidentifyCase'ten gelir,
// doktor düzenler; düzenlenmiş metin YİNE scrub+redact'ten geçer (createRequestFromInput içinde —
// doktor yanlışlıkla kimlik yazmış olabilir). DICOM belgeler aynı fonksiyonun kayıt-öncesi
// tag-strip hazırlığından geçer (motor yeniden kullanımı). Özet TR → summaryTr doğrudan doldurulur.

// Havuza-açma panelinin ön-dolumu: anonim özet taslağı + seçilebilir belge listesi (içerik YOK — hafif).
export async function poolPreviewForCase(caseId: string): Promise<{ summary: string; documents: { id: string; label: string; mime: string }[] } | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    select: {
      patientName: true, patientIdentifier: true, country: true, language: true, symptoms: true,
      durationText: true, extra: true, branch: true, urgency: true, icd10Code: true, labResults: true,
      documents: { where: { content: { not: null } }, select: { id: true, label: true, mimeType: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) return null;
  const deid = deidentifyCase(c);
  return {
    summary: deid.clinicalSummary,
    documents: c.documents.map((d) => ({ id: d.id, label: d.label, mime: d.mimeType })),
  };
}

export interface PoolFromCaseInput {
  caseId: string;
  doctorId: string;
  doctorName: string; // görünen ad → "Dr. X (Platform)" (kullanıcı onaylı etiket)
  summary: string; // doktorun kontrol edip düzenlediği anonim özet (TR)
  docIds: string[]; // vakaya ait CaseDocument seçimi
}

export async function createRequestFromCase(input: PoolFromCaseInput): Promise<{ id: string } | "NOT_FOUND" | "EMPTY"> {
  const clean = (input.summary || "").trim();
  if (clean.length < 10) return "EMPTY";
  const c = await db.case.findUnique({
    where: { id: input.caseId },
    select: { id: true, country: true, language: true, branch: true, urgency: true, icd10Code: true },
  });
  if (!c) return "NOT_FOUND";

  // Seçilen belgeler (yalnız bu vakanın içerikli satırları) → data URI. DICOM'lar createRequestFromInput'ta sıyrılır.
  const rows = input.docIds.length
    ? await db.caseDocument.findMany({
        where: { caseId: input.caseId, id: { in: input.docIds.slice(0, 8) }, content: { not: null } },
        select: { id: true, label: true, mimeType: true, content: true },
      })
    : [];
  const documents: PartnerDocInput[] = [];
  for (const d of rows) {
    const dataUrl = await loadDocument(d.content as string);
    if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
      documents.push({ label: d.label, mime: d.mimeType, dataUrl });
    }
  }

  const region = ALL_COUNTRIES.find((x) => x.code === c.country)?.name ?? c.country;
  const id = await createRequestFromInput({
    partnerId: null,
    partnerName: `${input.doctorName} (Platform)`,
    requestedByDoctorId: input.doctorId,
    sourceCaseId: c.id,
    summaryIsTurkish: true,
    branchLimited: true,
    branch: c.branch,
    region,
    language: c.language,
    urgency: c.urgency,
    icd10Code: c.icd10Code,
    clinicalSummary: clean,
  }, documents);
  return { id };
}

// Vaka sayfası "Havuz Görüşü" kartı — bu vakadan açılan talepler (durum + görüş; hafif select).
export interface CasePoolView { id: string; status: string; branch: string | null; answerText: string | null; answeredAt: string | null; createdAt: string }
export async function poolRequestsForCase(caseId: string): Promise<CasePoolView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { sourceCaseId: caseId, requestedByDoctorId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, status: true, branch: true, answerText: true, answeredAt: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id, status: r.status, branch: r.branch,
    answerText: r.answerText ? decryptField(r.answerText) : null,
    answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

// AI işleme: klinik özeti Türkçeye çevir (yanıtlayan doktor için) + her belgeyi assessDocument ile değerlendir.
// Triyaj analyze-docs deseni: docType + TR çeviri + özet + bayrak + LOINC labs. Hatalı belge atlanır.
export async function processRequestAi(requestId: string): Promise<void> {
  const r = await db.consultationRequest.findUnique({ where: { id: requestId }, include: { documents: true } });
  if (!r) return;

  // v6.33: hasta dili Türkçe ise özet zaten TR kabul edilir → çeviri ÇAĞRILMAZ (TR→"Türkçe" çevirisinin
  // İngilizce'ye kaydığı v6.32 doğrulamasında gözlendi; summaryTr boş kalır, UI clinicalSummary gösterir).
  // İç-doktor akışı summaryTr'yi create anında doğrudan doldurur (summaryIsTurkish) — buraya hiç düşmez.
  if (!r.summaryTr && r.language?.toLowerCase() !== "türkçe") {
    try {
      const tr = await translateText(decryptField(r.clinicalSummary), "Türkçe");
      if (tr) await db.consultationRequest.update({ where: { id: requestId }, data: { summaryTr: encryptField(tr) } });
    } catch (e) {
      console.warn("[consult-ai] özet çeviri hatası:", e instanceof Error ? e.message : e);
    }
  }

  const loincHints = loincForBranchLabel(r.branch).map((e) => ({ code: e.code, label: e.label }));
  for (const d of r.documents) {
    if (d.assessedAt) continue;
    if (d.mime === "application/dicom") continue; // viewer-only (v6.32): radyoloji AI yorumu bilinçli kapsam dışı
    try {
      const a = await assessDocument((await loadDocument(d.fileData)) as string, { // object storage'tan (varsa) yükle + çöz (T11)
        branch: r.branch ?? "Genel",
        symptoms: decryptField(r.clinicalSummary),
        language: r.language,
        label: d.label,
        loincHints,
      });
      await db.consultationRequestDocument.update({
        where: { id: d.id },
        data: {
          docType: a.docType,
          aiSummary: encryptField(a.summary),
          aiTranslation: encryptField(a.translation),
          aiFlags: encryptField(a.flags),
          aiLabs: a.docType === "Laboratuvar" && a.labs.length ? JSON.stringify(a.labs) : null,
          assessedAt: new Date(),
        },
      });
    } catch (e) {
      console.warn("[consult-ai] belge değerlendirme hatası:", e instanceof Error ? e.message : e);
    }
  }
}

// ── Görünüm tipleri ──
export interface LabRow { loinc?: string; name?: string; value?: string; unit?: string; abnormal?: string }
export interface LabRec { loinc?: string; name?: string }
export interface ImagingRec { code?: string; system?: string; name?: string }
export interface MedRec { atc?: string; name?: string; dose?: string; route?: string; freq?: string }

export interface ConsultDocView {
  id: string;
  label: string;
  mime: string; // application/dicom → UI "Görüntüle (DICOM)" gösterir (v6.32)
  docType: string | null;
  aiSummary: string | null;
  aiTranslation: string | null;
  aiFlags: string | null;
  aiLabs: LabRow[];
  assessed: boolean;
}

export interface ConsultReqView {
  id: string;
  branch: string | null;
  region: string;
  language: string;
  urgency: number;
  icd10Code: string | null;
  clinicalSummary: string; // çözülmüş (kaynak dil)
  summaryTr: string | null; // Türkçe (yanıtlayan doktor için)
  requestedByName: string | null;
  status: string;
  answerText: string | null; // doktor görüşü (TR kaynak)
  answerTr: string | null; // doktor görüşü hasta dilinde (partnere)
  recommendedLabs: LabRec[];
  recommendedImaging: ImagingRec[];
  medications: MedRec[];
  documents: ConsultDocView[];
  paymentSim: number | null;
  answeredAt: string | null;
  createdAt: string;
}

type RowWithDocs = {
  id: string; branch: string | null; region: string; language: string; urgency: number;
  icd10Code: string | null; clinicalSummary: string; summaryTr: string | null; requestedByName: string | null;
  status: string; answerText: string | null; answerTr: string | null; recommendedLabs: string | null;
  recommendedImaging: string | null; medications: string | null; paymentSim: number | null;
  answeredAt: Date | null; createdAt: Date;
  // AI alanları opsiyonel: liste görünümleri (DOC_SELECT_LITE) bunları çekmez → view'da null/[] olur.
  documents?: { id: string; label: string; mime: string; docType: string | null; aiSummary?: string | null; aiTranslation?: string | null; aiFlags?: string | null; aiLabs?: string | null; assessedAt: Date | null }[];
};

function toView(r: RowWithDocs): ConsultReqView {
  return {
    id: r.id,
    branch: r.branch,
    region: r.region,
    language: r.language,
    urgency: r.urgency,
    icd10Code: r.icd10Code,
    clinicalSummary: decryptField(r.clinicalSummary),
    summaryTr: r.summaryTr ? decryptField(r.summaryTr) : null,
    requestedByName: r.requestedByName,
    status: r.status,
    answerText: r.answerText ? decryptField(r.answerText) : null,
    answerTr: r.answerTr ? decryptField(r.answerTr) : null,
    recommendedLabs: safeParse<LabRec[]>(r.recommendedLabs, []),
    recommendedImaging: safeParse<ImagingRec[]>(r.recommendedImaging, []),
    medications: safeParse<MedRec[]>(r.medications, []),
    documents: (r.documents ?? []).map((d) => ({
      id: d.id,
      label: d.label,
      mime: d.mime,
      docType: d.docType,
      aiSummary: d.aiSummary ? decryptField(d.aiSummary) : null,
      aiTranslation: d.aiTranslation ? decryptField(d.aiTranslation) : null,
      aiFlags: d.aiFlags ? decryptField(d.aiFlags) : null,
      aiLabs: safeParse<LabRow[]>(d.aiLabs, []),
      assessed: !!d.assessedAt,
    })),
    paymentSim: r.paymentSim,
    answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

const DOC_SELECT = { id: true, label: true, mime: true, docType: true, aiSummary: true, aiTranslation: true, aiFlags: true, aiLabs: true, assessedAt: true } as const;
// Liste görünümleri (partner "taleplerim" + doktor "yanıtladıklarım") belge AI metinlerini
// (aiSummary/aiTranslation/aiFlags/aiLabs) GÖSTERMEZ → yalnız sayı/tür için hafif select (şifreli blob taşınmaz).
const DOC_SELECT_LITE = { id: true, label: true, mime: true, docType: true, assessedAt: true } as const;

// Doktorun görebileceği AÇIK talepler (genel havuz + kendi branşı) — belge AI içeriğiyle.
// excludeDoctorId (v6.33 Faz 3): doktorun KENDİ vakasından açtığı talepler kendisine gösterilmez
// (kendi vakasına kendisi görüş vermesin); diğer doktorlar normal görür.
export async function openRequestsForDoctor(branch: string, excludeDoctorId?: string): Promise<ConsultReqView[]> {
  const rows = await db.consultationRequest.findMany({
    where: {
      status: "OPEN",
      OR: [{ branch: null }, { branch }],
      ...(excludeDoctorId ? { NOT: { requestedByDoctorId: excludeDoctorId } } : {}),
    },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    include: { documents: { select: DOC_SELECT } },
  });
  return rows.map(toView);
}

export async function openCountForDoctor(branch: string, excludeDoctorId?: string): Promise<number> {
  return db.consultationRequest.count({
    where: {
      status: "OPEN",
      OR: [{ branch: null }, { branch }],
      ...(excludeDoctorId ? { NOT: { requestedByDoctorId: excludeDoctorId } } : {}),
    },
  });
}

// Tek talep + belgeler (FHIR endpoint + doktor detayı). docLabs = tüm belgelerin AI labları birleşik.
export async function getRequestWithDocs(id: string): Promise<ConsultReqView | null> {
  const r = await db.consultationRequest.findUnique({ where: { id }, include: { documents: { select: DOC_SELECT } } });
  return r ? toView(r) : null;
}

// ── Partner doktorun kendi talepleri + yanıtlayan doktor ──
export interface PartnerRequestView extends ConsultReqView {
  answeredByDoctorName: string | null;
}

export async function requestsByPartner(partnerId: string): Promise<PartnerRequestView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { requestedByPartnerId: partnerId },
    orderBy: { createdAt: "desc" },
    take: 100, // emniyet tavanı — partner panelinde TEK liste var (detay sayfası yok); dar tavan aktif OPEN/ANSWERED talepleri kalıcı gizlerdi
    include: { documents: { select: DOC_SELECT_LITE } }, // listede yalnız belge sayısı/türü gösterilir
  });
  const docIds = [...new Set(rows.map((r) => r.answeredByDoctorId).filter((x): x is string => !!x))];
  const docs = docIds.length ? await db.doctor.findMany({ where: { id: { in: docIds } }, select: { id: true, title: true, name: true } }) : [];
  const docMap = new Map(docs.map((d) => [d.id, `${d.title} ${d.name}`]));
  return rows.map((r) => ({ ...toView(r), answeredByDoctorName: r.answeredByDoctorId ? docMap.get(r.answeredByDoctorId) ?? null : null }));
}

export async function answeredByDoctor(doctorId: string): Promise<ConsultReqView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { answeredByDoctorId: doctorId, status: "ANSWERED" },
    orderBy: { answeredAt: "desc" },
    take: 20, // liste emniyet tavanı (en güncel yanıtlar)
    include: { documents: { select: DOC_SELECT_LITE } }, // "Yanıtladıklarım" belge içeriği göstermez
  });
  return rows.map(toView);
}

// Kümülatif hakediş istatistiği — liste take'le sınırlı olduğundan reduce İLE HESAPLANMAZ (v4.17 bulgusu)
export async function answeredStatsForDoctor(doctorId: string): Promise<{ count: number; totalEarned: number }> {
  const agg = await db.consultationRequest.aggregate({
    where: { answeredByDoctorId: doctorId, status: "ANSWERED" },
    _count: true,
    _sum: { paymentSim: true },
  });
  return { count: agg._count, totalEarned: agg._sum.paymentSim ?? 0 };
}

// ── Doktor görüş verir (+ yapılandırılmış kodlu öneriler + görüş hasta diline çevrilir) ──
export interface AnswerInput {
  text: string;
  recommendedLabs?: LabRec[];
  recommendedImaging?: ImagingRec[];
  medications?: MedRec[];
}

export async function answerRequest(id: string, doctorId: string, input: AnswerInput): Promise<"OK" | "TAKEN" | "NOT_FOUND" | "EMPTY"> {
  const clean = (input.text || "").trim();
  if (!clean) return "EMPTY";
  const req = await db.consultationRequest.findUnique({
    where: { id },
    select: { status: true, language: true, requestedByPartnerId: true, requestedByDoctorId: true, sourceCaseId: true, branch: true, engagedByDoctorId: true },
  });
  if (!req) return "NOT_FOUND";
  // OPEN (doğrudan yanıt) VEYA IN_DISCUSSION ama bu doktor sahiplenmişse yanıtlanabilir; başka durum/sahip → TAKEN.
  if (req.status === "ANSWERED") return "TAKEN";
  if (req.status === "IN_DISCUSSION" && req.engagedByDoctorId !== doctorId) return "TAKEN";

  // Görüş hasta diline çevrilir (TR ise no-op). Çeviri talebe bağlanmadan önce yapılır (DB kilidini kısa tut).
  let answerTr: string | null = null;
  if (req.language && req.language.toLowerCase() !== "türkçe") {
    try {
      const t = await translateText(clean.slice(0, 5000), req.language);
      if (t) answerTr = t;
    } catch (e) {
      console.warn("[consult-ai] görüş çeviri hatası:", e instanceof Error ? e.message : e);
    }
  }

  const labs = (input.recommendedLabs ?? []).filter((r) => r && (r.loinc || r.name));
  const imaging = (input.recommendedImaging ?? []).filter((r) => r && (r.code || r.name));
  const meds = (input.medications ?? []).filter((m) => m && m.atc); // ATC zorunlu

  const claimed = await db.consultationRequest.updateMany({
    // OPEN'ı doğrudan kap VEYA kendi sahiplendiğim IN_DISCUSSION'ı yanıtla (başka doktorun sahiplendiği eşleşmez → yarış-güvenli).
    where: { id, OR: [{ status: "OPEN" }, { status: "IN_DISCUSSION", engagedByDoctorId: doctorId }] },
    data: {
      status: "ANSWERED",
      answeredByDoctorId: doctorId,
      engagedByDoctorId: doctorId,
      answerText: encryptField(clean.slice(0, 5000)),
      answerTr: answerTr ? encryptField(answerTr) : null,
      recommendedLabs: labs.length ? JSON.stringify(labs) : null,
      recommendedImaging: imaging.length ? JSON.stringify(imaging) : null,
      medications: meds.length ? JSON.stringify(meds) : null,
      paymentSim: PAYMENT_PER_ANSWER,
      answeredAt: new Date(),
    },
  });
  if (claimed.count === 0) return "TAKEN";

  // Talebi açan Partner doktora KİŞİSEL bildirim (yalnız konsültasyon yanıtlandığında).
  // Partner zilinde kendi diline çevrilerek gösterilir (i18n); jenerik metin, kişisel/klinik veri taşımaz.
  if (req.requestedByPartnerId) {
    try {
      const pu = await db.user.findFirst({
        where: { role: "PARTNER", partnerId: req.requestedByPartnerId },
        select: { id: true },
      });
      if (pu) {
        await notifyUser(pu.id, {
          type: "CONSULT_ANSWERED",
          title: "💬 Konsültasyon görüşünüz hazır",
          body: `${req.branch ?? "Genel"} · uzman görüşü geldi`,
          href: "/partner",
        });
      }
    } catch (e) {
      console.warn("[consult] partner bildirimi yazılamadı:", e instanceof Error ? e.message : e);
    }
  }
  // İç vakadan açılan talep (v6.33 Faz 3): açan platform doktoruna bildirim — görüş vaka sayfasında.
  if (req.requestedByDoctorId) {
    try {
      await notifyDoctorById(req.requestedByDoctorId, {
        type: "CONSULT_ANSWERED",
        title: "💬 Havuz görüşü hazır",
        body: `${req.branch ?? "Genel"} · vakanız için uzman görüşü geldi`,
        href: req.sourceCaseId ? `/doktor/vaka/${req.sourceCaseId}` : "/doktor/konsultasyon",
      });
    } catch (e) {
      console.warn("[consult] iç-doktor bildirimi yazılamadı:", e instanceof Error ? e.message : e);
    }
  }
  await publishLiveNudge("consult"); // açık chat/video panelleri yanıt durumunu anında çeksin (v6.33)
  return "OK";
}

// ── Faz 2: Yazılı görüşme (chat) + AI oto-çeviri ──
export type ChatSenderRole = "PARTNER" | "DOCTOR";
export type ChatSender = { role: "PARTNER"; partnerId: string } | { role: "DOCTOR"; doctorId: string };

export interface ChatMsgView {
  id: string;
  mine: boolean; // viewer === gönderen
  senderRole: ChatSenderRole;
  text: string; // viewer diline uygun (kendi mesajı=body · karşı taraf=translated||body)
  createdAt: string;
}

export type SendResult = "OK" | "EMPTY" | "NOT_FOUND" | "FORBIDDEN" | "TAKEN" | "NOT_READY";

const MSG_MAX = 4000;

// Mesaj gönder — sahiplik/yarış-güvenli + AI oto-çeviri (DOCTOR→partner dili · PARTNER→Türkçe).
export async function sendMessage(requestId: string, sender: ChatSender, text: string): Promise<SendResult> {
  const clean = (text || "").trim().slice(0, MSG_MAX);
  if (!clean) return "EMPTY";

  const req = await db.consultationRequest.findUnique({
    where: { id: requestId },
    select: { status: true, language: true, branch: true, requestedByPartnerId: true, engagedByDoctorId: true },
  });
  if (!req) return "NOT_FOUND";

  let translated: string | null = null;
  const needsTr = !!req.language && req.language.toLowerCase() !== "türkçe";

  if (sender.role === "PARTNER") {
    if (req.requestedByPartnerId !== sender.partnerId) return "FORBIDDEN";
    if (req.status === "OPEN") return "NOT_READY"; // henüz doktor sahiplenmedi → sohbet edilecek taraf yok
    if (needsTr) { // partner kaynak = talep dili → doktor için Türkçe
      try { translated = (await translateText(clean, "Türkçe")) || null; }
      catch (e) { console.warn("[consult-chat] çeviri hatası:", e instanceof Error ? e.message : e); }
    }
  } else {
    // DOCTOR — OPEN ise atomik sahiplen (IN_DISCUSSION); başka doktorun sahiplendiği → engelle.
    if (req.status === "OPEN") {
      const claimed = await db.consultationRequest.updateMany({
        where: { id: requestId, status: "OPEN" },
        data: { status: "IN_DISCUSSION", engagedByDoctorId: sender.doctorId },
      });
      if (claimed.count === 0) return "TAKEN";
    } else if (req.engagedByDoctorId !== sender.doctorId) {
      return "FORBIDDEN";
    }
    if (needsTr) { // doktor kaynak = Türkçe → partner dili
      try { translated = (await translateText(clean, req.language)) || null; }
      catch (e) { console.warn("[consult-chat] çeviri hatası:", e instanceof Error ? e.message : e); }
    }
  }

  await db.consultationMessage.create({
    data: {
      requestId,
      senderRole: sender.role,
      body: encryptField(clean),
      translated: translated ? encryptField(translated) : null,
    },
  });

  // Alıcıya kişisel bildirim (jenerik metin — klinik içerik yok). Partner zilinde kendi dilinde (i18n).
  try {
    const base = { type: "CONSULT_MESSAGE" as const, title: "💬 Konsültasyon mesajı", body: `${req.branch ?? "Genel"} · yeni mesaj` };
    if (sender.role === "DOCTOR" && req.requestedByPartnerId) {
      const pu = await db.user.findFirst({ where: { role: "PARTNER", partnerId: req.requestedByPartnerId }, select: { id: true } });
      if (pu) await notifyUser(pu.id, { ...base, href: "/partner" });
    } else if (sender.role === "PARTNER" && req.engagedByDoctorId) {
      await notifyDoctorById(req.engagedByDoctorId, { ...base, href: "/doktor/konsultasyon" });
    }
  } catch (e) {
    console.warn("[consult-chat] mesaj bildirimi yazılamadı:", e instanceof Error ? e.message : e);
  }
  await publishLiveNudge("consult"); // açık chat panelleri yeni mesajı anında çeksin (v6.33)
  return "OK";
}

// Thread — viewer kendi mesajında body, karşı tarafta translated (yoksa body) görür. Hepsi at-rest çözülür.
export async function messagesFor(requestId: string, viewerRole: ChatSenderRole): Promise<ChatMsgView[]> {
  const rows = await db.consultationMessage.findMany({ where: { requestId }, orderBy: { createdAt: "asc" } });
  return rows.map((m) => {
    const mine = m.senderRole === viewerRole;
    const text = mine ? decryptField(m.body) : m.translated ? decryptField(m.translated) : decryptField(m.body);
    return { id: m.id, mine, senderRole: m.senderRole as ChatSenderRole, text, createdAt: m.createdAt.toISOString() };
  });
}

// Alıcı thread'i açınca karşı tarafın okunmamışlarını okundu işaretle.
export async function markMessagesRead(requestId: string, viewerRole: ChatSenderRole): Promise<void> {
  await db.consultationMessage.updateMany({
    where: { requestId, senderRole: { not: viewerRole }, readAt: null },
    data: { readAt: new Date() },
  });
}

// Doktorun sahiplendiği, henüz nihai görüş vermediği görüşmeler (IN_DISCUSSION).
export async function engagedByDoctor(doctorId: string): Promise<ConsultReqView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { status: "IN_DISCUSSION", engagedByDoctorId: doctorId },
    orderBy: { createdAt: "desc" },
    include: { documents: { select: DOC_SELECT } },
  });
  return rows.map(toView);
}
