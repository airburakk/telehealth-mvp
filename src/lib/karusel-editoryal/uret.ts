// Karusel editoryal taslağı — Vercel'de (2026-11-17 · 👤 "vercelde çalıştır"). YAYINLAMAZ.
// KAYNAK: infra/kart/karusel/editoryal/uret.py — akış, istemler, kayıt şeması BİREBİR (kart'taki kalite_kapisi.py bu
// kaydı denetler; alan adı/şekil değişirse kapı KALDI der).
//
// Akış (öğe başına): kaynak metni topla → taslak üret → deterministik kapılar (kapilar.ts) → ikinci model doğrulaması
// → geçmezse gerekçesiyle yeniden dene (en çok DENEME_SAYISI). İnsan onayı YOK (👤 15.11): bir öğe geçmezse GÜN KALDI,
// editorial DÖNMEZ (fail-closed → 07:50 tek kart). Eksik öğeyle (6'dan az) karusel yoktur.
//
// Model çağrısı dışarıdan verilir (`Olustur`): uçta lib/ai-usage.trackedCreate (sayaç "karusel-editoryal"), testte sahte.
// Yapısal çıktı = zorlanmış araç + `strict: true` ([[forced-tool-array-string-wrap]]); yanıt şekli yine de denetlenir.
import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { modelParams } from "@/lib/ai-model";
import { ALANLAR, check, cpLen, LIMITS, MIN_LEN, type KapiSonucu, type Taslak } from "./kapilar";
import { collect, edisyonMetni, sourceText, type EdisyonOgesi, type Getir } from "./kaynak";
import { ictihatMi, ictihatTaslagi } from "./ictihat";
import ornekVerisi from "./ornekler.json";

export const DEFAULT_MODEL = "claude-haiku-5-5";
// 👤 19.11: 3 → 4 deneme (uret.py ile aynı). 18–19.11 koşularında 6 öğeden biri 3. denemede doğrulamaya (abartı) takılıp hak bitince
// günü düşürdü; doğrulama yalnız kapılar geçince koşar, uzunluğa harcanan deneme abartı düzeltmesinin hakkını yiyordu.
export const DENEME_SAYISI = 4;
// USD / MTok (giriş, çıkış) — uret.py ile aynı tablo (claude-api fiyat önbelleği 2026-11-03). Tahminîdir; Console esastır.
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5], "claude-haiku-4-5": [1.0, 5.0], "claude-sonnet-5-5": [2.0, 10.0],
};
export const LEAD_CAPTION = "Temsili illüstrasyon · Yapay zekâ ile oluşturulmuştur";

