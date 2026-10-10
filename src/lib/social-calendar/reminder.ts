// İçerik takvimi — rubrik HATIRLATMASI kararı (v6.345, 2026-10-10). SAF: DB/e-posta yok (birim testi hafif; çalıştırıcı `reminder-run.ts`).
//
// 👤 İstek (10.10): rubrik yayını (n8n, Pzt/Çar/Cum 12:00) yalnız ONAYLI ve onaydan sonra DEĞİŞMEMİŞ içeriği yayınlar. Yuva hazır değilse o gün
// HİÇBİR mecrada paylaşım olmaz — sessizce. Hatırlatma bunu ÖNCEDEN söyler: her gün 09:00 TR'de iki hedef denetlenir:
//   · BUGÜN rubrik günüyse ve yuva hazır değilse → ACİL ("12:00'de paylaşılmayacak")
//   · YARIN rubrik günüyse ve yuva hazır değilse → HAZIRLIK ("yarın 12:00 için hazırla")
// "Hazır" = APPROVED + mühür sağlam (`isApprovedIntact`). Bilinçli kararlar SESSİZ: SKIPPED (atlandı) · PUBLISHING/PUBLISHED (yayın hattında/yayında).
// FAILED da bildirilir (yayın hatası insan çözmeden yeniden alınmaz). Takvim tek kaynak: `series.ts` SERIES (gün → rubrik).
import { SERIES, addDays, isoWeekday, type SeriesDef } from "./series";
import { formatIsoDayTr } from "../iso-day";

export type YuvaDurumu = { status: string; intact: boolean } | null;
export type HatirlatmaSeviye = "acil" | "hazirlik";

export interface HatirlatmaMaddesi {
  seviye: HatirlatmaSeviye;
  seriesKey: string;
  seriesName: string;
  slotDay: string;
  neden: string;
}

/** Yuvanın durumu → hatırlatma nedeni (null = sessiz). */
export function yuvaNedeni(y: YuvaDurumu): string | null {
  if (!y) return "yuva hiç açılmamış (kaynak seçilmedi, taslak yok)";
  switch (y.status) {
    case "PLANNED":
      return "yuva açık ama taslak yok (kaynak seçilmedi)";
    case "DRAFT":
      return "taslak var ama ONAYLANMADI";
    case "APPROVED":
      return y.intact ? null : "onaydan sonra içerik DEĞİŞMİŞ — onay düştü (yeniden onaylanmalı)";
    case "FAILED":
      return "önceki yayın denemesi HATA verdi — panelde 'yeniden dene' ile onaylıya döndürülmeli";
    case "SKIPPED":
    case "PUBLISHING":
    case "PUBLISHED":
      return null;
    default:
      return `bilinmeyen durum: ${y.status}`;
  }
}

/** Günün rubriği (SERIES'te o hafta gününe bağlı rubrik; yoksa null). */
export function gununRubrigi(gun: string): SeriesDef | null {
  const w = isoWeekday(gun);
  return SERIES.find((s) => s.weekday === w) ?? null;
}

/**
 * Hatırlatma maddeleri. `bugun` = Türkiye günü; `durum(seriesKey, slotDay)` yuvanın durumunu verir (DB katmanı doldurur).
 * Sıra: önce bugün (acil), sonra yarın (hazırlık).
 */
export function hatirlatmaMaddeleri(bugun: string, durum: (seriesKey: string, slotDay: string) => YuvaDurumu): HatirlatmaMaddesi[] {
  const out: HatirlatmaMaddesi[] = [];
  for (const [gun, seviye] of [[bugun, "acil"], [addDays(bugun, 1), "hazirlik"]] as const) {
    const s = gununRubrigi(gun);
    if (!s) continue;
    const neden = yuvaNedeni(durum(s.key, gun));
    if (neden) out.push({ seviye, seriesKey: s.key, seriesName: s.name, slotDay: gun, neden });
  }
  return out;
}

/** E-posta konusu + düz metin gövdesi (PHI yok: yalnız rubrik adı, gün, durum). `panel` = yönetim ekranının kök adresi. */
export function hatirlatmaEpostasi(maddeler: HatirlatmaMaddesi[], panel: string): { subject: string; text: string } | null {
  if (!maddeler.length) return null;
  const acil = maddeler.some((m) => m.seviye === "acil");
  const ozet = maddeler.map((m) => `${m.seriesName} (${formatIsoDayTr(m.slotDay)})`).join(" + ");
  const subject = `[DOCTORIUM İÇERİK TAKVİMİ] ${acil ? "BUGÜN 12:00 — " : "Yarın 12:00 — "}${ozet} onay bekliyor`;
  const satir = (m: HatirlatmaMaddesi) =>
    `${m.seviye === "acil" ? "🔴 BUGÜN" : "🟡 YARIN"} · ${m.seriesName} · ${formatIsoDayTr(m.slotDay)} 12:00\n` +
    `   Durum: ${m.neden}\n` +
    `   Panel: ${panel}?hafta=${m.slotDay}`;
  const text =
    `Rubrik yayını (Instagram · Facebook · LinkedIn · X · YouTube) yalnız ONAYLI içeriği 12:00'de paylaşır.\n` +
    `Aşağıdaki yuva${maddeler.length > 1 ? "lar" : ""} hazır değil — onaylanmazsa o gün HİÇBİR mecrada paylaşım olmaz.\n\n` +
    maddeler.map(satir).join("\n\n") +
    `\n\n${maddeler.some((m) => m.seriesKey === "karar-masasi") ? "Not: Karar masası'nda 'Doktor için çıkarım' metni sizin kaleminizdir; onay kapıları kimlik ve alıntı bütünlüğünü denetler.\n" : ""}` +
    `Bu günü bilerek atlıyorsanız yuvayı panelde 'Atla' ile işaretleyin — hatırlatma susar.\n` +
    `(Otomatik hatırlatma · her gün 09:00 TR · içerik takvimi)`;
  return { subject, text };
}
