// Ücretsiz Sağlık Hizmeti — gönüllü ücretsiz konsültasyon: durum makinesi, eşleştirme, kota, badge.
// Mevcut `Case` (freeCare bayrağı) + `Doctor` (freeCareState) yeniden kullanılır; ayrı tablo yok.
// Bekleme havuzu türetilir: Case{freeCare,freeCareStatus:"WAITING"} ↔ Doctor{freeCareState:"AVAILABLE"}.
import { db } from "./db";
import { notifyUser } from "./notify";
import { publishLiveNudge } from "./ably-server";

// Etiketler istemci-güvenli ayrı dosyada (bu modül notify/push'a bağlı → client bundle'a girmemeli).
export { FREE_CARE_STATES, DOCTOR_FC_STATES } from "./free-care-labels";

// "Görüşme tamamlandı"dan sonraki durumlar (badge/sayım için)
const POST_CONSULT = ["CONSULT_DONE", "TREATMENT_NEEDED", "ETHICS_REVIEW", "ETHICS_REJECTED", "ETHICS_APPROVED", "COMPLETED"];
const TREATMENT_PATH = ["TREATMENT_NEEDED", "ETHICS_REVIEW", "ETHICS_APPROVED", "COMPLETED"];

// Takvim haftası başlangıcı (ISO: Pazartesi 00:00, sunucu saatiyle — kota için yeterli)
function weekStart(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Pzt=0 … Paz=6
  x.setDate(x.getDate() - day);
  return x;
}

type DoctorQuotaFields = { freeCareQuota: number; freeCareUsed: number; freeCareResetAt: Date | null };

// Kota durumu (yan etkisiz). Yeni haftaysa `used` mantıken 0; gerçek yazım availability/pairing anında.
export function quotaInfo(doc: DoctorQuotaFields): { used: number; quota: number; left: number; needsReset: boolean } {
  const ws = weekStart();
  const needsReset = !doc.freeCareResetAt || doc.freeCareResetAt < ws;
  const used = needsReset ? 0 : doc.freeCareUsed;
  return { used, quota: doc.freeCareQuota, left: Math.max(0, doc.freeCareQuota - used), needsReset };
}

// NOT: Dil ARTIK eşleştirme kriteri değil — simultane tercüme altyapısı dil farkını kapatır
// (hasta-doktor dil ayrımı gözetmeden eşleşir). Eski `langMatch`/`langList` filtresi kaldırıldı.

export interface PairResult {
  consultationId: string;
  caseId: string;
  doctorId: string;
}

