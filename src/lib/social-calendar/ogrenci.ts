// İçerik takvimi — ÖĞRENCİ KÖŞESİ fırsat adayları + taslak üreticisi (v6.349, 2026-10-12). SAF: DB yok (kayıtlar parametreyle gelir).
//
// 👤 Kararlar (12.10, AskUserQuestion): biçim = FIRSAT SEÇİCİ (Etkinlik radarı deseni; TUS kilometre taşları ve haftalık tek konu seçilmedi) ·
// gönderide EN FAZLA 3 fırsat · tarihi olmayan DÖNEMSEL fırsatlar da aday (slaytta tarih yerine kaydın kendi dönem notu yazar). Kaynak: `EduOpportunity`
// (Kariyer EDU; yalnız 👤 onaylı = approvedAt dolu). Son başvurusu yayın gününden ÖNCE geçmiş tarihli fırsat aday DEĞİL (yanıltmasın).
//
// İlkeler (Etkinlik radarıyla aynı): DETERMİNİSTİK (AI yok) · metin YALNIZ kayıttaki alanlardan kurulur · ⚖️ İLAN DEĞİL, SÜREÇ BİLGİSİ (lib/edu-opportunities:
// "ilan / işe alım / pozisyon / kadro / maaş" dili YOK, başvuru çağrısı yerine "resmî sayfadan teyit edin") · kendi metnimizde "hekim" yok; fırsatın ve
// düzenleyenin RESMÎ ADI olduğu gibi kalır (kapı resmî adları taramadan çıkarır, bkz. gates.ts).
import { EDU_KIND_LABEL, eduCountryLabel, type EduOpportunityKind } from "../edu-opportunities";
import { formatIsoDayTr } from "../iso-day";
import { LIMITS } from "./limits";
import type { PlanPayload, PlanSource, Slide } from "./payload";
import { SLIDE_ROLE_LABEL } from "./series";

export const OGRENCI = { enCok: 3, enAz: 1 } as const;

/** `EduOpportunity`'den gereken alanlar. */
export interface FirsatKaydi {
  id: string;
  kind: string;
  title: string;
  organizer: string;
  country: string | null;
  deadline: Date | null;
  deadlineNote: string | null;
  startsAt: string | null;
  eligibility: string;
  sourceUrl: string;
}

/** Ekrandaki aday satırı (istemciye giden; düz metin + ISO gün). */
export interface FirsatAdayi {
  id: string;
  kind: string;
  turEtiketi: string;
  title: string;
  organizer: string;
  ulke: string;
  /** ISO gün ya da null (dönemsel). */
  sonBasvuru: string | null;
  /** "Son başvuru: 16 Kasım 2026" ya da "Dönemsel: …" */
  takvim: string;
  eligibility: string;
  sourceUrl: string;
  /** Bu fırsat başka bir Öğrenci köşesi yuvasında kullanıldıysa o yuvanın günü (editör bilerek tekrar seçebilir). */
  kullanildi: string | null;
}

const gun = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
const kisalt = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
const turEtiketi = (kind: string): string => EDU_KIND_LABEL[kind as EduOpportunityKind] ?? kind;

/** Takvim satırı: tarihliyse son başvuru günü, değilse kaydın kendi dönem notu (not da yoksa dürüst yedek). */
export function takvimSatiri(k: Pick<FirsatKaydi, "deadline" | "deadlineNote">): string {
  const d = gun(k.deadline);
  if (d) return `Son başvuru: ${formatIsoDayTr(d)}`;
  return `Dönemsel: ${k.deadlineNote?.trim() || "takvim kurumun resmî sayfasında duyurulur"}`;
}

/** Yayın gününe göre aday mı: dönemsel (tarihsiz) her zaman; tarihli ise son başvuru yayın günü ya da sonrası. */
export function firsatAdayMi(k: Pick<FirsatKaydi, "deadline">, slotDay: string): boolean {
  const d = gun(k.deadline);
  return d === null || d >= slotDay;
}

/** Tarihliler önce (yakın son başvuru üstte), dönemseller sonra; eşitlikte ad. */
function sirala<T extends { deadline: Date | null; title: string }>(a: T, b: T): number {
  const x = gun(a.deadline), y = gun(b.deadline);
  if (x && y) return x.localeCompare(y) || a.title.localeCompare(b.title, "tr");
  if (x) return -1;
  if (y) return 1;
  return a.title.localeCompare(b.title, "tr");
}

