import type { FeedItem } from "@/lib/doctorium";
import { hasBranchVisual, resolveBranchKey } from "@/lib/branch-visuals";

/**
 * Doctorium kapak görseli (v6.99.5 — kullanıcı netleştirmesi 2026-08-16).
 *
 * Branş sembolleri = HASTA BÖLÜMÜNÜN 30 branş sembolü (public/branches/{slug}-symbol.svg —
 * "aura hasta bölümüne bak, orada bütün branşlar için semboller mevcut"). v6.99.3'ün lucide
 * ikon denemesi SÜPERSEDE (o set kartlarda fazla sade kaldı; lucide seti BranchAvatar'da yaşar).
 *
 *   · AKADEMİK + branşlı içerik → public/branches/{slug}-symbol.svg (30 branş; Faz C üretimi).
 *   · Diğer bölümler → public/doctorium/*.webp (2026-08-16 Higgsfield; aynı dil: ince neon
 *     çizgi + gömülü koyu zemin #0D0E10). Hukuk türleri 2026-08-14 sembol kararıyla hizalı:
 *     terazi=mevzuat · tokmak=içtihat · kitap=doktrin.
 *   · BAND boyunda ULUSLARARASI haber kaynakları (medscape/medicalxpress/who) kaynak-BANDI
 *     görseli alır (public/doctorium/band-*.webp, 21:9): og/RSS görselleri düşük kaliteydi
 *     (küçük thumbnail + Getty riski) → kullanıcı kararı 2026-08-16: "standart üzerinde görsel
 *     çekilemiyorsa kaynak için tasarlanmış üst bant kullanılır".
 *
 * Semboller gömülü koyu zeminli (#0D0E10) → iki temada da "koyu plaka"; tema boyama yok.
 * Künye damgası yalnız "band" boyunda; 72px kartta damga okunmaz, sembol yalın kalır.
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

/**
 * Uluslararası haber kaynağı → tasarlanmış üst bant (yalnız detay bandında; kart 72px karede
 * 21:9 bant ezilir — kart sektörel sembolünde kalır). Kaynak adı görselde YOK (marka taklidi
 * riski) — kimliği alttaki künye şeridi yazar.
 */
const SOURCE_BANDS: Record<string, string> = {
  medscape: "/doctorium/band-medscape.webp",
  medicalxpress: "/doctorium/band-medicalxpress.webp",
  who: "/doctorium/band-who.webp",
};

/** Akademik + branşlı içerik → hasta bölümünün branş sembolü; yoksa null (webp fallback). */
function branchSymbolSrc(item: Pick<FeedItem, "module" | "branchSlugs">): string | null {
  if (item.module !== "akademik") return null;
  for (const s of item.branchSlugs) {
    const key = resolveBranchKey(s);
    if (key && hasBranchVisual(key)) return `/branches/${key}-symbol.svg`;
  }
  return null;
}

/** İçerik → sembol dosyası (branş sembolü OLMAYAN her şey). Bilinmeyen modül sektörele düşer. */
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

export function CoverArt({
  item,
  size,
}: {
  item: Pick<FeedItem, "id" | "module" | "kind" | "source" | "title" | "sourceName" | "branchSlugs">;
  size: "card" | "band";
}) {
  const branchSrc = branchSymbolSrc(item);

  if (size === "card") {
    return (
      // Zemin sembollerin gömülü koyusuyla aynı — kenar boşluklarında renk sıçraması olmasın.
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-[#0d0e10]" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- yerel statik varlık; next/image
            72px sabit kutu için ek katman getirir, kazanç yok (webp'ler 3-7 KB, SVG'ler ~3 KB). */}
        <img src={branchSrc ?? symbolSrc(item)} alt="" width={72} height={72} className="block h-full w-full object-cover" />
      </div>
    );
  }

  // band — detay üst bandı: kaynak bandı (uluslararası haber) > branş sembolü > modül sembolü.
  const bandSrc = SOURCE_BANDS[item.source];
  const c = MODULE_COLOR[item.module] ?? "var(--c-ink-3)";
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-hairline)]" aria-hidden="true">
      <div className="flex h-[140px] items-center justify-center bg-[#0d0e10]">
        {/* eslint-disable-next-line @next/next/no-img-element -- yukarıdaki gerekçeyle aynı. */}
        <img
          src={bandSrc ?? branchSrc ?? symbolSrc(item)}
          alt=""
          className={bandSrc ? "block h-full w-full object-cover" : "block h-full w-auto"}
        />
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
