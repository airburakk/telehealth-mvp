// Karusel editoryal — deterministik kalite kapıları (Vercel'e taşıma, 2026-11-17 · 👤 "vercelde çalıştır").
// Model ne derse desin, bu kurallar geçmezse öğe DÜŞER. Her kapı [ad, geçti, ayrıntı] döndürür.
//
// KAYNAK: infra/kart/karusel/editoryal/kapilar.py (13–16 Kasım ölçümü + 16.11 düzeltmeleri) — BİREBİR çeviri.
// Eşlik testi tests/unit/karusel-editoryal-kapilar.test.ts, Python'un ürettiği beklenen kararlarla karşılaştırır
// (tests/fixtures/karusel-kapilar-eslik.json). Kuralı burada değiştiren Python'da da değiştirir (kart ucu kapanana dek).
//
// 🪤 Python ↔ JS düzenli ifade farkları (eşlik bunlara dayanır):
//   · Python `\b`/`\w`/`\d` Unicode'dur; JS'de `\b` `u` bayrağıyla bile ASCII'dir ("Fırat"ta ı sözcük harfi sayılmaz →
//     "rat" sözcük başı bulunur = 16.11 hatası geri gelir). Bu yüzden W = [\p{L}\p{N}_] bakışları kullanılır.
//   · Python `len()` kod noktası sayar; JS `.length` UTF-16 birimi → `[...s].length`.

import { kapakSigma } from "./kapak-sigma";

export type Taslak = { coverTitle: string; coverDeck: string; detailTitle: string; detailSummary: string };
export type KapiItem = { streamLabel?: string; url?: string | null };
export type KapiSonucu = [ad: string, gecti: boolean, ayrinti: string];

export const ALANLAR = ["coverTitle", "coverDeck", "detailTitle", "detailSummary"] as const;
export const LIMITS: Record<keyof Taslak, number> = { coverTitle: 44, coverDeck: 125, detailTitle: 72, detailSummary: 270 };
export const MIN_LEN: Record<keyof Taslak, number> = { coverTitle: 12, coverDeck: 30, detailTitle: 20, detailSummary: 90 };

// Doctorium'un kendi iddiası olarak YASAK; kaynak metinde geçiyorsa haber cümlesinde serbest (👤 15.11 Karar 3).
const SOURCE_EXEMPT: [string, string[]][] = [
  ["akredit", ["akredit", "accredit"]],
  ["garanti", ["garanti", "guarantee"]],
  ["kesin tedavi", ["kesin tedavi", "cure"]],
];
// 🔴 "hekim" burada VERİDİR (yayın metninde yasak sözcük) — terim kuralının arama sözlüğü istisnası.
const ALWAYS_BANNED = ["hekim", "uçtan uca", "mucize", "devrim", "çığır", "müjde", "umut ışığı", "kanıtlandı"];

// Klinik öncesi / kayıt bulgusu işaretleri → temkin cümlesi zorunlu. Sonu boşluklu terim = sözcük sonu da aranır.
const PRECLINICAL = ["in vitro", "hücre kültür", "cell line", "cells", "hücre", "mice", "mouse", "fare", "rat ",
  "sıçan", "drosophila", "flies", "sinek", "zebrafish", "docking", "in silico", "animal"];
const CAUTION = ["gösterilmedi", "gösterilmiş değil", "göstermez", "kanıtlanmadı", "henüz", "araştırma duyurusu",
  "tedavi sonucu değil", "klinik yarar", "insanlarda"];
const TRIAL_STREAMS = ["İlaç & Cihaz"];
const INNER_VOICE = ["kaynakta", "kaynak metin", "bilgi bulunma", "belirtilmemiş", "belirtilmemektedir"];
const MEVZUAT_EVAL = ["önemli", "kritik", "büyük", "köklü", "yeni dönem", "beklenen", "olumlu", "olumsuz"];

const W = "[\\p{L}\\p{N}_]";
const NOT_BEFORE = `(?<!${W})`;
const NOT_AFTER = `(?!${W})`;
const NUM_RE = /\p{Nd}+(?:[.,]\p{Nd}+)?/gu;
const BIN_RE = new RegExp(`${NOT_BEFORE}(\\p{Nd}{1,3})\\s+bin(?:den|de|e|i|in|ler${W}*)?${NOT_AFTER}`, "gu");
const PERSON_RE = new RegExp(`${NOT_BEFORE}(?:Prof|Doç|Dr|Uzm|Op)\\.\\s*(?:Dr\\.\\s*)?[A-ZÇĞİÖŞÜ][a-zçğıöşü]+`, "gu");