// 🔴 "hekim" aşağıdaki istemde VERİDİR (modele "bunu yazma" talimatı) — terim kuralının istisnası.
export const SYSTEM_URET =
  "Doctorium Post, doktorlara yönelik günlük bir sağlık haberleri seçkisidir. Görevin: verilen TEK haber için " +
  "Instagram karuselinde kullanılacak kısa Türkçe metinleri yazmak.\n\n" +
  "Kurallar (hepsi zorunlu):\n" +
  '- Yalnız "KAYNAK METNİ"ndeki bilgiyi kullan. Kaynakta olmayan hiçbir sayı, tarih, kurum, sonuç veya yorum ekleme.\n' +
  "- Sayıları kaynaktaki gibi yaz (ondalıkta Türkçe virgül kullanabilirsin: 19,66).\n" +
  "- Laboratuvar, hücre kültürü, bilgisayar modeli veya hayvan çalışmasıysa özetin son cümlesi bunun insanlarda tedavi " +
  'etkinliği göstermediğini açıkça söyler. Klinik araştırma kaydıysa (sonuç yoksa) "bu bir araştırma duyurusudur, tedavi ' +
  'sonucu değildir" anlamını taşıyan bir cümle bulunur.\n' +
  "- Laboratuvar/hayvan çalışmasında BAŞLIKLAR da bulgunun nerede gözlendiğini söyler (\"farede\", \"hücre kültüründe\", " +
  '"hayvan çalışmasında") ya da yalnız konuyu adlandırır ("… incelendi"); başlık bulguyu genel bir etki gibi sunmaz.\n' +
  "- Mevzuat haberinde yalnız künye bilgisi: ne yayımlandı, sayısı, tarihi, hangi Resmî Gazete. Değerlendirme yok.\n" +
  "- Kişi adı yazma (kurum adı yazılabilir). Kaynak hakkında açıklama cümlesi yazma (\"kaynakta … yok\" gibi); " +
  "bilmediğin şeyi hiç anma.\n" +
  '- Abartı yok: "çığır açan, devrim, umut verici, mucize, kanıtlandı, kesin tedavi" gibi sözcükler YASAK. "hekim" yerine ' +
  'daima "doktor" yaz.\n' +
  "- Metne bağlantı, kaynak adı listesi veya etiket (#) koyma; künye kartta ayrıca yazılıyor.\n" +
  "- Uzunluk: coverTitle en çok 5 kelime; coverDeck en çok 12 kelime (1-2 kısa cümle); detailTitle ≤ 60 karakter; detailSummary en çok 28 kelime (2-3 kısa cümle; temkin cümlesi gerekiyorsa sonuncusu).\n" +
  "- Kısa yaz: uzun kurum ve çalışma adlarını kısa biçimde an; laboratuvar ölçüm ayrıntılarına (hücre hattı adı, IC50 " +
  "gibi değerler) girme. Tek ana fikir yeterli.\n" +
  '- Uzun kimyasal ad veya formül (ör. "N-(α-…)" biçimli adlar) yazma; ana bileşiğin adı + "türevleri" gibi kısa, genel bir adla an. ' +
  'Yazdığın her özel adı (ilaç, molekül, kurum, çalışma adı) kaynaktaki yazımıyla aynen kullan; harfini değiştirme.\n' +
  "- Kapak (coverTitle, coverDeck) teknik terim taşımaz: hedef molekül, mekanizma, hücre hattı veya yöntem adı yazma; konuyu " +
  've bulgunun aşamasını sade Türkçeyle söyle (ör. "Hücre kültüründe deneysel bulgu").\n' +
  '- Haber bir klinik araştırma duyurusuysa (hasta alımı, devam eden çalışma) başlıklar "çalışma" veya "araştırma" ' +
  'sözcüğünü korur; kısaltırken "yeni tedavi" gibi sonuç izlenimi veren bir ifadeye dönüştürme.\n' +
  "- Sade, tarafsız haber dili. Özgün başlığı çevirme; konuyu bir doktorun anlayacağı kısa bir başlıkla anlat.\n\n" +
  "Biçem örnekleri (onaylı yayından; içeriklerini KOPYALAMA, yalnız ton ve uzunluk için):\n" +
  "{ornekler}";

// 21.11 👤 "ayrı kısaltma adımı": yalnız uzunluk kapısı kalınca metin baştan yeniden yazılmaz; ayrı çağrıda yalnız uzun
// alan kısaltılır, sonra kapılar + doğrulama yeniden koşar (20.11 koşusu: özet 4 denemede 271 → 285 → 286). uret.py ile aynı.
export const SYSTEM_KISALT =
  "Bir sağlık haberi kartının bazı alanları uzunluk sınırını aşıyor. Görevin YALNIZ belirtilen alanları kısaltmak; başka hiçbir şeyi değiştirme.\n\n" +
  "Kurallar (hepsi zorunlu):\n" +
  "- Yalnız metinde zaten olan bilgiyi kullan; yeni sayı, tarih, kurum, sonuç veya iddia ekleme.\n" +
  "- Önce şunları çıkar: kurum ve araştırmacı adları, ölçüm ayrıntıları (hücre hattı adı, IC50 gibi değerler), tekrar eden ifadeler.\n" +
  "- Bulgunun nerede gözlendiğini (fare, sinek, hücre kültürü, insan hücresi vb.) ve temkin cümlesinin anlamını koru; gerekirse daha kısa söyle.\n" +
  "- Kısaltılacak alanın verilen kelime hedefini AŞMA. Kısaltılmayacak alanları aynen geri yaz.";

