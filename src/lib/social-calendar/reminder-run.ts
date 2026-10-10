// İçerik takvimi — rubrik HATIRLATMASI çalıştırıcısı (v6.345, 2026-10-10): bugün + yarının yuvalarını okur, karar `reminder.ts`'te (SAF),
// gerekirse ALICIYA tek e-posta atar. Cron `/api/cron/rubrik-hatirlatma` (09:00 TR, YALNIZ AURA deploy'unda koşar — DB ortak).
// Alıcı: `CONTENT_PLAN_REMINDER_EMAIL` (yoksa `ALERT_EMAIL` — 2026-09-12'den beri iki projede tanımlı) · ikisi de yoksa gönderim atlanır (sonuçta yazar).
// E-posta içeriği PHI'siz: yalnız rubrik adı, gün, yuva durumu ve panel bağlantısı (alerts.ts "asla loglama" listesi geçerli).
import { db } from "../db";
import { DOCTORIUM_CANONICAL_URL } from "../brand";
import { sendEmail } from "../email";
import { todayIsoTr } from "../iso-day";
import { isApprovedIntact } from "./plan";
import { addDays } from "./series";
import { hatirlatmaEpostasi, hatirlatmaMaddeleri, type HatirlatmaMaddesi, type YuvaDurumu } from "./reminder";

export interface HatirlatmaSonucu {
  bugun: string;
  maddeler: HatirlatmaMaddesi[];
  gonderildi: boolean;
  /** gönderilmediyse nedeni: "gerek-yok" (hepsi hazır / rubrik günü yok) · "alici-yok" · "saglayici-yok" (Resend kapalı → simülasyon) · "gonderim-hatasi" (Resend reddetti — rota ALARM verir) */
  atlama: "gerek-yok" | "alici-yok" | "saglayici-yok" | "gonderim-hatasi" | null;
}

export async function rubrikHatirlatmasi(now: Date = new Date()): Promise<HatirlatmaSonucu> {
  const bugun = todayIsoTr(now);
  const satirlar = await db.contentPlanItem.findMany({
    where: { slotDay: { in: [bugun, addDays(bugun, 1)] } },
    select: { seriesKey: true, slotDay: true, status: true, payload: true, approvedHash: true },
  });
  const durum = (seriesKey: string, slotDay: string): YuvaDurumu => {
    const r = satirlar.find((x) => x.seriesKey === seriesKey && x.slotDay === slotDay);
    return r ? { status: r.status, intact: isApprovedIntact(r) } : null;
  };
  const maddeler = hatirlatmaMaddeleri(bugun, durum);
  const e = hatirlatmaEpostasi(maddeler, `${DOCTORIUM_CANONICAL_URL}/admin/icerik-takvimi`);
  if (!e) return { bugun, maddeler, gonderildi: false, atlama: "gerek-yok" };
  const to = process.env.CONTENT_PLAN_REMINDER_EMAIL || process.env.ALERT_EMAIL;
  if (!to) return { bugun, maddeler, gonderildi: false, atlama: "alici-yok" };
  const r = await sendEmail({ to, subject: e.subject, text: e.text });
  return { bugun, maddeler, gonderildi: r.sent, atlama: r.sent ? null : r.simulated ? "saglayici-yok" : "gonderim-hatasi" };
}
