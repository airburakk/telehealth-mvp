// M5 — Konsültasyon Talepleri havuzu servisi.
// Partner doktor bir vakayı ANONİMLEŞTİREREK havuza yazar; kayıtlı hekimler (consultOptIn) görüş verir.
// Klinik içerik (clinicalSummary/answerText/belge AI/öneriler) at-rest şifrelidir (lib/crypto).
// Faz 1 (v3.x): belge yükleme + assessDocument AI değerlendirme/FHIR + çift-yönlü çeviri
// (özet→TR yanıtlayan hekim için · görüş→hasta dili partnere) + yapılandırılmış kodlu öneriler.
import { db } from "./db";
import { encryptField, decryptField } from "./crypto";
import { deidentifyCase, scrubText } from "./deidentify";
import { translateText, assessDocument } from "./ai-clinical";
import { loincForBranchLabel } from "@/data/coding";

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

// Bir vakadan anonim konsültasyon talebi oluştur (Faz 2 demo seed kullanır).
export async function createRequestFromCase(
  caseId: string,
  opts: { branchLimited?: boolean; requestedByName?: string; requestedByPartnerId?: string } = {},
): Promise<string | null> {
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) return null;
  const deid = deidentifyCase(c);
  const created = await db.consultationRequest.create({
    data: {
      sourceCaseId: c.id,
      requestedByPartnerId: opts.requestedByPartnerId ?? null,
      requestedByName: opts.requestedByName ?? null,
      branch: opts.branchLimited ? c.branch : null,
      region: deid.region,
      language: deid.language,
      urgency: deid.urgency,
      icd10Code: deid.icd10Code,
      clinicalSummary: encryptField(deid.clinicalSummary),
      status: "OPEN",
    },
  });
  return created.id;
}

// ── Partner formundan anonim talep (+ opsiyonel belgeler) ──
export interface PartnerDocInput {
  label: string;
  mime: string;
  dataUrl: string; // base64 data URL
}

export interface PartnerRequestInput {
  partnerId: string;
  partnerName: string;
  branchLimited: boolean;
  branch?: string | null;
  region: string;
  language: string;
  urgency: number;
  icd10Code?: string | null;
  clinicalSummary: string;
}

export async function createRequestFromInput(input: PartnerRequestInput, documents: PartnerDocInput[] = []): Promise<string> {
  const summary = scrubText(input.clinicalSummary.trim().slice(0, 5000), []); // savunma amaçlı satır-içi temizlik
  const created = await db.consultationRequest.create({
    data: {
      requestedByPartnerId: input.partnerId,
      requestedByName: input.partnerName,
      branch: input.branchLimited ? input.branch ?? null : null,
      region: input.region,
      language: input.language,
      urgency: clampUrgency(input.urgency),
      icd10Code: input.icd10Code?.trim() || null,
      clinicalSummary: encryptField(summary),
      status: "OPEN",
    },
  });
  // Belgeler ham (şifreli) yazılır; AI değerlendirmesi processRequestAi'da yapılır.
  for (const d of documents.slice(0, 8)) {
    if (!d?.dataUrl) continue;
    await db.consultationRequestDocument.create({
      data: { requestId: created.id, label: (d.label || "belge").slice(0, 200), mime: d.mime || "application/octet-stream", fileData: encryptField(d.dataUrl) },
    });
  }
  return created.id;
}

// AI işleme: klinik özeti Türkçeye çevir (yanıtlayan hekim için) + her belgeyi assessDocument ile değerlendir.
// Triyaj analyze-docs deseni: docType + TR çeviri + özet + bayrak + LOINC labs. Hatalı belge atlanır.
export async function processRequestAi(requestId: string): Promise<void> {
  const r = await db.consultationRequest.findUnique({ where: { id: requestId }, include: { documents: true } });
  if (!r) return;

  if (!r.summaryTr) {
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
    try {
      const a = await assessDocument(decryptField(d.fileData), {
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
  summaryTr: string | null; // Türkçe (yanıtlayan hekim için)
  requestedByName: string | null;
  status: string;
  answerText: string | null; // hekim görüşü (TR kaynak)
  answerTr: string | null; // hekim görüşü hasta dilinde (partnere)
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
  documents?: { id: string; label: string; docType: string | null; aiSummary: string | null; aiTranslation: string | null; aiFlags: string | null; aiLabs: string | null; assessedAt: Date | null }[];
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

const DOC_SELECT = { id: true, label: true, docType: true, aiSummary: true, aiTranslation: true, aiFlags: true, aiLabs: true, assessedAt: true } as const;

// Hekimin görebileceği AÇIK talepler (genel havuz + kendi branşı) — belge AI içeriğiyle.
export async function openRequestsForDoctor(branch: string): Promise<ConsultReqView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { status: "OPEN", OR: [{ branch: null }, { branch }] },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    include: { documents: { select: DOC_SELECT } },
  });
  return rows.map(toView);
}

export async function openCountForDoctor(branch: string): Promise<number> {
  return db.consultationRequest.count({ where: { status: "OPEN", OR: [{ branch: null }, { branch }] } });
}

// Tek talep + belgeler (FHIR endpoint + doktor detayı). docLabs = tüm belgelerin AI labları birleşik.
export async function getRequestWithDocs(id: string): Promise<ConsultReqView | null> {
  const r = await db.consultationRequest.findUnique({ where: { id }, include: { documents: { select: DOC_SELECT } } });
  return r ? toView(r) : null;
}

// ── Partner doktorun kendi talepleri + yanıtlayan hekim ──
export interface PartnerRequestView extends ConsultReqView {
  answeredByDoctorName: string | null;
}

export async function requestsByPartner(partnerId: string): Promise<PartnerRequestView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { requestedByPartnerId: partnerId },
    orderBy: { createdAt: "desc" },
    include: { documents: { select: DOC_SELECT } },
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
    include: { documents: { select: DOC_SELECT } },
  });
  return rows.map(toView);
}

// ── Hekim görüş verir (+ yapılandırılmış kodlu öneriler + görüş hasta diline çevrilir) ──
export interface AnswerInput {
  text: string;
  recommendedLabs?: LabRec[];
  recommendedImaging?: ImagingRec[];
  medications?: MedRec[];
}

export async function answerRequest(id: string, doctorId: string, input: AnswerInput): Promise<"OK" | "TAKEN" | "NOT_FOUND" | "EMPTY"> {
  const clean = (input.text || "").trim();
  if (!clean) return "EMPTY";
  const req = await db.consultationRequest.findUnique({ where: { id }, select: { status: true, language: true } });
  if (!req) return "NOT_FOUND";
  if (req.status !== "OPEN") return "TAKEN";

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
    where: { id, status: "OPEN" },
    data: {
      status: "ANSWERED",
      answeredByDoctorId: doctorId,
      answerText: encryptField(clean.slice(0, 5000)),
      answerTr: answerTr ? encryptField(answerTr) : null,
      recommendedLabs: labs.length ? JSON.stringify(labs) : null,
      recommendedImaging: imaging.length ? JSON.stringify(imaging) : null,
      medications: meds.length ? JSON.stringify(meds) : null,
      paymentSim: PAYMENT_PER_ANSWER,
      answeredAt: new Date(),
    },
  });
  return claimed.count === 0 ? "TAKEN" : "OK";
}
