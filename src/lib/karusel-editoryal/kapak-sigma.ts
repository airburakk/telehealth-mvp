// Kapak sığma kapısı (2026-11-26) — kapak metni, kapaktaki KONUMUNUN kutusuna sığıyor mu?
//
// KAYNAK: infra/kart/karusel/editoryal/kapak_sigma.py — BİREBİR çeviri (gerekçe ve ölçümler orada). Eşlik testi
// tests/unit/karusel-kapak-sigma.test.ts, Python'un ürettiği kapak_sigma_eslik.json fikstürüyle karşılaştırır; tablo
// (kapak-olculeri.json) Python kopyasıyla bayt bayt aynı olmalı. Kuralı burada değiştiren Python'da da değiştirir.
//
// Neden: kapıların karakter sınırı (coverDeck ≤ 125) tektir; kapaktaki kutular konuma göre çok farklıdır (3. konum ≈109
// karakterde dolar). Editoryal Vercel'de üretilir, yazı tipi burada yoktur → gerçek yazı tipinden üretilmiş genişlik +
// kerning tablosuyla kapak çizicisinin (newspaper_cover.py box/wrap) satır kırması yeniden oynanır.
import OLCU from "./kapak-olculeri.json";

type Tur = "roman" | "bold";
type Kutu = readonly [y: number, w: number, h: number, boyut: number, enKucuk: number];
type Tablo = { genislik: Record<string, number>; kerning: Record<string, number> };

const SATIR_ARALIGI = 1.12;
const TEMKIN_PX = 1.0;
export const BINDIRME_PAYI = 10;

// newspaper_cover.cover() çağrılarıyla birebir: [başlık kutusu, açıklama kutusu].
export const KONUMLAR: readonly (readonly [Kutu, Kutu])[] = [
  [[309, 618, 147, 42, 40], [397, 618, 62, 21, 20]],
  [[312, 300, 220, 30, 28], [422, 300, 104, 22, 20]],
  [[647, 300, 140, 30, 28], [728, 300, 78, 20, 19]],
  [[939, 296, 190, 30, 28], [1054, 296, 100, 21, 19]],
  [[939, 296, 190, 30, 28], [1054, 296, 100, 21, 19]],
  [[939, 296, 190, 30, 28], [1054, 296, 100, 21, 19]],
];

const TABLOLAR = OLCU as unknown as { olcek: number; roman: Tablo; bold: Tablo };
const YEDEK: Record<Tur, number> = {
  roman: Math.max(...Object.values(TABLOLAR.roman.genislik)),
  bold: Math.max(...Object.values(TABLOLAR.bold.genislik)),
};

/** Python str.split() ile aynı: boşluk dizilerine göre böl, boş parçaları at. */
const sozcukler = (s: string) => s.split(/\s+/).filter(Boolean);

/** PIL textlength ile aynı: karakterler + bitişik çiftlerin kerning'i (1000 pt birimi → sz). Toplama sırası Python'la aynı. */
function genislik(s: string, tur: Tur, sz: number): number {
  const { genislik: g, kerning: k } = TABLOLAR[tur];
  const cp = [...s];
  let birim = 0;
  for (const c of cp) birim += g[c] ?? YEDEK[tur];
  let kern = 0;
  for (let i = 0; i < cp.length - 1; i++) kern += k[cp[i] + cp[i + 1]] ?? 0;
  return ((birim + kern) * sz) / TABLOLAR.olcek;
}

function kir(metin: string, tur: Tur, sz: number, w: number): string[] | null {
  const sigmaz = (s: string) => genislik(s, tur, sz) + TEMKIN_PX > w;
  const out: string[] = [];
  let cur = "";
  for (const word of sozcukler(metin)) {
    if (sigmaz(word)) return null;
    const test = (cur + " " + word).trim();
    if (sigmaz(test)) {
      out.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** newspaper_cover.box: büyükten küçüğe ilk sığan boyut → [boyut, satır]; sığmazsa null. */
export function yerlesim(metin: string, kutu: Kutu, bold: boolean): [number, number] | null {
  const [, w, h, boyut, enKucuk] = kutu;
  for (let sz = boyut; sz >= enKucuk; sz--) {
    const satirlar = kir(metin, bold ? "bold" : "roman", sz, w);
    if (satirlar === null) return null;
    if (satirlar.length * Math.ceil(sz * SATIR_ARALIGI) <= h) return [sz, satirlar.length];
  }
  return null;
}

function baslikTamam(metin: string, konum: number): boolean {
  const [bk, ak] = KONUMLAR[konum - 1];
  const r = yerlesim(metin, bk, true);
  return r !== null && bk[0] + r[1] * Math.ceil(r[0] * SATIR_ARALIGI) <= ak[0] + BINDIRME_PAYI;
}

const aciklamaTamam = (metin: string, konum: number) => yerlesim(metin, KONUMLAR[konum - 1][1], false) !== null;

function enCokKelime(metin: string, tamam: (s: string) => boolean): number {
  const k0 = sozcukler(metin);
  let k = k0.length;
  while (k > 0 && !tamam(k0.slice(0, k).join(" "))) k--;
  return k;
}

/** [geçti, ayrıntı] — ayrıntı modele ret geri bildirimi olarak gider (kapak_sigma.py ile birebir metin). */
export function kapakSigma(e: { coverTitle: string; coverDeck: string }, konum: number): [boolean, string] {
  const sorun: string[] = [];
  const kurallar: [keyof typeof e, (m: string, k: number) => boolean, string][] = [
    ["coverTitle", baslikTamam, "kapakta açıklamanın üstüne biniyor"],
    ["coverDeck", aciklamaTamam, "kapaktaki kutuya sığmıyor"],
  ];
  for (const [alan, tamam, ne] of kurallar) {
    const metin = e[alan];
    if (tamam(metin, konum)) continue;
    const w = sozcukler(metin).length;
    const k = enCokKelime(metin, (s) => tamam(s, konum));
    sorun.push(`${alan} ${konum}. konumda ${ne} (${w} kelime); bu konumda en çok ${k} kelime → en az ${w - k} kelime çıkar`);
  }
  return [sorun.length === 0, sorun.join("; ")];
}
