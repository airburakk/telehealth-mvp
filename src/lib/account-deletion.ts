// Hesap ve veri silme — KVKK m.7 / GDPR m.17 (v6.11).
//
// ⚖️ İKİ KATMANLI MODEL (kullanıcı kararı 2026-07-15). Sağlık kaydı silme hakkı MUTLAK DEĞİLDİR:
// klinik kayıt yasal saklama yükümlülüğüne tabidir (KVKK m.7 → m.5/m.6 istisnaları). "Hepsini sil"
// düğmesi bu yüzden hukuka aykırı olurdu. Onun yerine:
//
//   1) KİŞİSEL KATMAN → GERÇEKTEN SİLİNİR (geri dönüşü yok):
//      e-posta · ad · telefon · profil tercihleri · bildirimler · push aboneliği · paylaşım linkleri.
//      Parola çöpe atılır + sessionVersion artar → tüm cihazlardaki oturumlar düşer, giriş imkânsız.
//
//   2) KLİNİK KATMAN → SAKLANIR ama ERİŞİME KAPANIR (deletionLockedAt) ve saklama süresi sonunda
//      GERÇEKTEN İMHA EDİLİR (purgeAfter → cron). Kilit HERKESİ kapsar: hasta, doktor, koordinatör,
//      admin. KVKK m.7'nin "silinemiyorsa işlemeyi kısıtla" yaklaşımı.
//
// NEDEN User SATIRI HEMEN SİLİNMİYOR: sakladığımız klinik kayıtların RIZASINI ispat eden
// ConsentRecord.userId bağı kopmasın — yasal süre boyunca "bu kaydı neden tutuyoruz"un kanıtı odur.
// Kişisel alanlar zaten boşaltıldığı için kabukta kimlik verisi KALMAZ; imha anında kabuk da gider.
//
// SAKLANANLAR ve nedenleri (Trust & Safety sayfasında AYNEN yazılır — gizli tutulmaz):
//   · ConsentRecord → saklanan kaydın hukuki dayanağının ispatı (imha anında birlikte gider)
//   · AuditLog      → append-only hash-ZİNCİRİ; satır silmek zinciri kırar ve doğrulanamaz hale getirir.
//                     Ayrıca erişim kaydı başlı başına yasal belgedir. Kimlik verisi taşımaz (id + eylem).
//
// 🔌 CRYPTO-SHRED NOTU: gerçek anahtar-imhası (hasta bazında) BUGÜNKÜ mimaride MÜMKÜN DEĞİL — DEK
// alanın İÇİNDE saklanıyor (crypto.ts envelope: enc:v1:<wrappedDEK>:...), imha edilebilir tek anahtar
// global KEK (= herkesin verisi). Bu yüzden imha = kaydın FİZİKEN silinmesi. Hasta-bazlı DEK'e geçilirse
// (crypto.ts:17 KMS swap noktası) purge burada "anahtar satırını sil"e dönüşebilir.
import { db } from "./db";
import { recordAccess } from "./audit";
import type { SessionUser } from "./session";

/**
 * ⚖️ TASLAK PARAMETRE — klinik kayıt yasal saklama süresi (yıl). Kullanıcı kararı 2026-07-15: 20 yıl.
 * Mevzuat değişirse/veri sorumlusu farklı süre belirlerse YALNIZ BU SABİT değişir; akış aynı kalır.
 * Süre hasta hesabını sildiği andan itibaren işler.
 */
export const RETENTION_YEARS = 20;

/** Saklama süresi sonu = silme anı + RETENTION_YEARS. (Saf — test edilebilir.) */
export function purgeDateFrom(deletedAt: Date): Date {
  const d = new Date(deletedAt);
  d.setFullYear(d.getFullYear() + RETENTION_YEARS);
  return d;
}

/**
 * Kayıt hesap-silme kilidinde mi? (Saf.) Kilitliyse HERKESE kapalıdır — ownership katmanı bunu
 * rol kontrolünden ÖNCE uygular (admin/koordinatör geniş dalları dahil).
 */
export function deletionLocked(c: { deletionLockedAt: Date | null }): boolean {
  return c.deletionLockedAt !== null;
}