/** Slayt sırası (taslak + `sourceIds` aynı sırayı kullanır). */
export const siraliFirsatlar = <T extends { deadline: Date | null; title: string }>(k: readonly T[]): T[] => [...k].sort(sirala);

/** Kayıtlar → aday listesi (kapanmış tarihliler düşer). */
export function firsatAdaylari(kayitlar: FirsatKaydi[], slotDay: string, kullanilan: Map<string, string> = new Map()): FirsatAdayi[] {
  return kayitlar
    .filter((k) => firsatAdayMi(k, slotDay))
    .sort(sirala)
    .map((k) => ({
      id: k.id, kind: k.kind, turEtiketi: turEtiketi(k.kind), title: k.title, organizer: k.organizer, ulke: eduCountryLabel(k.country),
      sonBasvuru: gun(k.deadline), takvim: takvimSatiri(k), eligibility: k.eligibility, sourceUrl: k.sourceUrl, kullanildi: kullanilan.get(k.id) ?? null,
    }));
}

/** Fırsat slaytı (rol "genel"): başlık = resmî ad; gövde = tür · ülke · düzenleyen · takvim; madde = kısa şartlar (kaydın özeti) · başlangıç. */
export function firsatSlayti(k: FirsatKaydi): Slide {
  const body = [`${turEtiketi(k.kind)} · ${eduCountryLabel(k.country)}`, `Düzenleyen: ${k.organizer}`, takvimSatiri(k)].join("\n");
  const bullets = [
    `Kimler için: ${kisalt(k.eligibility, LIMITS.bullet - 13)}`,
    ...(k.startsAt ? [`Başlangıç: ${kisalt(k.startsAt, LIMITS.bullet - 12)}`] : []),
  ];
  return { role: "genel", title: kisalt(k.title, LIMITS.title), body: kisalt(body, LIMITS.body), bullets, auto: true };
}

/** Seçilen 1–3 fırsattan taslak (sıra: tarihliler son başvuruya göre, sonra dönemseller). Geçersiz sayıda seçim → null. */
export function buildOgrenciDraft(secilen: FirsatKaydi[], slotDay: string): PlanPayload | null {
  if (secilen.length < OGRENCI.enAz || secilen.length > OGRENCI.enCok) return null;
  const s = siraliFirsatlar(secilen);
  const turler = [...new Set(s.map((k) => turEtiketi(k.kind).toLocaleLowerCase("tr-TR")))].join(", ");
  const baslik = s.length === 1 ? "Tıp öğrencileri için bir fırsat" : `Tıp öğrencileri için ${s.length} fırsat`;
  const slides: Slide[] = [
    { role: "kapak", title: baslik, body: turler, auto: true },
    ...s.map(firsatSlayti),
    {
      role: "kaynak",
      title: SLIDE_ROLE_LABEL.kaynak,
      body:
        "Bilgiler kurumların kendi resmî sayfalarından derlenmiştir; bu bir duyuru özetidir, başvuru Doctorium üzerinden yapılmaz. Takvim ve koşullar değişebilir; " +
        "başvuru öncesi kurumun resmî sayfasından teyit edin.\n\nTüm fırsatlar ve takip: Doctorium Kariyer.",
      auto: true,
    },
  ];
  const liste = s.map((k) => `• ${kisalt(k.title, 110)} — ${takvimSatiri(k)}`).join("\n");
  const caption = kisalt(
    `Öğrenci köşesi · ${formatIsoDayTr(slotDay)}\n\n${baslik} kaydırmalı görsellerde:\n${liste}\n\n` +
      "Takvim ve koşullar değişebilir; başvuru öncesi kurumun resmî sayfasından teyit edin.",
    LIMITS.caption,
  );
  const sources: PlanSource[] = s.map((k) => ({ label: kisalt(k.title, LIMITS.sourceLabel), ref: kisalt(k.sourceUrl, LIMITS.sourceRef) }));
  return { v: 1, slides, caption, hashtags: ["#ÖğrenciKöşesi", "#TıpÖğrencisi", "#TıpEğitimi", "#Doctorium"], sources };
}

/** Kapının "resmî ad" istisnası için: seçilen fırsatların adı + düzenleyeni (+ kısaltılmış ad biçimleri). Uzundan kısaya. */
export function firsatResmiAdlari(secilen: Pick<FirsatKaydi, "title" | "organizer">[]): string[] {
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
