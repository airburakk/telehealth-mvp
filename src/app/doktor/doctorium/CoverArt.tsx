import { createElement } from "react";
import { Stethoscope } from "lucide-react";
import type { FeedItem } from "@/lib/doctorium";
import { branchColor, resolveBranchKey } from "@/lib/branch-visuals";
import { BRANCH_ICONS, type BranchIconLike } from "@/components/branch-icons";

/**
 * Doctorium kapak görseli (v6.99.3 — kullanıcı düzeltmesi 2026-08-16).
 *
 * Kullanıcı kararı: "branşlar için AURA'da HALİHAZIRDA kullandığımız semboller kullanılsın" —
 * yani BranchAvatar'ın lucide ikon seti (src/components/branch-icons.tsx), public/branches/
 * altındaki Higgsfield SVG'leri DEĞİL (v6.99.2 o seti kullanıyordu — süperseder edildi).
 *
 *   · AKADEMİK + branşlı içerik → branş ikonu (BRANCH_ICONS) branş renginde, koyu plaka üstünde.
 *   · Diğer bölümler → public/doctorium/*.webp (2026-08-16 Higgsfield üretimi; branş sembol
 *     dilini stil referansı almıştı: ince neon çizgi + gömülü koyu zemin #0D0E10). Hukukta tür
 *     ayrımı 2026-08-14 sembol kararıyla hizalı: terazi=mevzuat · tokmak=içtihat · kitap=doktrin.
 *
 * Koyu plaka her kapakta ortak zemin → iki temada da tutarlı, tema-duyarlı yeniden boyama yok.
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

/**
 * Akademik içerik → branş ikonu (AURA kanonik seti). Branşsız/eşleşmeyen içerikte null —
 * çağıran Higgsfield mikroskop sembolüne düşer.
 */
function branchIconOf(item: Pick<FeedItem, "module" | "branchSlugs">): { Icon: BranchIconLike; color: string } | null {
  if (item.module !== "akademik") return null;
  for (const s of item.branchSlugs) {
    const key = resolveBranchKey(s);
    if (key) return { Icon: BRANCH_ICONS[key] ?? Stethoscope, color: branchColor(key) };
  }
  return null;
}

/** İçerik → sembol dosyası (branş-ikonu OLMAYAN her şey). Bilinmeyen modül sektörele düşer. */
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
  item: Pick<FeedItem, "id" | "module" | "kind" | "title" | "sourceName" | "branchSlugs">;
  size: "card" | "band";
}) {
  const branch = branchIconOf(item);

  if (size === "card") {
    return (
      // Koyu plaka — Higgsfield sembollerinin gömülü zeminiyle aynı; branş ikonu da bu zeminde
      // branş rengiyle çizilir (neon hissi için hafif drop-shadow ışıması).
      <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl bg-[#0d0e10]" aria-hidden="true">
        {branch ? (
          createElement(branch.Icon, {
            size: 38, color: branch.color, strokeWidth: 1.9,
            // lucide ikonlar SVG props geçirir — filter ışıma Higgsfield neon diline yaklaştırır.
            ...{ style: { filter: `drop-shadow(0 0 6px ${branch.color}80)` } },
          })
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- yerel statik varlık; next/image
             72px sabit kutu için ek katman getirir, kazanç yok (dosyalar 3-7 KB webp). */
          <img src={symbolSrc(item)} alt="" width={72} height={72} className="block h-full w-full object-cover" />
        )}
      </div>
    );
  }

  // band — detay sayfası üst bandı: koyu plaka içinde sembol, altta künye şeridi.
  const c = MODULE_COLOR[item.module] ?? "var(--c-ink-3)";
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--c-hairline)]" aria-hidden="true">
      <div className="grid h-[140px] place-items-center bg-[#0d0e10]">
        {branch ? (
          createElement(branch.Icon, {
            size: 72, color: branch.color, strokeWidth: 1.6,
            ...{ style: { filter: `drop-shadow(0 0 10px ${branch.color}80)` } },
          })
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- yukarıdaki gerekçeyle aynı. */
          <img src={symbolSrc(item)} alt="" className="block h-full w-auto" />
        )}
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
