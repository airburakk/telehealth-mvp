// Pro Bono — gönüllü ücretsiz konsültasyon: durum makinesi, eşleştirme, kota, badge.
// Mevcut `Case` (proBono bayrağı) + `Doctor` (proBonoState) yeniden kullanılır; ayrı tablo yok.
// Bekleme havuzu türetilir: Case{proBono,proBonoStatus:"WAITING"} ↔ Doctor{proBonoState:"AVAILABLE"}.
import { db } from "./db";
import { notifyUser } from "./notify";

// Etiketler istemci-güvenli ayrı dosyada (bu modül notify/push'a bağlı → client bundle'a girmemeli).
export { PRO_BONO_STATES, DOCTOR_PB_STATES } from "./pro-bono-labels";

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

type DoctorQuotaFields = { proBonoQuota: number; proBonoUsed: number; proBonoResetAt: Date | null };

// Kota durumu (yan etkisiz). Yeni haftaysa `used` mantıken 0; gerçek yazım availability/pairing anında.
export function quotaInfo(doc: DoctorQuotaFields): { used: number; quota: number; left: number; needsReset: boolean } {
  const ws = weekStart();
  const needsReset = !doc.proBonoResetAt || doc.proBonoResetAt < ws;
  const used = needsReset ? 0 : doc.proBonoUsed;
  return { used, quota: doc.proBonoQuota, left: Math.max(0, doc.proBonoQuota - used), needsReset };
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
      if (!d || d.verified !== true || d.proBonoState !== "AVAILABLE") return null;
      const q = quotaInfo(d);
      if (q.left <= 0) return null;

      // 1) Vakayı kap: yalnız hâlâ WAITING ise (UPDATE satır kilidi işlemleri sıraya sokar)
      const claimedCase = await tx.case.updateMany({
        where: { id: caseId, proBono: true, proBonoStatus: "WAITING" },
        data: { doctorId, status: "IN_CONSULT", proBonoStatus: "IN_CONSULT" },
      });
      if (claimedCase.count === 0) return null; // başka eşleşme kaptı

      // 2) Doktoru kap: yalnız hâlâ AVAILABLE ise + kota artışı
      const claimedDoc = await tx.doctor.updateMany({
        where: { id: doctorId, proBonoState: "AVAILABLE" },
        data: {
          proBonoState: "IN_SESSION",
          proBonoUsed: (q.needsReset ? 0 : d.proBonoUsed) + 1,
          proBonoResetAt: q.needsReset ? weekStart() : (d.proBonoResetAt ?? weekStart()),
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
          type: "PROBONO_MATCH",
          title: "🎥 Gönüllü doktorunuz hazır",
          body: `${c.branch} · görüşme başlıyor`,
          href: `/gorusme/${result.consultationId}`,
        });
      }
    }
    return result;
  } catch (e) {
    if (e instanceof Error && e.message === "doctor-claim-failed") return null;
    console.warn("[pro-bono] eşleştirme hatası:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Hasta tarafı: bu bekleyen vaka için müsait+kotalı bir doktor bul ve eşleştir.
export async function matchForCase(caseId: string): Promise<PairResult | null> {
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || !c.proBono || c.proBonoStatus !== "WAITING") return null;
  const candidates = await db.doctor.findMany({
    where: { proBonoState: "AVAILABLE", verified: true },
    orderBy: { proBonoAvailableAt: "asc" }, // en uzun süredir müsait olan doktor önce
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
  if (!d || d.verified !== true || d.proBonoState !== "AVAILABLE" || quotaInfo(d).left <= 0) return null;
  const waiting = await db.case.findMany({
    where: { proBono: true, proBonoStatus: "WAITING" },
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
  if (d.proBonoState === "IN_SESSION") return;
  if (available) {
    const q = quotaInfo(d);
    await db.doctor.update({
      where: { id: doctorId },
      data: {
        proBonoState: "AVAILABLE",
        proBonoAvailableAt: new Date(),
        proBonoUsed: q.needsReset ? 0 : d.proBonoUsed,
        proBonoResetAt: q.needsReset ? weekStart() : (d.proBonoResetAt ?? weekStart()),
      },
    });
  } else {
    await db.doctor.update({ where: { id: doctorId }, data: { proBonoState: "OFFLINE" } });
  }
}

// Görüşme sonrası doktoru serbest bırak (IN_SESSION → OFFLINE). Sonraki hasta için tekrar "Müsait ol".
export async function releaseDoctor(doctorId: string): Promise<void> {
  await db.doctor.updateMany({
    where: { id: doctorId, proBonoState: "IN_SESSION" },
    data: { proBonoState: "OFFLINE" },
  });
}

// Bekleyen vaka sayısı (doktor konsolu göstergesi)
export async function waitingCount(): Promise<number> {
  return db.case.count({ where: { proBono: true, proBonoStatus: "WAITING" } });
}

// Şu an pro bono hizmeti için MÜSAİT (yeni hasta alabilecek) doktor sayısı.
// Hasta tarafı "Başvur" butonunun aktifliği + çevrimiçi/çevrimdışı indikatörü buna bağlı.
export async function availableDoctorCount(): Promise<number> {
  // verified filtresi eşleşme yüklemiyle (matchForCase) BİREBİR aynı olmalı — aksi halde sayaç
  // doğrulanmamış AVAILABLE kalıntısını sayar: hasta "çevrimiçi doktor var" görüp başvurur,
  // eşleşme asla gelmez, stranded bildirimi de (count>0 erken dönüş) hiç gitmez (v4.19 bulgusu).
  return db.doctor.count({ where: { proBonoState: "AVAILABLE", verified: true } });
}

// Tüm gönüllü doktorlar çevrimdışı olduğunda havuzda BEKLEYEN hastalara haber ver.
// (Tarayıcı açıksa zaten poll yönlendirir; kapalıysa push düşer — bildirime izin verildiyse.)
export async function notifyStrandedWaiters(): Promise<void> {
  if ((await availableDoctorCount()) > 0) return; // hâlâ müsait doktor var → kimse stranded değil
  const waiting = await db.case.findMany({
    where: { proBono: true, proBonoStatus: "WAITING", userId: { not: null } },
    select: { id: true, userId: true },
  });
  for (const w of waiting) {
    if (!w.userId) continue;
    await notifyUser(w.userId, {
      type: "PROBONO_MATCH",
      title: "⏳ Gönüllü doktor şu an çevrimdışı",
      body: "Hâlâ havuzdasınız. Bir gönüllü doktor çevrimiçi olduğunda size bildirim göndereceğiz.",
      href: `/pro-bono/bekleme?caseId=${w.id}`,
    });
  }
}

// Bir bekleyen vakanın kuyruktaki sırası (1 tabanlı) — hasta bekleme ekranı için
export async function queuePosition(caseId: string, createdAt: Date): Promise<number> {
  const ahead = await db.case.count({
    where: { proBono: true, proBonoStatus: "WAITING", createdAt: { lt: createdAt } },
  });
  return ahead + 1;
}

// İtibar sayaçları — render-zamanı türetilir (ayrı tablo yok)
export async function badgeStats(doctorId: string): Promise<{ consultations: number; converted: number }> {
  const [consultations, converted] = await Promise.all([
    db.case.count({ where: { proBono: true, doctorId, proBonoStatus: { in: POST_CONSULT } } }),
    db.case.count({ where: { proBono: true, doctorId, proBonoStatus: { in: TREATMENT_PATH } } }),
  ]);
  return { consultations, converted };
}
