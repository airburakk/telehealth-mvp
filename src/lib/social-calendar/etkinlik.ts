// İçerik takvimi — ETKİNLİK RADARI aday penceresi + taslak üreticisi (v6.346, 2026-10-10). SAF: DB yok (kayıtlar ve tür etiketleri parametreyle gelir).
//
// 👤 Kararlar (10.10, AskUserQuestion): yönetim ekranında YAKLAŞAN etkinlikler aday olarak listelenir, editör EN FAZLA 6 tanesini seçer · pencere =
// yayın gününden sonraki 60 gün (ayrıca bildiri/erken kayıt son günü bu pencereye düşen daha ileri tarihli etkinlikler — son tarih uyarısı değerli) ·
// TÜM türler (kongre/sempozyum/kurs/…) aday, ekranda türe göre süzülür. Kaynak: `MedicalCongress` (Kongre/STE veritabanı; TTB-STE kayıtları dahil).
//
// İlkeler (Karar masası üreticisiyle aynı): DETERMİNİSTİK (AI yok) · metin YALNIZ kayıttaki alanlardan kurulur (uydurma yok) · kredi SAYISI yazılmaz
// (puan katılım süresine bağlı — kongre modülü kuralı) · kendi metnimizde "akredit/hekim" yok (TTB kodu "TTB-STE kodu" diye yazılır; etkinliğin RESMÎ ADI
// olduğu gibi kalır — kapı resmî adları taramadan çıkarır, bkz. gates.ts) · tarih ekseni UTC takvim günü (lib/calendar ile aynı).
import { formatIsoDayTr } from "../iso-day";
import { LIMITS } from "./limits";
import type { PlanPayload, PlanSource, Slide } from "./payload";
import { SLIDE_ROLE_LABEL, addDays } from "./series";

export const ETKINLIK = { pencereGun: 60, enCok: 6, enAz: 1 } as const;

/** `MedicalCongress`'ten gereken alanlar (liste sorgusu bu alanları AÇIK seçer — kapak görseli SEÇİLMEZ). */
export interface EtkinlikKaydi {
  id: string;
  title: string;
  organizer: string | null;
  city: string | null;
  country: string;
  venue: string | null;
  startDate: Date;
  endDate: Date | null;
  abstractDeadline: Date | null;
  earlyBirdDeadline: Date | null;
  eventType: string;
  scope: string;
  ttbCode: string | null;
  url: string | null;
  warning: string | null;
}

export const KAPSAM_ETIKET: Record<string, string> = { ulusal: "Ulusal", uluslararasi: "Uluslararası", "uluslararasi-katilimli": "Uluslararası katılımlı" };

/** Ekrandaki aday satırı (istemciye giden; düz metin + ISO günler). */
export interface EtkinlikAdayi {
  id: string;
  title: string;
  organizer: string | null;
  yer: string;
  tarih: string;
  baslangic: string;
  eventType: string;
  turEtiketi: string;
  kapsamEtiketi: string;
  /** "pencere" = başlangıç pencere içinde · "son-tarih" = ileri tarihli ama bildiri/erken kayıt son günü pencerede */
  neden: "pencere" | "son-tarih";
  sonTarihler: string[];
  url: string | null;
  ttbCode: string | null;
  warning: string | null;
  /** Bu etkinlik başka bir Etkinlik radarı yuvasında kullanıldıysa o yuvanın günü (editör bilerek tekrar seçebilir). */
  kullanildi: string | null;
}

const gun = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
const AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "14–18 Ekim 2026" · "30 Ekim – 2 Kasım 2026" · "28 Aralık 2026 – 3 Ocak 2027" · tek gün "14 Ekim 2026". */
export function tarihAraligi(bas: Date, bit: Date | null): string {
  const b = gun(bas)!, e = gun(bit);
  if (!e || e <= b) return formatIsoDayTr(b);
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  const [ey, em, ed] = e.split("-").map(Number) as [number, number, number];
  if (by !== ey) return `${formatIsoDayTr(b)} – ${formatIsoDayTr(e)}`;
  if (bm !== em) return `${bd} ${AY[bm - 1]} – ${ed} ${AY[em - 1]} ${ey}`;
  return `${bd}–${ed} ${AY[bm - 1]} ${by}`;
}