export const SYSTEM_DOGRULA =
  "Bir sağlık haberi için yazılmış kısa metinleri KAYNAK METNİ'ne göre denetliyorsun. Görevin metni " +
  "düzeltmek DEĞİL, her iddiayı etiketlemek.\n\n" +
  "Dört alanın (coverTitle, coverDeck, detailTitle, detailSummary) içindeki her olgusal iddiayı ayrı ayrı çıkar ve etiketle:\n" +
  '- "desteklenir": iddia kaynak metinde açıkça yer alıyor ya da doğrudan çıkıyor.\n' +
  '- "desteklenmez": kaynakta yok, kaynakla çelişiyor ya da kaynaktan daha fazlasını söylüyor (yeni sayı, kurum, sonuç).\n' +
  '- "abartili": kaynakta var ama metin bulguyu olduğundan güçlü, kesin veya klinik olarak yararlı gösteriyor.\n' +
  '"Henüz insanlarda gösterilmedi" gibi temkin cümleleri, kaynak klinik sonuç sunmuyorsa "desteklenir" sayılır.\n' +
  'Özel ad (ilaç, molekül, kurum, çalışma adı) kaynaktakinden farklı yazılmışsa — tek harf bile — o iddia "desteklenmez"dir; dil farkından gelen düzenli Türkçe karşılık (ör. -oyl → -oil) fark sayılmaz.\n' +
  'Gerekçeyi bir kısa cümleyle yaz. Şüphedeysen "desteklenmez" seç.';

const ETIKETLER = ["desteklenir", "desteklenmez", "abartili"] as const;
type Etiket = (typeof ETIKETLER)[number];
export type Iddia = { alan: (typeof ALANLAR)[number]; iddia: string; etiket: Etiket; gerekce: string };

const TASLAK_TOOL: Anthropic.Tool = {
  name: "submit_taslak",
  description: "Karusel metnini gönder.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      coverTitle: { type: "string", description: "Kapak için çok kısa başlık, en çok 5 kelime" },
      coverDeck: { type: "string", description: "Kapak için en çok 12 kelime, 1-2 kısa cümle" },
      detailTitle: { type: "string", description: "Haber kartı başlığı" },
      detailSummary: { type: "string", description: "Haber kartı özeti, en çok 28 kelime, 2-3 kısa cümle" },
    },
    required: [...ALANLAR],
    additionalProperties: false,
  },
};

const KISALTMA_TOOL: Anthropic.Tool = { ...TASLAK_TOOL, name: "submit_kisaltma", description: "Kısaltılmış metni gönder." };

const DOGRULAMA_TOOL: Anthropic.Tool = {
  name: "submit_dogrulama",
  description: "İddia etiketlerini gönder.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      iddialar: {
        type: "array",
        items: {
          type: "object",
          properties: {
            alan: { type: "string", enum: [...ALANLAR] },
            iddia: { type: "string" },
            etiket: { type: "string", enum: [...ETIKETLER] },
            gerekce: { type: "string" },
          },
          required: ["alan", "iddia", "etiket", "gerekce"],
          additionalProperties: false,
        },
      },
    },
    required: ["iddialar"],
    additionalProperties: false,
  },
};

