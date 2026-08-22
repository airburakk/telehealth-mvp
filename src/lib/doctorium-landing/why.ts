// "Bunu neden görüyorum?" — KURALDAN TÜRETİLMİŞ açıklama (2026-08-23). İstemci-güvenli.
//
// Portalda kart düzeyinde açıklama YOK (keşif 2026-08-23, grep 0). Akış kuralı ise deterministik:
// akademik kartlar seçili branşlarla süzülür, diğer bölümler bölüm tercihiyle girer, her bölüm
// kendi kotasından gelir (lib/doctorium.ts:541-587). Bu fonksiyon YALNIZ o kuralı cümleye çevirir —
// "ilgi skoru", "yapay zekâ seçti" gibi OLMAYAN bir mekanizma ima etmez (registry feed.why: partial).
import type { FeedItem } from "@/lib/doctorium";
import { FEED_MODULE_LABEL } from "./taxonomy";

export interface WhyShown {
  /** Kısa, kartın altına düşen tek satır. */
  line: string;
  /** Hangi kural tetikledi — test ve ileride UI rozetleri için. */
  rule: "branch" | "module" | "all";
}

export function whyShown(
  item: Pick<FeedItem, "module" | "branchSlugs">,
  selectedBranches: readonly string[],
  branchLabel: (slug: string) => string,
): WhyShown {
  const moduleLabel = FEED_MODULE_LABEL[moduleKeyOf(item)] ?? item.module;
  const hit = item.branchSlugs.find((s) => selectedBranches.includes(s));
  if (hit) {
    return { line: `Branşınız: ${branchLabel(hit)} · Bölüm: ${moduleLabel}`, rule: "branch" };
  }
  if (selectedBranches.length === 0) {
    return { line: `Bölüm: ${moduleLabel} · Tüm branşlar`, rule: "all" };
  }
  // Akademik dışı bölümler branşla süzülmez — kart bölüm tercihiyle gelir.
  return { line: `Bölüm: ${moduleLabel} · Branştan bağımsız`, rule: "module" };
}

/** FeedItem.module ("mevzuat" + kind) → tercih anahtarı ("hukuk-mevzuat" vb.). */
export function moduleKeyOf(item: Pick<FeedItem, "module"> & { kind?: string }): string {
  if (item.module === "mevzuat") {
    if (item.kind === "ictihat") return "hukuk-ictihat";
    if (item.kind === "doktrin") return "hukuk-doktrin";
    return "hukuk-mevzuat";
  }
  return item.module;
}
