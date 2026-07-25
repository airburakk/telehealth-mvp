import { db } from "@/lib/db";
import { notifyUser } from "@/lib/notify";

// DOCS_PENDING hatırlatması (2026-07-24, kullanıcı kararı: günde 1 × en fazla 3) — belge-bekleyen
// başvurunun hastasına periyodik dürtü. Günlük bakım cron'undan (purge-deleted, ~06:30 TR) çağrılır.
// Son-hatırlatma durumu AYRI kolon tutmaz: hastanın /vaka/<id> href'li MISSING_DOCS bildirimleri
// zaten kayıt — en yenisinin yaşı pencereyi, toplam sayısı tavanı verir (migration'sız, tek kaynak).
// İlk bildirim vaka oluşturmada atılır → toplam tavan = 1 ilk + REMINDER_CAP hatırlatma.
// Metinler kullanıcı onaylı; dış kanala (EMAIL/SMS) içerik zaten geçmez (notifyUser jenerik dürtü kuralı).

export const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // hatırlatmalar arası en az 24 saat
export const REMINDER_CAP = 3; // ilk bildirim sonrası en fazla 3 hatırlatma → sonra susar

export const REMINDER_TITLE = "📄 Belgeleriniz hâlâ bekleniyor";
export const REMINDER_BODY = "Başvurunuz, eksik belgeleriniz yüklenene kadar doktora iletilemiyor. Yüklemek için dokunun.";

// Saf karar: bu vakaya ŞİMDİ hatırlatma gönderilmeli mi? (birim testlenebilir)
// count = /vaka/<id> href'li mevcut MISSING_DOCS bildirim sayısı (ilk bildirim dahil)
// lastAt = en yenisinin zamanı (null = hiç yok — beklenmez ama gönderilir)
export function shouldRemind(count: number, lastAt: Date | null, now: Date = new Date()): boolean {
  if (count > REMINDER_CAP) return false; // 1 ilk + CAP hatırlatma dolmuş → sus
  if (!lastAt) return true;
  return now.getTime() - lastAt.getTime() >= REMINDER_INTERVAL_MS;
}

export interface RemindResult {
  checked: number; // taranan DOCS_PENDING vaka
  reminded: number; // bu koşuda hatırlatma gönderilen
  capped: number; // tavana ulaşıp susturulan
  failed: number; // vaka-başına hata (batch düşmez)
}

export async function remindPendingDocs(now: Date = new Date()): Promise<RemindResult> {
  const cases = await db.case.findMany({
    where: { status: "DOCS_PENDING", userId: { not: null }, deletionLockedAt: null },
    select: { id: true, userId: true },
    take: 200, // günlük koşuda emniyet tavanı (gerçekçi hacmin çok üstünde)
  });
  const r: RemindResult = { checked: cases.length, reminded: 0, capped: 0, failed: 0 };
  if (!cases.length) return r;

  // Tek sorguda href-başına sayı + en yeni zaman (vaka-başına N+1 sorgudan kaçın)
  const hrefs = cases.map((c) => `/vaka/${c.id}`);
  const grouped = await db.notification.groupBy({
    by: ["href"],
    where: { type: "MISSING_DOCS", href: { in: hrefs } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const byHref = new Map(grouped.map((g) => [g.href, { count: g._count._all, lastAt: g._max.createdAt }]));

  for (const c of cases) {
    try {
      const s = byHref.get(`/vaka/${c.id}`) ?? { count: 0, lastAt: null };
      if (s.count > REMINDER_CAP) {
        r.capped++;
        continue;
      }
      if (!shouldRemind(s.count, s.lastAt, now)) continue;
      await notifyUser(c.userId!, {
        type: "MISSING_DOCS",
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        href: `/vaka/${c.id}`,
      });
      r.reminded++;
    } catch (e) {
      r.failed++; // tek vaka hatası günün diğer hatırlatmalarını düşürmez
      console.warn("[pending-docs-reminder] vaka atlandı:", c.id, e instanceof Error ? e.message : e);
    }
  }
  return r;
}