// İstemdeki hedef uzunluklar (kapı sınırlarının biraz altında) — uret.py HEDEF ile aynı. Ret geri bildirimi modele bu hedefe
// göre kaç karakter kısaltacağını söyler (17.11 gerçek koşusu: yalnız "coverDeck=141" denince model 141 → 136 → 137 gezindi).
export const HEDEF: Record<(typeof ALANLAR)[number], number> = { coverTitle: 36, coverDeck: 90, detailTitle: 60, detailSummary: 220 };
// 19.11 cümle kuralı: açıklama/özet hedefi KELİME cinsinden — karakter hedefi tutmadı (özet 301 → 301 → 295). uret.py ile aynı.
// 19.11 başlık kuralı: kapak başlığı da kelime cinsinden (45 karakter → karakter geri bildirimiyle 2. denemede hiç kısalmadı).
export const KELIME_HEDEF: Partial<Record<(typeof ALANLAR)[number], number>> = { coverTitle: 5, coverDeck: 12, detailSummary: 28 };
/** Python `len(s.split())` ile aynı: boşluk dizilerine göre böl, boş parçaları sayma. */
export const kelimeSay = (s: string) => s.split(/\s+/).filter(Boolean).length;
export const KISALTMA_YOLU =
  "- Kısaltma yolu: uzun kurum ve çalışma adlarını kısa biçimde an; laboratuvar ölçüm ayrıntılarını " +
  "(hücre hattı adı, IC50 gibi değerler) çıkar; tek ana fikir yaz. Kaynakta olmayan bilgi ekleme.";

/** Başarısız deterministik kapılar → modele gidecek ret satırları (uret.py kapi_sorunlari ile birebir; eşlik fikstürü kilitler). */
export function kapiSorunlari(gates: KapiSonucu[], e: Taslak): string[] {
  const out: string[] = [];
  let uzun = false;
  for (const [a, ok, d] of gates) {
    if (ok) continue;
    if (a !== "uzunluk") {
      out.push(`- ${a}: ${d}`);
      continue;
    }
    for (const k of ALANLAR) {
      const n = cpLen(e[k]);
      if (n > LIMITS[k]) {
        const kh = KELIME_HEDEF[k];
        if (kh !== undefined) {
          const w = kelimeSay(e[k]);
          out.push(`- uzunluk: ${k} ${n} karakter (${w} kelime); sınır ${LIMITS[k]} karakter. En çok ${kh} kelime yaz → en az ${Math.max(1, w - kh)} kelime çıkar.`);
        } else {
          out.push(`- uzunluk: ${k} ${n} karakter; sınır ${LIMITS[k]}. Hedef en çok ${HEDEF[k]} → en az ${n - HEDEF[k]} karakter kısalt.`);
        }
        uzun = true;
      } else if (n < MIN_LEN[k]) {
        out.push(`- uzunluk: ${k} ${n} karakter; en az ${MIN_LEN[k]} olmalı → en az ${MIN_LEN[k] - n} karakter uzat (yalnız kaynaktaki bilgiyle).`);
      }
    }
  }
  if (uzun) out.push(KISALTMA_YOLU);
  return out;
}

/**
 * Kısaltma adımına uygun mu? YALNIZ başarısız kapı "uzunluk" ise ve hiçbir alan alt sınırın altında değilse sınırı aşan
 * alanlar döner (sabit sırada); aksi hâlde boş (uret.py kisaltilacak_alanlar ile birebir; eşlik fikstürü kilitler).
 */
export function kisaltilacakAlanlar(gates: KapiSonucu[], e: Taslak): (typeof ALANLAR)[number][] {
  const kalan = gates.filter(([, ok]) => !ok).map(([a]) => a);
  if (kalan.length !== 1 || kalan[0] !== "uzunluk") return [];
  if (ALANLAR.some((k) => cpLen(e[k]) < MIN_LEN[k])) return [];
  return ALANLAR.filter((k) => cpLen(e[k]) > LIMITS[k]);
}

