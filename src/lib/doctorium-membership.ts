// Doctorium üyeliği — kapatma ve üyelikten çıkış (v6.187, kullanıcı kararı 2026-08-29).
//
// ⚖️ DOCTORIUM'DA KLİNİK KATMAN YOKTUR. Bu üründe hasta, vaka ve klinik görüş bulunmaz; üyenin
// verisi yalnız (a) kayıtta verdiği bilgiler, (b) doktorda mezun belgesi / öğrencide üniversite
// e-postası doğrulaması, (c) portalda ürettiği kişisel katman (kaydettikleri, takip/takvim,
// puanlar, akış tercihleri). Bu yüzden AURA hasta silmesindeki (lib/account-deletion) iki katmanlı
// model — "klinik kaydı kilitle, saklama süresi sonunda imha et" — BURAYA UYGULANMAZ: saklanması
// gereken klinik kayıt yok, dolayısıyla bekletmenin hukuki dayanağı da yok. Üye "kapat" dediğinde
// veri O ANDA gider; onay kuyruğu veya bekleme süresi yoktur.
//
// İKİ YOL — hesabın başka bir kulvarda kullanılıp kullanılmadığına göre:
//
//   1) closeDoctoriumAccount — YALNIZ Doctorium üyeliği olan hesap (Aşama 1 doktoru veya tıp
//      öğrencisi). Hesap dahil her şey silinir, geri dönüşü yoktur.
//   2) leaveDoctorium — AURA klinik hesabı da olan (Aşama 2) doktor. Hesap KAPANMAZ: yalnız
//      Doctorium katmanı silinir ve doctoriumOptOutAt damgalanarak erişim kapanır. Doctorium
//      yüzeyi kendi kapsamı dışına (klinik hesaba) karar vermez.
//
// ⚖️ KALANLAR — tamamlanmış hukuki işlem geri alınmaz (kullanıcı kararı):
//   · SurveyResponse  — verilen oy, anketin O TARİHTEKİ sonucudur; anket yapılmış ve bitmiştir,
//                       sonuçtan çıkarılmaz.
//   · RewardRedemption — puan karşılığı tamamlanmış işlemdir; geriye dönük bir işlem yapılmaz.
//   İkisi de Doctor'a foreign key ile bağlı DEĞİLDİR (düz String doctorId) → Doctor satırı gidince
//   cuid yetim kalır, yani ANONİMLEŞİR (KVKK'da anonimleştirme bir imha yöntemidir; aynı ilke
//   account-deletion.ts'te ConsentRecord için uygulanıyor). Admin ödül kuyruğu bu durumu zaten
//   karşılıyor: doktor bulunamazsa satır "Doktor kaydı bulunamadı" etiketiyle çizilir.
//   · AccessLog — append-only hash zinciri; kimlik taşımaz (id + eylem), satır silmek zinciri kırar.
//
// 🔴 PUAN BAKİYESİ: PointEntry satırları silinir → getDoctorBalance (lib/rewards) toplamı 0 döner.
//    Yeniden üye olan kişiye puanlar YÜKLENMEZ; arayüz bunu kapatmadan önce açıkça uyarır. Ayrı
//    "sıfırlama" koduna gerek yoktur — bakiye zaten satırlardan türetiliyor.
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { recordAccess } from "./audit";
import type { SessionUser } from "./session";
import { LOCKED_PURGE_DAYS } from "./doctorium-tiers";

/** Doctor satırına foreign key ile bağlı KLİNİK kayıtlar (AURA tarafı). */
export type ClinicalTies = { cases: number; consultations: number; reviews: number };

export function hasClinicalTies(t: ClinicalTies): boolean {
  return t.cases > 0 || t.consultations > 0 || t.reviews > 0;
}

/**
 * Klinik bağ sayımı — tam silmenin FAIL-CLOSED korkuluğu.
 *
 * Aşama 1 doktorunda ve öğrencide bu sayıların sıfır olması BEKLENİR (klinik yüzeyler o hesaplara
 * kapalı), ama VARSAYILMAZ: activatedAt geri alınmış eski bir hesap ya da ileride açılacak bir yol
 * bağ bırakmış olabilir. Bağ varken Doctor satırını silmek Prisma'da foreign key hatası verir veya
 * (cascade eklenirse) başkasının klinik kaydını sessizce götürürdü. Ölçüp reddetmek ikisini de kapatır.
 */
export async function countClinicalTies(doctorId: string): Promise<ClinicalTies> {
  const [cases, consultations, reviews] = await Promise.all([
    db.case.count({ where: { doctorId } }),
    db.consultation.count({ where: { doctorId } }),
    db.review.count({ where: { doctorId } }),
  ]);
  return { cases, consultations, reviews };
}

/** Silinen Doctorium katmanının dökümü (audit detayına ve arayüz özetine girer). */
export type LayerCounts = {
  saved: number;
  follows: number;
  points: number;
  digests: number;
};

