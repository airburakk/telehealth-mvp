// Klinik nöbet/müsaitlik + "online doktor yoksa 3-seçenek kapısı" (§8 mahremiyet/akış, §3.2).
// Mevcut `Doctor` (clinicalState/onCall/sentinel) + yeni `ConsultAppointment` üzerine kurulu.
// Roller: Branş Doktoru (online, gerçek-zaman) · İcapçı (offline + icap açık → randevu) · Nöbetçi (7/24 genel/Dahiliye/Acil).
// Eşleştirme deseni Pro Bono'dan alındı: koşullu updateMany = optimistik kilit (çift-kapma yarışı engellenir).
import { db } from "./db";
import { decryptField } from "./crypto";
import { notifyUser, type NotifyInput } from "./notify";
import { formatDateTime } from "./constants";

// ───────────────────────── Kapı (gate) müsaitlik kararı ─────────────────────────

export interface GateAvailability {
  hasOnlineBranch: boolean; // branşta çevrimiçi Branş Doktoru var mı → varsa kapı GÖSTERİLMEZ
  hasSentinel: boolean; // çevrimiçi Nöbetçi var mı → Seçenek 1 etkin
  hasIcapci: boolean; // branşta icap-açık İcapçı var mı → Seçenek 2 etkin
}

// Bir branş için kapı müsaitliğini hesapla. Branş Doktoru = clinicalState ONLINE + sentinel:false.
export async function gateAvailability(branch: string): Promise<GateAvailability> {
  const [onlineBranch, sentinel, icapci] = await Promise.all([
    db.doctor.count({ where: { branch, clinicalState: "ONLINE", sentinel: false } }),
    db.doctor.count({ where: { sentinel: true, clinicalState: "ONLINE" } }),
    db.doctor.count({ where: { branch, onCall: true } }),
  ]);
  return { hasOnlineBranch: onlineBranch > 0, hasSentinel: sentinel > 0, hasIcapci: icapci > 0 };
}

// §3.4/§7: klinik aciliyet kancaları (kırmızı bayrak / post-op) artık koordinatöre DEĞİL, görevdeki
// Nöbetçi'ye (7/24 klinik yanıt) düşer. Sentinel + (ONLINE|IN_SESSION) hekimlere kişisel bildirim;
// görevde Nöbetçi yoksa sessizce geçilir (Doktor rol-yayını zaten kuyruğu kapsar).
export async function notifyOnDutySentinels(n: NotifyInput): Promise<void> {
  const sentinels = await db.doctor.findMany({
    where: { sentinel: true, clinicalState: { in: ["ONLINE", "IN_SESSION"] } },
    select: { id: true },
  });
  for (const d of sentinels) {
    const u = await db.user.findFirst({ where: { doctorId: d.id }, select: { id: true } });
    if (u) await notifyUser(u.id, n);
  }
}

// ───────────────────────── Seçenek 1: Nöbetçi ile şimdi görüş ─────────────────────────

export interface SentinelResult {
  consultationId: string;
  doctorId: string;
}

// Çevrimiçi bir Nöbetçi hekimi ATOMİK kap → konsültasyon oluştur. En uzun süredir müsait olan önce.
export async function claimSentinelForCase(caseId: string): Promise<SentinelResult | null> {
  const candidates = await db.doctor.findMany({
    where: { sentinel: true, clinicalState: "ONLINE" },
    orderBy: { clinicalAvailableAt: "asc" },
    select: { id: true },
  });
  for (const d of candidates) {
    const r = await claimOneSentinel(caseId, d.id);
    if (r) {
      const c = await db.case.findUnique({ where: { id: caseId }, select: { branch: true, patientName: true } });
      const u = await db.user.findFirst({ where: { doctorId: d.id }, select: { id: true } });
      if (u) {
        await notifyUser(u.id, {
          type: "CLINIC_MATCH",
          title: "🎥 Nöbet görüşmesi başlıyor",
          body: `${c?.branch ?? ""} · ${c?.patientName ?? "hasta"} şimdi görüşmek istiyor`,
          href: `/gorusme/${r.consultationId}`,
        });
      }
      return r;
    }
  }
  return null;
}