/** Yer satırı: şehir · mekân; yurt dışında ülke kodu eklenir ("Barselona (ES)"). Boşsa "Yer bilgisi yok". */
export function yerSatiri(k: Pick<EtkinlikKaydi, "city" | "venue" | "country">): string {
  const sehir = k.city ? (k.country && k.country !== "TR" ? `${k.city} (${k.country})` : k.city) : null;
  return [sehir, k.venue].filter(Boolean).join(" · ") || "Yer bilgisi yok";
}

/** Yayın günü penceresi: [slotDay, slotDay + 60] (UTC takvim günleri, iki uç dahil). */
export function pencere(slotDay: string): { bas: string; son: string } {
  return { bas: slotDay, son: addDays(slotDay, ETKINLIK.pencereGun) };
}

/** Yayın gününden SONRA olan son tarihler ("Bildiri son günü: 1 Kasım 2026"). Geçmiş son tarih yazılmaz (yanıltmasın). */
export function sonTarihler(k: Pick<EtkinlikKaydi, "abstractDeadline" | "earlyBirdDeadline">, slotDay: string): string[] {
  const out: string[] = [];
  const a = gun(k.abstractDeadline), e = gun(k.earlyBirdDeadline);
  if (a && a >= slotDay) out.push(`Bildiri son günü: ${formatIsoDayTr(a)}`);
  if (e && e >= slotDay) out.push(`Erken kayıt son günü: ${formatIsoDayTr(e)}`);
  return out;
}

/** Kayıt pencereye giriyor mu, hangi nedenle (null = aday değil). */
export function adayNedeni(k: EtkinlikKaydi, slotDay: string): EtkinlikAdayi["neden"] | null {
  const { bas, son } = pencere(slotDay);
  const b = gun(k.startDate)!;
  if (b >= bas && b <= son) return "pencere";
  if (b > son) {
    const sonlar = [gun(k.abstractDeadline), gun(k.earlyBirdDeadline)].filter((x): x is string => !!x);
    if (sonlar.some((x) => x >= bas && x <= son)) return "son-tarih";
  }
  return null;
}

/** Kayıtlar → aday listesi (başlangıç tarihine göre; pencere içindekiler önce, sonra son-tarih nedenliler). */
export function etkinlikAdaylari(kayitlar: EtkinlikKaydi[], slotDay: string, turEtiketi: Record<string, string>, kullanilan: Map<string, string> = new Map()): EtkinlikAdayi[] {
  const out: EtkinlikAdayi[] = [];
  for (const k of kayitlar) {
    const neden = adayNedeni(k, slotDay);
    if (!neden) continue;
    out.push({
      id: k.id, title: k.title, organizer: k.organizer, yer: yerSatiri(k), tarih: tarihAraligi(k.startDate, k.endDate), baslangic: gun(k.startDate)!,
      eventType: k.eventType, turEtiketi: turEtiketi[k.eventType] ?? k.eventType, kapsamEtiketi: KAPSAM_ETIKET[k.scope] ?? k.scope,
      neden, sonTarihler: sonTarihler(k, slotDay), url: k.url, ttbCode: k.ttbCode, warning: k.warning, kullanildi: kullanilan.get(k.id) ?? null,
    });
  }
  const sira = { pencere: 0, "son-tarih": 1 } as const;
  return out.sort((a, b) => sira[a.neden] - sira[b.neden] || a.baslangic.localeCompare(b.baslangic) || a.title.localeCompare(b.title, "tr"));
}

const kisalt = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

/** Etkinlik slaytı (rol "genel"): başlık = resmî ad; gövde = tarih · yer · düzenleyen · tür/kapsam; maddeler = gelecekteki son tarihler · TTB-STE kodu · uyarı. */
export function etkinlikSlayti(k: EtkinlikKaydi, slotDay: string, turEtiketi: Record<string, string>): Slide {
  const tur = [turEtiketi[k.eventType] ?? k.eventType, KAPSAM_ETIKET[k.scope]].filter(Boolean).join(" · ");
  const body = [tarihAraligi(k.startDate, k.endDate), yerSatiri(k), k.organizer ? `Düzenleyen: ${k.organizer}` : null, tur].filter(Boolean).join("\n");
  const bullets = [
    ...sonTarihler(k, slotDay),
    ...(k.ttbCode ? [`TTB-STE kodu: ${k.ttbCode}`] : []),
    ...(k.warning ? [`Dikkat: ${kisalt(k.warning, LIMITS.bullet - 8)}`] : []),
  ].slice(0, LIMITS.bullets);
  return { role: "genel", title: kisalt(k.title, LIMITS.title), body: kisalt(body, LIMITS.body), ...(bullets.length ? { bullets } : {}), auto: true };
}

