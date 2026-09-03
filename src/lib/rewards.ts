// Anket ödül puanları + ödül kataloğu (v6.88) — lib/survey.ts'in kardeş katmanı.
//
// TASARIM İLKELERİ (dayanak: vault output/doctorium-reklam-monetizasyon-2026-08-04.md §4.7):
//  - LEDGER tek gerçek: bakiye kolonu yok, bakiye = SUM(PointEntry.delta). Satır silinmez/
//    güncellenmez; ret/iptal İADE SATIRI üretir (mali izlenebilirlik — avukat/denetim disiplini).
//  - Puana PARASAL DEĞER ATFEDILMEZ: "1 puan = ₺X" eşlemesi hiçbir yüzeyde/metinde kurulmaz.
//    Nakit honorarium kilidi (canActivateSurvey) bu katmandan BAĞIMSIZ aynen yaşar.
//  - Ayni menfaat (kongre/kitap) İFA anı = RewardRedemption FULFILLED; oraya giden her adım
//    insan onaylı (REQUESTED → admin APPROVED → FULFILLED). Otomatik satın alma bilinçli YOK.
//  - ⚖️ Katalog BOŞ başlar: ilk kalem girişinden ÖNCE vergi (ayni menfaat) + kamu doktoru (657)
//    değerlendirmesi kullanıcıda — admin panel bu uyarıyı kaldırılamaz biçimde gösterir.
import { db } from "./db";
import { Prisma } from "@prisma/client";

// ── Sabitler ────────────────────────────────────────────────────────────────────────────────────
export const REWARD_KINDS = ["KONGRE_TR", "KONGRE_INTL", "KITAP"] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
export const REWARD_KIND_LABEL: Record<string, string> = {
  KONGRE_TR: "Yurt içi kongre",
  KONGRE_INTL: "Uluslararası kongre",
  KITAP: "Tıbbi kitap",
};

export const REDEMPTION_STATUSES = ["REQUESTED", "APPROVED", "FULFILLED", "REJECTED", "CANCELLED"] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];
export const REDEMPTION_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Onay bekliyor",
  APPROVED: "Onaylandı",
  FULFILLED: "Teslim edildi",
  REJECTED: "Reddedildi",
  CANCELLED: "İptal edildi",
};

export const POINT_REASONS = ["SURVEY", "REDEEM", "REDEEM_REFUND", "ADJUST"] as const;

// Anket başına girilebilecek puan tavanı (admin formu + API — yanlışlıkla 5000 girilmesin).
export const MAX_SURVEY_POINTS = 1000;

// ⚖️ NİHAİ program koşulları (v6.210, 👤 avukat kararı 03.09.2026) — kanonik kaynak: vault
// output/doctorium-hukuki-belgeler/10-puan-odul-program-kosullari.md §3.1 (7 madde). Doktor yüzünde
// ödül modülünde daima görünür (kaldırılamaz — vitrin iddia dürüstlüğü disiplini). Madde 5 (vergi)
// mali müşavir görüşüne kadar ⏸️ PARK: metin yer tutucu taşımaz, kataloğun o güne dek KAPALI kaldığını
// söyler (yönetim paneli de kataloğu boş tutar). Madde 4'teki "puan iadesi" kodla uyumludur
// (REDEEM_REFUND: ret/iptalde otomatik). Tek-string REWARD_TERMS_TEXT geriye uyum içindir (testler).
export const REWARD_TERMS_ITEMS: readonly string[] = [
  "Puanların niteliği: Puanlar, Doctorium'a katılımınızı gösteren platform içi göstergelerdir; parasal değer taşımaz, nakde çevrilemez, devredilemez, mirasa ve hacze konu olmaz. Puan biriktirmek kazanılmış hak doğurmaz.",
  "Puan kazanma: Puan kazandıran işlemler ve puan değerleri Ödüller sayfasında ilan edilir; bu değerler ileriye etkili olarak değiştirilebilir ve daha önce kazanılmış puanları etkilemez.",
  "Ödül talebi: Katalogdaki bir ödül için talepte bulunabilirsiniz; talep anındaki puan bedeli sabitlenir. Talepler otomatik karşılanmaz, her talep insan değerlendirmesine tabidir ve 10 iş günü içinde sonuçlandırılır.",
  "Reddedilebilecek hâller: Talebiniz; mevzuata aykırılık (kamu görevlisi statünüzden doğan kısıtlar dâhil), programın kötüye kullanımı veya ödülün temin edilememesi hâllerinde gerekçesi bildirilerek reddedilebilir. Reddedilen talepte puanlarınız iade edilir.",
  "Vergi: Ödül tesliminden doğabilecek vergisel yükümlülüklere ilişkin esaslar, ödül kataloğu açılmadan önce bu koşullara eklenir; katalog o güne kadar kapalıdır.",
  "Kamu görevlisi katılımcı: Kamu kurumunda görevliyseniz, ödül kabulünün tabi olduğunuz mevzuata uygunluğunu değerlendirmek sizin sorumluluğunuzdadır.",
  "Programın değiştirilmesi veya sona ermesi: Program önceden duyurularak değiştirilebilir veya sonlandırılabilir. Sonlandırma hâlinde birikmiş puanlarınızı kullanmanız için en az 60 gün süre tanınır.",
];
export const REWARD_TERMS_TEXT = REWARD_TERMS_ITEMS.map((t, i) => `${i + 1}. ${t}`).join(" ");