async function claimOneSentinel(caseId: string, doctorId: string): Promise<SentinelResult | null> {
  try {
    return await db.$transaction(async (tx) => {
      // 1) Vakayı kap: yalnız hâlâ gate aşamasındaysa (NEW/IN_REVIEW). UPDATE satır kilidi yarışı sıraya sokar.
      const claimedCase = await tx.case.updateMany({
        where: { id: caseId, status: { in: ["NEW", "IN_REVIEW"] } },
        data: { doctorId, status: "IN_CONSULT" },
      });
      if (claimedCase.count === 0) return null; // başka işlem kaptı / vaka ilerlemiş
      // 2) Nöbetçiyi kap: yalnız hâlâ ONLINE ise
      const claimedDoc = await tx.doctor.updateMany({
        where: { id: doctorId, sentinel: true, clinicalState: "ONLINE" },
        data: { clinicalState: "IN_SESSION" },
      });
      if (claimedDoc.count === 0) throw new Error("doctor-claim-failed"); // rollback → vaka geri alınır
      const consult = await tx.consultation.create({ data: { caseId, doctorId } });
      return { consultationId: consult.id, doctorId } as SentinelResult;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "doctor-claim-failed") return null;
    console.warn("[clinical-duty] nöbetçi kapma hatası:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ───────────────────────── Seçenek 2: İcapçı randevu akışı ─────────────────────────

// Hasta "Branş randevusu" seçer → talebi (yeniden) aç + branştaki İcapçı hekimlere bildir.
export async function requestIcapciAppointment(caseId: string): Promise<boolean> {
  const c = await db.case.findUnique({ where: { id: caseId }, select: { branch: true, userId: true, patientName: true } });
  if (!c) return false;
  await db.consultAppointment.upsert({
    where: { caseId },
    create: { caseId, patientId: c.userId, branch: c.branch, status: "REQUESTED" },
    update: { status: "REQUESTED", doctorId: null, proposedAt: null },
  });
  const icapci = await db.doctor.findMany({ where: { branch: c.branch, onCall: true }, select: { id: true } });
  for (const d of icapci) {
    const u = await db.user.findFirst({ where: { doctorId: d.id }, select: { id: true } });
    if (u) {
      await notifyUser(u.id, {
        type: "CLINIC_OFFER",
        title: "📋 Yeni randevu talebi",
        body: `${c.branch} · ${c.patientName} bir görüşme randevusu bekliyor`,
        href: "/doktor",
      });
    }
  }
  return true;
}

// İcapçı hekim bir zaman teklif eder. Atomik: REQUESTED (herhangi biri) veya kendi CHANGE_REQUESTED'i → OFFERED.
// İlk teklif eden kapar; ikinci hekim count=0 alır → "başkası aldı".
export async function offerAppointment(caseId: string, doctorId: string, proposedAt: Date): Promise<"OK" | "TAKEN" | "NOT_FOUND"> {
  const appt = await db.consultAppointment.findUnique({ where: { caseId } });
  if (!appt) return "NOT_FOUND";
  const claimed = await db.consultAppointment.updateMany({
    where: { caseId, OR: [{ status: "REQUESTED" }, { status: "CHANGE_REQUESTED", doctorId }] },
    data: { status: "OFFERED", doctorId, proposedAt },
  });
  if (claimed.count === 0) return "TAKEN";
  if (appt.patientId) {
    await notifyUser(appt.patientId, {
      type: "CLINIC_OFFER",
      title: "📅 Randevu teklifi",
      body: `Bir hekim görüşme için zaman önerdi: ${formatDateTime(proposedAt)}. Onaylayın veya farklı bir zaman isteyin.`,
      href: `/triyaj/${caseId}`,
    });
  }
  return "OK";
}

// Hasta teklife yanıt verir: accept → CONFIRMED (vakaya İcapçı atanır) · request_change → CHANGE_REQUESTED (aynı hekim yeniden teklif eder).
export async function respondAppointment(caseId: string, action: "accept" | "request_change"): Promise<"CONFIRMED" | "CHANGE_REQUESTED" | null> {
  const appt = await db.consultAppointment.findUnique({ where: { caseId } });
  if (!appt || appt.status !== "OFFERED") return null;
  const docUser = appt.doctorId ? await db.user.findFirst({ where: { doctorId: appt.doctorId }, select: { id: true } }) : null;
  const whenStr = appt.proposedAt ? formatDateTime(appt.proposedAt) : "";

  if (action === "accept") {
    await db.consultAppointment.update({ where: { caseId }, data: { status: "CONFIRMED" } });
    if (appt.doctorId) await db.case.update({ where: { id: caseId }, data: { doctorId: appt.doctorId } });
    if (docUser) {
      await notifyUser(docUser.id, {
        type: "CLINIC_OFFER",
        title: "✅ Randevu onaylandı",
        body: `Hasta önerdiğiniz zamanı onayladı: ${whenStr}.`,
        href: "/doktor",
      });
    }
    return "CONFIRMED";
  }

  await db.consultAppointment.update({ where: { caseId }, data: { status: "CHANGE_REQUESTED" } });
  if (docUser) {
    await notifyUser(docUser.id, {
      type: "CLINIC_OFFER",
      title: "🔁 Hasta farklı bir zaman istedi",
      body: "Önerdiğiniz randevu zamanı uygun değil — lütfen yeni bir zaman önerin.",
      href: "/doktor",
    });
  }
  return "CHANGE_REQUESTED";
}

// ───────────────────────── Seçenek 3: Sonlandır → sil + iade (simüle) ─────────────────────────

// Gate aşamasındaki vakayı ve ilişkili kayıtları siler; ödeme alındıysa iade tutarını döndürür.
// Gerçek crypto-shred (anahtar imhası) + gerçek escrow iadesi PARK (E2EE fazı / ödeme gateway).
export async function terminateCase(caseId: string): Promise<{ refunded: number } | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { consultations: { select: { id: true } }, bookings: { select: { id: true } }, recovery: { select: { id: true } } },
  });
  if (!c) return null;
  // Yalnız gate aşaması (NEW/IN_REVIEW, rezervasyon/post-op yok) güvenle silinir.
  if (!["NEW", "IN_REVIEW"].includes(c.status) || c.bookings.length > 0 || c.recovery) return null;

  await db.consultAppointment.deleteMany({ where: { caseId } });
  await db.caseDocument.deleteMany({ where: { caseId } });
  for (const cons of c.consultations) await db.signal.deleteMany({ where: { consultationId: cons.id } });
  await db.consultation.deleteMany({ where: { caseId } });
  await db.complaint.deleteMany({ where: { caseId } });
  await db.case.delete({ where: { id: caseId } });

  const refunded = c.payStatus === "PAID" && c.consultFee ? c.consultFee : 0;
  return { refunded };
}

// ───────────────────────── Doktor nöbet durumu (toggle + feed) ─────────────────────────

export interface DutyPatch {
  clinicalState?: "ONLINE" | "OFFLINE";
  onCall?: boolean;
  sentinel?: boolean;
}

// Nöbet durumunu güncelle. Görüşmedeyken (IN_SESSION) klinik mevcudiyet değiştirilemez.
// Nöbetçi (sentinel) açılınca klinik mevcudiyet otomatik ONLINE olur (7/24 görev).
export async function setClinicalDuty(doctorId: string, patch: DutyPatch): Promise<void> {
  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!d) return;
  const data: Record<string, unknown> = {};
  if (patch.sentinel !== undefined) {
    data.sentinel = patch.sentinel;
    if (patch.sentinel && d.clinicalState !== "IN_SESSION") {
      data.clinicalState = "ONLINE";
      data.clinicalAvailableAt = new Date();
    }
  }
  if (patch.onCall !== undefined) data.onCall = patch.onCall;
  if (patch.clinicalState !== undefined && d.clinicalState !== "IN_SESSION") {
    data.clinicalState = patch.clinicalState;
    if (patch.clinicalState === "ONLINE") data.clinicalAvailableAt = new Date();
  }
  if (Object.keys(data).length) await db.doctor.update({ where: { id: doctorId }, data });
}

