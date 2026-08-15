import { createElement } from "react";
import { cookies } from "next/headers";
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
 * public/doctorium/light/ altında GÜNDÜZ varyantı üretildi (zemin şeffaf + çizgiler hue
 * korunarak koyulaştırılmış); plaka rengi aura_theme cookie'sine göre seçilir (bileşen bu
 * yüzden async — layout'un tema SSR'ıyla aynı kaynak). Lucide branş ikonlarında gündüzde
 * neon drop-shadow kapatılır. İSTİSNA: logo plakaları temadan bağımsız (MedicalXpress logosu
 * beyaz yazılı = daima koyu plaka; Medscape daima beyaz plaka — logo bütünlüğü).
 */

// ArticleCard MODULE_EYEBROW ile aynı hex'ler — band künye şeridinin yazı rengi.
const MODULE_COLOR: Record<string, string> = {
  akademik: "#34d399",
  sektorel: "#a78bfa",
  ilac: "#22d3ee",
  mevzuat: "#fb7185",
  kongre: "var(--c-ink)",
  kariyer: "#60a5fa",
};

/** Uluslararası haber kaynağı → logosu + açık URL'si (yalnız detay bandı). */
const SOURCE_LOGOS: Record<string, { src: string; url: string; bg: string; logoH: number }> = {
  // Medscape wordmark'ı siyah+mavi (açık zemin logosu) → beyaz plaka şart.
  medscape: { src: "/doctorium/logo-medscape.webp", url: "medscape.com/today", bg: "#ffffff", logoH: 40 },
  // MedicalXpress yazısı beyaz (koyu zemin logosu) → sembollerle aynı koyu plaka.
  medicalxpress: { src: "/doctorium/logo-medicalxpress.webp", url: "medicalxpress.com", bg: "#0d0e10", logoH: 44 },
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
  if (item.module === "kongre") return "/doctorium/kongre.webp";
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

export async function CoverArt({
  item,
  size,
}: {
  item: Pick<FeedItem, "id" | "module" | "kind" | "source" | "title" | "sourceName" | "branchSlugs">;
  size: "card" | "band";
}) {
  const branch = branchIconOf(item);
  // Gece varsayılan (v6.22) — cookie yoksa/dark ise koyu plaka + koyu-zeminli semboller.
  const isLight = (await cookies()).get("aura_theme")?.value === "light";
  const plate = isLight ? "var(--c-surface-2)" : "#0d0e10";
  const sym = (i: Pick<FeedItem, "module" | "kind">) =>
    isLight ? symbolSrc(i).replace("/doctorium/", "/doctorium/light/") : symbolSrc(i);
  const glow = (color: string, r: number) =>
    isLight ? undefined : { filter: `drop-shadow(0 0 ${r}px ${color}80)` };

  if (size === "card") {
    return (
      // Plaka tema-duyarlı; branş ikonu her iki zeminde de branş rengiyle çizilir (BranchAvatar
      // hasta tarafında aynı renkleri beyaz kutuda kullanır — gündüz kontrastı kanıtlı).
      <div
        className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl"
        style={{ background: plate }}
        aria-hidden="true"
      >
        {branch ? (
          createElement(branch.Icon, {
            size: 38, color: branch.color, strokeWidth: 1.9,
            ...{ style: glow(branch.color, 6) },
          })
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- yerel statik varlık; next/image
             72px sabit kutu için ek katman getirir, kazanç yok (webp'ler 3-22 KB). */
          <img src={sym(item)} alt="" width={72} height={72} className="block h-full w-full object-cover" />
        )}
      </div>
    );
  }

  // band — detay üst bandı: kaynak logosu (uluslararası haber) > branş ikonu > modül sembolü.
  const logo = SOURCE_LOGOS[item.source];
  const c = MODULE_COLOR[item.module] ?? "var(--c-ink-3)";
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-hairline)]" aria-hidden="true">
      <div
        className="grid h-[120px] place-items-center"
        // Logo plakası temadan bağımsız (logo bütünlüğü); sembol plakası tema-duyarlı.
        style={{ background: logo?.bg ?? plate }}
      >
        {logo ? (
          /* eslint-disable-next-line @next/next/no-img-element -- kaynak logosu (nominatif
             gösterim); yerel kopya, boyut sabit — next/image katmanı gereksiz. */
          <img src={logo.src} alt={item.sourceName} style={{ height: logo.logoH }} className="w-auto" />
        ) : branch ? (
          createElement(branch.Icon, {
            size: 72, color: branch.color, strokeWidth: 1.6,
            ...{ style: glow(branch.color, 10) },
          })
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- yukarıdaki gerekçeyle aynı. */
          <img src={sym(item)} alt="" className="block h-full w-auto" />
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