/** Silinmiş hesabın e-posta mezar-taşı — @unique bozulmasın + aynı adresle yeniden kayıt açılabilsin. */
function tombstoneEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`;
}

/**
 * Hesabı ve kişisel verileri sil; klinik kaydı kilitle + imha tarihini damgala.
 * Idempotent: zaten silinmiş hesapta no-op döner (çift tıklama/yeniden deneme güvenli).
 *
 * Tek transaction: kişisel veri silinip klinik kilit atılmazsa (veya tersi) yarım durum kalırdı —
 * hasta erişemez ama personel erişir gibi. $transaction ikisini birlikte bağlar.
 */
export async function deleteAccount(actor: SessionUser, ip?: string | null, userAgent?: string | null): Promise<{ ok: boolean; alreadyDeleted?: boolean; lockedCases: number; lockedSoCases: number }> {
  const userId = actor.id;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, deletedAt: true } });
  if (!user) return { ok: false, lockedCases: 0, lockedSoCases: 0 };
  if (user.deletedAt) return { ok: true, alreadyDeleted: true, lockedCases: 0, lockedSoCases: 0 };

  const now = new Date();
  const purge = purgeDateFrom(now);

  const [, , lockedCases, lockedSoCases] = await db.$transaction([
    // 1) KİŞİSEL KATMAN — kimlik alanları boşaltılır, giriş imkânsızlaşır.
    //    passwordHash rastgele: bcrypt karşılaştırması hiçbir parolayla eşleşmez (Google-gölge hesap deseni).
    //    sessionVersion++ → dolaşımdaki tüm JWT'ler düşer (lib/auth sv karşılaştırması).
    db.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
        email: tombstoneEmail(userId),
        name: "Silinmiş kullanıcı",
        passwordHash: `deleted:${Math.random().toString(36).slice(2)}${Date.now()}`,
        patientCountry: null,
        patientLanguage: null,
        patientPhone: null,
        patientContactPref: null,
        patientJourney: null,
        emailVerifiedAt: null,
        emailVerifyTokenHash: null,
        emailVerifySentAt: null,
        sessionVersion: { increment: 1 },
      },
    }),
    // Bildirim + push: kişisel, klinik dayanağı yok → sil.
    db.notification.deleteMany({ where: { userId } }),
    // 2) KLİNİK KATMAN — kilitle + imha tarihi damgala (SİLME).
    db.case.updateMany({ where: { userId, deletionLockedAt: null }, data: { deletionLockedAt: now, purgeAfter: purge } }),
    db.secondOpinionCase.updateMany({ where: { patientId: userId, deletionLockedAt: null }, data: { deletionLockedAt: now, purgeAfter: purge } }),
  ]);

  // Paylaşım linkleri: hastanın vakalarına ait TÜM aktif linkler iptal (dışarıdaki alıcılar da erişemesin).
  // Transaction dışı: caseId listesi gerektiriyor + fail-safe (iptal patlarsa silme geri alınmamalı; link
  // zaten kilitli vakaya bakıyor ve o kilit ownership katmanında uygulanıyor).
  const cases = await db.case.findMany({ where: { userId }, select: { id: true } });
  if (cases.length) {
    await db.shareLink.updateMany({
      where: { caseId: { in: cases.map((c) => c.id) }, revokedAt: null },
      data: { revokedAt: now },
    });
  }
  await db.pushSubscription.deleteMany({ where: { userId } }).catch(() => {});

  // Değiştirilemez zincire mühürle — silme talebinin kendisi de denetlenebilir olmalı.
  // (Kişisel veri gitti ama "sildim" iddiasının ispatı kalmalı; zincir kimlik taşımaz, id+eylem tutar.)
  await recordAccess({
    actor,
    action: "ACCOUNT_DELETE",
    resourceType: "User",
    resourceId: userId,
    subjectUserId: userId,
    detail: `hesap silindi; klinik kayıt kilitlendi (${lockedCases.count} vaka + ${lockedSoCases.count} ikinci görüş), imha: ${purge.toISOString().slice(0, 10)} (saklama ${RETENTION_YEARS} yıl)`,
    ip,
    userAgent,
  });

  return { ok: true, lockedCases: lockedCases.count, lockedSoCases: lockedSoCases.count };
}

/**
 * Saklama süresi dolmuş kayıtları GERÇEKTEN imha et (cron). Kilitli + purgeAfter geçmiş olanlar.
 * Sıra: bağımlı kayıtlar → vaka → (hesabın son vakası da gittiyse) hesap kabuğu + rıza kaydı.
 * Batch sınırı: cron zaman aşımına girmesin (maxDuration) — kalanı ertesi gün alınır (idempotent).
 */
export async function purgeExpired(limit = 50): Promise<{ purgedCases: number; purgedSoCases: number; purgedUsers: number; failed: number }> {
  const now = new Date();
  let purgedCases = 0;
  let purgedSoCases = 0;
  let purgedUsers = 0;
  let failed = 0; // tek bozuk kayıt batch'i düşürmesin; kısmi başarısızlık çağırana raporlanır (cron alarm verir)

  const cases = await db.case.findMany({ where: { purgeAfter: { lte: now } }, select: { id: true, userId: true }, take: limit });
  for (const c of cases) {
    // Bağımlı kayıtlar (FK) önce — belgeler dahil (CaseDocument içeriği at-rest şifreli; satır gidince şifreli
    // hâli de gider). Grandchild zincirleri iki aşama: ShareLink→ShareAccess ve Recovery→CheckIn
    // (CheckIn.recovery Restrict — önce silinmezse recovery.deleteMany FK ihlaliyle fırlar).
    // ⚠️ Blob'daki nesneler ayrı temizlik gerektirir → aşağıdaki TODO.
    try {
      await db.$transaction([
        db.shareAccess.deleteMany({ where: { shareLink: { caseId: c.id } } }),
        db.shareLink.deleteMany({ where: { caseId: c.id } }),
        db.caseDocument.deleteMany({ where: { caseId: c.id } }),
        db.checkIn.deleteMany({ where: { recovery: { caseId: c.id } } }),
        db.recovery.deleteMany({ where: { caseId: c.id } }),
        db.complaint.deleteMany({ where: { caseId: c.id } }),
        db.booking.deleteMany({ where: { caseId: c.id } }),
        db.consultation.deleteMany({ where: { caseId: c.id } }),
        db.case.delete({ where: { id: c.id } }),
      ]);
      purgedCases++;
    } catch (e) {
      failed++;
      console.warn(`[purge] vaka imha edilemedi (${c.id}) — batch devam ediyor:`, e instanceof Error ? e.message : e);
    }
  }

  const soCases = await db.secondOpinionCase.findMany({ where: { purgeAfter: { lte: now } }, select: { id: true }, take: limit });
  for (const s of soCases) {
    try {
      await db.$transaction([
        db.secondOpinionDocument.deleteMany({ where: { caseId: s.id } }),
        db.secondOpinionRequest.deleteMany({ where: { caseId: s.id } }),
        db.secondOpinionEvent.deleteMany({ where: { caseId: s.id } }),
        db.secondOpinion.deleteMany({ where: { caseId: s.id } }),
        db.secondOpinionAppointment.deleteMany({ where: { caseId: s.id } }),
        db.secondOpinionPayment.deleteMany({ where: { caseId: s.id } }),
        db.secondOpinionCase.delete({ where: { id: s.id } }),
      ]);
      purgedSoCases++;
    } catch (e) {
      failed++;
      console.warn(`[purge] ikinci görüş vakası imha edilemedi (${s.id}) — batch devam ediyor:`, e instanceof Error ? e.message : e);
    }
  }

  // Hesap kabuğu + rıza kaydı: YALNIZ hiç klinik kaydı kalmayan silinmiş hesaplarda. Rıza kaydı
  // saklanan kaydın dayanağıydı; saklanacak kayıt kalmadıysa dayanağı da tutmanın sebebi kalmaz.
  const shells = await db.user.findMany({ where: { deletedAt: { not: null } }, select: { id: true }, take: limit });
  for (const u of shells) {
    const [caseCount, soCaseCount] = await Promise.all([
      db.case.count({ where: { userId: u.id } }),
      db.secondOpinionCase.count({ where: { patientId: u.id } }),
    ]);
    if (caseCount > 0 || soCaseCount > 0) continue; // hâlâ saklanan klinik kayıt var → kabuk durur
    try {
      await db.$transaction([
        db.consentRecord.deleteMany({ where: { userId: u.id } }),
        db.user.delete({ where: { id: u.id } }),
      ]);
      purgedUsers++;
    } catch (e) {
      failed++;
      console.warn(`[purge] hesap kabuğu imha edilemedi (${u.id}) — batch devam ediyor:`, e instanceof Error ? e.message : e);
    }
  }

  // AuditLog KASITLI olarak dokunulmaz: append-only hash-zinciri (satır silmek zinciri kırar +
  // doğrulanamaz kılar) ve erişim kaydı başlı başına yasal belgedir; kimlik verisi taşımaz.
  return { purgedCases, purgedSoCases, purgedUsers, failed };
}
