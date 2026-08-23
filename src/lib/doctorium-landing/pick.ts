// Landing kart SEÇİM yardımcıları — SAF, istemci-güvenli (db yok). landing-feed.ts (sunucu) ve
// PersonalizationDemo (istemci) aynı kuralı kullanır; kopya mantık = drift.
import type { FeedItem } from "@/lib/doctorium";

/**
 * Branşla eşleşen kartlar ÖNE (inceleme notu 2026-08-23: "ilk kartlar kişiselleştirmenin etkisini
 * dramatik kanıtlasın; branştan bağımsız içerik aşağıda kalsın"). Kararlı bölümleme — iki grubun
 * kendi içindeki interleave sırası korunur. Akış kuralı DEĞİŞMEZ (portal aynı); yalnız landing dizilimi.
 */
export function branchFirst<T extends Pick<FeedItem, "branchSlugs">>(items: T[], branch: string): T[] {
  const hit: T[] = [];
  const rest: T[] = [];
  for (const i of items) (i.branchSlugs.includes(branch) ? hit : rest).push(i);
  return [...hit, ...rest];
}

/**
 * Her ana bölümden bir kart (akademik · etkinlik · ilaç · hukuk) — TÜR ÇEŞİTLİLİĞİ kanıtı (QA DESK-02:
 * "birbirinin benzeri iki ClinicalTrials kartı üst üste gelmesin; akademik + regülasyon + hukuk/kongre
 * karışımı"). Bölüm içinde branşla eşleşen kart tercih edilir; eşleşenler ilk sırada. `limit` ile
 * hero (3) / Bugün (3+1) / demo (3) aynı seçiciyi kullanır.
 */
export function pickOnePerModule(items: FeedItem[], branch?: string, limit = 4): FeedItem[] {
  const want = ["akademik", "etkinlik", "ilac", "mevzuat"];
  const out: FeedItem[] = [];
  for (const m of want) {
    const pool = items.filter((i) => i.module === m);
    const hit = (branch && pool.find((i) => i.branchSlugs.includes(branch))) || pool[0];
    if (hit) out.push(hit);
  }
  // Eksik bölümü sıradaki farklı kartla doldur (limit'e tamamla; tekrar yok).
  for (const i of items) {
    if (out.length >= limit) break;
    if (!out.includes(i)) out.push(i);
  }
  return (branch ? branchFirst(out, branch) : out).slice(0, limit);
}