// Bir vaka ile bir doktoru ATOMİK eşleştir. Koşullu updateMany'ler optimistik kilit görevi görür:
// aynı vakayı/hekimi kapmaya çalışan ikinci işlem count=0 alır → çift-eşleşme yarışı engellenir.
// 🔒 verified simetrisi: hasta-yüzü (matchForCase) zaten verified filtreli — MERKEZİ kapı burada da
// zorunlu ki doğrulanmamış doktor bekleyen hastayı kapıp vakayı kilitleyemesin.
export async function pairCaseWithDoctor(caseId: string, doctorId: string): Promise<PairResult | null> {
  try {
    const result = await db.$transaction(async (tx) => {
      const d = await tx.doctor.findUnique({ where: { id: doctorId } });
      if (!d || d.verified !== true || d.freeCareState !== "AVAILABLE") return null;
      const q = quotaInfo(d);
      if (q.left <= 0) return null;

      // 1) Vakayı kap: yalnız hâlâ WAITING ise (UPDATE satır kilidi işlemleri sıraya sokar)
      const claimedCase = await tx.case.updateMany({
        where: { id: caseId, freeCare: true, freeCareStatus: "WAITING" },
        data: { doctorId, status: "IN_CONSULT", freeCareStatus: "IN_CONSULT" },
      });
      if (claimedCase.count === 0) return null; // başka eşleşme kaptı

      // 2) Doktoru kap: yalnız hâlâ AVAILABLE ise + kota artışı
      const claimedDoc = await tx.doctor.updateMany({
        where: { id: doctorId, freeCareState: "AVAILABLE" },
        data: {
          freeCareState: "IN_SESSION",
          freeCareUsed: (q.needsReset ? 0 : d.freeCareUsed) + 1,
          freeCareResetAt: q.needsReset ? weekStart() : (d.freeCareResetAt ?? weekStart()),
        },
      });
      if (claimedDoc.count === 0) throw new Error("doctor-claim-failed"); // vakayı geri al (rollback)

      const consult = await tx.consultation.create({ data: { caseId, doctorId } });
      return { consultationId: consult.id, caseId, doctorId } as PairResult;
    });
    if (result) {
      // Eşleşen hastaya kişisel bildirim (poll zaten yönlendirir; tarayıcı arkaplandaysa push düşer)
      const c = await db.case.findUnique({ where: { id: result.caseId }, select: { userId: true, branch: true } });
      if (c?.userId) {
        await notifyUser(c.userId, {
          type: "FREECARE_MATCH",
          title: "🎥 Gönüllü doktorunuz hazır",
          body: `${c.branch} · görüşme başlıyor`,
          href: `/gorusme/${result.consultationId}`,
        });
      }
      await publishLiveNudge("free-care"); // bekleme odası + doktor konsolu anında tazelensin (v6.28)
    }
    return result;
  } catch (e) {
    if (e instanceof Error && e.message === "doctor-claim-failed") return null;
    console.warn("[free-care] eşleştirme hatası:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Hasta tarafı: bu bekleyen vaka için müsait+kotalı bir doktor bul ve eşleştir.
export async function matchForCase(caseId: string): Promise<PairResult | null> {
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || !c.freeCare || c.freeCareStatus !== "WAITING") return null;
  const candidates = await db.doctor.findMany({
    where: { freeCareState: "AVAILABLE", verified: true },
    orderBy: { freeCareAvailableAt: "asc" }, // en uzun süredir müsait olan doktor önce
  });
  for (const d of candidates) {
    if (quotaInfo(d).left <= 0) continue;
    const r = await pairCaseWithDoctor(caseId, d.id);
    if (r) return r;
  }
  return null;
}

// Doktor tarafı: en eski bekleyen uygun vakayı bul ve eşleştir (adil FIFO sırası).
// 🔒 Yalnız DOĞRULANMIŞ (verified) doktor eşleşebilir — hasta-yüzü matchForCase ile simetrik.
export async function matchForDoctor(doctorId: string): Promise<PairResult | null> {
  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!d || d.verified !== true || d.freeCareState !== "AVAILABLE" || quotaInfo(d).left <= 0) return null;
  const waiting = await db.case.findMany({
    where: { freeCare: true, freeCareStatus: "WAITING" },
    orderBy: { createdAt: "asc" },
  });
  for (const c of waiting) {
    const r = await pairCaseWithDoctor(c.id, doctorId);
    if (r) return r;
  }
  return null;
}

// Doktor müsaitlik aç/kapa. Açarken yeni haftaysa kota sıfırlanır.
export async function setDoctorAvailable(doctorId: string, available: boolean): Promise<void> {
  const d = await db.doctor.findUnique({ where: { id: doctorId } });
  if (!d) return;
  // Görüşmedeyken müsaitlik değiştirilemez (önce görüşme sonucu işlenmeli)
  if (d.freeCareState === "IN_SESSION") return;
  if (available) {
    const q = quotaInfo(d);
    await db.doctor.update({
      where: { id: doctorId },
      data: {
        freeCareState: "AVAILABLE",
        freeCareAvailableAt: new Date(),
        freeCareUsed: q.needsReset ? 0 : d.freeCareUsed,
        freeCareResetAt: q.needsReset ? weekStart() : (d.freeCareResetAt ?? weekStart()),
      },
    });
  } else {
    await db.doctor.update({ where: { id: doctorId }, data: { freeCareState: "OFFLINE" } });
  }
  await publishLiveNudge("free-care"); // çevrimiçi gönüllü sayısı değişti (v6.28)
}

// Görüşme sonrası doktoru serbest bırak (IN_SESSION → OFFLINE). Sonraki hasta için tekrar "Müsait ol".
export async function releaseDoctor(doctorId: string): Promise<void> {
  await db.doctor.updateMany({
    where: { id: doctorId, freeCareState: "IN_SESSION" },
    data: { freeCareState: "OFFLINE" },
  });
  await publishLiveNudge("free-care"); // doktor durumu değişti (v6.28)
}

// Bekleyen vaka sayısı (doktor konsolu göstergesi)
export async function waitingCount(): Promise<number> {
  return db.case.count({ where: { freeCare: true, freeCareStatus: "WAITING" } });
}

// Şu an ücretsiz sağlık hizmeti hizmeti için MÜSAİT (yeni hasta alabilecek) doktor sayısı.
// Hasta tarafı "Başvur" butonunun aktifliği + çevrimiçi/çevrimdışı indikatörü buna bağlı.
export async function availableDoctorCount(): Promise<number> {
  // verified filtresi eşleşme yüklemiyle (matchForCase) BİREBİR aynı olmalı — aksi halde sayaç
  // doğrulanmamış AVAILABLE kalıntısını sayar: hasta "çevrimiçi doktor var" görüp başvurur,
  // eşleşme asla gelmez, stranded bildirimi de (count>0 erken dönüş) hiç gitmez (v4.19 bulgusu).
  return db.doctor.count({ where: { freeCareState: "AVAILABLE", verified: true } });
}

// Tüm gönüllü doktorlar çevrimdışı olduğunda havuzda BEKLEYEN hastalara haber ver.
// (Tarayıcı açıksa zaten poll yönlendirir; kapalıysa push düşer — bildirime izin verildiyse.)
export async function notifyStrandedWaiters(): Promise<void> {
  if ((await availableDoctorCount()) > 0) return; // hâlâ müsait doktor var → kimse stranded değil
  const waiting = await db.case.findMany({
    where: { freeCare: true, freeCareStatus: "WAITING", userId: { not: null } },
    select: { id: true, userId: true },
  });
  for (const w of waiting) {
    if (!w.userId) continue;
    await notifyUser(w.userId, {
      type: "FREECARE_MATCH",
      title: "⏳ Gönüllü doktor şu an çevrimdışı",
      body: "Hâlâ havuzdasınız. Bir gönüllü doktor çevrimiçi olduğunda size bildirim göndereceğiz.",
      href: `/ucretsiz-saglik/bekleme?caseId=${w.id}`,
    });
  }
}

// Bir bekleyen vakanın kuyruktaki sırası (1 tabanlı) — hasta bekleme ekranı için
export async function queuePosition(caseId: string, createdAt: Date): Promise<number> {
  const ahead = await db.case.count({
    where: { freeCare: true, freeCareStatus: "WAITING", createdAt: { lt: createdAt } },
  });
  return ahead + 1;
}

// İtibar sayaçları — render-zamanı türetilir (ayrı tablo yok)
export async function badgeStats(doctorId: string): Promise<{ consultations: number; converted: number }> {
  const [consultations, converted] = await Promise.all([
    db.case.count({ where: { freeCare: true, doctorId, freeCareStatus: { in: POST_CONSULT } } }),
    db.case.count({ where: { freeCare: true, doctorId, freeCareStatus: { in: TREATMENT_PATH } } }),
  ]);
  return { consultations, converted };
}
