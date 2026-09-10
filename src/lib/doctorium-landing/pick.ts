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
/**
 * Kongre kanıtı sıralaması (v6.262, 2026-09-10 — 👤 küçük paket): landing örneğinde "Bildiri süresi doldu · Erken kayıt sona
 * erdi" satırları görünmesin. Bildiri YA DA erken kayıt son günü henüz geçmemiş (gün sonu dahil — CongressList Deadline
 * kuralıyla aynı: at + 24 saat > now) etkinlikler ÖNE, kendi içinde başlangıç tarihine göre; kalanlar aynen arkada. Kararlı.
 */
export function openDeadlineFirst<T extends { startDate: Date; abstractDeadline: Date | null; earlyBirdDeadline: Date | null }>(rows: T[], now: Date): T[] {
  const open = (d: Date | null) => !!d && d.getTime() + 86_400_000 > now.getTime();
  const hit: T[] = [];
  const rest: T[] = [];
  for (const r of rows) (open(r.abstractDeadline) || open(r.earlyBirdDeadline) ? hit : rest).push(r);
  const byStart = (a: T, b: T) => a.startDate.getTime() - b.startDate.getTime();
  return [...hit.sort(byStart), ...rest.sort(byStart)];
}

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