/** Kısaltma çağrısının kullanıcı mesajı — hedef kelime, metnin kendi ortalama kelime uzunluğundan (uret.py ile birebir). */
export function kisaltmaMesaji(e: Taslak, alanlar: readonly (typeof ALANLAR)[number][]): string {
  const hedefler = alanlar.map((k) => {
    const n = cpLen(e[k]);
    const w = kelimeSay(e[k]);
    const hk = Math.max(3, Math.floor((HEDEF[k] * w) / n));
    return `- ${k}: ${n} karakter (${w} kelime); sınır ${LIMITS[k]} karakter. En çok ${hk} kelime yaz.`;
  }).join("\n");
  const metin = ALANLAR.map((k) => `- ${k}: ${e[k]}`).join("\n");
  return `KISALTILACAK ALANLAR:\n${hedefler}\n\nMETİN:\n${metin}`;
}

/**
 * Bir üretim denemesinin kullanıcı mesajı (uret.py deneme_mesaji ile birebir; eşlik fikstürü kilitler). Yeniden denemede
 * reddedilen taslak alan alan karakter sayısıyla gösterilir — 18.11 ikinci koşu: taslağı görmeyen model "23 karakter kısalt"
 * denince sıfırdan yazıp yalnız 1–3 karakter kısalttı.
 */
export function denemeMesaji(akis: string, src: string, geri = "", onceki: Taslak | null = null): string {
  let user = `AKIŞ: ${akis}\n\nKAYNAK METNİ:\n${src}`;
  if (onceki) {
    const satirlar = ALANLAR.map((k) => `- ${k} (${cpLen(onceki[k])} karakter): ${onceki[k]}`).join("\n");
    user += `\n\nÖNCEKİ TASLAK:\n${satirlar}`;
  }
  if (geri) {
    user += `\n\nÖNCEKİ TASLAK REDDEDİLDİ. Nedenleri:\n${geri}\nBu sorunları gidererek yeniden yaz.`;
    if (onceki) user += " Sorunsuz alanları koruyabilir, sorunlu alanı önceki metni düzelterek yazabilirsin.";
  }
  return user;
}

/** Girdi/ortam hatası — model ÇAĞRILMADAN reddedilir (uç 400 döner). */
export class Hata extends Error {}

export type Edisyon = { day: string; rawBodyUtf8: string; rawBodySha256: string; testOnly?: boolean };
/** messages.create eşdeğeri (uçta trackedCreate). */
export type Olustur = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

export function edisyonOku(ed: unknown): { ed: Edisyon; items: EdisyonOgesi[] } {
  let e: Edisyon;
  let items: EdisyonOgesi[];
  try {
    e = ed as Edisyon;
    items = (JSON.parse(e.rawBodyUtf8) as { items: EdisyonOgesi[] }).items;
    if (!Array.isArray(items)) throw new TypeError("items");
  } catch (exc) {
    throw new Hata(`edisyon okunamadı: ${exc instanceof Error ? exc.name : "Error"}`);
  }
  if (createHash("sha256").update(e.rawBodyUtf8, "utf8").digest("hex") !== e.rawBodySha256 || e.testOnly) {
    throw new Hata("edisyon doğrulanamadı");
  }
  if (items.length !== 6) throw new Hata(`edisyonda 6 öğe yok (${items.length})`);
  return { ed: e, items };
}

/** Python `json.dumps(d, ensure_ascii=False)` biçimi (", " ve ": " ayırıcılı) — istem metni Python'la aynı kalsın. */
const pyDumps = (d: Record<string, string>) => "{" + Object.entries(d).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + "}";

// 19.11: 5 → 3 örneğe geri (18.11 koşusu: 5 örnek kısalık kazandırmadı, yalnız token + süre ekledi). uret.py ile aynı.
export const ORNEK_SAYISI = 3;

export function ornekler(excludeUrl: string): string {
  return ornekVerisi.items
    .filter((i) => i.sourceUrl !== excludeUrl)   // aynı haber örnek olarak verilmez
    .slice(0, ORNEK_SAYISI)
    .map((i) => pyDumps({ coverTitle: i.coverTitle, coverDeck: i.coverDeck, detailTitle: i.detailTitle, detailSummary: i.detailSummary }))
    .join("\n");
}

