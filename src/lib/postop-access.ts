// Post-op yaşam-döngüsü erişim daraltma — E2EE Faz 2A ([[hasta-verisi-uctan-uca-sifreleme]] §0.1·3, §6.2).
// "Tedavi + post-op takip boyunca eşleşen/takip doktoru erişir; post-op takip BİTİNCE erişim yalnız hastaya döner."
//
// Bu katman KRİPTOGRAFİK DEĞİL — mantıksal allowlist + değiştirilemez audit (sunucu-KMS kararıyla uyumlu, 2A).
// Gerçek-ZK (sarılı-DEK'in fiziksel kaldırılması) = 2B (Faz 3 + vendor). Nüans (§1): kapanma yalnız İLERİYE
// dönük yeni erişimi durdurur; önceden çözülmüş/görülmüş veri geri alınamaz.
//
// İki tetikleyici (kullanıcı kararı 2026-06-24): (1) MANUEL — doktor "Takibi tamamla" → Recovery.status=COMPLETED;
// (2) OTOMATİK yedek — protokol süresi + tampon dolunca LAZY kapanır (cron yok; erişim/listeleme anında hesaplanır,
// DB'ye yazılmaz → okuma yan-etkisiz). Manuel kapanma kalıcı + audit'li; otomatik kapanma hesaplanan sınırdır.
import { db } from "./db";

// Otomatik kapanma eşiği (gün) — branş protokol bitişine kaba dayalı + tampon. postop.ts metin milestone'larından
// (ör. "6. ay") türetilen sayısal değerler. ⚠️ MVP yaklaşıkları — gerçek klinik protokol süreleri uzman onayıyla
// ayarlanır (TODO). Tampon = son milestone'dan sonra hastanın son kontrolü için pay.
const BUFFER_DAYS = 30;
const AUTO_CLOSE_DAYS: { match: string; days: number }[] = [
  { match: "Saç Ekimi", days: 180 }, // 6. ay
  { match: "Estetik", days: 90 }, //    3. ay
  { match: "Ortopedi", days: 42 }, //   6. hafta
  { match: "Onkoloji", days: 30 }, //   1. ay (MVP protokol son milestone'u)
  { match: "Tüp Bebek", days: 28 }, //  4. hafta
  { match: "Kardiyoloji", days: 30 }, // 1. ay
];
const DEFAULT_PROTOCOL_DAYS = 90; // varsayılan protokol = 3. ay

/** Branşın otomatik post-op kapanma eşiği (gün) = protokol bitişi + tampon. */
export function autoCloseDays(branch: string): number {
  const base = AUTO_CLOSE_DAYS.find((p) => branch.includes(p.match))?.days ?? DEFAULT_PROTOCOL_DAYS;
  return base + BUFFER_DAYS;
}

export type CloseReason = "MANUAL" | "AUTO";

/**
 * Bir recovery klinik-personel erişimine kapalı mı? Manuel COMPLETED veya otomatik süre+tampon doldu. (Saf — test edilebilir.)
 * Geri-alma (E2EE Faz 2A): hasta erişimi yeniden açtıysa `reopenedAt` set olur + status ACTIVE'e döner → manuel kapanma
 * geçer; otomatik kapanma penceresi `reopenedAt`'tan itibaren yeniden sayılır (yeniden açılan takip tekrar süre dolunca kapanabilir).
 */
export function recoveryClosed(r: { status: string; startedAt: Date; branch: string; reopenedAt?: Date | null }): { closed: boolean; reason: CloseReason | null } {
  if (r.status === "COMPLETED") return { closed: true, reason: "MANUAL" };
  const since = r.reopenedAt ?? r.startedAt; // geri-alma sonrası pencere yeniden başlar
  const elapsedDays = (Date.now() - new Date(since).getTime()) / 86_400_000;
  if (elapsedDays > autoCloseDays(r.branch)) return { closed: true, reason: "AUTO" };
  return { closed: false, reason: null };
}

/**
 * Klinik PERSONELİN bir vakanın klinik verisine erişimi post-op kapanmasıyla engellendi mi?
 * Recovery yoksa (post-op hiç başlamadı) → açık (false). Hasta erişimi bu helper kapsamı DIŞI (ownsCase ile yönetilir).
 */
export async function caseRecoveryClosed(caseId: string): Promise<{ closed: boolean; reason: CloseReason | null }> {
  const r = await db.recovery.findUnique({
    where: { caseId },
    select: { status: true, startedAt: true, branch: true, reopenedAt: true },
  });
  return r ? recoveryClosed(r) : { closed: false, reason: null };
}

/**
 * Klinik PERSONELİN erişimi post-op kapanmasıyla engellendi mi? (Hastalar kapsam DIŞI → daima false; onlar ownsCase.)
 * Erişim noktalarında: `if ((await staffAccessClosed(id, user)).closed) → 403 + audit POSTOP_ACCESS_DENIED`.
 * Audit'i ÇAĞIRAN yazar (bu helper saf/audit'siz → döngüsüz + render-flood'a karşı esnek).
 */
export async function staffAccessClosed(
  caseId: string,
  user: { role: string } | null,
): Promise<{ closed: boolean; reason: CloseReason | null }> {
  if (!user || user.role === "PATIENT") return { closed: false, reason: null };
  return caseRecoveryClosed(caseId);
}
