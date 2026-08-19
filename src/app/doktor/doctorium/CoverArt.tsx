import { createElement } from "react";
import { Stethoscope } from "lucide-react";
import type { FeedItem } from "@/lib/doctorium";
import { branchColor, resolveBranchKey } from "@/lib/branch-visuals";
import { BRANCH_ICONS, type BranchIconLike } from "@/components/branch-icons";

/**
 * Doctorium kapak görseli (v6.99.6 — kullanıcı netleştirmeleri 2026-08-16, üç tur).
 *
 * BRANŞ SEMBOLLERİ = lucide ikon seti (src/components/branch-icons.tsx; referans: saç ekimi =
 * Crown). Kullanıcı 2026-08-16: "sembolleri ikinci kez yanlışlıkla yazmışım, son yaptığını geri
 * al" → v6.99.5'in public/branches/*-symbol.svg dönüşü GERİ ALINDI; v6.99.3'ün lucide yaklaşımı
 * geçerli. public/branches SVG'leri hasta tarafının arşiv varlığı olarak durur, kapaklarda YOK.
 *
 *   · AKADEMİK + branşlı içerik → branş ikonu, branş renginde, koyu plaka + neon ışıma.
 *   · Diğer bölümler → public/doctorium/*.webp (Higgsfield; ince neon çizgi + gömülü koyu
 *     zemin #0D0E10). Hukuk türleri 2026-08-14 sembol kararıyla hizalı: terazi=mevzuat ·
 *     tokmak=içtihat · kitap=doktrin.
 *   · BAND boyunda ULUSLARARASI haber kaynakları LOGO + AÇIK URL gösterir (kullanıcı kararı
 *     2026-08-16: 21:9 üretilmiş bantlar beğenilmedi → kaynağın kendi yazı/logosu + altında
 *     açık adresi). Logolar değiştirilmeden kullanılır (nominatif kaynak gösterimi) → plaka
 *     rengi logoya uyar: Medscape siyah-yazılı → BEYAZ plaka; MedicalXpress beyaz-yazılı →
 *     koyu plaka. WHO'ya logo BİLİNÇLİ yok (WHO amblem kullanımı izne tabi) — sembol bandında.
 *
 * Künye damgası "band" boyunda alt şerittedir; logo kaynaklarında şerit AÇIK URL yazar.
 *
 * TEMA (v6.99.7, kullanıcı bildirimi 2026-08-16: "gündüz temasında sembollerin arkası siyah
 * kaldı"): koyu zemin webp'lerin İÇİNE gömülü olduğundan CSS ile değişmiyordu → her sembolün
 * public/doctorium/light/ altında GÜNDÜZ varyantı var (zemin şeffaf + çizgiler hue korunarak
 * koyulaştırılmış). 🪤 İlk deneme temayı SUNUCUDA cookie'den okumuştu — YANLIŞ: ThemeToggle
 * yalnız html class'ını (theme-dark↔theme-light) ANINDA değiştirir, RSC yeniden render olmaz →
 * toggle sonrası görseller eski temada asılı kalıyordu. Doğru desen bu dosyada: İKİ varyant da
 * basılır, hangisinin görüneceğine CSS karar verir ([.theme-light_&] arbitrary variant) —
 * toggle'a JS'siz, anında uyum. Plaka da aynı yolla tema-duyarlı. Lucide branş ikonunun neon
 * drop-shadow'u gündüzde !filter-none ile kapatılır (inline style'ı important ezer).
 * İSTİSNA: logo plakaları temadan bağımsız (MedicalXpress logosu beyaz yazılı = daima koyu
 * plaka; Medscape daima beyaz — logo bütünlüğü).
 */

// ArticleCard MODULE_EYEBROW ile aynı hex'ler — band künye şeridinin yazı rengi.
const MODULE_COLOR: Record<string, string> = {
  akademik: "#34d399",
  sektorel: "#a78bfa",
  ilac: "#22d3ee",
  mevzuat: "#fb7185",
  etkinlik: "var(--c-ink)",
  kariyer: "#60a5fa",
};

/** Uluslararası haber kaynağı → logosu + açık URL'si (yalnız detay bandı). */
const SOURCE_LOGOS: Record<string, { src: string; url: string; bg: string; logoH: number }> = {
  // Yükseklikler "zoom out" turunda küçültüldü (2026-08-16 kullanıcı bildirimi: bantta
  // logolar fazla büyük duruyordu — 40/44/48 → 28/32/34).
  // Medscape wordmark'ı siyah+mavi (açık zemin logosu) → beyaz plaka şart.
  medscape: { src: "/doctorium/logo-medscape.webp", url: "medscape.com/today", bg: "#ffffff", logoH: 28 },
  // MedicalXpress yazısı beyaz (koyu zemin logosu) → sembollerle aynı koyu plaka.
  medicalxpress: { src: "/doctorium/logo-medicalxpress.webp", url: "medicalxpress.com", bg: "#0d0e10", logoH: 32 },
  // WHO — sitenin KENDİ koyu-zemin varyantı (h-logo-white.svg, who.int; kullanıcı kararı
  // 2026-08-16 — amblem kullanımı hukukçu değerlendirmesinde). SVG = her boyutta keskin.
  who: { src: "/doctorium/logo-who.svg", url: "who.int", bg: "#0d0e10", logoH: 34 },
};

