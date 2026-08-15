import type { FeedItem } from "@/lib/doctorium";
import { hasBranchVisual } from "@/lib/branch-visuals";

/**
 * Doctorium kapak görseli (v6.99.2 — kullanıcı kararı 2026-08-16: SEMBOL-tabanlı).
 *
 * İlk sürüm (v6.99.1) koddan üretilen soyut SVG desendi; kullanıcı kararıyla süperseder:
 * "branşlar için kullandığımız semboller vardı zaten, onları kullanalım; diğerleri için bu
 * sembolleri esas alarak Higgsfield üzerinden bir çalışma yapalım."
 *
 *   · AKADEMİK + branşlı içerik → mevcut branş sembolü (public/branches/{slug}-symbol.svg —
 *     2026-07-13 Faz C üretimi, 30 branş; hasBranchVisual doğrular).
 *   · Diğer bölümler → public/doctorium/*.webp (2026-08-16 Higgsfield üretimi, nano_banana;
 *     stil referansı kardiyoloji branş sembolüydü — aynı dil: ince neon çizgi + koyu zemin).
 *     Hukukta tür ayrımı sembol kararıyla (2026-08-14) hizalı: terazi=mevzuat · tokmak=içtihat ·
 *     kitap=doktrin.
 *
 * Sembollerin zemini SVG/PNG içinde GÖMÜLÜ koyu (#0D0E10) → iki temada da "koyu plaka" olarak
 * durur; tema-duyarlı yeniden boyama gerekmez (branş sembolleriyle aynı davranış).
 * Künye damgası yalnız "band" boyunda (alt şerit); 72px kartta damga okunmaz, sembol yalın kalır.
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

/** İçerik → sembol dosyası. Bilinmeyen modül sektörel sembolüne düşer (kapaksız kart olmaz). */
export function symbolSrc(item: Pick<FeedItem, "module" | "kind" | "branchSlugs">): string {
  if (item.module === "akademik") {
    const slug = item.branchSlugs.find((s) => hasBranchVisual(s));
    return slug ? `/branches/${slug}-symbol.svg` : "/doctorium/akademik-genel.webp";
  }
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

export function CoverArt({
  item,
  size,
}: {
  item: Pick<FeedItem, "id" | "module" | "kind" | "title" | "sourceName" | "branchSlugs">;
  size: "card" | "band";
}) {
  const src = symbolSrc(item);

  if (size === "card") {
    return (
      // Zemin sembolün gömülü koyusuyla aynı — SVG kenar boşluklarında renk sıçraması olmasın.
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-[#0d0e10]" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- yerel statik varlık; next/image
            72px sabit kutu için ek katman getirir, optimizasyon kazancı yok (dosyalar 4-7 KB webp). */}
        <img src={src} alt="" width={72} height={72} className="block h-full w-full object-cover" />
      </div>
    );
  }

  // band — detay sayfası üst bandı: koyu plaka içinde sembol, altta künye şeridi.
  const c = MODULE_COLOR[item.module] ?? "var(--c-ink-3)";
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-hairline)]" aria-hidden="true">
      <div className="flex h-[140px] items-center justify-center bg-[#0d0e10]">
        {/* eslint-disable-next-line @next/next/no-img-element -- yukarıdaki gerekçeyle aynı. */}
        <img src={src} alt="" className="block h-full w-auto" />
      </div>
      <div
        className="aura-mono border-t px-4 py-1.5 text-[10px] font-bold tracking-[0.16em]"
        style={{ color: c, borderColor: "var(--c-hairline)", background: "var(--c-surface)" }}
      >
        {stampOf(item, 26)}
      </div>
    </div>
  );
}