/** Kod noktası uzunluğu (Python len). */
export const cpLen = (s: string): number => [...s].length;

/** Türkçe büyük/küçük katlama (Python _fold): İ→i, I→ı, küçült, NFC. */
export function fold(s: string): string {
  return s.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase().normalize("NFC");
}

function numbers(s: string): string[] {
  return s.match(NUM_RE) ?? [];
}

const numForms = (n: string) => [n, n.replace(/,/g, "."), n.replace(/\./g, ",")];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PRECLINICAL_RE = PRECLINICAL.map((p) => new RegExp(NOT_BEFORE + escapeRe(p.trim()) + (p.endsWith(" ") ? NOT_AFTER : ""), "u"));

export function check(e: Taslak, item: KapiItem, src: string, konum?: number): KapiSonucu[] {
  const out: KapiSonucu[] = [];
  const text = ALANLAR.map((k) => e[k]).join(" ");
  const ft = fold(text);
  const fs = fold(src);

  // 1) uzunluk
  const bad = ALANLAR.filter((k) => !(MIN_LEN[k] <= cpLen(e[k]) && cpLen(e[k]) <= LIMITS[k])).map((k) => `${k}=${cpLen(e[k])}`);
  out.push(["uzunluk", bad.length === 0, bad.join(", ")]);

  // 2) sayı kapısı — metindeki her sayı kaynakta (aynı biçimde ya da nokta/virgül eşdeğeriyle) geçmeli.
  // "11 bin" = kaynaktaki "11,000"/"11.000" (YALNIZ "bin" sözcüğüyle; "milyon" bilinçli olarak sıkı kalır).
  const srcNums = new Set(numbers(src));
  const textNum = text.replace(BIN_RE, "$1.000");
  const missing = [...new Set(numbers(textNum).filter((n) => !numForms(n).some((f) => srcNums.has(f))))].sort();
  out.push(["sayilar", missing.length === 0, missing.length ? "kaynakta yok: " + missing.join(", ") : ""]);

  // 3) temkin kapısı — terim SÖZCÜK BAŞINDA aranır ("Fırat" ≠ "rat ").
  const preclinical = PRECLINICAL_RE.some((re) => re.test(fs));
  const trial = TRIAL_STREAMS.includes(item.streamLabel ?? "");
  const need = preclinical || trial;
  const has = CAUTION.some((c) => fold(e.detailSummary).includes(c));
  out.push(["temkin", !need || has,
    !need || has ? "" : (preclinical ? "klinik öncesi" : "klinik araştırma kaydı") + " bulgu; temkin cümlesi yok"]);

  // 4) yasak sözcükler
  const hits = ALWAYS_BANNED.filter((w) => ft.includes(w));
  hits.push(...SOURCE_EXEMPT.filter(([w, keys]) => ft.includes(w) && !keys.some((k) => fs.includes(k))).map(([w]) => w));
  out.push(["yasak_sozcuk", hits.length === 0, hits.join(", ")]);

  // 5) kaynak adı / URL metne sızmamalı
  const leak = ft.includes("http") || ft.includes("www.");
  out.push(["baglanti_yok", !leak, leak ? "metinde bağlantı var" : ""]);

  // 5b) model iç sesi yayına sızmamalı
  const meta = INNER_VOICE.filter((w) => ft.includes(w));
  out.push(["ic_ses_yok", meta.length === 0, meta.join(", ")]);

  // 5c) kişi adı yok (unvanla anılan kişi)
  const person = [...text.matchAll(PERSON_RE)].map((m) => m[0]);
  out.push(["kisi_adi_yok", person.length === 0, person.join(", ")]);

  // 6) mevzuat: yalnız künye — yorum/değerlendirme sözcüğü yok
  if (item.streamLabel === "Mevzuat") {
    const evalw = MEVZUAT_EVAL.filter((w) => ft.includes(w));
    out.push(["mevzuat_kunye", evalw.length === 0, evalw.join(", ")]);
  }

  // 7) kapak sığması (2026-11-26) — kapaktaki KONUMUNUN kutusuna sığıyor mu (kapak-sigma.ts). Konum verilmezse koşmaz.
  if (konum !== undefined) out.push(["kapak_sigma", ...kapakSigma(e, konum)]);
  return out;
}

export const passed = (r: KapiSonucu[]) => r.every(([, ok]) => ok);