/**
 * Doctorium kişisel katmanını sil (her iki yolun ORTAK gövdesi).
 *
 * Doctor SATIRI KALIR — burada yalnız portalda üretilen kayıtlar gider ve tercih kolonları
 * başlangıç durumuna döner. Tam kapatmada Doctor satırını çağıran siler (sıra: bu → belgeler →
 * Doctor → User); üyelikten çıkışta satır olduğu gibi kalır, yalnız damga eklenir.
 *
 * ⚠️ Tercih kolonları null'lanır, "varsayılana çekilir" DEĞİL: parse* yardımcıları (lib/doctorium)
 * null girdiyi zaten varsayılan olarak yorumluyor. Böylece varsayılanlar tek yerde tanımlı kalır.
 */
async function purgeLayer(
  tx: Pick<typeof db, "savedArticle" | "congressFollow" | "pointEntry" | "dailyDigest" | "doctor">,
  doctorId: string,
): Promise<LayerCounts> {
  const [saved, follows, points, digests] = await Promise.all([
    tx.savedArticle.deleteMany({ where: { doctorId } }),
    tx.congressFollow.deleteMany({ where: { doctorId } }),
    tx.pointEntry.deleteMany({ where: { doctorId } }),
    tx.dailyDigest.deleteMany({ where: { doctorId } }),
  ]);
  await tx.doctor.update({
    where: { id: doctorId },
    data: {
      feedModules: null,
      newsBranches: null,
      congressAlertDays: null,
      congressDeadlineAlertDays: null,
      congressAbstractAlertDays: null,
      congressEarlyBirdAlertDays: null,
      congressEventTypes: null,
      congressScope: null,
      doctoriumViewPrefs: null,
      digestChannel: null,
      // Sponsorlu içerik kişiselleştirme rızası GERİ ÇEKİLİR (rıza kişiye bağlıdır, üyelik
      // bitince sürmez). lib/sponsor rıza izlerini AccessLog'da tutar — o zincir kalır.
      sponsorPersonalizationAt: null,
    },
  });
  return {
    saved: saved.count,
    follows: follows.count,
    points: points.count,
    digests: digests.count,
  };
}

/**
 * AŞAMA 2 — Doctorium üyeliğinden çık. Hesap ve AURA klinik erişimi AYNEN devam eder.
 *
 * doctoriumOptOutAt damgası şart: diplomaVerifiedAt/studentVerifiedAt burada SİLİNMEZ (diploma
 * doğrulaması klinik tarafın da dayanağıdır), dolayısıyla hasDoctoriumAccess tek başına kapanmazdı.
 */
export async function leaveDoctorium(
  actor: SessionUser,
  doctorId: string,
  ip?: string | null,
  userAgent?: string | null,
): Promise<LayerCounts> {
  const counts = await db.$transaction(async (tx) => {
    const c = await purgeLayer(tx, doctorId);
    await tx.doctor.update({ where: { id: doctorId }, data: { doctoriumOptOutAt: new Date() } });
    return c;
  });

  await recordAccess({
    actor,
    action: "DOCTORIUM_LEAVE",
    resourceType: "Doctor",
    resourceId: doctorId,
    subjectUserId: actor.id,
    detail: `Doctorium üyeliği sonlandırıldı (hesap açık kaldı); silinen: ${counts.saved} kayıt, ${counts.follows} takip, ${counts.points} puan hareketi, ${counts.digests} özet`,
    ip,
    userAgent,
  });
  return counts;
}

/**
 * Tam kapatmanın İŞLEM GÖVDESİ — closeDoctoriumAccount (üye kendisi) ve purgeTrialAccount (cron) ORTAK kullanır.
 * Sıra: Doctorium katmanı → belgeler → bildirimler → onam (bağ-koruyan boşaltma) → Doctor → User.
 */
async function closeAccountRows(tx: Prisma.TransactionClient, userId: string, doctorId: string, now: Date): Promise<LayerCounts> {
  const c = await purgeLayer(tx, doctorId);
  // Mezun belgesi + diğer yüklemeler: kişisel veri, at-rest şifreli olsa da saklama gerekçesi üyelikle birlikte biter.
  await tx.doctorDocument.deleteMany({ where: { doctorId } });
  await tx.notification.deleteMany({ where: { userId } });
  // Onam: satır kalır (zincir halkası), kişisel alanlar boşaltılır.
  await tx.consentRecord.updateMany({
    where: { userId, purgedAt: null },
    data: { ip: null, userAgent: null, purgedAt: now },
  });
  await tx.doctor.delete({ where: { id: doctorId } });
  await tx.user.delete({ where: { id: userId } });
  return c;
}

export type TrialPurgeResult = "purged" | "skipped-ties" | "skipped-docs";