/** Seçilen 1–6 etkinlikten taslak. Sıra = başlangıç tarihi. Geçersiz sayıda seçim → null (çağıran hata verir). */
export function buildEtkinlikDraft(secilen: EtkinlikKaydi[], slotDay: string, turEtiketi: Record<string, string>): PlanPayload | null {
  if (secilen.length < ETKINLIK.enAz || secilen.length > ETKINLIK.enCok) return null;
  const s = [...secilen].sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || a.title.localeCompare(b.title, "tr"));
  const turler = [...new Set(s.map((k) => (turEtiketi[k.eventType] ?? k.eventType).toLocaleLowerCase("tr-TR")))].join(", ");
  const ilk = s[0]!, son = s[s.length - 1]!;
  const aralik = s.length === 1 ? tarihAraligi(ilk.startDate, ilk.endDate) : tarihAraligi(ilk.startDate, son.endDate && son.endDate > son.startDate ? son.endDate : son.startDate);
  const slides: Slide[] = [
    { role: "kapak", title: s.length === 1 ? "Yaklaşan etkinlik" : `Yaklaşan ${s.length} etkinlik`, body: `${aralik} · ${turler}`, auto: true },
    ...s.map((k) => etkinlikSlayti(k, slotDay, turEtiketi)),
    {
      role: "kaynak",
      title: SLIDE_ROLE_LABEL.kaynak,
      body:
        "Bilgiler düzenleyicilerin resmî sitelerinden ve TTB-STE kayıtlarından derlenmiştir. Tarih, yer ve koşullar değişebilir; kayıt öncesi etkinliğin resmî sitesinden teyit edin.\n\n" +
        "Tüm etkinlikler ve takip: Doctorium etkinlik takvimi.",
      auto: true,
    },
  ];
  const liste = s.map((k) => `• ${kisalt(k.title, 110)} — ${tarihAraligi(k.startDate, k.endDate)}${k.city ? `, ${k.city}` : ""}`).join("\n");
  const caption = kisalt(
    `Etkinlik radarı · ${formatIsoDayTr(slotDay)}\n\n${s.length === 1 ? "Yaklaşan etkinlik" : `Yaklaşan ${s.length} etkinlik`} kaydırmalı görsellerde:\n${liste}\n\n` +
      "Tarih, yer ve koşullar değişebilir; kayıt öncesi resmî siteden teyit edin.",
    LIMITS.caption,
  );
  const sources: PlanSource[] = s.map((k) => ({
    label: kisalt(k.title, LIMITS.sourceLabel),
    ref: kisalt(k.url ?? (k.ttbCode ? `TTB-STE ${k.ttbCode}` : k.organizer ?? "Doctorium etkinlik takvimi"), LIMITS.sourceRef),
  }));
  return { v: 1, slides, caption, hashtags: ["#EtkinlikRadarı", "#TıpKongresi", "#SürekliTıpEğitimi", "#Doctorium"], sources };
}

/**
 * Kapının "resmî ad" istisnası için: seçilen etkinliklerin adı + düzenleyeni (bunlar VERİDİR; kendi metnimiz değil — "Diş Hekimleri Birliği" gibi).
 * Slaytta/altyazıda kısaltılmış biçimleri de ("…" öncesi) listeye girer ki kısaltılmış ad kendi metnimiz sanılmasın. Uzundan kısaya sıralı.
 */
export function resmiAdlar(secilen: Pick<EtkinlikKaydi, "title" | "organizer">[]): string[] {
  const adlar = new Set<string>();
  for (const k of secilen) {
    for (const x of [k.title, k.organizer]) if (x && x.trim()) adlar.add(x.trim());
    for (const n of [LIMITS.title, LIMITS.sourceLabel, 110]) {
      const kisa = kisalt(k.title, n);
      if (kisa !== k.title) adlar.add(kisa.replace(/…$/, ""));
    }
  }
  return [...adlar].sort((a, b) => b.length - a.length);
}