/**
 * Hukuk türü → yassı detay bandı (kullanıcı seçimi 2026-08-16; "bant boyu kısalsın" turunda
 * letterbox kompozisyonla yeniden üretilip içeriğe kırpıldı — oranlar ~4.2-5.4:1):
 * mevzuat = terazi + silik § + belge satırları · içtihat = tokmak + yankı halkaları ·
 * doktrin = açık kitap + sütun. Tema-duyarlı: light/ varyantları var (ThemedSymbol basar).
 * 🪤 Üretimde stil referansından MOTİF sızabiliyor (ilk mevzuat bandına kardiyoloji kalbi
 * girdi) — yeni bant üretirken prompt'a "match only the STYLE not the subject" + yasaklı
 * motif listesi yaz ve sonucu GÖZLE kontrol et.
 */
const LEGAL_BANDS: Record<string, string> = {
  mevzuat: "/doctorium/band-mevzuat.webp",
  ictihat: "/doctorium/band-ictihat.webp",
  doktrin: "/doctorium/band-doktrin.webp",
};

/** Akademik + branşlı içerik → AURA branş ikonu; yoksa null (mikroskop webp fallback). */
function branchIconOf(item: Pick<FeedItem, "module" | "branchSlugs">): { Icon: BranchIconLike; color: string } | null {
  if (item.module !== "akademik") return null;
  for (const s of item.branchSlugs) {
    const key = resolveBranchKey(s);
    if (key) return { Icon: BRANCH_ICONS[key] ?? Stethoscope, color: branchColor(key) };
  }
  return null;
}

/** İçerik → sembol dosyası (branş ikonu OLMAYAN her şey). Bilinmeyen modül sektörele düşer. */
export function symbolSrc(item: Pick<FeedItem, "module" | "kind">): string {
  if (item.module === "akademik") return "/doctorium/akademik-genel.webp";
  if (item.module === "mevzuat") {
    if (item.kind === "ictihat") return "/doctorium/hukuk-ictihat.webp";
    if (item.kind === "doktrin") return "/doctorium/hukuk-doktrin.webp";
    return "/doctorium/hukuk-mevzuat.webp";
  }
  if (item.module === "ilac") return "/doctorium/ilac.webp";
  // Görsel dosya adı "kongre.webp" KALDI (v6.120 rename'i public/ varlıklarını taşımadı —
  // dosya adı kullanıcıya görünmez, taşımak CDN önbelleğini boşuna ısıtırdı).
  if (item.module === "etkinlik") return "/doctorium/kongre.webp";
  if (item.module === "kariyer") return "/doctorium/kariyer.webp";
  return "/doctorium/sektorel.webp";
}

/** Band künye damgası: içtihatta esas no; kalanında kaynak adı (kelime sınırında kesilir). */
function stampOf(item: Pick<FeedItem, "kind" | "title" | "sourceName">, max: number): string {
  if (item.kind === "ictihat") {
    const e = /E\.\s*[\d/]+/.exec(item.title)?.[0];
    if (e) return e.toUpperCase();
  }
  const name = item.sourceName.replace(/\s+/g, " ").trim();
  const abbr = /\(([^)]{2,12})\)/.exec(name)?.[1];
  if (abbr && abbr.length <= max) return abbr.toUpperCase();
  const words = name.toUpperCase().split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || words[0].slice(0, max);
}

/** Sembolün gündüz varyantı yolu (public/doctorium/light/…). */
function lightSrc(src: string): string {
  return src.replace("/doctorium/", "/doctorium/light/");
}