/**
 * DENEME İMHASI (üç katman Faz A4, kullanıcı kararı 2026-09-05) — trial-sweep cron'u çağırır: deneme süresi bitmiş,
 * LOCKED_PURGE_DAYS geçmiş, imha bildirimi gitmiş ve DOĞRULAMA YAPILMAMIŞ hesap. Karar (tarih/bildirim) lib/doctorium-tiers
 * shouldPurgeLockedTrial'da; burası yalnız FAIL-CLOSED korkuluklar + aynı kapatma gövdesi:
 *   · klinik bağ varsa (Aşama 1 hesabında beklenmez) → atla — Doctorium başkasının klinik kaydına karar vermez;
 *   · İNCELEMEDE (PENDING) belgesi varsa → atla — kişi belge yükledi, incelemeci karar vermedi; kullanıcının fiili bekletilir.
 * Audit: DOCTORIUM_TRIAL_PURGE (actor null — cron; özne silinen hesap, cuid yetim → anonim).
 */
export async function purgeTrialAccount(userId: string, doctorId: string): Promise<TrialPurgeResult> {
  const ties = await countClinicalTies(doctorId);
  if (hasClinicalTies(ties)) return "skipped-ties";
  const pending = await db.doctorDocument.count({ where: { doctorId, status: "PENDING" } });
  if (pending > 0) return "skipped-docs";

  const now = new Date();
  const counts = await db.$transaction((tx) => closeAccountRows(tx, userId, doctorId, now));
  await recordAccess({
    actor: null,
    action: "DOCTORIUM_TRIAL_PURGE",
    resourceType: "User",
    resourceId: userId,
    subjectUserId: userId,
    detail: `deneme süresi + ${LOCKED_PURGE_DAYS} günlük saklama süresi doldu, doğrulama yapılmadı; hesap ve üyelik verisi silindi (silinen: ${counts.saved} kayıt, ${counts.follows} takip, ${counts.points} puan hareketi, ${counts.digests} özet)`,
  });
  return "purged";
}

export type CloseResult =
  | { ok: true; counts: LayerCounts }
  | { ok: false; reason: "CLINICAL_TIES"; ties: ClinicalTies }
  | { ok: false; reason: "NO_DOCTOR" };

/**
 * AŞAMA 1 / ÖĞRENCİ — üyeliği ve hesabı tamamen kapat. Geri dönüşü yoktur.
 *
 * Sıra önemlidir: Doctorium katmanı → belgeler → bildirim/push → onam kaydı (bağ-koruyan) →
 * Doctor → User. Doctor ve User satırları GERÇEKTEN silinir; AURA hasta silmesindeki "kabuk bırak"
 * deseni burada gerekmez çünkü kabuğun tek gerekçesi saklanan klinik kaydın rızasını ispat etmekti
 * ve saklanan klinik kayıt yok.
 *
 * ⚠️ ConsentRecord satırı SİLİNMEZ: append-only hash zincirinin halkasıdır, silmek sonraki kaydın
 * prevHash bağını boşa düşürür. Kişisel alanları (ip/userAgent) boşaltılır + purgedAt damgalanır;
 * kalan userId cuid'i User satırı gittiği için anonimdir. (account-deletion.ts ile aynı desen.)
 */
export async function closeDoctoriumAccount(
  actor: SessionUser,
  ip?: string | null,
  userAgent?: string | null,
): Promise<CloseResult> {
  const me = await db.user.findUnique({ where: { id: actor.id }, select: { doctorId: true } });
  if (!me?.doctorId) return { ok: false, reason: "NO_DOCTOR" };
  const doctorId = me.doctorId;

  // FAIL-CLOSED: klinik bağ varsa bu hesap Doctorium'un tek başına kapatabileceği bir hesap
  // değildir. Çağıran bunu "üyelikten çıkış" yoluna çevirir.
  const ties = await countClinicalTies(doctorId);
  if (hasClinicalTies(ties)) return { ok: false, reason: "CLINICAL_TIES", ties };

  const now = new Date();
  const counts = await db.$transaction((tx) => closeAccountRows(tx, actor.id, doctorId, now));

  // Zincire mühürle — "sildim" iddiasının ispatı kalmalı. Kişisel veri gitti; kayıt yalnız id+eylem
  // taşır. actor artık silinmiş bir kullanıcıyı gösterir: cuid yetim olduğu için anonimdir.
  await recordAccess({
    actor,
    action: "DOCTORIUM_ACCOUNT_CLOSE",
    resourceType: "User",
    resourceId: actor.id,
    subjectUserId: actor.id,
    detail: `Doctorium üyeliği ve hesabı kapatıldı; silinen: ${counts.saved} kayıt, ${counts.follows} takip, ${counts.points} puan hareketi, ${counts.digests} özet. Anket yanıtları ve tamamlanmış ödül işlemleri kimlik bağı olmadan kaldı.`,
    ip,
    userAgent,
  });
  return { ok: true, counts };
}