class Sayac {
  inp = 0;
  out = 0;
  calls = 0;
  constructor(readonly model: string) {}
  ekle(u: { input_tokens: number; output_tokens: number }) {
    this.inp += u.input_tokens;
    this.out += u.output_tokens;
    this.calls += 1;
  }
  usd(): number {
    const [pi, po] = PRICES[this.model] ?? [0, 0];
    return Math.round((this.inp / 1e6 * pi + this.out / 1e6 * po) * 1e5) / 1e5;
  }
}

type KapiKaydi = { ad: string; gecti: boolean; ayrinti: string };
export type Deneme =
  | { deneme: number; hata: string }
  | { deneme: number; taslak: Taslak; kapilar: KapiKaydi[]; kisaltma?: Kisaltma; dogrulama?: Iddia[]; sablon?: "ictihat"; sonuc: "GECTI" | "KALDI" };
/** Kısaltma adımı izi: `taslak`/`kapilar` kısaltma ÖNCESİ; kaydın kendi taslak/kapilar alanları kısaltma SONRASI. */
export type Kisaltma = { alanlar: (typeof ALANLAR)[number][]; taslak: Taslak; kapilar: KapiKaydi[]; hata?: string };
export type OgeKaydi = {
  n: number; itemId: string | null; sourceUrl: string | null; streamLabel: string; kaynakOkundu: boolean; kaynakHatasi: string | null;
  sonuc: "GECTI" | "KALDI"; denemeler: Deneme[]; taslak: Taslak | null;
};
export type QaEditoryal = {
  kind: "karusel-editoryal"; uretici: "vercel"; day: string; model: string; editionRawSha256: string; gun: "GECTI" | "KALDI";
  denemeSiniri: number; cagri: number; girisToken: number; cikisToken: number; tahminiUsd: number; sureSn: number; ogeler: OgeKaydi[];
};

/** v3 çizicinin beklediği şema; görseller sabit adlarla (gorseller/kapak.png · gorseller/haber-N.png). Alan sırası uret.py ile aynı. */
export function editorialKur(day: string, edSha: string, model: string, rows: OgeKaydi[]) {
  return {
    schemaVersion: 1, day, origin: `otomatik (${model}); insan onayı yok — kapılar + ikinci model doğrulaması`,
    edition: { rawBodySha256: edSha }, leadImage: { path: "gorseller/kapak.png", caption: LEAD_CAPTION },
    items: rows.map((r) => ({
      // itemId: çizici bağlantısız (içtihat) öğeyi bununla eşler — URL'si null iki öğe yer değiştiremesin.
      ...(r.itemId ? { itemId: r.itemId } : {}),
      sourceUrl: r.sourceUrl, coverCategory: r.streamLabel, detailCategory: r.streamLabel,
      coverTitle: r.taslak!.coverTitle, coverDeck: r.taslak!.coverDeck, detailTitle: r.taslak!.detailTitle, detailSummary: r.taslak!.detailSummary,
      image: `gorseller/haber-${r.n}.png`,
    })),
  };
}
export type Editorial = ReturnType<typeof editorialKur>;

const kisa = (e: unknown, n: number) => [...(e instanceof Error ? e.message : String(e))].slice(0, n).join("");

function taslakDogrula(v: unknown): Taslak {
  const o = v as Record<string, unknown>;
  if (!o || typeof o !== "object" || !ALANLAR.every((k) => typeof o[k] === "string")) throw new Error("taslak biçimi geçersiz");
  // Alan sırası sabitlenir (modelin döndürdüğü sıra değil) — kayıt ve editorial her koşuda aynı biçimde yazılsın.
  return { coverTitle: o.coverTitle as string, coverDeck: o.coverDeck as string, detailTitle: o.detailTitle as string, detailSummary: o.detailSummary as string };
}