/** İki tema varyantını da basar; hangisi görünür CSS seçer (toggle'a anında uyum). */
function ThemedSymbol({ src, className }: { src: string; className: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- yerel statik varlık (3-22 KB webp);
          next/image sabit küçük kutular için ek katman getirir, kazanç yok. */}
      <img src={src} alt="" className={`${className} [.theme-light_&]:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- yukarıdaki gerekçeyle aynı. */}
      <img src={lightSrc(src)} alt="" className={`${className} hidden [.theme-light_&]:block`} />
    </>
  );
}

// Plaka: gece gömülü-sembol koyusu, gündüz açık yüzey token'ı — CSS karar verir.
const PLATE = "bg-[#0d0e10] [.theme-light_&]:bg-[var(--c-surface-2)]";
// Lucide ikon sarmalayıcısı: neon glow inline style'da; gündüzde important ile kapanır.
const GLOW_OFF = "grid place-items-center [.theme-light_&]:![filter:none]";

export function CoverArt({
  item,
  size,
}: {
  item: Pick<FeedItem, "id" | "module" | "kind" | "source" | "title" | "sourceName" | "branchSlugs">;
  size: "card" | "band" | "thumb";
}) {
  const branch = branchIconOf(item);

  // thumb (Editoryal Manşet turu, 2026-08-16 — 2. tur kullanıcı ayarı): kart KÜNYESİNİN minyatürü.
  // YALNIZ akademik kartlarda çizilir (branş ikonu = bilgi); webp semboller satırlarda TEKRAR
  // ürettiği için ("aynı mor gazete × 20" duvarı) bilinçli yok — null döner, kart sembolsüz akar.
  // 32px: künye satırına oturur, üst çizgi (künyenin alt sınırı) sembolün de altından geçer.
  if (size === "thumb") {
    if (!branch) return null;
    return (
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md ${PLATE}`}
        aria-hidden="true"
      >
        <span className={GLOW_OFF} style={{ filter: `drop-shadow(0 0 4px ${branch.color}80)` }}>
          {createElement(branch.Icon, { size: 18, color: branch.color, strokeWidth: 1.9 })}
        </span>
      </div>
    );
  }

  if (size === "card") {
    return (
      // Plaka tema-duyarlı; branş ikonu her iki zeminde de branş rengiyle çizilir (BranchAvatar
      // hasta tarafında aynı renkleri beyaz kutuda kullanır — gündüz kontrastı kanıtlı).
      <div
        className={`grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl ${PLATE}`}
        aria-hidden="true"
      >
        {branch ? (
          <span className={GLOW_OFF} style={{ filter: `drop-shadow(0 0 6px ${branch.color}80)` }}>
            {createElement(branch.Icon, { size: 38, color: branch.color, strokeWidth: 1.9 })}
          </span>
        ) : (
          <ThemedSymbol src={symbolSrc(item)} className="h-[72px] w-[72px] object-cover" />
        )}
      </div>
    );
  }

  // band — detay üst bandı: kaynak logosu > hukuk 21:9 bandı > branş ikonu > modül sembolü.
  const logo = SOURCE_LOGOS[item.source];
  const legalBand = item.module === "mevzuat" ? LEGAL_BANDS[item.kind] : undefined;
  const c = MODULE_COLOR[item.module] ?? "var(--c-ink-3)";
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-hairline)]" aria-hidden="true">
      <div
        // Logo plakası temadan bağımsız (logo bütünlüğü); sembol plakası tema-duyarlı.
        // Hukuk bandında sabit yükseklik YOK — kutu, 21:9 görselin kendi oranına uyar
        // (sabit 120px overflow-hidden ile bandı kırpıyordu — "zoom" dersi).
        className={`grid place-items-center ${legalBand ? "" : "h-[120px]"} ${logo ? "" : PLATE}`}
        style={logo ? { background: logo.bg } : undefined}
      >
        {logo ? (
          /* eslint-disable-next-line @next/next/no-img-element -- kaynak logosu (nominatif
             gösterim); yerel kopya, boyut sabit — next/image katmanı gereksiz. */
          <img src={logo.src} alt={item.sourceName} style={{ height: logo.logoH }} className="w-auto" />
        ) : legalBand ? (
          // 🪤 "zoom" dersi (2026-08-16): sabit 120px kutu + object-cover, 21:9 görseli ~5.6:1
          // şeride kırpıp ortasını BÜYÜTÜYORDU (terazi/tokmak dev görünüyordu). Bant kendi
          // oranında tam gösterilir (w-full h-auto — kutu yüksekliği görselden gelir).
          <ThemedSymbol src={legalBand} className="w-full h-auto" />
        ) : branch ? (
          <span className={GLOW_OFF} style={{ filter: `drop-shadow(0 0 10px ${branch.color}80)` }}>
            {createElement(branch.Icon, { size: 72, color: branch.color, strokeWidth: 1.6 })}
          </span>
        ) : (
          <ThemedSymbol src={symbolSrc(item)} className="h-[120px] w-auto" />
        )}
      </div>
      <div
        className="aura-mono border-t px-4 py-1.5 text-[10px] font-bold tracking-[0.16em]"
        style={{ color: c, borderColor: "var(--c-hairline)", background: "var(--c-surface)" }}
      >
        {logo ? logo.url.toUpperCase() : stampOf(item, 26)}
      </div>
    </div>
  );
}