// ── Saf fonksiyonlar (birim testlenebilir — DB'siz) ─────────────────────────────────────────────

/** Ledger satırlarından bakiye: SUM(delta). Boş liste = 0. */
export function balanceFromEntries(entries: { delta: number }[]): number {
  return entries.reduce((a, e) => a + e.delta, 0);
}

/** Talep ön-kontrolü: kalem aktif + bakiye yeterli + bedel pozitif. */
export function canRedeem(
  item: { active: boolean; pointsCost: number },
  balance: number,
): { ok: true } | { ok: false; error: string } {
  if (!item.active) return { ok: false, error: "Bu ödül şu an katalogda değil." };
  if (item.pointsCost <= 0) return { ok: false, error: "Geçersiz ödül bedeli." };
  if (balance < item.pointsCost) return { ok: false, error: "Puanınız bu ödül için yeterli değil." };
  return { ok: true };
}

/** Talep durum geçişi meşru mu? (admin kararı + doktor iptali tek kaynaktan doğrulanır) */
export function canTransitionRedemption(from: string, to: string, byAdmin: boolean): boolean {
  if (byAdmin) {
    if (from === "REQUESTED") return to === "APPROVED" || to === "REJECTED";
    if (from === "APPROVED") return to === "FULFILLED" || to === "REJECTED";
    return false; // FULFILLED / REJECTED / CANCELLED uçtur — ledger izi geri sarılmaz
  }
  // Doktor yalnız kendi REQUESTED talebini iptal edebilir (onaylanmışı admin yönetir).
  return from === "REQUESTED" && to === "CANCELLED";
}

/** İade gerektiren geçiş mi? (REJECTED/CANCELLED → rezerve puan geri yazılır) */
export function refundNeeded(to: string): boolean {
  return to === "REJECTED" || to === "CANCELLED";
}

// ── DB katmanı ──────────────────────────────────────────────────────────────────────────────────

/** Doktorun güncel puan bakiyesi (SUM aggregate — satır çekmeden). */
export async function getDoctorBalance(doctorId: string): Promise<number> {
  const r = await db.pointEntry.aggregate({ where: { doctorId }, _sum: { delta: true } });
  return r._sum.delta ?? 0;
}

/**
 * Ödül talebi — YARIŞ GÜVENLİ rezervasyon.
 *
 * Read-committed'da iki eşzamanlı talep ikisi de "bakiye yeter" görebilirdi (ikisi de diğerinin
 * commit edilmemiş eksi satırını görmez) → çifte harcama. Çözüm: transaction içinde doktora özel
 * pg_advisory_xact_lock — aynı doktorun talepleri serileşir (kilit commit/rollback'te otomatik
 * düşer). Farklı doktorlar kilitlenmez (hashtext ile doktor-başına anahtar).
 */