// Görüşme sonrası hekimi serbest bırak: IN_SESSION → Nöbetçi ise ONLINE (7/24 sürer), değilse OFFLINE.
export async function releaseClinicalDoctor(doctorId: string): Promise<void> {
  const d = await db.doctor.findUnique({ where: { id: doctorId }, select: { sentinel: true, clinicalState: true } });
  if (!d || d.clinicalState !== "IN_SESSION") return;
  await db.doctor.update({
    where: { id: doctorId },
    data: d.sentinel ? { clinicalState: "ONLINE", clinicalAvailableAt: new Date() } : { clinicalState: "OFFLINE" },
  });
}

export interface DutyRequest {
  caseId: string;
  status: string; // REQUESTED | CHANGE_REQUESTED
  patientName: string;
  country: string;
  language: string;
  branch: string;
  urgency: number;
  symptoms: string;
  createdAt: string;
}

export interface DutyFeed {
  state: string;
  onCall: boolean;
  sentinel: boolean;
  branch: string;
  consultationId?: string; // Nöbetçi kapıldıysa → görüşmeye yönlendir
  requests: DutyRequest[]; // İcapçı gelen kutusu (kendi branşı)
}

// Doktor konsolu beslemesi: nöbet durumu + (Nöbetçi kapıldıysa) görüşme + İcapçı randevu talepleri.
export async function dutyFeed(doctorId: string): Promise<DutyFeed | null> {
  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!d) return null;

  let consultationId: string | undefined;
  if (d.clinicalState === "IN_SESSION") {
    const cons = await db.consultation.findFirst({ where: { doctorId, status: "ACTIVE" }, orderBy: { startedAt: "desc" }, select: { id: true } });
    if (cons) consultationId = cons.id;
  }

  // REQUESTED → tüm branş İcapçıları görür · CHANGE_REQUESTED → yalnız teklifi yapan hekim
  const appts = await db.consultAppointment.findMany({
    where: { branch: d.branch, OR: [{ status: "REQUESTED" }, { status: "CHANGE_REQUESTED", doctorId }] },
    orderBy: { createdAt: "asc" },
  });
  const cases = appts.length
    ? await db.case.findMany({ where: { id: { in: appts.map((a) => a.caseId) } } })
    : [];
  const byId = new Map(cases.map((c) => [c.id, c]));
  const requests: DutyRequest[] = appts
    .map((a) => {
      const c = byId.get(a.caseId);
      if (!c) return null;
      return {
        caseId: a.caseId,
        status: a.status,
        patientName: c.patientName,
        country: c.country,
        language: c.language,
        branch: c.branch,
        urgency: c.urgency,
        symptoms: decryptField(c.symptoms), // at-rest şifreli → İcapçı kuyruğu gösterimi için çöz
        createdAt: a.createdAt.toISOString(),
      };
    })
    .filter((x): x is DutyRequest => x !== null);

  return { state: d.clinicalState, onCall: d.onCall, sentinel: d.sentinel, branch: d.branch, consultationId, requests };
}