function iddialarDogrula(v: unknown): Iddia[] {
  let liste = (v as { iddialar?: unknown })?.iddialar;
  if (typeof liste === "string") {
    try { liste = JSON.parse(liste); } catch { /* aşağıda reddedilir */ }
  }
  if (!Array.isArray(liste)) throw new Error("doğrulama biçimi geçersiz");
  return liste.map((x) => {
    const i = x as Record<string, unknown>;
    if (!ALANLAR.includes(i?.alan as never) || !ETIKETLER.includes(i?.etiket as never) || typeof i.iddia !== "string" || typeof i.gerekce !== "string") {
      throw new Error("doğrulama biçimi geçersiz");
    }
    return { alan: i.alan as Iddia["alan"], iddia: i.iddia, etiket: i.etiket as Etiket, gerekce: i.gerekce };
  });
}

export type CalistirSecenek = { olustur: Olustur; getir: Getir; model?: string; simdi?: () => number };

/** Bir günün editoryal taslağı: QA kaydı HER durumda, editorial yalnız 6/6 GEÇTİ'de. */
export async function calistir(edGirdi: unknown, o: CalistirSecenek): Promise<{ qa: QaEditoryal; editorial: Editorial | null }> {
  const model = o.model || DEFAULT_MODEL;
  const simdi = o.simdi ?? Date.now;
  const { ed, items } = edisyonOku(edGirdi);   // model çağrısından ÖNCE girdi denetimi
  const sayac = new Sayac(model);
  const rows: OgeKaydi[] = [];
  const t0 = simdi();

  async function cagir(system: string, user: string, tool: Anthropic.Tool): Promise<unknown> {
    const r = await o.olustur({
      ...modelParams(model, "low"), max_tokens: 4000, system, messages: [{ role: "user", content: user }],
      tools: [tool], tool_choice: { type: "tool", name: tool.name },
    });
    sayac.ekle(r.usage);
    if (r.stop_reason === "refusal") throw new Error("model reddetti");
    const blok = r.content.find((b) => b.type === "tool_use");
    if (r.stop_reason === "max_tokens" || !blok || blok.type !== "tool_use") throw new Error(`eksik yanıt (stop_reason=${r.stop_reason})`);
    return blok.input;
  }

  for (const [idx, item] of items.entries()) {
    const n = idx + 1;
    // İçtihat: sabah kartının yolu — künye + konu satırından şablon; model ve kaynak sayfa YOK (ictihat.ts).
    // Kapılar yine koşar; ikinci model doğrulaması yerine kalite kapısı metni yeniden üretip karşılaştırır.
    if (ictihatMi(item)) {
      const src = edisyonMetni(item);
      const e = ictihatTaslagi(item);
      const gates = check(e, item, src, n);
      const ok = gates.every(([, g]) => g);
      rows.push({
        n, itemId: item.id ?? null, sourceUrl: item.url, streamLabel: item.streamLabel, kaynakOkundu: false, kaynakHatasi: null,
        sonuc: ok ? "GECTI" : "KALDI", taslak: ok ? e : null,
        denemeler: [{ deneme: 1, taslak: e, kapilar: gates.map(([ad, gecti, ayrinti]) => ({ ad, gecti, ayrinti })), sablon: "ictihat", sonuc: ok ? "GECTI" : "KALDI" }],
      });
      continue;
    }
    // İçtihat dışı öğede bağlantı ZORUNLU: metnin tek dayanağı kaynak sayfadır → bağlantısız öğe fail-closed düşer.
    if (!item.url) {
      rows.push({
        n, itemId: item.id ?? null, sourceUrl: null, streamLabel: item.streamLabel, kaynakOkundu: false, kaynakHatasi: "bağlantı yok",
        sonuc: "KALDI", taslak: null, denemeler: [{ deneme: 1, hata: "içtihat dışı öğede bağlantı yok" }],
      });
      continue;
    }
    const pkt = await collect(item, o.getir);
    const src = sourceText(pkt);
    const log: Deneme[] = [];
    let geri = "";
    let kabul: Taslak | null = null;
    let onceki: Taslak | null = null;
    for (let deneme = 1; deneme <= DENEME_SAYISI; deneme++) {
      const user = denemeMesaji(item.streamLabel, src, geri, onceki);
      let e: Taslak;
      try {
        e = taslakDogrula(await cagir(SYSTEM_URET.replace("{ornekler}", ornekler(item.url)), user, TASLAK_TOOL));
      } catch (exc) {   // bir deneme düşer, gün devam eder
        log.push({ deneme, hata: kisa(exc, 300) });
        geri = "Yanıt alınamadı; kurallara uyarak yeniden yaz.";
        continue;
      }
      let gates = check(e, item, src, n);
      const kayit = (g: KapiSonucu[]) => g.map(([ad, gecti, ayrinti]) => ({ ad, gecti, ayrinti }));
      let kisaltma: Kisaltma | undefined;
      const alanlar = kisaltilacakAlanlar(gates, e);
      if (alanlar.length) {   // yalnız uzunluk kaldıysa: ayrı çağrıda yalnız uzun alan kısaltılır (öteki alanlar KODDA korunur)
        kisaltma = { alanlar, taslak: e, kapilar: kayit(gates) };
        try {
          const k = taslakDogrula(await cagir(SYSTEM_KISALT, kisaltmaMesaji(e, alanlar), KISALTMA_TOOL));
          const yeni: Taslak = { ...e };
          for (const a of alanlar) yeni[a] = k[a];
          e = yeni;
          gates = check(e, item, src, n);
        } catch (exc) {
          kisaltma.hata = kisa(exc, 200);
        }
      }
      const sorun = kapiSorunlari(gates, e);
      const rec: Extract<Deneme, { taslak: Taslak }> = {
        deneme, taslak: e, kapilar: kayit(gates), ...(kisaltma ? { kisaltma } : {}), sonuc: "KALDI",
      };
      if (!sorun.length) {   // deterministik kapılar geçtiyse ikinci model doğrulaması
        try {
          const v = iddialarDogrula(await cagir(SYSTEM_DOGRULA,
            `KAYNAK METNİ:\n${src}\n\nDENETLENECEK METİN:\n${JSON.stringify(e, null, 1)}`, DOGRULAMA_TOOL));
          rec.dogrulama = v;
          sorun.push(...v.filter((i) => i.etiket !== "desteklenir").map((i) => `- ${i.alan}: "${i.iddia}" → ${i.etiket} (${i.gerekce})`));
          if (!v.length) sorun.push("- doğrulama hiç iddia çıkarmadı");
        } catch (exc) {
          sorun.push(`- doğrulama yapılamadı: ${kisa(exc, 200)}`);
        }
      }
      rec.sonuc = sorun.length ? "KALDI" : "GECTI";
      log.push(rec);
      if (!sorun.length) {
        kabul = e;
        break;
      }
      geri = sorun.join("\n");
      onceki = e;
    }
    rows.push({
      n, itemId: item.id ?? null, sourceUrl: item.url, streamLabel: item.streamLabel, kaynakOkundu: pkt.fetchedOk, kaynakHatasi: pkt.error,
      sonuc: kabul ? "GECTI" : "KALDI", denemeler: log, taslak: kabul,
    });
  }

  const gecti = rows.length === 6 && rows.every((r) => r.taslak);
  const qa: QaEditoryal = {
    kind: "karusel-editoryal", uretici: "vercel", day: ed.day, model, editionRawSha256: ed.rawBodySha256, gun: gecti ? "GECTI" : "KALDI",
    denemeSiniri: DENEME_SAYISI, cagri: sayac.calls, girisToken: sayac.inp, cikisToken: sayac.out, tahminiUsd: sayac.usd(),
    sureSn: Math.round((simdi() - t0) / 100) / 10, ogeler: rows,
  };
  return { qa, editorial: gecti ? editorialKur(ed.day, ed.rawBodySha256, model, rows) : null };
}
