// M5 Faz 2 — Konsültasyon Talepleri havuzu servisi.
// Partner doktor bir vakayı ANONİMLEŞTİREREK havuza yazar; kayıtlı hekimler (consultOptIn) görüş verir.
// Klinik içerik (clinicalSummary/answerText) at-rest şifrelidir (lib/crypto). Yanıt başına ödeme simüledir.
import { db } from "./db";
import { encryptField, decryptField } from "./crypto";
import { deidentifyCase, scrubText } from "./deidentify";

export const PAYMENT_PER_ANSWER = 50; // USD — yanıt başına ödeme (simüle)

function clampUrgency(u: number): number {
  return Math.min(5, Math.max(1, Math.round(Number(u) || 3)));
}

// Bir vakadan anonim konsültasyon talebi oluştur (Faz 2 demo seed kullanır).
// branchLimited=true → yalnız vakanın branşı görür; false → genel havuz.
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
      clinicalSummary: encryptField(deid.clinicalSummary), // klinik içerik → at-rest şifreli
      status: "OPEN",
    },
  });
  return created.id;
}

// M5 Faz 3 — Partner doktor formundan anonim talep oluştur. Partner kendi yönlendirdiği hastanın
// bilgisini girer; serbest metin scrubText'ten geçirilir (satır-içi ad/kimlik kazara girilmişse maskelenir).
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

export async function createRequestFromInput(input: PartnerRequestInput): Promise<string> {
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
  return created.id;
}

export interface ConsultReqView {
  id: string;
  branch: string | null; // null = genel havuz
  region: string;
  language: string;
  urgency: number;
  icd10Code: string | null;
  clinicalSummary: string; // çözülmüş
  requestedByName: string | null;
  status: string;
  answerText: string | null;
  paymentSim: number | null;
  answeredAt: string | null;
  createdAt: string;
}

function toView(r: {
  id: string; branch: string | null; region: string; language: string; urgency: number;
  icd10Code: string | null; clinicalSummary: string; requestedByName: string | null; status: string;
  answerText: string | null; paymentSim: number | null; answeredAt: Date | null; createdAt: Date;
}): ConsultReqView {
  return {
    id: r.id,
    branch: r.branch,
    region: r.region,
    language: r.language,
    urgency: r.urgency,
    icd10Code: r.icd10Code,
    clinicalSummary: decryptField(r.clinicalSummary),
    requestedByName: r.requestedByName,
    status: r.status,
    answerText: r.answerText ? decryptField(r.answerText) : null,
    paymentSim: r.paymentSim,
    answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

// Hekimin görebileceği AÇIK talepler: genel havuz (branch=null) + kendi branşı. Aciliyet sonra güncellik.
export async function openRequestsForDoctor(branch: string): Promise<ConsultReqView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { status: "OPEN", OR: [{ branch: null }, { branch }] },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toView);
}

// Açık talep sayısı (panel rozeti).
export async function openCountForDoctor(branch: string): Promise<number> {
  return db.consultationRequest.count({ where: { status: "OPEN", OR: [{ branch: null }, { branch }] } });
}

// M5 Faz 3 — Partner doktorun kendi açtığı talepler + (yanıtlandıysa) alınan görüş ve yanıtlayan hekim.
export interface PartnerRequestView extends ConsultReqView {
  answeredByDoctorName: string | null;
}

export async function requestsByPartner(partnerId: string): Promise<PartnerRequestView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { requestedByPartnerId: partnerId },
    orderBy: { createdAt: "desc" },
  });
  const docIds = [...new Set(rows.map((r) => r.answeredByDoctorId).filter((x): x is string => !!x))];
  const docs = docIds.length ? await db.doctor.findMany({ where: { id: { in: docIds } }, select: { id: true, title: true, name: true } }) : [];
  const docMap = new Map(docs.map((d) => [d.id, `${d.title} ${d.name}`]));
  return rows.map((r) => ({
    ...toView(r),
    answeredByDoctorName: r.answeredByDoctorId ? docMap.get(r.answeredByDoctorId) ?? null : null,
  }));
}

// Hekimin yanıtladığı talepler (hakediş/geçmiş).
export async function answeredByDoctor(doctorId: string): Promise<ConsultReqView[]> {
  const rows = await db.consultationRequest.findMany({
    where: { answeredByDoctorId: doctorId, status: "ANSWERED" },
    orderBy: { answeredAt: "desc" },
  });
  return rows.map(toView);
}

// Hekim bir talebe görüş verir. Atomik: yalnız hâlâ OPEN ise (yarış-güvenli). Yanıt başına ödeme (simüle) işlenir.
export async function answerRequest(id: string, doctorId: string, text: string): Promise<"OK" | "TAKEN" | "NOT_FOUND" | "EMPTY"> {
  const clean = text.trim();
  if (!clean) return "EMPTY";
  const existing = await db.consultationRequest.findUnique({ where: { id }, select: { status: true } });
  if (!existing) return "NOT_FOUND";
  const claimed = await db.consultationRequest.updateMany({
    where: { id, status: "OPEN" },
    data: {
      status: "ANSWERED",
      answeredByDoctorId: doctorId,
      answerText: encryptField(clean.slice(0, 5000)),
      paymentSim: PAYMENT_PER_ANSWER,
      answeredAt: new Date(),
    },
  });
  return claimed.count === 0 ? "TAKEN" : "OK";
}