export async function redeemReward(
  doctorId: string,
  itemId: string,
  note: string | null,
): Promise<{ ok: true; redemptionId: string; balance: number } | { ok: false; error: string }> {
  return db.$transaction(async (tx) => {
    // $executeRaw (queryRaw DEĞİL): pg_advisory_xact_lock void döndürür ve Prisma void kolonu
    // deserialize edemez (P2010 — dev provasında yakalandı). executeRaw satır okumaz, sorun yok.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"reward:" + doctorId}))`;

    const item = await tx.rewardItem.findUnique({
      where: { id: itemId },
      select: { active: true, pointsCost: true },
    });
    if (!item) return { ok: false as const, error: "Ödül bulunamadı." };

    const agg = await tx.pointEntry.aggregate({ where: { doctorId }, _sum: { delta: true } });
    const balance = agg._sum.delta ?? 0;
    const check = canRedeem(item, balance);
    if (!check.ok) return { ok: false as const, error: check.error };

    const red = await tx.rewardRedemption.create({
      data: { doctorId, itemId, pointsCost: item.pointsCost, note },
      select: { id: true },
    });
    await tx.pointEntry.create({
      data: {
        doctorId,
        delta: -item.pointsCost,
        reason: "REDEEM",
        redemptionId: red.id,
      },
    });
    return { ok: true as const, redemptionId: red.id, balance: balance - item.pointsCost };
  });
}

/**
 * Talep durum değişikliği (admin kararı VEYA doktor iptali) + gerekiyorsa iade satırı — atomik.
 * İade idempotency: aynı redemption için ikinci REDEEM_REFUND yazılamaz (uç durumlar zaten
 * canTransitionRedemption ile kapalı; yine de refund öncesi varlık kontrolü yapılır).
 */
export async function transitionRedemption(opts: {
  redemptionId: string;
  to: RedemptionStatus;
  byAdmin: boolean;
  actorDoctorId?: string; // doktor iptalinde sahiplik şartı
  adminNote?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  return db.$transaction(async (tx) => {
    const red = await tx.rewardRedemption.findUnique({
      where: { id: opts.redemptionId },
      select: { id: true, doctorId: true, status: true, pointsCost: true },
    });
    if (!red) return { ok: false as const, error: "Talep bulunamadı.", status: 404 };
    if (!opts.byAdmin && red.doctorId !== opts.actorDoctorId) {
      return { ok: false as const, error: "Talep bulunamadı.", status: 404 }; // varlık sızdırma yok
    }
    if (!canTransitionRedemption(red.status, opts.to, opts.byAdmin)) {
      return { ok: false as const, error: "Bu durum geçişi yapılamaz.", status: 409 };
    }

    await tx.rewardRedemption.update({
      where: { id: red.id },
      data: {
        status: opts.to,
        adminNote: opts.byAdmin ? (opts.adminNote ?? null) : undefined,
        decidedAt: new Date(),
      },
    });

    if (refundNeeded(opts.to)) {
      const already = await tx.pointEntry.findFirst({
        where: { redemptionId: red.id, reason: "REDEEM_REFUND" },
        select: { id: true },
      });
      if (!already) {
        await tx.pointEntry.create({
          data: {
            doctorId: red.doctorId,
            delta: red.pointsCost,
            reason: "REDEEM_REFUND",
            redemptionId: red.id,
          },
        });
      }
    }
    return { ok: true as const };
  });
}

/**
 * Anket yanıtına puan yaz (respond ucundan, yanıtla AYNI transaction'da çağrılır).
 * İdempotency DB'de: @@unique(doctorId, surveyId) — yarışta P2002 sessizce yutulur
 * (yanıt zaten unique; buradaki güvence "puan çift yazılmasın" içindir).
 */
export async function awardSurveyPoints(
  tx: Prisma.TransactionClient,
  doctorId: string,
  surveyId: string,
  points: number,
): Promise<number> {
  if (points <= 0) return 0;
  try {
    await tx.pointEntry.create({
      data: { doctorId, delta: points, reason: "SURVEY", surveyId },
    });
    return points;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return 0;
    throw e;
  }
}
